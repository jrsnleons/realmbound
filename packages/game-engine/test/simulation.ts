import { addDays, hashString, rngFor, weekday, type HabitInput } from '../src';
import { Sim, START } from './helpers';

export interface Profile {
  name: string;
  /** Chance of doing each scheduled habit. */
  consistency: number;
  /** Extra logs of the same habit per day (spam attempt). */
  spam?: number;
  habits?: HabitInput[];
}

export const PROFILES: Profile[] = [
  { name: 'perfect', consistency: 1 },
  { name: 'steady', consistency: 0.75 },
  { name: 'struggling', consistency: 0.4 },
  { name: 'spammer', consistency: 1, spam: 4 },
  {
    name: 'overcommitted',
    consistency: 0.6,
    habits: [
      { name: 'Walk home' },
      { name: 'Drink water' },
      { name: 'Hydrate' },
      { name: 'Drink a glass of water' },
      { name: 'Read 20 pages' },
      { name: 'Study' },
      { name: 'Work out' },
      { name: 'Avoid junk food' },
    ],
  },
];

export function simulate(p: Profile, days: number) {
  const sim = Sim.start(p.habits);
  const rand = rngFor(hashString(p.name), 1);
  for (let i = 0; i < days; i++) {
    const date = addDays(START, i);
    sim.goTo(date);
    for (const h of sim.habits) {
      if (h.archived || !h.days.includes(weekday(date))) continue;
      if (rand() > p.consistency) continue;
      if (h.kind === 'avoid') sim.act({ type: 'avoidCheckin', habitId: h.id, resisted: true });
      else {
        sim.act({ type: 'logHabit', habitId: h.id });
        for (let s = 0; s < (p.spam ?? 0); s++) {
          try {
            sim.act({ type: 'logHabit', habitId: h.id });
          } catch {
            break;
          }
        }
      }
    }
    if (rand() < p.consistency) sim.act({ type: 'logSleep', hours: 8 });
    else sim.act({ type: 'logSleep', hours: 5.5 });
  }
  const s = sim.state;
  return {
    level: s.level,
    totalXp: s.totalXp,
    gold: s.gold,
    quests: s.counters.questsCompleted,
    bosses: s.counters.bossesDefeated,
    momentum: s.momentum,
    world: s.worldState,
    items: Object.keys(s.inventory).length,
  };
}
