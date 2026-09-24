import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createGuestIdentityService } from './service';

const serverSource = readFileSync(new URL('../../../server.ts', import.meta.url), 'utf8');
const routerSource = readFileSync(new URL('./router.ts', import.meta.url), 'utf8');

function serviceFixture(profile: any = null) {
  let stored = profile;
  const writes: any[] = [];
  const service = createGuestIdentityService({
    repository: {
      async getProfile() { return stored; },
      async setProfile(record: any) { stored = record; writes.push({ type: 'set', record }); },
      async updateProfile(_id: string, patch: any) { stored = { ...stored, ...patch }; writes.push({ type: 'update', patch }); },
    } as any,
    safeText: value => String(value || '').trim().slice(0, 240),
    validateDisplayName: value => {
      const name = String(value || '').trim();
      return name ? { valid: true, value: name } : { valid: false, error: 'Missing name.' };
    },
    normalizePersonName: value => String(value || '').trim().toLowerCase(),
    createSessionToken: () => 'plain-capability',
    hashSessionToken: token => `hash:${token}`,
    omitCapabilitySecrets: record => {
      const clone = { ...record };
      delete clone.accessTokenHash;
      return clone;
    },
    invalidateStudentNameCache: () => undefined,
    createHttpError: (status, message) => Object.assign(new Error(message), { status }),
    activityTouchIntervalMs: 300_000,
    now: () => new Date('2026-09-23T10:00:00.000Z'),
    nowMs: () => Date.parse('2026-09-23T10:00:00.000Z'),
  });
  return { service, writes };
}

test('guest identity routes retain limiter, timing, and URLs', () => {
  assert.match(serverSource, /createGuestIdentityRouter/);
  assert.doesNotMatch(serverSource, /app\.post\("\/api\/guest-profiles\/(?:resolve|identify)"/);
  assert.match(routerSource, /router\.post\("\/guest-profiles\/resolve", options\.rateLimit/);
  assert.match(routerSource, /router\.post\("\/guest-profiles\/identify", options\.rateLimit/);
  assert.match(routerSource, /timing\.finish\(response\)/);
});

test('new guest profile returns capability once and stores only its hash', async () => {
  const { service, writes } = serviceFixture();
  const profile = await service.resolveGuestProfile('guest-1', 'An', true);
  assert.equal(profile.guestAccessToken, 'plain-capability');
  assert.equal(profile.guestAccessTokenVersion, 1);
  assert.equal(profile.accessTokenHash, undefined);
  assert.equal(writes[0].record.accessTokenHash, 'hash:plain-capability');
  assert.equal(writes[0].record.role, 'student');
});

test('identify rejects blocked profiles and does not accept a browser-supplied name', async () => {
  const { service } = serviceFixture({
    id: 'guest-1',
    displayName: 'Stored Name',
    status: 'blocked',
  });
  await assert.rejects(
    service.findExistingGuestIdentity('guest-1'),
    (error: any) => error.status === 403,
  );
  assert.equal(await service.findExistingGuestIdentity(''), null);
});

test('existing profile is touched only after the configured interval', async () => {
  const recent = serviceFixture({
    id: 'guest-1',
    displayName: 'Stored Name',
    status: 'active',
    lastActiveAt: '2026-09-23T09:59:00.000Z',
  });
  await recent.service.resolveGuestProfile('guest-1', 'Ignored', true);
  assert.equal(recent.writes.length, 0);

  const stale = serviceFixture({
    id: 'guest-1',
    displayName: 'Stored Name',
    status: 'active',
    lastActiveAt: '2026-09-23T09:00:00.000Z',
  });
  await stale.service.resolveGuestProfile('guest-1', 'Ignored', true);
  assert.equal(stale.writes[0].type, 'update');
  assert.equal(stale.writes[0].patch.lastActiveAt, '2026-09-23T10:00:00.000Z');
});
