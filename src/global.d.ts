import type { AppSettings, DirReadResult, TerminalCreateResult, TerminalDataPayload, TerminalExitPayload } from "./types";

declare global {
  interface Window {
    desktop: {
      getSettings: () => Promise<AppSettings>;
      setSettings: (settings: AppSettings) => Promise<AppSettings>;
      selectAudio: () => Promise<string>;
      selectFolder: () => Promise<string>;
      readDir: (dirPath: string) => Promise<DirReadResult>;
      toggleAlwaysOnTop: (enabled: boolean) => Promise<void>;
      terminal: {
        create: (options: Record<string, unknown>) => Promise<TerminalCreateResult>;
        write: (payload: { id: string; data: string }) => Promise<void>;
        resize: (payload: { id: string; cols: number; rows: number }) => Promise<void>;
        close: (id: string) => Promise<void>;
        onData: (callback: (payload: TerminalDataPayload) => void) => () => void;
        onError: (callback: (payload: { id: string; message: string }) => void) => () => void;
        onExit: (callback: (payload: TerminalExitPayload) => void) => () => void;
      };
      events: {
        onStatus: (callback: (message: string) => void) => () => void;
        onSettingsChanged: (callback: (settings: AppSettings) => void) => () => void;
        onNewTerminal: (callback: () => void) => () => void;
        onCloseTab: (callback: () => void) => () => void;
        onSplitRight: (callback: () => void) => () => void;
        onSplitDown: (callback: () => void) => () => void;
      };
    };
  }
}

export {};
