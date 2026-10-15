/**
 * Writes PNG previews (4× nearest-neighbour) of every asset family to
 * packages/pixel/preview/, plus a combined contact sheet.
 *
 *   pnpm --filter @realmbound/pixel preview
 */
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  type Appearance,
  type PixelImage,
  ANIMATION_DEFS,
  ANIMATION_NAMES,
  AURA_KINDS,
  DIRECTIONS,
  EQUIPMENT_SETS,
  EQUIPMENT_VISUAL_IDS,
  ICON_NAMES,
  MONSTER_IDS,
  PROP_NAMES,
  TILE_NAMES,
  VFX_IDS,
  blit,
  createImage,
  fillRect,
  renderAuraSheet,
  renderCharacterFrame,
  renderCharacterSheet,
  renderIcon,
  renderItemIcon,
  renderMonster,
  renderProp,
  renderTile,
  renderVfx,
  setPixel,
  CONDITIONS,
} from '../src/index';
import { savePng } from './png';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'preview');
const SCALE = 4;
const BG = 0x8fbf6a;
const DARK_BG = 0x3b3550;

/* ----------------------------- tiny font ----------------------------- */

const FONT: Record<string, string> = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
  K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
  P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
  Z: '111001010100111', '0': '111101101101111', '1': '010110010010111', '2': '110001010100111', '3': '110001010001110',
  '4': '101101111001001', '5': '111100110001110', '6': '011100110101010', '7': '111001010010010', '8': '010101010101010',
  '9': '010101011001110', ' ': '000000000000000', '-': '000000111000000', _: '000000000000111', '/': '001001010100100',
};

function text(img: PixelImage, x: number, y: number, s: string, col = 0xfbf6ec): void {
  for (const ch of s.toUpperCase()) {
    const g = FONT[ch] ?? FONT[' ']!;
    for (let i = 0; i < 15; i++) if (g[i] === '1') setPixel(img, x + (i % 3), y + Math.floor(i / 3), col);
    x += 4;
  }
}

/* ------------------------------ layout ------------------------------- */

interface Cell {
  img: PixelImage;
  label?: string;
}

/** Grid of cells with optional captions under each, and a title on top. */
function board(title: string, rows: Cell[][], bg = BG, pad = 3): PixelImage {
  const cells = rows.flat();
  const cw = Math.max(...cells.map((c) => Math.max(c.img.width, (c.label?.length ?? 0) * 4 - 1)));
  const ch = Math.max(...cells.map((c) => c.img.height));
  const labelH = cells.some((c) => c.label) ? 7 : 0;
  const cols = Math.max(...rows.map((r) => r.length));
  const titleH = title ? 10 : 0;
  const w = Math.max(cols * (cw + pad) + pad, title.length * 4 + 8);
  const out = createImage(w, titleH + rows.length * (ch + labelH + pad) + pad);
  const lum = ((bg >> 16) & 255) * 0.3 + ((bg >> 8) & 255) * 0.59 + (bg & 255) * 0.11;
  const labelCol = lum < 110 ? 0xfbf6ec : 0x2a2033;
  fillRect(out, 0, 0, out.width, out.height, bg);
  if (title) {
    fillRect(out, 0, 0, out.width, 9, 0x2a2033);
    text(out, 3, 2, title);
  }
  rows.forEach((r, ri) =>
    r.forEach((c, ci) => {
      const x0 = pad + ci * (cw + pad);
      const y0 = titleH + pad + ri * (ch + labelH + pad);
      blit(out, c.img, x0 + Math.floor((cw - c.img.width) / 2), y0 + (ch - c.img.height));
      if (c.label) text(out, x0, y0 + ch + 1, c.label, labelCol);
    }),
  );
  return out;
}

function stack(images: PixelImage[], gap = 4, bg = 0x2a2033): PixelImage {
  const w = Math.max(...images.map((i) => i.width));
  const h = images.reduce((a, i) => a + i.height + gap, -gap);
  const out = createImage(w, h);
  fillRect(out, 0, 0, w, h, bg);
  let y = 0;
  for (const i of images) {
    blit(out, i, 0, y);
    y += i.height + gap;
  }
  return out;
}

const chunk = <T,>(arr: T[], n: number): T[][] => {
  const r: T[][] = [];
  for (let i = 0; i < arr.length; i += n) r.push(arr.slice(i, i + n));
  return r;
};

/* ----------------------------- characters ---------------------------- */

const base: Appearance = { bodyTier: 2, skinTone: 1, hairStyle: 0, hairColor: 2, face: 0, equipment: {} };
const fullSet = (s: (typeof EQUIPMENT_SETS)[number]): Appearance['equipment'] => ({
  head: `${s}_head`,
  chest: `${s}_chest`,
  weapon: `${s}_weapon`,
  back: `${s}_back`,
});

function characters(): PixelImage {
  const tiers = board(
    'Body tiers x directions',
    ([1, 2, 3] as const).map((t) =>
      DIRECTIONS.map((d) => ({ img: renderCharacterFrame({ ...base, bodyTier: t, skinTone: t + 1 }, 'idle', d, 0), label: d === 'down' ? `T${t}` : '' })),
    ),
  );
  const hair = board(
    'Hair styles / colours / skin / faces',
    chunk(
      Array.from({ length: 12 }, (_, h) => ({
        img: renderCharacterFrame({ ...base, hairStyle: h, hairColor: h % 8, skinTone: h % 6, face: h % 4 }, 'idle', h % 3 === 2 ? 'left' : 'down', 0),
        label: String(h),
      })),
      12,
    ),
  );
  const sets = board(
    'Equipment sets (all tiers)',
    EQUIPMENT_SETS.map((s, i) =>
      ([1, 2, 3] as const).flatMap((t) =>
        (['down', 'left', 'up'] as const).map((d) => ({
          img: renderCharacterFrame({ bodyTier: t, skinTone: (i + t) % 6, hairStyle: (i * 5 + t) % 12, hairColor: (i + t) % 8, face: i % 4, equipment: fullSet(s) }, 'idle', d, 0),
        })),
      ),
    ),
  );
  const conds = board(
    'Conditions',
    [CONDITIONS.map((c) => ({ img: renderCharacterFrame({ ...base, face: 0, hairStyle: 8, hairColor: 4 }, 'idle', 'down', 0, c), label: c.slice(0, 5) }))],
  );
  const hero: Appearance = { bodyTier: 2, skinTone: 2, hairStyle: 2, hairColor: 3, face: 0, equipment: fullSet('forest_scout') };
  const knight: Appearance = { bodyTier: 3, skinTone: 4, hairStyle: 6, hairColor: 0, face: 1, equipment: fullSet('iron_guardian') };
  const anims = board(
    'Animations (down / left)',
    ANIMATION_NAMES.flatMap((a) =>
      [hero, knight].map((app, k) => [
        ...(['down', 'left'] as const).flatMap((d) =>
          Array.from({ length: 4 }, (_, f) => ({
            img: f < ANIMATION_DEFS[a].frames ? renderCharacterFrame(app, a, d, f) : createImage(24, 32),
            label: f === 0 && d === 'down' && k === 0 ? a.slice(0, 5) : '',
          })),
        ),
      ]),
    ),
  );
  const auras = board(
    'Aura overlays',
    [
      AURA_KINDS.flatMap((k) =>
        renderAuraSheet(k).frames.map((fr, i) => {
          const img = renderCharacterFrame(base, 'idle', 'down', 0);
          blit(img, fr, 0, 0);
          return { img, label: i === 0 ? k.slice(0, 5) : '' };
        }),
      ),
    ],
    DARK_BG,
  );
  return stack([tiers, hair, sets, conds, anims, auras]);
}

/* ----------------------------- the rest ------------------------------ */

function tiles(): PixelImage {
  return board(
    'Tiles',
    chunk(
      TILE_NAMES.map((n) => ({ img: renderTile(n) })),
      12,
    ),
    DARK_BG,
    2,
  );
}

function props(): PixelImage {
  const all = PROP_NAMES.map((n) => renderProp(n));
  const big = all.filter((p) => p.image.width > 24 || p.image.height > 24);
  const small = all.filter((p) => !(p.image.width > 24 || p.image.height > 24));
  return stack([
    board('Props', chunk(big.flatMap((p) => p.frames.map((f) => ({ img: f }))), 6)),
    board('', chunk(small.flatMap((p) => p.frames.map((f) => ({ img: f }))), 14)),
  ]);
}

function monsters(): PixelImage {
  return stack(
    MONSTER_IDS.map((id, i) => {
      const m = renderMonster(id);
      return board(i === 0 ? 'Monsters' : '', [m.frames.map((f, k) => ({ img: f, label: k === 0 ? id.replace(/_/g, ' ') : '' }))]);
    }),
    0,
  );
}

function icons(): PixelImage {
  const ic = ICON_NAMES.map((n) => ({ img: renderIcon(n) }));
  const items = EQUIPMENT_VISUAL_IDS.map((id) => ({ img: renderItemIcon(id) }));
  return stack([board('Icons', chunk(ic, 14), DARK_BG, 3), board('Equipment items', chunk(items, 12), DARK_BG, 3)]);
}

function vfx(): PixelImage {
  return board(
    'VFX',
    VFX_IDS.map((id) => renderVfx(id).frames.map((f, i) => ({ img: f, label: i === 0 ? id.slice(0, 8) : '' }))),
    DARK_BG,
  );
}

function main(): void {
  const sheets: Record<string, PixelImage> = {
    characters: characters(),
    tiles: tiles(),
    props: props(),
    monsters: monsters(),
    icons: icons(),
    vfx: vfx(),
  };
  for (const [name, img] of Object.entries(sheets)) savePng(img, join(OUT, `${name}.png`), SCALE);
  // one full character sheet as the engine sees it
  const sheet = renderCharacterSheet({ bodyTier: 2, skinTone: 2, hairStyle: 1, hairColor: 4, face: 3, equipment: fullSet('dreamwalker') });
  savePng(sheet.image, join(OUT, 'character_sheet_example.png'), 2);
  // contact sheet: everything side by side (2×)
  const parts = [sheets.characters!, stack([sheets.tiles!, sheets.props!, sheets.monsters!, sheets.icons!, sheets.vfx!])];
  const w = parts.reduce((a, p) => a + p.width + 6, -6);
  const h = Math.max(...parts.map((p) => p.height));
  const contact = createImage(w, h);
  fillRect(contact, 0, 0, w, h, 0x2a2033);
  let x = 0;
  for (const p of parts) {
    blit(contact, p, x, 0);
    x += p.width + 6;
  }
  savePng(contact, join(OUT, 'contact_sheet.png'), 2);
  console.log(`Wrote previews to ${OUT}`);
}

main();
