import type {
  MoverReadingWritingChoiceQuestion,
  MoverReadingWritingContent,
  MoverReadingWritingQuestionResult,
  MoverReadingWritingVisualReviewBaseItem,
  MoverReadingWritingVisualReviewChoiceItem,
  MoverReadingWritingVisualReviewExample,
  MoverReadingWritingVisualReviewSnapshot,
  MoverReadingWritingVisualReviewState,
} from '../../features/mover-reading-writing/types.js';
import {
  MOVER_READING_WRITING_PART_COUNTS,
  MOVER_READING_WRITING_TOTAL_QUESTIONS,
} from '../../features/mover-reading-writing/types.js';
import { normalizeMoverReadingWritingContent } from '../../features/mover-reading-writing/compatibility.js';

const reviewText = (value: unknown, max = 20_000) => String(value ?? '').trim().slice(0, max);

function reviewState(result: MoverReadingWritingQuestionResult): MoverReadingWritingVisualReviewState {
  if (result.unanswered) return 'unanswered';
  return result.correct ? 'correct' : 'incorrect';
}

function optionAnswer(question: Pick<MoverReadingWritingChoiceQuestion, 'options'>, index: number) {
  const option = question.options[index];
  return option ? `${String.fromCharCode(65 + index)}. ${reviewText(option.text, 1_000)}`.trim() : '';
}

function optionIndexFromAnswer(
  question: Pick<MoverReadingWritingChoiceQuestion, 'options'>,
  answer: string,
) {
  const normalized = reviewText(answer, 1_000);
  return question.options.findIndex((_option, index) => optionAnswer(question, index) === normalized);
}

function presentationTemplate(
  template: string,
  gaps: Array<{ id: string }>,
) {
  return gaps.reduce(
    (value, gap, index) => value.split(`{{${gap.id}}}`).join(`{{${index + 1}}}`),
    reviewText(template),
  );
}

function safeExample(example: { prompt?: string; answer?: string } | undefined) {
  if (!example) return undefined;
  const prompt = reviewText(example.prompt, 2_000);
  const answer = reviewText(example.answer, 1_000);
  return prompt || answer ? { prompt, answer } satisfies MoverReadingWritingVisualReviewExample : undefined;
}

function baseItem(
  result: MoverReadingWritingQuestionResult,
  questionNumber: number,
  prompt: string,
): MoverReadingWritingVisualReviewBaseItem {
  return {
    questionNumber,
    state: reviewState(result),
    prompt: reviewText(prompt, 2_000),
    userAnswer: reviewText(result.userAnswer, 1_000),
    correctAnswer: reviewText(result.correctAnswer, 1_000),
  };
}

function choiceItem(
  result: MoverReadingWritingQuestionResult,
  questionNumber: number,
  question: MoverReadingWritingChoiceQuestion,
): MoverReadingWritingVisualReviewChoiceItem {
  return {
    ...baseItem(result, questionNumber, question.prompt),
    options: question.options.map((option, index) => ({
      label: String.fromCharCode(65 + index),
      text: reviewText(option.text, 1_000),
    })),
    selectedOptionIndex: optionIndexFromAnswer(question, result.userAnswer),
    correctOptionIndex: optionIndexFromAnswer(question, result.correctAnswer),
  };
}

function assertReviewQuestions(questions: MoverReadingWritingQuestionResult[]) {
  if (questions.length !== MOVER_READING_WRITING_TOTAL_QUESTIONS) {
    throw new Error(`Reading & Writing visual review requires ${MOVER_READING_WRITING_TOTAL_QUESTIONS} results.`);
  }
  MOVER_READING_WRITING_PART_COUNTS.forEach((count, index) => {
    const part = index + 1;
    if (questions.filter(question => question.part === part).length !== count) {
      throw new Error(`Reading & Writing visual review Part ${part} requires ${count} results.`);
    }
  });
}

export function buildMoverReadingWritingVisualReviewSnapshot(
  inputContent: MoverReadingWritingContent,
  questions: MoverReadingWritingQuestionResult[],
): MoverReadingWritingVisualReviewSnapshot {
  const content = normalizeMoverReadingWritingContent(inputContent);
  assertReviewQuestions(questions);
  const byQuestion = new Map(questions.map(question => [`${question.part}:${question.questionId}`, question]));
  const resultFor = (part: 1 | 2 | 3 | 4 | 5 | 6, questionId: string) => {
    const result = byQuestion.get(`${part}:${questionId}`);
    if (!result) throw new Error(`Missing Reading & Writing visual review result for Part ${part}.`);
    return result;
  };
  const common = (part: MoverReadingWritingContent['parts'][number]) => ({
    title: reviewText(part.title, 500),
    instruction: reviewText(part.instruction, 2_000),
  });

  const part1 = content.parts[0];
  const reviewPart1 = {
    part: 1 as const,
    mode: 'text-questions' as const,
    ...common(part1),
    imageUrl: part1.wordBankUrl,
    example: safeExample(part1.example),
    items: part1.questions.map((question, index) => (
      baseItem(
        resultFor(1, question.id),
        index + 1,
        question.prompt.split(`{{${question.id}}}`).join(`{{${index + 1}}}`),
      )
    )),
  };

  const part2 = content.parts[1];
  const reviewPart2 = {
    part: 2 as const,
    mode: 'yes-no' as const,
    ...common(part2),
    imageUrl: part2.sceneUrl,
    examples: part2.examples.map(example => ({
      prompt: reviewText(example.prompt, 2_000),
      answer: reviewText(example.answer, 1_000),
    })),
      items: part2.questions.map((question, index) => {
        const result = resultFor(2, question.id);
        const selectedAnswer = reviewText(result.userAnswer).toLowerCase();
        const correctAnswer = reviewText(result.correctAnswer).toLowerCase();
        const options = [
          { label: 'YES', text: '' },
          { label: 'NO', text: '' },
        ];
        return {
          ...baseItem(result, index + 1, question.statement),
          options,
          selectedOptionIndex: selectedAnswer === 'yes' ? 0 : selectedAnswer === 'no' ? 1 : -1,
          correctOptionIndex: correctAnswer === 'yes' ? 0 : correctAnswer === 'no' ? 1 : -1,
        };
      }),
  };

  const part3 = content.parts[2];
  const part3Example = part3.example
    ? {
        prompt: reviewText(part3.example.prompt, 2_000),
        answer: optionAnswer(
          part3.example,
          part3.example.options.findIndex(option => option.id === part3.example?.correctOptionId),
        ),
      }
    : undefined;
  const reviewPart3 = {
    part: 3 as const,
    mode: 'text-options' as const,
    ...common(part3),
    imageUrl: part3.sceneUrl,
    example: part3Example,
    items: part3.questions.map((question, index) => (
      choiceItem(resultFor(3, question.id), index + 1, question)
    )),
  };

  const part4 = content.parts[3];
  const reviewPart4 = {
    part: 4 as const,
    mode: 'story-gaps-title' as const,
    ...common(part4),
    imageUrl: part4.wordBankUrl,
    storyTemplate: presentationTemplate(part4.storyTemplate, part4.gaps),
    example: safeExample(part4.example),
    gaps: part4.gaps.map((gap, index) => (
      baseItem(resultFor(4, gap.id), index + 1, `Chỗ trống ${index + 1}`)
    )),
    titleItem: choiceItem(resultFor(4, part4.titleQuestion.id), 7, part4.titleQuestion),
  };

  const part5 = content.parts[4];
  let part5QuestionNumber = 0;
  const reviewPart5 = {
    part: 5 as const,
    mode: 'scene-text' as const,
    ...common(part5),
    example: safeExample(part5.example),
    scenes: part5.scenes.map(scene => ({
      imageUrl: scene.imageUrl,
      passage: reviewText(scene.passage, 20_000),
      items: scene.questions.map(question => {
        part5QuestionNumber += 1;
        return baseItem(
          resultFor(5, question.id),
          part5QuestionNumber,
          question.prompt.split(`{{${question.id}}}`).join(`{{${part5QuestionNumber}}}`),
        );
      }),
    })),
  };

  const part6 = content.parts[5];
  const reviewPart6 = {
    part: 6 as const,
    mode: 'passage-text' as const,
    ...common(part6),
    illustrationUrl: part6.illustrationUrl,
    optionsUrl: part6.optionsUrl,
    passageTitle: reviewText(part6.passageTitle, 500),
    passageTemplate: presentationTemplate(
      part6.passageTemplate.replace(/\[\[\s*example\s*\]\]/gi, part6.example?.answer || ''),
      part6.gaps,
    ),
    example: safeExample(part6.example),
    items: part6.gaps.map((gap, index) => (
      baseItem(resultFor(6, gap.id), index + 1, `Chỗ trống ${index + 1}`)
    )),
  };

  return {
    schemaVersion: 1,
    totalCount: MOVER_READING_WRITING_TOTAL_QUESTIONS,
    parts: [reviewPart1, reviewPart2, reviewPart3, reviewPart4, reviewPart5, reviewPart6],
  };
}

export function normalizeMoverReadingWritingVisualReviewSnapshot(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const source = value as Record<string, unknown>;
  if (source.schemaVersion !== 1 || source.totalCount !== MOVER_READING_WRITING_TOTAL_QUESTIONS) return undefined;
  if (!Array.isArray(source.parts) || source.parts.length !== 6) return undefined;
  if (source.parts.some((part, index) => Number((part as any)?.part) !== index + 1)) return undefined;
  const serialized = JSON.stringify(source);
  if (serialized.length > 750_000) return undefined;
  if (/"(?:questionId|correctOptionId|acceptedAnswers|assetId|passageSource(?:AssetId|Url))"\s*:/i.test(serialized)) return undefined;
  return structuredClone(source) as unknown as MoverReadingWritingVisualReviewSnapshot;
}
