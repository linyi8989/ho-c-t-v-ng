import { createHash } from 'node:crypto';
import type { GrammarAttempt, GrammarAttemptAnswer, GrammarBlock, GrammarQuestion, GrammarWordToken } from '../../types';
import { sanitizeGrammarBlocks, validateGrammarBlocks } from '../../lib/grammarBlocks';
import { normalizePassageExercise, updateBankAnswers } from './passageExercises';

const fail = (status: number, message: string): never => { throw Object.assign(new Error(message), { status }); };
function text(value: unknown, max: number, label: string): string {
  if (typeof value !== 'string' || value.length > max) return fail(400, `${label}: cần văn bản không quá ${max} ký tự.`);
  return value.normalize('NFKC').trim();
}
function identifier(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 200) return fail(400, `${label}: mã không hợp lệ.`);
  return value;
}

/** Canonical questions remain flat; blocks own presentation and source question references only. */
export function normalizeMixedExercise(payload: Record<string, any>, makeId: (prefix: string) => string) {
  if (payload.displayMode !== 'mixed') return null;
  if (payload.contentVersion !== 2) return fail(400, 'Phiên bản bài ngữ pháp nhiều dạng không hợp lệ.');
  if (!Array.isArray(payload.blocks) || !payload.blocks.length || !Array.isArray(payload.questions)) return fail(400, 'Bài nhiều dạng cần danh sách nhóm bài và câu hỏi.');
  const sourceQuestions = new Map<string, Record<string, any>>();
  for (const question of payload.questions) {
    if (!question || typeof question !== 'object' || Array.isArray(question)) return fail(400, 'Câu hỏi không hợp lệ.');
    const id = identifier(question.id, 'Câu hỏi');
    if (sourceQuestions.has(id)) return fail(400, 'Câu hỏi bị trùng ID.');
    sourceQuestions.set(id, question);
  }
  const questions: GrammarQuestion[] = [];
  const blocks: GrammarBlock[] = payload.blocks.map((source: any, index: number) => {
    if (!source || typeof source !== 'object' || Array.isArray(source)) return fail(400, `Nhóm ${index + 1}: không hợp lệ.`);
    if (!['multiple_choice', 'passage_drag_drop', 'reading_comprehension'].includes(source.type)) return fail(400, `Nhóm ${index + 1}: dạng bài không hợp lệ.`);
    const id = identifier(source.id, `Nhóm ${index + 1}`);
    const title = text(source.title ?? '', 240, `Tiêu đề nhóm ${index + 1}`);
    const instruction = text(source.instruction ?? '', 4000, `Hướng dẫn nhóm ${index + 1}`);
    if (!Array.isArray(source.questionIds) || !source.questionIds.length) return fail(400, `Nhóm ${index + 1}: cần câu hỏi.`);
    const questionIds: string[] = source.questionIds.map((value: unknown) => identifier(value, 'Tham chiếu câu hỏi'));
    const rawQuestions = questionIds.map(questionId => {
      const question = sourceQuestions.get(questionId);
      if (!question) return fail(400, `Nhóm ${index + 1}: câu hỏi không tồn tại.`);
      if (question.blockId !== undefined && question.blockId !== id) return fail(400, `Nhóm ${index + 1}: câu hỏi thuộc nhóm khác.`);
      const expectedType = source.type === 'passage_drag_drop' ? 'bank_select' : 'multiple_choice';
      if (question.questionType !== undefined && question.questionType !== expectedType) return fail(400, `Nhóm ${index + 1}: loại câu hỏi không khớp dạng bài.`);
      return question;
    });
    let blockQuestions: GrammarQuestion[];
    let presentation: Pick<GrammarBlock, 'passage' | 'wordBank'> = {};
    if (source.type !== 'multiple_choice') {
      const normalized = normalizePassageExercise({
        displayMode: source.type, passage: source.passage, instruction,
        wordBank: source.wordBank, questions: rawQuestions,
      }, makeId)!;
      blockQuestions = normalized.questions;
      presentation = { passage: normalized.passage, ...(source.type === 'passage_drag_drop' ? { wordBank: normalized.wordBank } : {}) };
    } else {
      blockQuestions = rawQuestions.map((question, questionIndex) => {
        const questionId = identifier(question.id, 'Câu hỏi');
        if (!Array.isArray(question.options)) return fail(400, `Câu ${questionIndex + 1}: cần danh sách lựa chọn.`);
        const score = Number(question.score ?? 1);
        if (!Number.isFinite(score) || score < 1) return fail(400, `Câu ${questionIndex + 1}: điểm không hợp lệ.`);
        return {
          id: questionId, questionType: 'multiple_choice',
          questionText: text(question.questionText, 4000, 'Câu hỏi'),
          options: question.options.map((option: any, optionIndex: number) => {
            if (!option || typeof option !== 'object') return fail(400, 'Lựa chọn không hợp lệ.');
            return { id: identifier(option.id, 'Lựa chọn'), text: text(option.text, 1000, 'Lựa chọn'), originalPosition: optionIndex + 1 };
          }),
          correctOptionId: identifier(question.correctOptionId, 'Đáp án đúng'),
          explanation: text(question.explanation, 6000, 'Giải thích'), score, position: questionIndex + 1,
        };
      });
    }
    for (const question of blockQuestions) questions.push({ ...question, blockId: id, position: questions.length + 1 });
    return { id, type: source.type, title, instruction, ...presentation, questionIds };
  });
  const errors = validateGrammarBlocks({ blocks, questions });
  if (questions.length !== sourceQuestions.size) errors.push('Mỗi câu hỏi phải thuộc đúng một nhóm bài.');
  const tokenIds = blocks.flatMap(block => (block.wordBank || []).map(token => token.id));
  if (new Set(tokenIds).size !== tokenIds.length) errors.push('Các ngân hàng từ có thẻ bị trùng ID.');
  if (errors.length) throw Object.assign(new Error(errors.join(' ')), { status: 400, details: errors });
  return {
    displayMode: 'mixed' as const, contentVersion: 2 as const, questionType: 'multiple_choice' as const,
    blocks, questions, shuffleQuestions: false,
    showExplanationImmediately: blocks.some(block => block.type === 'passage_drag_drop') ? false : Boolean(payload.showExplanationImmediately),
  };
}

export function mixedAttemptSnapshot(set: Record<string, any>, shuffleBank: (bank: GrammarWordToken[], blockId: string) => GrammarWordToken[] = bank => bank) {
  if (set.displayMode !== 'mixed') return {};
  const blocks = sanitizeGrammarBlocks(set.blocks);
  return {
    displayMode: 'mixed' as const, contentVersion: 2 as const, answersRevision: 0,
    blocksSnapshot: blocks.map(block => ({
      ...block, questionIds: [...block.questionIds],
      ...(block.wordBank ? { wordBank: set.shuffleOptions ? shuffleBank(block.wordBank.map(token => ({ ...token })), block.id) : block.wordBank.map(token => ({ ...token })) } : {}),
    })),
  };
}

type MixedAttempt = GrammarAttempt & { lastAnswerMutationHash?: string };
export function updateMixedAnswers(
  attempt: MixedAttempt,
  payload: Record<string, any>,
  timestamp: string,
  buildAnswer: (payload: Record<string, any>) => { answer: GrammarAttemptAnswer; feedback: unknown },
): { attempt: MixedAttempt; answer?: GrammarAttemptAnswer; feedback: unknown } {
  if (attempt.status === 'completed') return fail(400, 'Bài đã nộp, không thể thay đổi đáp án.');
  if (typeof payload.mutationId !== 'string' || !/^[\w-]{8,120}$/.test(payload.mutationId)) return fail(400, 'Mã lưu đáp án không hợp lệ.');
  const bankMutation = payload.bankAnswers !== undefined;
  const question = !bankMutation ? attempt.questions.find(item => item.id === payload.attemptQuestionId) : undefined;
  const blockId = bankMutation ? payload.blockId : question?.blockId;
  const block = attempt.blocksSnapshot?.find(item => item.id === blockId);
  if (!block || (!bankMutation && !question) || (payload.blockId !== undefined && payload.blockId !== block.id)) return fail(400, 'Nhóm bài hoặc câu hỏi không hợp lệ.');
  if (bankMutation && (block.type !== 'passage_drag_drop' || payload.attemptQuestionId !== undefined || !payload.bankAnswers || typeof payload.bankAnswers !== 'object' || Array.isArray(payload.bankAnswers))) return fail(400, 'Danh sách vị trí thẻ từ không hợp lệ.');
  if (!bankMutation && (block.type === 'passage_drag_drop' || question?.questionType !== 'multiple_choice')) return fail(400, 'Câu hỏi cần lưu theo đúng dạng bài.');
  const mutationHash = createHash('sha256').update(JSON.stringify(bankMutation
    ? { blockId: block.id, bankAnswers: Object.entries(payload.bankAnswers).sort(([left], [right]) => left.localeCompare(right)) }
    : { blockId: block.id, attemptQuestionId: question!.id, selectedOptionId: payload.selectedOptionId })).digest('hex');
  if (attempt.lastAnswerMutationId === payload.mutationId) {
    if (attempt.lastAnswerMutationHash !== mutationHash) return fail(409, 'Mã lưu đã được dùng cho đáp án khác.');
    return { attempt, answer: question ? attempt.answers.find(answer => answer.attemptQuestionId === question.id) : undefined, feedback: null };
  }
  if (!Number.isSafeInteger(payload.answersRevision) || payload.answersRevision !== (attempt.answersRevision || 0)) return fail(409, 'Đáp án đã thay đổi ở lượt lưu khác. Hãy tải lại để tiếp tục.');
  let answers: GrammarAttemptAnswer[];
  let answer: GrammarAttemptAnswer | undefined;
  let feedback: unknown = null;
  if (bankMutation) {
    const blockQuestions = attempt.questions.filter(item => item.blockId === block.id && block.questionIds.includes(item.questionId));
    const questionIds = new Set(blockQuestions.map(item => item.id));
    const scoped = updateBankAnswers({
      ...attempt, questions: blockQuestions, wordBankSnapshot: block.wordBank || [],
      answers: attempt.answers.filter(item => questionIds.has(item.attemptQuestionId)),
      lastAnswerMutationId: undefined,
    }, payload, timestamp);
    answers = [...attempt.answers.filter(item => !questionIds.has(item.attemptQuestionId)), ...scoped.answers];
  } else {
    const result = buildAnswer(payload);
    answer = result.answer; feedback = result.feedback;
    answers = [...attempt.answers.filter(item => item.attemptQuestionId !== question!.id), answer];
  }
  return { attempt: {
    ...attempt, status: 'in_progress', answers, answersRevision: (attempt.answersRevision || 0) + 1,
    lastAnswerMutationId: payload.mutationId, lastAnswerMutationHash: mutationHash,
  }, answer, feedback };
}

function pick(record: Record<string, any>, keys: string[]) {
  return Object.fromEntries(keys.filter(key => record[key] !== undefined).map(key => [key, record[key]]));
}
export function sanitizeMixedSetMetadata(set: Record<string, any>) {
  return {
    ...pick(set, ['id', 'title', 'description', 'gradeLevel', 'classId', 'className', 'subject', 'topic', 'tags', 'visibility', 'status', 'shareToken', 'assignmentSlug', 'timeLimitMinutes', 'maxAttempts', 'shuffleQuestions', 'shuffleOptions', 'showExplanationImmediately', 'showReviewAfterSubmit', 'createdAt', 'updatedAt', 'questionCount', 'lifecycleStatus']),
    displayMode: 'mixed', contentVersion: 2, questionType: 'multiple_choice', blocks: sanitizeGrammarBlocks(set.blocks),
  };
}
export function sanitizeMixedAttemptMetadata(attempt: Record<string, any>) {
  return {
    ...pick(attempt, ['id', 'grammarSetId', 'grammarSetTitle', 'assignmentId', 'studentName', 'classId', 'className', 'status', 'score', 'maxScore', 'correctCount', 'wrongCount', 'unansweredCount', 'startedAt', 'completedAt', 'durationSeconds', 'createdAt', 'updatedAt', 'lastSavedAt', 'clientRunId', 'schemaVersion', 'activatedAt', 'grammarSetVersion', 'submissionStatus', 'answersRevision', 'lastAnswerMutationId']),
    displayMode: 'mixed', contentVersion: 2, blocksSnapshot: sanitizeGrammarBlocks(attempt.blocksSnapshot),
    reviewPolicySnapshot: {
      showReviewAfterSubmit: attempt.reviewPolicySnapshot?.showReviewAfterSubmit === true,
      showExplanationImmediately: attempt.reviewPolicySnapshot?.showExplanationImmediately === true,
      policyVersion: Number(attempt.reviewPolicySnapshot?.policyVersion || 1),
    },
  };
}
