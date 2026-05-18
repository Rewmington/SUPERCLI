export const defaultSettings = {
  theme: "dark",
  fontFamily: "Cascadia Mono, Consolas, monospace",
  fontSize: 14,
  lineHeight: 1.15,
  shell: "",
  defaultCwd: "",
  stayOnTop: false,
  minimizeToTray: false,
  sounds: {
    enabled: true,
    volume: 0.45,
    aiDone: "",
    taskDone: "",
    error: "",
    newTerminal: ""
  },
  shortcuts: {
    newTab: "Ctrl+Shift+T",
    closeTab: "Ctrl+Shift+W",
    splitRight: "Ctrl+Shift+R",
    splitDown: "Ctrl+Shift+D",
    commandPalette: "Ctrl+Shift+P"
  },
  launchers: [
    {
      id: "codex",
      name: "Codex",
      command: "codex",
      args: [],
      cwd: "",
      description: "启动 Codex CLI",
      commands: [
        { id: "codex-help", name: "查看帮助", command: "codex --help" },
        { id: "codex-version", name: "查看版本", command: "codex --version" },
        { id: "codex-login", name: "登录账户", command: "codex login" },
        { id: "codex-chat", name: "开始对话", command: "codex" }
      ]
    },
    {
      id: "claude-code",
      name: "Claude Code",
      command: "claude",
      args: [],
      cwd: "",
      description: "启动 Claude Code CLI",
      commands: [
        { id: "claude-help", name: "查看帮助", command: "claude --help" },
        { id: "claude-version", name: "查看版本", command: "claude --version" },
        { id: "claude-login", name: "登录账户", command: "claude /login" },
        { id: "claude-resume", name: "继续上次会话", command: "claude --resume" },
        { id: "claude-continue", name: "继续最近会话", command: "claude -c" }
      ]
    },
    {
      id: "powershell",
      name: "PowerShell",
      command: "powershell.exe",
      args: [],
      cwd: "",
      description: "启动 Windows PowerShell",
      commands: [
        { id: "ps-ls", name: "列出当前目录", command: "Get-ChildItem" },
        { id: "ps-pwd", name: "查看当前路径", command: "Get-Location" },
        { id: "ps-env", name: "查看环境变量", command: "Get-ChildItem Env:" },
        { id: "ps-which", name: "查找命令路径", command: "Get-Command" },
        { id: "ps-clear", name: "清屏", command: "Clear-Host" }
      ]
    },
    {
      id: "npm",
      name: "npm",
      command: "npm",
      args: [],
      cwd: "",
      description: "Node.js 包管理工具",
      commands: [
        { id: "npm-install", name: "安装全部依赖", command: "npm install" },
        { id: "npm-ci", name: "净安装依赖", command: "npm ci" },
        { id: "npm-run-dev", name: "启动开发", command: "npm run dev" },
        { id: "npm-run-build", name: "构建项目", command: "npm run build" },
        { id: "npm-start", name: "运行 start", command: "npm start" },
        { id: "npm-test", name: "运行测试", command: "npm test" },
        { id: "npm-outdated", name: "检查过期依赖", command: "npm outdated" },
        { id: "npm-update", name: "更新依赖", command: "npm update" }
      ]
    },
    {
      id: "git",
      name: "Git",
      command: "git",
      args: [],
      cwd: "",
      description: "版本控制工具",
      commands: [
        { id: "git-status", name: "查看状态", command: "git status" },
        { id: "git-log", name: "查看历史", command: "git log --oneline -20" },
        { id: "git-branch", name: "查看分支", command: "git branch -a" },
        { id: "git-diff", name: "查看差异", command: "git diff" },
        { id: "git-pull", name: "拉取代码", command: "git pull" },
        { id: "git-push", name: "推送代码", command: "git push" },
        { id: "git-fetch", name: "抓取远端", command: "git fetch --all" },
        { id: "git-add-all", name: "暂存全部", command: "git add ." },
        { id: "git-stash", name: "暂存改动", command: "git stash" },
        { id: "git-stash-pop", name: "恢复暂存", command: "git stash pop" }
      ]
    },
    {
      id: "hermes",
      name: "Hermes Agent",
      command: "hermes",
      args: [],
      cwd: "",
      description: "启动 Hermes Agent",
      commands: [
        { id: "hermes-chat", name: "启动对话", command: "hermes chat" },
        { id: "hermes-help", name: "查看帮助", command: "/help" },
        { id: "hermes-exit", name: "退出对话", command: "/exit" },
        { id: "hermes-reset", name: "重置会话", command: "/reset" },
        { id: "hermes-clear", name: "清空屏幕", command: "/clear" },
        { id: "hermes-model", name: "切换模型", command: "/model " }
      ]
    }
  ],
  favorites: []
};
