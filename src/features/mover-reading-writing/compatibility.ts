import type {
  MoverReadingWritingContent,
  MoverReadingWritingGap,
  MoverReadingWritingSchemaVersion,
  MoverReadingWritingTextQuestion,
} from './types';
import {
  MOVER_READING_WRITING_LEGACY_SCHEMA_VERSION,
  MOVER_READING_WRITING_SCHEMA_VERSION,
} from './types';

const INTERNAL_MARKER = /\{\{[^}]+\}\}/;
const PRINTED_BLANK = /(?:_{3,}|\.{4,}|(?:\.\s*){4,}|…{2,})/;

export function isSupportedMoverReadingWritingSchemaVersion(
  value: unknown,
): value is MoverReadingWritingSchemaVersion {
  return value === MOVER_READING_WRITING_LEGACY_SCHEMA_VERSION
    || value === MOVER_READING_WRITING_SCHEMA_VERSION;
}

export function ensureInlineQuestionTemplate(prompt: string, questionId: string) {
  const source = String(prompt || '').trim();
  const marker = `{{${questionId}}}`;
  if (source.includes(marker) || INTERNAL_MARKER.test(source)) return source;
  if (PRINTED_BLANK.test(source)) return source.replace(PRINTED_BLANK, marker);
  return source ? `${source} ${marker}` : marker;
}

export function numberedTemplateForEditor(
  template: string,
  gaps: Array<{ id: string }>,
) {
  return gaps.reduce(
    (value, gap, index) => value.split(`{{${gap.id}}}`).join(`[[${index + 1}]]`),
    String(template || ''),
  );
}

export function internalTemplateFromEditor(
  template: string,
  gaps: Array<{ id: string }>,
) {
  return gaps.reduce(
    (value, gap, index) => value.split(`[[${index + 1}]]`).join(`{{${gap.id}}}`),
    String(template || ''),
  );
}

function normalizeTextQuestion(question: any): MoverReadingWritingTextQuestion {
  const id = String(question?.id || '');
  return {
    ...question,
    id,
    prompt: ensureInlineQuestionTemplate(String(question?.prompt || ''), id),
    acceptedAnswers: Array.isArray(question?.acceptedAnswers)
      ? question.acceptedAnswers.map((answer: unknown) => String(answer))
      : [],
  };
}

function normalizePart6Gap(gap: any): MoverReadingWritingGap {
  if (Array.isArray(gap?.acceptedAnswers)) {
    return {
      id: String(gap.id || ''),
      acceptedAnswers: gap.acceptedAnswers.map((answer: unknown) => String(answer)),
    };
  }
  const options = Array.isArray(gap?.options) ? gap.options : [];
  const correct = options.find((option: any) => option?.id === gap?.correctOptionId);
  const correctText = String(correct?.text || '').trim();
  return {
    id: String(gap?.id || ''),
    acceptedAnswers: correctText ? [correctText] : [],
  };
}

export function normalizeMoverReadingWritingContent(
  value: unknown,
): MoverReadingWritingContent {
  const content = structuredClone(value) as any;
  if (!content || !isSupportedMoverReadingWritingSchemaVersion(content.schemaVersion)) {
    throw new Error('Phiên bản cấu trúc Reading & Writing không được hỗ trợ.');
  }
  if (!Array.isArray(content.parts) || content.parts.length !== 6) {
    throw new Error('Reading & Writing cần đúng 6 Part.');
  }

  content.schemaVersion = MOVER_READING_WRITING_SCHEMA_VERSION;
  content.parts[0].questions = Array.isArray(content.parts[0]?.questions)
    ? content.parts[0].questions.map(normalizeTextQuestion)
    : [];
  content.parts[4].scenes = Array.isArray(content.parts[4]?.scenes)
    ? content.parts[4].scenes.map((scene: any) => ({
        ...scene,
        questions: Array.isArray(scene?.questions)
          ? scene.questions.map(normalizeTextQuestion)
          : [],
      }))
    : [];
  content.parts[5].gaps = Array.isArray(content.parts[5]?.gaps)
    ? content.parts[5].gaps.map(normalizePart6Gap)
    : [];

  return content as MoverReadingWritingContent;
}
