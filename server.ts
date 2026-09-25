import express from "express";
import path from "path";
import crypto from "crypto";
import {
  GRAMMAR_TEXT_GRADING_VERSION,
  isGrammarTextAnswerCorrect,
  normalizeGrammarTextAnswer
} from "./src/lib/grammarAnswers";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import {
  adminDb,
  adminAuth,
  firebaseDiagnosticReady,
  getStorageDiagnostics,
  getStorageRequestMetrics,
  isStorageUnavailableError,
  shutdownStorage,
  withStorageRequestMetrics,
} from "./src/lib/firebaseAdmin.js";
import { normalizeStudentDisplayName, validateStudentDisplayName } from "./src/lib/studentIdentity.js";
import { deterministicRunDocumentId, normalizeClientStartedAt } from "./src/lib/serverLearningRuns.js";
import {
  getCurrentQuizContract,
  getQuizAnswerValue,
  getQuizQuestionText,
  isQuizItemEligible,
  resolveStoredQuizContract
} from "./src/lib/game-engine/quizContracts.js";
import { createLearningHistoryRouter } from "./src/server/learning-history/learningHistoryRouter.js";
import { LISTENING_LIBRARY_SCHEMA_VERSION, resolveListeningModuleId } from "./src/features/listening-library/registry.js";
import { createListeningLibraryRouter } from "./src/server/listening-library/router.js";
import { createMoverLegacyRouter } from "./src/server/listening-library/modules/mover/adapter.js";
import { createMoverReadingWritingRouter } from "./src/server/mover-reading-writing/moverReadingWritingRouter.js";
import { createExamRouter } from "./src/server/exam-platform/examRouter.js";
import { getWritingGradingProviders, gradeWritingWithProvider } from "./src/server/exam-platform/writingGradingProvider.js";
import type { SmartImportImageInput, SmartImportVisionOptions } from "./src/server/listening-smart-import/service.js";
import {
  DEVQUOTA_DEFAULT_BASE_URL,
  generateWithDevQuotaVision,
  getDevQuotaSmartImportProviders,
  isDevQuotaProviderId,
} from "./src/server/listening-smart-import/devQuotaProvider.js";
import {
  generateWithStaliVision,
  getStaliSmartImportProviders,
  isStaliProviderId,
  STALI_DEFAULT_BASE_URL,
} from "./src/server/listening-smart-import/staliProvider.js";
import {
  LOCAL_AUTH_BYPASS_USER,
  isLocalServerAuthBypassAllowed,
} from "./src/lib/localAuthBypass.js";
import {
  projectGrammarAttempt,
  projectVocabularyAttempt
} from "./src/server/learning-history/learningAttemptProjector.js";
import type {
  LearningAttemptProjection,
  LearningHistoryActor,
  LearningHistoryItem
} from "./src/server/learning-history/learningHistoryTypes.js";
import {
  sanitizePublicStudentRecord as sanitizePublicStudentRecordWithSecret
} from "./src/server/publicStudentIdentity.js";
import {
  assertSafeYupVoxAudioUrl,
  generateYupVoxAudioUrl
} from "./src/server/tts/yupvoxProvider.js";
import {
  listeningAttemptToActivity,
  resolveListeningActivityDetailForStaff
} from "./src/server/listening/listeningActivity.js";
import {
  getDefaultRoleForEmail as getConfiguredDefaultRoleForEmail,
  parseBootstrapSuperAdminEmails,
  resolveTrustedRole as resolveConfiguredTrustedRole,
  type AppRole,
} from "./src/server/accessPolicy.js";
import {
  applySecurityHeaders,
  createFixedWindowRateLimiter,
  DEFAULT_JSON_BODY_LIMIT,
  FixedWindowRateLimitStore,
  getRequestNetworkKey,
  parseTrustedProxyHops,
  safeEqualSecret,
} from "./src/server/httpHardening.js";
import {
  canUseLegacyGuestSessionUpdate,
  parseLegacySessionMaxAgeMs,
} from "./src/server/legacySessionAccess.js";
import {
  resolveDevQuotaApiKey,
  resolvePersistentDirectory,
} from "./src/server/runtimeConfig.js";
import { isSpaNavigationRequest } from "./src/server/spaFallback.js";
import {
  archiveResourceRecord,
  isArchivedRecord,
} from "./src/server/resourceLifecycle.js";
import { buildLeaderboard, type LeaderboardPeriod } from "./src/lib/leaderboard.js";
import {
  createVocabImageRouter,
  MANAGED_VOCAB_IMAGE_ASSET_ID,
  MANAGED_VOCAB_IMAGE_URL,
  resolveVocabImageReferencesForSave,
  VocabImageLibraryService,
  vocabImageAttributionFromAsset,
} from "./src/server/vocab-images/index.js";
import { createAdminDataRepository } from "./src/server/admin-data/repository.js";
import { createAdminDataService } from "./src/server/admin-data/service.js";
import { createAdminDataRouter } from "./src/server/admin-data/router.js";
import { createClassManagementRepository } from "./src/server/classes/repository.js";
import { createClassManagementService } from "./src/server/classes/service.js";
import { createClassManagementRouter } from "./src/server/classes/router.js";
import { createAssignmentManagementRepository } from "./src/server/assignments/repository.js";
import { createAssignmentManagementService } from "./src/server/assignments/service.js";
import { createAssignmentManagementRouter } from "./src/server/assignments/router.js";
import { createDiagnosticsRepository } from "./src/server/diagnostics/repository.js";
import { createDiagnosticsService } from "./src/server/diagnostics/service.js";
import { createDiagnosticsRouter } from "./src/server/diagnostics/router.js";
import { createAuthProfileRepository } from "./src/server/auth-profile/repository.js";
import { createAuthProfileProvider } from "./src/server/auth-profile/provider.js";
import { createAuthProfileService } from "./src/server/auth-profile/service.js";
import { createAuthProfileRouter } from "./src/server/auth-profile/router.js";
import { createGuestIdentityRepository } from "./src/server/guest-identity/repository.js";
import { createGuestIdentityService } from "./src/server/guest-identity/service.js";
import { createGuestIdentityRouter } from "./src/server/guest-identity/router.js";
import { createVocabularyAiService } from "./src/server/vocabulary-ai/service.js";
import { createVocabularyAiRouter } from "./src/server/vocabulary-ai/router.js";
import { createVocabularyRepository } from "./src/server/vocabulary/repository.js";
import { createVocabularyService } from "./src/server/vocabulary/service.js";
import { createVocabularyRouter } from "./src/server/vocabulary/router.js";
import { createTtsVoiceProvider } from "./src/server/tts/provider.js";
import { createTtsService } from "./src/server/tts/service.js";
import { createTtsRouter } from "./src/server/tts/router.js";
import { createGrammarLibraryRepository } from "./src/server/grammar/repository.js";
import { createGrammarLibraryService } from "./src/server/grammar/service.js";
import { createGrammarLibraryRouter } from "./src/server/grammar/router.js";
import { createGrammarAttemptRepository } from "./src/server/grammar-attempts/repository.js";
import { createGrammarAttemptService } from "./src/server/grammar-attempts/service.js";
import { createGrammarAttemptRouter } from "./src/server/grammar-attempts/router.js";
import { createVocabularyRunRepository } from "./src/server/vocabulary-runs/repository.js";
import { createVocabularyRunService } from "./src/server/vocabulary-runs/service.js";
import { createVocabularyRunRouter } from "./src/server/vocabulary-runs/router.js";
import { createResultsRepository } from "./src/server/results/repository.js";
import { createResultsService } from "./src/server/results/service.js";
import { createResultsRouter } from "./src/server/results/router.js";
import { createAccountRepository } from "./src/server/accounts/repository.js";
import { createAccountService } from "./src/server/accounts/service.js";
import { createAccountRouter } from "./src/server/accounts/router.js";

// Load environment variables
dotenv.config();

const LOCAL_AUTH_BYPASS_REQUESTED = process.env.LOCAL_AUTH_BYPASS_ENABLED === "true";
if (process.env.NODE_ENV === "production" && LOCAL_AUTH_BYPASS_REQUESTED) {
  throw new Error("LOCAL_AUTH_BYPASS_ENABLED must never be enabled in production.");
}
if (LOCAL_AUTH_BYPASS_REQUESTED) {
  console.warn("[Local Test] Firebase authentication bypass is enabled for loopback requests only.");
}

const app = express();
app.disable("x-powered-by");
const PORT = Number(process.env.PORT) || 3000;
const TRUST_PROXY_HOPS = parseTrustedProxyHops(process.env.TRUST_PROXY_HOPS);
app.set("trust proxy", TRUST_PROXY_HOPS > 0 ? TRUST_PROXY_HOPS : false);
const AUDIO_DIR = resolvePersistentDirectory({
  env: process.env,
  variable: "TTS_AUDIO_DIR",
  localDirectory: "audio"
});
const AUDIO_PUBLIC_PREFIX = "/audio";
const LISTENING_MEDIA_PUBLIC_PREFIX = "/listening-media";
const LISTENING_MEDIA_DIR = resolvePersistentDirectory({
  env: process.env,
  variable: "LISTENING_MEDIA_DIR",
  localDirectory: "listening-media"
});
const VOCAB_IMAGE_PUBLIC_PREFIX = "/vocab-images";
const VOCAB_IMAGE_DIR = resolvePersistentDirectory({
  env: process.env,
  variable: "VOCAB_IMAGE_DIR",
  localDirectory: "vocab-images"
});
const vocabImageLibraryService = new VocabImageLibraryService({
  db: adminDb,
  imageDir: VOCAB_IMAGE_DIR,
  publicPrefix: VOCAB_IMAGE_PUBLIC_PREFIX,
  env: process.env,
});
const SLOW_API_LOG_MS = Math.max(0, Number(process.env.SLOW_API_LOG_MS || 500));
const LEARNING_HISTORY_REQUESTED = process.env.LEARNING_HISTORY_ENABLED === "true";
const LEARNING_HISTORY_ENABLED = LEARNING_HISTORY_REQUESTED && process.env.STORAGE_MODE === "sqlite";
const requestedAttemptDetailRetentionDays = Number(process.env.ATTEMPT_DETAIL_RETENTION_DAYS || 30);
const ATTEMPT_DETAIL_RETENTION_DAYS = Number.isFinite(requestedAttemptDetailRetentionDays)
  ? Math.max(1, Math.floor(requestedAttemptDetailRetentionDays))
  : 30;
const LEGACY_GUEST_SESSION_MAX_AGE_MS = parseLegacySessionMaxAgeMs(
  process.env.LEGACY_GUEST_SESSION_MAX_AGE_HOURS
);
const CONFIGURED_PUBLIC_IDENTITY_SECRET = process.env.GUEST_PUBLIC_ID_SECRET?.trim();
if (
  process.env.NODE_ENV === "production"
  && LEARNING_HISTORY_ENABLED
  && !CONFIGURED_PUBLIC_IDENTITY_SECRET
) {
  throw new Error(
    "GUEST_PUBLIC_ID_SECRET is required when Learning History is enabled in production."
  );
}
const PUBLIC_IDENTITY_SECRET = CONFIGURED_PUBLIC_IDENTITY_SECRET
  || process.env.DIAGNOSTIC_SECRET
  || `${process.env.FIREBASE_PROJECT_ID || "vhomework"}:public-identity-v1`;
const CONFIGURED_LISTENING_TICKET_SECRET = process.env.LISTENING_TICKET_SECRET?.trim()
  || CONFIGURED_PUBLIC_IDENTITY_SECRET
  || process.env.DIAGNOSTIC_SECRET?.trim();
if (process.env.NODE_ENV === "production" && !CONFIGURED_LISTENING_TICKET_SECRET) {
  throw new Error("LISTENING_TICKET_SECRET (or GUEST_PUBLIC_ID_SECRET) is required in production.");
}
const LISTENING_TICKET_SECRET = CONFIGURED_LISTENING_TICKET_SECRET
  || `${PUBLIC_IDENTITY_SECRET}:listening-ticket-v1`;

if (LEARNING_HISTORY_REQUESTED && !LEARNING_HISTORY_ENABLED) {
  console.warn("[History] LEARNING_HISTORY_ENABLED requires STORAGE_MODE=sqlite; history remains disabled.");
}

app.use(applySecurityHeaders(process.env.NODE_ENV === "production"));
// Keep Express' established 100 KB JSON boundary explicit. Binary media uses
// separate raw-body routes with their own MIME and size checks.
app.use(express.json({ limit: DEFAULT_JSON_BODY_LIMIT }));
app.use((req, _res, next) => {
  withStorageRequestMetrics(() => {
    (req as any).__requestStartedAt = performance.now();
    (req as any).__storageRequestMetrics = getStorageRequestMetrics();
    next();
  });
});
fs.mkdirSync(AUDIO_DIR, { recursive: true });
app.use(AUDIO_PUBLIC_PREFIX, express.static(AUDIO_DIR));
fs.mkdirSync(LISTENING_MEDIA_DIR, { recursive: true });
app.use(LISTENING_MEDIA_PUBLIC_PREFIX, express.static(LISTENING_MEDIA_DIR, {
  immutable: true,
  maxAge: "365d"
}));
fs.mkdirSync(VOCAB_IMAGE_DIR, { recursive: true });
app.use(VOCAB_IMAGE_PUBLIC_PREFIX, express.static(VOCAB_IMAGE_DIR, {
  immutable: true,
  maxAge: "365d"
}));

function sendApiError(res: express.Response, err: any) {
  const requestedStatus = isStorageUnavailableError(err) ? 503 : Number(err?.status || err?.statusCode || 500);
  const status = Number.isInteger(requestedStatus) && requestedStatus >= 400 && requestedStatus <= 599
    ? requestedStatus
    : 500;
  const serverFailure = status >= 500;
  if (serverFailure) {
    console.error("[API] Request failed:", {
      status,
      name: String(err?.name || "Error").slice(0, 80),
      message: String(err?.message || "Internal server error")
        .replace(/(?:sk-|AIza|eyJ)[A-Za-z0-9._-]{8,}/g, "[redacted]")
        .slice(0, 300)
    });
  }
  const exposeInternal = process.env.NODE_ENV !== "production";
  const message = !serverFailure || exposeInternal
    ? String(err?.message || "Request failed.").slice(0, 500)
    : status === 503
      ? "Service temporarily unavailable. Please try again."
      : "Internal server error.";
  res.set("Cache-Control", "no-store").status(status).json({
    error: message,
    ...(err?.code ? { code: String(err.code).slice(0, 120) } : {}),
    ...((!serverFailure || exposeInternal) && err?.details ? { details: err.details } : {})
  });
}

function createApiTiming(req: express.Request, label: string) {
  const requestStartedAt = Number((req as any).__requestStartedAt || performance.now());
  let checkpoint = performance.now();
  const entries: Array<{ name: string; durationMs: number }> = [];
  const authDurationMs = Math.max(0, checkpoint - requestStartedAt);
  if (authDurationMs > 0) entries.push({ name: "auth", durationMs: authDurationMs });
  let finished = false;

  return {
    mark(name: string) {
      const now = performance.now();
      entries.push({
        name: name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40) || "step",
        durationMs: Math.max(0, now - checkpoint)
      });
      checkpoint = now;
    },
    finish(res: express.Response) {
      if (finished) return;
      finished = true;
      const totalMs = Math.max(0, performance.now() - requestStartedAt);
      const storageMetrics = (req as any).__storageRequestMetrics || getStorageRequestMetrics();
      const timingEntries = [
        ...entries,
        ...(storageMetrics?.queryCount > 0
          ? [{ name: "sqlite_query", durationMs: Number(storageMetrics.queryDurationMs || 0) }]
          : []),
        ...(storageMetrics?.transactionCount > 0
          ? [{ name: "sqlite_tx", durationMs: Number(storageMetrics.transactionDurationMs || 0) }]
          : []),
        { name: "total", durationMs: totalMs }
      ];
      const serverTiming = timingEntries
        .map(entry => `${entry.name};dur=${entry.durationMs.toFixed(1)}`)
        .join(", ");
      if (!res.headersSent) res.setHeader("Server-Timing", serverTiming);
      if (totalMs >= SLOW_API_LOG_MS) {
        const detail = entries.map(entry => `${entry.name}=${entry.durationMs.toFixed(1)}ms`).join(" ");
        console.warn(
          `[PERF] ${label} total=${totalMs.toFixed(1)}ms sqliteQueries=${Number(storageMetrics?.queryCount || 0)} sqliteMs=${Number(storageMetrics?.queryDurationMs || 0).toFixed(1)} rowsRead=${Number(storageMetrics?.rowsRead || 0)} rowsWritten=${Number(storageMetrics?.rowsWritten || 0)} busyErrors=${Number(storageMetrics?.busyErrors || 0)} ${detail}`
        );
      }
    }
  };
}

// ============================================================================
// SYSTEM AUDIT LOGGING HELPER
// ============================================================================
async function logAuditAction(userId: string, userName: string, userEmail: string, action: string, details: string) {
  try {
    const logId = `log-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
    await adminDb.collection("audit_logs").doc(logId).set({
      id: logId,
      userId,
      userName,
      userEmail,
      action,
      details,
      timestamp: new Date().toISOString()
    });
    console.log(`[AUDIT LOG] ${userName} (${userEmail}) did action: ${action}. Details: ${details}`);
  } catch (err) {
    console.error("Error writing audit log:", err);
  }
}

// ============================================================================
// MIDDLEWARES FOR AUTH & ROLE VALIDATION
// ============================================================================

// Global Augment Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        name: string;
        email: string;
        phone?: string;
        phoneVerified?: boolean;
        role: 'super_admin' | 'teacher' | 'student';
        status: 'active' | 'pending' | 'blocked' | 'deleted';
        createdAt: string;
      };
    }
  }
}

type AppStatus = 'active' | 'pending' | 'blocked' | 'deleted';

const BOOTSTRAP_SUPER_ADMIN_EMAILS = parseBootstrapSuperAdminEmails(
  process.env.BOOTSTRAP_SUPER_ADMIN_EMAILS
);
const VALID_STATUSES = new Set<AppStatus>(["active", "pending", "blocked", "deleted"]);
if (process.env.NODE_ENV === "production" && BOOTSTRAP_SUPER_ADMIN_EMAILS.size === 0) {
  console.warn("[Auth] BOOTSTRAP_SUPER_ADMIN_EMAILS is empty. Existing backend roles/claims still work; new users default to student.");
}

function attachLocalTestUser(req: express.Request) {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : undefined;
  if (!isLocalServerAuthBypassAllowed({
    requested: LOCAL_AUTH_BYPASS_REQUESTED,
    nodeEnv: process.env.NODE_ENV,
    hostname: req.hostname,
    remoteAddress: req.socket.remoteAddress,
    bearerToken,
  })) return false;
  req.user = { ...LOCAL_AUTH_BYPASS_USER };
  return true;
}

function normalizeEmail(value: any) {
  return String(value || "").trim().toLowerCase();
}

function normalizePhoneE164(value: any) {
  const raw = String(value || "").trim();
  if (!raw) return "";

  let compact = raw.replace(/[^\d+]/g, "");
  if (compact.startsWith("00")) compact = `+${compact.slice(2)}`;

  if (compact.startsWith("+")) {
    const digits = compact.slice(1).replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 15) return "";
    return `+${digits}`;
  }

  const digits = compact.replace(/\D/g, "");
  if (!digits) return "";

  let normalized = digits;
  if (digits.startsWith("0")) {
    normalized = `84${digits.slice(1)}`;
  } else if (!digits.startsWith("84")) {
    normalized = `84${digits}`;
  }

  if (normalized.length < 10 || normalized.length > 15) return "";
  return `+${normalized}`;
}

function createHttpError(status: number, message: string, details?: any) {
  const err: any = new Error(message);
  err.status = status;
  if (details) err.details = details;
  return err;
}

function getDefaultRoleForEmail(email: string): AppRole {
  return getConfiguredDefaultRoleForEmail(email, BOOTSTRAP_SUPER_ADMIN_EMAILS);
}

function resolveTrustedRole(decodedToken: any, storedProfile: any = {}): AppRole {
  return resolveConfiguredTrustedRole(decodedToken, storedProfile, BOOTSTRAP_SUPER_ADMIN_EMAILS);
}

function resolveTrustedStatus(storedProfile: any = {}): AppStatus {
  const status = String(storedProfile.status || "active").trim() as AppStatus;
  return VALID_STATUSES.has(status) ? status : "active";
}

function buildUserProfileFromToken(decodedToken: any, storedProfile: any = {}) {
  const email = String(decodedToken.email || storedProfile.email || "");
  const tokenPhone = normalizePhoneE164(decodedToken.phone_number);
  const storedPhone = normalizePhoneE164(storedProfile.phone);
  const phone = tokenPhone || storedPhone;
  const phoneVerified = Boolean(tokenPhone) || Boolean(storedProfile.phoneVerified && storedPhone);
  return {
    id: decodedToken.uid,
    name: safeText(storedProfile.name || decodedToken.name || email.split("@")[0] || "Hoc sinh moi", 120),
    email,
    phone: phone || undefined,
    phoneVerified,
    role: resolveTrustedRole(decodedToken, storedProfile),
    status: resolveTrustedStatus(storedProfile),
    createdAt: storedProfile.createdAt || new Date().toISOString()
  };
}

function assertActiveUser(userProfile: any, res: express.Response) {
  if (userProfile.status !== "active") {
    res.status(403).json({ error: "Tai khoan cua ban chua duoc kich hoat hoac da bi khoa." });
    return false;
  }
  return true;
}

// Authenticates bearer token from firebase and attaches custom profile state
const authenticateUser = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (attachLocalTestUser(req)) return next();
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Không tìm thấy token xác thực. Vui lòng đăng nhập." });
  }

  const token = authHeader.split("Bearer ")[1];
  let decodedToken: any;
  try {
    decodedToken = await adminAuth.verifyIdToken(token);
  } catch (error: any) {
    console.error("Token verification failed:", {
      code: String(error?.code || "unknown"),
      name: String(error?.name || "Error"),
      message: String(error?.message || "Token verification failed")
    });
    return res.status(401).json({ error: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn." });
  }

  try {
    const uid = decodedToken.uid;
    const email = decodedToken.email || "";
    // Load or create profile in Firestore
    const userRef = adminDb.collection("users").doc(uid);
    const doc = await userRef.get();
    
    let userProfile: any;

    if (!doc.exists) {
      // Bootstrap privileges are configuration-driven; every other new account
      // starts as a student until a trusted backend role is assigned.
      const defaultRole = getDefaultRoleForEmail(email);

      userProfile = buildUserProfileFromToken(decodedToken, {
        role: defaultRole,
        status: "active"
      });

      await userRef.set(userProfile);
      invalidateCanonicalStudentNameCache();
      
      // Audit log registration
      await logAuditAction(
        userProfile.id,
        userProfile.name,
        userProfile.email,
        "REGISTER",
        `Created profile with default role: ${userProfile.role}`
      );
    } else {
      userProfile = buildUserProfileFromToken(decodedToken, doc.data());
    }

    // Check account status
    if (userProfile.status !== "active") {
      return res.status(403).json({ error: "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên." });
    }

    req.user = userProfile;
    next();
  } catch (error: any) {
    console.error("Authenticated profile resolution failed:", {
      name: String(error?.name || "Error"),
      message: String(error?.message || "Profile resolution failed")
    });
    if (isStorageUnavailableError(error)) {
      return sendApiError(res, error);
    }
    return res.status(500).json({ error: "Không thể xác minh hồ sơ người dùng. Vui lòng thử lại." });
  }
};

// Check role restrictions
const requireRole = (allowedRoles: ('super_admin' | 'teacher' | 'student')[]) => {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Vui lòng đăng nhập." });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "Bạn không có quyền thực hiện hành động này." });
    }

    next();
  };
};

const authenticateOptionalUser = async (req: express.Request, _res: express.Response, next: express.NextFunction) => {
  if (attachLocalTestUser(req)) return next();
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }

  const token = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;
    const email = decodedToken.email || "";
    const userRef = adminDb.collection("users").doc(uid);
    const doc = await userRef.get();
    let userProfile: any;

    if (!doc.exists) {
      const defaultRole = getDefaultRoleForEmail(email);
      userProfile = buildUserProfileFromToken(decodedToken, {
        role: defaultRole,
        status: "active"
      });
      await userRef.set(userProfile);
      invalidateCanonicalStudentNameCache();
    } else {
      userProfile = buildUserProfileFromToken(decodedToken, doc.data());
    }

    if (userProfile.status !== "active") {
      (req as any).authBlocked = true;
    } else {
      req.user = userProfile;
    }
  } catch (error: any) {
    // Public student flows may continue as a guest, but invalid optional bearer
    // tokens remain observable without logging the token itself.
    console.warn("[Auth] Optional bearer token was rejected; continuing as guest.", {
      code: String(error?.code || "unknown").slice(0, 80),
      name: String(error?.name || "Error").slice(0, 80)
    });
  }
  next();
};

const requestedRecentActivityDays = Number(process.env.RECENT_ACTIVITY_DAYS || 7);
const ACTIVITY_TTL_DAYS = Number.isFinite(requestedRecentActivityDays)
  ? Math.max(1, Math.floor(requestedRecentActivityDays))
  : 7;
const ACTIVITY_TTL_MS = ACTIVITY_TTL_DAYS * 24 * 60 * 60 * 1000;
const LEADERBOARD_RETENTION_DAYS = 62;
const LEADERBOARD_RETENTION_MS = LEADERBOARD_RETENTION_DAYS * 24 * 60 * 60 * 1000;
const LEADERBOARD_READ_MODEL_SETTING_ID = "leaderboard-read-model-v1";
const PUBLIC_LEADERBOARD_SUMMARY_CACHE_MS = 30_000;
const PUBLIC_LEADERBOARD_SUMMARY_CACHE_MAX_ENTRIES = 100;
const publicLeaderboardSummaryCache = new Map<string, { expiresAt: number; value: any }>();

function cachePublicLeaderboardSummary(key: string, value: any) {
  const now = Date.now();
  for (const [cachedKey, cached] of publicLeaderboardSummaryCache) {
    if (cached.expiresAt <= now) publicLeaderboardSummaryCache.delete(cachedKey);
  }
  while (publicLeaderboardSummaryCache.size >= PUBLIC_LEADERBOARD_SUMMARY_CACHE_MAX_ENTRIES) {
    const oldestKey = publicLeaderboardSummaryCache.keys().next().value;
    if (!oldestKey) break;
    publicLeaderboardSummaryCache.delete(oldestKey);
  }
  publicLeaderboardSummaryCache.set(key, {
    expiresAt: now + PUBLIC_LEADERBOARD_SUMMARY_CACHE_MS,
    value
  });
}

function addDaysIso(baseIso: string, days: number) {
  return new Date(new Date(baseIso).getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

function getActivityTime(data: any) {
  return data.completedAt || data.endedAt || data.createdAt || data.startedAt || "";
}

const MAX_ACTIVITY_RESULT_LIMIT = 500;

function parseActivityResultLimit(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(1, Math.min(MAX_ACTIVITY_RESULT_LIMIT, Math.floor(parsed)));
}

function toActivitySummary(activity: any, sourceType?: string, sourceId?: string) {
  const {
    answerDetails: _answerDetails,
    privateSnapshot: _privateSnapshot,
    sessionToken: _sessionToken,
    sessionTokenHash: _sessionTokenHash,
    runSecretHash: _runSecretHash,
    ...summary
  } = activity || {};
  const resolvedSourceType = safeText(sourceType || summary.sourceType || "vocabulary", 80);
  return {
    ...summary,
    sourceType: resolvedSourceType,
    sourceId: safeText(sourceId || summary.sourceId || summary.id || "", 180)
  };
}

function sanitizeActivityDetail(activity: any) {
  const {
    privateSnapshot: _privateSnapshot,
    sessionToken: _sessionToken,
    sessionTokenHash: _sessionTokenHash,
    runSecretHash: _runSecretHash,
    ...safe
  } = activity || {};
  return safe;
}

function isExpiredActivity(data: any, nowMs = Date.now()) {
  if (data.expiresAt && new Date(data.expiresAt).getTime() < nowMs) return true;
  const createdOrCompleted = data.createdAt || data.completedAt || data.endedAt;
  return Boolean(createdOrCompleted && nowMs - new Date(createdOrCompleted).getTime() > ACTIVITY_TTL_MS);
}

function createSessionToken() {
  return crypto.randomBytes(32).toString("hex");
}

function hashSessionToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function sanitizePublicStudentRecord(data: any) {
  return sanitizePublicStudentRecordWithSecret(data || {}, PUBLIC_IDENTITY_SECRET);
}

function omitGuestCapabilitySecrets(profile: any) {
  if (!profile || typeof profile !== "object") return profile;
  const {
    accessTokenHash: _accessTokenHash,
    access_token_hash: _accessTokenHashSnake,
    guestAccessToken: _guestAccessToken,
    ...safe
  } = profile;
  return safe;
}

function appendLearningHistoryProjection(batch: any, projection: LearningAttemptProjection) {
  if (!LEARNING_HISTORY_ENABLED) return;
  batch.set(
    adminDb.collection("learning_attempts").doc(projection.attempt.attemptId),
    projection.attempt
  );
  if (projection.detail) {
    batch.set(
      adminDb.collection("attempt_details").doc(projection.detail.attemptId),
      projection.detail
    );
  }
}

function getRequestSessionToken(req: express.Request) {
  return safeText(req.body?.sessionToken || req.body?.runSecret || req.headers["x-session-token"], 200);
}

function omitSensitiveSessionFields(session: any) {
  const { sessionTokenHash, privateSnapshot, ...safeSession } = session;
  return safeSession;
}

const SESSION_V2_GAME_IDS = new Set([
  "flashcard-en-vi", "flashcard-vi-en", "flashcard-sound",
  "quiz-en-vi", "quiz-vi-en", "quiz-sound",
  "fill-meaning", "fill-missing", "matching-word-meaning",
  "memory-match", "millionaire-vocab", "speaking-ai"
]);
const GAME_ACTION_BATCH_MAX_ITEMS = Math.max(
  1,
  Math.min(200, Number(process.env.GAME_ACTION_BATCH_MAX_ITEMS || 50))
);
const LAZY_SESSION_V3_ENABLED = process.env.LAZY_SESSION_V3_ENABLED !== "false";

function getClientRunCredentials(payload: any) {
  const clientRunId = safeText(payload?.clientRunId, 160);
  const runSecret = safeText(payload?.runSecret || payload?.sessionToken, 200);
  if (!/^[A-Za-z0-9._:-]{8,160}$/.test(clientRunId)) {
    throw createHttpError(400, "clientRunId khong hop le.");
  }
  if (runSecret.length < 24) {
    throw createHttpError(400, "runSecret khong hop le.");
  }
  return { clientRunId, runSecret };
}

function normalizeGameAnswer(value: any) {
  return String(value || "").normalize("NFKC").trim().toLowerCase()
    .replace(/[‘’‚‛`´]/g, "'").replace(/\s+/g, " ");
}

function buildGameSessionSnapshot(vocabSet: any, gameId: string, requestedOrder: any[] = []) {
  const quizContract = getCurrentQuizContract(gameId);
  const canonicalItems = (Array.isArray(vocabSet.items) ? vocabSet.items : []).slice(0, 200).map((item: any, index: number) => ({
    id: safeText(item.id || `item-${index + 1}`, 160),
    term: safeText(item.term, 500),
    meaning: safeText(item.meaning, 1000),
    example: safeText(item.example, 1500),
    ipa: safeText(item.ipa, 160),
    audioUrl: normalizeAudioUrlForClient(item.audioUrl),
    displayOrder: Number(item.displayOrder || index + 1)
  })).filter((item: any) => item.id && item.term)
    .filter((item: any) => !quizContract || isQuizItemEligible(item, quizContract));
  const byId = new Map<string, any>(canonicalItems.map((item: any) => [item.id, item]));
  const orderedIds = Array.isArray(requestedOrder) ? requestedOrder.map(id => safeText(id, 160)).filter((id, index, list) => id && byId.has(id) && list.indexOf(id) === index) : [];
  const items = orderedIds.length ? orderedIds.map(id => byId.get(id)) : canonicalItems;
  const config = quizContract
    ? quizContract
    : gameId.startsWith("flashcard-") ? { front: gameId === "flashcard-vi-en" ? "meaning" : gameId === "flashcard-sound" ? "sound_only" : "term" }
    : gameId.startsWith("fill-") ? { mode: gameId === "fill-missing" ? "missing_letters" : "complete" }
    : gameId === "millionaire-vocab" ? { maxQuestions: 15 }
    : gameId === "speaking-ai" ? { targetMode: "example_or_term" }
    : {};
  return { itemOrder: items.map((item: any) => item.id), items, config };
}

function sanitizeGameAction(input: any) {
  const type = safeText(input?.type, 60);
  const allowed = new Set(["flashcard.rate", "quiz.answer", "fill.answer", "matching.attempt", "memory.move", "millionaire.answer", "speaking.attempt"]);
  if (!allowed.has(type)) throw createHttpError(400, "Game action type is not supported.");
  const sequence = Number(input?.sequence);
  if (!Number.isInteger(sequence) || sequence < 0 || sequence > 1000) throw createHttpError(400, "Invalid game action sequence.");
  return {
    actionId: safeText(input?.actionId, 120), type, sequence,
    wordId: safeText(input?.wordId, 160),
    userAnswer: safeText(input?.userAnswer, 1000),
    firstItemId: safeText(input?.firstItemId, 160), firstSide: input?.firstSide === "meaning" ? "meaning" : "term",
    secondItemId: safeText(input?.secondItemId, 160), secondSide: input?.secondSide === "meaning" ? "meaning" : "term",
    recognizedText: safeText(input?.recognizedText, 1000),
    responseMs: Math.max(0, Math.min(120000, Number(input?.responseMs || 0))),
    attemptNumber: Math.max(1, Math.min(20, Number(input?.attemptNumber || 1)))
  };
}

function sanitizeSubmittedGameActions(input: any) {
  if (!Array.isArray(input)) return [];
  if (input.length > 1000) throw createHttpError(400, "Có quá nhiều thao tác trong một lượt chơi.");
  const actions = input.map(sanitizeGameAction);
  const sequenceSet = new Set<number>();
  for (const action of actions) {
    if (sequenceSet.has(action.sequence)) {
      throw createHttpError(400, "Game action sequence bị trùng.");
    }
    sequenceSet.add(action.sequence);
  }
  return actions.sort((a, b) => a.sequence - b.sequence);
}

function dedupeStoredGameActions(actions: any[]) {
  const bySequence = new Map<number, any>();
  for (const action of actions) {
    const sequence = Number(action?.sequence);
    if (!Number.isInteger(sequence) || sequence < 0 || bySequence.has(sequence)) continue;
    bySequence.set(sequence, action);
  }
  return [...bySequence.values()].sort((a, b) => Number(a.sequence) - Number(b.sequence));
}

function getGameActionPersistence(gameId: string, snapshot: any) {
  const itemCount = Array.isArray(snapshot?.items) ? snapshot.items.length : 0;
  const effectiveItemCount = gameId === "millionaire-vocab" ? Math.min(itemCount, 15) : itemCount;
  if (gameId === "speaking-ai" || effectiveItemCount > GAME_ACTION_BATCH_MAX_ITEMS) return "incremental";
  return "submit_batch";
}

function speakingScore(target: string, recognized: string, responseMs: number) {
  const words = (value: string) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9'\s]/g, " ").split(/\s+/).filter(Boolean);
  const targetWords = words(target); const recognizedWords = words(recognized);
  if (!recognizedWords.length) return { score: 0, correctWords: 0, totalWords: Math.max(1, targetWords.length) };
  const totalWords = Math.max(1, targetWords.length);
  const correctWords = targetWords.filter((word, index) => word === recognizedWords[index]).length;
  const score = Math.min(100, Math.round(correctWords / totalWords * 60) + Math.round(Math.min(recognizedWords.length / totalWords, 1) * 20) + (responseMs <= 8000 ? 10 : responseMs <= 15000 ? 6 : 3) + 10);
  return { score, correctWords, totalWords };
}

function gradeGameSessionV2(session: any, actions: any[]) {
  const items = session.privateSnapshot?.items || [];
  const byId = new Map<string, any>(items.map((item: any) => [item.id, item]));
  const ordered = [...actions].sort((a, b) => a.sequence - b.sequence);
  const details: any[] = [];
  let correct = 0; let incorrect = 0; let gameScore: number | undefined;

  if (session.gameId.startsWith("flashcard-")) {
    const latest = new Map<string, any>(); ordered.filter(a => a.type === "flashcard.rate" && byId.has(a.wordId)).forEach(a => latest.set(a.wordId, a));
    items.forEach((item: any, index: number) => { const known = latest.get(item.id)?.userAnswer === "known"; if (known) correct++; else incorrect++; details.push({ questionIndex: index, wordId: item.id, word: item.term, questionText: item.term, correctAnswer: item.meaning, userAnswer: known ? "Đã thuộc" : "Chưa thuộc", isCorrect: known }); });
  } else if (session.gameId.startsWith("quiz-")) {
    const contract = resolveStoredQuizContract(session.gameId, session.privateSnapshot?.config);
    if (!contract) throw createHttpError(400, "Quiz contract is not supported.");
    const latest = new Map<string, any>(); ordered.filter(a => a.type === "quiz.answer" && byId.has(a.wordId)).forEach(a => latest.set(a.wordId, a));
    items.forEach((item: any, index: number) => { const answer = latest.get(item.id)?.userAnswer || ""; const expected = getQuizAnswerValue(item, contract.answerType); const ok = answer === expected; ok ? correct++ : incorrect++; details.push({ questionIndex: index, wordId: item.id, word: item.term, questionText: getQuizQuestionText(item, contract.questionType), correctAnswer: expected, userAnswer: answer, selectedAnswer: answer, isCorrect: ok }); });
  } else if (session.gameId.startsWith("fill-")) {
    const latest = new Map<string, any>(); ordered.filter(a => a.type === "fill.answer" && byId.has(a.wordId)).forEach(a => latest.set(a.wordId, a));
    items.forEach((item: any, index: number) => { const answer = latest.get(item.id)?.userAnswer || ""; const ok = normalizeGameAnswer(answer) === normalizeGameAnswer(item.term); ok ? correct++ : incorrect++; details.push({ questionIndex: index, wordId: item.id, word: item.term, questionText: item.meaning, correctAnswer: item.term, userAnswer: answer, isCorrect: ok }); });
  } else if (session.gameId === "matching-word-meaning" || session.gameId === "memory-match") {
    const limit = session.gameId === "matching-word-meaning" ? 8 : 6; const active = items.slice(0, limit); const validIds = new Set(active.map((item: any) => item.id));
    const matched = new Set<string>();
    ordered.filter(a => (a.type === "matching.attempt" || a.type === "memory.move") && validIds.has(a.firstItemId) && validIds.has(a.secondItemId)).forEach((a, index) => { const ok = a.firstItemId === a.secondItemId && a.firstSide !== a.secondSide && !matched.has(a.firstItemId); if (ok) matched.add(a.firstItemId); else incorrect++; details.push({ questionIndex: index, wordId: a.firstItemId, questionText: a.firstSide === "term" ? byId.get(a.firstItemId)?.term : byId.get(a.firstItemId)?.meaning, selectedAnswer: a.secondSide === "term" ? byId.get(a.secondItemId)?.term : byId.get(a.secondItemId)?.meaning, isCorrect: ok }); });
    const mistakes = incorrect; correct = matched.size; incorrect += Math.max(0, active.length - matched.size); gameScore = matched.size === active.length ? Math.max(50, 100 - mistakes * (session.gameId === "matching-word-meaning" ? 5 : 4)) : Math.round(correct / Math.max(1, active.length) * 100);
  } else if (session.gameId === "millionaire-vocab") {
    const active = items.filter((item: any) => item.meaning).slice(0, 15); const latest = new Map<string, any>(); ordered.filter(a => a.type === "millionaire.answer" && byId.has(a.wordId)).forEach(a => { if (!latest.has(a.wordId)) latest.set(a.wordId, a); });
    for (let index = 0; index < active.length; index++) { const item: any = active[index]; const answer = latest.get(item.id)?.userAnswer || ""; const ok = answer === item.meaning; if (ok) correct++; else incorrect++; if (answer) details.push({ questionIndex: index, wordId: item.id, word: item.term, questionText: item.term, correctAnswer: item.meaning, userAnswer: answer, selectedAnswer: answer, isCorrect: ok }); if (answer && !ok) break; }
    incorrect = active.length - correct; const ladder = [100,200,300,500,1000,2000,4000,8000,16000,32000,64000,125000,250000,500000,1000000]; gameScore = correct ? ladder[Math.min(correct, ladder.length) - 1] : 0;
  } else if (session.gameId === "speaking-ai") {
    const latest = new Map<string, any>(); ordered.filter(a => a.type === "speaking.attempt" && byId.has(a.wordId)).forEach(a => latest.set(a.wordId, a)); let totalScore = 0;
    items.forEach((item: any, index: number) => { const action = latest.get(item.id); const target = item.example || item.term; const result = speakingScore(target, action?.recognizedText || "", action?.responseMs || 0); totalScore += result.score; result.score >= 70 ? correct++ : incorrect++; details.push({ questionIndex: index, wordId: item.id, questionText: target, correctAnswer: target, userAnswer: action?.recognizedText || "", recognizedText: action?.recognizedText || "", pronunciationScore: result.score, correctWords: result.correctWords, totalWords: result.totalWords, responseMs: Math.max(0, Number(action?.responseMs || 0)), isCorrect: result.score >= 70 }); }); gameScore = items.length ? Math.round(totalScore / items.length) : 0;
  }
  const total = correct + incorrect; const score = gameScore !== undefined && session.gameId !== "millionaire-vocab" ? gameScore : total ? Math.round(correct / total * 100) : 0;
  return { score, gameScore: session.gameId === "millionaire-vocab" ? gameScore : undefined, rawScore: session.gameId === "millionaire-vocab" ? gameScore : undefined, maxScore: session.gameId === "millionaire-vocab" ? 1000000 : 100, totalQuestions: total, correctAnswers: correct, incorrectAnswers: incorrect, accuracy: total ? Math.round(correct / total * 100) : 0, answerDetails: details.slice(0, 500) };
}

const CANONICAL_STUDENT_NAME_CACHE_TTL_MS = 60_000;
type CanonicalStudentNameMaps = { users: Map<string, string>; guests: Map<string, string> };
type CanonicalStudentNameCacheEntry = { expiresAt: number; name: string };
const canonicalStudentNameCache = new Map<string, CanonicalStudentNameCacheEntry>();
const canonicalStudentNameLoadPromises = new Map<string, Promise<string>>();

function invalidateCanonicalStudentNameCache() {
  canonicalStudentNameCache.clear();
}

async function getCanonicalStudentName(kind: "user" | "guest", id: string) {
  if (!id) return "";
  const key = `${kind}:${id}`;
  const cached = canonicalStudentNameCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.name;
  if (cached) canonicalStudentNameCache.delete(key);

  let pending = canonicalStudentNameLoadPromises.get(key);
  if (!pending) {
    const collectionName = kind === "user" ? "users" : "guest_profiles";
    pending = adminDb.collection(collectionName).doc(id).get()
      .then((document: any) => {
        const data = document.exists ? document.data() : {};
        const name = safeText(kind === "user"
          ? data.name || data.displayName
          : data.displayName || data.name, 120);
        canonicalStudentNameCache.set(key, {
          expiresAt: Date.now() + CANONICAL_STUDENT_NAME_CACHE_TTL_MS,
          name
        });
        return name;
      })
      .finally(() => canonicalStudentNameLoadPromises.delete(key));
    canonicalStudentNameLoadPromises.set(key, pending);
  }
  return pending;
}

async function getCanonicalStudentNameMaps(items: any[]) {
  const userIds = new Set<string>();
  const guestIds = new Set<string>();
  items.forEach(item => {
    if (isGuestOwnedRecord(item)) {
      const guestId = getGuestProfileId(item?.guestId);
      if (guestId) guestIds.add(guestId);
    } else {
      const userId = safeText(item?.userId || item?.studentId, 120);
      if (userId) userIds.add(userId);
    }
  });

  const lookups = [
    ...[...userIds].map(id => ({ kind: "user" as const, id })),
    ...[...guestIds].map(id => ({ kind: "guest" as const, id }))
  ];
  const resolved = await runWithConcurrency(lookups, 20, async lookup => ({
    ...lookup,
    name: await getCanonicalStudentName(lookup.kind, lookup.id)
  }));
  const maps: CanonicalStudentNameMaps = { users: new Map(), guests: new Map() };
  resolved.forEach(item => {
    if (!item.name) return;
    (item.kind === "user" ? maps.users : maps.guests).set(item.id, item.name);
  });
  return maps;
}

function enrichStudentName(data: any, maps: Awaited<ReturnType<typeof getCanonicalStudentNameMaps>>) {
  if (!data) return data;
  const guestId = getGuestProfileId(data.guestId);
  const userId = safeText(data.userId || data.studentId, 120);
  const canonicalName = isGuestOwnedRecord(data)
    ? maps.guests.get(guestId)
    : maps.users.get(userId);
  if (canonicalName) return { ...data, studentName: canonicalName };
  return guestId || userId ? data : { ...data, legacyUnlinked: true };
}

async function enrichStudentNames<T extends any>(items: T[]) {
  if (items.length === 0) return items;
  const maps = await getCanonicalStudentNameMaps(items);
  return items.map(item => enrichStudentName(item, maps));
}

function getGameSessionActor(req: express.Request, payload: any = {}) {
  if ((req as any).authBlocked) return null;
  if (req.user) {
    return {
      ownerType: "user",
      ownerKey: `user:${req.user.id}`,
      userId: req.user.id,
      studentId: req.user.id,
      guestId: safeText(payload.guestId || "", 120),
      studentName: req.user.name || safeText(payload.studentName || "Hoc sinh", 120)
    };
  }

  const guestId = safeText(payload.guestId, 120);
  const studentName = safeText(payload.studentName, 120);
  if (!guestId || !studentName) return null;
  return {
    ownerType: "guest",
    ownerKey: `guest:${guestId}`,
    userId: "",
    studentId: guestId,
    guestId,
    studentName
  };
}

function canUpdateGameSession(req: express.Request, existing: any, payload: any) {
  if ((req as any).authBlocked) return false;
  if (req.user && (existing.ownerKey === `user:${req.user.id}` || existing.userId === req.user.id)) {
    return true;
  }

  const sessionToken = getRequestSessionToken(req);
  if (sessionToken && existing.sessionTokenHash && hashSessionToken(sessionToken) === existing.sessionTokenHash) {
    return true;
  }

  // Tokenless compatibility is deliberately short-lived. It supports an old
  // in-progress tab after rollout without leaving historical sessions writable
  // forever by guestId alone.
  if (canUseLegacyGuestSessionUpdate({
    session: existing,
    suppliedGuestId: safeText(payload.guestId, 120),
    maxAgeMs: LEGACY_GUEST_SESSION_MAX_AGE_MS
  })) return true;

  return false;
}

function isSuperAdmin(user: any) {
  return user?.role === "super_admin";
}

function isTeacher(user: any) {
  return user?.role === "teacher";
}

function canManageVocabSet(user: any, set: any) {
  if (isSuperAdmin(user)) return true;
  return isTeacher(user) && Boolean(set?.createdBy) && set.createdBy === user.id;
}

function canViewVocabSet(user: any, set: any) {
  if (isArchivedRecord(set)) return false;
  if (!user) return getVocabVisibility(set) === "public";
  if (isSuperAdmin(user)) return true;
  if (isTeacher(user)) return canManageVocabSet(user, set) || getVocabVisibility(set) === "public";
  return getVocabVisibility(set) === "public";
}

function canManageClass(user: any, classData: any) {
  if (isSuperAdmin(user)) return true;
  return isTeacher(user) && Boolean(classData?.teacherId) && classData.teacherId === user.id;
}

function canViewClass(user: any, classData: any) {
  if (isArchivedRecord(classData)) return false;
  if (isSuperAdmin(user)) return true;
  return canManageClass(user, classData);
}

function canManageAssignment(user: any, assignment: any, classData?: any) {
  if (isSuperAdmin(user)) return true;
  if (!isTeacher(user)) return false;
  if (assignment?.createdBy === user.id) return true;
  return Boolean(classData) && canManageClass(user, classData);
}

async function canManageGuestProfile(user: any, profile: any) {
  if (isSuperAdmin(user)) return true;
  if (!isTeacher(user)) return false;

  const guestId = getGuestProfileId(profile?.guestId || profile?.id);
  if (!guestId) return false;

  const [sessionsSnapshot, attemptsSnapshot] = await Promise.all([
    adminDb.collection("game_sessions").where("guestId", "==", guestId).get(),
    adminDb.collection("grammar_attempts").where("guestId", "==", guestId).get()
  ]);

  for (const doc of sessionsSnapshot.docs || []) {
    const session = doc.data();
    const assignmentId = safeText(session?.assignmentId, 160);
    if (assignmentId) {
      const assignmentDoc = await adminDb.collection("assignments").doc(assignmentId).get();
      if (assignmentDoc.exists) {
        const assignment = { id: assignmentDoc.id, ...assignmentDoc.data() };
        const classDoc = assignment.classId
          ? await adminDb.collection("classes").doc(assignment.classId).get()
          : null;
        const classData = classDoc?.exists ? { id: classDoc.id, ...classDoc.data() } : undefined;
        if (canManageAssignment(user, assignment, classData)) return true;
      }
    }
    const vocabSetId = safeText(session?.vocabSetId, 160);
    if (vocabSetId) {
      const setDoc = await adminDb.collection("vocab_sets").doc(vocabSetId).get();
      if (setDoc.exists && canManageVocabSet(user, { id: setDoc.id, ...setDoc.data() })) {
        return true;
      }
    }
  }

  for (const doc of attemptsSnapshot.docs || []) {
    const attempt = doc.data();
    const grammarSetId = safeText(attempt?.grammarSetId, 160);
    if (!grammarSetId) continue;
    const setDoc = await adminDb.collection("grammar_sets").doc(grammarSetId).get();
    if (setDoc.exists && canManageGrammarSet(user, { id: setDoc.id, ...setDoc.data() })) {
      return true;
    }
  }
  return false;
}

async function getManageableGuestProfileIdsForTeacher(user: any) {
  const manageable = new Set<string>();
  if (!isTeacher(user)) return manageable;

  const [sessions, grammarAttempts, assignments, classes, vocabSets, grammarSets] = await Promise.all([
    adminDb.collection("game_sessions").get(),
    adminDb.collection("grammar_attempts").get(),
    adminDb.collection("assignments").get(),
    adminDb.collection("classes").get(),
    adminDb.collection("vocab_sets").get(),
    adminDb.collection("grammar_sets").get()
  ]);
  const managedClassIds = new Set<string>();
  classes.forEach(doc => {
    const classData = { id: doc.id, ...doc.data() };
    if (canManageClass(user, classData)) managedClassIds.add(doc.id);
  });
  const managedAssignmentIds = new Set<string>();
  assignments.forEach(doc => {
    const assignment = { id: doc.id, ...doc.data() };
    if (assignment.createdBy === user.id || managedClassIds.has(assignment.classId)) {
      managedAssignmentIds.add(doc.id);
      if (assignment.id) managedAssignmentIds.add(assignment.id);
    }
  });
  const managedVocabSetIds = new Set<string>();
  vocabSets.forEach(doc => {
    if (canManageVocabSet(user, { id: doc.id, ...doc.data() })) managedVocabSetIds.add(doc.id);
  });
  const managedGrammarSetIds = new Set<string>();
  grammarSets.forEach(doc => {
    if (canManageGrammarSet(user, { id: doc.id, ...doc.data() })) managedGrammarSetIds.add(doc.id);
  });

  sessions.forEach(doc => {
    const session = doc.data();
    if (!managedAssignmentIds.has(safeText(session.assignmentId, 160))
      && !managedVocabSetIds.has(safeText(session.vocabSetId, 160))) return;
    const guestId = getGuestProfileId(session.guestId);
    if (guestId) manageable.add(guestId);
  });
  grammarAttempts.forEach(doc => {
    const attempt = doc.data();
    if (!managedGrammarSetIds.has(safeText(attempt.grammarSetId, 160))) return;
    const guestId = getGuestProfileId(attempt.guestId);
    if (guestId) manageable.add(guestId);
  });
  return manageable;
}

async function canStaffViewLearningAttempt(
  actor: LearningHistoryActor,
  attempt: LearningHistoryItem
) {
  const user = actor.userProfile || {
    id: actor.id,
    role: actor.role
  };
  if (isSuperAdmin(user)) return true;
  if (!isTeacher(user)) return false;

  if (attempt.assignmentId) {
    const assignmentDoc = await adminDb.collection("assignments").doc(attempt.assignmentId).get();
    if (assignmentDoc.exists) {
      const assignment = { id: assignmentDoc.id, ...assignmentDoc.data() };
      const classDoc = assignment.classId
        ? await adminDb.collection("classes").doc(assignment.classId).get()
        : null;
      const classData = classDoc?.exists ? { id: classDoc.id, ...classDoc.data() } : undefined;
      if (canManageAssignment(user, assignment, classData)) return true;
    }
  }

  if (attempt.sourceType === "grammar") {
    const setDoc = await adminDb.collection("grammar_sets").doc(attempt.lessonId).get();
    return Boolean(setDoc.exists && canManageGrammarSet(user, { id: setDoc.id, ...setDoc.data() }));
  }
  const examCollection = attempt.sourceType === "listening"
    ? "listening_sets"
    : attempt.sourceType === "reading_writing"
      ? "mover_reading_sets"
      : attempt.sourceType === "exam"
        ? "exam_sets"
        : "";
  if (examCollection) {
    const setDoc = await adminDb.collection(examCollection).doc(attempt.lessonId).get();
    if (!setDoc.exists) return false;
    const set = { id: setDoc.id, ...setDoc.data() };
    return set.ownerId === user.id;
  }
  const setDoc = await adminDb.collection("vocab_sets").doc(attempt.lessonId).get();
  return Boolean(setDoc.exists && canManageVocabSet(user, { id: setDoc.id, ...setDoc.data() }));
}

function getAssignmentShareToken(assignment: any) {
  return String(assignment?.shareToken || assignment?.assignmentSlug || "").trim();
}

async function ensureAssignmentShareToken(assignment: any, docRef?: any) {
  if (isArchivedRecord(assignment)) return assignment;
  const existingToken = getAssignmentShareToken(assignment);
  if (existingToken) {
    return {
      ...assignment,
      shareToken: existingToken,
      assignmentSlug: existingToken
    };
  }

  const shareToken = createShareToken();
  const updatedAssignment = {
    ...assignment,
    shareToken,
    assignmentSlug: shareToken
  };

  if (docRef) {
    await docRef.set(updatedAssignment);
  }

  return updatedAssignment;
}

function isAssignmentOpenForLearning(assignment: any, set: any) {
  if (!assignment || !set) return false;
  if (isArchivedRecord(assignment) || isArchivedRecord(set)) return false;
  const assignmentStatus = String(assignment.status || "active").toLowerCase();
  if (["draft", "deleted", "inactive", "archived"].includes(assignmentStatus)) return false;
  const visibility = getVocabVisibility(set);
  return visibility === "public" || visibility === "assignment";
}

function getRequestVocabShareToken(req: express.Request) {
  return safeText(req.body?.accessToken || req.headers["x-vocab-share-token"], 200);
}

async function findDocumentByShareToken(collectionName: "assignments" | "vocab_sets", token: string) {
  let snapshot = await adminDb.collection(collectionName)
    .where("shareToken", "==", token)
    .limit(2)
    .get();
  let docs = snapshot.docs || [];

  // Firestore installations may still carry the historical assignmentSlug
  // field. SQLite maps both field names to the same indexed physical column.
  if (docs.length === 0) {
    snapshot = await adminDb.collection(collectionName)
      .where("assignmentSlug", "==", token)
      .limit(2)
      .get();
    docs = snapshot.docs || [];
  }

  // Never choose an arbitrary resource if legacy data contains a collision.
  return docs.length === 1 ? docs[0] : null;
}

async function resolveVocabLearningAccess(
  tokenValue: any,
  expectedVocabSetId = "",
  expectedAssignmentId = "",
  timing?: { mark(name: string): void }
) {
  const token = safeText(tokenValue, 200);
  if (!token) return null;

  if (expectedAssignmentId) {
    const assignmentDoc = await adminDb.collection("assignments").doc(expectedAssignmentId).get();
    timing?.mark("assignment_point_read");
    if (!assignmentDoc.exists) return null;
    const assignment = { id: assignmentDoc.id, ...assignmentDoc.data() };
    if (getAssignmentShareToken(assignment) !== token) return null;
    if (expectedVocabSetId && assignment.vocabSetId !== expectedVocabSetId) return null;
    const setDoc = await adminDb.collection("vocab_sets").doc(assignment.vocabSetId).get();
    timing?.mark("vocab_point_read");
    if (!setDoc.exists) return null;
    const set = { id: setDoc.id, ...setDoc.data() };
    if (!isAssignmentOpenForLearning(assignment, set)) return null;
    return { accessType: "assignment" as const, set, assignment };
  }

  if (expectedVocabSetId) {
    const setDoc = await adminDb.collection("vocab_sets").doc(expectedVocabSetId).get();
    timing?.mark("vocab_point_read");
    if (!setDoc.exists) return null;
    const set = { id: setDoc.id, ...setDoc.data() };
    if (isArchivedRecord(set)) return null;
    const setToken = String(set.shareToken || set.assignmentSlug || "").trim();
    if (setToken === token && getVocabVisibility(set) === "assignment") {
      return { accessType: "vocab_set" as const, set, assignment: null };
    }
  }

  const assignmentDoc = await findDocumentByShareToken("assignments", token);
  timing?.mark("assignment_token_lookup");
  if (assignmentDoc) {
    const assignment = { id: assignmentDoc.id, ...assignmentDoc.data() };
    const setDoc = await adminDb.collection("vocab_sets").doc(assignment.vocabSetId).get();
    timing?.mark("vocab_point_read");
    if (!setDoc.exists) return null;
    const set = { id: setDoc.id, ...setDoc.data() };
    if (!isAssignmentOpenForLearning(assignment, set)) return null;
    return { accessType: "assignment" as const, set, assignment };
  }

  const setDoc = await findDocumentByShareToken("vocab_sets", token);
  timing?.mark("vocab_token_lookup");
  if (setDoc) {
    const set = { id: setDoc.id, ...setDoc.data() };
    if (isArchivedRecord(set) || getVocabVisibility(set) !== "assignment") return null;
    return { accessType: "vocab_set" as const, set, assignment: null };
  }

  return null;
}

function canViewResultSession(
  user: any,
  session: any,
  vocabSetsById: Map<string, any>,
  assignmentsById: Map<string, any>,
  classesById: Map<string, any>
) {
  if (isSuperAdmin(user)) return true;
  if (!user) return false;

  if (user.role === "student") {
    return session.userId === user.id || session.studentId === user.id || session.ownerKey === `user:${user.id}`;
  }

  if (!isTeacher(user)) return false;
  const vocabSet = vocabSetsById.get(session.vocabSetId);
  if (vocabSet && canManageVocabSet(user, vocabSet)) return true;

  const assignment = session.assignmentId ? assignmentsById.get(session.assignmentId) : null;
  if (assignment) {
    const classData = assignment.classId ? classesById.get(assignment.classId) : null;
    if (canManageAssignment(user, assignment, classData)) return true;
  }

  const classData = session.classId ? classesById.get(session.classId) : null;
  return Boolean(classData && canManageClass(user, classData));
}

function canViewGrammarActivity(user: any, attempt: any, set: any) {
  if (isSuperAdmin(user)) return true;
  if (!user) return false;
  if (user.role === "student") return attempt.userId === user.id || attempt.studentId === user.id;
  return isTeacher(user) && canManageGrammarSet(user, set);
}

function getRequestGrammarAttemptToken(req: express.Request) {
  return safeText(req.body?.attemptToken || req.query?.attemptToken || req.headers["x-grammar-attempt-token"], 160);
}

function sanitizeGrammarAnswerForStudent(answer: any, includeReview = false) {
  const safeAnswer: any = {
    id: answer.id,
    attemptQuestionId: answer.attemptQuestionId,
    questionId: answer.questionId,
    selectedOptionId: answer.selectedOptionId,
    textAnswer: answer.textAnswer,
    answeredAt: answer.answeredAt
  };

  if (includeReview) {
    safeAnswer.correctOptionId = answer.correctOptionId;
    safeAnswer.correctAnswer = answer.correctAnswer;
    safeAnswer.isCorrect = Boolean(answer.isCorrect);
    safeAnswer.scoreAwarded = Number(answer.scoreAwarded || 0);
  }

  return safeAnswer;
}

function grammarAttemptToActivity(attempt: any, set: any = {}) {
  const gradeClass = getLessonGradeClass(set);
  const totalQuestions = Math.max(
    1,
    Number(attempt.correctCount || 0) + Number(attempt.wrongCount || 0) + Number(attempt.unansweredCount || 0)
      || Number((attempt.questions || []).length)
      || Number(attempt.maxScore || 0)
      || 1
  );
  const correctAnswers = Number(attempt.correctCount || 0);
  const incorrectAnswers = Number(attempt.wrongCount || 0) + Number(attempt.unansweredCount || 0);
  const accuracy = Math.round((correctAnswers / totalQuestions) * 100);
  const answersByQuestion = new Map<string, any>();
  (attempt.answers || []).forEach((answer: any) => {
    answersByQuestion.set(answer.attemptQuestionId, answer);
  });

  return {
    id: `grammar-${attempt.id}`,
    sourceType: "grammar",
    userId: attempt.userId,
    studentId: attempt.userId,
    studentName: attempt.studentName || "Học sinh",
    guestId: attempt.guestId || "",
    assignmentId: attempt.assignmentId || "",
    classId: attempt.classId || set.classId || gradeClass.classId || "",
    className: attempt.className || set.className || gradeClass.className || "",
    vocabSetId: `grammar:${attempt.grammarSetId}`,
    vocabSetTitle: attempt.grammarSetTitle || set.title || "Bài ngữ pháp",
    gameId: "grammar-practice",
    gameName: "Luyện ngữ pháp",
    gameType: "grammar",
    startedAt: attempt.startedAt || attempt.createdAt || attempt.completedAt,
    endedAt: attempt.completedAt,
    completedAt: attempt.completedAt,
    createdAt: attempt.createdAt || attempt.startedAt || attempt.completedAt,
    durationMs: Math.max(0, Number(attempt.durationSeconds || 0)) * 1000,
    durationSeconds: Math.max(0, Number(attempt.durationSeconds || 0)),
    score: accuracy,
    rawScore: Number(attempt.score || 0),
    maxScore: Number(attempt.maxScore || totalQuestions),
    totalQuestions,
    correctAnswers,
    incorrectAnswers,
    accuracy,
    answerDetails: (attempt.questions || []).map((question: any, index: number) => {
      const answer = answersByQuestion.get(question.id);
      const questionType = getGrammarQuestionType(question.questionType, getGrammarQuestionType(set.questionType));
      const selectedOption = (question.optionsSnapshot || []).find((option: any) => option.id === answer?.selectedOptionId);
      const correctOption = (question.optionsSnapshot || []).find((option: any) => option.id === question.correctOptionId || option.id === answer?.correctOptionId);
      const userAnswer = questionType === "rewrite" ? answer?.textAnswer || "" : selectedOption?.text || "";
      const correctAnswer = questionType === "rewrite"
        ? question.correctAnswerSnapshot || answer?.correctAnswer || ""
        : correctOption?.text || "";
      return {
        questionIndex: index,
        wordId: question.questionId,
        questionText: question.questionSnapshot,
        selectedAnswer: userAnswer,
        userAnswer,
        correctAnswer,
        isCorrect: Boolean(answer?.isCorrect),
        options: (question.optionsSnapshot || []).map((option: any) => option.text).filter(Boolean)
      };
    })
  };
}

function leaderboardEventId(sourceType: string, sourceId: string) {
  const hash = crypto.createHash("sha1").update(`${sourceType}:${sourceId}`).digest("hex");
  return `leaderboard-${hash}`;
}

function getLeaderboardEventTime(data: any) {
  return data.completedAt || data.endedAt || data.createdAt || data.startedAt || "";
}

function isOutsideLeaderboardRetention(data: any, nowMs = Date.now()) {
  const eventTime = getLeaderboardEventTime(data);
  return Boolean(eventTime && nowMs - new Date(eventTime).getTime() > LEADERBOARD_RETENTION_MS);
}

function isExpiredStoredLeaderboardEvent(data: any, nowMs = Date.now()) {
  if (data.expiresAt && new Date(data.expiresAt).getTime() < nowMs) return true;
  return isOutsideLeaderboardRetention(data, nowMs);
}

function sanitizeLeaderboardEvent(event: any) {
  const sourceType = safeText(event.sourceType || "vocabulary", 80);
  const sourceId = safeText(event.sourceId || event.id || "", 180);
  const completedAt = getLeaderboardEventTime(event);
  return {
    id: event.id || leaderboardEventId(sourceType, sourceId || crypto.randomUUID()),
    sourceType,
    sourceId,
    assignmentId: safeText(event.assignmentId || "", 180),
    classId: safeText(event.classId || "", 180),
    className: safeText(event.className || "", 180),
    vocabSetId: safeText(event.vocabSetId || "", 180),
    vocabSetTitle: safeText(event.vocabSetTitle || "", 240),
    grammarSetId: safeText(event.grammarSetId || "", 180),
    gameId: safeText(event.gameId || "", 120),
    gameName: safeText(event.gameName || "", 160),
    gameType: safeText(event.gameType || "", 80),
    ownerKey: safeText(event.ownerKey || "", 180),
    ownerType: safeText(event.ownerType || "", 40),
    userId: safeText(event.userId || "", 180),
    studentId: safeText(event.studentId || "", 180),
    guestId: safeText(event.guestId || "", 180),
    studentName: safeText(event.studentName || "Hoc sinh", 160),
    startedAt: event.startedAt || completedAt,
    endedAt: event.endedAt || completedAt,
    completedAt,
    createdAt: event.createdAt || completedAt,
    durationMs: Math.max(0, Number(event.durationMs || 0)),
    durationSeconds: Math.max(0, Number(event.durationSeconds || 0)),
    score: Math.max(0, Number(event.score || 0)),
    rawScore: Math.max(0, Number(event.rawScore || 0)),
    maxScore: Math.max(0, Number(event.maxScore || event.totalQuestions || 0)),
    totalQuestions: Math.max(0, Number(event.totalQuestions || 0)),
    correctAnswers: Math.max(0, Number(event.correctAnswers || 0)),
    incorrectAnswers: Math.max(0, Number(event.incorrectAnswers || 0)),
    accuracy: Math.max(0, Math.min(100, Number(event.accuracy || 0))),
    status: "completed",
    expiresAt: event.expiresAt || addDaysIso(completedAt || new Date().toISOString(), LEADERBOARD_RETENTION_DAYS)
  };
}

function gameSessionToLeaderboardEvent(session: any) {
  const sourceId = safeText(session.id || session.sourceId || "", 180);
  return sanitizeLeaderboardEvent({
    ...session,
    id: leaderboardEventId("vocabulary", sourceId),
    sourceType: "vocabulary",
    sourceId,
    completedAt: session.completedAt || session.endedAt,
    expiresAt: addDaysIso(session.completedAt || session.endedAt || new Date().toISOString(), LEADERBOARD_RETENTION_DAYS)
  });
}

function grammarAttemptToLeaderboardEvent(attempt: any, set: any = {}) {
  const activity = grammarAttemptToActivity(attempt, set);
  const sourceId = safeText(attempt.id || activity.id, 180);
  return sanitizeLeaderboardEvent({
    ...activity,
    answerDetails: undefined,
    id: leaderboardEventId("grammar", sourceId),
    sourceType: "grammar",
    sourceId,
    grammarSetId: attempt.grammarSetId,
    expiresAt: addDaysIso(activity.completedAt || new Date().toISOString(), LEADERBOARD_RETENTION_DAYS)
  });
}

async function persistLeaderboardEvent(event: any) {
  if (!event?.completedAt) return;
  const safeEvent = sanitizeLeaderboardEvent(event);
  await adminDb.collection("leaderboard_events").doc(safeEvent.id).set(safeEvent);
  publicLeaderboardSummaryCache.clear();
}

function mergeLeaderboardEvents(events: any[]) {
  const bySource = new Map<string, any>();
  for (const event of events) {
    if (!event?.completedAt) continue;
    const key = `${event.sourceType || "vocabulary"}:${event.sourceId || event.id}`;
    if (!bySource.has(key)) {
      bySource.set(key, event);
      continue;
    }
    const existing = bySource.get(key);
    if (new Date(getLeaderboardEventTime(event)).getTime() > new Date(getLeaderboardEventTime(existing)).getTime()) {
      bySource.set(key, event);
    }
  }
  return [...bySource.values()].sort((a, b) => new Date(getLeaderboardEventTime(b)).getTime() - new Date(getLeaderboardEventTime(a)).getTime());
}

async function loadLeaderboardEventsFromSources(timing?: ReturnType<typeof createApiTiming>, requestedCutoff = "") {
  const events: any[] = [];
  const retentionCutoff = new Date(Date.now() - LEADERBOARD_RETENTION_MS).toISOString();
  const leaderboardCutoff = requestedCutoff && requestedCutoff > retentionCutoff
    ? requestedCutoff
    : retentionCutoff;
  const [storedSnapshot, readModelSettingDoc] = await Promise.all([
    adminDb.collection("leaderboard_events")
      .where("completedAt", ">=", leaderboardCutoff)
      .get(),
    adminDb.collection("settings").doc(LEADERBOARD_READ_MODEL_SETTING_ID).get()
  ]);
  storedSnapshot.forEach(doc => {
    const data = sanitizeLeaderboardEvent({ id: doc.id, ...doc.data() });
    if (!isExpiredStoredLeaderboardEvent(data)) events.push(data);
  });
  timing?.mark("read_model");

  const readModelSetting = readModelSettingDoc.exists ? readModelSettingDoc.data()?.value : null;
  if (readModelSetting?.ready === true && Number(readModelSetting?.version) === 1) {
    const named = await enrichStudentNames(mergeLeaderboardEvents(events));
    timing?.mark("names");
    return named;
  }

  // Compatibility path for installations that have not run the explicit
  // read-model backfill yet. It is intentionally read-only; no request may
  // migrate source attempts or mark the model as complete.
  const [gameSnapshot, grammarAttemptsSnapshot, grammarSetsById, vocabSetsById] = await Promise.all([
    adminDb.collection("game_sessions")
      .where("completedAt", ">=", leaderboardCutoff)
      .get(),
    adminDb.collection("grammar_attempts")
      .where("completedAt", ">=", leaderboardCutoff)
      .get(),
    getGrammarSetMap(),
    getVocabSetMap()
  ]);
  timing?.mark("legacy_sources");

  gameSnapshot.forEach(doc => {
    const data = { id: doc.id, ...doc.data() };
    if (data.status && data.status !== "completed") return;
    if (!data.completedAt) return;
    if (isOutsideLeaderboardRetention(data)) return;
    const gradeClass = getLessonGradeClass(vocabSetsById.get(data.vocabSetId));
    events.push(gameSessionToLeaderboardEvent({
      ...data,
      classId: data.classId || gradeClass.classId || "",
      className: data.className || gradeClass.className || ""
    }));
  });

  grammarAttemptsSnapshot.forEach(doc => {
    const data = { id: doc.id, ...doc.data() };
    if (data.status !== "completed" || !data.completedAt) return;
    if (isOutsideLeaderboardRetention(data)) return;
    events.push(grammarAttemptToLeaderboardEvent(data, grammarSetsById.get(data.grammarSetId)));
  });

  const named = await enrichStudentNames(mergeLeaderboardEvents(events));
  timing?.mark("names");
  return named;
}

async function getGrammarSetMap() {
  const snapshot = await adminDb.collection("grammar_sets").get();
  const setsById = new Map<string, any>();
  snapshot.forEach(doc => {
    const data = { id: doc.id, ...doc.data() };
    setsById.set(data.id, data);
  });
  return setsById;
}

async function getVocabSetMap() {
  const snapshot = await adminDb.collection("vocab_sets").get();
  const setsById = new Map<string, any>();
  snapshot.forEach(doc => {
    const data = { id: doc.id, ...doc.data() };
    setsById.set(data.id, data);
  });
  return setsById;
}

function getLessonGradeClass(set: any = {}) {
  const gradeLevel = String(set.gradeLevel || "").trim();
  if (!gradeLevel) return { classId: "", className: "" };
  return {
    classId: `grade:${normalizePersonName(gradeLevel)}`,
    className: gradeLevel
  };
}

type TtsSettings = {
  autoGenerate?: boolean;
  provider?: string;
  voice?: string;
  lang?: string;
  speed?: number;
};

type TtsQueueJob = {
  vocabSetId: string;
  settings: Required<TtsSettings>;
  itemIds?: string[];
  force?: boolean;
};

const DEFAULT_TTS_PROVIDER = "ai33";
const DEFAULT_TTS_LANG = "en-US";
const DEFAULT_TTS_SPEED = 1;
const SUPPORTED_TTS_PROVIDERS = new Set(["ai33", "yupvox"]);
const TTS_FETCH_TIMEOUT_MS = Math.max(5000, Number(process.env.TTS_FETCH_TIMEOUT_MS || 30000));
const TTS_MAX_AUDIO_BYTES = Math.max(64 * 1024, Number(process.env.TTS_MAX_AUDIO_BYTES || 3 * 1024 * 1024));
const DEFAULT_TTS_VOICE_BY_PROVIDER: Record<string, Record<string, string>> = {
  ai33: {
    "en-US": "elevenlabs_wMBr6SfqQVuOqplK01NE",
    "en-GB": "elevenlabs_wMBr6SfqQVuOqplK01NE"
  },
  yupvox: {
    "en-US": "EBF147",
    "en-GB": "EBF147"
  }
};
const TTS_CONCURRENCY = Math.max(1, Math.min(10, Number(process.env.TTS_CONCURRENCY || 5)));
const ttsQueue: TtsQueueJob[] = [];
const ttsInFlight = new Map<string, Promise<any>>();
let isProcessingTtsQueue = false;

function normalizeTtsText(text: string) {
  return text.normalize("NFKC").trim().replace(/\s+/g, " ");
}

function sanitizeTtsInput(input: string) {
  const warnings: string[] = [];
  let text = String(input || "").normalize("NFKC").replace(/\r\n?/g, "\n").trim();

  if (!text) return { text: "", warnings };

  const lines = text.split("\n").map(line => line.trim()).filter(Boolean);
  if (lines.length > 1) {
    warnings.push("Only the first non-empty line was used for TTS.");
    text = lines[0];
  }

  const dashSplit = text.split(/\s+[–—-]\s+/);
  if (dashSplit.length > 1) {
    warnings.push("Text after the separator was removed before TTS.");
    text = dashSplit[0];
  }

  const beforeNotes = text;
  text = text.replace(/\s*[\(\[\{][^\)\]\}]{1,80}[\)\]\}]\s*$/g, "").trim();
  if (text !== beforeNotes) warnings.push("Trailing note text was removed before TTS.");

  const beforeIpa = text;
  text = text.replace(/\s+\/[^/]{1,80}\/\s*$/g, "").trim();
  if (text !== beforeIpa) warnings.push("Trailing IPA text was removed before TTS.");

  text = normalizeTtsText(text)
    .replace(/^[\s"'“”‘’.,;:!?]+|[\s"'“”‘’.,;:!?]+$/g, "")
    .trim();

  if (text.length > 120) {
    warnings.push("TTS text was shortened to 120 characters.");
    text = text.slice(0, 120).trim();
  }

  return { text, warnings };
}

function normalizeTtsSettings(settings: TtsSettings = {}): Required<TtsSettings> {
  const provider = String(settings.provider || DEFAULT_TTS_PROVIDER).trim().toLowerCase();
  if (!SUPPORTED_TTS_PROVIDERS.has(provider)) {
    throw createHttpError(400, `Unsupported TTS provider: ${provider}`);
  }
  const lang = settings.lang === "en-GB" ? "en-GB" : DEFAULT_TTS_LANG;
  const speed = Math.min(1.5, Math.max(0.5, Number(settings.speed || DEFAULT_TTS_SPEED)));
  const providerVoices = DEFAULT_TTS_VOICE_BY_PROVIDER[provider];
  return {
    autoGenerate: Boolean(settings.autoGenerate),
    provider,
    voice: String(settings.voice || providerVoices[lang] || providerVoices[DEFAULT_TTS_LANG]).trim(),
    lang,
    speed
  };
}

function createAudioHash(text: string, settings: Required<TtsSettings>) {
  const normalizedText = normalizeTtsText(text);
  // The supplied YupVox API contract has no generation-speed field. Speed is
  // applied by the client player, so all playback speeds share one raw file.
  const generationSpeed = settings.provider === "yupvox" ? DEFAULT_TTS_SPEED : settings.speed;
  return crypto
    .createHash("sha256")
    .update(`${settings.provider}|${settings.lang}|${settings.voice}|${generationSpeed}|${normalizedText}`)
    .digest("hex");
}

function audioFileName(audioHash: string) {
  return `${audioHash}.mp3`;
}

function audioFilePath(audioHash: string) {
  return path.join(AUDIO_DIR, audioFileName(audioHash));
}

function audioPublicUrl(audioHash: string) {
  return `${AUDIO_PUBLIC_PREFIX}/${audioFileName(audioHash)}`;
}

function getAi33ApiKey() {
  return process.env.AI33_API_KEY || process.env.TTS_API_KEY || "";
}

function getYupVoxApiKey() {
  return process.env.YUPVOX_API_KEY || "";
}

function getAi33TaskUrl(taskId: string) {
  const template = process.env.AI33_TASK_STATUS_URL_TEMPLATE || "https://api.ai33.pro/v1/task/{taskId}";
  return template.replace("{taskId}", encodeURIComponent(taskId));
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = TTS_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal
    });
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs}ms.`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

async function responseBufferWithCap(res: Response, maxBytes: number) {
  const contentLength = Number(res.headers.get("content-length") || 0);
  if (contentLength > maxBytes) {
    throw new Error(`Downloaded TTS file is too large (${contentLength} bytes).`);
  }

  const body: any = res.body;
  if (body?.getReader) {
    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        throw new Error(`Downloaded TTS file is too large (${total} bytes).`);
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks.map(chunk => Buffer.from(chunk)), total);
  }

  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (buffer.byteLength > maxBytes) {
    throw new Error(`Downloaded TTS file is too large (${buffer.byteLength} bytes).`);
  }
  return buffer;
}

function writeFileAtomic(targetPath: string, buffer: Buffer) {
  const dir = path.dirname(targetPath);
  fs.mkdirSync(dir, { recursive: true });
  const tempPath = path.join(dir, `.${path.basename(targetPath)}.${process.pid}.${Date.now()}.tmp`);
  try {
    fs.writeFileSync(tempPath, buffer, { flag: "wx" });
    fs.renameSync(tempPath, targetPath);
  } finally {
    if (fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
      } catch {
        // Best effort cleanup for interrupted TTS writes.
      }
    }
  }
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, limit), items.length);

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex++;
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  }));

  return results;
}

async function requestAi33TtsTask(text: string, settings: Required<TtsSettings>, fileName: string) {
  const apiKey = getAi33ApiKey();
  if (!apiKey) throw new Error("AI33_API_KEY/TTS_API_KEY is not configured.");

  const form = new FormData();
  form.set("text", text);
  form.set("voice_id", settings.voice);
  form.set("speed", String(settings.speed));
  form.set("with_transcript", "false");
  form.set("file_name", fileName);

  const res = await fetchWithTimeout("https://api.ai33.pro/v3/text-to-speech", {
    method: "POST",
    headers: { "xi-api-key": apiKey },
    body: form
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok || !data.success || !data.task_id) {
    throw new Error(data.error || data.message || `TTS request failed with HTTP ${res.status}`);
  }
  return data.task_id as string;
}

async function pollAi33AudioUrl(taskId: string) {
  const apiKey = getAi33ApiKey();
  if (!apiKey) throw new Error("AI33_API_KEY/TTS_API_KEY is not configured.");

  const maxAttempts = Number(process.env.AI33_TTS_POLL_ATTEMPTS || 24);
  const intervalMs = Number(process.env.AI33_TTS_POLL_INTERVAL_MS || 2500);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) await delay(intervalMs);
    const res = await fetchWithTimeout(getAi33TaskUrl(taskId), {
      headers: { "xi-api-key": apiKey }
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || data.message || `TTS status failed with HTTP ${res.status}`);

    const status = String(data.status || "").toLowerCase();
    if (status === "failed" || status === "error") {
      throw new Error(data.error_message || data.error || "TTS task failed.");
    }
    const audioUrl = data.metadata?.audio_url || data.metadata?.output_uri || data.output_uri || data.audio_url;
    if ((status === "done" || status === "completed" || status === "success") && audioUrl) {
      return audioUrl as string;
    }
  }

  throw new Error("TTS task timed out before audio was ready.");
}

async function requestTtsProviderAudioUrl(
  text: string,
  settings: Required<TtsSettings>,
  fileName: string
): Promise<{ audioUrl: string; validateAudioUrl?: (value: string) => string }> {
  if (settings.provider === "yupvox") {
    const audioUrl = await generateYupVoxAudioUrl({
      apiKey: getYupVoxApiKey(),
      baseUrl: process.env.YUPVOX_BASE_URL,
      voiceId: settings.voice,
      text,
      maxPollAttempts: Number(process.env.YUPVOX_TTS_POLL_ATTEMPTS || 40),
      pollIntervalMs: Number(process.env.YUPVOX_TTS_POLL_INTERVAL_MS || 1500),
      fetchImpl: fetchWithTimeout,
      wait: delay
    });
    return { audioUrl, validateAudioUrl: assertSafeYupVoxAudioUrl };
  }

  const taskId = await requestAi33TtsTask(text, settings, fileName);
  return { audioUrl: await pollAi33AudioUrl(taskId) };
}

async function downloadAudioToCache(
  sourceUrl: string,
  targetPath: string,
  validateAudioUrl?: (value: string) => string
) {
  const resolvedSourceUrl = validateAudioUrl ? validateAudioUrl(sourceUrl) : sourceUrl;
  const res = await fetchWithTimeout(resolvedSourceUrl);
  if (!res.ok) throw new Error(`Audio download failed with HTTP ${res.status}`);
  if (validateAudioUrl && res.url) validateAudioUrl(res.url);
  const contentType = res.headers.get("content-type") || "";
  if (contentType && !contentType.includes("audio") && !contentType.includes("octet-stream")) {
    throw new Error(`Downloaded TTS file is not audio (${contentType}).`);
  }
  const buffer = await responseBufferWithCap(res, TTS_MAX_AUDIO_BYTES);
  if (buffer.byteLength < 1024) {
    throw new Error("Downloaded TTS file is too small to be valid audio.");
  }
  writeFileAtomic(targetPath, buffer);
}

async function generateCachedTtsAudio(inputText: string, settings: Required<TtsSettings>, force = false) {
  const sanitized = sanitizeTtsInput(inputText);
  if (!sanitized.text) throw new Error("Missing TTS text after cleanup.");

  const audioHash = createAudioHash(sanitized.text, settings);
  const targetPath = audioFilePath(audioHash);
  const targetUrl = audioPublicUrl(audioHash);

  if (!force && fs.existsSync(targetPath)) {
    return {
      audioHash,
      audioUrl: targetUrl,
      cached: true,
      ttsText: sanitized.text,
      warnings: sanitized.warnings
    };
  }

  const inFlight = ttsInFlight.get(audioHash);
  if (inFlight) return inFlight;

  const generation = (async () => {
    if (force && fs.existsSync(targetPath)) {
      try {
        fs.unlinkSync(targetPath);
      } catch (err) {
        console.warn("Could not remove old TTS cache before regeneration:", err);
      }
    }

    const providerResult = await requestTtsProviderAudioUrl(
      sanitized.text,
      settings,
      audioFileName(audioHash)
    );
    await downloadAudioToCache(
      providerResult.audioUrl,
      targetPath,
      providerResult.validateAudioUrl
    );
    return {
      audioHash,
      audioUrl: `${targetUrl}?v=${Date.now()}`,
      cached: false,
      ttsText: sanitized.text,
      warnings: sanitized.warnings
    };
  })();

  ttsInFlight.set(audioHash, generation);
  try {
    return await generation;
  } finally {
    if (ttsInFlight.get(audioHash) === generation) {
      ttsInFlight.delete(audioHash);
    }
  }
}

function mergeItemAudioState(item: any, patch: any) {
  return {
    ...item,
    ...patch,
    audioUpdatedAt: new Date().toISOString()
  };
}

async function saveVocabSetItems(vocabSetId: string, items: any[]) {
  const docRef = adminDb.collection("vocab_sets").doc(vocabSetId);
  const latestDoc = await docRef.get();
  if (!latestDoc.exists) return;
  const latest = latestDoc.data();
  await docRef.set(normalizeVocabSetForSave({ ...latest, items }, latest));
}

function enqueueVocabSetAudio(vocabSetId: string, settings: TtsSettings, itemIds?: string[], force = false) {
  ttsQueue.push({
    vocabSetId,
    settings: normalizeTtsSettings(settings),
    itemIds,
    force
  });
  processTtsQueue().catch(err => console.error("TTS queue failed:", err));
}

async function processTtsQueue() {
  if (isProcessingTtsQueue) return;
  isProcessingTtsQueue = true;
  try {
    while (ttsQueue.length > 0) {
      const job = ttsQueue.shift();
      if (!job) continue;
      await processVocabSetAudioJob(job);
    }
  } finally {
    isProcessingTtsQueue = false;
  }
}

async function processVocabSetAudioJob(job: TtsQueueJob) {
  const docRef = adminDb.collection("vocab_sets").doc(job.vocabSetId);
  const doc = await docRef.get();
  if (!doc.exists) return;

  let set = doc.data();
  let items = Array.isArray(set.items) ? [...set.items] : [];
  const selected = new Set(job.itemIds || items.map((item: any) => item.id));

  const tasks: Array<{
    itemId: string;
    sanitized: { text: string; warnings: string[] };
    audioHash: string;
    targetPath: string;
  }> = [];

  let hasInitialUpdates = false;
  for (const item of items) {
    if (!selected.has(item.id)) continue;
    const sanitized = sanitizeTtsInput(String(item.term || ""));
    if (!sanitized.text) continue;

    const audioHash = createAudioHash(sanitized.text, job.settings);
    const targetPath = audioFilePath(audioHash);
    const existingReady = !job.force && item.audioHash === audioHash && item.audioUrl && fs.existsSync(targetPath);

    if (existingReady) continue;

    if (!job.force && fs.existsSync(targetPath)) {
      hasInitialUpdates = true;
      items = items.map((current: any) => current.id === item.id
        ? mergeItemAudioState(current, {
            audioUrl: audioPublicUrl(audioHash),
            audioHash,
            audioStatus: "ready",
            audioError: "",
            ttsText: sanitized.text,
            audioWarnings: sanitized.warnings,
            ttsProvider: job.settings.provider,
            ttsVoice: job.settings.voice,
            ttsLang: job.settings.lang,
            ttsSpeed: job.settings.speed,
            audioGeneratedAt: current.audioGeneratedAt || new Date().toISOString()
          })
        : current
      );
      continue;
    }

    hasInitialUpdates = true;
    tasks.push({ itemId: item.id, sanitized, audioHash, targetPath });
    items = items.map((current: any) => current.id === item.id
      ? mergeItemAudioState(current, {
          audioHash,
          audioStatus: "generating",
          audioError: "",
          ttsText: sanitized.text,
          audioWarnings: sanitized.warnings,
          ttsProvider: job.settings.provider,
          ttsVoice: job.settings.voice,
          ttsLang: job.settings.lang,
          ttsSpeed: job.settings.speed
        })
      : current
    );
  }

  if (hasInitialUpdates) {
    await saveVocabSetItems(job.vocabSetId, items);
  }
  if (tasks.length === 0) return;

  const taskGroups = new Map<string, typeof tasks>();
  for (const task of tasks) {
    const group = taskGroups.get(task.audioHash) || [];
    group.push(task);
    taskGroups.set(task.audioHash, group);
  }

  const generated = await runWithConcurrency([...taskGroups.entries()], TTS_CONCURRENCY, async ([audioHash, group]) => {
    try {
      const result = await generateCachedTtsAudio(group[0].sanitized.text, job.settings, job.force);
      return { audioHash, result, error: null as any };
    } catch (err: any) {
      return { audioHash, result: null as any, error: err };
    }
  });

  const generatedByHash = new Map(generated.map(result => [result.audioHash, result]));
  items = items.map((current: any) => {
    const task = tasks.find(entry => entry.itemId === current.id);
    if (!task) return current;
    const generatedResult = generatedByHash.get(task.audioHash);
    if (!generatedResult || generatedResult.error) {
      return mergeItemAudioState(current, {
        audioHash: task.audioHash,
        audioStatus: "failed",
        audioError: generatedResult?.error?.message || "TTS generation failed.",
        ttsText: task.sanitized.text,
        audioWarnings: task.sanitized.warnings,
        ttsProvider: job.settings.provider,
        ttsVoice: job.settings.voice,
        ttsLang: job.settings.lang,
        ttsSpeed: job.settings.speed
      });
    }

    return mergeItemAudioState(current, {
      audioUrl: generatedResult.result.audioUrl,
      audioHash: generatedResult.result.audioHash,
      audioStatus: "ready",
      audioError: "",
      ttsText: generatedResult.result.ttsText,
      audioWarnings: generatedResult.result.warnings,
      ttsProvider: job.settings.provider,
      ttsVoice: job.settings.voice,
      ttsLang: job.settings.lang,
      ttsSpeed: job.settings.speed,
      audioGeneratedAt: new Date().toISOString()
    });
  });

  await saveVocabSetItems(job.vocabSetId, items);
}

// ============================================================================
// DATABASE PRE-SEEDING LOGIC FOR FIRESTORE
// ============================================================================
const preSeedDb = async () => {
  try {
    console.log("Checking and seeding database if empty...");

    // Seed Users
    const usersSnapshot = await adminDb.collection("users").get();
    if (usersSnapshot.empty) {
      console.log("Seeding default users...");
      const defaultUsers = [
        { id: "teacher-1", name: "Giáo viên mẫu", email: "teacher@example.invalid", role: "teacher", status: "active", createdAt: new Date().toISOString() },
        { id: "admin-1", name: "Quản trị viên mẫu", email: "admin@example.invalid", role: "super_admin", status: "active", createdAt: new Date().toISOString() }
      ];
      for (const u of defaultUsers) {
        await adminDb.collection("users").doc(u.id).set(u);
      }
    }

    // Seed Classes
    const classesSnapshot = await adminDb.collection("classes").get();
    if (classesSnapshot.empty) {
      console.log("Seeding default classes...");
      const defaultClasses = [
        { id: "class-1", name: "Lớp 3A1 - Tiếng Anh Tiểu Học", code: "LOP3A1", teacherId: "teacher-1" },
        { id: "class-2", name: "Lớp 6B2 - Tiếng Anh THCS", code: "LOP6B2", teacherId: "teacher-1" }
      ];
      for (const c of defaultClasses) {
        await adminDb.collection("classes").doc(c.id).set(c);
      }

      // Seed Class Members
      const defaultMembers = [
        { id: "member-1", classId: "class-1", studentName: "Nguyễn Văn An" },
        { id: "member-2", classId: "class-1", studentName: "Trần Thị Bình" },
        { id: "member-3", classId: "class-1", studentName: "Lê Hoàng Nam" },
        { id: "member-4", classId: "class-2", studentName: "Phạm Hải Đăng" },
        { id: "member-5", classId: "class-2", studentName: "Nguyễn Khánh Linh" }
      ];
      for (const m of defaultMembers) {
        await adminDb.collection("class_members").doc(m.id).set(m);
      }
    }

    // Seed Vocab Sets
    const vocabSnapshot = await adminDb.collection("vocab_sets").get();
    if (vocabSnapshot.empty) {
      console.log("Seeding default vocab sets...");
      const defaultVocabSets = [
        {
          id: "set-1",
          title: "Ordinal Numbers (Số thứ tự)",
          description: "Học cách viết và phát âm các số thứ tự cơ bản từ thứ nhất đến thứ mười trong tiếng Anh.",
          subject: "Numbers",
          tags: ["numbers", "basic", "math"],
          gradeLevel: "Lớp 3",
          createdAt: new Date().toISOString(),
          createdBy: "admin-1",
          creatorName: "Hệ thống Admin",
          status: "public",
          items: [
            { id: "item-1-1", term: "First", meaning: "Thứ nhất", ipa: "/fɜːst/", pos: "Adjective", example: "He won the first prize in the competition.", exampleMeaning: "Cậu ấy đã giành giải nhất trong cuộc thi.", displayOrder: 1 },
            { id: "item-1-2", term: "Second", meaning: "Thứ hai", ipa: "/ˈsekənd/", pos: "Adjective", example: "This is the second time I have visited Hanoi.", exampleMeaning: "Đây là lần thứ hai tôi đến thăm Hà Nội.", displayOrder: 2 },
            { id: "item-1-3", term: "Third", meaning: "Thứ ba", ipa: "/θɜːd/", pos: "Adjective", example: "My office is on the third floor.", exampleMeaning: "Văn phòng của tôi nằm ở tầng ba.", displayOrder: 3 },
            { id: "item-1-4", term: "Fourth", meaning: "Thứ tư", ipa: "/fɔːθ/", pos: "Adjective", example: "April is the fourth month of the year.", exampleMeaning: "Tháng Tư là tháng thứ tư trong năm.", displayOrder: 4 },
            { id: "item-1-5", term: "Fifth", meaning: "Thứ năm", ipa: "/fɪfθ/", pos: "Adjective", example: "She finished in fifth place in the race.", exampleMeaning: "Cô ấy về đích ở vị trí thứ năm trong cuộc đua.", displayOrder: 5 },
            { id: "item-1-6", term: "Sixth", meaning: "Thứ sáu", ipa: "/sɪksθ/", pos: "Adjective", example: "He is celebrating his sixth birthday today.", exampleMeaning: "Hôm nay cậu ấy đang mừng sinh nhật lần thứ sáu.", displayOrder: 6 },
            { id: "item-1-7", term: "Seventh", meaning: "Thứ bảy", ipa: "/ˈsevnθ/", pos: "Adjective", example: "We live on the seventh street.", exampleMeaning: "Chúng tôi sống ở con đường thứ bảy.", displayOrder: 7 },
            { id: "item-1-8", term: "Eighth", meaning: "Thứ tám", ipa: "/eɪtθ/", pos: "Adjective", example: "This is the eighth cup of water today.", exampleMeaning: "Đây là cốc nước thứ tám trong ngày hôm nay.", displayOrder: 8 },
            { id: "item-1-9", term: "Ninth", meaning: "Thứ chín", ipa: "/naɪnθ/", pos: "Adjective", example: "The ninth chapter of the book is very interesting.", exampleMeaning: "Chương thứ chín của cuốn sách rất thú vị.", displayOrder: 9 },
            { id: "item-1-10", term: "Tenth", meaning: "Thứ mười", ipa: "/tenθ/", pos: "Adjective", example: "Today is our tenth wedding anniversary.", exampleMeaning: "Hôm nay là kỷ niệm mười năm ngày cưới của chúng tôi.", displayOrder: 10 }
          ]
        },
        {
          id: "set-2",
          title: "Animals - Basic (Động vật cơ bản)",
          description: "Bộ từ vựng về các loài động vật quen thuộc xung quanh chúng ta dành cho học sinh tiểu học.",
          subject: "Science",
          tags: ["animals", "nature", "basic"],
          gradeLevel: "Lớp 3",
          createdAt: new Date().toISOString(),
          createdBy: "admin-1",
          creatorName: "Hệ thống Admin",
          status: "public",
          items: [
            { id: "item-2-1", term: "cat", meaning: "con mèo", ipa: "/kæt/", pos: "Noun", example: "The cat is sleeping on the warm sofa.", exampleMeaning: "Con mèo đang ngủ trên chiếc ghế sofa ấm áp.", displayOrder: 1 },
            { id: "item-2-2", term: "dog", meaning: "con chó", ipa: "/dɒɡ/", pos: "Noun", example: "My dog loves to run in the park.", exampleMeaning: "Con chó của tôi thích chạy nhảy trong công viên.", displayOrder: 2 },
            { id: "item-2-3", term: "bird", meaning: "con chim", ipa: "/bɜːd/", pos: "Noun", example: "A colorful bird is singing on the tree branch.", exampleMeaning: "Một chú chim đầy màu sắc đang hót trên cành cây.", displayOrder: 3 },
            { id: "item-2-4", term: "fish", meaning: "con cá", ipa: "/fɪʃ/", pos: "Noun", example: "We have three gold fish in the tank.", exampleMeaning: "Chúng tôi có ba chú cá vàng trong bể.", displayOrder: 4 },
            { id: "item-2-5", term: "elephant", meaning: "con voi", ipa: "/ˈelɪfənt/", pos: "Noun", example: "The elephant is the largest land mammal.", exampleMeaning: "Con voi là loài động vật có vú lớn nhất trên mặt đất.", displayOrder: 5 },
            { id: "item-2-6", term: "tiger", meaning: "con hổ", ipa: "/ˈtaɪɡə(r)/", pos: "Noun", example: "The tiger has orange and black stripes.", exampleMeaning: "Con hổ có các vằn màu cam và đen.", displayOrder: 6 },
            { id: "item-2-7", term: "lion", meaning: "con sư tử", ipa: "/ˈlaɪən/", pos: "Noun", example: "The lion is known as the king of the jungle.", exampleMeaning: "Sư tử được biết đến là chúa tể rừng xanh.", displayOrder: 7 },
            { id: "item-2-8", term: "monkey", meaning: "con khỉ", ipa: "/ˈmʌŋki/", pos: "Noun", example: "The monkey is swinging from branch to branch.", exampleMeaning: "Con khỉ đang chuyền từ cành này sang cành khác.", displayOrder: 8 }
          ]
        }
      ];
      for (const set of defaultVocabSets) {
        await adminDb.collection("vocab_sets").doc(set.id).set(set);
      }
    }

    // Seed Assignments
    const assignSnapshot = await adminDb.collection("assignments").get();
    if (assignSnapshot.empty) {
      console.log("Seeding default assignments...");
      const defaultAssignments = [
        {
          id: "assign-1",
          classId: "class-1",
          className: "Lớp 3A1 - Tiếng Anh Tiểu Học",
          vocabSetId: "set-1",
          vocabSetTitle: "Ordinal Numbers (Số thứ tự)",
          gameId: "flashcard-en-vi",
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          createdAt: new Date().toISOString(),
          createdBy: "teacher-1",
          title: "Học số thứ tự qua Flashcard"
        },
        {
          id: "assign-2",
          classId: "class-1",
          className: "Lớp 3A1 - Tiếng Anh Tiểu Học",
          vocabSetId: "set-2",
          vocabSetTitle: "Animals - Basic (Động vật cơ bản)",
          gameId: "quiz-en-vi",
          dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          createdAt: new Date().toISOString(),
          createdBy: "teacher-1",
          title: "Trắc nghiệm động vật cơ bản"
        }
      ];
      for (const a of defaultAssignments) {
        await adminDb.collection("assignments").doc(a.id).set(a);
      }
    }

    console.log("Database seeding validation complete!");
  } catch (err) {
    console.error("Error seeding database:", err);
  }
};

// ============================================================================
// GEMINI CLIENT INITIALIZATION
// ============================================================================
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1";
const STALI_API_KEY = process.env.STALI_API_KEY?.trim() || "";
const STALI_BASE_URL = process.env.STALI_BASE_URL?.trim() || STALI_DEFAULT_BASE_URL;
const STALI_SMART_IMPORT_PROVIDERS = getStaliSmartImportProviders(STALI_API_KEY);
const DEVQUOTA_API_KEY = resolveDevQuotaApiKey(process.env);
const DEVQUOTA_BASE_URL = process.env.DEVQUOTA_BASE_URL?.trim() || DEVQUOTA_DEFAULT_BASE_URL;
const DEVQUOTA_SMART_IMPORT_PROVIDERS = getDevQuotaSmartImportProviders(DEVQUOTA_API_KEY);
const WRITING_GRADING_CONFIG = {
  staliApiKey: STALI_API_KEY,
  staliBaseUrl: STALI_BASE_URL,
  devQuotaApiKey: DEVQUOTA_API_KEY,
  devQuotaBaseUrl: DEVQUOTA_BASE_URL,
};

const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY is not defined. AI fallback will activate.");
    return null;
  }
  return new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
};

function getOpenAIKey() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("OPENAI_API_KEY is not defined. OpenAI paid fallback is disabled.");
    return "";
  }
  return apiKey;
}

function sanitizeAiError(provider: string, error: any) {
  if (error?.name === "AbortError") {
    return `${provider}: request bị hủy do vượt thời gian xử lý.`;
  }
  const status = error?.status || error?.statusCode || error?.response?.status;
  const message = String(error?.message || error || "Unknown AI error")
    .replace(/sk-[A-Za-z0-9_-]+/g, "sk-***")
    .slice(0, 240);
  return status ? `${provider} ${status}: ${message}` : `${provider}: ${message}`;
}

function extractOpenAIText(data: any) {
  if (typeof data?.output_text === "string") return data.output_text;

  const chunks: string[] = [];
  for (const item of data?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === "string") {
        chunks.push(content.text);
      }
    }
  }

  return chunks.join("\n").trim();
}

async function generateWithOpenAI(prompt: string) {
  const apiKey = getOpenAIKey();
  if (!apiKey) return null;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: prompt,
      text: {
        format: { type: "text" }
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    const error = new Error(errorText || `OpenAI request failed with status ${response.status}`) as any;
    error.status = response.status;
    throw error;
  }

  const data = await response.json();
  const text = extractOpenAIText(data);
  if (!text) {
    throw new Error("OpenAI response did not include text output.");
  }

  return text;
}

async function generateWithOpenAIVision(
  prompt: string,
  images: SmartImportImageInput[],
  options: SmartImportVisionOptions,
  signal?: AbortSignal
) {
  const apiKey = getOpenAIKey();
  if (!apiKey) return null;
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    signal,
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: [{
        role: "user",
        content: [
          { type: "input_text", text: prompt },
          ...images.flatMap(image => ([
            { type: "input_text" as const, text: `IMAGE ROLE: ${image.role}` },
            {
              type: "input_image" as const,
              image_url: `data:${image.mimeType};base64,${image.data.toString("base64")}`,
              detail: "high" as const
            }
          ]))
        ]
      }],
      text: {
        format: {
          type: "json_schema",
          name: options.schemaName,
          schema: options.responseJsonSchema,
          strict: false
        }
      }
    })
  });
  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    const error = new Error(errorText || `OpenAI request failed with status ${response.status}`) as any;
    error.status = response.status;
    throw error;
  }
  const data = await response.json();
  const text = extractOpenAIText(data);
  if (!text) throw new Error("OpenAI response did not include text output.");
  return text;
}

async function generateAiVisionJson(
  prompt: string,
  images: SmartImportImageInput<string>[],
  options: SmartImportVisionOptions,
  signal?: AbortSignal
) {
  const errors: string[] = [];
  const preferred = options.preferredProvider || "stali:gpt-5.6-sol";
  if (!isStaliProviderId(preferred) && !isDevQuotaProviderId(preferred)) {
    const unsupported: any = new Error(`Nhà cung cấp AI "${preferred}" chưa được backend hỗ trợ.`);
    unsupported.status = 400;
    throw unsupported;
  }
  if (isStaliProviderId(preferred)) {
    try {
      const result = await generateWithStaliVision({
        providerId: preferred,
        prompt,
        images,
        options,
        signal,
        apiKey: STALI_API_KEY,
        baseUrl: STALI_BASE_URL,
      });
      if (result) return { ...result, errors };
      errors.push("Stali: STALI_API_KEY is not configured.");
    } catch (error: any) {
      if (error?.status === 400 || error?.status === 413) throw error;
      errors.push(sanitizeAiError("Stali", error));
    }
  }
  if (isDevQuotaProviderId(preferred)) {
    try {
      const result = await generateWithDevQuotaVision({
        providerId: preferred,
        prompt,
        images,
        options,
        signal,
        apiKey: DEVQUOTA_API_KEY,
        baseUrl: DEVQUOTA_BASE_URL,
      });
      if (result) return { ...result, errors };
      errors.push("DevQuota: DEVQUOTA_API_KEY is not configured.");
    } catch (error: any) {
      if (error?.status === 400 || error?.status === 413) throw error;
      errors.push(sanitizeAiError("DevQuota", error));
    }
  }
  const unavailable = new Error("Không có nhà cung cấp AI thị giác khả dụng.") as any;
  unavailable.status = 503;
  unavailable.details = errors;
  unavailable.code = "AI_PROVIDER_UNAVAILABLE";
  throw unavailable;
}

async function generateAiText(prompt: string, geminiConfig?: any) {
  const errors: string[] = [];
  const gemini = getGeminiClient();

  if (gemini) {
    try {
      const response = await gemini.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        ...(geminiConfig ? { config: geminiConfig } : {})
      });
      return {
        text: response.text?.trim() || "",
        provider: "gemini",
        errors
      };
    } catch (error: any) {
      const message = sanitizeAiError("Gemini", error);
      errors.push(message);
      console.warn("Gemini unavailable, trying OpenAI fallback:", message);
    }
  } else {
    errors.push("Gemini: GEMINI_API_KEY is not configured.");
  }

  try {
    const text = await generateWithOpenAI(prompt);
    if (text) {
      return {
        text: text.trim(),
        provider: "openai",
        errors
      };
    }
    errors.push("OpenAI: OPENAI_API_KEY is not configured.");
  } catch (error: any) {
    const message = sanitizeAiError("OpenAI", error);
    errors.push(message);
    console.warn("OpenAI fallback unavailable, using local fallback:", message);
  }

  return {
    text: "",
    provider: "fallback",
    errors
  };
}

// ============================================================================
// API ROUTES
// ============================================================================

function requireDiagnosticAccess(req: express.Request, res: express.Response, next: express.NextFunction) {
  const configured = process.env.DIAGNOSTIC_SECRET?.trim();
  if (!configured) return res.status(404).json({ error: "Not found" });
  if (!safeEqualSecret(req.headers["x-diagnostic-secret"], configured)) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}

const diagnosticsRepository = createDiagnosticsRepository({
  db: adminDb,
  loadStorageDiagnostics: getStorageDiagnostics,
});
const diagnosticsService = createDiagnosticsService({ repository: diagnosticsRepository });
app.use(
  "/api",
  createDiagnosticsRouter({ requireDiagnosticAccess, sendApiError, service: diagnosticsService }),
);

async function loadReadyLeaderboardEvents(timing?: ReturnType<typeof createApiTiming>, requestedCutoff = "") {
  const retentionCutoff = new Date(Date.now() - LEADERBOARD_RETENTION_MS).toISOString();
  const leaderboardCutoff = requestedCutoff && requestedCutoff > retentionCutoff
    ? requestedCutoff
    : retentionCutoff;
  const [storedSnapshot, readModelSettingDoc] = await Promise.all([
    adminDb.collection("leaderboard_events")
      .where("completedAt", ">=", leaderboardCutoff)
      .get(),
    adminDb.collection("settings").doc(LEADERBOARD_READ_MODEL_SETTING_ID).get()
  ]);
  timing?.mark("read_model");

  const readModelSetting = readModelSettingDoc.exists ? readModelSettingDoc.data()?.value : null;
  if (readModelSetting?.ready !== true || Number(readModelSetting?.version) !== 1) {
    return null;
  }

  const events: any[] = [];
  storedSnapshot.forEach(doc => {
    const data = sanitizeLeaderboardEvent({ id: doc.id, ...doc.data() });
    if (!isExpiredStoredLeaderboardEvent(data)) events.push(data);
  });
  return mergeLeaderboardEvents(events);
}

const PHONE_AUTH_WINDOW_MS = 10 * 60 * 1000;
const PHONE_AUTH_MAX_ATTEMPTS = 5;
const phoneAuthRateLimit = new FixedWindowRateLimitStore(PHONE_AUTH_WINDOW_MS, PHONE_AUTH_MAX_ATTEMPTS);

function getRequestIp(req: express.Request) {
  return getRequestNetworkKey(req);
}

const guestIdentityRateLimit = createFixedWindowRateLimiter({
  namespace: "guest-identity",
  windowMs: 10 * 60 * 1000,
  maxCost: 120,
  key: req => `ip:${getRequestIp(req)}`,
  message: "Too many identity requests. Please wait and try again."
});

const publicLeaderboardRateLimit = createFixedWindowRateLimiter({
  namespace: "public-leaderboard",
  windowMs: 10 * 60 * 1000,
  maxCost: 120,
  key: req => `ip:${getRequestIp(req)}`,
  message: "Too many leaderboard requests. Please wait and try again."
});

const aiRateLimit = createFixedWindowRateLimiter({
  namespace: "ai-tools",
  windowMs: 10 * 60 * 1000,
  maxCost: 60,
  message: "Too many AI requests. Please wait and try again."
});

const vocabularyAiService = createVocabularyAiService({
  provider: {
    generateText: generateAiText,
    sanitizeError: sanitizeAiError,
  },
});
app.use(
  "/api",
  createVocabularyAiRouter({
    authenticateUser,
    requireStaff: requireRole(["teacher", "super_admin"]),
    rateLimit: aiRateLimit,
    sendApiError,
    service: vocabularyAiService,
  }),
);

const ttsRateLimit = createFixedWindowRateLimiter({
  namespace: "tts-generation",
  windowMs: 10 * 60 * 1000,
  maxCost: 500,
  cost: req => {
    if (req.path.includes("batch-preview")) {
      return Math.min(200, Math.max(1, Array.isArray(req.body?.items) ? req.body.items.length : 1));
    }
    if (req.path.includes("generate-missing")) {
      return Math.min(100, Math.max(20, Array.isArray(req.body?.itemIds) ? req.body.itemIds.length : 20));
    }
    return 1;
  },
  message: "TTS quota for this account was reached. Please wait and try again."
});

const ttsVoiceProvider = createTtsVoiceProvider({
  getApiKey: getAi33ApiKey,
  fetchWithTimeout,
});
const ttsService = createTtsService({
  normalizeSettings: normalizeTtsSettings,
  sanitizeInput: sanitizeTtsInput,
  createAudioHash,
  generateCachedAudio: generateCachedTtsAudio,
  runWithConcurrency: (items, limit, worker) => runWithConcurrency(items, limit, worker),
  concurrency: TTS_CONCURRENCY,
  voiceProvider: ttsVoiceProvider,
});
app.use(
  "/api",
  createTtsRouter({
    authenticateUser,
    requireStaff: requireRole(["teacher", "super_admin"]),
    rateLimit: ttsRateLimit,
    sendApiError,
    service: ttsService,
  }),
);

const vocabularyRepository = createVocabularyRepository({
  db: adminDb,
  resolveImageReferences: resolveVocabImageReferencesForSave,
});
const vocabularyService = createVocabularyService({
  repository: vocabularyRepository,
  canViewSet: canViewVocabSet,
  canManageSet: canManageVocabSet,
  canManageAssignment,
  isSuperAdmin,
  getVisibility: getVocabVisibility,
  toLegacyStatus,
  normalizeForRead: normalizeVocabSetForRead,
  normalizeForSave: normalizeVocabSetForSave,
  stripPrivateFields: stripPrivateVocabSetFields,
  resolveLearningAccess: (token, timing) => resolveVocabLearningAccess(token, "", "", timing),
  normalizeTtsSettings,
  enqueueAudio: enqueueVocabSetAudio,
  enrichStudentNames,
  omitSensitiveSessionFields,
  logAudit: logAuditAction,
});
app.use(
  "/api",
  createVocabularyRouter({
    authenticateUser,
    requireStaff: requireRole(["teacher", "super_admin"]),
    ttsRateLimit,
    createApiTiming,
    sendApiError,
    service: vocabularyService,
  }),
);

const grammarLibraryRepository = createGrammarLibraryRepository({ db: adminDb });
const grammarLibraryService = createGrammarLibraryService({
  repository: grammarLibraryRepository,
  canViewSet: canViewGrammarSet,
  canManageSet: canManageGrammarSet,
  getVisibility: getGrammarVisibility,
  sanitizeForStudent: sanitizeGrammarSetForStudent,
  normalizeForSave: normalizeGrammarSetForSave,
  makeId,
  enrichStudentNames,
  logAudit: logAuditAction,
});
app.use(
  "/api",
  createGrammarLibraryRouter({
    authenticateUser,
    requireStaff: requireRole(["teacher", "super_admin"]),
    sendApiError,
    service: grammarLibraryService,
  }),
);

const grammarAttemptRepository = createGrammarAttemptRepository({
  db: adminDb,
  appendLearningHistoryProjection,
  projectGrammarAttempt,
  detailRetentionDays: ATTEMPT_DETAIL_RETENTION_DAYS,
});
const grammarAttemptService = createGrammarAttemptService({
  repository: grammarAttemptRepository,
  lazySessionEnabled: LAZY_SESSION_V3_ENABLED,
  gradingVersion: GRAMMAR_TEXT_GRADING_VERSION,
  getClientRunCredentials,
  getActor: getGrammarActor,
  canOpenSet: canOpenGrammarSetForLearning,
  canAccessAttempt: canAccessGrammarAttempt,
  canManageSet: canManageGrammarSet,
  buildPreparedAttempt: buildPreparedGrammarAttempt,
  buildAttemptAnswer: buildGrammarAttemptAnswer,
  buildAnswerFeedback: buildGrammarAnswerFeedback,
  sanitizeAttempt: sanitizeAttemptForStudent,
  sanitizeAnswer: sanitizeGrammarAnswerForStudent,
  deterministicRunDocumentId,
  getSetVersion: getGrammarSetVersion,
  safeText,
  makeId,
  fisherYates,
  getQuestionType: getGrammarQuestionType,
  getLessonGradeClass,
  createSessionToken,
  hashSessionToken,
  normalizeTextAnswer: normalizeGrammarTextAnswer,
  isTextAnswerCorrect: isGrammarTextAnswerCorrect,
  grammarAttemptToLeaderboardEvent,
  clearLeaderboardCache: () => publicLeaderboardSummaryCache.clear(),
});
app.use(
  "/api",
  createGrammarAttemptRouter({
    authenticateOptionalUser,
    createApiTiming,
    sendApiError,
    service: grammarAttemptService,
  }),
);

const vocabularyRunRepository = createVocabularyRunRepository({
  db: adminDb,
  appendLearningHistoryProjection,
  projectVocabularyAttempt,
  detailRetentionDays: ATTEMPT_DETAIL_RETENTION_DAYS,
});
const vocabularyRunService = createVocabularyRunService({
  repository: vocabularyRunRepository,
  lazySessionEnabled: LAZY_SESSION_V3_ENABLED,
  activityTtlDays: ACTIVITY_TTL_DAYS,
  getClientRunCredentials,
  resolveStartContext: resolveGameSessionStartContext,
  buildSessionRecord: buildGameSessionRecord,
  deterministicRunDocumentId,
  canResumeClientRun,
  canUpdateSession: canUpdateGameSession,
  supportsIncrementalSession: supportsIncrementalGameSession,
  hashSessionToken,
  omitSensitiveFields: omitSensitiveSessionFields,
  sanitizeSubmittedActions: sanitizeSubmittedGameActions,
  sanitizeAction: sanitizeGameAction,
  dedupeStoredActions: dedupeStoredGameActions,
  gradeSession: gradeGameSessionV2,
  sessionToLeaderboardEvent: gameSessionToLeaderboardEvent,
  addDaysIso,
  clearLeaderboardCache: () => publicLeaderboardSummaryCache.clear(),
  getSessionActor: getGameSessionActor,
  createSessionToken,
  safeText,
  randomUUID: crypto.randomUUID,
});
app.use(
  "/api",
  createVocabularyRunRouter({
    authenticateOptionalUser,
    createApiTiming,
    sendApiError,
    service: vocabularyRunService,
  }),
);

const resultsRepository = createResultsRepository({
  db: adminDb,
  loadLeaderboardEvents: loadLeaderboardEventsFromSources,
  loadReadyLeaderboardEvents,
  resolveListeningDetail: resolveListeningActivityDetailForStaff,
});
const allowLegacyLeaderboardFallback = process.env.NODE_ENV !== "production"
  && process.env.LEADERBOARD_ALLOW_LEGACY_FALLBACK !== "false";
if (process.env.NODE_ENV === "production" && process.env.LEADERBOARD_ALLOW_LEGACY_FALLBACK === "true") {
  throw new Error("LEADERBOARD_ALLOW_LEGACY_FALLBACK must not be enabled in production.");
}
const resultsService = createResultsService({
  repository: resultsRepository,
  activityTtlMs: ACTIVITY_TTL_MS,
  maxResultLimit: MAX_ACTIVITY_RESULT_LIMIT,
  safeText,
  parseResultLimit: parseActivityResultLimit,
  getActivityTime,
  isExpiredActivity,
  setUniqueClass,
  normalizePersonName,
  getLessonGradeClass,
  grammarAttemptToActivity,
  listeningAttemptToActivity,
  enrichStudentNames,
  sanitizePublicStudentRecord,
  sanitizeActivityDetail,
  toActivitySummary,
  canViewResultSession,
  canViewGrammarActivity,
  buildLeaderboard,
  getCachedLeaderboardSummary: key => publicLeaderboardSummaryCache.get(key),
  cacheLeaderboardSummary: cachePublicLeaderboardSummary,
  allowLegacyLeaderboardFallback,
  resolveLearningLeaderboardScope: async (request, timing) => {
    const vocabSetId = safeText(request.query?.vocabSetId, 180);
    const assignmentId = safeText(request.query?.assignmentId, 180);
    const accessToken = safeText(request.headers?.["x-vocab-share-token"], 200);
    if (accessToken) {
      const access = await resolveVocabLearningAccess(accessToken, vocabSetId, assignmentId, timing);
      if (!access) return null;
      return {
        vocabSetId: access.set.id,
        ...(access.assignment?.classId ? { classId: access.assignment.classId } : {}),
      };
    }
    if (!vocabSetId || assignmentId) return null;
    const setDoc = await adminDb.collection("vocab_sets").doc(vocabSetId).get();
    timing?.mark("vocab_point_read");
    if (!setDoc.exists) return null;
    const set = { id: setDoc.id, ...setDoc.data() };
    if (isArchivedRecord(set) || getVocabVisibility(set) !== "public") return null;
    return { vocabSetId: set.id };
  },
});
app.use(
  "/api",
  createResultsRouter({
    authenticateUser,
    requireStaff: requireRole(["teacher", "super_admin"]),
    publicLeaderboardRateLimit,
    createApiTiming,
    sendApiError,
    service: resultsService,
  }),
);

const guestIdentityRepository = createGuestIdentityRepository({ db: adminDb });
const guestIdentityService = createGuestIdentityService({
  repository: guestIdentityRepository,
  safeText,
  validateDisplayName: validateStudentDisplayName,
  normalizePersonName,
  createSessionToken,
  hashSessionToken,
  omitCapabilitySecrets: omitGuestCapabilitySecrets,
  invalidateStudentNameCache: invalidateCanonicalStudentNameCache,
  createHttpError,
  activityTouchIntervalMs: Math.max(
    60_000,
    Number(process.env.GUEST_ACTIVITY_TOUCH_INTERVAL_MS || 5 * 60_000),
  ),
});
const {
  findExistingGuestIdentity,
  getGuestProfileId,
  isGuestOwnedRecord,
  resolveGuestProfile,
} = guestIdentityService;
app.use(
  "/api",
  createGuestIdentityRouter({
    rateLimit: guestIdentityRateLimit,
    createApiTiming,
    sendApiError,
    service: guestIdentityService,
  }),
);

const authProfileRepository = createAuthProfileRepository({ db: adminDb });
const authProfileProvider = createAuthProfileProvider({
  apiKey: process.env.FIREBASE_WEB_API_KEY || process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || "",
  auth: adminAuth,
});
const authProfileService = createAuthProfileService({
  repository: authProfileRepository,
  provider: authProfileProvider,
  normalizePhone: normalizePhoneE164,
  normalizeEmail,
  validateDisplayName: validateStudentDisplayName,
  invalidateStudentNameCache: invalidateCanonicalStudentNameCache,
  consumePhoneAttempt: key => phoneAuthRateLimit.consume(key),
});
app.use(
  "/api",
  createAuthProfileRouter({
    authenticateUser,
    getRequestNetworkKey,
    sendApiError,
    service: authProfileService,
  }),
);

const accountRepository = createAccountRepository({ db: adminDb });
const accountService = createAccountService({
  repository: accountRepository,
  isSuperAdmin,
  getManageableGuestIds: getManageableGuestProfileIdsForTeacher,
  canManageGuestProfile,
  omitGuestCapabilitySecrets,
  getGuestProfileId,
  validateDisplayName: validateStudentDisplayName,
  normalizePersonName,
  invalidateStudentNameCache: invalidateCanonicalStudentNameCache,
  createSessionToken,
  hashSessionToken,
  updateAuthDisplayName: (userId, displayName) => adminAuth.updateUser(userId, { displayName }).then(() => undefined),
  setAuthRoleClaim: (userId, role) => adminAuth.setCustomUserClaims(userId, { role }),
  logAudit: logAuditAction,
});
app.use(
  "/api",
  createAccountRouter({
    authenticateUser,
    requireStaff: requireRole(["teacher", "super_admin"]),
    requireSuperAdmin: requireRole(["super_admin"]),
    sendApiError,
    service: accountService,
  }),
);

app.use(
  "/api/my-learning-history",
  createLearningHistoryRouter({
    enabled: LEARNING_HISTORY_ENABLED,
    authenticateOptionalUser,
    slowRequestMs: SLOW_API_LOG_MS,
    canStaffViewAttempt: canStaffViewLearningAttempt
  })
);

app.use(
  "/api/listening-library",
  createListeningLibraryRouter()
);

app.use(
  "/api/image-library",
  createVocabImageRouter({
    service: vocabImageLibraryService,
    authenticateUser,
    requireStaff: requireRole(["teacher", "super_admin"]),
    logAudit: logAuditAction,
  })
);

const adminDataRepository = createAdminDataRepository({
  db: adminDb,
  storageMode: process.env.STORAGE_MODE,
});
const adminDataService = createAdminDataService({
  repository: adminDataRepository,
  db: adminDb,
  canViewVocabSet,
  canViewGrammarSet,
  sanitizeVocabSet: (record) => stripPrivateVocabSetFields(normalizeVocabSetForRead(record)),
  loadDashboardActivity: async (actor) => {
    const [recentActivities, leaderboardSummary] = await Promise.all([
      resultsService.loadScopedRecentActivitySummaries(actor, MAX_ACTIVITY_RESULT_LIMIT),
      resultsService.getAdminLeaderboardSummary({
        user: actor,
        query: { period: "week", category: "gold", page: 1, pageSize: 5 },
      }),
    ]);
    const goldRows = leaderboardSummary.body.entries;
    return {
      total: recentActivities.length,
      recentActivities: recentActivities.slice(0, 30),
      goldRows,
    };
  },
  prepareAssignment: (record) => ensureAssignmentShareToken(
    record,
    adminDb.collection("assignments").doc(String(record.id || ""))
  ),
  loadAccountsPage: accountService.loadAdminAccountsPage,
  loadAuditPage: accountService.loadAdminAuditLogPage,
});
app.use(
  "/api/admin",
  createAdminDataRouter({
    authenticateUser,
    service: adminDataService,
  })
);

const classManagementRepository = createClassManagementRepository({ db: adminDb });
const classManagementService = createClassManagementService({
  repository: classManagementRepository,
  canViewClass,
  canManageClass,
  isArchivedRecord,
  logAudit: logAuditAction,
});
app.use(
  "/api",
  createClassManagementRouter({
    authenticateUser,
    requireStaff: requireRole(["teacher", "super_admin"]),
    sendApiError,
    service: classManagementService,
  })
);

const assignmentManagementRepository = createAssignmentManagementRepository({ db: adminDb });
const assignmentManagementService = createAssignmentManagementService({
  repository: assignmentManagementRepository,
  canManageClass,
  canManageAssignment,
  canViewVocabSet,
  getVocabVisibility,
  createShareToken,
  logAudit: logAuditAction,
});
app.use(
  "/api",
  createAssignmentManagementRouter({
    authenticateUser,
    requireStaff: requireRole(["teacher", "super_admin"]),
    sendApiError,
    service: assignmentManagementService,
  })
);

app.use(
  "/api/listening",
  createMoverLegacyRouter({
    db: adminDb,
    authenticateUser,
    authenticateOptionalUser,
    requireStaff: requireRole(["teacher", "super_admin"]),
    mediaDir: LISTENING_MEDIA_DIR,
    mediaPublicPrefix: LISTENING_MEDIA_PUBLIC_PREFIX,
    ticketSecret: LISTENING_TICKET_SECRET,
    resolveGuestProfile,
    logAudit: logAuditAction,
    smartImport: {
      enabled: process.env.LISTENING_SMART_IMPORT_ENABLED !== "false",
      reason: process.env.LISTENING_SMART_IMPORT_ENABLED === "false"
        ? "Smart Import đã bị tắt bằng cấu hình máy chủ."
        : undefined,
      analyzeVision: (STALI_API_KEY || DEVQUOTA_API_KEY)
        ? generateAiVisionJson
        : undefined,
      providers: [
        ...STALI_SMART_IMPORT_PROVIDERS,
        ...DEVQUOTA_SMART_IMPORT_PROVIDERS,
      ]
    }
  })
);

app.use(
  "/api/mover-reading-writing",
  createMoverReadingWritingRouter({
    db: adminDb,
    authenticateUser,
    authenticateOptionalUser,
    requireStaff: requireRole(["teacher", "super_admin"]),
    ticketSecret: LISTENING_TICKET_SECRET,
    mediaDir: LISTENING_MEDIA_DIR,
    resolveGuestProfile,
    logAudit: logAuditAction,
    smartImport: {
      enabled: process.env.LISTENING_SMART_IMPORT_ENABLED !== "false",
      reason: process.env.LISTENING_SMART_IMPORT_ENABLED === "false"
        ? "Smart Import đã bị tắt bằng cấu hình máy chủ."
        : undefined,
      analyzeVision: (STALI_API_KEY || DEVQUOTA_API_KEY)
        ? generateAiVisionJson
        : undefined,
      providers: [
        ...STALI_SMART_IMPORT_PROVIDERS,
        ...DEVQUOTA_SMART_IMPORT_PROVIDERS,
      ],
    },
  })
);

app.use(
  "/api/exam-platform",
  createExamRouter({
    db: adminDb,
    authenticateUser,
    authenticateOptionalUser,
    requireStaff: requireRole(["teacher", "super_admin"]),
    ticketSecret: `${LISTENING_TICKET_SECRET}:exam-platform-v1`,
    resolveGuestProfile,
    logAudit: logAuditAction,
    writingGrading: {
      providers: getWritingGradingProviders(WRITING_GRADING_CONFIG),
      grade: (input, options) => gradeWritingWithProvider(input, { ...WRITING_GRADING_CONFIG, onAttempt: options?.onAttempt }),
    },
  })
);

// Public result and leaderboard routes are mounted through createResultsRouter above.
async function resolveGameSessionStartContext(req: express.Request, payload: any, timing?: ReturnType<typeof createApiTiming>) {
  let actor = getGameSessionActor(req, payload);
  if (!actor) throw createHttpError(401, "Student identity is required to start a game session.");
  if (actor.ownerType === "guest") {
    const profile = await resolveGuestProfile(actor.guestId, actor.studentName, true, {
      classId: payload.classId,
      className: payload.className
    }, timing);
    actor = { ...actor, studentName: profile.displayName || profile.name };
  }
  timing?.mark("identity");

  const vocabSetId = safeText(payload.vocabSetId, 160);
  const gameId = safeText(payload.gameId, 120);
  if (!vocabSetId || !gameId) throw createHttpError(400, "vocabSetId and gameId are required.");
  if (!SESSION_V2_GAME_IDS.has(gameId)) throw createHttpError(400, "Game khong duoc ho tro.");

  let assignment: any = null;
  let access: Awaited<ReturnType<typeof resolveVocabLearningAccess>> = null;
  const accessToken = getRequestVocabShareToken(req);
  if (accessToken) {
    access = await resolveVocabLearningAccess(accessToken, vocabSetId, safeText(payload.assignmentId, 160), timing);
    if (!access) throw createHttpError(403, "Link khong co quyen tao luot hoc nay.");
    assignment = access.assignment;
  } else if (payload.assignmentId) {
    const assignmentDoc = await adminDb.collection("assignments").doc(String(payload.assignmentId)).get();
    assignment = assignmentDoc.exists ? { id: assignmentDoc.id, ...assignmentDoc.data() } : null;
    if (!assignment) {
      const assignmentsSnapshot = await adminDb.collection("assignments").get();
      assignmentsSnapshot.forEach(doc => {
        const data = { id: doc.id, ...doc.data() };
        if (!assignment && data.id === String(payload.assignmentId)) assignment = data;
      });
    }
  }
  timing?.mark("access");

  let vocabSet = access?.set || null;
  if (!vocabSet) {
    const vocabDoc = await adminDb.collection("vocab_sets").doc(vocabSetId).get();
    if (!vocabDoc.exists) throw createHttpError(404, "Vocabulary set not found.");
    vocabSet = { id: vocabDoc.id, ...vocabDoc.data() };
  }
  timing?.mark("set_read");

  if (assignment) {
    if (assignment.vocabSetId !== vocabSetId || !isAssignmentOpenForLearning(assignment, vocabSet)) {
      throw createHttpError(403, "Assignment is not available for this vocabulary set.");
    }
    if (!req.user && !accessToken) {
      throw createHttpError(403, "Link giao bai khong hop le hoac da het quyen truy cap.");
    }
    if (assignment.gameId && assignment.gameId !== gameId) {
      throw createHttpError(403, "Game khong dung voi bai giao.");
    }
  } else if (access?.accessType === "vocab_set") {
    if (access.set.id !== vocabSetId || getVocabVisibility(vocabSet) !== "assignment") {
      throw createHttpError(403, "Link khong co quyen tao luot hoc nay.");
    }
  } else if (!canViewVocabSet(req.user, vocabSet)) {
    throw createHttpError(403, "Ban khong co quyen bat dau game voi bo tu nay.");
  }

  let inferredClass: any = null;
  if (!assignment && payload.vocabSetId) {
    const assignmentsSnapshot = await adminDb.collection("assignments")
      .where("vocabSetId", "==", payload.vocabSetId)
      .get();
    const uniqueBySet = new Map<string, any | null>();
    assignmentsSnapshot.forEach(doc => {
      const data = { id: doc.id, ...doc.data() };
      setUniqueClass(uniqueBySet, data.vocabSetId, {
        classId: data.classId,
        className: data.className || ""
      });
    });
    inferredClass = uniqueBySet.get(payload.vocabSetId) || null;
  }
  timing?.mark("class_resolve");

  const privateSnapshot = buildGameSessionSnapshot(vocabSet, gameId, payload.itemOrder);
  return { actor, assignment, access, vocabSet, vocabSetId, gameId, inferredClass, privateSnapshot };
}

function buildGameSessionRecord(context: any, payload: any, options: {
  id: string;
  sessionTokenHash: string;
  schemaVersion: 2 | 3;
  clientRunId?: string;
  startedAt?: string;
}) {
  const now = new Date().toISOString();
  const startedAt = normalizeClientStartedAt(options.startedAt, now);
  const { actor, assignment, access, vocabSet, vocabSetId, gameId, inferredClass, privateSnapshot } = context;
  return {
    id: options.id,
    ownerKey: actor.ownerKey,
    ownerType: actor.ownerType,
    userId: actor.userId,
    studentId: actor.studentId,
    guestId: actor.guestId,
    assignmentId: safeText(assignment?.id || "", 160),
    assignmentVerified: Boolean(assignment?.id),
    assignmentTitle: safeText(assignment?.title || assignment?.name || "", 300),
    assignmentDueAt: assignment?.dueDate || assignment?.dueAt || "",
    vocabSetId,
    vocabSetTitle: safeText(
      options.schemaVersion === 2 ? payload.vocabSetTitle : (payload.vocabSetTitle || vocabSet.title),
      240
    ),
    gameId,
    gameName: safeText(payload.gameName, 160),
    gameType: safeText(payload.gameType, 80),
    studentName: actor.studentName,
    classId: safeText(assignment?.classId || vocabSet.classId || inferredClass?.classId || getLessonGradeClass(vocabSet).classId || "", 160),
    className: safeText(assignment?.className || vocabSet.className || inferredClass?.className || getLessonGradeClass(vocabSet).className || "", 160),
    startedAt,
    createdAt: now,
    activatedAt: options.schemaVersion === 3 ? now : undefined,
    clientRunId: options.clientRunId || undefined,
    status: "started",
    submissionStatus: "pending",
    schemaVersion: options.schemaVersion,
    gradingMode: gameId.startsWith("flashcard-") ? "server-self-report" : "server",
    actionPersistence: options.schemaVersion === 3 && gameId !== "speaking-ai"
      ? "submit_batch"
      : getGameActionPersistence(gameId, privateSnapshot),
    privateSnapshot,
    lastSavedAt: now,
    score: 0,
    totalQuestions: 0,
    correctAnswers: 0,
    incorrectAnswers: 0,
    sessionTokenHash: options.sessionTokenHash
  };
}

function canResumeClientRun(req: express.Request, session: any, runSecret: string) {
  return canUpdateGameSession(req, session, { sessionToken: runSecret, guestId: session.guestId });
}

function supportsIncrementalGameSession(session: any) {
  const schemaVersion = Number(session?.schemaVersion || 1);
  return schemaVersion === 2 || (schemaVersion === 3 && session?.gameId === "speaking-ai");
}

// Vocabulary learning-run and pronunciation routes are mounted through createVocabularyRunRouter above.
// Result detail, scoped result, and leaderboard routes are mounted through createResultsRouter above.
// SUPER ADMIN EXCLUSIVE INTERFACES
// ============================================================================

// Account, guest-profile, and audit routes are mounted through createAccountRouter above.
// VITE OR STATIC SERVING MIDDLEWARE
// ============================================================================

async function start() {
  await firebaseDiagnosticReady;

  const seedDataEnabled = String(process.env.SEED_DATA_ENABLED || "").toLowerCase() === "true";
  if (process.env.NODE_ENV === "production" && seedDataEnabled) {
    throw new Error("SEED_DATA_ENABLED must be false in production.");
  }
  if (seedDataEnabled) {
    await preSeedDb();
  } else {
    console.log("[Startup] Seed data disabled.");
  }

  app.use("/api", (_req, res) => {
    res.status(404).set("Cache-Control", "no-store").json({ error: "Not found" });
  });

  if (process.env.NODE_ENV !== "production") {
    // Start Vite in middleware mode
    const viteMode = process.env.VITE_MODE?.trim() || undefined;
    const vite = await createViteServer({
      ...(viteMode ? { mode: viteMode } : {}),
      define: {
        'import.meta.env.VITE_LOCAL_AUTH_BYPASS_ENABLED': JSON.stringify(
          process.env.VITE_LOCAL_AUTH_BYPASS_ENABLED === "true" ? "true" : "false"
        ),
      },
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development server loaded as middleware.");
  } else {
    // Production serving static files
    const distPath = path.join(process.cwd(), "dist", "client");
    app.use("/assets", express.static(path.join(distPath, "assets"), {
      immutable: true,
      maxAge: "365d",
    }));
    app.use("/assets", (_req, res) => res.status(404).set("Cache-Control", "no-store").type("text/plain").send("Not found"));
    app.use(express.static(distPath, {
      index: false,
      maxAge: "1h",
    }));
    app.get("*", (req, res) => {
      if (!isSpaNavigationRequest(req.path, req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "")) {
        return res.status(404).set("Cache-Control", "no-store").type("text/plain").send("Not found");
      }
      res.set("Cache-Control", "no-cache");
      return res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Production static build routing active.");
  }

  const httpServer = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });

  let shuttingDown = false;
  const gracefulShutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[Shutdown] ${signal} received; closing HTTP and storage.`);
    httpServer.close(async (error) => {
      try {
        await shutdownStorage();
      } finally {
        if (error) {
          console.error("[Shutdown] HTTP close failed", error);
          process.exitCode = 1;
        }
      }
    });
  };
  process.once("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.once("SIGINT", () => gracefulShutdown("SIGINT"));
}

type VocabVisibility = "public" | "assignment" | "draft";

function getVocabVisibility(set: any): VocabVisibility {
  if (set?.visibility === "assignment" || set?.visibility === "public" || set?.visibility === "draft") {
    return set.visibility;
  }
  if (set?.status === "private") return "assignment";
  if (set?.status === "public") return "public";
  return "draft";
}

function toLegacyStatus(visibility: VocabVisibility): "public" | "private" | "draft" {
  return visibility === "assignment" ? "private" : visibility;
}

function createShareToken() {
  return crypto.randomBytes(16).toString("hex");
}

function normalizePersonName(value: any) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ");
}

function setUniqueClass(
  map: Map<string, any | null>,
  key: string,
  classInfo: any
) {
  if (!key || !classInfo?.classId) return;
  const existing = map.get(key);
  if (!existing) {
    if (!map.has(key)) map.set(key, classInfo);
    return;
  }

  if (existing.classId !== classInfo.classId) {
    map.set(key, null);
  }
}

function normalizeAudioUrlForClient(value: any) {
  const audioUrl = safeText(value, 1000);
  if (!audioUrl) return "";
  if (audioUrl.startsWith(`${AUDIO_PUBLIC_PREFIX}/`)) return audioUrl;
  if (/^https:\/\/[^\s]+$/i.test(audioUrl)) return audioUrl;
  return "";
}

function stripPrivateVocabSetFields(set: any) {
  const items = Array.isArray(set?.items)
    ? set.items.map((item: any) => {
        const { audioPath, ...publicItem } = item || {};
        return publicItem;
      })
    : [];
  return {
    ...set,
    items
  };
}

function normalizeVocabSetForRead(set: any) {
  const visibility = getVocabVisibility(set);
  return {
    ...set,
    visibility,
    status: toLegacyStatus(visibility)
  };
}

function normalizeVocabItemForSave(item: any, index: number, errors: string[]) {
  const id = safeText(item?.id, 160) || makeId(`item-${index + 1}`);
  const term = safeText(item?.term, 160);
  const meaning = safeText(item?.meaning, 500);
  if (!term) errors.push(`Dong ${index + 1}: missing English word.`);
  if (!meaning) errors.push(`Dong ${index + 1}: missing Vietnamese meaning.`);

  const audioUrl = normalizeAudioUrlForClient(item?.audioUrl);
  if (item?.audioUrl && !audioUrl) {
    errors.push(`Dong ${index + 1}: invalid audio URL.`);
  }

  const ttsProvider = safeText(item?.ttsProvider, 40).toLowerCase();
  if (ttsProvider && !SUPPORTED_TTS_PROVIDERS.has(ttsProvider)) {
    errors.push(`Dong ${index + 1}: unsupported TTS provider.`);
  }

  const ttsLang = safeText(item?.ttsLang, 20);
  if (ttsLang && ttsLang !== "en-US" && ttsLang !== "en-GB") {
    errors.push(`Dong ${index + 1}: invalid TTS language.`);
  }

  const rawSpeed = Number(item?.ttsSpeed);
  const ttsSpeed = Number.isFinite(rawSpeed) ? Math.min(1.5, Math.max(0.5, rawSpeed)) : undefined;
  const audioHash = safeText(item?.audioHash, 128);
  if (audioHash && !/^[a-f0-9]{64}$/i.test(audioHash)) {
    errors.push(`Dong ${index + 1}: invalid audio hash.`);
  }

  const status = safeText(item?.audioStatus, 20);
  const audioStatus = ["missing", "queued", "generating", "ready", "failed"].includes(status) ? status : undefined;
  const normalized: any = {
    id,
    term,
    meaning,
    ipa: safeText(item?.ipa, 120),
    pos: safeText(item?.pos, 120),
    example: safeText(item?.example, 1000),
    exampleMeaning: safeText(item?.exampleMeaning, 1000),
    displayOrder: Number.isFinite(Number(item?.displayOrder)) ? Number(item.displayOrder) : index + 1
  };

  const imageAssetId = safeText(item?.imageAssetId, 80);
  const imageUrl = safeText(item?.imageUrl, 1000);
  if (imageAssetId) {
    if (!MANAGED_VOCAB_IMAGE_ASSET_ID.test(imageAssetId) || !MANAGED_VOCAB_IMAGE_URL.test(imageUrl)) {
      errors.push(`Dong ${index + 1}: invalid managed image metadata.`);
    } else {
      try {
        normalized.imageAssetId = imageAssetId;
        normalized.imageUrl = imageUrl;
        normalized.imageAttribution = vocabImageAttributionFromAsset(item?.imageAttribution);
        normalized.imageAttachedAt = safeText(item?.imageAttachedAt, 80) || new Date().toISOString();
      } catch {
        errors.push(`Dong ${index + 1}: invalid image attribution.`);
      }
    }
  } else if (imageUrl) {
    // Compatibility path for images that were already stored before managed assets existed.
    normalized.imageUrl = imageUrl;
  }

  if (audioUrl) normalized.audioUrl = audioUrl;
  if (audioHash) normalized.audioHash = audioHash;
  if (audioStatus) normalized.audioStatus = audioStatus;
  if (item?.audioError) normalized.audioError = safeText(item.audioError, 500);
  if (Array.isArray(item?.audioWarnings)) normalized.audioWarnings = item.audioWarnings.map((warning: any) => safeText(warning, 200)).filter(Boolean).slice(0, 5);
  if (item?.audioGeneratedAt) normalized.audioGeneratedAt = safeText(item.audioGeneratedAt, 80);
  if (item?.audioUpdatedAt) normalized.audioUpdatedAt = safeText(item.audioUpdatedAt, 80);
  if (ttsProvider) normalized.ttsProvider = ttsProvider;
  if (item?.ttsVoice) normalized.ttsVoice = safeText(item.ttsVoice, 200);
  if (ttsLang) normalized.ttsLang = ttsLang;
  if (ttsSpeed !== undefined) normalized.ttsSpeed = ttsSpeed;
  if (item?.ttsText) normalized.ttsText = safeText(item.ttsText, 160);
  if (item?.notes) normalized.notes = safeText(item.notes, 1000);

  return normalized;
}

function normalizeVocabSetForSave(payload: any, existing: any = {}) {
  const merged = {
    ...existing,
    ...payload
  };
  const errors: string[] = [];
  const items = (Array.isArray(merged.items) ? merged.items : [])
    .slice(0, 500)
    .map((item: any, index: number) => normalizeVocabItemForSave(item, index, errors))
    .sort((a: any, b: any) => a.displayOrder - b.displayOrder)
    .map((item: any, index: number) => ({ ...item, displayOrder: index + 1 }));

  if (items.length === 0) errors.push("Vocabulary set needs at least one valid item.");
  if (errors.length > 0) throw createHttpError(400, errors.join(" "), errors);

  const ttsSettings = merged.ttsSettings ? normalizeTtsSettings(merged.ttsSettings) : undefined;
  const visibility = getVocabVisibility(merged);
  const normalized = {
    ...merged,
    title: safeText(merged.title, 240),
    description: safeText(merged.description, 2000),
    subject: safeText(merged.subject || "General English", 120),
    gradeLevel: safeText(merged.gradeLevel || "Lớp 3", 80),
    tags: Array.isArray(merged.tags) ? merged.tags.map((tag: any) => safeText(tag, 60)).filter(Boolean).slice(0, 12) : [],
    items,
    ...(ttsSettings ? { ttsSettings } : {}),
    visibility,
    status: toLegacyStatus(visibility)
  };

  if (visibility === "assignment") {
    normalized.shareToken = existing.shareToken || existing.assignmentSlug || createShareToken();
    normalized.assignmentSlug = normalized.shareToken;
  } else {
    delete normalized.shareToken;
    delete normalized.assignmentSlug;
  }

  return normalized;
}

type GrammarVisibility = "public" | "assignment" | "draft";

function getGrammarVisibility(set: any): GrammarVisibility {
  if (set?.visibility === "assignment" || set?.visibility === "public" || set?.visibility === "draft") {
    return set.visibility;
  }
  if (set?.status === "private") return "assignment";
  if (set?.status === "public") return "public";
  return "draft";
}

function getGrammarShareToken(set: any) {
  return String(set?.shareToken || set?.assignmentSlug || "").replace(/^grammar-/, "").trim();
}

function getRequestShareToken(req: express.Request) {
  const raw = req.body?.shareToken || req.body?.accessToken || req.query?.shareToken || req.headers["x-grammar-share-token"];
  return String(raw || "").replace(/^grammar-/, "").trim();
}

function getGuestIdentityInput(req: express.Request) {
  const guestId = safeText(req.body?.guestId || req.query?.guestId || req.headers["x-guest-id"], 120);
  const studentName = req.body?.studentName || req.query?.studentName;
  if (!guestId) return null;
  return { guestId, studentName };
}

function toGuestActor(profile: any) {
  return {
    id: profile.guestId || profile.id,
    name: profile.displayName || profile.name,
    email: "",
    role: "student" as const,
    status: "active" as const,
    createdAt: profile.createdAt || new Date().toISOString(),
    isGuest: true
  };
}

async function getGrammarActor(req: express.Request) {
  if ((req as any).authBlocked) return null;
  if (req.user) return { ...req.user, name: req.user.name || "Học sinh", isGuest: false };
  const input = getGuestIdentityInput(req);
  if (!input) return null;

  const existingProfile = await findExistingGuestIdentity(input.guestId);
  if (existingProfile) return toGuestActor(existingProfile);

  const validation = validateStudentDisplayName(input.studentName);
  if (!validation.valid) return null;
  const profile = await resolveGuestProfile(input.guestId, validation.value);
  return toGuestActor(profile);
}

function canOpenGrammarSetForLearning(set: any, actor: any, req: express.Request) {
  if (!set || !actor) return false;
  if (!actor.isGuest && (actor.role === "teacher" || actor.role === "super_admin")) return true;
  const visibility = getGrammarVisibility(set);
  if (visibility === "public") return true;
  if (visibility !== "assignment") return false;
  const expectedToken = getGrammarShareToken(set);
  const requestToken = getRequestShareToken(req);
  return Boolean(expectedToken && requestToken && expectedToken === requestToken);
}

function canAccessGrammarAttempt(attempt: any, actor: any, set: any, req: express.Request, allowStaffReview = false) {
  if (!attempt || !actor) return false;
  if (!actor.isGuest && allowStaffReview && (actor.role === "super_admin" || canManageGrammarSet(actor, set))) return true;
  if (!actor.isGuest) {
    return attempt.userId === actor.id || attempt.studentId === actor.id;
  }

  const sameGuest = attempt.guestId === actor.id || attempt.userId === actor.id || attempt.studentId === actor.id;
  if (!sameGuest) return false;

  const attemptToken = getRequestGrammarAttemptToken(req);
  if (attempt.attemptTokenHash) {
    return Boolean(attemptToken && hashSessionToken(attemptToken) === attempt.attemptTokenHash);
  }

  // Legacy compatibility for attempts created before guest attempt tokens existed.
  return true;
}

function safeText(value: any, max = 2000) {
  return String(value || "").normalize("NFKC").trim().slice(0, max);
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
}

function fisherYates<T>(input: T[]) {
  const items = [...input];
  for (let i = items.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function seededUnitInterval(seed: string, index: number) {
  const digest = crypto.createHash("sha256").update(`${seed}:${index}`).digest();
  return digest.readUInt32BE(0) / 0x100000000;
}

function deterministicShuffle<T>(input: T[], seed: string) {
  const items = [...input];
  let randomIndex = 0;
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(seededUnitInterval(seed, randomIndex++) * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function getGrammarSetVersion(set: any) {
  return safeText(set?.updatedAt || set?.createdAt || set?.id, 160);
}

function buildPreparedGrammarAttempt(set: any, actor: any, payload: any, clientRunId: string, runSecret: string) {
  const grammarSetVersion = getGrammarSetVersion(set);
  const isAssignment = getGrammarVisibility(set) === "assignment";
  const questionSeed = `${clientRunId}:${set.id}:${grammarSetVersion}:questions`;
  const questions = set.shuffleQuestions
    ? deterministicShuffle(set.questions || [], questionSeed)
    : [...(set.questions || [])];
  const attemptQuestions = questions.map((question: any, index: number) => {
    const questionType = getGrammarQuestionType(question.questionType, getGrammarQuestionType(set.questionType));
    const optionSeed = `${clientRunId}:${question.id}:${grammarSetVersion}:options`;
    const options = questionType === "multiple_choice" && set.shuffleOptions
      ? deterministicShuffle(question.options || [], optionSeed)
      : [...(question.options || [])];
    return {
      id: deterministicRunDocumentId("grammar-attempt-question", [clientRunId, set.id, question.id]),
      questionId: question.id,
      questionType,
      displayPosition: index + 1,
      optionOrder: options.map((option: any) => option.id),
      questionSnapshot: question.questionText,
      explanationSnapshot: question.explanation,
      scoreSnapshot: question.score,
      optionsSnapshot: options,
      correctOptionId: questionType === "multiple_choice" ? question.correctOptionId : "",
      correctAnswerSnapshot: questionType === "rewrite" ? question.correctAnswer : "",
      acceptedAnswersSnapshot: questionType === "rewrite" && Array.isArray(question.acceptedAnswers)
        ? [...question.acceptedAnswers]
        : []
    };
  });
  const now = new Date().toISOString();
  const startedAt = normalizeClientStartedAt(payload.startedAt, now);
  const attemptId = deterministicRunDocumentId("grammar-attempt-v2", [actor.id, set.id, clientRunId]);
  return {
    id: attemptId,
    grammarSetId: set.id,
    grammarSetTitle: set.title,
    grammarSetVersion,
    assignmentId: isAssignment ? safeText(set.id, 160) : "",
    assignmentVerified: isAssignment,
    assignmentTitle: isAssignment ? safeText(set.title, 300) : "",
    assignmentDueAt: isAssignment ? (set.dueDate || set.dueAt || "") : "",
    userId: actor.id,
    studentId: actor.id,
    guestId: actor.isGuest ? actor.id : "",
    studentName: actor.name,
    classId: set.classId || getLessonGradeClass(set).classId || "",
    className: set.className || getLessonGradeClass(set).className || "",
    status: "prepared",
    submissionStatus: "pending",
    schemaVersion: 2,
    clientRunId,
    score: 0,
    maxScore: attemptQuestions.reduce((sum: number, question: any) => sum + Number(question.scoreSnapshot || 1), 0),
    correctCount: 0,
    wrongCount: 0,
    unansweredCount: attemptQuestions.length,
    startedAt,
    createdAt: now,
    questions: attemptQuestions,
    answers: [],
    reviewPolicySnapshot: {
      showReviewAfterSubmit: set.showReviewAfterSubmit !== false,
      showExplanationImmediately: Boolean(set.showExplanationImmediately),
      policyVersion: 1,
      capturedAt: now
    },
    attemptTokenHash: hashSessionToken(runSecret)
  };
}

function buildGrammarAttemptAnswer(attempt: any, set: any, payload: any) {
  const attemptQuestion = (attempt.questions || []).find((question: any) => question.id === payload?.attemptQuestionId);
  if (!attemptQuestion) throw createHttpError(400, "Cau hoi khong hop le.");
  const questionType = getGrammarQuestionType(attemptQuestion.questionType, getGrammarQuestionType(set?.questionType));
  const selectedOptionId = questionType === "multiple_choice" ? String(payload?.selectedOptionId || "") : "";
  const textAnswer = questionType === "rewrite" ? safeText(payload?.textAnswer, 4000) : "";
  if (questionType === "multiple_choice") {
    const selectedOption = (attemptQuestion.optionsSnapshot || []).find((option: any) => option.id === selectedOptionId);
    if (!selectedOption) throw createHttpError(400, "Phuong an da chon khong hop le.");
  } else if (!normalizeGrammarTextAnswer(textAnswer)) {
    throw createHttpError(400, "Vui long nhap cau tra loi.");
  }

  const isCorrect = questionType === "rewrite"
    ? isGrammarTextAnswerCorrect(textAnswer, attemptQuestion.correctAnswerSnapshot, attemptQuestion.acceptedAnswersSnapshot)
    : selectedOptionId === attemptQuestion.correctOptionId;
  const answer: any = {
    id: deterministicRunDocumentId("grammar-answer-v2", [attempt.id, attemptQuestion.id]),
    attemptQuestionId: attemptQuestion.id,
    questionId: attemptQuestion.questionId,
    questionType,
    isCorrect,
    scoreAwarded: isCorrect ? Number(attemptQuestion.scoreSnapshot || 1) : 0,
    answeredAt: new Date().toISOString()
  };
  if (questionType === "rewrite") {
    answer.textAnswer = textAnswer;
    answer.correctAnswer = attemptQuestion.correctAnswerSnapshot;
    answer.gradingVersion = GRAMMAR_TEXT_GRADING_VERSION;
  } else {
    answer.selectedOptionId = selectedOptionId;
    answer.correctOptionId = attemptQuestion.correctOptionId;
  }
  const feedback = set?.showExplanationImmediately
    ? {
        isCorrect,
        correctOptionId: questionType === "multiple_choice" ? attemptQuestion.correctOptionId : "",
        correctAnswer: questionType === "rewrite" ? attemptQuestion.correctAnswerSnapshot : "",
        explanation: attemptQuestion.explanationSnapshot,
        scoreAwarded: answer.scoreAwarded
      }
    : null;
  return { answer, feedback };
}

function buildGrammarAnswerFeedback(attempt: any, set: any, answer: any) {
  if (!set?.showExplanationImmediately || !answer) return null;
  const attemptQuestion = (attempt.questions || []).find(
    (question: any) => question.id === answer.attemptQuestionId
  );
  if (!attemptQuestion) return null;
  const questionType = getGrammarQuestionType(
    attemptQuestion.questionType,
    getGrammarQuestionType(set?.questionType)
  );
  return {
    isCorrect: Boolean(answer.isCorrect),
    correctOptionId: questionType === "multiple_choice" ? attemptQuestion.correctOptionId : "",
    correctAnswer: questionType === "rewrite" ? attemptQuestion.correctAnswerSnapshot : "",
    explanation: attemptQuestion.explanationSnapshot,
    scoreAwarded: Number(answer.scoreAwarded || 0)
  };
}

type GrammarQuestionType = "multiple_choice" | "rewrite";

function getGrammarQuestionType(value: any, fallback: GrammarQuestionType = "multiple_choice"): GrammarQuestionType {
  return value === "rewrite" ? "rewrite" : fallback;
}

function normalizeAcceptedGrammarAnswers(value: any, correctAnswer: string) {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/\r?\n/)
      : [];
  const seen = new Set<string>();
  const normalizedCorrectAnswer = normalizeGrammarTextAnswer(correctAnswer);
  if (normalizedCorrectAnswer) seen.add(normalizedCorrectAnswer);

  const acceptedAnswers: string[] = [];
  for (const candidate of source) {
    const answer = safeText(candidate, 4000);
    const normalizedAnswer = normalizeGrammarTextAnswer(answer);
    if (!normalizedAnswer || seen.has(normalizedAnswer)) continue;
    seen.add(normalizedAnswer);
    acceptedAnswers.push(answer);
    if (acceptedAnswers.length >= 20) break;
  }
  return acceptedAnswers;
}

function normalizeGrammarQuestion(question: any, index: number, fallbackType: GrammarQuestionType = "multiple_choice") {
  const questionId = question.id || makeId(`grammar-question-${index + 1}`);
  const questionType = getGrammarQuestionType(question.questionType, fallbackType);
  const rawOptions = questionType === "multiple_choice" && Array.isArray(question.options) ? question.options : [];
  const options = rawOptions.slice(0, 5).map((option: any, optionIndex: number) => ({
    id: option.id || `${questionId}-option-${optionIndex + 1}`,
    text: safeText(option.text, 1000),
    originalPosition: Number.isFinite(Number(option.originalPosition))
      ? Number(option.originalPosition)
      : optionIndex + 1
  }));

  const normalized: any = {
    id: questionId,
    questionType,
    questionText: safeText(question.questionText || question.question, 4000),
    options,
    explanation: safeText(question.explanation, 6000),
    score: Math.max(1, Number(question.score || 1)),
    position: Number.isFinite(Number(question.position)) ? Number(question.position) : index + 1
  };

  if (questionType === "rewrite") {
    normalized.correctOptionId = "";
    normalized.correctAnswer = safeText(question.correctAnswer || question.answer, 4000);
    normalized.acceptedAnswers = normalizeAcceptedGrammarAnswers(
      question.acceptedAnswers,
      normalized.correctAnswer
    );
  } else {
    normalized.correctOptionId = String(question.correctOptionId || "");
  }

  return normalized;
}

function validateGrammarQuestion(question: any, index: number) {
  const errors: string[] = [];
  if (!question.questionText) errors.push(`Câu ${index + 1}: thiếu nội dung câu hỏi.`);
  if (!question.explanation) errors.push(`Câu ${index + 1}: thiếu lời giải thích.`);
  if (question.questionType === "rewrite") {
    if (!question.correctAnswer) errors.push(`Câu ${index + 1}: thiếu đáp án đúng.`);
    return errors;
  }

  if (!Array.isArray(question.options) || question.options.length < 2 || question.options.length > 4) {
    errors.push(`Câu ${index + 1}: cần từ 2 đến 4 phương án.`);
  }
  question.options?.forEach((option: any, optionIndex: number) => {
    if (!option.text) errors.push(`Câu ${index + 1}: phương án ${optionIndex + 1} đang trống.`);
  });
  const optionIds = (question.options || []).map((option: any) => String(option.id || ""));
  if (new Set(optionIds).size !== optionIds.length) {
    errors.push(`Câu ${index + 1}: có phương án bị trùng ID.`);
  }
  if (!question.correctOptionId || !question.options?.some((option: any) => option.id === question.correctOptionId)) {
    errors.push(`Câu ${index + 1}: đáp án đúng không hợp lệ.`);
  }

  const normalizedOptions = (question.options || []).map((option: any) => normalizePersonName(option.text));
  if (new Set(normalizedOptions).size !== normalizedOptions.length) {
    errors.push(`Câu ${index + 1}: có phương án bị trùng nội dung.`);
  }
  return errors;
}

function normalizeGrammarSetForSave(payload: any, existing: any = {}, user: any) {
  const now = new Date().toISOString();
  const questionType = getGrammarQuestionType(payload.questionType, getGrammarQuestionType(existing.questionType));
  const questions = (Array.isArray(payload.questions) ? payload.questions : [])
    .map((question: any, index: number) => normalizeGrammarQuestion(question, index, questionType))
    .sort((a: any, b: any) => a.position - b.position)
    .map((question: any, index: number) => ({ ...question, position: index + 1 }));

  const errors = questions.flatMap(validateGrammarQuestion);
  const duplicateQuestions = new Map<string, number>();
  questions.forEach((question: any, index: number) => {
    const key = normalizePersonName(question.questionText);
    if (!key) return;
    if (duplicateQuestions.has(key)) {
      errors.push(`Câu ${index + 1}: nội dung câu hỏi trùng với câu ${duplicateQuestions.get(key)}.`);
    } else {
      duplicateQuestions.set(key, index + 1);
    }
  });

  if (questions.length === 0) errors.push("Bài ngữ pháp cần ít nhất một câu hỏi hợp lệ.");
  if (errors.length > 0) {
    const err: any = new Error(errors.join(" "));
    err.status = 400;
    err.details = errors;
    throw err;
  }

  const visibility = getGrammarVisibility(payload);
  const normalized: any = {
    ...existing,
    ...payload,
    id: payload.id || existing.id,
    title: safeText(payload.title || existing.title, 240),
    description: safeText(payload.description || existing.description, 2000),
    gradeLevel: safeText(payload.gradeLevel || existing.gradeLevel || "Lớp 3", 80),
    subject: safeText(payload.subject || existing.subject || "English Grammar", 120),
    topic: safeText(payload.topic || existing.topic || "", 160),
    tags: Array.isArray(payload.tags) ? payload.tags.map((tag: any) => safeText(tag, 60)).filter(Boolean).slice(0, 12) : [],
    visibility,
    questionType,
    status: visibility === "assignment" ? "private" : visibility,
    timeLimitMinutes: Math.max(0, Number(payload.timeLimitMinutes || 0)),
    maxAttempts: Math.max(1, Number(payload.maxAttempts || 1)),
    shuffleQuestions: payload.shuffleQuestions !== false,
    shuffleOptions: questionType === "rewrite" ? false : payload.shuffleOptions !== false,
    showExplanationImmediately: Boolean(payload.showExplanationImmediately),
    showReviewAfterSubmit: payload.showReviewAfterSubmit !== false,
    createdBy: existing.createdBy || user.id,
    creatorName: existing.creatorName || user.name,
    createdAt: existing.createdAt || now,
    updatedAt: now,
    questions
  };

  if (visibility === "assignment") {
    const token = existing.shareToken || existing.assignmentSlug || createShareToken();
    normalized.shareToken = String(token).replace(/^grammar-/, "");
    normalized.assignmentSlug = normalized.shareToken;
  } else {
    delete normalized.shareToken;
    delete normalized.assignmentSlug;
  }

  return normalized;
}

function canManageGrammarSet(user: any, set: any) {
  return user?.role === "super_admin" || (Boolean(set?.createdBy) && set.createdBy === user?.id);
}

function canViewGrammarSet(user: any, set: any) {
  if (!user) return getGrammarVisibility(set) === "public";
  if (user.role === "super_admin") return true;
  if (user.role === "teacher") return canManageGrammarSet(user, set) || getGrammarVisibility(set) === "public";
  return getGrammarVisibility(set) === "public";
}

function sanitizeGrammarSetForStudent(set: any) {
  return {
    ...set,
    questions: (set.questions || []).map((question: any) => ({
      id: question.id,
      questionType: getGrammarQuestionType(question.questionType, getGrammarQuestionType(set.questionType)),
      questionText: question.questionText,
      options: (question.options || []).map((option: any) => ({
        id: option.id,
        text: option.text,
        originalPosition: option.originalPosition
      })),
      score: question.score,
      position: question.position
    }))
  };
}

function sanitizeAttemptForStudent(attempt: any, includeReview = false, attemptToken = "") {
  const { attemptTokenHash, sessionTokenHash, ...safeAttempt } = attempt;
  const sanitizedAttempt: any = {
    ...safeAttempt,
    questions: (attempt.questions || []).map((question: any) => {
      const safeQuestion: any = {
        id: question.id,
        questionId: question.questionId,
        questionType: getGrammarQuestionType(question.questionType),
        displayPosition: question.displayPosition,
        questionSnapshot: question.questionSnapshot,
        scoreSnapshot: question.scoreSnapshot,
        optionsSnapshot: Array.isArray(question.optionsSnapshot)
          ? question.optionsSnapshot.map((option: any) => ({
              id: option.id,
              text: option.text,
              originalPosition: option.originalPosition
            }))
          : []
      };

      if (includeReview) {
        safeQuestion.explanationSnapshot = question.explanationSnapshot;
        safeQuestion.correctOptionId = question.correctOptionId;
        safeQuestion.correctAnswerSnapshot = question.correctAnswerSnapshot;
      }

      return safeQuestion;
    }),
    answers: (attempt.answers || []).map((answer: any) => sanitizeGrammarAnswerForStudent(answer, includeReview))
  };

  if (attemptToken) sanitizedAttempt.attemptToken = attemptToken;
  return sanitizedAttempt;
}

async function getGrammarSetOr404(id: string) {
  const doc = await adminDb.collection("grammar_sets").doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

async function getGrammarAttemptOr404(id: string) {
  const doc = await adminDb.collection("grammar_attempts").doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

start().catch(async (err) => {
  console.error("Failed to start fullstack server", err);
  await shutdownStorage().catch(() => undefined);
  process.exit(1);
});
