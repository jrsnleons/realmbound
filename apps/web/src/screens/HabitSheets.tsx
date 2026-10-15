'use client';

import { CATEGORIES, CATEGORY_INFO, STAT_INFO, type Category } from '@realmbound/content';
import { classifyHabit, completionRate, type Habit, type Privacy } from '@realmbound/game-engine';
import { useEffect, useState } from 'react';
import { haptic, sfx } from '@/lib/feedback';
import { categoryColor, categoryEmoji, plural } from '@/lib/game';
import { useGame, useView } from '@/state/game';
import { Icon } from '@/ui/icons';
import { Alert, Button, Chip, cx, NavButton, Row, Section, Segmented, Sheet, TextField, Toggle } from '@/ui/primitives';
import { DayPicker } from './Onboarding';

const PRIVACY: { value: Privacy; label: string; hint: string }[] = [
  { value: 'private', label: 'Private', hint: 'Only you see this habit.' },
  { value: 'category', label: 'Category', hint: 'Others only see the category, like “a Movement habit”.' },
  { value: 'party', label: 'Party', hint: 'Your party sees the habit name.' },
];

export function AddHabitSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { call, toast } = useGame();
  const view = useView();
  const [name, setName] = useState('');
  const [days, setDays] = useState([0, 1, 2, 3, 4, 5, 6]);
  const [category, setCategory] = useState<Category | null>(null);
  const [isMain, setIsMain] = useState(false);
  const [privacy, setPrivacy] = useState<Privacy>('category');
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName('');
      setDays([0, 1, 2, 3, 4, 5, 6]);
      setCategory(null);
      setPrivacy('category');
      setIsMain(view.habits.filter((h) => h.isMain).length < 3);
    }
  }, [open, view.habits]);

  const guess = name.trim().length >= 2 ? classifyHabit(name.trim()) : null;
  const effective = category ?? guess?.category ?? 'other';
  const isAvoid = guess?.kind === 'avoid';
  const mainsFull = view.habits.filter((h) => h.isMain).length >= 5;

  const save = async () => {
    setBusy(true);
    const res = await call('createHabit', { habit: { name: name.trim(), days, isMain: isMain && !mainsFull, privacy, ...(category ? { category } : {}) } }, { idempotent: true });
    setBusy(false);
    if (res.ok) {
      sfx.check();
      const d = res.data as { duplicateOf?: string } | undefined;
      const dup = d?.duplicateOf && view.habits.find((h) => h.id === d.duplicateOf);
      toast(dup ? `Added. It shares a daily reward pool with “${dup.name}”.` : 'Habit added', 'success');
      onClose();
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="New Habit"
      tall
      leading={
        <NavButton label="Cancel" onClick={onClose}>
          Cancel
        </NavButton>
      }
      trailing={
        <NavButton label="Add" bold onClick={() => guess && !busy && void save()}>
          <span className={cx(!guess && 'opacity-30')}>Add</span>
        </NavButton>
      }
    >
      <Section className="mt-2">
        <TextField value={name} onChange={setName} placeholder="Habit, like “Walk after lunch”" maxLength={60} autoFocus />
      </Section>

      {guess && (
        <Section header="Understood as" footer={isAvoid ? 'Avoid habits get a daily check-in: did you hold strong today?' : `Trains ${STAT_INFO[CATEGORY_INFO[effective].stat].name}. Tap to change the category.`}>
          <Row
            icon={<span className="text-[17px]">{categoryEmoji(isAvoid ? 'avoid' : effective)}</span>}
            iconBg={`color-mix(in srgb, ${categoryColor(isAvoid ? 'avoid' : effective)} 25%, transparent)`}
            title={isAvoid ? `Avoid · ${CATEGORY_INFO[effective].name}` : CATEGORY_INFO[effective].name}
            detail={category ? 'Custom' : 'Auto'}
            chevron
            onClick={() => setPicking((p) => !p)}
          />
          {picking && (
            <div className="grid grid-cols-2 gap-2 p-3">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    haptic();
                    setCategory(c);
                    setPicking(false);
                  }}
                  className={cx('pressable flex items-center gap-2 rounded-[10px] px-3 py-2 text-left text-subhead', effective === c ? 'bg-tint text-white' : 'bg-fill2')}
                >
                  <span>{CATEGORY_INFO[c].emoji}</span>
                  <span className="truncate">{CATEGORY_INFO[c].name}</span>
                </button>
              ))}
            </div>
          )}
        </Section>
      )}

      <Section header="Repeat" footer="Unscheduled days never count as missed.">
        <div className="px-4 py-3">
          <DayPicker days={days} onChange={setDays} />
        </div>
      </Section>

      <Section footer={mainsFull ? 'You already have 5 Main Habits. Fewer focused habits work better.' : 'Main Habits get a weekly Main Quest and count toward your momentum.'}>
        <Row title="Main Habit" accessory={<Toggle label="Main Habit" checked={isMain && !mainsFull} onChange={(v) => !mainsFull && setIsMain(v)} />} />
      </Section>

      <Section header="Privacy" footer={PRIVACY.find((p) => p.value === privacy)?.hint}>
        <div className="p-2">
          <Segmented value={privacy} onChange={setPrivacy} options={PRIVACY.map((p) => ({ value: p.value, label: p.label }))} />
        </div>
      </Section>

      <Button className="w-full" disabled={!guess} loading={busy} onClick={() => void save()}>
        Add Habit
      </Button>
    </Sheet>
  );
}

export function HabitDetailSheet({ habit, onClose }: { habit: Habit | null; onClose: () => void }) {
  const { call, toast } = useGame();
  const view = useView();
  const [name, setName] = useState('');
  const [days, setDays] = useState<number[]>([]);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (habit) {
      setName(habit.name);
      setDays(habit.days.length ? habit.days : [0, 1, 2, 3, 4, 5, 6]);
    }
  }, [habit]);

  if (!habit) return <Sheet open={false} onClose={onClose}>{null}</Sheet>;
  const stats = view.state.habitStats[habit.id];
  const rate = stats ? completionRate(stats) : undefined;
  const mark = view.state.history[view.state.today]?.[habit.id];
  const key = habit.kind === 'avoid' ? 'avoid' : habit.category;
  const dirty = name.trim() !== habit.name || days.join() !== (habit.days.length ? habit.days : [0, 1, 2, 3, 4, 5, 6]).join();

  const logFelt = async (felt: 'easy' | 'normal' | 'hard') => {
    setBusy(felt);
    const res = await call('logHabit', { habitId: habit.id, felt }, { idempotent: true });
    setBusy(null);
    if (res.ok) {
      sfx.check();
      const r = (res.data as { reward?: { characterXp: number; gold: number } }).reward;
      toast(r ? `+${r.characterXp} XP · +${r.gold} gold` : 'Logged', 'success');
      onClose();
    }
  };

  const save = async () => {
    setBusy('save');
    const res = await call('updateHabit', { habitId: habit.id, patch: { name: name.trim(), days } }, { idempotent: true });
    setBusy(null);
    if (res.ok) toast('Saved', 'success');
  };

  return (
    <Sheet open onClose={onClose} title={habit.name} tall>
      <div className="mb-6 mt-2 flex flex-col items-center text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-[16px] text-[32px]" style={{ background: `color-mix(in srgb, ${categoryColor(key)} 20%, transparent)` }}>
          {categoryEmoji(key)}
        </span>
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          <Chip color={categoryColor(key)}>{habit.kind === 'avoid' ? 'Avoid' : CATEGORY_INFO[habit.category].name}</Chip>
          {habit.isMain && <Chip color="var(--orange)">Main</Chip>}
          <Chip color="var(--gray)">{habit.difficulty[0]!.toUpperCase() + habit.difficulty.slice(1)}</Chip>
          {habit.mastered && <Chip color="var(--yellow)">★ Mastered</Chip>}
        </div>
      </div>

      <div className="mb-7 grid grid-cols-3 gap-2">
        <Stat label="Done" value={String(stats?.done ?? 0)} />
        <Stat label="Rate" value={rate === undefined ? '—' : `${Math.round(rate * 100)}%`} />
        <Stat label="Weekly goal" value={habit.weeklyTarget ? String(habit.weeklyTarget) : '—'} />
      </div>

      {habit.kind === 'do' && (
        <Section header="Log with how it felt" footer="How it felt helps calibrate quest difficulty over time.">
          <div className="grid grid-cols-3 gap-2 p-3">
            {(['easy', 'normal', 'hard'] as const).map((f) => (
              <Button key={f} variant="tinted" size="medium" loading={busy === f} onClick={() => void logFelt(f)} color={f === 'easy' ? 'var(--green)' : f === 'hard' ? 'var(--red)' : 'var(--blue)'}>
                {f === 'easy' ? 'Easy' : f === 'hard' ? 'Hard' : 'Normal'}
              </Button>
            ))}
          </div>
        </Section>
      )}
      {habit.kind === 'avoid' && (
        <Section footer="Answer once a day from the Today screen.">
          <Row title="Today" detail={mark === 'resisted' ? 'Held strong' : mark === 'slipped' ? 'Slipped' : 'Not answered'} />
        </Section>
      )}

      <Section header="Edit">
        <TextField value={name} onChange={setName} maxLength={60} label="Habit name" />
        <div className="ml-4 h-px bg-sep" />
        <div className="px-4 py-3">
          <DayPicker days={days} onChange={setDays} />
        </div>
      </Section>
      {dirty && (
        <Button className="mb-7 w-full" loading={busy === 'save'} onClick={() => void save()}>
          Save Changes
        </Button>
      )}

      <Section footer={`Archiving keeps your history. ${plural(stats?.logs ?? 0, 'log')} so far.`}>
        <Row title="Archive Habit" destructive onClick={() => setConfirm(true)} icon={<Icon.Trash size={17} />} iconBg="var(--red)" />
      </Section>

      <Alert
        open={confirm}
        title={`Archive “${habit.name}”?`}
        message="It leaves your Today list and quests. Your hero keeps every point it earned."
        onClose={() => setConfirm(false)}
        actions={[
          { label: 'Cancel', style: 'cancel', onClick: () => setConfirm(false) },
          {
            label: 'Archive',
            style: 'destructive',
            onClick: async () => {
              setConfirm(false);
              const res = await call('archiveHabit', { habitId: habit.id }, { idempotent: true });
              if (res.ok) onClose();
            },
          },
        ]}
      />
    </Sheet>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card bg-card px-3 py-3 text-center">
      <div className="tabular font-rounded text-title2">{value}</div>
      <div className="text-caption text-label2">{label}</div>
    </div>
  );
}
