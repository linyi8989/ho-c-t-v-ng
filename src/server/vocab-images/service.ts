import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { downloadImageSecurely, validateImageBytes, type SecureImageDownloadOptions } from "./downloadSecurity.js";
import { createVocabImageGenerationProviders } from "./generationProviders.js";
import {
  buildVocabImageGenerationPrompt,
  validateVocabImageCustomPrompt,
} from "./generationPrompt.js";
import type {
  VocabImageAsset,
  VocabImageBatchProvider,
  VocabImageGenerationProvider,
  VocabImageGenerationProviderId,
} from "./types.js";

interface DocumentDatabase {
  collection(name: string): any;
}

export interface VocabImageLibraryOptions {
  db: DocumentDatabase;
  imageDir: string;
  publicPrefix: string;
  env: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  resolveHost?: SecureImageDownloadOptions["resolveHost"];
  now?: () => Date;
}

interface VocabImageGenerationInput {
  term: unknown;
  meaning?: unknown;
  partOfSpeech?: unknown;
  pos?: unknown;
}

interface VocabImageUploadInput {
  bytes: Buffer;
  declaredMimeType?: string;
  fileName?: string;
  rightsConfirmed: boolean;
}

function httpError(status: number, message: string) {
  return Object.assign(new Error(message), { status });
}

function boundedInteger(value: unknown, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.floor(parsed))) : fallback;
}

function clean(value: unknown, maxLength: number) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function isGenerationProviderId(value: unknown): value is VocabImageGenerationProviderId {
  return value === "stali"
    || value === "devquota"
    || value === "seedvis-nano-banana-2"
    || value === "seedvis-nano-banana-pro";
}

function cleanFileName(value: unknown) {
  const baseName = path.basename(String(value || "image")).replace(/[\u0000-\u001f<>:"/\\|?*]+/g, "-").trim();
  return (baseName || "image").slice(0, 180);
}

function createConcurrencyLimiter(concurrency: number) {
  let active = 0;
  const waiting: Array<() => void> = [];
  return async <T>(task: () => Promise<T>) => {
    if (active >= concurrency) await new Promise<void>(resolve => waiting.push(resolve));
    active += 1;
    try {
      return await task();
    } finally {
      active -= 1;
      waiting.shift()?.();
    }
  };
}

export class VocabImageLibraryService {
  private readonly providers: Record<VocabImageGenerationProviderId, VocabImageGenerationProvider>;
  private readonly now: () => Date;
  private readonly timeoutMs: number;
  private readonly downloadTimeoutMs: number;
  private readonly maxBytes: number;
  readonly batchConcurrencyPerProvider: number;
  readonly batchMaxItems: number;

  constructor(private readonly options: VocabImageLibraryOptions) {
    this.providers = createVocabImageGenerationProviders(options.env, options.fetchImpl);
    this.now = options.now || (() => new Date());
    this.timeoutMs = boundedInteger(options.env.VOCAB_IMAGE_GENERATION_TIMEOUT_MS, 120_000, 10_000, 300_000);
    this.downloadTimeoutMs = boundedInteger(options.env.VOCAB_IMAGE_DOWNLOAD_TIMEOUT_MS, 30_000, 2_000, 60_000);
    this.maxBytes = boundedInteger(options.env.VOCAB_IMAGE_MAX_BYTES, 8 * 1024 * 1024, 64 * 1024, 20 * 1024 * 1024);
    this.batchConcurrencyPerProvider = boundedInteger(options.env.VOCAB_IMAGE_BATCH_CONCURRENCY_PER_PROVIDER, 50, 1, 50);
    this.batchMaxItems = boundedInteger(options.env.VOCAB_IMAGE_BATCH_MAX_ITEMS, 500, 1, 1_000);
  }

  get uploadLimitBytes() {
    return this.maxBytes;
  }

  listProviders() {
    return (["stali", "devquota", "seedvis-nano-banana-2", "seedvis-nano-banana-pro"] as const).map(id => {
      const provider = this.providers[id];
      return {
        id: provider.id,
        label: provider.label,
        model: provider.model,
        configured: provider.configured,
        documentationUrl: provider.documentationUrl,
      };
    });
  }

  private getProvider(value: unknown) {
    if (!isGenerationProviderId(value)) throw httpError(400, "Nhà cung cấp tạo ảnh không được hỗ trợ.");
    const provider = this.providers[value];
    if (!provider.configured) throw httpError(503, `${provider.label} chưa được cấu hình API key trên máy chủ.`);
    return provider;
  }

  getDefaultPrompt(rawInput: VocabImageGenerationInput) {
    const term = clean(rawInput?.term, 120);
    const meaning = clean(rawInput?.meaning, 160);
    const partOfSpeech = clean(rawInput?.partOfSpeech || rawInput?.pos, 40);
    return buildVocabImageGenerationPrompt({ term, meaning, partOfSpeech });
  }

  private async storeBytes(input: {
    bytes: Buffer;
    declaredMimeType?: string;
    provider: VocabImageAsset["provider"];
    externalId: string;
    title: string;
    author: string;
    license: string;
    sourcePageUrl?: string;
    prompt?: string;
    model?: string;
    originalFileName?: string;
    actorId: string;
  }) {
    const validated = validateImageBytes(input.bytes, input.declaredMimeType, this.maxBytes);
    const sha256 = crypto.createHash("sha256").update(input.bytes).digest("hex");
    const idHash = crypto.createHash("sha256").update(`${input.provider}:${sha256}`).digest("hex");
    const id = `vimg-${idHash.slice(0, 40)}`;
    const storageKey = `${sha256}.${validated.extension}`;
    const publicPrefix = `/${this.options.publicPrefix.replace(/^\/+|\/+$/g, "")}`;
    const publicUrl = `${publicPrefix}/${storageKey}`;
    const doc = this.options.db.collection("vocab_image_assets").doc(id);
    const existing = await doc.get();
    if (existing.exists) {
      const asset = existing.data() as VocabImageAsset;
      if (asset?.sha256 === sha256 && asset?.publicUrl === publicUrl) return asset;
      throw httpError(409, "Mã ảnh quản lý đã tồn tại với nội dung khác.");
    }

    fs.mkdirSync(this.options.imageDir, { recursive: true });
    const finalPath = path.join(this.options.imageDir, storageKey);
    if (!fs.existsSync(finalPath)) {
      const temporaryPath = path.join(this.options.imageDir, `.tmp-${process.pid}-${crypto.randomUUID()}`);
      try {
        fs.writeFileSync(temporaryPath, input.bytes, { flag: "wx" });
        try {
          fs.renameSync(temporaryPath, finalPath);
        } catch (error: any) {
          if (!fs.existsSync(finalPath)) throw error;
        }
      } finally {
        if (fs.existsSync(temporaryPath)) fs.unlinkSync(temporaryPath);
      }
    }

    const timestamp = this.now().toISOString();
    const asset: VocabImageAsset = {
      id,
      provider: input.provider,
      externalId: clean(input.externalId, 500),
      title: clean(input.title, 500),
      author: clean(input.author, 500),
      license: clean(input.license, 300),
      ...(input.sourcePageUrl ? { sourcePageUrl: input.sourcePageUrl } : {}),
      sha256,
      mimeType: validated.mimeType,
      storageKey,
      publicUrl,
      ...(input.prompt ? { prompt: input.prompt } : {}),
      ...(input.model ? { model: input.model } : {}),
      ...(input.originalFileName ? { originalFileName: input.originalFileName } : {}),
      createdBy: clean(input.actorId, 200),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await doc.set(asset);
    return asset;
  }

  async generate(rawProviderId: unknown, rawInput: VocabImageGenerationInput, actorId: string, rawPrompt?: unknown) {
    const provider = this.getProvider(rawProviderId);
    const term = clean(rawInput?.term, 120);
    const defaultPrompt = this.getDefaultPrompt(rawInput);
    const prompt = rawPrompt === undefined ? defaultPrompt : validateVocabImageCustomPrompt(rawPrompt);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const generated = await provider.generate(prompt, controller.signal);
      const downloaded = generated.bytes
        ? validateImageBytes(generated.bytes, generated.declaredMimeType, this.maxBytes)
        : generated.remoteUrl
          ? await downloadImageSecurely(generated.remoteUrl, {
              fetchImpl: this.options.fetchImpl,
              resolveHost: this.options.resolveHost,
              allowedHosts: provider.allowedDownloadHosts,
              timeoutMs: this.downloadTimeoutMs,
              maxBytes: this.maxBytes,
            })
          : null;
      if (!downloaded) throw httpError(502, `${provider.label} không trả về dữ liệu ảnh hợp lệ.`);
      const asset = await this.storeBytes({
        bytes: downloaded.bytes,
        declaredMimeType: downloaded.mimeType,
        provider: provider.id,
        externalId: generated.requestId || `${provider.id}-${crypto.randomUUID()}`,
        title: `Ảnh từ vựng: ${term}`,
        author: `${provider.label} · ${provider.model}`,
        license: "Ảnh do AI tạo theo yêu cầu của giáo viên",
        sourcePageUrl: provider.documentationUrl,
        prompt,
        model: provider.model,
        actorId,
      });
      return { asset, prompt, provider: provider.id, model: provider.model };
    } catch (error: any) {
      if (error?.name === "AbortError") throw httpError(504, `${provider.label} tạo ảnh quá thời gian chờ.`);
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  async upload(input: VocabImageUploadInput, actorId: string) {
    if (!input.rightsConfirmed) throw httpError(400, "Giáo viên phải xác nhận có quyền sử dụng ảnh trước khi tải lên.");
    const fileName = cleanFileName(input.fileName);
    const sha = crypto.createHash("sha256").update(input.bytes).digest("hex");
    return this.storeBytes({
      bytes: input.bytes,
      declaredMimeType: input.declaredMimeType,
      provider: "upload",
      externalId: `upload-${sha.slice(0, 32)}`,
      title: fileName,
      author: "Giáo viên tải lên",
      license: "Giáo viên xác nhận quyền sử dụng",
      originalFileName: fileName,
      actorId,
    });
  }

  async batchGenerate(rawProvider: unknown, rawItems: unknown, actorId: string) {
    const items = Array.isArray(rawItems) ? rawItems.slice(0, this.batchMaxItems) : [];
    if (items.length === 0) throw httpError(400, "Cần ít nhất một từ vựng để tạo ảnh hàng loạt.");
    const providerChoice: VocabImageBatchProvider = rawProvider === "auto"
      ? "auto"
      : isGenerationProviderId(rawProvider) ? rawProvider : "auto";
    const configured = (["stali", "devquota", "seedvis-nano-banana-2", "seedvis-nano-banana-pro"] as const)
      .filter(id => this.providers[id].configured);
    if (configured.length === 0) throw httpError(503, "Chưa cấu hình key của dịch vụ tạo ảnh trên máy chủ.");
    const providerLimiters = Object.fromEntries(
      (["stali", "devquota", "seedvis-nano-banana-2", "seedvis-nano-banana-pro"] as const)
        .map(id => [id, createConcurrencyLimiter(this.batchConcurrencyPerProvider)])
    ) as Record<VocabImageGenerationProviderId, ReturnType<typeof createConcurrencyLimiter>>;

    return Promise.all(items.map(async (rawItem: any, index) => {
      const id = clean(rawItem?.id, 160) || `item-${index + 1}`;
      const preferred = providerChoice === "auto" ? configured[index % configured.length] : providerChoice;
      const attempts = [preferred, ...configured.filter(candidate => candidate !== preferred)];
      let lastError: any = null;
      for (const providerId of attempts) {
        try {
          const result = await providerLimiters[providerId](() => this.generate(providerId, rawItem || {}, actorId));
          return { id, provider: providerId, asset: result.asset, prompt: result.prompt };
        } catch (error: any) {
          lastError = error;
          if (providerChoice !== "auto") break;
        }
      }
      return {
        id,
        provider: preferred,
        error: String(lastError?.message || "Không tạo được ảnh.").slice(0, 500),
      };
    }));
  }
}
