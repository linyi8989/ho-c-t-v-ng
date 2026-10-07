import express from 'express';
import { SpeakingError, integer, normalizeLesson, text, KIND_LABELS, type Capabilities } from '../../shared/speaking/types';
import { resolveLearningHistoryActor } from '../learning-history/learningHistoryAuth';
import { azureProsodyEnabled, createProviders, wordsOf } from './providers';
import { createSpeakingService } from './service';
import { getLesson, listLessons, lessonPage, listResults, saveLesson, setLessonStatus, type Staff } from './repository';
import { MAX_AUDIO_BYTES } from './audio';
interface Options {
  enabled: boolean; ticketSecret: string; audioDir: string; db: { collection(name: string): any };
  authenticateUser: express.RequestHandler; authenticateOptionalUser: express.RequestHandler; requireStaff: express.RequestHandler; rateLimit: express.RequestHandler;
  feedback?: Parameters<typeof createSpeakingService>[0]['feedback']; feedbackMode: 'metrics' | 'audio'; feedbackCapability?: Capabilities['feedback']; sampleTts?: Capabilities['sampleTts'];
  preview: (payload: unknown) => Promise<{ audioUrl: string; ttsText?: string; warnings?: string[] }>;
  sampleRateLimit?: express.RequestHandler;
  env?: NodeJS.ProcessEnv; startWorker?: boolean; providers?: ReturnType<typeof createProviders>;
}
export function createSpeakingRouter(options: Options) {
  const router = express.Router(), env = options.env || process.env, providers = options.providers || createProviders(env);
  const service = createSpeakingService({ providers, secret: options.ticketSecret, audioDir: options.audioDir, dailyLimit: Number(env.SPEAKING_DAILY_LIMIT), retentionDays: Number(env.SPEAKING_AUDIO_RETENTION_DAYS), feedback: options.feedback });
  const capability: Capabilities = { enabled: options.enabled, reason: options.enabled ? '' : 'Speaking cần chế độ SQLite của B.', schemaVersion: 1, primaryProvider: 'azure',
    providers: [{ id: 'azure', label: 'Azure Speech', configured: providers.azure.configured, maxSeconds: 300 }, { id: 'speechsuper', label: 'SpeechSuper', configured: providers.speechsuper.configured, maxSeconds: 180 }],
    sampleTts: options.sampleTts, feedback: options.feedbackCapability || { configured: Boolean(options.feedback), mode: options.feedbackMode }, maxAudioBytes: MAX_AUDIO_BYTES };
  capability.azureProsody = { enabled: azureProsodyEnabled(env), locale: 'en-US', includesRhythm: true };
  const sendError = (res: express.Response, error: any) => { const status = Number.isInteger(error?.status) ? error.status : 500; res.status(status).json({ code: error?.code || 'SPEAKING_ERROR', error: status === 500 ? 'Không thể xử lý luyện đọc lúc này.' : status === 413 ? 'Bản thu vượt dung lượng cho phép.' : error?.message || 'Không thể xử lý yêu cầu.' }); };
  const handle = (fn: (req: express.Request, res: express.Response) => Promise<unknown>): express.RequestHandler => (req, res) => { void fn(req, res).catch(e => sendError(res, e)); };
  const staff = (req: express.Request): Staff => { if (!req.user || !['teacher', 'super_admin'].includes(req.user.role)) throw new SpeakingError(403, 'FORBIDDEN', 'Cần quyền giáo viên.'); return { id: req.user.id, role: req.user.role === 'super_admin' ? 'super_admin' : 'teacher' }; };
  const grade = (value: unknown) => value === undefined || value === '' ? undefined : integer(value, 1, 9);
  const kind = (value: unknown) => { if (value === undefined || value === '') return undefined; if (typeof value !== 'string' || !Object.hasOwn(KIND_LABELS, value)) throw new SpeakingError(400, 'INVALID_KIND', 'Dạng bài không hợp lệ.'); return value; };
  router.get('/capabilities', (_req, res) => res.json(capability));
  router.use((_req, res, next) => options.enabled ? next() : res.status(503).json({ code: 'SPEAKING_UNAVAILABLE', error: capability.reason }));
  router.use(options.authenticateOptionalUser);
  router.use((req, res, next) => { if ((req as any).authBlocked) return res.status(403).json({ error: 'Tài khoản đã bị khóa.' }); if (req.headers.authorization && !req.user) return res.status(401).json({ error: 'Phiên đăng nhập không hợp lệ.' }); next(); });
  router.use(options.rateLimit);
  router.get('/lessons', handle(async (req, res) => res.json(await listLessons(undefined, grade(req.query.grade), kind(req.query.kind), text(req.query.search, 200)))));
  router.get('/lessons-page', handle(async (req, res) => res.json(await lessonPage(undefined, grade(req.query.grade), kind(req.query.kind), text(req.query.search, 200), req.query.page === undefined ? 1 : integer(req.query.page, 1, 1000000)))));
  router.get('/lessons/:id', handle(async (req, res) => { const lesson = await getLesson(req.params.id); if (!lesson || lesson.status !== 'published') throw new SpeakingError(404, 'NOT_FOUND', 'Không tìm thấy bài luyện đọc.'); const { ownerId: _owner, ...safe } = lesson; res.json(safe); }));
  router.get('/history', handle(async (req, res) => res.json(await service.history(await resolveLearningHistoryActor(req)))));
  const identityContext = async (req: express.Request) => {
    const actor = await resolveLearningHistoryActor(req), guest = actor.kind === 'guest' ? await options.db.collection('guest_profiles').doc(actor.id).get() : undefined;
    const profile = actor.kind === 'user' ? actor.userProfile : guest?.data(), studentName = text(profile?.displayName || profile?.name, 120, true), classId = text(profile?.classId, 160);
    const classDoc = classId ? await options.db.collection('classes').doc(classId).get() : undefined;
    return { actor, studentName, context: classDoc?.exists ? { classId, className: text(classDoc.data()?.name, 160) } : {} };
  };
  router.post('/sessions/prepare', handle(async (req, res) => {
    const { actor, studentName, context } = await identityContext(req);
    res.status(201).json(await service.prepareSession(actor, studentName, text(req.body?.lessonId, 160, true), text(req.body?.clientRunId, 160, true), context,
      { sourceSessionId: text(req.body?.sourceSessionId, 160) || undefined, itemIds: req.body?.itemIds }));
  }));
  router.get('/sessions/latest', handle(async (req, res) => res.json(await service.latestSession(await resolveLearningHistoryActor(req), text(req.query.lessonId, 160, true)))));
  router.get('/sessions/:id', handle(async (req, res) => res.json(await service.session(await resolveLearningHistoryActor(req), req.params.id))));
  router.post('/attempts/prepare', handle(async (req, res) => {
    const { actor, studentName, context } = await identityContext(req);
    const selection = req.body?.sessionId !== undefined || req.body?.itemId !== undefined ? { sessionId: text(req.body?.sessionId, 160, true), itemId: text(req.body?.itemId, 160, true) } : undefined;
    res.status(201).json(await service.prepare(actor, studentName, text(req.body?.lessonId, 160, true), text(req.body?.clientRunId, 160, true), context, selection));
  }));
  router.get('/attempts/:id', handle(async (req, res) => res.json(await service.resume(await resolveLearningHistoryActor(req), req.params.id))));
  router.post('/attempts/:id/audio', (req, res, next) => { void (async () => { await service.access(await resolveLearningHistoryActor(req), req.params.id, text(req.headers['x-attempt-ticket'], 200, true)); if (!req.is('audio/wav')) throw new SpeakingError(415, 'INVALID_AUDIO_TYPE', 'Gửi bản thu WAV.'); next(); })().catch(e => sendError(res, e)); },
    express.raw({ type: 'audio/wav', limit: MAX_AUDIO_BYTES }), handle(async (req, res) => { if (!Buffer.isBuffer(req.body)) throw new SpeakingError(400, 'INVALID_AUDIO', 'Thiếu bản thu.'); res.json(await service.upload(await resolveLearningHistoryActor(req), req.params.id, text(req.headers['x-attempt-ticket'], 200, true), req.body)); }));
  router.post('/attempts/:id/retry', handle(async (req, res) => res.json(await service.retry(await resolveLearningHistoryActor(req), req.params.id, text(req.headers['x-attempt-ticket'], 200, true)))));
  router.get('/attempts/:id/recording', handle(async (req, res) => { const actor = await resolveLearningHistoryActor(req), isStaff = actor.role === 'teacher' || actor.role === 'super_admin'; const bytes = await service.audio(actor, req.params.id, isStaff ? staff(req) : undefined); res.set({ 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Type': 'audio/wav' }).send(bytes); }));
  router.use('/admin', (req, res, next) => req.user ? next() : options.authenticateUser(req, res, next), options.requireStaff);
  router.get('/admin/lessons', handle(async (req, res) => res.json(await listLessons(staff(req), grade(req.query.grade), kind(req.query.kind), text(req.query.search, 200)))));
  router.get('/admin/lessons-page', handle(async (req, res) => res.json(await lessonPage(staff(req), grade(req.query.grade), kind(req.query.kind), text(req.query.search, 200), req.query.page === undefined ? 1 : integer(req.query.page, 1, 1000000)))));
  router.post('/admin/lessons', handle(async (req, res) => res.status(201).json(await saveLesson(staff(req), req.body))));
  router.put('/admin/lessons/:id', handle(async (req, res) => res.json(await saveLesson(staff(req), req.body, req.params.id, integer(req.body?.revision, 1, 10000000)))));
  router.post('/admin/lessons/:id/publish', handle(async (req, res) => res.json(await setLessonStatus(staff(req), req.params.id, integer(req.body?.revision, 1, 10000000), 'published'))));
  router.delete('/admin/lessons/:id', handle(async (req, res) => res.json(await setLessonStatus(staff(req), req.params.id, integer(req.body?.revision, 1, 10000000), 'archived'))));
  router.post('/admin/sample', options.sampleRateLimit || ((_req, _res, next) => next()), handle(async (req, res) => {
    staff(req); if (req.body?.items !== undefined) throw new SpeakingError(400, 'SAMPLE_SINGLE_ITEM', 'Tạo audio mẫu riêng cho từng mục.'); const data = normalizeLesson(req.body);
    if (options.sampleTts?.configured === false) throw new SpeakingError(503, 'SAMPLE_TTS_UNAVAILABLE', options.sampleTts.reason);
    let result: Awaited<ReturnType<Options['preview']>>;
    try { result = await options.preview({ text: data.referenceText, settings: { lang: data.locale, speed: 1 } }); }
    catch (error) {
      if (options.sampleTts?.provider === 'azure') throw new SpeakingError((error as { status?: number })?.status === 504 ? 504 : 502, 'SAMPLE_TTS_FAILED', 'Azure chưa tạo được audio mẫu. Kiểm tra key, region, quyền TTS và quota của Speech resource; có thể dùng giọng đọc trên thiết bị.');
      throw new SpeakingError(502, 'SAMPLE_TTS_FAILED', 'Không tạo được audio mẫu từ TTS của B. Kiểm tra key TTS/quyền dịch vụ hoặc dùng giọng đọc trên thiết bị.');
    }
    if (result.ttsText && wordsOf(result.ttsText).join(' ') !== wordsOf(data.referenceText).join(' ')) throw new SpeakingError(422, 'SAMPLE_TRUNCATED', 'TTS đã thay đổi nội dung. Hãy chia bài thành lượt đọc ngắn hơn.');
    const safeUrl = normalizeLesson({ ...data, sampleAudioUrl: result.audioUrl }).sampleAudioUrl;
    res.json({ ...result, audioUrl: safeUrl, playbackRate: 1 });
  }));
  router.get('/admin/results', handle(async (req, res) => res.json(await listResults(staff(req), grade(req.query.grade), kind(req.query.kind), req.query.page === undefined ? 1 : integer(req.query.page, 1, 10000000)))));
  router.get('/admin/results/:id', handle(async (req, res) => res.json(await service.reviewResult(await resolveLearningHistoryActor(req), req.params.id, staff(req)))));
  router.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => sendError(res, err));
  if (options.enabled && options.startWorker !== false) { let active = false; const tick = () => { if (active) return; active = true; void service.runNext().catch(() => console.error('[Speaking] Worker unavailable; retrying queue scan.')).finally(() => { active = false; }); }; setInterval(tick, 1500).unref(); }
  return router;
}
