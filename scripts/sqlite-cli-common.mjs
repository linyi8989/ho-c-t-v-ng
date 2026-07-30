import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
export const Database = require('better-sqlite3');

export function readArg(name) {
  const prefix = `${name}=`;
  const direct = process.argv.find(arg => arg.startsWith(prefix));
  if (direct) return direct.slice(prefix.length);
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

export function hasFlag(name) {
  return process.argv.includes(name);
}

export function resolveDatabasePath({ required = true } = {}) {
  const value = readArg('--db') || process.env.SQLITE_DB_PATH;
  if (!value && required) {
    throw new Error('Database path is required via --db <path> or SQLITE_DB_PATH.');
  }
  return value ? path.resolve(value) : '';
}

export function assertExistingFile(filePath) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw new Error(`SQLite database file does not exist: ${path.basename(filePath)}`);
  }
}

export function assertQuickCheck(db, label = 'database') {
  const rows = db.pragma('quick_check');
  const values = rows.map(row => String(Object.values(row)[0] || '').toLowerCase());
  if (values.length !== 1 || values[0] !== 'ok') {
    throw new Error(`${label} quick_check failed: ${values.join(', ') || 'no result'}`);
  }
}

export function redactPath(filePath) {
  return `${path.basename(path.dirname(filePath))}/${path.basename(filePath)}`;
}

export function createTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

export async function createVerifiedBackup(sourcePath, destinationDirectory) {
  assertExistingFile(sourcePath);
  const backupDirectory = path.resolve(destinationDirectory);
  fs.mkdirSync(backupDirectory, { recursive: true });
  const parsed = path.parse(sourcePath);
  const destinationPath = path.join(
    backupDirectory,
    `${parsed.name}-${createTimestamp()}${parsed.ext || '.sqlite'}`
  );
  if (fs.existsSync(destinationPath)) {
    throw new Error(`Refusing to overwrite backup: ${path.basename(destinationPath)}`);
  }

  const source = new Database(sourcePath, { fileMustExist: true, timeout: 10_000 });
  try {
    assertQuickCheck(source, 'source');
    await source.backup(destinationPath);
  } finally {
    source.close();
  }

  const backup = new Database(destinationPath, {
    fileMustExist: true,
    readonly: true,
  });
  try {
    assertQuickCheck(backup, 'backup');
  } catch (error) {
    error.message = `Backup validation failed for ${path.basename(destinationPath)}: ${error.message}`;
    throw error;
  } finally {
    backup.close();
  }
  return destinationPath;
}

export function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}
