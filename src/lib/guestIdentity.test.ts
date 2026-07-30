import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GUEST_ACCESS_CREDENTIAL_STORAGE_KEY,
  GUEST_ID_STORAGE_KEY,
  getOrCreateGuestId,
  getStoredGuestAccessCredential,
  getStoredGuestId,
  identifyExistingGuest,
  storeGuestAccessCredential
} from './guestIdentity';
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

function installLocalStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  let writes = 0;
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const localStorage = {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    key(index: number) {
      return [...values.keys()][index] ?? null;
    },
    removeItem(key: string) {
      values.delete(key);
    },
    setItem(key: string, value: string) {
      writes += 1;
      values.set(key, String(value));
    }
  };
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage }
  });
  return {
    values,
    get writes() {
      return writes;
    },
    restore() {
      if (originalWindow) {
        Object.defineProperty(globalThis, 'window', originalWindow);
      } else {
        delete (globalThis as { window?: unknown }).window;
      }
    }
  };
}

test('history identity lookup never creates a guest id', () => {
  const storage = installLocalStorage();
  try {
    assert.equal(getStoredGuestId(), '');
    assert.equal(storage.writes, 0);
    assert.equal(storage.values.has(GUEST_ID_STORAGE_KEY), false);
  } finally {
    storage.restore();
  }
});

test('learning flow creates one stable guest id while history remains read-only', () => {
  const storage = installLocalStorage();
  try {
    const created = getOrCreateGuestId();
    assert.ok(created);
    assert.equal(storage.writes, 1);
    assert.equal(getStoredGuestId(), created);
    assert.equal(getOrCreateGuestId(), created);
    assert.equal(storage.writes, 1);
  } finally {
    storage.restore();
  }
});

test('guest history capability is stored without accepting another guest token', () => {
  const storage = installLocalStorage({
    [GUEST_ID_STORAGE_KEY]: 'guest-one'
  });
  try {
    assert.equal(storeGuestAccessCredential('guest-one', 'token-value', 2), true);
    assert.deepEqual(getStoredGuestAccessCredential(), {
      guestId: 'guest-one',
      accessToken: 'token-value',
      version: 2
    });
    assert.equal(getStoredGuestAccessCredential('guest-two'), null);

    storage.values.set(GUEST_ACCESS_CREDENTIAL_STORAGE_KEY, '{not-json');
    assert.equal(getStoredGuestAccessCredential(), null);
  } finally {
    storage.restore();
  }
});
