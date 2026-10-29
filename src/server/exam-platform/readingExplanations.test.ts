import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import express from 'express';
import { createDefaultExamContent, getExamPaperDefinition } from '../../features/exam-platform/definitions';
import { normalizeFixedKetReadingWritingContent } from '../../features/exam-platform/ketReadingWritingMigration';
import { normalizeFixedPetReadingContent } from '../../features/exam-platform/petReadingMigration';
import { normalizeFixedFceReadingContent } from '../../features/exam-platform/fceReadingMigration';
import { isReadingExplanationQuestion, parseReadingExplanation, READING_EXPLANATION_MAX_LENGTH, supportsReadingExplanations } from '../../features/exam-platform/readingExplanations';
import type { ExamAnswers, ExamPaperContent, ExamQuestion } from '../../features/exam-platform/types';
import { getLearningHistoryDetail } from '../learning-history/learningHistoryService';
import { applyAiWritingGrade, applyManualExamGrades, gradeExamAttempt } from './examGrader';
import { createExamRouter } from './examRouter';
import { normalizeExamSmartImportPart, sanitizeExamContentForStudent, validateExamPaperContent } from './examValidation';

const readingPapers = [
  ['ket', 'reading-writing'], ['pet', 'reading'], ['fce', 'reading'],
  ['fce', 'reading-use-of-english'], ['ielts', 'academic-reading'],
] as const;
const excludedPapers = [
  ['ket', 'listening'], ['pet', 'listening'], ['fce', 'listening'], ['ielts', 'listening'],
  ['pet', 'writing'], ['fce', 'writing'], ['ielts', 'academic-writing'],
  ['writing', 'writing'], ['starter', 'reading-writing'], ['flyer', 'reading-writing'],
] as const;

function readingContent(moduleId: ExamPaperContent['moduleId'] = 'ielts', paperId: ExamPaperContent['paperId'] = 'academic-reading'): ExamPaperContent {
  const questions: ExamQuestion[] = [1, 2].map(number => ({
    id: `choice-${number}`, number, type: 'single-choice', prompt: `Which statement matches paragraph ${number}?`,
    options: ['A', 'B'].map(label => ({ id: `choice-${number}-${label}`, label, text: `Statement ${label}` })),
    correctOptionIds: [`choice-${number}-${number === 1 ? 'A' : 'B'}`], acceptedAnswers: [], points: 1,
    explanation: `Căn cứ đoạn ${number}: cách diễn đạt của đáp án giữ nguyên ý của bài đọc.`,
  }));
  questions.push(...[3, 4].map(number => ({
    id: `gap-${number}`, number, type: 'short-answer' as const, prompt: `Read and complete gap ${number}: ____`,
    options: [], correctOptionIds: [], acceptedAnswers: ['answer'], points: 1,
    ...(number === 3 ? { explanation: 'Từ cần điền phù hợp về nghĩa và cấu trúc của câu trong đoạn đọc.' } : {}),
  })));
  return {
    schemaVersion: 3, structureMode: 'dynamic', moduleId, paperId, title: `${moduleId} explanation fixture`,
    description: 'A small isolated reading paper', level: 'Fixture', showReviewAfterSubmit: true,
    parts: [{ id: 'reading-part', part: 1, title: 'Read the text', instruction: 'Read and answer.',
      passage: 'A complete reading text with supporting evidence for each statement and gap.', questions,
      blocks: [
        { id: 'choice-block', block: 1, title: 'Choose', instruction: 'Choose A or B.', interaction: { family: 'choice', subtype: 'single', variant: 'text-options', schemaVersion: 1 }, questionIds: questions.slice(0, 2).map(question => question.id) },
        { id: 'gap-block', block: 2, title: 'Complete', instruction: 'Write one word.', interaction: { family: 'text-entry', subtype: 'short-answer', variant: 'inline-gap', schemaVersion: 1 }, questionIds: questions.slice(2).map(question => question.id) },
      ],
    }],
  };
}

function mixedAnswers(): ExamAnswers {
  return { 'choice-1': 'choice-1-A', 'choice-2': 'choice-2-A', 'gap-4': 'answer' };
}

test('Reading explanations are limited to the requested papers and never open Writing tasks', () => {
  for (const [moduleId, paperId] of readingPapers) {
    const identity = { moduleId, paperId };
    assert.equal(supportsReadingExplanations(identity), true, `${moduleId}/${paperId}`);
    assert.equal(isReadingExplanationQuestion(identity, { type: 'short-answer' }), true);
    assert.equal(isReadingExplanationQuestion(identity, { type: 'long-writing' }), false);
    assert.equal(isReadingExplanationQuestion(identity, { type: 'scene-draw' }), false);
  }
  for (const [moduleId, paperId] of excludedPapers) {
    assert.equal(supportsReadingExplanations({ moduleId, paperId }), false, `${moduleId}/${paperId}`);
    assert.equal(isReadingExplanationQuestion({ moduleId, paperId }, { type: 'short-answer' }), false);
  }
});

test('optional explanations preserve newlines and reject malformed or oversized values without coercion', () => {
  assert.equal(parseReadingExplanation(undefined), undefined);
  assert.equal(parseReadingExplanation('  \r\n  '), undefined);
  assert.equal(parseReadingExplanation('  Căn cứ bài đọc.\r\nGiải thích cấu trúc.  '), 'Căn cứ bài đọc.\nGiải thích cấu trúc.');
  assert.equal(parseReadingExplanation('a'.repeat(READING_EXPLANATION_MAX_LENGTH))?.length, READING_EXPLANATION_MAX_LENGTH);
  for (const invalid of [null, 1, true, [], {}, 'a'.repeat(READING_EXPLANATION_MAX_LENGTH + 1)]) {
    assert.throws(() => parseReadingExplanation(invalid), /Giải thích đáp án/);
    const content = readingContent();
    Object.assign(content.parts[0].questions[0], { explanation: invalid });
    assert.ok(validateExamPaperContent(content).some(error => /Giải thích đáp án/.test(error)), String(invalid));
  }
  assert.deepEqual(validateExamPaperContent(readingContent()), []);
});

test('grading freezes explanations for correct, incorrect and unanswered Reading rows without changing scores', () => {
  for (const [moduleId, paperId] of readingPapers) {
    const content = readingContent(moduleId, paperId);
    assert.deepEqual(validateExamPaperContent(content), [], `${moduleId}/${paperId}`);
    const legacy = structuredClone(content);
    legacy.parts[0].questions.forEach(question => { delete question.explanation; });
    const grade = gradeExamAttempt(content, mixedAnswers());
    const legacyGrade = gradeExamAttempt(legacy, mixedAnswers());
    const withoutExplanations = structuredClone(grade);
    withoutExplanations.questions.forEach(question => { delete question.explanation; });
    assert.deepEqual(withoutExplanations, legacyGrade, `${moduleId}/${paperId}: scores and answer semantics`);
    assert.equal(grade.score, 50);
    assert.deepEqual(grade.questions.map(question => [question.correct, question.unanswered]), [[true, false], [false, false], [false, true], [true, false]]);
    assert.deepEqual(grade.questions.map(question => question.explanation), content.parts[0].questions.map(question => question.explanation));
    content.parts[0].questions[0].explanation = 'Edited after the attempt.';
    assert.notEqual(grade.questions[0].explanation, content.parts[0].questions[0].explanation);
    assert.equal(Object.hasOwn(grade.questions[3], 'explanation'), false, 'legacy/blank explanations are omitted');
    const safe = sanitizeExamContentForStudent(content);
    assert.equal(JSON.stringify(safe).includes('"explanation":'), false, `${moduleId}/${paperId}: no pre-submit rationale`);
    assert.equal(JSON.stringify(safe).includes('acceptedAnswers'), false);
    assert.equal(JSON.stringify(safe).includes('correctOptionIds'), false);
    assert.ok(content.parts[0].questions[0].explanation, 'sanitizing does not mutate the teacher draft');
  }
});

test('Listening and Writing grading results do not gain explanations from injected fields', () => {
  for (const [moduleId, paperId] of excludedPapers) {
    const content = readingContent(moduleId, paperId);
    assert.equal(gradeExamAttempt(content, mixedAnswers()).questions.some(question => Object.hasOwn(question, 'explanation')), false, `${moduleId}/${paperId}`);
    assert.equal(JSON.stringify(sanitizeExamContentForStudent(content)).includes('"explanation":'), false);
  }
});

test('fixed Reading adapters retain explanations through question and block normalization', () => {
  for (const [moduleId, paperId, normalize] of [
    ['ket', 'reading-writing', normalizeFixedKetReadingWritingContent],
    ['pet', 'reading', normalizeFixedPetReadingContent],
    ['fce', 'reading', normalizeFixedFceReadingContent],
  ] as const) {
    const content = createDefaultExamContent(getExamPaperDefinition(moduleId, paperId)!);
    const expected = new Map<string, string>();
    content.parts.forEach(part => part.questions.forEach(question => {
      if (!isReadingExplanationQuestion(content, question)) return;
      question.explanation = `Giải thích đã soạn cho câu ${question.number}.`;
      expected.set(question.id, question.explanation);
    }));
    const normalized = normalize(content);
    for (const question of normalized.parts.flatMap(part => part.questions)) {
      if (expected.has(question.id)) assert.equal(question.explanation, expected.get(question.id));
      else assert.equal(question.explanation, undefined, 'long Writing is untouched');
    }
    const grade = gradeExamAttempt(normalized, {});
    for (const result of grade.questions) assert.equal(result.explanation, expected.get(result.questionId));
  }
});

test('KET Writing completion preserves Reading explanations while retaining individual Writing feedback', () => {
  const content = readingContent('ket', 'reading-writing');
  const writing: ExamQuestion = { id: 'writing-task', number: 5, type: 'long-writing', prompt: 'Write an email.', options: [], correctOptionIds: [], acceptedAnswers: [], points: 10, rubric: 'Task completion', explanation: 'Not an objective Reading explanation.' };
  content.parts[0].questions.push(writing);
  content.parts[0].blocks!.push({ id: 'writing-block', block: 3, title: 'Write', instruction: 'Write an email.', interaction: { family: 'writing', subtype: 'guided', variant: 'text-area', schemaVersion: 1 }, questionIds: [writing.id] });
  const grade = gradeExamAttempt(content, { ...mixedAnswers(), [writing.id]: 'A student email.' });
  const expected = grade.questions.slice(0, 4).map(question => question.explanation);
  assert.equal(grade.questions[4].explanation, undefined);
  const manual = applyManualExamGrades(grade, { [writing.id]: 8 });
  assert.deepEqual(manual.questions.slice(0, 4).map(question => question.explanation), expected);
  const ai = applyAiWritingGrade(grade, writing.id, { score: 8, sentenceCount: 2, grammarErrors: [], vocabularyErrors: [], feedback: 'Nhận xét riêng về bài viết của học sinh.' });
  assert.deepEqual(ai.questions.slice(0, 4).map(question => question.explanation), expected);
  assert.equal(ai.questions[4].aiFeedback, 'Nhận xét riêng về bài viết của học sinh.');
  assert.equal(ai.questions[4].explanation, undefined);
});

test('direct Smart Import only accepts explanations with explicit Reading identity and rejects malformed values', () => {
  const content = readingContent();
  const currentPart = content.parts[0];
  const definition = { ...getExamPaperDefinition('ielts', 'academic-reading')!.parts[0], questionCountFlexible: true };
  const candidate = { questions: currentPart.questions.map(question => ({ type: question.type, prompt: question.prompt, options: question.options.map(({ label, text }) => ({ label, text })), correctOptionLabels: question.correctOptionIds.map(id => question.options.find(option => option.id === id)!.label), acceptedAnswers: question.acceptedAnswers, explanation: question.explanation })) };
  const imported = normalizeExamSmartImportPart(currentPart, candidate, definition, content);
  assert.deepEqual(imported.errors, []);
  assert.deepEqual(imported.part.questions.map(question => question.explanation), currentPart.questions.map(question => question.explanation));
  assert.equal(normalizeExamSmartImportPart(currentPart, candidate, definition).part.questions.some(question => question.explanation), false, 'legacy callers keep their old pipeline');
  assert.equal(normalizeExamSmartImportPart(currentPart, candidate, definition, { moduleId: 'ielts', paperId: 'listening' }).part.questions.some(question => question.explanation), false);
  Object.assign(candidate.questions[0], { explanation: { invented: 'not a string' } });
  assert.ok(normalizeExamSmartImportPart(currentPart, candidate, definition, content).errors.some(error => /Giải thích đáp án/.test(error)));
});

test('Reading API and History retain published explanation snapshots and enforce owner, guest secret and review policy', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'reading-explanation-api-'));
  const databasePath = path.join(directory, 'app.sqlite');
  if (process.env.READING_EXPLANATIONS_TEST_DB_SOURCE) fs.copyFileSync(process.env.READING_EXPLANATIONS_TEST_DB_SOURCE, databasePath);
  Object.assign(process.env, { NODE_ENV: 'test', STORAGE_MODE: 'sqlite', SQLITE_DRIVER: process.env.READING_EXPLANATIONS_TEST_SQLITE_DRIVER || 'sqljs', SQLITE_DB_PATH: databasePath, SQLITE_ALLOW_CREATE: 'true', SQLITE_ALLOW_JSON_IMPORT: 'false' });
  const storage = await import('../../lib/sqliteStorage');
  await storage.initializeSQLiteStorage();
  const db = new storage.SQLiteFirestore();
  const teacher = { id: 'reading-explanation-teacher', name: 'Teacher', email: 'reading@example.test', role: 'teacher' as const, status: 'active' as const, createdAt: '2026-10-29T00:00:00Z' };
  const auth: express.RequestHandler = (req, _res, next) => { req.user = { ...teacher, ...(req.headers['x-test-owner'] === 'other' ? { id: 'reading-explanation-other-teacher' } : {}) }; next(); };
  const optional: express.RequestHandler = (req, _res, next) => { if (req.headers['x-test-owner']) req.user = { ...teacher, ...(req.headers['x-test-owner'] === 'other' ? { id: 'reading-explanation-other-teacher' } : {}) }; next(); };
  let aiCalls = 0;
  const app = express(); app.use(express.json({ limit: '2mb' }));
  app.use('/api/exam-platform', createExamRouter({ db, authenticateUser: auth, authenticateOptionalUser: optional, requireStaff: (_req, _res, next) => next(), ticketSecret: 'reading-explanation-test-ticket-secret', resolveGuestProfile: async (guestId, name) => ({ id: String(guestId), displayName: String(name), status: 'active' }), writingGrading: { providers: [], recoveryIntervalMs: 0, grade: async () => { aiCalls++; throw new Error('Real AI must never run in Reading tests.'); } } }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.close(); await once(server, 'close'); await storage.closeSQLiteStorage(); fs.rmSync(directory, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/exam-platform`;
  const request = async (route: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}) => {
    const response = await fetch(base + route, { method, headers: { 'Content-Type': 'application/json', ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, data: await response.json() };
  };
  for (const [moduleId, paperId] of readingPapers) await t.test(`${moduleId}/${paperId}`, async () => {
    const content = readingContent(moduleId, paperId);
    const admin = `/admin/modules/${moduleId}/papers/${paperId}/sets`;
    const created = await request(admin, 'POST', { content }); assert.equal(created.status, 201, JSON.stringify(created.data));
    assert.deepEqual(created.data.validationErrors, []);
    assert.equal(created.data.draftContent.parts[0].questions[0].explanation, content.parts[0].questions[0].explanation);
    const saved = await request(`${admin}/${created.data.id}`, 'PUT', { content, visibility: 'public', baseRevision: created.data.draftRevision }); assert.equal(saved.status, 200, JSON.stringify(saved.data));
    const v1 = await request(`${admin}/${created.data.id}/publish`, 'POST'); assert.equal(v1.status, 200, JSON.stringify(v1.data));
    const student = `/modules/${moduleId}/papers/${paperId}/sets/${created.data.id}`;
    const playable = await request(student); assert.equal(playable.status, 200);
    assert.equal(JSON.stringify(playable.data).includes('"explanation":'), false);
    const guest = { guestId: `reading-${moduleId}-${paperId}`, studentName: 'Reading Learner' };
    const runSecret = `reading-${moduleId}-${paperId}-secret-1234567890`;
    const prepared = await request(`${student}/attempts/prepare`, 'POST', { ...guest, clientRunId: 'published-v1-run', runSecret });
    assert.equal(prepared.status, 200, JSON.stringify(prepared.data));
    assert.equal(JSON.stringify(prepared.data).includes('"explanation":'), false);
    const oldExplanation = content.parts[0].questions[0].explanation;
    content.parts[0].questions[0].explanation = 'A newly edited explanation for version two.';
    const savedV2 = await request(`${admin}/${created.data.id}`, 'PUT', { content, visibility: 'public', baseRevision: saved.data.draftRevision }); assert.equal(savedV2.status, 200);
    const v2 = await request(`${admin}/${created.data.id}/publish`, 'POST'); assert.equal(v2.status, 200);
    assert.notEqual(v1.data.version.id, v2.data.version.id);
    const submitted = await request(`${student}/attempts/submit`, 'POST', { ...guest, ticket: prepared.data.ticket, runSecret, answers: mixedAnswers() });
    assert.equal(submitted.status, 201, JSON.stringify(submitted.data)); assert.equal(submitted.data.score, 50);
    assert.equal(JSON.stringify(submitted.data).includes('"explanation":'), false);
    const query = new URLSearchParams(guest).toString();
    const reviewPath = `${student}/attempts/${submitted.data.id}/review`;
    const review = await request(`${reviewPath}?${query}`, 'GET', undefined, { 'X-Exam-Run-Secret': runSecret });
    assert.equal(review.status, 200, JSON.stringify(review.data));
    assert.equal(review.data.questions[0].explanation, oldExplanation, 'ticket grades the immutable version prepared before republishing');
    assert.ok(review.data.questions[1].explanation, 'incorrect answers also explain the correct answer');
    assert.ok(review.data.questions[2].explanation, 'unanswered answers also explain the correct answer');
    assert.equal(Object.hasOwn(review.data.questions[3], 'explanation'), false, 'legacy question remains optional');
    assert.equal((await request(`${reviewPath}?${query}`)).status, 404, 'guest must supply the attempt secret');
    assert.equal((await request(`${reviewPath}?${query}`, 'GET', undefined, { 'X-Exam-Run-Secret': 'incorrect-secret' })).status, 404);
    assert.equal((await request(`${reviewPath}?guestId=another-learner&studentName=Other`, 'GET', undefined, { 'X-Exam-Run-Secret': runSecret })).status, 404);
    assert.equal((await request(reviewPath, 'GET', undefined, { 'X-Test-Owner': 'other' })).status, 404, 'another teacher cannot read the result');
    const historyActor = { id: guest.guestId, ownerKey: `guest:${guest.guestId}`, kind: 'guest' as const, role: 'student' as const };
    const history = await getLearningHistoryDetail(historyActor, submitted.data.id);
    assert.equal((history.detail!.answerDetails[0] as { explanation?: string }).explanation, oldExplanation);
    await assert.rejects(() => getLearningHistoryDetail({ ...historyActor, ownerKey: 'guest:another-learner' }, submitted.data.id), { status: 404 });
    const detailRef = db.collection('exam_attempt_details').doc(submitted.data.id);
    const frozen = (await detailRef.get()).data();
    assert.equal(frozen.versionId, v1.data.version.id);
    await detailRef.update({ reviewPolicy: { showReviewAfterSubmit: false, policyVersion: 1 } });
    assert.equal((await request(`${reviewPath}?${query}`, 'GET', undefined, { 'X-Exam-Run-Secret': runSecret })).status, 403);
    const hiddenHistory = await getLearningHistoryDetail(historyActor, submitted.data.id);
    assert.equal(JSON.stringify(hiddenHistory.detail).includes('"explanation":'), false, 'History removes private explanations when review is disabled');
    const teacherReview = await request(reviewPath, 'GET', undefined, { 'X-Test-Owner': 'owner' });
    assert.equal(teacherReview.status, 200); assert.equal(teacherReview.data.questions[0].explanation, oldExplanation);
    const ownerDraft = await request(`${admin}/${created.data.id}`); assert.equal(ownerDraft.status, 200);
    assert.equal(ownerDraft.data.draftContent.parts[0].questions[0].explanation, content.parts[0].questions[0].explanation);
  });
  await t.test('legacy drafts stay publishable while malformed explanation fields stop publication', async () => {
    const admin = '/admin/modules/ielts/papers/academic-reading/sets';
    const malformed = readingContent();
    Object.assign(malformed.parts[0].questions[0], { explanation: ['Not plain text'] });
    const invalidDraft = await request(admin, 'POST', { content: malformed });
    assert.equal(invalidDraft.status, 201, 'a teacher can still save an incomplete working draft');
    assert.ok(invalidDraft.data.validationErrors.some((error: string) => /Giải thích đáp án/.test(error)));
    const blocked = await request(`${admin}/${invalidDraft.data.id}/publish`, 'POST');
    assert.equal(blocked.status, 400, JSON.stringify(blocked.data));
    const legacy = readingContent();
    legacy.parts[0].questions.forEach(question => { delete question.explanation; });
    const created = await request(admin, 'POST', { content: legacy }); assert.equal(created.status, 201);
    assert.deepEqual(created.data.validationErrors, []);
    const saved = await request(`${admin}/${created.data.id}`, 'PUT', { content: legacy, visibility: 'public', baseRevision: created.data.draftRevision }); assert.equal(saved.status, 200);
    const published = await request(`${admin}/${created.data.id}/publish`, 'POST'); assert.equal(published.status, 200);
    const student = `/modules/ielts/papers/academic-reading/sets/${created.data.id}`;
    const guest = { guestId: 'reading-legacy-learner', studentName: 'Legacy Learner' };
    const runSecret = 'legacy-reading-explanation-secret-123456';
    const prepared = await request(`${student}/attempts/prepare`, 'POST', { ...guest, clientRunId: 'legacy-run', runSecret }); assert.equal(prepared.status, 200);
    const submitted = await request(`${student}/attempts/submit`, 'POST', { ...guest, runSecret, ticket: prepared.data.ticket, answers: mixedAnswers() }); assert.equal(submitted.status, 201);
    const review = await request(`${student}/attempts/${submitted.data.id}/review?${new URLSearchParams(guest)}`, 'GET', undefined, { 'X-Exam-Run-Secret': runSecret }); assert.equal(review.status, 200);
    assert.equal(review.data.questions.some((question: Record<string, unknown>) => Object.hasOwn(question, 'explanation')), false);
    assert.equal(review.data.attempt.score, 50);
    assert.equal((await request(`${admin}/${created.data.id}`, 'GET', undefined, { 'X-Test-Owner': 'other' })).status, 404);
  });
  assert.equal(aiCalls, 0);
});
