import type { ExamModuleId, ExamPaperId } from '../listening-library/types';

export const EXAM_CONTENT_SCHEMA_VERSION = 1;

export type ExamQuestionType =
  | 'single-choice'
  | 'multiple-choice'
  | 'short-answer'
  | 'true-false'
  | 'true-false-not-given'
  | 'yes-no-not-given'
  | 'matching'
  | 'long-writing';

export interface ExamOption {
  id: string;
  label: string;
  text: string;
  imageAssetId?: string;
  imageUrl?: string;
}

export interface ExamQuestion {
  id: string;
  number: number;
  type: ExamQuestionType;
  prompt: string;
  context?: string;
  imageAssetId?: string;
  imageUrl?: string;
  options: ExamOption[];
  /** Private grading data; removed from every playable payload. */
  correctOptionIds: string[];
  /** Private grading data; removed from every playable payload. */
  acceptedAnswers: string[];
  points: number;
  maxSelections?: number;
  maxWords?: number;
  minWords?: number;
  rubric?: string;
  modelAnswer?: string;
}

export interface ExamPartContent {
  id: string;
  part: number;
  title: string;
  instruction: string;
  passage?: string;
  imageAssetId?: string;
  imageUrl?: string;
  audioAssetId?: string;
  audioUrl?: string;
  questions: ExamQuestion[];
}

export interface ExamPaperContent {
  schemaVersion: number;
  moduleId: Exclude<ExamModuleId, 'mover'>;
  paperId: ExamPaperId;
  title: string;
  description: string;
  level: string;
  coverAssetId?: string;
  coverUrl?: string;
  timeLimitMinutes?: number;
  showReviewAfterSubmit: boolean;
  parts: ExamPartContent[];
}

export type ExamVisibility = 'draft' | 'public' | 'assignment';
export type ExamSetStatus = 'draft' | 'published' | 'archived';

export interface ExamSetSummary {
  id: string;
  moduleId: ExamPaperContent['moduleId'];
  paperId: ExamPaperId;
  schemaVersion: number;
  title: string;
  description: string;
  level: string;
  visibility: ExamVisibility;
  status: ExamSetStatus;
  coverUrl?: string;
  timeLimitMinutes?: number;
  publishedVersionId?: string;
  publishedVersionNumber?: number;
  shareToken?: string;
  draftRevision?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExamPlayableSet extends Omit<ExamSetSummary, 'shareToken' | 'draftRevision'> {
  versionId: string;
  versionNumber: number;
  content: ExamPaperContent;
}

export type ExamAnswerValue = string | string[];
export type ExamAnswers = Record<string, ExamAnswerValue>;

export interface ExamQuestionResult {
  questionId: string;
  part: number;
  number: number;
  type: ExamQuestionType;
  prompt: string;
  userAnswer: string | string[];
  correctAnswer?: string | string[];
  correct: boolean | null;
  unanswered: boolean;
  pointsAwarded: number;
  maxPoints: number;
  pendingManualReview: boolean;
}

export interface ExamCompletedAttempt {
  id: string;
  setId: string;
  versionId: string;
  status: 'completed' | 'pending_review';
  score: number;
  objectiveScore: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  totalCount: number;
  pendingManualCount: number;
  completedAt: string;
  durationSeconds: number;
}

export interface ExamAttemptReview {
  attempt: ExamCompletedAttempt;
  questions: ExamQuestionResult[];
}

export interface ExamPartDefinition {
  id: string;
  displayName: string;
  title: string;
  instruction: string;
  questionCount: number;
  questionCountFlexible?: boolean;
  defaultQuestionType: ExamQuestionType;
  allowedQuestionTypes: readonly ExamQuestionType[];
  requiresAudio?: boolean;
  pointsPerQuestion?: number;
  longWriting?: boolean;
  minWords?: number;
}

export interface ExamPaperDefinition {
  moduleId: ExamPaperContent['moduleId'];
  paperId: ExamPaperId;
  displayName: string;
  description: string;
  level: string;
  timeLimitMinutes: number;
  totalQuestionCount: number;
  flexiblePartDistribution?: boolean;
  parts: readonly ExamPartDefinition[];
}

