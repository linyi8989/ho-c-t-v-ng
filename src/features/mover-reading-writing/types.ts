export const MOVER_READING_WRITING_PAPER_ID = 'reading-writing' as const;
export const MOVER_READING_WRITING_LEGACY_SCHEMA_VERSION = 1 as const;
export const MOVER_READING_WRITING_SCHEMA_VERSION = 2 as const;
export type MoverReadingWritingSchemaVersion =
  | typeof MOVER_READING_WRITING_LEGACY_SCHEMA_VERSION
  | typeof MOVER_READING_WRITING_SCHEMA_VERSION;
export const MOVER_READING_WRITING_PART_COUNTS = [6, 6, 6, 7, 10, 5] as const;
export const MOVER_READING_WRITING_TOTAL_QUESTIONS = 40 as const;

export type MoverReadingWritingVisibility = 'draft' | 'public' | 'assignment';
export type MoverReadingWritingSetStatus = 'draft' | 'published' | 'archived';

export interface MoverReadingWritingExample {
  prompt: string;
  answer: string;
}

export interface MoverReadingWritingTextQuestion {
  id: string;
  prompt: string;
  acceptedAnswers: string[];
}

export interface MoverReadingWritingOption {
  id: string;
  text: string;
}

export interface MoverReadingWritingChoiceQuestion {
  id: string;
  prompt: string;
  options: [MoverReadingWritingOption, MoverReadingWritingOption, MoverReadingWritingOption];
  correctOptionId: string;
}

export interface MoverReadingWritingPartBase {
  part: 1 | 2 | 3 | 4 | 5 | 6;
  title: string;
  instruction: string;
}

export interface MoverReadingWritingPart1 extends MoverReadingWritingPartBase {
  part: 1;
  wordBankAssetId: string;
  wordBankUrl?: string;
  example?: MoverReadingWritingExample;
  questions: MoverReadingWritingTextQuestion[];
}

export interface MoverReadingWritingPart2Question {
  id: string;
  statement: string;
  correctAnswer: 'yes' | 'no';
}

export interface MoverReadingWritingPart2 extends MoverReadingWritingPartBase {
  part: 2;
  sceneAssetId: string;
  sceneUrl?: string;
  examples: Array<MoverReadingWritingExample & { answer: 'yes' | 'no' }>;
  questions: MoverReadingWritingPart2Question[];
}

export interface MoverReadingWritingDialogueQuestion extends MoverReadingWritingChoiceQuestion {
  promptSpeaker?: string;
  answerSpeaker?: string;
}

export interface MoverReadingWritingPart3 extends MoverReadingWritingPartBase {
  part: 3;
  sceneAssetId: string;
  sceneUrl?: string;
  example?: MoverReadingWritingDialogueQuestion;
  questions: MoverReadingWritingDialogueQuestion[];
}

export interface MoverReadingWritingGap {
  id: string;
  acceptedAnswers: string[];
}

export interface MoverReadingWritingPart4 extends MoverReadingWritingPartBase {
  part: 4;
  wordBankAssetId: string;
  wordBankUrl?: string;
  storyTemplate: string;
  example?: MoverReadingWritingExample;
  gaps: MoverReadingWritingGap[];
  titleQuestion: MoverReadingWritingChoiceQuestion;
}

export interface MoverReadingWritingPart5Scene {
  id: string;
  imageAssetId: string;
  imageUrl?: string;
  passage: string;
  questions: MoverReadingWritingTextQuestion[];
}

export interface MoverReadingWritingPart5 extends MoverReadingWritingPartBase {
  part: 5;
  example?: MoverReadingWritingExample;
  scenes: [MoverReadingWritingPart5Scene, MoverReadingWritingPart5Scene, MoverReadingWritingPart5Scene];
}

export interface MoverReadingWritingPart6 extends MoverReadingWritingPartBase {
  part: 6;
  passageSourceAssetId?: string;
  passageSourceUrl?: string;
  illustrationAssetId: string;
  illustrationUrl?: string;
  optionsAssetId?: string;
  optionsUrl?: string;
  passageTitle: string;
  passageTemplate: string;
  example?: MoverReadingWritingExample;
  gaps: MoverReadingWritingGap[];
}

export type MoverReadingWritingPart =
  | MoverReadingWritingPart1
  | MoverReadingWritingPart2
  | MoverReadingWritingPart3
  | MoverReadingWritingPart4
  | MoverReadingWritingPart5
  | MoverReadingWritingPart6;

export interface MoverReadingWritingContent {
  moduleId: 'mover';
  paperId: typeof MOVER_READING_WRITING_PAPER_ID;
  schemaVersion: MoverReadingWritingSchemaVersion;
  title: string;
  description: string;
  level: string;
  coverAssetId?: string;
  coverUrl?: string;
  timeLimitMinutes?: number;
  showReviewAfterSubmit: boolean;
  parts: [
    MoverReadingWritingPart1,
    MoverReadingWritingPart2,
    MoverReadingWritingPart3,
    MoverReadingWritingPart4,
    MoverReadingWritingPart5,
    MoverReadingWritingPart6,
  ];
}

export interface MoverReadingWritingSetSummary {
  id: string;
  moduleId: 'mover';
  paperId: typeof MOVER_READING_WRITING_PAPER_ID;
  schemaVersion: MoverReadingWritingSchemaVersion;
  ownerId: string;
  title: string;
  description: string;
  level: string;
  status: MoverReadingWritingSetStatus;
  visibility: MoverReadingWritingVisibility;
  shareToken?: string;
  publishedVersionId?: string;
  publishedVersionNumber?: number;
  coverUrl?: string;
  timeLimitMinutes?: number;
  createdAt: string;
  updatedAt: string;
}

export interface MoverReadingWritingPlayableSet extends MoverReadingWritingSetSummary {
  versionId: string;
  versionNumber: number;
  content: MoverReadingWritingContent;
}

export interface MoverReadingWritingAnswers {
  part1: Record<string, string>;
  part2: Record<string, 'yes' | 'no' | ''>;
  part3: Record<string, string>;
  part4: { gaps: Record<string, string>; titleOptionId: string };
  part5: Record<string, string>;
  part6: Record<string, string>;
}

export interface MoverReadingWritingQuestionResult {
  part: 1 | 2 | 3 | 4 | 5 | 6;
  questionId: string;
  correct: boolean;
  unanswered: boolean;
  prompt: string;
  userAnswer: string;
  correctAnswer: string;
}

export type MoverReadingWritingVisualReviewState = 'correct' | 'incorrect' | 'unanswered';

export interface MoverReadingWritingVisualReviewExample {
  prompt: string;
  answer: string;
}

export interface MoverReadingWritingVisualReviewBaseItem {
  questionNumber: number;
  state: MoverReadingWritingVisualReviewState;
  prompt: string;
  userAnswer: string;
  correctAnswer: string;
}

export interface MoverReadingWritingVisualReviewOption {
  label: string;
  text: string;
}

export interface MoverReadingWritingVisualReviewChoiceItem extends MoverReadingWritingVisualReviewBaseItem {
  options: MoverReadingWritingVisualReviewOption[];
  selectedOptionIndex: number;
  correctOptionIndex: number;
}

export type MoverReadingWritingVisualReviewPart =
  | {
      part: 1;
      mode: 'text-questions';
      title: string;
      instruction: string;
      imageUrl?: string;
      example?: MoverReadingWritingVisualReviewExample;
      items: MoverReadingWritingVisualReviewBaseItem[];
    }
  | {
      part: 2;
      mode: 'yes-no';
      title: string;
      instruction: string;
      imageUrl?: string;
      examples: MoverReadingWritingVisualReviewExample[];
      items: MoverReadingWritingVisualReviewChoiceItem[];
    }
  | {
      part: 3;
      mode: 'text-options';
      title: string;
      instruction: string;
      imageUrl?: string;
      example?: MoverReadingWritingVisualReviewExample;
      items: MoverReadingWritingVisualReviewChoiceItem[];
    }
  | {
      part: 4;
      mode: 'story-gaps-title';
      title: string;
      instruction: string;
      imageUrl?: string;
      storyTemplate: string;
      example?: MoverReadingWritingVisualReviewExample;
      gaps: MoverReadingWritingVisualReviewBaseItem[];
      titleItem: MoverReadingWritingVisualReviewChoiceItem;
    }
  | {
      part: 5;
      mode: 'scene-text';
      title: string;
      instruction: string;
      example?: MoverReadingWritingVisualReviewExample;
      scenes: Array<{
        imageUrl?: string;
        passage: string;
        items: MoverReadingWritingVisualReviewBaseItem[];
      }>;
    }
  | {
      part: 6;
      mode: 'passage-text';
      title: string;
      instruction: string;
      illustrationUrl?: string;
      optionsUrl?: string;
      passageTitle: string;
      passageTemplate: string;
      example?: MoverReadingWritingVisualReviewExample;
      items: MoverReadingWritingVisualReviewBaseItem[];
    }
  | {
      part: 6;
      mode: 'passage-options';
      title: string;
      instruction: string;
      illustrationUrl?: string;
      optionsUrl?: string;
      passageTitle: string;
      passageTemplate: string;
      example?: MoverReadingWritingVisualReviewExample;
      items: MoverReadingWritingVisualReviewChoiceItem[];
    };

export interface MoverReadingWritingVisualReviewSnapshot {
  schemaVersion: 1;
  totalCount: typeof MOVER_READING_WRITING_TOTAL_QUESTIONS;
  parts: MoverReadingWritingVisualReviewPart[];
}

export interface MoverReadingWritingGradeResult {
  score: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  totalCount: typeof MOVER_READING_WRITING_TOTAL_QUESTIONS;
  questions: MoverReadingWritingQuestionResult[];
}

export interface MoverReadingWritingCompletedAttempt {
  id: string;
  setId: string;
  versionId: string;
  score: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  totalCount: number;
  completedAt: string;
  durationSeconds: number;
}

export interface MoverReadingWritingAttemptReview {
  attemptId: string;
  setId: string;
  versionId: string;
  title: string;
  score: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  totalCount: number;
  completedAt: string;
  questions: MoverReadingWritingQuestionResult[];
  visualReview?: MoverReadingWritingVisualReviewSnapshot;
}

export function createEmptyMoverReadingWritingAnswers(): MoverReadingWritingAnswers {
  return {
    part1: {},
    part2: {},
    part3: {},
    part4: { gaps: {}, titleOptionId: '' },
    part5: {},
    part6: {},
  };
}
