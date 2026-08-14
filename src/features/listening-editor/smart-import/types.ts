import type { ListeningPart, ListeningRegion } from '../../listening/types';

export type ListeningSmartImportPartId = 1 | 2 | 3 | 4 | 5;
export type ListeningSmartImportSourceRole = 'question' | 'answer_key' | 'position_key';
export type ListeningSmartImportProviderPreference = 'stali:gpt-5.6-sol' | 'devquota:gpt-5.6-sol' | (string & {});

export interface ListeningSmartImportProviderDefinition {
  id: string;
  label: string;
  enabled: boolean;
  model?: string;
  visionEnabled?: boolean;
  reason?: string;
}

export interface ListeningSmartImportSource {
  role: ListeningSmartImportSourceRole;
  assetId: string;
}

export interface ListeningSmartImportRoleDefinition {
  role: ListeningSmartImportSourceRole;
  label: 'Ảnh đề bài' | 'Ảnh đáp án' | 'Ảnh đáp án + vị trí';
  required: boolean;
}

export function getListeningSmartImportRoleDefinitions(part: ListeningSmartImportPartId): ListeningSmartImportRoleDefinition[] {
  if (part === 1) return [
    { role: 'question', label: 'Ảnh đề bài', required: true },
    { role: 'answer_key', label: 'Ảnh đáp án', required: true },
    { role: 'position_key', label: 'Ảnh đáp án + vị trí', required: true },
  ];
  if (part === 5) return [
    { role: 'question', label: 'Ảnh đề bài', required: true },
    { role: 'answer_key', label: 'Ảnh đáp án', required: true },
    { role: 'position_key', label: 'Ảnh đáp án + vị trí', required: true },
  ];
  return [
    { role: 'question', label: 'Ảnh đề bài', required: true },
    { role: 'answer_key', label: 'Ảnh đáp án', required: true },
  ];
}

export interface ListeningSmartImportRequest {
  moduleId: 'mover';
  part: ListeningSmartImportPartId;
  sources: ListeningSmartImportSource[];
  pastedText?: string;
  currentPart: ListeningPart;
  basePartHash: string;
  preferredProvider?: ListeningSmartImportProviderPreference;
}

export interface SmartImportAnchor {
  targetNumber?: 1 | 2 | 3 | 4 | 5;
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

export type SmartImportResolutionSource = 'ai' | 'current-part' | 'mixed' | 'derived' | 'teacher';

export interface SmartImportPart3Answer {
  label: string;
  region: ListeningRegion;
  leftAnchorOffset: number;
  rightAnchorOffset: number;
  source?: SmartImportResolutionSource;
}

export interface SmartImportPart3Picture {
  label: string;
  side: 'left' | 'right';
  row: 1 | 2 | 3;
  region: ListeningRegion;
  anchorOffset: number;
  source?: SmartImportResolutionSource;
}

export interface SmartImportPart5PaletteItem {
  objectType: string;
  label: string;
  colourLabel?: string;
}

export type SmartImportPart5Action =
  | {
      type: 'colour_object';
      objectLabel: string;
      correctColourLabel?: string;
      confidence: number;
    }
  | {
      type: 'place_object';
      objectType: string;
      colourLabel?: string;
      targetRegion?: ListeningRegion;
      relationLabel?: string;
      confidence: number;
    };

export type ListeningSmartImportData =
  | {
      part: 1;
      choices: string[];
      anchors: SmartImportAnchor[];
      targetChoiceLabels: Array<string | undefined>;
      example?: { label: string; region: ListeningRegion };
    }
  | {
      part: 2;
      heading?: string;
      instruction?: string;
      exampleText?: string;
      illustrationCrop?: SmartImportCrop;
      questions: Array<{
        questionNumber: 1 | 2 | 3 | 4 | 5;
        prompt?: string;
        acceptedAnswers?: string[];
      }>;
    }
  | {
      part: 3;
      answers: SmartImportPart3Answer[];
      pictures: SmartImportPart3Picture[];
      example?: { answerLabel: string; pictureSide: 'left' | 'right'; pictureRow: 1 | 2 | 3; renderOverlayLine: boolean; source?: SmartImportResolutionSource };
      connections: Array<{ answerLabel: string; pictureSide: 'left' | 'right'; pictureRow: 1 | 2 | 3; source?: SmartImportResolutionSource }>;
      distractorLabel?: string;
      distractorSource?: SmartImportResolutionSource;
    }
  | {
      part: 4;
      example?: {
        prompt: string;
        crops: SmartImportCrop[];
        correctOptionIndex?: number;
      };
      questions: Array<{
        questionNumber: 1 | 2 | 3 | 4 | 5;
        prompt: string;
        crops: SmartImportCrop[];
        correctOptionIndex?: number;
        answerSource: 'answer-key-numbered' | 'answer-key-ordered-fallback' | 'current-part';
      }>;
    }
  | {
      part: 5;
      paletteItems: SmartImportPart5PaletteItem[];
      questions: Array<{
        questionNumber: 1 | 2 | 3 | 4 | 5;
        staffPrompt: string;
        actions: SmartImportPart5Action[];
      }>;
    };

export interface ListeningSmartImportCandidate {
  id: string;
  moduleId: 'mover';
  part: ListeningSmartImportPartId;
  basePartHash: string;
  sources: ListeningSmartImportSource[];
  /** Compatibility/read helper only; role mapping always comes from `sources`. */
  sourceImageAssetIds: string[];
  provider: string;
  warnings: string[];
  createdAt: string;
  data: ListeningSmartImportData;
}

export interface ListeningSmartImportCapability {
  enabled: boolean;
  visionEnabled: boolean;
  reason?: string;
  providers?: ListeningSmartImportProviderDefinition[];
}

export const smartImportSourceAssetId = (
  candidate: Pick<ListeningSmartImportCandidate, 'sources'>,
  role: ListeningSmartImportSourceRole,
) => candidate.sources.find(source => source.role === role)?.assetId;
