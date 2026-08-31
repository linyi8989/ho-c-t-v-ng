import type {
  ExamAnswers,
  ExamInteractionRegion,
  ExamPaperContent,
  ExamQuestionResult,
  ExamScenePlacement,
} from '../../features/exam-platform/types.js';
import {
  readExamMatchingConnections,
  starterMatchingModel,
  starterMatchingResponseKey,
  starterMatchingSourceNodeId,
} from '../../features/exam-platform/starterMatching.js';
import { displayCorrectAnswer, normalizeExamText } from './examValidation.js';
import { examPartUnits } from '../../features/exam-platform/examStructure.js';

export const EXAM_GRADING_VERSION = 'exam-platform-objective-v2';

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

function scenePlacement(value: unknown): ExamScenePlacement | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const placement = value as Partial<ExamScenePlacement>;
  return typeof placement.actionId === 'string'
    && typeof placement.object === 'string'
    && Number.isFinite(placement.x)
    && Number.isFinite(placement.y)
    ? placement as ExamScenePlacement
    : undefined;
}

function pointInRegion(point: { x: number; y: number }, region: ExamInteractionRegion) {
  if (region.shape === 'ellipse') {
    const rx = region.width / 2;
    const ry = region.height / 2;
    if (!rx || !ry) return false;
    const dx = (point.x - region.x - rx) / rx;
    const dy = (point.y - region.y - ry) / ry;
    return dx * dx + dy * dy <= 1;
  }
  if (region.shape === 'polygon' && region.points?.length) {
    let inside = false;
    for (let index = 0, previous = region.points.length - 1; index < region.points.length; previous = index++) {
      const currentPoint = region.points[index];
      const previousPoint = region.points[previous];
      const crosses = (currentPoint.y > point.y) !== (previousPoint.y > point.y)
        && point.x < (previousPoint.x - currentPoint.x) * (point.y - currentPoint.y) / ((previousPoint.y - currentPoint.y) || Number.EPSILON) + currentPoint.x;
      if (crosses) inside = !inside;
    }
    return inside;
  }
  return point.x >= region.x && point.x <= region.x + region.width
    && point.y >= region.y && point.y <= region.y + region.height;
}

export function gradeExamAttempt(content: ExamPaperContent, answers: ExamAnswers) {
  const questions: ExamQuestionResult[] = [];
  let objectiveAwarded = 0;
  let objectiveMaximum = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  let unansweredCount = 0;
  let pendingManualCount = 0;

  content.parts.forEach(part => {
    examPartUnits(part).forEach(unit => {
    if (unit.interactionLayout?.kind === 'scene-draw-v1') {
      unit.interactionLayout.targets.forEach(target => {
        const question = unit.questions.find(item => item.id === target.questionId);
        if (!question) return;
        const answer = scenePlacement(answers[question.id]);
        const unanswered = !answer;
        const correct = Boolean(answer
          && answer.actionId === target.id
          && normalizeExamText(answer.object) === normalizeExamText(target.object)
          && pointInRegion(answer, target.targetRegion));
        objectiveMaximum += question.points;
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
          userAnswer: answer ? `${answer.object} @ ${Math.round(answer.x * 100)}%, ${Math.round(answer.y * 100)}%` : '',
          correctAnswer: `Vẽ ${target.object} · ${target.label}`,
          correct,
          unanswered,
          pointsAwarded: correct ? question.points : 0,
          maxPoints: question.points,
          pendingManualReview: false,
        });
      });
      return;
    }
    const rawMatchingLayout = unit.interactionLayout;
    if (rawMatchingLayout && (rawMatchingLayout.kind === 'starter-image-matching-v1' || rawMatchingLayout.kind === 'starter-image-matching-v2')) {
      const layout = starterMatchingModel(rawMatchingLayout);
      const connectionAnswers = readExamMatchingConnections(answers[starterMatchingResponseKey(unit.id)]);
      const submitted = connectionAnswers.length || rawMatchingLayout.kind === 'starter-image-matching-v2'
        ? connectionAnswers
        : unit.questions.flatMap(question => {
          const sourceNodeId = starterMatchingSourceNodeId(unit, question.id);
          const rawAnswer = answers[question.id];
          const targetNodeId = typeof rawAnswer === 'string'
            ? rawAnswer
            : Array.isArray(rawAnswer) && typeof rawAnswer[0] === 'string'
              ? rawAnswer[0]
              : '';
          return sourceNodeId && targetNodeId ? [{ sourceNodeId, targetNodeId }] : [];
        });
      const sourceById = new Map(layout.sourceNodes.map(node => [node.id, node]));
      const targetById = new Map(layout.targetNodes.map(node => [node.id, node]));
      const expected = unit.questions.map(question => ({
        question,
        sourceNodeId: starterMatchingSourceNodeId(unit, question.id) || '',
        targetNodeId: question.correctOptionIds[0] || '',
      }));
      if (expected.every(row => sourceById.has(row.sourceNodeId) && targetById.has(row.targetNodeId))) {
        const key = (sourceNodeId: string, targetNodeId: string) => `${sourceNodeId}\u0000${targetNodeId}`;
        const expectedKeys = new Set(expected.map(row => key(row.sourceNodeId, row.targetNodeId)));
        const submittedByKey = new Map(submitted.map(connection => [key(connection.sourceNodeId, connection.targetNodeId), connection]));
        const remainingWrong = submitted.filter(connection => !expectedKeys.has(key(connection.sourceNodeId, connection.targetNodeId)));
        expected.forEach(row => {
          const exact = submittedByKey.get(key(row.sourceNodeId, row.targetNodeId));
          let actual = exact;
          if (!actual) {
            const sameSourceIndex = remainingWrong.findIndex(connection => connection.sourceNodeId === row.sourceNodeId);
            actual = remainingWrong.splice(sameSourceIndex >= 0 ? sameSourceIndex : 0, 1)[0];
          }
          const source = sourceById.get(row.sourceNodeId)!;
          const target = targetById.get(row.targetNodeId)!;
          const actualSource = actual ? sourceById.get(actual.sourceNodeId) : undefined;
          const actualTarget = actual ? targetById.get(actual.targetNodeId) : undefined;
          const unanswered = !actual;
          const correct = Boolean(exact);
          objectiveMaximum += row.question.points;
          if (unanswered) unansweredCount += 1;
          else if (correct) correctCount += 1;
          else incorrectCount += 1;
          if (correct) objectiveAwarded += row.question.points;
          questions.push({
            questionId: row.question.id,
            part: part.part,
            number: row.question.number,
            type: row.question.type,
            prompt: `${source.label} → ?`,
            userAnswer: actualSource && actualTarget ? `${actualSource.label} → ${actualTarget.label}` : '',
            correctAnswer: `${source.label} → ${target.label}`,
            correct,
            unanswered,
            pointsAwarded: correct ? row.question.points : 0,
            maxPoints: row.question.points,
            pendingManualReview: false,
          });
        });
        return;
      }
    }
    unit.questions.forEach(question => {
    const rawAnswer = answers[question.id];
    const answer = typeof rawAnswer === 'string'
      ? rawAnswer
      : Array.isArray(rawAnswer) && rawAnswer.every(value => typeof value === 'string')
        ? rawAnswer
        : undefined;
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
        ...(question.writingGrading?.enabled ? { aiGradingStatus: 'queued' as const } : {}),
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
    });
    });
  });

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

export interface AiWritingGrade {
  score: number;
  sentenceCount: number;
  grammarErrors: string[];
  vocabularyErrors: string[];
  feedback: string;
}

function finalizeWritingGrade(grade: ReturnType<typeof gradeExamAttempt>, questions: ExamQuestionResult[]) {
  const writing = questions.filter(question => question.type === 'long-writing');
  const pendingManualCount = writing.filter(question => question.pendingManualReview).length;
  const writingAwarded = writing.reduce((sum, question) => sum + Number(question.pointsAwarded || 0), 0);
  const writingMaximum = writing.reduce((sum, question) => sum + Number(question.maxPoints || 0), 0);
  const maximum = grade.objectiveMaximum + writingMaximum;
  const awarded = grade.objectiveAwarded + writingAwarded;
  return {
    ...grade,
    questions,
    status: pendingManualCount ? 'pending_review' as const : 'completed' as const,
    score: maximum > 0 ? Math.round(awarded / maximum * 100) : 0,
    pendingManualCount,
    manualAwarded: writingAwarded,
    manualMaximum: writingMaximum,
  };
}

export function applyAiWritingGrade(grade: ReturnType<typeof gradeExamAttempt>, questionId: string, ai: AiWritingGrade) {
  const score = Math.max(0, Math.min(10, Math.round(ai.score)));
  return finalizeWritingGrade(grade, grade.questions.map(question => question.questionId === questionId ? {
    ...question,
    pointsAwarded: Math.min(question.maxPoints, score),
    pendingManualReview: false,
    aiGradingStatus: 'completed' as const,
    writingScore: score,
    sentenceCount: Math.max(0, Math.round(ai.sentenceCount)),
    grammarErrors: ai.grammarErrors.slice(0, 20),
    vocabularyErrors: ai.vocabularyErrors.slice(0, 20),
    aiFeedback: ai.feedback,
  } : question));
}

export function markAiWritingFailed(grade: ReturnType<typeof gradeExamAttempt>, questionId: string) {
  return { ...grade, questions: grade.questions.map(question => question.questionId === questionId ? { ...question, aiGradingStatus: 'failed' as const } : question) };
}
