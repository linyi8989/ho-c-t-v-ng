import crypto from 'crypto';
import express from 'express';
import fs from 'fs';
import path from 'path';
import type { ListeningAsset } from '../../features/listening/types.js';
import {
  getMoverReadingWritingSmartImportRoleDefinitions,
  type MoverReadingWritingSmartImportPartId,
  type MoverReadingWritingSmartImportProviderDefinition,
  type MoverReadingWritingSmartImportProviderPreference,
  type MoverReadingWritingSmartImportRequestSource,
  type MoverReadingWritingSmartImportSourceRole,
} from '../../features/mover-reading-writing/smart-import/types.js';
import type {
  MoverReadingWritingAnswers,
  MoverReadingWritingContent,
  MoverReadingWritingPart,
  MoverReadingWritingPlayableSet,
} from '../../features/mover-reading-writing/types.js';
import {
  MOVER_READING_WRITING_PAPER_ID,
  MOVER_READING_WRITING_SCHEMA_VERSION,
} from '../../features/mover-reading-writing/types.js';
import {
  isSupportedMoverReadingWritingSchemaVersion,
  normalizeMoverReadingWritingContent,
} from '../../features/mover-reading-writing/compatibility.js';
import {
  gradeMoverReadingWritingAttempt,
  MOVER_READING_WRITING_GRADING_VERSION,
} from './moverReadingWritingGrader.js';
import { buildMoverReadingWritingVisualReviewSnapshot } from './moverReadingWritingReview.js';
import {
  sanitizeMoverReadingWritingAnswers,
  sanitizeMoverReadingWritingContentForStudent,
  validateMoverReadingWritingContent,
} from './moverReadingWritingValidation.js';
import { createListeningPdfTransientSourceStore } from '../listening-pdf-import/transientSources.js';
import type {
  SmartImportImageInput,
  SmartImportVisionAnalyzer,
} from '../listening-smart-import/service.js';
import { createMoverReadingWritingSmartImportCandidate } from './moverReadingWritingSmartImportService.js';

type Middleware = express.RequestHandler;

export interface MoverReadingWritingRouterDependencies {
  db: any;
  authenticateUser: Middleware;
  authenticateOptionalUser: Middleware;
  requireStaff: Middleware;
  ticketSecret: string;
  mediaDir?: string;
  resolveGuestProfile: (
    guestId: unknown,
    studentName: unknown,
    touchActivity?: boolean,
    classInfo?: { classId?: unknown; className?: unknown; verified?: boolean },
  ) => Promise<any>;
  logAudit?: (
    userId: string,
    name: string,
    email: string,
    action: string,
    details: string,
  ) => Promise<void>;
  smartImport?: {
    enabled: boolean;
    reason?: string;
    analyzeVision?: SmartImportVisionAnalyzer<MoverReadingWritingSmartImportSourceRole>;
    providers?: MoverReadingWritingSmartImportProviderDefinition[];
  };
}

const SMART_IMPORT_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const SMART_IMPORT_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const SMART_IMPORT_TOTAL_MAX_BYTES = 30 * 1024 * 1024;
const SMART_IMPORT_TIMEOUT_MS = Math.min(
  180_000,
  Math.max(15_000, Number(process.env.LISTENING_SMART_IMPORT_TIMEOUT_MS) || 180_000),
);

function hasValidImageMagic(buffer: Buffer, mimeType: string) {
  if (mimeType === 'image/jpeg') return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === 'image/png') return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimeType === 'image/webp') return buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  return false;
}

const text = (value: unknown, max = 500) => String(value ?? '').trim().slice(0, max);
const nowIso = () => new Date().toISOString();
const identifier = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const sha256 = (value: string | Buffer) => crypto.createHash('sha256').update(value).digest('hex');
const timingSafeEqual = (first: string, second: string) => {
  const a = Buffer.from(first);
  const b = Buffer.from(second);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

function apiError(status: number, message: string, details?: unknown) {
  const error: any = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}

function sendError(res: express.Response, error: any) {
  res.status(Number(error?.status || 500)).json({
    error: error?.message || 'Không thể xử lý yêu cầu Mover Reading & Writing.',
    ...(error?.details ? { details: error.details } : {}),
  });
}

const isSuperAdmin = (user: any) => user?.role === 'super_admin';
const canManageSet = (user: any, set: any) => (
  isSuperAdmin(user) || (user?.role === 'teacher' && set?.ownerId === user.id)
);

function publicSetSummary(set: any) {
  const {
    draftContent: _draftContent,
    draftRevision: _draftRevision,
    validationErrors: _validationErrors,
    shareToken: _shareToken,
    assignmentSlug: _assignmentSlug,
    ...summary
  } = set || {};
  return summary;
}

function encodeTicket(payload: Record<string, unknown>, secret: string) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function decodeTicket(ticket: unknown, secret: string) {
  const [encoded, signature, extra] = String(ticket || '').split('.');
  if (!encoded || !signature || extra) throw apiError(401, 'Phiếu làm bài không hợp lệ.');
  const expected = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  if (!timingSafeEqual(signature, expected)) throw apiError(401, 'Phiếu làm bài không hợp lệ.');
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (Number(payload.ticketExpiresAt || 0) < Date.now()) throw apiError(410, 'Phiếu làm bài đã hết hạn.');
    return payload;
  } catch (error: any) {
    if (error?.status) throw error;
    throw apiError(401, 'Phiếu làm bài không hợp lệ.');
  }
}

async function getSet(db: any, id: string) {
  const document = await db.collection('mover_reading_sets').doc(id).get();
  if (!document.exists) return null;
  const set: any = { id: document.id, ...document.data() };
  if (set.draftContent && isSupportedMoverReadingWritingSchemaVersion(set.draftContent.schemaVersion)) {
    set.draftContent = normalizeMoverReadingWritingContent(set.draftContent);
  }
  return set;
}

async function getVersion(db: any, id: string) {
  const document = await db.collection('mover_reading_set_versions').doc(id).get();
  if (!document.exists) return null;
  const version: any = { id: document.id, ...document.data() };
  if (version.content && isSupportedMoverReadingWritingSchemaVersion(version.content.schemaVersion)) {
    version.content = normalizeMoverReadingWritingContent(version.content);
  }
  return version;
}

async function getAssignmentByToken(db: any, token: string) {
  if (!token) return null;
  const snapshot = await db.collection('assignments').where('shareToken', '==', token).get();
  let match: any = null;
  snapshot.forEach((document: any) => {
    const data = { id: document.id, ...document.data() };
    if (!match && (data.shareToken === token || data.assignmentSlug === token)) match = data;
  });
  return match;
}

async function resolveLearningAccess(db: any, set: any, req: express.Request) {
  if (!set || set.status !== 'published' || !set.publishedVersionId) {
    throw apiError(404, 'Bộ đề Reading & Writing chưa được xuất bản.');
  }
  if (req.user?.role === 'super_admin' || canManageSet(req.user, set)) return { assignment: null };
  if (set.visibility === 'public') return { assignment: null };
  const token = text(
    req.body?.shareToken || req.body?.accessToken || req.query?.shareToken
      || req.query?.accessToken || req.headers['x-mover-reading-share-token'],
    240,
  );
  if (token && set.shareToken && timingSafeEqual(token, String(set.shareToken))) return { assignment: null };
  const assignment = await getAssignmentByToken(db, token);
  const resourceId = assignment?.resourceId || assignment?.moverReadingWritingSetId;
  if (assignment?.resourceType === 'mover_reading_writing' && resourceId === set.id) return { assignment };
  throw apiError(403, 'Link bộ đề Reading & Writing không hợp lệ hoặc đã hết quyền truy cập.');
}

async function resolveActor(
  req: express.Request,
  resolveGuestProfile: MoverReadingWritingRouterDependencies['resolveGuestProfile'],
  classInfo: { classId?: unknown; className?: unknown; verified?: boolean } = {},
) {
  if ((req as any).authBlocked) throw apiError(403, 'Tài khoản đã bị khóa.');
  if (req.user) {
    return {
      ownerKey: `user:${req.user.id}`,
      userId: req.user.id,
      guestId: '',
      studentName: req.user.name || 'Học sinh',
    };
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

function collectAssetReferences(content: MoverReadingWritingContent) {
  const references: Array<{ id: string; entityId: string; role: string }> = [];
  const add = (id: unknown, entityId: string, role: string) => {
    const assetId = text(id, 160);
    if (assetId) references.push({ id: assetId, entityId, role });
  };
  add(content.coverAssetId, 'set', 'cover');
  add(content.parts[0].wordBankAssetId, 'part-1', 'word-bank');
  add(content.parts[1].sceneAssetId, 'part-2', 'scene');
  add(content.parts[2].sceneAssetId, 'part-3', 'scene');
  add(content.parts[3].wordBankAssetId, 'part-4', 'word-bank');
  content.parts[4].scenes.forEach((scene, index) => add(scene.imageAssetId, scene.id || `part-5-scene-${index + 1}`, 'scene'));
  add(content.parts[5].passageSourceAssetId, 'part-6-source', 'passage-source');
  add(content.parts[5].illustrationAssetId, 'part-6', 'illustration');
  add(content.parts[5].optionsAssetId, 'part-6-options', 'options');
  return references;
}

async function resolveContentAssets(db: any, content: MoverReadingWritingContent, user: any) {
  const clone = structuredClone(content);
  const references = collectAssetReferences(clone);
  const assets = new Map<string, ListeningAsset>();
  await Promise.all([...new Set(references.map(reference => reference.id))].map(async assetId => {
    const document = await db.collection('listening_assets').doc(assetId).get();
    if (!document.exists) throw apiError(400, `Không tìm thấy hình ảnh "${assetId}".`);
    const asset = { id: document.id, ...document.data() } as ListeningAsset;
    if (asset.status !== 'active' || asset.kind !== 'image') throw apiError(400, `Media "${asset.name || asset.id}" phải là hình ảnh đang hoạt động.`);
    if (!isSuperAdmin(user) && asset.ownerId !== user.id) throw apiError(403, `Bạn không có quyền dùng hình ảnh "${asset.name || asset.id}".`);
    assets.set(assetId, asset);
  }));
  const url = (id?: string) => id ? assets.get(id)?.url : undefined;
  clone.coverUrl = url(clone.coverAssetId);
  clone.parts[0].wordBankUrl = url(clone.parts[0].wordBankAssetId);
  clone.parts[1].sceneUrl = url(clone.parts[1].sceneAssetId);
  clone.parts[2].sceneUrl = url(clone.parts[2].sceneAssetId);
  clone.parts[3].wordBankUrl = url(clone.parts[3].wordBankAssetId);
  clone.parts[4].scenes.forEach(scene => { scene.imageUrl = url(scene.imageAssetId); });
  clone.parts[5].passageSourceUrl = url(clone.parts[5].passageSourceAssetId);
  clone.parts[5].illustrationUrl = url(clone.parts[5].illustrationAssetId);
  clone.parts[5].optionsUrl = url(clone.parts[5].optionsAssetId);
  return { content: clone, references };
}

function playableSet(set: any, version: any): MoverReadingWritingPlayableSet {
  return {
    ...publicSetSummary(set),
    schemaVersion: MOVER_READING_WRITING_SCHEMA_VERSION,
    versionId: version.id,
    versionNumber: version.versionNumber,
    content: sanitizeMoverReadingWritingContentForStudent(version.content),
  } as MoverReadingWritingPlayableSet;
}

export function createMoverReadingWritingRouter(dependencies: MoverReadingWritingRouterDependencies) {
  const {
    db,
    authenticateUser,
    authenticateOptionalUser,
    requireStaff,
    ticketSecret,
    mediaDir,
    resolveGuestProfile,
    logAudit,
    smartImport,
  } = dependencies;
  const router = express.Router();
  const draftLocks = new Map<string, Promise<void>>();
  const smartImportUsage = new Map<string, number[]>();
  const transientSources = mediaDir
    ? createListeningPdfTransientSourceStore({
        directory: path.join(mediaDir, '.tmp-mover-reading-import'),
        secret: ticketSecret,
      })
    : null;
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

  router.get('/capabilities', authenticateUser, requireStaff, (_req, res) => {
    res.json({
      smartImport: {
        enabled: smartImport?.enabled !== false,
        visionEnabled: Boolean(smartImport?.analyzeVision),
        providers: smartImport?.providers || [],
        reason: smartImport?.reason || (smartImport?.analyzeVision
          ? undefined
          : 'Chưa cấu hình nhà cung cấp AI thị giác cho Reading & Writing.'),
      },
      transientUpload: {
        enabled: Boolean(transientSources),
        imageMaxBytes: SMART_IMPORT_IMAGE_MAX_BYTES,
        mimeTypes: SMART_IMPORT_IMAGE_MIME_TYPES,
      },
    });
  });

  router.post(
    '/admin/smart-import/sources',
    authenticateUser,
    requireStaff,
    express.raw({ type: SMART_IMPORT_IMAGE_MIME_TYPES, limit: SMART_IMPORT_IMAGE_MAX_BYTES }),
    async (req, res) => {
      try {
        if (!req.user) throw apiError(401, 'Vui lòng đăng nhập.');
        if (!transientSources) throw apiError(503, 'Thư mục media tạm cho Smart Import chưa được cấu hình.');
        const mimeType = text(req.headers['content-type']?.split(';')[0], 100).toLowerCase();
        if (!SMART_IMPORT_IMAGE_MIME_TYPES.includes(mimeType)) {
          throw apiError(415, 'Smart Import chỉ nhận ảnh JPEG, PNG hoặc WebP.');
        }
        const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
        if (!buffer.length || buffer.length > SMART_IMPORT_IMAGE_MAX_BYTES) {
          throw apiError(413, 'Ảnh nguồn rỗng hoặc vượt quá 10 MB.');
        }
        if (!hasValidImageMagic(buffer, mimeType)) throw apiError(415, 'Nội dung ảnh không khớp định dạng khai báo.');
        const source = await transientSources.create(req.user.id, mimeType, buffer);
        res.status(201).json(source);
      } catch (error) { sendError(res, error); }
    },
  );

  router.post('/admin/smart-import/analyze', authenticateUser, requireStaff, async (req, res) => {
    const removers: Array<() => Promise<void>> = [];
    try {
      if (!req.user) throw apiError(401, 'Vui lòng đăng nhập.');
      if (smartImport?.enabled === false || !smartImport?.analyzeVision) {
        throw apiError(503, smartImport?.reason || 'Smart Import Reading & Writing chưa có AI thị giác khả dụng.');
      }
      const windowStart = Date.now() - 10 * 60 * 1000;
      const recentUsage = (smartImportUsage.get(req.user.id) || []).filter(timestamp => timestamp >= windowStart);
      if (recentUsage.length >= 20) throw apiError(429, 'Đã đạt giới hạn 20 lượt Smart Import trong 10 phút.');
      recentUsage.push(Date.now());
      smartImportUsage.set(req.user.id, recentUsage);

      if (req.body?.moduleId !== 'mover' || req.body?.paperId !== MOVER_READING_WRITING_PAPER_ID) {
        throw apiError(400, 'Smart Import này chỉ hỗ trợ Mover Reading & Writing.');
      }
      const part = Number(req.body?.part) as MoverReadingWritingSmartImportPartId;
      if (![1, 2, 3, 4, 5, 6].includes(part)) throw apiError(400, 'Part Reading & Writing không hợp lệ.');
      const currentPart = req.body?.currentPart as MoverReadingWritingPart;
      if (!currentPart || currentPart.part !== part) throw apiError(400, 'Dữ liệu Part hiện tại không hợp lệ.');
      const basePartHash = text(req.body?.basePartHash, 64).toLowerCase();
      if (!/^[0-9a-f]{64}$/.test(basePartHash)) throw apiError(400, 'Thiếu hash của Part hiện tại.');
      if (sha256(JSON.stringify(currentPart)) !== basePartHash) {
        throw apiError(409, 'Part đã thay đổi trước khi bắt đầu phân tích.', { code: 'MOVER_READING_IMPORT_BASE_CHANGED' });
      }

      const preferredProvider = text(req.body?.preferredProvider, 60) as MoverReadingWritingSmartImportProviderPreference;
      const selectedProvider = (smartImport.providers || []).find(provider => provider.id === preferredProvider);
      if (!selectedProvider) throw apiError(400, `Nhà cung cấp AI "${preferredProvider}" không tồn tại.`);
      if (!selectedProvider.enabled || selectedProvider.visionEnabled === false) {
        throw apiError(503, selectedProvider.reason || `${selectedProvider.label} chưa sẵn sàng cho ảnh.`);
      }

      const definitions = getMoverReadingWritingSmartImportRoleDefinitions(part);
      const definitionByRole = new Map(definitions.map(definition => [definition.role, definition]));
      const rawSources = Array.isArray(req.body?.sources) ? req.body.sources : [];
      if (rawSources.length > 4) throw apiError(400, 'Smart Import Reading & Writing nhận tối đa bốn ảnh theo vai trò.');
      const sources: MoverReadingWritingSmartImportRequestSource[] = [];
      const seenRoles = new Set<string>();
      const seenValues = new Set<string>();
      for (const raw of rawSources.slice(0, 4)) {
        const role = text(raw?.role, 40) as MoverReadingWritingSmartImportSourceRole;
        const assetId = text(raw?.assetId, 160);
        const transientToken = text(raw?.transientToken, 2_000);
        const definition = definitionByRole.get(role);
        if (!definition || Boolean(assetId) === Boolean(transientToken)) throw apiError(400, 'Mỗi vai trò ảnh phải có đúng một nguồn hợp lệ.');
        if (definition.source === 'asset' && !assetId) throw apiError(400, `${definition.label} phải dùng ảnh đã lưu trong thư viện.`);
        if (definition.source === 'transient' && !transientToken) throw apiError(400, `${definition.label} phải dùng ảnh tạm của lượt phân tích.`);
        if (seenRoles.has(role)) throw apiError(400, `Vai trò ${role} bị trùng.`);
        const sourceValue = assetId ? `asset:${assetId}` : `transient:${transientToken}`;
        if (seenValues.has(sourceValue)) throw apiError(400, 'Một ảnh không được dùng đồng thời cho nhiều vai trò.');
        seenRoles.add(role);
        seenValues.add(sourceValue);
        sources.push({ role, ...(assetId ? { assetId } : { transientToken }) });
      }
      const missing = definitions.filter(definition => definition.required && !seenRoles.has(definition.role));
      if (missing.length) throw apiError(400, `Thiếu nguồn bắt buộc: ${missing.map(definition => definition.label).join(', ')}.`);

      const images: SmartImportImageInput<MoverReadingWritingSmartImportSourceRole>[] = [];
      let totalBytes = 0;
      for (const source of sources) {
        if (source.transientToken) {
          if (!transientSources) throw apiError(503, 'Thư mục media tạm chưa được cấu hình.');
          let resolved;
          try { resolved = await transientSources.resolve(source.transientToken, req.user.id); }
          catch (reason: any) { throw apiError(/hết hạn/.test(reason?.message) ? 410 : 400, reason?.message || 'Nguồn ảnh tạm không hợp lệ.'); }
          removers.push(resolved.remove);
          totalBytes += resolved.data.length;
          images.push({ assetId: `mrw-source-${resolved.sourceId}`, role: source.role, mimeType: resolved.mimeType, data: resolved.data });
          continue;
        }

        const assetDocument = await db.collection('listening_assets').doc(source.assetId).get();
        if (!assetDocument.exists) throw apiError(404, 'Không tìm thấy ảnh nguồn trong thư viện.');
        const asset = { id: assetDocument.id, ...assetDocument.data() } as ListeningAsset;
        if (asset.status !== 'active' || asset.kind !== 'image' || !SMART_IMPORT_IMAGE_MIME_TYPES.includes(asset.mimeType)) {
          throw apiError(400, `Media "${asset.name || asset.id}" phải là ảnh JPEG, PNG hoặc WebP đang hoạt động.`);
        }
        if (!isSuperAdmin(req.user) && asset.ownerId !== req.user.id) throw apiError(403, 'Bạn không có quyền dùng ảnh nguồn này.');
        if (!mediaDir) throw apiError(503, 'Thư mục media chưa được cấu hình.');
        const storageKey = text(asset.storageKey, 300);
        if (!storageKey || path.basename(storageKey) !== storageKey) throw apiError(400, 'Đường dẫn ảnh nguồn không hợp lệ.');
        const root = path.resolve(mediaDir);
        const filePath = path.resolve(mediaDir, storageKey);
        if (!filePath.startsWith(`${root}${path.sep}`)) throw apiError(400, 'Đường dẫn ảnh nguồn vượt ngoài thư mục media.');
        let data: Buffer;
        try { data = await fs.promises.readFile(filePath); }
        catch { throw apiError(404, 'File ảnh nguồn không còn tồn tại trên máy chủ.'); }
        if (!data.length || data.length > SMART_IMPORT_IMAGE_MAX_BYTES || !hasValidImageMagic(data, asset.mimeType)) {
          throw apiError(415, 'File ảnh nguồn không hợp lệ hoặc vượt giới hạn 10 MB.');
        }
        totalBytes += data.length;
        images.push({ assetId: asset.id, role: source.role, mimeType: asset.mimeType, data });
      }
      if (totalBytes > SMART_IMPORT_TOTAL_MAX_BYTES) throw apiError(413, 'Tổng dung lượng ảnh Smart Import vượt quá 30 MB.');

      const abortController = new AbortController();
      let timeoutId: NodeJS.Timeout | undefined;
      const candidatePromise = createMoverReadingWritingSmartImportCandidate({
        part,
        basePartHash,
        images,
        preferredProvider,
        analyzeVision: smartImport.analyzeVision,
        signal: abortController.signal,
      });
      const timeoutPromise = new Promise<never>((_resolve, reject) => {
        timeoutId = setTimeout(() => {
          abortController.abort();
          reject(apiError(504, 'Smart Import Reading & Writing quá thời gian xử lý. Bản nháp chưa bị thay đổi.'));
        }, SMART_IMPORT_TIMEOUT_MS);
      });
      const candidate = await Promise.race([candidatePromise, timeoutPromise]).finally(() => {
        if (timeoutId) clearTimeout(timeoutId);
      });
      await Promise.allSettled(removers.map(remove => remove()));
      removers.length = 0;
      await logAudit?.(
        req.user.id,
        req.user.name,
        req.user.email,
        'ANALYZE_MOVER_READING_SMART_IMPORT',
        `Phân tích Reading & Writing Part ${part} bằng ${candidate.provider}; ${candidate.warnings.length} cảnh báo.`,
      );
      res.json(candidate);
    } catch (error) { sendError(res, error); }
    finally { await Promise.allSettled(removers.map(remove => remove())); }
  });

  router.get('/admin/sets', authenticateUser, requireStaff, async (req, res) => {
    try {
      const snapshot = isSuperAdmin(req.user)
        ? await db.collection('mover_reading_sets').get()
        : await db.collection('mover_reading_sets').where('ownerId', '==', req.user!.id).get();
      const sets: any[] = [];
      snapshot.forEach((document: any) => {
        const set = { id: document.id, ...document.data() };
        if (set.status !== 'archived') sets.push(set);
      });
      sets.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
      res.json(sets);
    } catch (error) { sendError(res, error); }
  });

  router.post('/admin/sets', authenticateUser, requireStaff, async (req, res) => {
    try {
      if (!req.user) throw apiError(401, 'Vui lòng đăng nhập.');
      const rawContent = req.body?.content as MoverReadingWritingContent;
      if (!rawContent || !isSupportedMoverReadingWritingSchemaVersion(rawContent.schemaVersion)) throw apiError(400, 'Cấu trúc bộ đề không hợp lệ.');
      const content = normalizeMoverReadingWritingContent(rawContent);
      const now = nowIso();
      const set = {
        id: identifier('mrwset'),
        moduleId: 'mover',
        paperId: MOVER_READING_WRITING_PAPER_ID,
        schemaVersion: MOVER_READING_WRITING_SCHEMA_VERSION,
        ownerId: req.user.id,
        createdBy: req.user.id,
        title: text(content.title, 160) || 'Mover Reading & Writing',
        description: text(content.description, 2000),
        level: text(content.level, 80) || 'Movers',
        status: 'draft',
        visibility: 'draft',
        draftRevision: 1,
        draftContent: content,
        validationErrors: validateMoverReadingWritingContent(content),
        createdAt: now,
        updatedAt: now,
      };
      await db.collection('mover_reading_sets').doc(set.id).set(set);
      await logAudit?.(req.user.id, req.user.name, req.user.email, 'CREATE_MOVER_READING_SET', `Tạo bộ đề Reading & Writing "${set.title}".`);
      res.status(201).json(set);
    } catch (error) { sendError(res, error); }
  });

  router.get('/admin/sets/:id', authenticateUser, requireStaff, async (req, res) => {
    try {
      const set = await getSet(db, req.params.id);
      if (!set) throw apiError(404, 'Không tìm thấy bộ đề Reading & Writing.');
      if (!canManageSet(req.user, set)) throw apiError(403, 'Bạn không có quyền xem bộ đề này.');
      const snapshot = await db.collection('mover_reading_set_versions').where('setId', '==', set.id).get();
      const versions: any[] = [];
      snapshot.forEach((document: any) => {
        const version: any = { id: document.id, ...document.data() };
        if (version.content && isSupportedMoverReadingWritingSchemaVersion(version.content.schemaVersion)) {
          version.content = normalizeMoverReadingWritingContent(version.content);
        }
        versions.push(version);
      });
      versions.sort((a, b) => Number(b.versionNumber) - Number(a.versionNumber));
      res.json({ ...set, versions });
    } catch (error) { sendError(res, error); }
  });

  router.put('/admin/sets/:id', authenticateUser, requireStaff, async (req, res) => {
    try {
      const updated = await withDraftLock(req.params.id, async () => {
        const set = await getSet(db, req.params.id);
        if (!set) throw apiError(404, 'Không tìm thấy bộ đề Reading & Writing.');
        if (!canManageSet(req.user, set)) throw apiError(403, 'Bạn không có quyền sửa bộ đề này.');
        if (set.status === 'archived') throw apiError(409, 'Bộ đề đã được lưu trữ.');
        const rawContent = req.body?.content as MoverReadingWritingContent;
        if (!rawContent || !isSupportedMoverReadingWritingSchemaVersion(rawContent.schemaVersion)) throw apiError(400, 'Cấu trúc bộ đề không hợp lệ.');
        const content = normalizeMoverReadingWritingContent(rawContent);
        const currentRevision = Number(set.draftRevision || 0);
        if (req.body?.baseRevision !== undefined && Number(req.body.baseRevision) !== currentRevision) {
          throw apiError(409, 'Bản nháp đã thay đổi ở một phiên làm việc khác.', { code: 'MOVER_READING_DRAFT_REVISION_CONFLICT', currentRevision });
        }
        const visibility = ['draft', 'public', 'assignment'].includes(req.body?.visibility) ? req.body.visibility : set.visibility;
        const shareToken = visibility === 'assignment' ? (set.shareToken || crypto.randomBytes(18).toString('base64url')) : undefined;
        const next = {
          ...set,
          title: text(content.title, 160),
          description: text(content.description, 2000),
          level: text(content.level, 80),
          schemaVersion: MOVER_READING_WRITING_SCHEMA_VERSION,
          visibility,
          draftRevision: currentRevision + 1,
          draftContent: content,
          validationErrors: validateMoverReadingWritingContent(content),
          updatedAt: nowIso(),
          ...(shareToken ? { shareToken, assignmentSlug: shareToken } : {}),
        };
        if (!shareToken) { delete next.shareToken; delete next.assignmentSlug; }
        await db.collection('mover_reading_sets').doc(set.id).set(next);
        return next;
      });
      res.json(updated);
    } catch (error) { sendError(res, error); }
  });

  router.post('/admin/sets/:id/draft/autosave', authenticateUser, requireStaff, async (req, res) => {
    try {
      const updated = await withDraftLock(req.params.id, async () => {
        const set = await getSet(db, req.params.id);
        if (!set) throw apiError(404, 'Không tìm thấy bộ đề Reading & Writing.');
        if (!canManageSet(req.user, set)) throw apiError(403, 'Bạn không có quyền sửa bộ đề này.');
        if (set.status === 'archived') throw apiError(409, 'Bộ đề đã được lưu trữ.');
        const rawContent = req.body?.content as MoverReadingWritingContent;
        if (!rawContent || !isSupportedMoverReadingWritingSchemaVersion(rawContent.schemaVersion)) {
          throw apiError(400, 'Cấu trúc bộ đề không hợp lệ.');
        }
        const content = normalizeMoverReadingWritingContent(rawContent);
        const baseRevision = Number(req.body?.baseRevision);
        const currentRevision = Number(set.draftRevision || 0);
        if (!Number.isInteger(baseRevision) || baseRevision !== currentRevision) {
          throw apiError(409, 'Bản nháp đã thay đổi ở một phiên làm việc khác.', {
            code: 'MOVER_READING_DRAFT_REVISION_CONFLICT',
            currentRevision,
          });
        }
        const visibility = ['draft', 'public', 'assignment'].includes(req.body?.visibility)
          ? req.body.visibility
          : set.visibility;
        const shareToken = visibility === 'assignment'
          ? (set.shareToken || crypto.randomBytes(18).toString('base64url'))
          : undefined;
        const updatedAt = nowIso();
        const next = {
          ...set,
          title: text(content.title, 160),
          description: text(content.description, 2000),
          level: text(content.level, 80),
          schemaVersion: MOVER_READING_WRITING_SCHEMA_VERSION,
          visibility,
          draftRevision: currentRevision + 1,
          draftContent: content,
          validationErrors: validateMoverReadingWritingContent(content),
          updatedAt,
          ...(shareToken ? { shareToken, assignmentSlug: shareToken } : {}),
        };
        if (!shareToken) {
          delete next.shareToken;
          delete next.assignmentSlug;
        }
        await db.collection('mover_reading_sets').doc(set.id).set(next);
        return next;
      });
      res.json({
        draftRevision: updated.draftRevision,
        updatedAt: updated.updatedAt,
        validationErrors: updated.validationErrors,
      });
    } catch (error) { sendError(res, error); }
  });

  router.post('/admin/sets/:id/clone', authenticateUser, requireStaff, async (req, res) => {
    try {
      if (!req.user) throw apiError(401, 'Vui lòng đăng nhập.');
      const source = await getSet(db, req.params.id);
      if (!source) throw apiError(404, 'Không tìm thấy bộ đề Reading & Writing.');
      if (!canManageSet(req.user, source)) throw apiError(403, 'Bạn không có quyền sao chép bộ đề này.');
      let sourceContent = source.draftContent as MoverReadingWritingContent | undefined;
      if (!sourceContent && source.publishedVersionId) sourceContent = (await getVersion(db, source.publishedVersionId))?.content;
      if (!sourceContent) throw apiError(409, 'Bộ đề nguồn không có nội dung tương thích.');
      const suffix = ' (Bản sao)';
      const cloneTitle = `${text(source.title, 160 - suffix.length)}${suffix}`;
      const content = { ...normalizeMoverReadingWritingContent(sourceContent), title: cloneTitle };
      const now = nowIso();
      const clone = {
        id: identifier('mrwset'), moduleId: 'mover', paperId: MOVER_READING_WRITING_PAPER_ID,
        schemaVersion: MOVER_READING_WRITING_SCHEMA_VERSION, ownerId: req.user.id, createdBy: req.user.id,
        title: cloneTitle, description: text(content.description, 2000), level: text(content.level, 80),
        status: 'draft', visibility: 'draft', draftRevision: 1, draftContent: content,
        validationErrors: validateMoverReadingWritingContent(content), createdAt: now, updatedAt: now,
      };
      await db.collection('mover_reading_sets').doc(clone.id).set(clone);
      res.status(201).json(clone);
    } catch (error) { sendError(res, error); }
  });

  router.post('/admin/sets/:id/publish', authenticateUser, requireStaff, async (req, res) => {
    try {
      if (!req.user) throw apiError(401, 'Vui lòng đăng nhập.');
      const set = await getSet(db, req.params.id);
      if (!set) throw apiError(404, 'Không tìm thấy bộ đề Reading & Writing.');
      if (!canManageSet(req.user, set)) throw apiError(403, 'Bạn không có quyền xuất bản bộ đề này.');
      if (set.status === 'archived') throw apiError(409, 'Bộ đề đã được lưu trữ.');
      const draftContent = normalizeMoverReadingWritingContent(set.draftContent);
      const errors = validateMoverReadingWritingContent(draftContent);
      if (errors.length) throw apiError(422, 'Bộ đề chưa đủ điều kiện xuất bản.', errors);
      const resolved = await resolveContentAssets(db, draftContent, req.user);
      const versionsSnapshot = await db.collection('mover_reading_set_versions').where('setId', '==', set.id).get();
      let versionNumber = 1;
      versionsSnapshot.forEach((document: any) => { versionNumber = Math.max(versionNumber, Number(document.data()?.versionNumber || 0) + 1); });
      const now = nowIso();
      const version = {
        id: identifier('mrwver'), setId: set.id, versionNumber, status: 'published',
        schemaVersion: MOVER_READING_WRITING_SCHEMA_VERSION, content: resolved.content,
        createdAt: now, updatedAt: now, publishedAt: now,
      };
      const batch = db.batch();
      batch.set(db.collection('mover_reading_set_versions').doc(version.id), version);
      if (set.publishedVersionId) {
        const previous = await getVersion(db, set.publishedVersionId);
        if (previous) batch.update(db.collection('mover_reading_set_versions').doc(previous.id), { status: 'superseded', updatedAt: now });
      }
      const publishedSet = {
        ...set,
        schemaVersion: MOVER_READING_WRITING_SCHEMA_VERSION,
        title: resolved.content.title,
        description: resolved.content.description,
        level: resolved.content.level,
        coverUrl: resolved.content.coverUrl || '',
        timeLimitMinutes: resolved.content.timeLimitMinutes,
        status: 'published',
        publishedVersionId: version.id,
        publishedVersionNumber: versionNumber,
        validationErrors: [],
        updatedAt: now,
      };
      batch.set(db.collection('mover_reading_sets').doc(set.id), publishedSet);
      resolved.references.forEach(reference => {
        const usageId = `mrwusage-${sha256(`${version.id}:${reference.id}:${reference.entityId}:${reference.role}`).slice(0, 32)}`;
        batch.set(db.collection('mover_reading_asset_usages').doc(usageId), {
          id: usageId, assetId: reference.id, setId: set.id, versionId: version.id,
          entityId: reference.entityId, role: reference.role, createdAt: now, updatedAt: now,
        });
      });
      await batch.commit();
      await logAudit?.(req.user.id, req.user.name, req.user.email, 'PUBLISH_MOVER_READING_SET', `Xuất bản "${publishedSet.title}" phiên bản ${versionNumber}.`);
      res.json({ set: publishedSet, version });
    } catch (error) { sendError(res, error); }
  });

  router.delete('/admin/sets/:id', authenticateUser, requireStaff, async (req, res) => {
    try {
      const set = await getSet(db, req.params.id);
      if (!set) throw apiError(404, 'Không tìm thấy bộ đề Reading & Writing.');
      if (!canManageSet(req.user, set)) throw apiError(403, 'Bạn không có quyền lưu trữ bộ đề này.');
      const updatedAt = nowIso();
      await db.collection('mover_reading_sets').doc(set.id).update({ status: 'archived', updatedAt });
      res.json({ success: true, recoverable: true, status: 'archived', updatedAt });
    } catch (error) { sendError(res, error); }
  });

  router.get('/admin/sets/:id/results', authenticateUser, requireStaff, async (req, res) => {
    try {
      const set = await getSet(db, req.params.id);
      if (!set) throw apiError(404, 'Không tìm thấy bộ đề Reading & Writing.');
      if (!canManageSet(req.user, set)) throw apiError(403, 'Bạn không có quyền xem kết quả.');
      const snapshot = await db.collection('mover_reading_attempts').where('setId', '==', set.id).get();
      const attempts: any[] = [];
      for (const document of snapshot.docs || []) {
        const { runSecretHash: _secret, ...attempt } = { id: document.id, ...document.data() };
        const detailDoc = await db.collection('mover_reading_attempt_details').doc(document.id).get();
        attempts.push({ ...attempt, questions: detailDoc.exists ? detailDoc.data()?.questions || [] : [] });
      }
      attempts.sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt)));
      res.json({ set: publicSetSummary(set), attempts });
    } catch (error) { sendError(res, error); }
  });

  router.get('/sets', authenticateOptionalUser, async (req, res) => {
    try {
      const snapshot = await db.collection('mover_reading_sets').get();
      const sets: any[] = [];
      snapshot.forEach((document: any) => {
        const set = { id: document.id, ...document.data() };
        const visible = set.status === 'published' && (set.visibility === 'public' || req.user?.role === 'super_admin' || canManageSet(req.user, set));
        if (visible) sets.push(publicSetSummary(set));
      });
      sets.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
      res.json(sets);
    } catch (error) { sendError(res, error); }
  });

  router.get('/sets/:id', authenticateOptionalUser, async (req, res) => {
    try {
      const set = await getSet(db, req.params.id);
      await resolveLearningAccess(db, set, req);
      const version = await getVersion(db, set.publishedVersionId);
      if (!version) throw apiError(404, 'Không tìm thấy phiên bản đã xuất bản.');
      res.json(playableSet(set, version));
    } catch (error) { sendError(res, error); }
  });

  router.post('/sets/:id/attempts/prepare', authenticateOptionalUser, async (req, res) => {
    try {
      const set = await getSet(db, req.params.id);
      const access = await resolveLearningAccess(db, set, req);
      const actor = await resolveActor(req, resolveGuestProfile, {
        classId: access.assignment?.classId,
        className: access.assignment?.className,
        verified: Boolean(access.assignment?.id),
      });
      const clientRunId = text(req.body?.clientRunId, 160);
      const runSecret = text(req.body?.runSecret, 300);
      if (!clientRunId || !runSecret) throw apiError(400, 'Thiếu mã lượt làm bài.');
      const version = await getVersion(db, set.publishedVersionId);
      if (!version) throw apiError(404, 'Không tìm thấy phiên bản đã xuất bản.');
      const startedAt = nowIso();
      const deadlineAt = set.timeLimitMinutes ? new Date(Date.now() + Number(set.timeLimitMinutes) * 60_000).toISOString() : undefined;
      const payload = {
        schemaVersion: MOVER_READING_WRITING_SCHEMA_VERSION,
        paperId: MOVER_READING_WRITING_PAPER_ID,
        setId: set.id,
        versionId: version.id,
        ownerKey: actor.ownerKey,
        assignmentId: access.assignment?.id || '',
        classId: access.assignment?.classId || '',
        className: access.assignment?.className || '',
        assignmentTitle: access.assignment?.title || '',
        assignmentDueAt: access.assignment?.dueDate || access.assignment?.dueAt || '',
        clientRunId,
        runSecretHash: sha256(runSecret),
        startedAt,
        deadlineAt,
        ticketExpiresAt: Date.now() + (deadlineAt ? 24 * 60 * 60_000 : 7 * 24 * 60 * 60_000),
      };
      res.json({
        ticket: encodeTicket(payload, ticketSecret),
        set: playableSet(set, version),
        startedAt,
        deadlineAt,
      });
    } catch (error) { sendError(res, error); }
  });

  router.post('/sets/:id/attempts/submit', authenticateOptionalUser, async (req, res) => {
    try {
      const ticket = decodeTicket(req.body?.ticket, ticketSecret);
      if (ticket.paperId !== MOVER_READING_WRITING_PAPER_ID || ticket.setId !== req.params.id) throw apiError(401, 'Phiếu làm bài không khớp bộ đề.');
      const runSecret = text(req.body?.runSecret, 300);
      if (!runSecret || !timingSafeEqual(sha256(runSecret), String(ticket.runSecretHash))) throw apiError(401, 'Mã bảo vệ lượt làm bài không hợp lệ.');
      const actor = await resolveActor(req, resolveGuestProfile);
      if (actor.ownerKey !== ticket.ownerKey) throw apiError(404, 'Không tìm thấy lượt làm bài.');
      const set = await getSet(db, ticket.setId);
      const version = await getVersion(db, ticket.versionId);
      if (!set || !version || version.setId !== set.id) throw apiError(404, 'Phiên bản bộ đề không tồn tại.');
      const attemptId = `mrwattempt-${sha256(`${ticket.ownerKey}:${ticket.setId}:${ticket.clientRunId}`).slice(0, 40)}`;
      const existingDocument = await db.collection('mover_reading_attempts').doc(attemptId).get();
      if (existingDocument.exists) {
        const existing = { id: existingDocument.id, ...existingDocument.data() } as any;
        if (!timingSafeEqual(String(existing.runSecretHash), sha256(runSecret))) throw apiError(409, 'Mã lượt làm bài đã được sử dụng.');
        const { runSecretHash: _secret, ownerKey: _owner, userId: _user, guestId: _guest, ...summary } = existing;
        return res.json(summary);
      }
      const content = version.content as MoverReadingWritingContent;
      const answers = sanitizeMoverReadingWritingAnswers(content, req.body?.answers) as MoverReadingWritingAnswers;
      const grade = gradeMoverReadingWritingAttempt(content, answers);
      const completedAt = nowIso();
      const durationSeconds = Math.max(0, Math.min(24 * 60 * 60, Math.round((Date.now() - new Date(ticket.startedAt).getTime()) / 1000)));
      const attempt = {
        id: attemptId,
        paperId: MOVER_READING_WRITING_PAPER_ID,
        schemaVersion: MOVER_READING_WRITING_SCHEMA_VERSION,
        gradingVersion: MOVER_READING_WRITING_GRADING_VERSION,
        ownerKey: actor.ownerKey,
        userId: actor.userId,
        guestId: actor.guestId,
        studentName: actor.studentName,
        setId: set.id,
        setTitle: set.title,
        versionId: version.id,
        assignmentId: ticket.assignmentId || '',
        classId: ticket.classId || '',
        className: ticket.className || '',
        assignmentTitle: ticket.assignmentTitle || '',
        assignmentDueAt: ticket.assignmentDueAt || '',
        clientRunId: ticket.clientRunId,
        runSecretHash: sha256(runSecret),
        score: grade.score,
        correctCount: grade.correctCount,
        incorrectCount: grade.incorrectCount,
        unansweredCount: grade.unansweredCount,
        totalCount: grade.totalCount,
        startedAt: ticket.startedAt,
        completedAt,
        durationSeconds,
        status: 'completed',
        createdAt: completedAt,
        updatedAt: completedAt,
      };
      const detail = {
        id: attemptId,
        attemptId,
        setId: set.id,
        versionId: version.id,
        questions: grade.questions,
        reviewPolicy: { showReviewAfterSubmit: content.showReviewAfterSubmit === true },
        createdAt: completedAt,
        updatedAt: completedAt,
      };
      const batch = db.batch();
      batch.set(db.collection('mover_reading_attempts').doc(attemptId), attempt);
      batch.set(db.collection('mover_reading_attempt_details').doc(attemptId), detail);
      await batch.commit();
      const { runSecretHash: _secret, ownerKey: _owner, userId: _user, guestId: _guest, ...summary } = attempt;
      res.status(201).json(summary);
    } catch (error) { sendError(res, error); }
  });

  router.get('/sets/:id/attempts/:attemptId/review', authenticateOptionalUser, async (req, res) => {
    try {
      const attemptDocument = await db.collection('mover_reading_attempts').doc(req.params.attemptId).get();
      if (!attemptDocument.exists) throw apiError(404, 'Không tìm thấy lượt làm bài.');
      const attempt = { id: attemptDocument.id, ...attemptDocument.data() } as any;
      if (attempt.setId !== req.params.id || attempt.status !== 'completed') throw apiError(404, 'Không tìm thấy lượt làm bài.');
      let ownerKey = '';
      if (req.user) ownerKey = `user:${req.user.id}`;
      else {
        const guestId = text(req.query?.guestId || req.headers['x-guest-id'], 120);
        ownerKey = guestId ? `guest:${guestId}` : '';
        const runSecret = text(req.headers['x-mover-reading-run-secret'], 300);
        if (!runSecret || !timingSafeEqual(sha256(runSecret), String(attempt.runSecretHash))) throw apiError(404, 'Không tìm thấy lượt làm bài.');
      }
      if (!ownerKey || ownerKey !== attempt.ownerKey) throw apiError(404, 'Không tìm thấy lượt làm bài.');
      const detailDocument = await db.collection('mover_reading_attempt_details').doc(attempt.id).get();
      if (!detailDocument.exists) throw apiError(404, 'Không tìm thấy chi tiết lượt làm bài.');
      const detail = detailDocument.data();
      if (detail?.reviewPolicy?.showReviewAfterSubmit !== true) throw apiError(403, 'Giáo viên chưa cho phép xem đáp án sau khi nộp.');
      let visualReview;
      const version = await getVersion(db, attempt.versionId);
      if (version?.content && Array.isArray(detail?.questions)) {
        try {
          visualReview = buildMoverReadingWritingVisualReviewSnapshot(
            version.content as MoverReadingWritingContent,
            detail.questions,
          );
        } catch {
          // Keep the readable per-question fallback for malformed legacy detail.
        }
      }
      res.json({
        attemptId: attempt.id,
        setId: attempt.setId,
        versionId: attempt.versionId,
        title: attempt.setTitle,
        score: attempt.score,
        correctCount: attempt.correctCount,
        incorrectCount: attempt.incorrectCount,
        unansweredCount: attempt.unansweredCount,
        totalCount: attempt.totalCount,
        completedAt: attempt.completedAt,
        questions: detail.questions || [],
        ...(visualReview ? { visualReview } : {}),
      });
    } catch (error) { sendError(res, error); }
  });

  return router;
}
