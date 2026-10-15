/**
 * World and room props. Each prop is a separate image with an anchor at the
 * feet (bottom-centre of where it touches the ground) for y-sorting:
 * draw at (worldX - anchorX, worldY - anchorY) and sort by worldY.
 */
import { type Color, type PixelImage, blendPixel, createImage, getAlpha, setPixel } from './image';
import { P, hash2, hex, mix, ramp, shade, type Ramp } from './palette';
import { ball, box, glow, groundShadow, layer, rect, thickLine } from './draw';
import { packSheet, type SpriteSheet } from './sheet';

export const PROP_NAMES = [
  'house',
  'shop_stall',
  'guild_hall',
  'quest_board',
  'forge_lit',
  'forge_dim',
  'fountain',
  'lamp_post_lit',
  'lamp_post_unlit',
  'tree_0',
  'tree_1',
  'tree_bare',
  'pine_tree',
  'bush',
  'bush_bloom',
  'bush_wilted',
  'flower_pot',
  'crate',
  'barrel',
  'campfire',
  'campfire_weak',
  'bed',
  'desk',
  'bookshelf',
  'plant_pot_thriving',
  'plant_pot_wilted',
  'training_dummy',
  'signpost',
  'rock_0',
  'rock_1',
  'stump',
  'chest_common_closed',
  'chest_common_open',
  'chest_rare_closed',
  'chest_rare_open',
  'chest_epic_closed',
  'chest_epic_open',
] as const;

export type PropName = (typeof PROP_NAMES)[number];

export interface Prop {
  name: PropName;
  /** First frame (same as frames[0]). */
  image: PixelImage;
  /** Animation frames; length 1 for static props. */
  frames: PixelImage[];
  fps: number;
  /** Feet anchor in image pixels. */
  anchorX: number;
  anchorY: number;
}

/* ------------------------------------------------------------------ */

const WOOD = ramp(P.wood);
const DARKWOOD = ramp(hex('#7a4f30'));
const STONE = ramp(hex('#9b98a4'));
const IRON = ramp(hex('#5d6170'));
const GOLD = ramp(P.gold);
const LEAF = ramp(hex('#4f9a44'));
const LEAF2 = ramp(hex('#5fae4a'));
const ROOF = ramp(hex('#c4553e'));
const PLASTER = ramp(hex('#efe1c4'));
const BARK = ramp(hex('#7a5236'));

function mk(w: number, h: number): PixelImage {
  return createImage(w, h);
}

function prop(name: PropName, frames: PixelImage[], ax: number, ay: number, fps = 0): Prop {
  return { name, image: frames[0]!, frames, fps, anchorX: ax, anchorY: ay };
}

/* ---------------------------- buildings --------------------------- */

function windowAt(l: PixelImage, x: number, y: number, w: number, h: number, lit: boolean): void {
  box(l, x, y, w, h, DARKWOOD);
  const glass = lit ? ramp(hex('#ffd98a')) : ramp(hex('#8fc6e8'));
  for (let yy = 1; yy < h - 1; yy++)
    for (let xx = 1; xx < w - 1; xx++) {
      let c = yy < h / 2 ? glass.light : glass.base;
      if (xx + yy < 3) c = glass.hi;
      setPixel(l, x + xx, y + yy, c);
    }
  // mullions
  for (let yy = 1; yy < h - 1; yy++) setPixel(l, x + Math.floor(w / 2), y + yy, DARKWOOD.base);
  for (let xx = 1; xx < w - 1; xx++) setPixel(l, x + xx, y + Math.floor(h / 2), DARKWOOD.base);
}

function flowerBox(l: PixelImage, x: number, y: number, w: number): void {
  box(l, x, y, w, 2, WOOD);
  const cols = [hex('#f08aa8'), hex('#ffd65a'), hex('#fbf6ec')];
  for (let i = 0; i < w; i++) {
    setPixel(l, x + i, y - 1, i % 2 ? LEAF.base : LEAF.light);
    if (i % 2 === 0) setPixel(l, x + i, y - 2, cols[i % 3]!);
  }
}

function shingleRoof(l: PixelImage, x0: number, y0: number, w: number, h: number, r: Ramp, inset = 3): void {
  for (let y = 0; y < h; y++) {
    const t = y / Math.max(1, h - 1);
    const pad = Math.round(inset * (1 - t));
    const row = Math.floor(y / 3);
    for (let x = pad; x < w - pad; x++) {
      const off = row % 2 ? 2 : 0;
      const inRow = y % 3;
      let c = inRow === 0 ? r.light : inRow === 2 ? r.shadow : r.base;
      if ((x + off) % 4 === 0 && inRow > 0) c = r.shadow;
      if (y === h - 1) c = r.deep;
      if (x === pad) c = shade(c, 0.08);
      if (x === w - pad - 1) c = shade(c, -0.12);
      setPixel(l, x0 + x, y0 + y, c);
    }
  }
  // ridge cap
  for (let x = inset; x < w - inset; x++) setPixel(l, x0 + x, y0, r.hi);
}

function house(): Prop {
  const img = mk(48, 48);
  groundShadow(img, 24, 45, 46, 6, 60);
  // walls
  layer(img, (l) => {
    for (let y = 22; y <= 44; y++)
      for (let x = 4; x <= 43; x++) {
        let c = x < 6 ? PLASTER.light : x > 41 ? PLASTER.shadow : PLASTER.base;
        if (hash2(x, y, 4) > 0.94) c = PLASTER.shadow;
        setPixel(l, x, y, c);
      }
    // timber frame
    for (const x of [4, 5, 22, 25, 42, 43]) for (let y = 22; y <= 41; y++) setPixel(l, x, y, x % 2 ? DARKWOOD.shadow : DARKWOOD.base);
    for (const y of [22, 23, 41]) for (let x = 4; x <= 43; x++) setPixel(l, x, y, y === 22 ? DARKWOOD.shadow : DARKWOOD.base);
    for (let i = 0; i < 8; i++) {
      setPixel(l, 6 + i, 33 - i, DARKWOOD.base);
      setPixel(l, 41 - i, 33 - i, DARKWOOD.base);
    }
    // stone foundation
    for (let y = 42; y <= 44; y++)
      for (let x = 4; x <= 43; x++) setPixel(l, x, y, (x + (y % 2) * 3) % 6 === 0 ? STONE.shadow : y === 42 ? STONE.light : STONE.base);
  });
  layer(img, (l) => {
    windowAt(l, 9, 27, 9, 8, true);
    windowAt(l, 30, 27, 9, 8, true);
    flowerBox(l, 8, 36, 11);
    flowerBox(l, 29, 36, 11);
  });
  // door
  layer(img, (l) => {
    for (let y = 30; y <= 44; y++)
      for (let x = 19; x <= 28; x++) {
        if (y === 30 && (x < 21 || x > 26)) continue;
        if (y === 31 && (x < 20 || x > 27)) continue;
        let c = (x - 19) % 3 === 0 ? WOOD.shadow : WOOD.base;
        if (x === 19 || y === 30) c = WOOD.light;
        if (x === 28) c = WOOD.deep;
        setPixel(l, x, y, c);
      }
    setPixel(l, 26, 37, GOLD.light);
    setPixel(l, 26, 38, GOLD.shadow);
  });
  // step
  layer(img, (l) => box(l, 18, 45, 12, 2, STONE), 0.3);
  // roof
  layer(img, (l) => shingleRoof(l, 0, 3, 48, 21, ROOF, 4));
  // chimney
  layer(img, (l) => {
    box(l, 34, 0, 6, 9, ramp(hex('#a39c99')));
    rect(l, 34, 0, 6, 1, hex('#5a5560'));
  });
  return prop('house', [img], 24, 46);
}

function guildHall(): Prop {
  const img = mk(64, 56);
  groundShadow(img, 32, 53, 62, 6, 60);
  const wall = ramp(hex('#cfc4b0'));
  const blueRoof = ramp(hex('#4f6fb3'));
  layer(img, (l) => {
    for (let y = 24; y <= 52; y++)
      for (let x = 3; x <= 60; x++) {
        const row = Math.floor((y - 24) / 4);
        let c = (x + (row % 2) * 4) % 8 === 0 || (y - 24) % 4 === 0 ? wall.shadow : wall.base;
        if (x < 5) c = wall.light;
        if (x > 58) c = wall.deep;
        setPixel(l, x, y, c);
      }
    // columns
    for (const cx of [10, 20, 41, 51]) {
      for (let y = 26; y <= 52; y++) {
        setPixel(l, cx, y, wall.hi);
        setPixel(l, cx + 1, y, wall.light);
        setPixel(l, cx + 2, y, wall.base);
        setPixel(l, cx + 3, y, wall.shadow);
      }
      box(l, cx - 1, 25, 6, 2, wall);
      box(l, cx - 1, 51, 6, 2, wall);
    }
  });
  // big door
  layer(img, (l) => {
    for (let y = 33; y <= 52; y++)
      for (let x = 26; x <= 37; x++) {
        const dy = y - 33;
        const half = 6;
        const dx = x - 31.5;
        if (dy < 4 && Math.abs(dx) > half - (4 - dy)) continue;
        let c = x === 31 || x === 32 ? WOOD.deep : (x - 26) % 3 === 0 ? WOOD.shadow : WOOD.base;
        if (x === 26) c = WOOD.light;
        setPixel(l, x, y, c);
      }
    for (const y of [38, 46]) for (let x = 26; x <= 37; x++) setPixel(l, x, y, IRON.base);
    setPixel(l, 30, 43, GOLD.light);
    setPixel(l, 33, 43, GOLD.light);
  });
  layer(img, (l) => {
    windowAt(l, 14, 30, 5, 9, true);
    windowAt(l, 45, 30, 5, 9, true);
  });
  // banners
  layer(img, (l) => {
    for (const bx of [5, 55]) {
      for (let y = 28; y <= 40; y++)
        for (let x = 0; x < 4; x++) {
          if (y === 40 && (x === 1 || x === 2)) continue;
          setPixel(l, bx + x, y, x === 0 ? hex('#d65a50') : x === 3 ? hex('#9c3330') : hex('#c8463c'));
        }
      setPixel(l, bx + 1, 32, GOLD.light);
      setPixel(l, bx + 2, 32, GOLD.base);
      setPixel(l, bx + 1, 33, GOLD.base);
      setPixel(l, bx + 2, 33, GOLD.shadow);
    }
  });
  // roof + pediment
  layer(img, (l) => {
    shingleRoof(l, 0, 6, 64, 19, blueRoof, 5);
  });
  layer(img, (l) => {
    // crest sign on the roof edge
    box(l, 25, 18, 14, 7, WOOD);
    for (let x = 27; x < 37; x++) setPixel(l, x, 21, x % 2 ? GOLD.base : GOLD.light);
    // tower
    box(l, 27, 0, 10, 8, wall);
    rect(l, 30, 2, 4, 5, hex('#3b3550'));
    setPixel(l, 31, 3, GOLD.light);
  });
  return prop('guild_hall', [img], 32, 53);
}

function shopStall(): Prop {
  const img = mk(32, 32);
  groundShadow(img, 16, 30, 30, 4);
  // posts
  layer(img, (l) => {
    for (const x of [3, 27]) box(l, x, 8, 2, 22, WOOD);
  });
  // counter
  layer(img, (l) => {
    box(l, 2, 20, 28, 10, WOOD);
    for (let x = 2; x < 30; x++) setPixel(l, x, 20, WOOD.hi);
    for (let y = 22; y < 30; y += 3) for (let x = 3; x < 29; x++) setPixel(l, x, y, WOOD.shadow);
  });
  // goods
  layer(img, (l) => {
    for (let i = 0; i < 4; i++) ball(l, 5 + i * 2, 17 + (i % 2), 3, 3, ramp(hex('#d8473f')));
    ball(l, 15, 17, 6, 3, ramp(hex('#d9a35a')));
    ball(l, 21, 17, 6, 3, ramp(hex('#d9a35a')));
    ball(l, 26, 16, 3, 4, ramp(hex('#8fbf4a')));
  }, 0.6);
  // awning
  layer(img, (l) => {
    const red = ramp(hex('#d65a50'));
    const cream = ramp(hex('#f2e6cc'));
    for (let y = 3; y <= 11; y++)
      for (let x = 1; x <= 30; x++) {
        const stripe = Math.floor((x - 1) / 4) % 2 ? cream : red;
        let c = y < 5 ? stripe.light : y > 9 ? stripe.shadow : stripe.base;
        setPixel(l, x, y, c);
      }
    // scalloped edge
    for (let x = 1; x <= 30; x++) {
      const stripe = Math.floor((x - 1) / 4) % 2 ? cream : red;
      if ((x - 1) % 4 !== 0) setPixel(l, x, 12, stripe.shadow);
      if ((x - 1) % 4 === 1 || (x - 1) % 4 === 2) setPixel(l, x, 13, stripe.deep);
    }
  });
  return prop('shop_stall', [img], 16, 30);
}

function questBoard(): Prop {
  const img = mk(24, 24);
  groundShadow(img, 12, 22, 20, 3);
  layer(img, (l) => {
    for (const x of [3, 19]) box(l, x, 6, 2, 17, WOOD);
  });
  layer(img, (l) => {
    box(l, 2, 6, 20, 12, DARKWOOD);
    for (let y = 7; y < 17; y++) for (let x = 3; x < 21; x++) setPixel(l, x, y, (y % 3 === 0 ? WOOD.shadow : WOOD.base));
  });
  layer(img, (l) => {
    const paper = ramp(hex('#f4ead2'));
    const notes: [number, number, number, number][] = [
      [4, 8, 5, 6],
      [10, 9, 5, 5],
      [15, 8, 5, 7],
    ];
    for (const [x, y, w, h] of notes) {
      box(l, x, y, w, h, paper);
      for (let yy = y + 2; yy < y + h - 1; yy += 2) for (let xx = x + 1; xx < x + w - 1; xx++) setPixel(l, xx, yy, hex('#b8a888'));
      setPixel(l, x + Math.floor(w / 2), y, hex('#d8473f'));
    }
  }, 0.7);
  // little roof
  layer(img, (l) => {
    for (let y = 2; y <= 5; y++)
      for (let x = 1 + (5 - y); x <= 22 - (5 - y); x++) setPixel(l, x, y, y === 5 ? ROOF.shadow : y === 2 ? ROOF.light : ROOF.base);
  });
  // exclamation
  layer(img, (l) => {
    rect(l, 11, 0, 2, 2, GOLD.light);
  }, 0);
  return prop('quest_board', [img], 12, 22);
}

function forge(lit: boolean): Prop {
  const img = mk(32, 32);
  groundShadow(img, 15, 30, 30, 4);
  const brick = ramp(hex('#8c7f7a'));
  // chimney
  layer(img, (l) => box(l, 6, 1, 8, 10, brick));
  // furnace body
  layer(img, (l) => {
    for (let y = 9; y <= 29; y++)
      for (let x = 2; x <= 19; x++) {
        const row = Math.floor((y - 9) / 3);
        let c = (x + (row % 2) * 2) % 5 === 0 || (y - 9) % 3 === 2 ? brick.shadow : brick.base;
        if (x === 2) c = brick.light;
        if (x === 19) c = brick.deep;
        setPixel(l, x, y, c);
      }
    // arched opening
    for (let y = 17; y <= 27; y++)
      for (let x = 6; x <= 15; x++) {
        const dy = y - 17;
        if (dy < 3 && Math.abs(x - 10.5) > 5 - (3 - dy) * 1.2) continue;
        let c = hex('#2a1a22');
        if (lit) {
          if (y >= 24) c = (x + y) % 2 ? hex('#ffcf5a') : hex('#ff8a3a');
          else if (y >= 21) c = hex('#c8402e');
          else c = hex('#5a2026');
        } else if (y >= 25) c = (x + y) % 3 === 0 ? hex('#a83a2a') : hex('#4a2226');
        setPixel(l, x, y, c);
      }
  });
  // anvil
  layer(img, (l) => {
    box(l, 21, 21, 10, 3, IRON);
    for (let x = 21; x < 31; x++) setPixel(l, x, 21, ramp(hex('#8a90a0')).light);
    box(l, 24, 24, 4, 3, IRON);
    box(l, 22, 27, 8, 2, IRON);
  });
  if (lit) {
    glow(img, 10.5, 25, 9, hex('#ffb347'), 110);
    glow(img, 10, 0, 4, hex('#c8c0c8'), 60);
    // sparks
    setPixel(img, 9, 15, hex('#ffd65a'));
    setPixel(img, 13, 13, hex('#ffb347'));
  } else {
    blendPixel(img, 10, 0, hex('#9a9aa6'), 80);
  }
  return prop(lit ? 'forge_lit' : 'forge_dim', [img], 16, 30);
}

function fountain(): Prop {
  const frames = [0, 1].map((f) => {
    const img = mk(48, 40);
    groundShadow(img, 24, 36, 46, 6);
    const st = ramp(hex('#b8b4bc'));
    // basin outer rim (ellipse) and inner water
    layer(img, (l) => {
      ball(l, 2, 18, 44, 20, st, 0.2);
    });
    const w = ramp(P.water);
    for (let y = 21; y <= 33; y++)
      for (let x = 6; x <= 41; x++) {
        const nx = (x + 0.5 - 24) / 18;
        const ny = (y + 0.5 - 27) / 6.5;
        if (nx * nx + ny * ny > 1) continue;
        let c = w.base;
        if (ny < -0.5) c = w.shadow;
        const ring = Math.abs(Math.hypot(nx, ny * 1.2) - (f ? 0.55 : 0.75));
        if (ring < 0.06) c = w.light;
        if (hash2(x, y, f + 3) > 0.95) c = P.waterLight;
        setPixel(img, x, y, c);
      }
    // pillar + top bowl
    layer(img, (l) => {
      box(l, 21, 12, 6, 16, st);
      ball(l, 15, 9, 18, 6, st);
    });
    // water in top bowl + spray
    for (let x = 18; x <= 29; x++) setPixel(img, x, 11, w.light);
    const drops: [number, number][] = f
      ? [
          [14, 13],
          [33, 13],
          [13, 17],
          [34, 18],
          [24, 3],
          [23, 5],
        ]
      : [
          [15, 12],
          [32, 12],
          [13, 15],
          [34, 15],
          [24, 5],
          [25, 7],
        ];
    for (const [x, y] of drops) {
      setPixel(img, x, y, P.waterLight);
      setPixel(img, x, y + 1, w.base);
    }
    for (let y = 5; y < 10; y++) setPixel(img, 24, y, y % 2 === f ? P.foam : P.waterLight);
    return img;
  });
  return prop('fountain', frames, 24, 37, 4);
}

function lampPost(lit: boolean): Prop {
  const img = mk(8, 24);
  groundShadow(img, 4, 23, 7, 2);
  layer(img, (l) => {
    box(l, 3, 7, 2, 15, IRON);
    box(l, 2, 21, 4, 2, IRON);
  });
  layer(img, (l) => {
    // lantern head
    box(l, 1, 1, 6, 1, IRON);
    const glass = lit ? ramp(hex('#ffd36a')) : ramp(hex('#56607a'));
    for (let y = 2; y <= 5; y++)
      for (let x = 2; x <= 5; x++) setPixel(l, x, y, x === 2 || y === 2 ? glass.light : glass.base);
    if (lit) setPixel(l, 3, 3, glass.hi);
    box(l, 2, 6, 4, 1, IRON);
    setPixel(l, 4, 0, IRON.light);
  });
  if (lit) glow(img, 4, 4, 5, hex('#ffd36a'), 90);
  return prop(lit ? 'lamp_post_lit' : 'lamp_post_unlit', [img], 4, 22);
}

/* ------------------------------ nature ---------------------------- */

function canopy(l: PixelImage, clumps: [number, number, number][], r: Ramp, seed: number): void {
  for (const [cx, cy, rad] of clumps) ball(l, cx - rad, cy - rad, rad * 2, rad * 2, r);
  // leaf texture: small darker crescents
  for (let i = 0; i < 40; i++) {
    const x = Math.floor(hash2(i, seed, 1) * l.width);
    const y = Math.floor(hash2(seed, i, 2) * l.height);
    if (getAlpha(l, x, y) && getAlpha(l, x + 1, y) && getAlpha(l, x, y + 1)) {
      setPixel(l, x, y + 1, r.shadow);
      setPixel(l, x + 1, y, r.shadow);
    }
  }
}

function tree(variant: 0 | 1 | 'bare'): Prop {
  const img = mk(32, 48);
  groundShadow(img, 16, 45, 24, 5);
  // trunk
  layer(img, (l) => {
    for (let y = 26; y <= 45; y++) {
      const w = y > 42 ? 8 : 6;
      const x0 = 16 - w / 2;
      for (let x = 0; x < w; x++) setPixel(l, x0 + x, y, x === 0 ? BARK.light : x >= w - 2 ? BARK.shadow : hash2(x, y, 1) > 0.85 ? BARK.shadow : BARK.base);
    }
    if (variant === 'bare') {
      thickLine(l, 15, 28, 7, 14, 2, () => BARK.base);
      thickLine(l, 17, 26, 25, 12, 2, () => BARK.shadow);
      thickLine(l, 15, 22, 15, 6, 2, () => BARK.base);
      thickLine(l, 9, 17, 4, 12, 1, () => BARK.base);
      thickLine(l, 23, 15, 28, 9, 1, () => BARK.shadow);
      thickLine(l, 16, 10, 20, 4, 1, () => BARK.base);
      thickLine(l, 15, 12, 11, 5, 1, () => BARK.base);
    }
  });
  if (variant !== 'bare') {
    const r = variant === 0 ? LEAF : LEAF2;
    layer(img, (l) => {
      const clumps: [number, number, number][] =
        variant === 0
          ? [
              [16, 13, 11],
              [8, 20, 7],
              [24, 20, 7],
              [12, 26, 6],
              [21, 26, 6],
            ]
          : [
              [16, 10, 9],
              [9, 17, 7],
              [23, 17, 7],
              [16, 22, 8],
            ];
      canopy(l, clumps, r, variant === 0 ? 5 : 9);
    });
    if (variant === 1) {
      // apples
      for (const [x, y] of [
        [10, 15],
        [21, 13],
        [17, 22],
        [25, 20],
        [7, 21],
      ] as const) {
        setPixel(img, x, y, hex('#e0483f'));
        setPixel(img, x + 1, y, hex('#b02e35'));
        setPixel(img, x, y - 1, hex('#ff9a8a'));
      }
    }
  }
  const name = variant === 'bare' ? 'tree_bare' : variant === 0 ? 'tree_0' : 'tree_1';
  return prop(name, [img], 16, 45);
}

function pine(): Prop {
  const img = mk(24, 40);
  groundShadow(img, 12, 37, 18, 4);
  layer(img, (l) => box(l, 10, 30, 4, 8, BARK));
  const r = ramp(hex('#2f7a55'));
  layer(img, (l) => {
    const tiers: [number, number, number][] = [
      [3, 12, 20],
      [10, 10, 26],
      [17, 9, 32],
    ];
    for (let ti = tiers.length - 1; ti >= 0; ti--) {
      const [, , bottom] = tiers[ti]!;
      const top = ti === 0 ? 1 : tiers[ti]![0];
      for (let y = top; y <= bottom; y++) {
        const t = (y - top) / (bottom - top);
        const half = 2 + t * (ti === 0 ? 7 : ti === 1 ? 9 : 10.5);
        for (let x = Math.round(12 - half); x <= Math.round(11 + half); x++) {
          const nx = (x - 11.5) / half;
          let c = nx < -0.4 ? r.light : nx > 0.45 ? r.shadow : r.base;
          if (y === bottom || (y === bottom - 1 && (x % 3 === 0))) c = r.deep;
          if (nx < -0.7 && y < bottom - 1) c = r.hi;
          setPixel(l, x, y, c);
        }
      }
    }
  });
  return prop('pine_tree', [img], 12, 37);
}

function bush(kind: 'bush' | 'bush_bloom' | 'bush_wilted'): Prop {
  const img = mk(16, 16);
  groundShadow(img, 8, 14, 14, 3);
  const r = kind === 'bush_wilted' ? ramp(hex('#8f8a4a')) : ramp(hex('#4a9a48'));
  layer(img, (l) => {
    ball(l, 1, 5, 9, 9, r);
    ball(l, 6, 4, 9, 10, r);
    ball(l, 3, 2, 10, 9, r);
    if (kind === 'bush_wilted') {
      // droop + bare twigs
      for (const [x, y] of [
        [4, 2],
        [11, 3],
        [8, 1],
      ] as const)
        setPixel(l, x, y - 1, hex('#6e4a33'));
    }
  });
  if (kind === 'bush_bloom')
    for (const [x, y, c] of [
      [4, 6, '#f59ab5'],
      [9, 5, '#fbf6ec'],
      [11, 9, '#f59ab5'],
      [6, 10, '#ffd65a'],
      [8, 3, '#f59ab5'],
    ] as const) {
      setPixel(img, x, y, hex(c));
      setPixel(img, x + 1, y, shade(hex(c), -0.2));
      setPixel(img, x, y - 1, shade(hex(c), 0.2));
    }
  if (kind === 'bush_wilted')
    for (let i = 0; i < 6; i++) setPixel(img, 3 + Math.floor(hash2(i, 1, 1) * 10), 4 + Math.floor(hash2(1, i, 1) * 8), hex('#a0703a'));
  return prop(kind, [img], 8, 14);
}

function terracottaPot(l: PixelImage, x: number, y: number, w: number, h: number): void {
  const t = ramp(hex('#c2673f'));
  box(l, x, y, w, 2, t);
  for (let yy = 2; yy < h; yy++) {
    const inset = yy > h - 3 ? 1 : 0;
    for (let xx = inset; xx < w - inset; xx++) setPixel(l, x + xx, y + yy, xx === inset ? t.light : xx >= w - inset - 1 ? t.shadow : t.base);
  }
}

function flowerPot(): Prop {
  const img = mk(16, 16);
  groundShadow(img, 8, 15, 10, 2);
  layer(img, (l) => {
    for (const [x, y] of [
      [5, 4],
      [8, 2],
      [11, 5],
    ] as const) {
      thickLine(l, x, y + 2, 8, 9, 1, () => LEAF.shadow);
    }
  });
  layer(img, (l) => {
    for (const [x, y, c] of [
      [4, 3, '#f59ab5'],
      [7, 1, '#ffd65a'],
      [10, 4, '#f08a5a'],
    ] as const) ball(l, x, y, 3, 3, ramp(hex(c)));
  }, 0.6);
  layer(img, (l) => terracottaPot(l, 4, 9, 8, 6));
  return prop('flower_pot', [img], 8, 15);
}

function plantPot(thriving: boolean): Prop {
  const img = mk(16, 16);
  groundShadow(img, 8, 15, 10, 2);
  if (thriving) {
    layer(img, (l) => {
      const r = ramp(hex('#4f9a44'));
      ball(l, 2, 3, 6, 5, r);
      ball(l, 8, 2, 6, 5, r);
      ball(l, 5, 0, 6, 6, r);
      ball(l, 4, 5, 8, 5, r);
    });
  } else {
    layer(img, (l) => {
      const r = ramp(hex('#9a8a4a'));
      thickLine(l, 8, 9, 8, 4, 1, () => hex('#7a6a3a'));
      thickLine(l, 8, 5, 4, 8, 1, () => r.base);
      thickLine(l, 8, 4, 12, 7, 1, () => r.shadow);
      setPixel(l, 3, 9, hex('#a0703a'));
      setPixel(l, 12, 8, hex('#a0703a'));
    });
  }
  layer(img, (l) => terracottaPot(l, 4, 9, 8, 6));
  return prop(thriving ? 'plant_pot_thriving' : 'plant_pot_wilted', [img], 8, 15);
}

function crate(): Prop {
  const img = mk(16, 16);
  groundShadow(img, 8, 15, 15, 2);
  layer(img, (l) => {
    // top face
    box(l, 1, 2, 14, 4, ramp(hex('#c9955a')));
    // front face
    box(l, 1, 6, 14, 9, WOOD);
    for (let i = 0; i < 9; i++) {
      setPixel(l, 2 + Math.round(i * 1.4), 14 - i, DARKWOOD.base);
    }
    for (let x = 1; x < 15; x++) setPixel(l, x, 10, WOOD.shadow);
  });
  return prop('crate', [img], 8, 15);
}

function barrel(): Prop {
  const img = mk(16, 16);
  groundShadow(img, 8, 15, 12, 2);
  layer(img, (l) => {
    for (let y = 2; y <= 14; y++) {
      const bulge = y > 4 && y < 12 ? 1 : 0;
      for (let x = 3 - bulge; x <= 12 + bulge; x++) {
        const nx = (x - 7.5) / 5.5;
        let c = nx < -0.5 ? WOOD.light : nx > 0.5 ? WOOD.shadow : WOOD.base;
        if ((x - 3) % 3 === 2) c = shade(c, -0.1);
        if (y === 4 || y === 11) c = nx < -0.5 ? IRON.light : IRON.base;
        setPixel(l, x, y, c);
      }
    }
    // lid
    for (let x = 4; x <= 11; x++) {
      setPixel(l, x, 1, WOOD.hi);
      setPixel(l, x, 2, ramp(hex('#c9955a')).base);
    }
  });
  return prop('barrel', [img], 8, 15);
}

function campfire(weak: boolean): Prop {
  const frameCount = weak ? 2 : 3;
  const frames = Array.from({ length: frameCount }, (_, f) => {
    const img = mk(16, 16);
    groundShadow(img, 8, 13, 14, 4, 50);
    layer(img, (l) => {
      // logs
      thickLine(l, 3, 13, 12, 10, 2, (t) => (t < 0.15 ? hex('#e9c9a0') : BARK.base));
      thickLine(l, 3, 10, 12, 13, 2, (t) => (t > 0.85 ? hex('#e9c9a0') : BARK.shadow));
    });
    layer(img, (l) => {
      // stone ring
      for (const [x, y] of [
        [1, 12],
        [4, 14],
        [9, 14],
        [13, 12],
        [12, 9],
        [2, 9],
      ] as const)
        box(l, x, y, 2, 2, STONE);
    });
    const flame = (h: number, sway: number) => {
      for (let y = 0; y < h; y++) {
        const t = y / h;
        const half = Math.max(0, Math.round((1 - t) * 3.2 - (t > 0.7 ? 0.5 : 0)));
        const cx = 8 + Math.round(Math.sin(t * 3 + f * 2.1) * sway * t);
        for (let x = cx - half; x <= cx + half - 1; x++) {
          const edge = x === cx - half || x === cx + half - 1;
          const c = t > 0.65 ? hex('#ff6a3a') : edge ? hex('#ff8a3a') : t < 0.35 ? hex('#fff1a8') : hex('#ffc94a');
          setPixel(img, x, 11 - y, c);
        }
      }
    };
    if (weak) {
      flame(3 + f, 0.5);
      for (const [x, y] of [
        [6, 11],
        [9, 11],
      ] as const)
        setPixel(img, x, y, hex('#ff6a3a'));
      setPixel(img, 7 + f, 5 - f, hex('#7a7488'));
    } else {
      flame([9, 10, 8][f]!, 1.5);
      glow(img, 8, 8, 8, hex('#ffb347'), 70);
      setPixel(img, [5, 11, 7][f]!, [3, 2, 1][f]!, hex('#ffd65a'));
    }
    return img;
  });
  return prop(weak ? 'campfire_weak' : 'campfire', frames, 8, 14, weak ? 4 : 8);
}

function rock(v: 0 | 1): Prop {
  const img = v === 0 ? mk(16, 16) : mk(16, 12);
  groundShadow(img, 8, img.height - 2, 14, 3);
  const r = ramp(hex('#9a98a6'));
  layer(img, (l) => {
    if (v === 0) {
      ball(l, 1, 4, 14, 10, r);
      ball(l, 3, 2, 8, 7, r, 0.2);
      setPixel(l, 9, 9, r.deep);
      setPixel(l, 10, 10, r.deep);
      setPixel(l, 4, 11, P.moss);
      setPixel(l, 5, 11, P.moss);
    } else {
      ball(l, 2, 3, 12, 7, r);
      setPixel(l, 7, 6, r.deep);
    }
  });
  return prop(v === 0 ? 'rock_0' : 'rock_1', [img], 8, img.height - 2);
}

function stump(): Prop {
  const img = mk(16, 16);
  groundShadow(img, 8, 14, 14, 3);
  layer(img, (l) => {
    for (let y = 7; y <= 13; y++)
      for (let x = 3; x <= 12; x++) setPixel(l, x, y, x === 3 ? BARK.light : x >= 11 ? BARK.shadow : (x + y) % 4 === 0 ? BARK.shadow : BARK.base);
    // roots
    setPixel(l, 2, 13, BARK.base);
    setPixel(l, 13, 13, BARK.shadow);
    setPixel(l, 1, 14, BARK.shadow);
    // top rings
    const top = ramp(hex('#d9b07a'));
    for (let y = 4; y <= 8; y++)
      for (let x = 3; x <= 12; x++) {
        const nx = (x + 0.5 - 8) / 5;
        const ny = (y + 0.5 - 6.5) / 2.5;
        const d = nx * nx + ny * ny;
        if (d > 1) continue;
        setPixel(l, x, y, Math.abs(Math.sqrt(d) - 0.55) < 0.15 ? top.shadow : d > 0.8 ? top.shadow : top.base);
      }
    setPixel(l, 7, 6, top.deep);
  });
  return prop('stump', [img], 8, 14);
}

function bed(): Prop {
  const img = mk(20, 32);
  groundShadow(img, 10, 30, 20, 3, 50);
  layer(img, (l) => {
    // headboard
    box(l, 1, 1, 18, 7, DARKWOOD);
    for (let x = 3; x < 17; x += 3) for (let y = 3; y < 7; y++) setPixel(l, x, y, DARKWOOD.shadow);
    // frame
    box(l, 1, 6, 18, 24, WOOD);
  });
  layer(img, (l) => {
    // mattress + pillow
    box(l, 2, 7, 16, 21, ramp(hex('#f2ead8')));
    ball(l, 4, 8, 12, 5, ramp(hex('#fbf6ec')));
  }, 0.6);
  layer(img, (l) => {
    // quilt
    const q = ramp(hex('#4a78b8'));
    for (let y = 14; y <= 28; y++)
      for (let x = 2; x <= 17; x++) {
        let c = (Math.floor((x - 2) / 4) + Math.floor((y - 14) / 4)) % 2 ? q.base : q.light;
        if (y === 14) c = hex('#fbf6ec');
        if (x === 17 || y === 28) c = q.shadow;
        setPixel(l, x, y, c);
      }
  }, 0.6);
  return prop('bed', [img], 10, 30);
}

function desk(): Prop {
  const img = mk(32, 24);
  groundShadow(img, 16, 22, 30, 3, 50);
  layer(img, (l) => {
    // legs
    box(l, 2, 12, 2, 10, DARKWOOD);
    box(l, 28, 12, 2, 10, DARKWOOD);
    // drawer panel
    box(l, 18, 12, 10, 6, WOOD);
    setPixel(l, 22, 14, GOLD.light);
    setPixel(l, 23, 14, GOLD.base);
  });
  layer(img, (l) => {
    // desk top (3/4 view: top surface + front edge)
    box(l, 1, 7, 30, 4, ramp(hex('#c9955a')));
    box(l, 1, 11, 30, 2, WOOD);
  });
  layer(img, (l) => {
    // stacked books
    const cols = ['#c8463c', '#4a6fc2', '#5f9e45', '#e8b04a'];
    cols.forEach((c, i) => box(l, 3 + (i % 2), 6 - i * 2, 8, 2, ramp(hex(c))));
    // open book
    box(l, 14, 6, 5, 3, ramp(hex('#f4ead2')));
    box(l, 19, 6, 5, 3, ramp(hex('#e8dcc0')));
    for (let x = 15; x < 23; x += 2) setPixel(l, x, 7, hex('#9a8a6a'));
  }, 0.6);
  layer(img, (l) => {
    // candle
    box(l, 26, 3, 2, 4, ramp(hex('#f4ead2')));
    setPixel(l, 26, 2, hex('#ffd65a'));
    setPixel(l, 26, 1, hex('#ff8a3a'));
  }, 0.6);
  glow(img, 26.5, 2, 3.5, hex('#ffd36a'), 80);
  return prop('desk', [img], 16, 22);
}

function bookshelf(): Prop {
  const img = mk(24, 32);
  groundShadow(img, 12, 31, 24, 3, 50);
  layer(img, (l) => {
    box(l, 1, 1, 22, 30, DARKWOOD);
    for (const sy of [2, 11, 20]) rect(l, 3, sy, 18, 8, hex('#3a2a26'));
  });
  layer(img, (l) => {
    const cols = ['#c8463c', '#4a6fc2', '#5f9e45', '#e8b04a', '#8a5ab8', '#d9c49a', '#2f8f8a'];
    [2, 11, 20].forEach((sy, si) => {
      let x = 3;
      let i = si * 3;
      while (x < 20) {
        const w = 2 + Math.floor(hash2(i, si, 1) * 2);
        const h = 6 + Math.floor(hash2(si, i, 2) * 2);
        if (x + w > 21) break;
        const r = ramp(hex(cols[i % cols.length]!));
        const lean = hash2(i, 7, 3) > 0.85;
        for (let yy = 0; yy < h; yy++)
          for (let xx = 0; xx < w; xx++) setPixel(l, x + xx + (lean && yy < 2 ? 1 : 0), sy + 8 - h + yy, xx === 0 ? r.light : xx === w - 1 ? r.shadow : r.base);
        setPixel(l, x, sy + 8 - h + 2, GOLD.light);
        x += w;
        i++;
      }
    });
  }, 0.7);
  return prop('bookshelf', [img], 12, 31);
}

function trainingDummy(): Prop {
  const img = mk(16, 24);
  groundShadow(img, 8, 22, 12, 3);
  layer(img, (l) => box(l, 7, 8, 2, 15, WOOD));
  const straw = ramp(hex('#e0c068'));
  layer(img, (l) => {
    // arms crossbar
    box(l, 1, 10, 14, 2, WOOD);
    // straw body
    for (let y = 9; y <= 17; y++)
      for (let x = 4; x <= 11; x++) setPixel(l, x, y, (x + y) % 3 === 0 ? straw.shadow : x < 6 ? straw.light : straw.base);
    for (let x = 4; x <= 11; x++) setPixel(l, x, 13, hex('#7a4f30'));
  });
  layer(img, (l) => {
    // target
    ball(l, 5, 10, 6, 6, ramp(hex('#f2e6cc')));
    ball(l, 6, 11, 4, 4, ramp(hex('#d8473f')));
    setPixel(l, 7, 12, hex('#f2e6cc'));
    setPixel(l, 8, 13, hex('#f2e6cc'));
  }, 0.7);
  layer(img, (l) => {
    // sack head
    ball(l, 4, 1, 8, 8, ramp(hex('#d9bf8c')));
    setPixel(l, 6, 4, hex('#3a2a26'));
    setPixel(l, 9, 4, hex('#3a2a26'));
    for (let x = 6; x <= 9; x++) setPixel(l, x, 6, hex('#9a7a52'));
  });
  return prop('training_dummy', [img], 8, 22);
}

function signpost(): Prop {
  const img = mk(16, 24);
  groundShadow(img, 8, 22, 8, 2);
  layer(img, (l) => box(l, 7, 4, 2, 19, WOOD));
  layer(img, (l) => {
    const sign = ramp(hex('#c9955a'));
    // arrow board pointing right
    for (let y = 5; y <= 9; y++)
      for (let x = 1; x <= 13; x++) {
        if (x > 11 && Math.abs(y - 7) > 13 - x) continue;
        setPixel(l, x, y, y === 5 ? sign.light : y === 9 ? sign.shadow : sign.base);
      }
    for (let y = 12; y <= 15; y++)
      for (let x = 2; x <= 13; x++) {
        if (x < 4 && Math.abs(y - 13.5) > x - 2) continue;
        setPixel(l, x, y, y === 12 ? sign.light : y === 15 ? sign.shadow : sign.base);
      }
    for (let x = 4; x < 10; x += 2) setPixel(l, x, 7, DARKWOOD.shadow);
    for (let x = 6; x < 12; x += 2) setPixel(l, x, 14, DARKWOOD.shadow);
  });
  return prop('signpost', [img], 8, 22);
}

const CHEST_TIERS = {
  common: { body: ramp(hex('#a8703f')), band: ramp(hex('#7d8796')), glow: hex('#ffe9a8') },
  rare: { body: ramp(hex('#3f63b5')), band: ramp(hex('#cfd6e2')), glow: hex('#9fe6ff') },
  epic: { body: ramp(hex('#6a3fa8')), band: ramp(hex('#f2c14e')), glow: hex('#f0b8ff') },
} as const;

function chest(tier: keyof typeof CHEST_TIERS, open: boolean): Prop {
  const img = mk(16, 16);
  const t = CHEST_TIERS[tier];
  groundShadow(img, 8, 15, 15, 2);
  if (open) {
    // raised lid behind
    layer(img, (l) => {
      box(l, 2, 1, 12, 5, t.body);
      for (let y = 1; y < 6; y++) setPixel(l, 7, y, t.band.base);
      setPixel(l, 8, 1, t.band.light);
    });
  }
  layer(img, (l) => {
    if (!open) {
      // domed lid
      for (let y = 4; y <= 8; y++)
        for (let x = 1; x <= 14; x++) {
          if (y === 4 && (x < 3 || x > 12)) continue;
          let c = y === 4 ? t.body.light : y === 8 ? t.body.shadow : t.body.base;
          if (x === 1 || x === 14) c = t.body.shadow;
          setPixel(l, x, y, c);
        }
    } else {
      // open interior
      box(l, 1, 6, 14, 3, ramp(hex('#3a2430')));
    }
    // body
    for (let y = 9; y <= 14; y++)
      for (let x = 1; x <= 14; x++) {
        let c = y === 9 ? t.body.light : y === 14 ? t.body.deep : t.body.base;
        if (x === 1) c = t.body.light;
        if (x === 14) c = t.body.shadow;
        setPixel(l, x, y, c);
      }
    for (const bx of [3, 12]) for (let y = open ? 9 : 4; y <= 14; y++) setPixel(l, bx, y, y % 2 ? t.band.base : t.band.light);
    for (let x = 1; x <= 14; x++) setPixel(l, x, 9, t.band.shadow);
  });
  layer(img, (l) => {
    // lock
    box(l, 7, open ? 9 : 8, 2, 3, ramp(hex('#f2c14e')));
  }, 0.4);
  if (open) {
    for (const [x, y] of [
      [5, 6],
      [8, 5],
      [11, 6],
      [7, 7],
    ] as const)
      setPixel(img, x, y, t.glow);
    glow(img, 8, 5, 7, t.glow, 110, true);
  } else if (tier !== 'common') {
    setPixel(img, 4, 5, 0xffffff);
  }
  return prop(`chest_${tier}_${open ? 'open' : 'closed'}` as PropName, [img], 8, 15);
}

/* ------------------------------------------------------------------ */

const BUILDERS: Record<PropName, () => Prop> = {
  house,
  shop_stall: shopStall,
  guild_hall: guildHall,
  quest_board: questBoard,
  forge_lit: () => forge(true),
  forge_dim: () => forge(false),
  fountain,
  lamp_post_lit: () => lampPost(true),
  lamp_post_unlit: () => lampPost(false),
  tree_0: () => tree(0),
  tree_1: () => tree(1),
  tree_bare: () => tree('bare'),
  pine_tree: pine,
  bush: () => bush('bush'),
  bush_bloom: () => bush('bush_bloom'),
  bush_wilted: () => bush('bush_wilted'),
  flower_pot: flowerPot,
  crate,
  barrel,
  campfire: () => campfire(false),
  campfire_weak: () => campfire(true),
  bed,
  desk,
  bookshelf,
  plant_pot_thriving: () => plantPot(true),
  plant_pot_wilted: () => plantPot(false),
  training_dummy: trainingDummy,
  signpost,
  rock_0: () => rock(0),
  rock_1: () => rock(1),
  stump,
  chest_common_closed: () => chest('common', false),
  chest_common_open: () => chest('common', true),
  chest_rare_closed: () => chest('rare', false),
  chest_rare_open: () => chest('rare', true),
  chest_epic_closed: () => chest('epic', false),
  chest_epic_open: () => chest('epic', true),
};

export function renderProp(name: PropName): Prop {
  const b = BUILDERS[name];
  if (!b) throw new Error(`Unknown prop ${name}`);
  return b();
}

export function renderAllProps(): Record<PropName, Prop> {
  const out = {} as Record<PropName, Prop>;
  for (const n of PROP_NAMES) out[n] = renderProp(n);
  return out;
}

/** Packs every frame of one animated prop into a horizontal strip. */
export function propSheet(p: Prop): SpriteSheet {
  return packSheet(p.frames, { columns: p.frames.length });
}

void (null as unknown as Color);
void mix;
