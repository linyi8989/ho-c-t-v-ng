import express from "express";
import path from "path";
import crypto from "crypto";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { adminDb, adminAuth, firebaseDiagnosticReady, getStorageDiagnostics } from "./src/lib/firebaseAdmin.js";

// Load environment variables
dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const AUDIO_DIR = process.env.TTS_AUDIO_DIR || "/home/qzmivzbj/app-data/vhomework/audio";
const AUDIO_PUBLIC_PREFIX = "/audio";

app.use(express.json());
fs.mkdirSync(AUDIO_DIR, { recursive: true });
app.use(AUDIO_PUBLIC_PREFIX, express.static(AUDIO_DIR));

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
        role: 'super_admin' | 'teacher' | 'student';
        status: 'active' | 'pending' | 'blocked' | 'deleted';
        createdAt: string;
      };
    }
  }
}

// Authenticates bearer token from firebase and attaches custom profile state
const authenticateUser = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Không tìm thấy token xác thực. Vui lòng đăng nhập." });
  }

  const token = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;
    const email = decodedToken.email || "";
    const phone = decodedToken.phone_number || "";

    // Load or create profile in Firestore
    const userRef = adminDb.collection("users").doc(uid);
    const doc = await userRef.get();
    
    let userProfile: any;

    if (!doc.exists) {
      // Determine default role (linyi8901@gmail.com is super_admin, other is student)
      let defaultRole: 'super_admin' | 'teacher' | 'student' = 'student';
      if (email === "linyi8901@gmail.com" || email === "admin@vocabulary.edu.vn") {
        defaultRole = "super_admin";
      }

      userProfile = {
        id: uid,
        name: decodedToken.name || email.split("@")[0] || "Học sinh mới",
        email: email,
        phone: phone || undefined,
        role: defaultRole,
        status: "active",
        createdAt: new Date().toISOString()
      };

      await userRef.set(userProfile);
      
      // Audit log registration
      await logAuditAction(
        userProfile.id,
        userProfile.name,
        userProfile.email,
        "REGISTER",
        `Đăng ký tài khoản mới với vai trò mặc định: ${defaultRole}`
      );
    } else {
      userProfile = doc.data();
    }

    // Check account status
    if (userProfile.status === "blocked") {
      return res.status(403).json({ error: "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên." });
    }

    req.user = userProfile;
    next();
  } catch (error: any) {
    console.error("Token verification failed:", error);
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

const ACTIVITY_TTL_DAYS = 7;
const ACTIVITY_TTL_MS = ACTIVITY_TTL_DAYS * 24 * 60 * 60 * 1000;

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
const DEFAULT_TTS_VOICE_BY_LANG: Record<string, string> = {
  "en-US": "edge_en-US-AriaNeural",
  "en-GB": "edge_en-GB-SoniaNeural"
};
const ttsQueue: TtsQueueJob[] = [];
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
  const lang = settings.lang === "en-GB" ? "en-GB" : DEFAULT_TTS_LANG;
  const speed = Math.min(1.5, Math.max(0.5, Number(settings.speed || DEFAULT_TTS_SPEED)));
  return {
    autoGenerate: Boolean(settings.autoGenerate),
    provider: settings.provider || DEFAULT_TTS_PROVIDER,
    voice: settings.voice || DEFAULT_TTS_VOICE_BY_LANG[lang] || DEFAULT_TTS_VOICE_BY_LANG[DEFAULT_TTS_LANG],
    lang,
    speed
  };
}

function createAudioHash(text: string, settings: Required<TtsSettings>) {
  const normalizedText = normalizeTtsText(text);
  return crypto
    .createHash("sha256")
    .update(`${settings.provider}|${settings.lang}|${settings.voice}|${settings.speed}|${normalizedText}`)
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

function getAi33TaskUrl(taskId: string) {
  const template = process.env.AI33_TASK_STATUS_URL_TEMPLATE || "https://api.ai33.pro/v1/task/{taskId}";
  return template.replace("{taskId}", encodeURIComponent(taskId));
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
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

  const res = await fetch("https://api.ai33.pro/v3/text-to-speech", {
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
    const res = await fetch(getAi33TaskUrl(taskId), {
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

async function downloadAudioToCache(sourceUrl: string, targetPath: string) {
  const res = await fetch(sourceUrl);
  if (!res.ok) throw new Error(`Audio download failed with HTTP ${res.status}`);
  const contentType = res.headers.get("content-type") || "";
  if (contentType && !contentType.includes("audio") && !contentType.includes("octet-stream")) {
    throw new Error(`Downloaded TTS file is not audio (${contentType}).`);
  }
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (buffer.byteLength < 1024) {
    throw new Error("Downloaded TTS file is too small to be valid audio.");
  }
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, buffer);
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
      audioPath: targetPath,
      audioUrl: targetUrl,
      cached: true,
      ttsText: sanitized.text,
      warnings: sanitized.warnings
    };
  }

  if (force && fs.existsSync(targetPath)) {
    try {
      fs.unlinkSync(targetPath);
    } catch (err) {
      console.warn("Could not remove old TTS cache before regeneration:", err);
    }
  }

  const taskId = await requestAi33TtsTask(sanitized.text, settings, audioFileName(audioHash));
  const providerAudioUrl = await pollAi33AudioUrl(taskId);
  await downloadAudioToCache(providerAudioUrl, targetPath);
  return {
    audioHash,
    audioPath: targetPath,
    audioUrl: `${targetUrl}?v=${Date.now()}`,
    cached: false,
    ttsText: sanitized.text,
    warnings: sanitized.warnings
  };
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

  for (const item of items) {
    if (!selected.has(item.id)) continue;
    const sanitized = sanitizeTtsInput(String(item.term || ""));
    if (!sanitized.text) continue;

    const audioHash = createAudioHash(sanitized.text, job.settings);
    const targetPath = audioFilePath(audioHash);
    const existingReady = !job.force && item.audioHash === audioHash && item.audioUrl && fs.existsSync(targetPath);

    if (existingReady) continue;

    if (!job.force && fs.existsSync(targetPath)) {
      items = items.map((current: any) => current.id === item.id
        ? mergeItemAudioState(current, {
            audioUrl: audioPublicUrl(audioHash),
            audioPath: targetPath,
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
      await saveVocabSetItems(job.vocabSetId, items);
      continue;
    }

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
    await saveVocabSetItems(job.vocabSetId, items);

    try {
      const result = await generateCachedTtsAudio(sanitized.text, job.settings, job.force);
      items = items.map((current: any) => current.id === item.id
        ? mergeItemAudioState(current, {
            audioUrl: result.audioUrl,
            audioPath: result.audioPath,
            audioHash: result.audioHash,
            audioStatus: "ready",
            audioError: "",
            ttsText: result.ttsText,
            audioWarnings: result.warnings,
            ttsProvider: job.settings.provider,
            ttsVoice: job.settings.voice,
            ttsLang: job.settings.lang,
            ttsSpeed: job.settings.speed,
            audioGeneratedAt: new Date().toISOString()
          })
        : current
      );
    } catch (err: any) {
      items = items.map((current: any) => current.id === item.id
        ? mergeItemAudioState(current, {
            audioHash,
            audioStatus: "failed",
            audioError: err.message || "TTS generation failed.",
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

    await saveVocabSetItems(job.vocabSetId, items);
  }
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

// 0. GET EMAIL BY PHONE (Unauthenticated - for Phone + Password login)
app.post("/api/auth/email-by-phone", async (req, res) => {
  try {
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
    res.status(500).json({ error: err.message });
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
    const updatedProfile = {
      ...req.user,
      name: name || req.user.name,
      phone: phone || req.user.phone || undefined
    };

    await userRef.set(updatedProfile);
    res.json(updatedProfile);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
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

    const assignmentsSnapshot = await adminDb.collection("assignments").get();
    const assignments: any[] = [];
    let matchedAssignment: any = null;
    assignmentsSnapshot.forEach(doc => {
      const assignment = { id: doc.id, ...doc.data() };
      assignments.push(assignment);
      const assignmentToken = assignment.shareToken || assignment.assignmentSlug || assignment.id;
      if (!matchedAssignment && assignmentToken === token) {
        matchedAssignment = assignment;
      }
    });

    const snapshot = await adminDb.collection("vocab_sets").get();
    let found: any = null;

    if (matchedAssignment) {
      snapshot.forEach(doc => {
        const set = { id: doc.id, ...doc.data() };
        if (!found && set.id === matchedAssignment.vocabSetId) {
          found = {
            ...normalizeVocabSetForSave(set, set),
            assignmentId: matchedAssignment.id,
            assignmentGameId: matchedAssignment.gameId,
            assignmentTitle: matchedAssignment.title,
            classId: matchedAssignment.classId,
            className: matchedAssignment.className
          };
        }
      });
    } else {
      snapshot.forEach(doc => {
        const set = { id: doc.id, ...doc.data() };
        const setToken = set.shareToken || set.assignmentSlug;
        if (!found && setToken === token && getVocabVisibility(set) === "assignment") {
          found = normalizeVocabSetForSave(set, set);
        }
      });

      if (found) {
        const matchingAssignments = assignments.filter(assignment => assignment.vocabSetId === found.id);
        if (matchingAssignments.length === 1) {
          const assignment = matchingAssignments[0];
          found = {
            ...found,
            assignmentId: assignment.id,
            assignmentGameId: assignment.gameId,
            assignmentTitle: assignment.title,
            classId: assignment.classId,
            className: assignment.className
          };
        }
      }
    }

    if (!found) {
      return res.status(404).json({ error: "Không tìm thấy bài tập hoặc link không hợp lệ" });
    }

    res.json(found);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
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

      list.push({
        ...set,
        visibility: normalizedVisibility,
        status: toLegacyStatus(normalizedVisibility)
      });
    });

    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. PUBLIC GAME RESULTS: Minimal completed sessions for the student golden board
app.get("/api/public/results", async (req, res) => {
  try {
    const snapshot = await adminDb.collection("game_sessions").get();
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

    list.sort((a, b) => new Date(getActivityTime(b)).getTime() - new Date(getActivityTime(a)).getTime());
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
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
      list.push({
        ...set,
        visibility: normalizedVisibility,
        status: toLegacyStatus(normalizedVisibility)
      });
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

    // Role check: students can only see 'public' sets! Teachers/admins see all.
    if (req.user && req.user.role === "student") {
      list = list.filter(set => getVocabVisibility(set) === "public");
    }

    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
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

    res.status(201).json(newSet);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
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

    res.json(updatedSet);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
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

    const upstream = await fetch(`https://api.ai33.pro/v3/voices?${params.toString()}`, {
      headers: { "xi-api-key": apiKey }
    });
    const data = await upstream.json().catch(() => ({}));
    res.status(upstream.status).json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/vocab-sets/:id/audio/status", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
  try {
    const doc = await adminDb.collection("vocab_sets").doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: "Vocabulary set not found." });
    const set = doc.data();
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
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/vocab-sets/:id/audio/generate-missing", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
  try {
    const doc = await adminDb.collection("vocab_sets").doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: "Vocabulary set not found." });

    const settings = normalizeTtsSettings(req.body?.settings || doc.data().ttsSettings || {});
    const itemIds = Array.isArray(req.body?.itemIds) ? req.body.itemIds.map(String) : undefined;
    const force = Boolean(req.body?.force);
    enqueueVocabSetAudio(req.params.id, settings, itemIds, force);
    res.json({ queued: true, itemIds: itemIds || null, force });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
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

    const setDetails = existing.data();
    await docRef.delete();

    // Clean up related assignments
    const assignSnapshot = await adminDb.collection("assignments").where("vocabSetId", "==", id).get();
    const batch = adminDb.batch();
    assignSnapshot.forEach(doc => {
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
    res.status(500).json({ error: err.message });
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

    res.json(clone);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 11. CLASSES: Get all classes
app.get("/api/classes", authenticateUser, async (req, res) => {
  try {
    const snapshot = await adminDb.collection("classes").get();
    const list: any[] = [];
    snapshot.forEach(doc => list.push(doc.data()));
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
  }
});

// 13. CLASS MEMBERS: Get class members
app.get("/api/class-members", authenticateUser, async (req, res) => {
  try {
    const snapshot = await adminDb.collection("class_members").get();
    const list: any[] = [];
    snapshot.forEach(doc => list.push(doc.data()));
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 14. CLASS MEMBERS: Add member
app.post("/api/classes/:classId/members", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
  try {
    const classId = req.params.classId;
    const { studentName } = req.body;
    const id = `member-${Date.now()}`;
    const newMember = {
      id,
      classId,
      studentName
    };

    await adminDb.collection("class_members").doc(id).set(newMember);
    res.status(201).json(newMember);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 15. CLASS MEMBERS: Delete member
app.delete("/api/classes/:classId/members/:memberId", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
  try {
    const memberId = req.params.memberId;
    await adminDb.collection("class_members").doc(memberId).delete();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 16. ASSIGNMENTS: Get assignments
app.get("/api/assignments", authenticateUser, async (req, res) => {
  try {
    const snapshot = await adminDb.collection("assignments").get();
    const list: any[] = [];
    snapshot.forEach(doc => list.push(doc.data()));
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 17. ASSIGNMENTS: Create assignment
app.post("/api/assignments", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
    const payload = req.body;
    const id = `assign-${Date.now()}`;
    const shareToken = payload.shareToken || payload.assignmentSlug || createShareToken();
    const newAssign = {
      ...payload,
      id,
      shareToken,
      assignmentSlug: shareToken,
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
    res.status(500).json({ error: err.message });
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

    const assignDetails = existing.data();
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
    res.status(500).json({ error: err.message });
  }
});

// 19. GAME SESSIONS: Start a session
app.post("/api/game-sessions", async (req, res) => {
  try {
    const payload = req.body;
    const id = `session-${Date.now()}`;
    const now = new Date().toISOString();
    let assignment: any = null;
    if (payload.assignmentId) {
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

    let inferredClass: any = null;
    if (!payload.classId && !assignment && payload.vocabSetId) {
      const assignmentsSnapshot = await adminDb.collection("assignments").get();
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
    const newSession = {
      ...payload,
      id,
      classId: payload.classId || assignment?.classId || inferredClass?.classId || "",
      className: payload.className || assignment?.className || inferredClass?.className || "",
      startedAt: now,
      createdAt: now,
      status: "started",
      score: 0,
      totalQuestions: 0,
      correctAnswers: 0,
      incorrectAnswers: 0
    };

    await adminDb.collection("game_sessions").doc(id).set(newSession);
    res.status(201).json(newSession);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 20. GAME SESSIONS: Update/complete session results
app.put("/api/game-sessions/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const payload = req.body;

    const docRef = adminDb.collection("game_sessions").doc(id);
    const existing = await docRef.get();
    if (!existing.exists) {
      return res.status(404).json({ error: "Session không tồn tại." });
    }

    const endedAt = payload.endedAt || new Date().toISOString();
    const startedAt = existing.data()?.startedAt || payload.startedAt || endedAt;
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
      ...existing.data(),
      ...payload,
      answerDetails: sanitizedAnswerDetails,
      totalQuestions,
      correctAnswers,
      incorrectAnswers: Math.max(0, Number(payload.incorrectAnswers || 0)),
      accuracy: totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0,
      durationMs,
      durationSeconds: Math.round(durationMs / 1000),
      status: "completed",
      endedAt,
      completedAt: endedAt,
      expiresAt: addDaysIso(endedAt, ACTIVITY_TTL_DAYS)
    };

    await docRef.set(updatedSession);
    res.json(updatedSession);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 21. PRONUNCIATION ATTEMPTS: Save one speaking practice attempt
app.post("/api/pronunciation-attempts", async (req, res) => {
  try {
    const payload = req.body || {};
    const now = new Date().toISOString();
    const id = payload.id || `pronunciation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const attempt = {
      id,
      studentId: payload.studentId || payload.guestId || "guest",
      studentName: payload.studentName || "",
      vocabularySetId: payload.vocabularySetId || payload.vocabSetId || "",
      wordId: payload.wordId || "",
      targetText: payload.targetText || "",
      recognizedText: payload.recognizedText || "",
      score: Math.max(0, Math.min(100, Number(payload.score || 0))),
      correctWords: Math.max(0, Number(payload.correctWords || 0)),
      totalWords: Math.max(0, Number(payload.totalWords || 0)),
      attemptCount: Math.max(1, Number(payload.attemptCount || 1)),
      gameSessionId: payload.gameSessionId || "",
      gameId: "speaking-ai",
      playedAt: payload.playedAt || now,
      createdAt: now
    };

    await adminDb.collection("pronunciation_attempts").doc(id).set(attempt);
    res.status(201).json(attempt);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 22. GAME RESULTS: Get all finished game sessions
app.get("/api/results", authenticateUser, async (req, res) => {
  try {
    const snapshot = await adminDb.collection("game_sessions").get();
    const list: any[] = [];
    const cutoff = Date.now() - ACTIVITY_TTL_MS;
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.completedAt && !isExpiredActivity(data) && new Date(getActivityTime(data)).getTime() >= cutoff) {
        list.push({ ...data, id: data.id || doc.id });
      }
    });
    list.sort((a, b) => new Date(getActivityTime(b)).getTime() - new Date(getActivityTime(a)).getTime());
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
  }
});

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
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
  }
});


// ============================================================================
// VITE OR STATIC SERVING MIDDLEWARE
// ============================================================================

async function start() {
  if (process.env.NODE_ENV !== "production") {
    // Start Vite in middleware mode
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development server loaded as middleware.");
  } else {
    // Production serving static files
    const distPath = path.join(process.cwd(), "dist", "client");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Production static build routing active.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });

  firebaseDiagnosticReady
    .then(async () => {
      await preSeedDb();
    })
    .catch((err) => {
      console.error("Background Firebase startup tasks failed", err);
    });
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

function normalizeVocabSetForSave(payload: any, existing: any = {}) {
  const merged = {
    ...existing,
    ...payload
  };
  const visibility = getVocabVisibility(merged);
  const normalized = {
    ...merged,
    visibility,
    status: toLegacyStatus(visibility)
  };

  if (visibility === "assignment") {
    normalized.shareToken = existing.shareToken || existing.assignmentSlug || payload.shareToken || payload.assignmentSlug || createShareToken();
    normalized.assignmentSlug = normalized.shareToken;
  } else {
    delete normalized.shareToken;
    delete normalized.assignmentSlug;
  }

  return normalized;
}

start().catch((err) => {
  console.error("Failed to start fullstack server", err);
});




