/**
 * 16×16 UI icons: stats, currencies/materials, misc and emotes, plus
 * standalone inventory icons for every equipment visual id.
 */
import { type Color, type PixelImage, blit, blendPixel, createImage, drawTemplate, forEllipse, getAlpha, setPixel } from './image';
import { hex, mix, ramp, shade, type Ramp } from './palette';
import { ball, box, glow, layer, thickLine } from './draw';
import {
  BACK_STYLES,
  CHEST_STYLES,
  GEAR,
  HEAD_GEAR,
  WEAPONS,
  parseEquipVisual,
  type EquipVisual,
  type EquipmentSet,
} from './characterGear';
import { packSheet, type SpriteSheet } from './sheet';

export const ICON_SIZE = 16;

export const STAT_ICONS = ['vitality', 'mobility', 'recovery', 'discipline', 'knowledge', 'craftsmanship', 'stewardship'] as const;
export const MATERIAL_ICONS = ['gold', 'wood', 'stone', 'iron', 'leather', 'cloth', 'essence', 'arcane_dust', 'boss_shard'] as const;
export const MISC_ICONS = ['xp_star', 'quest_scroll', 'chest', 'flame', 'sword', 'potion'] as const;
export const EMOTE_ICONS = ['emote_wave', 'emote_cheer', 'emote_heart', 'emote_laugh', 'emote_sleep', 'emote_thumbs_up'] as const;

export const ICON_NAMES = [...STAT_ICONS, ...MATERIAL_ICONS, ...MISC_ICONS, ...EMOTE_ICONS] as const;
export type IconName = (typeof ICON_NAMES)[number];

const S = 16;
const mk = () => createImage(S, S);

/** Keys for template icons: a ramp spread over l/h/b/s/d. */
function rk(r: Ramp, extra: Record<string, Color> = {}): Record<string, Color> {
  return { l: r.hi, h: r.light, b: r.base, s: r.shadow, d: r.deep, ...extra };
}

function tpl(rows: string[], key: Record<string, Color>, soft = 0): PixelImage {
  const img = mk();
  layer(img, (l) => drawTemplate(l, rows, 0, 0, key), soft);
  return img;
}

/* ------------------------------ stats ----------------------------- */

const RED = ramp('#e0483f');

function heartShape(l: PixelImage, ox: number, oy: number, scale: number, r: Ramp): void {
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const nx = ((x + 0.5 - 8) / 6.5) * (1 / scale);
      const ny = -((y + 0.5 - 7.5) / 6.5) * (1 / scale) + 0.05;
      const a = nx * nx + ny * ny - 0.42;
      if (a * a * a - nx * nx * ny * ny * ny > 0) continue;
      const lit = -(nx * 0.6 - ny * 0.8);
      let c = lit > 0.55 ? r.light : lit < -0.6 ? r.shadow : r.base;
      if (nx > 0.55) c = r.shadow;
      setPixel(l, x + ox, y + oy, c);
    }
}

function iconHeart(r: Ramp = RED, scale = 1): PixelImage {
  const img = mk();
  layer(img, (l) => {
    heartShape(l, 0, 0, scale, r);
    setPixel(l, 4, 5, 0xffffff);
    setPixel(l, 4, 6, r.hi);
    setPixel(l, 5, 5, r.hi);
  }, 0);
  return img;
}

function iconBoot(): PixelImage {
  return tpl(
    [
      '................',
      '................',
      '.....kkkkk......',
      '.....hbbbs..ww..',
      '.....hbbbs.wwW..',
      '.....hbbbswwW...',
      '.....hbbbswW....',
      '.....hbbbs......',
      '.....hbbbs......',
      '.....hbbbbs.....',
      '....hbbbbbbbs...',
      '....hbbbbbbbbs..',
      '....dddddddddd..',
      '................',
      '................',
      '................',
    ],
    { ...rk(ramp('#a8703f')), k: hex('#e8c88a'), w: hex('#ffffff'), W: hex('#c8d8f0') },
  );
}

function iconMoon(): PixelImage {
  const img = mk();
  const r = ramp('#f2dc8a');
  layer(img, (l) => {
    forEllipse(1, 2, 12, 12, (x, y, nx, ny) => {
      const dx = (x + 0.5 - 10) / 4.8;
      const dy = (y + 0.5 - 5.5) / 4.8;
      if (dx * dx + dy * dy < 1) return;
      setPixel(l, x, y, nx < -0.5 ? r.light : ny > 0.6 ? r.shadow : r.base);
    });
  }, 0);
  layer(img, (l) => {
    for (const [x, y] of [
      [12, 4],
      [13, 11],
    ] as const) {
      setPixel(l, x, y, 0xffffff);
      setPixel(l, x - 1, y, 0xbfe6ff);
      setPixel(l, x + 1, y, 0xbfe6ff);
      setPixel(l, x, y - 1, 0xbfe6ff);
      setPixel(l, x, y + 1, 0xbfe6ff);
    }
  }, 0);
  return img;
}

function shieldIcon(field: Ramp, rim: Ramp, emblem: Color): PixelImage {
  const img = mk();
  layer(img, (l) => {
    for (let y = 1; y <= 14; y++) {
      const t = (y - 1) / 13;
      const half = t < 0.55 ? 6 : 6 * Math.cos(((t - 0.55) / 0.45) * Math.PI * 0.5);
      for (let x = Math.round(8 - half); x < Math.round(8 + half); x++) {
        const edge = x === Math.round(8 - half) || x === Math.round(8 + half) - 1 || y === 1;
        const left = x < 8;
        let c = edge ? (left ? rim.light : rim.shadow) : left ? field.light : field.base;
        if (y === 2 && !edge) c = field.hi;
        setPixel(l, x, y, c);
      }
    }
    // emblem: cross
    for (let y = 4; y <= 10; y++) setPixel(l, 7, y, emblem);
    for (let y = 4; y <= 10; y++) setPixel(l, 8, y, shade(emblem, -0.15));
    for (let x = 5; x <= 10; x++) setPixel(l, x, 6, x < 8 ? emblem : shade(emblem, -0.15));
  }, 0);
  return img;
}

function iconBook(cover: Ramp = ramp('#4a6fc2')): PixelImage {
  return tpl(
    [
      '................',
      '................',
      '...hbbbbbbbbbw..',
      '..hbbbbbbbbbbW..',
      '..hbbggggggbbw..',
      '..hbbgGGGGgbbW..',
      '..hbbggggggbbw..',
      '..hbbbbbbbbbbW..',
      '..hbbbbbbbbbbw..',
      '..hbbbbbbbbbbW..',
      '..hbbbbbbbbbbw..',
      '..hbbbbbbbbbbW..',
      '..hsssssssssss..',
      '..rr............',
      '..r.............',
      '................',
    ],
    { ...rk(cover), g: GEAR.gold.light, G: GEAR.gold.shadow, w: hex('#f4efe6'), W: hex('#d9cfbd'), r: hex('#d8473f') },
  );
}

function iconHammer(): PixelImage {
  return tpl(
    [
      '................',
      '................',
      '.......lhh......',
      '......lhhbb.....',
      '.....lhbbbbs....',
      '....hhbbbbbbs...',
      '.....sbbbbbbbs..',
      '......sbbbbbs...',
      '......wsbbbs....',
      '.....wws.ss.....',
      '....wwx.........',
      '...wwx..........',
      '..wwx...........',
      '..wx............',
      '................',
      '................',
    ],
    { ...rk(ramp('#9aa4b4')), w: GEAR.wood.light, x: GEAR.wood.shadow },
  );
}

function swordIcon(): PixelImage {
  return tpl(
    [
      '................',
      '.............ll.',
      '............lhs.',
      '...........lhs..',
      '..........lhs...',
      '.........lhs....',
      '........lhs.....',
      '.......lhs......',
      '...g..lhs.......',
      '....gGhs........',
      '.....Gg.........',
      '....xGgg........',
      '...xx..g........',
      '..xx............',
      '.oo.............',
      '.oo.............',
    ],
    { ...rk(ramp('#c4ccd8')), g: GEAR.gold.light, G: GEAR.gold.shadow, x: hex('#6b432a'), o: GEAR.gold.base },
  );
}

function iconKey(): PixelImage {
  const img = mk();
  const g = GEAR.gold;
  layer(img, (l) => {
    forEllipse(1, 1, 7, 7, (x, y, nx, ny) => {
      const d = nx * nx + ny * ny;
      if (d < 0.25) return;
      setPixel(l, x, y, nx + ny < -0.3 ? g.light : nx + ny > 0.5 ? g.shadow : g.base);
    });
    thickLine(l, 6, 6, 13, 13, 2, (t, i) => (i === 0 ? g.light : g.shadow));
    thickLine(l, 10, 12, 8, 14, 1, () => g.base);
    thickLine(l, 12, 10, 14, 8, 1, () => g.base);
  }, 0);
  setPixel(img, 2, 3, 0xffffff);
  return img;
}

/* ---------------------------- materials --------------------------- */

function iconCoin(): PixelImage {
  const img = mk();
  const g = GEAR.gold;
  layer(img, (l) => {
    forEllipse(2, 2, 12, 12, (x, y, nx, ny) => {
      const d = Math.hypot(nx, ny);
      let c = nx + ny < -0.4 ? g.light : nx + ny > 0.5 ? g.shadow : g.base;
      if (d > 0.62 && d < 0.8) c = nx + ny < 0 ? g.shadow : g.light;
      setPixel(l, x, y, c);
    });
    // embossed star
    for (const [x, y] of [
      [7, 5],
      [8, 5],
      [6, 7],
      [7, 7],
      [8, 7],
      [9, 7],
      [7, 9],
      [8, 9],
      [7, 6],
      [8, 6],
      [7, 8],
      [8, 8],
    ] as const)
      setPixel(l, x, y, g.deep);
  }, 0);
  setPixel(img, 5, 4, 0xffffff);
  return img;
}

function iconWood(): PixelImage {
  const img = mk();
  const bark = ramp('#7a5236');
  const ring = ramp('#d9b07a');
  layer(img, (l) => {
    for (const [x0, y0] of [
      [1, 8],
      [7, 9],
      [4, 3],
    ] as const) {
      for (let y = 0; y < 5; y++) for (let x = 0; x < 7; x++) setPixel(l, x0 + x, y0 + y, y === 0 ? bark.light : y === 4 ? bark.shadow : bark.base);
      forEllipse(x0 + 6, y0, 3, 5, (x, y, nx, ny) => setPixel(l, x, y, Math.hypot(nx, ny) < 0.45 ? ring.shadow : ring.base));
    }
  }, 0);
  return img;
}

function iconStone(): PixelImage {
  const img = mk();
  const r = ramp('#9a98a6');
  layer(img, (l) => {
    ball(l, 1, 5, 14, 9, r);
    ball(l, 3, 2, 9, 8, r, 0.25);
    setPixel(l, 9, 9, r.deep);
    setPixel(l, 10, 10, r.deep);
    setPixel(l, 6, 4, r.hi);
  }, 0);
  return img;
}

function iconIron(): PixelImage {
  return tpl(
    [
      '................',
      '................',
      '................',
      '................',
      '.....lllllll....',
      '....lhhhhhhhs...',
      '...lhhhhhhhhs...',
      '..bbbbbbbbbbbs..',
      '..bbbbbbbbbbbs..',
      '..bbbbbbbbbbbs..',
      '..ssssssssssss..',
      '................',
      '................',
      '................',
      '................',
      '................',
    ],
    rk(ramp('#8b95a5')),
  );
}

function iconLeather(): PixelImage {
  return tpl(
    [
      '................',
      '................',
      '...hh......bb...',
      '..hhbbbbbbbbbs..',
      '...hbbbbbbbbs...',
      '...hbbbbbbbbs...',
      '..hbbbbbbbbbbs..',
      '..hbbdbbbbdbbs..',
      '..hbbbbbbbbbbs..',
      '...hbbbbbbbbs...',
      '...hbbbbbbbbs...',
      '..hbbbbbbbbbbs..',
      '..bs.......sbs..',
      '................',
      '................',
      '................',
    ],
    rk(ramp('#a8703f')),
  );
}

function iconCloth(): PixelImage {
  return tpl(
    [
      '................',
      '................',
      '................',
      '....hhhhhhhh....',
      '...hbbbbbbbbs...',
      '...hbkkbbkkbs...',
      '...hbbbbbbbbs...',
      '..hhhhhhhhhhhs..',
      '..hbbbbbbbbbbs..',
      '..hbkkbbkkbbbs..',
      '..hbbbbbbbbbbs..',
      '..ssssssssssss..',
      '................',
      '................',
      '................',
      '................',
    ],
    rk(ramp('#d9c49a'), { k: hex('#c8463c') }),
  );
}

function iconDrop(r: Ramp, glowC: Color): PixelImage {
  const img = mk();
  glow(img, 8, 9, 8, glowC, 90);
  layer(img, (l) => {
    for (let y = 2; y <= 14; y++) {
      const t = (y - 2) / 12;
      const half = t < 0.45 ? t * 9 : 4.5 * Math.sqrt(Math.max(0, 1 - ((t - 0.62) / 0.4) ** 2));
      for (let x = Math.round(8 - half); x < Math.round(8 + half); x++) {
        const nx = (x + 0.5 - 8) / Math.max(1, half);
        setPixel(l, x, y, nx < -0.35 ? r.light : nx > 0.4 ? r.shadow : r.base);
      }
    }
  }, 0);
  setPixel(img, 6, 8, 0xffffff);
  setPixel(img, 6, 9, r.hi);
  return img;
}

function iconDust(): PixelImage {
  const img = mk();
  const r = ramp('#9a6ad8');
  layer(img, (l) => {
    forEllipse(2, 9, 12, 6, (x, y, nx, ny) => {
      if (ny < -0.1 && Math.abs(nx) > 0.75 + ny * 0.2) return;
      setPixel(l, x, y, ny < -0.3 ? r.light : nx > 0.4 ? r.shadow : r.base);
    });
  }, 0);
  for (const [x, y] of [
    [5, 10],
    [9, 11],
    [7, 12],
    [11, 12],
  ] as const)
    setPixel(img, x, y, 0xf0d8ff);
  for (const [x, y] of [
    [4, 4],
    [11, 3],
  ] as const) {
    setPixel(img, x, y, 0xffffff);
    setPixel(img, x - 1, y, 0xd8b8ff);
    setPixel(img, x + 1, y, 0xd8b8ff);
    setPixel(img, x, y - 1, 0xd8b8ff);
    setPixel(img, x, y + 1, 0xd8b8ff);
  }
  setPixel(img, 8, 6, 0xd8b8ff);
  return img;
}

function iconShard(): PixelImage {
  const img = mk();
  const r = ramp('#d83a6a');
  glow(img, 8, 8, 8, hex('#ff6a9a'), 80);
  layer(img, (l) => {
    // tall crystal with a smaller side crystal
    const poly = (cx: number, top: number, bottom: number, half: number) => {
      for (let y = top; y <= bottom; y++) {
        const t = (y - top) / (bottom - top);
        const w = t < 0.3 ? (t / 0.3) * half : t > 0.85 ? half * (1 - (t - 0.85) / 0.15) * 0.8 + half * 0.2 : half;
        for (let x = Math.round(cx - w); x <= Math.round(cx + w); x++) {
          const c = x < cx - w / 3 ? r.light : x > cx + w / 3 ? r.shadow : r.base;
          setPixel(l, x, y, c);
        }
      }
    };
    poly(5, 6, 14, 2);
    poly(9, 1, 14, 3);
  }, 0);
  setPixel(img, 8, 4, 0xffffff);
  setPixel(img, 8, 5, 0xffc0d8);
  return img;
}

/* ------------------------------- misc ------------------------------ */

function starShape(l: PixelImage, cx: number, cy: number, R: number, r: Ramp): void {
  const ri = R * 0.45;
  const pts: [number, number][] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 ? ri : R;
    pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
  }
  for (let y = 0; y < l.height; y++)
    for (let x = 0; x < l.width; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      let inside = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i]!;
        const [xj, yj] = pts[j]!;
        if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
      }
      if (!inside) continue;
      const nx = (px - cx) / R;
      const ny = (py - cy) / R;
      setPixel(l, x, y, nx + ny < -0.25 ? r.light : nx + ny > 0.35 ? r.shadow : r.base);
    }
}

function iconStar(): PixelImage {
  const img = mk();
  layer(img, (l) => starShape(l, 8, 8.6, 7.4, ramp('#ffd34e')), 0);
  setPixel(img, 6, 6, 0xffffff);
  return img;
}

function iconScroll(): PixelImage {
  return tpl(
    [
      '................',
      '................',
      '..dwwwwwwwwwd...',
      '..dhhhhhhhhhhd..',
      '...hbbbbbbbbs...',
      '...hbkkkkkbbs...',
      '...hbbbbbbbbs...',
      '...hbkkkkkkbs...',
      '...hbbbbbbbbs...',
      '...hbkkkkbbbs...',
      '...hbbbbbbrrs...',
      '..dhhhhhhhrrhd..',
      '..dwwwwwwwwwd...',
      '................',
      '................',
      '................',
    ],
    { ...rk(ramp('#f0e2bf')), w: hex('#d9c49a'), d: hex('#a8703f'), k: hex('#9a8a6a'), r: hex('#d8473f') },
  );
}

function iconChest(): PixelImage {
  const img = mk();
  const body = ramp('#a8703f');
  const band = ramp('#7d8796');
  layer(img, (l) => {
    for (let y = 3; y <= 13; y++)
      for (let x = 1; x <= 14; x++) {
        if (y === 3 && (x < 3 || x > 12)) continue;
        let c = y < 8 ? (y === 3 ? body.light : body.base) : y === 13 ? body.deep : body.base;
        if (y === 8) c = band.shadow;
        if (x === 1) c = body.light;
        if (x === 14) c = body.shadow;
        if (x === 3 || x === 12) c = y % 2 ? band.base : band.light;
        setPixel(l, x, y, c);
      }
  }, 0);
  layer(img, (l) => box(l, 7, 7, 2, 3, GEAR.gold), 0.4);
  return img;
}

export function flameShape(img: PixelImage, cx: number, bottom: number, h: number, w: number, phase = 0): void {
  for (let y = 0; y < h; y++) {
    const t = y / h;
    const half = Math.max(0.6, w * Math.sin(Math.min(1, (1 - t) * 1.25) * Math.PI * 0.62) * (t < 0.2 ? 0.85 + t : 1));
    const sway = Math.sin(t * 4 + phase) * t * 1.2;
    const x0 = Math.round(cx + sway - half);
    const x1 = Math.round(cx + sway + half) - 1;
    for (let x = x0; x <= x1; x++) {
      const edge = x === x0 || x === x1;
      const inner = Math.abs(x + 0.5 - (cx + sway)) < half * 0.45 && t < 0.6;
      const c = inner ? (t < 0.35 ? hex('#fff6c4') : hex('#ffe07a')) : edge || t > 0.7 ? hex('#ff7a3a') : hex('#ffb347');
      setPixel(img, x, bottom - y, c);
    }
  }
}

function iconFlame(): PixelImage {
  const img = mk();
  glow(img, 8, 9, 8, hex('#ffb347'), 80);
  layer(img, (l) => flameShape(l, 8, 14, 13, 5.2, 0.5), 0.2);
  return img;
}

function iconSword(): PixelImage {
  return swordIcon();
}

function iconPotion(liquid: Ramp = ramp('#e0483f')): PixelImage {
  const img = mk();
  const glass = ramp('#cfe6f0');
  layer(img, (l) => {
    // cork + neck
    box(l, 6, 1, 4, 2, ramp('#a8703f'));
    box(l, 6, 3, 4, 3, glass);
    // body
    forEllipse(2, 5, 12, 10, (x, y, nx, ny) => {
      let c = ny > -0.2 ? (nx < -0.4 ? liquid.light : nx > 0.45 ? liquid.shadow : liquid.base) : nx < -0.3 ? glass.light : glass.base;
      if (Math.abs(ny + 0.2) < 0.1) c = liquid.light;
      setPixel(l, x, y, c);
    });
  }, 0);
  setPixel(img, 4, 8, 0xffffff);
  setPixel(img, 4, 9, 0xffffff);
  setPixel(img, 5, 7, glass.hi);
  return img;
}

/* ------------------------------ emotes ----------------------------- */

function bubble(draw: (l: PixelImage) => void): PixelImage {
  const img = mk();
  layer(img, (l) => {
    for (let y = 1; y <= 11; y++)
      for (let x = 1; x <= 14; x++) {
        if ((y === 1 || y === 11) && (x === 1 || x === 14)) continue;
        setPixel(l, x, y, y > 9 ? hex('#e6e0f0') : 0xfdfcf8);
      }
    // tail
    setPixel(l, 4, 12, 0xe6e0f0);
    setPixel(l, 5, 12, 0xe6e0f0);
    setPixel(l, 4, 13, 0xe6e0f0);
  }, 0);
  const g = mk();
  draw(g);
  layer(img, (l) => blit(l, g, 0, 0), 0.75);
  return img;
}

const SKINY = ramp('#f2c46a');

function emote(name: (typeof EMOTE_ICONS)[number]): PixelImage {
  switch (name) {
    case 'emote_wave':
      return bubble((l) => {
        drawTemplate(
          l,
          ['....h.h.h...', '....h.h.h.h.', '..h.hbhbhbh.', '...hbbbbbbs.', '...hbbbbbbs.', '....hbbbbs..', '.....bbbs...'],
          3,
          2,
          rk(ramp('#efc09c')),
        );
        setPixel(l, 2, 3, hex('#9ab0d0'));
        setPixel(l, 2, 5, hex('#9ab0d0'));
      });
    case 'emote_cheer':
      return bubble((l) => {
        // party popper + confetti
        thickLine(l, 4, 9, 7, 6, 2, (t) => (t < 0.5 ? hex('#4a6fc2') : hex('#7a9ae0')));
        setPixel(l, 3, 10, hex('#4a6fc2'));
        for (const [x, y, c] of [
          [9, 3, '#e0483f'],
          [11, 5, '#ffd34e'],
          [8, 6, '#5fbf5a'],
          [12, 2, '#f59ab5'],
          [10, 8, '#ffd34e'],
          [6, 3, '#9a6ad8'],
        ] as const)
          setPixel(l, x, y, hex(c));
      });
    case 'emote_heart':
      return bubble((l) => {
        const h = createImage(16, 16);
        heartShape(h, 0, 0, 0.62, ramp('#ec5a7a'));
        blit(l, h, 0, -2);
        setPixel(l, 6, 4, 0xffffff);
      });
    case 'emote_laugh':
      return bubble((l) => {
        forEllipse(4, 2, 8, 8, (x, y, nx, ny) => setPixel(l, x, y, nx + ny < -0.5 ? SKINY.light : nx + ny > 0.6 ? SKINY.shadow : SKINY.base));
        const ink = hex('#3a2430');
        for (const [x, y] of [
          [5, 5],
          [6, 4],
          [7, 5],
          [8, 5],
          [9, 4],
          [10, 5],
        ] as const)
          setPixel(l, x, y, ink);
        for (let x = 6; x <= 9; x++) setPixel(l, x, 7, ink);
        setPixel(l, 7, 8, hex('#e0606a'));
        setPixel(l, 8, 8, hex('#e0606a'));
      });
    case 'emote_sleep':
      return bubble((l) => {
        const c = hex('#6a7ab8');
        drawTemplate(l, ['ZZZZZ', '...Z.', '..Z..', '.Z...', 'ZZZZZ'], 3, 4, { Z: c });
        drawTemplate(l, ['zzz', '.z.', 'zzz'], 10, 2, { z: mix(c, 0xffffff, 0.3) });
      });
    case 'emote_thumbs_up':
      return bubble((l) => {
        drawTemplate(
          l,
          ['...hb.....', '...hbs....', '..hbbs....', 'cchbbbbbbs', 'cchbbbbbbs', 'cchbbbbbs.', 'cc.bbbbbs.'],
          3,
          2,
          { ...rk(ramp('#efc09c')), c: hex('#4a6fc2') },
        );
      });
  }
}

/* ------------------------------------------------------------------ */

export function renderIcon(name: IconName): PixelImage {
  switch (name) {
    case 'vitality':
      return iconHeart();
    case 'mobility':
      return iconBoot();
    case 'recovery':
      return iconMoon();
    case 'discipline':
      return shieldIcon(ramp('#4a6fc2'), ramp('#b4bfcc'), GEAR.gold.light);
    case 'knowledge':
      return iconBook();
    case 'craftsmanship':
      return iconHammer();
    case 'stewardship':
      return iconKey();
    case 'gold':
      return iconCoin();
    case 'wood':
      return iconWood();
    case 'stone':
      return iconStone();
    case 'iron':
      return iconIron();
    case 'leather':
      return iconLeather();
    case 'cloth':
      return iconCloth();
    case 'essence':
      return iconDrop(ramp('#4ad8d0'), hex('#8ff0e8'));
    case 'arcane_dust':
      return iconDust();
    case 'boss_shard':
      return iconShard();
    case 'xp_star':
      return iconStar();
    case 'quest_scroll':
      return iconScroll();
    case 'chest':
      return iconChest();
    case 'flame':
      return iconFlame();
    case 'sword':
      return iconSword();
    case 'potion':
      return iconPotion();
    default:
      if ((EMOTE_ICONS as readonly string[]).includes(name)) return emote(name as (typeof EMOTE_ICONS)[number]);
  }
  throw new Error(`Unknown icon ${name}`);
}

export interface IconSheet extends SpriteSheet {
  icons: Record<IconName, number>;
}

export function renderIconSheet(): IconSheet {
  const imgs = ICON_NAMES.map((n) => renderIcon(n));
  const sheet = packSheet(imgs, { columns: 8, names: [...ICON_NAMES] });
  const icons = {} as Record<IconName, number>;
  ICON_NAMES.forEach((n, i) => (icons[n] = i));
  return { ...sheet, icons };
}

/* -------------------------- equipment icons ------------------------ */

/** Draws an image centred into a 16×16 icon (cropping to its opaque bounds). */
function centerInto(src: PixelImage): PixelImage {
  let x0 = src.width;
  let y0 = src.height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < src.height; y++)
    for (let x = 0; x < src.width; x++)
      if (getAlpha(src, x, y)) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
  const img = mk();
  if (x1 < 0) return img;
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  blit(img, src, Math.floor((S - w) / 2) - x0, Math.floor((S - h) / 2) - y0);
  return img;
}

function weaponIcon(set: EquipmentSet): PixelImage {
  if (set === 'iron_guardian') return swordIcon();
  if (set === 'scholar') return iconBook(ramp('#2f3f78'));
  const def = WEAPONS[set];
  const raw = createImage(32, 32);
  const w = Math.max(...def.rows.map((r) => r.length));
  const src = createImage(w, def.rows.length);
  drawTemplate(src, def.rows, 0, 0, def.key);
  if (!def.rotates) {
    blit(raw, src, 16 - Math.floor(w / 2), 16 - Math.floor(def.rows.length / 2));
  } else {
    // 45° (tip to the top-right), nearest-neighbour about the centre
    const cx = 16;
    const cy = 16;
    const scx = (w - 1) / 2;
    const scy = (def.rows.length - 1) / 2;
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < 32; x++) {
        const dx = x - cx;
        const dy = y - cy;
        const sx = Math.round(dx * Math.SQRT1_2 + dy * Math.SQRT1_2 + scx);
        const sy = Math.round(-dx * Math.SQRT1_2 + dy * Math.SQRT1_2 + scy);
        if (sx < 0 || sy < 0 || sx >= w || sy >= def.rows.length) continue;
        const i = (sy * w + sx) * 4;
        if ((src.data[i + 3] ?? 0) === 0) continue;
        raw.data.set(src.data.subarray(i, i + 4), (y * 32 + x) * 4);
      }
  }
  const out = mk();
  layer(out, (l) => blit(l, centerInto(raw), 0, 0), 0);
  if (set === 'dreamwalker') {
    setPixel(out, 12, 2, 0xffffff);
    blendPixel(out, 13, 2, 0xc9f1ff, 200);
  }
  return out;
}

function headIcon(set: EquipmentSet): PixelImage {
  const def = HEAD_GEAR[set];
  const tmp = createImage(24, 24);
  if (def.hairMode === 'hood') {
    // side profile reads best for a hood: dark interior where the face goes
    forEllipse(2, def.side.y0 + 5, 7, 9, (x, y) => setPixel(tmp, x, y, shade(def.key['b'] ?? 0x333333, -0.5)));
    drawTemplate(tmp, def.side.rows, 0, 0 + def.side.y0, def.key);
    const o = mk();
    layer(o, (l) => blit(l, centerInto(tmp), 0, 0), 0.3);
    return o;
  }
  const rows = def.front.rows.map((r) => (r.length > 16 && (set === 'scholar' || set === 'warden') ? r.slice(1, 17) : r));
  // hood / helm interior shadow where the face would be
  if (def.hairMode !== 'cap') {
    forEllipse(set === 'iron_guardian' ? 5 : 5, def.front.y0 + 5, set === 'iron_guardian' ? 10 : 10, 9, (x, y) =>
      setPixel(tmp, x, y, set === 'iron_guardian' ? hex('#3a3346') : shade(def.key['b'] ?? 0x333333, -0.45)),
    );
  }
  drawTemplate(tmp, rows, set === 'scholar' || set === 'warden' ? 1 : 0, 0, def.key);
  const out = mk();
  layer(out, (l) => blit(l, centerInto(tmp), 0, 0), 0.3);
  return out;
}

function chestIcon(set: EquipmentSet): PixelImage {
  const st = CHEST_STYLES[set];
  const img = mk();
  const robe = st.hemY > 0;
  layer(img, (l) => {
    // sleeves
    for (let y = 3; y <= 9; y++) {
      const reach = y - 3;
      for (let x = 0; x < 3; x++) {
        setPixel(l, 4 - Math.min(reach, 3) + x - 1, y, x === 0 ? st.sleeve.light : st.sleeve.base);
        setPixel(l, 11 + Math.min(reach, 3) - x + 1, y, x === 0 ? st.sleeve.shadow : st.sleeve.base);
      }
    }
    if (st.glove) {
      for (const [x, y] of [
        [0, 10],
        [1, 10],
        [14, 10],
        [15, 10],
      ] as const)
        setPixel(l, x, y, st.glove.base);
    }
    // body
    const bottom = robe ? 14 : 12;
    for (let y = 2; y <= bottom; y++) {
      const flare = robe && y > 10 ? y - 10 : 0;
      const l0 = (y === 2 ? 5 : 4) - flare;
      const r0 = (y === 2 ? 10 : 11) + flare;
      for (let x = l0; x <= r0; x++) {
        const main = st.pattern === 'vest' || st.pattern === 'coat' ? st.over : st.shirt;
        let c = x <= l0 ? main.light : x >= r0 ? main.shadow : main.base;
        if (st.pattern === 'plate' && x === l0 + 1) c = main.hi;
        if (y === bottom) c = robe ? st.trim.base : main.shadow;
        setPixel(l, x, y, c);
      }
    }
    // collar / centre details
    setPixel(l, 7, 2, st.pattern === 'plate' ? st.shirt.light : hex('#3a2a26'));
    setPixel(l, 8, 2, st.pattern === 'plate' ? st.shirt.light : hex('#3a2a26'));
    if (st.pattern === 'vest' || st.pattern === 'coat') for (let y = 3; y <= 6; y++) for (const x of [7, 8]) setPixel(l, x, y, st.shirt.base);
    if (st.pattern === 'robe' || st.pattern === 'starRobe') for (let y = 3; y <= 13; y++) setPixel(l, 7, y, st.trim.base);
    if (st.pattern === 'coat') for (const y of [8, 10]) setPixel(l, 8, y, st.trim.light);
    if (st.pattern === 'plate') for (let y = 8; y <= 12; y++) for (const x of [7, 8]) setPixel(l, x, y, x === 7 ? st.trim.light : st.trim.base);
    if (st.pattern === 'starRobe')
      for (const [x, y] of [
        [5, 5],
        [10, 7],
        [5, 11],
        [10, 12],
        [9, 4],
      ] as const)
        setPixel(l, x, y, st.trim.light);
    if (st.belt && st.pattern !== 'coat' && st.pattern !== 'robe' && st.pattern !== 'starRobe') {
      for (let x = 4; x <= 11; x++) setPixel(l, x, 9, st.belt.base);
      setPixel(l, 7, 9, GEAR.gold.light);
      setPixel(l, 8, 9, GEAR.gold.base);
    }
    if (st.pauldrons) {
      ball(l, 1, 2, 5, 4, st.pauldrons);
      ball(l, 10, 2, 5, 4, st.pauldrons);
    }
  }, 0);
  return img;
}

function backIcon(set: EquipmentSet): PixelImage {
  const st = BACK_STYLES[set];
  const img = mk();
  switch (st.kind) {
    case 'cape':
      layer(img, (l) => {
        for (let y = 2; y <= 14; y++) {
          const half = 3 + (y - 2) * 0.42;
          for (let x = Math.round(8 - half); x < Math.round(8 + half); x++) {
            const t = (x - (8 - half)) / (2 * half);
            let c = t < 0.25 ? st.main.light : t > 0.75 ? st.main.shadow : st.main.base;
            if (y > 5 && (Math.abs(t - 0.4) < 0.05 || Math.abs(t - 0.65) < 0.05)) c = st.main.shadow;
            if (y === 14) c = st.main.deep;
            if (st.stars && (x * 3 + y) % 7 === 0 && y < 14) c = st.accent.light;
            setPixel(l, x, y, c);
          }
        }
        for (let x = 5; x <= 10; x++) setPixel(l, x, 2, st.main.hi);
      }, 0);
      layer(img, (l) => box(l, 7, 2, 2, 2, st.accent === GEAR.gold ? GEAR.gold : GEAR.gold), 0.3);
      break;
    case 'shield':
      layer(img, (l) => {
        forEllipse(1, 1, 14, 14, (x, y, nx, ny) => {
          const d = nx * nx + ny * ny;
          let c = d > 0.65 ? (nx + ny < 0 ? st.accent.light : st.accent.shadow) : nx + ny < -0.4 ? st.main.light : nx + ny > 0.4 ? st.main.shadow : st.main.base;
          if (d <= 0.65 && (x === 7 || y === 7)) c = GEAR.gold.base;
          if (d < 0.05) c = st.accent.hi;
          setPixel(l, x, y, c);
        });
      }, 0);
      break;
    case 'scrollcase':
      layer(img, (l) => {
        thickLine(l, 2, 11, 10, 3, 3, (t, i) => {
          const r = t < 0.14 || t > 0.86 ? st.accent : st.main;
          return i === 0 ? r.light : i === 2 ? r.shadow : r.base;
        });
        // rolled parchment peeking out of the open end
        setPixel(l, 11, 2, 0xf3e6c4);
        setPixel(l, 12, 2, 0xe0cfa4);
        setPixel(l, 12, 1, 0xf3e6c4);
        // middle band
        thickLine(l, 5, 7, 7, 9, 1, () => st.accent.base);
      }, 0);
      break;
    case 'satchel':
      layer(img, (l) => {
        // strap loop
        for (let x = 4; x <= 11; x++) setPixel(l, x, 2 + (x === 4 || x === 11 ? 1 : 0), st.strap.base);
        for (let y = 3; y <= 6; y++) {
          setPixel(l, 4, y, st.strap.base);
          setPixel(l, 11, y, st.strap.base);
        }
        // bag
        for (let y = 6; y <= 14; y++)
          for (let x = 2; x <= 13; x++) {
            if (y === 14 && (x === 2 || x === 13)) continue;
            let c = x === 2 ? st.main.light : x === 13 ? st.main.shadow : st.main.base;
            if (y === 14) c = st.main.deep;
            if (y <= 9) c = x === 2 ? st.main.hi : y === 9 ? st.main.shadow : st.main.light;
            setPixel(l, x, y, c);
          }
        setPixel(l, 7, 10, GEAR.gold.light);
        setPixel(l, 8, 10, GEAR.gold.base);
      }, 0);
      break;
  }
  return img;
}

/** Standalone 16×16 inventory icon for an equipment visual id. */
export function renderItemIcon(id: EquipVisual): PixelImage {
  const { set, slot } = parseEquipVisual(id);
  switch (slot) {
    case 'weapon':
      return weaponIcon(set);
    case 'head':
      return headIcon(set);
    case 'chest':
      return chestIcon(set);
    case 'back':
      return backIcon(set);
  }
}

export { iconPotion as _potionIcon };
void mix;
