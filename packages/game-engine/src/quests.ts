import {
  CATEGORY_INFO,
  INITIATION_STEPS,
  MAIN_QUEST_TEMPLATES,
  RECOVERY_QUEST,
  RETURNER_QUEST,
  type Category,
  type QuestTemplate,
} from '@realmbound/content';
import { scheduledPerWeek, statsFor, weeklyTarget } from './calibration';
import { CONFIG } from './config';
import { addDays, type LocalDate } from './dates';
import { addItem, addMaterials } from './economy';
import { grantCharacterXp, grantSkillXp } from './levels';
import { hashString, rngFor } from './rng';
import type { Habit, PlayerState, Quest, QuestObjective, QuestRewards } from './types';

export function habitLabel(h: Pick<Habit, 'name' | 'privacy' | 'category'>): string {
  return h.privacy === 'private' ? `Complete your ${CATEGORY_INFO[h.category].name.toLowerCase()} habit` : h.name;
}

function fill(text: string, habit: Pick<Habit, 'name' | 'privacy' | 'category'> | undefined, n: number): string {
  return text.replaceAll('{habit}', habit ? habitLabel(habit) : 'Complete it').replaceAll('{n}', String(n));
}

/** Picks a template for a category, skipping the last few used so stable habits don't feel repetitive. */
export function pickTemplate(state: PlayerState, key: Category | 'avoid', salt: string): QuestTemplate {
  const pool = MAIN_QUEST_TEMPLATES[key].length ? MAIN_QUEST_TEMPLATES[key] : MAIN_QUEST_TEMPLATES.other;
  const recent = state.questMemory[key] ?? [];
  const fresh = pool.filter((t) => !recent.includes(t.id));
  const choices = fresh.length ? fresh : pool;
  const rand = rngFor(state.seed ^ hashString(salt), state.counter);
  const t = choices[Math.floor(rand() * choices.length)]!;
  state.questMemory[key] = [...recent, t.id].slice(-CONFIG.quests.templateMemory);
  return t;
}

function questId(state: PlayerState, prefix: string, date: LocalDate): string {
  state.counter += 1;
  return `${prefix}-${date}-${state.counter.toString(36)}`;
}

export function mainQuestFor(state: PlayerState, habit: Habit, startsOn: LocalDate, endsOn: LocalDate): Quest {
  const key: Category | 'avoid' = habit.kind === 'avoid' ? 'avoid' : habit.category;
  const template = pickTemplate(state, key, `${habit.id}:${startsOn}`);
  const target = habit.weeklyTarget ?? weeklyTarget(habit, statsFor(state, habit.id));
  const sched = scheduledPerWeek(habit);
  let objective: QuestObjective;
  if (habit.kind === 'avoid') {
    objective = { id: 'o1', label: `Resist: ${habitLabel(habit)}`, type: 'resist', habitId: habit.id, target, count: 0, distinctDays: true, countedDates: [] };
  } else if (habit.category === 'sleep') {
    objective = { id: 'o1', label: 'Meet your sleep goal', type: 'sleepGoal', target, count: 0, distinctDays: true, countedDates: [] };
  } else {
    objective = { id: 'o1', label: habitLabel(habit), type: 'habit', habitId: habit.id, target, count: 0, distinctDays: true, countedDates: [] };
  }
  const material = CATEGORY_INFO[habit.category].material;
  return {
    id: questId(state, 'main', startsOn),
    kind: 'main',
    templateId: template.id,
    title: template.title,
    description: fill(template.description, habit, target),
    npc: template.npc,
    habitId: habit.id,
    category: key,
    objectives: [objective],
    startsOn,
    endsOn,
    status: 'active',
    rewards: {
      // Harder (higher) targets pay more, so consistency still beats a lowered bar.
      xp: Math.round(CONFIG.quests.mainQuestXp * (0.5 + (0.5 * target) / sched)),
      gold: Math.round(CONFIG.quests.mainQuestGold * (0.6 + (0.4 * target) / sched)),
      materials: { [material]: 3 },
    },
  };
}

export function sideQuestFor(state: PlayerState, habit: Habit, startsOn: LocalDate, endsOn: LocalDate): Quest {
  const target = Math.max(1, Math.min(scheduledPerWeek(habit), 2));
  return {
    id: questId(state, 'side', startsOn),
    kind: 'side',
    templateId: 'side',
    title: `Side quest: ${habit.privacy === 'private' ? CATEGORY_INFO[habit.category].name : habit.name}`,
    description: `Optional. ${habitLabel(habit)} ${target} times this week for a small bonus.`,
    npc: 'Quest Board',
    habitId: habit.id,
    category: habit.kind === 'avoid' ? 'avoid' : habit.category,
    objectives: [
      {
        id: 'o1',
        label: habitLabel(habit),
        type: habit.kind === 'avoid' ? 'resist' : 'habit',
        habitId: habit.id,
        target,
        count: 0,
        distinctDays: true,
        countedDates: [],
      },
    ],
    startsOn,
    endsOn,
    status: 'active',
    rewards: { xp: CONFIG.quests.sideQuestXp, gold: 12 },
  };
}

/** Expires last week's quests, records how close Main Quests came, and creates this week's set. */
export function generateWeeklyQuests(state: PlayerState, habits: Habit[], weekStart: LocalDate): Quest[] {
  const endsOn = addDays(weekStart, 6);
  for (const q of state.quests) {
    if (q.status === 'active' && (q.kind === 'main' || q.kind === 'side') && q.endsOn < weekStart) {
      q.status = 'expired';
      if (q.kind === 'main' && q.habitId) {
        const o = q.objectives[0]!;
        const s = statsFor(state, q.habitId);
        s.weeklyRatios.push(o.target ? o.count / o.target : 0);
        s.weeklyRatios = s.weeklyRatios.slice(-8);
      }
    }
  }
  const existing = new Set(state.quests.filter((q) => q.status === 'active' && q.startsOn === weekStart).map((q) => q.habitId));
  const active = habits.filter((h) => !h.archived);
  const created: Quest[] = [];
  const mains = active.filter((h) => h.isMain).slice(0, CONFIG.quests.maxMainQuests);
  for (const h of mains) if (!existing.has(h.id)) created.push(mainQuestFor(state, h, weekStart, endsOn));
  for (const h of active.filter((x) => !x.isMain).slice(0, 3)) if (!existing.has(h.id)) created.push(sideQuestFor(state, h, weekStart, endsOn));
  state.quests.push(...created);
  pruneQuests(state);
  return created;
}

function pruneQuests(state: PlayerState): void {
  const active = state.quests.filter((q) => q.status === 'active');
  const done = state.quests.filter((q) => q.status !== 'active').slice(-30);
  state.quests = [...done, ...active];
}

export function recoveryQuest(state: PlayerState, habits: Habit[], today: LocalDate): Quest {
  const active = habits.filter((h) => !h.archived);
  const has = (pred: (h: Habit) => boolean) => active.some(pred);
  const objectives: QuestObjective[] = [];
  if (has((h) => h.category === 'sleep') || Object.keys(state.sleep).length > 0)
    objectives.push({ id: 'sleep', label: 'Hit your sleep goal twice', type: 'sleepGoal', target: 2, count: 0, distinctDays: true, countedDates: [] });
  if (has((h) => h.kind === 'do' && (h.category === 'movement' || h.category === 'exercise')))
    objectives.push({ id: 'move', label: 'Complete one movement habit', type: 'stat', stat: 'mobility', target: 1, count: 0 });
  if (has((h) => h.kind === 'avoid'))
    objectives.push({ id: 'disc', label: 'Resist one temptation', type: 'resist', target: 1, count: 0 });
  if (has((h) => h.cadence === 'maintenance' && h.kind === 'do'))
    objectives.push({ id: 'maint', label: 'Complete one maintenance habit', type: 'maintenance', target: 1, count: 0 });
  if (objectives.length < 2) objectives.push({ id: 'any', label: 'Log any habit on 2 days', type: 'anyLog', target: 2, count: 0, distinctDays: true, countedDates: [] });
  return {
    id: questId(state, 'recovery', today),
    kind: 'recovery',
    templateId: RECOVERY_QUEST.id,
    title: RECOVERY_QUEST.title,
    description: RECOVERY_QUEST.description,
    npc: RECOVERY_QUEST.npc,
    objectives,
    startsOn: today,
    endsOn: addDays(today, 13),
    status: 'active',
    rewards: { xp: CONFIG.quests.recoveryXp, gold: 40, materials: { essence: 3 } },
  };
}

export function returnerQuest(state: PlayerState, today: LocalDate): Quest {
  return {
    id: questId(state, 'returner', today),
    kind: 'returner',
    templateId: RETURNER_QUEST.id,
    title: RETURNER_QUEST.title,
    description: RETURNER_QUEST.description,
    npc: RETURNER_QUEST.npc,
    objectives: [{ id: 'any', label: 'Log any 3 habits', type: 'anyLog', target: 3, count: 0 }],
    startsOn: today,
    endsOn: addDays(today, 13),
    status: 'active',
    rewards: { xp: 40, gold: CONFIG.quests.returnerGold, itemId: 'returner_locket' },
  };
}

/** The Initiation story beat for a day, as a tiny "log anything today" quest. */
export function initiationQuest(state: PlayerState, day: number, today: LocalDate): Quest | undefined {
  const step = INITIATION_STEPS.find((s) => s.day === day);
  if (!step || day >= 14) return undefined;
  return {
    id: questId(state, 'init', today),
    kind: 'initiation',
    templateId: `initiation_${day}`,
    title: step.title,
    description: step.description,
    npc: step.npc,
    objectives: [{ id: 'any', label: 'Log any habit today', type: 'anyLog', target: 1, count: 0 }],
    startsOn: today,
    endsOn: today,
    status: 'active',
    rewards: { xp: 15, gold: 10 },
  };
}

export interface ProgressEvent {
  type: 'log' | 'resist' | 'sleep';
  date: LocalDate;
  habit?: Habit;
  sleepMet?: boolean;
}

function matches(o: QuestObjective, e: ProgressEvent): boolean {
  switch (o.type) {
    case 'habit':
      return e.type === 'log' && e.habit?.id === o.habitId;
    case 'category':
      return e.type === 'log' && e.habit?.category === o.category;
    case 'sleepGoal':
      return (e.type === 'sleep' && !!e.sleepMet) || (e.type === 'log' && e.habit?.category === 'sleep');
    case 'maintenance':
      return e.type === 'log' && e.habit?.cadence === 'maintenance';
    case 'resist':
      return e.type === 'resist' && (!o.habitId || e.habit?.id === o.habitId);
    case 'anyLog':
      return e.type === 'log' || e.type === 'resist' || (e.type === 'sleep' && !!e.sleepMet);
    case 'stat':
      return e.type === 'log' && !!e.habit && (CATEGORY_INFO[e.habit.category].stat === o.stat || CATEGORY_INFO[e.habit.category].secondary === o.stat);
  }
}

export function grantQuestRewards(state: PlayerState, r: QuestRewards, statHint?: Category): void {
  grantCharacterXp(state, r.xp);
  if (statHint) grantSkillXp(state, CATEGORY_INFO[statHint].stat, Math.round(r.xp / 2));
  state.gold += r.gold;
  if (r.materials) addMaterials(state, r.materials);
  if (r.itemId && !state.inventory[r.itemId]) {
    addItem(state, r.itemId);
    state.feed.push({ kind: 'loot', itemId: r.itemId, date: state.today });
  }
  if (r.title && !state.titles.includes(r.title)) state.titles.push(r.title);
}

/** Applies one real-life action to every active quest. Returns quests completed by it. */
export function progressQuests(state: PlayerState, e: ProgressEvent): Quest[] {
  const completed: Quest[] = [];
  for (const q of state.quests) {
    if (q.status !== 'active' || e.date < q.startsOn || e.date > q.endsOn) continue;
    let changed = false;
    for (const o of q.objectives) {
      if (o.count >= o.target || !matches(o, e)) continue;
      if (o.distinctDays) {
        o.countedDates ??= [];
        if (o.countedDates.includes(e.date)) continue;
        o.countedDates.push(e.date);
      }
      o.count += 1;
      changed = true;
    }
    if (changed && q.objectives.every((o) => o.count >= o.target)) {
      q.status = 'completed';
      q.completedOn = e.date;
      completed.push(q);
      onQuestComplete(state, q);
    }
  }
  return completed;
}

export function onQuestComplete(state: PlayerState, q: Quest): void {
  const cat = q.category && q.category !== 'avoid' ? q.category : undefined;
  grantQuestRewards(state, q.rewards, cat);
  state.counters.questsCompleted += 1;
  if (q.category) state.counters.questsByCategory[q.category] = (state.counters.questsByCategory[q.category] ?? 0) + 1;
  state.feed.push({ kind: 'questComplete', questId: q.id, title: q.title, date: state.today });
  if (q.kind === 'recovery') {
    state.conditions.fallen = false;
    state.lowMomentumDays = 0;
    state.momentum = Math.max(state.momentum, 50);
    state.counters.recoveriesCompleted += 1;
    state.feed.push({ kind: 'condition', condition: 'fallen', on: false, date: state.today });
  }
}

export function activeQuests(state: PlayerState): Quest[] {
  return state.quests.filter((q) => q.status === 'active');
}
