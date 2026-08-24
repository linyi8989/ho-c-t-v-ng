import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultMoverReadingWritingContent } from './defaultContent';
import { normalizeMoverReadingWritingContent } from './compatibility';
import { isMoverReadingWritingPart6ImageChoice } from './types';

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
  legacy.parts[5] = {
    part: 6,
    title: 'Part 6',
    instruction: 'Legacy Part 6',
    illustrationAssetId: 'legacy-passage',
    optionsAssetId: 'legacy-options',
    passageTitle: 'Legacy passage',
    passageTemplate: [1, 2, 3, 4, 5].map(index => `{{legacy-gap-${index}}}`).join(' '),
    gaps: [1, 2, 3, 4, 5].map((number, index) => {
      const id = `legacy-gap-${number}`;
      return {
        id,
        prompt: `Legacy gap ${number}`,
        options: [
          { id: `${id}-a`, text: `word${index + 1}` },
          { id: `${id}-b`, text: 'distractor' },
          { id: `${id}-c`, text: 'other' },
        ],
        correctOptionId: `${id}-a`,
      };
    }),
  };

  const normalized = normalizeMoverReadingWritingContent(legacy);

  assert.equal(normalized.schemaVersion, 2);
  assert.match(normalized.parts[0].questions[0].prompt, /\{\{.+\}\}/);
  assert.match(normalized.parts[4].scenes[0].questions[0].prompt, /\{\{.+\}\}/);
  assert.equal(isMoverReadingWritingPart6ImageChoice(normalized.parts[5]), false);
  if (isMoverReadingWritingPart6ImageChoice(normalized.parts[5])) assert.fail('Expected legacy Part 6 text mode.');
  assert.deepEqual(normalized.parts[5].gaps[0].acceptedAnswers, ['word1']);
  assert.equal(legacy.schemaVersion, 1);
  assert.equal(legacy.parts[0].questions[0].prompt, 'Legacy definition 1');
  assert.equal('acceptedAnswers' in legacy.parts[5].gaps[0], false);
});
