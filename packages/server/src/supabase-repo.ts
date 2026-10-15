import type { Habit, PlayerState } from '@realmbound/game-engine';
import type { CommitInput, LiveParticipantRow, LiveSessionRow, PartyMemberView, PartyRow, PlayerRow, ProfileRow, Repo } from './types';

/** The slice of supabase-js the repo uses, so this package does not depend on it directly. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Query = any;
export interface DbClient {
  from(table: string): Query;
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;
}

type Row = Record<string, unknown>;

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

function toHabit(r: Row): Habit {
  return {
    id: r.id as string,
    name: r.name as string,
    kind: r.kind as Habit['kind'],
    category: r.category as Habit['category'],
    cadence: r.cadence as Habit['cadence'],
    days: (r.days as number[]) ?? [],
    isMain: r.is_main as boolean,
    poolKey: r.pool_key as string,
    createdOn: r.created_on as string,
    archived: r.archived as boolean,
    privacy: r.privacy as Habit['privacy'],
    difficulty: r.difficulty as Habit['difficulty'],
    calibrationConfidence: Number(r.calibration_confidence ?? 0),
    mastered: r.mastered as boolean,
    weeklyTarget: (r.weekly_target as number | null) ?? undefined,
    goalMinutes: (r.goal_minutes as number | null) ?? undefined,
    sortOrder: (r.sort_order as number | null) ?? 0,
  };
}

function toParty(r: Row): PartyRow {
  return { id: r.id as string, code: r.code as string, name: r.name as string, leaderId: r.leader_id as string, maxMembers: r.max_members as number };
}

function toSession(r: Row): LiveSessionRow {
  return {
    id: r.id as string,
    kind: r.kind as LiveSessionRow['kind'],
    title: r.title as string,
    hostId: r.host_id as string,
    partyId: (r.party_id as string | null) ?? null,
    isPublic: r.is_public as boolean,
    durationMin: r.duration_min as number,
    status: r.status as LiveSessionRow['status'],
    startsAt: new Date(r.starts_at as string).toISOString(),
    endsAt: new Date(r.ends_at as string).toISOString(),
    maxPlayers: r.max_players as number,
  };
}

/** Repo backed by Postgres through supabase-js with the service role (Edge Function only). */
export class SupabaseRepo implements Repo {
  constructor(private db: DbClient) {}

  async getPlayer(id: string): Promise<PlayerRow | null> {
    const r = check(await this.db.from('players').select('id, username, timezone').eq('id', id).maybeSingle()) as Row | null;
    return r ? { id: r.id as string, username: r.username as string, timezone: r.timezone as string } : null;
  }
  async getState(id: string) {
    const r = check(await this.db.from('player_state').select('version, state').eq('player_id', id).maybeSingle()) as Row | null;
    return r ? { version: r.version as number, state: r.state as PlayerState } : null;
  }
  async getHabits(id: string) {
    const rows = check(await this.db.from('habits').select('*').eq('player_id', id).order('sort_order')) as Row[];
    return rows.map(toHabit);
  }
  async findEvent(playerId: string, key: string) {
    const r = check(await this.db.from('game_events').select('result').eq('player_id', playerId).eq('idempotency_key', key).maybeSingle()) as Row | null;
    return r ? { result: r.result } : null;
  }
  async usernameTaken(username: string) {
    const rows = check(await this.db.from('players').select('id').ilike('username', username.replace(/[\\%_]/g, '\\$&')).limit(1)) as Row[];
    return rows.length > 0;
  }
  async createPlayer(input: { id: string; username: string; timezone: string; state: PlayerState; habits: Habit[]; profile: ProfileRow }) {
    check(
      await this.db.rpc('create_player', {
        p_player: input.id,
        p_username: input.username,
        p_timezone: input.timezone,
        p_state: input.state,
        p_profile: input.profile,
        p_habits: input.habits,
      }),
    );
  }
  async commit(c: CommitInput) {
    const res = await this.db.rpc('commit_turn', {
      p_player: c.playerId,
      p_expected_version: c.expectedVersion,
      p_state: c.state,
      p_event: c.event ?? null,
      p_habits: c.habits ?? null,
      p_log: c.log ?? null,
      p_profile: c.profile ?? null,
    });
    // A duplicate idempotency key means a concurrent copy of this request already committed;
    // report it as a version conflict so the handler retries and returns the stored result.
    if (res.error && (res.error.code === '23505' || /duplicate key/.test(res.error.message))) throw new Error('version_conflict');
    return check(res) as number;
  }
  async updateTimezone(id: string, timezone: string) {
    check(await this.db.from('players').update({ timezone }).eq('id', id));
  }
  async deleteAccount(id: string) {
    // Cascades from auth.users remove every row the player owns.
    const admin = (this.db as unknown as { auth: { admin: { deleteUser(id: string): Promise<{ error: { message: string } | null }> } } }).auth.admin;
    const { error } = await admin.deleteUser(id);
    if (error) throw new Error(error.message);
  }

  async getPartyOf(playerId: string) {
    const r = check(await this.db.from('party_members').select('parties(*)').eq('player_id', playerId).maybeSingle()) as Row | null;
    return r?.parties ? toParty(r.parties as Row) : null;
  }
  async getPartyByCode(code: string) {
    const r = check(await this.db.from('parties').select('*').eq('code', code).maybeSingle()) as Row | null;
    return r ? toParty(r) : null;
  }
  async createParty(input: { code: string; name: string; leaderId: string }) {
    const r = check(await this.db.from('parties').insert({ code: input.code, name: input.name, leader_id: input.leaderId }).select().single()) as Row;
    return toParty(r);
  }
  async addPartyMember(partyId: string, playerId: string) {
    check(await this.db.from('party_members').insert({ party_id: partyId, player_id: playerId }));
  }
  async removePartyMember(partyId: string, playerId: string) {
    check(await this.db.from('party_members').delete().eq('party_id', partyId).eq('player_id', playerId));
  }
  async partyMembers(partyId: string): Promise<PartyMemberView[]> {
    const rows = check(
      await this.db
        .from('party_members')
        .select('player_id, players(username, level, title, appearance, equipment, momentum_tier, today_progress)')
        .eq('party_id', partyId)
        .order('joined_at'),
    ) as Row[];
    return rows.map((r) => {
      const p = r.players as Row;
      return {
        playerId: r.player_id as string,
        username: p.username as string,
        level: p.level as number,
        title: (p.title as string | null) ?? null,
        appearance: p.appearance as PartyMemberView['appearance'],
        equipment: (p.equipment as Record<string, string>) ?? {},
        momentumTier: p.momentum_tier as string,
        todayProgress: (p.today_progress as PartyMemberView['todayProgress']) ?? null,
      };
    });
  }
  async deleteParty(partyId: string) {
    check(await this.db.from('parties').delete().eq('id', partyId));
  }
  async setPartyLeader(partyId: string, playerId: string) {
    check(await this.db.from('parties').update({ leader_id: playerId }).eq('id', partyId));
  }

  async findOpenLiveSession(kind: LiveSessionRow['kind'], nowIso: string, durationMin: number) {
    const r = check(
      await this.db
        .from('live_sessions')
        .select('*')
        .eq('kind', kind)
        .eq('is_public', true)
        .eq('status', 'open')
        .eq('duration_min', durationMin)
        .gt('starts_at', nowIso)
        .order('starts_at')
        .limit(1)
        .maybeSingle(),
    ) as Row | null;
    return r ? toSession(r) : null;
  }
  async createLiveSession(input: Omit<LiveSessionRow, 'id' | 'status'>) {
    const r = check(
      await this.db
        .from('live_sessions')
        .insert({
          kind: input.kind,
          title: input.title,
          host_id: input.hostId,
          party_id: input.partyId,
          is_public: input.isPublic,
          duration_min: input.durationMin,
          starts_at: input.startsAt,
          ends_at: input.endsAt,
          max_players: input.maxPlayers,
        })
        .select()
        .single(),
    ) as Row;
    return toSession(r);
  }
  async getLiveSession(id: string) {
    const r = check(await this.db.from('live_sessions').select('*').eq('id', id).maybeSingle()) as Row | null;
    return r ? toSession(r) : null;
  }
  async liveParticipants(sessionId: string): Promise<LiveParticipantRow[]> {
    const rows = check(await this.db.from('live_participants').select('*').eq('session_id', sessionId)) as Row[];
    return rows.map((r) => ({ sessionId: r.session_id as string, playerId: r.player_id as string, joinedAt: new Date(r.joined_at as string).toISOString(), rewarded: r.rewarded as boolean }));
  }
  async addLiveParticipant(sessionId: string, playerId: string, joinedAtIso: string) {
    check(
      await this.db
        .from('live_participants')
        .upsert({ session_id: sessionId, player_id: playerId, joined_at: joinedAtIso }, { onConflict: 'session_id,player_id', ignoreDuplicates: true }),
    );
  }
  async removeLiveParticipant(sessionId: string, playerId: string) {
    check(await this.db.from('live_participants').delete().eq('session_id', sessionId).eq('player_id', playerId));
  }
  async claimLiveReward(sessionId: string, playerId: string) {
    const rows = check(
      await this.db.from('live_participants').update({ rewarded: true }).eq('session_id', sessionId).eq('player_id', playerId).eq('rewarded', false).select('player_id'),
    ) as Row[];
    return rows.length > 0;
  }
  async unclaimLiveReward(sessionId: string, playerId: string) {
    check(await this.db.from('live_participants').update({ rewarded: false }).eq('session_id', sessionId).eq('player_id', playerId));
  }
  async setLiveStatus(sessionId: string, status: LiveSessionRow['status']) {
    check(await this.db.from('live_sessions').update({ status }).eq('id', sessionId));
  }
  async listLiveSessions(nowIso: string, partyId: string | null) {
    let q = this.db.from('live_sessions').select('*, live_participants(count)').in('status', ['open', 'running']).gt('ends_at', nowIso).order('starts_at').limit(30);
    q = partyId ? q.or(`is_public.eq.true,party_id.eq.${partyId}`) : q.eq('is_public', true);
    const rows = check(await q) as Row[];
    return rows.map((r) => ({ ...toSession(r), players: ((r.live_participants as { count: number }[] | undefined)?.[0]?.count ?? 0) as number }));
  }
}
