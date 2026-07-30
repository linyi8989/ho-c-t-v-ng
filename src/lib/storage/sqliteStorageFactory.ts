import fs from 'node:fs';
import path from 'node:path';
import { openBetterSQLite } from './betterSqliteStorage';
import { openSqlJsSQLite } from './sqlJsStorage';
import type { SQLiteDriverAdapter, SQLiteStorageConfig } from './storageTypes';

export async function openSQLiteDriver(
  config: SQLiteStorageConfig
): Promise<SQLiteDriverAdapter> {
  const exists = fs.existsSync(config.dbPath);
  if (!exists && !config.allowCreate) {
    throw new Error(`SQLite database file does not exist: ${path.basename(config.dbPath)}`);
  }

  if (!exists && config.allowCreate) {
    fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
  }

  if (config.driver === 'better-sqlite3') return openBetterSQLite(config);
  if (config.driver === 'sqljs') return openSqlJsSQLite(config);
  throw new Error(`Unsupported SQLite driver: ${String(config.driver)}`);
}
