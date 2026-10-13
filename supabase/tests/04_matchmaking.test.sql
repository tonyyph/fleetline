select tests.create_user() as ann \gset
select tests.create_user() as ben \gset
select tests.create_user() as cat \gset
select tests.create_user() as dan \gset

-- A stale entry (no heartbeat for 30 s) must not be matched.
insert into public.matchmaking_queue (user_id, enqueued_at, last_seen_at)
values (:'dan', now() - interval '5 minutes', now() - interval '30 seconds');

select tests.login(:'ann');
select tests.ok((public.join_queue() ->> 'status') = 'waiting', 'first player waits');
select tests.ok((public.join_queue() ->> 'status') = 'waiting', 'polling again never matches yourself');
select tests.ok((select count(*) from public.matchmaking_queue) = 1, 'ann sees only her own queue entry');
reset role;

select tests.login(:'ben');
select public.join_queue() as ben_result \gset
select tests.ok((:'ben_result'::jsonb ->> 'status') = 'matched', 'second player is matched');
reset role;

select tests.login(:'ann');
select tests.ok((public.join_queue() ->> 'match_id') = (:'ben_result'::jsonb ->> 'match_id'),
  'the waiting player finds the same match on the next poll');
select tests.ok((public.leave_queue() ->> 'status') = 'matched', 'leaving after being paired reports the match');
select tests.ok((select status from public.matches where id = (:'ben_result'::jsonb ->> 'match_id')::uuid) = 'placing',
  'quick match starts in placement');
reset role;
select tests.ok(not exists (select 1 from public.matchmaking_queue where user_id in (:'ann', :'ben')),
  'matched players leave the queue');
select tests.ok(exists (select 1 from public.matchmaking_queue where user_id = :'dan'),
  'stale entry was skipped (cleanup only after a minute)');

select tests.login(:'cat');
select tests.ok((public.join_queue() ->> 'status') = 'waiting', 'cat is not paired with the stale entry');
select tests.ok((public.leave_queue() ->> 'status') = 'left', 'cat can leave the queue');
-- Quick play replaces an unanswered private room.
select (public.create_room()).id as cat_room \gset
select tests.ok((public.join_queue() ->> 'status') = 'waiting', 'queueing with an open room is allowed');
reset role;
select tests.ok((select status from public.matches where id = :'cat_room') = 'cancelled', '...and cancels that room');
