import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultMoverReadingWritingContent } from '../defaultContent';
import {
  moverReadingWritingExternalTemplate,
  parseMoverReadingWritingExternalImport,
} from './contracts';
import { mergeMoverReadingWritingSmartImport } from './merge';
import { getMoverReadingWritingSmartImportRoleDefinitions } from './types';

test('all six external Smart Import contracts accept their versioned templates', () => {
  for (const part of [1, 2, 3, 4, 5, 6] as const) {
    const parsed = parseMoverReadingWritingExternalImport(part, moverReadingWritingExternalTemplate(part));
    assert.equal(parsed.data.part, part);
  }
});

test('external Smart Import rejects technical IDs, unknown fields and unsafe markers', () => {
  const part1 = JSON.parse(moverReadingWritingExternalTemplate(1));
  part1.questions[0].questionId = 'technical-id';
  assert.throws(() => parseMoverReadingWritingExternalImport(1, JSON.stringify(part1)), /không được hỗ trợ|ID kỹ thuật/);

  const part1MissingMarker = JSON.parse(moverReadingWritingExternalTemplate(1));
  part1MissingMarker.questions[0].promptTemplate = 'A definition without an answer line.';
  assert.throws(() => parseMoverReadingWritingExternalImport(1, JSON.stringify(part1MissingMarker)), /marker/);

  const part4 = JSON.parse(moverReadingWritingExternalTemplate(4));
  part4.storyTemplate = 'Missing final marker [[1]] [[2]] [[3]] [[4]] [[5]]';
  assert.throws(() => parseMoverReadingWritingExternalImport(4, JSON.stringify(part4)), /marker/);

  const part6 = JSON.parse(moverReadingWritingExternalTemplate(6));
  part6.questions[0].options.pop();
  assert.throws(() => parseMoverReadingWritingExternalImport(6, JSON.stringify(part6)), /ba lựa chọn/);

  const part5WrongMarker = JSON.parse(moverReadingWritingExternalTemplate(5));
  part5WrongMarker.scenes[0].questions[0].promptTemplate = 'Wrong marker [[10]]';
  assert.throws(() => parseMoverReadingWritingExternalImport(5, JSON.stringify(part5WrongMarker)), /marker/);
});

test('merge changes only the selected Part and preserves application IDs', () => {
  const content = createDefaultMoverReadingWritingContent();
  const beforeSiblings = JSON.stringify(content.parts.slice(1));
  const questionIds = content.parts[0].questions.map(question => question.id);
  const payload = JSON.parse(moverReadingWritingExternalTemplate(1));
  payload.questions.forEach((question: any, index: number) => {
    question.promptTemplate = `Imported prompt ${index + 1} [[${index + 1}]]`;
    question.acceptedAnswers = [`answer ${index + 1}`];
  });
  const { data } = parseMoverReadingWritingExternalImport(1, JSON.stringify(payload));
  content.parts[0] = mergeMoverReadingWritingSmartImport(content.parts[0], data) as typeof content.parts[0];
  assert.deepEqual(content.parts[0].questions.map(question => question.id), questionIds);
  assert.equal(content.parts[0].questions[0].prompt, `Imported prompt 1 {{${questionIds[0]}}}`);
  assert.equal(JSON.stringify(content.parts.slice(1)), beforeSiblings);
});

test('Part 4 public markers map to existing private gap IDs', () => {
  const content = createDefaultMoverReadingWritingContent();
  const payload = JSON.parse(moverReadingWritingExternalTemplate(4));
  const { data } = parseMoverReadingWritingExternalImport(4, JSON.stringify(payload));
  const merged = mergeMoverReadingWritingSmartImport(content.parts[3], data) as typeof content.parts[3];
  merged.gaps.forEach(gap => assert.ok(merged.storyTemplate.includes(`{{${gap.id}}}`)));
  assert.equal(merged.storyTemplate.includes('[['), false);
});

test('Part 6 extracts three choices and maps correctOption only from the official answer key', () => {
  const payload = JSON.parse(moverReadingWritingExternalTemplate(6));
  payload.questions.forEach((question: any, index: number) => {
    question.options = [`A${index + 1}`, `B${index + 1}`, `C${index + 1}`];
    question.correctOption = index % 2 ? 'C' : 'B';
  });

  const parsed = parseMoverReadingWritingExternalImport(6, JSON.stringify(payload));
  assert.equal(parsed.data.part, 6);
  assert.deepEqual(parsed.data.questions[0].options, ['A1', 'B1', 'C1']);
  assert.deepEqual(parsed.data.questions.map(question => question.correctOption), ['B', 'C', 'B', 'C', 'B']);
  assert.doesNotMatch(parsed.warnings.join('\n'), /A\/B\/C rõ ràng/);
});

test('Part 6 warns and preserves the current key when the official answer is unreadable', () => {
  const payload = JSON.parse(moverReadingWritingExternalTemplate(6));
  payload.questions[0].correctOption = 'unknown';
  const parsed = parseMoverReadingWritingExternalImport(6, JSON.stringify(payload));
  assert.equal(parsed.data.part, 6);
  assert.equal(parsed.data.questions[0].correctOption, undefined);
  assert.match(parsed.warnings.join('\n'), /A\/B\/C rõ ràng/);

  const content = createDefaultMoverReadingWritingContent();
  content.parts[5].questions[0].correctOptionId = content.parts[5].questions[0].options[2].id;
  const merged = mergeMoverReadingWritingSmartImport(content.parts[5], parsed.data) as typeof content.parts[5];
  assert.equal(merged.questions[0].correctOptionId, content.parts[5].questions[0].options[2].id);
});

test('Part 5/6 reuse persisted student images while answer keys remain transient', () => {
  const part5 = getMoverReadingWritingSmartImportRoleDefinitions(5);
  assert.deepEqual(part5.slice(0, 3).map(role => role.source), ['asset', 'asset', 'asset']);
  assert.equal(part5.find(role => role.role === 'answer_key')?.source, 'transient');

  const part6 = getMoverReadingWritingSmartImportRoleDefinitions(6);
  assert.equal(part6.find(role => role.role === 'passage'), undefined);
  assert.equal(part6.find(role => role.role === 'options')?.source, 'asset');
  assert.equal(part6.find(role => role.role === 'options')?.required, true);
  assert.equal(part6.find(role => role.role === 'answer_key')?.source, 'transient');
  assert.equal(part6.find(role => role.role === 'answer_key')?.required, true);
});
