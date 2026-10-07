import type {
  AnswerSpec,
  AssessmentAnswerGradeResult,
  AssessmentUserAnswer,
  TextNormalizationPolicy
} from '../../shared/competition/answer.js';

type AnswerKind = AnswerSpec['kind'];
type AnswerGrader = (answer: AnswerSpec, userAnswer: AssessmentUserAnswer) => AssessmentAnswerGradeResult;

interface Rational {
  numerator: bigint;
  denominator: bigint;
}

const CORRECT: AssessmentAnswerGradeResult = { isCorrect: true, scoreRatio: 1 };
const INCORRECT: AssessmentAnswerGradeResult = { isCorrect: false, scoreRatio: 0 };
const UNANSWERED: AssessmentAnswerGradeResult = { isCorrect: false, scoreRatio: 0, errorCode: 'UNANSWERED' };
const INVALID_FORMAT: AssessmentAnswerGradeResult = { isCorrect: false, scoreRatio: 0, errorCode: 'INVALID_FORMAT' };

function absolute(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function parseInteger(value: string, allowLeadingPlus = true): bigint | undefined {
  const trimmed = String(value ?? '').trim();
  if (!allowLeadingPlus && trimmed.startsWith('+')) return undefined;
  if (!/^[+-]?\d+$/.test(trimmed)) return undefined;
  try {
    return BigInt(trimmed);
  } catch {
    return undefined;
  }
}

function parseDecimal(value: string, acceptCommaDecimal = false): Rational | undefined {
  let normalized = String(value ?? '').trim();
  if (acceptCommaDecimal && normalized.includes(',')) {
    if (normalized.includes('.') || (normalized.match(/,/g) || []).length !== 1) return undefined;
    normalized = normalized.replace(',', '.');
  }
  if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(normalized)) return undefined;

  const sign = normalized.startsWith('-') ? -1n : 1n;
  const unsigned = normalized.replace(/^[+-]/, '');
  const [whole, fraction = ''] = unsigned.split('.');
  const denominator = 10n ** BigInt(fraction.length);
  const digits = `${whole || '0'}${fraction}`;
  return { numerator: sign * BigInt(digits), denominator };
}

function parseFraction(value: string): Rational | undefined {
  const match = String(value ?? '').trim().match(/^([+-]?\d+)\s*\/\s*([+-]?\d+)$/);
  if (!match) return undefined;
  const numerator = parseInteger(match[1]);
  const denominator = parseInteger(match[2]);
  if (numerator === undefined || denominator === undefined || denominator === 0n) return undefined;
  return { numerator, denominator };
}

function rationalsEqual(left: Rational, right: Rational): boolean {
  return left.numerator * right.denominator === right.numerator * left.denominator;
}

function rationalsWithinTolerance(left: Rational, right: Rational, tolerance?: Rational): boolean {
  if (!tolerance) return rationalsEqual(left, right);
  if (tolerance.numerator < 0n) return false;
  const differenceNumerator = absolute(left.numerator * right.denominator - right.numerator * left.denominator);
  const differenceDenominator = left.denominator * right.denominator;
  return differenceNumerator * tolerance.denominator <= tolerance.numerator * differenceDenominator;
}

export function normalizeTextWithPolicy(value: string, policy: TextNormalizationPolicy): string {
  let normalized = String(value ?? '');
  if (policy.unicode !== 'none') normalized = normalized.normalize(policy.unicode);
  if (policy.normalizeApostrophes) {
    normalized = normalized.replace(/[’‘`]/g, "'").replace(/[“”]/g, '"');
  }
  if (!policy.caseSensitive) normalized = normalized.toLocaleLowerCase('vi-VN');
  if (policy.ignoreDiacritics) {
    normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
  }
  if (policy.ignorePunctuation) normalized = normalized.replace(/[\p{P}]/gu, '');
  if (policy.collapseSpaces) normalized = normalized.replace(/\s+/g, ' ');
  if (policy.trim) normalized = normalized.trim();
  if (policy.unicode === 'NFC') normalized = normalized.normalize('NFC');
  if (policy.unicode === 'NFKC') normalized = normalized.normalize('NFKC');
  return normalized;
}

function normalizeUnit(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('vi-VN').replace(/\s+/g, ' ').trim();
}

function binaryResult(isCorrect: boolean, normalizedAnswer?: string): AssessmentAnswerGradeResult {
  return { ...(isCorrect ? CORRECT : INCORRECT), normalizedAnswer };
}

export class GraderRegistry {
  private graders = new Map<AnswerKind, AnswerGrader>();

  constructor() {
    this.registerDefaults();
  }

  register(kind: AnswerKind, grader: AnswerGrader): void {
    this.graders.set(kind, grader);
  }

  grade(answer: AnswerSpec, userAnswer: AssessmentUserAnswer = {}): AssessmentAnswerGradeResult {
    const grader = this.graders.get(answer.kind);
    if (!grader) return { ...INCORRECT, errorCode: 'UNSUPPORTED_ANSWER_KIND' };
    const result = grader(answer, userAnswer);
    return { ...result, scoreRatio: Math.max(0, Math.min(1, result.scoreRatio)) };
  }

  private registerDefaults(): void {
    this.register('single-choice', (answer, user) => {
      if (answer.kind !== 'single-choice') return INCORRECT;
      if (!user.selectedOptionId) return UNANSWERED;
      return binaryResult(user.selectedOptionId.trim() === answer.correctOptionId.trim());
    });

    this.register('true-false', (answer, user) => {
      if (answer.kind !== 'true-false') return INCORRECT;
      if (typeof user.booleanAnswer !== 'boolean') return UNANSWERED;
      return binaryResult(user.booleanAnswer === answer.correctValue);
    });

    this.register('text', (answer, user) => {
      if (answer.kind !== 'text') return INCORRECT;
      if (user.textAnswer === undefined || user.textAnswer === '') return UNANSWERED;
      const normalized = normalizeTextWithPolicy(user.textAnswer, answer.normalization);
      const accepted = answer.acceptedAnswers.map(value => normalizeTextWithPolicy(value, answer.normalization));
      return binaryResult(accepted.includes(normalized), normalized);
    });

    this.register('integer', (answer, user) => {
      if (answer.kind !== 'integer') return INCORRECT;
      if (user.textAnswer === undefined || user.textAnswer === '') return UNANSWERED;
      const actual = parseInteger(user.textAnswer, answer.allowLeadingPlus === true);
      const expected = parseInteger(answer.value);
      if (actual === undefined || expected === undefined) return INVALID_FORMAT;
      return binaryResult(actual === expected, actual.toString());
    });

    this.register('decimal', (answer, user) => {
      if (answer.kind !== 'decimal') return INCORRECT;
      if (user.textAnswer === undefined || user.textAnswer === '') return UNANSWERED;
      const actual = parseDecimal(user.textAnswer, answer.acceptCommaDecimal === true);
      const expected = parseDecimal(answer.value);
      const tolerance = answer.tolerance === undefined ? undefined : parseDecimal(answer.tolerance);
      if (!actual || !expected || (answer.tolerance !== undefined && !tolerance)) return INVALID_FORMAT;
      return binaryResult(rationalsWithinTolerance(actual, expected, tolerance));
    });

    this.register('fraction', (answer, user) => {
      if (answer.kind !== 'fraction') return INCORRECT;
      if (user.textAnswer === undefined || user.textAnswer === '') return UNANSWERED;
      const actual = parseFraction(user.textAnswer);
      const expectedNumerator = parseInteger(answer.numerator);
      const expectedDenominator = parseInteger(answer.denominator);
      if (!actual || expectedNumerator === undefined || expectedDenominator === undefined || expectedDenominator === 0n) return INVALID_FORMAT;
      const expected = { numerator: expectedNumerator, denominator: expectedDenominator };
      const matches = answer.acceptEquivalent
        ? rationalsEqual(actual, expected)
        : actual.numerator === expected.numerator && actual.denominator === expected.denominator;
      return binaryResult(matches);
    });

    this.register('numeric-with-unit', (answer, user) => {
      if (answer.kind !== 'numeric-with-unit') return INCORRECT;
      if (user.textAnswer === undefined || user.textAnswer === '') return UNANSWERED;
      const match = user.textAnswer.trim().match(/^([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*(\S(?:.*\S)?)$/u);
      if (!match) return INVALID_FORMAT;
      const actual = parseDecimal(match[1]);
      const expected = parseDecimal(answer.value);
      const tolerance = answer.tolerance === undefined ? undefined : parseDecimal(answer.tolerance);
      if (!actual || !expected || (answer.tolerance !== undefined && !tolerance)) return INVALID_FORMAT;
      const acceptedUnits = answer.acceptedUnits.map(normalizeUnit);
      const unitMatches = acceptedUnits.includes(normalizeUnit(match[2]));
      return binaryResult(unitMatches && rationalsWithinTolerance(actual, expected, tolerance));
    });

    this.register('ordering', (answer, user) => {
      if (answer.kind !== 'ordering') return INCORRECT;
      if (!user.orderedTokenIds?.length) return UNANSWERED;
      return binaryResult(
        user.orderedTokenIds.length === answer.orderedTokenIds.length
        && user.orderedTokenIds.every((id, index) => id === answer.orderedTokenIds[index])
      );
    });

    this.register('matching', (answer, user) => {
      if (answer.kind !== 'matching') return INCORRECT;
      if (!user.pairMatches || Object.keys(user.pairMatches).length === 0) return UNANSWERED;
      const entries = Object.entries(answer.correctPairMatches);
      if (entries.length === 0) return INCORRECT;
      const matched = entries.filter(([leftId, rightId]) => user.pairMatches?.[leftId] === rightId).length;
      const scoreRatio = matched / entries.length;
      return { isCorrect: scoreRatio === 1, scoreRatio };
    });

    this.register('hotspot', (answer, user) => {
      if (answer.kind !== 'hotspot') return INCORRECT;
      if (!user.selectedRegionId) return UNANSWERED;
      return binaryResult(user.selectedRegionId === answer.correctRegionId);
    });
  }
}

export const graderRegistry = new GraderRegistry();
