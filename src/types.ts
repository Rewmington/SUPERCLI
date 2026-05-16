export type ThemeName = "dark" | "light";

export interface LauncherCommand {
  id: string;
  name: string;
  command: string;
}

export interface LauncherPreset {
  id: string;
  name: string;
  command: string;
  args: string[];
  cwd: string;
  description: string;
  commands?: LauncherCommand[];
}

export interface FavoriteCommand {
  id: string;
  name: string;
  command: string;
}

export interface SoundSettings {
  enabled: boolean;
  volume: number;
  aiDone: string;
  taskDone: string;
  error: string;
  newTerminal: string;
}

export interface ShortcutSettings {
  newTab: string;
  closeTab: string;
  splitRight: string;
  splitDown: string;
  commandPalette: string;
}

export interface AppSettings {
  theme: ThemeName;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  shell: string;
  defaultCwd: string;
  stayOnTop: boolean;
  minimizeToTray: boolean;
  sounds: SoundSettings;
  shortcuts: ShortcutSettings;
  launchers: LauncherPreset[];
  favorites: FavoriteCommand[];
}

export interface TerminalPaneState {
  id: string;
  title: string;
  command?: string;
  cwd?: string;
  status: "启动中" | "运行中" | "已退出";
}

export interface TerminalTabState {
  id: string;
  title: string;
  panes: TerminalPaneState[];
  activePaneId: string;
  splitDirection: "horizontal" | "vertical";
}

export interface TerminalCreateResult {
  id: string;
  pid: number;
  shell: string;
  cwd: string;
}

export interface TerminalDataPayload {
  id: string;
  data: string;
}

export interface TerminalExitPayload {
  id: string;
  exitCode: number;
}

export interface DirEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

export interface DirReadResult {
  ok: boolean;
  items: DirEntry[];
  parent: string;
  current: string;
  error?: string;
}
