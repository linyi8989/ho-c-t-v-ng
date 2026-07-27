export const GRAMMAR_TEXT_GRADING_VERSION = 2;

const APOSTROPHE_VARIANTS = /[\u02BC\u2018\u2019\u201B\u2032\uFF07]/gu;
const INVISIBLE_FORMATTING = /[\u200B-\u200D\u2060\uFEFF]/gu;
const SPACED_PUNCTUATION = /\s*([.,;:!?])\s*/gu;

export function normalizeGrammarTextAnswer(value: unknown) {
  return String(value ?? '')
    .normalize('NFKC')
    .replace(APOSTROPHE_VARIANTS, "'")
    .replace(INVISIBLE_FORMATTING, '')
    .trim()
    .replace(/\s+/gu, ' ')
    .replace(SPACED_PUNCTUATION, '$1')
    .toLocaleLowerCase('vi-VN')
    .slice(0, 4000);
}

export function isGrammarTextAnswerCorrect(
  studentAnswer: unknown,
  correctAnswer: unknown,
  acceptedAnswers: unknown = []
) {
  const normalizedStudentAnswer = normalizeGrammarTextAnswer(studentAnswer);
  if (!normalizedStudentAnswer) return false;

  const alternatives = Array.isArray(acceptedAnswers) ? acceptedAnswers : [];
  return [correctAnswer, ...alternatives].some(
    answer => normalizeGrammarTextAnswer(answer) === normalizedStudentAnswer
  );
}
