import assert from 'node:assert/strict';
import test from 'node:test';
import { identifyExistingGuest } from './guestIdentity';
import { validateStudentDisplayName } from './studentIdentity';

test('existing guest identity keeps a legacy display name longer than 20 characters', async () => {
  const originalFetch = globalThis.fetch;
  let requestBody: Record<string, string> = {};
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body || '{}'));
    return new Response(JSON.stringify({
      id: 'guest-legacy',
      guestId: 'guest-legacy',
      displayName: 'Nguyễn Ngọc Thảo Nguyên',
      status: 'active',
      legacy: true
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  };

  try {
    const identity = await identifyExistingGuest('guest-legacy');
    assert.equal(identity?.displayName, 'Nguyễn Ngọc Thảo Nguyên');
    assert.deepEqual(requestBody, { guestId: 'guest-legacy' });
    assert.equal(validateStudentDisplayName(identity?.displayName).valid, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('unknown guest identity returns null and new names still use the 2-20 rule', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    error: 'Not found',
    code: 'GUEST_PROFILE_NOT_FOUND'
  }), {
    status: 404,
    headers: { 'Content-Type': 'application/json' }
  });

  try {
    assert.equal(await identifyExistingGuest('guest-new'), null);
    assert.equal(validateStudentDisplayName('Nguyễn Văn An').valid, true);
    assert.equal(validateStudentDisplayName('Nguyễn Ngọc Thảo Nguyên').valid, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
