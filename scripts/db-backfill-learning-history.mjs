import fs from 'node:fs';
import path from 'node:path';
import {
  assertExistingFile,
  assertQuickCheck,
  Database,
  printJson,
  readArg,
  redactPath,
  resolveDatabasePath,
} from './sqlite-cli-common.mjs';
import {
  assertBackfillSourceSchema,
  assertPostMaintenanceIntegrity,
  DEFAULT_BACKFILL_BATCH_SIZE,
  getSafeCliMode,
  MAX_BACKFILL_BATCH_SIZE,
  openLearningHistoryDatabase,
  prepareLearningAttemptInsert,
  readIntegerArg,
  reconcileLearningAttemptNumbers,
  reconcileLearningHistory,
  scanSourceRows,
  SOURCE_DEFINITIONS,
} from './learning-history-common.mjs';

function progress(value) {
  process.stderr.write(`${JSON.stringify(value)}\n`);
}

function emptyWriteStats() {
  return {
    batches: 0,
    scanned: 0,
    eligible: 0,
    inserted: 0,
    alreadyPresent: 0,
    idempotencyConflicts: 0,
    legacyUnlinked: 0,
    skipped: {},
  };
}

function incrementReason(target, reason) {
  target[reason] = Number(target[reason] || 0) + 1;
}

function safeErrorMessage(error, databasePath) {
  let message = String(error?.message || error || 'Unknown backfill error');
  if (databasePath) {
    message = message
      .split(databasePath).join('<sqlite-db>')
      .split(databasePath.replaceAll('\\', '/')).join('<sqlite-db>');
  }
  return message;
}

function verifyRequiredBackup(databasePath, mode) {
  if (mode === 'dry-run') return null;
  const rawBackupPath = readArg('--verified-backup');
  if (!rawBackupPath || rawBackupPath.startsWith('--')) {
    throw new Error(
      `${mode} requires --verified-backup <path> from a backup created before backfill.`
    );
  }
  const backupPath = path.resolve(rawBackupPath);
  assertExistingFile(backupPath);
  if (fs.realpathSync(databasePath) === fs.realpathSync(backupPath)) {
    throw new Error('--verified-backup must not point to the live database.');
  }
  const backup = new Database(backupPath, {
    fileMustExist: true,
    readonly: true,
  });
  try {
    assertQuickCheck(backup, 'verified backup');
  } finally {
    backup.close();
  }
  return backupPath;
}

let databasePath = '';
let db;

try {
  databasePath = resolveDatabasePath();
  assertExistingFile(databasePath);
  const mode = getSafeCliMode();
  const batchSize = readIntegerArg('--batch-size', {
    defaultValue: DEFAULT_BACKFILL_BATCH_SIZE,
    minimum: 1,
    maximum: MAX_BACKFILL_BATCH_SIZE,
  });
  const dryRun = mode === 'dry-run';
  const verifiedBackupPath = verifyRequiredBackup(databasePath, mode);

  db = openLearningHistoryDatabase(databasePath, { readonly: dryRun });
  assertBackfillSourceSchema(db);
  const before = reconcileLearningHistory(db, { batchSize });

  if (dryRun) {
    const plannedInserts = Object.values(before.source)
      .reduce((sum, source) => sum + Number(source.missing || 0), 0);
    printJson({
      ok: before.history.duplicateSourceGroups === 0
        && before.history.deterministicIdMismatches === 0,
      mode,
      database: redactPath(databasePath),
      batchSize,
      quickCheck: 'ok',
      verifiedBackup: null,
      plannedInserts,
      plannedAttemptNumberUpdates: before.history.attemptNumberMismatches,
      reconciliation: before,
      sourceMutation: 'none',
      note: 'Dry-run is read-only. Re-run with --execute after reviewing this report.',
    });
    if (
      before.history.duplicateSourceGroups !== 0
      || before.history.deterministicIdMismatches !== 0
    ) {
      process.exitCode = 2;
    }
  } else {
    if (
      before.history.duplicateSourceGroups !== 0
      || before.history.deterministicIdMismatches !== 0
    ) {
      throw new Error(
        'Reconciliation found duplicate source identities or deterministic attempt ID mismatches; no backfill writes were started.'
      );
    }
    const insertAttempt = prepareLearningAttemptInsert(db);
    const sourceExists = db.prepare(
      `SELECT 1
       FROM learning_attempts
       WHERE source_type = ? AND source_record_id = ?
       LIMIT 1`
    );
    const insertBatch = db.transaction(entries => entries.map(({ attempt }) => {
      const insertResult = insertAttempt(attempt);
      if (Number(insertResult.changes) === 1) return 'inserted';
      return sourceExists.get(attempt.source_type, attempt.source_record_id)
        ? 'alreadyPresent'
        : 'idempotencyConflict';
    }));

    const writes = {};
    for (const [sourceType, definition] of Object.entries(SOURCE_DEFINITIONS)) {
      const stats = emptyWriteStats();
      const scan = scanSourceRows(db, sourceType, {
        batchSize,
        remainingOnly: true,
        onBatch({ batchNumber, rows }) {
          stats.batches = batchNumber;
          stats.scanned += rows.length;
          const entries = [];
          for (const row of rows) {
            const normalized = definition.normalizer(row);
            if (!normalized.attempt) {
              incrementReason(stats.skipped, normalized.reason || 'unknown');
              continue;
            }
            stats.eligible += 1;
            if (normalized.attempt.ownership_status === 'legacy_unlinked') {
              stats.legacyUnlinked += 1;
            }
            entries.push(normalized);
          }

          const outcomes = insertBatch(entries);
          for (const outcome of outcomes) {
            if (outcome === 'inserted') stats.inserted += 1;
            else if (outcome === 'alreadyPresent') stats.alreadyPresent += 1;
            else stats.idempotencyConflicts += 1;
          }
          progress({
            event: 'learning-history-backfill-batch',
            sourceType,
            batch: batchNumber,
            scanned: rows.length,
            eligible: entries.length,
            inserted: outcomes.filter(outcome => outcome === 'inserted').length,
            skipped: rows.length - entries.length,
          });
        },
      });
      stats.batches = scan.batches;
      writes[sourceType] = stats;
    }

    const attemptNumbersUpdated = reconcileLearningAttemptNumbers(db);
    assertPostMaintenanceIntegrity(db);
    const after = reconcileLearningHistory(db, { batchSize });
    const missingAfter = Object.values(after.source)
      .reduce((sum, source) => sum + Number(source.missing || 0), 0);
    const conflicts = Object.values(writes)
      .reduce((sum, source) => sum + Number(source.idempotencyConflicts || 0), 0);
    const ok = after.history.duplicateSourceGroups === 0
      && after.history.deterministicIdMismatches === 0
      && after.history.attemptNumberMismatches === 0
      && missingAfter === 0
      && conflicts === 0;

    printJson({
      ok,
      mode,
      database: redactPath(databasePath),
      verifiedBackup: redactPath(verifiedBackupPath),
      backupQuickCheck: 'ok',
      batchSize,
      quickCheck: 'ok',
      attemptNumbersUpdated,
      writes,
      reconciliation: {
        before,
        after,
        missingAfter,
      },
      sourceMutation: 'none',
      note: mode === 'resume'
        ? 'Resume scanned only source rows not already represented by source identity.'
        : 'Execute used short per-batch transactions and did not update or delete source rows.',
    });
    if (!ok) process.exitCode = 2;
  }
} catch (error) {
  printJson({
    ok: false,
    database: databasePath ? redactPath(databasePath) : null,
    error: safeErrorMessage(error, databasePath),
  });
  process.exitCode = 1;
} finally {
  if (db?.open) db.close();
}
