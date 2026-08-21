import type {
  ListeningSmartImportPartId,
  ListeningSmartImportProviderPreference,
} from '../listening-editor/smart-import/types';

export interface ListeningPdfManifestPartPages {
  1: [number];
  2: [number];
  3: [number];
  4: [number, number];
  5: [number];
}

export interface ListeningPdfManifestTest {
  testNumber: number;
  title: string;
  bookPages: ListeningPdfManifestPartPages;
  keySummaryPage: number;
}

export interface ListeningPdfManifest {
  schemaVersion: 1;
  moduleId: 'mover';
  bookPageCount: number;
  keyPageCount: number;
  tests: ListeningPdfManifestTest[];
  warnings: string[];
}

export interface ListeningPdfTemporarySource {
  token: string;
  expiresAt: number;
}

export interface ListeningPdfManifestRequest {
  bookSourceTokens: string[];
  keySourceTokens: string[];
  bookPageCount: number;
  keyPageCount: number;
  preferredProvider: ListeningSmartImportProviderPreference;
}

export type ListeningPdfPartStatus = 'queued' | 'running' | 'completed' | 'needs_review' | 'failed';

export interface ListeningPdfPartProgress {
  part: ListeningSmartImportPartId;
  status: ListeningPdfPartStatus;
  message?: string;
  warnings?: string[];
}

export interface ListeningPdfTestProgress {
  testNumber: number;
  title: string;
  draftId?: string;
  parts: ListeningPdfPartProgress[];
}
