import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8');
const homePageSource = readFileSync(new URL('../../features/home/HomePage.tsx', import.meta.url), 'utf8');
const buildWrapperSource = readFileSync(new URL('../../../scripts/build-history-ui.mjs', import.meta.url), 'utf8');

test('student history route and navigation always ship in the normal client build', () => {
  assert.doesNotMatch(appSource, /VITE_LEARNING_HISTORY_ENABLED/);
  assert.doesNotMatch(appSource, /LEARNING_HISTORY_UI_ENABLED/);
  assert.match(appSource, /if \(studentHistoryOpen\)/);
  assert.match(appSource, /<StudentHistoryPage/);
  assert.match(appSource, /onOpenHistory=\{\(\) => navigateToStudentHistory\(true\)\}/);
  assert.match(homePageSource, /id="student-history-nav-btn"/);
  assert.match(homePageSource, /onClick=\{onOpenHistory\}/);
  assert.doesNotMatch(buildWrapperSource, /VITE_LEARNING_HISTORY_ENABLED/);
});
