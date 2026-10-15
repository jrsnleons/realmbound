import { STAT_INFO } from '@realmbound/content';
import { CONFIG } from './config';
import { addDays, diffDays, weekday, WEEKDAY_NAMES, type LocalDate } from './dates';
import { rankedStats } from './levels';
import { dayRatio } from './momentum';
import type { CalibrationProfile, Difficulty, Habit, HabitStats, Mark, PlayerState } from './types';

export function emptyHabitStats(): HabitStats {
  return {
    scheduled: 0,
    done: 0,
    byWeekday: Array.from({ length: 7 }, () => [0, 0] as [number, number]),
    hours: [],
    felt: { easy: 0, normal: 0, hard: 0 },
    logs: 0,
    weeklyRatios: [],
  };
}

export function statsFor(state: PlayerState, habitId: string): HabitStats {
  return (state.habitStats[habitId] ??= emptyHabitStats());
}

/** Records the final mark of a scheduled day for a habit. */
export function recordScheduledDay(state: PlayerState, habitId: string, date: LocalDate, mark: Mark): void {
  if (mark === 'rest' || mark === 'away') return;
  const s = statsFor(state, habitId);
  const ok = mark === 'done' || mark === 'resisted';
  s.scheduled += 1;
  if (ok) s.done += 1;
  const wd = s.byWeekday[weekday(date)]!;
  wd[1] += 1;
  if (ok) wd[0] += 1;
}

export function recordLog(state: PlayerState, habitId: string, hour: number, felt?: Difficulty): void {
  const s = statsFor(state, habitId);
  s.logs += 1;
  s.hours.push(hour);
  if (s.hours.length > CONFIG.history.logHoursKept) s.hours.shift();
  if (felt) s.felt[felt] += 1;
}

export function completionRate(s: HabitStats): number | undefined {
  return s.scheduled ? s.done / s.scheduled : undefined;
}

export function confidence(s: HabitStats): number {
  return Math.min(1, s.scheduled / CONFIG.calibration.confidenceFullAt);
}

/** Calibrated difficulty: 1 − completion rate, nudged by how hard it felt. */
export function calibratedDifficulty(s: HabitStats, fallback: Difficulty = 'normal'): Difficulty {
  const rate = completionRate(s);
  if (rate === undefined || s.scheduled < 3) return fallback;
  let d = 1 - rate;
  const felt = mostCommonFelt(s);
  if (felt === 'easy') d -= 0.1;
  if (felt === 'hard') d += 0.1;
  if (d < 0.25) return 'easy';
  if (d < 0.55) return 'normal';
  return 'hard';
}

export function mostCommonFelt(s: HabitStats): Difficulty | undefined {
  const entries = Object.entries(s.felt) as [Difficulty, number][];
  const [best, n] = entries.sort((a, b) => b[1] - a[1])[0]!;
  return n > 0 ? best : undefined;
}

export function scheduledPerWeek(habit: Pick<Habit, 'days'>): number {
  return habit.days.length || 3;
}

/**
 * Weekly Main Quest target: aim slightly above what the player already does.
 * Easing off is fast (one bad week), pushing harder is slow (two full weeks), one step at a time.
 */
export function weeklyTarget(habit: Habit, s: HabitStats): number {
  const C = CONFIG.calibration;
  const sched = scheduledPerWeek(habit);
  const rate = completionRate(s);
  const conf = confidence(s);
  const assumed = rate === undefined ? 0.6 : rate * conf + 0.6 * (1 - conf);
  let target = Math.max(1, Math.min(sched, Math.round(sched * assumed * C.targetStretch)));
  const prev = habit.weeklyTarget;
  if (prev !== undefined) {
    const last = s.weeklyRatios.at(-1);
    const lastTwo = s.weeklyRatios.slice(-C.raiseAfterWeeksAtFull);
    if (last !== undefined && last < C.lowerAfterRate) target = Math.max(1, prev - 1);
    else if (lastTwo.length === C.raiseAfterWeeksAtFull && lastTwo.every((r) => r >= 1)) target = Math.min(sched, prev + 1);
    else target = Math.max(prev - 1, Math.min(prev + 1, target));
  }
  return target;
}

export function isMastered(state: PlayerState, habit: Habit, today: LocalDate): boolean {
  const M = CONFIG.calibration.mastery;
  if (diffDays(habit.createdOn, today) < M.days) return false;
  let sched = 0;
  let ok = 0;
  for (let i = 1; i <= M.days; i++) {
    const m = state.history[addDays(today, -i)]?.[habit.id];
    if (m === 'done' || m === 'resisted') ok++;
    if (m === 'done' || m === 'resisted' || m === 'missed' || m === 'slipped') sched++;
  }
  return sched >= 8 && ok / sched >= M.rate && statsFor(state, habit.id).logs >= M.minLogs;
}

/** Weekday with the lowest completion rate across habits, if it is clearly harder. */
export function recoveryDay(state: PlayerState, habits: Habit[]): number | undefined {
  const agg = Array.from({ length: 7 }, () => [0, 0]);
  for (const h of habits) {
    const s = state.habitStats[h.id];
    if (!s) continue;
    s.byWeekday.forEach(([d, n], i) => {
      agg[i]![0]! += d;
      agg[i]![1]! += n;
    });
  }
  let worst: number | undefined;
  let worstRate = 1;
  agg.forEach(([d, n], i) => {
    if (n! >= 2 && d! / n! < worstRate) {
      worstRate = d! / n!;
      worst = i;
    }
  });
  return worst !== undefined && worstRate < CONFIG.calibration.recoveryDayBelow ? worst : undefined;
}

/** The 2-hour window holding the most logs. */
export function activityWindow(state: PlayerState, habits: Habit[]): [number, number] | undefined {
  const counts = new Array(24).fill(0) as number[];
  let total = 0;
  for (const h of habits) for (const hr of state.habitStats[h.id]?.hours ?? []) {
    counts[hr] = (counts[hr] ?? 0) + 1;
    total++;
  }
  if (total < 3) return undefined;
  let best = 0;
  let bestN = -1;
  for (let h = 0; h < 24; h++) {
    const n = counts[h]! + counts[(h + 1) % 24]!;
    if (n > bestN) {
      bestN = n;
      best = h;
    }
  }
  return [best, (best + 2) % 24];
}

export function formatHour(h: number): string {
  const suffix = h < 12 ? 'AM' : 'PM';
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr} ${suffix}`;
}

/** Plain-language pattern observations shown during days 4–7 of the Initiation (and later). */
export function patternObservations(state: PlayerState, habits: Habit[]): string[] {
  const out: string[] = [];
  for (const h of habits.filter((x) => !x.archived)) {
    const s = state.habitStats[h.id];
    if (!s || s.logs < 2) continue;
    const label = h.privacy === 'private' ? 'one of your habits' : h.name;
    const late = s.hours.filter((x) => x >= 18).length;
    const early = s.hours.filter((x) => x < 12).length;
    if (late / s.hours.length >= 0.7) out.push(`You usually complete "${label}" after 6 PM.`);
    else if (early / s.hours.length >= 0.7) out.push(`You usually complete "${label}" before noon.`);
    const rate = completionRate(s);
    if (rate !== undefined && s.scheduled >= 4 && rate < 0.4) out.push(`"${label}" appears challenging right now. That is useful to know.`);
  }
  const rd = recoveryDay(state, habits);
  if (rd !== undefined) out.push(`${WEEKDAY_NAMES[rd]}s appear more difficult.`);
  const sleepMisses = Object.entries(state.sleep).filter(([, v]) => !v.met);
  if (sleepMisses.length >= 2) {
    const weekend = sleepMisses.filter(([d]) => [0, 5, 6].includes(weekday(d))).length;
    if (weekend / sleepMisses.length >= 0.6) out.push('Your sleep goal is missed mostly on weekends.');
  }
  return out;
}

export function isOvercommitted(state: PlayerState, habits: Habit[]): boolean {
  const C = CONFIG.calibration.overcommit;
  if (habits.filter((h) => h.isMain && !h.archived).length > C.maxMainHabits) return true;
  let sum = 0;
  let n = 0;
  for (let i = 1; i <= C.weeks * 7; i++) {
    const r = dayRatio(state, addDays(state.today, -i));
    if (r !== undefined) {
      sum += r;
      n++;
    }
  }
  return n >= 10 && sum / n < C.rate;
}

export function initiationDay(state: PlayerState, today: LocalDate = state.today): number {
  return diffDays(state.createdOn, today) + 1;
}

export function initiationStage(state: PlayerState): 'discovery' | 'patterns' | 'adaptive' | 'graduated' {
  if (state.initiation.graduated) return 'graduated';
  const day = initiationDay(state);
  if (day <= CONFIG.calibration.discoveryUntil) return 'discovery';
  if (day <= CONFIG.calibration.patternsUntil) return 'patterns';
  return 'adaptive';
}

export function buildProfile(state: PlayerState, habits: Habit[], date: LocalDate): CalibrationProfile {
  const ranked = rankedStats(state);
  const used = ranked.filter((s) => state.skills[s].total > 0);
  return {
    graduatedOn: date,
    primaryStrength: used[0] ?? ranked[0]!,
    developing: used.length > 1 ? used[used.length - 1]! : ranked[1]!,
    recoveryDay: recoveryDay(state, habits),
    activityWindow: activityWindow(state, habits),
  };
}

export function describeProfile(p: CalibrationProfile): string[] {
  const lines = [`Primary Strength: ${STAT_INFO[p.primaryStrength].name}`, `Developing: ${STAT_INFO[p.developing].name}`];
  if (p.recoveryDay !== undefined) lines.push(`Recovery Day: ${WEEKDAY_NAMES[p.recoveryDay]}`);
  if (p.activityWindow) lines.push(`Typical Activity Window: ${formatHour(p.activityWindow[0])}–${formatHour(p.activityWindow[1])}`);
  return lines;
}

/** Re-calibrates every habit; called at each weekly reset and at graduation. */
export function recalibrateHabits(state: PlayerState, habits: Habit[], today: LocalDate): Habit[] {
  return habits.map((h) => {
    if (h.archived) return h;
    const s = statsFor(state, h.id);
    const next: Habit = {
      ...h,
      difficulty: calibratedDifficulty(s, h.difficulty),
      calibrationConfidence: confidence(s),
      mastered: h.mastered || isMastered(state, h, today),
    };
    next.weeklyTarget = weeklyTarget(next, s);
    return next;
  });
}
