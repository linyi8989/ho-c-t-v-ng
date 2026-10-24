import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultExamContent, getExamPaperDefinition } from './definitions';
import { getKetListeningImageLayout, normalizeFixedKetListeningContent } from './ketListeningMigration';
import { importUniversalExamPart } from './universalImport';
import { buildUniversalExamImportPrompt, buildUniversalExamPartImportPrompt } from './universalImportPrompt';

const create = () => createDefaultExamContent(getExamPaperDefinition('ket', 'listening')!);
const choice = (questionNumber: number, imageLayout?: unknown) => ({
  questionNumber, prompt: `Printed picture question ${questionNumber}`,
  options: ['C', 'A', 'B'].map(label => ({ label, text: `Detailed scene ${label}` })),
  answerSource: 'official-answer-key', answerKey: { correctOptionLabels: ['B'] },
  ...(imageLayout === undefined ? {} : { imageLayout }),
});
const partOne = (questions: unknown[]) => ({
  partNumber: 1, title: 'Listen and choose', instruction: 'Choose A, B or C.',
  blocks: [{ blockNumber: 1, title: 'Picture choices', interaction: { family: 'choice', subtype: 'single', variant: 'image-options', schemaVersion: 1 }, content: {
    examples: [{ prompt: 'Where is the hat?', answer: 'B', options: [{ label: 'A', text: 'A hat on a hook.' }, { label: 'B', text: 'A hat on a bed.' }, { label: 'C', text: 'A hat on a table.' }] }], questions,
  } }],
});

test('KET Listening image layout follows explicit metadata or actual assets, independently of printed numbers', () => {
  const q = create().parts[0].questions[0];
  const printedThird = { ...q, displayNumber: 3 };
  assert.deepEqual(getKetListeningImageLayout(printedThird), { kind: 'options', optionLabels: ['A', 'B', 'C'] });
  const shared = { ...q, displayNumber: 9, imageAssetId: 'common-picture', options: q.options.map(option => ({ ...option, imageAssetId: `dormant-${option.label}` })) };
  assert.deepEqual(getKetListeningImageLayout(shared), { kind: 'shared' });
  assert.deepEqual(getKetListeningImageLayout({ ...shared, imageLayout: { kind: 'options', optionLabels: ['A', 'C'] } }), { kind: 'options', optionLabels: ['A', 'C'] });
  assert.deepEqual(getKetListeningImageLayout({ ...q, options: q.options.map(option => option.label === 'B' ? { ...option, imageUrl: '/media/b.png' } : option) }), { kind: 'options', optionLabels: ['B'] });
  assert.doesNotThrow(() => getKetListeningImageLayout({ ...q, imageLayout: { kind: 'options', optionLabels: [null, 3, {}] } as never }));
});

test('KET Listening normalization keeps all existing picture media including printed question 3', () => {
  const current = create();
  current.parts[0].questions.forEach((q, index) => {
    q.displayNumber = index + 1;
    if (index === 2) { q.imageAssetId = 'old-q3-common'; q.imageUrl = '/media/old-q3-common.png'; }
    q.options.forEach(option => { option.imageAssetId = `q${index}-${option.label}`; option.imageUrl = `/media/q${index}-${option.label}.png`; });
  });
  const before = structuredClone(current.parts[0].questions);
  const normalized = normalizeFixedKetListeningContent(current);
  assert.deepEqual(normalized.parts[0].questions.map(q => [q.imageAssetId, q.imageUrl, q.options.map(option => [option.id, option.imageAssetId, option.imageUrl])]), before.map(q => [q.imageAssetId, q.imageUrl, q.options.map(option => [option.id, option.imageAssetId, option.imageUrl])]));
  assert.deepEqual(getKetListeningImageLayout(normalized.parts[0].questions[2]), { kind: 'shared' });
  assert.equal(normalizeFixedKetListeningContent(normalized), normalized, 'Normalization is idempotent.');
});

test('KET Listening Part 1 import preserves option IDs/media by labels after reorder and stores dynamic layouts', () => {
  const current = create();
  const originalOtherParts = structuredClone(current.parts.slice(1));
  current.parts[0].questions[0].imageAssetId = 'retained-common';
  current.parts[0].questions[0].options.forEach(option => { option.imageAssetId = `retained-${option.label}`; option.imageUrl = `/media/${option.label}.png`; });
  current.parts[0].examples = [{ prompt: 'Old example', answer: 'A', options: ['A', 'B', 'C'].map(label => ({ label, text: `Old ${label}`, imageAssetId: `example-${label}` })) }];
  const source = partOne([choice(1, { kind: 'options', optionLabels: ['A', 'C'] }), choice(2, { kind: 'shared' }), choice(3, { kind: 'options', optionLabels: ['B'] })]);
  source.blocks[0].content.examples[0].options.reverse();
  const imported = importUniversalExamPart(current, 0, JSON.stringify(source)).part;
  assert.deepEqual(imported.questions.map(getKetListeningImageLayout), [{ kind: 'options', optionLabels: ['A', 'C'] }, { kind: 'shared' }, { kind: 'options', optionLabels: ['B'] }]);
  assert.deepEqual(imported.questions[0].options.map(option => option.label), ['A', 'B', 'C']);
  assert.equal(imported.questions[0].imageAssetId, 'retained-common');
  imported.questions[0].options.forEach(option => {
    assert.equal(option.id, current.parts[0].questions[0].options.find(previous => previous.label === option.label)?.id);
    assert.equal(option.imageAssetId, `retained-${option.label}`);
  });
  assert.equal(imported.questions[0].correctOptionIds[0], imported.questions[0].options[1].id);
  imported.examples![0].options!.forEach(option => assert.equal(option.imageAssetId, `example-${option.label}`));
  assert.deepEqual(current.parts.slice(1), originalOtherParts, 'A focused import must leave every other Part unchanged.');
});

test('KET Listening import rejects malformed image metadata before changing a draft', () => {
  const current = create(); const original = JSON.stringify(current);
  for (const invalid of [null, 'shared', [], {}, { kind: 'other' }, { kind: 'shared', optionLabels: ['A'] }, { kind: 'options', optionLabels: [] }, { kind: 'options', optionLabels: ['A', 'A'] }, { kind: 'options', optionLabels: ['D'] }, { kind: 'options', optionLabels: ['A', 2] }, { kind: 'options', extra: true }]) {
    assert.throws(() => importUniversalExamPart(current, 0, JSON.stringify(partOne([choice(1, invalid)]))), /imageLayout/);
    assert.equal(JSON.stringify(current), original);
  }
  const imported = importUniversalExamPart(current, 0, JSON.stringify(partOne([choice(1, { kind: 'options', optionLabels: ['b', 'c'] })]))).part;
  assert.deepEqual(imported.questions[0].imageLayout, { kind: 'options', optionLabels: ['B', 'C'] });
  assert.throws(() => importUniversalExamPart(current, 0, JSON.stringify(partOne([{ ...choice(1), imageAssetId: 'external-forbidden' }]))), /trường kỹ thuật/);
});

test('KET Listening prompt gives full unscored examples, per-question image metadata and nonduplicated form fields', () => {
  const current = create();
  const prompt = buildUniversalExamImportPrompt(current);
  assert.match(prompt, /Example Part 1 và Part 3 phải đầy đủ prompt, ba options A\/B\/C và answer/);
  assert.match(prompt, /optionLabels chỉ liệt kê đúng nhãn có ảnh/);
  assert.match(prompt, /Không khóa theo số câu 3, không khóa số crop hoặc 12 ảnh/);
  assert.doesNotMatch(prompt, /chỉ tự crop ba ảnh.*1, 2, 4, 5|Câu in số 3 là đúng MỘT/);
  assert.match(prompt, /nhãn và dòng CẦN HỌC SINH ĐIỀN chỉ nằm trong questions/);
  const sampleStart = prompt.indexOf('{\n  "format":');
  const sampleEnd = prompt.indexOf('\n\nTự kiểm tra lần cuối:', sampleStart);
  const sample = JSON.parse(prompt.slice(sampleStart, sampleEnd));
  const parts = sample.papers[0].parts;
  for (const index of [0, 2]) {
    const example = parts[index].blocks[0].content.examples[0];
    assert.deepEqual(example.options.map((option: { label: string }) => option.label), ['A', 'B', 'C']);
    assert.ok(example.options.every((option: { text: string }) => option.text.trim().length > 5));
    assert.ok(example.options.some((option: { label: string }) => option.label === example.answer));
  }
  assert.equal(parts[0].blocks[0].content.questions[1].imageLayout.kind, 'shared');
  assert.equal(parts[0].blocks[0].content.questions[2].imageLayout.kind, 'options');
  for (const index of [3, 4]) {
    const form = parts[index].blocks[0].content;
    assert.match(form.passage, /Example/); assert.doesNotMatch(form.passage, /\[\[|_{2,}|Field\s+\d|New address/);
  }
  for (const index of [0, 2, 3, 4]) assert.match(buildUniversalExamPartImportPrompt(current, index), new RegExp(`CHỈ trả Part ${index + 1}`));
});
