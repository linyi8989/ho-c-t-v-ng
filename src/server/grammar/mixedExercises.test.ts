import assert from 'node:assert/strict';
import test from 'node:test';
import type { GrammarAttempt, GrammarAttemptAnswer, GrammarQuestion } from '../../types';
import { isGrammarMixedReview } from '../../lib/grammarBlocks';
import { createGrammarAttemptService } from '../grammar-attempts/service';
import { projectGrammarAttempt } from '../learning-history/learningAttemptProjector';
import { normalizeStoredDetail } from '../learning-history/learningDetailNormalizer';
import { mixedAttemptSnapshot, normalizeMixedExercise, sanitizeMixedAttemptMetadata, sanitizeMixedSetMetadata, updateMixedAnswers } from './mixedExercises';

const now = '2026-10-24T07:00:00.000Z';
function sourceSet() {
  const choice = (id: string, blockId: string, count = 3): GrammarQuestion => ({
    id, blockId, questionType: 'multiple_choice', questionText: `Question ${id}`,
    options: Array.from({ length: count }, (_, index) => ({ id: `${id}-option-${index}`, text: `Choice ${index + 1}`, originalPosition: index + 1 })),
    correctOptionId: `${id}-option-0`, explanation: `Explanation ${id}`, score: 2, position: 1,
  });
  const blank = (id: string, blockId: string, blankNumber: number, tokenId: string): GrammarQuestion => ({
    id, blockId, questionType: 'bank_select', questionText: `Blank ${blankNumber}`, options: [],
    correctOptionId: tokenId, explanation: `Explanation ${id}`, score: 1, position: 1, blankNumber,
  });
  return {
    id: 'mixed-set', title: 'One grammar lesson', displayMode: 'mixed', contentVersion: 2,
    showExplanationImmediately: true, showReviewAfterSubmit: true, maxAttempts: 3,
    blocks: [
      { id: 'choice-block', type: 'multiple_choice', title: '', instruction: '', questionIds: ['choice-question'] },
      { id: 'bank-a', type: 'passage_drag_drop', title: '', instruction: '', passage: '[[1]] cat and [[2]] dog', wordBank: [{ id: 'a-one', text: 'the' }, { id: 'a-two', text: 'the' }, { id: 'a-extra', text: 'a' }], questionIds: ['a-question-1', 'a-question-2'] },
      { id: 'reading-block', type: 'reading_comprehension', title: '', instruction: '', passage: 'Read this shared paragraph.', questionIds: ['reading-question'] },
      { id: 'bank-b', type: 'passage_drag_drop', title: '', instruction: '', passage: '[[1]] home', wordBank: [{ id: 'b-one', text: 'go' }, { id: 'b-extra', text: 'gone' }], questionIds: ['b-question'] },
    ],
    questions: [choice('choice-question', 'choice-block'), blank('a-question-1', 'bank-a', 1, 'a-one'), blank('a-question-2', 'bank-a', 2, 'a-two'), choice('reading-question', 'reading-block', 28), blank('b-question', 'bank-b', 1, 'b-one')],
  };
}
function normalizedSet() { return { ...sourceSet(), ...normalizeMixedExercise(sourceSet(), prefix => `${prefix}-generated`)! }; }
function attemptFor(set = normalizedSet()): GrammarAttempt {
  const fixture: GrammarAttempt & { ownerType: 'user'; ownerKey: string } = {
    id: 'mixed-attempt', grammarSetId: set.id, userId: 'student', studentName: 'Student',
    ownerType: 'user', ownerKey: 'user:student', status: 'prepared', score: 0,
    maxScore: set.questions.reduce((total, question) => total + question.score, 0),
    correctCount: 0, wrongCount: 0, unansweredCount: set.questions.length, startedAt: now, createdAt: now,
    ...mixedAttemptSnapshot(set),
    reviewPolicySnapshot: { showExplanationImmediately: set.showExplanationImmediately, showReviewAfterSubmit: true, policyVersion: 1 },
    questions: set.questions.map((question, index) => ({
      id: `attempt-${question.id}`, questionId: question.id, blockId: question.blockId,
      questionType: question.questionType, questionSnapshot: question.questionText,
      optionsSnapshot: question.options.map(option => ({ ...option })), optionOrder: question.options.map(option => option.id),
      correctOptionId: question.correctOptionId, explanationSnapshot: question.explanation,
      blankNumber: question.blankNumber, scoreSnapshot: question.score, displayPosition: index + 1,
    })), answers: [],
  };
  return fixture;
}
function buildChoiceAnswer(attempt: GrammarAttempt, payload: Record<string, any>) {
  const question = attempt.questions.find(item => item.id === payload.attemptQuestionId)!;
  assert.ok(question?.optionsSnapshot.some(option => option.id === payload.selectedOptionId));
  const correct = question.correctOptionId === payload.selectedOptionId;
  return { answer: {
    id: `answer-${question.id}`, attemptQuestionId: question.id, questionId: question.questionId,
    selectedOptionId: payload.selectedOptionId, correctOptionId: question.correctOptionId,
    isCorrect: correct, scoreAwarded: correct ? question.scoreSnapshot : 0, answeredAt: now,
  } satisfies GrammarAttemptAnswer, feedback: null };
}
function mutate(attempt: GrammarAttempt, payload: Record<string, any>) {
  return updateMixedAnswers(attempt, payload, now, body => buildChoiceAnswer(attempt, body)).attempt;
}
const choicePayload = (attempt: GrammarAttempt, questionIndex: number, mutationId: string) => ({
  attemptQuestionId: attempt.questions[questionIndex].id,
  selectedOptionId: attempt.questions[questionIndex].correctOptionId,
  answersRevision: attempt.answersRevision || 0, mutationId,
});
const bankPayload = (attempt: GrammarAttempt, blockId: string, mapping: Record<string, string>, mutationId: string) => ({
  blockId, bankAnswers: mapping, answersRevision: attempt.answersRevision || 0, mutationId,
});

test('mixed normalization preserves ordered groups, dynamic options and independent repeated blank numbers', () => {
  const set = normalizedSet();
  assert.equal(set.blocks.length, 4); assert.equal(set.questions.length, 5);
  assert.equal(set.questions[3].options.length, 28);
  assert.deepEqual(set.questions.map(question => question.position), [1, 2, 3, 4, 5]);
  assert.equal(set.showExplanationImmediately, false); assert.equal(set.shuffleQuestions, false);
  assert.equal(set.questions[1].blankNumber, 1); assert.equal(set.questions[4].blankNumber, 1);
  assert.equal(normalizeMixedExercise({ displayMode: 'standard' }, () => ''), null);
});

test('mixed normalization rejects cross-group references, duplicate global tokens and malformed new data', () => {
  for (const modify of [
    (source: any) => { source.contentVersion = 1; },
    (source: any) => { source.blocks[3].wordBank[0].id = 'a-one'; },
    (source: any) => { source.blocks[3].questionIds = ['a-question-1']; },
    (source: any) => { source.questions[0].questionType = 'rewrite'; },
    (source: any) => { source.questions[0].options[0].text = 'x'.repeat(1001); },
    (source: any) => { source.questions[0].score = NaN; },
    (source: any) => { source.blocks[1].passage += ' [[1]]'; },
    (source: any) => { source.questions.push({ ...source.questions[0], id: 'orphan' }); },
  ]) {
    const source = sourceSet(); modify(source);
    assert.throws(() => normalizeMixedExercise(source, prefix => prefix), (error: any) => error.status === 400);
  }
});

test('snapshot and metadata allowlists are detached and never copy nested answer keys or private identity', () => {
  const set = normalizedSet();
  Object.assign(set.blocks[1], { correctOptionId: 'secret', answerKey: { hidden: 'secret' } });
  Object.assign(set, { answerKey: 'secret', createdBy: 'owner-secret' });
  const snapshot = mixedAttemptSnapshot(set);
  set.blocks[1].wordBank![0].text = 'changed'; set.blocks[1].questionIds.push('changed');
  assert.equal(snapshot.blocksSnapshot![1].wordBank![0].text, 'the');
  assert.deepEqual(snapshot.blocksSnapshot![1].questionIds, ['a-question-1', 'a-question-2']);
  assert.equal(JSON.stringify(sanitizeMixedSetMetadata(set)).includes('secret'), false);
  const safe = sanitizeMixedAttemptMetadata({ ...attemptFor(), lastAnswerMutationHash: 'secret', attemptTokenHash: 'secret' });
  for (const field of ['userId', 'ownerKey', 'lastAnswerMutationHash', 'attemptTokenHash']) assert.equal(Object.hasOwn(safe, field), false);
});

test('bank mutations preserve both MCQ and every other bank; equivalent words grade within their own bank', () => {
  let attempt = attemptFor();
  attempt = mutate(attempt, choicePayload(attempt, 0, 'mutation-choice'));
  attempt = mutate(attempt, bankPayload(attempt, 'bank-a', { 'attempt-a-question-1': 'a-two', 'attempt-a-question-2': 'a-one' }, 'mutation-bank-a'));
  attempt = mutate(attempt, choicePayload(attempt, 3, 'mutation-reading'));
  attempt = mutate(attempt, bankPayload(attempt, 'bank-b', { 'attempt-b-question': 'b-one' }, 'mutation-bank-b'));
  assert.equal(attempt.answers.length, 5); assert.equal(attempt.answersRevision, 4);
  assert.equal(attempt.answers.every(answer => answer.isCorrect), true);
  const cleared = mutate(attempt, bankPayload(attempt, 'bank-a', {}, 'mutation-clear-a'));
  assert.equal(cleared.answers.length, 3);
  assert.ok(cleared.answers.some(answer => answer.questionId === 'b-question'));
  assert.ok(cleared.answers.some(answer => answer.questionId === 'choice-question'));
  assert.throws(() => mutate(cleared, bankPayload(cleared, 'bank-a', { 'attempt-a-question-1': 'b-one' }, 'mutation-cross-token')), (error: any) => error.status === 400);
  assert.throws(() => mutate(cleared, bankPayload(cleared, 'bank-a', { 'attempt-b-question': 'a-one' }, 'mutation-cross-question')), (error: any) => error.status === 400);
});

test('every mixed mutation shares revision and rejects a reused mutation id with a different kind or payload', () => {
  const attempt = attemptFor();
  const payload = choicePayload(attempt, 0, 'mutation-initial');
  const saved = mutate(attempt, payload);
  assert.strictEqual(mutate(saved, payload), saved);
  assert.throws(() => mutate(saved, { ...payload, selectedOptionId: 'choice-question-option-1' }), (error: any) => error.status === 409);
  assert.throws(() => mutate(saved, { ...bankPayload(saved, 'bank-b', {}, payload.mutationId) }), (error: any) => error.status === 409);
  assert.throws(() => mutate(saved, { ...choicePayload(saved, 3, 'mutation-stale'), answersRevision: 0 }), (error: any) => error.status === 409);
});

function serviceFixture(source = normalizedSet()) {
  const set: any = source;
  let stored: any = null; let writes = 0;
  const sanitizeAttempt = (attempt: any, review: boolean) => ({ ...sanitizeMixedAttemptMetadata(attempt),
    questions: attempt.questions.map(({ correctOptionId, explanationSnapshot, ...question }: any) => review ? { ...question, correctOptionId, explanationSnapshot } : question),
    answers: attempt.answers.map(({ correctOptionId, isCorrect, scoreAwarded, ...answer }: any) => review ? { ...answer, correctOptionId, isCorrect, scoreAwarded } : answer),
  });
  const service = createGrammarAttemptService({
    repository: {
      async getSet() { return set; }, async getAttempt() { return stored && structuredClone(stored); }, async countCompletedAttempts() { return 0; },
      async saveAttempt(attempt: any) { await new Promise(resolve => setTimeout(resolve, 2)); stored = structuredClone(attempt); writes++; },
      async saveCompletedAttempt(attempt: any) { stored = structuredClone(attempt); writes++; },
    } as any,
    lazySessionEnabled: true, getClientRunCredentials: () => ({ clientRunId: 'mixed-run', runSecret: 'mixed-secret' }),
    getActor: async (request: any) => ({ id: request.actorId || 'student', role: 'student', isGuest: false }),
    canOpenSet: () => true, canAccessAttempt: (attempt: any, actor: any) => attempt.userId === actor.id,
    buildPreparedAttempt: () => attemptFor(set), buildAttemptAnswer: (attempt, _set, body) => buildChoiceAnswer(attempt, body),
    buildAnswerFeedback: (_attempt, policy, answer) => policy.showExplanationImmediately ? { isCorrect: answer.isCorrect } : null,
    sanitizeAttempt, sanitizeAnswer: (answer, review) => review ? answer : { attemptQuestionId: answer.attemptQuestionId, selectedOptionId: answer.selectedOptionId },
    safeText: value => String(value || ''), deterministicRunDocumentId: () => 'mixed-attempt', getSetVersion: () => 'version',
    grammarAttemptToLeaderboardEvent: () => ({}), clearLeaderboardCache: () => undefined, now: () => new Date(now),
  } as any);
  const request = (body: any, actorId?: string) => ({ params: { id: 'mixed-set', attemptId: 'mixed-attempt' }, body, actorId });
  return { set, service, request, stored: () => stored, writes: () => writes };
}

test('real mixed service activates once, serializes MCQ/bank writes, resumes frozen snapshots and submits once', async () => {
  const f = serviceFixture();
  const prepared = (await f.service.prepareAttempt(f.request({}))).body;
  assert.equal(f.writes(), 0); assert.equal(prepared.questions[0].correctOptionId, undefined);
  const initial = { ...choicePayload(attemptFor(), 0, 'mutation-first-choice'), grammarSetVersion: 'version' };
  await f.service.activateAttempt(f.request(initial)); await f.service.activateAttempt(f.request(initial));
  assert.equal(f.writes(), 1);
  const payload = bankPayload(f.stored(), 'bank-a', { 'attempt-a-question-1': 'a-one' }, 'mutation-second-bank');
  await assert.rejects(f.service.saveAnswer(f.request(payload, 'intruder')), (error: any) => error.status === 403);
  const concurrent = await Promise.allSettled([
    f.service.saveAnswer(f.request(payload)),
    f.service.saveAnswer(f.request(choicePayload(f.stored(), 3, 'mutation-concurrent'))),
  ]);
  assert.equal(concurrent.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(f.stored().answers.length, 2);
  f.set.displayMode = 'standard'; f.set.blocks = []; f.set.showReviewAfterSubmit = false;
  const resumed = (await f.service.prepareAttempt(f.request({ resume: true }))).body;
  assert.equal(resumed.displayMode, 'mixed'); assert.equal(resumed.blocksSnapshot.length, 4); assert.equal(resumed.answers.length, 2);
  const completed = (await f.service.submitAttempt(f.request({}))).body;
  assert.equal(completed.correctCount, 2); assert.equal(completed.unansweredCount, 3); assert.equal(completed.score, 3);
  assert.ok(completed.questions[0].correctOptionId);
  const writes = f.writes(); await f.service.submitAttempt(f.request({})); assert.equal(f.writes(), writes);
  await assert.rejects(f.service.saveAnswer(f.request(payload)), /đã nộp/);
});

test('MCQ-only mixed immediate feedback locks the first answer and is restored on resume', async () => {
  const source = sourceSet(); source.blocks = [source.blocks[0]]; source.questions = [source.questions[0]];
  const f = serviceFixture({ ...source, ...normalizeMixedExercise(source, value => value)! });
  const initial = { ...choicePayload(attemptFor(f.set), 0, 'mutation-immediate'), grammarSetVersion: 'version' };
  const first = (await f.service.activateAttempt(f.request(initial))).body;
  assert.deepEqual(first.feedback, { isCorrect: true });
  const retried = (await f.service.activateAttempt(f.request(initial))).body;
  assert.deepEqual(retried.feedback, first.feedback);
  assert.equal(f.writes(), 1);
  await f.service.saveAnswer(f.request({ ...initial, answersRevision: 1, mutationId: 'mutation-locked-change', selectedOptionId: 'choice-question-option-1' }));
  assert.equal(f.stored().answers[0].selectedOptionId, 'choice-question-option-0');
  const resumed = (await f.service.prepareAttempt(f.request({ resume: true }))).body;
  assert.deepEqual(resumed.answerFeedback['attempt-choice-question'], { isCorrect: true });
});

test('History resolves each bank separately and redacts the entire mixed presentation when review is denied', () => {
  let attempt = attemptFor();
  attempt = mutate(attempt, bankPayload(attempt, 'bank-a', { 'attempt-a-question-1': 'a-one' }, 'mutation-history-a'));
  attempt = mutate(attempt, bankPayload(attempt, 'bank-b', { 'attempt-b-question': 'b-one' }, 'mutation-history-b'));
  const projection = projectGrammarAttempt({ ...attempt, status: 'completed', completedAt: now, score: 2, correctCount: 2, unansweredCount: 3 });
  const detail = projection.detail!;
  assert.equal((detail.answerDetails[1] as any).userAnswer, 'the');
  assert.equal((detail.answerDetails[4] as any).userAnswer, 'go');
  assert.ok(isGrammarMixedReview(detail.extraDetails.grammarMixedReview));
  assert.equal(detail.extraDetails.grammarPassageReview, undefined);
  const denied = normalizeStoredDetail({ id: 'student', role: 'student', isGuest: false } as any, { ...projection.attempt, status: 'completed' } as any, { ...detail, reviewPolicy: { showReviewAfterSubmit: false } });
  assert.equal(denied.extraDetails.grammarMixedReview, undefined);
  assert.equal((denied.answerDetails[1] as any).correctAnswer, undefined);
});
