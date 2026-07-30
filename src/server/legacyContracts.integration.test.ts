import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { after, before, test } from 'node:test';

const projectRoot = process.cwd();
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'vhomework-legacy-contracts-'));
const databasePath = path.join(temporaryDirectory, 'app.sqlite');
const audioDirectory = path.join(temporaryDirectory, 'audio');
const publicIdentitySecret = 'legacy-contract-public-identity-secret';
const firebaseProjectId = 'demo-vhomework-contracts';
const now = Date.now();
const minute = 60 * 1000;
const day = 24 * 60 * minute;

const timestamps = {
  studentGame: new Date(now - minute).toISOString(),
  studentGrammar: new Date(now - 2 * minute).toISOString(),
  guestGame: new Date(now - 3 * minute).toISOString(),
  otherStudentGame: new Date(now - 4 * minute).toISOString(),
  inProgress: new Date(now - 5 * minute).toISOString(),
  oldGame: new Date(now - 8 * day).toISOString(),
  futureExpiry: new Date(now + 90 * day).toISOString(),
};

let authServer: http.Server | null = null;
let authPort = 0;
let applicationPort = 0;
let applicationProcess: ChildProcessWithoutNullStreams | null = null;
let applicationOutput = '';

function sortedKeys(value: Record<string, unknown>) {
  return Object.keys(value).sort();
}

function assertExactKeys(
  value: Record<string, unknown>,
  expected: string[],
  contractName: string,
) {
  assert.deepEqual(sortedKeys(value), [...expected].sort(), `${contractName} response keys changed`);
}

function base64UrlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function authToken(userId: string, email: string) {
  const issuedAt = Math.floor(Date.now() / 1000);
  return [
    base64UrlJson({ alg: 'none', typ: 'JWT' }),
    base64UrlJson({
      aud: firebaseProjectId,
      iss: `https://securetoken.google.com/${firebaseProjectId}`,
      sub: userId,
      user_id: userId,
      email,
      email_verified: true,
      iat: issuedAt - 10,
      exp: issuedAt + 60 * 60,
      auth_time: issuedAt - 10,
      firebase: { sign_in_provider: 'custom' },
    }),
    '',
  ].join('.');
}

async function availablePort() {
  const server = net.createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  assert(address && typeof address === 'object');
  const port = address.port;
  await new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  });
  return port;
}

async function listen(server: http.Server, port: number) {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve());
  });
}

async function closeServer(server: http.Server | null) {
  if (!server?.listening) return;
  await new Promise<void>(resolve => server.close(() => resolve()));
}

function startAuthEmulator() {
  const accountById: Record<string, { email: string; displayName: string }> = {
    'teacher-1': {
      email: 'teacher@example.test',
      displayName: 'Teacher One',
    },
    'student-1': {
      email: 'student@example.test',
      displayName: 'Student One',
    },
    'student-2': {
      email: 'other@example.test',
      displayName: 'Student Two',
    },
  };

  return http.createServer((request, response) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', chunk => {
      body += chunk;
    });
    request.on('end', () => {
      if (
        request.method !== 'POST'
        || request.url !== `/identitytoolkit.googleapis.com/v1/projects/${firebaseProjectId}/accounts:lookup`
      ) {
        response.writeHead(404, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ error: { message: 'NOT_FOUND' } }));
        return;
      }

      const localIds = JSON.parse(body || '{}').localId || [];
      const users = localIds.flatMap((localId: string) => {
        const account = accountById[localId];
        if (!account) return [];
        return [{
          localId,
          email: account.email,
          emailVerified: true,
          displayName: account.displayName,
          validSince: '0',
          lastLoginAt: String(Date.now()),
          createdAt: String(Date.now() - day),
          customAttributes: '{}',
          providerUserInfo: [],
        }];
      });
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ users }));
    });
  });
}

async function seedDatabase() {
  process.env.STORAGE_MODE = 'sqlite';
  process.env.SQLITE_DRIVER = 'better-sqlite3';
  process.env.SQLITE_DB_PATH = databasePath;
  process.env.SQLITE_ALLOW_CREATE = 'true';
  process.env.SQLITE_ALLOW_JSON_IMPORT = 'false';
  process.env.SQLITE_BUSY_TIMEOUT_MS = '2000';
  process.env.SQLITE_WAL_AUTOCHECKPOINT_PAGES = '50';
  process.env.SQLITE_SYNCHRONOUS = 'NORMAL';
  process.env.NODE_ENV = 'test';

  const {
    closeSQLiteStorage,
    initializeSQLiteStorage,
    SQLiteFirestore,
  } = await import('../lib/sqliteStorage.js');
  await initializeSQLiteStorage();
  const db = new SQLiteFirestore();

  const users = [
    {
      id: 'teacher-1',
      name: 'Teacher One',
      email: 'teacher@example.test',
      role: 'teacher',
      status: 'active',
      createdAt: new Date(now - day).toISOString(),
    },
    {
      id: 'student-1',
      name: 'Canonical Student One',
      email: 'student@example.test',
      role: 'student',
      status: 'active',
      createdAt: new Date(now - day).toISOString(),
    },
    {
      id: 'student-2',
      name: 'Canonical Student Two',
      email: 'other@example.test',
      role: 'student',
      status: 'active',
      createdAt: new Date(now - day).toISOString(),
    },
  ];
  for (const user of users) {
    await db.collection('users').doc(user.id).set(user);
  }

  await db.collection('guest_profiles').doc('guest-1').set({
    id: 'guest-1',
    displayName: 'Canonical Guest',
    normalizedName: 'canonical guest',
    status: 'active',
    createdAt: new Date(now - day).toISOString(),
    updatedAt: timestamps.guestGame,
    lastActiveAt: timestamps.guestGame,
  });

  await db.collection('vocab_sets').doc('vocab-1').set({
    id: 'vocab-1',
    title: 'Legacy Vocabulary',
    description: 'Golden vocabulary fixture',
    subject: 'English',
    gradeLevel: 'Grade 6',
    visibility: 'public',
    status: 'public',
    createdBy: 'teacher-1',
    creatorName: 'Teacher One',
    createdAt: new Date(now - day).toISOString(),
    updatedAt: new Date(now - day).toISOString(),
    items: [{
      id: 'vocab-item-1',
      term: 'hello',
      meaning: 'xin chao',
      displayOrder: 0,
    }],
  });

  const grammarQuestion = {
    id: 'grammar-question-1',
    questionType: 'multiple_choice',
    questionText: 'Choose A',
    explanation: 'Set-level explanation',
    correctOptionId: 'option-a',
    score: 1,
    position: 0,
    options: [
      { id: 'option-a', text: 'A', originalPosition: 0 },
      { id: 'option-b', text: 'B', originalPosition: 1 },
    ],
  };
  await db.collection('grammar_sets').doc('grammar-1').set({
    id: 'grammar-1',
    title: 'Legacy Grammar',
    description: 'Golden grammar fixture',
    visibility: 'public',
    status: 'published',
    questionType: 'multiple_choice',
    showReviewAfterSubmit: false,
    createdBy: 'teacher-1',
    creatorName: 'Teacher One',
    createdAt: new Date(now - day).toISOString(),
    updatedAt: new Date(now - day).toISOString(),
    questions: [grammarQuestion],
  });

  const completedGame = (
    id: string,
    completedAt: string,
    owner: {
      userId?: string;
      guestId?: string;
      ownerKey: string;
      ownerType: 'user' | 'guest';
      studentName: string;
    },
    score: number,
  ) => ({
    id,
    assignmentId: '',
    classId: 'grade:grade-6',
    className: 'Grade 6',
    vocabSetId: 'vocab-1',
    vocabSetTitle: 'Legacy Vocabulary',
    gameId: 'quiz-en-vi',
    gameName: 'Quiz',
    gameType: 'quiz',
    ownerKey: owner.ownerKey,
    ownerType: owner.ownerType,
    userId: owner.userId || '',
    studentId: owner.userId || owner.guestId || '',
    guestId: owner.guestId || '',
    studentName: owner.studentName,
    status: 'completed',
    startedAt: new Date(new Date(completedAt).getTime() - minute).toISOString(),
    endedAt: completedAt,
    completedAt,
    createdAt: new Date(new Date(completedAt).getTime() - minute).toISOString(),
    lastSavedAt: completedAt,
    durationMs: minute,
    durationSeconds: 60,
    score,
    rawScore: score,
    maxScore: 10,
    totalQuestions: 10,
    correctAnswers: Math.round(score / 10),
    incorrectAnswers: 10 - Math.round(score / 10),
    accuracy: score,
    expiresAt: timestamps.futureExpiry,
  });

  const gameFixtures = [
    completedGame('game-student', timestamps.studentGame, {
      userId: 'student-1',
      ownerKey: 'user:student-1',
      ownerType: 'user',
      studentName: 'Stale Student Alias',
    }, 90),
    completedGame('game-guest', timestamps.guestGame, {
      guestId: 'guest-1',
      ownerKey: 'guest:guest-1',
      ownerType: 'guest',
      studentName: 'Stale Guest Alias',
    }, 80),
    completedGame('game-other', timestamps.otherStudentGame, {
      userId: 'student-2',
      ownerKey: 'user:student-2',
      ownerType: 'user',
      studentName: 'Stale Other Alias',
    }, 70),
    completedGame('game-old', timestamps.oldGame, {
      userId: 'student-1',
      ownerKey: 'user:student-1',
      ownerType: 'user',
      studentName: 'Stale Student Alias',
    }, 60),
    {
      ...completedGame('game-in-progress', timestamps.inProgress, {
        userId: 'student-1',
        ownerKey: 'user:student-1',
        ownerType: 'user',
        studentName: 'Stale Student Alias',
      }, 0),
      status: 'in_progress',
      completedAt: null,
      endedAt: null,
      sessionTokenHash: 'must-not-leak-from-admin-vocab-results',
      privateSnapshot: { correctAnswer: 'must-not-leak' },
    },
  ];
  for (const game of gameFixtures) {
    await db.collection('game_sessions').doc(game.id).set(game);
  }

  const attemptQuestion = {
    id: 'attempt-question-1',
    questionId: grammarQuestion.id,
    questionType: 'multiple_choice',
    displayPosition: 0,
    questionSnapshot: grammarQuestion.questionText,
    scoreSnapshot: 1,
    optionsSnapshot: grammarQuestion.options,
    explanationSnapshot: 'Attempt-level secret explanation',
    correctOptionId: 'option-a',
    correctAnswerSnapshot: 'A',
  };
  const attemptAnswer = {
    id: 'attempt-answer-1',
    attemptQuestionId: attemptQuestion.id,
    questionId: grammarQuestion.id,
    selectedOptionId: 'option-a',
    textAnswer: '',
    answeredAt: timestamps.studentGrammar,
    correctOptionId: 'option-a',
    correctAnswer: 'A',
    isCorrect: true,
    scoreAwarded: 1,
  };
  const grammarAttempts = [
    {
      id: 'grammar-student',
      grammarSetId: 'grammar-1',
      grammarSetTitle: 'Legacy Grammar',
      userId: 'student-1',
      studentId: 'student-1',
      guestId: '',
      ownerKey: 'user:student-1',
      studentName: 'Stale Student Alias',
      status: 'completed',
      submissionStatus: 'completed',
      score: 1,
      maxScore: 1,
      correctCount: 1,
      wrongCount: 0,
      unansweredCount: 0,
      durationSeconds: 45,
      createdAt: new Date(new Date(timestamps.studentGrammar).getTime() - minute).toISOString(),
      startedAt: new Date(new Date(timestamps.studentGrammar).getTime() - minute).toISOString(),
      completedAt: timestamps.studentGrammar,
      updatedAt: timestamps.studentGrammar,
      attemptTokenHash: 'must-not-leak-to-student',
      sessionTokenHash: 'must-not-leak-to-student',
      questions: [attemptQuestion],
      answers: [attemptAnswer],
    },
    {
      id: 'grammar-other',
      grammarSetId: 'grammar-1',
      grammarSetTitle: 'Legacy Grammar',
      userId: 'student-2',
      studentId: 'student-2',
      guestId: '',
      ownerKey: 'user:student-2',
      studentName: 'Stale Other Alias',
      status: 'completed',
      submissionStatus: 'completed',
      score: 0,
      maxScore: 1,
      correctCount: 0,
      wrongCount: 1,
      unansweredCount: 0,
      durationSeconds: 50,
      createdAt: new Date(new Date(timestamps.otherStudentGame).getTime() - minute).toISOString(),
      startedAt: new Date(new Date(timestamps.otherStudentGame).getTime() - minute).toISOString(),
      completedAt: timestamps.otherStudentGame,
      updatedAt: timestamps.otherStudentGame,
      questions: [attemptQuestion],
      answers: [{ ...attemptAnswer, id: 'attempt-answer-2', selectedOptionId: 'option-b', isCorrect: false, scoreAwarded: 0 }],
    },
  ];
  for (const attempt of grammarAttempts) {
    await db.collection('grammar_attempts').doc(attempt.id).set(attempt);
  }

  await closeSQLiteStorage();
}

async function startApplication() {
  const tsxCli = path.join(projectRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs');
  applicationProcess = spawn(process.execPath, [tsxCli, 'server.ts'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(applicationPort),
      STORAGE_MODE: 'sqlite',
      SQLITE_DRIVER: 'better-sqlite3',
      SQLITE_DB_PATH: databasePath,
      SQLITE_ALLOW_CREATE: 'false',
      SQLITE_ALLOW_JSON_IMPORT: 'false',
      SQLITE_BUSY_TIMEOUT_MS: '2000',
      SQLITE_WAL_AUTOCHECKPOINT_PAGES: '50',
      SQLITE_SYNCHRONOUS: 'NORMAL',
      SEED_DATA_ENABLED: 'false',
      LEARNING_HISTORY_ENABLED: 'false',
      RECENT_ACTIVITY_DAYS: '7',
      TTS_AUDIO_DIR: audioDirectory,
      GUEST_PUBLIC_ID_SECRET: publicIdentitySecret,
      FIREBASE_PROJECT_ID: firebaseProjectId,
      FIREBASE_AUTH_EMULATOR_HOST: `127.0.0.1:${authPort}`,
      SLOW_API_LOG_MS: '0',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  applicationProcess.stdout.on('data', chunk => {
    applicationOutput += chunk.toString();
  });
  applicationProcess.stderr.on('data', chunk => {
    applicationOutput += chunk.toString();
  });

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Server startup timed out.\n${applicationOutput}`));
    }, 20_000);
    const poll = setInterval(async () => {
      try {
        const response = await fetch(`http://127.0.0.1:${applicationPort}/`);
        if (response.ok) {
          clearInterval(poll);
          clearTimeout(timeout);
          resolve();
        }
      } catch {
        // Server has not bound the port yet.
      }
    }, 100);
    applicationProcess?.once('exit', code => {
      clearInterval(poll);
      clearTimeout(timeout);
      reject(new Error(`Server exited during startup (${code}).\n${applicationOutput}`));
    });
  });
}

async function stopApplication() {
  const child = applicationProcess;
  applicationProcess = null;
  if (!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([
    new Promise<void>(resolve => child.once('exit', () => resolve())),
    new Promise<void>(resolve => setTimeout(() => {
      if (child.exitCode === null) child.kill();
      resolve();
    }, 5_000)),
  ]);
}

async function apiRequest(route: string, token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(`http://127.0.0.1:${applicationPort}${route}`, { headers });
  const text = await response.text();
  return {
    status: response.status,
    body: text ? JSON.parse(text) : null,
  };
}

before(async () => {
  authPort = await availablePort();
  applicationPort = await availablePort();
  authServer = startAuthEmulator();
  await listen(authServer, authPort);
  await seedDatabase();
  await startApplication();
}, { timeout: 30_000 });

after(async () => {
  await stopApplication();
  await closeServer(authServer);
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}, { timeout: 10_000 });

test('public result contracts preserve seven-day filtering, ordering, shape, and pseudonymous identity', async () => {
  const resultResponse = await apiRequest('/api/public/results');
  assert.equal(resultResponse.status, 200);
  assert(Array.isArray(resultResponse.body));
  assert.deepEqual(
    resultResponse.body.map((item: any) => item.id),
    ['game-student', 'grammar-grammar-student', 'game-guest', 'game-other', 'grammar-grammar-other'],
  );
  assert.equal(resultResponse.body.some((item: any) => item.id === 'game-old'), false);
  assert.equal(resultResponse.body.some((item: any) => item.id === 'game-in-progress'), false);

  const vocabulary = resultResponse.body.find((item: any) => item.id === 'game-guest');
  assertExactKeys(vocabulary, [
    'accuracy',
    'assignmentId',
    'classId',
    'className',
    'completedAt',
    'correctAnswers',
    'createdAt',
    'durationMs',
    'durationSeconds',
    'endedAt',
    'expiresAt',
    'gameId',
    'id',
    'incorrectAnswers',
    'publicStudentKey',
    'score',
    'startedAt',
    'studentKey',
    'studentName',
    'totalQuestions',
    'vocabSetId',
    'vocabSetTitle',
  ], '/api/public/results vocabulary item');
  assert.equal(vocabulary.studentName, 'Canonical Guest');
  assert.match(vocabulary.publicStudentKey, /^student-[a-f0-9]{24}$/);
  assert.equal(vocabulary.studentKey, vocabulary.publicStudentKey);
  for (const forbidden of ['ownerKey', 'userId', 'studentId', 'guestId']) {
    assert.equal(forbidden in vocabulary, false, `${forbidden} must not be public`);
  }
  const expectedGuestKey = `student-${crypto
    .createHmac('sha256', publicIdentitySecret)
    .update('guest:guest-1')
    .digest('hex')
    .slice(0, 24)}`;
  assert.equal(vocabulary.publicStudentKey, expectedGuestKey);

  const grammar = resultResponse.body.find((item: any) => item.id === 'grammar-grammar-student');
  assertExactKeys(grammar, [
    'accuracy',
    'assignmentId',
    'classId',
    'className',
    'completedAt',
    'correctAnswers',
    'createdAt',
    'durationMs',
    'durationSeconds',
    'endedAt',
    'gameId',
    'gameName',
    'gameType',
    'id',
    'incorrectAnswers',
    'maxScore',
    'publicStudentKey',
    'rawScore',
    'score',
    'sourceType',
    'startedAt',
    'studentKey',
    'studentName',
    'totalQuestions',
    'vocabSetId',
    'vocabSetTitle',
  ], '/api/public/results grammar item');
  assert.equal('answerDetails' in grammar, false);

  const leaderboardResponse = await apiRequest('/api/public/leaderboard-results');
  assert.equal(leaderboardResponse.status, 200);
  assert(Array.isArray(leaderboardResponse.body));
  const leaderboardItem = leaderboardResponse.body.find((item: any) => item.sourceId === 'game-guest');
  assert(leaderboardItem);
  assertExactKeys(leaderboardItem, [
    'accuracy',
    'assignmentId',
    'classId',
    'className',
    'completedAt',
    'correctAnswers',
    'createdAt',
    'durationMs',
    'durationSeconds',
    'endedAt',
    'expiresAt',
    'gameId',
    'gameName',
    'gameType',
    'grammarSetId',
    'id',
    'incorrectAnswers',
    'maxScore',
    'ownerType',
    'publicStudentKey',
    'rawScore',
    'score',
    'sourceId',
    'sourceType',
    'startedAt',
    'status',
    'studentKey',
    'studentName',
    'totalQuestions',
    'vocabSetId',
    'vocabSetTitle',
  ], '/api/public/leaderboard-results item');
  for (const forbidden of ['ownerKey', 'userId', 'studentId', 'guestId']) {
    assert.equal(forbidden in leaderboardItem, false, `${forbidden} must not be public`);
  }
});

test('authenticated result and leaderboard contracts enforce auth and owner/teacher scope', async () => {
  const unauthenticated = await apiRequest('/api/results');
  assert.equal(unauthenticated.status, 401);
  assertExactKeys(unauthenticated.body, ['error'], '/api/results unauthorized error');

  const teacherToken = authToken('teacher-1', 'teacher@example.test');
  const teacherResults = await apiRequest('/api/results', teacherToken);
  assert.equal(teacherResults.status, 200);
  assert.deepEqual(
    teacherResults.body.map((item: any) => item.id),
    ['game-student', 'grammar-grammar-student', 'game-guest', 'game-other', 'grammar-grammar-other'],
  );
  const teacherGame = teacherResults.body.find((item: any) => item.id === 'game-student');
  assertExactKeys(teacherGame, [
    'accuracy',
    'assignmentId',
    'classId',
    'className',
    'completedAt',
    'correctAnswers',
    'createdAt',
    'durationMs',
    'durationSeconds',
    'endedAt',
    'expiresAt',
    'gameId',
    'gameName',
    'gameType',
    'guestId',
    'id',
    'incorrectAnswers',
    'lastSavedAt',
    'maxScore',
    'ownerKey',
    'ownerType',
    'rawScore',
    'score',
    'startedAt',
    'status',
    'studentId',
    'studentName',
    'totalQuestions',
    'userId',
    'vocabSetId',
    'vocabSetTitle',
  ], '/api/results vocabulary item');
  assert.equal(teacherGame.studentName, 'Canonical Student One');

  const studentToken = authToken('student-1', 'student@example.test');
  const studentResults = await apiRequest('/api/results', studentToken);
  assert.equal(studentResults.status, 200);
  assert.deepEqual(
    studentResults.body.map((item: any) => item.id),
    ['game-student', 'grammar-grammar-student'],
  );

  const teacherLeaderboard = await apiRequest('/api/leaderboard-results', teacherToken);
  assert.equal(teacherLeaderboard.status, 200);
  assert(teacherLeaderboard.body.some((item: any) => item.sourceId === 'game-guest'));
  assert(teacherLeaderboard.body.some((item: any) => item.sourceId === 'grammar-other'));
  const studentLeaderboard = await apiRequest('/api/leaderboard-results', studentToken);
  assert.equal(studentLeaderboard.status, 200);
  assert.deepEqual(
    studentLeaderboard.body.map((item: any) => item.sourceId),
    ['game-student', 'grammar-student', 'game-old'],
  );
  assertExactKeys(studentLeaderboard.body[0], [
    'accuracy',
    'assignmentId',
    'classId',
    'className',
    'completedAt',
    'correctAnswers',
    'createdAt',
    'durationMs',
    'durationSeconds',
    'endedAt',
    'expiresAt',
    'gameId',
    'gameName',
    'gameType',
    'grammarSetId',
    'guestId',
    'id',
    'incorrectAnswers',
    'maxScore',
    'ownerKey',
    'ownerType',
    'rawScore',
    'score',
    'sourceId',
    'sourceType',
    'startedAt',
    'status',
    'studentId',
    'studentName',
    'totalQuestions',
    'userId',
    'vocabSetId',
    'vocabSetTitle',
  ], '/api/leaderboard-results item');
});

test('admin vocab and grammar result contracts enforce role/ownership and preserve response shape', async () => {
  const teacherToken = authToken('teacher-1', 'teacher@example.test');
  const studentToken = authToken('student-1', 'student@example.test');

  const deniedVocab = await apiRequest('/api/admin/vocab-sets/vocab-1/results', studentToken);
  assert.equal(deniedVocab.status, 403);
  const vocab = await apiRequest('/api/admin/vocab-sets/vocab-1/results', teacherToken);
  assert.equal(vocab.status, 200);
  assertExactKeys(vocab.body, ['sessions', 'set'], '/api/admin/vocab-sets/:id/results');
  assert.equal(vocab.body.set.id, 'vocab-1');
  assert.deepEqual(
    vocab.body.sessions.map((session: any) => session.id),
    ['game-student', 'game-guest', 'game-other', 'game-in-progress', 'game-old'],
  );
  const inProgress = vocab.body.sessions.find((session: any) => session.id === 'game-in-progress');
  assert.equal(inProgress.displayStatus, 'in_progress');
  assert.equal('sessionTokenHash' in inProgress, false);
  assert.equal('privateSnapshot' in inProgress, false);

  const deniedGrammar = await apiRequest('/api/admin/grammar-sets/grammar-1/results', studentToken);
  assert.equal(deniedGrammar.status, 403);
  const grammar = await apiRequest('/api/admin/grammar-sets/grammar-1/results', teacherToken);
  assert.equal(grammar.status, 200);
  assertExactKeys(grammar.body, ['attempts', 'set'], '/api/admin/grammar-sets/:id/results');
  assert.equal(grammar.body.set.id, 'grammar-1');
  assert.deepEqual(
    grammar.body.attempts.map((attempt: any) => attempt.id),
    ['grammar-student', 'grammar-other'],
  );
  assert.equal(grammar.body.attempts[0].studentName, 'Canonical Student One');
  assert.equal(grammar.body.attempts[1].studentName, 'Canonical Student Two');
});

test('grammar review and my-attempts contracts keep ownership and answer-review policy intact', async () => {
  const studentToken = authToken('student-1', 'student@example.test');
  const otherToken = authToken('student-2', 'other@example.test');
  const teacherToken = authToken('teacher-1', 'teacher@example.test');

  const history = await apiRequest('/api/grammar-sets/grammar-1/my-attempts', studentToken);
  assert.equal(history.status, 200);
  assert.deepEqual(history.body.map((attempt: any) => attempt.id), ['grammar-student']);
  const studentAttempt = history.body[0];
  assertExactKeys(studentAttempt, [
    'answers',
    'completedAt',
    'correctCount',
    'createdAt',
    'durationSeconds',
    'grammarSetId',
    'grammarSetTitle',
    'guestId',
    'id',
    'maxScore',
    'ownerKey',
    'questions',
    'score',
    'startedAt',
    'status',
    'studentId',
    'studentName',
    'submissionStatus',
    'unansweredCount',
    'updatedAt',
    'userId',
    'wrongCount',
  ], '/api/grammar-sets/:id/my-attempts item');
  assert.equal('attemptTokenHash' in studentAttempt, false);
  assert.equal('sessionTokenHash' in studentAttempt, false);
  assert.equal('correctOptionId' in studentAttempt.questions[0], false);
  assert.equal('correctAnswerSnapshot' in studentAttempt.questions[0], false);
  assert.equal('explanationSnapshot' in studentAttempt.questions[0], false);
  assert.equal('isCorrect' in studentAttempt.answers[0], false);
  assert.equal('scoreAwarded' in studentAttempt.answers[0], false);

  const studentReview = await apiRequest('/api/grammar-attempts/grammar-student/review', studentToken);
  assert.equal(studentReview.status, 200);
  assert.deepEqual(studentReview.body, studentAttempt);

  const crossOwnerReview = await apiRequest('/api/grammar-attempts/grammar-student/review', otherToken);
  assert.equal(crossOwnerReview.status, 403);

  const staffReview = await apiRequest('/api/grammar-attempts/grammar-student/review', teacherToken);
  assert.equal(staffReview.status, 200);
  assert.equal(staffReview.body.questions[0].correctOptionId, 'option-a');
  assert.equal(staffReview.body.questions[0].correctAnswerSnapshot, 'A');
  assert.equal(staffReview.body.questions[0].explanationSnapshot, 'Attempt-level secret explanation');
  assert.equal(staffReview.body.answers[0].isCorrect, true);
  assert.equal(staffReview.body.answers[0].scoreAwarded, 1);
  assert.equal('attemptTokenHash' in staffReview.body, false);
  assert.equal('sessionTokenHash' in staffReview.body, false);
});
