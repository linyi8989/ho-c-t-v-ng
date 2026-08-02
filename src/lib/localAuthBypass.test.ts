import assert from 'node:assert/strict';
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
