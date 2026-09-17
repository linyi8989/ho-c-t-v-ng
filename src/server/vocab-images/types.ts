export type LegacyVocabImageProviderId = "wikimedia" | "pixabay" | "pexels";
export type VocabImageGenerationProviderId = "stali" | "devquota" | "seedvis-nano-banana-2" | "seedvis-nano-banana-pro";
export type VocabImageProviderId = LegacyVocabImageProviderId | VocabImageGenerationProviderId | "upload";
export type VocabImageBatchProvider = VocabImageGenerationProviderId | "auto";
export type SupportedVocabImageMimeType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

export interface VocabImageAttribution {
  provider: VocabImageProviderId;
  externalId: string;
  title: string;
  author: string;
  license: string;
  licenseUrl?: string;
  sourcePageUrl?: string;
}

export interface VocabImageAsset extends VocabImageAttribution {
  id: string;
  sha256: string;
  mimeType: SupportedVocabImageMimeType;
  storageKey: string;
  publicUrl: string;
  width?: number;
  height?: number;
  prompt?: string;
  model?: string;
  originalFileName?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface GeneratedVocabImage {
  bytes?: Buffer;
  remoteUrl?: string;
  declaredMimeType?: string;
  provider: VocabImageGenerationProviderId;
  model: string;
  requestId?: string;
}

export interface VocabImageGenerationProvider {
  id: VocabImageGenerationProviderId;
  label: string;
  model: string;
  configured: boolean;
  documentationUrl: string;
  allowedDownloadHosts: readonly string[];
  generate(prompt: string, signal?: AbortSignal): Promise<GeneratedVocabImage>;
}
