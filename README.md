# Realmbound

A habit tracker that plays like a cozy pixel MMO. Your real-life habits earn XP, gold and gear for a pixel hero, quests adapt to your rhythm after a 14-day initiation, and parties share live focus or walk quests in a shared town.

It is a web PWA built to feel like an iOS app: install it from Safari with "Add to Home Screen".

## Layout

| Path | What it is |
| --- | --- |
| `apps/web` | Next.js static-export PWA (React 19, Tailwind 4, Phaser 4 for the World tab) |
| `packages/content` | Game data: habit categories, items, quests, monsters, NPC lines |
| `packages/game-engine` | Deterministic game rules (XP, levels, Momentum, conditions, calibration, quest generation, boss) |
| `packages/server` | Authoritative request handler, Supabase repository, AI adapters, Edge Function entry |
| `packages/pixel` | Procedural pixel art: characters with layered gear, tiles, props, monsters, icons, effects |
| `supabase/` | SQL migrations and the `game` Edge Function |

The rules engine decides every reward, so results are fair and testable. AI only adds polish on top (habit classification with on-device Supabase embeddings, optional Gemini narration), and every AI call has a rules fallback.

## Running it

```sh
pnpm install
pnpm dev            # web app on http://localhost:3000
pnpm test           # engine, server and pixel tests
pnpm typecheck
pnpm build          # static export in apps/web/out
```

The app works fully offline: choose "Try it offline first" and the same server logic runs in the browser with the save kept in local storage. Accounts, parties and the shared town use Supabase (`apps/web/.env.production` holds the public URL and publishable key).

## Backend

- Apply `supabase/migrations` to the project in order.
- Build and deploy the Edge Function:

  ```sh
  pnpm build:function                       # bundles packages/server into supabase/functions/game/game.js
  supabase functions deploy game --no-verify-jwt
  ```

  The function checks the user's token itself. Optional secret: `GEMINI_API_KEY` for narrated weekly chronicles.
- Hosting: the static export in `apps/web/out` can go on any static host (Cloudflare Pages or Vercel free tier).
