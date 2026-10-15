import { ITEM_BY_ID } from '@realmbound/content';
import type { Appearance, PlayerState } from '@realmbound/game-engine';
import {
  renderAvatarPortrait,
  renderCharacterSheet,
  type Appearance as PixelAppearance,
  type CharacterSheet,
  type Condition as PixelCondition,
  type EquipVisual,
  type PixelImage,
} from '@realmbound/pixel';

export function toCanvas(img: PixelImage): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext('2d')!;
  g.putImageData(new ImageData(new Uint8ClampedArray(img.data), img.width, img.height), 0, 0);
  return c;
}

export function pixelAppearance(a: Appearance, equipment: Partial<Record<string, string>>): PixelAppearance {
  const eq: PixelAppearance['equipment'] = {};
  for (const slot of ['head', 'chest', 'weapon', 'back'] as const) {
    const id = equipment[slot];
    const visual = id ? (ITEM_BY_ID[id]?.visual ?? id) : undefined;
    if (visual) eq[slot] = visual as EquipVisual;
  }
  return { bodyTier: a.bodyTier, skinTone: a.skinTone, hairStyle: a.hairStyle, hairColor: a.hairColor, face: a.face, equipment: eq };
}

export function conditionOf(state: Pick<PlayerState, 'conditions' | 'momentum'>): PixelCondition {
  if (state.conditions.fallen) return 'exhausted';
  if (state.conditions.fatigue) return 'tired';
  if (state.momentum >= 70) return 'energized';
  return 'normal';
}

const sheetCache = new Map<string, { sheet: CharacterSheet; canvas: HTMLCanvasElement }>();

export function characterSheet(appearance: PixelAppearance, condition: PixelCondition = 'normal') {
  const key = JSON.stringify([appearance, condition]);
  let hit = sheetCache.get(key);
  if (!hit) {
    const sheet = renderCharacterSheet(appearance, { condition });
    hit = { sheet, canvas: toCanvas(sheet.image) };
    if (sheetCache.size > 40) sheetCache.clear();
    sheetCache.set(key, hit);
  }
  return hit;
}

const portraitCache = new Map<string, string>();

/** PNG data URL of the idle front frame, for small avatars in lists. */
export function portraitUrl(appearance: PixelAppearance, condition: PixelCondition = 'normal'): string {
  const key = JSON.stringify([appearance, condition]);
  let url = portraitCache.get(key);
  if (!url) {
    url = toCanvas(renderAvatarPortrait(appearance, condition)).toDataURL();
    portraitCache.set(key, url);
  }
  return url;
}
