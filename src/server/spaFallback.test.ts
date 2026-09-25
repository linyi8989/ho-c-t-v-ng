import assert from 'node:assert/strict';
import test from 'node:test';
import { isSpaNavigationRequest } from './spaFallback';

test('serves index only for known client-side navigation routes', () => {
  for (const path of [
    '/',
    '/history',
    '/admin',
    '/assignment/share-token',
    '/grammar/private/share-token',
    '/teacher-preview/vocabulary/set-1',
    '/exams',
    '/listening/modules/mover',
    '/writing/exam-1',
  ]) {
    assert.equal(isSpaNavigationRequest(path), true, path);
  }
});

test('rejects missing APIs, assets and unknown browser routes from SPA fallback', () => {
  for (const path of [
    '/api/not-a-route',
    '/assets/not-a-file.js',
    '/logo-missing.png',
    '/broken-route',
    '/teacher-preview/listening/set-1',
  ]) {
    assert.equal(isSpaNavigationRequest(path), false, path);
  }
});
