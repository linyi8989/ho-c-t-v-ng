import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

type Filter = { field: string; op: string; val: any };
type BatchOp = { type: 'set' | 'update' | 'delete'; doc: SQLiteDoc; data?: any };

const DEFAULT_SQLITE_PATH = '/home/qzmivzbj/app-data/vhomework/app.sqlite';
const MIGRATION_ID = 'import-db-json-v1';

let sqliteDb: Database.Database | null = null;
let sqliteDbPath = '';
let sqliteReady = false;
let sqliteLastError: string | null = null;
let sqliteLastMigration: string | null = null;

const collectionTableMap: Record<string, string> = {
  users: 'users',
  vocab_sets: 'vocab_sets',
  vocabsets: 'vocab_sets',
  classes: 'classes',
  class_members: 'class_members',
  classmembers: 'class_members',
  assignments: 'assignments',
  results: 'results',
  game_sessions: 'game_results',
  gamesessions: 'game_results',
  game_results: 'game_results',
  gameresults: 'game_results',
  audit_logs: 'audit_logs',
  auditlogs: 'audit_logs',
  settings: 'settings',
};

function nowIso() {
  return new Date().toISOString();
}

function normalizeCollectionName(name: string) {
  return name.toLowerCase();
}

function tableForCollection(collectionName: string) {
  return collectionTableMap[normalizeCollectionName(collectionName)] || collectionName;
}

function parseJson(raw: string | null | undefined) {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function getDbPath() {
  return process.env.SQLITE_DB_PATH || DEFAULT_SQLITE_PATH;
}

function ensureParentDir(filePath: string) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

function getDb() {
  if (!sqliteDb) {
    throw new Error('SQLite database is not initialized.');
  }
  return sqliteDb;
}

function readRows(table: string): any[] {
  const db = getDb();
  if (table === 'settings') {
    return db
      .prepare('SELECT key as id, key, value_json, updated_at FROM settings')
      .all()
      .map((row: any) => ({
        id: row.id,
        key: row.key,
        value: parseJson(row.value_json),
        updatedAt: row.updated_at,
      }));
  }

  return db
    .prepare(`SELECT id, data_json FROM ${table}`)
    .all()
    .map((row: any) => ({ id: row.id, ...parseJson(row.data_json) }));
}

function readRow(table: string, id: string): any | undefined {
  const db = getDb();
  if (table === 'settings') {
    const row = db
      .prepare('SELECT key as id, key, value_json, updated_at FROM settings WHERE key = ?')
      .get(id) as any;
    if (!row) return undefined;
    return {
      id: row.id,
      key: row.key,
      value: parseJson(row.value_json),
      updatedAt: row.updated_at,
    };
  }

  const row = db.prepare(`SELECT id, data_json FROM ${table} WHERE id = ?`).get(id) as any;
  if (!row) return undefined;
  return { id: row.id, ...parseJson(row.data_json) };
}

function getFieldValue(item: any, field: string) {
  return item?.[field];
}

function applyFilters(items: any[], filters: Filter[]) {
  return items.filter((item) => {
    return filters.every((filter) => {
      const value = getFieldValue(item, filter.field);
      if (filter.op === '==') return value === filter.val;
      if (filter.op === '!=') return value !== filter.val;
      if (filter.op === '>') return value > filter.val;
      if (filter.op === '>=') return value >= filter.val;
      if (filter.op === '<') return value < filter.val;
      if (filter.op === '<=') return value <= filter.val;
      if (filter.op === 'array-contains') return Array.isArray(value) && value.includes(filter.val);
      return true;
    });
  });
}

function applyOrder(items: any[], orderField?: string, orderDir = 'asc') {
  if (!orderField) return items;
  const desc = orderDir === 'desc';
  return [...items].sort((a, b) => {
    const aVal = getFieldValue(a, orderField);
    const bVal = getFieldValue(b, orderField);
    if (aVal === undefined) return 1;
    if (bVal === undefined) return -1;
    if (aVal < bVal) return desc ? 1 : -1;
    if (aVal > bVal) return desc ? -1 : 1;
    return 0;
  });
}

function getTimestamp(data: any, camelName: string, snakeName: string) {
  return data?.[camelName] || data?.[snakeName] || nowIso();
}

function upsertDoc(collectionName: string, id: string, inputData: any) {
  const db = getDb();
  const table = tableForCollection(collectionName);
  const data = { ...inputData, id };
  const dataJson = JSON.stringify(data);
  const createdAt = getTimestamp(data, 'createdAt', 'created_at');
  const updatedAt = data.updatedAt || data.updated_at || nowIso();

  if (table === 'users') {
    db.prepare(`
      INSERT INTO users (id, firebase_uid, email, display_name, role, created_at, updated_at, data_json)
      VALUES (@id, @firebase_uid, @email, @display_name, @role, @created_at, @updated_at, @data_json)
      ON CONFLICT(id) DO UPDATE SET
        firebase_uid = excluded.firebase_uid,
        email = excluded.email,
        display_name = excluded.display_name,
        role = excluded.role,
        updated_at = excluded.updated_at,
        data_json = excluded.data_json
    `).run({
      id,
      firebase_uid: data.firebase_uid || data.firebaseUid || data.id,
      email: data.email || null,
      display_name: data.display_name || data.displayName || data.name || null,
      role: data.role || null,
      created_at: createdAt,
      updated_at: updatedAt,
      data_json: dataJson,
    });
    return;
  }

  if (table === 'vocab_sets') {
    db.prepare(`
      INSERT INTO vocab_sets (id, title, description, owner_id, created_at, updated_at, data_json)
      VALUES (@id, @title, @description, @owner_id, @created_at, @updated_at, @data_json)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        description = excluded.description,
        owner_id = excluded.owner_id,
        updated_at = excluded.updated_at,
        data_json = excluded.data_json
    `).run({
      id,
      title: data.title || null,
      description: data.description || null,
      owner_id: data.owner_id || data.ownerId || data.createdBy || null,
      created_at: createdAt,
      updated_at: updatedAt,
      data_json: dataJson,
    });

    if (Array.isArray(data.items)) {
      db.prepare('DELETE FROM vocab_items WHERE vocab_set_id = ?').run(id);
      for (const item of data.items) {
        const itemId = item.id || `${id}-item-${item.displayOrder || Math.random().toString(36).slice(2)}`;
        upsertDoc('vocab_items', itemId, { ...item, id: itemId, vocabSetId: id, vocab_set_id: id });
      }
    }
    return;
  }

  if (table === 'vocab_items') {
    db.prepare(`
      INSERT INTO vocab_items (id, vocab_set_id, term, meaning, phonetic, audio_url, image_url, created_at, updated_at, data_json)
      VALUES (@id, @vocab_set_id, @term, @meaning, @phonetic, @audio_url, @image_url, @created_at, @updated_at, @data_json)
      ON CONFLICT(id) DO UPDATE SET
        vocab_set_id = excluded.vocab_set_id,
        term = excluded.term,
        meaning = excluded.meaning,
        phonetic = excluded.phonetic,
        audio_url = excluded.audio_url,
        image_url = excluded.image_url,
        updated_at = excluded.updated_at,
        data_json = excluded.data_json
    `).run({
      id,
      vocab_set_id: data.vocab_set_id || data.vocabSetId || null,
      term: data.term || null,
      meaning: data.meaning || null,
      phonetic: data.phonetic || data.ipa || null,
      audio_url: data.audio_url || data.audioUrl || null,
      image_url: data.image_url || data.imageUrl || null,
      created_at: createdAt,
      updated_at: updatedAt,
      data_json: dataJson,
    });
    return;
  }

  if (table === 'classes') {
    db.prepare(`
      INSERT INTO classes (id, name, teacher_id, created_at, updated_at, data_json)
      VALUES (@id, @name, @teacher_id, @created_at, @updated_at, @data_json)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        teacher_id = excluded.teacher_id,
        updated_at = excluded.updated_at,
        data_json = excluded.data_json
    `).run({
      id,
      name: data.name || null,
      teacher_id: data.teacher_id || data.teacherId || null,
      created_at: createdAt,
      updated_at: updatedAt,
      data_json: dataJson,
    });
    return;
  }

  if (table === 'class_members') {
    db.prepare(`
      INSERT INTO class_members (id, class_id, user_id, role, created_at, data_json)
      VALUES (@id, @class_id, @user_id, @role, @created_at, @data_json)
      ON CONFLICT(id) DO UPDATE SET
        class_id = excluded.class_id,
        user_id = excluded.user_id,
        role = excluded.role,
        data_json = excluded.data_json
    `).run({
      id,
      class_id: data.class_id || data.classId || null,
      user_id: data.user_id || data.userId || data.studentId || null,
      role: data.role || null,
      created_at: createdAt,
      data_json: dataJson,
    });
    return;
  }

  if (table === 'assignments') {
    db.prepare(`
      INSERT INTO assignments (id, class_id, user_id, vocab_set_id, game_id, due_date, created_at, updated_at, data_json)
      VALUES (@id, @class_id, @user_id, @vocab_set_id, @game_id, @due_date, @created_at, @updated_at, @data_json)
      ON CONFLICT(id) DO UPDATE SET
        class_id = excluded.class_id,
        user_id = excluded.user_id,
        vocab_set_id = excluded.vocab_set_id,
        game_id = excluded.game_id,
        due_date = excluded.due_date,
        updated_at = excluded.updated_at,
        data_json = excluded.data_json
    `).run({
      id,
      class_id: data.class_id || data.classId || null,
      user_id: data.user_id || data.userId || data.createdBy || null,
      vocab_set_id: data.vocab_set_id || data.vocabSetId || null,
      game_id: data.game_id || data.gameId || null,
      due_date: data.due_date || data.dueDate || null,
      created_at: createdAt,
      updated_at: updatedAt,
      data_json: dataJson,
    });
    return;
  }

  if (table === 'results' || table === 'game_results') {
    db.prepare(`
      INSERT INTO ${table} (id, assignment_id, user_id, game_id, vocab_set_id, score, correct, incorrect, created_at, data_json)
      VALUES (@id, @assignment_id, @user_id, @game_id, @vocab_set_id, @score, @correct, @incorrect, @created_at, @data_json)
      ON CONFLICT(id) DO UPDATE SET
        assignment_id = excluded.assignment_id,
        user_id = excluded.user_id,
        game_id = excluded.game_id,
        vocab_set_id = excluded.vocab_set_id,
        score = excluded.score,
        correct = excluded.correct,
        incorrect = excluded.incorrect,
        data_json = excluded.data_json
    `).run({
      id,
      assignment_id: data.assignment_id || data.assignmentId || null,
      user_id: data.user_id || data.userId || data.studentId || null,
      game_id: data.game_id || data.gameId || null,
      vocab_set_id: data.vocab_set_id || data.vocabSetId || null,
      score: Number(data.score || 0),
      correct: Number(data.correct || data.correctAnswers || 0),
      incorrect: Number(data.incorrect || data.incorrectAnswers || 0),
      created_at: data.completedAt || data.startedAt || createdAt,
      data_json: dataJson,
    });
    return;
  }

  if (table === 'audit_logs') {
    db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, timestamp, data_json)
      VALUES (@id, @user_id, @action, @timestamp, @data_json)
      ON CONFLICT(id) DO UPDATE SET
        user_id = excluded.user_id,
        action = excluded.action,
        timestamp = excluded.timestamp,
        data_json = excluded.data_json
    `).run({
      id,
      user_id: data.user_id || data.userId || null,
      action: data.action || null,
      timestamp: data.timestamp || createdAt,
      data_json: dataJson,
    });
    return;
  }

  if (table === 'settings') {
    db.prepare(`
      INSERT INTO settings (key, value_json, updated_at)
      VALUES (@key, @value_json, @updated_at)
      ON CONFLICT(key) DO UPDATE SET
        value_json = excluded.value_json,
        updated_at = excluded.updated_at
    `).run({
      key: id,
      value_json: JSON.stringify(data.value ?? data),
      updated_at: updatedAt,
    });
  }
}

function updateDoc(collectionName: string, id: string, patch: any) {
  const existing = readRow(tableForCollection(collectionName), id) || { id };
  upsertDoc(collectionName, id, { ...existing, ...patch, id });
}

function deleteDoc(collectionName: string, id: string) {
  const db = getDb();
  const table = tableForCollection(collectionName);
  if (table === 'settings') {
    db.prepare('DELETE FROM settings WHERE key = ?').run(id);
    return;
  }
  db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(id);
  if (table === 'vocab_sets') {
    db.prepare('DELETE FROM vocab_items WHERE vocab_set_id = ?').run(id);
  }
}

function runSchemaMigration(db: Database.Database) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      firebase_uid TEXT,
      email TEXT,
      display_name TEXT,
      role TEXT,
      created_at TEXT,
      updated_at TEXT,
      data_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS vocab_sets (
      id TEXT PRIMARY KEY,
      title TEXT,
      description TEXT,
      owner_id TEXT,
      created_at TEXT,
      updated_at TEXT,
      data_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS vocab_items (
      id TEXT PRIMARY KEY,
      vocab_set_id TEXT,
      term TEXT,
      meaning TEXT,
      phonetic TEXT,
      audio_url TEXT,
      image_url TEXT,
      created_at TEXT,
      updated_at TEXT,
      data_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS classes (
      id TEXT PRIMARY KEY,
      name TEXT,
      teacher_id TEXT,
      created_at TEXT,
      updated_at TEXT,
      data_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS class_members (
      id TEXT PRIMARY KEY,
      class_id TEXT,
      user_id TEXT,
      role TEXT,
      created_at TEXT,
      data_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS assignments (
      id TEXT PRIMARY KEY,
      class_id TEXT,
      user_id TEXT,
      vocab_set_id TEXT,
      game_id TEXT,
      due_date TEXT,
      created_at TEXT,
      updated_at TEXT,
      data_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS results (
      id TEXT PRIMARY KEY,
      assignment_id TEXT,
      user_id TEXT,
      game_id TEXT,
      vocab_set_id TEXT,
      score INTEGER,
      correct INTEGER,
      incorrect INTEGER,
      created_at TEXT,
      data_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS game_results (
      id TEXT PRIMARY KEY,
      assignment_id TEXT,
      user_id TEXT,
      game_id TEXT,
      vocab_set_id TEXT,
      score INTEGER,
      correct INTEGER,
      incorrect INTEGER,
      created_at TEXT,
      data_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      action TEXT,
      timestamp TEXT,
      data_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL,
      updated_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid);
    CREATE INDEX IF NOT EXISTS idx_vocab_items_vocab_set_id ON vocab_items(vocab_set_id);
    CREATE INDEX IF NOT EXISTS idx_class_members_class_id ON class_members(class_id);
    CREATE INDEX IF NOT EXISTS idx_class_members_user_id ON class_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_assignments_class_id ON assignments(class_id);
    CREATE INDEX IF NOT EXISTS idx_assignments_user_id ON assignments(user_id);
    CREATE INDEX IF NOT EXISTS idx_results_user_id ON results(user_id);
    CREATE INDEX IF NOT EXISTS idx_results_assignment_id ON results(assignment_id);
    CREATE INDEX IF NOT EXISTS idx_game_results_user_id ON game_results(user_id);
    CREATE INDEX IF NOT EXISTS idx_game_results_game_id ON game_results(game_id);
  `);
}

function hasMigration(db: Database.Database, id: string) {
  return Boolean(db.prepare('SELECT id FROM migrations WHERE id = ?').get(id));
}

function markMigration(db: Database.Database, id: string) {
  db.prepare('INSERT OR REPLACE INTO migrations (id, applied_at) VALUES (?, ?)').run(id, nowIso());
  sqliteLastMigration = id;
}

function getJsonImportCandidates() {
  return [
    process.env.LOCAL_DB_PATH,
    path.join(process.cwd(), 'db.json'),
    '/home/qzmivzbj/app.msdieu.com/db.json',
  ].filter(Boolean) as string[];
}

function backupJsonFile(sourcePath: string) {
  try {
    const backupDir = path.dirname(sqliteDbPath);
    const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 16);
    const backupPath = path.join(backupDir, `db-backup-${stamp}.json`);
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(sourcePath, backupPath);
    }
  } catch (err: any) {
    sqliteLastError = `Failed to backup db.json: ${err.message}`;
  }
}

function importCollection(db: Database.Database, collectionName: string, items: any[] | undefined) {
  if (!Array.isArray(items)) return 0;
  const tx = db.transaction(() => {
    for (const item of items) {
      const id = item.id || `${collectionName}-${Math.random().toString(36).slice(2)}`;
      upsertDoc(collectionName, id, { ...item, id });
    }
  });
  tx();
  return items.length;
}

function migrateFromJsonIfNeeded(db: Database.Database) {
  if (hasMigration(db, MIGRATION_ID)) {
    sqliteLastMigration = MIGRATION_ID;
    return;
  }

  const sourcePath = getJsonImportCandidates().find((candidate) => fs.existsSync(candidate));
  if (!sourcePath) {
    markMigration(db, MIGRATION_ID);
    return;
  }

  backupJsonFile(sourcePath);
  const raw = fs.readFileSync(sourcePath, 'utf8');
  const legacy = JSON.parse(raw);
  const imported = {
    users: importCollection(db, 'users', legacy.users),
    vocabSets: importCollection(db, 'vocab_sets', legacy.vocabSets || legacy.vocab_sets),
    classes: importCollection(db, 'classes', legacy.classes),
    classMembers: importCollection(db, 'class_members', legacy.classMembers || legacy.class_members),
    assignments: importCollection(db, 'assignments', legacy.assignments),
    results: importCollection(db, 'results', legacy.results),
    gameResults: importCollection(db, 'game_results', legacy.gameResults || legacy.game_sessions || legacy.gameSessions),
  };

  const knownKeys = new Set([
    'users',
    'vocabSets',
    'vocab_sets',
    'classes',
    'classMembers',
    'class_members',
    'assignments',
    'results',
    'gameResults',
    'game_sessions',
    'gameSessions',
  ]);
  for (const [key, value] of Object.entries(legacy)) {
    if (!knownKeys.has(key)) {
      upsertDoc('settings', `legacy.${key}`, { value });
    }
  }

  console.log('[Storage] JSON migration imported:', imported);
  markMigration(db, MIGRATION_ID);
}

export function initializeSQLiteStorage() {
  try {
    sqliteDbPath = getDbPath();
    ensureParentDir(sqliteDbPath);
    sqliteDb = new Database(sqliteDbPath);
    runSchemaMigration(sqliteDb);
    migrateFromJsonIfNeeded(sqliteDb);
    sqliteReady = true;
    sqliteLastError = null;
    console.log('[Storage] Mode: sqlite');
    console.log(`[Storage] SQLite path: ${sqliteDbPath}`);
    console.log('[Storage] SQLite ready: true');
  } catch (err: any) {
    sqliteReady = false;
    sqliteLastError = err.message;
    console.error('[Storage] SQLite ready: false', err);
    throw err;
  }
}

export class SQLiteDocSnapshot {
  public id: string;
  public exists: boolean;
  public ref: SQLiteDoc;
  private value: any;

  constructor(id: string, exists: boolean, ref: SQLiteDoc, value?: any) {
    this.id = id;
    this.exists = exists;
    this.ref = ref;
    this.value = value;
  }

  public data() {
    return this.value;
  }
}

export class SQLiteQuerySnapshot {
  public docs: SQLiteDocSnapshot[];
  public empty: boolean;
  public size: number;

  constructor(docs: SQLiteDocSnapshot[]) {
    this.docs = docs;
    this.empty = docs.length === 0;
    this.size = docs.length;
  }

  public forEach(callback: (doc: SQLiteDocSnapshot) => void) {
    this.docs.forEach(callback);
  }
}

export class SQLiteDoc {
  public id: string;
  public ref: SQLiteDoc;
  public collectionName: string;

  constructor(collectionName: string, id: string) {
    this.collectionName = collectionName;
    this.id = id;
    this.ref = this;
  }

  public async get() {
    const data = readRow(tableForCollection(this.collectionName), this.id);
    return new SQLiteDocSnapshot(this.id, data !== undefined, this, data);
  }

  public async set(data: any) {
    upsertDoc(this.collectionName, this.id, data);
  }

  public async update(data: any) {
    updateDoc(this.collectionName, this.id, data);
  }

  public async delete() {
    deleteDoc(this.collectionName, this.id);
  }
}

export class SQLiteQuery {
  protected collectionName: string;
  protected filters: Filter[] = [];
  protected limitVal?: number;
  protected orderField?: string;
  protected orderDir?: string;

  constructor(collectionName: string) {
    this.collectionName = collectionName;
  }

  public where(field: string, op: string, val: any) {
    this.filters.push({ field, op, val });
    return this;
  }

  public limit(n: number) {
    this.limitVal = n;
    return this;
  }

  public orderBy(field: string, dir = 'asc') {
    this.orderField = field;
    this.orderDir = dir;
    return this;
  }

  public async get() {
    const table = tableForCollection(this.collectionName);
    let items = readRows(table);
    items = applyFilters(items, this.filters);
    items = applyOrder(items, this.orderField, this.orderDir);
    if (this.limitVal !== undefined) {
      items = items.slice(0, this.limitVal);
    }
    const docs = items.map((item) => {
      const id = item.id || Math.random().toString(36).slice(2);
      return new SQLiteDocSnapshot(id, true, new SQLiteDoc(this.collectionName, id), item);
    });
    return new SQLiteQuerySnapshot(docs);
  }
}

export class SQLiteCollection extends SQLiteQuery {
  constructor(collectionName: string) {
    super(collectionName);
  }

  public doc(id?: string) {
    return new SQLiteDoc(
      this.collectionName,
      id || `${this.collectionName}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    );
  }

  public async add(data: any) {
    const doc = this.doc();
    await doc.set({ ...data, id: doc.id });
    return doc;
  }
}

export class SQLiteBatch {
  private ops: BatchOp[] = [];

  public set(doc: SQLiteDoc, data: any) {
    this.ops.push({ type: 'set', doc, data });
    return this;
  }

  public update(doc: SQLiteDoc, data: any) {
    this.ops.push({ type: 'update', doc, data });
    return this;
  }

  public delete(doc: SQLiteDoc) {
    this.ops.push({ type: 'delete', doc });
    return this;
  }

  public async commit() {
    const db = getDb();
    const tx = db.transaction(() => {
      for (const op of this.ops) {
        if (op.type === 'set') upsertDoc(op.doc.collectionName, op.doc.id, op.data);
        if (op.type === 'update') updateDoc(op.doc.collectionName, op.doc.id, op.data);
        if (op.type === 'delete') deleteDoc(op.doc.collectionName, op.doc.id);
      }
    });
    tx();
  }
}

export class SQLiteFirestore {
  public projectId = process.env.FIREBASE_PROJECT_ID || 'sqlite-local';

  public collection(name: string) {
    return new SQLiteCollection(name);
  }

  public batch() {
    return new SQLiteBatch();
  }
}

function tableCount(table: string) {
  try {
    const row = getDb().prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as any;
    return Number(row?.count || 0);
  } catch {
    return 0;
  }
}

export function getSQLiteDiagnostics() {
  const lastMigration = sqliteDb
    ? ((sqliteDb.prepare('SELECT id, applied_at FROM migrations ORDER BY applied_at DESC LIMIT 1').get() as any) || null)
    : null;

  return {
    storageMode: process.env.STORAGE_MODE || 'firebase-first',
    sqliteEnabled: process.env.STORAGE_MODE === 'sqlite',
    sqliteDbPath,
    sqliteFileExists: Boolean(sqliteDbPath && fs.existsSync(sqliteDbPath)),
    sqliteReady,
    tableCounts: {
      users: tableCount('users'),
      vocab_sets: tableCount('vocab_sets'),
      vocab_items: tableCount('vocab_items'),
      classes: tableCount('classes'),
      assignments: tableCount('assignments'),
      results: tableCount('results'),
      game_results: tableCount('game_results'),
    },
    lastMigration: lastMigration || sqliteLastMigration,
    lastError: sqliteLastError,
  };
}
