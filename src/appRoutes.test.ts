import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAppShellRoute, teacherLibraryPreviewPath } from './appRoutes';

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
  assert.deepEqual(parseAppShellRoute('/teacher-preview/vocabulary/set%201'), {
    kind: 'teacher-preview',
    pathname: '/teacher-preview/vocabulary/set%201',
    resourceType: 'vocabulary',
    setId: 'set 1',
  });
  assert.deepEqual(parseAppShellRoute('/teacher-preview/grammar/grammar-1/'), {
    kind: 'teacher-preview',
    pathname: '/teacher-preview/grammar/grammar-1',
    resourceType: 'grammar',
    setId: 'grammar-1',
  });
  assert.equal(teacherLibraryPreviewPath('vocabulary', 'set / 1'), '/teacher-preview/vocabulary/set%20%2F%201');
  assert.equal(parseAppShellRoute('/teacher-preview/listening/set-1').kind, 'other');
  assert.equal(parseAppShellRoute('/unknown').kind, 'other');
});

test('rejects malformed encoded private tokens instead of throwing during render', () => {
  const route = parseAppShellRoute('/assignment/%E0%A4%A');
  assert.equal(route.kind, 'private-vocabulary');
  if (route.kind === 'private-vocabulary') assert.equal(route.token, '');

  const previewRoute = parseAppShellRoute('/teacher-preview/grammar/%E0%A4%A');
  assert.equal(previewRoute.kind, 'teacher-preview');
  if (previewRoute.kind === 'teacher-preview') assert.equal(previewRoute.setId, '');
});
