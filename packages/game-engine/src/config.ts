/**
 * Every balance number lives here so it can be tuned without touching rules.
 * Values follow "Game rules v0" in the implementation plan.
 */
export const CONFIG = {
  version: 1,
  rewards: {
    baseXp: { maintenance: 10, progressive: 15, avoid: 12 },
    difficultyMultiplier: { easy: 0.8, normal: 1.0, hard: 1.3 },
    /** Reward share for the 1st, 2nd, 3rd and later logs in the same pool on one day. */
    diminishing: [1, 0.7, 0.35, 0.1],
    /** Stricter share for repeating the very same habit on one day. */
    sameHabitRepeat: [1, 0.35, 0.1, 0],
    dailyPoolCapXp: 60,
    goldPerLog: 3,
    /** Ramp for brand-new habits: [days since created, multiplier]. */
    newHabitRamp: [
      [3, 0.6],
      [7, 0.8],
    ] as [number, number][],
    momentumHighBonus: 0.1,
    masteredBaseMultiplier: 0.6,
    masteredConsistencyBonus: 3,
    secondaryStatShare: 1 / 3,
    /** Material drops only when the diminishing multiplier is at least this. */
    materialMinShare: 0.35,
    /** Cap on the sum of all equipment XP bonuses. */
    maxEquipmentXpPct: 15,
    sleepLogXp: 12,
    socialVerifiedBonus: 0.2,
  },
  levels: {
    characterBase: 50,
    characterExponent: 1.5,
    skillBase: 30,
    skillExponent: 1.4,
    maxLevel: 60,
  },
  momentum: {
    windowDays: 7,
    decay: 0.8,
    high: 70,
    low: 40,
    initial: 50,
  },
  conditions: {
    fatigueMissesOf4: 3,
    fatigueClearStreak: 2,
    temptedSlips7d: 3,
    temptedClearResists: 3,
    fallenMomentum: 30,
    fallenDays: 3,
  },
  calibration: {
    initiationDays: 14,
    discoveryUntil: 3,
    patternsUntil: 7,
    feltDifficultyAskEvery: 3,
    confidenceFullAt: 10,
    targetStretch: 1.1,
    lowerAfterRate: 0.4,
    raiseAfterWeeksAtFull: 2,
    recoveryDayBelow: 0.4,
    mastery: { rate: 0.85, days: 28, minLogs: 20 },
    overcommit: { maxMainHabits: 5, rate: 0.4, weeks: 2 },
  },
  quests: {
    mainQuestXp: 60,
    mainQuestGold: 60,
    sideQuestXp: 20,
    recoveryXp: 80,
    returnerGold: 80,
    returnerAfterDays: 7,
    templateMemory: 3,
    maxMainQuests: 5,
  },
  loot: {
    baseChance: 0.06,
    highMomentumChance: 0.04,
    tierWeights: { common: 50, uncommon: 30, rare: 14, epic: 5, legendary: 1, mythic: 0 },
    guaranteedInitiationDay: 6,
  },
  world: {
    thrivingAt: 70,
    strugglingBelow: 40,
  },
  history: {
    keepDays: 120,
    logHoursKept: 30,
  },
  allowedLogBackfillDays: 0,
} as const;

export type Config = typeof CONFIG;
