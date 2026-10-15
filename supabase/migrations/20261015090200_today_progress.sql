-- Party views show how far each member is through today's habits (counts only, no habit names).
alter table public.players add column if not exists today_progress jsonb;

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
    today_progress = coalesce(p_profile->'todayProgress', today_progress),
    updated_at = now()
  where id = p_player;
end $$;

revoke all on function public._apply_profile(uuid, jsonb) from public, anon, authenticated;
grant execute on function public._apply_profile(uuid, jsonb) to service_role;
