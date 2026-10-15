/**
 * Visual effects and character aura overlays. Every effect is a list of
 * equally-sized frames plus a packed horizontal strip sheet.
 */
import { type Color, type PixelImage, blendPixel, createImage, forEllipse, setPixel } from './image';
import { hash2, hex, mix, ramp } from './palette';
import { glow, layer } from './draw';
import { packSheet, type SpriteSheet } from './sheet';
import { type AuraKind } from './character';

export interface EffectSprite {
  frames: PixelImage[];
  sheet: SpriteSheet;
  frameWidth: number;
  frameHeight: number;
  fps: number;
  loop: boolean;
  /** Pixel inside the frame that should sit on the effect's origin. */
  anchorX: number;
  anchorY: number;
}

export const VFX_IDS = ['level_up', 'sparkle', 'xp_orb', 'rain_drop', 'rain_overlay', 'cloud_overlay', 'dust_puff', 'sleep_z'] as const;
export type VfxId = (typeof VFX_IDS)[number];

function effect(frames: PixelImage[], fps: number, loop: boolean, anchorX: number, anchorY: number): EffectSprite {
  return {
    frames,
    sheet: packSheet(frames, { columns: frames.length }),
    frameWidth: frames[0]!.width,
    frameHeight: frames[0]!.height,
    fps,
    loop,
    anchorX,
    anchorY,
  };
}

function plus(img: PixelImage, x: number, y: number, r: number, core: Color, arm: Color, a = 255): void {
  blendPixel(img, x, y, core, a);
  for (let i = 1; i <= r; i++) {
    const fa = Math.round(a * (1 - (i - 1) / (r + 1)));
    blendPixel(img, x + i, y, arm, fa);
    blendPixel(img, x - i, y, arm, fa);
    blendPixel(img, x, y + i, arm, fa);
    blendPixel(img, x, y - i, arm, fa);
  }
}

/* ------------------------------------------------------------------ */

function levelUp(): PixelImage[] {
  const gold = ramp('#ffd34e');
  return Array.from({ length: 6 }, (_, f) => {
    const img = createImage(32, 32);
    const t = f / 5;
    const cx = 16;
    const cy = 16;
    // expanding ring
    const R = 3 + t * 12;
    for (let a = 0; a < 360; a += 4) {
      const rad = (a * Math.PI) / 180;
      const x = Math.round(cx + Math.cos(rad) * R);
      const y = Math.round(cy + Math.sin(rad) * R * 0.9);
      blendPixel(img, x, y, f < 3 ? 0xffffff : gold.light, Math.round(255 * (1 - t * 0.7)));
      if (f < 4) blendPixel(img, Math.round(cx + Math.cos(rad) * (R - 1)), Math.round(cy + Math.sin(rad) * (R - 1) * 0.9), gold.base, Math.round(180 * (1 - t)));
    }
    // rays
    if (f >= 1 && f <= 4) {
      for (let k = 0; k < 8; k++) {
        const rad = (k * Math.PI) / 4 + Math.PI / 8;
        for (let d = R * 0.4; d < R * 0.4 + 4; d++) {
          blendPixel(img, Math.round(cx + Math.cos(rad) * d), Math.round(cy + Math.sin(rad) * d), gold.light, 200 - f * 30);
        }
      }
    }
    // core flash
    if (f <= 2) glow(img, cx, cy, 6 - f * 1.5, 0xfff6c4, 220 - f * 60, true);
    // rising sparkles
    for (let i = 0; i < 6; i++) {
      const sx = 4 + Math.floor(hash2(i, 1, 2) * 24);
      const sy = 28 - Math.floor(hash2(1, i, 2) * 8) - f * 3;
      if (sy < 0 || (i + f) % 3 === 0) continue;
      plus(img, sx, sy, f % 2 ? 1 : 2, 0xffffff, gold.light, 230 - f * 25);
    }
    return img;
  });
}

function sparkle(): PixelImage[] {
  const sizes = [1, 2, 3, 1];
  return sizes.map((r, f) => {
    const img = createImage(8, 8);
    plus(img, 4, 4, r, 0xffffff, f === 2 ? hex('#ffe9a8') : hex('#fff3c4'));
    if (f === 2) {
      blendPixel(img, 3, 3, 0xfff3c4, 160);
      blendPixel(img, 5, 5, 0xfff3c4, 160);
      blendPixel(img, 5, 3, 0xfff3c4, 160);
      blendPixel(img, 3, 5, 0xfff3c4, 160);
    }
    return img;
  });
}

function xpOrb(): PixelImage[] {
  const g = ramp('#7ae05a');
  return [0, 1, 2, 3].map((f) => {
    const img = createImage(8, 8);
    const lift = f === 1 || f === 2 ? 1 : 0;
    glow(img, 4, 4 - lift, 4, hex('#c8ff9a'), 90);
    layer(
      img,
      (l) =>
        forEllipse(2, 2 - lift, 4, 4, (x, y, nx, ny) => setPixel(l, x, y, nx + ny < -0.3 ? g.hi : nx + ny > 0.4 ? g.shadow : g.light)),
      0,
    );
    setPixel(img, 3, 3 - lift, 0xffffff);
    return img;
  });
}

function rainDrop(): PixelImage[] {
  // falling streak (3 frames), then a splash
  const c = hex('#a8d8f0');
  const frames: PixelImage[] = [];
  for (let f = 0; f < 3; f++) {
    const img = createImage(4, 8);
    for (let y = 0; y < 4; y++) blendPixel(img, 2, y + f * 2 - 2, c, 120 + y * 40);
    frames.push(img);
  }
  const splash = createImage(4, 8);
  blendPixel(splash, 0, 6, c, 200);
  blendPixel(splash, 3, 6, c, 200);
  blendPixel(splash, 1, 7, c, 160);
  blendPixel(splash, 2, 7, c, 160);
  frames.push(splash);
  return frames;
}

function rainOverlay(): PixelImage[] {
  // seamless 16×16 tile of diagonal rain streaks; 3 frames shift downwards
  return [0, 1, 2].map((f) => {
    const img = createImage(16, 16);
    for (let i = 0; i < 6; i++) {
      const x0 = Math.floor(hash2(i, 3, 3) * 16);
      const y0 = Math.floor(hash2(3, i, 3) * 16) + f * 5;
      for (let k = 0; k < 4; k++) {
        const x = (x0 - Math.floor(k / 2) + 16) % 16;
        const y = (y0 + k) % 16;
        blendPixel(img, x, y, hex('#b8e0f8'), 90 + k * 30);
      }
    }
    return img;
  });
}

function cloudOverlay(): PixelImage[] {
  // soft drifting cloud shadow, seamless 32×32, 2 frames
  return [0, 1].map((f) => {
    const img = createImage(32, 32);
    const blobs: [number, number, number][] = [
      [8, 10, 7],
      [16, 8, 8],
      [24, 12, 6],
      [12, 22, 6],
      [26, 26, 5],
    ];
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < 32; x++) {
        let v = 0;
        for (const [bx, by, r] of blobs) {
          for (const ox of [-32, 0, 32])
            for (const oy of [-32, 0, 32]) {
              const d = Math.hypot(x - (bx + f * 2 + ox), y - (by + oy)) / r;
              v = Math.max(v, 1 - d);
            }
        }
        if (v <= 0) continue;
        const a = v > 0.45 ? 70 : v > 0.15 && (x + y) % 2 === 0 ? 45 : 0;
        if (a) blendPixel(img, x, y, hex('#3a3f5a'), a);
      }
    return img;
  });
}

function dustPuff(): PixelImage[] {
  const c = ramp('#d9c8a8');
  return [0, 1, 2, 3].map((f) => {
    const img = createImage(12, 8);
    const puffs: [number, number][] = [
      [3, 5],
      [7, 4],
      [9, 6],
    ];
    for (const [px, py] of puffs) {
      const r = 1 + f * 0.6;
      const a = Math.round(230 * (1 - f / 4));
      forEllipse(Math.round(px - r - f * 0.5), Math.round(py - r - f * 0.5), Math.round(r * 2), Math.round(r * 2), (x, y, nx, ny) =>
        blendPixel(img, x, y, nx + ny < -0.2 ? c.light : c.base, a),
      );
    }
    return img;
  });
}

function sleepZ(): PixelImage[] {
  const c = hex('#c8d4ff');
  return [0, 1, 2, 3].map((f) => {
    const img = createImage(12, 16);
    const drawZ = (x: number, y: number, big: boolean, a: number) => {
      const rows = big ? ['ZZZ', '.Z.', 'ZZZ'].map((r) => r.replace(/\./g, '.')) : ['ZZ', 'ZZ'];
      if (big) {
        for (let i = 0; i < 4; i++) blendPixel(img, x + i, y, c, a);
        blendPixel(img, x + 2, y + 1, c, a);
        blendPixel(img, x + 1, y + 2, c, a);
        for (let i = 0; i < 4; i++) blendPixel(img, x + i, y + 3, c, a);
      } else {
        blendPixel(img, x, y, c, a);
        blendPixel(img, x + 1, y, c, a);
        blendPixel(img, x + 1, y + 1, c, a);
        blendPixel(img, x, y + 2, c, a);
        blendPixel(img, x + 1, y + 2, c, a);
        void rows;
      }
    };
    drawZ(1 + (f % 2), 11 - f, false, 240);
    drawZ(5 + ((f + 1) % 2), 7 - f, true, 220 - f * 20);
    if (f >= 2) drawZ(8, 3 - (f - 2), false, 160);
    return img;
  });
}

const VFX: Record<VfxId, () => EffectSprite> = {
  level_up: () => effect(levelUp(), 12, false, 16, 16),
  sparkle: () => effect(sparkle(), 10, true, 4, 4),
  xp_orb: () => effect(xpOrb(), 8, true, 4, 4),
  rain_drop: () => effect(rainDrop(), 12, true, 2, 7),
  rain_overlay: () => effect(rainOverlay(), 10, true, 0, 0),
  cloud_overlay: () => effect(cloudOverlay(), 1, true, 0, 0),
  dust_puff: () => effect(dustPuff(), 12, false, 6, 7),
  sleep_z: () => effect(sleepZ(), 3, true, 2, 15),
};

export function renderVfx(id: VfxId): EffectSprite {
  const fn = VFX[id];
  if (!fn) throw new Error(`Unknown vfx ${id}`);
  return fn();
}

/* ------------------------------ auras ------------------------------ */

/**
 * 24×32 × 4-frame overlay to composite on top of a character frame
 * (same origin). Particles stay clear of the face.
 */
export function renderAuraSheet(kind: AuraKind): EffectSprite {
  const frames = [0, 1, 2, 3].map((f) => {
    const img = createImage(24, 32);
    if (kind === 'momentum') {
      // warm ground glow + rising embers
      forEllipse(3, 27, 18, 5, (x, y, nx, ny) => {
        const d = Math.hypot(nx, ny);
        if (d > 0.7 && (x + y + f) % 2 === 0) blendPixel(img, x, y, hex('#ffcf5a'), 90);
        else if (d <= 0.7) blendPixel(img, x, y, hex('#ffb347'), 40);
      });
      const embers: [number, number][] = [
        [3, 26],
        [20, 24],
        [5, 18],
        [19, 14],
        [2, 10],
        [21, 6],
      ];
      embers.forEach(([x, y], i) => {
        const yy = y - ((f * 3 + i * 5) % 14);
        if (yy < 1) return;
        const col = (i + f) % 2 ? hex('#ffe07a') : hex('#ff9a3a');
        blendPixel(img, x + (f % 2 && i % 2 ? 1 : 0), yy, col, 230);
        blendPixel(img, x, yy + 1, hex('#ff7a3a'), 120);
      });
    } else if (kind === 'corruption') {
      // purple wisps curling up from the feet
      const C = ramp('#8a3fb8');
      for (let w = 0; w < 3; w++) {
        const baseX = [3, 20, 12][w]!;
        for (let k = 0; k < 10; k++) {
          const y = 30 - k * 2 - ((f * 2) % 4);
          const x = Math.round(baseX + Math.sin(k * 0.8 + f * 1.57 + w * 2) * 2);
          if (y < 2) continue;
          if (w === 2 && y < 24) continue;
          const a = Math.round(255 * (1 - k / 12));
          blendPixel(img, x - 1, y, C.deep, Math.round(a * 0.7));
          blendPixel(img, x, y, k < 3 ? C.shadow : C.light, a);
          blendPixel(img, x + 1, y, C.base, Math.round(a * 0.85));
          blendPixel(img, x, y + 1, C.base, Math.round(a * 0.5));
        }
      }
      forEllipse(3, 27, 18, 5, (x, y, nx, ny) => {
        const edge = nx * nx + ny * ny > 0.55;
        blendPixel(img, x, y, edge ? hex('#6a2a8e') : hex('#2a1040'), edge ? 170 : 130);
      });
      // a few dark motes
      for (let i = 0; i < 3; i++) blendPixel(img, Math.floor(hash2(i, f, 4) * 22) + 1, Math.floor(hash2(f, i, 4) * 12) + 14, hex('#c070ff'), 200);
    } else {
      // recovery: gentle green sparkles + plus signs drifting up
      const G = hex('#9ff0a0');
      const pts: [number, number][] = [
        [3, 22],
        [20, 18],
        [5, 9],
        [19, 4],
        [2, 15],
      ];
      pts.forEach(([x, y], i) => {
        const yy = y - ((f * 2 + i * 3) % 8);
        const big = (i + f) % 3 === 0;
        plus(img, x, yy, big ? 2 : 1, 0xffffff, G, 220);
      });
      forEllipse(4, 28, 16, 4, (x, y, nx, ny) => {
        if (Math.hypot(nx, ny) > 0.75) blendPixel(img, x, y, hex('#7ae08a'), (x + f) % 3 === 0 ? 120 : 60);
      });
    }
    return img;
  });
  return effect(frames, 6, true, 12, 30);
}

void mix;
