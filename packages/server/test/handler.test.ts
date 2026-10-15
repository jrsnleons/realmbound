import { describe, expect, it } from 'vitest';
import { handle, MemoryRepo, type Deps, type Response } from '../src';

const ALICE = 'aaaaaaaa-0000-4000-8000-000000000001';
const BOB = 'bbbbbbbb-0000-4000-8000-000000000002';

function setup(start = '2026-10-12T10:00:00Z') {
  const repo = new MemoryRepo();
  let now = new Date(start);
  let n = 0;
  const deps: Deps = { repo, now: () => now, newId: () => `cccccccc-0000-4000-8000-${String(++n).padStart(12, '0')}`, random: () => 0.5 };
  return {
    repo,
    deps,
    at: (iso: string) => (now = new Date(iso)),
    call: (user: string, action: string, payload?: Record<string, unknown>, idempotencyKey?: string) => handle(deps, user, { action, payload, idempotencyKey }),
  };
}

function ok(r: Response) {
  if (!r.ok) throw new Error(`${r.code}: ${r.message}`);
  return r;
}

async function onboard(t: ReturnType<typeof setup>, user = ALICE, username = 'alice') {
  return ok(
    await t.call(user, 'createPlayer', {
      username,
      timezone: 'Asia/Manila',
      appearance: { bodyMode: 'fantasy', bodyTier: 3, skinTone: 4, hairStyle: 5 },
      habits: [{ name: 'Walk home', days: [1, 2, 3, 4, 5] }, { name: 'Avoid junk food after work' }, { name: 'Drink water' }],
    }),
  );
}

describe('game server', () => {
  it('starts heroes with nothing equipped and supports flexible weekly habits', async () => {
    const t = setup();
    const r = ok(await t.call(ALICE, 'createPlayer', { username: 'fresh_hero', habits: [{ name: 'Go for a run', perWeek: 3 }, { name: 'Read', days: [2, 4] }] }));
    const view = (r as unknown as { view: { state: { equipment: object; inventory: object }; habits: { name: string; days: number[]; perWeek?: number }[] } }).view;
    expect(view.state.equipment).toEqual({});
    expect(view.state.inventory).toEqual({});
    const run = view.habits.find((h) => h.name === 'Go for a run')!;
    expect(run.perWeek).toBe(3);
    expect(run.days).toEqual([]);
    expect(view.habits.find((h) => h.name === 'Read')!.perWeek).toBeUndefined();
    const habitId = (view.habits[0] as unknown as { id: string }).id;
    const switched = ok(await t.call(ALICE, 'updateHabit', { habitId, patch: { days: [1, 3, 5], perWeek: null } }, 'k1'));
    const after = (switched as unknown as { view: { habits: { id: string; days: number[]; perWeek?: number }[] } }).view.habits.find((h) => h.id === habitId)!;
    expect(after.perWeek).toBeUndefined();
    expect(after.days).toEqual([1, 3, 5]);
  });

  it('asks new users to onboard, then creates a hero with classified habits', async () => {
    const t = setup();
    expect(await t.call(ALICE, 'me')).toEqual({ ok: true, needsOnboarding: true });
    const r = await onboard(t);
    const habits = r.view!.habits;
    expect(habits.map((h) => [h.category, h.kind])).toEqual([
      ['movement', 'do'],
      ['nutrition', 'avoid'],
      ['hydration', 'do'],
    ]);
    expect(r.view!.state.appearance.bodyTier).toBe(3);
    expect(t.repo.players.get(ALICE)!.profile!.level).toBe(1);
    const dupe = await t.call(BOB, 'createPlayer', { username: 'ALICE', habits: [{ name: 'Read' }] });
    expect(dupe).toMatchObject({ ok: false, code: 'username_taken' });
  });

  it('logs a habit server-side and returns the reward', async () => {
    const t = setup();
    const created = await onboard(t);
    const walk = created.view!.habits[0]!;
    const r = ok(await t.call(ALICE, 'logHabit', { habitId: walk.id, felt: 'normal' }, 'tap-1'));
    expect((r.data as { reward: { characterXp: number } }).reward.characterXp).toBeGreaterThan(0);
    expect(t.repo.logs).toHaveLength(1);
    expect(t.repo.logs[0]!.date).toBe('2026-10-12');
    expect(t.repo.states.get(ALICE)!.version).toBe(2);
    // A double tap with the same key is not paid twice.
    const again = ok(await t.call(ALICE, 'logHabit', { habitId: walk.id }, 'tap-1'));
    expect(t.repo.states.get(ALICE)!.version).toBe(2);
    expect(again.data).toEqual(r.data);
  });

  it('rejects client attempts to set rewards or unknown actions', async () => {
    const t = setup();
    await onboard(t);
    expect(await t.call(ALICE, 'grantGold', { gold: 9999 })).toMatchObject({ ok: false, code: 'unknown_action' });
    expect(await t.call(ALICE, 'logHabit', { habitId: 'nope' })).toMatchObject({ ok: false, code: 'unknown_habit' });
    expect(await t.call(ALICE, 'buy', { itemId: 'dreamwalker_chest' })).toMatchObject({ ok: false, code: 'not_for_sale' });
  });

  it('rolls days over lazily in the player timezone', async () => {
    const t = setup();
    await onboard(t);
    // 2026-10-12T16:30Z is already 00:30 on the 13th in Manila.
    t.at('2026-10-12T16:30:00Z');
    const r = ok(await t.call(ALICE, 'me'));
    expect(r.view!.today).toBe('2026-10-13');
    expect(Object.values(r.view!.state.history['2026-10-12'] ?? {})).toContain('missed');
    expect(t.repo.events.at(-1)!.type).toBe('ROLLOVER');
  });

  it('creates habits with duplicate detection and adds a quest mid-week', async () => {
    const t = setup();
    await onboard(t);
    t.at('2026-10-16T10:00:00Z'); // day 5: Main Quests exist
    ok(await t.call(ALICE, 'me'));
    const r = ok(await t.call(ALICE, 'createHabit', { habit: { name: 'Hydrate', isMain: false } }));
    const data = r.data as { duplicateOf?: string };
    expect(data.duplicateOf).toBeDefined();
    const study = ok(await t.call(ALICE, 'createHabit', { habit: { name: 'Study Spanish', isMain: true } }));
    const id = (study.data as { habitId: string }).habitId;
    expect(study.view!.state.quests.some((q) => q.habitId === id && q.kind === 'main')).toBe(true);
    ok(await t.call(ALICE, 'archiveHabit', { habitId: id }));
    expect(ok(await t.call(ALICE, 'me')).view!.habits.some((h) => h.id === id)).toBe(false);
  });

  it('runs parties and a live co-op quest with server-checked timing', async () => {
    const t = setup();
    await onboard(t, ALICE, 'alice');
    await onboard(t, BOB, 'bob');
    const party = ok(await t.call(ALICE, 'partyCreate', { name: 'Night Owls' })).data as { party: { code: string } };
    ok(await t.call(BOB, 'partyJoin', { code: party.party.code.toLowerCase() }));
    const view = ok(await t.call(BOB, 'partyGet')).data as { members: { username: string }[] };
    expect(view.members.map((m) => m.username).sort()).toEqual(['alice', 'bob']);

    const q = ok(await t.call(ALICE, 'liveQueue', { kind: 'focus', durationMin: 25 })).data as { session: { id: string; startsAt: string } };
    const joined = ok(await t.call(BOB, 'liveQueue', { kind: 'focus', durationMin: 25 })).data as { session: { id: string }; participants: unknown[] };
    expect(joined.session.id).toBe(q.session.id);
    expect(joined.participants).toHaveLength(2);
    expect(await t.call(ALICE, 'liveComplete', { sessionId: q.session.id })).toMatchObject({ ok: false, code: 'not_finished' });

    t.at(new Date(Date.parse(q.session.startsAt) + 25 * 60_000).toISOString());
    const done = ok(await t.call(ALICE, 'liveComplete', { sessionId: q.session.id }));
    expect((done.data as { reward: { characterXp: number } }).reward.characterXp).toBeGreaterThan(20);
    expect(await t.call(ALICE, 'liveComplete', { sessionId: q.session.id })).toMatchObject({ ok: false, code: 'already_rewarded' });
    ok(await t.call(BOB, 'liveComplete', { sessionId: q.session.id }));
    expect(t.repo.states.get(BOB)!.state.counters.liveQuests).toBe(1);

    ok(await t.call(ALICE, 'partyLeave'));
    const after = ok(await t.call(BOB, 'partyGet')).data as { party: { leaderId: string } };
    expect(after.party.leaderId).toBe(BOB);
  });

  it('keeps private habit names out of the public profile', async () => {
    const t = setup();
    await onboard(t);
    const json = JSON.stringify(t.repo.players.get(ALICE)!.profile);
    expect(json).not.toMatch(/junk|Walk home|water/i);
    expect(json).toMatch(/todayProgress/);
  });
});
