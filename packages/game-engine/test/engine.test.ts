import { describe, expect, it } from 'vitest';
import {
  addDays,
  applyAction,
  classifyHabit,
  computeHabitReward,
  createHabit,
  diminishingShare,
  findDuplicate,
  GameError,
  localDateTime,
  publicProfile,
  totalXpForLevel,
  weekStart,
  xpToNext,
} from '../src';
import { makePlayer, Sim, START } from './helpers';

describe('dates', () => {
  it('computes local dates in the player timezone', () => {
    const instant = new Date('2026-10-15T20:30:00Z');
    expect(localDateTime(instant, 'Asia/Manila')).toEqual({ date: '2026-10-16', hour: 4 });
    expect(localDateTime(instant, 'America/New_York')).toEqual({ date: '2026-10-15', hour: 16 });
    expect(localDateTime(instant, 'Not/AZone').date).toBe('2026-10-15');
  });
  it('finds the Monday week start', () => {
    expect(weekStart('2026-10-15')).toBe('2026-10-12');
    expect(weekStart('2026-10-12')).toBe('2026-10-12');
    expect(weekStart('2026-10-18')).toBe('2026-10-12');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('levels', () => {
  it('follows 50 × level^1.5', () => {
    expect(xpToNext(1)).toBe(50);
    expect(xpToNext(9)).toBe(1350);
    expect(totalXpForLevel(10)).toBeGreaterThan(5000);
    expect(totalXpForLevel(10)).toBeLessThan(6000);
  });
});

describe('classifier', () => {
  it.each([
    ['Walk home', 'movement', 'do'],
    ['Avoid junk food after work', 'nutrition', 'avoid'],
    ['Drink water', 'hydration', 'do'],
    ['Studying for exams', 'learning', 'do'],
    ['Go running', 'movement', 'do'],
    ['No late-night doomscrolling', 'screen', 'avoid'],
    ['Take my medication', 'health', 'do'],
    ['Meditate 10 minutes', 'mindfulness', 'do'],
    ['Work on my side project', 'craft', 'do'],
    ['Do the dishes', 'chores', 'do'],
    ['Lift weights at the gym', 'exercise', 'do'],
    ['Be in bed by 11', 'sleep', 'do'],
  ])('%s → %s', (name, category, kind) => {
    const c = classifyHabit(name);
    expect(c.category).toBe(category);
    expect(c.kind).toBe(kind);
  });

  it('flags likely duplicates so they share one reward pool', () => {
    const { habits } = makePlayer([{ name: 'Drink water' }]);
    const dup = findDuplicate({ name: 'Hydrate', category: 'hydration', kind: 'do' }, habits);
    expect(dup?.habitId).toBe('h1');
    const created = createHabit('h2', { name: 'Drink a glass of water after lunch' }, habits, START);
    expect(created.duplicateOf).toBe('h1');
    expect(created.habit.poolKey).toBe(habits[0]!.poolKey);
    expect(findDuplicate({ name: 'Read a book', category: 'learning', kind: 'do' }, habits)).toBeUndefined();
  });
});

describe('rewards', () => {
  it('applies 100/70/35/10% diminishing returns', () => {
    expect([0, 1, 2, 3, 9].map(diminishingShare)).toEqual([1, 0.7, 0.35, 0.1, 0.1]);
  });

  it('pays new habits at 60% while calibrating, full after a week', () => {
    const sim = Sim.start();
    const walk = sim.habit('Walk home');
    sim.state.equipment = {}; // no gear bonuses for this check
    expect(computeHabitReward(sim.state, walk).skillXp.mobility).toBe(9); // 15 × 0.6
    sim.goTo(addDays(START, 8));
    sim.state.momentum = 50;
    expect(computeHabitReward(sim.state, walk).skillXp.mobility).toBe(15);
  });

  it('caps a category pool at 60 XP a day and shrinks repeats', () => {
    const sim = Sim.start([{ name: 'Drink water' }]);
    sim.goTo(addDays(START, 10));
    const id = sim.habit('Drink water').id;
    const xps = [1, 2, 3, 4, 5].map(() => sim.act({ type: 'logHabit', habitId: id }).reward.skillXp.recovery ?? 0);
    expect(xps[0]).toBeGreaterThan(xps[1]!);
    expect(xps[1]).toBeGreaterThan(xps[2]!);
    expect(xps.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(60);
    expect(() => sim.act({ type: 'logHabit', habitId: id })).toThrow(GameError);
  });

  it('never mutates the input state', () => {
    const { state, habits } = makePlayer();
    const before = JSON.stringify(state);
    applyAction(state, habits, { type: 'logHabit', habitId: 'h1' }, { hour: 9 });
    expect(JSON.stringify(state)).toBe(before);
  });

  it('is deterministic', () => {
    const a = Sim.start();
    const b = Sim.start();
    for (let i = 0; i < 20; i++) {
      a.goTo(addDays(START, i));
      b.goTo(addDays(START, i));
      a.perfectDay();
      b.perfectDay();
    }
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
  });
});

describe('logging rules', () => {
  it('requires check-ins for Avoid habits and never punishes an honest slip', () => {
    const sim = Sim.start();
    const avoid = sim.habit('Avoid junk food after work');
    expect(() => sim.act({ type: 'logHabit', habitId: avoid.id })).toThrow(/check-in/);
    const goldBefore = sim.state.gold;
    const r = sim.act({ type: 'avoidCheckin', habitId: avoid.id, resisted: false });
    expect(r.reward.characterXp).toBe(0);
    expect(sim.state.gold).toBe(goldBefore);
    expect(sim.state.history[START]![avoid.id]).toBe('slipped');
    expect(() => sim.act({ type: 'avoidCheckin', habitId: avoid.id, resisted: true })).toThrow(/already/);
  });

  it('marks unlogged scheduled Do habits as missed and leaves unanswered Avoid habits neutral', () => {
    const sim = Sim.start();
    sim.goTo(addDays(START, 1));
    const marks = sim.state.history[START]!;
    expect(marks[sim.habit('Walk home').id]).toBe('missed');
    expect(marks[sim.habit('Avoid junk food after work').id]).toBeUndefined();
  });

  it('logs sleep once per day and marks sleep-goal habits', () => {
    const sim = Sim.start([{ name: 'Meet my sleep goal' }]);
    const r = sim.act({ type: 'logSleep', hours: 8 });
    expect(r.reward.skillXp.recovery).toBeGreaterThan(0);
    expect(sim.state.history[START]![sim.habit('Meet my sleep goal').id]).toBe('done');
    expect(() => sim.act({ type: 'logSleep', hours: 8 })).toThrow();
  });
});

describe('initiation and quests', () => {
  it('runs the 14-day Initiation end to end', () => {
    const sim = Sim.start();
    expect(sim.state.quests.some((q) => q.kind === 'initiation')).toBe(true);
    for (let i = 0; i < 15; i++) {
      sim.goTo(addDays(START, i));
      if (i === 4) expect(sim.state.quests.filter((q) => q.kind === 'main' && q.status === 'active').length).toBeGreaterThan(0);
      if (i === 6) expect(sim.state.boss).toBeDefined();
      sim.perfectDay();
    }
    expect(sim.state.initiation.graduated).toBe(true);
    expect(sim.state.initiation.profile?.primaryStrength).toBeDefined();
    expect(sim.state.titles).toContain('Initiate');
    expect(sim.state.inventory.initiate_charm).toBe(1);
    expect(sim.state.chronicle.map((c) => c.label)).toEqual(expect.arrayContaining(['Day 1', 'Week 1', 'Initiation']));
    expect(sim.state.achievements.initiate).toBeDefined();
    expect(sim.habits.every((h) => h.weeklyTarget !== undefined)).toBe(true);
    // The guaranteed first meaningful loot on day 6.
    expect(sim.state.initiation.lootGiven).toBe(true);
  });

  it('completes a Main Quest and pays quest rewards', () => {
    const sim = Sim.start();
    let completedTitles: string[] = [];
    for (let i = 0; i < 21; i++) {
      sim.goTo(addDays(START, i));
      const before = sim.state.counters.questsCompleted;
      sim.perfectDay();
      if (sim.state.counters.questsCompleted > before) completedTitles = sim.state.quests.filter((q) => q.status === 'completed').map((q) => q.title);
    }
    expect(sim.state.counters.questsCompleted).toBeGreaterThan(3);
    expect(completedTitles.length).toBeGreaterThan(0);
  });

  it('rotates quest templates so a stable habit gets new stories', () => {
    const sim = Sim.start([{ name: 'Walk home', days: [1, 2, 3, 4, 5] }]);
    const titles = new Set<string>();
    for (let i = 0; i < 35; i++) {
      sim.goTo(addDays(START, i));
      sim.perfectDay();
      for (const q of sim.state.quests) if (q.kind === 'main') titles.add(q.title);
    }
    expect(titles.size).toBeGreaterThanOrEqual(3);
  });
});

describe('consequences and recovery', () => {
  it('drops Momentum after missed days, turns the world struggling, and offers a recovery quest', () => {
    const sim = Sim.start();
    for (let i = 0; i < 8; i++) {
      sim.goTo(addDays(START, i));
      sim.perfectDay();
    }
    const high = sim.state.momentum;
    expect(high).toBeGreaterThanOrEqual(70);
    expect(sim.state.worldState).toBe('thriving');
    sim.goTo(addDays(START, 14));
    expect(sim.state.momentum).toBeLessThan(high);
    expect(sim.state.conditions.fallen).toBe(true);
    expect(sim.state.worldState).toBe('struggling');
    const recovery = sim.state.quests.find((q) => q.kind === 'recovery' && q.status === 'active');
    expect(recovery).toBeDefined();
    for (let i = 14; i < 18; i++) {
      sim.goTo(addDays(START, i));
      sim.perfectDay();
    }
    expect(sim.state.conditions.fallen).toBe(false);
    expect(sim.state.achievements.comeback).toBeDefined();
    // Nothing was taken away.
    expect(sim.state.inventory.traveler_chest).toBe(1);
  });

  it('heals the boss on misses: failure becomes game state', () => {
    const sim = Sim.start();
    for (let i = 0; i < 8; i++) sim.goTo(addDays(START, i));
    const boss = sim.state.boss!;
    expect(boss).toBeDefined();
    sim.act({ type: 'logHabit', habitId: sim.habit('Walk home').id });
    const hpAfterHit = sim.state.boss!.hp;
    expect(hpAfterHit).toBeLessThan(boss.maxHp);
    sim.goTo(addDays(START, 9));
    expect(sim.state.boss!.hp).toBeGreaterThan(hpAfterHit);
    expect(sim.state.boss!.log.join(' ')).toMatch(/regained/);
  });

  it('gives Fatigue after poor sleep and clears it after two good nights', () => {
    const sim = Sim.start();
    for (let i = 0; i < 3; i++) {
      sim.goTo(addDays(START, i));
      sim.act({ type: 'logSleep', hours: 5 });
    }
    sim.goTo(addDays(START, 3));
    expect(sim.state.conditions.fatigue).toBe(true);
    for (let i = 3; i < 5; i++) {
      sim.goTo(addDays(START, i));
      sim.act({ type: 'logSleep', hours: 8 });
    }
    sim.goTo(addDays(START, 5));
    expect(sim.state.conditions.fatigue).toBe(false);
  });

  it('rest mode freezes consequences', () => {
    const sim = Sim.start();
    for (let i = 0; i < 6; i++) {
      sim.goTo(addDays(START, i));
      sim.perfectDay();
    }
    const m = sim.state.momentum;
    sim.act({ type: 'setRestMode', on: true, reason: 'illness' });
    sim.goTo(addDays(START, 12));
    expect(sim.state.momentum).toBe(m);
    expect(Object.values(sim.state.history[addDays(START, 8)] ?? {})).toContain('rest');
    expect(sim.state.conditions.fallen).toBe(false);
  });

  it('welcomes a returning player without retroactive punishment', () => {
    const sim = Sim.start();
    for (let i = 0; i < 5; i++) {
      sim.goTo(addDays(START, i));
      sim.perfectDay();
    }
    const r = sim.goTo(addDays(START, 40));
    expect(r.returned).toBe(true);
    expect(sim.state.quests.some((q) => q.kind === 'returner' && q.status === 'active')).toBe(true);
    expect(sim.state.conditions.fallen).toBe(false);
    expect(sim.state.momentum).toBeGreaterThanOrEqual(50);
    const missed = Object.values(sim.state.history).flatMap((m) => Object.values(m)).filter((m) => m === 'missed');
    expect(missed.length).toBeLessThan(3);
    for (let i = 0; i < 3; i++) sim.act({ type: 'logHabit', habitId: sim.habit('Drink water').id });
    expect(sim.state.inventory.returner_locket).toBe(1);
  });
});

describe('economy and privacy', () => {
  it('buys, crafts and equips with server-side checks', () => {
    const sim = Sim.start();
    expect(() => sim.act({ type: 'buy', itemId: 'forest_scout_head' })).toThrow(/gold/);
    sim.state.gold = 500;
    sim.act({ type: 'buy', itemId: 'forest_scout_head' });
    sim.act({ type: 'equip', itemId: 'forest_scout_head' });
    expect(sim.state.equipment.head).toBe('forest_scout_head');
    expect(() => sim.act({ type: 'equip', itemId: 'dreamwalker_chest' })).toThrow(/own/);
    expect(() => sim.act({ type: 'craft', recipeId: 'craft_iron_guardian_chest' })).toThrow();
  });

  it('keeps habit names and body mode out of the public profile', () => {
    const sim = Sim.start();
    sim.perfectDay();
    const json = JSON.stringify(publicProfile(sim.state));
    expect(json).not.toMatch(/junk|Walk home|water/i);
    expect(json).not.toMatch(/mirror/);
  });
});
