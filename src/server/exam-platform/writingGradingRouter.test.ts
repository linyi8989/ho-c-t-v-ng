import assert from 'node:assert/strict';
import { once } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import express from 'express';
import { createDefaultExamContent, getExamPaperDefinition } from '../../features/exam-platform/definitions';
import { createExamRouter } from './examRouter';
import { gradeExamAttempt } from './examGrader';
import { WRITING_GRADING_MAX_PROVIDER_ATTEMPTS, WritingGradingProviderError, type WritingGradeInput, type WritingGradeOutput, type WritingGradingRetryInfo } from './writingGradingProvider';

function barrier() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}

async function eventually<T>(read: () => Promise<T>, accept: (value: T) => boolean) {
  for (let index = 0; index < 300; index += 1) {
    const value = await read();
    if (accept(value)) return value;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.fail('Timed out waiting for the isolated Writing worker.');
}

test('Writing API starts every distinct student immediately and preserves per-essay retries, teacher decisions and recovery', async t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'vhomework-writing-queue-'));
  const databasePath = path.join(directory, 'app.sqlite');
  if (process.env.WRITING_TEST_DB_COPY) fs.copyFileSync(process.env.WRITING_TEST_DB_COPY, databasePath);
  process.env.NODE_ENV = 'test';
  process.env.STORAGE_MODE = 'sqlite';
  process.env.SQLITE_DRIVER = process.env.WRITING_TEST_SQLITE_DRIVER || 'sqljs';
  process.env.SQLITE_DB_PATH = databasePath;
  process.env.SQLITE_ALLOW_CREATE = 'true';
  process.env.SQLITE_ALLOW_JSON_IMPORT = 'false';
  const storage = await import('../../lib/sqliteStorage');
  await storage.initializeSQLiteStorage();
  const db = new storage.SQLiteFirestore();
  const copiedAttempts = await db.collection('exam_attempts').where('status', '==', 'pending_review').get();
  copiedAttempts.forEach((document: any) => assert(!['queued', 'processing', 'retrying'].includes(String(document.data().aiGradingStatus)), 'Refuse a copied DB with recoverable real attempts.'));
  const teacher = { id: 'writing-queue-teacher', name: 'Queue teacher', role: 'teacher' as const, status: 'active' as const, createdAt: new Date().toISOString(), email: 'queue@example.test' };
  const optionalAuth: express.RequestHandler = (req, _res, next) => {
    if (req.headers['x-test-teacher']) req.user = { ...teacher, id: req.headers['x-test-teacher'] === 'owner' ? teacher.id : 'another-teacher' };
    next();
  };
  const requiredAuth: express.RequestHandler = (req, res, next) => {
    optionalAuth(req, res, () => req.user ? next() : res.status(401).json({ error: 'Sign in.' }));
  };
  const adminHeaders = { 'Content-Type': 'application/json', 'X-Test-Teacher': 'owner' };
  const calls: WritingGradeInput[] = [];
  const gates = new Map<string, ReturnType<typeof barrier>>();
  const failures = new Set<string>();
  const providerFailures = new Map<string, Error>();
  const retrySignals = new Map<string, { signal: ReturnType<typeof barrier>; notified: ReturnType<typeof barrier>; resume: ReturnType<typeof barrier>; info: WritingGradingRetryInfo }>();
  let active = 0;
  let maximumActive = 0;
  const grade = async (input: WritingGradeInput, options?: { onAttempt?: (attempt: number, maxAttempts: number) => void | Promise<void>; onRetry?: (info: WritingGradingRetryInfo) => void | Promise<void> }): Promise<WritingGradeOutput> => {
    calls.push(input);
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    try {
      await options?.onAttempt?.(1, WRITING_GRADING_MAX_PROVIDER_ATTEMPTS);
      const retrySignal = retrySignals.get(input.essay);
      if (retrySignal) {
        await retrySignal.signal.promise;
        await options?.onRetry?.(retrySignal.info);
        retrySignal.notified.release();
        await retrySignal.resume.promise;
        retrySignals.delete(input.essay);
        await options?.onAttempt?.(2, WRITING_GRADING_MAX_PROVIDER_ATTEMPTS);
      }
      await gates.get(input.essay)?.promise;
      if (failures.delete(input.essay)) throw new TypeError('fetch failed');
      const providerFailure = providerFailures.get(input.essay);
      if (providerFailure) { providerFailures.delete(input.essay); throw providerFailure; }
      return { providerId: 'stali:gpt-5.6-sol', score: 8, sentenceCount: 3, grammarErrors: [], vocabularyErrors: [], grammarCorrections: [], vocabularyCorrections: [], revisedEssay: input.essay, feedback: 'Bài viết hoàn thành đúng yêu cầu.' };
    } finally { active -= 1; }
  };
  const servers: ReturnType<express.Express['listen']>[] = [];
  const openServer = async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/exam-platform', createExamRouter({
      db, authenticateUser: requiredAuth, authenticateOptionalUser: optionalAuth,
      requireStaff: (_req, _res, next) => next(), ticketSecret: 'writing-queue-regression-ticket-secret',
      resolveGuestProfile: async (guestId, studentName) => ({ id: String(guestId), displayName: String(studentName), status: 'active' }),
      writingGrading: { providers: [{ id: 'stali:gpt-5.6-sol', label: 'Mock only', enabled: true }], grade, retryCooldownMs: 1_000, recoveryIntervalMs: 0 },
    }));
    const server = app.listen(0, '127.0.0.1');
    servers.push(server);
    await once(server, 'listening');
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/exam-platform`;
  };
  t.after(async () => {
    for (const gate of gates.values()) gate.release();
    for (const signal of retrySignals.values()) { signal.signal.release(); signal.resume.release(); }
    for (const server of servers) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await eventually(async () => active, value => value === 0);
    await storage.closeSQLiteStorage();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const base = await openServer();
  const content = createDefaultExamContent(getExamPaperDefinition('writing', 'writing')!);
  content.title = 'Isolated Writing concurrency regression';
  content.showReviewAfterSubmit = true;
  const questionId = content.parts[0].questions[0].id;
  const create = await fetch(`${base}/admin/modules/writing/papers/writing/sets`, { method: 'POST', headers: adminHeaders, body: JSON.stringify({ content }) });
  assert.equal(create.status, 201);
  const set = await create.json() as any;
  const adminSet = `/admin/modules/writing/papers/writing/sets/${set.id}`;
  const publicSet = `/modules/writing/papers/writing/sets/${set.id}`;
  const update = await fetch(base + adminSet, { method: 'PUT', headers: adminHeaders, body: JSON.stringify({ content, visibility: 'public', baseRevision: set.draftRevision }) });
  assert.equal(update.status, 200);
  const publish = await fetch(base + adminSet + '/publish', { method: 'POST', headers: adminHeaders });
  assert.equal(publish.status, 200, JSON.stringify(await publish.json()));

  const prepare = async (label: string) => {
    const identity = { guestId: `writing-queue-${label}`, studentName: `Student ${label}` };
    const runSecret = `writing-queue-secret-${label}-12345678`;
    const response = await fetch(base + publicSet + '/attempts/prepare', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...identity, runSecret, clientRunId: `writing-queue-run-${label}` }) });
    assert.equal(response.status, 200);
    const ticket = await response.json() as any;
    const essay = `Response ${label}: I would like to visit my friend this weekend. We will play games together and have lunch at the park near my house.`;
    return { identity, runSecret, essay, body: { ...identity, ticket: ticket.ticket, runSecret, answers: { [questionId]: essay } } };
  };
  const submit = async (run: Awaited<ReturnType<typeof prepare>>) => {
    const response = await fetch(base + publicSet + '/attempts/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(run.body) });
    assert.equal(response.status, 201);
    return await response.json() as any;
  };
  const stored = async (attemptId: string) => (await db.collection('exam_attempts').doc(attemptId).get()).data() as any;
  const detail = async (attemptId: string) => (await db.collection('exam_attempt_details').doc(attemptId).get()).data() as any;
  const waitCompleted = (attemptId: string) => eventually(() => stored(attemptId), value => value.status === 'completed');
  const manual = async (attemptId: string, score: number) => {
    const response = await fetch(base + adminSet + `/attempts/${attemptId}/manual-grade`, { method: 'POST', headers: adminHeaders, body: JSON.stringify({ grades: { [questionId]: score } }) });
    assert.equal(response.status, 200, JSON.stringify(await response.json()));
  };

  let templateAttempt: any;
  let templateDetail: any;
  await t.test('twenty students all start before any is released, persist once, and keep active teacher grades', async () => {
    const runs = await Promise.all(Array.from({ length: 20 }, (_, index) => prepare(`class-${index}`)));
    for (const run of runs) gates.set(run.essay, barrier());
    const attempts = await Promise.all(runs.map(submit));
    await eventually(async () => calls.length, value => value === runs.length);
    assert.equal(active, runs.length, 'Every independent student is admitted while all earlier requests remain active.');
    const snapshots = await Promise.all(attempts.map(attempt => stored(attempt.id)));
    assert.equal(snapshots.filter(attempt => attempt.aiGradingStatus === 'processing').length, runs.length);
    assert.equal(snapshots.filter(attempt => attempt.aiGradingStatus === 'queued').length, 0);
    for (const attempt of snapshots) {
      assert(attempt.aiGradingLeaseToken);
      assert(new Date(attempt.aiGradingLeaseExpiresAt).getTime() > Date.now());
      assert.equal(attempt.aiGradingAttempt, 1);
      assert.equal(attempt.aiGradingMaxAttempts, WRITING_GRADING_MAX_PROVIDER_ATTEMPTS);
    }
    for (let index = 0; index < attempts.length; index += 1) assert.equal((await detail(attempts[index].id)).answers[questionId], runs[index].essay);
    const duplicate = await fetch(base + publicSet + '/attempts/submit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(runs[0].body) });
    assert.equal(duplicate.status, 200);
    const duplicateSummary = await duplicate.json() as any;
    assert.equal(duplicateSummary.id, attempts[0].id);
    for (const privateField of ['ownerKey', 'guestId', 'userId', 'runSecretHash', 'aiGradingLeaseToken', 'aiGradingLeaseExpiresAt', 'answers']) assert(!(privateField in duplicateSummary));
    assert.equal(calls.length, runs.length, 'Replaying a submitted attempt does not create another provider call.');
    const firstTeacherId = attempts[0].id;
    const activeTeacherId = attempts[1].id;
    await manual(firstTeacherId, 6);
    await manual(activeTeacherId, 7);
    for (const run of runs) gates.get(run.essay)!.release();
    await Promise.all(attempts.map(attempt => waitCompleted(attempt.id)));
    await eventually(async () => active, value => value === 0);
    assert.equal(calls.length, runs.length);
    assert.equal(maximumActive, runs.length);
    for (const [attemptId, score] of [[firstTeacherId, 6], [activeTeacherId, 7]] as const) {
      const result = await stored(attemptId);
      assert.equal(result.gradedBy, 'teacher');
      assert.equal(result.writingScore, score);
      assert.equal(result.pendingManualCount, 0);
      assert.equal((await detail(attemptId)).grade.questions[0].pointsAwarded, score);
    }
    const completed = attempts.find(attempt => attempt.id !== firstTeacherId && attempt.id !== activeTeacherId)!;
    templateAttempt = await stored(completed.id);
    templateDetail = await detail(completed.id);
  });

  await t.test('one failed or held essay never blocks another student and retries the same protected attempt', async () => {
    const first = await prepare('failure');
    const held = await prepare('held');
    const next = await prepare('after-failure');
    gates.set(first.essay, barrier());
    gates.set(held.essay, barrier());
    failures.add(first.essay);
    const failedAttempt = await submit(first);
    const heldAttempt = await submit(held);
    await eventually(async () => active, value => value === 2);
    const nextAttempt = await submit(next);
    await waitCompleted(nextAttempt.id);
    assert.equal(active, 2, 'A later student completes while both earlier independent essays are still active.');
    gates.get(first.essay)!.release();
    const failed = await eventually(() => stored(failedAttempt.id), value => value.aiGradingStatus === 'failed');
    assert.equal(active, 1);
    assert.equal(failed.aiGradingRetryable, true);
    assert.match(failed.aiGradingMessage, /kết nối/i);
    assert.doesNotMatch(failed.aiGradingMessage, /quá tải/i);
    assert.equal((await detail(failed.id)).aiGradingFailureCategory, 'network');
    assert.equal((await detail(failed.id)).answers[questionId], first.essay);
    const retryPath = base + publicSet + `/attempts/${failed.id}/retry-writing-grade`;
    const retry = (runSecret: string, identity = first.identity, teacherHeader = '') => fetch(retryPath, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Exam-Run-Secret': runSecret, ...(teacherHeader ? { 'X-Test-Teacher': teacherHeader } : {}) }, body: JSON.stringify(identity) });
    assert.equal((await retry('wrong-secret')).status, 404);
    assert.equal((await retry(first.runSecret, held.identity)).status, 404);
    assert.equal((await retry(first.runSecret, first.identity, 'other')).status, 404);
    const early = await retry(first.runSecret);
    assert.equal(early.status, 429);
    assert.equal((await early.json() as any).details.code, 'WRITING_GRADING_COOLDOWN');
    await db.collection('exam_attempts').doc(failed.id).set({ ...await stored(failed.id), aiGradingNextRetryAt: new Date(Date.now() - 1).toISOString() });
    const beforeRetryCalls = calls.length;
    const resumed = await retry(first.runSecret);
    assert.equal(resumed.status, 202);
    assert.equal((await resumed.json() as any).id, failed.id);
    const completed = await waitCompleted(failed.id);
    assert.equal(completed.aiGradingCycle, 2);
    assert.equal(calls.length, beforeRetryCalls + 1);
    assert.equal((await detail(failed.id)).answers[questionId], first.essay);
    gates.get(held.essay)!.release();
    await waitCompleted(heldAttempt.id);
    await eventually(async () => active, value => value === 0);
  });

  await t.test('an administrative retry during an old AI call runs the newer durable cycle once', async () => {
    const run = await prepare('teacher-retry-active');
    gates.set(run.essay, barrier());
    const before = calls.length;
    const attempt = await submit(run);
    await eventually(async () => calls.length, value => value === before + 1);
    const retryResponse = await fetch(base + adminSet + `/attempts/${attempt.id}/retry-writing-grade`, { method: 'POST', headers: adminHeaders });
    assert.equal(retryResponse.status, 202);
    assert.equal((await retryResponse.json() as any).aiGradingCycle, 2);
    const waiting = await stored(attempt.id);
    assert.equal(waiting.aiGradingStatus, 'queued');
    assert.equal(waiting.aiGradingLeaseToken, '');
    assert.equal(calls.length, before + 1, 'An older active worker still deduplicates this attempt.');
    gates.get(run.essay)!.release();
    const completed = await waitCompleted(attempt.id);
    assert.equal(completed.aiGradingCycle, 2);
    assert.equal(calls.length, before + 2, 'The old worker schedules the newer cycle after it exits.');
    assert.equal(completed.writingScore, 8);
    assert.equal((await detail(attempt.id)).answers[questionId], run.essay);
  });

  await t.test('one essay waiting before retry never delays another essay on the same provider', async () => {
    const first = await prepare('provider-backoff');
    const next = await prepare('provider-independent');
    const signal = { signal: barrier(), notified: barrier(), resume: barrier(), info: { category: 'overload' as const, retryable: true, status: 429, retryAfterMs: 250, delayMs: 250 } };
    retrySignals.set(first.essay, signal);
    gates.set(first.essay, barrier());
    const firstAttempt = await submit(first);
    await eventually(async () => active, value => value === 1);
    const before = calls.length;
    signal.signal.release();
    await signal.notified.promise;
    assert.equal((await stored(firstAttempt.id)).aiGradingAttempt, 1, 'Only this essay waits before its second request.');
    const nextAttempt = await submit(next);
    await waitCompleted(nextAttempt.id);
    assert.equal(calls.length, before + 1, 'The same provider admits a distinct essay during an earlier essay retry delay.');
    assert.equal(active, 1);
    assert.equal((await stored(firstAttempt.id)).aiGradingStatus, 'retrying');
    assert.equal((await stored(firstAttempt.id)).aiGradingAttempt, 1);
    signal.resume.release();
    await eventually(() => stored(firstAttempt.id), value => value.aiGradingStatus === 'retrying' && value.aiGradingAttempt === 2);
    gates.get(first.essay)!.release();
    await waitCompleted(firstAttempt.id);
    await eventually(async () => active, value => value === 0);
  });

  await t.test('a newer administrative cycle starts once when an older retry callback becomes stale', async () => {
    const run = await prepare('teacher-retry-during-backoff');
    const signal = { signal: barrier(), notified: barrier(), resume: barrier(), info: { category: 'overload' as const, retryable: true, status: 429, retryAfterMs: 250, delayMs: 250 } };
    retrySignals.set(run.essay, signal);
    const before = calls.length;
    const attempt = await submit(run);
    await eventually(async () => calls.length, value => value === before + 1);
    signal.signal.release();
    await signal.notified.promise;
    const retrying = await stored(attempt.id);
    assert.equal(retrying.aiGradingStatus, 'retrying');
    assert.equal(retrying.aiGradingAttempt, 1);
    const retryResponse = await fetch(base + adminSet + `/attempts/${attempt.id}/retry-writing-grade`, { method: 'POST', headers: adminHeaders });
    assert.equal(retryResponse.status, 202);
    assert.equal((await retryResponse.json() as any).aiGradingCycle, 2);
    assert.equal((await stored(attempt.id)).aiGradingStatus, 'queued');
    assert.equal(calls.length, before + 1, 'The same attempt remains deduplicated while its old retry is waiting.');
    signal.resume.release();
    const completed = await waitCompleted(attempt.id);
    await eventually(async () => active, value => value === 0);
    assert.equal(calls.length, before + 2, 'A stale onAttempt callback hands off directly to the newest cycle with recovery polling disabled.');
    assert.equal(completed.aiGradingCycle, 2);
    assert.equal(completed.aiGradingStatus, 'completed');
    assert.equal(completed.aiGradingAttempt, 1, 'The new cycle starts at its own first provider request.');
    assert.equal(completed.writingScore, 8);
    assert.equal((await detail(attempt.id)).answers[questionId], run.essay);
  });

  await t.test('failure categories stay distinct and permanent errors cannot be learner-retried', async () => {
    for (const [label, error, message, retryable] of [
      ['timeout', new DOMException('operation timed out', 'AbortError'), /thời gian cho phép/i, true],
      ['invalid-output', new SyntaxError('Unexpected token in JSON'), /kết quả chưa hợp lệ/i, true],
      ['permanent', new WritingGradingProviderError('Stali chấm Writing thất bại (401).', { category: 'permanent', retryable: false, status: 401 }), /HTTP 401/i, false],
    ] as const) {
      const run = await prepare(`category-${label}`);
      providerFailures.set(run.essay, error);
      const attempt = await submit(run);
      const failed = await eventually(() => stored(attempt.id), value => value.aiGradingStatus === 'failed');
      assert.equal(failed.aiGradingRetryable, retryable);
      assert.match(failed.aiGradingMessage, message);
      const failedDetail = await detail(attempt.id);
      assert.equal(failedDetail.aiGradingFailureCategory, label);
      assert.equal(failedDetail.answers[questionId], run.essay);
      if (!retryable) {
        const response = await fetch(base + publicSet + `/attempts/${attempt.id}/retry-writing-grade`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Exam-Run-Secret': run.runSecret }, body: JSON.stringify(run.identity) });
        assert.equal(response.status, 409);
        assert.equal(failed.aiGradingNextRetryAt, '');
        assert.equal(failedDetail.aiGradingHttpStatus, 401);
      }
    }
    const run = await prepare('category-overload-long-header');
    providerFailures.set(run.essay, new WritingGradingProviderError('Stali chấm Writing thất bại (429).', { category: 'overload', retryable: true, status: 429, retryAfterMs: 1_800 }));
    const attempt = await submit(run);
    const failed = await eventually(() => stored(attempt.id), value => value.aiGradingStatus === 'failed');
    assert.match(failed.aiGradingMessage, /giới hạn số bài/i);
    assert.equal(failed.aiGradingRetryable, true);
    assert(new Date(failed.aiGradingNextRetryAt).getTime() - new Date(failed.updatedAt).getTime() >= 1_800, 'The provider Retry-After exceeds the local 1s cooldown.');
    assert.equal((await detail(attempt.id)).aiGradingFailureCategory, 'overload');
  });

  await t.test('startup recovers durable queued and expired leases without taking an unexpired lease early', async () => {
    const recoveredIds: string[] = [];
    const startCalls = calls.length;
    const deadline = Date.now() + 400;
    for (const status of ['queued', 'expired', 'unexpired'] as const) {
      const attemptId = `writing-recovery-${status}`;
      const essay = `Recovered ${status} response. I am writing to my friend about our weekend plans and the games we will enjoy together.`;
      const answers = { [questionId]: essay };
      const freshGrade = gradeExamAttempt(content, answers);
      const batch = db.batch();
      batch.set(db.collection('exam_attempts').doc(attemptId), { ...templateAttempt, id: attemptId, clientRunId: attemptId, status: 'pending_review', aiGradingStatus: status === 'queued' ? 'queued' : 'processing', pendingManualCount: 1, aiGradingCycle: 3, aiGradingLeaseToken: status === 'queued' ? '' : 'interrupted-worker', aiGradingLeaseExpiresAt: status === 'queued' ? '' : new Date(status === 'expired' ? Date.now() - 100 : deadline).toISOString() });
      batch.set(db.collection('exam_attempt_details').doc(attemptId), { ...templateDetail, id: attemptId, attemptId, answers, grade: freshGrade, questions: freshGrade.questions });
      await batch.commit();
      recoveredIds.push(attemptId);
    }
    await openServer();
    await eventually(async () => calls.length, value => value >= startCalls + 2);
    assert(!calls.slice(startCalls).some(input => input.essay.startsWith('Recovered unexpired')), 'A valid lease stays owned until its deadline.');
    assert.equal((await stored('writing-recovery-unexpired')).aiGradingLeaseToken, 'interrupted-worker');
    await Promise.all(recoveredIds.map(waitCompleted));
    assert.equal(calls.length, startCalls + 3);
    assert.equal(maximumActive, 20);
    for (const attemptId of recoveredIds) {
      const result = await stored(attemptId);
      assert.equal(result.aiGradingCycle, 3);
      assert.equal(result.aiGradingStatus, 'completed');
      assert.equal(result.aiGradingLeaseToken, '');
      assert.equal(result.pendingManualCount, 0);
    }
  });
});
