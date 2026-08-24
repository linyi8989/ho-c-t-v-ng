import type {
  ExamAnswers,
  ExamPaperContent,
  ExamQuestionResult,
} from '../../features/exam-platform/types.js';
import { displayCorrectAnswer, normalizeExamText } from './examValidation.js';

export const EXAM_GRADING_VERSION = 'exam-platform-objective-v1';

function answerEmpty(value: string | string[] | undefined) {
  return Array.isArray(value) ? value.length === 0 : !normalizeExamText(value);
}

function gradeObjective(question: ExamPaperContent['parts'][number]['questions'][number], answer: string | string[] | undefined) {
  if (question.correctOptionIds.length) {
    const actual = new Set((Array.isArray(answer) ? answer : [answer || '']).filter(Boolean));
    const expected = new Set(question.correctOptionIds);
    return actual.size === expected.size && [...expected].every(item => actual.has(item));
  }
  const actual = normalizeExamText(Array.isArray(answer) ? answer.join(' ') : answer);
  return question.acceptedAnswers.some(value => normalizeExamText(value) === actual);
}

function displayUserAnswer(question: ExamPaperContent['parts'][number]['questions'][number], answer: string | string[] | undefined) {
  if (!question.options.length) return answer || '';
  const byId = new Map(question.options.map(option => [option.id, option.text || option.label]));
  if (Array.isArray(answer)) return answer.map(value => byId.get(value) || '').filter(Boolean);
  return answer ? byId.get(answer) || '' : '';
}

export function gradeExamAttempt(content: ExamPaperContent, answers: ExamAnswers) {
  const questions: ExamQuestionResult[] = [];
  let objectiveAwarded = 0;
  let objectiveMaximum = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  let unansweredCount = 0;
  let pendingManualCount = 0;

  content.parts.forEach(part => part.questions.forEach(question => {
    const answer = answers[question.id];
    const unanswered = answerEmpty(answer);
    if (question.type === 'long-writing') {
      pendingManualCount += 1;
      questions.push({
        questionId: question.id,
        part: part.part,
        number: question.number,
        type: question.type,
        prompt: question.prompt,
        userAnswer: displayUserAnswer(question, answer),
        correct: null,
        unanswered,
        pointsAwarded: 0,
        maxPoints: question.points,
        pendingManualReview: true,
      });
      return;
    }
    objectiveMaximum += question.points;
    const correct = !unanswered && gradeObjective(question, answer);
    if (unanswered) unansweredCount += 1;
    else if (correct) correctCount += 1;
    else incorrectCount += 1;
    if (correct) objectiveAwarded += question.points;
    questions.push({
      questionId: question.id,
      part: part.part,
      number: question.number,
      type: question.type,
      prompt: question.prompt,
      userAnswer: displayUserAnswer(question, answer),
      correctAnswer: displayCorrectAnswer(question),
      correct,
      unanswered,
      pointsAwarded: correct ? question.points : 0,
      maxPoints: question.points,
      pendingManualReview: false,
    });
  }));

  const objectiveScore = objectiveMaximum > 0 ? Math.round(objectiveAwarded / objectiveMaximum * 100) : 0;
  return {
    gradingVersion: EXAM_GRADING_VERSION,
    status: pendingManualCount ? 'pending_review' as const : 'completed' as const,
    score: pendingManualCount ? objectiveScore : objectiveScore,
    objectiveScore,
    objectiveAwarded,
    objectiveMaximum,
    correctCount,
    incorrectCount,
    unansweredCount,
    totalCount: questions.length,
    pendingManualCount,
    questions,
  };
}

export function applyManualExamGrades(
  grade: ReturnType<typeof gradeExamAttempt>,
  manualGrades: Record<string, number>,
) {
  let manualAwarded = 0;
  let manualMaximum = 0;
  const questions = grade.questions.map(question => {
    if (!question.pendingManualReview) return question;
    const awarded = Math.max(0, Math.min(question.maxPoints, Number(manualGrades[question.questionId] || 0)));
    manualAwarded += awarded;
    manualMaximum += question.maxPoints;
    return { ...question, pointsAwarded: awarded, pendingManualReview: false };
  });
  const maximum = grade.objectiveMaximum + manualMaximum;
  const awarded = grade.objectiveAwarded + manualAwarded;
  return {
    ...grade,
    questions,
    status: 'completed' as const,
    score: maximum > 0 ? Math.round(awarded / maximum * 100) : 0,
    pendingManualCount: 0,
    manualAwarded,
    manualMaximum,
  };
}
