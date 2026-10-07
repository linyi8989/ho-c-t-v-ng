import type { SceneCatalog, SceneModule, ScenePaperId } from './types';
import { getSceneDefinition } from './sceneDefinition';

// Loaded only by Vite development on loopback with the explicit preview query.
// These links never represent published exams and never enter B's storage.
export function createLinkPreview(moduleId: SceneModule = 'starter'): SceneCatalog {
  const paper = (id: ScenePaperId, label: string) => ({
    revision: 0,
    configured: false,
    links: Array.from({ length: 25 }, (_, index) => ({
      id: `preview-${id}-${index + 1}`,
      title: `${label} · Test ${String(index + 1).padStart(2, '0')}`,
      href: `#starter-house-${id}`,
    })),
  });
  return { papers: Object.fromEntries(getSceneDefinition(moduleId).papers.map(value => [value.id, paper(value.id, value.displayName)])) };
}
