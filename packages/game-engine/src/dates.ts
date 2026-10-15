/** A calendar date in the player's own timezone, formatted YYYY-MM-DD. */
export type LocalDate = string;

const DAY_MS = 86_400_000;

function toUtcMs(d: LocalDate): number {
  const [y, m, day] = d.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, day);
}

function fromUtcMs(ms: number): LocalDate {
  return new Date(ms).toISOString().slice(0, 10);
}

export function isLocalDate(s: unknown): s is LocalDate {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(toUtcMs(s));
}

export function addDays(d: LocalDate, n: number): LocalDate {
  return fromUtcMs(toUtcMs(d) + n * DAY_MS);
}

/** Whole days from a to b (b - a). */
export function diffDays(a: LocalDate, b: LocalDate): number {
  return Math.round((toUtcMs(b) - toUtcMs(a)) / DAY_MS);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(d: LocalDate): number {
  return new Date(toUtcMs(d)).getUTCDay();
}

/** The most recent `startDay` on or before d (default Monday). */
export function weekStart(d: LocalDate, startDay = 1): LocalDate {
  const back = (weekday(d) - startDay + 7) % 7;
  return addDays(d, -back);
}

export function datesBetween(fromExclusive: LocalDate, toInclusive: LocalDate): LocalDate[] {
  const out: LocalDate[] = [];
  for (let d = addDays(fromExclusive, 1); d <= toInclusive; d = addDays(d, 1)) out.push(d);
  return out;
}

/** The player's local date and hour for an instant, using an IANA timezone. */
export function localDateTime(instant: Date, timeZone: string): { date: LocalDate; hour: number } {
  let tz = timeZone;
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: tz });
  } catch {
    tz = 'UTC';
  }
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) % 24 };
}

export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
