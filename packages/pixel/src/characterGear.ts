/**
 * Equipment visual definitions: head-gear templates, chest outfit styles,
 * back items and weapons. Geometry that depends on the body tier is drawn
 * parametrically in character.ts; this file holds the art data.
 */
import { type Color } from './image';
import { hex, ramp, type Ramp } from './palette';

export const EQUIPMENT_SETS = ['traveler', 'forest_scout', 'iron_guardian', 'scholar', 'dreamwalker', 'warden'] as const;
export type EquipmentSet = (typeof EQUIPMENT_SETS)[number];
export const EQUIPMENT_SLOTS = ['head', 'chest', 'weapon', 'back'] as const;
export type EquipmentSlot = (typeof EQUIPMENT_SLOTS)[number];
export type EquipVisual = `${EquipmentSet}_${EquipmentSlot}`;

export const EQUIPMENT_VISUAL_IDS: readonly EquipVisual[] = EQUIPMENT_SETS.flatMap((s) =>
  EQUIPMENT_SLOTS.map((slot) => `${s}_${slot}` as EquipVisual),
);

export function parseEquipVisual(id: EquipVisual): { set: EquipmentSet; slot: EquipmentSlot } {
  const slot = EQUIPMENT_SLOTS.find((s) => id.endsWith('_' + s));
  if (!slot) throw new Error(`Unknown equipment visual id: ${id}`);
  const set = id.slice(0, id.length - slot.length - 1) as EquipmentSet;
  if (!EQUIPMENT_SETS.includes(set)) throw new Error(`Unknown equipment visual id: ${id}`);
  return { set, slot };
}

/* ------------------------------------------------------------------ */
/* Shared colours                                                      */
/* ------------------------------------------------------------------ */

export const GEAR = {
  gold: ramp('#f0c24b'),
  steel: ramp('#b4bfcc'),
  iron: ramp('#7e8899'),
  leather: ramp('#9b653a'),
  darkLeather: ramp('#5f3d27'),
  wood: ramp('#9a6a3e'),
  brown: ramp('#8a5a36'),
  beige: ramp('#d9c49a'),
  cream: ramp('#efe3c6'),
  green: ramp('#5b9a45'),
  forest: ramp('#3f7a3e'),
  moss: ramp('#7d8f45'),
  blue: ramp('#4a6fc2'),
  navy: ramp('#2f3f78'),
  purple: ramp('#6a4aa8'),
  night: ramp('#3b2f6e'),
  teal: ramp('#2e6f6c'),
  darkTeal: ramp('#24484f'),
  charcoal: ramp('#3b3a4a'),
  red: ramp('#c8463c'),
  star: ramp('#ffe58a'),
  white: ramp('#f4efe6'),
  glowBlue: ramp('#8fe3ff'),
} as const;

/* ------------------------------------------------------------------ */
/* Head gear                                                           */
/* ------------------------------------------------------------------ */

/**
 * How head gear interacts with hair:
 * - cap: hair above `capLine` is hidden (hat sits on top, hair shows below)
 * - hood: only fringe inside the face opening is kept
 * - helm: all hair hidden
 */
export type HairMode = 'cap' | 'hood' | 'helm';

export interface HeadGearDef {
  hairMode: HairMode;
  capLine: number;
  /** Template key → colour. */
  key: Record<string, Color>;
  front: { y0: number; rows: readonly string[] };
  back: { y0: number; rows: readonly string[] };
  side: { y0: number; rows: readonly string[] };
}

function rk(r: Ramp, prefix: { h?: string; b?: string; s?: string; d?: string; l?: string }): Record<string, Color> {
  const o: Record<string, Color> = {};
  if (prefix.l) o[prefix.l] = r.hi;
  if (prefix.h) o[prefix.h] = r.light;
  if (prefix.b) o[prefix.b] = r.base;
  if (prefix.s) o[prefix.s] = r.shadow;
  if (prefix.d) o[prefix.d] = r.deep;
  return o;
}

export const HEAD_GEAR: Record<EquipmentSet, HeadGearDef> = {
  traveler: {
    hairMode: 'cap',
    capLine: 6,
    key: {
      ...rk(GEAR.brown, { h: 'h', b: 'b', s: 's', d: 'd' }),
      ...rk(GEAR.darkLeather, { b: 'x', s: 'X' }),
      ...rk(GEAR.cream, { h: 'k', s: 'K' }),
    },
    front: {
      y0: 2,
      rows: [
        '......bbbbbb......',
        '....bbhhbbbbkb....',
        '...bhhbbbbbkKbs...',
        '...bhbbbbbbbbbs...',
        '...xxxxxxxxxxxX...',
        '..ssbbbbbbbbbbss..',
      ],
    },
    back: {
      y0: 2,
      rows: [
        '......bbbbbb......',
        '....bkbbbbbbbb....',
        '...bKkbbbbbbbbs...',
        '...bbbbbbbbbbbs...',
        '...xxxxxxxxxxxX...',
        '..ssbbbbbbbbbbss..',
      ],
    },
    side: {
      y0: 2,
      rows: [
        '......bbbbbb......',
        '....bbhhbbbbkb....',
        '...bhhbbbbbkKbs...',
        '...bhbbbbbbbbbs...',
        '...xxxxxxxxxxxX...',
        'hbbbbbbbbbbbbss...',
      ],
    },
  },
  forest_scout: {
    hairMode: 'hood',
    capLine: 7,
    key: {
      ...rk(GEAR.forest, { l: 'l', h: 'h', b: 'b', s: 's', d: 'd' }),
      ...rk(GEAR.leather, { b: 'x' }),
    },
    front: {
      y0: 2,
      rows: [
        '......bbbbbb......',
        '....bbhhbbbbbb....',
        '...bhhbbbbbbbbs...',
        '..bhhbbbbbbbbbbs..',
        '..bhbdddddddddbs..',
        '..bbd........dbs..',
        '..bbd........dbs..',
        '..bbs........sbs..',
        '..bbs........sbs..',
        '..bbs........sbs..',
        '..bbbs......sbbs..',
        '..bhbbsssssssbbs..',
        '..bbhbbbxxbbbbbs..',
        '...sbbbbbbbbbss...',
      ],
    },
    back: {
      y0: 2,
      rows: [
        '......bbbbbb......',
        '....bbhhbbbbbb....',
        '...bhhbbbbbbbbs...',
        '..bhhbbbbbbbbbbs..',
        '..bhbbbbbbbbbbbs..',
        '..bbbbbbbbbbbbbs..',
        '..bbbbbbbbbbbbbs..',
        '..bbbbbbsbbbbbbs..',
        '..bbbbbbsbbbbbbs..',
        '..bbbbbbsbbbbbbs..',
        '..bbbbbbsbbbbbbs..',
        '..bbbbbbbsbbbbbs..',
        '..bbbbbbbsbbbbbs..',
        '...sbbbbbbbbbss...',
        '......sbbbs.......',
        '.......sbs........',
      ],
    },
    side: {
      y0: 2,
      rows: [
        '......bbbbbb......',
        '....bbhhbbbbbb....',
        '...bhhbbbbbbbbs...',
        '..bhhbbbbbbbbbbs..',
        '..bhbbbbbbbbbbbs..',
        '..bdd...bbbbbbbs..',
        '...d....bbbbbbbs..',
        '........dbbbbbbs..',
        '........dbbbbbbs..',
        '........dbbbbbbs..',
        '........dbbbbbbs..',
        '........dbbbbbbs..',
        '....bbbbbbbbbbs...',
        '....bhbbbxbbbbs...',
        '.....sbbbbbbss....',
      ],
    },
  },
  iron_guardian: {
    hairMode: 'helm',
    capLine: 0,
    key: {
      ...rk(GEAR.steel, { l: 'l', h: 'h', b: 'b', s: 's', d: 'd' }),
      ...rk(GEAR.red, { h: 'k', b: 'K', s: 'X' }),
    },
    front: {
      y0: 0,
      rows: [
        '.......kKK........',
        '......kKKKX.......',
        '......bbbbbb......',
        '....bbhllhbbbb....',
        '...bhllhbbbbbbs...',
        '...bhlhbbbbbbbs...',
        '...bhbbbbbbbbbs...',
        '...dddddddddddd...',
        '...bhs......sbs...',
        '...bh........bs...',
        '...bh........bs...',
        '...bhs......sbs...',
        '....s........s....',
      ],
    },
    back: {
      y0: 0,
      rows: [
        '........KKk.......',
        '.......XKKKk......',
        '......bbbbbb......',
        '....bbhllhbbbb....',
        '...bhllhbbbbbbs...',
        '...bhlhbbbbbbbs...',
        '...bhbbbbbbbbbs...',
        '...dddddddddddd...',
        '...bhbbbbbbbbbs...',
        '...bhbbbbbbbbbs...',
        '...bhbbbbbbbbbs...',
        '...sbbbbbbbbbss...',
        '....ssssssssss....',
      ],
    },
    side: {
      y0: 0,
      rows: [
        '........kKKX......',
        '.......kKKKKX.....',
        '......bbbbbb......',
        '....bbhllhbbbb....',
        '...bhllhbbbbbbs...',
        '...bhlhbbbbbbbs...',
        '...bhbbbbbbbbbs...',
        '..dddddddddddds...',
        '........bbbbbbs...',
        '........bbbbbbs...',
        '........bhbbbbs...',
        '........sbbbbss...',
        '.........ssss.....',
      ],
    },
  },
  scholar: {
    hairMode: 'cap',
    capLine: 6,
    key: {
      ...rk(GEAR.blue, { l: 'l', h: 'h', b: 'b', s: 's', d: 'd' }),
      ...rk(GEAR.gold, { h: 'g', b: 'G' }),
      ...rk(GEAR.star, { l: 'k' }),
    },
    front: {
      y0: 0,
      rows: [
        '............bs....',
        '...........hbs....',
        '..........hbbs....',
        '........hhbbbs....',
        '......hhbbbbbbs...',
        '.....hbbbkbbbbs...',
        '....hbbbbbbbbbbs..',
        '...GgggggggggggG..',
        '.hbbbbbbbbbbbbbbs.',
      ],
    },
    back: {
      y0: 0,
      rows: [
        '....sb............',
        '....sbh...........',
        '....sbbh..........',
        '....sbbbhh........',
        '...sbbbbbbhh......',
        '...sbbbbbbbbh.....',
        '..sbbbbbbbbbbh....',
        '..GgggggggggggG...',
        '.hbbbbbbbbbbbbbbs.',
      ],
    },
    side: {
      y0: 0,
      rows: [
        '...........bs.....',
        '..........hbbs....',
        '.........hbbbs....',
        '........hhbbbs....',
        '......hhbbbbbbs...',
        '.....hbbbbbbbbs...',
        '....hbbbbbbbbbbs..',
        '...GgggggggggggG..',
        'hbbbbbbbbbbbbbbs..',
      ],
    },
  },
  dreamwalker: {
    hairMode: 'hood',
    capLine: 7,
    key: {
      ...rk(GEAR.purple, { l: 'l', h: 'h', b: 'b', s: 's', d: 'd' }),
      ...rk(GEAR.night, { b: 'n', s: 'N' }),
      ...rk(GEAR.star, { l: 'k', b: 'K' }),
    },
    front: {
      y0: 1,
      rows: [
        '..............bs..',
        '......bbbbbbbbs...',
        '....bbhhbbbbbbs...',
        '...bhhbbbkbbbbs...',
        '..bhhbbbkkkbbbbs..',
        '..bhbNNNNkNNNNbs..',
        '..bbN........Nbs..',
        '..bbN........Nbs..',
        '..bbs........sbs..',
        '..bbs........sbs..',
        '..bbs........sbs..',
        '..bbbs......sbbs..',
        '..bhbbsssssssbbs..',
        '..bbhbbbKKbbbbbs..',
        '...sbbbbbbbbbss...',
      ],
    },
    back: {
      y0: 1,
      rows: [
        '..sb..............',
        '...sbbbbbbbb......',
        '....bbhhbbbbbb....',
        '...bhhbbbbbbbbs...',
        '..bhhbbbbbbbbbbs..',
        '..bhbbbbbbbbbbbs..',
        '..bbbbbbbbbbbbbs..',
        '..bbbbbbbbbkbbbs..',
        '..bbbbbbbbbbbbbs..',
        '..bbbkbbbbbbbbbs..',
        '..bbbbbbbbbbbbbs..',
        '..bbbbbbbbbbbbbs..',
        '..bbbbbbbbbkbbbs..',
        '..bbbbbbbbbbbbbs..',
        '...sbbbbbbbbbss...',
        '......sbbbs.......',
      ],
    },
    side: {
      y0: 1,
      rows: [
        '............bbs...',
        '......bbbbbbbs....',
        '....bbhhbbbbbs....',
        '...bhhbbbbbbbbs...',
        '..bhhbbbbbbbbbbs..',
        '..bhbbbbbbbkbbbs..',
        '..bNN...bbbbbbbs..',
        '...N....bbbbbbbs..',
        '........Nbbbbbbs..',
        '........Nbbbkbbs..',
        '........Nbbbbbbs..',
        '........Nbbbbbbs..',
        '........Nbbbbbbs..',
        '....bbbbbbbbbbs...',
        '....bhbbbKbbbbs...',
        '.....sbbbbbbss....',
      ],
    },
  },
  warden: {
    hairMode: 'cap',
    capLine: 7,
    key: {
      ...rk(GEAR.darkTeal, { b: 'b', s: 's', d: 'd' }),
      ...rk(GEAR.teal, { l: 'l', b: 'x' }),
      ...rk(GEAR.gold, { h: 'g', b: 'G' }),
      ...rk(GEAR.white, { b: 'k', s: 'K' }),
    },
    front: {
      y0: 1,
      rows: [
        '......xxxxxx......',
        '.g..xxllxxxxxx..g.',
        '.bg.xlxxxxxxxxxgb.',
        '.bbgxxxxxxxxxxgbb.',
        '.bbbggxxxxxxggbbs.',
        '..bbbbggxxggbbbs..',
        '...sbbbbggbbbbs...',
        '.....ssbbbbss.....',
      ],
    },
    back: {
      y0: 1,
      rows: [
        '......xxxxxx......',
        '.g..xxllxxxxxx..g.',
        '.bg.xlxxxxxxxxxgb.',
        '.bbgxxxxxxxxxxgbb.',
        '.bbbbgxxxxxxgbbbs.',
        '..bbbbbgggbbbbbs..',
        '...sbbbbbbbbbbs...',
        '.....ssbbbbss.....',
      ],
    },
    side: {
      y0: 1,
      rows: [
        '.......xxxxx......',
        '.....xxllxxxxx....',
        '.g..xlxxxxxxxxx.g.',
        '.bg.xxxxxxxxxxxgb.',
        '.bbggggggggggggbb.',
        '..sbbbbbbbbbbbbs..',
        '....ssbbbbbbss....',
      ],
    },
  },
};

/* ------------------------------------------------------------------ */
/* Chest outfits                                                       */
/* ------------------------------------------------------------------ */

export type ChestPattern = 'tunic' | 'traveler' | 'vest' | 'plate' | 'robe' | 'starRobe' | 'coat';

export interface ChestStyle {
  pattern: ChestPattern;
  shirt: Ramp;
  /** Secondary / overlay colour (vest, plate, coat lapels). */
  over: Ramp;
  trim: Ramp;
  sleeve: Ramp;
  /** null = bare hands. */
  glove: Ramp | null;
  trousers: Ramp;
  boots: Ramp;
  belt: Ramp | null;
  /** Robe/coat skirt: last fill row (frame y at pose offset 0), or 0 for none. */
  hemY: number;
  /** Coat skirts open in the middle to show the legs. */
  splitHem: boolean;
  /** Shoulder pads drawn over the top of the arms. */
  pauldrons: Ramp | null;
}

export const DEFAULT_CHEST: ChestStyle = {
  pattern: 'tunic',
  shirt: ramp('#e6d9bd'),
  over: ramp('#e6d9bd'),
  trim: ramp('#b9a57e'),
  sleeve: ramp('#e6d9bd'),
  glove: null,
  trousers: ramp('#5d6f92'),
  boots: ramp('#6a4430'),
  belt: ramp('#7a4f30'),
  hemY: 0,
  splitHem: false,
  pauldrons: null,
};

export const CHEST_STYLES: Record<EquipmentSet, ChestStyle> = {
  traveler: {
    pattern: 'traveler',
    shirt: ramp('#d9bf8c'),
    over: ramp('#b78a55'),
    trim: ramp('#8f6640'),
    sleeve: ramp('#d9bf8c'),
    glove: ramp('#8a5a36'),
    trousers: ramp('#6e5a44'),
    boots: ramp('#6b432a'),
    belt: ramp('#5f3d27'),
    hemY: 24,
    splitHem: false,
    pauldrons: null,
  },
  forest_scout: {
    pattern: 'vest',
    shirt: ramp('#6fa34e'),
    over: ramp('#9b653a'),
    trim: ramp('#c38d55'),
    sleeve: ramp('#5f9444'),
    glove: ramp('#7d4f2e'),
    trousers: ramp('#46603a'),
    boots: ramp('#6b432a'),
    belt: ramp('#5f3d27'),
    hemY: 0,
    splitHem: false,
    pauldrons: null,
  },
  iron_guardian: {
    pattern: 'plate',
    shirt: ramp('#b4bfcc'),
    over: ramp('#b4bfcc'),
    trim: ramp('#c8463c'),
    sleeve: ramp('#8b95a5'),
    glove: ramp('#a3aebd'),
    trousers: ramp('#4e566a'),
    boots: ramp('#8b95a5'),
    belt: ramp('#6b4a32'),
    hemY: 0,
    splitHem: false,
    pauldrons: ramp('#c2ccd8'),
  },
  scholar: {
    pattern: 'robe',
    shirt: ramp('#4a6fc2'),
    over: ramp('#4a6fc2'),
    trim: ramp('#f0c24b'),
    sleeve: ramp('#4a6fc2'),
    glove: null,
    trousers: ramp('#2f3f78'),
    boots: ramp('#5a3d2c'),
    belt: ramp('#f0c24b'),
    hemY: 27,
    splitHem: false,
    pauldrons: null,
  },
  dreamwalker: {
    pattern: 'starRobe',
    shirt: ramp('#6a4aa8'),
    over: ramp('#3b2f6e'),
    trim: ramp('#ffe58a'),
    sleeve: ramp('#6a4aa8'),
    glove: null,
    trousers: ramp('#3b2f6e'),
    boots: ramp('#3b2f6e'),
    belt: ramp('#ffe58a'),
    hemY: 28,
    splitHem: false,
    pauldrons: null,
  },
  warden: {
    pattern: 'coat',
    shirt: ramp('#d8cdb4'),
    over: ramp('#2e6f6c'),
    trim: ramp('#f0c24b'),
    sleeve: ramp('#2e6f6c'),
    glove: ramp('#5f3d27'),
    trousers: ramp('#3b3a4a'),
    boots: ramp('#4a3226'),
    belt: ramp('#5f3d27'),
    hemY: 27,
    splitHem: true,
    pauldrons: null,
  },
};

/* ------------------------------------------------------------------ */
/* Back items                                                          */
/* ------------------------------------------------------------------ */

export type BackKind = 'satchel' | 'cape' | 'shield' | 'scrollcase';

export interface BackStyle {
  kind: BackKind;
  main: Ramp;
  accent: Ramp;
  strap: Ramp;
  /** Cape-only: last fill row. */
  hemY: number;
  stars: boolean;
}

export const BACK_STYLES: Record<EquipmentSet, BackStyle> = {
  traveler: { kind: 'satchel', main: GEAR.leather, accent: GEAR.gold, strap: GEAR.darkLeather, hemY: 0, stars: false },
  forest_scout: { kind: 'cape', main: GEAR.forest, accent: GEAR.gold, strap: GEAR.darkLeather, hemY: 27, stars: false },
  iron_guardian: { kind: 'shield', main: ramp('#3f63b5'), accent: GEAR.steel, strap: GEAR.darkLeather, hemY: 0, stars: false },
  scholar: { kind: 'scrollcase', main: ramp('#8a5a36'), accent: GEAR.gold, strap: GEAR.darkLeather, hemY: 0, stars: false },
  dreamwalker: { kind: 'cape', main: ramp('#30285e'), accent: GEAR.star, strap: GEAR.gold, hemY: 28, stars: true },
  warden: { kind: 'cape', main: ramp('#283a40'), accent: GEAR.gold, strap: GEAR.darkLeather, hemY: 28, stars: false },
};

/* ------------------------------------------------------------------ */
/* Weapons                                                             */
/* ------------------------------------------------------------------ */

/**
 * Weapons are authored pointing straight up. `pivotX/pivotY` is the grip
 * point that sits in the hand. `rotates: false` items (bow, book) are
 * always drawn upright.
 */
export interface WeaponDef {
  rotates: boolean;
  /** Orientation when not attacking. */
  rest: 'up' | 'down';
  pivotX: number;
  pivotY: number;
  key: Record<string, Color>;
  rows: readonly string[];
  /** Colour of the swing smear. */
  smear: Color;
}

export const WEAPONS: Record<EquipmentSet, WeaponDef> = {
  traveler: {
    rotates: true,
    rest: 'up',
    pivotX: 2,
    pivotY: 14,
    smear: hex('#fff3d6'),
    key: { ...rk(GEAR.wood, { h: 'h', b: 'b', s: 's', d: 'd' }), ...rk(GEAR.leather, { b: 'x' }), ...rk(GEAR.green, { h: 'g' }) },
    rows: [
      '.bbs.',
      'bh.bs',
      'b..bs',
      '.hbs.',
      '..bg.',
      '..b..',
      '..b..',
      '..s..',
      '..b..',
      '..b..',
      '..b..',
      '..s..',
      '..x..',
      '..x..',
      '..x..',
      '..b..',
      '..b..',
      '..s..',
      '..b..',
      '..b..',
      '..s..',
    ],
  },
  forest_scout: {
    rotates: false,
    rest: 'up',
    pivotX: 1,
    pivotY: 7,
    smear: hex('#e9ffd6'),
    key: { ...rk(GEAR.wood, { h: 'h', b: 'b', s: 's' }), w: hex('#cdbfa6'), ...rk(GEAR.green, { b: 'g' }) },
    rows: [
      '..hw',
      '.hb.w',
      '.b..w',
      'hb..w',
      'b...w',
      'b...w',
      'g...w',
      'g...w',
      'b...w',
      'b...w',
      'sb..w',
      '.b..w',
      '.sb.w',
      '..sw',
    ].map((r) => r.padEnd(5, '.')),
  },
  iron_guardian: {
    rotates: true,
    rest: 'down',
    pivotX: 2,
    pivotY: 9,
    smear: hex('#eaf6ff'),
    key: {
      ...rk(GEAR.steel, { l: 'l', h: 'h', b: 'b', s: 's' }),
      ...rk(GEAR.gold, { h: 'g', b: 'G' }),
      ...rk(GEAR.darkLeather, { b: 'x' }),
    },
    rows: [
      '..l..',
      '..ls.',
      '..ls.',
      '..ls.',
      '..ls.',
      '..ls.',
      '..ls.',
      '.gGGG',
      '..x..',
      '..x..',
      '..g..',
    ],
  },
  scholar: {
    rotates: false,
    rest: 'up',
    pivotX: 1,
    pivotY: 3,
    smear: hex('#c9f1ff'),
    key: {
      ...rk(GEAR.navy, { h: 'h', b: 'b', s: 's' }),
      ...rk(GEAR.gold, { h: 'g', b: 'G' }),
      w: hex('#f4efe6'),
      W: hex('#d9cfbd'),
    },
    rows: ['.hhhhhw', 'hbbbbbW', 'hbgggbw', 'hbgGgbW', 'hbbgbbw', 'hbbbbbW', 'sssssss'],
  },
  dreamwalker: {
    rotates: true,
    rest: 'up',
    pivotX: 3,
    pivotY: 15,
    smear: hex('#f2dcff'),
    key: {
      ...rk(GEAR.night, { h: 'h', b: 'b', s: 's' }),
      ...rk(GEAR.star, { l: 'k', b: 'K', s: 'S' }),
      ...rk(GEAR.purple, { h: 'p' }),
    },
    rows: [
      '.kKK..',
      'kK....',
      'K.....',
      'K.....',
      'kK....',
      '.kKKp.',
      '...h..',
      '...b..',
      '...b..',
      '...s..',
      '...b..',
      '...b..',
      '...b..',
      '...s..',
      '...b..',
      '...b..',
      '...s..',
      '...b..',
      '...b..',
      '...s..',
    ],
  },
  warden: {
    rotates: true,
    rest: 'up',
    pivotX: 2,
    pivotY: 15,
    smear: hex('#dff7f2'),
    key: {
      ...rk(GEAR.steel, { l: 'l', h: 'h', b: 'b', s: 's' }),
      ...rk(GEAR.darkLeather, { h: 'w', b: 'x', s: 'X' }),
      ...rk(GEAR.teal, { h: 't', b: 'T' }),
    },
    rows: [
      '..l..',
      '.lhs.',
      '.lbs.',
      '.lbs.',
      '..s..',
      '.tTt.',
      '.tTT.',
      '..x..',
      '..w..',
      '..x..',
      '..x..',
      '..X..',
      '..x..',
      '..x..',
      '..x..',
      '..X..',
      '..x..',
      '..x..',
      '..X..',
      '..x..',
      '..x..',
      '..X..',
    ],
  },
};
