const { contextBridge, ipcRenderer } = require("electron");

const subscriptions = new Map();

function subscribe(channel, callback) {
  const listener = (_, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  const key = `${channel}:${subscriptions.size}`;
  subscriptions.set(key, () => ipcRenderer.removeListener(channel, listener));
  return () => {
    subscriptions.get(key)?.();
    subscriptions.delete(key);
  };
}

contextBridge.exposeInMainWorld("desktop", {
  getSettings: () => ipcRenderer.invoke("settings:get"),
  setSettings: (settings) => ipcRenderer.invoke("settings:set", settings),
  selectAudio: () => ipcRenderer.invoke("dialog:audio"),
  selectFolder: () => ipcRenderer.invoke("dialog:folder"),
  toggleAlwaysOnTop: (enabled) => ipcRenderer.invoke("window:toggleTop", enabled),
  terminal: {
    create: (options) => ipcRenderer.invoke("terminal:create", options),
    write: (payload) => ipcRenderer.invoke("terminal:write", payload),
    resize: (payload) => ipcRenderer.invoke("terminal:resize", payload),
    close: (id) => ipcRenderer.invoke("terminal:close", id),
    onData: (callback) => subscribe("terminal:data", callback),
    onError: (callback) => subscribe("terminal:error", callback),
    onExit: (callback) => subscribe("terminal:exit", callback)
  },
  events: {
    onStatus: (callback) => subscribe("app:status", callback),
    onSettingsChanged: (callback) => subscribe("settings:changed", callback),
    onNewTerminal: (callback) => subscribe("menu:new-terminal", callback),
    onCloseTab: (callback) => subscribe("menu:close-tab", callback),
    onSplitRight: (callback) => subscribe("menu:split-right", callback),
    onSplitDown: (callback) => subscribe("menu:split-down", callback)
  }
});
