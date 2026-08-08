import assert from 'node:assert/strict';
import test from 'node:test';
import { moverListeningEditorDefinition } from './moduleDefinition';
import { MOVER_COLOUR_CATALOG } from './colourCatalog';
import { applyPart3ConnectAnalysis, applyPart4Analysis, applyPart5SceneAnalysis, importPart1Analysis, importPart2Analysis } from './directImport';

const region = (x = 0.1, y = 0.1) => ({ shape: 'rect' as const, x, y, width: 0.1, height: 0.08 });

test('Mover editor registry exposes the five ordered part handlers', () => {
  assert.equal(moverListeningEditorDefinition.moduleId, 'mover');
  assert.deepEqual(moverListeningEditorDefinition.partHandlers.map(handler => handler.part), [1, 2, 3, 4, 5]);
});

test('new drafts use connect-image Part 3 and scene-colour-draw Part 5 without shared IDs', () => {
  const first = moverListeningEditorDefinition.createDefaultDraft();
  const second = moverListeningEditorDefinition.createDefaultDraft();
  assert.deepEqual(first.parts.map(part => part.part), [1, 2, 3, 4, 5]);
  assert.equal(first.parts[0].choices.length, 6);
  assert.equal(first.parts[1].questions.length, 5);
  assert.equal(first.parts[2].displayMode, 'connect-image');
  if (first.parts[2].displayMode !== 'connect-image') return;
  assert.equal(first.parts[2].answers.length, 7);
  assert.equal(first.parts[2].pictures.length, 6);
  assert.equal(first.parts[4].displayMode, 'scene-colour-draw');
  if (first.parts[4].displayMode !== 'scene-colour-draw') return;
  assert.equal(first.parts[4].questions.length, 5);
  assert.equal(first.parts[4].colours.length, 20);
  assert.notEqual(first.parts[0].choices[0].id, second.parts[0].choices[0].id);
});

test('each part handler accepts its matching editable default structure', () => {
  const draft = moverListeningEditorDefinition.createDefaultDraft();
  moverListeningEditorDefinition.partHandlers.forEach((handler, index) => {
    assert.deepEqual(handler.validateLocal(draft.parts[index] as never), []);
  });
});

test('Part 5 exposes the complete 20-colour English catalog', () => {
  const part5 = moverListeningEditorDefinition.createDefaultDraft().parts[4];
  assert.equal(MOVER_COLOUR_CATALOG.length, 20);
  assert.equal(new Set(MOVER_COLOUR_CATALOG.map(colour => colour.label)).size, 20);
  assert.deepEqual(part5.colours.map(colour => colour.label), MOVER_COLOUR_CATALOG.map(colour => colour.label));
});

test('Part 1 imports six non-example choices and maps labels while preserving application IDs', () => {
  const part = moverListeningEditorDefinition.createDefaultDraft().parts[0];
  const originalChoiceIds = part.choices.map(choice => choice.id);
  const imported = importPart1Analysis(part, {
    part: 1,
    choices: ['Daisy', 'John', 'Sally', 'Paul', 'Jill', 'Jane'],
    anchors: Array.from({ length: 5 }, (_, index) => ({ label: `person-${index + 1}`, confidence: 0.9, region: region(0.1 * index, 0.2) })),
    targetChoiceLabels: ['Paul', 'Sally', 'Jane', 'Daisy', 'John'],
    example: { label: 'Fred', region: region(0.2, 0.2) },
  }, 'question-image');
  assert.equal(imported.sceneAssetId, 'question-image');
  assert.deepEqual(imported.choices.map(choice => choice.id), originalChoiceIds);
  assert.deepEqual(imported.choices.map(choice => choice.label), ['Daisy', 'John', 'Sally', 'Paul', 'Jill', 'Jane']);
  assert.deepEqual(imported.targets.map(target => imported.choices.find(choice => choice.id === target.choiceId)?.label), ['Paul', 'Sally', 'Jane', 'Daisy', 'John']);
  assert.equal(imported.example?.label, 'Fred');
  assert.equal(imported.choices.some(choice => choice.label === 'Fred'), false);
});

test('Part 1 unresolved target number keeps its old region instead of collapsing later anchors', () => {
  const part = moverListeningEditorDefinition.createDefaultDraft().parts[0];
  const imported = importPart1Analysis(part, {
    part: 1,
    choices: part.choices.map((choice, index) => `Name ${index + 1}`),
    anchors: [
      { targetNumber: 1, label: 'one', confidence: .9, region: region(.11, .11) },
      { targetNumber: 3, label: 'three', confidence: .9, region: region(.33, .33) },
    ],
    targetChoiceLabels: Array.from({ length: 5 }),
  });
  assert.equal(imported.targets[1].region.x, part.targets[1].region.x);
  assert.equal(imported.targets[2].region.x, .33);
});

test('Part 2 maps by questionNumber and preserves exact single/multiple answer variants', () => {
  const part = moverListeningEditorDefinition.createDefaultDraft().parts[1];
  const imported = importPart2Analysis(part, {
    part: 2,
    heading: 'ABC',
    instruction: 'Listen and write.',
    exampleText: 'Name: Jill Walker',
    questions: [
      { questionNumber: 5, prompt: 'Pet: {{blank}}', acceptedAnswers: ['snake'] },
      { questionNumber: 2, prompt: 'Class number: {{blank}}', acceptedAnswers: ['4b'] },
      { questionNumber: 1, prompt: 'Lives at: {{blank}}', acceptedAnswers: ['Main'] },
      { questionNumber: 4, prompt: 'Likes reading: {{blank}}', acceptedAnswers: ['comics', 'comic books'] },
      { questionNumber: 3, prompt: 'Favourite sport: {{blank}}', acceptedAnswers: ['hockey'] },
    ],
  });
  assert.equal(imported.exampleText, 'Name: Jill Walker');
  assert.deepEqual(imported.questions[1].blanks[0].acceptedAnswers, ['4b']);
  assert.deepEqual(imported.questions[3].blanks[0].acceptedAnswers, ['comics', 'comic books']);
  assert.deepEqual(imported.questions.map(question => question.id), part.questions.map(question => question.id));
});

test('Part 3 applies side+row answer-key layout and keeps example separate', () => {
  const part = moverListeningEditorDefinition.createDefaultDraft().parts[2];
  const labels = ['Saturday', 'Monday', 'Thursday', 'Sunday', 'Tuesday', 'Wednesday', 'Friday'];
  const imported = applyPart3ConnectAnalysis(part, {
    part: 3,
    answers: labels.map((label, index) => ({ label, region: region(0.42, 0.05 + index * 0.12), leftAnchorOffset: 0.5, rightAnchorOffset: 0.5 })),
    pictures: Array.from({ length: 6 }, (_, index) => ({ label: `picture-${index + 1}`, side: index < 3 ? 'left' as const : 'right' as const, row: (index % 3 + 1) as 1 | 2 | 3, region: region(index < 3 ? 0.05 : 0.75, 0.05 + index % 3 * 0.3), anchorOffset: 0.5 })),
    example: { answerLabel: 'Thursday', pictureSide: 'left', pictureRow: 2, renderOverlayLine: false },
    connections: [
      { answerLabel: 'Saturday', pictureSide: 'left', pictureRow: 1 },
      { answerLabel: 'Monday', pictureSide: 'right', pictureRow: 1 },
      { answerLabel: 'Tuesday', pictureSide: 'left', pictureRow: 3 },
      { answerLabel: 'Wednesday', pictureSide: 'right', pictureRow: 2 },
      { answerLabel: 'Friday', pictureSide: 'right', pictureRow: 3 },
    ],
    distractorLabel: 'Sunday',
  }, 'question-image');
  assert.equal(imported.boardAssetId, 'question-image');
  assert.equal(imported.correctConnections.length, 5);
  assert.equal(imported.answers.find(answer => answer.id === imported.exampleConnection.answerId)?.label, 'Thursday');
  assert.equal(imported.pictures.find(picture => picture.id === imported.exampleConnection.pictureId)?.side, 'left');
  assert.equal(imported.pictures.find(picture => picture.id === imported.exampleConnection.pictureId)?.row, 2);
  assert.equal(imported.answers.find(answer => answer.id === imported.distractorAnswerId)?.label, 'Sunday');
  const reimported = applyPart3ConnectAnalysis(imported, {
    part: 3,
    answers: imported.answers.map(({ id: _id, ...answer }) => answer),
    pictures: imported.pictures.map(({ id: _id, ...picture }) => picture),
    example: { answerLabel: 'Thursday', pictureSide: 'left', pictureRow: 2, renderOverlayLine: false },
    connections: [
      { answerLabel: 'Saturday', pictureSide: 'left', pictureRow: 1 }, { answerLabel: 'Monday', pictureSide: 'right', pictureRow: 1 },
      { answerLabel: 'Tuesday', pictureSide: 'left', pictureRow: 3 }, { answerLabel: 'Wednesday', pictureSide: 'right', pictureRow: 2 },
      { answerLabel: 'Friday', pictureSide: 'right', pictureRow: 3 },
    ],
    distractorLabel: 'Sunday',
  }, 'question-image');
  assert.deepEqual(reimported.answers.map(answer => answer.id), imported.answers.map(answer => answer.id));
  assert.deepEqual(reimported.pictures.map(picture => picture.id), imported.pictures.map(picture => picture.id));
});

test('Part 4 maps numbered A/B/C indexes onto existing option IDs and creates an editable example', () => {
  const part = moverListeningEditorDefinition.createDefaultDraft().parts[3];
  const imported = applyPart4Analysis(part, {
    part: 4,
    example: { prompt: 'Example prompt', crops: [region(), region(.3), region(.6)], correctOptionIndex: 0 },
    questions: ([5, 2, 1, 4, 3] as const).map(questionNumber => ({
      questionNumber,
      prompt: `Question ${questionNumber}`,
      crops: [region(), region(.3), region(.6)],
      correctOptionIndex: ({ 1: 0, 2: 2, 3: 2, 4: 1, 5: 2 } as const)[questionNumber],
      answerSource: 'answer-key-numbered' as const,
    })),
  }, Array.from({ length: 5 }, (_, questionIndex) => Array.from({ length: 3 }, (_, optionIndex) => `asset-${questionIndex}-${optionIndex}`)), ['example-a', 'example-b', 'example-c']);
  assert.deepEqual(imported.questions.map(question => question.correctOptionId), [
    part.questions[0].options[0].id,
    part.questions[1].options[2].id,
    part.questions[2].options[2].id,
    part.questions[3].options[1].id,
    part.questions[4].options[2].id,
  ]);
  assert.deepEqual(imported.questions[2].options.map(option => option.imageAssetId), ['asset-2-0', 'asset-2-1', 'asset-2-2']);
  assert.deepEqual(imported.example?.options.map(option => option.imageAssetId), ['example-a', 'example-b', 'example-c']);
  assert.equal(imported.example?.correctOptionId, imported.example?.options[0].id);
});

test('Part 5 re-analysis retains old actions not matched with confidence', () => {
  const draftPart = moverListeningEditorDefinition.createDefaultDraft().parts[4];
  if (draftPart.displayMode !== 'scene-colour-draw') return;
  const objectId = 'existing-object';
  const old = { ...draftPart, interactiveObjects: [{ id: objectId, label: 'hat', geometry: region(), interactionKinds: ['colour'] as ['colour'] }], questions: draftPart.questions.map((question, index) => ({ ...question, actions: index === 0 ? [{ id: 'old-action', type: 'colour_object' as const, correctObjectId: objectId, correctColourId: draftPart.colours[0].id }] : [] })) };
  const imported = applyPart5SceneAnalysis(old, { part: 5, interactiveObjects: [], paletteItems: [], questions: ([1, 2, 3, 4, 5] as const).map(questionNumber => ({ questionNumber, staffPrompt: `Question ${questionNumber}`, actions: [] })) }, 'scene');
  assert.equal(imported.questions[0].actions.some(action => action.id === 'old-action'), true);
  assert.equal(imported.interactiveObjects.some(object => object.id === objectId), true);
});
