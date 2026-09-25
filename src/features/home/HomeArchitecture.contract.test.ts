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

test('Home keeps full lesson search data but consumes only the bounded leaderboard summary', () => {
  for (const endpoint of [
    '/api/public/vocab-sets',
    '/api/public/grammar-sets',
    '/api/listening/sets',
    '/api/public/leaderboard-summary?period=',
    '/api/vocab-sets',
    '/api/grammar-sets',
    '/api/assignments',
    '/api/classes',
  ]) {
    assert.ok(controllerSource.includes(endpoint), `missing Home endpoint ${endpoint}`);
  }
  assert.doesNotMatch(controllerSource, /\/api\/(?:public\/)?leaderboard-results/);
  assert.doesNotMatch(controllerSource, /\/api\/results['"`]/);
  assert.match(controllerSource, /leaderboardStatus/);
  assert.match(pageSource, /Bảng vàng đang cập nhật/);
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
    'home-grammar-list',
    'home-sidebar',
    'student-golden-board',
    'system-info-card',
    'footer',
  ]) {
    assert.ok(pageSource.includes(`id="${id}"`), `missing stable Home hook #${id}`);
  }
});

test('Home hero layers copy above one full-surface classroom media region', () => {
  assert.ok(pageSource.includes('id="home-hero-copy"'));
  assert.ok(pageSource.includes('id="home-hero-media"'));
  assert.ok(pageSource.includes('id="home-hero-image"'));
  assert.ok(pageSource.includes('src="/home-classroom-achievement.png"'));
  assert.match(pageSource, /alt="Các học sinh Tiếng Anh Cô Diệu cùng nhận chứng nhận thành tích"/);
  assert.ok(pageSource.includes('id="home-hero-title"'));
  assert.ok(pageSource.includes('home-hero-title-joy'));
  assert.ok(pageSource.includes('home-hero-title-brand'));
  assert.doesNotMatch(pageSource, /Game hóa Từ vựng tiếng Anh đột phá|home-hero-badge|Sparkles/);
  assert.doesNotMatch(pageSource, /sm:whitespace-nowrap|whitespace-nowrap[^>]*>[\s\S]*Nhớ siêu lâu cùng/);
});

test('Vocabulary and Grammar own independent search and grade controls', () => {
  assert.match(controllerSource, /const \[grammarSearch, setGrammarSearch\] = React\.useState\(''\)/);
  assert.match(controllerSource, /const \[grammarGrade, setGrammarGrade\] = React\.useState\(''\)/);
  assert.match(controllerSource, /filterPublicVocabSets\(vocabSets, search, grade\)/);
  assert.match(controllerSource, /filterPublicGrammarSets\(grammarSets, grammarSearch, grammarGrade\)/);
  assert.ok(pageSource.includes('id="home-grammar-search"'));
  assert.ok(pageSource.includes('id="home-grammar-grade-filter"'));
  assert.match(pageSource, /aria-label="Tìm bài ngữ pháp theo tên"/);
  assert.match(pageSource, /aria-label="Lọc bài ngữ pháp theo khối lớp"/);
});

test('public Vocabulary and Grammar lessons share the requested compact list contract', () => {
  assert.equal((pageSource.match(/<HomeLessonList/g) || []).length, 2);
  for (const heading of ['STT', 'Tên', 'Khối lớp', 'Chủ đề', 'Thao tác']) {
    assert.ok(pageSource.includes(`<span role="columnheader">${heading}</span>`), `missing list heading ${heading}`);
  }
  assert.match(pageSource, /<Play size=\{14\} aria-hidden="true" \/>[\s\S]*?<span>Học Bài<\/span>/);
  assert.doesNotMatch(pageSource, /Bấm vào bất kỳ bộ bài học nào dưới đây để chọn game luyện tập/);
  assert.doesNotMatch(pageSource, /Chọn bài ngữ pháp để luyện trắc nghiệm và xem lại lời giải sau khi nộp/);
  assert.doesNotMatch(pageSource, /\{filteredGrammarSets\.length\} bài/);
  assert.doesNotMatch(pageSource, /Vào học ngay|Bắt đầu luyện ngữ pháp/);
});
