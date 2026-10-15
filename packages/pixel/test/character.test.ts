import { describe, expect, it } from 'vitest';
import {
  ANIMATION_DEFS,
  ANIMATION_NAMES,
  CONDITIONS,
  DIRECTIONS,
  EQUIPMENT_SETS,
  EQUIPMENT_SLOTS,
  EQUIPMENT_VISUAL_IDS,
  FRAME_HEIGHT,
  FRAME_WIDTH,
  SHEET_COLUMNS,
  type Appearance,
  type EquipVisual,
  characterFrameIndex,
  countOpaque,
  crop,
  parseEquipVisual,
  renderAvatarPortrait,
  renderCharacterFrame,
  renderCharacterSheet,
} from '../src/index';

const base: Appearance = { bodyTier: 2, skinTone: 1, hairStyle: 0, hairColor: 2, face: 0, equipment: {} };
const fullSet = (s: (typeof EQUIPMENT_SETS)[number]): Appearance['equipment'] => ({
  head: `${s}_head`,
  chest: `${s}_chest`,
  weapon: `${s}_weapon`,
  back: `${s}_back`,
});

describe('equipment ids', () => {
  it('exports all 24 visual ids', () => {
    expect(EQUIPMENT_VISUAL_IDS).toHaveLength(24);
    expect(new Set(EQUIPMENT_VISUAL_IDS).size).toBe(24);
    for (const s of EQUIPMENT_SETS) for (const slot of EQUIPMENT_SLOTS) expect(EQUIPMENT_VISUAL_IDS).toContain(`${s}_${slot}`);
  });
  it('parses ids with underscores in the set name', () => {
    expect(parseEquipVisual('forest_scout_back')).toEqual({ set: 'forest_scout', slot: 'back' });
    expect(parseEquipVisual('iron_guardian_head')).toEqual({ set: 'iron_guardian', slot: 'head' });
  });
  it('rejects an item in the wrong slot', () => {
    expect(() => renderCharacterFrame({ ...base, equipment: { head: 'traveler_chest' as EquipVisual } }, 'idle', 'down', 0)).toThrow();
  });
});

describe('character sheet', () => {
  const sheet = renderCharacterSheet(base);

  it('has the documented dimensions and layout', () => {
    expect(sheet.frameWidth).toBe(24);
    expect(sheet.frameHeight).toBe(32);
    expect(sheet.columns).toBe(SHEET_COLUMNS);
    expect(sheet.image.width).toBe(FRAME_WIDTH * SHEET_COLUMNS);
    expect(sheet.image.height).toBe(FRAME_HEIGHT * ANIMATION_NAMES.length * DIRECTIONS.length);
    expect(sheet.directions).toEqual(['down', 'up', 'left', 'right']);
  });

  it('reports frame counts per animation', () => {
    expect(sheet.animations.idle.frames).toBe(2);
    expect(sheet.animations.walk.frames).toBe(4);
    expect(sheet.animations.run.frames).toBe(4);
    expect(sheet.animations.interact.frames).toBe(2);
    expect(sheet.animations.attack.frames).toBe(3);
    expect(sheet.animations.celebrate.frames).toBe(2);
    expect(sheet.animations.sit.frames).toBe(1);
    expect(sheet.animations.sleep.frames).toBe(1);
  });

  it('maps (anim, dir, frame) to row-major frame indices', () => {
    ANIMATION_NAMES.forEach((a, ai) =>
      DIRECTIONS.forEach((d, di) => {
        expect(sheet.animations[a].rows[d]).toBe(ai * 4 + di);
        expect(sheet.frameIndex(a, d, 1)).toBe((ai * 4 + di) * 4 + Math.min(1, ANIMATION_DEFS[a].frames - 1));
      }),
    );
    expect(characterFrameIndex('walk', 'left', 3)).toBe((1 * 4 + 2) * 4 + 3);
    expect(sheet.frameRect('walk', 'left', 3)).toEqual({ x: 72, y: 6 * 32, w: 24, h: 32 });
  });

  it('every real frame is non-empty and padding frames are blank', () => {
    for (const a of ANIMATION_NAMES)
      for (const d of DIRECTIONS)
        for (let f = 0; f < SHEET_COLUMNS; f++) {
          const r = sheet.frameRect(a, d, 0);
          const img = crop(sheet.image, f * FRAME_WIDTH, r.y, FRAME_WIDTH, FRAME_HEIGHT);
          if (f < ANIMATION_DEFS[a].frames) expect(countOpaque(img), `${a} ${d} ${f}`).toBeGreaterThan(120);
          else expect(countOpaque(img)).toBe(0);
        }
  });

  it('frame helper matches the sheet', () => {
    const fr = renderCharacterFrame(base, 'walk', 'right', 2);
    const r = sheet.frameRect('walk', 'right', 2);
    expect(Array.from(crop(sheet.image, r.x, r.y, r.w, r.h).data)).toEqual(Array.from(fr.data));
  });

  it('is deterministic', () => {
    const a = renderCharacterSheet({ ...base, equipment: fullSet('warden') }, { condition: 'tired' });
    const b = renderCharacterSheet({ ...base, equipment: fullSet('warden') }, { condition: 'tired' });
    expect(Buffer.from(a.image.data).equals(Buffer.from(b.image.data))).toBe(true);
  });

  it('right is the mirror of left', () => {
    const l = renderCharacterFrame(base, 'idle', 'left', 0);
    const r = renderCharacterFrame(base, 'idle', 'right', 0);
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < 24; x++) {
        const li = (y * 24 + x) * 4 + 3;
        const ri = (y * 24 + (23 - x)) * 4 + 3;
        expect(l.data[li]).toBe(r.data[ri]);
      }
  });

  it('renders a full sheet quickly', () => {
    renderCharacterSheet({ ...base, equipment: fullSet('dreamwalker') });
    const t = performance.now();
    for (let i = 0; i < 5; i++) renderCharacterSheet({ ...base, bodyTier: 3, equipment: fullSet('iron_guardian') });
    const ms = (performance.now() - t) / 5;
    expect(ms).toBeLessThan(150); // generous for slow CI; ~35ms locally
  });
});

describe('option combinations', () => {
  it('renders every tier × set × direction × animation frame', () => {
    for (const tier of [1, 2, 3] as const)
      for (const s of [...EQUIPMENT_SETS, null])
        for (const a of ANIMATION_NAMES)
          for (const d of DIRECTIONS)
            for (let f = 0; f < ANIMATION_DEFS[a].frames; f++) {
              const img = renderCharacterFrame({ ...base, bodyTier: tier, equipment: s ? fullSet(s) : {} }, a, d, f);
              expect(countOpaque(img)).toBeGreaterThan(120);
            }
  });

  it('renders every hair style/colour, skin tone, face and condition', () => {
    for (let h = 0; h < 12; h++)
      for (let c = 0; c < 8; c++) {
        const img = renderAvatarPortrait({ ...base, hairStyle: h, hairColor: c, skinTone: (h + c) % 6, face: (h + c) % 4 });
        expect(countOpaque(img)).toBeGreaterThan(120);
      }
    for (const cond of CONDITIONS)
      for (let face = 0; face < 4; face++)
        for (const d of DIRECTIONS) expect(countOpaque(renderCharacterFrame({ ...base, face }, 'idle', d, 1, cond))).toBeGreaterThan(120);
  });

  it('mixes items from different sets', () => {
    const img = renderCharacterFrame(
      { ...base, equipment: { head: 'scholar_head', chest: 'iron_guardian_chest', weapon: 'forest_scout_weapon', back: 'dreamwalker_back' } },
      'attack',
      'left',
      1,
    );
    expect(countOpaque(img)).toBeGreaterThan(150);
  });

  it('clamps out-of-range appearance values instead of throwing', () => {
    expect(() => renderAvatarPortrait({ ...base, skinTone: 99, hairStyle: -3, hairColor: 42, face: 7 })).not.toThrow();
  });

  it('body tiers have distinct silhouettes', () => {
    const w = (t: 1 | 2 | 3) => countOpaque(renderCharacterFrame({ ...base, bodyTier: t }, 'idle', 'down', 0));
    expect(w(1)).toBeLessThan(w(2));
    expect(w(2)).toBeLessThan(w(3));
  });

  it('conditions change the portrait', () => {
    const n = renderAvatarPortrait(base, 'normal');
    for (const c of ['energized', 'tired', 'exhausted'] as const)
      expect(Buffer.from(renderAvatarPortrait(base, c).data).equals(Buffer.from(n.data))).toBe(false);
  });
});
