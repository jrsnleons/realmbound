import { handle, MemoryRepo, type Response as GameResponse } from '@realmbound/server';
import { SUPABASE_KEY, SUPABASE_URL } from './config';
import { store } from './storage';
import { supabase } from './supabase';

export type { GameResponse };

export interface GameClient {
  mode: 'remote' | 'local';
  userId(): Promise<string | null>;
  call(action: string, payload?: Record<string, unknown>, idempotencyKey?: string): Promise<GameResponse>;
}

const NETWORK_ERROR: GameResponse = { ok: false, code: 'network', message: "Can't reach the realm. Check your connection and try again." };

export function remoteClient(): GameClient {
  return {
    mode: 'remote',
    async userId() {
      const { data } = await supabase().auth.getSession();
      return data.session?.user.id ?? null;
    },
    async call(action, payload, idempotencyKey) {
      const { data } = await supabase().auth.getSession();
      const token = data.session?.access_token;
      if (!token) return { ok: false, code: 'unauthorized', message: 'Please sign in again.' };
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await fetch(`${SUPABASE_URL}/functions/v1/game`, {
            method: 'POST',
            headers: { authorization: `Bearer ${token}`, apikey: SUPABASE_KEY, 'content-type': 'application/json' },
            body: JSON.stringify({ action, payload, idempotencyKey }),
          });
          if (res.status >= 500 && attempt < 2 && idempotencyKey) continue;
          return (await res.json()) as GameResponse;
        } catch {
          // Only retry when the server can de-duplicate the request.
          if (!idempotencyKey || attempt === 2) return NETWORK_ERROR;
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        }
      }
      return NETWORK_ERROR;
    },
  };
}

/* ─── Local mode: the real game server running in the browser, saved to localStorage ─── */

const LOCAL_KEY = 'rb-local-world';
const LOCAL_USER = '00000000-0000-4000-8000-00000000c0de';
const DAY_OFFSET_KEY = 'rb-local-day-offset';

type Saved = {
  players: [string, unknown][];
  states: [string, unknown][];
  habits: [string, unknown][];
  events: unknown[];
};

function loadRepo(): MemoryRepo {
  const repo = new MemoryRepo();
  const saved = store.json<Saved | null>(LOCAL_KEY, null);
  if (saved) {
    repo.players = new Map(saved.players as [string, never][]);
    repo.states = new Map(saved.states as [string, never][]);
    repo.habits = new Map(saved.habits as [string, never][]);
    repo.events = saved.events as never[];
  }
  return repo;
}

function saveRepo(repo: MemoryRepo) {
  const saved: Saved = {
    players: [...repo.players],
    states: [...repo.states],
    habits: [...repo.habits],
    // Recent events are enough for idempotency; logs are not needed offline.
    events: repo.events.slice(-150),
  };
  store.set(LOCAL_KEY, JSON.stringify(saved));
}

export function localDayOffset(): number {
  return Number(store.get(DAY_OFFSET_KEY) ?? 0) || 0;
}

/** Local mode only: moves the clock forward a day so rollover, quests and bosses can be tried. */
export function advanceLocalDay() {
  store.set(DAY_OFFSET_KEY, String(localDayOffset() + 1));
}

export function resetLocalWorld() {
  store.remove(LOCAL_KEY);
  store.remove(DAY_OFFSET_KEY);
}

export function localClient(): GameClient {
  const repo = loadRepo();
  return {
    mode: 'local',
    async userId() {
      return LOCAL_USER;
    },
    async call(action, payload, idempotencyKey) {
      const now = () => new Date(Date.now() + localDayOffset() * 86_400_000);
      const res = await handle({ repo, now }, LOCAL_USER, { action, payload, idempotencyKey });
      if (action === 'deleteAccount' && res.ok) resetLocalWorld();
      else saveRepo(repo);
      return res;
    },
  };
}
