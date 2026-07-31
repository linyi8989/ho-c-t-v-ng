export type LearningSourceType = 'vocabulary' | 'grammar' | 'listening';
export type LearningHistoryType = 'all' | 'assignment' | 'practice';
export type LearningAttemptStatus = 'completed' | 'in_progress' | 'interrupted';
export type LearningDetailStatus = 'available' | 'missing' | 'expired' | 'legacy';

export interface LearningHistoryActor {
  id: string;
  ownerKey: string;
  kind: 'user' | 'guest';
  role: 'super_admin' | 'teacher' | 'student';
  userProfile?: Record<string, unknown>;
}

export interface LearningHistoryFilters {
  page: number;
  pageSize: 20 | 50;
  sourceType?: LearningSourceType;
  historyType: LearningHistoryType;
  status?: LearningAttemptStatus;
  classId?: string;
  lessonId?: string;
  assignmentId?: string;
  gameId?: string;
  scoreFrom?: number;
  scoreTo?: number;
  from?: string;
  toExclusive?: string;
  search?: string;
  groupByAssignment: boolean;
}

export interface LearningAttemptWrite {
  attemptId: string;
  sourceRecordId: string;
  clientRunId: string | null;
  sourceType: LearningSourceType;
  studentType: 'authenticated' | 'guest' | 'legacy';
  userId: string | null;
  guestId: string | null;
  ownerKey: string | null;
  ownershipStatus: 'linked' | 'legacy_unlinked';
  studentNameSnapshot: string;
  classId: string | null;
  classNameSnapshot: string;
  assignmentId: string | null;
  assignmentTitleSnapshot: string;
  assignmentDueAtSnapshot: string | null;
  lessonId: string;
  lessonTitleSnapshot: string;
  lessonType: 'vocab_set' | 'grammar_set' | 'listening_set';
  gameId: string;
  gameTitleSnapshot: string;
  score: number;
  rawScore: number | null;
  maxScore: number | null;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  mistakeCount: number;
  totalQuestions: number;
  startedAt: string | null;
  completedAt: string | null;
  activityAt: string;
  studyDate: string;
  durationSeconds: number;
  attemptStatus: LearningAttemptStatus;
  attemptNumber: number;
  schemaVersion: number;
  detailStatus: LearningDetailStatus;
  normalizationStatus: 'canonical' | 'legacy_partial';
  createdAt: string;
  updatedAt: string;
}

export interface LearningAttemptDetailWrite {
  attemptId: string;
  clientRunId: string | null;
  sourceType: LearningSourceType;
  answerDetails: unknown[];
  questionSnapshots: unknown[];
  optionSnapshots: unknown[];
  extraDetails: Record<string, unknown>;
  reviewPolicy: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
  schemaVersion: number;
}

export interface LearningAttemptProjection {
  attempt: LearningAttemptWrite;
  detail: LearningAttemptDetailWrite | null;
}

export interface LearningHistoryItem {
  attemptId: string;
  sourceType: LearningSourceType;
  studentType: string;
  studentName: string;
  classId: string | null;
  className: string;
  assignmentId: string | null;
  assignmentTitle: string;
  assignmentDueAt: string | null;
  lessonId: string;
  lessonTitle: string;
  lessonType: string;
  gameId: string;
  gameTitle: string;
  score: number;
  rawScore: number | null;
  maxScore: number | null;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  mistakeCount: number;
  totalQuestions: number;
  startedAt: string | null;
  completedAt: string | null;
  activityAt: string;
  durationSeconds: number;
  status: LearningAttemptStatus;
  attemptNumber: number;
  detailStatus: LearningDetailStatus;
  normalizationStatus: string;
}

export interface LearningHistorySummary {
  totalAttempts: number;
  completedAttempts: number;
  averageScore: number;
  bestScore: number;
  totalCorrect: number;
  totalIncorrect: number;
  totalUnanswered: number;
  totalDurationSeconds: number;
  studyDays: number;
}

export interface LearningHistoryFilterOption {
  id: string;
  label: string;
}

export interface LearningHistoryFilterOptions {
  classes: LearningHistoryFilterOption[];
  lessons: LearningHistoryFilterOption[];
  assignments: LearningHistoryFilterOption[];
  games: LearningHistoryFilterOption[];
}

export interface LearningHistoryAssignmentGroup {
  assignmentId: string;
  assignmentTitle: string;
  classId: string | null;
  className: string;
  dueAt: string | null;
  attempts: number;
  latestScore: number;
  bestScore: number;
  averageScore: number;
}

export interface LearningHistoryListResponse {
  items: LearningHistoryItem[];
  summary: LearningHistorySummary;
  pagination: {
    page: number;
    pageSize: 20 | 50;
    totalItems: number;
    totalPages: number;
  };
  filterOptions: LearningHistoryFilterOptions;
  assignmentGroups?: LearningHistoryAssignmentGroup[];
}

export interface LearningHistoryDetailResponse {
  attempt: LearningHistoryItem;
  detailStatus: 'available' | 'missing' | 'expired' | 'legacy_unavailable';
  detail: {
    sourceType: LearningSourceType;
    answerDetails: unknown[];
    questionSnapshots: unknown[];
    optionSnapshots: unknown[];
    extraDetails: Record<string, unknown>;
    reviewPolicy: Record<string, unknown>;
    warnings: string[];
  } | null;
}
