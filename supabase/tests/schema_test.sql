-- Behavioural tests for the schema. Any failed assertion aborts with an error.
\set ON_ERROR_STOP on
insert into auth.users values ('00000000-0000-0000-0000-00000000000a'), ('00000000-0000-0000-0000-00000000000b');

set role service_role;
select public.create_player('00000000-0000-0000-0000-00000000000a', 'alice', 'Asia/Manila',
  '{"createdOn":"2026-10-12","level":1}', '{"level":1,"title":"Adventurer","worldState":"neutral","achievements":[]}',
  '[{"id":"11111111-1111-1111-1111-111111111111","name":"Walk home","kind":"do","category":"movement","cadence":"progressive","days":[1,2,3],"isMain":true,"poolKey":"movement:1","createdOn":"2026-10-12"}]');
select public.create_player('00000000-0000-0000-0000-00000000000b', 'bob', 'UTC', '{"createdOn":"2026-10-12"}', null, null);

-- commit_turn bumps the version and writes event + log atomically
select public.commit_turn('00000000-0000-0000-0000-00000000000a', 1, '{"createdOn":"2026-10-12","level":2}',
  '{"type":"logHabit","date":"2026-10-12","payload":{},"idempotencyKey":"k1"}', null,
  '{"habitId":"11111111-1111-1111-1111-111111111111","kind":"log","status":"done","date":"2026-10-12","hour":18}',
  '{"level":2,"worldState":"thriving","achievements":["first_step"]}');
do $$ begin
  assert (select version from public.player_state where player_id = '00000000-0000-0000-0000-00000000000a') = 2, 'version bumped';
  assert (select level from public.players where username = 'alice') = 2, 'profile updated';
  assert (select count(*) from public.habit_logs) = 1, 'log written';
end $$;

-- stale version is rejected and nothing is written
do $$ begin
  begin
    perform public.commit_turn('00000000-0000-0000-0000-00000000000a', 1, '{}', '{"type":"x","date":"2026-10-12","payload":{}}');
    raise exception 'expected version_conflict';
  exception when others then
    assert sqlerrm = 'version_conflict', 'got ' || sqlerrm;
  end;
  assert (select count(*) from public.game_events where type = 'x') = 0, 'no event on conflict';
end $$;

-- duplicate idempotency key is rejected
do $$ begin
  begin
    perform public.commit_turn('00000000-0000-0000-0000-00000000000a', 2, '{}', '{"type":"logHabit","date":"2026-10-12","payload":{},"idempotencyKey":"k1"}');
    raise exception 'expected unique violation';
  exception when unique_violation then null;
  end;
  assert (select version from public.player_state where player_id = '00000000-0000-0000-0000-00000000000a') = 2, 'rolled back';
end $$;

-- events are append-only
do $$ begin
  begin
    update public.game_events set type = 'hacked';
    raise exception 'expected append-only error';
  exception when others then
    assert sqlerrm = 'game_events is append-only', sqlerrm;
  end;
end $$;
reset role;

-- RLS: bob sees his own state only, sees alice's public profile, cannot write anything
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
do $$ begin
  assert (select count(*) from public.player_state) = 1, 'own state only';
  assert (select count(*) from public.habits) = 0, 'cannot see alice habits';
  assert (select count(*) from public.habit_logs) = 0, 'cannot see alice logs';
  assert (select count(*) from public.players) = 2, 'public profiles visible';
  begin
    update public.player_state set state = '{}' where true;
    raise exception 'expected permission error';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.commit_turn('00000000-0000-0000-0000-00000000000b', 1, '{}');
    raise exception 'expected permission error on commit_turn';
  exception when insufficient_privilege then null;
  end;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
do $$ begin
  assert (select count(*) from public.habits) = 1, 'alice sees her habit';
  assert (public.export_my_data()->'habits'->0->>'name') = 'Walk home', 'export works';
end $$;
reset role;

-- account deletion cascades through the append-only ledger
delete from auth.users where id = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  assert (select count(*) from public.game_events where player_id = '00000000-0000-0000-0000-00000000000a') = 0, 'events deleted with account';
end $$;
\echo 'schema tests passed'
