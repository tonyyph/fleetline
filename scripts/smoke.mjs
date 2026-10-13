// End-to-end smoke test against a real Supabase project (local or hosted).
// Two anonymous players: room → join → place → full game over RPC, with Realtime listening,
// plus the security checks a client can observe. Usage: `pnpm smoke` (reads .env).
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error(
    'Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY (see .env.example).',
  );
  process.exit(2);
}

const FLEET = [
  { id: 'carrier', x: 0, y: 0, o: 'h' },
  { id: 'battleship', x: 0, y: 2, o: 'h' },
  { id: 'cruiser', x: 0, y: 4, o: 'h' },
  { id: 'submarine', x: 0, y: 6, o: 'h' },
  { id: 'destroyer', x: 0, y: 8, o: 'h' },
];
const SHIP_CELLS = [0, 1, 2, 3, 4, 20, 21, 22, 23, 40, 41, 42, 60, 61, 62, 80, 81];
const WATER = Array.from({ length: 100 }, (_, i) => i).filter((c) => !SHIP_CELLS.includes(c));

let failures = 0;
const ok = (cond, label) => {
  console.log(`${cond ? 'ok  ' : 'FAIL'} ${label}`);
  if (!cond) failures++;
};

function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
  };
}

async function player(name) {
  const sb = createClient(url, key, {
    auth: { storage: memoryStorage(), persistSession: true, autoRefreshToken: false },
  });
  const { data, error } = await sb.auth.signInAnonymously();
  if (error)
    throw new Error(`anonymous sign-in failed (enable it in Auth → Providers): ${error.message}`);
  await sb.rpc('set_display_name', { p_name: name });
  return { sb, id: data.user.id };
}

const rpc = async (p, fn, args) => {
  const { data, error } = await p.sb.rpc(fn, args);
  return { data, error: error?.message ?? null };
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const a = await player('Smoke A');
const b = await player('Smoke B');
ok(a.id !== b.id, 'two distinct anonymous users');

// Clean slate: end anything these fresh users could be in (none expected).
const room = (await rpc(a, 'create_room')).data;
ok(/^[A-Z2-9]{6}$/.test(room?.code ?? ''), `room created with code ${room?.code}`);

// Realtime: A listens for shots and match updates; B also tries to listen to fleets.
const events = { shots: 0, matches: 0, fleets: 0 };
const chA = a.sb
  .channel(`smoke-${room.id}`)
  .on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'shots', filter: `match_id=eq.${room.id}` },
    () => events.shots++,
  )
  .on(
    'postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'matches', filter: `id=eq.${room.id}` },
    () => events.matches++,
  );
const chB = b.sb
  .channel(`smoke-fleets-${room.id}`)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'fleets' }, () => events.fleets++);
await Promise.all(
  [chA, chB].map(
    (ch) =>
      new Promise((resolve) =>
        ch.subscribe((s) => (s === 'SUBSCRIBED' || s === 'CHANNEL_ERROR') && resolve(s)),
      ),
  ),
);

ok(
  (await rpc(b, 'join_room', { p_code: room.code })).data?.status === 'placing',
  'B joins by code',
);

// Client-side attacks the server must refuse.
const direct = await b.sb
  .from('shots')
  .insert({ match_id: room.id, shooter: b.id, cell: 5, result: 'hit', turn_number: 1 });
ok(!!direct.error, 'direct insert into shots refused');
const directUpdate = await b.sb
  .from('matches')
  .update({ winner: b.id, status: 'finished' })
  .eq('id', room.id)
  .select();
ok(
  !!directUpdate.error || (directUpdate.data ?? []).length === 0,
  'direct update of matches refused',
);
ok(
  (await rpc(b, 'fire', { p_match_id: room.id, p_cell: 0 })).error === 'not_active',
  'cannot fire during placement',
);

await rpc(a, 'place_fleet', { p_match_id: room.id, p_ships: FLEET });
const bFleetsBefore = await b.sb.from('fleets').select('user_id').eq('match_id', room.id);
ok(
  (bFleetsBefore.data ?? []).every((f) => f.user_id === b.id),
  "B cannot read A's fleet during the match",
);
const started = (await rpc(b, 'place_fleet', { p_match_id: room.id, p_ships: FLEET })).data;
ok(started?.status === 'active', 'match starts when both fleets are locked');

// Play: A walks the ship cells, B fires into open water. Whoever has the turn shoots.
let match = started;
let ai = 0;
let bi = 0;
let guard = 0;
while (match.status === 'active' && guard++ < 200) {
  const shooter = match.turn === a.id ? a : b;
  const other = shooter === a ? b : a;
  if (guard === 1) {
    ok(
      (await rpc(other, 'fire', { p_match_id: room.id, p_cell: 99 })).error === 'not_your_turn',
      'out-of-turn shot refused',
    );
    ok(
      (await rpc(shooter, 'fire', { p_match_id: room.id, p_cell: 100 })).error === 'invalid_cell',
      'off-board shot refused',
    );
  }
  const cell = shooter === a ? SHIP_CELLS[ai++] : WATER[bi++];
  const res = await rpc(shooter, 'fire', {
    p_match_id: room.id,
    p_cell: cell,
    p_shot_id: crypto.randomUUID(),
  });
  if (res.error) {
    ok(false, `fire failed: ${res.error}`);
    break;
  }
  if (guard === 2) {
    ok(
      (await rpc(shooter, 'fire', { p_match_id: room.id, p_cell: cell })).error !== null,
      'repeat shot refused',
    );
  }
  match = { ...match, status: res.data.status, turn: res.data.turn, winner: res.data.winner };
}
ok(match.status === 'finished' && match.winner === a.id, 'A wins by sinking the whole fleet');

const bFleetsAfter = await b.sb.from('fleets').select('user_id').eq('match_id', room.id);
ok((bFleetsAfter.data ?? []).length === 2, 'fleets are revealed to both players after the match');

await wait(1500);
ok(events.shots > 0, `Realtime delivered ${events.shots} shot events to A`);
ok(events.matches > 0, `Realtime delivered ${events.matches} match updates to A`);
ok(events.fleets === 0, 'Realtime never delivered fleet rows');

// Rematch, then quick play.
await rpc(a, 'request_rematch', { p_match_id: room.id });
const rematch = (await rpc(b, 'request_rematch', { p_match_id: room.id })).data;
ok(!!rematch?.rematch_id, 'rematch created after both agree');
await rpc(a, 'surrender', { p_match_id: rematch.rematch_id });

ok((await rpc(a, 'join_queue')).data?.status === 'waiting', 'A waits in the quick-play queue');
const paired = (await rpc(b, 'join_queue')).data;
ok(paired?.status === 'matched', 'B is paired with A');
ok((await rpc(a, 'join_queue')).data?.match_id === paired?.match_id, 'A finds the same match');
await rpc(a, 'surrender', { p_match_id: paired.match_id });

await Promise.all([a.sb.removeAllChannels(), b.sb.removeAllChannels()]);
console.log(failures ? `\n${failures} check(s) failed` : '\nSmoke test passed');
process.exit(failures ? 1 : 0);
