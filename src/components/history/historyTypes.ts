export type LearningHistorySourceType = 'vocabulary' | 'grammar';
export type LearningHistoryKind = 'all' | 'assignment' | 'practice';
export type LearningAttemptStatus = 'in_progress' | 'completed' | 'interrupted';
export type LearningDetailStatus =
  | 'available'
  | 'legacy'
  | 'missing'
  | 'expired'
  | 'legacy_unavailable'
  | string;

export interface LearningHistoryFilters {
  page: number;
  pageSize: 20 | 50;
  sourceType?: LearningHistorySourceType;
  historyType: LearningHistoryKind;
  status?: LearningAttemptStatus;
  classId?: string;
  lessonId?: string;
  assignmentId?: string;
  gameId?: string;
  scoreFrom?: number;
  scoreTo?: number;
  from?: string;
  to?: string;
  search?: string;
  groupByAssignment?: boolean;
}

export interface LearningHistoryItem {
  attemptId: string;
  sourceRecordId?: string;
  sourceType: LearningHistorySourceType;
  lessonId?: string;
  lessonTitle: string;
  lessonType?: string;
  gameId: string;
  gameTitle: string;
  classId?: string;
  className?: string;
  assignmentId?: string;
  assignmentTitle?: string;
  assignmentDueAt?: string;
  score: number;
  rawScore?: number;
  maxScore?: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  mistakeCount?: number;
  totalQuestions: number;
  durationSeconds: number;
  startedAt?: string;
  completedAt?: string;
  activityAt?: string;
  attemptStatus: LearningAttemptStatus;
  attemptNumber: number;
  detailStatus: LearningDetailStatus;
  normalizationStatus?: string;
  malformed?: boolean;
}

export interface LearningHistorySummaryData {
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

export interface LearningHistoryPagination {
  page: number;
  pageSize: 20 | 50;
  totalItems: number;
  totalPages: number;
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
  classId?: string;
  className?: string;
  dueAt?: string;
  attempts: number;
  latestScore: number;
  bestScore: number;
  averageScore: number;
}

export interface LearningHistoryResponse {
  items: LearningHistoryItem[];
  summary: LearningHistorySummaryData;
  pagination: LearningHistoryPagination;
  filterOptions: LearningHistoryFilterOptions;
  assignmentGroups?: LearningHistoryAssignmentGroup[];
}

export interface LearningHistoryDetailResponse {
  attempt: LearningHistoryItem | null;
  detailStatus: LearningDetailStatus;
  detail: Record<string, unknown> | null;
}

export interface NormalizedHistoryDetailEntry {
  index: number;
  data: Record<string, unknown>;
  malformed: boolean;
}

export const DEFAULT_HISTORY_FILTERS: LearningHistoryFilters = {
  page: 1,
  pageSize: 20,
  historyType: 'all'
};

export const EMPTY_HISTORY_SUMMARY: LearningHistorySummaryData = {
  totalAttempts: 0,
  completedAttempts: 0,
  averageScore: 0,
  bestScore: 0,
  totalCorrect: 0,
  totalIncorrect: 0,
  totalUnanswered: 0,
  totalDurationSeconds: 0,
  studyDays: 0
};

export const EMPTY_HISTORY_FILTER_OPTIONS: LearningHistoryFilterOptions = {
  classes: [],
  lessons: [],
  assignments: [],
  games: []
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

/**
 * Resolves a stored option id (or option text) to the same lettered label the
 * detail modal shows in its option list. This keeps already-backfilled grammar
 * attempts readable without rewriting their immutable source rows.
 */
export function resolveHistoryOptionAnswer(value: unknown, options: unknown): string | undefined {
  if (
    !Array.isArray(options)
    || (typeof value !== 'string' && typeof value !== 'number')
  ) {
    return undefined;
  }

  const answer = String(value).trim();
  if (!answer) return undefined;

  const optionIndex = options.findIndex(option => {
    if (typeof option === 'string' || typeof option === 'number') {
      return String(option).trim() === answer;
    }
    const optionRecord = asRecord(option);
    if (!optionRecord) return false;
    const optionId = firstDefined(optionRecord, ['id', 'optionId', 'option_id', 'key']);
    const optionText = firstDefined(optionRecord, ['text', 'label', 'answer', 'content']);
    return (
      (optionId !== undefined && String(optionId).trim() === answer)
      || (optionText !== undefined && String(optionText).trim() === answer)
    );
  });

  if (optionIndex < 0) return undefined;
  const matchedOption = options[optionIndex];
  const optionRecord = asRecord(matchedOption);
  const optionText = optionRecord
    ? firstDefined(optionRecord, ['text', 'label', 'answer', 'content'])
    : matchedOption;
  if (optionText === undefined || optionText === null || String(optionText).trim() === '') {
    return undefined;
  }

  const optionLetter = String.fromCharCode(65 + optionIndex);
  return `${optionLetter}. ${String(optionText).trim()}`;
}

function firstDefined(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null) return record[key];
  }
  return undefined;
}

function textValue(record: Record<string, unknown>, keys: string[], fallback = '') {
  const value = firstDefined(record, keys);
  return typeof value === 'string' || typeof value === 'number'
    ? String(value).trim()
    : fallback;
}

function optionalText(record: Record<string, unknown>, keys: string[]) {
  return textValue(record, keys) || undefined;
}

function finiteNumber(record: Record<string, unknown>, keys: string[], fallback = 0) {
  const value = firstDefined(record, keys);
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function nonNegativeNumber(record: Record<string, unknown>, keys: string[], fallback = 0) {
  return Math.max(0, finiteNumber(record, keys, fallback));
}

function normalizedScore(record: Record<string, unknown>, keys: string[], fallback = 0) {
  return Math.min(100, Math.max(0, finiteNumber(record, keys, fallback)));
}

function normalizeSourceType(value: unknown): LearningHistorySourceType {
  return String(value || '').toLowerCase() === 'grammar' ? 'grammar' : 'vocabulary';
}

function normalizeAttemptStatus(value: unknown): LearningAttemptStatus {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'in_progress') return 'in_progress';
  if (normalized === 'interrupted' || normalized === 'abandoned') return 'interrupted';
  return 'completed';
}

function normalizePageSize(value: unknown): 20 | 50 {
  return Number(value) === 50 ? 50 : 20;
}

export function parseLearningHistoryItem(value: unknown, fallbackIndex = 0): LearningHistoryItem {
  const record = asRecord(value);
  if (!record) {
    return {
      attemptId: `malformed-${fallbackIndex}`,
      sourceType: 'vocabulary',
      lessonTitle: 'Dữ liệu lượt làm không hợp lệ',
      gameId: '',
      gameTitle: 'Không xác định',
      score: 0,
      correctCount: 0,
      incorrectCount: 0,
      unansweredCount: 0,
      totalQuestions: 0,
      durationSeconds: 0,
      attemptStatus: 'completed',
      attemptNumber: 1,
      detailStatus: 'missing',
      malformed: true
    };
  }

  const attemptId = textValue(record, ['attemptId', 'attempt_id', 'id']);
  const sourceType = normalizeSourceType(firstDefined(record, ['sourceType', 'source_type']));
  return {
    attemptId: attemptId || `malformed-${fallbackIndex}`,
    sourceRecordId: optionalText(record, ['sourceRecordId', 'source_record_id']),
    sourceType,
    lessonId: optionalText(record, ['lessonId', 'lesson_id', 'vocabSetId', 'grammarSetId']),
    lessonTitle: textValue(
      record,
      ['lessonTitle', 'lessonTitleSnapshot', 'lesson_title_snapshot', 'vocabSetTitle', 'grammarSetTitle'],
      'Bài học không xác định'
    ),
    lessonType: optionalText(record, ['lessonType', 'lesson_type']),
    gameId: textValue(record, ['gameId', 'game_id'], sourceType === 'grammar' ? 'grammar-practice' : ''),
    gameTitle: textValue(
      record,
      ['gameTitle', 'gameTitleSnapshot', 'game_title_snapshot', 'gameName'],
      sourceType === 'grammar' ? 'Luyện ngữ pháp' : 'Luyện từ vựng'
    ),
    classId: optionalText(record, ['classId', 'class_id']),
    className: optionalText(record, ['className', 'classNameSnapshot', 'class_name_snapshot']),
    assignmentId: optionalText(record, ['assignmentId', 'assignment_id']),
    assignmentTitle: optionalText(
      record,
      ['assignmentTitle', 'assignmentTitleSnapshot', 'assignment_title_snapshot']
    ),
    assignmentDueAt: optionalText(
      record,
      ['assignmentDueAt', 'assignmentDueAtSnapshot', 'assignment_due_at_snapshot']
    ),
    score: normalizedScore(record, ['score']),
    rawScore: firstDefined(record, ['rawScore', 'raw_score']) === undefined
      ? undefined
      : finiteNumber(record, ['rawScore', 'raw_score']),
    maxScore: firstDefined(record, ['maxScore', 'max_score']) === undefined
      ? undefined
      : nonNegativeNumber(record, ['maxScore', 'max_score']),
    correctCount: nonNegativeNumber(record, ['correctCount', 'correct_count', 'correctAnswers']),
    incorrectCount: nonNegativeNumber(
      record,
      ['incorrectCount', 'incorrect_count', 'wrongCount', 'incorrectAnswers']
    ),
    unansweredCount: nonNegativeNumber(record, ['unansweredCount', 'unanswered_count']),
    mistakeCount: firstDefined(record, ['mistakeCount', 'mistake_count']) === undefined
      ? undefined
      : nonNegativeNumber(record, ['mistakeCount', 'mistake_count']),
    totalQuestions: nonNegativeNumber(record, ['totalQuestions', 'total_questions']),
    durationSeconds: nonNegativeNumber(record, ['durationSeconds', 'duration_seconds']),
    startedAt: optionalText(record, ['startedAt', 'started_at']),
    completedAt: optionalText(record, ['completedAt', 'completed_at']),
    activityAt: optionalText(record, ['activityAt', 'activity_at']),
    attemptStatus: normalizeAttemptStatus(firstDefined(record, ['attemptStatus', 'attempt_status', 'status'])),
    attemptNumber: Math.max(1, Math.round(nonNegativeNumber(record, ['attemptNumber', 'attempt_number'], 1))),
    detailStatus: textValue(record, ['detailStatus', 'detail_status'], 'missing'),
    normalizationStatus: optionalText(record, ['normalizationStatus', 'normalization_status']),
    malformed: !attemptId
  };
}

function parseSummary(value: unknown): LearningHistorySummaryData {
  const record = asRecord(value) || {};
  return {
    totalAttempts: nonNegativeNumber(record, ['totalAttempts', 'total_attempts']),
    completedAttempts: nonNegativeNumber(record, ['completedAttempts', 'completed_attempts']),
    averageScore: normalizedScore(record, ['averageScore', 'average_score']),
    bestScore: normalizedScore(record, ['bestScore', 'best_score']),
    totalCorrect: nonNegativeNumber(record, ['totalCorrect', 'total_correct']),
    totalIncorrect: nonNegativeNumber(record, ['totalIncorrect', 'total_incorrect']),
    totalUnanswered: nonNegativeNumber(record, ['totalUnanswered', 'total_unanswered']),
    totalDurationSeconds: nonNegativeNumber(
      record,
      ['totalDurationSeconds', 'total_duration_seconds']
    ),
    studyDays: nonNegativeNumber(record, ['studyDays', 'study_days'])
  };
}

function parseOption(value: unknown): LearningHistoryFilterOption | null {
  const record = asRecord(value);
  if (!record) return null;
  const id = textValue(record, ['id', 'value']);
  const label = textValue(record, ['label', 'name', 'title'], id);
  return id && label ? { id, label } : null;
}

function parseOptionList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map(parseOption).filter((option): option is LearningHistoryFilterOption => Boolean(option));
}

function parseFilterOptions(value: unknown): LearningHistoryFilterOptions {
  const record = asRecord(value) || {};
  return {
    classes: parseOptionList(record.classes),
    lessons: parseOptionList(record.lessons),
    assignments: parseOptionList(record.assignments),
    games: parseOptionList(record.games)
  };
}

function parseAssignmentGroup(value: unknown): LearningHistoryAssignmentGroup | null {
  const record = asRecord(value);
  if (!record) return null;
  const assignmentId = textValue(record, ['assignmentId', 'assignment_id']);
  if (!assignmentId) return null;
  return {
    assignmentId,
    assignmentTitle: textValue(
      record,
      ['assignmentTitle', 'assignment_title'],
      'Bài được giao'
    ),
    classId: optionalText(record, ['classId', 'class_id']),
    className: optionalText(record, ['className', 'class_name']),
    dueAt: optionalText(record, ['dueAt', 'due_at']),
    attempts: Math.round(nonNegativeNumber(record, ['attempts'])),
    latestScore: normalizedScore(record, ['latestScore', 'latest_score']),
    bestScore: normalizedScore(record, ['bestScore', 'best_score']),
    averageScore: normalizedScore(record, ['averageScore', 'average_score'])
  };
}

export function parseLearningHistoryResponse(value: unknown): LearningHistoryResponse {
  const record = asRecord(value) || {};
  const pagination = asRecord(record.pagination) || {};
  const items = Array.isArray(record.items) ? record.items : [];
  const assignmentGroups = Array.isArray(record.assignmentGroups)
    ? record.assignmentGroups
      .map(parseAssignmentGroup)
      .filter((group): group is LearningHistoryAssignmentGroup => Boolean(group))
    : undefined;
  return {
    items: items.map((item, index) => parseLearningHistoryItem(item, index)),
    summary: parseSummary(record.summary),
    pagination: {
      page: Math.max(1, Math.round(nonNegativeNumber(pagination, ['page'], 1))),
      pageSize: normalizePageSize(firstDefined(pagination, ['pageSize', 'page_size'])),
      totalItems: Math.round(nonNegativeNumber(pagination, ['totalItems', 'total_items'])),
      totalPages: Math.round(nonNegativeNumber(pagination, ['totalPages', 'total_pages']))
    },
    filterOptions: parseFilterOptions(record.filterOptions),
    ...(assignmentGroups ? { assignmentGroups } : {})
  };
}

export function parseLearningHistoryDetailResponse(value: unknown): LearningHistoryDetailResponse {
  const record = asRecord(value) || {};
  return {
    attempt: record.attempt ? parseLearningHistoryItem(record.attempt) : null,
    detailStatus: textValue(record, ['detailStatus', 'detail_status'], 'missing'),
    detail: asRecord(record.detail)
  };
}

function firstArray(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    if (Array.isArray(record[key])) return record[key] as unknown[];
  }
  return null;
}

/**
 * Merges standardized answer/question/option snapshots by index. Invalid
 * entries remain represented as a local fallback row instead of crashing the
 * whole detail modal.
 */
export function normalizeHistoryDetailEntries(
  detail: Record<string, unknown> | null
): NormalizedHistoryDetailEntry[] {
  if (!detail) return [];

  const answers = firstArray(detail, [
    'answerDetails',
    'answer_details',
    'answers',
    'items',
    'questionDetails',
    'pronunciationAttempts'
  ]);
  const questions = firstArray(detail, ['questionSnapshots', 'question_snapshots', 'questions']);
  const optionSnapshots = firstArray(detail, ['optionSnapshots', 'option_snapshots']);
  const maxLength = Math.max(answers?.length || 0, questions?.length || 0);

  if (maxLength > 0) {
    return Array.from({ length: maxLength }, (_, index) => {
      const answer = answers ? asRecord(answers[index]) : null;
      const question = questions ? asRecord(questions[index]) : null;
      const optionEntry = optionSnapshots?.[index];
      const optionRecord = asRecord(optionEntry);
      const options = Array.isArray(optionEntry)
        ? optionEntry
        : Array.isArray(optionRecord?.options)
          ? optionRecord.options
          : Array.isArray(optionRecord?.optionsSnapshot)
            ? optionRecord.optionsSnapshot
            : undefined;
      const malformed = Boolean(
        (answers && answers[index] !== undefined && !answer)
        || (questions && questions[index] !== undefined && !question)
      );
      return {
        index,
        malformed,
        data: {
          ...(question || {}),
          ...(answer || {}),
          ...(optionRecord || {}),
          ...(Array.isArray(options) ? { optionsSnapshot: options } : {})
        }
      };
    });
  }

  const extraDetails = asRecord(detail.extraDetails || detail.extra_details);
  if (extraDetails) return [{ index: 0, data: extraDetails, malformed: false }];

  const knownEnvelopeKeys = new Set([
    'answerDetails',
    'answer_details',
    'answers',
    'items',
    'questionDetails',
    'questionSnapshots',
    'question_snapshots',
    'questions',
    'optionSnapshots',
    'option_snapshots',
    'extraDetails',
    'extra_details',
    'reviewPolicy',
    'review_policy'
  ]);
  const entryData = Object.fromEntries(
    Object.entries(detail).filter(([key]) => !knownEnvelopeKeys.has(key))
  );
  return Object.keys(entryData).length
    ? [{ index: 0, data: entryData, malformed: false }]
    : [];
}

export function formatHistoryDateTime(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).format(date);
}

export function formatHistoryDuration(totalSeconds?: number) {
  const seconds = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  if (hours > 0) return `${hours} giờ ${minutes} phút`;
  if (minutes > 0) return `${minutes} phút ${remainingSeconds} giây`;
  return `${remainingSeconds} giây`;
}
