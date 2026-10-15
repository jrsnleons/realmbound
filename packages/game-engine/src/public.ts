import { ARCHETYPES, STATS, type Stat } from '@realmbound/content';
import { rankedStats } from './levels';
import type { Appearance, PlayerState, WorldState } from './types';

/** What other players may see. Never includes habit names, health data or body labels. */
export interface PublicProfile {
  level: number;
  title?: string;
  appearance: Appearance;
  equipment: PlayerState['equipment'];
  archetype?: string;
  stats: Record<Stat, number>;
  achievements: string[];
  worldState: WorldState;
  momentumTier: 'high' | 'normal' | 'low';
}

export function archetypeOf(state: PlayerState): (typeof ARCHETYPES)[number] | undefined {
  const top = rankedStats(state).slice(0, 2);
  if (state.skills[top[0]!].total < 50) return undefined;
  return ARCHETYPES.find((a) => a.stats.every((s) => top.includes(s))) ?? ARCHETYPES.find((a) => a.stats[0] === top[0]);
}

export function publicProfile(state: PlayerState): PublicProfile {
  const { bodyMode: _bodyMode, ...visual } = state.appearance;
  return {
    level: state.level,
    title: state.activeTitle,
    appearance: { ...visual, bodyMode: 'fantasy' },
    equipment: { ...state.equipment },
    archetype: archetypeOf(state)?.name,
    stats: Object.fromEntries(STATS.map((s) => [s, state.skills[s].level])) as Record<Stat, number>,
    achievements: Object.keys(state.achievements),
    worldState: state.worldState,
    momentumTier: state.momentum >= 70 ? 'high' : state.momentum < 40 ? 'low' : 'normal',
  };
}
