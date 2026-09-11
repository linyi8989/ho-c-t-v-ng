import assert from 'node:assert/strict';
import test from 'node:test';
import { authTokenForExamRun, examRunActorTypeFromTicket } from './examRunIdentity';

const ticketFor = (ownerKey: string) => {
  const payload = Buffer.from(JSON.stringify({ ownerKey, className: 'Lớp Một' })).toString('base64url');
  return `${payload}.valid-server-signature-placeholder`;
};

test('guest exam runs remain guest when a browser auth token appears later', () => {
  const ticket = ticketFor('guest:guest-stable');
  assert.equal(examRunActorTypeFromTicket(ticket), 'guest');
  assert.equal(authTokenForExamRun(ticket, 'new-browser-user-token'), null);
});

test('authenticated exam runs keep using the latest available auth token', () => {
  const ticket = ticketFor('user:student-1');
  assert.equal(examRunActorTypeFromTicket(ticket), 'authenticated');
  assert.equal(authTokenForExamRun(ticket, 'refreshed-user-token'), 'refreshed-user-token');
  assert.equal(authTokenForExamRun(ticket, null), null);
});

test('malformed or unknown tickets never create a guest downgrade', () => {
  assert.equal(examRunActorTypeFromTicket('not-a-ticket'), undefined);
  assert.equal(authTokenForExamRun('not-a-ticket', 'current-user-token'), 'current-user-token');
  assert.equal(examRunActorTypeFromTicket(ticketFor('service:unknown')), undefined);
  assert.equal(authTokenForExamRun(ticketFor('service:unknown'), 'current-user-token'), 'current-user-token');
});
