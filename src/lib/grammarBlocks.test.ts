import assert from 'node:assert/strict';
import test from 'node:test';
import { cloneGrammarBlock, convertLegacyGrammarToBlocks, grammarBlockPresentation, grammarMixedPreview, isGrammarMixedReview, sanitizeGrammarBlocks, validateGrammarBlocks } from './grammarBlocks';
import { grammarMixedTemplate, parseGrammarMixedImport } from './grammarMixedImport';
import { grammarPassageTemplate, parseGrammarPassageImport } from './grammarPassageImport';
import { buildMixedGrammarBulkImportPrompt } from './adminBulkImportPrompts';

const imported = () => parseGrammarMixedImport(grammarMixedTemplate());

test('the copyable whole-grammar template round-trips with all three layouts and one canonical question list', () => {
  const data = imported();
  assert.deepEqual(data.errors, []);
  assert.deepEqual(data.blocks.map(block => block.type), ['multiple_choice', 'passage_drag_drop', 'reading_comprehension']);
  assert.equal(data.questions.length, 4);
  assert.deepEqual(validateGrammarBlocks(data), []);
  const prompt = buildMixedGrammarBulkImportPrompt({ title: 'Mixed unit', grade: 'Lớp 12' });
  assert.ok(prompt.includes(grammarMixedTemplate()));
  assert.match(prompt, /mở bằng ```json/); assert.match(prompt, /nút Copy/);
  assert.match(prompt, /Có thể lặp lại cùng một dạng nhiều lần/);
  assert.doesNotMatch(prompt, /Không Markdown|Không dùng Markdown/);
});

test('multiple reading/cloze groups keep independent local markers and every variable-size option', () => {
  const document = JSON.parse(grammarMixedTemplate());
  document.blocks.push(structuredClone(document.blocks[1]), structuredClone(document.blocks[2]));
  document.blocks[0].questions = Array.from({ length: 9 }, (_, index) => ({ question: `Question ${index + 1}`, options: Array.from({ length: index === 8 ? 28 : index + 2 }, (_, i) => `Choice ${i + 1}`), answer: 1, explanation: 'Giải thích.' }));
  const data = parseGrammarMixedImport('```json\r\n' + JSON.stringify(document) + '\r\n```');
  assert.deepEqual(data.errors, []); assert.equal(data.blocks.length, 5); assert.equal(data.questions[8].options.length, 28);
  assert.equal(data.questions.filter(question => question.blankNumber === 1).length, 2);
  const tokens = data.blocks.flatMap(block => block.wordBank || []);
  assert.equal(new Set(tokens.map(token => token.id)).size, tokens.length);
  assert.equal(new Set(data.questions.map(question => question.id)).size, data.questions.length);
});

test('invalid mixed imports are atomic even when earlier groups are valid', () => {
  for (const mutate of [
    (document: any) => { document.blocks[2].questions[0].answer = 20; },
    (document: any) => { document.blocks[1].passage += ' [[1]]'; },
    (document: any) => { document.blocks[0].questions[0].options = ['same', 'SAME']; },
    (document: any) => { document.blocks[1].answers[0].answer = 'missing'; },
    (document: any) => { document.blocks[0].type = 'unknown'; },
    (document: any) => { document.blocks = []; },
  ]) {
    const document = JSON.parse(grammarMixedTemplate()); mutate(document);
    const data = parseGrammarMixedImport(JSON.stringify(document));
    assert.ok(data.errors.length); assert.deepEqual(data.blocks, []); assert.deepEqual(data.questions, []);
  }
  for (const source of ['', 'not JSON', '[]', '{"format":"wrong","blocks":[]}']) assert.ok(parseGrammarMixedImport(source).errors.length);
});

test('legacy JSON/raw imports can be appended as independent blocks without sharing IDs', () => {
  for (const mode of ['passage_drag_drop', 'reading_comprehension'] as const) {
    const source = grammarPassageTemplate(mode);
    const data = parseGrammarMixedImport(source);
    const again = parseGrammarMixedImport(source);
    assert.deepEqual(data.errors, []); assert.equal(data.blocks[0].type, mode);
    assert.deepEqual(validateGrammarBlocks({ blocks: [...data.blocks, ...again.blocks], questions: [...data.questions, ...again.questions] }), []);
  }
  const raw = 'QUESTION: She ____ happy.\nA: is\nB: are\nANSWER: A\nEXPLANATION: She đi với is.';
  const data = parseGrammarMixedImport('```text\n' + raw + '\n```');
  assert.deepEqual(data.errors, []); assert.equal(data.blocks[0].type, 'multiple_choice');
  assert.equal(data.questions[0].questionText, 'She ____ happy.');
});

test('explicit legacy conversion preserves source question/token IDs, while copying remaps all references', () => {
  const legacy = parseGrammarPassageImport(grammarPassageTemplate('passage_drag_drop'), 'passage_drag_drop');
  const converted = convertLegacyGrammarToBlocks({ ...legacy, displayMode: 'passage_drag_drop' });
  assert.deepEqual(converted.questions.map(question => question.id), legacy.questions.map(question => question.id));
  assert.deepEqual(converted.blocks[0].wordBank, legacy.wordBank);
  const copy = cloneGrammarBlock(converted.blocks[0], converted.questions);
  assert.notEqual(copy.block.id, converted.blocks[0].id);
  const combined = { blocks: [...converted.blocks, copy.block], questions: [...converted.questions, ...copy.questions] };
  assert.deepEqual(validateGrammarBlocks(combined), []);
  assert.deepEqual(copy.questions.map(question => question.blankNumber), legacy.questions.map(question => question.blankNumber));
  assert.equal(copy.questions.some(question => legacy.questions.some(source => source.id === question.id)), false);
  assert.equal(copy.block.wordBank!.some(token => legacy.wordBank.some(source => source.id === token.id)), false);
});

test('canonical validation catches orphaned, duplicated and cross-block questions or tokens', () => {
  const source = imported();
  for (const mutate of [
    (data: typeof source) => { data.blocks[1].questionIds.push(data.blocks[0].questionIds[0]); },
    (data: typeof source) => { data.questions[0].blockId = data.blocks[1].id; },
    (data: typeof source) => { data.blocks[0].questionIds = ['unknown']; },
    (data: typeof source) => { data.blocks[0].id = data.blocks[1].id; },
  ]) {
    const data = structuredClone(source); mutate(data); assert.ok(validateGrammarBlocks(data).length);
  }
});

test('preview and review presentations isolate each bank and allowlist block metadata', () => {
  const data = imported();
  Object.assign(data.blocks[1], { correctOptionId: 'secret', answerKey: { hidden: 'secret' } });
  const safe = sanitizeGrammarBlocks(data.blocks);
  assert.equal(JSON.stringify(safe).includes('secret'), false);
  const preview = grammarMixedPreview(data.blocks, data.questions);
  assert.ok(isGrammarMixedReview(preview));
  const bank = grammarBlockPresentation(preview, safe[1]);
  assert.equal(bank.questions.length, 2); assert.equal(bank.wordBankSnapshot!.length, 3);
  assert.equal(bank.questions.some(question => question.correctOptionId), false);
  assert.equal(grammarBlockPresentation(preview, safe[0]).passageSnapshot, '');
  assert.equal(isGrammarMixedReview({ ...preview, blocksSnapshot: [{ ...safe[0], type: 'unknown' }] }), false);
});
