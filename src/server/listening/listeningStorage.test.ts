import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

test('listening schema persists immutable versions and is unioned into learning history', async () => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'vhomework-listening-storage-'));
  const databasePath = path.join(temporaryDirectory, 'app.sqlite');
  process.env.NODE_ENV = 'test';
  process.env.STORAGE_MODE = 'sqlite';
  process.env.SQLITE_DRIVER = 'sqljs';
  process.env.SQLITE_DB_PATH = databasePath;
  process.env.SQLITE_ALLOW_CREATE = 'true';
  process.env.SQLITE_ALLOW_JSON_IMPORT = 'false';

  const storage = await import('../../lib/sqliteStorage');
  const history = await import('../learning-history/learningHistoryRepository');
  await storage.initializeSQLiteStorage();
  const db = new storage.SQLiteFirestore();
  const now = new Date().toISOString();

  await db.collection('listening_sets').doc('listen-1').set({
    id: 'listen-1',
    ownerId: 'teacher-1',
    title: 'Movers listening',
    status: 'published',
    visibility: 'public',
    publishedVersionId: 'listenver-1',
    createdAt: now,
    updatedAt: now,
  });
  await db.collection('listening_set_versions').doc('listenver-1').set({
    id: 'listenver-1',
    setId: 'listen-1',
    versionNumber: 1,
    status: 'published',
    content: { title: 'Movers listening' },
    createdAt: now,
    updatedAt: now,
  });
  await db.collection('listening_attempts').doc('lattempt-1').set({
    id: 'lattempt-1',
    ownerKey: 'guest:learner-1',
    guestId: 'learner-1',
    studentName: 'Lan Anh',
    setId: 'listen-1',
    versionId: 'listenver-1',
    clientRunId: 'run-1',
    runSecretHash: 'secret-hash',
    setTitle: 'Movers listening',
    score: 80,
    correctCount: 20,
    incorrectCount: 3,
    unansweredCount: 2,
    startedAt: now,
    completedAt: now,
    durationSeconds: 300,
    createdAt: now,
    updatedAt: now,
  });
  await db.collection('listening_attempt_details').doc('lattempt-1').set({
    id: 'lattempt-1',
    attemptId: 'lattempt-1',
    answerDetails: [{ questionText: 'Part 1', userAnswer: 'Peter', isCorrect: true }],
    questionSnapshots: [{ questionText: 'Part 1' }],
    optionSnapshots: [],
    extraDetails: { versionId: 'listenver-1' },
    reviewPolicy: { revealCorrectAnswers: false },
    createdAt: now,
    updatedAt: now,
  });

  const list = await history.listLearningHistory('guest:learner-1', {
    page: 1,
    pageSize: 20,
    sourceType: 'listening',
    historyType: 'all',
    groupByAssignment: false,
  });
  assert.equal(list.pagination.totalItems, 1);
  assert.equal(list.items[0].sourceType, 'listening');
  assert.equal(list.items[0].score, 80);
  assert.equal(list.items[0].totalQuestions, 25);
  assert.equal(list.items[0].lessonTitle, 'Movers listening');

  const detail = await history.findAttemptDetail('lattempt-1');
  assert.equal(detail?.source_type, 'listening');
  assert.match(String(detail?.answer_details_json), /Peter/);

  const diagnostics = await storage.getSQLiteDiagnostics();
  assert.equal(diagnostics.tableCounts.listening_attempts, 1);
  assert.equal(diagnostics.tableCounts.listening_set_versions, 1);
  await storage.closeSQLiteStorage();
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});
