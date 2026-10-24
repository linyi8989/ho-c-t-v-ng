import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import type { GrammarAttempt, GrammarSet } from '../src/types';
import { parseGrammarMixedImport } from '../src/lib/grammarMixedImport';
import { parseGrammarPassageImport } from '../src/lib/grammarPassageImport';
import { convertLegacyGrammarToBlocks } from '../src/lib/grammarBlocks';

// This script deliberately refuses the user's localhost database and all remote hosts.
const origin = process.env.GRAMMAR_MIXED_QA_ORIGIN || 'http://127.0.0.1:3188';
const target = new URL(origin);
if (!['127.0.0.1', 'localhost'].includes(target.hostname) || !target.port || target.port === '3000') throw new Error('Use a dedicated loopback QA port with a verified copied database; never port 3000.');
const auth = { Authorization: 'Bearer local-test-auth-bypass' };
const checks: string[] = [];
const note = (message: string) => { checks.push(message); console.log(message); };
const evidence = '.data/grammar-mixed-qa';
mkdirSync(evidence, { recursive: true });
async function api<T>(path: string, body?: unknown, headers: Record<string, string> = {}, method = body === undefined ? 'GET' : 'POST', expected = method === 'POST' && /^\/api\/admin\/grammar-sets(?:\/[^/]+\/clone)?$/.test(path) ? 201 : 200): Promise<T> {
  const response = await fetch(origin + path, { method, headers: { 'Content-Type': 'application/json', ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const data = await response.json();
  assert.equal(response.status, expected, `${method} ${path}: ${response.status} ${JSON.stringify(data).slice(0, 400)}`);
  return data as T;
}
function noKeys(value: unknown) {
  assert.doesNotMatch(JSON.stringify(value), /"(?:correctOptionId|correctAnswer|correctAnswerSnapshot|acceptedAnswers|explanation|explanationSnapshot|isCorrect|scoreAwarded)"\s*:/);
}
type AttemptReply = { attempt: GrammarAttempt; alreadyCompleted?: boolean; feedback?: { isCorrect?: boolean } };
type HistoryList = { items: Array<{ lessonId: string; attemptId: string }> };
type HistoryDetail = { detail: { extraDetails?: Record<string, unknown>; answerDetails: Array<Record<string, unknown>> } };
const document = {
  format: 'grammar-mixed-v1',
  blocks: [
    { type: 'multiple_choice', title: 'Quick grammar', instruction: 'Choose the correct answer.', questions: [
      { question: 'She ___ to school every day.', options: ['go', 'goes', 'going'], answer: 2, explanation: 'She là chủ ngữ số ít nên dùng goes.' },
      { question: 'Choose the last choice to check dynamic options.', options: Array.from({ length: 28 }, (_, index) => `Choice ${index + 1}`), answer: 28, explanation: 'Dữ liệu kiểm thử giữ đầy đủ 28 lựa chọn.' },
    ] },
    { type: 'passage_drag_drop', title: 'School morning', instruction: 'Move a word into each gap.', passage: 'They [[1]] to school. The lesson [[2]] at eight.', wordBank: ['begins', 'go', 'off'], answers: [
      { blank: 1, answer: 'go', explanation: 'They đi với go.' }, { blank: 2, answer: 'begins', explanation: 'The lesson đi với begins.' },
    ] },
    { type: 'reading_comprehension', title: 'Volunteering', instruction: 'Read the passage, then choose.', passage: 'Volunteers help people in their community. They also make new friends.\n\nThey learn to be flexible.', questions: [
      { question: 'What can volunteers do?', options: ['Make friends.', 'Never meet people.'], answer: 1, explanation: 'Bài đọc nói tình nguyện giúp có thêm bạn.' },
      { question: 'What do they learn?', options: ['To avoid people.', 'To be flexible.', 'To stop helping.'], answer: 2, explanation: 'Thông tin nằm ở đoạn cuối.' },
    ] },
    { type: 'passage_drag_drop', title: 'Family evening', instruction: 'Use this separate word bank.', passage: 'My brother [[1]] dinner. We [[2]] together.', wordBank: ['eat', 'cooks', 'under', 'go'], answers: [
      { blank: 1, answer: 'cooks', explanation: 'My brother đi với cooks.' }, { blank: 2, answer: 'eat', explanation: 'We đi với eat.' },
    ] },
  ],
};
const base = { title: 'Mixed Grammar QA one link', description: 'Isolated copied-database fixture', gradeLevel: 'Lớp 8', subject: 'English Grammar', topic: 'Mixed practice', tags: ['qa'], visibility: 'assignment', timeLimitMinutes: 0, maxAttempts: 100, shuffleQuestions: true, shuffleOptions: true, showExplanationImmediately: true, showReviewAfterSubmit: true };
const parsed = parseGrammarMixedImport(JSON.stringify(document));
assert.deepEqual(parsed.errors, []);
assert.equal(parsed.blocks.length, 4); assert.equal(parsed.questions.length, 8);
assert.equal(new Set(parsed.questions.map(question => question.id)).size, 8);
assert.equal(parsed.questions[1].options.length, 28);
const mixed = await api<GrammarSet>('/api/admin/grammar-sets', { ...base, ...parsed, displayMode: 'mixed', contentVersion: 2, questionType: 'multiple_choice' }, auth);
assert.equal(mixed.displayMode, 'mixed'); assert.equal(mixed.contentVersion, 2);
assert.equal(mixed.blocks?.length, 4); assert.equal(mixed.questions.length, 8);
assert.equal(mixed.showExplanationImmediately, false, 'Any bank block disables immediate answer-key release for the entire mixed run.');
const shared = await api<GrammarSet>(`/api/grammar-sets/share/${mixed.shareToken}`); noKeys(shared);
assert.equal(shared.blocks?.length, 4); assert.equal(shared.questions[1].options.length, 28);
const clone = await api<GrammarSet>(`/api/admin/grammar-sets/${mixed.id}/clone`, {}, auth);
assert.equal(clone.visibility, 'draft'); assert.deepEqual(clone.blocks, mixed.blocks); assert.equal(clone.questions.length, 8); assert.equal(clone.shareToken, undefined);
const list = await api<{ items: Array<{ id: string; displayMode?: string; questionCount?: number }> }>('/api/admin/grammar-sets?search=Mixed%20Grammar%20QA&pageSize=50', undefined, auth);
assert.equal(list.items.find(item => item.id === mixed.id)?.displayMode, 'mixed');
assert.equal(list.items.find(item => item.id === mixed.id)?.questionCount, 8);
const duplicateReference = structuredClone(mixed);
duplicateReference.blocks![1].questionIds.push(duplicateReference.blocks![0].questionIds[0]);
await api('/api/admin/grammar-sets', { ...duplicateReference, id: undefined, title: 'Invalid cross-block reference' }, auth, 'POST', 400);
note('Versioned import, canonical IDs, 4 ordered blocks/8 questions/28 choices, private share, clone, library count and malformed cross-block reference validation pass.');

const guest = await api<{ guestId: string; displayName: string; guestAccessToken: string }>('/api/guest-profiles/resolve', { guestId: randomUUID(), displayName: 'Mixed QA Student' });
const actor = { guestId: guest.guestId, studentName: guest.displayName };
const run = { ...actor, clientRunId: `mixed-${randomUUID()}`, runSecret: `secret-${randomUUID()}`, startedAt: new Date().toISOString(), shareToken: mixed.shareToken };
const prepared = await api<GrammarAttempt>(`/api/grammar-sets/${mixed.id}/attempts/prepare`, run); noKeys(prepared);
assert.equal(prepared.displayMode, 'mixed'); assert.equal(prepared.blocksSnapshot?.length, 4); assert.equal(prepared.questions.length, 8);
assert.deepEqual(prepared.blocksSnapshot?.map(block => block.type), document.blocks.map(block => block.type));
const sourceQuestion = (questionId: string) => { const source = mixed.questions.find(question => question.id === questionId); assert.ok(source); return source; };
const questionFor = (blockId: string, index = 0) => { const question = prepared.questions.filter(question => question.blockId === blockId)[index]; assert.ok(question); return question; };
const blocks = mixed.blocks!;
const mcq = questionFor(blocks[0].id);
const bankA = prepared.questions.filter(question => question.blockId === blocks[1].id);
const reading = prepared.questions.filter(question => question.blockId === blocks[2].id);
const bankB = prepared.questions.filter(question => question.blockId === blocks[3].id);
assert.equal(bankA[0].blankNumber, 1); assert.equal(bankB[0].blankNumber, 1);
const allCorrect = Object.fromEntries(prepared.questions.map(question => [question.id, sourceQuestion(question.questionId).correctOptionId]));
const access = { ...actor, attemptToken: run.runSecret, shareToken: mixed.shareToken };
const firstMutation = { ...run, ...access, grammarSetVersion: prepared.grammarSetVersion, attemptQuestionId: mcq.id, selectedOptionId: allCorrect[mcq.id], answersRevision: 0, mutationId: `mutation-${randomUUID()}` };
let active = (await api<AttemptReply>(`/api/grammar-sets/${mixed.id}/attempts/activate`, firstMutation)).attempt; noKeys(active);
assert.equal(active.answersRevision, 1); assert.equal(active.answers.length, 1);
const activatedAgain = (await api<AttemptReply>(`/api/grammar-sets/${mixed.id}/attempts/activate`, firstMutation)).attempt;
assert.equal(activatedAgain.id, active.id); assert.equal(activatedAgain.answersRevision, 1);
const save = async (payload: Record<string, unknown>) => {
  const result = await api<AttemptReply>(`/api/grammar-attempts/${active.id}/answers`, { ...access, answersRevision: active.answersRevision || 0, mutationId: `mutation-${randomUUID()}`, ...payload });
  noKeys(result); active = result.attempt; return active;
};
await save({ blockId: blocks[3].id, bankAnswers: Object.fromEntries(bankB.map(question => [question.id, allCorrect[question.id]])) });
await save({ attemptQuestionId: reading[0].id, selectedOptionId: allCorrect[reading[0].id] });
await save({ blockId: blocks[1].id, bankAnswers: Object.fromEntries(bankA.map(question => [question.id, allCorrect[question.id]])) });
assert.equal(active.answers.length, 6);
const preserved = active.answers.filter(answer => !bankA.some(question => question.id === answer.attemptQuestionId));
await save({ blockId: blocks[1].id, bankAnswers: { [bankA[1].id]: allCorrect[bankA[0].id] } });
assert.equal(active.answers.length, 5); assert.equal(active.answers.some(answer => answer.attemptQuestionId === bankA[0].id), false);
assert.deepEqual(active.answers.filter(answer => !bankA.some(question => question.id === answer.attemptQuestionId)), preserved);
await save({ blockId: blocks[1].id, bankAnswers: {} });
assert.equal(active.answers.length, 4); assert.deepEqual(active.answers, preserved);
await api(`/api/grammar-attempts/${active.id}/answers`, { ...access, blockId: blocks[1].id, bankAnswers: { [bankB[0].id]: allCorrect[bankB[0].id] }, answersRevision: active.answersRevision, mutationId: randomUUID() }, {}, 'POST', 400);
await api(`/api/grammar-attempts/${active.id}/answers`, { ...access, blockId: blocks[1].id, bankAnswers: { [bankA[0].id]: allCorrect[bankB[0].id] }, answersRevision: active.answersRevision, mutationId: randomUUID() }, {}, 'POST', 400);
await api(`/api/grammar-attempts/${active.id}/answers`, { ...access, bankAnswers: {}, answersRevision: active.answersRevision, mutationId: randomUUID() }, {}, 'POST', 400);
await api(`/api/grammar-attempts/${active.id}/answers`, { ...access, blockId: blocks[1].id, bankAnswers: { [bankA[0].id]: allCorrect[bankA[0].id], [bankA[1].id]: allCorrect[bankA[0].id] }, answersRevision: active.answersRevision, mutationId: randomUUID() }, {}, 'POST', 400);
await api(`/api/grammar-attempts/${active.id}/answers`, { ...access, attemptQuestionId: reading[1].id, selectedOptionId: allCorrect[reading[1].id], answersRevision: 0, mutationId: randomUUID() }, {}, 'POST', 409);
await api(`/api/grammar-attempts/${active.id}/answers`, { ...access, attemptToken: 'wrong-secret', blockId: blocks[1].id, bankAnswers: {}, answersRevision: active.answersRevision, mutationId: randomUUID() }, {}, 'POST', 403);
await save({ blockId: blocks[1].id, bankAnswers: Object.fromEntries(bankA.map(question => [question.id, allCorrect[question.id]])) });
for (const question of prepared.questions.filter(question => question.questionType !== 'bank_select' && !active.answers.some(answer => answer.attemptQuestionId === question.id))) await save({ attemptQuestionId: question.id, selectedOptionId: allCorrect[question.id] });
assert.equal(active.answers.length, 8);
note('One attempt saves MCQ, reading and both banks; move/clear is block-scoped and preserves all other answers. Cross-block IDs/tokens, omitted block, reused token, stale revision and wrong run secret are rejected.');

const originalBlocks = active.blocksSnapshot;
await api(`/api/admin/grammar-sets/${mixed.id}`, { ...mixed, displayMode: 'standard', questions: [mixed.questions[0]], blocks: undefined, contentVersion: undefined, showReviewAfterSubmit: false }, auth, 'PUT');
const resumed = await api<GrammarAttempt>(`/api/grammar-sets/${mixed.id}/attempts/prepare`, { ...run, attemptToken: run.runSecret, resume: true }); noKeys(resumed);
assert.equal(resumed.displayMode, 'mixed'); assert.deepEqual(resumed.blocksSnapshot, originalBlocks); assert.equal(resumed.answers.length, 8);
const completed = await api<GrammarAttempt>(`/api/grammar-attempts/${active.id}/submit`, access);
assert.equal(completed.correctCount, 8); assert.equal(completed.score, 8); assert.deepEqual(completed.blocksSnapshot, originalBlocks);
const repeated = await api<GrammarAttempt & { alreadyCompleted?: boolean }>(`/api/grammar-attempts/${active.id}/submit`, access);
assert.equal(repeated.id, completed.id); assert.equal(repeated.alreadyCompleted, true);
await api(`/api/grammar-attempts/${active.id}/answers`, { ...access, blockId: blocks[1].id, bankAnswers: {}, answersRevision: active.answersRevision, mutationId: randomUUID() }, {}, 'POST', 400);
const review = await api<GrammarAttempt>(`/api/grammar-attempts/${active.id}/review?guestId=${encodeURIComponent(guest.guestId)}&attemptToken=${encodeURIComponent(run.runSecret)}`);
assert.equal(review.questions.length, 8); assert.ok(review.questions[0].correctOptionId);
const otherGuest = await api<{ guestId: string }>('/api/guest-profiles/resolve', { guestId: randomUUID(), displayName: 'Other QA Student' });
await api(`/api/grammar-attempts/${active.id}/review?guestId=${encodeURIComponent(otherGuest.guestId)}&attemptToken=${encodeURIComponent(run.runSecret)}`, undefined, {}, 'GET', 403);
const historyHeaders = { 'X-Guest-Id': guest.guestId, 'X-Guest-Access-Token': guest.guestAccessToken };
const history = await api<HistoryList>('/api/my-learning-history?sourceType=grammar&pageSize=50', undefined, historyHeaders);
assert.equal(history.items.filter(item => item.lessonId === mixed.id).length, 1);
const historyRow = history.items.find(item => item.lessonId === mixed.id)!;
const detail = await api<HistoryDetail>(`/api/my-learning-history/${historyRow.attemptId}`, undefined, historyHeaders);
assert.equal(detail.detail.answerDetails.length, 8);
assert.ok(Object.values(detail.detail.extraDetails || {}).some(value => value && typeof value === 'object' && 'blocksSnapshot' in value), 'History keeps the same mixed visual snapshot.');
assert.ok(detail.detail.answerDetails.some(answer => String(answer.userAnswer).includes('go')));
await api(`/api/admin/grammar-sets/${mixed.id}`, mixed, auth, 'PUT');
note('Resume freezes all blocks, answers and review policy after teacher changes mode; single submit/result/History is idempotent and displays readable bank words.');

const hidden = await api<GrammarSet>('/api/admin/grammar-sets', { ...mixed, id: undefined, title: 'Mixed Grammar QA hidden review', showReviewAfterSubmit: false }, auth);
const hiddenRun = { ...run, clientRunId: randomUUID(), runSecret: randomUUID(), shareToken: hidden.shareToken };
const hiddenPrepared = await api<GrammarAttempt>(`/api/grammar-sets/${hidden.id}/attempts/prepare`, hiddenRun);
const hiddenQuestion = hiddenPrepared.questions[0];
const hiddenActive = (await api<AttemptReply>(`/api/grammar-sets/${hidden.id}/attempts/activate`, { ...hiddenRun, attemptToken: hiddenRun.runSecret, grammarSetVersion: hiddenPrepared.grammarSetVersion, attemptQuestionId: hiddenQuestion.id, selectedOptionId: hiddenQuestion.optionsSnapshot[0].id, answersRevision: 0, mutationId: randomUUID() })).attempt;
const hiddenComplete = await api<GrammarAttempt>(`/api/grammar-attempts/${hiddenActive.id}/submit`, { ...actor, attemptToken: hiddenRun.runSecret }); noKeys(hiddenComplete);
const hiddenHistory = await api<HistoryList>('/api/my-learning-history?sourceType=grammar&pageSize=50', undefined, historyHeaders);
const hiddenRow = hiddenHistory.items.find(item => item.lessonId === hidden.id)!; assert.ok(hiddenRow);
const hiddenDetail = await api<HistoryDetail>(`/api/my-learning-history/${hiddenRow.attemptId}`, undefined, historyHeaders);
assert.equal(Object.keys(hiddenDetail.detail.extraDetails || {}).filter(key => /grammar.*review/i.test(key)).length, 0);
assert.doesNotMatch(JSON.stringify(hiddenDetail.detail), /"(?:correctOptionId|correctAnswer|explanation|blocksSnapshot)"\s*:/);
note('Hidden-review mixed submit and actual History remove the complete visual snapshot and every private answer/explanation.');

const legacyDocuments = [
  { format: 'grammar-passage-v1', mode: 'passage_drag_drop' as const, instruction: 'Legacy bank.', passage: 'They [[1]] home.', wordBank: ['go', 'off'], answers: [{ blank: 1, answer: 'go', explanation: 'They đi với go.' }] },
  { format: 'grammar-passage-v1', mode: 'reading_comprehension' as const, instruction: 'Legacy reading.', passage: 'The boy has a blue bike.', questions: [{ question: 'What colour is the bike?', options: ['Blue.', 'Red.'], answer: 1, explanation: 'Bài đọc nói blue bike.' }] },
];
for (const legacyDocument of legacyDocuments) {
  const legacyParsed = parseGrammarPassageImport(JSON.stringify(legacyDocument), legacyDocument.mode); assert.deepEqual(legacyParsed.errors, []);
  const legacySet = await api<GrammarSet>('/api/admin/grammar-sets', { ...base, ...legacyParsed, displayMode: legacyDocument.mode, questionType: legacyDocument.mode === 'passage_drag_drop' ? 'bank_select' : 'multiple_choice', title: `Mixed QA legacy ${legacyDocument.mode}`, showExplanationImmediately: false }, auth);
  const legacyRun = { ...run, clientRunId: randomUUID(), runSecret: randomUUID(), shareToken: legacySet.shareToken };
  const legacyPrepared = await api<GrammarAttempt>(`/api/grammar-sets/${legacySet.id}/attempts/prepare`, legacyRun); noKeys(legacyPrepared);
  const question = legacyPrepared.questions[0];
  const legacyBody = legacyDocument.mode === 'passage_drag_drop' ? { bankAnswers: { [question.id]: legacySet.questions[0].correctOptionId }, answersRevision: 0, mutationId: randomUUID() } : { attemptQuestionId: question.id, selectedOptionId: legacySet.questions[0].correctOptionId };
  const legacyActive = (await api<AttemptReply>(`/api/grammar-sets/${legacySet.id}/attempts/activate`, { ...legacyRun, attemptToken: legacyRun.runSecret, grammarSetVersion: legacyPrepared.grammarSetVersion, ...legacyBody }, {}, 'POST', legacyDocument.mode === 'passage_drag_drop' ? 200 : 201)).attempt;
  const legacyComplete = await api<GrammarAttempt>(`/api/grammar-attempts/${legacyActive.id}/submit`, { ...actor, attemptToken: legacyRun.runSecret });
  assert.equal(legacyComplete.correctCount, 1); assert.equal(legacyComplete.displayMode, legacyDocument.mode);
}
const oldChoice = { ...mixed.questions[0], blockId: undefined };
const standard = await api<GrammarSet>('/api/admin/grammar-sets', { ...base, title: 'Mixed QA legacy standard', displayMode: 'standard', questionType: 'multiple_choice', questions: [oldChoice], showExplanationImmediately: false }, auth);
const standardRun = { ...run, clientRunId: randomUUID(), runSecret: randomUUID(), shareToken: standard.shareToken };
const standardPrepared = await api<GrammarAttempt>(`/api/grammar-sets/${standard.id}/attempts/prepare`, standardRun);
const standardActive = (await api<AttemptReply>(`/api/grammar-sets/${standard.id}/attempts/activate`, { ...standardRun, grammarSetVersion: standardPrepared.grammarSetVersion, attemptQuestionId: standardPrepared.questions[0].id, selectedOptionId: oldChoice.correctOptionId }, {}, 'POST', 201)).attempt;
const standardComplete = await api<GrammarAttempt>(`/api/grammar-attempts/${standardActive.id}/submit`, { ...actor, attemptToken: standardRun.runSecret }); assert.equal(standardComplete.correctCount, 1);
note('Existing standard MCQ, standalone bank and standalone reading still create/save/grade through their original API payloads.');

const conversionSet = await api<GrammarSet>('/api/admin/grammar-sets', { ...standard, id: undefined, title: 'Mixed QA explicit legacy conversion' }, auth);
const conversionRun = { ...run, clientRunId: randomUUID(), runSecret: randomUUID(), shareToken: conversionSet.shareToken };
const conversionPrepared = await api<GrammarAttempt>(`/api/grammar-sets/${conversionSet.id}/attempts/prepare`, conversionRun);
const conversionActive = (await api<AttemptReply>(`/api/grammar-sets/${conversionSet.id}/attempts/activate`, { ...conversionRun, grammarSetVersion: conversionPrepared.grammarSetVersion, attemptQuestionId: conversionPrepared.questions[0].id, selectedOptionId: conversionSet.questions[0].correctOptionId }, {}, 'POST', 201)).attempt;
const converted = convertLegacyGrammarToBlocks(conversionSet);
const appended = parseGrammarMixedImport(JSON.stringify(legacyDocuments[0])); assert.deepEqual(appended.errors, []);
const convertedSet = await api<GrammarSet>(`/api/admin/grammar-sets/${conversionSet.id}`, { ...conversionSet, displayMode: 'mixed', contentVersion: 2, blocks: [...converted.blocks, ...appended.blocks], questions: [...converted.questions, ...appended.questions] }, auth, 'PUT');
assert.equal(convertedSet.id, conversionSet.id); assert.equal(convertedSet.shareToken, conversionSet.shareToken);
assert.equal(convertedSet.questions[0].id, conversionSet.questions[0].id); assert.equal(convertedSet.questions.length, 2);
const oldCompleted = await api<GrammarAttempt>(`/api/grammar-attempts/${conversionActive.id}/submit`, { ...actor, attemptToken: conversionRun.runSecret });
assert.equal(oldCompleted.questions.length, 1); assert.equal(oldCompleted.maxScore, 1); assert.equal(oldCompleted.correctCount, 1);
assert.notEqual(oldCompleted.displayMode, 'mixed');

const direct = await api<GrammarAttempt>(`/api/grammar-sets/${mixed.id}/attempts`, { ...actor, shareToken: mixed.shareToken }, {}, 'POST', 201);
assert.equal(direct.displayMode, 'mixed'); assert.equal(direct.blocksSnapshot?.length, 4); assert.ok(direct.attemptToken);
const directQuestion = direct.questions[0];
const directSaved = (await api<AttemptReply>(`/api/grammar-attempts/${direct.id}/answers`, { ...actor, attemptToken: direct.attemptToken, attemptQuestionId: directQuestion.id, selectedOptionId: sourceQuestion(directQuestion.questionId).correctOptionId, answersRevision: 0, mutationId: randomUUID() })).attempt;
assert.equal(directSaved.answersRevision, 1); assert.equal(directSaved.answers.length, 1);
const directCompleted = await api<GrammarAttempt>(`/api/grammar-attempts/${direct.id}/submit`, { ...actor, attemptToken: direct.attemptToken });
assert.equal(directCompleted.correctCount, 1); assert.equal(directCompleted.unansweredCount, 7);
note('Explicit legacy conversion preserves the set/link/question IDs and an already-started old attempt; non-lazy create/save/submit also supports the new mixed layout.');

writeFileSync(`${evidence}/fixtures.json`, JSON.stringify({ mixed, hidden, document, legacyDocuments, standard }, null, 2));
writeFileSync(`${evidence}/api-report.json`, JSON.stringify({ passed: true, origin, checks }, null, 2));
