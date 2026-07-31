import type {
  ListeningAnswers,
  ListeningAsset,
  ListeningAssetKind,
  ListeningPlayableSet,
  ListeningSetContent,
} from './types';

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

export const listeningApi = {
  listPublicSets(token: string | null = null) {
    return requestJson<any[]>('/api/listening/sets', {
      headers: token ? authHeaders(token, false) : undefined,
    });
  },
  capabilities(token: string) {
    return requestJson<any>('/api/listening/capabilities', { headers: authHeaders(token, false) });
  },
  listSets(token: string) {
    return requestJson<any[]>('/api/listening/admin/sets', { headers: authHeaders(token, false) });
  },
  getAdminSet(token: string, id: string) {
    return requestJson<any>(`/api/listening/admin/sets/${encodeURIComponent(id)}`, {
      headers: authHeaders(token, false),
    });
  },
  createSet(token: string, content: ListeningSetContent) {
    return requestJson<any>('/api/listening/admin/sets', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ content }),
    });
  },
  updateSet(token: string, id: string, content: ListeningSetContent, visibility: string) {
    return requestJson<any>(`/api/listening/admin/sets/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: authHeaders(token),
      body: JSON.stringify({ content, visibility }),
    });
  },
  publishSet(token: string, id: string) {
    return requestJson<any>(`/api/listening/admin/sets/${encodeURIComponent(id)}/publish`, {
      method: 'POST',
      headers: authHeaders(token),
    });
  },
  archiveSet(token: string, id: string) {
    return requestJson<any>(`/api/listening/admin/sets/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: authHeaders(token, false),
    });
  },
  listAssets(token: string) {
    return requestJson<ListeningAsset[]>('/api/listening/admin/assets', {
      headers: authHeaders(token, false),
    });
  },
  uploadAsset(token: string, file: File, kind: ListeningAssetKind) {
    return requestJson<ListeningAsset>('/api/listening/admin/assets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': file.type,
        'X-File-Name': encodeURIComponent(file.name),
        'X-Asset-Kind': kind,
      },
      body: file,
    });
  },
  archiveAsset(token: string, id: string) {
    return requestJson<any>(`/api/listening/admin/assets/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: authHeaders(token, false),
    });
  },
  getPlayable(id: string, token: string | null, shareToken = '') {
    const query = shareToken ? `?shareToken=${encodeURIComponent(shareToken)}` : '';
    return requestJson<ListeningPlayableSet>(`/api/listening/sets/${encodeURIComponent(id)}${query}`, {
      headers: token ? authHeaders(token, false) : undefined,
    });
  },
  prepare(
    id: string,
    token: string | null,
    body: {
      shareToken?: string;
      guestId?: string;
      studentName?: string;
      clientRunId: string;
      runSecret: string;
    }
  ) {
    return requestJson<any>(`/api/listening/sets/${encodeURIComponent(id)}/attempts/prepare`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  },
  submit(
    id: string,
    token: string | null,
    body: {
      ticket: string;
      runSecret: string;
      guestId?: string;
      studentName?: string;
      answers: ListeningAnswers;
    }
  ) {
    return requestJson<any>(`/api/listening/sets/${encodeURIComponent(id)}/attempts/submit`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
  },
};
