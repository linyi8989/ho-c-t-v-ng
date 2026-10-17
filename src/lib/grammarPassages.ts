import type { GrammarAttempt, GrammarDisplayMode, GrammarQuestion, GrammarWordToken } from '../types';

export const GRAMMAR_PASSAGE_FORMAT = 'grammar-passage-v1';
export const GRAMMAR_PASSAGE_MAX_LENGTH = 100_000;
export type GrammarPassagePresentation = Pick<GrammarAttempt, 'displayMode' | 'passageSnapshot' | 'instructionSnapshot' | 'wordBankSnapshot' | 'questions' | 'answers'>;
export function isGrammarPassageReview(value: unknown): value is GrammarPassagePresentation {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const data = value as Record<string, unknown>;
  return (data.displayMode === 'reading_comprehension' || data.displayMode === 'passage_drag_drop')
    && typeof data.passageSnapshot === 'string' && typeof data.instructionSnapshot === 'string'
    && Array.isArray(data.questions) && data.questions.every(question => question && typeof question.id === 'string' && typeof question.questionSnapshot === 'string' && Array.isArray(question.optionsSnapshot) && question.optionsSnapshot.every((option: unknown) => option && typeof option === 'object' && typeof (option as Record<string, unknown>).id === 'string' && typeof (option as Record<string, unknown>).text === 'string'))
    && Array.isArray(data.answers) && data.answers.every(answer => answer && typeof answer.attemptQuestionId === 'string')
    && Array.isArray(data.wordBankSnapshot) && data.wordBankSnapshot.every(token => token && typeof token.id === 'string' && typeof token.text === 'string');
}
export function grammarDisplayMode(value: unknown): GrammarDisplayMode {
  return value === 'passage_drag_drop' || value === 'reading_comprehension' ? value : 'standard';
}
export function grammarOptionLabel(index: number): string {
  let label = '';
  for (let value = index + 1; value > 0; value = Math.floor((value - 1) / 26)) label = String.fromCharCode(65 + (value - 1) % 26) + label;
  return label;
}
export const grammarTokenText = (value: unknown) => String(value ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en');
export function grammarPassageSegments(passage: string) {
  const segments: Array<{ text: string; blankNumber?: number }> = [];
  let offset = 0;
  for (const match of passage.matchAll(/\[\[(\d+)\]\]/g)) {
    if (match.index! > offset) segments.push({ text: passage.slice(offset, match.index) });
    segments.push({ text: match[0], blankNumber: Number(match[1]) });
    offset = match.index! + match[0].length;
  }
  if (offset < passage.length) segments.push({ text: passage.slice(offset) });
  return segments;
}

/** Shared runtime checks: import, authoring and server use the same contract. */
export function validateGrammarPassage(set: {
  displayMode?: unknown; passage?: unknown; instruction?: unknown;
  wordBank?: GrammarWordToken[]; questions: GrammarQuestion[];
}): string[] {
  const mode = grammarDisplayMode(set.displayMode);
  if (mode === 'standard') return [];
  const errors: string[] = [];
  if (typeof set.passage !== 'string' || !set.passage.trim()) errors.push('Thiếu đoạn văn.');
  else if (set.passage.length > GRAMMAR_PASSAGE_MAX_LENGTH) errors.push('Đoạn văn vượt quá 100.000 ký tự; dữ liệu chưa được lưu.');
  if (typeof set.instruction === 'string' && set.instruction.length > 4000) errors.push('Hướng dẫn vượt quá 4.000 ký tự.');
  if (!set.questions.length) errors.push('Bài cần ít nhất một câu hỏi hoặc ô trống.');
  const questionIds = set.questions.map(q => q.id);
  if (new Set(questionIds).size !== questionIds.length) errors.push('Câu hỏi bị trùng ID.');
  if (mode === 'reading_comprehension') {
    set.questions.forEach((question, index) => {
      const prefix = `Câu ${index + 1}: `;
      if (!question.questionText?.trim()) errors.push(prefix + 'thiếu nội dung.');
      if (!question.explanation?.trim()) errors.push(prefix + 'thiếu giải thích.');
      if (question.options.length < 2) errors.push(prefix + 'cần ít nhất hai lựa chọn.');
      if (question.options.some(option => !option.text?.trim() || option.text.length > 1000)) errors.push(prefix + 'lựa chọn trống hoặc vượt quá 1.000 ký tự.');
      if (new Set(question.options.map(option => option.id)).size !== question.options.length) errors.push(prefix + 'lựa chọn trùng ID.');
      if (new Set(question.options.map(option => grammarTokenText(option.text))).size !== question.options.length) errors.push(prefix + 'lựa chọn trùng nội dung.');
      if (!question.options.some(option => option.id === question.correctOptionId)) errors.push(prefix + 'đáp án đúng không hợp lệ.');
    });
    return errors;
  }
  const passage = typeof set.passage === 'string' ? set.passage : '';
  const markers = grammarPassageSegments(passage).filter(segment => segment.blankNumber !== undefined).map(segment => segment.blankNumber!);
  if (!markers.length || markers.some(number => !Number.isSafeInteger(number) || number < 1)) errors.push('Đoạn văn cần marker ô trống hợp lệ, ví dụ [[1]].');
  if (new Set(markers).size !== markers.length) errors.push('Mỗi số ô trống chỉ được xuất hiện một lần trong đoạn văn.');
  if (passage.replace(/\[\[\d+\]\]/g, '').includes('[[') || passage.replace(/\[\[\d+\]\]/g, '').includes(']]')) errors.push('Marker ô trống sai định dạng.');
  const numbers = set.questions.map(question => question.blankNumber);
  if (numbers.length !== markers.length || new Set(numbers).size !== numbers.length || markers.some(number => !numbers.includes(number))) errors.push('Danh sách đáp án phải khớp đầy đủ các ô trống trong đoạn văn.');
  const bank = set.wordBank || [];
  if (bank.length < markers.length) errors.push('Ngân hàng từ cần đủ thẻ để điền các ô; có thể thêm từ nhiễu.');
  if (bank.some(token => !token.id || !token.text?.trim() || token.text.length > 1000) || new Set(bank.map(token => token.id)).size !== bank.length) errors.push('Ngân hàng từ có thẻ trống, quá dài hoặc trùng ID.');
  if (new Set(set.questions.map(question => question.correctOptionId)).size !== set.questions.length) errors.push('Mỗi thẻ đáp án đúng chỉ được gán cho một ô trống.');
  set.questions.forEach(question => {
    if (!bank.some(token => token.id === question.correctOptionId)) errors.push(`Ô ${question.blankNumber}: đáp án không có trong ngân hàng từ.`);
    if (!question.explanation?.trim()) errors.push(`Ô ${question.blankNumber}: thiếu giải thích.`);
  });
  return errors;
}
