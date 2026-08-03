import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const appSource = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8');
const buildWrapperSource = readFileSync(new URL('../../../scripts/build-history-ui.mjs', import.meta.url), 'utf8');

test('student history route and navigation always ship in the normal client build', () => {
  assert.doesNotMatch(appSource, /VITE_LEARNING_HISTORY_ENABLED/);
  assert.doesNotMatch(appSource, /LEARNING_HISTORY_UI_ENABLED/);
  assert.match(appSource, /if \(studentHistoryOpen\)/);
  assert.match(appSource, /id="student-history-nav-btn"/);
  assert.match(appSource, /<StudentHistoryPage/);
  assert.doesNotMatch(buildWrapperSource, /VITE_LEARNING_HISTORY_ENABLED/);
});
