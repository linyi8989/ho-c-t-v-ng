import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { after, test } from 'node:test';
import {
  closeSQLiteStorage,
  getSQLiteCurrentRequestMetrics,
  getSQLiteDiagnostics,
  initializeSQLiteStorage,
  SQLiteFirestore,
  withSQLiteRequestMetrics,
} from './sqliteStorage';

const require = createRequire(path.join(process.cwd(), 'package.json'));
const Database = require('better-sqlite3');
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'vhomework-sqlite-'));
const databasePath = path.join(temporaryDirectory, 'app.sqlite');

function runConcurrentWriter(targetPath: string, workerId: number) {
  const source = `
    const Database = require('better-sqlite3');
    const db = new Database(process.argv[1], { fileMustExist: true, timeout: 5000 });
    db.pragma('busy_timeout = 5000');
    const insert = db.prepare('INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)');
    db.transaction(() => {
      for (let index = 0; index < 20; index++) {
        insert.run('worker-' + process.argv[2] + '-' + index, JSON.stringify(index), new Date().toISOString());
      }
    })();
    db.close();
  `;
  return new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, ['-e', source, targetPath, String(workerId)], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let errorOutput = '';
    child.stderr.on('data', chunk => { errorOutput += chunk.toString(); });
    child.once('error', reject);
    child.once('exit', code => {
      if (code === 0) resolve();
      else reject(new Error(`Concurrent writer ${workerId} failed (${code}): ${errorOutput}`));
    });
  });
}

function configureTestDatabase(
  targetPath: string,
  allowCreate: boolean,
  driver: 'better-sqlite3' | 'sqljs' = 'better-sqlite3'
) {
  process.env.STORAGE_MODE = 'sqlite';
  process.env.SQLITE_DRIVER = driver;
  process.env.SQLITE_DB_PATH = targetPath;
  process.env.SQLITE_ALLOW_CREATE = String(allowCreate);
  process.env.SQLITE_ALLOW_JSON_IMPORT = 'false';
  process.env.SQLITE_BUSY_TIMEOUT_MS = '2000';
  process.env.SQLITE_WAL_AUTOCHECKPOINT_PAGES = '50';
  process.env.SQLITE_SYNCHRONOUS = 'NORMAL';
  process.env.NODE_ENV = 'test';
}

after(async () => {
  await closeSQLiteStorage();
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

test('better-sqlite3 facade persists CRUD data, enables WAL, and rolls batches back atomically', async () => {
  configureTestDatabase(databasePath, true);
  await initializeSQLiteStorage();
  const db = new SQLiteFirestore();

  await db.collection('users').doc('student-1').set({
    id: 'student-1',
    email: 'student@example.test',
    name: 'Student One',
    role: 'student',
    createdAt: '2026-01-01T00:00:00.000Z',
  });
  const stored = await db.collection('users').doc('student-1').get();
  assert.equal(stored.exists, true);
  assert.equal(stored.data().name, 'Student One');
  await db.collection('users').doc('student-1').update({ name: 'Student Updated' });
  assert.equal(
    (await db.collection('users').doc('student-1').get()).data().name,
    'Student Updated'
  );

  const query = await db.collection('users').where('email', '==', 'student@example.test').limit(1).get();
  assert.equal(query.size, 1);
  assert.equal(query.docs[0].id, 'student-1');

  let requestMetrics: ReturnType<typeof getSQLiteCurrentRequestMetrics> = null;
  await withSQLiteRequestMetrics(async () => {
    await db.collection('users').doc('student-1').get();
    requestMetrics = getSQLiteCurrentRequestMetrics();
  });
  assert.equal(Number(requestMetrics?.queryCount || 0) >= 1, true);
  assert.equal(Number(requestMetrics?.rowsRead || 0) >= 1, true);

  const committedBatch = db.batch();
  committedBatch.set(db.collection('settings').doc('commit-a'), { value: 'a' });
  committedBatch.set(db.collection('settings').doc('commit-b'), { value: 'b' });
  await committedBatch.commit();
  assert.equal((await db.collection('settings').doc('commit-a').get()).exists, true);
  await db.collection('settings').doc('commit-a').delete();
  assert.equal((await db.collection('settings').doc('commit-a').get()).exists, false);

  for (let retry = 0; retry < 2; retry++) {
    const idempotentBatch = db.batch();
    idempotentBatch.set(db.collection('game_sessions').doc('stable-run-id'), {
      id: 'stable-run-id',
      ownerKey: 'guest:stable',
      clientRunId: 'stable-client-run',
      gameId: 'quiz-en-vi',
      vocabSetId: 'set-stable',
      status: 'completed',
      completedAt: '2026-01-01T00:10:00.000Z',
      score: 100,
    });
    idempotentBatch.set(db.collection('leaderboard_events').doc('stable-event-id'), {
      id: 'stable-event-id',
      sourceType: 'vocabulary',
      sourceId: 'stable-run-id',
      studentKey: 'guest:stable',
      vocabSetId: 'set-stable',
      completedAt: '2026-01-01T00:10:00.000Z',
      score: 100,
    });
    await idempotentBatch.commit();
  }

  const batch = db.batch();
  batch.set(db.collection('game_session_actions').doc('action-1'), {
    id: 'action-1',
    sessionId: 'session-atomic',
    sequence: 1,
    type: 'answer',
  });
  batch.set(db.collection('game_session_actions').doc('action-2'), {
    id: 'action-2',
    sessionId: 'session-atomic',
    sequence: 1,
    type: 'answer',
  });
  await assert.rejects(() => batch.commit(), /UNIQUE constraint failed/i);
  assert.equal((await db.collection('game_session_actions').doc('action-1').get()).exists, false);

  const diagnostics = await getSQLiteDiagnostics();
  assert.equal(diagnostics.sqliteDriver, 'better-sqlite3');
  assert.equal(diagnostics.quickCheck, 'ok');
  assert.equal(diagnostics.pragmas.journalMode, 'wal');
  assert.equal(diagnostics.pragmas.foreignKeys, 1);
  assert.equal(diagnostics.pragmas.busyTimeoutMs, 2000);
  assert.equal(diagnostics.pragmas.walAutoCheckpointPages, 50);
  assert.equal(diagnostics.sqliteDbBasename, 'app.sqlite');
  assert.equal(String(diagnostics.sqliteDbPath).includes(temporaryDirectory), false);
  assert.equal(diagnostics.nodeVersion, process.version);
  assert.equal(diagnostics.nodeAbi, process.versions.modules);
  assert.equal(diagnostics.platform, process.platform);
  assert.equal(diagnostics.architecture, process.arch);

  const idempotencyReader = new Database(databasePath, { fileMustExist: true, readonly: true });
  try {
    assert.equal(
      idempotencyReader.prepare(
        `SELECT COUNT(*) AS count FROM game_results WHERE id = 'stable-run-id'`
      ).get().count,
      1
    );
    assert.equal(
      idempotencyReader.prepare(
        `SELECT COUNT(*) AS count FROM leaderboard_events WHERE id = 'stable-event-id'`
      ).get().count,
      1
    );
  } finally {
    idempotencyReader.close();
  }

  const reader = new Database(databasePath, { fileMustExist: true, readonly: true });
  const writer = new Database(databasePath, { fileMustExist: true, timeout: 2000 });
  try {
    assert.equal(reader.pragma('journal_mode', { simple: true }), 'wal');
    assert.equal(reader.prepare('SELECT COUNT(*) AS count FROM users').get().count, 1);
    const committedSettingsCount = reader.prepare(
      'SELECT COUNT(*) AS count FROM settings'
    ).get().count;
    writer.exec('BEGIN IMMEDIATE');
    writer.prepare(
      `INSERT INTO settings (key, value_json, updated_at)
       VALUES (?, ?, ?)`
    ).run('uncommitted', JSON.stringify('value'), '2026-01-01T00:00:00.000Z');
    assert.equal(
      reader.prepare('SELECT COUNT(*) AS count FROM settings').get().count,
      committedSettingsCount
    );
    writer.exec('ROLLBACK');
  } finally {
    if (writer.inTransaction) writer.exec('ROLLBACK');
    writer.close();
    reader.close();
  }

  await Promise.all([
    runConcurrentWriter(databasePath, 1),
    runConcurrentWriter(databasePath, 2),
    runConcurrentWriter(databasePath, 3),
  ]);
  const concurrencyReader = new Database(databasePath, { fileMustExist: true, readonly: true });
  try {
    assert.equal(
      concurrencyReader.prepare(
        `SELECT COUNT(*) AS count
         FROM settings
         WHERE key LIKE 'worker-%'`
      ).get().count,
      60
    );
  } finally {
    concurrencyReader.close();
  }

  await closeSQLiteStorage();
  configureTestDatabase(databasePath, false);
  await initializeSQLiteStorage();
  assert.equal((await new SQLiteFirestore().collection('users').doc('student-1').get()).exists, true);

  const migrationReader = new Database(databasePath, { fileMustExist: true, readonly: true });
  try {
    const duplicates = migrationReader.prepare(
      `SELECT id, COUNT(*) AS count
       FROM migrations
       GROUP BY id
       HAVING COUNT(*) > 1`
    ).all();
    assert.deepEqual(duplicates, []);
  } finally {
    migrationReader.close();
  }
});

test('legacy game_results schema is migrated additively and normalized fields are backfilled', async () => {
  await closeSQLiteStorage();
  const legacyPath = path.join(temporaryDirectory, 'legacy.sqlite');
  const legacy = new Database(legacyPath);
  try {
    legacy.exec(`
      CREATE TABLE migrations (id TEXT PRIMARY KEY, applied_at TEXT);
      CREATE TABLE game_results (
        id TEXT PRIMARY KEY,
        assignment_id TEXT,
        user_id TEXT,
        game_id TEXT,
        vocab_set_id TEXT,
        score INTEGER,
        correct INTEGER,
        incorrect INTEGER,
        created_at TEXT,
        data_json TEXT NOT NULL
      );
    `);
    legacy.prepare(
      `INSERT INTO game_results (
        id, game_id, vocab_set_id, score, correct, incorrect, created_at, data_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      'legacy-session',
      'quiz',
      'set-1',
      80,
      4,
      1,
      '2026-01-02T00:00:00.000Z',
      JSON.stringify({
        id: 'legacy-session',
        guestId: 'guest-1',
        ownerKey: 'guest:guest-1',
        clientRunId: 'run-1',
        status: 'completed',
        completedAt: '2026-01-02T00:05:00.000Z',
      })
    );
  } finally {
    legacy.close();
  }

  configureTestDatabase(legacyPath, false);
  await initializeSQLiteStorage();

  const migrated = new Database(legacyPath, { fileMustExist: true, readonly: true });
  try {
    const row = migrated.prepare(
      `SELECT guest_id, owner_key, client_run_id, status, completed_at, data_json
       FROM game_results
       WHERE id = ?`
    ).get('legacy-session');
    assert.equal(row.guest_id, 'guest-1');
    assert.equal(row.owner_key, 'guest:guest-1');
    assert.equal(row.client_run_id, 'run-1');
    assert.equal(row.status, 'completed');
    assert.equal(row.completed_at, '2026-01-02T00:05:00.000Z');
    assert.equal(JSON.parse(row.data_json).id, 'legacy-session');
    assert.equal(migrated.pragma('quick_check', { simple: true }), 'ok');
  } finally {
    migrated.close();
  }

  await closeSQLiteStorage();
  configureTestDatabase(legacyPath, false);
  await initializeSQLiteStorage();
  assert.equal((await getSQLiteDiagnostics()).quickCheck, 'ok');
});

test('strict path policy refuses a missing database instead of creating or importing one', async () => {
  await closeSQLiteStorage();
  const missingPath = path.join(temporaryDirectory, 'missing.sqlite');
  configureTestDatabase(missingPath, false);
  await assert.rejects(
    () => initializeSQLiteStorage(),
    /database file does not exist/i
  );
  assert.equal(fs.existsSync(missingPath), false);

  await closeSQLiteStorage();
  configureTestDatabase(path.join(temporaryDirectory, 'production-create.sqlite'), true);
  process.env.NODE_ENV = 'production';
  await assert.rejects(
    () => initializeSQLiteStorage(),
    /SQLITE_ALLOW_CREATE must be false/i
  );
});

test('sql.js remains an explicit rollback driver and refuses a non-empty WAL', async () => {
  await closeSQLiteStorage();
  const rollbackPath = path.join(temporaryDirectory, 'rollback.sqlite');
  configureTestDatabase(rollbackPath, true, 'sqljs');
  await initializeSQLiteStorage();
  const rollbackDb = new SQLiteFirestore();
  await rollbackDb.collection('settings').doc('rollback-probe').set({ value: 'ok' });
  await closeSQLiteStorage();

  configureTestDatabase(rollbackPath, false, 'sqljs');
  await initializeSQLiteStorage();
  assert.equal(
    (await new SQLiteFirestore().collection('settings').doc('rollback-probe').get()).data().value,
    'ok'
  );
  await closeSQLiteStorage();

  const walGuardPath = path.join(temporaryDirectory, 'wal-guard.sqlite');
  const native = new Database(walGuardPath);
  try {
    native.pragma('journal_mode = WAL');
    native.exec('CREATE TABLE guard_probe (id INTEGER PRIMARY KEY, value TEXT)');
    native.prepare('INSERT INTO guard_probe (value) VALUES (?)').run('pending-wal');
    assert.equal(fs.statSync(`${walGuardPath}-wal`).size > 0, true);

    configureTestDatabase(walGuardPath, false, 'sqljs');
    await assert.rejects(
      () => initializeSQLiteStorage(),
      /non-empty SQLite WAL sidecar/i
    );
  } finally {
    native.close();
  }
});
