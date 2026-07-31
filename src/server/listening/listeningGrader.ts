import type {
  ListeningAnswers,
  ListeningGradeResult,
  ListeningPart2Question,
  ListeningQuestionResult,
  ListeningSetContent,
} from '../../features/listening/types.js';

export const LISTENING_GRADING_VERSION = 'listening-five-part-v1';

export function normalizeListeningTextAnswer(value: unknown) {
  return String(value ?? '')
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('en')
    .replace(/[\u2018\u2019\u02bc\u0060]/g, "'")
    .replace(/\s+/g, ' ');
}

function gradeTextQuestion(
  question: ListeningPart2Question,
  answer: Record<string, string> | undefined
) {
  let unanswered = true;
  const correct = question.blanks.every(blank => {
    const actual = normalizeListeningTextAnswer(answer?.[blank.id]);
    if (actual) unanswered = false;
    return Boolean(actual) && blank.acceptedAnswers.some(
      accepted => normalizeListeningTextAnswer(accepted) === actual
    );
  });
  return { correct, unanswered };
}

export function gradeListeningAttempt(
  content: ListeningSetContent,
  answers: ListeningAnswers
): ListeningGradeResult {
  const questions: ListeningQuestionResult[] = [];
  const push = (
    part: 1 | 2 | 3 | 4 | 5,
    questionId: string,
    correct: boolean,
    unanswered: boolean
  ) => questions.push({ part, questionId, correct, unanswered });

  for (const target of content.parts[0].targets) {
    const actual = answers.part1?.[target.id] || '';
    push(1, target.id, actual === target.choiceId, !actual);
  }
  for (const question of content.parts[1].questions) {
    const result = gradeTextQuestion(question, answers.part2?.[question.id]);
    push(2, question.id, result.correct, result.unanswered);
  }
  for (const item of content.parts[2].items) {
    const actual = answers.part3?.[item.id] || '';
    push(3, item.id, actual === item.correctOptionId, !actual);
  }
  for (const question of content.parts[3].questions) {
    const actual = answers.part4?.[question.id] || '';
    push(4, question.id, actual === question.correctOptionId, !actual);
  }
  for (const target of content.parts[4].targets) {
    const actual = answers.part5?.[target.id] || '';
    push(5, target.id, actual === target.correctColourId, !actual);
  }

  if (questions.length !== 25) {
    throw new Error(`Published listening version must contain exactly 25 questions; received ${questions.length}.`);
  }

  const correctCount = questions.filter(question => question.correct).length;
  const unansweredCount = questions.filter(question => question.unanswered).length;
  const incorrectCount = questions.length - correctCount - unansweredCount;
  return {
    score: Math.round((correctCount / 25) * 100),
    correctCount,
    incorrectCount,
    unansweredCount,
    totalCount: 25,
    questions,
  };
}
