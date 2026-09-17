import type {
  VocabImageAttribution,
  VocabImageGenerationProviderId,
} from "../../../types";

export type VocabImageBatchProvider = VocabImageGenerationProviderId | "auto";

export interface VocabImageProviderOption {
  id: VocabImageGenerationProviderId;
  label: string;
  model: string;
  configured: boolean;
  documentationUrl: string;
}

export interface ManagedVocabImageAsset extends VocabImageAttribution {
  id: string;
  publicUrl: string;
  width?: number;
  height?: number;
  prompt?: string;
  model?: string;
  originalFileName?: string;
}

export interface VocabImageGenerationResult {
  asset: ManagedVocabImageAsset;
  prompt: string;
  provider: VocabImageGenerationProviderId;
  model: string;
}

export interface BatchImageGenerationResult {
  id: string;
  provider: VocabImageGenerationProviderId;
  asset?: ManagedVocabImageAsset;
  prompt?: string;
  error?: string;
}
