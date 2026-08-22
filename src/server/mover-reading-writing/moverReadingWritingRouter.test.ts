import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import express from 'express';
import { createDefaultMoverReadingWritingContent } from '../../features/mover-reading-writing/defaultContent';
import { createEmptyMoverReadingWritingAnswers } from '../../features/mover-reading-writing/types';
import { moverReadingWritingExternalTemplate } from '../../features/mover-reading-writing/smart-import/contracts';
import { createMoverReadingWritingRouter } from './moverReadingWritingRouter';
import { getLearningHistory, getLearningHistoryDetail } from '../learning-history/learningHistoryService';

function publishedFixture() {
  const content = createDefaultMoverReadingWritingContent();
  content.title = 'Movers Reading API fixture';
  content.parts[0].wordBankAssetId = 'mrw-image-p1';
  content.parts[0].questions.forEach((question, index) => { question.prompt = `Definition ${index + 1} {{${question.id}}}`; question.acceptedAnswers = [`word ${index + 1}`]; });
  content.parts[1].sceneAssetId = 'mrw-image-p2';
  content.parts[1].questions.forEach((question, index) => { question.statement = `Statement ${index + 1}`; question.correctAnswer = index % 2 ? 'no' : 'yes'; });
  content.parts[2].sceneAssetId = 'mrw-image-p3';
  content.parts[2].questions.forEach((question, index) => {
    question.prompt = `Dialogue ${index + 1}`;
    question.options.forEach((option, optionIndex) => { option.text = `Answer ${index + 1}.${optionIndex + 1}`; });
    question.correctOptionId = question.options[1].id;
  });
  content.parts[3].wordBankAssetId = 'mrw-image-p4';
  content.parts[3].gaps.forEach((gap, index) => { gap.acceptedAnswers = [`gap ${index + 1}`]; });
  content.parts[3].titleQuestion.prompt = 'Choose a title.';
  content.parts[3].titleQuestion.options.forEach((option, index) => { option.text = `Title ${index + 1}`; });
  content.parts[3].titleQuestion.correctOptionId = content.parts[3].titleQuestion.options[2].id;
  content.parts[4].scenes.forEach((scene, sceneIndex) => {
    scene.imageAssetId = `mrw-image-p5-${sceneIndex + 1}`;
    scene.passage = `Story ${sceneIndex + 1}`;
    scene.questions.forEach((question, questionIndex) => {
      question.prompt = `Scene ${sceneIndex + 1} question ${questionIndex + 1} {{${question.id}}}`;
      question.acceptedAnswers = ['at the weekend'];
    });
  });
  content.parts[5].illustrationAssetId = 'mrw-image-p6';
  content.parts[5].optionsAssetId = 'mrw-image-p6-options';
  content.parts[5].passageTitle = 'Dolphins';
  content.parts[5].gaps.forEach((gap, index) => {
    gap.acceptedAnswers = [`word${index + 1}`];
  });
  const answers = createEmptyMoverReadingWritingAnswers();
  content.parts[0].questions.forEach(question => { answers.part1[question.id] = question.acceptedAnswers[0]; });
  content.parts[1].questions.forEach(question => { answers.part2[question.id] = question.correctAnswer; });
  content.parts[2].questions.forEach(question => { answers.part3[question.id] = question.correctOptionId; });
  content.parts[3].gaps.forEach(gap => { answers.part4.gaps[gap.id] = gap.acceptedAnswers[0]; });
  answers.part4.titleOptionId = content.parts[3].titleQuestion.correctOptionId;
  content.parts[4].scenes.forEach(scene => scene.questions.forEach(question => { answers.part5[question.id] = question.acceptedAnswers[0]; }));
  content.parts[5].gaps.forEach(gap => { answers.part6[gap.id] = gap.acceptedAnswers[0]; });
  return { content, answers };
}

test('Reading & Writing uses dedicated storage, immutable publish, sanitized play and idempotent submit', async t => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'vhomework-mover-reading-'));
  process.env.NODE_ENV = 'test';
  process.env.STORAGE_MODE = 'sqlite';
  process.env.SQLITE_DRIVER = 'sqljs';
  process.env.SQLITE_DB_PATH = path.join(temporaryDirectory, 'app.sqlite');
  process.env.SQLITE_ALLOW_CREATE = 'true';
  process.env.SQLITE_ALLOW_JSON_IMPORT = 'false';

  const storage = await import('../../lib/sqliteStorage');
  await storage.initializeSQLiteStorage();
  const db = new storage.SQLiteFirestore();
  const fixture = publishedFixture();
  const now = new Date().toISOString();
  const assetIds = [
    'mrw-image-p1', 'mrw-image-p2', 'mrw-image-p3', 'mrw-image-p4',
    'mrw-image-p5-1', 'mrw-image-p5-2', 'mrw-image-p5-3', 'mrw-image-p6', 'mrw-image-p6-options',
  ];
  for (const assetId of assetIds) {
    await db.collection('listening_assets').doc(assetId).set({
      id: assetId, ownerId: 'teacher-1', kind: 'image', name: `${assetId}.png`,
      mimeType: 'image/png', size: 100, storageKey: `${assetId}.png`, url: `/listening-media/${assetId}.png`,
      status: 'active', createdAt: now, updatedAt: now,
    });
  }
  fs.writeFileSync(path.join(temporaryDirectory, 'mrw-image-p1.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

  const teacher = { id: 'teacher-1', name: 'Teacher One', email: 'teacher@example.test', role: 'teacher' };
  const authenticateTeacher: express.RequestHandler = (req, _res, next) => { (req as any).user = teacher; next(); };
  const optional: express.RequestHandler = (req, _res, next) => {
    if (req.headers['x-test-teacher'] === 'yes') (req as any).user = teacher;
    next();
  };
  const pass: express.RequestHandler = (_req, _res, next) => next();
  const app = express();
  app.use(express.json());
  app.use('/api/mover-reading-writing', createMoverReadingWritingRouter({
    db,
    authenticateUser: authenticateTeacher,
    authenticateOptionalUser: optional,
    requireStaff: pass,
    ticketSecret: 'reading-writing-router-test-secret',
    mediaDir: temporaryDirectory,
    resolveGuestProfile: async (guestId, studentName) => ({ id: String(guestId), displayName: String(studentName), status: 'active' }),
    smartImport: {
      enabled: true,
      providers: [{ id: 'stali:gpt-5.6-sol', label: 'Stali test', enabled: true, visionEnabled: true }],
      analyzeVision: async (prompt, images, options) => {
        assert.match(prompt, /answer_key image is the only authority/);
        assert.deepEqual(images.map(image => image.role), ['word_bank', 'questions', 'answer_key']);
        assert.equal(options.schemaName, 'mover_rw_part_1_v2');
        return { provider: 'stali:gpt-5.6-sol', text: moverReadingWritingExternalTemplate(1) };
      },
    },
  }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    server.close();
    await once(server, 'close');
    await storage.closeSQLiteStorage();
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  });
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/mover-reading-writing`;

  const capabilitiesResponse = await fetch(`${baseUrl}/capabilities`);
  assert.equal(capabilitiesResponse.status, 200);
  assert.equal((await capabilitiesResponse.json() as any).smartImport.providers.length, 1);
  const invalidImageResponse = await fetch(`${baseUrl}/admin/smart-import/sources`, {
    method: 'POST',
    headers: { 'Content-Type': 'image/png' },
    body: Buffer.from('not-an-image'),
  });
  assert.equal(invalidImageResponse.status, 415);

  const staleHashResponse = await fetch(`${baseUrl}/admin/smart-import/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      moduleId: 'mover',
      paperId: 'reading-writing',
      part: 1,
      currentPart: fixture.content.parts[0],
      basePartHash: '0'.repeat(64),
      preferredProvider: 'stali:gpt-5.6-sol',
      sources: [],
    }),
  });
  assert.equal(staleHashResponse.status, 409);

  const missingRolesResponse = await fetch(`${baseUrl}/admin/smart-import/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      moduleId: 'mover',
      paperId: 'reading-writing',
      part: 1,
      currentPart: fixture.content.parts[0],
      basePartHash: crypto.createHash('sha256').update(JSON.stringify(fixture.content.parts[0])).digest('hex'),
      preferredProvider: 'stali:gpt-5.6-sol',
      sources: [],
    }),
  });
  assert.equal(missingRolesResponse.status, 400);

  const uploadTemporary = async () => {
    const response = await fetch(`${baseUrl}/admin/smart-import/sources`, {
      method: 'POST',
      headers: { 'Content-Type': 'image/png' },
      body: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    });
    assert.equal(response.status, 201);
    return (await response.json() as any).token as string;
  };
  const questionsToken = await uploadTemporary();
  const answerKeyToken = await uploadTemporary();
  const smartImportResponse = await fetch(`${baseUrl}/admin/smart-import/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      moduleId: 'mover',
      paperId: 'reading-writing',
      part: 1,
      currentPart: fixture.content.parts[0],
      basePartHash: crypto.createHash('sha256').update(JSON.stringify(fixture.content.parts[0])).digest('hex'),
      preferredProvider: 'stali:gpt-5.6-sol',
      sources: [
        { role: 'word_bank', assetId: 'mrw-image-p1' },
        { role: 'questions', transientToken: questionsToken },
        { role: 'answer_key', transientToken: answerKeyToken },
      ],
    }),
  });
  assert.equal(smartImportResponse.status, 200);
  const smartImportCandidate = await smartImportResponse.json() as any;
  assert.equal(smartImportCandidate.part, 1);
  assert.equal(smartImportCandidate.provider, 'stali:gpt-5.6-sol');
  assert.equal(fs.readdirSync(path.join(temporaryDirectory, '.tmp-mover-reading-import')).length, 0);

  const createdResponse = await fetch(`${baseUrl}/admin/sets`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: fixture.content }),
  });
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json() as any;
  const updatedResponse = await fetch(`${baseUrl}/admin/sets/${created.id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: fixture.content, visibility: 'public', baseRevision: created.draftRevision }),
  });
  assert.equal(updatedResponse.status, 200);
  const updated = await updatedResponse.json() as any;
  const autosaveResponse = await fetch(`${baseUrl}/admin/sets/${created.id}/draft/autosave`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: fixture.content, visibility: 'public', baseRevision: updated.draftRevision }),
  });
  assert.equal(autosaveResponse.status, 200);
  const autosaved = await autosaveResponse.json() as any;
  assert.equal(autosaved.draftRevision, updated.draftRevision + 1);
  const staleAutosaveResponse = await fetch(`${baseUrl}/admin/sets/${created.id}/draft/autosave`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: fixture.content, visibility: 'public', baseRevision: updated.draftRevision }),
  });
  assert.equal(staleAutosaveResponse.status, 409);
  const publishedResponse = await fetch(`${baseUrl}/admin/sets/${created.id}/publish`, { method: 'POST' });
  assert.equal(publishedResponse.status, 200);
  const published = await publishedResponse.json() as any;
  assert.equal(published.version.versionNumber, 1);
  assert.equal(published.version.content.parts.length, 6);

  const playableResponse = await fetch(`${baseUrl}/sets/${created.id}`);
  assert.equal(playableResponse.status, 200);
  const playable = await playableResponse.json() as any;
  assert.equal(JSON.stringify(playable).includes('acceptedAnswers'), false);
  assert.equal(JSON.stringify(playable).includes('correctAnswer'), false);
  assert.equal(JSON.stringify(playable).includes('correctOptionId'), false);
  assert.equal(playable.content.parts[5].optionsUrl, '/listening-media/mrw-image-p6-options.png');
  assert.equal('passageSourceAssetId' in playable.content.parts[5], false);

  const identity = { guestId: 'guest-reading', studentName: 'Lan Anh' };
  const prepareResponse = await fetch(`${baseUrl}/sets/${created.id}/attempts/prepare`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...identity, clientRunId: 'reading-client-run', runSecret: 'reading-run-secret' }),
  });
  assert.equal(prepareResponse.status, 200);
  const prepared = await prepareResponse.json() as any;
  const submission = { ...identity, ticket: prepared.ticket, runSecret: 'reading-run-secret', answers: fixture.answers };
  const submitResponse = await fetch(`${baseUrl}/sets/${created.id}/attempts/submit`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(submission),
  });
  assert.equal(submitResponse.status, 201);
  const result = await submitResponse.json() as any;
  assert.equal(result.score, 100);
  assert.equal(result.correctCount, 40);
  assert.equal(JSON.stringify(result).includes('correctAnswer'), false);

  const retryResponse = await fetch(`${baseUrl}/sets/${created.id}/attempts/submit`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(submission),
  });
  assert.equal(retryResponse.status, 200);
  assert.equal((await retryResponse.json() as any).id, result.id);

  const forbiddenReview = await fetch(`${baseUrl}/sets/${created.id}/attempts/${result.id}/review?guestId=${identity.guestId}&studentName=Lan%20Anh`, {
    headers: { 'X-Mover-Reading-Run-Secret': 'wrong' },
  });
  assert.equal(forbiddenReview.status, 404);
  const reviewResponse = await fetch(`${baseUrl}/sets/${created.id}/attempts/${result.id}/review?guestId=${identity.guestId}&studentName=Lan%20Anh`, {
    headers: { 'X-Mover-Reading-Run-Secret': submission.runSecret },
  });
  assert.equal(reviewResponse.status, 200);
  const review = await reviewResponse.json() as any;
  assert.equal(review.questions.length, 40);
  assert.equal(review.questions[0].correctAnswer, 'word 1');
  assert.equal(review.visualReview.schemaVersion, 1);
  assert.deepEqual(review.visualReview.parts.map((part: any) => part.part), [1, 2, 3, 4, 5, 6]);
  assert.equal(JSON.stringify(review.visualReview).includes('questionId'), false);
  assert.equal(JSON.stringify(review.visualReview).includes('correctOptionId'), false);
  assert.equal(JSON.stringify(review.visualReview).includes('acceptedAnswers'), false);

  await db.collection('mover_reading_attempt_details').doc(result.id).update({
    reviewPolicy: { showReviewAfterSubmit: false },
  });
  const policyDeniedReview = await fetch(`${baseUrl}/sets/${created.id}/attempts/${result.id}/review?guestId=${identity.guestId}&studentName=Lan%20Anh`, {
    headers: { 'X-Mover-Reading-Run-Secret': submission.runSecret },
  });
  assert.equal(policyDeniedReview.status, 403);

  const historyActor = {
    id: identity.guestId,
    ownerKey: `guest:${identity.guestId}`,
    kind: 'guest' as const,
    role: 'student' as const,
  };
  const history = await getLearningHistory(historyActor, {
    page: 1,
    pageSize: 20,
    historyType: 'all',
    sourceType: 'reading_writing',
    groupByAssignment: false,
  });
  assert.equal(history.items.length, 1);
  assert.equal(history.items[0].sourceType, 'reading_writing');
  assert.equal(history.items[0].lessonType, 'mover_reading_set');
  assert.equal(history.items[0].totalQuestions, 40);
  const hiddenHistoryDetail = await getLearningHistoryDetail(historyActor, result.id);
  assert.equal('visualReview' in (hiddenHistoryDetail.detail?.extraDetails || {}), false);
  assert.equal(JSON.stringify(hiddenHistoryDetail.detail).includes('correctAnswer'), false);

  await db.collection('mover_reading_attempt_details').doc(result.id).update({
    reviewPolicy: { showReviewAfterSubmit: true },
  });
  const historyDetail = await getLearningHistoryDetail(historyActor, result.id);
  assert.equal(historyDetail.detailStatus, 'available');
  assert.equal(historyDetail.detail?.answerDetails.length, 40);
  assert.equal((historyDetail.detail?.answerDetails[0] as any).correctAnswer, 'word 1');
  assert.equal((historyDetail.detail?.extraDetails as any).visualReview.schemaVersion, 1);

  const diagnostics = await storage.getSQLiteDiagnostics();
  assert.equal(diagnostics.tableCounts.mover_reading_sets, 1);
  assert.equal(diagnostics.tableCounts.mover_reading_set_versions, 1);
  assert.equal(diagnostics.tableCounts.mover_reading_attempts, 1);
  assert.equal(diagnostics.tableCounts.listening_sets, 0);
  assert.equal(diagnostics.tableCounts.listening_attempts, 0);
});
