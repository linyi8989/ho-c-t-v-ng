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
import { getLearningHistoryDetail } from '../learning-history/learningHistoryService';
import { createExamRouter } from './examRouter';

const firstPassage = 'READING EXPERIENCES\n\nA — Anna\nI read in the garden.\n\nB — Ben\nI prefer the library.\n\nC — Cara\nI read on the train.\n\nD — Dan\nI enjoy reading at home.';
const explanation = 'Anna says she reads in the garden, which matches statement 16.';

function completeFceReading(): ExamPaperContent {
  const content = createDefaultExamContent(getExamPaperDefinition('fce', 'reading')!);
  content.title = 'FCE text fallback API fixture';
  content.description = 'Disposable test data.';
  content.showReviewAfterSubmit = true;
  content.timeLimitMinutes = 0;
  content.parts[0].passage = 'A complete article about reading habits and the people who enjoy books.';
  content.parts[1].passage = 'Opening [[9]] and [[10]] then [[11]] with [[12]] before [[13]] plus [[14]] and [[15]].';
  content.parts[2].passage = firstPassage;
  content.parts.forEach(part => part.questions.forEach((question, index) => {
    question.prompt = `Statement ${question.displayNumber || question.number}`;
    question.correctOptionIds = [question.options[part.part === 2 ? index : 0].id];
    question.explanation = part.part === 3 && index === 0 ? explanation : `Reading evidence for question ${question.number}.`;
  }));
  return content;
}

function correctAnswers(content: ExamPaperContent): ExamAnswers {
  return Object.fromEntries(content.parts.flatMap(part => part.questions.map(question => [question.id, question.correctOptionIds[0]])));
}

function assertNoPrivateReadingData(value: unknown) {
  const serialized = JSON.stringify(value);
  for (const field of ['correctOptionIds', 'acceptedAnswers', 'explanation']) {
    assert.equal(serialized.includes(`"${field}":`), false, `learner payload must omit ${field}`);
  }
}

test('FCE Part 3 text survives authoring and immutable publish/attempt routes without requiring media', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fce-reading-text-api-'));
  const databasePath = path.join(directory, 'app.sqlite');
  if (process.env.FCE_READING_TEXT_TEST_DB_SOURCE) fs.copyFileSync(process.env.FCE_READING_TEXT_TEST_DB_SOURCE, databasePath);
  Object.assign(process.env, {
    NODE_ENV: 'test', STORAGE_MODE: 'sqlite',
    SQLITE_DRIVER: process.env.FCE_READING_TEXT_TEST_SQLITE_DRIVER || 'sqljs',
    SQLITE_DB_PATH: databasePath, SQLITE_ALLOW_CREATE: 'true', SQLITE_ALLOW_JSON_IMPORT: 'false',
  });
  const storage = await import('../../lib/sqliteStorage');
  await storage.initializeSQLiteStorage();
  const db = new storage.SQLiteFirestore();
  const teacher = { id: 'fce-text-teacher', name: 'Teacher', email: 'fce-text@example.test', role: 'teacher' as const, status: 'active' as const, createdAt: '2026-10-31T00:00:00Z' };
  const auth: express.RequestHandler = (req, _res, next) => {
    req.user = { ...teacher, ...(req.headers['x-test-owner'] === 'other' ? { id: 'fce-text-other-teacher' } : {}) };
    next();
  };
  const optional: express.RequestHandler = (req, _res, next) => {
    if (req.headers['x-test-owner']) req.user = { ...teacher, ...(req.headers['x-test-owner'] === 'other' ? { id: 'fce-text-other-teacher' } : {}) };
    next();
  };
  let aiCalls = 0;
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use('/exam', createExamRouter({
    db, authenticateUser: auth, authenticateOptionalUser: optional, requireStaff: (_req, _res, next) => next(),
    ticketSecret: 'fce-reading-text-test-ticket-secret',
    resolveGuestProfile: async (guestId, name) => ({ id: String(guestId), displayName: String(name), status: 'active' }),
    writingGrading: { providers: [], recoveryIntervalMs: 0, grade: async () => { aiCalls++; throw new Error('Real AI disabled in FCE Reading tests.'); } },
  }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    server.close();
    await once(server, 'close');
    await storage.closeSQLiteStorage();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/exam`;
  const request = async (route: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}) => {
    const response = await fetch(base + route, {
      method, signal: AbortSignal.timeout(10_000), headers: { 'Content-Type': 'application/json', ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, data: await response.json() };
  };
  const admin = '/admin/modules/fce/papers/reading/sets';

  await t.test('text-only draft survives manual save, autosave, reopen, publish and immutable grading', async () => {
    const content = completeFceReading();
    const created = await request(admin, 'POST', { content });
    assert.equal(created.status, 201, JSON.stringify(created.data));
    assert.deepEqual(created.data.validationErrors, []);
    assert.equal(created.data.draftContent.parts[2].passage, firstPassage);
    assert.equal(created.data.draftContent.parts[2].imageAssetId, undefined);
    const route = `${admin}/${created.data.id}`;
    const saved = await request(route, 'PUT', { content, visibility: 'public', baseRevision: created.data.draftRevision });
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
    const autosaved = await request(`${route}/draft/autosave`, 'POST', { content, baseRevision: saved.data.draftRevision });
    assert.equal(autosaved.status, 200, JSON.stringify(autosaved.data));
    assert.deepEqual(autosaved.data.validationErrors, []);
    const reopened = await request(route);
    assert.equal(reopened.data.draftRevision, autosaved.data.draftRevision);
    assert.equal(reopened.data.draftContent.parts[2].passage, firstPassage);
    const stale = await request(`${route}/draft/autosave`, 'POST', { content: { ...content, title: 'Stale writer' }, baseRevision: saved.data.draftRevision });
    assert.equal(stale.status, 409);
    assert.equal((await request(route)).data.draftContent.title, content.title);
    const published = await request(`${route}/publish`, 'POST');
    assert.equal(published.status, 200, JSON.stringify(published.data));
    const firstVersionId = published.data.version.id;
    const publishedDraft = await request(route);
    assert.equal(publishedDraft.data.versions.find((version: { id: string }) => version.id === firstVersionId).content.parts[2].passage, firstPassage);
    const student = `/modules/fce/papers/reading/sets/${created.data.id}`;
    const playable = await request(student);
    assert.equal(playable.status, 200);
    assert.equal(playable.data.content.parts[2].passage, firstPassage);
    assert.equal(playable.data.content.parts[2].imageUrl, undefined);
    assertNoPrivateReadingData(playable.data);
    const guest = { guestId: 'fce-text-guest', studentName: 'Reading Learner' };
    const runSecret = 'fce-text-guest-run-secret-1234567890';
    const prepared = await request(`${student}/attempts/prepare`, 'POST', { ...guest, clientRunId: 'fce-text-first-version', runSecret });
    assert.equal(prepared.status, 200, JSON.stringify(prepared.data));
    assert.equal(prepared.data.versionId, firstVersionId);
    assertNoPrivateReadingData(prepared.data);

    const changed = structuredClone(content);
    changed.parts[2].passage = 'NEW EDITION\n\nA — Changed text for a later version.';
    changed.parts[2].questions[0].explanation = 'New explanation must not affect the previous ticket.';
    changed.parts[2].questions[0].correctOptionIds = [changed.parts[2].questions[0].options[1].id];
    const changedSave = await request(route, 'PUT', { content: changed, visibility: 'public', baseRevision: autosaved.data.draftRevision });
    assert.equal(changedSave.status, 200, JSON.stringify(changedSave.data));
    const secondPublish = await request(`${route}/publish`, 'POST');
    assert.equal(secondPublish.status, 200, JSON.stringify(secondPublish.data));
    assert.notEqual(secondPublish.data.version.id, firstVersionId);
    assert.equal((await request(student)).data.content.parts[2].passage, changed.parts[2].passage);
    const storedFirst = (await db.collection('exam_set_versions').doc(firstVersionId).get()).data();
    assert.equal(storedFirst.content.parts[2].passage, firstPassage);

    const submitted = await request(`${student}/attempts/submit`, 'POST', { ...guest, ticket: prepared.data.ticket, runSecret, answers: correctAnswers(content) });
    assert.equal(submitted.status, 201, JSON.stringify(submitted.data));
    assert.equal(submitted.data.score, 100, 'ticket must still grade against the first published version');
    assert.equal(submitted.data.correctCount, 30);
    assertNoPrivateReadingData(submitted.data);
    const reviewPath = `${student}/attempts/${submitted.data.id}/review?${new URLSearchParams(guest)}`;
    const review = await request(reviewPath, 'GET', undefined, { 'X-Exam-Run-Secret': runSecret });
    assert.equal(review.status, 200, JSON.stringify(review.data));
    assert.equal(review.data.questions.find((question: { number: number }) => question.number === 16).explanation, explanation);
    const detail = (await db.collection('exam_attempt_details').doc(submitted.data.id).get()).data();
    assert.equal(detail.versionId, firstVersionId);
    const actor = { id: guest.guestId, ownerKey: `guest:${guest.guestId}`, kind: 'guest' as const, role: 'student' as const };
    const history = await getLearningHistoryDetail(actor, submitted.data.id);
    assert.equal(history.detail?.answerDetails.length, 30);
    assert.ok(history.detail!.answerDetails.some(row => row && typeof row === 'object' && 'explanation' in row && row.explanation === explanation));
    assert.equal((await request(reviewPath)).status, 404);
    assert.equal((await request(reviewPath, 'GET', undefined, { 'X-Exam-Run-Secret': 'wrong-secret' })).status, 404);
    assert.equal((await request(reviewPath, 'GET', undefined, { 'X-Test-Owner': 'other' })).status, 404);
    assert.equal((await request(route, 'GET', undefined, { 'X-Test-Owner': 'other' })).status, 404);
    assert.equal((await request(`${route}/publish`, 'POST', undefined, { 'X-Test-Owner': 'other' })).status, 404);
    await assert.rejects(() => getLearningHistoryDetail({ ...actor, ownerKey: 'guest:another-learner' }, submitted.data.id), { status: 404 });
  });

  await t.test('missing image and passage stays an editable draft but cannot be published', async () => {
    const content = completeFceReading();
    content.parts[2].passage = '   ';
    const created = await request(admin, 'POST', { content });
    assert.equal(created.status, 201);
    assert.ok(created.data.validationErrors.some((error: string) => error.startsWith('FCE Reading Part 3:')));
    assert.equal((await request(`${admin}/${created.data.id}/publish`, 'POST')).status, 400);
  });

  await t.test('legacy image-only and dual-source papers keep owned image resolution and publication', async () => {
    const imageId = 'fce-reading-text-owned-image';
    await db.collection('listening_assets').doc(imageId).set({ id: imageId, kind: 'image', ownerId: teacher.id, status: 'active', name: 'Four reading texts', mimeType: 'image/png', size: 128, storageKey: imageId, url: '/fixture/fce-reading-source.png', createdAt: teacher.createdAt, updatedAt: teacher.createdAt });
    for (const withText of [false, true]) {
      const content = completeFceReading();
      if (!withText) delete content.parts[2].passage;
      content.parts[2].imageAssetId = imageId;
      const created = await request(admin, 'POST', { content });
      assert.equal(created.status, 201, JSON.stringify(created.data));
      assert.deepEqual(created.data.validationErrors, []);
      const saved = await request(`${admin}/${created.data.id}`, 'PUT', { content, visibility: 'public', baseRevision: created.data.draftRevision });
      assert.equal(saved.status, 200);
      assert.equal((await request(`${admin}/${created.data.id}/publish`, 'POST')).status, 200);
      const playable = await request(`/modules/fce/papers/reading/sets/${created.data.id}`);
      assert.equal(playable.status, 200);
      assert.equal(playable.data.content.parts[2].imageUrl, '/fixture/fce-reading-source.png');
      assert.equal(playable.data.content.parts[2].passage, withText ? firstPassage : undefined);
      assertNoPrivateReadingData(playable.data);
    }
    const inaccessible = completeFceReading();
    inaccessible.parts[2].imageAssetId = imageId;
    const foreignCreate = await request(admin, 'POST', { content: inaccessible }, { 'X-Test-Owner': 'other' });
    assert.equal(foreignCreate.status, 403, 'text availability must not bypass the ownership check of an attached image');
  });
  assert.equal(aiCalls, 0);
});
