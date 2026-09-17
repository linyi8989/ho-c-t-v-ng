import dns from "node:dns/promises";
import net from "node:net";
import type { VocabImageAsset } from "./types.js";

type SupportedMimeType = VocabImageAsset["mimeType"];

const MIME_ALIASES: Record<string, SupportedMimeType | undefined> = {
  "image/jpeg": "image/jpeg",
  "image/jpg": "image/jpeg",
  "image/png": "image/png",
  "image/webp": "image/webp",
  "image/gif": "image/gif",
};

export interface SecureImageDownloadOptions {
  fetchImpl?: typeof fetch;
  resolveHost?: (hostname: string) => Promise<Array<{ address: string; family: number }>>;
  allowedHosts: readonly string[];
  timeoutMs: number;
  maxBytes: number;
  maxRedirects?: number;
}

export interface SecureImageDownload {
  bytes: Buffer;
  mimeType: SupportedMimeType;
  extension: "jpg" | "png" | "webp" | "gif";
  finalUrl: string;
}

function createHttpError(status: number, message: string) {
  return Object.assign(new Error(message), { status });
}

function isPrivateIpv4(address: string) {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some(value => !Number.isInteger(value) || value < 0 || value > 255)) return true;
  const [a, b] = octets;
  return a === 0
    || a === 10
    || a === 127
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 100 && b >= 64 && b <= 127)
    || a >= 224;
}

export function isPrivateNetworkAddress(address: string) {
  const normalized = address.trim().toLowerCase();
  const family = net.isIP(normalized);
  if (family === 4) return isPrivateIpv4(normalized);
  if (family !== 6) return true;
  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8")
    || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) return true;
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return mapped ? isPrivateIpv4(mapped[1]) : false;
}

export function hostnameMatchesAllowlist(hostname: string, allowedHosts: readonly string[]) {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  return allowedHosts.some(rawHost => {
    const allowed = rawHost.toLowerCase().replace(/\.$/, "");
    return normalized === allowed || normalized.endsWith(`.${allowed}`);
  });
}

async function defaultResolveHost(hostname: string) {
  const records = await dns.lookup(hostname, { all: true, verbatim: true });
  return records.map(record => ({ address: record.address, family: record.family }));
}

async function assertSafeUrl(
  value: string,
  allowedHosts: readonly string[],
  resolveHost: NonNullable<SecureImageDownloadOptions["resolveHost"]>
) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw createHttpError(400, "Image provider returned an invalid URL.");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) {
    throw createHttpError(400, "Only standard HTTPS image URLs are allowed.");
  }
  if (!hostnameMatchesAllowlist(url.hostname, allowedHosts) || net.isIP(url.hostname)) {
    throw createHttpError(400, "Image download host is not allowed for this provider.");
  }
  const addresses = await resolveHost(url.hostname);
  if (addresses.length === 0 || addresses.some(record => isPrivateNetworkAddress(record.address))) {
    throw createHttpError(400, "Image download host resolved to a blocked network address.");
  }
  return url;
}

export function sniffMimeType(bytes: Buffer): SupportedMimeType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (bytes.length >= 6 && ["GIF87a", "GIF89a"].includes(bytes.subarray(0, 6).toString("ascii"))) return "image/gif";
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF"
    && bytes.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return null;
}

export function extensionForMime(mimeType: SupportedMimeType): SecureImageDownload["extension"] {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "gif";
}

export function validateImageBytes(bytes: Buffer, declaredMimeType: unknown, maxBytes: number) {
  const limit = Math.max(64 * 1024, Math.min(20 * 1024 * 1024, Math.floor(maxBytes)));
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) throw createHttpError(400, "Tệp ảnh đang trống.");
  if (bytes.length > limit) throw createHttpError(413, "Tệp ảnh lớn hơn giới hạn cho phép.");
  const sniffedMime = sniffMimeType(bytes);
  if (!sniffedMime) throw createHttpError(415, "Dữ liệu không đúng định dạng ảnh JPEG, PNG, WebP hoặc GIF.");
  const normalizedDeclared = MIME_ALIASES[String(declaredMimeType || "").split(";", 1)[0].trim().toLowerCase()];
  if (declaredMimeType && (!normalizedDeclared || normalizedDeclared !== sniffedMime)) {
    throw createHttpError(415, "Loại tệp khai báo không khớp với dữ liệu ảnh.");
  }
  return { bytes, mimeType: sniffedMime, extension: extensionForMime(sniffedMime) };
}

async function readBoundedBody(response: Response, maxBytes: number) {
  const declared = Number(response.headers.get("content-length") || 0);
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw createHttpError(413, "Image is larger than the configured limit.");
  }
  if (!response.body) throw createHttpError(502, "Image provider returned an empty response.");
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw createHttpError(413, "Image is larger than the configured limit.");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, total);
}

export async function downloadImageSecurely(
  sourceUrl: string,
  options: SecureImageDownloadOptions
): Promise<SecureImageDownload> {
  const fetchImpl = options.fetchImpl || fetch;
  const resolveHost = options.resolveHost || defaultResolveHost;
  const maxBytes = Math.max(64 * 1024, Math.min(20 * 1024 * 1024, Math.floor(options.maxBytes)));
  const timeoutMs = Math.max(1_000, Math.min(60_000, Math.floor(options.timeoutMs)));
  const maxRedirects = Math.max(0, Math.min(5, options.maxRedirects ?? 3));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let currentUrl = await assertSafeUrl(sourceUrl, options.allowedHosts, resolveHost);
    for (let redirectCount = 0; redirectCount <= maxRedirects; redirectCount += 1) {
      const response = await fetchImpl(currentUrl, {
        signal: controller.signal,
        redirect: "manual",
        headers: { Accept: "image/jpeg,image/png,image/webp,image/gif" },
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        if (redirectCount === maxRedirects) throw createHttpError(502, "Image provider redirected too many times.");
        const location = response.headers.get("location");
        if (!location) throw createHttpError(502, "Image provider returned an invalid redirect.");
        currentUrl = await assertSafeUrl(new URL(location, currentUrl).toString(), options.allowedHosts, resolveHost);
        continue;
      }
      if (!response.ok) throw createHttpError(502, `Image download failed (${response.status}).`);
      const headerMime = MIME_ALIASES[String(response.headers.get("content-type") || "").split(";", 1)[0].trim().toLowerCase()];
      if (!headerMime) throw createHttpError(415, "Image provider returned an unsupported content type.");
      const bytes = await readBoundedBody(response, maxBytes);
      const sniffedMime = sniffMimeType(bytes);
      if (!sniffedMime || sniffedMime !== headerMime) {
        throw createHttpError(415, "Image bytes do not match the declared content type.");
      }
      return {
        bytes,
        mimeType: sniffedMime,
        extension: extensionForMime(sniffedMime),
        finalUrl: currentUrl.toString(),
      };
    }
    throw createHttpError(502, "Image download failed.");
  } catch (error: any) {
    if (error?.name === "AbortError") throw createHttpError(504, "Image download timed out.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
