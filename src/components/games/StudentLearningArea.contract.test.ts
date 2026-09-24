import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./StudentLearningArea.tsx', import.meta.url), 'utf8');

test('vocabulary name validation stays below the input instead of becoming a flex column', () => {
  const fieldStart = source.indexOf('id="student-name-field"');
  const input = source.indexOf('id="student-name-input"', fieldStart);
  const error = source.indexOf('id="student-name-error"', input);
  const button = source.indexOf('id="submit-name-btn"', error);

  assert.ok(fieldStart >= 0);
  assert.ok(input > fieldStart);
  assert.ok(error > input);
  assert.ok(button > error);
  assert.match(source, /className="min-w-0 flex-1 space-y-2" id="student-name-field"/);
  assert.match(source, /aria-describedby=\{nameError \? 'student-name-error' : undefined\}/);
  assert.match(source, /className="w-full sm:w-auto py-4 px-8/);
});

test('student leaderboard toggle exposes its state and retry refreshes the active request', () => {
  assert.match(source, /data-leaderboard-status=\{leaderboardOpen \? leaderboardStatus : 'closed'\}/);
  assert.match(source, /id="learning-golden-toggle"[\s\S]*?aria-expanded=\{leaderboardOpen\}/);
  assert.match(source, /onClick=\{\(\) => setLeaderboardRefreshKey\(key => key \+ 1\)\}/);
  assert.doesNotMatch(source, /setLeaderboardOpen\(false\);[\s\S]*?setTimeout\(\(\) => setLeaderboardOpen\(true\)/);
});
