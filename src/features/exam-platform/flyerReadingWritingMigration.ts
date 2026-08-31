import type {
  ExamInteractionDescriptor,
  ExamOption,
  ExamPaperContent,
  ExamPartContent,
  ExamQuestion,
} from './types';
import { EXAM_CONTENT_SCHEMA_VERSION } from './types';

/** Default rows for a newly-created paper. Imported papers keep their printed count. */
export const FLYER_READING_WRITING_DEFAULT_COUNTS = [10, 7, 5, 6, 7, 10, 5] as const;
export const FLYER_READING_WRITING_VARIANTS = [
  'inline-definitions',
  'yes-no',
  'two-image-letter-input',
  'story-gaps-title',
  'story-sentence-completion',
  'multiple-choice-cloze',
  'open-cloze',
] as const;

const makeId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const normalized = (value: unknown) => String(value ?? '').trim().normalize('NFKC').toLocaleLowerCase('en');

function descriptor(part: number): ExamInteractionDescriptor {
  if (part === 2) return { family: 'choice', subtype: 'single', variant: 'yes-no', schemaVersion: 1, importReadiness: 'needs-assets' };
  if (part === 3) return { family: 'text-entry', subtype: 'letter-matching', variant: 'two-image-letter-input', schemaVersion: 1, importReadiness: 'needs-assets' };
  if (part === 4) return { family: 'text-entry', subtype: 'short-answer-and-title', variant: 'story-gaps-title', schemaVersion: 1, importReadiness: 'needs-assets' };
  if (part === 5) return { family: 'text-entry', subtype: 'story-sentence-completion', variant: 'story-sentence-completion', schemaVersion: 1, importReadiness: 'needs-assets' };
  if (part === 6) return { family: 'choice', subtype: 'cloze', variant: 'multiple-choice-cloze', schemaVersion: 1, importReadiness: 'content-ready' };
  if (part === 7) return { family: 'text-entry', subtype: 'open-cloze', variant: 'open-cloze', schemaVersion: 1, importReadiness: 'content-ready' };
  return { family: 'text-entry', subtype: 'short-answer', variant: 'inline-definitions', schemaVersion: 1, importReadiness: 'needs-assets' };
}

function remapChoiceOptions(question: ExamQuestion, labels: string[]): { options: ExamOption[]; correctOptionIds: string[] } {
  const selected = question.options.find(option => question.correctOptionIds.includes(option.id));
  const options = labels.map((text, index) => {
    const existing = question.options.find(option => normalized(option.label) === normalized(text) || normalized(option.text) === normalized(text))
      || question.options[index];
    return {
      id: existing?.id || makeId('flyer-rw-option'),
      label: labels.length === 2 ? text.toUpperCase() : String.fromCharCode(65 + index),
      text,
      ...(existing?.imageAssetId ? { imageAssetId: existing.imageAssetId } : {}),
      ...(existing?.imageUrl ? { imageUrl: existing.imageUrl } : {}),
    };
  });
  const selectedOption = selected
    ? options.find(option => normalized(option.label) === normalized(selected.label) || normalized(option.text) === normalized(selected.text))
    : undefined;
  return { options, correctOptionIds: selectedOption ? [selectedOption.id] : [] };
}

function placeholderQuestion(number: number): ExamQuestion {
  return {
    id: makeId('flyer-rw-question'),
    number,
    type: 'short-answer',
    prompt: `Question ${number}: ____`,
    options: [],
    correctOptionIds: [],
    acceptedAnswers: [],
    points: 1,
  };
}

function normalizedQuestions(part: number, source: ExamQuestion[], startNumber: number) {
  const rows = source.length
    ? source
    : Array.from({ length: FLYER_READING_WRITING_DEFAULT_COUNTS[part - 1] }, (_, index) => placeholderQuestion(startNumber + index));
  return rows.map((sourceQuestion, index) => {
    const current = sourceQuestion || placeholderQuestion(startNumber + index);
    const base = { ...current, number: startNumber + index, points: Number(current.points) > 0 ? current.points : 1 };
    if (part === 2) {
      const choice = remapChoiceOptions(base, ['Yes', 'No']);
      return { ...base, type: 'true-false' as const, ...choice, acceptedAnswers: [] };
    }
    if (part === 3) {
      return { ...base, type: 'short-answer' as const, options: [], correctOptionIds: [], maxWords: 1 };
    }
    if (part === 4 && index === rows.length - 1) {
      const labels = base.options.length >= 3 ? base.options.slice(0, 3).map(option => option.text || option.label) : ['Title A', 'Title B', 'Title C'];
      const choice = remapChoiceOptions(base, labels);
      return { ...base, type: 'single-choice' as const, prompt: base.prompt || 'Choose the best title.', ...choice, acceptedAnswers: [] };
    }
    if (part === 6) {
      const labels = base.options.length >= 3 ? base.options.slice(0, 3).map(option => option.text || option.label) : ['A', 'B', 'C'];
      const choice = remapChoiceOptions(base, labels);
      return { ...base, type: 'single-choice' as const, ...choice, acceptedAnswers: [] };
    }
    const maxWords = part === 5 ? (base.maxWords || 4) : part === 7 ? 1 : (base.maxWords || 3);
    return { ...base, type: 'short-answer' as const, options: [], correctOptionIds: [], maxWords };
  });
}

function normalizeExamples(examples: ExamPartContent['examples'], count: number) {
  return Array.from({ length: count }, (_, index) => examples?.[index] || { prompt: '', answer: '' });
}

function normalizePart(part: ExamPartContent, partNumber: number, startNumber: number): ExamPartContent {
  const unit = part.blocks?.[0];
  const source = unit || part;
  const questions = normalizedQuestions(partNumber, part.questions, startNumber);
  const examples = source.examples || part.examples;
  const readingScenes = source.readingScenes || part.readingScenes;
  const passage = source.passage ?? part.passage;
  const { blocks: _blocks, ...withoutBlocks } = part;
  const next: ExamPartContent = {
    ...withoutBlocks,
    part: partNumber,
    title: source.title || part.title || `Part ${partNumber}`,
    instruction: source.instruction || part.instruction,
    interaction: descriptor(partNumber),
    questions,
    ...(passage ? { passage } : {}),
    ...(part.imageAssetId || source.imageAssetId ? { imageAssetId: part.imageAssetId || source.imageAssetId, imageUrl: part.imageUrl || source.imageUrl } : {}),
    ...(examples?.length ? { examples } : {}),
    ...(partNumber === 3 && readingScenes?.length ? { readingScenes: readingScenes.map(scene => ({ ...scene, questionIds: questions.map(question => question.id) })) } : {}),
  };
  if ([1, 4, 6, 7].includes(partNumber)) next.examples = normalizeExamples(next.examples, 1);
  if ([2, 5].includes(partNumber)) next.examples = normalizeExamples(next.examples, 2);
  if (partNumber === 3) {
    next.examples = normalizeExamples(next.examples, 1);
    next.readingScenes = next.readingScenes?.slice(0, 1).length
      ? next.readingScenes.slice(0, 1).map(scene => ({ ...scene, questionIds: questions.map(question => question.id) }))
      : [{ id: makeId('flyer-rw-p3-middle'), passage: '', questionIds: questions.map(question => question.id) }];
  }
  if (partNumber === 4) {
    const gapCount = Math.max(1, questions.length - 1);
    next.passage = next.passage || Array.from({ length: gapCount }, (_, index) => `[[${index + 1}]]`).join(' ');
  }
  if (partNumber === 5) {
    delete next.passage;
  }
  if (partNumber === 6) {
    delete next.passage;
    delete next.readingScenes;
  }
  if (partNumber === 7) {
    next.passage = next.passage || Array.from({ length: questions.length }, (_, index) => `[[${index + 1}]]`).join(' ');
  }
  return next;
}

/** Upgrades released/generic drafts into seven fixed Part types without fixing their row counts. */
export function normalizeFixedFlyerReadingWritingContent(content: ExamPaperContent): ExamPaperContent {
  if (content.moduleId !== 'flyer' || content.paperId !== 'reading-writing') return content;
  let nextNumber = 1;
  const parts = Array.from({ length: 7 }, (_, index) => {
    const current = content.parts[index] || {
      id: makeId('flyer-rw-part'),
      part: index + 1,
      title: `Part ${index + 1}`,
      instruction: '',
      questions: [],
    };
    const next = normalizePart(current, index + 1, nextNumber);
    nextNumber += next.questions.length;
    return next;
  });
  const normalizedContent: ExamPaperContent = { ...content, schemaVersion: EXAM_CONTENT_SCHEMA_VERSION, structureMode: 'definition', parts };
  return JSON.stringify(normalizedContent) === JSON.stringify(content) ? content : normalizedContent;
}
