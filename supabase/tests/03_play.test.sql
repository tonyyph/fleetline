select tests.create_user() as alice \gset
select tests.create_user() as bob \gset
select tests.create_user() as eve \gset

select tests.login(:'alice');
select * from public.create_room() \gset room_
reset role;
select tests.login(:'bob');
select public.join_room(:'room_code');

-- ---- Fleet validation ----
select tests.throws(format('select public.fire(%L, 5)', :'room_id'), 'not_active', 'cannot fire during placement');
select tests.throws(format('select public.place_fleet(%L, %L)', :'room_id', '[]'), 'invalid_fleet', 'empty fleet');
select tests.throws(format('select public.place_fleet(%L, %L)', :'room_id',
  jsonb_set(tests.fleet(), '{4}', '{"id":"destroyer","x":0,"y":0,"o":"v"}')), 'invalid_fleet', 'overlapping ships');
select tests.throws(format('select public.place_fleet(%L, %L)', :'room_id',
  jsonb_set(tests.fleet(), '{4}', '{"id":"destroyer","x":9,"y":9,"o":"h"}')), 'invalid_fleet', 'ship off the board');
select tests.throws(format('select public.place_fleet(%L, %L)', :'room_id',
  jsonb_set(tests.fleet(), '{4}', '{"id":"carrier","x":5,"y":9,"o":"h"}')), 'invalid_fleet', 'duplicate ship');
select tests.throws(format('select public.place_fleet(%L, %L)', :'room_id',
  jsonb_set(tests.fleet(), '{4}', '{"id":"destroyer","x":1.5,"y":9,"o":"h"}')), 'invalid_fleet', 'fractional coordinate');
select tests.throws(format('select public.place_fleet(%L, %L)', :'room_id',
  jsonb_set(tests.fleet(), '{4}', '{"id":"destroyer","x":-1,"y":9,"o":"h"}')), 'invalid_fleet', 'negative coordinate');
select tests.throws(format('select public.place_fleet(%L, %L)', :'room_id',
  jsonb_set(tests.fleet(), '{4}', '{"id":"destroyer","x":5,"y":9,"o":"d"}')), 'invalid_fleet', 'bad orientation');
select tests.throws(format('select public.place_fleet(%L, %L)', :'room_id',
  tests.fleet() || '[{"id":"destroyer","x":5,"y":9,"o":"h"}]'), 'invalid_fleet', 'six ships');
select tests.throws(format('select public.place_fleet(%L, %L)', :'room_id', '{"ships":1}'), 'invalid_fleet', 'not an array');

select tests.ok((public.place_fleet(:'room_id', tests.fleet())).p2_ready, 'bob locks his fleet');
select tests.ok((public.place_fleet(:'room_id', '[]')).p2_ready, 'locking again is a no-op, not an overwrite');
select tests.ok((select count(*) from public.fleets where match_id = :'room_id') = 1, 'bob sees only his own fleet');
reset role;

select tests.login(:'alice');
select tests.ok(not exists (select 1 from public.fleets where user_id = :'bob'), 'alice cannot read bob''s fleet');
select * from public.place_fleet(:'room_id', tests.fleet()) \gset m_
select tests.ok(:'m_status' = 'active' and :'m_turn' in (:'alice', :'bob'), 'both ready starts the match with a server-chosen turn');
select tests.ok(not exists (select 1 from public.fleets where user_id = :'bob'), 'still no peeking once active');
reset role;

-- Make the order deterministic for the rest of the test: alice shoots first.
update public.matches set turn = :'alice' where id = :'room_id';

-- ---- Turn order and shot validation ----
select tests.login(:'bob');
select tests.throws(format('select public.fire(%L, 0)', :'room_id'), 'not_your_turn', 'bob cannot shoot on alice''s turn');
reset role;
select tests.login(:'eve');
select tests.throws(format('select public.fire(%L, 0)', :'room_id'), 'match_not_found', 'outsider cannot shoot');
select tests.ok(not exists (select 1 from public.shots where match_id = :'room_id'), 'outsider cannot read shots');
reset role;

select tests.login(:'alice');
select tests.throws(format('select public.fire(%L, 100)', :'room_id'), 'invalid_cell', 'cell 100 rejected');
select tests.throws(format('select public.fire(%L, -1)', :'room_id'), 'invalid_cell', 'cell -1 rejected');
select tests.throws(format('select public.fire(%L, null)', :'room_id'), 'invalid_cell', 'null cell rejected');
select public.fire(:'room_id', 99, '00000000-0000-4000-8000-000000000001') ->> 'shot' as shot1 \gset
select tests.ok((:'shot1'::jsonb ->> 'result') = 'miss', 'open water is a miss');
-- Retry with the same id returns the same shot and does not shoot again.
select tests.ok((public.fire(:'room_id', 99, '00000000-0000-4000-8000-000000000001') -> 'shot' ->> 'id') = '00000000-0000-4000-8000-000000000001',
  'retrying a shot id is idempotent');
select tests.ok((select count(*) from public.shots where match_id = :'room_id') = 1, 'retry did not add a shot');
select tests.throws(format('select public.fire(%L, 98, %L)', :'room_id', '00000000-0000-4000-8000-000000000001'),
  'invalid_shot_id', 'reusing a shot id for another cell is refused');
select tests.throws(format('select public.fire(%L, 98)', :'room_id'), 'not_your_turn', 'turn passed to bob after a miss');
reset role;

select tests.login(:'bob');
select tests.ok((public.fire(:'room_id', 0) -> 'shot' ->> 'result') = 'hit', 'bob hits the carrier');
reset role;
select tests.login(:'alice');
select tests.throws(format('select public.fire(%L, 99)', :'room_id'), 'already_fired', 'repeat cell rejected');
reset role;

-- ---- Play the rest out: alice sinks everything, bob fires into the sea ----
select tests.login(:'alice');
select public.fire(:'room_id', 80);
reset role;
select tests.login(:'bob');
select public.fire(:'room_id', 9);
reset role;
select tests.login(:'alice');
select public.fire(:'room_id', 81) -> 'shot' as sink \gset
select tests.ok((:'sink'::jsonb ->> 'result') = 'sunk' and (:'sink'::jsonb -> 'sunk_cells') = '[80, 81]'::jsonb,
  'sinking reveals only that ship''s cells');
reset role;

select set_config('t.room', :'room_id', false);
select set_config('t.alice', :'alice', false);
select set_config('t.bob', :'bob', false);

-- Alternate: alice targets remaining ship cells, bob fires at cells 10..19, 30..39 (water).
do $$
declare
  room uuid := current_setting('t.room')::uuid;
  targets int[] := array[0,1,2,3,4,20,21,22,23,40,41,42,60,61,62];
  water int[] := array[10,11,12,13,14,15,16,17,18,19,30,31,32,33,34];
  i int;
  r jsonb;
begin
  for i in 1 .. array_length(targets, 1) loop
    perform tests.login(current_setting('t.bob')::uuid);
    perform public.fire(room, water[i]);
    reset role;
    perform tests.login(current_setting('t.alice')::uuid);
    r := public.fire(room, targets[i]);
    reset role;
  end loop;
  if r ->> 'status' <> 'finished' or r ->> 'winner' <> current_setting('t.alice') then
    raise exception 'FAIL last ship should end the match, got %', r;
  end if;
  raise notice 'ok   sinking the last ship finishes the match for the shooter';
end $$;

select tests.login(:'bob');
select tests.throws(format('select public.fire(%L, 50)', :'room_id'), 'not_active', 'no shots after the end');
select tests.ok((select count(*) from public.fleets where match_id = :'room_id') = 2, 'fleets revealed to both after the end');
select tests.ok((public.surrender(:'room_id')).finish_reason = 'sunk', 'surrender after the end changes nothing');
reset role;

-- ---- Surrender ----
select tests.login(:'alice');
select * from public.create_room() \gset r2_
reset role;
select tests.login(:'bob');
select public.join_room(:'r2_code');
select tests.ok((public.surrender(:'r2_id')).winner = :'alice', 'surrender hands the win to the opponent');
reset role;
select tests.login(:'eve');
select tests.ok(not exists (select 1 from public.fleets), 'outsider never sees any fleet');
reset role;
