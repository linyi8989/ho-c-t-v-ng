import type {
  ExamInteractionDescriptor,
  ExamOption,
  ExamPaperContent,
  ExamPartContent,
  ExamQuestion,
  ExamQuestionImageLayout,
} from './types';
import { EXAM_CONTENT_SCHEMA_VERSION } from './types';

export const KET_LISTENING_TEMPLATE_VERSION = 'ket-listening-5-v1';
export const KET_LISTENING_DEFAULT_COUNTS = [5, 5, 5, 5, 5] as const;
export const KET_LISTENING_VARIANTS = [
  'image-options',
  'two-image-letter-input',
  'dialogue-choice',
  'image-form-fields',
  'image-form-fields',
] as const;

const makeId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const normalized = (value: unknown) => String(value ?? '').trim().normalize('NFKC').toLocaleLowerCase('en');

/** Legacy layouts are inferred from stored media, never from a fixed question number. */
export function getKetListeningImageLayout(question: Pick<ExamQuestion, 'imageLayout' | 'imageAssetId' | 'imageUrl' | 'options'>): ExamQuestionImageLayout {
  if (question.imageLayout?.kind === 'shared') return { kind: 'shared' };
  if (question.imageLayout?.kind === 'options') {
    const labels = Array.isArray(question.imageLayout.optionLabels)
      ? question.imageLayout.optionLabels.filter((label: unknown): label is string => typeof label === 'string').map(label => label.trim().toUpperCase()).filter(label => /^[ABC]$/.test(label))
      : undefined;
    return { kind: 'options', optionLabels: labels?.length ? ['A', 'B', 'C'].filter(label => labels.includes(label)) : ['A', 'B', 'C'] };
  }
  if (question.imageAssetId || question.imageUrl) return { kind: 'shared' };
  const optionLabels = question.options.flatMap((option, index) => {
    const label = String(option.label || String.fromCharCode(65 + index)).trim().toUpperCase();
    return (option.imageAssetId || option.imageUrl) && /^[ABC]$/.test(label) ? [label] : [];
  });
  if (optionLabels.length) return { kind: 'options', optionLabels: [...new Set(optionLabels)] };
  return { kind: 'options', optionLabels: ['A', 'B', 'C'] };
}

function descriptor(part: number): ExamInteractionDescriptor {
  if (part === 1) return { family: 'choice', subtype: 'single', variant: 'image-options', schemaVersion: 1, importReadiness: 'needs-assets' };
  if (part === 2) return { family: 'text-entry', subtype: 'letter-matching', variant: 'two-image-letter-input', schemaVersion: 1, importReadiness: 'needs-assets' };
  if (part === 3) return { family: 'choice', subtype: 'dialogue', variant: 'dialogue-choice', schemaVersion: 1, importReadiness: 'content-ready' };
  return { family: 'text-entry', subtype: 'form-completion', variant: 'image-form-fields', schemaVersion: 1, importReadiness: 'content-ready' };
}

function threeOptions(question?: ExamQuestion): ExamOption[] {
  return ['A', 'B', 'C'].map((label, index) => {
    const existing = question?.options.find(option => normalized(option.label) === normalized(label))
      || (question?.options[index] && !question.options[index].label ? question.options[index] : undefined);
    return {
      id: existing?.id || makeId('ket-listening-option'),
      label,
      text: existing?.text || `Option ${label}`,
      ...(existing?.imageAssetId ? { imageAssetId: existing.imageAssetId } : {}),
      ...(existing?.imageUrl ? { imageUrl: existing.imageUrl } : {}),
    };
  });
}

function placeholderQuestion(part: number, number: number): ExamQuestion {
  const displayNumber = number;
  if (part === 1 || part === 3) {
    return {
      id: makeId('ket-listening-question'),
      number,
      displayNumber,
      type: 'single-choice',
      prompt: part === 1 ? `Picture question ${displayNumber}` : `Dialogue question ${displayNumber}`,
      options: threeOptions(),
      correctOptionIds: [],
      acceptedAnswers: [],
      points: 1,
    };
  }
  return {
    id: makeId('ket-listening-question'),
    number,
    displayNumber,
    type: 'short-answer',
    prompt: part === 2 ? `Row ${displayNumber}` : `Field ${displayNumber}`,
    options: [],
    correctOptionIds: [],
    acceptedAnswers: [],
    points: 1,
    maxWords: part === 2 ? 1 : 5,
  };
}

function normalizeChoice(question: ExamQuestion, number: number, displayNumber: number): ExamQuestion {
  const selected = question.options.find(option => question.correctOptionIds.includes(option.id));
  const options = threeOptions(question);
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

function normalizeQuestion(part: number, question: ExamQuestion, number: number, index: number): ExamQuestion {
  const displayNumber = Number.isInteger(question.displayNumber) && Number(question.displayNumber) > 0
    ? Number(question.displayNumber)
    : index + 1;
  if (part === 1 || part === 3) return normalizeChoice(question, number, displayNumber);
  if (part === 2) {
    return {
      ...question,
      number,
      displayNumber,
      type: 'short-answer',
      options: [],
      correctOptionIds: [],
      acceptedAnswers: question.acceptedAnswers.map(answer => answer.toUpperCase()).filter(answer => /^[A-H]$/.test(answer)).slice(0, 30),
      points: 1,
      maxWords: 1,
    };
  }
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

function examplesFor(part: number, partExamples: ExamPartContent['examples'], unitExamples: ExamPartContent['examples']) {
  if (part > 3) return undefined;
  const examples = partExamples?.length ? partExamples : unitExamples;
  return examples?.length ? examples.slice(0, 1) : [{ prompt: 'Printed example', answer: '' }];
}

function normalizePart(part: ExamPartContent, partNumber: number, startNumber: number): ExamPartContent {
  const unit = part.blocks?.[0];
  const sourceQuestions = part.questions.length
    ? part.questions
    : Array.from({ length: KET_LISTENING_DEFAULT_COUNTS[partNumber - 1] }, (_, index) => placeholderQuestion(partNumber, startNumber + index));
  const questions = sourceQuestions.map((question, index) => normalizeQuestion(partNumber, question, startNumber + index, index));
  const importedExamples = examplesFor(partNumber, part.examples, unit?.examples);
  const importedPassage = part.passage || unit?.passage;
  const importedScenes = part.readingScenes?.length ? part.readingScenes : unit?.readingScenes;
  const next: ExamPartContent = {
    ...part,
    part: partNumber,
    title: part.title || `Part ${partNumber}`,
    instruction: part.instruction || '',
    interaction: descriptor(partNumber),
    questions,
    blocks: undefined,
    ...(importedExamples ? { examples: importedExamples } : { examples: undefined }),
    ...(importedPassage ? { passage: importedPassage } : { passage: undefined }),
  };
  if (partNumber === 2) {
    next.readingScenes = importedScenes?.slice(0, 1).map(scene => ({ ...scene, questionIds: questions.map(question => question.id) }))
      || [{ id: makeId('ket-listening-p2-middle'), passage: '', questionIds: questions.map(question => question.id) }];
  } else {
    next.readingScenes = undefined;
  }
  return next;
}

export function isFixedKetListeningContent(content: ExamPaperContent) {
  return content.moduleId === 'ket'
    && content.paperId === 'listening'
    && content.templateVersion === KET_LISTENING_TEMPLATE_VERSION;
}

/** Normalizes only the explicitly versioned five-Part KET Listening paper. Legacy papers stay untouched. */
export function normalizeFixedKetListeningContent(content: ExamPaperContent): ExamPaperContent {
  if (!isFixedKetListeningContent(content)) return content;
  let nextNumber = 1;
  const parts = Array.from({ length: 5 }, (_, index) => {
    const current = content.parts[index] || {
      id: makeId('ket-listening-part'),
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
    templateVersion: KET_LISTENING_TEMPLATE_VERSION,
    parts,
  };
  return JSON.stringify(normalizedContent) === JSON.stringify(content) ? content : normalizedContent;
}
