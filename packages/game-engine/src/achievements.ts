import { ACHIEVEMENTS, type AchievementRule, type Category } from '@realmbound/content';
import { addItem } from './economy';
import type { LocalDate } from './dates';
import type { PlayerState } from './types';

function met(state: PlayerState, rule: AchievementRule): boolean {
  const c = state.counters;
  switch (rule.kind) {
    case 'distinctDays':
      return (c.distinctDays[rule.category] ?? 0) >= rule.days;
    case 'sleepGoalDays':
      return c.sleepGoalDays >= rule.days;
    case 'resistDays':
      return c.resistDays >= rule.days;
    case 'level':
      return state.level >= rule.level;
    case 'questsCompleted':
      return rule.category ? (c.questsByCategory[rule.category] ?? 0) >= rule.count : c.questsCompleted >= rule.count;
    case 'bossesDefeated':
      return c.bossesDefeated >= rule.count;
    case 'initiationComplete':
      return state.initiation.graduated;
    case 'recoveryComplete':
      return c.recoveriesCompleted >= 1;
    case 'returned':
      return c.returns >= 1;
    case 'highMomentumDays':
      return state.highMomentumStreak >= rule.days;
    case 'liveQuests':
      return c.liveQuests >= rule.count;
  }
}

/** Unlocks every achievement whose rule is now met. Achievement gear is time-gated by distinct days. */
export function checkAchievements(state: PlayerState, date: LocalDate): string[] {
  const unlocked: string[] = [];
  for (const a of ACHIEVEMENTS) {
    if (state.achievements[a.id] || !met(state, a.rule)) continue;
    state.achievements[a.id] = date;
    unlocked.push(a.id);
    state.feed.push({ kind: 'achievement', id: a.id, date });
    if (a.rewardItemId && !state.inventory[a.rewardItemId]) {
      addItem(state, a.rewardItemId);
      state.feed.push({ kind: 'loot', itemId: a.rewardItemId, date });
    }
    if (a.rewardTitle && !state.titles.includes(a.rewardTitle)) state.titles.push(a.rewardTitle);
  }
  return unlocked;
}

/** Counts a category (and "any") once per local day. */
export function countDistinctDay(state: PlayerState, category: Category | 'any', date: LocalDate): void {
  const c = state.counters;
  if (c.lastCountedDay[category] === date) return;
  c.lastCountedDay[category] = date;
  c.distinctDays[category] = (c.distinctDays[category] ?? 0) + 1;
}
