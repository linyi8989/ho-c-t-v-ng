import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { readCssBundle } from '../../styles/cssTestUtils.js';
import { filterExamAdminSetsByTitle } from './admin/examAdminSearch';

const homeSource = readFileSync(new URL('./student/ListeningLibraryHome.tsx', import.meta.url), 'utf8');
const moduleSource = readFileSync(new URL('./student/ListeningModulePage.tsx', import.meta.url), 'utf8');
const routesSource = readFileSync(new URL('./routes.ts', import.meta.url), 'utf8');
const libraryAdminSource = readFileSync(new URL('./admin/ListeningLibraryAdmin.tsx', import.meta.url), 'utf8');
const moduleAdminRouterSource = readFileSync(new URL('./admin/ListeningModuleRouter.tsx', import.meta.url), 'utf8');
const moverClientModuleSource = readFileSync(new URL('./modules/mover/module.tsx', import.meta.url), 'utf8');
const listeningAdminSource = readFileSync(new URL('../listening/admin/ListeningAdminModule.tsx', import.meta.url), 'utf8');
const readingAdminSource = readFileSync(new URL('../mover-reading-writing/admin/MoverReadingWritingAdmin.tsx', import.meta.url), 'utf8');
const genericAdminSource = readFileSync(new URL('../exam-platform/admin/GenericExamAdmin.tsx', import.meta.url), 'utf8');
const dashboardSource = readFileSync(new URL('../../components/admin/AdminDashboard.tsx', import.meta.url), 'utf8');
const globalCssSource = readCssBundle(new URL('../../index.css', import.meta.url));

const rgb = (hex: string) => [1, 3, 5].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
const luminance = (hex: string) => rgb(hex)
  .map(value => value <= .03928 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
  .reduce((total, value, index) => total + value * [.2126, .7152, .0722][index], 0);
const contrast = (foreground: string, background: string) => {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((left, right) => right - left);
  return (lighter + .05) / (darker + .05);
};

test('exam directory uses the approved Cambridge & IELTS labels and one unified module list', () => {
  assert.match(homeSource, /Cambridge &amp; IELTS/);
  assert.match(homeSource, /Kho đề luyện thi/);
  assert.match(homeSource, /Xem danh sách/);
  assert.match(moduleSource, /data-exam-list/);
  assert.match(moduleSource, /paperDisplayName/);
  assert.match(moduleSource, /exam-library-filter-action/);
  assert.match(moduleSource, /examPaperExamPath\(moduleId, exam\.paperId, exam\.examId\)/);
  assert.doesNotMatch(moduleSource, /listeningPaperPath/);
  assert.match(libraryAdminSource, /aria-label="Truy cập nhanh module kho đề"/);
  assert.match(libraryAdminSource, /data-exam-module-quick-link=\{module\.id\}/);
  assert.match(libraryAdminSource, /aria-pressed=\{selected\}/);
  assert.match(libraryAdminSource, /selectedModuleId === module\.id/);
  assert.match(libraryAdminSource, /className="exam-module-quick-link group/);
  assert.match(libraryAdminSource, /xl:grid-cols-7/);
  assert.match(libraryAdminSource, /setSelectedModuleId\(module\.id\)/);
  assert.match(libraryAdminSource, /<div key=\{selectedModuleId\} data-exam-module-admin=\{selectedModuleId\}>/);
  assert.doesNotMatch(libraryAdminSource, /if \(selectedModuleId\) \{\s*return/);
});

test('student exam directory cards keep the compact title-level-description-action hierarchy', () => {
  const cardStart = homeSource.indexOf('<article');
  const cardEnd = homeSource.indexOf('</article>', cardStart);
  const title = homeSource.indexOf('{module.displayName}', cardStart);
  const level = homeSource.indexOf('{module.levelLabel}', cardStart);
  const description = homeSource.indexOf('module.description', cardStart);
  const action = homeSource.indexOf('Xem danh sách', cardStart);

  assert.ok(cardStart >= 0 && cardEnd > cardStart, 'Student module card must remain one bounded article');
  assert.ok(title > cardStart && title < level && level < description && description < action && action < cardEnd,
    'Every card must render title, level, description, then action in that order');
  assert.doesNotMatch(homeSource, /Đang hoạt động/);
  assert.match(homeSource, /data-exam-module-card=\{module\.id\}/);
  assert.match(homeSource, /exam-directory-module-card/);
  assert.match(homeSource, /exam-directory-module-title/);
  assert.match(homeSource, /exam-directory-module-level/);
  assert.match(homeSource, /exam-directory-module-description/);
  assert.match(homeSource, /grid gap-4 sm:grid-cols-2 xl:grid-cols-4/);
  assert.match(globalCssSource, /\.exam-directory-module-card\s*\{[^}]*min-height:\s*13rem/s);
  assert.match(globalCssSource, /\.exam-directory-module-action\s*\{[^}]*margin-top:\s*auto/s);
  for (const [foreground, background] of [
    ['#be123c', '#fff1f2'],
    ['#92400e', '#fffbeb'],
    ['#0f766e', '#f0fdfa'],
    ['#2563eb', '#eff6ff'],
    ['#0369a1', '#f0f9ff'],
    ['#7c3aed', '#f5f3ff'],
    ['#4338ca', '#eef2ff'],
  ] as const) {
    assert.ok(contrast(foreground, background) >= 4.5, `${foreground} on ${background} must meet WCAG AA`);
  }
});

test('admin module quick links keep feature-scoped readable default and selected states', () => {
  const broadOverride = globalCssSource.indexOf('#admin-dashboard-container button:not([disabled])');
  const scopedContract = globalCssSource.lastIndexOf('/* Admin exam-directory quick module contrast contract.');
  assert.ok(broadOverride >= 0 && scopedContract > broadOverride, 'Scoped module CSS must follow the legacy admin button override');
  assert.match(globalCssSource, /#listening-library-admin nav button\.exam-module-quick-link\[aria-pressed="true"\]/);
  assert.match(globalCssSource, /#listening-library-admin nav button\.exam-module-quick-link > \*/);
  for (const [foreground, background] of [['#1e3a8a', '#ffffff'], ['#1e3a8a', '#dbeafe'], ['#ffffff', '#1d4ed8']] as const) {
    assert.ok(contrast(foreground, background) >= 4.5, `${foreground} on ${background} must meet WCAG AA`);
  }
});

test('admin module click opens a searchable paper list without the intermediate chooser', () => {
  assert.match(moduleAdminRouterSource, /id="exam-module-admin-hub"/);
  assert.match(moduleAdminRouterSource, /data-exam-paper-filter=\{paper\.id\}/);
  assert.match(moduleAdminRouterSource, /data-exam-paper-create=\{paper\.id\}/);
  assert.match(moduleAdminRouterSource, /type="search"/);
  assert.match(moduleAdminRouterSource, /className="exam-paper-sort-row/);
  assert.match(moduleAdminRouterSource, /Soạn R&W/);
  assert.match(moduleAdminRouterSource, /paperId=\{paperId\}/);
  assert.match(moverClientModuleSource, /props\.paperId === 'listening'/);
  assert.match(genericAdminSource, /filterExamAdminSetsByTitle<ExamSetSummary>/);
  assert.match(listeningAdminSource, /filterExamAdminSetsByTitle<ListeningSetSummary>/);
  assert.match(readingAdminSource, /filterExamAdminSetsByTitle<MoverReadingWritingSetSummary>/);
  for (const source of [moduleAdminRouterSource, moverClientModuleSource, genericAdminSource]) {
    assert.doesNotMatch(source, /Chọn module khác/);
    assert.doesNotMatch(source, /Chọn loại bài thi/);
    assert.doesNotMatch(source, /Loại bài khác/);
  }
});

test('admin list header aligns title, search, and authoring while paper sort stays beside the list', () => {
  const headerStart = moduleAdminRouterSource.indexOf('<header className="exam-module-list-header');
  const headerEnd = moduleAdminRouterSource.indexOf('</header>', headerStart);
  const search = moduleAdminRouterSource.indexOf('type="search"');
  const sort = moduleAdminRouterSource.indexOf('className="exam-paper-sort-row');
  assert.ok(headerStart >= 0 && search > headerStart && search < headerEnd, 'Search must stay inside the list header row');
  assert.ok(sort > headerEnd, 'Paper sort must render after the header and immediately before the paper list');
  assert.doesNotMatch(listeningAdminSource, /ListeningPdfImportDialog|showPdfImport|FileUp/);
  for (const source of [listeningAdminSource, readingAdminSource, genericAdminSource]) {
    assert.match(source, /exam-paper-list-frame/);
  }
});

test('admin exam-title search is case, accent, and surrounding-space insensitive', () => {
  const sets = [
    { id: 'ket-1', title: 'Bộ đề KET số 1' },
    { id: 'mover-1', title: 'Movers Reading & Writing Test 3' },
  ];
  assert.deepEqual(filterExamAdminSetsByTitle(sets, '  bo de ket  ').map(set => set.id), ['ket-1']);
  assert.deepEqual(filterExamAdminSetsByTitle(sets, 'READING & WRITING').map(set => set.id), ['mover-1']);
  assert.deepEqual(filterExamAdminSetsByTitle(sets, '   ').map(set => set.id), ['ket-1', 'mover-1']);
});

test('admin paper filters and authoring actions have opaque readable states', () => {
  const broadOverride = globalCssSource.indexOf('#admin-dashboard-container button:not([disabled])');
  const scopedContract = globalCssSource.lastIndexOf('/* Direct admin paper-list toolbar.');
  assert.ok(scopedContract > broadOverride, 'Scoped paper toolbar CSS must follow the legacy admin override');
  assert.match(globalCssSource, /#exam-module-admin-hub button\.exam-paper-filter-action\[aria-pressed="true"\]:not\(:disabled\)/);
  assert.match(globalCssSource, /#exam-module-admin-hub button\.exam-paper-create-action:disabled/);
  assert.match(globalCssSource, /#exam-module-admin-hub \.exam-library-search-control:focus-within/);
  assert.match(globalCssSource, /#admin-main-panel section#exam-module-admin-hub/);
  assert.match(globalCssSource, /#exam-module-admin-hub > header\.exam-module-list-header/);
  assert.match(globalCssSource, /#exam-module-admin-hub \.exam-paper-list-frame/);
  for (const [foreground, background] of [['#ffffff', '#4338ca'], ['#ffffff', '#0369a1'], ['#1e3a8a', '#ffffff'], ['#ffffff', '#1d4ed8'], ['#475569', '#e2e8f0']] as const) {
    assert.ok(contrast(foreground, background) >= 4.5, `${foreground} on ${background} must meet WCAG AA`);
  }
});

test('new links use the short exam route while route parsing retains legacy aliases', () => {
  assert.match(routesSource, /examLibraryPath = \(\) => '\/exams'/);
  assert.match(routesSource, /\^\\\/listening\\\/modules/);
  assert.ok(routesSource.includes('const legacyExam = normalizedPath.match(/^\\/listening\\/'));
  for (const source of [listeningAdminSource, readingAdminSource, dashboardSource]) {
    assert.match(source, /examPaperExamPath/);
    assert.doesNotMatch(source, /window\.location\.origin\}\/listening/);
    assert.doesNotMatch(source, /\/listening\/modules\/mover\/papers/);
  }
});
