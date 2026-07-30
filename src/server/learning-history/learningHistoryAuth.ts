import crypto from 'node:crypto';
import type { Request } from 'express';
import { findGuestHistoryCapability } from './learningHistoryRepository';
import type { LearningHistoryActor } from './learningHistoryTypes';

export class LearningHistoryAuthError extends Error {
  public status: number;
  public code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'LearningHistoryAuthError';
    this.status = status;
    this.code = code;
  }
}

function header(req: Request, name: string) {
  const value = req.headers[name.toLowerCase()];
  return Array.isArray(value) ? '' : String(value || '').trim();
}

function safeGuestId(value: string) {
  const normalized = value.normalize('NFKC').trim();
  if (!normalized || normalized.length > 120 || !/^[A-Za-z0-9._:-]+$/.test(normalized)) {
    throw new LearningHistoryAuthError(401, 'GUEST_CAPABILITY_REQUIRED', 'Cần xác minh quyền xem lịch sử.');
  }
  return normalized;
}

function tokenMatches(token: string, expectedHash: string) {
  if (!token || token.length < 32 || token.length > 512) return false;
  if (!/^[a-f0-9]{64}$/i.test(expectedHash)) return false;
  const actual = crypto.createHash('sha256').update(token).digest();
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export async function resolveLearningHistoryActor(req: Request): Promise<LearningHistoryActor> {
  const user = (req as any).user;
  if (user?.id) {
    return {
      id: String(user.id),
      ownerKey: `user:${user.id}`,
      kind: 'user',
      role: user.role === 'super_admin' || user.role === 'teacher' ? user.role : 'student',
      userProfile: user,
    };
  }

  const guestId = safeGuestId(header(req, 'x-guest-id'));
  const accessToken = header(req, 'x-guest-access-token');
  const capability = await findGuestHistoryCapability(guestId);
  if (!capability || capability.status === 'blocked') {
    throw new LearningHistoryAuthError(401, 'GUEST_CAPABILITY_REQUIRED', 'Cần xác minh quyền xem lịch sử.');
  }
  if (!capability.access_token_hash) {
    throw new LearningHistoryAuthError(
      403,
      'GUEST_HISTORY_RECOVERY_REQUIRED',
      'Hồ sơ cũ cần giáo viên xác minh để khôi phục quyền xem lịch sử.',
    );
  }
  if (!tokenMatches(accessToken, capability.access_token_hash)) {
    throw new LearningHistoryAuthError(401, 'GUEST_CAPABILITY_INVALID', 'Cần xác minh quyền xem lịch sử.');
  }
  return {
    id: guestId,
    ownerKey: `guest:${guestId}`,
    kind: 'guest',
    role: 'student',
  };
}
