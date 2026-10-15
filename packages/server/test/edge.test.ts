import { describe, expect, it } from 'vitest';
import { embeddingAdapters, gameFetchHandler, MemoryRepo } from '../src';

function post(body: unknown, token = 'good') {
  return new Request('https://x/functions/v1/game', { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
}

describe('edge handler', () => {
  const repo = new MemoryRepo();
  const fetchHandler = gameFetchHandler({ repo, verifyUser: async (t) => (t === 'good' ? '11111111-1111-4111-8111-111111111111' : null) });

  it('answers CORS preflight', async () => {
    const res = await fetchHandler(new Request('https://x', { method: 'OPTIONS' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('rejects a bad token', async () => {
    const res = await fetchHandler(post({ action: 'me' }, 'bad'));
    expect(res.status).toBe(401);
  });

  it('runs onboarding then me', async () => {
    const me = await (await fetchHandler(post({ action: 'me' }))).json();
    expect(me.needsOnboarding).toBe(true);
    const created = await fetchHandler(post({ action: 'createPlayer', payload: { username: 'edge_hero', timezone: 'Asia/Manila', habits: [{ name: 'Walk 20 minutes' }] } }));
    expect(created.status).toBe(200);
    const again = await (await fetchHandler(post({ action: 'me' }))).json();
    expect(again.view.player.username).toBe('edge_hero');
  });

  it('rejects malformed bodies', async () => {
    const res = await fetchHandler(new Request('https://x', { method: 'POST', headers: { authorization: 'Bearer good' }, body: '{nope' }));
    expect(res.status).toBe(400);
  });
});

describe('embedding adapters', () => {
  // Bag-of-words "embedding" over a tiny vocabulary is enough to exercise the ranking logic.
  const vocab = ['water', 'drink', 'gym', 'lift', 'walk', 'read', 'book', 'bottle', 'hydrated', 'weights', 'workout'];
  const embed = async (t: string) => vocab.map((w) => (t.toLowerCase().includes(w) ? 1 : 0.01));
  const ai = embeddingAdapters(embed);

  it('places a habit in the closest category', async () => {
    const c = await ai.classify!('drink water from my bottle');
    expect(c?.category).toBe('hydration');
    expect(c?.source).toBe('embedding');
  });

  it('scores similar names higher', async () => {
    const [same, other] = (await ai.similarity!('drink water', ['drink more water', 'lift weights']))!;
    expect(same!).toBeGreaterThan(other!);
  });
});
