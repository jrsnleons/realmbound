import type { Habit, PlayerState } from '@realmbound/game-engine';
import type { CommitInput, LiveParticipantRow, LiveSessionRow, PartyMemberView, PartyRow, PlayerRow, ProfileRow, Repo } from './types';

/** In-memory Repo for tests and local development. Mirrors the SQL commit semantics. */
export class MemoryRepo implements Repo {
  players = new Map<string, PlayerRow & { profile?: ProfileRow }>();
  states = new Map<string, { version: number; state: PlayerState }>();
  habits = new Map<string, Habit[]>();
  events: (CommitInput['event'] & { playerId: string })[] = [];
  logs: (NonNullable<CommitInput['log']> & { playerId: string })[] = [];
  parties = new Map<string, PartyRow>();
  members = new Map<string, string>(); // playerId -> partyId
  sessions = new Map<string, LiveSessionRow>();
  participants: LiveParticipantRow[] = [];
  private seq = 0;

  private id() {
    this.seq += 1;
    return `00000000-0000-4000-8000-${String(this.seq).padStart(12, '0')}`;
  }

  async getPlayer(id: string) {
    const p = this.players.get(id);
    return p ? { id: p.id, username: p.username, timezone: p.timezone } : null;
  }
  async getState(id: string) {
    const s = this.states.get(id);
    return s ? structuredClone(s) : null;
  }
  async getHabits(id: string) {
    return structuredClone(this.habits.get(id) ?? []);
  }
  async findEvent(playerId: string, key: string) {
    const e = this.events.find((x) => x.playerId === playerId && x.idempotencyKey === key);
    return e ? { result: e.result } : null;
  }
  async usernameTaken(username: string) {
    return [...this.players.values()].some((p) => p.username.toLowerCase() === username.toLowerCase());
  }
  async createPlayer(input: { id: string; username: string; timezone: string; state: PlayerState; habits: Habit[]; profile: ProfileRow }) {
    this.players.set(input.id, { id: input.id, username: input.username, timezone: input.timezone, profile: input.profile });
    this.states.set(input.id, { version: 1, state: structuredClone(input.state) });
    this.habits.set(input.id, structuredClone(input.habits));
  }
  async commit(c: CommitInput) {
    const s = this.states.get(c.playerId);
    if (!s || s.version !== c.expectedVersion) throw new Error('version_conflict');
    if (c.event?.idempotencyKey && this.events.some((e) => e.playerId === c.playerId && e.idempotencyKey === c.event!.idempotencyKey)) {
      throw new Error('duplicate key value violates unique constraint');
    }
    s.version += 1;
    s.state = structuredClone(c.state);
    if (c.event) this.events.push({ ...structuredClone(c.event), playerId: c.playerId });
    if (c.habits) {
      const existing = this.habits.get(c.playerId) ?? [];
      const byId = new Map(existing.map((h) => [h.id, h]));
      for (const h of c.habits) byId.set(h.id, structuredClone(h));
      this.habits.set(c.playerId, [...byId.values()]);
    }
    if (c.log) this.logs.push({ ...c.log, playerId: c.playerId });
    if (c.profile) this.players.get(c.playerId)!.profile = structuredClone(c.profile);
    return s.version;
  }
  async updateTimezone(id: string, timezone: string) {
    const p = this.players.get(id);
    if (p) p.timezone = timezone;
  }
  async deleteAccount(id: string) {
    this.players.delete(id);
    this.states.delete(id);
    this.habits.delete(id);
    this.members.delete(id);
  }

  async getPartyOf(playerId: string) {
    const pid = this.members.get(playerId);
    return pid ? (this.parties.get(pid) ?? null) : null;
  }
  async getPartyByCode(code: string) {
    return [...this.parties.values()].find((p) => p.code === code) ?? null;
  }
  async createParty(input: { code: string; name: string; leaderId: string }) {
    const party: PartyRow = { id: this.id(), code: input.code, name: input.name, leaderId: input.leaderId, maxMembers: 6 };
    this.parties.set(party.id, party);
    return party;
  }
  async addPartyMember(partyId: string, playerId: string) {
    this.members.set(playerId, partyId);
  }
  async removePartyMember(_partyId: string, playerId: string) {
    this.members.delete(playerId);
  }
  async partyMembers(partyId: string): Promise<PartyMemberView[]> {
    return [...this.members.entries()]
      .filter(([, p]) => p === partyId)
      .map(([playerId]) => {
        const p = this.players.get(playerId)!;
        return {
          playerId,
          username: p.username,
          level: p.profile?.level ?? 1,
          title: p.profile?.title,
          appearance: p.profile!.appearance,
          equipment: (p.profile?.equipment ?? {}) as Record<string, string>,
          momentumTier: p.profile?.momentumTier ?? 'normal',
          todayProgress: p.profile?.todayProgress,
        };
      });
  }
  async deleteParty(partyId: string) {
    this.parties.delete(partyId);
  }
  async setPartyLeader(partyId: string, playerId: string) {
    const p = this.parties.get(partyId);
    if (p) p.leaderId = playerId;
  }

  async findOpenLiveSession(kind: LiveSessionRow['kind'], nowIso: string, durationMin: number) {
    return [...this.sessions.values()].find((s) => s.kind === kind && s.isPublic && s.status === 'open' && s.durationMin === durationMin && s.startsAt > nowIso) ?? null;
  }
  async createLiveSession(input: Omit<LiveSessionRow, 'id' | 'status'>) {
    const s: LiveSessionRow = { ...input, id: this.id(), status: 'open' };
    this.sessions.set(s.id, s);
    return s;
  }
  async getLiveSession(id: string) {
    return this.sessions.get(id) ?? null;
  }
  async liveParticipants(sessionId: string) {
    return this.participants.filter((p) => p.sessionId === sessionId);
  }
  async addLiveParticipant(sessionId: string, playerId: string, joinedAtIso: string) {
    if (!this.participants.some((p) => p.sessionId === sessionId && p.playerId === playerId)) {
      this.participants.push({ sessionId, playerId, joinedAt: joinedAtIso, rewarded: false });
    }
  }
  async removeLiveParticipant(sessionId: string, playerId: string) {
    this.participants = this.participants.filter((p) => !(p.sessionId === sessionId && p.playerId === playerId));
  }
  async claimLiveReward(sessionId: string, playerId: string) {
    const p = this.participants.find((x) => x.sessionId === sessionId && x.playerId === playerId);
    if (!p || p.rewarded) return false;
    p.rewarded = true;
    return true;
  }
  async unclaimLiveReward(sessionId: string, playerId: string) {
    const p = this.participants.find((x) => x.sessionId === sessionId && x.playerId === playerId);
    if (p) p.rewarded = false;
  }
  async setLiveStatus(sessionId: string, status: LiveSessionRow['status']) {
    const s = this.sessions.get(sessionId);
    if (s) s.status = status;
  }
  async listLiveSessions(nowIso: string, partyId: string | null) {
    return [...this.sessions.values()]
      .filter((s) => (s.status === 'open' || s.status === 'running') && s.endsAt > nowIso && (s.isPublic || s.partyId === partyId))
      .map((s) => ({ ...s, players: this.participants.filter((p) => p.sessionId === s.id).length }));
  }
}
