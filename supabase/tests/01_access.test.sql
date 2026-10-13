-- Who can touch what, independent of game rules.
select tests.create_user() as alice \gset
select tests.create_user() as bob \gset

-- Profiles are created by the auth.users trigger.
select tests.ok((select count(*) from public.profiles where id in (:'alice', :'bob')) = 2,
  'signing up creates a profile');

-- Signed-out (anon key, no session) callers get nothing.
select tests.login_anon();
select tests.denied('select * from public.matches', 'anon cannot read matches');
select tests.denied('select * from public.fleets', 'anon cannot read fleets');
select tests.denied('select * from public.profiles', 'anon cannot read profiles');
select tests.denied('select public.create_room()', 'anon cannot create rooms');
select tests.denied('select public.join_queue()', 'anon cannot queue');
select tests.denied('select private.normalise_fleet(''[]'')', 'anon cannot call private helpers');
reset role;

select tests.login(:'alice');
select tests.denied(format('insert into public.matches (kind, status, player1) values (''room'', ''waiting'', %L)', :'alice'),
  'players cannot insert matches directly');
select tests.denied('update public.matches set status = ''finished''', 'players cannot update matches directly');
select tests.denied(format('insert into public.shots (match_id, shooter, cell, result, turn_number) values (gen_random_uuid(), %L, 1, ''hit'', 1)', :'alice'),
  'players cannot insert shots directly');
select tests.denied(format('insert into public.fleets (match_id, user_id, ships, cells) values (gen_random_uuid(), %L, ''[]'', ''{}'')', :'alice'),
  'players cannot insert fleets directly');
select tests.denied('update public.profiles set display_name = ''Hacker''', 'players cannot update profiles directly');
select tests.denied('delete from public.shots', 'players cannot delete shots');
select tests.denied('select private.normalise_fleet(''[]'')', 'players cannot call private helpers');
select tests.denied('select private.lock_user(auth.uid())', 'players cannot call lock helper');

-- Display names go through the RPC, which validates them.
select tests.ok((public.set_display_name('  Admiral   Ann ')).display_name = 'Admiral Ann', 'set_display_name trims');
select tests.throws('select public.set_display_name(''A'')', 'invalid_name', 'name too short');
select tests.throws('select public.set_display_name(repeat(''x'', 21))', 'invalid_name', 'name too long');
select tests.throws(format('select public.set_display_name(%L)', E'Bad\x01Name'), 'invalid_name', 'control characters rejected');
select tests.ok((select display_name from public.profiles where id = :'bob') like 'Thuyền trưởng %',
  'other profiles are readable (names only)');
reset role;

-- Secret tables stay out of Realtime.
select tests.ok(
  (select array_agg(tablename::text order by tablename) from pg_publication_tables where pubname = 'supabase_realtime')
    = array['matches', 'shots'],
  'only matches and shots are published to Realtime');

-- Every public table has RLS on.
select tests.ok(
  not exists (select 1 from pg_tables where schemaname = 'public' and not rowsecurity),
  'RLS enabled on every public table');

-- Every API function is SECURITY DEFINER with a pinned search_path.
select tests.ok(
  not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
  ),
  'all functions pin search_path');
