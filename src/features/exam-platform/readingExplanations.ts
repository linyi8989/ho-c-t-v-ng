import type { ExamQuestion } from './types';

export const READING_EXPLANATION_MAX_LENGTH = 4_000;
type PaperIdentity = { moduleId: string; paperId: string };

export function supportsReadingExplanations(content: PaperIdentity): boolean {
  return content.moduleId === 'ket' && content.paperId === 'reading-writing'
    || content.moduleId === 'pet' && content.paperId === 'reading'
    || content.moduleId === 'fce' && ['reading', 'reading-use-of-english'].includes(content.paperId)
    || content.moduleId === 'ielts' && content.paperId === 'academic-reading';
}

export function isReadingExplanationQuestion(content: PaperIdentity, question: Pick<ExamQuestion, 'type'>): boolean {
  return supportsReadingExplanations(content) && question.type !== 'long-writing' && question.type !== 'scene-draw';
}

/** Optional for released papers; reject malformed new values rather than coercing or truncating them. */
export function parseReadingExplanation(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new Error('Giải thích đáp án phải là chuỗi văn bản.');
  if (value.length > READING_EXPLANATION_MAX_LENGTH) throw new Error(`Giải thích đáp án không được vượt quá ${READING_EXPLANATION_MAX_LENGTH} ký tự.`);
  return value.replace(/\r\n?/g, '\n').trim() || undefined;
}
