export class CompetitionApiError extends Error {
  constructor(message: string, public status: number, public code: string) { super(message); }
}
export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/ioe-violympic${path}`, init), data = await response.json().catch(() => ({}));
  if (!response.ok) throw new CompetitionApiError(data.error || `HTTP ${response.status}`, response.status, data.code || 'REQUEST_FAILED');
  return data as T;
}
export function adminRequest<T>(token: string, path: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<T> {
  return request(path, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal });
}
export async function bRequest<T>(token: string, url: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}), signal });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new CompetitionApiError(data.error || 'Không thể tải dịch vụ B.', response.status, data.code || 'B_SERVICE_ERROR');
  return data as T;
}
