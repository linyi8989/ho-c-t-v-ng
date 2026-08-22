export type ExamModuleId = 'starter' | 'mover' | 'flyer' | 'ket' | 'pet' | 'fce' | 'ielts';
// Compatibility alias: the library began as Listening-only, while public routes
// and manifests now describe the broader Cambridge & IELTS exam directory.
export type ListeningModuleId = ExamModuleId;
export type ListeningModuleStatus = 'active' | 'coming_soon' | 'hidden';
export type ExamPaperId = 'listening' | 'reading-writing';
export type ListeningPaperId = ExamPaperId;

export interface ListeningModulePartManifest {
  id: string;
  displayName: string;
  schemaVersion: number;
  questionCount: number;
}

export interface ListeningModuleCapabilities {
  student: boolean;
  admin: boolean;
  scoring: boolean;
  assignments: boolean;
}

export interface ListeningModuleManifest {
  id: ListeningModuleId;
  displayName: string;
  levelLabel: string;
  description: string;
  status: ListeningModuleStatus;
  schemaVersion: number;
  partCount: number | null;
  questionsPerPart: number | readonly number[] | null;
  parts: readonly ListeningModulePartManifest[];
  capabilities: ListeningModuleCapabilities;
  papers: readonly ListeningPaperManifest[];
}

export interface ListeningPaperManifest {
  id: ListeningPaperId;
  displayName: string;
  description: string;
  status: ListeningModuleStatus;
  schemaVersion: number;
  partCount: number;
  questionsPerPart: number | readonly number[];
  parts: readonly ListeningModulePartManifest[];
  capabilities: ListeningModuleCapabilities;
}

export interface ListeningLibraryExamSummary {
  moduleId: ListeningModuleId;
  examId: string;
  schemaVersion: number;
  title: string;
  description: string;
  gradeLevel: string;
  visibility: 'draft' | 'public' | 'assignment';
  status: 'draft' | 'published' | 'archived';
  coverUrl?: string;
  timeLimitMinutes?: number;
  publishedVersionNumber?: number;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
}

export interface ListeningLibraryExamDocument<TPart = unknown> extends ListeningLibraryExamSummary {
  parts: readonly TPart[];
}

export type ListeningLibraryRoute =
  | { kind: 'library' }
  | { kind: 'module'; moduleId: ListeningModuleId }
  | {
      kind: 'exam';
      moduleId: ListeningModuleId;
      examId: string;
      accessToken: string;
      legacy: boolean;
    }
  | { kind: 'paper'; moduleId: ListeningModuleId; paperId: ListeningPaperId }
  | {
      kind: 'paper-exam';
      moduleId: ListeningModuleId;
      paperId: ListeningPaperId;
      examId: string;
      accessToken: string;
    };
