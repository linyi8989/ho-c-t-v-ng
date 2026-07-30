import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { after, before, test } from 'node:test';
import {
  closeSQLiteStorage,
  initializeSQLiteStorage,
  SQLiteFirestore,
} from '../../lib/sqliteStorage';
import {
  projectGrammarAttempt,
  projectVocabularyAttempt,
} from './learningAttemptProjector';
import { createLearningHistoryRouter } from './learningHistoryRouter';

const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'vhomework-history-api-'));
const databasePath = path.join(temporaryDirectory, 'app.sqlite');
const guestAToken = 'guest-a-access-token-that-is-long-enough';
const guestBToken = 'guest-b-access-token-that-is-long-enough';
const guestCToken = 'guest-c-access-token-that-is-long-enough';
const studentAToken = 'student-a-firebase-token';
let baseUrl = '';
let closeServer: (() => Promise<void>) | null = null;
let staleAttemptId = '';
let recentAttemptId = '';

function hash(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function historyHeaders(guestId: string, token: string) {
  return {
    'X-Guest-Id': guestId,
    'X-Guest-Access-Token': token,
  };
}

before(async () => {
  process.env.STORAGE_MODE = 'sqlite';
  process.env.SQLITE_DRIVER = 'better-sqlite3';
  process.env.SQLITE_DB_PATH = databasePath;
  process.env.SQLITE_ALLOW_CREATE = 'true';
  process.env.SQLITE_ALLOW_JSON_IMPORT = 'false';
  process.env.SQLITE_BUSY_TIMEOUT_MS = '2000';
  process.env.SQLITE_WAL_AUTOCHECKPOINT_PAGES = '50';
  process.env.SQLITE_SYNCHRONOUS = 'NORMAL';
  process.env.NODE_ENV = 'test';
  await initializeSQLiteStorage();

  const db = new SQLiteFirestore();
  await Promise.all([
    db.collection('guest_profiles').doc('guest-a').set({
      id: 'guest-a',
      displayName: 'Guest A',
      status: 'active',
      accessTokenHash: hash(guestAToken),
      accessTokenVersion: 1,
      accessTokenCreatedAt: '2026-01-01T00:00:00.000Z',
    }),
    db.collection('guest_profiles').doc('guest-b').set({
      id: 'guest-b',
      displayName: 'Guest B',
      status: 'active',
      accessTokenHash: hash(guestBToken),
      accessTokenVersion: 1,
      accessTokenCreatedAt: '2026-01-01T00:00:00.000Z',
    }),
    db.collection('guest_profiles').doc('guest-c').set({
      id: 'guest-c',
      displayName: 'Guest C',
      status: 'active',
      accessTokenHash: hash(guestCToken),
      accessTokenVersion: 1,
      accessTokenCreatedAt: '2026-01-01T00:00:00.000Z',
    }),
    db.collection('guest_profiles').doc('guest-legacy').set({
      id: 'guest-legacy',
      displayName: 'Legacy Guest',
      status: 'active',
    }),
  ]);

  const grammarSource = {
    id: 'grammar-source-a',
    ownerKey: 'guest:guest-a',
    ownerType: 'guest',
    guestId: 'guest-a',
    studentName: 'Guest A',
    grammarSetId: 'grammar-set-a',
    grammarSetTitle: 'Grammar A',
    classId: 'class-a',
    className: 'Class A',
    status: 'completed',
    score: 4,
    maxScore: 5,
    correctCount: 4,
    wrongCount: 1,
    unansweredCount: 0,
    startedAt: '2026-01-02T00:00:00.000Z',
    completedAt: '2026-01-02T00:05:00.000Z',
    reviewPolicySnapshot: {
      showReviewAfterSubmit: false,
      showExplanationImmediately: false,
      policyVersion: 1,
      capturedAt: '2026-01-02T00:00:00.000Z',
    },
    questions: [{
      id: 'attempt-question-a',
      questionId: 'question-a',
      questionType: 'rewrite',
      questionSnapshot: 'Rewrite this sentence',
      correctAnswerSnapshot: 'She studies.',
      acceptedAnswersSnapshot: ['She studies.'],
      explanationSnapshot: 'Secret explanation',
      scoreSnapshot: 5,
      optionsSnapshot: [],
    }],
    answers: [{
      attemptQuestionId: 'attempt-question-a',
      textAnswer: 'She study.',
      correctAnswer: 'She studies.',
      acceptedAnswers: ['She studies.'],
      explanation: 'Secret explanation',
      isCorrect: false,
      scoreAwarded: 0,
    }],
  };
  const grammarProjection = projectGrammarAttempt(grammarSource);
  const legacyVocabularySource = {
    id: 'vocab-source-a',
    ownerKey: 'guest:guest-a',
    ownerType: 'guest',
    guestId: 'guest-a',
    studentName: 'Guest A',
    vocabSetId: 'vocab-set-a',
    vocabSetTitle: 'Vocabulary A',
    gameId: 'quiz-en-vi',
    gameName: 'Quiz',
    assignmentId: 'assignment-a',
    assignmentVerified: true,
    assignmentTitle: 'Homework A',
    classId: 'class-a',
    className: 'Class A',
    status: 'completed',
    score: 50,
    correctAnswers: 1,
    incorrectAnswers: 1,
    totalQuestions: 2,
    startedAt: '2026-01-01T00:00:00.000Z',
    completedAt: '2026-01-01T00:02:00.000Z',
    answerDetails: [{
      questionText: 'Apple',
      userAnswer: 'Táo',
      correctAnswer: 'Quả táo',
      isCorrect: false,
    }],
  };
  const vocabularyProjection = projectVocabularyAttempt(
    legacyVocabularySource,
    { includeDetail: false },
  );
  const recentActivityAt = new Date().toISOString();
  const staleActivityAt = new Date(Date.now() - 48 * 60 * 60 * 1_000).toISOString();
  const staleProjection = projectVocabularyAttempt({
    id: 'vocab-stale-in-progress',
    ownerKey: 'guest:guest-c',
    ownerType: 'guest',
    guestId: 'guest-c',
    studentName: 'Guest C',
    vocabSetId: 'vocab-set-status',
    vocabSetTitle: 'Status lesson',
    gameId: 'quiz-en-vi',
    status: 'in_progress',
    startedAt: staleActivityAt,
    lastSavedAt: staleActivityAt,
  }, { includeDetail: false });
  const recentProjection = projectVocabularyAttempt({
    id: 'vocab-recent-in-progress',
    ownerKey: 'guest:guest-c',
    ownerType: 'guest',
    guestId: 'guest-c',
    studentName: 'Guest C',
    vocabSetId: 'vocab-set-status',
    vocabSetTitle: 'Status lesson',
    gameId: 'quiz-en-vi',
    status: 'in_progress',
    startedAt: recentActivityAt,
    lastSavedAt: recentActivityAt,
  }, { includeDetail: false });
  staleAttemptId = staleProjection.attempt.attemptId;
  recentAttemptId = recentProjection.attempt.attemptId;
  const authenticatedProjection = projectVocabularyAttempt({
    id: 'vocab-user-a',
    ownerKey: 'user:student-a',
    ownerType: 'user',
    userId: 'student-a',
    studentName: 'Student A',
    vocabSetId: 'vocab-set-user-a',
    vocabSetTitle: 'Authenticated lesson',
    gameId: 'quiz-en-vi',
    status: 'completed',
    score: 100,
    correctAnswers: 1,
    incorrectAnswers: 0,
    totalQuestions: 1,
    startedAt: '2026-01-03T00:00:00.000Z',
    completedAt: '2026-01-03T00:01:00.000Z',
  });

  const batch = db.batch();
  batch.set(db.collection('grammar_attempts').doc(grammarSource.id), grammarSource);
  batch.set(
    db.collection('learning_attempts').doc(grammarProjection.attempt.attemptId),
    grammarProjection.attempt,
  );
  if (grammarProjection.detail) {
    batch.set(
      db.collection('attempt_details').doc(grammarProjection.detail.attemptId),
      grammarProjection.detail,
    );
  }
  batch.set(
    db.collection('game_sessions').doc(legacyVocabularySource.id),
    legacyVocabularySource,
  );
  batch.set(
    db.collection('learning_attempts').doc(vocabularyProjection.attempt.attemptId),
    vocabularyProjection.attempt,
  );
  batch.set(
    db.collection('learning_attempts').doc(staleProjection.attempt.attemptId),
    staleProjection.attempt,
  );
  batch.set(
    db.collection('learning_attempts').doc(recentProjection.attempt.attemptId),
    recentProjection.attempt,
  );
  batch.set(
    db.collection('learning_attempts').doc(authenticatedProjection.attempt.attemptId),
    authenticatedProjection.attempt,
  );
  if (authenticatedProjection.detail) {
    batch.set(
      db.collection('attempt_details').doc(authenticatedProjection.detail.attemptId),
      authenticatedProjection.detail,
    );
  }
  await batch.commit();

  const app = express();
  app.use('/api/my-learning-history', createLearningHistoryRouter({
    enabled: true,
    slowRequestMs: 60_000,
    authenticateOptionalUser: (req, _res, next) => {
      if (req.headers.authorization === `Bearer ${studentAToken}`) {
        (req as any).user = {
          id: 'student-a',
          name: 'Student A',
          role: 'student',
          status: 'active',
        };
      }
      next();
    },
  }));
  app.use('/api/disabled-learning-history', createLearningHistoryRouter({
    enabled: false,
  }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not bind.');
  baseUrl = `http://127.0.0.1:${address.port}`;
  closeServer = () => new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  });
});

after(async () => {
  await closeServer?.();
  await closeSQLiteStorage();
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

test('guest capability scopes list, aggregate, facets, filters and stable pagination', async () => {
  const response = await fetch(
    `${baseUrl}/api/my-learning-history?page=1&pageSize=20&search=%25%27%20OR%201%3D1--`,
    { headers: historyHeaders('guest-a', guestAToken) },
  );
  assert.equal(response.status, 200);
  assert.match(response.headers.get('server-timing') || '', /^history;dur=/);
  const searchBody = await response.json();
  assert.equal(searchBody.items.length, 0);

  const allResponse = await fetch(
    `${baseUrl}/api/my-learning-history?page=1&pageSize=20`,
    { headers: historyHeaders('guest-a', guestAToken) },
  );
  assert.equal(allResponse.status, 200);
  const body = await allResponse.json();
  assert.equal(body.items.length, 2);
  assert.equal(body.items[0].sourceType, 'grammar');
  assert.equal(body.summary.totalAttempts, 2);
  assert.equal(body.summary.completedAttempts, 2);
  assert.equal(body.summary.averageScore, 65);
  assert.equal(body.summary.bestScore, 80);
  assert.equal(body.pagination.totalItems, 2);
  assert.deepEqual(body.filterOptions.classes, [{ id: 'class-a', label: 'Class A' }]);
  assert.equal(body.filterOptions.lessons.length, 2);

  const assignmentResponse = await fetch(
    `${baseUrl}/api/my-learning-history?historyType=assignment&groupByAssignment=true`,
    { headers: historyHeaders('guest-a', guestAToken) },
  );
  const assignmentBody = await assignmentResponse.json();
  assert.equal(assignmentBody.items.length, 1);
  assert.equal(assignmentBody.items[0].assignmentId, 'assignment-a');
  assert.equal(assignmentBody.assignmentGroups.length, 1);
});

test('wrong or missing guest capability cannot read history', async () => {
  const missing = await fetch(`${baseUrl}/api/my-learning-history`, {
    headers: { 'X-Guest-Id': 'guest-a' },
  });
  assert.equal(missing.status, 401);
  const wrong = await fetch(`${baseUrl}/api/my-learning-history`, {
    headers: historyHeaders('guest-a', guestBToken),
  });
  assert.equal(wrong.status, 401);
});

test('detail policy strips answer keys and legacy fallback does not fail', async () => {
  const list = await fetch(`${baseUrl}/api/my-learning-history`, {
    headers: historyHeaders('guest-a', guestAToken),
  }).then(response => response.json());
  const grammar = list.items.find((item: any) => item.sourceType === 'grammar');
  const grammarResponse = await fetch(
    `${baseUrl}/api/my-learning-history/${encodeURIComponent(grammar.attemptId)}`,
    { headers: historyHeaders('guest-a', guestAToken) },
  );
  assert.equal(grammarResponse.status, 200);
  const grammarDetail = await grammarResponse.json();
  const answer = grammarDetail.detail.answerDetails[0];
  assert.equal(answer.textAnswer, 'She study.');
  assert.equal('correctAnswer' in answer, false);
  assert.equal('acceptedAnswers' in answer, false);
  assert.equal('explanation' in answer, false);

  const vocabulary = list.items.find((item: any) => item.sourceType === 'vocabulary');
  const vocabularyResponse = await fetch(
    `${baseUrl}/api/my-learning-history/${encodeURIComponent(vocabulary.attemptId)}`,
    { headers: historyHeaders('guest-a', guestAToken) },
  );
  assert.equal(vocabularyResponse.status, 200);
  const vocabularyDetail = await vocabularyResponse.json();
  assert.equal(vocabularyDetail.detailStatus, 'available');
  assert.equal(vocabularyDetail.detail.warnings.includes('legacy_fallback'), true);
  assert.equal('correctAnswer' in vocabularyDetail.detail.answerDetails[0], false);
});

test('valid capability for another guest receives 404 for cross-owner attempt', async () => {
  const list = await fetch(`${baseUrl}/api/my-learning-history`, {
    headers: historyHeaders('guest-a', guestAToken),
  }).then(response => response.json());
  const response = await fetch(
    `${baseUrl}/api/my-learning-history/${encodeURIComponent(list.items[0].attemptId)}`,
    { headers: historyHeaders('guest-b', guestBToken) },
  );
  assert.equal(response.status, 404);
});

test('authenticated actor ignores spoofed guest headers and reads only its owner key', async () => {
  const response = await fetch(`${baseUrl}/api/my-learning-history`, {
    headers: {
      Authorization: `Bearer ${studentAToken}`,
      ...historyHeaders('guest-a', guestAToken),
    },
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.items.length, 1);
  assert.equal(body.items[0].lessonId, 'vocab-set-user-a');
  assert.equal(body.summary.totalAttempts, 1);
});

test('stale in-progress attempts are displayed and filtered as interrupted without writes', async () => {
  const interruptedResponse = await fetch(
    `${baseUrl}/api/my-learning-history?status=interrupted`,
    { headers: historyHeaders('guest-c', guestCToken) },
  );
  assert.equal(interruptedResponse.status, 200);
  const interrupted = await interruptedResponse.json();
  assert.equal(interrupted.items.length, 1);
  assert.equal(interrupted.items[0].status, 'interrupted');
  assert.equal(interrupted.items[0].attemptId, staleAttemptId);

  const activeResponse = await fetch(
    `${baseUrl}/api/my-learning-history?status=in_progress`,
    { headers: historyHeaders('guest-c', guestCToken) },
  );
  assert.equal(activeResponse.status, 200);
  const active = await activeResponse.json();
  assert.equal(active.items.length, 1);
  assert.equal(active.items[0].status, 'in_progress');
  assert.equal(active.items[0].attemptId, recentAttemptId);
});

test('legacy guest requires staff recovery and disabled flag returns 404', async () => {
  const recovery = await fetch(`${baseUrl}/api/my-learning-history`, {
    headers: historyHeaders('guest-legacy', guestAToken),
  });
  assert.equal(recovery.status, 403);
  assert.equal((await recovery.json()).code, 'GUEST_HISTORY_RECOVERY_REQUIRED');

  const disabled = await fetch(`${baseUrl}/api/disabled-learning-history`);
  assert.equal(disabled.status, 404);
  assert.equal((await disabled.json()).code, 'LEARNING_HISTORY_DISABLED');
});
