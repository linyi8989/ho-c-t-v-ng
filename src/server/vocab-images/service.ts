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

type VocabImageBatchJobStatus = "queued" | "running" | "completed" | "failed";

interface PreparedVocabImageBatchItem {
  id: string;
  term: string;
  meaning: string;
  pos: string;
}

interface VocabImageBatchJobRecord {
  id: string;
  actorId: string;
  provider: VocabImageBatchProvider;
  status: VocabImageBatchJobStatus;
  total: number;
  completed: number;
  succeeded: number;
  failed: number;
  inputs: PreparedVocabImageBatchItem[];
  error?: string;
  leaseOwner?: string;
  leaseExpiresAt?: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
}

const BATCH_JOB_COLLECTION = "vocab_image_batch_jobs";
const BATCH_JOB_RESULT_COLLECTION = "vocab_image_batch_job_results";
const BATCH_JOB_TTL_MS = 24 * 60 * 60 * 1000;
const BATCH_JOB_LEASE_MS = 60 * 1000;
const BATCH_JOB_HEARTBEAT_MS = 20 * 1000;
const BATCH_WORKER_INSTANCE_ID = `vimgworker-${process.pid}-${crypto.randomUUID()}`;

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
  private readonly activeBatchJobIds = new Set<string>();
  readonly batchConcurrencyPerProvider: number;
  readonly batchTotalConcurrency: number;
  readonly batchMaxItems: number;

  constructor(private readonly options: VocabImageLibraryOptions) {
    this.providers = createVocabImageGenerationProviders(options.env, options.fetchImpl);
    this.now = options.now || (() => new Date());
    this.timeoutMs = boundedInteger(options.env.VOCAB_IMAGE_GENERATION_TIMEOUT_MS, 120_000, 10_000, 300_000);
    this.downloadTimeoutMs = boundedInteger(options.env.VOCAB_IMAGE_DOWNLOAD_TIMEOUT_MS, 30_000, 2_000, 60_000);
    this.maxBytes = boundedInteger(options.env.VOCAB_IMAGE_MAX_BYTES, 8 * 1024 * 1024, 64 * 1024, 20 * 1024 * 1024);
    this.batchConcurrencyPerProvider = boundedInteger(options.env.VOCAB_IMAGE_BATCH_CONCURRENCY_PER_PROVIDER, 50, 1, 50);
    this.batchTotalConcurrency = boundedInteger(options.env.VOCAB_IMAGE_BATCH_TOTAL_CONCURRENCY, 8, 1, 100);
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
    const prepared = this.prepareBatch(rawProvider, rawItems);
    return this.executeBatch(prepared.providerChoice, prepared.items, prepared.configured, actorId);
  }

  async startBatchGenerationJob(rawProvider: unknown, rawItems: unknown, actorId: string) {
    const prepared = this.prepareBatch(rawProvider, rawItems);
    const now = this.now();
    const job: VocabImageBatchJobRecord = {
      id: `vimgjob-${crypto.randomUUID()}`,
      actorId: clean(actorId, 200),
      provider: prepared.providerChoice,
      status: "queued",
      total: prepared.items.length,
      completed: 0,
      succeeded: 0,
      failed: 0,
      inputs: prepared.items,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + BATCH_JOB_TTL_MS).toISOString(),
    };
    await this.options.db.collection(BATCH_JOB_COLLECTION).doc(job.id).set(job);
    this.scheduleBatchGenerationJob(job, prepared.configured);
    return this.publicBatchJob(job, []);
  }

  async getBatchGenerationJob(rawJobId: unknown, actorId: string) {
    const jobId = clean(rawJobId, 200);
    const doc = await this.options.db.collection(BATCH_JOB_COLLECTION).doc(jobId).get();
    const job = doc.exists ? doc.data() as VocabImageBatchJobRecord : null;
    if (!job || job.actorId !== clean(actorId, 200)) {
      throw httpError(404, "Không tìm thấy lượt tạo ảnh hàng loạt.");
    }
    const resultSnapshot = await this.options.db.collection(BATCH_JOB_RESULT_COLLECTION)
      .where("jobId", "==", jobId)
      .get();
    const results = (resultSnapshot.docs || [])
      .map((resultDoc: any) => resultDoc.data())
      .sort((left: any, right: any) => Number(left.index) - Number(right.index))
      .map((entry: any) => entry.result);
    const leaseExpired = !job.leaseExpiresAt || Date.parse(job.leaseExpiresAt) <= this.now().getTime();
    if (job.status === "queued" || (job.status === "running" && leaseExpired)) {
      const configured = (["stali", "devquota", "seedvis-nano-banana-2", "seedvis-nano-banana-pro"] as const)
        .filter(id => this.providers[id].configured);
      if (configured.length > 0) this.scheduleBatchGenerationJob(job, configured);
    }
    return this.publicBatchJob(job, results);
  }

  private prepareBatch(rawProvider: unknown, rawItems: unknown) {
    const sourceItems = Array.isArray(rawItems) ? rawItems.slice(0, this.batchMaxItems) : [];
    if (sourceItems.length === 0) throw httpError(400, "Cần ít nhất một từ vựng để tạo ảnh hàng loạt.");
    const providerChoice: VocabImageBatchProvider = rawProvider === "auto"
      ? "auto"
      : isGenerationProviderId(rawProvider) ? rawProvider : "auto";
    const configured = (["stali", "devquota", "seedvis-nano-banana-2", "seedvis-nano-banana-pro"] as const)
      .filter(id => this.providers[id].configured);
    if (configured.length === 0) throw httpError(503, "Chưa cấu hình key của dịch vụ tạo ảnh trên máy chủ.");
    if (providerChoice !== "auto") this.getProvider(providerChoice);
    const items = sourceItems.map((rawItem: any, index) => ({
      id: clean(rawItem?.id, 160) || `item-${index + 1}`,
      term: clean(rawItem?.term, 120),
      meaning: clean(rawItem?.meaning, 160),
      pos: clean(rawItem?.partOfSpeech || rawItem?.pos, 40),
    }));
    return { providerChoice, configured, items };
  }

  private async executeBatch(
    providerChoice: VocabImageBatchProvider,
    items: PreparedVocabImageBatchItem[],
    configured: VocabImageGenerationProviderId[],
    actorId: string,
    onResult?: (index: number, result: any) => Promise<void>,
    originalIndexes?: number[]
  ) {
    const providerLimiters = Object.fromEntries(
      (["stali", "devquota", "seedvis-nano-banana-2", "seedvis-nano-banana-pro"] as const)
        .map(id => [id, createConcurrencyLimiter(this.batchConcurrencyPerProvider)])
    ) as Record<VocabImageGenerationProviderId, ReturnType<typeof createConcurrencyLimiter>>;
    const totalLimiter = createConcurrencyLimiter(this.batchTotalConcurrency);

    return Promise.all(items.map(async (rawItem, index) => {
      const resultIndex = originalIndexes?.[index] ?? index;
      const id = rawItem.id;
      const preferred = providerChoice === "auto" ? configured[resultIndex % configured.length] : providerChoice;
      const attempts = [preferred, ...configured.filter(candidate => candidate !== preferred)];
      let lastError: any = null;
      let rowResult: any = null;
      for (const providerId of attempts) {
        try {
          const result = await totalLimiter(() => providerLimiters[providerId](() => this.generate(providerId, rawItem, actorId)));
          rowResult = { id, provider: providerId, asset: result.asset, prompt: result.prompt };
          break;
        } catch (error: any) {
          lastError = error;
          if (providerChoice !== "auto") break;
        }
      }
      if (!rowResult) {
        rowResult = {
          id,
          provider: preferred,
          error: String(lastError?.message || "Không tạo được ảnh.").slice(0, 500),
        };
      }
      if (onResult) await onResult(resultIndex, rowResult);
      return rowResult;
    }));
  }

  private scheduleBatchGenerationJob(job: VocabImageBatchJobRecord, configured: VocabImageGenerationProviderId[]) {
    if (this.activeBatchJobIds.has(job.id)) return;
    this.activeBatchJobIds.add(job.id);
    setImmediate(() => {
      void this.runBatchGenerationJob(job, configured).catch(error => {
        console.error("[Vocab image batch] Background job failed:", {
          jobId: job.id,
          message: String(error?.message || error).slice(0, 300),
        });
      }).finally(() => this.activeBatchJobIds.delete(job.id));
    });
  }

  private async runBatchGenerationJob(job: VocabImageBatchJobRecord, configured: VocabImageGenerationProviderId[]) {
    const jobDoc = this.options.db.collection(BATCH_JOB_COLLECTION).doc(job.id);
    const latestDoc = await jobDoc.get();
    const latest = latestDoc.exists ? latestDoc.data() as VocabImageBatchJobRecord : null;
    if (!latest || latest.status === "completed" || latest.status === "failed") return;
    if (latest.status === "running"
      && latest.leaseOwner
      && latest.leaseOwner !== BATCH_WORKER_INSTANCE_ID
      && Date.parse(latest.leaseExpiresAt || "") > this.now().getTime()) return;
    job = { ...latest };
    let persistence = Promise.resolve();
    const persistJob = () => {
      const snapshot = { ...job, inputs: job.inputs.map(item => ({ ...item })) };
      persistence = persistence.then(() => jobDoc.set(snapshot));
      return persistence;
    };
    const renewLease = () => {
      const now = this.now();
      job.leaseOwner = BATCH_WORKER_INSTANCE_ID;
      job.leaseExpiresAt = new Date(now.getTime() + BATCH_JOB_LEASE_MS).toISOString();
      job.updatedAt = now.toISOString();
    };
    const resultSnapshot = await this.options.db.collection(BATCH_JOB_RESULT_COLLECTION)
      .where("jobId", "==", job.id)
      .get();
    const existingEntries = (resultSnapshot.docs || []).map((resultDoc: any) => resultDoc.data());
    const completedIndexes = new Set(existingEntries.map((entry: any) => Number(entry.index)));
    job.completed = completedIndexes.size;
    job.succeeded = existingEntries.filter((entry: any) => Boolean(entry.result?.asset)).length;
    job.failed = existingEntries.filter((entry: any) => !entry.result?.asset).length;
    job.status = "running";
    delete job.error;
    renewLease();
    await persistJob();
    const heartbeat = setInterval(() => {
      renewLease();
      void persistJob().catch(error => console.error("[Vocab image batch] Heartbeat write failed:", {
        jobId: job.id,
        message: String(error?.message || error).slice(0, 300),
      }));
    }, BATCH_JOB_HEARTBEAT_MS);
    try {
      const pendingIndexes = job.inputs.map((_item, index) => index).filter(index => !completedIndexes.has(index));
      const pendingItems = pendingIndexes.map(index => job.inputs[index]);
      await this.executeBatch(job.provider, pendingItems, configured, job.actorId, async (index, result) => {
        const safeResult = this.publicBatchResult(result);
        await this.options.db.collection(BATCH_JOB_RESULT_COLLECTION).doc(`${job.id}:${index}`).set({
          id: `${job.id}:${index}`,
          jobId: job.id,
          index,
          result: safeResult,
          createdAt: this.now().toISOString(),
          expiresAt: job.expiresAt,
        });
        job.completed += 1;
        if (safeResult.asset) job.succeeded += 1;
        else job.failed += 1;
        renewLease();
        await persistJob();
      }, pendingIndexes);
      job.status = "completed";
      job.leaseOwner = "";
      job.leaseExpiresAt = "";
      job.updatedAt = this.now().toISOString();
      await persistJob();
    } catch (error: any) {
      job.status = "failed";
      job.error = String(error?.message || "Lượt tạo ảnh nền thất bại.").slice(0, 500);
      job.leaseOwner = "";
      job.leaseExpiresAt = "";
      job.updatedAt = this.now().toISOString();
      await persistJob();
      throw error;
    } finally {
      clearInterval(heartbeat);
    }
  }

  private publicBatchResult(result: any) {
    if (!result?.asset) return {
      id: clean(result?.id, 160),
      provider: result?.provider,
      error: String(result?.error || "Không tạo được ảnh.").slice(0, 500),
    };
    const asset = result.asset as VocabImageAsset;
    return {
      id: clean(result.id, 160),
      provider: result.provider,
      asset: {
        id: asset.id,
        provider: asset.provider,
        externalId: asset.externalId,
        title: asset.title,
        author: asset.author,
        license: asset.license,
        ...(asset.licenseUrl ? { licenseUrl: asset.licenseUrl } : {}),
        ...(asset.sourcePageUrl ? { sourcePageUrl: asset.sourcePageUrl } : {}),
        publicUrl: asset.publicUrl,
        ...(asset.width ? { width: asset.width } : {}),
        ...(asset.height ? { height: asset.height } : {}),
        ...(asset.model ? { model: asset.model } : {}),
      },
    };
  }

  private publicBatchJob(job: VocabImageBatchJobRecord, items: any[]) {
    return {
      jobId: job.id,
      status: job.status,
      total: job.total,
      completed: job.completed,
      succeeded: job.succeeded,
      failed: job.failed,
      items,
      ...(job.error ? { error: job.error } : {}),
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      expiresAt: job.expiresAt,
      concurrencyPerProvider: this.batchConcurrencyPerProvider,
      totalConcurrency: this.batchTotalConcurrency,
    };
  }
}
