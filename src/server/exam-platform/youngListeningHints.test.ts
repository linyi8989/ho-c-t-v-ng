import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import express from 'express';
import { createDefaultExamContent, getExamPaperDefinition } from '../../features/exam-platform/definitions';
import type { ExamAnswers, ExamPaperContent } from '../../features/exam-platform/types';
import { createDefaultMoverListeningContent } from '../../features/listening-library/modules/mover/editor/moduleDefinition';
import { createEmptyListeningAnswers } from '../../features/listening/types';
import { gradeListeningAttempt } from '../listening/listeningGrader';
import { createListeningRouter } from '../listening/listeningRouter';
import { gradeExamAttempt } from './examGrader';
import { createExamRouter } from './examRouter';
import { normalizeExamSmartImportPart, sanitizeExamContentForStudent, validateExamPaperContent } from './examValidation';

const imageId = 'young-hints-image';
const audioId = 'young-hints-audio';

function completedYoungListening(moduleId: 'starter' | 'flyer'): ExamPaperContent {
  const content = createDefaultExamContent(getExamPaperDefinition(moduleId, 'listening')!);
  content.title = `${moduleId} printed input hints fixture`;
  content.showReviewAfterSubmit = true;
  content.timeLimitMinutes = 0;
  content.parts.forEach(part => {
    part.audioAssetId = audioId;
    part.imageAssetId = imageId;
    if (part.part === 2) part.passage = "What's the girl's name? — Betty.\nHow old is she? — 10.";
    if (part.interactionLayout?.kind === 'starter-image-matching-v2') {
      part.interactionLayout.sourceNodes.forEach(node => { node.geometryConfirmedByTeacher = true; });
      part.interactionLayout.targetNodes.forEach(node => { node.geometryConfirmedByTeacher = true; });
    }
    if (part.interactionLayout?.kind === 'starter-scene-colour-v1' || part.interactionLayout?.kind === 'flyer-name-placement-v1') {
      part.interactionLayout.targets.forEach(target => { target.geometryConfirmedByTeacher = true; });
    }
    part.questions.forEach((question, index) => {
      question.prompt = `Question ${question.number}`;
      if (part.interaction?.variant === 'image-options') question.options.forEach(option => { option.imageAssetId = imageId; });
      if (question.options.length) {
        const matching = part.interactionLayout;
        question.correctOptionIds = [matching?.kind === 'starter-image-matching-v2'
          ? matching.targetNodes[index].id
          : matching?.kind === 'flyer-name-placement-v1' ? question.options[index].id : question.options[0].id];
      } else question.acceptedAnswers = moduleId === 'flyer' && part.part === 3 ? ['A'] : ['answer'];
    });
    if (moduleId === 'flyer' && part.part === 3) part.readingScenes!.forEach(scene => { scene.imageAssetId = imageId; });
    if (moduleId === 'flyer' && part.part === 4) part.readingScenes = [{ id: 'young-hints-display', imageAssetId: imageId, passage: '', questionIds: part.questions.map(question => question.id) }];
  });
  content.parts[1].questions.forEach((question, index) => {
    question.prompt = ['Address', 'Time', 'Age', 'House number', 'Pet'][index];
    question.acceptedAnswers = ['Green', 'nine', 'ten', '17', 'cat'].slice(index, index + 1);
    if (index === 0) { question.answerPrefix = '17'; question.answerSuffix = 'Street'; }
    if (index === 1) question.answerSuffix = "o'clock";
    if (index === 2) question.answerPrefix = 'about';
  });
  return content;
}

function correctYoungAnswers(content: ExamPaperContent): ExamAnswers {
  return Object.fromEntries(content.parts.flatMap(part => part.questions.map(question => [question.id, question.correctOptionIds[0] || question.acceptedAnswers[0]])));
}

test('young Listening hints remain public display data and do not change gap-only grading', () => {
  for (const moduleId of ['starter', 'flyer'] as const) {
    const content = completedYoungListening(moduleId);
    assert.deepEqual(validateExamPaperContent(content), [], moduleId);
    const withoutHints = structuredClone(content);
    withoutHints.parts[1].questions.forEach(question => { delete question.answerPrefix; delete question.answerSuffix; });
    const answers = correctYoungAnswers(content);
    const rows = content.parts[1].questions;
    answers[rows[1].id] = 'wrong';
    delete answers[rows[2].id];
    assert.deepEqual(gradeExamAttempt(content, answers), gradeExamAttempt(withoutHints, answers), 'hints cannot alter grading');
    const grade = gradeExamAttempt(content, answers);
    assert.deepEqual(grade.questions.filter(row => row.part === 2).map(row => [row.correct, row.unanswered]), [[true, false], [false, false], [false, true], [true, false], [true, false]]);
    answers[rows[0].id] = '17 Green Street';
    assert.equal(gradeExamAttempt(content, answers).questions.find(row => row.questionId === rows[0].id)!.correct, false, 'a complete printed row is not the requested gap answer');
    const playable = sanitizeExamContentForStudent(content);
    assert.equal(playable.parts[1].questions[0].answerPrefix, '17');
    assert.equal(playable.parts[1].questions[0].answerSuffix, 'Street');
    assert.equal(JSON.stringify(playable).includes('acceptedAnswers'), false);
    assert.equal(JSON.stringify(playable).includes('correctOptionIds'), false);
  }
});

test('young Listening publication rejects malformed hints, with optional legacy fields and scoped Smart Import', () => {
  for (const moduleId of ['starter', 'flyer'] as const) {
    const original = completedYoungListening(moduleId);
    for (const [field, invalid] of [['answerPrefix', null], ['answerPrefix', 17], ['answerPrefix', {}], ['answerPrefix', []], ['answerPrefix', 'a'.repeat(21)], ['answerSuffix', false], ['answerSuffix', 'a'.repeat(81)]] as const) {
      const malformed = structuredClone(original);
      Object.assign(malformed.parts[1].questions[0], { [field]: invalid });
      assert.ok(validateExamPaperContent(malformed).length > 0, `${moduleId}: ${field} ${JSON.stringify(invalid)}`);
    }
    const current = original.parts[1];
    const legacyInline = structuredClone(original);
    Object.assign(legacyInline.parts[1].questions[0], { prompt: 'Address: 17 ____ Street', answerPrefix: '', answerSuffix: '' });
    assert.deepEqual(validateExamPaperContent(legacyInline), [], 'released inline prompts with empty optional metadata stay publishable');
    const candidate = { questions: current.questions.map(question => ({ type: 'short-answer', prompt: question.prompt, acceptedAnswers: question.acceptedAnswers, answerPrefix: question.answerPrefix || '', answerSuffix: question.answerSuffix || '' })) };
    const imported = normalizeExamSmartImportPart(current, candidate, getExamPaperDefinition(moduleId, 'listening')!.parts[1], original);
    assert.deepEqual(imported.errors, []);
    assert.equal(imported.part.questions[0].answerPrefix, '17');
    assert.equal(imported.part.questions[0].answerSuffix, 'Street');
    const legacyCandidate = { questions: candidate.questions.map(({ answerPrefix: _prefix, answerSuffix: _suffix, ...question }) => question) };
    const legacy = normalizeExamSmartImportPart(current, legacyCandidate, getExamPaperDefinition(moduleId, 'listening')!.parts[1], original);
    assert.deepEqual(legacy.errors, []);
    assert.equal(legacy.part.questions[0].answerPrefix, undefined, 'replacement cannot inherit an unrelated old hint');
    assert.equal(legacy.part.questions[0].answerSuffix, undefined);
    Object.assign(candidate.questions[0], { answerSuffix: { invalid: true } });
    assert.ok(normalizeExamSmartImportPart(current, candidate, getExamPaperDefinition(moduleId, 'listening')!.parts[1], original).errors.length > 0);
  }
});

test('printed hint metadata never changes scoring in existing non-target exam papers', () => {
  for (const [moduleId, paperId] of [['ket', 'listening'], ['pet', 'listening'], ['fce', 'listening'], ['ielts', 'listening'], ['starter', 'reading-writing'], ['flyer', 'reading-writing']] as const) {
    const content = createDefaultExamContent(getExamPaperDefinition(moduleId, paperId)!);
    const before = gradeExamAttempt(content, {});
    content.parts[1].questions.forEach(question => { question.answerPrefix = '17'; question.answerSuffix = 'Street'; });
    assert.deepEqual(gradeExamAttempt(content, {}), before, `${moduleId}/${paperId}`);
  }
});

test('young Listening hints survive real draft/publish/attempt routes on an isolated SQLite database', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'young-listening-hints-api-'));
  const databasePath = path.join(directory, 'app.sqlite');
  if (process.env.YOUNG_LISTENING_HINTS_TEST_DB_SOURCE) fs.copyFileSync(process.env.YOUNG_LISTENING_HINTS_TEST_DB_SOURCE, databasePath);
  Object.assign(process.env, { NODE_ENV: 'test', STORAGE_MODE: 'sqlite', SQLITE_DRIVER: process.env.YOUNG_LISTENING_HINTS_TEST_SQLITE_DRIVER || 'sqljs', SQLITE_DB_PATH: databasePath, SQLITE_ALLOW_CREATE: 'true', SQLITE_ALLOW_JSON_IMPORT: 'false' });
  const storage = await import('../../lib/sqliteStorage');
  await storage.initializeSQLiteStorage();
  const db = new storage.SQLiteFirestore();
  const teacher = { id: 'young-hints-teacher', name: 'Teacher', email: 'young-hints@example.test', role: 'teacher' as const, status: 'active' as const, createdAt: '2026-10-30T00:00:00Z' };
  const auth: express.RequestHandler = (req, _res, next) => { req.user = { ...teacher, ...(req.headers['x-test-owner'] === 'other' ? { id: 'young-hints-other' } : {}) }; next(); };
  const optional: express.RequestHandler = (req, _res, next) => { if (req.headers['x-test-owner']) req.user = { ...teacher, ...(req.headers['x-test-owner'] === 'other' ? { id: 'young-hints-other' } : {}) }; next(); };
  const pass: express.RequestHandler = (_req, _res, next) => next();
  const timestamp = '2026-10-30T00:00:00Z';
  for (const [id, kind] of [[imageId, 'image'], [audioId, 'audio']] as const) await db.collection('listening_assets').doc(id).set({ id, kind, ownerId: teacher.id, status: 'active', name: id, mimeType: kind === 'image' ? 'image/png' : 'audio/mpeg', size: 128, storageKey: id, url: `/fixture/${id}`, createdAt: timestamp, updatedAt: timestamp });
  let aiCalls = 0;
  const app = express(); app.use(express.json({ limit: '2mb' }));
  app.use('/exam', createExamRouter({ db, authenticateUser: auth, authenticateOptionalUser: optional, requireStaff: pass, ticketSecret: 'young-hints-test-ticket-secret', resolveGuestProfile: async (guestId, name) => ({ id: String(guestId), displayName: String(name), status: 'active' }), writingGrading: { providers: [], recoveryIntervalMs: 0, grade: async () => { aiCalls++; throw new Error('No AI calls allowed.'); } } }));
  app.use('/listening', createListeningRouter({ db, authenticateUser: auth, authenticateOptionalUser: optional, requireStaff: pass, mediaDir: path.join(directory, 'media'), mediaPublicPrefix: '/fixture', ticketSecret: 'young-hints-mover-test-ticket-secret', resolveGuestProfile: async (guestId, name) => ({ id: String(guestId), displayName: String(name), status: 'active' }) }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.close(); await once(server, 'close'); await storage.closeSQLiteStorage(); fs.rmSync(directory, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const request = async (route: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}) => {
    const response = await fetch(base + route, { method, headers: { 'Content-Type': 'application/json', ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, data: await response.json() };
  };
  for (const moduleId of ['starter', 'flyer'] as const) await t.test(moduleId, async () => {
    const content = completedYoungListening(moduleId);
    const admin = `/exam/admin/modules/${moduleId}/papers/listening/sets`;
    const created = await request(admin, 'POST', { content }); assert.equal(created.status, 201, JSON.stringify(created.data)); assert.deepEqual(created.data.validationErrors, []);
    const saved = await request(`${admin}/${created.data.id}`, 'PUT', { content, visibility: 'public', baseRevision: created.data.draftRevision }); assert.equal(saved.status, 200, JSON.stringify(saved.data));
    assert.equal(saved.data.draftContent.parts[1].questions[0].answerPrefix, '17');
    const published = await request(`${admin}/${created.data.id}/publish`, 'POST'); assert.equal(published.status, 200, JSON.stringify(published.data));
    const student = `/exam/modules/${moduleId}/papers/listening/sets/${created.data.id}`;
    const playable = await request(student); assert.equal(playable.status, 200);
    assert.equal(playable.data.content.parts[1].questions[0].answerSuffix, 'Street');
    assert.equal(JSON.stringify(playable.data).includes('acceptedAnswers'), false);
    const guest = { guestId: `young-hints-${moduleId}`, studentName: 'Hint Learner' };
    const runSecret = `young-hints-${moduleId}-secret-1234567890`;
    const prepared = await request(`${student}/attempts/prepare`, 'POST', { ...guest, clientRunId: 'hints-v1', runSecret }); assert.equal(prepared.status, 200, JSON.stringify(prepared.data));
    assert.equal(prepared.data.versionId, published.data.version.id);
    assert.equal(JSON.stringify(prepared.data).includes('acceptedAnswers'), false);
    const nextContent = structuredClone(content); nextContent.parts[1].questions[0].answerSuffix = 'Road';
    const nextSaved = await request(`${admin}/${created.data.id}`, 'PUT', { content: nextContent, visibility: 'public', baseRevision: saved.data.draftRevision }); assert.equal(nextSaved.status, 200);
    const nextPublished = await request(`${admin}/${created.data.id}/publish`, 'POST'); assert.equal(nextPublished.status, 200); assert.notEqual(nextPublished.data.version.id, published.data.version.id);
    assert.equal((await request(student)).data.content.parts[1].questions[0].answerSuffix, 'Road');
    const oldVersion = (await db.collection('exam_set_versions').doc(published.data.version.id).get()).data();
    assert.equal(oldVersion.content.parts[1].questions[0].answerSuffix, 'Street', 'published hint metadata remains immutable');
    const answers = correctYoungAnswers(content);
    const q = content.parts[1].questions;
    answers[q[1].id] = 'wrong'; delete answers[q[2].id];
    const expectedGrade = gradeExamAttempt(content, answers);
    const submitted = await request(`${student}/attempts/submit`, 'POST', { ...guest, ticket: prepared.data.ticket, runSecret, answers }); assert.equal(submitted.status, 201, JSON.stringify(submitted.data)); assert.equal(submitted.data.score, expectedGrade.score);
    assert.equal(JSON.stringify(submitted.data).includes('correctAnswer'), false);
    const reviewPath = `${student}/attempts/${submitted.data.id}/review?${new URLSearchParams(guest)}`;
    const review = await request(reviewPath, 'GET', undefined, { 'X-Exam-Run-Secret': runSecret }); assert.equal(review.status, 200, JSON.stringify(review.data));
    assert.deepEqual(review.data.questions.filter((row: { part: number }) => row.part === 2).map((row: { correct: boolean; unanswered: boolean }) => [row.correct, row.unanswered]), [[true, false], [false, false], [false, true], [true, false], [true, false]]);
    assert.deepEqual(review.data.questions.find((row: { questionId: string }) => row.questionId === q[0].id).correctAnswer, ['Green']);
    assert.equal((await request(reviewPath)).status, 404);
    assert.equal((await request(reviewPath, 'GET', undefined, { 'X-Exam-Run-Secret': 'wrong-secret' })).status, 404);
    assert.equal((await request(reviewPath, 'GET', undefined, { 'X-Test-Owner': 'other' })).status, 404);
    await db.collection('exam_attempt_details').doc(submitted.data.id).update({ reviewPolicy: { showReviewAfterSubmit: false, policyVersion: 1 } });
    assert.equal((await request(reviewPath, 'GET', undefined, { 'X-Exam-Run-Secret': runSecret })).status, 403);
    const malformed = structuredClone(content); Object.assign(malformed.parts[1].questions[0], { answerPrefix: { invalid: true } });
    const invalidDraft = await request(admin, 'POST', { content: malformed }); assert.equal(invalidDraft.status, 201); assert.ok(invalidDraft.data.validationErrors.length);
    assert.equal((await request(`${admin}/${invalidDraft.data.id}/publish`, 'POST')).status, 400);
    const original = await request(`${admin}/${created.data.id}`); assert.equal(original.data.draftContent.parts[1].questions[0].answerPrefix, '17'); assert.equal(original.data.draftContent.parts[1].questions[0].answerSuffix, 'Road');
    const legacy = structuredClone(content); legacy.parts[1].questions.forEach(question => { delete question.answerPrefix; delete question.answerSuffix; });
    const legacyDraft = await request(admin, 'POST', { content: legacy }); assert.equal(legacyDraft.status, 201); assert.deepEqual(legacyDraft.data.validationErrors, []);
    assert.equal((await request(`${admin}/${legacyDraft.data.id}/publish`, 'POST')).status, 200);
  });
  await t.test('dedicated Movers published legacy prompt keeps printed hints through prepare, grade and review', async () => {
    const content = createDefaultMoverListeningContent();
    const part2 = content.parts[1];
    part2.questions.forEach((question, index) => { question.prompt = `Label ${index + 1}: {{${question.blanks[0].id}}}`; question.blanks[0].acceptedAnswers = ['Green']; });
    const question = part2.questions[0]; question.prompt = `Address: 17 {{${question.blanks[0].id}}} Street`;
    const p3 = content.parts[2]; if (p3.displayMode === 'connect-image') p3.correctConnections = p3.answers.slice(0, 5).map((answer, index) => ({ answerId: answer.id, pictureId: p3.pictures[index].id }));
    await db.collection('listening_sets').doc('young-hints-mover').set({ id: 'young-hints-mover', moduleId: 'mover', schemaVersion: 1, ownerId: teacher.id, title: content.title, description: content.description, level: 'Movers', status: 'published', visibility: 'public', publishedVersionId: 'young-hints-mover-v1', publishedVersionNumber: 1, createdAt: timestamp, updatedAt: timestamp });
    await db.collection('listening_set_versions').doc('young-hints-mover-v1').set({ id: 'young-hints-mover-v1', setId: 'young-hints-mover', versionNumber: 1, status: 'published', content, createdAt: timestamp, updatedAt: timestamp });
    const student = '/listening/sets/young-hints-mover';
    const playable = await request(student); assert.equal(playable.status, 200); assert.equal(playable.data.content.parts[1].questions[0].prompt, question.prompt); assert.equal(JSON.stringify(playable.data).includes('acceptedAnswers'), false);
    const guest = { guestId: 'young-hints-mover-guest', studentName: 'Mover Learner' }; const runSecret = 'young-hints-mover-secret-1234567890';
    const prepared = await request(`${student}/attempts/prepare`, 'POST', { ...guest, clientRunId: 'hints-legacy-mover', runSecret }); assert.equal(prepared.status, 200, JSON.stringify(prepared.data));
    assert.equal(prepared.data.set.content.parts[1].questions[0].prompt, question.prompt);
    const answers = createEmptyListeningAnswers(); answers.part2[question.id] = { [question.blanks[0].id]: 'Green' };
    const submitted = await request(`${student}/attempts/submit`, 'POST', { ...guest, runSecret, ticket: prepared.data.ticket, answers }); assert.equal(submitted.status, 201, JSON.stringify(submitted.data)); assert.equal(submitted.data.score, gradeListeningAttempt(content, answers).score);
    const reviewPath = `${student}/attempts/${submitted.data.id}/review?${new URLSearchParams(guest)}`;
    const review = await request(reviewPath, 'GET', undefined, { 'X-Listening-Run-Secret': runSecret }); assert.equal(review.status, 200, JSON.stringify(review.data));
    assert.equal(review.data.answerDetails[5].questionText, 'Address: 17 _____ Street'); assert.equal(review.data.answerDetails[5].correctAnswer, 'Green'); assert.equal(review.data.answerDetails[5].isCorrect, true);
    assert.equal(review.data.visualReview.parts[1].items[0].prompt, 'Address: 17 _____ Street');
    assert.equal((await request(reviewPath, 'GET', undefined, { 'X-Listening-Run-Secret': 'wrong-secret' })).status, 404);
  });
  assert.equal(aiCalls, 0);
});
