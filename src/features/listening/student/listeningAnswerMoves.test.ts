import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getUnusedAnswerIds,
  placeSingleUseAnswer,
  removeSingleUseAnswer,
} from './listeningAnswerMoves.js';

test('placing an answer consumes it once and replacing a target returns its old answer', () => {
  const first = placeSingleUseAnswer({}, 'target-1', 'answer-a');
  const second = placeSingleUseAnswer(first, 'target-1', 'answer-b');

  assert.deepEqual(first, { 'target-1': 'answer-a' });
  assert.deepEqual(second, { 'target-1': 'answer-b' });
  assert.deepEqual(getUnusedAnswerIds(['answer-a', 'answer-b', 'answer-c'], second), ['answer-a', 'answer-c']);
});

test('moving a used answer to another target removes it from the previous target', () => {
  const current = { 'target-1': 'answer-a', 'target-2': 'answer-b' };
  assert.deepEqual(placeSingleUseAnswer(current, 'target-2', 'answer-a'), { 'target-2': 'answer-a' });
  assert.deepEqual(current, { 'target-1': 'answer-a', 'target-2': 'answer-b' });
});

test('five placements from six options leave exactly one answer in the tray', () => {
  let answers = {};
  for (let index = 1; index <= 5; index += 1) {
    answers = placeSingleUseAnswer(answers, `target-${index}`, `answer-${index}`);
  }
  assert.deepEqual(
    getUnusedAnswerIds(['answer-1', 'answer-2', 'answer-3', 'answer-4', 'answer-5', 'answer-6'], answers),
    ['answer-6'],
  );
  assert.deepEqual(removeSingleUseAnswer(answers, 'target-3'), {
    'target-1': 'answer-1',
    'target-2': 'answer-2',
    'target-4': 'answer-4',
    'target-5': 'answer-5',
  });
});
