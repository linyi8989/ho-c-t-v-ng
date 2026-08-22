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
import { GoogleGenAI, Type } from "@google/genai";
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
const PORT = Number(process.env.PORT) || 3000;
const AUDIO_DIR = process.env.TTS_AUDIO_DIR || "/home/qzmivzbj/app-data/vhomework/audio";
const AUDIO_PUBLIC_PREFIX = "/audio";
const LISTENING_MEDIA_PUBLIC_PREFIX = "/listening-media";
const LISTENING_MEDIA_DIR = process.env.LISTENING_MEDIA_DIR
  || (process.env.NODE_ENV === "production"
    ? "/home/qzmivzbj/app-data/vhomework/listening-media"
    : path.join(process.cwd(), ".data", "listening-media"));
const SLOW_API_LOG_MS = Math.max(0, Number(process.env.SLOW_API_LOG_MS || 500));
const LEARNING_HISTORY_REQUESTED = process.env.LEARNING_HISTORY_ENABLED === "true";
const LEARNING_HISTORY_ENABLED = LEARNING_HISTORY_REQUESTED && process.env.STORAGE_MODE === "sqlite";
const requestedAttemptDetailRetentionDays = Number(process.env.ATTEMPT_DETAIL_RETENTION_DAYS || 30);
const ATTEMPT_DETAIL_RETENTION_DAYS = Number.isFinite(requestedAttemptDetailRetentionDays)
  ? Math.max(1, Math.floor(requestedAttemptDetailRetentionDays))
  : 30;
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

app.use(express.json());
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

function sendApiError(res: express.Response, err: any) {
  const status = isStorageUnavailableError(err) ? 503 : Number(err?.status || err?.statusCode || 500);
  res.status(status).json({ error: err?.message || "Internal server error", details: err?.details });
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

type AppRole = 'super_admin' | 'teacher' | 'student';
type AppStatus = 'active' | 'pending' | 'blocked' | 'deleted';

const SUPER_ADMIN_EMAILS = new Set(["linyi8901@gmail.com", "admin@vocabulary.edu.vn"]);
const VALID_ROLES = new Set<AppRole>(["super_admin", "teacher", "student"]);
const VALID_STATUSES = new Set<AppStatus>(["active", "pending", "blocked", "deleted"]);

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
  return SUPER_ADMIN_EMAILS.has(normalizeEmail(email)) ? "super_admin" : "student";
}

function resolveTrustedRole(decodedToken: any, storedProfile: any = {}): AppRole {
  const email = normalizeEmail(decodedToken.email || storedProfile.email);
  const claimRole = String(decodedToken.role || "").trim() as AppRole;
  if (VALID_ROLES.has(claimRole)) return claimRole;
  if (SUPER_ADMIN_EMAILS.has(email)) return "super_admin";

  const storedRole = String(storedProfile.role || "").trim() as AppRole;
  if (storedRole === "teacher") return "teacher";
  if (storedRole === "student") return "student";

  // Do not trust a document-only super_admin role unless it is backed by
  // a custom claim or a known bootstrap admin email.
  return "student";
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
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;
    const email = decodedToken.email || "";
    // Load or create profile in Firestore
    const userRef = adminDb.collection("users").doc(uid);
    const doc = await userRef.get();
    
    let userProfile: any;

    if (!doc.exists) {
      // Determine default role (linyi8901@gmail.com is super_admin, other is student)
      const defaultRole = getDefaultRoleForEmail(email);

      userProfile = buildUserProfileFromToken(decodedToken, {
        role: defaultRole,
        status: "active"
      });

      await userRef.set(userProfile);
      
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
    console.error("Token verification failed:", error);
    if (isStorageUnavailableError(error)) {
      return sendApiError(res, error);
    }
    return res.status(401).json({ error: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn." });
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
    } else {
      userProfile = buildUserProfileFromToken(decodedToken, doc.data());
    }

    if (userProfile.status !== "active") {
      (req as any).authBlocked = true;
    } else {
      req.user = userProfile;
    }
  } catch {
    // Public student grammar flow may use guest identity without Firebase auth.
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

function addDaysIso(baseIso: string, days: number) {
  return new Date(new Date(baseIso).getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

function getActivityTime(data: any) {
  return data.completedAt || data.endedAt || data.createdAt || data.startedAt || "";
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

function getGuestProfileId(value: any) {
  return safeText(value, 120);
}

function isGuestOwnedRecord(data: any) {
  const guestId = getGuestProfileId(data?.guestId);
  const userId = safeText(data?.userId, 120);
  return Boolean(guestId && (data?.ownerType === "guest" || !userId || userId === guestId));
}

function getGuestActivityTime(data: any) {
  return data?.completedAt || data?.endedAt || data?.lastSavedAt || data?.updatedAt || data?.startedAt || data?.createdAt || "";
}

async function findLegacyGuestIdentity(guestIdValue: any) {
  const guestId = getGuestProfileId(guestIdValue);
  if (!guestId) return null;

  const [sessionsSnapshot, attemptsSnapshot] = await Promise.all([
    adminDb.collection("game_sessions").where("guestId", "==", guestId).get(),
    adminDb.collection("grammar_attempts").where("guestId", "==", guestId).get()
  ]);
  let latest: any = null;
  const collect = (data: any) => {
    if (!isGuestOwnedRecord(data) || getGuestProfileId(data.guestId) !== guestId) return;
    const displayName = safeText(data.studentName, 120);
    if (!displayName) return;
    const activityAt = getGuestActivityTime(data);
    if (!latest || new Date(activityAt || 0).getTime() >= new Date(latest.activityAt || 0).getTime()) {
      latest = { displayName, activityAt };
    }
  };
  sessionsSnapshot.forEach((doc: any) => collect({ id: doc.id, ...doc.data() }));
  attemptsSnapshot.forEach((doc: any) => collect({ id: doc.id, ...doc.data() }));
  if (!latest) return null;

  return {
    id: guestId,
    guestId,
    accountType: "guest",
    displayName: latest.displayName,
    name: latest.displayName,
    role: "student",
    status: "active",
    legacy: true,
    activityAt: latest.activityAt
  };
}

async function findExistingGuestIdentity(guestIdValue: any) {
  const guestId = getGuestProfileId(guestIdValue);
  if (!guestId) return null;

  const profileDoc = await adminDb.collection("guest_profiles").doc(guestId).get();
  if (profileDoc.exists) {
    const profile = { id: profileDoc.id, guestId, ...profileDoc.data() } as any;
    if (profile.status === "blocked") {
      throw createHttpError(403, "Hồ sơ học sinh này đã bị khóa.");
    }
    const displayName = safeText(profile.displayName || profile.name, 120);
    if (displayName) {
      return {
        ...profile,
        displayName,
        name: displayName,
        status: profile.status || "active",
        legacy: !validateStudentDisplayName(displayName).valid
      };
    }
  }

  return findLegacyGuestIdentity(guestId);
}

const GUEST_ACTIVITY_TOUCH_INTERVAL_MS = Math.max(
  60_000,
  Number(process.env.GUEST_ACTIVITY_TOUCH_INTERVAL_MS || 5 * 60_000)
);

async function resolveGuestProfile(
  guestIdValue: any,
  studentNameValue: any,
  touchActivity = true,
  classInfo: { classId?: any; className?: any; verified?: boolean } = {}
) {
  const guestId = getGuestProfileId(guestIdValue);
  if (!guestId) throw createHttpError(400, "Thiếu mã nhận diện học sinh.");

  const profileRef = adminDb.collection("guest_profiles").doc(guestId);
  const profileDoc = await profileRef.get();
  const now = new Date().toISOString();

  if (profileDoc.exists) {
    const existing = { id: profileDoc.id, ...profileDoc.data() } as any;
    if (existing.status === "blocked") {
      throw createHttpError(403, "Hồ sơ học sinh này đã bị khóa.");
    }

    const displayName = safeText(existing.displayName || existing.name, 120);
    if (!displayName) {
      const legacyIdentity = await findLegacyGuestIdentity(guestId);
      if (legacyIdentity) return legacyIdentity;

      const validation = validateStudentDisplayName(studentNameValue);
      if (!validation.valid) throw createHttpError(400, validation.error);
      const repaired = {
        ...existing,
        displayName: validation.value,
        name: validation.value,
        normalizedName: normalizePersonName(validation.value),
        updatedAt: now,
        lastActiveAt: touchActivity ? now : (existing.lastActiveAt || now),
        needsReview: false
      };
      await profileRef.set(repaired);
      return repaired;
    }

    const classId = classInfo.verified ? safeText(classInfo.classId, 160) : "";
    const className = classInfo.verified ? safeText(classInfo.className, 240) : "";
    const lastActiveAtMs = new Date(existing.lastActiveAt || 0).getTime();
    const shouldTouchActivity = Boolean(
      touchActivity
      && (!Number.isFinite(lastActiveAtMs) || Date.now() - lastActiveAtMs >= GUEST_ACTIVITY_TOUCH_INTERVAL_MS)
    );
    const shouldUpdateClassId = Boolean(classId && classId !== safeText(existing.classId, 160));
    const shouldUpdateClassName = Boolean(className && className !== safeText(existing.className, 240));
    if (shouldTouchActivity || shouldUpdateClassId || shouldUpdateClassName) {
      await profileRef.update({
        ...(shouldTouchActivity ? { lastActiveAt: now } : {}),
        ...(shouldUpdateClassId ? { classId } : {}),
        ...(shouldUpdateClassName ? { className } : {})
      });
    }
    return {
      ...existing,
      displayName,
      name: displayName,
      lastActiveAt: shouldTouchActivity ? now : existing.lastActiveAt,
      classId: classId || existing.classId,
      className: className || existing.className
    };
  }

  const legacyIdentity = await findLegacyGuestIdentity(guestId);
  if (legacyIdentity) return legacyIdentity;

  const validation = validateStudentDisplayName(studentNameValue);
  if (!validation.valid) throw createHttpError(400, validation.error);
  const guestAccessToken = createSessionToken();
  const guestAccessTokenVersion = 1;
  const profile = {
    id: guestId,
    guestId,
    accountType: "guest",
    displayName: validation.value,
    name: validation.value,
    normalizedName: normalizePersonName(validation.value),
    role: "student",
    status: "active",
    classId: classInfo.verified ? safeText(classInfo.classId, 160) : "",
    className: classInfo.verified ? safeText(classInfo.className, 240) : "",
    createdAt: now,
    updatedAt: now,
    lastActiveAt: now,
    needsReview: false,
    accessTokenHash: hashSessionToken(guestAccessToken),
    accessTokenVersion: guestAccessTokenVersion,
    accessTokenCreatedAt: now
  };
  await profileRef.set(profile);
  return {
    ...omitGuestCapabilitySecrets(profile),
    guestAccessToken,
    guestAccessTokenVersion
  };
}

async function ensureLegacyGuestProfiles() {
  const [profilesSnapshot, sessionsSnapshot, attemptsSnapshot] = await Promise.all([
    adminDb.collection("guest_profiles").get(),
    adminDb.collection("game_sessions").get(),
    adminDb.collection("grammar_attempts").get()
  ]);
  const existingIds = new Set<string>();
  profilesSnapshot.forEach((doc: any) => existingIds.add(doc.id));

  const candidates = new Map<string, any>();
  const collect = (data: any) => {
    if (!isGuestOwnedRecord(data)) return;
    const guestId = getGuestProfileId(data.guestId);
    const activityAt = getActivityTime(data) || data.updatedAt || data.createdAt || new Date(0).toISOString();
    const existing = candidates.get(guestId);
    const createdAt = data.createdAt || data.startedAt || activityAt;
    if (!existing || new Date(activityAt).getTime() >= new Date(existing.lastActiveAt).getTime()) {
      candidates.set(guestId, {
        guestId,
        displayName: safeText(data.studentName || "Học sinh", 120),
        createdAt: existing?.createdAt && new Date(existing.createdAt).getTime() < new Date(createdAt).getTime()
          ? existing.createdAt
          : createdAt,
        lastActiveAt: activityAt
      });
    } else if (new Date(createdAt).getTime() < new Date(existing.createdAt).getTime()) {
      existing.createdAt = createdAt;
    }
  };
  sessionsSnapshot.forEach((doc: any) => collect({ id: doc.id, ...doc.data() }));
  attemptsSnapshot.forEach((doc: any) => collect({ id: doc.id, ...doc.data() }));

  const missing = [...candidates.values()].filter(candidate => !existingIds.has(candidate.guestId));
  for (let offset = 0; offset < missing.length; offset += 400) {
    const batch = adminDb.batch();
    for (const candidate of missing.slice(offset, offset + 400)) {
      const validation = validateStudentDisplayName(candidate.displayName);
      const now = new Date().toISOString();
      batch.set(adminDb.collection("guest_profiles").doc(candidate.guestId), {
        id: candidate.guestId,
        guestId: candidate.guestId,
        accountType: "guest",
        displayName: candidate.displayName,
        name: candidate.displayName,
        normalizedName: normalizePersonName(candidate.displayName),
        role: "student",
        status: "active",
        createdAt: candidate.createdAt || now,
        updatedAt: now,
        lastActiveAt: candidate.lastActiveAt || now,
        needsReview: !validation.valid
      });
    }
    await batch.commit();
  }
}

let legacyGuestProfileBackfillPromise: Promise<void> | null = null;

async function ensureLegacyGuestProfilesOnce() {
  if (!legacyGuestProfileBackfillPromise) {
    legacyGuestProfileBackfillPromise = ensureLegacyGuestProfiles().catch(err => {
      legacyGuestProfileBackfillPromise = null;
      throw err;
    });
  }
  await legacyGuestProfileBackfillPromise;
}

async function getCanonicalStudentNameMaps() {
  await ensureLegacyGuestProfilesOnce();
  const [usersSnapshot, profilesSnapshot] = await Promise.all([
    adminDb.collection("users").get(),
    adminDb.collection("guest_profiles").get()
  ]);
  const users = new Map<string, string>();
  const guests = new Map<string, string>();
  usersSnapshot.forEach((doc: any) => {
    const data = doc.data();
    const name = safeText(data.name || data.displayName, 120);
    if (name) users.set(doc.id, name);
  });
  profilesSnapshot.forEach((doc: any) => {
    const data = doc.data();
    const name = safeText(data.displayName || data.name, 120);
    if (name) guests.set(doc.id, name);
  });
  return { users, guests };
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
  const maps = await getCanonicalStudentNameMaps();
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

  // Legacy compatibility for sessions started before session tokens existed.
  if (!existing.sessionTokenHash && existing.guestId && safeText(payload.guestId, 120) === existing.guestId) {
    return true;
  }

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
  const setDoc = await adminDb.collection("vocab_sets").doc(attempt.lessonId).get();
  return Boolean(setDoc.exists && canManageVocabSet(user, { id: setDoc.id, ...setDoc.data() }));
}

function getAssignmentShareToken(assignment: any) {
  return String(assignment?.shareToken || assignment?.assignmentSlug || "").trim();
}

async function ensureAssignmentShareToken(assignment: any, docRef?: any) {
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
  const assignmentStatus = String(assignment.status || "active").toLowerCase();
  if (["draft", "deleted", "inactive", "archived"].includes(assignmentStatus)) return false;
  const visibility = getVocabVisibility(set);
  return visibility === "public" || visibility === "assignment";
}

function getRequestVocabShareToken(req: express.Request) {
  return safeText(req.body?.accessToken || req.headers["x-vocab-share-token"], 200);
}

async function resolveVocabLearningAccess(tokenValue: any, expectedVocabSetId = "", expectedAssignmentId = "") {
  const token = safeText(tokenValue, 200);
  if (!token) return null;

  if (expectedAssignmentId) {
    const assignmentDoc = await adminDb.collection("assignments").doc(expectedAssignmentId).get();
    if (!assignmentDoc.exists) return null;
    const assignment = await ensureAssignmentShareToken(
      { id: assignmentDoc.id, ...assignmentDoc.data() },
      assignmentDoc.ref
    );
    if (getAssignmentShareToken(assignment) !== token) return null;
    if (expectedVocabSetId && assignment.vocabSetId !== expectedVocabSetId) return null;
    const setDoc = await adminDb.collection("vocab_sets").doc(assignment.vocabSetId).get();
    if (!setDoc.exists) return null;
    const set = { id: setDoc.id, ...setDoc.data() };
    if (!isAssignmentOpenForLearning(assignment, set)) return null;
    return { accessType: "assignment" as const, set, assignment };
  }

  if (expectedVocabSetId) {
    const setDoc = await adminDb.collection("vocab_sets").doc(expectedVocabSetId).get();
    if (!setDoc.exists) return null;
    const set = { id: setDoc.id, ...setDoc.data() };
    const setToken = String(set.shareToken || set.assignmentSlug || "").trim();
    if (setToken === token && getVocabVisibility(set) === "assignment") {
      return { accessType: "vocab_set" as const, set, assignment: null };
    }
  }

  const assignmentsSnapshot = await adminDb.collection("assignments").get();
  for (const doc of assignmentsSnapshot.docs || []) {
    const assignment = await ensureAssignmentShareToken({ id: doc.id, ...doc.data() }, doc.ref);
    if (getAssignmentShareToken(assignment) !== token) continue;
    if (expectedAssignmentId && assignment.id !== expectedAssignmentId) return null;
    if (expectedVocabSetId && assignment.vocabSetId !== expectedVocabSetId) return null;
    const setDoc = await adminDb.collection("vocab_sets").doc(assignment.vocabSetId).get();
    if (!setDoc.exists) return null;
    const set = { id: setDoc.id, ...setDoc.data() };
    if (!isAssignmentOpenForLearning(assignment, set)) return null;
    return { accessType: "assignment" as const, set, assignment };
  }

  const setsSnapshot = await adminDb.collection("vocab_sets").get();
  for (const doc of setsSnapshot.docs || []) {
    const set = { id: doc.id, ...doc.data() };
    const setToken = String(set.shareToken || set.assignmentSlug || "").trim();
    if (setToken !== token || getVocabVisibility(set) !== "assignment") continue;
    if (expectedAssignmentId) return null;
    if (expectedVocabSetId && set.id !== expectedVocabSetId) return null;
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

async function loadLeaderboardEventsFromSources() {
  const events: any[] = [];
  const leaderboardCutoff = new Date(Date.now() - LEADERBOARD_RETENTION_MS).toISOString();
  const storedSnapshot = await adminDb.collection("leaderboard_events")
    .where("completedAt", ">=", leaderboardCutoff)
    .get();
  storedSnapshot.forEach(doc => {
    const data = sanitizeLeaderboardEvent({ id: doc.id, ...doc.data() });
    if (!isExpiredStoredLeaderboardEvent(data)) events.push(data);
  });

  const gameSnapshot = await adminDb.collection("game_sessions")
    .where("completedAt", ">=", leaderboardCutoff)
    .get();
  const grammarAttemptsSnapshot = await adminDb.collection("grammar_attempts")
    .where("completedAt", ">=", leaderboardCutoff)
    .get();
  const grammarSetsById = await getGrammarSetMap();
  const vocabSetsById = await getVocabSetMap();

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

  return enrichStudentNames(mergeLeaderboardEvents(events));
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
        { id: "teacher-1", name: "Cô Thảo English", email: "thao.teacher@gmail.com", role: "teacher", status: "active", createdAt: new Date().toISOString() },
        { id: "admin-1", name: "Hệ thống Admin", email: "admin@vocabulary.edu.vn", role: "super_admin", status: "active", createdAt: new Date().toISOString() }
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
const DEVQUOTA_API_KEY = process.env.DEVQUOTA_API_KEY?.trim() || "";
const DEVQUOTA_BASE_URL = process.env.DEVQUOTA_BASE_URL?.trim() || DEVQUOTA_DEFAULT_BASE_URL;
const DEVQUOTA_SMART_IMPORT_PROVIDERS = getDevQuotaSmartImportProviders(DEVQUOTA_API_KEY);

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

function parseAiJson(text: string) {
  const trimmed = String(text || "").trim();
  if (!trimmed) throw new Error("AI returned empty text.");

  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/) || trimmed.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (match?.[1]) {
      return JSON.parse(match[1].trim());
    }
    throw new Error("AI returned invalid JSON.");
  }
}

// Fallback Vocabulary Generator
function getFallbackVocabulary(topic: string, count: number): any[] {
  const normalized = topic.toLowerCase().trim();
  
  if (normalized.includes("animal") || normalized.includes("động vật") || normalized.includes("con vật")) {
    const pool = [
      { term: "Elephant", meaning: "Con voi", ipa: "/ˈelɪfənt/", pos: "Noun", example: "The elephant is very large.", exampleMeaning: "Con voi rất to lớn." },
      { term: "Tiger", meaning: "Con hổ", ipa: "/ˈtaɪɡə(r)/", pos: "Noun", example: "The tiger runs very fast.", exampleMeaning: "Con hổ chạy rất nhanh." },
      { term: "Monkey", meaning: "Con khỉ", ipa: "/ˈmʌŋki/", pos: "Noun", example: "The monkey loves eating bananas.", exampleMeaning: "Con khỉ thích ăn chuối." },
      { term: "Dolphin", meaning: "Cá heo", ipa: "/ˈdɒlfɪn/", pos: "Noun", example: "Dolphins are very friendly.", exampleMeaning: "Cá heo rất thân thiện." },
      { term: "Giraffe", meaning: "Hươu cao cổ", ipa: "/dʒɪˈrɑːf/", pos: "Noun", example: "The giraffe has a very long neck.", exampleMeaning: "Hươu cao cổ có chiếc cổ rất dài." }
    ];
    return pool.slice(0, count);
  }

  // Fallback for school
  if (normalized.includes("school") || normalized.includes("trường học") || normalized.includes("lớp")) {
    const pool = [
      { term: "Teacher", meaning: "Giáo viên", ipa: "/ˈtiːtʃə(r)/", pos: "Noun", example: "Our teacher is very kind.", exampleMeaning: "Giáo viên của chúng tôi rất tốt bụng." },
      { term: "Student", meaning: "Học sinh", ipa: "/ˈstjuːdnt/", pos: "Noun", example: "The students are listening.", exampleMeaning: "Các học sinh đang lắng nghe." },
      { term: "Classroom", meaning: "Phòng học", ipa: "/ˈklɑːsruːm/", pos: "Noun", example: "Our classroom has a big board.", exampleMeaning: "Phòng học của chúng tôi có bảng lớn." }
    ];
    return pool.slice(0, count);
  }

  return [
    { term: topic.charAt(0).toUpperCase() + topic.slice(1), meaning: `Từ về ${topic}`, ipa: "/ˈtɒpɪk/", pos: "Noun", example: "This is an example.", exampleMeaning: "Đây là ví dụ." }
  ];
}

// ============================================================================
// API ROUTES
// ============================================================================

app.get("/api/auth/debug", async (req, res) => {
  try {
    const testDoc = await adminDb.collection("users").limit(1).get();
    res.json({
      success: true,
      projectId: adminDb.projectId,
      docsCount: testDoc.size,
      env: {
        nodeEnv: process.env.NODE_ENV,
        firebaseDatabaseId: adminDb.projectId
      }
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      error: err.message,
      stack: err.stack
    });
  }
});

app.get("/api/diagnostics/storage", async (req, res) => {
  const secret = process.env.DIAGNOSTIC_SECRET;
  if (!secret) {
    return res.status(404).json({ error: "Not found" });
  }

  if (req.query.secret !== secret) {
    return res.status(403).json({ error: "Forbidden" });
  }

  res.json(await getStorageDiagnostics());
});

const PHONE_AUTH_WINDOW_MS = 10 * 60 * 1000;
const PHONE_AUTH_MAX_ATTEMPTS = 5;
const phoneAuthAttempts = new Map<string, { count: number; resetAt: number }>();

function getRequestIp(req: express.Request) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.socket.remoteAddress || "unknown";
}

function assertPhoneAuthRateLimit(req: express.Request, phone: string) {
  const key = `${getRequestIp(req)}:${phone}`;
  const now = Date.now();
  const current = phoneAuthAttempts.get(key);
  if (!current || current.resetAt <= now) {
    phoneAuthAttempts.set(key, { count: 1, resetAt: now + PHONE_AUTH_WINDOW_MS });
    return;
  }

  current.count += 1;
  if (current.count > PHONE_AUTH_MAX_ATTEMPTS) {
    throw createHttpError(429, "Too many phone login attempts. Please wait and try again.");
  }
}

async function findUserByPhone(normalizedPhone: string, rawPhone = "") {
  const candidates = Array.from(new Set([
    normalizedPhone,
    rawPhone.trim(),
    rawPhone.replace(/[^\d+]/g, "").trim()
  ].filter(Boolean)));

  for (const candidate of candidates) {
    const snapshot = await adminDb.collection("users").where("phone", "==", candidate).limit(1).get();
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() };
    }
  }

  return null;
}

function getFirebaseWebApiKey() {
  return process.env.FIREBASE_WEB_API_KEY || process.env.FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY || "";
}

async function verifyFirebasePassword(email: string, password: string) {
  const apiKey = getFirebaseWebApiKey();
  if (!apiKey) throw createHttpError(503, "Phone password login is not configured.");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
      signal: controller.signal
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok || !data.localId) {
      throw createHttpError(401, "Phone number or password is incorrect.");
    }
    return data as { localId: string };
  } finally {
    clearTimeout(timeout);
  }
}

// 0. GET EMAIL BY PHONE (Unauthenticated - for Phone + Password login)
app.post("/api/auth/email-by-phone", async (req, res) => {
  try {
    const normalizedPhone = normalizePhoneE164(req.body?.phone);
    if (!normalizedPhone) return res.status(400).json({ error: "Invalid phone number." });
    assertPhoneAuthRateLimit(req, normalizedPhone);
    return res.json({ ok: true, message: "Use /api/auth/login-by-phone to sign in without exposing account email." });

    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ error: "Vui lòng cung cấp số điện thoại." });
    }

    let formattedPhone = phone.trim();
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '+84' + formattedPhone.substring(1);
    } else if (!formattedPhone.startsWith('+')) {
      formattedPhone = '+84' + formattedPhone;
    }

    const snapshot = await adminDb.collection("users").where("phone", "==", formattedPhone).limit(1).get();
    if (snapshot.empty) {
      // Try searching by raw phone
      const rawSnapshot = await adminDb.collection("users").where("phone", "==", phone.trim()).limit(1).get();
      if (rawSnapshot.empty) {
        return res.status(404).json({ error: "Không tìm thấy tài khoản nào được đăng ký với số điện thoại này." });
      }
      const userData = rawSnapshot.docs[0].data();
      return res.json({ email: userData.email });
    }

    const userData = snapshot.docs[0].data();
    return res.json({ email: userData.email });
  } catch (err: any) {
    sendApiError(res, err);
  }
});

app.post("/api/auth/login-by-phone", async (req, res) => {
  try {
    const rawPhone = String(req.body?.phone || "");
    const password = String(req.body?.password || "");
    const normalizedPhone = normalizePhoneE164(rawPhone);
    if (!normalizedPhone || !password) {
      return res.status(400).json({ error: "Phone number and password are required." });
    }

    assertPhoneAuthRateLimit(req, normalizedPhone);
    const userRecord = await findUserByPhone(normalizedPhone, rawPhone);
    const email = normalizeEmail((userRecord as any)?.email);
    if (!userRecord || !email) {
      throw createHttpError(401, "Phone number or password is incorrect.");
    }

    const verified = await verifyFirebasePassword(email, password);
    if (verified.localId !== (userRecord as any).id) {
      throw createHttpError(401, "Phone number or password is incorrect.");
    }

    if ((userRecord as any).phone !== normalizedPhone) {
      await adminDb.collection("users").doc((userRecord as any).id).set({
        ...userRecord,
        phone: normalizedPhone,
        phoneVerified: Boolean((userRecord as any).phoneVerified)
      });
    }

    const customToken = await adminAuth.createCustomToken(verified.localId);
    return res.json({ customToken });
  } catch (err: any) {
    sendApiError(res, err);
  }
});

// 1. ME: Current active user profile
app.get("/api/me", authenticateUser, (req, res) => {
  res.json(req.user);
});

// 2. REGISTER USER (Email sign-up profile synchronization)
app.post("/api/register", authenticateUser, async (req, res) => {
  try {
    const { name, phone } = req.body;
    if (!req.user) return res.status(401).json({ error: "Chưa đăng nhập." });

    const userRef = adminDb.collection("users").doc(req.user.id);
    const requestedPhone = phone ? normalizePhoneE164(phone) : "";
    const existingPhone = normalizePhoneE164(req.user.phone);
    if (phone && !requestedPhone) {
      return res.status(400).json({ error: "Invalid phone number." });
    }
    if (requestedPhone && existingPhone && req.user.phoneVerified && requestedPhone !== existingPhone) {
      return res.status(400).json({ error: "Verified phone number cannot be replaced without a new OTP verification." });
    }
    const nameValidation = validateStudentDisplayName(name || req.user.name);
    if (!nameValidation.valid) {
      return res.status(400).json({ error: nameValidation.error });
    }
    const normalizedPhone = requestedPhone || existingPhone;
    const updatedProfile = {
      ...req.user,
      name: nameValidation.value,
      phone: normalizedPhone || undefined,
      phoneVerified: Boolean(req.user.phoneVerified && normalizedPhone && normalizedPhone === existingPhone),
      role: req.user.role,
      status: req.user.status,
      updatedAt: new Date().toISOString()
    };

    await userRef.set(updatedProfile);
    res.json(updatedProfile);
  } catch (err: any) {
    sendApiError(res, err);
  }
});

// 3. AI: Generate IPA phonetic transcription
app.post("/api/ai/ipa", authenticateUser, async (req, res) => {
  const { word } = req.body;
  try {
    if (!word || typeof word !== "string") {
      return res.status(400).json({ error: "Tham số 'word' là bắt buộc." });
    }

    const result = await generateAiText(
      `Provide the standard American English IPA phonetic transcription for the word/phrase: "${word}". Output ONLY the IPA string surrounded by slashes. Do not add any extra explanations or formatting.`
    );

    const ipa = result.text || `/${word.toLowerCase()}/`;
    res.json({
      ipa,
      aiProvider: result.provider,
      isFallback: result.provider === "fallback",
      aiErrors: result.errors
    });
  } catch (error: any) {
    console.warn("AI IPA generator service unavailable, returning fallback:", error.message);
    res.json({
      ipa: `/${(word || "").toLowerCase()}/`,
      isFallback: true,
      aiProvider: "fallback",
      aiErrors: [sanitizeAiError("AI", error)]
    });
  }
});

// Name-only student identity. This endpoint never accepts roles or permissions.
app.post("/api/guest-profiles/resolve", async (req, res) => {
  try {
    const profile = await resolveGuestProfile(
      req.body?.guestId,
      req.body?.displayName || req.body?.studentName,
      true,
      { classId: req.body?.classId, className: req.body?.className }
    );
    res.json({
      id: profile.id,
      guestId: profile.guestId || profile.id,
      displayName: profile.displayName || profile.name,
      status: profile.status,
      ...(profile.guestAccessToken
        ? {
            guestAccessToken: profile.guestAccessToken,
            guestAccessTokenVersion: profile.guestAccessTokenVersion || 1
          }
        : {})
    });
  } catch (err: any) {
    sendApiError(res, err);
  }
});

// Read-only identity check. A browser-stored name is never accepted without a matching guest id.
app.post("/api/guest-profiles/identify", async (req, res) => {
  try {
    const profile = await findExistingGuestIdentity(req.body?.guestId);
    if (!profile) {
      return res.status(404).json({
        error: "Không tìm thấy hồ sơ học sinh đã đăng ký.",
        code: "GUEST_PROFILE_NOT_FOUND"
      });
    }
    res.json({
      id: profile.id,
      guestId: profile.guestId || profile.id,
      displayName: profile.displayName || profile.name,
      status: profile.status || "active",
      legacy: Boolean(profile.legacy)
    });
  } catch (err: any) {
    sendApiError(res, err);
  }
});

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

const ALLOWED_PARTS_OF_SPEECH = [
  "Noun",
  "Pronoun",
  "Verb",
  "Adjective",
  "Adverb",
  "Preposition",
  "Conjunction",
  "Interjection",
  "Article",
  "Determiner"
];

function normalizePartOfSpeech(value: any) {
  const text = String(value || "").trim().toLowerCase();
  const match = ALLOWED_PARTS_OF_SPEECH.find(pos => pos.toLowerCase() === text);
  if (match) return match;

  if (text.includes("pronoun")) return "Pronoun";
  if (text.includes("adjective")) return "Adjective";
  if (text.includes("adverb")) return "Adverb";
  if (text.includes("preposition")) return "Preposition";
  if (text.includes("conjunction")) return "Conjunction";
  if (text.includes("interjection")) return "Interjection";
  if (text.includes("article")) return "Article";
  if (text.includes("determiner")) return "Determiner";
  if (text.includes("verb")) return "Verb";
  return "Noun";
}

function normalizeForExampleCheck(value: any) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isWeakVocabularyExample(example: any, word: string) {
  const normalizedExample = normalizeForExampleCheck(example);
  const normalizedWord = normalizeForExampleCheck(word);
  if (!normalizedExample || !normalizedWord) return true;
  if (!normalizedExample.includes(normalizedWord)) return true;
  return normalizedExample.startsWith("the word ") ||
    normalizedExample.startsWith("this word ") ||
    normalizedExample.includes("appears often in everyday english") ||
    normalizedExample.includes("students should practice") ||
    normalizedExample.includes("is a vocabulary word");
}

function hashText(value: string) {
  return Array.from(value || "").reduce((hash, char) => {
    return ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  }, 0);
}

function buildFallbackExample(word: string, meaning?: string) {
  const cleanWord = String(word || "").trim();
  const cleanMeaning = String(meaning || "").trim();
  const wordForSentence = cleanWord || "learning";
  const meaningForSentence = cleanMeaning || wordForSentence;
  const templates = [
    {
      example: `During a lively class discussion, ${wordForSentence} helped everyone connect the lesson with something useful in daily life.`,
      exampleMeaning: `Trong một buổi thảo luận sôi nổi trên lớp, ${meaningForSentence} đã giúp mọi người liên hệ bài học với điều hữu ích trong đời sống hằng ngày.`
    },
    {
      example: `After school, I wrote ${wordForSentence} in my notebook and used it in a sentence about my own day.`,
      exampleMeaning: `Sau giờ học, tôi viết ${meaningForSentence} vào vở và dùng nó trong một câu nói về ngày của chính mình.`
    },
    {
      example: `When the group project became difficult, ${wordForSentence} gave us a clear idea to explain our work with more confidence.`,
      exampleMeaning: `Khi bài làm nhóm trở nên khó hơn, ${meaningForSentence} đã cho chúng tôi một ý tưởng rõ ràng để giải thích bài làm tự tin hơn.`
    },
    {
      example: `At home, my younger brother asked about ${wordForSentence}, so I tried to explain it with a simple and funny example.`,
      exampleMeaning: `Ở nhà, em trai tôi hỏi về ${meaningForSentence}, nên tôi cố giải thích bằng một ví dụ đơn giản và thú vị.`
    },
    {
      example: `In the middle of the lesson, the teacher used ${wordForSentence} to turn a normal question into an interesting challenge.`,
      exampleMeaning: `Giữa giờ học, giáo viên đã dùng ${meaningForSentence} để biến một câu hỏi bình thường thành một thử thách thú vị.`
    },
    {
      example: `Before the quiz, I reviewed ${wordForSentence} carefully because small details can make a big difference in learning.`,
      exampleMeaning: `Trước bài kiểm tra, tôi ôn lại ${meaningForSentence} thật cẩn thận vì những chi tiết nhỏ có thể tạo nên khác biệt lớn trong học tập.`
    },
    {
      example: `My friend smiled when she finally understood ${wordForSentence}, and the whole exercise suddenly felt much easier.`,
      exampleMeaning: `Bạn tôi mỉm cười khi cuối cùng đã hiểu ${meaningForSentence}, và cả bài luyện tập bỗng trở nên dễ hơn nhiều.`
    },
    {
      example: `On the classroom board, ${wordForSentence} became the key idea that helped us remember the story behind the lesson.`,
      exampleMeaning: `Trên bảng lớp, ${meaningForSentence} trở thành ý chính giúp chúng tôi nhớ câu chuyện phía sau bài học.`
    }
  ];

  const index = Math.abs(hashText(`${wordForSentence}|${meaningForSentence}`)) % templates.length;
  return templates[index];
}

// 4. AI: Fill missing details for a single vocabulary row
app.post("/api/ai/vocab-detail", authenticateUser, async (req, res) => {
  const { word, meaning, grade } = req.body;
  try {
    if (!word || typeof word !== "string") {
      return res.status(400).json({ error: "Tham số 'word' là bắt buộc." });
    }

    const fallbackExample = buildFallbackExample(word, meaning);
    const fallback = {
      term: word,
      meaning: meaning || "",
      ipa: `/${word.toLowerCase()}/`,
      pos: "Noun",
      example: fallbackExample.example,
      exampleMeaning: fallbackExample.exampleMeaning,
      audioUrl: ""
    };

    const prompt = `Complete missing English vocabulary learning details for this row.
Word or phrase: "${word}"
Existing Vietnamese meaning, if any: "${meaning || ""}"
Target level: "${grade || "primary school"}"

Return ONLY one valid JSON object with:
- "meaning": concise Vietnamese meaning.
- "ipa": standard American English IPA transcription, surrounded by slashes.
- "pos": choose EXACTLY ONE value from this list: Noun, Pronoun, Verb, Adjective, Adverb, Preposition, Conjunction, Interjection, Article, Determiner. Do not return Phrase, Word/Phrase, or multiple labels.
- "example": write ONE complete English sentence that CONTAINS the exact vocabulary word or phrase "${word}" and uses it naturally in context. This is a sentence-making task, not a definition task. Do not write about "the word", "this word", or "vocabulary". Do not use short templates like "This is ...". Make the sentence close to daily life, warm, vivid, and long enough to include context, action, and details. Make the situation specific to "${word}" and "${meaning || ""}", not a reusable generic sentence. If the word naturally appears in a common expression, idiom, proverb, collocation, or everyday saying, use it.
- "exampleMeaning": Vietnamese translation of the example sentence.
- "audioUrl": leave as an empty string unless you have a direct public audio URL for pronunciation.`;

    const result = await generateAiText(prompt, {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          meaning: { type: Type.STRING },
          ipa: { type: Type.STRING },
          pos: { type: Type.STRING },
          example: { type: Type.STRING },
          exampleMeaning: { type: Type.STRING },
          audioUrl: { type: Type.STRING }
        },
        required: ["meaning", "ipa", "pos", "example", "exampleMeaning"]
      }
    });

    if (result.provider === "fallback") {
      return res.json({ ...fallback, isFallback: true, aiProvider: "fallback", aiErrors: result.errors });
    }

    const parsedData = parseAiJson(result.text);
    const exampleData = isWeakVocabularyExample(parsedData.example, word)
      ? buildFallbackExample(word, parsedData.meaning || meaning)
      : {
          example: parsedData.example,
          exampleMeaning: parsedData.exampleMeaning
        };
    res.json({
      ...fallback,
      ...parsedData,
      pos: normalizePartOfSpeech(parsedData.pos),
      example: exampleData.example,
      exampleMeaning: exampleData.exampleMeaning || parsedData.exampleMeaning || fallback.exampleMeaning,
      term: word,
      aiProvider: result.provider,
      aiErrors: result.errors
    });
  } catch (error: any) {
    console.warn("AI vocab detail service unavailable, returning fallback:", error.message);
    const fallbackExample = buildFallbackExample(word, meaning);
    res.json({
      term: word,
      meaning: meaning || "",
      ipa: `/${(word || "").toLowerCase()}/`,
      pos: "Noun",
      example: fallbackExample.example,
      exampleMeaning: fallbackExample.exampleMeaning,
      audioUrl: "",
      isFallback: true,
      aiProvider: "fallback",
      aiErrors: [sanitizeAiError("AI", error)]
    });
  }
});

// 5. AI: Batch generate full vocab set
app.post("/api/ai/generate", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
  const { topic, grade, wordsCount = 5 } = req.body;
  try {
    if (!topic || typeof topic !== "string") {
      return res.status(400).json({ error: "Tham số 'topic' là bắt buộc." });
    }

    const prompt = `Generate a JSON array of exactly ${wordsCount} English vocabulary words for topic: "${topic}" targeted for students at grade level: "${grade || 'primary school'}". 
    Each word item MUST have the following attributes:
    1. "term": English word or short phrase.
    2. "meaning": Vietnamese meaning.
    3. "ipa": Standard IPA phonetic transcription.
    4. "pos": choose EXACTLY ONE value from this list: Noun, Pronoun, Verb, Adjective, Adverb, Preposition, Conjunction, Interjection, Article, Determiner. Do not return Phrase, Word/Phrase, or multiple labels.
    5. "example": ONE complete English sentence that contains the exact vocabulary word or phrase and uses it naturally in context. This is a sentence-making task, not a definition task. Do not write about "the word", "this word", or "vocabulary". Avoid short template sentences like "This is ...". Every item must have a different situation and sentence structure; do not reuse one frame by replacing only the vocabulary word. Prefer a sentence close to daily life, warm, vivid, and long enough to include context, action, and details. If suitable, use a common collocation, idiom, proverb, or everyday expression naturally.
    6. "exampleMeaning": Vietnamese translation of that example.
    
    Make sure example sentences are easy to understand for the specified grade level but still rich, close to daily life, and interesting for students.
    Return ONLY valid JSON. Avoid markdown blocks.`;

    const result = await generateAiText(prompt, {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            term: { type: Type.STRING },
            meaning: { type: Type.STRING },
            ipa: { type: Type.STRING },
            pos: { type: Type.STRING },
            example: { type: Type.STRING },
            exampleMeaning: { type: Type.STRING }
          },
          required: ["term", "meaning", "ipa", "pos", "example", "exampleMeaning"]
        }
      }
    });

    if (result.provider === "fallback") {
      const fallbackList = getFallbackVocabulary(topic, wordsCount).map((item: any) => ({
        ...item,
        isFallback: true,
        aiProvider: "fallback",
        aiErrors: result.errors
      }));
      return res.json(fallbackList);
    }

    const parsedData = parseAiJson(result.text);
    res.json(Array.isArray(parsedData) ? parsedData.map((item: any) => {
      const fallbackExample = buildFallbackExample(item.term, item.meaning);
      const exampleData = isWeakVocabularyExample(item.example, item.term)
        ? fallbackExample
        : {
            example: item.example,
            exampleMeaning: item.exampleMeaning
          };

      return {
        ...item,
        pos: normalizePartOfSpeech(item.pos),
        example: exampleData.example,
        exampleMeaning: exampleData.exampleMeaning || item.exampleMeaning || fallbackExample.exampleMeaning,
        aiProvider: result.provider,
        aiErrors: result.errors
      };
    }) : []);
  } catch (error: any) {
    console.warn("AI generation service unavailable, returning fallback:", error.message);
    const fallbackList = getFallbackVocabulary(topic, wordsCount).map((item: any) => ({
      ...item,
      isFallback: true,
      aiProvider: "fallback",
      aiErrors: [sanitizeAiError("AI", error)]
    }));
    res.json(fallbackList);
  }
});

// 5. VOCAB SETS: Open an assignment/private set by share token
app.get("/api/vocab-sets/share/:token", async (req, res) => {
  try {
    const token = String(req.params.token || "").trim();
    if (!token) {
      return res.status(404).json({ error: "Không tìm thấy bài tập hoặc link không hợp lệ" });
    }

    const access = await resolveVocabLearningAccess(token);
    if (!access) {
      return res.status(404).json({ error: "Không tìm thấy bài tập hoặc link không hợp lệ" });
    }

    const found = access.assignment ? {
      ...normalizeVocabSetForRead(access.set),
      accessType: access.accessType,
      assignmentId: access.assignment.id,
      assignmentGameId: access.assignment.gameId,
      assignmentTitle: access.assignment.title,
      classId: access.assignment.classId,
      className: access.assignment.className
    } : {
      ...normalizeVocabSetForRead(access.set),
      accessType: access.accessType
    };

    res.json(stripPrivateVocabSetFields(found));
  } catch (err: any) {
    sendApiError(res, err);
  }
});

// 6. PUBLIC VOCAB SETS: Student home can study public sets without login
app.get("/api/public/vocab-sets", async (req, res) => {
  try {
    const snapshot = await adminDb.collection("vocab_sets").get();
    const list: any[] = [];

    snapshot.forEach(doc => {
      const set = doc.data();
      const normalizedVisibility = getVocabVisibility(set);
      if (normalizedVisibility !== "public") return;

      list.push(stripPrivateVocabSetFields({
        ...set,
        visibility: normalizedVisibility,
        status: toLegacyStatus(normalizedVisibility)
      }));
    });

    res.json(list);
  } catch (err: any) {
    sendApiError(res, err);
  }
});

// 7. PUBLIC GAME RESULTS: Minimal completed sessions for the student golden board
app.get("/api/public/results", async (req, res) => {
  try {
    const recentCutoff = new Date(Date.now() - ACTIVITY_TTL_MS).toISOString();
    const snapshot = await adminDb.collection("game_sessions")
      .where("completedAt", ">=", recentCutoff)
      .get();
    const grammarAttemptsSnapshot = await adminDb.collection("grammar_attempts")
      .where("completedAt", ">=", recentCutoff)
      .get();
    const listeningAttemptsSnapshot = await adminDb.collection("listening_attempts")
      .where("completedAt", ">=", recentCutoff)
      .get();
    const grammarSetsById = await getGrammarSetMap();
    const vocabSetsById = await getVocabSetMap();
    const assignmentsSnapshot = await adminDb.collection("assignments").get();
    const classesSnapshot = await adminDb.collection("classes").get();
    const membersSnapshot = await adminDb.collection("class_members").get();
    const assignmentsById = new Map<string, any>();
    const classesById = new Map<string, any>();
    const uniqueAssignmentClassByVocabSet = new Map<string, any | null>();
    const uniqueMemberClassByName = new Map<string, any | null>();

    classesSnapshot.forEach(doc => {
      const data = { id: doc.id, ...doc.data() };
      classesById.set(data.id, data);
    });

    assignmentsSnapshot.forEach(doc => {
      const data = { id: doc.id, ...doc.data() };
      assignmentsById.set(doc.id, data);
      if (data.id) assignmentsById.set(data.id, data);
      setUniqueClass(uniqueAssignmentClassByVocabSet, data.vocabSetId, {
        classId: data.classId,
        className: data.className || classesById.get(data.classId)?.name || ""
      });
    });

    membersSnapshot.forEach(doc => {
      const data = { id: doc.id, ...doc.data() };
      const className = data.className || classesById.get(data.classId)?.name || "";
      setUniqueClass(uniqueMemberClassByName, normalizePersonName(data.studentName), {
        classId: data.classId,
        className
      });
    });

    const list: any[] = [];
    const cutoff = Date.now() - ACTIVITY_TTL_MS;

    snapshot.forEach(doc => {
      const data = doc.data();
      if (!data.completedAt) return;
      if (isExpiredActivity(data)) return;
      if (new Date(getActivityTime(data)).getTime() < cutoff) return;
      const assignment = data.assignmentId ? assignmentsById.get(data.assignmentId) : null;
      const assignmentClass = assignment ? {
        classId: assignment.classId,
        className: assignment.className || classesById.get(assignment.classId)?.name || ""
      } : null;
      const vocabSetClass = uniqueAssignmentClassByVocabSet.get(data.vocabSetId) || null;
      const gradeClass = getLessonGradeClass(vocabSetsById.get(data.vocabSetId));
      const memberClass = uniqueMemberClassByName.get(normalizePersonName(data.studentName)) || null;
      const resolvedClass = data.classId
        ? {
            classId: data.classId,
            className: data.className || classesById.get(data.classId)?.name || ""
          }
        : assignmentClass?.classId
          ? assignmentClass
            : vocabSetClass?.classId
              ? vocabSetClass
              : gradeClass.classId
                ? gradeClass
                : memberClass?.classId
                  ? memberClass
                  : { classId: "", className: "" };

      list.push({
        id: data.id || doc.id,
        assignmentId: data.assignmentId,
        classId: resolvedClass.classId,
        className: resolvedClass.className,
        vocabSetId: data.vocabSetId,
        vocabSetTitle: data.vocabSetTitle,
        gameId: data.gameId,
        studentName: data.studentName,
        guestId: data.guestId,
        startedAt: data.startedAt,
        completedAt: data.completedAt,
        score: data.score || 0,
        totalQuestions: data.totalQuestions || 0,
        correctAnswers: data.correctAnswers || 0,
        incorrectAnswers: data.incorrectAnswers || 0,
        endedAt: data.endedAt || data.completedAt,
        durationMs: data.durationMs || 0,
        durationSeconds: data.durationSeconds || 0,
        accuracy: data.accuracy || 0,
        createdAt: data.createdAt,
        expiresAt: data.expiresAt
      });
    });

    grammarAttemptsSnapshot.forEach(doc => {
      const data = { id: doc.id, ...doc.data() };
      if (data.status !== "completed" || !data.completedAt) return;
      if (isExpiredActivity(data)) return;
      if (new Date(getActivityTime(data)).getTime() < cutoff) return;
      const activity = grammarAttemptToActivity(data, grammarSetsById.get(data.grammarSetId));
      delete activity.answerDetails;
      list.push(activity);
    });

    listeningAttemptsSnapshot.forEach(doc => {
      const data = { id: doc.id, ...doc.data() };
      if (!data.completedAt || new Date(getActivityTime(data)).getTime() < cutoff) return;
      list.push(listeningAttemptToActivity(data));
    });

    list.sort((a, b) => new Date(getActivityTime(b)).getTime() - new Date(getActivityTime(a)).getTime());
    const named = await enrichStudentNames(list);
    res.json(named.map(sanitizePublicStudentRecord));
  } catch (err: any) {
    sendApiError(res, err);
  }
});

app.get("/api/public/leaderboard-results", async (req, res) => {
  try {
    const list = await loadLeaderboardEventsFromSources();
    res.json(list.map(sanitizePublicStudentRecord));
  } catch (err: any) {
    sendApiError(res, err);
  }
});

// 6. VOCAB SETS: Get all vocab sets
app.get("/api/vocab-sets", authenticateUser, async (req, res) => {
  try {
    const { search, grade, status, visibility } = req.query;
    const snapshot = await adminDb.collection("vocab_sets").get();
    let list: any[] = [];
    snapshot.forEach(doc => {
      const set = doc.data();
      const normalizedVisibility = getVocabVisibility(set);
      list.push(stripPrivateVocabSetFields({
        ...set,
        visibility: normalizedVisibility,
        status: toLegacyStatus(normalizedVisibility)
      }));
    });

    // Filter list
    if (search) {
      const s = (search as string).toLowerCase();
      list = list.filter(set => 
        set.title.toLowerCase().includes(s) || 
        set.description.toLowerCase().includes(s) || 
        set.subject.toLowerCase().includes(s)
      );
    }

    if (grade) {
      list = list.filter(set => set.gradeLevel === grade);
    }

    if (status) {
      list = list.filter(set => set.status === status);
    }

    if (visibility) {
      list = list.filter(set => getVocabVisibility(set) === visibility);
    }

    list = list.filter(set => canViewVocabSet(req.user, set));

    res.json(list);
  } catch (err: any) {
    sendApiError(res, err);
  }
});

// 7. VOCAB SETS: Create new set
app.post("/api/vocab-sets", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
    const set = req.body;
    const id = `set-${Date.now()}`;
    const newSet = normalizeVocabSetForSave({
      ...set,
      id,
      createdAt: new Date().toISOString(),
      createdBy: req.user.id,
      creatorName: req.user.name
    });

    await adminDb.collection("vocab_sets").doc(id).set(newSet);
    if (newSet.ttsSettings?.autoGenerate) {
      enqueueVocabSetAudio(id, newSet.ttsSettings);
    }
    
    // Audit Log
    await logAuditAction(
      req.user.id,
      req.user.name,
      req.user.email,
      "CREATE_VOCAB_SET",
      `Đã tạo bộ từ vựng mới: "${newSet.title}" (${newSet.items.length} từ)`
    );

    res.status(201).json(stripPrivateVocabSetFields(newSet));
  } catch (err: any) {
    sendApiError(res, err);
  }
});

// 8. VOCAB SETS: Update set
app.put("/api/vocab-sets/:id", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
    const id = req.params.id;
    const payload = req.body;

    const docRef = adminDb.collection("vocab_sets").doc(id);
    const existingDoc = await docRef.get();
    if (!existingDoc.exists) {
      return res.status(404).json({ error: "Bộ từ vựng không tồn tại." });
    }

    if (!canManageVocabSet(req.user, existingDoc.data())) {
      return res.status(403).json({ error: "Ban khong co quyen sua bo tu vung nay." });
    }

    const updatedSet = normalizeVocabSetForSave({ ...payload, id }, existingDoc.data());

    await docRef.set(updatedSet);
    if (updatedSet.ttsSettings?.autoGenerate) {
      enqueueVocabSetAudio(id, updatedSet.ttsSettings);
    }

    // Audit Log
    await logAuditAction(
      req.user.id,
      req.user.name,
      req.user.email,
      "UPDATE_VOCAB_SET",
      `Đã chỉnh sửa bộ từ vựng: "${updatedSet.title}"`
    );

    res.json(stripPrivateVocabSetFields(updatedSet));
  } catch (err: any) {
    sendApiError(res, err);
  }
});

app.post("/api/tts/preview", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
  try {
    const settings = normalizeTtsSettings(req.body?.settings || req.body || {});
    const text = String(req.body?.text || "apple").trim();
    const force = Boolean(req.body?.force);
    if (!text) return res.status(400).json({ error: "Missing preview text." });

    const result = await generateCachedTtsAudio(text, settings, force);
    res.json({
      audioUrl: result.audioUrl,
      audioHash: result.audioHash,
      cached: result.cached,
      ttsText: result.ttsText,
      warnings: result.warnings
    });
  } catch (err: any) {
    sendApiError(res, err);
  }
});

app.post("/api/tts/batch-preview", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
  try {
    const settings = normalizeTtsSettings(req.body?.settings || {});
    const force = Boolean(req.body?.force);
    const rawItems = Array.isArray(req.body?.items) ? req.body.items.slice(0, 200) : [];
    if (rawItems.length === 0) return res.status(400).json({ error: "Missing TTS items." });

    const prepared = rawItems.map((item: any, index: number) => {
      const text = String(item?.text || item?.term || "").trim();
      const sanitized = sanitizeTtsInput(text);
      const audioHash = sanitized.text ? createAudioHash(sanitized.text, settings) : "";
      return {
        id: String(item?.id || `item-${index + 1}`),
        text,
        sanitized,
        audioHash
      };
    });

    const grouped = new Map<string, typeof prepared>();
    const invalidResults = new Map<string, any>();
    for (const item of prepared) {
      if (!item.sanitized.text) {
        invalidResults.set(item.id, {
          id: item.id,
          audioStatus: "failed",
          audioError: "Missing TTS text after cleanup.",
          ttsText: "",
          warnings: item.sanitized.warnings
        });
        continue;
      }
      const group = grouped.get(item.audioHash) || [];
      group.push(item);
      grouped.set(item.audioHash, group);
    }

    const generated = await runWithConcurrency([...grouped.entries()], TTS_CONCURRENCY, async ([audioHash, group]) => {
      try {
        const result = await generateCachedTtsAudio(group[0].sanitized.text, settings, force);
        return { audioHash, result, error: null as any };
      } catch (err: any) {
        return { audioHash, result: null as any, error: err };
      }
    });

    const generatedByHash = new Map(generated.map(item => [item.audioHash, item]));
    const items = prepared.map(item => {
      const invalid = invalidResults.get(item.id);
      if (invalid) return invalid;

      const generatedResult = generatedByHash.get(item.audioHash);
      if (!generatedResult || generatedResult.error) {
        return {
          id: item.id,
          audioHash: item.audioHash,
          audioStatus: "failed",
          audioError: generatedResult?.error?.message || "TTS generation failed.",
          ttsText: item.sanitized.text,
          warnings: item.sanitized.warnings,
          ttsProvider: settings.provider,
          ttsVoice: settings.voice,
          ttsLang: settings.lang,
          ttsSpeed: settings.speed
        };
      }

      return {
        id: item.id,
        audioUrl: generatedResult.result.audioUrl,
        audioHash: generatedResult.result.audioHash,
        audioStatus: "ready",
        audioError: "",
        cached: generatedResult.result.cached,
        ttsText: generatedResult.result.ttsText,
        warnings: generatedResult.result.warnings,
        ttsProvider: settings.provider,
        ttsVoice: settings.voice,
        ttsLang: settings.lang,
        ttsSpeed: settings.speed
      };
    });

    res.json({ items, concurrency: TTS_CONCURRENCY });
  } catch (err: any) {
    sendApiError(res, err);
  }
});

app.get("/api/tts/voices", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
  try {
    const apiKey = getAi33ApiKey();
    if (!apiKey) return res.status(500).json({ error: "AI33_API_KEY/TTS_API_KEY is not configured." });

    const params = new URLSearchParams();
    params.set("provider", String(req.query.provider || "edge"));
    if (req.query.language) params.set("language", String(req.query.language));
    if (req.query.gender) params.set("gender", String(req.query.gender));
    if (req.query.search || req.query.q) params.set("q", String(req.query.search || req.query.q));
    params.set("page_size", String(req.query.page_size || req.query.limit || 50));

    const upstream = await fetchWithTimeout(`https://api.ai33.pro/v3/voices?${params.toString()}`, {
      headers: { "xi-api-key": apiKey }
    });
    const data = await upstream.json().catch(() => ({}));
    res.status(upstream.status).json(data);
  } catch (err: any) {
    sendApiError(res, err);
  }
});

app.get("/api/vocab-sets/:id/audio/status", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
  try {
    const doc = await adminDb.collection("vocab_sets").doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: "Vocabulary set not found." });
    const set = doc.data();
    if (!canManageVocabSet(req.user, set)) {
      return res.status(403).json({ error: "Ban khong co quyen xem trang thai audio cua bo tu vung nay." });
    }
    const items = Array.isArray(set.items) ? set.items : [];
    res.json({
      id: set.id,
      items: items.map((item: any) => ({
        id: item.id,
        term: item.term,
        audioUrl: item.audioUrl,
        audioHash: item.audioHash,
        audioStatus: item.audioStatus || (item.audioUrl ? "ready" : "missing"),
        audioError: item.audioError || "",
        ttsProvider: item.ttsProvider,
        ttsVoice: item.ttsVoice,
        ttsLang: item.ttsLang,
        ttsSpeed: item.ttsSpeed,
        ttsText: item.ttsText,
        audioWarnings: item.audioWarnings || [],
        audioGeneratedAt: item.audioGeneratedAt,
        audioUpdatedAt: item.audioUpdatedAt
      }))
    });
  } catch (err: any) {
    sendApiError(res, err);
  }
});

app.post("/api/vocab-sets/:id/audio/generate-missing", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
  try {
    const doc = await adminDb.collection("vocab_sets").doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: "Vocabulary set not found." });
    if (!canManageVocabSet(req.user, doc.data())) {
      return res.status(403).json({ error: "Ban khong co quyen tao audio cho bo tu vung nay." });
    }

    const settings = normalizeTtsSettings(req.body?.settings || doc.data().ttsSettings || {});
    const itemIds = Array.isArray(req.body?.itemIds) ? req.body.itemIds.map(String) : undefined;
    const force = Boolean(req.body?.force);
    enqueueVocabSetAudio(req.params.id, settings, itemIds, force);
    res.json({ queued: true, itemIds: itemIds || null, force });
  } catch (err: any) {
    sendApiError(res, err);
  }
});

// 9. VOCAB SETS: Delete set
app.delete("/api/vocab-sets/:id", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
    const id = req.params.id;

    const docRef = adminDb.collection("vocab_sets").doc(id);
    const existing = await docRef.get();
    if (!existing.exists) {
      return res.status(404).json({ error: "Bộ từ vựng không tồn tại." });
    }

    if (!canManageVocabSet(req.user, existing.data())) {
      return res.status(403).json({ error: "Ban khong co quyen xoa bo tu vung nay." });
    }

    const setDetails = existing.data();
    const relatedAssignmentsForDelete = await adminDb.collection("assignments").where("vocabSetId", "==", id).get();
    if (!isSuperAdmin(req.user)) {
      const classesSnapshot = await adminDb.collection("classes").get();
      const classesById = new Map<string, any>();
      classesSnapshot.forEach(doc => {
        const classData = { id: doc.id, ...doc.data() };
        classesById.set(classData.id, classData);
      });

      for (const assignmentDoc of relatedAssignmentsForDelete.docs || []) {
        const assignment = { id: assignmentDoc.id, ...assignmentDoc.data() };
        const classData = assignment.classId ? classesById.get(assignment.classId) : null;
        if (!canManageAssignment(req.user, assignment, classData)) {
          return res.status(403).json({ error: "Bo tu vung nay dang duoc giao cho lop ban khong quan ly." });
        }
      }
    }

    await docRef.delete();

    // Clean up related assignments
    const batch = adminDb.batch();
    relatedAssignmentsForDelete.forEach(doc => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    // Audit Log
    await logAuditAction(
      req.user.id,
      req.user.name,
      req.user.email,
      "DELETE_VOCAB_SET",
      `Đã xóa bộ từ vựng: "${setDetails?.title}"`
    );

    res.json({ success: true });
  } catch (err: any) {
    sendApiError(res, err);
  }
});

// 10. VOCAB SETS: Clone set
app.post("/api/vocab-sets/:id/clone", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
    const id = req.params.id;

    const existing = await adminDb.collection("vocab_sets").doc(id).get();
    if (!existing.exists) {
      return res.status(404).json({ error: "Bộ từ vựng không tồn tại." });
    }

    const original = existing.data() || {};
    if (!canViewVocabSet(req.user, original)) {
      return res.status(403).json({ error: "Ban khong co quyen nhan ban bo tu vung nay." });
    }
    const cloneId = `set-${Date.now()}`;
    const clone = normalizeVocabSetForSave({
      ...original,
      id: cloneId,
      title: `${original.title} (Nhân bản)`,
      visibility: "draft",
      status: "draft",
      createdAt: new Date().toISOString(),
      createdBy: req.user.id,
      creatorName: req.user.name
    });

    await adminDb.collection("vocab_sets").doc(cloneId).set(clone);

    // Audit Log
    await logAuditAction(
      req.user.id,
      req.user.name,
      req.user.email,
      "CLONE_VOCAB_SET",
      `Đã nhân bản bộ từ vựng: "${original.title}" thành "${clone.title}"`
    );

    res.json(stripPrivateVocabSetFields(clone));
  } catch (err: any) {
    sendApiError(res, err);
  }
});

// 11. CLASSES: Get all classes
app.get("/api/classes", authenticateUser, async (req, res) => {
  try {
    const snapshot = await adminDb.collection("classes").get();
    const list: any[] = [];
    snapshot.forEach(doc => {
      const classData = { id: doc.id, ...doc.data() };
      if (canViewClass(req.user, classData)) list.push(classData);
    });
    res.json(list);
  } catch (err: any) {
    sendApiError(res, err);
  }
});

// 11. CLASSES: Create class
app.post("/api/classes", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
    const payload = req.body;
    const id = `class-${Date.now()}`;
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newClass = {
      ...payload,
      id,
      code,
      teacherId: req.user.id,
      createdAt: new Date().toISOString()
    };

    await adminDb.collection("classes").doc(id).set(newClass);

    // Audit Log
    await logAuditAction(
      req.user.id,
      req.user.name,
      req.user.email,
      "CREATE_CLASS",
      `Đã tạo lớp học mới: "${newClass.name}" (Mã mời: ${newClass.code})`
    );

    res.status(201).json(newClass);
  } catch (err: any) {
    sendApiError(res, err);
  }
});

// 12. CLASSES: Delete class
app.delete("/api/classes/:id", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
    const id = req.params.id;

    const classRef = adminDb.collection("classes").doc(id);
    const existing = await classRef.get();
    if (!existing.exists) {
      return res.status(404).json({ error: "Lớp học không tồn tại." });
    }

    if (!canManageClass(req.user, existing.data())) {
      return res.status(403).json({ error: "Ban khong co quyen xoa lop hoc nay." });
    }

    const classDetails = existing.data();
    await classRef.delete();

    // Clean class members
    const membersSnapshot = await adminDb.collection("class_members").where("classId", "==", id).get();
    const batch = adminDb.batch();
    membersSnapshot.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    // Clean assignments
    const assignmentsSnapshot = await adminDb.collection("assignments").where("classId", "==", id).get();
    const batch2 = adminDb.batch();
    assignmentsSnapshot.forEach(doc => batch2.delete(doc.ref));
    await batch2.commit();

    // Audit Log
    await logAuditAction(
      req.user.id,
      req.user.name,
      req.user.email,
      "DELETE_CLASS",
      `Đã xóa lớp học: "${classDetails?.name}"`
    );

    res.json({ success: true });
  } catch (err: any) {
    sendApiError(res, err);
  }
});

// 13. CLASS MEMBERS: Get class members
app.get("/api/class-members", authenticateUser, async (req, res) => {
  try {
    const classesSnapshot = await adminDb.collection("classes").get();
    const classesById = new Map<string, any>();
    classesSnapshot.forEach(doc => {
      const classData = { id: doc.id, ...doc.data() };
      classesById.set(classData.id, classData);
    });

    const snapshot = await adminDb.collection("class_members").get();
    const list: any[] = [];
    snapshot.forEach(doc => {
      const member = { id: doc.id, ...doc.data() };
      const classData = member.classId ? classesById.get(member.classId) : null;
      if (classData && canViewClass(req.user, classData)) list.push(member);
    });
    res.json(list);
  } catch (err: any) {
    sendApiError(res, err);
  }
});

// 14. CLASS MEMBERS: Add member
app.post("/api/classes/:classId/members", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
  try {
    const classId = req.params.classId;
    const { studentName } = req.body;
    const classDoc = await adminDb.collection("classes").doc(classId).get();
    if (!classDoc.exists) return res.status(404).json({ error: "Class not found." });
    if (!canManageClass(req.user, classDoc.data())) {
      return res.status(403).json({ error: "Ban khong co quyen them hoc sinh vao lop nay." });
    }
    const id = `member-${Date.now()}`;
    const newMember = {
      id,
      classId,
      studentName
    };

    await adminDb.collection("class_members").doc(id).set(newMember);
    res.status(201).json(newMember);
  } catch (err: any) {
    sendApiError(res, err);
  }
});

// 15. CLASS MEMBERS: Delete member
app.delete("/api/classes/:classId/members/:memberId", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
  try {
    const classId = req.params.classId;
    const memberId = req.params.memberId;
    const classDoc = await adminDb.collection("classes").doc(classId).get();
    if (!classDoc.exists) return res.status(404).json({ error: "Class not found." });
    if (!canManageClass(req.user, classDoc.data())) {
      return res.status(403).json({ error: "Ban khong co quyen xoa hoc sinh khoi lop nay." });
    }
    const memberDoc = await adminDb.collection("class_members").doc(memberId).get();
    if (!memberDoc.exists || memberDoc.data()?.classId !== classId) {
      return res.status(404).json({ error: "Class member not found." });
    }
    await adminDb.collection("class_members").doc(memberId).delete();
    res.json({ success: true });
  } catch (err: any) {
    sendApiError(res, err);
  }
});

// 16. ASSIGNMENTS: Get assignments
app.get("/api/assignments", authenticateUser, async (req, res) => {
  try {
    const classesSnapshot = await adminDb.collection("classes").get();
    const classesById = new Map<string, any>();
    classesSnapshot.forEach(doc => {
      const classData = { id: doc.id, ...doc.data() };
      classesById.set(classData.id, classData);
    });

    const snapshot = await adminDb.collection("assignments").get();
    const list: any[] = [];
    for (const doc of snapshot.docs || []) {
      const assignment = await ensureAssignmentShareToken({ id: doc.id, ...doc.data() }, doc.ref);
      const classData = assignment.classId ? classesById.get(assignment.classId) : null;
      if (canManageAssignment(req.user, assignment, classData)) list.push(assignment);
    }
    res.json(list);
  } catch (err: any) {
    sendApiError(res, err);
  }
});

// 17. ASSIGNMENTS: Create assignment
app.post("/api/assignments", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
    const payload = req.body;
    const id = `assign-${Date.now()}`;
    const classDoc = await adminDb.collection("classes").doc(String(payload.classId || "")).get();
    if (!classDoc.exists) return res.status(404).json({ error: "Class not found." });
    const classData = { id: classDoc.id, ...classDoc.data() };
    if (!canManageClass(req.user, classData)) {
      return res.status(403).json({ error: "Ban khong co quyen giao bai cho lop nay." });
    }

    const resourceType = payload.resourceType === "listening"
      ? "listening"
      : payload.resourceType === "mover_reading_writing"
        ? "mover_reading_writing"
        : "vocabulary";
    let resource: any;
    if (resourceType === "listening") {
      const resourceId = String(payload.resourceId || payload.listeningSetId || "");
      const listeningDoc = await adminDb.collection("listening_sets").doc(resourceId).get();
      if (!listeningDoc.exists) return res.status(404).json({ error: "Listening set not found." });
      resource = { id: listeningDoc.id, ...listeningDoc.data() };
      const canManageListening = req.user.role === "super_admin"
        || (req.user.role === "teacher" && resource.ownerId === req.user.id);
      if (!canManageListening || resource.status !== "published" || resource.visibility === "draft") {
        return res.status(403).json({ error: "Bạn không có quyền giao bộ đề nghe này." });
      }
    } else if (resourceType === "mover_reading_writing") {
      const resourceId = String(payload.resourceId || payload.moverReadingWritingSetId || "");
      const readingWritingDoc = await adminDb.collection("mover_reading_sets").doc(resourceId).get();
      if (!readingWritingDoc.exists) return res.status(404).json({ error: "Mover Reading & Writing set not found." });
      resource = { id: readingWritingDoc.id, ...readingWritingDoc.data() };
      const canManageReadingWriting = req.user.role === "super_admin"
        || (req.user.role === "teacher" && resource.ownerId === req.user.id);
      if (!canManageReadingWriting || resource.status !== "published" || resource.visibility === "draft") {
        return res.status(403).json({ error: "Bạn không có quyền giao bộ đề Mover Reading & Writing này." });
      }
    } else {
      const vocabDoc = await adminDb.collection("vocab_sets").doc(String(payload.vocabSetId || payload.resourceId || "")).get();
      if (!vocabDoc.exists) return res.status(404).json({ error: "Vocabulary set not found." });
      resource = { id: vocabDoc.id, ...vocabDoc.data() };
      if (!canViewVocabSet(req.user, resource) || getVocabVisibility(resource) === "draft") {
        return res.status(403).json({ error: "Ban khong co quyen giao bo tu vung nay." });
      }
    }

    const shareToken = createShareToken();
    const newAssign = {
      ...payload,
      id,
      shareToken,
      assignmentSlug: shareToken,
      classId: classData.id,
      className: classData.name || payload.className || "",
      resourceType,
      resourceId: resource.id,
      resourceTitle: resource.title || payload.resourceTitle || "",
      ...(resourceType === "vocabulary"
        ? {
            vocabSetId: resource.id,
            vocabSetTitle: resource.title || payload.vocabSetTitle || ""
          }
        : resourceType === "listening" ? {
            listeningSetId: resource.id,
            listeningSetTitle: resource.title || payload.resourceTitle || "",
            gameId: "listening-five-part"
          } : {
            moverReadingWritingSetId: resource.id,
            moverReadingWritingSetTitle: resource.title || payload.resourceTitle || "",
            gameId: "mover-reading-writing"
          }),
      createdAt: new Date().toISOString(),
      createdBy: req.user.id
    };

    await adminDb.collection("assignments").doc(id).set(newAssign);

    // Audit Log
    await logAuditAction(
      req.user.id,
      req.user.name,
      req.user.email,
      "CREATE_ASSIGNMENT",
      `Đã giao bài tập mới: "${newAssign.title}" cho lớp: ${newAssign.className}`
    );

    res.status(201).json(newAssign);
  } catch (err: any) {
    sendApiError(res, err);
  }
});

// 18. ASSIGNMENTS: Delete assignment
app.delete("/api/assignments/:id", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
    const id = req.params.id;

    const docRef = adminDb.collection("assignments").doc(id);
    const existing = await docRef.get();
    if (!existing.exists) {
      return res.status(404).json({ error: "Bài tập không tồn tại." });
    }

    const assignDetails = { id: existing.id || id, ...existing.data() };
    const classDoc = assignDetails.classId ? await adminDb.collection("classes").doc(assignDetails.classId).get() : null;
    const classData = classDoc?.exists ? { id: classDoc.id, ...classDoc.data() } : null;
    if (!canManageAssignment(req.user, assignDetails, classData)) {
      return res.status(403).json({ error: "Ban khong co quyen xoa bai giao nay." });
    }

    await docRef.delete();

    // Audit Log
    await logAuditAction(
      req.user.id,
      req.user.name,
      req.user.email,
      "DELETE_ASSIGNMENT",
      `Đã xóa/thu hồi bài tập: "${assignDetails?.title}" của lớp: ${assignDetails?.className}`
    );

    res.json({ success: true });
  } catch (err: any) {
    sendApiError(res, err);
  }
});

// 19. GRAMMAR SETS: List grammar lessons
app.get("/api/public/grammar-sets", async (req, res) => {
  try {
    const snapshot = await adminDb.collection("grammar_sets").get();
    const list: any[] = [];
    snapshot.forEach(doc => {
      const set = { id: doc.id, ...doc.data() };
      if (getGrammarVisibility(set) !== "public") return;
      list.push(sanitizeGrammarSetForStudent(set));
    });
    list.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime());
    res.json(list);
  } catch (err: any) {
    sendApiError(res, err);
  }
});

app.get("/api/grammar-sets", authenticateUser, async (req, res) => {
  try {
    const snapshot = await adminDb.collection("grammar_sets").get();
    const list: any[] = [];
    snapshot.forEach(doc => {
      const set = { id: doc.id, ...doc.data() };
      if (!canViewGrammarSet(req.user, set)) return;
      list.push(req.user?.role === "student" ? sanitizeGrammarSetForStudent(set) : set);
    });
    list.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime());
    res.json(list);
  } catch (err: any) {
    sendApiError(res, err);
  }
});

app.get("/api/grammar-sets/share/:token", async (req, res) => {
  try {
    const token = String(req.params.token || "").trim();
    if (!token) {
      return res.status(404).json({ error: "Không tìm thấy bài ngữ pháp hoặc link không hợp lệ." });
    }

    const snapshot = await adminDb.collection("grammar_sets").get();
    let found: any = null;
    snapshot.forEach(doc => {
      const set = { id: doc.id, ...doc.data() };
      const setToken = set.shareToken || set.assignmentSlug;
      const legacyGrammarToken = setToken?.startsWith("grammar-") ? setToken.slice("grammar-".length) : `grammar-${setToken}`;
      if (!found && (setToken === token || legacyGrammarToken === token) && getGrammarVisibility(set) === "assignment") {
        found = set;
      }
    });

    if (!found) {
      return res.status(404).json({ error: "Không tìm thấy bài ngữ pháp hoặc link không hợp lệ." });
    }

    res.json(sanitizeGrammarSetForStudent(found));
  } catch (err: any) {
    sendApiError(res, err);
  }
});

app.get("/api/grammar-sets/:id", authenticateUser, async (req, res) => {
  try {
    const set = await getGrammarSetOr404(req.params.id);
    if (!set) return res.status(404).json({ error: "Bài ngữ pháp không tồn tại." });
    if (!canViewGrammarSet(req.user, set)) {
      return res.status(403).json({ error: "Bạn không có quyền mở bài ngữ pháp này." });
    }
    res.json(req.user?.role === "student" ? sanitizeGrammarSetForStudent(set) : set);
  } catch (err: any) {
    sendApiError(res, err);
  }
});

app.post("/api/admin/grammar-sets", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
    const id = makeId("grammar-set");
    const set = normalizeGrammarSetForSave({ ...req.body, id }, {}, req.user);
    await adminDb.collection("grammar_sets").doc(id).set(set);

    await logAuditAction(
      req.user.id,
      req.user.name,
      req.user.email,
      "CREATE_GRAMMAR_SET",
      `Đã tạo bài ngữ pháp: "${set.title}" (${set.questions.length} câu)`
    );

    res.status(201).json(set);
  } catch (err: any) {
    sendApiError(res, err);
  }
});

app.put("/api/admin/grammar-sets/:id", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
    const existing = await getGrammarSetOr404(req.params.id);
    if (!existing) return res.status(404).json({ error: "Bài ngữ pháp không tồn tại." });
    if (!canManageGrammarSet(req.user, existing)) return res.status(403).json({ error: "Bạn không có quyền sửa bài này." });

    const set = normalizeGrammarSetForSave({ ...req.body, id: req.params.id }, existing, req.user);
    await adminDb.collection("grammar_sets").doc(req.params.id).set(set);

    await logAuditAction(
      req.user.id,
      req.user.name,
      req.user.email,
      "UPDATE_GRAMMAR_SET",
      `Đã cập nhật bài ngữ pháp: "${set.title}"`
    );

    res.json(set);
  } catch (err: any) {
    sendApiError(res, err);
  }
});

app.delete("/api/admin/grammar-sets/:id", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
    const existing = await getGrammarSetOr404(req.params.id);
    if (!existing) return res.status(404).json({ error: "Bài ngữ pháp không tồn tại." });
    if (!canManageGrammarSet(req.user, existing)) return res.status(403).json({ error: "Bạn không có quyền xóa bài này." });

    await adminDb.collection("grammar_sets").doc(req.params.id).delete();
    await logAuditAction(
      req.user.id,
      req.user.name,
      req.user.email,
      "DELETE_GRAMMAR_SET",
      `Đã xóa bài ngữ pháp: "${existing.title}"`
    );

    res.json({ success: true });
  } catch (err: any) {
    sendApiError(res, err);
  }
});

app.post("/api/admin/grammar-sets/:id/clone", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
    const existing = await getGrammarSetOr404(req.params.id);
    if (!existing) return res.status(404).json({ error: "Bài ngữ pháp không tồn tại." });
    if (!canViewGrammarSet(req.user, existing)) return res.status(403).json({ error: "Ban khong co quyen nhan ban bai nay." });
    const cloneId = makeId("grammar-set");
    const clone = normalizeGrammarSetForSave({
      ...existing,
      id: cloneId,
      title: `${existing.title} (Bản sao)`,
      visibility: "draft",
      questions: existing.questions
    }, {}, req.user);
    await adminDb.collection("grammar_sets").doc(cloneId).set(clone);
    res.status(201).json(clone);
  } catch (err: any) {
    sendApiError(res, err);
  }
});

app.post("/api/grammar-sets/:id/attempts/prepare", authenticateOptionalUser, async (req, res) => {
  const timing = createApiTiming(req, "POST /api/grammar-sets/:id/attempts/prepare");
  try {
    if (!LAZY_SESSION_V3_ENABLED) return res.status(404).json({ error: "Lazy session v3 is disabled." });
    const credentials = getClientRunCredentials(req.body || {});
    const actor = await getGrammarActor(req);
    timing.mark("identity");
    if (!actor) return res.status(401).json({ error: "Vui long nhap ten hoc sinh de luyen ngu phap." });
    const set = await getGrammarSetOr404(req.params.id);
    timing.mark("set_read");
    if (!set) return res.status(404).json({ error: "Bai ngu phap khong ton tai." });
    if (!canOpenGrammarSetForLearning(set, actor, req)) {
      return res.status(403).json({ error: "Ban khong co quyen lam bai nay." });
    }

    const maxAttempts = Math.max(1, Number(set.maxAttempts || 1));
    const actorField = actor.isGuest ? "guestId" : "userId";
    const attemptsSnapshot = await adminDb.collection("grammar_attempts")
      .where("grammarSetId", "==", set.id)
      .where(actorField, "==", actor.id)
      .where("status", "==", "completed")
      .limit(maxAttempts)
      .get();
    timing.mark("attempt_limit");
    if (attemptsSnapshot.size >= maxAttempts) {
      return res.status(403).json({ error: "Ban da het so lan lam bai duoc phep." });
    }

    const prepared = buildPreparedGrammarAttempt(set, actor, req.body || {}, credentials.clientRunId, credentials.runSecret);
    timing.finish(res);
    res.json(sanitizeAttemptForStudent(prepared, false, credentials.runSecret));
  } catch (err: any) {
    timing.finish(res);
    sendApiError(res, err);
  }
});

app.post("/api/grammar-sets/:id/attempts/activate", authenticateOptionalUser, async (req, res) => {
  const timing = createApiTiming(req, "POST /api/grammar-sets/:id/attempts/activate");
  try {
    if (!LAZY_SESSION_V3_ENABLED) return res.status(404).json({ error: "Lazy session v3 is disabled." });
    const payload = req.body || {};
    const credentials = getClientRunCredentials(payload);
    const actor = await getGrammarActor(req);
    timing.mark("identity");
    if (!actor) return res.status(401).json({ error: "Vui long nhap ten hoc sinh de luyen ngu phap." });
    const set = await getGrammarSetOr404(req.params.id);
    timing.mark("set_read");
    if (!set) return res.status(404).json({ error: "Bai ngu phap khong ton tai." });
    if (!canOpenGrammarSetForLearning(set, actor, req)) {
      return res.status(403).json({ error: "Ban khong co quyen lam bai nay." });
    }

    const attemptId = deterministicRunDocumentId("grammar-attempt-v2", [actor.id, set.id, credentials.clientRunId]);
    const docRef = adminDb.collection("grammar_attempts").doc(attemptId);
    const existingDoc = await docRef.get();
    timing.mark("idempotency_lookup");
    if (existingDoc.exists) {
      const existingAttempt = existingDoc.data();
      if (!canAccessGrammarAttempt(existingAttempt, actor, set, req)) {
        return res.status(403).json({ error: "Ban khong co quyen tiep tuc luot lam bai nay." });
      }
      const existingAnswer = (existingAttempt.answers || []).find((item: any) => item.attemptQuestionId === payload.attemptQuestionId);
      if (existingAnswer) {
        const feedback = buildGrammarAnswerFeedback(existingAttempt, set, existingAnswer);
        timing.finish(res);
        return res.json({
          attempt: sanitizeAttemptForStudent(existingAttempt, false, credentials.runSecret),
          answer: sanitizeGrammarAnswerForStudent(existingAnswer, Boolean(feedback)),
          feedback,
          alreadyActivated: true
        });
      }
      if (existingAttempt.status === "completed") {
        timing.finish(res);
        return res.json({ attempt: sanitizeAttemptForStudent(existingAttempt, Boolean(set.showReviewAfterSubmit), credentials.runSecret), alreadyCompleted: true });
      }
      const { answer, feedback } = buildGrammarAttemptAnswer(existingAttempt, set, payload);
      const answers = [...(existingAttempt.answers || []).filter((item: any) => item.attemptQuestionId !== answer.attemptQuestionId), answer];
      const updatedAt = new Date().toISOString();
      const updatedAttempt = { ...existingAttempt, status: "in_progress", answers, lastSavedAt: updatedAt, updatedAt };
      const batch = adminDb.batch();
      batch.set(docRef, updatedAttempt);
      appendLearningHistoryProjection(
        batch,
        projectGrammarAttempt(updatedAttempt, set, {
          detailRetentionDays: ATTEMPT_DETAIL_RETENTION_DAYS,
          includeDetail: false
        })
      );
      await batch.commit();
      timing.mark("persist");
      timing.finish(res);
      return res.json({
        attempt: sanitizeAttemptForStudent(updatedAttempt, false, credentials.runSecret),
        answer: sanitizeGrammarAnswerForStudent(answer, Boolean(feedback)),
        feedback,
        alreadyActivated: true
      });
    }

    if (safeText(payload.grammarSetVersion, 160) !== getGrammarSetVersion(set)) {
      return res.status(409).json({ error: "Bai da duoc cap nhat. Hay bat dau lai de nhan noi dung moi." });
    }
    const maxAttempts = Math.max(1, Number(set.maxAttempts || 1));
    const actorField = actor.isGuest ? "guestId" : "userId";
    const attemptsSnapshot = await adminDb.collection("grammar_attempts")
      .where("grammarSetId", "==", set.id)
      .where(actorField, "==", actor.id)
      .where("status", "==", "completed")
      .limit(maxAttempts)
      .get();
    timing.mark("attempt_limit");
    if (attemptsSnapshot.size >= maxAttempts) {
      return res.status(403).json({ error: "Ban da het so lan lam bai duoc phep." });
    }

    const prepared = buildPreparedGrammarAttempt(set, actor, payload, credentials.clientRunId, credentials.runSecret);
    const { answer, feedback } = buildGrammarAttemptAnswer(prepared, set, payload);
    const now = new Date().toISOString();
    const activated = {
      ...prepared,
      status: "in_progress",
      activatedAt: now,
      lastSavedAt: now,
      updatedAt: now,
      answers: [answer]
    };
    const batch = adminDb.batch();
    batch.set(docRef, activated);
    appendLearningHistoryProjection(
      batch,
      projectGrammarAttempt(activated, set, {
        detailRetentionDays: ATTEMPT_DETAIL_RETENTION_DAYS,
        includeDetail: false
      })
    );
    await batch.commit();
    timing.mark("persist");
    timing.finish(res);
    res.status(201).json({
      attempt: sanitizeAttemptForStudent(activated, false, credentials.runSecret),
      answer: sanitizeGrammarAnswerForStudent(answer, Boolean(feedback)),
      feedback
    });
  } catch (err: any) {
    timing.finish(res);
    sendApiError(res, err);
  }
});

app.post("/api/grammar-sets/:id/attempts", authenticateOptionalUser, async (req, res) => {
  const timing = createApiTiming(req, "POST /api/grammar-sets/:id/attempts");
  try {
    const actor = await getGrammarActor(req);
    timing.mark("identity");
    if (!actor) return res.status(401).json({ error: "Vui lòng nhập tên học sinh để luyện ngữ pháp." });
    const set = await getGrammarSetOr404(req.params.id);
    timing.mark("set_read");
    if (!set) return res.status(404).json({ error: "Bài ngữ pháp không tồn tại." });
    if (!canOpenGrammarSetForLearning(set, actor, req)) {
      return res.status(403).json({ error: "Bạn không có quyền làm bài này." });
    }

    const maxAttempts = Math.max(1, Number(set.maxAttempts || 1));
    const actorField = actor.isGuest ? "guestId" : "userId";
    const attemptsSnapshot = await adminDb.collection("grammar_attempts")
      .where("grammarSetId", "==", set.id)
      .where(actorField, "==", actor.id)
      .where("status", "==", "completed")
      .limit(maxAttempts)
      .get();
    timing.mark("attempt_limit");
    if (attemptsSnapshot.size >= maxAttempts) {
      return res.status(403).json({ error: "Bạn đã hết số lần làm bài được phép." });
    }

    const now = new Date().toISOString();
    const questions = set.shuffleQuestions ? fisherYates(set.questions || []) : [...(set.questions || [])];
    const attemptQuestions = questions.map((question: any, index: number) => {
      const questionType = getGrammarQuestionType(question.questionType, getGrammarQuestionType(set.questionType));
      const options = questionType === "multiple_choice" && set.shuffleOptions
        ? fisherYates(question.options || [])
        : [...(question.options || [])];
      return {
        id: makeId(`grammar-attempt-question-${index + 1}`),
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

    const attemptId = makeId("grammar-attempt");
    const attemptToken = actor.isGuest ? createSessionToken() : "";
    const attempt = {
      id: attemptId,
      grammarSetId: set.id,
      grammarSetTitle: set.title,
      assignmentId: req.body?.assignmentId || "",
      userId: actor.id,
      studentId: actor.id,
      guestId: actor.isGuest ? actor.id : "",
      studentName: actor.name,
      classId: req.body?.classId || set.classId || getLessonGradeClass(set).classId || "",
      className: req.body?.className || set.className || getLessonGradeClass(set).className || "",
      status: "in_progress",
      score: 0,
      maxScore: attemptQuestions.reduce((sum: number, question: any) => sum + Number(question.scoreSnapshot || 1), 0),
      correctCount: 0,
      wrongCount: 0,
      unansweredCount: attemptQuestions.length,
      startedAt: now,
      createdAt: now,
      questions: attemptQuestions,
      answers: [],
      reviewPolicySnapshot: {
        showReviewAfterSubmit: set.showReviewAfterSubmit !== false,
        showExplanationImmediately: Boolean(set.showExplanationImmediately),
        policyVersion: 1,
        capturedAt: now
      },
      attemptTokenHash: attemptToken ? hashSessionToken(attemptToken) : ""
    };

    const batch = adminDb.batch();
    batch.set(adminDb.collection("grammar_attempts").doc(attemptId), attempt);
    appendLearningHistoryProjection(
      batch,
      projectGrammarAttempt(attempt, set, {
        detailRetentionDays: ATTEMPT_DETAIL_RETENTION_DAYS,
        includeDetail: false
      })
    );
    await batch.commit();
    timing.mark("persist");
    timing.finish(res);
    res.status(201).json(sanitizeAttemptForStudent(attempt, false, attemptToken));
  } catch (err: any) {
    timing.finish(res);
    sendApiError(res, err);
  }
});

app.post("/api/grammar-attempts/:attemptId/answers", authenticateOptionalUser, async (req, res) => {
  const timing = createApiTiming(req, "POST /api/grammar-attempts/:attemptId/answers");
  try {
    const actor = await getGrammarActor(req);
    timing.mark("identity");
    if (!actor) return res.status(401).json({ error: "Vui lòng nhập tên học sinh để luyện ngữ pháp." });
    const attempt = await getGrammarAttemptOr404(req.params.attemptId);
    timing.mark("attempt_read");
    if (!attempt) return res.status(404).json({ error: "Lượt làm bài không tồn tại." });
    const set = await getGrammarSetOr404(attempt.grammarSetId);
    timing.mark("set_read");
    if (!canAccessGrammarAttempt(attempt, actor, set, req)) return res.status(403).json({ error: "Bạn không có quyền sửa lượt làm bài này." });
    if (attempt.status === "completed") return res.status(400).json({ error: "Bài đã nộp, không thể thay đổi đáp án." });

    const attemptQuestion = (attempt.questions || []).find((question: any) => question.id === req.body?.attemptQuestionId);
    if (!attemptQuestion) return res.status(400).json({ error: "Câu hỏi không hợp lệ." });
    const questionType = getGrammarQuestionType(attemptQuestion.questionType, getGrammarQuestionType(set?.questionType));
    const selectedOptionId = questionType === "multiple_choice" ? String(req.body?.selectedOptionId || "") : "";
    const textAnswer = questionType === "rewrite" ? safeText(req.body?.textAnswer, 4000) : "";

    if (questionType === "multiple_choice") {
      const selectedOption = (attemptQuestion.optionsSnapshot || []).find((option: any) => option.id === selectedOptionId);
      if (!selectedOption) return res.status(400).json({ error: "Phương án đã chọn không hợp lệ." });
    } else if (!normalizeGrammarTextAnswer(textAnswer)) {
      return res.status(400).json({ error: "Vui lòng nhập câu trả lời." });
    }

    const isCorrect = questionType === "rewrite"
      ? isGrammarTextAnswerCorrect(
          textAnswer,
          attemptQuestion.correctAnswerSnapshot,
          attemptQuestion.acceptedAnswersSnapshot
        )
      : selectedOptionId === attemptQuestion.correctOptionId;
    const answer: any = {
      id: makeId("grammar-answer"),
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
    const answers = (attempt.answers || []).filter((item: any) => item.attemptQuestionId !== attemptQuestion.id);
    answers.push(answer);
    const updatedAt = new Date().toISOString();
    const updatedAttempt = { ...attempt, answers, lastSavedAt: updatedAt, updatedAt };
    const batch = adminDb.batch();
    batch.set(adminDb.collection("grammar_attempts").doc(attempt.id), updatedAttempt);
    appendLearningHistoryProjection(
      batch,
      projectGrammarAttempt(updatedAttempt, set, {
        detailRetentionDays: ATTEMPT_DETAIL_RETENTION_DAYS,
        includeDetail: false
      })
    );
    await batch.commit();
    timing.mark("persist");

    const feedback = set?.showExplanationImmediately
      ? {
          isCorrect,
          correctOptionId: questionType === "multiple_choice" ? attemptQuestion.correctOptionId : "",
          correctAnswer: questionType === "rewrite" ? attemptQuestion.correctAnswerSnapshot : "",
          explanation: attemptQuestion.explanationSnapshot,
          scoreAwarded: answer.scoreAwarded
        }
      : null;
    timing.finish(res);
    res.json({ answer: sanitizeGrammarAnswerForStudent(answer, Boolean(feedback)), feedback });
  } catch (err: any) {
    timing.finish(res);
    sendApiError(res, err);
  }
});

app.post("/api/grammar-attempts/:attemptId/submit", authenticateOptionalUser, async (req, res) => {
  const timing = createApiTiming(req, "POST /api/grammar-attempts/:attemptId/submit");
  try {
    const actor = await getGrammarActor(req);
    timing.mark("identity");
    if (!actor) return res.status(401).json({ error: "Vui lòng nhập tên học sinh để luyện ngữ pháp." });
    const attempt = await getGrammarAttemptOr404(req.params.attemptId);
    timing.mark("attempt_read");
    if (!attempt) return res.status(404).json({ error: "Lượt làm bài không tồn tại." });
    const set = await getGrammarSetOr404(attempt.grammarSetId);
    timing.mark("set_read");
    if (!canAccessGrammarAttempt(attempt, actor, set, req)) return res.status(403).json({ error: "Bạn không có quyền nộp lượt làm bài này." });
    if (attempt.status === "completed") {
      timing.finish(res);
      return res.json({
        ...sanitizeAttemptForStudent(attempt, Boolean(set?.showReviewAfterSubmit)),
        alreadyCompleted: true
      });
    }

    const answerMap = new Map((attempt.answers || []).map((answer: any) => [answer.attemptQuestionId, answer]));
    let score = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let unansweredCount = 0;
    for (const question of attempt.questions || []) {
      const answer: any = answerMap.get(question.id);
      if (!answer) {
        unansweredCount++;
      } else if (answer.isCorrect) {
        correctCount++;
        score += Number(question.scoreSnapshot || 1);
      } else {
        wrongCount++;
      }
    }

    const completedAt = new Date().toISOString();
    const startedAt = attempt.startedAt || completedAt;
    const durationSeconds = Math.max(0, Math.round((new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000));
    const updatedAttempt = {
      ...attempt,
      status: "completed",
      submissionStatus: "completed",
      score,
      correctCount,
      wrongCount,
      unansweredCount,
      completedAt,
      durationSeconds,
      updatedAt: completedAt
    };
    const leaderboardEvent = grammarAttemptToLeaderboardEvent(updatedAttempt, set);
    const batch = adminDb.batch();
    batch.set(adminDb.collection("grammar_attempts").doc(attempt.id), updatedAttempt);
    batch.set(adminDb.collection("leaderboard_events").doc(leaderboardEvent.id), leaderboardEvent);
    appendLearningHistoryProjection(
      batch,
      projectGrammarAttempt(updatedAttempt, set, {
        detailRetentionDays: ATTEMPT_DETAIL_RETENTION_DAYS
      })
    );
    await batch.commit();
    timing.mark("persist");
    timing.finish(res);
    res.json(sanitizeAttemptForStudent(updatedAttempt, Boolean(set?.showReviewAfterSubmit)));
  } catch (err: any) {
    timing.finish(res);
    sendApiError(res, err);
  }
});

app.get("/api/grammar-attempts/:attemptId/review", authenticateOptionalUser, async (req, res) => {
  try {
    const actor = await getGrammarActor(req);
    if (!actor) return res.status(401).json({ error: "Vui lòng nhập tên học sinh để luyện ngữ pháp." });
    const attempt = await getGrammarAttemptOr404(req.params.attemptId);
    if (!attempt) return res.status(404).json({ error: "Lượt làm bài không tồn tại." });
    const set = await getGrammarSetOr404(attempt.grammarSetId);
    const canReview = canAccessGrammarAttempt(attempt, actor, set, req, true);
    if (!canReview) return res.status(403).json({ error: "Bạn không có quyền xem lượt làm bài này." });
    if (attempt.status !== "completed" && actor.role === "student") return res.status(403).json({ error: "Chỉ được xem lại sau khi nộp bài." });
    const staffReview = !actor.isGuest && (actor.role === "super_admin" || canManageGrammarSet(actor, set));
    res.json(sanitizeAttemptForStudent(attempt, staffReview || Boolean(set?.showReviewAfterSubmit)));
  } catch (err: any) {
    sendApiError(res, err);
  }
});

app.get("/api/grammar-sets/:id/my-attempts", authenticateOptionalUser, async (req, res) => {
  try {
    const actor = await getGrammarActor(req);
    if (!actor) return res.status(401).json({ error: "Vui lòng nhập tên học sinh để xem lịch sử làm bài." });
    const set = await getGrammarSetOr404(req.params.id);
    const actorField = actor.isGuest ? "guestId" : "userId";
    const snapshot = await adminDb.collection("grammar_attempts")
      .where("grammarSetId", "==", req.params.id)
      .where(actorField, "==", actor.id)
      .get();
    const list: any[] = [];
    snapshot.forEach(doc => {
      const attempt = { id: doc.id, ...doc.data() };
      list.push(sanitizeAttemptForStudent(attempt, !actor.isGuest && attempt.status === "completed" && Boolean(set?.showReviewAfterSubmit)));
    });
    list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    res.json(list);
  } catch (err: any) {
    sendApiError(res, err);
  }
});

app.get("/api/admin/grammar-sets/:id/results", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
    const set = await getGrammarSetOr404(req.params.id);
    if (!set) return res.status(404).json({ error: "Bài ngữ pháp không tồn tại." });
    if (!canManageGrammarSet(req.user, set)) return res.status(403).json({ error: "Bạn không có quyền xem kết quả bài này." });

    const snapshot = await adminDb.collection("grammar_attempts")
      .where("grammarSetId", "==", set.id)
      .get();
    const attempts: any[] = [];
    snapshot.forEach(doc => {
      const attempt = { id: doc.id, ...doc.data() };
      attempts.push(attempt);
    });
    attempts.sort((a, b) => new Date(b.completedAt || b.createdAt || 0).getTime() - new Date(a.completedAt || a.createdAt || 0).getTime());
    res.json({ set, attempts: await enrichStudentNames(attempts) });
  } catch (err: any) {
    sendApiError(res, err);
  }
});

app.get("/api/admin/vocab-sets/:id/results", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
    const setDoc = await adminDb.collection("vocab_sets").doc(req.params.id).get();
    if (!setDoc.exists) return res.status(404).json({ error: "Vocabulary set not found." });

    const set = { id: setDoc.id, ...setDoc.data() };
    if (!canManageVocabSet(req.user, set)) {
      return res.status(403).json({ error: "You do not have permission to view results for this vocabulary set." });
    }

    const snapshot = await adminDb.collection("game_sessions").where("vocabSetId", "==", set.id).get();
    const sessions: any[] = [];
    snapshot.forEach(doc => {
      const data = { id: doc.id, ...doc.data() };
      if (data.vocabSetId !== set.id) return;
      const interrupted = !data.completedAt && Date.now() - new Date(data.lastSavedAt || data.startedAt || data.createdAt || 0).getTime() >= 24 * 60 * 60 * 1000;
      sessions.push(omitSensitiveSessionFields({ ...data, displayStatus: data.completedAt ? "completed" : interrupted ? "abandoned" : "in_progress" }));
    });
    sessions.sort((a, b) => new Date(b.completedAt || b.endedAt || b.createdAt || 0).getTime() - new Date(a.completedAt || a.endedAt || a.createdAt || 0).getTime());

    res.json({ set, sessions: await enrichStudentNames(sessions) });
  } catch (err: any) {
    sendApiError(res, err);
  }
});

async function resolveGameSessionStartContext(req: express.Request, payload: any, timing?: ReturnType<typeof createApiTiming>) {
  let actor = getGameSessionActor(req, payload);
  if (!actor) throw createHttpError(401, "Student identity is required to start a game session.");
  if (actor.ownerType === "guest") {
    const profile = await resolveGuestProfile(actor.guestId, actor.studentName, true, {
      classId: payload.classId,
      className: payload.className
    });
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
    access = await resolveVocabLearningAccess(accessToken, vocabSetId, safeText(payload.assignmentId, 160));
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
    vocabSetTitle: safeText(payload.vocabSetTitle || vocabSet.title, 240),
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

app.post("/api/game-sessions/activate", authenticateOptionalUser, async (req, res) => {
  const timing = createApiTiming(req, "POST /api/game-sessions/activate");
  try {
    if (!LAZY_SESSION_V3_ENABLED) return res.status(404).json({ error: "Lazy session v3 is disabled." });
    const payload = req.body || {};
    const credentials = getClientRunCredentials(payload);
    const context = await resolveGameSessionStartContext(req, payload, timing);
    if (context.gameId !== "speaking-ai") {
      return res.status(400).json({ error: "Chi game Speaking AI moi can kich hoat session som." });
    }

    const id = deterministicRunDocumentId("session-v3", [
      context.actor.ownerKey,
      context.vocabSetId,
      context.gameId,
      credentials.clientRunId
    ]);
    const docRef = adminDb.collection("game_sessions").doc(id);
    const existing = await docRef.get();
    timing.mark("idempotency_lookup");
    if (existing.exists) {
      const session = existing.data();
      if (!canResumeClientRun(req, session, credentials.runSecret)) {
        return res.status(403).json({ error: "Khong co quyen tiep tuc luot hoc nay." });
      }
      timing.finish(res);
      return res.json({ ...omitSensitiveSessionFields(session), sessionToken: credentials.runSecret, alreadyActivated: true });
    }

    const session = buildGameSessionRecord(context, payload, {
      id,
      sessionTokenHash: hashSessionToken(credentials.runSecret),
      schemaVersion: 3,
      clientRunId: credentials.clientRunId,
      startedAt: payload.startedAt
    });
    const batch = adminDb.batch();
    batch.set(docRef, session);
    appendLearningHistoryProjection(
      batch,
      projectVocabularyAttempt(session, {
        detailRetentionDays: ATTEMPT_DETAIL_RETENTION_DAYS,
        includeDetail: false
      })
    );
    await batch.commit();
    timing.mark("persist");
    timing.finish(res);
    res.status(201).json({ ...omitSensitiveSessionFields(session), sessionToken: credentials.runSecret });
  } catch (err: any) {
    timing.finish(res);
    sendApiError(res, err);
  }
});

app.post("/api/game-sessions/lazy-complete", authenticateOptionalUser, async (req, res) => {
  const timing = createApiTiming(req, "POST /api/game-sessions/lazy-complete");
  try {
    if (!LAZY_SESSION_V3_ENABLED) return res.status(404).json({ error: "Lazy session v3 is disabled." });
    const payload = req.body || {};
    const credentials = getClientRunCredentials(payload);
    const context = await resolveGameSessionStartContext(req, payload, timing);
    if (context.gameId === "speaking-ai") {
      return res.status(400).json({ error: "Speaking AI phai kich hoat session khi bat dau ghi am." });
    }

    const id = deterministicRunDocumentId("session-v3", [
      context.actor.ownerKey,
      context.vocabSetId,
      context.gameId,
      credentials.clientRunId
    ]);
    const docRef = adminDb.collection("game_sessions").doc(id);
    const existing = await docRef.get();
    timing.mark("idempotency_lookup");
    if (existing.exists) {
      const session = existing.data();
      if (!canResumeClientRun(req, session, credentials.runSecret)) {
        return res.status(403).json({ error: "Khong co quyen nop luot hoc nay." });
      }
      if (session.status === "completed") {
        timing.finish(res);
        return res.json({ ...omitSensitiveSessionFields(session), alreadyCompleted: true });
      }
    }

    const actions = sanitizeSubmittedGameActions(payload.actions);
    const baseSession = existing.exists
      ? existing.data()
      : buildGameSessionRecord(context, payload, {
          id,
          sessionTokenHash: hashSessionToken(credentials.runSecret),
          schemaVersion: 3,
          clientRunId: credentials.clientRunId,
          startedAt: payload.startedAt
        });
    const result = gradeGameSessionV2(baseSession, actions);
    const completedAt = new Date().toISOString();
    const durationMs = Math.max(0, Date.now() - new Date(baseSession.startedAt || completedAt).getTime());
    const completed = {
      ...baseSession,
      ...result,
      status: "completed",
      submissionStatus: "completed",
      completedAt,
      endedAt: completedAt,
      submittedAt: completedAt,
      lastSavedAt: completedAt,
      durationMs,
      durationSeconds: Math.round(durationMs / 1000),
      expiresAt: addDaysIso(completedAt, ACTIVITY_TTL_DAYS)
    };
    const leaderboardEvent = gameSessionToLeaderboardEvent({ ...completed, id });
    const batch = adminDb.batch();
    batch.set(docRef, completed);
    batch.set(adminDb.collection("leaderboard_events").doc(leaderboardEvent.id), leaderboardEvent);
    appendLearningHistoryProjection(
      batch,
      projectVocabularyAttempt(completed, {
        detailRetentionDays: ATTEMPT_DETAIL_RETENTION_DAYS
      })
    );
    await batch.commit();
    timing.mark("persist");
    timing.finish(res);
    res.json(omitSensitiveSessionFields(completed));
  } catch (err: any) {
    timing.finish(res);
    sendApiError(res, err);
  }
});

// 19. GAME SESSIONS: Start a session
app.post("/api/game-sessions", authenticateOptionalUser, async (req, res) => {
  const timing = createApiTiming(req, "POST /api/game-sessions");
  try {
    const payload = req.body || {};
    let actor = getGameSessionActor(req, payload);
    if (!actor) return res.status(401).json({ error: "Student identity is required to start a game session." });
    if (actor.ownerType === "guest") {
      const profile = await resolveGuestProfile(actor.guestId, actor.studentName, true, {
        classId: payload.classId,
        className: payload.className
      });
      actor = { ...actor, studentName: profile.displayName || profile.name };
    }
    timing.mark("identity");
    const id = `session-${crypto.randomUUID()}`;
    const sessionToken = createSessionToken();
    const now = new Date().toISOString();
    const vocabSetId = safeText(payload.vocabSetId, 160);
    const gameId = safeText(payload.gameId, 120);
    if (!vocabSetId || !gameId) {
      return res.status(400).json({ error: "vocabSetId and gameId are required." });
    }
    if (!SESSION_V2_GAME_IDS.has(gameId)) {
      return res.status(400).json({ error: "Game không được hỗ trợ." });
    }
    let assignment: any = null;
    let access: Awaited<ReturnType<typeof resolveVocabLearningAccess>> = null;
    const accessToken = getRequestVocabShareToken(req);
    if (accessToken) {
      access = await resolveVocabLearningAccess(accessToken, vocabSetId, safeText(payload.assignmentId, 160));
      if (!access) return res.status(403).json({ error: "Link không có quyền tạo lượt học này." });
      assignment = access.assignment;
    } else if (payload.assignmentId) {
      const assignmentDoc = await adminDb.collection("assignments").doc(String(payload.assignmentId)).get();
      assignment = assignmentDoc.exists ? assignmentDoc.data() : null;
      if (!assignment) {
        const assignmentsSnapshot = await adminDb.collection("assignments").get();
        assignmentsSnapshot.forEach(doc => {
          const data = { id: doc.id, ...doc.data() };
          if (!assignment && data.id === String(payload.assignmentId)) {
            assignment = data;
          }
        });
      }
    }
    timing.mark("access");

    let vocabSet = access?.set || null;
    if (!vocabSet) {
      const vocabDoc = await adminDb.collection("vocab_sets").doc(vocabSetId).get();
      if (!vocabDoc.exists) {
        return res.status(404).json({ error: "Vocabulary set not found." });
      }
      vocabSet = { id: vocabDoc.id, ...vocabDoc.data() };
    }
    timing.mark("set_read");
    if (assignment) {
      if (assignment.vocabSetId !== vocabSetId || !isAssignmentOpenForLearning(assignment, vocabSet)) {
        return res.status(403).json({ error: "Assignment is not available for this vocabulary set." });
      }
      if (!req.user && !accessToken) {
        return res.status(403).json({ error: "Link giao bài không hợp lệ hoặc đã hết quyền truy cập." });
      }
      if (assignment.gameId && assignment.gameId !== gameId) {
        return res.status(403).json({ error: "Game không đúng với bài giáo viên đã giao." });
      }
    } else if (access?.accessType === "vocab_set") {
      if (access.set.id !== vocabSetId || getVocabVisibility(vocabSet) !== "assignment") {
        return res.status(403).json({ error: "Link không có quyền tạo lượt học này." });
      }
    } else if (!canViewVocabSet(req.user, vocabSet)) {
      return res.status(403).json({ error: "Bạn không có quyền bắt đầu game với bộ từ này." });
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
    timing.mark("class_resolve");
    const privateSnapshot = buildGameSessionSnapshot(vocabSet, gameId, payload.itemOrder);
    const newSession = {
      id,
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
      vocabSetTitle: safeText(payload.vocabSetTitle, 240),
      gameId,
      gameName: safeText(payload.gameName, 160),
      gameType: safeText(payload.gameType, 80),
      studentName: actor.studentName,
      classId: safeText(assignment?.classId || vocabSet.classId || inferredClass?.classId || getLessonGradeClass(vocabSet).classId || "", 160),
      className: safeText(assignment?.className || vocabSet.className || inferredClass?.className || getLessonGradeClass(vocabSet).className || "", 160),
      startedAt: now,
      createdAt: now,
      status: "started",
      schemaVersion: 2,
      gradingMode: gameId.startsWith("flashcard-") ? "server-self-report" : "server",
      actionPersistence: getGameActionPersistence(gameId, privateSnapshot),
      privateSnapshot,
      lastSavedAt: now,
      score: 0,
      totalQuestions: 0,
      correctAnswers: 0,
      incorrectAnswers: 0,
      sessionTokenHash: hashSessionToken(sessionToken)
    };

    await adminDb.collection("game_sessions").doc(id).set(newSession);
    timing.mark("persist");
    timing.finish(res);
    res.status(201).json({ ...omitSensitiveSessionFields(newSession), sessionToken });
  } catch (err: any) {
    timing.finish(res);
    sendApiError(res, err);
  }
});

// 20. GAME SESSIONS: Update/complete session results
app.put("/api/game-sessions/:id", authenticateOptionalUser, async (req, res) => {
  try {
    const id = req.params.id;
    const payload = req.body || {};

    const docRef = adminDb.collection("game_sessions").doc(id);
    const existing = await docRef.get();
    if (!existing.exists) {
      return res.status(404).json({ error: "Session không tồn tại." });
    }

    const existingData = existing.data();
    if (!canUpdateGameSession(req, existingData, payload)) {
      return res.status(403).json({ error: "You do not have permission to update this game session." });
    }
    if (existingData.status === "completed") {
      return res.status(409).json({ error: "This game session has already been completed." });
    }

    const endedAt = payload.endedAt || new Date().toISOString();
    const startedAt = existingData.startedAt || endedAt;
    const durationMs = Math.max(0, Number(payload.durationMs ?? (new Date(endedAt).getTime() - new Date(startedAt).getTime())));
    const totalQuestions = Math.max(0, Number(payload.totalQuestions || 0));
    const correctAnswers = Math.max(0, Number(payload.correctAnswers || 0));
    const sanitizedAnswerDetails = Array.isArray(payload.answerDetails)
      ? payload.answerDetails.slice(0, 200).map((item: any, index: number) => ({
          questionIndex: Number.isFinite(Number(item.questionIndex)) ? Number(item.questionIndex) : index,
          wordId: item.wordId || "",
          word: item.word || "",
          questionText: item.questionText || "",
          correctAnswer: item.correctAnswer || "",
          userAnswer: item.userAnswer || "",
          selectedAnswer: item.selectedAnswer || "",
          isCorrect: Boolean(item.isCorrect),
          timeSpentMs: item.timeSpentMs ? Number(item.timeSpentMs) : undefined,
          options: Array.isArray(item.options) ? item.options.slice(0, 6).map((option: any) => String(option).slice(0, 160)) : undefined
        }))
      : [];

    const updatedSession = {
      ...existingData,
      answerDetails: sanitizedAnswerDetails,
      score: Math.max(0, Number(payload.score || 0)),
      totalQuestions,
      correctAnswers,
      incorrectAnswers: Math.max(0, Number(payload.incorrectAnswers || 0)),
      accuracy: totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0,
      durationMs,
      durationSeconds: Math.round(durationMs / 1000),
      status: "completed",
      submissionStatus: "completed",
      endedAt,
      completedAt: endedAt,
      expiresAt: addDaysIso(endedAt, ACTIVITY_TTL_DAYS)
    };

    const leaderboardEvent = gameSessionToLeaderboardEvent({ ...updatedSession, id });
    const batch = adminDb.batch();
    batch.set(docRef, updatedSession);
    batch.set(adminDb.collection("leaderboard_events").doc(leaderboardEvent.id), leaderboardEvent);
    appendLearningHistoryProjection(
      batch,
      projectVocabularyAttempt(updatedSession, {
        detailRetentionDays: ATTEMPT_DETAIL_RETENTION_DAYS
      })
    );
    await batch.commit();
    res.json(omitSensitiveSessionFields(updatedSession));
  } catch (err: any) {
    sendApiError(res, err);
  }
});

app.put("/api/game-sessions/:id/actions/:actionId", authenticateOptionalUser, async (req, res) => {
  const timing = createApiTiming(req, "PUT /api/game-sessions/:id/actions/:actionId");
  try {
    const sessionDoc = await adminDb.collection("game_sessions").doc(req.params.id).get();
    timing.mark("session_read");
    if (!sessionDoc.exists) return res.status(404).json({ error: "Session không tồn tại." });
    const session = sessionDoc.data();
    if (!canUpdateGameSession(req, session, req.body || {})) return res.status(403).json({ error: "Bạn không có quyền lưu lượt chơi này." });
    if (!supportsIncrementalGameSession(session)) return res.status(400).json({ error: "Session cũ không hỗ trợ lưu tiến độ." });
    if (session.status === "completed") return res.json({ saved: true, completed: true });
    const action = sanitizeGameAction({ ...req.body?.action, actionId: req.params.actionId });
    if (!action.actionId) return res.status(400).json({ error: "Thiếu actionId." });
    const canonicalActionId = `${req.params.id}:sequence:${action.sequence}`;
    const legacyActionId = `${req.params.id}:${action.actionId}`;
    const canonicalRef = adminDb.collection("game_session_actions").doc(canonicalActionId);
    const legacyRef = adminDb.collection("game_session_actions").doc(legacyActionId);
    const [canonicalDoc, legacyDoc] = await Promise.all([canonicalRef.get(), legacyRef.get()]);
    timing.mark("action_lookup");
    if (canonicalDoc.exists) {
      const existingAction = canonicalDoc.data();
      if (existingAction.actionId && existingAction.actionId !== action.actionId) {
        return res.status(409).json({ error: "Action sequence đã tồn tại." });
      }
      timing.finish(res);
      return res.json({ saved: true, actionId: action.actionId, sequence: action.sequence });
    }
    if (legacyDoc.exists) {
      timing.finish(res);
      return res.json({ saved: true, actionId: action.actionId, sequence: action.sequence });
    }

    const now = new Date().toISOString();
    const batch = adminDb.batch();
    batch.set(canonicalRef, {
      ...action,
      id: canonicalActionId,
      sessionId: req.params.id,
      createdAt: now,
      updatedAt: now
    });
    batch.update(adminDb.collection("game_sessions").doc(req.params.id), {
      status: "in_progress",
      lastSavedAt: now,
      updatedAt: now
    });
    appendLearningHistoryProjection(
      batch,
      projectVocabularyAttempt(
        { ...session, id: req.params.id, status: "in_progress", lastSavedAt: now, updatedAt: now },
        {
          detailRetentionDays: ATTEMPT_DETAIL_RETENTION_DAYS,
          includeDetail: false
        }
      )
    );
    await batch.commit();
    timing.mark("persist");
    timing.finish(res);
    res.json({ saved: true, actionId: action.actionId, sequence: action.sequence });
  } catch (err: any) {
    timing.finish(res);
    sendApiError(res, err);
  }
});

app.post("/api/game-sessions/:id/submit", authenticateOptionalUser, async (req, res) => {
  const timing = createApiTiming(req, "POST /api/game-sessions/:id/submit");
  try {
    const docRef = adminDb.collection("game_sessions").doc(req.params.id);
    const existing = await docRef.get();
    timing.mark("session_read");
    if (!existing.exists) return res.status(404).json({ error: "Session không tồn tại." });
    const session = existing.data();
    if (!canUpdateGameSession(req, session, req.body || {})) return res.status(403).json({ error: "Bạn không có quyền nộp lượt chơi này." });
    if (session.status === "completed") return res.json(omitSensitiveSessionFields(session));
    if (!supportsIncrementalGameSession(session)) return res.status(400).json({ error: "Session cũ phải dùng endpoint hoàn thành cũ." });
    let actions: any[];
    const submittedActionsProvided = Array.isArray(req.body?.actions);
    if (session.actionPersistence === "submit_batch" && submittedActionsProvided) {
      actions = sanitizeSubmittedGameActions(req.body.actions);
    } else {
      const snapshot = await adminDb.collection("game_session_actions")
        .where("sessionId", "==", req.params.id)
        .get();
      const storedActions: any[] = [];
      snapshot.forEach(doc => storedActions.push(doc.data()));
      actions = dedupeStoredGameActions(storedActions);
    }
    timing.mark("actions_read");
    const result = gradeGameSessionV2(session, actions);
    const completedAt = new Date().toISOString();
    const durationMs = Math.max(0, Date.now() - new Date(session.startedAt || completedAt).getTime());
    const completed = { ...session, ...result, status: "completed", submissionStatus: "completed", completedAt, endedAt: completedAt, durationMs, durationSeconds: Math.round(durationMs / 1000), expiresAt: addDaysIso(completedAt, ACTIVITY_TTL_DAYS), submittedAt: completedAt };
    const leaderboardEvent = gameSessionToLeaderboardEvent({ ...completed, id: req.params.id });
    const batch = adminDb.batch();
    batch.set(docRef, completed);
    batch.set(adminDb.collection("leaderboard_events").doc(leaderboardEvent.id), leaderboardEvent);
    appendLearningHistoryProjection(
      batch,
      projectVocabularyAttempt(completed, {
        detailRetentionDays: ATTEMPT_DETAIL_RETENTION_DAYS
      })
    );
    await batch.commit();
    timing.mark("persist");
    timing.finish(res);
    res.json(omitSensitiveSessionFields(completed));
  } catch (err: any) {
    timing.finish(res);
    sendApiError(res, err);
  }
});

// 21. PRONUNCIATION ATTEMPTS: Save one speaking practice attempt
app.post("/api/pronunciation-attempts", authenticateOptionalUser, async (req, res) => {
  try {
    const payload = req.body || {};
    const now = new Date().toISOString();
    const gameSessionId = safeText(payload.gameSessionId, 160);
    let sessionData: any = null;

    if (gameSessionId) {
      const sessionDoc = await adminDb.collection("game_sessions").doc(gameSessionId).get();
      if (!sessionDoc.exists) {
        return res.status(404).json({ error: "Session không tồn tại." });
      }
      sessionData = sessionDoc.data();
      if (!canUpdateGameSession(req, sessionData, payload)) {
        return res.status(403).json({ error: "You do not have permission to save this pronunciation attempt." });
      }
      if (sessionData.status === "completed") {
        return res.status(409).json({ error: "This game session has already been completed." });
      }
    } else if (!req.user) {
      return res.status(401).json({ error: "Game session is required to save pronunciation attempts." });
    }

    const actor = sessionData ? {
      ownerKey: sessionData.ownerKey || "",
      ownerType: sessionData.ownerType || "",
      userId: sessionData.userId || "",
      studentId: sessionData.studentId || sessionData.guestId || "",
      guestId: sessionData.guestId || "",
      studentName: sessionData.studentName || ""
    } : getGameSessionActor(req, payload);

    if (!actor) {
      return res.status(401).json({ error: "Student identity is required to save pronunciation attempts." });
    }

    const id = `pronunciation-${crypto.randomUUID()}`;
    const attempt = {
      id,
      ownerKey: actor.ownerKey,
      ownerType: actor.ownerType,
      userId: actor.userId || "",
      studentId: actor.studentId || actor.guestId || "",
      guestId: actor.guestId || "",
      studentName: actor.studentName || "",
      vocabularySetId: sessionData?.vocabSetId || safeText(payload.vocabularySetId || payload.vocabSetId || "", 160),
      wordId: safeText(payload.wordId, 160),
      targetText: safeText(payload.targetText, 500),
      recognizedText: safeText(payload.recognizedText, 500),
      score: Math.max(0, Math.min(100, Number(payload.score || 0))),
      correctWords: Math.max(0, Number(payload.correctWords || 0)),
      totalWords: Math.max(0, Number(payload.totalWords || 0)),
      attemptCount: Math.max(1, Number(payload.attemptCount || 1)),
      gameSessionId,
      gameId: "speaking-ai",
      playedAt: now,
      createdAt: now
    };

    await adminDb.collection("pronunciation_attempts").doc(id).set(attempt);
    res.status(201).json(attempt);
  } catch (err: any) {
    sendApiError(res, err);
  }
});

// 22. GAME RESULTS: Get all finished game sessions
app.get("/api/results", authenticateUser, async (req, res) => {
  try {
    const recentCutoff = new Date(Date.now() - ACTIVITY_TTL_MS).toISOString();
    const snapshot = await adminDb.collection("game_sessions")
      .where("completedAt", ">=", recentCutoff)
      .get();
    const grammarAttemptsSnapshot = await adminDb.collection("grammar_attempts")
      .where("completedAt", ">=", recentCutoff)
      .get();
    const listeningAttemptsSnapshot = await adminDb.collection("listening_attempts")
      .where("completedAt", ">=", recentCutoff)
      .get();
    const grammarSetsById = await getGrammarSetMap();
    const vocabSetsById = await getVocabSetMap();
    const listeningSetsSnapshot = await adminDb.collection("listening_sets").get();
    const listeningSetsById = new Map<string, any>();
    listeningSetsSnapshot.forEach(doc => listeningSetsById.set(doc.id, { id: doc.id, ...doc.data() }));
    const assignmentsSnapshot = await adminDb.collection("assignments").get();
    const classesSnapshot = await adminDb.collection("classes").get();
    const assignmentsById = new Map<string, any>();
    const classesById = new Map<string, any>();
    assignmentsSnapshot.forEach(doc => {
      const data = { id: doc.id, ...doc.data() };
      assignmentsById.set(doc.id, data);
      if (data.id) assignmentsById.set(data.id, data);
    });
    classesSnapshot.forEach(doc => {
      const data = { id: doc.id, ...doc.data() };
      classesById.set(data.id, data);
    });
    const list: any[] = [];
    const cutoff = Date.now() - ACTIVITY_TTL_MS;
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.completedAt && !isExpiredActivity(data) && new Date(getActivityTime(data)).getTime() >= cutoff) {
        if (!canViewResultSession(req.user, data, vocabSetsById, assignmentsById, classesById)) return;
        const gradeClass = getLessonGradeClass(vocabSetsById.get(data.vocabSetId));
        list.push({
          ...data,
          id: data.id || doc.id,
          classId: data.classId || gradeClass.classId || "",
          className: data.className || gradeClass.className || ""
        });
      }
    });
    grammarAttemptsSnapshot.forEach(doc => {
      const data = { id: doc.id, ...doc.data() };
      if (data.status !== "completed" || !data.completedAt) return;
      if (isExpiredActivity(data)) return;
      if (new Date(getActivityTime(data)).getTime() < cutoff) return;
      if (!canViewGrammarActivity(req.user, data, grammarSetsById.get(data.grammarSetId))) return;
      list.push(grammarAttemptToActivity(data, grammarSetsById.get(data.grammarSetId)));
    });
    const visibleListeningAttempts: any[] = [];
    listeningAttemptsSnapshot.forEach(doc => {
      const data = { id: doc.id, ...doc.data() };
      if (!data.completedAt || new Date(getActivityTime(data)).getTime() < cutoff) return;
      const set = listeningSetsById.get(data.setId);
      const canView = req.user?.role === "super_admin"
        || data.userId === req.user?.id
        || data.ownerKey === `user:${req.user?.id}`
        || (req.user?.role === "teacher" && set?.ownerId === req.user.id);
      if (canView) visibleListeningAttempts.push(data);
    });
    const isStaffResultReview = req.user?.role === "teacher" || req.user?.role === "super_admin";
    const listeningVersionContentCache = new Map();
    const listeningActivities = await Promise.all(visibleListeningAttempts.map(async data => {
      if (!isStaffResultReview) return listeningAttemptToActivity(data);
      const detail = await resolveListeningActivityDetailForStaff(
        adminDb,
        data,
        listeningVersionContentCache
      );
      return listeningAttemptToActivity(data, detail);
    }));
    list.push(...listeningActivities);
    list.sort((a, b) => new Date(getActivityTime(b)).getTime() - new Date(getActivityTime(a)).getTime());
    res.json(await enrichStudentNames(list));
  } catch (err: any) {
    sendApiError(res, err);
  }
});

app.get("/api/leaderboard-results", authenticateUser, async (req, res) => {
  try {
    const events = await loadLeaderboardEventsFromSources();
    const grammarSetsById = await getGrammarSetMap();
    const vocabSetsById = await getVocabSetMap();
    const assignmentsSnapshot = await adminDb.collection("assignments").get();
    const classesSnapshot = await adminDb.collection("classes").get();
    const assignmentsById = new Map<string, any>();
    const classesById = new Map<string, any>();

    assignmentsSnapshot.forEach(doc => {
      const data = { id: doc.id, ...doc.data() };
      assignmentsById.set(doc.id, data);
      if (data.id) assignmentsById.set(data.id, data);
    });
    classesSnapshot.forEach(doc => {
      const data = { id: doc.id, ...doc.data() };
      classesById.set(data.id, data);
    });

    const scoped = events.filter(event => {
      if (event.sourceType === "grammar") {
        return canViewGrammarActivity(req.user, event, grammarSetsById.get(event.grammarSetId));
      }
      return canViewResultSession(req.user, event, vocabSetsById, assignmentsById, classesById);
    });

    res.json(scoped);
  } catch (err: any) {
    sendApiError(res, err);
  }
});

// ============================================================================
// SUPER ADMIN EXCLUSIVE INTERFACES
// ============================================================================

// 23. ADMIN: List all registered users (With role & status updates, classes filtering)
app.get("/api/admin/users", authenticateUser, requireRole(["super_admin"]), async (req, res) => {
  try {
    const snapshot = await adminDb.collection("users").get();
    const users: any[] = [];
    snapshot.forEach(doc => users.push(doc.data()));
    res.json(users);
  } catch (err: any) {
    sendApiError(res, err);
  }
});

// Unified account directory: Firebase users plus name-only student profiles.
app.get("/api/admin/accounts", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
    await ensureLegacyGuestProfilesOnce();
    const [usersSnapshot, guestsSnapshot] = await Promise.all([
      adminDb.collection("users").get(),
      adminDb.collection("guest_profiles").get()
    ]);
    const accounts: any[] = [];
    if (isSuperAdmin(req.user)) {
      usersSnapshot.forEach((doc: any) => {
        const data = doc.data();
        accounts.push({
          ...data,
          id: data.id || doc.id,
          name: data.name || data.displayName || "Chưa đặt tên",
          accountType: "registered",
          status: data.status || "active"
        });
      });
    }

    const guestProfiles: any[] = [];
    guestsSnapshot.forEach((doc: any) => {
      const data = doc.data();
      guestProfiles.push({
        ...omitGuestCapabilitySecrets(data),
        id: data.id || doc.id,
        guestId: data.guestId || doc.id
      });
    });
    for (const data of guestProfiles) {
      if (!(await canManageGuestProfile(req.user, data))) continue;
      accounts.push({
        ...data,
        name: data.displayName || data.name || "Chưa đặt tên",
        email: "",
        phone: "",
        role: "student",
        accountType: "guest",
        status: data.status || "active"
      });
    }
    accounts.sort((a, b) => new Date(b.lastActiveAt || b.updatedAt || b.createdAt || 0).getTime()
      - new Date(a.lastActiveAt || a.updatedAt || a.createdAt || 0).getTime());
    res.json(accounts);
  } catch (err: any) {
    sendApiError(res, err);
  }
});

app.put("/api/admin/users/:userId/display-name", authenticateUser, requireRole(["super_admin"]), async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
    const validation = validateStudentDisplayName(req.body?.displayName || req.body?.name);
    if (!validation.valid) return res.status(400).json({ error: validation.error });
    const userRef = adminDb.collection("users").doc(req.params.userId);
    const userDoc = await userRef.get();
    if (!userDoc.exists) return res.status(404).json({ error: "Người dùng không tồn tại." });
    const existing = userDoc.data();
    const now = new Date().toISOString();
    await userRef.update({ name: validation.value, updatedAt: now });

    let authWarning = "";
    try {
      await adminAuth.updateUser(req.params.userId, { displayName: validation.value });
    } catch (authErr: any) {
      authWarning = authErr?.message || "Không đồng bộ được tên lên Firebase Authentication.";
      console.warn(`Could not update Firebase display name for ${req.params.userId}: ${authWarning}`);
    }
    await logAuditAction(req.user.id, req.user.name, req.user.email, "UPDATE_USER_DISPLAY_NAME",
      `Đổi tên tài khoản "${existing?.name || req.params.userId}" thành "${validation.value}"`);
    res.json({ success: true, userId: req.params.userId, displayName: validation.value, authWarning });
  } catch (err: any) {
    sendApiError(res, err);
  }
});

app.put("/api/admin/guest-profiles/:guestId/display-name", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
    const validation = validateStudentDisplayName(req.body?.displayName || req.body?.name);
    if (!validation.valid) return res.status(400).json({ error: validation.error });
    const profileRef = adminDb.collection("guest_profiles").doc(getGuestProfileId(req.params.guestId));
    const profileDoc = await profileRef.get();
    if (!profileDoc.exists) return res.status(404).json({ error: "Hồ sơ học sinh không tồn tại." });
    const existing = profileDoc.data();
    if (!(await canManageGuestProfile(req.user, { id: profileDoc.id, ...existing }))) {
      return res.status(403).json({ error: "Bạn không có quyền đổi tên học sinh này." });
    }
    await profileRef.update({
      displayName: validation.value,
      name: validation.value,
      normalizedName: normalizePersonName(validation.value),
      needsReview: false,
      updatedAt: new Date().toISOString()
    });
    await logAuditAction(req.user.id, req.user.name, req.user.email, "UPDATE_GUEST_DISPLAY_NAME",
      `Đổi tên học sinh khách "${existing?.displayName || req.params.guestId}" thành "${validation.value}"`);
    res.json({ success: true, guestId: req.params.guestId, displayName: validation.value });
  } catch (err: any) {
    sendApiError(res, err);
  }
});

app.put("/api/admin/guest-profiles/:guestId/status", authenticateUser, requireRole(["super_admin"]), async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
    const status = req.body?.status;
    if (!["active", "blocked"].includes(status)) {
      return res.status(400).json({ error: "Trạng thái hồ sơ không hợp lệ." });
    }
    const profileRef = adminDb.collection("guest_profiles").doc(getGuestProfileId(req.params.guestId));
    const profileDoc = await profileRef.get();
    if (!profileDoc.exists) return res.status(404).json({ error: "Hồ sơ học sinh không tồn tại." });
    const existing = profileDoc.data();
    await profileRef.update({ status, updatedAt: new Date().toISOString() });
    await logAuditAction(req.user.id, req.user.name, req.user.email,
      status === "blocked" ? "LOCK_GUEST_PROFILE" : "UNLOCK_GUEST_PROFILE",
      `Chuyển hồ sơ học sinh "${existing?.displayName || req.params.guestId}" thành ${status}`);
    res.json({ success: true, guestId: req.params.guestId, status });
  } catch (err: any) {
    sendApiError(res, err);
  }
});

app.post(
  "/api/admin/guest-profiles/:guestId/history-capability",
  authenticateUser,
  requireRole(["teacher", "super_admin"]),
  async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
      const guestId = getGuestProfileId(req.params.guestId);
      const profileRef = adminDb.collection("guest_profiles").doc(guestId);
      const profileDoc = await profileRef.get();
      if (!profileDoc.exists) return res.status(404).json({ error: "Hồ sơ học sinh không tồn tại." });
      const profile = { id: profileDoc.id, ...profileDoc.data() };
      if (!(await canManageGuestProfile(req.user, profile))) {
        return res.status(403).json({ error: "Bạn không có quyền cấp lại quyền lịch sử cho học sinh này." });
      }

      const guestAccessToken = createSessionToken();
      const now = new Date().toISOString();
      const guestAccessTokenVersion = Date.now();
      await profileRef.update({
        accessTokenHash: hashSessionToken(guestAccessToken),
        accessTokenVersion: guestAccessTokenVersion,
        accessTokenCreatedAt: now,
        updatedAt: now
      });
      await logAuditAction(
        req.user.id,
        req.user.name,
        req.user.email,
        "ROTATE_GUEST_HISTORY_CAPABILITY",
        `Cấp lại quyền xem lịch sử cho hồ sơ khách ${guestId}`
      );
      res.json({
        guestId,
        guestAccessToken,
        guestAccessTokenVersion,
        createdAt: now
      });
    } catch (err: any) {
      sendApiError(res, err);
    }
  }
);

// 23. ADMIN: Change role of user
app.put("/api/admin/users/:userId/role", authenticateUser, requireRole(["super_admin"]), async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
    const targetUserId = req.params.userId;
    const { role } = req.body; // 'super_admin' | 'teacher' | 'student'

    if (!['super_admin', 'teacher', 'student'].includes(role)) {
      return res.status(400).json({ error: "Vai trò không hợp lệ." });
    }

    const userRef = adminDb.collection("users").doc(targetUserId);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: "Người dùng không tồn tại." });
    }

    const userData = userDoc.data();
    await userRef.update({ role });

    // Custom claims are useful for Firebase-side rules, but app permissions are
    // resolved from the users profile document above. Do not roll back the role
    // update if claims cannot be written, especially in SQLite/app-data mode.
    let customClaimWarning = "";
    try {
      await adminAuth.setCustomUserClaims(targetUserId, { role });
    } catch (claimErr: any) {
      customClaimWarning = claimErr?.message || "Could not update Firebase custom claims.";
      console.warn(`Could not update custom claims for ${targetUserId}: ${customClaimWarning}`);
    }

    // Audit Log
    await logAuditAction(
      req.user.id,
      req.user.name,
      req.user.email,
      "UPDATE_USER_ROLE",
      `Đã thay đổi vai trò của user "${userData?.name}" (${userData?.email}) từ ${userData?.role} thành ${role}`
    );

    res.json({ success: true, userId: targetUserId, role, customClaimWarning });
  } catch (err: any) {
    sendApiError(res, err);
  }
});

// 24. ADMIN: Lock/Unlock (Change status) user account
app.put("/api/admin/users/:userId/status", authenticateUser, requireRole(["super_admin"]), async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
    const targetUserId = req.params.userId;
    const { status } = req.body; // 'active' | 'pending' | 'blocked' | 'deleted'

    if (!['active', 'pending', 'blocked', 'deleted'].includes(status)) {
      return res.status(400).json({ error: "Trạng thái không hợp lệ." });
    }

    const userRef = adminDb.collection("users").doc(targetUserId);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: "Người dùng không tồn tại." });
    }

    const userData = userDoc.data();
    await userRef.update({ status });

    // Audit Log
    await logAuditAction(
      req.user.id,
      req.user.name,
      req.user.email,
      status === "blocked" ? "LOCK_USER" : "UNLOCK_USER",
      `Đã chuyển trạng thái của user "${userData?.name}" (${userData?.email}) thành ${status}`
    );

    res.json({ success: true, userId: targetUserId, status });
  } catch (err: any) {
    sendApiError(res, err);
  }
});

// 25. ADMIN: List all audit logs
app.get("/api/admin/audit-logs", authenticateUser, requireRole(["super_admin"]), async (req, res) => {
  try {
    const snapshot = await adminDb.collection("audit_logs").orderBy("timestamp", "desc").get();
    const logs: any[] = [];
    snapshot.forEach(doc => logs.push(doc.data()));
    res.json(logs);
  } catch (err: any) {
    sendApiError(res, err);
  }
});


// ============================================================================
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
      maxAge: "365d"
    }));
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
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
    imageUrl: safeText(item?.imageUrl, 1000),
    displayOrder: Number.isFinite(Number(item?.displayOrder)) ? Number(item.displayOrder) : index + 1
  };

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
