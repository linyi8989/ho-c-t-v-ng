# Media orphan maintenance

This command reports hashed TTS and Listening files that are not referenced by
SQLite. It never runs during application startup or a read request.

Use the project's Node 22 runtime. Run the read-only report first:

```bash
npm run maintenance:media-orphans -- \
  --db /srv/vhomework/app.sqlite \
  --tts-dir /srv/vhomework/audio \
  --listening-dir /srv/vhomework/listening-media \
  --older-than-days 7
```

Review every candidate. During a quiet maintenance window, move the same
candidates into quarantine:

```bash
npm run maintenance:media-orphans -- \
  --db /srv/vhomework/app.sqlite \
  --tts-dir /srv/vhomework/audio \
  --listening-dir /srv/vhomework/listening-media \
  --older-than-days 7 \
  --backup-dir /srv/vhomework/backups \
  --quarantine-dir /srv/vhomework/media-quarantine/review-2026-09-02 \
  --execute
```

Safety contract:

- Dry-run is the default and changes nothing.
- Execute first creates and verifies a SQLite backup.
- A file is eligible only when its name matches the application's content-hash
  format, it is older than the chosen threshold, and no corresponding database
  reference exists.
- Existing asset rows, including archived resources, count as references.
- Execute moves eligible files into quarantine. It does not permanently delete
  files, asset rows, attempts, results, versions or learning history.
- Unknown/manual filenames are ignored rather than guessed.

If a quarantined file is later found to be required, stop writes briefly and
move that exact file from the matching quarantine subdirectory back to its
original `audio` or `listening-media` directory.
