import {
  LearningHistoryDetailResponse,
  LearningHistoryFilters,
  LearningHistoryResponse,
  parseLearningHistoryDetailResponse,
  parseLearningHistoryResponse
} from '../../components/history/historyTypes';
import { GuestAccessCredential } from '../guestIdentity';

export interface LearningHistoryActor {
  authToken?: string | null;
  guestCredential?: GuestAccessCredential | null;
}

export class LearningHistoryApiError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 0, code = 'LEARNING_HISTORY_REQUEST_FAILED') {
    super(message);
    this.name = 'LearningHistoryApiError';
    this.status = status;
    this.code = code;
  }
}

export function buildLearningHistoryHeaders(actor: LearningHistoryActor): Record<string, string> {
  const authToken = String(actor.authToken || '').trim();
  if (authToken) {
    return {
      Accept: 'application/json',
      Authorization: `Bearer ${authToken}`
    };
  }

  const guestId = String(actor.guestCredential?.guestId || '').trim();
  const accessToken = String(actor.guestCredential?.accessToken || '').trim();
  if (!guestId || !accessToken) {
    throw new LearningHistoryApiError(
      'Cần xác minh quyền truy cập lịch sử học tập.',
      0,
      'GUEST_HISTORY_ACCESS_REQUIRED'
    );
  }

  return {
    Accept: 'application/json',
    'X-Guest-Id': guestId,
    'X-Guest-Access-Token': accessToken
  };
}

export function buildLearningHistoryQuery(filters: LearningHistoryFilters) {
  const params = new URLSearchParams();
  params.set('page', String(Math.max(1, Math.round(filters.page || 1))));
  params.set('pageSize', filters.pageSize === 50 ? '50' : '20');

  const optionalValues: Array<[string, string | number | undefined]> = [
    ['sourceType', filters.sourceType],
    ['historyType', filters.historyType === 'all' ? undefined : filters.historyType],
    ['status', filters.status],
    ['classId', filters.classId],
    ['lessonId', filters.lessonId],
    ['assignmentId', filters.assignmentId],
    ['gameId', filters.gameId],
    ['scoreFrom', filters.scoreFrom],
    ['scoreTo', filters.scoreTo],
    ['from', filters.from],
    ['to', filters.to],
    ['search', filters.search?.trim()]
  ];

  for (const [key, value] of optionalValues) {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      params.set(key, String(value));
    }
  }
  if (filters.groupByAssignment) params.set('groupByAssignment', 'true');
  return params.toString();
}

async function readResponseJson(response: Response) {
  return response.json().catch(() => ({}));
}

function errorFromResponse(response: Response, body: unknown) {
  const record = body && typeof body === 'object' && !Array.isArray(body)
    ? body as Record<string, unknown>
    : {};
  const message = typeof record.error === 'string'
    ? record.error
    : typeof record.message === 'string'
      ? record.message
      : response.status === 403
        ? 'Bạn chưa có quyền xem lịch sử học tập này.'
        : 'Không thể tải lịch sử học tập.';
  const code = typeof record.code === 'string'
    ? record.code
    : response.status === 403
      ? 'LEARNING_HISTORY_FORBIDDEN'
      : 'LEARNING_HISTORY_REQUEST_FAILED';
  return new LearningHistoryApiError(message, response.status, code);
}

export async function fetchLearningHistory(
  filters: LearningHistoryFilters,
  actor: LearningHistoryActor,
  signal?: AbortSignal,
  fetchImpl: typeof fetch = fetch
): Promise<LearningHistoryResponse> {
  const response = await fetchImpl(`/api/my-learning-history?${buildLearningHistoryQuery(filters)}`, {
    method: 'GET',
    headers: buildLearningHistoryHeaders(actor),
    signal
  });
  const body = await readResponseJson(response);
  if (!response.ok) throw errorFromResponse(response, body);
  return parseLearningHistoryResponse(body);
}

export async function fetchLearningHistoryDetail(
  attemptId: string,
  actor: LearningHistoryActor,
  signal?: AbortSignal,
  fetchImpl: typeof fetch = fetch
): Promise<LearningHistoryDetailResponse> {
  const normalizedAttemptId = String(attemptId || '').trim();
  if (!normalizedAttemptId) {
    throw new LearningHistoryApiError(
      'Mã lượt làm không hợp lệ.',
      0,
      'INVALID_ATTEMPT_ID'
    );
  }

  const response = await fetchImpl(
    `/api/my-learning-history/${encodeURIComponent(normalizedAttemptId)}`,
    {
      method: 'GET',
      headers: buildLearningHistoryHeaders(actor),
      signal
    }
  );
  const body = await readResponseJson(response);
  if (!response.ok) throw errorFromResponse(response, body);
  return parseLearningHistoryDetailResponse(body);
}

