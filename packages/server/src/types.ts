import type { Appearance, Classification, Habit, HabitInput, PlayerState, PublicProfile } from '@realmbound/game-engine';

export interface PlayerRow {
  id: string;
  username: string;
  timezone: string;
}

export interface LogRow {
  habitId?: string;
  kind: 'log' | 'checkin' | 'sleep' | 'live';
  status: string;
  date: string;
  hour: number;
  felt?: string;
  durationMin?: number;
  value?: number;
  verification?: 'self' | 'passive' | 'social';
}

export interface EventRow {
  type: string;
  date: string;
  payload: Record<string, unknown>;
  reward?: unknown;
  result?: unknown;
  idempotencyKey?: string;
  engineVersion: number;
}

export interface ProfileRow extends PublicProfile {
  todayProgress: { date: string; done: number; scheduled: number };
}

export interface CommitInput {
  playerId: string;
  expectedVersion: number;
  state: PlayerState;
  event?: EventRow;
  habits?: Habit[];
  log?: LogRow;
  profile?: ProfileRow;
}

export interface PartyRow {
  id: string;
  code: string;
  name: string;
  leaderId: string;
  maxMembers: number;
}

export interface PartyMemberView {
  playerId: string;
  username: string;
  level: number;
  title?: string | null;
  appearance: Appearance;
  equipment: Record<string, string>;
  momentumTier: string;
  todayProgress?: { date: string; done: number; scheduled: number } | null;
}

export interface LiveSessionRow {
  id: string;
  kind: 'focus' | 'walk' | 'clean' | 'stretch' | 'plan';
  title: string;
  hostId: string;
  partyId: string | null;
  isPublic: boolean;
  durationMin: number;
  status: 'open' | 'running' | 'finished' | 'cancelled';
  startsAt: string;
  endsAt: string;
  maxPlayers: number;
}

export interface LiveParticipantRow {
  sessionId: string;
  playerId: string;
  joinedAt: string;
  rewarded: boolean;
}

/** Storage used by the game server. Implemented with supabase-js in the Edge Function and in memory for tests. */
export interface Repo {
  getPlayer(id: string): Promise<PlayerRow | null>;
  getState(id: string): Promise<{ version: number; state: PlayerState } | null>;
  getHabits(id: string): Promise<Habit[]>;
  findEvent(playerId: string, idempotencyKey: string): Promise<{ result: unknown } | null>;
  usernameTaken(username: string): Promise<boolean>;
  createPlayer(input: { id: string; username: string; timezone: string; state: PlayerState; habits: Habit[]; profile: ProfileRow }): Promise<void>;
  commit(input: CommitInput): Promise<number>;
  updateTimezone(id: string, timezone: string): Promise<void>;
  deleteAccount(id: string): Promise<void>;

  getPartyOf(playerId: string): Promise<PartyRow | null>;
  getPartyByCode(code: string): Promise<PartyRow | null>;
  createParty(input: { code: string; name: string; leaderId: string }): Promise<PartyRow>;
  addPartyMember(partyId: string, playerId: string): Promise<void>;
  removePartyMember(partyId: string, playerId: string): Promise<void>;
  partyMembers(partyId: string): Promise<PartyMemberView[]>;
  deleteParty(partyId: string): Promise<void>;
  setPartyLeader(partyId: string, playerId: string): Promise<void>;

  findOpenLiveSession(kind: LiveSessionRow['kind'], nowIso: string, durationMin: number): Promise<LiveSessionRow | null>;
  createLiveSession(input: Omit<LiveSessionRow, 'id' | 'status'>): Promise<LiveSessionRow>;
  getLiveSession(id: string): Promise<LiveSessionRow | null>;
  liveParticipants(sessionId: string): Promise<LiveParticipantRow[]>;
  addLiveParticipant(sessionId: string, playerId: string, joinedAtIso: string): Promise<void>;
  removeLiveParticipant(sessionId: string, playerId: string): Promise<void>;
  /** Atomically flips rewarded=false→true; returns false if it was already rewarded. */
  claimLiveReward(sessionId: string, playerId: string): Promise<boolean>;
  unclaimLiveReward(sessionId: string, playerId: string): Promise<void>;
  setLiveStatus(sessionId: string, status: LiveSessionRow['status']): Promise<void>;
  listLiveSessions(nowIso: string, partyId: string | null): Promise<(LiveSessionRow & { players: number })[]>;
}

/** Optional AI helpers. Every one has a rule-based fallback, so the game works without them. */
export interface AiAdapters {
  classify?(name: string): Promise<Classification | undefined>;
  similarity?(a: string, b: string[]): Promise<number[] | undefined>;
  narrate?(prompt: { kind: 'chronicle' | 'graduation' | 'weekly'; facts: string[] }): Promise<string | undefined>;
}

export type { HabitInput };
