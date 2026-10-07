export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/speaking${path}`, init), data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`); return data as T;
}
export const adminRequest = <T,>(token: string, path: string, method = 'GET', body?: unknown) => request<T>(path, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
