import type { ExamPaperDefinition, ExamPartDefinition, ExamPaperContent, ExamQuestion, ExamQuestionType } from './types';
import { EXAM_CONTENT_SCHEMA_VERSION } from './types';
import type { ExamModuleId, ExamPaperId } from '../listening-library/types';
import {
  STARTER_MATCHING_HITBOX_HEIGHT,
  STARTER_MATCHING_HITBOX_WIDTH,
  STARTER_MATCHING_MAX_CONNECTIONS,
  starterMatchingAnchor,
} from './starterMatching';
import { FLYER_NAME_REGION_HEIGHT, FLYER_NAME_REGION_WIDTH } from './flyerListeningMigration';
import { normalizeFixedFlyerReadingWritingContent } from './flyerReadingWritingMigration';
import { normalizeFixedKetReadingWritingContent } from './ketReadingWritingMigration';
import { KET_LISTENING_TEMPLATE_VERSION, normalizeFixedKetListeningContent } from './ketListeningMigration';
import { createDefaultPetReadingExample, PET_READING_PART_HEADERS, PET_READING_TEMPLATE_VERSION, normalizeFixedPetReadingContent } from './petReadingMigration';
import { PET_LISTENING_TEMPLATE_VERSION, normalizeFixedPetListeningContent } from './petListeningMigration';
import { PET_WRITING_TEMPLATE_VERSION, normalizeFixedPetWritingContent } from './petWritingMigration';
import {
  DEFAULT_WRITING_GRADING_INSTRUCTIONS,
  DEFAULT_WRITING_RUBRIC,
  STANDALONE_WRITING_TEMPLATE_VERSION,
} from '../writing-library/writingWordPolicy';

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
  paper('writing', 'writing', 'Writing', 'Lớp 3', 0, [
    part(1, 'Guided writing', 'long-writing', ['long-writing'], { longWriting: true, minWords: 25, pointsPerQuestion: 10 }),
  ], { description: 'Kho đề Writing · một bài viết · AI chấm điểm 0–10' }),
  paper('starter', 'listening', 'Listening', 'Pre A1 Starters', 20, [
    part(5, 'Listen and draw lines', 'matching', choiceTypes, { requiresAudio: true }),
    part(5, 'Listen and write a name or number', 'short-answer', ['short-answer'], { requiresAudio: true }),
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
    part(5, 'Listen and write', 'short-answer', ['short-answer'], { requiresAudio: true }),
    part(5, 'Listen and match', 'matching', listeningTypes, { requiresAudio: true }),
    part(5, 'Listen and choose the picture', 'single-choice', listeningTypes, { requiresAudio: true }),
    part(5, 'Listen, colour and draw', 'single-choice', [...listeningTypes, 'scene-draw'], { requiresAudio: true }),
  ], { description: 'A2 Flyers Listening · 5 Part · 25 câu' }),
  paper('flyer', 'reading-writing', 'Reading & Writing', 'A2 Flyers', 40, [
    part(10, 'Match words and definitions', 'short-answer', ['short-answer'], { questionCountFlexible: true }),
    part(7, 'Look and read. Write yes or no', 'true-false', ['true-false'], { questionCountFlexible: true }),
    part(5, 'Complete the conversation with letters A-H', 'short-answer', ['short-answer'], { questionCountFlexible: true }),
    part(6, 'Complete the story and choose a title', 'short-answer', ['short-answer', 'single-choice'], { questionCountFlexible: true }),
    part(7, 'Complete sentences about the story', 'short-answer', ['short-answer'], { questionCountFlexible: true }),
    part(10, 'Choose A, B or C for each gap', 'single-choice', ['single-choice'], { questionCountFlexible: true }),
    part(5, 'Write one word in each gap', 'short-answer', ['short-answer'], { questionCountFlexible: true }),
  ], { description: 'A2 Flyers Reading & Writing · 7 Part · số câu theo đề gốc' }),

  paper('ket', 'reading-writing', 'Reading & Writing', 'A2 Key', 60, [
    part(5, 'Two-image letter matching', 'short-answer', ['short-answer'], { questionCountFlexible: true }),
    part(5, 'Choose A, B or C', 'single-choice', ['single-choice'], { questionCountFlexible: true }),
    part(10, 'Two exercise groups', 'single-choice', ['single-choice', 'short-answer'], { questionCountFlexible: true }),
    part(7, 'Question and three choices', 'single-choice', ['single-choice'], { questionCountFlexible: true }),
    part(8, 'Choose A, B or C', 'single-choice', ['single-choice'], { questionCountFlexible: true }),
    part(5, 'Complete the spelling', 'short-answer', ['short-answer'], { questionCountFlexible: true }),
    part(10, 'Complete the numbered gaps', 'short-answer', ['short-answer'], { questionCountFlexible: true }),
    part(5, 'Complete the notes', 'short-answer', ['short-answer'], { questionCountFlexible: true }),
    part(1, 'Guided writing', 'long-writing', ['long-writing'], { longWriting: true, minWords: 25, pointsPerQuestion: 10 }),
  ], { description: 'A2 Key Reading & Writing · 9 Part · số câu linh hoạt + Writing 10 điểm' }),
  paper('ket', 'listening', 'Listening', 'A2 Key', 30, [
    part(5, 'Listen and choose the picture', 'single-choice', ['single-choice'], { requiresAudio: true, questionCountFlexible: true }),
    part(5, 'Listen and write a letter', 'short-answer', ['short-answer'], { requiresAudio: true, questionCountFlexible: true }),
    part(5, 'Listen and choose A, B or C', 'single-choice', ['single-choice'], { requiresAudio: true, questionCountFlexible: true }),
    part(5, 'Listen and complete the notes', 'short-answer', ['short-answer'], { requiresAudio: true, questionCountFlexible: true }),
    part(5, 'Listen and complete the notes', 'short-answer', ['short-answer'], { requiresAudio: true, questionCountFlexible: true }),
  ], { description: 'A2 Key Listening · 5 Part · số câu linh hoạt theo đề gốc' }),

  paper('pet', 'reading', 'Reading', 'B1 Preliminary', 45, [
    part(5, PET_READING_PART_HEADERS[0].title, 'single-choice', ['single-choice'], { questionCountFlexible: true, instruction: PET_READING_PART_HEADERS[0].instruction }),
    part(5, PET_READING_PART_HEADERS[1].title, 'single-choice', ['single-choice'], { questionCountFlexible: true, instruction: PET_READING_PART_HEADERS[1].instruction }),
    part(10, PET_READING_PART_HEADERS[2].title, 'true-false', ['true-false'], { questionCountFlexible: true, instruction: PET_READING_PART_HEADERS[2].instruction }),
    part(5, PET_READING_PART_HEADERS[3].title, 'single-choice', ['single-choice'], { questionCountFlexible: true, instruction: PET_READING_PART_HEADERS[3].instruction }),
    part(10, PET_READING_PART_HEADERS[4].title, 'single-choice', ['single-choice'], { questionCountFlexible: true, instruction: PET_READING_PART_HEADERS[4].instruction }),
  ], { description: 'B1 Preliminary Reading · 5 Part · số câu linh hoạt theo đề gốc' }),
  paper('pet', 'writing', 'Writing', 'B1 Preliminary', 45, [
    part(5, 'Sentence transformations', 'short-answer', ['short-answer'], { pointsPerQuestion: 1 }),
    part(1, 'Write an email', 'long-writing', ['long-writing'], { longWriting: true, minWords: 35, pointsPerQuestion: 10 }),
    part(1, 'Choose one writing task', 'long-writing', ['long-writing'], { longWriting: true, minWords: 100, pointsPerQuestion: 10 }),
  ], { description: 'B1 Preliminary Writing · 3 Part · 5 câu biến đổi + 2 bài viết' }),
  paper('pet', 'listening', 'Listening', 'B1 Preliminary', 30, [
    part(7, 'Visual multiple choice', 'single-choice', listeningTypes, { requiresAudio: true, questionCountFlexible: true }),
    part(6, 'Longer recording: multiple choice', 'single-choice', listeningTypes, { requiresAudio: true, questionCountFlexible: true }),
    part(6, 'Gap fill', 'short-answer', listeningTypes, { requiresAudio: true, questionCountFlexible: true }),
    part(6, 'Yes or no statements', 'single-choice', listeningTypes, { requiresAudio: true, questionCountFlexible: true }),
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
  const content: ExamPaperContent = {
    schemaVersion: EXAM_CONTENT_SCHEMA_VERSION,
    structureMode: 'definition',
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
  if (definition.moduleId === 'writing' && definition.paperId === 'writing') {
    const writing = content.parts[0].questions[0];
    content.templateVersion = STANDALONE_WRITING_TEMPLATE_VERSION;
    content.topic = 'General English';
    content.title = 'Bộ đề Writing mới';
    content.description = 'Bài luyện viết có AI nhận xét và chấm điểm.';
    content.timeLimitMinutes = undefined;
    content.parts[0] = {
      ...content.parts[0],
      title: 'Writing task',
      instruction: 'Read the task and write your answer.',
      passage: 'Write a short message. Answer all the points in the task.',
      interaction: {
        family: 'writing',
        subtype: 'guided',
        variant: 'standalone-ai-writing',
        schemaVersion: 1,
        importReadiness: 'content-ready',
      },
      questions: [{
        ...writing,
        prompt: 'Write your answer using all the points above.',
        context: 'Read the task and answer every requested point.',
        points: 10,
        minWords: 25,
        maxWords: 30,
        rubric: DEFAULT_WRITING_RUBRIC,
        writingGrading: {
          enabled: true,
          providerId: 'stali:gpt-5.6-sol',
          taskContext: 'Read the visible writing task and answer every requested point.',
          gradingInstructions: DEFAULT_WRITING_GRADING_INSTRUCTIONS,
          scoreScale: 10,
        },
      }],
    };
  }
  if (definition.moduleId === 'starter' && definition.paperId === 'listening') {
    const part1 = content.parts[0];
    const targetNodes = Array.from({ length: 7 }, (_, index) => ({
      id: identifier('starter-p1-right'),
      label: `Hình đích ${index + 1}`,
      hitRegion: {
        shape: 'rect' as const,
        x: .04 + index * .14,
        y: .86,
        width: STARTER_MATCHING_HITBOX_WIDTH,
        height: STARTER_MATCHING_HITBOX_HEIGHT,
      },
      anchor: { x: .04 + index * .14 + STARTER_MATCHING_HITBOX_WIDTH / 2, y: .86 + STARTER_MATCHING_HITBOX_HEIGHT / 2 },
      geometryConfirmedByTeacher: false,
    }));
    part1.questions = part1.questions.map((question, index) => ({
      ...question,
      prompt: `Hình nguồn ${index + 1}`,
      options: targetNodes.map(item => ({ id: item.id, label: item.label, text: item.label })),
      correctOptionIds: [],
    }));
    part1.interaction = {
      family: 'matching', subtype: 'image-image', variant: 'draw-line', schemaVersion: 2,
      importReadiness: 'needs-assets',
    };
    const sourceNodes = Array.from({ length: 7 }, (_, index) => {
      const hitRegion = {
        shape: 'rect' as const,
        x: .04 + index * .14,
        y: .08,
        width: STARTER_MATCHING_HITBOX_WIDTH,
        height: STARTER_MATCHING_HITBOX_HEIGHT,
      };
      return {
      id: identifier('starter-p1-left'),
      label: `Hình nguồn ${index + 1}`,
      hitRegion,
      anchor: starterMatchingAnchor(hitRegion),
      geometryConfirmedByTeacher: false,
    };
    });
    part1.questions = part1.questions.map((question, index) => ({
      ...question,
      interactionSourceNodeId: sourceNodes[index].id,
    }));
    part1.interactionLayout = {
      kind: 'starter-image-matching-v2',
      sourceNodes,
      targetNodes,
      exampleConnection: { sourceNodeId: sourceNodes[5].id, targetNodeId: targetNodes[5].id },
      maxConnections: STARTER_MATCHING_MAX_CONNECTIONS,
    };
    content.parts[1].interaction = {
      family: 'text-entry', subtype: 'short-answer', variant: 'single-input', schemaVersion: 1,
      importReadiness: 'needs-assets',
    };
    content.parts[2].interaction = {
      family: 'choice', subtype: 'single', variant: 'image-options', schemaVersion: 1,
      importReadiness: 'needs-assets',
    };
    const part4 = content.parts[3];
    const colours = ['green', 'blue', 'red', 'black'].map((text, index) => ({
      id: identifier('starter-colour'), label: String.fromCharCode(65 + index), text,
    }));
    part4.questions = part4.questions.map((question, index) => ({
      ...question,
      type: 'single-choice',
      prompt: `Đối tượng ${index + 1}`,
      options: colours.map(option => ({ ...option })),
      correctOptionIds: [],
    }));
    part4.interaction = {
      family: 'scene', subtype: 'colour-object', variant: 'paint', schemaVersion: 1,
      importReadiness: 'needs-assets',
    };
    part4.interactionLayout = {
      kind: 'starter-scene-colour-v1',
      targets: part4.questions.map((question, index) => ({
        id: identifier('starter-colour-target'),
        questionId: question.id,
        label: question.prompt,
        region: { shape: 'rect' as const, x: .39, y: .08 + index * .16, width: .2, height: .1 },
        geometryConfirmedByTeacher: false,
      })),
    };
  }
  if (definition.moduleId === 'flyer' && definition.paperId === 'listening') {
    [content.parts[0]].forEach((namePart, partIndex) => {
      const choices = Array.from({ length: 6 }, (_, index) => ({
        id: identifier(`flyer-p${partIndex + 1}-name`),
        label: String.fromCharCode(65 + index),
        text: `Name ${index + 1}`,
      }));
      namePart.questions = namePart.questions.map((question, index) => ({
        ...question,
        type: 'matching',
        prompt: `Person ${index + 1}`,
        options: choices.map(option => ({ ...option })),
        correctOptionIds: [],
      }));
      namePart.examples = [{ prompt: 'Example', answer: '' }];
      namePart.interaction = {
        family: 'matching', subtype: 'name-scene', variant: 'drag-name-to-region', schemaVersion: 1,
        importReadiness: 'needs-assets',
      };
      namePart.interactionLayout = {
        kind: 'flyer-name-placement-v1',
        targets: namePart.questions.map((question, index) => ({
          id: identifier(`flyer-p${partIndex + 1}-target`),
          questionId: question.id,
          label: question.prompt,
          region: { shape: 'rect' as const, x: .08 + (index % 2) * .62, y: .12 + Math.floor(index / 2) * .27, width: FLYER_NAME_REGION_WIDTH, height: FLYER_NAME_REGION_HEIGHT },
          geometryConfirmedByTeacher: false,
        })),
      };
    });

    const part2 = content.parts[1];
    part2.interaction = {
      family: 'text-entry', subtype: 'short-answer', variant: 'single-input', schemaVersion: 1,
      importReadiness: 'needs-assets',
    };
    part2.questions = part2.questions.map((question, index) => ({
      ...question,
      type: 'short-answer',
      prompt: `Question ${index + 1}: ____`,
      options: [],
      correctOptionIds: [],
      acceptedAnswers: [],
    }));

    const part3 = content.parts[2];
    part3.interaction = {
      family: 'text-entry', subtype: 'letter-matching', variant: 'two-image-letter-input', schemaVersion: 1,
      importReadiness: 'needs-assets',
    };
    part3.examples = [{ prompt: 'Example', answer: '' }];
    part3.questions = part3.questions.map((question, index) => ({
      ...question,
      type: 'short-answer',
      prompt: `Person ${index + 1}`,
      options: [],
      correctOptionIds: [],
      acceptedAnswers: [],
      maxWords: 1,
    }));
    part3.readingScenes = [{ id: identifier('flyer-p3-people'), passage: '', questionIds: part3.questions.map(question => question.id) }];

    const part4 = content.parts[3];
    part4.interaction = {
      family: 'choice', subtype: 'single', variant: 'image-options', schemaVersion: 1,
      importReadiness: 'needs-assets',
    };

    const part5 = content.parts[4];
    const colours = ['green', 'blue', 'red', 'black'].map((text, index) => ({
      id: identifier('flyer-colour'), label: String.fromCharCode(65 + index), text,
    }));
    part5.questions = part5.questions.map((question, index) => ({
      ...question,
      type: 'single-choice',
      prompt: `Đối tượng ${index + 1}`,
      options: colours.map(option => ({ ...option })),
      correctOptionIds: [],
    }));
    part5.interaction = {
      family: 'scene', subtype: 'colour-object', variant: 'paint', schemaVersion: 1,
      importReadiness: 'needs-assets',
    };
    part5.interactionLayout = {
      kind: 'starter-scene-colour-v1',
      targets: part5.questions.map((question, index) => ({
        id: identifier('flyer-colour-target'),
        questionId: question.id,
        label: question.prompt,
        region: { shape: 'rect' as const, x: .39, y: .08 + index * .16, width: .2, height: .1 },
        geometryConfirmedByTeacher: false,
      })),
    };
  }
  if (definition.moduleId === 'starter' && definition.paperId === 'reading-writing') {
    const yesNoOptions = () => [
      { id: identifier('starter-rw-yes'), label: 'YES', text: 'Yes' },
      { id: identifier('starter-rw-no'), label: 'NO', text: 'No' },
    ];
    [content.parts[0], content.parts[1]].forEach((yesNoPart, partIndex) => {
      yesNoPart.interaction = {
        family: 'choice',
        subtype: 'single',
        variant: 'yes-no',
        schemaVersion: 1,
        importReadiness: 'needs-assets',
      };
      yesNoPart.questions = yesNoPart.questions.map((question, index) => ({
        ...question,
        type: 'true-false',
        prompt: `Câu ${index + 1}`,
        options: yesNoOptions(),
        correctOptionIds: [],
      }));
      yesNoPart.examples = partIndex === 0
        ? [{ prompt: '', answer: 'Yes' }, { prompt: '', answer: 'No' }]
        : [{ prompt: '', answer: 'Yes' }, { prompt: '', answer: 'No' }];
    });

    const part3 = content.parts[2];
    part3.interaction = {
      family: 'text-entry',
      subtype: 'short-answer',
      variant: 'image-spelling',
      schemaVersion: 1,
      importReadiness: 'needs-assets',
    };
    part3.questions = part3.questions.map((question, index) => ({
      ...question,
      prompt: `Từ ${index + 1}: ____`,
      maxWords: 1,
      answerLength: 3,
    }));
    part3.examples = [{ prompt: 'Example', answer: '' }];

    const part4 = content.parts[3];
    part4.interaction = {
      family: 'text-entry',
      subtype: 'short-answer',
      variant: 'story-gaps',
      schemaVersion: 1,
      importReadiness: 'needs-assets',
    };
    part4.passage = part4.questions.map((_question, index) => `[[${index + 1}]]`).join(' ');
    part4.examples = [{ prompt: '', answer: '' }];
    part4.questions = part4.questions.map(question => ({ ...question, maxWords: 1 }));

    const part5 = content.parts[4];
    part5.interaction = {
      family: 'text-entry',
      subtype: 'short-answer',
      variant: 'scene-story',
      schemaVersion: 1,
      importReadiness: 'needs-assets',
    };
    part5.examples = [{ prompt: '', answer: '' }, { prompt: '', answer: '' }];
    part5.questions = part5.questions.map((question, index) => ({
      ...question,
      prompt: `Câu ${index + 1}: ____`,
      maxWords: 3,
    }));
    part5.readingScenes = [
      { id: identifier('starter-rw-scene-1'), passage: '', questionIds: part5.questions.slice(0, 1).map(question => question.id) },
      { id: identifier('starter-rw-scene-2'), passage: '', questionIds: part5.questions.slice(1, 3).map(question => question.id) },
      { id: identifier('starter-rw-scene-3'), passage: '', questionIds: part5.questions.slice(3, 5).map(question => question.id) },
    ];
  }
  if (definition.moduleId === 'ket' && definition.paperId === 'listening') {
    content.templateVersion = KET_LISTENING_TEMPLATE_VERSION;
  }
  if (definition.moduleId === 'pet' && definition.paperId === 'reading') {
    content.templateVersion = PET_READING_TEMPLATE_VERSION;
    content.parts[0].examples = [createDefaultPetReadingExample(1)];
    content.parts[4].examples = [createDefaultPetReadingExample(5)];
  }
  if (definition.moduleId === 'pet' && definition.paperId === 'writing') {
    content.templateVersion = PET_WRITING_TEMPLATE_VERSION;
  }
  if (definition.moduleId === 'pet' && definition.paperId === 'listening') {
    content.templateVersion = PET_LISTENING_TEMPLATE_VERSION;
  }
  return normalizeFixedPetListeningContent(normalizeFixedPetWritingContent(normalizeFixedPetReadingContent(normalizeFixedKetListeningContent(normalizeFixedKetReadingWritingContent(normalizeFixedFlyerReadingWritingContent(content))))));
}
