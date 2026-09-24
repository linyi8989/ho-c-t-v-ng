import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const serverSource = readFileSync(new URL('../../../server.ts', import.meta.url), 'utf8');
const routerSource = readFileSync(new URL('./router.ts', import.meta.url), 'utf8');
const serviceSource = readFileSync(new URL('./service.ts', import.meta.url), 'utf8');
const repositorySource = readFileSync(new URL('./repository.ts', import.meta.url), 'utf8');

test('account, guest-profile, and audit URLs move behind the account router', () => {
  assert.match(serverSource, /createAccountRouter/);
  assert.doesNotMatch(serverSource, /app\.(?:get|post|put)\("?\/api\/admin\/(?:users|accounts|guest-profiles|audit-logs)/);
  for (const route of [
    "router.get('/admin/users'", "router.get('/admin/accounts'",
    "router.put('/admin/users/:userId/display-name'", "router.put('/admin/guest-profiles/:guestId/display-name'",
    "router.put('/admin/guest-profiles/:guestId/status'", "router.post('/admin/guest-profiles/:guestId/history-capability'",
    "router.put('/admin/users/:userId/role'", "router.put('/admin/users/:userId/status'",
    "router.get('/admin/audit-logs'",
  ]) assert.ok(routerSource.includes(route), `missing route ${route}`);
});

test('role/status/name mutations keep validation, authorization, audit, and auth-provider synchronization', () => {
  assert.match(serviceSource, /validateDisplayName/);
  assert.match(serviceSource, /canManageGuestProfile/);
  assert.match(serviceSource, /UPDATE_USER_DISPLAY_NAME/);
  assert.match(serviceSource, /ROTATE_GUEST_HISTORY_CAPABILITY/);
  assert.match(serviceSource, /setAuthRoleClaim/);
  assert.match(serviceSource, /LOCK_USER/);
});

test('teacher account scope remains bulk-loaded and capability secrets are omitted', () => {
  assert.match(serviceSource, /getManageableGuestIds/);
  assert.match(serviceSource, /omitGuestCapabilitySecrets/);
  assert.doesNotMatch(serviceSource, /for \([^)]*\)[\s\S]{0,200}await options\.canManageGuestProfile/);
  assert.match(repositorySource, /collection\('guest_profiles'\)/);
});
