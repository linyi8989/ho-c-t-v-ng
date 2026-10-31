import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createDefaultExamContent, getExamPaperDefinition } from './definitions';
import { importUniversalExamBundle, importUniversalExamPart } from './universalImport';
import { buildUniversalExamImportPrompt, buildUniversalExamPartImportPrompt } from './universalImportPrompt';
import { importStarterSinglePart } from './starterImport';
import { buildStarterListeningBundlePrompt } from './starterImportPrompt';
import { StarterTextEntryEditor } from './admin/StarterAuthoring';
import { StarterTextEntryView } from './student/StarterInteractions';
import { displayCorrectAnswer, normalizeExamSmartImportPart, sanitizeExamContentForStudent, validateExamPaperContent } from '../../server/exam-platform/examValidation';
import { EXAM_GRADING_VERSION, EXAM_INPUT_VARIANTS_GRADING_VERSION, gradeExamAttempt } from '../../server/exam-platform/examGrader';

const variants = ['4', 'four years', '4 years'];
const draft = (moduleId: 'starter' | 'flyer') => createDefaultExamContent(getExamPaperDefinition(moduleId, 'listening')!);
const samplePart = (value: unknown = variants, source = 'official-answer-key') => ({ partNumber: 2, title: 'Tennis competition', instruction: 'Listen and write.', blocks: [{ blockNumber: 1, title: 'Tennis competition', interaction: { family: 'text-entry', subtype: 'short-answer', variant: 'single-input', schemaVersion: 1 }, content: { passage: 'Name — Betty.\nDay — Saturday.', questions: Array.from({ length: 5 }, (_, index) => ({ questionNumber: index + 1, prompt: 'Years of tennis:', type: 'short-answer', maxWords: 1, answerSource: source, answerKey: { acceptedAnswers: ['four'], ...(value === undefined ? {} : { inputAnswerVariants: value }) } })) } }] });
const bundle = (moduleId: 'starter' | 'flyer', part: ReturnType<typeof samplePart>) => ({ format: 'exam-bundle-import-v2', formatVersion: 2, exam: { moduleId }, papers: [{ paperId: 'listening', parts: [part] }] });

test('young Listening prompts keep official answers separate from generated comparison-only input forms', () => {
  for (const moduleId of ['starter', 'flyer'] as const) {
    const content = draft(moduleId);
    for (const prompt of [buildUniversalExamImportPrompt(content), buildUniversalExamPartImportPrompt(content, 1)]) {
      assert.match(prompt, /inputAnswerVariants/);
      assert.match(prompt, /four years/);
      assert.match(prompt, /không hiển thị|không dùng hiển thị/);
      assert.match(prompt, /số 0 đầu/);
    }
  }
  assert.match(buildStarterListeningBundlePrompt(), /"acceptedAnswers":\["four"\],"inputAnswerVariants":\["4","four years","4 years"\]/);
});

test('Universal whole/focused Part2 imports preserve originals and reset omitted or empty variants', () => {
  for (const moduleId of ['starter', 'flyer'] as const) {
    const content = draft(moduleId);
    const part = importUniversalExamPart(content, 1, JSON.stringify(samplePart())).part;
    assert.deepEqual(part.questions[0].acceptedAnswers, ['four']);
    assert.deepEqual(part.questions[0].inputAnswerVariants, variants);
    content.parts[1] = part;
    const payload = samplePart();
    payload.blocks[0].content.questions.forEach(question => { delete question.answerKey.inputAnswerVariants; });
    assert.equal(importUniversalExamPart(content, 1, JSON.stringify(payload)).part.questions[0].inputAnswerVariants, undefined);
    assert.equal(importUniversalExamPart(content, 1, JSON.stringify(samplePart([]))).part.questions[0].inputAnswerVariants, undefined);
    const all = buildUniversalExamImportPrompt(content);
    const start = all.indexOf('{\n  "format": "exam-bundle-import-v2"');
    let depth = 0, quoted = false, escaped = false, parsed: ReturnType<typeof bundle> | undefined;
    for (let i = start; i < all.length; i++) {
      const c = all[i];
      if (quoted) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === '"') quoted = false; }
      else if (c === '"') quoted = true;
      else if (c === '{') depth++;
      else if (c === '}' && --depth === 0) { parsed = JSON.parse(all.slice(start, i + 1)); break; }
    }
    assert.ok(parsed);
    parsed.papers[0].parts[1] = samplePart();
    const whole = importUniversalExamBundle(content, JSON.stringify(parsed)).content;
    assert.deepEqual(whole.parts[1].questions[0].inputAnswerVariants, variants);
    assert.deepEqual(whole.parts[1].questions[0].acceptedAnswers, ['four']);
    assert.equal(content.parts[1].questions[0].inputAnswerVariants, part.questions[0].inputAnswerVariants);
  }
});

test('new equivalents require a verified original and malformed arrays fail without changing the draft', () => {
  for (const moduleId of ['starter', 'flyer'] as const) {
    const content = draft(moduleId), before = JSON.stringify(content);
    for (const invalid of [null, '4', [4], [''], [{}], Array(21).fill('4'), ['a'.repeat(201)], ['four\nyears']]) {
      assert.throws(() => importUniversalExamPart(content, 1, JSON.stringify(samplePart(invalid))), /inputAnswerVariants/);
      assert.equal(JSON.stringify(content), before);
    }
    assert.throws(() => importUniversalExamPart(content, 1, JSON.stringify(samplePart(variants, 'unverified'))), /xác minh/);
    const unknown = importUniversalExamPart(content, 1, JSON.stringify(samplePart([], 'unverified'))).part;
    assert.deepEqual(unknown.questions[0].acceptedAnswers, []);
    assert.equal(unknown.questions[0].inputAnswerVariants, undefined);
  }
});

test('legacy Starters and server Smart Import retain supplemental input forms separately', () => {
  const content = draft('starter');
  const section = { slot: 'part-2', interaction: { family: 'text-entry', subtype: 'short-answer', variant: 'single-input', schemaVersion: 1 }, payload: { questions: Array.from({ length: 5 }, (_, index) => ({ number: index + 1, prompt: 'Years of tennis:', template: 'Years of tennis: ____', gaps: [{ gapNumber: 1, acceptedAnswers: ['four'], inputAnswerVariants: variants, source: 'official-answer-key' }] })) } };
  const imported = importStarterSinglePart(content, 1, JSON.stringify(section), getExamPaperDefinition('starter', 'listening')!).part;
  assert.deepEqual(imported.questions[0].acceptedAnswers, ['four']);
  assert.deepEqual(imported.questions[0].inputAnswerVariants, variants);
  for (const moduleId of ['starter', 'flyer'] as const) {
    const current = draft(moduleId);
    const candidate = { questions: current.parts[1].questions.map(() => ({ type: 'short-answer', prompt: 'Years of tennis:', acceptedAnswers: ['four'], inputAnswerVariants: variants })) };
    const normalized = normalizeExamSmartImportPart(current.parts[1], candidate, getExamPaperDefinition(moduleId, 'listening')!.parts[1], current);
    assert.deepEqual(normalized.errors, []);
    assert.deepEqual(normalized.part.questions[0].inputAnswerVariants, variants);
    const malformed = structuredClone(candidate); Object.assign(malformed.questions[0], { inputAnswerVariants: 4 });
    assert.ok(normalizeExamSmartImportPart(current.parts[1], malformed, getExamPaperDefinition(moduleId, 'listening')!.parts[1], current).errors.length);
  }
});

test('all equivalent inputs score only in scoped Part2, while display and playable never receive the extra list', () => {
  for (const moduleId of ['starter', 'flyer'] as const) {
    const content = draft(moduleId); content.parts[1] = importUniversalExamPart(content, 1, JSON.stringify(samplePart())).part;
    const question = content.parts[1].questions[0];
    for (const input of ['four', ...variants]) {
      const grade = gradeExamAttempt(content, { [question.id]: input });
      const row = grade.questions.find(row => row.questionId === question.id)!;
      assert.equal(row.correct, true, input);
      assert.deepEqual(row.correctAnswer, ['four']);
      assert.equal(grade.gradingVersion, EXAM_INPUT_VARIANTS_GRADING_VERSION);
      assert.equal(JSON.stringify(grade).includes('inputAnswerVariants'), false);
    }
    assert.equal(gradeExamAttempt(content, { [question.id]: 'five' }).questions.find(row => row.questionId === question.id)!.correct, false);
    assert.equal(gradeExamAttempt(content, {}).questions.find(row => row.questionId === question.id)!.unanswered, true);
    assert.deepEqual(displayCorrectAnswer(question), ['four']);
    assert.equal(JSON.stringify(sanitizeExamContentForStudent(content)).includes('inputAnswerVariants'), false);
    const malformed = structuredClone(content); Object.assign(malformed.parts[1].questions[0], { inputAnswerVariants: [4] });
    assert.ok(validateExamPaperContent(malformed).some(error => error.includes('inputAnswerVariants')));
    const legacy = structuredClone(content); legacy.parts[1].questions.forEach(q => { delete q.inputAnswerVariants; });
    assert.equal(gradeExamAttempt(legacy, { [question.id]: '4' }).questions.find(row => row.questionId === question.id)!.correct, false);
    assert.equal(gradeExamAttempt(legacy, {}).gradingVersion, EXAM_GRADING_VERSION);
  }
  const ket = createDefaultExamContent(getExamPaperDefinition('ket', 'listening')!); const question = ket.parts[3].questions[0];
  question.acceptedAnswers = ['four']; question.inputAnswerVariants = variants;
  assert.equal(gradeExamAttempt(ket, { [question.id]: '4' }).questions.find(row => row.questionId === question.id)!.correct, false);
  assert.equal(gradeExamAttempt(ket, {}).gradingVersion, EXAM_GRADING_VERSION);
});

test('teacher Part2 editor shows supplemental forms independently while student text-entry view never shows them', () => {
  const content = draft('starter'), part = content.parts[1]; part.questions[0].acceptedAnswers = ['four']; part.questions[0].inputAnswerVariants = variants;
  const author = renderToStaticMarkup(createElement(StarterTextEntryEditor, { part, onChange: () => {}, printedAnswerHints: true }));
  assert.match(author, /data-young-listening-part2-input-variants-editor/);
  assert.match(author, /4 \| four years \| 4 years/);
  assert.doesNotMatch(renderToStaticMarkup(createElement(StarterTextEntryEditor, { part, onChange: () => {} })), /data-young-listening-part2-input-variants-editor/);
  const student = renderToStaticMarkup(createElement(StarterTextEntryView, { part, answers: {}, onAnswer: () => {}, printedAnswerHints: true }));
  assert.doesNotMatch(student, /four years|4 years|inputAnswerVariants/);
});
