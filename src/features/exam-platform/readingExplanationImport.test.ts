import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { createDefaultExamContent, EXAM_PAPER_DEFINITIONS, getExamPaperDefinition } from './definitions';
import { importUniversalExamBundle, importUniversalExamPart } from './universalImport';
import { buildUniversalExamImportPrompt, buildUniversalExamPartImportPrompt } from './universalImportPrompt';
import { isReadingExplanationQuestion, supportsReadingExplanations } from './readingExplanations';
import type { ExamPaperContent } from './types';

type JsonRow = Record<string, unknown>;
const scoped = [
  ['ket', 'reading-writing'], ['pet', 'reading'], ['fce', 'reading'],
  ['fce', 'reading-use-of-english'], ['ielts', 'academic-reading'],
] as const;
const draft = (moduleId: typeof scoped[number][0], paperId: typeof scoped[number][1]) => createDefaultExamContent(getExamPaperDefinition(moduleId, paperId)!);
const record = (value: unknown): JsonRow => {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value));
  return value as JsonRow;
};

/** Read the actual envelope printed in each prompt, including the generic fallback. */
function sampleBundle(prompt: string): JsonRow {
  const start = prompt.indexOf('{\n  "format": "exam-bundle-import-v2"');
  assert.ok(start >= 0, 'The prompt contains its full import envelope');
  let depth = 0, quoted = false, escaped = false;
  for (let index = start; index < prompt.length; index++) {
    const char = prompt[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === '{') depth++;
    else if (char === '}' && --depth === 0) return record(JSON.parse(prompt.slice(start, index + 1)));
  }
  throw new Error('The sample envelope is incomplete');
}

function questionsIn(value: unknown): JsonRow[] {
  if (Array.isArray(value)) return value.flatMap(questionsIn);
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) => key === 'questions' && Array.isArray(child)
    ? child.map(record)
    : questionsIn(child));
}

function partsIn(bundle: JsonRow): JsonRow[] {
  assert.ok(Array.isArray(bundle.papers));
  const parts = record(bundle.papers[0]).parts;
  assert.ok(Array.isArray(parts));
  return parts.map(record);
}

function filledSample(content: ExamPaperContent) {
  const sample = sampleBundle(buildUniversalExamImportPrompt(content));
  questionsIn(sample).forEach((question, index) => {
    if (question.type !== 'long-writing' && question.type !== 'scene-draw') question.explanation = `  Dẫn chứng của câu ${index + 1}.\r\nGiải thích cách chọn đáp án.  `;
  });
  return sample;
}

test('all Reading prompt branches include AI-authored explanations in whole and focused JSON samples', () => {
  for (const [moduleId, paperId] of scoped) {
    const content = draft(moduleId, paperId);
    for (const [index, prompt] of [buildUniversalExamImportPrompt(content), ...content.parts.map((_, partIndex) => buildUniversalExamPartImportPrompt(content, partIndex))].entries()) {
      const partIndex = index - 1;
      const eligible = partIndex < 0 || content.parts[partIndex].questions.some(question => isReadingExplanationQuestion(content, question));
      if (!eligible) {
        assert.doesNotMatch(prompt, /GIẢI THÍCH ĐÁP ÁN READING|"explanation"/);
        continue;
      }
      assert.match(prompt, /Tài liệu nguồn không có lời giải vẫn phải tự viết explanation/);
      assert.match(prompt, /2–4 câu/);
      assert.match(prompt, /Không đổi answerSource hoặc sửa khóa đáp án/);
      assert.match(prompt, /ĐỊNH DẠNG PHẢN HỒI CÓ NÚT COPY/);
      const sample = sampleBundle(prompt);
      for (const question of questionsIn(sample)) {
        assert.equal(Object.hasOwn(question, 'explanation'), question.type !== 'long-writing' && question.type !== 'scene-draw');
      }
    }
  }
});

test('Reading whole/Part imports preserve explanations through fixed and generic adapters without rewriting current drafts', () => {
  for (const [moduleId, paperId] of scoped) {
    const current = draft(moduleId, paperId), sample = filledSample(current);
    current.parts[0].questions[0].imageAssetId = 'teacher-owned-question-image';
    const before = structuredClone(current);
    const imported = importUniversalExamBundle(current, JSON.stringify(sample)).content;
    const eligible = imported.parts.flatMap(part => part.questions).filter(question => isReadingExplanationQuestion(imported, question));
    assert.ok(eligible.length > 0);
    assert.ok(eligible.every(question => /^Dẫn chứng của câu \d+\.\nGiải thích cách chọn đáp án\.$/.test(question.explanation || '')));
    assert.ok(imported.parts.flatMap(part => part.questions).filter(question => question.type === 'long-writing').every(question => question.explanation === undefined));
    assert.equal(imported.parts[0].questions[0].id, current.parts[0].questions[0].id);
    assert.equal(imported.parts[0].questions[0].imageAssetId, 'teacher-owned-question-image');
    assert.deepEqual(current, before);
    const firstPart = partsIn(sample)[0];
    const partImport = importUniversalExamPart(imported, 0, JSON.stringify(firstPart)).part;
    assert.equal(partImport.questions[0].explanation, eligible[0].explanation);
    assert.equal(partImport.questions[0].id, imported.parts[0].questions[0].id);
    assert.deepEqual(current, before);
  }
});

test('replacement JSON without explanations remains valid and clears stale text only in the imported Reading Part', () => {
  const original = draft('ielts', 'academic-reading');
  const sample = filledSample(original);
  assert.ok(Array.isArray(sample.papers));
  record(sample.papers[0]).parts = [...partsIn(sample), { ...structuredClone(partsIn(sample)[0]), partNumber: 2 }];
  const current = importUniversalExamBundle(original, JSON.stringify(sample)).content;
  const secondPart = current.parts[1];
  current.parts[0].questions[0].explanation = 'Old explanation for a different question.';
  const target = partsIn(sample)[0];
  questionsIn(target).forEach(question => { delete question.explanation; });
  const before = structuredClone(current);
  const result = importUniversalExamPart(current, 0, JSON.stringify(target));
  assert.equal(result.part.questions[0].explanation, undefined);
  assert.ok(result.report.warnings.some(warning => warning.includes('đã bỏ giải thích cũ')));
  assert.deepEqual(current, before);
  assert.equal(current.parts[1], secondPart);
  assert.ok(secondPart.questions[0].explanation);
  questionsIn(sample).forEach(question => { delete question.explanation; });
  assert.ok(importUniversalExamBundle(original, JSON.stringify(sample)).content.parts.every(part => part.questions.every(question => question.explanation === undefined)));
});

test('malformed explanation input rejects the import atomically instead of coercing or silently truncating it', () => {
  for (const [moduleId, paperId] of scoped) {
    const current = draft(moduleId, paperId);
    const before = structuredClone(current);
    for (const value of [null, 123, {}, ['reason'], 'x'.repeat(4_001)]) {
      const sample = filledSample(current);
      questionsIn(sample)[0].explanation = value;
      assert.throws(() => importUniversalExamBundle(current, JSON.stringify(sample)), /Giải thích đáp án/);
      assert.throws(() => importUniversalExamPart(current, 0, JSON.stringify(partsIn(sample)[0])), /Giải thích đáp án/);
      assert.deepEqual(current, before);
    }
    const empty = filledSample(current);
    questionsIn(empty)[0].explanation = ' \r\n ';
    const result = importUniversalExamPart(current, 0, JSON.stringify(partsIn(empty)[0]));
    assert.equal(result.part.questions[0].explanation, undefined);
    assert.ok(result.report.warnings.some(warning => warning.includes('giải thích đang trống')));
  }
});

test('Listening and Writing import pipelines keep ignoring unrecognized explanation fields', () => {
  for (const definition of EXAM_PAPER_DEFINITIONS.filter(item => ['ket', 'pet', 'fce', 'ielts'].includes(item.moduleId) && !supportsReadingExplanations(item))) {
    const current = createDefaultExamContent(definition);
    const sample = sampleBundle(buildUniversalExamImportPrompt(current));
    questionsIn(sample).forEach(question => { question.explanation = { unexpected: 'Must not activate Reading processing here' }; });
    const imported = importUniversalExamBundle(current, JSON.stringify(sample)).content;
    assert.ok(imported.parts.every(part => part.questions.every(question => question.explanation === undefined)));
  }
  const ket = draft('ket', 'reading-writing');
  const part9 = sampleBundle(buildUniversalExamPartImportPrompt(ket, 8));
  questionsIn(part9)[0].explanation = { unexpected: 'Writing remains unchanged' };
  assert.equal(importUniversalExamPart(ket, 8, JSON.stringify(part9)).part.questions[0].explanation, undefined);
});

test('non-Reading whole/Part prompt outputs remain byte-identical to the pre-upgrade pipeline', () => {
  // SHA256 of all whole-paper and Part prompt strings captured before this upgrade.
  const hashes: Record<string, string> = {
    'writing:writing': '7b54502a7f3fd309dafa5935f45d41516bd2dd49ce2b3545ac541f03a674ae8c',
    'starter:listening': '2c26fd6c515ddfded70a7b340874f3139f66bb0b14dde4e16ca14d9fb3ab03f5',
    'starter:reading-writing': 'bd78baf1d6ea7017d1dbd4f74f0c8f62a25004ba308050cb4c06f8445135b0d7',
    'flyer:listening': 'f4f384b74ae0672593e2972eff042c68f1028b4acf067372b9dbd08941336bf6',
    'flyer:reading-writing': '2c825568fdb967a927c2cc90d623f8c36dd9b3a36d15a29e0abc689c2ccd09a7',
    'ket:listening': 'f80ae14879a8d6546b5efa5a7f6e11a532139b609e4b22757dd1299262fccd46',
    'pet:writing': 'bbefd59eadba80cbdfe6e62730686360ae1eccf21182e418b50e9fcfd3c2d509',
    'pet:listening': '7baa23c6ce558b1e2b749d2fca3eac67f6801cd0af64b24e2bdf1cfe7df44694',
    'fce:writing': 'ca225599bc23d2704c5fb1a9537f4e1a591a34f31e69f1d78596ca4b96c8e06b',
    'fce:listening': '0c77aea2c7fdd62203ef5dd81d66c19aae1c883b661fcbddb1f851b187a01c2f',
    'ielts:listening': 'a85cc347932c41d0d84be304b559657d2c7e72376d042404e0193402124c6bf1',
    'ielts:academic-writing': '041f501347af3151362222feff4cefe10a8a738d4df434080e79d5ffd08bcc63',
  };
  for (const definition of EXAM_PAPER_DEFINITIONS.filter(item => !supportsReadingExplanations(item))) {
    const content = createDefaultExamContent(definition);
    const prompts = [buildUniversalExamImportPrompt(content), ...content.parts.map((_, index) => buildUniversalExamPartImportPrompt(content, index))];
    assert.equal(createHash('sha256').update(JSON.stringify(prompts)).digest('hex'), hashes[`${definition.moduleId}:${definition.paperId}`]);
  }
  assert.equal(createHash('sha256').update(buildUniversalExamPartImportPrompt(draft('ket', 'reading-writing'), 8)).digest('hex'), '877d5390f0af7cefe37fe67b7dfc556798bd31da8b4abc61ffe21d6bfccf0318');
});
