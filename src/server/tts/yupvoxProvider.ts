import { isIP } from "node:net";

export type YupVoxFetch = (url: string, init?: RequestInit) => Promise<Response>;

export type YupVoxTtsConfig = {
  apiKey: string;
  baseUrl?: string;
  maxPollAttempts?: number;
  pollIntervalMs?: number;
};

export type GenerateYupVoxAudioOptions = YupVoxTtsConfig & {
  voiceId: string;
  text: string;
  fetchImpl: YupVoxFetch;
  wait?: (ms: number) => Promise<unknown>;
};

const DEFAULT_BASE_URL = "https://api.yupvox.com";
const DEFAULT_MAX_POLL_ATTEMPTS = 40;
const DEFAULT_POLL_INTERVAL_MS = 1500;

function clampInteger(value: number | undefined, fallback: number, min: number, max: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value as number)));
}

function getErrorMessage(payload: any, fallback: string) {
  const message = payload?.data?.error
    || payload?.data?.message
    || payload?.error
    || payload?.message;
  return typeof message === "string" && message.trim() ? message.trim() : fallback;
}

async function readJsonResponse(response: Response) {
  return response.json().catch(() => ({}));
}

export function normalizeYupVoxBaseUrl(value?: string) {
  const url = new URL(String(value || DEFAULT_BASE_URL).trim());
  if (url.protocol !== "https:") {
    throw new Error("YUPVOX_BASE_URL must use HTTPS.");
  }
  if (url.username || url.password) {
    throw new Error("YUPVOX_BASE_URL must not contain credentials.");
  }
  url.pathname = url.pathname.replace(/\/+$/, "");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

function isPrivateIpv4(hostname: string) {
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  return a === 10
    || a === 127
    || a === 0
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168);
}

export function assertSafeYupVoxAudioUrl(value: string) {
  let url: URL;
  try {
    url = new URL(String(value || "").trim());
  } catch {
    throw new Error("YupVox returned an invalid audio URL.");
  }

  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("YupVox audio URL must be a credential-free HTTPS URL.");
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const ipVersion = isIP(hostname);
  if (
    hostname === "localhost"
    || hostname.endsWith(".localhost")
    || hostname.endsWith(".local")
    || isPrivateIpv4(hostname)
    || (ipVersion === 6 && (hostname === "::1" || hostname.startsWith("fe80:") || hostname.startsWith("fc") || hostname.startsWith("fd")))
  ) {
    throw new Error("YupVox returned an unsafe audio URL.");
  }

  return url.toString();
}

export async function generateYupVoxAudioUrl(options: GenerateYupVoxAudioOptions) {
  const apiKey = String(options.apiKey || "").trim();
  const voiceId = String(options.voiceId || "").trim();
  const text = String(options.text || "").trim();
  if (!apiKey) throw new Error("YUPVOX_API_KEY is not configured.");
  if (!voiceId) throw new Error("Missing YupVox voiceId.");
  if (!text) throw new Error("Missing YupVox TTS text.");

  const baseUrl = normalizeYupVoxBaseUrl(options.baseUrl);
  const maxPollAttempts = clampInteger(options.maxPollAttempts, DEFAULT_MAX_POLL_ATTEMPTS, 1, 120);
  const pollIntervalMs = clampInteger(options.pollIntervalMs, DEFAULT_POLL_INTERVAL_MS, 250, 10_000);
  const wait = options.wait || (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json"
  };

  const createResponse = await options.fetchImpl(`${baseUrl}/v1/tts`, {
    method: "POST",
    headers,
    body: JSON.stringify({ voiceId, text })
  });
  const createPayload: any = await readJsonResponse(createResponse);
  if (!createResponse.ok) {
    throw new Error(getErrorMessage(createPayload, `YupVox TTS request failed with HTTP ${createResponse.status}.`));
  }

  const jobId = String(createPayload?.data?.jobId || "").trim();
  if (!jobId) {
    throw new Error(getErrorMessage(createPayload, "YupVox did not return data.jobId."));
  }

  for (let attempt = 0; attempt < maxPollAttempts; attempt += 1) {
    if (attempt > 0) await wait(pollIntervalMs);
    const statusResponse = await options.fetchImpl(`${baseUrl}/v1/tts/${encodeURIComponent(jobId)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    const statusPayload: any = await readJsonResponse(statusResponse);
    if (!statusResponse.ok) {
      throw new Error(getErrorMessage(statusPayload, `YupVox TTS status failed with HTTP ${statusResponse.status}.`));
    }

    const status = String(statusPayload?.data?.status || "").trim().toLowerCase();
    if (status === "failed" || status === "error") {
      throw new Error(getErrorMessage(statusPayload, "YupVox TTS job failed."));
    }
    if (status === "completed") {
      const audioUrl = String(statusPayload?.data?.audioUrl || "").trim();
      if (!audioUrl) throw new Error("YupVox completed the job without data.audioUrl.");
      return assertSafeYupVoxAudioUrl(audioUrl);
    }
  }

  throw new Error("YupVox TTS job timed out before audio was ready.");
}
