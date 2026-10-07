import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { SpeakingError, publicLesson, isSetLesson, lessonItems, type Assessment, type AttemptView, type Feedback, type Lesson, type ProviderId } from '../../shared/speaking/types';
import type { LearningHistoryActor } from '../learning-history/learningHistoryTypes';
import { decode, getLesson, owned, queryAll, queryOne, transaction, type Staff } from './repository';
import { prepareSession, readSession, sessionRow, updateSessionProgress, type SessionRow } from './sessions';
import { inspectWav } from './audio';
import type { PronunciationProvider } from './providers';
interface StoredAttempt extends Omit<AttemptView, 'audioAvailable' | 'ticket'> { ownerKey: string; audioHash?: string; audioExpiresAt?: string }
interface Options { secret: string; audioDir: string; providers: Record<ProviderId, PronunciationProvider>; dailyLimit?: number; retentionDays?: number; queueCapacity?: number; pendingLimit?: number; feedback?: (attempt: StoredAttempt, wav: Buffer) => Promise<Feedback> }
const notFound = () => new SpeakingError(404, 'NOT_FOUND', 'Không tìm thấy lượt luyện đọc.');
export function createSpeakingService(options: Options) {
  const dailyLimit = Math.max(1, Math.min(200, options.dailyLimit || 20)), retentionDays = Math.max(1, Math.min(365, options.retentionDays || 30));
  const queueCapacity = Math.max(1, options.queueCapacity ?? 100), pendingLimit = Math.max(queueCapacity, options.pendingLimit ?? 1000);
  const file = (id: string) => { if (!/^[0-9a-f-]{36}$/.test(id)) throw notFound(); return path.join(options.audioDir, `${id}.wav`); };
  const ticket = (a: StoredAttempt) => crypto.createHmac('sha256', options.secret).update(`${a.id}|${a.ownerKey}|${a.lesson.versionId}`).digest('base64url');
  const view = (raw: unknown, includeTicket = false): AttemptView => { const a = raw as StoredAttempt; const { ownerKey: _o, audioHash: _h, audioExpiresAt: _e, ...v } = a; return { ...v, recordingAllowed: a.status === 'prepared' && Number.isFinite(Date.parse(a.createdAt)) && Date.now() - Date.parse(a.createdAt) <= 86400000, audioAvailable: Boolean(a.audioHash && a.audioExpiresAt && a.audioExpiresAt > new Date().toISOString()), ...(includeTicket ? { ticket: ticket(a) } : {}) }; };
  async function load(id: string) { const row = await queryOne<{ data_json: string }>('SELECT data_json FROM speaking_attempts WHERE id=?', [id]); if (!row) throw notFound(); return decode<StoredAttempt>(row); }
  async function access(actor: LearningHistoryActor, id: string, signed?: string, staff?: Staff) {
    const a = await load(id);
    if (staff) owned(await getLesson(a.lesson.id), staff); else if (a.ownerKey !== actor.ownerKey) throw notFound();
    if (signed !== undefined) { const expected = Buffer.from(ticket(a)), given = Buffer.from(signed); if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) throw new SpeakingError(403, 'INVALID_TICKET', 'Lượt đọc chưa được xác minh.'); }
    return a;
  }
  const update = (db: Parameters<Parameters<typeof transaction>[0]>[0], a: StoredAttempt) => db.run('UPDATE speaking_attempts SET status=?,score=?,completed_at=?,duration_seconds=?,data_json=? WHERE id=?', [a.status, a.assessment?.score ?? null, a.completedAt, a.durationSeconds, JSON.stringify(a), a.id]);
  const admission = (db: Parameters<Parameters<typeof transaction>[0]>[0], ownerKey: string): 'waiting' | 'queued' => {
    const total = db.one<{ n: number }>("SELECT COUNT(*) n FROM speaking_jobs WHERE kind='assessment' AND status IN ('waiting','queued','running')")?.n || 0;
    if (total >= pendingLimit) throw new SpeakingError(429, 'QUEUE_LIMIT', 'Kho chờ bản thu đã đầy. Bản thu vẫn được giữ trên thiết bị; hãy gửi lại sau.');
    const active = db.one<{ n: number }>("SELECT COUNT(*) n FROM speaking_jobs WHERE status IN ('queued','running')")?.n || 0;
    const ownerActive = db.one<{ n: number }>("SELECT COUNT(*) n FROM speaking_jobs j JOIN speaking_attempts a ON a.id=j.attempt_id WHERE a.owner_key=? AND j.kind='assessment' AND j.status IN ('queued','running')", [ownerKey])?.n || 0;
    return active >= queueCapacity || ownerActive >= 2 ? 'waiting' : 'queued';
  };
  async function prepare(actor: LearningHistoryActor, studentName: string, lessonId: string, clientRunId: string, context: { classId?: string; className?: string } = {}, selection?: { sessionId: string; itemId: string }) {
    if (!/^[A-Za-z0-9._:-]{8,160}$/.test(clientRunId)) throw new SpeakingError(400, 'INVALID_RUN', 'Mã lượt đọc không hợp lệ.');
    const lesson = await getLesson(lessonId);
    if (!selection && (!lesson || lesson.status !== 'published')) throw notFound();
    return transaction(db => {
      let snapshot = lesson ? publicLesson(lesson) : undefined, itemNumber: number | undefined;
      let session: SessionRow | undefined;
      if (selection) {
        session = sessionRow(db, selection.sessionId, actor);
        if (session.lesson_id !== lessonId) throw new SpeakingError(400, 'INVALID_SESSION', 'Lượt học thuộc bộ khác.');
        const frozen = decode<{ lesson: typeof snapshot }>(session).lesson!;
        const items = lessonItems(frozen), index = items.findIndex(item => item.id === selection.itemId);
        if (index < 0) throw new SpeakingError(400, 'INVALID_ITEM', 'Mục luyện đọc không thuộc bộ đã mở.');
        const item = items[index], { items: _definitions, ...base } = frozen;
        snapshot = { ...base, referenceText: item.referenceText, sampleAudioUrl: item.sampleAudioUrl, samplePlaybackRate: item.samplePlaybackRate };
        itemNumber = index + 1;
      } else if (snapshot && isSetLesson(snapshot)) throw new SpeakingError(400, 'SESSION_REQUIRED', 'Hãy mở lượt học của bộ trước khi đọc từng mục.');
      if (!snapshot) throw notFound();
      const existing = db.one<{ data_json: string }>('SELECT data_json FROM speaking_attempts WHERE owner_key=? AND client_run_id=?', [actor.ownerKey, clientRunId]);
      if (existing) {
        const a = decode<StoredAttempt>(existing);
        if (a.lesson.id !== lessonId || a.sessionId !== selection?.sessionId || a.itemId !== selection?.itemId) throw new SpeakingError(409, 'RUN_CONFLICT', 'Mã lượt đọc đã dùng cho bài hoặc mục khác.');
        return view(a, true);
      }
      if (session?.status === 'completed') throw new SpeakingError(409, 'SESSION_COMPLETED', 'Bộ đã hoàn thành. Hãy mở lượt luyện mới.');
      const now = new Date().toISOString(), count = db.one<{ n: number }>('SELECT COUNT(*) n FROM speaking_attempts WHERE owner_key=? AND created_at>=?', [actor.ownerKey, now.slice(0, 10)]);
      if ((count?.n || 0) >= dailyLimit) throw new SpeakingError(429, 'DAILY_LIMIT', `Bạn đã dùng ${dailyLimit} lượt đọc hôm nay. Có thể tiếp tục bộ vào ngày sau.`);
      const a: StoredAttempt = { id: crypto.randomUUID(), ownerKey: actor.ownerKey, lesson: snapshot, status: 'prepared', createdAt: now, completedAt: null, durationSeconds: null, assessment: null, feedback: null, feedbackState: 'disabled', error: '', ...(selection ? { sessionId: selection.sessionId, itemId: selection.itemId, itemNumber } : {}) };
      const values = [a.id, actor.ownerKey, lessonId, snapshot.versionId, clientRunId, a.status, studentName, actor.kind === 'user' ? actor.id : null, actor.kind === 'guest' ? actor.id : null, context.classId || null, context.className || '', now, JSON.stringify(a), selection?.sessionId || null, selection?.itemId || null];
      db.run(`INSERT INTO speaking_attempts(id,owner_key,lesson_id,version_id,client_run_id,status,student_name,user_id,guest_id,class_id,class_name,created_at,data_json,session_id,item_id) VALUES (${values.map(() => '?').join(',')})`, values);
      return view(a, true);
    });
  }
  async function upload(actor: LearningHistoryActor, id: string, signed: string, wav: Buffer) {
    const initial = await access(actor, id, signed), hash = crypto.createHash('sha256').update(wav).digest('hex');
    if (initial.audioHash) { if (initial.audioHash !== hash) throw new SpeakingError(409, 'AUDIO_CONFLICT', 'Lượt này đã nhận bản thu khác. Hãy tạo lượt đọc mới.'); return view(initial, true); }
    if (initial.status !== 'prepared' || Date.now() - Date.parse(initial.createdAt) > 86400000) throw new SpeakingError(409, 'ATTEMPT_EXPIRED', 'Lượt đọc đã hết hạn. Hãy tạo lượt mới.');
    const provider = options.providers[initial.lesson.provider]; if (!provider.configured) throw new SpeakingError(503, 'PROVIDER_NOT_CONFIGURED', 'Giáo viên chưa cấu hình dịch vụ chấm giọng.');
    const quality = inspectWav(wav, Math.min(initial.lesson.maxSeconds, provider.maxSeconds));
    await fs.mkdir(options.audioDir, { recursive: true });
    // Content is immutable. Concurrent retries can only install identical bytes.
    const temporary = `${file(id)}.${crypto.randomUUID()}.tmp`;
    try { await fs.writeFile(temporary, wav, { flag: 'wx', mode: 0o600 }); try { await fs.link(temporary, file(id)); } catch (e: any) { if (e.code !== 'EEXIST') throw e; if (crypto.createHash('sha256').update(await fs.readFile(file(id))).digest('hex') !== hash) throw new SpeakingError(409, 'AUDIO_CONFLICT', 'Lượt này đã nhận bản thu khác.'); } }
    finally { await fs.unlink(temporary).catch(() => {}); }
    return transaction(db => {
      const a = decode<StoredAttempt>(db.one<{ data_json: string }>('SELECT data_json FROM speaking_attempts WHERE id=?', [id])!);
      if (a.audioHash) { if (a.audioHash !== hash) throw new SpeakingError(409, 'AUDIO_CONFLICT', 'Bản thu không khớp.'); return view(a, true); }
      const queueState = admission(db, actor.ownerKey);
      a.audioHash = hash; a.audioExpiresAt = new Date(Date.now() + retentionDays * 86400000).toISOString(); a.durationSeconds = quality.durationSeconds; a.status = 'queued';
      a.queueState = queueState; update(db, a);
      const now = new Date().toISOString(); db.run("INSERT INTO speaking_jobs(id,attempt_id,kind,status,created_at,updated_at) VALUES (?,?,'assessment',?,?,?)", [id, id, queueState, now, now]); return view(a, true);
    });
  }
  async function retry(actor: LearningHistoryActor, id: string, signed: string) {
    await access(actor, id, signed);
    return transaction(db => {
      const a = decode<StoredAttempt>(db.one<{ data_json: string }>('SELECT data_json FROM speaking_attempts WHERE id=?', [id])!), job = db.one<{ tries: number }>('SELECT tries FROM speaking_jobs WHERE id=?', [id]);
      if (a.status !== 'failed' || !a.audioExpiresAt || a.audioExpiresAt <= new Date().toISOString() || !job || job.tries >= 3) throw new SpeakingError(409, 'RETRY_UNAVAILABLE', 'Lượt này không thể chấm lại. Hãy tạo lượt mới.');
      if (!options.providers[a.lesson.provider].configured) throw new SpeakingError(503, 'PROVIDER_NOT_CONFIGURED', 'Chưa cấu hình dịch vụ chấm.');
      a.queueState = admission(db, actor.ownerKey);
      a.status = 'queued'; a.error = ''; update(db, a); db.run("UPDATE speaking_jobs SET status=?,lease_token=NULL,lease_until=0,updated_at=? WHERE id=?", [a.queueState, new Date().toISOString(), id]); return view(a, true);
    });
  }
  async function runNext() {
    const job = await transaction(db => {
      const stale = db.all<{ id: string; attempt_id: string; kind: string }>("SELECT id,attempt_id,kind FROM speaking_jobs WHERE status='running' AND lease_until<?", [Date.now()]);
      for (const j of stale) {
        const r = db.one<{ data_json: string }>('SELECT data_json FROM speaking_attempts WHERE id=?', [j.attempt_id]); if (!r) continue;
        const a = decode<StoredAttempt>(r);
        if (j.kind === 'assessment') { a.status = 'failed'; a.error = 'Tiến trình chấm bị gián đoạn. Yêu cầu chấm lại có thể phát sinh một lượt dịch vụ mới.'; } else a.feedbackState = 'failed';
        update(db, a); db.run("UPDATE speaking_jobs SET status='failed',lease_token=NULL,updated_at=? WHERE id=?", [new Date().toISOString(), j.id]);
      }
      const j = db.one<{ id: string; attempt_id: string; kind: string }>("SELECT id,attempt_id,kind FROM speaking_jobs WHERE status IN ('queued','waiting') ORDER BY created_at,id LIMIT 1"); if (!j) return undefined;
      const lease = crypto.randomUUID(); db.run("UPDATE speaking_jobs SET status='running',lease_token=?,lease_until=?,tries=tries+1,updated_at=? WHERE id=? AND status IN ('queued','waiting')", [lease, Date.now() + 480000, new Date().toISOString(), j.id]);
      const a = decode<StoredAttempt>(db.one<{ data_json: string }>('SELECT data_json FROM speaking_attempts WHERE id=?', [j.attempt_id])!); if (j.kind === 'assessment') { a.status = 'assessing'; delete a.queueState; update(db, a); } return { ...j, lease, attempt: a };
    });
    if (!job) return false;
    let assessment: Assessment | undefined, feedback: Feedback | undefined, failure = '';
    try {
      const wav = await fs.readFile(file(job.attempt.id)); if (crypto.createHash('sha256').update(wav).digest('hex') !== job.attempt.audioHash) throw new SpeakingError(422, 'AUDIO_INTEGRITY', 'Bản thu lưu trữ không còn nguyên vẹn.');
      if (job.kind === 'assessment') {
        assessment = await options.providers[job.attempt.lesson.provider].assess({ lesson: job.attempt.lesson, wav, durationSeconds: job.attempt.durationSeconds! });
        if (assessment.provider !== job.attempt.lesson.provider || assessment.schemaVersion !== 1 || !Number.isFinite(assessment.score) || assessment.score < 0 || assessment.score > 100) throw new SpeakingError(502, 'PROVIDER_RESPONSE', 'Kết quả dịch vụ không khớp cấu hình lượt đọc.');
      } else if (options.feedback) feedback = await options.feedback(job.attempt, wav);
      else throw new SpeakingError(503, 'FEEDBACK_UNAVAILABLE', 'Chưa cấu hình AI nhận xét.');
    } catch (error) { assessment = undefined; feedback = undefined; failure = error instanceof SpeakingError ? error.message : 'Dịch vụ chấm đang gián đoạn. Yêu cầu chấm lại có thể phát sinh một lượt dịch vụ mới.'; }
    await transaction(db => {
      const currentJob = db.one<{ lease_token: string; status: string }>('SELECT lease_token,status FROM speaking_jobs WHERE id=?', [job.id]); if (currentJob?.lease_token !== job.lease || currentJob.status !== 'running') return;
      const a = decode<StoredAttempt>(db.one<{ data_json: string }>('SELECT data_json FROM speaking_attempts WHERE id=?', [job.attempt.id])!);
      if (job.kind === 'assessment') {
        if (assessment) { a.assessment = assessment; a.status = 'completed'; a.completedAt = new Date().toISOString(); a.error = ''; a.feedbackState = a.lesson.feedbackEnabled && options.feedback ? 'pending' : 'disabled';
          db.run('INSERT INTO speaking_attempt_details(attempt_id,created_at,updated_at,data_json) VALUES (?,?,?,?)', [a.id, a.completedAt, a.completedAt, JSON.stringify({ assessment })]);
          if (a.feedbackState === 'pending') db.run("INSERT INTO speaking_jobs(id,attempt_id,kind,status,created_at,updated_at) VALUES (?,?,'feedback','queued',?,?)", [`${a.id}:feedback`, a.id, a.completedAt, a.completedAt]);
        } else { a.status = 'failed'; a.error = failure || 'Chưa có kết quả chấm.'; }
      } else { a.feedback = feedback || null; a.feedbackState = feedback ? 'ready' : 'failed'; }
      update(db, a); if (a.sessionId && assessment) updateSessionProgress(db, a.sessionId); db.run('UPDATE speaking_jobs SET status=?,lease_token=NULL,lease_until=0,updated_at=? WHERE id=?', [failure ? 'failed' : 'completed', new Date().toISOString(), job.id]);
    });
    return true;
  }
  return { prepare, access, upload, retry, runNext, view,
    async prepareSession(...args: Parameters<typeof prepareSession>) { const result = await prepareSession(...args); return readSession(args[0], result.id, value => view(value, true)); },
    async session(actor: LearningHistoryActor, id: string, staff?: Staff) { return readSession(actor, id, value => view(value, !staff), staff); },
    async latestSession(actor: LearningHistoryActor, lessonId: string) { const row = await queryOne<{ id: string }>('SELECT id FROM speaking_sessions WHERE owner_key=? AND lesson_id=? ORDER BY created_at DESC,rowid DESC LIMIT 1', [actor.ownerKey, lessonId]); return row ? readSession(actor, row.id, value => view(value, true)) : null; },
    async reviewResult(actor: LearningHistoryActor, id: string, staff: Staff) { const row = await queryOne<{ id: string }>('SELECT id FROM speaking_sessions WHERE id=?', [id]); return row ? readSession(actor, id, sanitized => view(sanitized), staff) : view(await access(actor, id, undefined, staff)); },
    async resume(actor: LearningHistoryActor, id: string) { return view(await access(actor, id), true); },
    async review(actor: LearningHistoryActor, id: string, staff?: Staff) { return view(await access(actor, id, undefined, staff)); },
    async audio(actor: LearningHistoryActor, id: string, staff?: Staff) { const candidate = await load(id), a = await access(actor, id, undefined, candidate.ownerKey === actor.ownerKey ? undefined : staff); if (!a.audioHash || !a.audioExpiresAt || a.audioExpiresAt <= new Date().toISOString()) throw new SpeakingError(410, 'AUDIO_EXPIRED', 'Bản thu đã hết thời hạn nghe lại.'); return fs.readFile(file(id)).catch(() => { throw new SpeakingError(410, 'AUDIO_MISSING', 'Bản thu không còn khả dụng.'); }); },
    async history(actor: LearningHistoryActor) { const rows = await queryAll<{ data_json: string }>("SELECT data_json FROM speaking_attempts WHERE owner_key=? ORDER BY created_at DESC,id LIMIT 50", [actor.ownerKey]); return rows.map(r => view(decode<StoredAttempt>(r))); },
  };
}
