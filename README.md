# SUPER-CLI

SUPER-CLI 是一款面向 Windows 的桌面增强终端工具，用于集中管理 Codex、Claude Code 以及其他本地 AI 命令行工具。项目采用 Electron + React + TypeScript + node-pty + xterm.js 构建，目标是把本地 AI CLI、项目终端和基础文件操作整合到一个统一的中文界面里。

## 功能概览

- 多标签终端：支持新建、关闭、切换独立终端标签页
- 分屏终端：支持右侧分屏和下方分屏，每个分屏可独立关闭
- 原生终端嵌入：通过 `node-pty` 运行 PowerShell、Codex、Claude Code、Hermes Agent、OpenClaw 等 CLI
- 快捷启动：内置 Codex、Claude Code、Hermes Agent、OpenClaw、PowerShell、npm、Git，并支持新增自定义启动项
- 启动器命令列表：每类工具带可展开的常用命令子列表，可直接发送到当前终端
- 终端交互增强：支持 Ctrl+C / Ctrl+V，以及终端右键菜单中的复制、粘贴、全选、清屏
- 目录启动：可在指定项目目录下直接打开终端或启动对应 CLI
- 文件列表面板：支持显示当前目录文件/文件夹、进入子目录、返回上级目录、刷新、开关显示
- 文件右键菜单：支持打开文件、在资源管理器中打开、复制文件路径、删除到回收站、属性
- 文件属性弹窗：展示名称、路径、类型、大小、创建时间、修改时间、访问时间
- 中文界面：保留应用内中文 UI，移除无效的顶部原生菜单白条
- 提示音系统：内置一套科技风提示音，可替换为自定义音频，并显示当前音频路径或内置来源
- 托盘后台运行：最小化到托盘时显示有效图标，可从托盘恢复窗口
- 实用设置：深浅色主题、终端字体字号、窗口置顶、后台静默运行

## 项目结构

```text
clidemocodex/
├─ electron/
│  ├─ main.mjs          # Electron 主进程、终端后端、托盘、设置存储、文件操作 IPC
│  ├─ preload.cjs       # 安全 IPC 桥
│  └─ preload.mjs       # 预留 ESM 版本
├─ shared/
│  └─ defaults.mjs      # 默认设置、启动项、命令列表
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
├─ LICENSE              # MIT 许可证
├─ Require.md           # 原始需求
├─ PROJECT_PLAN.md      # 开发计划暂存
├─ README.md
├─ index.html
├─ package.json
├─ package-lock.json
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

生成免安装目录版：

```powershell
npm run pack:dir
```

产物位于：

```text
release/win-unpacked/SUPER-CLI.exe
```

生成安装包：

```powershell
npm run dist
```

打包产物输出到 `release/`，默认包含：

- `SUPER-CLI-0.5.0-x64.exe`（Windows x64 安装包）
- `win-unpacked/SUPER-CLI.exe`（免安装目录版）

如果 `npm run dist` 在下载 `winCodeSign`、`nsis` 或 Electron 运行时资源时超时，可以先使用 `npm run pack:dir` 产出免安装目录版；等网络可访问 GitHub 后再重新执行 `npm run dist`。

## 配置说明

应用设置由 `electron-store` 保存到用户配置目录，首次启动会使用 `shared/defaults.mjs` 中的默认配置。

主要配置项：

- `theme`：`dark` 或 `light`
- `fontFamily`：终端字体
- `fontSize`：终端字号
- `shell`：默认 Shell，留空时 Windows 使用系统默认命令行
- `defaultCwd`：默认工作目录，留空时使用用户主目录
- `stayOnTop`：窗口置顶
- `minimizeToTray`：关闭窗口后最小化到托盘
- `sounds`：提示音开关、音量和自定义音频路径
- `launchers`：快捷启动项及其命令列表

## 自定义快捷启动

在设置面板中填写：

- 名称：界面中显示的启动项名称
- 命令：可执行命令，例如 `codex`、`claude`、`powershell.exe`
- 参数：用空格分隔，例如 `--model gpt-5`
- 工作目录：可留空，留空时使用默认目录

保存后会出现在左侧“快捷启动”区域。

## 当前版本说明

当前版本为 **v0.5.0**，相比前一版已完成以下增强：

- 移除顶部无效原生菜单白条
- 修复后台静默运行时托盘没有图标的问题
- 内置提示音升级为科技风提示音组
- 提示音设置中显示当前音频路径 / 内置来源
- 终端新增右键菜单（复制、粘贴、全选、清屏）
- 新增终端 Ctrl+C / Ctrl+V 复制粘贴支持
- 新增文件列表 / 文件资源管理器面板
- 支持目录导航、刷新、开关显示
- 文件右键菜单：打开文件、在资源管理器中打开、复制路径、删除到回收站、属性
- 文件属性改为真正的弹窗展示
- 修复分屏终端无法关闭的问题
- 修复关闭软件时 `Object has been destroyed` 主进程错误
- 启动器扩展为 Codex、Claude Code、Hermes Agent、OpenClaw、PowerShell、npm、Git 七类工具
- 新增 OpenClaw 快捷启动与常用指令子列表
- 每类启动器带可展开的常用命令子列表
- 安装包体积优化，并仅保留中文运行时语言包

后续仍可继续增强：

- 文件右键菜单补充复制 / 粘贴 / 重命名等操作
- 分屏拖拽布局记忆
- 更完整的快捷键录制器
- 命令运行完成识别规则
- 更细致的 AI 响应完成检测
- Windows 原生伪控制台兼容性测试
