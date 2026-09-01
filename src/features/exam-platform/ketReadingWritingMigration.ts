import type {
  ExamInteractionDescriptor,
  ExamOption,
  ExamPaperContent,
  ExamPartBlock,
  ExamPartContent,
  ExamQuestion,
  ExamQuestionType,
} from './types';
import { EXAM_CONTENT_SCHEMA_VERSION } from './types';

export const KET_READING_WRITING_TEMPLATE_VERSION = 'ket-reading-writing-9-v1';
export const KET_READING_WRITING_DEFAULT_COUNTS = [5, 5, 10, 7, 8, 5, 10, 5, 1] as const;
export const KET_READING_WRITING_VARIANTS = [
  'two-image-letter-input',
  'multiple-choice-cloze',
  'compound-choice-and-letter',
  'prompt-choice-rows',
  'multiple-choice-cloze',
  'initial-letter-spelling',
  'image-numbered-gaps',
  'image-form-fields',
  'ai-guided-writing',
] as const;

const makeId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const normalized = (value: unknown) => String(value ?? '').trim().normalize('NFKC').toLocaleLowerCase('en');

function descriptor(part: number): ExamInteractionDescriptor {
  if (part === 1) return { family: 'text-entry', subtype: 'letter-matching', variant: 'two-image-letter-input', schemaVersion: 1, importReadiness: 'needs-assets' };
  if (part === 2) return { family: 'choice', subtype: 'cloze', variant: 'multiple-choice-cloze', schemaVersion: 1, importReadiness: 'content-ready' };
  if (part === 3) return { family: 'choice', subtype: 'compound', variant: 'compound-choice-and-letter', schemaVersion: 1, importReadiness: 'needs-assets' };
  if (part === 4) return { family: 'choice', subtype: 'single', variant: 'prompt-choice-rows', schemaVersion: 1, importReadiness: 'needs-assets' };
  if (part === 6) return { family: 'text-entry', subtype: 'spelling', variant: 'initial-letter-spelling', schemaVersion: 1, importReadiness: 'content-ready' };
  if (part === 7) return { family: 'text-entry', subtype: 'open-cloze', variant: 'image-numbered-gaps', schemaVersion: 1, importReadiness: 'content-ready' };
  if (part === 8) return { family: 'text-entry', subtype: 'form-completion', variant: 'image-form-fields', schemaVersion: 1, importReadiness: 'content-ready' };
  if (part === 9) return { family: 'writing', subtype: 'guided', variant: 'ai-guided-writing', schemaVersion: 1, importReadiness: 'content-ready' };
  return { family: 'choice', subtype: 'cloze', variant: 'multiple-choice-cloze', schemaVersion: 1, importReadiness: 'needs-assets' };
}

function threeOptions(question?: ExamQuestion): ExamOption[] {
  return ['A', 'B', 'C'].map((label, index) => {
    const existing = question?.options[index];
    return {
      id: existing?.id || makeId('ket-rw-option'),
      label,
      text: existing?.text || `Option ${label}`,
    };
  });
}

function remapChoice(question: ExamQuestion): ExamQuestion {
  const selected = question.options.find(option => question.correctOptionIds.includes(option.id));
  const options = threeOptions(question);
  const selectedOption = selected
    ? options.find(option => normalized(option.label) === normalized(selected.label) || normalized(option.text) === normalized(selected.text))
    : undefined;
  return {
    ...question,
    type: 'single-choice',
    options,
    correctOptionIds: selectedOption ? [selectedOption.id] : [],
    acceptedAnswers: [],
    points: 1,
  };
}

function placeholderQuestion(part: number, number: number): ExamQuestion {
  const displayNumber = number;
  if (part === 9) {
    return {
      id: makeId('ket-rw-writing'),
      number,
      displayNumber,
      type: 'long-writing',
      prompt: 'Write a postcard or short message using every point in the task above.',
      context: 'Read the task text and answer every requested point.',
      options: [],
      correctOptionIds: [],
      acceptedAnswers: [],
      points: 10,
      minWords: 25,
      maxWords: 50,
      rubric: 'Chấm mức độ hoàn thành yêu cầu, số câu, ngữ pháp và từ vựng. Điểm nguyên từ 0 đến 10.',
      writingGrading: {
        enabled: true,
        providerId: 'stali:gpt-5.6-sol',
        taskContext: 'Read the writing task and hints shown above the editor.',
        gradingInstructions: 'Chấm điểm nguyên từ 0 đến 10. Kiểm tra mức độ hoàn thành yêu cầu, số câu, ngữ pháp và từ vựng; chỉ ra lỗi cụ thể và trả về nhận xét ngắn gọn, đầy đủ trong khoảng 4–5 câu.',
        scoreScale: 10,
      },
    };
  }
  const letter = part === 1 || part === 3;
  const choice = [2, 4, 5].includes(part) || (part === 3 && !letter);
  return {
    id: makeId('ket-rw-question'),
    number,
    displayNumber,
    type: choice ? 'single-choice' : 'short-answer',
    prompt: part === 7 ? '' : part === 8 ? `Field ${displayNumber}` : `Question ${displayNumber}`,
    options: choice ? threeOptions() : [],
    correctOptionIds: [],
    acceptedAnswers: [],
    points: 1,
    ...(letter ? { maxWords: 1 } : {}),
    ...(part === 6 ? { answerPrefix: 'a', answerLength: 2, maxWords: 1 } : {}),
    ...(part === 7 || part === 8 ? { maxWords: 3 } : {}),
  };
}

function sourceRows(source: ExamQuestion[], count: number, part: number, startNumber: number) {
  return source.length
    ? source
    : Array.from({ length: count }, (_, index) => placeholderQuestion(part, startNumber + index));
}

function normalizeQuestion(part: number, question: ExamQuestion, number: number, mode?: 'choice' | 'letter'): ExamQuestion {
  const displayNumber = Number.isInteger(question.displayNumber) && Number(question.displayNumber) > 0
    ? Number(question.displayNumber)
    : Number.isInteger(question.number) && question.number > 0
      ? question.number
      : number;
  const base = { ...question, number, displayNumber, points: part === 9 ? 10 : 1 };
  if (mode === 'choice' || [2, 4, 5].includes(part)) return remapChoice(base);
  if (mode === 'letter' || part === 1) {
    return { ...base, type: 'short-answer', options: [], correctOptionIds: [], maxWords: 1, acceptedAnswers: base.acceptedAnswers.map(answer => answer.toUpperCase()).filter(answer => /^[A-H]$/.test(answer)).slice(0, 30) };
  }
  if (part === 6) {
    const official = base.acceptedAnswers.find(Boolean) || '';
    const prefix = String(base.answerPrefix || official.slice(0, 1) || 'a').slice(0, 1);
    const officialStartsWithPrefix = normalized(official).startsWith(normalized(prefix));
    const inferredLength = Array.from(official).length + (officialStartsWithPrefix ? 0 : prefix.length);
    const answerLength = Math.max(prefix.length + 1, Math.min(40, Number(base.answerLength) || inferredLength || prefix.length + 1));
    const acceptedAnswers = base.acceptedAnswers.map(answer => {
      const characters = Array.from(answer);
      return characters.length === answerLength && normalized(characters.slice(0, prefix.length).join('')) === normalized(prefix)
        ? characters.slice(prefix.length).join('')
        : answer;
    });
    return { ...base, type: 'short-answer', options: [], correctOptionIds: [], acceptedAnswers, maxWords: 1, answerPrefix: prefix, answerLength };
  }
  if (part === 7) return { ...base, type: 'short-answer', prompt: '', options: [], correctOptionIds: [], maxWords: 1 };
  if (part === 8) {
    const { answerSuffix: _answerSuffix, ...withoutSuffix } = base;
    return { ...withoutSuffix, type: 'short-answer', options: [], correctOptionIds: [], maxWords: base.maxWords || 5, answerPrefix: base.answerPrefix || '' };
  }
  if (part === 9) {
    const writingGrading = base.writingGrading || placeholderQuestion(9, number).writingGrading!;
    const minWords = Math.max(1, Math.min(1_000, Number(base.minWords) || 25));
    const maxWords = Math.max(minWords, Math.min(2_000, Number(base.maxWords) || 50));
    return {
      ...base,
      type: 'long-writing',
      options: [],
      correctOptionIds: [],
      acceptedAnswers: [],
      points: 10,
      minWords,
      maxWords,
      rubric: base.rubric || 'Chấm mức độ hoàn thành yêu cầu, số câu, ngữ pháp và từ vựng. Điểm nguyên từ 0 đến 10.',
      writingGrading: { ...writingGrading, scoreScale: 10, taskContext: writingGrading.taskContext || base.context || base.prompt },
    };
  }
  return { ...base, type: 'short-answer', options: [], correctOptionIds: [] };
}

function publicExamples(part: number, examples: ExamPartContent['examples']) {
  if (![1, 2, 5].includes(part)) return undefined;
  return examples?.length ? examples : [{ prompt: 'Printed example', answer: '' }];
}

function blockFrom(
  source: Partial<ExamPartBlock> | undefined,
  part: number,
  block: number,
  questions: ExamQuestion[],
  interaction: ExamInteractionDescriptor,
): ExamPartBlock {
  return {
    id: source?.id || makeId(`ket-rw-p${part}-block`),
    block,
    title: source?.title || (block === 1 ? 'Choose A, B or C' : 'Write a letter'),
    instruction: source?.instruction || '',
    interaction,
    questionIds: questions.map(question => question.id),
    ...(source?.imageAssetId ? { imageAssetId: source.imageAssetId, imageUrl: source.imageUrl } : {}),
    ...(source?.examples?.length ? { examples: source.examples } : { examples: [{ prompt: 'Printed example', answer: '' }] }),
    ...(source?.readingScenes?.length ? { readingScenes: source.readingScenes.map(scene => ({ ...scene, questionIds: questions.map(question => question.id) })) } : {}),
  };
}

function normalizePart(part: ExamPartContent, partNumber: number, startNumber: number): ExamPartContent {
  if (partNumber === 3) {
    const currentBlocks = part.blocks || [];
    const canonicalById = new Map(part.questions.map(question => [question.id, question]));
    const firstSource = currentBlocks[0]?.questionIds.map(id => canonicalById.get(id)).filter(Boolean) as ExamQuestion[] | undefined;
    const secondSource = currentBlocks[1]?.questionIds.map(id => canonicalById.get(id)).filter(Boolean) as ExamQuestion[] | undefined;
    const fallbackSplit = Math.min(5, Math.max(1, Math.floor(part.questions.length / 2)));
    const firstRows = sourceRows(firstSource?.length ? firstSource : part.questions.slice(0, fallbackSplit), 5, 3, startNumber);
    const secondRows = sourceRows(secondSource?.length ? secondSource : part.questions.slice(fallbackSplit), 5, 3, startNumber + firstRows.length);
    const firstQuestions = firstRows.map((question, index) => normalizeQuestion(3, question, startNumber + index, 'choice'));
    const secondQuestions = secondRows.map((question, index) => normalizeQuestion(3, question, startNumber + firstQuestions.length + index, 'letter'));
    const firstInteraction: ExamInteractionDescriptor = { family: 'choice', subtype: 'cloze', variant: 'multiple-choice-cloze', schemaVersion: 1, importReadiness: 'needs-assets' };
    const secondInteraction: ExamInteractionDescriptor = { family: 'text-entry', subtype: 'letter-matching', variant: 'two-image-letter-input', schemaVersion: 1, importReadiness: 'needs-assets' };
    const blocks = [
      blockFrom(currentBlocks[0], 3, 1, firstQuestions, firstInteraction),
      blockFrom(currentBlocks[1], 3, 2, secondQuestions, secondInteraction),
    ];
    if (!blocks[1].readingScenes?.length) blocks[1].readingScenes = [{ id: makeId('ket-rw-p3-middle'), passage: '', questionIds: secondQuestions.map(question => question.id) }];
    return {
      ...part,
      part: 3,
      title: part.title || 'Part 3',
      instruction: part.instruction || '',
      interaction: descriptor(3),
      questions: [...firstQuestions, ...secondQuestions],
      blocks,
    };
  }

  const count = KET_READING_WRITING_DEFAULT_COUNTS[partNumber - 1];
  const rows = sourceRows(part.questions, count, partNumber, startNumber);
  const questions = rows.map((question, index) => normalizeQuestion(partNumber, question, startNumber + index));
  const { blocks: _blocks, examples: sourceExamples, passage: sourcePassage, ...withoutBlocks } = part;
  const importedExamples = sourceExamples?.length ? sourceExamples : part.blocks?.[0]?.examples;
  const importedPassage = sourcePassage || part.blocks?.[0]?.passage;
  const next: ExamPartContent = {
    ...withoutBlocks,
    part: partNumber,
    title: part.title || `Part ${partNumber}`,
    instruction: part.instruction || '',
    interaction: descriptor(partNumber),
    questions,
    ...(importedPassage ? { passage: importedPassage } : {}),
    ...(publicExamples(partNumber, importedExamples) ? { examples: publicExamples(partNumber, importedExamples) } : {}),
  };
  if ((partNumber === 1) && !next.readingScenes?.length) {
    next.readingScenes = [{ id: makeId('ket-rw-p1-middle'), passage: '', questionIds: questions.map(question => question.id) }];
  } else if (partNumber === 1) {
    next.readingScenes = next.readingScenes?.slice(0, 1).map(scene => ({ ...scene, questionIds: questions.map(question => question.id) }));
  }
  return next;
}

export function isFixedKetReadingWritingContent(content: ExamPaperContent) {
  if (content.moduleId !== 'ket' || content.paperId !== 'reading-writing') return false;
  return content.templateVersion === KET_READING_WRITING_TEMPLATE_VERSION
    || (content.parts.length === 9 && content.parts[8]?.questions.some(question => question.type === 'long-writing'));
}

/** Normalizes only the explicitly versioned nine-Part KET paper. Released seven-Part papers stay untouched. */
export function normalizeFixedKetReadingWritingContent(content: ExamPaperContent): ExamPaperContent {
  if (!isFixedKetReadingWritingContent(content)) return content;
  let nextNumber = 1;
  const parts = Array.from({ length: 9 }, (_, index) => {
    const current = content.parts[index] || {
      id: makeId('ket-rw-part'),
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
    templateVersion: KET_READING_WRITING_TEMPLATE_VERSION,
    parts,
  };
  return JSON.stringify(normalizedContent) === JSON.stringify(content) ? content : normalizedContent;
}
