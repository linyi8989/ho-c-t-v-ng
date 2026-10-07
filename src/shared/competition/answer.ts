export interface TextNormalizationPolicy {
  unicode: 'NFC' | 'NFKC' | 'none';
  trim: boolean;
  collapseSpaces: boolean;
  caseSensitive: boolean;
  ignorePunctuation: boolean;
  ignoreDiacritics: boolean;
  normalizeApostrophes?: boolean;
}

export const DEFAULT_ENGLISH_TEXT_NORMALIZATION: TextNormalizationPolicy = {
  unicode: 'NFC',
  trim: true,
  collapseSpaces: true,
  caseSensitive: false,
  ignorePunctuation: true,
  ignoreDiacritics: false,
  normalizeApostrophes: true
};

export const DEFAULT_VIETNAMESE_TEXT_NORMALIZATION: TextNormalizationPolicy = {
  unicode: 'NFC',
  trim: true,
  collapseSpaces: true,
  caseSensitive: false,
  ignorePunctuation: false,
  ignoreDiacritics: false,
  normalizeApostrophes: true
};

export type AnswerSpec =
  | {
      kind: 'single-choice';
      correctOptionId: string;
    }
  | {
      kind: 'true-false';
      correctValue: boolean;
    }
  | {
      kind: 'text';
      acceptedAnswers: string[];
      normalization: TextNormalizationPolicy;
    }
  | {
      kind: 'integer';
      value: string;
      allowLeadingPlus?: boolean;
    }
  | {
      kind: 'decimal';
      value: string;
      tolerance?: string;
      acceptCommaDecimal?: boolean;
    }
  | {
      kind: 'fraction';
      numerator: string;
      denominator: string;
      acceptEquivalent: boolean;
    }
  | {
      kind: 'numeric-with-unit';
      value: string;
      acceptedUnits: string[];
      tolerance?: string;
    }
  | {
      kind: 'ordering';
      orderedTokenIds: string[];
    }
  | {
      kind: 'matching';
      correctPairMatches: Record<string, string>;
    }
  | {
      kind: 'hotspot';
      correctRegionId: string;
    };

export interface AnswerFeedback {
  explanation?: string;
  vietnameseMeaning?: string;
  pronunciationIpa?: string;
}

export interface AssessmentUserAnswer {
  selectedOptionId?: string;
  booleanAnswer?: boolean;
  textAnswer?: string;
  orderedTokenIds?: string[];
  pairMatches?: Record<string, string>;
  selectedRegionId?: string;
}

export interface AssessmentAnswerGradeResult {
  isCorrect: boolean;
  /** 0..1; binary for current interactions, partial for matching. */
  scoreRatio: number;
  normalizedAnswer?: string;
  errorCode?: 'UNANSWERED' | 'INVALID_FORMAT' | 'UNSUPPORTED_ANSWER_KIND';
}
