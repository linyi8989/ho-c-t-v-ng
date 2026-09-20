import type {
  ExamInteractionDescriptor,
  ExamOption,
  ExamPaperContent,
  ExamPartContent,
  ExamQuestion,
} from './types';
import { EXAM_CONTENT_SCHEMA_VERSION } from './types';

export const PET_LISTENING_TEMPLATE_VERSION = 'pet-listening-4-v1';
export const PET_LISTENING_DEFAULT_COUNTS = [7, 6, 6, 6] as const;
export const PET_LISTENING_VARIANTS = [
  'image-options',
  'dialogue-choice',
  'image-form-fields',
  'yes-no-statements',
] as const;

const makeId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const normalized = (value: unknown) => String(value ?? '').trim().normalize('NFKC').toLocaleLowerCase('en');

function descriptor(part: number): ExamInteractionDescriptor {
  if (part === 1) return { family: 'choice', subtype: 'single', variant: 'image-options', schemaVersion: 1, importReadiness: 'needs-assets' };
  if (part === 2) return { family: 'choice', subtype: 'dialogue', variant: 'dialogue-choice', schemaVersion: 1, importReadiness: 'content-ready' };
  if (part === 3) return { family: 'text-entry', subtype: 'form-completion', variant: 'image-form-fields', schemaVersion: 1, importReadiness: 'content-ready' };
  return { family: 'choice', subtype: 'binary', variant: 'yes-no-statements', schemaVersion: 1, importReadiness: 'content-ready' };
}

function choiceOptions(question?: ExamQuestion): ExamOption[] {
  return ['A', 'B', 'C'].map((label, index) => {
    const existing = question?.options[index];
    return {
      id: existing?.id || makeId('pet-listening-option'),
      label,
      text: existing?.text || `Option ${label}`,
      ...(existing?.imageAssetId ? { imageAssetId: existing.imageAssetId } : {}),
      ...(existing?.imageUrl ? { imageUrl: existing.imageUrl } : {}),
    };
  });
}

function yesNoOptions(question?: ExamQuestion): ExamOption[] {
  return ['Yes', 'No'].map((text, index) => {
    const existing = question?.options[index];
    return {
      id: existing?.id || makeId('pet-listening-option'),
      label: text,
      text,
    };
  });
}

function placeholderQuestion(part: number, number: number): ExamQuestion {
  if (part === 1 || part === 2 || part === 4) {
    const options = part === 4 ? yesNoOptions() : choiceOptions();
    return {
      id: makeId('pet-listening-question'),
      number,
      displayNumber: number,
      type: 'single-choice',
      prompt: part === 1 ? `Picture question ${number}` : part === 2 ? `Question ${number}` : `Statement ${number}`,
      options,
      correctOptionIds: [],
      acceptedAnswers: [],
      points: 1,
    };
  }
  return {
    id: makeId('pet-listening-question'),
    number,
    displayNumber: number,
    type: 'short-answer',
    prompt: `Field ${number}`,
    options: [],
    correctOptionIds: [],
    acceptedAnswers: [],
    points: 1,
    maxWords: 5,
  };
}

function normalizeChoice(question: ExamQuestion, number: number, displayNumber: number, binary = false): ExamQuestion {
  const selected = question.options.find(option => question.correctOptionIds.includes(option.id));
  const options = binary ? yesNoOptions(question) : choiceOptions(question);
  const selectedOption = selected
    ? options.find(option => normalized(option.label) === normalized(selected.label) || normalized(option.text) === normalized(selected.text))
    : undefined;
  return {
    ...question,
    number,
    displayNumber,
    type: 'single-choice',
    options,
    correctOptionIds: selectedOption ? [selectedOption.id] : [],
    acceptedAnswers: [],
    points: 1,
  };
}

function normalizeQuestion(part: number, question: ExamQuestion, number: number): ExamQuestion {
  const displayNumber = Number.isInteger(question.displayNumber) && Number(question.displayNumber) > 0
    ? Number(question.displayNumber)
    : number;
  if (part === 1 || part === 2) return normalizeChoice(question, number, displayNumber);
  if (part === 4) return normalizeChoice(question, number, displayNumber, true);
  return {
    ...question,
    number,
    displayNumber,
    type: 'short-answer',
    options: [],
    correctOptionIds: [],
    points: 1,
    maxWords: Math.max(1, Math.min(20, Number(question.maxWords) || 5)),
    answerPrefix: question.answerPrefix || '',
    answerSuffix: question.answerSuffix || '',
  };
}

function normalizePart(part: ExamPartContent, partNumber: number, startNumber: number): ExamPartContent {
  const unit = part.blocks?.[0];
  const sourceQuestions = part.questions.length
    ? part.questions
    : Array.from({ length: PET_LISTENING_DEFAULT_COUNTS[partNumber - 1] }, (_, index) => placeholderQuestion(partNumber, startNumber + index));
  const questions = sourceQuestions.map((question, index) => normalizeQuestion(partNumber, question, startNumber + index));
  const importedPassage = part.passage || unit?.passage;
  const sourceExamples = part.examples?.length ? part.examples : unit?.examples;
  const examples = partNumber === 1
    ? (sourceExamples?.length ? sourceExamples.slice(0, 1) : [{ prompt: 'Example', answer: '' }])
    : undefined;
  return {
    ...part,
    part: partNumber,
    title: part.title || `Part ${partNumber}`,
    instruction: part.instruction || '',
    interaction: descriptor(partNumber),
    questions,
    blocks: undefined,
    ...(examples ? { examples } : { examples: undefined }),
    ...(importedPassage ? { passage: importedPassage } : { passage: undefined }),
    readingScenes: undefined,
  };
}

export function isFixedPetListeningContent(content: ExamPaperContent) {
  return content.moduleId === 'pet'
    && content.paperId === 'listening'
    && content.templateVersion === PET_LISTENING_TEMPLATE_VERSION;
}

/** Normalizes only explicitly versioned PET Listening content. Released legacy papers remain unchanged. */
export function normalizeFixedPetListeningContent(content: ExamPaperContent): ExamPaperContent {
  if (!isFixedPetListeningContent(content)) return content;
  let nextNumber = 1;
  const parts = Array.from({ length: 4 }, (_, index) => {
    const current = content.parts[index] || {
      id: makeId('pet-listening-part'),
      part: index + 1,
      title: `Part ${index + 1}`,
      instruction: '',
      questions: [],
    };
    const next = normalizePart(current, index + 1, nextNumber);
    nextNumber += next.questions.length;
    return next;
  });
  const normalizedContent: ExamPaperContent = {
    ...content,
    schemaVersion: EXAM_CONTENT_SCHEMA_VERSION,
    structureMode: 'definition',
    templateVersion: PET_LISTENING_TEMPLATE_VERSION,
    parts,
  };
  return JSON.stringify(normalizedContent) === JSON.stringify(content) ? content : normalizedContent;
}
