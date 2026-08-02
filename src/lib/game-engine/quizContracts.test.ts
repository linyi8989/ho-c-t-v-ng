import assert from 'node:assert/strict';
import test from 'node:test';
import { GAMES_LIST } from './gameList';
import {
  getCurrentQuizContract,
  getQuizAnswerValue,
  getQuizQuestionText,
  isQuizItemEligible,
  resolveStoredQuizContract
} from './quizContracts';

test('new quiz-sound sessions listen in English and answer with Vietnamese meaning', () => {
  const contract = getCurrentQuizContract('quiz-sound');

  assert.deepEqual(contract, {
    questionType: 'sound',
    answerType: 'meaning',
    contractVersion: 2
  });
  assert.equal(getQuizQuestionText({ term: 'Science', meaning: 'Khoa học' }, contract!.questionType), 'Science');
  assert.equal(getQuizAnswerValue({ term: 'Science', meaning: 'Khoa học' }, contract!.answerType), 'Khoa học');
});

test('quiz-sound registry exposes the Vietnamese meaning mode without changing its stable id', () => {
  const game = GAMES_LIST.find(item => item.gameId === 'quiz-sound');

  assert.ok(game);
  assert.equal(game.title, 'Nghe và chọn nghĩa');
  assert.equal(game.description, 'Nghe phát âm tiếng Anh và chọn nghĩa tiếng Việt chính xác.');
  assert.deepEqual(game.requiredFields, ['term', 'meaning']);
  assert.equal(game.config.questionType, 'sound');
  assert.equal(game.config.answerType, 'meaning');
  assert.equal(game.config.contractVersion, 2);
});

test('stored legacy quiz-sound snapshots keep English term grading', () => {
  const explicitLegacy = resolveStoredQuizContract('quiz-sound', {
    questionType: 'sound',
    answerType: 'term'
  });
  const missingLegacyConfig = resolveStoredQuizContract('quiz-sound', undefined);

  assert.deepEqual(explicitLegacy, {
    questionType: 'sound',
    answerType: 'term',
    contractVersion: 1
  });
  assert.deepEqual(missingLegacyConfig, explicitLegacy);
  assert.equal(getQuizAnswerValue({ term: 'Science', meaning: 'Khoa học' }, explicitLegacy!.answerType), 'Science');
});

test('stored version 2 quiz-sound snapshots keep Vietnamese meaning grading', () => {
  const contract = resolveStoredQuizContract('quiz-sound', {
    questionType: 'sound',
    answerType: 'meaning',
    contractVersion: 2
  });

  assert.deepEqual(contract, {
    questionType: 'sound',
    answerType: 'meaning',
    contractVersion: 2
  });
});

test('existing text quiz contracts are unchanged', () => {
  assert.deepEqual(getCurrentQuizContract('quiz-en-vi'), {
    questionType: 'term',
    answerType: 'meaning',
    contractVersion: 1
  });
  assert.deepEqual(getCurrentQuizContract('quiz-vi-en'), {
    questionType: 'meaning',
    answerType: 'term',
    contractVersion: 1
  });
});

test('quiz items must contain every field needed by the question and answer', () => {
  const soundContract = getCurrentQuizContract('quiz-sound')!;
  const viEnContract = getCurrentQuizContract('quiz-vi-en')!;

  assert.equal(isQuizItemEligible({ term: 'Science', meaning: 'Khoa học' }, soundContract), true);
  assert.equal(isQuizItemEligible({ term: 'Science', meaning: '   ' }, soundContract), false);
  assert.equal(isQuizItemEligible({ term: 'Science', meaning: '' }, viEnContract), false);
  assert.equal(isQuizItemEligible({ term: '', meaning: 'Khoa học' }, soundContract), false);
});
