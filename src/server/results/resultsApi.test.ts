import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildLeaderboard } from '../../lib/leaderboard';
import { createResultsService } from './service';

const serverSource = readFileSync(new URL('../../../server.ts', import.meta.url), 'utf8');
const routerSource = readFileSync(new URL('./router.ts', import.meta.url), 'utf8');
const serviceSource = readFileSync(new URL('./service.ts', import.meta.url), 'utf8');
const repositorySource = readFileSync(new URL('./repository.ts', import.meta.url), 'utf8');

const serviceDefaults = {
  activityTtlMs: 1,
  maxResultLimit: 100,
  safeText: (value: any, maxLength: number) => String(value || '').slice(0, maxLength),
  sanitizePublicStudentRecord: (event: any) => event,
  getCachedLeaderboardSummary: () => undefined,
  cacheLeaderboardSummary: () => undefined,
};

test('public and authenticated result URLs are mounted through one results router', () => {
  assert.match(serverSource, /createResultsRouter/);
  assert.doesNotMatch(serverSource, /app\.get\("\/api\/(?:public\/results|public\/leaderboard|results|leaderboard-results)/);
  for (const route of [
    "router.get('/public/results'", "router.get('/public/leaderboard-results'",
    "router.get('/public/leaderboard-summary'", "router.get('/learning/leaderboard-summary'",
    "router.get('/admin/leaderboard-summary'", "router.get('/results/:sourceType/:resultId'",
    "router.get('/results'", "router.get('/leaderboard-results'",
  ]) assert.ok(routerSource.includes(route), `missing route ${route}`);
  assert.ok((routerSource.match(/options\.authenticateUser/g) || []).length >= 4);
  assert.match(routerSource, /options\.requireStaff/);
});

test('result shaping and authorization remain in the service while persistence reads stay in the repository', () => {
  assert.match(serviceSource, /canViewResultSession/);
  assert.match(serviceSource, /canViewGrammarActivity/);
  assert.match(serviceSource, /sanitizePublicStudentRecord/);
  assert.match(serviceSource, /LEADERBOARD_NOT_READY/);
  assert.match(repositorySource, /where\('completedAt', '>=', cutoff\)/);
  assert.match(repositorySource, /Promise\.all/);
});

test('production leaderboard summary fails closed when the projection is not ready', async () => {
  const calls: string[] = [];
  const marks: string[] = [];
  const service = createResultsService({
    ...serviceDefaults,
    repository: {
      loadReadyLeaderboardEvents: async () => {
        calls.push('ready');
        return null;
      },
      loadLeaderboardEvents: async () => {
        calls.push('legacy');
        return [];
      },
    },
    buildLeaderboard: () => ({ gold: [], diligent: [], accurate: [], improved: [] }),
    allowLegacyLeaderboardFallback: false,
    nowMs: () => Date.parse('2026-09-24T12:00:00.000Z'),
  } as any);

  await assert.rejects(
    () => service.getPublicLeaderboardSummary(
      { query: { period: 'week', limit: '8' } },
      { mark: (label: string) => marks.push(label) },
    ),
    (error: any) => error?.status === 503 && error?.code === 'LEADERBOARD_NOT_READY',
  );
  assert.deepEqual(calls, ['ready']);
  assert.ok(!marks.includes('read_model_fallback'));
});

test('explicit development compatibility may use the read-only legacy fallback', async () => {
  const calls: string[] = [];
  const service = createResultsService({
    ...serviceDefaults,
    repository: {
      loadReadyLeaderboardEvents: async () => null,
      loadLeaderboardEvents: async () => {
        calls.push('legacy');
        return [{ studentName: 'Student A', publicStudentKey: 'public-a', completedAt: '2026-09-24T00:00:00.000Z' }];
      },
    },
    buildLeaderboard: (events: any[]) => ({ gold: events, diligent: [], accurate: [], improved: [] }),
    allowLegacyLeaderboardFallback: true,
  } as any);

  const response = await service.getPublicLeaderboardSummary({ query: {} });
  assert.deepEqual(calls, ['legacy']);
  assert.equal(response.body.entries.length, 1);
});

test('public leaderboard DTO is anonymous, allow-listed and bounded', async () => {
  const rawEntry = {
    studentName: 'Private Student Name',
    studentKey: 'private-key',
    publicStudentKey: 'public-key',
    userId: 'user-1',
    guestId: 'guest-1',
    classId: 'class-1',
    className: 'Class 1',
    completedAt: '2026-09-24T00:00:00.000Z',
    completedLessons: 3,
    correctAnswers: 27,
    incorrectAnswers: 3,
    totalQuestions: 30,
    averageAccuracy: 90,
    studyDays: 3,
    honorScore: 500,
    improvementPoints: 20,
    badges: ['Diligent'],
    isNewcomer: false,
  };
  const service = createResultsService({
    ...serviceDefaults,
    repository: { loadReadyLeaderboardEvents: async () => [rawEntry] },
    buildLeaderboard: () => ({ gold: [rawEntry], diligent: [], accurate: [], improved: [] }),
    allowLegacyLeaderboardFallback: false,
  } as any);

  const response = await service.getPublicLeaderboardSummary({ query: { limit: '999' } });
  assert.equal(response.body.entries.length, 1);
  assert.equal(response.body.entries[0].studentName, 'Học viên #1');
  assert.deepEqual(Object.keys(response.body.entries[0]).sort(), [
    'averageAccuracy', 'badges', 'completedLessons', 'honorScore', 'rank',
    'studentName', 'studyDays',
  ].sort());
  assert.equal('classes' in response.body, false);
  assert.ok(Buffer.byteLength(JSON.stringify(response.body), 'utf8') < 32 * 1024);
  assert.equal(response.headers['Cache-Control'], 'public, max-age=30');
});

test('server summary preserves legacy leaderboard order and score semantics', async () => {
  const now = Date.parse('2026-09-24T12:00:00.000Z');
  const events = [
    { id: 'a-old', publicStudentKey: 'a', studentName: 'An', vocabSetId: 'set-1', gameId: 'quiz', completedAt: '2026-09-22T01:00:00.000Z', score: 80, totalQuestions: 10, correctAnswers: 8, incorrectAnswers: 2 },
    { id: 'a-best', publicStudentKey: 'a', studentName: 'An', vocabSetId: 'set-1', gameId: 'quiz', completedAt: '2026-09-23T01:00:00.000Z', score: 90, totalQuestions: 10, correctAnswers: 9, incorrectAnswers: 1 },
    { id: 'a-second', publicStudentKey: 'a', studentName: 'An', vocabSetId: 'set-2', gameId: 'match', completedAt: '2026-09-24T01:00:00.000Z', score: 100, totalQuestions: 10, correctAnswers: 10, incorrectAnswers: 0 },
    { id: 'b', publicStudentKey: 'b', studentName: 'Binh', vocabSetId: 'set-1', gameId: 'quiz', completedAt: '2026-09-24T02:00:00.000Z', score: 100, totalQuestions: 10, correctAnswers: 10, incorrectAnswers: 0 },
    { id: 'previous', publicStudentKey: 'a', studentName: 'An', vocabSetId: 'old', gameId: 'quiz', completedAt: '2026-09-01T02:00:00.000Z', score: 20, totalQuestions: 10, correctAnswers: 2, incorrectAnswers: 8 },
  ];
  const expected = buildLeaderboard(events as any, [], { period: 'week', now });
  const service = createResultsService({
    ...serviceDefaults,
    repository: { loadReadyLeaderboardEvents: async () => events },
    buildLeaderboard,
    allowLegacyLeaderboardFallback: false,
    nowMs: () => now,
  } as any);

  const response = await service.getPublicLeaderboardSummary({ query: { period: 'week', limit: '5' } });
  assert.deepEqual(
    response.body.entries.map((entry: any) => ({
      completedLessons: entry.completedLessons,
      averageAccuracy: entry.averageAccuracy,
      studyDays: entry.studyDays,
      honorScore: entry.honorScore,
      badges: entry.badges,
    })),
    expected.gold.map(entry => ({
      completedLessons: entry.completedLessons,
      averageAccuracy: entry.averageAccuracy,
      studyDays: entry.studyDays,
      honorScore: entry.honorScore,
      badges: entry.badges,
    })),
  );
});

test('duplicate cold summary requests share one in-flight aggregation', async () => {
  let reads = 0;
  let releaseRead!: () => void;
  const wait = new Promise<void>(resolve => { releaseRead = resolve; });
  const service = createResultsService({
    ...serviceDefaults,
    repository: {
      loadReadyLeaderboardEvents: async () => {
        reads += 1;
        await wait;
        return [];
      },
    },
    buildLeaderboard: () => ({ gold: [], diligent: [], accurate: [], improved: [] }),
    allowLegacyLeaderboardFallback: false,
  } as any);

  const first = service.getPublicLeaderboardSummary({ query: { period: 'week' } });
  const second = service.getPublicLeaderboardSummary({ query: { period: 'week' } });
  releaseRead();
  await Promise.all([first, second]);
  assert.equal(reads, 1);
});

test('25k-event public summary remains bounded and does not return source records', async () => {
  const now = Date.parse('2026-09-24T12:00:00.000Z');
  const events = Array.from({ length: 25_000 }, (_, index) => ({
    id: `event-${index}`,
    publicStudentKey: `student-${index % 250}`,
    studentName: `Student ${index % 250}`,
    vocabSetId: `set-${index % 20}`,
    gameId: `game-${index % 5}`,
    completedAt: new Date(now - (index % 6) * 86_400_000).toISOString(),
    score: 50 + (index % 51),
    totalQuestions: 10,
    correctAnswers: 5 + (index % 6),
    incorrectAnswers: 5 - (index % 6),
  }));
  const service = createResultsService({
    ...serviceDefaults,
    repository: { loadReadyLeaderboardEvents: async () => events },
    buildLeaderboard,
    allowLegacyLeaderboardFallback: false,
    nowMs: () => now,
  } as any);

  const startedAt = performance.now();
  const response = await service.getPublicLeaderboardSummary({ query: { period: 'week', limit: '5' } });
  const elapsedMs = performance.now() - startedAt;
  assert.equal(response.body.entries.length, 5);
  assert.ok(Buffer.byteLength(JSON.stringify(response.body), 'utf8') < 20 * 1024);
  assert.ok(elapsedMs < 1_500, `summary took ${elapsedMs.toFixed(1)}ms`);
});

test('deprecated public raw leaderboard returns 410 without reading storage', async () => {
  const service = createResultsService({ repository: {} } as any);
  const response = await service.getPublicLeaderboardResults();
  assert.equal(response.status, 410);
  assert.equal(response.body.code, 'LEADERBOARD_RAW_RETIRED');
  const authenticatedResponse = await service.getLeaderboardResults({ user: { id: 'student-1' } });
  assert.equal(authenticatedResponse.status, 410);
  assert.equal(authenticatedResponse.body.code, 'LEADERBOARD_RAW_RETIRED');
});

test('summary reads remain bounded and result detail is loaded only by explicit id', () => {
  assert.match(serviceSource, /boundedLimit/);
  assert.match(serviceSource, /loadScopedRecentActivitySummaries/);
  assert.match(repositorySource, /getRecord\(collectionName: string, id: string\)/);
});
