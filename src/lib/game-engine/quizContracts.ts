export type QuizQuestionType = 'term' | 'meaning' | 'sound';
export type QuizAnswerType = 'term' | 'meaning';

export interface QuizContract {
  questionType: QuizQuestionType;
  answerType: QuizAnswerType;
  contractVersion: number;
}

interface QuizVocabularyItem {
  term?: unknown;
  meaning?: unknown;
}

const CURRENT_QUIZ_CONTRACTS: Record<string, QuizContract> = {
  'quiz-en-vi': {
    questionType: 'term',
    answerType: 'meaning',
    contractVersion: 1
  },
  'quiz-vi-en': {
    questionType: 'meaning',
    answerType: 'term',
    contractVersion: 1
  },
  'quiz-sound': {
    questionType: 'sound',
    answerType: 'meaning',
    contractVersion: 2
  }
};

const LEGACY_QUIZ_CONTRACTS: Record<string, QuizContract> = {
  ...CURRENT_QUIZ_CONTRACTS,
  'quiz-sound': {
    questionType: 'sound',
    answerType: 'term',
    contractVersion: 1
  }
};

function isQuestionType(value: unknown): value is QuizQuestionType {
  return value === 'term' || value === 'meaning' || value === 'sound';
}

function isAnswerType(value: unknown): value is QuizAnswerType {
  return value === 'term' || value === 'meaning';
}

export function getCurrentQuizContract(gameId: string): QuizContract | null {
  const contract = CURRENT_QUIZ_CONTRACTS[gameId];
  return contract ? { ...contract } : null;
}

export function resolveStoredQuizContract(
  gameId: string,
  storedConfig: Record<string, unknown> | null | undefined
): QuizContract | null {
  const fallback = LEGACY_QUIZ_CONTRACTS[gameId];
  if (!fallback) return null;

  const storedVersion = Number(storedConfig?.contractVersion);
  return {
    questionType: isQuestionType(storedConfig?.questionType)
      ? storedConfig.questionType
      : fallback.questionType,
    answerType: isAnswerType(storedConfig?.answerType)
      ? storedConfig.answerType
      : fallback.answerType,
    contractVersion: Number.isInteger(storedVersion) && storedVersion > 0
      ? storedVersion
      : fallback.contractVersion
  };
}

export function isQuizItemEligible(
  item: QuizVocabularyItem,
  contract: Pick<QuizContract, 'questionType' | 'answerType'>
) {
  const term = String(item.term || '').trim();
  const meaning = String(item.meaning || '').trim();
  const needsMeaning = contract.questionType === 'meaning' || contract.answerType === 'meaning';
  return Boolean(term && (!needsMeaning || meaning));
}

export function getQuizAnswerValue(
  item: QuizVocabularyItem,
  answerType: QuizAnswerType
) {
  return String(answerType === 'term' ? item.term || '' : item.meaning || '').trim();
}

export function getQuizQuestionText(
  item: QuizVocabularyItem,
  questionType: QuizQuestionType
) {
  return String(questionType === 'meaning' ? item.meaning || '' : item.term || '').trim();
}
