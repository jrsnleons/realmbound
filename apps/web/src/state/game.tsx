'use client';

import type { FeedItem } from '@realmbound/game-engine';
import type { View } from '@realmbound/server';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { localClient, remoteClient, type GameClient, type GameResponse } from '@/lib/client';
import { HAS_BACKEND } from '@/lib/config';
import { store } from '@/lib/storage';
import { supabase } from '@/lib/supabase';

export type Phase = 'loading' | 'welcome' | 'auth' | 'onboarding' | 'ready';

export interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'error' | 'success';
}

interface GameCtx {
  phase: Phase;
  mode: 'remote' | 'local' | null;
  view: View | null;
  /** Feed items waiting to be celebrated (level ups, loot…), oldest first. */
  notices: FeedItem[];
  dismissNotice(): void;
  toasts: Toast[];
  toast(text: string, tone?: Toast['tone']): void;
  call(action: string, payload?: Record<string, unknown>, opts?: { idempotent?: boolean; quiet?: boolean }): Promise<GameResponse>;
  chooseLocal(): void;
  chooseRemote(): void;
  refresh(): Promise<void>;
  signOut(): Promise<void>;
  userId: string | null;
}

const Ctx = createContext<GameCtx | null>(null);

export function useGame(): GameCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useGame outside GameProvider');
  return c;
}

/** A view that is guaranteed to exist (screens inside the main app). */
export function useView(): View {
  const v = useGame().view;
  if (!v) throw new Error('No view yet');
  return v;
}

const MODE_KEY = 'rb-mode';
let toastSeq = 0;

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [mode, setMode] = useState<'remote' | 'local' | null>(null);
  const [view, setView] = useState<View | null>(null);
  const [notices, setNotices] = useState<FeedItem[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const client = useRef<GameClient | null>(null);

  const toast = useCallback((text: string, tone: Toast['tone'] = 'info') => {
    const id = ++toastSeq;
    setToasts((t) => [...t.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 4200 : 2800);
  }, []);

  const absorb = useCallback((res: GameResponse) => {
    if (!res.ok) return;
    if (res.needsOnboarding) {
      setView(null);
      setPhase('onboarding');
      return;
    }
    if (res.view) {
      setView(res.view);
      if (res.view.feed.length) setNotices((n) => [...n, ...res.view!.feed]);
      setPhase('ready');
    }
  }, []);

  const call = useCallback<GameCtx['call']>(
    async (action, payload, opts) => {
      const c = client.current;
      if (!c) return { ok: false, code: 'no_client', message: 'Not ready yet.' };
      const key = opts?.idempotent ? crypto.randomUUID() : undefined;
      const res = await c.call(action, payload, key);
      if (!res.ok) {
        if (res.code === 'unauthorized' && c.mode === 'remote') {
          setPhase('auth');
          return res;
        }
        if (!opts?.quiet) toast(res.message, 'error');
        return res;
      }
      absorb(res);
      return res;
    },
    [absorb, toast],
  );

  const boot = useCallback(
    async (m: 'remote' | 'local') => {
      client.current = m === 'local' ? localClient() : remoteClient();
      setMode(m);
      store.set(MODE_KEY, m);
      const id = await client.current.userId();
      setUserId(id);
      if (!id) {
        setPhase('auth');
        return;
      }
      setPhase('loading');
      const res = await client.current.call('me');
      if (!res.ok) {
        if (res.code === 'unauthorized') setPhase('auth');
        else {
          toast(res.message, 'error');
          setPhase(view ? 'ready' : 'auth');
        }
        return;
      }
      absorb(res);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [absorb, toast],
  );

  useEffect(() => {
    const saved = store.get(MODE_KEY) as 'remote' | 'local' | null;
    if (saved === 'local' || (saved === 'remote' && HAS_BACKEND)) void boot(saved);
    else setPhase('welcome');
  }, [boot]);

  // Re-sync when a session appears or ends (remote mode).
  useEffect(() => {
    if (mode !== 'remote') return;
    const { data } = supabase().auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') void boot('remote');
      if (event === 'SIGNED_OUT') {
        setView(null);
        setPhase('auth');
      }
    });
    return () => data.subscription.unsubscribe();
  }, [mode, boot]);

  // Day rollover: refresh when the app comes back to the foreground.
  useEffect(() => {
    if (phase !== 'ready') return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') void call('me', undefined, { quiet: true });
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [phase, call]);

  const value = useMemo<GameCtx>(
    () => ({
      phase,
      mode,
      view,
      notices,
      dismissNotice: () => setNotices((n) => n.slice(1)),
      toasts,
      toast,
      call,
      chooseLocal: () => void boot('local'),
      chooseRemote: () => {
        setMode('remote');
        client.current = remoteClient();
        store.set(MODE_KEY, 'remote');
        void boot('remote');
      },
      refresh: async () => {
        await call('me', undefined, { quiet: true });
      },
      signOut: async () => {
        if (mode === 'remote') await supabase().auth.signOut();
        store.remove(MODE_KEY);
        client.current = null;
        setView(null);
        setMode(null);
        setPhase('welcome');
      },
      userId,
    }),
    [phase, mode, view, notices, toasts, toast, call, boot, userId],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
