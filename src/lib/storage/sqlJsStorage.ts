import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
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

export async function openSqlJsSQLite(
  config: SQLiteStorageConfig
): Promise<SQLiteDriverAdapter> {
  const walPath = `${config.dbPath}-wal`;
  if (fs.existsSync(walPath) && fs.statSync(walPath).size > 0) {
    throw new Error(
      'sql.js rollback refused: a non-empty SQLite WAL sidecar exists. Run the native rollback preparation command first.'
    );
  }

  const initSqlJs = require('sql.js');
  const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm');
  const SQL = await initSqlJs({ locateFile: () => wasmPath });
  const existing = fs.existsSync(config.dbPath) ? fs.readFileSync(config.dbPath) : undefined;
  const db = existing ? new SQL.Database(existing) : new SQL.Database();

  const all = <T>(sql: string, params: readonly unknown[] = []): T[] => {
    const startedAt = performance.now();
    const statement = db.prepare(sql);
    const rows: T[] = [];
    let error: unknown;
    try {
      statement.bind([...params]);
      while (statement.step()) rows.push(statement.getAsObject() as T);
      return rows;
    } catch (err) {
      error = err;
      throw err;
    } finally {
      statement.free();
      recordSQLiteStatement({
        driver: 'sqljs',
        sql,
        durationMs: performance.now() - startedAt,
        rowsRead: rows.length,
        error,
      });
    }
  };

  return {
    kind: 'sqljs',
    dbPath: config.dbPath,
    run(sql: string, params: readonly unknown[] = []): SQLiteRunResult {
      const startedAt = performance.now();
      let error: unknown;
      try {
        if (params.length === 0 && /;\s*\S/.test(sql.trim().replace(/;\s*$/, ''))) {
          db.exec(sql);
        } else {
          db.run(sql, [...params]);
        }
        const changes = Number(db.getRowsModified?.() || 0);
        return { changes };
      } catch (err) {
        error = err;
        throw err;
      } finally {
        recordSQLiteStatement({
          driver: 'sqljs',
          sql,
          durationMs: performance.now() - startedAt,
          error,
        });
      }
    },
    all,
    one<T>(sql: string, params: readonly unknown[] = []): T | undefined {
      return all<T>(sql, params)[0];
    },
    transaction<T>(action: () => T): T {
      const startedAt = performance.now();
      let committed = false;
      let error: unknown;
      try {
        db.run('BEGIN TRANSACTION');
        const result = action();
        db.run('COMMIT');
        committed = true;
        return result;
      } catch (err) {
        error = err;
        if (!committed) {
          try {
            db.run('ROLLBACK');
          } catch {
            // Preserve the original transaction error.
          }
        }
        throw err;
      } finally {
        recordSQLiteTransaction('sqljs', performance.now() - startedAt, error);
      }
    },
    exportBytes() {
      return db.export();
    },
    close() {
      db.close();
    },
  };
}
