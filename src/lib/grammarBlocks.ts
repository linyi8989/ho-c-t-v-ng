import type { GrammarAttempt, GrammarBlock, GrammarBlockType, GrammarDisplayMode, GrammarQuestion, GrammarWordToken } from '../types';
import { grammarTokenText, validateGrammarPassage, type GrammarPassagePresentation } from './grammarPassages';

export const GRAMMAR_MIXED_FORMAT = 'grammar-mixed-v1';
export const GRAMMAR_BLOCK_TYPES: readonly GrammarBlockType[] = ['multiple_choice', 'passage_drag_drop', 'reading_comprehension'];
export const grammarBlockLabel = (type: GrammarBlockType) => type === 'multiple_choice' ? 'Trắc nghiệm' : type === 'passage_drag_drop' ? 'Kéo thả điền từ' : 'Đọc hiểu';
export type GrammarMixedPresentation = Pick<GrammarAttempt, 'questions' | 'answers'> & {
  contentVersion: 2; displayMode: 'mixed'; blocksSnapshot: GrammarBlock[];
};
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 200;
const newId = (kind: string) => `grammar-${kind}-${crypto.randomUUID()}`;

function questionShape(value: unknown): value is GrammarQuestion {
  return record(value) && id(value.id) && typeof value.questionText === 'string' && typeof value.explanation === 'string'
    && Array.isArray(value.options) && value.options.every(option => record(option) && id(option.id) && typeof option.text === 'string')
    && typeof value.correctOptionId === 'string' && typeof value.score === 'number' && Number.isFinite(value.score) && value.score >= 1;
}

/** Same document contract for authoring, import and server normalization. */
export function validateGrammarBlocks(input: { blocks?: unknown; questions?: unknown }): string[] {
  if (!Array.isArray(input.blocks) || !input.blocks.length) return ['Bộ bài cần ít nhất một nhóm nội dung.'];
  if (!Array.isArray(input.questions) || !input.questions.every(questionShape)) return ['Danh sách câu hỏi không hợp lệ hoặc điểm nhỏ hơn 1.'];
  const questions = input.questions;
  const errors: string[] = [];
  const questionMap = new Map(questions.map(question => [question.id, question]));
  if (questionMap.size !== questions.length) errors.push('Câu hỏi bị trùng ID trong bộ bài.');
  const blockIds = new Set<string>(), tokenIds = new Set<string>(), usedQuestions = new Set<string>();
  input.blocks.forEach((value: unknown, index: number) => {
    const prefix = `Nhóm ${index + 1}: `;
    if (!record(value) || !id(value.id) || !GRAMMAR_BLOCK_TYPES.includes(value.type as GrammarBlockType)
      || typeof value.title !== 'string' || value.title.length > 240 || typeof value.instruction !== 'string' || value.instruction.length > 4000
      || !Array.isArray(value.questionIds) || !value.questionIds.length || !value.questionIds.every(id)) {
      errors.push(prefix + 'nội dung, dạng bài hoặc danh sách câu hỏi không hợp lệ.'); return;
    }
    if (blockIds.has(value.id)) errors.push(prefix + 'trùng ID nhóm.');
    blockIds.add(value.id);
    const group: GrammarQuestion[] = [];
    for (const questionId of value.questionIds) {
      const question = questionMap.get(questionId);
      if (!question || question.blockId !== value.id || usedQuestions.has(questionId)) errors.push(prefix + 'câu hỏi phải thuộc đúng một nhóm.');
      else group.push(question);
      usedQuestions.add(questionId);
    }
    const type = value.type as GrammarBlockType;
    if (type === 'passage_drag_drop') {
      if (!Array.isArray(value.wordBank) || !value.wordBank.every(token => record(token) && id(token.id) && typeof token.text === 'string')) {
        errors.push(prefix + 'ngân hàng từ không hợp lệ.'); return;
      }
      for (const token of value.wordBank) {
        if (tokenIds.has(token.id)) errors.push(prefix + 'thẻ từ bị trùng ID giữa các nhóm.');
        tokenIds.add(token.id);
      }
      if (group.some(question => question.questionType !== 'bank_select' || question.options.length)) errors.push(prefix + 'ô kéo thả phải dùng đáp án từ ngân hàng của nhóm.');
      errors.push(...validateGrammarPassage({ displayMode: type, passage: value.passage, instruction: value.instruction, wordBank: value.wordBank, questions: group }).map(error => prefix + error));
    } else {
      if (type === 'reading_comprehension' && (typeof value.passage !== 'string' || !value.passage.trim() || value.passage.length > 100_000)) errors.push(prefix + 'bài đọc cần văn bản không quá 100.000 ký tự.');
      group.forEach((question, i) => {
        const label = prefix + `Câu ${i + 1}: `;
        if (question.questionType && question.questionType !== 'multiple_choice') errors.push(label + 'cần câu trắc nghiệm.');
        if (!question.questionText.trim() || question.questionText.length > 4000 || !question.explanation.trim() || question.explanation.length > 6000) errors.push(label + 'thiếu nội dung/giải thích hoặc nội dung quá dài.');
        if (question.options.length < 2 || question.options.some(option => !option.text.trim() || option.text.length > 1000)) errors.push(label + 'cần ít nhất hai lựa chọn không trống, mỗi lựa chọn tối đa 1.000 ký tự.');
        if (new Set(question.options.map(option => option.id)).size !== question.options.length || new Set(question.options.map(option => grammarTokenText(option.text))).size !== question.options.length) errors.push(label + 'lựa chọn bị trùng.');
        if (!question.options.some(option => option.id === question.correctOptionId)) errors.push(label + 'đáp án đúng không hợp lệ.');
      });
    }
  });
  if (!questions.length || questions.some(question => !usedQuestions.has(question.id))) errors.push('Mỗi câu hỏi phải nằm trong một nhóm nội dung.');
  return errors;
}

/** Explicit presentation allowlist: nested answer keys never cross the student boundary. */
export function sanitizeGrammarBlocks(value: unknown): GrammarBlock[] {
  if (!Array.isArray(value)) return [];
  return value.filter(record).map(block => ({
    id: String(block.id || ''), type: block.type as GrammarBlockType,
    title: String(block.title || ''), instruction: String(block.instruction || ''),
    questionIds: Array.isArray(block.questionIds) ? block.questionIds.filter((item: unknown): item is string => typeof item === 'string') : [],
    ...(block.type !== 'multiple_choice' ? { passage: typeof block.passage === 'string' ? block.passage : '' } : {}),
    ...(block.type === 'passage_drag_drop' ? { wordBank: Array.isArray(block.wordBank) ? block.wordBank.filter(record).map(token => ({ id: String(token.id || ''), text: String(token.text || '') })) : [] } : {}),
  }));
}

export function grammarBlockPresentation(attempt: GrammarMixedPresentation, block: GrammarBlock): GrammarPassagePresentation {
  const questions = attempt.questions.filter(question => question.blockId === block.id && block.questionIds.includes(question.questionId));
  const ids = new Set(questions.map(question => question.id));
  return {
    displayMode: block.type === 'passage_drag_drop' ? 'passage_drag_drop' : 'reading_comprehension',
    passageSnapshot: block.passage || '', instructionSnapshot: block.instruction || (block.type === 'multiple_choice' ? 'Choose the correct answer.' : ''),
    wordBankSnapshot: block.wordBank || [], questions, answers: attempt.answers.filter(answer => ids.has(answer.attemptQuestionId)),
  };
}

export function grammarMixedPreview(blocks: GrammarBlock[], questions: GrammarQuestion[]): GrammarMixedPresentation {
  return { contentVersion: 2, displayMode: 'mixed', blocksSnapshot: sanitizeGrammarBlocks(blocks), answers: [], questions: questions.map(question => ({
    id: question.id, questionId: question.id, blockId: question.blockId, questionType: question.questionType,
    questionSnapshot: question.questionText, optionsSnapshot: question.options, blankNumber: question.blankNumber,
    displayPosition: question.position, scoreSnapshot: question.score, optionOrder: question.options.map(option => option.id),
  })) };
}

export function isGrammarMixedReview(value: unknown): value is GrammarMixedPresentation {
  if (!record(value) || value.displayMode !== 'mixed' || value.contentVersion !== 2 || !Array.isArray(value.blocksSnapshot) || !value.blocksSnapshot.length || !Array.isArray(value.questions) || !Array.isArray(value.answers)) return false;
  const blocksValid = value.blocksSnapshot.every(block => record(block) && id(block.id) && GRAMMAR_BLOCK_TYPES.includes(block.type as GrammarBlockType)
    && typeof block.title === 'string' && typeof block.instruction === 'string' && Array.isArray(block.questionIds) && block.questionIds.every(id)
    && (block.type === 'multiple_choice' || typeof block.passage === 'string')
    && (block.type !== 'passage_drag_drop' || (Array.isArray(block.wordBank) && block.wordBank.every(token => record(token) && id(token.id) && typeof token.text === 'string'))));
  const questionsValid = value.questions.every(question => record(question) && id(question.id) && id(question.questionId) && id(question.blockId)
    && typeof question.questionSnapshot === 'string' && Array.isArray(question.optionsSnapshot) && question.optionsSnapshot.every(option => record(option) && id(option.id) && typeof option.text === 'string'));
  return blocksValid && questionsValid && value.answers.every(answer => record(answer) && id(answer.attemptQuestionId) && (answer.selectedOptionId === undefined || typeof answer.selectedOptionId === 'string'));
}

export function convertLegacyGrammarToBlocks(data: { displayMode?: GrammarDisplayMode; passage?: string; instruction?: string; wordBank?: GrammarWordToken[]; questions: GrammarQuestion[] }): { blocks: GrammarBlock[]; questions: GrammarQuestion[] } {
  if (data.questions.some(question => question.questionType === 'rewrite')) throw new Error('Bài tự luận tiếp tục dùng định dạng hiện tại.');
  const blockId = newId('block');
  const type: GrammarBlockType = data.displayMode === 'passage_drag_drop' || data.displayMode === 'reading_comprehension' ? data.displayMode : 'multiple_choice';
  const questions = data.questions.map((question, index) => ({ ...question, blockId, questionType: type === 'passage_drag_drop' ? 'bank_select' as const : 'multiple_choice' as const, position: index + 1 }));
  return { blocks: [{ id: blockId, type, title: '', instruction: data.instruction || '', questionIds: questions.map(question => question.id),
    ...(type !== 'multiple_choice' ? { passage: data.passage || '' } : {}),
    ...(type === 'passage_drag_drop' ? { wordBank: (data.wordBank || []).map(token => ({ ...token })) } : {}),
  }], questions };
}

export function cloneGrammarBlock(block: GrammarBlock, allQuestions: GrammarQuestion[]): { block: GrammarBlock; questions: GrammarQuestion[] } {
  const blockId = newId('block');
  const tokens = (block.wordBank || []).map(token => ({ ...token, id: newId('token') }));
  const tokenMap = new Map((block.wordBank || []).map((token, index) => [token.id, tokens[index].id]));
  const questionMap = new Map(allQuestions.map(question => [question.id, question]));
  const questions = block.questionIds.map(questionId => {
    const original = questionMap.get(questionId);
    if (!original) throw new Error('Nhóm chứa tham chiếu câu hỏi không tồn tại.');
    const options = original.options.map(option => ({ ...option, id: newId('option') }));
    const correctIndex = original.options.findIndex(option => option.id === original.correctOptionId);
    return { ...original, id: newId('question'), blockId, options, correctOptionId: block.type === 'passage_drag_drop' ? tokenMap.get(original.correctOptionId) || '' : options[correctIndex]?.id || '' };
  });
  return { block: { ...block, id: blockId, questionIds: questions.map(question => question.id), ...(block.type === 'passage_drag_drop' ? { wordBank: tokens } : {}) }, questions };
}
