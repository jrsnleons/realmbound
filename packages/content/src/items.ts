import type { Material, Slot, Stat, Tier } from './taxonomy';

export interface ItemEffects {
  /** Percent bonus to all quest and habit XP. */
  xpPct?: number;
  /** Percent bonus to gold. */
  goldPct?: number;
  /** Extra material per eligible log. */
  materialBonus?: number;
  /** Percent bonus to loot chance. */
  lootPct?: number;
  /** Percent bonus to one stat's XP. */
  stat?: { stat: Stat; pct: number };
}

export type ItemSource = 'starter' | 'shop' | 'craft' | 'loot' | 'achievement' | 'boss' | 'quest';

export interface ItemDef {
  id: string;
  name: string;
  slot: Slot | 'consumable';
  tier: Tier;
  set?: EquipmentSet;
  /** Pixel-art visual id (matches @realmbound/pixel EQUIPMENT_VISUAL_IDS) for visible slots. */
  visual?: string;
  description: string;
  effects: ItemEffects;
  sources: ItemSource[];
  price?: number;
  /** Relative weight in loot tables (0 = never drops). */
  lootWeight?: number;
}

export type EquipmentSet = 'traveler' | 'forest_scout' | 'iron_guardian' | 'scholar' | 'dreamwalker' | 'warden';

export const EQUIPMENT_SETS: Record<EquipmentSet, { name: string; tier: Tier; blurb: string }> = {
  traveler: { name: 'Traveler', tier: 'common', blurb: 'Plain, sturdy gear. Your first pieces are earned in your first week.' },
  forest_scout: { name: 'Forest Scout', tier: 'uncommon', blurb: 'Light leathers for those who walk the woods.' },
  scholar: { name: 'Scholar', tier: 'uncommon', blurb: 'Robes for the patient and the curious.' },
  iron_guardian: { name: 'Iron Guardian', tier: 'rare', blurb: 'Forged plate for the steadfast.' },
  warden: { name: 'Warden', tier: 'rare', blurb: 'Coats worn by those who keep the realm safe.' },
  dreamwalker: { name: 'Dreamwalker', tier: 'epic', blurb: 'Woven from moonlight. Earned by rest, never bought.' },
};

const SLOT_NAMES: Record<EquipmentSet, Record<'head' | 'chest' | 'weapon' | 'back', string>> = {
  traveler: { head: 'Traveler Hood', chest: 'Traveler Tunic', weapon: 'Walking Staff', back: 'Traveler Satchel' },
  forest_scout: { head: 'Scout Hood', chest: 'Scout Vest', weapon: 'Hunting Bow', back: 'Leafweave Cloak' },
  scholar: { head: 'Scholar Hat', chest: 'Scholar Robe', weapon: 'Tome of Notes', back: 'Scroll Case' },
  iron_guardian: { head: 'Guardian Helm', chest: 'Guardian Plate', weapon: 'Guardian Sword', back: 'Round Shield' },
  warden: { head: 'Warden Hat', chest: 'Warden Coat', weapon: 'Warden Lantern', back: 'Warden Cloak' },
  dreamwalker: { head: 'Dreamwalker Hood', chest: 'Dreamwalker Robe', weapon: 'Crescent Staff', back: 'Starfall Cape' },
};

const SET_EFFECTS: Record<EquipmentSet, Record<'head' | 'chest' | 'weapon' | 'back', ItemEffects>> = {
  traveler: { head: { stat: { stat: 'mobility', pct: 2 } }, chest: { xpPct: 1 }, weapon: { stat: { stat: 'mobility', pct: 2 } }, back: { materialBonus: 0 } },
  forest_scout: { head: { stat: { stat: 'mobility', pct: 4 } }, chest: { xpPct: 2 }, weapon: { lootPct: 3 }, back: { stat: { stat: 'mobility', pct: 3 } } },
  scholar: { head: { stat: { stat: 'knowledge', pct: 4 } }, chest: { xpPct: 2 }, weapon: { stat: { stat: 'knowledge', pct: 4 } }, back: { materialBonus: 1 } },
  iron_guardian: { head: { stat: { stat: 'discipline', pct: 4 } }, chest: { xpPct: 3 }, weapon: { stat: { stat: 'vitality', pct: 5 } }, back: { stat: { stat: 'discipline', pct: 4 } } },
  warden: { head: { goldPct: 4 }, chest: { xpPct: 3 }, weapon: { lootPct: 4 }, back: { stat: { stat: 'stewardship', pct: 5 } } },
  dreamwalker: { head: { stat: { stat: 'recovery', pct: 5 } }, chest: { xpPct: 5 }, weapon: { stat: { stat: 'recovery', pct: 5 } }, back: { lootPct: 5 } },
};

const SET_SOURCES: Record<EquipmentSet, { sources: ItemSource[]; price?: number; lootWeight: number }> = {
  traveler: { sources: ['achievement', 'shop'], price: 40, lootWeight: 0 },
  forest_scout: { sources: ['shop', 'craft', 'loot'], price: 160, lootWeight: 10 },
  scholar: { sources: ['shop', 'craft', 'loot'], price: 160, lootWeight: 10 },
  iron_guardian: { sources: ['craft', 'loot'], lootWeight: 4 },
  warden: { sources: ['boss', 'loot'], lootWeight: 3 },
  dreamwalker: { sources: ['achievement', 'quest'], lootWeight: 0 },
};

function buildSetItems(): ItemDef[] {
  const out: ItemDef[] = [];
  for (const set of Object.keys(EQUIPMENT_SETS) as EquipmentSet[]) {
    for (const slot of ['head', 'chest', 'weapon', 'back'] as const) {
      const meta = SET_SOURCES[set];
      out.push({
        id: `${set}_${slot}`,
        name: SLOT_NAMES[set][slot],
        slot,
        set,
        tier: EQUIPMENT_SETS[set].tier,
        visual: `${set}_${slot}`,
        description: EQUIPMENT_SETS[set].blurb,
        effects: SET_EFFECTS[set][slot],
        sources: meta.sources,
        price: meta.price,
        lootWeight: meta.lootWeight,
      });
    }
  }
  return out;
}

const TRINKETS: ItemDef[] = [
  {
    id: 'pathfinder_boots',
    name: 'Pathfinder Boots',
    slot: 'trinket',
    tier: 'epic',
    description: 'Worn thin by thirty days of real walking.',
    effects: { stat: { stat: 'mobility', pct: 8 } },
    sources: ['achievement'],
  },
  {
    id: 'mantle_of_resolve',
    name: 'Mantle of Resolve',
    slot: 'trinket',
    tier: 'legendary',
    description: 'Granted to those who completed the long discipline questline.',
    effects: { stat: { stat: 'discipline', pct: 10 }, xpPct: 2 },
    sources: ['achievement'],
  },
  {
    id: 'initiate_charm',
    name: "Initiate's Charm",
    slot: 'trinket',
    tier: 'rare',
    description: 'Proof that you finished the Adventurer’s Initiation.',
    effects: { xpPct: 3 },
    sources: ['quest'],
  },
  {
    id: 'returner_locket',
    name: "Returner's Locket",
    slot: 'trinket',
    tier: 'uncommon',
    description: 'Every hero falls. Not every hero returns. You did.',
    effects: { goldPct: 3 },
    sources: ['quest'],
  },
  {
    id: 'treant_heartwood',
    name: 'Treant Heartwood',
    slot: 'trinket',
    tier: 'epic',
    description: 'A living sliver of the Ancient Treant.',
    effects: { materialBonus: 1, lootPct: 3 },
    sources: ['boss'],
  },
];

const CONSUMABLES: ItemDef[] = [
  {
    id: 'trail_ration',
    name: 'Trail Ration',
    slot: 'consumable',
    tier: 'common',
    description: 'A cosmetic snack. Your hero enjoys it.',
    effects: {},
    sources: ['shop', 'loot'],
    price: 10,
    lootWeight: 30,
  },
  {
    id: 'firework',
    name: 'Celebration Firework',
    slot: 'consumable',
    tier: 'uncommon',
    description: 'Lights up the plaza for everyone nearby.',
    effects: {},
    sources: ['shop', 'loot'],
    price: 25,
    lootWeight: 20,
  },
];

export const ITEMS: ItemDef[] = [...buildSetItems(), ...TRINKETS, ...CONSUMABLES];
export const ITEM_BY_ID: Record<string, ItemDef> = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

export interface Recipe {
  id: string;
  itemId: string;
  materials: Partial<Record<Material, number>>;
  gold: number;
  /** Minimum character level. */
  level: number;
}

const craftCost = (set: EquipmentSet, slot: string): Recipe['materials'] => {
  const base: Record<EquipmentSet, Partial<Record<Material, number>>> = {
    traveler: { cloth: 2, wood: 2 },
    forest_scout: { leather: 4, wood: 3 },
    scholar: { cloth: 4, arcane_dust: 3 },
    iron_guardian: { iron: 6, stone: 3 },
    warden: { leather: 4, iron: 3, boss_shard: 1 },
    dreamwalker: { essence: 6, cloth: 4 },
  };
  const out = { ...base[set] };
  if (slot === 'weapon') out.wood = (out.wood ?? 0) + 2;
  return out;
};

export const RECIPES: Recipe[] = ITEMS.filter((i) => i.sources.includes('craft') && i.set).map((i) => ({
  id: `craft_${i.id}`,
  itemId: i.id,
  materials: craftCost(i.set!, i.slot),
  gold: i.tier === 'rare' ? 60 : 25,
  level: i.tier === 'rare' ? 6 : 3,
}));

/** Heroes begin with nothing equipped. Their first gear is earned through the first achievements. */
export const STARTER_ITEMS: string[] = [];
