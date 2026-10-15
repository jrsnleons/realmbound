import { BOSSES, CATEGORY_INFO, ITEMS, type BossDef } from '@realmbound/content';
import { scheduledPerWeek } from './calibration';
import { diffDays, type LocalDate } from './dates';
import { addItem, addMaterials } from './economy';
import type { BossState, Habit, PlayerState } from './types';

export function bossDef(id: BossState['id']): BossDef {
  return BOSSES.find((b) => b.id === id)!;
}

/** Each week brings a new threat sized to the player's own plan. */
export function startWeeklyBoss(state: PlayerState, habits: Habit[], weekStart: LocalDate): BossState {
  const weekIndex = Math.max(0, Math.floor(diffDays(state.createdOn, weekStart) / 7));
  const def = BOSSES[weekIndex % BOSSES.length]!;
  const expected = habits.filter((h) => !h.archived).reduce((s, h) => s + scheduledPerWeek(h), 0);
  const maxHp = Math.max(def.minHp, Math.round(expected * def.hpPerExpectedLog * 0.75));
  const boss: BossState = { id: def.id, hp: maxHp, maxHp, weekStart, defeated: false, log: [`${def.name} appeared in the Whispering Woods.`] };
  state.boss = boss;
  return boss;
}

function push(boss: BossState, line: string) {
  boss.log = [...boss.log, line].slice(-6);
}

/** Damage from a real-life action. Matching the boss's weakness doubles it. */
export function damageBoss(state: PlayerState, habit: Habit | undefined, xp: number, rand: () => number): number {
  const boss = state.boss;
  if (!boss || boss.defeated) return 0;
  const def = bossDef(boss.id);
  const stat = habit ? (habit.kind === 'avoid' ? 'discipline' : CATEGORY_INFO[habit.category].stat) : 'recovery';
  let dmg = Math.round(4 + xp * 0.5);
  const weak = stat === def.weakness;
  if (weak) dmg *= 2;
  boss.hp = Math.max(0, boss.hp - dmg);
  push(boss, weak ? `A weak spot! You dealt ${dmg} damage.` : `You dealt ${dmg} damage.`);
  if (boss.hp === 0) defeatBoss(state, rand);
  return dmg;
}

/** A missed objective lets the boss recover a little: failure becomes game state, not judgment. */
export function healBoss(state: PlayerState, misses: number): void {
  const boss = state.boss;
  if (!boss || boss.defeated || misses <= 0) return;
  const def = bossDef(boss.id);
  const heal = Math.min(boss.maxHp - boss.hp, def.healOnMiss * misses);
  if (heal <= 0) return;
  boss.hp += heal;
  push(boss, `${def.name} regained ${heal} HP.`);
}

function defeatBoss(state: PlayerState, rand: () => number): void {
  const boss = state.boss!;
  const def = bossDef(boss.id);
  boss.defeated = true;
  push(boss, `${def.name} was defeated!`);
  state.gold += def.reward.gold;
  addMaterials(state, { boss_shard: def.reward.shards });
  state.counters.bossesDefeated += 1;
  state.feed.push({ kind: 'bossDefeated', id: def.id, date: state.today });
  if (rand() < def.reward.itemChance) {
    const pool = ITEMS.filter((i) => i.sources.includes('boss') && !state.inventory[i.id]);
    const item = def.id === 'ancient_treant' && !state.inventory.treant_heartwood ? 'treant_heartwood' : pool[Math.floor(rand() * pool.length)]?.id;
    if (item) {
      addItem(state, item);
      state.feed.push({ kind: 'loot', itemId: item, date: state.today });
    }
  }
}
