import crypto from 'crypto';
import express from 'express';
import type {
  ExamAnswers,
  ExamCompletedAttempt,
  ExamPaperContent,
  ExamPlayableSet,
} from '../../features/exam-platform/types.js';
import { getExamPaperDefinition } from '../../features/exam-platform/definitions.js';
import { examPartUnits } from '../../features/exam-platform/examStructure.js';
import { isListeningModuleId, isListeningPaperId } from '../../features/listening-library/registry.js';
import { applyAiWritingGrade, applyManualExamGrades, EXAM_GRADING_VERSION, gradeExamAttempt, markAiWritingFailed } from './examGrader.js';
import { describeWritingGradingFailure, type WritingGradeInput, type WritingGradeOutput } from './writingGradingProvider.js';
import {
  sanitizeExamAnswers,
  sanitizeExamContentForStudent,
  normalizeExamSmartImportPart,
  validateExamPaperContent,
} from './examValidation.js';
import { normalizeFixedFlyerListeningContent } from '../../features/exam-platform/flyerListeningMigration.js';
import { normalizeFixedFlyerReadingWritingContent } from '../../features/exam-platform/flyerReadingWritingMigration.js';
import { normalizeFixedKetReadingWritingContent } from '../../features/exam-platform/ketReadingWritingMigration.js';

type Middleware = express.RequestHandler;

export interface ExamRouterDependencies {
  db: any;
  authenticateUser: Middleware;
  authenticateOptionalUser: Middleware;
  requireStaff: Middleware;
  ticketSecret: string;
  resolveGuestProfile: (
    guestId: unknown,
    studentName: unknown,
    touchActivity?: boolean,
    classInfo?: { classId?: unknown; className?: unknown; verified?: boolean },
  ) => Promise<any>;
  logAudit?: (userId: string, name: string, email: string, action: string, details: string) => Promise<void>;
  writingGrading?: {
    providers: Array<{ id: string; label: string; enabled: boolean }>;
    grade: (input: WritingGradeInput) => Promise<WritingGradeOutput>;
  };
}

const text = (value: unknown, max = 500) => String(value ?? '').trim().slice(0, max);
const nowIso = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');
const safeEqual = (left: string, right: string) => {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
const EXAM_TICKET_DEFAULT_TTL_MS = 24 * 60 * 60_000;
const EXAM_TICKET_RENEWAL_TTL_MS = 15 * 60_000;
const EXAM_TICKET_RENEWAL_GRACE_MS = 7 * 24 * 60 * 60_000;
const EXAM_TICKET_CLOCK_SKEW_MS = 5 * 60_000;

const normalizeFixedExamContent = (content: ExamPaperContent) => normalizeFixedKetReadingWritingContent(
  normalizeFixedFlyerReadingWritingContent(normalizeFixedFlyerListeningContent(content)),
);

function apiError(status: number, message: string, details?: unknown) {
  const error: any = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}

function sendError(res: express.Response, error: any) {
  res.status(Number(error?.status || 500)).json({
    error: error?.message || 'Không thể xử lý yêu cầu kho đề luyện thi.',
    ...(error?.details ? { details: error.details } : {}),
  });
}

const isStaff = (user: any) => user?.role === 'teacher' || user?.role === 'super_admin';
const canManage = (user: any, set: any) => user?.role === 'super_admin' || (user?.role === 'teacher' && set?.ownerId === user.id);

function routeIdentity(req: express.Request) {
  const moduleId = req.params.moduleId;
  const paperId = req.params.paperId;
  if (!isListeningModuleId(moduleId) || moduleId === 'mover' || !isListeningPaperId(paperId)) {
    throw apiError(404, 'Module hoặc loại bài thi không tồn tại.');
  }
  const definition = getExamPaperDefinition(moduleId, paperId);
  if (!definition) throw apiError(404, 'Loại bài thi chưa được cấu hình.');
  return { moduleId, paperId, definition };
}

function publicSummary(set: any) {
  const {
    draftContent: _draftContent,
    draftRevision: _draftRevision,
    validationErrors: _validationErrors,
    shareToken: _shareToken,
    assignmentSlug: _assignmentSlug,
    ownerId: _ownerId,
    ...summary
  } = set || {};
  return summary;
}

async function getSet(db: any, setId: string) {
  const snapshot = await db.collection('exam_sets').doc(setId).get();
  return snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null;
}

async function getVersion(db: any, versionId: string) {
  const snapshot = await db.collection('exam_set_versions').doc(versionId).get();
  return snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null;
}

function assertRouteSet(set: any, moduleId: string, paperId: string) {
  if (!set || set.moduleId !== moduleId || set.paperId !== paperId) throw apiError(404, 'Không tìm thấy bộ đề.');
}

function encodeTicket(payload: Record<string, unknown>, secret: string) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function decodeTicket(value: unknown, secret: string, options: { allowExpired?: boolean } = {}) {
  const [encoded, signature, extra] = String(value || '').split('.');
  if (!encoded || !signature || extra) throw apiError(401, 'Phiếu làm bài không hợp lệ.');
  const expected = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  if (!safeEqual(signature, expected)) throw apiError(401, 'Phiếu làm bài không hợp lệ.');
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw apiError(401, 'Phiếu làm bài không hợp lệ.');
    const expiresAt = Number(payload.ticketExpiresAt);
    if (!options.allowExpired && (!Number.isFinite(expiresAt) || expiresAt <= Date.now())) {
      throw apiError(410, 'Phiếu làm bài đã hết hạn.', { code: 'EXAM_ATTEMPT_TICKET_EXPIRED' });
    }
    return payload;
  } catch (error: any) {
    if (error?.status) throw error;
    throw apiError(401, 'Phiếu làm bài không hợp lệ.');
  }
}

function validateRecoverableTicket(ticket: any) {
  const startedAt = new Date(ticket.startedAt).getTime();
  const ticketExpiresAt = Number(ticket.ticketExpiresAt);
  if (!text(ticket.versionId, 180)
    || !text(ticket.clientRunId, 180)
    || !/^[a-f0-9]{64}$/i.test(String(ticket.runSecretHash || ''))
    || !Number.isFinite(startedAt)
    || startedAt > Date.now() + EXAM_TICKET_CLOCK_SKEW_MS) {
    throw apiError(401, 'Phiếu làm bài không hợp lệ.');
  }
  const originalExpiry = Number.isFinite(ticketExpiresAt) && ticketExpiresAt > startedAt
    ? ticketExpiresAt
    : startedAt + EXAM_TICKET_DEFAULT_TTL_MS;
  const defaultRecoveryEndsAt = originalExpiry + EXAM_TICKET_RENEWAL_GRACE_MS;
  const claimedRecoveryEndsAt = Number(ticket.ticketRecoveryEndsAt);
  const recoveryEndsAt = Number.isFinite(claimedRecoveryEndsAt) && claimedRecoveryEndsAt >= originalExpiry
    ? Math.min(claimedRecoveryEndsAt, defaultRecoveryEndsAt)
    : defaultRecoveryEndsAt;
  if (Date.now() >= recoveryEndsAt) {
    throw apiError(410, 'Lượt làm bài đã quá thời hạn khôi phục.', {
      code: 'EXAM_ATTEMPT_TICKET_RECOVERY_EXPIRED',
      recoverable: false,
    });
  }
  return { recoveryEndsAt };
}

async function resolveActor(
  req: express.Request,
  resolveGuestProfile: ExamRouterDependencies['resolveGuestProfile'],
  classInfo: { classId?: unknown; className?: unknown; verified?: boolean } = {},
) {
  if ((req as any).authBlocked) throw apiError(403, 'Tài khoản đã bị khóa.');
  if (req.user) {
    return { ownerKey: `user:${req.user.id}`, userId: req.user.id, guestId: '', studentName: req.user.name || 'Học sinh' };
  }
  const guestId = text(req.body?.guestId || req.query?.guestId || req.headers['x-guest-id'], 120);
  const studentName = text(req.body?.studentName || req.query?.studentName, 120);
  if (!guestId || !studentName) throw apiError(401, 'Vui lòng nhập tên học sinh trước khi làm bài.');
  const profile = await resolveGuestProfile(guestId, studentName, true, classInfo);
  return {
    ownerKey: `guest:${guestId}`,
    userId: '',
    guestId,
    studentName: profile.displayName || profile.name || studentName,
  };
}

async function findAssignment(db: any, token: string) {
  if (!token) return null;
  const snapshot = await db.collection('assignments').where('shareToken', '==', token).get();
  let match: any = null;
  snapshot.forEach((document: any) => {
    const candidate = { id: document.id, ...document.data() };
    if (!match && (candidate.shareToken === token || candidate.assignmentSlug === token)) match = candidate;
  });
  return match;
}

async function resolveAccess(db: any, set: any, req: express.Request) {
  if (!set || set.status !== 'published' || !set.publishedVersionId) throw apiError(404, 'Bộ đề chưa được xuất bản.');
  if (canManage(req.user, set)) return { assignment: null };
  const token = text(req.body?.shareToken || req.body?.accessToken || req.query?.shareToken || req.query?.accessToken, 240);
  if (token && set.shareToken && safeEqual(token, String(set.shareToken))) return { assignment: null };
  if (token) {
    const assignment = await findAssignment(db, token);
    const assignmentStatus = String(assignment?.status || 'active').toLowerCase();
    const resourceId = assignment?.resourceId || assignment?.examSetId;
    if (assignment?.resourceType === 'exam'
      && resourceId === set.id
      && !['draft', 'deleted', 'inactive', 'archived'].includes(assignmentStatus)) {
      return { assignment };
    }
  }
  if (set.visibility === 'public') return { assignment: null };
  throw apiError(403, 'Link bộ đề không hợp lệ hoặc đã hết quyền truy cập.');
}

function collectAssetFields(content: ExamPaperContent) {
  const fields: Array<{ assetId: string; apply: (url: string) => void; kind: 'image' | 'audio'; entityId: string; role: string }> = [];
  const add = (assetId: unknown, kind: 'image' | 'audio', entityId: string, role: string, apply: (url: string) => void) => {
    const value = text(assetId, 180);
    if (value) fields.push({ assetId: value, kind, entityId, role, apply });
  };
  const addDrawTokens = (layout: ExamPaperContent['parts'][number]['interactionLayout']) => {
    if (layout?.kind !== 'scene-draw-v1') return;
    layout.targets.forEach(target => add(target.tokenAssetId, 'image', target.id, 'draw-token', url => { target.tokenUrl = url; }));
  };
  const addReadingMedia = (owner: Pick<ExamPaperContent['parts'][number], 'examples' | 'readingScenes'>) => {
    (owner.examples || []).forEach((example, index) => {
      add(example.imageAssetId, 'image', `example-${index + 1}`, 'example-image', url => { example.imageUrl = url; });
      add(example.secondaryImageAssetId, 'image', `example-${index + 1}`, 'example-secondary-image', url => { example.secondaryImageUrl = url; });
    });
    (owner.readingScenes || []).forEach(scene => add(scene.imageAssetId, 'image', scene.id, 'reading-scene-image', url => { scene.imageUrl = url; }));
  };
  add(content.coverAssetId, 'image', 'paper', 'cover', url => { content.coverUrl = url; });
  content.parts.forEach(part => {
    add(part.imageAssetId, 'image', part.id, 'part-image', url => { part.imageUrl = url; });
    add(part.audioAssetId, 'audio', part.id, 'part-audio', url => { part.audioUrl = url; });
    addDrawTokens(part.interactionLayout);
    addReadingMedia(part);
    (part.blocks || []).forEach(block => {
      add(block.imageAssetId, 'image', block.id, 'block-image', url => { block.imageUrl = url; });
      add(block.audioAssetId, 'audio', block.id, 'block-audio', url => { block.audioUrl = url; });
      addDrawTokens(block.interactionLayout);
      addReadingMedia(block);
    });
    part.questions.forEach(question => {
      add(question.imageAssetId, 'image', question.id, 'question-image', url => { question.imageUrl = url; });
      add(question.secondaryImageAssetId, 'image', question.id, 'question-secondary-image', url => { question.secondaryImageUrl = url; });
      question.options.forEach(option => add(option.imageAssetId, 'image', option.id, 'option-image', url => { option.imageUrl = url; }));
    });
  });
  return fields;
}

async function resolveContentAssets(db: any, raw: ExamPaperContent, user: any) {
  const content = structuredClone(raw);
  const requireAssetIdForUrl = (assetId: unknown, url: unknown, label: string) => {
    if (text(url, 2_000) && !text(assetId, 180)) throw apiError(400, `${label} phải được chọn từ thư viện media.`);
  };
  const requireReadingMediaIds = (owner: Pick<ExamPaperContent['parts'][number], 'examples' | 'readingScenes'>, label: string) => {
    (owner.examples || []).forEach((example, index) => {
      requireAssetIdForUrl(example.imageAssetId, example.imageUrl, `${label}, example ${index + 1}`);
      requireAssetIdForUrl(example.secondaryImageAssetId, example.secondaryImageUrl, `${label}, ảnh phụ example ${index + 1}`);
    });
    (owner.readingScenes || []).forEach((scene, index) => requireAssetIdForUrl(scene.imageAssetId, scene.imageUrl, `${label}, reading scene ${index + 1}`));
  };
  const requireDrawTokenIds = (layout: ExamPaperContent['parts'][number]['interactionLayout'], label: string) => {
    if (layout?.kind !== 'scene-draw-v1') return;
    layout.targets.forEach((target, index) => requireAssetIdForUrl(target.tokenAssetId, target.tokenUrl, `${label}, ảnh Draw ${index + 1}`));
  };
  requireAssetIdForUrl(content.coverAssetId, content.coverUrl, 'Ảnh bìa');
  content.parts.forEach(part => {
    requireReadingMediaIds(part, `Part ${part.part}`);
    requireAssetIdForUrl(part.imageAssetId, part.imageUrl, `Ảnh Part ${part.part}`);
    requireAssetIdForUrl(part.audioAssetId, part.audioUrl, `Audio Part ${part.part}`);
    requireDrawTokenIds(part.interactionLayout, `Part ${part.part}`);
    (part.blocks || []).forEach(block => {
      requireReadingMediaIds(block, `Part ${part.part}, block ${block.block}`);
      requireAssetIdForUrl(block.imageAssetId, block.imageUrl, `Ảnh Part ${part.part}, dạng ${block.block}`);
      requireAssetIdForUrl(block.audioAssetId, block.audioUrl, `Audio Part ${part.part}, dạng ${block.block}`);
      requireDrawTokenIds(block.interactionLayout, `Part ${part.part}, dạng ${block.block}`);
    });
    part.questions.forEach(question => {
      requireAssetIdForUrl(question.imageAssetId, question.imageUrl, `Ảnh câu ${question.number}`);
      requireAssetIdForUrl(question.secondaryImageAssetId, question.secondaryImageUrl, `Ảnh phụ câu ${question.number}`);
      question.options.forEach(option => requireAssetIdForUrl(option.imageAssetId, option.imageUrl, `Ảnh lựa chọn ${option.label}`));
    });
  });
  const fields = collectAssetFields(content);
  const unique = new Map<string, any>();
  await Promise.all([...new Set(fields.map(item => item.assetId))].map(async assetId => {
    const snapshot = await db.collection('listening_assets').doc(assetId).get();
    if (!snapshot.exists) throw apiError(400, `Không tìm thấy media "${assetId}".`);
    const asset: any = { id: snapshot.id, ...snapshot.data() };
    if (asset.status !== 'active') throw apiError(400, `Media "${asset.name || asset.id}" đã bị lưu trữ.`);
    if (user?.role !== 'super_admin' && asset.ownerId !== user?.id) throw apiError(403, `Bạn không có quyền dùng media "${asset.name || asset.id}".`);
    unique.set(assetId, asset);
  }));
  fields.forEach(field => {
    const asset = unique.get(field.assetId);
    if (asset?.kind !== field.kind) throw apiError(400, `Media "${asset?.name || field.assetId}" không đúng loại ${field.kind}.`);
    field.apply(String(asset.url || ''));
  });
  return content;
}

function playableSet(set: any, version: any): ExamPlayableSet {
  return {
    ...publicSummary(set),
    versionId: version.id,
    versionNumber: version.versionNumber,
    content: sanitizeExamContentForStudent(version.content),
  } as ExamPlayableSet;
}

function attemptSummary(attempt: any): ExamCompletedAttempt {
  const { runSecretHash: _secret, ownerKey: _owner, userId: _user, guestId: _guest, ...safe } = attempt;
  return safe as ExamCompletedAttempt;
}

export function createExamRouter(dependencies: ExamRouterDependencies) {
  const { db, authenticateUser, authenticateOptionalUser, requireStaff, ticketSecret, resolveGuestProfile, logAudit, writingGrading } = dependencies;
  const router = express.Router();
  const draftLocks = new Map<string, Promise<void>>();

  const withDraftLock = async <T,>(setId: string, operation: () => Promise<T>): Promise<T> => {
    const previous = draftLocks.get(setId) || Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>(resolve => { release = resolve; });
    const queued = previous.then(() => current);
    draftLocks.set(setId, queued);
    await previous;
    try { return await operation(); } finally {
      release();
      if (draftLocks.get(setId) === queued) draftLocks.delete(setId);
    }
  };

  const runAiWritingGrade = async (attempt: any, detail: any, version: any) => {
    const pending = (detail.grade?.questions || []).find((question: any) => question.pendingManualReview && question.aiGradingStatus);
    if (!pending) return attempt;
    const canonical = version.content.parts.flatMap((part: any) => part.questions).find((question: any) => question.id === pending.questionId);
    const config = canonical?.writingGrading;
    if (!canonical || !config?.enabled) return attempt;
    const essay = typeof detail.answers?.[canonical.id] === 'string' ? detail.answers[canonical.id] : '';
    const processingAt = nowIso();
    const processingAttempt = { ...attempt, aiGradingStatus: 'processing', aiGradingMessage: 'Đang chấm Writing.', updatedAt: processingAt };
    const processingQuestions = detail.grade.questions.map((question: any) => question.questionId === canonical.id ? { ...question, aiGradingStatus: 'processing' } : question);
    const processingGrade = { ...detail.grade, questions: processingQuestions };
    const processingDetail = { ...detail, grade: processingGrade, questions: processingQuestions, updatedAt: processingAt };
    const processingBatch = db.batch();
    processingBatch.set(db.collection('exam_attempts').doc(attempt.id), processingAttempt);
    processingBatch.set(db.collection('exam_attempt_details').doc(attempt.id), processingDetail);
    await processingBatch.commit();
    try {
      const output = essay.trim() ? await writingGrading?.grade({
        providerId: config.providerId,
        taskContext: config.taskContext,
        gradingInstructions: config.gradingInstructions,
        prompt: canonical.prompt,
        essay,
        minWords: Number(canonical.minWords || 1),
        maxWords: Number(canonical.maxWords || 50),
      }) : { providerId: config.providerId, score: 0, sentenceCount: 0, grammarErrors: [], vocabularyErrors: [], feedback: 'Bài viết để trống nên chưa đáp ứng yêu cầu. Học sinh cần viết nội dung theo đề bài. Điểm Writing là 0/10. Giáo viên có thể chấm tay nếu cần.' };
      if (!output) throw new Error('Nhà cung cấp chấm Writing chưa được cấu hình.');
      const finalized = applyAiWritingGrade(processingGrade, canonical.id, output);
      const timestamp = nowIso();
      const nextAttempt = { ...processingAttempt, status: finalized.status, score: finalized.score, pendingManualCount: finalized.pendingManualCount, aiGradingStatus: 'completed', aiGradingMessage: 'Đã chấm Writing.', updatedAt: timestamp };
      const nextDetail = { ...processingDetail, grade: finalized, questions: finalized.questions, finalAwarded: finalized.objectiveAwarded + finalized.manualAwarded, finalMaximum: finalized.objectiveMaximum + finalized.manualMaximum, updatedAt: timestamp };
      const batch = db.batch();
      batch.set(db.collection('exam_attempts').doc(attempt.id), nextAttempt);
      batch.set(db.collection('exam_attempt_details').doc(attempt.id), nextDetail);
      await batch.commit();
      return nextAttempt;
    } catch (error) {
      const failureReason = describeWritingGradingFailure(error, String(config.providerId || ''));
      console.error('[Exam Writing] AI grading failed', {
        attemptId: attempt.id,
        providerId: config.providerId,
        errorName: error instanceof Error ? error.name : 'UnknownError',
        errorMessage: error instanceof Error ? error.message : String(error || ''),
      });
      const failed = markAiWritingFailed(processingGrade, canonical.id);
      const timestamp = nowIso();
      const nextAttempt = { ...processingAttempt, status: 'pending_review', aiGradingStatus: 'failed', aiGradingMessage: `${failureReason} Giáo viên có thể thử lại hoặc chấm tay.`, updatedAt: timestamp };
      const nextDetail = { ...processingDetail, grade: failed, questions: failed.questions, updatedAt: timestamp };
      const batch = db.batch();
      batch.set(db.collection('exam_attempts').doc(attempt.id), nextAttempt);
      batch.set(db.collection('exam_attempt_details').doc(attempt.id), nextDetail);
      await batch.commit();
      return nextAttempt;
    }
  };

  router.get('/admin/sets', authenticateUser, requireStaff, async (req, res) => {
    try {
      const snapshot = await db.collection('exam_sets').get();
      const rows: any[] = [];
      snapshot.forEach((document: any) => {
        const set = { id: document.id, ...document.data() };
        if (set.status !== 'archived' && canManage(req.user, set)) rows.push(set);
      });
      rows.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
      res.json(rows);
    } catch (error) { sendError(res, error); }
  });

  router.get('/modules/:moduleId/papers/:paperId/sets', authenticateOptionalUser, async (req, res) => {
    try {
      const { moduleId, paperId } = routeIdentity(req);
      const snapshot = await db.collection('exam_sets').get();
      const rows: any[] = [];
      snapshot.forEach((document: any) => {
        const set = { id: document.id, ...document.data() };
        if (set.moduleId === moduleId && set.paperId === paperId && set.status === 'published' && set.visibility === 'public') rows.push(publicSummary(set));
      });
      rows.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
      res.json(rows);
    } catch (error) { sendError(res, error); }
  });

  router.get('/admin/modules/:moduleId/papers/:paperId/sets', authenticateUser, requireStaff, async (req, res) => {
    try {
      const { moduleId, paperId } = routeIdentity(req);
      const snapshot = await db.collection('exam_sets').get();
      const rows: any[] = [];
      snapshot.forEach((document: any) => {
        const set = { id: document.id, ...document.data() };
        if (set.moduleId === moduleId && set.paperId === paperId && set.status !== 'archived' && canManage(req.user, set)) rows.push(set);
      });
      rows.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
      res.json(rows);
    } catch (error) { sendError(res, error); }
  });

  router.post('/admin/modules/:moduleId/papers/:paperId/sets', authenticateUser, requireStaff, async (req, res) => {
    try {
      if (!req.user) throw apiError(401, 'Vui lòng đăng nhập.');
      const { moduleId, paperId, definition } = routeIdentity(req);
      if (req.body?.content?.moduleId !== moduleId || req.body?.content?.paperId !== paperId) throw apiError(400, 'Nội dung không khớp module/paper trên URL.');
      const content = normalizeFixedExamContent(await resolveContentAssets(db, req.body.content as ExamPaperContent, req.user));
      const timestamp = nowIso();
      const setId = id('examset');
      const set = {
        id: setId,
        moduleId,
        paperId,
        schemaVersion: content.schemaVersion,
        title: content.title,
        description: content.description,
        level: content.level || definition.level,
        ownerId: req.user.id,
        visibility: 'draft',
        status: 'draft',
        draftContent: content,
        draftRevision: 1,
        validationErrors: validateExamPaperContent(content),
        coverUrl: content.coverUrl || '',
        timeLimitMinutes: content.timeLimitMinutes,
        shareToken: crypto.randomBytes(24).toString('base64url'),
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await db.collection('exam_sets').doc(setId).set(set);
      await logAudit?.(req.user.id, req.user.name, req.user.email, 'CREATE_EXAM_SET', `${moduleId}/${paperId}: ${set.title}`);
      res.status(201).json(set);
    } catch (error) { sendError(res, error); }
  });

  router.get('/admin/modules/:moduleId/papers/:paperId/sets/:setId', authenticateUser, requireStaff, async (req, res) => {
    try {
      const { moduleId, paperId } = routeIdentity(req);
      const set = await getSet(db, req.params.setId);
      assertRouteSet(set, moduleId, paperId);
      if (!canManage(req.user, set)) throw apiError(404, 'Không tìm thấy bộ đề.');
      const versionsSnapshot = await db.collection('exam_set_versions').where('setId', '==', set.id).get();
      const versions = versionsSnapshot.docs.map((document: any) => ({ id: document.id, ...document.data() }));
      versions.sort((a: any, b: any) => Number(b.versionNumber) - Number(a.versionNumber));
      res.json({ ...set, versions });
    } catch (error) { sendError(res, error); }
  });

  const saveDraft = async (req: express.Request, res: express.Response, autosave: boolean) => {
    try {
      if (!req.user) throw apiError(401, 'Vui lòng đăng nhập.');
      const { moduleId, paperId } = routeIdentity(req);
      await withDraftLock(req.params.setId, async () => {
        const set = await getSet(db, req.params.setId);
        assertRouteSet(set, moduleId, paperId);
        if (!canManage(req.user, set)) throw apiError(404, 'Không tìm thấy bộ đề.');
        const baseRevision = Number(req.body?.baseRevision);
        if (!Number.isInteger(baseRevision) || baseRevision !== Number(set.draftRevision || 0)) {
          throw apiError(409, 'Bản nháp đã được sửa ở phiên khác.', { code: 'EXAM_DRAFT_REVISION_CONFLICT', currentRevision: set.draftRevision || 0 });
        }
        const raw = req.body?.content as ExamPaperContent;
        if (raw?.moduleId !== moduleId || raw?.paperId !== paperId) throw apiError(400, 'Nội dung không khớp module/paper trên URL.');
        const content = normalizeFixedExamContent(await resolveContentAssets(db, raw, req.user));
        const revision = Number(set.draftRevision || 0) + 1;
        const updatedAt = nowIso();
        const validationErrors = validateExamPaperContent(content);
        const next = {
          ...set,
          schemaVersion: content.schemaVersion,
          title: content.title,
          description: content.description,
          level: content.level,
          coverUrl: content.coverUrl || '',
          timeLimitMinutes: content.timeLimitMinutes,
          visibility: ['draft', 'public', 'assignment'].includes(req.body?.visibility) ? req.body.visibility : set.visibility,
          draftContent: content,
          draftRevision: revision,
          validationErrors,
          updatedAt,
        };
        await db.collection('exam_sets').doc(set.id).set(next);
        if (autosave) res.json({ draftRevision: revision, updatedAt, validationErrors });
        else res.json(next);
      });
    } catch (error) { sendError(res, error); }
  };
  router.put('/admin/modules/:moduleId/papers/:paperId/sets/:setId', authenticateUser, requireStaff, (req, res) => void saveDraft(req, res, false));
  router.post('/admin/modules/:moduleId/papers/:paperId/sets/:setId/draft/autosave', authenticateUser, requireStaff, (req, res) => void saveDraft(req, res, true));

  router.post('/admin/modules/:moduleId/papers/:paperId/sets/:setId/publish', authenticateUser, requireStaff, async (req, res) => {
    try {
      if (!req.user) throw apiError(401, 'Vui lòng đăng nhập.');
      const { moduleId, paperId } = routeIdentity(req);
      const result = await withDraftLock(req.params.setId, async () => {
        const set = await getSet(db, req.params.setId);
        assertRouteSet(set, moduleId, paperId);
        if (!canManage(req.user, set)) throw apiError(404, 'Không tìm thấy bộ đề.');
        const resolvedContent = normalizeFixedExamContent(await resolveContentAssets(db, set.draftContent, req.user));
        const errors = validateExamPaperContent(resolvedContent);
        if (errors.length) throw apiError(400, 'Bộ đề chưa đủ điều kiện xuất bản.', errors);
        const versionsSnapshot = await db.collection('exam_set_versions').where('setId', '==', set.id).get();
        const versionNumber = Math.max(0, ...versionsSnapshot.docs.map((document: any) => Number(document.data()?.versionNumber || 0))) + 1;
        const timestamp = nowIso();
        const version = {
          id: id('examver'),
          setId: set.id,
          moduleId,
          paperId,
          versionNumber,
          schemaVersion: resolvedContent.schemaVersion,
          gradingVersion: EXAM_GRADING_VERSION,
          status: 'published',
          content: structuredClone(resolvedContent),
          createdBy: req.user.id,
          createdAt: timestamp,
          updatedAt: timestamp,
        };
        const batch = db.batch();
        batch.set(db.collection('exam_set_versions').doc(version.id), version);
        for (const document of versionsSnapshot.docs) {
          if (document.data()?.status === 'published') batch.update(document.ref, { status: 'superseded', updatedAt: timestamp });
        }
        const published = {
          ...set,
          status: 'published',
          publishedVersionId: version.id,
          publishedVersionNumber: versionNumber,
          validationErrors: [],
          updatedAt: timestamp,
        };
        batch.set(db.collection('exam_sets').doc(set.id), published);
        collectAssetFields(resolvedContent).forEach((reference, referenceIndex) => {
          const usageId = `examusage-${sha256(`${version.id}:${reference.assetId}:${reference.entityId}:${reference.role}:${referenceIndex}`).slice(0, 32)}`;
          batch.set(db.collection('exam_asset_usages').doc(usageId), {
            id: usageId,
            assetId: reference.assetId,
            setId: set.id,
            versionId: version.id,
            entityId: reference.entityId,
            role: reference.role,
            createdAt: timestamp,
            updatedAt: timestamp,
          });
        });
        await batch.commit();
        return { set: publicSummary(published), version: { id: version.id, versionNumber } };
      });
      await logAudit?.(req.user.id, req.user.name, req.user.email, 'PUBLISH_EXAM_SET', `${moduleId}/${paperId}: ${result.set.title}`);
      res.json(result);
    } catch (error) { sendError(res, error); }
  });

  router.post('/admin/modules/:moduleId/papers/:paperId/sets/:setId/clone', authenticateUser, requireStaff, async (req, res) => {
    try {
      if (!req.user) throw apiError(401, 'Vui lòng đăng nhập.');
      const { moduleId, paperId } = routeIdentity(req);
      const source = await getSet(db, req.params.setId);
      assertRouteSet(source, moduleId, paperId);
      if (!canManage(req.user, source)) throw apiError(404, 'Không tìm thấy bộ đề.');
      const timestamp = nowIso();
      const clone = {
        ...source,
        id: id('examset'),
        title: `${source.title} (Bản sao)`,
        ownerId: req.user.id,
        status: 'draft',
        visibility: 'draft',
        publishedVersionId: undefined,
        publishedVersionNumber: undefined,
        draftContent: { ...structuredClone(source.draftContent), title: `${source.title} (Bản sao)` },
        draftRevision: 1,
        shareToken: crypto.randomBytes(24).toString('base64url'),
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await db.collection('exam_sets').doc(clone.id).set(clone);
      res.status(201).json(clone);
    } catch (error) { sendError(res, error); }
  });

  router.delete('/admin/modules/:moduleId/papers/:paperId/sets/:setId', authenticateUser, requireStaff, async (req, res) => {
    try {
      const { moduleId, paperId } = routeIdentity(req);
      const set = await getSet(db, req.params.setId);
      assertRouteSet(set, moduleId, paperId);
      if (!canManage(req.user, set)) throw apiError(404, 'Không tìm thấy bộ đề.');
      await db.collection('exam_sets').doc(set.id).update({ status: 'archived', updatedAt: nowIso() });
      res.json({ success: true, recoverable: true });
    } catch (error) { sendError(res, error); }
  });

  router.get('/admin/modules/:moduleId/papers/:paperId/sets/:setId/results', authenticateUser, requireStaff, async (req, res) => {
    try {
      const { moduleId, paperId } = routeIdentity(req);
      const set = await getSet(db, req.params.setId);
      assertRouteSet(set, moduleId, paperId);
      if (!canManage(req.user, set)) throw apiError(404, 'Không tìm thấy bộ đề.');
      const snapshot = await db.collection('exam_attempts').where('setId', '==', set.id).get();
      const rows = await Promise.all(snapshot.docs.map(async (document: any) => {
        const attempt: any = { id: document.id, ...document.data() };
        const detailSnapshot = await db.collection('exam_attempt_details').doc(attempt.id).get();
        return { ...attemptSummary(attempt), questions: detailSnapshot.exists ? detailSnapshot.data()?.questions || [] : [] };
      }));
      rows.sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt)));
      res.json({ set: publicSummary(set), attempts: rows });
    } catch (error) { sendError(res, error); }
  });

  router.get('/admin/writing-grading/providers', authenticateUser, requireStaff, (_req, res) => {
    res.json({ providers: writingGrading?.providers || [] });
  });

  router.post('/admin/modules/:moduleId/papers/:paperId/sets/:setId/attempts/:attemptId/manual-grade', authenticateUser, requireStaff, async (req, res) => {
    try {
      const { moduleId, paperId } = routeIdentity(req);
      const set = await getSet(db, req.params.setId);
      assertRouteSet(set, moduleId, paperId);
      if (!canManage(req.user, set)) throw apiError(404, 'Không tìm thấy bộ đề.');
      const attemptSnapshot = await db.collection('exam_attempts').doc(req.params.attemptId).get();
      if (!attemptSnapshot.exists) throw apiError(404, 'Không tìm thấy lượt làm bài.');
      const attempt: any = { id: attemptSnapshot.id, ...attemptSnapshot.data() };
      if (attempt.setId !== set.id || attempt.status !== 'pending_review') throw apiError(409, 'Lượt làm bài không ở trạng thái chờ chấm.');
      const detailSnapshot = await db.collection('exam_attempt_details').doc(attempt.id).get();
      if (!detailSnapshot.exists) throw apiError(404, 'Không tìm thấy chi tiết lượt làm bài.');
      const detail: any = { id: detailSnapshot.id, ...detailSnapshot.data() };
      const grades = req.body?.grades && typeof req.body.grades === 'object' ? req.body.grades : {};
      const pendingQuestions = (detail.grade?.questions || []).filter((question: any) => question.pendingManualReview);
      const invalidGrade = pendingQuestions.find((question: any) => {
        const value = Number(grades[question.questionId]);
        return !Object.prototype.hasOwnProperty.call(grades, question.questionId)
          || !Number.isFinite(value)
          || value < 0
          || value > Number(question.maxPoints || 0)
          || (moduleId === 'ket' && paperId === 'reading-writing' && question.part === 9 && !Number.isInteger(value));
      });
      if (invalidGrade) throw apiError(400, `Điểm Writing cho câu ${invalidGrade.number} bị thiếu hoặc ngoài phạm vi cho phép.`);
      const finalized = applyManualExamGrades(detail.grade, grades);
      const timestamp = nowIso();
      const nextAttempt = { ...attempt, status: 'completed', score: finalized.score, pendingManualCount: 0, aiGradingStatus: attempt.aiGradingStatus === 'failed' ? 'failed' : attempt.aiGradingStatus, aiGradingMessage: 'Giáo viên đã chấm Writing.', reviewedBy: req.user?.id, reviewedAt: timestamp, updatedAt: timestamp };
      const nextDetail = { ...detail, grade: finalized, questions: finalized.questions, finalAwarded: finalized.objectiveAwarded + finalized.manualAwarded, finalMaximum: finalized.objectiveMaximum + finalized.manualMaximum, updatedAt: timestamp };
      const batch = db.batch();
      batch.set(db.collection('exam_attempts').doc(attempt.id), nextAttempt);
      batch.set(db.collection('exam_attempt_details').doc(attempt.id), nextDetail);
      await batch.commit();
      res.json(attemptSummary(nextAttempt));
    } catch (error) { sendError(res, error); }
  });

  router.post('/admin/modules/:moduleId/papers/:paperId/sets/:setId/attempts/:attemptId/retry-writing-grade', authenticateUser, requireStaff, async (req, res) => {
    try {
      const { moduleId, paperId } = routeIdentity(req);
      const set = await getSet(db, req.params.setId);
      assertRouteSet(set, moduleId, paperId);
      if (!canManage(req.user, set)) throw apiError(404, 'Không tìm thấy bộ đề.');
      const attemptSnapshot = await db.collection('exam_attempts').doc(req.params.attemptId).get();
      if (!attemptSnapshot.exists) throw apiError(404, 'Không tìm thấy lượt làm bài.');
      const attempt: any = { id: attemptSnapshot.id, ...attemptSnapshot.data() };
      if (attempt.setId !== set.id || attempt.status !== 'pending_review') throw apiError(409, 'Lượt làm bài không ở trạng thái chờ chấm.');
      const detailSnapshot = await db.collection('exam_attempt_details').doc(attempt.id).get();
      const version = await getVersion(db, attempt.versionId);
      if (!detailSnapshot.exists || !version || version.setId !== set.id) throw apiError(404, 'Không tìm thấy dữ liệu chấm Writing.');
      const next = await runAiWritingGrade(attempt, { id: detailSnapshot.id, ...detailSnapshot.data() }, version);
      res.json(attemptSummary(next));
    } catch (error) { sendError(res, error); }
  });

  router.get('/modules/:moduleId/papers/:paperId/sets/:setId', authenticateOptionalUser, async (req, res) => {
    try {
      const { moduleId, paperId } = routeIdentity(req);
      const set = await getSet(db, req.params.setId);
      assertRouteSet(set, moduleId, paperId);
      await resolveAccess(db, set, req);
      const version = await getVersion(db, set.publishedVersionId);
      if (!version || version.setId !== set.id) throw apiError(404, 'Không tìm thấy phiên bản đã xuất bản.');
      res.json(playableSet(set, version));
    } catch (error) { sendError(res, error); }
  });

  router.post('/modules/:moduleId/papers/:paperId/sets/:setId/attempts/prepare', authenticateOptionalUser, async (req, res) => {
    try {
      const { moduleId, paperId } = routeIdentity(req);
      const set = await getSet(db, req.params.setId);
      assertRouteSet(set, moduleId, paperId);
      const access = await resolveAccess(db, set, req);
      const actor = await resolveActor(req, resolveGuestProfile, {
        classId: access.assignment?.classId,
        className: access.assignment?.className,
        verified: Boolean(access.assignment),
      });
      const clientRunId = text(req.body?.clientRunId, 180);
      const runSecret = text(req.body?.runSecret, 300);
      if (!clientRunId || runSecret.length < 20) throw apiError(400, 'Thông tin lượt làm bài không hợp lệ.');
      const startedAt = nowIso();
      const deadlineAt = set.timeLimitMinutes ? new Date(Date.now() + Number(set.timeLimitMinutes) * 60_000).toISOString() : undefined;
      const ticketExpiresAt = Date.now() + Math.max(EXAM_TICKET_DEFAULT_TTL_MS, Number(set.timeLimitMinutes || 0) * 60_000 + 60 * 60_000);
      const ticket = encodeTicket({
        moduleId,
        paperId,
        setId: set.id,
        versionId: set.publishedVersionId,
        ownerKey: actor.ownerKey,
        clientRunId,
        runSecretHash: sha256(runSecret),
        assignmentId: access.assignment?.id || '',
        classId: access.assignment?.classId || '',
        className: access.assignment?.className || '',
        assignmentTitle: access.assignment?.title || '',
        assignmentDueAt: access.assignment?.dueDate || '',
        startedAt,
        deadlineAt,
        ticketExpiresAt,
        ticketRecoveryEndsAt: ticketExpiresAt + EXAM_TICKET_RENEWAL_GRACE_MS,
      }, ticketSecret);
      res.json({ ticket, startedAt, deadlineAt, versionId: set.publishedVersionId });
    } catch (error) { sendError(res, error); }
  });

  router.post('/modules/:moduleId/papers/:paperId/sets/:setId/attempts/renew', authenticateOptionalUser, async (req, res) => {
    try {
      const { moduleId, paperId } = routeIdentity(req);
      const ticket = decodeTicket(req.body?.ticket, ticketSecret, { allowExpired: true });
      if (ticket.moduleId !== moduleId || ticket.paperId !== paperId || ticket.setId !== req.params.setId) throw apiError(401, 'Phiếu làm bài không khớp bộ đề.');
      const set = await getSet(db, req.params.setId);
      assertRouteSet(set, moduleId, paperId);
      const actor = await resolveActor(req, resolveGuestProfile, { classId: ticket.classId, className: ticket.className, verified: Boolean(ticket.assignmentId) });
      const runSecret = text(req.body?.runSecret, 300);
      if (actor.ownerKey !== ticket.ownerKey || !safeEqual(String(ticket.runSecretHash || ''), sha256(runSecret))) {
        throw apiError(401, 'Không có quyền khôi phục lượt làm bài này.');
      }
      const { recoveryEndsAt } = validateRecoverableTicket(ticket);
      const version = await getVersion(db, ticket.versionId);
      if (!version || version.setId !== set.id || version.moduleId !== moduleId || version.paperId !== paperId) throw apiError(409, 'Phiên bản đề thi không còn hợp lệ.');
      const renewedTicket = encodeTicket({
        ...ticket,
        ticketExpiresAt: Math.min(Date.now() + EXAM_TICKET_RENEWAL_TTL_MS, recoveryEndsAt),
        ticketRecoveryEndsAt: recoveryEndsAt,
      }, ticketSecret);
      res.json({
        ticket: renewedTicket,
        clientRunId: ticket.clientRunId,
        versionId: ticket.versionId,
        startedAt: ticket.startedAt,
        ...(ticket.deadlineAt ? { deadlineAt: ticket.deadlineAt } : {}),
      });
    } catch (error) { sendError(res, error); }
  });

  router.post('/modules/:moduleId/papers/:paperId/sets/:setId/attempts/submit', authenticateOptionalUser, async (req, res) => {
    try {
      const { moduleId, paperId } = routeIdentity(req);
      const ticket = decodeTicket(req.body?.ticket, ticketSecret);
      if (ticket.moduleId !== moduleId || ticket.paperId !== paperId || ticket.setId !== req.params.setId) throw apiError(401, 'Phiếu làm bài không khớp bộ đề.');
      const set = await getSet(db, req.params.setId);
      assertRouteSet(set, moduleId, paperId);
      const actor = await resolveActor(req, resolveGuestProfile, { classId: ticket.classId, className: ticket.className, verified: Boolean(ticket.assignmentId) });
      const runSecret = text(req.body?.runSecret, 300);
      if (actor.ownerKey !== ticket.ownerKey || !safeEqual(String(ticket.runSecretHash || ''), sha256(runSecret))) throw apiError(401, 'Không có quyền nộp lượt làm bài này.');
      const attemptId = `examattempt-${sha256(`${actor.ownerKey}:${moduleId}:${paperId}:${set.id}:${ticket.clientRunId}`).slice(0, 40)}`;
      const existingSnapshot = await db.collection('exam_attempts').doc(attemptId).get();
      if (existingSnapshot.exists) {
        const existing: any = { id: existingSnapshot.id, ...existingSnapshot.data() };
        if (!safeEqual(existing.runSecretHash, sha256(runSecret))) throw apiError(404, 'Không tìm thấy lượt làm bài.');
        return res.json(attemptSummary(existing));
      }
      const version = await getVersion(db, ticket.versionId);
      if (!version || version.setId !== set.id || version.moduleId !== moduleId || version.paperId !== paperId) throw apiError(409, 'Phiên bản đề thi không còn hợp lệ.');
      const answers: ExamAnswers = sanitizeExamAnswers(req.body?.answers, version.content);
      const grade = gradeExamAttempt(version.content, answers);
      const completedAt = nowIso();
      const durationSeconds = Math.max(0, Math.floor((new Date(completedAt).getTime() - new Date(ticket.startedAt).getTime()) / 1000));
      // The deadline ends editing, but must never make the signed attempt
      // impossible to submit. The ticket has its own expiry and remains the
      // authority for retrying the same idempotent learning run.
      const timedOut = Boolean(ticket.deadlineAt && Date.now() >= new Date(ticket.deadlineAt).getTime());
      const attempt = {
        id: attemptId,
        moduleId,
        paperId,
        setId: set.id,
        setTitle: set.title,
        versionId: version.id,
        ownerKey: actor.ownerKey,
        userId: actor.userId,
        guestId: actor.guestId,
        studentName: actor.studentName,
        assignmentId: ticket.assignmentId || '',
        assignmentTitle: ticket.assignmentTitle || '',
        assignmentDueAt: ticket.assignmentDueAt || '',
        classId: ticket.classId || '',
        className: ticket.className || '',
        clientRunId: ticket.clientRunId,
        runSecretHash: sha256(runSecret),
        gradingVersion: EXAM_GRADING_VERSION,
        status: grade.status,
        score: grade.score,
        objectiveScore: grade.objectiveScore,
        correctCount: grade.correctCount,
        incorrectCount: grade.incorrectCount,
        unansweredCount: grade.unansweredCount,
        totalCount: grade.totalCount,
        pendingManualCount: grade.pendingManualCount,
        ...(grade.questions.some(question => question.aiGradingStatus) ? { aiGradingStatus: 'queued', aiGradingMessage: 'Đã xếp hàng chấm Writing.' } : {}),
        startedAt: ticket.startedAt,
        completedAt,
        durationSeconds,
        timedOut,
        createdAt: completedAt,
        updatedAt: completedAt,
      };
      const detail = {
        id: attemptId,
        attemptId,
        setId: set.id,
        versionId: version.id,
        answers,
        grade,
        questions: grade.questions,
        objectiveAwarded: grade.objectiveAwarded,
        objectiveMaximum: grade.objectiveMaximum,
        questionSnapshots: version.content.parts.flatMap((part: any) => part.questions.map((question: any) => ({
          questionId: question.id,
          part: part.part,
          number: question.number,
          type: question.type,
          prompt: question.prompt,
          rubric: question.rubric,
        }))),
        optionSnapshots: version.content.parts.flatMap((part: any) => part.questions.map((question: any) => ({ questionId: question.id, options: question.options }))),
        transcripts: version.content.parts.flatMap((part: any) => {
          const transcript = text(part.audioTranscript, 20_000);
          return transcript ? [{ part: part.part, text: transcript }] : [];
        }),
        sceneDrawTargets: version.content.parts.flatMap((part: any) => examPartUnits(part).flatMap(unit => (
          unit.interactionLayout?.kind === 'scene-draw-v1'
            ? unit.interactionLayout.targets.map(target => ({
                part: part.part,
                questionId: target.questionId,
                object: target.object,
                label: target.label,
                ...(target.tokenUrl ? { tokenUrl: target.tokenUrl } : {}),
                targetRegion: target.targetRegion,
              }))
            : []
        ))),
        reviewPolicy: { showReviewAfterSubmit: version.content.showReviewAfterSubmit === true, policyVersion: 1 },
        createdAt: completedAt,
        updatedAt: completedAt,
      };
      const batch = db.batch();
      batch.set(db.collection('exam_attempts').doc(attemptId), attempt);
      batch.set(db.collection('exam_attempt_details').doc(attemptId), detail);
      await batch.commit();
      const completedAttempt = grade.questions.some(question => question.aiGradingStatus)
        ? await runAiWritingGrade(attempt, detail, version)
        : attempt;
      res.status(201).json(attemptSummary(completedAttempt));
    } catch (error) { sendError(res, error); }
  });

  router.get('/modules/:moduleId/papers/:paperId/sets/:setId/attempts/:attemptId/review', authenticateOptionalUser, async (req, res) => {
    try {
      const { moduleId, paperId } = routeIdentity(req);
      const attemptSnapshot = await db.collection('exam_attempts').doc(req.params.attemptId).get();
      if (!attemptSnapshot.exists) throw apiError(404, 'Không tìm thấy lượt làm bài.');
      const attempt: any = { id: attemptSnapshot.id, ...attemptSnapshot.data() };
      if (attempt.setId !== req.params.setId || attempt.moduleId !== moduleId || attempt.paperId !== paperId) throw apiError(404, 'Không tìm thấy lượt làm bài.');
      const staff = isStaff(req.user);
      if (staff) {
        const set = await getSet(db, attempt.setId);
        if (!canManage(req.user, set)) throw apiError(404, 'Không tìm thấy lượt làm bài.');
      }
      if (!staff) {
        const actor = await resolveActor(req, resolveGuestProfile);
        if (actor.ownerKey !== attempt.ownerKey) throw apiError(404, 'Không tìm thấy lượt làm bài.');
        if (actor.guestId) {
          const secret = text(req.headers['x-exam-run-secret'], 300);
          if (!secret || !safeEqual(sha256(secret), attempt.runSecretHash)) throw apiError(404, 'Không tìm thấy lượt làm bài.');
        }
      }
      const detailSnapshot = await db.collection('exam_attempt_details').doc(attempt.id).get();
      if (!detailSnapshot.exists) throw apiError(404, 'Không tìm thấy chi tiết lượt làm bài.');
      const detail = detailSnapshot.data();
      if (!staff && (attempt.status !== 'completed' || detail?.reviewPolicy?.showReviewAfterSubmit !== true)) throw apiError(403, 'Giáo viên chưa cho phép xem đáp án sau khi nộp.');
      res.json({ attempt: attemptSummary(attempt), questions: detail?.questions || [], transcripts: detail?.transcripts || [], sceneDrawTargets: detail?.sceneDrawTargets || [] });
    } catch (error) { sendError(res, error); }
  });

  router.post('/admin/modules/:moduleId/papers/:paperId/smart-import/validate', authenticateUser, requireStaff, async (req, res) => {
    try {
      const { definition } = routeIdentity(req);
      const partIndex = Number(req.body?.partIndex);
      const candidate = req.body?.part;
      const currentPart = req.body?.currentPart;
      if (!Number.isInteger(partIndex) || partIndex < 0 || partIndex >= definition.parts.length || !candidate) throw apiError(400, 'Part Smart Import không hợp lệ.');
      if (!currentPart || typeof currentPart !== 'object' || !Array.isArray(currentPart.questions) || currentPart.part !== partIndex + 1) {
        throw apiError(400, 'Bản nháp Part hiện tại không hợp lệ.');
      }
      const normalized = normalizeExamSmartImportPart(currentPart, candidate, definition.parts[partIndex]);
      if (normalized.errors.length) throw apiError(400, 'Dữ liệu Smart Import chưa hợp lệ.', normalized.errors);
      const validationPart = structuredClone(normalized.part);
      if (definition.parts[partIndex].requiresAudio && !validationPart.audioAssetId) {
        validationPart.audioAssetId = 'smart-import-placeholder-audio';
      }
      const shell: ExamPaperContent = {
        schemaVersion: 1,
        moduleId: definition.moduleId,
        paperId: definition.paperId,
        title: 'Smart Import validation',
        description: '',
        level: definition.level,
        showReviewAfterSubmit: true,
        parts: definition.parts.map((partDefinition, index) => index === partIndex ? validationPart : ({
          id: `placeholder-${index}`,
          part: index + 1,
          title: partDefinition.title,
          instruction: partDefinition.instruction,
          ...(partDefinition.requiresAudio ? { audioAssetId: 'smart-import-placeholder-audio' } : {}),
          questions: Array.from({ length: partDefinition.questionCount }, (_, questionIndex) => ({
            id: `placeholder-${index}-${questionIndex}`,
            number: questionIndex + 1,
            type: partDefinition.longWriting ? 'long-writing' : 'short-answer',
            prompt: 'Placeholder',
            options: [],
            correctOptionIds: [],
            acceptedAnswers: partDefinition.longWriting ? [] : ['placeholder'],
            points: 1,
            ...(partDefinition.longWriting ? { rubric: 'Placeholder rubric' } : {}),
          })),
        })),
      };
      const validationMessages = validateExamPaperContent(shell).filter(error => error.startsWith(`Part ${partIndex + 1}`));
      const deferredAnswerMessages = validationMessages.filter(error => error.includes('chưa xác nhận đáp án đúng')
        || error.includes('chưa nhập đáp án được chấp nhận')
        || error.includes('phải có đúng một đáp án đúng'));
      const errors = validationMessages.filter(error => !deferredAnswerMessages.includes(error));
      if (errors.length) throw apiError(400, 'Dữ liệu Smart Import chưa hợp lệ.', errors);
      res.json({ part: normalized.part, warnings: [...normalized.warnings, ...deferredAnswerMessages], validated: true });
    } catch (error) { sendError(res, error); }
  });

  return router;
}
