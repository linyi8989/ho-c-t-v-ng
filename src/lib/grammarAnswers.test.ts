import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeGrammarTextAnswer } from './grammarAnswers';

test('normalizes case and redundant whitespace for rewrite grading', () => {
  assert.equal(
    normalizeGrammarTextAnswer('  I   WENT to   school every day.  '),
    normalizeGrammarTextAnswer('i went TO school every day.')
  );
});

test('keeps materially different answers distinct', () => {
  assert.notEqual(
    normalizeGrammarTextAnswer('She is a teacher.'),
    normalizeGrammarTextAnswer('She was a teacher.')
  );
});
