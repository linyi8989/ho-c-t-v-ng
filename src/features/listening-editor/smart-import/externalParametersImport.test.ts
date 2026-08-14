import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultMoverListeningContent } from '../../listening-library/modules/mover/editor/moduleDefinition';
import {
  applyPart3ConnectAnalysis,
  applyPart4Analysis,
  applyPart5SceneAnalysis,
  importPart2Analysis,
} from '../../listening-library/modules/mover/editor/directImport';
import {
  ExternalParametersImportError,
  externalParametersTemplate,
  parseExternalParametersImport,
} from './externalParametersImport';

test('Part 2 external parameters preserve IDs, variants and the manual crop handoff', () => {
  const current = createDefaultMoverListeningContent().parts[1];
  assert.equal(current.part, 2);
  if (current.part !== 2) throw new Error('Expected Part 2 fixture');
  const payload = JSON.parse(externalParametersTemplate(2));
  payload.questions[0].acceptedAnswers = ['Main', 'Main Street'];
  const parsed = parseExternalParametersImport(2, JSON.stringify(payload), { currentPart: current });
  assert.equal(parsed.data.illustrationCrop, undefined);
  const imported = importPart2Analysis(current, parsed.data);
  assert.deepEqual(imported.questions.map(question => question.id), current.questions.map(question => question.id));
  assert.deepEqual(imported.questions[0].blanks[0].acceptedAnswers, ['Main', 'Main Street']);
  assert.match(imported.questions[0].prompt, /\{\{blank-/);
  assert.doesNotMatch(imported.questions[0].prompt, /\{\{blank\}\}/);
});

test('Part 3 external parameters validate example, five mappings and one distractor without exposing anchor offsets', () => {
  const current = createDefaultMoverListeningContent().parts[2];
  assert.equal(current.part, 3);
  if (current.part !== 3) throw new Error('Expected Part 3 fixture');
  const parsed = parseExternalParametersImport(3, externalParametersTemplate(3), { currentPart: current });
  assert.equal(parsed.data.answers.length, 7);
  assert.equal(parsed.data.pictures.length, 6);
  assert.equal(parsed.data.connections.length, 5);
  assert.equal(parsed.data.example?.answerLabel, 'Thursday');
  assert.equal(parsed.data.distractorLabel, 'Friday');
  assert.ok(parsed.data.answers.every(answer => answer.leftAnchorOffset === 0.5 && answer.rightAnchorOffset === 0.5));
  const imported = applyPart3ConnectAnalysis(current, parsed.data, 'part3-question');
  assert.equal(imported.boardAssetId, 'part3-question');
  assert.equal(imported.correctConnections.length, 5);
  assert.equal(imported.exampleConnection.renderOverlayLine, false);
});

test('Part 3 external re-import keeps matching draft geometry when JSON omits regions', () => {
  const current = createDefaultMoverListeningContent().parts[2];
  assert.equal(current.part, 3);
  if (current.part !== 3) throw new Error('Expected Part 3 fixture');
  const first = parseExternalParametersImport(3, externalParametersTemplate(3), { currentPart: current });
  const connected = applyPart3ConnectAnalysis(current, first.data, 'part3-question');
  const payload = JSON.parse(externalParametersTemplate(3));
  payload.answers.forEach((answer: Record<string, unknown>) => delete answer.region);
  payload.pictures.forEach((picture: Record<string, unknown>) => delete picture.region);
  const reparsed = parseExternalParametersImport(3, JSON.stringify(payload), { currentPart: connected });
  assert.deepEqual(reparsed.data.answers.map(answer => answer.region), connected.answers.map(answer => answer.region));
  assert.deepEqual(reparsed.data.pictures.map(picture => picture.region), connected.pictures.map(picture => picture.region));
  assert.ok(reparsed.warnings.some(warning => warning.includes('giữ region draft hiện tại')));
});

test('Part 4 external parameters map A/B/C while leaving all crops to frame detection', () => {
  const current = createDefaultMoverListeningContent().parts[3];
  assert.equal(current.part, 4);
  if (current.part !== 4) throw new Error('Expected Part 4 fixture');
  const parsed = parseExternalParametersImport(4, externalParametersTemplate(4), { currentPart: current });
  assert.deepEqual(parsed.data.questions.map(question => question.crops), [[], [], [], [], []]);
  assert.deepEqual(parsed.data.questions.map(question => question.correctOptionIndex), [0, 2, 2, 1, 2]);
  const optionAssets = Array.from({ length: 5 }, (_, question) => Array.from({ length: 3 }, (_, option) => `q${question + 1}-${option}`));
  const imported = applyPart4Analysis(current, parsed.data, optionAssets, ['example-a', 'example-b', 'example-c']);
  assert.deepEqual(imported.questions.map(question => question.id), current.questions.map(question => question.id));
  assert.equal(imported.questions[1].correctOptionId, current.questions[1].options[2].id);
  assert.equal(imported.questions[3].options[1].imageAssetId, 'q4-1');
});

test('Part 5 external parameters import logical Colour/Draw data but never create Colour geometry from JSON', () => {
  const current = createDefaultMoverListeningContent().parts[4];
  assert.equal(current.part, 5);
  if (current.part !== 5) throw new Error('Expected Part 5 fixture');
  const parsed = parseExternalParametersImport(5, externalParametersTemplate(5), { currentPart: current });
  const colourActions = parsed.data.questions.flatMap(question => question.actions.filter(action => action.type === 'colour_object'));
  const drawActions = parsed.data.questions.flatMap(question => question.actions.filter(action => action.type === 'place_object'));
  assert.equal(colourActions.length, 4);
  assert.equal(drawActions.length, 2);
  assert.ok(drawActions.every(action => action.type === 'place_object' && action.targetRegion === undefined));
  assert.ok(parsed.warnings.some(warning => warning.includes('chưa có vùng Draw')));
  const imported = applyPart5SceneAnalysis(current, parsed.data, 'part5-question');
  assert.equal(imported.sceneAssetId, 'part5-question');
  assert.equal(imported.questions.length, 5);
  assert.equal(imported.interactiveObjects.length >= 4, true);
  assert.ok(imported.interactiveObjects.every(object => object.geometryConfirmedByTeacher === false));
  assert.equal(imported.objectPalette.length, 3);
});

test('external parameter parsers reject technical ID injection for Parts 2-5', () => {
  ([2, 3, 4, 5] as const).forEach(part => {
    const payload = JSON.parse(externalParametersTemplate(part));
    payload.databaseId = 'provider-controlled-id';
    assert.throws(
      () => parseExternalParametersImport(part, JSON.stringify(payload)),
      (reason: unknown) => reason instanceof ExternalParametersImportError
        && reason.details.some(detail => detail.includes('databaseId')),
    );
  });
});

test('Part 4 external parameters reject malformed answers instead of guessing', () => {
  const payload = JSON.parse(externalParametersTemplate(4));
  payload.questions[2].correctAnswer = 'D';
  assert.throws(
    () => parseExternalParametersImport(4, JSON.stringify(payload)),
    (reason: unknown) => reason instanceof ExternalParametersImportError
      && reason.details.some(detail => detail.includes('chỉ nhận A, B hoặc C')),
  );
});
