import { describe, expect, it } from 'vitest';
import { PROFILES, simulate } from './simulation';

describe('90-day balance simulation', () => {
  const results = Object.fromEntries(PROFILES.map((p) => [p.name, simulate(p, 90)]));

  it('levels a consistent player to about level 10 in 90 days', () => {
    expect(results.perfect!.level).toBeGreaterThanOrEqual(8);
    expect(results.perfect!.level).toBeLessThanOrEqual(13);
  });

  it('keeps spam from paying much more than consistency', () => {
    expect(results.spammer!.totalXp / results.perfect!.totalXp).toBeLessThan(1.25);
  });

  it('rewards consistency over a struggling week but never stalls the struggler', () => {
    expect(results.perfect!.totalXp).toBeGreaterThan(results.steady!.totalXp);
    expect(results.steady!.totalXp).toBeGreaterThan(results.struggling!.totalXp);
    expect(results.struggling!.level).toBeGreaterThanOrEqual(5);
  });

  it('has no runaway gold', () => {
    for (const r of Object.values(results)) expect(r.gold / 90).toBeLessThan(60);
  });
});
