import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultMoverReadingWritingContent } from '../../features/mover-reading-writing/defaultContent';
import { createEmptyMoverReadingWritingAnswers } from '../../features/mover-reading-writing/types';
import { gradeMoverReadingWritingAttempt } from './moverReadingWritingGrader';
import {
  buildMoverReadingWritingVisualReviewSnapshot,
  normalizeMoverReadingWritingVisualReviewSnapshot,
} from './moverReadingWritingReview';

test('builds a display-only six-Part visual review from the immutable paper result', () => {
  const content = createDefaultMoverReadingWritingContent();
  content.parts[0].wordBankUrl = '/media/part-1.png';
  content.parts[1].sceneUrl = '/media/part-2.png';
  content.parts[2].sceneUrl = '/media/part-3.png';
  content.parts[3].wordBankUrl = '/media/part-4.png';
  content.parts[4].scenes.forEach((scene, index) => { scene.imageUrl = `/media/part-5-${index + 1}.png`; });
  content.parts[5].illustrationUrl = '/media/part-6-reading.png';
  content.parts[5].optionsUrl = '/media/part-6-options.png';
  content.parts[0].questions.forEach((question, index) => {
    question.prompt = `Definition ${index + 1} {{${question.id}}}`;
    question.acceptedAnswers = [`word ${index + 1}`];
  });
  content.parts[3].gaps.forEach((gap, index) => { gap.acceptedAnswers = [`gap ${index + 1}`]; });
  content.parts[4].scenes.forEach((scene, sceneIndex) => scene.questions.forEach((question, index) => {
    question.prompt = `Scene ${sceneIndex + 1} question ${index + 1} {{${question.id}}}`;
    question.acceptedAnswers = [`scene answer ${sceneIndex + 1} ${index + 1}`];
  }));
  [...content.parts[2].questions, content.parts[3].titleQuestion].forEach((question, questionIndex) => {
    question.options.forEach((option, optionIndex) => { option.text = `Choice ${questionIndex + 1}.${optionIndex + 1}`; });
  });
  content.parts[5].gaps.forEach((gap, index) => { gap.acceptedAnswers = [`word${index + 1}`]; });

  const answers = createEmptyMoverReadingWritingAnswers();
  const part1First = content.parts[0].questions[0];
  const part1Second = content.parts[0].questions[1];
  answers.part1[part1First.id] = part1First.acceptedAnswers[0];
  answers.part1[part1Second.id] = 'wrong answer';
  const part2First = content.parts[1].questions[0];
  const part2Second = content.parts[1].questions[1];
  answers.part2[part2First.id] = part2First.correctAnswer;
  answers.part2[part2Second.id] = part2Second.correctAnswer === 'yes' ? 'no' : 'yes';
  const part3First = content.parts[2].questions[0];
  answers.part3[part3First.id] = part3First.correctOptionId;
  const part4First = content.parts[3].gaps[0];
  answers.part4.gaps[part4First.id] = part4First.acceptedAnswers[0];
  const part5First = content.parts[4].scenes[0].questions[0];
  answers.part5[part5First.id] = part5First.acceptedAnswers[0];
  const part6First = content.parts[5].gaps[0];
  answers.part6[part6First.id] = part6First.acceptedAnswers[0];

  const grade = gradeMoverReadingWritingAttempt(content, answers);
  const snapshot = buildMoverReadingWritingVisualReviewSnapshot(content, grade.questions);
  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(snapshot.totalCount, 40);
  assert.deepEqual(snapshot.parts.map(part => part.part), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(snapshot.parts.map(part => {
    if (part.part === 4) return part.gaps.length + 1;
    if (part.part === 5) return part.scenes.flatMap(scene => scene.items).length;
    return part.items.length;
  }), [6, 6, 6, 7, 10, 5]);
  const reviewPart1 = snapshot.parts.find(part => part.part === 1);
  const reviewPart2 = snapshot.parts.find(part => part.part === 2);
  const reviewPart3 = snapshot.parts.find(part => part.part === 3);
  const reviewPart4 = snapshot.parts.find(part => part.part === 4);
  const reviewPart6 = snapshot.parts.find(part => part.part === 6);
  assert.ok(reviewPart1 && reviewPart1.part === 1);
  assert.ok(reviewPart2 && reviewPart2.part === 2);
  assert.ok(reviewPart3 && reviewPart3.part === 3);
  assert.ok(reviewPart4 && reviewPart4.part === 4);
  assert.ok(reviewPart6 && reviewPart6.part === 6);
  assert.equal(reviewPart1.items[0].state, 'correct');
  assert.equal(reviewPart1.items[1].state, 'incorrect');
  assert.equal(reviewPart1.items[2].state, 'unanswered');
  assert.equal(reviewPart2.items[1].selectedOptionIndex >= 0, true);
  assert.equal(reviewPart3.items[0].selectedOptionIndex, reviewPart3.items[0].correctOptionIndex);
  assert.equal(reviewPart6.items[0].state, 'correct');
  assert.match(reviewPart4.storyTemplate, /\{\{1\}\}/);
  assert.doesNotMatch(reviewPart4.storyTemplate, new RegExp(part4First.id));
  assert.match(reviewPart6.passageTemplate, /\{\{1\}\}/);

  const serialized = JSON.stringify(snapshot);
  for (const privateField of [
    'questionId', 'correctOptionId', 'acceptedAnswers', 'assetId',
    'passageSourceAssetId', 'passageSourceUrl', part1First.id, part4First.id,
  ]) {
    assert.equal(serialized.includes(privateField), false, `Visual review leaked ${privateField}`);
  }
  assert.ok(normalizeMoverReadingWritingVisualReviewSnapshot(snapshot));
  assert.equal(normalizeMoverReadingWritingVisualReviewSnapshot({ ...snapshot, questionId: 'private-id' }), undefined);
});
