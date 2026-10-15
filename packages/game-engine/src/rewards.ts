import { CATEGORY_INFO, type Material, type Stat } from '@realmbound/content';
import { CONFIG } from './config';
import { diffDays } from './dates';
import { addMaterials, equipmentBonuses } from './economy';
import { grantCharacterXp, grantSkillXp } from './levels';
import type { Habit, PlayerState, Reward } from './types';

export interface LogOptions {
  socialVerified?: boolean;
}

/** Share of a full reward for the nth log in a pool today (n starts at 0). */
export function diminishingShare(n: number): number {
  const d = CONFIG.rewards.diminishing;
  return d[Math.min(n, d.length - 1)]!;
}

export function newHabitMultiplier(habit: Pick<Habit, 'createdOn'>, today: string): number {
  const age = diffDays(habit.createdOn, today);
  for (const [days, mult] of CONFIG.rewards.newHabitRamp) if (age < days) return mult;
  return 1;
}

/**
 * Computes (but does not apply) the reward for completing or resisting a habit today.
 * Every multiplier is listed in `notes` so the app can explain the number.
 */
export function computeHabitReward(state: PlayerState, habit: Habit, opts: LogOptions = {}): Reward {
  const R = CONFIG.rewards;
  const notes: string[] = [];
  let base = habit.kind === 'avoid' ? R.baseXp.avoid : R.baseXp[habit.cadence];
  if (habit.mastered) {
    base = base * R.masteredBaseMultiplier + R.masteredConsistencyBonus;
    notes.push('Mastered: lower base, consistency bonus');
  }
  const diff = R.difficultyMultiplier[habit.difficulty];
  const pool = state.daily.pools[habit.poolKey] ?? { count: 0, xp: 0 };
  const repeats = state.daily.pools[`h:${habit.id}`]?.count ?? 0;
  const sameHabit = R.sameHabitRepeat[Math.min(repeats, R.sameHabitRepeat.length - 1)]!;
  const share = Math.min(diminishingShare(pool.count), sameHabit);
  if (share < 1) notes.push(`Repeat in the same pool today: ${Math.round(share * 100)}%`);
  const ramp = newHabitMultiplier(habit, state.today);
  if (ramp < 1) notes.push(`New habit, still calibrating: ${Math.round(ramp * 100)}%`);

  const eq = equipmentBonuses(state);
  const info = CATEGORY_INFO[habit.category];
  const stat: Stat = habit.kind === 'avoid' ? 'discipline' : info.stat;
  let bonus = eq.xpPct / 100 + (eq.statPct[stat] ?? 0) / 100;
  if (state.momentum >= CONFIG.momentum.high) {
    bonus += R.momentumHighBonus;
    notes.push('High Momentum: +10%');
  }
  if (opts.socialVerified) {
    bonus += R.socialVerifiedBonus;
    notes.push('Done together: +20%');
  }

  const raw = base * diff * share * ramp * (1 + bonus);
  const room = Math.max(0, R.dailyPoolCapXp - pool.xp);
  const primary = Math.min(Math.round(raw), room);
  if (Math.round(raw) > room) notes.push('Daily pool for this category is full');

  const skillXp: Partial<Record<Stat, number>> = {};
  if (primary > 0) skillXp[stat] = primary;
  const secondaryStat = habit.kind === 'avoid' ? CATEGORY_INFO[habit.category].stat : info.secondary;
  let secondary = 0;
  if (secondaryStat && secondaryStat !== stat && primary > 0) {
    secondary = Math.round(primary * R.secondaryStatShare);
    if (secondary > 0) skillXp[secondaryStat] = (skillXp[secondaryStat] ?? 0) + secondary;
  }

  const gold = primary > 0 ? Math.round(R.goldPerLog * share * (1 + eq.goldPct / 100)) : 0;
  const materials: Partial<Record<Material, number>> = {};
  if (share >= R.materialMinShare && primary > 0) materials[info.material] = 1 + eq.materialBonus;

  return {
    skillXp,
    characterXp: primary + secondary,
    gold,
    materials,
    items: [],
    momentumBefore: state.momentum,
    share,
    notes,
  };
}

export function applyReward(state: PlayerState, reward: Reward, poolKey?: string): void {
  for (const [stat, xp] of Object.entries(reward.skillXp) as [Stat, number][]) grantSkillXp(state, stat, xp);
  grantCharacterXp(state, reward.characterXp);
  state.gold += reward.gold;
  addMaterials(state, reward.materials);
  if (poolKey) {
    const pool = (state.daily.pools[poolKey] ??= { count: 0, xp: 0 });
    pool.count += 1;
    const primary = Math.max(0, ...Object.values(reward.skillXp).map((v) => v ?? 0));
    pool.xp += primary;
  }
}

export function emptyReward(state: PlayerState): Reward {
  return { skillXp: {}, characterXp: 0, gold: 0, materials: {}, items: [], momentumBefore: state.momentum, share: 0, notes: [] };
}

export function mergeRewards(a: Reward, b: Reward): Reward {
  const skillXp = { ...a.skillXp };
  for (const [k, v] of Object.entries(b.skillXp) as [Stat, number][]) skillXp[k] = (skillXp[k] ?? 0) + v;
  const materials = { ...a.materials };
  for (const [k, v] of Object.entries(b.materials) as [Material, number][]) materials[k] = (materials[k] ?? 0) + v;
  return {
    skillXp,
    characterXp: a.characterXp + b.characterXp,
    gold: a.gold + b.gold,
    materials,
    items: [...a.items, ...b.items],
    momentumBefore: a.momentumBefore,
    share: a.share,
    notes: [...a.notes, ...b.notes],
  };
}
