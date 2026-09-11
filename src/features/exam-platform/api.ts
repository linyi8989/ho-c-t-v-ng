import type {
  ExamAnswers,
  ExamAttemptReview,
  ExamCompletedAttempt,
  ExamPaperContent,
  ExamPlayableSet,
  ExamSetSummary,
  ExamVisibility,
} from './types';
import type { ExamModuleId, ExamPaperId } from '../listening-library/types';

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

const headers = (token: string, json = true): Record<string, string> => ({
  Authorization: `Bearer ${token}`,
  ...(json ? { 'Content-Type': 'application/json' } : {}),
});

const paperBase = (moduleId: ExamModuleId, paperId: ExamPaperId) => (
  `/api/exam-platform/modules/${encodeURIComponent(moduleId)}/papers/${encodeURIComponent(paperId)}`
);
const adminBase = (moduleId: ExamModuleId, paperId: ExamPaperId) => (
  `/api/exam-platform/admin/modules/${encodeURIComponent(moduleId)}/papers/${encodeURIComponent(paperId)}`
);

export const examPlatformApi = {
  listPublicSets(moduleId: ExamModuleId, paperId: ExamPaperId, token: string | null = null) {
    return requestJson<ExamSetSummary[]>(`${paperBase(moduleId, paperId)}/sets`, {
      headers: token ? headers(token, false) : undefined,
    });
  },
  listSets(token: string, moduleId: ExamModuleId, paperId: ExamPaperId) {
    return requestJson<ExamSetSummary[]>(`${adminBase(moduleId, paperId)}/sets`, { headers: headers(token, false) });
  },
  getAdminSet(token: string, moduleId: ExamModuleId, paperId: ExamPaperId, setId: string) {
    return requestJson<any>(`${adminBase(moduleId, paperId)}/sets/${encodeURIComponent(setId)}`, { headers: headers(token, false) });
  },
  createSet(token: string, moduleId: ExamModuleId, paperId: ExamPaperId, content: ExamPaperContent) {
    return requestJson<any>(`${adminBase(moduleId, paperId)}/sets`, { method: 'POST', headers: headers(token), body: JSON.stringify({ content }) });
  },
  updateSet(token: string, moduleId: ExamModuleId, paperId: ExamPaperId, setId: string, content: ExamPaperContent, visibility: ExamVisibility, baseRevision: number) {
    return requestJson<any>(`${adminBase(moduleId, paperId)}/sets/${encodeURIComponent(setId)}`, {
      method: 'PUT', headers: headers(token), body: JSON.stringify({ content, visibility, baseRevision }),
    });
  },
  autosaveSet(token: string, moduleId: ExamModuleId, paperId: ExamPaperId, setId: string, content: ExamPaperContent, visibility: ExamVisibility, baseRevision: number) {
    return requestJson<{ draftRevision: number; updatedAt: string; validationErrors: string[] }>(`${adminBase(moduleId, paperId)}/sets/${encodeURIComponent(setId)}/draft/autosave`, {
      method: 'POST', headers: headers(token), body: JSON.stringify({ content, visibility, baseRevision }),
    });
  },
  publishSet(token: string, moduleId: ExamModuleId, paperId: ExamPaperId, setId: string) {
    return requestJson<any>(`${adminBase(moduleId, paperId)}/sets/${encodeURIComponent(setId)}/publish`, { method: 'POST', headers: headers(token, false) });
  },
  cloneSet(token: string, moduleId: ExamModuleId, paperId: ExamPaperId, setId: string) {
    return requestJson<any>(`${adminBase(moduleId, paperId)}/sets/${encodeURIComponent(setId)}/clone`, { method: 'POST', headers: headers(token, false) });
  },
  archiveSet(token: string, moduleId: ExamModuleId, paperId: ExamPaperId, setId: string) {
    return requestJson<any>(`${adminBase(moduleId, paperId)}/sets/${encodeURIComponent(setId)}`, { method: 'DELETE', headers: headers(token, false) });
  },
  results(token: string, moduleId: ExamModuleId, paperId: ExamPaperId, setId: string) {
    return requestJson<any>(`${adminBase(moduleId, paperId)}/sets/${encodeURIComponent(setId)}/results`, { headers: headers(token, false) });
  },
  manualGrade(token: string, moduleId: ExamModuleId, paperId: ExamPaperId, setId: string, attemptId: string, grades: Record<string, number>) {
    return requestJson<ExamCompletedAttempt>(`${adminBase(moduleId, paperId)}/sets/${encodeURIComponent(setId)}/attempts/${encodeURIComponent(attemptId)}/manual-grade`, {
      method: 'POST', headers: headers(token), body: JSON.stringify({ grades }),
    });
  },
  retryWritingGrade(token: string, moduleId: ExamModuleId, paperId: ExamPaperId, setId: string, attemptId: string) {
    return requestJson<ExamCompletedAttempt>(`${adminBase(moduleId, paperId)}/sets/${encodeURIComponent(setId)}/attempts/${encodeURIComponent(attemptId)}/retry-writing-grade`, {
      method: 'POST', headers: headers(token, false),
    });
  },
  writingGradingProviders(token: string) {
    return requestJson<{ providers: Array<{ id: string; label: string; enabled: boolean }> }>('/api/exam-platform/admin/writing-grading/providers', {
      headers: headers(token, false),
    });
  },
  validateSmartImport(token: string, moduleId: ExamModuleId, paperId: ExamPaperId, partIndex: number, part: unknown, currentPart: unknown) {
    return requestJson<any>(`${adminBase(moduleId, paperId)}/smart-import/validate`, {
      method: 'POST', headers: headers(token), body: JSON.stringify({ partIndex, part, currentPart }),
    });
  },
  getPlayable(moduleId: ExamModuleId, paperId: ExamPaperId, setId: string, token: string | null, shareToken = '') {
    const query = shareToken ? `?shareToken=${encodeURIComponent(shareToken)}` : '';
    return requestJson<ExamPlayableSet>(`${paperBase(moduleId, paperId)}/sets/${encodeURIComponent(setId)}${query}`, { headers: token ? headers(token, false) : undefined });
  },
  prepare(moduleId: ExamModuleId, paperId: ExamPaperId, setId: string, token: string | null, body: Record<string, unknown>) {
    return requestJson<any>(`${paperBase(moduleId, paperId)}/sets/${encodeURIComponent(setId)}/attempts/prepare`, {
      method: 'POST', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
  },
  renewAttempt(moduleId: ExamModuleId, paperId: ExamPaperId, setId: string, token: string | null, body: { ticket: string; runSecret: string; guestId?: string; studentName?: string }) {
    return requestJson<{ ticket: string; clientRunId: string; versionId: string; startedAt: string; deadlineAt?: string }>(`${paperBase(moduleId, paperId)}/sets/${encodeURIComponent(setId)}/attempts/renew`, {
      method: 'POST', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
  },
  submit(moduleId: ExamModuleId, paperId: ExamPaperId, setId: string, token: string | null, body: { ticket: string; runSecret: string; guestId?: string; studentName?: string; answers: ExamAnswers }) {
    return requestJson<ExamCompletedAttempt>(`${paperBase(moduleId, paperId)}/sets/${encodeURIComponent(setId)}/attempts/submit`, {
      method: 'POST', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
  },
  gradingStatus(moduleId: ExamModuleId, paperId: ExamPaperId, setId: string, attemptId: string, token: string | null, identity: { guestId?: string; studentName?: string; runSecret?: string }) {
    const query = token ? '' : `?${new URLSearchParams({ guestId: identity.guestId || '', studentName: identity.studentName || '' })}`;
    return requestJson<ExamCompletedAttempt>(`${paperBase(moduleId, paperId)}/sets/${encodeURIComponent(setId)}/attempts/${encodeURIComponent(attemptId)}/status${query}`, {
      headers: token ? headers(token, false) : { 'X-Exam-Run-Secret': identity.runSecret || '' },
    });
  },
  retryWritingGradeAsLearner(moduleId: ExamModuleId, paperId: ExamPaperId, setId: string, attemptId: string, token: string | null, identity: { guestId?: string; studentName?: string; runSecret?: string }) {
    return requestJson<ExamCompletedAttempt>(`${paperBase(moduleId, paperId)}/sets/${encodeURIComponent(setId)}/attempts/${encodeURIComponent(attemptId)}/retry-writing-grade`, {
      method: 'POST',
      headers: { ...(token ? headers(token) : { 'Content-Type': 'application/json', 'X-Exam-Run-Secret': identity.runSecret || '' }) },
      body: JSON.stringify({ guestId: identity.guestId || '', studentName: identity.studentName || '' }),
    });
  },
  review(moduleId: ExamModuleId, paperId: ExamPaperId, setId: string, attemptId: string, token: string | null, identity: { guestId?: string; studentName?: string; runSecret?: string }) {
    const query = token ? '' : `?${new URLSearchParams({ guestId: identity.guestId || '', studentName: identity.studentName || '' })}`;
    return requestJson<ExamAttemptReview>(`${paperBase(moduleId, paperId)}/sets/${encodeURIComponent(setId)}/attempts/${encodeURIComponent(attemptId)}/review${query}`, {
      headers: token ? headers(token, false) : { 'X-Exam-Run-Secret': identity.runSecret || '' },
    });
  },
};
