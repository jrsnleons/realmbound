import { CONFIG } from './config';
import { ITEM_BY_ID, RECIPES, type Material, type Slot, type Stat } from '@realmbound/content';
import type { PlayerState } from './types';

export class GameError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export interface EquipmentBonuses {
  xpPct: number;
  goldPct: number;
  materialBonus: number;
  lootPct: number;
  statPct: Partial<Record<Stat, number>>;
}

export function equipmentBonuses(state: PlayerState): EquipmentBonuses {
  const out: EquipmentBonuses = { xpPct: 0, goldPct: 0, materialBonus: 0, lootPct: 0, statPct: {} };
  for (const id of Object.values(state.equipment)) {
    const item = id ? ITEM_BY_ID[id] : undefined;
    if (!item) continue;
    const e = item.effects;
    out.xpPct += e.xpPct ?? 0;
    out.goldPct += e.goldPct ?? 0;
    out.materialBonus += e.materialBonus ?? 0;
    out.lootPct += e.lootPct ?? 0;
    if (e.stat) out.statPct[e.stat.stat] = (out.statPct[e.stat.stat] ?? 0) + e.stat.pct;
  }
  out.xpPct = Math.min(out.xpPct, CONFIG.rewards.maxEquipmentXpPct);
  return out;
}

export function addItem(state: PlayerState, itemId: string, qty = 1): void {
  state.inventory[itemId] = (state.inventory[itemId] ?? 0) + qty;
}

export function addMaterials(state: PlayerState, mats: Partial<Record<Material, number>>): void {
  for (const [m, n] of Object.entries(mats) as [Material, number][]) {
    state.materials[m] = (state.materials[m] ?? 0) + n;
  }
}

export function equip(state: PlayerState, itemId: string): void {
  const item = ITEM_BY_ID[itemId];
  if (!item) throw new GameError('unknown_item', 'That item does not exist.');
  if (item.slot === 'consumable') throw new GameError('not_equippable', 'That item cannot be equipped.');
  if (!state.inventory[itemId]) throw new GameError('not_owned', 'You do not own that item.');
  state.equipment[item.slot as Slot] = itemId;
}

export function unequip(state: PlayerState, slot: Slot): void {
  delete state.equipment[slot];
}

export function buy(state: PlayerState, itemId: string): void {
  const item = ITEM_BY_ID[itemId];
  if (!item || !item.sources.includes('shop') || item.price === undefined) {
    throw new GameError('not_for_sale', 'That item is not sold here.');
  }
  if (item.slot !== 'consumable' && state.inventory[itemId]) throw new GameError('already_owned', 'You already own that.');
  if (state.gold < item.price) throw new GameError('not_enough_gold', 'Not enough gold.');
  state.gold -= item.price;
  addItem(state, itemId);
}

export function craft(state: PlayerState, recipeId: string): string {
  const recipe = RECIPES.find((r) => r.id === recipeId);
  if (!recipe) throw new GameError('unknown_recipe', 'Unknown recipe.');
  if (state.level < recipe.level) throw new GameError('level_too_low', `Reach level ${recipe.level} to craft this.`);
  if (state.inventory[recipe.itemId]) throw new GameError('already_owned', 'You already own that.');
  if (state.gold < recipe.gold) throw new GameError('not_enough_gold', 'Not enough gold.');
  for (const [m, n] of Object.entries(recipe.materials) as [Material, number][]) {
    if ((state.materials[m] ?? 0) < n) throw new GameError('not_enough_materials', 'Not enough materials.');
  }
  state.gold -= recipe.gold;
  for (const [m, n] of Object.entries(recipe.materials) as [Material, number][]) state.materials[m] -= n;
  addItem(state, recipe.itemId);
  return recipe.itemId;
}

export function useConsumable(state: PlayerState, itemId: string): void {
  const item = ITEM_BY_ID[itemId];
  if (!item || item.slot !== 'consumable') throw new GameError('not_consumable', 'That cannot be used.');
  if (!state.inventory[itemId]) throw new GameError('not_owned', 'You do not have that.');
  state.inventory[itemId] -= 1;
  if (state.inventory[itemId] === 0) delete state.inventory[itemId];
}
