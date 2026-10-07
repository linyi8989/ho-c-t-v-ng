import type {
  ExamInteractionDescriptor,
  ExamOption,
  ExamPaperContent,
  ExamPartContent,
  ExamQuestion,
} from './types';
import { EXAM_CONTENT_SCHEMA_VERSION } from './types';

export const FCE_READING_TEMPLATE_VERSION = 'fce-reading-3-v1';
export const FCE_READING_DEFAULT_COUNTS = [8, 7, 15] as const;
export const FCE_READING_VARIANTS = [
  'passage-four-choice',
  'gapped-text-letter-entry',
  'multiple-matching-letter-entry',
] as const;

export const FCE_READING_PART_HEADERS = [
  {
    title: 'Part 1',
    instruction: 'You are going to read an article. For questions 1–8, choose the answer (A, B, C or D) which you think fits best according to the text.',
  },
  {
    title: 'Part 2',
    instruction: 'You are going to read an article from which seven sentences have been removed. Choose from the sentences A–H the one which fits each gap (9–15). There is one extra sentence which you do not need to use.',
  },
  {
    title: 'Part 3',
    instruction: 'You are going to read a text in which four people talk about a topic. For questions 16–30, choose from the people (A–D). The people may be chosen more than once.',
  },
] as const;

const makeId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const normalized = (value: unknown) => String(value ?? '').trim().normalize('NFKC').toLocaleLowerCase('en');

function descriptor(part: number): ExamInteractionDescriptor {
  if (part === 1) return { family: 'choice', subtype: 'single', variant: FCE_READING_VARIANTS[0], schemaVersion: 1, importReadiness: 'content-ready' };
  if (part === 2) return { family: 'text-entry', subtype: 'letter', variant: FCE_READING_VARIANTS[1], schemaVersion: 1, importReadiness: 'content-ready' };
  return { family: 'text-entry', subtype: 'letter', variant: FCE_READING_VARIANTS[2], schemaVersion: 1, importReadiness: 'needs-assets' };
}

function defaultChoiceTexts(part: number) {
  if (part === 2) return Array.from({ length: 8 }, (_, index) => `Sentence ${String.fromCharCode(65 + index)}`);
  if (part === 3) return Array.from({ length: 4 }, (_, index) => `Person ${String.fromCharCode(65 + index)}`);
  return Array.from({ length: 4 }, (_, index) => `Option ${String.fromCharCode(65 + index)}`);
}

function placeholderQuestion(part: number, number: number): ExamQuestion {
  const options = defaultChoiceTexts(part).map((text, index) => ({
    id: makeId(`fce-reading-p${part}-option`),
    label: String.fromCharCode(65 + index),
    text,
  }));
  return {
    id: makeId(`fce-reading-p${part}-question`),
    number,
    displayNumber: number,
    type: 'single-choice',
    prompt: part === 2 ? `Gap ${number}` : part === 3 ? `Statement ${number}` : `Question ${number}`,
    options,
    correctOptionIds: [],
    acceptedAnswers: [],
    points: 1,
  };
}

function selectedOption(question: ExamQuestion) {
  const selectedId = question.correctOptionIds[0];
  return selectedId ? question.options.find(option => option.id === selectedId) : undefined;
}

function normalizeQuestion(partNumber: number, question: ExamQuestion, number: number, sharedTexts?: string[]): ExamQuestion {
  const selected = selectedOption(question);
  const texts = sharedTexts || defaultChoiceTexts(partNumber);
  const options: ExamOption[] = texts.map((fallbackText, index) => {
    const label = String.fromCharCode(65 + index);
    const existing = question.options.find(option => normalized(option.label) === normalized(label)) || question.options[index];
    return {
      id: existing?.id || makeId(`fce-reading-p${partNumber}-option`),
      label,
      text: sharedTexts ? fallbackText : (existing?.text?.trim() || fallbackText),
    };
  });
  const selectedIndex = selected
    ? question.options.findIndex(option => option.id === selected.id)
    : -1;
  const nextSelected = selected
    ? options.find(option => normalized(option.label) === normalized(selected.label)) || options[selectedIndex]
    : undefined;
  return {
    ...question,
    number,
    displayNumber: number,
    type: 'single-choice',
    prompt: question.prompt?.trim() || (partNumber === 2 ? `Gap ${number}` : partNumber === 3 ? `Statement ${number}` : `Question ${number}`),
    options,
    correctOptionIds: nextSelected ? [nextSelected.id] : [],
    acceptedAnswers: [],
    points: 1,
  };
}

function normalizePart(part: ExamPartContent, partNumber: number, startNumber: number): ExamPartContent {
  const count = FCE_READING_DEFAULT_COUNTS[partNumber - 1];
  const rows = Array.from({ length: count }, (_, index) => part.questions[index] || placeholderQuestion(partNumber, startNumber + index));
  const sharedTexts = partNumber === 2
    ? Array.from({ length: 8 }, (_, index) => rows[0]?.options[index]?.text?.trim() || `Sentence ${String.fromCharCode(65 + index)}`)
    : partNumber === 3
      ? Array.from({ length: 4 }, (_, index) => rows[0]?.options[index]?.text?.trim() || `Person ${String.fromCharCode(65 + index)}`)
      : undefined;
  const questions = rows.map((question, index) => normalizeQuestion(partNumber, question, startNumber + index, sharedTexts));
  const header = FCE_READING_PART_HEADERS[partNumber - 1];
  const source = part.blocks?.[0];
  const next: ExamPartContent = {
    ...part,
    part: partNumber,
    title: part.title?.trim() || header.title,
    instruction: part.instruction?.trim() || header.instruction,
    interaction: descriptor(partNumber),
    questions,
  };
  delete next.blocks;
  delete next.readingScenes;
  delete next.examples;
  delete next.audioAssetId;
  delete next.audioUrl;
  delete next.audioTranscript;

  if (partNumber === 1 || partNumber === 2) {
    next.passage = part.passage?.trim() || source?.passage?.trim() || (partNumber === 2
      ? questions.map(question => `[[${question.displayNumber}]]`).join('\n\n')
      : 'Enter the complete reading passage here.');
  } else {
    delete next.passage;
  }
  if (partNumber !== 3) {
    delete next.imageAssetId;
    delete next.imageUrl;
  }
  return next;
}

export function isFixedFceReadingContent(content: ExamPaperContent) {
  return content.moduleId === 'fce'
    && content.paperId === 'reading'
    && content.templateVersion === FCE_READING_TEMPLATE_VERSION;
}

/** Normalizes only the new explicit FCE Reading paper. The legacy combined paper stays untouched. */
export function normalizeFixedFceReadingContent(content: ExamPaperContent): ExamPaperContent {
  if (!isFixedFceReadingContent(content)) return content;
  let nextNumber = 1;
  const parts = Array.from({ length: 3 }, (_, index) => {
    const current = content.parts[index] || {
      id: makeId('fce-reading-part'),
      part: index + 1,
      title: FCE_READING_PART_HEADERS[index].title,
      instruction: FCE_READING_PART_HEADERS[index].instruction,
      questions: [],
    };
    const next = normalizePart(current, index + 1, nextNumber);
    nextNumber += FCE_READING_DEFAULT_COUNTS[index];
    return next;
  });
  const normalizedContent: ExamPaperContent = {
    ...content,
    schemaVersion: EXAM_CONTENT_SCHEMA_VERSION,
    structureMode: 'definition',
    templateVersion: FCE_READING_TEMPLATE_VERSION,
    parts,
  };
  return JSON.stringify(normalizedContent) === JSON.stringify(content) ? content : normalizedContent;
}
