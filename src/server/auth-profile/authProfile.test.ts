import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createAuthProfileService } from './service';

const serverSource = readFileSync(new URL('../../../server.ts', import.meta.url), 'utf8');
const routerSource = readFileSync(new URL('./router.ts', import.meta.url), 'utf8');

function fixture() {
  const user = {
    id: 'user-1',
    email: 'student@example.test',
    name: 'Student',
    phone: '0912 345 678',
    phoneVerified: false,
    role: 'student',
    status: 'active',
  };
  const saved: any[] = [];
  const repository = {
    async findUserByPhone() { return user; },
    async saveUser(record: any) { saved.push(record); },
  };
  const provider = {
    async verifyPassword() { return { localId: 'user-1' }; },
    async createCustomToken() { return 'custom-token'; },
  };
  const service = createAuthProfileService({
    repository: repository as any,
    provider,
    normalizePhone: value => String(value || '').replace(/\D/g, '').replace(/^0/, '+84'),
    normalizeEmail: value => String(value || '').trim().toLowerCase(),
    validateDisplayName: value => ({ valid: true, value: String(value || '').trim() }),
    invalidateStudentNameCache: () => undefined,
    consumePhoneAttempt: () => ({ allowed: true, retryAfterSeconds: 0 }),
    now: () => new Date('2026-09-23T09:00:00.000Z'),
  });
  return { provider, repository, saved, service, user };
}

test('auth/profile URLs and authentication middleware remain unchanged', () => {
  assert.match(serverSource, /createAuthProfileRouter/);
  assert.doesNotMatch(serverSource, /app\.(?:get|post)\("\/api\/(?:auth\/(?:email-by-phone|login-by-phone)|me|register)"/);
  assert.match(routerSource, /router\.post\("\/auth\/email-by-phone"/);
  assert.match(routerSource, /router\.post\("\/auth\/login-by-phone"/);
  assert.match(routerSource, /router\.get\("\/me", options\.authenticateUser/);
  assert.match(routerSource, /router\.post\("\/register", options\.authenticateUser/);
});

test('phone login does not expose email and still normalizes stored phone after verification', async () => {
  const { saved, service } = fixture();
  assert.deepEqual(await service.getPhoneLoginHint('0912 345 678', 'ip-1'), {
    ok: true,
    message: 'Use /api/auth/login-by-phone to sign in without exposing account email.',
  });
  assert.deepEqual(await service.loginByPhone('0912 345 678', 'secret', 'ip-1'), {
    customToken: 'custom-token',
  });
  assert.equal(saved.length, 1);
  assert.equal(saved[0].phone, '+84912345678');
});

test('profile synchronization preserves trusted role/status and verified-phone protection', async () => {
  const { service, user } = fixture();
  const result = await service.registerProfile(user as any, { name: 'New Student' });
  assert.equal(result.name, 'New Student');
  assert.equal(result.role, 'student');
  assert.equal(result.status, 'active');
  assert.equal(result.updatedAt, '2026-09-23T09:00:00.000Z');

  await assert.rejects(
    service.registerProfile({ ...user, phone: '+84912345678', phoneVerified: true } as any, {
      phone: '0987654321',
    }),
    (error: any) => error.status === 400 && /Verified phone number/.test(error.message),
  );
});

test('phone throttling remains enforced before account lookup', async () => {
  const { repository } = fixture();
  const service = createAuthProfileService({
    repository: repository as any,
    provider: { async verifyPassword() { throw new Error('must not run'); }, async createCustomToken() { return ''; } },
    normalizePhone: () => '+84912345678',
    normalizeEmail: value => String(value || ''),
    validateDisplayName: value => ({ valid: true, value }),
    invalidateStudentNameCache: () => undefined,
    consumePhoneAttempt: () => ({ allowed: false, retryAfterSeconds: 60 }),
  });
  await assert.rejects(
    service.loginByPhone('0912345678', 'secret', 'ip-1'),
    (error: any) => error.status === 429 && error.retryAfterSeconds === 60,
  );
});
