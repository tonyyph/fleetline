#!/bin/sh
# Run the Supabase migrations and SQL tests against a throwaway local Postgres cluster.
# Needs `initdb`, `pg_ctl` and `psql` on PATH (e.g. `brew install postgresql@16`). No Docker.
set -eu

ROOT=$(cd "$(dirname "$0")/.." && pwd)
WORK=$(mktemp -d "${TMPDIR:-/tmp}/fleetline-db.XXXXXX")
PORT=${FLEETLINE_TEST_DB_PORT:-54329}

cleanup() {
  pg_ctl -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT INT TERM

initdb -D "$WORK/data" -U postgres --auth=trust >/dev/null
pg_ctl -D "$WORK/data" -l "$WORK/log" -o "-p $PORT -k $WORK -c listen_addresses='' -c wal_level=logical" -w start >/dev/null

export PGHOST="$WORK" PGPORT="$PORT" PGUSER=postgres PGDATABASE=postgres
PSQL="psql -X -q -v ON_ERROR_STOP=1"

$PSQL -f "$ROOT/supabase/tests/support/supabase_stub.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "migrate  $(basename "$f")"
  $PSQL -f "$f"
done
$PSQL -f "$ROOT/supabase/tests/support/helpers.sql"

failed=0
for f in "$ROOT"/supabase/tests/*.test.sql; do
  echo "test     $(basename "$f")"
  if $PSQL -f "$f" >/dev/null 2>"$WORK/out"; then status=0; else status=$?; fi
  sed -n 's/.*NOTICE:  /  /p' "$WORK/out"
  if [ "$status" -ne 0 ]; then
    grep -v NOTICE "$WORK/out" >&2
    failed=1
  fi
done

echo "test     concurrency (scripts/db-concurrency.mjs)"
node "$ROOT/scripts/db-concurrency.mjs" || failed=1

if [ "$failed" -ne 0 ]; then
  echo "Database tests FAILED" >&2
  exit 1
fi
echo "Database tests passed"
