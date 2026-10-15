import { CATEGORY_INFO, STAT_INFO, type Category } from '@realmbound/content';
import { isScheduled, weekday, type Habit, type Mark, type PlayerState } from '@realmbound/game-engine';

export const WEEKDAY_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function prettyDate(local: string, opts: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' }): string {
  const [y, m, d] = local.split('-').map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!)).toLocaleDateString(undefined, { ...opts, timeZone: 'UTC' });
}

export function categoryColor(c: Category | 'avoid'): string {
  if (c === 'avoid') return STAT_INFO.discipline.color;
  return STAT_INFO[CATEGORY_INFO[c].stat].color;
}

export function categoryEmoji(c: Category | 'avoid'): string {
  return c === 'avoid' ? '🛡️' : CATEGORY_INFO[c].emoji;
}

export interface HabitToday {
  habit: Habit;
  scheduled: boolean;
  mark?: Mark;
  done: boolean;
  times: number;
}

export function habitsToday(state: PlayerState, habits: Habit[]): HabitToday[] {
  const marks = state.history[state.today] ?? {};
  return habits
    .filter((h) => !h.archived)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((habit) => {
      const mark = marks[habit.id];
      return {
        habit,
        scheduled: isScheduled(habit, state.today, weekday),
        mark,
        done: mark === 'done' || mark === 'resisted',
        times: state.daily.date === state.today ? (state.daily.pools[`h:${habit.id}`]?.count ?? 0) : 0,
      };
    });
}

export function daysLabel(days: number[]): string {
  if (days.length === 0 || days.length === 7) return 'Every day';
  const s = [...days].sort().join(',');
  if (s === '1,2,3,4,5') return 'Weekdays';
  if (s === '0,6') return 'Weekends';
  return [...days].sort().map((d) => WEEKDAY_NAMES[d]!.slice(0, 3)).join(', ');
}

export function plural(n: number, word: string, many = `${word}s`) {
  return `${n} ${n === 1 ? word : many}`;
}
