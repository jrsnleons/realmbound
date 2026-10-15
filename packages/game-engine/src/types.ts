import type { Category, Material, MonsterId, Slot, Stat } from '@realmbound/content';
import type { LocalDate } from './dates';

export type HabitKind = 'do' | 'avoid';
export type Cadence = 'maintenance' | 'progressive';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type Privacy = 'private' | 'category' | 'party' | 'public';

export interface Habit {
  id: string;
  name: string;
  kind: HabitKind;
  category: Category;
  cadence: Cadence;
  /** Weekdays the habit is scheduled (0 = Sunday). Empty = any day, never counted as missed. */
  days: number[];
  isMain: boolean;
  /** Habits that share a pool key share one daily reward pool (duplicate detection). */
  poolKey: string;
  createdOn: LocalDate;
  archived: boolean;
  privacy: Privacy;
  /** Calibrated difficulty (set by the engine). */
  difficulty: Difficulty;
  calibrationConfidence: number;
  mastered: boolean;
  /** Weekly target suggested by calibration (Main Quests). */
  weeklyTarget?: number;
  /** Optional measured goal, e.g. "30" minutes. */
  goalMinutes?: number;
}

/** What happened to a habit on a given day. */
export type Mark = 'done' | 'missed' | 'resisted' | 'slipped' | 'rest' | 'away';

export type Condition = 'fatigue' | 'tempted' | 'fallen';
export type WorldState = 'thriving' | 'neutral' | 'struggling';

export interface QuestObjective {
  id: string;
  label: string;
  type: 'habit' | 'category' | 'sleepGoal' | 'maintenance' | 'resist' | 'anyLog' | 'stat';
  habitId?: string;
  category?: Category;
  stat?: Stat;
  target: number;
  count: number;
  /** Dates already counted, so one day counts once for "times this week" objectives. */
  countedDates?: LocalDate[];
  distinctDays?: boolean;
}

export type QuestKind = 'main' | 'side' | 'recovery' | 'returner' | 'initiation';

export interface Quest {
  id: string;
  kind: QuestKind;
  templateId: string;
  title: string;
  description: string;
  npc: string;
  habitId?: string;
  category?: Category | 'avoid';
  objectives: QuestObjective[];
  startsOn: LocalDate;
  endsOn: LocalDate;
  status: 'active' | 'completed' | 'expired';
  completedOn?: LocalDate;
  rewards: QuestRewards;
}

export interface QuestRewards {
  xp: number;
  gold: number;
  materials?: Partial<Record<Material, number>>;
  itemId?: string;
  title?: string;
}

export interface BossState {
  id: MonsterId;
  hp: number;
  maxHp: number;
  weekStart: LocalDate;
  defeated: boolean;
  /** Last few lines of the fight log ("Sugar Wyrm regained 6 HP"). */
  log: string[];
}

export interface HabitStats {
  scheduled: number;
  done: number;
  /** Completion rate per weekday [Sun..Sat]: [done, scheduled]. */
  byWeekday: [number, number][];
  /** Hours of the day logs happened, newest last. */
  hours: number[];
  felt: Record<Difficulty, number>;
  logs: number;
  /** Weekly completion ratios against target, newest last. */
  weeklyRatios: number[];
}

export interface CalibrationProfile {
  graduatedOn: LocalDate;
  primaryStrength: Stat;
  developing: Stat;
  recoveryDay?: number;
  activityWindow?: [number, number];
}

export interface ChronicleEntry {
  date: LocalDate;
  label: string;
  level: number;
  bodyTier: number;
  equipment: Partial<Record<Slot, string>>;
  stats: Record<Stat, number>;
  title?: string;
  worldState: WorldState;
  highlight: string;
}

export interface PlayerState {
  schema: 1;
  seed: number;
  counter: number;
  createdOn: LocalDate;
  /** Last local date the rollover processed (today, once bootstrapped). */
  today: LocalDate;
  lastLogOn?: LocalDate;
  level: number;
  /** XP into the current level. */
  xp: number;
  totalXp: number;
  gold: number;
  skills: Record<Stat, { xp: number; level: number; total: number }>;
  momentum: number;
  highMomentumStreak: number;
  conditions: Record<Condition, boolean>;
  lowMomentumDays: number;
  restMode: { on: boolean; since?: LocalDate; reason?: 'illness' | 'injury' | 'rest' | 'other' };
  worldState: WorldState;
  daily: { date: LocalDate; pools: Record<string, { count: number; xp: number }> };
  /** history[date][habitId] = mark. Trimmed to CONFIG.history.keepDays. */
  history: Record<LocalDate, Record<string, Mark>>;
  sleep: Record<LocalDate, { hours: number; met: boolean }>;
  sleepGoalHours: number;
  habitStats: Record<string, HabitStats>;
  quests: Quest[];
  questMemory: Record<string, string[]>;
  weekStart?: LocalDate;
  inventory: Record<string, number>;
  materials: Record<Material, number>;
  equipment: Partial<Record<Slot, string>>;
  achievements: Record<string, LocalDate>;
  counters: {
    distinctDays: Partial<Record<Category | 'any', number>>;
    lastCountedDay: Partial<Record<Category | 'any', LocalDate>>;
    sleepGoalDays: number;
    resistDays: number;
    lastResistDay?: LocalDate;
    questsCompleted: number;
    questsByCategory: Partial<Record<Category | 'avoid', number>>;
    bossesDefeated: number;
    recoveriesCompleted: number;
    returns: number;
    liveQuests: number;
    logs: number;
  };
  initiation: { graduated: boolean; profile?: CalibrationProfile; observations: string[]; lootGiven: boolean };
  boss?: BossState;
  chronicle: ChronicleEntry[];
  titles: string[];
  activeTitle?: string;
  appearance: Appearance;
  /** Pending client-facing notices (level ups, loot, quest completions) drained by the app. */
  feed: FeedItem[];
}

export interface Appearance {
  bodyMode: 'custom' | 'mirror' | 'fantasy';
  bodyTier: 1 | 2 | 3;
  skinTone: number;
  hairStyle: number;
  hairColor: number;
  face: number;
}

export type FeedItem =
  | { kind: 'levelUp'; level: number; date: LocalDate }
  | { kind: 'skillUp'; stat: Stat; level: number; date: LocalDate }
  | { kind: 'loot'; itemId: string; date: LocalDate }
  | { kind: 'questComplete'; questId: string; title: string; date: LocalDate }
  | { kind: 'achievement'; id: string; date: LocalDate }
  | { kind: 'bossDefeated'; id: MonsterId; date: LocalDate }
  | { kind: 'observation'; text: string; date: LocalDate }
  | { kind: 'condition'; condition: Condition; on: boolean; date: LocalDate }
  | { kind: 'world'; state: WorldState; date: LocalDate }
  | { kind: 'chronicle'; label: string; date: LocalDate }
  | { kind: 'graduation'; date: LocalDate };

export interface Reward {
  skillXp: Partial<Record<Stat, number>>;
  characterXp: number;
  gold: number;
  materials: Partial<Record<Material, number>>;
  items: string[];
  momentumBefore: number;
  share: number;
  notes: string[];
}

export interface GameEvent {
  type: string;
  date: LocalDate;
  payload: Record<string, unknown>;
  reward?: Reward;
}
