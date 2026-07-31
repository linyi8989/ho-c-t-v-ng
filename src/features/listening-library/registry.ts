import type { ListeningModuleId, ListeningModuleManifest } from './types';

export const DEFAULT_LISTENING_MODULE_ID = 'mover' as const;
export const LISTENING_LIBRARY_SCHEMA_VERSION = 1;

const comingSoonCapabilities = {
  student: false,
  admin: false,
  scoring: false,
  assignments: false,
} as const;

export const LISTENING_MODULES = [
  {
    id: 'starter',
    displayName: 'Starter',
    description: 'Kho bài luyện nghe Starter đang được chuẩn bị.',
    status: 'coming_soon',
    schemaVersion: 1,
    partCount: null,
    questionsPerPart: null,
    parts: [],
    capabilities: comingSoonCapabilities,
  },
  {
    id: 'mover',
    displayName: 'Mover',
    description: 'Bộ đề nghe Mover gồm 5 Part và 25 câu tương tác.',
    status: 'active',
    schemaVersion: 1,
    partCount: 5,
    questionsPerPart: 5,
    parts: Array.from({ length: 5 }, (_, index) => ({
      id: `part-${index + 1}`,
      displayName: `Part ${index + 1}`,
      schemaVersion: 1,
      questionCount: 5,
    })),
    capabilities: {
      student: true,
      admin: true,
      scoring: true,
      assignments: true,
    },
  },
  {
    id: 'flyer',
    displayName: 'Flyer',
    description: 'Kho bài luyện nghe Flyer đang được chuẩn bị.',
    status: 'coming_soon',
    schemaVersion: 1,
    partCount: null,
    questionsPerPart: null,
    parts: [],
    capabilities: comingSoonCapabilities,
  },
  {
    id: 'ket',
    displayName: 'KET',
    description: 'Kho bài luyện nghe KET đang được chuẩn bị.',
    status: 'coming_soon',
    schemaVersion: 1,
    partCount: null,
    questionsPerPart: null,
    parts: [],
    capabilities: comingSoonCapabilities,
  },
] as const satisfies readonly ListeningModuleManifest[];

const moduleMap = new Map<ListeningModuleId, ListeningModuleManifest>(
  LISTENING_MODULES.map(module => [module.id, module])
);

export function isListeningModuleId(value: unknown): value is ListeningModuleId {
  return typeof value === 'string' && moduleMap.has(value as ListeningModuleId);
}

export function getListeningModule(moduleId: ListeningModuleId) {
  return moduleMap.get(moduleId);
}

export function getVisibleListeningModules() {
  return (LISTENING_MODULES as readonly ListeningModuleManifest[])
    .filter(module => module.status !== 'hidden');
}

export function resolveListeningModuleId(value: unknown): ListeningModuleId {
  return isListeningModuleId(value) ? value : DEFAULT_LISTENING_MODULE_ID;
}

export function publicListeningModuleManifest(module: ListeningModuleManifest) {
  return {
    id: module.id,
    displayName: module.displayName,
    description: module.description,
    status: module.status,
    schemaVersion: module.schemaVersion,
    partCount: module.partCount,
    questionsPerPart: module.questionsPerPart,
    parts: module.parts,
    capabilities: module.capabilities,
  };
}
