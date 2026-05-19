import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import type { AppSettings, TerminalPaneState } from "../types";

interface TerminalPaneProps {
  pane: TerminalPaneState;
  settings: AppSettings;
  active: boolean;
  showClose: boolean;
  onFocus: (id: string) => void;
  onReady: (id: string, cols: number, rows: number) => void;
  onClose: (id: string) => void;
}

const darkTheme = {
  background: "#0f141a",
  foreground: "#d6dee7",
  cursor: "#89ddff",
  selectionBackground: "#32414f",
  black: "#101419",
  red: "#ef6f6c",
  green: "#8ecf88",
  yellow: "#ffd166",
  blue: "#65a8ff",
  magenta: "#c792ea",
  cyan: "#74d4d7",
  white: "#d6dee7"
};

const lightTheme = {
  background: "#f7f5ef",
  foreground: "#26313d",
  cursor: "#0a7f8f",
  selectionBackground: "#d4e3e5",
  black: "#26313d",
  red: "#b83b43",
  green: "#2f7d4f",
  yellow: "#9a6b00",
  blue: "#176fbe",
  magenta: "#8a4ab2",
  cyan: "#0a7f8f",
  white: "#fffaf0"
};

export function TerminalPane({ pane, settings, active, showClose, onFocus, onReady, onClose }: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const terminal = new Terminal({
      cursorBlink: true,
      convertEol: true,
      fontFamily: settings.fontFamily,
      fontSize: settings.fontSize,
      lineHeight: settings.lineHeight,
      theme: settings.theme === "dark" ? darkTheme : lightTheme,
      windowsMode: true
    });
    const fitAddon = new FitAddon();

    terminal.loadAddon(fitAddon);
    terminal.attachCustomKeyEventHandler((event) => {
      const key = event.key.toLowerCase();
      const ctrlOrCmd = event.ctrlKey || event.metaKey;

      if (event.type === "keydown" && ctrlOrCmd && key === "c") {
        if (terminal.hasSelection()) {
          const selection = terminal.getSelection();
          void navigator.clipboard.writeText(selection).catch(() => undefined);
          return false;
        }
        return true;
      }

      return true;
    });
    terminal.open(container);
    fitAddon.fit();
    terminal.focus();

    terminal.onData((data) => {
      void window.desktop.terminal.write({ id: pane.id, data });
    });

    terminalRef.current = terminal;
    fitRef.current = fitAddon;

    const unsubscribeData = window.desktop.terminal.onData(({ id, data }) => {
      if (id === pane.id) terminal.write(data);
    });

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit();
      void window.desktop.terminal.resize({ id: pane.id, cols: terminal.cols, rows: terminal.rows });
    });
    resizeObserver.observe(container);
    onReady(pane.id, terminal.cols, terminal.rows);

    return () => {
      unsubscribeData();
      resizeObserver.disconnect();
      terminal.dispose();
    };
  }, [pane.id]);

  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;
    terminal.options.fontFamily = settings.fontFamily;
    terminal.options.fontSize = settings.fontSize;
    terminal.options.lineHeight = settings.lineHeight;
    terminal.options.theme = settings.theme === "dark" ? darkTheme : lightTheme;
    fitRef.current?.fit();
  }, [settings.fontFamily, settings.fontSize, settings.lineHeight, settings.theme]);

  useEffect(() => {
    if (active) terminalRef.current?.focus();
  }, [active]);

  function closeContextMenu() {
    setContextMenu(null);
  }

  async function copySelection() {
    const terminal = terminalRef.current;
    if (!terminal) return;
    const text = terminal.getSelection();
    if (text) {
      await navigator.clipboard.writeText(text).catch(() => undefined);
    }
    closeContextMenu();
  }

  async function pasteClipboard() {
    const text = await navigator.clipboard.readText().catch(() => "");
    if (text) {
      void window.desktop.terminal.write({ id: pane.id, data: text });
      terminalRef.current?.focus();
    }
    closeContextMenu();
  }

  function selectAllText() {
    terminalRef.current?.selectAll();
    closeContextMenu();
  }

  function clearScreen() {
    terminalRef.current?.clear();
    closeContextMenu();
  }

  return (
    <section
      className={`terminal-pane ${active ? "is-active" : ""}`}
      onMouseDown={() => onFocus(pane.id)}
      onContextMenu={(event) => {
        event.preventDefault();
        setContextMenu({ x: event.clientX, y: event.clientY });
      }}
    >
      <header className="pane-header">
        <span>{pane.title}</span>
        <div className="pane-header-right">
          <span>{pane.status}</span>
          {showClose && (
            <button className="pane-close" title="关闭此面板" onClick={() => onClose(pane.id)}>✕</button>
          )}
        </div>
      </header>
      <div className="terminal-surface" ref={containerRef} />
      {contextMenu && (
        <div className="ctx-overlay" onClick={closeContextMenu} onContextMenu={(e) => { e.preventDefault(); closeContextMenu(); }}>
          <div className="ctx-menu terminal-ctx-menu" style={{ top: contextMenu.y, left: contextMenu.x }} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => void copySelection()}>复制</button>
            <button onClick={() => void pasteClipboard()}>粘贴</button>
            <button onClick={selectAllText}>全选</button>
            <div className="ctx-divider" />
            <button onClick={clearScreen}>清屏</button>
          </div>
        </div>
      )}
    </section>
  );
}
