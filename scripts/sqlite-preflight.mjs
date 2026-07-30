import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import {
  assertQuickCheck,
  Database,
  printJson,
  readArg,
  redactPath,
} from './sqlite-cli-common.mjs';

const configuredMainPath = process.env.SQLITE_DB_PATH
  ? path.resolve(process.env.SQLITE_DB_PATH)
  : null;
const testPath = path.resolve(
  readArg('--db') || path.join(process.cwd(), 'better-sqlite3-test.sqlite')
);

if (configuredMainPath && configuredMainPath === testPath) {
  throw new Error('Preflight refuses to use SQLITE_DB_PATH. Pass a separate test database path.');
}
if (path.basename(testPath).toLowerCase() === 'app.sqlite') {
  throw new Error('Preflight refuses a database named app.sqlite.');
}
if (fs.existsSync(testPath)) {
  throw new Error(
    `Preflight test database already exists: ${path.basename(testPath)}. Inspect or remove it manually before retrying.`
  );
}

fs.mkdirSync(path.dirname(testPath), { recursive: true });
let db = new Database(testPath, { timeout: 10_000 });
const require = createRequire(import.meta.url);
const packageVersion = require('better-sqlite3/package.json').version;

try {
  db.pragma('foreign_keys = ON');
  const journalMode = db.pragma('journal_mode = WAL', { simple: true });
  db.pragma('synchronous = NORMAL');
  db.pragma('busy_timeout = 10000');
  db.pragma('wal_autocheckpoint = 1000');
  db.exec(`
    CREATE TABLE preflight_probe (
      id INTEGER PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  db.prepare('INSERT INTO preflight_probe (value) VALUES (?)').run('ok');
  const inserted = db.prepare('SELECT id, value FROM preflight_probe').get();
  assertQuickCheck(db, 'preflight');
  db.close();

  db = new Database(testPath, { fileMustExist: true, timeout: 10_000 });
  const reopened = db.prepare('SELECT id, value FROM preflight_probe').get();
  const sqliteVersion = db.prepare('SELECT sqlite_version() AS version').get().version;
  assertQuickCheck(db, 'reopened preflight');

  printJson({
    ok: journalMode === 'wal' && reopened?.value === 'ok',
    betterSqlite3Version: packageVersion,
    sqliteVersion,
    node: process.version,
    abi: process.versions.modules,
    execPath: process.execPath,
    platform: process.platform,
    arch: process.arch,
    libc: process.report?.getReport?.().header?.glibcVersionRuntime || null,
    host: os.hostname(),
    database: redactPath(testPath),
    journalMode,
    inserted,
    reopened,
    quickCheck: 'ok',
    cleanup: 'Remove the test database and its -wal/-shm sidecars manually after review.',
  });
} finally {
  if (db?.open) db.close();
}
