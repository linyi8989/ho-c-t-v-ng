import assert from 'node:assert/strict';
import test from 'node:test';
import type { GrammarAttempt, GrammarQuestion } from '../types';
import { grammarPassageTemplate, parseGrammarPassageImport } from './grammarPassageImport';
import { grammarOptionLabel, grammarPassageSegments, validateGrammarPassage } from './grammarPassages';
import { buildPassageGrammarBulkImportPrompt } from './adminBulkImportPrompts';
import { normalizePassageExercise, passageAttemptSnapshot, updateBankAnswers } from '../server/grammar/passageExercises';
import { createGrammarAttemptService } from '../server/grammar-attempts/service';
import { projectGrammarAttempt } from '../server/learning-history/learningAttemptProjector';
import { normalizeStoredDetail } from '../server/learning-history/learningDetailNormalizer';

function importSet(mode: 'reading_comprehension' | 'passage_drag_drop') {
  const imported = parseGrammarPassageImport(grammarPassageTemplate(mode), mode);
  assert.deepEqual(imported.errors, []);
  return { id: 'set', displayMode: mode, questionType: mode === 'passage_drag_drop' ? 'bank_select' : 'multiple_choice', maxAttempts: 5, showReviewAfterSubmit: true, ...imported };
}
function attemptFor(set = importSet('passage_drag_drop')): GrammarAttempt {
  return {
    id: 'attempt', grammarSetId: set.id, status: 'prepared', userId: 'student',
    ...passageAttemptSnapshot(set), score: 0, maxScore: set.questions.length, answers: [],
    reviewPolicySnapshot: { showReviewAfterSubmit: true, showExplanationImmediately: false, policyVersion: 1 },
    questions: set.questions.map(q => ({ id: `attempt-${q.id}`, questionId: q.id, questionType: q.questionType, blankNumber: q.blankNumber, questionSnapshot: q.questionText, explanationSnapshot: q.explanation, optionsSnapshot: q.options, correctOptionId: q.correctOptionId, scoreSnapshot: 1 })),
  } as unknown as GrammarAttempt;
}
const now = '2026-10-17T00:00:00.000Z';

test('both generated ChatGPT templates round-trip through the real importer', () => {
  for (const mode of ['reading_comprehension', 'passage_drag_drop'] as const) {
    const set = importSet(mode);
    assert.equal(validateGrammarPassage(set).length, 0);
    assert.ok(buildPassageGrammarBulkImportPrompt(mode).includes(grammarPassageTemplate(mode)));
    assert.ok(normalizePassageExercise(set, prefix => prefix));
  }
});

test('reading retains every question and independently sized options, including beyond Z', () => {
  const input = JSON.parse(grammarPassageTemplate('reading_comprehension'));
  input.passage = 'One paragraph.\n\nAnother paragraph.';
  input.questions = Array.from({ length: 13 }, (_, i) => ({ question: `Question ${i + 1}`, options: Array.from({ length: i === 12 ? 28 : i % 5 + 2 }, (_, j) => `Choice ${j + 1}`), answer: i === 12 ? 28 : 1, explanation: 'Lời giải.' }));
  const parsed = parseGrammarPassageImport(JSON.stringify(input), 'reading_comprehension');
  assert.deepEqual(parsed.errors, []); assert.equal(parsed.questions.length, 13); assert.equal(parsed.questions[12].options.length, 28);
  assert.equal(parsed.passage, input.passage); assert.equal(grammarOptionLabel(26), 'AA'); assert.equal(grammarOptionLabel(27), 'AB');
  const normalized = normalizePassageExercise({ ...parsed, displayMode: 'reading_comprehension' }, prefix => prefix)!;
  assert.equal(normalized.questions[12].options.length, 28);
  assert.equal(normalized.questions[12].correctOptionId, normalized.questions[12].options[27].id);
});

test('bank imports arbitrary blank counts and all distractors, ignoring AI technical IDs', () => {
  const input = JSON.parse(grammarPassageTemplate('passage_drag_drop'));
  input.passage = Array.from({ length: 11 }, (_, index) => `word [[${index + 1}]]`).join(' ');
  input.wordBank = [...Array.from({ length: 11 }, (_, index) => `word${index}`), 'extra1', 'extra2'];
  input.answers = Array.from({ length: 11 }, (_, index) => ({ id: 'AI-ID', blank: index + 1, answer: `word${index}`, explanation: 'Lời giải.' }));
  const parsed = parseGrammarPassageImport(JSON.stringify(input), 'passage_drag_drop');
  assert.deepEqual(parsed.errors, []); assert.equal(parsed.questions.length, 11); assert.equal(parsed.wordBank.length, 13);
  assert.equal(parsed.questions.some(question => question.id === 'AI-ID'), false);
});

test('invalid document imports are atomic and diagnose missing, duplicate and unknown answers', () => {
  for (const modify of [
    (input: any) => { input.passage += ' [[1]]'; },
    (input: any) => { input.answers[1].answer = 'not in bank'; },
    (input: any) => { input.answers.pop(); },
    (input: any) => { input.wordBank = ['go']; },
    (input: any) => { input.passage += ' [[x]]'; },
    (input: any) => { input.answers[0].explanation = ''; },
  ]) {
    const input = JSON.parse(grammarPassageTemplate('passage_drag_drop')); modify(input);
    const parsed = parseGrammarPassageImport(JSON.stringify(input), 'passage_drag_drop');
    assert.ok(parsed.errors.length); assert.deepEqual(parsed.questions, []);
  }
  assert.ok(parseGrammarPassageImport('{}', 'reading_comprehension').errors.length);
  assert.ok(parseGrammarPassageImport('invalid', 'reading_comprehension').errors.length);
});

test('server rejects oversized or malformed new data rather than truncating it', () => {
  const set = importSet('reading_comprehension');
  assert.throws(() => normalizePassageExercise({ ...set, passage: 'x'.repeat(100_001) }, prefix => prefix), /100000/);
  assert.throws(() => normalizePassageExercise({ ...set, questions: [{ ...set.questions[0], options: [{ id: 'x', text: 'x'.repeat(1001) }] }] }, prefix => prefix), /1000/);
  assert.throws(() => normalizePassageExercise({ ...set, questions: [{ ...set.questions[0], score: Infinity }] }, prefix => prefix), /điểm/);
  assert.equal(normalizePassageExercise({ displayMode: 'standard' }, prefix => prefix), null);
});

test('identical words remain separate single-use tokens and equivalent tokens grade correctly', () => {
  const input = JSON.parse(grammarPassageTemplate('passage_drag_drop'));
  input.passage = '[[1]] cat and [[2]] dog'; input.wordBank = ['the', 'the', 'a'];
  input.answers = [{ blank: 1, answer: 'the', explanation: 'Definite.' }, { blank: 2, answer: 'the', explanation: 'Definite.' }];
  const parsed = parseGrammarPassageImport(JSON.stringify(input), 'passage_drag_drop');
  assert.deepEqual(parsed.errors, []); assert.notEqual(parsed.questions[0].correctOptionId, parsed.questions[1].correctOptionId);
  const attempt = attemptFor({ ...importSet('passage_drag_drop'), ...parsed });
  const answers = { [attempt.questions[0].id]: parsed.questions[1].correctOptionId, [attempt.questions[1].id]: parsed.questions[0].correctOptionId };
  const saved = updateBankAnswers(attempt, { bankAnswers: answers, mutationId: 'mutation-1', answersRevision: 0 }, now);
  assert.equal(saved.answers.filter(answer => answer.isCorrect).length, 2);
  assert.throws(() => updateBankAnswers(attempt, { bankAnswers: Object.fromEntries(attempt.questions.map(q => [q.id, parsed.wordBank[0].id])), mutationId: 'mutation-2', answersRevision: 0 }, now), /một lần/);
});

test('bank moves, replacements and clears are one revision, retry-safe and stale-write protected', () => {
  const attempt = attemptFor(); const [q1, q2] = attempt.questions;
  const token = q1.correctOptionId!;
  const first = updateBankAnswers(attempt, { bankAnswers: { [q1.id]: token }, mutationId: 'mutation-1', answersRevision: 0 }, now);
  assert.equal(first.answersRevision, 1);
  const move = { bankAnswers: { [q2.id]: token }, mutationId: 'mutation-2', answersRevision: 1 };
  const moved = updateBankAnswers(first, move, now);
  assert.equal(moved.answers.length, 1); assert.equal(moved.answers[0].attemptQuestionId, q2.id); assert.equal(moved.answers[0].isCorrect, false);
  assert.strictEqual(updateBankAnswers(moved, move, now), moved);
  assert.throws(() => updateBankAnswers(moved, { ...move, mutationId: 'mutation-3' }, now), (error: any) => error.status === 409);
  const cleared = updateBankAnswers(moved, { bankAnswers: {}, mutationId: 'mutation-4', answersRevision: 2 }, now);
  assert.deepEqual(cleared.answers, []); assert.equal(cleared.status, 'in_progress');
  assert.throws(() => updateBankAnswers({ ...cleared, status: 'completed' }, { bankAnswers: {} }, now), /đã nộp/);
  assert.throws(() => updateBankAnswers(attempt, { bankAnswers: { bad: token }, mutationId: 'mutation-5', answersRevision: 0 }, now), /không hợp lệ/);
});

test('attempt passage and bank snapshots are detached from later teacher changes', () => {
  const set = importSet('passage_drag_drop'); const snapshot = passageAttemptSnapshot(set);
  const originalWord = snapshot.wordBankSnapshot![0].text; const originalPassage = snapshot.passageSnapshot;
  set.wordBank[0].text = 'changed'; set.passage = 'changed';
  assert.equal(snapshot.wordBankSnapshot![0].text, originalWord); assert.equal(snapshot.passageSnapshot, originalPassage);
  assert.equal(grammarPassageSegments('a [[1]] b [[7]] c').filter(s => s.blankNumber !== undefined).length, 2);
});

test('History projects readable bank answers, a full review and honors review denial', () => {
  const attempt = attemptFor(); const q = attempt.questions[0];
  const saved = updateBankAnswers(attempt, { bankAnswers: { [q.id]: q.correctOptionId }, mutationId: 'mutation-1', answersRevision: 0 }, now);
  const projection = projectGrammarAttempt({ ...saved, status: 'completed', completedAt: now, score: 1, correctCount: 1, unansweredCount: 1 });
  const detail = projection.detail!;
  assert.equal((detail.answerDetails[0] as any).userAnswer, 'go');
  assert.equal((detail.answerDetails[0] as any).questionType, 'bank_select');
  assert.equal((detail.extraDetails.grammarPassageReview as any).passageSnapshot, attempt.passageSnapshot);
  const denied = normalizeStoredDetail({ id: 'student', role: 'student', isGuest: false } as any, { ...projection.attempt, status: 'completed' } as any, { ...detail, reviewPolicy: { showReviewAfterSubmit: false } });
  assert.equal(denied.extraDetails.grammarPassageReview, undefined);
  assert.equal((denied.answerDetails[0] as any).correctAnswer, undefined);
});

function serviceFixture() {
  const set = importSet('passage_drag_drop');
  let stored: GrammarAttempt | null = null; let writes = 0;
  const sanitizeAttempt = (attempt: any, review: boolean, token?: string) => ({ ...attempt, attemptToken: token, questions: attempt.questions.map(({ correctOptionId, explanationSnapshot, ...question }: any) => review ? { ...question, correctOptionId, explanationSnapshot } : question), answers: attempt.answers.map(({ correctOptionId, isCorrect, scoreAwarded, ...answer }: any) => review ? { ...answer, correctOptionId, isCorrect, scoreAwarded } : answer) });
  const service = createGrammarAttemptService({
    repository: { async getSet() { return set; }, async getAttempt() { return stored && structuredClone(stored); }, async countCompletedAttempts() { return 0; }, async saveAttempt(attempt: any) { await new Promise(resolve => setTimeout(resolve, 3)); stored = structuredClone(attempt); writes++; }, async saveCompletedAttempt(attempt: any) { stored = structuredClone(attempt); writes++; } } as any,
    lazySessionEnabled: true, getClientRunCredentials: () => ({ clientRunId: 'run', runSecret: 'secret' }),
    getActor: async (request: any) => ({ id: request.actorId || 'student', role: 'student', isGuest: false }),
    canOpenSet: () => true, canAccessAttempt: (attempt: any, actor: any) => attempt.userId === actor.id,
    buildPreparedAttempt: () => attemptFor(set), sanitizeAttempt, safeText: value => String(value || ''),
    deterministicRunDocumentId: () => 'attempt', getSetVersion: () => 'version',
    grammarAttemptToLeaderboardEvent: () => ({}), clearLeaderboardCache: () => undefined, now: () => new Date(now),
  } as any);
  const request = (body: any, actorId?: string) => ({ params: { id: 'set', attemptId: 'attempt' }, body, actorId });
  return { set, service, request, getStored: () => stored!, getWrites: () => writes };
}

test('real attempt service activates/resumes/moves/submits with authorization and frozen review policy', async () => {
  const f = serviceFixture(); const prepared = (await f.service.prepareAttempt(f.request({}))).body;
  assert.equal(f.getWrites(), 0); assert.equal(prepared.questions[0].correctOptionId, undefined);
  const q = prepared.questions[0]; const token = f.set.questions[0].correctOptionId;
  const payload = { grammarSetVersion: 'version', bankAnswers: { [q.id]: token }, answersRevision: 0, mutationId: 'mutation-1' };
  const activated = (await f.service.activateAttempt(f.request(payload))).body.attempt;
  assert.equal(activated.answers.length, 1); assert.equal(activated.answers[0].isCorrect, undefined);
  await f.service.activateAttempt(f.request(payload)); assert.equal(f.getWrites(), 1);
  await assert.rejects(f.service.saveAnswer(f.request({ ...payload, mutationId: 'mutation-2', answersRevision: 1 }, 'intruder')), (error: any) => error.status === 403);
  f.set.displayMode = 'standard' as any;
  const resumed = (await f.service.prepareAttempt(f.request({ resume: true }))).body;
  assert.equal(resumed.id, activated.id); assert.equal(resumed.answersRevision, 1);
  assert.equal(resumed.displayMode, 'passage_drag_drop');
  // Changing current set policy must not change a started passage run's policy.
  f.set.showReviewAfterSubmit = false;
  const submitted = (await f.service.submitAttempt(f.request({}))).body;
  assert.equal(submitted.correctCount, 1); assert.equal(submitted.unansweredCount, 1); assert.ok(submitted.questions[0].correctOptionId);
  await f.service.submitAttempt(f.request({})); assert.equal(f.getWrites(), 2);
  await assert.rejects(f.service.saveAnswer(f.request({ ...payload, answersRevision: 1 })), /đã nộp/);
});

test('simultaneous bank writes cannot lose a newer revision or race submission', async () => {
  const f = serviceFixture(); const prepared = (await f.service.prepareAttempt(f.request({}))).body;
  const q = prepared.questions[0];
  await f.service.activateAttempt(f.request({ grammarSetVersion: 'version', bankAnswers: { [q.id]: f.set.questions[0].correctOptionId }, answersRevision: 0, mutationId: 'mutation-1' }));
  const results = await Promise.allSettled([
    f.service.saveAnswer(f.request({ bankAnswers: {}, answersRevision: 1, mutationId: 'mutation-2' })),
    f.service.saveAnswer(f.request({ bankAnswers: {}, answersRevision: 1, mutationId: 'mutation-3' })),
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(f.getStored().answersRevision, 2); assert.equal(f.getStored().answers.length, 0);
  const completed = (await f.service.submitAttempt(f.request({}))).body;
  assert.equal(completed.unansweredCount, 2);
});
