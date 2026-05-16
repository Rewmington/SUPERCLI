import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import type { AppSettings, TerminalPaneState } from "../types";

interface TerminalPaneProps {
  pane: TerminalPaneState;
  settings: AppSettings;
  active: boolean;
  onFocus: (id: string) => void;
  onReady: (id: string, cols: number, rows: number) => void;
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

export function TerminalPane({ pane, settings, active, onFocus, onReady }: TerminalPaneProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);

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

  return (
    <section className={`terminal-pane ${active ? "is-active" : ""}`} onMouseDown={() => onFocus(pane.id)}>
      <header className="pane-header">
        <span>{pane.title}</span>
        <span>{pane.status}</span>
      </header>
      <div className="terminal-surface" ref={containerRef} />
    </section>
  );
}
