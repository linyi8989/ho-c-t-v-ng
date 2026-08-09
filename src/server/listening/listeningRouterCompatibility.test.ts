import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import express from 'express';
import type { ListeningAnswers, ListeningSetContent } from '../../features/listening/types';
import {
  listeningAttemptToActivity,
  resolveListeningActivityDetailForStaff,
} from './listeningActivity';
import { containsInternalListeningDisplayValue } from '../../features/listening/reviewPresentation';
import { createListeningRouter } from './listeningRouter';

function moverFixture(): { content: ListeningSetContent; answers: ListeningAnswers } {
  const region = (index: number) => ({
    shape: 'rect' as const,
    x: (index % 3) * 0.3,
    y: Math.floor(index / 3) * 0.4,
    width: 0.2,
    height: 0.2,
  });
  const choices = Array.from({ length: 6 }, (_, index) => ({ id: `choice-${index}`, label: `Name ${index}` }));
  const locations = Array.from({ length: 6 }, (_, index) => ({
    id: `location-${index}`,
    label: String.fromCharCode(65 + index),
    imageAssetId: `location-image-${index}`,
    imageUrl: `/fixture/location-${index}.png`,
  }));
  const colours = ['#ef4444', '#7c3aed', '#f97316', '#2563eb', '#16a34a', '#eab308']
    .map((value, index) => ({ id: `colour-${index}`, label: `Colour ${index}`, value }));
  const content: ListeningSetContent = {
    schemaVersion: 1,
    title: 'Legacy Movers fixture',
    description: 'Contract fixture without moduleId.',
    level: 'Movers',
    parts: [
      {
        part: 1,
        title: 'Part 1',
        instruction: 'Listen and drag.',
        audioAssetId: 'audio-1',
        audioUrl: '/fixture/audio-1.mp3',
        sceneAssetId: 'scene-1',
        sceneUrl: '/fixture/scene-1.png',
        choices,
        targets: choices.slice(0, 5).map((choice, index) => ({
          id: `p1-${index}`,
          choiceId: choice.id,
          region: region(index),
        })),
      },
      {
        part: 2,
        title: 'Part 2',
        instruction: 'Listen and write.',
        audioAssetId: 'audio-2',
        audioUrl: '/fixture/audio-2.mp3',
        heading: 'Notes',
        questions: Array.from({ length: 5 }, (_, index) => ({
          id: `p2-${index}`,
          prompt: `Question {{blank-${index}}}`,
          blanks: [{ id: `blank-${index}`, acceptedAnswers: [`answer ${index}`] }],
        })),
      },
      {
        part: 3,
        title: 'Part 3',
        instruction: 'Listen and choose.',
        audioAssetId: 'audio-3',
        audioUrl: '/fixture/audio-3.mp3',
        reuseMode: 'once',
        options: locations,
        items: Array.from({ length: 5 }, (_, index) => ({
          id: `p3-${index}`,
          label: `Item ${index}`,
          imageAssetId: `item-image-${index}`,
          imageUrl: `/fixture/item-${index}.png`,
          correctOptionId: locations[index].id,
        })),
      },
      {
        part: 4,
        title: 'Part 4',
        instruction: 'Listen and tick.',
        audioAssetId: 'audio-4',
        audioUrl: '/fixture/audio-4.mp3',
        questions: Array.from({ length: 5 }, (_, questionIndex) => {
          const options = Array.from({ length: 3 }, (_, optionIndex) => ({
            id: `p4-${questionIndex}-${optionIndex}`,
            imageAssetId: `p4-image-${questionIndex}-${optionIndex}`,
            imageUrl: `/fixture/p4-${questionIndex}-${optionIndex}.png`,
            alt: `Option ${optionIndex}`,
          }));
          return {
            id: `p4-${questionIndex}`,
            prompt: `Question ${questionIndex}`,
            options,
            correctOptionId: options[1].id,
          };
        }),
      },
      {
        part: 5,
        title: 'Part 5',
        instruction: 'Listen and colour.',
        audioAssetId: 'audio-5',
        audioUrl: '/fixture/audio-5.mp3',
        sceneAssetId: 'scene-5',
        sceneUrl: '/fixture/scene-5.png',
        colours,
        targets: colours.slice(0, 5).map((colour, index) => ({
          id: `p5-${index}`,
          label: `Region ${index}`,
          correctColourId: colour.id,
          region: region(index),
        })),
      },
    ],
  };
  const part3 = content.parts[2];
  const part5 = content.parts[4];
  if (part3.displayMode === 'connect-image' || part5.displayMode === 'scene-colour-draw') throw new Error('Legacy fixture expected.');
  return {
    content,
    answers: {
      part1: Object.fromEntries(content.parts[0].targets.map(target => [target.id, target.choiceId])),
      part2: Object.fromEntries(content.parts[1].questions.map(question => [
        question.id,
        Object.fromEntries(question.blanks.map(blank => [blank.id, blank.acceptedAnswers[0]])),
      ])),
      part3: Object.fromEntries(part3.items.map(item => [item.id, item.correctOptionId])),
      part4: Object.fromEntries(content.parts[3].questions.map(question => [question.id, question.correctOptionId])),
      part5: Object.fromEntries(part5.targets.map(target => [target.id, target.correctColourId])),
    },
  };
}

test('legacy Mover API keeps its URL, sanitizes answers, and submits idempotently', async t => {
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'vhomework-listening-router-'));
  process.env.NODE_ENV = 'test';
  process.env.STORAGE_MODE = 'sqlite';
  process.env.SQLITE_DRIVER = 'sqljs';
  process.env.SQLITE_DB_PATH = path.join(temporaryDirectory, 'app.sqlite');
  process.env.SQLITE_ALLOW_CREATE = 'true';
  process.env.SQLITE_ALLOW_JSON_IMPORT = 'false';

  const storage = await import('../../lib/sqliteStorage');
  await storage.initializeSQLiteStorage();
  const db = new storage.SQLiteFirestore();
  const fixture = moverFixture();
  const now = new Date().toISOString();
  await db.collection('listening_sets').doc('legacy-mover-set').set({
    id: 'legacy-mover-set',
    ownerId: 'teacher-1',
    title: fixture.content.title,
    description: fixture.content.description,
    level: fixture.content.level,
    status: 'published',
    visibility: 'public',
    publishedVersionId: 'legacy-mover-version',
    publishedVersionNumber: 1,
    createdAt: now,
    updatedAt: now,
  });
  await db.collection('listening_set_versions').doc('legacy-mover-version').set({
    id: 'legacy-mover-version',
    setId: 'legacy-mover-set',
    versionNumber: 1,
    status: 'published',
    content: fixture.content,
    createdAt: now,
    updatedAt: now,
  });
  await db.collection('listening_sets').doc('future-ket-set').set({
    id: 'future-ket-set',
    moduleId: 'ket',
    schemaVersion: 1,
    ownerId: 'teacher-1',
    title: 'Future KET fixture',
    description: 'Must not enter the legacy Mover API.',
    level: 'KET',
    status: 'published',
    visibility: 'public',
    publishedVersionId: 'future-ket-version',
    publishedVersionNumber: 1,
    createdAt: now,
    updatedAt: now,
  });

  const pass: express.RequestHandler = (_req, _res, next) => next();
  const app = express();
  app.use(express.json());
  app.use('/api/listening', createListeningRouter({
    db,
    authenticateUser: pass,
    authenticateOptionalUser: pass,
    requireStaff: pass,
    mediaDir: path.join(temporaryDirectory, 'media'),
    mediaPublicPrefix: '/listening-media',
    ticketSecret: 'compatibility-test-secret-with-sufficient-length',
    resolveGuestProfile: async (guestId, studentName) => ({
      id: String(guestId),
      displayName: String(studentName),
      status: 'active',
    }),
  }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    server.close();
    await once(server, 'close');
    await storage.closeSQLiteStorage();
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  });
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const listResponse = await fetch(`${baseUrl}/api/listening/sets`);
  assert.equal(listResponse.status, 200);
  const listedSets = await listResponse.json() as any[];
  assert.deepEqual(listedSets.map(set => set.id), ['legacy-mover-set']);

  const futureModuleResponse = await fetch(`${baseUrl}/api/listening/sets/future-ket-set`);
  assert.equal(futureModuleResponse.status, 404);

  const playableResponse = await fetch(`${baseUrl}/api/listening/sets/legacy-mover-set`);
  assert.equal(playableResponse.status, 200);
  const playable = await playableResponse.json() as any;
  assert.equal(playable.id, 'legacy-mover-set');
  assert.equal(playable.moduleId, 'mover');
  assert.equal(playable.schemaVersion, 1);
  assert.equal(playable.versionId, 'legacy-mover-version');
  assert.equal(playable.content.moduleId, 'mover');
  assert.equal(playable.content.parts.length, 5);
  assert.equal(playable.content.parts.every((part: any) => part.schemaVersion === 1), true);
  assert.equal('choiceId' in playable.content.parts[0].targets[0], false);
  assert.equal('acceptedAnswers' in playable.content.parts[1].questions[0].blanks[0], false);

  const identity = { guestId: 'guest-compatibility', studentName: 'Lan Anh' };
  const prepareResponse = await fetch(`${baseUrl}/api/listening/sets/legacy-mover-set/attempts/prepare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...identity,
      clientRunId: 'client-run-compatibility',
      runSecret: 'run-secret-compatibility',
    }),
  });
  assert.equal(prepareResponse.status, 200);
  const prepared = await prepareResponse.json() as any;
  assert.ok(prepared.ticket);

  const submission = {
    ...identity,
    ticket: prepared.ticket,
    runSecret: 'run-secret-compatibility',
    answers: fixture.answers,
  };
  const firstSubmit = await fetch(`${baseUrl}/api/listening/sets/legacy-mover-set/attempts/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(submission),
  });
  assert.equal(firstSubmit.status, 201);
  const firstResult = await firstSubmit.json() as any;
  assert.equal(firstResult.moduleId, 'mover');
  assert.equal(firstResult.schemaVersion, 1);
  assert.equal(firstResult.score, 100);
  assert.equal(firstResult.correctCount, 25);

  const reviewQuery = new URLSearchParams(identity).toString();
  const reviewResponse = await fetch(
    `${baseUrl}/api/listening/sets/legacy-mover-set/attempts/${encodeURIComponent(firstResult.id)}/review?${reviewQuery}`,
    { headers: { 'X-Listening-Run-Secret': submission.runSecret } }
  );
  assert.equal(reviewResponse.status, 200);
  const reviewResult = await reviewResponse.json() as any;
  assert.equal(reviewResult.attemptId, firstResult.id);
  assert.equal(reviewResult.answerDetails.length, 25);
  assert.equal(reviewResult.answerDetails[0].userAnswer, 'Name 0');
  assert.equal(reviewResult.answerDetails[0].correctAnswer, 'Name 0');
  assert.equal('questionId' in reviewResult.answerDetails[0], false);

  const forbiddenReviewResponse = await fetch(
    `${baseUrl}/api/listening/sets/legacy-mover-set/attempts/${encodeURIComponent(firstResult.id)}/review?${new URLSearchParams({ guestId: 'another-guest', studentName: 'Another Student' })}`,
    { headers: { 'X-Listening-Run-Secret': submission.runSecret } }
  );
  assert.equal(forbiddenReviewResponse.status, 404);

  const wrongSecretReviewResponse = await fetch(
    `${baseUrl}/api/listening/sets/legacy-mover-set/attempts/${encodeURIComponent(firstResult.id)}/review?${reviewQuery}`,
    { headers: { 'X-Listening-Run-Secret': 'wrong-run-secret' } }
  );
  assert.equal(wrongSecretReviewResponse.status, 404);

  const storedDetailSnapshot = await db.collection('listening_attempt_details').doc(firstResult.id).get();
  assert.equal(storedDetailSnapshot.exists, true);
  const storedDetail = storedDetailSnapshot.data() as any;
  assert.equal(storedDetail.answerDetails.length, 25);
  assert.equal(storedDetail.answerDetails[0].userAnswer, 'Name 0');
  assert.equal(storedDetail.answerDetails[0].correctAnswer, 'Name 0');
  assert.equal(storedDetail.answerDetails[0].questionText, 'Part 1 · Vị trí nhân vật 1');
  assert.equal(storedDetail.answerDetails[5].questionText, 'Question _____');
  assert.equal(storedDetail.reviewPolicy.showReviewAfterSubmit, true);
  assert.equal(storedDetail.answerDetails.some((item: any) => (
    containsInternalListeningDisplayValue(item.questionText)
    || containsInternalListeningDisplayValue(item.userAnswer)
    || containsInternalListeningDisplayValue(item.correctAnswer)
  )), false);

  const resolvedLegacyDetail = await resolveListeningActivityDetailForStaff(db, firstResult);
  const staffActivity = listeningAttemptToActivity(firstResult, resolvedLegacyDetail);
  assert.equal(staffActivity.answerDetails.length, 25);
  assert.equal(staffActivity.answerDetails[10].userAnswer, 'A');
  assert.equal(staffActivity.answerDetails[15].userAnswer, 'Option 1');
  assert.equal(staffActivity.answerDetails[20].userAnswer, 'Colour 0');
  assert.equal('wordId' in staffActivity.answerDetails[0], false);
  const studentActivity = listeningAttemptToActivity(firstResult);
  assert.equal('answerDetails' in studentActivity, false);

  const historyService = await import('../learning-history/learningHistoryService');
  const studentHistoryDetail = await historyService.getLearningHistoryDetail({
    id: identity.guestId,
    ownerKey: `guest:${identity.guestId}`,
    kind: 'guest',
    role: 'student',
  }, firstResult.id);
  assert.equal(studentHistoryDetail.detailStatus, 'available');
  assert.equal(studentHistoryDetail.detail?.answerDetails.length, 25);
  assert.equal((studentHistoryDetail.detail?.answerDetails[0] as any).questionText, 'Part 1 · Vị trí nhân vật 1');
  assert.equal((studentHistoryDetail.detail?.answerDetails[0] as any).userAnswer, 'Name 0');
  assert.equal((studentHistoryDetail.detail?.answerDetails[0] as any).correctAnswer, 'Name 0');
  await assert.rejects(
    historyService.getLearningHistoryDetail({
      id: 'another-guest',
      ownerKey: 'guest:another-guest',
      kind: 'guest',
      role: 'student',
    }, firstResult.id),
    (error: any) => error?.code === 'HISTORY_ATTEMPT_NOT_FOUND',
  );

  const replaySubmit = await fetch(`${baseUrl}/api/listening/sets/legacy-mover-set/attempts/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(submission),
  });
  assert.equal(replaySubmit.status, 200);
  const replayResult = await replaySubmit.json() as any;
  assert.equal(replayResult.id, firstResult.id);
  assert.equal(replayResult.idempotentReplay, true);

  const attempts = await db.collection('listening_attempts').get();
  assert.equal(attempts.size, 1);
});

test('authenticated results join listening detail only inside the staff review branch', () => {
  const serverSource = fs.readFileSync(path.resolve(process.cwd(), 'server.ts'), 'utf8');
  const resultsRouteStart = serverSource.indexOf('app.get("/api/results"');
  const nextRouteStart = serverSource.indexOf('app.get("/api/leaderboard-results"', resultsRouteStart);
  const resultsRoute = serverSource.slice(resultsRouteStart, nextRouteStart);

  assert.match(resultsRoute, /isStaffResultReview/);
  assert.match(resultsRoute, /resolveListeningActivityDetailForStaff/);
  assert.match(resultsRoute, /listeningAttemptToActivity\(data, detail\)/);
  assert.match(resultsRoute, /if \(!isStaffResultReview\) return listeningAttemptToActivity\(data\)/);
});
