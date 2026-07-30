import type {
  LearningAttemptStatus,
  LearningHistoryFilters,
  LearningHistoryType,
  LearningSourceType,
} from './learningHistoryTypes';

export class LearningHistoryValidationError extends Error {
  public status = 400;
  public code = 'INVALID_HISTORY_QUERY';

  constructor(message: string) {
    super(message);
    this.name = 'LearningHistoryValidationError';
  }
}

function scalar(value: unknown, name: string) {
  if (Array.isArray(value)) {
    throw new LearningHistoryValidationError(`${name} không được lặp lại.`);
  }
  return value === undefined || value === null ? '' : String(value).trim();
}

function boundedText(value: unknown, name: string, max: number) {
  const result = scalar(value, name).normalize('NFKC');
  if (result.length > max) {
    throw new LearningHistoryValidationError(`${name} vượt quá ${max} ký tự.`);
  }
  if (/[\u0000-\u001F\u007F]/.test(result)) {
    throw new LearningHistoryValidationError(`${name} chứa ký tự không hợp lệ.`);
  }
  return result;
}

function integerParam(value: unknown, name: string, fallback: number) {
  const raw = scalar(value, name);
  if (!raw) return fallback;
  if (!/^\d+$/.test(raw)) {
    throw new LearningHistoryValidationError(`${name} phải là số nguyên.`);
  }
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed)) {
    throw new LearningHistoryValidationError(`${name} không hợp lệ.`);
  }
  return parsed;
}

function optionalScore(value: unknown, name: string) {
  const raw = scalar(value, name);
  if (!raw) return undefined;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    throw new LearningHistoryValidationError(`${name} phải nằm trong khoảng 0–100.`);
  }
  return parsed;
}

function validDate(value: unknown, name: string) {
  const raw = scalar(value, name);
  if (!raw) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new LearningHistoryValidationError(`${name} phải có dạng YYYY-MM-DD.`);
  }
  const [year, month, day] = raw.split('-').map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year
    || probe.getUTCMonth() !== month - 1
    || probe.getUTCDate() !== day
  ) {
    throw new LearningHistoryValidationError(`${name} không phải ngày hợp lệ.`);
  }
  return raw;
}

function bangkokStartIso(date: string) {
  return new Date(`${date}T00:00:00.000+07:00`).toISOString();
}

function nextBangkokDayIso(date: string) {
  const start = new Date(`${date}T00:00:00.000+07:00`);
  return new Date(start.getTime() + 86_400_000).toISOString();
}

function allowlisted<T extends string>(
  value: unknown,
  name: string,
  allowed: readonly T[],
): T | undefined {
  const raw = scalar(value, name);
  if (!raw) return undefined;
  if (!allowed.includes(raw as T)) {
    throw new LearningHistoryValidationError(`${name} không hợp lệ.`);
  }
  return raw as T;
}

export function parseLearningHistoryFilters(query: Record<string, unknown>): LearningHistoryFilters {
  const page = integerParam(query.page, 'page', 1);
  if (page < 1 || page > 1_000_000) {
    throw new LearningHistoryValidationError('page phải nằm trong khoảng hợp lệ.');
  }
  const requestedPageSize = integerParam(query.pageSize, 'pageSize', 20);
  if (requestedPageSize !== 20 && requestedPageSize !== 50) {
    throw new LearningHistoryValidationError('pageSize chỉ nhận 20 hoặc 50.');
  }

  const sourceType = allowlisted<LearningSourceType>(
    query.sourceType,
    'sourceType',
    ['vocabulary', 'grammar'],
  );
  const historyType = allowlisted<LearningHistoryType>(
    query.historyType,
    'historyType',
    ['all', 'assignment', 'practice'],
  ) || 'all';
  const status = allowlisted<LearningAttemptStatus>(
    query.status,
    'status',
    ['completed', 'in_progress', 'interrupted'],
  );
  const scoreFrom = optionalScore(query.scoreFrom, 'scoreFrom');
  const scoreTo = optionalScore(query.scoreTo, 'scoreTo');
  if (scoreFrom !== undefined && scoreTo !== undefined && scoreFrom > scoreTo) {
    throw new LearningHistoryValidationError('scoreFrom không được lớn hơn scoreTo.');
  }

  const fromDate = validDate(query.from, 'from');
  const toDate = validDate(query.to, 'to');
  if (fromDate && toDate && fromDate > toDate) {
    throw new LearningHistoryValidationError('from không được sau to.');
  }

  const groupRaw = scalar(query.groupByAssignment, 'groupByAssignment').toLowerCase();
  if (groupRaw && !['true', 'false', '1', '0'].includes(groupRaw)) {
    throw new LearningHistoryValidationError('groupByAssignment không hợp lệ.');
  }

  return {
    page,
    pageSize: requestedPageSize,
    sourceType,
    historyType,
    status,
    classId: boundedText(query.classId, 'classId', 180) || undefined,
    lessonId: boundedText(query.lessonId, 'lessonId', 200) || undefined,
    assignmentId: boundedText(query.assignmentId, 'assignmentId', 180) || undefined,
    gameId: boundedText(query.gameId, 'gameId', 160) || undefined,
    scoreFrom,
    scoreTo,
    from: fromDate ? bangkokStartIso(fromDate) : undefined,
    toExclusive: toDate ? nextBangkokDayIso(toDate) : undefined,
    search: boundedText(query.search, 'search', 100) || undefined,
    groupByAssignment: groupRaw === 'true' || groupRaw === '1',
  };
}

export function validateAttemptId(value: unknown) {
  const attemptId = boundedText(value, 'attemptId', 200);
  if (!attemptId || !/^[A-Za-z0-9._:-]+$/.test(attemptId)) {
    throw new LearningHistoryValidationError('attemptId không hợp lệ.');
  }
  return attemptId;
}
