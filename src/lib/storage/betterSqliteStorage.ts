import { createRequire } from 'node:module';
import path from 'node:path';
import {
  recordSQLiteStatement,
  recordSQLiteTransaction,
} from './sqliteInstrumentation';
import type {
  SQLiteDriverAdapter,
  SQLiteRunResult,
  SQLiteStorageConfig,
} from './storageTypes';

const require = createRequire(path.join(process.cwd(), 'package.json'));

function callStatement(statement: any, method: 'all' | 'get' | 'run', params: readonly unknown[]) {
  return params.length > 0 ? statement[method](...params) : statement[method]();
}

export async function openBetterSQLite(
  config: SQLiteStorageConfig
): Promise<SQLiteDriverAdapter> {
  const Database = require('better-sqlite3');
  const db = new Database(config.dbPath, {
    fileMustExist: !config.allowCreate,
    timeout: config.busyTimeoutMs,
  });
  const statementCache = new Map<string, any>();
  const configuredCacheLimit = Number(process.env.SQLITE_STATEMENT_CACHE_SIZE || 200);
  const statementCacheLimit = Number.isFinite(configuredCacheLimit)
    ? Math.max(10, Math.min(1_000, Math.floor(configuredCacheLimit)))
    : 200;
  const prepare = (sql: string) => {
    const cached = statementCache.get(sql);
    if (cached) {
      statementCache.delete(sql);
      statementCache.set(sql, cached);
      return cached;
    }
    const statement = db.prepare(sql);
    statementCache.set(sql, statement);
    if (statementCache.size > statementCacheLimit) {
      const oldest = statementCache.keys().next().value;
      if (oldest !== undefined) statementCache.delete(oldest);
    }
    return statement;
  };

  const adapter: SQLiteDriverAdapter = {
    kind: 'better-sqlite3',
    dbPath: config.dbPath,
    run(sql: string, params: readonly unknown[] = []): SQLiteRunResult {
      const startedAt = performance.now();
      let result: any;
      let error: unknown;
      try {
        if (params.length === 0 && /;\s*\S/.test(sql.trim().replace(/;\s*$/, ''))) {
          db.exec(sql);
          result = { changes: 0 };
        } else {
          result = callStatement(prepare(sql), 'run', params);
        }
        return {
          changes: Number(result?.changes || 0),
          lastInsertRowid: result?.lastInsertRowid,
        };
      } catch (err) {
        error = err;
        throw err;
      } finally {
        recordSQLiteStatement({
          driver: 'better-sqlite3',
          sql,
          durationMs: performance.now() - startedAt,
          rowsWritten: Number(result?.changes || 0),
          error,
        });
      }
    },
    all<T>(sql: string, params: readonly unknown[] = []): T[] {
      const startedAt = performance.now();
      let rows: T[] = [];
      let error: unknown;
      try {
        rows = callStatement(prepare(sql), 'all', params) as T[];
        return rows;
      } catch (err) {
        error = err;
        throw err;
      } finally {
        recordSQLiteStatement({
          driver: 'better-sqlite3',
          sql,
          durationMs: performance.now() - startedAt,
          rowsRead: rows.length,
          error,
        });
      }
    },
    one<T>(sql: string, params: readonly unknown[] = []): T | undefined {
      const startedAt = performance.now();
      let row: T | undefined;
      let error: unknown;
      try {
        row = callStatement(prepare(sql), 'get', params) as T | undefined;
        return row;
      } catch (err) {
        error = err;
        throw err;
      } finally {
        recordSQLiteStatement({
          driver: 'better-sqlite3',
          sql,
          durationMs: performance.now() - startedAt,
          rowsRead: row === undefined ? 0 : 1,
          error,
        });
      }
    },
    transaction<T>(action: () => T, mode: 'deferred' | 'immediate' = 'deferred'): T {
      const startedAt = performance.now();
      let error: unknown;
      try {
        const transaction = db.transaction(action);
        return mode === 'immediate' ? transaction.immediate() : transaction();
      } catch (err) {
        error = err;
        throw err;
      } finally {
        recordSQLiteTransaction('better-sqlite3', performance.now() - startedAt, error);
      }
    },
    async backup(destinationPath: string) {
      await db.backup(destinationPath);
    },
    close() {
      statementCache.clear();
      if (db.open) db.close();
    },
  };

  return adapter;
}
