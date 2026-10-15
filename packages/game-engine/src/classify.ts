import {
  AVOID_PREFIXES,
  CATEGORIES,
  CATEGORY_INFO,
  CATEGORY_KEYWORDS,
  SYNONYM_GROUPS,
  type Category,
} from '@realmbound/content';
import type { Cadence, Habit, HabitKind } from './types';

/** Very small stemmer: lowercases and strips common English suffixes. Good enough for habit names. */
export function stem(word: string): string {
  const once = stemOnce(word.toLowerCase().replace(/[^a-z']/g, '').replace(/'/g, ''));
  return stemOnce(once);
}

function stemOnce(input: string): string {
  let w = input;
  if (w.length <= 3) return w;
  for (const suf of ['ational', 'ization', 'ations', 'ation', 'ings', 'ing', 'ies', 'ied', 'ness', 'ment', 'ers', 'er', 'ed', 'es', 'ly', 's', 'y', 'e']) {
    if (w.endsWith(suf) && w.length - suf.length >= 3) {
      w = w.slice(0, -suf.length);
      if (suf === 'ies' || suf === 'ied' || suf === 'y') w += 'i';
      if ((suf === 'ing' || suf === 'ed' || suf === 'er' || suf === 'ers') && /([b-df-hj-np-tv-z])\1$/.test(w) && !/(ll|ss|zz)$/.test(w)) w = w.slice(0, -1);
      break;
    }
  }
  return w;
}

export function tokens(name: string): string[] {
  return name
    .toLowerCase()
    .split(/[^a-z0-9']+/)
    .filter(Boolean)
    .map(stem)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

const STOP = new Set(['a', 'an', 'the', 'to', 'for', 'of', 'my', 'and', 'or', 'at', 'in', 'on', 'min', 'minut', 'hour', 'day', 'dai', 'each', 'every', 'time', 'some', 'more', 'after', 'befor', 'from', 'with', 'least']);

export interface Classification {
  kind: HabitKind;
  category: Category;
  cadence: Cadence;
  confidence: number;
  source: 'rules' | 'embedding' | 'llm';
}

export function detectKind(name: string): HabitKind {
  const first = name.trim().toLowerCase().split(/\s+/)[0]?.replace(/[^a-z']/g, '') ?? '';
  return AVOID_PREFIXES.includes(first) ? 'avoid' : 'do';
}

/** Rule-based classifier: keyword hits per category, ties broken by category order. */
export function classifyHabit(name: string): Classification {
  const toks = tokens(name);
  let best: Category = 'other';
  let bestScore = 0;
  for (const cat of CATEGORIES) {
    const kws = CATEGORY_KEYWORDS[cat];
    let score = 0;
    for (const t of toks) {
      for (const k of kws) {
        if (t === k || (k.length >= 4 && t.startsWith(k)) || (t.length >= 4 && k.startsWith(t))) {
          score += t === k ? 2 : 1;
          break;
        }
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = cat;
    }
  }
  const kind = detectKind(name);
  const cadence: Cadence = kind === 'avoid' ? 'maintenance' : CATEGORY_INFO[best].defaultCadence;
  return { kind, category: best, cadence, confidence: Math.min(1, bestScore / 3), source: 'rules' };
}

function canonical(token: string): string {
  for (const group of SYNONYM_GROUPS) {
    if (group.some((g) => token === g || (g.length >= 4 && token.startsWith(g)))) return group[0]!;
  }
  return token;
}

/** Jaccard similarity of canonical token sets. */
export function nameSimilarity(a: string, b: string): number {
  const A = new Set(tokens(a).map(canonical));
  const B = new Set(tokens(b).map(canonical));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

/**
 * Finds an existing habit that is a likely duplicate of a new one.
 * Duplicates keep separate reminders but share one reward pool.
 */
export function findDuplicate(
  candidate: { name: string; category: Category; kind: HabitKind },
  existing: Pick<Habit, 'id' | 'name' | 'category' | 'kind' | 'poolKey' | 'archived'>[],
): { habitId: string; poolKey: string; probability: number } | undefined {
  let best: { habitId: string; poolKey: string; probability: number } | undefined;
  for (const h of existing) {
    if (h.archived || h.kind !== candidate.kind) continue;
    let p = nameSimilarity(candidate.name, h.name);
    if (h.category === candidate.category) p = Math.min(1, p + 0.15);
    else p *= 0.5;
    if (p >= 0.5 && (!best || p > best.probability)) best = { habitId: h.id, poolKey: h.poolKey, probability: p };
  }
  return best;
}

/** Cosine similarity for embedding vectors (used by the server's embedding classifier). */
export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length && i < b.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}
