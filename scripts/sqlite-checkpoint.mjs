import {
  assertExistingFile,
  assertQuickCheck,
  Database,
  hasFlag,
  printJson,
  redactPath,
  resolveDatabasePath,
} from './sqlite-cli-common.mjs';

const databasePath = resolveDatabasePath();
assertExistingFile(databasePath);
const truncate = hasFlag('--truncate');
const mode = truncate ? 'TRUNCATE' : 'PASSIVE';
const db = new Database(databasePath, { fileMustExist: true, timeout: 10_000 });

try {
  assertQuickCheck(db, 'source');
  const result = db.pragma(`wal_checkpoint(${mode})`)[0] || {};
  const busy = Number(result.busy || 0);
  printJson({
    ok: busy === 0,
    database: redactPath(databasePath),
    mode,
    result,
    quickCheck: 'ok',
  });
  if (busy !== 0) process.exitCode = 2;
} finally {
  db.close();
}
