import assert from 'node:assert/strict';
import test from 'node:test';
import { moverListeningEditorDefinition } from './moduleDefinition';
import { DEFAULT_MOVER_COLOURS, MOVER_COLOUR_CATALOG } from './colourCatalog';
import { importPart1Analysis, importPart2Analysis, importPart3Analysis } from './directImport';

test('Mover editor registry exposes the five ordered part handlers', () => {
  assert.equal(moverListeningEditorDefinition.moduleId, 'mover');
  assert.deepEqual(
    moverListeningEditorDefinition.partHandlers.map(handler => handler.part),
    [1, 2, 3, 4, 5]
  );
});

test('Mover editor creates an isolated schema-v1 draft with the legacy 5-part shape', () => {
  const first = moverListeningEditorDefinition.createDefaultDraft();
  const second = moverListeningEditorDefinition.createDefaultDraft();

  assert.equal(first.moduleId, 'mover');
  assert.equal(first.schemaVersion, 1);
  assert.deepEqual(first.parts.map(part => part.part), [1, 2, 3, 4, 5]);
  assert.equal(first.parts[0].choices.length, 6);
  assert.equal(first.parts[0].targets.length, 5);
  assert.equal(first.parts[1].questions.length, 5);
  assert.equal(first.parts[2].items.length, 5);
  assert.equal(first.parts[3].questions.length, 5);
  assert.equal(first.parts[4].colours.length, 6);
  assert.equal(first.parts[4].targets.length, 5);
  assert.notEqual(first.parts[0].choices[0].id, second.parts[0].choices[0].id);
});

test('each part handler accepts its matching default part', () => {
  const draft = moverListeningEditorDefinition.createDefaultDraft();
  moverListeningEditorDefinition.partHandlers.forEach((handler, index) => {
    assert.deepEqual(handler.validateLocal(draft.parts[index] as never), []);
  });
});

test('Part 5 exposes exactly the confirmed 20-colour English catalog', () => {
  assert.equal(MOVER_COLOUR_CATALOG.length, 20);
  assert.equal(new Set(MOVER_COLOUR_CATALOG.map(colour => colour.label)).size, 20);
  assert.deepEqual(DEFAULT_MOVER_COLOURS, ['Red', 'Purple', 'Orange', 'Blue', 'Green', 'Yellow']);
  assert.deepEqual(
    moverListeningEditorDefinition.createDefaultDraft().parts[4].colours.map(colour => colour.label),
    [...DEFAULT_MOVER_COLOURS]
  );
  assert.ok(moverListeningEditorDefinition.createDefaultDraft().parts[4].targets.every(target => (
    target.region.width === 0.12 && target.region.height === 0.11
  )));
});

test('Part 1 analysis imports directly into editable choices, mappings and regions', () => {
  const part = moverListeningEditorDefinition.createDefaultDraft().parts[0];
  const imported = importPart1Analysis(part, {
    part: 1,
    choices: ['Fred', 'Daisy', 'John', 'Sally', 'Paul', 'Jill'],
    anchors: part.targets.map((target, index) => ({
      label: `person-${index + 1}`,
      confidence: 0.9,
      region: { ...target.region, x: 0.1 * index },
    })),
    provisionalChoiceIndexes: [4, 2, 5, 1, 0],
  }, 'scene-from-analysis');

  assert.equal(imported.sceneAssetId, 'scene-from-analysis');
  assert.deepEqual(imported.choices.map(choice => choice.label), ['Fred', 'Daisy', 'John', 'Sally', 'Paul', 'Jill']);
  assert.deepEqual(imported.targets.map(target => target.choiceId), [
    part.choices[4].id,
    part.choices[2].id,
    part.choices[5].id,
    part.choices[1].id,
    part.choices[0].id,
  ]);
  assert.ok(Math.abs(imported.targets[3].region.x - 0.3) < Number.EPSILON * 2);
  assert.notEqual(imported, part);
});

test('Part 2 analysis imports text and answers while preserving editable blank IDs', () => {
  const part = moverListeningEditorDefinition.createDefaultDraft().parts[1];
  const imported = importPart2Analysis(part, {
    part: 2,
    heading: 'ABC',
    exampleText: 'Name: Jill Walker',
    questions: Array.from({ length: 5 }, (_, index) => ({
      prompt: `${index + 1}. Prompt {{blank}}`,
      acceptedAnswers: index === 1 ? ['four b', '4b'] : [`answer-${index + 1}`],
    })),
  });

  assert.equal(imported.heading, 'ABC');
  assert.equal(imported.exampleText, 'Name: Jill Walker');
  assert.ok(imported.questions[0].prompt.includes(`{{${part.questions[0].blanks[0].id}}}`));
  assert.deepEqual(imported.questions[1].blanks[0].acceptedAnswers, ['four b', '4b']);
  assert.equal(part.heading, 'Listening notes');
});

test('Part 3 analysis imports the composite board and labels directly while preserving answers', () => {
  const part = moverListeningEditorDefinition.createDefaultDraft().parts[2];
  const originalAnswers = part.items.map(item => item.correctOptionId);
  const imported = importPart3Analysis(part, {
    part: 3,
    boardAssetId: 'part3-board',
    labels: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  });

  assert.equal(imported.displayMode, 'composite');
  assert.equal(imported.boardAssetId, 'part3-board');
  assert.equal(imported.reuseMode, 'once');
  assert.deepEqual(imported.options.map(option => option.label), ['A', 'B', 'C', 'D', 'E', 'F']);
  assert.deepEqual(imported.items.map(item => item.label), ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']);
  assert.deepEqual(imported.items.map(item => item.correctOptionId), originalAnswers);
  assert.notEqual(imported, part);
});
