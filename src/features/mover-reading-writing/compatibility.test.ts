import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultMoverReadingWritingContent } from './defaultContent';
import { normalizeMoverReadingWritingContent } from './compatibility';

test('schema v1 is upgraded in memory without rewriting the immutable source', () => {
  const legacy: any = createDefaultMoverReadingWritingContent();
  legacy.schemaVersion = 1;
  legacy.parts[0].questions.forEach((question: any, index: number) => {
    question.prompt = `Legacy definition ${index + 1}`;
    question.acceptedAnswers = [`word ${index + 1}`];
  });
  legacy.parts[4].scenes.forEach((scene: any, sceneIndex: number) => {
    scene.questions.forEach((question: any, index: number) => {
      question.prompt = `Legacy scene ${sceneIndex + 1} question ${index + 1}`;
    });
  });
  legacy.parts[5].gaps = legacy.parts[5].gaps.map((gap: any, index: number) => ({
    id: gap.id,
    prompt: `Legacy gap ${index + 1}`,
    options: [
      { id: `${gap.id}-a`, text: `word${index + 1}` },
      { id: `${gap.id}-b`, text: 'distractor' },
      { id: `${gap.id}-c`, text: 'other' },
    ],
    correctOptionId: `${gap.id}-a`,
  }));

  const normalized = normalizeMoverReadingWritingContent(legacy);

  assert.equal(normalized.schemaVersion, 2);
  assert.match(normalized.parts[0].questions[0].prompt, /\{\{.+\}\}/);
  assert.match(normalized.parts[4].scenes[0].questions[0].prompt, /\{\{.+\}\}/);
  assert.deepEqual(normalized.parts[5].gaps[0].acceptedAnswers, ['word1']);
  assert.equal(legacy.schemaVersion, 1);
  assert.equal(legacy.parts[0].questions[0].prompt, 'Legacy definition 1');
  assert.equal('acceptedAnswers' in legacy.parts[5].gaps[0], false);
});
