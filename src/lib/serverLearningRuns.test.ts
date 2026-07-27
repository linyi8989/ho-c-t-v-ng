import assert from 'node:assert/strict';
import test from 'node:test';
import { deterministicRunDocumentId, normalizeClientStartedAt } from './serverLearningRuns';

test('retries resolve to the same immutable server document id', () => {
  const parts = ['guest-1', 'lesson-1', 'quiz-en-vi', 'run-1'];
  const first = deterministicRunDocumentId('session-v3', parts);
  const retry = deterministicRunDocumentId('session-v3', parts);

  assert.equal(first, retry);
  assert.notEqual(first, deterministicRunDocumentId('session-v3', [...parts.slice(0, 3), 'run-2']));
  assert.match(first, /^session-v3-[a-f0-9]{40}$/);
});

test('client start time is bounded to the current 24 hour retry window', () => {
  const fallback = new Date().toISOString();
  assert.equal(normalizeClientStartedAt('not-a-date', fallback), fallback);
  assert.ok(new Date(normalizeClientStartedAt('2000-01-01T00:00:00.000Z')).getTime() >= Date.now() - 24 * 60 * 60 * 1000 - 1000);
  assert.ok(new Date(normalizeClientStartedAt('2999-01-01T00:00:00.000Z')).getTime() <= Date.now() + 1000);
});
