import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const homeSource = readFileSync(new URL('./student/ListeningLibraryHome.tsx', import.meta.url), 'utf8');
const moduleSource = readFileSync(new URL('./student/ListeningModulePage.tsx', import.meta.url), 'utf8');
const routesSource = readFileSync(new URL('./routes.ts', import.meta.url), 'utf8');
const libraryAdminSource = readFileSync(new URL('./admin/ListeningLibraryAdmin.tsx', import.meta.url), 'utf8');
const listeningAdminSource = readFileSync(new URL('../listening/admin/ListeningAdminModule.tsx', import.meta.url), 'utf8');
const readingAdminSource = readFileSync(new URL('../mover-reading-writing/admin/MoverReadingWritingAdmin.tsx', import.meta.url), 'utf8');
const dashboardSource = readFileSync(new URL('../../components/admin/AdminDashboard.tsx', import.meta.url), 'utf8');
const globalCssSource = readFileSync(new URL('../../index.css', import.meta.url), 'utf8');

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
  assert.doesNotMatch(libraryAdminSource, /if \(selectedModuleId\) \{\s*return/);
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
