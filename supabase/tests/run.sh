#!/usr/bin/env bash
# Runs the migrations and schema tests against a throwaway Postgres database.
# Usage: PGHOST=... PGPORT=... PGUSER=postgres supabase/tests/run.sh
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
db="realmbound_test_$$"
createdb "$db"
trap 'dropdb --if-exists "$db"' EXIT
psql -q -v ON_ERROR_STOP=1 -d "$db" -f "$here/supabase_stub.sql"
for f in "$here"/../migrations/*.sql; do
  psql -q -v ON_ERROR_STOP=1 -d "$db" -f "$f"
done
psql -q -v ON_ERROR_STOP=1 -d "$db" -f "$here/schema_test.sql"
