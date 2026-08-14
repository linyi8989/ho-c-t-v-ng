import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  LOCAL_AUTH_BYPASS_TOKEN,
  isLocalBrowserAuthBypassEnabled,
  isLocalServerAuthBypassAllowed,
  isLoopbackAddress,
  isLoopbackHostname,
} from './localAuthBypass';

test('local auth bypass accepts only loopback browser hosts', () => {
  assert.equal(isLocalBrowserAuthBypassEnabled('true', 'localhost'), true);
  assert.equal(isLocalBrowserAuthBypassEnabled('true', '127.0.0.1'), true);
  assert.equal(isLocalBrowserAuthBypassEnabled('true', '[::1]'), true);
  assert.equal(isLocalBrowserAuthBypassEnabled('false', 'localhost'), false);
  assert.equal(isLocalBrowserAuthBypassEnabled('true', 'app.example.com'), false);
});

test('server bypass is impossible in production or from a non-loopback client', () => {
  const safeRequest = {
    requested: true,
    nodeEnv: 'development',
    hostname: 'localhost',
    remoteAddress: '::ffff:127.0.0.1',
    bearerToken: LOCAL_AUTH_BYPASS_TOKEN,
  };
  assert.equal(isLocalServerAuthBypassAllowed(safeRequest), true);
  assert.equal(isLocalServerAuthBypassAllowed({ ...safeRequest, nodeEnv: 'production' }), false);
  assert.equal(isLocalServerAuthBypassAllowed({ ...safeRequest, hostname: 'app.example.com' }), false);
  assert.equal(isLocalServerAuthBypassAllowed({ ...safeRequest, remoteAddress: '192.168.1.25' }), false);
  assert.equal(isLocalServerAuthBypassAllowed({ ...safeRequest, bearerToken: 'wrong-token' }), false);
  assert.equal(isLoopbackAddress('::1'), true);
  assert.equal(isLoopbackHostname('127.10.20.30'), true);
});

test('local launcher supplies harmless Firebase placeholders when deployment config is absent', () => {
  const launcher = readFileSync(new URL('../../scripts/start-local-test.mjs', import.meta.url), 'utf8');
  assert.match(launcher, /VITE_FIREBASE_API_KEY: process\.env\.VITE_FIREBASE_API_KEY \|\| 'local-test-api-key'/);
  assert.match(launcher, /VITE_FIREBASE_PROJECT_ID: process\.env\.VITE_FIREBASE_PROJECT_ID \|\| 'local-test'/);
});
