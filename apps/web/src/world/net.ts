import { EMOTES, PRESET_PHRASES } from '@realmbound/content';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { ZoneKey } from './maps';

export interface PeerInfo {
  id: string;
  name: string;
  /** Pixel appearance (public profile only). */
  look: unknown;
  x: number;
  y: number;
}

export interface NetEvents {
  onPeers(peers: PeerInfo[]): void;
  onMove(id: string, path: [number, number][]): void;
  onEmote(id: string, emote: string): void;
  onPhrase(id: string, text: string): void;
  onPlace(id: string, x: number, y: number): void;
}

export interface WorldNet {
  move(path: [number, number][]): void;
  emote(index: number): void;
  phrase(index: number): void;
  place(x: number, y: number): void;
  leave(): void;
}

const SHARD_CAP = 18;
const MAX_SHARDS = 12;
const MAX_PATH = 64;

const inRange = (n: unknown, max: number): n is number => Number.isInteger(n) && (n as number) >= 0 && (n as number) < max;

/**
 * Tap-to-move lobby on Supabase Realtime: one broadcast per move (the whole path), Presence only
 * for join/leave. Each town copy (shard) holds up to SHARD_CAP players; when one is full the client
 * moves on to the next shard. Chat is preset phrases only, sent as indexes.
 */
export function joinZone(zone: ZoneKey, me: PeerInfo, ev: NetEvents): WorldNet {
  let channel: RealtimeChannel | null = null;
  let shard = 0;
  let closed = false;
  let pos = { x: me.x, y: me.y };

  const connect = () => {
    if (closed) return;
    const ch = supabase().channel(`zone:${zone}:${shard}`, { config: { broadcast: { self: false }, presence: { key: me.id } } });
    channel = ch;
    let decided = false;

    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState<PeerInfo>();
      const peers = Object.entries(state)
        .filter(([k]) => k !== me.id)
        .map(([, metas]) => metas[0])
        .filter((p): p is PeerInfo & { presence_ref: string } => Boolean(p));
      if (!decided) {
        decided = true;
        if (peers.length >= SHARD_CAP && shard < MAX_SHARDS) {
          shard += 1;
          void ch.unsubscribe();
          connect();
          return;
        }
      }
      ev.onPeers(peers.map(({ id, name, look, x, y }) => ({ id, name, look, x, y })));
    });
    ch.on('presence', { event: 'join' }, ({ key }) => {
      // Tell newcomers where we are now (presence keeps the join position only).
      if (key !== me.id) void ch.send({ type: 'broadcast', event: 'at', payload: { id: me.id, x: pos.x, y: pos.y } });
    });
    ch.on('broadcast', { event: 'mv' }, ({ payload }) => {
      const p = payload as { id?: string; p?: unknown };
      if (typeof p.id !== 'string' || !Array.isArray(p.p)) return;
      const path = (p.p as unknown[]).slice(0, MAX_PATH).filter((s): s is [number, number] => Array.isArray(s) && inRange(s[0], 200) && inRange(s[1], 200));
      ev.onMove(p.id, path);
    });
    ch.on('broadcast', { event: 'at' }, ({ payload }) => {
      const p = payload as { id?: string; x?: unknown; y?: unknown };
      if (typeof p.id === 'string' && inRange(p.x, 200) && inRange(p.y, 200)) ev.onPlace(p.id, p.x, p.y);
    });
    ch.on('broadcast', { event: 'em' }, ({ payload }) => {
      const p = payload as { id?: string; i?: unknown };
      if (typeof p.id === 'string' && inRange(p.i, EMOTES.length)) ev.onEmote(p.id, EMOTES[p.i]!);
    });
    ch.on('broadcast', { event: 'ph' }, ({ payload }) => {
      const p = payload as { id?: string; i?: unknown };
      if (typeof p.id === 'string' && inRange(p.i, PRESET_PHRASES.length)) ev.onPhrase(p.id, PRESET_PHRASES[p.i]!);
    });
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') void ch.track({ ...me, x: pos.x, y: pos.y });
    });
  };

  connect();

  const send = (event: string, payload: Record<string, unknown>) => {
    if (channel) void channel.send({ type: 'broadcast', event, payload: { id: me.id, ...payload } });
  };

  return {
    move(path) {
      const last = path[path.length - 1];
      if (last) pos = { x: last[0], y: last[1] };
      send('mv', { p: path.slice(0, MAX_PATH) });
    },
    emote: (i) => send('em', { i }),
    phrase: (i) => send('ph', { i }),
    place(x, y) {
      pos = { x, y };
    },
    leave() {
      closed = true;
      if (channel) void supabase().removeChannel(channel);
      channel = null;
    },
  };
}
