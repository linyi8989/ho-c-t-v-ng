import type {
  ListeningAnswers,
  ListeningGradeResult,
  ListeningPart2Question,
  ListeningPart5Action,
  ListeningPart5Answer,
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

export function resolveListeningPart5SubmittedActions(
  actions: ListeningPart5Action[],
  answers: ListeningAnswers['part5'],
): Map<string, ListeningPart5Answer> {
  type StructuredAnswer = Exclude<ListeningPart5Answer, string>;
  type PlaceAction = Extract<ListeningPart5Action, { type: 'place_object' }>;
  type PlaceAnswer = Extract<ListeningPart5Answer, { type: 'place_object' }>;
  const submittedAnswers = Object.values(answers || {}).filter((answer): answer is StructuredAnswer => (
    Boolean(answer) && typeof answer === 'object'
  ));
  const resolved = new Map<string, ListeningPart5Answer>();
  const usedAnswers = new Set<StructuredAnswer>();
  const assign = (action: ListeningPart5Action, answer: StructuredAnswer | undefined) => {
    if (!answer || usedAnswers.has(answer)) return false;
    resolved.set(action.id, answer);
    usedAnswers.add(answer);
    return true;
  };

  actions.forEach(action => {
    const direct = answers?.[action.id];
    if (direct && typeof direct === 'object' && direct.type === action.type) assign(action, direct);
  });

  actions.filter(action => action.type === 'colour_object').forEach(action => {
    if (resolved.has(action.id) || action.type !== 'colour_object') return;
    assign(action, submittedAnswers.find(answer => (
      !usedAnswers.has(answer)
      && answer.type === 'colour_object'
      && answer.objectId === action.correctObjectId
    )));
  });

  const placeActions = actions.filter((action): action is PlaceAction => action.type === 'place_object');
  const placeAnswers = submittedAnswers.filter((answer): answer is PlaceAnswer => answer.type === 'place_object');
  placeActions.forEach(action => {
    if (resolved.has(action.id)) return;
    const inside = placeAnswers.filter(answer => (
      !usedAnswers.has(answer) && pointInListeningRegion(answer.anchor, action.targetRegion)
    ));
    assign(action, inside.find(answer => answer.paletteItemId === action.correctPaletteItemId) || inside[0]);
  });
  placeActions.forEach(action => {
    if (resolved.has(action.id)) return;
    assign(action, placeAnswers.find(answer => (
      !usedAnswers.has(answer) && answer.paletteItemId === action.correctPaletteItemId
    )));
  });

  const nearestPairs = placeActions.flatMap(action => {
    if (resolved.has(action.id)) return [];
    const targetX = action.targetRegion.x + action.targetRegion.width / 2;
    const targetY = action.targetRegion.y + action.targetRegion.height / 2;
    return placeAnswers.flatMap(answer => {
      if (usedAnswers.has(answer)) return [];
      const distance = (answer.anchor.x - targetX) ** 2 + (answer.anchor.y - targetY) ** 2;
      return [{ action, answer, distance }];
    });
  }).sort((left, right) => left.distance - right.distance);
  nearestPairs.forEach(({ action, answer }) => {
    if (!resolved.has(action.id) && !usedAnswers.has(answer)) assign(action, answer);
  });

  return resolved;
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
    const resolvedPart5Answers = resolveListeningPart5SubmittedActions(
      part5.questions.flatMap(question => question.actions),
      answers.part5,
    );
    for (const question of part5.questions) {
      const submitted = question.actions.map(action => resolvedPart5Answers.get(action.id));
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
