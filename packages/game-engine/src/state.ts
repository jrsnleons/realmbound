import { MATERIALS, STARTER_ITEMS, STATS, type Material, type Stat } from '@realmbound/content';
import { CONFIG } from './config';
import type { LocalDate } from './dates';
import { emptySkills } from './levels';
import { initiationQuest } from './quests';
import type { Appearance, ChronicleEntry, PlayerState } from './types';

export const DEFAULT_APPEARANCE: Appearance = { bodyMode: 'fantasy', bodyTier: 2, skinTone: 2, hairStyle: 0, hairColor: 1, face: 0 };

export function createInitialState(opts: {
  seed: number;
  today: LocalDate;
  appearance?: Partial<Appearance>;
  sleepGoalHours?: number;
}): PlayerState {
  const state: PlayerState = {
    schema: 1,
    seed: opts.seed >>> 0,
    counter: 0,
    createdOn: opts.today,
    today: opts.today,
    level: 1,
    xp: 0,
    totalXp: 0,
    gold: 25,
    skills: emptySkills(),
    momentum: CONFIG.momentum.initial,
    highMomentumStreak: 0,
    conditions: { fatigue: false, tempted: false, fallen: false },
    lowMomentumDays: 0,
    restMode: { on: false },
    worldState: 'neutral',
    daily: { date: opts.today, pools: {} },
    history: {},
    sleep: {},
    sleepGoalHours: opts.sleepGoalHours ?? 7,
    habitStats: {},
    quests: [],
    questMemory: {},
    inventory: Object.fromEntries(STARTER_ITEMS.map((i) => [i, 1])),
    materials: Object.fromEntries(MATERIALS.map((m) => [m, 0])) as Record<Material, number>,
    equipment: {},
    achievements: {},
    counters: {
      distinctDays: {},
      lastCountedDay: {},
      sleepGoalDays: 0,
      resistDays: 0,
      questsCompleted: 0,
      questsByCategory: {},
      bossesDefeated: 0,
      recoveriesCompleted: 0,
      returns: 0,
      liveQuests: 0,
      logs: 0,
    },
    initiation: { graduated: false, observations: [], lootGiven: false },
    chronicle: [],
    titles: ['Adventurer'],
    activeTitle: 'Adventurer',
    appearance: { ...DEFAULT_APPEARANCE, ...opts.appearance },
    feed: [],
  };
  const q = initiationQuest(state, 1, opts.today);
  if (q) state.quests.push(q);
  state.chronicle.push(snapshot(state, opts.today, 'Day 1', 'A new name was written in the Guild ledger.'));
  return state;
}

export function snapshot(state: PlayerState, date: LocalDate, label: string, highlight: string): ChronicleEntry {
  return {
    date,
    label,
    level: state.level,
    bodyTier: state.appearance.bodyTier,
    equipment: { ...state.equipment },
    stats: Object.fromEntries(STATS.map((s) => [s, state.skills[s].level])) as Record<Stat, number>,
    title: state.activeTitle,
    worldState: state.worldState,
    highlight,
  };
}
