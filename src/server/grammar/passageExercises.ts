import { createHash } from 'node:crypto';
import type { GrammarAttempt, GrammarAttemptAnswer, GrammarQuestion, GrammarWordToken } from '../../types';
import { grammarDisplayMode, grammarTokenText, validateGrammarPassage } from '../../lib/grammarPassages';

const fail = (status: number, message: string) => { throw Object.assign(new Error(message), { status }); };
function text(value: unknown, max: number, label: string): string {
  if (typeof value !== 'string' || value.length > max) return fail(400, `${label}: cần văn bản không quá ${max} ký tự.`);
  return value.normalize('NFKC').trim();
}
export function normalizePassageExercise(payload: Record<string, any>, makeId: (prefix: string) => string) {
  const mode = grammarDisplayMode(payload.displayMode);
  if (mode !== 'passage_drag_drop' && mode !== 'reading_comprehension') return null;
  const bankMode = mode === 'passage_drag_drop';
  const passage = text(payload.passage, 100_000, 'Đoạn văn');
  const instruction = text(payload.instruction ?? '', 4000, 'Hướng dẫn');
  if (!Array.isArray(payload.questions)) return fail(400, 'Cần danh sách câu hỏi.');
  const wordBank: GrammarWordToken[] = bankMode && Array.isArray(payload.wordBank) ? payload.wordBank.map((token: any) => ({
    id: typeof token?.id === 'string' && token.id.length > 0 && token.id.length <= 200 ? token.id : makeId('grammar-token'),
    text: text(token?.text, 1000, 'Thẻ từ'),
  })) : [];
  const questions: GrammarQuestion[] = payload.questions.map((question: any, index: number) => {
    if (!question || typeof question !== 'object') return fail(400, `Câu ${index + 1}: không hợp lệ.`);
    const id = typeof question.id === 'string' && question.id.length > 0 && question.id.length <= 200 ? question.id : makeId('grammar-question');
    const options = !bankMode && Array.isArray(question.options) ? question.options.map((option: any, i: number) => ({
      id: typeof option?.id === 'string' && option.id.length > 0 && option.id.length <= 200 ? option.id : makeId('grammar-option'),
      text: text(option?.text, 1000, `Câu ${index + 1}, lựa chọn ${i + 1}`), originalPosition: i + 1,
    })) : [];
    const score = Number(question.score ?? 1);
    if (!Number.isFinite(score) || score < 1) return fail(400, `Câu ${index + 1}: điểm không hợp lệ.`);
    return {
      id, questionType: bankMode ? 'bank_select' : 'multiple_choice',
      questionText: bankMode ? `Ô trống ${question.blankNumber}` : text(question.questionText, 4000, `Câu ${index + 1}`),
      options, correctOptionId: typeof question.correctOptionId === 'string' ? question.correctOptionId : '',
      explanation: text(question.explanation, 6000, `Giải thích câu ${index + 1}`), score, position: index + 1,
      ...(bankMode ? { blankNumber: question.blankNumber } : {}),
    };
  });
  const errors = validateGrammarPassage({ displayMode: mode, passage, instruction, wordBank, questions });
  if (errors.length) throw Object.assign(new Error(errors.join(' ')), { status: 400, details: errors });
  return { displayMode: mode, questionType: bankMode ? 'bank_select' as const : 'multiple_choice' as const, passage, instruction, wordBank, questions };
}

export function passageAttemptSnapshot(set: Record<string, any>, shuffleBank: (bank: GrammarWordToken[]) => GrammarWordToken[] = bank => bank) {
  const displayMode = grammarDisplayMode(set.displayMode);
  if (displayMode !== 'passage_drag_drop' && displayMode !== 'reading_comprehension') return {};
  const bank: GrammarWordToken[] = (set.wordBank || []).map((token: GrammarWordToken) => ({ id: token.id, text: token.text }));
  return {
    displayMode, passageSnapshot: String(set.passage || ''), instructionSnapshot: String(set.instruction || ''),
    wordBankSnapshot: displayMode === 'passage_drag_drop' && set.shuffleOptions ? shuffleBank(bank) : bank,
    answersRevision: 0,
  };
}

/** One revision replaces the entire bank mapping, so moves/clears persist together. */
export function updateBankAnswers(attempt: GrammarAttempt, payload: Record<string, any>, timestamp: string): GrammarAttempt {
  if (attempt.status === 'completed') return fail(400, 'Bài đã nộp, không thể thay đổi đáp án.');
  if (!payload.bankAnswers || typeof payload.bankAnswers !== 'object' || Array.isArray(payload.bankAnswers)) return fail(400, 'Cần danh sách vị trí thẻ từ.');
  if (typeof payload.mutationId !== 'string' || !/^[\w-]{8,120}$/.test(payload.mutationId)) return fail(400, 'Mã lưu đáp án không hợp lệ.');
  const bank = new Map((attempt.wordBankSnapshot || []).map(token => [token.id, token]));
  const questionMap = new Map(attempt.questions.map(question => [question.id, question]));
  const used = new Set<string>();
  const answers: GrammarAttemptAnswer[] = Object.entries(payload.bankAnswers).map(([id, tokenId]) => {
    const question = questionMap.get(id);
    if (!question || typeof tokenId !== 'string' || !bank.has(tokenId)) return fail(400, 'Ô trống hoặc thẻ từ không hợp lệ.');
    if (used.has(tokenId)) return fail(400, 'Mỗi thẻ từ chỉ được sử dụng một lần.');
    used.add(tokenId);
    const isCorrect = bank.has(question.correctOptionId || '') && grammarTokenText(bank.get(tokenId)!.text) === grammarTokenText(bank.get(question.correctOptionId!)!.text);
    return {
      id: `grammar-bank-answer-${createHash('sha256').update(`${attempt.id}:${id}`).digest('hex').slice(0, 32)}`,
      attemptQuestionId: id, questionId: question.questionId, selectedOptionId: tokenId,
      correctOptionId: question.correctOptionId, isCorrect,
      scoreAwarded: isCorrect ? question.scoreSnapshot : 0, answeredAt: timestamp,
    };
  });
  if (attempt.lastAnswerMutationId === payload.mutationId) {
    const current = new Map(attempt.answers.map(answer => [answer.attemptQuestionId, answer.selectedOptionId]));
    if (answers.length !== current.size || answers.some(answer => current.get(answer.attemptQuestionId) !== answer.selectedOptionId)) return fail(409, 'Mã lưu đã được dùng cho đáp án khác.');
    return attempt;
  }
  if (!Number.isSafeInteger(payload.answersRevision) || payload.answersRevision !== (attempt.answersRevision || 0)) return fail(409, 'Đáp án đã thay đổi ở lượt lưu khác. Hãy tải lại để tiếp tục.');
  if (attempt.status === 'prepared' && !answers.length) return fail(400, 'Hãy điền ít nhất một ô để bắt đầu.');
  return { ...attempt, status: 'in_progress', answers, answersRevision: (attempt.answersRevision || 0) + 1, lastAnswerMutationId: payload.mutationId };
}

export function grammarReviewEnabled(attempt: Record<string, any>, set: Record<string, any>) {
  return grammarDisplayMode(attempt.displayMode) === 'standard'
    ? Boolean(set?.showReviewAfterSubmit)
    : attempt.reviewPolicySnapshot?.showReviewAfterSubmit === true;
}
