'use client';

import { BOSSES, INITIATION_STEPS, NPC_LINES } from '@realmbound/content';
import { initiationDay, xpToNext, type Reward } from '@realmbound/game-engine';
import { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Tab } from '@/App';
import { haptic, sfx } from '@/lib/feedback';
import { categoryColor, categoryEmoji, habitsToday, plural, prettyDate, type HabitToday } from '@/lib/game';
import { conditionOf, pixelAppearance } from '@/lib/sprites';
import { useGame, useView } from '@/state/game';
import { Icon } from '@/ui/icons';
import { Button, Chip, cx, NavButton, ProgressBar, Ring, Row, Screen, Section, Sheet, Spinner, Stepper } from '@/ui/primitives';
import { HeroSprite } from '@/ui/Sprite';
import { AddHabitSheet, HabitDetailSheet } from './HabitSheets';

export const SKY: Record<string, string> = {
  thriving: 'linear-gradient(180deg, #ffb36b 0%, #ffd9a0 45%, #fff1d6 70%)',
  neutral: 'linear-gradient(180deg, #7ab8ff 0%, #b5dbff 50%, #e4f2ff 70%)',
  struggling: 'linear-gradient(180deg, #5a5f86 0%, #8d8fb0 50%, #bfc0d4 70%)',
};
export const GROUND: Record<string, string> = { thriving: '#79c25a', neutral: '#6db35a', struggling: '#6b8a63' };

export function TodayScreen({ go }: { go: (t: Tab) => void }) {
  const view = useView();
  const { state } = view;
  const [adding, setAdding] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const items = useMemo(() => habitsToday(state, view.habits), [state, view.habits]);
  const scheduled = items.filter((i) => i.scheduled);
  const other = items.filter((i) => !i.scheduled);
  const doneCount = scheduled.filter((i) => i.done).length;
  const lines = NPC_LINES[state.worldState];
  const npcLine = lines[Number(state.today.slice(-2)) % lines.length];

  return (
    <Screen
      title="Today"
      subtitle={prettyDate(state.today)}
      trailing={
        <NavButton label="Add habit" onClick={() => setAdding(true)}>
          <Icon.Plus size={24} strokeWidth={2.4} />
        </NavButton>
      }
    >
      <HeroCard onOpen={() => go('hero')} />

      {state.restMode.on && (
        <div className="mb-5 flex items-center gap-3 rounded-card p-4" style={{ background: 'color-mix(in srgb, var(--indigo) 14%, var(--card))' }}>
          <Icon.Moon size={22} className="text-iindigo" />
          <div className="flex-1 text-subhead">
            <div className="font-semibold">Rest mode is on</div>
            <div className="text-label2">Missed habits do not count against you. Get well.</div>
          </div>
        </div>
      )}

      {!state.initiation.graduated && <InitiationCard />}

      <Section
        header={
          <span className="flex items-center justify-between">
            <span>Scheduled today</span>
            {scheduled.length > 0 && (
              <span className="normal-case">
                {doneCount} of {scheduled.length}
              </span>
            )}
          </span>
        }
        footer={scheduled.length === 0 ? 'Nothing is scheduled today. Anything you log still counts.' : undefined}
      >
        {scheduled.length === 0 ? (
          <Row title="A free day" subtitle="Rest or pick something below" icon={<Icon.Sun size={18} />} iconBg="var(--yellow)" />
        ) : (
          scheduled.map((it) => <HabitRow key={it.habit.id} item={it} onOpen={() => setDetail(it.habit.id)} />)
        )}
      </Section>

      {other.length > 0 && (
        <Section header="Any time">
          {other.map((it) => (
            <HabitRow key={it.habit.id} item={it} onOpen={() => setDetail(it.habit.id)} />
          ))}
        </Section>
      )}

      <SleepSection />

      {state.boss && !state.boss.defeated && <BossMini onOpen={() => go('quests')} />}

      <p className="mb-6 px-6 text-center text-footnote italic text-label2">&ldquo;{npcLine}&rdquo;</p>

      <AddHabitSheet open={adding} onClose={() => setAdding(false)} />
      <HabitDetailSheet habit={view.habits.find((h) => h.id === detail) ?? null} onClose={() => setDetail(null)} />
    </Screen>
  );
}

function HeroCard({ onOpen }: { onOpen: () => void }) {
  const { state, player } = useView();
  const look = useMemo(() => pixelAppearance(state.appearance, state.equipment), [state.appearance, state.equipment]);
  const need = xpToNext(state.level);
  const tier = state.momentum >= 70 ? 'high' : state.momentum < 40 ? 'low' : 'normal';
  const flame = tier === 'high' ? 'var(--orange)' : tier === 'low' ? 'var(--gray)' : 'var(--yellow)';
  const conditions = (Object.keys(state.conditions) as (keyof typeof state.conditions)[]).filter((c) => state.conditions[c]);

  return (
    <button onClick={onOpen} className="pressable mb-6 block w-full overflow-hidden rounded-[20px] bg-card text-left" style={{ boxShadow: 'var(--shadow)' }}>
      <div className="relative h-36 overflow-hidden" style={{ background: SKY[state.worldState] }}>
        <div className="absolute inset-x-0 bottom-0 h-9" style={{ background: GROUND[state.worldState], boxShadow: 'inset 0 4px 0 rgba(255,255,255,0.18)' }} />
        <div className="absolute bottom-7 left-6 h-2.5 w-14 rounded-[50%] bg-black/20" />
        <div className="absolute bottom-5 left-6">
          <HeroSprite appearance={look} scale={3} condition={conditionOf(state)} />
        </div>
        <div className="absolute right-4 top-3 flex items-center gap-1.5 rounded-full bg-black/25 px-2.5 py-1 text-footnote font-semibold text-white backdrop-blur">
          <Icon.Coin size={15} strokeWidth={2.4} className="text-[#ffd60a]" />
          <span className="tabular">{state.gold}</span>
        </div>
        <div className="absolute bottom-12 right-4 text-right text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
          <div className="text-headline">{player.username}</div>
          <div className="text-footnote font-medium opacity-90">{state.activeTitle ?? 'Adventurer'}</div>
        </div>
      </div>
      <div className="flex items-center gap-4 p-4">
        <Ring value={state.xp / need} size={52} stroke={5} color="var(--xp)">
          <div className="text-center leading-none">
            <div className="text-[9px] font-semibold uppercase text-label2">Lv</div>
            <div className="tabular font-rounded text-headline">{state.level}</div>
          </div>
        </Ring>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-baseline justify-between text-footnote">
            <span className="font-semibold">Experience</span>
            <span className="tabular text-label2">
              {state.xp} / {need}
            </span>
          </div>
          <ProgressBar value={state.xp / need} color="var(--xp)" />
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Chip color={flame}>
              <Icon.Flame size={12} strokeWidth={2.6} /> Momentum {Math.round(state.momentum)}
            </Chip>
            {conditions.map((c) => (
              <Chip key={c} color={c === 'fallen' ? 'var(--red)' : 'var(--gray)'}>
                {c === 'fatigue' ? 'Fatigued' : c === 'tempted' ? 'Tempted' : 'Fallen'}
              </Chip>
            ))}
          </div>
        </div>
      </div>
    </button>
  );
}

function InitiationCard() {
  const { state } = useView();
  const day = Math.min(14, initiationDay(state));
  const step = [...INITIATION_STEPS].reverse().find((s) => s.day <= day) ?? INITIATION_STEPS[0]!;
  const quest = state.quests.find((q) => q.kind === 'initiation' && q.status !== 'expired' && q.startsOn === state.today);
  return (
    <div className="mb-7 overflow-hidden rounded-card bg-card" style={{ boxShadow: 'var(--shadow)' }}>
      <div className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-caption font-bold uppercase tracking-wide text-iorange">Initiation · Day {day} of 14</span>
          {quest?.status === 'completed' && (
            <Chip color="var(--green)">
              <Icon.Check size={11} strokeWidth={3} /> Done today
            </Chip>
          )}
        </div>
        <div className="mt-1 text-headline">{step.title}</div>
        <p className="mt-0.5 text-subhead text-label2">{step.description}</p>
        <p className="mt-1 text-footnote text-label3">{step.npc}</p>
      </div>
      <div className="flex gap-[3px] px-4 pb-4">
        {Array.from({ length: 14 }, (_, i) => (
          <span key={i} className="h-1.5 flex-1 rounded-full" style={{ background: i < day ? 'var(--orange)' : 'var(--fill)' }} />
        ))}
      </div>
    </div>
  );
}

type Burst = { id: number; text: string; color: string; delay: number; x?: number; y?: number };
let burstSeq = 0;

function rewardBursts(r: Reward | undefined): Omit<Burst, 'id'>[] {
  if (!r) return [];
  const out: Omit<Burst, 'id'>[] = [];
  if (r.characterXp) out.push({ text: `+${r.characterXp} XP`, color: 'var(--xp)', delay: 0 });
  if (r.gold) out.push({ text: `+${r.gold} gold`, color: 'var(--gold)', delay: 140 });
  const mats = Object.entries(r.materials).filter(([, n]) => n);
  if (mats.length) out.push({ text: `+${mats.map(([m, n]) => `${n} ${m.replace('_', ' ')}`).join(', ')}`, color: 'var(--brown)', delay: 280 });
  return out;
}

function HabitRow({ item, onOpen }: { item: HabitToday; onOpen: () => void }) {
  const { call } = useGame();
  const { state } = useView();
  const [pending, setPending] = useState<'log' | 'resist' | 'slip' | null>(null);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const anchor = useRef<HTMLDivElement>(null);
  const { habit } = item;
  const key = habit.kind === 'avoid' ? 'avoid' : habit.category;
  const quest = state.quests.find((q) => q.status === 'active' && q.kind === 'main' && q.habitId === habit.id);
  const obj = quest?.objectives[0];

  const showReward = (r?: Reward) => {
    const rect = anchor.current?.getBoundingClientRect();
    const at = rect ? { x: rect.left + rect.width / 2, y: rect.top } : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const next = rewardBursts(r).map((b) => ({ ...b, id: ++burstSeq, ...at }));
    setBursts((x) => [...x, ...next]);
    setTimeout(() => setBursts((x) => x.filter((b) => !next.some((n) => n.id === b.id))), 1700);
  };

  const act = async (kind: 'log' | 'resist' | 'slip') => {
    if (pending) return;
    setPending(kind);
    haptic(kind === 'slip' ? 'warning' : 'success');
    if (kind === 'log') sfx.check();
    else if (kind === 'resist') sfx.resist();
    else sfx.soft();
    const res =
      kind === 'log'
        ? await call('logHabit', { habitId: habit.id }, { idempotent: true })
        : await call('avoidCheckin', { habitId: habit.id, resisted: kind === 'resist' }, { idempotent: true });
    setPending(null);
    if (res.ok) {
      const d = res.data as { reward?: Reward; bossDamage?: number } | undefined;
      showReward(d?.reward);
      if (d?.reward?.gold) setTimeout(sfx.coin, 160);
    }
  };

  const subtitle =
    habit.kind === 'avoid'
      ? item.mark === 'resisted'
        ? 'Held strong today'
        : item.mark === 'slipped'
          ? 'Slipped today. Tomorrow is a fresh start.'
          : 'Did you hold strong today?'
      : obj
        ? `${quest!.title} · ${Math.min(obj.count, obj.target)}/${obj.target}`
        : item.times > 1
          ? `Logged ${plural(item.times, 'time')} today`
          : habit.isMain
            ? 'Main Habit'
            : undefined;

  return (
    <div className="group relative flex min-h-[60px] items-center pl-4">
      <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 py-2.5 text-left">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] text-[19px]" style={{ background: `color-mix(in srgb, ${categoryColor(key)} 18%, transparent)` }}>
          {categoryEmoji(key)}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cx('block truncate text-body', item.done && habit.kind === 'do' && 'text-label2')}>{habit.name}</span>
          {subtitle && <span className={cx('block truncate text-footnote', item.mark === 'slipped' ? 'text-iorange' : 'text-label2')}>{subtitle}</span>}
        </span>
      </button>
      <div ref={anchor} className="relative flex shrink-0 items-center gap-1.5 py-2 pr-3">
        {habit.kind === 'do' ? (
          <button
            aria-label={item.done ? `Log ${habit.name} again` : `Log ${habit.name}`}
            onClick={() => void act('log')}
            className="pressable flex h-11 w-11 items-center justify-center"
          >
            <span
              className="flex h-[30px] w-[30px] items-center justify-center rounded-full transition-all duration-300"
              style={item.done ? { background: 'var(--green)', color: '#fff' } : { boxShadow: 'inset 0 0 0 2px var(--label3)' }}
            >
              {pending === 'log' ? (
                <Spinner size={14} />
              ) : item.done ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m5 12.5 4.5 4.5L19 7.5" strokeDasharray="24" style={{ animation: 'check-draw 300ms ease-out both' }} />
                </svg>
              ) : null}
            </span>
          </button>
        ) : item.mark ? (
          <Chip color={item.mark === 'resisted' ? 'var(--green)' : 'var(--orange)'} className="mr-1">
            {item.mark === 'resisted' ? (
              <>
                <Icon.Shield size={12} strokeWidth={2.6} /> Held
              </>
            ) : (
              'Slipped'
            )}
          </Chip>
        ) : (
          <>
            <Button size="small" variant="gray" color="var(--label2)" loading={pending === 'slip'} onClick={() => void act('slip')}>
              Slipped
            </Button>
            <Button size="small" variant="tinted" color="var(--green)" loading={pending === 'resist'} onClick={() => void act('resist')}>
              Held
            </Button>
          </>
        )}
        {bursts.length > 0 &&
          createPortal(
            bursts.map((b) => (
              <span
                key={b.id}
                className="pointer-events-none fixed z-[75] whitespace-nowrap font-rounded text-headline font-bold"
                style={{ left: b.x, top: b.y, color: b.color, animation: `rise-fade 1.3s ${b.delay}ms var(--ease-spring) both`, textShadow: '0 1px 2px var(--bg), 0 0 1px var(--bg)' }}
              >
                {b.text}
              </span>
            )),
            document.body,
          )}
      </div>
      <span className="absolute bottom-0 left-[64px] right-0 h-px bg-sep group-last:hidden" />
    </div>
  );
}

function SleepSection() {
  const { call } = useGame();
  const { state } = useView();
  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState(state.sleepGoalHours);
  const [busy, setBusy] = useState(false);
  const logged = state.sleep[state.today];

  return (
    <>
      <Section header="Recovery">
        <Row
          icon={<Icon.Moon size={18} />}
          iconBg="var(--indigo)"
          title="Last night's sleep"
          subtitle={logged ? (logged.met ? 'Goal met. Recovery restored.' : `Goal is ${state.sleepGoalHours} h. Rest well tonight.`) : `Goal ${state.sleepGoalHours} h`}
          detail={logged ? `${logged.hours} h` : undefined}
          accessory={
            !logged && (
              <Button size="small" variant="tinted" color="var(--indigo)" onClick={() => setOpen(true)}>
                Log
              </Button>
            )
          }
        />
      </Section>
      <Sheet open={open} onClose={() => setOpen(false)} title="Log Sleep">
        <div className="py-6 text-center">
          <div className="tabular font-rounded text-[56px] font-bold leading-none">{hours}</div>
          <div className="mt-1 text-subhead text-label2">hours</div>
          <div className="mt-6 flex justify-center">
            <Stepper value={hours} onChange={setHours} min={0} max={16} step={0.25} format={() => ''} />
          </div>
          <p className="mt-4 text-footnote text-label2">{hours >= state.sleepGoalHours ? 'That meets your goal.' : `Your goal is ${state.sleepGoalHours} h. Logging honestly still helps.`}</p>
        </div>
        <Button
          className="w-full"
          loading={busy}
          color="var(--indigo)"
          onClick={async () => {
            setBusy(true);
            const res = await call('logSleep', { hours }, { idempotent: true });
            setBusy(false);
            if (res.ok) {
              sfx.check();
              setOpen(false);
            }
          }}
        >
          Save
        </Button>
      </Sheet>
    </>
  );
}

function BossMini({ onOpen }: { onOpen: () => void }) {
  const { state } = useView();
  const boss = state.boss!;
  const def = BOSSES.find((b) => b.id === boss.id);
  return (
    <Section header="Weekly threat">
      <Row
        onClick={onOpen}
        icon={<Icon.Sword size={17} />}
        iconBg="var(--red)"
        chevron
        title={def?.name ?? 'Boss'}
        subtitle={
          <span className="mt-1 flex items-center gap-2">
            <ProgressBar value={boss.hp / boss.maxHp} color="var(--red)" height={5} className="max-w-40" />
            <span className="tabular">
              {boss.hp}/{boss.maxHp} HP
            </span>
          </span>
        }
      />
    </Section>
  );
}
