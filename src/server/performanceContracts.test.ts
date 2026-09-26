import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const serverSource = readFileSync(new URL('../../server.ts', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const homeControllerSource = readFileSync(new URL('../features/home/useHomeController.ts', import.meta.url), 'utf8');
const appNavigationSource = readFileSync(new URL('../features/app-shell/useAppNavigation.ts', import.meta.url), 'utf8');
const authSource = readFileSync(new URL('../context/AuthContext.tsx', import.meta.url), 'utf8');
const adminSource = readFileSync(new URL('../components/admin/AdminDashboard.tsx', import.meta.url), 'utf8');
const storageSource = readFileSync(new URL('../lib/sqliteStorage.ts', import.meta.url), 'utf8');
const guestIdentityRepositorySource = readFileSync(
  new URL('./guest-identity/repository.ts', import.meta.url),
  'utf8'
);
const accountServiceSource = readFileSync(new URL('./accounts/service.ts', import.meta.url), 'utf8');
const resultsRouterSource = readFileSync(new URL('./results/router.ts', import.meta.url), 'utf8');
const resultsServiceSource = readFileSync(new URL('./results/service.ts', import.meta.url), 'utf8');
const studentLearningSource = readFileSync(
  new URL('../components/games/StudentLearningArea.tsx', import.meta.url),
  'utf8'
);
const learningLeaderboardRequestSource = readFileSync(
  new URL('../components/games/learningLeaderboardRequest.ts', import.meta.url),
  'utf8'
);
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

test('auth and App release one route-scoped, abortable home-data generation', () => {
  assert.match(authSource, /onIdTokenChanged/);
  assert.doesNotMatch(authSource, /onAuthStateChanged/);
  assert.match(authSource, /const initialAuthEvent = !authLifecycleReadyRef\.current/);
  assert.match(authSource, /const authRejected = Number\(\(err as \{ status\?: number \}\)\?\.status\) === 401/);
  assert.match(authSource, /fetchProfile\(fUser, undefined, false, true\)/);
  assert.match(authSource, /if \(initialAuthEvent\) setLoading\(true\)/);
  assert.match(authSource, /if \(initialAuthEvent\) setLoading\(false\)/);
  assert.match(authSource, /authSessionKnown/);
  assert.match(appSource, /useHomeController\(\{ enabled: isHomeDataView, loading, token \}\)/);
  assert.match(appSource, /currentPathname === '\/'/);
  assert.match(appSource, /\(!isStaff \|\| adminMode\)/);
  assert.match(homeControllerSource, /if \(loading \|\| !enabled\) return/);
  assert.match(homeControllerSource, /new AbortController\(\)/);
  assert.match(homeControllerSource, /homeDataRequestIdRef\.current === requestId/);
  assert.doesNotMatch(homeControllerSource, /loadJson\('\/api\/results'/);
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
  assert.match(adminSource, /refreshDashboard\(controller\.signal\)/);
  assert.match(adminSource, /\/api\/admin\/dashboard-summary/);
  assert.match(adminSource, /vocabRequestGenerationRef/);
  assert.match(adminSource, /grammarRequestGenerationRef/);
  assert.match(adminSource, /\/api\/results\?view=summary&limit=500/);
  assert.match(adminSource, /\/api\/results\/\$\{encodeURIComponent\(sourceType\)\}/);
  assert.match(adminSource, /activityDetailLoading/);
});

test('canonical exam navigation updates App route state without document reloads', () => {
  assert.match(appSource, /useAppNavigation\(\)/);
  assert.match(appNavigationSource, /const navigateInternal = React\.useCallback/);
  assert.match(appNavigationSource, /window\.history\.pushState/);
  assert.match(appNavigationSource, /setBrowserLocation/);
  assert.match(examHomeSource, /onNavigate\(href\)/);
  assert.match(examModuleSource, /event\.preventDefault\(\)/);
  assert.match(examPaperSource, /onNavigate\(examPaperExamPath/);
  for (const source of [examHomeSource, examModuleSource, examPaperSource]) {
    assert.doesNotMatch(source, /window\.location\.href/);
  }
});

test('hot read routes are timed and summary mode never eagerly joins listening detail', () => {
  for (const path of [
    '/public/results', '/public/leaderboard-results', '/public/leaderboard-summary',
    '/learning/leaderboard-summary', '/admin/leaderboard-summary',
    '/results/:sourceType/:resultId', '/results', '/leaderboard-results',
  ]) {
    assert.match(resultsRouterSource, new RegExp(`router\\.get\\('${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`));
  }
  assert.match(resultsRouterSource, /createApiTiming/);
  assert.match(resultsRouterSource, /timing\.finish\(response\)/);
  assert.match(resultsServiceSource, /if \(!isStaff\) return options\.listeningAttemptToActivity/);
  assert.match(resultsServiceSource, /toActivitySummary/);
  assert.match(resultsServiceSource, /resolveListeningDetail/);
});

test('request reads do not run guest migration and leaderboard has a durable readiness gate', () => {
  assert.doesNotMatch(serverSource, /ensureLegacyGuestProfiles/);
  assert.match(serverSource, /CANONICAL_STUDENT_NAME_CACHE_TTL_MS/);
  assert.match(serverSource, /canonicalStudentNameLoadPromises/);
  const nameLoaderStart = serverSource.indexOf('async function getCanonicalStudentNameMaps');
  const nameLoaderEnd = serverSource.indexOf('function enrichStudentName', nameLoaderStart);
  const nameLoader = serverSource.slice(nameLoaderStart, nameLoaderEnd);
  assert.doesNotMatch(nameLoader, /collection\("users"\)\.get|collection\("guest_profiles"\)\.get/);
  assert.match(nameLoader, /runWithConcurrency\(lookups, 20/);
  assert.match(serverSource, /LEADERBOARD_READ_MODEL_SETTING_ID/);
  assert.match(serverSource, /readModelSetting\?\.ready === true/);
  assert.match(resultsServiceSource, /allowLegacyLeaderboardFallback/);
  assert.match(resultsServiceSource, /LEADERBOARD_NOT_READY/);
});

test('student entry hot path uses indexed token lookup and lazy summary data', () => {
  const resolverStart = serverSource.indexOf('async function resolveVocabLearningAccess');
  const resolverEnd = serverSource.indexOf('function canViewResultSession', resolverStart);
  const resolver = serverSource.slice(resolverStart, resolverEnd);
  assert.match(serverSource, /findDocumentByShareToken/);
  assert.match(resolver, /findDocumentByShareToken\("assignments", token\)/);
  assert.match(resolver, /findDocumentByShareToken\("vocab_sets", token\)/);
  assert.doesNotMatch(resolver, /collection\("assignments"\)\.get\(\)/);
  assert.doesNotMatch(resolver, /collection\("vocab_sets"\)\.get\(\)/);
  assert.doesNotMatch(resolver, /ensureAssignmentShareToken/);
  assert.match(storageSource, /student-entry-hot-path-v1/);
  assert.match(storageSource, /idx_assignments_share_token/);
  assert.match(storageSource, /idx_vocab_sets_share_token/);

  assert.doesNotMatch(studentLearningSource, /\/api\/public\/leaderboard-results/);
  assert.match(studentLearningSource, /buildLearningLeaderboardRequest/);
  assert.match(learningLeaderboardRequestSource, /\/api\/learning\/leaderboard-summary/);
  assert.match(learningLeaderboardRequestSource, /\/api\/admin\/leaderboard-summary/);
  assert.match(learningLeaderboardRequestSource, /X-Vocab-Share-Token/);
  assert.match(learningLeaderboardRequestSource, /Authorization/);
  assert.match(studentLearningSource, /leaderboardOpen/);
  assert.match(resultsServiceSource, /loadReadyLeaderboardEvents/);
  assert.match(resultsServiceSource, /allowLegacyLeaderboardFallback/);
  assert.match(resultsServiceSource, /LEADERBOARD_NOT_READY/);
  assert.doesNotMatch(homeControllerSource, /\/api\/(?:public\/)?leaderboard-results/);
  assert.match(homeControllerSource, /\/api\/public\/leaderboard-summary/);
});

test('guest identity normal path is one profile point-read without legacy activity scans', () => {
  assert.match(serverSource, /createGuestIdentityRepository/);
  assert.match(guestIdentityRepositorySource, /collection\('guest_profiles'\)\.doc\(id\)\.get\(\)/);
  assert.doesNotMatch(guestIdentityRepositorySource, /game_sessions|grammar_attempts/);
  assert.doesNotMatch(serverSource, /findLegacyGuestIdentity/);
});

test('teacher account directory computes guest scope in bulk instead of an N+1 loop', () => {
  assert.match(serverSource, /getManageableGuestProfileIdsForTeacher/);
  assert.match(accountServiceSource, /manageableGuestIds/);
  assert.doesNotMatch(accountServiceSource, /for \([^)]*\)[\s\S]{0,200}await options\.canManageGuestProfile/);
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

test('leaderboard backfill can run without creating guest profiles and publishes readiness last', () => {
  assert.match(backfillSource, /readArg\('--target'\)/);
  assert.match(backfillSource, /target === 'leaderboard'/);
  assert.match(backfillSource, /runGuestProfileBackfill/);
  assert.match(backfillSource, /runLeaderboardBackfill/);
  assert.match(backfillSource, /isLeaderboardReadModelReady\(db\)/);
  assert.doesNotMatch(backfillSource, /readModelReady: runLeaderboardBackfill \? false : null/);
  const verificationIndex = backfillSource.indexOf("assertQuickCheck(db, 'post-backfill database')");
  const markerIndex = backfillSource.indexOf('INSERT INTO settings (key, value_json, updated_at)');
  assert.ok(verificationIndex > 0, 'post-backfill quick_check must exist');
  assert.ok(markerIndex > verificationIndex, 'readiness marker must be written only after reconciliation and quick_check');
});

test('SQLite document read-modify-write updates acquire an immediate transaction', () => {
  const updateStart = storageSource.indexOf('function updateDoc(');
  const updateEnd = storageSource.indexOf('function deleteDoc(', updateStart);
  const updateSource = storageSource.slice(updateStart, updateEnd);
  assert.match(updateSource, /withTransaction\(\(\) => \{/);
  assert.match(updateSource, /readRow[\s\S]*upsertDoc/);
  assert.match(updateSource, /}, 'immediate'\)/);
});
