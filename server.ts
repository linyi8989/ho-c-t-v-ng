import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { adminDb, adminAuth } from "./src/lib/firebaseAdmin.js";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

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

// Execute Pre-seed
preSeedDb();

// ============================================================================
// GEMINI CLIENT INITIALIZATION
// ============================================================================
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

    const ai = getGeminiClient();
    if (!ai) {
      return res.json({ ipa: `/${word.toLowerCase()}/` });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Provide the standard American English IPA phonetic transcription for the word/phrase: "${word}". Output ONLY the IPA string surrounded by slashes, e.g., "/ˈæpl/". Do not add any extra explanations or formatting.`,
    });

    const ipa = response.text?.trim() || `/${word.toLowerCase()}/`;
    res.json({ ipa });
  } catch (error: any) {
    console.warn("AI IPA generator service unavailable, returning fallback:", error.message);
    res.json({ ipa: `/${(word || "").toLowerCase()}/`, isFallback: true });
  }
});

// 4. AI: Batch generate full vocab set
app.post("/api/ai/generate", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
  const { topic, grade, wordsCount = 5 } = req.body;
  try {
    if (!topic || typeof topic !== "string") {
      return res.status(400).json({ error: "Tham số 'topic' là bắt buộc." });
    }

    const ai = getGeminiClient();
    if (!ai) {
      const fallbackList = getFallbackVocabulary(topic, wordsCount);
      return res.json(fallbackList);
    }

    const prompt = `Generate a JSON array of exactly ${wordsCount} English vocabulary words for topic: "${topic}" targeted for students at grade level: "${grade || 'primary school'}". 
    Each word item MUST have the following attributes:
    1. "term": English word or short phrase.
    2. "meaning": Vietnamese meaning.
    3. "ipa": Standard IPA phonetic transcription.
    4. "pos": Part of speech (e.g., Noun, Verb, Adjective, Adverb, Phrase).
    5. "example": A simple English example sentence.
    6. "exampleMeaning": Vietnamese translation of that example.
    
    Make sure example sentences are easy to understand for the specified grade level.
    Return ONLY valid JSON. Avoid markdown blocks.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
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
      }
    });

    const parsedData = JSON.parse(response.text?.trim() || "[]");
    res.json(parsedData);
  } catch (error: any) {
    console.warn("AI generation service unavailable, returning fallback:", error.message);
    const fallbackList = getFallbackVocabulary(topic, wordsCount);
    res.json(fallbackList);
  }
});

// 5. VOCAB SETS: Get all vocab sets
app.get("/api/vocab-sets", authenticateUser, async (req, res) => {
  try {
    const { search, grade, status } = req.query;
    const snapshot = await adminDb.collection("vocab_sets").get();
    let list: any[] = [];
    snapshot.forEach(doc => {
      list.push(doc.data());
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

    // Role check: students can only see 'public' sets! Teachers/admins see all.
    if (req.user && req.user.role === "student") {
      list = list.filter(set => set.status === "public");
    }

    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 6. VOCAB SETS: Create new set
app.post("/api/vocab-sets", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
    const set = req.body;
    const id = `set-${Date.now()}`;
    const newSet = {
      ...set,
      id,
      createdAt: new Date().toISOString(),
      createdBy: req.user.id,
      creatorName: req.user.name
    };

    await adminDb.collection("vocab_sets").doc(id).set(newSet);
    
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

// 7. VOCAB SETS: Update set
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

    const updatedSet = {
      ...existingDoc.data(),
      ...payload,
      id // preserve id
    };

    await docRef.set(updatedSet);

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

// 8. VOCAB SETS: Delete set
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

// 9. VOCAB SETS: Clone set
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
    const clone = {
      ...original,
      id: cloneId,
      title: `${original.title} (Nhân bản)`,
      status: "draft",
      createdAt: new Date().toISOString(),
      createdBy: req.user.id,
      creatorName: req.user.name
    };

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

// 10. CLASSES: Get all classes
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
    const newAssign = {
      ...payload,
      id,
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
app.post("/api/game-sessions", authenticateUser, async (req, res) => {
  try {
    const payload = req.body;
    const id = `session-${Date.now()}`;
    const newSession = {
      ...payload,
      id,
      startedAt: new Date().toISOString(),
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
app.put("/api/game-sessions/:id", authenticateUser, async (req, res) => {
  try {
    const id = req.params.id;
    const payload = req.body;

    const docRef = adminDb.collection("game_sessions").doc(id);
    const existing = await docRef.get();
    if (!existing.exists) {
      return res.status(404).json({ error: "Session không tồn tại." });
    }

    const updatedSession = {
      ...existing.data(),
      ...payload,
      completedAt: new Date().toISOString()
    };

    await docRef.set(updatedSession);
    res.json(updatedSession);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 21. GAME RESULTS: Get all finished game sessions
app.get("/api/results", authenticateUser, async (req, res) => {
  try {
    const snapshot = await adminDb.collection("game_sessions").get();
    const list: any[] = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.completedAt) {
        list.push(data);
      }
    });
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// SUPER ADMIN EXCLUSIVE INTERFACES
// ============================================================================

// 22. ADMIN: List all registered users (With role & status updates, classes filtering)
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

    // Set custom claim on firebase authentication as well
    await adminAuth.setCustomUserClaims(targetUserId, { role });

    // Audit Log
    await logAuditAction(
      req.user.id,
      req.user.name,
      req.user.email,
      "UPDATE_USER_ROLE",
      `Đã thay đổi vai trò của user "${userData?.name}" (${userData?.email}) từ ${userData?.role} thành ${role}`
    );

    res.json({ success: true, userId: targetUserId, role });
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
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Production static build routing active.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start fullstack server", err);
});
