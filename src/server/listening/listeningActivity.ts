import type {
  ListeningAnswers,
  ListeningGradeResult,
  ListeningPart3ConnectPicture,
  ListeningPart5Answer,
  ListeningSetContent,
  ListeningVisualReviewBaseItem,
  ListeningVisualReviewPart,
  ListeningVisualReviewPicture,
  ListeningVisualReviewSnapshot,
  ListeningVisualReviewState,
} from '../../features/listening/types.js';
import { pointInListeningRegion } from '../../features/listening/geometry.js';
import {
  LISTENING_LIBRARY_SCHEMA_VERSION,
  resolveListeningModuleId,
} from '../../features/listening-library/registry.js';
import {
  formatListeningReviewAnswer,
  formatListeningReviewQuestion,
} from '../../features/listening/reviewPresentation.js';
import { resolveListeningPart5SubmittedActions } from './listeningGrader.js';

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
  if (part3.displayMode === 'connect-image') {
    part3.correctConnections.forEach((connection, index) => {
      const answer = part3.answers.find(item => item.id === connection.answerId);
      push(
        3,
        connection.answerId,
        formatListeningReviewQuestion(`Part 3 • ${answer?.label || ''}`, 3, index + 10),
        labelForId(part3.pictures, answers.part3[connection.answerId], picture => `${picture.side} ${picture.row}`),
        labelForId(part3.pictures, connection.pictureId, picture => `${picture.side} ${picture.row}`),
        part3.pictures.map(picture => `${picture.side} ${picture.row}`)
      );
    });
  } else {
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
  }

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
  if (part5.displayMode === 'scene-colour-draw') {
    const resolvedPart5Answers = resolveListeningPart5SubmittedActions(
      part5.questions.flatMap(question => question.actions),
      answers.part5,
    );
    part5.questions.forEach((question, index) => {
      const userAnswer = question.actions.map(action => {
        const answer = resolvedPart5Answers.get(action.id);
        if (!answer || typeof answer === 'string') return activityText(answer, 500);
        if (answer.type === 'colour_object') {
          const object = part5.interactiveObjects.find(item => item.id === answer.objectId)?.label || answer.objectId;
          const colour = part5.colours.find(item => item.id === answer.colourId)?.label || answer.colourId;
          return `${object}: ${colour}`;
        }
        const item = part5.objectPalette.find(entry => entry.id === answer.paletteItemId)?.label || answer.paletteItemId;
        return item;
      }).filter(Boolean).join(' | ');
      const correctAnswer = question.actions.map(action => {
        if (action.type === 'colour_object') {
          const object = part5.interactiveObjects.find(item => item.id === action.correctObjectId)?.label || action.correctObjectId;
          const colour = part5.colours.find(item => item.id === action.correctColourId)?.label || action.correctColourId;
          return `${object}: ${colour}`;
        }
        return part5.objectPalette.find(item => item.id === action.correctPaletteItemId)?.label || action.correctPaletteItemId;
      }).join(' | ');
      push(5, question.id, formatListeningReviewQuestion(question.staffPrompt, 5, index + 20), userAnswer, correctAnswer, part5Options);
    });
  } else {
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
  }

  return details;
}

function visualReviewState(detail: Record<string, unknown> | undefined): ListeningVisualReviewState {
  if (detail?.unanswered) return 'unanswered';
  return detail?.isCorrect ? 'correct' : 'incorrect';
}

function visualReviewBase(
  detail: Record<string, unknown> | undefined,
  questionIndex: number,
): ListeningVisualReviewBaseItem {
  return {
    questionIndex,
    state: visualReviewState(detail),
    userAnswer: activityText(detail?.userAnswer || detail?.selectedAnswer, 1000),
    correctAnswer: activityText(detail?.correctAnswer, 1000),
  };
}

function visualReviewPicture(
  picture: ListeningPart3ConnectPicture,
): ListeningVisualReviewPicture {
  return {
    label: activityText(picture?.label || `${picture?.side || ''} ${picture?.row || ''}`, 200),
    side: picture.side,
    row: picture.row,
    region: structuredClone(picture.region),
    anchorOffset: Number(picture.anchorOffset),
  };
}

export function buildListeningVisualReviewSnapshot(
  content: ListeningSetContent,
  answers: ListeningAnswers,
  questions: ListeningGradeResult['questions'],
  suppliedAnswerDetails?: Array<Record<string, unknown>>,
): ListeningVisualReviewSnapshot {
  const details = suppliedAnswerDetails || buildListeningActivityAnswerDetails(content, answers, questions);
  const detailAt = (index: number) => details[index];
  const part1 = content.parts[0];
  const part2 = content.parts[1];
  const part3 = content.parts[2];
  const part4 = content.parts[3];
  const part5 = content.parts[4];
  type SceneReviewAction = Extract<
    ListeningVisualReviewPart,
    { part: 5; mode: 'scene-colour-draw' }
  >['items'][number]['actions'][number];
  const resolvedScenePart5Answers: Map<string, ListeningPart5Answer> = part5.displayMode === 'scene-colour-draw'
    ? resolveListeningPart5SubmittedActions(
        part5.questions.flatMap(question => question.actions),
        answers.part5,
      )
    : new Map();

  const reviewPart1 = {
    part: 1 as const,
    mode: 'scene-targets' as const,
    imageUrl: part1.sceneUrl,
    items: part1.targets.map((target, index) => ({
      ...visualReviewBase(detailAt(index), index),
      region: structuredClone(target.region),
    })),
  };
  const reviewPart2 = {
    part: 2 as const,
    mode: 'text-questions' as const,
    imageUrl: part2.illustrationUrl,
    heading: activityText(part2.heading, 500),
    exampleText: activityText(part2.exampleText, 1000) || undefined,
    items: part2.questions.map((question, index) => ({
      ...visualReviewBase(detailAt(index + 5), index + 5),
      prompt: formatListeningReviewQuestion(question.prompt, 2, index + 5),
    })),
  };

  const reviewPart3 = part3.displayMode === 'connect-image'
    ? {
        part: 3 as const,
        mode: 'connect-image' as const,
        imageUrl: part3.boardUrl,
        items: part3.correctConnections.flatMap((connection, index) => {
          const answer = part3.answers.find(item => item.id === connection.answerId);
          const correctPicture = part3.pictures.find(item => item.id === connection.pictureId);
          if (!answer || !correctPicture) return [];
          const submittedPicture = part3.pictures.find(item => (
            item.id === answers.part3[connection.answerId]
          ));
          return [{
            ...visualReviewBase(detailAt(index + 10), index + 10),
            answerLabel: activityText(answer.label, 300),
            answerRegion: structuredClone(answer.region),
            leftAnchorOffset: Number(answer.leftAnchorOffset),
            rightAnchorOffset: Number(answer.rightAnchorOffset),
            ...(submittedPicture ? { userPicture: visualReviewPicture(submittedPicture) } : {}),
            correctPicture: visualReviewPicture(correctPicture),
          }];
        }),
      }
    : {
        part: 3 as const,
        mode: 'image-options' as const,
        imageUrl: part3.displayMode === 'composite' ? part3.boardUrl : undefined,
        items: part3.items.map((item, index) => ({
          ...visualReviewBase(detailAt(index + 10), index + 10),
          prompt: activityText(item.label, 500),
          options: part3.options.map((option, optionIndex) => ({
            label: String.fromCharCode(65 + optionIndex),
            alt: activityText(option.label, 500),
            imageUrl: option.imageUrl,
          })),
          selectedOptionIndex: part3.options.findIndex(option => option.id === answers.part3[item.id]),
          correctOptionIndex: part3.options.findIndex(option => option.id === item.correctOptionId),
        })),
      };

  const reviewPart4 = {
    part: 4 as const,
    mode: 'image-options' as const,
    items: part4.questions.map((question, index) => ({
      ...visualReviewBase(detailAt(index + 15), index + 15),
      prompt: activityText(question.prompt, 1000),
      options: question.options.map((option, optionIndex) => ({
        label: String.fromCharCode(65 + optionIndex),
        alt: activityText(option.alt, 500),
        imageUrl: option.imageUrl,
      })),
      selectedOptionIndex: question.options.findIndex(option => option.id === answers.part4[question.id]),
      correctOptionIndex: question.options.findIndex(option => option.id === question.correctOptionId),
    })),
  };

  const reviewPart5 = part5.displayMode === 'scene-colour-draw'
    ? {
        part: 5 as const,
        mode: 'scene-colour-draw' as const,
        imageUrl: part5.sceneUrl,
        items: part5.questions.map((question, index) => {
          const actions = question.actions.reduce<SceneReviewAction[]>((reviewActions, action) => {
            const submitted = resolvedScenePart5Answers.get(action.id);
            if (action.type === 'colour_object') {
              const object = part5.interactiveObjects.find(item => item.id === action.correctObjectId);
              const correctColour = part5.colours.find(item => item.id === action.correctColourId);
              if (!object || !correctColour) return reviewActions;
              const userColour = submitted && typeof submitted === 'object' && submitted.type === 'colour_object'
                ? part5.colours.find(item => item.id === submitted.colourId)
                : undefined;
              const correct = Boolean(
                submitted && typeof submitted === 'object' && submitted.type === 'colour_object'
                && submitted.objectId === action.correctObjectId
                && submitted.colourId === action.correctColourId
              );
              reviewActions.push({
                type: 'colour' as const,
                state: !submitted ? 'unanswered' as const : correct ? 'correct' as const : 'incorrect' as const,
                region: structuredClone(object.geometry),
                ...(userColour ? { userColour: { label: activityText(userColour.label, 200), value: activityText(userColour.value, 50) } } : {}),
                correctColour: { label: activityText(correctColour.label, 200), value: activityText(correctColour.value, 50) },
              });
              return reviewActions;
            }
            const correctItem = part5.objectPalette.find(item => item.id === action.correctPaletteItemId);
            if (!correctItem) return reviewActions;
            const placeAnswer = submitted && typeof submitted === 'object' && submitted.type === 'place_object'
              ? submitted
              : undefined;
            const userItem = placeAnswer
              ? part5.objectPalette.find(item => item.id === placeAnswer.paletteItemId)
              : undefined;
            const correct = Boolean(
              placeAnswer
              && placeAnswer.paletteItemId === action.correctPaletteItemId
              && pointInListeningRegion(placeAnswer.anchor, action.targetRegion)
            );
            reviewActions.push({
              type: 'place' as const,
              state: !placeAnswer ? 'unanswered' as const : correct ? 'correct' as const : 'incorrect' as const,
              ...(placeAnswer ? { userAnchor: { ...placeAnswer.anchor } } : {}),
              correctAnchor: {
                x: Math.max(0, Math.min(1, action.targetRegion.x + action.targetRegion.width / 2)),
                y: Math.max(0, Math.min(1, action.targetRegion.y + action.targetRegion.height / 2)),
              },
              ...(userItem ? { userItem: { label: activityText(userItem.label, 200), tokenUrl: userItem.tokenUrl } } : {}),
              correctItem: { label: activityText(correctItem.label, 200), tokenUrl: correctItem.tokenUrl },
            });
            return reviewActions;
          }, []);
          const state: ListeningVisualReviewState = actions.length > 0 && actions.every(action => action.state === 'correct')
            ? 'correct'
            : actions.length === 0 || actions.every(action => action.state === 'unanswered')
              ? 'unanswered'
              : 'incorrect';
          return {
            ...visualReviewBase(detailAt(index + 20), index + 20),
            state,
            prompt: activityText(question.staffPrompt, 1000),
            actions,
          };
        }),
      }
    : {
        part: 5 as const,
        mode: 'scene-colour' as const,
        imageUrl: part5.sceneUrl,
        items: part5.targets.flatMap((target, index) => {
          const correctColour = part5.colours.find(colour => colour.id === target.correctColourId);
          if (!correctColour) return [];
          const submittedColourId = typeof answers.part5[target.id] === 'string'
            ? answers.part5[target.id] as string
            : '';
          const userColour = part5.colours.find(colour => colour.id === submittedColourId);
          return [{
            ...visualReviewBase(detailAt(index + 20), index + 20),
            region: structuredClone(target.region),
            ...(userColour ? { userColour: { label: activityText(userColour.label, 200), value: activityText(userColour.value, 50) } } : {}),
            correctColour: { label: activityText(correctColour.label, 200), value: activityText(correctColour.value, 50) },
          }];
        }),
      };

  return {
    schemaVersion: 2,
    parts: [reviewPart1, reviewPart2, reviewPart3, reviewPart4, reviewPart5],
  };
}

export function normalizeListeningVisualReviewSnapshot(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const source = value as Record<string, unknown>;
  if (source.schemaVersion !== 2 || !Array.isArray(source.parts) || source.parts.length !== 5) return undefined;
  const serialized = JSON.stringify(source);
  if (serialized.length > 750_000 || /"targetRegion"\s*:/i.test(serialized)) return undefined;
  const partNumbers = source.parts.map(part => Number((part as any)?.part));
  if (partNumbers.some((part, index) => part !== index + 1)) return undefined;
  if (source.parts.some(part => !Array.isArray((part as any)?.items) || (part as any).items.length > 25)) return undefined;
  return structuredClone(source) as unknown as ListeningVisualReviewSnapshot;
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
    unanswered: Boolean(item?.unanswered),
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
