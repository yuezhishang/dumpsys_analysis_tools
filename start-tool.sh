#!/usr/bin/env bash
# dumpsys 可视化工具启动器（bash 版，macOS / Linux / Git Bash）
# 运行 adb 桥接服务并自动打开浏览器；关闭本进程即停止服务。
# 若未检测到 Node.js，则直接打开工具页面（降级模式，仅示例/手动粘贴可用）。

set -u
cd "$(dirname "$0")" || exit 1

HTML_FILE="$(dirname "$0")/index.html"
BRIDGE="$(dirname "$0")/adb-bridge.js"
NODE_BIN=""

echo "============================================================"
echo "  dumpsys 可视化工具启动器"
echo "============================================================"
echo

# 1. 定位 Node.js（环境隔离，优先同目录便携版 node/node，其次 PATH，再常见路径 / nvm）
if [ -x "$(dirname "$0")/node/node" ]; then
  NODE_BIN="$(dirname "$0")/node/node"
elif [ -x "$(dirname "$0")/node" ]; then
  NODE_BIN="$(dirname "$0")/node"
elif command -v node >/dev/null 2>&1; then
  NODE_BIN="node"
elif [ -x "/usr/local/bin/node" ]; then
  NODE_BIN="/usr/local/bin/node"
elif [ -x "$HOME/.nvm/versions/node/$(ls -t "$HOME/.nvm/versions/node" 2>/dev/null | head -1)/bin/node" ]; then
  NODE_BIN="$HOME/.nvm/versions/node/$(ls -t "$HOME/.nvm/versions/node" 2>/dev/null | head -1)/bin/node"
fi

if [ -z "$NODE_BIN" ]; then
  echo "[降级模式] 未检测到 Node.js。直接打开工具页面（示例/手动粘贴可用，抓取功能不可用）。"
  echo
  if [ -f "$HTML_FILE" ]; then
    echo "正在打开工具页面……"
    if command -v xdg-open >/dev/null 2>&1; then xdg-open "$HTML_FILE" >/dev/null 2>&1
    elif command -v open >/dev/null 2>&1; then open "$HTML_FILE" >/dev/null 2>&1
    else echo "请手动打开：$HTML_FILE"; fi
  else
    echo "[错误] 未找到 $HTML_FILE"
  fi
  echo
  echo "按 Enter 退出……"
  read -r
  exit 0
fi

echo "[检测] Node.js 就绪：$NODE_BIN"
if command -v adb >/dev/null 2>&1; then
  echo "[检测] adb 已就绪，「从设备抓取」可用。"
else
  echo "[提示] 未检测到 adb，「从设备抓取」将不可用（安装 adb 后重启本启动器即可）。"
fi
echo
echo "正在启动 adb 桥接服务（保持终端开着；Ctrl+C 或关闭终端即停止）……"
echo
echo "工具页面将自动在浏览器打开：http://127.0.0.1:7788/"
( sleep 1; if command -v xdg-open >/dev/null 2>&1; then xdg-open "http://127.0.0.1:7788/" >/dev/null 2>&1; elif command -v open >/dev/null 2>&1; then open "http://127.0.0.1:7788/" >/dev/null 2>&1; fi ) &
"$NODE_BIN" "$BRIDGE"
echo "[已停止] 按 Enter 关闭窗口……"
read -r
