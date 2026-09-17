import crypto from "node:crypto";
import type {
  GeneratedVocabImage,
  VocabImageGenerationProvider,
  VocabImageGenerationProviderId,
} from "./types.js";
import { resolveDevQuotaApiKey } from "../runtimeConfig.js";

export const STALI_IMAGE_MODEL = "req/gpt-image-2";
export const DEVQUOTA_IMAGE_MODEL = "gpt-image-2";
export const SEEDVIS_NANO_BANANA_2_MODEL = "NARWHAL";
export const SEEDVIS_NANO_BANANA_PRO_MODEL = "GEM_PIX_2";
export const STALI_IMAGE_BASE_URL = "https://api.stali.vn/v1";
export const DEVQUOTA_IMAGE_BASE_URL = "https://sv.devquote.shop/v1";
export const SEEDVIS_IMAGE_BASE_URL = "https://seedvis.com/api/v1";

function httpError(status: number, message: string) {
  return Object.assign(new Error(message), { status });
}

async function fetchUpstream(fetchImpl: typeof fetch, url: string, init: RequestInit, label: string) {
  try {
    return await fetchImpl(url, init);
  } catch (error: any) {
    if (error?.name === "AbortError") throw error;
    throw httpError(502, `Không kết nối được tới ${label}. Hãy kiểm tra DNS, firewall hoặc quyền truy cập mạng của máy chủ.`);
  }
}

async function readUpstreamError(response: Response, label: string) {
  const raw = await response.text().catch(() => "");
  let message = "";
  try {
    const payload = JSON.parse(raw);
    message = String(payload?.error?.message || payload?.message || payload?.error || "");
  } catch {
    message = raw;
  }
  const cleanMessage = message.replace(/\s+/g, " ").trim().slice(0, 500);
  return cleanMessage
    ? `${label}: ${cleanMessage}`
    : `${label} tạo ảnh thất bại (HTTP ${response.status}).`;
}

function normalizeBaseUrl(value: unknown, fallback: string, variableName: string) {
  const candidate = String(value || fallback).trim().replace(/\/+$/, "");
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw httpError(500, `${variableName} không phải URL hợp lệ.`);
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
    throw httpError(500, `${variableName} phải dùng HTTPS an toàn.`);
  }
  return candidate;
}

function extractImagePayload(data: any) {
  const first = Array.isArray(data?.data) ? data.data[0] : undefined;
  const direct = first?.b64_json || first?.base64 || first?.image_base64 || data?.b64_json || data?.image_base64;
  if (typeof direct === "string" && direct.trim()) {
    return { bytes: Buffer.from(direct.trim(), "base64"), declaredMimeType: String(first?.mime_type || data?.mime_type || "") || undefined };
  }
  const url = typeof first?.url === "string" ? first.url.trim() : "";
  const dataUrl = url.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/i);
  if (dataUrl) return { bytes: Buffer.from(dataUrl[2].replace(/\s+/g, ""), "base64"), declaredMimeType: dataUrl[1].toLowerCase() };
  throw httpError(502, "Nhà cung cấp không trả về image data hợp lệ.");
}

function provider(input: {
  id: VocabImageGenerationProviderId;
  label: string;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  fallbackBaseUrl: string;
  variableName: string;
  documentationUrl: string;
  fetchImpl: typeof fetch;
}): VocabImageGenerationProvider {
  const apiKey = input.apiKey?.trim() || "";
  return {
    id: input.id,
    label: input.label,
    model: input.model,
    configured: Boolean(apiKey),
    documentationUrl: input.documentationUrl,
    allowedDownloadHosts: [],
    async generate(prompt, signal): Promise<GeneratedVocabImage> {
      if (!apiKey) throw httpError(503, `${input.variableName.replace("_BASE_URL", "_API_KEY")} chưa được cấu hình trên máy chủ.`);
      const baseUrl = normalizeBaseUrl(input.baseUrl, input.fallbackBaseUrl, input.variableName);
      const response = await fetchUpstream(input.fetchImpl, `${baseUrl}/images/generations`, {
        method: "POST",
        signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: input.model, prompt, size: "1024x1024", n: 1 }),
      }, input.label);
      if (!response.ok) {
        throw httpError(response.status, await readUpstreamError(response, input.label));
      }
      const data = await response.json().catch(() => null);
      const image = extractImagePayload(data);
      return {
        ...image,
        provider: input.id,
        model: input.model,
        ...(data?.id ? { requestId: String(data.id).slice(0, 200) } : {}),
      };
    },
  };
}

function isSeedvisUrl(value: string, purpose: "poll" | "output") {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw httpError(502, `Seedvis returned an invalid ${purpose} URL.`);
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.port) {
    throw httpError(502, `Seedvis returned an unsafe ${purpose} URL.`);
  }
  const hostname = parsed.hostname.toLowerCase();
  if (purpose === "poll") {
    if (hostname !== "seedvis.com" || !parsed.pathname.startsWith("/api/v1/developer/generations/")) {
      throw httpError(502, "Seedvis returned a poll URL outside its API boundary.");
    }
  } else if (hostname !== "cdn.seedvis.com") {
    throw httpError(502, "Seedvis returned an image URL outside its CDN boundary.");
  }
  return parsed.toString();
}

function seedvisErrorMessage(data: any, fallback: string) {
  return String(data?.error?.message || data?.message || data?.error || fallback).replace(/\s+/g, " ").trim().slice(0, 500);
}

async function seedvisJson(response: Response, label: string) {
  const data = await response.json().catch(() => null);
  if (!response.ok) throw httpError(response.status, seedvisErrorMessage(data, `${label} failed (HTTP ${response.status}).`));
  return data;
}

function seedvisProvider(input: {
  id: Extract<VocabImageGenerationProviderId, "seedvis-nano-banana-2" | "seedvis-nano-banana-pro">;
  label: string;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  fetchImpl: typeof fetch;
}): VocabImageGenerationProvider {
  const apiKey = input.apiKey?.trim() || "";
  return {
    id: input.id,
    label: input.label,
    model: input.model,
    configured: Boolean(apiKey),
    documentationUrl: "https://seedvis.com/api-docs",
    allowedDownloadHosts: ["cdn.seedvis.com"],
    async generate(prompt, signal): Promise<GeneratedVocabImage> {
      if (!apiKey) throw httpError(503, "SEEDVIS_API_KEY chưa được cấu hình trên máy chủ.");
      const baseUrl = normalizeBaseUrl(input.baseUrl, SEEDVIS_IMAGE_BASE_URL, "SEEDVIS_BASE_URL");
      const headers = {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": crypto.randomUUID(),
      };
      const created = await fetchUpstream(input.fetchImpl, `${baseUrl}/developer/generations`, {
        method: "POST",
        signal,
        headers,
        body: JSON.stringify({
          model: input.model,
          prompt,
          aspect_ratio: "4:3",
          count: 1,
        }),
      }, input.label);
      let envelope = await seedvisJson(created, `${input.label} generation`);
      let generation = envelope?.data || envelope;
      const requestId = String(generation?.id || "").trim().slice(0, 200);

      for (let poll = 0; poll < 10 && !generation?.is_final; poll += 1) {
        if (generation?.status === "failed") throw httpError(502, seedvisErrorMessage(generation, `${input.label} generation failed.`));
        const nextUrl = isSeedvisUrl(String(generation?.next?.url || ""), "poll");
        const polled = await fetchUpstream(input.fetchImpl, nextUrl, {
          method: "GET",
          signal,
          headers: { Authorization: `Bearer ${apiKey}` },
        }, input.label);
        envelope = await seedvisJson(polled, `${input.label} polling`);
        generation = envelope?.data || envelope;
      }

      if (!generation?.is_final) throw httpError(504, `${input.label} chưa hoàn tất trong giới hạn polling an toàn.`);
      if (generation?.status !== "completed") throw httpError(502, seedvisErrorMessage(generation, `${input.label} generation failed.`));
      const output = Array.isArray(generation?.outputs)
        ? generation.outputs.find((item: any) => item?.type === "image" && typeof item?.url === "string") || generation.outputs[0]
        : null;
      const remoteUrl = isSeedvisUrl(String(output?.url || ""), "output");
      return {
        remoteUrl,
        provider: input.id,
        model: input.model,
        ...(requestId ? { requestId } : {}),
      };
    },
  };
}

export function createVocabImageGenerationProviders(env: NodeJS.ProcessEnv, fetchImpl: typeof fetch = fetch) {
  return {
    stali: provider({
      id: "stali",
      label: "Stali · GPT Image 2",
      model: STALI_IMAGE_MODEL,
      apiKey: env.STALI_API_KEY,
      baseUrl: env.STALI_BASE_URL,
      fallbackBaseUrl: STALI_IMAGE_BASE_URL,
      variableName: "STALI_BASE_URL",
      documentationUrl: "https://api.stali.vn/docs",
      fetchImpl,
    }),
    devquota: provider({
      id: "devquota",
      label: "DevQuota · GPT Image 2",
      model: DEVQUOTA_IMAGE_MODEL,
      apiKey: resolveDevQuotaApiKey(env),
      baseUrl: env.DEVQUOTA_BASE_URL,
      fallbackBaseUrl: DEVQUOTA_IMAGE_BASE_URL,
      variableName: "DEVQUOTA_BASE_URL",
      documentationUrl: "https://devquota.shop/models",
      fetchImpl,
    }),
    "seedvis-nano-banana-2": seedvisProvider({
      id: "seedvis-nano-banana-2",
      label: "Seedvis · Google Nano Banana 2",
      model: SEEDVIS_NANO_BANANA_2_MODEL,
      apiKey: env.SEEDVIS_API_KEY,
      baseUrl: env.SEEDVIS_BASE_URL,
      fetchImpl,
    }),
    "seedvis-nano-banana-pro": seedvisProvider({
      id: "seedvis-nano-banana-pro",
      label: "Seedvis · Google Nano Banana Pro",
      model: SEEDVIS_NANO_BANANA_PRO_MODEL,
      apiKey: env.SEEDVIS_API_KEY,
      baseUrl: env.SEEDVIS_BASE_URL,
      fetchImpl,
    }),
  } satisfies Record<VocabImageGenerationProviderId, VocabImageGenerationProvider>;
}
