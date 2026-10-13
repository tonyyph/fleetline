// Races that a single psql session cannot express: parallel connections hitting the same rows.
// Run by scripts/test-db.sh against its throwaway cluster (PG* env vars).
import pg from 'pg';

const FLEET = [
  { id: 'carrier', x: 0, y: 0, o: 'h' },
  { id: 'battleship', x: 0, y: 2, o: 'h' },
  { id: 'cruiser', x: 0, y: 4, o: 'h' },
  { id: 'submarine', x: 0, y: 6, o: 'h' },
  { id: 'destroyer', x: 0, y: 8, o: 'h' },
];

let failures = 0;
const ok = (cond, label) => {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${label}`);
  if (!cond) failures++;
};

async function session(uid) {
  const c = new pg.Client();
  await c.connect();
  if (uid) await c.query('select tests.login($1)', [uid]);
  return c;
}

async function rpc(c, sql, params) {
  try {
    return { rows: (await c.query(sql, params)).rows };
  } catch (e) {
    return { error: e.message };
  }
}

const admin = await session();
const newUser = async () => (await admin.query('select tests.create_user() as id')).rows[0].id;
const newUsers = async (n) => {
  const ids = [];
  for (let i = 0; i < n; i++) ids.push(await newUser());
  return ids;
};

// 1. Two strangers join the same room at once: exactly one gets in.
{
  const [owner, a, b] = [await newUser(), await newUser(), await newUser()];
  const co = await session(owner);
  const code = (await co.query('select code from public.create_room()')).rows[0].code;
  const [ca, cb] = [await session(a), await session(b)];
  const results = await Promise.all([
    rpc(ca, 'select public.join_room($1)', [code]),
    rpc(cb, 'select public.join_room($1)', [code]),
  ]);
  ok(results.filter((r) => !r.error).length === 1, 'concurrent joins: one succeeds');
  ok(
    results.some((r) => r.error === 'room_full'),
    'concurrent joins: the other gets room_full',
  );
  await Promise.all([co.end(), ca.end(), cb.end()]);
}

// 2. Double-tap: the player on turn fires two cells at once; only one shot lands.
{
  const [p1, p2] = [await newUser(), await newUser()];
  const [c1, c2] = [await session(p1), await session(p2)];
  const room = (await c1.query('select id, code from public.create_room()')).rows[0];
  await c2.query('select public.join_room($1)', [room.code]);
  await c1.query('select public.place_fleet($1, $2)', [room.id, JSON.stringify(FLEET)]);
  await c2.query('select public.place_fleet($1, $2)', [room.id, JSON.stringify(FLEET)]);
  await admin.query('update public.matches set turn = $1 where id = $2', [p1, room.id]);
  const c1b = await session(p1);
  const results = await Promise.all([
    rpc(c1, 'select public.fire($1, 55)', [room.id]),
    rpc(c1b, 'select public.fire($1, 56)', [room.id]),
  ]);
  ok(results.filter((r) => !r.error).length === 1, 'double fire: one shot lands');
  ok(
    results.some((r) => r.error === 'not_your_turn'),
    'double fire: the other is refused',
  );
  const count = (
    await admin.query('select count(*)::int as n from public.shots where match_id = $1', [room.id])
  ).rows[0].n;
  ok(count === 1, 'double fire: exactly one shot stored');
  await Promise.all([c1.end(), c1b.end(), c2.end()]);
}

// 3. Eight players hit quick play at the same moment, twice: everyone ends up in exactly one match.
{
  await admin.query('delete from public.matchmaking_queue'); // isolate from earlier test files
  const users = await newUsers(8);
  const clients = await Promise.all(users.map((u) => session(u)));
  // Everyone polls at once, like the app does, until nobody is left waiting.
  let rounds = 0;
  let errors = [];
  for (; rounds < 10; rounds++) {
    const results = await Promise.all(
      clients.map((c) => rpc(c, 'select public.join_queue() as r')),
    );
    if (process.env.DEBUG_MM)
      console.log(results.map((r) => r.error ?? r.rows[0].r.status).join(' '));
    errors = errors.concat(results.filter((r) => r.error).map((r) => r.error));
    if (results.every((r) => r.rows?.[0].r.status === 'matched')) break;
  }
  ok(errors.length === 0, `parallel quick play: no errors (${errors.join(', ') || 'none'})`);
  ok(rounds < 10, `parallel quick play: all paired after ${rounds + 1} polls`);
  const { rows } = await admin.query(
    `select u.id, count(m.id)::int as n
       from unnest($1::uuid[]) as u(id)
       left join public.matches m on u.id in (m.player1, m.player2) and m.status = 'placing'
      group by u.id`,
    [users],
  );
  ok(
    rows.every((r) => r.n === 1),
    'parallel quick play: every player is in exactly one match',
  );
  await Promise.all(clients.map((c) => c.end()));
}

await admin.end();
if (failures) process.exit(1);
