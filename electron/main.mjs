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
const projectRoot = path.join(__dirname, "..");
const iconSvgPath = path.join(projectRoot, "assets", "app-icon.svg");
const iconIcoPath = path.join(projectRoot, "assets", "app-icon.ico");
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

app.setAppUserModelId("com.supercli.desktop");

function createWindow() {
  const resolvedWindowIcon = fs.existsSync(iconIcoPath) ? iconIcoPath : createWindowIcon();
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 820,
    minWidth: 1040,
    minHeight: 640,
    title: "SUPER-CLI",
    icon: resolvedWindowIcon,
    backgroundColor: "#101419",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.setAlwaysOnTop(Boolean(getSettings().stayOnTop));
  mainWindow.setIcon(createWindowIcon());
  mainWindow.removeMenu();

  const devServerUrl = getDevServerUrl();
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      safeSend("app:status", "已最小化到系统托盘");
    }
  });
}

function buildMenu() {
  Menu.setApplicationMenu(null);
}

function createWindowIcon() {
  if (fs.existsSync(iconIcoPath)) {
    const ico = nativeImage.createFromPath(iconIcoPath);
    if (!ico.isEmpty()) return ico;
  }

  if (fs.existsSync(iconSvgPath)) {
    const svg = fs.readFileSync(iconSvgPath, "utf8");
    const image = nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`);
    if (!image.isEmpty()) {
      return image.resize({ width: 256, height: 256, quality: "best" });
    }
  }

  const fallbackSvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
      <rect x="16" y="16" width="224" height="224" rx="52" fill="#0D1117"/>
      <rect x="28" y="28" width="200" height="200" rx="44" fill="#121923" stroke="#41C7B9" stroke-width="12"/>
      <path d="M80 92L120 128L80 164" fill="none" stroke="#41C7B9" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="136" y="156" width="44" height="14" rx="7" fill="#F5B85B"/>
    </svg>`;
  return nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(fallbackSvg).toString("base64")}`).resize({ width: 256, height: 256, quality: "best" });
}

function createTrayIcon() {
  if (fs.existsSync(iconIcoPath)) {
    const ico = nativeImage.createFromPath(iconIcoPath);
    if (!ico.isEmpty()) {
      return ico.resize({ width: 16, height: 16, quality: "best" });
    }
  }

  if (fs.existsSync(iconSvgPath)) {
    const svg = fs.readFileSync(iconSvgPath, "utf8");
    const image = nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`);
    if (!image.isEmpty()) {
      return image.resize({ width: 16, height: 16, quality: "best" });
    }
  }

  const traySvg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
      <path d="M18 18L30 32L18 46" fill="none" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="34" y="42" width="12" height="4" rx="2" fill="#FFFFFF"/>
    </svg>`;
  return nativeImage
    .createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(traySvg).toString("base64")}`)
    .resize({ width: 16, height: 16, quality: "best" });
}

function createTray() {
  const icon = createTrayIcon();
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
