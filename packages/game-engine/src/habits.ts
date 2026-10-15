import { CATEGORIES, type Category } from '@realmbound/content';
import { classifyHabit, findDuplicate, type Classification } from './classify';
import type { LocalDate } from './dates';
import { GameError } from './economy';
import type { Cadence, Habit, HabitKind, Privacy } from './types';

export interface HabitInput {
  name: string;
  kind?: HabitKind;
  category?: Category;
  cadence?: Cadence;
  days?: number[];
  /** 1 to 7. Makes the habit flexible: any day counts, none is missed. */
  perWeek?: number | null;
  isMain?: boolean;
  privacy?: Privacy;
  goalMinutes?: number;
}

export const MAX_HABITS = 20;
export const MAX_MAIN_HABITS = 5;

export function validateHabitInput(input: HabitInput): void {
  const name = input.name?.trim() ?? '';
  if (name.length < 2 || name.length > 60) throw new GameError('bad_name', 'Habit names need 2 to 60 characters.');
  if (input.category && !CATEGORIES.includes(input.category)) throw new GameError('bad_category', 'Unknown category.');
  if (input.days && (!Array.isArray(input.days) || input.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)))
    throw new GameError('bad_days', 'Days must be 0 (Sunday) to 6 (Saturday).');
  if (input.perWeek != null && (!Number.isInteger(input.perWeek) || input.perWeek < 1 || input.perWeek > 7))
    throw new GameError('bad_schedule', 'A weekly goal is 1 to 7 times.');
}

/**
 * Builds a new habit from player input. Anything the player didn't choose is filled in by
 * the classifier (rules by default, or a server-side embedding/LLM classification when given).
 */
export function createHabit(
  id: string,
  input: HabitInput,
  existing: Habit[],
  today: LocalDate,
  classification: Classification = classifyHabit(input.name),
): { habit: Habit; duplicateOf?: string; classification: Classification } {
  validateHabitInput(input);
  const active = existing.filter((h) => !h.archived);
  if (active.length >= MAX_HABITS) throw new GameError('too_many_habits', `You can track up to ${MAX_HABITS} habits.`);
  const kind = input.kind ?? classification.kind;
  const category = input.category ?? classification.category;
  const cadence = input.cadence ?? (kind === 'avoid' ? 'maintenance' : classification.cadence);
  const mains = active.filter((h) => h.isMain).length;
  const isMain = input.isMain ?? mains < 3;
  if (isMain && mains >= MAX_MAIN_HABITS) throw new GameError('too_many_main', `Keep Main Habits to ${MAX_MAIN_HABITS} or fewer.`);
  const dup = findDuplicate({ name: input.name, category, kind }, active);
  const habit: Habit = {
    id,
    name: input.name.trim(),
    kind,
    category,
    cadence,
    days: input.perWeek ? [] : [...new Set(input.days ?? [0, 1, 2, 3, 4, 5, 6])].sort(),
    ...(input.perWeek ? { perWeek: input.perWeek } : {}),
    isMain,
    poolKey: dup?.poolKey ?? `${category}:${id}`,
    createdOn: today,
    archived: false,
    privacy: input.privacy ?? 'category',
    difficulty: 'normal',
    calibrationConfidence: 0,
    mastered: false,
    goalMinutes: input.goalMinutes,
  };
  return { habit, duplicateOf: dup?.habitId, classification };
}

export function updateHabit(habit: Habit, patch: Partial<HabitInput> & { archived?: boolean }, all: Habit[]): Habit {
  if (patch.name !== undefined) validateHabitInput({ ...patch, name: patch.name });
  else validateHabitInput({ ...patch, name: habit.name });
  const next: Habit = { ...habit };
  if (patch.name !== undefined) next.name = patch.name.trim();
  if (patch.days) next.days = [...new Set(patch.days)].sort();
  if (patch.perWeek) {
    next.perWeek = patch.perWeek;
    next.days = [];
  } else if (patch.perWeek === null) {
    delete next.perWeek;
    if (!patch.days) next.days = habit.days.length ? habit.days : [0, 1, 2, 3, 4, 5, 6];
  }
  if (patch.privacy) next.privacy = patch.privacy;
  if (patch.category) next.category = patch.category;
  if (patch.cadence) next.cadence = patch.cadence;
  if (patch.goalMinutes !== undefined) next.goalMinutes = patch.goalMinutes;
  if (patch.archived !== undefined) next.archived = patch.archived;
  if (patch.isMain !== undefined && patch.isMain !== habit.isMain) {
    const mains = all.filter((h) => h.isMain && !h.archived && h.id !== habit.id).length;
    if (patch.isMain && mains >= MAX_MAIN_HABITS) throw new GameError('too_many_main', `Keep Main Habits to ${MAX_MAIN_HABITS} or fewer.`);
    next.isMain = patch.isMain;
  }
  return next;
}
