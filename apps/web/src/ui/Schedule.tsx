'use client';

import { haptic } from '@/lib/feedback';
import { WEEKDAY_NAMES } from '@/lib/game';
import { cx, Segmented, Stepper } from './primitives';

/** How often a habit repeats: chosen weekdays, or "N times a week" on any day. */
export interface Schedule {
  perWeek: number | null;
  days: number[];
}

export const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS = [1, 2, 3, 4, 5];
const WEEKENDS = [0, 6];
/** The game week starts on Monday. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export const DEFAULT_SCHEDULE: Schedule = { perWeek: null, days: EVERY_DAY };

export function scheduleOf(h: { days: number[]; perWeek?: number }): Schedule {
  return h.perWeek ? { perWeek: h.perWeek, days: [] } : { perWeek: null, days: h.days.length ? h.days : EVERY_DAY };
}

const same = (a: number[], b: number[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

export function scheduleLabel(s: Schedule): string {
  if (s.perWeek) return `${s.perWeek}× a week`;
  if (same(s.days, EVERY_DAY)) return 'Every day';
  if (same(s.days, WEEKDAYS)) return 'Weekdays';
  if (same(s.days, WEEKENDS)) return 'Weekends';
  return WEEK_ORDER.filter((d) => s.days.includes(d))
    .map((d) => WEEKDAY_NAMES[d]!.slice(0, 3))
    .join(', ');
}

/** What to send when creating a habit. */
export function schedulePayload(s: Schedule) {
  return s.perWeek ? { perWeek: s.perWeek, days: [] as number[] } : { days: s.days };
}

/** What to send when editing one, so switching modes clears the other. */
export function schedulePatch(s: Schedule) {
  return s.perWeek ? { perWeek: s.perWeek } : { days: s.days, perWeek: null };
}

export const scheduleValid = (s: Schedule) => Boolean(s.perWeek) || s.days.length > 0;

function describe(s: Schedule): string {
  if (s.perWeek) return `${s.perWeek === 1 ? 'Once' : `${s.perWeek} times`} a week, on whichever days suit you. No day counts as missed.`;
  if (s.days.length === 0) return 'Pick at least one day.';
  if (same(s.days, EVERY_DAY)) return 'Repeats every day.';
  const names = WEEK_ORDER.filter((d) => s.days.includes(d)).map((d) => `${WEEKDAY_NAMES[d]}s`);
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
  return `Repeats on ${list}. Other days never count as missed.`;
}

const PRESETS: { label: string; days: number[] }[] = [
  { label: 'Every day', days: EVERY_DAY },
  { label: 'Weekdays', days: WEEKDAYS },
  { label: 'Weekends', days: WEEKENDS },
];

export function ScheduleEditor({ value, onChange }: { value: Schedule; onChange: (s: Schedule) => void }) {
  const flexible = value.perWeek !== null;
  return (
    <div className="flex flex-col gap-3">
      <Segmented
        value={flexible ? 'flex' : 'days'}
        onChange={(v) => {
          haptic();
          onChange(v === 'flex' ? { perWeek: value.perWeek ?? 3, days: [] } : { perWeek: null, days: value.days.length ? value.days : EVERY_DAY });
        }}
        options={[
          { value: 'days', label: 'Days of the week' },
          { value: 'flex', label: 'Times a week' },
        ]}
      />

      {flexible ? (
        <div className="flex items-center justify-between rounded-[10px] bg-fill2 py-2 pl-4 pr-3">
          <span className="text-body">Goal per week</span>
          <Stepper value={value.perWeek ?? 3} min={1} max={7} format={(v) => `${v}×`} onChange={(v) => onChange({ perWeek: v, days: [] })} />
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            {PRESETS.map((p) => {
              const on = same(value.days, p.days);
              return (
                <button
                  key={p.label}
                  aria-pressed={on}
                  onClick={() => {
                    haptic();
                    onChange({ perWeek: null, days: p.days });
                  }}
                  className={cx('pressable h-8 flex-1 rounded-full text-footnote font-semibold', on ? 'bg-tint text-white' : 'bg-fill2 text-label2')}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <div className="flex justify-between">
            {WEEK_ORDER.map((d) => {
              const on = value.days.includes(d);
              return (
                <button
                  key={d}
                  aria-label={WEEKDAY_NAMES[d]}
                  aria-pressed={on}
                  onClick={() => {
                    haptic();
                    onChange({ perWeek: null, days: on ? value.days.filter((x) => x !== d) : [...value.days, d].sort() });
                  }}
                  className={cx('pressable flex h-10 w-10 items-center justify-center rounded-full text-subhead font-semibold', on ? 'bg-tint text-white' : 'bg-fill2 text-label2')}
                >
                  {LETTER[d]}
                </button>
              );
            })}
          </div>
        </>
      )}
      <p className={cx('text-footnote', scheduleValid(value) ? 'text-label2' : 'text-ired')}>{describe(value)}</p>
    </div>
  );
}
