import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8');
const pageSource = readFileSync(new URL('./HomePage.tsx', import.meta.url), 'utf8');
const controllerSource = readFileSync(new URL('./useHomeController.ts', import.meta.url), 'utf8');
const navigationSource = readFileSync(new URL('../app-shell/useAppNavigation.ts', import.meta.url), 'utf8');

test('App is a gateway while the Home controller owns fetch and HomePage only presents data', () => {
  assert.match(appSource, /useAppNavigation\(\)/);
  assert.match(appSource, /useHomeController\(/);
  assert.match(appSource, /<HomePage/);
  assert.doesNotMatch(pageSource, /\bfetch\s*\(/);
  assert.doesNotMatch(pageSource, /useEffect\s*\(/);
  assert.match(controllerSource, /if \(loading \|\| !enabled\) return/);
  assert.match(controllerSource, /new AbortController\(\)/);
  assert.match(controllerSource, /homeDataRequestIdRef\.current === requestId/);
});

test('Home controller keeps all full-data endpoints required by client-side item search', () => {
  for (const endpoint of [
    '/api/public/vocab-sets',
    '/api/public/grammar-sets',
    '/api/listening/sets',
    '/api/public/leaderboard-results',
    '/api/vocab-sets',
    '/api/grammar-sets',
    '/api/assignments',
    '/api/classes',
    '/api/leaderboard-results',
  ]) {
    assert.ok(controllerSource.includes(endpoint), `missing Home endpoint ${endpoint}`);
  }
  assert.doesNotMatch(controllerSource, /\/api\/results['"`]/);
});

test('route navigation preserves pushState/popstate and stable Home DOM hooks', () => {
  assert.match(navigationSource, /parseAppShellRoute/);
  assert.match(navigationSource, /parseListeningLibraryRoute/);
  assert.match(navigationSource, /window\.history\.pushState/);
  assert.match(navigationSource, /addEventListener\('popstate'/);

  for (const id of [
    'app-root',
    'navbar',
    'home-hero',
    'home-sets-directory',
    'home-sets-grid',
    'home-grammar-directory',
    'home-sidebar',
    'student-golden-board',
    'system-info-card',
    'footer',
  ]) {
    assert.ok(pageSource.includes(`id="${id}"`), `missing stable Home hook #${id}`);
  }
});

test('Home hero only keeps its second headline on one line above the mobile breakpoint', () => {
  assert.match(pageSource, /text-2xl sm:text-4xl lg:text-5xl sm:whitespace-nowrap/);
  assert.doesNotMatch(pageSource, /text-2xl sm:text-4xl lg:text-5xl whitespace-nowrap/);
});
