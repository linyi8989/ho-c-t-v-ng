import path from 'node:path';
import type { SQLiteDriverName, SQLiteStorageConfig } from './storageTypes';

export const DEFAULT_SQLITE_PATH = '/home/qzmivzbj/app-data/vhomework/app.sqlite';

function parseBoolean(name: string, fallback: boolean) {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const normalized = raw.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  throw new Error(`${name} must be one of true/false, 1/0, yes/no, or on/off.`);
}

function parseInteger(name: string, fallback: number, minimum: number, maximum: number) {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}.`);
  }
  return parsed;
}

function resolveDriver(production: boolean): SQLiteDriverName {
  const raw = process.env.SQLITE_DRIVER?.trim().toLowerCase();
  if (!raw) {
    if (production) {
      throw new Error('SQLITE_DRIVER is required when NODE_ENV=production and STORAGE_MODE=sqlite.');
    }
    return 'better-sqlite3';
  }
  if (raw === 'better-sqlite3' || raw === 'better_sqlite3' || raw === 'native') {
    return 'better-sqlite3';
  }
  if (raw === 'sqljs' || raw === 'sql.js') return 'sqljs';
  throw new Error(`Unsupported SQLITE_DRIVER "${raw}".`);
}

function resolveDatabasePath(production: boolean) {
  const configured = process.env.SQLITE_DB_PATH?.trim();
  if (production && !configured) {
    throw new Error('SQLITE_DB_PATH is required when NODE_ENV=production and STORAGE_MODE=sqlite.');
  }
  const selected = configured || DEFAULT_SQLITE_PATH;
  return path.isAbsolute(selected) ? path.normalize(selected) : path.resolve(selected);
}

export function resolveSQLiteStorageConfig(): SQLiteStorageConfig {
  const production = process.env.NODE_ENV === 'production';
  const allowCreate = parseBoolean('SQLITE_ALLOW_CREATE', !production);
  const allowJsonImport = parseBoolean('SQLITE_ALLOW_JSON_IMPORT', false);
  if (production && allowCreate) {
    throw new Error('SQLITE_ALLOW_CREATE must be false when NODE_ENV=production.');
  }
  if (production && allowJsonImport) {
    throw new Error(
      'SQLITE_ALLOW_JSON_IMPORT is not permitted during production application startup.'
    );
  }
  return {
    driver: resolveDriver(production),
    dbPath: resolveDatabasePath(production),
    allowCreate,
    allowJsonImport,
    production,
    busyTimeoutMs: parseInteger('SQLITE_BUSY_TIMEOUT_MS', 10_000, 1, 120_000),
    walAutoCheckpointPages: parseInteger('SQLITE_WAL_AUTOCHECKPOINT_PAGES', 1_000, 1, 100_000),
    synchronous: process.env.SQLITE_SYNCHRONOUS?.trim().toUpperCase() === 'FULL' ? 'FULL' : 'NORMAL',
  };
}

export function redactSQLitePath(dbPath: string) {
  const parentName = path.basename(path.dirname(dbPath));
  return `${parentName ? `${parentName}/` : ''}${path.basename(dbPath)}`;
}
