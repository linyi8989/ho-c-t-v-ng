# SQLite WAL Operations

## Runtime settings

Release A verifies these settings on every native connection:

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 10000;
PRAGMA wal_autocheckpoint = 1000;
```

`SQLITE_SYNCHRONOUS=FULL`, `SQLITE_BUSY_TIMEOUT_MS`, and `SQLITE_WAL_AUTOCHECKPOINT_PAGES` can override the documented defaults.

## Diagnostics

Protected HTTP diagnostics:

```text
GET /api/diagnostics/storage?secret=<DIAGNOSTIC_SECRET>
```

Offline/host CLI:

```bash
npm run db:diagnostics -- --db /home/qzmivzbj/app-data/vhomework/app.sqlite
```

Neither output includes document payloads. The HTTP endpoint redacts the absolute database path.

## Checkpoint

Passive checkpoint:

```bash
npm run db:checkpoint -- --db /home/qzmivzbj/app-data/vhomework/app.sqlite
```

Truncating checkpoint during a controlled maintenance window:

```bash
npm run db:checkpoint -- \
  --db /home/qzmivzbj/app-data/vhomework/app.sqlite \
  --truncate
```

Exit code `2` means SQLite reported a busy checkpoint.

## Preparing an emergency sql.js rollback

Changing only `SQLITE_DRIVER` is unsafe because `sql.js` cannot merge pending WAL frames. Use this sequence:

1. Stop every Passenger worker.
2. Confirm there are no writers.
3. Run:

```bash
npm run db:prepare-sqljs-rollback -- \
  --db /home/qzmivzbj/app-data/vhomework/app.sqlite \
  --output-dir /home/qzmivzbj/app-data/vhomework/restore-backup \
  --workers-stopped \
  --execute
```

4. Confirm the command reports backup `quick_check=ok`, checkpoint `busy=0`, `journalMode=delete`, and `walBytes=0`.
5. Only then set `SQLITE_DRIVER=sqljs` and restart the known-good rollback code.

The command refuses to run without both acknowledgement flags.
