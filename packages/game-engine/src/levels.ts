import { STATS, type Stat } from '@realmbound/content';
import { CONFIG } from './config';
import type { PlayerState } from './types';

/** XP needed to go from `level` to `level + 1`. */
export function xpToNext(level: number): number {
  return Math.round(CONFIG.levels.characterBase * Math.pow(level, CONFIG.levels.characterExponent));
}

export function skillXpToNext(level: number): number {
  return Math.round(CONFIG.levels.skillBase * Math.pow(level, CONFIG.levels.skillExponent));
}

/** Total XP needed to reach `level` from level 1. */
export function totalXpForLevel(level: number): number {
  let sum = 0;
  for (let l = 1; l < level; l++) sum += xpToNext(l);
  return sum;
}

export function grantCharacterXp(state: PlayerState, amount: number): void {
  if (amount <= 0) return;
  state.totalXp += amount;
  state.xp += amount;
  while (state.level < CONFIG.levels.maxLevel && state.xp >= xpToNext(state.level)) {
    state.xp -= xpToNext(state.level);
    state.level += 1;
    state.feed.push({ kind: 'levelUp', level: state.level, date: state.today });
  }
}

export function grantSkillXp(state: PlayerState, stat: Stat, amount: number): void {
  if (amount <= 0) return;
  const s = state.skills[stat];
  s.total += amount;
  s.xp += amount;
  while (s.xp >= skillXpToNext(s.level)) {
    s.xp -= skillXpToNext(s.level);
    s.level += 1;
    state.feed.push({ kind: 'skillUp', stat, level: s.level, date: state.today });
  }
}

export function emptySkills(): PlayerState['skills'] {
  return Object.fromEntries(STATS.map((s) => [s, { xp: 0, level: 1, total: 0 }])) as PlayerState['skills'];
}

/** Stats ranked by total XP, highest first. */
export function rankedStats(state: PlayerState): Stat[] {
  return [...STATS].sort((a, b) => state.skills[b].total - state.skills[a].total);
}
