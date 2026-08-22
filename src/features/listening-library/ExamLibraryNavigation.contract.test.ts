import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const homeSource = readFileSync(new URL('./student/ListeningLibraryHome.tsx', import.meta.url), 'utf8');
const moduleSource = readFileSync(new URL('./student/ListeningModulePage.tsx', import.meta.url), 'utf8');
const routesSource = readFileSync(new URL('./routes.ts', import.meta.url), 'utf8');
const listeningAdminSource = readFileSync(new URL('../listening/admin/ListeningAdminModule.tsx', import.meta.url), 'utf8');
const readingAdminSource = readFileSync(new URL('../mover-reading-writing/admin/MoverReadingWritingAdmin.tsx', import.meta.url), 'utf8');
const dashboardSource = readFileSync(new URL('../../components/admin/AdminDashboard.tsx', import.meta.url), 'utf8');

test('exam directory uses the approved Cambridge & IELTS labels and one unified module list', () => {
  assert.match(homeSource, /Cambridge &amp; IELTS/);
  assert.match(homeSource, /Kho đề luyện thi/);
  assert.match(homeSource, /Xem danh sách/);
  assert.match(moduleSource, /data-exam-list/);
  assert.match(moduleSource, /paperDisplayName/);
  assert.match(moduleSource, /exam-library-filter-action/);
  assert.match(moduleSource, /examPaperExamPath\(moduleId, exam\.paperId, exam\.examId\)/);
  assert.doesNotMatch(moduleSource, /listeningPaperPath/);
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
