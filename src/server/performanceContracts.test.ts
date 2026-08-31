import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const serverSource = readFileSync(new URL('../../server.ts', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const authSource = readFileSync(new URL('../context/AuthContext.tsx', import.meta.url), 'utf8');
const adminSource = readFileSync(new URL('../components/admin/AdminDashboard.tsx', import.meta.url), 'utf8');
const storageSource = readFileSync(new URL('../lib/sqliteStorage.ts', import.meta.url), 'utf8');
const examHomeSource = readFileSync(
  new URL('../features/listening-library/student/ListeningLibraryHome.tsx', import.meta.url),
  'utf8'
);
const examModuleSource = readFileSync(
  new URL('../features/listening-library/student/ListeningModulePage.tsx', import.meta.url),
  'utf8'
);
const examPaperSource = readFileSync(
  new URL('../features/listening-library/student/ListeningPaperPage.tsx', import.meta.url),
  'utf8'
);
const backfillSource = readFileSync(
  new URL('../../scripts/db-backfill-hot-read-models.mjs', import.meta.url),
  'utf8'
);

function routeBody(path: string, nextPath?: string) {
  const start = serverSource.indexOf(`app.get("${path}"`);
  assert.notEqual(start, -1, `missing route ${path}`);
  const end = nextPath ? serverSource.indexOf(`app.get("${nextPath}"`, start + 1) : serverSource.length;
  assert.notEqual(end, -1, `missing following route ${nextPath}`);
  return serverSource.slice(start, end);
}

test('auth and App release one route-scoped, abortable home-data generation', () => {
  assert.match(authSource, /onIdTokenChanged/);
  assert.doesNotMatch(authSource, /onAuthStateChanged/);
  assert.match(authSource, /const initialAuthEvent = !authLifecycleReadyRef\.current/);
  assert.match(authSource, /const authRejected = Number\(\(err as \{ status\?: number \}\)\?\.status\) === 401/);
  assert.match(authSource, /fetchProfile\(fUser, undefined, false, true\)/);
  assert.match(authSource, /if \(initialAuthEvent\) setLoading\(true\)/);
  assert.match(authSource, /if \(initialAuthEvent\) setLoading\(false\)/);
  assert.match(appSource, /if \(loading \|\| !isHomeDataView\) return/);
  assert.match(appSource, /currentPathname === '\/'/);
  assert.match(appSource, /\(!isStaff \|\| adminMode\)/);
  assert.match(appSource, /new AbortController\(\)/);
  assert.match(appSource, /homeDataRequestIdRef\.current === requestId/);
  assert.doesNotMatch(appSource, /loadJson\('\/api\/results'/);
});

test('auth middleware distinguishes invalid ID tokens from profile-storage failures', () => {
  const start = serverSource.indexOf('const authenticateUser = async');
  const end = serverSource.indexOf('// Check role restrictions', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const middleware = serverSource.slice(start, end);
  assert.match(middleware, /let decodedToken: any/);
  assert.match(middleware, /Token verification failed:/);
  assert.match(middleware, /Authenticated profile resolution failed:/);
  assert.match(middleware, /Không thể xác minh hồ sơ người dùng\. Vui lòng thử lại\./);
  assert.doesNotMatch(middleware, /console\.error\("Token verification failed:", error\)/);
});

test('admin owns one stale-safe summary loader and fetches result detail on demand', () => {
  assert.match(adminSource, /refreshGenerationRef/);
  assert.match(adminSource, /refreshData\(controller\.signal\)/);
  assert.match(adminSource, /\/api\/results\?view=summary&limit=500/);
  assert.match(adminSource, /\/api\/results\/\$\{encodeURIComponent\(sourceType\)\}/);
  assert.match(adminSource, /activityDetailLoading/);
});

test('canonical exam navigation updates App route state without document reloads', () => {
  assert.match(appSource, /const navigateInternal = React\.useCallback/);
  assert.match(appSource, /window\.history\.pushState/);
  assert.match(appSource, /setBrowserLocation/);
  assert.match(examHomeSource, /onNavigate\(href\)/);
  assert.match(examModuleSource, /event\.preventDefault\(\)/);
  assert.match(examPaperSource, /onNavigate\(examPaperExamPath/);
  for (const source of [examHomeSource, examModuleSource, examPaperSource]) {
    assert.doesNotMatch(source, /window\.location\.href/);
  }
});

test('hot read routes are timed and summary mode never eagerly joins listening detail', () => {
  const publicResults = routeBody('/api/public/results', '/api/public/leaderboard-results');
  const publicLeaderboard = routeBody('/api/public/leaderboard-results', '/api/vocab-sets');
  const resultDetail = routeBody('/api/results/:sourceType/:resultId', '/api/results');
  const results = routeBody('/api/results', '/api/leaderboard-results');
  const leaderboard = routeBody('/api/leaderboard-results', '/api/admin/users');
  for (const body of [publicResults, publicLeaderboard, resultDetail, results, leaderboard]) {
    assert.match(body, /createApiTiming/);
    assert.match(body, /timing\.finish\(res\)/);
  }
  assert.match(results, /summaryView \|\| !isStaffResultReview/);
  assert.match(results, /toActivitySummary/);
  assert.match(resultDetail, /resolveListeningActivityDetailForStaff/);
});

test('request reads do not run guest migration and leaderboard has a durable readiness gate', () => {
  assert.doesNotMatch(serverSource, /ensureLegacyGuestProfiles/);
  assert.match(serverSource, /CANONICAL_STUDENT_NAME_CACHE_TTL_MS/);
  assert.match(serverSource, /canonicalStudentNameLoadPromise/);
  assert.match(serverSource, /LEADERBOARD_READ_MODEL_SETTING_ID/);
  assert.match(serverSource, /readModelSetting\?\.ready === true/);
  assert.match(serverSource, /Compatibility path for installations that have not run/);
});

test('additive index migration and explicit maintenance CLI keep source rows protected', () => {
  for (const indexName of [
    'idx_game_results_completed_at',
    'idx_grammar_attempts_completed_at',
    'idx_listening_attempts_completed_at',
    'idx_mover_reading_attempts_completed_at',
    'idx_exam_attempts_completed_at',
  ]) {
    assert.match(storageSource, new RegExp(indexName));
  }
  assert.match(storageSource, /activity-read-indexes-v1/);
  assert.match(backfillSource, /mode === 'dry-run'/);
  assert.match(backfillSource, /createVerifiedBackup/);
  assert.match(backfillSource, /INSERT OR IGNORE INTO guest_profiles/);
  assert.match(backfillSource, /INSERT OR IGNORE INTO leaderboard_events/);
  assert.match(backfillSource, /sourceCountsBefore/);
  assert.match(backfillSource, /sourceMutation: 'none'/);
});
