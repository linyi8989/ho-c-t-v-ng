import crypto from 'node:crypto';
import type {
  LearningAttemptDetailWrite,
  LearningAttemptProjection,
  LearningAttemptStatus,
  LearningAttemptWrite,
} from './learningHistoryTypes';

const HISTORY_SCHEMA_VERSION = 1;
const DEFAULT_DETAIL_RETENTION_DAYS = 30;
const BANGKOK_TIME_ZONE = 'Asia/Bangkok';

function text(value: unknown, max = 500) {
  return String(value ?? '').normalize('NFKC').trim().slice(0, max);
}

function nonNegative(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function integer(value: unknown) {
  return Math.round(nonNegative(value));
}

function clampScore(value: unknown) {
  return Math.max(0, Math.min(100, Number.isFinite(Number(value)) ? Number(value) : 0));
}

function isoOrNull(value: unknown) {
  const raw = text(value, 80);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function activityStatus(value: unknown, completedAt: string | null): LearningAttemptStatus {
  if (completedAt || value === 'completed') return 'completed';
  if (value === 'interrupted' || value === 'abandoned') return 'interrupted';
  return 'in_progress';
}

function addDaysIso(base: string, days: number) {
  return new Date(new Date(base).getTime() + days * 86_400_000).toISOString();
}

export function studyDateInBangkok(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: BANGKOK_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => parts.find(part => part.type === type)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function deterministicLearningAttemptId(sourceType: string, sourceRecordId: string) {
  const digest = crypto
    .createHash('sha256')
    .update(`learning-attempt-v1:${sourceType}:${sourceRecordId}`)
    .digest('hex');
  return `attempt-${digest.slice(0, 40)}`;
}

function resolveOwnership(source: any) {
  const declaredOwnerKey = text(source?.ownerKey || source?.owner_key, 260);
  const userId = text(source?.userId || source?.user_id, 180);
  const guestId = text(source?.guestId || source?.guest_id, 180);

  if (declaredOwnerKey.startsWith('user:') && userId) {
    return {
      studentType: 'authenticated' as const,
      userId,
      guestId: null,
      ownerKey: `user:${userId}`,
      ownershipStatus: 'linked' as const,
    };
  }
  if (declaredOwnerKey.startsWith('guest:') && guestId) {
    return {
      studentType: 'guest' as const,
      userId: null,
      guestId,
      ownerKey: `guest:${guestId}`,
      ownershipStatus: 'linked' as const,
    };
  }
  if (userId && (!guestId || source?.ownerType !== 'guest')) {
    return {
      studentType: 'authenticated' as const,
      userId,
      guestId: null,
      ownerKey: `user:${userId}`,
      ownershipStatus: 'linked' as const,
    };
  }
  if (guestId) {
    return {
      studentType: 'guest' as const,
      userId: null,
      guestId,
      ownerKey: `guest:${guestId}`,
      ownershipStatus: 'linked' as const,
    };
  }
  return {
    studentType: 'legacy' as const,
    userId: null,
    guestId: null,
    ownerKey: null,
    ownershipStatus: 'legacy_unlinked' as const,
  };
}

function vocabularyCounts(session: any) {
  const gameId = text(session?.gameId, 120);
  const sourceCorrect = integer(session?.correctAnswers ?? session?.correct);
  const sourceIncorrect = integer(session?.incorrectAnswers ?? session?.incorrect);
  let total = integer(session?.totalQuestions);
  let correct = sourceCorrect;
  let incorrect = sourceIncorrect;
  let unanswered = integer(session?.unansweredCount);
  let mistakeCount = integer(session?.mistakeCount);
  let normalizationStatus: 'canonical' | 'legacy_partial' = 'canonical';

  if (gameId === 'matching-word-meaning' || gameId === 'memory-match') {
    const itemLimit = gameId === 'matching-word-meaning' ? 8 : 6;
    const snapshotItems = Array.isArray(session?.privateSnapshot?.items)
      ? session.privateSnapshot.items.length
      : 0;
    const logicalTotal = Math.min(itemLimit, snapshotItems || total || sourceCorrect + sourceIncorrect);
    total = logicalTotal;
    correct = Math.min(sourceCorrect, total);
    incorrect = Math.max(0, total - correct);
    unanswered = 0;
    mistakeCount = Math.max(0, sourceIncorrect - incorrect);
    if (!snapshotItems) normalizationStatus = 'legacy_partial';
  } else {
    if (!total) total = sourceCorrect + sourceIncorrect + unanswered;
    correct = Math.min(sourceCorrect, total || sourceCorrect);
    incorrect = Math.min(sourceIncorrect, Math.max(0, total - correct));
    unanswered = Math.max(0, total - correct - incorrect);
    if (!session?.totalQuestions) normalizationStatus = 'legacy_partial';
  }

  const rawScore = Number.isFinite(Number(session?.rawScore ?? session?.gameScore))
    ? Number(session.rawScore ?? session.gameScore)
    : null;
  const maxScore = Number.isFinite(Number(session?.maxScore))
    ? Number(session.maxScore)
    : rawScore === null ? null : 100;
  const scoreCandidate = Number.isFinite(Number(session?.score))
    ? Number(session.score)
    : total > 0 ? (correct / total) * 100 : 0;

  return {
    score: clampScore(scoreCandidate),
    rawScore,
    maxScore,
    correct,
    incorrect,
    unanswered,
    mistakeCount,
    total,
    normalizationStatus,
  };
}

function createDetail(
  sourceType: 'vocabulary' | 'grammar',
  attemptId: string,
  clientRunId: string | null,
  completedAt: string,
  values: Partial<LearningAttemptDetailWrite>,
  detailRetentionDays: number,
): LearningAttemptDetailWrite {
  return {
    attemptId,
    clientRunId,
    sourceType,
    answerDetails: Array.isArray(values.answerDetails) ? values.answerDetails : [],
    questionSnapshots: Array.isArray(values.questionSnapshots) ? values.questionSnapshots : [],
    optionSnapshots: Array.isArray(values.optionSnapshots) ? values.optionSnapshots : [],
    extraDetails: values.extraDetails && typeof values.extraDetails === 'object'
      ? values.extraDetails
      : {},
    reviewPolicy: values.reviewPolicy && typeof values.reviewPolicy === 'object'
      ? values.reviewPolicy
      : {},
    createdAt: values.createdAt || completedAt,
    updatedAt: values.updatedAt || completedAt,
    expiresAt: addDaysIso(completedAt, detailRetentionDays),
    schemaVersion: HISTORY_SCHEMA_VERSION,
  };
}

export function projectVocabularyAttempt(
  session: any,
  options: { detailRetentionDays?: number; includeDetail?: boolean } = {},
): LearningAttemptProjection {
  const sourceRecordId = text(session?.id || session?.sourceId, 200);
  if (!sourceRecordId) throw new Error('Vocabulary projection requires a source record id.');
  const attemptId = deterministicLearningAttemptId('vocabulary', sourceRecordId);
  const ownership = resolveOwnership(session);
  const completedAt = isoOrNull(session?.completedAt || session?.endedAt);
  const startedAt = isoOrNull(session?.startedAt || session?.createdAt);
  const activityAt = completedAt
    || isoOrNull(session?.lastSavedAt || session?.updatedAt)
    || startedAt
    || new Date().toISOString();
  const status = activityStatus(session?.status, completedAt);
  const counts = vocabularyCounts(session);
  const now = isoOrNull(session?.updatedAt) || activityAt;
  const assignmentVerified = Boolean(session?.assignmentVerified || session?.assignmentAccessVerified);
  const assignmentId = assignmentVerified ? text(session?.assignmentId, 180) || null : null;
  const includeDetail = options.includeDetail !== false && status === 'completed';
  const answerDetails = Array.isArray(session?.answerDetails) ? session.answerDetails : [];
  const snapshotItems = Array.isArray(session?.privateSnapshot?.items)
    ? session.privateSnapshot.items
    : [];
  const detailStatus = includeDetail ? 'available' : status === 'completed' ? 'legacy' : 'missing';

  const attempt: LearningAttemptWrite = {
    attemptId,
    sourceRecordId,
    clientRunId: text(session?.clientRunId, 180) || null,
    sourceType: 'vocabulary',
    ...ownership,
    studentNameSnapshot: text(session?.studentName, 240),
    classId: text(session?.classId, 180) || null,
    classNameSnapshot: text(session?.className, 240),
    assignmentId,
    assignmentTitleSnapshot: assignmentId
      ? text(session?.assignmentTitle || session?.assignmentName, 300)
      : '',
    assignmentDueAtSnapshot: assignmentId
      ? isoOrNull(session?.assignmentDueAt || session?.dueDate)
      : null,
    lessonId: text(session?.vocabSetId || session?.vocabularySetId, 200),
    lessonTitleSnapshot: text(session?.vocabSetTitle || session?.lessonTitle, 300),
    lessonType: 'vocab_set',
    gameId: text(session?.gameId, 160) || 'vocabulary-practice',
    gameTitleSnapshot: text(session?.gameName || session?.gameTitle || session?.gameId, 240),
    score: counts.score,
    rawScore: counts.rawScore,
    maxScore: counts.maxScore,
    correctCount: counts.correct,
    incorrectCount: counts.incorrect,
    unansweredCount: counts.unanswered,
    mistakeCount: counts.mistakeCount,
    totalQuestions: counts.total,
    startedAt,
    completedAt,
    activityAt,
    studyDate: studyDateInBangkok(activityAt),
    durationSeconds: integer(
      session?.durationSeconds
      ?? (Number.isFinite(Number(session?.durationMs)) ? Number(session.durationMs) / 1000 : 0),
    ),
    attemptStatus: status,
    attemptNumber: integer(session?.attemptNumber),
    schemaVersion: HISTORY_SCHEMA_VERSION,
    detailStatus,
    normalizationStatus: counts.normalizationStatus,
    createdAt: isoOrNull(session?.createdAt) || startedAt || activityAt,
    updatedAt: now,
  };

  const detail = includeDetail && completedAt
    ? createDetail('vocabulary', attemptId, attempt.clientRunId, completedAt, {
        answerDetails,
        questionSnapshots: snapshotItems.map((item: any, index: number) => ({
          questionIndex: index,
          wordId: text(item?.id, 180),
          term: text(item?.term, 500),
          meaning: text(item?.meaning, 1_000),
          ipa: text(item?.ipa, 180),
          example: text(item?.example, 1_500),
        })),
        extraDetails: {
          gameId: attempt.gameId,
          gradingMode: text(session?.gradingMode, 80),
        },
        reviewPolicy: {
          showReviewAfterSubmit: true,
          showExplanationImmediately: true,
          policyVersion: 1,
          capturedAt: completedAt,
        },
        createdAt: completedAt,
        updatedAt: completedAt,
      }, Math.max(1, options.detailRetentionDays || DEFAULT_DETAIL_RETENTION_DAYS))
    : null;

  return { attempt, detail };
}

function grammarReviewPolicy(attempt: any, set: any, capturedAt: string) {
  const snapshot = attempt?.reviewPolicySnapshot;
  if (snapshot && typeof snapshot === 'object') {
    return {
      showReviewAfterSubmit: snapshot.showReviewAfterSubmit === true,
      showExplanationImmediately: snapshot.showExplanationImmediately === true,
      policyVersion: Number(snapshot.policyVersion || 1),
      capturedAt: isoOrNull(snapshot.capturedAt) || capturedAt,
      legacyFallback: false,
    };
  }
  return {
    showReviewAfterSubmit: set?.showReviewAfterSubmit === true,
    showExplanationImmediately: set?.showExplanationImmediately === true,
    policyVersion: 1,
    capturedAt,
    legacyFallback: !set,
  };
}

export function projectGrammarAttempt(
  grammarAttempt: any,
  grammarSet: any = {},
  options: { detailRetentionDays?: number; includeDetail?: boolean } = {},
): LearningAttemptProjection {
  const sourceRecordId = text(grammarAttempt?.id, 200);
  if (!sourceRecordId) throw new Error('Grammar projection requires a source record id.');
  const attemptId = deterministicLearningAttemptId('grammar', sourceRecordId);
  const ownership = resolveOwnership(grammarAttempt);
  const completedAt = isoOrNull(grammarAttempt?.completedAt);
  const startedAt = isoOrNull(grammarAttempt?.startedAt || grammarAttempt?.createdAt);
  const activityAt = completedAt
    || isoOrNull(grammarAttempt?.lastSavedAt || grammarAttempt?.updatedAt || grammarAttempt?.activatedAt)
    || startedAt
    || new Date().toISOString();
  const status = activityStatus(grammarAttempt?.status, completedAt);
  const correct = integer(grammarAttempt?.correctCount);
  const incorrect = integer(grammarAttempt?.wrongCount ?? grammarAttempt?.incorrectCount);
  const unanswered = integer(grammarAttempt?.unansweredCount);
  const questionCount = Array.isArray(grammarAttempt?.questions)
    ? grammarAttempt.questions.length
    : correct + incorrect + unanswered;
  const total = Math.max(questionCount, correct + incorrect + unanswered);
  const rawScore = nonNegative(grammarAttempt?.score);
  const maxScore = nonNegative(grammarAttempt?.maxScore);
  const canonicalScore = maxScore > 0 ? clampScore((rawScore / maxScore) * 100) : 0;
  const includeDetail = options.includeDetail !== false && status === 'completed';
  const reviewPolicy = grammarReviewPolicy(grammarAttempt, grammarSet, completedAt || activityAt);
  const questions = Array.isArray(grammarAttempt?.questions) ? grammarAttempt.questions : [];
  const answers = Array.isArray(grammarAttempt?.answers) ? grammarAttempt.answers : [];
  const answerByQuestion = new Map(answers.map((answer: any) => [answer?.attemptQuestionId, answer]));

  const attempt: LearningAttemptWrite = {
    attemptId,
    sourceRecordId,
    clientRunId: text(grammarAttempt?.clientRunId, 180) || null,
    sourceType: 'grammar',
    ...ownership,
    studentNameSnapshot: text(grammarAttempt?.studentName, 240),
    classId: text(grammarAttempt?.classId, 180) || null,
    classNameSnapshot: text(grammarAttempt?.className, 240),
    assignmentId: grammarAttempt?.assignmentVerified
      ? text(grammarAttempt?.assignmentId, 180) || null
      : null,
    assignmentTitleSnapshot: grammarAttempt?.assignmentVerified
      ? text(grammarAttempt?.assignmentTitle, 300)
      : '',
    assignmentDueAtSnapshot: grammarAttempt?.assignmentVerified
      ? isoOrNull(grammarAttempt?.assignmentDueAt)
      : null,
    lessonId: text(grammarAttempt?.grammarSetId, 200),
    lessonTitleSnapshot: text(grammarAttempt?.grammarSetTitle || grammarSet?.title, 300),
    lessonType: 'grammar_set',
    gameId: 'grammar-practice',
    gameTitleSnapshot: text(
      grammarSet?.questionType === 'rewrite' ? 'Viết lại câu' : 'Luyện ngữ pháp',
      240,
    ),
    score: canonicalScore,
    rawScore,
    maxScore,
    correctCount: correct,
    incorrectCount: incorrect,
    unansweredCount: unanswered,
    mistakeCount: 0,
    totalQuestions: total,
    startedAt,
    completedAt,
    activityAt,
    studyDate: studyDateInBangkok(activityAt),
    durationSeconds: integer(grammarAttempt?.durationSeconds),
    attemptStatus: status,
    attemptNumber: integer(grammarAttempt?.attemptNumber),
    schemaVersion: HISTORY_SCHEMA_VERSION,
    detailStatus: includeDetail ? 'available' : status === 'completed' ? 'legacy' : 'missing',
    normalizationStatus: questions.length ? 'canonical' : 'legacy_partial',
    createdAt: isoOrNull(grammarAttempt?.createdAt) || startedAt || activityAt,
    updatedAt: isoOrNull(grammarAttempt?.updatedAt) || activityAt,
  };

  const detail = includeDetail && completedAt
    ? createDetail('grammar', attemptId, attempt.clientRunId, completedAt, {
        answerDetails: questions.map((question: any, index: number) => {
          const answer: any = answerByQuestion.get(question?.id);
          const questionType = question?.questionType === 'rewrite'
            ? 'rewrite'
            : 'multiple_choice';
          const optionSnapshots = Array.isArray(question?.optionsSnapshot)
            ? question.optionsSnapshot
            : [];
          const selectedOptionId = text(answer?.selectedOptionId, 200);
          const correctOptionId = text(question?.correctOptionId || answer?.correctOptionId, 200);
          const selectedOption = optionSnapshots.find(
            (option: any) => text(option?.id, 200) === selectedOptionId,
          );
          const correctOption = optionSnapshots.find(
            (option: any) => text(option?.id, 200) === correctOptionId,
          );
          const userAnswer = questionType === 'rewrite'
            ? text(answer?.textAnswer, 4_000)
            : text(selectedOption?.text, 2_000);
          const correctAnswer = questionType === 'rewrite'
            ? text(question?.correctAnswerSnapshot || answer?.correctAnswer, 4_000)
            : text(correctOption?.text, 2_000);
          return {
            questionIndex: Number(question?.displayPosition || index + 1) - 1,
            attemptQuestionId: text(question?.id, 200),
            questionId: text(question?.questionId, 200),
            questionType,
            selectedOptionId,
            textAnswer: text(answer?.textAnswer, 4_000),
            selectedAnswer: userAnswer,
            userAnswer,
            isCorrect: Boolean(answer?.isCorrect),
            scoreAwarded: nonNegative(answer?.scoreAwarded),
            answeredAt: isoOrNull(answer?.answeredAt),
            correctOptionId,
            correctAnswer,
            acceptedAnswers: Array.isArray(question?.acceptedAnswersSnapshot)
              ? question.acceptedAnswersSnapshot.map((value: unknown) => text(value, 4_000))
              : [],
            explanation: text(question?.explanationSnapshot, 4_000),
          };
        }),
        questionSnapshots: questions.map((question: any, index: number) => ({
          questionIndex: Number(question?.displayPosition || index + 1) - 1,
          attemptQuestionId: text(question?.id, 200),
          questionId: text(question?.questionId, 200),
          questionType: question?.questionType === 'rewrite' ? 'rewrite' : 'multiple_choice',
          questionText: text(question?.questionSnapshot, 4_000),
          explanation: text(question?.explanationSnapshot, 4_000),
          correctOptionId: text(question?.correctOptionId, 200),
          correctAnswer: text(question?.correctAnswerSnapshot, 4_000),
          acceptedAnswers: Array.isArray(question?.acceptedAnswersSnapshot)
            ? question.acceptedAnswersSnapshot.map((value: unknown) => text(value, 4_000))
            : [],
        })),
        optionSnapshots: questions.map((question: any, index: number) => ({
          questionIndex: Number(question?.displayPosition || index + 1) - 1,
          attemptQuestionId: text(question?.id, 200),
          options: Array.isArray(question?.optionsSnapshot)
            ? question.optionsSnapshot.map((option: any) => ({
                id: text(option?.id, 200),
                text: text(option?.text, 2_000),
              }))
            : [],
        })),
        extraDetails: {
          grammarSetVersion: text(grammarAttempt?.grammarSetVersion, 180),
          gradingVersion: text(
            answers.find((answer: any) => answer?.gradingVersion)?.gradingVersion,
            120,
          ),
        },
        reviewPolicy,
        createdAt: completedAt,
        updatedAt: completedAt,
      }, Math.max(1, options.detailRetentionDays || DEFAULT_DETAIL_RETENTION_DAYS))
    : null;

  return { attempt, detail };
}
