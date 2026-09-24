import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

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
  assert.match(serviceSource, /LEADERBOARD_NOT_READY/);
  assert.match(repositorySource, /where\('completedAt', '>=', cutoff\)/);
  assert.match(repositorySource, /Promise\.all/);
});

test('summary reads remain bounded and result detail is loaded only by explicit id', () => {
  assert.match(serviceSource, /boundedLimit/);
  assert.match(serviceSource, /loadScopedRecentActivitySummaries/);
  assert.match(repositorySource, /getRecord\(collectionName: string, id: string\)/);
});
