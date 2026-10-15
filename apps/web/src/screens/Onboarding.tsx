'use client';

import { CATEGORY_INFO, HABIT_SUGGESTIONS, STAT_INFO } from '@realmbound/content';
import { classifyHabit } from '@realmbound/game-engine';
import { HAIR_COLORS, HAIR_STYLE_NAMES, SKIN_TONES, toHex, type Direction } from '@realmbound/pixel';
import { useMemo, useState } from 'react';
import { haptic, sfx } from '@/lib/feedback';
import { categoryColor, categoryEmoji, daysLabel, WEEKDAY_SHORT } from '@/lib/game';
import { pixelAppearance, portraitUrl } from '@/lib/sprites';
import { useGame } from '@/state/game';
import { Icon } from '@/ui/icons';
import { Button, Chip, cx, Section, Segmented, Stepper, TextField } from '@/ui/primitives';
import { HeroSprite } from '@/ui/Sprite';

export type Look = { bodyTier: 1 | 2 | 3; skinTone: number; hairStyle: number; hairColor: number; face: number };
type Pick = { name: string; days: number[]; kind?: 'do' | 'avoid' };

const STEPS = ['intro', 'name', 'look', 'habits', 'sleep', 'ready'] as const;
const STARTER_GEAR = { head: 'traveler_head', chest: 'traveler_chest', weapon: 'traveler_weapon' };

export function Onboarding() {
  const { call, signOut, mode } = useGame();
  const [step, setStep] = useState(0);
  const [username, setUsername] = useState('');
  const [look, setLook] = useState<Look>({ bodyTier: 2, skinTone: 1, hairStyle: 0, hairColor: 2, face: 0 });
  const [picks, setPicks] = useState<Pick[]>([]);
  const [sleepGoal, setSleepGoal] = useState(7.5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const name = STEPS[step]!;
  const nameOk = /^[A-Za-z0-9_]{3,20}$/.test(username);
  const canNext = name === 'name' ? nameOk : name === 'habits' ? picks.length >= 1 : true;

  const next = async () => {
    haptic();
    if (name !== 'ready') {
      setStep((s) => s + 1);
      return;
    }
    setBusy(true);
    setError(null);
    const res = await call(
      'createPlayer',
      {
        username,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        appearance: { ...look, bodyMode: 'custom' },
        habits: picks.map((p) => ({ name: p.name, days: p.days })),
        sleepGoalHours: sleepGoal,
      },
      { quiet: true },
    );
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      if (res.code === 'username_taken' || res.code === 'bad_username') setStep(1);
    } else sfx.levelUp();
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-bg" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="mx-auto flex w-full max-w-md items-center gap-3 px-4 pt-2">
        <button
          aria-label="Back"
          onClick={() => (step === 0 ? void signOut() : setStep((s) => s - 1))}
          className={cx('pressable -ml-2 flex h-11 w-11 items-center justify-center text-tint', step === 0 && mode === 'local' && 'invisible')}
        >
          <Icon.ChevronLeft size={26} strokeWidth={2.5} />
        </button>
        <div className="flex flex-1 gap-1.5">
          {STEPS.map((s, i) => (
            <span key={s} className="h-1 flex-1 rounded-full transition-colors duration-300" style={{ background: i <= step ? 'var(--tint)' : 'var(--fill)' }} />
          ))}
        </div>
        <span className="w-9" />
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div key={name} className="animate-pop mx-auto max-w-md px-5 pb-8 pt-4">
          {name === 'intro' && <Intro />}
          {name === 'name' && (
            <>
              <StepTitle title="What should the Guild call you?" body="Other players see this name in town and in parties." />
              <Section footer={username && !nameOk ? 'Use 3–20 letters, numbers or underscores.' : 'You can play under any name you like.'}>
                <TextField value={username} onChange={(v) => setUsername(v.replace(/\s/g, '_'))} placeholder="Hero name" maxLength={20} autoFocus onSubmit={() => nameOk && void next()} />
              </Section>
              {error && <p className="-mt-4 px-4 text-footnote text-ired">{error}</p>}
            </>
          )}
          {name === 'look' && <LookStep look={look} setLook={setLook} />}
          {name === 'habits' && <HabitsStep picks={picks} setPicks={setPicks} />}
          {name === 'sleep' && (
            <>
              <StepTitle title="How much sleep do you aim for?" body="Meeting your sleep goal powers Recovery and lifts Fatigue. Log it each morning." />
              <Section footer="Pick a goal that is realistic for you right now. You can change it later.">
                <div className="flex items-center justify-between py-2 pl-4 pr-3">
                  <span className="flex items-center gap-3 text-body">
                    <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[7px] text-white" style={{ background: 'var(--indigo)' }}>
                      <Icon.Moon size={18} />
                    </span>
                    Sleep goal
                  </span>
                  <Stepper value={sleepGoal} onChange={setSleepGoal} min={4} max={12} step={0.5} format={(v) => `${v} h`} />
                </div>
              </Section>
            </>
          )}
          {name === 'ready' && <Ready username={username} look={look} picks={picks} error={error} />}
        </div>
      </div>

      <div className="mx-auto w-full max-w-md px-5 pb-4 pt-2">
        <Button onClick={() => void next()} disabled={!canNext} loading={busy} className="w-full">
          {name === 'intro' ? 'Begin' : name === 'ready' ? 'Enter Riverstone' : 'Continue'}
        </Button>
      </div>
    </div>
  );
}

function StepTitle({ title, body }: { title: string; body?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-title1">{title}</h1>
      {body && <p className="mt-2 text-body text-label2">{body}</p>}
    </div>
  );
}

function Intro() {
  return (
    <div className="pt-6">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-[22px] text-[44px]" style={{ background: 'color-mix(in srgb, var(--orange) 18%, transparent)' }}>
        📜
      </div>
      <h1 className="text-center text-title1">A new name in the ledger</h1>
      <p className="mt-3 text-center text-body text-label2">
        &ldquo;Welcome to Riverstone, traveler. Every walk you take, every page you read, every temptation you resist makes you stronger here too.&rdquo;
      </p>
      <p className="mt-2 text-center text-footnote text-label3">Guild Registrar Mae</p>
      <div className="mt-8 rounded-card bg-card p-4">
        <div className="text-headline">Your first 14 days</div>
        <p className="mt-1 text-subhead text-label2">The Initiation learns your rhythm. Log what you can. There is no way to fail it, and the game gets smarter about you each day.</p>
      </div>
    </div>
  );
}

function Swatch({ color, selected, onClick, label }: { color: string; selected: boolean; onClick: () => void; label: string }) {
  return (
    <button
      aria-label={label}
      aria-pressed={selected}
      onClick={() => {
        haptic();
        onClick();
      }}
      className="pressable h-11 w-11 rounded-full"
      style={{ background: color, boxShadow: selected ? '0 0 0 3px var(--bg), 0 0 0 5.5px var(--tint)' : 'inset 0 0 0 1px rgba(0,0,0,0.1)' }}
    />
  );
}

export function LookStep({ look, setLook, equipment = STARTER_GEAR, showTitle = true }: { look: Look; setLook: (l: Look) => void; equipment?: Partial<Record<string, string>>; showTitle?: boolean }) {
  const [dir, setDir] = useState<Direction>('down');
  const preview = useMemo(() => pixelAppearance({ ...look, bodyMode: 'custom' }, equipment), [look, equipment]);
  const dirs: Direction[] = ['down', 'left', 'up', 'right'];
  return (
    <>
      {showTitle && <StepTitle title="Create your hero" body="Make them look like you, or not at all. You can change this any time." />}
      <div className="relative mb-6 flex h-60 items-end justify-center overflow-hidden rounded-[24px]" style={{ background: 'linear-gradient(180deg, color-mix(in srgb, var(--indigo) 20%, var(--card)) 0%, var(--card) 70%)' }}>
        <div className="absolute bottom-6 h-3 w-24 rounded-[50%] bg-black/15 blur-[2px]" />
        <div className="mb-7">
          <HeroSprite appearance={preview} anim="idle" dir={dir} scale={6} />
        </div>
        <button aria-label="Turn" onClick={() => setDir(dirs[(dirs.indexOf(dir) + 1) % 4]!)} className="pressable absolute right-3 top-3 flex h-9 items-center gap-1 rounded-full bg-fill2 px-3 text-footnote font-semibold text-tint">
          ↻ Turn
        </button>
      </div>

      <Label>Body</Label>
      <Segmented
        className="mb-6"
        value={String(look.bodyTier)}
        onChange={(v) => setLook({ ...look, bodyTier: Number(v) as 1 | 2 | 3 })}
        options={[
          { value: '1', label: 'Slim' },
          { value: '2', label: 'Average' },
          { value: '3', label: 'Broad' },
        ]}
      />

      <Label>Skin</Label>
      <div className="mb-6 flex flex-wrap gap-3">
        {SKIN_TONES.map((c, i) => (
          <Swatch key={i} label={`Skin tone ${i + 1}`} color={toHex(c)} selected={look.skinTone === i} onClick={() => setLook({ ...look, skinTone: i })} />
        ))}
      </div>

      <Label>Hair</Label>
      <div className="no-scrollbar -mx-5 mb-4 flex gap-2 overflow-x-auto px-5 pb-1">
        {HAIR_STYLE_NAMES.map((n, i) => (
          <button
            key={n}
            onClick={() => {
              haptic();
              setLook({ ...look, hairStyle: i });
            }}
            className={cx('pressable flex shrink-0 flex-col items-center rounded-[14px] bg-card px-2 pb-1.5 pt-2', look.hairStyle === i && 'ring-[2.5px] ring-tint')}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="" src={portraitUrl(pixelAppearance({ ...look, hairStyle: i, bodyMode: 'custom' }, {}))} className="pixelated h-16 w-12" />
            <span className="mt-1 max-w-16 truncate text-caption2 capitalize text-label2">{n.replace(/_/g, ' ')}</span>
          </button>
        ))}
      </div>
      <div className="mb-6 flex flex-wrap gap-3">
        {HAIR_COLORS.map((c, i) => (
          <Swatch key={i} label={`Hair colour ${i + 1}`} color={toHex(c)} selected={look.hairColor === i} onClick={() => setLook({ ...look, hairColor: i })} />
        ))}
      </div>

      <Label>Expression</Label>
      <Segmented
        value={String(look.face)}
        onChange={(v) => setLook({ ...look, face: Number(v) })}
        options={['Friendly', 'Determined', 'Calm', 'Cheerful'].map((l, i) => ({ value: String(i), label: l }))}
      />
    </>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 px-1 text-footnote font-semibold uppercase text-label2">{children}</div>;
}

function DayPicker({ days, onChange }: { days: number[]; onChange: (d: number[]) => void }) {
  return (
    <div className="flex gap-1.5">
      {WEEKDAY_SHORT.map((l, d) => {
        const on = days.includes(d);
        return (
          <button
            key={d}
            aria-label={`Toggle day ${d}`}
            aria-pressed={on}
            onClick={() => {
              haptic();
              const nextDays = on ? days.filter((x) => x !== d) : [...days, d].sort();
              if (nextDays.length) onChange(nextDays);
            }}
            className="pressable flex h-9 w-9 items-center justify-center rounded-full text-footnote font-semibold"
            style={{ background: on ? 'var(--tint)' : 'var(--fill2)', color: on ? '#fff' : 'var(--label2)' }}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}

export { DayPicker };

function HabitsStep({ picks, setPicks }: { picks: Pick[]; setPicks: (p: Pick[]) => void }) {
  const [custom, setCustom] = useState('');
  const [editing, setEditing] = useState<number | null>(null);
  const preview = custom.trim().length >= 2 ? classifyHabit(custom.trim()) : null;
  const full = picks.length >= 5;
  const has = (n: string) => picks.some((p) => p.name.toLowerCase() === n.toLowerCase());
  const add = (p: Pick) => {
    if (full || has(p.name)) return;
    sfx.tap();
    haptic();
    setPicks([...picks, p]);
  };

  return (
    <>
      <StepTitle title="Pick 1 to 5 habits" body="Start small. These become your Main Habits and drive your first quests." />

      {picks.length > 0 && (
        <Section header={`Your habits · ${picks.length}/5`}>
          {picks.map((p, i) => {
            const c = classifyHabit(p.name);
            return (
              <div key={p.name} className="group">
                <div className="flex items-center gap-3 py-2 pl-4 pr-2">
                  <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[7px] text-[16px]" style={{ background: `color-mix(in srgb, ${categoryColor(c.kind === 'avoid' ? 'avoid' : c.category)} 20%, transparent)` }}>
                    {categoryEmoji(c.kind === 'avoid' ? 'avoid' : c.category)}
                  </span>
                  <button className="min-w-0 flex-1 text-left" onClick={() => setEditing(editing === i ? null : i)}>
                    <div className="truncate text-body">{p.name}</div>
                    <div className="text-footnote text-label2">
                      {c.kind === 'avoid' ? 'Avoid' : CATEGORY_INFO[c.category].name} · {daysLabel(p.days)}
                    </div>
                  </button>
                  <button aria-label={`Remove ${p.name}`} onClick={() => setPicks(picks.filter((_, j) => j !== i))} className="pressable flex h-11 w-11 items-center justify-center text-ired">
                    <Icon.Minus size={20} strokeWidth={2.5} />
                  </button>
                </div>
                {editing === i && (
                  <div className="px-4 pb-3">
                    <DayPicker days={p.days} onChange={(d) => setPicks(picks.map((x, j) => (j === i ? { ...x, days: d } : x)))} />
                  </div>
                )}
                {i < picks.length - 1 && <div className="ml-16 h-px bg-sep" />}
              </div>
            );
          })}
        </Section>
      )}

      <Section header="Add your own" footer={preview ? undefined : 'Write it how you would say it, like “walk after lunch” or “no soda”.'}>
        <div className="flex items-center pr-2">
          <TextField
            value={custom}
            onChange={setCustom}
            placeholder="e.g. Stretch for 10 minutes"
            maxLength={60}
            onSubmit={() => {
              if (preview && !full) {
                add({ name: custom.trim(), days: [0, 1, 2, 3, 4, 5, 6] });
                setCustom('');
              }
            }}
          />
          <Button
            size="small"
            variant="tinted"
            disabled={!preview || full}
            onClick={() => {
              add({ name: custom.trim(), days: [0, 1, 2, 3, 4, 5, 6] });
              setCustom('');
            }}
          >
            Add
          </Button>
        </div>
        {preview && (
          <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
            <Chip color={categoryColor(preview.kind === 'avoid' ? 'avoid' : preview.category)}>
              {categoryEmoji(preview.kind === 'avoid' ? 'avoid' : preview.category)} {preview.kind === 'avoid' ? 'Avoid habit' : CATEGORY_INFO[preview.category].name}
            </Chip>
            <span className="text-caption text-label2">
              Trains {STAT_INFO[preview.kind === 'avoid' ? 'discipline' : CATEGORY_INFO[preview.category].stat].name}
            </span>
          </div>
        )}
      </Section>

      <Label>Popular picks</Label>
      <div className="flex flex-wrap gap-2">
        {HABIT_SUGGESTIONS.map((s) => {
          const on = has(s.name);
          return (
            <button
              key={s.name}
              disabled={!on && full}
              onClick={() => (on ? setPicks(picks.filter((p) => p.name !== s.name)) : add({ name: s.name, days: s.days, kind: s.kind }))}
              className={cx('pressable flex items-center gap-1.5 rounded-full px-3.5 py-2 text-subhead disabled:opacity-40', on ? 'text-white' : 'bg-card')}
              style={on ? { background: 'var(--tint)' } : undefined}
            >
              <span>{categoryEmoji(s.kind === 'avoid' ? 'avoid' : s.category)}</span>
              {s.name}
              {on && <Icon.Check size={14} strokeWidth={3} />}
            </button>
          );
        })}
      </div>
    </>
  );
}

function Ready({ username, look, picks, error }: { username: string; look: Look; picks: Pick[]; error: string | null }) {
  const preview = useMemo(() => pixelAppearance({ ...look, bodyMode: 'custom' }, STARTER_GEAR), [look]);
  return (
    <div className="pt-4 text-center">
      <div className="mx-auto flex h-48 w-48 items-end justify-center rounded-full" style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--yellow) 35%, transparent), transparent 70%)' }}>
        <div className="mb-6">
          <HeroSprite appearance={preview} anim="celebrate" scale={5} />
        </div>
      </div>
      <h1 className="mt-4 font-rounded text-title1">{username}</h1>
      <p className="mt-1 text-subhead text-label2">Level 1 Adventurer · Traveler&apos;s gear</p>
      <div className="mt-6 rounded-card bg-card p-4 text-left">
        <div className="mb-2 text-footnote font-semibold uppercase text-label2">Starting with</div>
        {picks.map((p) => {
          const c = classifyHabit(p.name);
          return (
            <div key={p.name} className="flex items-center gap-2 py-1 text-body">
              <span>{categoryEmoji(c.kind === 'avoid' ? 'avoid' : c.category)}</span>
              <span className="flex-1 truncate">{p.name}</span>
              <span className="text-footnote text-label2">{daysLabel(p.days)}</span>
            </div>
          );
        })}
      </div>
      {error && <p className="mt-4 text-footnote text-ired">{error}</p>}
    </div>
  );
}
