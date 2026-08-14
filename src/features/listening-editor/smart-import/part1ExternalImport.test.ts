import assert from 'node:assert/strict';
import test from 'node:test';
import { importPart1Analysis } from '../../listening-library/modules/mover/editor/directImport';
import { createDefaultMoverListeningContent } from '../../listening-library/modules/mover/editor/moduleDefinition';
import { Part1ExternalImportError, parsePart1ExternalImport } from './part1ExternalImport';

const pixelPayload = () => ({
  schemaVersion: 'mover-part1-external-v1',
  part: 1,
  coordinateSpace: 'pixel',
  imageSize: { width: 628, height: 869 },
  people: [
    { name: 'Mary', point: { x: 527, y: 695 } },
    { name: 'Ben', point: { x: 436, y: 558 } },
    { name: 'Tom', point: { x: 402, y: 260 } },
    { name: 'Paul', point: { x: 281, y: 262 } },
    { name: 'Jane', point: { x: 272, y: 545 } },
    { name: 'Anna', point: { x: 123, y: 542 } },
    { name: 'Pat', point: { x: 503, y: 356 } },
  ],
  sample: { name: 'Mary' },
  answers: [
    { questionNumber: 3, name: 'Paul' },
    { questionNumber: 1, name: 'Ben' },
    { questionNumber: 5, name: 'Anna' },
    { questionNumber: 2, name: 'Tom' },
    { questionNumber: 4, name: 'Jane' },
  ],
  distractor: 'Pat',
});

test('Part 1 external pixel parameters use the real image dimensions, never an implicit 0-1000 scale', () => {
  const parsed = parsePart1ExternalImport(JSON.stringify(pixelPayload()), { assetWidth: 628, assetHeight: 869 });
  assert.deepEqual(parsed.data.choices, ['Ben', 'Tom', 'Paul', 'Jane', 'Anna', 'Pat']);
  assert.deepEqual(parsed.data.targetChoiceLabels, ['Ben', 'Tom', 'Paul', 'Jane', 'Anna']);
  assert.equal(parsed.data.example?.label, 'Mary');
  assert.equal(parsed.data.anchors.length, 5);
  const ben = parsed.data.anchors[0].region;
  assert.ok(Math.abs(ben.x + ben.width / 2 - 436 / 628) < 1e-10);
  assert.ok(Math.abs(ben.y + ben.height / 2 - 558 / 869) < 1e-10);
  assert.notEqual(ben.x + ben.width / 2, 0.436);
  assert.deepEqual(parsed.warnings, []);
});

test('Part 1 external parameters merge into the working draft while preserving application IDs', () => {
  const current = createDefaultMoverListeningContent().parts[0];
  assert.equal(current.part, 1);
  if (current.part !== 1) throw new Error('Expected Part 1 fixture');
  const choiceIds = current.choices.map(choice => choice.id);
  const targetIds = current.targets.map(target => target.id);
  const parsed = parsePart1ExternalImport(JSON.stringify(pixelPayload()), { assetWidth: 628, assetHeight: 869 });
  const imported = importPart1Analysis(current, parsed.data, 'question-image');

  assert.equal(imported.sceneAssetId, 'question-image');
  assert.deepEqual(imported.choices.map(choice => choice.id), choiceIds);
  assert.deepEqual(imported.targets.map(target => target.id), targetIds);
  assert.deepEqual(imported.choices.map(choice => choice.label), ['Ben', 'Tom', 'Paul', 'Jane', 'Anna', 'Pat']);
  assert.deepEqual(imported.targets.map(target => imported.choices.find(choice => choice.id === target.choiceId)?.label), ['Ben', 'Tom', 'Paul', 'Jane', 'Anna']);
  assert.equal(imported.example?.label, 'Mary');
  assert.equal(imported.choices.some(choice => choice.label === 'Mary'), false);
});

test('Part 1 external normalized parameters and fenced JSON remain supported', () => {
  const payload = pixelPayload();
  payload.coordinateSpace = 'normalized';
  payload.people = payload.people.map(person => ({
    ...person,
    point: { x: person.point.x / 628, y: person.point.y / 869 },
  }));
  const parsed = parsePart1ExternalImport(`\`\`\`json\n${JSON.stringify(payload)}\n\`\`\``);
  assert.equal(parsed.data.anchors[0].targetNumber, 1);
  assert.equal(parsed.data.anchors[4].targetNumber, 5);
});

test('Part 1 external import rejects an image-size mismatch before changing the draft', () => {
  assert.throws(
    () => parsePart1ExternalImport(JSON.stringify(pixelPayload()), { assetWidth: 1200, assetHeight: 1600 }),
    (reason: unknown) => reason instanceof Part1ExternalImportError
      && reason.details.some(detail => detail.includes('không khớp ảnh đề đã chọn')),
  );
});

test('Part 1 external import requires one sample, five unique answers and the set-difference distractor', () => {
  const payload = pixelPayload();
  payload.answers[4].name = 'Mary';
  payload.distractor = 'Anna';
  assert.throws(
    () => parsePart1ExternalImport(JSON.stringify(payload), { assetWidth: 628, assetHeight: 869 }),
    (reason: unknown) => reason instanceof Part1ExternalImportError
      && reason.details.some(detail => detail.includes('sample làm đáp án'))
      && reason.details.some(detail => detail.includes('đúng 1 tên nhiễu')),
  );
});

test('Part 1 external import rejects provider or database fields instead of accepting injected IDs', () => {
  const payload = { ...pixelPayload(), targetId: 'forbidden' };
  assert.throws(
    () => parsePart1ExternalImport(JSON.stringify(payload), { assetWidth: 628, assetHeight: 869 }),
    (reason: unknown) => reason instanceof Part1ExternalImportError
      && reason.details.some(detail => detail.includes('targetId')),
  );
});
