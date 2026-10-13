-- Fleetline core schema: profiles, matches, private fleets, shots, matchmaking queue.
--
-- Security model
--   * Clients only ever SELECT, and RLS limits what they see. Every write goes through a
--     SECURITY DEFINER function below that checks auth.uid(), membership, turn and state.
--   * Public match state (matches, shots) is separate from secret state (fleets). Fleets are
--     readable only by their owner until the match is over, and are not in the Realtime
--     publication, so they can never be broadcast.
--   * Mutations lock the match row (FOR UPDATE), so two shots or two joins cannot interleave.
--   * Per-user operations that may create a match first lock the caller's profile row
--     (FOR NO KEY UPDATE: serialises the user without blocking foreign-key checks).
--
-- Errors are raised as `raise exception '<code>'` with a short snake_case code that the app
-- maps to a message (src/lib/supabase/errors.ts).

create schema if not exists private;
revoke all on schema private from public;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.match_kind as enum ('room', 'quick', 'rematch');
create type public.match_status as enum ('waiting', 'placing', 'active', 'finished', 'cancelled');
create type public.finish_reason as enum ('sunk', 'surrender', 'abandoned');
create type public.shot_result as enum ('miss', 'hit', 'sunk');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  kind public.match_kind not null,
  -- Room code, only for kind = 'room'. Unique among waiting rooms (index below).
  code text check (code is null or code ~ '^[A-Z2-9]{6}$'),
  status public.match_status not null,
  player1 uuid not null references public.profiles (id) on delete cascade,
  player2 uuid references public.profiles (id) on delete cascade,
  p1_ready boolean not null default false,
  p2_ready boolean not null default false,
  turn uuid,
  turn_number integer not null default 0,
  winner uuid,
  finish_reason public.finish_reason,
  p1_seen_at timestamptz,
  p2_seen_at timestamptz,
  p1_rematch boolean not null default false,
  p2_rematch boolean not null default false,
  rematch_of uuid references public.matches (id) on delete set null,
  rematch_id uuid references public.matches (id) on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint matches_distinct_players check (player2 is null or player1 <> player2),
  constraint matches_turn_is_player check (turn is null or turn = player1 or turn = player2),
  constraint matches_winner_is_player check (winner is null or winner = player1 or winner = player2)
);

create unique index matches_waiting_code_key on public.matches (code) where status = 'waiting';
create index matches_code_idx on public.matches (code);
create index matches_player1_idx on public.matches (player1, status);
create index matches_player2_idx on public.matches (player2, status);

-- Secret: ship positions. `ships` is [{id, cells: [..]}], `cells` all 17 occupied cells.
create table public.fleets (
  match_id uuid not null references public.matches (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  ships jsonb not null,
  cells smallint[] not null,
  created_at timestamptz not null default now(),
  primary key (match_id, user_id)
);

create table public.shots (
  -- Client-generated id doubles as the idempotency key for public.fire.
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  shooter uuid not null references public.profiles (id) on delete cascade,
  cell smallint not null check (cell between 0 and 99),
  result public.shot_result not null,
  -- Cells of the ship this shot sank (public once sunk, as in the board game).
  sunk_cells smallint[],
  turn_number integer not null,
  created_at timestamptz not null default now(),
  unique (match_id, shooter, cell)
);

create index shots_match_idx on public.shots (match_id, turn_number);

create table public.matchmaking_queue (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  enqueued_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index matchmaking_queue_enqueued_idx on public.matchmaking_queue (enqueued_at);

-- ---------------------------------------------------------------------------
-- Row Level Security: read-only access for members; no write policies at all.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.matches enable row level security;
alter table public.fleets enable row level security;
alter table public.shots enable row level security;
alter table public.matchmaking_queue enable row level security;

revoke all on public.profiles, public.matches, public.fleets, public.shots, public.matchmaking_queue
  from anon, authenticated;
grant select on public.profiles, public.matches, public.fleets, public.shots, public.matchmaking_queue
  to authenticated;

create policy "profiles are readable by signed-in players"
  on public.profiles for select to authenticated
  using (true);

create policy "members read their matches"
  on public.matches for select to authenticated
  using ((select auth.uid()) in (player1, player2));

create policy "owners read their fleet; opponents only after the match ends"
  on public.fleets for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.matches m
      where m.id = fleets.match_id
        and m.status = 'finished'
        and (select auth.uid()) in (m.player1, m.player2)
    )
  );

create policy "members read shots of their matches"
  on public.shots for select to authenticated
  using (
    exists (
      select 1 from public.matches m
      where m.id = shots.match_id
        and (select auth.uid()) in (m.player1, m.player2)
    )
  );

create policy "players read their own queue entry"
  on public.matchmaking_queue for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Private helpers (not exposed through the API: the `private` schema is not in PostgREST).
-- ---------------------------------------------------------------------------

create function private.require_uid()
returns uuid
language plpgsql stable
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  return uid;
end;
$$;

-- Serialise match-creating operations per user. NO KEY UPDATE does not block FK checks.
create function private.lock_user(uid uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform 1 from public.profiles where id = uid for no key update;
  if not found then
    raise exception 'no_profile';
  end if;
end;
$$;

create function private.open_match_for(uid uuid)
returns public.matches
language sql stable
set search_path = ''
as $$
  select m.* from public.matches m
  where uid in (m.player1, m.player2)
    and m.status in ('waiting', 'placing', 'active')
  order by m.created_at desc
  limit 1;
$$;

create function private.random_code()
returns text
language sql volatile
set search_path = ''
as $$
  -- 32 unambiguous characters (no 0/O, 1/I), 6 long: ~10^9 codes.
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
  from generate_series(1, 6);
$$;

-- Validate a fleet sent by a client and return it normalised as {ships: [{id, cells}], cells}.
-- Input: [{"id": "carrier", "x": 0, "y": 0, "o": "h"}, ...] — one of each ship.
create function private.normalise_fleet(input jsonb)
returns jsonb
language plpgsql immutable
set search_path = ''
as $$
declare
  lengths constant jsonb := '{"carrier":5,"battleship":4,"cruiser":3,"submarine":3,"destroyer":2}';
  ship jsonb;
  ship_id text;
  len int;
  x int;
  y int;
  o text;
  i int;
  ship_cells smallint[];
  all_cells smallint[] := '{}';
  ships jsonb := '[]';
  seen text[] := '{}';
begin
  if input is null or jsonb_typeof(input) <> 'array' or jsonb_array_length(input) <> 5 then
    raise exception 'invalid_fleet';
  end if;

  for ship in select value from jsonb_array_elements(input) loop
    if jsonb_typeof(ship) <> 'object'
      or jsonb_typeof(ship -> 'id') <> 'string'
      or jsonb_typeof(ship -> 'x') <> 'number'
      or jsonb_typeof(ship -> 'y') <> 'number'
      or jsonb_typeof(ship -> 'o') <> 'string' then
      raise exception 'invalid_fleet';
    end if;

    ship_id := ship ->> 'id';
    if not lengths ? ship_id or ship_id = any (seen) then
      raise exception 'invalid_fleet';
    end if;
    seen := seen || ship_id;

    -- Reject 1.5 and friends: the text form must be a plain integer.
    if (ship ->> 'x') !~ '^[0-9]$' or (ship ->> 'y') !~ '^[0-9]$' then
      raise exception 'invalid_fleet';
    end if;
    x := (ship ->> 'x')::int;
    y := (ship ->> 'y')::int;
    o := ship ->> 'o';
    if o not in ('h', 'v') then
      raise exception 'invalid_fleet';
    end if;

    len := (lengths ->> ship_id)::int;
    ship_cells := '{}';
    for i in 0 .. len - 1 loop
      if (o = 'h' and x + i > 9) or (o = 'v' and y + i > 9) then
        raise exception 'invalid_fleet';
      end if;
      ship_cells := ship_cells || (case when o = 'h' then y * 10 + x + i else (y + i) * 10 + x end)::smallint;
    end loop;

    if all_cells && ship_cells then
      raise exception 'invalid_fleet';
    end if;
    all_cells := all_cells || ship_cells;
    ships := ships || jsonb_build_array(jsonb_build_object('id', ship_id, 'cells', to_jsonb(ship_cells)));
  end loop;

  return jsonb_build_object('ships', ships, 'cells', to_jsonb(all_cells));
end;
$$;

-- Load a match the caller belongs to, locked. Non-members get the same error as a missing match.
create function private.lock_member_match(p_match_id uuid, uid uuid)
returns public.matches
language plpgsql
set search_path = ''
as $$
declare
  m public.matches;
begin
  select * into m from public.matches where id = p_match_id for update;
  if not found or uid is distinct from m.player1 and uid is distinct from m.player2 then
    raise exception 'match_not_found';
  end if;
  return m;
end;
$$;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create function private.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, 'Thuyền trưởng ' || lpad((floor(random() * 10000))::int::text, 4, '0'))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create function public.set_display_name(p_name text)
returns public.profiles
language plpgsql security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_uid();
  clean text := regexp_replace(trim(coalesce(p_name, '')), '\s+', ' ', 'g');
  p public.profiles;
begin
  if char_length(clean) not between 2 and 20 or clean ~ '[[:cntrl:]]' then
    raise exception 'invalid_name';
  end if;
  insert into public.profiles (id, display_name) values (uid, clean)
  on conflict (id) do update set display_name = excluded.display_name, updated_at = now()
  returning * into p;
  return p;
end;
$$;

-- Fallback for users created before the trigger existed (or if it was skipped).
create function public.ensure_profile()
returns public.profiles
language plpgsql security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_uid();
  p public.profiles;
begin
  insert into public.profiles (id, display_name)
  values (uid, 'Thuyền trưởng ' || lpad((floor(random() * 10000))::int::text, 4, '0'))
  on conflict (id) do nothing;
  select * into p from public.profiles where id = uid;
  return p;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rooms
-- ---------------------------------------------------------------------------

create function public.create_room()
returns public.matches
language plpgsql security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_uid();
  m public.matches;
  attempt int;
begin
  perform private.lock_user(uid);
  delete from public.matchmaking_queue where user_id = uid;

  m := private.open_match_for(uid);
  if m.id is not null then
    -- Pressing "create" twice returns the same room.
    if m.status = 'waiting' and m.player1 = uid then
      return m;
    end if;
    raise exception 'already_in_match';
  end if;

  for attempt in 1 .. 20 loop
    begin
      insert into public.matches (kind, code, status, player1, p1_seen_at)
      values ('room', private.random_code(), 'waiting', uid, now())
      returning * into m;
      return m;
    exception when unique_violation then
      -- Code already used by another waiting room; try another.
    end;
  end loop;
  raise exception 'code_exhausted';
end;
$$;

create function public.join_room(p_code text)
returns public.matches
language plpgsql security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_uid();
  clean text := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
  m public.matches;
  mine public.matches;
begin
  if clean !~ '^[A-Z2-9]{6}$' then
    raise exception 'invalid_code';
  end if;

  perform private.lock_user(uid);
  delete from public.matchmaking_queue where user_id = uid;

  select * into m from public.matches
  where code = clean
  order by (status = 'waiting') desc, created_at desc
  limit 1
  for update;

  if not found or m.status = 'cancelled' then
    raise exception 'room_not_found';
  end if;

  -- Retrying a join that already succeeded is fine.
  if m.player2 = uid then
    return m;
  end if;
  if m.player1 = uid then
    raise exception 'own_room';
  end if;
  if m.status <> 'waiting' then
    raise exception using message = case when m.player2 is not null then 'room_full' else 'room_started' end;
  end if;
  if m.created_at < now() - interval '1 day' then
    update public.matches set status = 'cancelled', updated_at = now() where id = m.id;
    raise exception 'room_not_found';
  end if;

  mine := private.open_match_for(uid);
  if mine.id is not null then
    raise exception 'already_in_match';
  end if;

  update public.matches
  set player2 = uid, status = 'placing', p2_seen_at = now(), updated_at = now()
  where id = m.id
  returning * into m;
  return m;
end;
$$;

create function public.cancel_room(p_match_id uuid)
returns public.matches
language plpgsql security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_uid();
  m public.matches := private.lock_member_match(p_match_id, uid);
begin
  if m.status = 'cancelled' then
    return m;
  end if;
  if m.status <> 'waiting' or m.player1 <> uid then
    raise exception 'room_started';
  end if;
  update public.matches set status = 'cancelled', updated_at = now()
  where id = m.id returning * into m;
  return m;
end;
$$;

-- ---------------------------------------------------------------------------
-- Matchmaking. The app calls join_queue every few seconds while searching: each call is
-- also the heartbeat, and entries not refreshed for 20 s are ignored and later removed.
-- ---------------------------------------------------------------------------

create function public.join_queue()
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_uid();
  m public.matches;
  other uuid;
  entry public.matchmaking_queue;
begin
  perform private.lock_user(uid);
  -- Pairing is serialised globally. Row-level SKIP LOCKED pairing livelocks when every player
  -- polls at the same moment (each holds its own entry and skips the others); one short
  -- critical section avoids that and makes double-pairing impossible.
  perform pg_advisory_xact_lock(7262021);

  m := private.open_match_for(uid);
  if m.id is not null then
    if m.status = 'waiting' and m.player1 = uid then
      -- Quick play replaces an unanswered private room.
      update public.matches set status = 'cancelled', updated_at = now() where id = m.id;
    else
      delete from public.matchmaking_queue where user_id = uid;
      return jsonb_build_object('status', 'matched', 'match_id', m.id);
    end if;
  end if;

  -- Housekeeping, safe to repeat: drop entries nobody refreshed for a minute.
  delete from public.matchmaking_queue where last_seen_at < now() - interval '60 seconds';

  -- Oldest live opponent. FOR UPDATE waits out a concurrent create_room/join_room by that
  -- player (which deletes their entry), so we never pair someone who just left.
  select q.user_id into other
  from public.matchmaking_queue q
  where q.user_id <> uid
    and q.last_seen_at > now() - interval '20 seconds'
    and not exists (
      select 1 from public.matches x
      where q.user_id in (x.player1, x.player2) and x.status in ('placing', 'active')
    )
  order by q.enqueued_at
  limit 1
  for update;

  if other is not null then
    insert into public.matches (kind, status, player1, player2, p1_seen_at, p2_seen_at)
    values ('quick', 'placing', other, uid, now(), now())
    returning * into m;
    delete from public.matchmaking_queue where user_id in (uid, other);
    return jsonb_build_object('status', 'matched', 'match_id', m.id);
  end if;

  insert into public.matchmaking_queue (user_id) values (uid)
  on conflict (user_id) do update set last_seen_at = now()
  returning * into entry;
  return jsonb_build_object('status', 'waiting', 'since', entry.enqueued_at);
end;
$$;

create function public.leave_queue()
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_uid();
  m public.matches;
begin
  perform private.lock_user(uid);
  delete from public.matchmaking_queue where user_id = uid;
  -- We may have been paired a moment before cancelling; tell the app so it can go to the match.
  m := private.open_match_for(uid);
  if m.id is not null and m.status <> 'waiting' then
    return jsonb_build_object('status', 'matched', 'match_id', m.id);
  end if;
  return jsonb_build_object('status', 'left');
end;
$$;

-- ---------------------------------------------------------------------------
-- Match play
-- ---------------------------------------------------------------------------

create function public.place_fleet(p_match_id uuid, p_ships jsonb)
returns public.matches
language plpgsql security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_uid();
  m public.matches := private.lock_member_match(p_match_id, uid);
  fleet jsonb;
begin
  if exists (select 1 from public.fleets where match_id = m.id and user_id = uid) then
    -- Already locked in (e.g. a retried request): nothing to do.
    return m;
  end if;
  if m.status <> 'placing' then
    raise exception 'not_placing';
  end if;

  fleet := private.normalise_fleet(p_ships);
  insert into public.fleets (match_id, user_id, ships, cells)
  values (
    m.id, uid, fleet -> 'ships',
    array(select jsonb_array_elements_text(fleet -> 'cells')::smallint)
  );

  if uid = m.player1 then
    m.p1_ready := true;
  else
    m.p2_ready := true;
  end if;

  if m.p1_ready and m.p2_ready then
    update public.matches
    set p1_ready = true, p2_ready = true, status = 'active',
        turn = case when random() < 0.5 then player1 else player2 end,
        turn_number = 1, started_at = now(), updated_at = now()
    where id = m.id returning * into m;
  else
    update public.matches
    set p1_ready = m.p1_ready, p2_ready = m.p2_ready, updated_at = now()
    where id = m.id returning * into m;
  end if;
  return m;
end;
$$;

create function public.fire(p_match_id uuid, p_cell integer, p_shot_id uuid default null)
returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_uid();
  m public.matches;
  prev public.shots;
  opponent uuid;
  target_fleet public.fleets;
  ship jsonb;
  ship_cells smallint[];
  my_hits smallint[];
  outcome public.shot_result := 'miss';
  sunk smallint[];
  s public.shots;
begin
  if p_cell is null or p_cell < 0 or p_cell > 99 then
    raise exception 'invalid_cell';
  end if;

  m := private.lock_member_match(p_match_id, uid);

  -- Idempotency: a retried request with the same shot id returns the original outcome.
  if p_shot_id is not null then
    select * into prev from public.shots where id = p_shot_id;
    if found then
      if prev.shooter <> uid or prev.match_id <> m.id or prev.cell <> p_cell then
        raise exception 'invalid_shot_id';
      end if;
      return jsonb_build_object(
        'shot', to_jsonb(prev), 'status', m.status, 'turn', m.turn, 'winner', m.winner,
        'updated_at', m.updated_at
      );
    end if;
  end if;

  if m.status <> 'active' then
    raise exception 'not_active';
  end if;
  if m.turn is distinct from uid then
    raise exception 'not_your_turn';
  end if;
  if exists (select 1 from public.shots where match_id = m.id and shooter = uid and cell = p_cell) then
    raise exception 'already_fired';
  end if;

  opponent := case when uid = m.player1 then m.player2 else m.player1 end;
  select * into target_fleet from public.fleets where match_id = m.id and user_id = opponent;
  if not found then
    raise exception 'fleet_missing';
  end if;

  if p_cell::smallint = any (target_fleet.cells) then
    outcome := 'hit';
    select array_agg(cell) into my_hits
    from public.shots where match_id = m.id and shooter = uid and result <> 'miss';
    my_hits := coalesce(my_hits, '{}') || p_cell::smallint;

    for ship in select value from jsonb_array_elements(target_fleet.ships) loop
      ship_cells := array(select jsonb_array_elements_text(ship -> 'cells')::smallint);
      if p_cell::smallint = any (ship_cells) then
        if ship_cells <@ my_hits then
          outcome := 'sunk';
          sunk := ship_cells;
        end if;
        exit;
      end if;
    end loop;
  end if;

  insert into public.shots (id, match_id, shooter, cell, result, sunk_cells, turn_number)
  values (coalesce(p_shot_id, gen_random_uuid()), m.id, uid, p_cell, outcome, sunk, m.turn_number)
  returning * into s;

  if outcome = 'sunk' and target_fleet.cells <@ my_hits then
    update public.matches
    set status = 'finished', winner = uid, finish_reason = 'sunk', turn = null,
        finished_at = now(), updated_at = now()
    where id = m.id returning * into m;
  else
    -- Classic rules: turns alternate after every shot, hit or miss.
    update public.matches
    set turn = opponent, turn_number = turn_number + 1, updated_at = now()
    where id = m.id returning * into m;
  end if;

  return jsonb_build_object(
    'shot', to_jsonb(s), 'status', m.status, 'turn', m.turn, 'winner', m.winner,
    'updated_at', m.updated_at
  );
end;
$$;

create function public.surrender(p_match_id uuid)
returns public.matches
language plpgsql security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_uid();
  m public.matches := private.lock_member_match(p_match_id, uid);
begin
  if m.status = 'finished' then
    return m;
  end if;
  if m.status not in ('placing', 'active') then
    raise exception 'not_active';
  end if;
  update public.matches
  set status = 'finished', finish_reason = 'surrender', turn = null,
      winner = case when uid = player1 then player2 else player1 end,
      finished_at = now(), updated_at = now()
  where id = m.id returning * into m;
  return m;
end;
$$;

-- Liveness ping from the match screen (every ~10 s). Only touches the caller's own column.
create function public.heartbeat(p_match_id uuid)
returns timestamptz
language plpgsql security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_uid();
begin
  update public.matches
  set p1_seen_at = case when uid = player1 then now() else p1_seen_at end,
      p2_seen_at = case when uid = player2 then now() else p2_seen_at end
  where id = p_match_id
    and uid in (player1, player2)
    and status in ('waiting', 'placing', 'active');
  return now();
end;
$$;

-- Win by forfeit, only after the opponent has been silent for 2 minutes (checked here,
-- not trusted from the client). Short disconnects never end a match.
create function public.claim_abandoned(p_match_id uuid)
returns public.matches
language plpgsql security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_uid();
  m public.matches := private.lock_member_match(p_match_id, uid);
  opponent_seen timestamptz;
begin
  if m.status not in ('placing', 'active') then
    raise exception 'not_active';
  end if;
  opponent_seen := case when uid = m.player1 then m.p2_seen_at else m.p1_seen_at end;
  if coalesce(opponent_seen, m.created_at) > now() - interval '120 seconds' then
    raise exception 'opponent_active';
  end if;
  update public.matches
  set status = 'finished', finish_reason = 'abandoned', winner = uid, turn = null,
      finished_at = now(), updated_at = now()
  where id = m.id returning * into m;
  return m;
end;
$$;

-- Both players must ask; the second request creates the new match for both.
create function public.request_rematch(p_match_id uuid)
returns public.matches
language plpgsql security definer
set search_path = ''
as $$
declare
  uid uuid := private.require_uid();
  m public.matches;
  opponent uuid;
  busy public.matches;
  next_match public.matches;
begin
  perform private.lock_user(uid);
  m := private.lock_member_match(p_match_id, uid);
  if m.status <> 'finished' then
    raise exception 'not_finished';
  end if;
  if m.rematch_id is not null then
    return m;
  end if;

  busy := private.open_match_for(uid);
  if busy.id is not null then
    raise exception 'already_in_match';
  end if;

  if uid = m.player1 then
    m.p1_rematch := true;
    opponent := m.player2;
  else
    m.p2_rematch := true;
    opponent := m.player1;
  end if;

  if m.p1_rematch and m.p2_rematch then
    busy := private.open_match_for(opponent);
    if busy.id is not null then
      raise exception 'opponent_busy';
    end if;
    insert into public.matches (kind, status, player1, player2, rematch_of, p1_seen_at, p2_seen_at)
    values ('rematch', 'placing', m.player1, m.player2, m.id, now(), now())
    returning * into next_match;
    update public.matches
    set p1_rematch = true, p2_rematch = true, rematch_id = next_match.id, updated_at = now()
    where id = m.id returning * into m;
  else
    update public.matches
    set p1_rematch = m.p1_rematch, p2_rematch = m.p2_rematch, updated_at = now()
    where id = m.id returning * into m;
  end if;
  return m;
end;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges: only signed-in users may call the API; helpers are not callable.
-- (Supabase grants EXECUTE to anon by default, so revoke explicitly.)
-- ---------------------------------------------------------------------------

revoke all on all functions in schema private from public, anon, authenticated;

revoke execute on function
  public.set_display_name(text),
  public.ensure_profile(),
  public.create_room(),
  public.join_room(text),
  public.cancel_room(uuid),
  public.join_queue(),
  public.leave_queue(),
  public.place_fleet(uuid, jsonb),
  public.fire(uuid, integer, uuid),
  public.surrender(uuid),
  public.heartbeat(uuid),
  public.claim_abandoned(uuid),
  public.request_rematch(uuid)
from public, anon;

grant execute on function
  public.set_display_name(text),
  public.ensure_profile(),
  public.create_room(),
  public.join_room(text),
  public.cancel_room(uuid),
  public.join_queue(),
  public.leave_queue(),
  public.place_fleet(uuid, jsonb),
  public.fire(uuid, integer, uuid),
  public.surrender(uuid),
  public.heartbeat(uuid),
  public.claim_abandoned(uuid),
  public.request_rematch(uuid)
to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: public state only. `fleets` and `matchmaking_queue` are deliberately absent.
-- Postgres Changes applies the SELECT policies above to every subscriber.
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.matches, public.shots;
