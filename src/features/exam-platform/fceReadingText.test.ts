import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultExamContent, getExamPaperDefinition } from './definitions';
import {
  FCE_READING_PART3_PASSAGE_MAX_LENGTH,
  normalizeFixedFceReadingContent,
  parseFceReadingPart3Passage,
} from './fceReadingMigration';
import { importUniversalExamBundle, importUniversalExamPart } from './universalImport';
import { buildUniversalExamImportPrompt, buildUniversalExamPartImportPrompt } from './universalImportPrompt';
import type { ExamAnswers } from './types';
import {
  normalizeExamSmartImportPart,
  sanitizeExamContentForStudent,
  validateExamPaperContent,
} from '../../server/exam-platform/examValidation';
import { gradeExamAttempt } from '../../server/exam-platform/examGrader';

type JsonRow = Record<string, unknown>;
const row = (value: unknown): JsonRow => {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value));
  return value as JsonRow;
};
const draft = () => createDefaultExamContent(getExamPaperDefinition('fce', 'reading')!);
const sourceText = 'People and their hobbies\n\nA — Anna\nI enjoy reading after school.\n\nB — Ben\nI prefer outdoor activities.\n\nC — Clara\nI read about other countries.\n\nD — Daniel\nI enjoy reading too, but I rarely have time.';

/** Extract the actual JSON contract printed by the copy-prompt action. */
function sampleBundle(prompt: string): JsonRow {
  const start = prompt.indexOf('{\n  "format": "exam-bundle-import-v2"');
  assert.ok(start >= 0);
  let depth = 0, quoted = false, escaped = false;
  for (let index = start; index < prompt.length; index++) {
    const char = prompt[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === '{') depth++;
    else if (char === '}' && --depth === 0) return row(JSON.parse(prompt.slice(start, index + 1)));
  }
  throw new Error('Incomplete prompt JSON sample');
}

function parts(bundle: JsonRow): JsonRow[] {
  assert.ok(Array.isArray(bundle.papers));
  const value = row(bundle.papers[0]).parts;
  assert.ok(Array.isArray(value));
  return value.map(row);
}

function blockContent(part: JsonRow): JsonRow {
  assert.ok(Array.isArray(part.blocks));
  return row(row(part.blocks[0]).content);
}

function completeBundle() {
  const bundle = sampleBundle(buildUniversalExamImportPrompt(draft()));
  blockContent(parts(bundle)[2]).passage = sourceText;
  return bundle;
}

test('FCE whole/focused prompts request the complete A–D source text in passage while keeping source keys separate', () => {
  const current = draft();
  for (const prompt of [buildUniversalExamImportPrompt(current), buildUniversalExamPartImportPrompt(current, 2)]) {
    assert.match(prompt, /blocks\[0\]\.content\.passage phải chép đầy đủ/);
    assert.match(prompt, /không tóm tắt, dịch, viết lại/);
    assert.match(prompt, /không tự gắn ảnh nguồn làm ảnh hiển thị/);
    assert.match(prompt, /không có ảnh thì hiển thị passage/);
    assert.match(prompt, /ĐỊNH DẠNG PHẢN HỒI CÓ NÚT COPY/);
    const sample = sampleBundle(prompt);
    const third = parts(sample).find(part => part.partNumber === 3);
    assert.ok(third);
    const body = blockContent(third);
    assert.equal(typeof body.passage, 'string');
    for (const label of ['A', 'B', 'C', 'D']) assert.ok(String(body.passage).includes(`${label} — Person ${label}`));
    assert.ok(Array.isArray(body.questions));
    assert.equal(body.questions.length, 15);
    assert.ok(body.questions.every(value => Object.hasOwn(row(value), 'explanation')));
  }
});

test('FCE whole/focused text-only imports survive repeated normalization, validation and playable sanitization', () => {
  const current = draft(), before = structuredClone(current), bundle = completeBundle();
  const whole = importUniversalExamBundle(current, JSON.stringify(bundle)).content;
  const focused = importUniversalExamPart(current, 2, JSON.stringify(parts(bundle)[2]));
  assert.equal(whole.parts[2].passage, sourceText);
  assert.equal(focused.part.passage, sourceText);
  assert.equal(whole.parts[2].imageAssetId, undefined);
  assert.equal(whole.parts[2].interaction?.importReadiness, 'content-ready');
  assert.deepEqual(whole.parts.map(part => part.questions.length), [8, 7, 15]);
  assert.deepEqual(validateExamPaperContent(whole), []);
  assert.equal(normalizeFixedFceReadingContent(whole), whole);
  assert.deepEqual(current, before);
  const safe = sanitizeExamContentForStudent(whole);
  assert.equal(safe.parts[2].passage, sourceText);
  for (const question of safe.parts[2].questions) {
    assert.equal(Object.hasOwn(question, 'correctOptionIds'), false);
    assert.equal(Object.hasOwn(question, 'explanation'), false);
  }
  const answers: ExamAnswers = Object.fromEntries(whole.parts.flatMap(part => part.questions.map(question => [question.id, question.correctOptionIds[0]])));
  assert.equal(gradeExamAttempt(whole, answers).correctCount, 30);
});

test('FCE normalization lifts first-block text, preserves editing newlines and leaves legacy combined papers untouched', () => {
  const current = draft(), third = current.parts[2];
  third.blocks = [{ id: 'block-source', block: 1, title: 'People', instruction: '', passage: sourceText, interaction: third.interaction!, questionIds: third.questions.map(question => question.id) }];
  const normalized = normalizeFixedFceReadingContent(current);
  assert.equal(normalized.parts[2].passage, sourceText);
  assert.equal(normalized.parts[2].blocks, undefined);
  normalized.parts[2].passage = `${sourceText}\n\n`;
  assert.equal(normalizeFixedFceReadingContent(normalized).parts[2].passage, `${sourceText}\n\n`);
  const legacy = createDefaultExamContent(getExamPaperDefinition('fce', 'reading-use-of-english')!);
  legacy.parts[2].passage = 'Legacy source';
  assert.equal(normalizeFixedFceReadingContent(legacy), legacy);
});

test('FCE text imports preserve selected teacher images and old image-only JSON stays valid without inheriting stale text', () => {
  const current = draft(), bundle = completeBundle();
  current.parts[2].imageAssetId = 'teacher-owned-picture';
  current.parts[2].imageUrl = '/media/teacher-owned-picture.png';
  current.parts[2].passage = 'An older source';
  for (const third of [importUniversalExamBundle(current, JSON.stringify(bundle)).content.parts[2], importUniversalExamPart(current, 2, JSON.stringify(parts(bundle)[2])).part]) {
    assert.equal(third.passage, sourceText);
    assert.equal(third.imageAssetId, 'teacher-owned-picture');
    assert.equal(third.imageUrl, '/media/teacher-owned-picture.png');
  }
  delete blockContent(parts(bundle)[2]).passage;
  const legacyImport = importUniversalExamBundle(current, JSON.stringify(bundle)).content;
  assert.equal(legacyImport.parts[2].passage, undefined);
  assert.equal(legacyImport.parts[2].imageAssetId, 'teacher-owned-picture');
  assert.deepEqual(validateExamPaperContent(legacyImport), []);
});

test('FCE malformed passage imports fail atomically before coercion or truncation', () => {
  const current = draft(), before = structuredClone(current);
  for (const value of [null, 123, {}, ['A'], 'x'.repeat(FCE_READING_PART3_PASSAGE_MAX_LENGTH + 1), 'source\u0000text']) {
    const bundle = completeBundle(), third = parts(bundle)[2];
    blockContent(third).passage = value;
    assert.throws(() => importUniversalExamBundle(current, JSON.stringify(bundle)), /FCE Reading Part 3: passage/);
    assert.throws(() => importUniversalExamPart(current, 2, JSON.stringify(third)), /FCE Reading Part 3: passage/);
    assert.deepEqual(current, before);
  }
  for (const location of ['part', 'block'] as const) {
    const bundle = completeBundle(), third = parts(bundle)[2];
    if (location === 'part') third.passage = null;
    else { assert.ok(Array.isArray(third.blocks)); row(third.blocks[0]).passage = null; }
    assert.throws(() => importUniversalExamPart(current, 2, JSON.stringify(third)), /passage phải là văn bản/);
  }
  assert.equal(parseFceReadingPart3Passage('x'.repeat(FCE_READING_PART3_PASSAGE_MAX_LENGTH))?.length, FCE_READING_PART3_PASSAGE_MAX_LENGTH);
  assert.equal(parseFceReadingPart3Passage(undefined), undefined);
  assert.equal(parseFceReadingPart3Passage(' \n '), undefined);
});

test('FCE publish allows text, image or both and blocks empty or malformed source text', () => {
  const content = importUniversalExamBundle(draft(), JSON.stringify(completeBundle())).content;
  assert.deepEqual(validateExamPaperContent(content), []);
  const withImage = structuredClone(content);
  withImage.parts[2].imageAssetId = 'teacher-owned-picture';
  withImage.parts[2].imageUrl = '/media/teacher-owned-picture.png';
  assert.deepEqual(validateExamPaperContent(withImage), []);
  delete withImage.parts[2].passage;
  assert.deepEqual(validateExamPaperContent(withImage), []);
  const empty = structuredClone(content);
  delete empty.parts[2].passage;
  assert.ok(validateExamPaperContent(empty).some(error => /Part 3: cần văn bản hoặc ảnh/.test(error)));
  for (const value of [null, 5, {}, 'x'.repeat(FCE_READING_PART3_PASSAGE_MAX_LENGTH + 1), 'bad\u0000source']) {
    const malformed = structuredClone(withImage);
    Object.assign(malformed.parts[2], { passage: value });
    assert.ok(validateExamPaperContent(malformed).some(error => /Part 3: passage/.test(error)));
  }
});

test('server Smart Import validates Part3 passage before replacement and its text survives the FCE adapter', () => {
  const current = draft(), third = current.parts[2], definition = getExamPaperDefinition('fce', 'reading')!.parts[2];
  const candidate = {
    passage: sourceText,
    questions: third.questions.map(question => ({
      type: question.type, prompt: question.prompt,
      options: question.options.map(option => ({ label: option.label, text: option.text })),
      correctOptionLabels: ['A'], explanation: 'Giải thích chỉ có trong kết quả.',
    })),
  };
  const result = normalizeExamSmartImportPart(third, candidate, definition, current);
  assert.deepEqual(result.errors, []);
  assert.equal(normalizeFixedFceReadingContent({ ...current, parts: current.parts.map(part => part.part === 3 ? result.part : part) }).parts[2].passage, sourceText);
  for (const value of [null, {}, 'x'.repeat(FCE_READING_PART3_PASSAGE_MAX_LENGTH + 1)]) {
    const rejected = normalizeExamSmartImportPart(third, { ...candidate, passage: value }, definition, current);
    assert.equal(rejected.part, third);
    assert.ok(rejected.errors.some(error => /Part 3: passage/.test(error)));
  }
});
