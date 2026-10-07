import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { once } from 'node:events';
import { spawnSync } from 'node:child_process';
import { after, test } from 'node:test';
import express from 'express';
import { encodeWav } from '../../features/speaking/audio';
import { MAX_READING_ITEMS, SpeakingError, normalizeLesson, type LessonInput } from '../../shared/speaking/types';
import { initializeSQLiteStorage, closeSQLiteStorage, SQLiteFirestore, sqliteQueryOne, sqliteImmediateTransaction } from '../../lib/sqliteStorage';
import { getLearningHistory, getLearningHistoryDetail } from '../learning-history/learningHistoryService';
import { parseLearningHistoryFilters } from '../learning-history/learningHistoryValidation';
import type { LearningHistoryActor } from '../learning-history/learningHistoryTypes';
import { saveLesson, setLessonStatus, listResults } from './repository';
import { normalizeAzure, type PronunciationProvider } from './providers';
import { createSpeakingService } from './service';
import { createSpeakingRouter } from './router';
import { prepareRecordingAttempt, type RecordingRun } from '../../features/speaking/recordingAttempt';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'speaking-sets-test-'));
Object.assign(process.env, { NODE_ENV: 'test', STORAGE_MODE: 'sqlite', SQLITE_DRIVER: 'better-sqlite3', SQLITE_DB_PATH: path.join(root, 'app.sqlite'), SQLITE_ALLOW_CREATE: 'true', SQLITE_ALLOW_JSON_IMPORT: 'false' });
after(async () => { await closeSQLiteStorage(); fs.rmSync(root, { recursive: true, force: true }); });
const staff = { id: 'sets-teacher', role: 'teacher' as const }, other = { id: 'other-teacher', role: 'teacher' as const };
const student = (id: string): LearningHistoryActor => ({ id, ownerKey: `user:${id}`, kind: 'user', role: 'student', userProfile: { id, role: 'student', name: 'Học sinh B' } });
const actor = student('sets-student'), stranger = student('stranger');
const item = (referenceText: string, sampleAudioUrl = '') => ({ id: 'forged-id', referenceText, sampleAudioUrl, samplePlaybackRate: 1 });
const lessonInput: LessonInput = { title: 'Transport', kind: 'word', referenceText: 'forged text', partnerText: '', instructions: 'Read each word.', grade: 3, locale: 'en-US', provider: 'azure', maxSeconds: 8, sampleAudioUrl: '', samplePlaybackRate: 1, feedbackEnabled: false, items: [item('car'), item('bus'), item('train')] };
const wav = Buffer.from(encodeWav([Float32Array.from({ length: 16000 }, (_, i) => .2 * Math.sin(i * Math.PI * 2 * 220 / 16000))]).bytes);
async function expirePrepared(id: string) {
  await sqliteImmediateTransaction(db => {
    const row = db.one<{ data_json: string }>('SELECT data_json FROM speaking_attempts WHERE id=?', [id])!;
    const data = JSON.parse(row.data_json); data.createdAt = new Date(Date.now() - 26 * 3600000).toISOString();
    db.run('UPDATE speaking_attempts SET created_at=?,data_json=? WHERE id=?', [data.createdAt, JSON.stringify(data), id]);
  });
}
let score = 80, failure = false, calls = 0;
const provider: PronunciationProvider = { id: 'azure', configured: true, maxSeconds: 300, async assess(input) { calls++; if (failure) throw new SpeakingError(504, 'FIXTURE_FAILURE', 'Fixture timeout'); const words = input.lesson.referenceText.split(/\s+/); return normalizeAzure(input, [{ NBest: [{ Display: words.join(' '), PronunciationAssessment: { AccuracyScore: score, FluencyScore: score, PronScore: score }, Words: words.map(Word => ({ Word, Offset: 0, Duration: 1000000, PronunciationAssessment: { AccuracyScore: score, ErrorType: 'None' } })) }] }], 10); } };
const providers = { azure: provider, speechsuper: { ...provider, id: 'speechsuper' as const } };
const service = createSpeakingService({ secret: 'sets-fixture-secret', audioDir: path.join(root, 'private'), providers, dailyLimit: 100 });
async function publish(input = lessonInput) { await initializeSQLiteStorage(); const draft = await saveLesson(staff, input); return setLessonStatus(staff, draft.id, draft.revision, 'published'); }
async function read(owner: LearningHistoryActor, lessonId: string, sessionId: string, itemId: string, run: string, grade: number) { score = grade; const attempt = await service.prepare(owner, 'Student', lessonId, run, {}, { sessionId, itemId }); await service.upload(owner, attempt.id, attempt.ticket!, wav); await service.runNext(); return service.resume(owner, attempt.id); }
const history = (owner: LearningHistoryActor) => getLearningHistory(owner, parseLearningHistoryFilters({ sourceType: 'speaking' }));

test('set validation canonicalizes IDs and first-item media; rejects bad items with their position', () => {
  const normalized = normalizeLesson(lessonInput); assert.deepEqual(normalized.items?.map(i => i.id), ['1', '2', '3']); assert.equal(normalized.referenceText, 'car');
  const audio = normalizeLesson({ ...lessonInput, items: [item('car', '/audio/word.mp3?v=123')] }); assert.equal(audio.sampleAudioUrl, '/audio/word.mp3');
  assert.throws(() => normalizeLesson({ ...lessonInput, items: [] }), /1 đến 50/);
  assert.throws(() => normalizeLesson({ ...lessonInput, items: Array(MAX_READING_ITEMS + 1).fill(item('car')) }));
  assert.throws(() => normalizeLesson({ ...lessonInput, items: [item('car'), item('two words')] }), /Mục 2/);
  assert.throws(() => normalizeLesson({ ...lessonInput, items: [null] }), /Mục 1/);
  assert.throws(() => normalizeLesson({ ...lessonInput, items: [item('car', 'https://example.com/audio.mp3')] }), /Mục 1/);
  assert.throws(() => normalizeLesson({ ...lessonInput, kind: 'passage', maxSeconds: 180 }), /một nội dung/);
  const sentences = normalizeLesson({ ...lessonInput, kind: 'sentence', maxSeconds: 30, items: [item('I go by bus.'), item('This is my car.')] }); assert.equal(sentences.items?.length, 2);
  assert.throws(() => normalizeLesson({ ...lessonInput, kind: 'sentence', maxSeconds: 30, items: Array(11).fill(item('word '.repeat(399))) }), /20.000/);
});

test('set prepare and child prepare are owner-only, idempotent and bound to immutable item definitions', async () => {
  const lesson = await publish(), session = await service.prepareSession(actor, 'Verified', lesson.id, 'sets-owner-run', { classId: 'class-b', className: '3B' });
  assert.equal(session.score, null); assert.equal(session.completedCount, 0);
  assert.equal((await service.prepareSession(actor, 'Forged', lesson.id, 'sets-owner-run', {})).id, session.id);
  await assert.rejects(service.session(stranger, session.id), (e: any) => e.status === 404);
  await assert.rejects(service.prepare(stranger, 'Other', lesson.id, 'cross-owner-001', {}, { sessionId: session.id, itemId: '1' }), (e: any) => e.status === 404);
  await assert.rejects(service.prepare(actor, 'A', lesson.id, 'without-session'), (e: any) => e.code === 'SESSION_REQUIRED');
  await assert.rejects(service.prepare(actor, 'A', lesson.id, 'invalid-item-01', {}, { sessionId: session.id, itemId: 'forged' }), (e: any) => e.code === 'INVALID_ITEM');
  const a = await service.prepare(actor, 'A', lesson.id, 'sets-child-001', {}, { sessionId: session.id, itemId: '2' }); assert.equal(a.lesson.referenceText, 'bus'); assert.equal(a.itemNumber, 2); assert.ok(a.ticket); assert.equal(a.lesson.items, undefined);
  assert.equal((await service.prepare(actor, 'A', lesson.id, 'sets-child-001', {}, { sessionId: session.id, itemId: '2' })).id, a.id);
  await assert.rejects(service.prepare(actor, 'A', lesson.id, 'sets-child-001', {}, { sessionId: session.id, itemId: '1' }), (e: any) => e.code === 'RUN_CONFLICT');
  await saveLesson(staff, { ...lessonInput, items: [item('boat')] }, lesson.id, 1);
  const resumed = await service.latestSession(actor, lesson.id); assert.equal(resumed?.lesson.items?.length, 3); assert.equal(resumed?.items[1].attempt?.ticket, a.ticket);
  const frozen = await service.prepare(actor, 'A', lesson.id, 'sets-child-002', {}, { sessionId: session.id, itemId: '3' }); assert.equal(frozen.lesson.referenceText, 'train');
  await assert.rejects(service.session(actor, session.id, other), (e: any) => e.status === 404);
  const teacherView = await service.session(actor, session.id, staff); assert.ok(!JSON.stringify(teacherView).includes('ticket')); assert.ok(!JSON.stringify(teacherView).includes('ownerKey'));
});

test('each item grades separately; only the completed set appears once in B History and admin results', async () => {
  const owner = student('aggregation'), lesson = await publish(), session = await service.prepareSession(owner, 'Aggregation', lesson.id, 'aggregation-run', {});
  const first = await read(owner, lesson.id, session.id, '1', 'aggregation-1', 60); assert.equal(first.assessment?.score, 60);
  const partial = await service.session(owner, session.id); assert.equal(partial.completedCount, 1); assert.equal(partial.score, null); assert.equal((await history(owner)).items.length, 0);
  await read(owner, lesson.id, session.id, '1', 'aggregation-redo', 90);
  await read(owner, lesson.id, session.id, '2', 'aggregation-2', 80);
  await read(owner, lesson.id, session.id, '3', 'aggregation-3', 70);
  const complete = await service.session(owner, session.id); assert.equal(complete.status, 'completed'); assert.equal(complete.score, 80); assert.deepEqual(complete.items.map(i => i.score), [90, 80, 70]);
  const rows = await history(owner); assert.equal(rows.items.length, 1); assert.equal(rows.items[0].attemptId, session.id); assert.equal(rows.items[0].score, 80);
  const detail = await getLearningHistoryDetail(owner, session.id), review: any = detail.detail?.extraDetails?.speakingReview; assert.equal(review.reviewType, 'speaking-session-v1'); assert.equal(review.items.length, 3);
  assert.ok(!JSON.stringify(detail).includes('ownerKey')); assert.ok(!JSON.stringify(detail).includes('audioHash')); assert.ok(!JSON.stringify(detail).includes('ticket'));
  await assert.rejects(getLearningHistoryDetail(stranger, session.id));
  assert.deepEqual(await service.audio(owner, complete.items[0].attempt!.id), wav); await assert.rejects(service.audio(stranger, first.id), (e: any) => e.status === 404);
  const results = await listResults(staff); assert.equal(results.items.filter(r => r.id === session.id).length, 1); assert.ok(results.items.find(r => r.id === session.id)?.isSession); assert.equal((await listResults(other)).total, 0);
  await assert.rejects(service.prepare(owner, 'A', lesson.id, 'after-complete', {}, { sessionId: session.id, itemId: '1' }), (e: any) => e.code === 'SESSION_COMPLETED');
  const repeated = await service.prepareSession(owner, 'A', lesson.id, 'selected-repeat', {}, { sourceSessionId: session.id, itemIds: ['1', '3'] }); assert.deepEqual(repeated.items.map(i => i.item.referenceText), ['car', 'train']); assert.equal(repeated.score, null);
  await assert.rejects(service.prepareSession(owner, 'A', lesson.id, 'selected-invalid', {}, { sourceSessionId: session.id, itemIds: ['1', '1'] }), (e: any) => e.code === 'INVALID_ITEMS');
  await assert.rejects(service.prepareSession(stranger, 'B', lesson.id, 'source-owner-test', {}, { sourceSessionId: session.id, itemIds: ['1'] }), (e: any) => e.status === 404);
  await read(owner, lesson.id, repeated.id, '1', 'repeat-item-001', 100); await read(owner, lesson.id, repeated.id, '3', 'repeat-item-003', 90);
  assert.equal((await service.session(owner, session.id)).score, 80); assert.equal((await service.session(owner, repeated.id)).score, 95); assert.equal((await history(owner)).items.length, 2);
});

test('recording renews an expired set item on explicit start without losing frozen content or scored items', async () => {
  const owner = student('expired-recording'), lesson = await publish(), session = await service.prepareSession(owner, 'A', lesson.id, 'expired-session-run', {});
  await read(owner, lesson.id, session.id, '1', 'expired-completed-item', 90);
  const old = await service.prepare(owner, 'A', lesson.id, 'expired-item-original', {}, { sessionId: session.id, itemId: '2' });
  assert.equal(old.recordingAllowed, true); await expirePrepared(old.id);
  const restored = await service.session(owner, session.id); assert.equal(restored.items[1].attempt?.recordingAllowed, false);
  await assert.rejects(service.upload(owner, old.id, old.ticket!, wav), (e: SpeakingError) => e.code === 'ATTEMPT_EXPIRED');
  await saveLesson(staff, { ...lessonInput, items: [item('boat')] }, lesson.id, 1);
  let preparations = 0;
  const run: RecordingRun = { clientRunId: 'renewing-run-start', renewingAttemptId: null };
  const renewed = await prepareRecordingAttempt(restored.items[1].attempt, run, {
    resume: id => service.resume(owner, id),
    prepare: clientRunId => { preparations++; return service.prepare(owner, 'A', lesson.id, clientRunId, {}, { sessionId: session.id, itemId: '2' }); },
  });
  assert.equal(preparations, 1); assert.notEqual(renewed.id, old.id); assert.notEqual(renewed.ticket, old.ticket); assert.equal(renewed.recordingAllowed, true);
  assert.equal(renewed.sessionId, session.id); assert.equal(renewed.itemId, '2'); assert.equal(renewed.lesson.referenceText, 'bus'); assert.equal(renewed.lesson.versionId, old.lesson.versionId);
  const resumed = await service.session(owner, session.id); assert.equal(resumed.completedCount, 1); assert.equal(resumed.items[0].score, 90); assert.equal(resumed.items[1].attempt?.id, renewed.id);
  assert.equal((await service.resume(owner, old.id)).recordingAllowed, false);
  await assert.rejects(service.resume(stranger, renewed.id), (e: SpeakingError) => e.status === 404);
  await service.upload(owner, renewed.id, renewed.ticket!, wav); await service.runNext();
  assert.equal((await service.session(owner, session.id)).completedCount, 2);
});

test('renewal reuses its new idempotency key after a lost prepare response', async () => {
  const owner = student('lost-renewal'), lesson = await publish(), session = await service.prepareSession(owner, 'A', lesson.id, 'lost-renewal-set', {});
  const old = await service.prepare(owner, 'A', lesson.id, 'lost-renewal-old', {}, { sessionId: session.id, itemId: '1' }); await expirePrepared(old.id);
  const run: RecordingRun = { clientRunId: 'lost-renewal-new', renewingAttemptId: null }, ids: string[] = [];
  let lost = true;
  const api = { resume: (id: string) => service.resume(owner, id), prepare: async (clientRunId: string) => {
    ids.push(clientRunId); const next = await service.prepare(owner, 'A', lesson.id, clientRunId, {}, { sessionId: session.id, itemId: '1' });
    if (lost) { lost = false; throw Error('Lost prepare response'); } return next;
  } };
  await assert.rejects(prepareRecordingAttempt(old, run, api), /Lost prepare response/);
  const resumed = await prepareRecordingAttempt(old, run, api); assert.equal(ids.length, 2); assert.equal(ids[0], ids[1]); assert.equal(resumed.recordingAllowed, true);
  const count = await sqliteQueryOne<{ n: number }>('SELECT COUNT(*) n FROM speaking_attempts WHERE session_id=?', [session.id]); assert.equal(count?.n, 2);
  assert.equal((await service.session(owner, session.id)).completedCount, 0);
});

test('server availability refresh reuses a valid item and never reopens accepted/completed work', async () => {
  const owner = student('valid-recording'), lesson = await publish(), session = await service.prepareSession(owner, 'A', lesson.id, 'valid-recording-set', {});
  const original = await service.prepare(owner, 'A', lesson.id, 'valid-recording-item', {}, { sessionId: session.id, itemId: '1' });
  const run: RecordingRun = { clientRunId: 'valid-run-unused', renewingAttemptId: null };
  const api = { resume: (id: string) => service.resume(owner, id), prepare: async () => { throw Error('Valid/accepted attempts must not be re-created'); } };
  const fresh = await prepareRecordingAttempt({ ...original, recordingAllowed: false }, run, api);
  assert.equal(fresh.id, original.id); assert.equal(fresh.recordingAllowed, true);
  await service.upload(owner, original.id, original.ticket!, wav);
  assert.equal((await prepareRecordingAttempt(original, run, api)).status, 'queued');
  await service.runNext(); const completed = await service.resume(owner, original.id); assert.equal(completed.recordingAllowed, false);
  assert.equal((await prepareRecordingAttempt(completed, run, api)).id, original.id);
});

test('legacy single reading renews a restored expired prepare key and a new set cannot reuse another set item', async () => {
  const owner = student('legacy-renewal'), draft = await saveLesson(staff, { ...lessonInput, referenceText: 'car', items: undefined }), single = await setLessonStatus(staff, draft.id, 1, 'published');
  const old = await service.prepare(owner, 'A', single.id, 'legacy-restored-run'); await expirePrepared(old.id);
  const run: RecordingRun = { clientRunId: 'legacy-restored-run', renewingAttemptId: null };
  const fresh = await prepareRecordingAttempt(null, run, { resume: id => service.resume(owner, id), prepare: clientRunId => service.prepare(owner, 'A', single.id, clientRunId) });
  assert.notEqual(fresh.id, old.id); assert.equal(fresh.recordingAllowed, true); assert.equal(fresh.sessionId, undefined);
  const lesson = await publish(), first = await service.prepareSession(owner, 'A', lesson.id, 'scope-first-session', {}), next = await service.prepareSession(owner, 'A', lesson.id, 'scope-new-session', {});
  const child = await service.prepare(owner, 'A', lesson.id, 'scope-first-child', {}, { sessionId: first.id, itemId: '1' }); await expirePrepared(child.id);
  assert.equal(next.completedCount, 0); assert.ok(next.items.every(entry => entry.attempt === null));
  await assert.rejects(service.prepare(owner, 'A', lesson.id, 'scope-first-child', {}, { sessionId: next.id, itemId: '1' }), (e: SpeakingError) => e.code === 'RUN_CONFLICT');
});

test('late concurrent grading cannot change a frozen completed set', async () => {
  const owner = student('late'), lesson = await publish({ ...lessonInput, items: [item('car'), item('bus')] }), session = await service.prepareSession(owner, 'A', lesson.id, 'late-set-run', {});
  await read(owner, lesson.id, session.id, '1', 'late-first-run', 60);
  const pending = await service.prepare(owner, 'A', lesson.id, 'late-pending-run', {}, { sessionId: session.id, itemId: '1' });
  await read(owner, lesson.id, session.id, '2', 'late-second-run', 80); const complete = await service.session(owner, session.id); assert.equal(complete.score, 70);
  score = 100; await service.upload(owner, pending.id, pending.ticket!, wav); await service.runNext(); assert.equal((await service.resume(owner, pending.id)).assessment?.score, 100);
  const frozen = await service.session(owner, session.id); assert.equal(frozen.score, 70); assert.equal(frozen.items[0].score, 60); assert.equal((await history(owner)).items.length, 1);
});

test('failed assessment has no item or aggregate score; bounded retry completes the set', async () => {
  const owner = student('failed-set'), lesson = await publish({ ...lessonInput, items: [item('car')] }), session = await service.prepareSession(owner, 'A', lesson.id, 'failed-set-run', {});
  failure = true; const failed = await read(owner, lesson.id, session.id, '1', 'failed-item-run', 80); failure = false;
  assert.equal(failed.status, 'failed'); assert.equal((await service.session(owner, session.id)).completedCount, 0); assert.equal((await history(owner)).items.length, 1); assert.equal((await history(owner)).items[0].status, 'interrupted'); assert.equal((await history(owner)).summary.averageScore, 0);
  await service.retry(owner, failed.id, failed.ticket!); await service.runNext(); assert.equal((await service.session(owner, session.id)).score, 80);
});

test('set item attempts retain the configured daily limit, including idempotent resume', async () => {
  const limited = createSpeakingService({ secret: 'sets-fixture-secret', audioDir: path.join(root, 'private'), providers, dailyLimit: 1 }), owner = student('daily-set'), lesson = await publish();
  const session = await limited.prepareSession(owner, 'A', lesson.id, 'daily-set-run', {}), a = await limited.prepare(owner, 'A', lesson.id, 'daily-item-one', {}, { sessionId: session.id, itemId: '1' });
  assert.equal((await limited.prepare(owner, 'A', lesson.id, 'daily-item-one', {}, { sessionId: session.id, itemId: '1' })).id, a.id);
  await assert.rejects(limited.prepare(owner, 'A', lesson.id, 'daily-item-two', {}, { sessionId: session.id, itemId: '2' }), (e: any) => e.code === 'DAILY_LIMIT');
  assert.equal((await limited.session(owner, session.id)).score, null);
});

test('set AI failure is independent of the aggregate pronunciation grade', async () => {
  const owner = student('set-feedback'), lesson = await publish({ ...lessonInput, feedbackEnabled: true, items: [item('car')] });
  const feedbackService = createSpeakingService({ secret: 'sets-fixture-secret', audioDir: path.join(root, 'private'), providers, feedback: async () => { throw new Error('fixture feedback failure'); } });
  const session = await feedbackService.prepareSession(owner, 'A', lesson.id, 'feedback-set-run', {}); score = 85;
  const a = await feedbackService.prepare(owner, 'A', lesson.id, 'feedback-item-run', {}, { sessionId: session.id, itemId: '1' }); await feedbackService.upload(owner, a.id, a.ticket!, wav);
  await feedbackService.runNext(); assert.equal((await feedbackService.session(owner, session.id)).score, 85); await feedbackService.runNext();
  const result = await feedbackService.session(owner, session.id); assert.equal(result.items[0].attempt?.feedbackState, 'failed'); assert.equal(result.score, 85);
});

test('media maintenance protects audio referenced only by non-first items in frozen sessions and versions', async () => {
  const mediaName = 'b'.repeat(64) + '.mp3', lesson = await publish({ ...lessonInput, items: [item('car'), item('bus', '/audio/' + mediaName)] });
  await service.prepareSession(student('media'), 'A', lesson.id, 'media-set-run', {});
  await saveLesson(staff, { ...lessonInput, items: [item('train')] }, lesson.id, 1); await setLessonStatus(staff, lesson.id, 2, 'archived');
  const mediaDir = path.join(root, 'tts'); fs.mkdirSync(mediaDir); fs.writeFileSync(path.join(mediaDir, mediaName), 'fixture'); const old = new Date(Date.now() - 10 * 86400000); fs.utimesSync(path.join(mediaDir, mediaName), old, old);
  const child = spawnSync(process.execPath, ['scripts/media-orphan-maintenance.mjs', '--db', process.env.SQLITE_DB_PATH!, '--tts-dir', mediaDir], { encoding: 'utf8', windowsHide: true, env: { ...process.env, TTS_AUDIO_DIR: '', LISTENING_MEDIA_DIR: '' } });
  assert.equal(child.status, 0, child.stderr); const report = JSON.parse(child.stdout).report; assert.equal(report.tts.referenced, 1); assert.equal(report.tts.candidates.length, 0); assert.ok(fs.existsSync(path.join(mediaDir, mediaName)));
});

test('HTTP set identity comes from B, owner sessions are private, and missing TTS returns an actionable 503', async () => {
  const app = express(); app.use(express.json()); let previews = 0;
  const optional: express.RequestHandler = (req, _res, next) => { if (req.headers.authorization === 'Bearer student') req.user = actor.userProfile as any; if (req.headers.authorization === 'Bearer teacher') req.user = { id: staff.id, role: staff.role, name: 'Teacher' } as any; if (req.headers.authorization === 'Bearer stranger') req.user = stranger.userProfile as any; next(); };
  const options = { enabled: true, ticketSecret: 'sets-fixture-secret', audioDir: path.join(root, 'private'), providers, env: {}, startWorker: false, feedbackMode: 'metrics' as const, db: new SQLiteFirestore(), authenticateOptionalUser: optional, authenticateUser: ((_req, res) => res.sendStatus(401)) as express.RequestHandler, requireStaff: ((req, res, next) => req.user?.role === 'teacher' ? next() : res.sendStatus(403)) as express.RequestHandler, rateLimit: ((_req, _res, next) => next()) as express.RequestHandler, preview: async () => { previews++; return { audioUrl: '/audio/fixture.mp3' }; } };
  app.use('/missing', createSpeakingRouter({ ...options, sampleTts: { configured: false, reason: 'Chưa cấu hình TTS B; dùng giọng đọc trên thiết bị.' } }));
  app.use('/failed', createSpeakingRouter({ ...options, sampleTts: { configured: true, reason: '' }, preview: async () => { throw new Error('sensitive-key-fixture'); } }));
  let azurePreviews = 0;
  app.use('/azure', createSpeakingRouter({ ...options, sampleTts: { provider: 'azure', configured: true, reason: '' }, preview: async (input) => { azurePreviews++; assert.deepEqual(input, { text: 'car', settings: { lang: 'en-GB', speed: 1 } }); return { audioUrl: '/audio/azure-fixture.mp3', hash: 'azure-fixture', cached: false, warnings: [] }; } }));
  app.use('/azure-timeout', createSpeakingRouter({ ...options, sampleTts: { provider: 'azure', configured: true, reason: '' }, preview: async () => { throw Object.assign(new Error('sensitive-key-fixture'), { status: 504 }); } }));
  app.use('/azure-limit', createSpeakingRouter({ ...options, sampleTts: { provider: 'azure', configured: true, reason: '' }, sampleRateLimit: ((_req, res) => res.status(429).json({ code: 'TTS_RATE_LIMIT' })) as express.RequestHandler }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening'); const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const post = (data: unknown, user = 'teacher') => ({ method: 'POST', headers: { Authorization: `Bearer ${user}`, 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  try {
    const preview = { ...lessonInput, referenceText: 'car', items: undefined };
    const missing = await fetch(origin + '/missing/admin/sample', post(preview)); assert.equal(missing.status, 503); assert.equal((await missing.json()).code, 'SAMPLE_TTS_UNAVAILABLE'); assert.equal(previews, 0);
    const failed = await fetch(origin + '/failed/admin/sample', post(preview)); assert.equal(failed.status, 502); const error = await failed.json(); assert.equal(error.code, 'SAMPLE_TTS_FAILED'); assert.ok(!JSON.stringify(error).includes('sensitive-key-fixture'));
    assert.equal((await fetch(origin + '/failed/admin/sample', post(lessonInput))).status, 400);
    assert.equal((await fetch(origin + '/azure/admin/sample', post(preview, 'student'))).status, 403); assert.equal(azurePreviews, 0);
    assert.equal((await fetch(origin + '/azure/admin/sample', post(preview, 'anonymous'))).status, 401); assert.equal(azurePreviews, 0);
    assert.equal((await fetch(origin + '/azure/admin/sample', post({ ...preview, referenceText: '' }))).status, 400); assert.equal(azurePreviews, 0);
    const azure = await fetch(origin + '/azure/admin/sample', post({ ...preview, locale: 'en-GB' })); assert.equal(azure.status, 200); const azureData = await azure.json(); assert.equal(azureData.audioUrl, '/audio/azure-fixture.mp3'); assert.equal(azureData.playbackRate, 1); assert.equal(azurePreviews, 1);
    assert.equal((await fetch(origin + '/azure-limit/admin/sample', post(preview))).status, 429); assert.equal(previews, 0);
    const timeout = await fetch(origin + '/azure-timeout/admin/sample', post(preview)); assert.equal(timeout.status, 504); const timeoutData = await timeout.json(); assert.ok(timeoutData.error.includes('Azure')); assert.ok(!JSON.stringify(timeoutData).includes('sensitive-key-fixture'));
    const caps = await (await fetch(origin + '/missing/capabilities')).json(); assert.equal(caps.sampleTts.configured, false); assert.equal(caps.providers[0].configured, true);
    const lesson = await publish(), response = await fetch(origin + '/missing/sessions/prepare', post({ lessonId: lesson.id, clientRunId: 'http-set-run', ownerKey: 'forged', studentName: 'forged', score: 100, classId: 'forged' }, 'student'));
    assert.equal(response.status, 201); const session = await response.json(); const row = await sqliteQueryOne<{ owner_key: string; student_name: string; class_id: string }>('SELECT owner_key,student_name,class_id FROM speaking_sessions WHERE id=?', [session.id]); assert.equal(row?.owner_key, actor.ownerKey); assert.equal(row?.student_name, 'Học sinh B'); assert.equal(row?.class_id, null); assert.equal(session.score, null);
    assert.equal((await fetch(origin + `/missing/sessions/${session.id}`, { headers: { Authorization: 'Bearer stranger' } })).status, 404);
    const a = await (await fetch(origin + '/missing/attempts/prepare', post({ lessonId: lesson.id, sessionId: session.id, itemId: '2', clientRunId: 'http-item-run', referenceText: 'forged', score: 100 }, 'student'))).json(); assert.equal(a.lesson.referenceText, 'bus'); assert.equal(a.assessment, null);
    const resumed = await (await fetch(origin + '/missing/sessions/latest?lessonId=' + lesson.id, { headers: { Authorization: 'Bearer student' } })).json(); assert.equal(resumed.id, session.id); assert.equal(resumed.items[1].attempt.id, a.id); assert.ok(resumed.items[1].attempt.ticket);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
