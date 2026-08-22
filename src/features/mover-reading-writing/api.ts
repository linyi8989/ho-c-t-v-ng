import type {
  MoverReadingWritingAnswers,
  MoverReadingWritingAttemptReview,
  MoverReadingWritingCompletedAttempt,
  MoverReadingWritingContent,
  MoverReadingWritingPlayableSet,
  MoverReadingWritingSetSummary,
  MoverReadingWritingVisibility,
} from './types';
import type {
  MoverReadingWritingSmartImportCandidate,
  MoverReadingWritingSmartImportCapability,
  MoverReadingWritingSmartImportRequest,
  MoverReadingWritingTransientSource,
} from './smart-import/types';

async function requestJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error: any = new Error(payload.error || `HTTP ${response.status}`);
    error.status = response.status;
    error.details = payload.details;
    throw error;
  }
  return payload as T;
}

const authHeaders = (token: string, json = true): Record<string, string> => ({
  Authorization: `Bearer ${token}`,
  ...(json ? { 'Content-Type': 'application/json' } : {}),
});

const base = '/api/mover-reading-writing';

export const moverReadingWritingApi = {
  capabilities(token: string) {
    return requestJson<{ smartImport: MoverReadingWritingSmartImportCapability; transientUpload: { enabled: boolean } }>(
      `${base}/capabilities`,
      { headers: authHeaders(token, false) },
    );
  },
  listPublicSets(token: string | null = null) {
    return requestJson<MoverReadingWritingSetSummary[]>(`${base}/sets`, {
      headers: token ? authHeaders(token, false) : undefined,
    });
  },
  listSets(token: string) {
    return requestJson<MoverReadingWritingSetSummary[]>(`${base}/admin/sets`, { headers: authHeaders(token, false) });
  },
  getAdminSet(token: string, id: string) {
    return requestJson<any>(`${base}/admin/sets/${encodeURIComponent(id)}`, { headers: authHeaders(token, false) });
  },
  createSet(token: string, content: MoverReadingWritingContent) {
    return requestJson<any>(`${base}/admin/sets`, {
      method: 'POST', headers: authHeaders(token), body: JSON.stringify({ content }),
    });
  },
  updateSet(
    token: string,
    id: string,
    content: MoverReadingWritingContent,
    visibility: MoverReadingWritingVisibility,
    baseRevision?: number,
  ) {
    return requestJson<any>(`${base}/admin/sets/${encodeURIComponent(id)}`, {
      method: 'PUT', headers: authHeaders(token), body: JSON.stringify({ content, visibility, baseRevision }),
    });
  },
  autosaveSet(
    token: string,
    id: string,
    content: MoverReadingWritingContent,
    visibility: MoverReadingWritingVisibility,
    baseRevision: number,
  ) {
    return requestJson<{ draftRevision: number; updatedAt: string; validationErrors: string[] }>(
      `${base}/admin/sets/${encodeURIComponent(id)}/draft/autosave`,
      {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({ content, visibility, baseRevision }),
      },
    );
  },
  uploadSmartImportSource(token: string, file: File) {
    return requestJson<MoverReadingWritingTransientSource>(`${base}/admin/smart-import/sources`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': file.type },
      body: file,
    });
  },
  analyzeSmartImport(token: string, request: MoverReadingWritingSmartImportRequest) {
    return requestJson<MoverReadingWritingSmartImportCandidate>(`${base}/admin/smart-import/analyze`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(request),
    });
  },
  publishSet(token: string, id: string) {
    return requestJson<any>(`${base}/admin/sets/${encodeURIComponent(id)}/publish`, { method: 'POST', headers: authHeaders(token) });
  },
  cloneSet(token: string, id: string) {
    return requestJson<any>(`${base}/admin/sets/${encodeURIComponent(id)}/clone`, { method: 'POST', headers: authHeaders(token) });
  },
  archiveSet(token: string, id: string) {
    return requestJson<any>(`${base}/admin/sets/${encodeURIComponent(id)}`, { method: 'DELETE', headers: authHeaders(token, false) });
  },
  results(token: string, id: string) {
    return requestJson<any>(`${base}/admin/sets/${encodeURIComponent(id)}/results`, { headers: authHeaders(token, false) });
  },
  getPlayable(id: string, token: string | null, accessToken = '') {
    const query = accessToken ? `?accessToken=${encodeURIComponent(accessToken)}` : '';
    return requestJson<MoverReadingWritingPlayableSet>(`${base}/sets/${encodeURIComponent(id)}${query}`, {
      headers: token ? authHeaders(token, false) : undefined,
    });
  },
  prepare(
    id: string,
    token: string | null,
    body: { shareToken?: string; guestId?: string; studentName?: string; clientRunId: string; runSecret: string },
  ) {
    return requestJson<any>(`${base}/sets/${encodeURIComponent(id)}/attempts/prepare`, {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },
  submit(
    id: string,
    token: string | null,
    body: { ticket: string; runSecret: string; guestId?: string; studentName?: string; answers: MoverReadingWritingAnswers },
  ) {
    return requestJson<MoverReadingWritingCompletedAttempt>(`${base}/sets/${encodeURIComponent(id)}/attempts/submit`, {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },
  review(
    id: string,
    attemptId: string,
    token: string | null,
    identity: { guestId?: string; studentName?: string; runSecret?: string } = {},
  ) {
    const query = token ? '' : `?${new URLSearchParams({ guestId: identity.guestId || '', studentName: identity.studentName || '' })}`;
    return requestJson<MoverReadingWritingAttemptReview>(`${base}/sets/${encodeURIComponent(id)}/attempts/${encodeURIComponent(attemptId)}/review${query}`, {
      headers: token ? authHeaders(token, false) : { 'X-Mover-Reading-Run-Secret': identity.runSecret || '' },
    });
  },
};
