import type {
  ExamInteractionDescriptor,
  ExamDisplayExample,
  ExamOption,
  ExamPaperContent,
  ExamPartContent,
  ExamQuestion,
} from './types';
import { EXAM_CONTENT_SCHEMA_VERSION } from './types';

export const PET_READING_TEMPLATE_VERSION = 'pet-reading-5-v1';
export const PET_READING_DEFAULT_COUNTS = [5, 5, 10, 5, 10] as const;
export const PET_READING_VARIANTS = [
  'notice-image-choice',
  'people-text-matching',
  'image-yes-no',
  'passage-four-choice',
  'multiple-choice-cloze-four',
] as const;

export const PET_READING_PART_HEADERS = [
  {
    title: 'Questions 1–5',
    instruction: 'Look at the text in each question. What does it say? Mark the correct letter A, B or C on your answer sheet.',
  },
  {
    title: 'Questions 6–10',
    instruction: 'The young people below all want to do an art course during their school holidays. On the opposite page there are descriptions of eight short art courses. Decide which course would be the most suitable for the following people. For questions 6–10, mark the correct letter (A–H) on your answer sheet.',
  },
  {
    title: 'Questions 11–20',
    instruction: 'Look at the sentences below about a family trip to see dolphins. Read the text on the opposite page to decide if each sentence is correct or incorrect. If it is correct, mark A on your answer sheet. If it is not correct, mark B on your answer sheet.',
  },
  {
    title: 'Questions 21–25',
    instruction: 'Read the text and questions below. For each question, mark the correct letter A, B, C or D on your answer sheet.',
  },
  {
    title: 'Questions 26–35',
    instruction: 'Read the text below and choose the correct word for each space. For each question, mark the correct letter A, B, C or D on your answer sheet.',
  },
] as const;

const makeId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const normalized = (value: unknown) => String(value ?? '').trim().normalize('NFKC').toLocaleLowerCase('en');

export function createDefaultPetReadingExample(part: 1 | 5): ExamDisplayExample {
  if (part === 1) {
    return {
      prompt: 'LOST FLOPPY DISC\nLost on Tuesday – contains important schoolwork.\nHand in to office.',
      options: [
        { label: 'A', text: 'Go to the office if you have lost a floppy disc.' },
        { label: 'B', text: 'Make sure all schoolwork is given in on floppy disc to the office.' },
        { label: 'C', text: 'If you have found a floppy disc, please leave it at the office.' },
      ],
      answer: 'B',
    };
  }
  return {
    prompt: '0',
    options: [
      { label: 'A', text: 'which' },
      { label: 'B', text: 'where' },
      { label: 'C', text: 'who' },
      { label: 'D', text: 'what' },
    ],
    answer: 'A',
  };
}

function normalizeExample(part: 1 | 5, example?: ExamDisplayExample): ExamDisplayExample {
  const fallback = createDefaultPetReadingExample(part);
  const count = part === 1 ? 3 : 4;
  const options = Array.from({ length: count }, (_, index) => {
    const label = String.fromCharCode(65 + index);
    const existing = example?.options?.find(option => normalized(option.label) === normalized(label)) || example?.options?.[index];
    return { label, text: existing?.text?.trim() || fallback.options?.[index]?.text || `Option ${label}` };
  });
  const requestedAnswer = String(example?.answer || '').trim();
  const answerIndex = options.findIndex(option => normalized(option.label) === normalized(requestedAnswer) || normalized(option.text) === normalized(requestedAnswer));
  return {
    ...example,
    prompt: example?.prompt?.trim() || fallback.prompt,
    options,
    answer: answerIndex >= 0 ? options[answerIndex].label : fallback.answer,
  };
}

function descriptor(part: number): ExamInteractionDescriptor {
  if (part === 1) return { family: 'choice', subtype: 'single', variant: PET_READING_VARIANTS[0], schemaVersion: 1, importReadiness: 'content-ready' };
  if (part === 2) return { family: 'choice', subtype: 'letter-matching', variant: PET_READING_VARIANTS[1], schemaVersion: 1, importReadiness: 'content-ready' };
  if (part === 3) return { family: 'choice', subtype: 'single', variant: PET_READING_VARIANTS[2], schemaVersion: 1, importReadiness: 'needs-assets' };
  if (part === 4) return { family: 'choice', subtype: 'single', variant: PET_READING_VARIANTS[3], schemaVersion: 1, importReadiness: 'content-ready' };
  return { family: 'choice', subtype: 'cloze', variant: PET_READING_VARIANTS[4], schemaVersion: 1, importReadiness: 'content-ready' };
}

function defaultChoiceTexts(part: number) {
  if (part === 2) return Array.from({ length: 8 }, (_, index) => `Choice ${String.fromCharCode(65 + index)}`);
  if (part === 3) return ['Yes', 'No'];
  if (part === 1) return ['Option A', 'Option B', 'Option C'];
  return ['Option A', 'Option B', 'Option C', 'Option D'];
}

function placeholderQuestion(part: number, number: number): ExamQuestion {
  const options = defaultChoiceTexts(part).map((text, index) => ({
    id: makeId(`pet-reading-p${part}-option`),
    label: part === 3 ? text.toUpperCase() : String.fromCharCode(65 + index),
    text,
  }));
  return {
    id: makeId(`pet-reading-p${part}-question`),
    number,
    displayNumber: number,
    type: part === 3 ? 'true-false' : 'single-choice',
    prompt: part === 2 ? `Person ${number}` : part === 3 ? `Statement ${number}` : `Question ${number}`,
    ...(part === 1 ? { context: `NOTICE ${number}\nEnter the notice or short message here.` } : {}),
    options,
    correctOptionIds: [],
    acceptedAnswers: [],
    points: 1,
  };
}

function selectedIndex(question: ExamQuestion) {
  const selectedId = question.correctOptionIds[0];
  if (!selectedId) return -1;
  return question.options.findIndex(option => option.id === selectedId);
}

function normalizeChoiceQuestion(part: number, question: ExamQuestion, number: number, sharedTexts?: string[]): ExamQuestion {
  const texts = sharedTexts || defaultChoiceTexts(part);
  const currentSelectedIndex = selectedIndex(question);
  const selected = currentSelectedIndex >= 0 ? question.options[currentSelectedIndex] : undefined;
  const options: ExamOption[] = texts.map((fallbackText, index) => {
    const label = part === 3 ? fallbackText.toUpperCase() : String.fromCharCode(65 + index);
    const existing = question.options.find(option => normalized(option.label) === normalized(label)) || question.options[index];
    return {
      id: existing?.id || makeId(`pet-reading-p${part}-option`),
      label,
      text: part === 3 ? fallbackText : sharedTexts ? fallbackText : (existing?.text || fallbackText),
      ...(existing?.imageAssetId ? { imageAssetId: existing.imageAssetId } : {}),
      ...(existing?.imageUrl ? { imageUrl: existing.imageUrl } : {}),
    };
  });
  const selectedOption = selected
    ? options.find(option => normalized(option.label) === normalized(selected.label)) || options[currentSelectedIndex]
    : undefined;
  const displayNumber = Number.isInteger(question.displayNumber) && Number(question.displayNumber) > 0
    ? Number(question.displayNumber)
    : Number.isInteger(question.number) && question.number > 0
      ? question.number
      : number;
  return {
    ...question,
    number,
    displayNumber,
    type: part === 3 ? 'true-false' : 'single-choice',
    options,
    correctOptionIds: selectedOption ? [selectedOption.id] : [],
    acceptedAnswers: [],
    points: 1,
  };
}

function normalizePart(part: ExamPartContent, partNumber: number, startNumber: number): ExamPartContent {
  const source = part.blocks?.[0];
  const canonicalHeader = PET_READING_PART_HEADERS[partNumber - 1];
  const sourceExample = partNumber === 1 || partNumber === 5
    ? part.examples?.[0] || source?.examples?.[0] || createDefaultPetReadingExample(partNumber)
    : undefined;
  const rows = part.questions.length
    ? part.questions
    : Array.from({ length: PET_READING_DEFAULT_COUNTS[partNumber - 1] }, (_, index) => placeholderQuestion(partNumber, startNumber + index));
  const sharedTexts = partNumber === 2
    ? Array.from({ length: 8 }, (_, index) => rows[0]?.options[index]?.text || `Choice ${String.fromCharCode(65 + index)}`)
    : undefined;
  const questions = rows.map((question, index) => normalizeChoiceQuestion(partNumber, question, startNumber + index, sharedTexts));
  const next: ExamPartContent = {
    ...part,
    part: partNumber,
    title: canonicalHeader.title,
    instruction: canonicalHeader.instruction,
    interaction: descriptor(partNumber),
    questions,
    ...(part.passage || source?.passage ? { passage: part.passage || source?.passage } : {}),
    ...((partNumber === 1 || partNumber === 5) && sourceExample
      ? { examples: [normalizeExample(partNumber, sourceExample)] }
      : {}),
  };
  delete next.blocks;
  delete next.readingScenes;
  if ((partNumber !== 1 && partNumber !== 5) || !sourceExample) delete next.examples;
  if (partNumber === 5 && !next.passage) {
    next.passage = questions.map((question, index) => `[[${question.displayNumber || startNumber + index}]]`).join(' ');
  }
  if (partNumber !== 4 && partNumber !== 5) delete next.passage;
  if (partNumber !== 3) {
    delete next.imageAssetId;
    delete next.imageUrl;
  }
  return next;
}

export function isFixedPetReadingContent(content: ExamPaperContent) {
  return content.moduleId === 'pet'
    && content.paperId === 'reading'
    && content.templateVersion === PET_READING_TEMPLATE_VERSION;
}

/** Normalizes only explicitly-versioned PET Reading papers. Legacy six-Part PET papers remain untouched. */
export function normalizeFixedPetReadingContent(content: ExamPaperContent): ExamPaperContent {
  if (!isFixedPetReadingContent(content)) return content;
  let nextNumber = 1;
  const parts = Array.from({ length: 5 }, (_, index) => {
    const current = content.parts[index] || {
      id: makeId('pet-reading-part'),
      part: index + 1,
      title: PET_READING_PART_HEADERS[index].title,
      instruction: PET_READING_PART_HEADERS[index].instruction,
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
    templateVersion: PET_READING_TEMPLATE_VERSION,
    parts,
  };
  return JSON.stringify(normalizedContent) === JSON.stringify(content) ? content : normalizedContent;
}
