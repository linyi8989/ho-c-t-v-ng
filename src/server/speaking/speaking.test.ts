import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { test, after } from 'node:test';
import express from 'express';
import { encodeWav, PcmResampler } from '../../features/speaking/audio';
import { normalizeLesson, SpeakingError, type Assessment, type LessonInput, type WordScore, type AttemptView } from '../../shared/speaking/types';
import { inspectWav } from './audio';
import { alignWords, configureAzureAssessment, normalizeAzure, normalizeSpeechSuper, createProviders, type ProviderInput, type PronunciationProvider } from './providers';
import { readingMetrics } from '../../shared/speaking/metrics';
import { saveLesson, setLessonStatus, getLesson, listLessons, lessonPage, listResults } from './repository';
import { createSpeakingService } from './service';
import { createSpeakingRouter } from './router';
import { createSpeakingFeedback } from './feedback';
import { initializeSQLiteStorage, closeSQLiteStorage, sqliteImmediateTransaction, sqliteQueryOne, SQLiteFirestore } from '../../lib/sqliteStorage';
import { getLearningHistory, getLearningHistoryDetail } from '../learning-history/learningHistoryService';
import { parseLearningHistoryFilters } from '../learning-history/learningHistoryValidation';
import type { LearningHistoryActor } from '../learning-history/learningHistoryTypes';
import { normalizeReadingTtsInput } from '../tts/readingInput';
import { createTtsService } from '../tts/service';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'speaking-test-'));
process.env.NODE_ENV = 'test'; process.env.STORAGE_MODE = 'sqlite'; process.env.SQLITE_DRIVER = 'better-sqlite3'; process.env.SQLITE_DB_PATH = path.join(root, 'app.sqlite'); process.env.SQLITE_ALLOW_CREATE = 'true'; process.env.SQLITE_ALLOW_JSON_IMPORT = 'false';
after(async () => { await closeSQLiteStorage(); fs.rmSync(root, { recursive: true, force: true }); });
const input: LessonInput = { title: 'A word', kind: 'word', referenceText: 'apple', partnerText: '', instructions: '', grade: 3, locale: 'en-US', provider: 'azure', maxSeconds: 8, sampleAudioUrl: '', samplePlaybackRate: 1, feedbackEnabled: false };
const teacher = { id: 'teacher-a', role: 'teacher' as const }, otherTeacher = { id: 'teacher-b', role: 'teacher' as const };
const actor: LearningHistoryActor = { id: 'student-a', ownerKey: 'user:student-a', kind: 'user', role: 'student', userProfile: { id: 'student-a', role: 'student', name: 'Học sinh A' } }, stranger: LearningHistoryActor = { ...actor, id: 'student-b', ownerKey: 'user:student-b' };
function wav(seconds = 1, amplitude = .2) { return Buffer.from(encodeWav([Float32Array.from({ length: seconds * 16000 }, (_, i) => amplitude * Math.sin(i * Math.PI * 2 * 220 / 16000))]).bytes); }
const word = (text: string): WordScore => ({ text, referenceIndex: null, error: 'none', accuracy: 90, startMs: 10, durationMs: 100, phonemes: [] });
const fixtureAzure = (words = ['apple'], accuracy = 90, fluency = 80, overall = 85) => ({ NBest: [{ Display: words.join(' '), PronunciationAssessment: { AccuracyScore: accuracy, FluencyScore: fluency, PronScore: overall }, Words: words.map((w, i) => ({ Word: w, Offset: i * 1000000, Duration: 1000000, PronunciationAssessment: { AccuracyScore: accuracy, ErrorType: 'None' }, Phonemes: [{ Phoneme: 'æ', Offset: i * 1000000, Duration: 500000, PronunciationAssessment: { AccuracyScore: 92 } }] })) }] });
const providerInput: ProviderInput = { lesson: input, wav: wav(), durationSeconds: 1 };
let calls = 0, fail = false;
const fixtureProvider: PronunciationProvider = { id: 'azure', configured: true, maxSeconds: 300, async assess(i) { calls++; if (fail) throw new SpeakingError(504, 'TIMEOUT', 'Gián đoạn fixture'); return normalizeAzure(i, [fixtureAzure()], 15); } };
const providers = { azure: fixtureProvider, speechsuper: { ...fixtureProvider, id: 'speechsuper' as const, maxSeconds: 180 } };
const service = createSpeakingService({ secret: 'fixture-secret', audioDir: path.join(root, 'private-audio'), providers });

test('lesson validation rejects invalid kinds, URL traversal, forged boolean/settings and excess word counts', () => {
  assert.deepEqual(normalizeLesson(input), input);
  assert.equal(normalizeLesson({ ...input, sampleAudioUrl: '/audio/fixture.mp3?v=123456' }).sampleAudioUrl, '/audio/fixture.mp3');
  for (const data of [null, { ...input, kind: '__proto__' }, { ...input, locale: 'vi-VN' }, { ...input, provider: 'unknown' }, { ...input, referenceText: 'two words' }, { ...input, sampleAudioUrl: '/audio/../secrets.wav' }, { ...input, maxSeconds: 9 }, { ...input, feedbackEnabled: 'true' }, { ...input, kind: 'passage', referenceText: 'word '.repeat(401) }]) assert.throws(() => normalizeLesson(data));
});
test('reading TTS preserves full text while the existing vocabulary callback and speed contract remain separate', async () => {
  const passage = 'First line.\n' + 'Read the complete passage (including this note). '.repeat(10);
  const full = normalizeReadingTtsInput(passage); assert.ok(full.text.length > 120); assert.ok(full.text.endsWith('(including this note).')); assert.equal(full.warnings.length, 0); assert.throws(() => normalizeReadingTtsInput('x'.repeat(6001)));
  const calls: string[] = []; const tts = createTtsService({ normalizeSettings: v => v, sanitizeInput: v => ({ text: v, warnings: [] }), createAudioHash: () => 'hash', concurrency: 1, runWithConcurrency: async () => [], voiceProvider: { listVoices: async () => ({ status: 200, data: [] }) },
    generateCachedAudio: async text => { calls.push('vocab'); return { audioUrl: '/audio/vocab.mp3', ttsText: text }; }, generateReadingAudio: async (text, settings, force) => { calls.push('reading'); assert.equal(settings.speed, 1); assert.equal(force, false); return { audioUrl: '/audio/reading.mp3?v=123', ttsText: normalizeReadingTtsInput(text).text }; } });
  await tts.preview({ text: 'apple' }); const result = await tts.previewReading({ text: passage, settings: { lang: 'en-GB', speed: 1 } }); assert.deepEqual(calls, ['vocab', 'reading']); assert.equal(result.ttsText, full.text);
});
test('client WAV and server gate agree; malformed, silence, clipping and duration reject before paid calls', () => {
  assert.equal(inspectWav(wav()).durationSeconds, 1); assert.ok(inspectWav(wav()).rms > .1);
  assert.throws(() => inspectWav(wav(1, 0)), /trống|nhỏ/); assert.throws(() => inspectWav(wav(), .5), /giây/);
  assert.throws(() => inspectWav(Buffer.alloc(44))); const bad = wav(); bad.writeUInt16LE(2, 22); assert.throws(() => inspectWav(bad));
  const clipping = Buffer.from(encodeWav([new Float32Array(16000).fill(1)]).bytes); assert.throws(() => inspectWav(clipping), /vỡ/);
  const extra = Buffer.concat([wav(), Buffer.from([0])]); assert.throws(() => inspectWav(extra));
});
test('stream resampling at 44.1/48 kHz preserves duration and chunk continuity with alias filtering', () => {
  for (const rate of [16000, 44100, 48000]) {
    const source = Float32Array.from({ length: rate }, (_, i) => .2 * Math.sin(2 * Math.PI * 440 * i / rate)), whole = new PcmResampler(rate), split = new PcmResampler(rate);
    const all = [...whole.push(source), ...whole.push(new Float32Array(), true)], chunks: number[] = [];
    for (let i = 0; i < source.length; i += 2048) chunks.push(...split.push(source.subarray(i, i + 2048))); chunks.push(...split.push(new Float32Array(), true));
    assert.equal(chunks.length, 16000); assert.equal(all.length, chunks.length); assert.ok(chunks.every((v, i) => Math.abs(v - all[i]) < 1e-6));
  }
  const r = new PcmResampler(48000), tone = Float32Array.from({ length: 48000 }, (_, i) => .2 * Math.sin(2 * Math.PI * 12000 * i / 48000)), filtered = [...r.push(tone), ...r.push(new Float32Array(), true)];
  assert.ok(Math.sqrt(filtered.slice(100, -100).reduce((n, v) => n + v * v, 0) / (filtered.length - 200)) < .01);
});
test('a short audible reading is accepted regardless of surrounding silence or microphone gain', () => {
  for (const seconds of [1, 8, 30, 180, 300]) {
    const samples = new Float32Array(seconds * 16000);
    for (let i = 0; i < 4000; i++) samples[4000 + i] = .012 * Math.sin(i * 2 * Math.PI * 220 / 16000);
    const encoded = encodeWav([samples]), bytes = Buffer.from(encoded.bytes), inspected = inspectWav(bytes, seconds);
    assert.equal(inspected.durationSeconds, seconds);
    assert.deepEqual(inspected.pcm, bytes.subarray(44), 'Quality checks preserve the captured PCM and pauses');
  }
  assert.equal(inspectWav(wav(1, .006)).durationSeconds, 1, 'Quiet but audible input does not require peaks above .01');
});
test('a click, DC offset and truly inaudible input are rejected before provider calls', () => {
  const click = new Float32Array(16000); click[8000] = .9;
  for (const samples of [click, new Float32Array(16000).fill(.1), Float32Array.from({ length: 16000 }, (_, i) => .0001 * Math.sin(i * .1))]) {
    assert.throws(() => inspectWav(Buffer.from(encodeWav([samples]).bytes)), (error: SpeakingError) => error.code === 'AUDIO_TOO_QUIET');
  }
});
test('alignment handles repetitions, omissions and extra words across a continuous passage', () => {
  const rows = alignWords('I like tea and I like tea', ['I', 'like', 'tea', 'I', 'like', 'like', 'tea'].map(word));
  assert.equal(rows.filter(w => w.error === 'omission').length, 1); assert.equal(rows.find(w => w.error === 'omission')?.text, 'and');
  assert.equal(rows.filter(w => w.error === 'insertion').length, 1); assert.equal(rows.filter(w => w.referenceIndex !== null).length, 7);
  assert.equal(alignWords("I'm happy", [word('I’m'), word('happy')]).filter(w => w.error === 'none').length, 2);
});
test('Azure word ignores fluency; continuous score is final, complete and versioned, not an average of overall scores', () => {
  const w = normalizeAzure(providerInput, [fixtureAzure(['apple'], 90, 10, 20)], 1); assert.equal(w.score, 90); assert.equal(w.fluency, null); assert.equal(w.prosody, null); assert.equal(w.words[0].phonemes[0].durationMs, 50);
  const lesson = { ...input, kind: 'passage' as const, referenceText: 'I like tea and I like tea', maxSeconds: 180 };
  const result = normalizeAzure({ ...providerInput, lesson, durationSeconds: 45 }, [fixtureAzure(['I', 'like', 'tea'], 90, 80, 5), fixtureAzure(['I', 'like', 'tea'], 90, 80, 99)], 100);
  assert.equal(result.providerOverall, null); assert.equal(result.completeness, 85.7); assert.equal(result.score, 87.1); assert.equal(result.words.length, 7); assert.equal(result.warnings.length, 1);
  assert.throws(() => normalizeAzure(providerInput, [], 1)); assert.throws(() => normalizeAzure(providerInput, [{ NBest: [{ Words: [{ Word: 'apple' }] }] }], 1));
  const sentence = normalizeAzure({ ...providerInput, lesson: { ...input, kind: 'sentence', referenceText: 'I like tea' } }, [fixtureAzure(['I', 'tea'], 90, 80, 100)], 1);
  assert.equal(sentence.providerOverall, 100); assert.equal(sentence.completeness, 66.7); assert.equal(sentence.score, 83.3);
});
test('Azure prosody opt-in is serialized by the installed SDK and restricted to en-US', async () => {
  const sdk = await import('microsoft-cognitiveservices-speech-sdk');
  for (const locale of ['en-US', 'en-GB'] as const) for (const flag of [undefined, 'false', 'true']) {
    const config = new sdk.PronunciationAssessmentConfig('Read this sentence.', sdk.PronunciationAssessmentGradingSystem.HundredMark, sdk.PronunciationAssessmentGranularity.Phoneme, false);
    const enabled = configureAzureAssessment(config, { locale }, { SPEAKING_AZURE_PROSODY: flag });
    const json = JSON.parse(config.toJSON()); assert.equal(enabled, flag === 'true' && locale === 'en-US');
    assert.equal(json.enableProsodyAssessment, enabled); assert.equal(json.phonemeAlphabet, 'IPA'); assert.equal(json.referenceText, 'Read this sentence.');
  }
});
test('Azure keeps measured prosody, reports missing reasons and never manufactures rhythm or changes reading-v1', () => {
  const input = { ...providerInput, lesson: { ...providerInput.lesson, kind: 'sentence' as const, referenceText: 'I like tea' } };
  const raw = fixtureAzure(['I', 'like', 'tea']);
  const withProsody = { ...raw, NBest: [{ ...raw.NBest[0], PronunciationAssessment: { ...raw.NBest[0].PronunciationAssessment, ProsodyScore: 72.5 } }] };
  const result = normalizeAzure(input, [withProsody], 10, { prosodyEnabled: true });
  assert.equal(result.prosody, 72.5); assert.equal(result.prosodyStatus, 'available'); assert.equal(result.rhythm, null);
  assert.equal(result.score, normalizeAzure(input, [raw], 10).score); assert.equal(result.rubricVersion, 'reading-v1');
  assert.equal(normalizeAzure(input, [raw], 10, { prosodyEnabled: false }).prosodyStatus, 'disabled');
  assert.equal(normalizeAzure(input, [raw], 10, { prosodyEnabled: true }).prosodyStatus, 'not-returned');
  const gb = normalizeAzure({ ...input, lesson: { ...input.lesson, locale: 'en-GB' } }, [withProsody], 10, { prosodyEnabled: true });
  assert.equal(gb.prosody, null); assert.equal(gb.prosodyStatus, 'unsupported-locale');
  const bad = { ...raw, NBest: [{ ...raw.NBest[0], PronunciationAssessment: { ...raw.NBest[0].PronunciationAssessment, ProsodyScore: 101 } }] };
  assert.equal(normalizeAzure(input, [bad], 10, { prosodyEnabled: true }).prosodyStatus, 'not-returned');
  const first = { ...withProsody, NBest: [{ ...withProsody.NBest[0], Words: withProsody.NBest[0].Words.map(w => ({ ...w, Duration: 2000000 })) }] };
  const second = { ...withProsody, NBest: [{ ...withProsody.NBest[0], PronunciationAssessment: { ...withProsody.NBest[0].PronunciationAssessment, ProsodyScore: 20 } }] };
  assert.equal(normalizeAzure(input, [first, second], 10, { prosodyEnabled: true }).prosody, 55);
});
test('review displays the provider metric meaning, zero scores and old missing results without fake scores', () => {
  const result = normalizeAzure(providerInput, [fixtureAzure()], 1);
  const disabled = readingMetrics({ ...result, prosodyStatus: 'disabled' }, 'en-US');
  assert.equal(disabled.length, 4); assert.ok(!disabled.some(row => row.id === 'rhythm')); assert.match(disabled.find(row => row.id === 'prosody')!.emptyText, /chưa được bật/);
  const legacy = { ...result }; delete legacy.prosodyStatus;
  assert.match(readingMetrics(legacy, 'en-US').find(row => row.id === 'prosody')!.emptyText, /Lượt chấm cũ/);
  assert.match(readingMetrics(result, 'en-GB').find(row => row.id === 'prosody')!.emptyText, /en-US/);
  assert.equal(readingMetrics({ ...result, prosody: 0 }, 'en-US').find(row => row.id === 'prosody')!.value, 0);
  const superRows = readingMetrics({ ...result, provider: 'speechsuper', prosody: null, rhythm: 82 }, 'en-US');
  assert.ok(!superRows.some(row => row.id === 'prosody')); assert.equal(superRows.find(row => row.id === 'rhythm')!.value, 82);
  assert.equal(readingMetrics({ ...result, rhythm: 81 }, 'en-US').find(row => row.id === 'rhythm')!.value, 81);
});
test('SpeechSuper uses readType 3/4, 10 ms units and separates rhythm from prosody', () => {
  const lesson = { ...input, kind: 'sentence' as const, referenceText: 'I like tea', maxSeconds: 30 };
  const result = normalizeSpeechSuper({ ...providerInput, lesson }, { result: { overall: 80, pronunciation: 85, fluency: 75, integrity: 66, rhythm: 82, words: [{ word: 'I', readType: 0, scores: { pronunciation: 90 }, span: { start: 10, end: 30 }, phonemes: [{ phoneme: 'aɪ', pronunciation: 90, span: { start: 10, end: 30 } }] }, { word: 'like', readType: 3, scores: { pronunciation: 0 } }, { word: 'tea', readType: 0, scores: { pronunciation: 80 } }, { word: 'tea', readType: 4, scores: { pronunciation: 80 } }] } }, 5);
  assert.equal(result.words.find(w => w.text === 'like')?.error, 'omission'); assert.equal(result.words.at(-1)?.error, 'insertion'); assert.equal(result.words[0].startMs, 100); assert.equal(result.words[0].durationMs, 200); assert.equal(result.prosody, null); assert.equal(result.rhythm, 82);
  assert.throws(() => normalizeSpeechSuper(providerInput, { result: { pronunciation: '85', overall: 90 } }, 1));
  const passage = normalizeSpeechSuper({ ...providerInput, lesson: { ...input, kind: 'passage' } }, { result: { overall: 85, pronunciation: 90, sentences: [{ details: [{ word: 'apple', overall: 90, start: 10, end: 30 }] }] } }, 1); assert.equal(passage.words[0].phonemes.length, 0); assert.match(passage.warnings[0], /phoneme/);
});
test('providers require backend credentials and never silently fail over', async () => {
  const unconfigured = createProviders({}); assert.equal(unconfigured.azure.configured, false); assert.equal(unconfigured.speechsuper.configured, false);
  await assert.rejects(unconfigured.azure.assess(providerInput), (e: any) => e.code === 'PROVIDER_NOT_CONFIGURED'); await assert.rejects(unconfigured.speechsuper.assess(providerInput));
});
test('AI feedback is independent; metrics mode cannot produce a holistic score and malformed output fails', async () => {
  const assessment = normalizeAzure(providerInput, [fixtureAzure()], 1), before = JSON.stringify(assessment);
  const client = { models: { async generateContent() { return { text: JSON.stringify({ summary: 'Đọc rõ.', strengths: ['Âm đầu'], improvements: ['Luyện âm cuối'], practice: ['apple'], holisticScore: 100 }) }; } } };
  const generate = createSpeakingFeedback(() => client as any, 'fixture', 'metrics'), result = await generate({ lesson: input, assessment }, wav()); assert.equal(result.holisticScore, null); assert.equal(result.evidenceMode, 'metrics'); assert.equal(JSON.stringify(assessment), before);
  const bad = createSpeakingFeedback(() => ({ models: { generateContent: async () => ({ text: '{}' }) } }) as any, 'fixture', 'audio'); await assert.rejects(bad({ lesson: input, assessment }, wav()));
});
test('additive schema is idempotent on SQL.js and leaves existing table content intact', () => {
  const script = `import init from 'sql.js'; import {migrateSpeakingSchema} from './src/server/speaking/schema.ts'; const SQL=await init(); const d=new SQL.Database(); d.run("CREATE TABLE migrations(id TEXT PRIMARY KEY,applied_at TEXT); CREATE TABLE legacy(id TEXT); INSERT INTO legacy VALUES ('keep')"); const gateway={run:(s,p=[])=>{d.run(s,p);return{changes:d.getRowsModified()}},all:(s,p=[])=>{const st=d.prepare(s);st.bind(p);const out=[];while(st.step())out.push(st.getAsObject());st.free();return out},one:(s,p=[])=>gateway.all(s,p)[0]};migrateSpeakingSchema(gateway);migrateSpeakingSchema(gateway);if(gateway.one('SELECT id FROM legacy').id!=='keep'||gateway.all('SELECT * FROM migrations').length!==2||!gateway.all('PRAGMA table_info(speaking_attempts)').some(c=>c.name==='session_id')||!gateway.one("SELECT name FROM sqlite_master WHERE name='speaking_sessions'"))throw Error('migration');console.log('SQLJS_PASS');`;
  const child = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script], { cwd: process.cwd(), encoding: 'utf8' }); assert.equal(child.status, 0, child.stderr); assert.match(child.stdout, /SQLJS_PASS/);
});
test('ownership, immutable versions, signed upload, idempotent grading and B History work together', async () => {
  await initializeSQLiteStorage(); const draft = await saveLesson(teacher, input); await assert.rejects(saveLesson(otherTeacher, input, draft.id, draft.revision), (e: any) => e.status === 404);
  const lesson = await setLessonStatus(teacher, draft.id, 1, 'published'); assert.equal(lesson.versionId, `${draft.id}:1`);
  const a = await service.prepare(actor, 'Học sinh A', lesson.id, 'fixture-run-001'); const same = await service.prepare(actor, 'forged', lesson.id, 'fixture-run-001'); assert.equal(same.id, a.id);
  const edited = await saveLesson(teacher, { ...input, referenceText: 'orange' }, lesson.id, 1); assert.equal(edited.status, 'draft'); assert.equal((await service.resume(actor, a.id)).lesson.referenceText, 'apple'); await assert.rejects(saveLesson(teacher, input, lesson.id, 1), (e: any) => e.status === 409);
  await assert.rejects(service.upload(stranger, a.id, a.ticket!, wav()), (e: any) => e.status === 404); await assert.rejects(service.upload(actor, a.id, 'wrong', wav()), (e: any) => e.code === 'INVALID_TICKET'); await assert.rejects(service.upload(actor, a.id, a.ticket!, wav(1, 0)));
  const queued = await service.upload(actor, a.id, a.ticket!, wav()); assert.equal(queued.status, 'queued'); await service.upload(actor, a.id, a.ticket!, wav()); assert.equal(calls, 0);
  await assert.rejects(service.upload(actor, a.id, a.ticket!, wav(1, .4)), (e: any) => e.code === 'AUDIO_CONFLICT'); assert.equal(await service.runNext(), true); assert.equal(await service.runNext(), false); assert.equal(calls, 1);
  const completed = await service.resume(actor, a.id); assert.equal(completed.status, 'completed'); assert.equal(completed.assessment?.score, 90); assert.ok(!('ownerKey' in completed)); assert.ok(!('audioHash' in completed)); await service.upload(actor, a.id, a.ticket!, wav()); assert.equal(calls, 1);
  await assert.rejects(service.audio(stranger, a.id), (e: any) => e.status === 404); await assert.rejects(service.review(actor, a.id, otherTeacher), (e: any) => e.status === 404); assert.deepEqual(await service.audio(actor, a.id), wav());
  const history = await getLearningHistory(actor, parseLearningHistoryFilters({ sourceType: 'speaking' })); assert.equal(history.items.length, 1); assert.equal(history.items[0].sourceType, 'speaking'); assert.equal(history.items[0].lessonTitle, input.title);
  const detail = await getLearningHistoryDetail(actor, a.id); assert.ok(detail.detail?.extraDetails?.speakingReview); assert.ok(!JSON.stringify(detail).includes('audioHash')); assert.ok(!JSON.stringify(detail).includes('fixture-secret'));
  await assert.rejects(getLearningHistoryDetail(stranger, a.id)); const results = await listResults(teacher); assert.equal(results.total, 1); assert.equal((await listResults(otherTeacher)).total, 0); assert.equal((await listResults(teacher, 9)).total, 0);
  assert.equal((await listLessons()).length, 0); await setLessonStatus(teacher, lesson.id, 2, 'published'); assert.equal((await getLesson(lesson.id))?.referenceText, 'orange');
});
test('failed provider has null score, explicit bounded retry and stale lease recovery does not bill twice automatically', async () => {
  const draft = await saveLesson(teacher, input), lesson = await setLessonStatus(teacher, draft.id, 1, 'published'), a = await service.prepare(actor, 'A', lesson.id, 'fixture-run-failure'); fail = true;
  await service.upload(actor, a.id, a.ticket!, wav()); await service.runNext(); let result = await service.resume(actor, a.id); assert.equal(result.status, 'failed'); assert.equal(result.assessment, null); assert.equal((await sqliteQueryOne<{ score: number | null }>('SELECT score FROM speaking_attempts WHERE id=?', [a.id]))?.score, null);
  fail = false; await service.retry(actor, a.id, a.ticket!); await service.runNext(); result = await service.resume(actor, a.id); assert.equal(result.status, 'completed');
  const b = await service.prepare(actor, 'A', lesson.id, 'fixture-run-crashed'); await service.upload(actor, b.id, b.ticket!, wav()); await sqliteImmediateTransaction(db => db.run("UPDATE speaking_jobs SET status='running',lease_until=0,lease_token='old' WHERE id=?", [b.id])); const before = calls; await service.runNext(); assert.equal(calls, before); assert.equal((await service.resume(actor, b.id)).status, 'failed');
  await sqliteImmediateTransaction(db => { const row = db.one<{ data_json: string }>('SELECT data_json FROM speaking_attempts WHERE id=?', [a.id])!; const d = JSON.parse(row.data_json); d.audioExpiresAt = '2000-01-01T00:00:00.000Z'; db.run('UPDATE speaking_attempts SET data_json=? WHERE id=?', [JSON.stringify(d), a.id]); }); await assert.rejects(service.audio(actor, a.id), (e: any) => e.status === 410);
});
test('daily quota, provider absence and AI failure preserve attempts without fake grades', async () => {
  const draft = await saveLesson(teacher, { ...input, feedbackEnabled: true }), lesson = await setLessonStatus(teacher, draft.id, 1, 'published');
  const limited = createSpeakingService({ secret: 'x', providers, audioDir: path.join(root, 'private-audio'), dailyLimit: 1 }), newActor = { ...actor, ownerKey: 'user:limited', id: 'limited' };
  const a = await limited.prepare(newActor, 'Limited', lesson.id, 'limited-run-001'); await assert.rejects(limited.prepare(newActor, 'Limited', lesson.id, 'limited-run-002'), (e: any) => e.status === 429);
  const disabled = createSpeakingService({ secret: 'x', providers: createProviders({}), audioDir: path.join(root, 'private-audio') }); await assert.rejects(disabled.upload(newActor, a.id, a.ticket!, wav()), (e: any) => e.code === 'PROVIDER_NOT_CONFIGURED'); assert.equal((await limited.resume(newActor, a.id)).status, 'prepared');
  const withFeedback = createSpeakingService({ secret: 'x', providers, audioDir: path.join(root, 'private-audio'), feedback: async () => { throw new Error('fixture AI failure'); } }); await withFeedback.upload(newActor, a.id, a.ticket!, wav()); await withFeedback.runNext(); assert.equal((await withFeedback.resume(newActor, a.id)).feedbackState, 'pending'); await withFeedback.runNext(); const done = await withFeedback.resume(newActor, a.id); assert.equal(done.feedbackState, 'failed'); assert.equal(done.status, 'completed'); assert.equal(done.assessment?.score, 90);
});
test('mismatched provider response is rejected and cannot persist a score', async () => {
  const draft = await saveLesson(teacher, input), lesson = await setLessonStatus(teacher, draft.id, 1, 'published');
  const wrong: PronunciationProvider = { ...fixtureProvider, async assess(i) { return { ...normalizeAzure(i, [fixtureAzure()], 1), provider: 'speechsuper' }; } };
  const guarded = createSpeakingService({ secret: 'wrong-provider', providers: { ...providers, azure: wrong }, audioDir: path.join(root, 'private-audio') });
  const a = await guarded.prepare(actor, 'A', lesson.id, 'wrong-provider-run'); await guarded.upload(actor, a.id, a.ticket!, wav()); await guarded.runNext(); const done = await guarded.resume(actor, a.id); assert.equal(done.status, 'failed'); assert.equal(done.assessment, null);
});
test('media maintenance dry-run protects Speaking audio used only by archived versions and History', async () => {
  const sampleName = 'a'.repeat(64) + '.mp3', draft = await saveLesson(teacher, { ...input, sampleAudioUrl: '/audio/' + sampleName }), lesson = await setLessonStatus(teacher, draft.id, 1, 'published');
  await saveLesson(teacher, input, lesson.id, 1); await setLessonStatus(teacher, lesson.id, 2, 'archived');
  const mediaDir = path.join(root, 'tts'); fs.mkdirSync(mediaDir); fs.writeFileSync(path.join(mediaDir, sampleName), 'fixture bytes'); const old = new Date(Date.now() - 10 * 86400000); fs.utimesSync(path.join(mediaDir, sampleName), old, old);
  const child = spawnSync(process.execPath, ['scripts/media-orphan-maintenance.mjs', '--db', process.env.SQLITE_DB_PATH!, '--tts-dir', mediaDir], { encoding: 'utf8', windowsHide: true, env: { ...process.env, TTS_AUDIO_DIR: '', LISTENING_MEDIA_DIR: '' } });
  assert.equal(child.status, 0, child.stderr); const report = JSON.parse(child.stdout).report; assert.equal(report.tts.referenced, 1); assert.equal(report.tts.candidates.length, 0); assert.ok(fs.existsSync(path.join(mediaDir, sampleName)));
});
test('measured Azure prosody and availability survive SQLite review and the existing History contract', async () => {
  const student: LearningHistoryActor = { ...actor, id: 'prosody-student', ownerKey: 'user:prosody-student' };
  const draft = await saveLesson(teacher, { ...input, kind: 'sentence', referenceText: 'I like tea', maxSeconds: 30 });
  const lesson = await setLessonStatus(teacher, draft.id, 1, 'published');
  const azure: PronunciationProvider = { ...fixtureProvider, async assess(i) {
    const raw = fixtureAzure(['I', 'like', 'tea']);
    const payload = { ...raw, NBest: [{ ...raw.NBest[0], PronunciationAssessment: { ...raw.NBest[0].PronunciationAssessment, ProsodyScore: 91.2 } }] };
    return normalizeAzure(i, [payload], 10, { prosodyEnabled: true });
  } };
  const service = createSpeakingService({ secret: 'prosody-fixture', providers: { ...providers, azure }, audioDir: path.join(root, 'prosody-audio') });
  const attempt = await service.prepare(student, 'Prosody fixture', lesson.id, 'prosody-history-fixture');
  await service.upload(student, attempt.id, attempt.ticket!, wav()); await service.runNext();
  const reviewed = await service.resume(student, attempt.id);
  assert.equal(reviewed.assessment?.prosody, 91.2); assert.equal(reviewed.assessment?.prosodyStatus, 'available'); assert.equal(reviewed.assessment?.rhythm, null);
  const stored = await sqliteQueryOne<{ data_json: string }>('SELECT data_json FROM speaking_attempt_details WHERE attempt_id=?', [attempt.id]);
  assert.equal(JSON.parse(stored!.data_json).assessment.prosody, 91.2);
  const history = await getLearningHistory(student, parseLearningHistoryFilters({ sourceType: 'speaking' })); assert.ok(history.items.some(row => row.attemptId === attempt.id));
  const detail = await getLearningHistoryDetail(student, attempt.id); assert.match(JSON.stringify(detail), /"prosody":91.2/); assert.match(JSON.stringify(detail), /"prosodyStatus":"available"/);
  await assert.rejects(service.resume(stranger, attempt.id), (e: SpeakingError) => e.status === 404);
});
test('HTTP end-to-end rejects forged identity, cross-owner recordings and invalid body; capabilities expose no secrets', async () => {
  const app = express(); app.use(express.json());
  let truncateSample = false;
  const optional: express.RequestHandler = (req, _res, next) => { const value = req.headers.authorization; if (value === 'Bearer student') req.user = actor.userProfile as any; if (value === 'Bearer teacher') req.user = { id: teacher.id, role: 'teacher', name: 'Teacher' } as any; if (value === 'Bearer stranger') req.user = stranger.userProfile ? { ...stranger.userProfile, id: stranger.id } as any : undefined; next(); };
  app.use('/api/speaking', createSpeakingRouter({ enabled: true, ticketSecret: 'fixture-secret', audioDir: path.join(root, 'private-audio'), providers, env: {}, startWorker: false, feedbackMode: 'metrics', db: new SQLiteFirestore(), authenticateOptionalUser: optional, authenticateUser: (_req, res) => { res.sendStatus(401); }, requireStaff: (req, res, next) => req.user?.role === 'teacher' ? next() : res.sendStatus(403), rateLimit: (_req, _res, next) => next(), preview: async (payload: any) => ({ audioUrl: '/audio/fixture.mp3?v=123456', ttsText: truncateSample ? payload.text.slice(0, 30) : payload.text }) }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening'); const address = server.address() as { port: number }, origin = `http://127.0.0.1:${address.port}/api/speaking`;
  try {
    const caps = await (await fetch(`${origin}/capabilities`)).json(); assert.equal(caps.providers[0].configured, true); assert.ok(!JSON.stringify(caps).includes('KEY')); assert.deepEqual(caps.azureProsody, { enabled: false, locale: 'en-US', includesRhythm: true });
    const body = (data: any, bearer = 'teacher') => ({ method: 'POST', headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    assert.equal((await fetch(`${origin}/admin/lessons`, body(input, 'student'))).status, 403);
    const longSample = { ...input, kind: 'passage', maxSeconds: 180, referenceText: 'I like reading books. '.repeat(20) }, sample = await fetch(`${origin}/admin/sample`, body(longSample)); assert.equal(sample.status, 200); assert.equal((await sample.json()).audioUrl, '/audio/fixture.mp3'); truncateSample = true; const shortened = await fetch(`${origin}/admin/sample`, body(longSample)); assert.equal(shortened.status, 422); assert.equal((await shortened.json()).code, 'SAMPLE_TRUNCATED'); truncateSample = false;
    const created = await (await fetch(`${origin}/admin/lessons`, body(input))).json(); await fetch(`${origin}/admin/lessons/${created.id}/publish`, body({ revision: 1 }));
    const prepared: AttemptView = await (await fetch(`${origin}/attempts/prepare`, body({ lessonId: created.id, clientRunId: 'http-run-001', userId: 'forged', score: 100, studentName: 'forged', classId: 'forged' }, 'student'))).json(); assert.ok(prepared.ticket);
    const stored = await sqliteQueryOne<{ owner_key: string; student_name: string; class_id: string | null }>('SELECT owner_key,student_name,class_id FROM speaking_attempts WHERE id=?', [prepared.id]); assert.equal(stored?.owner_key, actor.ownerKey); assert.equal(stored?.student_name, 'Học sinh A'); assert.equal(stored?.class_id, null);
    assert.equal((await fetch(`${origin}/attempts/${prepared.id}/audio`, { method: 'POST', headers: { Authorization: 'Bearer student', 'Content-Type': 'application/json', 'X-Attempt-Ticket': prepared.ticket! }, body: '{}' })).status, 415);
    const response = await fetch(`${origin}/attempts/${prepared.id}/audio`, { method: 'POST', headers: { Authorization: 'Bearer student', 'Content-Type': 'audio/wav', 'X-Attempt-Ticket': prepared.ticket! }, body: wav() }); assert.equal(response.status, 200); await service.runNext();
    assert.equal((await fetch(`${origin}/attempts/${prepared.id}/recording`, { headers: { Authorization: 'Bearer stranger' } })).status, 404); const audio = await fetch(`${origin}/attempts/${prepared.id}/recording`, { headers: { Authorization: 'Bearer student' } }); assert.equal(audio.status, 200); assert.equal(audio.headers.get('cache-control'), 'private, no-store');
    const reviewed = await (await fetch(`${origin}/admin/results/${prepared.id}`, { headers: { Authorization: 'Bearer teacher' } })).json(); assert.equal(reviewed.assessment.score, 90); assert.ok(!('ticket' in reviewed));
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
test('benchmark dry-run validates the same WAV and imports three external candidates without API calls', () => {
  const manifest = path.join(root, 'benchmark.json'), output = path.join(root, 'benchmark-report.json'), external = path.join(root, 'external.json'); fs.writeFileSync(path.join(root, 'benchmark.wav'), wav()); fs.writeFileSync(manifest, JSON.stringify({ cases: [{ id: 'one', file: 'benchmark.wav', kind: 'word', referenceText: 'apple', teacherScore: 85 }] }));
  fs.writeFileSync(external, JSON.stringify(['chivox', 'speechace', 'elsa'].map(provider => ({ provider, id: 'one', score: 80, elapsedMs: 100 }))));
  const child = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/speaking-benchmark.ts', `--manifest=${manifest}`, `--output=${output}`, `--external=${external}`], { encoding: 'utf8', windowsHide: true }); assert.equal(child.status, 0, child.stderr); const report = JSON.parse(fs.readFileSync(output, 'utf8')); assert.equal(report.dryRun, true); assert.equal(report.rows.length, 5); assert.ok(report.rows.filter((r: any) => ['azure', 'speechsuper'].includes(r.provider)).every((r: any) => r.score === null)); assert.equal(report.summaries.find((r: any) => r.provider === 'chivox').meanAbsoluteError, 5);
});
test('catalog pagination and escaped search cover the whole authorized bank', async () => {
  const catalogOwner = { id: 'catalog-owner', role: 'teacher' as const };
  for (let i = 0; i < 31; i++) await saveLesson(catalogOwner, { ...input, title: `Catalog ${i} %` });
  const first = await lessonPage(catalogOwner), second = await lessonPage(catalogOwner, undefined, undefined, '', 2); assert.equal(first.total, 31); assert.equal(first.items.length, 30); assert.equal(second.items.length, 1); assert.equal(new Set([...first.items, ...second.items].map(l => l.id)).size, 31);
  assert.equal((await lessonPage(catalogOwner, undefined, undefined, '%')).total, 31); assert.equal((await lessonPage(catalogOwner, undefined, undefined, 'Catalog 30')).total, 1); assert.equal((await lessonPage(otherTeacher, undefined, undefined, 'Catalog')).total, 0);
});

test('durable overflow survives service restart, grades once and exposes pending/failure only to its owner in History', async () => {
  const student = { ...actor, id: 'queue-student', ownerKey: 'user:queue-student' };
  const draft = await saveLesson(teacher, input), lesson = await setLessonStatus(teacher, draft.id, 1, 'published');
  let assessments = 0, rejectProvider = false;
  const azure: PronunciationProvider = { ...fixtureProvider, async assess(i) { assessments++; if (rejectProvider) throw new SpeakingError(504, 'TIMEOUT', 'Lỗi chấm thử nghiệm'); return normalizeAzure(i, [fixtureAzure()], 1); } };
  const options = { secret: 'durable-queue', providers: { ...providers, azure }, audioDir: path.join(root, 'durable-queue'), queueCapacity: 1, pendingLimit: 3 };
  const queue = createSpeakingService(options), ids: AttemptView[] = [];
  for (let i = 0; i < 4; i++) ids.push(await queue.prepare(student, 'Queue student', lesson.id, `durable-queue-${i}`));
  const first = await queue.upload(student, ids[0].id, ids[0].ticket!, wav());
  assert.equal(first.queueState, 'queued');
  for (const a of ids.slice(1, 3)) {
    const waiting = await queue.upload(student, a.id, a.ticket!, wav()); assert.equal(waiting.status, 'queued'); assert.equal(waiting.queueState, 'waiting');
    assert.deepEqual(await queue.audio(student, a.id), wav());
    await queue.upload(student, a.id, a.ticket!, wav());
  }
  assert.equal(assessments, 0, 'Accepting/repeating an upload does not call a paid provider');
  assert.equal((await sqliteQueryOne<{ n: number }>("SELECT COUNT(*) n FROM speaking_jobs WHERE status IN ('queued','waiting')"))?.n, 3);
  await assert.rejects(queue.upload(student, ids[3].id, ids[3].ticket!, wav()), (e: SpeakingError) => e.code === 'QUEUE_LIMIT');
  assert.equal((await queue.resume(student, ids[3].id)).status, 'prepared');
  const pending = await getLearningHistory(student, parseLearningHistoryFilters({ sourceType: 'speaking' }));
  assert.equal(pending.items.length, 3); assert.ok(pending.items.every(row => row.status === 'in_progress')); assert.equal(pending.summary.averageScore, 0);
  const pendingDetail = await getLearningHistoryDetail(student, ids[1].id); assert.match(JSON.stringify(pendingDetail), /"queueState":"waiting"/);
  await assert.rejects(getLearningHistoryDetail(stranger, ids[1].id)); assert.ok(!JSON.stringify(pendingDetail).includes('audioHash'));
  const restarted = createSpeakingService(options);
  await restarted.runNext(); rejectProvider = true; await restarted.runNext(); rejectProvider = false; await restarted.runNext();
  assert.equal(assessments, 3); assert.equal(await restarted.runNext(), false);
  const history = await getLearningHistory(student, parseLearningHistoryFilters({ sourceType: 'speaking' }));
  assert.equal(history.items.filter(row => row.status === 'completed').length, 2);
  const failure = history.items.find(row => row.status === 'interrupted'); assert.ok(failure);
  const failureDetail = await getLearningHistoryDetail(student, failure.attemptId!); assert.match(JSON.stringify(failureDetail), /Lỗi chấm thử nghiệm/);
  assert.equal((await restarted.resume(student, failure.attemptId!)).assessment, null);
  assert.equal(history.summary.averageScore, 90, 'A pending/failed recording does not lower the completed average');
  await restarted.upload(student, ids[3].id, ids[3].ticket!, wav()); await restarted.runNext(); assert.equal(assessments, 4);
});

test('the third recording from one student waits durably instead of rejecting the learner', async () => {
  const student = { ...actor, id: 'owner-overflow', ownerKey: 'user:owner-overflow' };
  const draft = await saveLesson(teacher, input), lesson = await setLessonStatus(teacher, draft.id, 1, 'published');
  const queue = createSpeakingService({ secret: 'owner-overflow', providers, audioDir: path.join(root, 'owner-overflow') });
  for (let i = 0; i < 3; i++) { const a = await queue.prepare(student, 'Overflow', lesson.id, `owner-overflow-${i}`); const uploaded = await queue.upload(student, a.id, a.ticket!, wav()); assert.equal(uploaded.queueState, i < 2 ? 'queued' : 'waiting'); }
  while (await queue.runNext()) { /* Drain isolated fixture work. */ }
});

test('recordings are capped at 24h and expired queued jobs do not call providers or lose history', async () => {
  const draft = await saveLesson(teacher, input), lesson = await setLessonStatus(teacher, draft.id, 1, 'published');
  let called = 0;
  const guarded = createSpeakingService({ secret:'expiry', retentionDays:30, audioDir:path.join(root,'expiry-audio'), providers:{...providers,azure:{...fixtureProvider,async assess(i){called++;return fixtureProvider.assess(i);}}} });
  const student = {...actor,id:'expiry-student',ownerKey:'user:expiry-student'};
  const a = await guarded.prepare(student,'Expiry',lesson.id,'expiry-24h-test');
  await guarded.upload(student,a.id,a.ticket!,wav());
  const stored = await sqliteQueryOne<{data_json:string}>('SELECT data_json FROM speaking_attempts WHERE id=?',[a.id]);
  assert.ok(Date.parse(JSON.parse(stored!.data_json).audioExpiresAt) <= Date.now()+86400000);
  const file=path.join(root,'expiry-audio',a.id+'.wav'),old=new Date(Date.now()-25*3600000);
  fs.utimesSync(file,old,old);
  await assert.rejects(guarded.audio(student,a.id),(e:any)=>e.code==='AUDIO_EXPIRED');
  await guarded.runNext();assert.equal(called,0);assert.equal((await guarded.resume(student,a.id)).status,'failed');
  await assert.rejects(guarded.retry(student,a.id,a.ticket!),(e:any)=>e.code==='RETRY_UNAVAILABLE');
  assert.ok(await sqliteQueryOne('SELECT id FROM speaking_attempts WHERE id=?',[a.id]));
});
