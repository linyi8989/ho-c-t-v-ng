import type { SceneAdminPaper, SceneCatalog, SceneEntry, SceneModule, ScenePaperId } from './types';
async function json<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, init), payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Không tải được danh sách (HTTP ${response.status}).`);
  return payload as T;
}
const base = '/api/exam-platform';
const catalogPath = (moduleId: SceneModule) => moduleId === 'starter' ? `${base}/starter-scene` : `${base}/scenes/${moduleId}`;
const adminPath = (moduleId: SceneModule, paper: ScenePaperId) => moduleId === 'starter' ? `${base}/admin/starter-scene/${paper}` : `${base}/admin/scenes/${moduleId}/${paper}`;
export const sceneApi = {
  catalog: (signal: AbortSignal, moduleId: SceneModule = 'starter') => json<SceneCatalog>(catalogPath(moduleId), { signal }),
  admin: (token: string, paper: ScenePaperId, signal: AbortSignal, moduleId: SceneModule = 'starter') => json<SceneAdminPaper>(adminPath(moduleId, paper), { signal, headers: { Authorization: `Bearer ${token}` } }),
  save: (token: string, paper: ScenePaperId, revision: number, entries: SceneEntry[], moduleId: SceneModule = 'starter') => json<SceneAdminPaper>(adminPath(moduleId, paper), { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ baseRevision: revision, entries }) }),
};
