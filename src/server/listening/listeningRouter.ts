import crypto from 'crypto';
import express from 'express';
import fs from 'fs';
import path from 'path';
import type {
  ListeningAnswers,
  ListeningAsset,
  ListeningAssetKind,
  ListeningPlayableSet,
  ListeningSetContent,
} from '../../features/listening/types.js';
import {
  DEFAULT_LISTENING_MODULE_ID,
  LISTENING_LIBRARY_SCHEMA_VERSION,
  resolveListeningModuleId,
} from '../../features/listening-library/registry.js';
import { gradeListeningAttempt, LISTENING_GRADING_VERSION } from './listeningGrader.js';
import { buildListeningActivityAnswerDetails } from './listeningActivity.js';
import {
  sanitizeListeningAnswers,
  sanitizeListeningContentForStudent,
  validateListeningSetContent,
} from './listeningValidation.js';
import {
  createListeningSmartImportCandidate,
  type SmartImportImageInput,
  type SmartImportVisionAnalyzer,
} from '../listening-smart-import/service.js';
import {
  getListeningSmartImportRoleDefinitions,
  type ListeningSmartImportSource,
} from '../../features/listening-editor/smart-import/types.js';

type Middleware = express.RequestHandler;

export interface ListeningRouterDependencies {
  db: any;
  authenticateUser: Middleware;
  authenticateOptionalUser: Middleware;
  requireStaff: Middleware;
  mediaDir: string;
  mediaPublicPrefix: string;
  ticketSecret: string;
  resolveGuestProfile: (
    guestId: unknown,
    studentName: unknown,
    touchActivity?: boolean,
    classInfo?: { classId?: unknown; className?: unknown; verified?: boolean }
  ) => Promise<any>;
  logAudit?: (
    userId: string,
    name: string,
    email: string,
    action: string,
    details: string
  ) => Promise<void>;
  smartImport?: {
    enabled: boolean;
    reason?: string;
    analyzeVision?: SmartImportVisionAnalyzer;
  };
}

const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const AUDIO_MAX_BYTES = 50 * 1024 * 1024;
const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'audio/mpeg': '.mp3',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
  'audio/ogg': '.ogg',
  'audio/mp4': '.m4a',
  'audio/x-m4a': '.m4a',
};

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
    error: error?.message || 'Không thể xử lý yêu cầu Listening.',
    ...(error?.details ? { details: error.details } : {}),
  });
}

function isSuperAdmin(user: any) {
  return user?.role === 'super_admin';
}

function canManageSet(user: any, set: any) {
  return isSuperAdmin(user) || (user?.role === 'teacher' && set?.ownerId === user.id);
}

function publicSetSummary(set: any) {
  const {
    draftContent: _draftContent,
    draftRevision: _draftRevision,
    shareToken: _shareToken,
    assignmentSlug: _assignmentSlug,
    ...summary
  } = set || {};
  return withListeningModuleMetadata(summary);
}

function withListeningModuleMetadata<T extends Record<string, any>>(record: T) {
  return {
    ...record,
    moduleId: resolveListeningModuleId(record?.moduleId),
    schemaVersion: Number(record?.schemaVersion || LISTENING_LIBRARY_SCHEMA_VERSION),
    moduleSchemaVersion: Number(record?.moduleSchemaVersion || LISTENING_LIBRARY_SCHEMA_VERSION),
  };
}

function belongsToMoverModule(record: Record<string, any>) {
  return resolveListeningModuleId(record?.moduleId) === DEFAULT_LISTENING_MODULE_ID;
}

function withMoverContentMetadata(content: ListeningSetContent): ListeningSetContent {
  return {
    ...content,
    moduleId: DEFAULT_LISTENING_MODULE_ID,
    schemaVersion: LISTENING_LIBRARY_SCHEMA_VERSION,
    parts: content.parts.map(part => ({
      ...part,
      schemaVersion: part.schemaVersion || LISTENING_LIBRARY_SCHEMA_VERSION,
    })) as ListeningSetContent['parts'],
  };
}

function encodeTicket(payload: Record<string, unknown>, secret: string) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function decodeTicket(ticket: unknown, secret: string) {
  const [encoded, providedSignature, extra] = String(ticket || '').split('.');
  if (!encoded || !providedSignature || extra) throw apiError(401, 'Phiếu làm bài không hợp lệ.');
  const expected = crypto.createHmac('sha256', secret).update(encoded).digest('base64url');
  if (!timingSafeEqual(providedSignature, expected)) throw apiError(401, 'Phiếu làm bài không hợp lệ.');
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (Number(payload.ticketExpiresAt || 0) < Date.now()) {
      throw apiError(410, 'Phiếu làm bài đã hết thời gian gửi lại.');
    }
    return payload;
  } catch (error: any) {
    if (error?.status) throw error;
    throw apiError(401, 'Phiếu làm bài không hợp lệ.');
  }
}

function hasValidMagic(buffer: Buffer, mimeType: string) {
  if (mimeType === 'image/jpeg') return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mimeType === 'image/gif') return ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'));
  if (mimeType === 'image/webp') return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  if (mimeType === 'audio/wav' || mimeType === 'audio/x-wav') {
    return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WAVE';
  }
  if (mimeType === 'audio/ogg') return buffer.subarray(0, 4).toString('ascii') === 'OggS';
  if (mimeType === 'audio/mp4' || mimeType === 'audio/x-m4a') return buffer.subarray(4, 8).toString('ascii') === 'ftyp';
  if (mimeType === 'audio/mpeg') {
    return buffer.subarray(0, 3).toString('ascii') === 'ID3'
      || (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0);
  }
  return false;
}

function collectAssetReferences(content: ListeningSetContent) {
  const references: Array<{ id: string; kind: ListeningAssetKind; entityId: string; role: string }> = [];
  const add = (id: unknown, kind: ListeningAssetKind, entityId: string, role: string) => {
    const assetId = text(id, 160);
    if (assetId) references.push({ id: assetId, kind, entityId, role });
  };
  add(content.coverAssetId, 'image', 'set', 'cover');
  add(content.backgroundAssetId, 'image', 'set', 'background');
  content.parts.forEach(part => add(part.audioAssetId, 'audio', `part-${part.part}`, 'audio'));
  add(content.parts[0].sceneAssetId, 'image', 'part-1', 'scene');
  add(content.parts[1].illustrationAssetId, 'image', 'part-2', 'illustration');
  const part3 = content.parts[2];
  add(part3.boardAssetId, 'image', 'part-3', 'board');
  if (part3.displayMode !== 'connect-image') {
    part3.options.forEach(option => add(option.imageAssetId, 'image', option.id, 'part3-option'));
    part3.items.forEach(item => add(item.imageAssetId, 'image', item.id, 'part3-item'));
    if (part3.example) {
      add(part3.example.item.imageAssetId, 'image', part3.example.item.id, 'part3-example');
    }
  }
  content.parts[3].questions.forEach(question => {
    question.options.forEach(option => add(option.imageAssetId, 'image', `${question.id}:${option.id}`, 'part4-option'));
  });
  if (content.parts[3].example) {
    content.parts[3].example.options.forEach(option => add(option.imageAssetId, 'image', `example:${option.id}`, 'part4-example'));
  }
  add(content.parts[4].sceneAssetId, 'image', 'part-5', 'scene');
  const part5 = content.parts[4];
  if (part5.displayMode === 'scene-colour-draw') {
    part5.objectPalette.forEach(item => add(item.tokenAssetId, 'image', item.id, 'part5-token'));
  }
  return references;
}

async function resolveContentAssets(db: any, content: ListeningSetContent, user: any) {
  const clone = structuredClone(content);
  const part3 = clone.parts[2];
  if (part3.displayMode !== 'connect-image') {
    part3.options.forEach((option, index) => {
      option.label = String.fromCharCode(65 + index);
    });
  }
  const references = collectAssetReferences(clone);
  const assets = new Map<string, ListeningAsset>();
  await Promise.all([...new Set(references.map(reference => reference.id))].map(async assetId => {
    const document = await db.collection('listening_assets').doc(assetId).get();
    if (!document.exists) throw apiError(400, `Không tìm thấy media "${assetId}".`);
    const asset = { id: document.id, ...document.data() } as ListeningAsset;
    if (asset.status !== 'active') throw apiError(400, `Media "${asset.name || asset.id}" đã lưu trữ.`);
    if (!isSuperAdmin(user) && asset.ownerId !== user.id) {
      throw apiError(403, `Bạn không có quyền dùng media "${asset.name || asset.id}".`);
    }
    assets.set(assetId, asset);
  }));
  for (const reference of references) {
    const asset = assets.get(reference.id);
    if (!asset || asset.kind !== reference.kind) {
      throw apiError(400, `Media "${reference.id}" không đúng loại ${reference.kind}.`);
    }
  }

  const url = (id?: string) => id ? assets.get(id)?.url : undefined;
  clone.coverUrl = url(clone.coverAssetId);
  clone.backgroundUrl = url(clone.backgroundAssetId);
  clone.parts.forEach(part => { part.audioUrl = url(part.audioAssetId); });
  clone.parts[0].sceneUrl = url(clone.parts[0].sceneAssetId);
  clone.parts[1].illustrationUrl = url(clone.parts[1].illustrationAssetId);
  clone.parts[2].boardUrl = url(clone.parts[2].boardAssetId);
  if (clone.parts[2].displayMode !== 'connect-image') {
    clone.parts[2].options.forEach(option => { option.imageUrl = url(option.imageAssetId); });
    clone.parts[2].items.forEach(item => { item.imageUrl = url(item.imageAssetId); });
    if (clone.parts[2].example) {
      clone.parts[2].example.item.imageUrl = url(clone.parts[2].example.item.imageAssetId);
    }
  }
  clone.parts[3].questions.forEach(question => {
    question.options.forEach(option => { option.imageUrl = url(option.imageAssetId); });
  });
  if (clone.parts[3].example) {
    clone.parts[3].example.options.forEach(option => { option.imageUrl = url(option.imageAssetId); });
  }
  clone.parts[4].sceneUrl = url(clone.parts[4].sceneAssetId);
  if (clone.parts[4].displayMode === 'scene-colour-draw') {
    clone.parts[4].objectPalette.forEach(item => { item.tokenUrl = url(item.tokenAssetId); });
  }
  return { content: clone, references };
}

async function getSet(db: any, id: string) {
  const document = await db.collection('listening_sets').doc(id).get();
  if (!document.exists) return null;
  const record = { id: document.id, ...document.data() };
  return belongsToMoverModule(record) ? withListeningModuleMetadata(record) : null;
}

async function getVersion(db: any, id: string) {
  const document = await db.collection('listening_set_versions').doc(id).get();
  if (!document.exists) return null;
  const record = { id: document.id, ...document.data() };
  return belongsToMoverModule(record) ? withListeningModuleMetadata(record) : null;
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
    throw apiError(404, 'Bộ đề nghe chưa được xuất bản.');
  }
  if (req.user?.role === 'super_admin' || canManageSet(req.user, set)) {
    return { assignment: null };
  }
  if (set.visibility === 'public') return { assignment: null };
  const token = text(
    req.body?.shareToken || req.body?.accessToken || req.query?.shareToken
      || req.query?.accessToken || req.headers['x-listening-share-token'],
    240
  );
  if (token && set.shareToken && timingSafeEqual(token, String(set.shareToken))) {
    return { assignment: null };
  }
  const assignment = await getAssignmentByToken(db, token);
  const resourceType = assignment?.resourceType || 'vocabulary';
  const resourceId = assignment?.resourceId || assignment?.vocabSetId;
  if (assignment && resourceType === 'listening' && resourceId === set.id) {
    return { assignment };
  }
  throw apiError(403, 'Link bộ đề nghe không hợp lệ hoặc đã hết quyền truy cập.');
}

async function resolveActor(
  req: express.Request,
  resolveGuestProfile: ListeningRouterDependencies['resolveGuestProfile'],
  classInfo: { classId?: unknown; className?: unknown; verified?: boolean } = {}
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

function playableSet(set: any, version: any): ListeningPlayableSet {
  const content = withMoverContentMetadata(sanitizeListeningContentForStudent(version.content));
  return {
    ...publicSetSummary(set),
    versionId: version.id,
    versionNumber: version.versionNumber,
    content,
  } as ListeningPlayableSet;
}

export function createListeningRouter(dependencies: ListeningRouterDependencies) {
  const {
    db,
    authenticateUser,
    authenticateOptionalUser,
    requireStaff,
    mediaDir,
    mediaPublicPrefix,
    ticketSecret,
    resolveGuestProfile,
    logAudit,
    smartImport,
  } = dependencies;
  const router = express.Router();
  const draftLocks = new Map<string, Promise<void>>();
  const smartImportUsage = new Map<string, number[]>();
  const withDraftLock = async <T,>(setId: string, operation: () => Promise<T>): Promise<T> => {
    const previous = draftLocks.get(setId) || Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>(resolve => { release = resolve; });
    const queued = previous.then(() => current);
    draftLocks.set(setId, queued);
    await previous;
    try {
      return await operation();
    } finally {
      release();
      if (draftLocks.get(setId) === queued) draftLocks.delete(setId);
    }
  };
  fs.mkdirSync(mediaDir, { recursive: true });

  router.get('/capabilities', authenticateUser, requireStaff, (_req, res) => {
    res.json({
      imageGeneration: {
        enabled: false,
        reason: 'Chưa cấu hình nhà cung cấp tạo ảnh ở backend. Có thể dùng tải lên hoặc thư viện media.',
      },
      smartImport: {
        enabled: smartImport?.enabled !== false,
        visionEnabled: Boolean(smartImport?.analyzeVision),
        reason: smartImport?.reason || (smartImport?.analyzeVision
          ? undefined
          : 'Chưa cấu hình GEMINI_API_KEY hoặc OPENAI_API_KEY; vẫn có thể nhập văn bản cho Part 2/3.'),
      },
      upload: {
        enabled: true,
        imageMaxBytes: IMAGE_MAX_BYTES,
        audioMaxBytes: AUDIO_MAX_BYTES,
        mimeTypes: Object.keys(MIME_EXTENSIONS),
      },
    });
  });

  router.get('/admin/assets', authenticateUser, requireStaff, async (req, res) => {
    try {
      const snapshot = isSuperAdmin(req.user)
        ? await db.collection('listening_assets').get()
        : await db.collection('listening_assets').where('ownerId', '==', req.user!.id).get();
      const assets: any[] = [];
      snapshot.forEach((document: any) => {
        const asset = { id: document.id, ...document.data() };
        if (asset.status !== 'archived') assets.push(asset);
      });
      assets.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      res.json(assets);
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post(
    '/admin/assets',
    authenticateUser,
    requireStaff,
    express.raw({ type: Object.keys(MIME_EXTENSIONS), limit: AUDIO_MAX_BYTES }),
    async (req, res) => {
      let temporaryPath = '';
      try {
        if (!req.user) throw apiError(401, 'Vui lòng đăng nhập.');
        const mimeType = text(req.headers['content-type']?.split(';')[0], 100).toLowerCase();
        const extension = MIME_EXTENSIONS[mimeType];
        if (!extension) throw apiError(415, 'Định dạng media không được hỗ trợ.');
        const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
        const kind: ListeningAssetKind = mimeType.startsWith('image/') ? 'image' : 'audio';
        const sizeLimit = kind === 'image' ? IMAGE_MAX_BYTES : AUDIO_MAX_BYTES;
        if (!buffer.length || buffer.length > sizeLimit) throw apiError(413, 'File rỗng hoặc vượt giới hạn dung lượng.');
        if (!hasValidMagic(buffer, mimeType)) throw apiError(415, 'Nội dung file không khớp định dạng khai báo.');

        const derivedFromAssetId = text(req.headers['x-derived-from-asset-id'], 160);
        let crop: ListeningAsset['crop'];
        if (derivedFromAssetId) {
          if (kind !== 'image') throw apiError(400, 'Chỉ ảnh mới có thể là asset crop dẫn xuất.');
          const sourceDocument = await db.collection('listening_assets').doc(derivedFromAssetId).get();
          if (!sourceDocument.exists) throw apiError(404, 'Không tìm thấy ảnh nguồn của asset crop.');
          const sourceAsset = { id: sourceDocument.id, ...sourceDocument.data() } as ListeningAsset;
          if (!isSuperAdmin(req.user) && sourceAsset.ownerId !== req.user.id) {
            throw apiError(403, 'Bạn không có quyền tạo crop từ ảnh nguồn này.');
          }
          if (sourceAsset.kind !== 'image' || sourceAsset.status !== 'active') {
            throw apiError(400, 'Asset nguồn crop phải là ảnh đang hoạt động.');
          }
          try {
            const parsed = JSON.parse(text(req.headers['x-crop-metadata'], 500));
            crop = {
              x: Number(parsed.x),
              y: Number(parsed.y),
              width: Number(parsed.width),
              height: Number(parsed.height),
            };
          } catch {
            throw apiError(400, 'Metadata crop không hợp lệ.');
          }
          if (
            !crop
            || Object.values(crop).some(value => !Number.isFinite(value) || value < 0 || value > 1)
            || crop.width <= 0
            || crop.height <= 0
            || crop.x + crop.width > 1
            || crop.y + crop.height > 1
          ) {
            throw apiError(400, 'Tọa độ crop phải nằm trong khoảng 0–1.');
          }
        }

        const digest = sha256(buffer);
        const storageKey = `${digest}${extension}`;
        const finalPath = path.join(mediaDir, storageKey);
        temporaryPath = path.join(mediaDir, `.${digest}.${crypto.randomUUID()}.tmp`);
        fs.writeFileSync(temporaryPath, buffer, { flag: 'wx' });
        if (fs.existsSync(finalPath)) fs.unlinkSync(temporaryPath);
        else fs.renameSync(temporaryPath, finalPath);
        temporaryPath = '';

        const existingSnapshot = await db.collection('listening_assets').where('storageKey', '==', storageKey).get();
        let existing: any = null;
        existingSnapshot.forEach((document: any) => {
          const data = { id: document.id, ...document.data() };
          const sameOwner = isSuperAdmin(req.user) || data.ownerId === req.user!.id;
          const sameDerivative = derivedFromAssetId
            ? data.derivedFromAssetId === derivedFromAssetId
              && JSON.stringify(data.crop) === JSON.stringify(crop)
            : !data.derivedFromAssetId;
          if (!existing && sameOwner && sameDerivative) existing = data;
        });
        if (existing) return res.json(existing);

        const now = nowIso();
        const asset: ListeningAsset = {
          id: identifier('lasset'),
          ownerId: req.user.id,
          kind,
          name: (() => {
            const rawName = text(req.headers['x-file-name'], 240);
            try { return decodeURIComponent(rawName) || storageKey; } catch { return rawName || storageKey; }
          })(),
          mimeType,
          size: buffer.length,
          storageKey,
          url: `${mediaPublicPrefix}/${storageKey}`,
          ...(derivedFromAssetId && crop ? { derivedFromAssetId, crop } : {}),
          status: 'active',
          createdAt: now,
          updatedAt: now,
        };
        await db.collection('listening_assets').doc(asset.id).set(asset);
        res.status(201).json(asset);
      } catch (error) {
        if (temporaryPath && fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
        sendError(res, error);
      }
    }
  );

  router.delete('/admin/assets/:id', authenticateUser, requireStaff, async (req, res) => {
    try {
      const document = await db.collection('listening_assets').doc(req.params.id).get();
      if (!document.exists) throw apiError(404, 'Không tìm thấy media.');
      const asset = { id: document.id, ...document.data() };
      if (!isSuperAdmin(req.user) && asset.ownerId !== req.user!.id) throw apiError(403, 'Bạn không có quyền lưu trữ media này.');
      const usage = await db.collection('listening_asset_usages').where('assetId', '==', asset.id).get();
      if (!usage.empty) throw apiError(409, 'Media đang được một phiên bản đã xuất bản sử dụng.');
      await document.ref.update({ status: 'archived', updatedAt: nowIso() });
      res.json({ success: true });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post('/admin/smart-import/analyze', authenticateUser, requireStaff, async (req, res) => {
    try {
      if (!req.user) throw apiError(401, 'Vui lòng đăng nhập.');
      if (smartImport?.enabled === false) throw apiError(503, smartImport.reason || 'Smart Import đang tắt.');
      const usageKey = req.user.id;
      const windowStart = Date.now() - 10 * 60 * 1000;
      const recentUsage = (smartImportUsage.get(usageKey) || []).filter(timestamp => timestamp >= windowStart);
      if (recentUsage.length >= 20) throw apiError(429, 'Đã đạt giới hạn 20 lượt Smart Import trong 10 phút.');
      recentUsage.push(Date.now());
      smartImportUsage.set(usageKey, recentUsage);
      if (req.body?.moduleId !== 'mover') throw apiError(400, 'Smart Import hiện chỉ hỗ trợ Mover.');
      const part = Number(req.body?.part);
      if (![1, 2, 3, 4, 5].includes(part)) throw apiError(400, 'Part không hợp lệ.');
      const currentPart = req.body?.currentPart as ListeningSetContent['parts'][number];
      if (!currentPart || currentPart.part !== part) throw apiError(400, 'Dữ liệu Part hiện tại không hợp lệ.');
      const basePartHash = text(req.body?.basePartHash, 64).toLowerCase();
      if (!/^[0-9a-f]{64}$/.test(basePartHash)) throw apiError(400, 'Thiếu hash của Part hiện tại.');
      if (sha256(JSON.stringify(currentPart)) !== basePartHash) {
        throw apiError(409, 'Part đã thay đổi trước khi bắt đầu phân tích.', {
          code: 'LISTENING_IMPORT_BASE_CHANGED',
        });
      }
      const pastedText = text(req.body?.pastedText, 12000);
      const roleDefinitions = getListeningSmartImportRoleDefinitions(part as 1 | 2 | 3 | 4 | 5);
      const allowedRoles = new Set(roleDefinitions.map(definition => definition.role));
      const rawSources = Array.isArray(req.body?.sources) ? req.body.sources : [];
      const sources: ListeningSmartImportSource[] = [];
      const seenRoles = new Set<string>();
      const seenAssets = new Set<string>();
      for (const rawSource of rawSources.slice(0, 3)) {
        const role = text(rawSource?.role, 40) as ListeningSmartImportSource['role'];
        const assetId = text(rawSource?.assetId, 160);
        if (!allowedRoles.has(role) || !assetId) throw apiError(400, 'Role hoặc asset Smart Import không hợp lệ.');
        if (seenRoles.has(role)) throw apiError(400, `Role ${role} bị trùng.`);
        if (seenAssets.has(assetId)) throw apiError(400, 'Một asset không được dùng đồng thời cho nhiều role.');
        seenRoles.add(role);
        seenAssets.add(assetId);
        sources.push({ role, assetId });
      }
      const missingRoles = roleDefinitions.filter(definition => definition.required && !seenRoles.has(definition.role));
      const answerTextFallback = Boolean(pastedText) && (part === 2 || part === 3);
      const effectiveMissingRoles = missingRoles.filter(definition => !(answerTextFallback && definition.role === 'answer_key'));
      if (effectiveMissingRoles.length) {
        throw apiError(400, `Thiếu nguồn bắt buộc: ${effectiveMissingRoles.map(definition => definition.label).join(', ')}.`);
      }
      const images: SmartImportImageInput[] = [];
      let totalImageBytes = 0;
      for (const source of sources) {
        const assetId = source.assetId;
        const document = await db.collection('listening_assets').doc(assetId).get();
        if (!document.exists) throw apiError(404, `Không tìm thấy ảnh nguồn ${assetId}.`);
        const asset = { id: document.id, ...document.data() } as ListeningAsset;
        if (!isSuperAdmin(req.user) && asset.ownerId !== req.user.id) {
          throw apiError(403, 'Bạn không có quyền dùng một ảnh nguồn đã chọn.');
        }
        if (asset.status !== 'active' || asset.kind !== 'image' || !asset.mimeType.startsWith('image/')) {
          throw apiError(400, 'Smart Import chỉ nhận ảnh đang hoạt động; audio không bao giờ được gửi đi phân tích.');
        }
        const root = path.resolve(mediaDir);
        const filePath = path.resolve(mediaDir, asset.storageKey);
        if (!filePath.startsWith(`${root}${path.sep}`)) throw apiError(400, 'Đường dẫn ảnh nguồn không hợp lệ.');
        const data = await fs.promises.readFile(filePath);
        if (data.length > IMAGE_MAX_BYTES) throw apiError(413, 'Một ảnh nguồn vượt quá giới hạn dung lượng.');
        totalImageBytes += data.length;
        if (totalImageBytes > 30 * 1024 * 1024) throw apiError(413, 'Tổng dung lượng ảnh nguồn vượt quá 30 MB.');
        images.push({ assetId, role: source.role, mimeType: asset.mimeType, data });
      }
      const importAbortController = new AbortController();
      const importPromise = createListeningSmartImportCandidate({
        part: part as 1 | 2 | 3 | 4 | 5,
        currentPart,
        basePartHash,
        sources,
        pastedText,
        images,
        analyzeVision: smartImport?.analyzeVision,
        signal: importAbortController.signal,
      });
      let timeoutId: NodeJS.Timeout | undefined;
      const timeoutPromise = new Promise<never>((_resolve, reject) => {
        timeoutId = setTimeout(() => {
          importAbortController.abort();
          reject(apiError(504, 'Smart Import quá thời gian xử lý 45 giây.'));
        }, 45_000);
      });
      const candidate = await Promise.race([importPromise, timeoutPromise]).finally(() => {
        if (timeoutId) clearTimeout(timeoutId);
      });
      await logAudit?.(
        req.user.id,
        req.user.name,
        req.user.email,
        'ANALYZE_LISTENING_PART',
        `Smart Import Mover Part ${part}; candidate ${candidate.id}; ${sources.length} ảnh role-based; provider ${candidate.provider}.`
      );
      res.json(candidate);
    } catch (error) {
      sendError(res, error);
    }
  });

  router.get('/admin/sets', authenticateUser, requireStaff, async (req, res) => {
    try {
      const snapshot = isSuperAdmin(req.user)
        ? await db.collection('listening_sets').get()
        : await db.collection('listening_sets').where('ownerId', '==', req.user!.id).get();
      const sets: any[] = [];
      snapshot.forEach((document: any) => {
        const set = { id: document.id, ...document.data() };
        if (belongsToMoverModule(set)) sets.push(withListeningModuleMetadata(set));
      });
      sets.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
      res.json(sets);
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post('/admin/sets', authenticateUser, requireStaff, async (req, res) => {
    try {
      if (!req.user) throw apiError(401, 'Vui lòng đăng nhập.');
      const rawContent = req.body?.content as ListeningSetContent;
      if (!rawContent || rawContent.schemaVersion !== 1) throw apiError(400, 'Cấu trúc bộ đề không hợp lệ.');
      const content = withMoverContentMetadata(rawContent);
      const now = nowIso();
      const set = {
        id: identifier('listen'),
        moduleId: DEFAULT_LISTENING_MODULE_ID,
        schemaVersion: LISTENING_LIBRARY_SCHEMA_VERSION,
        moduleSchemaVersion: LISTENING_LIBRARY_SCHEMA_VERSION,
        ownerId: req.user.id,
        createdBy: req.user.id,
        title: text(content.title, 160) || 'Bộ đề nghe mới',
        description: text(content.description, 2000),
        level: text(content.level, 80),
        status: 'draft',
        visibility: 'draft',
        draftRevision: 1,
        draftContent: content,
        validationErrors: validateListeningSetContent(content),
        createdAt: now,
        updatedAt: now,
      };
      await db.collection('listening_sets').doc(set.id).set(set);
      await logAudit?.(req.user.id, req.user.name, req.user.email, 'CREATE_LISTENING_SET', `Tạo bộ đề nghe "${set.title}".`);
      res.status(201).json(set);
    } catch (error) {
      sendError(res, error);
    }
  });

  router.get('/admin/sets/:id', authenticateUser, requireStaff, async (req, res) => {
    try {
      const set = await getSet(db, req.params.id);
      if (!set) throw apiError(404, 'Không tìm thấy bộ đề nghe.');
      if (!canManageSet(req.user, set)) throw apiError(403, 'Bạn không có quyền xem bộ đề này.');
      const versionsSnapshot = await db.collection('listening_set_versions').where('setId', '==', set.id).get();
      const versions: any[] = [];
      versionsSnapshot.forEach((document: any) => versions.push({ id: document.id, ...document.data() }));
      versions.sort((a, b) => Number(b.versionNumber) - Number(a.versionNumber));
      res.json({ ...set, versions });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.put('/admin/sets/:id', authenticateUser, requireStaff, async (req, res) => {
    try {
      const updated = await withDraftLock(req.params.id, async () => {
        const set = await getSet(db, req.params.id);
        if (!set) throw apiError(404, 'Không tìm thấy bộ đề nghe.');
        if (!canManageSet(req.user, set)) throw apiError(403, 'Bạn không có quyền sửa bộ đề này.');
        if (set.status === 'archived') throw apiError(409, 'Bộ đề đã được lưu trữ.');
        const rawContent = req.body?.content as ListeningSetContent;
        if (!rawContent || rawContent.schemaVersion !== 1) throw apiError(400, 'Cấu trúc bộ đề không hợp lệ.');
        const content = withMoverContentMetadata(rawContent);
        const currentRevision = Number(set.draftRevision || 0);
        if (
          req.body?.baseRevision !== undefined
          && Number(req.body.baseRevision) !== currentRevision
        ) {
          throw apiError(409, 'Bản nháp đã thay đổi ở một phiên làm việc khác.', {
            code: 'LISTENING_DRAFT_REVISION_CONFLICT',
            currentRevision,
          });
        }
        const visibility = ['draft', 'public', 'assignment'].includes(req.body?.visibility)
          ? req.body.visibility
          : set.visibility;
        const shareToken = visibility === 'assignment'
          ? (set.shareToken || crypto.randomBytes(18).toString('base64url'))
          : undefined;
        const next = {
          ...set,
          moduleId: DEFAULT_LISTENING_MODULE_ID,
          schemaVersion: LISTENING_LIBRARY_SCHEMA_VERSION,
          moduleSchemaVersion: LISTENING_LIBRARY_SCHEMA_VERSION,
          title: text(content.title, 160),
          description: text(content.description, 2000),
          level: text(content.level, 80),
          visibility,
          draftRevision: currentRevision + 1,
          draftContent: content,
          validationErrors: validateListeningSetContent(content),
          updatedAt: nowIso(),
          ...(shareToken ? { shareToken, assignmentSlug: shareToken } : {}),
        };
        if (!shareToken) {
          delete next.shareToken;
          delete next.assignmentSlug;
        }
        await db.collection('listening_sets').doc(set.id).set(next);
        return next;
      });
      res.json(updated);
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post('/admin/sets/:id/draft/autosave', authenticateUser, requireStaff, async (req, res) => {
    try {
      const updated = await withDraftLock(req.params.id, async () => {
        const set = await getSet(db, req.params.id);
        if (!set) throw apiError(404, 'Không tìm thấy bộ đề nghe.');
        if (!canManageSet(req.user, set)) throw apiError(403, 'Bạn không có quyền sửa bộ đề này.');
        if (set.status === 'archived') throw apiError(409, 'Bộ đề đã được lưu trữ.');
        const rawContent = req.body?.content as ListeningSetContent;
        if (!rawContent || rawContent.schemaVersion !== 1) throw apiError(400, 'Cấu trúc bộ đề không hợp lệ.');
        const baseRevision = Number(req.body?.baseRevision);
        const currentRevision = Number(set.draftRevision || 0);
        if (!Number.isInteger(baseRevision) || baseRevision !== currentRevision) {
          throw apiError(409, 'Bản nháp đã thay đổi ở một phiên làm việc khác.', {
            code: 'LISTENING_DRAFT_REVISION_CONFLICT',
            currentRevision,
          });
        }
        const content = withMoverContentMetadata(rawContent);
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
          visibility,
          draftRevision: currentRevision + 1,
          draftContent: content,
          validationErrors: validateListeningSetContent(content),
          updatedAt,
          ...(shareToken ? { shareToken, assignmentSlug: shareToken } : {}),
        };
        if (!shareToken) {
          delete next.shareToken;
          delete next.assignmentSlug;
        }
        await db.collection('listening_sets').doc(set.id).set(next);
        return next;
      });
      res.json({
        draftRevision: updated.draftRevision,
        updatedAt: updated.updatedAt,
        validationErrors: updated.validationErrors,
      });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post('/admin/sets/:id/publish', authenticateUser, requireStaff, async (req, res) => {
    try {
      if (!req.user) throw apiError(401, 'Vui lòng đăng nhập.');
      const set = await getSet(db, req.params.id);
      if (!set) throw apiError(404, 'Không tìm thấy bộ đề nghe.');
      if (!canManageSet(req.user, set)) throw apiError(403, 'Bạn không có quyền xuất bản bộ đề này.');
      if (set.status === 'archived') throw apiError(409, 'Bộ đề đã được lưu trữ.');
      const draftContent = withMoverContentMetadata(set.draftContent as ListeningSetContent);
      const errors = validateListeningSetContent(draftContent);
      if (errors.length) throw apiError(422, 'Bộ đề chưa đủ điều kiện xuất bản.', errors);
      const resolved = await resolveContentAssets(db, draftContent, req.user);

      const versionsSnapshot = await db.collection('listening_set_versions').where('setId', '==', set.id).get();
      let versionNumber = 1;
      versionsSnapshot.forEach((document: any) => {
        versionNumber = Math.max(versionNumber, Number(document.data()?.versionNumber || 0) + 1);
      });
      const now = nowIso();
      const version = {
        id: identifier('listenver'),
        moduleId: DEFAULT_LISTENING_MODULE_ID,
        moduleSchemaVersion: LISTENING_LIBRARY_SCHEMA_VERSION,
        schemaVersion: draftContent.schemaVersion,
        setId: set.id,
        versionNumber,
        status: 'published',
        content: resolved.content,
        createdAt: now,
        updatedAt: now,
        publishedAt: now,
      };
      const batch = db.batch();
      batch.set(db.collection('listening_set_versions').doc(version.id), version);
      if (set.publishedVersionId) {
        const previous = await getVersion(db, set.publishedVersionId);
        if (previous) {
          batch.update(db.collection('listening_set_versions').doc(previous.id), {
            status: 'superseded',
            updatedAt: now,
          });
        }
      }
      const publishedSet = {
        ...set,
        moduleId: DEFAULT_LISTENING_MODULE_ID,
        schemaVersion: LISTENING_LIBRARY_SCHEMA_VERSION,
        moduleSchemaVersion: LISTENING_LIBRARY_SCHEMA_VERSION,
        draftContent,
        title: resolved.content.title,
        description: resolved.content.description,
        level: resolved.content.level,
        coverUrl: resolved.content.coverUrl || '',
        backgroundUrl: resolved.content.backgroundUrl || '',
        timeLimitMinutes: resolved.content.timeLimitMinutes,
        status: 'published',
        publishedVersionId: version.id,
        publishedVersionNumber: versionNumber,
        validationErrors: [],
        updatedAt: now,
      };
      batch.set(db.collection('listening_sets').doc(set.id), publishedSet);
      resolved.references.forEach(reference => {
        const usageId = `lusage-${sha256(`${version.id}:${reference.id}:${reference.entityId}:${reference.role}`).slice(0, 32)}`;
        batch.set(db.collection('listening_asset_usages').doc(usageId), {
          id: usageId,
          assetId: reference.id,
          setId: set.id,
          versionId: version.id,
          entityId: reference.entityId,
          role: reference.role,
          createdAt: now,
          updatedAt: now,
        });
      });
      await batch.commit();
      await logAudit?.(req.user.id, req.user.name, req.user.email, 'PUBLISH_LISTENING_SET', `Xuất bản "${publishedSet.title}" phiên bản ${versionNumber}.`);
      res.json({ set: publishedSet, version });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.delete('/admin/sets/:id', authenticateUser, requireStaff, async (req, res) => {
    try {
      const set = await getSet(db, req.params.id);
      if (!set) throw apiError(404, 'Không tìm thấy bộ đề nghe.');
      if (!canManageSet(req.user, set)) throw apiError(403, 'Bạn không có quyền lưu trữ bộ đề này.');
      const updatedAt = nowIso();
      await db.collection('listening_sets').doc(set.id).update({ status: 'archived', updatedAt });
      res.json({ success: true, recoverable: true, status: 'archived', updatedAt });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.get('/admin/sets/:id/results', authenticateUser, requireStaff, async (req, res) => {
    try {
      const set = await getSet(db, req.params.id);
      if (!set) throw apiError(404, 'Không tìm thấy bộ đề nghe.');
      if (!canManageSet(req.user, set)) throw apiError(403, 'Bạn không có quyền xem kết quả.');
      const snapshot = await db.collection('listening_attempts').where('setId', '==', set.id).get();
      const attempts: any[] = [];
      snapshot.forEach((document: any) => {
        const { runSecretHash: _secret, ...attempt } = { id: document.id, ...document.data() };
        attempts.push(attempt);
      });
      attempts.sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt)));
      res.json({ set: publicSetSummary(set), attempts });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.get('/sets', authenticateOptionalUser, async (req, res) => {
    try {
      const snapshot = await db.collection('listening_sets').get();
      const sets: any[] = [];
      snapshot.forEach((document: any) => {
        const set = { id: document.id, ...document.data() };
        if (!belongsToMoverModule(set)) return;
        const canSee = set.status === 'published' && (
          set.visibility === 'public'
          || req.user?.role === 'super_admin'
          || canManageSet(req.user, set)
        );
        if (canSee) sets.push(publicSetSummary(set));
      });
      sets.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
      res.json(sets);
    } catch (error) {
      sendError(res, error);
    }
  });

  router.get('/sets/:id', authenticateOptionalUser, async (req, res) => {
    try {
      const set = await getSet(db, req.params.id);
      await resolveLearningAccess(db, set, req);
      const version = await getVersion(db, set.publishedVersionId);
      if (!version) throw apiError(404, 'Không tìm thấy phiên bản đã xuất bản.');
      res.json(playableSet(set, version));
    } catch (error) {
      sendError(res, error);
    }
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
      const deadlineAt = set.timeLimitMinutes
        ? new Date(Date.now() + Number(set.timeLimitMinutes) * 60_000).toISOString()
        : undefined;
      const ticketExpiresAt = Date.now() + (deadlineAt ? 24 * 60 * 60_000 : 7 * 24 * 60 * 60_000);
      const payload = {
        schemaVersion: LISTENING_LIBRARY_SCHEMA_VERSION,
        moduleId: DEFAULT_LISTENING_MODULE_ID,
        setId: set.id,
        versionId: version.id,
        ownerKey: actor.ownerKey,
        assignmentId: access.assignment?.id || '',
        classId: access.assignment?.classId || '',
        className: access.assignment?.className || '',
        assignmentTitle: access.assignment?.title || access.assignment?.resourceTitle || '',
        clientRunId,
        runSecretHash: sha256(runSecret),
        startedAt,
        deadlineAt,
        ticketExpiresAt,
      };
      res.json({
        ticket: encodeTicket(payload, ticketSecret),
        set: playableSet(set, version),
        startedAt,
        deadlineAt,
        clientRunId,
      });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post('/sets/:id/attempts/submit', authenticateOptionalUser, async (req, res) => {
    try {
      const ticket = decodeTicket(req.body?.ticket, ticketSecret);
      if (ticket.setId !== req.params.id) throw apiError(400, 'Phiếu làm bài không thuộc bộ đề này.');
      const runSecret = text(req.body?.runSecret, 300);
      if (!runSecret || !timingSafeEqual(sha256(runSecret), ticket.runSecretHash)) {
        throw apiError(401, 'Mã xác nhận lượt làm bài không hợp lệ.');
      }
      const actor = await resolveActor(req, resolveGuestProfile);
      if (actor.ownerKey !== ticket.ownerKey) throw apiError(403, 'Lượt làm bài không thuộc học sinh này.');

      const attemptId = `lattempt-${sha256(`${ticket.ownerKey}:${ticket.setId}:${ticket.clientRunId}`).slice(0, 40)}`;
      const existingDocument = await db.collection('listening_attempts').doc(attemptId).get();
      if (existingDocument.exists) {
        const existing = { id: existingDocument.id, ...existingDocument.data() };
        if (!timingSafeEqual(String(existing.runSecretHash || ''), ticket.runSecretHash)) {
          throw apiError(409, 'Mã lượt làm bài đã được sử dụng.');
        }
        const { runSecretHash: _secret, ...safeAttempt } = existing;
        return res.json({ ...safeAttempt, idempotentReplay: true });
      }

      const version = await getVersion(db, ticket.versionId);
      if (!version || version.setId !== ticket.setId) throw apiError(404, 'Phiên bản làm bài không còn khả dụng.');
      const answers = sanitizeListeningAnswers(req.body?.answers) as ListeningAnswers;
      const grade = gradeListeningAttempt(version.content, answers);
      const completedAt = nowIso();
      const startedAtMs = new Date(ticket.startedAt).getTime();
      const durationSeconds = Math.max(0, Math.round((Date.now() - startedAtMs) / 1000));
      const timedOut = Boolean(ticket.deadlineAt && Date.now() >= new Date(ticket.deadlineAt).getTime());
      const attempt = {
        id: attemptId,
        moduleId: resolveListeningModuleId(ticket.moduleId),
        schemaVersion: Number(ticket.schemaVersion || LISTENING_LIBRARY_SCHEMA_VERSION),
        ownerKey: ticket.ownerKey,
        userId: actor.userId,
        guestId: actor.guestId,
        studentName: actor.studentName,
        setId: ticket.setId,
        versionId: ticket.versionId,
        assignmentId: ticket.assignmentId || '',
        classId: ticket.classId || '',
        className: ticket.className || '',
        assignmentTitle: ticket.assignmentTitle || '',
        clientRunId: ticket.clientRunId,
        runSecretHash: ticket.runSecretHash,
        setTitle: version.content.title,
        score: grade.score,
        correctCount: grade.correctCount,
        incorrectCount: grade.incorrectCount,
        unansweredCount: grade.unansweredCount,
        totalCount: grade.totalCount,
        startedAt: ticket.startedAt,
        completedAt,
        durationSeconds,
        timedOut,
        status: 'completed',
        gradingVersion: LISTENING_GRADING_VERSION,
        createdAt: completedAt,
        updatedAt: completedAt,
      };
      const answerDetails = buildListeningActivityAnswerDetails(version.content, answers, grade.questions);
      const detail = {
        id: attemptId,
        attemptId,
        answers,
        questions: grade.questions,
        answerDetails,
        questionSnapshots: answerDetails.map(item => ({
          questionId: item.questionId,
          questionText: item.questionText,
          part: item.part,
        })),
        optionSnapshots: [],
        extraDetails: {
          moduleId: resolveListeningModuleId(ticket.moduleId),
          schemaVersion: Number(ticket.schemaVersion || LISTENING_LIBRARY_SCHEMA_VERSION),
          setId: ticket.setId,
          versionId: ticket.versionId,
          gradingVersion: LISTENING_GRADING_VERSION,
        },
        reviewPolicy: {
          showReviewAfterSubmit: true,
          showExplanationImmediately: false,
          policyVersion: 2,
        },
        gradingVersion: LISTENING_GRADING_VERSION,
        createdAt: completedAt,
        updatedAt: completedAt,
      };
      const batch = db.batch();
      batch.set(db.collection('listening_attempts').doc(attemptId), attempt);
      batch.set(db.collection('listening_attempt_details').doc(attemptId), detail);
      await batch.commit();
      const { runSecretHash: _secret, ...safeAttempt } = attempt;
      res.status(201).json(safeAttempt);
    } catch (error) {
      sendError(res, error);
    }
  });

  router.get('/sets/:id/my-attempts', authenticateOptionalUser, async (req, res) => {
    try {
      const actor = await resolveActor(req, resolveGuestProfile);
      const snapshot = await db.collection('listening_attempts')
        .where('setId', '==', req.params.id)
        .where('ownerKey', '==', actor.ownerKey)
        .get();
      const attempts: any[] = [];
      snapshot.forEach((document: any) => {
        const { runSecretHash: _secret, ...attempt } = { id: document.id, ...document.data() };
        attempts.push(attempt);
      });
      attempts.sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt)));
      res.json(attempts);
    } catch (error) {
      sendError(res, error);
    }
  });

  return router;
}
