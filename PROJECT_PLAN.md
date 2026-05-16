# 桌面增强终端项目暂存说明

最后更新时间：2026-05-16

## 已确认的技术选型

- 桌面框架：Electron
- 前端界面：React + TypeScript + Vite
- 终端嵌入：node-pty + xterm.js
- 分屏布局：react-resizable-panels
- 设置持久化：electron-store
- 打包方案：electron-builder

## 选型原因

- Windows 平台适配成熟，适合优先满足原始需求
- `node-pty` 在本地 AI 命令行工具接入上比较稳，便于启动 Codex、Claude Code 等 CLI
- `xterm.js` 终端显示成熟，可控性强，适合做多标签、分屏、字体调整和主题切换
- Electron 打包、托盘、置顶、后台静默运行、文件选择等桌面能力完整

## 计划实现的核心模块

### 1. 主进程

- 创建主窗口
- 中文菜单
- 系统托盘
- 窗口置顶
- 后台静默运行
- 文件选择对话框
- 设置读写
- 终端进程生命周期管理

### 2. 终端能力

- 多开独立终端标签页
- 新建 / 关闭 / 切换标签页
- 当前标签内横向 / 纵向分屏
- 终端输入输出同步
- 终端尺寸自适应
- 终端退出状态提示

### 3. 快捷启动

- 内置 Codex 启动预设
- 内置 Claude Code 启动预设
- 自定义本地 AI CLI 工具预设
- 可配置启动路径、参数、工作目录

### 4. 中文界面与增强功能

- 全面简体中文界面
- 深浅色主题切换
- 终端字体大小调整
- 常用命令收藏
- 快捷键自定义
- 音效开关、音量、自定义音频
- 运行状态中文提示

## 预期目录结构

```text
clidemocodex/
├─ electron/
│  ├─ main.mjs
│  └─ preload.mjs
├─ shared/
│  └─ defaults.mjs
├─ src/
│  ├─ components/
│  ├─ hooks/
│  ├─ utils/
│  ├─ App.tsx
│  ├─ main.tsx
│  ├─ styles.css
│  └─ vite-env.d.ts
├─ index.html
├─ package.json
├─ tsconfig.json
├─ vite.config.ts
└─ README.md
```

## 明天直接执行的步骤

1. 创建 `package.json` 和构建脚本
2. 写 `electron/main.mjs` 与 `preload.mjs`
3. 写 React 主界面与终端布局
4. 接入设置面板、快速启动、提示音、收藏命令
5. 补充 README、安装说明、打包说明
6. 执行依赖安装与本地构建验证

## 当前状态

- 需求已读取并整理
- 技术栈已确定
- 已创建 Electron + React + TypeScript 项目骨架
- 已实现主进程终端后端、中文菜单、托盘、设置存储
- 已实现多标签、分屏、快捷启动、设置面板、提示音入口、收藏命令 UI
- 已补充 README、安装说明、配置说明、打包说明
- `npm install` 已完成
- `npm run rebuild` 已通过，`node-pty` 已按 Electron 版本重建
- `npm run build` 已通过
- `npm run pack:dir` 已通过，免安装版已生成到 `release/win-unpacked/`
- 打包后的 `SUPER-CLI.exe` 已完成轻量启动验证
- `npm run dist` 仍依赖 GitHub 下载 `winCodeSign` / NSIS 等打包工具，网络可访问后可继续生成安装包和便携版
