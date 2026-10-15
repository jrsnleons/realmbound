import { CATEGORY_INFO, ITEM_BY_ID, type Slot } from '@realmbound/content';
import { checkAchievements, countDistinctDay } from './achievements';
import { damageBoss } from './boss';
import { initiationDay, recordLog } from './calibration';
import { CONFIG } from './config';
import { addItem, buy, craft, equip, GameError, unequip, useConsumable } from './economy';
import { rollLoot } from './loot';
import { applyReward, computeHabitReward, emptyReward, mergeRewards } from './rewards';
import { progressQuests } from './quests';
import { rngFor } from './rng';
import type { Difficulty, GameEvent, Habit, PlayerState, Quest, Reward } from './types';

export type Action =
  | { type: 'logHabit'; habitId: string; felt?: Difficulty; durationMin?: number; socialVerified?: boolean }
  | { type: 'avoidCheckin'; habitId: string; resisted: boolean }
  | { type: 'logSleep'; hours: number }
  | { type: 'setRestMode'; on: boolean; reason?: 'illness' | 'injury' | 'rest' | 'other' }
  | { type: 'equip'; itemId: string }
  | { type: 'unequip'; slot: Slot }
  | { type: 'buy'; itemId: string }
  | { type: 'craft'; recipeId: string }
  | { type: 'useItem'; itemId: string }
  | { type: 'setTitle'; title: string }
  | { type: 'setSleepGoal'; hours: number }
  | { type: 'liveQuestComplete'; minutes: number; partySize: number };

export interface ActionContext {
  /** The player's local hour (0–23) when the action happened. */
  hour: number;
}

export interface ActionResult {
  state: PlayerState;
  event: GameEvent;
  reward: Reward;
  completedQuests: Quest[];
  bossDamage: number;
}

const MAX_LOGS_PER_HABIT_PER_DAY = 5;

function findHabit(habits: Habit[], id: string): Habit {
  const h = habits.find((x) => x.id === id && !x.archived);
  if (!h) throw new GameError('unknown_habit', 'That habit does not exist.');
  return h;
}

/**
 * Applies one player action to a state that has already been advanced to today.
 * Pure: returns a new state; the input is never mutated.
 */
export function applyAction(input: PlayerState, habits: Habit[], action: Action, ctx: ActionContext): ActionResult {
  const state: PlayerState = structuredClone(input);
  const today = state.today;
  const rand = rngFor(state.seed, ++state.counter);
  let reward = emptyReward(state);
  let completed: Quest[] = [];
  let bossDamage = 0;
  const payload: Record<string, unknown> = { ...action };

  switch (action.type) {
    case 'logHabit': {
      const habit = findHabit(habits, action.habitId);
      if (habit.kind === 'avoid') throw new GameError('use_checkin', 'Avoid habits are answered with a check-in.');
      const marks = (state.history[today] ??= {});
      const timesToday = state.daily.pools[`h:${habit.id}`]?.count ?? 0;
      if (timesToday >= MAX_LOGS_PER_HABIT_PER_DAY) throw new GameError('too_many_logs', 'That is plenty for today.');
      reward = computeHabitReward(state, habit, { socialVerified: action.socialVerified });
      applyReward(state, reward, habit.poolKey);
      (state.daily.pools[`h:${habit.id}`] ??= { count: 0, xp: 0 }).count += 1;
      const first = marks[habit.id] !== 'done';
      marks[habit.id] = 'done';
      recordLog(state, habit.id, ctx.hour, action.felt);
      state.counters.logs += 1;
      state.lastLogOn = today;
      countDistinctDay(state, habit.category, today);
      countDistinctDay(state, 'any', today);
      if (first) completed = progressQuests(state, { type: 'log', date: today, habit });
      bossDamage = damageBoss(state, habit, reward.characterXp, rand);
      reward = withLoot(state, reward, rand);
      break;
    }
    case 'avoidCheckin': {
      const habit = findHabit(habits, action.habitId);
      if (habit.kind !== 'avoid') throw new GameError('not_avoid', 'Only Avoid habits use check-ins.');
      const marks = (state.history[today] ??= {});
      if (marks[habit.id] === 'resisted' || marks[habit.id] === 'slipped') throw new GameError('already_answered', 'You already answered today.');
      marks[habit.id] = action.resisted ? 'resisted' : 'slipped';
      recordLog(state, habit.id, ctx.hour);
      state.lastLogOn = today;
      if (action.resisted) {
        reward = computeHabitReward(state, habit);
        applyReward(state, reward, habit.poolKey);
        state.counters.logs += 1;
        if (state.counters.lastResistDay !== today) {
          state.counters.lastResistDay = today;
          state.counters.resistDays += 1;
        }
        countDistinctDay(state, 'any', today);
        completed = progressQuests(state, { type: 'resist', date: today, habit });
        bossDamage = damageBoss(state, habit, reward.characterXp, rand);
        reward = withLoot(state, reward, rand);
      } else {
        reward.notes.push('Honest check-ins keep the calibration accurate. No penalty today.');
      }
      break;
    }
    case 'logSleep': {
      if (!(action.hours >= 0 && action.hours <= 16)) throw new GameError('bad_hours', 'Sleep hours must be between 0 and 16.');
      if (state.sleep[today]) throw new GameError('already_logged', 'Sleep is already logged for today.');
      const met = action.hours >= state.sleepGoalHours;
      state.sleep[today] = { hours: action.hours, met };
      state.lastLogOn = today;
      const xp = met ? CONFIG.rewards.sleepLogXp : 4;
      reward = { ...emptyReward(state), skillXp: { recovery: xp }, characterXp: xp, gold: met ? 3 : 1, materials: met ? { essence: 1 } : {}, share: 1 };
      applyReward(state, reward, 'sleep');
      if (met) {
        state.counters.sleepGoalDays += 1;
        countDistinctDay(state, 'sleep', today);
        const marks = (state.history[today] ??= {});
        for (const h of habits.filter((x) => x.category === 'sleep' && x.kind === 'do' && !x.archived)) {
          if (marks[h.id] !== 'done') marks[h.id] = 'done';
        }
        bossDamage = damageBoss(state, undefined, xp, rand);
      }
      countDistinctDay(state, 'any', today);
      completed = progressQuests(state, { type: 'sleep', date: today, sleepMet: met });
      if (!met) reward.notes.push('Logged. Rest matters, and so does honesty.');
      break;
    }
    case 'setRestMode': {
      state.restMode = action.on ? { on: true, since: today, reason: action.reason ?? 'rest' } : { on: false };
      break;
    }
    case 'equip':
      equip(state, action.itemId);
      break;
    case 'unequip':
      unequip(state, action.slot);
      break;
    case 'buy':
      buy(state, action.itemId);
      break;
    case 'craft':
      payload.itemId = craft(state, action.recipeId);
      break;
    case 'useItem':
      useConsumable(state, action.itemId);
      break;
    case 'setTitle':
      if (!state.titles.includes(action.title)) throw new GameError('unknown_title', 'You have not earned that title.');
      state.activeTitle = action.title;
      break;
    case 'setSleepGoal':
      if (!(action.hours >= 4 && action.hours <= 12)) throw new GameError('bad_hours', 'Pick a goal between 4 and 12 hours.');
      state.sleepGoalHours = action.hours;
      break;
    case 'liveQuestComplete': {
      const minutes = Math.max(0, Math.min(90, action.minutes));
      const xp = Math.round(minutes * 0.8 * (1 + Math.min(4, action.partySize - 1) * 0.05) * (1 + CONFIG.rewards.socialVerifiedBonus));
      reward = { ...emptyReward(state), skillXp: { knowledge: xp }, characterXp: xp, gold: 10 + action.partySize * 2, materials: { arcane_dust: 2 }, share: 1 };
      reward.notes.push('Done together: social bonus');
      applyReward(state, reward);
      state.counters.liveQuests += 1;
      state.lastLogOn = today;
      countDistinctDay(state, 'any', today);
      completed = progressQuests(state, { type: 'log', date: today });
      bossDamage = damageBoss(state, undefined, xp, rand);
      break;
    }
  }

  // The guaranteed "first meaningful loot" of the Initiation (day 6).
  if (!state.initiation.lootGiven && initiationDay(state) >= CONFIG.loot.guaranteedInitiationDay && reward.characterXp > 0) {
    state.initiation.lootGiven = true;
    const item = rollLoot(state, rand, { guaranteed: true, minTier: 'uncommon' });
    if (item) {
      addItem(state, item);
      reward = mergeRewards(reward, { ...emptyReward(state), items: [item] });
      state.feed.push({ kind: 'loot', itemId: item, date: today });
    }
  }

  checkAchievements(state, today);
  return {
    state,
    event: { type: action.type, date: today, payload, reward },
    reward,
    completedQuests: completed,
    bossDamage,
  };
}

function withLoot(state: PlayerState, reward: Reward, rand: () => number): Reward {
  const item = rollLoot(state, rand);
  if (!item) return reward;
  addItem(state, item);
  state.feed.push({ kind: 'loot', itemId: item, date: state.today });
  return { ...reward, items: [...reward.items, item] };
}

export function describeItem(itemId: string): string {
  return ITEM_BY_ID[itemId]?.name ?? itemId;
}

export function categoryStat(habit: Habit) {
  return habit.kind === 'avoid' ? 'discipline' : CATEGORY_INFO[habit.category].stat;
}
