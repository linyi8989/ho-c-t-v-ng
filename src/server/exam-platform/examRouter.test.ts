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
import { getLearningHistory, getLearningHistoryDetail } from '../learning-history/learningHistoryService';
import { createExamRouter } from './examRouter';

function completeContent(moduleId: 'starter' | 'pet', paperId: 'reading-writing' | 'writing') {
  const definition = getExamPaperDefinition(moduleId, paperId)!;
  const content = createDefaultExamContent(definition);
  content.title = `${definition.level} integration fixture`;
  content.showReviewAfterSubmit = true;
  content.parts.forEach(part => part.questions.forEach(question => {
    question.prompt = `Question ${question.number}`;
    if (question.type === 'long-writing') {
      question.rubric = 'Teacher rubric';
    } else if (question.options.length) {
      question.correctOptionIds = [question.options[0].id];
    } else {
      question.acceptedAnswers = ['answer'];
    }
  }));
  return content;
}

function correctAnswers(content: ExamPaperContent): ExamAnswers {
  return Object.fromEntries(content.parts.flatMap(part => part.questions.map(question => [
    question.id,
    question.type === 'long-writing'
      ? 'A complete student response.'
      : question.correctOptionIds[0] || question.acceptedAnswers[0],
  ])));
}

test('generic exam API preserves immutable publish, private grading and manual Writing workflow', async t => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'vhomework-exam-platform-'));
  process.env.NODE_ENV = 'test';
  process.env.STORAGE_MODE = 'sqlite';
  process.env.SQLITE_DRIVER = 'sqljs';
  process.env.SQLITE_DB_PATH = path.join(temporaryDirectory, 'app.sqlite');
  process.env.SQLITE_ALLOW_CREATE = 'true';
  process.env.SQLITE_ALLOW_JSON_IMPORT = 'false';

  const storage = await import('../../lib/sqliteStorage');
  await storage.initializeSQLiteStorage();
  const db = new storage.SQLiteFirestore();
  const assetTimestamp = new Date().toISOString();
  await db.collection('listening_assets').doc('exam-image-1').set({
    id: 'exam-image-1', ownerId: 'teacher-1', kind: 'image', name: 'exam-image.png',
    mimeType: 'image/png', size: 128, storageKey: 'exam-image.png', url: '/listening-media/exam-image.png',
    status: 'active', createdAt: assetTimestamp, updatedAt: assetTimestamp,
  });
  const teacher = { id: 'teacher-1', name: 'Teacher One', email: 'teacher@example.test', role: 'teacher' };
  const otherTeacher = { id: 'teacher-2', name: 'Teacher Two', email: 'teacher2@example.test', role: 'teacher' };
  const authenticateTeacher: express.RequestHandler = (req, _res, next) => { (req as any).user = teacher; next(); };
  const authenticateOptional: express.RequestHandler = (req, _res, next) => {
    if (req.headers['x-test-teacher'] === 'owner') (req as any).user = teacher;
    if (req.headers['x-test-teacher'] === 'other') (req as any).user = otherTeacher;
    next();
  };
  const pass: express.RequestHandler = (_req, _res, next) => next();
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use('/api/exam-platform', createExamRouter({
    db,
    authenticateUser: authenticateTeacher,
    authenticateOptionalUser: authenticateOptional,
    requireStaff: pass,
    ticketSecret: 'generic-exam-router-test-secret',
    resolveGuestProfile: async (guestId, studentName) => ({ id: String(guestId), displayName: String(studentName), status: 'active' }),
  }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    server.close();
    await once(server, 'close');
    await storage.closeSQLiteStorage();
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  });
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/exam-platform`;

  const objectiveContent = completeContent('starter', 'reading-writing');
  objectiveContent.parts[0].imageAssetId = 'exam-image-1';
  const createResponse = await fetch(`${baseUrl}/admin/modules/starter/papers/reading-writing/sets`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: objectiveContent }),
  });
  assert.equal(createResponse.status, 201);
  const created = await createResponse.json() as any;
  assert.equal(created.validationErrors.length, 0);

  const updateResponse = await fetch(`${baseUrl}/admin/modules/starter/papers/reading-writing/sets/${created.id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: objectiveContent, visibility: 'public', baseRevision: created.draftRevision }),
  });
  assert.equal(updateResponse.status, 200);
  const updated = await updateResponse.json() as any;

  const staleResponse = await fetch(`${baseUrl}/admin/modules/starter/papers/reading-writing/sets/${created.id}/draft/autosave`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: objectiveContent, visibility: 'public', baseRevision: created.draftRevision }),
  });
  assert.equal(staleResponse.status, 409);

  const publishResponse = await fetch(`${baseUrl}/admin/modules/starter/papers/reading-writing/sets/${created.id}/publish`, { method: 'POST' });
  assert.equal(publishResponse.status, 200);
  assert.equal((await publishResponse.json() as any).version.versionNumber, 1);
  const assetUsages = await db.collection('exam_asset_usages').where('assetId', '==', 'exam-image-1').get();
  assert.equal(assetUsages.empty, false);
  await db.collection('assignments').doc('exam-assignment-1').set({
    id: 'exam-assignment-1',
    resourceType: 'exam',
    resourceId: created.id,
    examSetId: created.id,
    shareToken: 'exam-assignment-token',
    assignmentSlug: 'exam-assignment-token',
    status: 'active',
    classId: 'class-1',
    className: 'Class One',
    title: 'Starter assigned paper',
    dueDate: '2026-12-31',
    createdBy: 'teacher-1',
    createdAt: new Date().toISOString(),
  });

  objectiveContent.title = 'Changed draft after publish';
  const draftAfterPublish = await fetch(`${baseUrl}/admin/modules/starter/papers/reading-writing/sets/${created.id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: objectiveContent, visibility: 'public', baseRevision: updated.draftRevision }),
  });
  assert.equal(draftAfterPublish.status, 200);

  const playableResponse = await fetch(`${baseUrl}/modules/starter/papers/reading-writing/sets/${created.id}`);
  assert.equal(playableResponse.status, 200);
  const playable = await playableResponse.json() as any;
  assert.equal(playable.content.title.includes('integration fixture'), true, 'published version must remain immutable');
  assert.equal(JSON.stringify(playable).includes('correctOptionIds'), false);
  assert.equal(JSON.stringify(playable).includes('acceptedAnswers'), false);
  assert.equal(JSON.stringify(playable).includes('modelAnswer'), false);

  const smartImportResponse = await fetch(`${baseUrl}/admin/modules/starter/papers/reading-writing/smart-import/validate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      partIndex: 0,
      currentPart: objectiveContent.parts[0],
      part: {
        title: 'Imported part',
        questions: objectiveContent.parts[0].questions.map((_: any, index: number) => ({
          type: 'true-false', prompt: `Imported ${index + 1}`, options: ['True', 'False'],
        })),
      },
    }),
  });
  const smartImport = await smartImportResponse.json() as any;
  assert.equal(smartImportResponse.status, 200, JSON.stringify(smartImport));
  assert.equal(smartImport.warnings.length >= 5, true);

  const identity = { guestId: 'guest-exam-1', studentName: 'Lan Anh' };
  const prepareResponse = await fetch(`${baseUrl}/modules/starter/papers/reading-writing/sets/${created.id}/attempts/prepare`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...identity, shareToken: 'exam-assignment-token', clientRunId: 'objective-client-run', runSecret: 'objective-run-secret-123456' }),
  });
  assert.equal(prepareResponse.status, 200);
  const prepared = await prepareResponse.json() as any;
  const submission = {
    ...identity,
    ticket: prepared.ticket,
    runSecret: 'objective-run-secret-123456',
    answers: correctAnswers(objectiveContent),
  };
  const submitResponse = await fetch(`${baseUrl}/modules/starter/papers/reading-writing/sets/${created.id}/attempts/submit`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(submission),
  });
  const attempt = await submitResponse.json() as any;
  assert.equal(submitResponse.status, 201, JSON.stringify(attempt));
  assert.equal(attempt.score, 100);
  assert.equal(attempt.correctCount, 25);
  assert.equal(JSON.stringify(attempt).includes('correctAnswer'), false);

  const retryResponse = await fetch(`${baseUrl}/modules/starter/papers/reading-writing/sets/${created.id}/attempts/submit`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(submission),
  });
  assert.equal(retryResponse.status, 200);
  assert.equal((await retryResponse.json() as any).id, attempt.id);

  const reviewResponse = await fetch(`${baseUrl}/modules/starter/papers/reading-writing/sets/${created.id}/attempts/${attempt.id}/review?guestId=guest-exam-1&studentName=Lan%20Anh`, {
    headers: { 'X-Exam-Run-Secret': 'objective-run-secret-123456' },
  });
  assert.equal(reviewResponse.status, 200);
  assert.equal((await reviewResponse.json() as any).questions.length, 25);
  const unauthorizedStaffReview = await fetch(`${baseUrl}/modules/starter/papers/reading-writing/sets/${created.id}/attempts/${attempt.id}/review`, {
    headers: { 'X-Test-Teacher': 'other' },
  });
  assert.equal(unauthorizedStaffReview.status, 404);

  const historyActor = {
    id: identity.guestId,
    ownerKey: `guest:${identity.guestId}`,
    kind: 'guest' as const,
    role: 'student' as const,
  };
  const historyFilters = {
    page: 1 as const,
    pageSize: 20 as const,
    historyType: 'all' as const,
    sourceType: 'exam' as const,
    groupByAssignment: false,
  };
  const objectiveHistory = await getLearningHistory(historyActor, historyFilters);
  assert.equal(objectiveHistory.items.length, 1);
  assert.equal(objectiveHistory.items[0].sourceType, 'exam');
  assert.equal(objectiveHistory.items[0].lessonType, 'exam_set');
  assert.equal(objectiveHistory.items[0].totalQuestions, 25);
  assert.equal(objectiveHistory.items[0].assignmentId, 'exam-assignment-1');
  const objectiveHistoryDetail = await getLearningHistoryDetail(historyActor, attempt.id);
  assert.equal(objectiveHistoryDetail.detail?.answerDetails.length, 25);

  const writingContent = completeContent('pet', 'writing');
  const writingCreatedResponse = await fetch(`${baseUrl}/admin/modules/pet/papers/writing/sets`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: writingContent }),
  });
  const writingCreated = await writingCreatedResponse.json() as any;
  const writingUpdatedResponse = await fetch(`${baseUrl}/admin/modules/pet/papers/writing/sets/${writingCreated.id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: writingContent, visibility: 'public', baseRevision: writingCreated.draftRevision }),
  });
  assert.equal(writingUpdatedResponse.status, 200);
  assert.equal((await fetch(`${baseUrl}/admin/modules/pet/papers/writing/sets/${writingCreated.id}/publish`, { method: 'POST' })).status, 200);
  const writingPrepare = await fetch(`${baseUrl}/modules/pet/papers/writing/sets/${writingCreated.id}/attempts/prepare`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...identity, clientRunId: 'writing-client-run', runSecret: 'writing-run-secret-12345678' }),
  });
  const writingTicket = await writingPrepare.json() as any;
  const writingSubmit = await fetch(`${baseUrl}/modules/pet/papers/writing/sets/${writingCreated.id}/attempts/submit`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...identity, ticket: writingTicket.ticket, runSecret: 'writing-run-secret-12345678', answers: correctAnswers(writingContent) }),
  });
  assert.equal(writingSubmit.status, 201);
  const writingAttempt = await writingSubmit.json() as any;
  assert.equal(writingAttempt.status, 'pending_review');
  assert.equal((await getLearningHistory(historyActor, historyFilters)).items.length, 1);

  const missingGrade = await fetch(`${baseUrl}/admin/modules/pet/papers/writing/sets/${writingCreated.id}/attempts/${writingAttempt.id}/manual-grade`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ grades: {} }),
  });
  assert.equal(missingGrade.status, 400);
  const writingResults = await (await fetch(`${baseUrl}/admin/modules/pet/papers/writing/sets/${writingCreated.id}/results`)).json() as any;
  const gradePayload = Object.fromEntries(writingResults.attempts[0].questions.map((question: any) => [question.questionId, question.maxPoints]));
  const manualGrade = await fetch(`${baseUrl}/admin/modules/pet/papers/writing/sets/${writingCreated.id}/attempts/${writingAttempt.id}/manual-grade`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ grades: gradePayload }),
  });
  assert.equal(manualGrade.status, 200);
  assert.equal((await manualGrade.json() as any).score, 100);
  assert.equal((await getLearningHistory(historyActor, historyFilters)).items.length, 2);

  const cloneResponse = await fetch(`${baseUrl}/admin/modules/starter/papers/reading-writing/sets/${created.id}/clone`, { method: 'POST' });
  assert.equal(cloneResponse.status, 201);
  assert.equal((await cloneResponse.json() as any).status, 'draft');
  const archiveResponse = await fetch(`${baseUrl}/admin/modules/starter/papers/reading-writing/sets/${created.id}`, { method: 'DELETE' });
  assert.equal(archiveResponse.status, 200);
  assert.equal((await archiveResponse.json() as any).recoverable, true);
});
