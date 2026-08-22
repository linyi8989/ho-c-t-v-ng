import type {
  MoverReadingWritingAnswers,
  MoverReadingWritingContent,
  MoverReadingWritingGradeResult,
  MoverReadingWritingQuestionResult,
} from '../../features/mover-reading-writing/types.js';
import { MOVER_READING_WRITING_TOTAL_QUESTIONS } from '../../features/mover-reading-writing/types.js';
import { normalizeMoverReadingWritingContent } from '../../features/mover-reading-writing/compatibility.js';

export const MOVER_READING_WRITING_GRADING_VERSION = 'mover-reading-writing-v2';

export function normalizeMoverReadingWritingText(value: unknown) {
  return String(value ?? '')
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase('en')
    .replace(/[\u2018\u2019\u02bc\u0060]/g, "'")
    .replace(/\s+/g, ' ');
}

function displayOption(options: Array<{ id: string; text: string }>, id: string) {
  const index = options.findIndex(option => option.id === id);
  if (index < 0) return '';
  const label = String.fromCharCode(65 + index);
  return `${label}. ${options[index].text}`.trim();
}

const displayTextPrompt = (prompt: string, id: string) => (
  String(prompt || '').split(`{{${id}}}`).join('_____')
);

export function gradeMoverReadingWritingAttempt(
  inputContent: MoverReadingWritingContent,
  answers: MoverReadingWritingAnswers,
): MoverReadingWritingGradeResult {
  const content = normalizeMoverReadingWritingContent(inputContent);
  const questions: MoverReadingWritingQuestionResult[] = [];
  const push = (
    part: 1 | 2 | 3 | 4 | 5 | 6,
    questionId: string,
    prompt: string,
    userAnswer: string,
    correctAnswer: string,
    correct: boolean,
  ) => questions.push({
    part,
    questionId,
    prompt,
    userAnswer,
    correctAnswer,
    correct,
    unanswered: !normalizeMoverReadingWritingText(userAnswer),
  });

  content.parts[0].questions.forEach(question => {
    const actual = String(answers.part1?.[question.id] || '');
    const normalized = normalizeMoverReadingWritingText(actual);
    push(1, question.id, displayTextPrompt(question.prompt, question.id), actual, question.acceptedAnswers[0] || '', Boolean(normalized) && question.acceptedAnswers.some(answer => normalizeMoverReadingWritingText(answer) === normalized));
  });

  content.parts[1].questions.forEach(question => {
    const actual = String(answers.part2?.[question.id] || '');
    push(2, question.id, question.statement, actual, question.correctAnswer, actual === question.correctAnswer);
  });

  content.parts[2].questions.forEach(question => {
    const actualId = String(answers.part3?.[question.id] || '');
    push(3, question.id, question.prompt, displayOption(question.options, actualId), displayOption(question.options, question.correctOptionId), actualId === question.correctOptionId);
  });

  content.parts[3].gaps.forEach((gap, index) => {
    const actual = String(answers.part4?.gaps?.[gap.id] || '');
    const normalized = normalizeMoverReadingWritingText(actual);
    push(4, gap.id, `Chỗ trống ${index + 1}`, actual, gap.acceptedAnswers[0] || '', Boolean(normalized) && gap.acceptedAnswers.some(answer => normalizeMoverReadingWritingText(answer) === normalized));
  });
  const titleQuestion = content.parts[3].titleQuestion;
  const actualTitleId = String(answers.part4?.titleOptionId || '');
  push(4, titleQuestion.id, titleQuestion.prompt, displayOption(titleQuestion.options, actualTitleId), displayOption(titleQuestion.options, titleQuestion.correctOptionId), actualTitleId === titleQuestion.correctOptionId);

  content.parts[4].scenes.forEach(scene => scene.questions.forEach(question => {
    const actual = String(answers.part5?.[question.id] || '');
    const normalized = normalizeMoverReadingWritingText(actual);
    const wordCount = normalized ? normalized.split(' ').length : 0;
    const accepted = question.acceptedAnswers.some(answer => normalizeMoverReadingWritingText(answer) === normalized);
    push(5, question.id, displayTextPrompt(question.prompt, question.id), actual, question.acceptedAnswers[0] || '', wordCount >= 1 && wordCount <= 3 && accepted);
  }));

  content.parts[5].gaps.forEach((gap, index) => {
    const actual = String(answers.part6?.[gap.id] || '');
    const normalized = normalizeMoverReadingWritingText(actual);
    push(
      6,
      gap.id,
      `Chỗ trống ${index + 1}`,
      actual,
      gap.acceptedAnswers[0] || '',
      Boolean(normalized) && normalized.split(' ').length === 1
        && gap.acceptedAnswers.some(answer => normalizeMoverReadingWritingText(answer) === normalized),
    );
  });

  if (questions.length !== MOVER_READING_WRITING_TOTAL_QUESTIONS) {
    throw new Error(`Published Mover Reading & Writing version must contain exactly ${MOVER_READING_WRITING_TOTAL_QUESTIONS} questions; received ${questions.length}.`);
  }
  const correctCount = questions.filter(question => question.correct).length;
  const unansweredCount = questions.filter(question => question.unanswered).length;
  const incorrectCount = questions.length - correctCount - unansweredCount;
  return {
    score: Math.round((correctCount / MOVER_READING_WRITING_TOTAL_QUESTIONS) * 100),
    correctCount,
    incorrectCount,
    unansweredCount,
    totalCount: MOVER_READING_WRITING_TOTAL_QUESTIONS,
    questions,
  };
}
