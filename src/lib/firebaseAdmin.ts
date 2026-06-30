import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';
import path from 'path';

// Read config file to get custom database ID and project ID
let firebaseConfig: any = {};
try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
} catch (err) {
  console.error("Error reading firebase config in firebaseAdmin:", err);
}

const projectId = firebaseConfig.projectId || process.env.FIREBASE_PROJECT_ID;
const databaseId = firebaseConfig.firestoreDatabaseId;

const app = getApps().length === 0 
  ? initializeApp({ projectId }) 
  : getApp();

const realDb = getFirestore(app, databaseId || undefined);
export const adminAuth = getAuth(app);

console.log(`Firebase Admin initialized for project: ${projectId}, Database: ${databaseId || '(default)'}`);

// ============================================================================
// SELF-HEALING LOCAL DB ENGINE (FALLBACK)
// ============================================================================
class LocalDbEngine {
  private filePath: string;
  private memoryCache: any = null;

  constructor() {
    this.filePath = path.join(process.cwd(), "db.json");
    this.load();
  }

  private mapCollectionKey(name: string): string {
    // Maps standard Firestore collections to db.json keys
    const lower = name.toLowerCase();
    if (lower === "class_members" || lower === "classmembers") return "classMembers";
    if (lower === "vocab_sets" || lower === "vocabsets") return "vocabSets";
    if (lower === "game_sessions" || lower === "gamesessions") return "gameSessions";
    if (lower === "audit_logs" || lower === "auditlogs") return "auditLogs";
    return name;
  }

  private load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        this.memoryCache = JSON.parse(raw);
      } else {
        this.memoryCache = {};
      }
    } catch (err) {
      console.error("LocalDbEngine failed to load database:", err);
      this.memoryCache = {};
    }
  }

  private save() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.memoryCache, null, 2), 'utf8');
    } catch (err) {
      console.error("LocalDbEngine failed to save database:", err);
    }
  }

  public getCollection(collectionName: string): any[] {
    this.load();
    const key = this.mapCollectionKey(collectionName);
    if (!this.memoryCache[key]) {
      this.memoryCache[key] = [];
    }
    return this.memoryCache[key];
  }

  public saveCollection(collectionName: string, items: any[]) {
    const key = this.mapCollectionKey(collectionName);
    this.memoryCache[key] = items;
    this.save();
  }

  public getDocument(collectionName: string, docId: string): any | undefined {
    const items = this.getCollection(collectionName);
    return items.find((item: any) => item.id === docId);
  }

  public setDocument(collectionName: string, docId: string, data: any) {
    const items = this.getCollection(collectionName);
    const index = items.findIndex((item: any) => item.id === docId);
    
    const docData = { ...data, id: docId };
    
    if (index >= 0) {
      items[index] = { ...items[index], ...docData };
    } else {
      items.push(docData);
    }
    this.saveCollection(collectionName, items);
  }

  public updateDocument(collectionName: string, docId: string, data: any) {
    const items = this.getCollection(collectionName);
    const index = items.findIndex((item: any) => item.id === docId);
    if (index >= 0) {
      items[index] = { ...items[index], ...data };
      this.saveCollection(collectionName, items);
    } else {
      this.setDocument(collectionName, docId, data);
    }
  }

  public deleteDocument(collectionName: string, docId: string) {
    const items = this.getCollection(collectionName);
    const filtered = items.filter((item: any) => item.id !== docId);
    this.saveCollection(collectionName, filtered);
  }
}

const localDb = new LocalDbEngine();

// Global flag to track fallback status
let useLocalFallback = false;

// We run a quick check. If it fails, we fall back to local DB immediately.
async function runDiagnostic() {
  const hasGoogleCredentials = Boolean(
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ||
    process.env.FIREBASE_SERVICE_ACCOUNT
  );

  if (!hasGoogleCredentials) {
    console.warn("Google credentials are not configured. Activating Local DB fallback engine.");
    useLocalFallback = true;
    return;
  }

  try {
    const testDoc = realDb.collection("system_status_check").doc("status");
    await testDoc.set({ active: true, checkedAt: new Date().toISOString() });
    await testDoc.get();
    await testDoc.delete();
    console.log("✅ Firestore connection diagnostics succeeded! Real Firestore DB will be used.");
    useLocalFallback = false;
  } catch (err: any) {
    console.warn("⚠️ Firestore validation failed. Activating resilient Local DB Fallback engine.", err.message);
    useLocalFallback = true;
  }
}

export const firebaseDiagnosticReady = runDiagnostic();

// ============================================================================
// TRANS-FLUID FIRESTORE COMPATIBILITY LAYER
// ============================================================================

class FallbackDocSnapshot {
  public id: string;
  public exists: boolean;
  public ref: FallbackDoc;
  private _data: any;

  constructor(id: string, exists: boolean, ref: FallbackDoc, data?: any) {
    this.id = id;
    this.exists = exists;
    this.ref = ref;
    this._data = data;
  }

  public data(): any {
    return this._data;
  }
}

class FallbackQuerySnapshot {
  public docs: FallbackDocSnapshot[];
  public empty: boolean;

  constructor(docs: FallbackDocSnapshot[]) {
    this.docs = docs;
    this.empty = docs.length === 0;
  }

  public forEach(callback: (doc: FallbackDocSnapshot) => void) {
    this.docs.forEach(callback);
  }
}

class FallbackDoc {
  public id: string;
  public ref: FallbackDoc;
  private collectionName: string;

  constructor(collectionName: string, id: string) {
    this.collectionName = collectionName;
    this.id = id;
    this.ref = this;
  }

  public async get(): Promise<FallbackDocSnapshot> {
    if (!useLocalFallback) {
      try {
        const snap = await realDb.collection(this.collectionName).doc(this.id).get();
        return new FallbackDocSnapshot(snap.id, snap.exists, this, snap.data());
      } catch (err: any) {
        console.warn(`FallbackDoc.get failed on Firestore: ${err.message}. Falling back to local.`);
        useLocalFallback = true;
      }
    }
    const data = localDb.getDocument(this.collectionName, this.id);
    return new FallbackDocSnapshot(this.id, data !== undefined, this, data);
  }

  public async set(data: any): Promise<void> {
    if (!useLocalFallback) {
      try {
        await realDb.collection(this.collectionName).doc(this.id).set(data);
        localDb.setDocument(this.collectionName, this.id, data); // Keep local DB in sync
        return;
      } catch (err: any) {
        console.warn(`FallbackDoc.set failed on Firestore: ${err.message}. Falling back to local.`);
        useLocalFallback = true;
      }
    }
    localDb.setDocument(this.collectionName, this.id, data);
  }

  public async update(data: any): Promise<void> {
    if (!useLocalFallback) {
      try {
        await realDb.collection(this.collectionName).doc(this.id).update(data);
        localDb.updateDocument(this.collectionName, this.id, data); // Keep local DB in sync
        return;
      } catch (err: any) {
        console.warn(`FallbackDoc.update failed on Firestore: ${err.message}. Falling back to local.`);
        useLocalFallback = true;
      }
    }
    localDb.updateDocument(this.collectionName, this.id, data);
  }

  public async delete(): Promise<void> {
    if (!useLocalFallback) {
      try {
        await realDb.collection(this.collectionName).doc(this.id).delete();
        localDb.deleteDocument(this.collectionName, this.id); // Keep local DB in sync
        return;
      } catch (err: any) {
        console.warn(`FallbackDoc.delete failed on Firestore: ${err.message}. Falling back to local.`);
        useLocalFallback = true;
      }
    }
    localDb.deleteDocument(this.collectionName, this.id);
  }
}

class FallbackQuery {
  protected collectionName: string;
  protected filters: Array<{ field: string; op: string; val: any }> = [];
  protected limitVal?: number;
  protected orderField?: string;
  protected orderDir?: string;

  constructor(collectionName: string) {
    this.collectionName = collectionName;
  }

  public where(field: string, op: string, val: any): FallbackQuery {
    this.filters.push({ field, op, val });
    return this;
  }

  public limit(n: number): FallbackQuery {
    this.limitVal = n;
    return this;
  }

  public orderBy(field: string, dir: string = "asc"): FallbackQuery {
    this.orderField = field;
    this.orderDir = dir;
    return this;
  }

  public async get(): Promise<FallbackQuerySnapshot> {
    if (!useLocalFallback) {
      try {
        // Construct real query
        let query: any = realDb.collection(this.collectionName);
        for (const f of this.filters) {
          query = query.where(f.field, f.op as any, f.val);
        }
        if (this.orderField) {
          query = query.orderBy(this.orderField, this.orderDir as any);
        }
        if (this.limitVal !== undefined) {
          query = query.limit(this.limitVal);
        }
        const snap = await query.get();
        const docs = snap.docs.map((doc: any) => {
          return new FallbackDocSnapshot(doc.id, doc.exists, new FallbackDoc(this.collectionName, doc.id), doc.data());
        });
        return new FallbackQuerySnapshot(docs);
      } catch (err: any) {
        console.warn(`FallbackQuery.get failed on Firestore: ${err.message}. Falling back to local.`);
        useLocalFallback = true;
      }
    }

    // Local filter and query logic
    let results = [...localDb.getCollection(this.collectionName)];

    // Apply filters
    for (const f of this.filters) {
      results = results.filter(item => {
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

    // Apply sorting
    if (this.orderField) {
      const field = this.orderField;
      const desc = this.orderDir === "desc";
      results.sort((a, b) => {
        const valA = a[field];
        const valB = b[field];
        if (valA === undefined) return 1;
        if (valB === undefined) return -1;
        if (valA < valB) return desc ? 1 : -1;
        if (valA > valB) return desc ? -1 : 1;
        return 0;
      });
    }

    // Apply limit
    if (this.limitVal !== undefined) {
      results = results.slice(0, this.limitVal);
    }

    const docs = results.map(item => {
      const id = item.id || Math.random().toString(36).substring(2);
      return new FallbackDocSnapshot(id, true, new FallbackDoc(this.collectionName, id), item);
    });

    return new FallbackQuerySnapshot(docs);
  }
}

class FallbackCollection extends FallbackQuery {
  constructor(name: string) {
    super(name);
  }

  public doc(id?: string): FallbackDoc {
    const finalId = id || Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
    return new FallbackDoc(this.collectionName, finalId);
  }

  public async add(data: any): Promise<FallbackDoc> {
    const id = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
    const doc = this.doc(id);
    await doc.set(data);
    return doc;
  }
}

class FallbackBatch {
  private ops: Array<{ type: "set" | "update" | "delete"; doc: FallbackDoc; data?: any }> = [];

  public set(doc: any, data: any): FallbackBatch {
    this.ops.push({ type: "set", doc, data });
    return this;
  }

  public update(doc: any, data: any): FallbackBatch {
    this.ops.push({ type: "update", doc, data });
    return this;
  }

  public delete(doc: any): FallbackBatch {
    this.ops.push({ type: "delete", doc });
    return this;
  }

  public async commit(): Promise<void> {
    if (!useLocalFallback) {
      try {
        const batch = realDb.batch();
        for (const op of this.ops) {
          const realDocRef = realDb.collection((op.doc as any).collectionName).doc(op.doc.id);
          if (op.type === "set") batch.set(realDocRef, op.data);
          else if (op.type === "update") batch.update(realDocRef, op.data);
          else if (op.type === "delete") batch.delete(realDocRef);
        }
        await batch.commit();
        
        // Sync to local DB
        for (const op of this.ops) {
          const doc = op.doc as any;
          if (op.type === "set") localDb.setDocument(doc.collectionName, doc.id, op.data);
          else if (op.type === "update") localDb.updateDocument(doc.collectionName, doc.id, op.data);
          else if (op.type === "delete") localDb.deleteDocument(doc.collectionName, doc.id);
        }
        return;
      } catch (err: any) {
        console.warn(`FallbackBatch.commit failed on Firestore: ${err.message}. Falling back to local.`);
        useLocalFallback = true;
      }
    }

    // Execute locally
    for (const op of this.ops) {
      const doc = op.doc as any;
      if (op.type === "set") localDb.setDocument(doc.collectionName, doc.id, op.data);
      else if (op.type === "update") localDb.updateDocument(doc.collectionName, doc.id, op.data);
      else if (op.type === "delete") localDb.deleteDocument(doc.collectionName, doc.id);
    }
  }
}

class FallbackFirestore {
  public projectId = projectId;

  public collection(name: string): FallbackCollection {
    return new FallbackCollection(name);
  }

  public batch(): FallbackBatch {
    return new FallbackBatch();
  }
}

export const adminDb = new FallbackFirestore() as any;
