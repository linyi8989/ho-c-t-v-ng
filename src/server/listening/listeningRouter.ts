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
import {
  sanitizeListeningAnswers,
  sanitizeListeningContentForStudent,
  validateListeningSetContent,
} from './listeningValidation.js';

type Middleware = express.RequestHandler;

interface ListeningRouterDependencies {
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
  content.parts[2].options.forEach(option => add(option.imageAssetId, 'image', option.id, 'part3-option'));
  content.parts[2].items.forEach(item => add(item.imageAssetId, 'image', item.id, 'part3-item'));
  if (content.parts[2].example) {
    add(content.parts[2].example.item.imageAssetId, 'image', content.parts[2].example.item.id, 'part3-example');
  }
  content.parts[3].questions.forEach(question => {
    question.options.forEach(option => add(option.imageAssetId, 'image', `${question.id}:${option.id}`, 'part4-option'));
  });
  if (content.parts[3].example) {
    content.parts[3].example.options.forEach(option => add(option.imageAssetId, 'image', `example:${option.id}`, 'part4-example'));
  }
  add(content.parts[4].sceneAssetId, 'image', 'part-5', 'scene');
  return references;
}

async function resolveContentAssets(db: any, content: ListeningSetContent, user: any) {
  const clone = structuredClone(content);
  clone.parts[2].options.forEach((option, index) => {
    option.label = String.fromCharCode(65 + index);
  });
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
  clone.parts[2].options.forEach(option => { option.imageUrl = url(option.imageAssetId); });
  clone.parts[2].items.forEach(item => { item.imageUrl = url(item.imageAssetId); });
  if (clone.parts[2].example) {
    clone.parts[2].example.item.imageUrl = url(clone.parts[2].example.item.imageAssetId);
  }
  clone.parts[3].questions.forEach(question => {
    question.options.forEach(option => { option.imageUrl = url(option.imageAssetId); });
  });
  if (clone.parts[3].example) {
    clone.parts[3].example.options.forEach(option => { option.imageUrl = url(option.imageAssetId); });
  }
  clone.parts[4].sceneUrl = url(clone.parts[4].sceneAssetId);
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
  } = dependencies;
  const router = express.Router();
  fs.mkdirSync(mediaDir, { recursive: true });

  router.get('/capabilities', authenticateUser, requireStaff, (_req, res) => {
    res.json({
      imageGeneration: {
        enabled: false,
        reason: 'Chưa cấu hình nhà cung cấp tạo ảnh ở backend. Có thể dùng tải lên hoặc thư viện media.',
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
          if (!existing && (isSuperAdmin(req.user) || data.ownerId === req.user!.id)) existing = data;
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
      const set = await getSet(db, req.params.id);
      if (!set) throw apiError(404, 'Không tìm thấy bộ đề nghe.');
      if (!canManageSet(req.user, set)) throw apiError(403, 'Bạn không có quyền sửa bộ đề này.');
      if (set.status === 'archived') throw apiError(409, 'Bộ đề đã được lưu trữ.');
      const rawContent = req.body?.content as ListeningSetContent;
      if (!rawContent || rawContent.schemaVersion !== 1) throw apiError(400, 'Cấu trúc bộ đề không hợp lệ.');
      const content = withMoverContentMetadata(rawContent);
      const visibility = ['draft', 'public', 'assignment'].includes(req.body?.visibility)
        ? req.body.visibility
        : set.visibility;
      const shareToken = visibility === 'assignment'
        ? (set.shareToken || crypto.randomBytes(18).toString('base64url'))
        : undefined;
      const updated = {
        ...set,
        moduleId: DEFAULT_LISTENING_MODULE_ID,
        schemaVersion: LISTENING_LIBRARY_SCHEMA_VERSION,
        moduleSchemaVersion: LISTENING_LIBRARY_SCHEMA_VERSION,
        title: text(content.title, 160),
        description: text(content.description, 2000),
        level: text(content.level, 80),
        visibility,
        draftContent: content,
        validationErrors: validateListeningSetContent(content),
        updatedAt: nowIso(),
        ...(shareToken ? { shareToken, assignmentSlug: shareToken } : {}),
      };
      if (!shareToken) {
        delete updated.shareToken;
        delete updated.assignmentSlug;
      }
      await db.collection('listening_sets').doc(set.id).set(updated);
      res.json(updated);
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
      const answerForQuestion = (part: number, questionId: string) => {
        if (part === 1) return answers.part1[questionId] || '';
        if (part === 2) return Object.values(answers.part2[questionId] || {}).filter(Boolean).join(' | ');
        if (part === 3) return answers.part3[questionId] || '';
        if (part === 4) return answers.part4[questionId] || '';
        return answers.part5[questionId] || '';
      };
      const answerDetails = grade.questions.map(question => ({
        questionId: question.questionId,
        questionText: `Part ${question.part} • ${question.questionId}`,
        part: question.part,
        userAnswer: answerForQuestion(question.part, question.questionId),
        isCorrect: question.correct,
        unanswered: question.unanswered,
      }));
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
        reviewPolicy: { revealCorrectAnswers: false },
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
