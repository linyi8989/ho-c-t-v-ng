import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultMoverReadingWritingContent } from '../../features/mover-reading-writing/defaultContent';
import { createEmptyMoverReadingWritingAnswers } from '../../features/mover-reading-writing/types';
import { gradeMoverReadingWritingAttempt, normalizeMoverReadingWritingText } from './moverReadingWritingGrader';
import {
  sanitizeMoverReadingWritingContentForStudent,
  validateMoverReadingWritingContent,
} from './moverReadingWritingValidation';

function fixture() {
  const content = createDefaultMoverReadingWritingContent();
  content.title = 'Movers Reading fixture';
  content.description = 'Six parts and forty questions.';
  content.parts[0].wordBankAssetId = 'image-p1';
  content.parts[0].questions.forEach((question, index) => { question.prompt = `Definition ${index + 1} {{${question.id}}}`; question.acceptedAnswers = [`word ${index + 1}`]; });
  content.parts[1].sceneAssetId = 'image-p2';
  content.parts[1].questions.forEach((question, index) => { question.statement = `Statement ${index + 1}`; question.correctAnswer = index % 2 ? 'no' : 'yes'; });
  content.parts[2].sceneAssetId = 'image-p3';
  content.parts[2].questions.forEach((question, index) => {
    question.prompt = `Dialogue ${index + 1}`;
    question.options.forEach((option, optionIndex) => { option.text = `Answer ${index + 1}.${optionIndex + 1}`; });
    question.correctOptionId = question.options[1].id;
  });
  content.parts[3].wordBankAssetId = 'image-p4';
  content.parts[3].gaps.forEach((gap, index) => { gap.acceptedAnswers = [`gap ${index + 1}`]; });
  content.parts[3].titleQuestion.prompt = 'Choose the best title.';
  content.parts[3].titleQuestion.options.forEach((option, index) => { option.text = `Title ${index + 1}`; });
  content.parts[3].titleQuestion.correctOptionId = content.parts[3].titleQuestion.options[2].id;
  content.parts[4].scenes.forEach((scene, sceneIndex) => {
    scene.imageAssetId = `image-p5-${sceneIndex + 1}`;
    scene.passage = `Story ${sceneIndex + 1}`;
    scene.questions.forEach((question, questionIndex) => {
      question.prompt = `Scene ${sceneIndex + 1} question ${questionIndex + 1} {{${question.id}}}`;
      question.acceptedAnswers = ['at the weekend'];
    });
  });
  content.parts[5].studentImageAssetId = 'image-p6';
  content.parts[5].optionsSourceAssetId = 'image-p6-options';
  content.parts[5].questions.forEach((question, index) => {
    question.options.forEach((option, optionIndex) => { option.text = `Choice ${index + 1}.${optionIndex + 1}`; });
    question.correctOptionId = question.options[1].id;
  });
  return content;
}

test('validates the exact six-Part / forty-question Movers Reading contract', () => {
  const content = fixture();
  assert.deepEqual(validateMoverReadingWritingContent(content), []);
  content.parts[4].scenes[0].questions.pop();
  assert.match(validateMoverReadingWritingContent(content).join('\n'), /tổng cộng đúng 10 câu/);
});

test('grades all forty questions on the server and enforces Part 5 one-to-three words', () => {
  const content = fixture();
  const answers = createEmptyMoverReadingWritingAnswers();
  content.parts[0].questions.forEach(question => { answers.part1[question.id] = question.acceptedAnswers[0].toUpperCase(); });
  content.parts[1].questions.forEach(question => { answers.part2[question.id] = question.correctAnswer; });
  content.parts[2].questions.forEach(question => { answers.part3[question.id] = question.correctOptionId; });
  content.parts[3].gaps.forEach(gap => { answers.part4.gaps[gap.id] = gap.acceptedAnswers[0]; });
  answers.part4.titleOptionId = content.parts[3].titleQuestion.correctOptionId;
  content.parts[4].scenes.forEach(scene => scene.questions.forEach(question => { answers.part5[question.id] = question.acceptedAnswers[0]; }));
  content.parts[5].questions.forEach(question => { answers.part6[question.id] = question.correctOptionId; });
  const perfect = gradeMoverReadingWritingAttempt(content, answers);
  assert.equal(perfect.totalCount, 40);
  assert.equal(perfect.correctCount, 40);
  assert.equal(perfect.score, 100);

  const firstPart5 = content.parts[4].scenes[0].questions[0];
  firstPart5.acceptedAnswers = ['one two three four'];
  answers.part5[firstPart5.id] = 'one two three four';
  const limited = gradeMoverReadingWritingAttempt(content, answers);
  assert.equal(limited.correctCount, 39);

  firstPart5.acceptedAnswers = ['valid'];
  answers.part5[firstPart5.id] = 'valid';
  const firstPart6 = content.parts[5].questions[0];
  answers.part6[firstPart6.id] = firstPart6.options[0].id;
  const wrongChoice = gradeMoverReadingWritingAttempt(content, answers);
  assert.equal(wrongChoice.correctCount, 39);
});

test('normalizes Unicode/apostrophes and strips every answer key from student content', () => {
  assert.equal(normalizeMoverReadingWritingText('  It’s   RED  '), "it's red");
  const playable = sanitizeMoverReadingWritingContentForStudent(fixture()) as any;
  const serialized = JSON.stringify(playable);
  assert.equal(serialized.includes('acceptedAnswers'), false);
  assert.equal(serialized.includes('correctAnswer'), false);
  assert.equal(serialized.includes('correctOptionId'), false);
  assert.equal('correctOptionId' in playable.parts[2].questions[0], false);
  assert.equal('correctOptionId' in playable.parts[3].titleQuestion, false);
  assert.equal('correctOptionId' in playable.parts[5].questions[0], false);
  assert.equal('optionsSourceAssetId' in playable.parts[5], false);
  assert.equal('optionsSourceUrl' in playable.parts[5], false);
  assert.equal(playable.parts[5].studentImageAssetId, 'image-p6');
});
