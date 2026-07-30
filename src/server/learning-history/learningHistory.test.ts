import assert from 'node:assert/strict';
import test from 'node:test';
import {
  deterministicLearningAttemptId,
  projectGrammarAttempt,
  projectVocabularyAttempt,
  studyDateInBangkok,
} from './learningAttemptProjector';
import { normalizeStoredDetail } from './learningDetailNormalizer';
import {
  LearningHistoryValidationError,
  parseLearningHistoryFilters,
} from './learningHistoryValidation';
import type {
  LearningHistoryActor,
  LearningHistoryItem,
} from './learningHistoryTypes';

test('learning attempt ids and Bangkok study dates are deterministic', () => {
  assert.equal(
    deterministicLearningAttemptId('vocabulary', 'session-1'),
    deterministicLearningAttemptId('vocabulary', 'session-1'),
  );
  assert.notEqual(
    deterministicLearningAttemptId('vocabulary', 'session-1'),
    deterministicLearningAttemptId('grammar', 'session-1'),
  );
  assert.equal(studyDateInBangkok('2026-01-01T18:30:00.000Z'), '2026-01-02');
});

test('vocabulary projector normalizes matching mistakes without inflating logical questions', () => {
  const projection = projectVocabularyAttempt({
    id: 'session-matching',
    ownerKey: 'guest:guest-a',
    ownerType: 'guest',
    guestId: 'guest-a',
    studentName: 'Học sinh A',
    vocabSetId: 'set-1',
    vocabSetTitle: 'Bộ từ 1',
    gameId: 'matching-word-meaning',
    gameName: 'Ghép đôi',
    status: 'completed',
    score: 75,
    correctAnswers: 6,
    incorrectAnswers: 5,
    totalQuestions: 11,
    startedAt: '2026-01-01T00:00:00.000Z',
    completedAt: '2026-01-01T00:05:00.000Z',
    privateSnapshot: {
      items: Array.from({ length: 8 }, (_, index) => ({
        id: `word-${index + 1}`,
        term: `word ${index + 1}`,
      })),
    },
    answerDetails: [],
  });

  assert.equal(projection.attempt.totalQuestions, 8);
  assert.equal(projection.attempt.correctCount, 6);
  assert.equal(projection.attempt.incorrectCount, 2);
  assert.equal(projection.attempt.mistakeCount, 3);
  assert.equal(projection.attempt.score, 75);
  assert.equal(projection.attempt.ownerKey, 'guest:guest-a');
  assert.equal(projection.attempt.detailStatus, 'available');
  assert.ok(projection.detail);
});

test('grammar projector stores canonical percent and review-policy snapshot', () => {
  const projection = projectGrammarAttempt({
    id: 'grammar-attempt-1',
    userId: 'user-a',
    studentName: 'Student A',
    grammarSetId: 'grammar-1',
    grammarSetTitle: 'Present simple',
    status: 'completed',
    score: 3,
    maxScore: 4,
    correctCount: 3,
    wrongCount: 1,
    unansweredCount: 0,
    startedAt: '2026-01-01T00:00:00.000Z',
    completedAt: '2026-01-01T00:03:00.000Z',
    reviewPolicySnapshot: {
      showReviewAfterSubmit: false,
      showExplanationImmediately: false,
      policyVersion: 1,
      capturedAt: '2026-01-01T00:00:00.000Z',
    },
    questions: [{
      id: 'aq-1',
      questionId: 'q-1',
      questionType: 'rewrite',
      questionSnapshot: 'Rewrite',
      correctAnswerSnapshot: 'She goes.',
      acceptedAnswersSnapshot: ['She goes.'],
      explanationSnapshot: 'Rule',
      scoreSnapshot: 4,
    }],
    answers: [{
      attemptQuestionId: 'aq-1',
      textAnswer: 'She goes.',
      correctAnswer: 'She goes.',
      isCorrect: true,
      scoreAwarded: 3,
    }],
  });

  assert.equal(projection.attempt.score, 75);
  assert.equal(projection.attempt.rawScore, 3);
  assert.equal(projection.attempt.maxScore, 4);
  assert.equal(projection.attempt.ownerKey, 'user:user-a');
  assert.equal(projection.detail?.reviewPolicy.showReviewAfterSubmit, false);
});

test('detail normalizer strips answer keys and explanations when snapshot denies review', () => {
  const actor: LearningHistoryActor = {
    id: 'student-1',
    ownerKey: 'user:student-1',
    kind: 'user',
    role: 'student',
  };
  const attempt: LearningHistoryItem = {
    attemptId: 'attempt-1',
    sourceType: 'grammar',
    studentType: 'authenticated',
    studentName: 'Student',
    classId: null,
    className: '',
    assignmentId: null,
    assignmentTitle: '',
    assignmentDueAt: null,
    lessonId: 'grammar-1',
    lessonTitle: 'Grammar',
    lessonType: 'grammar_set',
    gameId: 'grammar-practice',
    gameTitle: 'Grammar',
    score: 50,
    rawScore: 1,
    maxScore: 2,
    correctCount: 1,
    incorrectCount: 1,
    unansweredCount: 0,
    mistakeCount: 0,
    totalQuestions: 2,
    startedAt: null,
    completedAt: '2026-01-01T00:00:00.000Z',
    activityAt: '2026-01-01T00:00:00.000Z',
    durationSeconds: 10,
    status: 'completed',
    attemptNumber: 1,
    detailStatus: 'available',
    normalizationStatus: 'canonical',
  };
  const detail = normalizeStoredDetail(actor, attempt, {
    answer_details_json: JSON.stringify([{
      userAnswer: 'A',
      correctAnswer: 'B',
      acceptedAnswers: ['B'],
      explanation: 'secret',
      isCorrect: false,
    }]),
    question_snapshots_json: '[]',
    option_snapshots_json: '[]',
    extra_details_json: '{}',
    review_policy_json: JSON.stringify({ showReviewAfterSubmit: false }),
  });
  const answer = detail.answerDetails[0] as Record<string, unknown>;
  assert.equal(answer.userAnswer, 'A');
  assert.equal(answer.isCorrect, false);
  assert.equal('correctAnswer' in answer, false);
  assert.equal('acceptedAnswers' in answer, false);
  assert.equal('explanation' in answer, false);
});

test('detail normalizer handles malformed JSON and strips nested snake-case answer keys', () => {
  const actor: LearningHistoryActor = {
    id: 'student-1',
    ownerKey: 'user:student-1',
    kind: 'user',
    role: 'student',
  };
  const attempt: LearningHistoryItem = {
    attemptId: 'attempt-malformed',
    sourceType: 'grammar',
    studentType: 'authenticated',
    studentName: 'Student',
    classId: null,
    className: '',
    assignmentId: null,
    assignmentTitle: '',
    assignmentDueAt: null,
    lessonId: 'grammar-1',
    lessonTitle: 'Grammar',
    lessonType: 'grammar_set',
    gameId: 'grammar-practice',
    gameTitle: 'Grammar',
    score: 0,
    rawScore: 0,
    maxScore: 1,
    correctCount: 0,
    incorrectCount: 1,
    unansweredCount: 0,
    mistakeCount: 0,
    totalQuestions: 1,
    startedAt: null,
    completedAt: '2026-01-01T00:00:00.000Z',
    activityAt: '2026-01-01T00:00:00.000Z',
    durationSeconds: 10,
    status: 'completed',
    attemptNumber: 1,
    detailStatus: 'available',
    normalizationStatus: 'canonical',
  };
  const detail = normalizeStoredDetail(actor, attempt, {
    answer_details_json: JSON.stringify([{
      user_answer: 'A',
      nested: {
        correct_answer: 'B',
        accepted_answers: ['B'],
        answer_key: 'B',
        model_answer: 'B',
        explanation_snapshot: 'secret',
      },
    }]),
    question_snapshots_json: '{not-json',
    option_snapshots_json: '{}',
    extra_details_json: 'null',
    review_policy_json: JSON.stringify({ showReviewAfterSubmit: false }),
  });
  const answer = detail.answerDetails[0] as Record<string, any>;
  assert.equal(answer.user_answer, 'A');
  assert.deepEqual(answer.nested, {});
  assert.deepEqual(detail.questionSnapshots, []);
  assert.deepEqual(detail.optionSnapshots, []);
  assert.deepEqual(detail.extraDetails, {});
  assert.equal(detail.warnings.includes('questionSnapshots:malformed_json'), true);
  assert.equal(detail.warnings.includes('optionSnapshots:not_array'), true);
  assert.equal(detail.warnings.includes('extraDetails:not_object'), true);
});

test('history filter validation enforces pagination, score, date and allowlists', () => {
  const parsed = parseLearningHistoryFilters({
    page: '2',
    pageSize: '50',
    sourceType: 'grammar',
    historyType: 'practice',
    scoreFrom: '25',
    scoreTo: '90',
    from: '2026-01-01',
    to: '2026-01-02',
    search: `unit 1%' OR 1=1 --`,
  });
  assert.equal(parsed.page, 2);
  assert.equal(parsed.pageSize, 50);
  assert.equal(parsed.sourceType, 'grammar');
  assert.equal(parsed.from, '2025-12-31T17:00:00.000Z');
  assert.equal(parsed.toExclusive, '2026-01-02T17:00:00.000Z');
  assert.match(parsed.search || '', /OR 1=1/);

  assert.throws(
    () => parseLearningHistoryFilters({ pageSize: '100' }),
    LearningHistoryValidationError,
  );
  assert.throws(
    () => parseLearningHistoryFilters({ scoreFrom: '90', scoreTo: '20' }),
    LearningHistoryValidationError,
  );
  assert.throws(
    () => parseLearningHistoryFilters({ from: '2026-02-31' }),
    LearningHistoryValidationError,
  );
});
