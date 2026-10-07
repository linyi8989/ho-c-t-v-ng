import fs from 'node:fs/promises';
import path from 'node:path';
import { initializeSQLiteStorage, closeSQLiteStorage, sqliteImmediateTransaction, SQLiteFirestore } from '../src/lib/sqliteStorage';
import { saveLesson, setLessonStatus } from '../src/server/speaking/repository';
import { createSpeakingService } from '../src/server/speaking/service';
import { normalizeAzure, type PronunciationProvider } from '../src/server/speaking/providers';
import { encodeWav } from '../src/features/speaking/audio';
import type { LearningHistoryActor } from '../src/server/learning-history/learningHistoryTypes';
if (process.env.SPEAKING_QA_FIXTURE !== 'true' || !process.env.SQLITE_DB_PATH || process.env.NODE_ENV !== 'test') throw new Error('Fixture requires isolated test DB and explicit SPEAKING_QA_FIXTURE=true.');
const root = path.dirname(path.resolve(process.env.SQLITE_DB_PATH));
await fs.mkdir(root, { recursive: true });
if (await fs.stat(process.env.SQLITE_DB_PATH).then(() => true).catch(() => false)) throw new Error('Refusing to write fixtures into an existing database.');
await initializeSQLiteStorage();
try {
  const wav = Buffer.from(encodeWav([Float32Array.from({ length: 16000 }, (_, i) => .2 * Math.sin(i * 2 * Math.PI * 220 / 16000))]).bytes);
  await fs.mkdir(path.join(root, 'audio'), { recursive: true }); await fs.writeFile(path.join(root, 'audio', 'speaking-fixture.wav'), wav);
  const staff = { id: 'local-test-super-admin', role: 'super_admin' as const }, actor: LearningHistoryActor = { ...staff, kind: 'user', ownerKey: 'user:local-test-super-admin' };
  const provider: PronunciationProvider = { id: 'azure', configured: true, maxSeconds: 300, async assess(input) {
    const words = input.lesson.referenceText.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu) || [];
    return normalizeAzure(input, [{ NBest: [{ Display: words.join(' '), PronunciationAssessment: { AccuracyScore: 88, FluencyScore: 88, PronScore: 88 }, Words: words.map(Word => ({ Word, Offset: 0, Duration: 8000000, PronunciationAssessment: { AccuracyScore: 88 }, Phonemes: [{ Phoneme: 'æ', Offset: 0, Duration: 4000000, PronunciationAssessment: { AccuracyScore: 82 } }, { Phoneme: 'p', Offset: 4000000, Duration: 4000000, PronunciationAssessment: { AccuracyScore: 94 } }] })) }] }], 50);
  } };
  const service = createSpeakingService({ secret: 'speaking-qa-fixture-ticket', audioDir: path.join(root, 'speaking-recordings'), providers: { azure: provider, speechsuper: { ...provider, id: 'speechsuper', maxSeconds: 180 } } });
  const lessons = [];
  for (const kind of ['word', 'sentence', 'dialogue', 'passage'] as const) {
    const draft = await saveLesson(staff, { title: `QA Speaking ${kind}`, referenceText: kind === 'word' ? 'apple' : kind === 'dialogue' ? "I'm visiting my grandparents." : 'I like reading books. I read every day.', kind, partnerText: kind === 'dialogue' ? 'What are you doing this weekend?' : '', instructions: 'Đọc rõ nội dung của em.', grade: 3, locale: 'en-US', provider: 'azure', maxSeconds: kind === 'word' ? 8 : kind === 'passage' ? 180 : 30, sampleAudioUrl: '/audio/speaking-fixture.wav', samplePlaybackRate: 1, feedbackEnabled: false });
    const published = await setLessonStatus(staff, draft.id, 1, 'published'); lessons.push(published);
  }
  const a = await service.prepare(actor, 'QA Học sinh', lessons[0].id, 'browser-completed-fixture'); await service.upload(actor, a.id, a.ticket!, wav); await service.runNext();
  const sets = [];
  let expiredItem: { lessonId: string; sessionId: string; itemId: string; attemptId: string } | undefined;
  for (const [title, kind, content, complete] of [
    ['QA Speaking word set complete', 'word', ['apple', 'bus', 'train'], true],
    ['QA Speaking word set progress', 'word', ['apple', 'car', 'boat'], false],
    ['QA Speaking sentence set', 'sentence', ['I go by bus.', 'This is my car.'], false],
  ] as const) {
    const draft = await saveLesson(staff, { ...lessons[0], title, kind, maxSeconds: kind === 'word' ? 8 : 30, items: content.map(referenceText => ({ id: '', referenceText, sampleAudioUrl: '/audio/speaking-fixture.wav', samplePlaybackRate: 1 })) });
    const lesson = await setLessonStatus(staff, draft.id, 1, 'published');
    const session = await service.prepareSession(actor, 'QA Học sinh', lesson.id, 'browser-set-' + sets.length, {});
    for (const item of session.items.slice(0, complete ? session.totalItems : kind === 'word' ? 1 : 0)) {
      const child = await service.prepare(actor, 'QA Học sinh', lesson.id, 'browser-item-' + sets.length + '-' + item.item.id, {}, { sessionId: session.id, itemId: item.item.id });
      await service.upload(actor, child.id, child.ticket!, wav); await service.runNext();
    }
    if (title.includes('progress')) {
      const child = await service.prepare(actor, 'QA Học sinh', lesson.id, 'browser-expired-item', {}, { sessionId: session.id, itemId: session.items[1].item.id });
      await sqliteImmediateTransaction(db => {
        const row = db.one<{ data_json: string }>('SELECT data_json FROM speaking_attempts WHERE id=?', [child.id])!;
        const stored = JSON.parse(row.data_json); stored.createdAt = new Date(Date.now() - 26 * 3600000).toISOString();
        db.run('UPDATE speaking_attempts SET created_at=?,data_json=? WHERE id=?', [stored.createdAt, JSON.stringify(stored), child.id]);
      });
      expiredItem = { lessonId: lesson.id, sessionId: session.id, itemId: session.items[1].item.id, attemptId: child.id };
    }
    const result = await service.session(actor, session.id);
    sets.push({ id: lesson.id, title, kind, sessionId: session.id, completedCount: result.completedCount, totalItems: result.totalItems, status: result.status });
  }
  const leaderboardNames = ['QA Nguyễn Thị Minh Anh', 'QA Trần Hoàng Nam', 'QA Lê Thị Bảo Ngọc', 'QA Nguyễn Quốc Bảo', 'QA Phạm Hải Đăng'];
  const fixtureStorage = new SQLiteFirestore(), completedAt = new Date().toISOString();
  for (const [index, displayName] of leaderboardNames.entries()) {
    const guestId = `qa-leaderboard-guest-${index}`;
    await fixtureStorage.collection('guest_profiles').doc(guestId).set({ guestId, displayName, status: 'active' });
    await fixtureStorage.collection('leaderboard_events').doc(`qa-leaderboard-${index}`).set({
      sourceType: 'vocabulary', sourceId: `qa-game-${index}`, ownerType: 'guest', ownerKey: `guest:${guestId}`, guestId,
      studentName: 'Old fixture name', vocabSetId: 'qa-leaderboard-set', gameId: 'quiz', completedAt,
      totalQuestions: 10, correctAnswers: 10 - index, incorrectAnswers: index, score: 100 - index * 10,
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
    });
  }
  await fixtureStorage.collection('settings').doc('leaderboard-read-model-v1').set({ value: { ready: true, version: 1 } });
  const manifest = { lessons: lessons.map(l => ({ id: l.id, kind: l.kind })), sets, attemptId: a.id, expiredItem, leaderboardNames };
  await fs.writeFile(path.join(root, 'fixture.json'), JSON.stringify(manifest)); console.log(JSON.stringify(manifest));
} finally { await closeSQLiteStorage(); }
