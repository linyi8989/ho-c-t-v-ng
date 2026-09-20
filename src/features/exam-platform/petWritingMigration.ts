import type { ExamInteractionDescriptor, ExamOption, ExamPaperContent, ExamPartContent, ExamQuestion } from './types';
import { EXAM_CONTENT_SCHEMA_VERSION } from './types';
import { DEFAULT_WRITING_GRADING_INSTRUCTIONS, DEFAULT_WRITING_RUBRIC } from '../writing-library/writingWordPolicy';

export const PET_WRITING_TEMPLATE_VERSION = 'pet-writing-3-v1';
export const PET_WRITING_VARIANTS = [
  'sentence-transformation',
  'guided-email-writing',
  'choice-free-writing',
] as const;

export const PET_GUIDED_EMAIL_GRADING_INSTRUCTIONS = [
  DEFAULT_WRITING_GRADING_INSTRUCTIONS,
  'Đây là email hoặc thư ngắn. Ưu tiên việc hoàn thành đủ các ý bắt buộc trong khung nội dung do giáo viên cung cấp.',
  'Chấp nhận lời chào, lời cảm ơn, câu hỏi thêm và lời mong hồi đáp nếu phù hợp với người nhận và thể loại thư.',
  'Không ép bài phải dừng đúng số từ mục tiêu. Bài dài hơn vẫn có thể đạt điểm cao nếu đúng trọng tâm, tự nhiên, mạch lạc và dùng tiếng Anh tốt; chỉ giảm điểm khi nội dung lan man, lặp ý, sai thể loại hoặc có lỗi ảnh hưởng chất lượng.',
].join(' ');

export const PET_FREE_WRITING_GRADING_INSTRUCTIONS = [
  DEFAULT_WRITING_GRADING_INSTRUCTIONS,
  'Đây là bài viết tự do theo một trong hai đề học sinh đã chọn. Chấm đúng chủ đề và đúng thể loại của lựa chọn đó, đồng thời đánh giá nội dung, bố cục, tính mạch lạc, từ vựng và ngữ pháp.',
  'Không bắt buộc một dàn ý duy nhất. Các chi tiết sáng tạo hợp lý được khuyến khích; bài dài hơn mục tiêu vẫn có thể đạt điểm cao nếu hay, rõ ràng và không lan man.',
].join(' ');

const makeId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

const DEFAULT_PART_ONE_EXAMPLE = {
  prompt: 'The game is called Jotto.\nThe name ____ is Jotto.',
  answer: 'of the game',
};

function descriptor(part: number): ExamInteractionDescriptor {
  if (part === 1) return { family: 'text-entry', subtype: 'short-answer', variant: PET_WRITING_VARIANTS[0], schemaVersion: 1, importReadiness: 'content-ready' };
  if (part === 2) return { family: 'writing', subtype: 'guided-email', variant: PET_WRITING_VARIANTS[1], schemaVersion: 1, importReadiness: 'content-ready' };
  return { family: 'writing', subtype: 'choice', variant: PET_WRITING_VARIANTS[2], schemaVersion: 1, importReadiness: 'content-ready' };
}

function sentenceQuestion(number: number): ExamQuestion {
  return {
    id: makeId('pet-writing-p1-question'),
    number,
    displayNumber: number,
    type: 'short-answer',
    context: `Original sentence ${number}.`,
    prompt: `Rewritten sentence ${number}: ____`,
    options: [],
    correctOptionIds: [],
    acceptedAnswers: [],
    points: 1,
    maxWords: 5,
  };
}

function writingQuestion(part: 2 | 3): ExamQuestion {
  const options: ExamOption[] = part === 3
    ? [
        { id: makeId('pet-writing-option'), label: '7', text: 'Write a letter answering the question shown here.' },
        { id: makeId('pet-writing-option'), label: '8', text: 'Write a story with the title shown here.' },
      ]
    : [];
  return {
    id: makeId(`pet-writing-p${part}-question`),
    number: part === 2 ? 6 : 7,
    displayNumber: part === 2 ? 6 : 7,
    type: 'long-writing',
    prompt: part === 2 ? 'Write your email. Include all the points in the task.' : 'Choose one question and write your answer.',
    context: part === 2
      ? '1. Cảm ơn người nhận về món quà\n2. Nói em định mua gì\n3. Giải thích vì sao em chọn món đó'
      : 'Chấm theo đúng đề mà học sinh đã chọn.',
    options,
    correctOptionIds: [],
    acceptedAnswers: [],
    points: 10,
    minWords: part === 2 ? 35 : 100,
    maxWords: part === 2 ? 45 : 120,
    rubric: DEFAULT_WRITING_RUBRIC,
    writingGrading: {
      enabled: true,
      providerId: 'stali:gpt-5.6-sol',
      taskContext: part === 2
        ? 'Writing task – các ý bắt buộc:\n1. Cảm ơn người nhận về món quà\n2. Nói em định mua gì\n3. Giải thích vì sao em chọn món đó'
        : 'Writing task – chấm theo đúng chủ đề, thể loại và yêu cầu của đề học sinh đã chọn.',
      gradingInstructions: part === 2 ? PET_GUIDED_EMAIL_GRADING_INSTRUCTIONS : PET_FREE_WRITING_GRADING_INSTRUCTIONS,
      scoreScale: 10,
    },
  };
}

function defaultPart(part: number): ExamPartContent {
  if (part === 1) return {
    id: makeId('pet-writing-part'), part, title: 'Questions 1–5',
    instruction: 'Here are some sentences about a game.\nFor each question, complete the second sentence so that it means the same as the first.\nUse no more than three words.\nWrite only the missing words on your answer sheet.\nYou may use this page for any rough work.',
    interaction: descriptor(part),
    examples: [DEFAULT_PART_ONE_EXAMPLE],
    questions: Array.from({ length: 5 }, (_, index) => sentenceQuestion(index + 1)),
  };
  if (part === 2) return {
    id: makeId('pet-writing-part'), part, title: 'Write an email',
    instruction: 'Read the task and write 35–45 words.',
    passage: 'Your English friend has written to you. Write an email and answer all the points.',
    interaction: descriptor(part), questions: [writingQuestion(2)],
  };
  return {
    id: makeId('pet-writing-part'), part, title: 'Questions 7–8',
    instruction: 'Write an answer to one of the questions (7 or 8) in this part.\nWrite your answer in about 100 words on your answer sheet.\nMark the question number in the box at the top of your answer sheet.',
    interaction: descriptor(part), questions: [writingQuestion(3)],
  };
}

function normalizeSentencePart(part: ExamPartContent): ExamPartContent {
  const source = part.questions.length ? part.questions : defaultPart(1).questions;
  const questions = Array.from({ length: 5 }, (_, index) => {
    const current = source[index] || sentenceQuestion(index + 1);
    return {
      ...current,
      number: index + 1,
      displayNumber: index + 1,
      type: 'short-answer' as const,
      context: current.context || `Original sentence ${index + 1}.`,
      prompt: current.prompt || `Rewritten sentence ${index + 1}: ____`,
      options: [],
      correctOptionIds: [],
      acceptedAnswers: current.acceptedAnswers || [],
      points: 1,
      maxWords: current.maxWords || 5,
    };
  });
  const importedExamples = part.blocks?.[0]?.examples;
  const examples = importedExamples?.length ? importedExamples : part.examples?.length ? part.examples : [DEFAULT_PART_ONE_EXAMPLE];
  return { ...part, part: 1, interaction: descriptor(1), examples: examples.slice(0, 1), questions, blocks: undefined, readingScenes: undefined };
}

function normalizeWritingPart(part: ExamPartContent, partNumber: 2 | 3): ExamPartContent {
  const fallback = writingQuestion(partNumber);
  const fallbackPart = defaultPart(partNumber);
  const current = part.questions[0] || fallback;
  const optionSource = partNumber === 3 && current.options.length >= 2 ? current.options.slice(0, 2) : fallback.options;
  const options = optionSource.map((option, index) => ({
    ...option,
    id: option.id || makeId('pet-writing-option'),
    label: String(index + 7),
    text: option.text || `Question ${index + 7}`,
  }));
  const defaultInstructions = partNumber === 2 ? PET_GUIDED_EMAIL_GRADING_INSTRUCTIONS : PET_FREE_WRITING_GRADING_INSTRUCTIONS;
  const question: ExamQuestion = {
    ...current,
    number: partNumber === 2 ? 6 : 7,
    displayNumber: partNumber === 2 ? 6 : 7,
    type: 'long-writing',
    options: partNumber === 3 ? options : [],
    correctOptionIds: [],
    acceptedAnswers: [],
    points: 10,
    minWords: current.minWords || fallback.minWords,
    maxWords: Math.max(current.minWords || fallback.minWords || 1, current.maxWords || fallback.maxWords || 1),
    rubric: current.rubric || DEFAULT_WRITING_RUBRIC,
    writingGrading: {
      enabled: true,
      providerId: current.writingGrading?.providerId || fallback.writingGrading!.providerId,
      taskContext: current.writingGrading?.taskContext || current.context || fallback.writingGrading!.taskContext,
      gradingInstructions: current.writingGrading?.gradingInstructions || defaultInstructions,
      scoreScale: 10,
    },
  };
  return {
    ...part,
    part: partNumber,
    ...(partNumber === 2 ? { passage: part.passage || part.blocks?.[0]?.passage || fallbackPart.passage } : {}),
    interaction: descriptor(partNumber),
    questions: [question],
    blocks: undefined,
    readingScenes: undefined,
  };
}

export function isFixedPetWritingContent(content: ExamPaperContent) {
  return content.moduleId === 'pet' && content.paperId === 'writing' && content.templateVersion === PET_WRITING_TEMPLATE_VERSION;
}

/** Only the explicitly versioned PET Writing template is normalized. Legacy two-Part sets remain untouched. */
export function normalizeFixedPetWritingContent(content: ExamPaperContent): ExamPaperContent {
  if (!isFixedPetWritingContent(content)) return content;
  const current = Array.from({ length: 3 }, (_, index) => content.parts[index] || defaultPart(index + 1));
  const parts = [normalizeSentencePart(current[0]), normalizeWritingPart(current[1], 2), normalizeWritingPart(current[2], 3)];
  const next: ExamPaperContent = {
    ...content,
    schemaVersion: EXAM_CONTENT_SCHEMA_VERSION,
    structureMode: 'definition',
    templateVersion: PET_WRITING_TEMPLATE_VERSION,
    parts,
  };
  return JSON.stringify(next) === JSON.stringify(content) ? content : next;
}
