import fs from 'node:fs';
import {
  assertExistingFile,
  assertQuickCheck,
  Database,
  printJson,
  redactPath,
  resolveDatabasePath,
} from './sqlite-cli-common.mjs';

const databasePath = resolveDatabasePath();
assertExistingFile(databasePath);
const db = new Database(databasePath, {
  fileMustExist: true,
  readonly: true,
});

try {
  assertQuickCheck(db, 'database');
  const tables = db.prepare(
    `SELECT name
     FROM sqlite_schema
     WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
     ORDER BY name`
  ).all();
  const tableCounts = {};
  for (const row of tables) {
    tableCounts[row.name] = Number(
      db.prepare(`SELECT COUNT(*) AS count FROM "${row.name.replaceAll('"', '""')}"`).get().count
    );
  }
  const walPath = `${databasePath}-wal`;
  const shmPath = `${databasePath}-shm`;
  printJson({
    ok: true,
    database: redactPath(databasePath),
    driver: 'better-sqlite3',
    sqliteVersion: db.prepare('SELECT sqlite_version() AS version').get().version,
    nodeVersion: process.version,
    nodeAbi: process.versions.modules,
    platform: process.platform,
    architecture: process.arch,
    quickCheck: 'ok',
    journalMode: db.pragma('journal_mode', { simple: true }),
    databaseBytes: fs.statSync(databasePath).size,
    walExists: fs.existsSync(walPath),
    shmExists: fs.existsSync(shmPath),
    walBytes: fs.existsSync(walPath) ? fs.statSync(walPath).size : 0,
    tableCounts,
  });
} finally {
  db.close();
}
