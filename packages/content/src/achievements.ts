import type { Category } from './taxonomy';

export type AchievementRule =
  | { kind: 'distinctDays'; category: Category | 'any'; days: number }
  | { kind: 'sleepGoalDays'; days: number }
  | { kind: 'resistDays'; days: number }
  | { kind: 'level'; level: number }
  | { kind: 'questsCompleted'; count: number; category?: Category | 'avoid' }
  | { kind: 'bossesDefeated'; count: number }
  | { kind: 'initiationComplete' }
  | { kind: 'recoveryComplete' }
  | { kind: 'returned' }
  | { kind: 'highMomentumDays'; days: number }
  | { kind: 'liveQuests'; count: number };

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  rule: AchievementRule;
  rewardItemId?: string;
  rewardTitle?: string;
  /** Hidden until unlocked. */
  secret?: boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first_step', name: 'First Step', description: 'Log your first habit.', rule: { kind: 'distinctDays', category: 'any', days: 1 }, rewardItemId: 'traveler_chest' },
  { id: 'three_days', name: 'Finding a Rhythm', description: 'Log something on 3 different days.', rule: { kind: 'distinctDays', category: 'any', days: 3 }, rewardItemId: 'traveler_weapon' },
  { id: 'one_week', name: 'Seven Suns', description: 'Log something on 7 different days.', rule: { kind: 'distinctDays', category: 'any', days: 7 }, rewardItemId: 'traveler_head' },
  { id: 'thirty_days', name: 'A Month of Mornings', description: 'Log something on 30 different days.', rule: { kind: 'distinctDays', category: 'any', days: 30 }, rewardTitle: 'the Steadfast' },
  { id: 'pathfinder', name: 'Pathfinder', description: 'Walk on 30 different days.', rule: { kind: 'distinctDays', category: 'movement', days: 30 }, rewardItemId: 'pathfinder_boots', rewardTitle: 'Pathfinder' },
  { id: 'dreamwalker', name: 'Dreamwalker', description: 'Meet your sleep goal on 25 different days.', rule: { kind: 'sleepGoalDays', days: 25 }, rewardItemId: 'dreamwalker_chest', rewardTitle: 'Dreamwalker' },
  { id: 'dream_hood', name: 'Moonlit Hood', description: 'Meet your sleep goal on 10 different days.', rule: { kind: 'sleepGoalDays', days: 10 }, rewardItemId: 'dreamwalker_head' },
  { id: 'resolve', name: 'Mantle of Resolve', description: 'Complete 4 discipline quests.', rule: { kind: 'questsCompleted', count: 4, category: 'avoid' }, rewardItemId: 'mantle_of_resolve', rewardTitle: 'the Resolute' },
  { id: 'resist_10', name: 'Unmoved', description: 'Resist a temptation on 10 different days.', rule: { kind: 'resistDays', days: 10 } },
  { id: 'scholar_20', name: 'Bookworm', description: 'Learn on 20 different days.', rule: { kind: 'distinctDays', category: 'learning', days: 20 }, rewardTitle: 'the Learned' },
  { id: 'maker_20', name: 'Maker', description: 'Work on a project on 20 different days.', rule: { kind: 'distinctDays', category: 'craft', days: 20 }, rewardTitle: 'the Maker' },
  { id: 'level_5', name: 'Rising Hero', description: 'Reach level 5.', rule: { kind: 'level', level: 5 } },
  { id: 'level_10', name: 'Veteran', description: 'Reach level 10.', rule: { kind: 'level', level: 10 }, rewardTitle: 'Veteran' },
  { id: 'level_20', name: 'Champion of Riverstone', description: 'Reach level 20.', rule: { kind: 'level', level: 20 }, rewardTitle: 'Champion' },
  { id: 'initiate', name: 'Initiate', description: "Finish the Adventurer's Initiation.", rule: { kind: 'initiationComplete' }, rewardTitle: 'Initiate' },
  { id: 'quests_10', name: 'Quest Taker', description: 'Complete 10 quests.', rule: { kind: 'questsCompleted', count: 10 } },
  { id: 'first_boss', name: 'Threat Repelled', description: 'Defeat your first weekly threat.', rule: { kind: 'bossesDefeated', count: 1 } },
  { id: 'bosses_5', name: 'Woodland Warden', description: 'Defeat 5 weekly threats.', rule: { kind: 'bossesDefeated', count: 5 }, rewardItemId: 'warden_head' },
  { id: 'comeback', name: 'The Comeback', description: 'Complete a recovery quest.', rule: { kind: 'recoveryComplete' }, rewardTitle: 'the Unbroken', secret: true },
  { id: 'returned', name: 'The Hero Returns', description: 'Come back after time away.', rule: { kind: 'returned' }, rewardItemId: 'returner_locket', secret: true },
  { id: 'momentum_7', name: 'In the Flow', description: 'Hold High Momentum for 7 days.', rule: { kind: 'highMomentumDays', days: 7 } },
  { id: 'live_1', name: 'Better Together', description: 'Finish a live party quest.', rule: { kind: 'liveQuests', count: 1 } },
  { id: 'live_10', name: "Scholars' Circle", description: 'Finish 10 live party quests.', rule: { kind: 'liveQuests', count: 10 }, rewardItemId: 'scholar_back' },
];
