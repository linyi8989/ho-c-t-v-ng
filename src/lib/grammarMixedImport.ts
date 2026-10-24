import type { GrammarBlock, GrammarBlockType, GrammarQuestion } from '../types';
import { GRAMMAR_MIXED_FORMAT, cloneGrammarBlock, convertLegacyGrammarToBlocks, validateGrammarBlocks } from './grammarBlocks';
import { parseBulkGrammarText } from './grammarBulkImport';
import { grammarPassageTemplate, parseGrammarPassageImport } from './grammarPassageImport';

export interface GrammarMixedImportResult {
  blocks: GrammarBlock[]; questions: GrammarQuestion[]; errors: string[]; warnings: string[];
}
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const fail = (message: string): never => { throw new Error(message); };
const text = (value: unknown, label: string, optional = false) => value === undefined && optional ? '' : typeof value === 'string' ? value.trim() : fail(`${label} phải là văn bản.`);

function parseBlock(value: unknown): { block: GrammarBlock; questions: GrammarQuestion[] } {
  if (!record(value) || !['multiple_choice', 'passage_drag_drop', 'reading_comprehension'].includes(String(value.type))) return fail('Nhóm cần type là multiple_choice, passage_drag_drop hoặc reading_comprehension.');
  const type = value.type as GrammarBlockType;
  const blockId = `grammar-block-${crypto.randomUUID()}`;
  const title = text(value.title, 'Tiêu đề nhóm', true);
  const instruction = text(value.instruction, 'Hướng dẫn', true);
  let questions: GrammarQuestion[];
  let block: GrammarBlock;
  if (type === 'multiple_choice') {
    if (!Array.isArray(value.questions)) return fail('Nhóm trắc nghiệm cần danh sách questions.');
    questions = value.questions.map((row: unknown, index: number) => {
      if (!record(row) || !Array.isArray(row.options) || row.options.some(option => typeof option !== 'string')) return fail(`Câu ${index + 1}: options phải là danh sách văn bản.`);
      if (!Number.isSafeInteger(row.answer) || Number(row.answer) < 1 || Number(row.answer) > row.options.length) return fail(`Câu ${index + 1}: answer là vị trí đáp án đúng, tính từ 1.`);
      const id = `grammar-question-${crypto.randomUUID()}`;
      const options = (row.options as string[]).map((option, i) => ({ id: `grammar-option-${crypto.randomUUID()}`, text: option.trim(), originalPosition: i + 1 }));
      return { id, blockId, questionType: 'multiple_choice', questionText: text(row.question, `Câu ${index + 1}`), options,
        correctOptionId: options[Number(row.answer) - 1].id, explanation: text(row.explanation, `Giải thích câu ${index + 1}`), score: 1, position: index + 1 };
    });
    block = { id: blockId, type, title, instruction, questionIds: questions.map(question => question.id) };
  } else {
    const imported = parseGrammarPassageImport(JSON.stringify({ ...value, format: 'grammar-passage-v1', mode: type, instruction }), type);
    if (imported.errors.length) return fail(imported.errors.join(' '));
    questions = imported.questions.map(question => ({ ...question, blockId }));
    block = { id: blockId, type, title, instruction, passage: imported.passage, questionIds: questions.map(question => question.id), ...(type === 'passage_drag_drop' ? { wordBank: imported.wordBank } : {}) };
  }
  return { block, questions };
}

/** Parse a complete document before exposing any content to the draft. */
export function parseGrammarMixedImport(input: string): GrammarMixedImportResult {
  const result: GrammarMixedImportResult = { blocks: [], questions: [], errors: [], warnings: [] };
  try {
    const source = input.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
    const body = source.replace(/^```(?:json|text|plaintext)?[^\S\n]*\n([\s\S]*?)\n```$/i, '$1').trim();
    if (!body) return { ...result, errors: ['Chưa có nội dung để nhập.'] };
    if (!/^[\[{]/.test(body)) {
      const parsed = parseBulkGrammarText(body);
      if (parsed.errors.length) return { ...result, errors: parsed.errors, warnings: parsed.warnings };
      const legacy = convertLegacyGrammarToBlocks({ displayMode: 'standard', questions: parsed.questions });
      const copy = cloneGrammarBlock(legacy.blocks[0], legacy.questions);
      result.blocks = [copy.block]; result.questions = copy.questions; result.warnings = parsed.warnings;
    } else {
      const data: unknown = JSON.parse(body);
      if (!record(data)) return fail('Cần một đối tượng JSON của bộ ngữ pháp.');
      const values = data.format === 'grammar-passage-v1' && (data.mode === 'passage_drag_drop' || data.mode === 'reading_comprehension')
        ? [{ ...data, type: data.mode }]
        : data.format === GRAMMAR_MIXED_FORMAT && Array.isArray(data.blocks) ? data.blocks : fail('JSON cần format grammar-mixed-v1 và danh sách blocks. Mẫu đoạn văn grammar-passage-v1 cũ cũng được hỗ trợ.');
      values.forEach((value, index) => {
        try {
          const parsed = parseBlock(value); result.blocks.push(parsed.block); result.questions.push(...parsed.questions);
        } catch (error) { result.errors.push(`Nhóm ${index + 1}: ${(error as Error).message}`); }
      });
    }
    result.questions = result.questions.map((question, index) => ({ ...question, position: index + 1 }));
    result.errors.push(...validateGrammarBlocks(result));
  } catch (error) {
    result.errors.push(error instanceof SyntaxError ? 'JSON không hợp lệ. Kiểm tra dấu ngoặc, dấu phẩy và dấu nháy.' : (error as Error).message);
  }
  if (result.errors.length) { result.blocks = []; result.questions = []; }
  return result;
}

export function grammarMixedTemplate() {
  const reading = JSON.parse(grammarPassageTemplate('reading_comprehension'));
  const bank = JSON.parse(grammarPassageTemplate('passage_drag_drop'));
  const { format: _readingFormat, mode: _readingMode, ...readingData } = reading;
  const { format: _bankFormat, mode: _bankMode, ...bankData } = bank;
  return JSON.stringify({ format: GRAMMAR_MIXED_FORMAT, blocks: [
    { type: 'multiple_choice', title: '', instruction: 'Choose the correct answer.', questions: [{ question: 'She ____ to school every day.', options: ['go', 'goes', 'going'], answer: 2, explanation: 'She là chủ ngữ số ít nên dùng goes.' }] },
    { type: 'passage_drag_drop', title: '', ...bankData },
    { type: 'reading_comprehension', title: '', ...readingData },
  ] }, null, 2);
}
