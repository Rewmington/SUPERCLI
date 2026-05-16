# SUPER-CLI

面向 Windows 优先适配的桌面增强终端工具，用于集中管理 Codex、Claude Code 以及其他本地 AI 命令行工具。项目采用 Electron + React + TypeScript + node-pty + xterm.js 构建。

## 功能概览

- 多标签终端：支持新建、关闭、切换独立终端标签页
- 分屏终端：支持右侧分屏和下方分屏
- 原生终端嵌入：通过 `node-pty` 运行 PowerShell、Codex、Claude Code 等 CLI
- 快捷启动：内置 Codex、Claude Code、PowerShell，并支持新增自定义启动项
- 中文界面：菜单、按钮、设置、状态提示均为简体中文
- 提示音系统：支持新建终端、任务完成、AI 响应完成、错误提醒，自带蜂鸣音并支持自定义音频
- 实用设置：深浅色主题、终端字体字号、窗口置顶、后台静默运行
- 常用命令：内置收藏命令，可一键发送到当前终端

## 项目结构

```text
clidemocodex/
├─ electron/
│  ├─ main.mjs          # Electron 主进程、终端后端、菜单、托盘、设置存储
│  ├─ preload.cjs       # 安全 IPC 桥
│  └─ preload.mjs       # 预留 ESM 版本
├─ shared/
│  └─ defaults.mjs      # 默认设置、启动项、收藏命令
├─ src/
│  ├─ components/
│  │  └─ TerminalPane.tsx
│  ├─ utils/
│  │  ├─ id.ts
│  │  └─ sounds.ts
│  ├─ App.tsx           # 主界面和工作台状态
│  ├─ global.d.ts       # preload API 类型
│  ├─ main.tsx
│  ├─ styles.css
│  ├─ types.ts
│  └─ vite-env.d.ts
├─ Require.md           # 原始需求
├─ PROJECT_PLAN.md      # 开发计划暂存
├─ index.html
├─ package.json
├─ tsconfig.json
└─ vite.config.ts
```

## 环境要求

- Windows 10/11
- Node.js 20 或更高版本
- npm 10 或更高版本
- 编译 `node-pty` 可能需要 Visual Studio Build Tools 或可用的 C++ 编译工具链
- 如果执行 `npm run rebuild` 出现 `MSB8040: Spectre-mitigated libraries are required`，请在 Visual Studio Installer 的“单个组件”中安装 `MSVC v143 - VS 2022 C++ x64/x86 Spectre 缓解库`

## 安装依赖

```powershell
npm install
```

如果安装后 `node-pty` 与 Electron ABI 不匹配，执行：

```powershell
npm run rebuild
```

Windows 上这一步依赖本机 C++ 工具链。若缺少 Spectre 缓解库，先通过 Visual Studio Installer 补齐组件，再重新执行 `npm run rebuild`。

## 本地开发运行

```powershell
npm run dev
```

运行后会自动启动 Vite 开发服务器，并打开 Electron 桌面窗口。

## 构建前端

```powershell
npm run build
```

构建产物输出到 `dist/`。

## 打包桌面程序

生成免安装版目录：

```powershell
npm run pack:dir
```

产物位于：

```text
release/win-unpacked/SUPER-CLI.exe
```

生成安装包和便携版：

```powershell
npm run dist
```

打包产物输出到 `release/`，默认包含：

- NSIS 安装包
- 便携版可执行文件

如果 `npm run dist` 在下载 `winCodeSign`、`nsis` 或 Electron 运行时资源时超时，可以先使用 `npm run pack:dir` 产出免安装版；等网络可访问 GitHub 后再重新执行 `npm run dist`。

## 配置说明

应用设置由 `electron-store` 保存到用户配置目录，首次启动会使用 [shared/defaults.mjs](D:/AAADevelop/clidemocodex/shared/defaults.mjs) 中的默认配置。

主要配置项：

- `theme`：`dark` 或 `light`
- `fontFamily`：终端字体
- `fontSize`：终端字号
- `shell`：默认 Shell，留空时 Windows 使用系统默认命令行
- `defaultCwd`：默认工作目录，留空时使用用户主目录
- `stayOnTop`：窗口置顶
- `minimizeToTray`：关闭窗口后最小化到托盘
- `sounds`：提示音开关、音量和自定义音频路径
- `launchers`：快捷启动项
- `favorites`：常用命令收藏

## 自定义快捷启动

在设置面板中填写：

- 名称：界面中显示的启动项名称
- 命令：可执行命令，例如 `codex`、`claude`、`powershell.exe`
- 参数：用空格分隔，例如 `--model gpt-5`
- 工作目录：可留空，留空时使用默认目录

保存后会出现在左侧“快捷启动”区域。

## 当前版本说明

这是项目的第一版可运行骨架，已经覆盖需求中的主要能力入口。后续可以继续增强：

- 更完整的快捷键录制器
- 收藏命令增删改 UI
- 分屏面板单独关闭
- 命令运行完成识别规则
- 更细致的 AI 响应完成检测
- Windows 原生伪控制台兼容性测试
