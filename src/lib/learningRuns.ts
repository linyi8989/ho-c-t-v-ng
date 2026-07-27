export interface ClientLearningRun {
  clientRunId: string;
  runSecret: string;
  startedAt: string;
}

export interface PendingLearningSubmission {
  key: string;
  kind: 'vocabulary';
  vocabSetId: string;
  gameId: string;
  run: ClientLearningRun;
  payload: Record<string, unknown>;
  createdAt: string;
}

const PENDING_SUBMISSIONS_KEY = 'msdieu_pending_learning_submissions_v1';
const PENDING_SUBMISSION_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_PENDING_SUBMISSIONS = 10;

function randomValue(prefix: string) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

export function createClientLearningRun(): ClientLearningRun {
  return {
    clientRunId: randomValue('run'),
    runSecret: randomValue('secret'),
    startedAt: new Date().toISOString()
  };
}

export function pendingSubmissionKey(vocabSetId: string, gameId: string, clientRunId: string) {
  return `${vocabSetId}:${gameId}:${clientRunId}`;
}

function readPendingSubmissions(): PendingLearningSubmission[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(PENDING_SUBMISSIONS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    const cutoff = Date.now() - PENDING_SUBMISSION_TTL_MS;
    return parsed
      .filter((item): item is PendingLearningSubmission => Boolean(
        item && item.key && item.kind === 'vocabulary' && item.run?.clientRunId && item.run?.runSecret
      ))
      .filter(item => new Date(item.createdAt || 0).getTime() >= cutoff)
      .slice(-MAX_PENDING_SUBMISSIONS);
  } catch {
    return [];
  }
}

function writePendingSubmissions(items: PendingLearningSubmission[]) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(PENDING_SUBMISSIONS_KEY, JSON.stringify(items.slice(-MAX_PENDING_SUBMISSIONS)));
  } catch {
    // The active request can still complete when browser storage is unavailable.
  }
}

export function storePendingSubmission(submission: PendingLearningSubmission) {
  const items = readPendingSubmissions().filter(item => item.key !== submission.key);
  items.push(submission);
  writePendingSubmissions(items);
}

export function removePendingSubmission(key: string) {
  writePendingSubmissions(readPendingSubmissions().filter(item => item.key !== key));
}

export function findPendingSubmission(vocabSetId: string, gameId: string) {
  return readPendingSubmissions()
    .filter(item => item.vocabSetId === vocabSetId && item.gameId === gameId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null;
}
