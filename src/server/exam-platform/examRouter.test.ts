import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import express from 'express';
import { createDefaultExamContent, getExamPaperDefinition } from '../../features/exam-platform/definitions';
import { importUniversalExamBundle } from '../../features/exam-platform/universalImport';
import type { ExamAnswers, ExamPaperContent } from '../../features/exam-platform/types';
import { getLearningHistory, getLearningHistoryDetail } from '../learning-history/learningHistoryService';
import { createExamRouter } from './examRouter';

function completeContent(moduleId: 'starter' | 'pet' | 'ket', paperId: 'reading-writing' | 'writing') {
  const definition = getExamPaperDefinition(moduleId, paperId)!;
  const content = createDefaultExamContent(definition);
  content.title = `${definition.level} integration fixture`;
  content.showReviewAfterSubmit = true;
  content.parts.forEach(part => {
    if (moduleId === 'starter' && paperId === 'reading-writing') {
      if (part.part <= 4) { part.imageAssetId = 'exam-image-1'; part.imageUrl = '/listening-media/exam-image.png'; }
      if (part.part === 1 && part.examples?.[0]) { part.examples[0].imageAssetId = 'exam-image-1'; part.examples[0].imageUrl = '/listening-media/exam-image.png'; }
      if (part.part === 5) part.readingScenes?.forEach(scene => { scene.imageAssetId = 'exam-image-1'; scene.imageUrl = '/listening-media/exam-image.png'; });
    }
    if (moduleId === 'ket' && paperId === 'reading-writing') {
      if ([1, 4, 5].includes(part.part)) {
        part.imageAssetId = 'exam-image-1';
        part.imageUrl = '/listening-media/exam-image.png';
      }
      if (part.part === 2) part.examples = [{ prompt: 'Printed example question', answer: 'A' }];
      if ([6, 7, 8].includes(part.part)) part.passage = `Printed KET Part ${part.part} instructions, source text and example.`;
      if (part.part === 9) part.passage = 'Printed writing task and all required hints.';
      if (part.part === 1 && part.readingScenes?.[0]) {
        part.readingScenes[0].imageAssetId = 'exam-image-1';
        part.readingScenes[0].imageUrl = '/listening-media/exam-image.png';
      }
      if (part.part === 3 && part.blocks?.length === 2) {
        part.blocks.forEach(block => { block.imageAssetId = 'exam-image-1'; block.imageUrl = '/listening-media/exam-image.png'; });
        if (part.blocks[1].readingScenes?.[0]) {
          part.blocks[1].readingScenes[0].imageAssetId = 'exam-image-1';
          part.blocks[1].readingScenes[0].imageUrl = '/listening-media/exam-image.png';
        }
      }
    }
    part.questions.forEach(question => {
      question.prompt = `Question ${question.number}`;
      if (question.type === 'long-writing') {
        question.rubric = 'Teacher rubric';
      } else if (question.options.length) {
        question.correctOptionIds = [question.options[0].id];
      } else {
        const ketLetterIds = new Set(part.part === 3 ? part.blocks?.[1]?.questionIds || [] : []);
        question.acceptedAnswers = moduleId === 'ket' && (part.part === 1 || ketLetterIds.has(question.id)) ? ['A'] : ['answer'];
        if (moduleId === 'ket' && part.part === 6) {
          question.answerPrefix = 'a';
          question.answerLength = 6;
          question.acceptedAnswers = ['nswer'];
        }
      }
    });
  });
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
    writingGrading: {
      providers: [{ id: 'stali:gpt-5.6-sol', label: 'Stali test', enabled: true }],
      grade: async request => {
        assert.equal(request.providerId, 'stali:gpt-5.6-sol');
        assert.match(request.taskContext, /writing task|task/i);
        return { providerId: 'stali:gpt-5.6-sol', score: 8, sentenceCount: 3, grammarErrors: ['verb form'], vocabularyErrors: [], feedback: 'The task is complete. Three sentences are used. One verb form needs correction. Vocabulary is appropriate.' };
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
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/exam-platform`;

  const objectiveContent = completeContent('starter', 'reading-writing');
  objectiveContent.parts[0].imageAssetId = 'exam-image-1';
  objectiveContent.parts[0].audioTranscript = 'Private transcript for Part 1.';
  const createResponse = await fetch(`${baseUrl}/admin/modules/starter/papers/reading-writing/sets`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: objectiveContent }),
  });
  assert.equal(createResponse.status, 201);
  const created = await createResponse.json() as any;
  assert.equal(created.validationErrors.length, 0);
  await db.collection('exam_sets').doc(created.id).update({ schemaVersion: 1 });

  const updateResponse = await fetch(`${baseUrl}/admin/modules/starter/papers/reading-writing/sets/${created.id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: objectiveContent, visibility: 'public', baseRevision: created.draftRevision }),
  });
  assert.equal(updateResponse.status, 200);
  const updated = await updateResponse.json() as any;
  assert.equal(updated.schemaVersion, objectiveContent.schemaVersion, 'saving a v2 draft must synchronize the set schemaVersion');

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
  assert.equal(JSON.stringify(playable).includes('Private transcript for Part 1.'), false, 'playable content must not expose transcripts before submission');

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
  assert.ok(prepared.deadlineAt, 'timed practice fixture must have a deadline');
  const realDateNow = Date.now;
  Date.now = () => new Date(prepared.deadlineAt).getTime() + 3 * 60_000;
  let submitResponse: Response;
  try {
    submitResponse = await fetch(`${baseUrl}/modules/starter/papers/reading-writing/sets/${created.id}/attempts/submit`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(submission),
    });
  } finally {
    Date.now = realDateNow;
  }
  const attempt = await submitResponse.json() as any;
  assert.equal(submitResponse.status, 201, JSON.stringify(attempt));
  assert.equal(attempt.timedOut, true, 'an expired deadline must be recorded without blocking submission');
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
  const reviewPayload = await reviewResponse.json() as any;
  assert.equal(reviewPayload.questions.length, 25);
  assert.deepEqual(reviewPayload.transcripts, [{ part: 1, text: 'Private transcript for Part 1.' }]);
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

  const ketContent = completeContent('ket', 'reading-writing');
  const ketCreatedResponse = await fetch(`${baseUrl}/admin/modules/ket/papers/reading-writing/sets`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: ketContent }),
  });
  const ketCreated = await ketCreatedResponse.json() as any;
  assert.equal(ketCreatedResponse.status, 201, JSON.stringify(ketCreated));
  assert.deepEqual(ketCreated.validationErrors, []);
  const ketUpdated = await fetch(`${baseUrl}/admin/modules/ket/papers/reading-writing/sets/${ketCreated.id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: ketContent, visibility: 'public', baseRevision: ketCreated.draftRevision }),
  });
  assert.equal(ketUpdated.status, 200);
  assert.equal((await fetch(`${baseUrl}/admin/modules/ket/papers/reading-writing/sets/${ketCreated.id}/publish`, { method: 'POST' })).status, 200);
  const ketPrepare = await fetch(`${baseUrl}/modules/ket/papers/reading-writing/sets/${ketCreated.id}/attempts/prepare`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...identity, clientRunId: 'ket-writing-client-run', runSecret: 'ket-writing-run-secret-12345678' }),
  });
  const ketTicket = await ketPrepare.json() as any;
  const ketSubmit = await fetch(`${baseUrl}/modules/ket/papers/reading-writing/sets/${ketCreated.id}/attempts/submit`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...identity, ticket: ketTicket.ticket, runSecret: 'ket-writing-run-secret-12345678', answers: correctAnswers(ketContent) }),
  });
  const ketAttempt = await ketSubmit.json() as any;
  assert.equal(ketSubmit.status, 201, JSON.stringify(ketAttempt));
  assert.equal(ketAttempt.status, 'completed');
  assert.equal(ketAttempt.aiGradingStatus, 'completed');
  assert.equal(ketAttempt.score, 97);
  const ketReviewResponse = await fetch(`${baseUrl}/modules/ket/papers/reading-writing/sets/${ketCreated.id}/attempts/${ketAttempt.id}/review`, { headers: { 'X-Test-Teacher': 'owner' } });
  const ketReview = await ketReviewResponse.json() as any;
  assert.equal(ketReviewResponse.status, 200);
  const ketWriting = ketReview.questions.find((question: any) => question.part === 9);
  assert.equal(ketWriting.writingScore, 8);
  assert.deepEqual(ketWriting.grammarErrors, ['verb form']);
  assert.match(ketWriting.aiFeedback, /task is complete/i);

  const drawCurrent = createDefaultExamContent(getExamPaperDefinition('pet', 'reading')!);
  const drawContent = importUniversalExamBundle(drawCurrent, JSON.stringify({
    format: 'exam-bundle-import-v2', formatVersion: 2, exam: { moduleId: 'pet' }, papers: [{ paperId: 'reading', parts: [{
      partNumber: 1, title: 'Draw', instruction: 'Draw on the picture.', blocks: [{
        blockNumber: 1, title: 'Draw a flower', instruction: 'Draw.', interaction: { family: 'scene', subtype: 'draw-object', variant: 'draw', schemaVersion: 2 },
        questions: [{ prompt: "Draw a flower on the dog's head.", drawObject: 'flower', targetDescription: "on the dog's head", answerSource: 'official-answer-key', answerKey: {} }],
      }],
    }] }],
  })).content;
  const drawBlock = drawContent.parts[0].blocks![0];
  drawBlock.imageAssetId = 'exam-image-1';
  if (drawBlock.interactionLayout?.kind !== 'scene-draw-v1') assert.fail('Expected scene draw layout');
  drawBlock.interactionLayout.targets[0].tokenAssetId = 'exam-image-1';
  drawBlock.interactionLayout.targets[0].geometryConfirmedByTeacher = true;
  const drawCreatedResponse = await fetch(`${baseUrl}/admin/modules/pet/papers/reading/sets`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: drawContent }),
  });
  const drawCreated = await drawCreatedResponse.json() as any;
  assert.equal(drawCreatedResponse.status, 201, JSON.stringify(drawCreated));
  assert.deepEqual(drawCreated.validationErrors, []);
  assert.equal((await fetch(`${baseUrl}/admin/modules/pet/papers/reading/sets/${drawCreated.id}/publish`, { method: 'POST' })).status, 200);
  const drawPlayableResponse = await fetch(`${baseUrl}/modules/pet/papers/reading/sets/${drawCreated.id}`, { headers: { 'X-Test-Teacher': 'owner' } });
  const drawPlayable = await drawPlayableResponse.json() as any;
  assert.equal(drawPlayableResponse.status, 200, JSON.stringify(drawPlayable));
  const safeDrawTarget = drawPlayable.content.parts[0].blocks[0].interactionLayout.targets[0];
  assert.equal(safeDrawTarget.tokenUrl, '/listening-media/exam-image.png');
  assert.equal(safeDrawTarget.targetRegion, undefined);
  const drawUsages = await db.collection('exam_asset_usages').where('versionId', '==', drawPlayable.versionId).get();
  assert.equal(drawUsages.docs.some((document: any) => document.data()?.role === 'draw-token'), true);

  const incompletePrepareResponse = await fetch(`${baseUrl}/modules/starter/papers/reading-writing/sets/${created.id}/attempts/prepare`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...identity, shareToken: 'exam-assignment-token', clientRunId: 'incomplete-client-run', runSecret: 'incomplete-run-secret-123456' }),
  });
  const incompletePrepared = await incompletePrepareResponse.json() as any;
  const incompleteSubmitResponse = await fetch(`${baseUrl}/modules/starter/papers/reading-writing/sets/${created.id}/attempts/submit`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...identity, ticket: incompletePrepared.ticket, runSecret: 'incomplete-run-secret-123456', answers: {} }),
  });
  const incompleteAttempt = await incompleteSubmitResponse.json() as any;
  assert.equal(incompleteSubmitResponse.status, 201, JSON.stringify(incompleteAttempt));
  assert.equal(incompleteAttempt.unansweredCount, 25, 'students may submit an unfinished paper');

  const cloneResponse = await fetch(`${baseUrl}/admin/modules/starter/papers/reading-writing/sets/${created.id}/clone`, { method: 'POST' });
  assert.equal(cloneResponse.status, 201);
  assert.equal((await cloneResponse.json() as any).status, 'draft');
  const archiveResponse = await fetch(`${baseUrl}/admin/modules/starter/papers/reading-writing/sets/${created.id}`, { method: 'DELETE' });
  assert.equal(archiveResponse.status, 200);
  assert.equal((await archiveResponse.json() as any).recoverable, true);
});
