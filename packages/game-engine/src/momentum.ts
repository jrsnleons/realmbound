import { CONFIG } from './config';
import { addDays, type LocalDate } from './dates';
import type { Habit, Mark, PlayerState, WorldState } from './types';

export function isScheduled(habit: Pick<Habit, 'days' | 'createdOn' | 'archived'>, date: LocalDate, weekdayOf: (d: LocalDate) => number): boolean {
  if (habit.archived || date < habit.createdOn) return false;
  return habit.days.includes(weekdayOf(date));
}

const VALUE: Partial<Record<Mark, number>> = { done: 1, resisted: 1, missed: 0, slipped: 0 };

/** Ratio of completed scheduled habits on one day, or undefined when nothing counted. */
export function dayRatio(state: PlayerState, date: LocalDate): number | undefined {
  const marks = state.history[date];
  if (!marks) return undefined;
  let sum = 0;
  let n = 0;
  for (const m of Object.values(marks)) {
    const v = VALUE[m];
    if (v === undefined) continue;
    sum += v;
    n += 1;
  }
  return n ? sum / n : undefined;
}

/**
 * Momentum 0–100: weighted completion over the last 7 days ending at `upTo`,
 * where `upTo` counts most and each older day counts `decay` times the day after it.
 */
export function computeMomentum(state: PlayerState, upTo: LocalDate): number {
  const M = CONFIG.momentum;
  let wsum = 0;
  let vsum = 0;
  for (let age = 0; age < M.windowDays; age++) {
    const r = dayRatio(state, addDays(upTo, -age));
    if (r === undefined) continue;
    const w = Math.pow(M.decay, age);
    wsum += w;
    vsum += w * r;
  }
  if (wsum === 0) return state.momentum;
  return Math.round((vsum / wsum) * 100);
}

export function worldStateFor(momentum: number, fallen: boolean): WorldState {
  if (fallen || momentum < CONFIG.world.strugglingBelow) return 'struggling';
  if (momentum >= CONFIG.world.thrivingAt) return 'thriving';
  return 'neutral';
}

export function momentumTier(momentum: number): 'high' | 'normal' | 'low' {
  if (momentum >= CONFIG.momentum.high) return 'high';
  if (momentum < CONFIG.momentum.low) return 'low';
  return 'normal';
}

/** Re-evaluates Fatigue, Tempted and Fallen at the end of `date`. Rest mode freezes all of them. */
export function updateConditions(state: PlayerState, date: LocalDate): void {
  const C = CONFIG.conditions;
  const set = (c: 'fatigue' | 'tempted' | 'fallen', on: boolean) => {
    if (state.conditions[c] !== on) {
      state.conditions[c] = on;
      state.feed.push({ kind: 'condition', condition: c, on, date });
    }
  };
  if (state.restMode.on) return;

  // Fatigue: sleep goal missed on 3 of the last 4 logged nights; cleared by 2 met nights in a row.
  const nights = [0, 1, 2, 3].map((i) => state.sleep[addDays(date, -i)]).filter(Boolean) as { met: boolean }[];
  const missed = nights.filter((n) => !n.met).length;
  const lastTwoMet = state.sleep[date]?.met && state.sleep[addDays(date, -1)]?.met;
  if (!state.conditions.fatigue && missed >= C.fatigueMissesOf4) set('fatigue', true);
  else if (state.conditions.fatigue && lastTwoMet) set('fatigue', false);

  // Tempted: 3 slips in 7 days; cleared by 3 resists after the latest slip.
  let slips = 0;
  let resistsSinceSlip = 0;
  let seenSlip = false;
  for (let age = 0; age < 7; age++) {
    const marks = Object.values(state.history[addDays(date, -age)] ?? {});
    for (const m of marks) {
      if (m === 'slipped') {
        slips++;
        seenSlip = true;
      }
      if (m === 'resisted' && !seenSlip) resistsSinceSlip++;
    }
  }
  if (!state.conditions.tempted && slips >= C.temptedSlips7d) set('tempted', true);
  else if (state.conditions.tempted && (resistsSinceSlip >= C.temptedClearResists || slips === 0)) set('tempted', false);

  // Fallen: Momentum under 30 for 3 days. Cleared only by the recovery quest.
  if (state.momentum < C.fallenMomentum) state.lowMomentumDays += 1;
  else state.lowMomentumDays = 0;
  if (!state.conditions.fallen && state.lowMomentumDays >= C.fallenDays) set('fallen', true);
}
