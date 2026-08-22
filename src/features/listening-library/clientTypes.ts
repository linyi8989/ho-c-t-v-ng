import type { ComponentType } from 'react';
import type {
  ListeningLibraryExamSummary,
  ListeningModuleId,
  ListeningModuleManifest,
  ListeningPaperId,
} from './types';

export interface ListeningExamComponentProps {
  examId: string;
  accessToken?: string;
  onBack: () => void;
}

export interface ListeningAdminComponentProps {
  token: string;
}

export interface ListeningClientModule {
  id: ListeningModuleId;
  manifest: ListeningModuleManifest;
  ExamComponent?: ComponentType<ListeningExamComponentProps>;
  AdminComponent?: ComponentType<ListeningAdminComponentProps>;
  listExams?: (token: string | null) => Promise<ListeningLibraryExamSummary[]>;
  papers?: Partial<Record<ListeningPaperId, ListeningClientPaper>>;
}

export interface ListeningClientPaper {
  id: ListeningPaperId;
  ExamComponent: ComponentType<ListeningExamComponentProps>;
  listExams: (token: string | null) => Promise<ListeningLibraryExamSummary[]>;
}
