import type {
  ListeningAnswers,
  ListeningGradeResult,
  ListeningSetContent,
} from '../../features/listening/types.js';
import {
  LISTENING_LIBRARY_SCHEMA_VERSION,
  resolveListeningModuleId,
} from '../../features/listening-library/registry.js';
import {
  formatListeningReviewAnswer,
  formatListeningReviewQuestion,
} from '../../features/listening/reviewPresentation.js';

const activityText = (value: unknown, max = 1000) => String(value ?? '').trim().slice(0, max);

function labelForId<T extends { id: string }>(
  items: T[],
  id: unknown,
  getLabel: (item: T, index: number) => string
) {
  const normalizedId = activityText(id, 200);
  const index = items.findIndex(item => item.id === normalizedId);
  return index >= 0
    ? activityText(getLabel(items[index], index), 500)
    : formatListeningReviewAnswer(normalizedId);
}

export function buildListeningActivityAnswerDetails(
  content: ListeningSetContent,
  answers: ListeningAnswers,
  questions: ListeningGradeResult['questions']
) {
  const resultByQuestion = new Map(
    questions.map(question => [`${question.part}:${question.questionId}`, question])
  );
  const details: Array<Record<string, unknown>> = [];
  const push = (
    part: 1 | 2 | 3 | 4 | 5,
    questionId: string,
    questionText: string,
    userAnswer: string,
    correctAnswer: string,
    options: string[] = []
  ) => {
    const result = resultByQuestion.get(`${part}:${questionId}`);
    details.push({
      questionIndex: details.length,
      questionId,
      questionText: formatListeningReviewQuestion(questionText, part, details.length),
      part,
      selectedAnswer: formatListeningReviewAnswer(activityText(userAnswer, 1000)),
      userAnswer: formatListeningReviewAnswer(activityText(userAnswer, 1000)),
      correctAnswer: formatListeningReviewAnswer(activityText(correctAnswer, 1000)),
      isCorrect: Boolean(result?.correct),
      unanswered: Boolean(result?.unanswered),
      options: options.map(option => activityText(option, 500)).filter(Boolean).slice(0, 20),
    });
  };

  const part1 = content.parts[0];
  const part1Options = part1.choices.map(choice => choice.label);
  part1.targets.forEach((target, index) => {
    push(
      1,
      target.id,
      formatListeningReviewQuestion('', 1, index),
      labelForId(part1.choices, answers.part1[target.id], choice => choice.label),
      labelForId(part1.choices, target.choiceId, choice => choice.label),
      part1Options
    );
  });

  const part2 = content.parts[1];
  part2.questions.forEach((question, index) => {
    const answer = answers.part2[question.id] || {};
    const userAnswer = question.blanks.map(blank => activityText(answer[blank.id], 500)).filter(Boolean).join(' | ');
    const correctAnswer = question.blanks
      .map(blank => blank.acceptedAnswers.map(item => activityText(item, 500)).filter(Boolean).join(' / '))
      .filter(Boolean)
      .join(' | ');
    push(2, question.id, formatListeningReviewQuestion(question.prompt, 2, index + 5), userAnswer, correctAnswer);
  });

  const part3 = content.parts[2];
  const part3Options = part3.options.map(option => option.label);
  part3.items.forEach((item, index) => {
    push(
      3,
      item.id,
      formatListeningReviewQuestion(`Part 3 • ${item.label || ''}`, 3, index + 10),
      labelForId(part3.options, answers.part3[item.id], option => option.label),
      labelForId(part3.options, item.correctOptionId, option => option.label),
      part3Options
    );
  });

  const part4 = content.parts[3];
  part4.questions.forEach((question, questionIndex) => {
    const optionLabels = question.options.map((option, index) => option.alt || String.fromCharCode(65 + index));
    push(
      4,
      question.id,
      formatListeningReviewQuestion(question.prompt, 4, questionIndex + 15),
      labelForId(question.options, answers.part4[question.id], (option, index) => option.alt || String.fromCharCode(65 + index)),
      labelForId(question.options, question.correctOptionId, (option, index) => option.alt || String.fromCharCode(65 + index)),
      optionLabels
    );
  });

  const part5 = content.parts[4];
  const part5Options = part5.colours.map(colour => colour.label);
  part5.targets.forEach((target, index) => {
    push(
      5,
      target.id,
      formatListeningReviewQuestion(`Part 5 • ${target.label || ''}`, 5, index + 20),
      labelForId(part5.colours, answers.part5[target.id], colour => colour.label),
      labelForId(part5.colours, target.correctColourId, colour => colour.label),
      part5Options
    );
  });

  return details;
}

export function normalizeListeningActivityAnswerDetails(detail: any) {
  if (!Array.isArray(detail?.answerDetails)) return [];
  return detail.answerDetails.slice(0, 200).map((item: any, index: number) => ({
    questionIndex: Number.isFinite(Number(item?.questionIndex)) ? Number(item.questionIndex) : index,
    part: Number(item?.part || 0),
    questionText: formatListeningReviewQuestion(
      item?.questionText || (item?.part ? `Part ${item.part}` : ''),
      item?.part,
      index
    ),
    selectedAnswer: formatListeningReviewAnswer(item?.selectedAnswer || item?.userAnswer),
    userAnswer: formatListeningReviewAnswer(item?.userAnswer || item?.selectedAnswer),
    correctAnswer: formatListeningReviewAnswer(item?.correctAnswer),
    isCorrect: Boolean(item?.isCorrect),
    options: Array.isArray(item?.options)
      ? item.options.map((option: unknown) => activityText(option, 500)).filter(Boolean).slice(0, 20)
      : [],
  }));
}

export async function resolveListeningActivityDetailForStaff(
  db: any,
  attempt: any,
  versionContentCache = new Map<string, Promise<ListeningSetContent | null>>()
) {
  const attemptId = activityText(attempt?.id, 200);
  if (!attemptId) return null;

  const detailSnapshot = await db.collection('listening_attempt_details').doc(attemptId).get();
  if (!detailSnapshot.exists) return null;

  const storedDetail = { id: detailSnapshot.id, ...detailSnapshot.data() };
  const versionId = activityText(attempt?.versionId || storedDetail?.extraDetails?.versionId, 200);
  if (!versionId || !storedDetail?.answers || !Array.isArray(storedDetail?.questions)) {
    return storedDetail;
  }

  let contentPromise = versionContentCache.get(versionId);
  if (!contentPromise) {
    contentPromise = (async () => {
      const versionSnapshot = await db.collection('listening_set_versions').doc(versionId).get();
      if (!versionSnapshot.exists) return null;
      return versionSnapshot.data()?.content as ListeningSetContent | null;
    })();
    versionContentCache.set(versionId, contentPromise);
  }

  const content = await contentPromise;
  if (!content) return storedDetail;

  try {
    return {
      ...storedDetail,
      answerDetails: buildListeningActivityAnswerDetails(
        content,
        storedDetail.answers as ListeningAnswers,
        storedDetail.questions as ListeningGradeResult['questions']
      ),
    };
  } catch {
    // Legacy or partially migrated versions may not match the current schema.
    // Keep any immutable detail already stored instead of hiding the whole activity.
    return storedDetail;
  }
}

export function listeningAttemptToActivity(attempt: any, detail?: any) {
  const totalQuestions = Math.max(
    1,
    Number(attempt.totalCount || 0)
      || Number(attempt.correctCount || 0) + Number(attempt.incorrectCount || 0) + Number(attempt.unansweredCount || 0)
  );
  const answerDetails = normalizeListeningActivityAnswerDetails(detail);
  return {
    id: attempt.id,
    sourceType: 'listening',
    sourceId: attempt.id,
    moduleId: resolveListeningModuleId(attempt.moduleId),
    moduleSchemaVersion: Number(attempt.schemaVersion || LISTENING_LIBRARY_SCHEMA_VERSION),
    ownerKey: attempt.ownerKey,
    ownerType: attempt.guestId ? 'guest' : 'user',
    userId: attempt.userId || '',
    studentId: attempt.userId || attempt.guestId || '',
    guestId: attempt.guestId || '',
    studentName: attempt.studentName || 'Học sinh',
    assignmentId: attempt.assignmentId || '',
    classId: attempt.classId || '',
    className: attempt.className || '',
    vocabSetId: `listening:${attempt.setId}`,
    vocabSetTitle: attempt.setTitle || 'Bộ đề nghe 5 Part',
    gameId: 'listening-five-part',
    gameName: 'Nghe 5 Part',
    gameType: 'listening',
    startedAt: attempt.startedAt,
    endedAt: attempt.completedAt,
    completedAt: attempt.completedAt,
    createdAt: attempt.createdAt || attempt.completedAt,
    durationMs: Math.max(0, Number(attempt.durationSeconds || 0)) * 1000,
    durationSeconds: Math.max(0, Number(attempt.durationSeconds || 0)),
    score: Math.max(0, Math.min(100, Number(attempt.score || 0))),
    rawScore: Math.max(0, Math.min(100, Number(attempt.score || 0))),
    maxScore: 100,
    totalQuestions,
    correctAnswers: Math.max(0, Number(attempt.correctCount || 0)),
    incorrectAnswers: Math.max(0, Number(attempt.incorrectCount || 0)) + Math.max(0, Number(attempt.unansweredCount || 0)),
    accuracy: Math.round(Math.max(0, Number(attempt.correctCount || 0)) / totalQuestions * 100),
    ...(answerDetails.length ? { answerDetails } : {}),
    status: 'completed',
  };
}
