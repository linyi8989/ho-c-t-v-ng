import type { GrammarDisplayMode, GrammarQuestion, GrammarWordToken } from '../types';
import { GRAMMAR_PASSAGE_FORMAT, grammarPassageSegments, grammarTokenText, validateGrammarPassage } from './grammarPassages';

type PassageMode = Exclude<GrammarDisplayMode, 'standard'>;
export interface GrammarPassageImportResult {
  passage: string; instruction: string; wordBank: GrammarWordToken[];
  questions: GrammarQuestion[]; errors: string[]; warnings: string[];
}
export function parseGrammarPassageImport(input: string, mode: PassageMode): GrammarPassageImportResult {
  const result: GrammarPassageImportResult = { passage: '', instruction: '', wordBank: [], questions: [], errors: [], warnings: [] };
  try {
    const text = input.replace(/^\uFEFF/, '').trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i, '$1');
    if (!text) throw new Error('Chưa có dữ liệu JSON để nhập.');
    const data = JSON.parse(text);
    if (!data || Array.isArray(data) || data.format !== GRAMMAR_PASSAGE_FORMAT || data.mode !== mode) throw new Error('JSON cần đúng format grammar-passage-v1 và đúng dạng bài đang chọn.');
    if (typeof data.passage !== 'string' || (data.instruction !== undefined && typeof data.instruction !== 'string')) throw new Error('passage và instruction phải là văn bản.');
    result.passage = data.passage.trim(); result.instruction = (data.instruction || '').trim();
    const prefix = `grammar-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    if (mode === 'reading_comprehension') {
      if (!Array.isArray(data.questions)) throw new Error('questions phải là danh sách câu hỏi.');
      result.questions = data.questions.map((row: unknown, index: number) => {
        if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error(`Câu ${index + 1}: dữ liệu không hợp lệ.`);
        const q = row as Record<string, unknown>;
        if (typeof q.question !== 'string' || typeof q.explanation !== 'string' || !Array.isArray(q.options) || q.options.some(option => typeof option !== 'string')) throw new Error(`Câu ${index + 1}: cần question, options dạng danh sách văn bản và explanation.`);
        if (!Number.isSafeInteger(q.answer) || Number(q.answer) < 1 || Number(q.answer) > q.options.length) throw new Error(`Câu ${index + 1}: answer phải là vị trí đáp án đúng, tính từ 1.`);
        const id = `${prefix}-q-${index + 1}`;
        const options = (q.options as string[]).map((text, i) => ({ id: `${id}-option-${i + 1}`, text: text.trim(), originalPosition: i + 1 }));
        return { id, questionType: 'multiple_choice', questionText: q.question.trim(), explanation: q.explanation.trim(), options, correctOptionId: options[Number(q.answer) - 1].id, score: 1, position: index + 1 };
      });
    } else {
      if (!Array.isArray(data.wordBank) || data.wordBank.some((word: unknown) => typeof word !== 'string') || !Array.isArray(data.answers)) throw new Error('Cần wordBank là danh sách từ và answers là danh sách đáp án theo ô.');
      result.wordBank = data.wordBank.map((text: string, index: number) => ({ id: `${prefix}-token-${index + 1}`, text: text.trim() }));
      const used = new Set<string>();
      const markers = grammarPassageSegments(result.passage).filter(segment => segment.blankNumber !== undefined);
      const answers = data.answers as Array<Record<string, unknown>>;
      if (answers.some(row => !row || typeof row !== 'object' || Array.isArray(row) || !Number.isSafeInteger(row.blank) || typeof row.answer !== 'string' || typeof row.explanation !== 'string')) throw new Error('Mỗi đáp án cần blank (số ô), answer (từ đúng), explanation (giải thích).');
      if (answers.length !== markers.length || new Set(answers.map(row => row.blank)).size !== answers.length) throw new Error('Số đáp án phải khớp các ô trống, không lặp số ô.');
      result.questions = markers.map((segment, index) => {
        const row = answers.find(answer => answer.blank === segment.blankNumber);
        if (!row) throw new Error(`Ô ${segment.blankNumber}: thiếu đáp án.`);
        const token = result.wordBank.find(token => !used.has(token.id) && grammarTokenText(token.text) === grammarTokenText(row.answer));
        if (!token) throw new Error(`Ô ${segment.blankNumber}: thiếu thẻ từ “${row.answer}” trong ngân hàng từ.`);
        used.add(token.id);
        return { id: `${prefix}-q-${index + 1}`, questionType: 'bank_select', blankNumber: segment.blankNumber, questionText: `Ô trống ${segment.blankNumber}`, options: [], correctOptionId: token.id, explanation: String(row.explanation).trim(), score: 1, position: index + 1 };
      });
    }
    result.errors = validateGrammarPassage({ ...result, displayMode: mode });
  } catch (error) {
    result.errors.push(error instanceof SyntaxError ? 'JSON không hợp lệ. Kiểm tra dấu ngoặc, dấu phẩy và dấu nháy.' : (error as Error).message);
  }
  // A passage is one document: invalid imports never partially overwrite a draft.
  if (result.errors.length) result.questions = [];
  return result;
}

export function grammarPassageTemplate(mode: PassageMode) {
  return JSON.stringify(mode === 'reading_comprehension' ? {
    format: GRAMMAR_PASSAGE_FORMAT, mode, instruction: 'Read the passage and choose the correct answer.',
    passage: 'Volunteers help people. They also make new friends.',
    questions: [{ question: 'What can volunteers do?', options: ['Make new friends.', 'Always earn money.', 'Never meet people.'], answer: 1, explanation: 'Đoạn văn nói người tình nguyện có thêm bạn mới.' }],
  } : {
    format: GRAMMAR_PASSAGE_FORMAT, mode, instruction: 'Put a word in each gap to complete the passage.',
    passage: 'They [[1]] to school. The lesson [[2]] at eight.', wordBank: ['begins', 'go', 'off'],
    answers: [{ blank: 1, answer: 'go', explanation: 'They đi với go.' }, { blank: 2, answer: 'begins', explanation: 'The lesson là chủ ngữ số ít.' }],
  }, null, 2);
}
