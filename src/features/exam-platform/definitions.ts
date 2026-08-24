import type { ExamPaperDefinition, ExamPartDefinition, ExamPaperContent, ExamQuestion, ExamQuestionType } from './types';
import { EXAM_CONTENT_SCHEMA_VERSION } from './types';
import type { ExamModuleId, ExamPaperId } from '../listening-library/types';

const choiceTypes = ['single-choice', 'matching'] as const;
const readingTypes = [
  'single-choice',
  'multiple-choice',
  'short-answer',
  'true-false',
  'true-false-not-given',
  'yes-no-not-given',
  'matching',
] as const satisfies readonly ExamQuestionType[];
const listeningTypes = ['single-choice', 'multiple-choice', 'short-answer', 'matching'] as const;

function part(
  questionCount: number,
  title: string,
  defaultQuestionType: ExamQuestionType,
  allowedQuestionTypes: readonly ExamQuestionType[],
  options: Partial<ExamPartDefinition> = {},
): ExamPartDefinition {
  const index = Number(options.id?.replace(/\D/g, '') || 0);
  return {
    id: options.id || `part-${index || 1}`,
    displayName: options.displayName || `Part ${index || 1}`,
    title,
    instruction: options.instruction || 'Đọc kỹ yêu cầu và trả lời tất cả câu hỏi.',
    questionCount,
    defaultQuestionType,
    allowedQuestionTypes,
    ...options,
  };
}

function indexed(parts: Omit<ExamPartDefinition, 'id' | 'displayName'>[]): ExamPartDefinition[] {
  return parts.map((item, index) => ({ ...item, id: `part-${index + 1}`, displayName: `Part ${index + 1}` }));
}

function paper(
  moduleId: ExamPaperContent['moduleId'],
  paperId: ExamPaperId,
  displayName: string,
  level: string,
  timeLimitMinutes: number,
  parts: Omit<ExamPartDefinition, 'id' | 'displayName'>[],
  options: Pick<ExamPaperDefinition, 'description' | 'flexiblePartDistribution'>,
): ExamPaperDefinition {
  const definedParts = indexed(parts);
  return {
    moduleId,
    paperId,
    displayName,
    description: options.description,
    level,
    timeLimitMinutes,
    parts: definedParts,
    totalQuestionCount: definedParts.reduce((sum, item) => sum + item.questionCount, 0),
    flexiblePartDistribution: options.flexiblePartDistribution,
  };
}

export const EXAM_PAPER_DEFINITIONS = [
  paper('starter', 'listening', 'Listening', 'Pre A1 Starters', 20, [
    part(5, 'Listen and draw lines', 'matching', choiceTypes, { requiresAudio: true }),
    part(5, 'Listen and write a name or number', 'short-answer', listeningTypes, { requiresAudio: true }),
    part(5, 'Listen and choose the picture', 'single-choice', listeningTypes, { requiresAudio: true }),
    part(5, 'Listen and colour', 'single-choice', listeningTypes, { requiresAudio: true }),
  ], { description: 'Pre A1 Starters Listening · 4 Part · 20 câu' }),
  paper('starter', 'reading-writing', 'Reading & Writing', 'Pre A1 Starters', 20, [
    part(5, 'Look and read. Put a tick or a cross', 'true-false', ['true-false']),
    part(5, 'Look and read. Write yes or no', 'true-false', ['true-false']),
    part(5, 'Spell the words', 'short-answer', ['short-answer']),
    part(5, 'Read and choose a word', 'short-answer', ['short-answer', 'single-choice']),
    part(5, 'Look at the picture story and answer', 'short-answer', ['short-answer']),
  ], { description: 'Pre A1 Starters Reading & Writing · 5 Part · 25 câu' }),

  paper('flyer', 'listening', 'Listening', 'A2 Flyers', 25, [
    part(5, 'Listen and draw lines', 'matching', choiceTypes, { requiresAudio: true }),
    part(5, 'Listen and complete the notes', 'short-answer', listeningTypes, { requiresAudio: true }),
    part(5, 'Listen and match', 'matching', listeningTypes, { requiresAudio: true }),
    part(5, 'Listen and choose the picture', 'single-choice', listeningTypes, { requiresAudio: true }),
    part(5, 'Listen, colour and write', 'short-answer', listeningTypes, { requiresAudio: true }),
  ], { description: 'A2 Flyers Listening · 5 Part · 25 câu' }),
  paper('flyer', 'reading-writing', 'Reading & Writing', 'A2 Flyers', 40, [
    part(10, 'Match words and definitions', 'matching', readingTypes),
    part(5, 'Complete the conversation', 'matching', readingTypes),
    part(6, 'Complete the text and choose a title', 'short-answer', readingTypes),
    part(10, 'Choose words to complete the text', 'single-choice', readingTypes),
    part(7, 'Complete sentences about the story', 'short-answer', readingTypes),
    part(5, 'Write one word in each gap', 'short-answer', readingTypes),
    part(1, 'Write a story from three pictures', 'long-writing', ['long-writing'], { longWriting: true, minWords: 20, pointsPerQuestion: 5, instruction: 'Viết một câu chuyện dựa trên ba tranh.' }),
  ], { description: 'A2 Flyers Reading & Writing · 7 Part · 44 câu' }),

  paper('ket', 'reading-writing', 'Reading & Writing', 'A2 Key', 60, [
    part(6, 'Short texts: multiple choice', 'single-choice', readingTypes),
    part(7, 'Multiple matching', 'matching', readingTypes),
    part(5, 'Long text: multiple choice', 'single-choice', readingTypes),
    part(6, 'Multiple-choice cloze', 'single-choice', readingTypes),
    part(6, 'Open cloze', 'short-answer', readingTypes),
    part(1, 'Guided email or note', 'long-writing', ['long-writing'], { longWriting: true, minWords: 25, pointsPerQuestion: 15 }),
    part(1, 'Picture story', 'long-writing', ['long-writing'], { longWriting: true, minWords: 35, pointsPerQuestion: 15 }),
  ], { description: 'A2 Key Reading & Writing · 7 Part · 32 câu' }),
  paper('ket', 'listening', 'Listening', 'A2 Key', 30, [
    part(5, 'Visual multiple choice', 'single-choice', listeningTypes, { requiresAudio: true }),
    part(5, 'Gap fill', 'short-answer', listeningTypes, { requiresAudio: true }),
    part(5, 'Dialogue multiple choice', 'single-choice', listeningTypes, { requiresAudio: true }),
    part(5, 'Short recordings multiple choice', 'single-choice', listeningTypes, { requiresAudio: true }),
    part(5, 'Matching', 'matching', listeningTypes, { requiresAudio: true }),
  ], { description: 'A2 Key Listening · 5 Part · 25 câu' }),

  paper('pet', 'reading', 'Reading', 'B1 Preliminary', 45, [
    part(5, 'Short texts: multiple choice', 'single-choice', readingTypes),
    part(5, 'Multiple matching', 'matching', readingTypes),
    part(5, 'Long text: multiple choice', 'single-choice', readingTypes),
    part(5, 'Gapped text', 'matching', readingTypes),
    part(6, 'Multiple-choice cloze', 'single-choice', readingTypes),
    part(6, 'Open cloze', 'short-answer', readingTypes),
  ], { description: 'B1 Preliminary Reading · 6 Part · 32 câu' }),
  paper('pet', 'writing', 'Writing', 'B1 Preliminary', 45, [
    part(1, 'Write an email', 'long-writing', ['long-writing'], { longWriting: true, minWords: 100, pointsPerQuestion: 20 }),
    part(1, 'Write an article or story', 'long-writing', ['long-writing'], { longWriting: true, minWords: 100, pointsPerQuestion: 20 }),
  ], { description: 'B1 Preliminary Writing · 2 bài' }),
  paper('pet', 'listening', 'Listening', 'B1 Preliminary', 30, [
    part(7, 'Visual multiple choice', 'single-choice', listeningTypes, { requiresAudio: true }),
    part(6, 'Longer recording: multiple choice', 'single-choice', listeningTypes, { requiresAudio: true }),
    part(6, 'Gap fill', 'short-answer', listeningTypes, { requiresAudio: true }),
    part(6, 'Multiple choice', 'single-choice', listeningTypes, { requiresAudio: true }),
  ], { description: 'B1 Preliminary Listening · 4 Part · 25 câu' }),

  paper('fce', 'reading-use-of-english', 'Reading & Use of English', 'B2 First', 75, [
    part(8, 'Multiple-choice cloze', 'single-choice', readingTypes),
    part(8, 'Open cloze', 'short-answer', readingTypes),
    part(8, 'Word formation', 'short-answer', readingTypes),
    part(6, 'Key word transformations', 'short-answer', readingTypes, { pointsPerQuestion: 2 }),
    part(6, 'Reading multiple choice', 'single-choice', readingTypes, { pointsPerQuestion: 2 }),
    part(6, 'Gapped text', 'matching', readingTypes, { pointsPerQuestion: 2 }),
    part(10, 'Multiple matching', 'matching', readingTypes),
  ], { description: 'B2 First Reading & Use of English · 7 Part · 52 câu' }),
  paper('fce', 'writing', 'Writing', 'B2 First', 80, [
    part(1, 'Compulsory essay', 'long-writing', ['long-writing'], { longWriting: true, minWords: 140, pointsPerQuestion: 20 }),
    part(1, 'Choice of text type', 'long-writing', ['long-writing'], { longWriting: true, minWords: 140, pointsPerQuestion: 20 }),
  ], { description: 'B2 First Writing · 2 bài' }),
  paper('fce', 'listening', 'Listening', 'B2 First', 40, [
    part(8, 'Short recordings: multiple choice', 'single-choice', listeningTypes, { requiresAudio: true }),
    part(10, 'Sentence completion', 'short-answer', listeningTypes, { requiresAudio: true }),
    part(5, 'Multiple matching', 'matching', listeningTypes, { requiresAudio: true }),
    part(7, 'Long recording: multiple choice', 'single-choice', listeningTypes, { requiresAudio: true }),
  ], { description: 'B2 First Listening · 4 Part · 30 câu' }),

  paper('ielts', 'listening', 'Listening', 'IELTS Academic', 30, [
    part(10, 'Part 1', 'short-answer', listeningTypes, { requiresAudio: true }),
    part(10, 'Part 2', 'short-answer', listeningTypes, { requiresAudio: true }),
    part(10, 'Part 3', 'single-choice', listeningTypes, { requiresAudio: true }),
    part(10, 'Part 4', 'short-answer', listeningTypes, { requiresAudio: true }),
  ], { description: 'IELTS Academic Listening · 4 Part · 40 câu' }),
  paper('ielts', 'academic-reading', 'Academic Reading', 'IELTS Academic', 60, [
    part(13, 'Reading passage 1', 'single-choice', readingTypes, { questionCountFlexible: true }),
    part(13, 'Reading passage 2', 'single-choice', readingTypes, { questionCountFlexible: true }),
    part(14, 'Reading passage 3', 'single-choice', readingTypes, { questionCountFlexible: true }),
  ], { description: 'IELTS Academic Reading · 3 section · 40 câu', flexiblePartDistribution: true }),
  paper('ielts', 'academic-writing', 'Academic Writing', 'IELTS Academic', 60, [
    part(1, 'Task 1: visual information', 'long-writing', ['long-writing'], { longWriting: true, minWords: 150 }),
    part(1, 'Task 2: essay', 'long-writing', ['long-writing'], { longWriting: true, minWords: 250, pointsPerQuestion: 2 }),
  ], { description: 'IELTS Academic Writing · 2 task' }),
] as const satisfies readonly ExamPaperDefinition[];

const definitionMap = new Map(EXAM_PAPER_DEFINITIONS.map(item => [`${item.moduleId}:${item.paperId}`, item]));

export function getExamPaperDefinition(moduleId: ExamModuleId, paperId: ExamPaperId) {
  return definitionMap.get(`${moduleId}:${paperId}`);
}

export function getModuleExamPaperDefinitions(moduleId: ExamModuleId) {
  return EXAM_PAPER_DEFINITIONS.filter(item => item.moduleId === moduleId);
}

function identifier(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function defaultOptions(type: ExamQuestionType) {
  if (type === 'true-false') return ['True', 'False'];
  if (type === 'true-false-not-given') return ['True', 'False', 'Not Given'];
  if (type === 'yes-no-not-given') return ['Yes', 'No', 'Not Given'];
  if (type === 'single-choice' || type === 'matching') return ['A', 'B', 'C'];
  return [];
}

function createQuestion(partNumber: number, number: number, type: ExamQuestionType, points = 1, minWords?: number): ExamQuestion {
  const options = defaultOptions(type).map((label, index) => ({
    id: identifier('option'),
    label: String.fromCharCode(65 + index),
    text: label,
  }));
  return {
    id: identifier(`q${partNumber}`),
    number,
    type,
    prompt: `Câu ${number}`,
    options,
    correctOptionIds: [],
    acceptedAnswers: [],
    points,
    ...(minWords ? { minWords } : {}),
    ...(type === 'long-writing' ? { rubric: 'Giáo viên chấm theo mức độ hoàn thành yêu cầu, tổ chức bài, từ vựng và ngữ pháp.' } : {}),
  };
}

export function createDefaultExamContent(definition: ExamPaperDefinition): ExamPaperContent {
  let number = 1;
  return {
    schemaVersion: EXAM_CONTENT_SCHEMA_VERSION,
    moduleId: definition.moduleId,
    paperId: definition.paperId,
    title: `${definition.level} · ${definition.displayName}`,
    description: definition.description,
    level: definition.level,
    timeLimitMinutes: definition.timeLimitMinutes,
    showReviewAfterSubmit: true,
    parts: definition.parts.map(partDefinition => ({
      id: identifier('part'),
      part: Number(partDefinition.id.replace(/\D/g, '')),
      title: partDefinition.title,
      instruction: partDefinition.instruction,
      questions: Array.from({ length: partDefinition.questionCount }, () => {
        const question = createQuestion(
          Number(partDefinition.id.replace(/\D/g, '')),
          number,
          partDefinition.defaultQuestionType,
          partDefinition.pointsPerQuestion || 1,
          partDefinition.minWords,
        );
        number += 1;
        return question;
      }),
    })),
  };
}
