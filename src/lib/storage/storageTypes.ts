export type SQLiteDriverName = 'better-sqlite3' | 'sqljs';

export interface SQLiteStorageConfig {
  driver: SQLiteDriverName;
  dbPath: string;
  allowCreate: boolean;
  allowJsonImport: boolean;
  production: boolean;
  busyTimeoutMs: number;
  walAutoCheckpointPages: number;
  synchronous: 'NORMAL' | 'FULL';
}

export interface SQLiteRunResult {
  changes: number;
  lastInsertRowid?: number | bigint;
}

export interface SQLiteDriverAdapter {
  readonly kind: SQLiteDriverName;
  readonly dbPath: string;
  run(sql: string, params?: readonly unknown[]): SQLiteRunResult;
  all<T = any>(sql: string, params?: readonly unknown[]): T[];
  one<T = any>(sql: string, params?: readonly unknown[]): T | undefined;
  transaction<T>(action: () => T, mode?: 'deferred' | 'immediate'): T;
  exportBytes?(): Uint8Array;
  backup?(destinationPath: string): Promise<void>;
  close(): void;
}

export interface SQLiteRequestMetrics {
  queryCount: number;
  queryDurationMs: number;
  rowsRead: number;
  rowsWritten: number;
  transactionCount: number;
  transactionDurationMs: number;
  busyErrors: number;
  driver: SQLiteDriverName | null;
}

export interface SQLiteProcessMetrics extends SQLiteRequestMetrics {
  successfulWrites: number;
  failedStatements: number;
}
