import type { ExamModuleId, ExamPaperId } from '../listening-library/types';

export const EXAM_CONTENT_SCHEMA_VERSION = 3;
export const EXAM_LEGACY_CONTENT_SCHEMA_VERSION = 1;
export const EXAM_SUPPORTED_CONTENT_SCHEMA_VERSIONS = [1, 2, 3] as const;

export type ExamQuestionType =
  | 'single-choice'
  | 'multiple-choice'
  | 'short-answer'
  | 'true-false'
  | 'true-false-not-given'
  | 'yes-no-not-given'
  | 'matching'
  | 'scene-draw'
  | 'long-writing';

export interface ExamOption {
  id: string;
  label: string;
  text: string;
  imageAssetId?: string;
  imageUrl?: string;
}

export interface ExamInteractionRegion {
  shape: 'rect' | 'ellipse' | 'polygon';
  x: number;
  y: number;
  width: number;
  height: number;
  points?: Array<{ x: number; y: number }>;
}

export type ExamInteractionFamily = 'choice' | 'matching' | 'text-entry' | 'scene' | 'writing';

export interface ExamInteractionDescriptor {
  family: ExamInteractionFamily;
  subtype: string;
  variant: string;
  schemaVersion: number;
  importReadiness?: 'content-ready' | 'needs-assets' | 'needs-geometry' | 'ready-to-publish';
  warnings?: string[];
}

export interface StarterImageMatchingItem {
  id: string;
  label: string;
  region: ExamInteractionRegion;
  geometryConfirmedByTeacher?: boolean;
  questionId?: string;
}

/** Released compatibility shape. New authoring normalizes this to v2. */
export interface StarterImageMatchingLayoutV1 {
  kind: 'starter-image-matching-v1';
  leftItems: StarterImageMatchingItem[];
  rightItems: StarterImageMatchingItem[];
  exampleMapping?: { leftItemId: string; rightItemId: string };
}

export interface StarterImageMatchingNode {
  id: string;
  label: string;
  hitRegion: ExamInteractionRegion;
  anchor: { x: number; y: number };
  geometryConfirmedByTeacher?: boolean;
}

export interface StarterImageMatchingLayoutV2 {
  kind: 'starter-image-matching-v2';
  sourceNodes: StarterImageMatchingNode[];
  targetNodes: StarterImageMatchingNode[];
  exampleConnection?: { sourceNodeId: string; targetNodeId: string };
  maxConnections: number;
}

export type StarterImageMatchingLayout = StarterImageMatchingLayoutV1 | StarterImageMatchingLayoutV2;

export interface ExamMatchingConnection {
  sourceNodeId: string;
  targetNodeId: string;
}

export interface ExamScenePlacement {
  actionId: string;
  object: string;
  x: number;
  y: number;
}

export interface StarterSceneColourTarget {
  id: string;
  questionId: string;
  label: string;
  region: ExamInteractionRegion;
  geometryConfirmedByTeacher?: boolean;
}

export interface StarterSceneColourLayout {
  kind: 'starter-scene-colour-v1';
  targets: StarterSceneColourTarget[];
  /** Public Part-level palette. The sanitizer derives this from answer colours plus one distractor. */
  studentPalette?: string[];
}

export interface ExamSceneDrawTarget {
  id: string;
  questionId: string;
  label: string;
  object: string;
  /** Public draggable token selected from the teacher-owned media library. */
  tokenAssetId?: string;
  tokenUrl?: string;
  /** Private grading region; removed from playable student content. */
  targetRegion: ExamInteractionRegion;
  geometryConfirmedByTeacher?: boolean;
}

export interface ExamSceneDrawLayout {
  kind: 'scene-draw-v1';
  targets: ExamSceneDrawTarget[];
}

export interface ExamImageTextEntryTarget {
  id: string;
  questionId: string;
  label: string;
  region: ExamInteractionRegion;
  geometryConfirmedByTeacher?: boolean;
}

export interface ExamImageTextEntryLayout {
  kind: 'image-text-entry-v1';
  targets: ExamImageTextEntryTarget[];
}

export interface FlyerNamePlacementTarget {
  id: string;
  questionId: string;
  label: string;
  region: ExamInteractionRegion;
  geometryConfirmedByTeacher?: boolean;
}

/** Public scene hitboxes for Flyers Listening Part 1. Answer keys stay on questions. */
export interface FlyerNamePlacementLayout {
  kind: 'flyer-name-placement-v1';
  targets: FlyerNamePlacementTarget[];
}

export type ExamInteractionLayout = StarterImageMatchingLayout | StarterSceneColourLayout | ExamSceneDrawLayout | ExamImageTextEntryLayout | FlyerNamePlacementLayout;

export interface ExamGeometryHint {
  id: string;
  role: 'source-node' | 'target-node' | 'answer-region' | 'colour-mask' | 'draw-region' | 'option-crop' | string;
  label: string;
  questionId?: string;
  region: ExamInteractionRegion;
  anchor?: { x: number; y: number };
  confidence?: number;
  status: 'suggested' | 'confirmed' | 'rejected';
}

export interface ExamQuestion {
  id: string;
  number: number;
  type: ExamQuestionType;
  prompt: string;
  context?: string;
  imageAssetId?: string;
  imageUrl?: string;
  /** Optional second public picture used by paired-image spelling rows. */
  secondaryImageAssetId?: string;
  secondaryImageUrl?: string;
  options: ExamOption[];
  /** Private grading data; removed from every playable payload. */
  correctOptionIds: string[];
  /** Private grading data; removed from every playable payload. */
  acceptedAnswers: string[];
  /** Private matching source; removed from every playable payload. */
  interactionSourceNodeId?: string;
  points: number;
  maxSelections?: number;
  maxWords?: number;
  minWords?: number;
  /** Printed number shown in a source image. It is independent from the internal sequence. */
  displayNumber?: number;
  /** Public prefix already printed for a spelling/form answer, for example the first letter or currency sign. */
  answerPrefix?: string;
  /** Total expected character count for fixed-cell spelling answers, including answerPrefix. */
  answerLength?: number;
  /** Public text rendered after an answer input. */
  answerSuffix?: string;
  rubric?: string;
  modelAnswer?: string;
  /** Private backend-only configuration for AI-assisted Writing grading. */
  writingGrading?: ExamWritingGradingConfig;
}

export interface ExamWritingGradingConfig {
  enabled: boolean;
  providerId: string;
  taskContext: string;
  gradingInstructions: string;
  scoreScale: 10;
}

/** Display-only worked example. It is public lesson content and is never scored. */
export interface ExamDisplayExample {
  prompt: string;
  answer: string;
  imageAssetId?: string;
  imageUrl?: string;
  /** Optional second public picture used by a paired-image worked example. */
  secondaryImageAssetId?: string;
  secondaryImageUrl?: string;
}

/** A public picture/passage group that references canonical questions in the Part. */
export interface ExamReadingScene {
  id: string;
  imageAssetId?: string;
  imageUrl?: string;
  passage: string;
  questionIds: string[];
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
  /** Teacher-owned transcript. Removed from playable content and released only in an allowed post-submit review. */
  audioTranscript?: string;
  interaction?: ExamInteractionDescriptor;
  interactionLayout?: ExamInteractionLayout;
  examples?: ExamDisplayExample[];
  readingScenes?: ExamReadingScene[];
  /** Schema v2: a Part may contain several independently rendered interactions. */
  blocks?: ExamPartBlock[];
  questions: ExamQuestion[];
}

export interface ExamPartBlock {
  id: string;
  block: number;
  title: string;
  instruction: string;
  passage?: string;
  imageAssetId?: string;
  imageUrl?: string;
  audioAssetId?: string;
  audioUrl?: string;
  interaction: ExamInteractionDescriptor;
  interactionLayout?: ExamInteractionLayout;
  examples?: ExamDisplayExample[];
  readingScenes?: ExamReadingScene[];
  geometryHints?: ExamGeometryHint[];
  /** Application-owned references into the parent Part's canonical questions array. */
  questionIds: string[];
}

export interface ExamPaperContent {
  schemaVersion: number;
  /** `dynamic` means the JSON owns the number of Parts, blocks and questions. */
  structureMode?: 'definition' | 'dynamic';
  /** Versioned paper-specific adapter. Published papers without this field keep their legacy renderer. */
  templateVersion?: string;
  moduleId: Exclude<ExamModuleId, 'mover'>;
  paperId: ExamPaperId;
  title: string;
  description: string;
  level: string;
  /** Teacher-authored category used by standalone libraries such as Writing. */
  topic?: string;
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
  topic?: string;
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

export type ExamQuestionAnswerValue = string | string[];
export type ExamAnswerValue = ExamQuestionAnswerValue | ExamMatchingConnection[] | ExamScenePlacement;
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
  aiGradingStatus?: 'queued' | 'processing' | 'retrying' | 'completed' | 'failed';
  writingScore?: number;
  sentenceCount?: number;
  grammarErrors?: string[];
  vocabularyErrors?: string[];
  aiFeedback?: string;
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
  aiGradingStatus?: 'queued' | 'processing' | 'retrying' | 'completed' | 'failed';
  aiGradingMessage?: string;
  /** Current grading cycle. A learner retry reuses this attempt and increments the cycle. */
  aiGradingCycle?: number;
  /** Provider request number within the current cycle. */
  aiGradingAttempt?: number;
  aiGradingMaxAttempts?: number;
  /** True only for transient/provider-contract failures that a learner may submit again. */
  aiGradingRetryable?: boolean;
  /** Server-enforced earliest instant for the learner's next grading cycle. */
  aiGradingNextRetryAt?: string;
  /** Standalone Writing reports the pedagogical score directly on a 0–10 scale. */
  writingScore?: number;
  writingWordCount?: number;
  completedAt: string;
  durationSeconds: number;
  /** True when the answer snapshot was submitted at or after the configured deadline. */
  timedOut?: boolean;
}

export interface ExamAttemptReview {
  attempt: ExamCompletedAttempt;
  questions: ExamQuestionResult[];
  transcripts?: Array<{ part: number; text: string }>;
  sceneDrawTargets?: Array<{
    part: number;
    questionId: string;
    object: string;
    label: string;
    tokenUrl?: string;
    targetRegion: ExamInteractionRegion;
  }>;
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

