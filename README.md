# Dumpsys Activity Containers Visualizer

> 一个**单文件、零依赖**的 Android 窗口层级可视化工具：把 `adb dumpsys` 的庞杂文本，变成可缩放、可搜索、可折叠的层级树与图层卡片。
> 支持 `dumpsys activity containers` / `dumpsys activity activities` / `am stack list` / `dumpsys window containers` / `dumpsys SurfaceFlinger` / `dumpsys window`，覆盖 **Android 9 – 16**。

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) [![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)](#快速开始) [![Version](https://img.shields.io/badge/version-v1.37-green.svg)](#版本)

---

## 这是什么

在 Android 系统里排查窗口层级、合成合层（HWC）、`mDrawState` 绘制状态时，原生的 `dumpsys` 输出动辄上千行纯文本，人眼几乎无法快速理清「谁在谁上面、谁挡住了谁」。

本工具把这些文本解析成结构化的可视化视图：

- **容器树**：`dumpsys activity containers` 的 WindowContainer 层级（DisplayContent → TaskDisplayArea → Task → ActivityRecord → WindowToken → WindowState …）。
- **HWC 合成预览**：`dumpsys SurfaceFlinger` 中真实合层（Hardware Composer）的图层清单与几何，标注焦点窗口。
- **SF 层级树**：Android 14+ 整合的 `Layer Hierarchy` 段，呈现 SurfaceFlinger 侧的完整层级。
- **窗口图层**：`dumpsys window` 的每个窗口卡片，按 Z 序排列，并标出 **5 种 `mDrawState`** 状态。

无需安装任何 npm 包、无需构建步骤——下载即用。

---

## 特性

- 🧩 **单文件 HTML**：`index.html` 内聚全部逻辑与样式，可直接双击打开（示例/手动粘贴模式）。
- 🔌 **零依赖桥接**：`adb-bridge.js` 仅用 Node.js 内置模块，不需要 `npm install`。
- 📦 **便携 Node 运行时**：`node/node.exe` 已随包提供，没有 Node.js 也能跑（跨设备干净复制即可用）。
- 🪟 **三端启动器**：`start-tool.bat`（Windows）/ `start-tool.sh`（macOS·Linux·Git Bash），双击即启动；**由桥接用真实端口打开一个工具页面**（启动器不再重复打开 —— 旧版启动器与桥接各开一次，会开出两个标签页），桥接起不来时启动器才兜底打开本地降级页。
- 🔍 **统一交互**：搜索、节点折叠、重置布局、导出图片，在 Containers / SurfaceFlinger / Window 各视图一致可用。
- 📱 **Android 9–16 全对齐**：A9/10/11 扁平格式、A12/13 分散旧格式、A14+ 树形 `Layer Hierarchy` 均已适配。
- 🧪 **内置样例数据**：未接设备也能先看效果，上手零门槛。
- 🎯 **六大数据源**：Activity Containers / Activities / Stack List（`am stack list`）/ Window Containers / SurfaceFlinger / Window，分别对应 WMS 容器树、ATMS 逻辑层、ATMS 任务栈速览、WMS 原生入口、真实合成图层、窗口 `mDrawState`。
- ℹ️ **视角 / 排查对照**：内置「视角/排查」面板，标注每条 `dumpsys` 命令的视角与适用排查场景，理清四层关系不混淆。

---

## 使用截图

| 主界面（Main） | 容器树（Containers） |
| --- | --- |
| ![主界面](samples/main.jpg) | ![容器树](samples/containers.png) |

| SF 层级树（SurfaceFlinger） | 窗口图层（Windows） |
| --- | --- |
| ![SF 层级树](samples/SurfaceFlinger.png) | ![窗口图层](samples/windows.png) |

- **主界面**：工具入口与整体布局（数据源选择、视图切换、抓取控制）。
- **容器树**：`dumpsys activity containers` 的 WindowContainer 层级，支持缩放、搜索、节点折叠与导出图片。
- **SF 层级树**：Android 14+ 整合的 `Layer Hierarchy` 完整层级（可开启「以容器形式展示」折叠窗口子 surface）。
- **窗口图层**：`dumpsys window` 的每个窗口卡片，按 Z 序（降序）排列，标出焦点窗口与 5 种 `mDrawState`。

---

## 各 dumpsys 命令的视角与排查用途

工具把五条核心命令拆成独立数据源——它们**视角不同、排查用途不同**，但底层是同一棵 `WindowContainer` 树：

> **activity activities** ⊂ **activity containers / window containers**（同一棵 WindowContainer 树，ATMS 与 WMS 共享引用）→ 每个窗口的 surface → **SurfaceFlinger**（独立 native 进程，只认屏幕像素）。

| 命令 | 视角（谁在看） | 关注点 | 适用排查 | 工具入口 |
| --- | --- | --- | --- | --- |
| `dumpsys activity activities` | ATMS：活动 / 任务**逻辑生命周期** | Task / ActivityRecord 状态（RESUMED / PAUSED / STOPPED）、Intent、进程名、焦点 | 前台 activity 错乱、状态卡死、task 栈异常、Intent / 进程归属 | 🎯 **Activities**（树视图高亮 Resumed / Focused；详情面板顶部「排查洞察」自动检测多 RESUMED 冲突、焦点指向 paused、task 栈深度，并汇总 Intent/进程/uid 归属） |
| `am stack list` | ATMS：**任务栈速览**（Stack / RootTask → Task 两层，逻辑层摘要） | 每个栈的 id / bounds / displayId / userId，以及 `configuration` 里的 `mWindowingMode` / `mActivityType`；每个 Task 的 `visible` 与栈顶 Activity。**跨版本适配**：A9–A10 容器头为 `Stack id=N`（A9 部分输出**无** `configuration` 行 → 布局不可得，工具如实标注「该版本无此字段」而非显示「未知」），A11+ 改名为 `RootTask id=N` | 一眼看清栈数、可见(前台) task、display 分布、布局（全屏/分屏/PIP，取自 mWindowingMode） | 🗂 **Stack List**（**任务栈速览面板，非层级树**：概览卡 + 每栈卡片（布局徽章取 `mWindowingMode`、类型徽章取 `mActivityType`）+ 每 task 行；**画布可直接拖拽平移 / 滚轮缩放 / 重置布局**。注意：该命令**无焦点字段**，前台仅按 `visible=true` 判定） |
| `dumpsys activity containers` | 经 ATMS 入口看 **WindowContainer 容器树** | 容器嵌套（到 WindowState），节点父子关系 | 容器父子关系、窗口层级嵌套、谁在谁下面 | 📦 **Activity Containers** |
| `dumpsys window containers` | WMS **原生入口**看同一棵树（窗口管理视角） | 窗口可见性 / 动画 / surface 归属（与 activity containers 同结构） | 与 activity containers 互为印证，看窗口怎么挂、surface 归属 | 🪟 **Window Containers**（同树；ActivityRecord 下的窗口 token 已标注 🪟 surface 归属） |
| `dumpsys SurfaceFlinger` | 独立 native 进程，**真实合成图层**（屏幕像素） | 按 Z 序排列的 Layer（扁平，无 task 嵌套）、HWC、几何、buffer | 黑屏、图层遮挡、HWC 合层失败、Z 序错乱、窗口没上屏 | 🖥 **SurfaceFlinger**（HWC 合成预览 / 层级树） |

> 点工具里的 **ℹ️ 视角/排查** 按钮可随时弹出此对照表。

---

## 目录结构

```text
dumpsys-activity-containers-visualizer/
├── index.html          # 主工具（单文件，零依赖）
├── adb-bridge.js       # adb 桥接服务（Node.js 内置模块，无需 npm install）
├── start-tool.bat      # Windows 启动器（双击运行）
├── start-tool.sh       # macOS / Linux / Git Bash 启动器
├── node/
│   └── node.exe        # 便携 Node.js 运行时（v22.x，约 84MB，已随包提供）
├── samples/            # 使用截图（README 展示用）
│   ├── main.jpg
│   ├── containers.png
│   ├── SurfaceFlinger.png
│   └── windows.png
├── README.md
└── LICENSE
```

> `node/node.exe` 一并随仓库提供，目的是让工具**自包含、可干净地拷贝到任意设备直接运行**。它约 84MB，克隆仓库时会一并下载——若你已在本机装好 Node.js，可忽略该文件，启动器会自动优先使用系统 Node。

---

## 快速开始

### Windows

直接**双击 `start-tool.bat`**。它会：

1. 自动定位 Node.js（优先用同目录 `node/node.exe`，其次 PATH / 常见安装路径）；
2. 启动 adb 桥接服务（终端窗口保持打开 = 服务在线）；
3. 自动打开浏览器访问 `http://127.0.0.1:7788/`。

关闭该终端窗口（或 `Ctrl+C`）即停止服务。

### macOS / Linux / Git Bash

在终端执行：

```bash
bash start-tool.sh
```

行为同上：启动桥接 → 自动打开浏览器。未检测到 Node.js 时进入降级模式（直接打开 `index.html`，仅示例/手动粘贴可用）。

### 不需要设备也能看

直接双击 `index.html` 用浏览器打开，工具内置了代表性样例数据，可立即体验各视图与交互。

---

## 工作原理

工具运行在「浏览器 ↔ 本地桥接 ↔ adb」三层结构，没有云端、没有后台进程常驻：

```text
┌──────────────┐      HTTP (127.0.0.1:7788)      ┌──────────────┐      adb       ┌──────────┐
│  浏览器      │ ───────────────────────────────▶ │  adb-bridge  │ ───────────▶ │  设备    │
│  index.html  │ ◀─────────────────────────────── │  .js (Node)  │ ◀─────────── │ (Android)│
└──────────────┘    dumpsys 文本 / 设备列表        └──────────────┘  dumpsys 输出 └──────────┘
```

- 桥接服务只在本机 `127.0.0.1` 监听，**不上传任何数据**，纯本地解析。
- 服务**不会自动退出**：只有你主动关闭终端 / `Ctrl+C` / 关闭工具页面（发送停止信号）时停止。
- 点击工具内「从设备抓取」即向桥接请求 `adb devices` 与 `adb shell dumpsys ...`，取回文本后在前端解析渲染。

> 为什么需要桥接而不是直接在网页里跑 adb？浏览器出于安全限制无法直接调用 `adb`。桥接服务用 Node.js 在本机起一个轻量 HTTP 服务，作为浏览器与 adb 之间的安全代理。

---

## 支持范围

| 项目 | 说明 |
| --- | --- |
| Android 版本 | 9 / 10 / 11 / 12 / 13 / 14 / 15 / 16 |
| 数据源 | `dumpsys activity containers`、`dumpsys activity activities`、`am stack list`、`dumpsys window containers`、`dumpsys SurfaceFlinger`、`dumpsys window` |
| 视图 | 容器树、Activities 树、Window Containers 树、HWC 合成预览、SF 层级树（A14+）、窗口图层 |
| 解析格式 | A9–11 扁平 `Visible/HWC layers`；A12/13 分散旧格式（TimeStats → Offscreen Layers）；A14+ 树形 `Layer Hierarchy` |

---

## 各视图说明

### 1. 容器树（Containers）
解析 `dumpsys activity containers`，还原 WMS 的 WindowContainer 子树。从 `DisplayContent` 根节点逐级展开到 `WindowState`，每个节点标注类型、token、焦点状态。

### 2. HWC 合成预览（SurfaceFlinger）
解析 `dumpsys SurfaceFlinger` 的 **HWC layers** 真实合层表（这是合层权威清单），展示每个图层的几何、Z 序，并高亮当前焦点窗口。未接设备时由 **containers / windowcontainers** 数据推导 HWC（仅供参考）。

> **注意**：HWC 合成预览仅对 `containers` / `windowcontainers` / `surfaceflinger` 数据源可用。`activities` 与 `window` 数据源不提供完整的 Layer 几何 / Z 序，无法推导 HWC，因此这两个数据源下 HWC 视图按钮自动隐藏。

### 3. SF 层级树（SurfaceFlinger Tree，Android 14+）
解析 Android 14 起整合的 `Layer Hierarchy` 树形段，呈现 SurfaceFlinger 侧的完整层级（与 containers 同源，但把每个窗口再向下拆出子 surface 并多出辅助层）。可开启「以容器形式展示」开关折叠窗口子 surface。

### 4. 窗口图层（Windows）
解析 `dumpsys window windows`，按 Z 序（降序）排列每个窗口卡片，标出焦点窗口 `★`，并展示 `mDrawState`、尺寸、属性等关键参数。

### 5. Activities 树（dumpsys activity activities）
解析 `dumpsys activity activities`，从 ATMS **逻辑生命周期**视角还原 `TaskDisplayArea → RootTask → ActivityRecord` 层级（只到 ActivityRecord，不含窗口 surface）。除骨架树外，工具对输出做**第二遍扫描**，把排查用得上的关键字段挂到对应节点（点击节点在详情面板可见，每个字段都有中文说明）：`state`（RESUMED/PAUSED/STOPPED）、`packageName` / `processName` / `pid` / `uid`、`taskAffinity`、`mIntent`（含 `cmp=` 真正要启动的组件）、`mResumed` / `mVisible` / `mDrawing` / `mVisibleRequested` / `isVisible` / `keysPaused`、`displayId` / `bounds` 等，并在节点上打 `resumed` / `paused` / `stopped` / `visible` / `focused` 状态徽章。自动高亮 `mResumedActivity` / `mFocusedApp` 指向的 Activity，并可用「⚡ 定位 Resumed」一键跳转。
**更重要的是「排查洞察」面板**：切到 Activities 后，详情面板顶部自动生成，直接服务于「便于排查问题」：① 自动检测**多个 Activity 同时 RESUMED**（前台冲突）；② 检测 **mFocusedApp 焦点指向 paused/非 RESUMED**（前台焦点与实际状态不一致，可能卡死）；③ 检测 **STOPPED 却仍可见**；④ 按 task 统计**回退栈深度**（任务栈异常）；⑤ 汇总**每个 Activity 的 Intent(component) / 进程名 / uid / pid / taskAffinity 归属表**。无需自己从骨架树里找——异常会被红字标出。

### 6. Window Containers 树（dumpsys window containers）
解析 `dumpsys window containers`——这是 WMS **原生入口** dump 的同一棵 WindowContainer 树（与 Activity Containers 结构完全一致，只是视角从「窗口管理」出发，常带更多可见性 / 动画 / surface 信息）。与 📦 Activity Containers 互为印证，用来核对窗口怎么挂、surface 归属哪里。**关于「surface 归属」如何看**：每个 `ActivityRecord` 之下会挂一个窗口 token 子节点（形如 `#N <hash> <包名/类>`），那**就是该 Activity 的实际渲染面（surface 归属）**——本工具已自动标注为 `🪟 <包名/类> ← surface 归属: <ActivityRecord>`，点击该节点还会在详情面板显示「🪟 surface 归属: …」关系，无需再猜哪块 surface 属于哪个 Activity。

> 小结：`activity activities` 管「谁在跑」，`activity containers` / `window containers` 管「窗口怎么挂」，`SurfaceFlinger` 管「屏幕画了啥」——前三者共享同一棵树，最后一个在独立进程只看真实图层。

---

## mDrawState 五态

`WindowState.mDrawState` 描述窗口「绘制到可显示」的状态机，工具用 5 种颜色区分：

| 状态 | 值 | 含义 |
| --- | --- | --- |
| `NO_SURFACE` | 0 | 还没有 Surface，窗口尚未开始绘制 |
| `DRAW_PENDING` | 1 | 已请求绘制，但第一帧尚未完成 |
| `COMMIT_DRAW_PENDING` | 2 | 绘制已提交，等待合成确认 |
| `READY_TO_SHOW` | 3 | 已就绪，可以显示（等待动画/策略放行） |
| `HAS_DRAWN` | 4 | 已完成绘制并上屏，正常可见状态 |

> 排查「窗口黑屏 / 不显示」时，先看目标窗口是否停在 `DRAW_PENDING` / `COMMIT_DRAW_PENDING`——往往意味着绘制被阻塞或 Surface 未提交。

---

## 端口与桥接

- 默认端口 `7788`；若被占用会自动顺延到 `7789 … 7798`。
- 可用环境变量覆盖：`ADB_BRIDGE_PORT=9000 node adb-bridge.js`。
- 桥接生命周期完全由你控制：
  - **启动**：运行 `start-tool.bat` / `start-tool.sh`（或手动 `node adb-bridge.js`）。
  - **停止**：关闭启动器终端 / `Ctrl+C` / 在工具内关闭页面（发送停止信号）。
- 桥接**永不自动自杀**：没有心跳超时、没有闲置退出，开着就一直在线，直到你主动关。

---

## 常见问题（FAQ）

**Q：点击「从设备抓取」提示未检测到桥接 / adb 未连接？**
A：先运行 `start-tool.bat`（Windows）或 `start-tool.sh`（mac/linux）。若仍失败，确认：
- 设备已通过 USB 连接且 `adb devices` 能看到它；
- 启动器终端提示 `adb ready`；若提示 `adb not found`，请把 `adb` 加入 PATH 或安装 [Android Platform-Tools](https://developer.android.com/tools/releases/platform-tools)。

**Q：没有 Node.js 能跑吗？**
A：能。`node/node.exe` 已随包提供，启动器会自动用它。你也可以手动放到 `node/node.exe`，或安装系统 Node.js（启动器会优先检测同目录便携版，其次 PATH）。

**Q：桥接会在后台偷偷常驻吗？**
A：不会。桥接只在启动器终端开着时运行，关闭终端即停止，没有任何常驻进程或自启动。

**Q：为什么以前启动后会打开两个工具页面？**
A：旧版 `start-tool.bat` / `start-tool.sh` 与 `adb-bridge.js` **各打开了一次**浏览器，两者都指向 `http://127.0.0.1:7788/`，于是开出两个相同标签页。**v1.38 起改为只由桥接打开一次**（用真实监听端口，端口被占顺延后也正确）；启动器仅在桥接**启动失败**（退出码非 0：无 Node / 端口全被占 / 脚本异常）时兜底打开本地 `index.html` 降级页。
另注意：请使用启动器打开的 `http://127.0.0.1:7788/` 页面。**直接双击 `index.html`（`file://`）连不上桥接**（`file://` 的 origin 为 null，会被浏览器的 Private Network Access 拦截），此时「从设备抓取」不可用。

**Q：数据会传到外部吗？**
A：不会。所有解析都在本机浏览器内完成，桥接仅在本机 `127.0.0.1` 与 adb 通信，不上传任何数据。

**Q：端口被占用 / 启动失败？**
A：换端口：`ADB_BRIDGE_PORT=9000 node adb-bridge.js`；或先结束占用 7788 的进程。

**Q：页面打不开 / 样式错乱？**
A：请用现代浏览器（Chrome / Edge / Firefox 新版本）打开 `index.html` 或 `http://127.0.0.1:7788/`。

---

## 本地开发

本工具无需构建。若想本地改动：

```bash
# 任选其一启动桥接
bash start-tool.sh
# 或
node adb-bridge.js

# 然后用浏览器打开 http://127.0.0.1:7788/
```

- `index.html`：所有前端逻辑（解析、渲染、交互）均在这一文件内，直接编辑刷新即可。
- `adb-bridge.js`：桥接服务本体（仅用 Node.js 内置 `http` / `child_process`，无需依赖）。
- 抓取命令可在 `adb-bridge.js` 的 `/dump` 处理中调整（`containers` / `activities` / `windowcontainers` / `surfaceflinger` / `window`）。

---

## 许可证

本项目以 [MIT License](LICENSE) 开源，可自由使用、修改、再分发。

---

## 版本

- **v1.38**（当前）：三项修复 ——
  ① **启动器不再与桥接重复打开浏览器**：此前 `start-tool.bat` / `start-tool.sh` 与 `adb-bridge.js` **各打开一次**，会开出**两个工具页面标签**。现在只由**桥接**用真实端口打开（端口被占顺延后也正确），启动器仅在**桥接退出码非 0**（启动失败：无 Node / 7788–7798 全被占 / 脚本异常）时兜底打开本地降级页。**注意：没连设备、没装 adb 都不会导致桥接启动失败** —— 页面照常打开，只是「从设备抓取」不可用。
  ② **Stack List 完全画布化**：旧 CSS（`.stacklist-root{overflow:auto;height:100%}`）让它成了**原生滚动容器**，与画布 `panX/panY` 的 `transform` 平移语义冲突 —— 拖拽像「搬动一个带滚动条的框」，内容不跟随滚动、滚动条还杵在右边。现改为内容自然撑开（`overflow:visible; height:auto`），完全走画布变换：**拖拽平移 + 滚轮缩放 + 重置布局**，与 window 树视图手感一致；并区分「拖拽」与「点击」（位移 > 5px 不触发 task 卡点击），「定位可见 Task」由 `scrollIntoView` 改为画布居中。
  ③ **`am stack list` 按版本差异适配**：容器头兼容 `Stack id=N`（A9/A10）与 `RootTask id=N`（A11+，RootTask 即 Stack 改名），**字段顺序无关、字段可缺**；`configuration` 行可缺（A8/A9 部分机型没有）→ 缺失时布局 / 可见性一律标注**「该版本无此字段」**，不再显示「未知」、也不用 bounds 几何猜；task 行支持早期只有 `taskId=N: pkg/act`（无 bounds / visible / topActivity）的格式，此时直接用 `pkg/act` 解析出 topPkg / topClass。示例数据按 **A9 / A10 / A11–13 / A14+ 四个格式档**分版本提供（均为检索到的**真实设备输出**并注明来源），不再「8 个版本共用一份 A14 数据」。
- **v1.37**：用**真实设备输出**（LineageOS 21 / Android 14）修正 **Stack List** 的解析与呈现——①容器头识别 `RootTask id=N`（旧版 `Stack id=N` 仍支持）；②解析每个头紧跟的 `configuration={...}`，提取**权威布局字段** `mWindowingMode` / `mActivityType` / `mBounds` / `mAppBounds` / `mMaxBounds` / `mDisplayRotation`；③task 改为按**出现顺序**归属最近容器头（真实输出**无缩进**，此前按缩进建树导致 task 全部孤立）；④**删除伪造的「未识别到 Stack 头」假根**；⑤布局判定改用 `mWindowingMode`（不再用 bounds 几何猜），新增**栈类型徽章** `mActivityType`（桌面栈 / 应用栈 / 系统栈）；⑥**只按 `visible=true` 判定「可见/前台」**（该命令无焦点字段，不再伪造「前台」）。
- **v1.36**：按「**从排查目的出发，不套功能**」重规划三个数据源——①**Stack List 不再是层级树**，改为「任务栈速览面板」：概览卡（栈数 / 任务数 / 可见任务 / display 数 / 布局分布）+ 每栈**布局判定**（全屏 / 分屏·多窗口 / 画中画 PIP，依据 bounds 几何自动识别）+ 每 task 卡（点击看 topActivity 与详情）；并**移除了此前误加的 HWC**（am stack list 无 Layer 几何，无法推导 HWC）。②**Activities 详情面板顶部新增「排查洞察」**：自动检测多个 RESUMED 前台冲突、mFocusedApp 焦点指向 paused、STOPPED 却可见、task 回退栈深度异常，并汇总每个 Activity 的 Intent(component) / 进程名 / uid / pid / taskAffinity 归属表；第二遍扫描补抓 `mIntent` / `mResumed` / `mVisible` / `mDrawing` 等。③**Window Containers 把 ActivityRecord 下的窗口 token 标注为「🪟 surface 归属」**，树与详情面板均可见，真正回答「surface 归属哪个 Activity」。④**补全字段说明字典**（state / packageName / mIntent / mResumed / …），点击字段不再无说明。
- **v1.35**：按「便于排查问题」重新规划 **Activities** 与 **Stack List** 数据源——①`dumpsys activity activities` 在骨架树基础上做第二遍扫描，把 `state` / `packageName` / `processName` / `pid` / `uid` / `taskAffinity` / `mVisibleRequested` / `keysPaused` / `isVisible` / `displayId` / `bounds` 等排查字段挂到节点并打状态徽章（resumed/paused/stopped/visible/focused）；②`am stack list` 解析器重写为**容错式**（字段可选、TopActivity 为 null 不崩、孤儿 Task 挂到合成 Stacks 根），彻底修复真实数据解析失败；③**删除 Window 数据源的 HWC 功能**（窗口无完整 Layer 几何/Z 序，无法推导 HWC，HWC 视图对 `activities` / `window` 自动隐藏）；④**目标版本下拉框按功能支持起始版本动态过滤**（ATMS / WindowContainer 类数据源自 Android 10 起，Window / SurfaceFlinger 自 Android 9 起），不再统一从 Android 9 开始。
- **v1.34**：新增 🗂 **Stack List**（`am stack list`，ATMS 任务栈速览，Activities 轻量版）数据源，还原 `Stack → Task` 两层并高亮可见 / 前台 Task；「视角/排查」面板补充 `am stack list` 条目；桥接抓取同步支持 `amstack`。
- **v1.33**：新增 🎯 **Activities**（`dumpsys activity activities`，ATMS 逻辑层）与 🪟 **Window Containers**（`dumpsys window containers`，WMS 原生入口，与 activity containers 同一棵树）两个数据源；新增「ℹ️ 视角/排查」对照面板，标注每条命令的视角与适用排查场景；桥接抓取同步支持 `activities` / `windowcontainers`。
- **v1.32**：新增「dumpsys window」数据源与「窗口图层」视图，可视化 5 种 `mDrawState`；统一多视图交互；桥接改为纯手动控制（启动器 + 便携 Node）。
- 早期版本（`v1.0` / `v1.10`–`v1.12`）作为封版快照保留。

---

*用 `adb` + 浏览器，把晦涩的 dumpsys 变成一眼看懂的层级图。*
