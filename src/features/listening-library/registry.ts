import type { ListeningModuleId, ListeningModuleManifest } from './types';
import type { ListeningPaperId } from './types';
import { getModuleExamPaperDefinitions } from '../exam-platform/definitions';

export const DEFAULT_LISTENING_MODULE_ID = 'mover' as const;
export const LISTENING_LIBRARY_SCHEMA_VERSION = 1;

const activeCapabilities = {
  student: true,
  admin: true,
  scoring: true,
  assignments: true,
} as const;

function genericPapers(moduleId: Exclude<ListeningModuleId, 'mover'>) {
  return getModuleExamPaperDefinitions(moduleId).map(definition => ({
    id: definition.paperId,
    displayName: definition.displayName,
    description: definition.description,
    status: 'active' as const,
    schemaVersion: 1,
    partCount: definition.parts.length,
    questionsPerPart: definition.parts.map(part => part.questionCount),
    totalQuestionCount: definition.totalQuestionCount,
    parts: definition.parts.map(part => ({
      id: part.id,
      displayName: part.displayName,
      schemaVersion: 1,
      questionCount: part.questionCount,
    })),
    capabilities: activeCapabilities,
  }));
}

export const LISTENING_MODULES = [
  {
    id: 'writing',
    displayName: 'Writing',
    levelLabel: 'Theo lớp',
    description: 'Kho đề Writing độc lập với một bài viết và AI chấm điểm 0–10.',
    status: 'hidden',
    schemaVersion: 1,
    partCount: 1,
    questionsPerPart: 1,
    parts: [],
    capabilities: activeCapabilities,
    papers: genericPapers('writing'),
  },
  {
    id: 'starter',
    displayName: 'Starters',
    levelLabel: 'Pre A1',
    description: 'Kho đề Pre A1 Starters gồm Listening và Reading & Writing.',
    status: 'active',
    schemaVersion: 1,
    partCount: null,
    questionsPerPart: null,
    parts: [],
    capabilities: activeCapabilities,
    papers: genericPapers('starter'),
  },
  {
    id: 'mover',
    displayName: 'Movers',
    levelLabel: 'A1',
    description: 'Movers gồm Listening và Reading & Writing với cấu trúc riêng cho từng bài thi.',
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
        description: 'Bộ đề nghe Movers gồm 5 Part và 25 câu tương tác.',
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
        description: 'Bộ đề Movers Reading & Writing gồm 6 Part và 40 câu.',
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
    displayName: 'Flyers',
    levelLabel: 'A2',
    description: 'Kho đề A2 Flyers gồm Listening và Reading & Writing.',
    status: 'active',
    schemaVersion: 1,
    partCount: null,
    questionsPerPart: null,
    parts: [],
    capabilities: activeCapabilities,
    papers: genericPapers('flyer'),
  },
  {
    id: 'ket',
    displayName: 'KET',
    levelLabel: 'A2 Key',
    description: 'Kho đề A2 Key (KET) gồm Reading & Writing và Listening.',
    status: 'active',
    schemaVersion: 1,
    partCount: null,
    questionsPerPart: null,
    parts: [],
    capabilities: activeCapabilities,
    papers: genericPapers('ket'),
  },
  {
    id: 'pet',
    displayName: 'PET',
    levelLabel: 'B1 Preliminary',
    description: 'Kho đề B1 Preliminary (PET) gồm Reading, Writing và Listening.',
    status: 'active',
    schemaVersion: 1,
    partCount: null,
    questionsPerPart: null,
    parts: [],
    capabilities: activeCapabilities,
    papers: genericPapers('pet'),
  },
  {
    id: 'fce',
    displayName: 'FCE',
    levelLabel: 'B2 First',
    description: 'Kho đề B2 First (FCE) gồm Reading & Use of English, Writing và Listening.',
    status: 'active',
    schemaVersion: 1,
    partCount: null,
    questionsPerPart: null,
    parts: [],
    capabilities: activeCapabilities,
    papers: genericPapers('fce'),
  },
  {
    id: 'ielts',
    displayName: 'IELTS',
    levelLabel: 'Academic',
    description: 'Kho đề IELTS Academic gồm Listening, Academic Reading và Academic Writing.',
    status: 'active',
    schemaVersion: 1,
    partCount: null,
    questionsPerPart: null,
    parts: [],
    capabilities: activeCapabilities,
    papers: genericPapers('ielts'),
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
  return value === 'listening'
    || value === 'reading-writing'
    || value === 'reading'
    || value === 'writing'
    || value === 'reading-use-of-english'
    || value === 'academic-reading'
    || value === 'academic-writing';
}
