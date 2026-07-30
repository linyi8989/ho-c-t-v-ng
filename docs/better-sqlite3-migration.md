# better-sqlite3 Migration

## Scope

Release A changes only the SQLite access layer. It keeps the single production database:

```text
/home/qzmivzbj/app-data/vhomework/app.sqlite
```

No learning-history schema/UI is included. `app.sqlite-wal` and `app.sqlite-shm` are WAL sidecars, not additional business databases.

## Implemented design

- Candidate dependency is pinned exactly to `better-sqlite3@12.4.1`.
- `SQLITE_DRIVER=better-sqlite3` is the primary driver.
- `sql.js` remains only as an explicit rollback driver and refuses a non-empty WAL.
- Production requires explicit `SQLITE_DRIVER` and `SQLITE_DB_PATH`.
- `SQLITE_ALLOW_CREATE=false` prevents a typo/missing file from silently creating an empty production database.
- JSON import is disabled unless `SQLITE_ALLOW_JSON_IMPORT=true` is explicitly set.
- Seed data is disabled unless `SEED_DATA_ENABLED=true` is explicitly set.
- Production startup rejects `SQLITE_ALLOW_CREATE=true`, `SQLITE_ALLOW_JSON_IMPORT=true`, or `SEED_DATA_ENABLED=true`; these are development/offline-maintenance concerns only.
- Startup performs pre-migration `quick_check`, additive migrations under an immediate write transaction, WAL configuration/verification, and post-migration `quick_check` before opening the HTTP port.
- Native writes use real SQLite transactions; the full-file `sql.js` export path is not used by the primary driver.
- Recent activity, leaderboard, guest identity, per-set results, and grammar history filters use normalized SQL columns when available.
- Diagnostics redact the full database path and expose the driver, SQLite version, WAL/foreign-key settings, sizes, migration, counts, and process metrics.

## Production environment

```text
STORAGE_MODE=sqlite
SQLITE_DRIVER=better-sqlite3
SQLITE_DB_PATH=/home/qzmivzbj/app-data/vhomework/app.sqlite
SQLITE_ALLOW_CREATE=false
SQLITE_ALLOW_JSON_IMPORT=false
SQLITE_BUSY_TIMEOUT_MS=10000
SQLITE_WAL_AUTOCHECKPOINT_PAGES=1000
SQLITE_SYNCHRONOUS=NORMAL
SQLITE_SLOW_QUERY_MS=250
SQLITE_STATEMENT_CACHE_SIZE=200
SQLITE_BACKUP_DIR=/home/qzmivzbj/app-data/vhomework/backups
SEED_DATA_ENABLED=false
DIAGNOSTIC_SECRET=<host-only-secret>
```

## Local quality gate

```bash
npm ci
npm run storage:preflight -- --db /tmp/better-sqlite3-test.sqlite
npm run test:phase1
```

Local success does not prove cPanel compatibility. Release A is production-ready only after the exact Passenger Node runtime passes the host preflight and a production-shaped database copy passes migration/smoke checks.
