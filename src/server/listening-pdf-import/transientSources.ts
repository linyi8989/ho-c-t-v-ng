import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const SUPPORTED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

interface TransientPayload {
  version: 1;
  sourceId: string;
  ownerId: string;
  mimeType: string;
  expiresAt: number;
}

export interface ListeningPdfTransientSource {
  token: string;
  expiresAt: number;
}

export interface ResolvedListeningPdfTransientSource {
  sourceId: string;
  mimeType: string;
  data: Buffer;
  remove: () => Promise<void>;
}

interface ListeningPdfTransientSourceStoreOptions {
  directory: string;
  secret: string;
  ttlMs?: number;
}

const safeEqual = (left: string, right: string) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const sourcePath = (directory: string, payload: TransientPayload) => {
  const extension = EXTENSIONS[payload.mimeType];
  if (!extension || !/^[0-9a-f-]{36}$/i.test(payload.sourceId)) throw new Error('Nguồn PDF tạm không hợp lệ.');
  const root = path.resolve(directory);
  const filePath = path.resolve(directory, `${payload.sourceId}${extension}`);
  if (!filePath.startsWith(`${root}${path.sep}`)) throw new Error('Đường dẫn nguồn PDF tạm không hợp lệ.');
  return filePath;
};

export function createListeningPdfTransientSourceStore(options: ListeningPdfTransientSourceStoreOptions) {
  const ttlMs = Math.min(30 * 60 * 1000, Math.max(60 * 1000, options.ttlMs || 10 * 60 * 1000));
  fs.mkdirSync(options.directory, { recursive: true });

  const sign = (encoded: string) => crypto.createHmac('sha256', options.secret)
    .update(`listening-pdf-source:${encoded}`)
    .digest('base64url');

  const decode = (token: unknown, ownerId: string): TransientPayload => {
    const [encoded, signature, extra] = String(token || '').split('.');
    if (!encoded || !signature || extra || !safeEqual(signature, sign(encoded))) {
      throw new Error('Phiếu nguồn PDF tạm không hợp lệ.');
    }
    let payload: TransientPayload;
    try {
      payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    } catch {
      throw new Error('Phiếu nguồn PDF tạm không hợp lệ.');
    }
    if (
      payload.version !== 1
      || payload.ownerId !== ownerId
      || !SUPPORTED_MIME_TYPES.has(payload.mimeType)
      || !Number.isFinite(payload.expiresAt)
    ) throw new Error('Phiếu nguồn PDF tạm không hợp lệ.');
    if (payload.expiresAt < Date.now()) throw new Error('Nguồn PDF tạm đã hết hạn. Vui lòng thử lại.');
    return payload;
  };

  const removePayload = async (payload: TransientPayload) => {
    const filePath = sourcePath(options.directory, payload);
    await fs.promises.rm(filePath, { force: true });
  };

  return {
    async create(ownerId: string, mimeType: string, data: Buffer): Promise<ListeningPdfTransientSource> {
      if (!ownerId || !SUPPORTED_MIME_TYPES.has(mimeType) || !data.length) {
        throw new Error('Nguồn ảnh PDF tạm không hợp lệ.');
      }
      const payload: TransientPayload = {
        version: 1,
        sourceId: crypto.randomUUID(),
        ownerId,
        mimeType,
        expiresAt: Date.now() + ttlMs,
      };
      const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const filePath = sourcePath(options.directory, payload);
      await fs.promises.writeFile(filePath, data, { flag: 'wx' });
      const cleanupTimer = setTimeout(() => { void removePayload(payload); }, ttlMs + 1000);
      cleanupTimer.unref?.();
      return { token: `${encoded}.${sign(encoded)}`, expiresAt: payload.expiresAt };
    },

    async resolve(token: unknown, ownerId: string): Promise<ResolvedListeningPdfTransientSource> {
      const payload = decode(token, ownerId);
      const filePath = sourcePath(options.directory, payload);
      let data: Buffer;
      try {
        data = await fs.promises.readFile(filePath);
      } catch (reason: any) {
        if (reason?.code === 'ENOENT') throw new Error('Nguồn PDF tạm không còn tồn tại. Vui lòng tải lại.');
        throw reason;
      }
      return {
        sourceId: payload.sourceId,
        mimeType: payload.mimeType,
        data,
        remove: () => removePayload(payload),
      };
    },
  };
}

