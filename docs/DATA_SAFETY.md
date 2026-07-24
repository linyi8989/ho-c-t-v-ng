# Data Safety Rules

Production data is more important than new code. Do not ship changes that can overwrite, reset, reseed, or physically delete the real production database without an explicit backup and approval.

## Incident Summary

On 2026-07-08, after a deploy, production appeared to lose data including vocabulary sets, accounts, classes, leaderboard data, and activity logs.

The issue was caused by storage/deploy behavior, not by `git push` itself:

- Recent activity cleanup was implemented as a physical delete and was called automatically.
- The app could fall back to local JSON storage in the deploy directory.
- Production needed to use the persistent SQLite database, but startup/configuration could point elsewhere.
- A SQLite migration created indexes on `expires_at` before adding the column to existing databases, causing startup failure.

## Production Database

The current production SQLite database path is:

```text
/home/qzmivzbj/app-data/vhomework/app.sqlite
```

Persistent local JSON fallback path:

```text
/home/qzmivzbj/app-data/vhomework/db.json
```

Persistent generated audio path:

```text
/home/qzmivzbj/app-data/vhomework/audio/
```

Required production environment variables when using SQLite:

```text
STORAGE_MODE=sqlite
SQLITE_DB_PATH=/home/qzmivzbj/app-data/vhomework/app.sqlite
LOCAL_DB_PATH=/home/qzmivzbj/app-data/vhomework/db.json
DIAGNOSTIC_SECRET=<host-only secret>
```

Never use the deploy directory as the source of truth for production data.

## Mandatory Deploy Rules

- Do not add automatic physical deletes during startup, login, page load, or read-only API routes.
- Identity compatibility checks must be read-only. Never bulk-rewrite old `game_sessions`, `grammar_attempts`, or leaderboard snapshots to enforce a newer display-name rule.
- New grammar question types must use additive fields inside existing grammar `data_json`; do not rewrite old multiple-choice sets/attempts or create a destructive schema migration.
- Display-name corrections update only the canonical `users` or `guest_profiles` record; historical result snapshots remain unchanged.
- "Recent activity" features must filter old records in queries/UI first. Physical cleanup must be a separate maintenance task with backup.
- Do not reseed, reset, truncate, overwrite, or migrate production data unless the exact target database path is confirmed.
- Before any storage, auth, migration, cleanup, result/session, or leaderboard change, back up the active production database.
- Test SQLite migrations against an existing production-shaped database, not only a new empty database.
- Migration order must be: create base tables, add missing columns, create indexes, then write new data.
- Runtime data must live in a persistent data directory such as `/home/qzmivzbj/app-data/vhomework`, not in `/home/qzmivzbj/app.msdieu.com`.
- Generated audio files must also live in persistent storage, not in the deploy directory, and must not be stored as base64 in the database.
- Do not commit `.env`, `.env.production`, service account private keys, API keys, or host-only diagnostic secrets.
- If production suddenly shows empty data, check `/api/diagnostics/storage?secret=...` before editing, deleting, or reseeding anything.

## Backup Commands

Run these on the host before risky deploys:

```bash
mkdir -p /home/qzmivzbj/app-data/vhomework/restore-backup
cp /home/qzmivzbj/app-data/vhomework/app.sqlite /home/qzmivzbj/app-data/vhomework/restore-backup/app.sqlite.$(date +%Y%m%d-%H%M%S).bak
cp /home/qzmivzbj/app-data/vhomework/db.json /home/qzmivzbj/app-data/vhomework/restore-backup/db.json.$(date +%Y%m%d-%H%M%S).bak 2>/dev/null || true
ls -lah /home/qzmivzbj/app-data/vhomework/restore-backup
```

## Pre-Deploy Checklist

Before deploying storage-related changes, confirm:

- The active database path is known.
- A fresh backup exists.
- No startup/read route performs physical cleanup.
- No migration references a new column before adding it.
- The app still points to the persistent production database after restart.
- Diagnostics confirm the expected storage mode.
