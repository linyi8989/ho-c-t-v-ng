import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createResultsService } from './service';

const serverSource = readFileSync(new URL('../../../server.ts', import.meta.url), 'utf8');
const routerSource = readFileSync(new URL('./router.ts', import.meta.url), 'utf8');
const serviceSource = readFileSync(new URL('./service.ts', import.meta.url), 'utf8');
const repositorySource = readFileSync(new URL('./repository.ts', import.meta.url), 'utf8');

test('public and authenticated result URLs are mounted through one results router', () => {
  assert.match(serverSource, /createResultsRouter/);
  assert.doesNotMatch(serverSource, /app\.get\("\/api\/(?:public\/results|public\/leaderboard|results|leaderboard-results)/);
  for (const route of [
    "router.get('/public/results'", "router.get('/public/leaderboard-results'",
    "router.get('/public/leaderboard-summary'", "router.get('/results/:sourceType/:resultId'",
    "router.get('/results'", "router.get('/leaderboard-results'",
  ]) assert.ok(routerSource.includes(route), `missing route ${route}`);
  assert.equal((routerSource.match(/options\.authenticateUser/g) || []).length, 3);
});

test('result shaping and authorization remain in the service while persistence reads stay in the repository', () => {
  assert.match(serviceSource, /canViewResultSession/);
  assert.match(serviceSource, /canViewGrammarActivity/);
  assert.match(serviceSource, /sanitizePublicStudentRecord/);
  assert.match(serviceSource, /read_model_fallback/);
  assert.match(repositorySource, /where\('completedAt', '>=', cutoff\)/);
  assert.match(repositorySource, /Promise\.all/);
});

test('public leaderboard summary uses a read-only legacy fallback when the projection is not ready', async () => {
  const calls: string[] = [];
  const marks: string[] = [];
  let cachedValue: any = null;
  const legacyEvent = {
    studentName: 'Học sinh A',
    classId: 'class-1',
    className: 'Lớp 1',
    completedAt: '2026-09-24T00:00:00.000Z',
  };
  const service = createResultsService({
    repository: {
      loadReadyLeaderboardEvents: async () => {
        calls.push('ready');
        return null;
      },
      loadLeaderboardEvents: async () => {
        calls.push('legacy');
        return [legacyEvent];
      },
    },
    activityTtlMs: 1,
    maxResultLimit: 100,
    safeText: (value: any, maxLength: number) => String(value || '').slice(0, maxLength),
    sanitizePublicStudentRecord: (event: any) => event,
    buildLeaderboard: (events: any[]) => ({ gold: events, diligent: [], accurate: [], improved: [] }),
    getCachedLeaderboardSummary: () => undefined,
    cacheLeaderboardSummary: (_key: string, value: any) => {
      cachedValue = value;
    },
    nowMs: () => Date.parse('2026-09-24T12:00:00.000Z'),
  } as any);

  const response = await service.getPublicLeaderboardSummary(
    { query: { period: 'week', limit: '8' } },
    { mark: (label: string) => marks.push(label) },
  );

  assert.deepEqual(calls, ['ready', 'legacy']);
  assert.ok(marks.includes('read_model_fallback'));
  assert.equal((response as any).status, undefined);
  assert.equal(response.body.entries.length, 1);
  assert.deepEqual(response.body.classes, [{ id: 'class-1', name: 'Lớp 1' }]);
  assert.deepEqual(cachedValue, response.body);
});

test('summary reads remain bounded and result detail is loaded only by explicit id', () => {
  assert.match(serviceSource, /boundedLimit/);
  assert.match(serviceSource, /loadScopedRecentActivitySummaries/);
  assert.match(repositorySource, /getRecord\(collectionName: string, id: string\)/);
});
