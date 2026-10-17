import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { parseGrammarPassageImport } from '../src/lib/grammarPassageImport';

const origin = process.env.GRAMMAR_QA_ORIGIN || 'http://127.0.0.1:3187';
const url = new URL(origin);
if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.port === '3000' || !url.port) throw new Error('A dedicated loopback QA server and copied database are required. Never use port 3000.');
const auth = { Authorization: 'Bearer local-test-auth-bypass' };
const report: string[] = [];
async function api(path: string, body?: unknown, headers: Record<string, string> = {}, method = body === undefined ? 'GET' : 'POST', expected = 0) {
  const response = await fetch(origin + path, { method, headers: { 'Content-Type': 'application/json', ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = await response.json();
  assert.ok(expected ? response.status === expected : response.ok, `${path}: status ${response.status}, ${JSON.stringify(data).slice(0, 400)}`);
  return data;
}
function noAnswers(data: unknown) {
  assert.doesNotMatch(JSON.stringify(data), /"(?:correctOptionId|correctAnswer|correctAnswerSnapshot|acceptedAnswers|explanation|explanationSnapshot|isCorrect|scoreAwarded)"/);
}
const bankDocument = {
  format: 'grammar-passage-v1', mode: 'passage_drag_drop' as const,
  instruction: 'Put a word below in each gap to complete the following passage.',
  passage: 'In England, when the schoolchildren come to school, they first [[1]] to the cloakroom. They take [[2]] their coats and raincoats, their caps and hats, and then go to [[3]] classroom. Some of the students go to the laboratories and workshops where they [[4]] physics, chemistry and art. When a student is [[5]] duty, he comes to [[6]] very early. He has to open [[7]] the windows, water the flowers and clean the blackboard, so everything is ready for the first lesson. At seven thirty the teacher comes into the room and the lesson [[8]].',
  wordBank: ['their', 'begins', 'on', 'go', 'off', 'school', 'all', 'learn', 'under', 'after'],
  answers: ['go', 'off', 'their', 'learn', 'on', 'school', 'all', 'begins'].map((answer, index) => ({ blank: index + 1, answer, explanation: `Ô ${index + 1}: chọn “${answer}” phù hợp với nghĩa và cấu trúc của câu.` })),
};
const readingDocument = {
  format: 'grammar-passage-v1', mode: 'reading_comprehension' as const,
  instruction: 'Read the passage and answer the questions by choosing A, B, or C.',
  passage: 'Choosing to volunteer takes up some of your time. Some people say that they do not have time to help others, so they don’t volunteer. But scientists say giving time to help others benefits us.\n\nThe first benefit of volunteering is that it helps us learn to be flexible. Volunteers have to be ready for changes and stay flexible when solving problems. Second, volunteering can improve our health because it requires us to be active. A report found that Americans who volunteer 100 hours or more a year are the healthiest people in the country. Third, volunteers have opportunities to develop more relationships. They often work in teams, and team members get to know each other and sometimes even become friends. Moreover, volunteers often help needy people, so they may feel thankful for what they have. For these reasons, volunteers are generally positive and are less likely to become depressed.\n\nSo if you have not joined a volunteer activity yet, think about it. You are likely to benefit from doing so.',
  questions: [
    { question: 'What is the main idea of the passage?', options: ['There are different types of volunteer activities.', 'What to expect when you do volunteer work.', 'There are some good reasons why you should do volunteer work.'], answer: 3 },
    { question: 'Which is NOT true about volunteers?', options: ['They are the strongest and most active.', 'They are flexible thinkers.', 'They are generally more positive.'], answer: 1 },
    { question: 'Which is a benefit of doing volunteer work?', options: ['You will have a happier family.', 'You can have more friends.', 'You will never feel unhappy.'], answer: 2 },
    { question: 'Why are volunteers often more positive?', options: ['They are the healthiest people in the country.', 'They stay active.', 'They often feel they are luckier than others.'], answer: 3 },
    { question: 'How many benefits are mentioned in the passage?', options: ['Two.', 'Three.', 'Four.'], answer: 3 },
    { question: 'What is the purpose of the passage?', options: ['To tell people not to join volunteer activities if they don’t have the time.', 'To encourage people to do some volunteer activities.', 'To explain how to do volunteer activities.'], answer: 2 },
  ].map(question => ({ ...question, explanation: 'Đối chiếu thông tin và các lợi ích được nêu trong đoạn văn.' })),
};
const base = { gradeLevel: 'Lớp 7', subject: 'English Grammar', topic: 'Passage exercises', visibility: 'assignment', description: 'Dedicated copied-database QA fixture', tags: ['qa'], timeLimitMinutes: 0, maxAttempts: 100, shuffleQuestions: false, shuffleOptions: false, showExplanationImmediately: false, showReviewAfterSubmit: true };
async function create(document: typeof bankDocument | typeof readingDocument, suffix: string) {
  const parsed = parseGrammarPassageImport(JSON.stringify(document), document.mode);
  assert.deepEqual(parsed.errors, []);
  return api('/api/admin/grammar-sets', { ...base, ...parsed, title: `Grammar passages QA ${suffix}`, displayMode: document.mode, questionType: document.mode === 'passage_drag_drop' ? 'bank_select' : 'multiple_choice' }, auth);
}
const bank = await create(bankDocument, 'bank');
const reading = await create(readingDocument, 'reading');
const dynamic = structuredClone(readingDocument);
dynamic.questions = Array.from({ length: 9 }, (_, index) => ({ question: `Dynamic question ${index + 1}`, options: Array.from({ length: index === 8 ? 28 : index % 4 + 2 }, (_, i) => `Choice ${i + 1}`), answer: index === 8 ? 28 : 1, explanation: 'QA dynamic size.' }));
const dynamicSet = await create(dynamic, 'dynamic');
assert.equal(dynamicSet.questions.length, 9); assert.equal(dynamicSet.questions[8].options.length, 28);
report.push('Create/read round-trip: 8 blanks + 10 tokens; 6 reading questions; 9 dynamic questions with up to 28 choices.');
const summaries = await api('/api/admin/grammar-sets?search=Grammar%20passages%20QA&pageSize=50', undefined, auth);
assert.equal(summaries.items.find((set: any) => set.id === bank.id).displayMode, 'passage_drag_drop');
for (const set of [bank, reading, dynamicSet]) {
  const shared = await api(`/api/grammar-sets/share/${set.shareToken}`); noAnswers(shared);
  assert.equal(shared.questions.length, set.questions.length);
  const clone = await api(`/api/admin/grammar-sets/${set.id}/clone`, {}, auth);
  assert.equal(clone.displayMode, set.displayMode); assert.equal(clone.passage, set.passage); assert.equal(clone.questions.length, set.questions.length); assert.equal(clone.visibility, 'draft');
}
report.push('Private share payloads redact all answer keys; clone preserves the full exercise; library summaries identify new modes.');
const guest = await api('/api/guest-profiles/resolve', { guestId: randomUUID(), displayName: 'Passage QA Student' });
const actor = { guestId: guest.guestId, studentName: guest.displayName };
const run = { clientRunId: `run-${randomUUID()}`, runSecret: `secret-${randomUUID()}`, startedAt: new Date().toISOString(), shareToken: bank.shareToken, ...actor };
const prepared = await api(`/api/grammar-sets/${bank.id}/attempts/prepare`, run); noAnswers(prepared);
const answerMap = Object.fromEntries(prepared.questions.map((q: any) => [q.id, bank.questions.find((source: any) => source.id === q.questionId).correctOptionId]));
const payload = { ...run, attemptToken: run.runSecret, grammarSetVersion: prepared.grammarSetVersion, bankAnswers: answerMap, answersRevision: 0, mutationId: `mutation-${randomUUID()}` };
const activated = (await api(`/api/grammar-sets/${bank.id}/attempts/activate`, payload)).attempt; noAnswers(activated); assert.equal(activated.answers.length, 8);
const retry = (await api(`/api/grammar-sets/${bank.id}/attempts/activate`, payload)).attempt; assert.equal(retry.answersRevision, 1);
const access = { ...actor, attemptToken: run.runSecret, shareToken: bank.shareToken };
const [q1, q2] = prepared.questions;
const movedMap = { ...answerMap }; delete movedMap[q1.id]; movedMap[q2.id] = answerMap[q1.id];
const moved = (await api(`/api/grammar-attempts/${activated.id}/answers`, { ...access, bankAnswers: movedMap, answersRevision: 1, mutationId: `mutation-${randomUUID()}` })).attempt;
assert.equal(moved.answers.length, 7); assert.equal(moved.answers.some((answer: any) => answer.attemptQuestionId === q1.id), false);
await api(`/api/grammar-attempts/${activated.id}/answers`, { ...access, bankAnswers: answerMap, answersRevision: 1, mutationId: `mutation-${randomUUID()}` }, {}, 'POST', 409);
await api(`/api/grammar-attempts/${activated.id}/answers`, { ...access, bankAnswers: { [q1.id]: answerMap[q1.id], [q2.id]: answerMap[q1.id] }, answersRevision: 2, mutationId: `mutation-${randomUUID()}` }, {}, 'POST', 400);
await api(`/api/grammar-attempts/${activated.id}/answers`, { ...access, attemptToken: 'wrong-token', bankAnswers: {}, answersRevision: 2, mutationId: `mutation-${randomUUID()}` }, {}, 'POST', 403);
await api(`/api/grammar-attempts/${activated.id}/answers`, { ...access, bankAnswers: {}, answersRevision: 2, mutationId: `mutation-${randomUUID()}` });
await api(`/api/grammar-attempts/${activated.id}/answers`, { ...access, bankAnswers: answerMap, answersRevision: 3, mutationId: `mutation-${randomUUID()}` });
const resumed = await api(`/api/grammar-sets/${bank.id}/attempts/prepare`, { ...run, resume: true, attemptToken: run.runSecret }); noAnswers(resumed); assert.equal(resumed.answersRevision, 4);
await api(`/api/admin/grammar-sets/${bank.id}`, { ...bank, displayMode: 'standard', questionType: 'multiple_choice', questions: reading.questions.slice(0, 1) }, auth, 'PUT');
const resumedAfterModeChange = await api(`/api/grammar-sets/${bank.id}/attempts/prepare`, { ...run, resume: true, attemptToken: run.runSecret });
assert.equal(resumedAfterModeChange.displayMode, 'passage_drag_drop'); assert.equal(resumedAfterModeChange.answers.length, 8); noAnswers(resumedAfterModeChange);
const originalPassage = bank.passage;
await api(`/api/admin/grammar-sets/${bank.id}`, { ...bank, passage: bank.passage + '\nTeacher edit after start.', showReviewAfterSubmit: false }, auth, 'PUT');
const completed = await api(`/api/grammar-attempts/${activated.id}/submit`, access); assert.equal(completed.score, 8); assert.equal(completed.correctCount, 8); assert.equal(completed.passageSnapshot, originalPassage); assert.ok(completed.questions[0].correctOptionId);
const resubmit = await api(`/api/grammar-attempts/${activated.id}/submit`, access); assert.equal(resubmit.id, completed.id); assert.equal(resubmit.alreadyCompleted, true);
await api(`/api/grammar-attempts/${activated.id}/answers`, { ...access, bankAnswers: {}, answersRevision: 4, mutationId: `mutation-${randomUUID()}` }, {}, 'POST', 400);
await api(`/api/admin/grammar-sets/${bank.id}`, bank, auth, 'PUT');
report.push('Bank activation, retry, atomic move, clear, stale revision, duplicate-token rejection, guest ownership, resume, frozen content/policy, grade and idempotent submit all pass.');
const historyHeaders = { 'X-Guest-Id': guest.guestId, 'X-Guest-Access-Token': guest.guestAccessToken };
const history = await api('/api/my-learning-history?sourceType=grammar&page=1&pageSize=20', undefined, historyHeaders);
const historyItem = history.items.find((item: any) => item.lessonId === bank.id); assert.ok(historyItem);
const detail = await api(`/api/my-learning-history/${historyItem.attemptId}`, undefined, historyHeaders);
assert.equal(detail.detail.extraDetails.grammarPassageReview.passageSnapshot, originalPassage);
assert.equal(detail.detail.answerDetails[0].userAnswer, 'go');
report.push('Actual SQLite History projection resolves bank IDs to readable words and preserves the full original passage review.');
const readingRun = { ...run, clientRunId: `run-${randomUUID()}`, runSecret: `secret-${randomUUID()}`, shareToken: reading.shareToken };
const readingPrepared = await api(`/api/grammar-sets/${reading.id}/attempts/prepare`, readingRun); noAnswers(readingPrepared);
let readingAttempt: any;
for (const [index, question] of readingPrepared.questions.entries()) {
  const answer = reading.questions.find((q: any) => q.id === question.questionId).correctOptionId;
  const result = await api(index === 0 ? `/api/grammar-sets/${reading.id}/attempts/activate` : `/api/grammar-attempts/${readingAttempt.id}/answers`, { ...readingRun, grammarSetVersion: readingPrepared.grammarSetVersion, attemptToken: readingRun.runSecret, attemptQuestionId: question.id, selectedOptionId: answer });
  if (result.attempt) readingAttempt = result.attempt;
  noAnswers(result);
}
const readingComplete = await api(`/api/grammar-attempts/${readingAttempt.id}/submit`, { ...actor, attemptToken: readingRun.runSecret }); assert.equal(readingComplete.correctCount, 6); assert.equal(readingComplete.score, 6);
report.push('Reading uses stable option IDs and grades every imported question.');
const immediate = await api('/api/admin/grammar-sets', { ...reading, id: undefined, title: 'Grammar passages QA immediate feedback', questions: reading.questions.slice(0, 1), showExplanationImmediately: true, showReviewAfterSubmit: false }, auth);
const immediateRun = { ...run, clientRunId: `run-${randomUUID()}`, runSecret: `secret-${randomUUID()}`, shareToken: immediate.shareToken };
const immediatePrepared = await api(`/api/grammar-sets/${immediate.id}/attempts/prepare`, immediateRun);
const immediateQuestion = immediatePrepared.questions[0];
const wrongId = immediateQuestion.optionsSnapshot[0].id;
const immediateResult = await api(`/api/grammar-sets/${immediate.id}/attempts/activate`, { ...immediateRun, attemptToken: immediateRun.runSecret, grammarSetVersion: immediatePrepared.grammarSetVersion, attemptQuestionId: immediateQuestion.id, selectedOptionId: wrongId });
assert.equal(immediateResult.feedback.isCorrect, false); assert.ok(immediateResult.feedback.correctOptionId);
await api(`/api/admin/grammar-sets/${immediate.id}`, { ...immediate, showExplanationImmediately: false, showReviewAfterSubmit: true }, auth, 'PUT');
const locked = await api(`/api/grammar-attempts/${immediateResult.attempt.id}/answers`, { ...actor, attemptToken: immediateRun.runSecret, attemptQuestionId: immediateQuestion.id, selectedOptionId: immediate.questions[0].correctOptionId });
assert.equal(locked.answer.selectedOptionId, wrongId); assert.equal(locked.feedback.isCorrect, false);
const immediateResumed = await api(`/api/grammar-sets/${immediate.id}/attempts/prepare`, { ...immediateRun, attemptToken: immediateRun.runSecret, resume: true });
assert.equal(immediateResumed.answerFeedback[immediateQuestion.id].isCorrect, false);
const hidden = await api(`/api/grammar-attempts/${immediateResult.attempt.id}/submit`, { ...actor, attemptToken: immediateRun.runSecret }); noAnswers(hidden); assert.equal(hidden.score, 0);
const updatedHistory = await api('/api/my-learning-history?sourceType=grammar&page=1&pageSize=20', undefined, historyHeaders);
const hiddenHistory = updatedHistory.items.find((item: any) => item.lessonId === immediate.id);
const hiddenDetail = await api(`/api/my-learning-history/${hiddenHistory.attemptId}`, undefined, historyHeaders);
assert.equal(hiddenDetail.detail.extraDetails.grammarPassageReview, undefined);
assert.doesNotMatch(JSON.stringify(hiddenDetail.detail), /"(?:correctOptionId|correctAnswer|explanation)"/);
await api(`/api/admin/grammar-sets/${immediate.id}`, immediate, auth, 'PUT');
report.push('Immediate reading feedback stays locked after reload and teacher policy changes; review-denied submit and History expose no answer keys.');
const legacy = await api(`/api/grammar-sets/${bank.id}/attempts`, { ...actor, shareToken: bank.shareToken }); noAnswers(legacy);
assert.equal(legacy.displayMode, 'passage_drag_drop'); assert.equal(legacy.wordBankSnapshot.length, 10);
const legacySaved = await api(`/api/grammar-attempts/${legacy.id}/answers`, { ...actor, attemptToken: legacy.attemptToken, bankAnswers: { [legacy.questions[0].id]: bank.questions[0].correctOptionId }, answersRevision: 0, mutationId: `mutation-${randomUUID()}` });
assert.equal(legacySaved.attempt.answers.length, 1);
report.push('Legacy attempt-creation API also supports new-mode snapshots and bank saves.');
mkdirSync('.data/grammar-passages-qa', { recursive: true });
writeFileSync('.data/grammar-passages-qa/fixtures.json', JSON.stringify({ bank, reading, dynamic: dynamicSet, immediate, bankDocument, readingDocument }, null, 2));
writeFileSync('.data/grammar-passages-qa/api-report.json', JSON.stringify({ passed: true, checks: report }, null, 2));
for (const check of report) console.log(check);
