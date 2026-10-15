-- Atomic write paths used only by the `game` Edge Function (service role).

create or replace function public._upsert_habits(p_player uuid, p_habits jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_habits is null or jsonb_typeof(p_habits) <> 'array' then return; end if;
  insert into public.habits as h (
    id, player_id, name, kind, category, cadence, days, is_main, pool_key, created_on, archived,
    privacy, difficulty, calibration_confidence, mastered, weekly_target, goal_minutes, sort_order, updated_at)
  select
    (x->>'id')::uuid, p_player, x->>'name', x->>'kind', x->>'category', x->>'cadence',
    coalesce((select array_agg(d::int) from jsonb_array_elements_text(x->'days') d), '{}'),
    coalesce((x->>'isMain')::boolean, false), x->>'poolKey', (x->>'createdOn')::date,
    coalesce((x->>'archived')::boolean, false), coalesce(x->>'privacy', 'category'),
    coalesce(x->>'difficulty', 'normal'), coalesce((x->>'calibrationConfidence')::real, 0),
    coalesce((x->>'mastered')::boolean, false), (x->>'weeklyTarget')::int, (x->>'goalMinutes')::int,
    coalesce((x->>'sortOrder')::int, 0), now()
  from jsonb_array_elements(p_habits) x
  on conflict (id) do update set
    name = excluded.name, kind = excluded.kind, category = excluded.category, cadence = excluded.cadence,
    days = excluded.days, is_main = excluded.is_main, pool_key = excluded.pool_key, archived = excluded.archived,
    privacy = excluded.privacy, difficulty = excluded.difficulty,
    calibration_confidence = excluded.calibration_confidence, mastered = excluded.mastered,
    weekly_target = excluded.weekly_target, goal_minutes = excluded.goal_minutes,
    sort_order = excluded.sort_order, updated_at = now()
  where h.player_id = p_player;
end $$;

create or replace function public._apply_profile(p_player uuid, p_profile jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_profile is null then return; end if;
  update public.players set
    level = coalesce((p_profile->>'level')::int, level),
    title = p_profile->>'title',
    appearance = coalesce(p_profile->'appearance', appearance),
    equipment = coalesce(p_profile->'equipment', equipment),
    archetype = p_profile->>'archetype',
    world_state = coalesce(p_profile->>'worldState', world_state),
    momentum_tier = coalesce(p_profile->>'momentumTier', momentum_tier),
    stats = coalesce(p_profile->'stats', stats),
    achievements = coalesce((select array_agg(a) from jsonb_array_elements_text(p_profile->'achievements') a), achievements),
    updated_at = now()
  where id = p_player;
end $$;

create or replace function public.create_player(
  p_player uuid, p_username text, p_timezone text, p_state jsonb, p_profile jsonb, p_habits jsonb
) returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.players (id, username, timezone) values (p_player, p_username, p_timezone);
  insert into public.player_state (player_id, state) values (p_player, p_state);
  insert into public.player_settings (player_id) values (p_player);
  perform public._upsert_habits(p_player, p_habits);
  perform public._apply_profile(p_player, p_profile);
  insert into public.game_events (player_id, type, local_date, payload)
    values (p_player, 'PLAYER_CREATED', (p_state->>'createdOn')::date, jsonb_build_object('username', p_username));
end $$;

-- Commits one engine turn: new state (if the version still matches), the event, habit changes,
-- an optional log row and the refreshed public profile, all in one transaction.
create or replace function public.commit_turn(
  p_player uuid,
  p_expected_version int,
  p_state jsonb,
  p_event jsonb default null,
  p_habits jsonb default null,
  p_log jsonb default null,
  p_profile jsonb default null
) returns int language plpgsql security definer set search_path = '' as $$
declare
  v_version int;
begin
  update public.player_state
     set state = p_state, version = version + 1, updated_at = now()
   where player_id = p_player and version = p_expected_version
  returning version into v_version;
  if v_version is null then
    raise exception 'version_conflict' using errcode = 'P0001';
  end if;

  if p_event is not null then
    insert into public.game_events (player_id, type, local_date, payload, reward, result, idempotency_key, engine_version)
    values (
      p_player, p_event->>'type', (p_event->>'date')::date, coalesce(p_event->'payload', '{}'::jsonb),
      p_event->'reward', p_event->'result', p_event->>'idempotencyKey', coalesce((p_event->>'engineVersion')::int, 1));
  end if;

  perform public._upsert_habits(p_player, p_habits);

  if p_log is not null then
    insert into public.habit_logs (player_id, habit_id, kind, status, local_date, local_hour, felt, duration_min, value, source, verification)
    values (
      p_player, (p_log->>'habitId')::uuid, p_log->>'kind', p_log->>'status', (p_log->>'date')::date,
      (p_log->>'hour')::int, p_log->>'felt', (p_log->>'durationMin')::int, (p_log->>'value')::numeric,
      coalesce(p_log->>'source', 'manual'), coalesce(p_log->>'verification', 'self'));
  end if;

  perform public._apply_profile(p_player, p_profile);
  return v_version;
end $$;

revoke all on function public._upsert_habits(uuid, jsonb) from public, anon, authenticated;
revoke all on function public._apply_profile(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.create_player(uuid, text, text, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.commit_turn(uuid, int, jsonb, jsonb, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public._upsert_habits(uuid, jsonb) to service_role;
grant execute on function public._apply_profile(uuid, jsonb) to service_role;
grant execute on function public.create_player(uuid, text, text, jsonb, jsonb, jsonb) to service_role;
grant execute on function public.commit_turn(uuid, int, jsonb, jsonb, jsonb, jsonb, jsonb) to service_role;

-- Account export (the player's own data) for the "Export my data" button.
create or replace function public.export_my_data() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'profile', (select to_jsonb(p) from public.players p where p.id = (select auth.uid())),
    'state', (select state from public.player_state where player_id = (select auth.uid())),
    'habits', (select coalesce(jsonb_agg(to_jsonb(h)), '[]') from public.habits h where h.player_id = (select auth.uid())),
    'logs', (select coalesce(jsonb_agg(to_jsonb(l) order by l.id), '[]') from public.habit_logs l where l.player_id = (select auth.uid())),
    'events', (select coalesce(jsonb_agg(to_jsonb(e) order by e.id), '[]') from public.game_events e where e.player_id = (select auth.uid()))
  )
$$;
revoke all on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;
