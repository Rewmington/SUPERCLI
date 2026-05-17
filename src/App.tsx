import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Columns2,
  File,
  Folder,
  FolderOpen,
  Moon,
  PanelBottom,
  Pin,
  Play,
  Plus,
  Settings,
  Sun,
  TerminalSquare,
  Volume2,
  X
} from "lucide-react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { TerminalPane } from "./components/TerminalPane";
import type { AppSettings, DirEntry, LauncherCommand, LauncherPreset, TerminalPaneState, TerminalTabState } from "./types";
import { createId } from "./utils/id";
import { playSound } from "./utils/sounds";

type SoundFileKey = "aiDone" | "taskDone" | "error" | "newTerminal";

const fallbackSettings: AppSettings = {
  theme: "dark",
  fontFamily: "Cascadia Mono, Consolas, monospace",
  fontSize: 14,
  lineHeight: 1.15,
  shell: "",
  defaultCwd: "",
  stayOnTop: false,
  minimizeToTray: false,
  sounds: { enabled: true, volume: 0.45, aiDone: "", taskDone: "", error: "", newTerminal: "" },
  shortcuts: {
    newTab: "Ctrl+Shift+T",
    closeTab: "Ctrl+Shift+W",
    splitRight: "Ctrl+Shift+R",
    splitDown: "Ctrl+Shift+D",
    commandPalette: "Ctrl+Shift+P"
  },
  launchers: [],
  favorites: []
};

function shortcutMatches(event: KeyboardEvent, shortcut: string) {
  const parts = shortcut.toLowerCase().split("+");
  const key = parts.at(-1);
  return (
    event.key.toLowerCase() === key &&
    event.ctrlKey === parts.includes("ctrl") &&
    event.shiftKey === parts.includes("shift") &&
    event.altKey === parts.includes("alt")
  );
}

function shortPath(fullPath: string) {
  if (!fullPath) return "";
  const normalized = fullPath.replace(/\\/g, "/");
  const segments = normalized.split("/").filter(Boolean);
  return segments.at(-1) || normalized;
}

const builtInLauncherCommands: Record<string, LauncherCommand[]> = {
  codex: [
    { id: "codex-help", name: "查看帮助", command: "codex --help" },
    { id: "codex-version", name: "查看版本", command: "codex --version" },
    { id: "codex-login", name: "登录账户", command: "codex login" },
    { id: "codex-chat", name: "开始对话", command: "codex" }
  ],
  "claude-code": [
    { id: "claude-help", name: "查看帮助", command: "claude --help" },
    { id: "claude-version", name: "查看版本", command: "claude --version" },
    { id: "claude-login", name: "登录账户", command: "claude /login" },
    { id: "claude-resume", name: "继续上次会话", command: "claude --resume" },
    { id: "claude-continue", name: "继续最近会话", command: "claude -c" }
  ],
  powershell: [
    { id: "ps-ls", name: "列出当前目录", command: "Get-ChildItem" },
    { id: "ps-pwd", name: "查看当前路径", command: "Get-Location" },
    { id: "ps-env", name: "查看环境变量", command: "Get-ChildItem Env:" },
    { id: "ps-which", name: "查找命令路径", command: "Get-Command" },
    { id: "ps-clear", name: "清屏", command: "Clear-Host" }
  ],
  npm: [
    { id: "npm-install", name: "安装全部依赖", command: "npm install" },
    { id: "npm-ci", name: "净安装依赖", command: "npm ci" },
    { id: "npm-run-dev", name: "启动开发", command: "npm run dev" },
    { id: "npm-run-build", name: "构建项目", command: "npm run build" },
    { id: "npm-start", name: "运行 start", command: "npm start" },
    { id: "npm-test", name: "运行测试", command: "npm test" },
    { id: "npm-outdated", name: "检查过期依赖", command: "npm outdated" },
    { id: "npm-update", name: "更新依赖", command: "npm update" }
  ],
  git: [
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
};

const builtInLauncherDefs: LauncherPreset[] = [
  { id: "npm", name: "npm", command: "npm", args: [], cwd: "", description: "Node.js 包管理工具", commands: builtInLauncherCommands.npm },
  { id: "git", name: "Git", command: "git", args: [], cwd: "", description: "版本控制工具", commands: builtInLauncherCommands.git }
];

function mergeLauncherCommands(loaded: AppSettings): AppSettings {
  let changed = false;
  const existing = loaded.launchers ?? [];
  const existingIds = new Set(existing.map((l) => l.id));

  const enriched = existing.map((launcher) => {
    const builtin = builtInLauncherCommands[launcher.id];
    if (builtin && (!launcher.commands || launcher.commands.length === 0)) {
      changed = true;
      return { ...launcher, commands: builtin };
    }
    return launcher;
  });

  // 把缺失的 npm / git 自动补回去
  for (const def of builtInLauncherDefs) {
    if (!existingIds.has(def.id)) {
      enriched.push(def);
      changed = true;
    }
  }

  return changed ? { ...loaded, launchers: enriched } : loaded;
}

function makeTab(title: string, pane: TerminalPaneState): TerminalTabState {
  return {
    id: createId("tab"),
    title,
    panes: [pane],
    activePaneId: pane.id,
    splitDirection: "horizontal"
  };
}

interface PendingLaunch {
  tabId: string;
  paneId: string;
  title: string;
  command?: string;
  args?: string[];
  cwd?: string;
}

export function App() {
  const [settings, setSettingsState] = useState<AppSettings>(fallbackSettings);
  const [tabs, setTabs] = useState<TerminalTabState[]>([]);
  const [activeTabId, setActiveTabId] = useState("");
  const [status, setStatus] = useState("正在初始化工作台");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [expandedLaunchers, setExpandedLaunchers] = useState<Record<string, boolean>>({});
  const [filesPanelOpen, setFilesPanelOpen] = useState(false);
  const [filesPanelPath, setFilesPanelPath] = useState("");
  const [filesPanelItems, setFilesPanelItems] = useState<DirEntry[]>([]);
  const [filesPanelParent, setFilesPanelParent] = useState("");
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; entry: DirEntry } | null>(null);
  const [propertiesDialog, setPropertiesDialog] = useState<Record<string, unknown> | null>(null);
  const pendingLaunchesRef = useRef(new Map<string, PendingLaunch>());
  const startedPanesRef = useRef(new Set<string>());
  const [launcherDraft, setLauncherDraft] = useState<LauncherPreset>({
    id: "",
    name: "",
    command: "",
    args: [],
    cwd: "",
    description: ""
  });

  const activeTab = useMemo(() => tabs.find((tab) => tab.id === activeTabId), [tabs, activeTabId]);
  const activePaneId = activeTab?.activePaneId || "";

  async function persistSettings(next: AppSettings) {
    setSettingsState(next);
    await window.desktop.setSettings(next);
  }

  async function createTerminalTab(preset?: LauncherPreset, overrideCwd?: string) {
    const paneId = createId("term");
    const cwd = overrideCwd || preset?.cwd;
    const title = preset?.name
      ? overrideCwd
        ? `${preset.name} · ${shortPath(overrideCwd)}`
        : preset.name
      : overrideCwd
        ? shortPath(overrideCwd)
        : "本地终端";
    const pane: TerminalPaneState = {
      id: paneId,
      title,
      command: preset?.command,
      cwd,
      status: "启动中"
    };

    const tab = makeTab(title, pane);
    setTabs((current) => [...current, tab]);
    setActiveTabId(tab.id);
    pendingLaunchesRef.current.set(paneId, {
      tabId: tab.id,
      paneId,
      title,
      command: preset?.command,
      args: preset?.args,
      cwd
    });
    setStatus(`正在启动：${title}`);
  }

  async function openTerminalInFolder(preset?: LauncherPreset) {
    const folder = await window.desktop.selectFolder();
    if (!folder) {
      setStatus("已取消选择目录");
      return;
    }
    await createTerminalTab(preset, folder);
  }

  async function splitTerminal(direction: "horizontal" | "vertical") {
    if (!activeTab) return;
    const paneId = createId("term");
    const pane: TerminalPaneState = {
      id: paneId,
      title: direction === "horizontal" ? "右侧分屏" : "下方分屏",
      status: "启动中"
    };

    setTabs((current) =>
      current.map((tab) =>
        tab.id === activeTab.id
          ? { ...tab, splitDirection: direction, panes: [...tab.panes, pane], activePaneId: paneId }
          : tab
      )
    );
    pendingLaunchesRef.current.set(paneId, {
      tabId: activeTab.id,
      paneId,
      title: pane.title
    });
    setStatus(direction === "horizontal" ? "正在创建右侧分屏" : "正在创建下方分屏");
  }

  async function startPendingTerminal(paneId: string, cols: number, rows: number) {
    if (startedPanesRef.current.has(paneId)) return;

    const pending = pendingLaunchesRef.current.get(paneId);
    if (!pending) return;

    startedPanesRef.current.add(paneId);

    try {
      await window.desktop.terminal.create({
        id: pending.paneId,
        command: pending.command,
        args: pending.args,
        cwd: pending.cwd,
        cols,
        rows
      });

      pendingLaunchesRef.current.delete(paneId);
      setTabs((current) =>
        current.map((item) =>
          item.id === pending.tabId
            ? {
                ...item,
                panes: item.panes.map((itemPane) => (itemPane.id === paneId ? { ...itemPane, status: "运行中" } : itemPane))
              }
            : item
        )
      );
      playSound("newTerminal", settings.sounds);
      setStatus(`已启动：${pending.title}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "未知错误";
      pendingLaunchesRef.current.delete(paneId);
      startedPanesRef.current.delete(paneId);
      setTabs((current) =>
        current.map((item) =>
          item.id === pending.tabId
            ? {
                ...item,
                panes: item.panes.map((itemPane) => (itemPane.id === paneId ? { ...itemPane, status: "已退出" } : itemPane))
              }
            : item
        )
      );
      playSound("error", settings.sounds);
      setStatus(`终端启动失败：${message}`);
    }
  }

  function closeTab(tabId = activeTabId) {
    const tab = tabs.find((item) => item.id === tabId);
    if (!tab) return;
    tab.panes.forEach((pane) => {
      pendingLaunchesRef.current.delete(pane.id);
      startedPanesRef.current.delete(pane.id);
      void window.desktop.terminal.close(pane.id);
    });
    setTabs((current) => {
      const next = current.filter((item) => item.id !== tabId);
      if (tabId === activeTabId) setActiveTabId(next.at(-1)?.id || "");
      return next;
    });
    setStatus(`已关闭标签：${tab.title}`);
  }

  function closePane(paneId: string) {
    if (!activeTab) return;
    // 如果标签只有一个面板，关闭整个标签
    if (activeTab.panes.length <= 1) {
      closeTab(activeTab.id);
      return;
    }
    pendingLaunchesRef.current.delete(paneId);
    startedPanesRef.current.delete(paneId);
    void window.desktop.terminal.close(paneId);
    setTabs((current) =>
      current.map((tab) => {
        if (tab.id !== activeTab.id) return tab;
        const nextPanes = tab.panes.filter((p) => p.id !== paneId);
        const nextActive = tab.activePaneId === paneId
          ? (nextPanes.at(-1)?.id || "")
          : tab.activePaneId;
        return { ...tab, panes: nextPanes, activePaneId: nextActive };
      })
    );
    setStatus("已关闭分屏终端");
  }

  function sendCommand(command: string) {
    if (!activePaneId) {
      setStatus("请先打开一个终端再发送命令");
      return;
    }
    void window.desktop.terminal.write({ id: activePaneId, data: `${command}\r` });
    setStatus(`已发送命令：${command}`);
  }

  function toggleLauncher(launcherId: string) {
    setExpandedLaunchers((current) => ({ ...current, [launcherId]: !current[launcherId] }));
  }

  async function openFilesPanel() {
    const folder = await window.desktop.selectFolder();
    if (!folder) return;
    await navigateFilesPanel(folder);
    setFilesPanelOpen(true);
  }

  async function navigateFilesPanel(dirPath: string) {
    const result = await window.desktop.readDir(dirPath);
    if (result.ok) {
      setFilesPanelPath(result.current);
      setFilesPanelItems(result.items);
      setFilesPanelParent(result.parent);
      setStatus(`已打开目录：${result.current}`);
    } else {
      setStatus(`读取目录失败：${result.error || "未知错误"}`);
    }
  }

  function toggleFilesPanel() {
    if (filesPanelOpen) {
      setFilesPanelOpen(false);
    } else if (filesPanelPath) {
      setFilesPanelOpen(true);
    } else {
      void openFilesPanel();
    }
  }

  function handleFileContextMenu(event: React.MouseEvent, entry: DirEntry) {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ x: event.clientX, y: event.clientY, entry });
  }

  function closeContextMenu() {
    setContextMenu(null);
  }

  async function ctxOpenFile() {
    if (!contextMenu) return;
    await window.desktop.openFile(contextMenu.entry.path);
    closeContextMenu();
  }

  function ctxShowInExplorer() {
    if (!contextMenu) return;
    void window.desktop.showInExplorer(contextMenu.entry.path);
    closeContextMenu();
  }

  function ctxCopyPath() {
    if (!contextMenu) return;
    void window.desktop.copyPath(contextMenu.entry.path);
    setStatus(`已复制路径：${contextMenu.entry.path}`);
    closeContextMenu();
  }

  async function ctxTrashFile() {
    if (!contextMenu) return;
    const result = await window.desktop.trashFile(contextMenu.entry.path);
    if (result.ok) {
      setStatus(`已删除到回收站：${contextMenu.entry.name}`);
      void navigateFilesPanel(filesPanelPath);
    } else {
      setStatus(`删除失败：${result.error}`);
    }
    closeContextMenu();
  }

  async function ctxProperties() {
    if (!contextMenu) return;
    const props = await window.desktop.getProperties(contextMenu.entry.path);
    if (props.ok) {
      setPropertiesDialog(props);
    } else {
      setStatus(`读取属性失败：${String(props.error || "未知错误")}`);
    }
    closeContextMenu();
  }

  async function addLauncher() {
    if (!launcherDraft.name.trim() || !launcherDraft.command.trim()) return;
    const next: AppSettings = {
      ...settings,
      launchers: [
        ...settings.launchers,
        {
          ...launcherDraft,
          id: createId("launcher"),
          args: launcherDraft.args.filter(Boolean),
          description: launcherDraft.description || "自定义 AI 命令行工具"
        }
      ]
    };
    await persistSettings(next);
    setLauncherDraft({ id: "", name: "", command: "", args: [], cwd: "", description: "" });
    setStatus("已添加快捷启动项");
  }

  async function chooseSound(kind: SoundFileKey) {
    const file = await window.desktop.selectAudio();
    if (!file) return;
    await persistSettings({ ...settings, sounds: { ...settings.sounds, [kind]: file } });
    setStatus("已更新提示音文件");
  }

  useEffect(() => {
    void window.desktop.getSettings().then((loaded) => {
      const merged = mergeLauncherCommands(loaded);
      setSettingsState(merged);
      if (merged !== loaded) {
        void window.desktop.setSettings(merged);
      }
      setStatus("工作台已就绪");

      const paneId = createId("term");
      const pane: TerminalPaneState = {
        id: paneId,
        title: "本地终端",
        status: "启动中"
      };
      const tab = makeTab("本地终端", pane);

      pendingLaunchesRef.current.set(paneId, {
        tabId: tab.id,
        paneId,
        title: "本地终端"
      });
      setTabs([tab]);
      setActiveTabId(tab.id);
      setStatus("正在启动：本地终端");
    });
  }, []);

  useEffect(() => {
    const unsubscribers = [
      window.desktop.terminal.onExit(({ id, exitCode }) => {
        startedPanesRef.current.delete(id);
        setTabs((current) =>
          current.map((tab) => ({
            ...tab,
            panes: tab.panes.map((pane) => (pane.id === id ? { ...pane, status: "已退出" } : pane))
          }))
        );
        if (exitCode === 0) {
          playSound("taskDone", settings.sounds);
          setStatus("终端任务已完成");
        } else {
          playSound("error", settings.sounds);
          setStatus(`终端异常退出，代码：${exitCode}`);
        }
      }),
      window.desktop.terminal.onError(({ id, message }) => {
        startedPanesRef.current.delete(id);
        pendingLaunchesRef.current.delete(id);
        setTabs((current) =>
          current.map((tab) => ({
            ...tab,
            panes: tab.panes.map((pane) => (pane.id === id ? { ...pane, status: "已退出" } : pane))
          }))
        );
        playSound("error", settings.sounds);
        setStatus(`终端启动失败：${message}`);
      }),
      window.desktop.events.onStatus((message) => setStatus(message)),
      window.desktop.events.onSettingsChanged((next) => setSettingsState(next)),
      window.desktop.events.onNewTerminal(() => void createTerminalTab()),
      window.desktop.events.onCloseTab(() => closeTab()),
      window.desktop.events.onSplitRight(() => void splitTerminal("horizontal")),
      window.desktop.events.onSplitDown(() => void splitTerminal("vertical"))
    ];

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [activeTabId, tabs, settings]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (shortcutMatches(event, settings.shortcuts.newTab)) {
        event.preventDefault();
        void createTerminalTab();
      }
      if (shortcutMatches(event, settings.shortcuts.closeTab)) {
        event.preventDefault();
        closeTab();
      }
      if (shortcutMatches(event, settings.shortcuts.splitRight)) {
        event.preventDefault();
        void splitTerminal("horizontal");
      }
      if (shortcutMatches(event, settings.shortcuts.splitDown)) {
        event.preventDefault();
        void splitTerminal("vertical");
      }
      if (shortcutMatches(event, settings.shortcuts.commandPalette)) {
        event.preventDefault();
        setSettingsOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeTabId, tabs, settings]);

  return (
    <main className={`app theme-${settings.theme}`}>
      <aside className="sidebar">
        <div className="brand">
          <TerminalSquare size={28} />
          <div>
            <strong>SUPER-CLI</strong>
            <span>统一管理本地 AI CLI</span>
          </div>
        </div>

        <section className="side-section">
          <div className="section-title">
            <Bot size={16} />
            <span>快捷启动</span>
          </div>
          <div className="launcher-list">
            {settings.launchers.map((launcher) => {
              const expanded = Boolean(expandedLaunchers[launcher.id]);
              const commandCount = launcher.commands?.length ?? 0;
              return (
                <div className="launcher-card" key={launcher.id}>
                  <div className="launcher-row">
                    <button
                      className="launcher-button"
                      onClick={() => void createTerminalTab(launcher)}
                      title={`启动 ${launcher.name}`}
                    >
                      <span>{launcher.name}</span>
                      <small>{launcher.description}</small>
                    </button>
                    <button
                      className="launcher-folder"
                      title="选择目录后启动"
                      onClick={() => void openTerminalInFolder(launcher)}
                    >
                      <FolderOpen size={14} />
                    </button>
                    {commandCount > 0 && (
                      <button
                        className="launcher-folder"
                        title={expanded ? "收起常用命令" : `展开 ${commandCount} 条常用命令`}
                        onClick={() => toggleLauncher(launcher.id)}
                      >
                        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                    )}
                  </div>
                  {expanded && commandCount > 0 && (
                    <div className="launcher-commands">
                      {launcher.commands!.map((cmd: LauncherCommand) => (
                        <button
                          key={cmd.id}
                          className="launcher-command"
                          onClick={() => sendCommand(cmd.command)}
                          title={`发送：${cmd.command}`}
                        >
                          <Play size={11} />
                          <span>{cmd.name}</span>
                          <code>{cmd.command}</code>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </aside>

      <section className="workspace">
        <header className="toolbar">
          <div className="tabs">
            {tabs.map((tab) => (
              <button className={`tab ${tab.id === activeTabId ? "is-active" : ""}`} key={tab.id} onClick={() => setActiveTabId(tab.id)}>
                <span>{tab.title}</span>
                <X size={14} onClick={(event) => { event.stopPropagation(); closeTab(tab.id); }} />
              </button>
            ))}
          </div>
          <div className="toolbar-actions">
            <button title="新建终端" onClick={() => void createTerminalTab()}><Plus size={18} /></button>
            <button title="在指定目录打开终端" onClick={() => void openTerminalInFolder()}><FolderOpen size={18} /></button>
            <button title={filesPanelOpen ? "关闭文件列表" : "打开文件列表"} className={filesPanelOpen ? "is-active" : ""} onClick={toggleFilesPanel}><Folder size={18} /></button>
            <button title="右侧分屏" onClick={() => void splitTerminal("horizontal")}><Columns2 size={18} /></button>
            <button title="下方分屏" onClick={() => void splitTerminal("vertical")}><PanelBottom size={18} /></button>
            <button title="设置" onClick={() => setSettingsOpen(true)}><Settings size={18} /></button>
          </div>
        </header>

        <section className="terminal-area">
          {activeTab ? (
            <PanelGroup direction={activeTab.splitDirection}>
              {activeTab.panes.map((pane, index) => (
                <Fragment key={pane.id}>
                  {index > 0 && <PanelResizeHandle className="resize-handle" />}
                  <Panel minSize={20}>
                  <TerminalPane
                    pane={pane}
                    settings={settings}
                    active={pane.id === activeTab.activePaneId}
                    showClose={activeTab.panes.length > 1}
                    onReady={(paneId, cols, rows) => {
                      void startPendingTerminal(paneId, cols, rows);
                    }}
                    onFocus={(paneId) =>
                      setTabs((current) => current.map((tab) => (tab.id === activeTab.id ? { ...tab, activePaneId: paneId } : tab)))
                    }
                    onClose={(paneId) => closePane(paneId)}
                  />
                  </Panel>
                </Fragment>
              ))}
            </PanelGroup>
          ) : (
            <div className="empty-state">
              <TerminalSquare size={48} />
              <span>暂无终端</span>
              <button onClick={() => void createTerminalTab()}>新建终端</button>
            </div>
          )}
        </section>

        <footer className="statusbar">
          <span>{status}</span>
          <span>{activePaneId ? `当前终端：${activePaneId}` : "未选择终端"}</span>
        </footer>
      </section>

      {filesPanelOpen && (
        <aside className="files-panel">
          <header className="files-panel-header">
            <div className="files-panel-title">
              <Folder size={16} />
              <strong>文件列表</strong>
            </div>
            <div className="files-panel-actions">
              <button title="打开其他目录" onClick={() => void openFilesPanel()}><FolderOpen size={14} /></button>
              <button title="刷新" onClick={() => void navigateFilesPanel(filesPanelPath)}>↻</button>
              <button title="关闭文件列表" onClick={() => setFilesPanelOpen(false)}><X size={14} /></button>
            </div>
          </header>
          <div className="files-panel-path" title={filesPanelPath}>
            {filesPanelPath}
          </div>
          <div className="files-panel-list">
            {filesPanelPath !== filesPanelParent && (
              <button
                className="files-panel-item is-dir"
                onClick={() => void navigateFilesPanel(filesPanelParent)}
                title="返回上级目录"
              >
                <Folder size={14} />
                <span>..</span>
              </button>
            )}
            {filesPanelItems.map((entry) => (
              <button
                key={entry.path}
                className={`files-panel-item ${entry.isDirectory ? "is-dir" : ""}`}
                onClick={() => {
                  if (entry.isDirectory) {
                    void navigateFilesPanel(entry.path);
                  } else {
                    void window.desktop.openFile(entry.path);
                  }
                }}
                onContextMenu={(e) => handleFileContextMenu(e, entry)}
                title={entry.path}
              >
                {entry.isDirectory ? <Folder size={14} /> : <File size={14} />}
                <span>{entry.name}</span>
              </button>
            ))}
            {filesPanelItems.length === 0 && (
              <div className="files-panel-empty">此目录为空</div>
            )}
          </div>
        </aside>
      )}

      {contextMenu && (
        <div className="ctx-overlay" onClick={closeContextMenu} onContextMenu={(e) => { e.preventDefault(); closeContextMenu(); }}>
          <div className="ctx-menu" style={{ top: contextMenu.y, left: contextMenu.x }}>
            <button onClick={() => void ctxOpenFile()}>打开文件</button>
            <button onClick={ctxShowInExplorer}>在资源管理器中打开</button>
            <div className="ctx-divider" />
            <button onClick={ctxCopyPath}>复制文件路径</button>
            <div className="ctx-divider" />
            <button className="ctx-danger" onClick={() => void ctxTrashFile()}>删除（到回收站）</button>
            <div className="ctx-divider" />
            <button onClick={() => void ctxProperties()}>属性</button>
          </div>
        </div>
      )}

      {propertiesDialog && (
        <div className="dialog-overlay" onClick={() => setPropertiesDialog(null)}>
          <div className="properties-dialog" onClick={(e) => e.stopPropagation()}>
            <header className="properties-header">
              <strong>文件属性</strong>
              <button onClick={() => setPropertiesDialog(null)}><X size={16} /></button>
            </header>
            <div className="properties-body">
              <div><span>名称</span><code>{String(propertiesDialog.name || "")}</code></div>
              <div><span>路径</span><code>{String(propertiesDialog.path || "")}</code></div>
              <div><span>类型</span><code>{propertiesDialog.isDirectory ? "文件夹" : "文件"}</code></div>
              <div><span>大小</span><code>{Math.round(Number(propertiesDialog.size || 0) / 1024)} KB</code></div>
              <div><span>创建时间</span><code>{String(propertiesDialog.created || "").replace("T", " ").slice(0, 19)}</code></div>
              <div><span>修改时间</span><code>{String(propertiesDialog.modified || "").replace("T", " ").slice(0, 19)}</code></div>
              <div><span>访问时间</span><code>{String(propertiesDialog.accessed || "").replace("T", " ").slice(0, 19)}</code></div>
            </div>
            <footer className="properties-footer">
              <button className="primary" onClick={() => setPropertiesDialog(null)}>确定</button>
            </footer>
          </div>
        </div>
      )}

      {settingsOpen && (
        <aside className="settings-drawer">
          <header>
            <div>
              <strong>设置</strong>
              <span>界面、终端、音效与启动项</span>
            </div>
            <button onClick={() => setSettingsOpen(false)}><X size={18} /></button>
          </header>

          <section className="setting-block">
            <h2>外观</h2>
            <div className="segmented">
              <button className={settings.theme === "dark" ? "is-active" : ""} onClick={() => void persistSettings({ ...settings, theme: "dark" })}><Moon size={16} />深色</button>
              <button className={settings.theme === "light" ? "is-active" : ""} onClick={() => void persistSettings({ ...settings, theme: "light" })}><Sun size={16} />浅色</button>
            </div>
            <label>
              终端字体
              <input value={settings.fontFamily} onChange={(event) => void persistSettings({ ...settings, fontFamily: event.target.value })} />
            </label>
            <label>
              字号：{settings.fontSize}
              <input type="range" min="11" max="24" value={settings.fontSize} onChange={(event) => void persistSettings({ ...settings, fontSize: Number(event.target.value) })} />
            </label>
          </section>

          <section className="setting-block">
            <h2>窗口</h2>
            <label className="switch-row">
              <span><Pin size={16} />窗口置顶</span>
              <input type="checkbox" checked={settings.stayOnTop} onChange={(event) => void persistSettings({ ...settings, stayOnTop: event.target.checked })} />
            </label>
            <label className="switch-row">
              <span>关闭后后台静默运行</span>
              <input type="checkbox" checked={settings.minimizeToTray} onChange={(event) => void persistSettings({ ...settings, minimizeToTray: event.target.checked })} />
            </label>
          </section>

          <section className="setting-block">
            <h2>提示音</h2>
            <label className="switch-row">
              <span><Volume2 size={16} />启用音效</span>
              <input type="checkbox" checked={settings.sounds.enabled} onChange={(event) => void persistSettings({ ...settings, sounds: { ...settings.sounds, enabled: event.target.checked } })} />
            </label>
            <label>
              音量：{Math.round(settings.sounds.volume * 100)}%
              <input type="range" min="0" max="1" step="0.05" value={settings.sounds.volume} onChange={(event) => void persistSettings({ ...settings, sounds: { ...settings.sounds, volume: Number(event.target.value) } })} />
            </label>
            <div className="sound-grid">
              <button onClick={() => void chooseSound("aiDone")}><Bell size={16} />AI 响应完成</button>
              <button onClick={() => void chooseSound("taskDone")}><CheckCircle2 size={16} />任务完成</button>
              <button onClick={() => void chooseSound("error")}><Bell size={16} />报错提醒</button>
              <button onClick={() => void chooseSound("newTerminal")}><Plus size={16} />新建终端</button>
            </div>
            <div className="sound-paths">
              <div><span>AI 响应完成</span><code>{settings.sounds.aiDone || "内置：科技提示音"}</code></div>
              <div><span>任务完成</span><code>{settings.sounds.taskDone || "内置：科技提示音"}</code></div>
              <div><span>报错提醒</span><code>{settings.sounds.error || "内置：科技提示音"}</code></div>
              <div><span>新建终端</span><code>{settings.sounds.newTerminal || "内置：科技提示音"}</code></div>
            </div>
          </section>

          <section className="setting-block">
            <h2>新增启动项</h2>
            <label>
              名称
              <input value={launcherDraft.name} onChange={(event) => setLauncherDraft({ ...launcherDraft, name: event.target.value })} placeholder="例如 Gemini CLI" />
            </label>
            <label>
              命令
              <input value={launcherDraft.command} onChange={(event) => setLauncherDraft({ ...launcherDraft, command: event.target.value })} placeholder="例如 gemini" />
            </label>
            <label>
              参数
              <input value={launcherDraft.args.join(" ")} onChange={(event) => setLauncherDraft({ ...launcherDraft, args: event.target.value.split(" ") })} placeholder="可留空" />
            </label>
            <label>
              工作目录
              <input value={launcherDraft.cwd} onChange={(event) => setLauncherDraft({ ...launcherDraft, cwd: event.target.value })} placeholder="可留空" />
            </label>
            <button className="primary" onClick={() => void addLauncher()}>添加启动项</button>
          </section>
        </aside>
      )}
    </main>
  );
}
