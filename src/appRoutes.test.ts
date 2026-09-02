import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAppShellRoute } from './appRoutes';

test('parses stable shell routes without scattering regular expressions through App', () => {
  assert.deepEqual(parseAppShellRoute('/'), { kind: 'home', pathname: '/' });
  assert.equal(parseAppShellRoute('/register/').kind, 'auth');
  assert.equal(parseAppShellRoute('/admin').kind, 'auth');
  assert.equal(parseAppShellRoute('/history').kind, 'history');
  assert.deepEqual(parseAppShellRoute('/assignment/share%20token'), {
    kind: 'private-vocabulary',
    pathname: '/assignment/share%20token',
    token: 'share token',
  });
  assert.equal(parseAppShellRoute('/grammar/private/token-1').kind, 'private-grammar');
  assert.equal(parseAppShellRoute('/unknown').kind, 'other');
});

test('rejects malformed encoded private tokens instead of throwing during render', () => {
  const route = parseAppShellRoute('/assignment/%E0%A4%A');
  assert.equal(route.kind, 'private-vocabulary');
  if (route.kind === 'private-vocabulary') assert.equal(route.token, '');
});
