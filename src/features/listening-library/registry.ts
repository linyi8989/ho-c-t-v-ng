import type { ListeningModuleId, ListeningModuleManifest } from './types';
import type { ListeningPaperId } from './types';

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
    levelLabel: 'Pre A1',
    description: 'Kho đề Pre A1 Starters đang được chuẩn bị.',
    status: 'coming_soon',
    schemaVersion: 1,
    partCount: null,
    questionsPerPart: null,
    parts: [],
    capabilities: comingSoonCapabilities,
    papers: [],
  },
  {
    id: 'mover',
    displayName: 'Mover',
    levelLabel: 'A1',
    description: 'Mover gồm Listening và Reading & Writing với cấu trúc riêng cho từng bài thi.',
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
    papers: [
      {
        id: 'listening',
        displayName: 'Listening',
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
        id: 'reading-writing',
        displayName: 'Reading & Writing',
        description: 'Bộ đề Mover Reading & Writing gồm 6 Part và 40 câu.',
        status: 'active',
        schemaVersion: 1,
        partCount: 6,
        questionsPerPart: [6, 6, 6, 7, 10, 5],
        parts: [6, 6, 6, 7, 10, 5].map((questionCount, index) => ({
          id: `part-${index + 1}`,
          displayName: `Part ${index + 1}`,
          schemaVersion: 1,
          questionCount,
        })),
        capabilities: {
          student: true,
          admin: true,
          scoring: true,
          assignments: true,
        },
      },
    ],
  },
  {
    id: 'flyer',
    displayName: 'Flyer',
    levelLabel: 'A2',
    description: 'Kho đề A2 Flyers đang được chuẩn bị.',
    status: 'coming_soon',
    schemaVersion: 1,
    partCount: null,
    questionsPerPart: null,
    parts: [],
    capabilities: comingSoonCapabilities,
    papers: [],
  },
  {
    id: 'ket',
    displayName: 'KET',
    levelLabel: 'A2 Key',
    description: 'Kho đề A2 Key (KET) đang được chuẩn bị.',
    status: 'coming_soon',
    schemaVersion: 1,
    partCount: null,
    questionsPerPart: null,
    parts: [],
    capabilities: comingSoonCapabilities,
    papers: [],
  },
  {
    id: 'pet',
    displayName: 'PET',
    levelLabel: 'B1 Preliminary',
    description: 'Kho đề B1 Preliminary (PET) đang được chuẩn bị.',
    status: 'coming_soon',
    schemaVersion: 1,
    partCount: null,
    questionsPerPart: null,
    parts: [],
    capabilities: comingSoonCapabilities,
    papers: [],
  },
  {
    id: 'fce',
    displayName: 'FCE',
    levelLabel: 'B2 First',
    description: 'Kho đề B2 First (FCE) đang được chuẩn bị.',
    status: 'coming_soon',
    schemaVersion: 1,
    partCount: null,
    questionsPerPart: null,
    parts: [],
    capabilities: comingSoonCapabilities,
    papers: [],
  },
  {
    id: 'ielts',
    displayName: 'IELTS',
    levelLabel: 'Academic & General',
    description: 'Kho đề IELTS Academic và General Training đang được chuẩn bị.',
    status: 'coming_soon',
    schemaVersion: 1,
    partCount: null,
    questionsPerPart: null,
    parts: [],
    capabilities: comingSoonCapabilities,
    papers: [],
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
    levelLabel: module.levelLabel,
    description: module.description,
    status: module.status,
    schemaVersion: module.schemaVersion,
    partCount: module.partCount,
    questionsPerPart: module.questionsPerPart,
    parts: module.parts,
    capabilities: module.capabilities,
    papers: module.papers,
  };
}

export function getListeningPaper(moduleId: ListeningModuleId, paperId: ListeningPaperId) {
  return getListeningModule(moduleId)?.papers.find(paper => paper.id === paperId);
}

export function isListeningPaperId(value: unknown): value is ListeningPaperId {
  return value === 'listening' || value === 'reading-writing';
}
