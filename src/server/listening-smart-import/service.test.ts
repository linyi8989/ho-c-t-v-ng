import assert from 'node:assert/strict';
import test from 'node:test';
import type { ListeningSmartImportSourceRole } from '../../features/listening-editor/smart-import/types';
import { createDefaultMoverListeningContent } from '../../features/listening-library/modules/mover/editor/moduleDefinition';
import { createListeningSmartImportCandidate } from './service';

const image = (role: ListeningSmartImportSourceRole, assetId = role) => ({ role, assetId, mimeType: 'image/png', data: Buffer.from(assetId) });
const sources = (...roles: ListeningSmartImportSourceRole[]) => roles.map(role => ({ role, assetId: role }));
const rect = (x = 0.1, y = 0.1) => ({ shape: 'rect', x, y, width: 0.1, height: 0.08 });

test('Part 1 keeps three explicit image roles, separates example, and maps labels without AI IDs', async () => {
  const part = createDefaultMoverListeningContent().parts[0];
  const roles = sources('question', 'answer_key', 'position_key');
  const candidate = await createListeningSmartImportCandidate({
    part: 1,
    currentPart: part,
    basePartHash: 'hash',
    sources: roles,
    pastedText: '',
    images: roles.map(source => image(source.role)),
    analyzeVision: async (prompt, images) => {
      assert.match(prompt, /ROLE question/);
      assert.match(prompt, /Never return UUID/);
      assert.deepEqual(images.map(entry => entry.role), ['question', 'answer_key', 'position_key']);
      return { provider: 'gemini', text: JSON.stringify({
        id: 'provider-must-not-survive',
        questionScene: { shape: 'rect', x: 0, y: 0, width: 1, height: 1 },
        positionScene: { shape: 'rect', x: 0, y: 0, width: 1, height: 1 },
        printedNames: ['Fred', 'Daisy', 'John', 'Sally', 'Paul', 'Jill', 'Jane'],
        example: { label: 'Fred', targetEndpoint: { x: 0.2, y: 0.2 }, coordinateRole: 'position_key' },
        targets: Array.from({ length: 5 }, (_, index) => ({ targetNumber: index + 1, visualLabel: `person-${index + 1}`, targetEndpoint: { x: 0.15 + index * 0.15, y: 0.5 }, coordinateRole: 'position_key', confidence: 0.9, choiceId: 'forbidden' })),
        answerMappings: ['Paul', 'John', 'Jill', 'Sally', 'Daisy'].map((choiceLabel, index) => ({ targetNumber: index + 1, choiceLabel, questionId: 'forbidden' })),
      }) };
    },
  });
  assert.deepEqual(candidate.sources, roles);
  assert.equal(candidate.data.part, 1);
  if (candidate.data.part !== 1) return;
  assert.deepEqual(candidate.data.choices, ['Daisy', 'John', 'Sally', 'Paul', 'Jill', 'Jane']);
  assert.equal(candidate.data.example?.label, 'Fred');
  assert.deepEqual(candidate.data.targetChoiceLabels, ['Paul', 'John', 'Jill', 'Sally', 'Daisy']);
  assert.equal(candidate.data.anchors.length, 5);
  assert.doesNotMatch(JSON.stringify(candidate.data), /provider-must-not-survive|choiceId|questionId/);
});

test('Part 2 maps numbered answer key to five prompts, preserving 4b and variants', async () => {
  const part = createDefaultMoverListeningContent().parts[1];
  const roleSources = sources('question', 'answer_key');
  const candidate = await createListeningSmartImportCandidate({
    part: 2,
    currentPart: part,
    basePartHash: 'hash',
    sources: roleSources,
    pastedText: '',
    images: roleSources.map(source => image(source.role)),
    analyzeVision: async () => ({ provider: 'openai', text: JSON.stringify({
      heading: 'Pat',
      exampleText: 'Name: Jill Walker',
      questions: [1, 2, 3, 4, 5].map(number => ({ questionNumber: number, prompt: `${number}. Prompt ____` })),
      answers: [
        { questionNumber: 5, correctAnswer: 'snake' },
        { questionNumber: 2, correctAnswer: '4b' },
        { questionNumber: 1, correctAnswer: 'Main' },
        { questionNumber: 4, answerVariants: ['comics', 'comic books'] },
        { questionNumber: 3, correctAnswer: 'hockey' },
      ],
    }) }),
  });
  assert.equal(candidate.data.part, 2);
  if (candidate.data.part !== 2) return;
  assert.equal(candidate.data.exampleText, 'Name: Jill Walker');
  assert.deepEqual(candidate.data.questions.find(question => question.questionNumber === 2)?.acceptedAnswers, ['4b']);
  assert.deepEqual(candidate.data.questions.find(question => question.questionNumber === 4)?.acceptedAnswers, ['comics', 'comic books']);
});

test('Part 2 malformed or duplicate answer remains unresolved and never shifts later numbers', async () => {
  const part = createDefaultMoverListeningContent().parts[1];
  const roleSources = sources('question', 'answer_key');
  const candidate = await createListeningSmartImportCandidate({
    part: 2, currentPart: part, basePartHash: 'hash', sources: roleSources, pastedText: '', images: roleSources.map(source => image(source.role)),
    analyzeVision: async () => ({ provider: 'openai', text: JSON.stringify({
      questions: [1, 2, 3, 4, 5].map(number => ({ questionNumber: number, prompt: `${number}. Prompt` })),
      answers: [{ questionNumber: 1, answer: 'one' }, { questionNumber: 2, answer: '' }, { questionNumber: 3, answer: 'three' }, { questionNumber: 3, answer: 'conflict' }, { questionNumber: 5, answer: 'five' }],
    }) }),
  });
  if (candidate.data.part !== 2) return;
  assert.equal(candidate.data.questions.find(question => question.questionNumber === 2)?.acceptedAnswers, undefined);
  assert.equal(candidate.data.questions.find(question => question.questionNumber === 3)?.acceptedAnswers, undefined);
  assert.deepEqual(candidate.data.questions.find(question => question.questionNumber === 5)?.acceptedAnswers, ['five']);
  assert.match(candidate.warnings.join(' '), /3/);
});

test('Part 3 uses the 3-left/3-right answer layout and excludes Thursday example from five scored connections', async () => {
  const part = createDefaultMoverListeningContent().parts[2];
  const roleSources = sources('question', 'answer_key');
  const answerLabels = ['Saturday', 'Monday', 'Thursday', 'Sunday', 'Tuesday', 'Wednesday', 'Friday'];
  const candidate = await createListeningSmartImportCandidate({
    part: 3, currentPart: part, basePartHash: 'hash', sources: roleSources, pastedText: '', images: roleSources.map(source => image(source.role)),
    analyzeVision: async prompt => {
      assert.match(prompt, /three left and three right/);
      return { provider: 'openai', text: JSON.stringify({
        questionAnswers: answerLabels.map((label, index) => ({ label, region: rect(0.42, 0.05 + index * 0.12) })),
        questionPictures: Array.from({ length: 6 }, (_, index) => ({ side: index < 3 ? 'left' : 'right', row: index % 3 + 1, region: rect(index < 3 ? 0.05 : 0.75, 0.05 + index % 3 * 0.3) })),
        questionExample: { answerLabel: 'Thursday', pictureSide: 'left', pictureRow: 2, renderOverlayLine: false },
        answerKeyCells: [
          { answerLabel: 'Saturday', side: 'left', row: 1 }, { answerLabel: 'Thursday', side: 'left', row: 2 }, { answerLabel: 'Tuesday', side: 'left', row: 3 },
          { answerLabel: 'Monday', side: 'right', row: 1 }, { answerLabel: 'Sunday', side: 'right', row: 2 }, { answerLabel: 'Wednesday', side: 'right', row: 3 },
        ],
      }) };
    },
  });
  if (candidate.data.part !== 3) return;
  assert.equal(candidate.data.answers.length, 7);
  assert.deepEqual(candidate.data.pictures.map(picture => `${picture.side}:${picture.row}`), ['left:1', 'left:2', 'left:3', 'right:1', 'right:2', 'right:3']);
  assert.equal(candidate.data.example?.answerLabel, 'Thursday');
  assert.equal(candidate.data.connections.length, 5);
  assert.equal(candidate.data.connections.some(connection => connection.answerLabel === 'Thursday'), false);
  assert.equal(candidate.data.distractorLabel, 'Friday');
});

test('Part 3 accepts an answer key containing only the five scored rows when the example comes from the question image', async () => {
  const part = createDefaultMoverListeningContent().parts[2];
  const roleSources = sources('question', 'answer_key');
  const answerLabels = ['Saturday', 'Monday', 'Thursday', 'Sunday', 'Tuesday', 'Wednesday', 'Friday'];
  const candidate = await createListeningSmartImportCandidate({
    part: 3, currentPart: part, basePartHash: 'hash', sources: roleSources, pastedText: '', images: roleSources.map(source => image(source.role)),
    analyzeVision: async () => ({ provider: 'openai', text: JSON.stringify({
      questionAnswers: answerLabels.map((label, index) => ({ label, region: rect(0.42, 0.05 + index * 0.12) })),
      questionPictures: Array.from({ length: 6 }, (_, index) => ({ side: index < 3 ? 'left' : 'right', row: index % 3 + 1, region: rect(index < 3 ? 0.05 : 0.75, 0.05 + index % 3 * 0.3) })),
      questionExample: { answerLabel: 'Thursday', pictureSide: 'left', pictureRow: 2, renderOverlayLine: false },
      answerKeyCells: [
        { answerLabel: 'Saturday', side: 'left', row: 1 }, { answerLabel: 'Tuesday', side: 'left', row: 3 },
        { answerLabel: 'Monday', side: 'right', row: 1 }, { answerLabel: 'Sunday', side: 'right', row: 2 },
        { answerLabel: 'Wednesday', side: 'right', row: 3 },
      ],
    }) }),
  });
  if (candidate.data.part !== 3) return;
  assert.equal(candidate.data.connections.length, 5);
  assert.equal(candidate.data.connections.some(connection => connection.answerLabel === 'Thursday'), false);
  assert.equal(candidate.data.distractorLabel, 'Friday');
});

test('Part 4 maps numbered A/B/C answers and rejects duplicate/out-of-range values without index collapse', async () => {
  const part = createDefaultMoverListeningContent().parts[3];
  const roleSources = sources('question', 'answer_key');
  const candidate = await createListeningSmartImportCandidate({
    part: 4, currentPart: part, basePartHash: 'hash', sources: roleSources, pastedText: '', images: roleSources.map(source => image(source.role)),
    analyzeVision: async () => ({ provider: 'gemini', text: JSON.stringify({
      example: { prompt: "Where is Pat's dad going?", answer: 'A', crops: [rect(), rect(0.3), rect(0.6)] },
      questions: [1, 2, 3, 4, 5].map(number => ({ questionNumber: number, prompt: `Question ${number}`, crops: [rect(), rect(0.3), rect(0.6)] })),
      answers: [{ questionNumber: 1, answer: 'A' }, { questionNumber: 2, answer: 'C' }, { questionNumber: 3, answer: 'C' }, { questionNumber: 4, answer: 'B' }, { questionNumber: 5, answer: 'C' }],
    }) }),
  });
  if (candidate.data.part !== 4) return;
  assert.equal(candidate.data.example?.correctOptionIndex, 0);
  assert.deepEqual(candidate.data.questions.map(question => question.correctOptionIndex), [0, 2, 2, 1, 2]);

  const duplicate = await createListeningSmartImportCandidate({
    part: 4, currentPart: part, basePartHash: 'hash', sources: roleSources, pastedText: '', images: roleSources.map(source => image(source.role)),
    analyzeVision: async () => ({ provider: 'gemini', text: JSON.stringify({ questions: [1, 2, 3, 4, 5].map(number => ({ questionNumber: number, prompt: `Q${number}`, crops: [rect(), rect(.3), rect(.6)] })), answers: [{ questionNumber: 1, answer: 'A' }, { questionNumber: 2, answer: 'D' }, { questionNumber: 3, answer: 'B' }, { questionNumber: 3, answer: 'C' }, { questionNumber: 5, answer: 'A' }] }) }),
  });
  if (duplicate.data.part !== 4) return;
  assert.equal(duplicate.data.questions.find(question => question.questionNumber === 2)?.correctOptionIndex, undefined);
  assert.equal(duplicate.data.questions.find(question => question.questionNumber === 3)?.correctOptionIndex, undefined);
  assert.equal(duplicate.data.questions.find(question => question.questionNumber === 5)?.correctOptionIndex, 0);
});

test('Part 4 ordered fallback is used only with exactly five answers and explicit layout evidence', async () => {
  const part = createDefaultMoverListeningContent().parts[3];
  const roleSources = sources('question', 'answer_key');
  const candidate = await createListeningSmartImportCandidate({
    part: 4, currentPart: part, basePartHash: 'hash', sources: roleSources, pastedText: '', images: roleSources.map(source => image(source.role)),
    analyzeVision: async () => ({ provider: 'openai', text: JSON.stringify({ orderedFallbackEvidence: 'single-row', questions: [1, 2, 3, 4, 5].map(number => ({ questionNumber: number, prompt: `Q${number}`, crops: [rect(), rect(.3), rect(.6)] })), answers: ['A', 'C', 'C', 'B', 'C'] }) }),
  });
  if (candidate.data.part !== 4) return;
  assert.deepEqual(candidate.data.questions.map(question => question.correctOptionIndex), [0, 2, 2, 1, 2]);
  assert.match(candidate.warnings.join(' '), /ordered fallback/i);
});

test('Part 5 preserves variable action counts, leaves missing geometry unresolved, and requests palette distractors', async () => {
  const part = createDefaultMoverListeningContent().parts[4];
  const roleSources = sources('question', 'answer_key', 'position_key');
  const candidate = await createListeningSmartImportCandidate({
    part: 5, currentPart: part, basePartHash: 'hash', sources: roleSources, pastedText: '', images: roleSources.map(source => image(source.role)),
    analyzeVision: async () => ({ provider: 'openai', text: JSON.stringify({
      questionScene: { shape: 'rect', x: 0, y: 0, width: 1, height: 1 }, positionScene: { shape: 'rect', x: 0, y: 0, width: 1, height: 1 },
      interactiveObjects: [{ label: 'hat', geometry: rect(), confidence: .9 }, { label: 'tree', geometry: rect(.3), confidence: .9 }],
      paletteItems: [{ objectType: 'star', label: 'yellow star', color: 'Yellow' }],
      questions: [
        { questionNumber: 1, prompt: 'Q1', actions: [{ type: 'colour_object', objectLabel: 'hat', correctColor: 'Red' }, { type: 'place_object', objectType: 'star', color: 'Yellow', targetRegion: rect(.5), relationLabel: 'on the tree' }] },
        { questionNumber: 2, prompt: 'Q2', actions: [{ type: 'colour_object', objectLabel: 'tree', correctColor: 'Green' }] },
        { questionNumber: 3, prompt: 'Q3', actions: [] }, { questionNumber: 4, prompt: 'Q4', actions: [{ type: 'place_object', objectType: 'circle' }] }, { questionNumber: 5, prompt: 'Q5', actions: [{ type: 'colour_object', objectLabel: 'hat', correctColor: 'Blue' }] },
      ],
    }) }),
  });
  if (candidate.data.part !== 5) return;
  assert.deepEqual(candidate.data.questions.map(question => question.actions.length), [2, 1, 0, 1, 1]);
  const unresolved = candidate.data.questions[3].actions[0];
  assert.equal(unresolved.type, 'place_object');
  if (unresolved.type === 'place_object') assert.equal(unresolved.targetRegion, undefined);
  assert.match(candidate.warnings.join(' '), /distractor|target region|palette/i);
});

test('malformed provider output is rejected instead of becoming plausible data', async () => {
  const part = createDefaultMoverListeningContent().parts[3];
  await assert.rejects(() => createListeningSmartImportCandidate({ part: 4, currentPart: part, basePartHash: 'hash', sources: sources('question', 'answer_key'), pastedText: '', images: [image('question'), image('answer_key')], analyzeVision: async () => ({ provider: 'gemini', text: 'not-json' }) }), /JSON/);
});
