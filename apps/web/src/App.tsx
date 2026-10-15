'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { haptic } from '@/lib/feedback';
import { store } from '@/lib/storage';
import { Auth, Welcome } from '@/screens/Auth';
import { HeroScreen } from '@/screens/Hero';
import { Onboarding } from '@/screens/Onboarding';
import { PartyScreen } from '@/screens/Party';
import { QuestsScreen } from '@/screens/Quests';
import { TodayScreen } from '@/screens/Today';
import { GameProvider, useGame } from '@/state/game';
import { Icon } from '@/ui/icons';
import { Celebrations, Toasts } from '@/ui/Overlays';
import { cx, Spinner } from '@/ui/primitives';

// Phaser touches `window` at import time, so the World loads only in the browser, on demand.
const WorldScreen = dynamic(() => import('@/screens/World').then((m) => m.WorldScreen), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-label2">
      <Spinner />
    </div>
  ),
});

export type Tab = 'today' | 'quests' | 'hero' | 'world' | 'party';

const TABS: { id: Tab; label: string; icon: (p: { size?: number; strokeWidth?: number }) => React.ReactNode }[] = [
  { id: 'today', label: 'Today', icon: Icon.Sun },
  { id: 'quests', label: 'Quests', icon: Icon.Scroll },
  { id: 'hero', label: 'Hero', icon: Icon.Person },
  { id: 'world', label: 'World', icon: Icon.Map },
  { id: 'party', label: 'Party', icon: Icon.People },
];

export function App() {
  return (
    <GameProvider>
      <Shell />
    </GameProvider>
  );
}

function Shell() {
  const { phase } = useGame();

  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }
    document.documentElement.dataset.reducedMotion = store.get('rb-reduced-motion') === 'on' ? 'true' : 'false';
  }, []);

  return (
    <>
      {phase === 'loading' && <Splash />}
      {phase === 'welcome' && <Welcome />}
      {phase === 'auth' && <Auth />}
      {phase === 'onboarding' && <Onboarding />}
      {phase === 'ready' && <Main />}
      <Toasts />
      <Celebrations />
    </>
  );
}

function Splash() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-bg">
      <div className="font-rounded text-title2 tracking-tight">Realmbound</div>
      <Spinner />
    </div>
  );
}

function Main() {
  const [tab, setTab] = useState<Tab>(() => (store.get('rb-tab') as Tab | null) ?? 'today');
  const [visited, setVisited] = useState<Set<Tab>>(() => new Set([tab]));

  const go = (t: Tab) => {
    haptic();
    setTab(t);
    store.set('rb-tab', t);
    setVisited((v) => (v.has(t) ? v : new Set([...v, t])));
  };

  return (
    <div className="fixed inset-0 overflow-hidden bg-bg">
      {/* Tabs stay mounted after first visit so scroll position is kept, like UITabBarController. The World unmounts to free the GPU. */}
      {TABS.map(({ id }) =>
        id === 'world' ? (
          tab === 'world' && (
            <div key={id} className="absolute inset-0">
              <WorldScreen />
            </div>
          )
        ) : (
          visited.has(id) && (
            <div key={id} className={cx('absolute inset-0', tab !== id && 'invisible')} aria-hidden={tab !== id}>
              {id === 'today' && <TodayScreen go={go} />}
              {id === 'quests' && <QuestsScreen />}
              {id === 'hero' && <HeroScreen />}
              {id === 'party' && <PartyScreen />}
            </div>
          )
        ),
      )}
      <nav className="fixed inset-x-0 bottom-0 z-40 material hairline-t" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="mx-auto flex h-[50px] max-w-2xl">
          {TABS.map(({ id, label, icon: TabIcon }) => (
            <button key={id} onClick={() => go(id)} aria-current={tab === id ? 'page' : undefined} className={cx('flex flex-1 flex-col items-center justify-center gap-0.5 pt-1', tab === id ? 'text-tint' : 'text-igray')}>
              <TabIcon size={25} strokeWidth={tab === id ? 2.2 : 1.8} />
              <span className="text-[10px] font-medium leading-3">{label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
