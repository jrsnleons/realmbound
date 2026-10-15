import { store } from './storage';

/** Tiny generated chiptune sounds (no audio files) and haptics where the browser supports them. */
let ctx: AudioContext | null = null;

export function soundOn(): boolean {
  return store.get('rb-sound') !== 'off';
}
export function setSound(on: boolean) {
  store.set('rb-sound', on ? 'on' : 'off');
}

function audio(): AudioContext | null {
  if (typeof window === 'undefined' || !soundOn()) return null;
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'square', gain = 0.05) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + start;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export const sfx = {
  tap: () => tone(880, 0, 0.04, 'triangle', 0.03),
  check: () => {
    tone(660, 0, 0.07);
    tone(990, 0.06, 0.1);
  },
  coin: () => {
    tone(988, 0, 0.06);
    tone(1319, 0.06, 0.18);
  },
  resist: () => {
    tone(523, 0, 0.08, 'triangle');
    tone(784, 0.08, 0.14, 'triangle');
  },
  hit: () => tone(140, 0, 0.12, 'sawtooth', 0.06),
  levelUp: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.16)),
  loot: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, i * 0.07, 0.12, 'triangle')),
  soft: () => tone(392, 0, 0.12, 'sine', 0.04),
};

export function haptic(kind: 'light' | 'success' | 'warning' = 'light') {
  try {
    navigator.vibrate?.(kind === 'success' ? [12, 40, 18] : kind === 'warning' ? [30, 50, 30] : 8);
  } catch {
    /* unsupported */
  }
}

export function reducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return store.get('rb-reduced-motion') === 'on' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
