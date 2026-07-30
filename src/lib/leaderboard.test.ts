import assert from 'node:assert/strict';
import test from 'node:test';
import { GameSession } from '../types';
import { buildLeaderboard } from './leaderboard';

function session(
  id: string,
  identity: Record<string, unknown>,
  overrides: Partial<GameSession> = {}
): GameSession {
  return {
    id,
    vocabSetId: 'vocab-1',
    vocabSetTitle: 'Vocabulary 1',
    gameId: 'quiz',
    studentName: 'Cùng tên',
    startedAt: new Date(Date.now() - 60_000).toISOString(),
    completedAt: new Date().toISOString(),
    score: 80,
    totalQuestions: 10,
    correctAnswers: 8,
    incorrectAnswers: 2,
    ...identity,
    ...overrides
  } as GameSession;
}

test('public pseudonymous keys keep students with the same display name separate', () => {
  const leaderboard = buildLeaderboard([
    session('one', { publicStudentKey: 'student-public-one', studentKey: 'student-public-one' }),
    session('two', { publicStudentKey: 'student-public-two', studentKey: 'student-public-two' })
  ], [], { period: 'week' });

  assert.equal(leaderboard.gold.length, 2);
  assert.deepEqual(
    new Set(leaderboard.gold.map(entry => entry.studentKey)),
    new Set([
      'student-public-one|no-class',
      'student-public-two|no-class'
    ])
  );
});

test('publicStudentKey and studentKey take precedence over raw identifiers', () => {
  const leaderboard = buildLeaderboard([
    session('one', {
      publicStudentKey: 'student-shared',
      guestId: 'raw-guest-one'
    }, { score: 70, correctAnswers: 7, incorrectAnswers: 3 }),
    session('two', {
      studentKey: 'student-shared',
      guestId: 'raw-guest-two'
    }, { score: 90, correctAnswers: 9, incorrectAnswers: 1 })
  ], [], { period: 'week' });

  assert.equal(leaderboard.gold.length, 1);
  assert.equal(leaderboard.gold[0].studentKey, 'student-shared|no-class');
  assert.equal(leaderboard.gold[0].correctAnswers, 9);
});

test('raw admin sessions retain user-first identity fallback', () => {
  const leaderboard = buildLeaderboard([
    session('one', { userId: 'user-one', guestId: 'guest-one' }),
    session('two', { userId: 'user-one', guestId: 'guest-two' }, {
      score: 90,
      correctAnswers: 9,
      incorrectAnswers: 1
    }),
    session('three', { userId: 'user-two', guestId: 'guest-one' })
  ], [], { period: 'week' });

  assert.equal(leaderboard.gold.length, 2);
  assert.deepEqual(
    new Set(leaderboard.gold.map(entry => entry.studentKey)),
    new Set([
      'user:user-one|no-class',
      'user:user-two|no-class'
    ])
  );
});
