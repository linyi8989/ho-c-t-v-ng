import express from 'express';
import { getPracticeReport, getMistakeTopic, mistakeScope } from './practice';
import { CompetitionError, buildImportPrompt, parseScope, parseQuestionFilters, record, text } from '../../shared/competition/import';
import { isSubject, LEVEL_LABELS, type Paper, type ReviewRow, type ResultFilters } from '../../shared/competition/types';
import { resolveLearningHistoryActor } from '../learning-history/learningHistoryAuth';
import { createCompetitionEngine, type AttemptContext } from './engine';
import { archiveQuestions, bankScope, createPaper, decode, getBankTopic, getPaper, inventory, overview, listBankTopics, listResults, listBank, listPapers, queryAll, queryOne, requireOwned, saveQuestions, transaction, updateQuestion, type Staff } from './repository';

interface Options {
  enabled: boolean; ticketSecret: string; db: { collection: (name: string) => any };
  authenticateUser: express.RequestHandler; authenticateOptionalUser: express.RequestHandler; requireStaff: express.RequestHandler;
  rateLimit: express.RequestHandler;
}
function integer(value: unknown, min: number, max: number, fallback?: number) {
  const n = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(n) || n! < min || n! > max) throw new CompetitionError(400, 'INVALID_INPUT', 'Số không hợp lệ.');
  return n!;
}
const publicPaper = (p: Paper) => ({ id: p.id, title: p.title, subject: p.subject, grade: p.grade, level: p.level, total: p.total, durationMinutes: p.durationMinutes, visibility: p.visibility });
export function createCompetitionRouter(options: Options) {
  const router = express.Router(), engine = createCompetitionEngine(options.ticketSecret);
  const sendError = (res: express.Response, error: unknown) => {
    const err = error instanceof Error ? error as Error & { status?: number; code?: string } : undefined;
    const status = err?.status || 500;
    if (status >= 500) console.error('[IOE/Violympic] Request failed:', err?.name || 'Error');
    res.status(status).json({ error: status >= 500 ? 'Không thể xử lý lúc này. Vui lòng thử lại.' : err?.message, code: err?.code || 'COMPETITION_ERROR' });
  };
  const handle = (fn: (req: express.Request, res: express.Response) => Promise<unknown>): express.RequestHandler => (req, res) => { void fn(req, res).catch(error => sendError(res, error)); };
  const staff = (req: express.Request): Staff => {
    if (!req.user || !['teacher', 'super_admin'].includes(req.user.role)) throw new CompetitionError(403, 'FORBIDDEN', 'Cần quyền giáo viên.');
    return { id: req.user.id, role: req.user.role === 'super_admin' ? 'super_admin' : 'teacher' };
  };
  router.get('/capabilities', (_req, res) => res.json({ enabled: options.enabled, reason: options.enabled ? '' : 'Module cần chế độ SQLite đang dùng cho Learning History của B.', schemaVersion: 1 }));
  router.use((_req, res, next) => options.enabled ? next() : res.status(503).json({ error: 'Module IOE/Violympic chưa khả dụng trong chế độ lưu trữ này.', code: 'COMPETITION_UNAVAILABLE' }));
  router.use(options.authenticateOptionalUser);
  router.use((req, res, next) => {
    if ((req as express.Request & { authBlocked?: boolean }).authBlocked) return res.status(403).json({ error: 'Tài khoản đã bị khóa.', code: 'ACCOUNT_BLOCKED' });
    if (req.headers.authorization && !req.user) return res.status(401).json({ error: 'Phiên đăng nhập không hợp lệ.', code: 'AUTHENTICATION_REQUIRED' });
    next();
  });
  router.use(options.rateLimit);
  router.get('/papers', handle(async (_req, res) => res.json((await listPapers()).map(publicPaper))));
  router.get('/bank-topics', handle(async (_req, res) => res.json(await listBankTopics())));
  router.get('/practice', handle(async (req, res) => res.json(await getPracticeReport((await resolveLearningHistoryActor(req)).ownerKey))));
  router.get('/papers/:id', handle(async (req, res) => {
    const mistakes = mistakeScope(req.params.id);
    if (mistakes) return res.json(await getMistakeTopic((await resolveLearningHistoryActor(req)).ownerKey, mistakes));
    const scope = bankScope(req.params.id);
    if (scope) return res.json(await getBankTopic(scope));
    const paper = await getPaper(req.params.id);
    if (!paper || paper.status !== 'published') throw new CompetitionError(404, 'NOT_FOUND', 'Không tìm thấy đề.');
    await accessContext(req, paper, String(req.query.access || ''));
    res.json(publicPaper(paper));
  }));
  router.use('/admin', (req, res, next) => req.user ? next() : options.authenticateUser(req, res, next), options.requireStaff);
  router.post('/admin/prompt', handle(async (req, res) => res.json({ prompt: buildImportPrompt(parseScope(req.body)) })));
  router.get('/admin/inventory', handle(async (req, res) => res.json(await inventory(staff(req)))));
  router.get('/admin/overview', handle(async (req, res) => res.json(await overview(staff(req)))));
  router.get('/admin/questions', handle(async (req, res) => res.json(await listBank(staff(req), parseQuestionFilters(req.query), text(req.query.search, 300), integer(req.query.page, 1, 100000, 1)))));
  router.post('/admin/questions', handle(async (req, res) => {
    const body = record(req.body), requestId = text(body.requestId, 160, true);
    if (!/^[A-Za-z0-9._:-]{8,160}$/.test(requestId) || !Array.isArray(body.questions)) throw new CompetitionError(400, 'INVALID_INPUT', 'Mã lưu hoặc danh sách câu không hợp lệ.');
    res.status(201).json(await saveQuestions(staff(req), parseScope(body), body.questions, requestId));
  }));
  router.put('/admin/questions/:id', handle(async (req, res) => res.json(await updateQuestion(staff(req), req.params.id, parseScope(req.body), req.body, integer(req.body.revision, 1, 10000000)))));
  router.post('/admin/questions/archive', handle(async (req, res) => {
    const ids = req.body?.ids;
    if (!Array.isArray(ids) || !ids.length || ids.length > 100 || ids.some(id => typeof id !== 'string' || id.length > 160) || new Set(ids).size !== ids.length) throw new CompetitionError(400, 'INVALID_INPUT', 'Chọn từ 1 đến 100 câu khác nhau.');
    res.json(await archiveQuestions(staff(req), ids));
  }));
  router.get('/admin/papers', handle(async (req, res) => res.json(await listPapers(staff(req)))));
  router.post('/admin/papers', handle(async (req, res) => {
    if (req.body.visibility !== 'public' && req.body.visibility !== 'assignment') throw new CompetitionError(400, 'INVALID_INPUT', 'Chọn công khai hoặc giao lớp.');
    res.status(201).json(await createPaper(staff(req), parseScope(req.body), text(req.body.title, 300, true), req.body.visibility));
  }));
  router.delete('/admin/papers/:id', handle(async (req, res) => {
    if (bankScope(req.params.id) || mistakeScope(req.params.id)) throw new CompetitionError(400, 'BANK_SCOPE_MANAGED', 'Nhóm câu được quản lý từ ngân hàng hoặc lịch sử học sinh.');
    const paper = requireOwned(await getPaper(req.params.id), staff(req));
    await transaction(db => db.run("UPDATE competition_papers SET status='archived',updated_at=?,data_json=? WHERE id=?", [new Date().toISOString(), JSON.stringify({ ...paper, status: 'archived' }), paper.id]));
    res.json({ archived: true });
  }));
  router.get('/admin/results', handle(async (req, res) => {
    const actor = staff(req), paperId = text(req.query.paperId, 160);
    if (paperId) requireOwned(await getPaper(paperId), actor);
    const where = actor.role === 'super_admin' ? '' : 'AND p.owner_id=?';
    const params = actor.role === 'super_admin' ? [] : [actor.id];
    const rows = await queryAll<Record<string, unknown>>(`SELECT a.id,a.student_name,a.class_id,a.score,a.raw_score,a.max_score,a.correct_count,a.incorrect_count,a.unanswered_count,a.completed_at,
      json_extract(a.data_json,'$.className') AS class_name,json_extract(a.data_json,'$.paper.title') AS title
      FROM competition_attempts a JOIN competition_papers p ON p.id=a.paper_id WHERE a.status='completed' ${where} ${paperId ? 'AND a.paper_id=?' : ''} ORDER BY a.completed_at DESC,a.id LIMIT 200`, paperId ? [...params, paperId] : params);
    res.json(rows);
  }));
  router.get('/admin/results-page', handle(async (req, res) => {
    const actor = staff(req), filters: ResultFilters = {};
    if (req.query.subject !== undefined && req.query.subject !== '') {
      if (!isSubject(req.query.subject)) throw new CompetitionError(400, 'INVALID_INPUT', 'Môn học không hợp lệ.');
      filters.subject = req.query.subject;
    }
    if (req.query.grade !== undefined && req.query.grade !== '') filters.grade = integer(req.query.grade, 1, 9);
    if (req.query.level !== undefined && req.query.level !== '') {
      const level = text(req.query.level, 40);
      if (!Object.entries(LEVEL_LABELS).some(([id]) => id === level)) throw new CompetitionError(400, 'INVALID_INPUT', 'Cấp không hợp lệ.');
      filters.level = level as ResultFilters['level'];
    }
    filters.paperId = text(req.query.paperId, 160);
    if (filters.paperId) requireOwned(await getPaper(filters.paperId), actor);
    res.json(await listResults(actor, filters, integer(req.query.page, 1, 10000000, 1)));
  }));
  router.get('/admin/results/:id', handle(async (req, res) => {
    const row = await queryOne<{ paper_id: string; data_json: string }>("SELECT paper_id,data_json FROM competition_attempts WHERE id=? AND status='completed'", [req.params.id]);
    requireOwned(row ? await getPaper(row.paper_id) : undefined, staff(req));
    const detail = await queryOne<{ data_json: string }>('SELECT data_json FROM competition_attempt_details WHERE attempt_id=?', [req.params.id]);
    if (!row || !detail) throw new CompetitionError(404, 'NOT_FOUND', 'Không tìm thấy kết quả.');
    res.json({ result: decode<{ result: unknown }>(row).result, rows: decode<{ rows: ReviewRow[] }>(detail).rows });
  }));
  async function accessContext(req: express.Request, paper: Paper, accessToken: string): Promise<AttemptContext> {
    if (accessToken) {
      const snapshot = await options.db.collection('assignments').where('shareToken', '==', accessToken).limit(1).get();
      const assignment = snapshot.empty ? undefined : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
      if (!assignment || assignment.resourceType !== 'competition' || assignment.resourceId !== paper.id || assignment.lifecycleStatus === 'archived' || assignment.status === 'archived' || assignment.archivedAt) throw new CompetitionError(404, 'ASSIGNMENT_NOT_FOUND', 'Link giao bài không hợp lệ hoặc đã thu hồi.');
      const classDoc = await options.db.collection('classes').doc(assignment.classId).get();
      const classRecord = classDoc.exists ? classDoc.data() : undefined;
      if (!classRecord || classRecord.lifecycleStatus === 'archived' || classRecord.status === 'archived' || classRecord.archivedAt) throw new CompetitionError(404, 'ASSIGNMENT_NOT_FOUND', 'Lớp học không còn hoạt động.');
      return { assignmentId: assignment.id, assignmentTitle: assignment.title || '', assignmentDueAt: assignment.dueDate || '', classId: assignment.classId, className: classRecord.name || '' };
    }
    if (paper.visibility === 'assignment' && !(req.user && (req.user.role === 'super_admin' || (req.user.role === 'teacher' && req.user.id === paper.ownerId)))) throw new CompetitionError(404, 'NOT_FOUND', 'Cần link giao bài của giáo viên.');
    return {};
  }
  router.post('/attempts/prepare', handle(async (req, res) => {
    const actor = await resolveLearningHistoryActor(req), paperId = text(req.body.paperId, 160, true), clientRunId = text(req.body.clientRunId, 160, true);
    if (!/^[A-Za-z0-9._:-]{8,160}$/.test(clientRunId)) throw new CompetitionError(400, 'INVALID_RUN', 'Mã lượt làm không hợp lệ.');
    const scope = bankScope(paperId), mistakes = mistakeScope(paperId), access = text(req.body.access, 300);
    let context: AttemptContext = {};
    if (scope || mistakes) {
      if (access) throw new CompetitionError(400, 'INVALID_CONTEXT', 'Luyện từ ngân hàng không dùng link giao đề cố định.');
    } else {
      const paper = await getPaper(paperId);
      if (!paper || paper.status !== 'published') throw new CompetitionError(404, 'NOT_FOUND', 'Không tìm thấy đề.');
      context = await accessContext(req, paper, access);
    }
    const profile = actor.kind === 'guest' ? await options.db.collection('guest_profiles').doc(actor.id).get() : undefined;
    const studentName = actor.kind === 'user' ? text(actor.userProfile?.name, 120, true) : text(profile?.data()?.displayName || profile?.data()?.name, 120, true);
    res.status(201).json(await engine.prepare(actor, studentName, paperId, clientRunId, context));
  }));
  router.get('/attempts/:id', handle(async (req, res) => res.json(await engine.resume(await resolveLearningHistoryActor(req), req.params.id, text(req.headers['x-attempt-ticket'], 1000, true)))));
  router.post('/attempts/:id/activate', handle(async (req, res) => res.json(await engine.activate(await resolveLearningHistoryActor(req), req.params.id, text(req.headers['x-attempt-ticket'], 1000, true)))));
  router.put('/attempts/:id/answers', handle(async (req, res) => {
    const saved = await engine.save(await resolveLearningHistoryActor(req), req.params.id, text(req.headers['x-attempt-ticket'], 1000, true), integer(req.body.revision, 0, 10000000), req.body.answers);
    const { questions: _questions, ...update } = saved;
    res.json(update); // Autosave acknowledges answers/revision without retransmitting a 200-question snapshot.
  }));
  router.post('/attempts/:id/submit', handle(async (req, res) => res.json(await engine.submit(await resolveLearningHistoryActor(req), req.params.id, text(req.headers['x-attempt-ticket'], 1000, true), integer(req.body.revision, 0, 10000000), req.body.answers))));
  router.get('/attempts/:id/review', handle(async (req, res) => res.json(await engine.review(await resolveLearningHistoryActor(req), req.params.id, text(req.headers['x-attempt-ticket'], 1000, true)))));
  if (options.enabled) {
    let running = false;
    const reconcile = async () => { if (running) return; running = true; try { await engine.finalizeExpired(); } catch { console.error('[IOE/Violympic] Expiry reconciliation failed; retrying on next interval.'); } finally { running = false; } };
    void reconcile(); setInterval(() => { void reconcile(); }, 15000).unref();
  }
  return router;
}
