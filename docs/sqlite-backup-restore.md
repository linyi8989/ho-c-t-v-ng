# SQLite Backup and Restore

## Online backup

Use the native online backup API while Release A is running:

```bash
npm run db:backup -- \
  --db /home/qzmivzbj/app-data/vhomework/app.sqlite \
  --output-dir /home/qzmivzbj/app-data/vhomework/restore-backup
```

The command:

- requires an existing source file;
- runs source `quick_check`;
- creates a timestamped destination without overwrite;
- uses SQLite's online backup API so WAL state is included consistently;
- opens the backup read-only and requires backup `quick_check=ok`.

Do not copy only `app.sqlite` while workers can write in WAL mode.

## Restore

Restore is a maintenance-window action:

1. Stop all Passenger workers.
2. Preserve the failed main file and any WAL/SHM sidecars for investigation.
3. Run diagnostics/`quick_check` on the selected backup.
4. Confirm the absolute target is exactly `/home/qzmivzbj/app-data/vhomework/app.sqlite`.
5. Restore the verified backup with host-approved filesystem commands.
6. Ensure stale WAL/SHM sidecars from a different database generation are not reused.
7. Start the known-good release.
8. Verify diagnostics, counts, login, lesson reads, one completion, Recent Activity, leaderboard, and restart/reopen.

This repository intentionally does not provide an automatic restore command because restore overwrites the production source of truth and requires explicit operator review.
