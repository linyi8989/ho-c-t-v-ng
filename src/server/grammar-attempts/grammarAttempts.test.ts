import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createGrammarAttemptService } from './service';

const serverSource = readFileSync(new URL('../../../server.ts', import.meta.url), 'utf8');
const routerSource = readFileSync(new URL('./router.ts', import.meta.url), 'utf8');
const repositorySource = readFileSync(new URL('./repository.ts', import.meta.url), 'utf8');

test('all seven grammar-attempt endpoints move behind one optional-auth router', () => {
  assert.match(serverSource, /createGrammarAttemptRouter/);
  assert.doesNotMatch(serverSource, /app\.(?:get|post)\("\/api\/(?:grammar-attempts|grammar-sets\/:id\/(?:attempts|my-attempts))/);
  for (const route of [
    'router.post("/grammar-sets/:id/attempts/prepare"',
    'router.post("/grammar-sets/:id/attempts/activate"',
    'router.post("/grammar-sets/:id/attempts"',
    'router.post("/grammar-attempts/:attemptId/answers"',
    'router.post("/grammar-attempts/:attemptId/submit"',
    'router.get("/grammar-attempts/:attemptId/review"',
    'router.get("/grammar-sets/:id/my-attempts"',
  ]) assert.ok(routerSource.includes(route), `missing route ${route}`);
  assert.equal((routerSource.match(/options\.authenticateOptionalUser/g) || []).length, 7);
});

test('prepare keeps identity/access/max-attempt checks before returning run credentials', async () => {
  const set = { id: 'grammar-1', maxAttempts: 1 };
  const service = createGrammarAttemptService({
    repository: {
      async getSet() { return set; },
      async countCompletedAttempts() { return 1; },
    } as any,
    lazySessionEnabled: true,
    getClientRunCredentials: () => ({ clientRunId: 'run-1', runSecret: 'secret' }),
    getActor: async () => ({ id: 'student-1', name: 'An', role: 'student', isGuest: false }),
    canOpenSet: () => true,
    buildPreparedAttempt: () => ({ id: 'prepared' }),
  } as any);
  await assert.rejects(
    service.prepareAttempt({ params: { id: 'grammar-1' }, body: {} } as any),
    (error: any) => error.status === 403 && /het so lan/.test(error.message),
  );
});

test('attempt persistence stays batched with history and completed submit adds leaderboard atomically', () => {
  assert.match(repositorySource, /batch\.set\(.*grammar_attempts/s);
  assert.match(repositorySource, /appendLearningHistoryProjection/);
  assert.match(repositorySource, /leaderboard_events/);
  assert.match(repositorySource, /await batch\.commit\(\)/);
  assert.doesNotMatch(repositorySource, /\.delete\(/);
});
