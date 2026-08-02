import type { ComponentType } from 'react';
import type {
  ListeningAsset,
  ListeningAssetKind,
  ListeningPart,
  ListeningSetContent,
} from '../listening/types';
import type {
  ListeningSmartImportCandidate,
  ListeningSmartImportCapability,
} from './smart-import/types';

export interface ListeningEditorValidationIssue {
  path: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ListeningPartEditorProps<TPart extends ListeningPart> {
  part: TPart;
  token: string;
  assets: ListeningAsset[];
  assetUrl: (assetId?: string) => string | undefined;
  aiCapability?: { enabled: boolean; reason?: string };
  smartImportCapability?: ListeningSmartImportCapability;
  importCandidate?: ListeningSmartImportCandidate;
  onImportCandidateChange: (candidate?: ListeningSmartImportCandidate) => void;
  onImportCandidateApplied: () => void;
  onUpload: (
    file: File,
    kind: ListeningAssetKind,
    derivative?: {
      derivedFromAssetId: string;
      crop: { x: number; y: number; width: number; height: number };
    }
  ) => Promise<ListeningAsset>;
  onChange: (part: TPart) => void;
}

export interface ListeningPartEditorHandler<TPart extends ListeningPart = ListeningPart> {
  part: TPart['part'];
  label: string;
  EditorComponent: ComponentType<ListeningPartEditorProps<TPart>>;
  validateLocal: (part: TPart) => ListeningEditorValidationIssue[];
}

export interface ListeningEditorModuleDefinition {
  moduleId: 'mover';
  schemaVersion: 1;
  createDefaultDraft: () => ListeningSetContent;
  partHandlers: readonly ListeningPartEditorHandler<any>[];
}
