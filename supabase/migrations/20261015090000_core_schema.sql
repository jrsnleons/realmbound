-- Realmbound core schema.
-- Players can READ their own rows. Every write that touches rewards goes through the
-- `game` Edge Function (service role), which calls the commit functions below.

create extension if not exists pgcrypto with schema extensions;

-- Public profile: only what section 24 of the design doc allows other players to see.
create table public.players (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  level int not null default 1,
  title text,
  appearance jsonb not null default '{}'::jsonb,
  equipment jsonb not null default '{}'::jsonb,
  archetype text,
  world_state text not null default 'neutral',
  momentum_tier text not null default 'normal',
  achievements text[] not null default '{}',
  stats jsonb not null default '{}'::jsonb,
  guild_tag text
);

-- Full game state as one versioned document (optimistic concurrency on `version`).
create table public.player_state (
  player_id uuid primary key references public.players (id) on delete cascade,
  version int not null default 1,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

-- Private settings, kept apart from the public profile.
create table public.player_settings (
  player_id uuid primary key references public.players (id) on delete cascade,
  reminders jsonb not null default '{}'::jsonb,
  reduced_motion boolean not null default false,
  low_stimulation boolean not null default false,
  hide_body_reflection boolean not null default false,
  consequence_intensity text not null default 'normal' check (consequence_intensity in ('off', 'soft', 'normal')),
  updated_at timestamptz not null default now()
);

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  kind text not null check (kind in ('do', 'avoid')),
  category text not null,
  cadence text not null check (cadence in ('maintenance', 'progressive')),
  days int[] not null default '{0,1,2,3,4,5,6}',
  is_main boolean not null default false,
  pool_key text not null,
  created_on date not null,
  archived boolean not null default false,
  privacy text not null default 'category' check (privacy in ('private', 'category', 'party', 'public')),
  difficulty text not null default 'normal' check (difficulty in ('easy', 'normal', 'hard')),
  calibration_confidence real not null default 0,
  mastered boolean not null default false,
  weekly_target int,
  goal_minutes int,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index habits_player_idx on public.habits (player_id) where not archived;

create table public.habit_logs (
  id bigint generated always as identity primary key,
  player_id uuid not null references public.players (id) on delete cascade,
  habit_id uuid references public.habits (id) on delete set null,
  kind text not null check (kind in ('log', 'checkin', 'sleep', 'live')),
  status text not null,
  local_date date not null,
  local_hour int not null check (local_hour between 0 and 23),
  felt text check (felt in ('easy', 'normal', 'hard')),
  duration_min int,
  value numeric,
  source text not null default 'manual',
  verification text not null default 'self' check (verification in ('self', 'passive', 'social')),
  created_at timestamptz not null default now()
);
create index habit_logs_player_date_idx on public.habit_logs (player_id, local_date desc);
create index habit_logs_habit_idx on public.habit_logs (habit_id);

-- Immutable ledger of everything that changed game state.
create table public.game_events (
  id bigint generated always as identity primary key,
  player_id uuid not null references public.players (id) on delete cascade,
  type text not null,
  local_date date not null,
  payload jsonb not null default '{}'::jsonb,
  reward jsonb,
  result jsonb,
  idempotency_key text,
  engine_version int not null default 1,
  created_at timestamptz not null default now(),
  unique (player_id, idempotency_key)
);
create index game_events_player_idx on public.game_events (player_id, id desc);

create or replace function public.forbid_event_changes() returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' and not exists (select 1 from public.players where id = old.player_id) then
    return old; -- cascading account deletion is allowed
  end if;
  raise exception 'game_events is append-only';
end $$;
create trigger game_events_append_only before update or delete on public.game_events
  for each row execute function public.forbid_event_changes();

-- Parties (3–6 players) for live co-op quests.
create table public.parties (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null check (char_length(name) between 2 and 30),
  leader_id uuid not null references public.players (id) on delete cascade,
  max_members int not null default 6 check (max_members between 2 and 6),
  created_at timestamptz not null default now()
);
create index parties_leader_idx on public.parties (leader_id);

create table public.party_members (
  party_id uuid not null references public.parties (id) on delete cascade,
  player_id uuid not null unique references public.players (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (party_id, player_id)
);

-- Live quests: a shared, server-timed real-life session (focus, walk, cleaning…).
create table public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('focus', 'walk', 'clean', 'stretch', 'plan')),
  title text not null,
  host_id uuid not null references public.players (id) on delete cascade,
  party_id uuid references public.parties (id) on delete set null,
  is_public boolean not null default true,
  duration_min int not null check (duration_min between 5 and 60),
  status text not null default 'open' check (status in ('open', 'running', 'finished', 'cancelled')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  max_players int not null default 8,
  created_at timestamptz not null default now()
);
create index live_sessions_open_idx on public.live_sessions (kind, starts_at) where status in ('open', 'running');
create index live_sessions_host_idx on public.live_sessions (host_id);
create index live_sessions_party_idx on public.live_sessions (party_id);

create table public.live_participants (
  session_id uuid not null references public.live_sessions (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  joined_at timestamptz not null default now(),
  rewarded boolean not null default false,
  primary key (session_id, player_id)
);
create index live_participants_player_idx on public.live_participants (player_id);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references public.players (id) on delete cascade,
  endpoint text not null unique,
  keys jsonb not null,
  created_at timestamptz not null default now()
);
create index push_subscriptions_player_idx on public.push_subscriptions (player_id);

-- ─── Row Level Security ──────────────────────────────────────────────────────
alter table public.players enable row level security;
alter table public.player_state enable row level security;
alter table public.player_settings enable row level security;
alter table public.habits enable row level security;
alter table public.habit_logs enable row level security;
alter table public.game_events enable row level security;
alter table public.parties enable row level security;
alter table public.party_members enable row level security;
alter table public.live_sessions enable row level security;
alter table public.live_participants enable row level security;
alter table public.push_subscriptions enable row level security;

-- Public profiles are visible to signed-in players (they contain no sensitive data).
create policy players_read on public.players for select to authenticated using (true);
create policy state_read_own on public.player_state for select to authenticated using (player_id = (select auth.uid()));
create policy settings_read_own on public.player_settings for select to authenticated using (player_id = (select auth.uid()));
create policy habits_read_own on public.habits for select to authenticated using (player_id = (select auth.uid()));
create policy logs_read_own on public.habit_logs for select to authenticated using (player_id = (select auth.uid()));
create policy events_read_own on public.game_events for select to authenticated using (player_id = (select auth.uid()));
create policy push_read_own on public.push_subscriptions for select to authenticated using (player_id = (select auth.uid()));

create or replace function public.my_party_id() returns uuid
language sql stable security definer set search_path = '' as $$
  select party_id from public.party_members where player_id = (select auth.uid())
$$;

create policy parties_read_member on public.parties for select to authenticated using (id = public.my_party_id());
create policy party_members_read on public.party_members for select to authenticated using (party_id = public.my_party_id());
create policy live_read on public.live_sessions for select to authenticated
  using (is_public or host_id = (select auth.uid()) or party_id = public.my_party_id());
create policy live_participants_read on public.live_participants for select to authenticated
  using (exists (select 1 from public.live_sessions s where s.id = session_id and (s.is_public or s.party_id = public.my_party_id() or s.host_id = (select auth.uid()))));

-- No insert/update/delete policies: clients cannot write these tables directly.
revoke insert, update, delete on all tables in schema public from anon, authenticated;
revoke all on function public.my_party_id() from public, anon;
grant execute on function public.my_party_id() to authenticated;
revoke all on function public.forbid_event_changes() from public, anon, authenticated;
