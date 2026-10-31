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
import { createEmptyListeningAnswers, type ListeningAnswers, type ListeningSetContent } from '../../features/listening/types';
import { gradeListeningAttempt } from '../listening/listeningGrader';
import { createListeningRouter } from '../listening/listeningRouter';
import { gradeExamAttempt } from './examGrader';
import { createExamRouter } from './examRouter';
import { normalizeExamSmartImportPart, sanitizeExamContentForStudent, validateExamPaperContent } from './examValidation';
import { sanitizeListeningContentForStudent, validateListeningSetContent } from '../listening/listeningValidation';
import { buildListeningActivityAnswerDetails, buildListeningVisualReviewSnapshot } from '../listening/listeningActivity';
import { getLearningHistoryDetail } from '../learning-history/learningHistoryService';

const imageId = 'young-input-variants-image';
const audioId = 'young-input-variants-audio';

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
        audioTranscript: 'Man: Who is wearing the red hat?\nGirl: That is Name 0.',
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

const equivalents = ['4', 'four years', '4 years'];
const examVersion = 'exam-platform-young-listening-input-variants-v1';
const moverVersion = 'listening-five-part-input-variants-v1';

function equivalentExam(moduleId: 'starter' | 'flyer') {
  const content = completedYoungListening(moduleId);
  content.parts[1].questions.forEach(question => {
    question.prompt = 'Years of tennis';
    question.acceptedAnswers = ['four'];
    question.inputAnswerVariants = [...equivalents];
    delete question.answerPrefix;
    delete question.answerSuffix;
  });
  return content;
}

function equivalentMover() {
  const fixture = moverFixture();
  fixture.content.parts[1].questions.forEach(question => {
    question.prompt = `Years of tennis: {{${question.blanks[0].id}}}`;
    question.blanks[0].acceptedAnswers = ['four'];
    question.blanks[0].inputAnswerVariants = [...equivalents];
    fixture.answers.part2[question.id] = { [question.blanks[0].id]: 'four' };
  });
  return fixture;
}

function assertNoComparisonFields(value: unknown) {
  assert.equal(JSON.stringify(value).includes('inputAnswerVariants'), false, 'private comparison variants must not enter a learner response or snapshot');
}

test('Starters/Flyers Part2 accept equivalent input while keeping official answers as the only display answers', () => {
  for (const moduleId of ['starter', 'flyer'] as const) {
    const content = equivalentExam(moduleId);
    assert.deepEqual(validateExamPaperContent(content), [], moduleId);
    const question = content.parts[1].questions[0];
    for (const answer of ['four', ...equivalents]) {
      const grade = gradeExamAttempt(content, { [question.id]: answer });
      const row = grade.questions.find(item => item.questionId === question.id)!;
      assert.equal(row.correct, true, `${moduleId}: ${answer}`);
      assert.deepEqual(row.correctAnswer, ['four']);
      assert.equal(grade.gradingVersion, examVersion);
      assertNoComparisonFields(grade);
    }
    for (const answer of ['five', '5 years', '']) {
      const row = gradeExamAttempt(content, { [question.id]: answer }).questions.find(item => item.questionId === question.id)!;
      assert.equal(row.correct, false, `${moduleId}: ${answer || 'blank'}`);
      assert.equal(row.unanswered, !answer);
    }
    assertNoComparisonFields(sanitizeExamContentForStudent(content));
    assert.deepEqual(question.acceptedAnswers, ['four'], 'grading never rewrites official source answers');
    const legacy = structuredClone(content);
    legacy.parts[1].questions.forEach(item => { delete item.inputAnswerVariants; });
    assert.equal(gradeExamAttempt(legacy, { [question.id]: '4' }).questions.find(item => item.questionId === question.id)!.correct, false);
    assert.equal(gradeExamAttempt(legacy, {}).gradingVersion, 'exam-platform-objective-v2');
  }
});

test('Movers private variants grade each blank without entering playable, activity or visual review', () => {
  const { content, answers } = equivalentMover();
  assert.deepEqual(validateListeningSetContent(content), []);
  const question = content.parts[1].questions[0];
  const blank = question.blanks[0];
  for (const answer of ['four', ...equivalents]) {
    answers.part2[question.id][blank.id] = answer;
    const grade = gradeListeningAttempt(content, answers);
    assert.equal(grade.correctCount, 25, answer);
    assert.equal(grade.gradingVersion, moverVersion);
    const details = buildListeningActivityAnswerDetails(content, answers, grade.questions);
    assert.equal(details[5].correctAnswer, 'four');
    assertNoComparisonFields(details);
    assertNoComparisonFields(buildListeningVisualReviewSnapshot(content, answers, grade.questions));
  }
  answers.part2[question.id][blank.id] = 'five';
  assert.equal(gradeListeningAttempt(content, answers).correctCount, 24);
  answers.part2[question.id][blank.id] = '';
  assert.equal(gradeListeningAttempt(content, answers).unansweredCount, 1);
  assertNoComparisonFields(sanitizeListeningContentForStudent(content));
  const legacy = structuredClone(content);
  legacy.parts[1].questions.forEach(item => item.blanks.forEach(entry => { delete entry.inputAnswerVariants; }));
  assert.equal(gradeListeningAttempt(legacy, answers).gradingVersion, 'listening-five-part-v2');
});

test('comparison variants are strict optional private fields and do not affect other exam papers or parts', () => {
  for (const moduleId of ['starter', 'flyer'] as const) for (const invalid of [null, '4 | four years', {}, [4], [''], ['a\nb'], ['a'.repeat(201)], Array.from({ length: 21 }, (_, i) => String(i))]) {
    const malformed = equivalentExam(moduleId);
    Object.assign(malformed.parts[1].questions[0], { inputAnswerVariants: invalid });
    assert.ok(validateExamPaperContent(malformed).length, `${moduleId}: ${JSON.stringify(invalid)}`);
  }
  for (const invalid of [null, 4, {}, [''], [true], ['x'.repeat(201)], Array.from({ length: 21 }, (_, i) => String(i))]) {
    const { content } = equivalentMover();
    Object.assign(content.parts[1].questions[0].blanks[0], { inputAnswerVariants: invalid });
    assert.ok(validateListeningSetContent(content).length, JSON.stringify(invalid));
  }
  for (const [moduleId, paperId] of [['ket', 'listening'], ['pet', 'listening'], ['fce', 'listening'], ['ielts', 'listening'], ['starter', 'reading-writing'], ['flyer', 'reading-writing']] as const) {
    const content = createDefaultExamContent(getExamPaperDefinition(moduleId, paperId)!);
    const question = content.parts[1].questions[0];
    question.type = 'short-answer'; question.options = []; question.correctOptionIds = []; question.acceptedAnswers = ['four'];
    const before = gradeExamAttempt(content, { [question.id]: '4' });
    question.inputAnswerVariants = [...equivalents];
    assert.deepEqual(gradeExamAttempt(content, { [question.id]: '4' }), before, `${moduleId}/${paperId}`);
    assertNoComparisonFields(sanitizeExamContentForStudent(content));
  }
});

test('private input variants survive authoring and immutable grading routes without learner display leakage', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'young-listening-input-variants-api-'));
  const databasePath = path.join(directory, 'app.sqlite');
  if (process.env.YOUNG_LISTENING_INPUT_VARIANTS_TEST_DB_SOURCE) fs.copyFileSync(process.env.YOUNG_LISTENING_INPUT_VARIANTS_TEST_DB_SOURCE, databasePath);
  Object.assign(process.env, { NODE_ENV: 'test', STORAGE_MODE: 'sqlite', SQLITE_DRIVER: process.env.YOUNG_LISTENING_INPUT_VARIANTS_TEST_SQLITE_DRIVER || 'sqljs', SQLITE_DB_PATH: databasePath, SQLITE_ALLOW_CREATE: 'true', SQLITE_ALLOW_JSON_IMPORT: 'false' });
  const storage = await import('../../lib/sqliteStorage'); await storage.initializeSQLiteStorage();
  const db = new storage.SQLiteFirestore();
  const teacher = { id: 'input-variants-teacher', name: 'Teacher', email: 'variants@example.test', role: 'teacher' as const, status: 'active' as const, createdAt: '2026-10-30T00:00:00Z' };
  const auth: express.RequestHandler = (req, _res, next) => { req.user = { ...teacher, ...(req.headers['x-test-owner'] === 'other' ? { id: 'variants-other' } : {}) }; next(); };
  const optional: express.RequestHandler = (req, _res, next) => { if (req.headers['x-test-owner']) req.user = { ...teacher, ...(req.headers['x-test-owner'] === 'other' ? { id: 'variants-other' } : {}) }; next(); };
  const pass: express.RequestHandler = (_req, _res, next) => next();
  const timestamp = '2026-10-30T00:00:00Z';
  const seedAsset = async (id: string, kind: 'image' | 'audio') => db.collection('listening_assets').doc(id).set({ id, kind, ownerId: teacher.id, status: 'active', name: id, mimeType: kind === 'image' ? 'image/png' : 'audio/mpeg', size: 128, storageKey: id, url: `/fixture/${id}`, createdAt: timestamp, updatedAt: timestamp });
  await seedAsset(imageId, 'image'); await seedAsset(audioId, 'audio');
  const app = express(); app.use(express.json({ limit: '2mb' }));
  let aiCalls = 0;
  app.use('/exam', createExamRouter({ db, authenticateUser: auth, authenticateOptionalUser: optional, requireStaff: pass, ticketSecret: 'input-variants-test-ticket-secret', resolveGuestProfile: async (guestId, name) => ({ id: String(guestId), displayName: String(name), status: 'active' }), writingGrading: { providers: [], recoveryIntervalMs: 0, grade: async () => { aiCalls++; throw Error('Real AI disabled'); } } }));
  app.use('/listening', createListeningRouter({ db, authenticateUser: auth, authenticateOptionalUser: optional, requireStaff: pass, mediaDir: path.join(directory, 'media'), mediaPublicPrefix: '/fixture', ticketSecret: 'input-variants-mover-ticket-secret', resolveGuestProfile: async (guestId, name) => ({ id: String(guestId), displayName: String(name), status: 'active' }) }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { server.close(); await once(server, 'close'); await storage.closeSQLiteStorage(); fs.rmSync(directory, { recursive: true, force: true }); });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const request = async (route: string, method = 'GET', body?: unknown, headers: Record<string, string> = {}) => {
    try {
      const response = await fetch(base + route, { method, signal: AbortSignal.timeout(10_000), headers: { 'Content-Type': 'application/json', ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      return { status: response.status, data: await response.json() };
    } catch (reason) { throw new Error(`${method} ${route} failed`, { cause: reason }); }
  };
  for (const moduleId of ['starter', 'flyer'] as const) await t.test(moduleId, async () => {
    const content = equivalentExam(moduleId);
    const admin = `/exam/admin/modules/${moduleId}/papers/listening/sets`;
    const created = await request(admin, 'POST', { content }); assert.equal(created.status, 201, JSON.stringify(created.data)); assert.deepEqual(created.data.validationErrors, []);
    assert.deepEqual(created.data.draftContent.parts[1].questions[0].inputAnswerVariants, equivalents);
    const saved = await request(`${admin}/${created.data.id}`, 'PUT', { content, visibility: 'public', baseRevision: created.data.draftRevision }); assert.equal(saved.status, 200);
    const v1 = await request(`${admin}/${created.data.id}/publish`, 'POST'); assert.equal(v1.status, 200, JSON.stringify(v1.data));
    const student = `/exam/modules/${moduleId}/papers/listening/sets/${created.data.id}`;
    const playable = await request(student); assert.equal(playable.status, 200); assertNoComparisonFields(playable.data); assert.equal(JSON.stringify(playable.data).includes('acceptedAnswers'), false);
    const guest = { guestId: `input-variants-${moduleId}`, studentName: 'Variant Learner' }, runSecret = `input-variants-${moduleId}-secret-1234567890`;
    const prepared = await request(`${student}/attempts/prepare`, 'POST', { ...guest, clientRunId: 'variants-v1', runSecret }); assert.equal(prepared.status, 200); assertNoComparisonFields(prepared.data);
    const nextContent = structuredClone(content); nextContent.parts[1].questions[0].inputAnswerVariants = ['IV'];
    const nextSaved = await request(`${admin}/${created.data.id}`, 'PUT', { content: nextContent, visibility: 'public', baseRevision: saved.data.draftRevision }); assert.equal(nextSaved.status, 200);
    const v2 = await request(`${admin}/${created.data.id}/publish`, 'POST'); assert.equal(v2.status, 200); assert.notEqual(v1.data.version.id, v2.data.version.id);
    const answers = correctYoungAnswers(content), q = content.parts[1].questions;
    answers[q[0].id] = '4'; answers[q[1].id] = 'five'; delete answers[q[2].id]; answers[q[3].id] = 'four years'; answers[q[4].id] = '4 years';
    const submitted = await request(`${student}/attempts/submit`, 'POST', { ...guest, ticket: prepared.data.ticket, runSecret, answers }); assert.equal(submitted.status, 201, JSON.stringify(submitted.data)); assert.equal(submitted.data.gradingVersion, examVersion); assertNoComparisonFields(submitted.data);
    const reviewPath = `${student}/attempts/${submitted.data.id}/review?${new URLSearchParams(guest)}`;
    const review = await request(reviewPath, 'GET', undefined, { 'X-Exam-Run-Secret': runSecret }); assert.equal(review.status, 200, JSON.stringify(review.data)); assertNoComparisonFields(review.data);
    assert.deepEqual(review.data.questions.filter((row: { part: number }) => row.part === 2).map((row: { correct: boolean; unanswered: boolean }) => [row.correct, row.unanswered]), [[true, false], [false, false], [false, true], [true, false], [true, false]]);
    assert.deepEqual(review.data.questions.filter((row: { part: number }) => row.part === 2).map((row: { correctAnswer: string[] }) => row.correctAnswer), Array.from({ length: 5 }, () => ['four']));
    const actor = { id: guest.guestId, ownerKey: `guest:${guest.guestId}`, kind: 'guest' as const, role: 'student' as const };
    const history = await getLearningHistoryDetail(actor, submitted.data.id); assertNoComparisonFields(history);
    assert.ok(history.detail!.answerDetails.some((row: { correctAnswer?: unknown }) => Array.isArray(row.correctAnswer) && row.correctAnswer.length === 1 && row.correctAnswer[0] === 'four'), 'History keeps only the official source answer');
    assert.equal((await request(reviewPath)).status, 404); assert.equal((await request(reviewPath, 'GET', undefined, { 'X-Exam-Run-Secret': 'wrong' })).status, 404); assert.equal((await request(reviewPath, 'GET', undefined, { 'X-Test-Owner': 'other' })).status, 404);
    await db.collection('exam_attempt_details').doc(submitted.data.id).update({ reviewPolicy: { showReviewAfterSubmit: false, policyVersion: 1 } });
    assert.equal((await request(reviewPath, 'GET', undefined, { 'X-Exam-Run-Secret': runSecret })).status, 403); assertNoComparisonFields(await getLearningHistoryDetail(actor, submitted.data.id));
    const malformed = structuredClone(content); Object.assign(malformed.parts[1].questions[0], { inputAnswerVariants: [''] });
    const invalid = await request(admin, 'POST', { content: malformed }); assert.equal(invalid.status, 201); assert.ok(invalid.data.validationErrors.length); assert.equal((await request(`${admin}/${invalid.data.id}/publish`, 'POST')).status, 400);
  });
  await t.test('Movers', async () => {
    const { content, answers } = equivalentMover();
    const ids = new Map<string, 'image' | 'audio'>();
    const collect = (value: unknown) => { if (!value || typeof value !== 'object') return; for (const [key, item] of Object.entries(value)) { if (typeof item === 'string' && key.endsWith('AssetId') && item) ids.set(item, key === 'audioAssetId' ? 'audio' : 'image'); else if (item && typeof item === 'object') collect(item); } };
    collect(content); for (const [id, kind] of ids) await seedAsset(id, kind);
    const admin = '/listening/admin/sets';
    const created = await request(admin, 'POST', { content }); assert.equal(created.status, 201, JSON.stringify(created.data)); assert.deepEqual(created.data.validationErrors, []);
    const saved = await request(`${admin}/${created.data.id}`, 'PUT', { content, visibility: 'public', baseRevision: created.data.draftRevision }); assert.equal(saved.status, 200);
    assert.deepEqual(saved.data.draftContent.parts[1].questions[0].blanks[0].inputAnswerVariants, equivalents);
    const v1 = await request(`${admin}/${created.data.id}/publish`, 'POST'); assert.equal(v1.status, 200, JSON.stringify(v1.data));
    const student = `/listening/sets/${created.data.id}`;
    const playable = await request(student); assert.equal(playable.status, 200); assertNoComparisonFields(playable.data);
    const guest = { guestId: 'input-variants-mover', studentName: 'Mover Variant Learner' }, runSecret = 'input-variants-mover-secret-1234567890';
    const prepared = await request(`${student}/attempts/prepare`, 'POST', { ...guest, clientRunId: 'variants-v1-mover', runSecret }); assert.equal(prepared.status, 200, JSON.stringify(prepared.data)); assertNoComparisonFields(prepared.data);
    const nextContent = structuredClone(content); nextContent.parts[1].questions[0].blanks[0].inputAnswerVariants = ['IV'];
    const nextSaved = await request(`${admin}/${created.data.id}`, 'PUT', { content: nextContent, visibility: 'public', baseRevision: saved.data.draftRevision }); assert.equal(nextSaved.status, 200);
    const v2 = await request(`${admin}/${created.data.id}/publish`, 'POST'); assert.equal(v2.status, 200); assert.notEqual(v1.data.version.id, v2.data.version.id);
    const q = content.parts[1].questions;
    for (const [index, answer] of ['4', 'five', '', 'four years', '4 years'].entries()) answers.part2[q[index].id][q[index].blanks[0].id] = answer;
    const submitted = await request(`${student}/attempts/submit`, 'POST', { ...guest, runSecret, ticket: prepared.data.ticket, answers }); assert.equal(submitted.status, 201, JSON.stringify(submitted.data)); assert.equal(submitted.data.gradingVersion, moverVersion); assertNoComparisonFields(submitted.data);
    const reviewPath = `${student}/attempts/${submitted.data.id}/review?${new URLSearchParams(guest)}`;
    const review = await request(reviewPath, 'GET', undefined, { 'X-Listening-Run-Secret': runSecret }); assert.equal(review.status, 200, JSON.stringify(review.data)); assertNoComparisonFields(review.data);
    assert.deepEqual(review.data.answerDetails.slice(5, 10).map((row: { correctAnswer: string }) => row.correctAnswer), Array.from({ length: 5 }, () => 'four'));
    assert.deepEqual(review.data.answerDetails.slice(5, 10).map((row: { isCorrect: boolean; unanswered: boolean }) => [row.isCorrect, row.unanswered]), [[true, false], [false, false], [false, true], [true, false], [true, false]]);
    const actor = { id: guest.guestId, ownerKey: `guest:${guest.guestId}`, kind: 'guest' as const, role: 'student' as const };
    const history = await getLearningHistoryDetail(actor, submitted.data.id); assertNoComparisonFields(history); assert.ok(history.detail!.answerDetails.some((row: { correctAnswer?: string }) => row.correctAnswer === 'four'));
    assert.equal((await request(reviewPath)).status, 404); assert.equal((await request(reviewPath, 'GET', undefined, { 'X-Listening-Run-Secret': 'wrong' })).status, 404);
    const malformed = structuredClone(content); Object.assign(malformed.parts[1].questions[0].blanks[0], { inputAnswerVariants: [false] });
    const invalid = await request(admin, 'POST', { content: malformed }); assert.equal(invalid.status, 201); assert.ok(invalid.data.validationErrors.length); assert.equal((await request(`${admin}/${invalid.data.id}/publish`, 'POST')).status, 422);
  });
  assert.equal(aiCalls, 0);
});

