export const EXPIRED_ATTEMPT_ARCHIVE_KEY = 'msdieu_expired_attempt_answers_v1';
const MAX_ARCHIVED_ATTEMPTS = 10;

export interface ArchivedAttemptAnswers {
  source: 'exam-platform' | 'mover-reading-writing' | 'listening';
  setId: string;
  versionId: string;
  clientRunId: string;
  startedAt: string;
  deadlineAt?: string;
  currentPart: number;
  answers: unknown;
  archivedAt: string;
}

type BrowserStorage = Pick<Storage, 'getItem' | 'setItem'>;

export function attemptErrorCode(error: unknown) {
  if (!error || typeof error !== 'object') return '';
  const details = (error as { details?: unknown }).details;
  if (!details || typeof details !== 'object') return '';
  return String((details as { code?: unknown }).code || '');
}

export function isExpiredAttemptTicket(error: unknown, source: ArchivedAttemptAnswers['source']) {
  const code = attemptErrorCode(error);
  if (source === 'exam-platform') return code === 'EXAM_ATTEMPT_TICKET_EXPIRED';
  if (source === 'mover-reading-writing') return code === 'MOVER_READING_ATTEMPT_TICKET_EXPIRED';
  return code === 'LISTENING_ATTEMPT_TICKET_EXPIRED';
}

export function isAttemptRecoveryExpired(error: unknown, source: ArchivedAttemptAnswers['source']) {
  const code = attemptErrorCode(error);
  if (source === 'exam-platform') return code === 'EXAM_ATTEMPT_TICKET_RECOVERY_EXPIRED';
  if (source === 'mover-reading-writing') return code === 'MOVER_READING_ATTEMPT_TICKET_RECOVERY_EXPIRED';
  return code === 'LISTENING_ATTEMPT_TICKET_RECOVERY_EXPIRED';
}

export function archiveExpiredAttemptAnswers(storage: BrowserStorage, entry: Omit<ArchivedAttemptAnswers, 'archivedAt'>) {
  try {
    const raw = storage.getItem(EXPIRED_ATTEMPT_ARCHIVE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const previous = Array.isArray(parsed) ? parsed : [];
    const archived: ArchivedAttemptAnswers = { ...entry, archivedAt: new Date().toISOString() };
    storage.setItem(EXPIRED_ATTEMPT_ARCHIVE_KEY, JSON.stringify([archived, ...previous].slice(0, MAX_ARCHIVED_ATTEMPTS)));
    return true;
  } catch {
    return false;
  }
}
