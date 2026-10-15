/**
 * 16×16 ground / wall / decoration tiles in a single tileset sheet.
 * All textures are seeded and wrap at tile edges, so tiles repeat seamlessly.
 */
import { type Color, type PixelImage, blendPixel, blit, createImage, fillRect, getAlpha, setPixel } from './image';
import { P, compositeOutlined, desaturate, hash2, hex, mix, ramp, shade, type Ramp } from './palette';
import { packSheet, type SpriteSheet } from './sheet';

export const TILE_SIZE = 16;

/** Path/shore connection bits: which neighbours share the same terrain. */
export const DIR_BITS = { n: 1, e: 2, s: 4, w: 8 } as const;

const PATH_NAMES = Array.from({ length: 16 }, (_, m) => `dirt_path_${m}` as const);
type PathName = (typeof PATH_NAMES)[number];

export const TILE_NAMES = [
  'grass_0',
  'grass_1',
  'grass_2',
  'grass_3',
  'grass_flowers_0',
  'grass_flowers_1',
  'grass_flowers_0_wilted',
  'grass_flowers_1_wilted',
  'tall_grass',
  'tall_grass_wilted',
  'dirt',
  ...PATH_NAMES,
  'cobblestone_0',
  'cobblestone_1',
  'plaza_tile',
  'water_0',
  'water_1',
  'shore_n',
  'shore_e',
  'shore_s',
  'shore_w',
  'shore_ne',
  'shore_nw',
  'shore_se',
  'shore_sw',
  'shore_inner_ne',
  'shore_inner_nw',
  'shore_inner_se',
  'shore_inner_sw',
  'sand',
  'wooden_floor',
  'rug_nw',
  'rug_n',
  'rug_ne',
  'rug_w',
  'rug_c',
  'rug_e',
  'rug_sw',
  'rug_s',
  'rug_se',
  'stone_wall_top',
  'stone_wall_face',
  'wood_wall_top',
  'wood_wall_face',
  'fence_h',
  'fence_v',
  'fence_post',
  'hedge',
  'hedge_wilted',
  'dark_forest_floor_0',
  'dark_forest_floor_1',
  'mushrooms',
  'bridge_h',
  'bridge_v',
] as const;

export type TileName = (typeof TILE_NAMES)[number];

/** Tiles with transparent pixels, meant to be layered over a ground tile. */
export const OVERLAY_TILES: readonly TileName[] = [
  'fence_h',
  'fence_v',
  'fence_post',
  'mushrooms',
  'tall_grass',
  'tall_grass_wilted',
  'rug_nw',
  'rug_n',
  'rug_ne',
  'rug_w',
  'rug_c',
  'rug_e',
  'rug_sw',
  'rug_s',
  'rug_se',
];

/** Convenience aliases into the 16 path autotiles. */
export const PATH_ALIASES = {
  dirt_path_h: 'dirt_path_10',
  dirt_path_v: 'dirt_path_5',
  dirt_path_cross: 'dirt_path_15',
  dirt_path_end_n: 'dirt_path_4',
  dirt_path_end_e: 'dirt_path_8',
  dirt_path_end_s: 'dirt_path_1',
  dirt_path_end_w: 'dirt_path_2',
  dirt_path_single: 'dirt_path_0',
} as const satisfies Record<string, PathName>;

/** Returns the dirt path autotile name for a 4-neighbour mask (n=1,e=2,s=4,w=8). */
export function pathTileFor(mask: number): TileName {
  return `dirt_path_${mask & 15}` as TileName;
}

/* ------------------------------------------------------------------ */

const S = TILE_SIZE;
const wrap = (v: number) => ((v % S) + S) % S;

function put(img: PixelImage, x: number, y: number, c: Color, a = 255): void {
  if (a >= 255) setPixel(img, wrap(x), wrap(y), c);
  else blendPixel(img, wrap(x), wrap(y), c, a);
}

const G = ramp(P.grass);

function grassBase(img: PixelImage, seed: number, wilt = 0): void {
  const base = wilt ? mix(G.base, hex('#b0a25a'), wilt) : G.base;
  const dark = wilt ? mix(G.shadow, hex('#8a7a45'), wilt) : G.shadow;
  const light = wilt ? mix(G.light, hex('#d0c27a'), wilt) : G.light;
  fillRect(img, 0, 0, S, S, base);
  // soft mottling
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const h = hash2(x >> 2, y >> 2, seed + 91) * 0.6 + hash2(x, y, seed) * 0.4;
      if (h > 0.78) put(img, x, y, mix(base, light, 0.35));
      else if (h < 0.18) put(img, x, y, mix(base, dark, 0.3));
    }
  // grass tufts: little "v" / "w" shapes
  for (let i = 0; i < 7; i++) {
    const x = Math.floor(hash2(i, seed, 3) * S);
    const y = Math.floor(hash2(seed, i, 5) * S);
    put(img, x, y, dark);
    put(img, x + 2, y, dark);
    put(img, x + 1, y + 1, dark);
    if (hash2(i, i, seed) > 0.5) put(img, x + 1, y - 1, light);
  }
  for (let i = 0; i < 4; i++) {
    const x = Math.floor(hash2(i + 40, seed, 13) * S);
    const y = Math.floor(hash2(seed, i + 40, 17) * S);
    put(img, x, y, light);
    put(img, x, y + 1, mix(light, base, 0.5));
  }
}

function flowers(img: PixelImage, seed: number, wilt: boolean): void {
  const cols = wilt ? [hex('#a89a7a'), hex('#9a7a62'), hex('#b0a080')] : [hex('#fbf6ec'), hex('#ffd65a'), hex('#f59ab5'), hex('#a7c7ff')];
  const n = 5;
  for (let i = 0; i < n; i++) {
    const x = 2 + Math.floor(hash2(i, seed, 21) * 12);
    const y = 2 + Math.floor(hash2(seed, i, 23) * 12);
    const c = cols[Math.floor(hash2(i, seed, 29) * cols.length)]!;
    if (wilt) {
      put(img, x, y, c);
      put(img, x, y + 1, hex('#7a6a40'));
      continue;
    }
    put(img, x, y + 2, G.deep);
    put(img, x, y + 1, G.shadow);
    put(img, x - 1, y, c);
    put(img, x + 1, y, c);
    put(img, x, y - 1, c);
    put(img, x, y + 1, mix(c, G.shadow, 0.5));
    put(img, x, y, hex('#ffb84a'));
  }
}

function tallGrass(img: PixelImage, wilt: boolean): void {
  const r = wilt ? ramp(hex('#a39456')) : ramp(hex('#5aa646'));
  const blades: [number, number, number][] = [];
  for (let i = 0; i < 9; i++) blades.push([1 + Math.floor(hash2(i, 7, 1) * 14), 9 + Math.floor(hash2(7, i, 2) * 6), 5 + Math.floor(hash2(i, i, 3) * 4)]);
  const layer = createImage(S, S);
  for (const [bx, by, h] of blades) {
    for (let k = 0; k < h; k++) {
      const x = bx + (k > h - 3 ? (bx % 2 ? 1 : -1) : 0);
      const y = by - k;
      setPixel(layer, x, y, k > h - 3 ? r.light : k > h / 2 ? r.base : r.shadow);
      if (k < h - 2) setPixel(layer, x + 1, y, r.shadow);
    }
  }
  compositeOutlined(img, layer, 0.4);
}

function dirtFill(img: PixelImage, inside: (x: number, y: number) => boolean, seed: number): void {
  const D = ramp(P.dirt);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      if (!inside(x, y)) continue;
      let c = D.base;
      const h = hash2(x, y, seed);
      if (h > 0.9) c = D.light;
      else if (h < 0.08) c = D.shadow;
      setPixel(img, x, y, c);
    }
  // edge: darker rim inside the path + light grass lip outside
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      if (!inside(x, y)) continue;
      const nb = [
        [0, -1],
        [1, 0],
        [0, 1],
        [-1, 0],
      ].some(([dx, dy]) => {
        const nx = x + dx!;
        const ny = y + dy!;
        return nx >= 0 && ny >= 0 && nx < S && ny < S && !inside(nx, ny);
      });
      if (nb) setPixel(img, x, y, D.shadow);
    }
  // pebbles
  for (let i = 0; i < 4; i++) {
    const x = Math.floor(hash2(i, seed, 61) * 14) + 1;
    const y = Math.floor(hash2(seed, i, 67) * 14) + 1;
    if (inside(x, y) && inside(x + 1, y) && inside(x, y + 1)) {
      setPixel(img, x, y, D.light);
      setPixel(img, x + 1, y, D.base);
      setPixel(img, x, y + 1, D.deep);
    }
  }
}

function pathTile(mask: number): PixelImage {
  const img = createImage(S, S);
  grassBase(img, 100 + mask);
  const lo = 3;
  const hi = 12;
  const inside = (x: number, y: number): boolean => {
    const inCore = x >= lo && x <= hi && y >= lo && y <= hi;
    const cornerCut =
      (x === lo && y === lo && !(mask & DIR_BITS.n) && !(mask & DIR_BITS.w)) ||
      (x === hi && y === lo && !(mask & DIR_BITS.n) && !(mask & DIR_BITS.e)) ||
      (x === lo && y === hi && !(mask & DIR_BITS.s) && !(mask & DIR_BITS.w)) ||
      (x === hi && y === hi && !(mask & DIR_BITS.s) && !(mask & DIR_BITS.e));
    if (inCore && !cornerCut) return true;
    if (mask & DIR_BITS.n && x >= lo && x <= hi && y < lo) return true;
    if (mask & DIR_BITS.s && x >= lo && x <= hi && y > hi) return true;
    if (mask & DIR_BITS.w && y >= lo && y <= hi && x < lo) return true;
    if (mask & DIR_BITS.e && y >= lo && y <= hi && x > hi) return true;
    return false;
  };
  dirtFill(img, inside, 300);
  // re-open the rim where the path continues off-tile
  const D = ramp(P.dirt);
  for (let i = lo + 1; i < hi; i++) {
    if (mask & DIR_BITS.n) setPixel(img, i, 0, hash2(i, 0, 300) > 0.9 ? D.light : D.base);
    if (mask & DIR_BITS.s) setPixel(img, i, S - 1, hash2(i, S - 1, 300) > 0.9 ? D.light : D.base);
    if (mask & DIR_BITS.w) setPixel(img, 0, i, hash2(0, i, 300) > 0.9 ? D.light : D.base);
    if (mask & DIR_BITS.e) setPixel(img, S - 1, i, hash2(S - 1, i, 300) > 0.9 ? D.light : D.base);
  }
  return img;
}

function cobble(seed: number): PixelImage {
  const img = createImage(S, S);
  const mortar = hex('#6f6a70');
  fillRect(img, 0, 0, S, S, mortar);
  const stones = [ramp(hex('#aaa4a0')), ramp(hex('#9c99a3')), ramp(hex('#b2a898'))];
  // 4 rows of stones, staggered; each stone a rounded rect
  for (let row = 0; row < 4; row++) {
    const off = row % 2 ? 2 : -2 + (seed % 2) * 4;
    for (let col = -1; col < 3; col++) {
      const w = 6 + Math.floor(hash2(row, col, seed) * 2);
      const x0 = col * 8 + off;
      const y0 = row * 4;
      const r = stones[Math.floor(hash2(col, row, seed + 7) * 3)]!;
      for (let y = 0; y < 3; y++)
        for (let x = 0; x < w; x++) {
          if ((x === 0 || x === w - 1) && (y === 0 || y === 2)) continue;
          const c = y === 0 ? r.light : y === 2 ? r.shadow : x === w - 1 ? r.shadow : r.base;
          put(img, x0 + x, y0 + y, c);
        }
      put(img, x0 + 1, y0, r.hi);
    }
  }
  return img;
}

function plaza(): PixelImage {
  const img = createImage(S, S);
  const r = ramp(hex('#d6cbb5'));
  fillRect(img, 0, 0, S, S, r.base);
  for (let i = 0; i < S; i++) {
    setPixel(img, i, 0, r.light);
    setPixel(img, 0, i, r.light);
    setPixel(img, i, 7, r.shadow);
    setPixel(img, 7, i, r.shadow);
    setPixel(img, i, 8, r.light);
    setPixel(img, 8, i, r.light);
    setPixel(img, i, 15, r.shadow);
    setPixel(img, 15, i, r.shadow);
  }
  // inset diamond at the 4-tile junction
  const d = ramp(hex('#b98f6a'));
  for (const [cx, cy] of [
    [0, 0],
    [16, 0],
    [0, 16],
    [16, 16],
  ] as const) {
    for (let y = -2; y <= 2; y++)
      for (let x = -2; x <= 2; x++) if (Math.abs(x) + Math.abs(y) <= 2) {
        const px = cx + x;
        const py = cy + y;
        if (px >= 0 && py >= 0 && px < S && py < S) setPixel(img, px, py, Math.abs(x) + Math.abs(y) === 2 ? d.shadow : d.base);
      }
  }
  for (let i = 0; i < 6; i++) setPixel(img, Math.floor(hash2(i, 1, 9) * 16), Math.floor(hash2(1, i, 9) * 16), r.shadow);
  return img;
}

function water(frame: number): PixelImage {
  const img = createImage(S, S);
  const W = ramp(P.water);
  fillRect(img, 0, 0, S, S, W.base);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const v = Math.sin(((x + y * 0.5) / S) * Math.PI * 2 + frame * Math.PI) * 0.5 + Math.sin((y / S) * Math.PI * 4) * 0.5;
      if (v > 0.75) put(img, x, y, W.light);
      else if (v < -0.8) put(img, x, y, W.shadow);
    }
  // wave glints
  const glints: [number, number][] = [
    [2, 3],
    [9, 6],
    [5, 11],
    [12, 13],
  ];
  for (const [gx, gy] of glints) {
    const x = gx + frame * 2;
    put(img, x, gy, P.waterLight);
    put(img, x + 1, gy, P.waterLight);
    put(img, x + 2, gy, W.light);
    put(img, x - 1, gy + 1, W.light);
  }
  return img;
}

type Side = 'n' | 'e' | 's' | 'w';

/** Water tile with land along `sides`; `inner` corners have land only in one corner. */
function shore(sides: Side[], innerCorner?: 'ne' | 'nw' | 'se' | 'sw'): PixelImage {
  const img = water(0);
  const sand = ramp(P.sand);
  const depth = 5;
  const landAt = (x: number, y: number): number => {
    // distance into water from the land edge (negative = land)
    let d = 99;
    if (sides.includes('n')) d = Math.min(d, y - depth);
    if (sides.includes('s')) d = Math.min(d, S - 1 - y - depth);
    if (sides.includes('w')) d = Math.min(d, x - depth);
    if (sides.includes('e')) d = Math.min(d, S - 1 - x - depth);
    if (innerCorner) {
      const cx = innerCorner.includes('w') ? 0 : S - 1;
      const cy = innerCorner.includes('n') ? 0 : S - 1;
      d = Math.min(d, Math.hypot(x - cx, y - cy) - depth - 0.5);
    }
    // wobble the edge a little
    return d + (hash2(x, y, 5) > 0.7 ? 0.5 : 0) + Math.sin((x + y) * 0.9) * 0.6;
  };
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const d = landAt(x, y);
      if (d < 0) {
        let c = sand.base;
        if (d > -1.2) c = sand.shadow;
        else if (hash2(x, y, 33) > 0.88) c = sand.light;
        else if (d < -4 && hash2(x, y, 34) > 0.75) c = mix(sand.base, P.grass, 0.6);
        setPixel(img, x, y, c);
      } else if (d < 1.2) setPixel(img, x, y, P.foam);
      else if (d < 2.2) setPixel(img, x, y, ramp(P.water).light);
    }
  return img;
}

function sandTile(): PixelImage {
  const img = createImage(S, S);
  const r = ramp(P.sand);
  fillRect(img, 0, 0, S, S, r.base);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const h = hash2(x, y, 44);
      if (h > 0.9) setPixel(img, x, y, r.light);
      else if (h < 0.07) setPixel(img, x, y, r.shadow);
    }
  // ripple marks
  for (const y of [4, 11]) for (let x = 2; x < 7; x++) setPixel(img, x + (y === 11 ? 7 : 0), y + (x % 3 === 0 ? 1 : 0), r.shadow);
  return img;
}

function woodFloor(): PixelImage {
  const img = createImage(S, S);
  const r = ramp(hex('#b98552'));
  const alt = ramp(hex('#a9784a'));
  for (let row = 0; row < 4; row++) {
    const pr = row % 2 ? alt : r;
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < S; x++) {
        let c = y === 0 ? pr.light : y === 3 ? pr.shadow : pr.base;
        if (hash2(x, row * 4 + y, 77) > 0.93 && y > 0 && y < 3) c = pr.shadow;
        setPixel(img, x, row * 4 + y, c);
      }
    const seam = (row * 7 + 5) % 16;
    for (let y = 0; y < 4; y++) setPixel(img, seam, row * 4 + y, pr.deep);
    setPixel(img, wrap(seam + 2), row * 4 + 1, pr.deep);
    setPixel(img, wrap(seam - 3), row * 4 + 2, pr.deep);
  }
  return img;
}

function rug(part: string): PixelImage {
  const img = createImage(S, S);
  const red = ramp(hex('#b8434a'));
  const gold = ramp(hex('#e8b04a'));
  const cream = ramp(hex('#efe1bf'));
  const n = part.includes('n');
  const s = part.includes('s');
  const w = part.includes('w');
  const e = part.includes('e');
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      // distance from the rug's outer edge within this tile
      const dy = n ? y : s ? S - 1 - y : 99;
      const dx = w ? x : e ? S - 1 - x : 99;
      const d = Math.min(dx, dy);
      if (d === 0) {
        // tassel fringe on short ends, plain edge on sides
        if ((n || s) && dy === 0) {
          if (x % 2 === 0) setPixel(img, x, y, cream.base);
          continue;
        }
        if (dx === 0 && (y % 2 === 0 || true)) {
          setPixel(img, x, y, red.deep);
          continue;
        }
      }
      if (d === 1) setPixel(img, x, y, red.deep);
      else if (d === 2 || d === 4) setPixel(img, x, y, gold.base);
      else if (d === 3) setPixel(img, x, y, red.shadow);
      else {
        // field pattern: diamonds
        const gx = (x + 4) % 8;
        const gy = (y + 4) % 8;
        const m = Math.abs(gx - 4) + Math.abs(gy - 4);
        let c = red.base;
        if (m === 3) c = gold.shadow;
        else if (m <= 1) c = cream.base;
        else if ((x + y) % 4 === 0 && m > 4) c = red.light;
        setPixel(img, x, y, c);
      }
    }
  return img;
}

function stoneWallTop(): PixelImage {
  const img = createImage(S, S);
  const r = ramp(hex('#8f8c98'));
  fillRect(img, 0, 0, S, S, r.light);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const h = hash2(x >> 1, y >> 1, 12);
      if (h > 0.75) setPixel(img, x, y, r.base);
      if (hash2(x, y, 13) > 0.94) setPixel(img, x, y, r.hi);
    }
  // moss
  for (let i = 0; i < 6; i++) {
    const x = Math.floor(hash2(i, 3, 14) * 14);
    const y = Math.floor(hash2(3, i, 14) * 14);
    setPixel(img, x, y, P.moss);
    setPixel(img, x + 1, y, mix(P.moss, r.light, 0.4));
  }
  for (let x = 0; x < S; x++) setPixel(img, x, S - 1, r.shadow);
  return img;
}

function stoneWallFace(): PixelImage {
  const img = createImage(S, S);
  const r = ramp(hex('#8a8796'));
  const mortar = hex('#55526a');
  fillRect(img, 0, 0, S, S, mortar);
  for (let row = 0; row < 4; row++) {
    const off = row % 2 ? 4 : 0;
    for (let col = -1; col < 2; col++) {
      const x0 = col * 8 + off;
      const y0 = row * 4;
      const br = hash2(col, row, 3) > 0.5 ? r : ramp(hex('#938f9b'));
      for (let y = 0; y < 3; y++)
        for (let x = 0; x < 7; x++) {
          let c = y === 0 ? br.light : y === 2 ? br.shadow : br.base;
          if (x === 6) c = br.shadow;
          if (row === 3) c = shade(c, -0.08);
          put(img, x0 + x, y0 + y, c);
        }
    }
  }
  return img;
}

function woodWallFace(): PixelImage {
  const img = createImage(S, S);
  const r = ramp(hex('#c79a64'));
  for (let x = 0; x < S; x++) {
    const plank = Math.floor(x / 4);
    const pr = plank % 2 ? ramp(hex('#bf915c')) : r;
    for (let y = 0; y < S; y++) {
      let c = x % 4 === 0 ? pr.light : x % 4 === 3 ? pr.shadow : pr.base;
      if (hash2(x, y, 55) > 0.95) c = pr.shadow;
      setPixel(img, x, y, c);
    }
  }
  // baseboard + top trim
  const b = ramp(hex('#7a4c2c'));
  for (let x = 0; x < S; x++) {
    setPixel(img, x, 0, b.light);
    setPixel(img, x, 1, b.base);
    setPixel(img, x, 13, b.light);
    setPixel(img, x, 14, b.base);
    setPixel(img, x, 15, b.deep);
  }
  return img;
}

function woodWallTop(): PixelImage {
  const img = createImage(S, S);
  const r = ramp(hex('#6a4430'));
  fillRect(img, 0, 0, S, S, r.base);
  for (let y = 0; y < S; y += 4) {
    for (let x = 0; x < S; x++) {
      setPixel(img, x, y, r.light);
      setPixel(img, x, y + 3, r.shadow);
    }
  }
  for (let y = 0; y < S; y++) if (hash2(3, y, 2) > 0.6) setPixel(img, (y * 5) % 16, y, r.deep);
  return img;
}

function fence(kind: 'h' | 'v' | 'post'): PixelImage {
  const img = createImage(S, S);
  const layer = createImage(S, S);
  const r = ramp(hex('#b07a46'));
  const post = (x: number, top: number) => {
    for (let y = top; y < 14; y++) {
      setPixel(layer, x, y, y === top ? r.hi : r.light);
      setPixel(layer, x + 1, y, y === top ? r.light : r.base);
      setPixel(layer, x + 2, y, r.shadow);
    }
  };
  if (kind === 'h') {
    for (const ry of [5, 9])
      for (let x = 0; x < S; x++) {
        setPixel(layer, x, ry, r.light);
        setPixel(layer, x, ry + 1, r.shadow);
      }
    post(2, 3);
    post(11, 3);
  } else if (kind === 'v') {
    for (let y = 0; y < S; y++) {
      setPixel(layer, 6, y, r.light);
      setPixel(layer, 7, y, r.base);
      setPixel(layer, 8, y, r.shadow);
    }
    post(6, 2);
    for (let y = 2; y < 6; y++) setPixel(layer, 9, y + 6, r.deep);
  } else post(6, 3);
  compositeOutlined(img, layer, 0);
  // the rails should run off the tile edge seamlessly: remove outline at edges
  if (kind === 'h') for (const ry of [5, 9]) for (const x of [0, 15]) {
    setPixel(img, x, ry, r.light);
    setPixel(img, x, ry + 1, r.shadow);
  }
  if (kind === 'v') for (const y of [0, 15]) {
    setPixel(img, 6, y, r.light);
    setPixel(img, 7, y, r.base);
    setPixel(img, 8, y, r.shadow);
  }
  // little shadow on the ground
  for (let x = 0; x < S; x++) if (getAlpha(img, x, 14) === 0 && getAlpha(img, x, 13) > 0) blendPixel(img, x, 14, 0x1f1a2b, 50);
  return img;
}

function hedge(wilt: boolean): PixelImage {
  const img = createImage(S, S);
  const r = wilt ? ramp(hex('#8f8a4a')) : ramp(hex('#3f8a45'));
  fillRect(img, 0, 0, S, S, r.shadow);
  // overlapping leaf clumps (wrapping)
  const clumps: [number, number][] = [
    [2, 2],
    [9, 1],
    [14, 6],
    [5, 8],
    [11, 11],
    [1, 13],
    [8, 14],
  ];
  for (const [cx, cy] of clumps) {
    for (let y = -3; y <= 3; y++)
      for (let x = -3; x <= 3; x++) {
        const d = x * x + y * y;
        if (d > 9) continue;
        let c = r.base;
        if (x + y < -2) c = r.light;
        if (x + y < -4) c = r.hi;
        if (x + y > 3) c = r.shadow;
        put(img, cx + x, cy + y, c);
      }
  }
  for (let i = 0; i < 10; i++) put(img, Math.floor(hash2(i, 2, 8) * 16), Math.floor(hash2(2, i, 8) * 16), r.deep);
  if (wilt) {
    for (let i = 0; i < 8; i++) put(img, Math.floor(hash2(i, 5, 9) * 16), Math.floor(hash2(5, i, 9) * 16), hex('#a0703a'));
  } else {
    for (let i = 0; i < 3; i++) put(img, Math.floor(hash2(i, 6, 9) * 16), Math.floor(hash2(6, i, 9) * 16), hex('#f59ab5'));
  }
  return img;
}

function darkForest(seed: number): PixelImage {
  const img = createImage(S, S);
  const r = ramp(hex('#3f5a3a'));
  fillRect(img, 0, 0, S, S, r.base);
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const h = hash2(x >> 1, y >> 1, seed);
      if (h > 0.8) setPixel(img, x, y, r.shadow);
      else if (h < 0.1) setPixel(img, x, y, mix(r.base, hex('#5a4a35'), 0.6));
    }
  // fallen leaves
  const leaf = [hex('#8a6a3a'), hex('#a5793f'), hex('#6a7a3a')];
  for (let i = 0; i < 6; i++) {
    const x = Math.floor(hash2(i, seed, 1) * 16);
    const y = Math.floor(hash2(seed, i, 2) * 16);
    const c = leaf[i % 3]!;
    put(img, x, y, c);
    put(img, x + 1, y, shade(c, -0.15));
  }
  // root / twig
  if (seed % 2) {
    for (let x = 3; x < 10; x++) put(img, x, 11 + (x % 3 === 0 ? 1 : 0), hex('#4a3a2a'));
  }
  return img;
}

function mushrooms(): PixelImage {
  const img = createImage(S, S);
  const layer = createImage(S, S);
  const cap = ramp(hex('#d8503f'));
  const stem = ramp(hex('#efe1bf'));
  const shroom = (x: number, y: number, w: number) => {
    for (let i = 0; i < w; i++) {
      setPixel(layer, x + i, y, i === 0 ? cap.light : i === w - 1 ? cap.shadow : cap.base);
      if (i > 0 && i < w - 1) setPixel(layer, x + i, y - 1, i === 1 ? cap.hi : cap.base);
    }
    setPixel(layer, x + Math.floor(w / 2), y + 1, stem.base);
    setPixel(layer, x + Math.floor(w / 2), y + 2, stem.shadow);
    setPixel(layer, x + 1, y - 1, 0xffffff);
  };
  shroom(3, 8, 5);
  shroom(9, 11, 4);
  shroom(10, 5, 3);
  compositeOutlined(img, layer, 0);
  return img;
}

function bridge(horizontal: boolean): PixelImage {
  const img = createImage(S, S);
  const r = ramp(hex('#a97a4c'));
  // planks run across the direction of travel
  for (let a = 0; a < S; a++)
    for (let b = 0; b < S; b++) {
      const plank = Math.floor(a / 3);
      const pr = plank % 2 ? ramp(hex('#9e7146')) : r;
      let c = a % 3 === 0 ? pr.light : a % 3 === 2 ? pr.shadow : pr.base;
      if (b <= 1 || b >= 14) c = b === 0 || b === 15 ? ramp(hex('#6e4a33')).shadow : ramp(hex('#6e4a33')).base;
      if (hash2(a, b, 4) > 0.95) c = pr.shadow;
      const [x, y] = horizontal ? [a, b] : [b, a];
      setPixel(img, x, y, c);
    }
  // nails
  for (let a = 1; a < S; a += 3) {
    const [x1, y1] = horizontal ? [a, 3] : [3, a];
    const [x2, y2] = horizontal ? [a, 12] : [12, a];
    setPixel(img, x1, y1, r.deep);
    setPixel(img, x2, y2, r.deep);
  }
  return img;
}

function grassTile(seed: number, wilt = 0): PixelImage {
  const img = createImage(S, S);
  grassBase(img, seed, wilt);
  return img;
}

function wiltColors(img: PixelImage, amount: number): PixelImage {
  const out = createImage(img.width, img.height);
  blit(out, img, 0, 0);
  for (let i = 0; i < out.data.length; i += 4) {
    if ((out.data[i + 3] ?? 0) === 0) continue;
    const c = ((out.data[i] ?? 0) << 16) | ((out.data[i + 1] ?? 0) << 8) | (out.data[i + 2] ?? 0);
    const d = mix(desaturate(c, amount), hex('#9a8455'), amount * 0.35);
    out.data[i] = (d >> 16) & 255;
    out.data[i + 1] = (d >> 8) & 255;
    out.data[i + 2] = d & 255;
  }
  return out;
}

/** Renders one tile by name. */
export function renderTile(name: TileName): PixelImage {
  if (name.startsWith('dirt_path_')) return pathTile(Number(name.slice('dirt_path_'.length)));
  switch (name) {
    case 'grass_0':
    case 'grass_1':
    case 'grass_2':
    case 'grass_3':
      return grassTile(Number(name.slice(-1)) * 17 + 1);
    case 'grass_flowers_0':
    case 'grass_flowers_1':
    case 'grass_flowers_0_wilted':
    case 'grass_flowers_1_wilted': {
      const idx = Number(name.charAt('grass_flowers_'.length));
      const wilt = name.endsWith('wilted');
      const img = grassTile(idx * 17 + 3, wilt ? 0.7 : 0);
      flowers(img, idx + 11, wilt);
      return img;
    }
    case 'tall_grass':
    case 'tall_grass_wilted': {
      const img = createImage(S, S);
      tallGrass(img, name.endsWith('wilted'));
      return img;
    }
    case 'dirt': {
      const img = createImage(S, S);
      dirtFill(img, () => true, 301);
      // full dirt has no rim
      const D = ramp(P.dirt);
      for (let y = 0; y < S; y++)
        for (let x = 0; x < S; x++) {
          const h = hash2(x, y, 301);
          setPixel(img, x, y, h > 0.9 ? D.light : h < 0.08 ? D.shadow : D.base);
        }
      return img;
    }
    case 'cobblestone_0':
      return cobble(0);
    case 'cobblestone_1':
      return cobble(1);
    case 'plaza_tile':
      return plaza();
    case 'water_0':
      return water(0);
    case 'water_1':
      return water(1);
    case 'shore_n':
      return shore(['n']);
    case 'shore_e':
      return shore(['e']);
    case 'shore_s':
      return shore(['s']);
    case 'shore_w':
      return shore(['w']);
    case 'shore_ne':
      return shore(['n', 'e']);
    case 'shore_nw':
      return shore(['n', 'w']);
    case 'shore_se':
      return shore(['s', 'e']);
    case 'shore_sw':
      return shore(['s', 'w']);
    case 'shore_inner_ne':
      return shore([], 'ne');
    case 'shore_inner_nw':
      return shore([], 'nw');
    case 'shore_inner_se':
      return shore([], 'se');
    case 'shore_inner_sw':
      return shore([], 'sw');
    case 'sand':
      return sandTile();
    case 'wooden_floor':
      return woodFloor();
    case 'rug_nw':
    case 'rug_n':
    case 'rug_ne':
    case 'rug_w':
    case 'rug_c':
    case 'rug_e':
    case 'rug_sw':
    case 'rug_s':
    case 'rug_se':
      return rug(name.slice(4));
    case 'stone_wall_top':
      return stoneWallTop();
    case 'stone_wall_face':
      return stoneWallFace();
    case 'wood_wall_top':
      return woodWallTop();
    case 'wood_wall_face':
      return woodWallFace();
    case 'fence_h':
      return fence('h');
    case 'fence_v':
      return fence('v');
    case 'fence_post':
      return fence('post');
    case 'hedge':
      return hedge(false);
    case 'hedge_wilted':
      return hedge(true);
    case 'dark_forest_floor_0':
      return darkForest(2);
    case 'dark_forest_floor_1':
      return darkForest(3);
    case 'mushrooms':
      return mushrooms();
    case 'bridge_h':
      return bridge(true);
    case 'bridge_v':
      return bridge(false);
  }
  throw new Error(`Unknown tile ${String(name)}`);
}

export interface Tileset extends SpriteSheet {
  tileSize: 16;
  tiles: Record<TileName, number>;
  /** Animated tiles: name → frame tile names. */
  animations: { water: TileName[] };
}

/** Renders every tile into one sheet (8 columns). `tiles[name]` is the frame index. */
export function renderTileset(): Tileset {
  const imgs = TILE_NAMES.map((n) => renderTile(n));
  const sheet = packSheet(imgs, { columns: 8, names: [...TILE_NAMES] });
  const tiles = {} as Record<TileName, number>;
  TILE_NAMES.forEach((n, i) => (tiles[n] = i));
  return { ...sheet, tileSize: 16, tiles, animations: { water: ['water_0', 'water_1'] } };
}

void wiltColors;
void (null as unknown as Ramp);
