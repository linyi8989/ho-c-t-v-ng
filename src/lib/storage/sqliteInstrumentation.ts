import { AsyncLocalStorage } from 'node:async_hooks';
import type {
  SQLiteDriverName,
  SQLiteProcessMetrics,
  SQLiteRequestMetrics,
} from './storageTypes';

const requestMetricsStorage = new AsyncLocalStorage<SQLiteRequestMetrics>();

const processMetrics: SQLiteProcessMetrics = {
  queryCount: 0,
  queryDurationMs: 0,
  rowsRead: 0,
  rowsWritten: 0,
  transactionCount: 0,
  transactionDurationMs: 0,
  busyErrors: 0,
  driver: null,
  successfulWrites: 0,
  failedStatements: 0,
};

function createRequestMetrics(driver: SQLiteDriverName | null): SQLiteRequestMetrics {
  return {
    queryCount: 0,
    queryDurationMs: 0,
    rowsRead: 0,
    rowsWritten: 0,
    transactionCount: 0,
    transactionDurationMs: 0,
    busyErrors: 0,
    driver,
  };
}

export function runWithSQLiteRequestMetrics<T>(
  driver: SQLiteDriverName | null,
  action: () => T
) {
  return requestMetricsStorage.run(createRequestMetrics(driver), action);
}

export function getSQLiteRequestMetrics() {
  return requestMetricsStorage.getStore() || null;
}

export function getSQLiteProcessMetrics(): SQLiteProcessMetrics {
  return { ...processMetrics };
}

export function isSQLiteBusyError(error: unknown) {
  const code = String((error as any)?.code || '');
  const message = String((error as any)?.message || '');
  return code === 'SQLITE_BUSY' || code === 'SQLITE_LOCKED' || /database is (?:busy|locked)/i.test(message);
}

function safeSqlLabel(sql: string) {
  return sql
    .replace(/\s+/g, ' ')
    .replace(/('[^']*'|"[^"]*")/g, '?')
    .trim()
    .slice(0, 180);
}

export function recordSQLiteStatement(input: {
  driver: SQLiteDriverName;
  sql: string;
  durationMs: number;
  rowsRead?: number;
  rowsWritten?: number;
  error?: unknown;
}) {
  const rowsRead = Math.max(0, Number(input.rowsRead || 0));
  const rowsWritten = Math.max(0, Number(input.rowsWritten || 0));
  const busy = input.error && isSQLiteBusyError(input.error) ? 1 : 0;
  const request = requestMetricsStorage.getStore();

  for (const target of [processMetrics, request].filter(Boolean) as SQLiteRequestMetrics[]) {
    target.driver = input.driver;
    target.queryCount++;
    target.queryDurationMs += input.durationMs;
    target.rowsRead += rowsRead;
    target.rowsWritten += rowsWritten;
    target.busyErrors += busy;
  }

  if (rowsWritten > 0 && !input.error) processMetrics.successfulWrites += rowsWritten;
  if (input.error) processMetrics.failedStatements++;

  const slowMs = Math.max(0, Number(process.env.SQLITE_SLOW_QUERY_MS || 250));
  if (slowMs > 0 && input.durationMs >= slowMs) {
    console.warn(
      `[SQLite][slow] driver=${input.driver} durationMs=${input.durationMs.toFixed(1)} sql=${safeSqlLabel(input.sql)}`
    );
  }
}

export function recordSQLiteTransaction(
  driver: SQLiteDriverName,
  durationMs: number,
  error?: unknown
) {
  const busy = error && isSQLiteBusyError(error) ? 1 : 0;
  const request = requestMetricsStorage.getStore();
  for (const target of [processMetrics, request].filter(Boolean) as SQLiteRequestMetrics[]) {
    target.driver = driver;
    target.transactionCount++;
    target.transactionDurationMs += durationMs;
    target.busyErrors += busy;
  }
}
