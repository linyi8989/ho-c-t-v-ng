import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createPublicStudentKey,
  sanitizePublicStudentRecord,
} from './publicStudentIdentity';

test('public student records remove raw identities and keep stable pseudonymous grouping', () => {
  const secret = 'test-public-identity-secret';
  const source = {
    id: 'result-1',
    ownerKey: 'guest:guest-secret-id',
    guestId: 'guest-secret-id',
    studentId: 'guest-secret-id',
    userId: '',
    studentName: 'Học sinh A',
    score: 90,
  };
  const first = sanitizePublicStudentRecord(source, secret);
  const second = sanitizePublicStudentRecord({ ...source, id: 'result-2' }, secret);

  assert.equal('ownerKey' in first, false);
  assert.equal('guestId' in first, false);
  assert.equal('studentId' in first, false);
  assert.equal('userId' in first, false);
  assert.equal(first.score, 90);
  assert.match(first.publicStudentKey, /^student-[a-f0-9]{24}$/);
  assert.equal(first.publicStudentKey, first.studentKey);
  assert.equal(first.publicStudentKey, second.publicStudentKey);
});

test('public student key is secret-bound and distinguishes identities with the same name', () => {
  const first = createPublicStudentKey({
    guestId: 'guest-one',
    studentName: 'Cùng tên',
  }, 'secret-one');
  const second = createPublicStudentKey({
    guestId: 'guest-two',
    studentName: 'Cùng tên',
  }, 'secret-one');
  const rotated = createPublicStudentKey({
    guestId: 'guest-one',
    studentName: 'Cùng tên',
  }, 'secret-two');

  assert.notEqual(first, second);
  assert.notEqual(first, rotated);
});
