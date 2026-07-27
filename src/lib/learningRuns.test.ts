import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createClientLearningRun,
  findPendingSubmission,
  pendingSubmissionKey,
  removePendingSubmission,
  storePendingSubmission
} from './learningRuns';

class MemoryStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

test('client learning runs use unique stable credentials', () => {
  const first = createClientLearningRun();
  const second = createClientLearningRun();

  assert.notEqual(first.clientRunId, second.clientRunId);
  assert.notEqual(first.runSecret, second.runSecret);
  assert.ok(first.clientRunId.length >= 8);
  assert.ok(first.runSecret.length >= 24);
  assert.ok(Number.isFinite(new Date(first.startedAt).getTime()));
});

test('pending submissions can be restored and removed by immutable run key', () => {
  const sessionStorage = new MemoryStorage();
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { sessionStorage }
  });

  const run = createClientLearningRun();
  const key = pendingSubmissionKey('set-1', 'quiz-en-vi', run.clientRunId);
  storePendingSubmission({
    key,
    kind: 'vocabulary',
    vocabSetId: 'set-1',
    gameId: 'quiz-en-vi',
    run,
    payload: { clientRunId: run.clientRunId },
    createdAt: new Date().toISOString()
  });

  assert.equal(findPendingSubmission('set-1', 'quiz-en-vi')?.key, key);
  removePendingSubmission(key);
  assert.equal(findPendingSubmission('set-1', 'quiz-en-vi'), null);
  Reflect.deleteProperty(globalThis, 'window');
});
