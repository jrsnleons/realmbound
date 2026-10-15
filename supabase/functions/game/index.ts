// Realmbound `game` Edge Function: the only place rewards are computed and stored.
// game.js is the bundled game server (run `pnpm build:function`).
import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import { embeddingAdapters, gameFetchHandler, geminiNarrator, SupabaseRepo } from './game.js';

declare const Supabase: { ai: { Session: new (model: string) => { run(input: string, opts: { mean_pool: boolean; normalize: boolean }): Promise<ArrayLike<number>> } } };

const secretKeys = Deno.env.get('SUPABASE_SECRET_KEYS');
const serviceKey = (secretKeys ? JSON.parse(secretKeys).default : undefined) ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const embedder = new Supabase.ai.Session('gte-small');
const cache = new Map<string, number[]>();
async function embed(text: string): Promise<number[]> {
  const key = text.trim().toLowerCase();
  const hit = cache.get(key);
  if (hit) return hit;
  const vec = Array.from(await embedder.run(key, { mean_pool: true, normalize: true }));
  if (cache.size > 500) cache.clear();
  cache.set(key, vec);
  return vec;
}

const geminiKey = Deno.env.get('GEMINI_API_KEY');

Deno.serve(
  gameFetchHandler({
    repo: new SupabaseRepo(db),
    ai: { ...embeddingAdapters(embed), ...(geminiKey ? geminiNarrator(geminiKey) : {}) },
    async verifyUser(token: string) {
      const { data, error } = await db.auth.getUser(token);
      return error || !data.user ? null : data.user.id;
    },
    log: (message: string, extra?: Record<string, unknown>) => console.error(message, JSON.stringify(extra ?? {})),
  }),
);
