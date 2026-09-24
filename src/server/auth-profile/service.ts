import { authProfileHttpError } from './contracts.js';

interface AuthProfileServiceOptions {
  repository: ReturnType<typeof import('./repository.js').createAuthProfileRepository>;
  provider: {
    verifyPassword(email: string, password: string): Promise<{ localId: string }>;
    createCustomToken(userId: string): Promise<string>;
  };
  normalizePhone: (value: any) => string;
  normalizeEmail: (value: any) => string;
  validateDisplayName: (value: any) => { valid: boolean; value?: string; error?: string };
  invalidateStudentNameCache: () => void;
  consumePhoneAttempt: (key: string) => { allowed: boolean; retryAfterSeconds: number };
  now?: () => Date;
}

export function createAuthProfileService(options: AuthProfileServiceOptions) {
  const now = options.now || (() => new Date());

  const assertPhoneAttempt = (networkKey: string, phone: string) => {
    const result = options.consumePhoneAttempt(`${networkKey}:${phone}`);
    if (!result.allowed) {
      throw authProfileHttpError(
        429,
        'Too many phone login attempts. Please wait and try again.',
        { retryAfterSeconds: result.retryAfterSeconds },
      );
    }
  };

  const getPhoneLoginHint = async (phoneValue: any, networkKey: string) => {
    const normalizedPhone = options.normalizePhone(phoneValue);
    if (!normalizedPhone) throw authProfileHttpError(400, 'Invalid phone number.');
    assertPhoneAttempt(networkKey, normalizedPhone);
    return {
      ok: true,
      message: 'Use /api/auth/login-by-phone to sign in without exposing account email.',
    };
  };

  const loginByPhone = async (phoneValue: any, passwordValue: any, networkKey: string) => {
    const rawPhone = String(phoneValue || '');
    const password = String(passwordValue || '');
    const normalizedPhone = options.normalizePhone(rawPhone);
    if (!normalizedPhone || !password) {
      throw authProfileHttpError(400, 'Phone number and password are required.');
    }
    assertPhoneAttempt(networkKey, normalizedPhone);
    const user = await options.repository.findUserByPhone(normalizedPhone, rawPhone);
    const email = options.normalizeEmail((user as any)?.email);
    if (!user || !email) throw authProfileHttpError(401, 'Phone number or password is incorrect.');

    const verified = await options.provider.verifyPassword(email, password);
    if (verified.localId !== user.id) {
      throw authProfileHttpError(401, 'Phone number or password is incorrect.');
    }
    if (user.phone !== normalizedPhone) {
      await options.repository.saveUser({
        ...user,
        phone: normalizedPhone,
        phoneVerified: Boolean(user.phoneVerified),
      });
    }
    return { customToken: await options.provider.createCustomToken(verified.localId) };
  };

  const registerProfile = async (actor: any, payload: any) => {
    if (!actor) throw authProfileHttpError(401, 'Chưa đăng nhập.');
    const requestedPhone = payload?.phone ? options.normalizePhone(payload.phone) : '';
    const existingPhone = options.normalizePhone(actor.phone);
    if (payload?.phone && !requestedPhone) throw authProfileHttpError(400, 'Invalid phone number.');
    if (requestedPhone && existingPhone && actor.phoneVerified && requestedPhone !== existingPhone) {
      throw authProfileHttpError(
        400,
        'Verified phone number cannot be replaced without a new OTP verification.',
      );
    }
    const nameValidation = options.validateDisplayName(payload?.name || actor.name);
    if (!nameValidation.valid) {
      throw authProfileHttpError(400, nameValidation.error || 'Invalid display name.');
    }
    const normalizedPhone = requestedPhone || existingPhone;
    const updatedProfile = {
      ...actor,
      name: nameValidation.value,
      phone: normalizedPhone || undefined,
      phoneVerified: Boolean(actor.phoneVerified && normalizedPhone && normalizedPhone === existingPhone),
      role: actor.role,
      status: actor.status,
      updatedAt: now().toISOString(),
    };
    await options.repository.saveUser(updatedProfile);
    options.invalidateStudentNameCache();
    return updatedProfile;
  };

  return { getPhoneLoginHint, loginByPhone, registerProfile };
}
