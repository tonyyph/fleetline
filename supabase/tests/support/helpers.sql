-- Test helpers. Loaded after migrations, as the superuser.
create schema tests;
grant usage on schema tests to anon, authenticated;

create function tests.create_user() returns uuid
language sql security definer
as $$ insert into auth.users default values returning id $$;

-- Switch the session to a signed-in user. Call `reset role;` (as SQL) to go back to the superuser.
create function tests.login(uid uuid) returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, false);
  perform set_config('role', 'authenticated', false);
end;
$$;

create function tests.login_anon() returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', '{"role":"anon"}', false);
  perform set_config('role', 'anon', false);
end;
$$;

-- Assert that `sql` fails with exactly `expected` as the error message.
create function tests.throws(sql text, expected text, label text) returns void
language plpgsql
as $$
begin
  begin
    execute sql;
  exception when others then
    if sqlerrm <> expected then
      raise exception 'FAIL %: expected error "%", got "%"', label, expected, sqlerrm;
    end if;
    raise notice 'ok   %', label;
    return;
  end;
  raise exception 'FAIL %: expected error "%", but it succeeded', label, expected;
end;
$$;

-- Assert that `sql` fails with any error (used for privilege checks, whose wording varies).
create function tests.denied(sql text, label text) returns void
language plpgsql
as $$
begin
  begin
    execute sql;
  exception when others then
    raise notice 'ok   % (%)', label, sqlerrm;
    return;
  end;
  raise exception 'FAIL %: expected the statement to be refused', label;
end;
$$;

create function tests.ok(cond boolean, label text) returns void
language plpgsql
as $$
begin
  if cond is not true then
    raise exception 'FAIL %', label;
  end if;
  raise notice 'ok   %', label;
end;
$$;

-- Fleet with ships on rows 1, 3, 5, 7, 9 (cells 0-4, 20-23, 40-42, 60-62, 80-81).
create function tests.fleet() returns jsonb
language sql immutable
as $$ select '[{"id":"carrier","x":0,"y":0,"o":"h"},{"id":"battleship","x":0,"y":2,"o":"h"},
  {"id":"cruiser","x":0,"y":4,"o":"h"},{"id":"submarine","x":0,"y":6,"o":"h"},
  {"id":"destroyer","x":0,"y":8,"o":"h"}]'::jsonb $$;

create function tests.ship_cells() returns int[]
language sql immutable
as $$ select array[0,1,2,3,4,20,21,22,23,40,41,42,60,61,62,80,81] $$;

grant execute on all functions in schema tests to anon, authenticated;
