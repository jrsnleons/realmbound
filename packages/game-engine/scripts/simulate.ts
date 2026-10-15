/**
 * Balance simulation: plays fake players for 90 days and prints how XP, gold and levels grow.
 * Run with `pnpm simulate`. CI runs the same checks in test/simulation.test.ts.
 */
import { simulate, PROFILES } from '../test/simulation';

const days = Number(process.argv[2] ?? 90);
console.log(`Simulating ${days} days\n`);
console.log('profile        level  totalXp  xp/day  gold  gold/day  quests  bosses  momentum  world');
for (const p of PROFILES) {
  const r = simulate(p, days);
  console.log(
    [
      p.name.padEnd(14),
      String(r.level).padStart(5),
      String(r.totalXp).padStart(8),
      (r.totalXp / days).toFixed(0).padStart(7),
      String(r.gold).padStart(5),
      (r.gold / days).toFixed(1).padStart(9),
      String(r.quests).padStart(7),
      String(r.bosses).padStart(7),
      String(r.momentum).padStart(9),
      r.world.padStart(11),
    ].join(' '),
  );
}
