import type {
  ListeningAnswers,
  ListeningGradeResult,
  ListeningPart2Question,
  ListeningQuestionResult,
  ListeningSetContent,
} from '../../features/listening/types.js';
import { pointInListeningRegion } from '../../features/listening/geometry.js';

export const LISTENING_GRADING_VERSION = 'listening-five-part-v2';

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
  const part3 = content.parts[2];
  if (part3.displayMode === 'connect-image') {
    for (const connection of part3.correctConnections) {
      const actual = answers.part3?.[connection.answerId] || '';
      push(3, connection.answerId, actual === connection.pictureId, !actual);
    }
  } else {
    for (const item of part3.items) {
      const actual = answers.part3?.[item.id] || '';
      push(3, item.id, actual === item.correctOptionId, !actual);
    }
  }
  for (const question of content.parts[3].questions) {
    const actual = answers.part4?.[question.id] || '';
    push(4, question.id, actual === question.correctOptionId, !actual);
  }
  const part5 = content.parts[4];
  if (part5.displayMode === 'scene-colour-draw') {
    const submittedPart5Answers = Object.values(answers.part5 || {});
    for (const question of part5.questions) {
      const submitted = question.actions.map(action => {
        const direct = answers.part5?.[action.id];
        if (direct && typeof direct === 'object' && direct.type === action.type) return direct;
        if (action.type === 'colour_object') {
          return submittedPart5Answers.find(answer => (
            answer && typeof answer === 'object'
            && answer.type === 'colour_object'
            && answer.objectId === action.correctObjectId
          ));
        }
        return submittedPart5Answers.find(answer => (
          answer && typeof answer === 'object'
          && answer.type === 'place_object'
          && answer.paletteItemId === action.correctPaletteItemId
        ));
      });
      const unanswered = submitted.every(answer => !answer);
      const correct = question.actions.length > 0 && question.actions.every((action, index) => {
        const answer = submitted[index];
        if (action.type === 'colour_object') {
          return Boolean(
            answer && typeof answer === 'object' && answer.type === 'colour_object'
            && answer.objectId === action.correctObjectId
            && answer.colourId === action.correctColourId
          );
        }
        return Boolean(
          answer && typeof answer === 'object' && answer.type === 'place_object'
          && answer.paletteItemId === action.correctPaletteItemId
          && pointInListeningRegion(answer.anchor, action.targetRegion)
        );
      });
      push(5, question.id, correct, unanswered);
    }
  } else {
    for (const target of part5.targets) {
      const actual = answers.part5?.[target.id] || '';
      push(5, target.id, actual === target.correctColourId, !actual);
    }
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
