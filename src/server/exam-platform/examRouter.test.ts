import assert from 'node:assert/strict';
import crypto from 'node:crypto';
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

const EXAM_ROUTER_TEST_TICKET_SECRET = 'generic-exam-router-test-secret';

function ticketPayload(ticket: string) {
  const [encoded] = ticket.split('.');
  return JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as Record<string, any>;
}

function signedTicket(payload: Record<string, any>) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', EXAM_ROUTER_TEST_TICKET_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function completeContent(moduleId: 'starter' | 'pet' | 'ket' | 'writing', paperId: 'reading-writing' | 'writing') {
  const definition = getExamPaperDefinition(moduleId, paperId)!;
  const content = createDefaultExamContent(definition);
  content.title = `${definition.level} integration fixture`;
  content.showReviewAfterSubmit = true;
  content.parts.forEach(part => {
    if (moduleId === 'starter' && paperId === 'reading-writing') {
      if (part.part <= 4) { part.imageAssetId = 'exam-image-1'; part.imageUrl = '/listening-media/exam-image.png'; }
      if (part.part === 1) {
        part.examples?.forEach(example => { example.imageAssetId = 'exam-image-1'; example.imageUrl = '/listening-media/exam-image.png'; });
        part.questions.forEach(question => { question.imageAssetId = 'exam-image-1'; question.imageUrl = '/listening-media/exam-image.png'; });
      }
      if (part.part === 3) {
        part.examples?.forEach(example => {
          example.imageAssetId = 'exam-image-1';
          example.imageUrl = '/listening-media/exam-image.png';
          example.secondaryImageAssetId = 'exam-image-1';
          example.secondaryImageUrl = '/listening-media/exam-image.png';
        });
        part.questions.forEach(question => {
          question.imageAssetId = 'exam-image-1';
          question.imageUrl = '/listening-media/exam-image.png';
          question.secondaryImageAssetId = 'exam-image-1';
          question.secondaryImageUrl = '/listening-media/exam-image.png';
        });
      }
      if (part.part === 5) part.readingScenes?.forEach(scene => { scene.imageAssetId = 'exam-image-1'; scene.imageUrl = '/listening-media/exam-image.png'; });
    }
    if (moduleId === 'ket' && paperId === 'reading-writing') {
      if ([1, 4, 5, 8].includes(part.part)) {
        part.imageAssetId = 'exam-image-1';
        part.imageUrl = '/listening-media/exam-image.png';
      }
      if (part.part === 2) part.examples = [{ prompt: 'Printed example question', answer: 'A' }];
      if (part.part === 5) part.examples = [{ prompt: '0', answer: 'A', options: [{ label: 'A', text: 'with' }, { label: 'B', text: 'of' }, { label: 'C', text: 'in' }] }];
      if ([6, 7].includes(part.part)) part.passage = `Printed KET Part ${part.part} instructions, source text and example.`;
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
        if (moduleId === 'starter' && paperId === 'reading-writing' && part.part === 3) question.answerLength = 6;
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
      ? question.options.length === 2
        ? { optionId: question.options[0].id, text: 'A complete student response for the selected writing task.' }
        : 'A complete student response.'
      : question.correctOptionIds[0] || question.acceptedAnswers[0],
  ])));
}

async function waitForAttempt(url: string, headers: Record<string, string>, predicate: (attempt: any) => boolean) {
  let latest: any;
  for (let index = 0; index < 100; index += 1) {
    const response = await fetch(url, { headers });
    latest = await response.json();
    assert.equal(response.status, 200, JSON.stringify(latest));
    if (predicate(latest)) return latest;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.fail(`Timed out waiting for Writing grading: ${JSON.stringify(latest)}`);
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
  let failWritingGrade = false;
  const writingGradeRequests: any[] = [];
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use('/api/exam-platform', createExamRouter({
    db,
    authenticateUser: authenticateTeacher,
    authenticateOptionalUser: authenticateOptional,
    requireStaff: pass,
    ticketSecret: EXAM_ROUTER_TEST_TICKET_SECRET,
    resolveGuestProfile: async (guestId, studentName) => ({ id: String(guestId), displayName: String(studentName), status: 'active' }),
    writingGrading: {
      providers: [{ id: 'stali:gpt-5.6-sol', label: 'Stali test', enabled: true }],
      recoveryIntervalMs: 0,
      retryCooldownMs: 1_000,
      grade: async (request, options) => {
        writingGradeRequests.push(request);
        await options?.onAttempt?.(1, 2);
        if (failWritingGrade) throw new TypeError('fetch failed');
        assert.equal(request.providerId, 'stali:gpt-5.6-sol');
        assert.match(request.taskContext, /writing task|task/i);
        assert.match(request.gradingInstructions, /Rubric:\s*Teacher rubric/i);
        return { providerId: 'stali:gpt-5.6-sol', score: 8, sentenceCount: 3, grammarErrors: ['Cần sửa dạng động từ trong câu đầu tiên.'], vocabularyErrors: [], feedback: 'Bài viết đã hoàn thành đúng yêu cầu với ba câu. Em cần sửa một dạng động từ; từ vựng nhìn chung phù hợp.' };
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
  const guestAuthDriftIdentity = { guestId: 'guest-exam-auth-drift', studentName: 'Mai Anh' };
  const guestAuthDriftPrepareResponse = await fetch(`${baseUrl}/modules/starter/papers/reading-writing/sets/${created.id}/attempts/prepare`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...guestAuthDriftIdentity, shareToken: 'exam-assignment-token', clientRunId: 'guest-auth-drift-run', runSecret: 'guest-auth-drift-secret-123456' }),
  });
  const guestAuthDriftPrepared = await guestAuthDriftPrepareResponse.json() as any;
  assert.equal(guestAuthDriftPrepareResponse.status, 200, JSON.stringify(guestAuthDriftPrepared));
  const guestAuthDriftSubmit = await fetch(`${baseUrl}/modules/starter/papers/reading-writing/sets/${created.id}/attempts/submit`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-test-teacher': 'owner' },
    body: JSON.stringify({ ...guestAuthDriftIdentity, ticket: guestAuthDriftPrepared.ticket, runSecret: 'guest-auth-drift-secret-123456', answers: correctAnswers(objectiveContent) }),
  });
  assert.equal(guestAuthDriftSubmit.status, 201, JSON.stringify(await guestAuthDriftSubmit.json()));

  const authenticatedPrepareResponse = await fetch(`${baseUrl}/modules/starter/papers/reading-writing/sets/${created.id}/attempts/prepare`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-test-teacher': 'owner' },
    body: JSON.stringify({ clientRunId: 'authenticated-owner-run', runSecret: 'authenticated-owner-secret-123456' }),
  });
  const authenticatedPrepared = await authenticatedPrepareResponse.json() as any;
  assert.equal(authenticatedPrepareResponse.status, 200, JSON.stringify(authenticatedPrepared));
  const wrongAuthenticatedOwnerSubmit = await fetch(`${baseUrl}/modules/starter/papers/reading-writing/sets/${created.id}/attempts/submit`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-test-teacher': 'other' },
    body: JSON.stringify({ ticket: authenticatedPrepared.ticket, runSecret: 'authenticated-owner-secret-123456', answers: correctAnswers(objectiveContent) }),
  });
  assert.equal(wrongAuthenticatedOwnerSubmit.status, 401);
  assert.equal((await wrongAuthenticatedOwnerSubmit.json() as any).error, 'Không có quyền nộp lượt làm bài này.');

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

  const recoveryIdentity = { guestId: 'guest-exam-recovery', studentName: 'Minh Anh' };
  const recoveryPrepareResponse = await fetch(`${baseUrl}/modules/starter/papers/reading-writing/sets/${created.id}/attempts/prepare`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...recoveryIdentity, shareToken: 'exam-assignment-token', clientRunId: 'expired-ticket-client-run', runSecret: 'expired-ticket-run-secret-123456' }),
  });
  assert.equal(recoveryPrepareResponse.status, 200);
  const recoveryPrepared = await recoveryPrepareResponse.json() as any;
  const originalRecoveryPayload = ticketPayload(recoveryPrepared.ticket);
  const expiredTicketNow = Number(originalRecoveryPayload.ticketExpiresAt) + 1;
  Date.now = () => expiredTicketNow;
  try {
    const expiredSubmit = await fetch(`${baseUrl}/modules/starter/papers/reading-writing/sets/${created.id}/attempts/submit`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...recoveryIdentity, ticket: recoveryPrepared.ticket, runSecret: 'expired-ticket-run-secret-123456', answers: correctAnswers(objectiveContent) }),
    });
    assert.equal(expiredSubmit.status, 410);
    assert.equal((await expiredSubmit.json() as any).details.code, 'EXAM_ATTEMPT_TICKET_EXPIRED');

    const wrongSecretRenewal = await fetch(`${baseUrl}/modules/starter/papers/reading-writing/sets/${created.id}/attempts/renew`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...recoveryIdentity, ticket: recoveryPrepared.ticket, runSecret: 'wrong-expired-ticket-secret-123456' }),
    });
    assert.equal(wrongSecretRenewal.status, 401);
    const wrongOwnerRenewal = await fetch(`${baseUrl}/modules/starter/papers/reading-writing/sets/${created.id}/attempts/renew`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guestId: 'guest-exam-other', studentName: 'Other Student', ticket: recoveryPrepared.ticket, runSecret: 'expired-ticket-run-secret-123456' }),
    });
    assert.equal(wrongOwnerRenewal.status, 401);
    const wrongRouteRenewal = await fetch(`${baseUrl}/modules/starter/papers/listening/sets/${created.id}/attempts/renew`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...recoveryIdentity, ticket: recoveryPrepared.ticket, runSecret: 'expired-ticket-run-secret-123456' }),
    });
    assert.equal(wrongRouteRenewal.status, 401);
    const wrongVersionTicket = signedTicket({ ...originalRecoveryPayload, versionId: 'examver-missing' });
    const wrongVersionRenewal = await fetch(`${baseUrl}/modules/starter/papers/reading-writing/sets/${created.id}/attempts/renew`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...recoveryIdentity, ticket: wrongVersionTicket, runSecret: 'expired-ticket-run-secret-123456' }),
    });
    assert.equal(wrongVersionRenewal.status, 409);

    const renewalResponse = await fetch(`${baseUrl}/modules/starter/papers/reading-writing/sets/${created.id}/attempts/renew`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...recoveryIdentity, ticket: recoveryPrepared.ticket, runSecret: 'expired-ticket-run-secret-123456' }),
    });
    const renewed = await renewalResponse.json() as any;
    assert.equal(renewalResponse.status, 200, JSON.stringify(renewed));
    assert.equal(renewed.clientRunId, 'expired-ticket-client-run');
    assert.equal(renewed.versionId, recoveryPrepared.versionId);
    assert.equal(renewed.startedAt, recoveryPrepared.startedAt);
    assert.equal(renewed.deadlineAt, recoveryPrepared.deadlineAt);
    assert.equal(ticketPayload(renewed.ticket).ticketRecoveryEndsAt, originalRecoveryPayload.ticketRecoveryEndsAt);

    const recoveredSubmit = await fetch(`${baseUrl}/modules/starter/papers/reading-writing/sets/${created.id}/attempts/submit`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...recoveryIdentity, ticket: renewed.ticket, runSecret: 'expired-ticket-run-secret-123456', answers: correctAnswers(objectiveContent) }),
    });
    const recoveredAttempt = await recoveredSubmit.json() as any;
    assert.equal(recoveredSubmit.status, 201, JSON.stringify(recoveredAttempt));
    assert.equal(recoveredAttempt.timedOut, true);
  } finally {
    Date.now = realDateNow;
  }

  const legacyPrepareResponse = await fetch(`${baseUrl}/modules/starter/papers/reading-writing/sets/${created.id}/attempts/prepare`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...recoveryIdentity, shareToken: 'exam-assignment-token', clientRunId: 'legacy-ticket-client-run', runSecret: 'legacy-ticket-run-secret-12345678' }),
  });
  const legacyPrepared = await legacyPrepareResponse.json() as any;
  const legacyPayload = ticketPayload(legacyPrepared.ticket);
  delete legacyPayload.ticketExpiresAt;
  delete legacyPayload.ticketRecoveryEndsAt;
  const legacyTicket = signedTicket(legacyPayload);
  Date.now = () => new Date(legacyPrepared.startedAt).getTime() + 25 * 60 * 60_000;
  try {
    const legacyRenewalResponse = await fetch(`${baseUrl}/modules/starter/papers/reading-writing/sets/${created.id}/attempts/renew`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...recoveryIdentity, ticket: legacyTicket, runSecret: 'legacy-ticket-run-secret-12345678' }),
    });
    const legacyRenewed = await legacyRenewalResponse.json() as any;
    assert.equal(legacyRenewalResponse.status, 200, JSON.stringify(legacyRenewed));
    assert.equal(legacyRenewed.startedAt, legacyPrepared.startedAt);
  } finally {
    Date.now = realDateNow;
  }

  Date.now = () => new Date(legacyPrepared.startedAt).getTime() + 9 * 24 * 60 * 60_000;
  try {
    const staleLegacyRenewal = await fetch(`${baseUrl}/modules/starter/papers/reading-writing/sets/${created.id}/attempts/renew`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...recoveryIdentity, ticket: legacyTicket, runSecret: 'legacy-ticket-run-secret-12345678' }),
    });
    assert.equal(staleLegacyRenewal.status, 410);
    assert.equal((await staleLegacyRenewal.json() as any).details.code, 'EXAM_ATTEMPT_TICKET_RECOVERY_EXPIRED');
  } finally {
    Date.now = realDateNow;
  }

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
  const petRequestStart = writingGradeRequests.length;
  const writingSubmit = await fetch(`${baseUrl}/modules/pet/papers/writing/sets/${writingCreated.id}/attempts/submit`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...identity, ticket: writingTicket.ticket, runSecret: 'writing-run-secret-12345678', answers: correctAnswers(writingContent) }),
  });
  assert.equal(writingSubmit.status, 201);
  const writingAttempt = await writingSubmit.json() as any;
  assert.equal(writingAttempt.status, 'pending_review');
  const writingCompleted = await waitForAttempt(
    `${baseUrl}/modules/pet/papers/writing/sets/${writingCreated.id}/attempts/${writingAttempt.id}/status?guestId=${encodeURIComponent(identity.guestId)}&studentName=${encodeURIComponent(identity.studentName)}`,
    { 'X-Exam-Run-Secret': 'writing-run-secret-12345678' },
    value => value.aiGradingStatus === 'completed',
  );
  assert.equal(writingCompleted.status, 'completed');
  assert.equal(writingCompleted.pendingManualCount, 0);
  assert.equal(writingCompleted.score, 84);
  const petRequests = writingGradeRequests.slice(petRequestStart);
  assert.equal(petRequests.length, 2);
  assert.match(petRequests[1].prompt, /Question 7|letter answering/i);
  assert.match(petRequests[1].taskContext, /Đề học sinh đã chọn \(Question 7\)/);
  const petWritingReviewResponse = await fetch(`${baseUrl}/modules/pet/papers/writing/sets/${writingCreated.id}/attempts/${writingAttempt.id}/review`, { headers: { 'X-Test-Teacher': 'owner' } });
  const petWritingReview = await petWritingReviewResponse.json() as any;
  assert.equal(petWritingReviewResponse.status, 200);
  assert.equal(petWritingReview.questions.filter((question: any) => question.type === 'long-writing' && question.writingScore === 8).length, 2);
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
  assert.equal(ketAttempt.status, 'pending_review');
  assert.equal(ketAttempt.aiGradingStatus, 'queued');
  const ketCompletedAttempt = await waitForAttempt(
    `${baseUrl}/modules/ket/papers/reading-writing/sets/${ketCreated.id}/attempts/${ketAttempt.id}/status?guestId=${encodeURIComponent(identity.guestId)}&studentName=${encodeURIComponent(identity.studentName)}`,
    { 'X-Exam-Run-Secret': 'ket-writing-run-secret-12345678' },
    value => value.aiGradingStatus === 'completed',
  );
  assert.equal(ketCompletedAttempt.status, 'completed');
  assert.equal(ketCompletedAttempt.score, 97);
  const ketReviewResponse = await fetch(`${baseUrl}/modules/ket/papers/reading-writing/sets/${ketCreated.id}/attempts/${ketAttempt.id}/review`, { headers: { 'X-Test-Teacher': 'owner' } });
  const ketReview = await ketReviewResponse.json() as any;
  assert.equal(ketReviewResponse.status, 200);
  const ketWriting = ketReview.questions.find((question: any) => question.part === 9);
  assert.equal(ketWriting.writingScore, 8);
  assert.deepEqual(ketWriting.grammarErrors, ['Cần sửa dạng động từ trong câu đầu tiên.']);
  assert.match(ketWriting.aiFeedback, /Bài viết đã hoàn thành đúng yêu cầu/);

  const standaloneContent = completeContent('writing', 'writing');
  standaloneContent.title = 'My first flexible Writing task';
  standaloneContent.level = 'Lớp 4';
  standaloneContent.topic = 'My weekend';
  const standaloneCreatedResponse = await fetch(`${baseUrl}/admin/modules/writing/papers/writing/sets`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: standaloneContent }),
  });
  const standaloneCreated = await standaloneCreatedResponse.json() as any;
  assert.equal(standaloneCreatedResponse.status, 201, JSON.stringify(standaloneCreated));
  assert.equal(standaloneCreated.topic, 'My weekend');
  assert.deepEqual(standaloneCreated.validationErrors, []);
  const standaloneUpdated = await fetch(`${baseUrl}/admin/modules/writing/papers/writing/sets/${standaloneCreated.id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: standaloneContent, visibility: 'public', baseRevision: standaloneCreated.draftRevision }),
  });
  assert.equal(standaloneUpdated.status, 200);
  assert.equal((await fetch(`${baseUrl}/admin/modules/writing/papers/writing/sets/${standaloneCreated.id}/publish`, { method: 'POST' })).status, 200);
  const standalonePrepare = await fetch(`${baseUrl}/modules/writing/papers/writing/sets/${standaloneCreated.id}/attempts/prepare`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...identity, clientRunId: 'standalone-writing-client-run', runSecret: 'standalone-writing-secret-12345678' }),
  });
  const standaloneTicket = await standalonePrepare.json() as any;
  const longEssay = Array.from({ length: 80 }, (_, index) => `word${index + 1}`).join(' ');
  const standaloneQuestionId = standaloneContent.parts[0].questions[0].id;
  const standaloneSubmit = await fetch(`${baseUrl}/modules/writing/papers/writing/sets/${standaloneCreated.id}/attempts/submit`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...identity, ticket: standaloneTicket.ticket, runSecret: 'standalone-writing-secret-12345678', answers: { [standaloneQuestionId]: longEssay } }),
  });
  const standaloneAttempt = await standaloneSubmit.json() as any;
  assert.equal(standaloneSubmit.status, 201, JSON.stringify(standaloneAttempt));
  assert.equal(standaloneAttempt.status, 'pending_review');
  assert.equal(standaloneAttempt.aiGradingStatus, 'queued');
  const standaloneCompletedAttempt = await waitForAttempt(
    `${baseUrl}/modules/writing/papers/writing/sets/${standaloneCreated.id}/attempts/${standaloneAttempt.id}/status?guestId=${encodeURIComponent(identity.guestId)}&studentName=${encodeURIComponent(identity.studentName)}`,
    { 'X-Exam-Run-Secret': 'standalone-writing-secret-12345678' },
    value => value.aiGradingStatus === 'completed',
  );
  assert.equal(standaloneCompletedAttempt.status, 'completed');
  assert.equal(standaloneCompletedAttempt.writingScore, 8);
  assert.equal(standaloneCompletedAttempt.writingWordCount, 80);
  const standaloneReviewResponse = await fetch(`${baseUrl}/modules/writing/papers/writing/sets/${standaloneCreated.id}/attempts/${standaloneAttempt.id}/review`, { headers: { 'X-Test-Teacher': 'owner' } });
  const standaloneReview = await standaloneReviewResponse.json() as any;
  assert.equal(standaloneReview.questions[0].writingScore, 8);
  assert.equal(standaloneReview.questions[0].userAnswer, longEssay);
  const historyWithWriting = await getLearningHistory(historyActor, historyFilters);
  const standaloneHistory = historyWithWriting.items.find(item => item.gameId === 'exam:writing:writing');
  assert.equal(standaloneHistory?.rawScore, 8);
  assert.equal(standaloneHistory?.maxScore, 10);

  failWritingGrade = true;
  const failedPrepareResponse = await fetch(`${baseUrl}/modules/writing/papers/writing/sets/${standaloneCreated.id}/attempts/prepare`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...identity, clientRunId: 'standalone-writing-failed-run', runSecret: 'standalone-failed-secret-12345678' }),
  });
  const failedTicket = await failedPrepareResponse.json() as any;
  assert.equal(failedPrepareResponse.status, 200, JSON.stringify(failedTicket));
  const failedSubmitResponse = await fetch(`${baseUrl}/modules/writing/papers/writing/sets/${standaloneCreated.id}/attempts/submit`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...identity, ticket: failedTicket.ticket, runSecret: 'standalone-failed-secret-12345678', answers: { [standaloneQuestionId]: 'A safe essay that will be graded again after the temporary provider failure.' } }),
  });
  const failedQueuedAttempt = await failedSubmitResponse.json() as any;
  assert.equal(failedSubmitResponse.status, 201, JSON.stringify(failedQueuedAttempt));
  assert.equal(failedQueuedAttempt.aiGradingStatus, 'queued');
  const failedStatusUrl = `${baseUrl}/modules/writing/papers/writing/sets/${standaloneCreated.id}/attempts/${failedQueuedAttempt.id}/status?guestId=${encodeURIComponent(identity.guestId)}&studentName=${encodeURIComponent(identity.studentName)}`;
  const failedAttempt = await waitForAttempt(failedStatusUrl, { 'X-Exam-Run-Secret': 'standalone-failed-secret-12345678' }, value => value.aiGradingStatus === 'failed');
  assert.equal(failedAttempt.status, 'pending_review');
  assert.equal(failedAttempt.aiGradingRetryable, true);
  assert.match(failedAttempt.aiGradingMessage, /quá tải hoặc phản hồi chậm/);
  const unauthorizedStatus = await fetch(failedStatusUrl, { headers: { 'X-Exam-Run-Secret': 'wrong-standalone-failed-secret' } });
  assert.equal(unauthorizedStatus.status, 404);
  const retryUrl = `${baseUrl}/modules/writing/papers/writing/sets/${standaloneCreated.id}/attempts/${failedQueuedAttempt.id}/retry-writing-grade`;
  const retryBody = JSON.stringify(identity);
  const earlyRetry = await fetch(retryUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Exam-Run-Secret': 'standalone-failed-secret-12345678' }, body: retryBody });
  assert.equal(earlyRetry.status, 429);
  assert.equal((await earlyRetry.json() as any).details.code, 'WRITING_GRADING_COOLDOWN');
  await new Promise(resolve => setTimeout(resolve, 1_050));
  failWritingGrade = false;
  const retryResponseForLearner = await fetch(retryUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Exam-Run-Secret': 'standalone-failed-secret-12345678' }, body: retryBody });
  const retriedQueuedAttempt = await retryResponseForLearner.json() as any;
  assert.equal(retryResponseForLearner.status, 202, JSON.stringify(retriedQueuedAttempt));
  assert.equal(retriedQueuedAttempt.id, failedQueuedAttempt.id);
  assert.equal(retriedQueuedAttempt.aiGradingCycle, 2);
  const retriedCompletedAttempt = await waitForAttempt(failedStatusUrl, { 'X-Exam-Run-Secret': 'standalone-failed-secret-12345678' }, value => value.aiGradingStatus === 'completed');
  assert.equal(retriedCompletedAttempt.id, failedQueuedAttempt.id);
  assert.equal(retriedCompletedAttempt.aiGradingCycle, 2);

  const drawCurrent = createDefaultExamContent(getExamPaperDefinition('pet', 'reading')!);
  delete drawCurrent.templateVersion;
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
