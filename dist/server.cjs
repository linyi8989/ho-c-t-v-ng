var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path2 = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_genai = require("@google/genai");
var import_dotenv = __toESM(require("dotenv"), 1);

// src/lib/firebaseAdmin.ts
var import_config = require("dotenv/config");
var import_app = require("firebase-admin/app");
var import_firestore = require("firebase-admin/firestore");
var import_auth = require("firebase-admin/auth");
var import_fs = __toESM(require("fs"), 1);
var import_path = __toESM(require("path"), 1);
var projectId = process.env.FIREBASE_PROJECT_ID;
var clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
var privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
var hasServiceAccountCredentials = Boolean(projectId && clientEmail && privateKey);
var serviceAccount = hasServiceAccountCredentials ? {
  projectId,
  clientEmail,
  privateKey
} : null;
var app = (0, import_app.getApps)().length === 0 ? (0, import_app.initializeApp)(
  serviceAccount ? {
    credential: (0, import_app.cert)(serviceAccount),
    projectId: serviceAccount.projectId
  } : { projectId }
) : (0, import_app.getApp)();
var realDb = (0, import_firestore.getFirestore)(app);
var adminAuth = (0, import_auth.getAuth)(app);
console.log(`Firebase Admin initialized for project: ${projectId || "(not configured)"}, Database: (default)`);
var LocalDbEngine = class {
  constructor() {
    this.memoryCache = null;
    this.filePath = import_path.default.join(process.cwd(), "db.json");
    this.load();
  }
  mapCollectionKey(name) {
    const lower = name.toLowerCase();
    if (lower === "class_members" || lower === "classmembers") return "classMembers";
    if (lower === "vocab_sets" || lower === "vocabsets") return "vocabSets";
    if (lower === "game_sessions" || lower === "gamesessions") return "gameSessions";
    if (lower === "audit_logs" || lower === "auditlogs") return "auditLogs";
    return name;
  }
  load() {
    try {
      if (import_fs.default.existsSync(this.filePath)) {
        const raw = import_fs.default.readFileSync(this.filePath, "utf8");
        this.memoryCache = JSON.parse(raw);
      } else {
        this.memoryCache = {};
      }
    } catch (err) {
      console.error("LocalDbEngine failed to load database:", err);
      this.memoryCache = {};
    }
  }
  save() {
    try {
      import_fs.default.writeFileSync(this.filePath, JSON.stringify(this.memoryCache, null, 2), "utf8");
    } catch (err) {
      console.error("LocalDbEngine failed to save database:", err);
    }
  }
  getCollection(collectionName) {
    this.load();
    const key = this.mapCollectionKey(collectionName);
    if (!this.memoryCache[key]) {
      this.memoryCache[key] = [];
    }
    return this.memoryCache[key];
  }
  saveCollection(collectionName, items) {
    const key = this.mapCollectionKey(collectionName);
    this.memoryCache[key] = items;
    this.save();
  }
  getDocument(collectionName, docId) {
    const items = this.getCollection(collectionName);
    return items.find((item) => item.id === docId);
  }
  setDocument(collectionName, docId, data) {
    const items = this.getCollection(collectionName);
    const index = items.findIndex((item) => item.id === docId);
    const docData = { ...data, id: docId };
    if (index >= 0) {
      items[index] = { ...items[index], ...docData };
    } else {
      items.push(docData);
    }
    this.saveCollection(collectionName, items);
  }
  updateDocument(collectionName, docId, data) {
    const items = this.getCollection(collectionName);
    const index = items.findIndex((item) => item.id === docId);
    if (index >= 0) {
      items[index] = { ...items[index], ...data };
      this.saveCollection(collectionName, items);
    } else {
      this.setDocument(collectionName, docId, data);
    }
  }
  deleteDocument(collectionName, docId) {
    const items = this.getCollection(collectionName);
    const filtered = items.filter((item) => item.id !== docId);
    this.saveCollection(collectionName, filtered);
  }
};
var localDb = new LocalDbEngine();
var useLocalFallback = false;
async function runDiagnostic() {
  if (!hasServiceAccountCredentials) {
    console.warn("Firebase Admin credentials are not configured. Activating Local DB fallback engine.");
    useLocalFallback = true;
    return;
  }
  try {
    const testDoc = realDb.collection("system_status_check").doc("status");
    await testDoc.set({ active: true, checkedAt: (/* @__PURE__ */ new Date()).toISOString() });
    await testDoc.get();
    await testDoc.delete();
    console.log("\u2705 Firestore connection diagnostics succeeded! Real Firestore DB will be used.");
    useLocalFallback = false;
  } catch (err) {
    console.warn("\u26A0\uFE0F Firestore validation failed. Activating resilient Local DB Fallback engine.", err.message);
    useLocalFallback = true;
  }
}
var firebaseDiagnosticReady = runDiagnostic();
var FallbackDocSnapshot = class {
  constructor(id, exists, ref, data) {
    this.id = id;
    this.exists = exists;
    this.ref = ref;
    this._data = data;
  }
  data() {
    return this._data;
  }
};
var FallbackQuerySnapshot = class {
  constructor(docs) {
    this.docs = docs;
    this.empty = docs.length === 0;
  }
  forEach(callback) {
    this.docs.forEach(callback);
  }
};
var FallbackDoc = class {
  constructor(collectionName, id) {
    this.collectionName = collectionName;
    this.id = id;
    this.ref = this;
  }
  async get() {
    if (!useLocalFallback) {
      try {
        const snap = await realDb.collection(this.collectionName).doc(this.id).get();
        return new FallbackDocSnapshot(snap.id, snap.exists, this, snap.data());
      } catch (err) {
        console.warn(`FallbackDoc.get failed on Firestore: ${err.message}. Falling back to local.`);
        useLocalFallback = true;
      }
    }
    const data = localDb.getDocument(this.collectionName, this.id);
    return new FallbackDocSnapshot(this.id, data !== void 0, this, data);
  }
  async set(data) {
    if (!useLocalFallback) {
      try {
        await realDb.collection(this.collectionName).doc(this.id).set(data);
        localDb.setDocument(this.collectionName, this.id, data);
        return;
      } catch (err) {
        console.warn(`FallbackDoc.set failed on Firestore: ${err.message}. Falling back to local.`);
        useLocalFallback = true;
      }
    }
    localDb.setDocument(this.collectionName, this.id, data);
  }
  async update(data) {
    if (!useLocalFallback) {
      try {
        await realDb.collection(this.collectionName).doc(this.id).update(data);
        localDb.updateDocument(this.collectionName, this.id, data);
        return;
      } catch (err) {
        console.warn(`FallbackDoc.update failed on Firestore: ${err.message}. Falling back to local.`);
        useLocalFallback = true;
      }
    }
    localDb.updateDocument(this.collectionName, this.id, data);
  }
  async delete() {
    if (!useLocalFallback) {
      try {
        await realDb.collection(this.collectionName).doc(this.id).delete();
        localDb.deleteDocument(this.collectionName, this.id);
        return;
      } catch (err) {
        console.warn(`FallbackDoc.delete failed on Firestore: ${err.message}. Falling back to local.`);
        useLocalFallback = true;
      }
    }
    localDb.deleteDocument(this.collectionName, this.id);
  }
};
var FallbackQuery = class {
  constructor(collectionName) {
    this.filters = [];
    this.collectionName = collectionName;
  }
  where(field, op, val) {
    this.filters.push({ field, op, val });
    return this;
  }
  limit(n) {
    this.limitVal = n;
    return this;
  }
  orderBy(field, dir = "asc") {
    this.orderField = field;
    this.orderDir = dir;
    return this;
  }
  async get() {
    if (!useLocalFallback) {
      try {
        let query = realDb.collection(this.collectionName);
        for (const f of this.filters) {
          query = query.where(f.field, f.op, f.val);
        }
        if (this.orderField) {
          query = query.orderBy(this.orderField, this.orderDir);
        }
        if (this.limitVal !== void 0) {
          query = query.limit(this.limitVal);
        }
        const snap = await query.get();
        const docs2 = snap.docs.map((doc) => {
          return new FallbackDocSnapshot(doc.id, doc.exists, new FallbackDoc(this.collectionName, doc.id), doc.data());
        });
        return new FallbackQuerySnapshot(docs2);
      } catch (err) {
        console.warn(`FallbackQuery.get failed on Firestore: ${err.message}. Falling back to local.`);
        useLocalFallback = true;
      }
    }
    let results = [...localDb.getCollection(this.collectionName)];
    for (const f of this.filters) {
      results = results.filter((item) => {
        const itemVal = item[f.field];
        if (f.op === "==") return itemVal === f.val;
        if (f.op === "!=") return itemVal !== f.val;
        if (f.op === ">") return itemVal > f.val;
        if (f.op === ">=") return itemVal >= f.val;
        if (f.op === "<") return itemVal < f.val;
        if (f.op === "<=") return itemVal <= f.val;
        if (f.op === "array-contains") return Array.isArray(itemVal) && itemVal.includes(f.val);
        return true;
      });
    }
    if (this.orderField) {
      const field = this.orderField;
      const desc = this.orderDir === "desc";
      results.sort((a, b) => {
        const valA = a[field];
        const valB = b[field];
        if (valA === void 0) return 1;
        if (valB === void 0) return -1;
        if (valA < valB) return desc ? 1 : -1;
        if (valA > valB) return desc ? -1 : 1;
        return 0;
      });
    }
    if (this.limitVal !== void 0) {
      results = results.slice(0, this.limitVal);
    }
    const docs = results.map((item) => {
      const id = item.id || Math.random().toString(36).substring(2);
      return new FallbackDocSnapshot(id, true, new FallbackDoc(this.collectionName, id), item);
    });
    return new FallbackQuerySnapshot(docs);
  }
};
var FallbackCollection = class extends FallbackQuery {
  constructor(name) {
    super(name);
  }
  doc(id) {
    const finalId = id || Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
    return new FallbackDoc(this.collectionName, finalId);
  }
  async add(data) {
    const id = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
    const doc = this.doc(id);
    await doc.set(data);
    return doc;
  }
};
var FallbackBatch = class {
  constructor() {
    this.ops = [];
  }
  set(doc, data) {
    this.ops.push({ type: "set", doc, data });
    return this;
  }
  update(doc, data) {
    this.ops.push({ type: "update", doc, data });
    return this;
  }
  delete(doc) {
    this.ops.push({ type: "delete", doc });
    return this;
  }
  async commit() {
    if (!useLocalFallback) {
      try {
        const batch = realDb.batch();
        for (const op of this.ops) {
          const realDocRef = realDb.collection(op.doc.collectionName).doc(op.doc.id);
          if (op.type === "set") batch.set(realDocRef, op.data);
          else if (op.type === "update") batch.update(realDocRef, op.data);
          else if (op.type === "delete") batch.delete(realDocRef);
        }
        await batch.commit();
        for (const op of this.ops) {
          const doc = op.doc;
          if (op.type === "set") localDb.setDocument(doc.collectionName, doc.id, op.data);
          else if (op.type === "update") localDb.updateDocument(doc.collectionName, doc.id, op.data);
          else if (op.type === "delete") localDb.deleteDocument(doc.collectionName, doc.id);
        }
        return;
      } catch (err) {
        console.warn(`FallbackBatch.commit failed on Firestore: ${err.message}. Falling back to local.`);
        useLocalFallback = true;
      }
    }
    for (const op of this.ops) {
      const doc = op.doc;
      if (op.type === "set") localDb.setDocument(doc.collectionName, doc.id, op.data);
      else if (op.type === "update") localDb.updateDocument(doc.collectionName, doc.id, op.data);
      else if (op.type === "delete") localDb.deleteDocument(doc.collectionName, doc.id);
    }
  }
};
var FallbackFirestore = class {
  constructor() {
    this.projectId = projectId;
  }
  collection(name) {
    return new FallbackCollection(name);
  }
  batch() {
    return new FallbackBatch();
  }
};
var adminDb = new FallbackFirestore();

// server.ts
import_dotenv.default.config();
var app2 = (0, import_express.default)();
var PORT = Number(process.env.PORT) || 3e3;
app2.use(import_express.default.json());
async function logAuditAction(userId, userName, userEmail, action, details) {
  try {
    const logId = `log-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
    await adminDb.collection("audit_logs").doc(logId).set({
      id: logId,
      userId,
      userName,
      userEmail,
      action,
      details,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    console.log(`[AUDIT LOG] ${userName} (${userEmail}) did action: ${action}. Details: ${details}`);
  } catch (err) {
    console.error("Error writing audit log:", err);
  }
}
var authenticateUser = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Kh\xF4ng t\xECm th\u1EA5y token x\xE1c th\u1EF1c. Vui l\xF2ng \u0111\u0103ng nh\u1EADp." });
  }
  const token = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;
    const email = decodedToken.email || "";
    const phone = decodedToken.phone_number || "";
    const userRef = adminDb.collection("users").doc(uid);
    const doc = await userRef.get();
    let userProfile;
    if (!doc.exists) {
      let defaultRole = "student";
      if (email === "linyi8901@gmail.com" || email === "admin@vocabulary.edu.vn") {
        defaultRole = "super_admin";
      }
      userProfile = {
        id: uid,
        name: decodedToken.name || email.split("@")[0] || "H\u1ECDc sinh m\u1EDBi",
        email,
        phone: phone || void 0,
        role: defaultRole,
        status: "active",
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      await userRef.set(userProfile);
      await logAuditAction(
        userProfile.id,
        userProfile.name,
        userProfile.email,
        "REGISTER",
        `\u0110\u0103ng k\xFD t\xE0i kho\u1EA3n m\u1EDBi v\u1EDBi vai tr\xF2 m\u1EB7c \u0111\u1ECBnh: ${defaultRole}`
      );
    } else {
      userProfile = doc.data();
    }
    if (userProfile.status === "blocked") {
      return res.status(403).json({ error: "T\xE0i kho\u1EA3n c\u1EE7a b\u1EA1n \u0111\xE3 b\u1ECB kh\xF3a. Vui l\xF2ng li\xEAn h\u1EC7 qu\u1EA3n tr\u1ECB vi\xEAn." });
    }
    req.user = userProfile;
    next();
  } catch (error) {
    console.error("Token verification failed:", error);
    return res.status(401).json({ error: "Phi\xEAn \u0111\u0103ng nh\u1EADp kh\xF4ng h\u1EE3p l\u1EC7 ho\u1EB7c \u0111\xE3 h\u1EBFt h\u1EA1n." });
  }
};
var requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Vui l\xF2ng \u0111\u0103ng nh\u1EADp." });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n th\u1EF1c hi\u1EC7n h\xE0nh \u0111\u1ED9ng n\xE0y." });
    }
    next();
  };
};
var preSeedDb = async () => {
  try {
    console.log("Checking and seeding database if empty...");
    const usersSnapshot = await adminDb.collection("users").get();
    if (usersSnapshot.empty) {
      console.log("Seeding default users...");
      const defaultUsers = [
        { id: "teacher-1", name: "C\xF4 Th\u1EA3o English", email: "thao.teacher@gmail.com", role: "teacher", status: "active", createdAt: (/* @__PURE__ */ new Date()).toISOString() },
        { id: "admin-1", name: "H\u1EC7 th\u1ED1ng Admin", email: "admin@vocabulary.edu.vn", role: "super_admin", status: "active", createdAt: (/* @__PURE__ */ new Date()).toISOString() }
      ];
      for (const u of defaultUsers) {
        await adminDb.collection("users").doc(u.id).set(u);
      }
    }
    const classesSnapshot = await adminDb.collection("classes").get();
    if (classesSnapshot.empty) {
      console.log("Seeding default classes...");
      const defaultClasses = [
        { id: "class-1", name: "L\u1EDBp 3A1 - Ti\u1EBFng Anh Ti\u1EC3u H\u1ECDc", code: "LOP3A1", teacherId: "teacher-1" },
        { id: "class-2", name: "L\u1EDBp 6B2 - Ti\u1EBFng Anh THCS", code: "LOP6B2", teacherId: "teacher-1" }
      ];
      for (const c of defaultClasses) {
        await adminDb.collection("classes").doc(c.id).set(c);
      }
      const defaultMembers = [
        { id: "member-1", classId: "class-1", studentName: "Nguy\u1EC5n V\u0103n An" },
        { id: "member-2", classId: "class-1", studentName: "Tr\u1EA7n Th\u1ECB B\xECnh" },
        { id: "member-3", classId: "class-1", studentName: "L\xEA Ho\xE0ng Nam" },
        { id: "member-4", classId: "class-2", studentName: "Ph\u1EA1m H\u1EA3i \u0110\u0103ng" },
        { id: "member-5", classId: "class-2", studentName: "Nguy\u1EC5n Kh\xE1nh Linh" }
      ];
      for (const m of defaultMembers) {
        await adminDb.collection("class_members").doc(m.id).set(m);
      }
    }
    const vocabSnapshot = await adminDb.collection("vocab_sets").get();
    if (vocabSnapshot.empty) {
      console.log("Seeding default vocab sets...");
      const defaultVocabSets = [
        {
          id: "set-1",
          title: "Ordinal Numbers (S\u1ED1 th\u1EE9 t\u1EF1)",
          description: "H\u1ECDc c\xE1ch vi\u1EBFt v\xE0 ph\xE1t \xE2m c\xE1c s\u1ED1 th\u1EE9 t\u1EF1 c\u01A1 b\u1EA3n t\u1EEB th\u1EE9 nh\u1EA5t \u0111\u1EBFn th\u1EE9 m\u01B0\u1EDDi trong ti\u1EBFng Anh.",
          subject: "Numbers",
          tags: ["numbers", "basic", "math"],
          gradeLevel: "L\u1EDBp 3",
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          createdBy: "admin-1",
          creatorName: "H\u1EC7 th\u1ED1ng Admin",
          status: "public",
          items: [
            { id: "item-1-1", term: "First", meaning: "Th\u1EE9 nh\u1EA5t", ipa: "/f\u025C\u02D0st/", pos: "Adjective", example: "He won the first prize in the competition.", exampleMeaning: "C\u1EADu \u1EA5y \u0111\xE3 gi\xE0nh gi\u1EA3i nh\u1EA5t trong cu\u1ED9c thi.", displayOrder: 1 },
            { id: "item-1-2", term: "Second", meaning: "Th\u1EE9 hai", ipa: "/\u02C8sek\u0259nd/", pos: "Adjective", example: "This is the second time I have visited Hanoi.", exampleMeaning: "\u0110\xE2y l\xE0 l\u1EA7n th\u1EE9 hai t\xF4i \u0111\u1EBFn th\u0103m H\xE0 N\u1ED9i.", displayOrder: 2 },
            { id: "item-1-3", term: "Third", meaning: "Th\u1EE9 ba", ipa: "/\u03B8\u025C\u02D0d/", pos: "Adjective", example: "My office is on the third floor.", exampleMeaning: "V\u0103n ph\xF2ng c\u1EE7a t\xF4i n\u1EB1m \u1EDF t\u1EA7ng ba.", displayOrder: 3 },
            { id: "item-1-4", term: "Fourth", meaning: "Th\u1EE9 t\u01B0", ipa: "/f\u0254\u02D0\u03B8/", pos: "Adjective", example: "April is the fourth month of the year.", exampleMeaning: "Th\xE1ng T\u01B0 l\xE0 th\xE1ng th\u1EE9 t\u01B0 trong n\u0103m.", displayOrder: 4 },
            { id: "item-1-5", term: "Fifth", meaning: "Th\u1EE9 n\u0103m", ipa: "/f\u026Af\u03B8/", pos: "Adjective", example: "She finished in fifth place in the race.", exampleMeaning: "C\xF4 \u1EA5y v\u1EC1 \u0111\xEDch \u1EDF v\u1ECB tr\xED th\u1EE9 n\u0103m trong cu\u1ED9c \u0111ua.", displayOrder: 5 },
            { id: "item-1-6", term: "Sixth", meaning: "Th\u1EE9 s\xE1u", ipa: "/s\u026Aks\u03B8/", pos: "Adjective", example: "He is celebrating his sixth birthday today.", exampleMeaning: "H\xF4m nay c\u1EADu \u1EA5y \u0111ang m\u1EEBng sinh nh\u1EADt l\u1EA7n th\u1EE9 s\xE1u.", displayOrder: 6 },
            { id: "item-1-7", term: "Seventh", meaning: "Th\u1EE9 b\u1EA3y", ipa: "/\u02C8sevn\u03B8/", pos: "Adjective", example: "We live on the seventh street.", exampleMeaning: "Ch\xFAng t\xF4i s\u1ED1ng \u1EDF con \u0111\u01B0\u1EDDng th\u1EE9 b\u1EA3y.", displayOrder: 7 },
            { id: "item-1-8", term: "Eighth", meaning: "Th\u1EE9 t\xE1m", ipa: "/e\u026At\u03B8/", pos: "Adjective", example: "This is the eighth cup of water today.", exampleMeaning: "\u0110\xE2y l\xE0 c\u1ED1c n\u01B0\u1EDBc th\u1EE9 t\xE1m trong ng\xE0y h\xF4m nay.", displayOrder: 8 },
            { id: "item-1-9", term: "Ninth", meaning: "Th\u1EE9 ch\xEDn", ipa: "/na\u026An\u03B8/", pos: "Adjective", example: "The ninth chapter of the book is very interesting.", exampleMeaning: "Ch\u01B0\u01A1ng th\u1EE9 ch\xEDn c\u1EE7a cu\u1ED1n s\xE1ch r\u1EA5t th\xFA v\u1ECB.", displayOrder: 9 },
            { id: "item-1-10", term: "Tenth", meaning: "Th\u1EE9 m\u01B0\u1EDDi", ipa: "/ten\u03B8/", pos: "Adjective", example: "Today is our tenth wedding anniversary.", exampleMeaning: "H\xF4m nay l\xE0 k\u1EF7 ni\u1EC7m m\u01B0\u1EDDi n\u0103m ng\xE0y c\u01B0\u1EDBi c\u1EE7a ch\xFAng t\xF4i.", displayOrder: 10 }
          ]
        },
        {
          id: "set-2",
          title: "Animals - Basic (\u0110\u1ED9ng v\u1EADt c\u01A1 b\u1EA3n)",
          description: "B\u1ED9 t\u1EEB v\u1EF1ng v\u1EC1 c\xE1c lo\xE0i \u0111\u1ED9ng v\u1EADt quen thu\u1ED9c xung quanh ch\xFAng ta d\xE0nh cho h\u1ECDc sinh ti\u1EC3u h\u1ECDc.",
          subject: "Science",
          tags: ["animals", "nature", "basic"],
          gradeLevel: "L\u1EDBp 3",
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          createdBy: "admin-1",
          creatorName: "H\u1EC7 th\u1ED1ng Admin",
          status: "public",
          items: [
            { id: "item-2-1", term: "cat", meaning: "con m\xE8o", ipa: "/k\xE6t/", pos: "Noun", example: "The cat is sleeping on the warm sofa.", exampleMeaning: "Con m\xE8o \u0111ang ng\u1EE7 tr\xEAn chi\u1EBFc gh\u1EBF sofa \u1EA5m \xE1p.", displayOrder: 1 },
            { id: "item-2-2", term: "dog", meaning: "con ch\xF3", ipa: "/d\u0252\u0261/", pos: "Noun", example: "My dog loves to run in the park.", exampleMeaning: "Con ch\xF3 c\u1EE7a t\xF4i th\xEDch ch\u1EA1y nh\u1EA3y trong c\xF4ng vi\xEAn.", displayOrder: 2 },
            { id: "item-2-3", term: "bird", meaning: "con chim", ipa: "/b\u025C\u02D0d/", pos: "Noun", example: "A colorful bird is singing on the tree branch.", exampleMeaning: "M\u1ED9t ch\xFA chim \u0111\u1EA7y m\xE0u s\u1EAFc \u0111ang h\xF3t tr\xEAn c\xE0nh c\xE2y.", displayOrder: 3 },
            { id: "item-2-4", term: "fish", meaning: "con c\xE1", ipa: "/f\u026A\u0283/", pos: "Noun", example: "We have three gold fish in the tank.", exampleMeaning: "Ch\xFAng t\xF4i c\xF3 ba ch\xFA c\xE1 v\xE0ng trong b\u1EC3.", displayOrder: 4 },
            { id: "item-2-5", term: "elephant", meaning: "con voi", ipa: "/\u02C8el\u026Af\u0259nt/", pos: "Noun", example: "The elephant is the largest land mammal.", exampleMeaning: "Con voi l\xE0 lo\xE0i \u0111\u1ED9ng v\u1EADt c\xF3 v\xFA l\u1EDBn nh\u1EA5t tr\xEAn m\u1EB7t \u0111\u1EA5t.", displayOrder: 5 },
            { id: "item-2-6", term: "tiger", meaning: "con h\u1ED5", ipa: "/\u02C8ta\u026A\u0261\u0259(r)/", pos: "Noun", example: "The tiger has orange and black stripes.", exampleMeaning: "Con h\u1ED5 c\xF3 c\xE1c v\u1EB1n m\xE0u cam v\xE0 \u0111en.", displayOrder: 6 },
            { id: "item-2-7", term: "lion", meaning: "con s\u01B0 t\u1EED", ipa: "/\u02C8la\u026A\u0259n/", pos: "Noun", example: "The lion is known as the king of the jungle.", exampleMeaning: "S\u01B0 t\u1EED \u0111\u01B0\u1EE3c bi\u1EBFt \u0111\u1EBFn l\xE0 ch\xFAa t\u1EC3 r\u1EEBng xanh.", displayOrder: 7 },
            { id: "item-2-8", term: "monkey", meaning: "con kh\u1EC9", ipa: "/\u02C8m\u028C\u014Bki/", pos: "Noun", example: "The monkey is swinging from branch to branch.", exampleMeaning: "Con kh\u1EC9 \u0111ang chuy\u1EC1n t\u1EEB c\xE0nh n\xE0y sang c\xE0nh kh\xE1c.", displayOrder: 8 }
          ]
        }
      ];
      for (const set of defaultVocabSets) {
        await adminDb.collection("vocab_sets").doc(set.id).set(set);
      }
    }
    const assignSnapshot = await adminDb.collection("assignments").get();
    if (assignSnapshot.empty) {
      console.log("Seeding default assignments...");
      const defaultAssignments = [
        {
          id: "assign-1",
          classId: "class-1",
          className: "L\u1EDBp 3A1 - Ti\u1EBFng Anh Ti\u1EC3u H\u1ECDc",
          vocabSetId: "set-1",
          vocabSetTitle: "Ordinal Numbers (S\u1ED1 th\u1EE9 t\u1EF1)",
          gameId: "flashcard-en-vi",
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1e3).toISOString().split("T")[0],
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          createdBy: "teacher-1",
          title: "H\u1ECDc s\u1ED1 th\u1EE9 t\u1EF1 qua Flashcard"
        },
        {
          id: "assign-2",
          classId: "class-1",
          className: "L\u1EDBp 3A1 - Ti\u1EBFng Anh Ti\u1EC3u H\u1ECDc",
          vocabSetId: "set-2",
          vocabSetTitle: "Animals - Basic (\u0110\u1ED9ng v\u1EADt c\u01A1 b\u1EA3n)",
          gameId: "quiz-en-vi",
          dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1e3).toISOString().split("T")[0],
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          createdBy: "teacher-1",
          title: "Tr\u1EAFc nghi\u1EC7m \u0111\u1ED9ng v\u1EADt c\u01A1 b\u1EA3n"
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
var getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY is not defined. AI fallback will activate.");
    return null;
  }
  return new import_genai.GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
};
function getFallbackVocabulary(topic, count) {
  const normalized = topic.toLowerCase().trim();
  if (normalized.includes("animal") || normalized.includes("\u0111\u1ED9ng v\u1EADt") || normalized.includes("con v\u1EADt")) {
    const pool = [
      { term: "Elephant", meaning: "Con voi", ipa: "/\u02C8el\u026Af\u0259nt/", pos: "Noun", example: "The elephant is very large.", exampleMeaning: "Con voi r\u1EA5t to l\u1EDBn." },
      { term: "Tiger", meaning: "Con h\u1ED5", ipa: "/\u02C8ta\u026A\u0261\u0259(r)/", pos: "Noun", example: "The tiger runs very fast.", exampleMeaning: "Con h\u1ED5 ch\u1EA1y r\u1EA5t nhanh." },
      { term: "Monkey", meaning: "Con kh\u1EC9", ipa: "/\u02C8m\u028C\u014Bki/", pos: "Noun", example: "The monkey loves eating bananas.", exampleMeaning: "Con kh\u1EC9 th\xEDch \u0103n chu\u1ED1i." },
      { term: "Dolphin", meaning: "C\xE1 heo", ipa: "/\u02C8d\u0252lf\u026An/", pos: "Noun", example: "Dolphins are very friendly.", exampleMeaning: "C\xE1 heo r\u1EA5t th\xE2n thi\u1EC7n." },
      { term: "Giraffe", meaning: "H\u01B0\u01A1u cao c\u1ED5", ipa: "/d\u0292\u026A\u02C8r\u0251\u02D0f/", pos: "Noun", example: "The giraffe has a very long neck.", exampleMeaning: "H\u01B0\u01A1u cao c\u1ED5 c\xF3 chi\u1EBFc c\u1ED5 r\u1EA5t d\xE0i." }
    ];
    return pool.slice(0, count);
  }
  if (normalized.includes("school") || normalized.includes("tr\u01B0\u1EDDng h\u1ECDc") || normalized.includes("l\u1EDBp")) {
    const pool = [
      { term: "Teacher", meaning: "Gi\xE1o vi\xEAn", ipa: "/\u02C8ti\u02D0t\u0283\u0259(r)/", pos: "Noun", example: "Our teacher is very kind.", exampleMeaning: "Gi\xE1o vi\xEAn c\u1EE7a ch\xFAng t\xF4i r\u1EA5t t\u1ED1t b\u1EE5ng." },
      { term: "Student", meaning: "H\u1ECDc sinh", ipa: "/\u02C8stju\u02D0dnt/", pos: "Noun", example: "The students are listening.", exampleMeaning: "C\xE1c h\u1ECDc sinh \u0111ang l\u1EAFng nghe." },
      { term: "Classroom", meaning: "Ph\xF2ng h\u1ECDc", ipa: "/\u02C8kl\u0251\u02D0sru\u02D0m/", pos: "Noun", example: "Our classroom has a big board.", exampleMeaning: "Ph\xF2ng h\u1ECDc c\u1EE7a ch\xFAng t\xF4i c\xF3 b\u1EA3ng l\u1EDBn." }
    ];
    return pool.slice(0, count);
  }
  return [
    { term: topic.charAt(0).toUpperCase() + topic.slice(1), meaning: `T\u1EEB v\u1EC1 ${topic}`, ipa: "/\u02C8t\u0252p\u026Ak/", pos: "Noun", example: "This is an example.", exampleMeaning: "\u0110\xE2y l\xE0 v\xED d\u1EE5." }
  ];
}
app2.get("/api/auth/debug", async (req, res) => {
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
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
      stack: err.stack
    });
  }
});
app2.post("/api/auth/email-by-phone", async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ error: "Vui l\xF2ng cung c\u1EA5p s\u1ED1 \u0111i\u1EC7n tho\u1EA1i." });
    }
    let formattedPhone = phone.trim();
    if (formattedPhone.startsWith("0")) {
      formattedPhone = "+84" + formattedPhone.substring(1);
    } else if (!formattedPhone.startsWith("+")) {
      formattedPhone = "+84" + formattedPhone;
    }
    const snapshot = await adminDb.collection("users").where("phone", "==", formattedPhone).limit(1).get();
    if (snapshot.empty) {
      const rawSnapshot = await adminDb.collection("users").where("phone", "==", phone.trim()).limit(1).get();
      if (rawSnapshot.empty) {
        return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y t\xE0i kho\u1EA3n n\xE0o \u0111\u01B0\u1EE3c \u0111\u0103ng k\xFD v\u1EDBi s\u1ED1 \u0111i\u1EC7n tho\u1EA1i n\xE0y." });
      }
      const userData2 = rawSnapshot.docs[0].data();
      return res.json({ email: userData2.email });
    }
    const userData = snapshot.docs[0].data();
    return res.json({ email: userData.email });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app2.get("/api/me", authenticateUser, (req, res) => {
  res.json(req.user);
});
app2.post("/api/register", authenticateUser, async (req, res) => {
  try {
    const { name, phone } = req.body;
    if (!req.user) return res.status(401).json({ error: "Ch\u01B0a \u0111\u0103ng nh\u1EADp." });
    const userRef = adminDb.collection("users").doc(req.user.id);
    const updatedProfile = {
      ...req.user,
      name: name || req.user.name,
      phone: phone || req.user.phone || void 0
    };
    await userRef.set(updatedProfile);
    res.json(updatedProfile);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app2.post("/api/ai/ipa", authenticateUser, async (req, res) => {
  const { word } = req.body;
  try {
    if (!word || typeof word !== "string") {
      return res.status(400).json({ error: "Tham s\u1ED1 'word' l\xE0 b\u1EAFt bu\u1ED9c." });
    }
    const ai = getGeminiClient();
    if (!ai) {
      return res.json({ ipa: `/${word.toLowerCase()}/` });
    }
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Provide the standard American English IPA phonetic transcription for the word/phrase: "${word}". Output ONLY the IPA string surrounded by slashes, e.g., "/\u02C8\xE6pl/". Do not add any extra explanations or formatting.`
    });
    const ipa = response.text?.trim() || `/${word.toLowerCase()}/`;
    res.json({ ipa });
  } catch (error) {
    console.warn("AI IPA generator service unavailable, returning fallback:", error.message);
    res.json({ ipa: `/${(word || "").toLowerCase()}/`, isFallback: true });
  }
});
app2.post("/api/ai/generate", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
  const { topic, grade, wordsCount = 5 } = req.body;
  try {
    if (!topic || typeof topic !== "string") {
      return res.status(400).json({ error: "Tham s\u1ED1 'topic' l\xE0 b\u1EAFt bu\u1ED9c." });
    }
    const ai = getGeminiClient();
    if (!ai) {
      const fallbackList = getFallbackVocabulary(topic, wordsCount);
      return res.json(fallbackList);
    }
    const prompt = `Generate a JSON array of exactly ${wordsCount} English vocabulary words for topic: "${topic}" targeted for students at grade level: "${grade || "primary school"}". 
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
          type: import_genai.Type.ARRAY,
          items: {
            type: import_genai.Type.OBJECT,
            properties: {
              term: { type: import_genai.Type.STRING },
              meaning: { type: import_genai.Type.STRING },
              ipa: { type: import_genai.Type.STRING },
              pos: { type: import_genai.Type.STRING },
              example: { type: import_genai.Type.STRING },
              exampleMeaning: { type: import_genai.Type.STRING }
            },
            required: ["term", "meaning", "ipa", "pos", "example", "exampleMeaning"]
          }
        }
      }
    });
    const parsedData = JSON.parse(response.text?.trim() || "[]");
    res.json(parsedData);
  } catch (error) {
    console.warn("AI generation service unavailable, returning fallback:", error.message);
    const fallbackList = getFallbackVocabulary(topic, wordsCount);
    res.json(fallbackList);
  }
});
app2.get("/api/vocab-sets", authenticateUser, async (req, res) => {
  try {
    const { search, grade, status } = req.query;
    const snapshot = await adminDb.collection("vocab_sets").get();
    let list = [];
    snapshot.forEach((doc) => {
      list.push(doc.data());
    });
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(
        (set) => set.title.toLowerCase().includes(s) || set.description.toLowerCase().includes(s) || set.subject.toLowerCase().includes(s)
      );
    }
    if (grade) {
      list = list.filter((set) => set.gradeLevel === grade);
    }
    if (status) {
      list = list.filter((set) => set.status === status);
    }
    if (req.user && req.user.role === "student") {
      list = list.filter((set) => set.status === "public");
    }
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app2.post("/api/vocab-sets", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
    const set = req.body;
    const id = `set-${Date.now()}`;
    const newSet = {
      ...set,
      id,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      createdBy: req.user.id,
      creatorName: req.user.name
    };
    await adminDb.collection("vocab_sets").doc(id).set(newSet);
    await logAuditAction(
      req.user.id,
      req.user.name,
      req.user.email,
      "CREATE_VOCAB_SET",
      `\u0110\xE3 t\u1EA1o b\u1ED9 t\u1EEB v\u1EF1ng m\u1EDBi: "${newSet.title}" (${newSet.items.length} t\u1EEB)`
    );
    res.status(201).json(newSet);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app2.put("/api/vocab-sets/:id", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
    const id = req.params.id;
    const payload = req.body;
    const docRef = adminDb.collection("vocab_sets").doc(id);
    const existingDoc = await docRef.get();
    if (!existingDoc.exists) {
      return res.status(404).json({ error: "B\u1ED9 t\u1EEB v\u1EF1ng kh\xF4ng t\u1ED3n t\u1EA1i." });
    }
    const updatedSet = {
      ...existingDoc.data(),
      ...payload,
      id
      // preserve id
    };
    await docRef.set(updatedSet);
    await logAuditAction(
      req.user.id,
      req.user.name,
      req.user.email,
      "UPDATE_VOCAB_SET",
      `\u0110\xE3 ch\u1EC9nh s\u1EEDa b\u1ED9 t\u1EEB v\u1EF1ng: "${updatedSet.title}"`
    );
    res.json(updatedSet);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app2.delete("/api/vocab-sets/:id", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
    const id = req.params.id;
    const docRef = adminDb.collection("vocab_sets").doc(id);
    const existing = await docRef.get();
    if (!existing.exists) {
      return res.status(404).json({ error: "B\u1ED9 t\u1EEB v\u1EF1ng kh\xF4ng t\u1ED3n t\u1EA1i." });
    }
    const setDetails = existing.data();
    await docRef.delete();
    const assignSnapshot = await adminDb.collection("assignments").where("vocabSetId", "==", id).get();
    const batch = adminDb.batch();
    assignSnapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();
    await logAuditAction(
      req.user.id,
      req.user.name,
      req.user.email,
      "DELETE_VOCAB_SET",
      `\u0110\xE3 x\xF3a b\u1ED9 t\u1EEB v\u1EF1ng: "${setDetails?.title}"`
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app2.post("/api/vocab-sets/:id/clone", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
    const id = req.params.id;
    const existing = await adminDb.collection("vocab_sets").doc(id).get();
    if (!existing.exists) {
      return res.status(404).json({ error: "B\u1ED9 t\u1EEB v\u1EF1ng kh\xF4ng t\u1ED3n t\u1EA1i." });
    }
    const original = existing.data() || {};
    const cloneId = `set-${Date.now()}`;
    const clone = {
      ...original,
      id: cloneId,
      title: `${original.title} (Nh\xE2n b\u1EA3n)`,
      status: "draft",
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      createdBy: req.user.id,
      creatorName: req.user.name
    };
    await adminDb.collection("vocab_sets").doc(cloneId).set(clone);
    await logAuditAction(
      req.user.id,
      req.user.name,
      req.user.email,
      "CLONE_VOCAB_SET",
      `\u0110\xE3 nh\xE2n b\u1EA3n b\u1ED9 t\u1EEB v\u1EF1ng: "${original.title}" th\xE0nh "${clone.title}"`
    );
    res.json(clone);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app2.get("/api/classes", authenticateUser, async (req, res) => {
  try {
    const snapshot = await adminDb.collection("classes").get();
    const list = [];
    snapshot.forEach((doc) => list.push(doc.data()));
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app2.post("/api/classes", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
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
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await adminDb.collection("classes").doc(id).set(newClass);
    await logAuditAction(
      req.user.id,
      req.user.name,
      req.user.email,
      "CREATE_CLASS",
      `\u0110\xE3 t\u1EA1o l\u1EDBp h\u1ECDc m\u1EDBi: "${newClass.name}" (M\xE3 m\u1EDDi: ${newClass.code})`
    );
    res.status(201).json(newClass);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app2.delete("/api/classes/:id", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
    const id = req.params.id;
    const classRef = adminDb.collection("classes").doc(id);
    const existing = await classRef.get();
    if (!existing.exists) {
      return res.status(404).json({ error: "L\u1EDBp h\u1ECDc kh\xF4ng t\u1ED3n t\u1EA1i." });
    }
    const classDetails = existing.data();
    await classRef.delete();
    const membersSnapshot = await adminDb.collection("class_members").where("classId", "==", id).get();
    const batch = adminDb.batch();
    membersSnapshot.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    const assignmentsSnapshot = await adminDb.collection("assignments").where("classId", "==", id).get();
    const batch2 = adminDb.batch();
    assignmentsSnapshot.forEach((doc) => batch2.delete(doc.ref));
    await batch2.commit();
    await logAuditAction(
      req.user.id,
      req.user.name,
      req.user.email,
      "DELETE_CLASS",
      `\u0110\xE3 x\xF3a l\u1EDBp h\u1ECDc: "${classDetails?.name}"`
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app2.get("/api/class-members", authenticateUser, async (req, res) => {
  try {
    const snapshot = await adminDb.collection("class_members").get();
    const list = [];
    snapshot.forEach((doc) => list.push(doc.data()));
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app2.post("/api/classes/:classId/members", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app2.delete("/api/classes/:classId/members/:memberId", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
  try {
    const memberId = req.params.memberId;
    await adminDb.collection("class_members").doc(memberId).delete();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app2.get("/api/assignments", authenticateUser, async (req, res) => {
  try {
    const snapshot = await adminDb.collection("assignments").get();
    const list = [];
    snapshot.forEach((doc) => list.push(doc.data()));
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app2.post("/api/assignments", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
    const payload = req.body;
    const id = `assign-${Date.now()}`;
    const newAssign = {
      ...payload,
      id,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      createdBy: req.user.id
    };
    await adminDb.collection("assignments").doc(id).set(newAssign);
    await logAuditAction(
      req.user.id,
      req.user.name,
      req.user.email,
      "CREATE_ASSIGNMENT",
      `\u0110\xE3 giao b\xE0i t\u1EADp m\u1EDBi: "${newAssign.title}" cho l\u1EDBp: ${newAssign.className}`
    );
    res.status(201).json(newAssign);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app2.delete("/api/assignments/:id", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
    const id = req.params.id;
    const docRef = adminDb.collection("assignments").doc(id);
    const existing = await docRef.get();
    if (!existing.exists) {
      return res.status(404).json({ error: "B\xE0i t\u1EADp kh\xF4ng t\u1ED3n t\u1EA1i." });
    }
    const assignDetails = existing.data();
    await docRef.delete();
    await logAuditAction(
      req.user.id,
      req.user.name,
      req.user.email,
      "DELETE_ASSIGNMENT",
      `\u0110\xE3 x\xF3a/thu h\u1ED3i b\xE0i t\u1EADp: "${assignDetails?.title}" c\u1EE7a l\u1EDBp: ${assignDetails?.className}`
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app2.post("/api/game-sessions", authenticateUser, async (req, res) => {
  try {
    const payload = req.body;
    const id = `session-${Date.now()}`;
    const newSession = {
      ...payload,
      id,
      startedAt: (/* @__PURE__ */ new Date()).toISOString(),
      score: 0,
      totalQuestions: 0,
      correctAnswers: 0,
      incorrectAnswers: 0
    };
    await adminDb.collection("game_sessions").doc(id).set(newSession);
    res.status(201).json(newSession);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app2.put("/api/game-sessions/:id", authenticateUser, async (req, res) => {
  try {
    const id = req.params.id;
    const payload = req.body;
    const docRef = adminDb.collection("game_sessions").doc(id);
    const existing = await docRef.get();
    if (!existing.exists) {
      return res.status(404).json({ error: "Session kh\xF4ng t\u1ED3n t\u1EA1i." });
    }
    const updatedSession = {
      ...existing.data(),
      ...payload,
      completedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await docRef.set(updatedSession);
    res.json(updatedSession);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app2.get("/api/results", authenticateUser, async (req, res) => {
  try {
    const snapshot = await adminDb.collection("game_sessions").get();
    const list = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.completedAt) {
        list.push(data);
      }
    });
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app2.get("/api/admin/users", authenticateUser, requireRole(["super_admin"]), async (req, res) => {
  try {
    const snapshot = await adminDb.collection("users").get();
    const users = [];
    snapshot.forEach((doc) => users.push(doc.data()));
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app2.put("/api/admin/users/:userId/role", authenticateUser, requireRole(["super_admin"]), async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
    const targetUserId = req.params.userId;
    const { role } = req.body;
    if (!["super_admin", "teacher", "student"].includes(role)) {
      return res.status(400).json({ error: "Vai tr\xF2 kh\xF4ng h\u1EE3p l\u1EC7." });
    }
    const userRef = adminDb.collection("users").doc(targetUserId);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: "Ng\u01B0\u1EDDi d\xF9ng kh\xF4ng t\u1ED3n t\u1EA1i." });
    }
    const userData = userDoc.data();
    await userRef.update({ role });
    await adminAuth.setCustomUserClaims(targetUserId, { role });
    await logAuditAction(
      req.user.id,
      req.user.name,
      req.user.email,
      "UPDATE_USER_ROLE",
      `\u0110\xE3 thay \u0111\u1ED5i vai tr\xF2 c\u1EE7a user "${userData?.name}" (${userData?.email}) t\u1EEB ${userData?.role} th\xE0nh ${role}`
    );
    res.json({ success: true, userId: targetUserId, role });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app2.put("/api/admin/users/:userId/status", authenticateUser, requireRole(["super_admin"]), async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
    const targetUserId = req.params.userId;
    const { status } = req.body;
    if (!["active", "pending", "blocked", "deleted"].includes(status)) {
      return res.status(400).json({ error: "Tr\u1EA1ng th\xE1i kh\xF4ng h\u1EE3p l\u1EC7." });
    }
    const userRef = adminDb.collection("users").doc(targetUserId);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: "Ng\u01B0\u1EDDi d\xF9ng kh\xF4ng t\u1ED3n t\u1EA1i." });
    }
    const userData = userDoc.data();
    await userRef.update({ status });
    await logAuditAction(
      req.user.id,
      req.user.name,
      req.user.email,
      status === "blocked" ? "LOCK_USER" : "UNLOCK_USER",
      `\u0110\xE3 chuy\u1EC3n tr\u1EA1ng th\xE1i c\u1EE7a user "${userData?.name}" (${userData?.email}) th\xE0nh ${status}`
    );
    res.json({ success: true, userId: targetUserId, status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app2.get("/api/admin/audit-logs", authenticateUser, requireRole(["super_admin"]), async (req, res) => {
  try {
    const snapshot = await adminDb.collection("audit_logs").orderBy("timestamp", "desc").get();
    const logs = [];
    snapshot.forEach((doc) => logs.push(doc.data()));
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
async function start() {
  await firebaseDiagnosticReady;
  await preSeedDb();
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app2.use(vite.middlewares);
    console.log("Vite development server loaded as middleware.");
  } else {
    const distPath = import_path2.default.join(process.cwd(), "dist");
    app2.use(import_express.default.static(distPath));
    app2.get("*", (req, res) => {
      res.sendFile(import_path2.default.join(distPath, "index.html"));
    });
    console.log("Production static build routing active.");
  }
  app2.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}
start().catch((err) => {
  console.error("Failed to start fullstack server", err);
});
//# sourceMappingURL=server.cjs.map
