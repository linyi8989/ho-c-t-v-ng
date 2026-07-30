import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import {
  closeSQLiteStorage,
  getSQLiteDiagnostics,
  initializeSQLiteStorage,
  sqliteExecute,
  sqliteImmediateTransaction,
  sqliteQueryAll,
  sqliteQueryOne,
  SQLiteFirestore,
} from './sqliteStorage';

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'vhomework-history-storage-'));
const databasePath = path.join(temporaryDirectory, 'app.sqlite');
const testDriver = process.env.TEST_SQLITE_DRIVER === 'sqljs'
  ? 'sqljs'
  : 'better-sqlite3';

function configureTestDatabase() {
  process.env.STORAGE_MODE = 'sqlite';
  process.env.SQLITE_DRIVER = testDriver;
  process.env.SQLITE_DB_PATH = databasePath;
  process.env.SQLITE_ALLOW_CREATE = String(!fs.existsSync(databasePath));
  process.env.SQLITE_ALLOW_JSON_IMPORT = 'false';
  process.env.SQLITE_BUSY_TIMEOUT_MS = '2000';
  process.env.SQLITE_WAL_AUTOCHECKPOINT_PAGES = '50';
  process.env.SQLITE_SYNCHRONOUS = 'NORMAL';
  process.env.NODE_ENV = 'test';
}

function learningAttempt(
  attemptId: string,
  sourceRecordId: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    attemptId,
    sourceRecordId,
    clientRunId: `run-${sourceRecordId}`,
    sourceType: 'vocabulary',
    studentType: 'guest',
    userId: null,
    guestId: 'guest-1',
    ownerKey: 'guest:guest-1',
    ownershipStatus: 'linked',
    studentNameSnapshot: 'Student',
    classId: null,
    classNameSnapshot: '',
    assignmentId: null,
    assignmentTitleSnapshot: '',
    assignmentDueAtSnapshot: null,
    lessonId: 'vocab-set-1',
    lessonTitleSnapshot: 'Vocabulary set',
    lessonType: 'vocab_set',
    gameId: 'quiz-en-vi',
    gameTitleSnapshot: 'Quiz',
    score: 80,
    rawScore: 8,
    maxScore: 10,
    correctCount: 8,
    incorrectCount: 2,
    unansweredCount: 0,
    mistakeCount: 0,
    totalQuestions: 10,
    startedAt: '2026-07-30T01:00:00.000Z',
    completedAt: '2026-07-30T01:05:00.000Z',
    activityAt: '2026-07-30T01:05:00.000Z',
    studyDate: '2026-07-30',
    durationSeconds: 300,
    attemptStatus: 'completed',
    attemptNumber: 0,
    schemaVersion: 1,
    detailStatus: 'available',
    normalizationStatus: 'canonical',
    createdAt: '2026-07-30T01:00:00.000Z',
    updatedAt: '2026-07-30T01:05:00.000Z',
    ...overrides,
  };
}

after(async () => {
  await closeSQLiteStorage();
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

test('Release B storage schema, facade mappings, migrations, and gateway invariants', async () => {
  configureTestDatabase();
  await initializeSQLiteStorage();

  const expectedLearningColumns = [
    'attempt_id',
    'source_record_id',
    'client_run_id',
    'source_type',
    'student_type',
    'user_id',
    'guest_id',
    'owner_key',
    'ownership_status',
    'student_name_snapshot',
    'class_id',
    'class_name_snapshot',
    'assignment_id',
    'assignment_title_snapshot',
    'assignment_due_at_snapshot',
    'lesson_id',
    'lesson_title_snapshot',
    'lesson_type',
    'game_id',
    'game_title_snapshot',
    'score',
    'raw_score',
    'max_score',
    'correct_count',
    'incorrect_count',
    'unanswered_count',
    'mistake_count',
    'total_questions',
    'started_at',
    'completed_at',
    'activity_at',
    'study_date',
    'duration_seconds',
    'attempt_status',
    'attempt_number',
    'schema_version',
    'detail_status',
    'normalization_status',
    'created_at',
    'updated_at',
  ];
  const expectedDetailColumns = [
    'attempt_id',
    'client_run_id',
    'source_type',
    'answer_details_json',
    'question_snapshots_json',
    'option_snapshots_json',
    'extra_details_json',
    'review_policy_json',
    'created_at',
    'updated_at',
    'expires_at',
    'schema_version',
  ];
  const learningColumns = await sqliteQueryAll<{ name: string }>(
    'PRAGMA table_info(learning_attempts)'
  );
  const detailColumns = await sqliteQueryAll<{ name: string }>(
    'PRAGMA table_info(attempt_details)'
  );
  assert.deepEqual(learningColumns.map(column => column.name), expectedLearningColumns);
  assert.deepEqual(detailColumns.map(column => column.name), expectedDetailColumns);
  assert.equal(learningColumns.some(column => column.name === 'data_json'), false);
  assert.equal(detailColumns.some(column => column.name === 'data_json'), false);

  const learningIndexes = await sqliteQueryAll<{ name: string; unique: number }>(
    `PRAGMA index_list('learning_attempts')`
  );
  const indexByName = new Map(learningIndexes.map(index => [index.name, index]));
  assert.equal(indexByName.get('idx_learning_attempts_source_record')?.unique, 1);
  assert.equal(indexByName.get('idx_learning_attempts_client_run')?.unique, 1);
  for (const name of [
    'idx_learning_attempts_owner_activity',
    'idx_learning_attempts_owner_source_activity',
    'idx_learning_attempts_owner_assignment_activity',
    'idx_learning_attempts_lesson_activity',
  ]) {
    assert.equal(indexByName.has(name), true);
  }
  const sourceRecordIndexColumns = await sqliteQueryAll<{ name: string }>(
    `PRAGMA index_info('idx_learning_attempts_source_record')`
  );
  assert.deepEqual(
    sourceRecordIndexColumns.map(column => column.name),
    ['source_type', 'source_record_id'],
  );
  const detailForeignKeys = await sqliteQueryAll<{
    table: string;
    from: string;
    to: string;
    on_delete: string;
  }>(`PRAGMA foreign_key_list('attempt_details')`);
  assert.deepEqual(
    detailForeignKeys.map(key => ({
      table: key.table,
      from: key.from,
      to: key.to,
      onDelete: key.on_delete,
    })),
    [{
      table: 'learning_attempts',
      from: 'attempt_id',
      to: 'attempt_id',
      onDelete: 'RESTRICT',
    }],
  );

  const db = new SQLiteFirestore();
  await db.collection('guest_profiles').doc('guest-1').set({
    id: 'guest-1',
    displayName: 'Student',
    normalizedName: 'student',
    accessToken: 'must-never-be-stored',
    guestAccessToken: 'must-never-be-stored-either',
    accessTokenHash: 'physical-hash',
    accessTokenVersion: 2,
    accessTokenCreatedAt: '2026-07-30T00:00:00.000Z',
  });
  const physicalGuest = await sqliteQueryOne<{
    access_token_hash: string;
    access_token_version: number;
    data_json: string;
  }>(
    `SELECT access_token_hash, access_token_version, data_json
     FROM guest_profiles
     WHERE id = ?`,
    ['guest-1'],
  );
  assert.equal(physicalGuest?.access_token_hash, 'physical-hash');
  assert.equal(physicalGuest?.access_token_version, 2);
  assert.equal(JSON.stringify(JSON.parse(physicalGuest?.data_json || '{}')).includes('Token'), false);
  const publicGuest = (await db.collection('guest_profiles').doc('guest-1').get()).data();
  assert.equal(publicGuest.accessToken, undefined);
  assert.equal(publicGuest.guestAccessToken, undefined);
  assert.equal(publicGuest.accessTokenHash, undefined);
  assert.equal(publicGuest.accessTokenVersion, undefined);

  const projectionBatch = db.batch();
  projectionBatch.set(
    db.collection('learning_attempts').doc('attempt-1'),
    learningAttempt('attempt-1', 'source-1'),
  );
  projectionBatch.set(db.collection('attempt_details').doc('attempt-1'), {
    attemptId: 'attempt-1',
    clientRunId: 'run-source-1',
    sourceType: 'vocabulary',
    answerDetails: [{ questionIndex: 0, isCorrect: true }],
    questionSnapshots: [{ questionIndex: 0, prompt: 'Hello' }],
    optionSnapshots: [],
    extraDetails: { gameId: 'quiz-en-vi' },
    reviewPolicy: { showReviewAfterSubmit: true },
    createdAt: '2026-07-30T01:05:00.000Z',
    updatedAt: '2026-07-30T01:05:00.000Z',
    expiresAt: '2026-08-29T01:05:00.000Z',
    schemaVersion: 1,
  });
  projectionBatch.set(db.collection('pronunciation_attempts').doc('pronunciation-1'), {
    id: 'pronunciation-1',
    ownerKey: 'guest:guest-1',
    ownerType: 'guest',
    guestId: 'guest-1',
    studentId: 'guest-1',
    studentName: 'Student',
    vocabularySetId: 'vocab-set-1',
    wordId: 'word-1',
    targetText: 'hello',
    recognizedText: 'hello',
    score: 100,
    correctWords: 1,
    totalWords: 1,
    attemptCount: 1,
    gameSessionId: 'source-1',
    gameId: 'speaking-ai',
    playedAt: '2026-07-30T01:03:00.000Z',
    createdAt: '2026-07-30T01:03:00.000Z',
  });
  await projectionBatch.commit();

  const storedAttempt = (await db.collection('learning_attempts').doc('attempt-1').get()).data();
  assert.equal(storedAttempt.attemptNumber, 1);
  assert.equal(storedAttempt.score, 80);
  const storedDetail = (await db.collection('attempt_details').doc('attempt-1').get()).data();
  assert.deepEqual(storedDetail.answerDetails, [{ questionIndex: 0, isCorrect: true }]);
  assert.deepEqual(storedDetail.reviewPolicy, { showReviewAfterSubmit: true });
  assert.equal(
    (await sqliteQueryOne<{ count: number }>(
      'SELECT COUNT(*) AS count FROM pronunciation_attempts WHERE id = ?',
      ['pronunciation-1'],
    ))?.count,
    1,
  );
  assert.equal(
    (await sqliteQueryOne<{ count: number }>(
      'SELECT COUNT(*) AS count FROM game_results WHERE id = ?',
      ['pronunciation-1'],
    ))?.count,
    0,
  );

  await db.collection('learning_attempts').doc('attempt-2').set(
    learningAttempt('attempt-2', 'source-2', {
      clientRunId: 'run-source-2',
      attemptNumber: 5,
    }),
  );
  await db.collection('learning_attempts').doc('attempt-3').set(
    learningAttempt('attempt-3', 'source-3', {
      clientRunId: 'run-source-3',
    }),
  );
  assert.equal(
    (await db.collection('learning_attempts').doc('attempt-3').get()).data().attemptNumber,
    6,
  );

  await db.collection('learning_attempts').doc('attempt-1').set(
    learningAttempt('attempt-1', 'source-1', { score: 90, attemptNumber: 99 }),
  );
  const replayedAttempt = (await db.collection('learning_attempts').doc('attempt-1').get()).data();
  assert.equal(replayedAttempt.score, 90);
  assert.equal(replayedAttempt.attemptNumber, 1);
  for (const { override, field } of [
    { override: { clientRunId: 'different-run' }, field: 'client_run_id' },
    { override: { studentType: 'authenticated' }, field: 'student_type' },
    { override: { userId: 'user-2' }, field: 'user_id' },
    { override: { guestId: 'guest-2' }, field: 'guest_id' },
    { override: { ownerKey: 'guest:guest-2' }, field: 'owner_key' },
    { override: { ownershipStatus: 'legacy_unlinked' }, field: 'ownership_status' },
  ]) {
    await assert.rejects(
      () => db.collection('learning_attempts').doc('attempt-1').set(
        learningAttempt('attempt-1', 'source-1', override),
      ),
      new RegExp(`immutable field mismatch: ${field}`, 'i'),
    );
  }
  await assert.rejects(
    () => db.collection('learning_attempts').doc('attempt-other').set(
      learningAttempt('attempt-other', 'source-other', {
        clientRunId: 'run-source-1',
      }),
    ),
    /UNIQUE constraint failed/i,
  );

  const rollbackBatch = db.batch();
  rollbackBatch.set(db.collection('pronunciation_attempts').doc('pronunciation-rollback'), {
    id: 'pronunciation-rollback',
    score: 50,
    createdAt: '2026-07-30T02:00:00.000Z',
  });
  rollbackBatch.set(db.collection('attempt_details').doc('missing-attempt'), {
    attemptId: 'missing-attempt',
    sourceType: 'unsupported',
    createdAt: '2026-07-30T02:00:00.000Z',
    updatedAt: '2026-07-30T02:00:00.000Z',
  });
  await assert.rejects(() => rollbackBatch.commit(), /CHECK constraint failed/i);
  assert.equal(
    (await db.collection('pronunciation_attempts').doc('pronunciation-rollback').get()).exists,
    false,
  );

  await sqliteExecute(
    `UPDATE attempt_details
     SET answer_details_json = ?
     WHERE attempt_id = ?`,
    ['{malformed', 'attempt-1'],
  );
  assert.equal(
    (await db.collection('attempt_details').doc('attempt-1').get()).data().answerDetails,
    null,
  );

  const transactionValue = await sqliteImmediateTransaction(gateway => {
    gateway.run(
      'INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)',
      ['gateway-value', JSON.stringify('ok'), '2026-07-30T00:00:00.000Z'],
    );
    return gateway.one<{ value_json: string }>(
      'SELECT value_json FROM settings WHERE key = ?',
      ['gateway-value'],
    )?.value_json;
  });
  assert.equal(JSON.parse(transactionValue || 'null'), 'ok');
  await assert.rejects(
    () => sqliteImmediateTransaction(async gateway => {
      gateway.run(
        'INSERT INTO settings (key, value_json, updated_at) VALUES (?, ?, ?)',
        ['async-callback-must-rollback', JSON.stringify(true), '2026-07-30T00:00:00.000Z'],
      );
    }),
    /transaction callbacks must be synchronous/i,
  );
  assert.equal(
    await sqliteQueryOne(
      'SELECT key FROM settings WHERE key = ?',
      ['async-callback-must-rollback'],
    ),
    undefined,
  );

  await sqliteExecute(
    `UPDATE guest_profiles
     SET access_token_hash = NULL,
         access_token_version = NULL,
         access_token_created_at = NULL,
         data_json = ?
     WHERE id = ?`,
    [
      JSON.stringify({
        id: 'guest-1',
        displayName: 'Student',
        guestAccessTokenHash: 'legacy-json-hash',
        accessTokenVersion: 3,
        accessTokenCreatedAt: '2026-07-30T00:00:00.000Z',
      }),
      'guest-1',
    ],
  );
  await sqliteExecute(
    'DELETE FROM migrations WHERE id = ?',
    ['guest-capability-physical-v1'],
  );
  await closeSQLiteStorage();
  configureTestDatabase();
  await initializeSQLiteStorage();
  const migratedGuest = await sqliteQueryOne<{
    access_token_hash: string;
    access_token_version: number;
    data_json: string;
  }>(
    `SELECT access_token_hash, access_token_version, data_json
     FROM guest_profiles
     WHERE id = ?`,
    ['guest-1'],
  );
  assert.equal(migratedGuest?.access_token_hash, 'legacy-json-hash');
  assert.equal(migratedGuest?.access_token_version, 3);
  assert.equal(JSON.stringify(JSON.parse(migratedGuest?.data_json || '{}')).includes('Token'), false);
  assert.equal(
    (await new SQLiteFirestore().collection('guest_profiles').doc('guest-1').get())
      .data().guestAccessTokenHash,
    undefined,
  );

  const rowCountsBeforeReopen = await sqliteQueryOne<{
    learning_attempts: number;
    attempt_details: number;
    pronunciation_attempts: number;
  }>(
    `SELECT
       (SELECT COUNT(*) FROM learning_attempts) AS learning_attempts,
       (SELECT COUNT(*) FROM attempt_details) AS attempt_details,
       (SELECT COUNT(*) FROM pronunciation_attempts) AS pronunciation_attempts`
  );
  await closeSQLiteStorage();
  configureTestDatabase();
  await initializeSQLiteStorage();
  const rowCountsAfterReopen = await sqliteQueryOne<{
    learning_attempts: number;
    attempt_details: number;
    pronunciation_attempts: number;
  }>(
    `SELECT
       (SELECT COUNT(*) FROM learning_attempts) AS learning_attempts,
       (SELECT COUNT(*) FROM attempt_details) AS attempt_details,
       (SELECT COUNT(*) FROM pronunciation_attempts) AS pronunciation_attempts`
  );
  assert.deepEqual(rowCountsAfterReopen, rowCountsBeforeReopen);
  assert.deepEqual(
    await sqliteQueryAll(
      `SELECT id, COUNT(*) AS count
       FROM migrations
       GROUP BY id
       HAVING COUNT(*) > 1`
    ),
    [],
  );

  const diagnostics = await getSQLiteDiagnostics();
  assert.equal(diagnostics.quickCheck, 'ok');
  assert.equal(diagnostics.tableCounts.learning_attempts, 3);
  assert.equal(diagnostics.tableCounts.attempt_details, 1);
  assert.equal(diagnostics.tableCounts.pronunciation_attempts, 1);
  assert.equal(diagnostics.tableCounts.learning_history_backfill_state, 0);
  assert.equal(
    typeof diagnostics.lastMigration === 'string'
      ? diagnostics.lastMigration
      : (diagnostics.lastMigration as any)?.id,
    'guest-capability-physical-v1',
  );
});
