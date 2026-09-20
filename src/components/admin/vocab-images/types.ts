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

export interface VocabImageBatchJob {
  jobId: string;
  status: "queued" | "running" | "completed" | "failed";
  total: number;
  completed: number;
  succeeded: number;
  failed: number;
  items: BatchImageGenerationResult[];
  error?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  concurrencyPerProvider: number;
  totalConcurrency: number;
}
