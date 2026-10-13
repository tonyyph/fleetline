select tests.create_user() as alice \gset
select tests.create_user() as bob \gset
select tests.create_user() as carol \gset

select tests.login(:'alice');
select * from public.create_room() \gset room_
select tests.ok(:'room_code' ~ '^[A-Z2-9]{6}$', 'room code is 6 unambiguous characters');
select tests.ok(:'room_status' = 'waiting', 'new room is waiting');
select tests.ok((public.create_room()).id = :'room_id', 'creating again returns the same room');
select tests.throws(format('select public.join_room(%L)', :'room_code'), 'own_room', 'cannot join own room');
reset role;

select tests.login(:'bob');
select tests.ok(not exists (select 1 from public.matches where id = :'room_id'), 'non-member cannot see the room');
select tests.throws('select public.join_room(''abc'')', 'invalid_code', 'malformed code rejected');
select tests.throws('select public.join_room(''ZZZZZZ'')', 'room_not_found', 'unknown code rejected');
select tests.ok((public.join_room(lower(:'room_code'))).status = 'placing', 'join is case-insensitive and starts placement');
select tests.ok((public.join_room(:'room_code')).id = :'room_id', 're-joining is idempotent');
select tests.ok(exists (select 1 from public.matches where id = :'room_id'), 'member can see the match');
select tests.throws(format('select public.cancel_room(%L)', :'room_id'), 'room_started', 'guest cannot cancel');
select tests.throws('select public.create_room()', 'already_in_match', 'cannot open a second match');
reset role;

select tests.login(:'carol');
select tests.throws(format('select public.join_room(%L)', :'room_code'), 'room_full', 'third player rejected');
select tests.throws(format('select public.cancel_room(%L)', :'room_id'), 'match_not_found', 'outsider cannot cancel');
select tests.throws(format('select public.surrender(%L)', :'room_id'), 'match_not_found', 'outsider cannot surrender');
select tests.throws(format('select public.place_fleet(%L, tests.fleet())', :'room_id'), 'match_not_found', 'outsider cannot place');

-- Cancelled rooms cannot be joined.
select * from public.create_room() \gset croom_
select tests.ok((public.cancel_room(:'croom_id')).status = 'cancelled', 'owner can cancel a waiting room');
reset role;
select tests.login(:'alice');
reset role;
select tests.create_user() as dave \gset
select tests.login(:'dave');
select tests.throws(format('select public.join_room(%L)', :'croom_code'), 'room_not_found', 'cancelled room cannot be joined');
reset role;
