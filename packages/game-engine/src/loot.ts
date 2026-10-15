import { ITEMS, TIER_ORDER, type ItemDef, type Tier } from '@realmbound/content';
import { CONFIG } from './config';
import { equipmentBonuses } from './economy';
import { weightedPick } from './rng';
import type { PlayerState } from './types';

function candidates(state: PlayerState, tier: Tier): ItemDef[] {
  return ITEMS.filter(
    (i) =>
      i.tier === tier &&
      (i.lootWeight ?? 0) > 0 &&
      // Equipment drops once; consumables can repeat.
      (i.slot === 'consumable' || !state.inventory[i.id]),
  );
}

/** Chance of a loot drop on a meaningful action. Never controlled by AI. */
export function lootChance(state: PlayerState): number {
  const L = CONFIG.loot;
  let chance = L.baseChance;
  if (state.momentum >= CONFIG.momentum.high) chance += L.highMomentumChance;
  if (!state.conditions.tempted) chance += equipmentBonuses(state).lootPct / 100;
  return Math.min(0.25, chance);
}

export function rollLoot(state: PlayerState, rand: () => number, opts: { guaranteed?: boolean; minTier?: Tier } = {}): string | undefined {
  if (!opts.guaranteed && rand() >= lootChance(state)) return undefined;
  const weights = CONFIG.loot.tierWeights;
  const minIdx = opts.minTier ? TIER_ORDER.indexOf(opts.minTier) : 0;
  // Tempted disables the rare loot bonus: rare and above drop at half weight.
  const tiers = TIER_ORDER.filter((t, i) => i >= minIdx && candidates(state, t).length > 0).map((t) => ({
    item: t,
    weight: weights[t] * (state.conditions.tempted && TIER_ORDER.indexOf(t) >= 2 ? 0.5 : 1),
  }));
  const tier = weightedPick(rand, tiers);
  if (!tier) return undefined;
  const pool = candidates(state, tier).map((i) => ({ item: i.id, weight: i.lootWeight ?? 1 }));
  return weightedPick(rand, pool);
}
