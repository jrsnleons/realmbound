import { CATEGORIES, CATEGORY_EXEMPLARS, CATEGORY_INFO, type Category } from '@realmbound/content';
import { cosine, type Classification } from '@realmbound/game-engine';
import type { AiAdapters } from './types';

export type Embed = (text: string) => Promise<number[]>;

/** Below this similarity to every category the embedding guess is not trusted. */
const MIN_CATEGORY_SIMILARITY = 0.78;

/**
 * Habit understanding from sentence embeddings (gte-small in the Edge Function).
 * Category exemplars are embedded once per isolate and cached; habit names never leave Supabase.
 */
export function embeddingAdapters(embed: Embed): Pick<AiAdapters, 'classify' | 'similarity'> {
  let exemplars: Promise<{ category: Category; vec: number[] }[]> | undefined;
  const loadExemplars = () =>
    (exemplars ??= Promise.all(
      CATEGORIES.flatMap((category) => CATEGORY_EXEMPLARS[category].map(async (text) => ({ category, vec: await embed(text) }))),
    ).catch((e) => {
      exemplars = undefined;
      throw e;
    }));

  return {
    async classify(name: string): Promise<Classification | undefined> {
      const [vec, refs] = await Promise.all([embed(name), loadExemplars()]);
      const best = new Map<Category, number>();
      for (const r of refs) best.set(r.category, Math.max(best.get(r.category) ?? -1, cosine(vec, r.vec)));
      const ranked = [...best.entries()].sort((a, b) => b[1] - a[1]);
      const [top, second] = ranked;
      if (!top || top[1] < MIN_CATEGORY_SIMILARITY) return undefined;
      const margin = top[1] - (second?.[1] ?? 0);
      return {
        kind: 'do',
        category: top[0],
        cadence: CATEGORY_INFO[top[0]].defaultCadence,
        confidence: Math.min(0.95, 0.6 + margin * 4),
        source: 'embedding',
      };
    },
    async similarity(a: string, others: string[]) {
      const vecs = await Promise.all([a, ...others].map(embed));
      const [first, ...rest] = vecs;
      return rest.map((v) => cosine(first!, v));
    },
  };
}

/** Story text from Gemini's free tier. Optional: the app has written fallbacks for every line. */
export function geminiNarrator(apiKey: string, fetchFn: typeof fetch = fetch): Pick<AiAdapters, 'narrate'> {
  return {
    async narrate({ kind, facts }) {
      const prompt = [
        'You are the narrator of Realmbound, a cozy fantasy RPG where real-life habits power a hero.',
        `Write a short ${kind} entry (2-3 sentences, warm, never guilt-tripping, no emojis).`,
        'Only use these facts:',
        ...facts.map((f) => `- ${f}`),
      ].join('\n');
      const res = await fetchFn(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 160, temperature: 0.8 } }),
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) return undefined;
      const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      return json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || undefined;
    },
  };
}
