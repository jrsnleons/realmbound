import type { Stat } from './taxonomy';

export type MonsterId = 'slime' | 'forest_goblin' | 'shadow_wisp' | 'corruption_beast' | 'ancient_treant';

export interface BossDef {
  id: MonsterId;
  name: string;
  /** HP per expected weekly log, so the fight scales with the player's own plan. */
  hpPerExpectedLog: number;
  minHp: number;
  weakness: Stat;
  /** HP restored each time a scheduled habit is missed. */
  healOnMiss: number;
  lore: string;
  reward: { gold: number; shards: number; itemChance: number };
}

/** Weekly threats rotate in this order; the Ancient Treant is the first real boss. */
export const BOSSES: BossDef[] = [
  { id: 'slime', name: 'Meadow Slime', hpPerExpectedLog: 8, minHp: 30, weakness: 'vitality', healOnMiss: 3, lore: 'A wobbly pest. Practice for what is coming.', reward: { gold: 30, shards: 1, itemChance: 0.1 } },
  { id: 'forest_goblin', name: 'Forest Goblin', hpPerExpectedLog: 10, minHp: 40, weakness: 'mobility', healOnMiss: 4, lore: 'It steals from travellers on the Old Road.', reward: { gold: 40, shards: 1, itemChance: 0.15 } },
  { id: 'shadow_wisp', name: 'Shadow Wisp', hpPerExpectedLog: 10, minHp: 40, weakness: 'recovery', healOnMiss: 5, lore: 'It feeds on tired minds. Rest burns it away.', reward: { gold: 45, shards: 2, itemChance: 0.2 } },
  { id: 'ancient_treant', name: 'Ancient Treant', hpPerExpectedLog: 14, minHp: 80, weakness: 'craftsmanship', healOnMiss: 6, lore: 'The oldest thing in the Whispering Woods, twisted by corruption.', reward: { gold: 120, shards: 4, itemChance: 0.6 } },
  { id: 'corruption_beast', name: 'Corruption Beast', hpPerExpectedLog: 12, minHp: 60, weakness: 'discipline', healOnMiss: 6, lore: 'Temptation given teeth.', reward: { gold: 70, shards: 3, itemChance: 0.3 } },
];

export type ZoneId = 'riverstone' | 'whispering_woods' | 'player_room' | 'training_grounds';

export const ZONES: Record<ZoneId, { name: string; blurb: string; unlockDay: number }> = {
  player_room: { name: 'Your Room', blurb: 'Your quarters. They reflect how you are doing.', unlockDay: 2 },
  riverstone: { name: 'Riverstone', blurb: 'The main town. Quest board, shop, forge and plaza.', unlockDay: 1 },
  whispering_woods: { name: 'Whispering Woods', blurb: 'The starter adventure zone, home of the weekly threat.', unlockDay: 1 },
  training_grounds: { name: 'Training Grounds', blurb: 'Focus and exercise tutorials.', unlockDay: 3 },
};

export const EMOTES = ['wave', 'cheer', 'heart', 'laugh', 'sleep', 'thumbs_up'] as const;
export type Emote = (typeof EMOTES)[number];

/** Lobby chat is preset phrases only (no free text). */
export const PRESET_PHRASES = [
  'Hello!',
  'Good luck today!',
  'Nice armor!',
  'Want to party up?',
  'Starting a focus session!',
  'Back from a walk.',
  'Rested and ready.',
  'You can do it!',
  'Thanks!',
  'See you tomorrow!',
] as const;

export const NPC_LINES = {
  thriving: [
    'Riverstone has not looked this bright in years.',
    'The forge sings when you are around.',
    'Look at you! Steady as the river.',
  ],
  neutral: [
    'Another day, another chance.',
    'The quest board has something for you.',
    'Small steps still count.',
  ],
  struggling: [
    'Rough week? The Healer has a quest that might help.',
    'Clouds pass. They always do.',
    'No shame in a slow week. Start with one small thing.',
  ],
};

export const ARCHETYPES = [
  { id: 'guardian', name: 'Guardian', stats: ['vitality', 'discipline'] as Stat[], blurb: 'Strong body, stronger will.' },
  { id: 'artificer', name: 'Artificer', stats: ['knowledge', 'craftsmanship'] as Stat[], blurb: 'Learns, then builds.' },
  { id: 'druid', name: 'Druid', stats: ['recovery', 'stewardship'] as Stat[], blurb: 'Balanced, rested, rooted.' },
  { id: 'pathfinder', name: 'Pathfinder', stats: ['mobility', 'vitality'] as Stat[], blurb: 'Always on the move.' },
  { id: 'sage', name: 'Sage', stats: ['knowledge', 'recovery'] as Stat[], blurb: 'Calm mind, deep study.' },
  { id: 'warden', name: 'Warden', stats: ['discipline', 'stewardship'] as Stat[], blurb: 'Keeps every promise.' },
];
