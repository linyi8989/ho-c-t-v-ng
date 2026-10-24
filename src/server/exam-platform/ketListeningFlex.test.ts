import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultExamContent, getExamPaperDefinition } from '../../features/exam-platform/definitions';
import { normalizeFixedKetListeningContent } from '../../features/exam-platform/ketListeningMigration';
import type { ExamAnswers } from '../../features/exam-platform/types';
import { gradeExamAttempt } from './examGrader';
import { sanitizeExamContentForStudent, validateExamPaperContent } from './examValidation';

function completePaper() {
  const content = createDefaultExamContent(getExamPaperDefinition('ket', 'listening')!);
  content.title = 'Flexible KET Listening regression';
  content.parts.forEach(part => {
    part.audioAssetId = `audio-${part.part}`;
    part.questions.forEach(question => {
      question.prompt = `Printed question ${question.number}`;
      if (question.options.length) {
        question.correctOptionIds = [question.options[1].id];
        question.options.forEach(option => {
          option.imageAssetId = `image-${question.number}-${option.label}`;
          option.imageUrl = `/media/${question.number}-${option.label}.png`;
        });
      } else question.acceptedAnswers = [part.part === 2 ? 'A' : 'Monday'];
    });
    if (part.part <= 3) part.examples = [{ prompt: 'Printed example question', answer: 'B', ...(part.part === 2 ? {} : { options: ['A', 'B', 'C'].map(label => ({ label, text: `Printed reply ${label}` })) }) }];
    if (part.part === 2) part.imageAssetId = 'matching-image';
    if (part.part >= 4) part.passage = 'Notebook\nExample — School: International Language School';
  });
  return content;
}

test('KET image layouts can change at every printed position without changing answer IDs or grading', () => {
  for (let sharedIndex = 0; sharedIndex < 5; sharedIndex++) {
    const content = completePaper();
    const answers: ExamAnswers = Object.fromEntries(content.parts.flatMap(part => part.questions.map(question => [question.id, question.correctOptionIds[0] || question.acceptedAnswers[0]])));
    const before = gradeExamAttempt(content, answers);
    content.parts[0].questions.forEach((question, index) => {
      question.imageLayout = index === sharedIndex ? { kind: 'shared' } : { kind: 'options', optionLabels: index % 2 ? ['A', 'C'] : ['B'] };
      question.imageAssetId = `common-${index}`;
      question.imageUrl = `/media/common-${index}.png`;
    });
    assert.deepEqual(validateExamPaperContent(content), [], `Shared image at ${sharedIndex + 1}`);
    assert.deepEqual(gradeExamAttempt(content, answers), before);
    const normalized = normalizeFixedKetListeningContent(content);
    assert.deepEqual(normalized.parts[0].questions.map(question => question.options), content.parts[0].questions.map(question => question.options));
    const safe = sanitizeExamContentForStudent(content);
    assert.equal(safe.parts[0].questions[sharedIndex].imageAssetId, `common-${sharedIndex}`);
    assert.ok(safe.parts[0].questions[sharedIndex].options.every(option => !option.imageAssetId && !option.imageUrl));
    safe.parts[0].questions.forEach((question, index) => {
      if (index !== sharedIndex) {
        assert.equal(question.imageAssetId, undefined);
        assert.equal(question.imageUrl, undefined);
        const labels = question.options.filter(option => option.imageAssetId).map(option => option.label);
        assert.deepEqual(labels, index % 2 ? ['A', 'C'] : ['B']);
      }
    });
    assert.doesNotMatch(JSON.stringify(safe), /"(?:correctOptionIds|acceptedAnswers|audioTranscript)"\s*:/);
  }
});

test('KET publishing rejects missing active images and malformed layout metadata', () => {
  const content = completePaper();
  const question = content.parts[0].questions[0];
  for (const invalid of [null, 'shared', [], {}, { kind: 'other' }, { kind: 'shared', optionLabels: ['A'] }, { kind: 'options', optionLabels: [] }, { kind: 'options', optionLabels: ['A', 'A'] }, { kind: 'options', optionLabels: ['D'] }, { kind: 'options', optionLabels: [null] }, { kind: 'options', answerKey: 'B' }]) {
    question.imageLayout = invalid as never;
    assert.ok(validateExamPaperContent(content).some(error => error.includes('bố cục ảnh không hợp lệ')), JSON.stringify(invalid));
  }
  question.imageLayout = { kind: 'shared' };
  assert.ok(validateExamPaperContent(content).some(error => error.includes('chưa có ảnh chung')));
  question.imageLayout = { kind: 'options', optionLabels: ['B'] };
  question.options[1].imageAssetId = undefined;
  assert.ok(validateExamPaperContent(content).some(error => error.includes('lựa chọn B')));
});

test('KET legacy shared images and incomplete old examples remain readable without rewriting stored content', () => {
  const content = completePaper();
  const question = content.parts[0].questions[2];
  question.imageAssetId = 'legacy-common'; question.imageUrl = '/media/legacy-common.png';
  content.parts[0].examples = [{ prompt: 'Old printed example', answer: 'C' }];
  content.parts[2].examples = [{ prompt: 'Old dialogue example', answer: 'A' }];
  content.parts[0].imageAssetId = 'private-page'; content.parts[0].imageUrl = '/media/private-page.png';
  const original = JSON.stringify(content);
  assert.deepEqual(validateExamPaperContent(content), []);
  const safe = sanitizeExamContentForStudent(content);
  assert.equal(safe.parts[0].imageAssetId, undefined);
  assert.equal(safe.parts[0].questions[2].imageAssetId, 'legacy-common');
  assert.deepEqual(safe.parts[0].questions[2].imageLayout, { kind: 'shared' });
  assert.equal(JSON.stringify(content), original);
  content.parts[2].examples![0].options = [{ label: 'A', text: 'Only one reply' }];
  assert.ok(validateExamPaperContent(content).some(error => error.includes('example có lựa chọn phải đủ')));
});
