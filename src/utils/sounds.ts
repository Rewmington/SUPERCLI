import type { SoundSettings } from "../types";

const builtInTone = {
  newTerminal: [520, 780],
  aiDone: [660, 880, 1100],
  taskDone: [560, 740, 980],
  error: [260, 180]
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
  const gain = context.createGain();
  gain.connect(context.destination);
  gain.gain.value = Math.max(0, Math.min(1, settings.volume)) * 0.06;

  const tones = builtInTone[kind];
  const now = context.currentTime;

  tones.forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const noteGain = context.createGain();
    const start = now + index * 0.07;
    const duration = kind === "error" ? 0.09 : 0.11;

    oscillator.frequency.value = frequency;
    oscillator.type = kind === "error" ? "sawtooth" : "triangle";

    noteGain.gain.setValueAtTime(0.0001, start);
    noteGain.gain.exponentialRampToValueAtTime(0.8, start + 0.01);
    noteGain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    oscillator.connect(noteGain);
    noteGain.connect(gain);
    oscillator.start(start);
    oscillator.stop(start + duration);
  });

  const total = now + tones.length * 0.07 + 0.2;
  window.setTimeout(() => void context.close(), Math.max(300, (total - now) * 1000));
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
