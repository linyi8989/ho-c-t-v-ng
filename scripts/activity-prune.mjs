import path from 'node:path';
import {
  assertExistingFile,
  createVerifiedBackup,
  printJson,
  readArg,
  redactPath,
  resolveDatabasePath,
} from './sqlite-cli-common.mjs';
import {
  assertPostMaintenanceIntegrity,
  getSafeCliMode,
  openLearningHistoryDatabase,
  validateIsoInstant,
} from './learning-history-common.mjs';

const ELIGIBLE_DETAIL_WHERE = `
  details.expires_at IS NOT NULL
  AND julianday(details.expires_at) IS NOT NULL
  AND julianday(details.expires_at) <= julianday(?)
  AND LOWER(COALESCE(attempts.attempt_status, '')) <> 'in_progress'`;

const PROTECTED_ROW_COUNT_TABLES = Object.freeze([
  'learning_attempts',
  'game_results',
  'grammar_attempts',
  'pronunciation_attempts',
  'leaderboard_events',
]);

function protectedRowCounts(db) {
  return Object.fromEntries(
    PROTECTED_ROW_COUNT_TABLES.map(tableName => [
      tableName,
      Number(
        db.prepare(`SELECT COUNT(*) AS count FROM "${tableName}"`).get().count
      ),
    ])
  );
}

function compareProtectedRowCounts(before, after) {
  const deltas = {};
  const deletions = {};
  for (const tableName of PROTECTED_ROW_COUNT_TABLES) {
    const delta = Number(after[tableName]) - Number(before[tableName]);
    deltas[tableName] = delta;
    deletions[tableName] = Math.max(0, -delta);
  }
  const sourceDeletionByTable = {
    game_results: deletions.game_results,
    grammar_attempts: deletions.grammar_attempts,
    pronunciation_attempts: deletions.pronunciation_attempts,
  };
  return {
    before,
    after,
    deltas,
    unchanged: Object.values(deltas).every(delta => delta === 0),
    summaryDeletion: deletions.learning_attempts,
    sourceDeletionByTable,
    sourceDeletion: Object.values(sourceDeletionByTable)
      .reduce((sum, count) => sum + count, 0),
    leaderboardDeletion: deletions.leaderboard_events,
  };
}

function retentionReport(db, asOf) {
  const expiredTotal = Number(
    db.prepare(
      `SELECT COUNT(*) AS count
       FROM attempt_details
       WHERE expires_at IS NOT NULL
         AND julianday(expires_at) IS NOT NULL
         AND julianday(expires_at) <= julianday(?)`
    ).get(asOf).count
  );
  const eligible = Number(
    db.prepare(
      `SELECT COUNT(*) AS count
       FROM attempt_details AS details
       JOIN learning_attempts AS attempts
         ON attempts.attempt_id = details.attempt_id
       WHERE ${ELIGIBLE_DETAIL_WHERE}`
    ).get(asOf).count
  );
  const protectedInProgress = Number(
    db.prepare(
      `SELECT COUNT(*) AS count
       FROM attempt_details AS details
       JOIN learning_attempts AS attempts
         ON attempts.attempt_id = details.attempt_id
       WHERE details.expires_at IS NOT NULL
         AND julianday(details.expires_at) IS NOT NULL
         AND julianday(details.expires_at) <= julianday(?)
         AND LOWER(COALESCE(attempts.attempt_status, '')) = 'in_progress'`
    ).get(asOf).count
  );
  const invalidExpiry = Number(
    db.prepare(
      `SELECT COUNT(*) AS count
       FROM attempt_details
       WHERE expires_at IS NOT NULL
         AND julianday(expires_at) IS NULL`
    ).get().count
  );
  return {
    asOf,
    detailRows: Number(
      db.prepare('SELECT COUNT(*) AS count FROM attempt_details').get().count
    ),
    expiredTotal,
    eligible,
    protectedInProgress,
    invalidExpiry,
  };
}

function safeErrorMessage(error, databasePath) {
  let message = String(error?.message || error || 'Unknown retention error');
  if (databasePath) {
    message = message
      .split(databasePath).join('<sqlite-db>')
      .split(databasePath.replaceAll('\\', '/')).join('<sqlite-db>');
  }
  return message;
}

let databasePath = '';
let db;

try {
  databasePath = resolveDatabasePath();
  assertExistingFile(databasePath);
  const mode = getSafeCliMode();
  if (mode === 'resume') {
    throw new Error('Retention does not support --resume; use --execute or dry-run.');
  }
  const asOf = validateIsoInstant(
    readArg('--as-of') || new Date().toISOString(),
    '--as-of'
  );

  db = openLearningHistoryDatabase(databasePath, { readonly: true });
  assertPostMaintenanceIntegrity(db);
  const before = retentionReport(db, asOf);
  const preBackupProtectedCounts = protectedRowCounts(db);
  db.close();
  db = undefined;

  if (mode === 'dry-run') {
    printJson({
      ok: true,
      mode,
      database: redactPath(databasePath),
      quickCheck: 'ok',
      retention: before,
      protectedRowCounts: {
        snapshot: preBackupProtectedCounts,
      },
      deletedDetails: 0,
      updatedSummaries: 0,
      summaryDeletion: 0,
      sourceDeletionByTable: {
        game_results: 0,
        grammar_attempts: 0,
        pronunciation_attempts: 0,
      },
      sourceDeletion: 0,
      leaderboardDeletion: 0,
      vacuum: false,
      note: 'Dry-run is read-only. Re-run with --execute after reviewing this report.',
    });
  } else {
    const backupDirectory = readArg('--backup-dir')
      || process.env.SQLITE_BACKUP_DIR
      || path.join(path.dirname(databasePath), 'backups');
    const backupPath = await createVerifiedBackup(databasePath, backupDirectory);

    db = openLearningHistoryDatabase(databasePath);
    assertPostMaintenanceIntegrity(db);
    const executeBefore = retentionReport(db, asOf);
    const executeProtectedCountsBefore = protectedRowCounts(db);
    db.exec(`
      CREATE TEMP TABLE IF NOT EXISTS expired_learning_detail_ids (
        attempt_id TEXT PRIMARY KEY
      ) WITHOUT ROWID;
    `);
    const prune = db.transaction(() => {
      db.prepare('DELETE FROM temp.expired_learning_detail_ids').run();
      db.prepare(
        `INSERT INTO temp.expired_learning_detail_ids (attempt_id)
         SELECT details.attempt_id
         FROM attempt_details AS details
         JOIN learning_attempts AS attempts
           ON attempts.attempt_id = details.attempt_id
         WHERE ${ELIGIBLE_DETAIL_WHERE}`
      ).run(asOf);
      const selected = Number(
        db.prepare(
          'SELECT COUNT(*) AS count FROM temp.expired_learning_detail_ids'
        ).get().count
      );
      const updatedAt = new Date().toISOString();
      const updatedSummaries = Number(
        db.prepare(
          `UPDATE learning_attempts
           SET detail_status = 'expired',
               updated_at = ?
           WHERE attempt_id IN (
             SELECT attempt_id FROM temp.expired_learning_detail_ids
           )`
        ).run(updatedAt).changes
      );
      const deletedDetails = Number(
        db.prepare(
          `DELETE FROM attempt_details
           WHERE attempt_id IN (
             SELECT attempt_id FROM temp.expired_learning_detail_ids
           )`
        ).run().changes
      );
      if (selected !== deletedDetails || selected !== updatedSummaries) {
        throw new Error(
          `Retention count mismatch: selected=${selected}, summaries=${updatedSummaries}, details=${deletedDetails}.`
        );
      }
      return { selected, updatedSummaries, deletedDetails };
    });
    const changes = prune();
    assertPostMaintenanceIntegrity(db);
    const after = retentionReport(db, asOf);
    const executeProtectedCountsAfter = protectedRowCounts(db);
    const transactionProtectedCounts = compareProtectedRowCounts(
      executeProtectedCountsBefore,
      executeProtectedCountsAfter
    );
    const protectedCounts = compareProtectedRowCounts(
      preBackupProtectedCounts,
      executeProtectedCountsAfter
    );
    const expectedRemaining = executeBefore.eligible - changes.deletedDetails;
    const ok = expectedRemaining === after.eligible
      && expectedRemaining === 0
      && protectedCounts.unchanged
      && transactionProtectedCounts.unchanged
      && protectedCounts.summaryDeletion === 0
      && protectedCounts.sourceDeletion === 0
      && protectedCounts.leaderboardDeletion === 0;

    printJson({
      ok,
      mode,
      database: redactPath(databasePath),
      backup: redactPath(backupPath),
      backupQuickCheck: 'ok',
      quickCheck: 'ok',
      preBackupDryRun: before,
      preBackupProtectedRowCounts: preBackupProtectedCounts,
      before: executeBefore,
      after,
      selectedDetails: changes.selected,
      deletedDetails: changes.deletedDetails,
      updatedSummaries: changes.updatedSummaries,
      protectedInProgress: after.protectedInProgress,
      protectedRowCounts: {
        before: protectedCounts.before,
        after: protectedCounts.after,
        deltas: protectedCounts.deltas,
        unchanged: protectedCounts.unchanged,
      },
      transactionProtectedRowCounts: {
        before: transactionProtectedCounts.before,
        after: transactionProtectedCounts.after,
        deltas: transactionProtectedCounts.deltas,
        unchanged: transactionProtectedCounts.unchanged,
      },
      summaryDeletion: protectedCounts.summaryDeletion,
      sourceDeletionByTable: protectedCounts.sourceDeletionByTable,
      sourceDeletion: protectedCounts.sourceDeletion,
      leaderboardDeletion: protectedCounts.leaderboardDeletion,
      vacuum: false,
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
