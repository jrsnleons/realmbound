// Core vocabulary shared by the engine, the server and the app.

export const STATS = [
  'vitality',
  'mobility',
  'recovery',
  'discipline',
  'knowledge',
  'craftsmanship',
  'stewardship',
] as const;
export type Stat = (typeof STATS)[number];

export const STAT_INFO: Record<Stat, { name: string; blurb: string; color: string }> = {
  vitality: { name: 'Vitality', blurb: 'Training, exercise and physical effort', color: '#FF3B30' },
  mobility: { name: 'Mobility', blurb: 'Walking, stretching and moving every day', color: '#FF9500' },
  recovery: { name: 'Recovery', blurb: 'Sleep, rest and recovery routines', color: '#5E5CE6' },
  discipline: { name: 'Discipline', blurb: 'Keeping commitments and resisting temptations', color: '#AF52DE' },
  knowledge: { name: 'Knowledge', blurb: 'Reading, study and deliberate learning', color: '#007AFF' },
  craftsmanship: { name: 'Craftsmanship', blurb: 'Building, coding, creating and project work', color: '#A2845E' },
  stewardship: { name: 'Stewardship', blurb: 'Home, chores, finances and responsibilities', color: '#34C759' },
};

export const CATEGORIES = [
  'movement',
  'exercise',
  'sleep',
  'hydration',
  'nutrition',
  'health',
  'mindfulness',
  'learning',
  'craft',
  'chores',
  'finance',
  'social',
  'screen',
  'other',
] as const;
export type Category = (typeof CATEGORIES)[number];

export const MATERIALS = [
  'wood',
  'stone',
  'iron',
  'leather',
  'cloth',
  'essence',
  'arcane_dust',
  'boss_shard',
] as const;
export type Material = (typeof MATERIALS)[number];

export const MATERIAL_INFO: Record<Material, { name: string }> = {
  wood: { name: 'Wood' },
  stone: { name: 'Stone' },
  iron: { name: 'Iron Ore' },
  leather: { name: 'Leather' },
  cloth: { name: 'Cloth' },
  essence: { name: 'Essence' },
  arcane_dust: { name: 'Arcane Dust' },
  boss_shard: { name: 'Boss Shard' },
};

export interface CategoryInfo {
  name: string;
  stat: Stat;
  /** Secondary stat that receives a third of the XP. */
  secondary?: Stat;
  material: Material;
  /** Maintenance habits stay stable; progressive ones may scale up. */
  defaultCadence: 'maintenance' | 'progressive';
  /** Fantasy noun used by quest text, e.g. "the Old Road". */
  realm: string;
  emoji: string;
}

export const CATEGORY_INFO: Record<Category, CategoryInfo> = {
  movement: { name: 'Movement', stat: 'mobility', secondary: 'vitality', material: 'leather', defaultCadence: 'progressive', realm: 'the Old Road', emoji: '🚶' },
  exercise: { name: 'Training', stat: 'vitality', secondary: 'mobility', material: 'iron', defaultCadence: 'progressive', realm: 'the Training Grounds', emoji: '🏋️' },
  sleep: { name: 'Sleep', stat: 'recovery', material: 'essence', defaultCadence: 'maintenance', realm: 'Moonwatch Camp', emoji: '🌙' },
  hydration: { name: 'Hydration', stat: 'recovery', secondary: 'vitality', material: 'cloth', defaultCadence: 'maintenance', realm: 'the Riverstone wells', emoji: '💧' },
  nutrition: { name: 'Nutrition', stat: 'vitality', secondary: 'discipline', material: 'cloth', defaultCadence: 'maintenance', realm: 'the Hearth Kitchen', emoji: '🥗' },
  health: { name: 'Health', stat: 'recovery', secondary: 'stewardship', material: 'essence', defaultCadence: 'maintenance', realm: "the Healer's Hut", emoji: '💊' },
  mindfulness: { name: 'Mindfulness', stat: 'recovery', secondary: 'discipline', material: 'essence', defaultCadence: 'maintenance', realm: 'the Quiet Shrine', emoji: '🧘' },
  learning: { name: 'Learning', stat: 'knowledge', material: 'arcane_dust', defaultCadence: 'progressive', realm: 'the Riverstone Library', emoji: '📚' },
  craft: { name: 'Projects', stat: 'craftsmanship', secondary: 'knowledge', material: 'stone', defaultCadence: 'progressive', realm: 'the Forge', emoji: '🛠️' },
  chores: { name: 'Home', stat: 'stewardship', material: 'wood', defaultCadence: 'maintenance', realm: 'your quarters', emoji: '🧹' },
  finance: { name: 'Finances', stat: 'stewardship', secondary: 'discipline', material: 'stone', defaultCadence: 'maintenance', realm: 'the Counting House', emoji: '💰' },
  social: { name: 'Social', stat: 'stewardship', secondary: 'recovery', material: 'cloth', defaultCadence: 'maintenance', realm: 'the Tavern', emoji: '🤝' },
  screen: { name: 'Screen time', stat: 'discipline', secondary: 'recovery', material: 'essence', defaultCadence: 'maintenance', realm: 'the Mirror Hall', emoji: '📵' },
  other: { name: 'Other', stat: 'discipline', material: 'wood', defaultCadence: 'maintenance', realm: 'the wilds', emoji: '✨' },
};

export type Slot = 'head' | 'chest' | 'weapon' | 'back' | 'trinket';
export const VISIBLE_SLOTS: Slot[] = ['head', 'chest', 'weapon', 'back'];
export type Tier = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';
export const TIER_ORDER: Tier[] = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'];
export const TIER_COLOR: Record<Tier, string> = {
  common: '#8E8E93',
  uncommon: '#34C759',
  rare: '#007AFF',
  epic: '#AF52DE',
  legendary: '#FF9500',
  mythic: '#FF2D55',
};
