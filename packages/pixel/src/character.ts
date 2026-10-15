/**
 * Procedural chibi character renderer (24×32 frames, 3/4 top-down view).
 *
 * Every body part is painted onto its own scratch layer, outlined with a
 * darker shade of its own colours, then composited in layer order. That
 * gives crisp silhouettes plus interior outlines (arm over torso, hair over
 * forehead) like hand-drawn sprites.
 */
import {
  type Color,
  type PixelImage,
  blit,
  clearImage,
  createImage,
  drawTemplate,
  fillEllipse,
  forEllipse,
  forLine,
  getAlpha,
  setPixel,
  blendPixel,
  rotate90,
} from './image';
import { HAIR_COLORS, SKIN_TONES, compositeOutlined, hash2, mix, rgbOf, ramp, shade, type Ramp } from './palette';
import { HAIR_STYLES, type HairTemplate } from './characterHair';
import {
  BACK_STYLES,
  CHEST_STYLES,
  DEFAULT_CHEST,
  GEAR,
  HEAD_GEAR,
  WEAPONS,
  parseEquipVisual,
  type BackStyle,
  type ChestStyle,
  type EquipVisual,
  type HeadGearDef,
  type WeaponDef,
} from './characterGear';

export {
  EQUIPMENT_SETS,
  EQUIPMENT_SLOTS,
  EQUIPMENT_VISUAL_IDS,
  parseEquipVisual,
  type EquipmentSet,
  type EquipmentSlot,
  type EquipVisual,
} from './characterGear';

/* ------------------------------------------------------------------ */
/* Public types                                                        */
/* ------------------------------------------------------------------ */

export type Direction = 'down' | 'up' | 'left' | 'right';
export const DIRECTIONS: readonly Direction[] = ['down', 'up', 'left', 'right'];

export type AnimationName = 'idle' | 'walk' | 'run' | 'interact' | 'attack' | 'celebrate' | 'sit' | 'sleep';
export const ANIMATION_NAMES: readonly AnimationName[] = ['idle', 'walk', 'run', 'interact', 'attack', 'celebrate', 'sit', 'sleep'];

export const ANIMATION_DEFS: Readonly<Record<AnimationName, { frames: number; fps: number; loop: boolean }>> = {
  idle: { frames: 2, fps: 2, loop: true },
  walk: { frames: 4, fps: 8, loop: true },
  run: { frames: 4, fps: 12, loop: true },
  interact: { frames: 2, fps: 4, loop: true },
  attack: { frames: 3, fps: 10, loop: false },
  celebrate: { frames: 2, fps: 4, loop: true },
  sit: { frames: 1, fps: 1, loop: true },
  sleep: { frames: 1, fps: 1, loop: true },
};

export type Condition = 'normal' | 'energized' | 'tired' | 'exhausted';
export const CONDITIONS: readonly Condition[] = ['normal', 'energized', 'tired', 'exhausted'];
export type AuraKind = 'momentum' | 'corruption' | 'recovery';
export const AURA_KINDS: readonly AuraKind[] = ['momentum', 'corruption', 'recovery'];

export type BodyTier = 1 | 2 | 3;
export type SkinTone = 0 | 1 | 2 | 3 | 4 | 5;
export type HairStyle = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;
export type HairColor = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type FaceVariant = 0 | 1 | 2 | 3;

export const HAIR_STYLE_NAMES: readonly string[] = HAIR_STYLES.map((h) => h.name);
export const FACE_NAMES = ['friendly', 'determined', 'calm', 'cheerful'] as const;

export interface Appearance {
  bodyTier: BodyTier;
  skinTone: number;
  hairStyle: number;
  hairColor: number;
  face: number;
  equipment: {
    head?: EquipVisual;
    chest?: EquipVisual;
    weapon?: EquipVisual;
    back?: EquipVisual;
  };
}

export const FRAME_WIDTH = 24;
export const FRAME_HEIGHT = 32;
/** Columns in a character sheet (max frames of any animation). */
export const SHEET_COLUMNS = 4;

export interface AnimationInfo {
  /** Row of the `down` direction (rows for other directions follow). */
  row: number;
  frames: number;
  fps: number;
  loop: boolean;
  rows: Record<Direction, number>;
}

export interface CharacterSheet {
  image: PixelImage;
  frameWidth: 24;
  frameHeight: 32;
  columns: number;
  animations: Record<AnimationName, AnimationInfo>;
  directions: Direction[];
  /** Index of a frame in row-major order (column + row × columns). */
  frameIndex: (anim: AnimationName, dir: Direction, frame: number) => number;
  /** Pixel rectangle of a frame within `image`. */
  frameRect: (anim: AnimationName, dir: Direction, frame: number) => { x: number; y: number; w: number; h: number };
}

/** Sheet row for (animation, direction): `animIndex * 4 + dirIndex`. */
export function sheetRow(anim: AnimationName, dir: Direction): number {
  return ANIMATION_NAMES.indexOf(anim) * DIRECTIONS.length + DIRECTIONS.indexOf(dir);
}

/** Frame index within a character sheet: `sheetRow(anim, dir) * 4 + frame`. */
export function characterFrameIndex(anim: AnimationName, dir: Direction, frame: number): number {
  const f = Math.max(0, Math.min(ANIMATION_DEFS[anim].frames - 1, frame | 0));
  return sheetRow(anim, dir) * SHEET_COLUMNS + f;
}

/* ------------------------------------------------------------------ */
/* Geometry                                                            */
/* ------------------------------------------------------------------ */

type View = 'front' | 'back' | 'side';

interface TierGeo {
  /** Front/back: torso fill columns (extends under the arms). */
  torsoL: number;
  torsoR: number;
  armW: number;
  /** Left x of screen-left and screen-right arms. */
  armLx: number;
  armRx: number;
  legW: number;
  legLx: number;
  legRx: number;
  /** Side view (facing left). */
  sTorsoL: number;
  sTorsoR: number;
  sArmX: number;
  sHipX: number;
  belly: number;
  shadowW: number;
}

const TIERS: Record<BodyTier, TierGeo> = {
  1: { torsoL: 7, torsoR: 16, armW: 2, armLx: 6, armRx: 16, legW: 2, legLx: 9, legRx: 13, sTorsoL: 9, sTorsoR: 14, sArmX: 11, sHipX: 11, belly: 0, shadowW: 12 },
  2: { torsoL: 6, torsoR: 17, armW: 2, armLx: 5, armRx: 17, legW: 3, legLx: 8, legRx: 13, sTorsoL: 8, sTorsoR: 14, sArmX: 10, sHipX: 10, belly: 0, shadowW: 14 },
  3: { torsoL: 5, torsoR: 18, armW: 3, armLx: 3, armRx: 18, legW: 4, legLx: 7, legRx: 13, sTorsoL: 7, sTorsoR: 15, sArmX: 10, sHipX: 9, belly: 1, shadowW: 16 },
};

const TORSO_TOP = 15;
const TORSO_BOTTOM = 23;
const HIP_Y = 23;
const FOOT_Y = 29;

type ArmKind = 'hang' | 'up' | 'forward' | 'out' | 'hold';
interface ArmPose {
  kind: ArmKind;
  swing: number;
}
interface LegPose {
  dx: number;
  lift: number;
}

type EyeState = 'open' | 'bright' | 'half' | 'closed' | 'happy' | 'calm';
type MouthState = 'smile' | 'flat' | 'grin' | 'small' | 'frown';
interface Expression {
  eyes: EyeState;
  mouth: MouthState;
  brows: boolean;
  blush: boolean;
  underEye: boolean;
  sweat: boolean;
}

type WeaponOrient = 'rest' | 'up' | 'out' | 'down' | 'diagUp' | 'diagDown' | 'hidden';

interface Pose {
  rootY: number;
  bodyY: number;
  headY: number;
  lean: number;
  /** Weapon arm and other arm. */
  armW: ArmPose;
  armO: ArmPose;
  /** Front/back: screen-left / screen-right leg. Side: near / far. */
  legA: LegPose;
  legB: LegPose;
  sit: boolean;
  weapon: WeaponOrient;
  smear: boolean;
  /** Extra effect on the held item (arrow / spark). */
  fx: 0 | 1 | 2 | 3;
  sway: number;
  expr: Expression;
}

/* ------------------------------------------------------------------ */
/* Poses                                                               */
/* ------------------------------------------------------------------ */

const hang = (swing = 0): ArmPose => ({ kind: 'hang', swing });
const leg = (dx = 0, lift = 0): LegPose => ({ dx, lift });

function baseExpression(face: number, cond: Condition): Expression {
  const f = ((face % 4) + 4) % 4;
  const e: Expression = {
    eyes: f === 2 ? 'calm' : f === 3 ? 'happy' : 'open',
    mouth: f === 1 ? 'flat' : f === 2 ? 'small' : f === 3 ? 'grin' : 'smile',
    brows: f === 1,
    blush: f === 0 || f === 3,
    underEye: false,
    sweat: false,
  };
  if (cond === 'energized') {
    if (e.eyes === 'open' || e.eyes === 'calm') e.eyes = 'bright';
    if (f !== 1) e.mouth = 'grin';
    e.blush = true;
  } else if (cond === 'tired') {
    e.eyes = 'half';
    e.mouth = f === 3 ? 'small' : 'flat';
    e.blush = false;
  } else if (cond === 'exhausted') {
    e.eyes = 'half';
    e.mouth = 'frown';
    e.blush = false;
    e.brows = false;
    e.underEye = true;
    e.sweat = true;
  }
  return e;
}

function makePose(
  anim: AnimationName,
  view: View,
  frame: number,
  cond: Condition,
  face: number,
  hasWeapon: boolean,
  heldItem = false,
): Pose {
  const expr = baseExpression(face, cond);
  const p: Pose = {
    rootY: 0,
    bodyY: 0,
    headY: 0,
    lean: 0,
    armW: hasWeapon ? { kind: 'hold', swing: 0 } : hang(),
    armO: hang(),
    legA: leg(),
    legB: leg(),
    sit: false,
    weapon: 'rest',
    smear: false,
    fx: 0,
    sway: 0,
    expr,
  };
  const side = view === 'side';
  const slump = cond === 'tired' ? 1 : cond === 'exhausted' ? 1 : 0;

  switch (anim) {
    case 'idle': {
      if (cond === 'energized') {
        p.rootY = frame === 0 ? -1 : 0;
        p.bodyY = frame === 0 ? 0 : 1;
      } else {
        p.bodyY = frame === 1 ? 1 : 0;
      }
      p.headY = slump;
      if (cond === 'exhausted') p.bodyY += 1;
      break;
    }
    case 'walk':
    case 'run': {
      const run = anim === 'run';
      const stride = run ? 3 : 2;
      const lift = run ? 3 : 2;
      const sw = run ? 2 : 1;
      p.headY = cond === 'exhausted' ? 1 : 0;
      if (run && side) p.lean = -1;
      if (side) {
        if (frame === 0) {
          p.legA = leg(-stride, 0);
          p.legB = leg(stride, 0);
          p.armW = { kind: hasWeapon ? 'hold' : 'hang', swing: -sw };
          p.armO = hang(sw);
          p.sway = 0;
        } else if (frame === 1) {
          p.legA = leg(0, 0);
          p.legB = leg(run ? -1 : 0, lift);
          p.bodyY = -1;
          p.sway = 1;
        } else if (frame === 2) {
          p.legA = leg(stride, 0);
          p.legB = leg(-stride, 0);
          p.armW = { kind: hasWeapon ? 'hold' : 'hang', swing: sw };
          p.armO = hang(-sw);
          p.sway = 0;
        } else {
          p.legA = leg(run ? -1 : 0, lift);
          p.legB = leg(0, 0);
          p.bodyY = -1;
          p.sway = 1;
        }
        if (run && (frame === 1 || frame === 3)) p.rootY = -1;
      } else {
        if (frame === 1) {
          p.legA = leg(0, lift);
          p.bodyY = -1;
          p.armW = { kind: hasWeapon ? 'hold' : 'hang', swing: -sw };
          p.armO = hang(sw);
          p.sway = -1;
        } else if (frame === 3) {
          p.legB = leg(0, lift);
          p.bodyY = -1;
          p.armW = { kind: hasWeapon ? 'hold' : 'hang', swing: sw };
          p.armO = hang(-sw);
          p.sway = 1;
        }
        if (run && (frame === 1 || frame === 3)) p.rootY = -1;
      }
      break;
    }
    case 'interact': {
      p.armW = { kind: 'forward', swing: frame };
      p.armO = side ? hang(1) : { kind: 'forward', swing: frame };
      p.weapon = 'hidden';
      p.bodyY = frame === 1 ? 1 : 0;
      p.headY = slump;
      if (p.expr.eyes === 'calm') p.expr.eyes = 'open';
      break;
    }
    case 'attack': {
      p.expr.brows = cond !== 'exhausted';
      if (p.expr.mouth === 'smile' || p.expr.mouth === 'small') p.expr.mouth = 'flat';
      if (p.expr.eyes === 'happy' || p.expr.eyes === 'calm') p.expr.eyes = 'open';
      if (heldItem) {
        // bow / book: hold it out, then shoot / cast
        p.armW = { kind: frame === 0 && view !== 'side' ? 'forward' : 'out', swing: 0 };
        p.fx = frame === 0 ? 3 : frame === 1 ? 1 : 2;
        if (side) p.lean = frame === 0 ? 0 : -1;
        break;
      }
      if (frame === 0) {
        p.armW = { kind: 'up', swing: 0 };
        p.weapon = 'up';
        p.bodyY = -1;
        if (side) p.lean = 1;
      } else if (frame === 1) {
        p.smear = true;
        p.fx = 1;
        if (side) {
          p.armW = { kind: 'out', swing: 0 };
          p.weapon = 'out';
          p.lean = -1;
          p.legA = leg(-2, 0);
          p.legB = leg(2, 0);
        } else {
          p.armW = { kind: 'forward', swing: 0 };
          p.weapon = 'diagDown';
        }
      } else {
        p.fx = 2;
        p.bodyY = 1;
        if (side) {
          p.armW = { kind: 'forward', swing: 1 };
          p.weapon = 'diagDown';
          p.lean = -1;
          p.legA = leg(-2, 0);
          p.legB = leg(2, 0);
        } else {
          p.armW = { kind: 'hang', swing: 0 };
          p.weapon = 'down';
        }
      }
      break;
    }
    case 'celebrate': {
      p.armW = { kind: 'up', swing: 0 };
      p.armO = { kind: 'up', swing: 0 };
      p.weapon = 'up';
      if (cond !== 'exhausted') {
        p.expr.eyes = 'happy';
        p.expr.mouth = 'grin';
        p.expr.blush = true;
      }
      if (frame === 0) {
        p.rootY = cond === 'exhausted' ? -1 : -2;
        p.legA = leg(side ? -1 : 0, 1);
        p.legB = leg(side ? 1 : 0, 1);
      } else {
        p.bodyY = 1;
      }
      break;
    }
    case 'sit': {
      p.sit = true;
      p.bodyY = 5;
      p.headY = slump;
      p.weapon = 'hidden';
      p.armW = hang();
      if (p.expr.eyes === 'happy') p.expr.eyes = 'calm';
      break;
    }
    case 'sleep': {
      p.sit = true;
      p.bodyY = 6;
      p.headY = 1;
      p.weapon = 'hidden';
      p.armW = hang();
      p.expr = { eyes: 'closed', mouth: 'small', brows: false, blush: true, underEye: false, sweat: false };
      break;
    }
  }
  return p;
}

/* ------------------------------------------------------------------ */
/* Drawing context                                                     */
/* ------------------------------------------------------------------ */

interface Ctx {
  view: View;
  g: TierGeo;
  tier: BodyTier;
  skin: Ramp;
  hair: Ramp;
  chest: ChestStyle;
  hasChest: boolean;
  back: BackStyle | null;
  headGear: HeadGearDef | null;
  weapon: WeaponDef | null;
  hairStyle: number;
  pose: Pose;
  /** Scratch layer + target frame. */
  L: PixelImage;
  F: PixelImage;
}

const INK = 0x1c1424;
const MOUTH = 0x7a2f35;
const TONGUE = 0xd8646a;
const EYE_WHITE = 0xfdfcf6;

function sideOf(ramp: Ramp, i: number, w: number, dark = false): Color {
  // Column shading for a strip of width w: left lit, right shaded.
  if (dark) return i === 0 && w > 2 ? ramp.base : i === w - 1 ? ramp.deep : ramp.shadow;
  if (w <= 1) return ramp.base;
  if (i === 0) return ramp.light;
  if (i === w - 1 && w >= 3) return ramp.shadow;
  return ramp.base;
}

/** Composites the scratch layer (optionally outlined) onto the frame. */
function commit(c: Ctx, soft = 0.5): void {
  compositeOutlined(c.F, c.L, soft);
  clearImage(c.L);
}

function px(c: Ctx, x: number, y: number, col: Color): void {
  setPixel(c.L, x, y + c.pose.rootY, col);
}

function hasPx(c: Ctx, x: number, y: number): boolean {
  return getAlpha(c.L, x, y + c.pose.rootY) > 0;
}

/**
 * Thick limb from (sx,sy) to (ex,ey), `w` pixels thick. Mostly-vertical
 * limbs are spans per row; mostly-horizontal ones are spans per column.
 * `col(i, distFromEnd)` picks the colour for span index i.
 */
function limb(
  c: Ctx,
  sx: number,
  sy: number,
  ex: number,
  ey: number,
  w: number,
  col: (i: number, fromEnd: number, x: number, y: number) => Color,
): void {
  const dx = ex - sx;
  const dy = ey - sy;
  if (Math.abs(dy) >= Math.abs(dx)) {
    const n = Math.abs(dy);
    const step = dy >= 0 ? 1 : -1;
    for (let k = 0; k <= n; k++) {
      const y = sy + k * step;
      const x = Math.round(sx + (n === 0 ? 0 : (dx * k) / n));
      for (let i = 0; i < w; i++) px(c, x + i, y, col(i, n - k, x + i, y));
    }
  } else {
    const n = Math.abs(dx);
    const step = dx >= 0 ? 1 : -1;
    for (let k = 0; k <= n; k++) {
      const x = sx + k * step;
      const y = Math.round(sy + (dy * k) / n);
      for (let i = 0; i < w; i++) px(c, x, y + i, col(i, n - k, x, y + i));
    }
  }
}

/* ------------------------------------------------------------------ */
/* Body parts                                                          */
/* ------------------------------------------------------------------ */

function drawShadow(c: Ctx): void {
  const w = c.g.shadowW - (c.pose.rootY < 0 ? 2 : 0) + (c.pose.sit ? 2 : 0);
  const x = Math.round(12 - w / 2);
  forEllipse(x, 28, w, 4, (x2, y2) => blendPixel(c.F, x2, y2, 0x1f1a2b, 70));
}

function legColor(c: Ctx, i: number, w: number, y: number, footY: number, far: boolean): Color {
  const boots = c.chest.boots;
  const trousers = c.chest.trousers;
  const r = y >= footY - 2 ? boots : trousers;
  return sideOf(r, i, w, far);
}

function drawLegsFront(c: Ctx): void {
  const { g, pose } = c;
  const w = g.legW;
  if (pose.sit) {
    // Sitting on the ground, knees toward the viewer: short legs + boots.
    const top = HIP_Y + pose.bodyY - 1;
    for (const [lx, out] of [
      [g.legLx - 1, -1],
      [g.legRx + 1, 1],
    ] as const) {
      for (let y = top; y <= FOOT_Y; y++) {
        for (let i = 0; i < w; i++) {
          const boot = y >= FOOT_Y - 1;
          const r = boot ? c.chest.boots : c.chest.trousers;
          px(c, lx + i, y, c.view === 'back' ? r.shadow : sideOf(r, i, w));
        }
      }
      // toes pointing outward
      px(c, out < 0 ? lx - 1 : lx + w, FOOT_Y, c.chest.boots.shadow);
    }
    return;
  }
  const legs: [number, LegPose, number][] = [
    [g.legLx, pose.legA, -1],
    [g.legRx, pose.legB, 1],
  ];
  for (const [lx, lp, out] of legs) {
    const footY = FOOT_Y - lp.lift;
    const x0 = lx + lp.dx;
    for (let y = HIP_Y + Math.min(0, pose.bodyY); y <= footY; y++) {
      for (let i = 0; i < w; i++) px(c, x0 + i, y, legColor(c, i, w, y, footY, false));
    }
    // foot: one pixel wider on the outside at the sole
    if (c.view === 'front') px(c, out < 0 ? x0 - 1 : x0 + w, footY, c.chest.boots.shadow);
  }
}

function drawLegsSide(c: Ctx, which: 'near' | 'far'): void {
  const { g, pose } = c;
  const w = g.legW;
  const far = which === 'far';
  const lp = far ? pose.legB : pose.legA;
  const hipX = g.sHipX + (far ? 1 : 0);
  if (pose.sit) {
    // legs stretched forward along the ground
    const y0 = HIP_Y + pose.bodyY - 2;
    const len = 6 + (far ? -1 : 0);
    for (let k = 0; k < len; k++) {
      const x = hipX - k;
      for (let i = 0; i < 3; i++) {
        const y = FOOT_Y - 2 + i - (far ? 1 : 0);
        const boot = k >= len - 2;
        const r = boot ? c.chest.boots : c.chest.trousers;
        px(c, x, Math.min(y, Math.max(y0, y)), far ? r.shadow : i === 0 ? r.light : i === 2 ? r.shadow : r.base);
      }
    }
    const tx = hipX - len + 1;
    px(c, tx, FOOT_Y - 3 - (far ? 1 : 0), far ? c.chest.boots.shadow : c.chest.boots.light);
    px(c, tx + 1, FOOT_Y - 3 - (far ? 1 : 0), far ? c.chest.boots.shadow : c.chest.boots.base);
    return;
  }
  const footY = FOOT_Y - lp.lift;
  const top = HIP_Y + Math.min(0, pose.bodyY);
  limb(c, hipX, top, hipX + lp.dx, footY, w, (i, fromEnd, _x, y) => legColor(c, i, w, y, footY, far));
  // toe pointing forward (left)
  const fx = hipX + lp.dx;
  px(c, fx - 1, footY, far ? c.chest.boots.shadow : c.chest.boots.base);
  if (lp.lift === 0) px(c, fx - 1, footY - 1, far ? c.chest.boots.deep : c.chest.boots.light);
}

/** Visible chest bounds between the arms (front/back view). */
function chestBounds(c: Ctx): [number, number] {
  const { g } = c;
  return [g.armLx + g.armW + 1, g.armRx - 2];
}

function drawTorsoFront(c: Ctx): void {
  const { g, pose, chest, view } = c;
  const by = pose.bodyY;
  const top = TORSO_TOP + by;
  const bottom = TORSO_BOTTOM + by + (c.tier === 3 ? 1 : 0);
  const [cl, cr] = chestBounds(c);
  const cx0 = 11;
  const cx1 = 12;
  const back = view === 'back';
  for (let y = top; y <= bottom; y++) {
    let l = g.torsoL;
    let r = g.torsoR;
    if (y === top) {
      l++;
      r--;
    }
    if (c.tier === 3 && y === bottom) {
      l += 2;
      r -= 2;
    }
    if (c.tier === 1 && y >= bottom - 1) {
      l++;
      r--;
    }
    for (let x = l; x <= r; x++) {
      const rel = y - top;
      let col: Color = chest.shirt.base;
      const R = chest.shirt;
      if (x <= cl) col = R.light;
      else if (x >= cr) col = R.shadow;
      if (y === bottom) col = R.shadow;
      // patterns
      switch (chest.pattern) {
        case 'tunic':
        case 'traveler': {
          if (!back && rel <= 1 && (x === cx0 || x === cx1) && !(rel === 1 && chest.pattern === 'tunic' && false)) {
            col = rel === 0 ? c.skin.base : chest.pattern === 'traveler' ? chest.trim.base : c.skin.shadow;
          }
          if (chest.pattern === 'traveler') {
            if (!back && rel === 0 && (x === cx0 - 1 || x === cx1 + 1)) col = chest.trim.base;
            if (!back && rel >= 2 && rel <= 5 && x === cx1) col = chest.trim.shadow;
          }
          break;
        }
        case 'vest': {
          const v = chest.over;
          const inCenter = x === cx0 || x === cx1;
          if (back || !inCenter || rel >= 6) {
            col = x <= cl ? v.light : x >= cr ? v.shadow : v.base;
            if (!back && (x === cx0 - 1 || x === cx1 + 1) && rel < 6) col = chest.trim.base;
          } else {
            col = rel % 2 === 0 ? chest.shirt.base : chest.trim.shadow;
            if (rel === 0) col = chest.shirt.light;
          }
          if (y === bottom) col = v.shadow;
          break;
        }
        case 'plate': {
          const s = chest.shirt;
          col = x <= cl ? s.hi : x === cl + 1 ? s.light : x >= cr ? s.shadow : s.base;
          if (!back && (x === cx0 || x === cx1) && rel >= 1 && rel <= 4) col = x === cx0 ? s.light : s.shadow;
          if (rel === 0) col = s.light;
          if (!back && rel >= 5 && (x === cx0 || x === cx1)) col = x === cx0 ? chest.trim.light : chest.trim.base;
          if (y === bottom && !(x === cx0 || x === cx1)) col = s.shadow;
          break;
        }
        case 'robe':
        case 'starRobe': {
          if (!back && rel === 0 && x >= cx0 - 1 && x <= cx1 + 1) col = chest.trim.base;
          if (!back && rel >= 1 && x === cx0) col = chest.pattern === 'robe' ? chest.trim.base : chest.over.base;
          if (!back && rel >= 1 && x === cx1 && chest.pattern === 'starRobe') col = chest.over.shadow;
          if (chest.pattern === 'starRobe' && (x + y - by) % 3 === 0 && hash2(x, y - by, 7) > 0.8 && x > cl && x < cr) col = chest.trim.light;
          break;
        }
        case 'coat': {
          const o = chest.over;
          col = x <= cl ? o.light : x >= cr ? o.shadow : o.base;
          if (!back) {
            const lap = rel <= 3 ? 2 - Math.min(rel, 2) + 0 : -1;
            if (rel <= 3 && x >= cx0 - lap && x <= cx1 + lap && lap >= 0) col = rel === 0 ? chest.shirt.light : chest.shirt.base;
            if (rel <= 3 && (x === cx0 - lap - 1 || x === cx1 + lap + 1) && lap >= 0) col = o.light;
            if (rel >= 4 && x === cx0) col = o.deep;
            if ((rel === 4 || rel === 7) && x === cx1) col = chest.trim.light;
          }
          if (y === bottom) col = o.shadow;
          break;
        }
      }
      // belt
      if (chest.belt && rel === 6 && chest.pattern !== 'coat') {
        col = x <= cl ? chest.belt.light : chest.belt.base;
        if (!back && (x === cx0 || x === cx1) && chest.pattern !== 'robe' && chest.pattern !== 'starRobe')
          col = x === cx0 ? GEAR.gold.light : GEAR.gold.base;
      }
      if (chest.belt && rel === 6 && chest.pattern === 'coat') col = chest.belt.base;
      px(c, x, y, col);
    }
  }
  // skirt / robe / coat tails
  if (chest.hemY > 0) {
    const hem = chest.hemY;
    for (let y = bottom + 1; y <= hem + Math.max(0, by > 3 ? -2 : 0); y++) {
      const k = y - bottom;
      const flare = c.tier === 3 ? Math.floor(k / 3) : Math.floor((k + 1) / 2);
      let l = g.torsoL + 1 - flare + (c.tier === 1 ? 1 : c.tier === 3 ? 1 : 0);
      let r = g.torsoR - 1 + flare - (c.tier === 1 ? 1 : c.tier === 3 ? 1 : 0);
      if (y >= hem - 1) {
        l += pose.sway < 0 ? -1 : 0;
        r += pose.sway > 0 ? 1 : 0;
      }
      for (let x = l; x <= r; x++) {
        if (chest.splitHem && !back && x >= 11 - Math.floor(k / 2) && x <= 12 + Math.floor(k / 2) && k >= 1) continue;
        const R = chest.pattern === 'coat' ? chest.over : chest.pattern === 'traveler' ? chest.shirt : chest.shirt;
        let col = x <= l + 1 ? R.light : x >= r - 1 ? R.shadow : R.base;
        if (y === hem) col = chest.pattern === 'coat' ? R.shadow : chest.trim.base;
        if (chest.pattern === 'traveler' && y === hem) col = chest.trim.base;
        if (!back && chest.pattern === 'robe' && (x === 11 || x === 12)) col = chest.trim.base;
        if (chest.pattern === 'starRobe' && y !== hem && (x + y - by) % 3 === 0 && hash2(x, y - by, 3) > 0.78) col = chest.trim.light;
        if (!back && chest.pattern === 'starRobe' && x === 12 && y !== hem) col = chest.over.base;
        if (chest.pattern === 'coat' && !back && (x === 10 - Math.floor(k / 2) || x === 13 + Math.floor(k / 2))) col = R.deep;
        px(c, x, y, col);
      }
    }
  }
}

function drawTorsoSide(c: Ctx): void {
  const { g, pose, chest } = c;
  const by = pose.bodyY;
  const top = TORSO_TOP + by;
  const bottom = TORSO_BOTTOM + by;
  const lean = pose.lean;
  for (let y = top; y <= bottom; y++) {
    const rel = y - top;
    const leanX = rel < 4 ? lean : 0;
    let l = g.sTorsoL + leanX;
    let r = g.sTorsoR + leanX;
    if (y === top) {
      l++;
      r--;
    }
    if (g.belly && rel >= 3 && rel <= 7) l -= 1;
    if (c.tier === 1 && rel >= 7) l++;
    for (let x = l; x <= r; x++) {
      const R = chest.shirt;
      let col: Color = x <= l ? R.light : x >= r ? R.shadow : R.base;
      if (y === bottom) col = R.shadow;
      switch (chest.pattern) {
        case 'traveler':
          if (rel === 0 && x <= l + 2) col = chest.trim.base;
          break;
        case 'vest': {
          const v = chest.over;
          if (x >= l + 2 || rel >= 6) col = x >= r ? v.shadow : x === l + 2 ? chest.trim.base : v.base;
          break;
        }
        case 'plate': {
          col = x === l ? R.light : x === l + 1 ? R.hi : x >= r ? R.shadow : R.base;
          if (rel >= 5 && x <= l + 1) col = chest.trim.base;
          break;
        }
        case 'robe':
        case 'starRobe':
          if (rel === 0 && x <= l + 2) col = chest.trim.base;
          if (x === l + 1 && rel >= 1) col = chest.pattern === 'robe' ? chest.trim.base : chest.over.base;
          if (chest.pattern === 'starRobe' && (x + y - by) % 3 === 0 && hash2(x, y - by, 7) > 0.8 && x > l + 1) col = chest.trim.light;
          break;
        case 'coat': {
          const o = chest.over;
          col = x >= r ? o.shadow : x <= l ? o.light : o.base;
          if (rel <= 3 && x === l) col = chest.shirt.base;
          if (rel <= 3 && x === l + 1) col = o.light;
          if ((rel === 4 || rel === 7) && x === l + 1) col = chest.trim.light;
          break;
        }
        default:
          if (rel === 0 && x <= l + 1) col = c.skin.base;
      }
      if (chest.belt && rel === 6) col = x === l ? chest.belt.light : chest.belt.base;
      px(c, x, y, col);
    }
  }
  if (chest.hemY > 0) {
    const hem = chest.hemY;
    for (let y = bottom + 1; y <= hem + (by > 3 ? -2 : 0); y++) {
      const k = y - bottom;
      const flare = Math.floor((k + 1) / 2);
      let l = g.sTorsoL - (chest.splitHem ? -2 : flare - 1);
      let r = g.sTorsoR + flare;
      if (y >= hem - 1) r += pose.sway > 0 ? 1 : 0;
      const R = chest.pattern === 'coat' ? chest.over : chest.shirt;
      for (let x = l; x <= r; x++) {
        let col = x <= l ? R.light : x >= r ? R.shadow : R.base;
        if (y === hem) col = chest.pattern === 'coat' ? R.shadow : chest.trim.base;
        if (chest.pattern === 'robe' && x === l + 1) col = chest.trim.base;
        if (chest.pattern === 'starRobe' && y !== hem && (x + y - by) % 3 === 0 && hash2(x, y - by, 3) > 0.78) col = chest.trim.light;
        px(c, x, y, col);
      }
    }
  }
}

interface HandInfo {
  x: number;
  y: number;
  /** Arm drawn horizontally (affects weapon pivot). */
  horizontal: boolean;
}

/**
 * Draws one arm. `which`: 'W' weapon arm, 'O' other arm.
 * Returns grip point in frame coords (without rootY).
 */
function drawArm(c: Ctx, which: 'W' | 'O', far = false): HandInfo {
  const { g, pose, view, chest } = c;
  const ap = which === 'W' ? pose.armW : pose.armO;
  const by = pose.bodyY;
  let w = view === 'side' ? g.armW : g.armW;
  let sx: number;
  let sy: number;
  let ex: number;
  let ey: number;
  let out: number;
  if (view === 'side') {
    const ax = g.sArmX + (far ? 1 : 0) + (pose.lean < 0 ? pose.lean : 0);
    out = -1;
    sx = ax;
    sy = TORSO_TOP + 1 + by;
    switch (ap.kind) {
      case 'hang': {
        const s = far ? ap.swing : ap.swing;
        const dx = Math.abs(s) >= 2 ? -s * 1.5 : -s * 2;
        ex = ax + Math.round(dx);
        ey = 21 + by - (Math.abs(s) >= 2 ? 1 : 0);
        break;
      }
      case 'hold':
        ex = ax - 4;
        ey = 20 + by;
        break;
      case 'forward':
        ex = ax - 5 + ap.swing;
        ey = 18 + by;
        break;
      case 'up':
        ex = ax + 2;
        ey = 5 + by;
        sy = TORSO_TOP + 2 + by;
        break;
      case 'out':
        ex = ax - 3;
        ey = 16 + by;
        break;
    }
  } else {
    // front/back: weapon arm is screen-left when facing down, screen-right facing up.
    const screenLeft = view === 'front' ? which === 'W' : which === 'O';
    const ax = screenLeft ? g.armLx : g.armRx;
    out = screenLeft ? -1 : 1;
    sx = ax;
    sy = TORSO_TOP + by;
    switch (ap.kind) {
      case 'hang': {
        ex = ax;
        ey = 21 + by - (ap.swing > 0 ? 1 : 0) + (ap.swing < 0 && Math.abs(ap.swing) > 1 ? 0 : 0);
        break;
      }
      case 'hold':
        ex = ax + out;
        ey = 21 + by + (ap.swing > 0 ? -1 : 0);
        break;
      case 'forward':
        ex = ax - out * (1 + ap.swing);
        ey = 19 + by - (view === 'back' ? 1 : 0);
        break;
      case 'up':
        ex = ax + out;
        ey = 8 + by;
        sy = TORSO_TOP + 1 + by;
        break;
      case 'out':
        sy = TORSO_TOP + 1 + by;
        ex = ax + out * 4;
        ey = sy;
        break;
    }
  }
  const sleeve = chest.sleeve;
  const handR = chest.glove ?? c.skin;
  const mantle = c.back && c.back.kind === 'cape' && view !== 'back' ? c.back.main : null;
  const pauldron = chest.pauldrons;
  const vertical = Math.abs(ey - sy) >= Math.abs(ex - sx);
  const backHidden = view === 'back' && ap.kind === 'forward';
  limb(c, sx, sy, ex, ey, w, (i, fromEnd, x, y) => {
    const handLen = 2;
    if (fromEnd < handLen && !backHidden) {
      return far ? handR.shadow : sideOf(handR, i, w);
    }
    const fromStart = vertical ? Math.abs(y - sy) : Math.abs(x - sx);
    if (pauldron && fromStart <= 1) return far ? pauldron.shadow : sideOf(pauldron, i, w);
    if (mantle && fromStart <= 1 && ap.kind !== 'up') return far ? mantle.shadow : sideOf(mantle, i, w);
    if (fromEnd === handLen && chest.glove && chest.pattern !== 'plate') return far ? chest.glove.shadow : chest.glove.light;
    return far ? sideOf(sleeve, i, w, true) : sideOf(sleeve, i, w);
  });
  if (pauldron && !far) {
    // rounded shoulder pad one pixel wider
    if (vertical && ap.kind !== 'up') {
      px(c, out < 0 ? sx - 1 : sx + w, sy + 1, pauldron.shadow);
      px(c, out < 0 ? sx - 1 : sx + w, sy, pauldron.base);
    }
  }
  // grip point
  const gx = vertical ? ex + Math.floor((w - 1) / 2) : ex + (out < 0 ? 0 : 1);
  const gy = vertical ? (ey < sy ? ey : ey - 1) + (ap.kind === 'up' ? 0 : 1) : ey + Math.floor((w - 1) / 2);
  return { x: gx, y: gy, horizontal: !vertical };
}

/* ------------------------------------------------------------------ */
/* Head                                                                */
/* ------------------------------------------------------------------ */

const HEAD_FRONT = [
  '.....bbbbbbbb.....',
  '....bbbbbbbbbb....',
  '....bbbbbbbbbb....',
  '....bbbbbbbbbb....',
  '....bbbbbbbbbs....',
  '...ebbbbbbbbbse...',
  '...ebbbbbbbbbse...',
  '....bbbbbbbbbs....',
  '....bbbbbbbbbs....',
  '.....bbbbbbbs.....',
];
const HEAD_SIDE = [
  '.....bbbbbbbb.....',
  '....bbbbbbbbbb....',
  '....bbbbbbbbbb....',
  '....bbbbbbbbbb....',
  '....bbbbbbbbbs....',
  '....bbbbbbebbs....',
  '....bbbbbbebbs....',
  '....bbbbbbbbbs....',
  '....bbbbbbbbs.....',
  '.....bbbbbbs......',
];

function headOffset(c: Ctx): [number, number] {
  return [c.pose.lean, c.pose.bodyY + c.pose.headY];
}

function drawHead(c: Ctx): void {
  const [hx, hy] = headOffset(c);
  const rows = c.view === 'side' ? HEAD_SIDE : HEAD_FRONT;
  const key = { b: c.skin.base, s: c.skin.shadow, e: c.skin.shadow, h: c.skin.light };
  drawTemplate(c.L, rows, 3 + hx, 4 + hy + c.pose.rootY, key);
}

function drawFace(c: Ctx): void {
  if (c.view === 'back') return;
  const [hx, hy] = headOffset(c);
  const e = c.pose.expr;
  const oy = hy;
  const set = (x: number, y: number, col: Color) => setPixel(c.F, x + hx, y + oy + c.pose.rootY, col);
  const skinDeep = shade(c.skin.base, -0.3);
  const blush = mix(c.skin.base, 0xe8606a, 0.45);
  const eyes: number[] = c.view === 'side' ? [8] : [9, 14];
  const [sr, sg, sb] = rgbOf(c.skin.base);
  const darkSkin = sr * 0.3 + sg * 0.59 + sb * 0.11 < 110;
  for (const ex of eyes) {
    const lft = ex < 12;
    switch (e.eyes) {
      case 'open':
        set(ex, 9, INK);
        set(ex, 10, INK);
        // dark skin: a catch-light keeps the eyes readable
        if (darkSkin) set(ex, 9, mix(INK, EYE_WHITE, 0.55));
        break;
      case 'bright':
        set(ex, 9, INK);
        set(ex, 10, INK);
        if (c.view === 'side') set(ex + 1, 9, EYE_WHITE);
        else set(lft ? ex + 1 : ex - 1, 9, EYE_WHITE);
        break;
      case 'half':
        set(ex, 9, skinDeep);
        set(ex, 10, INK);
        if (c.view !== 'side') set(lft ? ex - 1 : ex + 1, 9, skinDeep);
        else set(ex + 1, 9, skinDeep);
        break;
      case 'closed':
        set(ex, 10, INK);
        if (c.view !== 'side') set(lft ? ex - 1 : ex + 1, 10, INK);
        else set(ex + 1, 10, INK);
        break;
      case 'calm':
        set(ex, 10, INK);
        if (c.view !== 'side') set(lft ? ex + 1 : ex - 1, 10, INK);
        else set(ex + 1, 10, INK);
        set(ex, 9, skinDeep);
        break;
      case 'happy':
        set(ex, 9, INK);
        set(ex - 1, 10, INK);
        set(ex + 1, 10, INK);
        break;
    }
    if (e.underEye) set(ex, 11, mix(c.skin.shadow, 0x5a4a8a, 0.3));
    if (e.brows) {
      const hair = c.hair.deep;
      if (c.view === 'side') {
        set(ex, 8, hair);
        set(ex + 1, 7, hair);
      } else if (lft) {
        set(ex, 8, hair);
        set(ex - 1, 7, hair);
      } else {
        set(ex, 8, hair);
        set(ex + 1, 7, hair);
      }
    }
  }
  if (e.blush) {
    if (c.view === 'side') set(10, 11, blush);
    else {
      set(8, 11, blush);
      set(15, 11, blush);
    }
  }
  // mouth
  const mx = c.view === 'side' ? [7] : [11, 12];
  switch (e.mouth) {
    case 'smile':
      for (const x of mx) set(x, 12, MOUTH);
      if (c.view === 'side') set(8, 12, MOUTH);
      break;
    case 'grin':
      for (const x of mx) {
        set(x, 12, MOUTH);
        set(x, 13, TONGUE);
      }
      if (c.view === 'side') {
        set(8, 12, MOUTH);
      }
      break;
    case 'flat':
      for (const x of mx) set(x, 12, skinDeep);
      if (c.view === 'side') set(8, 12, skinDeep);
      break;
    case 'small':
      if (c.view === 'side') set(8, 12, MOUTH);
      else set(11, 12, MOUTH), set(12, 12, mix(MOUTH, c.skin.base, 0.5));
      break;
    case 'frown':
      if (c.view === 'side') {
        set(8, 12, mix(MOUTH, skinDeep, 0.5));
      } else {
        set(11, 12, mix(MOUTH, skinDeep, 0.5));
        set(12, 12, mix(MOUTH, skinDeep, 0.5));
      }
      break;
  }
  if (e.sweat) {
    const sx = c.view === 'side' ? 6 : 17;
    set(sx, 7, 0xbfe9ff);
    set(sx, 8, 0x7cc8f2);
  }
}

function hairTemplateFor(c: Ctx): HairTemplate {
  const def = HAIR_STYLES[((c.hairStyle % HAIR_STYLES.length) + HAIR_STYLES.length) % HAIR_STYLES.length]!;
  return c.view === 'front' ? def.front : c.view === 'back' ? def.back : def.side;
}

function drawHair(c: Ctx): void {
  const [hx, hy] = headOffset(c);
  const tpl = hairTemplateFor(c);
  const R = c.hair;
  const key: Record<string, Color> = { h: R.light, b: R.base, s: R.shadow, d: R.deep, t: mix(R.deep, 0x8a3fb8, 0.0) };
  // hair tie accent: warm red ribbon
  key['t'] = 0xc8463c;
  const hg = c.headGear;
  const rows = tpl.rows.map((row, r) => {
    if (!hg) return row;
    const y = tpl.y0 + r;
    let out = '';
    for (let col = 0; col < row.length; col++) {
      const ch = row[col]!;
      const x = col + 3;
      let keep = true;
      if (hg.hairMode === 'helm') keep = false;
      else if (hg.hairMode === 'cap') keep = y > hg.capLine;
      else if (hg.hairMode === 'hood') {
        const inFace = c.view === 'side' ? x <= 10 && x >= 5 : x >= 8 && x <= 15;
        keep = inFace && y >= hg.capLine && y <= 9;
      }
      out += keep ? ch : '.';
    }
    return out;
  });
  drawTemplate(c.L, rows, 3 + hx, tpl.y0 + hy + c.pose.rootY, key);
}

function drawHeadGear(c: Ctx): void {
  const hg = c.headGear;
  if (!hg) return;
  const [hx, hy] = headOffset(c);
  const t = c.view === 'front' ? hg.front : c.view === 'back' ? hg.back : hg.side;
  drawTemplate(c.L, t.rows, 3 + hx, t.y0 + hy + c.pose.rootY, hg.key);
}

/* ------------------------------------------------------------------ */
/* Back items                                                          */
/* ------------------------------------------------------------------ */

function drawBackBehind(c: Ctx): void {
  const b = c.back;
  if (!b) return;
  const { g, pose, view } = c;
  const by = pose.bodyY;
  if (b.kind === 'cape') {
    const hem = b.hemY + (pose.sit ? -1 : 0);
    if (view === 'front') {
      for (let y = TORSO_TOP + by + 1; y <= hem; y++) {
        const k = y - TORSO_TOP - by;
        const flare = Math.min(3, Math.floor(k / 3));
        const l = g.armLx - flare + (pose.sway < 0 && y > hem - 3 ? -1 : 0);
        const r = g.armRx + g.armW - 1 + flare + (pose.sway > 0 && y > hem - 3 ? 1 : 0);
        for (let x = l; x <= r; x++) {
          let col = x - l < 2 ? b.main.base : r - x < 2 ? b.main.shadow : b.main.deep;
          if (y === hem) col = b.main.shadow;
          if (b.stars && (x + y) % 3 === 0 && hash2(x, y, 11) > 0.75) col = b.accent.light;
          px(c, x, y, col);
        }
      }
    } else if (view === 'side') {
      const flutter = pose.sway;
      for (let y = TORSO_TOP + by; y <= hem; y++) {
        const k = y - TORSO_TOP - by;
        const extra = Math.min(4, Math.floor(k / 3)) + (k > 6 ? flutter : 0);
        const l = g.sTorsoR - 3 + (k > 9 ? 1 : 0);
        const r = g.sTorsoR + 1 + extra;
        for (let x = l; x <= r; x++) {
          let col = x === r ? b.main.shadow : x === r - 1 ? b.main.base : b.main.light;
          if (y === hem) col = b.main.shadow;
          if (b.stars && (x + y) % 3 === 0 && hash2(x, y, 11) > 0.75) col = b.accent.light;
          px(c, x, y, col);
        }
      }
    }
  } else if (b.kind === 'shield') {
    if (view === 'front') {
      const cx = g.armRx - 2;
      const top = 12 + by;
      drawShieldDisc(c, cx, top, 10);
    } else if (view === 'side') {
      const x0 = g.sTorsoR - 1;
      const top = 14 + by;
      forEllipse(x0, top, 5, 11, (x, y, nx) => {
        const col = nx > 0.35 ? b.accent.shadow : nx > -0.2 ? b.main.base : b.main.light;
        px(c, x, y, col);
      });
      px(c, x0 + 1, top + 5, b.accent.light);
    }
  } else if (b.kind === 'scrollcase') {
    if (view === 'front') {
      drawTube(c, g.torsoR - 3, 22 + by, g.armLx + 1, 11 + by, b);
    } else if (view === 'side') {
      drawTube(c, g.sTorsoL + 1, 23 + by, g.sTorsoR + 2, 12 + by, b);
    }
  } else if (b.kind === 'satchel') {
    if (view === 'side') {
      // bag hangs at the back hip, seen from the side
      const x0 = g.sTorsoR - 1;
      const y0 = 19 + by;
      drawBag(c, x0, y0, b, 5);
    }
  }
}

function drawShieldDisc(c: Ctx, x0: number, y0: number, d: number): void {
  const b = c.back!;
  forEllipse(x0, y0, d, d, (x, y, nx, ny) => {
    const r2 = nx * nx + ny * ny;
    let col: Color;
    if (r2 > 0.62) col = nx + ny < -0.3 ? b.accent.light : nx + ny > 0.5 ? b.accent.shadow : b.accent.base;
    else col = nx + ny < -0.4 ? b.main.light : nx + ny > 0.4 ? b.main.shadow : b.main.base;
    // emblem: gold cross
    const cx = x0 + Math.floor(d / 2);
    const cy = y0 + Math.floor(d / 2);
    if (r2 <= 0.62 && (x === cx || y === cy)) col = GEAR.gold.base;
    if (r2 < 0.06) col = b.accent.hi;
    px(c, x, y, col);
  });
}

function drawTube(c: Ctx, x0: number, y0: number, x1: number, y1: number, b: BackStyle): void {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  forLine(x0, y0, x1, y1, (x, y, i) => {
    const capEnd = i <= 1 || i >= n - 1;
    const r = capEnd ? b.accent : b.main;
    px(c, x, y, r.light);
    px(c, x + 1, y, r.base);
    px(c, x + 2, y, r.shadow);
  });
}

function drawBag(c: Ctx, x0: number, y0: number, b: BackStyle, w: number): void {
  for (let y = 0; y < 5; y++) {
    for (let x = 0; x < w; x++) {
      let col = x === 0 ? b.main.light : x === w - 1 ? b.main.shadow : b.main.base;
      if (y === 4) col = b.main.shadow;
      if (y <= 1) col = y === 1 ? b.strap.base : x === 0 ? b.main.hi : b.main.light;
      px(c, x0 + x, y0 + y, col);
    }
  }
  px(c, x0 + Math.floor(w / 2), y0 + 2, b.accent.base);
}

/** Back item when it sits in front of the torso (facing up), or chest straps. */
function drawBackFront(c: Ctx): void {
  const b = c.back;
  if (!b) return;
  const { g, pose, view } = c;
  const by = pose.bodyY;
  if (view === 'back') {
    if (b.kind === 'cape') {
      const hem = b.hemY + (pose.sit ? -2 : 0);
      for (let y = TORSO_TOP + by; y <= hem; y++) {
        const k = y - TORSO_TOP - by;
        const flare = Math.min(2, Math.floor(k / 4));
        const l = g.torsoL + 1 - flare + (pose.sway < 0 && y > hem - 3 ? -1 : 0) + (k === 0 ? 1 : 0);
        const r = g.torsoR - 1 + flare + (pose.sway > 0 && y > hem - 3 ? 1 : 0) - (k === 0 ? 1 : 0);
        const w = r - l;
        for (let x = l; x <= r; x++) {
          const t = (x - l) / Math.max(1, w);
          let col = t < 0.2 ? b.main.light : t > 0.8 ? b.main.shadow : b.main.base;
          // folds
          if (k > 3 && (Math.abs(t - 0.36) < 0.05 || Math.abs(t - 0.66) < 0.05)) col = b.main.shadow;
          if (y === hem) col = b.main.deep;
          if (k === 0) col = b.main.light;
          if (b.stars && y !== hem && (x * 2 + y) % 5 === 0 && hash2(x, y, 5) > 0.72) col = b.accent.light;
          px(c, x, y, col);
        }
      }
    } else if (b.kind === 'shield') {
      drawShieldDisc(c, 7, 14 + by, 10);
    } else if (b.kind === 'scrollcase') {
      drawTube(c, g.torsoL + 2, 23 + by, g.torsoR - 4, 12 + by, b);
    } else if (b.kind === 'satchel') {
      forLine(g.torsoR - 2, TORSO_TOP + by, g.torsoL + 3, 20 + by, (x, y) => px(c, x, y, b.strap.base));
      drawBag(c, g.torsoL + 1, 19 + by, b, 5);
    }
    return;
  }
  if (view === 'front') {
    if (b.kind === 'cape') {
      // cloak clasp at the collar
      px(c, 11, TORSO_TOP + by, b.main.light);
      px(c, 12, TORSO_TOP + by, b.main.base);
      px(c, 11, TORSO_TOP + 1 + by, b.accent.light);
      px(c, 12, TORSO_TOP + 1 + by, b.accent.base);
    } else if (b.kind === 'shield' || b.kind === 'scrollcase') {
      const [cl, cr] = chestBounds(c);
      forLine(cl, TORSO_TOP + by + 1, cr, TORSO_TOP + by + 6, (x, y) => px(c, x, y, b.strap.base));
    } else if (b.kind === 'satchel') {
      const [cl, cr] = chestBounds(c);
      forLine(cl, TORSO_TOP + by + 1, cr, TORSO_TOP + by + 5, (x, y) => px(c, x, y, b.strap.base));
      drawBag(c, cr - 2, 19 + by, b, 5);
    }
  } else if (view === 'side') {
    if (b.kind === 'cape') {
      px(c, g.sTorsoL + 1 + pose.lean, TORSO_TOP + by, b.main.base);
      px(c, g.sTorsoL + 1 + pose.lean, TORSO_TOP + by + 1, b.accent.base);
      for (let x = g.sTorsoL + 2; x <= g.sTorsoR; x++) px(c, x + pose.lean, TORSO_TOP + by, b.main.light);
    } else {
      // strap over the shoulder
      forLine(g.sTorsoL + 1, 20 + by, g.sTorsoR - 2, TORSO_TOP + by, (x, y) => px(c, x + (y < 19 + by ? pose.lean : 0), y, b.strap.base));
    }
  }
}

/* ------------------------------------------------------------------ */
/* Weapons                                                             */
/* ------------------------------------------------------------------ */

interface Sprite {
  img: PixelImage;
  px: number;
  py: number;
}

const weaponCache = new Map<string, Sprite>();

function weaponSprite(def: WeaponDef, setKey: string): Sprite {
  const k = setKey;
  let s = weaponCache.get(k);
  if (!s) {
    const w = Math.max(...def.rows.map((r) => r.length));
    const img = createImage(w, def.rows.length);
    drawTemplate(img, def.rows, 0, 0, def.key);
    s = { img, px: def.pivotX, py: def.pivotY };
    weaponCache.set(k, s);
  }
  return s;
}

function rotSprite(s: Sprite): Sprite {
  // 90° clockwise: (x,y) -> (h-1-y, x)
  return { img: rotate90(s.img), px: s.img.height - 1 - s.py, py: s.px };
}

/** Rotates a sprite clockwise by a multiple of 45° about its pivot. */
function rotateSprite(s: Sprite, deg: number): Sprite {
  const d = ((deg % 360) + 360) % 360;
  if (d % 90 === 0) {
    let r = s;
    for (let i = 0; i < d / 90; i++) r = rotSprite(r);
    return r;
  }
  // 45° steps: rotate the nearest 90° multiple below, then 45° by inverse nearest sampling.
  const base = rotateSprite(s, d - 45);
  const src = base.img;
  const size = Math.ceil(Math.hypot(src.width, src.height)) * 2 + 2;
  const out = createImage(size, size);
  const cx = Math.floor(size / 2);
  const cy = Math.floor(size / 2);
  const cos = Math.SQRT1_2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      // inverse rotation by -45°
      const sx = Math.round(dx * cos + dy * cos + base.px);
      const sy = Math.round(-dx * cos + dy * cos + base.py);
      if (sx < 0 || sy < 0 || sx >= src.width || sy >= src.height) continue;
      const i = (sy * src.width + sx) * 4;
      if ((src.data[i + 3] ?? 0) === 0) continue;
      out.data.set(src.data.subarray(i, i + 4), (y * size + x) * 4);
    }
  }
  return { img: out, px: cx, py: cy };
}

function opaqueBounds(img: PixelImage): { x0: number; y0: number; x1: number; y1: number } {
  let x0 = img.width;
  let y0 = img.height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < img.height; y++)
    for (let x = 0; x < img.width; x++)
      if ((img.data[(y * img.width + x) * 4 + 3] ?? 0) > 0) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  // include the 1px outline added at composite time
  return { x0: x0 - 1, y0: y0 - 1, x1: x1 + 1, y1: y1 + 1 };
}

const orientCache = new Map<string, Sprite>();
function orientedWeapon(def: WeaponDef, setKey: string, deg: number): Sprite {
  const k = setKey + ':' + deg;
  let s = orientCache.get(k);
  if (!s) {
    s = rotateSprite(weaponSprite(def, setKey), deg);
    orientCache.set(k, s);
  }
  return s;
}

function drawWeapon(c: Ctx, hand: HandInfo, setKey: string): void {
  const def = c.weapon;
  if (!def || c.pose.weapon === 'hidden') return;
  const { view, pose } = c;
  const sign = view === 'back' ? 1 : -1;
  const o = pose.weapon === 'rest' ? def.rest : pose.weapon;
  let deg = 0;
  if (def.rotates) {
    deg = o === 'up' ? 0 : o === 'down' ? 180 : o === 'out' ? 90 * sign : o === 'diagUp' ? 45 * sign : o === 'diagDown' ? 135 * sign : 0;
  }
  const s = orientedWeapon(def, setKey, deg);
  const flip = !def.rotates && view === 'back';
  let dx = hand.x - (flip ? s.img.width - 1 - s.px : s.px);
  let dy = hand.y - s.py + pose.rootY;
  if (def.rotates) {
    // Slide the grip along the shaft so the weapon stays inside the frame.
    const rad = (deg * Math.PI) / 180;
    const tx = Math.round(Math.sin(rad));
    const ty = Math.round(-Math.cos(rad));
    const bb = opaqueBounds(s.img);
    for (let k = 0; k < 10; k++) {
      const x0 = dx + bb.x0;
      const x1 = dx + bb.x1;
      const y0 = dy + bb.y0;
      const y1 = dy + bb.y1;
      const out = (tx < 0 && x0 < 0) || (tx > 0 && x1 >= FRAME_WIDTH) || (ty < 0 && y0 < 0) || (ty > 0 && y1 >= FRAME_HEIGHT);
      if (!out) break;
      dx -= tx;
      dy -= ty;
    }
  }
  blit(c.L, s.img, dx, dy, { flipX: flip });
  if (!def.rotates && pose.fx > 0) heldItemFx(c, hand, setKey);
}

/** Arrow for the bow, sparkles for the book. Drawn on the frame (no outline). */
function heldItemFx(c: Ctx, hand: HandInfo, setKey: string): void {
  const dir = c.view === 'back' ? 1 : -1;
  const y = hand.y + c.pose.rootY;
  const fx = c.pose.fx;
  if (setKey === 'forest_scout') {
    const shaft = 0x9a6a3e;
    if (fx === 3 || fx === 1) {
      // nocked (fx 3) or just loosed (fx 1, arrow ahead of the bow)
      const start = fx === 3 ? hand.x - dir * 1 : hand.x + dir * 3;
      for (let i = 0; i < 6; i++) setPixel(c.L, start + dir * i, y, i === 5 ? 0xd8dee8 : shaft);
      setPixel(c.L, start + dir * 5, y - 1, 0xb4bfcc);
      setPixel(c.L, start + dir * 5, y + 1, 0xb4bfcc);
      setPixel(c.L, start - dir * 1, y - 1, 0xf4efe6);
      setPixel(c.L, start - dir * 1, y + 1, 0xf4efe6);
    } else {
      for (let i = 0; i < 4; i++) blendPixel(c.F, hand.x + dir * (4 + i * 2), y, 0xf4efe6, 200 - i * 40);
    }
    return;
  }
  if (fx === 3) return;
  sparkle(c.L, hand.x + dir * 4, y - 2, fx === 2 ? 2 : 1, 0x8fe3ff);
  if (fx === 2) {
    setPixel(c.L, hand.x + dir * 7, y - 5, 0xffffff);
    setPixel(c.L, hand.x + dir * 2, y - 6, 0xc9f1ff);
  }
}

function sparkle(img: PixelImage, x: number, y: number, r: number, col: Color): void {
  setPixel(img, x, y, 0xffffff);
  for (let i = 1; i <= r; i++) {
    setPixel(img, x - i, y, col);
    setPixel(img, x + i, y, col);
    setPixel(img, x, y - i, col);
    setPixel(img, x, y + i, col);
  }
}

function drawSmear(c: Ctx, hand: HandInfo): void {
  if (!c.pose.smear) return;
  const col = c.weapon?.smear ?? 0xffffff;
  const dir = c.view === 'back' ? 1 : -1;
  const cx = c.view === 'side' ? hand.x + 3 : hand.x - dir * 1;
  const cy = (c.view === 'side' ? hand.y : hand.y - 3) + c.pose.rootY;
  const R = c.weapon && c.weapon.rotates ? 10 : 7;
  for (let a = 40; a <= 150; a += 4) {
    const rad = (a * Math.PI) / 180;
    const fade = a < 60 ? 0.5 : a > 125 ? 0.6 : 1;
    for (const [rr, al] of [
      [R, 230],
      [R - 1, 150],
      [R - 2, 70],
    ] as const) {
      const x = Math.round(cx + dir * Math.sin(rad) * rr);
      const y = Math.round(cy - Math.cos(rad) * rr * 0.85);
      blendPixel(c.F, x, y, col, Math.round(al * fade));
    }
  }
}

/* ------------------------------------------------------------------ */
/* Frame rendering                                                     */
/* ------------------------------------------------------------------ */

function viewOf(dir: Direction): View {
  return dir === 'down' ? 'front' : dir === 'up' ? 'back' : 'side';
}

function equipSet(id: EquipVisual | undefined, slot: string): string | null {
  if (!id) return null;
  const p = parseEquipVisual(id);
  if (p.slot !== slot) throw new Error(`Equipment ${id} is not a ${slot} item`);
  return p.set;
}

function makeCtx(app: Appearance, view: View, pose: Pose, L: PixelImage, F: PixelImage): Ctx {
  const tier = ([1, 2, 3].includes(app.bodyTier) ? app.bodyTier : 2) as BodyTier;
  const skinIdx = clampIdx(app.skinTone, SKIN_TONES.length);
  const hairIdx = clampIdx(app.hairColor, HAIR_COLORS.length);
  const chestSet = equipSet(app.equipment.chest, 'chest');
  const backSet = equipSet(app.equipment.back, 'back');
  const headSet = equipSet(app.equipment.head, 'head');
  const weaponSet = equipSet(app.equipment.weapon, 'weapon');
  return {
    view,
    g: TIERS[tier],
    tier,
    skin: skinRamp(skinIdx),
    hair: hairRamp(hairIdx),
    chest: chestSet ? CHEST_STYLES[chestSet as keyof typeof CHEST_STYLES] : DEFAULT_CHEST,
    hasChest: !!chestSet,
    back: backSet ? BACK_STYLES[backSet as keyof typeof BACK_STYLES] : null,
    headGear: headSet ? HEAD_GEAR[headSet as keyof typeof HEAD_GEAR] : null,
    weapon: weaponSet ? WEAPONS[weaponSet as keyof typeof WEAPONS] : null,
    hairStyle: clampIdx(app.hairStyle, HAIR_STYLES.length),
    pose,
    L,
    F,
  };
}

function clampIdx(v: number, n: number): number {
  const i = Math.floor(Number.isFinite(v) ? v : 0);
  return Math.max(0, Math.min(n - 1, i));
}

const skinRamps = new Map<number, Ramp>();
function skinRamp(i: number): Ramp {
  let r = skinRamps.get(i);
  if (!r) {
    const b = SKIN_TONES[i]!;
    r = { hi: shade(b, 0.12), light: shade(b, 0.06), base: b, shadow: shade(b, -0.12), deep: shade(b, -0.25) };
    skinRamps.set(i, r);
  }
  return r;
}
const hairRamps = new Map<number, Ramp>();
function hairRamp(i: number): Ramp {
  let r = hairRamps.get(i);
  if (!r) {
    r = ramp(HAIR_COLORS[i]!);
    if (i === 0) r = { ...r, light: shade(HAIR_COLORS[0]!, 0.18), hi: shade(HAIR_COLORS[0]!, 0.3) };
    hairRamps.set(i, r);
  }
  return r;
}

/** Renders one upright frame (left/right share the side view). */
function renderView(app: Appearance, anim: AnimationName, view: View, frame: number, cond: Condition, out: PixelImage, ox: number, oy: number, flip: boolean): void {
  const F = scratchF;
  const L = scratchL;
  clearImage(F);
  clearImage(L);
  const weaponSet = app.equipment.weapon ? parseEquipVisual(app.equipment.weapon).set : null;
  const pose = makePose(anim, view, frame, cond, app.face, !!weaponSet, !!weaponSet && !WEAPONS[weaponSet].rotates);
  const c = makeCtx(app, view, pose, L, F);
  const setKey = weaponSet ?? '';

  drawShadow(c);

  if (view === 'front') {
    drawBackBehind(c);
    commit(c);
    drawLegsFront(c);
    commit(c);
    drawTorsoFront(c);
    drawBackFront(c);
    commit(c);
    drawHead(c);
    commit(c);
    drawHair(c);
    commit(c);
    drawHeadGear(c);
    commit(c);
    drawFace(c);
    // other arm, then weapon, then weapon arm over the grip
    drawArm(c, 'O');
    commit(c);
    const hand = handOnly(c, 'W');
    drawSmear(c, hand);
    drawWeapon(c, hand, setKey);
    commit(c);
    drawArm(c, 'W');
    commit(c);
  } else if (view === 'back') {
    const hand = handOnly(c, 'W');
    drawWeapon(c, hand, setKey);
    commit(c);
    drawLegsFront(c);
    commit(c);
    drawTorsoFront(c);
    commit(c);
    drawBackFront(c);
    commit(c);
    drawHead(c);
    commit(c);
    drawHair(c);
    commit(c);
    drawHeadGear(c);
    commit(c);
    drawArm(c, 'O');
    commit(c);
    drawArm(c, 'W');
    commit(c);
    drawSmear(c, hand);
  } else {
    drawArm(c, 'O', true);
    commit(c);
    drawBackBehind(c);
    commit(c);
    drawLegsSide(c, 'far');
    commit(c);
    drawLegsSide(c, 'near');
    commit(c);
    drawTorsoSide(c);
    drawBackFront(c);
    commit(c);
    // A raised near arm goes behind the head so it never hides the face.
    const raised = pose.armW.kind === 'up';
    const hand = handOnly(c, 'W');
    if (raised) {
      drawWeapon(c, hand, setKey);
      commit(c);
      drawArm(c, 'W');
      commit(c);
    }
    drawHead(c);
    commit(c);
    drawHair(c);
    commit(c);
    drawHeadGear(c);
    commit(c);
    drawFace(c);
    if (!raised) {
      drawSmear(c, hand);
      drawWeapon(c, hand, setKey);
      commit(c);
      drawArm(c, 'W');
      commit(c);
    }
  }
  blit(out, F, ox, oy, { flipX: flip });
}

/** Computes the weapon-hand grip without leaving pixels behind. */
function handOnly(c: Ctx, which: 'W' | 'O'): HandInfo {
  const h = drawArm(c, which);
  clearImage(c.L);
  return h;
}

const scratchF = createImage(FRAME_WIDTH, FRAME_HEIGHT);
const scratchL = createImage(FRAME_WIDTH, FRAME_HEIGHT);

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export function renderCharacterFrame(
  appearance: Appearance,
  anim: AnimationName,
  dir: Direction,
  frame: number,
  condition: Condition = 'normal',
): PixelImage {
  const img = createImage(FRAME_WIDTH, FRAME_HEIGHT);
  const f = Math.max(0, Math.min(ANIMATION_DEFS[anim].frames - 1, frame | 0));
  renderView(appearance, anim, viewOf(dir), f, condition, img, 0, 0, dir === 'right');
  return img;
}

export function renderAvatarPortrait(appearance: Appearance, condition: Condition = 'normal'): PixelImage {
  return renderCharacterFrame(appearance, 'idle', 'down', 0, condition);
}

export interface CharacterSheetOptions {
  condition?: Condition;
  /** Accepted for API symmetry; auras are separate overlays (see renderAuraSheet). */
  aura?: AuraKind;
}

export function renderCharacterSheet(appearance: Appearance, options: CharacterSheetOptions = {}): CharacterSheet {
  const cond = options.condition ?? 'normal';
  const rows = ANIMATION_NAMES.length * DIRECTIONS.length;
  const image = createImage(FRAME_WIDTH * SHEET_COLUMNS, FRAME_HEIGHT * rows);
  const animations = {} as Record<AnimationName, AnimationInfo>;
  ANIMATION_NAMES.forEach((name, ai) => {
    const def = ANIMATION_DEFS[name];
    const rowMap = {} as Record<Direction, number>;
    DIRECTIONS.forEach((dir, di) => {
      const row = ai * DIRECTIONS.length + di;
      rowMap[dir] = row;
      for (let f = 0; f < def.frames; f++) {
        renderView(appearance, name, viewOf(dir), f, cond, image, f * FRAME_WIDTH, row * FRAME_HEIGHT, dir === 'right');
      }
    });
    animations[name] = { row: ai * DIRECTIONS.length, frames: def.frames, fps: def.fps, loop: def.loop, rows: rowMap };
  });
  return {
    image,
    frameWidth: FRAME_WIDTH,
    frameHeight: FRAME_HEIGHT,
    columns: SHEET_COLUMNS,
    animations,
    directions: [...DIRECTIONS],
    frameIndex: characterFrameIndex,
    frameRect: (anim, dir, frame) => {
      const i = characterFrameIndex(anim, dir, frame);
      return {
        x: (i % SHEET_COLUMNS) * FRAME_WIDTH,
        y: Math.floor(i / SHEET_COLUMNS) * FRAME_HEIGHT,
        w: FRAME_WIDTH,
        h: FRAME_HEIGHT,
      };
    },
  };
}

/** A sensible default look (used by previews and as a fallback). */
export const DEFAULT_APPEARANCE: Appearance = {
  bodyTier: 2,
  skinTone: 1,
  hairStyle: 0,
  hairColor: 2,
  face: 0,
  equipment: {},
};

// keep fillEllipse referenced for consumers of this module's helpers
void fillEllipse;

