'use client';

import { DEFAULT_APPEARANCE } from '@realmbound/pixel';
import { useState } from 'react';
import { HAS_BACKEND } from '@/lib/config';
import { supabase } from '@/lib/supabase';
import { useGame } from '@/state/game';
import { Icon } from '@/ui/icons';
import { Button, Section, Segmented, TextField } from '@/ui/primitives';
import { HeroSprite } from '@/ui/Sprite';

let initialAuthTab: 'signUp' | 'signIn' = 'signUp';

const WELCOME_LOOK = { ...DEFAULT_APPEARANCE, equipment: { head: 'traveler_head', chest: 'traveler_chest', weapon: 'traveler_weapon' } } as typeof DEFAULT_APPEARANCE;

export function Welcome() {
  const { chooseLocal, chooseRemote } = useGame();
  return (
    <div className="fixed inset-0 overflow-y-auto bg-bg" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="mx-auto flex min-h-full max-w-md flex-col px-6 pb-6">
        <div className="relative mt-4 flex h-44 items-end justify-center overflow-hidden rounded-[28px]" style={{ background: 'linear-gradient(180deg, #8ec5ff 0%, #c9e7ff 55%, #9ad17e 55%, #6fb35a 100%)' }}>
          <div className="absolute left-8 top-8 h-10 w-20 rounded-full bg-white/70 blur-[1px]" />
          <div className="absolute right-10 top-14 h-7 w-14 rounded-full bg-white/60 blur-[1px]" />
          <div className="mb-4">
            <HeroSprite appearance={WELCOME_LOOK} anim="walk" scale={4} />
          </div>
        </div>
        <h1 className="mt-6 text-center font-rounded text-large-title">Realmbound</h1>
        <p className="mt-2 text-center text-body text-label2">Your real-life habits power a pixel hero.</p>

        <div className="mt-6 space-y-4">
          {[
            { icon: <Icon.Check size={22} strokeWidth={2.5} />, color: 'var(--green)', title: 'Log habits, earn XP', body: 'Walks, sleep, study and resisting temptation all grow your hero.' },
            { icon: <Icon.Scroll size={22} />, color: 'var(--orange)', title: 'Quests that fit your life', body: 'The first 14 days learn your rhythm, then quests adapt to it.' },
            { icon: <Icon.People size={22} />, color: 'var(--blue)', title: 'Better together', body: 'Join a party and do live focus or walk quests with friends.' },
          ].map((f) => (
            <div key={f.title} className="flex gap-4">
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] text-white" style={{ background: f.color }}>
                {f.icon}
              </span>
              <div>
                <div className="text-headline">{f.title}</div>
                <div className="text-subhead text-label2">{f.body}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-auto flex flex-col gap-1 pt-6">
          {HAS_BACKEND && (
            <>
              <Button
                onClick={() => {
                  initialAuthTab = 'signUp';
                  chooseRemote();
                }}
              >
                Get Started
              </Button>
              <Button
                variant="plain"
                onClick={() => {
                  initialAuthTab = 'signIn';
                  chooseRemote();
                }}
              >
                I already have an account
              </Button>
            </>
          )}
          <Button variant={HAS_BACKEND ? 'plain' : 'filled'} onClick={chooseLocal} color={HAS_BACKEND ? 'var(--label2)' : undefined}>
            {HAS_BACKEND ? 'Try it offline first' : 'Start playing'}
          </Button>
          {HAS_BACKEND && <p className="text-center text-caption text-label3">Offline play stays on this device. Parties and the shared town need an account.</p>}
        </div>
      </div>
    </div>
  );
}

export function Auth() {
  const { signOut } = useGame();
  const [tab, setTab] = useState<'signUp' | 'signIn'>(initialAuthTab);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const valid = /.+@.+\..+/.test(email) && password.length >= 8;

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    const auth = supabase().auth;
    if (tab === 'signUp') {
      const { data, error: err } = await auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
      if (err) setError(err.message);
      else if (!data.session) setInfo('Check your email to confirm your account, then sign in here.');
    } else {
      const { error: err } = await auth.signInWithPassword({ email, password });
      if (err) setError(err.message === 'Invalid login credentials' ? 'That email and password do not match.' : err.message);
    }
    setBusy(false);
  };

  const reset = async () => {
    if (!/.+@.+\..+/.test(email)) {
      setError('Enter your email first.');
      return;
    }
    await supabase().auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    setInfo('If that email has an account, a reset link is on its way.');
  };

  return (
    <div className="fixed inset-0 overflow-y-auto bg-bg" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="mx-auto max-w-md px-4 pb-10">
        <div className="flex h-11 items-center">
          <button onClick={() => void signOut()} className="pressable -ml-2 flex items-center text-body text-tint">
            <Icon.ChevronLeft size={24} strokeWidth={2.5} />
            Back
          </button>
        </div>
        <h1 className="mt-2 text-large-title">{tab === 'signUp' ? 'Create account' : 'Welcome back'}</h1>
        <p className="mb-6 mt-1 text-subhead text-label2">{tab === 'signUp' ? 'Your hero is saved to your account and works on any device.' : 'Sign in to continue your adventure.'}</p>
        <Segmented
          className="mb-6"
          value={tab}
          onChange={(v) => {
            setTab(v);
            setError(null);
            setInfo(null);
          }}
          options={[
            { value: 'signUp', label: 'Create Account' },
            { value: 'signIn', label: 'Sign In' },
          ]}
        />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <Section footer={tab === 'signUp' ? 'Use at least 8 characters for your password.' : undefined}>
            <TextField value={email} onChange={setEmail} placeholder="Email" type="email" autoComplete="email" inputMode="email" />
            <div className="ml-4 h-px bg-sep" />
            <TextField value={password} onChange={setPassword} placeholder="Password" type="password" autoComplete={tab === 'signUp' ? 'new-password' : 'current-password'} onSubmit={() => void submit()} />
          </Section>
          {error && <p className="-mt-4 mb-4 px-4 text-footnote text-ired">{error}</p>}
          {info && <p className="-mt-4 mb-4 px-4 text-footnote text-igreen">{info}</p>}
          <Button type="submit" disabled={!valid} loading={busy} className="w-full">
            {tab === 'signUp' ? 'Create Account' : 'Sign In'}
          </Button>
        </form>
        {tab === 'signIn' && (
          <Button variant="plain" onClick={() => void reset()} className="mt-2 w-full">
            Forgot password?
          </Button>
        )}
      </div>
    </div>
  );
}
