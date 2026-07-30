import fs from 'node:fs';
import path from 'node:path';
import {
  assertExistingFile,
  assertQuickCheck,
  createVerifiedBackup,
  Database,
  hasFlag,
  printJson,
  readArg,
  redactPath,
  resolveDatabasePath,
} from './sqlite-cli-common.mjs';

if (!hasFlag('--execute') || !hasFlag('--workers-stopped')) {
  throw new Error(
    'Refusing rollback preparation. Stop every app worker, then pass --workers-stopped --execute.'
  );
}

const databasePath = resolveDatabasePath();
assertExistingFile(databasePath);
const backupDirectory = readArg('--output-dir')
  || process.env.SQLITE_BACKUP_DIR
  || path.join(path.dirname(databasePath), 'backups');
const backupPath = await createVerifiedBackup(databasePath, backupDirectory);

const db = new Database(databasePath, { fileMustExist: true, timeout: 10_000 });
let checkpoint;
let journalMode;
try {
  assertQuickCheck(db, 'source');
  checkpoint = db.pragma('wal_checkpoint(TRUNCATE)')[0] || {};
  if (Number(checkpoint.busy || 0) !== 0) {
    throw new Error(`WAL checkpoint is busy: ${JSON.stringify(checkpoint)}`);
  }
  journalMode = db.pragma('journal_mode = DELETE', { simple: true });
  if (String(journalMode).toLowerCase() !== 'delete') {
    throw new Error(`Failed to switch journal_mode to DELETE: ${journalMode}`);
  }
  assertQuickCheck(db, 'rollback-ready source');
} finally {
  db.close();
}

const walPath = `${databasePath}-wal`;
const walBytes = fs.existsSync(walPath) ? fs.statSync(walPath).size : 0;
if (walBytes > 0) {
  throw new Error(`Rollback preparation left a non-empty WAL sidecar (${walBytes} bytes).`);
}

printJson({
  ok: true,
  database: redactPath(databasePath),
  backup: redactPath(backupPath),
  checkpoint,
  journalMode,
  walBytes,
  quickCheck: 'ok',
  next: 'Set SQLITE_DRIVER=sqljs only after this command succeeds.',
});
