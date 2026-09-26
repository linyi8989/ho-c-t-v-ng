import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildLearningLeaderboardRequest } from './learningLeaderboardRequest';

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
  assert.match(source, /const request = buildLearningLeaderboardRequest\(\{/);
  assert.doesNotMatch(source, /fetch\(`\/api\/learning\/leaderboard-summary/);
  assert.doesNotMatch(source, /setLeaderboardOpen\(false\);[\s\S]*?setTimeout\(\(\) => setLeaderboardOpen\(true\)/);
});

test('staff assignment preview uses the authenticated scoped leaderboard', () => {
  const request = buildLearningLeaderboardRequest({
    period: 'week',
    vocabSetId: 'set / one',
    assignmentId: 'assignment-private',
    assignmentClassId: 'class-a',
    accessToken: undefined,
    authToken: 'firebase-token',
    role: 'teacher',
  });

  assert.ok(request);
  assert.equal(request.audience, 'staff');
  assert.equal(
    request.url,
    '/api/admin/leaderboard-summary?period=week&category=gold&page=1&pageSize=8&vocabSetId=set+%2F+one&classId=class-a',
  );
  assert.deepEqual(request.headers, { Authorization: 'Bearer firebase-token' });
  assert.doesNotMatch(request.url, /assignmentId/);
});

test('staff public preview uses the authenticated leaderboard filtered to the lesson', () => {
  const request = buildLearningLeaderboardRequest({
    period: 'month',
    vocabSetId: 'public-set',
    authToken: 'admin-token',
    role: 'super_admin',
  });

  assert.ok(request);
  assert.equal(request.audience, 'staff');
  assert.match(request.url, /^\/api\/admin\/leaderboard-summary\?/);
  assert.match(request.url, /vocabSetId=public-set/);
  assert.deepEqual(request.headers, { Authorization: 'Bearer admin-token' });
});

test('a share token takes precedence over staff preview credentials', () => {
  const request = buildLearningLeaderboardRequest({
    period: 'week',
    vocabSetId: 'private-set',
    assignmentId: 'assignment-a',
    assignmentClassId: 'class-a',
    accessToken: 'share-token',
    authToken: 'admin-token',
    role: 'super_admin',
  });

  assert.ok(request);
  assert.equal(request.audience, 'learning');
  assert.equal(
    request.url,
    '/api/learning/leaderboard-summary?period=week&limit=8&vocabSetId=private-set&assignmentId=assignment-a',
  );
  assert.deepEqual(request.headers, { 'X-Vocab-Share-Token': 'share-token' });
  assert.equal(Boolean(request.headers && 'Authorization' in request.headers), false);
});

test('student and guest requests retain the capability-scoped learning route', () => {
  const publicRequest = buildLearningLeaderboardRequest({
    period: 'week',
    vocabSetId: 'public-set',
    role: 'student',
    authToken: 'student-token',
  });
  const privateRequestWithoutCapability = buildLearningLeaderboardRequest({
    period: 'week',
    vocabSetId: 'private-set',
    assignmentId: 'private-assignment',
  });

  assert.ok(publicRequest);
  assert.equal(publicRequest.audience, 'learning');
  assert.equal(publicRequest.headers, undefined);
  assert.ok(privateRequestWithoutCapability);
  assert.equal(privateRequestWithoutCapability.audience, 'learning');
  assert.match(privateRequestWithoutCapability.url, /assignmentId=private-assignment/);
  assert.equal(privateRequestWithoutCapability.headers, undefined);
});

test('staff preview waits for its bearer token instead of falling back to a denied capability request', () => {
  const request = buildLearningLeaderboardRequest({
    period: 'week',
    vocabSetId: 'private-set',
    assignmentId: 'private-assignment',
    role: 'teacher',
    authToken: null,
  });

  assert.equal(request, null);
});
