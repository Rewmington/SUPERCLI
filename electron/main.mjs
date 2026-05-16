import { app, BrowserWindow, Menu, Tray, ipcMain, dialog, nativeImage, shell, clipboard } from "electron";
import Store from "electron-store";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defaultSettings } from "../shared/defaults.mjs";
import * as pty from "node-pty";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const store = new Store({ defaults: { settings: defaultSettings } });
const terminals = new Map();

let mainWindow = null;
let tray = null;
let isQuitting = false;

function writeLog(message) {
  try {
    const logPath = path.join(app.getPath("userData"), "terminal.log");
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${message}\n`, "utf8");
  } catch {
    // Logging must never break terminal startup.
  }
}

function getDevServerUrl() {
  const arg = process.argv.find((item) => item.startsWith("--dev-server="));
  return arg ? arg.replace("--dev-server=", "") : "";
}

function getSettings() {
  return store.get("settings", defaultSettings);
}

function resolveShell(explicitShell = "") {
	if (explicitShell) return explicitShell;
	if (process.platform === "win32") {
		return "powershell.exe";
	}
	return process.env.SHELL || "bash";
}

function isKnownShell(command) {
	if (!command) return false;
	const name = path.basename(command).toLowerCase();
	return ["powershell.exe", "pwsh.exe", "cmd.exe", "bash", "zsh", "fish", "sh", "wsl.exe"].includes(name);
}

function resolveShellArgs(shell, explicitArgs = []) {
	if (explicitArgs.length > 0) return explicitArgs;
	const shellName = path.basename(shell).toLowerCase();
	if (shellName === "powershell.exe" || shellName === "pwsh.exe") {
		return ["-NoLogo"];
	}
	return [];
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 820,
    minWidth: 1040,
    minHeight: 640,
    title: "SUPER-CLI",
    backgroundColor: "#101419",
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.setAlwaysOnTop(Boolean(getSettings().stayOnTop));

  const devServerUrl = getDevServerUrl();
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.on("close", (event) => {
    if (getSettings().minimizeToTray && !isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      safeSend("app:status", "已最小化到系统托盘");
    } else {
      isQuitting = true;
    }
  });
}

function buildMenu() {
  const template = [
    {
      label: "文件",
      submenu: [
        { label: "新建终端", accelerator: "CmdOrCtrl+Shift+T", click: () => safeSend("menu:new-terminal") },
        { label: "关闭当前标签", accelerator: "CmdOrCtrl+Shift+W", click: () => safeSend("menu:close-tab") },
        { type: "separator" },
        { label: "退出", click: () => { isQuitting = true; app.quit(); } }
      ]
    },
    {
      label: "视图",
      submenu: [
        { label: "横向分屏", accelerator: "CmdOrCtrl+Shift+D", click: () => safeSend("menu:split-down") },
        { label: "纵向分屏", accelerator: "CmdOrCtrl+Shift+R", click: () => safeSend("menu:split-right") },
        { type: "separator" },
        { label: "重新载入", role: "reload" },
        { label: "全屏切换", role: "togglefullscreen" }
      ]
    },
    {
      label: "窗口",
      submenu: [
        {
          label: "窗口置顶",
          type: "checkbox",
          checked: Boolean(getSettings().stayOnTop),
          click: (item) => {
            const settings = { ...getSettings(), stayOnTop: item.checked };
            store.set("settings", settings);
            mainWindow?.setAlwaysOnTop(item.checked);
            safeSend("settings:changed", settings);
          }
        },
        { label: "显示窗口", click: () => showMainWindow() },
        { label: "隐藏窗口", click: () => mainWindow?.hide() }
      ]
    },
    {
      label: "帮助",
      submenu: [
        { label: "关于", click: () => dialog.showMessageBox(mainWindow, { type: "info", title: "关于", message: "SUPER-CLI", detail: "面向本地 AI CLI 工作流的桌面增强终端。" }) }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createTray() {
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setToolTip("SUPER-CLI");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "显示窗口", click: () => showMainWindow() },
    { label: "新建终端", click: () => safeSend("menu:new-terminal") },
    { type: "separator" },
    { label: "退出", click: () => { isQuitting = true; app.quit(); } }
  ]));
  tray.on("double-click", () => showMainWindow());
}

function safeSend(channel, payload) {
  try {
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
      mainWindow.webContents.send(channel, payload);
    }
  } catch {
    // Window already destroyed, ignore.
  }
}

function showMainWindow() {
  if (!mainWindow) return;
  mainWindow.show();
  mainWindow.focus();
}

function createTerminal(_, options = {}) {
  const id = options.id || randomUUID();
  const settings = getSettings();
  const cwd = options.cwd || settings.defaultCwd || os.homedir();
  const requestedCommand = options.command || "";

  let shell, args, displayLabel;

  if (requestedCommand && !isKnownShell(requestedCommand)) {
    // A CLI tool (codex, claude, gemini, etc.) — run it inside the system shell
    shell = resolveShell(settings.shell);
    args = resolveShellArgs(shell);

    // Build the command string with any extra args from the launcher preset
    const extraArgs = Array.isArray(options.args) && options.args.length > 0
      ? options.args.join(" ")
      : "";
    const fullCommand = [requestedCommand, extraArgs].filter(Boolean).join(" ");

    if (process.platform === "win32") {
      const shellName = path.basename(shell).toLowerCase();
      if (shellName === "powershell.exe" || shellName === "pwsh.exe") {
        args.push("-NoExit", "-Command", fullCommand);
      } else {
        args.push("/K", fullCommand);
      }
    } else {
      // macOS / Linux — use -c with exec so the shell replaces itself
      args.push("-c", `exec ${fullCommand}`);
    }

    displayLabel = `${shell} → ${fullCommand}`;
  } else {
    // Standard shell terminal (no launcher, or the command IS a shell)
    shell = resolveShell(requestedCommand || settings.shell);
    args = resolveShellArgs(shell, Array.isArray(options.args) ? options.args : []);
    displayLabel = `${shell}${args.length ? ` ${args.join(" ")}` : ""}`;
  }

  try {
    writeLog(`创建终端 id=${id} shell=${shell} args=${JSON.stringify(args)} cwd=${cwd}`);
    const terminal = pty.spawn(shell, args, {
      name: "xterm-256color",
      cols: options.cols || 100,
      rows: options.rows || 30,
      cwd,
      env: { ...process.env, LANG: "zh_CN.UTF-8", TERM: "xterm-256color" },
      useConpty: process.platform === "win32"
    });

    terminals.set(id, terminal);
    terminal.onData((data) => safeSend("terminal:data", { id, data }));
    terminal.onExit(({ exitCode }) => {
      writeLog(`终端退出 id=${id} exitCode=${exitCode}`);
      terminals.delete(id);
      safeSend("terminal:exit", { id, exitCode });
    });

    safeSend("terminal:data", {
      id,
      data: `\r\n\x1b[36m已连接终端：${displayLabel}\x1b[0m\r\n`
    });
    return { id, pid: terminal.pid, shell, cwd };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    writeLog(`终端创建失败 id=${id} message=${message}`);
    safeSend("terminal:error", { id, message });
    throw error;
  }
}

function writeTerminal(_, { id, data }) {
  terminals.get(id)?.write(data);
}

function resizeTerminal(_, { id, cols, rows }) {
  terminals.get(id)?.resize(cols, rows);
}

function closeTerminal(_, id) {
  const terminal = terminals.get(id);
  if (!terminal) return;
  terminal.kill();
  terminals.delete(id);
}

app.whenReady().then(() => {
  buildMenu();
  createWindow();
  createTray();

  ipcMain.handle("settings:get", () => getSettings());
  ipcMain.handle("settings:set", (_, settings) => {
    store.set("settings", settings);
    mainWindow?.setAlwaysOnTop(Boolean(settings.stayOnTop));
    safeSend("settings:changed", settings);
    buildMenu();
    return settings;
  });
  ipcMain.handle("dialog:audio", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "选择提示音",
      properties: ["openFile"],
      filters: [{ name: "音频文件", extensions: ["mp3", "wav", "ogg", "m4a"] }]
    });
    return result.canceled ? "" : result.filePaths[0];
  });
  ipcMain.handle("terminal:create", createTerminal);
  ipcMain.handle("terminal:write", writeTerminal);
  ipcMain.handle("terminal:resize", resizeTerminal);
  ipcMain.handle("terminal:close", closeTerminal);
  ipcMain.handle("window:toggleTop", (_, enabled) => {
    mainWindow?.setAlwaysOnTop(Boolean(enabled));
  });
  ipcMain.handle("dialog:folder", async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "选择项目目录",
      properties: ["openDirectory"]
    });
    return result.canceled ? "" : result.filePaths[0];
  });
  ipcMain.handle("fs:readdir", async (_, dirPath) => {
    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
      const items = entries
        .filter((e) => !e.name.startsWith("."))
        .map((e) => ({
          name: e.name,
          path: path.join(dirPath, e.name),
          isDirectory: e.isDirectory()
        }))
        .sort((a, b) => {
          if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
      return { ok: true, items, parent: path.dirname(dirPath), current: dirPath };
    } catch (error) {
      return { ok: false, items: [], parent: dirPath, current: dirPath, error: String(error) };
    }
  });
  ipcMain.handle("fs:openFile", async (_, filePath) => {
    await shell.openPath(filePath);
  });
  ipcMain.handle("fs:showInExplorer", (_, filePath) => {
    shell.showItemInFolder(filePath);
  });
  ipcMain.handle("fs:copyPath", (_, filePath) => {
    clipboard.writeText(filePath);
  });
  ipcMain.handle("fs:trashFile", async (_, filePath) => {
    try {
      await shell.trashItem(filePath);
      return { ok: true };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  });
  ipcMain.handle("fs:getProperties", async (_, filePath) => {
    try {
      const stat = await fs.promises.stat(filePath);
      return {
        ok: true,
        name: path.basename(filePath),
        path: filePath,
        size: stat.size,
        isDirectory: stat.isDirectory(),
        created: stat.birthtime.toISOString(),
        modified: stat.mtime.toISOString(),
        accessed: stat.atime.toISOString()
      };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  });
});

app.on("before-quit", () => {
  isQuitting = true;
  for (const terminal of terminals.values()) {
    try { terminal.kill(); } catch { /* terminal may already be dead */ }
  }
  terminals.clear();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
