import type { SoundSettings } from "../types";

const builtInTone = {
  newTerminal: 560,
  aiDone: 740,
  taskDone: 660,
  error: 220
} as const;

export function playSound(kind: keyof typeof builtInTone, settings: SoundSettings) {
  if (!settings.enabled) return;

  const customPath = settings[kind];
  if (customPath) {
    const audio = new Audio(`file:///${customPath.replaceAll("\\", "/")}`);
    audio.volume = settings.volume;
    void audio.play().catch(() => undefined);
    return;
  }

  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) return;

  const context = new AudioContextCtor();
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.frequency.value = builtInTone[kind];
  oscillator.type = kind === "error" ? "sawtooth" : "sine";
  gain.gain.value = Math.max(0, Math.min(1, settings.volume)) * 0.08;

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.16);
  oscillator.onended = () => void context.close();
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
