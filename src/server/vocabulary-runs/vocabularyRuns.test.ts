import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const serverSource = readFileSync(new URL('../../../server.ts', import.meta.url), 'utf8');
const routerSource = readFileSync(new URL('./router.ts', import.meta.url), 'utf8');
const repositorySource = readFileSync(new URL('./repository.ts', import.meta.url), 'utf8');

test('all vocabulary run and pronunciation URLs move behind one optional-auth router', () => {
  assert.match(serverSource, /createVocabularyRunRouter/);
  assert.doesNotMatch(serverSource, /app\.(?:post|put)\("\/api\/(?:game-sessions|pronunciation-attempts)/);
  for (const route of [
    'router.post("/game-sessions/activate"', 'router.post("/game-sessions/lazy-complete"',
    'router.post("/game-sessions"', 'router.put("/game-sessions/:id"',
    'router.put("/game-sessions/:id/actions/:actionId"', 'router.post("/game-sessions/:id/submit"',
    'router.post("/pronunciation-attempts"',
  ]) assert.ok(routerSource.includes(route), `missing route ${route}`);
  assert.equal((routerSource.match(/options\.authenticateOptionalUser/g) || []).length, 7);
});

test('session completion remains one batch with leaderboard and learning-history projection', () => {
  assert.match(repositorySource, /saveCompletedSession/);
  assert.match(repositorySource, /leaderboard_events/);
  assert.match(repositorySource, /appendLearningHistoryProjection/);
  assert.match(repositorySource, /await batch\.commit\(\)/);
});

test('incremental actions keep canonical sequence id and legacy action-id idempotency reads', () => {
  assert.match(repositorySource, /canonicalActionId/);
  assert.match(repositorySource, /legacyActionId/);
  assert.match(repositorySource, /Promise\.all/);
  assert.match(repositorySource, /batch\.update/);
});
