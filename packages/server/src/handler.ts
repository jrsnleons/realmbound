import {
  advanceTo,
  applyAction,
  CONFIG,
  createHabit,
  createInitialState,
  GameError,
  hashString,
  isScheduled,
  localDateTime,
  mainQuestFor,
  publicProfile,
  updateHabit,
  weekday,
  addDays,
  classifyHabit,
  type Action,
  type Appearance,
  type FeedItem,
  type Habit,
  type HabitInput,
  type PlayerState,
} from '@realmbound/game-engine';
import { CATEGORIES } from '@realmbound/content';
import type { AiAdapters, LiveSessionRow, LogRow, ProfileRow, Repo } from './types';

export interface Request {
  action: string;
  payload?: Record<string, unknown>;
  idempotencyKey?: string;
}

export interface View {
  player: { id: string; username: string; timezone: string };
  state: PlayerState;
  habits: Habit[];
  feed: FeedItem[];
  today: string;
  hour: number;
}

export type Response = { ok: true; view?: View; data?: unknown; needsOnboarding?: boolean } | { ok: false; code: string; message: string };

export interface Deps {
  repo: Repo;
  ai?: AiAdapters;
  now?: () => Date;
  newId?: () => string;
  random?: () => number;
}

const GAME_ACTIONS = new Set(['logHabit', 'avoidCheckin', 'logSleep', 'setRestMode', 'equip', 'unequip', 'buy', 'craft', 'useItem', 'setTitle', 'setSleepGoal']);
const LIVE_KINDS: LiveSessionRow['kind'][] = ['focus', 'walk', 'clean', 'stretch', 'plan'];
const LIVE_TITLES: Record<LiveSessionRow['kind'], string> = {
  focus: "Scholars' Hour",
  walk: 'Road Patrol',
  clean: 'Restore the Tavern',
  stretch: 'Morning Drills',
  plan: 'Camp Preparation',
};
const LOBBY_SECONDS = 60;
const LATE_JOIN_MINUTES = 5;

function fail(code: string, message: string): never {
  throw new GameError(code, message);
}

function str(v: unknown, field: string, max = 200): string {
  if (typeof v !== 'string' || v.length === 0 || v.length > max) fail('bad_request', `Invalid ${field}.`);
  return v;
}

function validTimezone(tz: unknown): string {
  if (typeof tz !== 'string') return 'UTC';
  try {
    new Intl.DateTimeFormat('en', { timeZone: tz });
    return tz;
  } catch {
    return 'UTC';
  }
}

function sanitizeAppearance(a: unknown): Partial<Appearance> {
  const x = (a ?? {}) as Record<string, unknown>;
  const int = (v: unknown, min: number, max: number) => (Number.isInteger(v) && (v as number) >= min && (v as number) <= max ? (v as number) : undefined);
  const out: Partial<Appearance> = {};
  if (x.bodyMode === 'custom' || x.bodyMode === 'mirror' || x.bodyMode === 'fantasy') out.bodyMode = x.bodyMode;
  const tier = int(x.bodyTier, 1, 3);
  if (tier) out.bodyTier = tier as 1 | 2 | 3;
  const skin = int(x.skinTone, 0, 5);
  if (skin !== undefined) out.skinTone = skin;
  const hs = int(x.hairStyle, 0, 11);
  if (hs !== undefined) out.hairStyle = hs;
  const hc = int(x.hairColor, 0, 7);
  if (hc !== undefined) out.hairColor = hc;
  const face = int(x.face, 0, 3);
  if (face !== undefined) out.face = face;
  return out;
}

function sanitizeHabitInput(raw: unknown): HabitInput {
  const x = (raw ?? {}) as Record<string, unknown>;
  const input: HabitInput = { name: str(x.name, 'habit name', 60).trim() };
  if (x.kind === 'do' || x.kind === 'avoid') input.kind = x.kind;
  if (typeof x.category === 'string' && (CATEGORIES as readonly string[]).includes(x.category)) input.category = x.category as HabitInput['category'];
  if (x.cadence === 'maintenance' || x.cadence === 'progressive') input.cadence = x.cadence;
  if (Array.isArray(x.days)) input.days = x.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6) as number[];
  if (typeof x.isMain === 'boolean') input.isMain = x.isMain;
  if (x.privacy === 'private' || x.privacy === 'category' || x.privacy === 'party' || x.privacy === 'public') input.privacy = x.privacy;
  if (Number.isInteger(x.goalMinutes) && (x.goalMinutes as number) > 0 && (x.goalMinutes as number) <= 600) input.goalMinutes = x.goalMinutes as number;
  return input;
}

export function profileFor(state: PlayerState, habits: Habit[]): ProfileRow {
  const marks = state.history[state.today] ?? {};
  const scheduled = habits.filter((h) => isScheduled(h, state.today, weekday));
  const done = scheduled.filter((h) => marks[h.id] === 'done' || marks[h.id] === 'resisted').length;
  return { ...publicProfile(state), todayProgress: { date: state.today, done, scheduled: scheduled.length } };
}

function logFor(action: Action, state: PlayerState, hour: number): LogRow | undefined {
  switch (action.type) {
    case 'logHabit':
      return { habitId: action.habitId, kind: 'log', status: 'done', date: state.today, hour, felt: action.felt, durationMin: action.durationMin, verification: action.socialVerified ? 'social' : 'self' };
    case 'avoidCheckin':
      return { habitId: action.habitId, kind: 'checkin', status: action.resisted ? 'resisted' : 'slipped', date: state.today, hour };
    case 'logSleep':
      return { kind: 'sleep', status: state.sleep[state.today]?.met ? 'met' : 'short', date: state.today, hour, value: action.hours };
    case 'liveQuestComplete':
      return { kind: 'live', status: 'done', date: state.today, hour, durationMin: action.minutes, verification: 'social' };
    default:
      return undefined;
  }
}

function parseAction(type: string, p: Record<string, unknown>): Action {
  switch (type) {
    case 'logHabit': {
      const felt = p.felt === 'easy' || p.felt === 'normal' || p.felt === 'hard' ? p.felt : undefined;
      const durationMin = Number.isInteger(p.durationMin) ? (p.durationMin as number) : undefined;
      return { type, habitId: str(p.habitId, 'habit'), felt, durationMin };
    }
    case 'avoidCheckin':
      if (typeof p.resisted !== 'boolean') fail('bad_request', 'Missing answer.');
      return { type, habitId: str(p.habitId, 'habit'), resisted: p.resisted };
    case 'logSleep':
      if (typeof p.hours !== 'number') fail('bad_request', 'Missing hours.');
      return { type, hours: Math.round(p.hours * 4) / 4 };
    case 'setRestMode':
      return { type, on: p.on === true, reason: (['illness', 'injury', 'rest', 'other'] as const).find((r) => r === p.reason) };
    case 'equip':
      return { type, itemId: str(p.itemId, 'item') };
    case 'unequip': {
      const slot = (['head', 'chest', 'weapon', 'back', 'trinket'] as const).find((s) => s === p.slot);
      if (!slot) fail('bad_request', 'Invalid slot.');
      return { type, slot };
    }
    case 'buy':
      return { type, itemId: str(p.itemId, 'item') };
    case 'craft':
      return { type, recipeId: str(p.recipeId, 'recipe') };
    case 'useItem':
      return { type, itemId: str(p.itemId, 'item') };
    case 'setTitle':
      return { type, title: str(p.title, 'title', 40) };
    case 'setSleepGoal':
      if (typeof p.hours !== 'number') fail('bad_request', 'Missing hours.');
      return { type, hours: p.hours };
    default:
      fail('unknown_action', `Unknown action ${type}.`);
  }
}

export async function handle(deps: Deps, userId: string, req: Request): Promise<Response> {
  try {
    return await run(deps, userId, req, 0);
  } catch (e) {
    if (e instanceof GameError) return { ok: false, code: e.code, message: e.message };
    throw e;
  }
}

async function run(deps: Deps, userId: string, req: Request, attempt: number): Promise<Response> {
  const { repo } = deps;
  const now = (deps.now ?? (() => new Date()))();
  const newId = deps.newId ?? (() => crypto.randomUUID());
  const payload = (req.payload ?? {}) as Record<string, unknown>;

  if (req.action === 'createPlayer') return createPlayer(deps, userId, payload, now, newId);

  const player = await repo.getPlayer(userId);
  if (!player) return { ok: true, needsOnboarding: true };

  if (req.idempotencyKey) {
    const prior = await repo.findEvent(userId, req.idempotencyKey);
    if (prior) return prior.result as Response;
  }

  const stored = await repo.getState(userId);
  if (!stored) fail('no_state', 'Player state missing.');
  const habitsBefore = await repo.getHabits(userId);
  const { date: today, hour } = localDateTime(now, player.timezone);
  const startState: PlayerState = { ...stored.state, feed: [] };
  const rolled = advanceTo(startState, habitsBefore, today < startState.today ? startState.today : today);
  let state = rolled.state;
  let habits = rolled.habits;
  const habitsChanged = () => JSON.stringify(habits) !== JSON.stringify(habitsBefore);
  const view = (): View => ({ player: { id: player.id, username: player.username, timezone: player.timezone }, state, habits: habits.filter((h) => !h.archived), feed: state.feed, today: state.today, hour });

  const commit = async (event?: { type: string; payload: Record<string, unknown>; reward?: unknown }, log?: LogRow, result?: Response) => {
    const toStore: PlayerState = { ...state, feed: [] };
    try {
      await repo.commit({
        playerId: userId,
        expectedVersion: stored.version,
        state: toStore,
        event: event ? { type: event.type, date: state.today, payload: event.payload, reward: event.reward, result, idempotencyKey: req.idempotencyKey, engineVersion: CONFIG.version } : undefined,
        habits: habitsChanged() ? habits : undefined,
        log,
        profile: profileFor(state, habits),
      });
    } catch (e) {
      if (e instanceof Error && /version_conflict/.test(e.message) && attempt < 2) throw new RetryError();
      throw e;
    }
  };

  try {
    if (req.action === 'me') {
      if (rolled.daysClosed > 0) await commit({ type: 'ROLLOVER', payload: { days: rolled.daysClosed, returned: rolled.returned } });
      return { ok: true, view: view() };
    }

    if (GAME_ACTIONS.has(req.action)) {
      const action = parseAction(req.action, payload);
      const r = applyAction(state, habits, action, { hour });
      state = r.state;
      const response: Response = {
        ok: true,
        view: view(),
        data: { reward: r.reward, completedQuests: r.completedQuests.map((q) => ({ id: q.id, title: q.title, rewards: q.rewards })), bossDamage: r.bossDamage },
      };
      await commit({ type: action.type, payload: r.event.payload, reward: r.reward }, logFor(action, state, hour), stripView(response));
      return response;
    }

    switch (req.action) {
      case 'createHabit': {
        const input = sanitizeHabitInput(payload.habit);
        const classification = await classifyWithAi(deps.ai, input.name);
        const created = createHabit(newId(), input, habits, state.today, classification);
        let habit = created.habit;
        if (!created.duplicateOf && deps.ai?.similarity) {
          const active = habits.filter((h) => !h.archived && h.kind === habit.kind);
          const sims = active.length ? await safe(() => deps.ai!.similarity!(habit.name, active.map((h) => h.name))) : undefined;
          const best = sims?.reduce((b, s, i) => (s > b.s ? { s, i } : b), { s: 0, i: -1 });
          if (best && best.s >= 0.9) habit = { ...habit, poolKey: active[best.i]!.poolKey };
        }
        habit = { ...habit, sortOrder: habits.length };
        habits = [...habits, habit];
        // A new Main Habit after quests started this week gets its quest right away.
        const weekStart = state.weekStart;
        if (habit.isMain && weekStart && state.quests.some((q) => q.kind === 'main' && q.status === 'active')) {
          state = structuredClone(state);
          state.quests.push(mainQuestFor(state, habit, weekStart, addDays(weekStart, 6)));
        }
        await commit({ type: 'HABIT_CREATED', payload: { habitId: habit.id, category: habit.category, kind: habit.kind, classifiedBy: created.classification.source, duplicateOf: created.duplicateOf } });
        return { ok: true, view: view(), data: { habitId: habit.id, duplicateOf: created.duplicateOf, classification: created.classification } };
      }
      case 'updateHabit':
      case 'archiveHabit': {
        const habitId = str(payload.habitId, 'habit');
        const h = habits.find((x) => x.id === habitId);
        if (!h) fail('unknown_habit', 'That habit does not exist.');
        const patch = req.action === 'archiveHabit' ? { archived: true } : { ...sanitizePatch(payload.patch) };
        habits = habits.map((x) => (x.id === habitId ? updateHabit(x, patch, habits) : x));
        await commit({ type: req.action === 'archiveHabit' ? 'HABIT_ARCHIVED' : 'HABIT_UPDATED', payload: { habitId, fields: Object.keys(patch) } });
        return { ok: true, view: view() };
      }
      case 'setAppearance': {
        state = structuredClone(state);
        state.appearance = { ...state.appearance, ...sanitizeAppearance(payload.appearance) };
        await commit({ type: 'APPEARANCE_CHANGED', payload: {} });
        return { ok: true, view: view() };
      }
      case 'setTimezone': {
        const tz = validTimezone(payload.timezone);
        await repo.updateTimezone(userId, tz);
        return { ok: true, data: { timezone: tz } };
      }
      case 'deleteAccount': {
        if (payload.confirm !== 'DELETE') fail('confirm', 'Type DELETE to confirm.');
        await repo.deleteAccount(userId);
        return { ok: true, data: { deleted: true } };
      }
      case 'partyGet':
        return { ok: true, data: await partyView(repo, userId) };
      case 'partyCreate': {
        if (await repo.getPartyOf(userId)) fail('in_party', 'Leave your current party first.');
        const name = str(payload.name, 'party name', 30).trim();
        if (name.length < 2) fail('bad_name', 'Party names need at least 2 characters.');
        const code = partyCode(deps.random ?? Math.random);
        const party = await repo.createParty({ code, name, leaderId: userId });
        await repo.addPartyMember(party.id, userId);
        return { ok: true, data: await partyView(repo, userId) };
      }
      case 'partyJoin': {
        if (await repo.getPartyOf(userId)) fail('in_party', 'Leave your current party first.');
        const party = await repo.getPartyByCode(str(payload.code, 'code', 12).toUpperCase().trim());
        if (!party) fail('no_party', 'No party has that code.');
        const members = await repo.partyMembers(party.id);
        if (members.length >= party.maxMembers) fail('party_full', 'That party is full.');
        await repo.addPartyMember(party.id, userId);
        return { ok: true, data: await partyView(repo, userId) };
      }
      case 'partyLeave': {
        const party = await repo.getPartyOf(userId);
        if (!party) return { ok: true, data: null };
        await repo.removePartyMember(party.id, userId);
        const left = await repo.partyMembers(party.id);
        if (left.length === 0) await repo.deleteParty(party.id);
        else if (party.leaderId === userId) await repo.setPartyLeader(party.id, left[0]!.playerId);
        return { ok: true, data: null };
      }
      case 'liveList': {
        const party = await repo.getPartyOf(userId);
        return { ok: true, data: await repo.listLiveSessions(now.toISOString(), party?.id ?? null) };
      }
      case 'liveQueue':
      case 'liveCreate': {
        const kind = LIVE_KINDS.find((k) => k === payload.kind) ?? 'focus';
        const durationMin = [15, 20, 25, 30, 45].includes(payload.durationMin as number) ? (payload.durationMin as number) : 30;
        let session = req.action === 'liveQueue' ? await repo.findOpenLiveSession(kind, now.toISOString(), durationMin) : null;
        if (session && (await repo.liveParticipants(session.id)).length >= session.maxPlayers) session = null;
        if (!session) {
          const party = payload.partyOnly ? await repo.getPartyOf(userId) : null;
          const startsAt = new Date(now.getTime() + LOBBY_SECONDS * 1000);
          session = await repo.createLiveSession({
            kind,
            title: LIVE_TITLES[kind],
            hostId: userId,
            partyId: party?.id ?? null,
            isPublic: !party,
            durationMin,
            startsAt: startsAt.toISOString(),
            endsAt: new Date(startsAt.getTime() + durationMin * 60_000).toISOString(),
            maxPlayers: 8,
          });
        }
        await repo.addLiveParticipant(session.id, userId, now.toISOString());
        return { ok: true, data: { session, participants: await repo.liveParticipants(session.id), serverNow: now.toISOString() } };
      }
      case 'liveJoin': {
        const session = await repo.getLiveSession(str(payload.sessionId, 'session'));
        if (!session || session.status === 'cancelled' || session.status === 'finished') fail('no_session', 'That session has ended.');
        if (now.getTime() > Date.parse(session.startsAt) + LATE_JOIN_MINUTES * 60_000) fail('too_late', 'This session started too long ago to join.');
        const parts = await repo.liveParticipants(session.id);
        if (parts.length >= session.maxPlayers && !parts.some((p) => p.playerId === userId)) fail('session_full', 'That session is full.');
        if (!session.isPublic) {
          const party = await repo.getPartyOf(userId);
          if (session.partyId !== party?.id) fail('not_invited', 'That session is for another party.');
        }
        await repo.addLiveParticipant(session.id, userId, now.toISOString());
        return { ok: true, data: { session, participants: await repo.liveParticipants(session.id), serverNow: now.toISOString() } };
      }
      case 'liveLeave': {
        const id = str(payload.sessionId, 'session');
        const session = await repo.getLiveSession(id);
        if (session && now.getTime() < Date.parse(session.endsAt)) await repo.removeLiveParticipant(id, userId);
        return { ok: true, data: null };
      }
      case 'liveComplete': {
        const id = str(payload.sessionId, 'session');
        const session = await repo.getLiveSession(id);
        if (!session) fail('no_session', 'Unknown session.');
        if (now.getTime() < Date.parse(session.endsAt) - 5_000) fail('not_finished', 'The session has not finished yet.');
        const parts = await repo.liveParticipants(id);
        const me = parts.find((p) => p.playerId === userId);
        if (!me) fail('not_participant', 'You were not part of this session.');
        if (Date.parse(me.joinedAt) > Date.parse(session.startsAt) + LATE_JOIN_MINUTES * 60_000) fail('too_late', 'You joined too late for rewards.');
        if (!(await repo.claimLiveReward(id, userId))) fail('already_rewarded', 'Rewards for this session were already collected.');
        try {
          const r = applyAction(state, habits, { type: 'liveQuestComplete', minutes: session.durationMin, partySize: parts.length }, { hour });
          state = r.state;
          const response: Response = { ok: true, view: view(), data: { reward: r.reward, completedQuests: r.completedQuests.map((q) => ({ id: q.id, title: q.title })), bossDamage: r.bossDamage } };
          await commit({ type: 'LIVE_QUEST_COMPLETE', payload: { sessionId: id, kind: session.kind, partySize: parts.length }, reward: r.reward }, logFor({ type: 'liveQuestComplete', minutes: session.durationMin, partySize: parts.length }, state, hour));
          if (session.status !== 'finished') await repo.setLiveStatus(id, 'finished');
          return response;
        } catch (e) {
          await repo.unclaimLiveReward(id, userId);
          throw e;
        }
      }
      default:
        fail('unknown_action', `Unknown action ${req.action}.`);
    }
  } catch (e) {
    if (e instanceof RetryError) return run(deps, userId, req, attempt + 1);
    throw e;
  }
}

class RetryError extends Error {}

function stripView(r: Response): Response {
  if (!r.ok) return r;
  return { ok: true, data: r.data };
}

function sanitizePatch(raw: unknown): Partial<HabitInput> & { archived?: boolean } {
  const x = (raw ?? {}) as Record<string, unknown>;
  const out: Partial<HabitInput> & { archived?: boolean } = {};
  if (typeof x.name === 'string') out.name = x.name.slice(0, 60);
  if (Array.isArray(x.days)) out.days = x.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6) as number[];
  if (x.privacy === 'private' || x.privacy === 'category' || x.privacy === 'party' || x.privacy === 'public') out.privacy = x.privacy;
  if (typeof x.isMain === 'boolean') out.isMain = x.isMain;
  if (typeof x.category === 'string' && (CATEGORIES as readonly string[]).includes(x.category)) out.category = x.category as HabitInput['category'];
  if (x.cadence === 'maintenance' || x.cadence === 'progressive') out.cadence = x.cadence;
  if (typeof x.archived === 'boolean') out.archived = x.archived;
  if (Number.isInteger(x.goalMinutes)) out.goalMinutes = x.goalMinutes as number;
  return out;
}

async function safe<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch {
    return undefined;
  }
}

async function classifyWithAi(ai: AiAdapters | undefined, name: string) {
  const rules = classifyHabit(name);
  if (rules.confidence >= 0.67 || !ai?.classify) return rules;
  const smart = await safe(() => ai.classify!(name));
  // Rules always decide Do vs Avoid; AI only helps place the category.
  return smart ? { ...smart, kind: rules.kind, cadence: rules.kind === 'avoid' ? 'maintenance' : smart.cadence } : rules;
}

function partyCode(rand: () => number): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(rand() * alphabet.length)];
  return s;
}

async function partyView(repo: Repo, userId: string) {
  const party = await repo.getPartyOf(userId);
  if (!party) return null;
  return { party, members: await repo.partyMembers(party.id) };
}

async function createPlayer(deps: Deps, userId: string, p: Record<string, unknown>, now: Date, newId: () => string): Promise<Response> {
  const { repo } = deps;
  if (await repo.getPlayer(userId)) fail('exists', 'You already have a hero.');
  const username = str(p.username, 'username', 20).trim();
  if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) fail('bad_username', 'Use 3–20 letters, numbers or underscores.');
  if (await repo.usernameTaken(username)) fail('username_taken', 'That name is taken.');
  const timezone = validTimezone(p.timezone);
  const { date: today, hour } = localDateTime(now, timezone);
  const rawHabits = Array.isArray(p.habits) ? p.habits.slice(0, 5) : [];
  if (rawHabits.length < 1) fail('need_habits', 'Pick at least one habit to start.');
  const sleepGoal = typeof p.sleepGoalHours === 'number' && p.sleepGoalHours >= 4 && p.sleepGoalHours <= 12 ? p.sleepGoalHours : 7;
  const state = createInitialState({ seed: hashString(userId), today, appearance: sanitizeAppearance(p.appearance), sleepGoalHours: sleepGoal });
  let habits: Habit[] = [];
  for (const raw of rawHabits) {
    const input = sanitizeHabitInput(raw);
    const classification = await classifyWithAi(deps.ai, input.name);
    habits = [...habits, { ...createHabit(newId(), { ...input, isMain: input.isMain ?? true }, habits, today, classification).habit, sortOrder: habits.length }];
  }
  await repo.createPlayer({ id: userId, username, timezone, state, habits, profile: profileFor(state, habits) });
  return {
    ok: true,
    view: { player: { id: userId, username, timezone }, state, habits, feed: [], today, hour },
  };
}
