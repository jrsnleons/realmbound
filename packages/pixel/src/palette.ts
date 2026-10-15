/**
 * Palette + colour maths. Shading uses hue shifting (shadows drift toward
 * cool purple-blue, highlights toward warm yellow) which is what gives
 * hand-made pixel art its richness compared to plain darkening.
 */
import { type Color, type PixelImage, getAlpha, getColor, setPixel } from './image';

export function hex(s: string): Color {
  return parseInt(s.replace('#', ''), 16);
}

export function toHex(c: Color): string {
  return '#' + c.toString(16).padStart(6, '0');
}

export function rgbOf(c: Color): [number, number, number] {
  return [(c >> 16) & 255, (c >> 8) & 255, c & 255];
}

export function fromRgb(r: number, g: number, b: number): Color {
  const cl = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return (cl(r) << 16) | (cl(g) << 8) | cl(b);
}

export function mix(a: Color, b: Color, t: number): Color {
  const [ar, ag, ab] = rgbOf(a);
  const [br, bg, bb] = rgbOf(b);
  return fromRgb(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

export function toHsl(c: Color): [number, number, number] {
  const [r8, g8, b8] = rgbOf(c);
  const r = r8 / 255;
  const g = g8 / 255;
  const b = b8 / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}

export function fromHsl(h: number, s: number, l: number): Color {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return fromRgb((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

function hueToward(h: number, target: number, amount: number): number {
  let d = target - h;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return h + d * amount;
}

/**
 * Lightens (amount > 0) or darkens (amount < 0) with hue shifting.
 * `amount` is roughly a lightness delta in 0..1.
 */
export function shade(c: Color, amount: number): Color {
  const [h, s, l] = toHsl(c);
  if (amount >= 0) {
    const nh = s < 0.08 ? h : hueToward(h, 55, Math.min(0.35, amount * 1.1));
    return fromHsl(nh, s * (1 - amount * 0.25), l + amount * (1 - l) * 1.4);
  }
  const a = -amount;
  // Warm hues (reds/oranges/skin) drift gently toward wine; cool hues toward blue-violet.
  const warm = h < 70 || h > 300;
  const nh = s < 0.08 ? 250 : warm ? hueToward(h, 345, Math.min(0.25, a * 0.6)) : hueToward(h, 250, Math.min(0.3, a * 0.7));
  const ns = s < 0.08 ? Math.min(0.18, a * 0.5) : Math.min(1, s + a * 0.12);
  return fromHsl(nh, ns, l * (1 - a * 1.25));
}

export function desaturate(c: Color, amount: number): Color {
  const [h, s, l] = toHsl(c);
  return fromHsl(h, s * (1 - amount), l);
}

/** Colour of an outline pixel next to a pixel of colour `c`. */
export function outlineOf(c: Color): Color {
  const [h, s, l] = toHsl(c);
  const warm = h < 70 || h > 300;
  const nh = s < 0.08 ? 260 : warm ? hueToward(h, 340, 0.25) : hueToward(h, 255, 0.3);
  return fromHsl(nh, Math.min(0.45, s * 0.6 + 0.1), Math.max(0.08, l * 0.3));
}

export interface Ramp {
  /** Brightest highlight (sparingly). */
  hi: Color;
  /** Light tone (lit side). */
  light: Color;
  base: Color;
  /** Shadow tone. */
  shadow: Color;
  /** Deep shadow / interior lines. */
  deep: Color;
}

export function ramp(base: Color | string): Ramp {
  const b = typeof base === 'string' ? hex(base) : base;
  return {
    hi: shade(b, 0.32),
    light: shade(b, 0.14),
    base: b,
    shadow: shade(b, -0.18),
    deep: shade(b, -0.36),
  };
}

/** Deterministic integer hash → [0, 1). */
export function hash2(x: number, y: number, seed = 0): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return ((h >>> 0) % 100000) / 100000;
}

/** Small seeded PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Adds a 1px outline around every opaque shape in `img`, coloured as a dark
 * shade of the adjacent fill (so a red cloak gets a deep wine outline, skin a
 * warm brown one). Mutates `img`; shapes need a 1px transparent margin.
 */
export function outline(img: PixelImage, opts: { diagonal?: boolean; color?: Color; alphaThreshold?: number } = {}): void {
  const w = img.width;
  const h = img.height;
  const thr = opts.alphaThreshold ?? 128;
  const marks: number[] = [];
  const cols: number[] = [];
  const n4 = [
    [0, -1],
    [-1, 0],
    [1, 0],
    [0, 1],
  ] as const;
  const n8 = [...n4, [-1, -1], [1, -1], [-1, 1], [1, 1]] as const;
  const ns = opts.diagonal ? n8 : n4;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (getAlpha(img, x, y) !== 0) continue;
      let best = -1;
      let bestL = 2;
      for (const [dx, dy] of ns) {
        const nx = x + dx;
        const ny = y + dy;
        if (getAlpha(img, nx, ny) < thr) continue;
        const c = getColor(img, nx, ny);
        const l = toHsl(c)[2];
        if (l < bestL) {
          bestL = l;
          best = c;
        }
      }
      if (best >= 0) {
        marks.push(x, y);
        cols.push(opts.color ?? outlineOf(best));
      }
    }
  }
  for (let i = 0; i < cols.length; i++) setPixel(img, marks[i * 2] ?? 0, marks[i * 2 + 1] ?? 0, cols[i] ?? 0);
}

/**
 * Composites `layer` onto `target` with an automatic outline. Outline pixels
 * that land on empty target pixels use the full dark outline colour; those
 * that fall over existing art become a softer interior line (a shadow of the
 * underlying colour) — the "selout" look of hand-made sprites.
 */
export function compositeOutlined(target: PixelImage, layer: PixelImage, soft = 0.5): void {
  const w = layer.width;
  const h = layer.height;
  const ld = layer.data;
  const td = target.data;
  const marks: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if ((ld[i + 3] ?? 0) !== 0) continue;
      let best = -1;
      let bestL = 1e9;
      for (let k = 0; k < 4; k++) {
        const nx = k === 0 ? x : k === 1 ? x - 1 : k === 2 ? x + 1 : x;
        const ny = k === 0 ? y - 1 : k === 3 ? y + 1 : y;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = (ny * w + nx) * 4;
        if ((ld[j + 3] ?? 0) < 128) continue;
        const r = ld[j] ?? 0;
        const g = ld[j + 1] ?? 0;
        const b = ld[j + 2] ?? 0;
        const l = r * 3 + g * 6 + b;
        if (l < bestL) {
          bestL = l;
          best = (r << 16) | (g << 8) | b;
        }
      }
      if (best >= 0) marks.push(x, y, best);
    }
  }
  // paint fills
  for (let i = 0; i < w * h; i++) {
    const a = ld[i * 4 + 3] ?? 0;
    if (a === 0) continue;
    const x = i % w;
    const y = (i / w) | 0;
    if (x >= target.width || y >= target.height) continue;
    const col = ((ld[i * 4] ?? 0) << 16) | ((ld[i * 4 + 1] ?? 0) << 8) | (ld[i * 4 + 2] ?? 0);
    if (a === 255) setPixel(target, x, y, col);
    else blendPixelLocal(target, x, y, col, a);
  }
  for (let m = 0; m < marks.length; m += 3) {
    const x = marks[m]!;
    const y = marks[m + 1]!;
    const oc = cachedOutline(marks[m + 2]!);
    const ti = (y * target.width + x) * 4;
    if ((td[ti + 3] ?? 0) > 128 && soft > 0) {
      const under = ((td[ti] ?? 0) << 16) | ((td[ti + 1] ?? 0) << 8) | (td[ti + 2] ?? 0);
      setPixel(target, x, y, mix(oc, shade(under, -0.22), soft));
    } else setPixel(target, x, y, oc);
  }
}

const outlineCache = new Map<number, Color>();
function cachedOutline(c: Color): Color {
  let o = outlineCache.get(c);
  if (o === undefined) {
    o = outlineOf(c);
    outlineCache.set(c, o);
  }
  return o;
}

function blendPixelLocal(img: PixelImage, x: number, y: number, c: Color, a: number): void {
  const i = (y * img.width + x) * 4;
  const d = img.data;
  const sa = a / 255;
  const da = (d[i + 3] ?? 0) / 255;
  const oa = sa + da * (1 - sa);
  if (oa <= 0) return;
  d[i] = Math.round((((c >> 16) & 255) * sa + (d[i] ?? 0) * da * (1 - sa)) / oa);
  d[i + 1] = Math.round((((c >> 8) & 255) * sa + (d[i + 1] ?? 0) * da * (1 - sa)) / oa);
  d[i + 2] = Math.round(((c & 255) * sa + (d[i + 2] ?? 0) * da * (1 - sa)) / oa);
  d[i + 3] = Math.round(oa * 255);
}

/* ------------------------------------------------------------------ */
/* Named palette                                                       */
/* ------------------------------------------------------------------ */

export const SKIN_TONES: readonly Color[] = [
  hex('#f7dcc6'),
  hex('#efc09c'),
  hex('#d9a173'),
  hex('#b77a4e'),
  hex('#8a5634'),
  hex('#5c3a26'),
];

export const HAIR_COLORS: readonly Color[] = [
  hex('#302a3b'), // black (soft, slightly blue)
  hex('#4e3426'), // dark brown
  hex('#82522f'), // brown
  hex('#a3432d'), // auburn
  hex('#e8c463'), // blonde
  hex('#dd7a2f'), // ginger
  hex('#d4d3df'), // grey / white
  hex('#3db3a4'), // fantasy teal
];

export const HAIR_COLOR_NAMES = ['black', 'dark_brown', 'brown', 'auburn', 'blonde', 'ginger', 'grey', 'teal'] as const;

/** Shared world colours, tuned to sit together. */
export const P = {
  ink: hex('#2a2033'),
  white: hex('#fbf6ec'),
  shadow: hex('#1f1a2b'),
  // greens
  grass: hex('#6fb54d'),
  grassDark: hex('#4d8f3a'),
  grassLight: hex('#93cf5e'),
  leaf: hex('#4f9a44'),
  leafDark: hex('#2f6b3a'),
  pine: hex('#2f7a55'),
  moss: hex('#7aa34a'),
  // earth
  dirt: hex('#c49a62'),
  dirtDark: hex('#a37a4a'),
  sand: hex('#ead19a'),
  wood: hex('#a8703f'),
  woodDark: hex('#7a4c2c'),
  woodLight: hex('#c98f55'),
  plank: hex('#b9824d'),
  bark: hex('#6e4a33'),
  stone: hex('#9a9aa6'),
  stoneDark: hex('#6d6c7c'),
  stoneLight: hex('#bdbcc6'),
  cobble: hex('#a49c96'),
  // water
  water: hex('#4aa3d8'),
  waterDark: hex('#3478b8'),
  waterLight: hex('#86d0f0'),
  foam: hex('#e4f6ff'),
  // accents
  red: hex('#d2473f'),
  roof: hex('#c4553e'),
  roofBlue: hex('#4f6fb3'),
  gold: hex('#f2c14e'),
  goldDark: hex('#c98a2b'),
  orange: hex('#ef8a3c'),
  fire: hex('#ffb347'),
  ember: hex('#ff6a3a'),
  pink: hex('#f08aa8'),
  purple: hex('#7a52b3'),
  violet: hex('#5a3a8f'),
  corrupt: hex('#8a3fb8'),
  teal: hex('#2f8f8a'),
  sky: hex('#9fd8f5'),
  cream: hex('#efe1bf'),
  cloth: hex('#d8c39a'),
  leather: hex('#9a6438'),
  steel: hex('#aab5c4'),
  iron: hex('#7d8796'),
  blue: hex('#4569b8'),
  night: hex('#3a2f6b'),
  green: hex('#5f9e45'),
} as const;
