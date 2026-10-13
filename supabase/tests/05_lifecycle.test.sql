select tests.create_user() as amy \gset
select tests.create_user() as bo \gset

select tests.login(:'amy');
select * from public.create_room() \gset room_
reset role;
select tests.login(:'bo');
select public.join_room(:'room_code');
select tests.throws(format('select public.request_rematch(%L)', :'room_id'), 'not_finished', 'no rematch mid-game');

-- ---- Heartbeat & abandonment ----
select tests.throws(format('select public.claim_abandoned(%L)', :'room_id'), 'opponent_active', 'cannot claim while opponent is around');
reset role;
update public.matches set p1_seen_at = now() - interval '60 seconds' where id = :'room_id';
select tests.login(:'bo');
select tests.throws(format('select public.claim_abandoned(%L)', :'room_id'), 'opponent_active', 'a one-minute drop is not abandonment');
reset role;
select tests.login(:'amy');
select public.heartbeat(:'room_id');
reset role;
select tests.ok((select p1_seen_at > now() - interval '5 seconds' from public.matches where id = :'room_id'), 'heartbeat refreshes own column');
update public.matches set p1_seen_at = now() - interval '3 minutes' where id = :'room_id';
select tests.login(:'bo');
select public.heartbeat(:'room_id');
select tests.ok((select p1_seen_at < now() - interval '2 minutes' from public.matches where id = :'room_id'),
  'heartbeat cannot refresh the opponent');
select * from public.claim_abandoned(:'room_id') \gset done_
select tests.ok(:'done_winner' = :'bo' and :'done_finish_reason' = 'abandoned', 'silent opponent can be claimed after 2 minutes');
reset role;

-- ---- Rematch ----
select tests.login(:'amy');
select tests.ok((public.request_rematch(:'room_id')).rematch_id is null, 'one request alone does not start a match');
select tests.ok((public.request_rematch(:'room_id')).p1_rematch, 'asking twice is harmless');
reset role;
select tests.login(:'bo');
select (public.request_rematch(:'room_id')).rematch_id as next_id \gset
select tests.ok(:'next_id' <> '', 'second request creates the rematch');
select tests.ok((select status from public.matches where id = :'next_id') = 'placing', 'rematch starts in placement');
select tests.ok((public.request_rematch(:'room_id')).rematch_id = :'next_id', 'repeat returns the same rematch');
reset role;
select tests.login(:'amy');
select tests.ok(exists (select 1 from public.matches where id = :'next_id'), 'both players see the rematch');
reset role;
