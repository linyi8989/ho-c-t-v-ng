import assert from 'node:assert/strict';
import test from 'node:test';
import { parseListeningPart2InputVariants } from './part2AnswerVariants';

test('private input variants are optional, bounded and deduplicated without expanding answers in code', () => {
  assert.equal(parseListeningPart2InputVariants(undefined), undefined);
  assert.deepEqual(parseListeningPart2InputVariants([]), []);
  assert.deepEqual(parseListeningPart2InputVariants(['4', 'four years', '4 years', ' FOUR  YEARS ']), ['4', 'four years', '4 years']);
  assert.deepEqual(parseListeningPart2InputVariants(["Jane’s", "Jane's"]), ['Jane’s']);
  assert.deepEqual(parseListeningPart2InputVariants(['four']), ['four']);
});

test('malformed input variants fail instead of being silently dropped or truncated', () => {
  for (const invalid of [null, 4, '4 | four', {}, [''], ['  '], [4], [null], ['a\nb'], ['a\tb'], ['x'.repeat(201)], Array(21).fill('4')]) {
    assert.throws(() => parseListeningPart2InputVariants(invalid), /inputAnswerVariants/);
  }
});
