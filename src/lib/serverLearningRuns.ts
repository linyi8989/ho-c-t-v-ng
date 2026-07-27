import crypto from 'node:crypto';

function normalizeRunKeyPart(value: unknown) {
  return String(value || '').normalize('NFKC').trim().slice(0, 240);
}

export function deterministicRunDocumentId(prefix: string, parts: unknown[]) {
  const digest = crypto.createHash('sha256')
    .update(parts.map(normalizeRunKeyPart).join('\u001f'))
    .digest('hex');
  return `${prefix}-${digest.slice(0, 40)}`;
}

export function normalizeClientStartedAt(value: unknown, fallback = new Date().toISOString()) {
  const parsed = new Date(String(value || ''));
  if (Number.isNaN(parsed.getTime())) return fallback;
  const now = Date.now();
  const clamped = Math.max(now - 24 * 60 * 60 * 1000, Math.min(now, parsed.getTime()));
  return new Date(clamped).toISOString();
}
