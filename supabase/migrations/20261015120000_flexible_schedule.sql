-- Flexible habit schedules: "N times a week on any day" next to the fixed weekday list.
alter table public.habits add column if not exists per_week int check (per_week between 1 and 7);

create or replace function public._upsert_habits(p_player uuid, p_habits jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_habits is null or jsonb_typeof(p_habits) <> 'array' then return; end if;
  insert into public.habits as h (
    id, player_id, name, kind, category, cadence, days, per_week, is_main, pool_key, created_on, archived,
    privacy, difficulty, calibration_confidence, mastered, weekly_target, goal_minutes, sort_order, updated_at)
  select
    (x->>'id')::uuid, p_player, x->>'name', x->>'kind', x->>'category', x->>'cadence',
    coalesce((select array_agg(d::int) from jsonb_array_elements_text(x->'days') d), '{}'),
    (x->>'perWeek')::int,
    coalesce((x->>'isMain')::boolean, false), x->>'poolKey', (x->>'createdOn')::date,
    coalesce((x->>'archived')::boolean, false), coalesce(x->>'privacy', 'category'),
    coalesce(x->>'difficulty', 'normal'), coalesce((x->>'calibrationConfidence')::real, 0),
    coalesce((x->>'mastered')::boolean, false), (x->>'weeklyTarget')::int, (x->>'goalMinutes')::int,
    coalesce((x->>'sortOrder')::int, 0), now()
  from jsonb_array_elements(p_habits) x
  on conflict (id) do update set
    name = excluded.name, kind = excluded.kind, category = excluded.category, cadence = excluded.cadence,
    days = excluded.days, per_week = excluded.per_week, is_main = excluded.is_main, pool_key = excluded.pool_key,
    archived = excluded.archived, privacy = excluded.privacy, difficulty = excluded.difficulty,
    calibration_confidence = excluded.calibration_confidence, mastered = excluded.mastered,
    weekly_target = excluded.weekly_target, goal_minutes = excluded.goal_minutes,
    sort_order = excluded.sort_order, updated_at = now()
  where h.player_id = p_player;
end $$;

revoke all on function public._upsert_habits(uuid, jsonb) from public, anon, authenticated;
grant execute on function public._upsert_habits(uuid, jsonb) to service_role;
