import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EXPIRED_ATTEMPT_ARCHIVE_KEY,
  archiveExpiredAttemptAnswers,
  attemptErrorCode,
  isAttemptRecoveryExpired,
  isExpiredAttemptTicket,
} from './attemptRecovery.js';

test('attempt ticket errors are classified by an explicit server code', () => {
  const expired = { status: 410, details: { code: 'MOVER_READING_ATTEMPT_TICKET_EXPIRED' } };
  assert.equal(attemptErrorCode(expired), 'MOVER_READING_ATTEMPT_TICKET_EXPIRED');
  assert.equal(isExpiredAttemptTicket(expired, 'mover-reading-writing'), true);
  assert.equal(isExpiredAttemptTicket({ status: 410 }, 'mover-reading-writing'), false);
  assert.equal(isAttemptRecoveryExpired({ details: { code: 'LISTENING_ATTEMPT_TICKET_RECOVERY_EXPIRED' } }, 'listening'), true);
});

test('expired answers are archived without the signed ticket or run secret', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem(key: string) { return values.get(key) ?? null; },
    setItem(key: string, value: string) { values.set(key, value); },
  };
  assert.equal(archiveExpiredAttemptAnswers(storage, {
    source: 'exam-platform',
    setId: 'set-1',
    versionId: 'version-1',
    clientRunId: 'run-1',
    startedAt: '2026-09-01T00:00:00.000Z',
    currentPart: 2,
    answers: { q1: 'A' },
  }), true);
  const archived = JSON.parse(values.get(EXPIRED_ATTEMPT_ARCHIVE_KEY) || '[]');
  assert.equal(archived.length, 1);
  assert.deepEqual(archived[0].answers, { q1: 'A' });
  assert.equal('ticket' in archived[0], false);
  assert.equal('runSecret' in archived[0], false);
});
