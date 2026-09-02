import type { NextFunction, Request, RequestHandler, Response } from "express";
import crypto from "node:crypto";

export const DEFAULT_JSON_BODY_LIMIT = "100kb";

export function parseTrustedProxyHops(value: unknown) {
  if (value === undefined || value === null || value === "") return 0;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 10) {
    throw new Error("TRUST_PROXY_HOPS must be an integer from 0 to 10.");
  }
  return parsed;
}

export function applySecurityHeaders(isProduction: boolean): RequestHandler {
  return (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Content-Security-Policy", "base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), geolocation=(), microphone=(self), payment=(), usb=()");
    res.setHeader("X-DNS-Prefetch-Control", "off");
    res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
    if (isProduction) {
      res.setHeader("Strict-Transport-Security", "max-age=15552000");
    }
    next();
  };
}

export function getRequestNetworkKey(req: Request) {
  return String(req.ip || req.socket.remoteAddress || "unknown").trim() || "unknown";
}

export interface FixedWindowRateLimitOptions {
  namespace: string;
  windowMs: number;
  maxCost: number;
  key?: (req: Request) => string;
  cost?: (req: Request) => number;
  message?: string;
  now?: () => number;
  maxEntries?: number;
}

interface FixedWindowEntry {
  cost: number;
  resetAt: number;
}

export class FixedWindowRateLimitStore {
  private readonly entries = new Map<string, FixedWindowEntry>();
  private operations = 0;

  constructor(
    private readonly windowMs: number,
    private readonly maxCost: number,
    private readonly now: () => number = Date.now,
    private readonly maxEntries = 50_000
  ) {}

  private removeExpired(currentTime: number) {
    for (const [storedKey, storedEntry] of this.entries) {
      if (storedEntry.resetAt <= currentTime) this.entries.delete(storedKey);
    }
  }

  private ensureCapacity(currentTime: number) {
    if (this.entries.size < this.maxEntries) return;
    this.removeExpired(currentTime);
    while (this.entries.size >= this.maxEntries) {
      const oldestKey = this.entries.keys().next().value;
      if (oldestKey === undefined) break;
      this.entries.delete(oldestKey);
    }
  }

  consume(key: string, requestedCost = 1) {
    const currentTime = this.now();
    const cost = Math.max(1, Math.floor(Number(requestedCost) || 1));
    const current = this.entries.get(key);
    if (!current) this.ensureCapacity(currentTime);
    const entry = !current || current.resetAt <= currentTime
      ? { cost: 0, resetAt: currentTime + this.windowMs }
      : current;
    const allowed = entry.cost + cost <= this.maxCost;
    if (allowed) entry.cost += cost;
    this.entries.set(key, entry);

    this.operations += 1;
    if (this.operations % 256 === 0) {
      this.removeExpired(currentTime);
    }

    return {
      allowed,
      limit: this.maxCost,
      remaining: Math.max(0, this.maxCost - entry.cost),
      resetAt: entry.resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - currentTime) / 1000))
    };
  }
}

export function createFixedWindowRateLimiter(options: FixedWindowRateLimitOptions): RequestHandler {
  const store = new FixedWindowRateLimitStore(
    options.windowMs,
    options.maxCost,
    options.now,
    options.maxEntries
  );
  return (req: Request, res: Response, next: NextFunction) => {
    const actor = (req as Request & { user?: { id?: string } }).user?.id;
    const rawKey = options.key?.(req) || (actor ? `user:${actor}` : `ip:${getRequestNetworkKey(req)}`);
    const result = store.consume(`${options.namespace}:${rawKey}`, options.cost?.(req) || 1);
    res.setHeader("RateLimit-Limit", String(result.limit));
    res.setHeader("RateLimit-Remaining", String(result.remaining));
    res.setHeader("RateLimit-Reset", String(Math.ceil(result.resetAt / 1000)));
    if (!result.allowed) {
      res.setHeader("Retry-After", String(result.retryAfterSeconds));
      return res.status(429).json({
        error: options.message || "Too many requests. Please wait and try again.",
        code: "RATE_LIMITED"
      });
    }
    next();
  };
}

export function safeEqualSecret(provided: unknown, configured: unknown) {
  const left = Buffer.from(String(provided || ""));
  const right = Buffer.from(String(configured || ""));
  return left.length > 0 && left.length === right.length && crypto.timingSafeEqual(left, right);
}
