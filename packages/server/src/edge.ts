import { handle, type Deps, type Request as GameRequest } from './handler';

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
};

const MAX_BODY_BYTES = 16_000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });
}

export interface EdgeOptions extends Omit<Deps, 'now' | 'newId' | 'random'> {
  /** Resolves the bearer token to a user id, or null when it is not a valid session. */
  verifyUser(token: string): Promise<string | null>;
  log?(message: string, extra?: Record<string, unknown>): void;
}

/** The `game` Edge Function as a plain fetch handler (runtime-agnostic, so it is testable in Node). */
export function gameFetchHandler(opts: EdgeOptions) {
  return async (req: globalThis.Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
    if (req.method !== 'POST') return json({ ok: false, code: 'method', message: 'Use POST.' }, 405);

    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    const userId = token ? await opts.verifyUser(token).catch(() => null) : null;
    if (!userId) return json({ ok: false, code: 'unauthorized', message: 'Please sign in again.' }, 401);

    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) return json({ ok: false, code: 'too_large', message: 'Request too large.' }, 413);
    let body: GameRequest;
    try {
      body = JSON.parse(text) as GameRequest;
    } catch {
      return json({ ok: false, code: 'bad_request', message: 'Invalid JSON.' }, 400);
    }
    if (!body || typeof body.action !== 'string') return json({ ok: false, code: 'bad_request', message: 'Missing action.' }, 400);
    if (body.idempotencyKey !== undefined && (typeof body.idempotencyKey !== 'string' || body.idempotencyKey.length > 80)) {
      return json({ ok: false, code: 'bad_request', message: 'Invalid idempotency key.' }, 400);
    }

    try {
      const res = await handle({ repo: opts.repo, ai: opts.ai }, userId, body);
      return json(res, res.ok ? 200 : 400);
    } catch (e) {
      opts.log?.('game_error', { action: body.action, error: e instanceof Error ? e.message : String(e) });
      return json({ ok: false, code: 'server_error', message: 'Something went wrong. Please try again.' }, 500);
    }
  };
}
