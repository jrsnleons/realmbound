import { CONFIG } from './config';
import { checkAchievements } from './achievements';
import { healBoss, startWeeklyBoss } from './boss';
import {
  buildProfile,
  describeProfile,
  initiationDay,
  patternObservations,
  recalibrateHabits,
  recordScheduledDay,
} from './calibration';
import { addDays, diffDays, weekday, weekStart, type LocalDate } from './dates';
import { addItem } from './economy';
import { rankedStats } from './levels';
import { rollLoot } from './loot';
import { computeMomentum, isScheduled, updateConditions, worldStateFor } from './momentum';
import { generateWeeklyQuests, initiationQuest, recoveryQuest, returnerQuest } from './quests';
import { rngFor } from './rng';
import { snapshot } from './state';
import type { Habit, Mark, PlayerState } from './types';

const CHRONICLE_DAYS: Record<number, string> = { 7: 'Week 1', 30: 'Month 1', 90: 'Month 3', 180: 'Month 6', 365: 'Year 1' };

export interface RolloverResult {
  state: PlayerState;
  habits: Habit[];
  daysClosed: number;
  returned: boolean;
}

/**
 * Brings the player's state up to `today`, closing every finished day in order.
 * Runs lazily on the first request of a new local day, so inactive players cost nothing.
 */
export function advanceTo(input: PlayerState, inputHabits: Habit[], today: LocalDate): RolloverResult {
  const state: PlayerState = structuredClone(input);
  let habits = inputHabits.map((h) => ({ ...h }));
  if (today <= state.today) return { state, habits, daysClosed: 0, returned: false };

  const lastActive = state.lastLogOn ?? state.createdOn;
  const awayDays = diffDays(lastActive, today);
  const returning = awayDays > CONFIG.quests.returnerAfterDays;
  const gap = diffDays(state.today, today);

  let closed = 0;
  // Long absences are not replayed day by day: no retroactive punishment.
  const replayFrom = gap > 21 ? addDays(today, -1) : state.today;
  if (replayFrom !== state.today) state.today = replayFrom;

  while (state.today < today) {
    const day = state.today;
    const inAbsence = returning && day > lastActive;
    closeDay(state, habits, day, inAbsence);
    closed++;
    const next = addDays(day, 1);
    state.today = next;
    state.daily = { date: next, pools: {} };
    habits = onNewDay(state, habits, next);
  }

  if (returning) {
    state.momentum = Math.max(state.momentum, CONFIG.momentum.initial);
    state.conditions.fatigue = false;
    state.conditions.tempted = false;
    state.conditions.fallen = false;
    state.lowMomentumDays = 0;
    state.worldState = worldStateFor(state.momentum, false);
    state.counters.returns += 1;
    if (!state.quests.some((q) => q.kind === 'returner' && q.status === 'active')) state.quests.push(returnerQuest(state, today));
  }
  trimHistory(state);
  checkAchievements(state, today);
  return { state, habits, daysClosed: closed, returned: returning };
}

function closeDay(state: PlayerState, habits: Habit[], day: LocalDate, inAbsence: boolean): void {
  const marks = (state.history[day] ??= {});
  let misses = 0;
  for (const h of habits) {
    if (!isScheduled(h, day, weekday)) continue;
    if (marks[h.id]) {
      recordScheduledDay(state, h.id, day, marks[h.id]!);
      continue;
    }
    let mark: Mark | undefined;
    if (state.restMode.on) mark = 'rest';
    else if (inAbsence) mark = 'away';
    else if (h.kind === 'do') mark = 'missed';
    // Unanswered Avoid habits stay neutral: no success, no failure.
    if (mark) {
      marks[h.id] = mark;
      recordScheduledDay(state, h.id, day, mark);
      if (mark === 'missed') misses++;
    }
  }
  if (!state.restMode.on && !inAbsence) {
    healBoss(state, misses);
    state.momentum = computeMomentum(state, day);
    state.highMomentumStreak = state.momentum >= CONFIG.momentum.high ? state.highMomentumStreak + 1 : 0;
    updateConditions(state, day);
    if (state.conditions.fallen && !state.quests.some((q) => q.kind === 'recovery' && q.status === 'active')) {
      state.quests.push(recoveryQuest(state, habits, addDays(day, 1)));
    }
  }
  const world = worldStateFor(state.momentum, state.conditions.fallen);
  if (world !== state.worldState) {
    state.worldState = world;
    state.feed.push({ kind: 'world', state: world, date: addDays(day, 1) });
  }
  for (const q of state.quests) {
    if (q.status === 'active' && q.endsOn <= day && (q.kind === 'initiation' || q.kind === 'recovery' || q.kind === 'returner')) {
      q.status = 'expired';
    }
  }
}

function onNewDay(state: PlayerState, habits: Habit[], today: LocalDate): Habit[] {
  const day = initiationDay(state, today);
  let out = habits;

  if (!state.initiation.graduated) {
    const q = initiationQuest(state, day, today);
    if (q) state.quests.push(q);
    if (day >= 4 && day <= 7) {
      for (const text of patternObservations(state, habits)) {
        if (!state.initiation.observations.includes(text)) {
          state.initiation.observations.push(text);
          state.feed.push({ kind: 'observation', text, date: today });
          break;
        }
      }
    }
    if (day === 5 && !state.quests.some((q2) => q2.kind === 'main' && q2.status === 'active')) {
      out = recalibrateHabits(state, out, today);
      generateWeeklyQuests(state, out, weekStart(today));
      state.weekStart = weekStart(today);
    }
    if (day === 7 && !state.boss) startWeeklyBoss(state, out, weekStart(today));
    if (day > CONFIG.calibration.initiationDays) out = graduate(state, out, today);
  }

  if (weekday(today) === 1 && state.weekStart !== today) {
    state.weekStart = today;
    out = recalibrateHabits(state, out, today);
    if (day >= 5 || state.initiation.graduated) generateWeeklyQuests(state, out, today);
    if (day >= 7 || state.initiation.graduated) startWeeklyBoss(state, out, today);
  }

  const label = CHRONICLE_DAYS[day];
  if (label && !state.chronicle.some((c) => c.label === label)) {
    const top = rankedStats(state)[0]!;
    state.chronicle.push(snapshot(state, today, label, `Level ${state.level}. Strongest in ${top}.`));
    state.feed.push({ kind: 'chronicle', label, date: today });
  }
  return out;
}

function graduate(state: PlayerState, habits: Habit[], today: LocalDate): Habit[] {
  const out = recalibrateHabits(state, habits, today);
  const profile = buildProfile(state, out, today);
  state.initiation.graduated = true;
  state.initiation.profile = profile;
  if (!state.titles.includes('Initiate')) state.titles.push('Initiate');
  state.activeTitle = 'Initiate';
  if (!state.inventory.initiate_charm) addItem(state, 'initiate_charm');
  const rand = rngFor(state.seed, ++state.counter);
  const major = rollLoot(state, rand, { guaranteed: true, minTier: 'uncommon' });
  if (major) {
    addItem(state, major);
    state.feed.push({ kind: 'loot', itemId: major, date: today });
  }
  state.feed.push({ kind: 'graduation', date: today });
  state.chronicle.push(snapshot(state, today, 'Initiation', `Initiation complete. ${describeProfile(profile).join(' · ')}`));
  return out;
}

function trimHistory(state: PlayerState): void {
  const cutoff = addDays(state.today, -CONFIG.history.keepDays);
  for (const d of Object.keys(state.history)) if (d < cutoff) delete state.history[d];
  for (const d of Object.keys(state.sleep)) if (d < cutoff) delete state.sleep[d];
}
