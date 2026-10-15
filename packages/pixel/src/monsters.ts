/**
 * Monster sprites. Each monster returns its animation frames plus a packed
 * horizontal strip sheet. Anchor is at the feet (bottom-centre).
 */
import { type PixelImage, blendPixel, createImage, getAlpha, setPixel, forEllipse } from './image';
import { hash2, hex, mix, ramp, shade } from './palette';
import { ball, box, glow, groundShadow, layer, thickLine } from './draw';
import { packSheet, type SpriteSheet } from './sheet';

export const MONSTER_IDS = ['slime', 'forest_goblin', 'shadow_wisp', 'corruption_beast', 'ancient_treant'] as const;
export type MonsterId = (typeof MONSTER_IDS)[number];

export interface MonsterSprite {
  id: MonsterId;
  frames: PixelImage[];
  sheet: SpriteSheet;
  frameWidth: number;
  frameHeight: number;
  fps: number;
  anchorX: number;
  anchorY: number;
  /** True for bosses (UI can show a big health bar). */
  boss: boolean;
}

const EYE = hex('#1c1424');

/* ------------------------------------------------------------------ */

function slime(): PixelImage[] {
  const g = ramp(hex('#6cc24a'));
  const shapes: [number, number, number][] = [
    // [width, height, lift]
    [12, 9, 0],
    [14, 7, 0],
    [10, 11, 2],
    [12, 9, 1],
  ];
  return shapes.map(([w, h, lift]) => {
    const img = createImage(16, 16);
    groundShadow(img, 8, 14, lift ? 10 : 13, 3, lift ? 45 : 60);
    const x0 = 8 - w / 2;
    const y0 = 14 - h - lift;
    layer(img, (l) => {
      // dome: flat bottom
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const nx = (x + 0.5 - w / 2) / (w / 2);
          const ny = (y + 0.5 - h) / h;
          if (nx * nx + ny * ny > 1 && y < h - 2) continue;
          if (y >= h - 2 && Math.abs(nx) > 0.98) continue;
          let c = g.base;
          const lit = -(nx * 0.6 + ny * 0.8);
          if (lit > 0.6) c = g.light;
          if (nx > 0.55 || y === h - 1) c = g.shadow;
          if (y === h - 1 && Math.abs(nx) < 0.7) c = g.deep;
          setPixel(l, Math.round(x0 + x), y0 + y, c);
        }
      // shine
      setPixel(l, Math.round(x0 + 2), y0 + 2, 0xffffff);
      setPixel(l, Math.round(x0 + 3), y0 + 2, g.hi);
      setPixel(l, Math.round(x0 + 2), y0 + 3, g.hi);
    });
    // face
    const ey = y0 + Math.floor(h * 0.45);
    const cx = 8;
    for (const ex of [cx - 3, cx + 2]) {
      setPixel(img, ex, ey, EYE);
      setPixel(img, ex, ey + 1, EYE);
      setPixel(img, ex + 1, ey, EYE);
      setPixel(img, ex + 1, ey + 1, EYE);
      setPixel(img, ex, ey, 0xffffff);
    }
    setPixel(img, cx - 1, ey + 2, hex('#2f5a2a'));
    setPixel(img, cx, ey + 2, hex('#2f5a2a'));
    setPixel(img, cx - 4, ey + 2, mix(g.base, 0xff7a8a, 0.5));
    setPixel(img, cx + 3, ey + 2, mix(g.base, 0xff7a8a, 0.5));
    return img;
  });
}

function goblin(): PixelImage[] {
  const skin = ramp(hex('#7cb342'));
  const tunic = ramp(hex('#8a5a36'));
  const cloth = ramp(hex('#b84a3a'));
  return [0, 1].map((f) => {
    const img = createImage(24, 24);
    groundShadow(img, 12, 22, 14, 3);
    const by = f;
    // legs
    layer(img, (l) => {
      box(l, 8, 17, 3, 5, ramp(hex('#5a3d2c')));
      box(l, 13, 17, 3, 5, ramp(hex('#5a3d2c')));
    });
    // body
    layer(img, (l) => {
      for (let y = 12 + by; y <= 18; y++)
        for (let x = 7; x <= 16; x++) {
          if ((y === 12 + by && (x === 7 || x === 16)) || (y === 18 && (x === 7 || x === 16))) continue;
          let c = x < 9 ? tunic.light : x > 14 ? tunic.shadow : tunic.base;
          if (y === 16) c = hex('#4a3226');
          setPixel(l, x, y, c);
        }
      // scarf
      for (let x = 8; x <= 15; x++) setPixel(l, x, 12 + by, x < 10 ? cloth.light : cloth.base);
      setPixel(l, 14, 13 + by, cloth.shadow);
    });
    // club (back hand)
    layer(img, (l) => {
      thickLine(l, 18, 16 + by, 21, 8 + by, 2, (t) => (t > 0.6 ? ramp(hex('#9a6a3e')).light : ramp(hex('#9a6a3e')).shadow));
      ball(l, 19, 5 + by, 5, 5, ramp(hex('#9a6a3e')));
      setPixel(l, 20, 6 + by, hex('#c9c3b8'));
    });
    // arms
    layer(img, (l) => {
      box(l, 5, 13 + by, 2, 4, skin);
      box(l, 17, 13 + by, 2, 4, skin);
    });
    // head with ears
    layer(img, (l) => {
      const hy = 2 + by;
      ball(l, 6, hy, 12, 11, skin, 0.1);
      // ears (droop on frame 1)
      for (let i = 0; i < 4; i++) {
        setPixel(l, 5 - i, hy + 4 + (f ? Math.floor(i / 2) : -Math.floor(i / 3)), i < 2 ? skin.base : skin.light);
        setPixel(l, 5 - i, hy + 5 + (f ? Math.floor(i / 2) : -Math.floor(i / 3)), skin.shadow);
        setPixel(l, 18 + i, hy + 4 + (f ? Math.floor(i / 2) : -Math.floor(i / 3)), skin.base);
        setPixel(l, 18 + i, hy + 5 + (f ? Math.floor(i / 2) : -Math.floor(i / 3)), skin.shadow);
      }
    });
    const hy = 2 + by;
    // eyes: big yellow with dark pupils
    for (const ex of [8, 13]) {
      setPixel(img, ex, hy + 5, hex('#ffe26a'));
      setPixel(img, ex + 1, hy + 5, hex('#ffe26a'));
      setPixel(img, ex, hy + 6, hex('#ffe26a'));
      setPixel(img, ex + 1, hy + 6, EYE);
      setPixel(img, ex, hy + 4, skin.deep);
      setPixel(img, ex + 1, hy + 4, skin.deep);
    }
    // grin with a tooth
    for (let x = 10; x <= 13; x++) setPixel(img, x, hy + 8, hex('#3a2430'));
    setPixel(img, 11, hy + 8, 0xfbf6ec);
    setPixel(img, 11, hy + 3, skin.light);
    return img;
  });
}

function wisp(): PixelImage[] {
  const core = ramp(hex('#4a3a7a'));
  return [0, 1, 2, 3].map((f) => {
    const img = createImage(16, 24);
    const lift = [0, -1, -2, -1][f]!;
    groundShadow(img, 8, 22, 8 + (lift === -2 ? -2 : 0), 2, 40);
    glow(img, 8, 10 + lift, 8, hex('#9a6ad8'), 70);
    layer(img, (l) => {
      // wavy tail
      for (let y = 10; y <= 20; y++) {
        const t = (y - 10) / 10;
        const half = 4.5 * (1 - t) + 0.5;
        const cx = 8 + Math.sin(t * 4 + f * 1.57) * 2.2 * t;
        for (let x = Math.round(cx - half); x < Math.round(cx + half); x++) {
          const nx = (x + 0.5 - cx) / half;
          setPixel(l, x, y + lift, nx > 0.4 || t > 0.7 ? core.shadow : core.base);
        }
      }
      // round head
      ball(l, 3, 2 + lift, 10, 10, core);
      // flame tips
      setPixel(l, 5 + (f % 2), 1 + lift, core.light);
      setPixel(l, 9 - (f % 2), 1 + lift, core.base);
      setPixel(l, 7, 0 + lift + (f % 2), core.light);
    });
    // inner glow core
    forEllipse(5, 5 + lift, 6, 6, (x, y) => blendPixel(img, x, y, hex('#8a6ad0'), 120));
    // glowing eyes
    for (const ex of [5, 9]) {
      setPixel(img, ex, 8 + lift, hex('#e8f8ff'));
      setPixel(img, ex + 1, 8 + lift, hex('#9fe6ff'));
      setPixel(img, ex, 9 + lift, hex('#9fe6ff'));
      setPixel(img, ex + 1, 9 + lift, hex('#6ac8f0'));
    }
    // sparkle motes
    const motes: [number, number][] = [
      [2, 16],
      [13, 13],
      [12, 4],
    ];
    motes.forEach(([x, y], i) => {
      if ((i + f) % 2 === 0) blendPixel(img, x, y + lift - f, hex('#d8b8ff'), 200);
    });
    return img;
  });
}

function corruptionBeast(): PixelImage[] {
  const hide = ramp(hex('#3d2a52'));
  const glowC = hex('#e05ad8');
  return [0, 1].map((f) => {
    const img = createImage(32, 32);
    groundShadow(img, 16, 29, 28, 4);
    const by = f;
    // far legs
    layer(img, (l) => {
      box(l, 9, 22, 4, 7, ramp(hex('#2a1d3a')));
      box(l, 22, 22, 4, 7, ramp(hex('#2a1d3a')));
    });
    // body
    layer(img, (l) => {
      ball(l, 5, 9 + by, 24, 16, hide);
      // spikes along the back
      for (let i = 0; i < 5; i++) {
        const x = 9 + i * 4;
        const h = 3 + (i % 2);
        for (let k = 0; k < h; k++) setPixel(l, x + Math.floor(k / 2), 10 + by - k, k === h - 1 ? hex('#8a5ab8') : hide.light);
      }
    });
    // near legs
    layer(img, (l) => {
      box(l, 6, 21 + by, 5, 8 - by, hide);
      box(l, 20, 21 + by, 5, 8 - by, hide);
      for (const x of [6, 8, 10, 20, 22, 24]) setPixel(l, x, 29, hex('#d8d0e0'));
    });
    // head
    layer(img, (l) => {
      ball(l, 0, 12 + by, 13, 11, hide, 0.15);
      // horns
      thickLine(l, 3, 13 + by, 0, 7 + by, 2, (t) => (t > 0.6 ? hex('#e8dcc8') : hex('#b8a890')));
      thickLine(l, 9, 12 + by, 11, 6 + by, 2, (t) => (t > 0.6 ? hex('#e8dcc8') : hex('#b8a890')));
      // jaw
      for (let x = 1; x <= 9; x++) setPixel(l, x, 21 + by, hide.deep);
    });
    // glowing cracks
    const cracks: [number, number][] = [
      [14, 13],
      [15, 14],
      [16, 14],
      [17, 15],
      [21, 12],
      [22, 13],
      [22, 14],
      [18, 19],
      [19, 19],
      [20, 20],
      [12, 18],
    ];
    for (const [x, y] of cracks) setPixel(img, x, y + by, f ? glowC : mix(glowC, hide.base, 0.35));
    // eyes + teeth
    setPixel(img, 3, 16 + by, hex('#ffd0f8'));
    setPixel(img, 4, 16 + by, glowC);
    setPixel(img, 7, 16 + by, hex('#ffd0f8'));
    setPixel(img, 8, 16 + by, glowC);
    for (const x of [2, 4, 6, 8]) setPixel(img, x, 20 + by, 0xf4efe6);
    glow(img, 5.5, 16 + by, 4, glowC, f ? 120 : 70, true);
    // purple wisps rising
    for (let i = 0; i < 4; i++) {
      const x = 10 + i * 5;
      const y = 6 - ((f * 2 + i) % 4);
      blendPixel(img, x, y, hex('#a070e0'), 170);
      blendPixel(img, x + 1, y - 1, hex('#a070e0'), 100);
    }
    return img;
  });
}

function treant(): PixelImage[] {
  const bark = ramp(hex('#6e4a33'));
  const moss = ramp(hex('#6f9a3e'));
  const leaf = ramp(hex('#3f8a45'));
  return [0, 1].map((f) => {
    const img = createImage(64, 64);
    groundShadow(img, 32, 60, 56, 7, 70);
    const sway = f;
    // back branches + canopy
    layer(img, (l) => {
      const clumps: [number, number, number][] = [
        [32, 11, 12],
        [17, 15, 9],
        [47, 15, 9],
        [24, 6, 8],
        [41, 6, 8],
        [8, 22, 6],
        [56, 22, 6],
      ];
      for (const [cx, cy, r] of clumps) ball(l, cx - r + (cx < 32 ? -sway : cx > 32 ? sway : 0), cy - r, r * 2, r * 2, leaf);
      for (let i = 0; i < 80; i++) {
        const x = Math.floor(hash2(i, 3, 3) * 64);
        const y = Math.floor(hash2(3, i, 3) * 34);
        if (getAlpha(l, x, y) && getAlpha(l, x + 1, y + 1)) {
          setPixel(l, x, y, leaf.shadow);
          setPixel(l, x + 1, y + 1, leaf.deep);
        }
      }
    });
    // trunk body
    layer(img, (l) => {
      for (let y = 18; y <= 56; y++) {
        const t = (y - 18) / 38;
        const half = 11 + t * 3 + (y > 50 ? (y - 50) * 1.2 : 0);
        for (let x = Math.round(32 - half); x <= Math.round(31 + half); x++) {
          const nx = (x + 0.5 - 32) / half;
          let c = bark.base;
          if (nx < -0.55) c = bark.light;
          if (nx > 0.5) c = bark.shadow;
          if (nx > 0.85) c = bark.deep;
          // vertical bark grooves
          if ((x * 7 + Math.floor(y / 5)) % 9 === 0) c = bark.shadow;
          setPixel(l, x, y, c);
        }
      }
      // roots/feet
      for (const [x0, dir] of [
        [20, -1],
        [43, 1],
        [28, -1],
        [36, 1],
      ] as const) {
        thickLine(l, x0, 52, x0 + dir * 6, 58, 3, (t) => (t > 0.5 ? bark.shadow : bark.base));
      }
    });
    // branch arms
    layer(img, (l) => {
      thickLine(l, 21, 30, 8, 38 + sway, 4, (t) => (t < 0.3 ? bark.base : bark.light));
      thickLine(l, 9, 38 + sway, 4, 44 + sway, 2, () => bark.shadow);
      thickLine(l, 10, 37 + sway, 5, 33 + sway, 2, () => bark.base);
      thickLine(l, 40, 30, 54, 37 - sway, 4, (t) => (t < 0.3 ? bark.shadow : bark.base));
      thickLine(l, 54, 37 - sway, 59, 43 - sway, 2, () => bark.shadow);
      thickLine(l, 53, 36 - sway, 58, 31 - sway, 2, () => bark.base);
      // leaf tufts on hands
      ball(l, 1, 29 + sway, 7, 6, leaf);
      ball(l, 56, 27 - sway, 7, 6, leaf);
    });
    // moss patches
    for (let i = 0; i < 70; i++) {
      const x = 20 + Math.floor(hash2(i, 9, 1) * 24);
      const y = 18 + Math.floor(hash2(9, i, 1) * 12);
      if (getAlpha(img, x, y) > 200 && hash2(x, y, 4) > 0.35) setPixel(img, x, y, hash2(x, y, 5) > 0.6 ? moss.light : moss.base);
    }
    for (let i = 0; i < 18; i++) {
      const x = 19 + Math.floor(hash2(i, 2, 7) * 26);
      const y = 44 + Math.floor(hash2(2, i, 7) * 10);
      if (getAlpha(img, x, y) > 200) setPixel(img, x, y, moss.shadow);
    }
    // face: hollow eye sockets with glowing eyes, mouth
    const eyeC = f ? hex('#d8ff7a') : hex('#b8f060');
    for (const ex of [25, 35]) {
      forEllipse(ex - 1, 31, 6, 5, (x, y) => setPixel(img, x, y, bark.deep));
      setPixel(img, ex + 1, 33, eyeC);
      setPixel(img, ex + 2, 33, eyeC);
      setPixel(img, ex + 1, 32, hex('#f4ffd0'));
      setPixel(img, ex + 2, 34, shade(eyeC, -0.2));
      glow(img, ex + 1.5, 33, 5, eyeC, f ? 140 : 90, true);
    }
    // brow ridge
    for (let x = 23; x <= 41; x++) setPixel(img, x, 29 + (x > 30 && x < 34 ? 1 : 0), bark.shadow);
    // mouth
    for (let x = 27; x <= 37; x++) {
      const y = 42 + (x === 27 || x === 37 ? -1 : 0) + f * (x > 28 && x < 36 ? 1 : 0);
      setPixel(img, x, y, bark.deep);
      setPixel(img, x, y + 1, x % 3 === 0 ? bark.deep : hex('#2a1a12'));
    }
    // nose knot
    setPixel(img, 31, 37, bark.light);
    setPixel(img, 32, 37, bark.base);
    setPixel(img, 32, 38, bark.shadow);
    // little mushrooms on the trunk
    for (const [x, y] of [
      [42, 46],
      [44, 48],
    ] as const) {
      setPixel(img, x, y, hex('#e0503f'));
      setPixel(img, x + 1, y, hex('#b03a32'));
      setPixel(img, x, y + 1, hex('#efe1bf'));
    }
    // fireflies
    for (let i = 0; i < 4; i++) {
      const x = 6 + Math.floor(hash2(i, f, 5) * 52);
      const y = 4 + Math.floor(hash2(f, i, 5) * 22);
      blendPixel(img, x, y, hex('#e8ff9a'), 220);
    }
    return img;
  });
}

const BUILD: Record<MonsterId, { fn: () => PixelImage[]; fps: number; boss: boolean }> = {
  slime: { fn: slime, fps: 6, boss: false },
  forest_goblin: { fn: goblin, fps: 3, boss: false },
  shadow_wisp: { fn: wisp, fps: 6, boss: false },
  corruption_beast: { fn: corruptionBeast, fps: 3, boss: false },
  ancient_treant: { fn: treant, fps: 2, boss: true },
};

export function renderMonster(id: MonsterId): MonsterSprite {
  const b = BUILD[id];
  if (!b) throw new Error(`Unknown monster ${id}`);
  const frames = b.fn();
  const sheet = packSheet(frames, { columns: frames.length });
  const w = frames[0]!.width;
  const h = frames[0]!.height;
  const anchorY = id === 'shadow_wisp' ? h - 2 : id === 'ancient_treant' ? h - 4 : id === 'corruption_beast' ? h - 3 : h - 2;
  return { id, frames, sheet, frameWidth: w, frameHeight: h, fps: b.fps, anchorX: Math.floor(w / 2), anchorY, boss: b.boss };
}
