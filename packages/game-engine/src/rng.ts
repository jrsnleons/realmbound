/** Deterministic RNG (mulberry32) so every reward can be replayed from the event ledger. */
export function rngFor(seed: number, counter: number): () => number {
  let a = (seed ^ Math.imul(counter + 1, 0x9e3779b1)) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function pick<T>(rand: () => number, items: readonly T[]): T {
  return items[Math.floor(rand() * items.length) % items.length]!;
}

export function weightedPick<T>(rand: () => number, items: readonly { item: T; weight: number }[]): T | undefined {
  const total = items.reduce((s, i) => s + Math.max(0, i.weight), 0);
  if (total <= 0) return undefined;
  let r = rand() * total;
  for (const i of items) {
    r -= Math.max(0, i.weight);
    if (r < 0) return i.item;
  }
  return items[items.length - 1]?.item;
}
