import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(path.join(process.cwd(), 'package.json'));
const initSqlJs = require('sql.js');

test('SQL.js startup applies standalone completed_at indexes used by bounded activity reads', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vhomework-activity-indexes-'));
  const databasePath = path.join(directory, 'app.sqlite');
  process.env.STORAGE_MODE = 'sqlite';
  process.env.SQLITE_DRIVER = 'sqljs';
  process.env.SQLITE_DB_PATH = databasePath;
  process.env.SQLITE_ALLOW_CREATE = 'true';
  process.env.SQLITE_ALLOW_JSON_IMPORT = 'false';
  process.env.NODE_ENV = 'test';

  const { closeSQLiteStorage, initializeSQLiteStorage } = await import('./sqliteStorage');
  try {
    await initializeSQLiteStorage();
    await closeSQLiteStorage();

    const SQL = await initSqlJs({
      locateFile: (file: string) => path.join(path.dirname(require.resolve('sql.js/dist/sql-wasm.wasm')), file),
    });
    const db = new SQL.Database(fs.readFileSync(databasePath));
    try {
      const indexRows = db.exec(
        `SELECT name FROM sqlite_master
         WHERE type = 'index' AND name LIKE 'idx_%_completed_at'
         ORDER BY name`
      )[0]?.values || [];
      const indexes = new Set(indexRows.map((row: any[]) => String(row[0])));
      for (const indexName of [
        'idx_game_results_completed_at',
        'idx_grammar_attempts_completed_at',
        'idx_listening_attempts_completed_at',
        'idx_mover_reading_attempts_completed_at',
        'idx_exam_attempts_completed_at',
      ]) {
        assert.equal(indexes.has(indexName), true, `missing ${indexName}`);
      }

      for (const [tableName, indexName] of [
        ['game_results', 'idx_game_results_completed_at'],
        ['grammar_attempts', 'idx_grammar_attempts_completed_at'],
        ['listening_attempts', 'idx_listening_attempts_completed_at'],
        ['exam_attempts', 'idx_exam_attempts_completed_at'],
      ]) {
        const planRows = db.exec(
          `EXPLAIN QUERY PLAN
           SELECT id FROM ${tableName}
           WHERE completed_at >= '2026-01-01T00:00:00.000Z'
           ORDER BY completed_at DESC
           LIMIT 100`
        )[0]?.values || [];
        const plan = planRows.map((row: any[]) => String(row[3])).join(' ');
        assert.match(plan, new RegExp(indexName));
      }
    } finally {
      db.close();
    }
  } finally {
    await closeSQLiteStorage().catch(() => undefined);
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
