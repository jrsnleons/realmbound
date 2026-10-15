import type { Category } from './taxonomy';

export interface QuestTemplate {
  id: string;
  title: string;
  /** {habit} = habit name (or its category when private), {n} = target count. */
  description: string;
  npc: string;
}

/** Fantasy wrappers for Main Quests. The same habit rotates through these week to week. */
export const MAIN_QUEST_TEMPLATES: Record<Category | 'avoid', QuestTemplate[]> = {
  movement: [
    { id: 'mv_old_road', title: 'Scout the Old Road', description: 'The Old Road is overgrown again. {habit} {n} times this week to map it.', npc: 'Ranger Ilse' },
    { id: 'mv_long_road', title: 'The Long Road Home', description: 'Every step home is a step on the map. {habit} {n} times this week.', npc: 'Ranger Ilse' },
    { id: 'mv_caravan', title: 'Escort the Caravan', description: 'A caravan needs walkers beside it. {habit} {n} times this week.', npc: 'Merchant Odo' },
    { id: 'mv_missing_ranger', title: 'Search for the Missing Ranger', description: 'Tracks lead into the Whispering Woods. {habit} {n} times to follow them.', npc: 'Ranger Ilse' },
    { id: 'mv_map_path', title: 'Map the Old Path', description: 'Cartographer Pell needs fresh notes. {habit} {n} times this week.', npc: 'Cartographer Pell' },
  ],
  exercise: [
    { id: 'ex_drills', title: 'Training Ground Drills', description: 'Captain Brann wants to see sweat. {habit} {n} times this week.', npc: 'Captain Brann' },
    { id: 'ex_wall', title: 'Hold the Wall', description: 'The east wall needs strong arms. {habit} {n} times this week.', npc: 'Captain Brann' },
    { id: 'ex_forge_bellows', title: 'Work the Forge Bellows', description: 'Smith Hilde needs a steady hand. {habit} {n} times this week.', npc: 'Smith Hilde' },
    { id: 'ex_trial', title: 'Trial of Strength', description: 'Prove your strength to the Guild. {habit} {n} times this week.', npc: 'Guild Registrar Mae' },
  ],
  sleep: [
    { id: 'sl_moonwatch', title: 'Rest at Moonwatch Camp', description: 'The camp fire burns brightest for the rested. Meet your sleep goal {n} nights.', npc: 'Old Fennick' },
    { id: 'sl_dream_path', title: 'Walk the Dream Path', description: 'The Dreamwalkers only speak to the well rested. Meet your sleep goal {n} nights.', npc: 'Seer Liora' },
    { id: 'sl_lanterns', title: 'Dim the Lanterns', description: 'Riverstone sleeps easier when you do. Meet your sleep goal {n} nights.', npc: 'Lamplighter Tam' },
  ],
  hydration: [
    { id: 'hy_supplies', title: 'Restore Supplies', description: 'The wells run low. {habit} {n} times this week.', npc: 'Innkeeper Rosa' },
    { id: 'hy_spring', title: 'Clear the Spring', description: 'Keep the old spring flowing. {habit} {n} times this week.', npc: 'Old Fennick' },
  ],
  nutrition: [
    { id: 'nu_kitchen', title: 'Stock the Hearth Kitchen', description: 'Good meals make good adventurers. {habit} {n} times this week.', npc: 'Innkeeper Rosa' },
    { id: 'nu_harvest', title: 'Bring in the Harvest', description: 'Help with the harvest. {habit} {n} times this week.', npc: 'Farmer Goss' },
  ],
  health: [
    { id: 'he_healer', title: "The Healer's Rounds", description: 'Keep up your remedies. {habit} {n} times this week.', npc: 'Healer Amara' },
    { id: 'he_tonics', title: 'Brew the Tonics', description: 'Steady care keeps you strong. {habit} {n} times this week.', npc: 'Healer Amara' },
  ],
  mindfulness: [
    { id: 'mi_shrine', title: 'Tend the Quiet Shrine', description: 'The shrine glows when tended. {habit} {n} times this week.', npc: 'Monk Saro' },
    { id: 'mi_still_water', title: 'Still Water', description: 'Find the calm beneath the noise. {habit} {n} times this week.', npc: 'Monk Saro' },
  ],
  learning: [
    { id: 'le_library', title: 'Restore the Library', description: 'Lost pages wait to be read. {habit} {n} times this week.', npc: 'Archivist Quill' },
    { id: 'le_runes', title: 'Decipher the Runes', description: 'Strange runes appeared on the old stones. {habit} {n} times to study them.', npc: 'Archivist Quill' },
    { id: 'le_apprentice', title: "The Apprentice's Exam", description: 'The mages want proof of study. {habit} {n} times this week.', npc: 'Magister Vell' },
  ],
  craft: [
    { id: 'cr_forge', title: 'Light the Forge', description: 'Every project feeds the forge. {habit} {n} times this week.', npc: 'Smith Hilde' },
    { id: 'cr_bridge', title: 'Rebuild the Bridge', description: 'The river bridge needs builders. {habit} {n} times this week.', npc: 'Builder Joss' },
    { id: 'cr_workshop', title: 'The Tinkerer’s Workshop', description: 'Gears and plans everywhere. {habit} {n} times this week.', npc: 'Tinkerer Nim' },
  ],
  chores: [
    { id: 'ch_quarters', title: 'Set Your Quarters in Order', description: 'A tidy room is a strong base. {habit} {n} times this week.', npc: 'Housekeeper Bea' },
    { id: 'ch_tavern', title: 'Restore the Tavern', description: 'The tavern needs a good scrub. {habit} {n} times this week.', npc: 'Innkeeper Rosa' },
  ],
  finance: [
    { id: 'fi_ledger', title: 'Balance the Ledger', description: 'The Counting House trusts the careful. {habit} {n} times this week.', npc: 'Clerk Pim' },
  ],
  social: [
    { id: 'so_tavern_tales', title: 'Tavern Tales', description: 'Stories are better shared. {habit} {n} times this week.', npc: 'Bard Lyle' },
  ],
  screen: [
    { id: 'sc_mirror', title: 'Break the Mirror Spell', description: 'The Mirror Hall pulls at you. {habit} {n} times this week.', npc: 'Seer Liora' },
  ],
  other: [
    { id: 'ot_errand', title: 'An Errand for the Guild', description: 'The Guild Registrar has a task. {habit} {n} times this week.', npc: 'Guild Registrar Mae' },
  ],
  avoid: [
    { id: 'av_merchant', title: 'Resist the Cursed Merchant', description: 'The Cursed Merchant has tempting wares. Resist {n} times this week.', npc: 'Seer Liora' },
    { id: 'av_wyrm', title: 'Starve the Wyrm', description: 'Each time you resist, the wyrm weakens. Resist {n} times this week.', npc: 'Captain Brann' },
    { id: 'av_whispers', title: 'Ignore the Whispers', description: 'Something in the woods calls your name. Resist {n} times this week.', npc: 'Monk Saro' },
    { id: 'av_ward', title: 'Hold the Ward', description: 'Keep the ward stone glowing. Resist {n} times this week.', npc: 'Magister Vell' },
  ],
};

export const RECOVERY_QUEST = {
  id: 'recovery_fallen',
  title: 'The Fallen Adventurer',
  description: 'Everyone stumbles. Rebuild your footing one small step at a time.',
  npc: 'Healer Amara',
};

export const RETURNER_QUEST = {
  id: 'returner',
  title: 'The Hero Returns',
  description: 'Riverstone missed you. No debts, no penalties. Log any three habits to settle back in.',
  npc: 'Guild Registrar Mae',
};

export interface InitiationStep {
  day: number;
  title: string;
  description: string;
  npc: string;
}

/** Story beats for the 14-day Adventurer's Initiation (section 6 / 61 of the design doc). */
export const INITIATION_STEPS: InitiationStep[] = [
  { day: 1, title: 'A New Name in the Ledger', description: 'Meet the Guild Registrar and log your first habit.', npc: 'Guild Registrar Mae' },
  { day: 2, title: 'A Room of Your Own', description: 'Your quarters in Riverstone are ready. Log any habit to settle in.', npc: 'Housekeeper Bea' },
  { day: 3, title: 'First Steps', description: 'Keep going. Your first skill level is close.', npc: 'Captain Brann' },
  { day: 4, title: 'The Pattern Reader', description: 'Seer Liora starts reading the patterns in your days.', npc: 'Seer Liora' },
  { day: 5, title: 'A Quest of Your Own', description: 'Your first personal quest appears on the board.', npc: 'Guild Registrar Mae' },
  { day: 6, title: 'Something Glints', description: 'Rumour says the woods hide treasure for the steady.', npc: 'Ranger Ilse' },
  { day: 7, title: 'Halfway There', description: 'One week in. Look back at how far you came.', npc: 'Guild Registrar Mae' },
  { day: 8, title: 'Trial Targets', description: 'The Guild sets trial targets based on your week.', npc: 'Captain Brann' },
  { day: 10, title: 'Finding the Rhythm', description: 'Small steady wins beat big bursts.', npc: 'Monk Saro' },
  { day: 12, title: 'The Woods Stir', description: 'Something old wakes in the Whispering Woods.', npc: 'Ranger Ilse' },
  { day: 14, title: 'Initiation Complete', description: 'Stand before the Guild and receive your title.', npc: 'Guild Registrar Mae' },
];
