#!/usr/bin/env node
/**
 * adb-bridge.js — 本地 adb 桥接服务（零依赖）
 *
 * 作用：让浏览器里的单文件分析工具（index.html）
 * 能「直接」通过本机 adb 抓取设备 dumpsys 数据，无需手动复制粘贴。
 *
 * 工作原理：
 *   工具页面（运行在 localhost 的 WorkBuddy 预览里）通过 fetch 访问本服务：
 *     GET /ping                                  -> { ok:true, port }
 *     GET /devices                               -> { devices:[{serial,state,model,product,transportId}] }
 *     GET /dump?device=<serial>&command=<cmd>    -> 原始 dumpsys 文本（text/plain）
 *   cmd 取值：containers | surfaceflinger | window
 *
 * 运行：先确保本机已装 adb 并在 PATH 中，然后：
 *   node adb-bridge.js
 * 可选：ADB_BRIDGE_PORT=7788 node adb-bridge.js   （默认 7788）
 *
 * 服务仅监听 127.0.0.1，仅供本机浏览器访问。
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');

const PORT = parseInt(process.env.ADB_BRIDGE_PORT, 10) || 7788;
const HOST = '127.0.0.1';
// 同目录下的分析工具 HTML，启动时作为静态页面直接提供给浏览器
const HTML_FILE = path.join(__dirname, 'index.html');
// dumpsys 可能输出很大（containers 几十 KB ~ 几 MB），放宽缓冲与超时
const MAX_BUFFER = 64 * 1024 * 1024;
const DUMP_TIMEOUT = 120000;

// ---- 心跳自动停止 ----
// 页面打开后每隔 10s 发一次 /ping；若超过 HEARTBEAT_TIMEOUT ms 没收到任何请求，
// 说明用户已关闭页面，服务自动退出，无需手动 Ctrl+C。
// ---- 常驻设计：桥接默认永不自动退出（无心跳自停、无自杀机制）----
// 要停止桥接只有 3 种方式：
//   1) 前台运行时按 Ctrl+C；
//   2) 页面点击「⏹ 停止桥接」按钮（发 /shutdown）；
//   3) 页面关闭时 sendBeacon 发 /shutdown。
// 页面关不关、有没有心跳，都不影响桥接存活——它就是常驻服务。
const HEARTBEAT_TIMEOUT = Infinity;
let lastHeartbeat = Date.now();
let heartbeatTimer = null;
function startHeartbeatWatcher() {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(function () {
    if (HEARTBEAT_TIMEOUT !== Infinity && Date.now() - lastHeartbeat > HEARTBEAT_TIMEOUT) {
      console.log('[adb-bridge] 页面已关闭（' + Math.round(HEARTBEAT_TIMEOUT / 1000) + 's 无心跳），自动停止服务。');
      gracefulShutdown();
    }
  }, 5000);
}
function touchHeartbeat() { lastHeartbeat = Date.now(); }
function gracefulShutdown() {
  try { server.close(); } catch (_) {}
  if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
  process.exit(0);
}

// cmd -> adb 参数
const COMMAND_MAP = {
  containers: ['shell', 'dumpsys', 'activity', 'containers'],
  surfaceflinger: ['shell', 'dumpsys', 'SurfaceFlinger'],
  window: ['shell', 'dumpsys', 'window', 'windows']
};

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    // Chrome PNA：访问 private network 时必须响应此头，否则 fetch 被浏览器拦截
    'Access-Control-Allow-Private-Network': 'true'
  });
  res.end(body);
}

function sendText(res, code, text) {
  res.writeHead(code, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Private-Network': 'true'
  });
  res.end(text);
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
}

// 解析 `adb devices -l` 输出
function parseDevices(raw) {
  const lines = String(raw || '').split(/\r?\n/);
  const devices = [];
  const STATE_RE = /^(device|offline|unauthorized|bootloader|recovery|no\s*permissions|sideload|disconnected|host)$/;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('*')) continue;                 // daemon 日志行
    if (/^List of devices attached/i.test(trimmed)) continue; // 表头
    const tokens = trimmed.split(/\s+/);
    if (tokens.length < 2) continue;
    const serial = tokens[0];
    const state = tokens[1];
    if (!STATE_RE.test(state)) continue;
    const rec = { serial, state };
    // 解析 key:value 后缀（model:xxx product:yyy transport_id:z）
    for (let i = 2; i < tokens.length; i++) {
      const kv = tokens[i].split(':');
      if (kv.length >= 2) {
        const key = kv[0];
        const val = kv.slice(1).join(':');
        if (key === 'model') rec.model = val;
        else if (key === 'product') rec.product = val;
        else if (key === 'transport_id') rec.transportId = val;
      }
    }
    devices.push(rec);
  }
  return devices;
}

// 运行一个 adb 命令，返回 Promise<{stdout, stderr, code}>
function runAdb(args, opts) {
  return new Promise((resolve) => {
    const timeout = (opts && opts.timeout) || DUMP_TIMEOUT;
    let proc;
    try {
      proc = spawn('adb', args, { windowsHide: true });
    } catch (e) {
      resolve({ stdout: '', stderr: 'spawn adb 失败：' + e.message, code: -1, spawnError: true });
      return;
    }
    let stdout = '';
    let stderr = '';
    let done = false;
    const finish = (code, spawnError) => {
      if (done) return;
      done = true;
      resolve({ stdout, stderr, code: code == null ? -1 : code, spawnError: !!spawnError });
    };
    if (proc.stdout) proc.stdout.on('data', (d) => { stdout += d.toString('utf8'); });
    if (proc.stderr) proc.stderr.on('data', (d) => { stderr += d.toString('utf8'); });
    proc.on('error', (e) => { finish(-1, e.code || e.message); });
    proc.on('close', (code) => { finish(code); });
    // 超时保护
    const timer = setTimeout(() => {
      try { proc.kill('SIGKILL'); } catch (_) {}
      finish(-2, 'timeout');
    }, timeout);
    if (proc.stdout) proc.stdout.on('end', () => clearTimeout(timer));
    if (!proc.stdout) clearTimeout(timer);
  });
}

// 静态托管分析工具 HTML 页面
function serveHtml(res) {
  fs.readFile(HTML_FILE, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('未找到分析工具 HTML（' + HTML_FILE + '）。请确认 adb-bridge.js 与 index.html 在同一目录。');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(data);
  });
}

// 监听就绪后自动打开浏览器（跨平台）
function openBrowser(url) {
  const cmd = process.platform === 'darwin' ? 'open' : (process.platform === 'win32' ? 'start ""' : 'xdg-open');
  try {
    exec(`${cmd} "${url}"`, { windowsHide: true }, () => {});
  } catch (_) { /* 打开失败不影响服务 */ }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  const path = url.pathname;
  const method = req.method.toUpperCase();

  // 预检
  if (method === 'OPTIONS') {
    setCors(res);
    res.writeHead(204);
    res.end();
    return;
  }
  setCors(res);
  touchHeartbeat(); // 任何请求都视为页面还活着

  try {
    // 静态托管分析工具本身：访问 http://127.0.0.1:7788/ 即可打开工具页面
    if (method === 'GET' && (path === '/' || path === '/index.html')) {
      serveHtml(res);
      return;
    }

    if (path === '/ping') {
      sendJson(res, 200, { ok: true, port: server.address() ? server.address().port : PORT });
      return;
    }

    if (path === '/shutdown') {
      sendJson(res, 200, { ok: true, message: 'shutting down' });
      gracefulShutdown();
      return;
    }

    if (path === '/devices') {
      const r = await runAdb(['devices', '-l'], { timeout: 15000 });
      if (r.spawnError) {
        sendJson(res, 200, { devices: [], adbError: true, message: r.stderr || '无法启动 adb，请确认已安装并在 PATH 中' });
        return;
      }
      sendJson(res, 200, { devices: parseDevices(r.stdout) });
      return;
    }

    if (path === '/dump') {
      const device = (url.searchParams.get('device') || '').trim();
      const command = (url.searchParams.get('command') || '').trim();
      if (!COMMAND_MAP[command]) {
        sendText(res, 400, '未知 command：' + command + '（应为 containers|surfaceflinger|window）');
        return;
      }
      const args = device ? ['-s', device].concat(COMMAND_MAP[command]) : COMMAND_MAP[command].slice();
      const r = await runAdb(args, { timeout: DUMP_TIMEOUT });
      if (r.spawnError) {
        sendText(res, 500, '执行 adb 失败：' + (r.stderr || r.code));
        return;
      }
      if (r.code !== 0) {
        sendText(res, 500, 'adb 返回非零退出码 ' + r.code + (r.stderr ? ('\n' + r.stderr) : ''));
        return;
      }
      sendText(res, 200, r.stdout);
      return;
    }

    sendJson(res, 404, { ok: false, message: '未知端点：' + path });
  } catch (e) {
    sendJson(res, 500, { ok: false, message: '桥接服务内部错误：' + (e && e.message ? e.message : e) });
  }
});

function onReady() {
  const port = server.address().port;
  // 通过 ?adbport= 把真实监听端口告诉页面，即使因端口被占而顺延也能正确连接
  const url = `http://${HOST}:${port}/?adbport=${port}`;
  console.log(`[adb-bridge] 服务已启动：${url}`);
  startHeartbeatWatcher();
  // 环境变量 ADB_BRIDGE_NO_BROWSER=1 时不自动开浏览器
  // （供 WorkBuddy / 其他宿主在后台托管时使用，避免重复弹出浏览器）
  if (process.env.ADB_BRIDGE_NO_BROWSER === '1') {
    console.log('[adb-bridge] ADB_BRIDGE_NO_BROWSER=1，跳过自动打开浏览器（由宿主托管）。');
    console.log('[adb-bridge] 停止服务请按 Ctrl+C，或关闭页面后自动停止。');
  } else {
    console.log('[adb-bridge] 正在自动打开浏览器……（若未弹出，请手动访问上面的地址）');
    console.log('[adb-bridge] 停止服务请按 Ctrl+C，或关闭页面后自动停止。');
    openBrowser(url);
  }
}

// 端口占用时自动顺延（最多 +10），避免在其他设备上因端口被占而直接崩溃
let _port = PORT;
function onError(err) {
  if (err && err.code === 'EADDRINUSE' && _port < PORT + 10) {
    _port++;
    console.log(`[adb-bridge] 端口 ${_port - 1} 被占用，尝试 ${_port} …`);
    server.listen(_port, HOST);
  } else {
    console.error('[adb-bridge] 启动失败：', err && err.message ? err.message : err);
    process.exit(1);
  }
}
server.on('error', onError);
// 仅成功监听时触发一次；触发后移除 error 监听，避免运行期错误误触发端口重试
server.once('listening', function () {
  server.removeListener('error', onError);
  onReady();
});
server.listen(_port, HOST);

// Ctrl+C 优雅退出
process.on('SIGINT', function () {
  console.log('\n[adb-bridge] 收到 Ctrl+C，正在停止服务……');
  gracefulShutdown();
});
process.on('SIGTERM', function () {
  gracefulShutdown();
});

// 便于单元测试
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { parseDevices, COMMAND_MAP };
}
