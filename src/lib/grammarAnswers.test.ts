import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GRAMMAR_TEXT_GRADING_VERSION,
  isGrammarTextAnswerCorrect,
  normalizeGrammarTextAnswer
} from './grammarAnswers';

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

test('normalizes whitespace around answer punctuation', () => {
  assert.equal(
    normalizeGrammarTextAnswer('am doing ; is reading'),
    normalizeGrammarTextAnswer('am doing;is reading')
  );
  assert.equal(
    normalizeGrammarTextAnswer('am doing; is reading'),
    normalizeGrammarTextAnswer('am doing;is reading')
  );
  assert.equal(
    normalizeGrammarTextAnswer('She is reading .'),
    normalizeGrammarTextAnswer('She is reading.')
  );
});

test('normalizes straight and typographic apostrophes', () => {
  assert.equal(
    normalizeGrammarTextAnswer("aren't drinking"),
    normalizeGrammarTextAnswer('aren\u2019t drinking')
  );
  assert.notEqual(
    normalizeGrammarTextAnswer('its'),
    normalizeGrammarTextAnswer("it's")
  );
});

test('removes invisible mobile formatting characters', () => {
  assert.equal(
    normalizeGrammarTextAnswer('is\u200B reading'),
    normalizeGrammarTextAnswer('is reading')
  );
});

test('accepts explicit alternative answers without guessing contractions', () => {
  assert.equal(GRAMMAR_TEXT_GRADING_VERSION, 2);
  assert.equal(isGrammarTextAnswerCorrect('it is', "it's", ['it is']), true);
  assert.equal(isGrammarTextAnswerCorrect('it is', "it's"), false);
  assert.equal(isGrammarTextAnswerCorrect('it has', "it's", ['it is']), false);
});
