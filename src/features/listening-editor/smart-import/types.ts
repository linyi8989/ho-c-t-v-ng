import type { ListeningPart, ListeningRegion } from '../../listening/types';

export type ListeningSmartImportPartId = 1 | 2 | 3 | 4 | 5;

export interface ListeningSmartImportRequest {
  moduleId: 'mover';
  part: ListeningSmartImportPartId;
  sourceImageAssetIds: string[];
  pastedText?: string;
  currentPart: ListeningPart;
  basePartHash: string;
}

export interface SmartImportAnchor {
  label: string;
  region: ListeningRegion;
  confidence: number;
}

export interface SmartImportCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ListeningSmartImportData =
  | {
      part: 1;
      choices: string[];
      anchors: SmartImportAnchor[];
      exampleLabel?: string;
      provisionalChoiceIndexes: number[];
      confirmedTargetIndexes?: number[];
    }
  | {
      part: 2;
      heading: string;
      exampleText?: string;
      illustrationCrop?: SmartImportCrop;
      illustrationSourceImageIndex?: number;
      questions: Array<{ prompt: string; acceptedAnswers: string[] }>;
    }
  | {
      part: 3;
      boardAssetId: string;
      labels: string[];
      confirmedLabelIndexes?: number[];
    }
  | {
      part: 4;
      questions: Array<{
        prompt: string;
        sourceImageIndex: number;
        crops: SmartImportCrop[];
        correctOptionIndex?: number;
      }>;
    }
  | {
      part: 5;
      anchors: SmartImportAnchor[];
      provisionalColourIndexes: number[];
      confirmedTargetIndexes?: number[];
    };

export interface ListeningSmartImportCandidate {
  id: string;
  moduleId: 'mover';
  part: ListeningSmartImportPartId;
  basePartHash: string;
  sourceImageAssetIds: string[];
  provider: 'gemini' | 'openai' | 'local';
  warnings: string[];
  createdAt: string;
  data: ListeningSmartImportData;
}

export interface ListeningSmartImportCapability {
  enabled: boolean;
  visionEnabled: boolean;
  reason?: string;
}
