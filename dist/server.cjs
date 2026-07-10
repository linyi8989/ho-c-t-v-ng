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
var import_path3 = __toESM(require("path"), 1);
var import_crypto = __toESM(require("crypto"), 1);
var import_fs3 = __toESM(require("fs"), 1);
var import_vite = require("vite");
var import_genai = require("@google/genai");
var import_dotenv = __toESM(require("dotenv"), 1);

// src/lib/firebaseAdmin.ts
var import_config = require("dotenv/config");
var import_app = require("firebase-admin/app");
var import_firestore = require("firebase-admin/firestore");
var import_auth = require("firebase-admin/auth");
var import_fs2 = __toESM(require("fs"), 1);
var import_path2 = __toESM(require("path"), 1);

// src/lib/sqliteStorage.ts
var import_fs = __toESM(require("fs"), 1);
var import_path = __toESM(require("path"), 1);
var import_module = require("module");
var require2 = (0, import_module.createRequire)(import_path.default.join(process.cwd(), "package.json"));
var initSqlJs = require2("sql.js");
var DEFAULT_SQLITE_PATH = "/home/qzmivzbj/app-data/vhomework/app.sqlite";
var MIGRATION_ID = "import-db-json-v1";
var sqliteDb = null;
var sqliteDbPath = "";
var sqliteReady = false;
var sqliteLastError = null;
var sqliteLastMigration = null;
var initPromise = null;
var transactionDepth = 0;
var collectionTableMap = {
  users: "users",
  vocab_sets: "vocab_sets",
  vocabsets: "vocab_sets",
  classes: "classes",
  class_members: "class_members",
  classmembers: "class_members",
  assignments: "assignments",
  results: "results",
  game_sessions: "game_results",
  gamesessions: "game_results",
  game_results: "game_results",
  gameresults: "game_results",
  pronunciation_attempts: "game_results",
  pronunciationattempts: "game_results",
  grammar_sets: "grammar_sets",
  grammarsets: "grammar_sets",
  grammar_questions: "grammar_questions",
  grammarquestions: "grammar_questions",
  grammar_options: "grammar_options",
  grammaroptions: "grammar_options",
  grammar_assignments: "grammar_assignments",
  grammarassignments: "grammar_assignments",
  grammar_attempts: "grammar_attempts",
  grammarattempts: "grammar_attempts",
  grammar_attempt_questions: "grammar_attempt_questions",
  grammarattemptquestions: "grammar_attempt_questions",
  grammar_attempt_answers: "grammar_attempt_answers",
  grammarattemptanswers: "grammar_attempt_answers",
  audit_logs: "audit_logs",
  auditlogs: "audit_logs",
  settings: "settings"
};
function nowIso() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function tableForCollection(collectionName) {
  return collectionTableMap[collectionName.toLowerCase()] || collectionName;
}
function parseJson(raw) {
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
function ensureParentDir(filePath) {
  import_fs.default.mkdirSync(import_path.default.dirname(filePath), { recursive: true });
}
function getDb() {
  if (!sqliteDb) {
    throw new Error("SQLite database is not initialized.");
  }
  return sqliteDb;
}
function persistDb() {
  if (!sqliteDb || !sqliteDbPath || transactionDepth > 0) return;
  const exported = sqliteDb.export();
  import_fs.default.writeFileSync(sqliteDbPath, Buffer.from(exported));
}
function run(sql, params = [], shouldPersist = true) {
  getDb().run(sql, params);
  if (shouldPersist) persistDb();
}
function all(sql, params = []) {
  const stmt = getDb().prepare(sql);
  const rows = [];
  try {
    stmt.bind(params);
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    return rows;
  } finally {
    stmt.free();
  }
}
function one(sql, params = []) {
  return all(sql, params)[0];
}
function withTransaction(action) {
  if (transactionDepth > 0) {
    action();
    return;
  }
  transactionDepth++;
  try {
    getDb().run("BEGIN TRANSACTION");
    action();
    getDb().run("COMMIT");
    transactionDepth--;
    persistDb();
  } catch (err) {
    try {
      getDb().run("ROLLBACK");
    } catch {
    }
    transactionDepth--;
    throw err;
  }
}
function readRows(table) {
  if (table === "settings") {
    return all("SELECT key as id, key, value_json, updated_at FROM settings").map((row) => ({
      id: row.id,
      key: row.key,
      value: parseJson(row.value_json),
      updatedAt: row.updated_at
    }));
  }
  return all(`SELECT id, data_json FROM ${table}`).map((row) => ({
    id: row.id,
    ...parseJson(row.data_json)
  }));
}
function readRow(table, id) {
  if (table === "settings") {
    const row2 = one("SELECT key as id, key, value_json, updated_at FROM settings WHERE key = ?", [id]);
    if (!row2) return void 0;
    return {
      id: row2.id,
      key: row2.key,
      value: parseJson(row2.value_json),
      updatedAt: row2.updated_at
    };
  }
  const row = one(`SELECT id, data_json FROM ${table} WHERE id = ?`, [id]);
  if (!row) return void 0;
  return { id: row.id, ...parseJson(row.data_json) };
}
function applyFilters(items, filters) {
  return items.filter((item) => {
    return filters.every((filter) => {
      const value = item?.[filter.field];
      if (filter.op === "==") return value === filter.val;
      if (filter.op === "!=") return value !== filter.val;
      if (filter.op === ">") return value > filter.val;
      if (filter.op === ">=") return value >= filter.val;
      if (filter.op === "<") return value < filter.val;
      if (filter.op === "<=") return value <= filter.val;
      if (filter.op === "array-contains") return Array.isArray(value) && value.includes(filter.val);
      return true;
    });
  });
}
function applyOrder(items, orderField, orderDir = "asc") {
  if (!orderField) return items;
  const desc = orderDir === "desc";
  return [...items].sort((a, b) => {
    const aVal = a?.[orderField];
    const bVal = b?.[orderField];
    if (aVal === void 0) return 1;
    if (bVal === void 0) return -1;
    if (aVal < bVal) return desc ? 1 : -1;
    if (aVal > bVal) return desc ? -1 : 1;
    return 0;
  });
}
function getTimestamp(data, camelName, snakeName) {
  return data?.[camelName] || data?.[snakeName] || nowIso();
}
function upsertDoc(collectionName, id, inputData) {
  const table = tableForCollection(collectionName);
  const data = { ...inputData, id };
  const dataJson = JSON.stringify(data);
  const createdAt = getTimestamp(data, "createdAt", "created_at");
  const updatedAt = data.updatedAt || data.updated_at || nowIso();
  if (table === "users") {
    run(
      `INSERT INTO users (id, firebase_uid, email, display_name, role, created_at, updated_at, data_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
        firebase_uid = excluded.firebase_uid,
        email = excluded.email,
        display_name = excluded.display_name,
        role = excluded.role,
        updated_at = excluded.updated_at,
        data_json = excluded.data_json`,
      [
        id,
        data.firebase_uid || data.firebaseUid || data.id,
        data.email || null,
        data.display_name || data.displayName || data.name || null,
        data.role || null,
        createdAt,
        updatedAt,
        dataJson
      ]
    );
    return;
  }
  if (table === "vocab_sets") {
    withTransaction(() => {
      run(
        `INSERT INTO vocab_sets (id, title, description, owner_id, created_at, updated_at, data_json)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          description = excluded.description,
          owner_id = excluded.owner_id,
          updated_at = excluded.updated_at,
          data_json = excluded.data_json`,
        [
          id,
          data.title || null,
          data.description || null,
          data.owner_id || data.ownerId || data.createdBy || null,
          createdAt,
          updatedAt,
          dataJson
        ]
      );
      if (Array.isArray(data.items)) {
        run("DELETE FROM vocab_items WHERE vocab_set_id = ?", [id]);
        for (const item of data.items) {
          const itemId = item.id || `${id}-item-${item.displayOrder || Math.random().toString(36).slice(2)}`;
          upsertDoc("vocab_items", itemId, { ...item, id: itemId, vocabSetId: id, vocab_set_id: id });
        }
      }
    });
    return;
  }
  if (table === "vocab_items") {
    run(
      `INSERT INTO vocab_items (id, vocab_set_id, term, meaning, phonetic, audio_url, image_url, created_at, updated_at, data_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
        vocab_set_id = excluded.vocab_set_id,
        term = excluded.term,
        meaning = excluded.meaning,
        phonetic = excluded.phonetic,
        audio_url = excluded.audio_url,
        image_url = excluded.image_url,
        updated_at = excluded.updated_at,
        data_json = excluded.data_json`,
      [
        id,
        data.vocab_set_id || data.vocabSetId || null,
        data.term || null,
        data.meaning || null,
        data.phonetic || data.ipa || null,
        data.audio_url || data.audioUrl || null,
        data.image_url || data.imageUrl || null,
        createdAt,
        updatedAt,
        dataJson
      ]
    );
    return;
  }
  if (table === "classes") {
    run(
      `INSERT INTO classes (id, name, teacher_id, created_at, updated_at, data_json)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        teacher_id = excluded.teacher_id,
        updated_at = excluded.updated_at,
        data_json = excluded.data_json`,
      [id, data.name || null, data.teacher_id || data.teacherId || null, createdAt, updatedAt, dataJson]
    );
    return;
  }
  if (table === "class_members") {
    run(
      `INSERT INTO class_members (id, class_id, user_id, role, created_at, data_json)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
        class_id = excluded.class_id,
        user_id = excluded.user_id,
        role = excluded.role,
        data_json = excluded.data_json`,
      [
        id,
        data.class_id || data.classId || null,
        data.user_id || data.userId || data.studentId || null,
        data.role || null,
        createdAt,
        dataJson
      ]
    );
    return;
  }
  if (table === "assignments") {
    run(
      `INSERT INTO assignments (id, class_id, user_id, vocab_set_id, game_id, due_date, created_at, updated_at, data_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
        class_id = excluded.class_id,
        user_id = excluded.user_id,
        vocab_set_id = excluded.vocab_set_id,
        game_id = excluded.game_id,
        due_date = excluded.due_date,
        updated_at = excluded.updated_at,
        data_json = excluded.data_json`,
      [
        id,
        data.class_id || data.classId || null,
        data.user_id || data.userId || data.createdBy || null,
        data.vocab_set_id || data.vocabSetId || null,
        data.game_id || data.gameId || null,
        data.due_date || data.dueDate || null,
        createdAt,
        updatedAt,
        dataJson
      ]
    );
    return;
  }
  if (table === "results" || table === "game_results") {
    run(
      `INSERT INTO ${table} (id, assignment_id, user_id, game_id, vocab_set_id, score, correct, incorrect, created_at, expires_at, data_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
        assignment_id = excluded.assignment_id,
        user_id = excluded.user_id,
        game_id = excluded.game_id,
        vocab_set_id = excluded.vocab_set_id,
        score = excluded.score,
        correct = excluded.correct,
        incorrect = excluded.incorrect,
        expires_at = excluded.expires_at,
        data_json = excluded.data_json`,
      [
        id,
        data.assignment_id || data.assignmentId || null,
        data.user_id || data.userId || data.studentId || null,
        data.game_id || data.gameId || null,
        data.vocab_set_id || data.vocabSetId || null,
        Number(data.score || 0),
        Number(data.correct || data.correctAnswers || 0),
        Number(data.incorrect || data.incorrectAnswers || 0),
        data.completedAt || data.startedAt || createdAt,
        data.expiresAt || data.expires_at || null,
        dataJson
      ]
    );
    return;
  }
  if (table === "audit_logs") {
    run(
      `INSERT INTO audit_logs (id, user_id, action, timestamp, data_json)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
        user_id = excluded.user_id,
        action = excluded.action,
        timestamp = excluded.timestamp,
        data_json = excluded.data_json`,
      [id, data.user_id || data.userId || null, data.action || null, data.timestamp || createdAt, dataJson]
    );
    return;
  }
  if (table.startsWith("grammar_")) {
    run(
      `INSERT INTO ${table} (id, created_at, updated_at, data_json)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
        updated_at = excluded.updated_at,
        data_json = excluded.data_json`,
      [id, createdAt, updatedAt, dataJson]
    );
    return;
  }
  if (table === "settings") {
    run(
      `INSERT INTO settings (key, value_json, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
        value_json = excluded.value_json,
        updated_at = excluded.updated_at`,
      [id, JSON.stringify(data.value ?? data), updatedAt]
    );
  }
}
function updateDoc(collectionName, id, patch) {
  const existing = readRow(tableForCollection(collectionName), id) || { id };
  upsertDoc(collectionName, id, { ...existing, ...patch, id });
}
function deleteDoc(collectionName, id) {
  const table = tableForCollection(collectionName);
  if (table === "settings") {
    run("DELETE FROM settings WHERE key = ?", [id]);
    return;
  }
  withTransaction(() => {
    run(`DELETE FROM ${table} WHERE id = ?`, [id]);
    if (table === "vocab_sets") {
      run("DELETE FROM vocab_items WHERE vocab_set_id = ?", [id]);
    }
  });
}
function runSchemaMigration() {
  getDb().run(`
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
      expires_at TEXT,
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
      expires_at TEXT,
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

    CREATE TABLE IF NOT EXISTS grammar_sets (
      id TEXT PRIMARY KEY,
      created_at TEXT,
      updated_at TEXT,
      data_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS grammar_questions (
      id TEXT PRIMARY KEY,
      created_at TEXT,
      updated_at TEXT,
      data_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS grammar_options (
      id TEXT PRIMARY KEY,
      created_at TEXT,
      updated_at TEXT,
      data_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS grammar_assignments (
      id TEXT PRIMARY KEY,
      created_at TEXT,
      updated_at TEXT,
      data_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS grammar_attempts (
      id TEXT PRIMARY KEY,
      created_at TEXT,
      updated_at TEXT,
      data_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS grammar_attempt_questions (
      id TEXT PRIMARY KEY,
      created_at TEXT,
      updated_at TEXT,
      data_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS grammar_attempt_answers (
      id TEXT PRIMARY KEY,
      created_at TEXT,
      updated_at TEXT,
      data_json TEXT NOT NULL
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
    CREATE INDEX IF NOT EXISTS idx_results_created_at ON results(created_at);
    CREATE INDEX IF NOT EXISTS idx_game_results_user_id ON game_results(user_id);
    CREATE INDEX IF NOT EXISTS idx_game_results_game_id ON game_results(game_id);
    CREATE INDEX IF NOT EXISTS idx_game_results_created_at ON game_results(created_at);
    CREATE INDEX IF NOT EXISTS idx_grammar_sets_created_at ON grammar_sets(created_at);
    CREATE INDEX IF NOT EXISTS idx_grammar_attempts_created_at ON grammar_attempts(created_at);
  `);
  persistDb();
}
function hasMigration(id) {
  return Boolean(one("SELECT id FROM migrations WHERE id = ?", [id]));
}
function markMigration(id) {
  run("INSERT OR REPLACE INTO migrations (id, applied_at) VALUES (?, ?)", [id, nowIso()]);
  sqliteLastMigration = id;
}
function tableHasColumn(table, column) {
  return all(`PRAGMA table_info(${table})`).some((row) => row.name === column);
}
function migrateActivityExpiryColumns() {
  for (const table of ["results", "game_results"]) {
    if (!tableHasColumn(table, "expires_at")) {
      run(`ALTER TABLE ${table} ADD COLUMN expires_at TEXT`);
    }
  }
  run(`
    CREATE INDEX IF NOT EXISTS idx_results_created_at ON results(created_at);
    CREATE INDEX IF NOT EXISTS idx_results_expires_at ON results(expires_at);
    CREATE INDEX IF NOT EXISTS idx_game_results_created_at ON game_results(created_at);
    CREATE INDEX IF NOT EXISTS idx_game_results_expires_at ON game_results(expires_at);
  `);
}
function getJsonImportCandidates() {
  return [
    process.env.LOCAL_DB_PATH,
    import_path.default.join(process.cwd(), "db.json"),
    "/home/qzmivzbj/app.msdieu.com/db.json"
  ].filter(Boolean);
}
function backupJsonFile(sourcePath) {
  try {
    const backupDir = import_path.default.dirname(sqliteDbPath);
    const stamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:T]/g, "-").slice(0, 16);
    const backupPath = import_path.default.join(backupDir, `db-backup-${stamp}.json`);
    if (!import_fs.default.existsSync(backupPath)) {
      import_fs.default.copyFileSync(sourcePath, backupPath);
    }
  } catch (err) {
    sqliteLastError = `Failed to backup db.json: ${err.message}`;
  }
}
function importCollection(collectionName, items) {
  if (!Array.isArray(items)) return 0;
  withTransaction(() => {
    for (const item of items) {
      const id = item.id || `${collectionName}-${Math.random().toString(36).slice(2)}`;
      upsertDoc(collectionName, id, { ...item, id });
    }
  });
  return items.length;
}
function migrateFromJsonIfNeeded() {
  if (hasMigration(MIGRATION_ID)) {
    sqliteLastMigration = MIGRATION_ID;
    return;
  }
  const sourcePath = getJsonImportCandidates().find((candidate) => import_fs.default.existsSync(candidate));
  if (!sourcePath) {
    markMigration(MIGRATION_ID);
    return;
  }
  backupJsonFile(sourcePath);
  const raw = import_fs.default.readFileSync(sourcePath, "utf8");
  const legacy = JSON.parse(raw);
  const imported = {
    users: importCollection("users", legacy.users),
    vocabSets: importCollection("vocab_sets", legacy.vocabSets || legacy.vocab_sets),
    classes: importCollection("classes", legacy.classes),
    classMembers: importCollection("class_members", legacy.classMembers || legacy.class_members),
    assignments: importCollection("assignments", legacy.assignments),
    results: importCollection("results", legacy.results),
    gameResults: importCollection("game_results", legacy.gameResults || legacy.game_sessions || legacy.gameSessions)
  };
  const knownKeys = /* @__PURE__ */ new Set([
    "users",
    "vocabSets",
    "vocab_sets",
    "classes",
    "classMembers",
    "class_members",
    "assignments",
    "results",
    "gameResults",
    "game_sessions",
    "gameSessions"
  ]);
  for (const [key, value] of Object.entries(legacy)) {
    if (!knownKeys.has(key)) {
      upsertDoc("settings", `legacy.${key}`, { value });
    }
  }
  console.log("[Storage] JSON migration imported:", imported);
  markMigration(MIGRATION_ID);
}
async function initializeSQLiteStorage() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      sqliteDbPath = getDbPath();
      ensureParentDir(sqliteDbPath);
      const wasmPath = require2.resolve("sql.js/dist/sql-wasm.wasm");
      const SQL = await initSqlJs({
        locateFile: () => wasmPath
      });
      const existing = import_fs.default.existsSync(sqliteDbPath) ? import_fs.default.readFileSync(sqliteDbPath) : void 0;
      sqliteDb = existing ? new SQL.Database(existing) : new SQL.Database();
      runSchemaMigration();
      migrateActivityExpiryColumns();
      migrateFromJsonIfNeeded();
      sqliteReady = true;
      sqliteLastError = null;
      console.log("[Storage] Mode: sqlite");
      console.log(`[Storage] SQLite path: ${sqliteDbPath}`);
      console.log("[Storage] SQLite ready: true");
    } catch (err) {
      sqliteReady = false;
      sqliteLastError = err.message;
      console.error("[Storage] SQLite ready: false", err);
      throw err;
    }
  })();
  return initPromise;
}
var SQLiteDocSnapshot = class {
  constructor(id, exists, ref, value) {
    this.id = id;
    this.exists = exists;
    this.ref = ref;
    this.value = value;
  }
  data() {
    return this.value;
  }
};
var SQLiteQuerySnapshot = class {
  constructor(docs) {
    this.docs = docs;
    this.empty = docs.length === 0;
    this.size = docs.length;
  }
  forEach(callback) {
    this.docs.forEach(callback);
  }
};
var SQLiteDoc = class {
  constructor(collectionName, id) {
    this.collectionName = collectionName;
    this.id = id;
    this.ref = this;
  }
  async get() {
    await initializeSQLiteStorage();
    const data = readRow(tableForCollection(this.collectionName), this.id);
    return new SQLiteDocSnapshot(this.id, data !== void 0, this, data);
  }
  async set(data) {
    await initializeSQLiteStorage();
    upsertDoc(this.collectionName, this.id, data);
  }
  async update(data) {
    await initializeSQLiteStorage();
    updateDoc(this.collectionName, this.id, data);
  }
  async delete() {
    await initializeSQLiteStorage();
    deleteDoc(this.collectionName, this.id);
  }
};
var SQLiteQuery = class {
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
    await initializeSQLiteStorage();
    const table = tableForCollection(this.collectionName);
    let items = readRows(table);
    items = applyFilters(items, this.filters);
    items = applyOrder(items, this.orderField, this.orderDir);
    if (this.limitVal !== void 0) {
      items = items.slice(0, this.limitVal);
    }
    const docs = items.map((item) => {
      const id = item.id || Math.random().toString(36).slice(2);
      return new SQLiteDocSnapshot(id, true, new SQLiteDoc(this.collectionName, id), item);
    });
    return new SQLiteQuerySnapshot(docs);
  }
};
var SQLiteCollection = class extends SQLiteQuery {
  constructor(collectionName) {
    super(collectionName);
  }
  doc(id) {
    return new SQLiteDoc(
      this.collectionName,
      id || `${this.collectionName}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    );
  }
  async add(data) {
    const doc = this.doc();
    await doc.set({ ...data, id: doc.id });
    return doc;
  }
};
var SQLiteBatch = class {
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
    await initializeSQLiteStorage();
    withTransaction(() => {
      for (const op of this.ops) {
        if (op.type === "set") upsertDoc(op.doc.collectionName, op.doc.id, op.data);
        if (op.type === "update") updateDoc(op.doc.collectionName, op.doc.id, op.data);
        if (op.type === "delete") deleteDoc(op.doc.collectionName, op.doc.id);
      }
    });
  }
};
var SQLiteFirestore = class {
  constructor() {
    this.projectId = process.env.FIREBASE_PROJECT_ID || "sqlite-local";
  }
  collection(name) {
    return new SQLiteCollection(name);
  }
  batch() {
    return new SQLiteBatch();
  }
};
async function tableCount(table) {
  try {
    await initializeSQLiteStorage();
    const row = one(`SELECT COUNT(*) as count FROM ${table}`);
    return Number(row?.count || 0);
  } catch {
    return 0;
  }
}
async function getSQLiteDiagnostics() {
  await initializeSQLiteStorage();
  const lastMigration = one("SELECT id, applied_at FROM migrations ORDER BY applied_at DESC LIMIT 1") || null;
  return {
    storageMode: process.env.STORAGE_MODE || "firebase-first",
    sqliteEnabled: process.env.STORAGE_MODE === "sqlite",
    sqliteDbPath,
    sqliteFileExists: Boolean(sqliteDbPath && import_fs.default.existsSync(sqliteDbPath)),
    sqliteReady,
    tableCounts: {
      users: await tableCount("users"),
      vocab_sets: await tableCount("vocab_sets"),
      vocab_items: await tableCount("vocab_items"),
      classes: await tableCount("classes"),
      assignments: await tableCount("assignments"),
      results: await tableCount("results"),
      game_results: await tableCount("game_results"),
      grammar_sets: await tableCount("grammar_sets"),
      grammar_attempts: await tableCount("grammar_attempts")
    },
    lastMigration: lastMigration || sqliteLastMigration,
    lastError: sqliteLastError
  };
}

// src/lib/firebaseAdmin.ts
var projectId = process.env.FIREBASE_PROJECT_ID;
var clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
var privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
var storageMode = process.env.STORAGE_MODE || "firebase-first";
var isSQLiteStorageMode = storageMode === "sqlite";
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
if (isSQLiteStorageMode) {
  initializeSQLiteStorage();
}
var LocalDbEngine = class {
  constructor() {
    this.memoryCache = null;
    this.filePath = process.env.LOCAL_DB_PATH || "/home/qzmivzbj/app-data/vhomework/db.json";
    this.ensurePersistentFile();
    this.load();
  }
  ensurePersistentFile() {
    const legacyPath = import_path2.default.join(process.cwd(), "db.json");
    try {
      import_fs2.default.mkdirSync(import_path2.default.dirname(this.filePath), { recursive: true });
      if (!import_fs2.default.existsSync(this.filePath) && import_fs2.default.existsSync(legacyPath)) {
        import_fs2.default.copyFileSync(legacyPath, this.filePath);
      }
    } catch (err) {
      console.error("LocalDbEngine failed to prepare persistent database:", err);
      this.filePath = legacyPath;
    }
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
      if (import_fs2.default.existsSync(this.filePath)) {
        const raw = import_fs2.default.readFileSync(this.filePath, "utf8");
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
      import_fs2.default.writeFileSync(this.filePath, JSON.stringify(this.memoryCache, null, 2), "utf8");
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
var FIREBASE_ADMIN_TIMEOUT_MS = 5e3;
function withAdminTimeout(promise, message) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), FIREBASE_ADMIN_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}
async function runDiagnostic() {
  if (isSQLiteStorageMode) {
    console.log("STORAGE_MODE=sqlite. Skipping Firestore storage diagnostic; SQLite will be used for app data.");
    await initializeSQLiteStorage();
    useLocalFallback = false;
    return;
  }
  if (!hasServiceAccountCredentials) {
    console.warn("Firebase Admin credentials are not configured. Activating Local DB fallback engine.");
    useLocalFallback = true;
    return;
  }
  try {
    const testDoc = realDb.collection("system_status_check").doc("status");
    await withAdminTimeout(
      testDoc.set({ active: true, checkedAt: (/* @__PURE__ */ new Date()).toISOString() }),
      "Firestore diagnostic set timed out."
    );
    await withAdminTimeout(testDoc.get(), "Firestore diagnostic get timed out.");
    await withAdminTimeout(testDoc.delete(), "Firestore diagnostic delete timed out.");
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
var adminDb = isSQLiteStorageMode ? new SQLiteFirestore() : new FallbackFirestore();
async function getStorageDiagnostics() {
  if (isSQLiteStorageMode) {
    return getSQLiteDiagnostics();
  }
  return {
    storageMode,
    sqliteEnabled: false,
    sqliteDbPath: null,
    sqliteFileExists: false,
    sqliteReady: false,
    tableCounts: null,
    lastMigration: null,
    lastError: useLocalFallback ? "Using local db.json fallback for app data." : null
  };
}

// server.ts
import_dotenv.default.config();
var app2 = (0, import_express.default)();
var PORT = Number(process.env.PORT) || 3e3;
var AUDIO_DIR = process.env.TTS_AUDIO_DIR || "/home/qzmivzbj/app-data/vhomework/audio";
var AUDIO_PUBLIC_PREFIX = "/audio";
app2.use(import_express.default.json());
import_fs3.default.mkdirSync(AUDIO_DIR, { recursive: true });
app2.use(AUDIO_PUBLIC_PREFIX, import_express.default.static(AUDIO_DIR));
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
var ACTIVITY_TTL_DAYS = 7;
var ACTIVITY_TTL_MS = ACTIVITY_TTL_DAYS * 24 * 60 * 60 * 1e3;
function addDaysIso(baseIso, days) {
  return new Date(new Date(baseIso).getTime() + days * 24 * 60 * 60 * 1e3).toISOString();
}
function getActivityTime(data) {
  return data.completedAt || data.endedAt || data.createdAt || data.startedAt || "";
}
function isExpiredActivity(data, nowMs = Date.now()) {
  if (data.expiresAt && new Date(data.expiresAt).getTime() < nowMs) return true;
  const createdOrCompleted = data.createdAt || data.completedAt || data.endedAt;
  return Boolean(createdOrCompleted && nowMs - new Date(createdOrCompleted).getTime() > ACTIVITY_TTL_MS);
}
function grammarAttemptToActivity(attempt, set = {}) {
  const gradeClass = getLessonGradeClass(set);
  const totalQuestions = Math.max(
    1,
    Number(attempt.correctCount || 0) + Number(attempt.wrongCount || 0) + Number(attempt.unansweredCount || 0) || Number((attempt.questions || []).length) || Number(attempt.maxScore || 0) || 1
  );
  const correctAnswers = Number(attempt.correctCount || 0);
  const incorrectAnswers = Number(attempt.wrongCount || 0) + Number(attempt.unansweredCount || 0);
  const accuracy = Math.round(correctAnswers / totalQuestions * 100);
  const answersByQuestion = /* @__PURE__ */ new Map();
  (attempt.answers || []).forEach((answer) => {
    answersByQuestion.set(answer.attemptQuestionId, answer);
  });
  return {
    id: `grammar-${attempt.id}`,
    sourceType: "grammar",
    userId: attempt.userId,
    studentId: attempt.userId,
    studentName: attempt.studentName || "H\u1ECDc sinh",
    guestId: attempt.userId || normalizePersonName(attempt.studentName || ""),
    assignmentId: attempt.assignmentId || "",
    classId: attempt.classId || set.classId || gradeClass.classId || "",
    className: attempt.className || set.className || gradeClass.className || "",
    vocabSetId: `grammar:${attempt.grammarSetId}`,
    vocabSetTitle: attempt.grammarSetTitle || set.title || "B\xE0i ng\u1EEF ph\xE1p",
    gameId: "grammar-practice",
    gameName: "Luy\u1EC7n ng\u1EEF ph\xE1p",
    gameType: "grammar",
    startedAt: attempt.startedAt || attempt.createdAt || attempt.completedAt,
    endedAt: attempt.completedAt,
    completedAt: attempt.completedAt,
    createdAt: attempt.createdAt || attempt.startedAt || attempt.completedAt,
    durationMs: Math.max(0, Number(attempt.durationSeconds || 0)) * 1e3,
    durationSeconds: Math.max(0, Number(attempt.durationSeconds || 0)),
    score: accuracy,
    rawScore: Number(attempt.score || 0),
    maxScore: Number(attempt.maxScore || totalQuestions),
    totalQuestions,
    correctAnswers,
    incorrectAnswers,
    accuracy,
    answerDetails: (attempt.questions || []).map((question, index) => {
      const answer = answersByQuestion.get(question.id);
      const selectedOption = (question.optionsSnapshot || []).find((option) => option.id === answer?.selectedOptionId);
      const correctOption = (question.optionsSnapshot || []).find((option) => option.id === question.correctOptionId || option.id === answer?.correctOptionId);
      return {
        questionIndex: index,
        wordId: question.questionId,
        questionText: question.questionSnapshot,
        selectedAnswer: selectedOption?.text || "",
        userAnswer: selectedOption?.text || "",
        correctAnswer: correctOption?.text || "",
        isCorrect: Boolean(answer?.isCorrect),
        options: (question.optionsSnapshot || []).map((option) => option.text).filter(Boolean)
      };
    })
  };
}
async function getGrammarSetMap() {
  const snapshot = await adminDb.collection("grammar_sets").get();
  const setsById = /* @__PURE__ */ new Map();
  snapshot.forEach((doc) => {
    const data = { id: doc.id, ...doc.data() };
    setsById.set(data.id, data);
  });
  return setsById;
}
async function getVocabSetMap() {
  const snapshot = await adminDb.collection("vocab_sets").get();
  const setsById = /* @__PURE__ */ new Map();
  snapshot.forEach((doc) => {
    const data = { id: doc.id, ...doc.data() };
    setsById.set(data.id, data);
  });
  return setsById;
}
function getLessonGradeClass(set = {}) {
  const gradeLevel = String(set.gradeLevel || "").trim();
  if (!gradeLevel) return { classId: "", className: "" };
  return {
    classId: `grade:${normalizePersonName(gradeLevel)}`,
    className: gradeLevel
  };
}
var DEFAULT_TTS_PROVIDER = "ai33";
var DEFAULT_TTS_LANG = "en-US";
var DEFAULT_TTS_SPEED = 1;
var DEFAULT_TTS_VOICE_BY_LANG = {
  "en-US": "elevenlabs_wMBr6SfqQVuOqplK01NE",
  "en-GB": "elevenlabs_wMBr6SfqQVuOqplK01NE"
};
var ttsQueue = [];
var isProcessingTtsQueue = false;
function normalizeTtsText(text) {
  return text.normalize("NFKC").trim().replace(/\s+/g, " ");
}
function sanitizeTtsInput(input) {
  const warnings = [];
  let text = String(input || "").normalize("NFKC").replace(/\r\n?/g, "\n").trim();
  if (!text) return { text: "", warnings };
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
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
  text = normalizeTtsText(text).replace(/^[\s"'“”‘’.,;:!?]+|[\s"'“”‘’.,;:!?]+$/g, "").trim();
  if (text.length > 120) {
    warnings.push("TTS text was shortened to 120 characters.");
    text = text.slice(0, 120).trim();
  }
  return { text, warnings };
}
function normalizeTtsSettings(settings = {}) {
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
function createAudioHash(text, settings) {
  const normalizedText = normalizeTtsText(text);
  return import_crypto.default.createHash("sha256").update(`${settings.provider}|${settings.lang}|${settings.voice}|${settings.speed}|${normalizedText}`).digest("hex");
}
function audioFileName(audioHash) {
  return `${audioHash}.mp3`;
}
function audioFilePath(audioHash) {
  return import_path3.default.join(AUDIO_DIR, audioFileName(audioHash));
}
function audioPublicUrl(audioHash) {
  return `${AUDIO_PUBLIC_PREFIX}/${audioFileName(audioHash)}`;
}
function getAi33ApiKey() {
  return process.env.AI33_API_KEY || process.env.TTS_API_KEY || "";
}
function getAi33TaskUrl(taskId) {
  const template = process.env.AI33_TASK_STATUS_URL_TEMPLATE || "https://api.ai33.pro/v1/task/{taskId}";
  return template.replace("{taskId}", encodeURIComponent(taskId));
}
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function requestAi33TtsTask(text, settings, fileName) {
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
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.success || !data.task_id) {
    throw new Error(data.error || data.message || `TTS request failed with HTTP ${res.status}`);
  }
  return data.task_id;
}
async function pollAi33AudioUrl(taskId) {
  const apiKey = getAi33ApiKey();
  if (!apiKey) throw new Error("AI33_API_KEY/TTS_API_KEY is not configured.");
  const maxAttempts = Number(process.env.AI33_TTS_POLL_ATTEMPTS || 24);
  const intervalMs = Number(process.env.AI33_TTS_POLL_INTERVAL_MS || 2500);
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) await delay(intervalMs);
    const res = await fetch(getAi33TaskUrl(taskId), {
      headers: { "xi-api-key": apiKey }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || data.message || `TTS status failed with HTTP ${res.status}`);
    const status = String(data.status || "").toLowerCase();
    if (status === "failed" || status === "error") {
      throw new Error(data.error_message || data.error || "TTS task failed.");
    }
    const audioUrl = data.metadata?.audio_url || data.metadata?.output_uri || data.output_uri || data.audio_url;
    if ((status === "done" || status === "completed" || status === "success") && audioUrl) {
      return audioUrl;
    }
  }
  throw new Error("TTS task timed out before audio was ready.");
}
async function downloadAudioToCache(sourceUrl, targetPath) {
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
  import_fs3.default.mkdirSync(import_path3.default.dirname(targetPath), { recursive: true });
  import_fs3.default.writeFileSync(targetPath, buffer);
}
async function generateCachedTtsAudio(inputText, settings, force = false) {
  const sanitized = sanitizeTtsInput(inputText);
  if (!sanitized.text) throw new Error("Missing TTS text after cleanup.");
  const audioHash = createAudioHash(sanitized.text, settings);
  const targetPath = audioFilePath(audioHash);
  const targetUrl = audioPublicUrl(audioHash);
  if (!force && import_fs3.default.existsSync(targetPath)) {
    return {
      audioHash,
      audioPath: targetPath,
      audioUrl: targetUrl,
      cached: true,
      ttsText: sanitized.text,
      warnings: sanitized.warnings
    };
  }
  if (force && import_fs3.default.existsSync(targetPath)) {
    try {
      import_fs3.default.unlinkSync(targetPath);
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
function mergeItemAudioState(item, patch) {
  return {
    ...item,
    ...patch,
    audioUpdatedAt: (/* @__PURE__ */ new Date()).toISOString()
  };
}
async function saveVocabSetItems(vocabSetId, items) {
  const docRef = adminDb.collection("vocab_sets").doc(vocabSetId);
  const latestDoc = await docRef.get();
  if (!latestDoc.exists) return;
  const latest = latestDoc.data();
  await docRef.set(normalizeVocabSetForSave({ ...latest, items }, latest));
}
function enqueueVocabSetAudio(vocabSetId, settings, itemIds, force = false) {
  ttsQueue.push({
    vocabSetId,
    settings: normalizeTtsSettings(settings),
    itemIds,
    force
  });
  processTtsQueue().catch((err) => console.error("TTS queue failed:", err));
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
async function processVocabSetAudioJob(job) {
  const docRef = adminDb.collection("vocab_sets").doc(job.vocabSetId);
  const doc = await docRef.get();
  if (!doc.exists) return;
  let set = doc.data();
  let items = Array.isArray(set.items) ? [...set.items] : [];
  const selected = new Set(job.itemIds || items.map((item) => item.id));
  for (const item of items) {
    if (!selected.has(item.id)) continue;
    const sanitized = sanitizeTtsInput(String(item.term || ""));
    if (!sanitized.text) continue;
    const audioHash = createAudioHash(sanitized.text, job.settings);
    const targetPath = audioFilePath(audioHash);
    const existingReady = !job.force && item.audioHash === audioHash && item.audioUrl && import_fs3.default.existsSync(targetPath);
    if (existingReady) continue;
    if (!job.force && import_fs3.default.existsSync(targetPath)) {
      items = items.map(
        (current) => current.id === item.id ? mergeItemAudioState(current, {
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
          audioGeneratedAt: current.audioGeneratedAt || (/* @__PURE__ */ new Date()).toISOString()
        }) : current
      );
      await saveVocabSetItems(job.vocabSetId, items);
      continue;
    }
    items = items.map(
      (current) => current.id === item.id ? mergeItemAudioState(current, {
        audioHash,
        audioStatus: "generating",
        audioError: "",
        ttsText: sanitized.text,
        audioWarnings: sanitized.warnings,
        ttsProvider: job.settings.provider,
        ttsVoice: job.settings.voice,
        ttsLang: job.settings.lang,
        ttsSpeed: job.settings.speed
      }) : current
    );
    await saveVocabSetItems(job.vocabSetId, items);
    try {
      const result = await generateCachedTtsAudio(sanitized.text, job.settings, job.force);
      items = items.map(
        (current) => current.id === item.id ? mergeItemAudioState(current, {
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
          audioGeneratedAt: (/* @__PURE__ */ new Date()).toISOString()
        }) : current
      );
    } catch (err) {
      items = items.map(
        (current) => current.id === item.id ? mergeItemAudioState(current, {
          audioHash,
          audioStatus: "failed",
          audioError: err.message || "TTS generation failed.",
          ttsText: sanitized.text,
          audioWarnings: sanitized.warnings,
          ttsProvider: job.settings.provider,
          ttsVoice: job.settings.voice,
          ttsLang: job.settings.lang,
          ttsSpeed: job.settings.speed
        }) : current
      );
    }
    await saveVocabSetItems(job.vocabSetId, items);
  }
}
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
var GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";
var OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4.1";
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
function getOpenAIKey() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("OPENAI_API_KEY is not defined. OpenAI paid fallback is disabled.");
    return "";
  }
  return apiKey;
}
function sanitizeAiError(provider, error) {
  const status = error?.status || error?.statusCode || error?.response?.status;
  const message = String(error?.message || error || "Unknown AI error").replace(/sk-[A-Za-z0-9_-]+/g, "sk-***").slice(0, 240);
  return status ? `${provider} ${status}: ${message}` : `${provider}: ${message}`;
}
function extractOpenAIText(data) {
  if (typeof data?.output_text === "string") return data.output_text;
  const chunks = [];
  for (const item of data?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === "string") {
        chunks.push(content.text);
      }
    }
  }
  return chunks.join("\n").trim();
}
async function generateWithOpenAI(prompt) {
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
    const error = new Error(errorText || `OpenAI request failed with status ${response.status}`);
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
async function generateAiText(prompt, geminiConfig) {
  const errors = [];
  const gemini = getGeminiClient();
  if (gemini) {
    try {
      const response = await gemini.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
        ...geminiConfig ? { config: geminiConfig } : {}
      });
      return {
        text: response.text?.trim() || "",
        provider: "gemini",
        errors
      };
    } catch (error) {
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
  } catch (error) {
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
function parseAiJson(text) {
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
app2.get("/api/diagnostics/storage", async (req, res) => {
  const secret = process.env.DIAGNOSTIC_SECRET;
  if (!secret) {
    return res.status(404).json({ error: "Not found" });
  }
  if (req.query.secret !== secret) {
    return res.status(403).json({ error: "Forbidden" });
  }
  res.json(await getStorageDiagnostics());
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
  } catch (error) {
    console.warn("AI IPA generator service unavailable, returning fallback:", error.message);
    res.json({
      ipa: `/${(word || "").toLowerCase()}/`,
      isFallback: true,
      aiProvider: "fallback",
      aiErrors: [sanitizeAiError("AI", error)]
    });
  }
});
var ALLOWED_PARTS_OF_SPEECH = [
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
function normalizePartOfSpeech(value) {
  const text = String(value || "").trim().toLowerCase();
  const match = ALLOWED_PARTS_OF_SPEECH.find((pos) => pos.toLowerCase() === text);
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
function normalizeForExampleCheck(value) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
function isWeakVocabularyExample(example, word) {
  const normalizedExample = normalizeForExampleCheck(example);
  const normalizedWord = normalizeForExampleCheck(word);
  if (!normalizedExample || !normalizedWord) return true;
  if (!normalizedExample.includes(normalizedWord)) return true;
  return normalizedExample.startsWith("the word ") || normalizedExample.startsWith("this word ") || normalizedExample.includes("appears often in everyday english") || normalizedExample.includes("students should practice") || normalizedExample.includes("is a vocabulary word");
}
function hashText(value) {
  return Array.from(value || "").reduce((hash, char) => {
    return (hash << 5) - hash + char.charCodeAt(0) | 0;
  }, 0);
}
function buildFallbackExample(word, meaning) {
  const cleanWord = String(word || "").trim();
  const cleanMeaning = String(meaning || "").trim();
  const wordForSentence = cleanWord || "learning";
  const meaningForSentence = cleanMeaning || wordForSentence;
  const templates = [
    {
      example: `During a lively class discussion, ${wordForSentence} helped everyone connect the lesson with something useful in daily life.`,
      exampleMeaning: `Trong m\u1ED9t bu\u1ED5i th\u1EA3o lu\u1EADn s\xF4i n\u1ED5i tr\xEAn l\u1EDBp, ${meaningForSentence} \u0111\xE3 gi\xFAp m\u1ECDi ng\u01B0\u1EDDi li\xEAn h\u1EC7 b\xE0i h\u1ECDc v\u1EDBi \u0111i\u1EC1u h\u1EEFu \xEDch trong \u0111\u1EDDi s\u1ED1ng h\u1EB1ng ng\xE0y.`
    },
    {
      example: `After school, I wrote ${wordForSentence} in my notebook and used it in a sentence about my own day.`,
      exampleMeaning: `Sau gi\u1EDD h\u1ECDc, t\xF4i vi\u1EBFt ${meaningForSentence} v\xE0o v\u1EDF v\xE0 d\xF9ng n\xF3 trong m\u1ED9t c\xE2u n\xF3i v\u1EC1 ng\xE0y c\u1EE7a ch\xEDnh m\xECnh.`
    },
    {
      example: `When the group project became difficult, ${wordForSentence} gave us a clear idea to explain our work with more confidence.`,
      exampleMeaning: `Khi b\xE0i l\xE0m nh\xF3m tr\u1EDF n\xEAn kh\xF3 h\u01A1n, ${meaningForSentence} \u0111\xE3 cho ch\xFAng t\xF4i m\u1ED9t \xFD t\u01B0\u1EDFng r\xF5 r\xE0ng \u0111\u1EC3 gi\u1EA3i th\xEDch b\xE0i l\xE0m t\u1EF1 tin h\u01A1n.`
    },
    {
      example: `At home, my younger brother asked about ${wordForSentence}, so I tried to explain it with a simple and funny example.`,
      exampleMeaning: `\u1EDE nh\xE0, em trai t\xF4i h\u1ECFi v\u1EC1 ${meaningForSentence}, n\xEAn t\xF4i c\u1ED1 gi\u1EA3i th\xEDch b\u1EB1ng m\u1ED9t v\xED d\u1EE5 \u0111\u01A1n gi\u1EA3n v\xE0 th\xFA v\u1ECB.`
    },
    {
      example: `In the middle of the lesson, the teacher used ${wordForSentence} to turn a normal question into an interesting challenge.`,
      exampleMeaning: `Gi\u1EEFa gi\u1EDD h\u1ECDc, gi\xE1o vi\xEAn \u0111\xE3 d\xF9ng ${meaningForSentence} \u0111\u1EC3 bi\u1EBFn m\u1ED9t c\xE2u h\u1ECFi b\xECnh th\u01B0\u1EDDng th\xE0nh m\u1ED9t th\u1EED th\xE1ch th\xFA v\u1ECB.`
    },
    {
      example: `Before the quiz, I reviewed ${wordForSentence} carefully because small details can make a big difference in learning.`,
      exampleMeaning: `Tr\u01B0\u1EDBc b\xE0i ki\u1EC3m tra, t\xF4i \xF4n l\u1EA1i ${meaningForSentence} th\u1EADt c\u1EA9n th\u1EADn v\xEC nh\u1EEFng chi ti\u1EBFt nh\u1ECF c\xF3 th\u1EC3 t\u1EA1o n\xEAn kh\xE1c bi\u1EC7t l\u1EDBn trong h\u1ECDc t\u1EADp.`
    },
    {
      example: `My friend smiled when she finally understood ${wordForSentence}, and the whole exercise suddenly felt much easier.`,
      exampleMeaning: `B\u1EA1n t\xF4i m\u1EC9m c\u01B0\u1EDDi khi cu\u1ED1i c\xF9ng \u0111\xE3 hi\u1EC3u ${meaningForSentence}, v\xE0 c\u1EA3 b\xE0i luy\u1EC7n t\u1EADp b\u1ED7ng tr\u1EDF n\xEAn d\u1EC5 h\u01A1n nhi\u1EC1u.`
    },
    {
      example: `On the classroom board, ${wordForSentence} became the key idea that helped us remember the story behind the lesson.`,
      exampleMeaning: `Tr\xEAn b\u1EA3ng l\u1EDBp, ${meaningForSentence} tr\u1EDF th\xE0nh \xFD ch\xEDnh gi\xFAp ch\xFAng t\xF4i nh\u1EDB c\xE2u chuy\u1EC7n ph\xEDa sau b\xE0i h\u1ECDc.`
    }
  ];
  const index = Math.abs(hashText(`${wordForSentence}|${meaningForSentence}`)) % templates.length;
  return templates[index];
}
app2.post("/api/ai/vocab-detail", authenticateUser, async (req, res) => {
  const { word, meaning, grade } = req.body;
  try {
    if (!word || typeof word !== "string") {
      return res.status(400).json({ error: "Tham s\u1ED1 'word' l\xE0 b\u1EAFt bu\u1ED9c." });
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
        type: import_genai.Type.OBJECT,
        properties: {
          meaning: { type: import_genai.Type.STRING },
          ipa: { type: import_genai.Type.STRING },
          pos: { type: import_genai.Type.STRING },
          example: { type: import_genai.Type.STRING },
          exampleMeaning: { type: import_genai.Type.STRING },
          audioUrl: { type: import_genai.Type.STRING }
        },
        required: ["meaning", "ipa", "pos", "example", "exampleMeaning"]
      }
    });
    if (result.provider === "fallback") {
      return res.json({ ...fallback, isFallback: true, aiProvider: "fallback", aiErrors: result.errors });
    }
    const parsedData = parseAiJson(result.text);
    const exampleData = isWeakVocabularyExample(parsedData.example, word) ? buildFallbackExample(word, parsedData.meaning || meaning) : {
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
  } catch (error) {
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
app2.post("/api/ai/generate", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
  const { topic, grade, wordsCount = 5 } = req.body;
  try {
    if (!topic || typeof topic !== "string") {
      return res.status(400).json({ error: "Tham s\u1ED1 'topic' l\xE0 b\u1EAFt bu\u1ED9c." });
    }
    const prompt = `Generate a JSON array of exactly ${wordsCount} English vocabulary words for topic: "${topic}" targeted for students at grade level: "${grade || "primary school"}". 
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
    });
    if (result.provider === "fallback") {
      const fallbackList = getFallbackVocabulary(topic, wordsCount).map((item) => ({
        ...item,
        isFallback: true,
        aiProvider: "fallback",
        aiErrors: result.errors
      }));
      return res.json(fallbackList);
    }
    const parsedData = parseAiJson(result.text);
    res.json(Array.isArray(parsedData) ? parsedData.map((item) => {
      const fallbackExample = buildFallbackExample(item.term, item.meaning);
      const exampleData = isWeakVocabularyExample(item.example, item.term) ? fallbackExample : {
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
  } catch (error) {
    console.warn("AI generation service unavailable, returning fallback:", error.message);
    const fallbackList = getFallbackVocabulary(topic, wordsCount).map((item) => ({
      ...item,
      isFallback: true,
      aiProvider: "fallback",
      aiErrors: [sanitizeAiError("AI", error)]
    }));
    res.json(fallbackList);
  }
});
app2.get("/api/vocab-sets/share/:token", async (req, res) => {
  try {
    const token = String(req.params.token || "").trim();
    if (!token) {
      return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y b\xE0i t\u1EADp ho\u1EB7c link kh\xF4ng h\u1EE3p l\u1EC7" });
    }
    const assignmentsSnapshot = await adminDb.collection("assignments").get();
    const assignments = [];
    let matchedAssignment = null;
    assignmentsSnapshot.forEach((doc) => {
      const assignment = { id: doc.id, ...doc.data() };
      assignments.push(assignment);
      const assignmentToken = assignment.shareToken || assignment.assignmentSlug || assignment.id;
      if (!matchedAssignment && assignmentToken === token) {
        matchedAssignment = assignment;
      }
    });
    const snapshot = await adminDb.collection("vocab_sets").get();
    let found = null;
    if (matchedAssignment) {
      snapshot.forEach((doc) => {
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
      snapshot.forEach((doc) => {
        const set = { id: doc.id, ...doc.data() };
        const setToken = set.shareToken || set.assignmentSlug;
        if (!found && setToken === token && getVocabVisibility(set) === "assignment") {
          found = normalizeVocabSetForSave(set, set);
        }
      });
      if (found) {
        const matchingAssignments = assignments.filter((assignment) => assignment.vocabSetId === found.id);
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
      return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y b\xE0i t\u1EADp ho\u1EB7c link kh\xF4ng h\u1EE3p l\u1EC7" });
    }
    res.json(found);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app2.get("/api/public/vocab-sets", async (req, res) => {
  try {
    const snapshot = await adminDb.collection("vocab_sets").get();
    const list = [];
    snapshot.forEach((doc) => {
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app2.get("/api/public/results", async (req, res) => {
  try {
    const snapshot = await adminDb.collection("game_sessions").get();
    const grammarAttemptsSnapshot = await adminDb.collection("grammar_attempts").get();
    const grammarSetsById = await getGrammarSetMap();
    const vocabSetsById = await getVocabSetMap();
    const assignmentsSnapshot = await adminDb.collection("assignments").get();
    const classesSnapshot = await adminDb.collection("classes").get();
    const membersSnapshot = await adminDb.collection("class_members").get();
    const assignmentsById = /* @__PURE__ */ new Map();
    const classesById = /* @__PURE__ */ new Map();
    const uniqueAssignmentClassByVocabSet = /* @__PURE__ */ new Map();
    const uniqueMemberClassByName = /* @__PURE__ */ new Map();
    classesSnapshot.forEach((doc) => {
      const data = { id: doc.id, ...doc.data() };
      classesById.set(data.id, data);
    });
    assignmentsSnapshot.forEach((doc) => {
      const data = { id: doc.id, ...doc.data() };
      assignmentsById.set(doc.id, data);
      if (data.id) assignmentsById.set(data.id, data);
      setUniqueClass(uniqueAssignmentClassByVocabSet, data.vocabSetId, {
        classId: data.classId,
        className: data.className || classesById.get(data.classId)?.name || ""
      });
    });
    membersSnapshot.forEach((doc) => {
      const data = { id: doc.id, ...doc.data() };
      const className = data.className || classesById.get(data.classId)?.name || "";
      setUniqueClass(uniqueMemberClassByName, normalizePersonName(data.studentName), {
        classId: data.classId,
        className
      });
    });
    const list = [];
    const cutoff = Date.now() - ACTIVITY_TTL_MS;
    snapshot.forEach((doc) => {
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
      const resolvedClass = data.classId ? {
        classId: data.classId,
        className: data.className || classesById.get(data.classId)?.name || ""
      } : assignmentClass?.classId ? assignmentClass : vocabSetClass?.classId ? vocabSetClass : gradeClass.classId ? gradeClass : memberClass?.classId ? memberClass : { classId: "", className: "" };
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
    grammarAttemptsSnapshot.forEach((doc) => {
      const data = { id: doc.id, ...doc.data() };
      if (data.status !== "completed" || !data.completedAt) return;
      if (isExpiredActivity(data)) return;
      if (new Date(getActivityTime(data)).getTime() < cutoff) return;
      const activity = grammarAttemptToActivity(data, grammarSetsById.get(data.grammarSetId));
      delete activity.answerDetails;
      list.push(activity);
    });
    list.sort((a, b) => new Date(getActivityTime(b)).getTime() - new Date(getActivityTime(a)).getTime());
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app2.get("/api/vocab-sets", authenticateUser, async (req, res) => {
  try {
    const { search, grade, status, visibility } = req.query;
    const snapshot = await adminDb.collection("vocab_sets").get();
    let list = [];
    snapshot.forEach((doc) => {
      const set = doc.data();
      const normalizedVisibility = getVocabVisibility(set);
      list.push({
        ...set,
        visibility: normalizedVisibility,
        status: toLegacyStatus(normalizedVisibility)
      });
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
    if (visibility) {
      list = list.filter((set) => getVocabVisibility(set) === visibility);
    }
    if (req.user && req.user.role === "student") {
      list = list.filter((set) => getVocabVisibility(set) === "public");
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
    const newSet = normalizeVocabSetForSave({
      ...set,
      id,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      createdBy: req.user.id,
      creatorName: req.user.name
    });
    await adminDb.collection("vocab_sets").doc(id).set(newSet);
    if (newSet.ttsSettings?.autoGenerate) {
      enqueueVocabSetAudio(id, newSet.ttsSettings);
    }
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
    const updatedSet = normalizeVocabSetForSave({ ...payload, id }, existingDoc.data());
    await docRef.set(updatedSet);
    if (updatedSet.ttsSettings?.autoGenerate) {
      enqueueVocabSetAudio(id, updatedSet.ttsSettings);
    }
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
app2.post("/api/tts/preview", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app2.get("/api/tts/voices", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app2.get("/api/vocab-sets/:id/audio/status", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
  try {
    const doc = await adminDb.collection("vocab_sets").doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: "Vocabulary set not found." });
    const set = doc.data();
    const items = Array.isArray(set.items) ? set.items : [];
    res.json({
      id: set.id,
      items: items.map((item) => ({
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app2.post("/api/vocab-sets/:id/audio/generate-missing", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
  try {
    const doc = await adminDb.collection("vocab_sets").doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: "Vocabulary set not found." });
    const settings = normalizeTtsSettings(req.body?.settings || doc.data().ttsSettings || {});
    const itemIds = Array.isArray(req.body?.itemIds) ? req.body.itemIds.map(String) : void 0;
    const force = Boolean(req.body?.force);
    enqueueVocabSetAudio(req.params.id, settings, itemIds, force);
    res.json({ queued: true, itemIds: itemIds || null, force });
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
    const clone = normalizeVocabSetForSave({
      ...original,
      id: cloneId,
      title: `${original.title} (Nh\xE2n b\u1EA3n)`,
      visibility: "draft",
      status: "draft",
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      createdBy: req.user.id,
      creatorName: req.user.name
    });
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
    const shareToken = payload.shareToken || payload.assignmentSlug || createShareToken();
    const newAssign = {
      ...payload,
      id,
      shareToken,
      assignmentSlug: shareToken,
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
app2.get("/api/grammar-sets", authenticateUser, async (req, res) => {
  try {
    const snapshot = await adminDb.collection("grammar_sets").get();
    const list = [];
    snapshot.forEach((doc) => {
      const set = { id: doc.id, ...doc.data() };
      if (req.user?.role === "student" && getGrammarVisibility(set) !== "public") return;
      list.push(req.user?.role === "student" ? sanitizeGrammarSetForStudent(set) : set);
    });
    list.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime());
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app2.get("/api/grammar-sets/share/:token", async (req, res) => {
  try {
    const token = String(req.params.token || "").trim();
    if (!token) {
      return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y b\xE0i ng\u1EEF ph\xE1p ho\u1EB7c link kh\xF4ng h\u1EE3p l\u1EC7." });
    }
    const snapshot = await adminDb.collection("grammar_sets").get();
    let found = null;
    snapshot.forEach((doc) => {
      const set = { id: doc.id, ...doc.data() };
      const setToken = set.shareToken || set.assignmentSlug;
      const legacyGrammarToken = setToken?.startsWith("grammar-") ? setToken.slice("grammar-".length) : `grammar-${setToken}`;
      if (!found && (setToken === token || legacyGrammarToken === token) && getGrammarVisibility(set) === "assignment") {
        found = set;
      }
    });
    if (!found) {
      return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y b\xE0i ng\u1EEF ph\xE1p ho\u1EB7c link kh\xF4ng h\u1EE3p l\u1EC7." });
    }
    res.json(sanitizeGrammarSetForStudent(found));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app2.get("/api/grammar-sets/:id", authenticateUser, async (req, res) => {
  try {
    const set = await getGrammarSetOr404(req.params.id);
    if (!set) return res.status(404).json({ error: "B\xE0i ng\u1EEF ph\xE1p kh\xF4ng t\u1ED3n t\u1EA1i." });
    if (req.user?.role === "student" && getGrammarVisibility(set) !== "public") {
      return res.status(403).json({ error: "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n m\u1EDF b\xE0i ng\u1EEF ph\xE1p n\xE0y." });
    }
    res.json(req.user?.role === "student" ? sanitizeGrammarSetForStudent(set) : set);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app2.post("/api/admin/grammar-sets", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
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
      `\u0110\xE3 t\u1EA1o b\xE0i ng\u1EEF ph\xE1p: "${set.title}" (${set.questions.length} c\xE2u)`
    );
    res.status(201).json(set);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, details: err.details });
  }
});
app2.put("/api/admin/grammar-sets/:id", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
    const existing = await getGrammarSetOr404(req.params.id);
    if (!existing) return res.status(404).json({ error: "B\xE0i ng\u1EEF ph\xE1p kh\xF4ng t\u1ED3n t\u1EA1i." });
    if (!canManageGrammarSet(req.user, existing)) return res.status(403).json({ error: "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n s\u1EEDa b\xE0i n\xE0y." });
    const set = normalizeGrammarSetForSave({ ...req.body, id: req.params.id }, existing, req.user);
    await adminDb.collection("grammar_sets").doc(req.params.id).set(set);
    await logAuditAction(
      req.user.id,
      req.user.name,
      req.user.email,
      "UPDATE_GRAMMAR_SET",
      `\u0110\xE3 c\u1EADp nh\u1EADt b\xE0i ng\u1EEF ph\xE1p: "${set.title}"`
    );
    res.json(set);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, details: err.details });
  }
});
app2.delete("/api/admin/grammar-sets/:id", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
    const existing = await getGrammarSetOr404(req.params.id);
    if (!existing) return res.status(404).json({ error: "B\xE0i ng\u1EEF ph\xE1p kh\xF4ng t\u1ED3n t\u1EA1i." });
    if (!canManageGrammarSet(req.user, existing)) return res.status(403).json({ error: "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n x\xF3a b\xE0i n\xE0y." });
    await adminDb.collection("grammar_sets").doc(req.params.id).delete();
    await logAuditAction(
      req.user.id,
      req.user.name,
      req.user.email,
      "DELETE_GRAMMAR_SET",
      `\u0110\xE3 x\xF3a b\xE0i ng\u1EEF ph\xE1p: "${existing.title}"`
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app2.post("/api/admin/grammar-sets/:id/clone", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
    const existing = await getGrammarSetOr404(req.params.id);
    if (!existing) return res.status(404).json({ error: "B\xE0i ng\u1EEF ph\xE1p kh\xF4ng t\u1ED3n t\u1EA1i." });
    const cloneId = makeId("grammar-set");
    const clone = normalizeGrammarSetForSave({
      ...existing,
      id: cloneId,
      title: `${existing.title} (B\u1EA3n sao)`,
      visibility: "draft",
      questions: existing.questions
    }, {}, req.user);
    await adminDb.collection("grammar_sets").doc(cloneId).set(clone);
    res.status(201).json(clone);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, details: err.details });
  }
});
app2.post("/api/grammar-sets/:id/attempts", authenticateUser, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
    const set = await getGrammarSetOr404(req.params.id);
    if (!set) return res.status(404).json({ error: "B\xE0i ng\u1EEF ph\xE1p kh\xF4ng t\u1ED3n t\u1EA1i." });
    if (req.user.role === "student" && getGrammarVisibility(set) !== "public") {
      return res.status(403).json({ error: "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n l\xE0m b\xE0i n\xE0y." });
    }
    const attemptsSnapshot = await adminDb.collection("grammar_attempts").get();
    let completedAttempts = 0;
    attemptsSnapshot.forEach((doc) => {
      const attempt2 = doc.data();
      if (attempt2.grammarSetId === set.id && attempt2.userId === req.user?.id && attempt2.status === "completed") {
        completedAttempts++;
      }
    });
    if (completedAttempts >= Number(set.maxAttempts || 1)) {
      return res.status(403).json({ error: "B\u1EA1n \u0111\xE3 h\u1EBFt s\u1ED1 l\u1EA7n l\xE0m b\xE0i \u0111\u01B0\u1EE3c ph\xE9p." });
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const questions = set.shuffleQuestions ? fisherYates(set.questions || []) : [...set.questions || []];
    const attemptQuestions = questions.map((question, index) => {
      const options = set.shuffleOptions ? fisherYates(question.options || []) : [...question.options || []];
      return {
        id: makeId(`grammar-attempt-question-${index + 1}`),
        questionId: question.id,
        displayPosition: index + 1,
        optionOrder: options.map((option) => option.id),
        questionSnapshot: question.questionText,
        explanationSnapshot: question.explanation,
        scoreSnapshot: question.score,
        optionsSnapshot: options,
        correctOptionId: question.correctOptionId
      };
    });
    const attemptId = makeId("grammar-attempt");
    const attempt = {
      id: attemptId,
      grammarSetId: set.id,
      grammarSetTitle: set.title,
      assignmentId: req.body?.assignmentId || "",
      userId: req.user.id,
      studentName: req.user.name,
      status: "in_progress",
      score: 0,
      maxScore: attemptQuestions.reduce((sum, question) => sum + Number(question.scoreSnapshot || 1), 0),
      correctCount: 0,
      wrongCount: 0,
      unansweredCount: attemptQuestions.length,
      startedAt: now,
      createdAt: now,
      questions: attemptQuestions,
      answers: []
    };
    await adminDb.collection("grammar_attempts").doc(attemptId).set(attempt);
    res.status(201).json(sanitizeAttemptForStudent(attempt, false));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app2.post("/api/grammar-attempts/:attemptId/answers", authenticateUser, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
    const attempt = await getGrammarAttemptOr404(req.params.attemptId);
    if (!attempt) return res.status(404).json({ error: "L\u01B0\u1EE3t l\xE0m b\xE0i kh\xF4ng t\u1ED3n t\u1EA1i." });
    if (attempt.userId !== req.user.id && req.user.role === "student") return res.status(403).json({ error: "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n s\u1EEDa l\u01B0\u1EE3t l\xE0m b\xE0i n\xE0y." });
    if (attempt.status === "completed") return res.status(400).json({ error: "B\xE0i \u0111\xE3 n\u1ED9p, kh\xF4ng th\u1EC3 thay \u0111\u1ED5i \u0111\xE1p \xE1n." });
    const attemptQuestion = (attempt.questions || []).find((question) => question.id === req.body?.attemptQuestionId);
    if (!attemptQuestion) return res.status(400).json({ error: "C\xE2u h\u1ECFi kh\xF4ng h\u1EE3p l\u1EC7." });
    const selectedOptionId = String(req.body?.selectedOptionId || "");
    const selectedOption = attemptQuestion.optionsSnapshot.find((option) => option.id === selectedOptionId);
    if (!selectedOption) return res.status(400).json({ error: "Ph\u01B0\u01A1ng \xE1n \u0111\xE3 ch\u1ECDn kh\xF4ng h\u1EE3p l\u1EC7." });
    const isCorrect = selectedOptionId === attemptQuestion.correctOptionId;
    const answer = {
      id: makeId("grammar-answer"),
      attemptQuestionId: attemptQuestion.id,
      questionId: attemptQuestion.questionId,
      selectedOptionId,
      correctOptionId: attemptQuestion.correctOptionId,
      isCorrect,
      scoreAwarded: isCorrect ? Number(attemptQuestion.scoreSnapshot || 1) : 0,
      answeredAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const answers = (attempt.answers || []).filter((item) => item.attemptQuestionId !== attemptQuestion.id);
    answers.push(answer);
    const updatedAttempt = { ...attempt, answers };
    await adminDb.collection("grammar_attempts").doc(attempt.id).set(updatedAttempt);
    const set = await getGrammarSetOr404(attempt.grammarSetId);
    const feedback = set?.showExplanationImmediately ? {
      isCorrect,
      correctOptionId: attemptQuestion.correctOptionId,
      explanation: attemptQuestion.explanationSnapshot,
      scoreAwarded: answer.scoreAwarded
    } : null;
    res.json({ answer, feedback });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app2.post("/api/grammar-attempts/:attemptId/submit", authenticateUser, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
    const attempt = await getGrammarAttemptOr404(req.params.attemptId);
    if (!attempt) return res.status(404).json({ error: "L\u01B0\u1EE3t l\xE0m b\xE0i kh\xF4ng t\u1ED3n t\u1EA1i." });
    if (attempt.userId !== req.user.id && req.user.role === "student") return res.status(403).json({ error: "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n n\u1ED9p l\u01B0\u1EE3t l\xE0m b\xE0i n\xE0y." });
    if (attempt.status === "completed") return res.status(400).json({ error: "B\xE0i n\xE0y \u0111\xE3 \u0111\u01B0\u1EE3c n\u1ED9p." });
    const answerMap = new Map((attempt.answers || []).map((answer) => [answer.attemptQuestionId, answer]));
    let score = 0;
    let correctCount = 0;
    let wrongCount = 0;
    let unansweredCount = 0;
    for (const question of attempt.questions || []) {
      const answer = answerMap.get(question.id);
      if (!answer) {
        unansweredCount++;
      } else if (answer.isCorrect) {
        correctCount++;
        score += Number(question.scoreSnapshot || 1);
      } else {
        wrongCount++;
      }
    }
    const completedAt = (/* @__PURE__ */ new Date()).toISOString();
    const startedAt = attempt.startedAt || completedAt;
    const durationSeconds = Math.max(0, Math.round((new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1e3));
    const updatedAttempt = {
      ...attempt,
      status: "completed",
      score,
      correctCount,
      wrongCount,
      unansweredCount,
      completedAt,
      durationSeconds
    };
    await adminDb.collection("grammar_attempts").doc(attempt.id).set(updatedAttempt);
    res.json(sanitizeAttemptForStudent(updatedAttempt, true));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app2.get("/api/grammar-attempts/:attemptId/review", authenticateUser, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
    const attempt = await getGrammarAttemptOr404(req.params.attemptId);
    if (!attempt) return res.status(404).json({ error: "L\u01B0\u1EE3t l\xE0m b\xE0i kh\xF4ng t\u1ED3n t\u1EA1i." });
    const set = await getGrammarSetOr404(attempt.grammarSetId);
    const canReview = attempt.userId === req.user.id || req.user.role === "super_admin" || set && canManageGrammarSet(req.user, set);
    if (!canReview) return res.status(403).json({ error: "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n xem l\u01B0\u1EE3t l\xE0m b\xE0i n\xE0y." });
    if (attempt.status !== "completed" && req.user.role === "student") return res.status(403).json({ error: "Ch\u1EC9 \u0111\u01B0\u1EE3c xem l\u1EA1i sau khi n\u1ED9p b\xE0i." });
    res.json(sanitizeAttemptForStudent(attempt, true));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app2.get("/api/grammar-sets/:id/my-attempts", authenticateUser, async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
    const snapshot = await adminDb.collection("grammar_attempts").get();
    const list = [];
    snapshot.forEach((doc) => {
      const attempt = { id: doc.id, ...doc.data() };
      if (attempt.grammarSetId === req.params.id && attempt.userId === req.user?.id) {
        list.push(sanitizeAttemptForStudent(attempt, attempt.status === "completed"));
      }
    });
    list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app2.get("/api/admin/grammar-sets/:id/results", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
    const set = await getGrammarSetOr404(req.params.id);
    if (!set) return res.status(404).json({ error: "B\xE0i ng\u1EEF ph\xE1p kh\xF4ng t\u1ED3n t\u1EA1i." });
    if (!canManageGrammarSet(req.user, set)) return res.status(403).json({ error: "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n xem k\u1EBFt qu\u1EA3 b\xE0i n\xE0y." });
    const snapshot = await adminDb.collection("grammar_attempts").get();
    const attempts = [];
    snapshot.forEach((doc) => {
      const attempt = { id: doc.id, ...doc.data() };
      if (attempt.grammarSetId === set.id) attempts.push(attempt);
    });
    attempts.sort((a, b) => new Date(b.completedAt || b.createdAt || 0).getTime() - new Date(a.completedAt || a.createdAt || 0).getTime());
    res.json({ set, attempts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app2.post("/api/game-sessions", async (req, res) => {
  try {
    const payload = req.body;
    const id = `session-${Date.now()}`;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    let assignment = null;
    if (payload.assignmentId) {
      const assignmentDoc = await adminDb.collection("assignments").doc(String(payload.assignmentId)).get();
      assignment = assignmentDoc.exists ? assignmentDoc.data() : null;
      if (!assignment) {
        const assignmentsSnapshot = await adminDb.collection("assignments").get();
        assignmentsSnapshot.forEach((doc) => {
          const data = { id: doc.id, ...doc.data() };
          if (!assignment && data.id === String(payload.assignmentId)) {
            assignment = data;
          }
        });
      }
    }
    let inferredClass = null;
    if (!payload.classId && !assignment && payload.vocabSetId) {
      const assignmentsSnapshot = await adminDb.collection("assignments").get();
      const uniqueBySet = /* @__PURE__ */ new Map();
      assignmentsSnapshot.forEach((doc) => {
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app2.put("/api/game-sessions/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const payload = req.body;
    const docRef = adminDb.collection("game_sessions").doc(id);
    const existing = await docRef.get();
    if (!existing.exists) {
      return res.status(404).json({ error: "Session kh\xF4ng t\u1ED3n t\u1EA1i." });
    }
    const endedAt = payload.endedAt || (/* @__PURE__ */ new Date()).toISOString();
    const startedAt = existing.data()?.startedAt || payload.startedAt || endedAt;
    const durationMs = Math.max(0, Number(payload.durationMs ?? new Date(endedAt).getTime() - new Date(startedAt).getTime()));
    const totalQuestions = Math.max(0, Number(payload.totalQuestions || 0));
    const correctAnswers = Math.max(0, Number(payload.correctAnswers || 0));
    const sanitizedAnswerDetails = Array.isArray(payload.answerDetails) ? payload.answerDetails.slice(0, 200).map((item, index) => ({
      questionIndex: Number.isFinite(Number(item.questionIndex)) ? Number(item.questionIndex) : index,
      wordId: item.wordId || "",
      word: item.word || "",
      questionText: item.questionText || "",
      correctAnswer: item.correctAnswer || "",
      userAnswer: item.userAnswer || "",
      selectedAnswer: item.selectedAnswer || "",
      isCorrect: Boolean(item.isCorrect),
      timeSpentMs: item.timeSpentMs ? Number(item.timeSpentMs) : void 0,
      options: Array.isArray(item.options) ? item.options.slice(0, 6).map((option) => String(option).slice(0, 160)) : void 0
    })) : [];
    const updatedSession = {
      ...existing.data(),
      ...payload,
      answerDetails: sanitizedAnswerDetails,
      totalQuestions,
      correctAnswers,
      incorrectAnswers: Math.max(0, Number(payload.incorrectAnswers || 0)),
      accuracy: totalQuestions > 0 ? Math.round(correctAnswers / totalQuestions * 100) : 0,
      durationMs,
      durationSeconds: Math.round(durationMs / 1e3),
      status: "completed",
      endedAt,
      completedAt: endedAt,
      expiresAt: addDaysIso(endedAt, ACTIVITY_TTL_DAYS)
    };
    await docRef.set(updatedSession);
    res.json(updatedSession);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app2.post("/api/pronunciation-attempts", async (req, res) => {
  try {
    const payload = req.body || {};
    const now = (/* @__PURE__ */ new Date()).toISOString();
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app2.get("/api/results", authenticateUser, async (req, res) => {
  try {
    const snapshot = await adminDb.collection("game_sessions").get();
    const grammarAttemptsSnapshot = await adminDb.collection("grammar_attempts").get();
    const grammarSetsById = await getGrammarSetMap();
    const vocabSetsById = await getVocabSetMap();
    const list = [];
    const cutoff = Date.now() - ACTIVITY_TTL_MS;
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.completedAt && !isExpiredActivity(data) && new Date(getActivityTime(data)).getTime() >= cutoff) {
        const gradeClass = getLessonGradeClass(vocabSetsById.get(data.vocabSetId));
        list.push({
          ...data,
          id: data.id || doc.id,
          classId: data.classId || gradeClass.classId || "",
          className: data.className || gradeClass.className || ""
        });
      }
    });
    grammarAttemptsSnapshot.forEach((doc) => {
      const data = { id: doc.id, ...doc.data() };
      if (data.status !== "completed" || !data.completedAt) return;
      if (isExpiredActivity(data)) return;
      if (new Date(getActivityTime(data)).getTime() < cutoff) return;
      list.push(grammarAttemptToActivity(data, grammarSetsById.get(data.grammarSetId)));
    });
    list.sort((a, b) => new Date(getActivityTime(b)).getTime() - new Date(getActivityTime(a)).getTime());
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
    let customClaimWarning = "";
    try {
      await adminAuth.setCustomUserClaims(targetUserId, { role });
    } catch (claimErr) {
      customClaimWarning = claimErr?.message || "Could not update Firebase custom claims.";
      console.warn(`Could not update custom claims for ${targetUserId}: ${customClaimWarning}`);
    }
    await logAuditAction(
      req.user.id,
      req.user.name,
      req.user.email,
      "UPDATE_USER_ROLE",
      `\u0110\xE3 thay \u0111\u1ED5i vai tr\xF2 c\u1EE7a user "${userData?.name}" (${userData?.email}) t\u1EEB ${userData?.role} th\xE0nh ${role}`
    );
    res.json({ success: true, userId: targetUserId, role, customClaimWarning });
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
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app2.use(vite.middlewares);
    console.log("Vite development server loaded as middleware.");
  } else {
    const distPath = import_path3.default.join(process.cwd(), "dist", "client");
    app2.use(import_express.default.static(distPath));
    app2.get("*", (req, res) => {
      res.sendFile(import_path3.default.join(distPath, "index.html"));
    });
    console.log("Production static build routing active.");
  }
  app2.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
  firebaseDiagnosticReady.then(async () => {
    await preSeedDb();
  }).catch((err) => {
    console.error("Background Firebase startup tasks failed", err);
  });
}
function getVocabVisibility(set) {
  if (set?.visibility === "assignment" || set?.visibility === "public" || set?.visibility === "draft") {
    return set.visibility;
  }
  if (set?.status === "private") return "assignment";
  if (set?.status === "public") return "public";
  return "draft";
}
function toLegacyStatus(visibility) {
  return visibility === "assignment" ? "private" : visibility;
}
function createShareToken() {
  return import_crypto.default.randomBytes(16).toString("hex");
}
function normalizePersonName(value) {
  return String(value || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/\s+/g, " ");
}
function setUniqueClass(map, key, classInfo) {
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
function normalizeVocabSetForSave(payload, existing = {}) {
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
function getGrammarVisibility(set) {
  if (set?.visibility === "assignment" || set?.visibility === "public" || set?.visibility === "draft") {
    return set.visibility;
  }
  if (set?.status === "private") return "assignment";
  if (set?.status === "public") return "public";
  return "draft";
}
function safeText(value, max = 2e3) {
  return String(value || "").normalize("NFKC").trim().slice(0, max);
}
function makeId(prefix) {
  return `${prefix}-${Date.now()}-${import_crypto.default.randomBytes(4).toString("hex")}`;
}
function fisherYates(input) {
  const items = [...input];
  for (let i = items.length - 1; i > 0; i--) {
    const j = import_crypto.default.randomInt(0, i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
function normalizeGrammarQuestion(question, index) {
  const questionId = question.id || makeId(`grammar-question-${index + 1}`);
  const rawOptions = Array.isArray(question.options) ? question.options : [];
  const options = rawOptions.slice(0, 4).map((option, optionIndex) => ({
    id: option.id || `${questionId}-option-${optionIndex + 1}`,
    text: safeText(option.text, 1e3),
    originalPosition: Number.isFinite(Number(option.originalPosition)) ? Number(option.originalPosition) : optionIndex + 1
  }));
  return {
    id: questionId,
    questionText: safeText(question.questionText || question.question, 4e3),
    options,
    correctOptionId: String(question.correctOptionId || ""),
    explanation: safeText(question.explanation, 6e3),
    score: Math.max(1, Number(question.score || 1)),
    position: Number.isFinite(Number(question.position)) ? Number(question.position) : index + 1
  };
}
function validateGrammarQuestion(question, index) {
  const errors = [];
  if (!question.questionText) errors.push(`C\xE2u ${index + 1}: thi\u1EBFu n\u1ED9i dung c\xE2u h\u1ECFi.`);
  if (!question.explanation) errors.push(`C\xE2u ${index + 1}: thi\u1EBFu l\u1EDDi gi\u1EA3i th\xEDch.`);
  if (!Array.isArray(question.options) || question.options.length !== 4) {
    errors.push(`C\xE2u ${index + 1}: c\u1EA7n \u0111\xFAng 4 ph\u01B0\u01A1ng \xE1n.`);
  }
  question.options?.forEach((option, optionIndex) => {
    if (!option.text) errors.push(`C\xE2u ${index + 1}: ph\u01B0\u01A1ng \xE1n ${optionIndex + 1} \u0111ang tr\u1ED1ng.`);
  });
  if (!question.correctOptionId || !question.options?.some((option) => option.id === question.correctOptionId)) {
    errors.push(`C\xE2u ${index + 1}: \u0111\xE1p \xE1n \u0111\xFAng kh\xF4ng h\u1EE3p l\u1EC7.`);
  }
  const normalizedOptions = (question.options || []).map((option) => normalizePersonName(option.text));
  if (new Set(normalizedOptions).size !== normalizedOptions.length) {
    errors.push(`C\xE2u ${index + 1}: c\xF3 ph\u01B0\u01A1ng \xE1n b\u1ECB tr\xF9ng n\u1ED9i dung.`);
  }
  return errors;
}
function normalizeGrammarSetForSave(payload, existing = {}, user) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const questions = (Array.isArray(payload.questions) ? payload.questions : []).map(normalizeGrammarQuestion).sort((a, b) => a.position - b.position).map((question, index) => ({ ...question, position: index + 1 }));
  const errors = questions.flatMap(validateGrammarQuestion);
  const duplicateQuestions = /* @__PURE__ */ new Map();
  questions.forEach((question, index) => {
    const key = normalizePersonName(question.questionText);
    if (!key) return;
    if (duplicateQuestions.has(key)) {
      errors.push(`C\xE2u ${index + 1}: n\u1ED9i dung c\xE2u h\u1ECFi tr\xF9ng v\u1EDBi c\xE2u ${duplicateQuestions.get(key)}.`);
    } else {
      duplicateQuestions.set(key, index + 1);
    }
  });
  if (questions.length === 0) errors.push("B\xE0i ng\u1EEF ph\xE1p c\u1EA7n \xEDt nh\u1EA5t m\u1ED9t c\xE2u h\u1ECFi h\u1EE3p l\u1EC7.");
  if (errors.length > 0) {
    const err = new Error(errors.join(" "));
    err.status = 400;
    err.details = errors;
    throw err;
  }
  const visibility = getGrammarVisibility(payload);
  const normalized = {
    ...existing,
    ...payload,
    id: payload.id || existing.id,
    title: safeText(payload.title || existing.title, 240),
    description: safeText(payload.description || existing.description, 2e3),
    gradeLevel: safeText(payload.gradeLevel || existing.gradeLevel || "L\u1EDBp 3", 80),
    subject: safeText(payload.subject || existing.subject || "English Grammar", 120),
    topic: safeText(payload.topic || existing.topic || "", 160),
    tags: Array.isArray(payload.tags) ? payload.tags.map((tag) => safeText(tag, 60)).filter(Boolean).slice(0, 12) : [],
    visibility,
    status: visibility === "assignment" ? "private" : visibility,
    timeLimitMinutes: Math.max(0, Number(payload.timeLimitMinutes || 0)),
    maxAttempts: Math.max(1, Number(payload.maxAttempts || 1)),
    shuffleQuestions: payload.shuffleQuestions !== false,
    shuffleOptions: payload.shuffleOptions !== false,
    showExplanationImmediately: Boolean(payload.showExplanationImmediately),
    showReviewAfterSubmit: payload.showReviewAfterSubmit !== false,
    createdBy: existing.createdBy || user.id,
    creatorName: existing.creatorName || user.name,
    createdAt: existing.createdAt || now,
    updatedAt: now,
    questions
  };
  if (visibility === "assignment") {
    const token = existing.shareToken || existing.assignmentSlug || payload.shareToken || payload.assignmentSlug || createShareToken();
    normalized.shareToken = String(token).replace(/^grammar-/, "");
    normalized.assignmentSlug = normalized.shareToken;
  } else {
    delete normalized.shareToken;
    delete normalized.assignmentSlug;
  }
  return normalized;
}
function canManageGrammarSet(user, set) {
  return user?.role === "super_admin" || set.createdBy === user?.id;
}
function sanitizeGrammarSetForStudent(set) {
  return {
    ...set,
    questions: (set.questions || []).map((question) => ({
      id: question.id,
      questionText: question.questionText,
      options: question.options.map((option) => ({
        id: option.id,
        text: option.text,
        originalPosition: option.originalPosition
      })),
      score: question.score,
      position: question.position
    }))
  };
}
function sanitizeAttemptForStudent(attempt, includeReview = false) {
  const base = {
    ...attempt,
    questions: (attempt.questions || []).map((question) => ({
      id: question.id,
      questionId: question.questionId,
      displayPosition: question.displayPosition,
      questionSnapshot: question.questionSnapshot,
      scoreSnapshot: question.scoreSnapshot,
      optionsSnapshot: question.optionsSnapshot.map((option) => ({
        id: option.id,
        text: option.text,
        originalPosition: option.originalPosition
      }))
    })),
    answers: attempt.answers || []
  };
  if (includeReview) return attempt;
  return base;
}
async function getGrammarSetOr404(id) {
  const doc = await adminDb.collection("grammar_sets").doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}
async function getGrammarAttemptOr404(id) {
  const doc = await adminDb.collection("grammar_attempts").doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}
start().catch((err) => {
  console.error("Failed to start fullstack server", err);
});
//# sourceMappingURL=server.cjs.map
