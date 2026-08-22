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
var import_express5 = __toESM(require("express"), 1);
var import_path5 = __toESM(require("path"), 1);
var import_crypto3 = __toESM(require("crypto"), 1);

// src/lib/grammarAnswers.ts
var GRAMMAR_TEXT_GRADING_VERSION = 2;
var APOSTROPHE_VARIANTS = /[\u02BC\u2018\u2019\u201B\u2032\uFF07]/gu;
var INVISIBLE_FORMATTING = /[\u200B-\u200D\u2060\uFEFF]/gu;
var SPACED_PUNCTUATION = /\s*([.,;:!?])\s*/gu;
function normalizeGrammarTextAnswer(value) {
  return String(value ?? "").normalize("NFKC").replace(APOSTROPHE_VARIANTS, "'").replace(INVISIBLE_FORMATTING, "").trim().replace(/\s+/gu, " ").replace(SPACED_PUNCTUATION, "$1").toLocaleLowerCase("vi-VN").slice(0, 4e3);
}
function isGrammarTextAnswerCorrect(studentAnswer, correctAnswer, acceptedAnswers = []) {
  const normalizedStudentAnswer = normalizeGrammarTextAnswer(studentAnswer);
  if (!normalizedStudentAnswer) return false;
  const alternatives = Array.isArray(acceptedAnswers) ? acceptedAnswers : [];
  return [correctAnswer, ...alternatives].some(
    (answer) => normalizeGrammarTextAnswer(answer) === normalizedStudentAnswer
  );
}

// server.ts
var import_fs5 = __toESM(require("fs"), 1);
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

// src/lib/storage/sqliteConfig.ts
var import_node_path = __toESM(require("node:path"), 1);
var DEFAULT_SQLITE_PATH = "/home/qzmivzbj/app-data/vhomework/app.sqlite";
function parseBoolean(name, fallback) {
  const raw = process.env[name];
  if (raw === void 0 || raw.trim() === "") return fallback;
  const normalized = raw.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  throw new Error(`${name} must be one of true/false, 1/0, yes/no, or on/off.`);
}
function parseInteger(name, fallback, minimum, maximum) {
  const raw = process.env[name];
  if (raw === void 0 || raw.trim() === "") return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}.`);
  }
  return parsed;
}
function resolveDriver(production) {
  const raw = process.env.SQLITE_DRIVER?.trim().toLowerCase();
  if (!raw) {
    if (production) {
      throw new Error("SQLITE_DRIVER is required when NODE_ENV=production and STORAGE_MODE=sqlite.");
    }
    return "better-sqlite3";
  }
  if (raw === "better-sqlite3" || raw === "better_sqlite3" || raw === "native") {
    return "better-sqlite3";
  }
  if (raw === "sqljs" || raw === "sql.js") return "sqljs";
  throw new Error(`Unsupported SQLITE_DRIVER "${raw}".`);
}
function resolveDatabasePath(production) {
  const configured = process.env.SQLITE_DB_PATH?.trim();
  if (production && !configured) {
    throw new Error("SQLITE_DB_PATH is required when NODE_ENV=production and STORAGE_MODE=sqlite.");
  }
  const selected = configured || DEFAULT_SQLITE_PATH;
  return import_node_path.default.isAbsolute(selected) ? import_node_path.default.normalize(selected) : import_node_path.default.resolve(selected);
}
function resolveSQLiteStorageConfig() {
  const production = process.env.NODE_ENV === "production";
  const allowCreate = parseBoolean("SQLITE_ALLOW_CREATE", !production);
  const allowJsonImport = parseBoolean("SQLITE_ALLOW_JSON_IMPORT", false);
  if (production && allowCreate) {
    throw new Error("SQLITE_ALLOW_CREATE must be false when NODE_ENV=production.");
  }
  if (production && allowJsonImport) {
    throw new Error(
      "SQLITE_ALLOW_JSON_IMPORT is not permitted during production application startup."
    );
  }
  return {
    driver: resolveDriver(production),
    dbPath: resolveDatabasePath(production),
    allowCreate,
    allowJsonImport,
    production,
    busyTimeoutMs: parseInteger("SQLITE_BUSY_TIMEOUT_MS", 1e4, 1, 12e4),
    walAutoCheckpointPages: parseInteger("SQLITE_WAL_AUTOCHECKPOINT_PAGES", 1e3, 1, 1e5),
    synchronous: process.env.SQLITE_SYNCHRONOUS?.trim().toUpperCase() === "FULL" ? "FULL" : "NORMAL"
  };
}
function redactSQLitePath(dbPath) {
  const parentName = import_node_path.default.basename(import_node_path.default.dirname(dbPath));
  return `${parentName ? `${parentName}/` : ""}${import_node_path.default.basename(dbPath)}`;
}

// src/lib/storage/sqliteInstrumentation.ts
var import_node_async_hooks = require("node:async_hooks");
var requestMetricsStorage = new import_node_async_hooks.AsyncLocalStorage();
var processMetrics = {
  queryCount: 0,
  queryDurationMs: 0,
  rowsRead: 0,
  rowsWritten: 0,
  transactionCount: 0,
  transactionDurationMs: 0,
  busyErrors: 0,
  driver: null,
  successfulWrites: 0,
  failedStatements: 0
};
function createRequestMetrics(driver) {
  return {
    queryCount: 0,
    queryDurationMs: 0,
    rowsRead: 0,
    rowsWritten: 0,
    transactionCount: 0,
    transactionDurationMs: 0,
    busyErrors: 0,
    driver
  };
}
function runWithSQLiteRequestMetrics(driver, action) {
  return requestMetricsStorage.run(createRequestMetrics(driver), action);
}
function getSQLiteRequestMetrics() {
  return requestMetricsStorage.getStore() || null;
}
function getSQLiteProcessMetrics() {
  return { ...processMetrics };
}
function isSQLiteBusyError(error) {
  const code = String(error?.code || "");
  const message = String(error?.message || "");
  return code === "SQLITE_BUSY" || code === "SQLITE_LOCKED" || /database is (?:busy|locked)/i.test(message);
}
function safeSqlLabel(sql) {
  return sql.replace(/\s+/g, " ").replace(/('[^']*'|"[^"]*")/g, "?").trim().slice(0, 180);
}
function recordSQLiteStatement(input) {
  const rowsRead = Math.max(0, Number(input.rowsRead || 0));
  const rowsWritten = Math.max(0, Number(input.rowsWritten || 0));
  const busy = input.error && isSQLiteBusyError(input.error) ? 1 : 0;
  const request = requestMetricsStorage.getStore();
  for (const target of [processMetrics, request].filter(Boolean)) {
    target.driver = input.driver;
    target.queryCount++;
    target.queryDurationMs += input.durationMs;
    target.rowsRead += rowsRead;
    target.rowsWritten += rowsWritten;
    target.busyErrors += busy;
  }
  if (rowsWritten > 0 && !input.error) processMetrics.successfulWrites += rowsWritten;
  if (input.error) processMetrics.failedStatements++;
  const slowMs = Math.max(0, Number(process.env.SQLITE_SLOW_QUERY_MS || 250));
  if (slowMs > 0 && input.durationMs >= slowMs) {
    console.warn(
      `[SQLite][slow] driver=${input.driver} durationMs=${input.durationMs.toFixed(1)} sql=${safeSqlLabel(input.sql)}`
    );
  }
}
function recordSQLiteTransaction(driver, durationMs, error) {
  const busy = error && isSQLiteBusyError(error) ? 1 : 0;
  const request = requestMetricsStorage.getStore();
  for (const target of [processMetrics, request].filter(Boolean)) {
    target.driver = driver;
    target.transactionCount++;
    target.transactionDurationMs += durationMs;
    target.busyErrors += busy;
  }
}

// src/lib/storage/sqliteStorageFactory.ts
var import_node_fs2 = __toESM(require("node:fs"), 1);
var import_node_path4 = __toESM(require("node:path"), 1);

// src/lib/storage/betterSqliteStorage.ts
var import_node_module = require("node:module");
var import_node_path2 = __toESM(require("node:path"), 1);
var require2 = (0, import_node_module.createRequire)(import_node_path2.default.join(process.cwd(), "package.json"));
function callStatement(statement, method, params) {
  return params.length > 0 ? statement[method](...params) : statement[method]();
}
async function openBetterSQLite(config) {
  const Database = require2("better-sqlite3");
  const db = new Database(config.dbPath, {
    fileMustExist: !config.allowCreate,
    timeout: config.busyTimeoutMs
  });
  const statementCache = /* @__PURE__ */ new Map();
  const configuredCacheLimit = Number(process.env.SQLITE_STATEMENT_CACHE_SIZE || 200);
  const statementCacheLimit = Number.isFinite(configuredCacheLimit) ? Math.max(10, Math.min(1e3, Math.floor(configuredCacheLimit))) : 200;
  const prepare = (sql) => {
    const cached = statementCache.get(sql);
    if (cached) {
      statementCache.delete(sql);
      statementCache.set(sql, cached);
      return cached;
    }
    const statement = db.prepare(sql);
    statementCache.set(sql, statement);
    if (statementCache.size > statementCacheLimit) {
      const oldest = statementCache.keys().next().value;
      if (oldest !== void 0) statementCache.delete(oldest);
    }
    return statement;
  };
  const adapter = {
    kind: "better-sqlite3",
    dbPath: config.dbPath,
    run(sql, params = []) {
      const startedAt = performance.now();
      let result;
      let error;
      try {
        if (params.length === 0 && /;\s*\S/.test(sql.trim().replace(/;\s*$/, ""))) {
          db.exec(sql);
          result = { changes: 0 };
        } else {
          result = callStatement(prepare(sql), "run", params);
        }
        return {
          changes: Number(result?.changes || 0),
          lastInsertRowid: result?.lastInsertRowid
        };
      } catch (err) {
        error = err;
        throw err;
      } finally {
        recordSQLiteStatement({
          driver: "better-sqlite3",
          sql,
          durationMs: performance.now() - startedAt,
          rowsWritten: Number(result?.changes || 0),
          error
        });
      }
    },
    all(sql, params = []) {
      const startedAt = performance.now();
      let rows = [];
      let error;
      try {
        rows = callStatement(prepare(sql), "all", params);
        return rows;
      } catch (err) {
        error = err;
        throw err;
      } finally {
        recordSQLiteStatement({
          driver: "better-sqlite3",
          sql,
          durationMs: performance.now() - startedAt,
          rowsRead: rows.length,
          error
        });
      }
    },
    one(sql, params = []) {
      const startedAt = performance.now();
      let row;
      let error;
      try {
        row = callStatement(prepare(sql), "get", params);
        return row;
      } catch (err) {
        error = err;
        throw err;
      } finally {
        recordSQLiteStatement({
          driver: "better-sqlite3",
          sql,
          durationMs: performance.now() - startedAt,
          rowsRead: row === void 0 ? 0 : 1,
          error
        });
      }
    },
    transaction(action, mode = "deferred") {
      const startedAt = performance.now();
      let error;
      try {
        const transaction = db.transaction(action);
        return mode === "immediate" ? transaction.immediate() : transaction();
      } catch (err) {
        error = err;
        throw err;
      } finally {
        recordSQLiteTransaction("better-sqlite3", performance.now() - startedAt, error);
      }
    },
    async backup(destinationPath) {
      await db.backup(destinationPath);
    },
    close() {
      statementCache.clear();
      if (db.open) db.close();
    }
  };
  return adapter;
}

// src/lib/storage/sqlJsStorage.ts
var import_node_fs = __toESM(require("node:fs"), 1);
var import_node_path3 = __toESM(require("node:path"), 1);
var import_node_module2 = require("node:module");
var require3 = (0, import_node_module2.createRequire)(import_node_path3.default.join(process.cwd(), "package.json"));
async function openSqlJsSQLite(config) {
  const walPath = `${config.dbPath}-wal`;
  if (import_node_fs.default.existsSync(walPath) && import_node_fs.default.statSync(walPath).size > 0) {
    throw new Error(
      "sql.js rollback refused: a non-empty SQLite WAL sidecar exists. Run the native rollback preparation command first."
    );
  }
  const initSqlJs = require3("sql.js");
  const wasmPath = require3.resolve("sql.js/dist/sql-wasm.wasm");
  const SQL = await initSqlJs({ locateFile: () => wasmPath });
  const existing = import_node_fs.default.existsSync(config.dbPath) ? import_node_fs.default.readFileSync(config.dbPath) : void 0;
  const db = existing ? new SQL.Database(existing) : new SQL.Database();
  const all2 = (sql, params = []) => {
    const startedAt = performance.now();
    const statement = db.prepare(sql);
    const rows = [];
    let error;
    try {
      statement.bind([...params]);
      while (statement.step()) rows.push(statement.getAsObject());
      return rows;
    } catch (err) {
      error = err;
      throw err;
    } finally {
      statement.free();
      recordSQLiteStatement({
        driver: "sqljs",
        sql,
        durationMs: performance.now() - startedAt,
        rowsRead: rows.length,
        error
      });
    }
  };
  return {
    kind: "sqljs",
    dbPath: config.dbPath,
    run(sql, params = []) {
      const startedAt = performance.now();
      let error;
      try {
        if (params.length === 0 && /;\s*\S/.test(sql.trim().replace(/;\s*$/, ""))) {
          db.exec(sql);
        } else {
          db.run(sql, [...params]);
        }
        const changes = Number(db.getRowsModified?.() || 0);
        return { changes };
      } catch (err) {
        error = err;
        throw err;
      } finally {
        recordSQLiteStatement({
          driver: "sqljs",
          sql,
          durationMs: performance.now() - startedAt,
          error
        });
      }
    },
    all: all2,
    one(sql, params = []) {
      return all2(sql, params)[0];
    },
    transaction(action) {
      const startedAt = performance.now();
      let committed = false;
      let error;
      try {
        db.run("BEGIN TRANSACTION");
        const result = action();
        db.run("COMMIT");
        committed = true;
        return result;
      } catch (err) {
        error = err;
        if (!committed) {
          try {
            db.run("ROLLBACK");
          } catch {
          }
        }
        throw err;
      } finally {
        recordSQLiteTransaction("sqljs", performance.now() - startedAt, error);
      }
    },
    exportBytes() {
      return db.export();
    },
    close() {
      db.close();
    }
  };
}

// src/lib/storage/sqliteStorageFactory.ts
async function openSQLiteDriver(config) {
  const exists = import_node_fs2.default.existsSync(config.dbPath);
  if (!exists && !config.allowCreate) {
    throw new Error(`SQLite database file does not exist: ${import_node_path4.default.basename(config.dbPath)}`);
  }
  if (!exists && config.allowCreate) {
    import_node_fs2.default.mkdirSync(import_node_path4.default.dirname(config.dbPath), { recursive: true });
  }
  if (config.driver === "better-sqlite3") return openBetterSQLite(config);
  if (config.driver === "sqljs") return openSqlJsSQLite(config);
  throw new Error(`Unsupported SQLite driver: ${String(config.driver)}`);
}

// src/lib/sqliteStorage.ts
var MIGRATION_ID = "import-db-json-v1";
var BASE_SCHEMA_MIGRATION_ID = "base-schema-v1";
var ACTIVITY_EXPIRY_MIGRATION_ID = "activity-expiry-columns-v1";
var GRAMMAR_ATTEMPT_QUERY_MIGRATION_ID = "grammar-attempt-query-columns-v1";
var NATIVE_HOT_QUERY_MIGRATION_ID = "native-hot-query-columns-v2";
var LEARNING_HISTORY_SCHEMA_MIGRATION_ID = "learning-history-schema-v1";
var GUEST_CAPABILITY_STORAGE_MIGRATION_ID = "guest-capability-physical-v1";
var LISTENING_SCHEMA_MIGRATION_ID = "listening-five-part-schema-v1";
var MOVER_READING_WRITING_SCHEMA_MIGRATION_ID = "mover-reading-writing-schema-v1";
var sqliteDb = null;
var sqliteConfig = null;
var sqliteDbPath = "";
var sqliteReady = false;
var sqliteLastError = null;
var sqliteLastMigration = null;
var initPromise = null;
var transactionDepth = 0;
var collectionTableMap = {
  users: "users",
  guest_profiles: "guest_profiles",
  guestprofiles: "guest_profiles",
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
  game_session_actions: "game_session_actions",
  gamesessionactions: "game_session_actions",
  gameresults: "game_results",
  leaderboard_events: "leaderboard_events",
  leaderboardevents: "leaderboard_events",
  pronunciation_attempts: "pronunciation_attempts",
  pronunciationattempts: "pronunciation_attempts",
  learning_attempts: "learning_attempts",
  learningattempts: "learning_attempts",
  attempt_details: "attempt_details",
  attemptdetails: "attempt_details",
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
  listening_sets: "listening_sets",
  listeningsets: "listening_sets",
  listening_set_versions: "listening_set_versions",
  listeningsetversions: "listening_set_versions",
  listening_assets: "listening_assets",
  listeningassets: "listening_assets",
  listening_asset_usages: "listening_asset_usages",
  listeningassetusages: "listening_asset_usages",
  listening_attempts: "listening_attempts",
  listeningattempts: "listening_attempts",
  listening_attempt_details: "listening_attempt_details",
  listeningattemptdetails: "listening_attempt_details",
  mover_reading_sets: "mover_reading_sets",
  moverreadingsets: "mover_reading_sets",
  mover_reading_set_versions: "mover_reading_set_versions",
  moverreadingsetversions: "mover_reading_set_versions",
  mover_reading_asset_usages: "mover_reading_asset_usages",
  moverreadingassetusages: "mover_reading_asset_usages",
  mover_reading_attempts: "mover_reading_attempts",
  moverreadingattempts: "mover_reading_attempts",
  mover_reading_attempt_details: "mover_reading_attempt_details",
  moverreadingattemptdetails: "mover_reading_attempt_details",
  audit_logs: "audit_logs",
  auditlogs: "audit_logs",
  settings: "settings"
};
var sqlQueryFieldMap = {
  users: {
    id: "id",
    email: "email",
    role: "role",
    createdAt: "created_at",
    updatedAt: "updated_at"
  },
  guest_profiles: {
    id: "id",
    normalizedName: "normalized_name",
    status: "status",
    createdAt: "created_at",
    updatedAt: "updated_at",
    lastActiveAt: "last_active_at"
  },
  class_members: {
    id: "id",
    classId: "class_id",
    userId: "user_id",
    role: "role",
    createdAt: "created_at"
  },
  assignments: {
    id: "id",
    classId: "class_id",
    userId: "user_id",
    vocabSetId: "vocab_set_id",
    gameId: "game_id",
    resourceType: "resource_type",
    resourceId: "resource_id",
    resourceTitle: "resource_title",
    dueDate: "due_date",
    createdAt: "created_at",
    updatedAt: "updated_at"
  },
  game_results: {
    id: "id",
    assignmentId: "assignment_id",
    userId: "user_id",
    studentId: "user_id",
    gameId: "game_id",
    vocabSetId: "vocab_set_id",
    score: "score",
    guestId: "guest_id",
    ownerKey: "owner_key",
    status: "status",
    clientRunId: "client_run_id",
    sourceType: "source_type",
    sourceId: "source_id",
    createdAt: "created_at",
    completedAt: "completed_at",
    expiresAt: "expires_at"
  },
  game_session_actions: {
    id: "id",
    sessionId: "session_id",
    sequence: "sequence",
    type: "action_type",
    createdAt: "created_at",
    updatedAt: "updated_at"
  },
  leaderboard_events: {
    id: "id",
    sourceType: "source_type",
    sourceId: "source_id",
    studentKey: "student_key",
    classId: "class_id",
    vocabSetId: "vocab_set_id",
    score: "score",
    completedAt: "completed_at",
    expiresAt: "expires_at"
  },
  pronunciation_attempts: {
    id: "id",
    ownerKey: "owner_key",
    userId: "user_id",
    studentId: "student_id",
    guestId: "guest_id",
    vocabularySetId: "vocabulary_set_id",
    wordId: "word_id",
    gameSessionId: "game_session_id",
    gameId: "game_id",
    score: "score",
    playedAt: "played_at",
    createdAt: "created_at"
  },
  learning_attempts: {
    id: "attempt_id",
    attemptId: "attempt_id",
    sourceRecordId: "source_record_id",
    clientRunId: "client_run_id",
    sourceType: "source_type",
    studentType: "student_type",
    userId: "user_id",
    guestId: "guest_id",
    ownerKey: "owner_key",
    ownershipStatus: "ownership_status",
    classId: "class_id",
    assignmentId: "assignment_id",
    lessonId: "lesson_id",
    lessonType: "lesson_type",
    gameId: "game_id",
    score: "score",
    activityAt: "activity_at",
    studyDate: "study_date",
    completedAt: "completed_at",
    attemptStatus: "attempt_status",
    attemptNumber: "attempt_number",
    detailStatus: "detail_status",
    normalizationStatus: "normalization_status",
    createdAt: "created_at",
    updatedAt: "updated_at"
  },
  attempt_details: {
    id: "attempt_id",
    attemptId: "attempt_id",
    clientRunId: "client_run_id",
    sourceType: "source_type",
    expiresAt: "expires_at",
    createdAt: "created_at",
    updatedAt: "updated_at"
  },
  grammar_attempts: {
    id: "id",
    grammarSetId: "grammar_set_id",
    userId: "user_id",
    guestId: "guest_id",
    status: "status",
    createdAt: "created_at",
    completedAt: "completed_at",
    updatedAt: "updated_at"
  },
  listening_sets: {
    id: "id",
    ownerId: "owner_id",
    status: "status",
    visibility: "visibility",
    publishedVersionId: "published_version_id",
    createdAt: "created_at",
    updatedAt: "updated_at"
  },
  listening_set_versions: {
    id: "id",
    setId: "set_id",
    versionNumber: "version_number",
    status: "status",
    createdAt: "created_at",
    updatedAt: "updated_at"
  },
  listening_assets: {
    id: "id",
    ownerId: "owner_id",
    kind: "kind",
    status: "status",
    createdAt: "created_at",
    updatedAt: "updated_at"
  },
  listening_asset_usages: {
    id: "id",
    assetId: "asset_id",
    setId: "set_id",
    versionId: "version_id",
    createdAt: "created_at"
  },
  listening_attempts: {
    id: "id",
    ownerKey: "owner_key",
    userId: "user_id",
    guestId: "guest_id",
    setId: "set_id",
    versionId: "version_id",
    assignmentId: "assignment_id",
    clientRunId: "client_run_id",
    score: "score",
    completedAt: "completed_at",
    createdAt: "created_at",
    updatedAt: "updated_at"
  },
  listening_attempt_details: {
    id: "id",
    attemptId: "attempt_id",
    createdAt: "created_at",
    updatedAt: "updated_at"
  },
  mover_reading_sets: {
    id: "id",
    ownerId: "owner_id",
    status: "status",
    visibility: "visibility",
    publishedVersionId: "published_version_id",
    createdAt: "created_at",
    updatedAt: "updated_at"
  },
  mover_reading_set_versions: {
    id: "id",
    setId: "set_id",
    versionNumber: "version_number",
    status: "status",
    createdAt: "created_at",
    updatedAt: "updated_at"
  },
  mover_reading_asset_usages: {
    id: "id",
    assetId: "asset_id",
    setId: "set_id",
    versionId: "version_id",
    createdAt: "created_at"
  },
  mover_reading_attempts: {
    id: "id",
    ownerKey: "owner_key",
    userId: "user_id",
    guestId: "guest_id",
    setId: "set_id",
    versionId: "version_id",
    assignmentId: "assignment_id",
    clientRunId: "client_run_id",
    score: "score",
    completedAt: "completed_at",
    createdAt: "created_at",
    updatedAt: "updated_at"
  },
  mover_reading_attempt_details: {
    id: "id",
    attemptId: "attempt_id",
    createdAt: "created_at",
    updatedAt: "updated_at"
  },
  audit_logs: {
    id: "id",
    userId: "user_id",
    action: "action",
    timestamp: "timestamp"
  }
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
function parseNullableJson(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function toJsonColumn(value) {
  if (value === void 0 || value === null || value === "") return null;
  if (typeof value === "string") {
    try {
      JSON.parse(value);
      return value;
    } catch {
      return JSON.stringify(value);
    }
  }
  return JSON.stringify(value);
}
function firstDefined(data, ...keys) {
  for (const key of keys) {
    if (data?.[key] !== void 0) return data[key];
  }
  return void 0;
}
function optionalText(value) {
  if (value === void 0 || value === null) return null;
  const normalized = String(value).trim();
  return normalized || null;
}
function finiteNumber(value, fallback = 0) {
  const number2 = Number(value);
  return Number.isFinite(number2) ? number2 : fallback;
}
function nonNegativeNumber(value, fallback = 0) {
  return Math.max(0, finiteNumber(value, fallback));
}
function nonNegativeInteger(value, fallback = 0) {
  return Math.floor(nonNegativeNumber(value, fallback));
}
var GUEST_CAPABILITY_FIELDS = [
  "accessToken",
  "access_token",
  "guestAccessToken",
  "guest_access_token",
  "guestAccessTokenHash",
  "guest_access_token_hash",
  "accessTokenHash",
  "access_token_hash",
  "accessTokenVersion",
  "access_token_version",
  "accessTokenCreatedAt",
  "access_token_created_at"
];
function withoutGuestCapabilityFields(data) {
  const sanitized = data && typeof data === "object" && !Array.isArray(data) ? { ...data } : {};
  for (const field of GUEST_CAPABILITY_FIELDS) delete sanitized[field];
  return sanitized;
}
function guestProfileFromRow(row) {
  const data = withoutGuestCapabilityFields(parseJson(row.data_json));
  return {
    ...data,
    id: row.id
  };
}
function learningAttemptFromRow(row) {
  return {
    id: row.attempt_id,
    attemptId: row.attempt_id,
    sourceRecordId: row.source_record_id,
    clientRunId: row.client_run_id,
    sourceType: row.source_type,
    studentType: row.student_type,
    userId: row.user_id,
    guestId: row.guest_id,
    ownerKey: row.owner_key,
    ownershipStatus: row.ownership_status,
    studentNameSnapshot: row.student_name_snapshot,
    classId: row.class_id,
    classNameSnapshot: row.class_name_snapshot,
    assignmentId: row.assignment_id,
    assignmentTitleSnapshot: row.assignment_title_snapshot,
    assignmentDueAtSnapshot: row.assignment_due_at_snapshot,
    lessonId: row.lesson_id,
    lessonTitleSnapshot: row.lesson_title_snapshot,
    lessonType: row.lesson_type,
    gameId: row.game_id,
    gameTitleSnapshot: row.game_title_snapshot,
    score: Number(row.score || 0),
    rawScore: Number(row.raw_score || 0),
    maxScore: Number(row.max_score || 0),
    correctCount: Number(row.correct_count || 0),
    incorrectCount: Number(row.incorrect_count || 0),
    unansweredCount: Number(row.unanswered_count || 0),
    mistakeCount: Number(row.mistake_count || 0),
    totalQuestions: Number(row.total_questions || 0),
    startedAt: row.started_at,
    completedAt: row.completed_at,
    activityAt: row.activity_at,
    studyDate: row.study_date,
    durationSeconds: Number(row.duration_seconds || 0),
    attemptStatus: row.attempt_status,
    attemptNumber: Number(row.attempt_number || 0),
    schemaVersion: Number(row.schema_version || 0),
    detailStatus: row.detail_status,
    normalizationStatus: row.normalization_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
function attemptDetailFromRow(row) {
  return {
    id: row.attempt_id,
    attemptId: row.attempt_id,
    clientRunId: row.client_run_id,
    sourceType: row.source_type,
    answerDetails: parseNullableJson(row.answer_details_json),
    questionSnapshots: parseNullableJson(row.question_snapshots_json),
    optionSnapshots: parseNullableJson(row.option_snapshots_json),
    extraDetails: parseNullableJson(row.extra_details_json),
    reviewPolicy: parseNullableJson(row.review_policy_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at,
    schemaVersion: Number(row.schema_version || 0)
  };
}
function redactSQLiteError(error) {
  let message = String(error?.message || error || "Unknown SQLite error");
  if (sqliteDbPath) {
    message = message.split(sqliteDbPath).join("<sqlite-db>").split(sqliteDbPath.replaceAll("\\", "/")).join("<sqlite-db>");
  }
  return message;
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
  if (!sqliteDb?.exportBytes || !sqliteDbPath || transactionDepth > 0) return;
  const exported = sqliteDb.exportBytes();
  ensureParentDir(sqliteDbPath);
  const tempPath = import_path.default.join(
    import_path.default.dirname(sqliteDbPath),
    `.tmp-${import_path.default.basename(sqliteDbPath)}-${process.pid}-${Date.now()}`
  );
  try {
    const fd = import_fs.default.openSync(tempPath, "w");
    try {
      import_fs.default.writeFileSync(fd, Buffer.from(exported));
      import_fs.default.fsyncSync(fd);
    } finally {
      import_fs.default.closeSync(fd);
    }
    import_fs.default.renameSync(tempPath, sqliteDbPath);
  } catch (err) {
    try {
      if (import_fs.default.existsSync(tempPath)) import_fs.default.unlinkSync(tempPath);
    } catch {
    }
    throw err;
  }
}
function run(sql, params = [], shouldPersist = true) {
  const result = getDb().run(sql, params);
  if (shouldPersist) persistDb();
  return result;
}
function all(sql, params = []) {
  return getDb().all(sql, params);
}
function one(sql, params = []) {
  return getDb().one(sql, params);
}
function withTransaction(action, mode = "deferred") {
  if (transactionDepth > 0) {
    return action();
  }
  transactionDepth++;
  let result;
  try {
    result = getDb().transaction(action, mode);
  } finally {
    transactionDepth--;
  }
  persistDb();
  return result;
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
  if (table === "learning_attempts") {
    return all("SELECT * FROM learning_attempts").map(learningAttemptFromRow);
  }
  if (table === "attempt_details") {
    return all("SELECT * FROM attempt_details").map(attemptDetailFromRow);
  }
  if (table === "guest_profiles") {
    return all("SELECT id, data_json FROM guest_profiles").map(guestProfileFromRow);
  }
  return all(`SELECT id, data_json FROM ${table}`).map((row) => ({
    id: row.id,
    ...parseJson(row.data_json)
  }));
}
function readRowsWithSqlQuery(table, filters, orderField, orderDir = "asc", limitVal) {
  const fieldMap = sqlQueryFieldMap[table];
  if (!fieldMap) return null;
  const allowedOperators = /* @__PURE__ */ new Set(["==", "!=", ">", ">=", "<", "<="]);
  if (filters.some((filter) => !fieldMap[filter.field] || !allowedOperators.has(filter.op))) return null;
  if (orderField && !fieldMap[orderField]) return null;
  const params = [];
  const whereParts = filters.map((filter) => {
    const column = fieldMap[filter.field];
    const operator = filter.op === "==" ? "=" : filter.op;
    params.push(filter.val);
    return `${column} ${operator} ?`;
  });
  const structuredTable = table === "learning_attempts" || table === "attempt_details";
  let sql = structuredTable ? `SELECT * FROM ${table}` : `SELECT id, data_json FROM ${table}`;
  if (whereParts.length) sql += ` WHERE ${whereParts.join(" AND ")}`;
  if (orderField) sql += ` ORDER BY ${fieldMap[orderField]} ${orderDir === "desc" ? "DESC" : "ASC"}`;
  if (limitVal !== void 0) {
    sql += " LIMIT ?";
    params.push(Math.max(0, Math.floor(limitVal)));
  }
  const rows = all(sql, params);
  if (table === "learning_attempts") return rows.map(learningAttemptFromRow);
  if (table === "attempt_details") return rows.map(attemptDetailFromRow);
  if (table === "guest_profiles") return rows.map(guestProfileFromRow);
  return rows.map((row) => ({
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
  if (table === "learning_attempts") {
    const row2 = one("SELECT * FROM learning_attempts WHERE attempt_id = ?", [id]);
    return row2 ? learningAttemptFromRow(row2) : void 0;
  }
  if (table === "attempt_details") {
    const row2 = one("SELECT * FROM attempt_details WHERE attempt_id = ?", [id]);
    return row2 ? attemptDetailFromRow(row2) : void 0;
  }
  if (table === "guest_profiles") {
    const row2 = one("SELECT id, data_json FROM guest_profiles WHERE id = ?", [id]);
    return row2 ? guestProfileFromRow(row2) : void 0;
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
function upsertLearningAttempt(id, data) {
  const attemptId = optionalText(firstDefined(data, "attemptId", "attempt_id", "id")) || id;
  const sourceRecordId = optionalText(firstDefined(data, "sourceRecordId", "source_record_id"));
  const sourceType = optionalText(firstDefined(data, "sourceType", "source_type")) || "";
  const ownerKey = optionalText(firstDefined(data, "ownerKey", "owner_key"));
  const clientRunId = optionalText(firstDefined(data, "clientRunId", "client_run_id"));
  const userId = optionalText(firstDefined(data, "userId", "user_id"));
  const guestId = optionalText(firstDefined(data, "guestId", "guest_id"));
  const studentType = optionalText(firstDefined(data, "studentType", "student_type")) || (ownerKey?.startsWith("guest:") ? "guest" : ownerKey ? "authenticated" : "legacy");
  const ownershipStatus = optionalText(firstDefined(data, "ownershipStatus", "ownership_status")) || (ownerKey ? "linked" : "legacy_unlinked");
  const lessonId = optionalText(firstDefined(data, "lessonId", "lesson_id")) || "";
  const lessonType = optionalText(firstDefined(data, "lessonType", "lesson_type")) || (sourceType === "grammar" ? "grammar_set" : "vocab_set");
  const gameId = optionalText(firstDefined(data, "gameId", "game_id")) || "";
  const requestedAttemptNumber = nonNegativeInteger(
    firstDefined(data, "attemptNumber", "attempt_number"),
    0
  );
  return withTransaction(() => {
    const existing = one(
      `SELECT attempt_id, source_record_id, client_run_id, source_type, student_type,
              user_id, guest_id, owner_key, ownership_status, lesson_id, lesson_type,
              game_id, attempt_number
       FROM learning_attempts
       WHERE attempt_id = ?`,
      [attemptId]
    );
    if (existing) {
      const immutablePairs = [
        ["source_record_id", existing.source_record_id, sourceRecordId],
        ["client_run_id", existing.client_run_id, clientRunId],
        ["source_type", existing.source_type, sourceType],
        ["student_type", existing.student_type, studentType],
        ["user_id", existing.user_id, userId],
        ["guest_id", existing.guest_id, guestId],
        ["owner_key", existing.owner_key, ownerKey],
        ["ownership_status", existing.ownership_status, ownershipStatus],
        ["lesson_id", existing.lesson_id, lessonId],
        ["lesson_type", existing.lesson_type, lessonType],
        ["game_id", existing.game_id, gameId]
      ];
      const mismatch = immutablePairs.find(([, current, incoming]) => (current ?? null) !== (incoming ?? null));
      if (mismatch) {
        throw new Error(`Learning attempt immutable field mismatch: ${mismatch[0]}.`);
      }
    }
    let attemptNumber = requestedAttemptNumber;
    if (existing?.attempt_number) {
      attemptNumber = Number(existing.attempt_number);
    } else if (attemptNumber <= 0) {
      if (!ownerKey) {
        attemptNumber = 1;
      } else {
        const row = one(
          `SELECT COALESCE(MAX(attempt_number), 0) AS max_attempt_number
           FROM learning_attempts
           WHERE owner_key = ? AND source_type = ? AND lesson_id = ? AND game_id = ?`,
          [ownerKey, sourceType, lessonId, gameId]
        );
        attemptNumber = Number(row?.max_attempt_number || 0) + 1;
      }
    }
    const timestamp = nowIso();
    const score = Math.max(0, Math.min(100, finiteNumber(firstDefined(data, "score"), 0)));
    const completedAt = optionalText(firstDefined(data, "completedAt", "completed_at"));
    const startedAt = optionalText(firstDefined(data, "startedAt", "started_at"));
    const activityAt = optionalText(firstDefined(data, "activityAt", "activity_at")) || completedAt || startedAt || timestamp;
    const sourceRecord = sourceRecordId || "";
    const createdAt = optionalText(firstDefined(data, "createdAt", "created_at")) || timestamp;
    const updatedAt = optionalText(firstDefined(data, "updatedAt", "updated_at")) || timestamp;
    const record = {
      attempt_id: attemptId,
      source_record_id: sourceRecord,
      client_run_id: clientRunId,
      source_type: sourceType,
      student_type: studentType,
      user_id: userId,
      guest_id: guestId,
      owner_key: ownerKey,
      ownership_status: ownershipStatus,
      student_name_snapshot: optionalText(firstDefined(data, "studentNameSnapshot", "student_name_snapshot")),
      class_id: optionalText(firstDefined(data, "classId", "class_id")),
      class_name_snapshot: optionalText(firstDefined(data, "classNameSnapshot", "class_name_snapshot")),
      assignment_id: optionalText(firstDefined(data, "assignmentId", "assignment_id")),
      assignment_title_snapshot: optionalText(firstDefined(data, "assignmentTitleSnapshot", "assignment_title_snapshot")),
      assignment_due_at_snapshot: optionalText(firstDefined(data, "assignmentDueAtSnapshot", "assignment_due_at_snapshot")),
      lesson_id: lessonId,
      lesson_title_snapshot: optionalText(firstDefined(data, "lessonTitleSnapshot", "lesson_title_snapshot")),
      lesson_type: lessonType,
      game_id: gameId,
      game_title_snapshot: optionalText(firstDefined(data, "gameTitleSnapshot", "game_title_snapshot")),
      score,
      raw_score: nonNegativeNumber(firstDefined(data, "rawScore", "raw_score"), score),
      max_score: nonNegativeNumber(firstDefined(data, "maxScore", "max_score"), 100),
      correct_count: nonNegativeInteger(firstDefined(data, "correctCount", "correct_count"), 0),
      incorrect_count: nonNegativeInteger(firstDefined(data, "incorrectCount", "incorrect_count"), 0),
      unanswered_count: nonNegativeInteger(firstDefined(data, "unansweredCount", "unanswered_count"), 0),
      mistake_count: nonNegativeInteger(firstDefined(data, "mistakeCount", "mistake_count"), 0),
      total_questions: nonNegativeInteger(firstDefined(data, "totalQuestions", "total_questions"), 0),
      started_at: startedAt,
      completed_at: completedAt,
      activity_at: activityAt,
      study_date: optionalText(firstDefined(data, "studyDate", "study_date")),
      duration_seconds: nonNegativeInteger(firstDefined(data, "durationSeconds", "duration_seconds"), 0),
      attempt_status: optionalText(firstDefined(data, "attemptStatus", "attempt_status")) || "completed",
      attempt_number: Math.max(1, attemptNumber),
      schema_version: Math.max(1, nonNegativeInteger(firstDefined(data, "schemaVersion", "schema_version"), 1)),
      detail_status: optionalText(firstDefined(data, "detailStatus", "detail_status")) || "missing",
      normalization_status: optionalText(firstDefined(data, "normalizationStatus", "normalization_status")) || "canonical",
      created_at: createdAt,
      updated_at: updatedAt
    };
    const immutableColumns = /* @__PURE__ */ new Set([
      "attempt_id",
      "source_record_id",
      "client_run_id",
      "source_type",
      "student_type",
      "user_id",
      "guest_id",
      "owner_key",
      "ownership_status",
      "lesson_id",
      "lesson_type",
      "game_id",
      "attempt_number",
      "created_at"
    ]);
    const columns = Object.keys(record);
    const updateColumns = columns.filter((column) => !immutableColumns.has(column));
    run(
      `INSERT INTO learning_attempts (${columns.join(", ")})
       VALUES (${columns.map(() => "?").join(", ")})
       ON CONFLICT(attempt_id) DO UPDATE SET
       ${updateColumns.map((column) => `${column} = excluded.${column}`).join(", ")}`,
      Object.values(record)
    );
  }, "immediate");
}
function upsertAttemptDetail(id, data) {
  const attemptId = optionalText(firstDefined(data, "attemptId", "attempt_id", "id")) || id;
  const timestamp = nowIso();
  const record = {
    attempt_id: attemptId,
    client_run_id: optionalText(firstDefined(data, "clientRunId", "client_run_id")),
    source_type: optionalText(firstDefined(data, "sourceType", "source_type")) || "",
    answer_details_json: toJsonColumn(firstDefined(data, "answerDetails", "answer_details", "answerDetailsJson", "answer_details_json")),
    question_snapshots_json: toJsonColumn(firstDefined(data, "questionSnapshots", "question_snapshots", "questionSnapshotsJson", "question_snapshots_json")),
    option_snapshots_json: toJsonColumn(firstDefined(data, "optionSnapshots", "option_snapshots", "optionSnapshotsJson", "option_snapshots_json")),
    extra_details_json: toJsonColumn(firstDefined(data, "extraDetails", "extra_details", "extraDetailsJson", "extra_details_json")),
    review_policy_json: toJsonColumn(firstDefined(data, "reviewPolicy", "review_policy", "reviewPolicyJson", "review_policy_json")),
    created_at: optionalText(firstDefined(data, "createdAt", "created_at")) || timestamp,
    updated_at: optionalText(firstDefined(data, "updatedAt", "updated_at")) || timestamp,
    expires_at: optionalText(firstDefined(data, "expiresAt", "expires_at")),
    schema_version: Math.max(1, nonNegativeInteger(firstDefined(data, "schemaVersion", "schema_version"), 1))
  };
  const columns = Object.keys(record);
  const updateColumns = columns.filter((column) => column !== "attempt_id" && column !== "created_at");
  run(
    `INSERT INTO attempt_details (${columns.join(", ")})
     VALUES (${columns.map(() => "?").join(", ")})
     ON CONFLICT(attempt_id) DO UPDATE SET
     ${updateColumns.map((column) => `${column} = excluded.${column}`).join(", ")}`,
    Object.values(record)
  );
}
function upsertPronunciationAttempt(id, data, dataJson, createdAt, updatedAt) {
  const record = {
    id,
    owner_key: optionalText(firstDefined(data, "ownerKey", "owner_key")),
    owner_type: optionalText(firstDefined(data, "ownerType", "owner_type")),
    user_id: optionalText(firstDefined(data, "userId", "user_id")),
    student_id: optionalText(firstDefined(data, "studentId", "student_id")),
    guest_id: optionalText(firstDefined(data, "guestId", "guest_id")),
    student_name: optionalText(firstDefined(data, "studentName", "student_name")),
    vocabulary_set_id: optionalText(firstDefined(data, "vocabularySetId", "vocabulary_set_id", "vocabSetId", "vocab_set_id")),
    word_id: optionalText(firstDefined(data, "wordId", "word_id")),
    target_text: optionalText(firstDefined(data, "targetText", "target_text")),
    recognized_text: optionalText(firstDefined(data, "recognizedText", "recognized_text")),
    score: Math.max(0, Math.min(100, finiteNumber(firstDefined(data, "score"), 0))),
    correct_words: nonNegativeInteger(firstDefined(data, "correctWords", "correct_words"), 0),
    total_words: nonNegativeInteger(firstDefined(data, "totalWords", "total_words"), 0),
    attempt_count: Math.max(1, nonNegativeInteger(firstDefined(data, "attemptCount", "attempt_count"), 1)),
    game_session_id: optionalText(firstDefined(data, "gameSessionId", "game_session_id")),
    game_id: optionalText(firstDefined(data, "gameId", "game_id")) || "speaking-ai",
    played_at: optionalText(firstDefined(data, "playedAt", "played_at")) || createdAt,
    created_at: createdAt,
    updated_at: updatedAt,
    data_json: dataJson
  };
  const columns = Object.keys(record);
  const updateColumns = columns.filter((column) => column !== "id" && column !== "created_at");
  run(
    `INSERT INTO pronunciation_attempts (${columns.join(", ")})
     VALUES (${columns.map(() => "?").join(", ")})
     ON CONFLICT(id) DO UPDATE SET
     ${updateColumns.map((column) => `${column} = excluded.${column}`).join(", ")}`,
    Object.values(record)
  );
}
function upsertListeningDocument(table, id, data, dataJson, createdAt, updatedAt) {
  if (table === "listening_sets") {
    run(
      `INSERT INTO listening_sets (
        id, owner_id, title, status, visibility, published_version_id,
        created_at, updated_at, data_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        owner_id = excluded.owner_id,
        title = excluded.title,
        status = excluded.status,
        visibility = excluded.visibility,
        published_version_id = excluded.published_version_id,
        updated_at = excluded.updated_at,
        data_json = excluded.data_json`,
      [
        id,
        optionalText(firstDefined(data, "ownerId", "owner_id", "createdBy")),
        optionalText(firstDefined(data, "title")),
        optionalText(firstDefined(data, "status")) || "draft",
        optionalText(firstDefined(data, "visibility")) || "draft",
        optionalText(firstDefined(data, "publishedVersionId", "published_version_id")),
        createdAt,
        updatedAt,
        dataJson
      ]
    );
    return;
  }
  if (table === "listening_set_versions") {
    run(
      `INSERT INTO listening_set_versions (
        id, set_id, version_number, status, created_at, updated_at, data_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        set_id = excluded.set_id,
        version_number = excluded.version_number,
        status = excluded.status,
        updated_at = excluded.updated_at,
        data_json = excluded.data_json`,
      [
        id,
        optionalText(firstDefined(data, "setId", "set_id")),
        Math.max(1, nonNegativeInteger(firstDefined(data, "versionNumber", "version_number"), 1)),
        optionalText(firstDefined(data, "status")) || "draft",
        createdAt,
        updatedAt,
        dataJson
      ]
    );
    return;
  }
  if (table === "listening_assets") {
    run(
      `INSERT INTO listening_assets (
        id, owner_id, kind, mime_type, storage_key, public_url, status,
        created_at, updated_at, data_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        owner_id = excluded.owner_id,
        kind = excluded.kind,
        mime_type = excluded.mime_type,
        storage_key = excluded.storage_key,
        public_url = excluded.public_url,
        status = excluded.status,
        updated_at = excluded.updated_at,
        data_json = excluded.data_json`,
      [
        id,
        optionalText(firstDefined(data, "ownerId", "owner_id")),
        optionalText(firstDefined(data, "kind")),
        optionalText(firstDefined(data, "mimeType", "mime_type")),
        optionalText(firstDefined(data, "storageKey", "storage_key")),
        optionalText(firstDefined(data, "url", "publicUrl", "public_url")),
        optionalText(firstDefined(data, "status")) || "active",
        createdAt,
        updatedAt,
        dataJson
      ]
    );
    return;
  }
  if (table === "listening_asset_usages") {
    run(
      `INSERT INTO listening_asset_usages (
        id, asset_id, set_id, version_id, entity_id, role, created_at, updated_at, data_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        asset_id = excluded.asset_id,
        set_id = excluded.set_id,
        version_id = excluded.version_id,
        entity_id = excluded.entity_id,
        role = excluded.role,
        updated_at = excluded.updated_at,
        data_json = excluded.data_json`,
      [
        id,
        optionalText(firstDefined(data, "assetId", "asset_id")),
        optionalText(firstDefined(data, "setId", "set_id")),
        optionalText(firstDefined(data, "versionId", "version_id")),
        optionalText(firstDefined(data, "entityId", "entity_id")),
        optionalText(firstDefined(data, "role")),
        createdAt,
        updatedAt,
        dataJson
      ]
    );
    return;
  }
  if (table === "listening_attempts") {
    run(
      `INSERT INTO listening_attempts (
        id, owner_key, user_id, guest_id, set_id, version_id, assignment_id,
        client_run_id, run_secret_hash, student_name, class_id, score,
        correct_count, incorrect_count, unanswered_count, started_at, completed_at,
        duration_seconds, created_at, updated_at, data_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        assignment_id = excluded.assignment_id,
        score = excluded.score,
        correct_count = excluded.correct_count,
        incorrect_count = excluded.incorrect_count,
        unanswered_count = excluded.unanswered_count,
        completed_at = excluded.completed_at,
        duration_seconds = excluded.duration_seconds,
        updated_at = excluded.updated_at,
        data_json = excluded.data_json`,
      [
        id,
        optionalText(firstDefined(data, "ownerKey", "owner_key")),
        optionalText(firstDefined(data, "userId", "user_id")),
        optionalText(firstDefined(data, "guestId", "guest_id")),
        optionalText(firstDefined(data, "setId", "set_id")),
        optionalText(firstDefined(data, "versionId", "version_id")),
        optionalText(firstDefined(data, "assignmentId", "assignment_id")),
        optionalText(firstDefined(data, "clientRunId", "client_run_id")),
        optionalText(firstDefined(data, "runSecretHash", "run_secret_hash")),
        optionalText(firstDefined(data, "studentName", "student_name")),
        optionalText(firstDefined(data, "classId", "class_id")),
        Math.max(0, Math.min(100, finiteNumber(firstDefined(data, "score"), 0))),
        nonNegativeInteger(firstDefined(data, "correctCount", "correct_count"), 0),
        nonNegativeInteger(firstDefined(data, "incorrectCount", "incorrect_count"), 0),
        nonNegativeInteger(firstDefined(data, "unansweredCount", "unanswered_count"), 0),
        optionalText(firstDefined(data, "startedAt", "started_at")) || createdAt,
        optionalText(firstDefined(data, "completedAt", "completed_at")) || updatedAt,
        nonNegativeInteger(firstDefined(data, "durationSeconds", "duration_seconds"), 0),
        createdAt,
        updatedAt,
        dataJson
      ]
    );
    return;
  }
  run(
    `INSERT INTO listening_attempt_details (id, attempt_id, created_at, updated_at, data_json)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
      attempt_id = excluded.attempt_id,
      updated_at = excluded.updated_at,
      data_json = excluded.data_json`,
    [
      id,
      optionalText(firstDefined(data, "attemptId", "attempt_id")) || id,
      createdAt,
      updatedAt,
      dataJson
    ]
  );
}
function upsertMoverReadingWritingDocument(table, id, data, dataJson, createdAt, updatedAt) {
  if (table === "mover_reading_sets") {
    run(
      `INSERT INTO mover_reading_sets (
        id, owner_id, title, status, visibility, published_version_id,
        created_at, updated_at, data_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        owner_id = excluded.owner_id,
        title = excluded.title,
        status = excluded.status,
        visibility = excluded.visibility,
        published_version_id = excluded.published_version_id,
        updated_at = excluded.updated_at,
        data_json = excluded.data_json`,
      [
        id,
        optionalText(firstDefined(data, "ownerId", "owner_id", "createdBy")),
        optionalText(firstDefined(data, "title")),
        optionalText(firstDefined(data, "status")) || "draft",
        optionalText(firstDefined(data, "visibility")) || "draft",
        optionalText(firstDefined(data, "publishedVersionId", "published_version_id")),
        createdAt,
        updatedAt,
        dataJson
      ]
    );
    return;
  }
  if (table === "mover_reading_set_versions") {
    run(
      `INSERT INTO mover_reading_set_versions (
        id, set_id, version_number, status, created_at, updated_at, data_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        set_id = excluded.set_id,
        version_number = excluded.version_number,
        status = excluded.status,
        updated_at = excluded.updated_at,
        data_json = excluded.data_json`,
      [
        id,
        optionalText(firstDefined(data, "setId", "set_id")),
        Math.max(1, nonNegativeInteger(firstDefined(data, "versionNumber", "version_number"), 1)),
        optionalText(firstDefined(data, "status")) || "published",
        createdAt,
        updatedAt,
        dataJson
      ]
    );
    return;
  }
  if (table === "mover_reading_asset_usages") {
    run(
      `INSERT INTO mover_reading_asset_usages (
        id, asset_id, set_id, version_id, entity_id, role, created_at, updated_at, data_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        asset_id = excluded.asset_id,
        set_id = excluded.set_id,
        version_id = excluded.version_id,
        entity_id = excluded.entity_id,
        role = excluded.role,
        updated_at = excluded.updated_at,
        data_json = excluded.data_json`,
      [
        id,
        optionalText(firstDefined(data, "assetId", "asset_id")),
        optionalText(firstDefined(data, "setId", "set_id")),
        optionalText(firstDefined(data, "versionId", "version_id")),
        optionalText(firstDefined(data, "entityId", "entity_id")),
        optionalText(firstDefined(data, "role")),
        createdAt,
        updatedAt,
        dataJson
      ]
    );
    return;
  }
  if (table === "mover_reading_attempts") {
    run(
      `INSERT INTO mover_reading_attempts (
        id, owner_key, user_id, guest_id, set_id, version_id, assignment_id,
        client_run_id, run_secret_hash, student_name, class_id, score,
        correct_count, incorrect_count, unanswered_count, started_at, completed_at,
        duration_seconds, created_at, updated_at, data_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        assignment_id = excluded.assignment_id,
        score = excluded.score,
        correct_count = excluded.correct_count,
        incorrect_count = excluded.incorrect_count,
        unanswered_count = excluded.unanswered_count,
        completed_at = excluded.completed_at,
        duration_seconds = excluded.duration_seconds,
        updated_at = excluded.updated_at,
        data_json = excluded.data_json`,
      [
        id,
        optionalText(firstDefined(data, "ownerKey", "owner_key")),
        optionalText(firstDefined(data, "userId", "user_id")),
        optionalText(firstDefined(data, "guestId", "guest_id")),
        optionalText(firstDefined(data, "setId", "set_id")),
        optionalText(firstDefined(data, "versionId", "version_id")),
        optionalText(firstDefined(data, "assignmentId", "assignment_id")),
        optionalText(firstDefined(data, "clientRunId", "client_run_id")),
        optionalText(firstDefined(data, "runSecretHash", "run_secret_hash")),
        optionalText(firstDefined(data, "studentName", "student_name")),
        optionalText(firstDefined(data, "classId", "class_id")),
        Math.max(0, Math.min(100, finiteNumber(firstDefined(data, "score"), 0))),
        nonNegativeInteger(firstDefined(data, "correctCount", "correct_count"), 0),
        nonNegativeInteger(firstDefined(data, "incorrectCount", "incorrect_count"), 0),
        nonNegativeInteger(firstDefined(data, "unansweredCount", "unanswered_count"), 0),
        optionalText(firstDefined(data, "startedAt", "started_at")) || createdAt,
        optionalText(firstDefined(data, "completedAt", "completed_at")) || updatedAt,
        nonNegativeInteger(firstDefined(data, "durationSeconds", "duration_seconds"), 0),
        createdAt,
        updatedAt,
        dataJson
      ]
    );
    return;
  }
  run(
    `INSERT INTO mover_reading_attempt_details (id, attempt_id, created_at, updated_at, data_json)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
      attempt_id = excluded.attempt_id,
      updated_at = excluded.updated_at,
      data_json = excluded.data_json`,
    [
      id,
      optionalText(firstDefined(data, "attemptId", "attempt_id")) || id,
      createdAt,
      updatedAt,
      dataJson
    ]
  );
}
function upsertDoc(collectionName, id, inputData) {
  const table = tableForCollection(collectionName);
  const data = { ...inputData, id };
  const dataJson = JSON.stringify(data);
  const createdAt = getTimestamp(data, "createdAt", "created_at");
  const updatedAt = data.updatedAt || data.updated_at || nowIso();
  if (table === "learning_attempts") {
    upsertLearningAttempt(id, data);
    return;
  }
  if (table === "attempt_details") {
    upsertAttemptDetail(id, data);
    return;
  }
  if (table === "pronunciation_attempts") {
    upsertPronunciationAttempt(id, data, dataJson, createdAt, updatedAt);
    return;
  }
  if (table === "listening_sets" || table === "listening_set_versions" || table === "listening_assets" || table === "listening_asset_usages" || table === "listening_attempts" || table === "listening_attempt_details") {
    upsertListeningDocument(table, id, data, dataJson, createdAt, updatedAt);
    return;
  }
  if (table === "mover_reading_sets" || table === "mover_reading_set_versions" || table === "mover_reading_asset_usages" || table === "mover_reading_attempts" || table === "mover_reading_attempt_details") {
    upsertMoverReadingWritingDocument(table, id, data, dataJson, createdAt, updatedAt);
    return;
  }
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
  if (table === "guest_profiles") {
    const accessTokenHash = optionalText(firstDefined(data, "accessTokenHash", "access_token_hash"));
    const accessTokenVersionValue = firstDefined(data, "accessTokenVersion", "access_token_version");
    const accessTokenVersion = accessTokenHash ? Math.max(1, nonNegativeInteger(accessTokenVersionValue, 1)) : null;
    const accessTokenCreatedAt = accessTokenHash ? optionalText(firstDefined(data, "accessTokenCreatedAt", "access_token_created_at")) || updatedAt : null;
    const publicDataJson = JSON.stringify(withoutGuestCapabilityFields(data));
    run(
      `INSERT INTO guest_profiles (
        id, display_name, normalized_name, status, created_at, updated_at, last_active_at,
        access_token_hash, access_token_version, access_token_created_at, data_json
      )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
        display_name = excluded.display_name,
        normalized_name = excluded.normalized_name,
        status = excluded.status,
        updated_at = excluded.updated_at,
        last_active_at = excluded.last_active_at,
        access_token_hash = COALESCE(excluded.access_token_hash, guest_profiles.access_token_hash),
        access_token_version = COALESCE(excluded.access_token_version, guest_profiles.access_token_version),
        access_token_created_at = COALESCE(excluded.access_token_created_at, guest_profiles.access_token_created_at),
        data_json = excluded.data_json`,
      [
        id,
        data.displayName || data.name || null,
        data.normalizedName || null,
        data.status || "active",
        createdAt,
        updatedAt,
        data.lastActiveAt || data.last_active_at || updatedAt,
        accessTokenHash,
        accessTokenVersion,
        accessTokenCreatedAt,
        publicDataJson
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
      `INSERT INTO assignments (
        id, class_id, user_id, vocab_set_id, game_id, resource_type, resource_id,
        resource_title, due_date, created_at, updated_at, data_json
      )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
        class_id = excluded.class_id,
        user_id = excluded.user_id,
        vocab_set_id = excluded.vocab_set_id,
        game_id = excluded.game_id,
        resource_type = excluded.resource_type,
        resource_id = excluded.resource_id,
        resource_title = excluded.resource_title,
        due_date = excluded.due_date,
        updated_at = excluded.updated_at,
        data_json = excluded.data_json`,
      [
        id,
        data.class_id || data.classId || null,
        data.user_id || data.userId || data.createdBy || null,
        data.vocab_set_id || data.vocabSetId || null,
        data.game_id || data.gameId || null,
        data.resource_type || data.resourceType || "vocabulary",
        data.resource_id || data.resourceId || data.vocab_set_id || data.vocabSetId || null,
        data.resource_title || data.resourceTitle || data.vocabSetTitle || null,
        data.due_date || data.dueDate || null,
        createdAt,
        updatedAt,
        dataJson
      ]
    );
    return;
  }
  if (table === "results") {
    run(
      `INSERT INTO results (id, assignment_id, user_id, game_id, vocab_set_id, score, correct, incorrect, created_at, expires_at, data_json)
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
  if (table === "game_results") {
    const completedAt = data.completedAt || data.endedAt || data.createdAt || createdAt;
    run(
      `INSERT INTO game_results (
        id, assignment_id, user_id, guest_id, owner_key, game_id, vocab_set_id,
        score, correct, incorrect, status, client_run_id, source_type, source_id,
        created_at, completed_at, expires_at, data_json
      )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
        assignment_id = excluded.assignment_id,
        user_id = excluded.user_id,
        guest_id = excluded.guest_id,
        owner_key = excluded.owner_key,
        game_id = excluded.game_id,
        vocab_set_id = excluded.vocab_set_id,
        score = excluded.score,
        correct = excluded.correct,
        incorrect = excluded.incorrect,
        status = excluded.status,
        client_run_id = excluded.client_run_id,
        source_type = excluded.source_type,
        source_id = excluded.source_id,
        completed_at = excluded.completed_at,
        expires_at = excluded.expires_at,
        data_json = excluded.data_json`,
      [
        id,
        data.assignment_id || data.assignmentId || null,
        data.user_id || data.userId || data.studentId || null,
        data.guest_id || data.guestId || null,
        data.owner_key || data.ownerKey || null,
        data.game_id || data.gameId || null,
        data.vocab_set_id || data.vocabSetId || null,
        Number(data.score || 0),
        Number(data.correct || data.correctAnswers || 0),
        Number(data.incorrect || data.incorrectAnswers || 0),
        data.status || null,
        data.client_run_id || data.clientRunId || null,
        data.source_type || data.sourceType || null,
        data.source_id || data.sourceId || null,
        data.startedAt || data.createdAt || createdAt,
        completedAt,
        data.expiresAt || data.expires_at || null,
        dataJson
      ]
    );
    return;
  }
  if (table === "game_session_actions") {
    run(
      `INSERT INTO game_session_actions (id, session_id, sequence, action_type, created_at, updated_at, data_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at, data_json = excluded.data_json`,
      [id, data.sessionId || null, Number(data.sequence || 0), data.type || null, createdAt, updatedAt, dataJson]
    );
    return;
  }
  if (table === "grammar_attempts") {
    run(
      `INSERT INTO grammar_attempts (
        id, grammar_set_id, user_id, guest_id, status, created_at, completed_at, updated_at, data_json
      )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
        grammar_set_id = excluded.grammar_set_id,
        user_id = excluded.user_id,
        guest_id = excluded.guest_id,
        status = excluded.status,
        completed_at = excluded.completed_at,
        updated_at = excluded.updated_at,
        data_json = excluded.data_json`,
      [
        id,
        data.grammarSetId || data.grammar_set_id || null,
        data.userId || data.user_id || null,
        data.guestId || data.guest_id || null,
        data.status || null,
        createdAt,
        data.completedAt || data.completed_at || null,
        updatedAt,
        dataJson
      ]
    );
    return;
  }
  if (table === "leaderboard_events") {
    run(
      `INSERT INTO leaderboard_events (id, source_type, source_id, student_key, class_id, vocab_set_id, score, completed_at, expires_at, data_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
        source_type = excluded.source_type,
        source_id = excluded.source_id,
        student_key = excluded.student_key,
        class_id = excluded.class_id,
        vocab_set_id = excluded.vocab_set_id,
        score = excluded.score,
        completed_at = excluded.completed_at,
        expires_at = excluded.expires_at,
        data_json = excluded.data_json`,
      [
        id,
        data.sourceType || data.source_type || null,
        data.sourceId || data.source_id || null,
        data.studentKey || data.student_key || data.ownerKey || data.guestId || data.userId || null,
        data.classId || data.class_id || null,
        data.vocabSetId || data.vocab_set_id || data.grammarSetId || null,
        Number(data.score || 0),
        data.completedAt || data.endedAt || data.createdAt || createdAt,
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
  if (table === "learning_attempts" || table === "attempt_details") {
    run(`DELETE FROM ${table} WHERE attempt_id = ?`, [id]);
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

    CREATE TABLE IF NOT EXISTS guest_profiles (
      id TEXT PRIMARY KEY,
      display_name TEXT,
      normalized_name TEXT,
      status TEXT,
      created_at TEXT,
      updated_at TEXT,
      last_active_at TEXT,
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
      guest_id TEXT,
      owner_key TEXT,
      game_id TEXT,
      vocab_set_id TEXT,
      score INTEGER,
      correct INTEGER,
      incorrect INTEGER,
      status TEXT,
      client_run_id TEXT,
      source_type TEXT,
      source_id TEXT,
      created_at TEXT,
      completed_at TEXT,
      expires_at TEXT,
      data_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS game_session_actions (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      sequence INTEGER NOT NULL,
      action_type TEXT NOT NULL,
      created_at TEXT,
      updated_at TEXT,
      data_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS leaderboard_events (
      id TEXT PRIMARY KEY,
      source_type TEXT,
      source_id TEXT,
      student_key TEXT,
      class_id TEXT,
      vocab_set_id TEXT,
      score INTEGER,
      completed_at TEXT,
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
      grammar_set_id TEXT,
      user_id TEXT,
      guest_id TEXT,
      status TEXT,
      created_at TEXT,
      completed_at TEXT,
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
    CREATE INDEX IF NOT EXISTS idx_guest_profiles_normalized_name ON guest_profiles(normalized_name);
    CREATE INDEX IF NOT EXISTS idx_guest_profiles_status ON guest_profiles(status);
    CREATE INDEX IF NOT EXISTS idx_guest_profiles_last_active_at ON guest_profiles(last_active_at);
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
    CREATE UNIQUE INDEX IF NOT EXISTS idx_game_session_actions_session_sequence ON game_session_actions(session_id, sequence);
    CREATE INDEX IF NOT EXISTS idx_game_session_actions_session_id ON game_session_actions(session_id);
    CREATE INDEX IF NOT EXISTS idx_leaderboard_events_completed_at ON leaderboard_events(completed_at);
    CREATE INDEX IF NOT EXISTS idx_leaderboard_events_class_id ON leaderboard_events(class_id);
    CREATE INDEX IF NOT EXISTS idx_leaderboard_events_student_key ON leaderboard_events(student_key);
    CREATE INDEX IF NOT EXISTS idx_grammar_sets_created_at ON grammar_sets(created_at);
    CREATE INDEX IF NOT EXISTS idx_grammar_attempts_created_at ON grammar_attempts(created_at);
  `);
  getDb().run(
    "INSERT OR IGNORE INTO migrations (id, applied_at) VALUES (?, ?)",
    [BASE_SCHEMA_MIGRATION_ID, nowIso()]
  );
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
  if (hasMigration(ACTIVITY_EXPIRY_MIGRATION_ID)) {
    sqliteLastMigration = ACTIVITY_EXPIRY_MIGRATION_ID;
    return;
  }
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
  getDb().run(
    "INSERT OR REPLACE INTO migrations (id, applied_at) VALUES (?, ?)",
    [ACTIVITY_EXPIRY_MIGRATION_ID, nowIso()]
  );
  sqliteLastMigration = ACTIVITY_EXPIRY_MIGRATION_ID;
}
function migrateGrammarAttemptQueryColumns() {
  if (hasMigration(GRAMMAR_ATTEMPT_QUERY_MIGRATION_ID)) {
    sqliteLastMigration = GRAMMAR_ATTEMPT_QUERY_MIGRATION_ID;
    return;
  }
  withTransaction(() => {
    const requiredColumns = [
      ["grammar_set_id", "TEXT"],
      ["user_id", "TEXT"],
      ["guest_id", "TEXT"],
      ["status", "TEXT"]
    ];
    for (const [column, type] of requiredColumns) {
      if (!tableHasColumn("grammar_attempts", column)) {
        getDb().run(`ALTER TABLE grammar_attempts ADD COLUMN ${column} ${type}`);
      }
    }
    const rows = all(
      `SELECT id, grammar_set_id, user_id, guest_id, status, data_json
       FROM grammar_attempts`
    );
    for (const row of rows) {
      const data = parseJson(row.data_json);
      run(
        `UPDATE grammar_attempts
         SET grammar_set_id = ?, user_id = ?, guest_id = ?, status = ?
         WHERE id = ?`,
        [
          row.grammar_set_id || data.grammarSetId || data.grammar_set_id || null,
          row.user_id || data.userId || data.user_id || null,
          row.guest_id || data.guestId || data.guest_id || null,
          row.status || data.status || null,
          row.id
        ],
        false
      );
    }
    getDb().run(`
      CREATE INDEX IF NOT EXISTS idx_grammar_attempts_set_guest_status
        ON grammar_attempts(grammar_set_id, guest_id, status);
      CREATE INDEX IF NOT EXISTS idx_grammar_attempts_set_user_status
        ON grammar_attempts(grammar_set_id, user_id, status);
      CREATE INDEX IF NOT EXISTS idx_grammar_attempts_set_guest_created
        ON grammar_attempts(grammar_set_id, guest_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_grammar_attempts_set_user_created
        ON grammar_attempts(grammar_set_id, user_id, created_at);
    `);
    getDb().run(
      "INSERT OR REPLACE INTO migrations (id, applied_at) VALUES (?, ?)",
      [GRAMMAR_ATTEMPT_QUERY_MIGRATION_ID, nowIso()]
    );
  });
  sqliteLastMigration = GRAMMAR_ATTEMPT_QUERY_MIGRATION_ID;
}
function migrateNativeHotQueryColumns() {
  if (hasMigration(NATIVE_HOT_QUERY_MIGRATION_ID)) {
    sqliteLastMigration = NATIVE_HOT_QUERY_MIGRATION_ID;
    return;
  }
  const gameResultColumns = [
    ["guest_id", "TEXT"],
    ["owner_key", "TEXT"],
    ["status", "TEXT"],
    ["client_run_id", "TEXT"],
    ["source_type", "TEXT"],
    ["source_id", "TEXT"],
    ["completed_at", "TEXT"]
  ];
  for (const [column, type] of gameResultColumns) {
    if (!tableHasColumn("game_results", column)) {
      run(`ALTER TABLE game_results ADD COLUMN ${column} ${type}`, [], false);
    }
  }
  if (!tableHasColumn("grammar_attempts", "completed_at")) {
    run("ALTER TABLE grammar_attempts ADD COLUMN completed_at TEXT", [], false);
  }
  const rows = all(
    `SELECT id, guest_id, owner_key, status, client_run_id, source_type, source_id,
            completed_at, created_at, data_json
     FROM game_results`
  );
  for (const row of rows) {
    const data = parseJson(row.data_json);
    run(
      `UPDATE game_results
       SET guest_id = ?, owner_key = ?, status = ?, client_run_id = ?,
           source_type = ?, source_id = ?, completed_at = ?
       WHERE id = ?`,
      [
        row.guest_id || data.guestId || data.guest_id || null,
        row.owner_key || data.ownerKey || data.owner_key || null,
        row.status || data.status || (data.completedAt ? "completed" : null),
        row.client_run_id || data.clientRunId || data.client_run_id || null,
        row.source_type || data.sourceType || data.source_type || null,
        row.source_id || data.sourceId || data.source_id || null,
        row.completed_at || data.completedAt || data.endedAt || row.created_at || null,
        row.id
      ],
      false
    );
  }
  const grammarRows = all(
    `SELECT id, completed_at, data_json
     FROM grammar_attempts`
  );
  for (const row of grammarRows) {
    const data = parseJson(row.data_json);
    run(
      "UPDATE grammar_attempts SET completed_at = ? WHERE id = ?",
      [row.completed_at || data.completedAt || data.completed_at || null, row.id],
      false
    );
  }
  getDb().run(`
    CREATE INDEX IF NOT EXISTS idx_game_results_guest_id
      ON game_results(guest_id);
    CREATE INDEX IF NOT EXISTS idx_game_results_owner_client_run
      ON game_results(owner_key, client_run_id);
    CREATE INDEX IF NOT EXISTS idx_game_results_vocab_status_completed
      ON game_results(vocab_set_id, status, completed_at);
    CREATE INDEX IF NOT EXISTS idx_game_results_status_completed
      ON game_results(status, completed_at);
    CREATE INDEX IF NOT EXISTS idx_leaderboard_events_class_completed
      ON leaderboard_events(class_id, completed_at);
    CREATE INDEX IF NOT EXISTS idx_leaderboard_events_student_completed
      ON leaderboard_events(student_key, completed_at);
    CREATE INDEX IF NOT EXISTS idx_grammar_attempts_status_completed
      ON grammar_attempts(status, completed_at);
  `);
  getDb().run(
    "INSERT OR REPLACE INTO migrations (id, applied_at) VALUES (?, ?)",
    [NATIVE_HOT_QUERY_MIGRATION_ID, nowIso()]
  );
  sqliteLastMigration = NATIVE_HOT_QUERY_MIGRATION_ID;
}
function migrateLearningHistorySchema() {
  if (hasMigration(LEARNING_HISTORY_SCHEMA_MIGRATION_ID)) {
    sqliteLastMigration = LEARNING_HISTORY_SCHEMA_MIGRATION_ID;
    return;
  }
  const guestCapabilityColumns = [
    ["access_token_hash", "TEXT"],
    ["access_token_version", "INTEGER"],
    ["access_token_created_at", "TEXT"]
  ];
  for (const [column, type] of guestCapabilityColumns) {
    if (!tableHasColumn("guest_profiles", column)) {
      run(`ALTER TABLE guest_profiles ADD COLUMN ${column} ${type}`, [], false);
    }
  }
  run(`
    CREATE TABLE IF NOT EXISTS learning_attempts (
      attempt_id TEXT PRIMARY KEY,
      source_record_id TEXT NOT NULL CHECK(length(trim(source_record_id)) > 0),
      client_run_id TEXT,
      source_type TEXT NOT NULL CHECK(source_type IN ('vocabulary', 'grammar')),
      student_type TEXT NOT NULL CHECK(student_type IN ('authenticated', 'guest', 'legacy')),
      user_id TEXT,
      guest_id TEXT,
      owner_key TEXT,
      ownership_status TEXT NOT NULL,
      student_name_snapshot TEXT,
      class_id TEXT,
      class_name_snapshot TEXT,
      assignment_id TEXT,
      assignment_title_snapshot TEXT,
      assignment_due_at_snapshot TEXT,
      lesson_id TEXT NOT NULL CHECK(length(trim(lesson_id)) > 0),
      lesson_title_snapshot TEXT,
      lesson_type TEXT NOT NULL CHECK(lesson_type IN ('vocab_set', 'grammar_set')),
      game_id TEXT NOT NULL CHECK(length(trim(game_id)) > 0),
      game_title_snapshot TEXT,
      score REAL NOT NULL DEFAULT 0 CHECK(score >= 0 AND score <= 100),
      raw_score REAL NOT NULL DEFAULT 0 CHECK(raw_score >= 0),
      max_score REAL NOT NULL DEFAULT 0 CHECK(max_score >= 0),
      correct_count INTEGER NOT NULL DEFAULT 0 CHECK(correct_count >= 0),
      incorrect_count INTEGER NOT NULL DEFAULT 0 CHECK(incorrect_count >= 0),
      unanswered_count INTEGER NOT NULL DEFAULT 0 CHECK(unanswered_count >= 0),
      mistake_count INTEGER NOT NULL DEFAULT 0 CHECK(mistake_count >= 0),
      total_questions INTEGER NOT NULL DEFAULT 0 CHECK(total_questions >= 0),
      started_at TEXT,
      completed_at TEXT,
      activity_at TEXT NOT NULL,
      study_date TEXT,
      duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK(duration_seconds >= 0),
      attempt_status TEXT NOT NULL CHECK(attempt_status IN ('completed', 'in_progress', 'interrupted')),
      attempt_number INTEGER NOT NULL DEFAULT 1 CHECK(attempt_number >= 1),
      schema_version INTEGER NOT NULL DEFAULT 1 CHECK(schema_version >= 1),
      detail_status TEXT NOT NULL CHECK(detail_status IN ('available', 'missing', 'expired', 'legacy')),
      normalization_status TEXT NOT NULL CHECK(normalization_status IN ('canonical', 'legacy_partial')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      CHECK(owner_key IS NOT NULL OR ownership_status = 'legacy_unlinked')
    );

    CREATE TABLE IF NOT EXISTS attempt_details (
      attempt_id TEXT PRIMARY KEY,
      client_run_id TEXT,
      source_type TEXT NOT NULL CHECK(source_type IN ('vocabulary', 'grammar')),
      answer_details_json TEXT,
      question_snapshots_json TEXT,
      option_snapshots_json TEXT,
      extra_details_json TEXT,
      review_policy_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      expires_at TEXT,
      schema_version INTEGER NOT NULL DEFAULT 1 CHECK(schema_version >= 1),
      FOREIGN KEY(attempt_id) REFERENCES learning_attempts(attempt_id)
        ON UPDATE CASCADE ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS learning_history_backfill_state (
      job_name TEXT NOT NULL,
      source_type TEXT NOT NULL CHECK(source_type IN ('vocabulary', 'grammar')),
      last_source_record_id TEXT,
      processed_count INTEGER NOT NULL DEFAULT 0 CHECK(processed_count >= 0),
      inserted_count INTEGER NOT NULL DEFAULT 0 CHECK(inserted_count >= 0),
      skipped_count INTEGER NOT NULL DEFAULT 0 CHECK(skipped_count >= 0),
      legacy_unlinked_count INTEGER NOT NULL DEFAULT 0 CHECK(legacy_unlinked_count >= 0),
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK(status IN ('pending', 'running', 'completed', 'failed')),
      started_at TEXT,
      updated_at TEXT NOT NULL,
      completed_at TEXT,
      error_message TEXT,
      PRIMARY KEY(job_name, source_type)
    );

    CREATE TABLE IF NOT EXISTS pronunciation_attempts (
      id TEXT PRIMARY KEY,
      owner_key TEXT,
      owner_type TEXT,
      user_id TEXT,
      student_id TEXT,
      guest_id TEXT,
      student_name TEXT,
      vocabulary_set_id TEXT,
      word_id TEXT,
      target_text TEXT,
      recognized_text TEXT,
      score REAL NOT NULL DEFAULT 0 CHECK(score >= 0 AND score <= 100),
      correct_words INTEGER NOT NULL DEFAULT 0 CHECK(correct_words >= 0),
      total_words INTEGER NOT NULL DEFAULT 0 CHECK(total_words >= 0),
      attempt_count INTEGER NOT NULL DEFAULT 1 CHECK(attempt_count >= 1),
      game_session_id TEXT,
      game_id TEXT NOT NULL DEFAULT 'speaking-ai',
      played_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      data_json TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_learning_attempts_source_record
      ON learning_attempts(source_type, source_record_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_learning_attempts_client_run
      ON learning_attempts(owner_key, source_type, lesson_id, game_id, client_run_id)
      WHERE client_run_id IS NOT NULL AND owner_key IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_learning_attempts_owner_activity
      ON learning_attempts(owner_key, activity_at DESC, attempt_id DESC);
    CREATE INDEX IF NOT EXISTS idx_learning_attempts_owner_source_activity
      ON learning_attempts(owner_key, source_type, activity_at DESC);
    CREATE INDEX IF NOT EXISTS idx_learning_attempts_owner_assignment_activity
      ON learning_attempts(owner_key, assignment_id, activity_at DESC)
      WHERE assignment_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_learning_attempts_lesson_activity
      ON learning_attempts(lesson_id, activity_at DESC);
    CREATE INDEX IF NOT EXISTS idx_attempt_details_expires
      ON attempt_details(expires_at)
      WHERE expires_at IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_pronunciation_attempts_session_played
      ON pronunciation_attempts(game_session_id, played_at DESC);
    CREATE INDEX IF NOT EXISTS idx_pronunciation_attempts_owner_played
      ON pronunciation_attempts(owner_key, played_at DESC);
  `);
  getDb().run(
    "INSERT OR REPLACE INTO migrations (id, applied_at) VALUES (?, ?)",
    [LEARNING_HISTORY_SCHEMA_MIGRATION_ID, nowIso()]
  );
  sqliteLastMigration = LEARNING_HISTORY_SCHEMA_MIGRATION_ID;
}
function migrateGuestCapabilitiesToPhysicalColumns() {
  if (hasMigration(GUEST_CAPABILITY_STORAGE_MIGRATION_ID)) {
    sqliteLastMigration = GUEST_CAPABILITY_STORAGE_MIGRATION_ID;
    return;
  }
  const rows = all(
    "SELECT id, data_json, updated_at FROM guest_profiles"
  );
  for (const row of rows) {
    const data = parseJson(row.data_json);
    if (!data || typeof data !== "object" || Array.isArray(data)) continue;
    const containsCapabilityData = GUEST_CAPABILITY_FIELDS.some(
      (field) => Object.prototype.hasOwnProperty.call(data, field)
    );
    if (!containsCapabilityData) continue;
    const accessTokenHash = optionalText(firstDefined(
      data,
      "accessTokenHash",
      "access_token_hash",
      "guestAccessTokenHash",
      "guest_access_token_hash"
    ));
    const accessTokenVersion = accessTokenHash ? Math.max(1, nonNegativeInteger(
      firstDefined(data, "accessTokenVersion", "access_token_version"),
      1
    )) : null;
    const accessTokenCreatedAt = accessTokenHash ? optionalText(firstDefined(data, "accessTokenCreatedAt", "access_token_created_at")) || optionalText(row.updated_at) || nowIso() : null;
    run(
      `UPDATE guest_profiles
       SET access_token_hash = COALESCE(access_token_hash, ?),
           access_token_version = COALESCE(access_token_version, ?),
           access_token_created_at = COALESCE(access_token_created_at, ?),
           data_json = ?
       WHERE id = ?`,
      [
        accessTokenHash,
        accessTokenVersion,
        accessTokenCreatedAt,
        JSON.stringify(withoutGuestCapabilityFields(data)),
        row.id
      ],
      false
    );
  }
  getDb().run(
    "INSERT OR REPLACE INTO migrations (id, applied_at) VALUES (?, ?)",
    [GUEST_CAPABILITY_STORAGE_MIGRATION_ID, nowIso()]
  );
  sqliteLastMigration = GUEST_CAPABILITY_STORAGE_MIGRATION_ID;
}
function migrateListeningSchema() {
  if (hasMigration(LISTENING_SCHEMA_MIGRATION_ID)) {
    sqliteLastMigration = LISTENING_SCHEMA_MIGRATION_ID;
    return;
  }
  for (const [column, definition] of [
    ["resource_type", "TEXT"],
    ["resource_id", "TEXT"],
    ["resource_title", "TEXT"]
  ]) {
    if (!tableHasColumn("assignments", column)) {
      run(`ALTER TABLE assignments ADD COLUMN ${column} ${definition}`);
    }
  }
  getDb().run(`
    CREATE TABLE IF NOT EXISTS listening_sets (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft'
        CHECK(status IN ('draft', 'published', 'archived')),
      visibility TEXT NOT NULL DEFAULT 'draft'
        CHECK(visibility IN ('draft', 'public', 'assignment')),
      published_version_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      data_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS listening_set_versions (
      id TEXT PRIMARY KEY,
      set_id TEXT NOT NULL,
      version_number INTEGER NOT NULL CHECK(version_number >= 1),
      status TEXT NOT NULL DEFAULT 'draft'
        CHECK(status IN ('draft', 'published', 'superseded')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      data_json TEXT NOT NULL,
      FOREIGN KEY(set_id) REFERENCES listening_sets(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS listening_assets (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      kind TEXT NOT NULL CHECK(kind IN ('image', 'audio')),
      mime_type TEXT NOT NULL,
      storage_key TEXT NOT NULL,
      public_url TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active'
        CHECK(status IN ('active', 'archived')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      data_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS listening_asset_usages (
      id TEXT PRIMARY KEY,
      asset_id TEXT NOT NULL,
      set_id TEXT NOT NULL,
      version_id TEXT,
      entity_id TEXT,
      role TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      data_json TEXT NOT NULL,
      FOREIGN KEY(asset_id) REFERENCES listening_assets(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
      FOREIGN KEY(set_id) REFERENCES listening_sets(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS listening_attempts (
      id TEXT PRIMARY KEY,
      owner_key TEXT NOT NULL,
      user_id TEXT,
      guest_id TEXT,
      set_id TEXT NOT NULL,
      version_id TEXT NOT NULL,
      assignment_id TEXT,
      client_run_id TEXT NOT NULL,
      run_secret_hash TEXT NOT NULL,
      student_name TEXT,
      class_id TEXT,
      score REAL NOT NULL CHECK(score >= 0 AND score <= 100),
      correct_count INTEGER NOT NULL CHECK(correct_count >= 0),
      incorrect_count INTEGER NOT NULL CHECK(incorrect_count >= 0),
      unanswered_count INTEGER NOT NULL CHECK(unanswered_count >= 0),
      started_at TEXT NOT NULL,
      completed_at TEXT NOT NULL,
      duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK(duration_seconds >= 0),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      data_json TEXT NOT NULL,
      FOREIGN KEY(set_id) REFERENCES listening_sets(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
      FOREIGN KEY(version_id) REFERENCES listening_set_versions(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS listening_attempt_details (
      id TEXT PRIMARY KEY,
      attempt_id TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      data_json TEXT NOT NULL,
      FOREIGN KEY(attempt_id) REFERENCES listening_attempts(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_listening_versions_set_number
      ON listening_set_versions(set_id, version_number);
    CREATE INDEX IF NOT EXISTS idx_listening_sets_owner_status
      ON listening_sets(owner_id, status, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_listening_assets_owner_kind
      ON listening_assets(owner_id, kind, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_listening_assets_storage_key
      ON listening_assets(storage_key);
    CREATE INDEX IF NOT EXISTS idx_listening_asset_usages_asset
      ON listening_asset_usages(asset_id);
    CREATE INDEX IF NOT EXISTS idx_listening_asset_usages_set
      ON listening_asset_usages(set_id, version_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_listening_attempts_client_run
      ON listening_attempts(owner_key, set_id, client_run_id);
    CREATE INDEX IF NOT EXISTS idx_listening_attempts_owner_completed
      ON listening_attempts(owner_key, completed_at DESC);
    CREATE INDEX IF NOT EXISTS idx_listening_attempts_set_completed
      ON listening_attempts(set_id, completed_at DESC);
    CREATE INDEX IF NOT EXISTS idx_listening_attempts_assignment
      ON listening_attempts(assignment_id, completed_at DESC)
      WHERE assignment_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_assignments_resource
      ON assignments(resource_type, resource_id);
  `);
  getDb().run(
    "INSERT OR REPLACE INTO migrations (id, applied_at) VALUES (?, ?)",
    [LISTENING_SCHEMA_MIGRATION_ID, nowIso()]
  );
  sqliteLastMigration = LISTENING_SCHEMA_MIGRATION_ID;
}
function migrateMoverReadingWritingSchema() {
  if (hasMigration(MOVER_READING_WRITING_SCHEMA_MIGRATION_ID)) {
    sqliteLastMigration = MOVER_READING_WRITING_SCHEMA_MIGRATION_ID;
    return;
  }
  getDb().run(`
    CREATE TABLE IF NOT EXISTS mover_reading_sets (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft'
        CHECK(status IN ('draft', 'published', 'archived')),
      visibility TEXT NOT NULL DEFAULT 'draft'
        CHECK(visibility IN ('draft', 'public', 'assignment')),
      published_version_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      data_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mover_reading_set_versions (
      id TEXT PRIMARY KEY,
      set_id TEXT NOT NULL,
      version_number INTEGER NOT NULL CHECK(version_number >= 1),
      status TEXT NOT NULL DEFAULT 'published'
        CHECK(status IN ('published', 'superseded')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      data_json TEXT NOT NULL,
      FOREIGN KEY(set_id) REFERENCES mover_reading_sets(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS mover_reading_asset_usages (
      id TEXT PRIMARY KEY,
      asset_id TEXT NOT NULL,
      set_id TEXT NOT NULL,
      version_id TEXT NOT NULL,
      entity_id TEXT,
      role TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      data_json TEXT NOT NULL,
      FOREIGN KEY(asset_id) REFERENCES listening_assets(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
      FOREIGN KEY(set_id) REFERENCES mover_reading_sets(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
      FOREIGN KEY(version_id) REFERENCES mover_reading_set_versions(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS mover_reading_attempts (
      id TEXT PRIMARY KEY,
      owner_key TEXT NOT NULL,
      user_id TEXT,
      guest_id TEXT,
      set_id TEXT NOT NULL,
      version_id TEXT NOT NULL,
      assignment_id TEXT,
      client_run_id TEXT NOT NULL,
      run_secret_hash TEXT NOT NULL,
      student_name TEXT,
      class_id TEXT,
      score REAL NOT NULL CHECK(score >= 0 AND score <= 100),
      correct_count INTEGER NOT NULL CHECK(correct_count >= 0),
      incorrect_count INTEGER NOT NULL CHECK(incorrect_count >= 0),
      unanswered_count INTEGER NOT NULL CHECK(unanswered_count >= 0),
      started_at TEXT NOT NULL,
      completed_at TEXT NOT NULL,
      duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK(duration_seconds >= 0),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      data_json TEXT NOT NULL,
      FOREIGN KEY(set_id) REFERENCES mover_reading_sets(id)
        ON UPDATE CASCADE ON DELETE RESTRICT,
      FOREIGN KEY(version_id) REFERENCES mover_reading_set_versions(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS mover_reading_attempt_details (
      id TEXT PRIMARY KEY,
      attempt_id TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      data_json TEXT NOT NULL,
      FOREIGN KEY(attempt_id) REFERENCES mover_reading_attempts(id)
        ON UPDATE CASCADE ON DELETE RESTRICT
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_mover_reading_versions_set_number
      ON mover_reading_set_versions(set_id, version_number);
    CREATE INDEX IF NOT EXISTS idx_mover_reading_sets_owner_status
      ON mover_reading_sets(owner_id, status, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_mover_reading_usages_asset
      ON mover_reading_asset_usages(asset_id);
    CREATE INDEX IF NOT EXISTS idx_mover_reading_usages_set
      ON mover_reading_asset_usages(set_id, version_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_mover_reading_attempts_client_run
      ON mover_reading_attempts(owner_key, set_id, client_run_id);
    CREATE INDEX IF NOT EXISTS idx_mover_reading_attempts_owner_completed
      ON mover_reading_attempts(owner_key, completed_at DESC);
    CREATE INDEX IF NOT EXISTS idx_mover_reading_attempts_set_completed
      ON mover_reading_attempts(set_id, completed_at DESC);
  `);
  getDb().run(
    "INSERT OR REPLACE INTO migrations (id, applied_at) VALUES (?, ?)",
    [MOVER_READING_WRITING_SCHEMA_MIGRATION_ID, nowIso()]
  );
  sqliteLastMigration = MOVER_READING_WRITING_SCHEMA_MIGRATION_ID;
}
function getJsonImportCandidates() {
  return [
    process.env.LOCAL_DB_PATH,
    import_path.default.join(process.cwd(), "db.json"),
    "/home/qzmivzbj/app.msdieu.com/db.json"
  ].filter(Boolean);
}
function backupJsonFile(sourcePath2) {
  try {
    const backupDir = import_path.default.dirname(sqliteDbPath);
    const stamp = (/* @__PURE__ */ new Date()).toISOString().replace(/[:T]/g, "-").slice(0, 16);
    const backupPath = import_path.default.join(backupDir, `db-backup-${stamp}.json`);
    if (!import_fs.default.existsSync(backupPath)) {
      import_fs.default.copyFileSync(sourcePath2, backupPath);
    }
  } catch (err) {
    sqliteLastError = `Failed to backup db.json: ${redactSQLiteError(err)}`;
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
  const sourcePath2 = getJsonImportCandidates().find((candidate) => import_fs.default.existsSync(candidate));
  if (!sourcePath2) {
    markMigration(MIGRATION_ID);
    return;
  }
  backupJsonFile(sourcePath2);
  const raw = import_fs.default.readFileSync(sourcePath2, "utf8");
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
      sqliteConfig = resolveSQLiteStorageConfig();
      sqliteDbPath = sqliteConfig.dbPath;
      sqliteDb = await openSQLiteDriver(sqliteConfig);
      assertQuickCheck("pre-migration");
      withTransaction(() => {
        runSchemaMigration();
        migrateActivityExpiryColumns();
        migrateGrammarAttemptQueryColumns();
        migrateNativeHotQueryColumns();
        migrateLearningHistorySchema();
        migrateGuestCapabilitiesToPhysicalColumns();
        migrateListeningSchema();
        migrateMoverReadingWritingSchema();
        if (sqliteConfig?.allowJsonImport) migrateFromJsonIfNeeded();
      }, "immediate");
      configureSQLiteConnection(sqliteConfig);
      assertQuickCheck("post-migration");
      sqliteReady = true;
      sqliteLastError = null;
      console.log(
        `[Storage] SQLite ready: driver=${sqliteConfig.driver} db=${redactSQLitePath(sqliteDbPath)} journal=${readPragmaValue("journal_mode")}`
      );
    } catch (err) {
      sqliteReady = false;
      sqliteLastError = redactSQLiteError(err);
      console.error(
        `[Storage] SQLite ready: false db=${sqliteDbPath ? redactSQLitePath(sqliteDbPath) : "unresolved"} error=${sqliteLastError}`
      );
      try {
        sqliteDb?.close();
      } catch {
      }
      sqliteDb = null;
      throw err;
    }
  })();
  return initPromise;
}
async function sqliteQueryAll(sql, params = []) {
  await initializeSQLiteStorage();
  return all(sql, params);
}
async function sqliteQueryOne(sql, params = []) {
  await initializeSQLiteStorage();
  return one(sql, params);
}
function readPragmaValue(name) {
  const row = one(`PRAGMA ${name}`) || {};
  return Object.values(row)[0];
}
function assertQuickCheck(stage) {
  const rows = all("PRAGMA quick_check");
  const values = rows.map((row) => String(Object.values(row)[0] || "").toLowerCase());
  if (values.length !== 1 || values[0] !== "ok") {
    throw new Error(`SQLite ${stage} quick_check failed: ${values.join(", ") || "no result"}`);
  }
}
function configureSQLiteConnection(config) {
  run("PRAGMA foreign_keys = ON", [], false);
  run(`PRAGMA busy_timeout = ${config.busyTimeoutMs}`, [], false);
  if (config.driver === "better-sqlite3") {
    run("PRAGMA journal_mode = WAL", [], false);
    run(`PRAGMA synchronous = ${config.synchronous}`, [], false);
    run(`PRAGMA wal_autocheckpoint = ${config.walAutoCheckpointPages}`, [], false);
  } else {
    const journalMode = String(readPragmaValue("journal_mode") || "").toLowerCase();
    if (journalMode === "wal") {
      throw new Error("sql.js startup refused while journal_mode is WAL.");
    }
  }
  const foreignKeys = Number(readPragmaValue("foreign_keys"));
  const busyTimeout = Number(readPragmaValue("busy_timeout"));
  if (foreignKeys !== 1) throw new Error("SQLite foreign_keys verification failed.");
  if (busyTimeout !== config.busyTimeoutMs) {
    throw new Error(`SQLite busy_timeout verification failed: ${busyTimeout}.`);
  }
  if (config.driver === "better-sqlite3") {
    const journalMode = String(readPragmaValue("journal_mode") || "").toLowerCase();
    const walAutoCheckpoint = Number(readPragmaValue("wal_autocheckpoint"));
    if (journalMode !== "wal") {
      throw new Error(`SQLite WAL verification failed: journal_mode=${journalMode || "unknown"}.`);
    }
    if (walAutoCheckpoint !== config.walAutoCheckpointPages) {
      throw new Error(`SQLite wal_autocheckpoint verification failed: ${walAutoCheckpoint}.`);
    }
  }
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
    let items = readRowsWithSqlQuery(
      table,
      this.filters,
      this.orderField,
      this.orderDir,
      this.limitVal
    );
    if (!items) {
      items = readRows(table);
      items = applyFilters(items, this.filters);
      items = applyOrder(items, this.orderField, this.orderDir);
      if (this.limitVal !== void 0) {
        items = items.slice(0, this.limitVal);
      }
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
    }, "immediate");
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
  const lastMigration = one(
    "SELECT id, applied_at FROM migrations ORDER BY applied_at DESC, rowid DESC LIMIT 1"
  ) || null;
  const dbSizeBytes = sqliteDbPath && import_fs.default.existsSync(sqliteDbPath) ? import_fs.default.statSync(sqliteDbPath).size : 0;
  const walPath = `${sqliteDbPath}-wal`;
  const shmPath = `${sqliteDbPath}-shm`;
  const walSizeBytes = import_fs.default.existsSync(walPath) ? import_fs.default.statSync(walPath).size : 0;
  const sqliteVersion = one("SELECT sqlite_version() AS version");
  const quickCheck = one("PRAGMA quick_check");
  return {
    storageMode: process.env.STORAGE_MODE || "firebase-first",
    sqliteEnabled: process.env.STORAGE_MODE === "sqlite",
    sqliteDriver: sqliteDb?.kind || sqliteConfig?.driver || null,
    sqliteDbPath: sqliteDbPath ? redactSQLitePath(sqliteDbPath) : null,
    sqliteDbBasename: sqliteDbPath ? import_path.default.basename(sqliteDbPath) : null,
    sqliteFileExists: Boolean(sqliteDbPath && import_fs.default.existsSync(sqliteDbPath)),
    databaseExists: Boolean(sqliteDbPath && import_fs.default.existsSync(sqliteDbPath)),
    sqliteReady,
    sqliteVersion: sqliteVersion?.version || null,
    quickCheck: quickCheck ? Object.values(quickCheck)[0] : null,
    nodeVersion: process.version,
    nodeAbi: process.versions.modules,
    platform: process.platform,
    architecture: process.arch,
    pragmas: {
      journalMode: readPragmaValue("journal_mode"),
      foreignKeys: Number(readPragmaValue("foreign_keys")),
      synchronous: readPragmaValue("synchronous"),
      busyTimeoutMs: Number(readPragmaValue("busy_timeout")),
      walAutoCheckpointPages: Number(readPragmaValue("wal_autocheckpoint"))
    },
    files: {
      databaseBytes: dbSizeBytes,
      walExists: import_fs.default.existsSync(walPath),
      shmExists: import_fs.default.existsSync(shmPath),
      walBytes: walSizeBytes
    },
    databaseSizeBytes: dbSizeBytes,
    journalMode: readPragmaValue("journal_mode"),
    synchronous: readPragmaValue("synchronous"),
    foreignKeys: Number(readPragmaValue("foreign_keys")),
    busyTimeoutMs: Number(readPragmaValue("busy_timeout")),
    walAutoCheckpointPages: Number(readPragmaValue("wal_autocheckpoint")),
    walFileExists: import_fs.default.existsSync(walPath),
    shmFileExists: import_fs.default.existsSync(shmPath),
    walFileSizeBytes: walSizeBytes,
    tableCounts: {
      users: await tableCount("users"),
      vocab_sets: await tableCount("vocab_sets"),
      vocab_items: await tableCount("vocab_items"),
      classes: await tableCount("classes"),
      assignments: await tableCount("assignments"),
      results: await tableCount("results"),
      game_results: await tableCount("game_results"),
      leaderboard_events: await tableCount("leaderboard_events"),
      grammar_sets: await tableCount("grammar_sets"),
      grammar_attempts: await tableCount("grammar_attempts"),
      learning_attempts: await tableCount("learning_attempts"),
      attempt_details: await tableCount("attempt_details"),
      pronunciation_attempts: await tableCount("pronunciation_attempts"),
      listening_sets: await tableCount("listening_sets"),
      listening_set_versions: await tableCount("listening_set_versions"),
      listening_assets: await tableCount("listening_assets"),
      listening_asset_usages: await tableCount("listening_asset_usages"),
      listening_attempts: await tableCount("listening_attempts"),
      listening_attempt_details: await tableCount("listening_attempt_details"),
      mover_reading_sets: await tableCount("mover_reading_sets"),
      mover_reading_set_versions: await tableCount("mover_reading_set_versions"),
      mover_reading_asset_usages: await tableCount("mover_reading_asset_usages"),
      mover_reading_attempts: await tableCount("mover_reading_attempts"),
      mover_reading_attempt_details: await tableCount("mover_reading_attempt_details"),
      learning_history_backfill_state: await tableCount("learning_history_backfill_state")
    },
    lastMigration: lastMigration || sqliteLastMigration,
    lastError: sqliteLastError,
    processMetrics: getSQLiteProcessMetrics()
  };
}
function getSQLiteCurrentRequestMetrics() {
  return getSQLiteRequestMetrics();
}
function withSQLiteRequestMetrics(action) {
  return runWithSQLiteRequestMetrics(sqliteDb?.kind || sqliteConfig?.driver || null, action);
}
async function closeSQLiteStorage() {
  if (!sqliteDb) {
    sqliteReady = false;
    initPromise = null;
    transactionDepth = 0;
    return;
  }
  try {
    if (sqliteDb.kind === "better-sqlite3") {
      try {
        one("PRAGMA wal_checkpoint(PASSIVE)");
      } catch {
      }
    } else {
      persistDb();
    }
  } finally {
    sqliteDb.close();
    sqliteDb = null;
    sqliteReady = false;
    initPromise = null;
    transactionDepth = 0;
  }
}

// src/lib/firebaseAdmin.ts
var projectId = process.env.FIREBASE_PROJECT_ID;
var clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
var privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
var hasServiceAccountCredentials = Boolean(projectId && clientEmail && privateKey);
var requestedStorageMode = process.env.STORAGE_MODE || "firebase";
var storageMode = requestedStorageMode === "firebase-first" ? "firebase" : requestedStorageMode;
var isSQLiteStorageMode = storageMode === "sqlite";
var isLocalJsonStorageMode = storageMode === "local-json" || storageMode === "json";
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
var StorageUnavailableError = class extends Error {
  constructor(message) {
    super(message);
    this.statusCode = 503;
    this.name = "StorageUnavailableError";
  }
};
function isStorageUnavailableError(err) {
  return err?.name === "StorageUnavailableError" || err?.statusCode === 503;
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
    if (lower === "leaderboard_events" || lower === "leaderboardevents") return "leaderboardEvents";
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
var localDb = null;
function getLocalDb() {
  if (!localDb) {
    localDb = new LocalDbEngine();
  }
  return localDb;
}
var useLocalFallback = isLocalJsonStorageMode;
var storageUnavailableError = null;
var FIREBASE_ADMIN_TIMEOUT_MS = 5e3;
function setStorageUnavailable(message) {
  storageUnavailableError = message;
  console.error(`[Storage] ${message}`);
}
function assertFirebaseStorageAvailable() {
  if (storageUnavailableError) {
    throw new StorageUnavailableError(storageUnavailableError);
  }
}
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
    storageUnavailableError = null;
    return;
  }
  if (isLocalJsonStorageMode) {
    console.warn("STORAGE_MODE=local-json. Using persistent local JSON storage by explicit configuration.");
    useLocalFallback = true;
    storageUnavailableError = null;
    return;
  }
  if (!hasServiceAccountCredentials) {
    useLocalFallback = false;
    setStorageUnavailable("Firebase Admin credentials are not configured and no explicit local storage mode is enabled.");
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
    console.log("Firestore connection diagnostics succeeded. Real Firestore DB will be used.");
    useLocalFallback = false;
    storageUnavailableError = null;
  } catch (err) {
    useLocalFallback = false;
    setStorageUnavailable(`Firestore validation failed: ${err.message}`);
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
    this.size = docs.length;
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
      assertFirebaseStorageAvailable();
      try {
        const snap = await realDb.collection(this.collectionName).doc(this.id).get();
        return new FallbackDocSnapshot(snap.id, snap.exists, this, snap.data());
      } catch (err) {
        throw new StorageUnavailableError(`Firestore read failed: ${err.message}`);
      }
    }
    const data = getLocalDb().getDocument(this.collectionName, this.id);
    return new FallbackDocSnapshot(this.id, data !== void 0, this, data);
  }
  async set(data) {
    if (!useLocalFallback) {
      assertFirebaseStorageAvailable();
      try {
        await realDb.collection(this.collectionName).doc(this.id).set(data);
        return;
      } catch (err) {
        throw new StorageUnavailableError(`Firestore write failed: ${err.message}`);
      }
    }
    getLocalDb().setDocument(this.collectionName, this.id, data);
  }
  async update(data) {
    if (!useLocalFallback) {
      assertFirebaseStorageAvailable();
      try {
        await realDb.collection(this.collectionName).doc(this.id).update(data);
        return;
      } catch (err) {
        throw new StorageUnavailableError(`Firestore update failed: ${err.message}`);
      }
    }
    getLocalDb().updateDocument(this.collectionName, this.id, data);
  }
  async delete() {
    if (!useLocalFallback) {
      assertFirebaseStorageAvailable();
      try {
        await realDb.collection(this.collectionName).doc(this.id).delete();
        return;
      } catch (err) {
        throw new StorageUnavailableError(`Firestore delete failed: ${err.message}`);
      }
    }
    getLocalDb().deleteDocument(this.collectionName, this.id);
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
      assertFirebaseStorageAvailable();
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
        throw new StorageUnavailableError(`Firestore query failed: ${err.message}`);
      }
    }
    let results = [...getLocalDb().getCollection(this.collectionName)];
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
      assertFirebaseStorageAvailable();
      try {
        const batch = realDb.batch();
        for (const op of this.ops) {
          const realDocRef = realDb.collection(op.doc.collectionName).doc(op.doc.id);
          if (op.type === "set") batch.set(realDocRef, op.data);
          else if (op.type === "update") batch.update(realDocRef, op.data);
          else if (op.type === "delete") batch.delete(realDocRef);
        }
        await batch.commit();
        return;
      } catch (err) {
        throw new StorageUnavailableError(`Firestore batch write failed: ${err.message}`);
      }
    }
    for (const op of this.ops) {
      const doc = op.doc;
      if (op.type === "set") getLocalDb().setDocument(doc.collectionName, doc.id, op.data);
      else if (op.type === "update") getLocalDb().updateDocument(doc.collectionName, doc.id, op.data);
      else if (op.type === "delete") getLocalDb().deleteDocument(doc.collectionName, doc.id);
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
function withStorageRequestMetrics(action) {
  return isSQLiteStorageMode ? withSQLiteRequestMetrics(action) : action();
}
function getStorageRequestMetrics() {
  return isSQLiteStorageMode ? getSQLiteCurrentRequestMetrics() : null;
}
async function shutdownStorage() {
  if (isSQLiteStorageMode) await closeSQLiteStorage();
}
async function getStorageDiagnostics() {
  if (isSQLiteStorageMode) {
    return getSQLiteDiagnostics();
  }
  return {
    storageMode,
    sqliteEnabled: false,
    sqliteDriver: null,
    sqliteDbPath: null,
    sqliteDbBasename: null,
    sqliteFileExists: false,
    databaseExists: false,
    sqliteReady: false,
    sqliteVersion: null,
    quickCheck: null,
    nodeVersion: process.version,
    nodeAbi: process.versions.modules,
    platform: process.platform,
    architecture: process.arch,
    pragmas: null,
    files: null,
    databaseSizeBytes: null,
    journalMode: null,
    synchronous: null,
    foreignKeys: null,
    busyTimeoutMs: null,
    walAutoCheckpointPages: null,
    walFileExists: false,
    shmFileExists: false,
    walFileSizeBytes: null,
    tableCounts: null,
    lastMigration: null,
    lastError: storageUnavailableError || (useLocalFallback ? "Using explicit local JSON storage for app data." : null),
    processMetrics: null
  };
}

// src/lib/studentIdentity.ts
var STUDENT_NAME_MIN_LENGTH = 2;
var STUDENT_NAME_MAX_LENGTH = 20;
function normalizeStudentDisplayName(value) {
  return String(value ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();
}
function validateStudentDisplayName(value) {
  const normalized = normalizeStudentDisplayName(value);
  const length = Array.from(normalized).length;
  if (length < STUDENT_NAME_MIN_LENGTH) {
    return {
      valid: false,
      value: normalized,
      error: `T\xEAn hi\u1EC3n th\u1ECB ph\u1EA3i c\xF3 \xEDt nh\u1EA5t ${STUDENT_NAME_MIN_LENGTH} k\xFD t\u1EF1.`
    };
  }
  if (length > STUDENT_NAME_MAX_LENGTH) {
    return {
      valid: false,
      value: normalized,
      error: `T\xEAn hi\u1EC3n th\u1ECB kh\xF4ng \u0111\u01B0\u1EE3c v\u01B0\u1EE3t qu\xE1 ${STUDENT_NAME_MAX_LENGTH} k\xFD t\u1EF1.`
    };
  }
  if (!/^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$/u.test(normalized)) {
    return {
      valid: false,
      value: normalized,
      error: "T\xEAn ch\u1EC9 \u0111\u01B0\u1EE3c ch\u1EE9a ch\u1EEF c\xE1i, kho\u1EA3ng tr\u1EAFng, d\u1EA5u nh\xE1y ho\u1EB7c d\u1EA5u g\u1EA1ch n\u1ED1i."
    };
  }
  return { valid: true, value: normalized, error: "" };
}

// src/lib/serverLearningRuns.ts
var import_node_crypto = __toESM(require("node:crypto"), 1);
function normalizeRunKeyPart(value) {
  return String(value || "").normalize("NFKC").trim().slice(0, 240);
}
function deterministicRunDocumentId(prefix, parts) {
  const digest = import_node_crypto.default.createHash("sha256").update(parts.map(normalizeRunKeyPart).join("")).digest("hex");
  return `${prefix}-${digest.slice(0, 40)}`;
}
function normalizeClientStartedAt(value, fallback = (/* @__PURE__ */ new Date()).toISOString()) {
  const parsed = new Date(String(value || ""));
  if (Number.isNaN(parsed.getTime())) return fallback;
  const now = Date.now();
  const clamped = Math.max(now - 24 * 60 * 60 * 1e3, Math.min(now, parsed.getTime()));
  return new Date(clamped).toISOString();
}

// src/lib/game-engine/quizContracts.ts
var CURRENT_QUIZ_CONTRACTS = {
  "quiz-en-vi": {
    questionType: "term",
    answerType: "meaning",
    contractVersion: 1
  },
  "quiz-vi-en": {
    questionType: "meaning",
    answerType: "term",
    contractVersion: 1
  },
  "quiz-sound": {
    questionType: "sound",
    answerType: "meaning",
    contractVersion: 2
  }
};
var LEGACY_QUIZ_CONTRACTS = {
  ...CURRENT_QUIZ_CONTRACTS,
  "quiz-sound": {
    questionType: "sound",
    answerType: "term",
    contractVersion: 1
  }
};
function isQuestionType(value) {
  return value === "term" || value === "meaning" || value === "sound";
}
function isAnswerType(value) {
  return value === "term" || value === "meaning";
}
function getCurrentQuizContract(gameId) {
  const contract = CURRENT_QUIZ_CONTRACTS[gameId];
  return contract ? { ...contract } : null;
}
function resolveStoredQuizContract(gameId, storedConfig) {
  const fallback = LEGACY_QUIZ_CONTRACTS[gameId];
  if (!fallback) return null;
  const storedVersion = Number(storedConfig?.contractVersion);
  return {
    questionType: isQuestionType(storedConfig?.questionType) ? storedConfig.questionType : fallback.questionType,
    answerType: isAnswerType(storedConfig?.answerType) ? storedConfig.answerType : fallback.answerType,
    contractVersion: Number.isInteger(storedVersion) && storedVersion > 0 ? storedVersion : fallback.contractVersion
  };
}
function isQuizItemEligible(item, contract) {
  const term = String(item.term || "").trim();
  const meaning = String(item.meaning || "").trim();
  const needsMeaning = contract.questionType === "meaning" || contract.answerType === "meaning";
  return Boolean(term && (!needsMeaning || meaning));
}
function getQuizAnswerValue(item, answerType) {
  return String(answerType === "term" ? item.term || "" : item.meaning || "").trim();
}
function getQuizQuestionText(item, questionType) {
  return String(questionType === "meaning" ? item.meaning || "" : item.term || "").trim();
}

// src/server/learning-history/learningHistoryRouter.ts
var import_express = __toESM(require("express"), 1);

// src/server/learning-history/learningHistoryAuth.ts
var import_node_crypto2 = __toESM(require("node:crypto"), 1);

// src/features/listening/types.ts
var LISTENING_TRANSCRIPT_MAX_CHARS = 2e4;

// src/features/listening/geometry.ts
var EPSILON = 1e-7;
var isNormalizedPoint = (point) => Number.isFinite(point.x) && Number.isFinite(point.y) && point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1;
function polygonArea(points) {
  if (points.length < 3) return 0;
  return Math.abs(points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0)) / 2;
}
var orientation = (a, b, c) => (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
var onSegment = (a, b, c) => b.x <= Math.max(a.x, c.x) + EPSILON && b.x + EPSILON >= Math.min(a.x, c.x) && b.y <= Math.max(a.y, c.y) + EPSILON && b.y + EPSILON >= Math.min(a.y, c.y);
function segmentsIntersect(a, b, c, d) {
  const values = [orientation(a, b, c), orientation(a, b, d), orientation(c, d, a), orientation(c, d, b)];
  if ((values[0] > EPSILON && values[1] < -EPSILON || values[0] < -EPSILON && values[1] > EPSILON) && (values[2] > EPSILON && values[3] < -EPSILON || values[2] < -EPSILON && values[3] > EPSILON)) return true;
  return Math.abs(values[0]) <= EPSILON && onSegment(a, c, b) || Math.abs(values[1]) <= EPSILON && onSegment(a, d, b) || Math.abs(values[2]) <= EPSILON && onSegment(c, a, d) || Math.abs(values[3]) <= EPSILON && onSegment(c, b, d);
}
function polygonSelfIntersects(points) {
  for (let first = 0; first < points.length; first += 1) {
    const firstNext = (first + 1) % points.length;
    for (let second = first + 1; second < points.length; second += 1) {
      const secondNext = (second + 1) % points.length;
      if (first === second || firstNext === second || secondNext === first) continue;
      if (first === 0 && secondNext === 0) continue;
      if (segmentsIntersect(points[first], points[firstNext], points[second], points[secondNext])) return true;
    }
  }
  return false;
}
function regionFromPolygon(points) {
  if (points.length < 3 || points.some((point) => !isNormalizedPoint(point))) return null;
  if (polygonArea(points) <= EPSILON || polygonSelfIntersects(points)) return null;
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const width = Math.max(...xs) - x;
  const height = Math.max(...ys) - y;
  if (width <= EPSILON || height <= EPSILON) return null;
  return { shape: "polygon", x, y, width, height, points: points.map((point) => ({ ...point })) };
}
function isValidListeningRegion(region) {
  if (!region || !["rect", "ellipse", "polygon"].includes(region.shape)) return false;
  if (![region.x, region.y, region.width, region.height].every(Number.isFinite)) return false;
  if (region.x < 0 || region.y < 0 || region.width <= 0 || region.height <= 0) return false;
  if (region.x + region.width > 1 + EPSILON || region.y + region.height > 1 + EPSILON) return false;
  if (region.shape !== "polygon") return true;
  const normalized = regionFromPolygon(region.points || []);
  if (!normalized) return false;
  return Math.abs(normalized.x - region.x) <= EPSILON && Math.abs(normalized.y - region.y) <= EPSILON && Math.abs(normalized.width - region.width) <= EPSILON && Math.abs(normalized.height - region.height) <= EPSILON;
}
function pointInListeningRegion(point, region) {
  if (!isNormalizedPoint(point)) return false;
  if (region.shape === "ellipse") {
    const rx = region.width / 2;
    const ry = region.height / 2;
    if (rx <= 0 || ry <= 0) return false;
    const dx = (point.x - region.x - rx) / rx;
    const dy = (point.y - region.y - ry) / ry;
    return dx * dx + dy * dy <= 1 + EPSILON;
  }
  if (region.shape === "polygon" && region.points?.length) {
    let inside = false;
    for (let index = 0, previous = region.points.length - 1; index < region.points.length; previous = index++) {
      const a = region.points[index];
      const b = region.points[previous];
      const crosses = a.y > point.y !== b.y > point.y && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y || EPSILON) + a.x;
      if (crosses) inside = !inside;
    }
    return inside;
  }
  return point.x >= region.x - EPSILON && point.x <= region.x + region.width + EPSILON && point.y >= region.y - EPSILON && point.y <= region.y + region.height + EPSILON;
}
function transformListeningPoint(point, sourceScene, targetScene) {
  if (!isValidListeningRegion(sourceScene) || !isValidListeningRegion(targetScene)) return null;
  const u = (point.x - sourceScene.x) / sourceScene.width;
  const v = (point.y - sourceScene.y) / sourceScene.height;
  if (!Number.isFinite(u) || !Number.isFinite(v) || u < -EPSILON || u > 1 + EPSILON || v < -EPSILON || v > 1 + EPSILON) return null;
  const transformed = {
    x: targetScene.x + Math.min(1, Math.max(0, u)) * targetScene.width,
    y: targetScene.y + Math.min(1, Math.max(0, v)) * targetScene.height
  };
  return isNormalizedPoint(transformed) ? transformed : null;
}

// src/features/listening-library/registry.ts
var DEFAULT_LISTENING_MODULE_ID = "mover";
var LISTENING_LIBRARY_SCHEMA_VERSION = 1;
var comingSoonCapabilities = {
  student: false,
  admin: false,
  scoring: false,
  assignments: false
};
var LISTENING_MODULES = [
  {
    id: "starter",
    displayName: "Starter",
    levelLabel: "Pre A1",
    description: "Kho \u0111\u1EC1 Pre A1 Starters \u0111ang \u0111\u01B0\u1EE3c chu\u1EA9n b\u1ECB.",
    status: "coming_soon",
    schemaVersion: 1,
    partCount: null,
    questionsPerPart: null,
    parts: [],
    capabilities: comingSoonCapabilities,
    papers: []
  },
  {
    id: "mover",
    displayName: "Mover",
    levelLabel: "A1",
    description: "Mover g\u1ED3m Listening v\xE0 Reading & Writing v\u1EDBi c\u1EA5u tr\xFAc ri\xEAng cho t\u1EEBng b\xE0i thi.",
    status: "active",
    schemaVersion: 1,
    partCount: 5,
    questionsPerPart: 5,
    parts: Array.from({ length: 5 }, (_, index) => ({
      id: `part-${index + 1}`,
      displayName: `Part ${index + 1}`,
      schemaVersion: 1,
      questionCount: 5
    })),
    capabilities: {
      student: true,
      admin: true,
      scoring: true,
      assignments: true
    },
    papers: [
      {
        id: "listening",
        displayName: "Listening",
        description: "B\u1ED9 \u0111\u1EC1 nghe Mover g\u1ED3m 5 Part v\xE0 25 c\xE2u t\u01B0\u01A1ng t\xE1c.",
        status: "active",
        schemaVersion: 1,
        partCount: 5,
        questionsPerPart: 5,
        parts: Array.from({ length: 5 }, (_, index) => ({
          id: `part-${index + 1}`,
          displayName: `Part ${index + 1}`,
          schemaVersion: 1,
          questionCount: 5
        })),
        capabilities: {
          student: true,
          admin: true,
          scoring: true,
          assignments: true
        }
      },
      {
        id: "reading-writing",
        displayName: "Reading & Writing",
        description: "B\u1ED9 \u0111\u1EC1 Mover Reading & Writing g\u1ED3m 6 Part v\xE0 40 c\xE2u.",
        status: "active",
        schemaVersion: 1,
        partCount: 6,
        questionsPerPart: [6, 6, 6, 7, 10, 5],
        parts: [6, 6, 6, 7, 10, 5].map((questionCount, index) => ({
          id: `part-${index + 1}`,
          displayName: `Part ${index + 1}`,
          schemaVersion: 1,
          questionCount
        })),
        capabilities: {
          student: true,
          admin: true,
          scoring: true,
          assignments: true
        }
      }
    ]
  },
  {
    id: "flyer",
    displayName: "Flyer",
    levelLabel: "A2",
    description: "Kho \u0111\u1EC1 A2 Flyers \u0111ang \u0111\u01B0\u1EE3c chu\u1EA9n b\u1ECB.",
    status: "coming_soon",
    schemaVersion: 1,
    partCount: null,
    questionsPerPart: null,
    parts: [],
    capabilities: comingSoonCapabilities,
    papers: []
  },
  {
    id: "ket",
    displayName: "KET",
    levelLabel: "A2 Key",
    description: "Kho \u0111\u1EC1 A2 Key (KET) \u0111ang \u0111\u01B0\u1EE3c chu\u1EA9n b\u1ECB.",
    status: "coming_soon",
    schemaVersion: 1,
    partCount: null,
    questionsPerPart: null,
    parts: [],
    capabilities: comingSoonCapabilities,
    papers: []
  },
  {
    id: "pet",
    displayName: "PET",
    levelLabel: "B1 Preliminary",
    description: "Kho \u0111\u1EC1 B1 Preliminary (PET) \u0111ang \u0111\u01B0\u1EE3c chu\u1EA9n b\u1ECB.",
    status: "coming_soon",
    schemaVersion: 1,
    partCount: null,
    questionsPerPart: null,
    parts: [],
    capabilities: comingSoonCapabilities,
    papers: []
  },
  {
    id: "fce",
    displayName: "FCE",
    levelLabel: "B2 First",
    description: "Kho \u0111\u1EC1 B2 First (FCE) \u0111ang \u0111\u01B0\u1EE3c chu\u1EA9n b\u1ECB.",
    status: "coming_soon",
    schemaVersion: 1,
    partCount: null,
    questionsPerPart: null,
    parts: [],
    capabilities: comingSoonCapabilities,
    papers: []
  },
  {
    id: "ielts",
    displayName: "IELTS",
    levelLabel: "Academic & General",
    description: "Kho \u0111\u1EC1 IELTS Academic v\xE0 General Training \u0111ang \u0111\u01B0\u1EE3c chu\u1EA9n b\u1ECB.",
    status: "coming_soon",
    schemaVersion: 1,
    partCount: null,
    questionsPerPart: null,
    parts: [],
    capabilities: comingSoonCapabilities,
    papers: []
  }
];
var moduleMap = new Map(
  LISTENING_MODULES.map((module2) => [module2.id, module2])
);
function isListeningModuleId(value) {
  return typeof value === "string" && moduleMap.has(value);
}
function getListeningModule(moduleId) {
  return moduleMap.get(moduleId);
}
function getVisibleListeningModules() {
  return LISTENING_MODULES.filter((module2) => module2.status !== "hidden");
}
function resolveListeningModuleId(value) {
  return isListeningModuleId(value) ? value : DEFAULT_LISTENING_MODULE_ID;
}
function publicListeningModuleManifest(module2) {
  return {
    id: module2.id,
    displayName: module2.displayName,
    levelLabel: module2.levelLabel,
    description: module2.description,
    status: module2.status,
    schemaVersion: module2.schemaVersion,
    partCount: module2.partCount,
    questionsPerPart: module2.questionsPerPart,
    parts: module2.parts,
    capabilities: module2.capabilities,
    papers: module2.papers
  };
}

// src/features/listening/reviewPresentation.ts
var INTERNAL_LISTENING_ID = /\bp[1-5]-(?:target|question|item|choice|option|colour|color|blank)-[a-z0-9-]{8,}\b/i;
var LISTENING_BLANK_TOKEN = /\{\{[a-zA-Z0-9_-]+\}\}/g;
function normalizedPart(value, globalIndex) {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 5) return parsed;
  return Math.min(5, Math.max(1, Math.floor(Math.max(0, globalIndex) / 5) + 1));
}
function defaultListeningReviewQuestion(partValue, globalIndex) {
  const part = normalizedPart(partValue, globalIndex);
  const position = Math.max(0, globalIndex) % 5 + 1;
  if (part === 1) return `Part 1 \xB7 V\u1ECB tr\xED nh\xE2n v\u1EADt ${position}`;
  if (part === 5) return `Part 5 \xB7 V\xF9ng t\xF4 m\xE0u ${position}`;
  return `Part ${part} \xB7 C\xE2u ${position}`;
}
function formatListeningReviewQuestion(value, partValue, globalIndex) {
  const source = String(value ?? "").trim();
  const withoutTokens = source.replace(LISTENING_BLANK_TOKEN, "_____").replace(/\s*[•]\s*/g, " \xB7 ").replace(/\s+/g, " ").trim();
  if (!withoutTokens || INTERNAL_LISTENING_ID.test(withoutTokens)) {
    return defaultListeningReviewQuestion(partValue, globalIndex);
  }
  return withoutTokens;
}
function formatListeningReviewAnswer(value) {
  const source = String(value ?? "").trim();
  if (!source) return "";
  return INTERNAL_LISTENING_ID.test(source) ? "Kh\xF4ng c\xF3 d\u1EEF li\u1EC7u hi\u1EC3n th\u1ECB" : source;
}

// src/server/listening/listeningGrader.ts
var LISTENING_GRADING_VERSION = "listening-five-part-v2";
function normalizeListeningTextAnswer(value) {
  return String(value ?? "").normalize("NFKC").trim().toLocaleLowerCase("en").replace(/[\u2018\u2019\u02bc\u0060]/g, "'").replace(/\s+/g, " ");
}
function gradeTextQuestion(question, answer) {
  let unanswered = true;
  const correct = question.blanks.every((blank) => {
    const actual = normalizeListeningTextAnswer(answer?.[blank.id]);
    if (actual) unanswered = false;
    return Boolean(actual) && blank.acceptedAnswers.some(
      (accepted) => normalizeListeningTextAnswer(accepted) === actual
    );
  });
  return { correct, unanswered };
}
function resolveListeningPart5SubmittedActions(actions, answers) {
  const submittedAnswers = Object.values(answers || {}).filter((answer) => Boolean(answer) && typeof answer === "object");
  const resolved = /* @__PURE__ */ new Map();
  const usedAnswers = /* @__PURE__ */ new Set();
  const assign = (action, answer) => {
    if (!answer || usedAnswers.has(answer)) return false;
    resolved.set(action.id, answer);
    usedAnswers.add(answer);
    return true;
  };
  actions.forEach((action) => {
    const direct = answers?.[action.id];
    if (direct && typeof direct === "object" && direct.type === action.type) assign(action, direct);
  });
  actions.filter((action) => action.type === "colour_object").forEach((action) => {
    if (resolved.has(action.id) || action.type !== "colour_object") return;
    assign(action, submittedAnswers.find((answer) => !usedAnswers.has(answer) && answer.type === "colour_object" && answer.objectId === action.correctObjectId));
  });
  const placeActions = actions.filter((action) => action.type === "place_object");
  const placeAnswers = submittedAnswers.filter((answer) => answer.type === "place_object");
  placeActions.forEach((action) => {
    if (resolved.has(action.id)) return;
    const inside = placeAnswers.filter((answer) => !usedAnswers.has(answer) && pointInListeningRegion(answer.anchor, action.targetRegion));
    assign(action, inside.find((answer) => answer.paletteItemId === action.correctPaletteItemId) || inside[0]);
  });
  placeActions.forEach((action) => {
    if (resolved.has(action.id)) return;
    assign(action, placeAnswers.find((answer) => !usedAnswers.has(answer) && answer.paletteItemId === action.correctPaletteItemId));
  });
  const nearestPairs = placeActions.flatMap((action) => {
    if (resolved.has(action.id)) return [];
    const targetX = action.targetRegion.x + action.targetRegion.width / 2;
    const targetY = action.targetRegion.y + action.targetRegion.height / 2;
    return placeAnswers.flatMap((answer) => {
      if (usedAnswers.has(answer)) return [];
      const distance = (answer.anchor.x - targetX) ** 2 + (answer.anchor.y - targetY) ** 2;
      return [{ action, answer, distance }];
    });
  }).sort((left, right) => left.distance - right.distance);
  nearestPairs.forEach(({ action, answer }) => {
    if (!resolved.has(action.id) && !usedAnswers.has(answer)) assign(action, answer);
  });
  return resolved;
}
function gradeListeningAttempt(content, answers) {
  const questions = [];
  const push = (part, questionId, correct, unanswered) => questions.push({ part, questionId, correct, unanswered });
  for (const target of content.parts[0].targets) {
    const actual = answers.part1?.[target.id] || "";
    push(1, target.id, actual === target.choiceId, !actual);
  }
  for (const question of content.parts[1].questions) {
    const result = gradeTextQuestion(question, answers.part2?.[question.id]);
    push(2, question.id, result.correct, result.unanswered);
  }
  const part3 = content.parts[2];
  if (part3.displayMode === "connect-image") {
    for (const connection of part3.correctConnections) {
      const actual = answers.part3?.[connection.answerId] || "";
      push(3, connection.answerId, actual === connection.pictureId, !actual);
    }
  } else {
    for (const item of part3.items) {
      const actual = answers.part3?.[item.id] || "";
      push(3, item.id, actual === item.correctOptionId, !actual);
    }
  }
  for (const question of content.parts[3].questions) {
    const actual = answers.part4?.[question.id] || "";
    push(4, question.id, actual === question.correctOptionId, !actual);
  }
  const part5 = content.parts[4];
  if (part5.displayMode === "scene-colour-draw") {
    const resolvedPart5Answers = resolveListeningPart5SubmittedActions(
      part5.questions.flatMap((question) => question.actions),
      answers.part5
    );
    for (const question of part5.questions) {
      const submitted = question.actions.map((action) => resolvedPart5Answers.get(action.id));
      const unanswered = submitted.every((answer) => !answer);
      const correct = question.actions.length > 0 && question.actions.every((action, index) => {
        const answer = submitted[index];
        if (action.type === "colour_object") {
          return Boolean(
            answer && typeof answer === "object" && answer.type === "colour_object" && answer.objectId === action.correctObjectId && answer.colourId === action.correctColourId
          );
        }
        return Boolean(
          answer && typeof answer === "object" && answer.type === "place_object" && answer.paletteItemId === action.correctPaletteItemId && pointInListeningRegion(answer.anchor, action.targetRegion)
        );
      });
      push(5, question.id, correct, unanswered);
    }
  } else {
    for (const target of part5.targets) {
      const actual = answers.part5?.[target.id] || "";
      push(5, target.id, actual === target.correctColourId, !actual);
    }
  }
  if (questions.length !== 25) {
    throw new Error(`Published listening version must contain exactly 25 questions; received ${questions.length}.`);
  }
  const correctCount = questions.filter((question) => question.correct).length;
  const unansweredCount = questions.filter((question) => question.unanswered).length;
  const incorrectCount = questions.length - correctCount - unansweredCount;
  return {
    score: Math.round(correctCount / 25 * 100),
    correctCount,
    incorrectCount,
    unansweredCount,
    totalCount: 25,
    questions
  };
}

// src/server/listening/listeningActivity.ts
var activityText = (value, max = 1e3) => String(value ?? "").trim().slice(0, max);
function buildListeningReviewTranscripts(content) {
  if (!Array.isArray(content?.parts)) return [];
  return content.parts.flatMap((part) => {
    const transcript = typeof part?.audioTranscript === "string" ? part.audioTranscript.replace(/\r\n?/g, "\n").trim().slice(0, LISTENING_TRANSCRIPT_MAX_CHARS) : "";
    return transcript ? [{ part: part.part, text: transcript }] : [];
  });
}
function labelForId(items, id, getLabel) {
  const normalizedId = activityText(id, 200);
  const index = items.findIndex((item) => item.id === normalizedId);
  return index >= 0 ? activityText(getLabel(items[index], index), 500) : formatListeningReviewAnswer(normalizedId);
}
function buildListeningActivityAnswerDetails(content, answers, questions) {
  const resultByQuestion = new Map(
    questions.map((question) => [`${question.part}:${question.questionId}`, question])
  );
  const details = [];
  const push = (part, questionId, questionText, userAnswer, correctAnswer, options = []) => {
    const result = resultByQuestion.get(`${part}:${questionId}`);
    details.push({
      questionIndex: details.length,
      questionId,
      questionText: formatListeningReviewQuestion(questionText, part, details.length),
      part,
      selectedAnswer: formatListeningReviewAnswer(activityText(userAnswer, 1e3)),
      userAnswer: formatListeningReviewAnswer(activityText(userAnswer, 1e3)),
      correctAnswer: formatListeningReviewAnswer(activityText(correctAnswer, 1e3)),
      isCorrect: Boolean(result?.correct),
      unanswered: Boolean(result?.unanswered),
      options: options.map((option) => activityText(option, 500)).filter(Boolean).slice(0, 20)
    });
  };
  const part1 = content.parts[0];
  const part1Options = part1.choices.map((choice2) => choice2.label);
  part1.targets.forEach((target, index) => {
    push(
      1,
      target.id,
      formatListeningReviewQuestion("", 1, index),
      labelForId(part1.choices, answers.part1[target.id], (choice2) => choice2.label),
      labelForId(part1.choices, target.choiceId, (choice2) => choice2.label),
      part1Options
    );
  });
  const part2 = content.parts[1];
  part2.questions.forEach((question, index) => {
    const answer = answers.part2[question.id] || {};
    const userAnswer = question.blanks.map((blank) => activityText(answer[blank.id], 500)).filter(Boolean).join(" | ");
    const correctAnswer = question.blanks.map((blank) => blank.acceptedAnswers.map((item) => activityText(item, 500)).filter(Boolean).join(" / ")).filter(Boolean).join(" | ");
    push(2, question.id, formatListeningReviewQuestion(question.prompt, 2, index + 5), userAnswer, correctAnswer);
  });
  const part3 = content.parts[2];
  if (part3.displayMode === "connect-image") {
    part3.correctConnections.forEach((connection, index) => {
      const answer = part3.answers.find((item) => item.id === connection.answerId);
      push(
        3,
        connection.answerId,
        formatListeningReviewQuestion(`Part 3 \u2022 ${answer?.label || ""}`, 3, index + 10),
        labelForId(part3.pictures, answers.part3[connection.answerId], (picture) => `${picture.side} ${picture.row}`),
        labelForId(part3.pictures, connection.pictureId, (picture) => `${picture.side} ${picture.row}`),
        part3.pictures.map((picture) => `${picture.side} ${picture.row}`)
      );
    });
  } else {
    const part3Options = part3.options.map((option) => option.label);
    part3.items.forEach((item, index) => {
      push(
        3,
        item.id,
        formatListeningReviewQuestion(`Part 3 \u2022 ${item.label || ""}`, 3, index + 10),
        labelForId(part3.options, answers.part3[item.id], (option) => option.label),
        labelForId(part3.options, item.correctOptionId, (option) => option.label),
        part3Options
      );
    });
  }
  const part4 = content.parts[3];
  part4.questions.forEach((question, questionIndex) => {
    const optionLabels = question.options.map((option, index) => option.alt || String.fromCharCode(65 + index));
    push(
      4,
      question.id,
      formatListeningReviewQuestion(question.prompt, 4, questionIndex + 15),
      labelForId(question.options, answers.part4[question.id], (option, index) => option.alt || String.fromCharCode(65 + index)),
      labelForId(question.options, question.correctOptionId, (option, index) => option.alt || String.fromCharCode(65 + index)),
      optionLabels
    );
  });
  const part5 = content.parts[4];
  const part5Options = part5.colours.map((colour) => colour.label);
  if (part5.displayMode === "scene-colour-draw") {
    const resolvedPart5Answers = resolveListeningPart5SubmittedActions(
      part5.questions.flatMap((question) => question.actions),
      answers.part5
    );
    part5.questions.forEach((question, index) => {
      const userAnswer = question.actions.map((action) => {
        const answer = resolvedPart5Answers.get(action.id);
        if (!answer || typeof answer === "string") return activityText(answer, 500);
        if (answer.type === "colour_object") {
          const object = part5.interactiveObjects.find((item2) => item2.id === answer.objectId)?.label || answer.objectId;
          const colour = part5.colours.find((item2) => item2.id === answer.colourId)?.label || answer.colourId;
          return `${object}: ${colour}`;
        }
        const item = part5.objectPalette.find((entry) => entry.id === answer.paletteItemId)?.label || answer.paletteItemId;
        return item;
      }).filter(Boolean).join(" | ");
      const correctAnswer = question.actions.map((action) => {
        if (action.type === "colour_object") {
          const object = part5.interactiveObjects.find((item) => item.id === action.correctObjectId)?.label || action.correctObjectId;
          const colour = part5.colours.find((item) => item.id === action.correctColourId)?.label || action.correctColourId;
          return `${object}: ${colour}`;
        }
        return part5.objectPalette.find((item) => item.id === action.correctPaletteItemId)?.label || action.correctPaletteItemId;
      }).join(" | ");
      push(5, question.id, formatListeningReviewQuestion(question.staffPrompt, 5, index + 20), userAnswer, correctAnswer, part5Options);
    });
  } else {
    part5.targets.forEach((target, index) => {
      push(
        5,
        target.id,
        formatListeningReviewQuestion(`Part 5 \u2022 ${target.label || ""}`, 5, index + 20),
        labelForId(part5.colours, answers.part5[target.id], (colour) => colour.label),
        labelForId(part5.colours, target.correctColourId, (colour) => colour.label),
        part5Options
      );
    });
  }
  return details;
}
function visualReviewState(detail) {
  if (detail?.unanswered) return "unanswered";
  return detail?.isCorrect ? "correct" : "incorrect";
}
function visualReviewBase(detail, questionIndex) {
  return {
    questionIndex,
    state: visualReviewState(detail),
    userAnswer: activityText(detail?.userAnswer || detail?.selectedAnswer, 1e3),
    correctAnswer: activityText(detail?.correctAnswer, 1e3)
  };
}
function visualReviewPicture(picture) {
  return {
    label: activityText(picture?.label || `${picture?.side || ""} ${picture?.row || ""}`, 200),
    side: picture.side,
    row: picture.row,
    region: structuredClone(picture.region),
    anchorOffset: Number(picture.anchorOffset)
  };
}
function buildListeningVisualReviewSnapshot(content, answers, questions, suppliedAnswerDetails) {
  const details = suppliedAnswerDetails || buildListeningActivityAnswerDetails(content, answers, questions);
  const detailAt = (index) => details[index];
  const part1 = content.parts[0];
  const part2 = content.parts[1];
  const part3 = content.parts[2];
  const part4 = content.parts[3];
  const part5 = content.parts[4];
  const resolvedScenePart5Answers = part5.displayMode === "scene-colour-draw" ? resolveListeningPart5SubmittedActions(
    part5.questions.flatMap((question) => question.actions),
    answers.part5
  ) : /* @__PURE__ */ new Map();
  const reviewPart1 = {
    part: 1,
    mode: "scene-targets",
    imageUrl: part1.sceneUrl,
    items: part1.targets.map((target, index) => ({
      ...visualReviewBase(detailAt(index), index),
      region: structuredClone(target.region)
    }))
  };
  const reviewPart2 = {
    part: 2,
    mode: "text-questions",
    imageUrl: part2.illustrationUrl,
    heading: activityText(part2.heading, 500),
    exampleText: activityText(part2.exampleText, 1e3) || void 0,
    items: part2.questions.map((question, index) => ({
      ...visualReviewBase(detailAt(index + 5), index + 5),
      prompt: formatListeningReviewQuestion(question.prompt, 2, index + 5)
    }))
  };
  const reviewPart3 = part3.displayMode === "connect-image" ? {
    part: 3,
    mode: "connect-image",
    imageUrl: part3.boardUrl,
    items: part3.correctConnections.flatMap((connection, index) => {
      const answer = part3.answers.find((item) => item.id === connection.answerId);
      const correctPicture = part3.pictures.find((item) => item.id === connection.pictureId);
      if (!answer || !correctPicture) return [];
      const submittedPicture = part3.pictures.find((item) => item.id === answers.part3[connection.answerId]);
      return [{
        ...visualReviewBase(detailAt(index + 10), index + 10),
        answerLabel: activityText(answer.label, 300),
        answerRegion: structuredClone(answer.region),
        leftAnchorOffset: Number(answer.leftAnchorOffset),
        rightAnchorOffset: Number(answer.rightAnchorOffset),
        ...submittedPicture ? { userPicture: visualReviewPicture(submittedPicture) } : {},
        correctPicture: visualReviewPicture(correctPicture)
      }];
    })
  } : {
    part: 3,
    mode: "image-options",
    imageUrl: part3.displayMode === "composite" ? part3.boardUrl : void 0,
    items: part3.items.map((item, index) => ({
      ...visualReviewBase(detailAt(index + 10), index + 10),
      prompt: activityText(item.label, 500),
      options: part3.options.map((option, optionIndex2) => ({
        label: String.fromCharCode(65 + optionIndex2),
        alt: activityText(option.label, 500),
        imageUrl: option.imageUrl
      })),
      selectedOptionIndex: part3.options.findIndex((option) => option.id === answers.part3[item.id]),
      correctOptionIndex: part3.options.findIndex((option) => option.id === item.correctOptionId)
    }))
  };
  const reviewPart4 = {
    part: 4,
    mode: "image-options",
    items: part4.questions.map((question, index) => ({
      ...visualReviewBase(detailAt(index + 15), index + 15),
      prompt: activityText(question.prompt, 1e3),
      options: question.options.map((option, optionIndex2) => ({
        label: String.fromCharCode(65 + optionIndex2),
        alt: activityText(option.alt, 500),
        imageUrl: option.imageUrl
      })),
      selectedOptionIndex: question.options.findIndex((option) => option.id === answers.part4[question.id]),
      correctOptionIndex: question.options.findIndex((option) => option.id === question.correctOptionId)
    }))
  };
  const reviewPart5 = part5.displayMode === "scene-colour-draw" ? {
    part: 5,
    mode: "scene-colour-draw",
    imageUrl: part5.sceneUrl,
    items: part5.questions.map((question, index) => {
      const actions = question.actions.reduce((reviewActions, action) => {
        const submitted = resolvedScenePart5Answers.get(action.id);
        if (action.type === "colour_object") {
          const object = part5.interactiveObjects.find((item) => item.id === action.correctObjectId);
          const correctColour = part5.colours.find((item) => item.id === action.correctColourId);
          if (!object || !correctColour) return reviewActions;
          const userColour = submitted && typeof submitted === "object" && submitted.type === "colour_object" ? part5.colours.find((item) => item.id === submitted.colourId) : void 0;
          const correct2 = Boolean(
            submitted && typeof submitted === "object" && submitted.type === "colour_object" && submitted.objectId === action.correctObjectId && submitted.colourId === action.correctColourId
          );
          reviewActions.push({
            type: "colour",
            state: !submitted ? "unanswered" : correct2 ? "correct" : "incorrect",
            region: structuredClone(object.geometry),
            ...userColour ? { userColour: { label: activityText(userColour.label, 200), value: activityText(userColour.value, 50) } } : {},
            correctColour: { label: activityText(correctColour.label, 200), value: activityText(correctColour.value, 50) }
          });
          return reviewActions;
        }
        const correctItem = part5.objectPalette.find((item) => item.id === action.correctPaletteItemId);
        if (!correctItem) return reviewActions;
        const placeAnswer = submitted && typeof submitted === "object" && submitted.type === "place_object" ? submitted : void 0;
        const userItem = placeAnswer ? part5.objectPalette.find((item) => item.id === placeAnswer.paletteItemId) : void 0;
        const correct = Boolean(
          placeAnswer && placeAnswer.paletteItemId === action.correctPaletteItemId && pointInListeningRegion(placeAnswer.anchor, action.targetRegion)
        );
        reviewActions.push({
          type: "place",
          state: !placeAnswer ? "unanswered" : correct ? "correct" : "incorrect",
          ...placeAnswer ? { userAnchor: { ...placeAnswer.anchor } } : {},
          correctAnchor: {
            x: Math.max(0, Math.min(1, action.targetRegion.x + action.targetRegion.width / 2)),
            y: Math.max(0, Math.min(1, action.targetRegion.y + action.targetRegion.height / 2))
          },
          ...userItem ? { userItem: { label: activityText(userItem.label, 200), tokenUrl: userItem.tokenUrl } } : {},
          correctItem: { label: activityText(correctItem.label, 200), tokenUrl: correctItem.tokenUrl }
        });
        return reviewActions;
      }, []);
      const state = actions.length > 0 && actions.every((action) => action.state === "correct") ? "correct" : actions.length === 0 || actions.every((action) => action.state === "unanswered") ? "unanswered" : "incorrect";
      return {
        ...visualReviewBase(detailAt(index + 20), index + 20),
        state,
        prompt: activityText(question.staffPrompt, 1e3),
        actions
      };
    })
  } : {
    part: 5,
    mode: "scene-colour",
    imageUrl: part5.sceneUrl,
    items: part5.targets.flatMap((target, index) => {
      const correctColour = part5.colours.find((colour) => colour.id === target.correctColourId);
      if (!correctColour) return [];
      const submittedColourId = typeof answers.part5[target.id] === "string" ? answers.part5[target.id] : "";
      const userColour = part5.colours.find((colour) => colour.id === submittedColourId);
      return [{
        ...visualReviewBase(detailAt(index + 20), index + 20),
        region: structuredClone(target.region),
        ...userColour ? { userColour: { label: activityText(userColour.label, 200), value: activityText(userColour.value, 50) } } : {},
        correctColour: { label: activityText(correctColour.label, 200), value: activityText(correctColour.value, 50) }
      }];
    })
  };
  return {
    schemaVersion: 2,
    parts: [reviewPart1, reviewPart2, reviewPart3, reviewPart4, reviewPart5]
  };
}
function normalizeListeningVisualReviewSnapshot(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return void 0;
  const source = value;
  if (source.schemaVersion !== 2 || !Array.isArray(source.parts) || source.parts.length !== 5) return void 0;
  const serialized = JSON.stringify(source);
  if (serialized.length > 75e4 || /"targetRegion"\s*:/i.test(serialized)) return void 0;
  const partNumbers = source.parts.map((part) => Number(part?.part));
  if (partNumbers.some((part, index) => part !== index + 1)) return void 0;
  if (source.parts.some((part) => !Array.isArray(part?.items) || part.items.length > 25)) return void 0;
  return structuredClone(source);
}
function normalizeListeningActivityAnswerDetails(detail) {
  if (!Array.isArray(detail?.answerDetails)) return [];
  return detail.answerDetails.slice(0, 200).map((item, index) => ({
    questionIndex: Number.isFinite(Number(item?.questionIndex)) ? Number(item.questionIndex) : index,
    part: Number(item?.part || 0),
    questionText: formatListeningReviewQuestion(
      item?.questionText || (item?.part ? `Part ${item.part}` : ""),
      item?.part,
      index
    ),
    selectedAnswer: formatListeningReviewAnswer(item?.selectedAnswer || item?.userAnswer),
    userAnswer: formatListeningReviewAnswer(item?.userAnswer || item?.selectedAnswer),
    correctAnswer: formatListeningReviewAnswer(item?.correctAnswer),
    isCorrect: Boolean(item?.isCorrect),
    unanswered: Boolean(item?.unanswered),
    options: Array.isArray(item?.options) ? item.options.map((option) => activityText(option, 500)).filter(Boolean).slice(0, 20) : []
  }));
}
async function resolveListeningActivityDetailForStaff(db, attempt, versionContentCache = /* @__PURE__ */ new Map()) {
  const attemptId = activityText(attempt?.id, 200);
  if (!attemptId) return null;
  const detailSnapshot = await db.collection("listening_attempt_details").doc(attemptId).get();
  if (!detailSnapshot.exists) return null;
  const storedDetail = { id: detailSnapshot.id, ...detailSnapshot.data() };
  const versionId = activityText(attempt?.versionId || storedDetail?.extraDetails?.versionId, 200);
  if (!versionId || !storedDetail?.answers || !Array.isArray(storedDetail?.questions)) {
    return storedDetail;
  }
  let contentPromise = versionContentCache.get(versionId);
  if (!contentPromise) {
    contentPromise = (async () => {
      const versionSnapshot = await db.collection("listening_set_versions").doc(versionId).get();
      if (!versionSnapshot.exists) return null;
      return versionSnapshot.data()?.content;
    })();
    versionContentCache.set(versionId, contentPromise);
  }
  const content = await contentPromise;
  if (!content) return storedDetail;
  try {
    return {
      ...storedDetail,
      answerDetails: buildListeningActivityAnswerDetails(
        content,
        storedDetail.answers,
        storedDetail.questions
      )
    };
  } catch {
    return storedDetail;
  }
}
function listeningAttemptToActivity(attempt, detail) {
  const totalQuestions = Math.max(
    1,
    Number(attempt.totalCount || 0) || Number(attempt.correctCount || 0) + Number(attempt.incorrectCount || 0) + Number(attempt.unansweredCount || 0)
  );
  const answerDetails = normalizeListeningActivityAnswerDetails(detail);
  return {
    id: attempt.id,
    sourceType: "listening",
    sourceId: attempt.id,
    moduleId: resolveListeningModuleId(attempt.moduleId),
    moduleSchemaVersion: Number(attempt.schemaVersion || LISTENING_LIBRARY_SCHEMA_VERSION),
    ownerKey: attempt.ownerKey,
    ownerType: attempt.guestId ? "guest" : "user",
    userId: attempt.userId || "",
    studentId: attempt.userId || attempt.guestId || "",
    guestId: attempt.guestId || "",
    studentName: attempt.studentName || "H\u1ECDc sinh",
    assignmentId: attempt.assignmentId || "",
    classId: attempt.classId || "",
    className: attempt.className || "",
    vocabSetId: `listening:${attempt.setId}`,
    vocabSetTitle: attempt.setTitle || "B\u1ED9 \u0111\u1EC1 nghe 5 Part",
    gameId: "listening-five-part",
    gameName: "Nghe 5 Part",
    gameType: "listening",
    startedAt: attempt.startedAt,
    endedAt: attempt.completedAt,
    completedAt: attempt.completedAt,
    createdAt: attempt.createdAt || attempt.completedAt,
    durationMs: Math.max(0, Number(attempt.durationSeconds || 0)) * 1e3,
    durationSeconds: Math.max(0, Number(attempt.durationSeconds || 0)),
    score: Math.max(0, Math.min(100, Number(attempt.score || 0))),
    rawScore: Math.max(0, Math.min(100, Number(attempt.score || 0))),
    maxScore: 100,
    totalQuestions,
    correctAnswers: Math.max(0, Number(attempt.correctCount || 0)),
    incorrectAnswers: Math.max(0, Number(attempt.incorrectCount || 0)) + Math.max(0, Number(attempt.unansweredCount || 0)),
    accuracy: Math.round(Math.max(0, Number(attempt.correctCount || 0)) / totalQuestions * 100),
    ...answerDetails.length ? { answerDetails } : {},
    status: "completed"
  };
}

// src/features/mover-reading-writing/types.ts
var MOVER_READING_WRITING_PAPER_ID = "reading-writing";
var MOVER_READING_WRITING_LEGACY_SCHEMA_VERSION = 1;
var MOVER_READING_WRITING_SCHEMA_VERSION = 2;
var MOVER_READING_WRITING_PART_COUNTS = [6, 6, 6, 7, 10, 5];
var MOVER_READING_WRITING_TOTAL_QUESTIONS = 40;

// src/features/mover-reading-writing/compatibility.ts
var INTERNAL_MARKER = /\{\{[^}]+\}\}/;
var PRINTED_BLANK = /(?:_{3,}|\.{4,}|(?:\.\s*){4,}|…{2,})/;
function isSupportedMoverReadingWritingSchemaVersion(value) {
  return value === MOVER_READING_WRITING_LEGACY_SCHEMA_VERSION || value === MOVER_READING_WRITING_SCHEMA_VERSION;
}
function ensureInlineQuestionTemplate(prompt, questionId) {
  const source = String(prompt || "").trim();
  const marker = `{{${questionId}}}`;
  if (source.includes(marker) || INTERNAL_MARKER.test(source)) return source;
  if (PRINTED_BLANK.test(source)) return source.replace(PRINTED_BLANK, marker);
  return source ? `${source} ${marker}` : marker;
}
function normalizeTextQuestion(question) {
  const id = String(question?.id || "");
  return {
    ...question,
    id,
    prompt: ensureInlineQuestionTemplate(String(question?.prompt || ""), id),
    acceptedAnswers: Array.isArray(question?.acceptedAnswers) ? question.acceptedAnswers.map((answer) => String(answer)) : []
  };
}
function normalizePart6Gap(gap) {
  if (Array.isArray(gap?.acceptedAnswers)) {
    return {
      id: String(gap.id || ""),
      acceptedAnswers: gap.acceptedAnswers.map((answer) => String(answer))
    };
  }
  const options = Array.isArray(gap?.options) ? gap.options : [];
  const correct = options.find((option) => option?.id === gap?.correctOptionId);
  const correctText = String(correct?.text || "").trim();
  return {
    id: String(gap?.id || ""),
    acceptedAnswers: correctText ? [correctText] : []
  };
}
function normalizeMoverReadingWritingContent(value) {
  const content = structuredClone(value);
  if (!content || !isSupportedMoverReadingWritingSchemaVersion(content.schemaVersion)) {
    throw new Error("Phi\xEAn b\u1EA3n c\u1EA5u tr\xFAc Reading & Writing kh\xF4ng \u0111\u01B0\u1EE3c h\u1ED7 tr\u1EE3.");
  }
  if (!Array.isArray(content.parts) || content.parts.length !== 6) {
    throw new Error("Reading & Writing c\u1EA7n \u0111\xFAng 6 Part.");
  }
  content.schemaVersion = MOVER_READING_WRITING_SCHEMA_VERSION;
  content.parts[0].questions = Array.isArray(content.parts[0]?.questions) ? content.parts[0].questions.map(normalizeTextQuestion) : [];
  content.parts[4].scenes = Array.isArray(content.parts[4]?.scenes) ? content.parts[4].scenes.map((scene) => ({
    ...scene,
    questions: Array.isArray(scene?.questions) ? scene.questions.map(normalizeTextQuestion) : []
  })) : [];
  content.parts[5].gaps = Array.isArray(content.parts[5]?.gaps) ? content.parts[5].gaps.map(normalizePart6Gap) : [];
  return content;
}

// src/server/mover-reading-writing/moverReadingWritingReview.ts
var reviewText = (value, max = 2e4) => String(value ?? "").trim().slice(0, max);
function reviewState(result) {
  if (result.unanswered) return "unanswered";
  return result.correct ? "correct" : "incorrect";
}
function optionAnswer(question, index) {
  const option = question.options[index];
  return option ? `${String.fromCharCode(65 + index)}. ${reviewText(option.text, 1e3)}`.trim() : "";
}
function optionIndexFromAnswer(question, answer) {
  const normalized = reviewText(answer, 1e3);
  return question.options.findIndex((_option, index) => optionAnswer(question, index) === normalized);
}
function presentationTemplate(template, gaps) {
  return gaps.reduce(
    (value, gap, index) => value.split(`{{${gap.id}}}`).join(`{{${index + 1}}}`),
    reviewText(template)
  );
}
function safeExample(example) {
  if (!example) return void 0;
  const prompt = reviewText(example.prompt, 2e3);
  const answer = reviewText(example.answer, 1e3);
  return prompt || answer ? { prompt, answer } : void 0;
}
function baseItem(result, questionNumber2, prompt) {
  return {
    questionNumber: questionNumber2,
    state: reviewState(result),
    prompt: reviewText(prompt, 2e3),
    userAnswer: reviewText(result.userAnswer, 1e3),
    correctAnswer: reviewText(result.correctAnswer, 1e3)
  };
}
function choiceItem(result, questionNumber2, question) {
  return {
    ...baseItem(result, questionNumber2, question.prompt),
    options: question.options.map((option, index) => ({
      label: String.fromCharCode(65 + index),
      text: reviewText(option.text, 1e3)
    })),
    selectedOptionIndex: optionIndexFromAnswer(question, result.userAnswer),
    correctOptionIndex: optionIndexFromAnswer(question, result.correctAnswer)
  };
}
function assertReviewQuestions(questions) {
  if (questions.length !== MOVER_READING_WRITING_TOTAL_QUESTIONS) {
    throw new Error(`Reading & Writing visual review requires ${MOVER_READING_WRITING_TOTAL_QUESTIONS} results.`);
  }
  MOVER_READING_WRITING_PART_COUNTS.forEach((count, index) => {
    const part = index + 1;
    if (questions.filter((question) => question.part === part).length !== count) {
      throw new Error(`Reading & Writing visual review Part ${part} requires ${count} results.`);
    }
  });
}
function buildMoverReadingWritingVisualReviewSnapshot(inputContent, questions) {
  const content = normalizeMoverReadingWritingContent(inputContent);
  assertReviewQuestions(questions);
  const byQuestion = new Map(questions.map((question) => [`${question.part}:${question.questionId}`, question]));
  const resultFor = (part, questionId) => {
    const result = byQuestion.get(`${part}:${questionId}`);
    if (!result) throw new Error(`Missing Reading & Writing visual review result for Part ${part}.`);
    return result;
  };
  const common = (part) => ({
    title: reviewText(part.title, 500),
    instruction: reviewText(part.instruction, 2e3)
  });
  const part1 = content.parts[0];
  const reviewPart1 = {
    part: 1,
    mode: "text-questions",
    ...common(part1),
    imageUrl: part1.wordBankUrl,
    example: safeExample(part1.example),
    items: part1.questions.map((question, index) => baseItem(
      resultFor(1, question.id),
      index + 1,
      question.prompt.split(`{{${question.id}}}`).join(`{{${index + 1}}}`)
    ))
  };
  const part2 = content.parts[1];
  const reviewPart2 = {
    part: 2,
    mode: "yes-no",
    ...common(part2),
    imageUrl: part2.sceneUrl,
    examples: part2.examples.map((example) => ({
      prompt: reviewText(example.prompt, 2e3),
      answer: reviewText(example.answer, 1e3)
    })),
    items: part2.questions.map((question, index) => {
      const result = resultFor(2, question.id);
      const selectedAnswer = reviewText(result.userAnswer).toLowerCase();
      const correctAnswer = reviewText(result.correctAnswer).toLowerCase();
      const options = [
        { label: "YES", text: "" },
        { label: "NO", text: "" }
      ];
      return {
        ...baseItem(result, index + 1, question.statement),
        options,
        selectedOptionIndex: selectedAnswer === "yes" ? 0 : selectedAnswer === "no" ? 1 : -1,
        correctOptionIndex: correctAnswer === "yes" ? 0 : correctAnswer === "no" ? 1 : -1
      };
    })
  };
  const part3 = content.parts[2];
  const part3Example = part3.example ? {
    prompt: reviewText(part3.example.prompt, 2e3),
    answer: optionAnswer(
      part3.example,
      part3.example.options.findIndex((option) => option.id === part3.example?.correctOptionId)
    )
  } : void 0;
  const reviewPart3 = {
    part: 3,
    mode: "text-options",
    ...common(part3),
    imageUrl: part3.sceneUrl,
    example: part3Example,
    items: part3.questions.map((question, index) => choiceItem(resultFor(3, question.id), index + 1, question))
  };
  const part4 = content.parts[3];
  const reviewPart4 = {
    part: 4,
    mode: "story-gaps-title",
    ...common(part4),
    imageUrl: part4.wordBankUrl,
    storyTemplate: presentationTemplate(part4.storyTemplate, part4.gaps),
    example: safeExample(part4.example),
    gaps: part4.gaps.map((gap, index) => baseItem(resultFor(4, gap.id), index + 1, `Ch\u1ED7 tr\u1ED1ng ${index + 1}`)),
    titleItem: choiceItem(resultFor(4, part4.titleQuestion.id), 7, part4.titleQuestion)
  };
  const part5 = content.parts[4];
  let part5QuestionNumber = 0;
  const reviewPart5 = {
    part: 5,
    mode: "scene-text",
    ...common(part5),
    example: safeExample(part5.example),
    scenes: part5.scenes.map((scene) => ({
      imageUrl: scene.imageUrl,
      passage: reviewText(scene.passage, 2e4),
      items: scene.questions.map((question) => {
        part5QuestionNumber += 1;
        return baseItem(
          resultFor(5, question.id),
          part5QuestionNumber,
          question.prompt.split(`{{${question.id}}}`).join(`{{${part5QuestionNumber}}}`)
        );
      })
    }))
  };
  const part6 = content.parts[5];
  const reviewPart6 = {
    part: 6,
    mode: "passage-text",
    ...common(part6),
    illustrationUrl: part6.illustrationUrl,
    optionsUrl: part6.optionsUrl,
    passageTitle: reviewText(part6.passageTitle, 500),
    passageTemplate: presentationTemplate(
      part6.passageTemplate.replace(/\[\[\s*example\s*\]\]/gi, part6.example?.answer || ""),
      part6.gaps
    ),
    example: safeExample(part6.example),
    items: part6.gaps.map((gap, index) => baseItem(resultFor(6, gap.id), index + 1, `Ch\u1ED7 tr\u1ED1ng ${index + 1}`))
  };
  return {
    schemaVersion: 1,
    totalCount: MOVER_READING_WRITING_TOTAL_QUESTIONS,
    parts: [reviewPart1, reviewPart2, reviewPart3, reviewPart4, reviewPart5, reviewPart6]
  };
}

// src/server/learning-history/learningHistoryRepository.ts
var EFFECTIVE_ATTEMPT_STATUS_SQL = `CASE
  WHEN attempt_status = 'in_progress'
   AND datetime(activity_at) < datetime('now', '-24 hours')
  THEN 'interrupted'
  ELSE attempt_status
END`;
function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
function nullableNumber(value) {
  if (value === null || value === void 0) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function mapItem(row) {
  return {
    attemptId: String(row.attempt_id || ""),
    sourceType: row.source_type === "grammar" ? "grammar" : row.source_type === "reading_writing" ? "reading_writing" : row.source_type === "listening" ? "listening" : "vocabulary",
    studentType: String(row.student_type || ""),
    studentName: String(row.student_name_snapshot || ""),
    classId: row.class_id || null,
    className: String(row.class_name_snapshot || ""),
    assignmentId: row.assignment_id || null,
    assignmentTitle: String(row.assignment_title_snapshot || ""),
    assignmentDueAt: row.assignment_due_at_snapshot || null,
    lessonId: String(row.lesson_id || ""),
    lessonTitle: String(row.lesson_title_snapshot || ""),
    lessonType: String(row.lesson_type || ""),
    gameId: String(row.game_id || ""),
    gameTitle: String(row.game_title_snapshot || ""),
    score: number(row.score),
    rawScore: nullableNumber(row.raw_score),
    maxScore: nullableNumber(row.max_score),
    correctCount: number(row.correct_count),
    incorrectCount: number(row.incorrect_count),
    unansweredCount: number(row.unanswered_count),
    mistakeCount: number(row.mistake_count),
    totalQuestions: number(row.total_questions),
    startedAt: row.started_at || null,
    completedAt: row.completed_at || null,
    activityAt: String(row.activity_at || ""),
    durationSeconds: number(row.duration_seconds),
    status: row.attempt_status === "completed" ? "completed" : row.attempt_status === "interrupted" ? "interrupted" : "in_progress",
    attemptNumber: Math.max(1, number(row.attempt_number)),
    detailStatus: ["available", "missing", "expired", "legacy"].includes(row.detail_status) ? row.detail_status : "missing",
    normalizationStatus: String(row.normalization_status || "legacy_partial")
  };
}
var ITEM_COLUMNS = `
  attempt_id, source_record_id, source_type, student_type, owner_key,
  student_name_snapshot, class_id, class_name_snapshot,
  assignment_id, assignment_title_snapshot, assignment_due_at_snapshot,
  lesson_id, lesson_title_snapshot, lesson_type, game_id, game_title_snapshot,
  score, raw_score, max_score, correct_count, incorrect_count,
  unanswered_count, mistake_count, total_questions, started_at, completed_at,
  activity_at, duration_seconds, ${EFFECTIVE_ATTEMPT_STATUS_SQL} AS attempt_status,
  attempt_number, detail_status,
  normalization_status
`;
var HISTORY_ATTEMPTS_CTE = `
history_attempts AS (
  SELECT
    attempt_id, source_record_id, source_type, student_type, owner_key,
    student_name_snapshot, class_id, class_name_snapshot,
    assignment_id, assignment_title_snapshot, assignment_due_at_snapshot,
    lesson_id, lesson_title_snapshot, lesson_type, game_id, game_title_snapshot,
    score, raw_score, max_score, correct_count, incorrect_count,
    unanswered_count, mistake_count, total_questions, started_at, completed_at,
    activity_at, study_date, duration_seconds, attempt_status, attempt_number, detail_status,
    normalization_status
  FROM learning_attempts
  UNION ALL
  SELECT
    id AS attempt_id,
    id AS source_record_id,
    'listening' AS source_type,
    CASE WHEN guest_id IS NOT NULL AND guest_id <> '' THEN 'guest' ELSE 'authenticated' END AS student_type,
    owner_key,
    COALESCE(student_name, '') AS student_name_snapshot,
    NULLIF(class_id, '') AS class_id,
    COALESCE(json_extract(data_json, '$.className'), '') AS class_name_snapshot,
    NULLIF(assignment_id, '') AS assignment_id,
    COALESCE(json_extract(data_json, '$.assignmentTitle'), '') AS assignment_title_snapshot,
    NULL AS assignment_due_at_snapshot,
    set_id AS lesson_id,
    COALESCE(json_extract(data_json, '$.setTitle'), set_id) AS lesson_title_snapshot,
    'listening_set' AS lesson_type,
    'listening-five-part' AS game_id,
    'Nghe 5 Part' AS game_title_snapshot,
    score,
    score AS raw_score,
    100 AS max_score,
    correct_count,
    incorrect_count,
    unanswered_count,
    incorrect_count + unanswered_count AS mistake_count,
    correct_count + incorrect_count + unanswered_count AS total_questions,
    started_at,
    completed_at,
    completed_at AS activity_at,
    substr(completed_at, 1, 10) AS study_date,
    duration_seconds,
    'completed' AS attempt_status,
    1 AS attempt_number,
    'available' AS detail_status,
    'canonical' AS normalization_status
  FROM listening_attempts
  UNION ALL
  SELECT
    id AS attempt_id,
    id AS source_record_id,
    'reading_writing' AS source_type,
    CASE WHEN guest_id IS NOT NULL AND guest_id <> '' THEN 'guest' ELSE 'authenticated' END AS student_type,
    owner_key,
    COALESCE(student_name, '') AS student_name_snapshot,
    NULLIF(class_id, '') AS class_id,
    COALESCE(json_extract(data_json, '$.className'), '') AS class_name_snapshot,
    NULLIF(assignment_id, '') AS assignment_id,
    COALESCE(json_extract(data_json, '$.assignmentTitle'), '') AS assignment_title_snapshot,
    NULLIF(json_extract(data_json, '$.assignmentDueAt'), '') AS assignment_due_at_snapshot,
    set_id AS lesson_id,
    COALESCE(json_extract(data_json, '$.setTitle'), set_id) AS lesson_title_snapshot,
    'mover_reading_set' AS lesson_type,
    'mover-reading-writing' AS game_id,
    'Reading & Writing 6 Part' AS game_title_snapshot,
    score,
    score AS raw_score,
    100 AS max_score,
    correct_count,
    incorrect_count,
    unanswered_count,
    incorrect_count + unanswered_count AS mistake_count,
    correct_count + incorrect_count + unanswered_count AS total_questions,
    started_at,
    completed_at,
    completed_at AS activity_at,
    substr(completed_at, 1, 10) AS study_date,
    duration_seconds,
    'completed' AS attempt_status,
    1 AS attempt_number,
    'available' AS detail_status,
    'canonical' AS normalization_status
  FROM mover_reading_attempts
)`;
function escapeLike(value) {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}
function buildWhere(ownerKey, filters) {
  const clauses = ["owner_key = ?"];
  const params = [ownerKey];
  const add = (sql, value) => {
    clauses.push(sql);
    params.push(value);
  };
  if (filters.sourceType) add("source_type = ?", filters.sourceType);
  if (filters.historyType === "assignment") clauses.push("assignment_id IS NOT NULL");
  if (filters.historyType === "practice") clauses.push("assignment_id IS NULL");
  if (filters.status === "interrupted") {
    clauses.push(`(${EFFECTIVE_ATTEMPT_STATUS_SQL}) = 'interrupted'`);
  } else if (filters.status === "in_progress") {
    clauses.push(`(${EFFECTIVE_ATTEMPT_STATUS_SQL}) = 'in_progress'`);
  } else if (filters.status === "completed") {
    clauses.push("attempt_status = 'completed'");
  }
  if (filters.classId) add("class_id = ?", filters.classId);
  if (filters.lessonId) add("lesson_id = ?", filters.lessonId);
  if (filters.assignmentId) add("assignment_id = ?", filters.assignmentId);
  if (filters.gameId) add("game_id = ?", filters.gameId);
  if (filters.scoreFrom !== void 0) add("score >= ?", filters.scoreFrom);
  if (filters.scoreTo !== void 0) add("score <= ?", filters.scoreTo);
  if (filters.from) add("activity_at >= ?", filters.from);
  if (filters.toExclusive) add("activity_at < ?", filters.toExclusive);
  if (filters.search) {
    clauses.push(`(
      LOWER(COALESCE(lesson_title_snapshot, '')) LIKE ? ESCAPE '\\'
      OR LOWER(COALESCE(game_title_snapshot, '')) LIKE ? ESCAPE '\\'
      OR LOWER(COALESCE(assignment_title_snapshot, '')) LIKE ? ESCAPE '\\'
    )`);
    const search = `%${escapeLike(filters.search.toLocaleLowerCase("vi"))}%`;
    params.push(search, search, search);
  }
  return {
    sql: clauses.join(" AND "),
    params
  };
}
function mapSummary(row) {
  return {
    totalAttempts: number(row?.total_attempts),
    completedAttempts: number(row?.completed_attempts),
    averageScore: Math.round(number(row?.average_score) * 100) / 100,
    bestScore: number(row?.best_score),
    totalCorrect: number(row?.total_correct),
    totalIncorrect: number(row?.total_incorrect),
    totalUnanswered: number(row?.total_unanswered),
    totalDurationSeconds: number(row?.total_duration_seconds),
    studyDays: number(row?.study_days)
  };
}
async function filterOptions(ownerKey) {
  const queries = [
    sqliteQueryAll(
      `WITH ${HISTORY_ATTEMPTS_CTE}
       SELECT DISTINCT class_id AS id, COALESCE(NULLIF(class_name_snapshot, ''), class_id) AS label
       FROM history_attempts
       WHERE owner_key = ? AND class_id IS NOT NULL AND class_id <> ''
       ORDER BY label COLLATE NOCASE, id`,
      [ownerKey]
    ),
    sqliteQueryAll(
      `WITH ${HISTORY_ATTEMPTS_CTE}
       SELECT DISTINCT lesson_id AS id, COALESCE(NULLIF(lesson_title_snapshot, ''), lesson_id) AS label
       FROM history_attempts
       WHERE owner_key = ? AND lesson_id <> ''
       ORDER BY label COLLATE NOCASE, id`,
      [ownerKey]
    ),
    sqliteQueryAll(
      `WITH ${HISTORY_ATTEMPTS_CTE}
       SELECT DISTINCT assignment_id AS id,
              COALESCE(NULLIF(assignment_title_snapshot, ''), assignment_id) AS label
       FROM history_attempts
       WHERE owner_key = ? AND assignment_id IS NOT NULL AND assignment_id <> ''
       ORDER BY label COLLATE NOCASE, id`,
      [ownerKey]
    ),
    sqliteQueryAll(
      `WITH ${HISTORY_ATTEMPTS_CTE}
       SELECT DISTINCT game_id AS id, COALESCE(NULLIF(game_title_snapshot, ''), game_id) AS label
       FROM history_attempts
       WHERE owner_key = ? AND game_id <> ''
       ORDER BY label COLLATE NOCASE, id`,
      [ownerKey]
    )
  ];
  const [classes, lessons, assignments, games] = await Promise.all(queries);
  const clean = (items) => items.filter((item) => item.id).map((item) => ({ id: String(item.id), label: String(item.label || item.id) }));
  return {
    classes: clean(classes),
    lessons: clean(lessons),
    assignments: clean(assignments),
    games: clean(games)
  };
}
async function assignmentGroups(whereSql, params) {
  const rows = await sqliteQueryAll(
    `WITH ${HISTORY_ATTEMPTS_CTE},
     filtered AS (
       SELECT assignment_id, assignment_title_snapshot, assignment_due_at_snapshot,
              class_id, class_name_snapshot, score,
              ${EFFECTIVE_ATTEMPT_STATUS_SQL} AS attempt_status,
              activity_at, attempt_id
       FROM history_attempts
       WHERE ${whereSql} AND assignment_id IS NOT NULL
     ),
     ranked AS (
       SELECT *,
              ROW_NUMBER() OVER (
                PARTITION BY assignment_id
                ORDER BY activity_at DESC, attempt_id DESC
              ) AS activity_rank
       FROM filtered
     )
     SELECT assignment_id,
            MAX(assignment_title_snapshot) AS assignment_title,
            MAX(assignment_due_at_snapshot) AS due_at,
            MAX(class_id) AS class_id,
            MAX(class_name_snapshot) AS class_name,
            COUNT(*) AS attempts,
            COALESCE(MAX(CASE WHEN activity_rank = 1 THEN score END), 0) AS latest_score,
            COALESCE(MAX(CASE WHEN attempt_status = 'completed' THEN score END), 0) AS best_score,
            COALESCE(AVG(CASE WHEN attempt_status = 'completed' THEN score END), 0) AS average_score
     FROM ranked
     GROUP BY assignment_id
     ORDER BY MAX(activity_at) DESC, assignment_id DESC`,
    params
  );
  return rows.map((row) => ({
    assignmentId: String(row.assignment_id),
    assignmentTitle: String(row.assignment_title || row.assignment_id),
    classId: row.class_id || null,
    className: String(row.class_name || ""),
    dueAt: row.due_at || null,
    attempts: number(row.attempts),
    latestScore: number(row.latest_score),
    bestScore: number(row.best_score),
    averageScore: Math.round(number(row.average_score) * 100) / 100
  }));
}
async function listLearningHistory(ownerKey, filters) {
  const where = buildWhere(ownerKey, filters);
  const offset = (filters.page - 1) * filters.pageSize;
  const [countRow, summaryRow, itemRows, options, groups] = await Promise.all([
    sqliteQueryOne(
      `WITH ${HISTORY_ATTEMPTS_CTE}
       SELECT COUNT(*) AS count FROM history_attempts WHERE ${where.sql}`,
      where.params
    ),
    sqliteQueryOne(
      `WITH ${HISTORY_ATTEMPTS_CTE}
       SELECT
         COUNT(*) AS total_attempts,
         COALESCE(SUM(CASE WHEN attempt_status = 'completed' THEN 1 ELSE 0 END), 0)
           AS completed_attempts,
         COALESCE(AVG(CASE WHEN attempt_status = 'completed' THEN score END), 0)
           AS average_score,
         COALESCE(MAX(CASE WHEN attempt_status = 'completed' THEN score END), 0)
           AS best_score,
         COALESCE(SUM(CASE WHEN attempt_status = 'completed' THEN correct_count ELSE 0 END), 0)
           AS total_correct,
         COALESCE(SUM(CASE WHEN attempt_status = 'completed' THEN incorrect_count ELSE 0 END), 0)
           AS total_incorrect,
         COALESCE(SUM(CASE WHEN attempt_status = 'completed' THEN unanswered_count ELSE 0 END), 0)
           AS total_unanswered,
         COALESCE(SUM(CASE WHEN attempt_status = 'completed' THEN duration_seconds ELSE 0 END), 0)
           AS total_duration_seconds,
         COUNT(DISTINCT CASE WHEN attempt_status = 'completed' THEN study_date END)
           AS study_days
       FROM history_attempts
       WHERE ${where.sql}`,
      where.params
    ),
    sqliteQueryAll(
      `WITH ${HISTORY_ATTEMPTS_CTE}
       SELECT ${ITEM_COLUMNS}
       FROM history_attempts
       WHERE ${where.sql}
       ORDER BY activity_at DESC, attempt_id DESC
       LIMIT ? OFFSET ?`,
      [...where.params, filters.pageSize, offset]
    ),
    filterOptions(ownerKey),
    filters.groupByAssignment ? assignmentGroups(where.sql, where.params) : Promise.resolve(void 0)
  ]);
  const totalItems = number(countRow?.count);
  return {
    items: itemRows.map(mapItem),
    summary: mapSummary(summaryRow),
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      totalItems,
      totalPages: totalItems ? Math.ceil(totalItems / filters.pageSize) : 0
    },
    filterOptions: options,
    ...groups ? { assignmentGroups: groups } : {}
  };
}
async function findLearningAttempt(attemptId) {
  const row = await sqliteQueryOne(
    `WITH ${HISTORY_ATTEMPTS_CTE}
     SELECT ${ITEM_COLUMNS}
     FROM history_attempts
     WHERE attempt_id = ?`,
    [attemptId]
  );
  if (!row) return null;
  return {
    item: mapItem(row),
    ownerKey: row.owner_key || null,
    sourceRecordId: String(row.source_record_id || ""),
    storedDetailStatus: String(row.detail_status || "missing")
  };
}
async function findAttemptDetail(attemptId) {
  const storedRow = await sqliteQueryOne(
    `SELECT attempt_id, client_run_id, source_type, answer_details_json,
            question_snapshots_json, option_snapshots_json, extra_details_json,
            review_policy_json, created_at, updated_at, expires_at, schema_version
     FROM attempt_details
     WHERE attempt_id = ?`,
    [attemptId]
  );
  if (storedRow) {
    const storedSourceType = String(storedRow.source_type || "").toLowerCase();
    if (storedSourceType === "reading_writing") {
      const sourceRow = await sqliteQueryOne(
        `SELECT detail.data_json AS detail_data_json, version.data_json AS version_data_json
         FROM mover_reading_attempts AS attempt
         LEFT JOIN mover_reading_attempt_details AS detail ON detail.attempt_id = attempt.id
         LEFT JOIN mover_reading_set_versions AS version ON version.id = attempt.version_id
         WHERE attempt.id = ?`,
        [attemptId]
      );
      try {
        const version = JSON.parse(String(sourceRow?.version_data_json || "{}"));
        const sourceDetail = JSON.parse(String(sourceRow?.detail_data_json || "{}"));
        const storedQuestions = JSON.parse(String(storedRow.answer_details_json || "[]"));
        const questions = Array.isArray(sourceDetail?.questions) ? sourceDetail.questions : storedQuestions;
        const visualReview = buildMoverReadingWritingVisualReviewSnapshot(
          version.content,
          questions
        );
        const extraDetails = JSON.parse(String(storedRow.extra_details_json || "{}"));
        return {
          ...storedRow,
          extra_details_json: JSON.stringify({
            ...extraDetails && typeof extraDetails === "object" && !Array.isArray(extraDetails) ? extraDetails : {},
            visualReview
          })
        };
      } catch {
        return storedRow;
      }
    }
    if (storedSourceType !== "listening") return storedRow;
    const versionRow = await sqliteQueryOne(
      `SELECT version.data_json AS version_data_json
       FROM listening_attempts AS attempt
       LEFT JOIN listening_set_versions AS version ON version.id = attempt.version_id
       WHERE attempt.id = ?`,
      [attemptId]
    );
    try {
      const version = JSON.parse(String(versionRow?.version_data_json || "{}"));
      const transcripts = buildListeningReviewTranscripts(version.content);
      if (!transcripts.length) return storedRow;
      const extraDetails = JSON.parse(String(storedRow.extra_details_json || "{}"));
      return {
        ...storedRow,
        extra_details_json: JSON.stringify({
          ...extraDetails && typeof extraDetails === "object" && !Array.isArray(extraDetails) ? extraDetails : {},
          listeningReviewTranscripts: transcripts
        })
      };
    } catch {
      return storedRow;
    }
  }
  const listeningRow = await sqliteQueryOne(
    `SELECT detail.attempt_id, detail.data_json, detail.created_at, detail.updated_at,
            attempt.version_id, version.data_json AS version_data_json
     FROM listening_attempt_details AS detail
     JOIN listening_attempts AS attempt ON attempt.id = detail.attempt_id
     LEFT JOIN listening_set_versions AS version ON version.id = attempt.version_id
     WHERE detail.attempt_id = ?`,
    [attemptId]
  );
  if (!listeningRow) {
    const readingRow = await sqliteQueryOne(
      `SELECT detail.attempt_id, detail.data_json, detail.created_at, detail.updated_at,
              version.data_json AS version_data_json
       FROM mover_reading_attempt_details AS detail
       JOIN mover_reading_attempts AS attempt ON attempt.id = detail.attempt_id
       LEFT JOIN mover_reading_set_versions AS version ON version.id = attempt.version_id
       WHERE detail.attempt_id = ?`,
      [attemptId]
    );
    if (!readingRow) return void 0;
    let readingData = {};
    try {
      readingData = JSON.parse(String(readingRow.data_json || "{}"));
    } catch {
      readingData = {};
    }
    const questions = Array.isArray(readingData.questions) ? readingData.questions : [];
    const reviewPolicy2 = readingData.reviewPolicy && typeof readingData.reviewPolicy === "object" ? readingData.reviewPolicy : { showReviewAfterSubmit: false };
    let visualReview;
    try {
      const version = JSON.parse(String(readingRow.version_data_json || "{}"));
      visualReview = buildMoverReadingWritingVisualReviewSnapshot(
        version.content,
        questions
      );
    } catch {
    }
    return {
      attempt_id: attemptId,
      client_run_id: null,
      source_type: "reading_writing",
      answer_details_json: JSON.stringify(questions),
      question_snapshots_json: JSON.stringify(questions.map((question) => ({
        part: question?.part,
        prompt: question?.prompt
      }))),
      option_snapshots_json: "[]",
      extra_details_json: JSON.stringify({
        paperId: "reading-writing",
        ...visualReview ? { visualReview } : {}
      }),
      review_policy_json: JSON.stringify({
        showReviewAfterSubmit: reviewPolicy2.showReviewAfterSubmit === true,
        showExplanationImmediately: false,
        policyVersion: 1
      }),
      created_at: readingRow.created_at,
      updated_at: readingRow.updated_at,
      expires_at: null,
      schema_version: 1
    };
  }
  let data = {};
  try {
    data = JSON.parse(String(listeningRow.data_json || "{}"));
  } catch {
    data = {};
  }
  try {
    const version = JSON.parse(String(listeningRow.version_data_json || "{}"));
    if (version?.content) {
      const transcripts = buildListeningReviewTranscripts(version.content);
      data.extraDetails = {
        ...data.extraDetails && typeof data.extraDetails === "object" ? data.extraDetails : {},
        ...transcripts.length ? { listeningReviewTranscripts: transcripts } : {}
      };
    }
    if (version?.content && data?.answers && Array.isArray(data?.questions)) {
      const answerDetails = buildListeningActivityAnswerDetails(
        version.content,
        data.answers,
        data.questions
      );
      const visualReview = buildListeningVisualReviewSnapshot(
        version.content,
        data.answers,
        data.questions,
        answerDetails
      );
      data = {
        ...data,
        answerDetails,
        questionSnapshots: answerDetails.map((item) => ({
          questionId: item.questionId,
          questionText: item.questionText,
          part: item.part
        })),
        extraDetails: {
          ...data.extraDetails && typeof data.extraDetails === "object" ? data.extraDetails : {},
          visualReview
        }
      };
    }
  } catch {
  }
  const reviewPolicy = {
    ...data.reviewPolicy && typeof data.reviewPolicy === "object" ? data.reviewPolicy : {},
    showReviewAfterSubmit: true,
    showExplanationImmediately: false,
    policyVersion: Math.max(2, Number(data.reviewPolicy?.policyVersion || 0))
  };
  return {
    attempt_id: attemptId,
    client_run_id: null,
    source_type: "listening",
    answer_details_json: JSON.stringify(data.answerDetails || []),
    question_snapshots_json: JSON.stringify(data.questionSnapshots || []),
    option_snapshots_json: JSON.stringify(data.optionSnapshots || []),
    extra_details_json: JSON.stringify(data.extraDetails || {}),
    review_policy_json: JSON.stringify(reviewPolicy),
    created_at: listeningRow.created_at,
    updated_at: listeningRow.updated_at,
    expires_at: null,
    schema_version: 1
  };
}
async function findLegacySource(sourceType, sourceRecordId) {
  if (sourceType === "listening" || sourceType === "reading_writing") return null;
  const table = sourceType === "grammar" ? "grammar_attempts" : "game_results";
  const row = await sqliteQueryOne(
    `SELECT data_json FROM ${table} WHERE id = ?`,
    [sourceRecordId]
  );
  if (!row?.data_json) return null;
  try {
    const parsed = JSON.parse(row.data_json);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}
async function findGuestHistoryCapability(guestId) {
  return sqliteQueryOne(
    `SELECT id, status, access_token_hash, access_token_version
     FROM guest_profiles
     WHERE id = ?`,
    [guestId]
  );
}

// src/server/learning-history/learningHistoryAuth.ts
var LearningHistoryAuthError = class extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = "LearningHistoryAuthError";
    this.status = status;
    this.code = code;
  }
};
function header(req, name) {
  const value = req.headers[name.toLowerCase()];
  return Array.isArray(value) ? "" : String(value || "").trim();
}
function safeGuestId(value) {
  const normalized = value.normalize("NFKC").trim();
  if (!normalized || normalized.length > 120 || !/^[A-Za-z0-9._:-]+$/.test(normalized)) {
    throw new LearningHistoryAuthError(401, "GUEST_CAPABILITY_REQUIRED", "C\u1EA7n x\xE1c minh quy\u1EC1n xem l\u1ECBch s\u1EED.");
  }
  return normalized;
}
function tokenMatches(token, expectedHash) {
  if (!token || token.length < 32 || token.length > 512) return false;
  if (!/^[a-f0-9]{64}$/i.test(expectedHash)) return false;
  const actual = import_node_crypto2.default.createHash("sha256").update(token).digest();
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && import_node_crypto2.default.timingSafeEqual(actual, expected);
}
async function resolveLearningHistoryActor(req) {
  const user = req.user;
  if (user?.id) {
    return {
      id: String(user.id),
      ownerKey: `user:${user.id}`,
      kind: "user",
      role: user.role === "super_admin" || user.role === "teacher" ? user.role : "student",
      userProfile: user
    };
  }
  const guestId = safeGuestId(header(req, "x-guest-id"));
  const accessToken = header(req, "x-guest-access-token");
  const capability = await findGuestHistoryCapability(guestId);
  if (!capability || capability.status === "blocked") {
    throw new LearningHistoryAuthError(401, "GUEST_CAPABILITY_REQUIRED", "C\u1EA7n x\xE1c minh quy\u1EC1n xem l\u1ECBch s\u1EED.");
  }
  if (!capability.access_token_hash) {
    throw new LearningHistoryAuthError(
      403,
      "GUEST_HISTORY_RECOVERY_REQUIRED",
      "H\u1ED3 s\u01A1 c\u0169 c\u1EA7n gi\xE1o vi\xEAn x\xE1c minh \u0111\u1EC3 kh\xF4i ph\u1EE5c quy\u1EC1n xem l\u1ECBch s\u1EED."
    );
  }
  if (!tokenMatches(accessToken, capability.access_token_hash)) {
    throw new LearningHistoryAuthError(401, "GUEST_CAPABILITY_INVALID", "C\u1EA7n x\xE1c minh quy\u1EC1n xem l\u1ECBch s\u1EED.");
  }
  return {
    id: guestId,
    ownerKey: `guest:${guestId}`,
    kind: "guest",
    role: "student"
  };
}

// src/server/learning-history/learningDetailNormalizer.ts
function parseJson2(value, fallback, warnings, field) {
  if (value === null || value === void 0 || value === "") return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    warnings.push(`${field}:malformed_json`);
    return fallback;
  }
}
function arrayValue(value, warnings, field) {
  const parsed = parseJson2(value, [], warnings, field);
  if (!Array.isArray(parsed)) {
    warnings.push(`${field}:not_array`);
    return [];
  }
  return parsed;
}
function objectValue(value, warnings, field) {
  const parsed = parseJson2(value, {}, warnings, field);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    warnings.push(`${field}:not_object`);
    return {};
  }
  return parsed;
}
function stripReviewSecrets(value) {
  if (Array.isArray(value)) return value.map(stripReviewSecrets);
  if (!value || typeof value !== "object") return value;
  const blocked = /* @__PURE__ */ new Set([
    "correctanswer",
    "correctanswersnapshot",
    "correctoptionid",
    "acceptedanswers",
    "acceptedanswerssnapshot",
    "explanation",
    "explanationsnapshot",
    "answerkey",
    "expectedanswer",
    "modelanswer",
    "referenceanswer",
    "solution",
    "visualreview",
    "visualreviewsnapshot",
    "listeningreviewtranscripts"
  ]);
  const safe = {};
  for (const [key, child] of Object.entries(value)) {
    const normalizedKey = key.toLocaleLowerCase("en").replace(/[^a-z0-9]/g, "");
    if (blocked.has(normalizedKey)) continue;
    safe[key] = stripReviewSecrets(child);
  }
  return safe;
}
function reviewAllowed(actor, attempt, reviewPolicy, staffAuthorized) {
  if (staffAuthorized && (actor.role === "teacher" || actor.role === "super_admin")) return true;
  if (attempt.status !== "completed") return false;
  return reviewPolicy.showReviewAfterSubmit === true;
}
function normalizeStoredDetail(actor, attempt, row, staffAuthorized = false) {
  const warnings = [];
  const reviewPolicy = objectValue(
    row.review_policy_json ?? row.reviewPolicy,
    warnings,
    "reviewPolicy"
  );
  const canReview = reviewAllowed(actor, attempt, reviewPolicy, staffAuthorized);
  const payload = {
    sourceType: row.source_type || row.sourceType || attempt.sourceType,
    answerDetails: arrayValue(
      row.answer_details_json ?? row.answerDetails,
      warnings,
      "answerDetails"
    ),
    questionSnapshots: arrayValue(
      row.question_snapshots_json ?? row.questionSnapshots,
      warnings,
      "questionSnapshots"
    ),
    optionSnapshots: arrayValue(
      row.option_snapshots_json ?? row.optionSnapshots,
      warnings,
      "optionSnapshots"
    ),
    extraDetails: objectValue(
      row.extra_details_json ?? row.extraDetails,
      warnings,
      "extraDetails"
    ),
    reviewPolicy: {
      showReviewAfterSubmit: reviewPolicy.showReviewAfterSubmit === true,
      showExplanationImmediately: reviewPolicy.showExplanationImmediately === true,
      policyVersion: Number(reviewPolicy.policyVersion || 1)
    },
    warnings
  };
  if (canReview) return payload;
  return {
    ...payload,
    answerDetails: stripReviewSecrets(payload.answerDetails),
    questionSnapshots: stripReviewSecrets(payload.questionSnapshots),
    optionSnapshots: stripReviewSecrets(payload.optionSnapshots),
    extraDetails: stripReviewSecrets(payload.extraDetails)
  };
}
function normalizeLegacyDetail(actor, attempt, source, staffAuthorized = false) {
  const warnings = ["legacy_fallback"];
  const isGrammar = attempt.sourceType === "grammar";
  const sourcePolicy = source.reviewPolicySnapshot;
  const reviewPolicy = sourcePolicy && typeof sourcePolicy === "object" ? {
    showReviewAfterSubmit: sourcePolicy.showReviewAfterSubmit === true,
    showExplanationImmediately: sourcePolicy.showExplanationImmediately === true,
    policyVersion: Number(sourcePolicy.policyVersion || 1),
    legacyFallback: false
  } : {
    // A legacy set's current policy is not proof of the policy at submission time.
    showReviewAfterSubmit: false,
    showExplanationImmediately: false,
    policyVersion: 0,
    legacyFallback: true
  };
  const row = isGrammar ? {
    sourceType: "grammar",
    answerDetails: Array.isArray(source.answers) ? source.answers : [],
    questionSnapshots: Array.isArray(source.questions) ? source.questions : [],
    optionSnapshots: Array.isArray(source.questions) ? source.questions.map((question) => ({
      attemptQuestionId: question?.id,
      options: Array.isArray(question?.optionsSnapshot) ? question.optionsSnapshot : []
    })) : [],
    extraDetails: {
      grammarSetVersion: source.grammarSetVersion || ""
    },
    reviewPolicy
  } : {
    sourceType: "vocabulary",
    answerDetails: Array.isArray(source.answerDetails) ? source.answerDetails : [],
    questionSnapshots: Array.isArray(source.privateSnapshot?.items) ? source.privateSnapshot.items : [],
    optionSnapshots: [],
    extraDetails: {
      gameId: source.gameId || attempt.gameId,
      gradingMode: source.gradingMode || ""
    },
    reviewPolicy
  };
  const normalized = normalizeStoredDetail(actor, attempt, row, staffAuthorized);
  return {
    ...normalized,
    warnings: [...warnings, ...normalized.warnings]
  };
}

// src/server/learning-history/learningHistoryService.ts
var LearningHistoryNotFoundError = class extends Error {
  constructor() {
    super("Kh\xF4ng t\xECm th\u1EA5y l\u01B0\u1EE3t h\u1ECDc.");
    this.status = 404;
    this.code = "HISTORY_ATTEMPT_NOT_FOUND";
    this.name = "LearningHistoryNotFoundError";
  }
};
async function getLearningHistory(actor, filters) {
  return listLearningHistory(actor.ownerKey, filters);
}
async function getLearningHistoryDetail(actor, attemptId, options = {}) {
  const record = await findLearningAttempt(attemptId);
  if (!record) throw new LearningHistoryNotFoundError();
  const isOwner = Boolean(record.ownerKey && record.ownerKey === actor.ownerKey);
  let staffAuthorized = isOwner && (actor.role === "teacher" || actor.role === "super_admin");
  if (!isOwner && (actor.role === "teacher" || actor.role === "super_admin")) {
    staffAuthorized = Boolean(
      options.canStaffViewAttempt && await options.canStaffViewAttempt(actor, record.item)
    );
  }
  if (!isOwner && !staffAuthorized) {
    throw new LearningHistoryNotFoundError();
  }
  const storedDetail = await findAttemptDetail(attemptId);
  if (storedDetail) {
    return {
      attempt: record.item,
      detailStatus: "available",
      detail: normalizeStoredDetail(actor, record.item, storedDetail, staffAuthorized)
    };
  }
  if (record.storedDetailStatus === "legacy") {
    const legacy = await findLegacySource(record.item.sourceType, record.sourceRecordId);
    if (legacy) {
      return {
        attempt: record.item,
        detailStatus: "available",
        detail: normalizeLegacyDetail(actor, record.item, legacy, staffAuthorized)
      };
    }
    return {
      attempt: record.item,
      detailStatus: "legacy_unavailable",
      detail: null
    };
  }
  const status = record.storedDetailStatus === "expired" ? "expired" : "missing";
  return {
    attempt: record.item,
    detailStatus: status,
    detail: null
  };
}

// src/server/learning-history/learningHistoryValidation.ts
var LearningHistoryValidationError = class extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
    this.code = "INVALID_HISTORY_QUERY";
    this.name = "LearningHistoryValidationError";
  }
};
function scalar(value, name) {
  if (Array.isArray(value)) {
    throw new LearningHistoryValidationError(`${name} kh\xF4ng \u0111\u01B0\u1EE3c l\u1EB7p l\u1EA1i.`);
  }
  return value === void 0 || value === null ? "" : String(value).trim();
}
function boundedText(value, name, max) {
  const result = scalar(value, name).normalize("NFKC");
  if (result.length > max) {
    throw new LearningHistoryValidationError(`${name} v\u01B0\u1EE3t qu\xE1 ${max} k\xFD t\u1EF1.`);
  }
  if (/[\u0000-\u001F\u007F]/.test(result)) {
    throw new LearningHistoryValidationError(`${name} ch\u1EE9a k\xFD t\u1EF1 kh\xF4ng h\u1EE3p l\u1EC7.`);
  }
  return result;
}
function integerParam(value, name, fallback) {
  const raw = scalar(value, name);
  if (!raw) return fallback;
  if (!/^\d+$/.test(raw)) {
    throw new LearningHistoryValidationError(`${name} ph\u1EA3i l\xE0 s\u1ED1 nguy\xEAn.`);
  }
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed)) {
    throw new LearningHistoryValidationError(`${name} kh\xF4ng h\u1EE3p l\u1EC7.`);
  }
  return parsed;
}
function optionalScore(value, name) {
  const raw = scalar(value, name);
  if (!raw) return void 0;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    throw new LearningHistoryValidationError(`${name} ph\u1EA3i n\u1EB1m trong kho\u1EA3ng 0\u2013100.`);
  }
  return parsed;
}
function validDate(value, name) {
  const raw = scalar(value, name);
  if (!raw) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new LearningHistoryValidationError(`${name} ph\u1EA3i c\xF3 d\u1EA1ng YYYY-MM-DD.`);
  }
  const [year, month, day] = raw.split("-").map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    throw new LearningHistoryValidationError(`${name} kh\xF4ng ph\u1EA3i ng\xE0y h\u1EE3p l\u1EC7.`);
  }
  return raw;
}
function bangkokStartIso(date) {
  return (/* @__PURE__ */ new Date(`${date}T00:00:00.000+07:00`)).toISOString();
}
function nextBangkokDayIso(date) {
  const start2 = /* @__PURE__ */ new Date(`${date}T00:00:00.000+07:00`);
  return new Date(start2.getTime() + 864e5).toISOString();
}
function allowlisted(value, name, allowed) {
  const raw = scalar(value, name);
  if (!raw) return void 0;
  if (!allowed.includes(raw)) {
    throw new LearningHistoryValidationError(`${name} kh\xF4ng h\u1EE3p l\u1EC7.`);
  }
  return raw;
}
function parseLearningHistoryFilters(query) {
  const page = integerParam(query.page, "page", 1);
  if (page < 1 || page > 1e6) {
    throw new LearningHistoryValidationError("page ph\u1EA3i n\u1EB1m trong kho\u1EA3ng h\u1EE3p l\u1EC7.");
  }
  const requestedPageSize = integerParam(query.pageSize, "pageSize", 20);
  if (requestedPageSize !== 20 && requestedPageSize !== 50) {
    throw new LearningHistoryValidationError("pageSize ch\u1EC9 nh\u1EADn 20 ho\u1EB7c 50.");
  }
  const sourceType = allowlisted(
    query.sourceType,
    "sourceType",
    ["vocabulary", "grammar", "listening", "reading_writing"]
  );
  const historyType = allowlisted(
    query.historyType,
    "historyType",
    ["all", "assignment", "practice"]
  ) || "all";
  const status = allowlisted(
    query.status,
    "status",
    ["completed", "in_progress", "interrupted"]
  );
  const scoreFrom = optionalScore(query.scoreFrom, "scoreFrom");
  const scoreTo = optionalScore(query.scoreTo, "scoreTo");
  if (scoreFrom !== void 0 && scoreTo !== void 0 && scoreFrom > scoreTo) {
    throw new LearningHistoryValidationError("scoreFrom kh\xF4ng \u0111\u01B0\u1EE3c l\u1EDBn h\u01A1n scoreTo.");
  }
  const fromDate = validDate(query.from, "from");
  const toDate = validDate(query.to, "to");
  if (fromDate && toDate && fromDate > toDate) {
    throw new LearningHistoryValidationError("from kh\xF4ng \u0111\u01B0\u1EE3c sau to.");
  }
  const groupRaw = scalar(query.groupByAssignment, "groupByAssignment").toLowerCase();
  if (groupRaw && !["true", "false", "1", "0"].includes(groupRaw)) {
    throw new LearningHistoryValidationError("groupByAssignment kh\xF4ng h\u1EE3p l\u1EC7.");
  }
  return {
    page,
    pageSize: requestedPageSize,
    sourceType,
    historyType,
    status,
    classId: boundedText(query.classId, "classId", 180) || void 0,
    lessonId: boundedText(query.lessonId, "lessonId", 200) || void 0,
    assignmentId: boundedText(query.assignmentId, "assignmentId", 180) || void 0,
    gameId: boundedText(query.gameId, "gameId", 160) || void 0,
    scoreFrom,
    scoreTo,
    from: fromDate ? bangkokStartIso(fromDate) : void 0,
    toExclusive: toDate ? nextBangkokDayIso(toDate) : void 0,
    search: boundedText(query.search, "search", 100) || void 0,
    groupByAssignment: groupRaw === "true" || groupRaw === "1"
  };
}
function validateAttemptId(value) {
  const attemptId = boundedText(value, "attemptId", 200);
  if (!attemptId || !/^[A-Za-z0-9._:-]+$/.test(attemptId)) {
    throw new LearningHistoryValidationError("attemptId kh\xF4ng h\u1EE3p l\u1EC7.");
  }
  return attemptId;
}

// src/server/learning-history/learningHistoryRouter.ts
function errorStatus(error) {
  const status = Number(error?.status || error?.statusCode || 500);
  return Number.isInteger(status) && status >= 400 && status <= 599 ? status : 500;
}
function errorBody(error, status) {
  if (status >= 500) {
    return { error: "Kh\xF4ng th\u1EC3 t\u1EA3i l\u1ECBch s\u1EED h\u1ECDc t\u1EADp.", code: "HISTORY_INTERNAL_ERROR" };
  }
  return {
    error: String(error?.message || "Y\xEAu c\u1EA7u kh\xF4ng h\u1EE3p l\u1EC7."),
    code: String(error?.code || "HISTORY_REQUEST_FAILED")
  };
}
function withHistoryTiming(label, slowRequestMs, handler) {
  return async (req, res, next) => {
    const startedAt = performance.now();
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      const durationMs = Math.max(0, performance.now() - startedAt);
      if (!res.headersSent) {
        res.setHeader("Server-Timing", `history;dur=${durationMs.toFixed(1)}`);
      }
      if (durationMs >= slowRequestMs) {
        console.warn(`[PERF] ${label} total=${durationMs.toFixed(1)}ms`);
      }
    };
    const sendJson = res.json.bind(res);
    res.json = ((body) => {
      finish();
      return sendJson(body);
    });
    try {
      await handler(req, res, next);
    } finally {
      finish();
    }
  };
}
function createLearningHistoryRouter(options) {
  const router = import_express.default.Router();
  const slowRequestMs = Math.max(0, Number(options.slowRequestMs || 500));
  router.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    if (!options.enabled) {
      return res.status(404).json({
        error: "L\u1ECBch s\u1EED h\u1ECDc t\u1EADp ch\u01B0a \u0111\u01B0\u1EE3c b\u1EADt.",
        code: "LEARNING_HISTORY_DISABLED"
      });
    }
    next();
  });
  if (options.authenticateOptionalUser) {
    router.use(options.authenticateOptionalUser);
  }
  router.get("/", withHistoryTiming(
    "GET /api/my-learning-history",
    slowRequestMs,
    async (req, res) => {
      try {
        const actor = await resolveLearningHistoryActor(req);
        const filters = parseLearningHistoryFilters(req.query);
        const response = await getLearningHistory(actor, filters);
        res.json(response);
      } catch (error) {
        const status = errorStatus(error);
        res.status(status).json(errorBody(error, status));
      }
    }
  ));
  router.get("/:attemptId", withHistoryTiming(
    "GET /api/my-learning-history/:attemptId",
    slowRequestMs,
    async (req, res) => {
      try {
        const actor = await resolveLearningHistoryActor(req);
        const attemptId = validateAttemptId(req.params.attemptId);
        const response = await getLearningHistoryDetail(actor, attemptId, options);
        res.json(response);
      } catch (error) {
        const status = errorStatus(error);
        res.status(status).json(errorBody(error, status));
      }
    }
  ));
  return router;
}

// src/server/listening-library/router.ts
var import_express3 = __toESM(require("express"), 1);

// src/server/listening/listeningRouter.ts
var import_crypto = __toESM(require("crypto"), 1);
var import_express2 = __toESM(require("express"), 1);
var import_fs3 = __toESM(require("fs"), 1);
var import_path3 = __toESM(require("path"), 1);

// src/server/listening/listeningValidation.ts
var isText = (value, max = 500) => typeof value === "string" && value.trim().length > 0 && value.trim().length <= max;
var unique = (values) => new Set(values).size === values.length;
function validateRegion(region, path11, errors) {
  if (!region || !["rect", "ellipse", "polygon"].includes(region.shape)) {
    errors.push(`${path11}: v\xF9ng t\u01B0\u01A1ng t\xE1c kh\xF4ng h\u1EE3p l\u1EC7.`);
    return;
  }
  for (const [key, value] of Object.entries({
    x: region.x,
    y: region.y,
    width: region.width,
    height: region.height
  })) {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      errors.push(`${path11}.${key}: ph\u1EA3i n\u1EB1m trong kho\u1EA3ng 0\u20131.`);
    }
  }
  if (region.width <= 0 || region.height <= 0 || region.x + region.width > 1 || region.y + region.height > 1) {
    errors.push(`${path11}: v\xF9ng t\u01B0\u01A1ng t\xE1c v\u01B0\u1EE3t ra ngo\xE0i h\xECnh.`);
  }
  if (region.shape === "polygon") {
    if (!Array.isArray(region.points) || region.points.length < 3) {
      errors.push(`${path11}: polygon c\u1EA7n \xEDt nh\u1EA5t 3 \u0111i\u1EC3m.`);
    } else {
      region.points.forEach((point, index) => {
        if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < 0 || point.x > 1 || point.y < 0 || point.y > 1) {
          errors.push(`${path11}.points[${index}]: \u0111i\u1EC3m ph\u1EA3i n\u1EB1m trong kho\u1EA3ng 0\u20131.`);
        }
      });
    }
  }
  if (region && !isValidListeningRegion(region)) {
    errors.push(`${path11}: h\xECnh h\u1ECDc r\u1ED7ng, t\u1EF1 c\u1EAFt ho\u1EB7c kh\xF4ng h\u1EE3p l\u1EC7.`);
  }
}
function regionsOverlap(a, b) {
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  return right - left > 0.01 && bottom - top > 0.01;
}
function validateRegionCollection(items, path11, errors) {
  items.forEach((item, index) => validateRegion(item.region, `${path11}[${index}].region`, errors));
  for (let first = 0; first < items.length; first += 1) {
    for (let second = first + 1; second < items.length; second += 1) {
      if (regionsOverlap(items[first].region, items[second].region)) {
        errors.push(`${path11}: v\xF9ng "${items[first].id}" ch\u1ED3ng l\xEAn v\xF9ng "${items[second].id}".`);
      }
    }
  }
}
function validateBase(part, number2, errors) {
  if (part?.schemaVersion !== void 0 && part.schemaVersion !== 1) {
    errors.push(`Part ${number2}: phi\xEAn b\u1EA3n c\u1EA5u tr\xFAc kh\xF4ng \u0111\u01B0\u1EE3c h\u1ED7 tr\u1EE3.`);
  }
  if (part?.part !== number2) errors.push(`Part ${number2}: sai lo\u1EA1i Part.`);
  if (!isText(part?.title, 160)) errors.push(`Part ${number2}: thi\u1EBFu ti\xEAu \u0111\u1EC1.`);
  if (!isText(part?.instruction, 1e3)) errors.push(`Part ${number2}: thi\u1EBFu h\u01B0\u1EDBng d\u1EABn.`);
  if (!isText(part?.audioAssetId, 160)) errors.push(`Part ${number2}: c\u1EA7n \u0111\xFAng m\u1ED9t file audio.`);
  if (part?.audioTranscript !== void 0 && (typeof part.audioTranscript !== "string" || part.audioTranscript.length > LISTENING_TRANSCRIPT_MAX_CHARS)) {
    errors.push(`Part ${number2}: transcript ph\u1EA3i l\xE0 v\u0103n b\u1EA3n t\u1ED1i \u0111a ${LISTENING_TRANSCRIPT_MAX_CHARS.toLocaleString("vi-VN")} k\xFD t\u1EF1.`);
  }
}
function validatePart1(part, errors) {
  validateBase(part, 1, errors);
  if (!isText(part.sceneAssetId, 160)) errors.push("Part 1: thi\u1EBFu h\xECnh t\xECnh hu\u1ED1ng.");
  if (part.choices?.length !== 6) errors.push("Part 1: c\u1EA7n \u0111\xFAng 6 th\u1EBB t\xEAn (5 \u0111\xE1p \xE1n v\xE0 1 nhi\u1EC5u).");
  if (part.targets?.length !== 5) errors.push("Part 1: c\u1EA7n \u0111\xFAng 5 v\xF9ng ch\u1EA5m \u0111i\u1EC3m.");
  const choiceIds = (part.choices || []).map((choice2) => choice2.id);
  if (!unique(choiceIds) || (part.choices || []).some((choice2) => !isText(choice2.id, 160) || !isText(choice2.label, 120))) {
    errors.push("Part 1: ID v\xE0 nh\xE3n th\u1EBB t\xEAn ph\u1EA3i \u0111\u1EA7y \u0111\u1EE7, kh\xF4ng tr\xF9ng.");
  }
  const targetIds = (part.targets || []).map((target) => target.id);
  if (!unique(targetIds) || (part.targets || []).some((target) => !choiceIds.includes(target.choiceId))) {
    errors.push("Part 1: v\xF9ng ho\u1EB7c \u0111\xE1p \xE1n v\xF9ng kh\xF4ng h\u1EE3p l\u1EC7.");
  }
  validateRegionCollection(part.targets || [], "Part 1 targets", errors);
  if (part.example) validateRegion(part.example.region, "Part 1 example.region", errors);
}
function validatePart2(part, errors) {
  validateBase(part, 2, errors);
  if (!isText(part.heading, 200)) errors.push("Part 2: thi\u1EBFu ti\xEAu \u0111\u1EC1 b\xE0i.");
  if (part.questions?.length !== 5) errors.push("Part 2: c\u1EA7n \u0111\xFAng 5 c\xE2u.");
  const ids = (part.questions || []).map((question) => question.id);
  if (!unique(ids)) errors.push("Part 2: ID c\xE2u h\u1ECFi b\u1ECB tr\xF9ng.");
  (part.questions || []).forEach((question, index) => {
    if (!isText(question.prompt, 1e3)) errors.push(`Part 2 c\xE2u ${index + 1}: thi\u1EBFu n\u1ED9i dung.`);
    if (!question.blanks?.length) errors.push(`Part 2 c\xE2u ${index + 1}: c\u1EA7n \xEDt nh\u1EA5t m\u1ED9t \xF4 tr\u1ED1ng.`);
    const blankIds = (question.blanks || []).map((blank) => blank.id);
    if (!unique(blankIds)) errors.push(`Part 2 c\xE2u ${index + 1}: ID \xF4 tr\u1ED1ng b\u1ECB tr\xF9ng.`);
    (question.blanks || []).forEach((blank) => {
      if (!question.prompt.includes(`{{${blank.id}}}`)) {
        errors.push(`Part 2 c\xE2u ${index + 1}: n\u1ED9i dung thi\u1EBFu k\xFD hi\u1EC7u {{${blank.id}}}.`);
      }
      if (!blank.acceptedAnswers?.length || blank.acceptedAnswers.some((answer) => !isText(answer, 200))) {
        errors.push(`Part 2 c\xE2u ${index + 1}: m\u1ED7i \xF4 tr\u1ED1ng c\u1EA7n \xEDt nh\u1EA5t m\u1ED9t \u0111\xE1p \xE1n.`);
      }
    });
  });
}
function validatePart3(part, errors) {
  validateBase(part, 3, errors);
  if (part.displayMode === "connect-image") {
    if (!isText(part.boardAssetId, 160)) errors.push("Part 3: thi\u1EBFu \u1EA3nh \u0111\u1EC1 b\xE0i k\u1EBFt n\u1ED1i.");
    if (part.connectionSchemaVersion !== 1) errors.push("Part 3: phi\xEAn b\u1EA3n k\u1EBFt n\u1ED1i kh\xF4ng \u0111\u01B0\u1EE3c h\u1ED7 tr\u1EE3.");
    if (part.answers?.length !== 7) errors.push("Part 3: c\u1EA7n \u0111\xFAng 7 answer \u1EDF gi\u1EEFa, g\u1ED3m example, 5 \u0111\xE1p \xE1n v\xE0 1 nhi\u1EC5u.");
    if (part.pictures?.length !== 6) errors.push("Part 3: c\u1EA7n \u0111\xFAng 6 picture, ba b\xEAn tr\xE1i v\xE0 ba b\xEAn ph\u1EA3i.");
    const answerIds = (part.answers || []).map((answer) => answer.id);
    const pictureIds = (part.pictures || []).map((picture) => picture.id);
    if (!unique(answerIds) || (part.answers || []).some((answer) => !isText(answer.id, 160) || !isText(answer.label, 120))) {
      errors.push("Part 3: answer ID/label ph\u1EA3i \u0111\u1EA7y \u0111\u1EE7 v\xE0 kh\xF4ng tr\xF9ng.");
    }
    if (!unique(pictureIds)) errors.push("Part 3: picture ID b\u1ECB tr\xF9ng.");
    const pictureSlots = (part.pictures || []).map((picture) => `${picture.side}:${picture.row}`);
    if (!unique(pictureSlots) || (part.pictures || []).some((picture) => !["left", "right"].includes(picture.side) || ![1, 2, 3].includes(picture.row))) {
      errors.push("Part 3: picture ph\u1EA3i n\u1EB1m \u0111\xFAng ba h\xE0ng b\xEAn tr\xE1i v\xE0 ba h\xE0ng b\xEAn ph\u1EA3i.");
    }
    if ((part.answers || []).some((answer) => answer.leftAnchorOffset < 0 || answer.leftAnchorOffset > 1 || answer.rightAnchorOffset < 0 || answer.rightAnchorOffset > 1)) {
      errors.push("Part 3: anchor answer ph\u1EA3i \u0111\u01B0\u1EE3c gi\u1EDBi h\u1EA1n tr\xEAn \u0111\xFAng c\u1EA1nh.");
    }
    if ((part.pictures || []).some((picture) => picture.anchorOffset < 0 || picture.anchorOffset > 1)) {
      errors.push("Part 3: anchor picture ph\u1EA3i \u0111\u01B0\u1EE3c gi\u1EDBi h\u1EA1n tr\xEAn \u0111\xFAng c\u1EA1nh.");
    }
    validateRegionCollection(part.answers || [], "Part 3 answers", errors);
    validateRegionCollection(part.pictures || [], "Part 3 pictures", errors);
    const example = part.exampleConnection;
    if (!example || !answerIds.includes(example.answerId) || !pictureIds.includes(example.pictureId)) {
      errors.push("Part 3: example connection kh\xF4ng h\u1EE3p l\u1EC7.");
    }
    const mappings = part.correctConnections || [];
    if (mappings.length !== 5) errors.push("Part 3: c\u1EA7n \u0111\xFAng 5 connection \u0111\u01B0\u1EE3c ch\u1EA5m \u0111i\u1EC3m.");
    if (!unique(mappings.map((item) => item.answerId)) || !unique(mappings.map((item) => item.pictureId)) || mappings.some((item) => !answerIds.includes(item.answerId) || !pictureIds.includes(item.pictureId)) || mappings.some((item) => item.answerId === example?.answerId || item.pictureId === example?.pictureId)) {
      errors.push("Part 3: mapping ch\u1EA5m \u0111i\u1EC3m b\u1ECB tr\xF9ng, tham chi\u1EBFu sai ho\u1EB7c d\xF9ng l\u1EA1i example.");
    }
    const unusedAnswers = answerIds.filter((id) => id !== example?.answerId && !mappings.some((item) => item.answerId === id));
    if (unusedAnswers.length !== 1 || unusedAnswers[0] !== part.distractorAnswerId) {
      errors.push("Part 3: ph\u1EA3i c\xF3 \u0111\xFAng m\u1ED9t answer nhi\u1EC5u kh\xF4ng \u0111\u01B0\u1EE3c n\u1ED1i.");
    }
    return;
  }
  const composite = part.displayMode === "composite";
  if (!["once", "multiple"].includes(part.reuseMode)) errors.push("Part 3: ch\u1EBF \u0111\u1ED9 d\xF9ng \u0111\xE1p \xE1n kh\xF4ng h\u1EE3p l\u1EC7.");
  if (composite && (part.options || []).length !== 6) errors.push("Part 3: b\u1EA3ng t\u1ED5ng h\u1EE3p c\u1EA7n \u0111\xFAng 6 l\u1EF1a ch\u1ECDn A\u2013F.");
  if (!composite && (part.options || []).length < 5) errors.push("Part 3: c\u1EA7n \xEDt nh\u1EA5t 5 l\u1EF1a ch\u1ECDn h\xECnh \u1EA3nh.");
  if (part.items?.length !== 5) errors.push("Part 3: c\u1EA7n \u0111\xFAng 5 c\xE2u.");
  if (composite && !isText(part.boardAssetId, 160)) errors.push("Part 3: thi\u1EBFu \u1EA3nh b\u1EA3ng A\u2013F t\u1ED5ng h\u1EE3p.");
  const optionIds = (part.options || []).map((option) => option.id);
  if (!unique(optionIds)) errors.push("Part 3: ID l\u1EF1a ch\u1ECDn b\u1ECB tr\xF9ng.");
  if (!composite && (part.options || []).some((option) => !isText(option.imageAssetId, 160))) {
    errors.push("Part 3: m\u1ECDi l\u1EF1a ch\u1ECDn c\u1EA7n h\xECnh \u1EA3nh.");
  }
  const answers = (part.items || []).map((item) => item.correctOptionId);
  if ((part.items || []).some((item) => !composite && !isText(item.imageAssetId, 160) || !optionIds.includes(item.correctOptionId))) {
    errors.push("Part 3: c\xE2u h\u1ECFi ho\u1EB7c \u0111\xE1p \xE1n h\xECnh \u1EA3nh kh\xF4ng h\u1EE3p l\u1EC7.");
  }
  if (part.reuseMode === "once" && !unique(answers)) {
    errors.push("Part 3: m\u1ED7i l\u1EF1a ch\u1ECDn ch\u1EC9 \u0111\u01B0\u1EE3c d\xF9ng m\u1ED9t l\u1EA7n.");
  }
}
function validatePart4(part, errors) {
  validateBase(part, 4, errors);
  if (part.questions?.length !== 5) errors.push("Part 4: c\u1EA7n \u0111\xFAng 5 c\xE2u.");
  const validateQuestion = (question, label) => {
    if (!isText(question.prompt, 1e3)) errors.push(`${label}: thi\u1EBFu n\u1ED9i dung.`);
    if (question.options?.length !== 3) errors.push(`${label}: c\u1EA7n \u0111\xFAng 3 l\u1EF1a ch\u1ECDn.`);
    const optionIds = (question.options || []).map((option) => option.id);
    if (!unique(optionIds) || !optionIds.includes(question.correctOptionId)) {
      errors.push(`${label}: l\u1EF1a ch\u1ECDn ho\u1EB7c \u0111\xE1p \xE1n \u0111\xFAng kh\xF4ng h\u1EE3p l\u1EC7.`);
    }
    if ((question.options || []).some((option) => !isText(option.id, 160) || !isText(option.imageAssetId, 160))) {
      errors.push(`${label}: m\u1ECDi l\u1EF1a ch\u1ECDn c\u1EA7n ID v\xE0 h\xECnh \u1EA3nh.`);
    }
  };
  (part.questions || []).forEach((question, index) => {
    validateQuestion(question, `Part 4 c\xE2u ${index + 1}`);
  });
  if (part.example) validateQuestion(part.example, "Part 4 example");
}
function validatePart5(part, errors) {
  validateBase(part, 5, errors);
  if (part.displayMode === "scene-colour-draw") {
    if (!isText(part.sceneAssetId, 160)) errors.push("Part 5: thi\u1EBFu tranh t\u01B0\u01A1ng t\xE1c.");
    if (![1, 2].includes(part.interactionSchemaVersion)) errors.push("Part 5: phi\xEAn b\u1EA3n t\u01B0\u01A1ng t\xE1c kh\xF4ng \u0111\u01B0\u1EE3c h\u1ED7 tr\u1EE3.");
    if (part.colours?.length !== 20) errors.push("Part 5: palette m\xE0u c\u1EA7n \u0111\u1EE7 20 m\xE0u chu\u1EA9n.");
    const colourIds2 = (part.colours || []).map((colour) => colour.id);
    if (!unique(colourIds2) || (part.colours || []).some((colour) => !/^#[0-9a-f]{6}$/i.test(colour.value))) {
      errors.push("Part 5: m\xE0u ph\u1EA3i c\xF3 ID ri\xEAng v\xE0 m\xE3 #RRGGBB h\u1EE3p l\u1EC7.");
    }
    const studentColourIds = part.interactionSchemaVersion === 2 ? part.colourPaletteIds || [] : colourIds2;
    if (part.interactionSchemaVersion === 2 && (studentColourIds.length !== 6 || !unique(studentColourIds) || studentColourIds.some((id) => !colourIds2.includes(id)))) errors.push("Part 5: palette h\u1ECDc sinh c\u1EA7n \u0111\xFAng 6 m\xE0u h\u1EE3p l\u1EC7, kh\xF4ng tr\xF9ng (g\u1ED3m m\xE0u nhi\u1EC5u).");
    if (part.questions?.length !== 5 || !unique((part.questions || []).map((question) => String(question.questionNumber)))) {
      errors.push("Part 5: c\u1EA7n \u0111\xFAng 5 c\xE2u c\xF3 questionNumber 1\u20135 kh\xF4ng tr\xF9ng.");
    }
    const objectIds = (part.interactiveObjects || []).map((object) => object.id);
    const paletteIds = (part.objectPalette || []).map((item) => item.id);
    if (!unique(objectIds) || !unique(paletteIds)) errors.push("Part 5: ID object/palette b\u1ECB tr\xF9ng.");
    if (part.interactionSchemaVersion === 2 && (paletteIds.length !== 3 || part.objectPalette.some((item) => !isText(item.label, 160) || !isText(item.tokenAssetId, 160)))) errors.push("Part 5: Draw c\u1EA7n \u0111\xFAng 3 icon PNG \u0111\xE3 upload (2 l\u1EF1a ch\u1ECDn l\xE0m b\xE0i v\xE0 1 nhi\u1EC5u).");
    (part.interactiveObjects || []).forEach((object, index) => {
      validateRegion(object.geometry, `Part 5 interactiveObjects[${index}].geometry`, errors);
      if (part.interactionSchemaVersion === 2 && object.geometryConfirmedByTeacher !== true) {
        errors.push(`Part 5 interactiveObjects[${index}]: gi\xE1o vi\xEAn ch\u01B0a x\xE1c nh\u1EADn mask Colour.`);
      }
    });
    const actionIds = (part.questions || []).flatMap((question) => (question.actions || []).map((action) => action.id));
    if (!unique(actionIds)) errors.push("Part 5: action ID b\u1ECB tr\xF9ng.");
    if (part.interactionSchemaVersion === 1 && (part.questions || []).some((question) => question.actions?.some((action) => action.type === "colour_object")) && objectIds.length < 2) {
      errors.push("Part 5: colour_object c\u1EA7n \xEDt nh\u1EA5t hai public object \u0111\u1EC3 geometry kh\xF4ng tr\u1EDF th\xE0nh g\u1EE3i \xFD \u0111\xE1p \xE1n.");
    }
    (part.questions || []).forEach((question, questionIndex) => {
      if (!isText(question.staffPrompt, 1e3)) errors.push(`Part 5 c\xE2u ${questionIndex + 1}: thi\u1EBFu n\u1ED9i dung.`);
      if (!question.actions?.length) errors.push(`Part 5 c\xE2u ${questionIndex + 1}: c\u1EA7n \xEDt nh\u1EA5t m\u1ED9t action.`);
      question.actions?.forEach((action, actionIndex) => {
        if (action.type === "colour_object") {
          if (!objectIds.includes(action.correctObjectId) || !colourIds2.includes(action.correctColourId) || !studentColourIds.includes(action.correctColourId)) {
            errors.push(`Part 5 c\xE2u ${questionIndex + 1}, action ${actionIndex + 1}: object/m\xE0u \u0111\xFAng kh\xF4ng h\u1EE3p l\u1EC7.`);
          }
        } else {
          if (!paletteIds.includes(action.correctPaletteItemId)) {
            errors.push(`Part 5 c\xE2u ${questionIndex + 1}, action ${actionIndex + 1}: object \u0111\u1EB7t kh\xF4ng h\u1EE3p l\u1EC7.`);
          }
          validateRegion(action.targetRegion, `Part 5 questions[${questionIndex}].actions[${actionIndex}].targetRegion`, errors);
          if (part.interactionSchemaVersion === 2 && action.geometryConfirmedByTeacher !== true) {
            errors.push(`Part 5 c\xE2u ${questionIndex + 1}, action ${actionIndex + 1}: gi\xE1o vi\xEAn ch\u01B0a x\xE1c nh\u1EADn drop-zone Draw.`);
          }
          const correctItem = part.objectPalette.find((item) => item.id === action.correctPaletteItemId);
          if (part.interactionSchemaVersion === 1 && (!correctItem || !part.objectPalette.some((item) => item.id !== correctItem.id && item.objectType === correctItem.objectType))) {
            errors.push(`Part 5 c\xE2u ${questionIndex + 1}: place_object c\u1EA7n \xEDt nh\u1EA5t m\u1ED9t l\u1EF1a ch\u1ECDn nhi\u1EC5u c\xF9ng lo\u1EA1i.`);
          }
        }
      });
    });
    if (part.interactionSchemaVersion === 2) {
      const usedColourIds = new Set(part.questions.flatMap((question) => question.actions.flatMap((action) => action.type === "colour_object" ? [action.correctColourId] : [])));
      const usedPaletteIds = new Set(part.questions.flatMap((question) => question.actions.flatMap((action) => action.type === "place_object" ? [action.correctPaletteItemId] : [])));
      if (!studentColourIds.some((id) => !usedColourIds.has(id))) errors.push("Part 5: palette m\xE0u c\u1EA7n \xEDt nh\u1EA5t m\u1ED9t m\xE0u nhi\u1EC5u kh\xF4ng ph\u1EA3i \u0111\xE1p \xE1n.");
      if (!paletteIds.some((id) => !usedPaletteIds.has(id))) errors.push("Part 5: object palette c\u1EA7n \xEDt nh\u1EA5t m\u1ED9t icon nhi\u1EC5u kh\xF4ng ph\u1EA3i \u0111\xE1p \xE1n.");
    }
    return;
  }
  if (!isText(part.sceneAssetId, 160)) errors.push("Part 5: thi\u1EBFu tranh t\xF4 m\xE0u.");
  if (part.colours?.length !== 6) errors.push("Part 5: c\u1EA7n \u0111\xFAng 6 m\xE0u (5 \u0111\xE1p \xE1n v\xE0 1 nhi\u1EC5u).");
  if (part.targets?.length !== 5) errors.push("Part 5: c\u1EA7n \u0111\xFAng 5 v\xF9ng ch\u1EA5m \u0111i\u1EC3m.");
  const colourIds = (part.colours || []).map((colour) => colour.id);
  if (!unique(colourIds) || (part.colours || []).some((colour) => !/^#[0-9a-f]{6}$/i.test(colour.value))) {
    errors.push("Part 5: m\xE0u ph\u1EA3i c\xF3 ID ri\xEAng v\xE0 m\xE3 #RRGGBB h\u1EE3p l\u1EC7.");
  }
  if ((part.targets || []).some((target) => !colourIds.includes(target.correctColourId))) {
    errors.push("Part 5: v\xF9ng c\xF3 \u0111\xE1p \xE1n m\xE0u kh\xF4ng h\u1EE3p l\u1EC7.");
  }
  validateRegionCollection(part.targets || [], "Part 5 targets", errors);
  if (part.example) validateRegion(part.example.region, "Part 5 example.region", errors);
}
function validateListeningSetContent(content) {
  const errors = [];
  if (content?.moduleId !== void 0 && content.moduleId !== "mover") {
    errors.push("B\u1ED9 \u0111\u1EC1 kh\xF4ng thu\u1ED9c module Mover.");
  }
  if (!content || content.schemaVersion !== 1) errors.push("Phi\xEAn b\u1EA3n c\u1EA5u tr\xFAc b\u1ED9 \u0111\u1EC1 kh\xF4ng \u0111\u01B0\u1EE3c h\u1ED7 tr\u1EE3.");
  if (!isText(content?.title, 160)) errors.push("Thi\u1EBFu t\xEAn b\u1ED9 \u0111\u1EC1.");
  if (!isText(content?.description, 2e3)) errors.push("Thi\u1EBFu m\xF4 t\u1EA3 b\u1ED9 \u0111\u1EC1.");
  if (!isText(content?.level, 80)) errors.push("Thi\u1EBFu tr\xECnh \u0111\u1ED9.");
  if (content?.timeLimitMinutes !== void 0 && (!Number.isInteger(content.timeLimitMinutes) || content.timeLimitMinutes < 1 || content.timeLimitMinutes > 180)) {
    errors.push("Th\u1EDDi gian l\xE0m b\xE0i ph\u1EA3i t\u1EEB 1 \u0111\u1EBFn 180 ph\xFAt.");
  }
  if (!Array.isArray(content?.parts) || content.parts.length !== 5) {
    errors.push("B\u1ED9 \u0111\u1EC1 ph\u1EA3i c\xF3 \u0111\xFAng 5 Part.");
    return errors;
  }
  validatePart1(content.parts[0], errors);
  validatePart2(content.parts[1], errors);
  validatePart3(content.parts[2], errors);
  validatePart4(content.parts[3], errors);
  validatePart5(content.parts[4], errors);
  return errors;
}
function sanitizeListeningAnswers(value) {
  const source = value && typeof value === "object" ? value : {};
  const record = (input, nested = false) => {
    if (!input || typeof input !== "object" || Array.isArray(input)) return {};
    const entries = Object.entries(input).slice(0, 100);
    return Object.fromEntries(entries.filter(([key]) => /^[a-zA-Z0-9_-]{1,160}$/.test(key)).map(([key, answer]) => [
      key,
      nested ? record(answer, false) : String(answer ?? "").slice(0, 500)
    ]));
  };
  const part5Record = (input) => {
    if (!input || typeof input !== "object" || Array.isArray(input)) return {};
    const sanitized = {};
    Object.entries(input).slice(0, 100).forEach(([key, rawAnswer]) => {
      if (!/^[a-zA-Z0-9_-]{1,160}$/.test(key)) return;
      if (typeof rawAnswer === "string") {
        sanitized[key] = rawAnswer.slice(0, 500);
        return;
      }
      if (!rawAnswer || typeof rawAnswer !== "object" || Array.isArray(rawAnswer)) return;
      const answer = rawAnswer;
      if (answer.type === "colour_object") {
        const objectId = String(answer.objectId ?? "").slice(0, 160);
        const colourId = String(answer.colourId ?? "").slice(0, 160);
        if (/^[a-zA-Z0-9_-]{1,160}$/.test(objectId) && /^[a-zA-Z0-9_-]{1,160}$/.test(colourId)) {
          sanitized[key] = { type: "colour_object", objectId, colourId };
        }
        return;
      }
      if (answer.type === "place_object") {
        const paletteItemId = String(answer.paletteItemId ?? "").slice(0, 160);
        const anchor = answer.anchor && typeof answer.anchor === "object" && !Array.isArray(answer.anchor) ? answer.anchor : {};
        const x = Number(anchor.x);
        const y = Number(anchor.y);
        if (/^[a-zA-Z0-9_-]{1,160}$/.test(paletteItemId) && Number.isFinite(x) && Number.isFinite(y) && x >= 0 && x <= 1 && y >= 0 && y <= 1) {
          sanitized[key] = { type: "place_object", paletteItemId, anchor: { x, y } };
        }
      }
    });
    return sanitized;
  };
  return {
    part1: record(source.part1),
    part2: record(source.part2, true),
    part3: record(source.part3),
    part4: record(source.part4),
    part5: part5Record(source.part5)
  };
}
function sanitizeListeningContentForStudent(content) {
  const copy = structuredClone(content);
  copy.parts.forEach((part) => {
    delete part.audioTranscript;
  });
  copy.parts[0].targets = copy.parts[0].targets.map(({ choiceId: _answer, ...target }) => target);
  if (copy.parts[0].example) delete copy.parts[0].example.choiceId;
  copy.parts[1].questions = copy.parts[1].questions.map((question) => ({
    ...question,
    blanks: question.blanks.map(({ acceptedAnswers: _answers, ...blank }) => blank)
  }));
  if (copy.parts[2].displayMode === "connect-image") {
    delete copy.parts[2].correctConnections;
    delete copy.parts[2].distractorAnswerId;
  } else {
    copy.parts[2].items = copy.parts[2].items.map(({ correctOptionId: _answer, ...item }) => item);
    if (copy.parts[2].example) delete copy.parts[2].example.correctOptionId;
  }
  copy.parts[3].questions = copy.parts[3].questions.map(({ correctOptionId: _answer, ...question }) => question);
  const part5 = copy.parts[4];
  if (part5.displayMode === "scene-colour-draw") {
    if (part5.interactionSchemaVersion === 2) {
      const publicColourIds = new Set(part5.colourPaletteIds || []);
      part5.colours = part5.colours.filter((colour) => publicColourIds.has(colour.id));
    }
    part5.interactiveObjects = part5.interactiveObjects.map(({ geometryConfirmedByTeacher: _confirmed, ...object }) => object);
    part5.questions = part5.questions.map((question) => ({
      id: question.id,
      questionNumber: question.questionNumber,
      actions: question.actions.map((action) => ({ id: action.id, type: action.type }))
    }));
  } else {
    part5.targets = part5.targets.map(({ correctColourId: _answer, ...target }) => target);
    if (part5.example) delete part5.example.correctColourId;
  }
  return copy;
}

// src/server/listening-smart-import/service.ts
var import_node_crypto3 = __toESM(require("node:crypto"), 1);

// src/features/listening-library/modules/mover/editor/colourCatalog.ts
var MOVER_COLOUR_CATALOG = [
  { label: "Red", value: "#EF4444" },
  { label: "Blue", value: "#2563EB" },
  { label: "Green", value: "#16A34A" },
  { label: "Yellow", value: "#FACC15" },
  { label: "Orange", value: "#F97316" },
  { label: "Purple", value: "#7C3AED" },
  { label: "Pink", value: "#EC4899" },
  { label: "Brown", value: "#92400E" },
  { label: "Black", value: "#111827" },
  { label: "White", value: "#FFFFFF" },
  { label: "Grey", value: "#6B7280" },
  { label: "Light Blue", value: "#7DD3FC" },
  { label: "Dark Blue", value: "#1E3A8A" },
  { label: "Light Green", value: "#86EFAC" },
  { label: "Dark Green", value: "#166534" },
  { label: "Light Pink", value: "#F9A8D4" },
  { label: "Dark Red", value: "#991B1B" },
  { label: "Beige", value: "#D6C7A1" },
  { label: "Gold", value: "#D4A017" },
  { label: "Silver", value: "#A8A9AD" }
];

// src/server/listening-smart-import/service.ts
var cleanText = (value, max = 1e3) => String(value ?? "").normalize("NFKC").trim().slice(0, max);
var comparable = (value) => cleanText(value, 300).toLocaleLowerCase("en").replace(/[\u2018\u2019\u02bc`]/g, "'").replace(/\s+/g, " ");
var clamp = (value, fallback = 0.5) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.min(1, Math.max(0, numeric)) : fallback;
};
var list = (value) => Array.isArray(value) ? value : [];
var integer = (value) => Number.isInteger(Number(value)) ? Number(value) : void 0;
var questionNumber = (value) => {
  const parsed = integer(value);
  return parsed && parsed >= 1 && parsed <= 5 ? parsed : void 0;
};
var DEFAULT_SMART_IMPORT_AI_PROVIDER_ID = "stali:gpt-5.6-sol";
var PART1_SOL_PROVIDER_IDS = /* @__PURE__ */ new Set([
  "stali:gpt-5.6-sol",
  "devquota:gpt-5.6-sol"
]);
function parseJson3(text4) {
  const trimmed = text4.trim();
  if (!trimmed) throw new Error("AI kh\xF4ng tr\u1EA3 v\u1EC1 d\u1EEF li\u1EC7u.");
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const object = fenced?.[1] || trimmed.match(/(\{[\s\S]*\}|\[[\s\S]*\])/)?.[1];
    if (!object) throw new Error("AI kh\xF4ng tr\u1EA3 v\u1EC1 JSON h\u1EE3p l\u1EC7.");
    return JSON.parse(object.trim());
  }
}
function providerFailureDetails(reason) {
  const rawDetails = Array.isArray(reason?.details) ? reason.details : Array.isArray(reason?.details?.providers) ? reason.details.providers : [];
  const details = rawDetails.map((value) => cleanText(value, 300)).filter(Boolean).slice(0, 5);
  if (!details.length) {
    const fallback = cleanText(reason?.message || reason || "Nh\xE0 cung c\u1EA5p AI kh\xF4ng kh\u1EA3 d\u1EE5ng.", 300);
    if (fallback) details.push(fallback);
  }
  return details;
}
function providerFailureError(reason, part, schemaName, signal) {
  const aborted = signal?.aborted || reason?.name === "AbortError";
  const error = new Error(aborted ? `Smart Import Part ${part} \u0111\xE3 b\u1ECB h\u1EE7y do qu\xE1 th\u1EDDi gian x\u1EED l\xFD.` : `Nh\xE0 cung c\u1EA5p AI kh\xF4ng ho\xE0n t\u1EA5t ph\xE2n t\xEDch Part ${part}. Draft ch\u01B0a \u0111\u01B0\u1EE3c thay \u0111\u1ED5i.`);
  const upstreamStatus = Number(reason?.status);
  error.status = aborted ? 504 : upstreamStatus === 503 || upstreamStatus === 504 ? upstreamStatus : 502;
  error.details = providerFailureDetails(reason);
  error.code = aborted ? "LISTENING_SMART_IMPORT_TIMEOUT" : "LISTENING_SMART_IMPORT_PROVIDER_FAILED";
  error.schemaName = schemaName;
  return error;
}
var textSchema = (maxLength = 1e3) => ({ type: "string", maxLength });
var numberSchema = { type: "number", minimum: 0, maximum: 1 };
var pointSchema = {
  type: "object",
  properties: { x: numberSchema, y: numberSchema },
  required: ["x", "y"],
  additionalProperties: false
};
var regionSchema = {
  type: "object",
  properties: {
    shape: { type: "string", enum: ["rect", "ellipse", "polygon"] },
    x: numberSchema,
    y: numberSchema,
    width: numberSchema,
    height: numberSchema,
    points: { type: "array", items: pointSchema, maxItems: 80 }
  },
  required: ["shape", "x", "y", "width", "height"],
  additionalProperties: false
};
var cropSchema = {
  type: "object",
  properties: { x: numberSchema, y: numberSchema, width: numberSchema, height: numberSchema },
  required: ["x", "y", "width", "height"],
  additionalProperties: false
};
function responseSchemaFor(part) {
  const numbered = { type: "integer", minimum: 1, maximum: 5 };
  if (part === 1) return {
    type: "object",
    additionalProperties: false,
    properties: {
      questionScene: regionSchema,
      positionScene: regionSchema,
      printedNames: { type: "array", items: { type: "object", properties: { label: textSchema(120) }, required: ["label"], additionalProperties: false }, maxItems: 12 },
      example: { type: "object", properties: { label: textSchema(120), targetEndpoint: pointSchema, coordinateRole: { type: "string", enum: ["question", "position_key"] } }, required: ["label"], additionalProperties: false },
      targets: { type: "array", items: { type: "object", properties: { targetNumber: numbered, visualLabel: textSchema(120), targetEndpoint: pointSchema, coordinateRole: { type: "string", enum: ["question", "position_key"] }, confidence: numberSchema }, required: ["targetNumber", "visualLabel"], additionalProperties: false }, maxItems: 5 },
      answerMappings: { type: "array", items: { type: "object", properties: { targetNumber: numbered, visualLabel: textSchema(120), choiceLabel: textSchema(120) }, required: ["targetNumber", "choiceLabel"], additionalProperties: false }, maxItems: 5 },
      warnings: { type: "array", items: textSchema(500) }
    },
    required: ["printedNames", "targets", "answerMappings", "warnings"]
  };
  if (part === 2) return {
    type: "object",
    additionalProperties: false,
    properties: {
      heading: textSchema(200),
      instruction: textSchema(500),
      exampleText: textSchema(500),
      illustrationCrop: cropSchema,
      questions: { type: "array", items: { type: "object", properties: { questionNumber: numbered, prompt: textSchema() }, required: ["questionNumber", "prompt"], additionalProperties: false }, maxItems: 5 },
      answers: { type: "array", items: { type: "object", properties: { questionNumber: numbered, correctAnswer: textSchema(300), answerVariants: { type: "array", items: textSchema(300), maxItems: 8 } }, required: ["questionNumber"], additionalProperties: false }, maxItems: 5 },
      warnings: { type: "array", items: textSchema(500) }
    },
    required: ["questions", "answers", "warnings"]
  };
  if (part === 3) return {
    type: "object",
    additionalProperties: false,
    properties: {
      questionAnswers: { type: "array", items: { type: "object", properties: { label: textSchema(160), region: regionSchema, leftAnchorOffset: numberSchema, rightAnchorOffset: numberSchema }, required: ["label"], additionalProperties: false }, maxItems: 7 },
      questionPictures: { type: "array", items: { type: "object", properties: { label: textSchema(160), side: { type: "string", enum: ["left", "right"] }, row: { type: "integer", minimum: 1, maximum: 3 }, region: regionSchema, anchorOffset: numberSchema }, required: ["side", "row"], additionalProperties: false }, maxItems: 6 },
      questionExample: { type: "object", properties: { answerLabel: textSchema(160), pictureSide: { type: "string", enum: ["left", "right"] }, pictureRow: { type: "integer", minimum: 1, maximum: 3 }, renderOverlayLine: { type: "boolean" } }, required: ["answerLabel", "pictureSide", "pictureRow"], additionalProperties: false },
      answerKeyCells: { type: "array", items: { type: "object", properties: { answerLabel: textSchema(160), side: { type: "string", enum: ["left", "right"] }, row: { type: "integer", minimum: 1, maximum: 3 } }, required: ["answerLabel", "side", "row"], additionalProperties: false }, maxItems: 6 },
      warnings: { type: "array", items: textSchema(500) }
    },
    required: ["questionAnswers", "questionPictures", "answerKeyCells", "warnings"]
  };
  if (part === 4) return {
    type: "object",
    additionalProperties: false,
    properties: {
      example: { type: "object", properties: { prompt: textSchema(), crops: { type: "array", items: cropSchema, maxItems: 3 }, answer: { type: "string", enum: ["A", "B", "C"] } }, required: ["prompt"], additionalProperties: false },
      questions: { type: "array", items: { type: "object", properties: { questionNumber: numbered, prompt: textSchema(), crops: { type: "array", items: cropSchema, maxItems: 3 } }, required: ["questionNumber", "prompt"], additionalProperties: false }, maxItems: 5 },
      answers: { type: "array", items: { type: "object", properties: { questionNumber: numbered, answer: { type: "string", enum: ["A", "B", "C"] } }, required: ["questionNumber", "answer"], additionalProperties: false }, maxItems: 5 },
      orderedFallbackEvidence: { type: "string", enum: ["single-row", "single-column"] },
      warnings: { type: "array", items: textSchema(500) }
    },
    required: ["questions", "answers", "warnings"]
  };
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      paletteItems: { type: "array", items: { type: "object", properties: { objectType: textSchema(120), label: textSchema(160), color: textSchema(80) }, required: ["objectType", "label"], additionalProperties: false }, maxItems: 30 },
      questions: { type: "array", items: { type: "object", properties: { questionNumber: numbered, prompt: textSchema(), actions: { type: "array", items: { type: "object", properties: { type: { type: "string", enum: ["colour_object", "place_object"] }, objectLabel: textSchema(160), objectType: textSchema(120), correctColor: textSchema(80), color: textSchema(80), targetRegion: regionSchema, relationLabel: textSchema(240), confidence: numberSchema }, required: ["type"], additionalProperties: false }, maxItems: 10 } }, required: ["questionNumber", "prompt", "actions"], additionalProperties: false }, maxItems: 5 },
      warnings: { type: "array", items: textSchema(500) }
    },
    required: ["paletteItems", "questions", "warnings"]
  };
}
function part3PassSchema(pass) {
  if (pass === "question") return {
    type: "object",
    additionalProperties: false,
    properties: {
      questionAnswers: {
        type: "array",
        minItems: 7,
        maxItems: 7,
        items: {
          type: "object",
          additionalProperties: false,
          properties: { label: textSchema(160), region: regionSchema, leftAnchorOffset: numberSchema, rightAnchorOffset: numberSchema },
          required: ["label", "region"]
        }
      },
      questionPictures: {
        type: "array",
        minItems: 6,
        maxItems: 6,
        items: {
          type: "object",
          additionalProperties: false,
          properties: { label: textSchema(160), side: { type: "string", enum: ["left", "right"] }, row: { type: "integer", minimum: 1, maximum: 3 }, region: regionSchema, anchorOffset: numberSchema },
          required: ["side", "row", "region"]
        }
      },
      questionExample: {
        type: "object",
        additionalProperties: false,
        properties: {
          resolved: { type: "boolean" },
          lineEvidence: { type: "string", enum: ["printed-line"] },
          answerLabel: textSchema(160),
          pictureSide: { type: "string", enum: ["left", "right"] },
          pictureRow: { type: "integer", minimum: 1, maximum: 3 },
          confidence: numberSchema,
          renderOverlayLine: { type: "boolean" }
        },
        required: ["resolved"]
      },
      warnings: { type: "array", items: textSchema(500) }
    },
    required: ["questionAnswers", "questionPictures", "questionExample", "warnings"]
  };
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      layoutEvidence: { type: "string", enum: ["three-rows-two-columns"] },
      answerKeyCells: {
        type: "array",
        minItems: 5,
        maxItems: 6,
        items: {
          type: "object",
          additionalProperties: false,
          properties: { answerLabel: textSchema(160), side: { type: "string", enum: ["left", "right"] }, row: { type: "integer", minimum: 1, maximum: 3 } },
          required: ["answerLabel", "side", "row"]
        }
      },
      warnings: { type: "array", items: textSchema(500) }
    },
    required: ["layoutEvidence", "answerKeyCells", "warnings"]
  };
}
function promptForPart3QuestionPass() {
  return `You inspect only ROLE question for Cambridge Movers Listening Part 3. Return only JSON and never technical IDs.
The worksheet always contains exactly seven answer labels in the centre, exactly three picture regions on the left, exactly three picture regions on the right, and exactly one pre-drawn printed example line.
Find the example ONLY by visually tracing that existing line on ROLE question. Do not infer it from answer order, typography, likely meaning, or any answer-key convention. Return questionExample.resolved=false if the printed line cannot be traced confidently; never guess.
For the traced line return lineEvidence="printed-line", the centre answer label it touches, the picture side and row it touches, and confidence. Do not return endpoints or line geometry. Rows are top=1, middle=2, bottom=3 independently on each side.
Return all seven questionAnswers with normalized regions, all six questionPictures with normalized regions, questionExample, and warnings. The printed example line is already visible on the background, so renderOverlayLine must be false.`;
}
function promptForPart3AnswerKeyPass(questionRaw) {
  const example = questionRaw?.questionExample;
  const verifiedExample = `${cleanText(example?.answerLabel, 160)} -> ${cleanText(example?.pictureSide, 20)} row ${integer(example?.pictureRow) || "?"}`;
  const labels = list(questionRaw?.questionAnswers).map((entry) => cleanText(entry?.label, 160)).filter(Boolean).join(", ");
  return `You inspect only ROLE answer_key for Cambridge Movers Listening Part 3. Return only JSON and never technical IDs.
Read the key as a spatial grid, never as linear OCR order: left column top/middle/bottom maps to left picture rows 1/2/3; right column top/middle/bottom maps to right picture rows 1/2/3.
The example was independently verified from the printed line on ROLE question as: ${verifiedExample}. The seven allowed labels are: ${labels}.
The answer key may contain all six picture cells including the example, or only the five scored cells. Preserve each cell's side and row. Do not select or change the example from this image. Do not shift rows when a cell is missing. Return layoutEvidence="three-rows-two-columns", answerKeyCells, and warnings.`;
}
function validatePart3QuestionResponse(raw) {
  const answers = list(raw?.questionAnswers);
  const pictures = list(raw?.questionPictures);
  const answerRows = answers.flatMap((entry) => {
    const label = cleanText(entry?.label, 160);
    const region = normalizedRegion(entry?.region || entry);
    return label && region ? [{ label, region }] : [];
  });
  const pictureRows = pictures.flatMap((entry) => {
    const side = entry?.side === "left" || entry?.side === "right" ? entry.side : void 0;
    const row = integer(entry?.row);
    const region = normalizedRegion(entry?.region || entry);
    return side && row && row >= 1 && row <= 3 && region ? [{ side, row, region }] : [];
  });
  const issues = [];
  if (answerRows.length !== 7 || new Set(answerRows.map((entry) => comparable(entry.label))).size !== 7) issues.push("questionAnswers ph\u1EA3i c\xF3 \u0111\xFAng 7 label/region duy nh\u1EA5t");
  const pictureSlots = pictureRows.map((entry) => `${entry.side}:${entry.row}`);
  if (pictureRows.length !== 6 || new Set(pictureSlots).size !== 6) issues.push("questionPictures ph\u1EA3i c\xF3 \u0111\xFAng left/right x row 1..3");
  const example = raw?.questionExample;
  const exampleLabel = cleanText(example?.answerLabel, 160);
  const exampleSide = example?.pictureSide === "left" || example?.pictureSide === "right" ? example.pictureSide : void 0;
  const exampleRow = integer(example?.pictureRow);
  const answer = answerRows.find((entry) => comparable(entry.label) === comparable(exampleLabel));
  const picture = pictureRows.find((entry) => entry.side === exampleSide && entry.row === exampleRow);
  if (example?.resolved !== true || example?.lineEvidence !== "printed-line" || !answer || !picture) {
    issues.push("questionExample ch\u01B0a ch\u1EE9ng minh \u0111\u01B0\u1EE3c \u0111\xFAng m\u1ED9t printed line t\u1EEB answer t\u1EDBi picture");
  }
  const confidence = Number(example?.confidence);
  if (!Number.isFinite(confidence) || confidence < 0.55) issues.push("confidence c\u1EE7a printed example line qu\xE1 th\u1EA5p");
  return issues.length ? issues.join("; ") : void 0;
}
function validatePart3AnswerKeyResponse(raw, questionRaw) {
  const issues = [];
  if (raw?.layoutEvidence !== "three-rows-two-columns") issues.push("answer key thi\u1EBFu evidence b\u1ED1 c\u1EE5c ba h\xE0ng hai c\u1ED9t");
  const allowedLabels = new Set(list(questionRaw?.questionAnswers).map((entry) => comparable(entry?.label)).filter(Boolean));
  const cells = list(raw?.answerKeyCells).flatMap((entry) => {
    const label = cleanText(entry?.answerLabel, 160);
    const side = entry?.side === "left" || entry?.side === "right" ? entry.side : void 0;
    const row = integer(entry?.row);
    return label && side && row && row >= 1 && row <= 3 ? [{ label, side, row, slot: `${side}:${row}` }] : [];
  });
  if (![5, 6].includes(cells.length)) issues.push("answerKeyCells ph\u1EA3i c\xF3 \u0111\xFAng 5 scored cells ho\u1EB7c \u0111\u1EE7 6 cells g\u1ED3m example");
  if (new Set(cells.map((cell) => cell.slot)).size !== cells.length) issues.push("answer key b\u1ECB tr\xF9ng side+row");
  if (new Set(cells.map((cell) => comparable(cell.label))).size !== cells.length) issues.push("answer key b\u1ECB tr\xF9ng label");
  if (cells.some((cell) => !allowedLabels.has(comparable(cell.label)))) issues.push("answer key ch\u1EE9a label kh\xF4ng c\xF3 tr\xEAn \u1EA3nh \u0111\u1EC1");
  return issues.length ? issues.join("; ") : void 0;
}
function part1PassSchema(pass) {
  const numbered = { type: "integer", minimum: 1, maximum: 5 };
  if (pass === "content") return {
    type: "object",
    additionalProperties: false,
    properties: {
      questionScene: regionSchema,
      printedNames: { type: "array", items: { type: "object", properties: { label: textSchema(120) }, required: ["label"], additionalProperties: false }, maxItems: 12 },
      example: {
        type: "object",
        additionalProperties: false,
        properties: {
          label: textSchema(120),
          labelPoint: pointSchema,
          targetPoint: pointSchema,
          confidence: numberSchema
        },
        required: ["label", "labelPoint", "targetPoint"]
      },
      answerMappings: {
        type: "array",
        maxItems: 5,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            targetNumber: numbered,
            printedName: textSchema(120),
            visualDescription: textSchema(200),
            questionSubjectRegion: regionSchema,
            questionActionRegion: regionSchema,
            questionTargetPoint: pointSchema,
            confidence: numberSchema
          },
          required: ["targetNumber", "printedName"]
        }
      },
      warnings: { type: "array", items: textSchema(500) }
    },
    required: ["questionScene", "printedNames", "example", "answerMappings", "warnings"]
  };
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      positionScene: regionSchema,
      example: {
        type: "object",
        additionalProperties: false,
        properties: {
          label: textSchema(120),
          lineEndpoints: { type: "array", items: pointSchema, minItems: 2, maxItems: 2 },
          confidence: numberSchema
        },
        required: ["label", "lineEndpoints", "confidence"]
      },
      resolvedTargets: {
        type: "array",
        maxItems: 5,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            targetNumber: numbered,
            printedName: textSchema(120),
            visualDescription: textSchema(200),
            lineEndpoints: { type: "array", items: pointSchema, minItems: 2, maxItems: 2 },
            questionActionRegion: regionSchema,
            questionTargetPoint: pointSchema,
            confidence: numberSchema
          },
          required: ["targetNumber", "printedName", "lineEndpoints", "questionActionRegion"]
        }
      },
      unresolvedTargetNumbers: { type: "array", items: numbered, maxItems: 5 },
      warnings: { type: "array", items: textSchema(500) }
    },
    required: ["positionScene", "example", "resolvedTargets", "unresolvedTargetNumbers", "warnings"]
  };
}
function part1GeometryContext(contentRaw) {
  const mappings = list(contentRaw?.answerMappings).flatMap((entry) => {
    const targetNumber = questionNumber(entry?.targetNumber);
    const printedName = cleanText(entry?.printedName || entry?.choiceLabel || entry?.answer, 120);
    if (!targetNumber || !printedName) return [];
    const visualDescription = cleanText(entry?.visualDescription || entry?.visualLabel, 200);
    return [{ targetNumber, printedName, ...visualDescription ? { visualDescription } : {} }];
  });
  return {
    printedNames: list(contentRaw?.printedNames).map((entry) => cleanText(entry?.label ?? entry, 120)).filter(Boolean),
    mappings
  };
}
function part1QuestionVerificationSchema() {
  const numbered = { type: "integer", minimum: 1, maximum: 5 };
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      label: textSchema(120),
      labelPoint: pointSchema,
      targetPoint: pointSchema,
      confidence: numberSchema,
      targets: {
        type: "array",
        maxItems: 5,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            targetNumber: numbered,
            visualDescription: textSchema(200),
            questionSubjectRegion: regionSchema,
            questionActionRegion: regionSchema,
            confidence: numberSchema
          },
          required: ["targetNumber", "visualDescription", "questionSubjectRegion", "questionActionRegion", "confidence"]
        }
      },
      warnings: { type: "array", items: textSchema(500) }
    },
    required: ["label", "labelPoint", "targetPoint", "confidence", "targets", "warnings"]
  };
}
function part1SolExampleVerificationSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      label: textSchema(120),
      labelPoint: pointSchema,
      targetPoint: pointSchema,
      confidence: numberSchema,
      warnings: { type: "array", items: textSchema(500) }
    },
    required: ["label", "labelPoint", "targetPoint", "confidence", "warnings"]
  };
}
function part1SolGeometrySchema() {
  const numbered = { type: "integer", minimum: 1, maximum: 5 };
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      resolvedTargets: {
        type: "array",
        maxItems: 5,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            targetNumber: numbered,
            printedName: textSchema(120),
            questionTargetPoint: pointSchema,
            confidence: numberSchema
          },
          required: ["targetNumber", "printedName", "questionTargetPoint", "confidence"]
        }
      },
      unresolvedTargetNumbers: { type: "array", items: numbered, maxItems: 5 },
      warnings: { type: "array", items: textSchema(500) }
    },
    required: ["resolvedTargets", "unresolvedTargetNumbers", "warnings"]
  };
}
function promptForPart1QuestionVerification(contentRaw) {
  const printedNames = list(contentRaw?.printedNames).map((entry) => cleanText(entry?.label ?? entry, 120)).filter(Boolean);
  const mappings = part1GeometryContext(contentRaw).mappings;
  return `Independently verify geometry on only the clean ROLE question image for Cambridge Movers Listening Part 1. Return only JSON matching the schema. Never return UUIDs or technical/database IDs. The visible names are ${JSON.stringify(printedNames)}. The five numbered visual descriptions are ${JSON.stringify(mappings)}. Exactly one visible name has a pre-drawn sample line: return that name as label, labelPoint beside its printed text outside the illustrated scene, and targetPoint at the other physical end inside the scene. Do not inherit an example guess from another pass.
For every targetNumber 1..5, copy visualDescription unchanged, tightly bound the primary person in questionSubjectRegion and tightly bound only the small visible action/contact landmark in questionActionRegion. The action landmark is where a small answer box belongs: banana at mouth, apple at hand/horse mouth, rabbit being held, reaching hands while chasing, pencil/paper while drawing, or the analogous landmark stated by visualDescription. Never use a whole body, torso, feet, secondary object or empty ground as questionActionRegion. The action region may sit immediately beside the primary person's body. Coordinates are normalized 0..1 relative to the complete ROLE question image, never relative to the illustrated-scene crop. Never return technical IDs. Use warnings rather than guessing.`;
}
function promptForPart1SolExampleVerification(contentRaw) {
  const printedNames = part1GeometryContext(contentRaw).printedNames;
  return `Inspect only IMAGE 1 (ROLE question). Visible names: ${JSON.stringify(printedNames)}.
Find the one printed name that already has a sample line on IMAGE 1. Return that label, a point beside its printed text, and the other endpoint of the same line inside the picture. Coordinates are normalized to the complete IMAGE 1. Do not inspect the five scored targets in this step.`;
}
function promptForPart1SolGeometry(contentRaw) {
  const context = part1GeometryContext(contentRaw).mappings;
  return `IMAGE 1 is ROLE question, IMAGE 2 is ROLE answer_key, and IMAGE 3 is ROLE position_key.
Verified mappings: ${JSON.stringify(context)}.
Use IMAGES 2 and 3 to identify the correct person for each mapping, then locate that same person on IMAGE 1. On IMAGE 3, follow the line from printedName to its person-side endpoint; never use the name-side endpoint. Return questionTargetPoint at the equivalent point on IMAGE 1, normalized to the complete IMAGE 1.
Do not re-read or change names, target numbers, descriptions, answers, or the example. Return only targets 1..5; exclude the example. If one target is uncertain, put only its number in unresolvedTargetNumbers instead of guessing.`;
}
function promptForPart1Pass(pass, contentRaw) {
  const common = "You extract structured data for Cambridge Movers Listening Part 1. Each attached image is explicitly preceded by its technical ROLE label. Never use audio or transcript. Return only JSON matching the supplied schema. Coordinates are normalized 0..1 relative to the complete image for the named role. Never return UUIDs or technical/database/question/choice/target IDs. Do not guess unreadable text or geometry; use warnings and unresolvedTargetNumbers.";
  if (pass === "content") return `${common}
Only ROLE question and ROLE answer_key are supplied. From question, detect every printed name. The example is not an unused-name guess: it is the one printed name that already has a visible pre-drawn sample line on ROLE question. Return its labelPoint beside the printed name and targetPoint at the other end inside the illustrated scene. Detect all visible names first, prove and remove that example, and leave exactly six draggable choices. From each numbered answer-key line, printedName is only the person's printed name immediately after the number (for example "1 Paul and the boy..." means printedName="Paul"); visualDescription is the remaining description of the destination person/picture. Return exactly five mappings keyed by targetNumber 1..5. Never put the visual description in printedName. On the clean ROLE question image, questionSubjectRegion tightly bounds the primary person described by visualDescription. questionActionRegion tightly bounds only the small visible action/contact landmark where an answer box belongs, such as banana at mouth, apple at hand/horse mouth, rabbit being held, reaching hands while chasing, or pencil/paper while drawing. questionActionRegion must not be the whole person, torso, feet or empty ground. questionTargetPoint, when returned, is the centre of questionActionRegion. The action region may be immediately beside questionSubjectRegion but must remain near that primary person. When a secondary object is mentioned, keep questionSubjectRegion on the primary person ("girl chasing the sheep" means the girl; "boy giving an apple to the horse" means the boy). Return questionScene around only the illustrated scene and exclude every printed-name band. Every coordinate is relative to the complete ROLE question image, not relative to questionScene. Do not use ROLE answer_key for coordinates; omit uncertain optional localization fields and add a warning rather than selecting a different subject.`;
  const context = JSON.stringify(part1GeometryContext(contentRaw));
  return `${common}
ROLE question, ROLE answer_key and ROLE position_key are supplied together for cross-image verification. ROLE position_key is the only source for completed line geometry; ROLE question is the canonical coordinate target and ROLE answer_key confirms the five name/description mappings.
The verified names and numbered answer mappings are: ${context}
For each numbered mapping, follow the line associated with printedName in position_key. Return printedName and visualDescription unchanged from the verified context. Return both physical line endpoints in lineEndpoints, in position_key coordinates. The endpoint beside the printed name is NOT the target. The target endpoint is the other endpoint, inside the illustrated scene and touching or nearest the person/picture. This is not always the lower endpoint because some printed names are below the scene.
Independently inspect ROLE question for the single pre-drawn example line. Do not inherit or guess an example from the content pass. Return example.label plus both endpoints of that one visible line in complete ROLE question coordinates; one endpoint must be beside the printed name outside questionScene and the other must be inside questionScene.
Use visualDescription to confirm the subject reached by the physical line. After tracing the endpoint on position_key, locate the same exact contact/action landmark on ROLE question. questionActionRegion must tightly bound only that small landmark (banana at mouth, apple at hand/horse mouth, rabbit being held, reaching hands while chasing, or pencil/paper while drawing), never a whole person, torso, feet or empty ground. questionTargetPoint, when returned, is the centre of questionActionRegion. A contact landmark may sit immediately beside the primary person's body. When visualDescription mentions a secondary object, retain the primary person's action landmark: for example use the chasing girl's reaching hands rather than the sheep, and the boy's apple/hand rather than the horse's body. Coordinates for questionActionRegion and questionTargetPoint are relative to the complete ROLE question image, not questionScene and not position_key. positionScene must bound the illustrated scene only, excluding the printed-name bands. Return resolvedTargets keyed by targetNumber, and put uncertain numbers in unresolvedTargetNumbers. Handle the example separately and never count it among the five scored targets.`;
}
function promptForPart5Content() {
  return `Return only JSON matching the supplied schema. Three role-labelled images are supplied: ROLE question is the clean image shown to students, ROLE answer_key is the authoritative source for the five numbered Colour/Draw instructions, and ROLE position_key shows the completed answer positions on the same scene. Transcribe every numbered instruction from ROLE answer_key and always return all of its logical actions; one question may contain several actions. A Colour action must keep objectLabel and correctColor from the instruction. A Draw action must keep objectType, optional color and relationLabel even when its position is uncertain. Never omit an action merely because targetRegion is uncertain: omit only targetRegion and add a warning. The already-coloured illustration on ROLE question is the unscored example, never an action or palette item. paletteItems contains only Draw objects, not printed colour swatches and not invented distractors. Use only these colour labels: ${MOVER_COLOUR_CATALOG.map((colour) => colour.label).join(", ")}. For every place_object, compare position_key with question and, when certain, return a normalized rectangular targetRegion in complete ROLE question coordinates around the intended placement (for example the lamp location on the bedside table or the toy plane location between the boys). Do not return geometry for colour_object because the teacher paints those masks. Never return technical IDs. Never use audio or transcript. Add warnings instead of guessing uncertain content or Draw position.`;
}
function validatePart5ContentResponse(raw, attempt) {
  if (attempt > 1) return void 0;
  const questions = list(raw?.questions);
  const issues = [];
  const seenNumbers = /* @__PURE__ */ new Set();
  questions.forEach((question) => {
    const number2 = Number(question?.questionNumber);
    if (!Number.isInteger(number2) || number2 < 1 || number2 > 5 || seenNumbers.has(number2)) {
      issues.push("questionNumber ph\u1EA3i duy nh\u1EA5t trong 1..5");
      return;
    }
    seenNumbers.add(number2);
    const actions = list(question?.actions);
    if (!actions.length) issues.push(`c\xE2u ${number2} thi\u1EBFu action`);
    actions.forEach((action) => {
      if (action?.type === "colour_object" && (!cleanText(action?.objectLabel, 160) || !catalogColourLabel(action?.correctColor || action?.color))) {
        issues.push(`c\xE2u ${number2} c\xF3 Colour thi\u1EBFu objectLabel/correctColor`);
      }
      if (action?.type === "place_object" && !cleanText(action?.objectType, 120)) issues.push(`c\xE2u ${number2} c\xF3 Draw thi\u1EBFu objectType`);
    });
  });
  if (seenNumbers.size !== 5) issues.push(`ch\u1EC9 nh\u1EADn ${seenNumbers.size}/5 c\xE2u`);
  return issues.length ? [...new Set(issues)].join("; ") : void 0;
}
var normalizedCoordinate = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return Number.NaN;
  return numeric > 1 && numeric <= 1e3 ? numeric / 1e3 : numeric;
};
function normalizedRect(value, minimum = 5e-3) {
  const source = value?.boundingBox || value?.bbox || value;
  if (Array.isArray(value?.box_2d) && value.box_2d.length === 4) {
    const [top, left, bottom2, right2] = value.box_2d.map(normalizedCoordinate);
    return normalizedRect({ x: left, y: top, width: right2 - left, height: bottom2 - top }, minimum);
  }
  const x = normalizedCoordinate(source?.x ?? source?.left);
  const y = normalizedCoordinate(source?.y ?? source?.top);
  const right = normalizedCoordinate(source?.right);
  const bottom = normalizedCoordinate(source?.bottom);
  const width = Number.isFinite(right) ? right - x : normalizedCoordinate(source?.width);
  const height = Number.isFinite(bottom) ? bottom - y : normalizedCoordinate(source?.height);
  const region = { shape: value?.shape === "ellipse" ? "ellipse" : "rect", x, y, width, height };
  return width >= minimum && height >= minimum && isValidListeningRegion(region) ? region : void 0;
}
function normalizedRegion(value) {
  if (value?.shape === "polygon" || !value?.shape && Array.isArray(value?.points) && value.points.length > 0) {
    const points = list(value?.points).slice(0, 80).map((point) => ({ x: normalizedCoordinate(point?.x), y: normalizedCoordinate(point?.y) }));
    return regionFromPolygon(points) || void 0;
  }
  return normalizedRect(value);
}
function normalizedPoint(value) {
  const x = normalizedCoordinate(value?.x);
  const y = normalizedCoordinate(value?.y);
  return Number.isFinite(x) && Number.isFinite(y) && x >= 0 && x <= 1 && y >= 0 && y <= 1 ? { x, y } : void 0;
}
function pointNearListeningRegion(point, region, margin = 0.035) {
  return pointInListeningRegion(point, region) || point.x >= region.x - margin && point.x <= region.x + region.width + margin && point.y >= region.y - margin && point.y <= region.y + region.height + margin;
}
function part1QuestionActionPoint(entry) {
  const actionRegion = normalizedRegion(entry?.questionActionRegion);
  if (actionRegion && actionRegion.width <= 0.18 && actionRegion.height <= 0.18) {
    return {
      x: actionRegion.x + actionRegion.width / 2,
      y: actionRegion.y + actionRegion.height / 2
    };
  }
  return normalizedPoint(entry?.questionTargetPoint);
}
function hasSafePart1QuestionLocation(entry, questionScene) {
  const point = part1QuestionActionPoint(entry);
  const subjectRegion = normalizedRegion(entry?.questionSubjectRegion);
  return Boolean(
    questionScene && point && subjectRegion && subjectRegion.width <= 0.35 && subjectRegion.height <= 0.5 && cleanText(entry?.visualDescription || entry?.visualLabel, 200) && clamp(entry?.confidence, 0) >= 0.85 && pointInListeningRegion(point, questionScene) && pointNearListeningRegion(point, subjectRegion, 0.08)
  );
}
function part1TransformedGeometryPoint(entry, expectedEntry, questionScene, positionScene) {
  const expectedPoint = part1QuestionActionPoint(expectedEntry);
  const subjectRegion = normalizedRegion(expectedEntry?.questionSubjectRegion);
  const endpoints = list(entry?.lineEndpoints).map(normalizedPoint).filter(Boolean);
  if (!expectedPoint || !subjectRegion || endpoints.length !== 2 || !questionScene || !positionScene) return void 0;
  const inside = endpoints.filter((point) => pointInListeningRegion(point, positionScene));
  if (inside.length !== 1) return void 0;
  const transformed = transformListeningPoint(inside[0], positionScene, questionScene);
  return transformed && pointInListeningRegion(transformed, questionScene) && pointNearListeningRegion(transformed, subjectRegion, 0.08) && part1PointDistance(transformed, expectedPoint) <= 0.12 ? transformed : void 0;
}
function part1GeometryEvidenceIsUsable(entry, expectedEntry, questionScene, positionScene) {
  return Boolean(part1TransformedGeometryPoint(entry, expectedEntry, questionScene, positionScene));
}
function validatePart1ContentResponse(raw) {
  const questionScene = normalizedRegion(raw?.questionScene);
  const names = list(raw?.printedNames).map((value) => cleanText(value?.label ?? value?.name ?? value, 120)).filter(Boolean);
  const exampleLabel = cleanText(raw?.example?.label || raw?.exampleLabel, 120);
  const exampleLabelPoint = normalizedPoint(raw?.example?.labelPoint);
  const exampleTargetPoint = normalizedPoint(raw?.example?.targetPoint);
  const choices = names.filter((name) => comparable(name) !== comparable(exampleLabel));
  const mappings = list(raw?.answerMappings);
  const issues = [];
  if (!exampleLabel || names.length !== 7 || choices.length !== 6 || new Set(names.map(comparable)).size !== 7) {
    issues.push("content ph\u1EA3i c\xF3 b\u1EA3y printedNames duy nh\u1EA5t, g\u1ED3m m\u1ED9t example v\xE0 s\xE1u choices");
  }
  if (!questionScene) issues.push("content ph\u1EA3i c\xF3 questionScene h\u1EE3p l\u1EC7, kh\xF4ng g\u1ED3m d\u1EA3i t\xEAn");
  if (!exampleLabelPoint || !exampleTargetPoint || !questionScene || pointInListeningRegion(exampleLabelPoint, questionScene) || !pointInListeningRegion(exampleTargetPoint, questionScene)) {
    issues.push("example ph\u1EA3i \u0111\u01B0\u1EE3c ch\u1EE9ng minh b\u1EB1ng labelPoint ngo\xE0i scene v\xE0 targetPoint trong scene c\u1EE7a \u0111\u01B0\u1EDDng m\u1EABu c\xF3 s\u1EB5n");
  }
  const seenNumbers = /* @__PURE__ */ new Set();
  const seenNames = /* @__PURE__ */ new Set();
  mappings.forEach((entry) => {
    const number2 = questionNumber(entry?.targetNumber);
    const printedName = cleanText(entry?.printedName || entry?.choiceLabel, 120);
    const key = comparable(printedName);
    if (!number2 || seenNumbers.has(number2)) issues.push("targetNumber mapping thi\u1EBFu ho\u1EB7c tr\xF9ng");
    else seenNumbers.add(number2);
    if (!key || seenNames.has(key) || !choices.some((choice2) => comparable(choice2) === key)) issues.push("printedName mapping ph\u1EA3i kh\u1EDBp duy nh\u1EA5t m\u1ED9t choice kh\xF4ng ph\u1EA3i example");
    else seenNames.add(key);
  });
  if (mappings.length !== 5 || seenNumbers.size !== 5 || seenNames.size !== 5) issues.push("content ph\u1EA3i c\xF3 \u0111\xFAng n\u0103m mapping \u0111\xE1nh s\u1ED1");
  return issues.length ? [...new Set(issues)].join("; ") : void 0;
}
function verifiedPart1GeometryExample(raw, contentRaw, questionScene) {
  const label = cleanText(raw?.example?.label, 120);
  const expectedLabel = cleanText(contentRaw?.example?.label, 120);
  const printedNames = list(contentRaw?.printedNames).map((entry) => cleanText(entry?.label ?? entry, 120)).filter(Boolean);
  const endpoints = list(raw?.example?.lineEndpoints).map(normalizedPoint).filter(Boolean);
  if (!label || !expectedLabel || comparable(label) !== comparable(expectedLabel) || !printedNames.some((name) => comparable(name) === comparable(label)) || !questionScene || endpoints.length !== 2 || clamp(raw?.example?.confidence, 0) < 0.8) return void 0;
  const inside = endpoints.filter((point) => pointInListeningRegion(point, questionScene));
  if (inside.length !== 1) return void 0;
  return { label, targetPoint: inside[0], confidence: clamp(raw?.example?.confidence, 0.8) };
}
function verifiedPart1QuestionExample(raw, contentRaw) {
  const questionScene = normalizedRegion(contentRaw?.questionScene);
  const label = cleanText(raw?.label, 120);
  const labelPoint = normalizedPoint(raw?.labelPoint);
  const targetPoint = normalizedPoint(raw?.targetPoint);
  const printedNames = list(contentRaw?.printedNames).map((entry) => cleanText(entry?.label ?? entry, 120)).filter(Boolean);
  if (!questionScene || !label || !labelPoint || !targetPoint || !printedNames.some((name) => comparable(name) === comparable(label)) || clamp(raw?.confidence, 0) < 0.8 || pointInListeningRegion(labelPoint, questionScene) || !pointInListeningRegion(targetPoint, questionScene)) return void 0;
  return { label, targetPoint, confidence: clamp(raw?.confidence, 0.8) };
}
function validatePart1QuestionVerification(raw, contentRaw) {
  const issues = [];
  const questionScene = normalizedRegion(contentRaw?.questionScene);
  if (!verifiedPart1QuestionExample(raw, contentRaw)) {
    issues.push("kh\xF4ng ch\u1EE9ng minh \u0111\u01B0\u1EE3c duy nh\u1EA5t t\xEAn example b\u1EB1ng \u0111\u01B0\u1EDDng m\u1EABu tr\xEAn \u1EA3nh \u0111\u1EC1");
  }
  const expected = new Map(list(contentRaw?.answerMappings).flatMap((entry) => {
    const number2 = questionNumber(entry?.targetNumber);
    return number2 ? [[number2, entry]] : [];
  }));
  const seen = /* @__PURE__ */ new Set();
  list(raw?.targets).forEach((entry) => {
    const number2 = questionNumber(entry?.targetNumber);
    if (!number2 || seen.has(number2) || !expected.has(number2)) {
      issues.push("question verification c\xF3 targetNumber thi\u1EBFu, tr\xF9ng ho\u1EB7c ngo\xE0i mapping");
      return;
    }
    seen.add(number2);
    if (comparable(entry?.visualDescription) !== comparable(expected.get(number2)?.visualDescription)) {
      issues.push(`target ${number2} kh\xF4ng gi\u1EEF \u0111\xFAng visualDescription t\u1EEB content pass`);
    }
    if (!hasSafePart1QuestionLocation({ ...expected.get(number2), ...entry }, questionScene)) {
      issues.push(`target ${number2} thi\u1EBFu action landmark an to\xE0n tr\xEAn \u1EA3nh \u0111\u1EC1`);
    }
    const expectedSubject = normalizedRegion(expected.get(number2)?.questionSubjectRegion);
    const verifiedSubject = normalizedRegion(entry?.questionSubjectRegion);
    if (expectedSubject && verifiedSubject) {
      const expectedCenter = { x: expectedSubject.x + expectedSubject.width / 2, y: expectedSubject.y + expectedSubject.height / 2 };
      const verifiedCenter = { x: verifiedSubject.x + verifiedSubject.width / 2, y: verifiedSubject.y + verifiedSubject.height / 2 };
      if (part1PointDistance(expectedCenter, verifiedCenter) > 0.16) {
        issues.push(`target ${number2} l\u1EC7ch primary subject so v\u1EDBi l\u01B0\u1EE3t content \u0111\u1ED9c l\u1EADp`);
      }
    }
  });
  if (seen.size !== 5 || [1, 2, 3, 4, 5].some((number2) => !seen.has(number2))) {
    issues.push("question verification ph\u1EA3i ph\u1EE7 \u0111\xFAng targetNumber 1..5");
  }
  return issues.length ? [...new Set(issues)].join("; ") : void 0;
}
function validatePart1SolExampleVerification(raw, contentRaw) {
  return verifiedPart1QuestionExample(raw, contentRaw) ? void 0 : "kh\xF4ng ch\u1EE9ng minh \u0111\u01B0\u1EE3c duy nh\u1EA5t t\xEAn example b\u1EB1ng \u0111\u01B0\u1EDDng m\u1EABu tr\xEAn \u1EA3nh \u0111\u1EC1";
}
function validatePart1SolGeometryResponse(raw, contentRaw) {
  const questionScene = normalizedRegion(contentRaw?.questionScene);
  const expected = new Map(list(contentRaw?.answerMappings).flatMap((entry) => {
    const number2 = questionNumber(entry?.targetNumber);
    return number2 ? [[number2, entry]] : [];
  }));
  const seen = /* @__PURE__ */ new Set();
  const issues = [];
  if (!questionScene) issues.push("content pass thi\u1EBFu questionScene h\u1EE3p l\u1EC7");
  list(raw?.resolvedTargets).forEach((entry) => {
    const number2 = questionNumber(entry?.targetNumber);
    if (!number2 || seen.has(number2)) {
      issues.push("resolved targetNumber thi\u1EBFu ho\u1EB7c tr\xF9ng");
      return;
    }
    seen.add(number2);
    if (!expected.has(number2) || comparable(expected.get(number2)?.printedName) !== comparable(entry?.printedName)) {
      issues.push(`target ${number2} kh\xF4ng gi\u1EEF \u0111\xFAng printedName t\u1EEB content pass`);
    }
    const point = normalizedPoint(entry?.questionTargetPoint);
    if (!point || !questionScene || !pointInListeningRegion(point, questionScene)) {
      issues.push(`target ${number2} thi\u1EBFu questionTargetPoint h\u1EE3p l\u1EC7 tr\xEAn \u1EA3nh \u0111\u1EC1`);
    }
    if (clamp(entry?.confidence, 0) < 0.7) {
      issues.push(`target ${number2} confidence th\u1EA5p; ph\u1EA3i chuy\u1EC3n target n\xE0y sang unresolved`);
    }
  });
  list(raw?.unresolvedTargetNumbers).forEach((value) => {
    const number2 = questionNumber(value);
    if (!number2 || seen.has(number2)) {
      issues.push("unresolved targetNumber thi\u1EBFu, tr\xF9ng ho\u1EB7c v\u1EEBa resolved v\u1EEBa unresolved");
      return;
    }
    seen.add(number2);
  });
  if (seen.size !== 5 || [1, 2, 3, 4, 5].some((number2) => !seen.has(number2))) {
    issues.push("resolvedTargets v\xE0 unresolvedTargetNumbers ph\u1EA3i ph\u1EE7 \u0111\xFAng 1..5");
  }
  return issues.length ? [...new Set(issues)].join("; ") : void 0;
}
function validatePart1GeometryResponse(raw, contentRaw, requireEveryResolvedTarget = false) {
  const questionScene = normalizedRegion(contentRaw?.questionScene);
  const positionScene = normalizedRegion(raw?.positionScene);
  const expected = new Map(list(contentRaw?.answerMappings).flatMap((entry) => {
    const number2 = questionNumber(entry?.targetNumber);
    return number2 ? [[number2, entry]] : [];
  }));
  const resolved = list(raw?.resolvedTargets);
  const unresolved = list(raw?.unresolvedTargetNumbers).flatMap((value) => {
    const number2 = questionNumber(value);
    return number2 ? [number2] : [];
  });
  const issues = [];
  if (!questionScene) issues.push("content pass thi\u1EBFu questionScene h\u1EE3p l\u1EC7");
  if (!positionScene) issues.push("thi\u1EBFu positionScene h\u1EE3p l\u1EC7");
  if (!verifiedPart1GeometryExample(raw, contentRaw, questionScene)) {
    issues.push("example geometry ph\u1EA3i \u0111\u1ED9c l\u1EADp ch\u1EE9ng minh \u0111\xFAng t\xEAn v\xE0 m\u1ED9t endpoint ngo\xE0i/m\u1ED9t endpoint trong questionScene");
  }
  const seenNumbers = /* @__PURE__ */ new Set();
  let usableResolvedTargets = 0;
  resolved.forEach((entry) => {
    const number2 = questionNumber(entry?.targetNumber);
    const printedName = cleanText(entry?.printedName || entry?.choiceLabel, 120);
    if (!number2 || seenNumbers.has(number2)) {
      issues.push("resolved targetNumber thi\u1EBFu ho\u1EB7c tr\xF9ng");
      return;
    }
    seenNumbers.add(number2);
    if (!expected.has(number2) || comparable(expected.get(number2)?.printedName) !== comparable(printedName)) {
      issues.push(`target ${number2} kh\xF4ng gi\u1EEF \u0111\xFAng printedName t\u1EEB content pass`);
    }
    if (part1GeometryEvidenceIsUsable(entry, expected.get(number2), questionScene, positionScene)) usableResolvedTargets += 1;
    else if (requireEveryResolvedTarget) issues.push(`target ${number2} kh\xF4ng kh\u1EDBp subject/scene evidence; c\u1EA7n trace l\u1EA1i \u0111\xFAng \u0111\u01B0\u1EDDng c\u1EE7a printedName`);
  });
  unresolved.forEach((number2) => {
    if (seenNumbers.has(number2)) issues.push(`target ${number2} v\u1EEBa resolved v\u1EEBa unresolved`);
    seenNumbers.add(number2);
  });
  if (seenNumbers.size !== 5 || [1, 2, 3, 4, 5].some((number2) => !seenNumbers.has(number2))) {
    issues.push("resolvedTargets v\xE0 unresolvedTargetNumbers ph\u1EA3i ph\u1EE7 \u0111\xFAng 1..5");
  }
  if (resolved.length && usableResolvedTargets === 0) issues.push("kh\xF4ng c\xF3 resolved target n\xE0o \u0111\u1EE7 direct point v\xE0 line/scene evidence nh\u1EA5t qu\xE1n");
  return issues.length ? [...new Set(issues)].join("; ") : void 0;
}
function normalizeCrop(value) {
  const region = normalizedRect(value, 0.02);
  return region ? { x: region.x, y: region.y, width: region.width, height: region.height } : void 0;
}
function fixedRegionFromPoint(point) {
  const width = 0.12;
  const height = 0.055;
  return {
    shape: "rect",
    x: Math.min(1 - width, Math.max(0, point.x - width / 2)),
    y: Math.min(1 - height, Math.max(0, point.y - height / 2)),
    width,
    height
  };
}
function promptFor(part, pastedText) {
  const common = `You extract structured data for Cambridge Movers Listening Part ${part}. Each attached image is explicitly preceded by its technical ROLE label; never infer roles from image order. Never use audio or transcript. Return only JSON. Coordinates are normalized 0..1. Do not invent unreadable text, answers, objects, colours, geometry or IDs. Never return UUID/database/question/action/object/choice IDs. Use warnings for uncertainty.`;
  const pasted = pastedText ? `
Teacher supplied an explicit manual OCR fallback for the answer text:
${pastedText}` : "";
  if (part === 1) return `${common}
ROLE question: detect every printed name, identify and separate the example, and locate the canonical scene. After removing the example there must be six draggable names. ROLE answer_key: read the five name-to-picture mappings. ROLE position_key: identify the five line endpoints on the picture/person side, never the name-side endpoints, plus the corresponding scene rectangle. Return questionScene, positionScene, printedNames, example, targets and answerMappings. Each target should have visualLabel, optional targetNumber, targetEndpoint and confidence; each mapping should have visualLabel/targetNumber and choiceLabel.${pasted}`;
  if (part === 2) return `${common}
ROLE question supplies optional heading/instruction, the example, and exactly five numbered prompts. ROLE answer_key supplies accepted answers numbered 1..5. Never infer an answer from the question image. Preserve text such as 4b exactly and split variants only when the source explicitly separates them with |. Return heading, instruction, exampleText, questions [{questionNumber,prompt}], answers [{questionNumber,correctAnswer,answerVariants}], and optional picture-only illustrationCrop from the question image.${pasted}`;
  if (part === 3) return `${common}
ROLE question is the full worksheet: detect seven centre answer labels/regions with left/right anchor hints, six picture regions arranged three left and three right, and the printed example connection. ROLE answer_key is a two-column by three-row mapping; preserve side+row and do not flatten OCR order. Return questionAnswers, questionPictures, questionExample, answerKeyCells and warnings. The example is unscored and the remaining unused answer is the distractor.${pasted}`;
  if (part === 4) return `${common}
ROLE question contains one example followed by exactly five numbered questions. Read only the example prompt and five numbered prompts; deterministic browser pixel code handles all picture crops, so crops may be omitted. ROLE answer_key supplies only scored answers 1..5 as A/B/C; map by questionNumber, never OCR index. Only the explicit example marker on the question image may set the example answer. Return valid JSON with example, questions, answers, orderedFallbackEvidence and warnings using exactly the supplied schema.${pasted}`;
  return `${common}
ROLE question, ROLE answer_key and ROLE position_key supply Part 5 content. Detect every colour_object/place_object action and return Draw target regions in ROLE question coordinates by comparing the completed position key with the clean question. Never return Colour masks or technical IDs; teachers paint Colour regions manually. Colours must use only: ${MOVER_COLOUR_CATALOG.map((colour) => colour.label).join(", ")}.${pasted}`;
}
function localNumberedLines(pastedText) {
  return pastedText.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const match = line.match(/^([1-5])[.)\s:-]+(.+)$/);
    return match ? { questionNumber: Number(match[1]), value: match[2].trim() } : { value: line };
  });
}
function normalizeNumberedEntries(values, convert, warnings, label, allowOrderedFallback = false) {
  const numbered = /* @__PURE__ */ new Map();
  const conflicts = /* @__PURE__ */ new Set();
  const unnumbered = [];
  values.forEach((entry) => {
    const value = convert(entry);
    if (value === void 0) return;
    const number2 = questionNumber(entry?.questionNumber ?? entry?.number);
    if (!number2) {
      unnumbered.push(value);
      return;
    }
    if (numbered.has(number2)) {
      numbered.delete(number2);
      conflicts.add(number2);
    } else if (!conflicts.has(number2)) numbered.set(number2, value);
  });
  conflicts.forEach((number2) => warnings.push(`${label}: s\u1ED1 c\xE2u ${number2} b\u1ECB tr\xF9ng n\xEAn \u0111\u01B0\u1EE3c gi\u1EEF unresolved.`));
  if (!numbered.size && allowOrderedFallback && unnumbered.length === 5) {
    warnings.push(`${label}: d\xF9ng ordered fallback v\xEC c\xF3 \u0111\xFAng n\u0103m gi\xE1 tr\u1ECB kh\xF4ng \u0111\xE1nh s\u1ED1 v\u1EDBi c\u1EA5u tr\xFAc r\xF5 r\xE0ng.`);
    unnumbered.forEach((value, index) => numbered.set(index + 1, value));
  } else if (numbered.size && unnumbered.length) {
    warnings.push(`${label}: b\u1ECF qua gi\xE1 tr\u1ECB kh\xF4ng \u0111\xE1nh s\u1ED1; kh\xF4ng d\u1ED3n index v\xE0o ch\u1ED7 tr\u1ED1ng.`);
  }
  return numbered;
}
var part1PointDistance = (first, second) => Math.hypot(first.x - second.x, first.y - second.y);
function resolvePart1TargetPoint(entry, questionScene, positionScene, warnings, warningLabel, requirePositionEvidence = false) {
  const explicitQuestionPoint = part1QuestionActionPoint(entry);
  const questionSubjectRegion = normalizedRegion(entry?.questionSubjectRegion);
  let directPoint = explicitQuestionPoint;
  if (!directPoint && entry?.coordinateRole !== "position_key") {
    directPoint = normalizedPoint(entry?.targetEndpoint || entry?.center || {
      x: entry?.centerX ?? entry?.x,
      y: entry?.centerY ?? entry?.y
    });
  }
  if ((entry?.questionTargetPoint || entry?.questionActionRegion) && !explicitQuestionPoint) {
    warnings.push(`${warningLabel}: questionActionRegion/questionTargetPoint kh\xF4ng h\u1EE3p l\u1EC7.`);
  }
  if (directPoint && questionScene && !pointInListeningRegion(directPoint, questionScene)) {
    warnings.push(`${warningLabel}: questionTargetPoint n\u1EB1m ngo\xE0i questionScene.`);
    directPoint = void 0;
  }
  if (requirePositionEvidence && (!questionSubjectRegion || !directPoint || !pointNearListeningRegion(directPoint, questionSubjectRegion, 0.08))) {
    warnings.push(`${warningLabel}: \u0111i\u1EC3m \u0111\xEDch kh\xF4ng \u0111\u01B0\u1EE3c x\xE1c minh n\u1EB1m tr\xEAn ho\u1EB7c s\xE1t action landmark c\u1EE7a primary subject trong \u1EA3nh \u0111\u1EC1; gi\u1EEF unresolved.`);
    return void 0;
  }
  const canUseIndependentQuestionLocation = Boolean(
    requirePositionEvidence && directPoint && questionSubjectRegion && cleanText(entry?.visualDescription || entry?.visualLabel, 200) && clamp(entry?.questionLocationConfidence, 0) >= 0.85
  );
  let positionEndpoint = normalizedPoint(entry?.positionKeyEndpoint);
  if (!positionEndpoint && entry?.coordinateRole === "position_key") {
    positionEndpoint = normalizedPoint(entry?.targetEndpoint || entry?.center);
  }
  const rawLineEndpoints = list(entry?.lineEndpoints);
  if (rawLineEndpoints.length) {
    const endpoints = rawLineEndpoints.map(normalizedPoint).filter(Boolean);
    if (endpoints.length !== 2) {
      if (!directPoint || requirePositionEvidence) warnings.push(`${warningLabel}: lineEndpoints ph\u1EA3i c\xF3 \u0111\xFAng hai \u0111i\u1EC3m h\u1EE3p l\u1EC7.`);
    } else if (!positionScene) {
      if (!directPoint || requirePositionEvidence) warnings.push(`${warningLabel}: thi\u1EBFu positionScene n\xEAn ch\u01B0a th\u1EC3 x\xE1c \u0111\u1ECBnh \u0111\u1EA7u ph\xEDa h\xECnh t\u1EEB hai \u0111\u1EA7u \u0111\u01B0\u1EDDng n\u1ED1i.`);
    } else {
      const insideScene = endpoints.filter((point) => pointInListeningRegion(point, positionScene));
      if (insideScene.length === 1) positionEndpoint = insideScene[0];
      else if (!directPoint || requirePositionEvidence) warnings.push(`${warningLabel}: kh\xF4ng ph\xE2n bi\u1EC7t duy nh\u1EA5t \u0111\u1EA7u ph\xEDa t\xEAn v\xE0 \u0111\u1EA7u ph\xEDa h\xECnh b\u1EB1ng positionScene.`);
    }
  }
  let transformedPoint;
  if (positionEndpoint) {
    if (!questionScene) {
      if (!directPoint || requirePositionEvidence) warnings.push(`${warningLabel}: thi\u1EBFu questionScene \u0111\u1EC3 quy \u0111\u1ED5i endpoint t\u1EEB \u1EA3nh \u0111\xE1p \xE1n v\u1ECB tr\xED.`);
    } else if (!positionScene) {
      if (!directPoint || requirePositionEvidence) warnings.push(`${warningLabel}: thi\u1EBFu positionScene \u0111\u1EC3 quy \u0111\u1ED5i endpoint t\u1EEB \u1EA3nh \u0111\xE1p \xE1n v\u1ECB tr\xED.`);
    } else {
      transformedPoint = transformListeningPoint(positionEndpoint, positionScene, questionScene) || void 0;
      if (!transformedPoint) warnings.push(`${warningLabel}: endpoint ph\xEDa h\xECnh n\u1EB1m ngo\xE0i positionScene ho\u1EB7c scene transform kh\xF4ng h\u1EE3p l\u1EC7.`);
    }
  }
  if (directPoint && transformedPoint && part1PointDistance(directPoint, transformedPoint) > 0.12) {
    if (canUseIndependentQuestionLocation) {
      warnings.push(`${warningLabel}: line/scene evidence m\xE2u thu\u1EABn; d\xF9ng localization \u0111\u1ED9c l\u1EADp confidence cao tr\xEAn \u1EA3nh \u0111\u1EC1 v\xE0 y\xEAu c\u1EA7u gi\xE1o vi\xEAn review.`);
      return directPoint;
    }
    warnings.push(`${warningLabel}: v\u1ECB tr\xED tr\u1EF1c ti\u1EBFp tr\xEAn \u1EA3nh \u0111\u1EC1 m\xE2u thu\u1EABn v\u1EDBi scene transform; gi\u1EEF unresolved.`);
    return void 0;
  }
  if (requirePositionEvidence && transformedPoint && questionSubjectRegion && !pointNearListeningRegion(transformedPoint, questionSubjectRegion, 0.08)) {
    if (canUseIndependentQuestionLocation) {
      warnings.push(`${warningLabel}: endpoint quy \u0111\u1ED5i l\u1EC7ch primary subject; d\xF9ng localization \u0111\u1ED9c l\u1EADp confidence cao tr\xEAn \u1EA3nh \u0111\u1EC1 v\xE0 y\xEAu c\u1EA7u gi\xE1o vi\xEAn review.`);
      return directPoint;
    }
    warnings.push(`${warningLabel}: endpoint quy \u0111\u1ED5i kh\xF4ng n\u1EB1m tr\xEAn primary subject trong \u1EA3nh \u0111\u1EC1; gi\u1EEF unresolved.`);
    return void 0;
  }
  if (requirePositionEvidence && directPoint && !transformedPoint) {
    if (canUseIndependentQuestionLocation) {
      warnings.push(`${warningLabel}: ch\u01B0a trace ch\u1EAFc endpoint; d\xF9ng localization \u0111\u1ED9c l\u1EADp confidence cao tr\xEAn \u1EA3nh \u0111\u1EC1 v\xE0 y\xEAu c\u1EA7u gi\xE1o vi\xEAn review.`);
      return directPoint;
    }
    warnings.push(`${warningLabel}: ch\u01B0a c\xF3 endpoint/scene transform \u0111\u1EC3 x\xE1c minh v\u1ECB tr\xED tr\u1EF1c ti\u1EBFp tr\xEAn \u1EA3nh \u0111\u1EC1; gi\u1EEF unresolved.`);
    return void 0;
  }
  if (directPoint) return directPoint;
  if (transformedPoint) return transformedPoint;
  if (!positionEndpoint && !rawLineEndpoints.length) {
    warnings.push(`${warningLabel}: AI kh\xF4ng tr\u1EA3 questionTargetPoint ho\u1EB7c endpoint \u0111\u01B0\u1EDDng n\u1ED1i ph\xEDa h\xECnh.`);
  }
  return void 0;
}
function normalizePart1(raw, warnings) {
  const exampleLabel = cleanText(raw?.example?.label || raw?.exampleLabel, 120);
  const allNames = list(raw?.printedNames || raw?.choices || raw?.detectedNames || raw?.names).map((value) => cleanText(value?.label ?? value?.name ?? value, 120)).filter(Boolean);
  const seenNames = /* @__PURE__ */ new Set();
  const choices = allNames.filter((name) => {
    const key = comparable(name);
    if (exampleLabel && key === comparable(exampleLabel) || seenNames.has(key)) return false;
    seenNames.add(key);
    return true;
  }).slice(0, 6);
  if (!exampleLabel) warnings.push("Part 1: ch\u01B0a x\xE1c \u0111\u1ECBnh ch\u1EAFc t\xEAn example.");
  if (choices.length !== 6) warnings.push(`Part 1: sau khi t\xE1ch example nh\u1EADn ${choices.length}/6 choices; kh\xF4ng t\u1EF1 \xE9p \u0111\u1EE7 b\u1EB1ng d\u1EEF li\u1EC7u gi\u1EA3.`);
  const questionScene = normalizedRegion(raw?.questionScene);
  const positionScene = normalizedRegion(raw?.positionScene);
  const mappings = list(raw?.answerMappings);
  const rawTargets = list(raw?.resolvedTargets || raw?.targets || raw?.questionTargets || raw?.anchors);
  const explicitlyUnresolved = new Set(list(raw?.unresolvedTargetNumbers).flatMap((value) => {
    const number2 = questionNumber(value);
    return number2 ? [number2] : [];
  }));
  explicitlyUnresolved.forEach((number2) => warnings.push(`Part 1 target ${number2}: AI \u0111\xE1nh d\u1EA5u unresolved \u1EDF l\u01B0\u1EE3t geometry; gi\u1EEF v\xF9ng draft c\u0169.`));
  const byNumber = /* @__PURE__ */ new Map();
  rawTargets.forEach((target, index) => {
    const number2 = questionNumber(target?.targetNumber) || (!raw?.geometryPassAttempted && index < 5 ? index + 1 : void 0);
    if (number2 && !byNumber.has(number2)) byNumber.set(number2, target);
    else if (!number2) warnings.push("Part 1 geometry: b\u1ECF qua target kh\xF4ng c\xF3 targetNumber h\u1EE3p l\u1EC7; kh\xF4ng d\u1ED3n OCR index.");
  });
  const anchors = [];
  const targetChoiceLabels = Array.from({ length: 5 });
  for (let number2 = 1; number2 <= 5; number2 += 1) {
    const target = byNumber.get(number2);
    const visualLabel = cleanText(target?.visualDescription || target?.visualLabel || target?.label || `V\xF9ng ${number2}`, 200);
    const mapping = mappings.find((entry) => questionNumber(entry?.targetNumber) === number2 || target && visualLabel && comparable(entry?.visualDescription || entry?.visualLabel) === comparable(visualLabel));
    const choiceLabel = cleanText(mapping?.printedName || mapping?.choiceLabel || mapping?.answer || target?.printedName || target?.choiceLabel || target?.answer, 120);
    const matchingChoices = choices.filter((choice2) => comparable(choice2) === comparable(choiceLabel));
    if (choiceLabel && matchingChoices.length !== 1) {
      warnings.push(`Part 1 target ${number2}: printedName "${choiceLabel}" kh\xF4ng kh\u1EDBp duy nh\u1EA5t m\u1ED9t trong s\xE1u choices; gi\u1EEF \u0111\xE1p \xE1n draft.`);
    }
    targetChoiceLabels[number2 - 1] = matchingChoices.length === 1 ? matchingChoices[0] : void 0;
    if (!target) continue;
    if (target?.coordinateRole && target.coordinateRole !== "question" && target.coordinateRole !== "position_key") {
      warnings.push(`Part 1 target ${number2}: coordinateRole kh\xF4ng \u0111\u01B0\u1EE3c h\u1ED7 tr\u1EE3.`);
      continue;
    }
    const requirePositionEvidence = Boolean(raw?.geometryPassAttempted) && raw?.geometryMode !== "direct-question-points";
    const point = resolvePart1TargetPoint(target, questionScene, positionScene, warnings, `Part 1 target ${number2}`, requirePositionEvidence);
    if (!point) {
      continue;
    }
    anchors.push({ targetNumber: number2, label: visualLabel, region: fixedRegionFromPoint(point), confidence: clamp(target?.confidence, 0.5) });
  }
  if (anchors.length !== 5) warnings.push(`Part 1: ch\u1EC9 resolve \u0111\u01B0\u1EE3c ${anchors.length}/5 target endpoints.`);
  if (targetChoiceLabels.filter(Boolean).length !== 5) warnings.push("Part 1: answer key ch\u01B0a resolve \u0111\u1EE7 n\u0103m mapping; gi\u1EEF \u0111\xE1p \xE1n draft \u1EDF m\u1EE5c unresolved.");
  let example;
  if (exampleLabel && raw?.example) {
    const point = resolvePart1TargetPoint(raw.example, questionScene, positionScene, warnings, "Part 1 example", false);
    if (point) example = { label: exampleLabel, region: fixedRegionFromPoint(point) };
  }
  return { part: 1, choices, anchors, targetChoiceLabels, ...example ? { example } : {} };
}
function answerVariants(entry) {
  const source = list(entry?.answerVariants).length ? list(entry.answerVariants) : [entry?.correctAnswer ?? entry?.answer];
  const seen = /* @__PURE__ */ new Set();
  return source.flatMap((value) => cleanText(value, 300).split("|")).map((value) => value.trim()).filter((value) => {
    const key = comparable(value);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 8);
}
function normalizePart2(raw, warnings) {
  const questionMap = normalizeNumberedEntries(list(raw?.questions), (entry) => {
    const prompt = cleanText(entry?.prompt || entry?.question, 1e3).replace(/_{2,}/g, "{{blank}}");
    return prompt ? prompt : void 0;
  }, warnings, "Part 2 prompts");
  const answerMap = normalizeNumberedEntries(list(raw?.answers).length ? list(raw.answers) : list(raw?.questions), (entry) => {
    const answers = answerVariants(entry);
    return answers.length ? answers : void 0;
  }, warnings, "Part 2 answer key", true);
  const numbers = /* @__PURE__ */ new Set([...questionMap.keys(), ...answerMap.keys()]);
  const questions = [...numbers].sort().flatMap((number2) => {
    const valid = questionNumber(number2);
    if (!valid) return [];
    return [{ questionNumber: valid, prompt: questionMap.get(number2), acceptedAnswers: answerMap.get(number2) }];
  });
  if (questionMap.size !== 5) warnings.push(`Part 2: nh\u1EADn ${questionMap.size}/5 prompt \u0111\xE1nh s\u1ED1.`);
  if (answerMap.size !== 5) warnings.push(`Part 2: nh\u1EADn ${answerMap.size}/5 answer mappings; m\u1EE5c thi\u1EBFu gi\u1EEF d\u1EEF li\u1EC7u c\u0169.`);
  const illustrationCrop = normalizeCrop(raw?.illustrationCrop);
  return {
    part: 2,
    heading: cleanText(raw?.heading, 200) || void 0,
    instruction: cleanText(raw?.instruction, 500) || void 0,
    exampleText: cleanText(raw?.exampleText || raw?.example, 500) || void 0,
    ...illustrationCrop ? { illustrationCrop } : {},
    questions
  };
}
function normalizePart3(raw, currentPart, warnings) {
  const current = currentPart.part === 3 && currentPart.displayMode === "connect-image" ? currentPart : void 0;
  const rawAnswers = list(raw?.questionAnswers || raw?.answers || raw?.answerLabels).slice(0, 7);
  const extractedAnswers = rawAnswers.flatMap((entry, index) => {
    const label = cleanText(entry?.label ?? entry, 160);
    const extractedRegion = normalizedRegion(entry?.region || entry);
    const region = extractedRegion || current?.answers[index]?.region;
    if (!label) return [];
    if (!extractedRegion && region) warnings.push(`Part 3 answer "${label}": gi\u1EEF region draft v\xEC AI kh\xF4ng tr\u1EA3 geometry h\u1EE3p l\u1EC7.`);
    if (!region) return [];
    return [{ label, region, leftAnchorOffset: clamp(entry?.leftAnchorOffset ?? entry?.leftAnchor?.offset, 0.5), rightAnchorOffset: clamp(entry?.rightAnchorOffset ?? entry?.rightAnchor?.offset, 0.5), source: extractedRegion ? "ai" : "mixed" }];
  });
  const answers = [...extractedAnswers];
  (current?.answers || []).forEach((answer) => {
    if (answers.length < 7 && !answers.some((item) => comparable(item.label) === comparable(answer.label))) {
      answers.push({ label: answer.label, region: answer.region, leftAnchorOffset: answer.leftAnchorOffset, rightAnchorOffset: answer.rightAnchorOffset, source: "current-part" });
    }
  });
  if (extractedAnswers.length !== 7 && current?.answers.length) warnings.push(`Part 3: AI nh\u1EADn ${extractedAnswers.length}/7 answer; c\xE1c slot thi\u1EBFu gi\u1EEF d\u1EEF li\u1EC7u draft \u0111\u1EC3 review.`);
  const rawPictures = list(raw?.questionPictures || raw?.pictures || raw?.pictureRegions).slice(0, 6);
  const extractedPictures = rawPictures.flatMap((entry) => {
    const sideValue = cleanText(entry?.side || entry?.pictureSide, 20).toLowerCase();
    const side = sideValue === "left" || sideValue === "right" ? sideValue : void 0;
    const row = integer(entry?.row);
    const old = side && row ? current?.pictures.find((item) => item.side === side && item.row === row) : void 0;
    const extractedRegion = normalizedRegion(entry?.region || entry);
    const region = extractedRegion || old?.region;
    if (!side || !row || row < 1 || row > 3 || !region) return [];
    if (!extractedRegion && old) warnings.push(`Part 3 picture ${side}-${row}: gi\u1EEF region draft v\xEC AI kh\xF4ng tr\u1EA3 geometry h\u1EE3p l\u1EC7.`);
    return [{ label: cleanText(entry?.label || `${side}-${row}`, 160), side, row, region, anchorOffset: clamp(entry?.anchorOffset ?? entry?.anchor?.offset, 0.5), source: extractedRegion ? "ai" : "mixed" }];
  });
  const pictures = [...extractedPictures];
  (current?.pictures || []).forEach((picture) => {
    if (!pictures.some((item) => item.side === picture.side && item.row === picture.row)) {
      pictures.push({ label: picture.label, side: picture.side, row: picture.row, region: picture.region, anchorOffset: picture.anchorOffset, source: "current-part" });
    }
  });
  if (extractedPictures.length !== 6 && current?.pictures.length) warnings.push(`Part 3: AI nh\u1EADn ${extractedPictures.length}/6 picture; c\xE1c slot thi\u1EBFu gi\u1EEF d\u1EEF li\u1EC7u draft \u0111\u1EC3 review.`);
  const rawExample = raw?.questionExample || raw?.example;
  const exampleSide = rawExample?.pictureSide === "left" || rawExample?.pictureSide === "right" ? rawExample.pictureSide : void 0;
  const exampleRow = integer(rawExample?.pictureRow ?? rawExample?.row);
  const exampleLabel = cleanText(rawExample?.answerLabel || rawExample?.label, 160);
  const exampleAnswerRegion = answers.find((answer) => comparable(answer.label) === comparable(exampleLabel))?.region;
  const examplePictureRegion = pictures.find((picture) => picture.side === exampleSide && picture.row === exampleRow)?.region;
  const exampleConfidence = Number(rawExample?.confidence);
  const hasVerifiedPrintedLine = rawExample?.resolved === true && rawExample?.lineEvidence === "printed-line" && exampleAnswerRegion && examplePictureRegion && Number.isFinite(exampleConfidence) && exampleConfidence >= 0.55;
  const detectedExample = exampleLabel && exampleSide && exampleRow && exampleRow >= 1 && exampleRow <= 3 && hasVerifiedPrintedLine ? { answerLabel: exampleLabel, pictureSide: exampleSide, pictureRow: exampleRow, renderOverlayLine: Boolean(rawExample?.renderOverlayLine), source: "ai" } : void 0;
  const currentExampleAnswer = current?.answers.find((answer) => answer.id === current.exampleConnection.answerId);
  const currentExamplePicture = current?.pictures.find((picture) => picture.id === current.exampleConnection.pictureId);
  const example = detectedExample || (currentExampleAnswer && currentExamplePicture ? {
    answerLabel: currentExampleAnswer.label,
    pictureSide: currentExamplePicture.side,
    pictureRow: currentExamplePicture.row,
    renderOverlayLine: current.exampleConnection.renderOverlayLine,
    source: "current-part"
  } : void 0);
  const cells = list(raw?.answerKeyCells || raw?.connections).flatMap((entry) => {
    const sideValue = cleanText(entry?.side || entry?.pictureSide, 20).toLowerCase();
    const side = sideValue === "left" || sideValue === "right" ? sideValue : void 0;
    const row = integer(entry?.row);
    const answerLabel = cleanText(entry?.answerLabel || entry?.label || entry?.answer, 160);
    if (!side || !row || row < 1 || row > 3 || !answerLabel) return [];
    return [{ answerLabel, pictureSide: side, pictureRow: row, source: "ai" }];
  });
  let detectedConnections = [];
  if (example) {
    const isExampleLabel = (connection) => comparable(connection.answerLabel) === comparable(example.answerLabel);
    const isExampleSlot = (connection) => connection.pictureSide === example.pictureSide && connection.pictureRow === example.pictureRow;
    const exactExampleCell = cells.find((connection) => isExampleLabel(connection) && isExampleSlot(connection));
    if (exactExampleCell) {
      detectedConnections = cells.filter((connection) => connection !== exactExampleCell).slice(0, 5);
    } else {
      const exampleLabelCell = cells.find(isExampleLabel);
      const exampleSlotCell = cells.find(isExampleSlot);
      if (exampleLabelCell && exampleSlotCell && exampleLabelCell !== exampleSlotCell) {
        detectedConnections = [
          ...cells.filter((connection) => connection !== exampleLabelCell && connection !== exampleSlotCell),
          { ...exampleLabelCell, answerLabel: exampleSlotCell.answerLabel }
        ].slice(0, 5);
        warnings.push(`Part 3: answer key ho\xE1n \u0111\u1ED5i cell example; \u01B0u ti\xEAn printed line tr\xEAn \u1EA3nh \u0111\u1EC1 v\xE0 h\xF2a gi\u1EA3i mapping m\u1ED9t-m\u1ED9t \u0111\u1EC3 gi\xE1o vi\xEAn ki\u1EC3m tra.`);
      } else {
        detectedConnections = cells.filter((connection) => !isExampleLabel(connection) && !isExampleSlot(connection)).slice(0, 5);
        if (exampleLabelCell || exampleSlotCell) {
          warnings.push("Part 3: answer key m\xE2u thu\u1EABn example nh\u01B0ng kh\xF4ng \u0111\u1EE7 b\u1EB1ng ch\u1EE9ng \u0111\u1EC3 h\xF2a gi\u1EA3i; gi\u1EEF mapping draft cho m\u1EE5c unresolved.");
        }
      }
    }
  }
  const connections = [...detectedConnections];
  (current?.correctConnections || []).forEach((connection) => {
    const answer = current.answers.find((item) => item.id === connection.answerId);
    const picture = current.pictures.find((item) => item.id === connection.pictureId);
    if (answer && picture && connections.length < 5 && !connections.some((item) => comparable(item.answerLabel) === comparable(answer.label) || item.pictureSide === picture.side && item.pictureRow === picture.row)) {
      connections.push({ answerLabel: answer.label, pictureSide: picture.side, pictureRow: picture.row, source: "current-part" });
    }
  });
  const used = /* @__PURE__ */ new Set([...example ? [comparable(example.answerLabel)] : [], ...connections.map((connection) => comparable(connection.answerLabel))]);
  const distractors = answers.filter((answer) => !used.has(comparable(answer.label)));
  const currentDistractor = current?.answers.find((answer) => answer.id === current.distractorAnswerId)?.label;
  const distractorLabel = distractors.length === 1 ? distractors[0].label : currentDistractor;
  const distractorSource = distractors.length === 1 ? "derived" : currentDistractor ? "current-part" : void 0;
  if (answers.length !== 7) warnings.push(`Part 3: candidate ch\u1EC9 c\xF3 ${answers.length}/7 answer slots.`);
  if (pictures.length !== 6 || new Set(pictures.map((picture) => `${picture.side}-${picture.row}`)).size !== 6) warnings.push("Part 3: c\u1EA7n \u0111\xFAng ba picture b\xEAn tr\xE1i v\xE0 ba b\xEAn ph\u1EA3i theo row 1-3.");
  if (!detectedExample) warnings.push("Part 3: AI ch\u01B0a ch\u1EE9ng minh \u0111\u01B0\u1EE3c example b\u1EB1ng printed line tr\xEAn \u1EA3nh \u0111\u1EC1; gi\u1EEF example draft n\u1EBFu c\xF3.");
  if (detectedConnections.length !== 5) warnings.push(`Part 3: AI resolve \u0111\u01B0\u1EE3c ${detectedConnections.length}/5 scored connections; c\xE1c mapping thi\u1EBFu gi\u1EEF draft, kh\xF4ng d\u1ED3n OCR order.`);
  if (distractors.length !== 1) warnings.push("Part 3: distractor AI kh\xF4ng x\xE1c \u0111\u1ECBnh duy nh\u1EA5t b\u1EB1ng set difference; gi\u1EEF draft n\u1EBFu c\xF3.");
  return { part: 3, answers: answers.slice(0, 7), pictures: pictures.slice(0, 6), ...example ? { example } : {}, connections, distractorLabel, ...distractorSource ? { distractorSource } : {} };
}
function optionIndex(value) {
  const normalized = cleanText(value, 10).toUpperCase();
  return normalized === "A" ? 0 : normalized === "B" ? 1 : normalized === "C" ? 2 : void 0;
}
function normalizePart4(raw, warnings) {
  const questionMap = normalizeNumberedEntries(list(raw?.questions), (entry) => {
    const prompt = cleanText(entry?.prompt || entry?.question, 1e3);
    const crops = list(entry?.crops).slice(0, 3).map(normalizeCrop).filter(Boolean);
    return prompt ? { prompt, crops } : void 0;
  }, warnings, "Part 4 prompts");
  const rawAnswers = list(raw?.answers);
  const hasAnyNumber = rawAnswers.some((entry) => Boolean(questionNumber(entry?.questionNumber ?? entry?.number)));
  const orderedEvidence = raw?.orderedFallbackEvidence === "single-row" || raw?.orderedFallbackEvidence === "single-column";
  const answerMap = normalizeNumberedEntries(rawAnswers, (entry) => optionIndex(entry?.answer ?? entry), warnings, "Part 4 answer key", !hasAnyNumber && orderedEvidence);
  if (!hasAnyNumber && rawAnswers.length === 5 && !orderedEvidence) warnings.push("Part 4: n\u0103m \u0111\xE1p \xE1n kh\xF4ng s\u1ED1 thi\u1EBFu evidence m\u1ED9t h\xE0ng/c\u1ED9t n\xEAn kh\xF4ng d\xF9ng ordered fallback.");
  const questions = [1, 2, 3, 4, 5].flatMap((number2) => {
    const question = questionMap.get(number2);
    if (!question) return [];
    const answer = answerMap.get(number2);
    return [{ questionNumber: number2, ...question, ...answer === void 0 ? {} : { correctOptionIndex: answer }, answerSource: answer === void 0 ? "current-part" : hasAnyNumber ? "answer-key-numbered" : "answer-key-ordered-fallback" }];
  });
  const rawExample = raw?.example;
  const exampleCrops = list(rawExample?.crops).slice(0, 3).map(normalizeCrop).filter(Boolean);
  const examplePrompt = cleanText(rawExample?.prompt || rawExample?.question, 1e3);
  const exampleAnswer = optionIndex(rawExample?.answer ?? rawExample?.correctOption);
  const example = examplePrompt ? { prompt: examplePrompt, crops: exampleCrops, ...exampleAnswer === void 0 ? {} : { correctOptionIndex: exampleAnswer } } : void 0;
  if (!example) warnings.push("Part 4: ch\u01B0a t\xE1ch \u0111\u01B0\u1EE3c example kh\u1ECFi n\u0103m c\xE2u scored.");
  if (questions.length !== 5) warnings.push(`Part 4: nh\u1EADn ${questions.length}/5 c\xE2u \u0111\xE1nh s\u1ED1.`);
  if (answerMap.size !== 5) warnings.push(`Part 4: nh\u1EADn ${answerMap.size}/5 answer mappings; c\xE2u thi\u1EBFu gi\u1EEF \u0111\xE1p \xE1n draft.`);
  return { part: 4, ...example ? { example } : {}, questions };
}
function catalogColourLabel(value) {
  const key = comparable(value);
  return MOVER_COLOUR_CATALOG.find((colour) => comparable(colour.label) === key)?.label;
}
function explicitDrawActionFromPrompt(staffPrompt) {
  const drawMatch = staffPrompt.match(/^\s*draw\s+(.+?)\s*[.!?]*$/i);
  if (!drawMatch) return void 0;
  let body = drawMatch[1].replace(/^(?:a|an|the)\s+/i, "").trim();
  const relationMatch = body.match(/\s+((?:on|onto|in|inside|under|below|above|over|between|beside|by|near|next to|behind|in front of|at)\b.*)$/i);
  const relationLabel = relationMatch?.[1]?.trim();
  if (relationMatch?.index !== void 0) body = body.slice(0, relationMatch.index).trim();
  const words = body.split(/\s+/).filter(Boolean);
  const colourLabel = catalogColourLabel(words[0]);
  const objectType = cleanText(colourLabel ? words.slice(1).join(" ") : body, 120);
  if (!objectType) return void 0;
  return {
    type: "place_object",
    objectType,
    ...colourLabel ? { colourLabel } : {},
    ...relationLabel ? { relationLabel } : {},
    confidence: 0.5
  };
}
function normalizePart5(raw, currentPart, warnings) {
  const seenPaletteItems = /* @__PURE__ */ new Set();
  const paletteItems = list(raw?.paletteItems).flatMap((entry) => {
    const objectType = cleanText(entry?.objectType, 120);
    const label = cleanText(entry?.label || entry?.objectType, 160);
    if (!objectType || !label) return [];
    const rawColour = cleanText(entry?.color || entry?.colour, 80);
    const colourLabel = rawColour ? catalogColourLabel(rawColour) : void 0;
    if (rawColour && !colourLabel) warnings.push(`Part 5 palette "${label}": m\xE0u ngo\xE0i catalog n\xEAn \u0111\u1EC3 unresolved.`);
    const key = `${comparable(objectType)}|${comparable(label)}|${comparable(colourLabel)}`;
    if (seenPaletteItems.has(key)) return [];
    seenPaletteItems.add(key);
    return [{ objectType, label, ...colourLabel ? { colourLabel } : {} }];
  });
  const questionMap = normalizeNumberedEntries(list(raw?.questions), (entry) => {
    const staffPrompt = cleanText(entry?.prompt || entry?.staffPrompt, 1e3);
    const actions = list(entry?.actions).slice(0, 10).flatMap((action) => {
      const confidence = clamp(action?.confidence, 0.5);
      if (action?.type === "colour_object") {
        const objectLabel = cleanText(action?.objectLabel, 160);
        const rawColour = cleanText(action?.correctColor || action?.color, 80);
        const correctColourLabel = catalogColourLabel(rawColour);
        if (rawColour && !correctColourLabel) warnings.push(`Part 5 "${objectLabel}": m\xE0u "${rawColour}" ngo\xE0i catalog.`);
        return objectLabel ? [{ type: "colour_object", objectLabel, ...correctColourLabel ? { correctColourLabel } : {}, confidence }] : [];
      }
      if (action?.type === "place_object") {
        const objectType = cleanText(action?.objectType, 120);
        const rawColour = cleanText(action?.color || action?.correctColor, 80);
        const colourLabel = rawColour ? catalogColourLabel(rawColour) : void 0;
        if (rawColour && !colourLabel) warnings.push(`Part 5 object "${objectType}": m\xE0u "${rawColour}" ngo\xE0i catalog.`);
        const normalizedTarget = normalizedRegion(action?.targetRegion);
        const targetRegion = normalizedTarget ? {
          shape: "rect",
          x: normalizedTarget.x,
          y: normalizedTarget.y,
          width: normalizedTarget.width,
          height: normalizedTarget.height
        } : void 0;
        return objectType ? [{ type: "place_object", objectType, ...colourLabel ? { colourLabel } : {}, ...targetRegion ? { targetRegion } : {}, relationLabel: cleanText(action?.relationLabel, 240) || void 0, confidence }] : [];
      }
      return [];
    });
    const recoveredDraw = staffPrompt && !actions.some((action) => action.type === "place_object") ? explicitDrawActionFromPrompt(staffPrompt) : void 0;
    if (recoveredDraw) {
      actions.push(recoveredDraw);
      warnings.push("Part 5: ph\u1EE5c h\u1ED3i action Draw t\u1EEB c\xE2u l\u1EC7nh r\xF5 r\xE0ng trong answer key; gi\xE1o vi\xEAn c\u1EA7n ch\u1ECDn/x\xE1c nh\u1EADn v\xF9ng ch\u1EEF nh\u1EADt.");
    }
    return staffPrompt ? { staffPrompt, actions } : void 0;
  }, warnings, "Part 5 questions");
  const questions = [1, 2, 3, 4, 5].flatMap((number2) => {
    const value = questionMap.get(number2);
    return value ? [{ questionNumber: number2, ...value }] : [];
  });
  if (questions.length !== 5) warnings.push(`Part 5: nh\u1EADn ${questions.length}/5 c\xE2u \u0111\xE1nh s\u1ED1.`);
  questions.forEach((question) => {
    if (!question.actions.length) warnings.push(`Part 5 c\xE2u ${question.questionNumber}: ch\u01B0a resolve \u0111\u01B0\u1EE3c action n\xE0o.`);
    question.actions.forEach((action, index) => {
      if (action.type === "colour_object" && !action.correctColourLabel) warnings.push(`Part 5 c\xE2u ${question.questionNumber} action ${index + 1}: thi\u1EBFu m\xE0u ch\u1EAFc ch\u1EAFn.`);
      if (action.type === "place_object" && !action.targetRegion) warnings.push(`Part 5 c\xE2u ${question.questionNumber} action ${index + 1}: Sol ch\u01B0a x\xE1c \u0111\u1ECBnh ch\u1EAFc v\u1ECB tr\xED Draw tr\xEAn \u1EA3nh \u0111\u1EC1.`);
    });
  });
  const placeActions = questions.flatMap((question) => question.actions).filter((action) => action.type === "place_object");
  const colourActions = questions.flatMap((question) => question.actions).filter((action) => action.type === "colour_object");
  placeActions.forEach((action) => {
    if (paletteItems.some((item) => comparable(item.objectType) === comparable(action.objectType) && (!action.colourLabel || comparable(item.colourLabel) === comparable(action.colourLabel)))) return;
    paletteItems.push({
      objectType: action.objectType,
      label: [action.colourLabel, action.objectType].filter(Boolean).join(" "),
      ...action.colourLabel ? { colourLabel: action.colourLabel } : {}
    });
  });
  if (colourActions.length) warnings.push("Part 5: gi\xE1o vi\xEAn ph\u1EA3i t\xF4/x\xE1c nh\u1EADn c\xE1c v\xF9ng Colour; AI kh\xF4ng t\u1EF1 t\u1EA1o mask Colour.");
  const paletteTypes = new Set(paletteItems.map((item) => comparable(item.objectType)));
  if (placeActions.some((action) => !paletteTypes.has(comparable(action.objectType)))) warnings.push("Part 5: palette thi\u1EBFu token \u0111\xFAng cho \xEDt nh\u1EA5t m\u1ED9t place action; gi\xE1o vi\xEAn ph\u1EA3i b\u1ED5 sung.");
  if (placeActions.length && paletteItems.length <= new Set(placeActions.map((action) => comparable(action.objectType))).size) warnings.push("Part 5: object palette ch\u01B0a c\xF3 distractor; kh\xF4ng t\u1EF1 t\u1EA1o object gi\u1EA3.");
  if (currentPart.part === 5 && currentPart.displayMode === "scene-colour-draw") {
    currentPart.questions.forEach((question) => question.actions.forEach((action) => {
      const matched = questions.some((nextQuestion) => nextQuestion.questionNumber === question.questionNumber && nextQuestion.actions.some((next) => {
        if (next.type !== action.type) return false;
        if (next.type === "colour_object" && action.type === "colour_object") {
          const object = currentPart.interactiveObjects.find((item) => item.id === action.correctObjectId);
          return comparable(next.objectLabel) === comparable(object?.label);
        }
        if (next.type === "place_object" && action.type === "place_object") {
          const item = currentPart.objectPalette.find((entry) => entry.id === action.correctPaletteItemId);
          return comparable(next.objectType) === comparable(item?.objectType);
        }
        return false;
      }));
      if (!matched) warnings.push(`Part 5 c\xE2u ${question.questionNumber}: gi\u1EEF action c\u0169 ${action.id} v\xEC l\u1EA7n ph\xE2n t\xEDch m\u1EDBi kh\xF4ng match ch\u1EAFc ch\u1EAFn.`);
    }));
  }
  return { part: 5, paletteItems, questions };
}
function normalizeData(part, raw, currentPart, warnings) {
  if (part === 1) return normalizePart1(raw, warnings);
  if (part === 2) return normalizePart2(raw, warnings);
  if (part === 3) return normalizePart3(raw, currentPart, warnings);
  if (part === 4) return normalizePart4(raw, warnings);
  return normalizePart5(raw, currentPart, warnings);
}
function localFallback(part, text4) {
  const rows = localNumberedLines(text4);
  if (part === 2) return { questions: [], answers: rows.map((row) => ({ questionNumber: row.questionNumber, answer: row.value })) };
  if (part === 3) {
    const lines = text4.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const explicit = lines.flatMap((line) => {
      const match = line.match(/^(left|right)\s*([1-3])\s*[:=\-]\s*(.+)$/i);
      return match ? [{ side: match[1].toLowerCase(), row: Number(match[2]), answerLabel: match[3].trim() }] : [];
    });
    if (explicit.length === lines.length && explicit.length > 0) return { answerKeyCells: explicit };
    const rowPairs = lines.map((line) => line.split(/\t|\s{2,}|\s*\|\s*/).map((value) => value.trim()).filter(Boolean));
    if (rowPairs.length === 3 && rowPairs.every((row) => row.length === 2)) {
      return {
        answerKeyCells: rowPairs.flatMap((row, index) => [
          { side: "left", row: index + 1, answerLabel: row[0] },
          { side: "right", row: index + 1, answerLabel: row[1] }
        ])
      };
    }
    return { answerKeyCells: [], warnings: ["Part 3 fallback text c\u1EA7n ba d\xF2ng hai c\u1ED9t, ho\u1EB7c c\xFA ph\xE1p left/right + row; kh\xF4ng suy lu\u1EADn t\u1EEB s\xE1u d\xF2ng ph\u1EB3ng."] };
  }
  return {};
}
async function createListeningSmartImportCandidate(input) {
  const warnings = [];
  let provider = "local";
  const selectedProvider = input.preferredProvider || DEFAULT_SMART_IMPORT_AI_PROVIDER_ID;
  let raw;
  if (input.images.length && input.analyzeVision) {
    const requestId = `limport-analysis-${import_node_crypto3.default.randomUUID()}`;
    const usedProviders = /* @__PURE__ */ new Set();
    const analyzeAndParse = async (prompt, images, schema, schemaName, validateResponse) => {
      let parsed;
      let lastParseError = "";
      for (let attempt = 1; attempt <= 2; attempt += 1) {
        const retryInstruction = attempt === 1 ? "" : `
Your previous response was not valid for the required JSON schema and extraction invariants${lastParseError ? `: ${lastParseError}` : ""}. Re-check the source images and re-emit the facts using the supplied schema. Do not add markdown or prose and do not guess missing values; use explicit unresolved fields where supported.`;
        let result;
        try {
          result = await input.analyzeVision(prompt + retryInstruction, images, {
            preferredProvider: selectedProvider,
            responseJsonSchema: schema,
            schemaName,
            requestId,
            attempt
          }, input.signal);
          if (process.env.LISTENING_SMART_IMPORT_DEBUG_RAW === "true" && process.env.NODE_ENV !== "production") {
            console.warn(`[ListeningSmartImport] request=${requestId} schema=${schemaName} attempt=${attempt} raw=${result.text.slice(0, 2e4)}`);
          }
        } catch (reason) {
          const details = providerFailureDetails(reason);
          lastParseError = details.join(" | ");
          console.warn(`[ListeningSmartImport] request=${requestId} part=${input.part} schema=${schemaName} attempt=${attempt} provider-error: ${lastParseError}`);
          if (input.signal?.aborted || reason?.name === "AbortError" || attempt === 2) {
            throw providerFailureError(reason, input.part, schemaName, input.signal);
          }
          continue;
        }
        try {
          parsed = parseJson3(result.text);
          const validationError = validateResponse?.(parsed, attempt);
          if (validationError) throw new Error(validationError);
          provider = result.provider;
          usedProviders.add(result.provider);
          if (result.errors?.length) warnings.push(...result.errors.map((value) => cleanText(value, 240)));
          if (attempt > 1) warnings.push(`Part ${input.part}: ${provider} \u0111\xE3 tr\u1EA3 JSON h\u1EE3p l\u1EC7 sau l\u1EA7n retry ${schemaName}.`);
          break;
        } catch (reason) {
          const returnedProvider = cleanText(result.provider, 60) || "AI";
          lastParseError = cleanText(reason?.message || "JSON kh\xF4ng h\u1EE3p l\u1EC7.", 240);
          const digest = import_node_crypto3.default.createHash("sha256").update(result.text).digest("hex").slice(0, 16);
          console.warn(`[ListeningSmartImport] request=${requestId} part=${input.part} schema=${schemaName} provider=${returnedProvider} attempt=${attempt} invalid-response length=${result.text.length} sha256=${digest}: ${lastParseError}`);
          if (attempt === 2) {
            const invalidJsonError = new Error(`Nh\xE0 cung c\u1EA5p AI tr\u1EA3 d\u1EEF li\u1EC7u kh\xF4ng h\u1EE3p l\u1EC7 cho Part ${input.part}. Draft ch\u01B0a \u0111\u01B0\u1EE3c thay \u0111\u1ED5i.`);
            invalidJsonError.status = 502;
            invalidJsonError.code = "LISTENING_SMART_IMPORT_INVALID_JSON";
            invalidJsonError.details = [`${returnedProvider}: ${lastParseError}`];
            throw invalidJsonError;
          }
        }
      }
      return parsed;
    };
    if (input.part === 1) {
      const useSolDirectGeometry = PART1_SOL_PROVIDER_IDS.has(selectedProvider);
      const contentImages = input.images.filter((image) => image.role === "question" || image.role === "answer_key");
      const questionImages = input.images.filter((image) => image.role === "question");
      const geometryImages = useSolDirectGeometry ? ["question", "answer_key", "position_key"].flatMap((role) => input.images.filter((image) => image.role === role)) : input.images.filter((image) => image.role === "question" || image.role === "answer_key" || image.role === "position_key");
      const contentRaw = await analyzeAndParse(
        promptForPart1Pass("content"),
        contentImages,
        part1PassSchema("content"),
        "listening_mover_part_1_content",
        validatePart1ContentResponse
      );
      const questionRaw = await analyzeAndParse(
        useSolDirectGeometry ? promptForPart1SolExampleVerification(contentRaw) : promptForPart1QuestionVerification(contentRaw),
        questionImages,
        useSolDirectGeometry ? part1SolExampleVerificationSchema() : part1QuestionVerificationSchema(),
        "listening_mover_part_1_question_verification",
        (parsed) => useSolDirectGeometry ? validatePart1SolExampleVerification(parsed, contentRaw) : validatePart1QuestionVerification(parsed, contentRaw)
      );
      const verifiedExample = verifiedPart1QuestionExample(questionRaw, contentRaw);
      const verifiedTargets = new Map(list(useSolDirectGeometry ? [] : questionRaw?.targets).flatMap((entry) => {
        const number2 = questionNumber(entry?.targetNumber);
        return number2 ? [[number2, entry]] : [];
      }));
      const verifiedContentRaw = {
        ...contentRaw,
        example: verifiedExample ? { label: verifiedExample.label, labelPoint: questionRaw?.labelPoint, targetPoint: verifiedExample.targetPoint, confidence: verifiedExample.confidence } : contentRaw?.example,
        answerMappings: list(contentRaw?.answerMappings).map((entry) => {
          const number2 = questionNumber(entry?.targetNumber);
          return { ...entry, ...number2 ? verifiedTargets.get(number2) : {} };
        })
      };
      let geometryRaw = { resolvedTargets: [], unresolvedTargetNumbers: [1, 2, 3, 4, 5], warnings: [] };
      try {
        geometryRaw = await analyzeAndParse(
          useSolDirectGeometry ? promptForPart1SolGeometry(verifiedContentRaw) : promptForPart1Pass("geometry", verifiedContentRaw),
          geometryImages,
          useSolDirectGeometry ? part1SolGeometrySchema() : part1PassSchema("geometry"),
          "listening_mover_part_1_geometry",
          (parsed, attempt) => useSolDirectGeometry ? validatePart1SolGeometryResponse(parsed, verifiedContentRaw) : validatePart1GeometryResponse(parsed, verifiedContentRaw, attempt === 1)
        );
      } catch (reason) {
        if (input.signal?.aborted || reason?.name === "AbortError" || reason?.code === "LISTENING_SMART_IMPORT_TIMEOUT") throw reason;
        const details = providerFailureDetails(reason).join(" | ");
        warnings.push(`Part 1 geometry: AI kh\xF4ng ho\xE0n t\u1EA5t l\u01B0\u1EE3t x\xE1c \u0111\u1ECBnh v\u1ECB tr\xED; v\u1EABn nh\u1EADp t\xEAn/\u0111\xE1p \xE1n v\xE0 gi\u1EEF nguy\xEAn c\xE1c v\xF9ng c\u0169.${details ? ` ${details}` : ""}`);
      }
      if (verifiedExample && comparable(verifiedExample.label) !== comparable(contentRaw?.example?.label)) {
        warnings.push(`Part 1: example \u0111\u01B0\u1EE3c l\u01B0\u1EE3t ki\u1EC3m ch\u1EE9ng \u0111\u1ED9c l\u1EADp s\u1EEDa t\u1EEB "${cleanText(contentRaw?.example?.label, 120)}" th\xE0nh "${verifiedExample.label}".`);
      }
      const contentExample = verifiedExample;
      const questionScene = normalizedRegion(verifiedContentRaw?.questionScene);
      const positionScene = normalizedRegion(geometryRaw?.positionScene);
      const localizedMappings = new Map(list(verifiedContentRaw?.answerMappings).flatMap((entry) => {
        const number2 = questionNumber(entry?.targetNumber);
        return number2 ? [[number2, entry]] : [];
      }));
      const geometryTargets = new Map(list(geometryRaw?.resolvedTargets).flatMap((entry) => {
        const number2 = questionNumber(entry?.targetNumber);
        return number2 ? [[number2, entry]] : [];
      }));
      const resolvedTargets = [...localizedMappings].flatMap(([number2, mapping]) => {
        const geometry = geometryTargets.get(number2);
        if (useSolDirectGeometry) {
          const questionTargetPoint = normalizedPoint(geometry?.questionTargetPoint);
          if (!geometry || !questionTargetPoint || !questionScene || !pointInListeningRegion(questionTargetPoint, questionScene)) return [];
          return [{
            ...mapping,
            ...geometry,
            coordinateRole: "question",
            questionActionRegion: void 0,
            questionTargetPoint,
            targetNumber: number2
          }];
        }
        if (!geometry && !hasSafePart1QuestionLocation(mapping, questionScene)) return [];
        const verifiedGeometryPoint = geometry && part1TransformedGeometryPoint(geometry, mapping, questionScene, positionScene);
        const verifiedQuestionPoint = part1QuestionActionPoint(mapping);
        return [{
          ...mapping,
          questionLocationConfidence: mapping?.confidence,
          ...geometry,
          questionActionRegion: mapping.questionActionRegion,
          questionTargetPoint: verifiedQuestionPoint || verifiedGeometryPoint,
          targetNumber: number2
        }];
      });
      const unresolvedFromGeometry = new Set(list(geometryRaw?.unresolvedTargetNumbers).flatMap((value) => {
        const number2 = questionNumber(value);
        return number2 ? [number2] : [];
      }));
      const unresolvedTargetNumbers = [1, 2, 3, 4, 5].filter((number2) => {
        if (useSolDirectGeometry) {
          return !geometryTargets.has(number2) || unresolvedFromGeometry.has(number2);
        }
        const mapping = localizedMappings.get(number2);
        return (!geometryTargets.has(number2) || unresolvedFromGeometry.has(number2)) && !hasSafePart1QuestionLocation(mapping, questionScene);
      });
      const exampleTargetPoint = normalizedPoint(contentExample?.targetPoint);
      raw = {
        ...verifiedContentRaw,
        questionScene: verifiedContentRaw?.questionScene,
        positionScene: geometryRaw?.positionScene,
        resolvedTargets,
        unresolvedTargetNumbers,
        geometryPassAttempted: true,
        ...useSolDirectGeometry ? { geometryMode: "direct-question-points" } : {},
        example: contentExample && exampleTargetPoint ? { label: cleanText(contentExample?.label, 120), questionTargetPoint: exampleTargetPoint, confidence: clamp(contentExample?.confidence, 0.9) } : void 0,
        warnings: [...list(contentRaw?.warnings), ...list(questionRaw?.warnings), ...list(geometryRaw?.warnings)]
      };
    } else if (input.part === 3) {
      const questionImages = input.images.filter((image) => image.role === "question");
      const answerKeyImages = input.images.filter((image) => image.role === "answer_key");
      const questionRaw = await analyzeAndParse(
        promptForPart3QuestionPass(),
        questionImages,
        part3PassSchema("question"),
        "listening_mover_part_3_question_example",
        validatePart3QuestionResponse
      );
      let answerKeyRaw;
      if (answerKeyImages.length) {
        answerKeyRaw = await analyzeAndParse(
          promptForPart3AnswerKeyPass(questionRaw),
          answerKeyImages,
          part3PassSchema("answer_key"),
          "listening_mover_part_3_answer_key",
          (parsed) => validatePart3AnswerKeyResponse(parsed, questionRaw)
        );
      } else if (input.pastedText) {
        answerKeyRaw = localFallback(3, input.pastedText);
        const validationError = validatePart3AnswerKeyResponse({ layoutEvidence: "three-rows-two-columns", ...answerKeyRaw }, questionRaw);
        if (validationError) {
          const invalidFallbackError = new Error(`V\u0103n b\u1EA3n answer key Part 3 kh\xF4ng kh\u1EDBp example \u0111\xE3 x\xE1c minh: ${validationError}`);
          invalidFallbackError.status = 422;
          invalidFallbackError.code = "LISTENING_SMART_IMPORT_INVALID_PART3_FALLBACK";
          throw invalidFallbackError;
        }
        answerKeyRaw = { layoutEvidence: "three-rows-two-columns", ...answerKeyRaw };
      } else {
        const missingKeyError = new Error("Part 3 c\u1EA7n \u1EA2nh \u0111\xE1p \xE1n ho\u1EB7c fallback v\u0103n b\u1EA3n ba h\xE0ng hai c\u1ED9t.");
        missingKeyError.status = 400;
        throw missingKeyError;
      }
      raw = {
        ...questionRaw,
        ...answerKeyRaw,
        warnings: [...list(questionRaw?.warnings), ...list(answerKeyRaw?.warnings)]
      };
    } else if (input.part === 5) {
      const contentImages = ["question", "answer_key", "position_key"].flatMap((role) => input.images.filter((image) => image.role === role));
      raw = await analyzeAndParse(
        promptForPart5Content(),
        contentImages,
        responseSchemaFor(5),
        "listening_mover_part_5_content",
        validatePart5ContentResponse
      );
    } else {
      raw = await analyzeAndParse(
        promptFor(input.part, input.pastedText),
        input.images,
        responseSchemaFor(input.part),
        `listening_mover_part_${input.part}`
      );
    }
    if (usedProviders.size > 1) provider = [...usedProviders].join("+");
  } else if (input.pastedText && (input.part === 2 || input.part === 3)) {
    raw = localFallback(input.part, input.pastedText);
    warnings.push(`Part ${input.part}: \u0111ang d\xF9ng fallback v\u0103n b\u1EA3n th\u1EE7 c\xF4ng thay cho \u1EA3nh answer key.`);
  } else if (input.images.length && !input.analyzeVision) {
    const error = new Error("Backend ch\u01B0a c\u1EA5u h\xECnh AI th\u1ECB gi\xE1c \u0111\u1EC3 \u0111\u1ECDc \u1EA3nh.");
    error.status = 503;
    throw error;
  } else {
    const error = new Error("C\u1EA7n \u0111\u1EE7 \u1EA3nh ngu\u1ED3n theo role ho\u1EB7c fallback v\u0103n b\u1EA3n \u0111\u01B0\u1EE3c h\u1ED7 tr\u1EE3.");
    error.status = 400;
    throw error;
  }
  warnings.push(...list(raw?.warnings).map((value) => cleanText(value, 500)).filter(Boolean));
  const data = normalizeData(input.part, raw, input.currentPart, warnings);
  return {
    id: `limport-${import_node_crypto3.default.randomUUID()}`,
    moduleId: "mover",
    part: input.part,
    basePartHash: input.basePartHash,
    sources: input.sources,
    sourceImageAssetIds: input.sources.map((source) => source.assetId),
    provider,
    warnings,
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    data
  };
}

// src/features/listening-editor/smart-import/types.ts
function getListeningSmartImportRoleDefinitions(part) {
  if (part === 1) return [
    { role: "question", label: "\u1EA2nh \u0111\u1EC1 b\xE0i", required: true },
    { role: "answer_key", label: "\u1EA2nh \u0111\xE1p \xE1n", required: true },
    { role: "position_key", label: "\u1EA2nh \u0111\xE1p \xE1n + v\u1ECB tr\xED", required: true }
  ];
  if (part === 5) return [
    { role: "question", label: "\u1EA2nh \u0111\u1EC1 b\xE0i", required: true },
    { role: "answer_key", label: "\u1EA2nh \u0111\xE1p \xE1n", required: true },
    { role: "position_key", label: "\u1EA2nh \u0111\xE1p \xE1n + v\u1ECB tr\xED", required: true }
  ];
  return [
    { role: "question", label: "\u1EA2nh \u0111\u1EC1 b\xE0i", required: true },
    { role: "answer_key", label: "\u1EA2nh \u0111\xE1p \xE1n", required: true }
  ];
}

// src/server/listening-pdf-import/manifest.ts
var import_node_crypto4 = __toESM(require("node:crypto"), 1);
var manifestSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    tests: {
      type: "array",
      minItems: 1,
      maxItems: 20,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          testNumber: { type: "integer", minimum: 1, maximum: 100 },
          title: { type: "string", maxLength: 160 },
          part1Pages: { type: "array", items: { type: "integer", minimum: 1 }, minItems: 1, maxItems: 1 },
          part2Pages: { type: "array", items: { type: "integer", minimum: 1 }, minItems: 1, maxItems: 1 },
          part3Pages: { type: "array", items: { type: "integer", minimum: 1 }, minItems: 1, maxItems: 1 },
          part4Pages: { type: "array", items: { type: "integer", minimum: 1 }, minItems: 2, maxItems: 2 },
          part5Pages: { type: "array", items: { type: "integer", minimum: 1 }, minItems: 1, maxItems: 1 },
          keySummaryPage: { type: "integer", minimum: 1 }
        },
        required: [
          "testNumber",
          "title",
          "part1Pages",
          "part2Pages",
          "part3Pages",
          "part4Pages",
          "part5Pages",
          "keySummaryPage"
        ]
      }
    },
    warnings: { type: "array", items: { type: "string", maxLength: 500 }, maxItems: 30 }
  },
  required: ["tests", "warnings"]
};
var manifestPrompt = (bookPageCount, keyPageCount) => `
You are mapping a scanned Cambridge Movers listening book to its answer booklet.

The images labelled IMAGE ROLE: question are BOOK header-index sheets. The images labelled
IMAGE ROLE: answer_key are ANSWER-BOOKLET header-index sheets. Every cell visibly includes
its one-based PDF page number. The book has ${bookPageCount} PDF pages and the key has
${keyPageCount} PDF pages.

Return each complete Movers Listening Test that is visibly supported. For every test:
- Part 1, Part 2, Part 3 and Part 5 each use exactly one book PDF page.
- Part 4 uses exactly two consecutive book PDF pages; its continuation page may omit the Part 4 title.
- keySummaryPage is the FIRST answer-booklet PDF page headed "Test N Answers" that contains
  the compact Listening answers/annotated diagrams. Do not include transcript continuation,
  Reading and Writing, Speaking, or vocabulary-list pages.
- Use PDF page labels printed in the contact-sheet cells, never the book's printed footer page.
- Do not infer a missing test or page. If the visible evidence is ambiguous, omit that test and add a warning.
- Keep tests ordered by testNumber and pages in reading order.

Return JSON only using the supplied schema.`.trim();
function parseJson4(text4) {
  const trimmed = text4.trim();
  if (!trimmed) throw new Error("AI kh\xF4ng tr\u1EA3 v\u1EC1 d\u1EEF li\u1EC7u manifest.");
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const object = fenced?.[1] || trimmed.match(/(\{[\s\S]*\})/)?.[1];
    if (!object) throw new Error("AI kh\xF4ng tr\u1EA3 v\u1EC1 JSON manifest h\u1EE3p l\u1EC7.");
    return JSON.parse(object.trim());
  }
}
var pageTuple = (value, length, maximum, label) => {
  const pages = Array.isArray(value) ? value.map(Number) : [];
  if (pages.length !== length || pages.some((page) => !Number.isInteger(page) || page < 1 || page > maximum) || new Set(pages).size !== pages.length) throw new Error(`${label} kh\xF4ng c\xF3 \u0111\xFAng ${length} trang PDF h\u1EE3p l\u1EC7.`);
  return pages;
};
function normalizeListeningPdfManifest(raw, bookPageCount, keyPageCount) {
  if (!Number.isInteger(bookPageCount) || bookPageCount < 1 || bookPageCount > 1e3) {
    throw new Error("S\u1ED1 trang PDF \u0111\u1EC1 b\xE0i kh\xF4ng h\u1EE3p l\u1EC7.");
  }
  if (!Number.isInteger(keyPageCount) || keyPageCount < 1 || keyPageCount > 1e3) {
    throw new Error("S\u1ED1 trang PDF \u0111\xE1p \xE1n kh\xF4ng h\u1EE3p l\u1EC7.");
  }
  const rows = Array.isArray(raw?.tests) ? raw.tests : [];
  if (!rows.length || rows.length > 20) throw new Error("Kh\xF4ng t\xECm th\u1EA5y Test Listening ho\xE0n ch\u1EC9nh.");
  const seenTests = /* @__PURE__ */ new Set();
  const tests = rows.map((row, index) => {
    const testNumber = Number(row?.testNumber);
    if (!Number.isInteger(testNumber) || testNumber < 1 || testNumber > 100 || seenTests.has(testNumber)) {
      throw new Error(`Test t\u1EA1i v\u1ECB tr\xED ${index + 1} c\xF3 s\u1ED1 th\u1EE9 t\u1EF1 thi\u1EBFu ho\u1EB7c b\u1ECB tr\xF9ng.`);
    }
    seenTests.add(testNumber);
    const bookPages = {
      1: pageTuple(row?.part1Pages, 1, bookPageCount, `Test ${testNumber} Part 1`),
      2: pageTuple(row?.part2Pages, 1, bookPageCount, `Test ${testNumber} Part 2`),
      3: pageTuple(row?.part3Pages, 1, bookPageCount, `Test ${testNumber} Part 3`),
      4: pageTuple(row?.part4Pages, 2, bookPageCount, `Test ${testNumber} Part 4`),
      5: pageTuple(row?.part5Pages, 1, bookPageCount, `Test ${testNumber} Part 5`)
    };
    const orderedBookPages = [
      ...bookPages[1],
      ...bookPages[2],
      ...bookPages[3],
      ...bookPages[4],
      ...bookPages[5]
    ];
    if (bookPages[4][1] !== bookPages[4][0] + 1) {
      throw new Error(`Test ${testNumber} Part 4 ph\u1EA3i g\u1ED3m hai trang li\xEAn ti\u1EBFp.`);
    }
    if (orderedBookPages.some((page, pageIndex) => pageIndex > 0 && page <= orderedBookPages[pageIndex - 1])) {
      throw new Error(`Test ${testNumber} c\xF3 th\u1EE9 t\u1EF1 trang Part kh\xF4ng h\u1EE3p l\u1EC7.`);
    }
    const keySummaryPage = Number(row?.keySummaryPage);
    if (!Number.isInteger(keySummaryPage) || keySummaryPage < 1 || keySummaryPage > keyPageCount) {
      throw new Error(`Test ${testNumber} c\xF3 trang t\u1ED5ng h\u1EE3p \u0111\xE1p \xE1n kh\xF4ng h\u1EE3p l\u1EC7.`);
    }
    return {
      testNumber,
      title: String(row?.title || `Test ${testNumber}`).normalize("NFKC").trim().slice(0, 160) || `Test ${testNumber}`,
      bookPages,
      keySummaryPage
    };
  }).sort((left, right) => left.testNumber - right.testNumber);
  const usedBookPages = /* @__PURE__ */ new Set();
  let previousBookPage = 0;
  tests.forEach((test) => {
    const pages = [
      ...test.bookPages[1],
      ...test.bookPages[2],
      ...test.bookPages[3],
      ...test.bookPages[4],
      ...test.bookPages[5]
    ];
    if (pages[0] <= previousBookPage || pages.some((page) => usedBookPages.has(page))) {
      throw new Error(`C\xE1c trang \u0111\u1EC1 b\xE0i c\u1EE7a Test ${test.testNumber} b\u1ECB tr\xF9ng ho\u1EB7c sai th\u1EE9 t\u1EF1.`);
    }
    pages.forEach((page) => usedBookPages.add(page));
    previousBookPage = pages[pages.length - 1];
  });
  if (tests.some((test, index) => index > 0 && test.keySummaryPage <= tests[index - 1].keySummaryPage)) {
    throw new Error("Th\u1EE9 t\u1EF1 trang t\u1ED5ng h\u1EE3p \u0111\xE1p \xE1n gi\u1EEFa c\xE1c Test kh\xF4ng h\u1EE3p l\u1EC7.");
  }
  return {
    schemaVersion: 1,
    moduleId: "mover",
    bookPageCount,
    keyPageCount,
    tests,
    warnings: (Array.isArray(raw?.warnings) ? raw.warnings : []).map((value) => String(value ?? "").normalize("NFKC").trim().slice(0, 500)).filter(Boolean).slice(0, 30)
  };
}
async function createListeningPdfManifest(input) {
  if (!input.analyzeVision) {
    const error = new Error("C\u1EA7n c\u1EA5u h\xECnh AI th\u1ECB gi\xE1c \u0111\u1EC3 nh\u1EADn di\u1EC7n c\u1EA5u tr\xFAc PDF.");
    error.status = 503;
    throw error;
  }
  const requestId = `lpdf-manifest-${import_node_crypto4.default.randomUUID()}`;
  let lastError = "";
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const retryInstruction = attempt === 1 ? "" : `
The previous manifest was invalid: ${lastError}. Re-read the visible PDF page labels and return a corrected manifest without guessing.`;
      const result = await input.analyzeVision(
        manifestPrompt(input.bookPageCount, input.keyPageCount) + retryInstruction,
        input.images,
        {
          preferredProvider: input.preferredProvider,
          responseJsonSchema: manifestSchema,
          schemaName: "listening_pdf_manifest_v1",
          requestId,
          attempt
        },
        input.signal
      );
      return normalizeListeningPdfManifest(parseJson4(result.text), input.bookPageCount, input.keyPageCount);
    } catch (reason) {
      if (input.signal?.aborted || reason?.name === "AbortError") throw reason;
      lastError = String(reason?.message || reason || "Manifest kh\xF4ng h\u1EE3p l\u1EC7.").slice(0, 300);
      if (attempt === 2) {
        const error = new Error("Kh\xF4ng th\u1EC3 nh\u1EADn di\u1EC7n c\u1EA5u tr\xFAc Listening trong hai PDF. Ch\u01B0a t\u1EA1o b\u1EA3n nh\xE1p.");
        error.status = Number(reason?.status) === 503 ? 503 : 422;
        error.code = "LISTENING_PDF_MANIFEST_INVALID";
        const providerDetails = Array.isArray(reason?.details) ? reason.details.map((value) => String(value ?? "").trim().slice(0, 300)).filter(Boolean) : [];
        error.details = [.../* @__PURE__ */ new Set([...providerDetails, lastError])];
        throw error;
      }
    }
  }
  throw new Error("Kh\xF4ng th\u1EC3 t\u1EA1o manifest PDF.");
}

// src/server/listening-pdf-import/transientSources.ts
var import_node_crypto5 = __toESM(require("node:crypto"), 1);
var import_node_fs3 = __toESM(require("node:fs"), 1);
var import_node_path5 = __toESM(require("node:path"), 1);
var SUPPORTED_MIME_TYPES = /* @__PURE__ */ new Set(["image/jpeg", "image/png", "image/webp"]);
var EXTENSIONS = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp"
};
var safeEqual = (left, right) => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && import_node_crypto5.default.timingSafeEqual(leftBuffer, rightBuffer);
};
var sourcePath = (directory, payload) => {
  const extension = EXTENSIONS[payload.mimeType];
  if (!extension || !/^[0-9a-f-]{36}$/i.test(payload.sourceId)) throw new Error("Ngu\u1ED3n PDF t\u1EA1m kh\xF4ng h\u1EE3p l\u1EC7.");
  const root = import_node_path5.default.resolve(directory);
  const filePath = import_node_path5.default.resolve(directory, `${payload.sourceId}${extension}`);
  if (!filePath.startsWith(`${root}${import_node_path5.default.sep}`)) throw new Error("\u0110\u01B0\u1EDDng d\u1EABn ngu\u1ED3n PDF t\u1EA1m kh\xF4ng h\u1EE3p l\u1EC7.");
  return filePath;
};
function createListeningPdfTransientSourceStore(options) {
  const ttlMs = Math.min(30 * 60 * 1e3, Math.max(60 * 1e3, options.ttlMs || 10 * 60 * 1e3));
  import_node_fs3.default.mkdirSync(options.directory, { recursive: true });
  const sign = (encoded) => import_node_crypto5.default.createHmac("sha256", options.secret).update(`listening-pdf-source:${encoded}`).digest("base64url");
  const decode = (token, ownerId) => {
    const [encoded, signature, extra] = String(token || "").split(".");
    if (!encoded || !signature || extra || !safeEqual(signature, sign(encoded))) {
      throw new Error("Phi\u1EBFu ngu\u1ED3n PDF t\u1EA1m kh\xF4ng h\u1EE3p l\u1EC7.");
    }
    let payload;
    try {
      payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    } catch {
      throw new Error("Phi\u1EBFu ngu\u1ED3n PDF t\u1EA1m kh\xF4ng h\u1EE3p l\u1EC7.");
    }
    if (payload.version !== 1 || payload.ownerId !== ownerId || !SUPPORTED_MIME_TYPES.has(payload.mimeType) || !Number.isFinite(payload.expiresAt)) throw new Error("Phi\u1EBFu ngu\u1ED3n PDF t\u1EA1m kh\xF4ng h\u1EE3p l\u1EC7.");
    if (payload.expiresAt < Date.now()) throw new Error("Ngu\u1ED3n PDF t\u1EA1m \u0111\xE3 h\u1EBFt h\u1EA1n. Vui l\xF2ng th\u1EED l\u1EA1i.");
    return payload;
  };
  const removePayload = async (payload) => {
    const filePath = sourcePath(options.directory, payload);
    await import_node_fs3.default.promises.rm(filePath, { force: true });
  };
  return {
    async create(ownerId, mimeType, data) {
      if (!ownerId || !SUPPORTED_MIME_TYPES.has(mimeType) || !data.length) {
        throw new Error("Ngu\u1ED3n \u1EA3nh PDF t\u1EA1m kh\xF4ng h\u1EE3p l\u1EC7.");
      }
      const payload = {
        version: 1,
        sourceId: import_node_crypto5.default.randomUUID(),
        ownerId,
        mimeType,
        expiresAt: Date.now() + ttlMs
      };
      const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
      const filePath = sourcePath(options.directory, payload);
      await import_node_fs3.default.promises.writeFile(filePath, data, { flag: "wx" });
      const cleanupTimer = setTimeout(() => {
        void removePayload(payload);
      }, ttlMs + 1e3);
      cleanupTimer.unref?.();
      return { token: `${encoded}.${sign(encoded)}`, expiresAt: payload.expiresAt };
    },
    async resolve(token, ownerId) {
      const payload = decode(token, ownerId);
      const filePath = sourcePath(options.directory, payload);
      let data;
      try {
        data = await import_node_fs3.default.promises.readFile(filePath);
      } catch (reason) {
        if (reason?.code === "ENOENT") throw new Error("Ngu\u1ED3n PDF t\u1EA1m kh\xF4ng c\xF2n t\u1ED3n t\u1EA1i. Vui l\xF2ng t\u1EA3i l\u1EA1i.");
        throw reason;
      }
      return {
        sourceId: payload.sourceId,
        mimeType: payload.mimeType,
        data,
        remove: () => removePayload(payload)
      };
    }
  };
}

// src/server/listening/listeningRouter.ts
var IMAGE_MAX_BYTES = 10 * 1024 * 1024;
var AUDIO_MAX_BYTES = 50 * 1024 * 1024;
var PDF_IMPORT_SOURCE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
var SMART_IMPORT_TIMEOUT_MS = Math.min(
  18e4,
  Math.max(15e3, Number(process.env.LISTENING_SMART_IMPORT_TIMEOUT_MS) || 18e4)
);
var MIME_EXTENSIONS = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "audio/mpeg": ".mp3",
  "audio/wav": ".wav",
  "audio/x-wav": ".wav",
  "audio/ogg": ".ogg",
  "audio/mp4": ".m4a",
  "audio/x-m4a": ".m4a"
};
var text = (value, max = 500) => String(value ?? "").trim().slice(0, max);
var nowIso2 = () => (/* @__PURE__ */ new Date()).toISOString();
var identifier = (prefix) => `${prefix}-${import_crypto.default.randomUUID()}`;
var sha256 = (value) => import_crypto.default.createHash("sha256").update(value).digest("hex");
var timingSafeEqual = (first, second) => {
  const a = Buffer.from(first);
  const b = Buffer.from(second);
  return a.length === b.length && import_crypto.default.timingSafeEqual(a, b);
};
function apiError(status, message, details) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}
function sendError(res, error) {
  res.status(Number(error?.status || 500)).json({
    error: error?.message || "Kh\xF4ng th\u1EC3 x\u1EED l\xFD y\xEAu c\u1EA7u Listening.",
    ...error?.details ? { details: error.details } : {}
  });
}
function isSuperAdmin(user) {
  return user?.role === "super_admin";
}
function canManageSet(user, set) {
  return isSuperAdmin(user) || user?.role === "teacher" && set?.ownerId === user.id;
}
function publicSetSummary(set) {
  const {
    draftContent: _draftContent,
    draftRevision: _draftRevision,
    shareToken: _shareToken,
    assignmentSlug: _assignmentSlug,
    ...summary
  } = set || {};
  return withListeningModuleMetadata(summary);
}
function withListeningModuleMetadata(record) {
  return {
    ...record,
    moduleId: resolveListeningModuleId(record?.moduleId),
    schemaVersion: Number(record?.schemaVersion || LISTENING_LIBRARY_SCHEMA_VERSION),
    moduleSchemaVersion: Number(record?.moduleSchemaVersion || LISTENING_LIBRARY_SCHEMA_VERSION)
  };
}
function belongsToMoverModule(record) {
  return resolveListeningModuleId(record?.moduleId) === DEFAULT_LISTENING_MODULE_ID;
}
function withMoverContentMetadata(content) {
  return {
    ...content,
    moduleId: DEFAULT_LISTENING_MODULE_ID,
    schemaVersion: LISTENING_LIBRARY_SCHEMA_VERSION,
    parts: content.parts.map((part) => ({
      ...part,
      schemaVersion: part.schemaVersion || LISTENING_LIBRARY_SCHEMA_VERSION
    }))
  };
}
function encodeTicket(payload, secret) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = import_crypto.default.createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}
function decodeTicket(ticket, secret) {
  const [encoded, providedSignature, extra] = String(ticket || "").split(".");
  if (!encoded || !providedSignature || extra) throw apiError(401, "Phi\u1EBFu l\xE0m b\xE0i kh\xF4ng h\u1EE3p l\u1EC7.");
  const expected = import_crypto.default.createHmac("sha256", secret).update(encoded).digest("base64url");
  if (!timingSafeEqual(providedSignature, expected)) throw apiError(401, "Phi\u1EBFu l\xE0m b\xE0i kh\xF4ng h\u1EE3p l\u1EC7.");
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (Number(payload.ticketExpiresAt || 0) < Date.now()) {
      throw apiError(410, "Phi\u1EBFu l\xE0m b\xE0i \u0111\xE3 h\u1EBFt th\u1EDDi gian g\u1EEDi l\u1EA1i.");
    }
    return payload;
  } catch (error) {
    if (error?.status) throw error;
    throw apiError(401, "Phi\u1EBFu l\xE0m b\xE0i kh\xF4ng h\u1EE3p l\u1EC7.");
  }
}
function hasValidMagic(buffer, mimeType) {
  if (mimeType === "image/jpeg") return buffer.length >= 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255;
  if (mimeType === "image/png") return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mimeType === "image/gif") return ["GIF87a", "GIF89a"].includes(buffer.subarray(0, 6).toString("ascii"));
  if (mimeType === "image/webp") return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  if (mimeType === "audio/wav" || mimeType === "audio/x-wav") {
    return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WAVE";
  }
  if (mimeType === "audio/ogg") return buffer.subarray(0, 4).toString("ascii") === "OggS";
  if (mimeType === "audio/mp4" || mimeType === "audio/x-m4a") return buffer.subarray(4, 8).toString("ascii") === "ftyp";
  if (mimeType === "audio/mpeg") {
    return buffer.subarray(0, 3).toString("ascii") === "ID3" || buffer.length >= 2 && buffer[0] === 255 && (buffer[1] & 224) === 224;
  }
  return false;
}
function collectAssetReferences(content) {
  const references = [];
  const add = (id, kind, entityId, role) => {
    const assetId = text(id, 160);
    if (assetId) references.push({ id: assetId, kind, entityId, role });
  };
  add(content.coverAssetId, "image", "set", "cover");
  add(content.backgroundAssetId, "image", "set", "background");
  content.parts.forEach((part) => add(part.audioAssetId, "audio", `part-${part.part}`, "audio"));
  add(content.parts[0].sceneAssetId, "image", "part-1", "scene");
  add(content.parts[1].illustrationAssetId, "image", "part-2", "illustration");
  const part3 = content.parts[2];
  add(part3.boardAssetId, "image", "part-3", "board");
  if (part3.displayMode !== "connect-image") {
    part3.options.forEach((option) => add(option.imageAssetId, "image", option.id, "part3-option"));
    part3.items.forEach((item) => add(item.imageAssetId, "image", item.id, "part3-item"));
    if (part3.example) {
      add(part3.example.item.imageAssetId, "image", part3.example.item.id, "part3-example");
    }
  }
  content.parts[3].questions.forEach((question) => {
    question.options.forEach((option) => add(option.imageAssetId, "image", `${question.id}:${option.id}`, "part4-option"));
  });
  if (content.parts[3].example) {
    content.parts[3].example.options.forEach((option) => add(option.imageAssetId, "image", `example:${option.id}`, "part4-example"));
  }
  add(content.parts[4].sceneAssetId, "image", "part-5", "scene");
  const part5 = content.parts[4];
  if (part5.displayMode === "scene-colour-draw") {
    part5.objectPalette.forEach((item) => add(item.tokenAssetId, "image", item.id, "part5-token"));
  }
  return references;
}
async function resolveContentAssets(db, content, user) {
  const clone = structuredClone(content);
  const part3 = clone.parts[2];
  if (part3.displayMode !== "connect-image") {
    part3.options.forEach((option, index) => {
      option.label = String.fromCharCode(65 + index);
    });
  }
  const references = collectAssetReferences(clone);
  const assets = /* @__PURE__ */ new Map();
  await Promise.all([...new Set(references.map((reference) => reference.id))].map(async (assetId) => {
    const document = await db.collection("listening_assets").doc(assetId).get();
    if (!document.exists) throw apiError(400, `Kh\xF4ng t\xECm th\u1EA5y media "${assetId}".`);
    const asset = { id: document.id, ...document.data() };
    if (asset.status !== "active") throw apiError(400, `Media "${asset.name || asset.id}" \u0111\xE3 l\u01B0u tr\u1EEF.`);
    if (!isSuperAdmin(user) && asset.ownerId !== user.id) {
      throw apiError(403, `B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n d\xF9ng media "${asset.name || asset.id}".`);
    }
    assets.set(assetId, asset);
  }));
  for (const reference of references) {
    const asset = assets.get(reference.id);
    if (!asset || asset.kind !== reference.kind) {
      throw apiError(400, `Media "${reference.id}" kh\xF4ng \u0111\xFAng lo\u1EA1i ${reference.kind}.`);
    }
    if (reference.role === "part5-token" && asset.mimeType !== "image/png") {
      throw apiError(400, `Icon Draw "${asset.name || asset.id}" ph\u1EA3i l\xE0 file PNG.`);
    }
  }
  const url = (id) => id ? assets.get(id)?.url : void 0;
  clone.coverUrl = url(clone.coverAssetId);
  clone.backgroundUrl = url(clone.backgroundAssetId);
  clone.parts.forEach((part) => {
    part.audioUrl = url(part.audioAssetId);
  });
  clone.parts[0].sceneUrl = url(clone.parts[0].sceneAssetId);
  clone.parts[1].illustrationUrl = url(clone.parts[1].illustrationAssetId);
  clone.parts[2].boardUrl = url(clone.parts[2].boardAssetId);
  if (clone.parts[2].displayMode !== "connect-image") {
    clone.parts[2].options.forEach((option) => {
      option.imageUrl = url(option.imageAssetId);
    });
    clone.parts[2].items.forEach((item) => {
      item.imageUrl = url(item.imageAssetId);
    });
    if (clone.parts[2].example) {
      clone.parts[2].example.item.imageUrl = url(clone.parts[2].example.item.imageAssetId);
    }
  }
  clone.parts[3].questions.forEach((question) => {
    question.options.forEach((option) => {
      option.imageUrl = url(option.imageAssetId);
    });
  });
  if (clone.parts[3].example) {
    clone.parts[3].example.options.forEach((option) => {
      option.imageUrl = url(option.imageAssetId);
    });
  }
  clone.parts[4].sceneUrl = url(clone.parts[4].sceneAssetId);
  if (clone.parts[4].displayMode === "scene-colour-draw") {
    clone.parts[4].objectPalette.forEach((item) => {
      item.tokenUrl = url(item.tokenAssetId);
    });
  }
  return { content: clone, references };
}
async function getSet(db, id) {
  const document = await db.collection("listening_sets").doc(id).get();
  if (!document.exists) return null;
  const record = { id: document.id, ...document.data() };
  return belongsToMoverModule(record) ? withListeningModuleMetadata(record) : null;
}
async function getVersion(db, id) {
  const document = await db.collection("listening_set_versions").doc(id).get();
  if (!document.exists) return null;
  const record = { id: document.id, ...document.data() };
  return belongsToMoverModule(record) ? withListeningModuleMetadata(record) : null;
}
async function getAssignmentByToken(db, token) {
  if (!token) return null;
  const snapshot = await db.collection("assignments").where("shareToken", "==", token).get();
  let match = null;
  snapshot.forEach((document) => {
    const data = { id: document.id, ...document.data() };
    if (!match && (data.shareToken === token || data.assignmentSlug === token)) match = data;
  });
  return match;
}
async function resolveLearningAccess(db, set, req) {
  if (!set || set.status !== "published" || !set.publishedVersionId) {
    throw apiError(404, "B\u1ED9 \u0111\u1EC1 nghe ch\u01B0a \u0111\u01B0\u1EE3c xu\u1EA5t b\u1EA3n.");
  }
  if (req.user?.role === "super_admin" || canManageSet(req.user, set)) {
    return { assignment: null };
  }
  if (set.visibility === "public") return { assignment: null };
  const token = text(
    req.body?.shareToken || req.body?.accessToken || req.query?.shareToken || req.query?.accessToken || req.headers["x-listening-share-token"],
    240
  );
  if (token && set.shareToken && timingSafeEqual(token, String(set.shareToken))) {
    return { assignment: null };
  }
  const assignment = await getAssignmentByToken(db, token);
  const resourceType = assignment?.resourceType || "vocabulary";
  const resourceId = assignment?.resourceId || assignment?.vocabSetId;
  if (assignment && resourceType === "listening" && resourceId === set.id) {
    return { assignment };
  }
  throw apiError(403, "Link b\u1ED9 \u0111\u1EC1 nghe kh\xF4ng h\u1EE3p l\u1EC7 ho\u1EB7c \u0111\xE3 h\u1EBFt quy\u1EC1n truy c\u1EADp.");
}
async function resolveActor(req, resolveGuestProfile2, classInfo = {}) {
  if (req.authBlocked) throw apiError(403, "T\xE0i kho\u1EA3n \u0111\xE3 b\u1ECB kh\xF3a.");
  if (req.user) {
    return {
      ownerKey: `user:${req.user.id}`,
      userId: req.user.id,
      guestId: "",
      studentName: req.user.name || "H\u1ECDc sinh"
    };
  }
  const guestId = text(req.body?.guestId || req.query?.guestId || req.headers["x-guest-id"], 120);
  const studentName = text(req.body?.studentName || req.query?.studentName, 120);
  if (!guestId || !studentName) throw apiError(401, "Vui l\xF2ng nh\u1EADp t\xEAn h\u1ECDc sinh tr\u01B0\u1EDBc khi l\xE0m b\xE0i.");
  const profile = await resolveGuestProfile2(guestId, studentName, true, classInfo);
  return {
    ownerKey: `guest:${guestId}`,
    userId: "",
    guestId,
    studentName: profile.displayName || profile.name || studentName
  };
}
function playableSet(set, version) {
  const content = withMoverContentMetadata(sanitizeListeningContentForStudent(version.content));
  return {
    ...publicSetSummary(set),
    versionId: version.id,
    versionNumber: version.versionNumber,
    content
  };
}
function createListeningRouter(dependencies) {
  const {
    db,
    authenticateUser: authenticateUser2,
    authenticateOptionalUser: authenticateOptionalUser2,
    requireStaff,
    mediaDir,
    mediaPublicPrefix,
    ticketSecret,
    resolveGuestProfile: resolveGuestProfile2,
    logAudit,
    smartImport
  } = dependencies;
  const router = import_express2.default.Router();
  const draftLocks = /* @__PURE__ */ new Map();
  const smartImportUsage = /* @__PURE__ */ new Map();
  const pdfImportSources = createListeningPdfTransientSourceStore({
    directory: import_path3.default.join(mediaDir, ".tmp-pdf-import"),
    secret: ticketSecret
  });
  const withDraftLock = async (setId, operation) => {
    const previous = draftLocks.get(setId) || Promise.resolve();
    let release;
    const current = new Promise((resolve) => {
      release = resolve;
    });
    const queued = previous.then(() => current);
    draftLocks.set(setId, queued);
    await previous;
    try {
      return await operation();
    } finally {
      release();
      if (draftLocks.get(setId) === queued) draftLocks.delete(setId);
    }
  };
  import_fs3.default.mkdirSync(mediaDir, { recursive: true });
  router.get("/capabilities", authenticateUser2, requireStaff, (_req, res) => {
    res.json({
      imageGeneration: {
        enabled: false,
        reason: "Ch\u01B0a c\u1EA5u h\xECnh nh\xE0 cung c\u1EA5p t\u1EA1o \u1EA3nh \u1EDF backend. C\xF3 th\u1EC3 d\xF9ng t\u1EA3i l\xEAn ho\u1EB7c th\u01B0 vi\u1EC7n media."
      },
      smartImport: {
        enabled: smartImport?.enabled !== false,
        visionEnabled: Boolean(smartImport?.analyzeVision),
        providers: smartImport?.providers || [],
        reason: smartImport?.reason || (smartImport?.analyzeVision ? void 0 : "Ch\u01B0a c\u1EA5u h\xECnh nh\xE0 cung c\u1EA5p AI th\u1ECB gi\xE1c; v\u1EABn c\xF3 th\u1EC3 nh\u1EADp v\u0103n b\u1EA3n cho Part 2/3.")
      },
      upload: {
        enabled: true,
        imageMaxBytes: IMAGE_MAX_BYTES,
        audioMaxBytes: AUDIO_MAX_BYTES,
        mimeTypes: Object.keys(MIME_EXTENSIONS)
      }
    });
  });
  router.get("/admin/assets", authenticateUser2, requireStaff, async (req, res) => {
    try {
      const snapshot = isSuperAdmin(req.user) ? await db.collection("listening_assets").get() : await db.collection("listening_assets").where("ownerId", "==", req.user.id).get();
      const assets = [];
      snapshot.forEach((document) => {
        const asset = { id: document.id, ...document.data() };
        if (asset.status !== "archived") assets.push(asset);
      });
      assets.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      res.json(assets);
    } catch (error) {
      sendError(res, error);
    }
  });
  router.post(
    "/admin/assets",
    authenticateUser2,
    requireStaff,
    import_express2.default.raw({ type: Object.keys(MIME_EXTENSIONS), limit: AUDIO_MAX_BYTES }),
    async (req, res) => {
      let temporaryPath = "";
      try {
        if (!req.user) throw apiError(401, "Vui l\xF2ng \u0111\u0103ng nh\u1EADp.");
        const mimeType = text(req.headers["content-type"]?.split(";")[0], 100).toLowerCase();
        const extension = MIME_EXTENSIONS[mimeType];
        if (!extension) throw apiError(415, "\u0110\u1ECBnh d\u1EA1ng media kh\xF4ng \u0111\u01B0\u1EE3c h\u1ED7 tr\u1EE3.");
        const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
        const kind = mimeType.startsWith("image/") ? "image" : "audio";
        const sizeLimit = kind === "image" ? IMAGE_MAX_BYTES : AUDIO_MAX_BYTES;
        if (!buffer.length || buffer.length > sizeLimit) throw apiError(413, "File r\u1ED7ng ho\u1EB7c v\u01B0\u1EE3t gi\u1EDBi h\u1EA1n dung l\u01B0\u1EE3ng.");
        if (!hasValidMagic(buffer, mimeType)) throw apiError(415, "N\u1ED9i dung file kh\xF4ng kh\u1EDBp \u0111\u1ECBnh d\u1EA1ng khai b\xE1o.");
        const derivedFromAssetId = text(req.headers["x-derived-from-asset-id"], 160);
        let crop;
        if (derivedFromAssetId) {
          if (kind !== "image") throw apiError(400, "Ch\u1EC9 \u1EA3nh m\u1EDBi c\xF3 th\u1EC3 l\xE0 asset crop d\u1EABn xu\u1EA5t.");
          const sourceDocument = await db.collection("listening_assets").doc(derivedFromAssetId).get();
          if (!sourceDocument.exists) throw apiError(404, "Kh\xF4ng t\xECm th\u1EA5y \u1EA3nh ngu\u1ED3n c\u1EE7a asset crop.");
          const sourceAsset = { id: sourceDocument.id, ...sourceDocument.data() };
          if (!isSuperAdmin(req.user) && sourceAsset.ownerId !== req.user.id) {
            throw apiError(403, "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n t\u1EA1o crop t\u1EEB \u1EA3nh ngu\u1ED3n n\xE0y.");
          }
          if (sourceAsset.kind !== "image" || sourceAsset.status !== "active") {
            throw apiError(400, "Asset ngu\u1ED3n crop ph\u1EA3i l\xE0 \u1EA3nh \u0111ang ho\u1EA1t \u0111\u1ED9ng.");
          }
          try {
            const parsed = JSON.parse(text(req.headers["x-crop-metadata"], 500));
            crop = {
              x: Number(parsed.x),
              y: Number(parsed.y),
              width: Number(parsed.width),
              height: Number(parsed.height)
            };
          } catch {
            throw apiError(400, "Metadata crop kh\xF4ng h\u1EE3p l\u1EC7.");
          }
          if (!crop || Object.values(crop).some((value) => !Number.isFinite(value) || value < 0 || value > 1) || crop.width <= 0 || crop.height <= 0 || crop.x + crop.width > 1 || crop.y + crop.height > 1) {
            throw apiError(400, "T\u1ECDa \u0111\u1ED9 crop ph\u1EA3i n\u1EB1m trong kho\u1EA3ng 0\u20131.");
          }
        }
        const digest = sha256(buffer);
        const storageKey = `${digest}${extension}`;
        const finalPath = import_path3.default.join(mediaDir, storageKey);
        temporaryPath = import_path3.default.join(mediaDir, `.${digest}.${import_crypto.default.randomUUID()}.tmp`);
        import_fs3.default.writeFileSync(temporaryPath, buffer, { flag: "wx" });
        if (import_fs3.default.existsSync(finalPath)) import_fs3.default.unlinkSync(temporaryPath);
        else import_fs3.default.renameSync(temporaryPath, finalPath);
        temporaryPath = "";
        const existingSnapshot = await db.collection("listening_assets").where("storageKey", "==", storageKey).get();
        let existing = null;
        existingSnapshot.forEach((document) => {
          const data = { id: document.id, ...document.data() };
          const sameOwner = isSuperAdmin(req.user) || data.ownerId === req.user.id;
          const sameDerivative = derivedFromAssetId ? data.derivedFromAssetId === derivedFromAssetId && JSON.stringify(data.crop) === JSON.stringify(crop) : !data.derivedFromAssetId;
          if (!existing && sameOwner && sameDerivative) existing = data;
        });
        if (existing) return res.json(existing);
        const now = nowIso2();
        const asset = {
          id: identifier("lasset"),
          ownerId: req.user.id,
          kind,
          name: (() => {
            const rawName = text(req.headers["x-file-name"], 240);
            try {
              return decodeURIComponent(rawName) || storageKey;
            } catch {
              return rawName || storageKey;
            }
          })(),
          mimeType,
          size: buffer.length,
          storageKey,
          url: `${mediaPublicPrefix}/${storageKey}`,
          ...derivedFromAssetId && crop ? { derivedFromAssetId, crop } : {},
          status: "active",
          createdAt: now,
          updatedAt: now
        };
        await db.collection("listening_assets").doc(asset.id).set(asset);
        res.status(201).json(asset);
      } catch (error) {
        if (temporaryPath && import_fs3.default.existsSync(temporaryPath)) import_fs3.default.unlinkSync(temporaryPath);
        sendError(res, error);
      }
    }
  );
  router.delete("/admin/assets/:id", authenticateUser2, requireStaff, async (req, res) => {
    try {
      const document = await db.collection("listening_assets").doc(req.params.id).get();
      if (!document.exists) throw apiError(404, "Kh\xF4ng t\xECm th\u1EA5y media.");
      const asset = { id: document.id, ...document.data() };
      if (!isSuperAdmin(req.user) && asset.ownerId !== req.user.id) throw apiError(403, "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n l\u01B0u tr\u1EEF media n\xE0y.");
      const usage = await db.collection("listening_asset_usages").where("assetId", "==", asset.id).get();
      const readingUsage = await db.collection("mover_reading_asset_usages").where("assetId", "==", asset.id).get();
      if (!usage.empty || !readingUsage.empty) throw apiError(409, "Media \u0111ang \u0111\u01B0\u1EE3c m\u1ED9t phi\xEAn b\u1EA3n \u0111\xE3 xu\u1EA5t b\u1EA3n s\u1EED d\u1EE5ng.");
      await document.ref.update({ status: "archived", updatedAt: nowIso2() });
      res.json({ success: true });
    } catch (error) {
      sendError(res, error);
    }
  });
  router.post(
    "/admin/pdf-import/sources",
    authenticateUser2,
    requireStaff,
    import_express2.default.raw({ type: PDF_IMPORT_SOURCE_MIME_TYPES, limit: IMAGE_MAX_BYTES }),
    async (req, res) => {
      try {
        if (!req.user) throw apiError(401, "Vui l\xF2ng \u0111\u0103ng nh\u1EADp.");
        const mimeType = text(req.headers["content-type"]?.split(";")[0], 100).toLowerCase();
        if (!PDF_IMPORT_SOURCE_MIME_TYPES.includes(mimeType)) {
          throw apiError(415, "Ngu\u1ED3n PDF t\u1EA1m ch\u1EC9 nh\u1EADn \u1EA3nh JPEG, PNG ho\u1EB7c WebP.");
        }
        const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
        if (!buffer.length || buffer.length > IMAGE_MAX_BYTES) {
          throw apiError(413, "\u1EA2nh ngu\u1ED3n PDF t\u1EA1m r\u1ED7ng ho\u1EB7c v\u01B0\u1EE3t qu\xE1 10 MB.");
        }
        if (!hasValidMagic(buffer, mimeType)) {
          throw apiError(415, "N\u1ED9i dung \u1EA3nh ngu\u1ED3n PDF kh\xF4ng kh\u1EDBp \u0111\u1ECBnh d\u1EA1ng khai b\xE1o.");
        }
        const source = await pdfImportSources.create(req.user.id, mimeType, buffer);
        res.status(201).json(source);
      } catch (error) {
        sendError(res, error);
      }
    }
  );
  router.post("/admin/pdf-import/manifest", authenticateUser2, requireStaff, async (req, res) => {
    const removers = [];
    try {
      if (!req.user) throw apiError(401, "Vui l\xF2ng \u0111\u0103ng nh\u1EADp.");
      if (smartImport?.enabled === false || !smartImport?.analyzeVision) {
        throw apiError(503, smartImport?.reason || "C\u1EA7n c\u1EA5u h\xECnh AI th\u1ECB gi\xE1c \u0111\u1EC3 nh\u1EADp PDF.");
      }
      const usageKey = req.user.id;
      const windowStart = Date.now() - 10 * 60 * 1e3;
      const recentUsage = (smartImportUsage.get(usageKey) || []).filter((timestamp) => timestamp >= windowStart);
      if (recentUsage.length >= 20) throw apiError(429, "\u0110\xE3 \u0111\u1EA1t gi\u1EDBi h\u1EA1n 20 l\u01B0\u1EE3t Smart Import trong 10 ph\xFAt.");
      recentUsage.push(Date.now());
      smartImportUsage.set(usageKey, recentUsage);
      const preferredProvider = text(req.body?.preferredProvider, 60);
      const selectedProvider = (smartImport.providers || []).find((provider) => provider.id === preferredProvider);
      if (!selectedProvider) throw apiError(400, `Nh\xE0 cung c\u1EA5p AI "${preferredProvider}" kh\xF4ng t\u1ED3n t\u1EA1i.`);
      if (!selectedProvider.enabled || selectedProvider.visionEnabled === false) {
        throw apiError(503, selectedProvider.reason || `${selectedProvider.label} ch\u01B0a s\u1EB5n s\xE0ng cho \u1EA3nh.`);
      }
      const bookPageCount = Number(req.body?.bookPageCount);
      const keyPageCount = Number(req.body?.keyPageCount);
      if (!Number.isInteger(bookPageCount) || bookPageCount < 1 || bookPageCount > 1e3) {
        throw apiError(400, "S\u1ED1 trang PDF \u0111\u1EC1 b\xE0i kh\xF4ng h\u1EE3p l\u1EC7.");
      }
      if (!Number.isInteger(keyPageCount) || keyPageCount < 1 || keyPageCount > 1e3) {
        throw apiError(400, "S\u1ED1 trang PDF \u0111\xE1p \xE1n kh\xF4ng h\u1EE3p l\u1EC7.");
      }
      const tokenGroups = [
        { role: "question", tokens: req.body?.bookSourceTokens },
        { role: "answer_key", tokens: req.body?.keySourceTokens }
      ];
      const images = [];
      const seenTokens = /* @__PURE__ */ new Set();
      let totalBytes = 0;
      for (const group of tokenGroups) {
        const tokens = Array.isArray(group.tokens) ? group.tokens.map((value) => text(value, 2e3)).filter(Boolean) : [];
        if (!tokens.length || tokens.length > 12) throw apiError(400, `S\u1ED1 \u1EA3nh m\u1EE5c l\u1EE5c ${group.role} kh\xF4ng h\u1EE3p l\u1EC7.`);
        for (const token of tokens) {
          if (seenTokens.has(token)) throw apiError(400, "M\u1ED9t ngu\u1ED3n PDF t\u1EA1m kh\xF4ng \u0111\u01B0\u1EE3c d\xF9ng l\u1EB7p trong manifest.");
          seenTokens.add(token);
          let resolved;
          try {
            resolved = await pdfImportSources.resolve(token, req.user.id);
          } catch (reason) {
            throw apiError(/hết hạn/.test(reason?.message) ? 410 : 400, reason?.message || "Ngu\u1ED3n PDF t\u1EA1m kh\xF4ng h\u1EE3p l\u1EC7.");
          }
          removers.push(resolved.remove);
          totalBytes += resolved.data.length;
          if (totalBytes > 30 * 1024 * 1024) throw apiError(413, "T\u1ED5ng dung l\u01B0\u1EE3ng \u1EA3nh m\u1EE5c l\u1EE5c v\u01B0\u1EE3t qu\xE1 30 MB.");
          images.push({
            assetId: `pdf-source-${resolved.sourceId}`,
            role: group.role,
            mimeType: resolved.mimeType,
            data: resolved.data
          });
        }
      }
      const abortController = new AbortController();
      let timeoutId;
      const manifestPromise = createListeningPdfManifest({
        bookPageCount,
        keyPageCount,
        images,
        preferredProvider,
        analyzeVision: smartImport.analyzeVision,
        signal: abortController.signal
      });
      const timeoutPromise = new Promise((_resolve, reject) => {
        timeoutId = setTimeout(() => {
          abortController.abort();
          reject(apiError(504, "Nh\u1EADn di\u1EC7n c\u1EA5u tr\xFAc PDF qu\xE1 th\u1EDDi gian x\u1EED l\xFD. Ch\u01B0a t\u1EA1o b\u1EA3n nh\xE1p."));
        }, SMART_IMPORT_TIMEOUT_MS);
      });
      const manifest2 = await Promise.race([manifestPromise, timeoutPromise]).finally(() => {
        if (timeoutId) clearTimeout(timeoutId);
      });
      await logAudit?.(
        req.user.id,
        req.user.name,
        req.user.email,
        "ANALYZE_LISTENING_PDF_MANIFEST",
        `Nh\u1EADn di\u1EC7n ${manifest2.tests.length} Movers Listening Test b\u1EB1ng ${preferredProvider}; ch\u01B0a t\u1EA1o b\u1EA3n nh\xE1p.`
      );
      await Promise.allSettled(removers.map((remove) => remove()));
      removers.length = 0;
      res.json(manifest2);
    } catch (error) {
      sendError(res, error);
    } finally {
      await Promise.allSettled(removers.map((remove) => remove()));
    }
  });
  router.post("/admin/smart-import/analyze", authenticateUser2, requireStaff, async (req, res) => {
    const transientRemovers = [];
    try {
      if (!req.user) throw apiError(401, "Vui l\xF2ng \u0111\u0103ng nh\u1EADp.");
      if (smartImport?.enabled === false) throw apiError(503, smartImport.reason || "Smart Import \u0111ang t\u1EAFt.");
      const usageKey = req.user.id;
      const windowStart = Date.now() - 10 * 60 * 1e3;
      const recentUsage = (smartImportUsage.get(usageKey) || []).filter((timestamp) => timestamp >= windowStart);
      if (recentUsage.length >= 20) throw apiError(429, "\u0110\xE3 \u0111\u1EA1t gi\u1EDBi h\u1EA1n 20 l\u01B0\u1EE3t Smart Import trong 10 ph\xFAt.");
      recentUsage.push(Date.now());
      smartImportUsage.set(usageKey, recentUsage);
      if (req.body?.moduleId !== "mover") throw apiError(400, "Smart Import hi\u1EC7n ch\u1EC9 h\u1ED7 tr\u1EE3 Mover.");
      const part = Number(req.body?.part);
      if (![1, 2, 3, 4, 5].includes(part)) throw apiError(400, "Part kh\xF4ng h\u1EE3p l\u1EC7.");
      const currentPart = req.body?.currentPart;
      if (!currentPart || currentPart.part !== part) throw apiError(400, "D\u1EEF li\u1EC7u Part hi\u1EC7n t\u1EA1i kh\xF4ng h\u1EE3p l\u1EC7.");
      const basePartHash = text(req.body?.basePartHash, 64).toLowerCase();
      if (!/^[0-9a-f]{64}$/.test(basePartHash)) throw apiError(400, "Thi\u1EBFu hash c\u1EE7a Part hi\u1EC7n t\u1EA1i.");
      if (sha256(JSON.stringify(currentPart)) !== basePartHash) {
        throw apiError(409, "Part \u0111\xE3 thay \u0111\u1ED5i tr\u01B0\u1EDBc khi b\u1EAFt \u0111\u1EA7u ph\xE2n t\xEDch.", {
          code: "LISTENING_IMPORT_BASE_CHANGED"
        });
      }
      const pastedText = text(req.body?.pastedText, 12e3);
      const preferredProvider = text(req.body?.preferredProvider || "stali:gpt-5.6-sol", 60);
      const providerIds = new Set((smartImport?.providers || []).map((provider) => provider.id));
      if (!providerIds.has(preferredProvider)) {
        throw apiError(400, `Nh\xE0 cung c\u1EA5p AI "${preferredProvider}" kh\xF4ng t\u1ED3n t\u1EA1i.`);
      }
      const selectedProvider = (smartImport?.providers || []).find((provider) => provider.id === preferredProvider);
      if (selectedProvider && !selectedProvider.enabled) {
        throw apiError(503, selectedProvider.reason || `${selectedProvider.label} ch\u01B0a \u0111\u01B0\u1EE3c c\u1EA5u h\xECnh tr\xEAn m\xE1y ch\u1EE7.`);
      }
      const roleDefinitions = getListeningSmartImportRoleDefinitions(part);
      const allowedRoles = new Set(roleDefinitions.map((definition) => definition.role));
      const rawSources = Array.isArray(req.body?.sources) ? req.body.sources : [];
      if (rawSources.length > 3) throw apiError(400, "Smart Import ch\u1EC9 nh\u1EADn t\u1ED1i \u0111a ba \u1EA3nh role-based.");
      const sourceRequests = [];
      const seenRoles = /* @__PURE__ */ new Set();
      const seenSources = /* @__PURE__ */ new Set();
      for (const rawSource of rawSources.slice(0, 3)) {
        const role = text(rawSource?.role, 40);
        const assetId = text(rawSource?.assetId, 160);
        const transientToken = text(rawSource?.transientToken, 2e3);
        if (!allowedRoles.has(role) || Boolean(assetId) === Boolean(transientToken)) {
          throw apiError(400, "M\u1ED7i role Smart Import ph\u1EA3i c\xF3 \u0111\xFAng m\u1ED9t asset ho\u1EB7c ngu\u1ED3n PDF t\u1EA1m.");
        }
        if (seenRoles.has(role)) throw apiError(400, `Role ${role} b\u1ECB tr\xF9ng.`);
        const sourceKey = assetId ? `asset:${assetId}` : `transient:${transientToken}`;
        if (seenSources.has(sourceKey)) throw apiError(400, "M\u1ED9t \u1EA3nh kh\xF4ng \u0111\u01B0\u1EE3c d\xF9ng \u0111\u1ED3ng th\u1EDDi cho nhi\u1EC1u role.");
        seenRoles.add(role);
        seenSources.add(sourceKey);
        sourceRequests.push({ role, ...assetId ? { assetId } : { transientToken } });
      }
      const missingRoles = roleDefinitions.filter((definition) => definition.required && !seenRoles.has(definition.role));
      const answerTextFallback = Boolean(pastedText) && (part === 2 || part === 3);
      const effectiveMissingRoles = missingRoles.filter((definition) => !(answerTextFallback && definition.role === "answer_key"));
      if (effectiveMissingRoles.length) {
        throw apiError(400, `Thi\u1EBFu ngu\u1ED3n b\u1EAFt bu\u1ED9c: ${effectiveMissingRoles.map((definition) => definition.label).join(", ")}.`);
      }
      const images = [];
      const sources = [];
      let totalImageBytes = 0;
      for (const source of sourceRequests) {
        if (source.transientToken) {
          let resolved;
          try {
            resolved = await pdfImportSources.resolve(source.transientToken, req.user.id);
          } catch (reason) {
            throw apiError(/hết hạn/.test(reason?.message) ? 410 : 400, reason?.message || "Ngu\u1ED3n PDF t\u1EA1m kh\xF4ng h\u1EE3p l\u1EC7.");
          }
          transientRemovers.push(resolved.remove);
          if (resolved.data.length > IMAGE_MAX_BYTES) throw apiError(413, "M\u1ED9t \u1EA3nh ngu\u1ED3n v\u01B0\u1EE3t qu\xE1 gi\u1EDBi h\u1EA1n 10 MB.");
          totalImageBytes += resolved.data.length;
          if (totalImageBytes > 30 * 1024 * 1024) throw apiError(413, "T\u1ED5ng dung l\u01B0\u1EE3ng \u1EA3nh ngu\u1ED3n v\u01B0\u1EE3t qu\xE1 30 MB.");
          const assetId2 = `pdf-source-${resolved.sourceId}`;
          sources.push({ role: source.role, assetId: assetId2 });
          images.push({ assetId: assetId2, role: source.role, mimeType: resolved.mimeType, data: resolved.data });
          continue;
        }
        const assetId = source.assetId;
        const document = await db.collection("listening_assets").doc(assetId).get();
        if (!document.exists) throw apiError(404, `Kh\xF4ng t\xECm th\u1EA5y \u1EA3nh ngu\u1ED3n ${assetId}.`);
        const asset = { id: document.id, ...document.data() };
        if (!isSuperAdmin(req.user) && asset.ownerId !== req.user.id) {
          throw apiError(403, "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n d\xF9ng m\u1ED9t \u1EA3nh ngu\u1ED3n \u0111\xE3 ch\u1ECDn.");
        }
        if (asset.status !== "active" || asset.kind !== "image" || !asset.mimeType.startsWith("image/")) {
          throw apiError(400, "Smart Import ch\u1EC9 nh\u1EADn \u1EA3nh \u0111ang ho\u1EA1t \u0111\u1ED9ng; audio kh\xF4ng bao gi\u1EDD \u0111\u01B0\u1EE3c g\u1EEDi \u0111i ph\xE2n t\xEDch.");
        }
        const root = import_path3.default.resolve(mediaDir);
        const filePath = import_path3.default.resolve(mediaDir, asset.storageKey);
        if (!filePath.startsWith(`${root}${import_path3.default.sep}`)) throw apiError(400, "\u0110\u01B0\u1EDDng d\u1EABn \u1EA3nh ngu\u1ED3n kh\xF4ng h\u1EE3p l\u1EC7.");
        const data = await import_fs3.default.promises.readFile(filePath);
        if (data.length > IMAGE_MAX_BYTES) throw apiError(413, "M\u1ED9t \u1EA3nh ngu\u1ED3n v\u01B0\u1EE3t qu\xE1 gi\u1EDBi h\u1EA1n dung l\u01B0\u1EE3ng.");
        totalImageBytes += data.length;
        if (totalImageBytes > 30 * 1024 * 1024) throw apiError(413, "T\u1ED5ng dung l\u01B0\u1EE3ng \u1EA3nh ngu\u1ED3n v\u01B0\u1EE3t qu\xE1 30 MB.");
        sources.push({ role: source.role, assetId });
        images.push({ assetId, role: source.role, mimeType: asset.mimeType, data });
      }
      const importAbortController = new AbortController();
      const importPromise = createListeningSmartImportCandidate({
        part,
        currentPart,
        basePartHash,
        sources,
        pastedText,
        images,
        preferredProvider,
        analyzeVision: smartImport?.analyzeVision,
        signal: importAbortController.signal
      });
      let timeoutId;
      const timeoutPromise = new Promise((_resolve, reject) => {
        timeoutId = setTimeout(() => {
          importAbortController.abort();
          reject(apiError(
            504,
            `Smart Import qu\xE1 th\u1EDDi gian x\u1EED l\xFD ${Math.ceil(SMART_IMPORT_TIMEOUT_MS / 1e3)} gi\xE2y. Draft ch\u01B0a \u0111\u01B0\u1EE3c thay \u0111\u1ED5i.`,
            { code: "LISTENING_SMART_IMPORT_TIMEOUT" }
          ));
        }, SMART_IMPORT_TIMEOUT_MS);
      });
      const candidate = await Promise.race([importPromise, timeoutPromise]).finally(() => {
        if (timeoutId) clearTimeout(timeoutId);
      });
      await logAudit?.(
        req.user.id,
        req.user.name,
        req.user.email,
        "ANALYZE_LISTENING_PART",
        `Smart Import Mover Part ${part}; candidate ${candidate.id}; ${sources.length} \u1EA3nh role-based; requested ${preferredProvider}; provider ${candidate.provider}.`
      );
      await Promise.allSettled(transientRemovers.map((remove) => remove()));
      transientRemovers.length = 0;
      res.json(candidate);
    } catch (error) {
      sendError(res, error);
    } finally {
      await Promise.allSettled(transientRemovers.map((remove) => remove()));
    }
  });
  router.get("/admin/sets", authenticateUser2, requireStaff, async (req, res) => {
    try {
      const snapshot = isSuperAdmin(req.user) ? await db.collection("listening_sets").get() : await db.collection("listening_sets").where("ownerId", "==", req.user.id).get();
      const sets = [];
      snapshot.forEach((document) => {
        const set = { id: document.id, ...document.data() };
        if (belongsToMoverModule(set)) sets.push(withListeningModuleMetadata(set));
      });
      sets.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
      res.json(sets);
    } catch (error) {
      sendError(res, error);
    }
  });
  router.post("/admin/sets", authenticateUser2, requireStaff, async (req, res) => {
    try {
      if (!req.user) throw apiError(401, "Vui l\xF2ng \u0111\u0103ng nh\u1EADp.");
      const rawContent = req.body?.content;
      if (!rawContent || rawContent.schemaVersion !== 1) throw apiError(400, "C\u1EA5u tr\xFAc b\u1ED9 \u0111\u1EC1 kh\xF4ng h\u1EE3p l\u1EC7.");
      const content = withMoverContentMetadata(rawContent);
      const now = nowIso2();
      const set = {
        id: identifier("listen"),
        moduleId: DEFAULT_LISTENING_MODULE_ID,
        schemaVersion: LISTENING_LIBRARY_SCHEMA_VERSION,
        moduleSchemaVersion: LISTENING_LIBRARY_SCHEMA_VERSION,
        ownerId: req.user.id,
        createdBy: req.user.id,
        title: text(content.title, 160) || "B\u1ED9 \u0111\u1EC1 nghe m\u1EDBi",
        description: text(content.description, 2e3),
        level: text(content.level, 80),
        status: "draft",
        visibility: "draft",
        draftRevision: 1,
        draftContent: content,
        validationErrors: validateListeningSetContent(content),
        createdAt: now,
        updatedAt: now
      };
      await db.collection("listening_sets").doc(set.id).set(set);
      await logAudit?.(req.user.id, req.user.name, req.user.email, "CREATE_LISTENING_SET", `T\u1EA1o b\u1ED9 \u0111\u1EC1 nghe "${set.title}".`);
      res.status(201).json(set);
    } catch (error) {
      sendError(res, error);
    }
  });
  router.post("/admin/sets/:id/clone", authenticateUser2, requireStaff, async (req, res) => {
    try {
      if (!req.user) throw apiError(401, "Vui l\xF2ng \u0111\u0103ng nh\u1EADp.");
      const sourceSet = await getSet(db, req.params.id);
      if (!sourceSet || !belongsToMoverModule(sourceSet)) {
        throw apiError(404, "Kh\xF4ng t\xECm th\u1EA5y b\u1ED9 \u0111\u1EC1 nghe.");
      }
      if (!canManageSet(req.user, sourceSet)) {
        throw apiError(403, "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n sao ch\xE9p b\u1ED9 \u0111\u1EC1 n\xE0y.");
      }
      if (sourceSet.status === "archived") {
        throw apiError(409, "B\u1ED9 \u0111\u1EC1 \u0111\xE3 \u0111\u01B0\u1EE3c l\u01B0u tr\u1EEF.");
      }
      let sourceContent = sourceSet.draftContent;
      if (!sourceContent && sourceSet.publishedVersionId) {
        const publishedVersion = await getVersion(db, sourceSet.publishedVersionId);
        sourceContent = publishedVersion?.content;
      }
      if (!sourceContent || sourceContent.schemaVersion !== LISTENING_LIBRARY_SCHEMA_VERSION) {
        throw apiError(409, "B\u1ED9 \u0111\u1EC1 ngu\u1ED3n kh\xF4ng c\xF3 b\u1EA3n n\u1ED9i dung t\u01B0\u01A1ng th\xEDch \u0111\u1EC3 sao ch\xE9p.");
      }
      const suffix = " (B\u1EA3n sao)";
      const sourceTitle = text(sourceSet.title || sourceContent.title, 160) || "B\u1ED9 \u0111\u1EC1 nghe";
      const cloneTitle = `${sourceTitle.slice(0, 160 - suffix.length).trim()}${suffix}`;
      const content = withMoverContentMetadata({
        ...structuredClone(sourceContent),
        title: cloneTitle
      });
      const now = nowIso2();
      const clone = {
        id: identifier("listen"),
        moduleId: DEFAULT_LISTENING_MODULE_ID,
        schemaVersion: LISTENING_LIBRARY_SCHEMA_VERSION,
        moduleSchemaVersion: LISTENING_LIBRARY_SCHEMA_VERSION,
        ownerId: req.user.id,
        createdBy: req.user.id,
        title: cloneTitle,
        description: text(content.description, 2e3),
        level: text(content.level, 80),
        status: "draft",
        visibility: "draft",
        draftRevision: 1,
        draftContent: content,
        validationErrors: validateListeningSetContent(content),
        createdAt: now,
        updatedAt: now
      };
      await db.collection("listening_sets").doc(clone.id).set(clone);
      await logAudit?.(
        req.user.id,
        req.user.name,
        req.user.email,
        "CLONE_LISTENING_SET",
        `Sao ch\xE9p b\u1ED9 \u0111\u1EC1 nghe "${sourceSet.title}" th\xE0nh "${clone.title}".`
      );
      res.status(201).json(clone);
    } catch (error) {
      sendError(res, error);
    }
  });
  router.get("/admin/sets/:id", authenticateUser2, requireStaff, async (req, res) => {
    try {
      const set = await getSet(db, req.params.id);
      if (!set) throw apiError(404, "Kh\xF4ng t\xECm th\u1EA5y b\u1ED9 \u0111\u1EC1 nghe.");
      if (!canManageSet(req.user, set)) throw apiError(403, "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n xem b\u1ED9 \u0111\u1EC1 n\xE0y.");
      const versionsSnapshot = await db.collection("listening_set_versions").where("setId", "==", set.id).get();
      const versions = [];
      versionsSnapshot.forEach((document) => versions.push({ id: document.id, ...document.data() }));
      versions.sort((a, b) => Number(b.versionNumber) - Number(a.versionNumber));
      res.json({ ...set, versions });
    } catch (error) {
      sendError(res, error);
    }
  });
  router.put("/admin/sets/:id", authenticateUser2, requireStaff, async (req, res) => {
    try {
      const updated = await withDraftLock(req.params.id, async () => {
        const set = await getSet(db, req.params.id);
        if (!set) throw apiError(404, "Kh\xF4ng t\xECm th\u1EA5y b\u1ED9 \u0111\u1EC1 nghe.");
        if (!canManageSet(req.user, set)) throw apiError(403, "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n s\u1EEDa b\u1ED9 \u0111\u1EC1 n\xE0y.");
        if (set.status === "archived") throw apiError(409, "B\u1ED9 \u0111\u1EC1 \u0111\xE3 \u0111\u01B0\u1EE3c l\u01B0u tr\u1EEF.");
        const rawContent = req.body?.content;
        if (!rawContent || rawContent.schemaVersion !== 1) throw apiError(400, "C\u1EA5u tr\xFAc b\u1ED9 \u0111\u1EC1 kh\xF4ng h\u1EE3p l\u1EC7.");
        const content = withMoverContentMetadata(rawContent);
        const currentRevision = Number(set.draftRevision || 0);
        if (req.body?.baseRevision !== void 0 && Number(req.body.baseRevision) !== currentRevision) {
          throw apiError(409, "B\u1EA3n nh\xE1p \u0111\xE3 thay \u0111\u1ED5i \u1EDF m\u1ED9t phi\xEAn l\xE0m vi\u1EC7c kh\xE1c.", {
            code: "LISTENING_DRAFT_REVISION_CONFLICT",
            currentRevision
          });
        }
        const visibility = ["draft", "public", "assignment"].includes(req.body?.visibility) ? req.body.visibility : set.visibility;
        const shareToken = visibility === "assignment" ? set.shareToken || import_crypto.default.randomBytes(18).toString("base64url") : void 0;
        const next = {
          ...set,
          moduleId: DEFAULT_LISTENING_MODULE_ID,
          schemaVersion: LISTENING_LIBRARY_SCHEMA_VERSION,
          moduleSchemaVersion: LISTENING_LIBRARY_SCHEMA_VERSION,
          title: text(content.title, 160),
          description: text(content.description, 2e3),
          level: text(content.level, 80),
          visibility,
          draftRevision: currentRevision + 1,
          draftContent: content,
          validationErrors: validateListeningSetContent(content),
          updatedAt: nowIso2(),
          ...shareToken ? { shareToken, assignmentSlug: shareToken } : {}
        };
        if (!shareToken) {
          delete next.shareToken;
          delete next.assignmentSlug;
        }
        await db.collection("listening_sets").doc(set.id).set(next);
        return next;
      });
      res.json(updated);
    } catch (error) {
      sendError(res, error);
    }
  });
  router.post("/admin/sets/:id/draft/autosave", authenticateUser2, requireStaff, async (req, res) => {
    try {
      const updated = await withDraftLock(req.params.id, async () => {
        const set = await getSet(db, req.params.id);
        if (!set) throw apiError(404, "Kh\xF4ng t\xECm th\u1EA5y b\u1ED9 \u0111\u1EC1 nghe.");
        if (!canManageSet(req.user, set)) throw apiError(403, "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n s\u1EEDa b\u1ED9 \u0111\u1EC1 n\xE0y.");
        if (set.status === "archived") throw apiError(409, "B\u1ED9 \u0111\u1EC1 \u0111\xE3 \u0111\u01B0\u1EE3c l\u01B0u tr\u1EEF.");
        const rawContent = req.body?.content;
        if (!rawContent || rawContent.schemaVersion !== 1) throw apiError(400, "C\u1EA5u tr\xFAc b\u1ED9 \u0111\u1EC1 kh\xF4ng h\u1EE3p l\u1EC7.");
        const baseRevision = Number(req.body?.baseRevision);
        const currentRevision = Number(set.draftRevision || 0);
        if (!Number.isInteger(baseRevision) || baseRevision !== currentRevision) {
          throw apiError(409, "B\u1EA3n nh\xE1p \u0111\xE3 thay \u0111\u1ED5i \u1EDF m\u1ED9t phi\xEAn l\xE0m vi\u1EC7c kh\xE1c.", {
            code: "LISTENING_DRAFT_REVISION_CONFLICT",
            currentRevision
          });
        }
        const content = withMoverContentMetadata(rawContent);
        const visibility = ["draft", "public", "assignment"].includes(req.body?.visibility) ? req.body.visibility : set.visibility;
        const shareToken = visibility === "assignment" ? set.shareToken || import_crypto.default.randomBytes(18).toString("base64url") : void 0;
        const updatedAt = nowIso2();
        const next = {
          ...set,
          title: text(content.title, 160),
          description: text(content.description, 2e3),
          level: text(content.level, 80),
          visibility,
          draftRevision: currentRevision + 1,
          draftContent: content,
          validationErrors: validateListeningSetContent(content),
          updatedAt,
          ...shareToken ? { shareToken, assignmentSlug: shareToken } : {}
        };
        if (!shareToken) {
          delete next.shareToken;
          delete next.assignmentSlug;
        }
        await db.collection("listening_sets").doc(set.id).set(next);
        return next;
      });
      res.json({
        draftRevision: updated.draftRevision,
        updatedAt: updated.updatedAt,
        validationErrors: updated.validationErrors
      });
    } catch (error) {
      sendError(res, error);
    }
  });
  router.post("/admin/sets/:id/publish", authenticateUser2, requireStaff, async (req, res) => {
    try {
      if (!req.user) throw apiError(401, "Vui l\xF2ng \u0111\u0103ng nh\u1EADp.");
      const set = await getSet(db, req.params.id);
      if (!set) throw apiError(404, "Kh\xF4ng t\xECm th\u1EA5y b\u1ED9 \u0111\u1EC1 nghe.");
      if (!canManageSet(req.user, set)) throw apiError(403, "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n xu\u1EA5t b\u1EA3n b\u1ED9 \u0111\u1EC1 n\xE0y.");
      if (set.status === "archived") throw apiError(409, "B\u1ED9 \u0111\u1EC1 \u0111\xE3 \u0111\u01B0\u1EE3c l\u01B0u tr\u1EEF.");
      const draftContent = withMoverContentMetadata(set.draftContent);
      const errors = validateListeningSetContent(draftContent);
      if (errors.length) throw apiError(422, "B\u1ED9 \u0111\u1EC1 ch\u01B0a \u0111\u1EE7 \u0111i\u1EC1u ki\u1EC7n xu\u1EA5t b\u1EA3n.", errors);
      const resolved = await resolveContentAssets(db, draftContent, req.user);
      const versionsSnapshot = await db.collection("listening_set_versions").where("setId", "==", set.id).get();
      let versionNumber = 1;
      versionsSnapshot.forEach((document) => {
        versionNumber = Math.max(versionNumber, Number(document.data()?.versionNumber || 0) + 1);
      });
      const now = nowIso2();
      const version = {
        id: identifier("listenver"),
        moduleId: DEFAULT_LISTENING_MODULE_ID,
        moduleSchemaVersion: LISTENING_LIBRARY_SCHEMA_VERSION,
        schemaVersion: draftContent.schemaVersion,
        setId: set.id,
        versionNumber,
        status: "published",
        content: resolved.content,
        createdAt: now,
        updatedAt: now,
        publishedAt: now
      };
      const batch = db.batch();
      batch.set(db.collection("listening_set_versions").doc(version.id), version);
      if (set.publishedVersionId) {
        const previous = await getVersion(db, set.publishedVersionId);
        if (previous) {
          batch.update(db.collection("listening_set_versions").doc(previous.id), {
            status: "superseded",
            updatedAt: now
          });
        }
      }
      const publishedSet = {
        ...set,
        moduleId: DEFAULT_LISTENING_MODULE_ID,
        schemaVersion: LISTENING_LIBRARY_SCHEMA_VERSION,
        moduleSchemaVersion: LISTENING_LIBRARY_SCHEMA_VERSION,
        draftContent,
        title: resolved.content.title,
        description: resolved.content.description,
        level: resolved.content.level,
        coverUrl: resolved.content.coverUrl || "",
        backgroundUrl: resolved.content.backgroundUrl || "",
        timeLimitMinutes: resolved.content.timeLimitMinutes,
        status: "published",
        publishedVersionId: version.id,
        publishedVersionNumber: versionNumber,
        validationErrors: [],
        updatedAt: now
      };
      batch.set(db.collection("listening_sets").doc(set.id), publishedSet);
      resolved.references.forEach((reference) => {
        const usageId = `lusage-${sha256(`${version.id}:${reference.id}:${reference.entityId}:${reference.role}`).slice(0, 32)}`;
        batch.set(db.collection("listening_asset_usages").doc(usageId), {
          id: usageId,
          assetId: reference.id,
          setId: set.id,
          versionId: version.id,
          entityId: reference.entityId,
          role: reference.role,
          createdAt: now,
          updatedAt: now
        });
      });
      await batch.commit();
      await logAudit?.(req.user.id, req.user.name, req.user.email, "PUBLISH_LISTENING_SET", `Xu\u1EA5t b\u1EA3n "${publishedSet.title}" phi\xEAn b\u1EA3n ${versionNumber}.`);
      res.json({ set: publishedSet, version });
    } catch (error) {
      sendError(res, error);
    }
  });
  router.delete("/admin/sets/:id", authenticateUser2, requireStaff, async (req, res) => {
    try {
      const set = await getSet(db, req.params.id);
      if (!set) throw apiError(404, "Kh\xF4ng t\xECm th\u1EA5y b\u1ED9 \u0111\u1EC1 nghe.");
      if (!canManageSet(req.user, set)) throw apiError(403, "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n l\u01B0u tr\u1EEF b\u1ED9 \u0111\u1EC1 n\xE0y.");
      const updatedAt = nowIso2();
      await db.collection("listening_sets").doc(set.id).update({ status: "archived", updatedAt });
      res.json({ success: true, recoverable: true, status: "archived", updatedAt });
    } catch (error) {
      sendError(res, error);
    }
  });
  router.get("/admin/sets/:id/results", authenticateUser2, requireStaff, async (req, res) => {
    try {
      const set = await getSet(db, req.params.id);
      if (!set) throw apiError(404, "Kh\xF4ng t\xECm th\u1EA5y b\u1ED9 \u0111\u1EC1 nghe.");
      if (!canManageSet(req.user, set)) throw apiError(403, "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n xem k\u1EBFt qu\u1EA3.");
      const snapshot = await db.collection("listening_attempts").where("setId", "==", set.id).get();
      const attempts = [];
      snapshot.forEach((document) => {
        const { runSecretHash: _secret, ...attempt } = { id: document.id, ...document.data() };
        attempts.push(attempt);
      });
      attempts.sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt)));
      res.json({ set: publicSetSummary(set), attempts });
    } catch (error) {
      sendError(res, error);
    }
  });
  router.get("/sets", authenticateOptionalUser2, async (req, res) => {
    try {
      const snapshot = await db.collection("listening_sets").get();
      const sets = [];
      snapshot.forEach((document) => {
        const set = { id: document.id, ...document.data() };
        if (!belongsToMoverModule(set)) return;
        const canSee = set.status === "published" && (set.visibility === "public" || req.user?.role === "super_admin" || canManageSet(req.user, set));
        if (canSee) sets.push(publicSetSummary(set));
      });
      sets.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
      res.json(sets);
    } catch (error) {
      sendError(res, error);
    }
  });
  router.get("/sets/:id", authenticateOptionalUser2, async (req, res) => {
    try {
      const set = await getSet(db, req.params.id);
      await resolveLearningAccess(db, set, req);
      const version = await getVersion(db, set.publishedVersionId);
      if (!version) throw apiError(404, "Kh\xF4ng t\xECm th\u1EA5y phi\xEAn b\u1EA3n \u0111\xE3 xu\u1EA5t b\u1EA3n.");
      res.json(playableSet(set, version));
    } catch (error) {
      sendError(res, error);
    }
  });
  router.post("/sets/:id/attempts/prepare", authenticateOptionalUser2, async (req, res) => {
    try {
      const set = await getSet(db, req.params.id);
      const access = await resolveLearningAccess(db, set, req);
      const actor = await resolveActor(req, resolveGuestProfile2, {
        classId: access.assignment?.classId,
        className: access.assignment?.className,
        verified: Boolean(access.assignment?.id)
      });
      const clientRunId = text(req.body?.clientRunId, 160);
      const runSecret = text(req.body?.runSecret, 300);
      if (!clientRunId || !runSecret) throw apiError(400, "Thi\u1EBFu m\xE3 l\u01B0\u1EE3t l\xE0m b\xE0i.");
      const version = await getVersion(db, set.publishedVersionId);
      if (!version) throw apiError(404, "Kh\xF4ng t\xECm th\u1EA5y phi\xEAn b\u1EA3n \u0111\xE3 xu\u1EA5t b\u1EA3n.");
      const startedAt = nowIso2();
      const deadlineAt = set.timeLimitMinutes ? new Date(Date.now() + Number(set.timeLimitMinutes) * 6e4).toISOString() : void 0;
      const ticketExpiresAt = Date.now() + (deadlineAt ? 24 * 60 * 6e4 : 7 * 24 * 60 * 6e4);
      const payload = {
        schemaVersion: LISTENING_LIBRARY_SCHEMA_VERSION,
        moduleId: DEFAULT_LISTENING_MODULE_ID,
        setId: set.id,
        versionId: version.id,
        ownerKey: actor.ownerKey,
        assignmentId: access.assignment?.id || "",
        classId: access.assignment?.classId || "",
        className: access.assignment?.className || "",
        assignmentTitle: access.assignment?.title || access.assignment?.resourceTitle || "",
        clientRunId,
        runSecretHash: sha256(runSecret),
        startedAt,
        deadlineAt,
        ticketExpiresAt
      };
      res.json({
        ticket: encodeTicket(payload, ticketSecret),
        set: playableSet(set, version),
        startedAt,
        deadlineAt,
        clientRunId
      });
    } catch (error) {
      sendError(res, error);
    }
  });
  router.post("/sets/:id/attempts/submit", authenticateOptionalUser2, async (req, res) => {
    try {
      const ticket = decodeTicket(req.body?.ticket, ticketSecret);
      if (ticket.setId !== req.params.id) throw apiError(400, "Phi\u1EBFu l\xE0m b\xE0i kh\xF4ng thu\u1ED9c b\u1ED9 \u0111\u1EC1 n\xE0y.");
      const runSecret = text(req.body?.runSecret, 300);
      if (!runSecret || !timingSafeEqual(sha256(runSecret), ticket.runSecretHash)) {
        throw apiError(401, "M\xE3 x\xE1c nh\u1EADn l\u01B0\u1EE3t l\xE0m b\xE0i kh\xF4ng h\u1EE3p l\u1EC7.");
      }
      const actor = await resolveActor(req, resolveGuestProfile2);
      if (actor.ownerKey !== ticket.ownerKey) throw apiError(403, "L\u01B0\u1EE3t l\xE0m b\xE0i kh\xF4ng thu\u1ED9c h\u1ECDc sinh n\xE0y.");
      const attemptId = `lattempt-${sha256(`${ticket.ownerKey}:${ticket.setId}:${ticket.clientRunId}`).slice(0, 40)}`;
      const existingDocument = await db.collection("listening_attempts").doc(attemptId).get();
      if (existingDocument.exists) {
        const existing = { id: existingDocument.id, ...existingDocument.data() };
        if (!timingSafeEqual(String(existing.runSecretHash || ""), ticket.runSecretHash)) {
          throw apiError(409, "M\xE3 l\u01B0\u1EE3t l\xE0m b\xE0i \u0111\xE3 \u0111\u01B0\u1EE3c s\u1EED d\u1EE5ng.");
        }
        const { runSecretHash: _secret2, ...safeAttempt2 } = existing;
        return res.json({ ...safeAttempt2, idempotentReplay: true });
      }
      const version = await getVersion(db, ticket.versionId);
      if (!version || version.setId !== ticket.setId) throw apiError(404, "Phi\xEAn b\u1EA3n l\xE0m b\xE0i kh\xF4ng c\xF2n kh\u1EA3 d\u1EE5ng.");
      const answers = sanitizeListeningAnswers(req.body?.answers);
      const grade = gradeListeningAttempt(version.content, answers);
      const completedAt = nowIso2();
      const startedAtMs = new Date(ticket.startedAt).getTime();
      const durationSeconds = Math.max(0, Math.round((Date.now() - startedAtMs) / 1e3));
      const timedOut = Boolean(ticket.deadlineAt && Date.now() >= new Date(ticket.deadlineAt).getTime());
      const attempt = {
        id: attemptId,
        moduleId: resolveListeningModuleId(ticket.moduleId),
        schemaVersion: Number(ticket.schemaVersion || LISTENING_LIBRARY_SCHEMA_VERSION),
        ownerKey: ticket.ownerKey,
        userId: actor.userId,
        guestId: actor.guestId,
        studentName: actor.studentName,
        setId: ticket.setId,
        versionId: ticket.versionId,
        assignmentId: ticket.assignmentId || "",
        classId: ticket.classId || "",
        className: ticket.className || "",
        assignmentTitle: ticket.assignmentTitle || "",
        clientRunId: ticket.clientRunId,
        runSecretHash: ticket.runSecretHash,
        setTitle: version.content.title,
        score: grade.score,
        correctCount: grade.correctCount,
        incorrectCount: grade.incorrectCount,
        unansweredCount: grade.unansweredCount,
        totalCount: grade.totalCount,
        startedAt: ticket.startedAt,
        completedAt,
        durationSeconds,
        timedOut,
        status: "completed",
        gradingVersion: LISTENING_GRADING_VERSION,
        createdAt: completedAt,
        updatedAt: completedAt
      };
      const answerDetails = buildListeningActivityAnswerDetails(version.content, answers, grade.questions);
      const visualReview = buildListeningVisualReviewSnapshot(
        version.content,
        answers,
        grade.questions,
        answerDetails
      );
      const detail = {
        id: attemptId,
        attemptId,
        answers,
        questions: grade.questions,
        answerDetails,
        questionSnapshots: answerDetails.map((item) => ({
          questionId: item.questionId,
          questionText: item.questionText,
          part: item.part
        })),
        optionSnapshots: [],
        extraDetails: {
          moduleId: resolveListeningModuleId(ticket.moduleId),
          schemaVersion: Number(ticket.schemaVersion || LISTENING_LIBRARY_SCHEMA_VERSION),
          setId: ticket.setId,
          versionId: ticket.versionId,
          gradingVersion: LISTENING_GRADING_VERSION,
          visualReview
        },
        reviewPolicy: {
          showReviewAfterSubmit: true,
          showExplanationImmediately: false,
          policyVersion: 2
        },
        gradingVersion: LISTENING_GRADING_VERSION,
        createdAt: completedAt,
        updatedAt: completedAt
      };
      const batch = db.batch();
      batch.set(db.collection("listening_attempts").doc(attemptId), attempt);
      batch.set(db.collection("listening_attempt_details").doc(attemptId), detail);
      await batch.commit();
      const { runSecretHash: _secret, ...safeAttempt } = attempt;
      res.status(201).json(safeAttempt);
    } catch (error) {
      sendError(res, error);
    }
  });
  router.get("/sets/:id/attempts/:attemptId/review", authenticateOptionalUser2, async (req, res) => {
    try {
      const actor = await resolveActor(req, resolveGuestProfile2);
      const attemptSnapshot = await db.collection("listening_attempts").doc(req.params.attemptId).get();
      if (!attemptSnapshot.exists) throw apiError(404, "Kh\xF4ng t\xECm th\u1EA5y l\u01B0\u1EE3t l\xE0m b\xE0i.");
      const attempt = { id: attemptSnapshot.id, ...attemptSnapshot.data() };
      if (attempt.setId !== req.params.id || attempt.ownerKey !== actor.ownerKey) {
        throw apiError(404, "Kh\xF4ng t\xECm th\u1EA5y l\u01B0\u1EE3t l\xE0m b\xE0i.");
      }
      if (actor.guestId) {
        const runSecret = text(req.headers["x-listening-run-secret"], 300);
        if (!runSecret || !timingSafeEqual(sha256(runSecret), String(attempt.runSecretHash || ""))) {
          throw apiError(404, "Kh\xF4ng t\xECm th\u1EA5y l\u01B0\u1EE3t l\xE0m b\xE0i.");
        }
      }
      if (attempt.status !== "completed") throw apiError(409, "L\u01B0\u1EE3t l\xE0m b\xE0i ch\u01B0a ho\xE0n t\u1EA5t.");
      const detailSnapshot = await db.collection("listening_attempt_details").doc(attempt.id).get();
      if (!detailSnapshot.exists) throw apiError(404, "Chi ti\u1EBFt \u0111\xE1p \xE1n kh\xF4ng c\xF2n kh\u1EA3 d\u1EE5ng.");
      const detail = detailSnapshot.data();
      if (detail?.reviewPolicy?.showReviewAfterSubmit !== true) {
        throw apiError(403, "B\u1ED9 \u0111\u1EC1 n\xE0y kh\xF4ng cho xem \u0111\xE1p \xE1n sau khi n\u1ED9p.");
      }
      const version = await getVersion(db, String(attempt.versionId || detail?.extraDetails?.versionId || ""));
      let visualReview = normalizeListeningVisualReviewSnapshot(detail?.extraDetails?.visualReview);
      if (!visualReview && detail?.answers && Array.isArray(detail?.questions) && version?.content) {
        try {
          visualReview = buildListeningVisualReviewSnapshot(
            version.content,
            detail.answers,
            detail.questions
          );
        } catch {
        }
      }
      const transcripts = version?.content ? buildListeningReviewTranscripts(version.content) : [];
      res.json({
        attemptId: attempt.id,
        score: Number(attempt.score || 0),
        correctCount: Number(attempt.correctCount || 0),
        incorrectCount: Number(attempt.incorrectCount || 0),
        unansweredCount: Number(attempt.unansweredCount || 0),
        totalCount: Number(attempt.totalCount || 25),
        answerDetails: normalizeListeningActivityAnswerDetails(detail),
        ...visualReview ? { visualReview } : {},
        ...transcripts.length ? { transcripts } : {}
      });
    } catch (error) {
      sendError(res, error);
    }
  });
  router.get("/sets/:id/my-attempts", authenticateOptionalUser2, async (req, res) => {
    try {
      const actor = await resolveActor(req, resolveGuestProfile2);
      const snapshot = await db.collection("listening_attempts").where("setId", "==", req.params.id).where("ownerKey", "==", actor.ownerKey).get();
      const attempts = [];
      snapshot.forEach((document) => {
        const { runSecretHash: _secret, ...attempt } = { id: document.id, ...document.data() };
        attempts.push(attempt);
      });
      attempts.sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt)));
      res.json(attempts);
    } catch (error) {
      sendError(res, error);
    }
  });
  return router;
}

// src/server/listening-library/modules/mover/adapter.ts
var manifest = getListeningModule("mover");
if (!manifest) throw new Error("Missing Mover listening module manifest.");
var moverServerModule = {
  manifest,
  createLegacyRouter: createListeningRouter,
  validateContent: validateListeningSetContent,
  sanitizeContentForStudent: sanitizeListeningContentForStudent,
  gradeAttempt: gradeListeningAttempt,
  gradingVersion: LISTENING_GRADING_VERSION
};
var createMoverLegacyRouter = createListeningRouter;

// src/server/listening-library/registry.ts
var serverModules = /* @__PURE__ */ new Map([
  [moverServerModule.manifest.id, moverServerModule]
]);
function getListeningServerModule(moduleId) {
  return serverModules.get(moduleId);
}

// src/server/listening-library/router.ts
function createListeningLibraryRouter() {
  const router = import_express3.default.Router();
  router.get("/modules", (_req, res) => {
    res.json(getVisibleListeningModules().map(publicListeningModuleManifest));
  });
  router.get("/modules/:moduleId", (req, res) => {
    if (!isListeningModuleId(req.params.moduleId)) {
      return res.status(404).json({ error: "Module k\u1EF3 thi kh\xF4ng t\u1ED3n t\u1EA1i." });
    }
    const manifest2 = getListeningModule(req.params.moduleId);
    if (!manifest2 || manifest2.status === "hidden") {
      return res.status(404).json({ error: "Module k\u1EF3 thi kh\xF4ng t\u1ED3n t\u1EA1i." });
    }
    const serverModule = getListeningServerModule(req.params.moduleId);
    return res.json({
      ...publicListeningModuleManifest(manifest2),
      available: Boolean(serverModule && manifest2.status === "active"),
      gradingVersion: serverModule?.gradingVersion
    });
  });
  return router;
}

// src/server/mover-reading-writing/moverReadingWritingRouter.ts
var import_crypto2 = __toESM(require("crypto"), 1);
var import_express4 = __toESM(require("express"), 1);
var import_fs4 = __toESM(require("fs"), 1);
var import_path4 = __toESM(require("path"), 1);

// src/features/mover-reading-writing/smart-import/types.ts
function getMoverReadingWritingSmartImportRoleDefinitions(part) {
  if (part === 1) return [
    { role: "word_bank", label: "\u1EA2nh ng\xE2n h\xE0ng t\u1EEB", required: true, source: "asset", help: "\u1EA2nh h\u1ECDc sinh s\u1EBD nh\xECn th\u1EA5y \u1EDF b\xEAn tr\xE1i." },
    { role: "questions", label: "\u1EA2nh 6 c\xE2u h\u1ECFi", required: true, source: "transient", help: "Trang ch\u1EE9a s\xE1u c\xE2u c\u1EA7n nh\u1EADp." },
    { role: "answer_key", label: "\u1EA2nh \u0111\xE1p \xE1n", required: true, source: "transient", help: "Ngu\u1ED3n \u0111\xE1p \xE1n ch\xEDnh th\u1EE9c, kh\xF4ng d\xF9ng AI t\u1EF1 gi\u1EA3i." }
  ];
  if (part === 2) return [
    { role: "scene", label: "\u1EA2nh t\xECnh hu\u1ED1ng/v\xED d\u1EE5", required: true, source: "asset", help: "\u1EA2nh h\u1ECDc sinh s\u1EBD nh\xECn th\u1EA5y \u1EDF b\xEAn tr\xE1i." },
    { role: "questions", label: "\u1EA2nh 6 nh\u1EADn \u0111\u1ECBnh", required: true, source: "transient", help: "Trang ch\u1EE9a s\xE1u nh\u1EADn \u0111\u1ECBnh Yes/No." },
    { role: "answer_key", label: "\u1EA2nh \u0111\xE1p \xE1n", required: true, source: "transient", help: "Ngu\u1ED3n \u0111\xE1p \xE1n Yes/No ch\xEDnh th\u1EE9c." }
  ];
  if (part === 3) return [
    { role: "scene", label: "\u1EA2nh h\u1ED9i tho\u1EA1i/v\xED d\u1EE5", required: true, source: "asset", help: "\u1EA2nh h\u1ECDc sinh s\u1EBD nh\xECn th\u1EA5y \u1EDF b\xEAn tr\xE1i." },
    { role: "questions", label: "\u1EA2nh c\xE1c c\xE2u h\u1ED9i tho\u1EA1i", required: true, source: "transient", help: "Trang ch\u1EE9a \u0111\u1EE7 s\xE1u c\xE2u v\xE0 l\u1EF1a ch\u1ECDn A/B/C." },
    { role: "answer_key", label: "\u1EA2nh \u0111\xE1p \xE1n", required: true, source: "transient", help: "Ngu\u1ED3n \u0111\xE1p \xE1n A/B/C ch\xEDnh th\u1EE9c." }
  ];
  if (part === 4) return [
    { role: "word_bank", label: "\u1EA2nh ng\xE2n h\xE0ng t\u1EEB", required: true, source: "asset", help: "\u1EA2nh h\u1ECDc sinh s\u1EBD nh\xECn th\u1EA5y \u1EDF b\xEAn tr\xE1i." },
    { role: "story", label: "\u1EA2nh b\xE0i \u0111\u1ECDc v\xE0 c\xE2u 7", required: true, source: "transient", help: "Trang ch\u1EE9a truy\u1EC7n, s\xE1u ch\u1ED7 tr\u1ED1ng v\xE0 c\xE2u ch\u1ECDn ti\xEAu \u0111\u1EC1." },
    { role: "answer_key", label: "\u1EA2nh \u0111\xE1p \xE1n", required: true, source: "transient", help: "Ngu\u1ED3n \u0111\xE1p \xE1n s\xE1u ch\u1ED7 tr\u1ED1ng v\xE0 c\xE2u 7." }
  ];
  if (part === 5) return [
    { role: "scene_1", label: "Trang/tranh 1", required: true, source: "asset", help: "D\xF9ng tr\u1EF1c ti\u1EBFp l\xE0m \u1EA3nh h\u1ECDc sinh nh\xECn th\u1EA5y v\xE0 l\xE0m ngu\u1ED3n OCR." },
    { role: "scene_2", label: "Trang/tranh 2", required: true, source: "asset", help: "D\xF9ng tr\u1EF1c ti\u1EBFp l\xE0m \u1EA3nh h\u1ECDc sinh nh\xECn th\u1EA5y v\xE0 l\xE0m ngu\u1ED3n OCR." },
    { role: "scene_3", label: "Trang/tranh 3", required: true, source: "asset", help: "D\xF9ng tr\u1EF1c ti\u1EBFp l\xE0m \u1EA3nh h\u1ECDc sinh nh\xECn th\u1EA5y v\xE0 l\xE0m ngu\u1ED3n OCR." },
    { role: "answer_key", label: "\u1EA2nh \u0111\xE1p \xE1n", required: true, source: "transient", help: "Ngu\u1ED3n \u0111\xE1p \xE1n ch\xEDnh th\u1EE9c cho \u0111\u1EE7 m\u01B0\u1EDDi c\xE2u." }
  ];
  return [
    { role: "passage", label: "\u1EA2nh ngu\u1ED3n b\xE0i \u0111\u1ECDc", required: true, source: "asset", help: "Ngu\u1ED3n OCR v\xE0 ngu\u1ED3n \u0111\u1EC3 crop \u1EA3nh b\xE0i \u0111\u1ECDc hi\u1EC3n th\u1ECB cho h\u1ECDc sinh." },
    { role: "options", label: "\u1EA2nh b\u1EA3ng l\u1EF1a ch\u1ECDn", required: true, source: "asset", help: "D\xF9ng tr\u1EF1c ti\u1EBFp l\xE0m ng\xE2n h\xE0ng t\u1EEB \u0111\u1EC3 h\u1ECDc sinh nh\xECn v\xE0 t\u1EF1 vi\u1EBFt v\xE0o ch\u1ED7 tr\u1ED1ng." },
    { role: "answer_key", label: "\u1EA2nh \u0111\xE1p \xE1n", required: true, source: "transient", help: "\u0110\u1ECDc nguy\xEAn v\u0103n t\u1EEB \u0111\xFAng theo s\u1ED1 c\xE2u; kh\xF4ng quy \u0111\u1ED5i sang A/B/C." }
  ];
}

// src/server/mover-reading-writing/moverReadingWritingGrader.ts
var MOVER_READING_WRITING_GRADING_VERSION = "mover-reading-writing-v2";
function normalizeMoverReadingWritingText(value) {
  return String(value ?? "").normalize("NFKC").trim().toLocaleLowerCase("en").replace(/[\u2018\u2019\u02bc\u0060]/g, "'").replace(/\s+/g, " ");
}
function displayOption(options, id) {
  const index = options.findIndex((option) => option.id === id);
  if (index < 0) return "";
  const label = String.fromCharCode(65 + index);
  return `${label}. ${options[index].text}`.trim();
}
var displayTextPrompt = (prompt, id) => String(prompt || "").split(`{{${id}}}`).join("_____");
function gradeMoverReadingWritingAttempt(inputContent, answers) {
  const content = normalizeMoverReadingWritingContent(inputContent);
  const questions = [];
  const push = (part, questionId, prompt, userAnswer, correctAnswer, correct) => questions.push({
    part,
    questionId,
    prompt,
    userAnswer,
    correctAnswer,
    correct,
    unanswered: !normalizeMoverReadingWritingText(userAnswer)
  });
  content.parts[0].questions.forEach((question) => {
    const actual = String(answers.part1?.[question.id] || "");
    const normalized = normalizeMoverReadingWritingText(actual);
    push(1, question.id, displayTextPrompt(question.prompt, question.id), actual, question.acceptedAnswers[0] || "", Boolean(normalized) && question.acceptedAnswers.some((answer) => normalizeMoverReadingWritingText(answer) === normalized));
  });
  content.parts[1].questions.forEach((question) => {
    const actual = String(answers.part2?.[question.id] || "");
    push(2, question.id, question.statement, actual, question.correctAnswer, actual === question.correctAnswer);
  });
  content.parts[2].questions.forEach((question) => {
    const actualId = String(answers.part3?.[question.id] || "");
    push(3, question.id, question.prompt, displayOption(question.options, actualId), displayOption(question.options, question.correctOptionId), actualId === question.correctOptionId);
  });
  content.parts[3].gaps.forEach((gap, index) => {
    const actual = String(answers.part4?.gaps?.[gap.id] || "");
    const normalized = normalizeMoverReadingWritingText(actual);
    push(4, gap.id, `Ch\u1ED7 tr\u1ED1ng ${index + 1}`, actual, gap.acceptedAnswers[0] || "", Boolean(normalized) && gap.acceptedAnswers.some((answer) => normalizeMoverReadingWritingText(answer) === normalized));
  });
  const titleQuestion = content.parts[3].titleQuestion;
  const actualTitleId = String(answers.part4?.titleOptionId || "");
  push(4, titleQuestion.id, titleQuestion.prompt, displayOption(titleQuestion.options, actualTitleId), displayOption(titleQuestion.options, titleQuestion.correctOptionId), actualTitleId === titleQuestion.correctOptionId);
  content.parts[4].scenes.forEach((scene) => scene.questions.forEach((question) => {
    const actual = String(answers.part5?.[question.id] || "");
    const normalized = normalizeMoverReadingWritingText(actual);
    const wordCount = normalized ? normalized.split(" ").length : 0;
    const accepted = question.acceptedAnswers.some((answer) => normalizeMoverReadingWritingText(answer) === normalized);
    push(5, question.id, displayTextPrompt(question.prompt, question.id), actual, question.acceptedAnswers[0] || "", wordCount >= 1 && wordCount <= 3 && accepted);
  }));
  content.parts[5].gaps.forEach((gap, index) => {
    const actual = String(answers.part6?.[gap.id] || "");
    const normalized = normalizeMoverReadingWritingText(actual);
    push(
      6,
      gap.id,
      `Ch\u1ED7 tr\u1ED1ng ${index + 1}`,
      actual,
      gap.acceptedAnswers[0] || "",
      Boolean(normalized) && normalized.split(" ").length === 1 && gap.acceptedAnswers.some((answer) => normalizeMoverReadingWritingText(answer) === normalized)
    );
  });
  if (questions.length !== MOVER_READING_WRITING_TOTAL_QUESTIONS) {
    throw new Error(`Published Mover Reading & Writing version must contain exactly ${MOVER_READING_WRITING_TOTAL_QUESTIONS} questions; received ${questions.length}.`);
  }
  const correctCount = questions.filter((question) => question.correct).length;
  const unansweredCount = questions.filter((question) => question.unanswered).length;
  const incorrectCount = questions.length - correctCount - unansweredCount;
  return {
    score: Math.round(correctCount / MOVER_READING_WRITING_TOTAL_QUESTIONS * 100),
    correctCount,
    incorrectCount,
    unansweredCount,
    totalCount: MOVER_READING_WRITING_TOTAL_QUESTIONS,
    questions
  };
}

// src/server/mover-reading-writing/moverReadingWritingValidation.ts
var nonEmptyText = (value, max = 1e3) => typeof value === "string" && value.trim().length > 0 && value.trim().length <= max;
var unique2 = (values) => values.length === new Set(values).size;
var normalizedWordCount = (value) => value.normalize("NFKC").trim().split(/\s+/).filter(Boolean).length;
var templateText = (value) => value.replace(/\{\{[^}]+\}\}/g, "").trim();
var markerCount = (template, id) => template.split(`{{${id}}}`).length - 1;
function validateTextAnswers(acceptedAnswers, label, errors, maxWords) {
  if (!Array.isArray(acceptedAnswers) || acceptedAnswers.length < 1 || acceptedAnswers.length > 20) {
    errors.push(`${label}: c\u1EA7n t\u1EEB 1 \u0111\u1EBFn 20 \u0111\xE1p \xE1n ch\u1EA5p nh\u1EADn.`);
    return;
  }
  if (acceptedAnswers.some((answer) => !nonEmptyText(answer, 200))) {
    errors.push(`${label}: \u0111\xE1p \xE1n ch\u1EA5p nh\u1EADn kh\xF4ng \u0111\u01B0\u1EE3c \u0111\u1EC3 tr\u1ED1ng v\xE0 t\u1ED1i \u0111a 200 k\xFD t\u1EF1.`);
  }
  if (maxWords && acceptedAnswers.some((answer) => normalizedWordCount(String(answer)) > maxWords)) {
    errors.push(`${label}: m\u1ED7i \u0111\xE1p \xE1n t\u1ED1i \u0111a ${maxWords} t\u1EEB.`);
  }
}
function validateChoiceQuestion(question, label, errors) {
  if (!question || !nonEmptyText(question.id, 160)) {
    errors.push(`${label}: thi\u1EBFu ID c\xE2u h\u1ECFi.`);
    return;
  }
  if (!nonEmptyText(question.prompt, 1e3)) errors.push(`${label}: thi\u1EBFu n\u1ED9i dung c\xE2u h\u1ECFi.`);
  if (!Array.isArray(question.options) || question.options.length !== 3) {
    errors.push(`${label}: c\u1EA7n \u0111\xFAng 3 l\u1EF1a ch\u1ECDn.`);
    return;
  }
  const optionIds = question.options.map((option) => option.id);
  if (!unique2(optionIds) || question.options.some((option) => !nonEmptyText(option.id, 160) || !nonEmptyText(option.text, 500))) {
    errors.push(`${label}: ba l\u1EF1a ch\u1ECDn ph\u1EA3i c\xF3 ID ri\xEAng v\xE0 n\u1ED9i dung \u0111\u1EA7y \u0111\u1EE7.`);
  }
  if (!optionIds.includes(question.correctOptionId)) errors.push(`${label}: \u0111\xE1p \xE1n \u0111\xFAng ph\u1EA3i thu\u1ED9c ba l\u1EF1a ch\u1ECDn.`);
}
function validateMoverReadingWritingContent(input) {
  const errors = [];
  if (!input || !isSupportedMoverReadingWritingSchemaVersion(input.schemaVersion)) {
    return ["Phi\xEAn b\u1EA3n c\u1EA5u tr\xFAc Reading & Writing kh\xF4ng \u0111\u01B0\u1EE3c h\u1ED7 tr\u1EE3."];
  }
  let content;
  try {
    content = normalizeMoverReadingWritingContent(input);
  } catch (error) {
    return [error?.message || "C\u1EA5u tr\xFAc Reading & Writing kh\xF4ng h\u1EE3p l\u1EC7."];
  }
  if (content.moduleId !== "mover" || content.paperId !== MOVER_READING_WRITING_PAPER_ID) {
    errors.push("B\u1ED9 \u0111\u1EC1 ph\u1EA3i thu\u1ED9c Mover / Reading & Writing.");
  }
  if (!nonEmptyText(content.title, 160)) errors.push("Thi\u1EBFu t\xEAn b\u1ED9 \u0111\u1EC1.");
  if (typeof content.description !== "string" || content.description.length > 2e3) errors.push("M\xF4 t\u1EA3 t\u1ED1i \u0111a 2.000 k\xFD t\u1EF1.");
  if (!nonEmptyText(content.level, 80)) errors.push("Thi\u1EBFu tr\xECnh \u0111\u1ED9.");
  if (content.timeLimitMinutes !== void 0 && (!Number.isInteger(content.timeLimitMinutes) || content.timeLimitMinutes < 1 || content.timeLimitMinutes > 300)) {
    errors.push("Gi\u1EDBi h\u1EA1n th\u1EDDi gian ph\u1EA3i t\u1EEB 1 \u0111\u1EBFn 300 ph\xFAt.");
  }
  if (!Array.isArray(content.parts) || content.parts.length !== 6) return [...errors, "Reading & Writing c\u1EA7n \u0111\xFAng 6 Part."];
  content.parts.forEach((part, index) => {
    if (part?.part !== index + 1) errors.push(`Part ${index + 1}: sai th\u1EE9 t\u1EF1 ho\u1EB7c lo\u1EA1i Part.`);
    if (!nonEmptyText(part?.title, 160)) errors.push(`Part ${index + 1}: thi\u1EBFu ti\xEAu \u0111\u1EC1.`);
    if (!nonEmptyText(part?.instruction, 1e3)) errors.push(`Part ${index + 1}: thi\u1EBFu h\u01B0\u1EDBng d\u1EABn.`);
  });
  const part1 = content.parts[0];
  if (!nonEmptyText(part1.wordBankAssetId, 160)) errors.push("Part 1: thi\u1EBFu \u1EA3nh ng\xE2n h\xE0ng t\u1EEB.");
  if (part1.questions?.length !== 6) errors.push("Part 1: c\u1EA7n \u0111\xFAng 6 c\xE2u.");
  if (!unique2((part1.questions || []).map((question) => question.id))) errors.push("Part 1: ID c\xE2u h\u1ECFi b\u1ECB tr\xF9ng.");
  (part1.questions || []).forEach((question, index) => {
    if (!nonEmptyText(question.id, 160) || !nonEmptyText(templateText(question.prompt), 1e3)) errors.push(`Part 1 c\xE2u ${index + 1}: thi\u1EBFu ID ho\u1EB7c n\u1ED9i dung.`);
    if (markerCount(question.prompt, question.id) !== 1 || /\[\[[^\]]+\]\]/.test(question.prompt)) errors.push(`Part 1 c\xE2u ${index + 1}: n\u1ED9i dung ph\u1EA3i c\xF3 \u0111\xFAng m\u1ED9t marker \xF4 tr\u1EA3 l\u1EDDi.`);
    validateTextAnswers(question.acceptedAnswers, `Part 1 c\xE2u ${index + 1}`, errors);
  });
  const part2 = content.parts[1];
  if (!nonEmptyText(part2.sceneAssetId, 160)) errors.push("Part 2: thi\u1EBFu \u1EA3nh t\xECnh hu\u1ED1ng.");
  if (part2.questions?.length !== 6) errors.push("Part 2: c\u1EA7n \u0111\xFAng 6 c\xE2u.");
  if (!unique2((part2.questions || []).map((question) => question.id))) errors.push("Part 2: ID c\xE2u h\u1ECFi b\u1ECB tr\xF9ng.");
  (part2.questions || []).forEach((question, index) => {
    if (!nonEmptyText(question.id, 160) || !nonEmptyText(question.statement, 1e3)) errors.push(`Part 2 c\xE2u ${index + 1}: thi\u1EBFu ID ho\u1EB7c nh\u1EADn \u0111\u1ECBnh.`);
    if (!["yes", "no"].includes(question.correctAnswer)) errors.push(`Part 2 c\xE2u ${index + 1}: \u0111\xE1p \xE1n ph\u1EA3i l\xE0 yes ho\u1EB7c no.`);
  });
  const part3 = content.parts[2];
  if (!nonEmptyText(part3.sceneAssetId, 160)) errors.push("Part 3: thi\u1EBFu \u1EA3nh h\u1ED9i tho\u1EA1i.");
  if (part3.questions?.length !== 6) errors.push("Part 3: c\u1EA7n \u0111\xFAng 6 c\xE2u.");
  if (!unique2((part3.questions || []).map((question) => question.id))) errors.push("Part 3: ID c\xE2u h\u1ECFi b\u1ECB tr\xF9ng.");
  (part3.questions || []).forEach((question, index) => validateChoiceQuestion(question, `Part 3 c\xE2u ${index + 1}`, errors));
  const part4 = content.parts[3];
  if (!nonEmptyText(part4.wordBankAssetId, 160)) errors.push("Part 4: thi\u1EBFu \u1EA3nh ng\xE2n h\xE0ng t\u1EEB.");
  if (!nonEmptyText(part4.storyTemplate, 2e4)) errors.push("Part 4: thi\u1EBFu n\u1ED9i dung c\xE2u chuy\u1EC7n.");
  if (part4.gaps?.length !== 6) errors.push("Part 4: c\u1EA7n \u0111\xFAng 6 ch\u1ED7 tr\u1ED1ng.");
  if (!unique2((part4.gaps || []).map((gap) => gap.id))) errors.push("Part 4: ID ch\u1ED7 tr\u1ED1ng b\u1ECB tr\xF9ng.");
  (part4.gaps || []).forEach((gap, index) => {
    if (!nonEmptyText(gap.id, 160) || !part4.storyTemplate.includes(`{{${gap.id}}}`)) errors.push(`Part 4 ch\u1ED7 tr\u1ED1ng ${index + 1}: n\u1ED9i dung truy\u1EC7n thi\u1EBFu token t\u01B0\u01A1ng \u1EE9ng.`);
    validateTextAnswers(gap.acceptedAnswers, `Part 4 ch\u1ED7 tr\u1ED1ng ${index + 1}`, errors);
  });
  validateChoiceQuestion(part4.titleQuestion, "Part 4 c\xE2u ch\u1ECDn ti\xEAu \u0111\u1EC1", errors);
  const part5 = content.parts[4];
  if (!Array.isArray(part5.scenes) || part5.scenes.length !== 3) errors.push("Part 5: c\u1EA7n \u0111\xFAng 3 nh\xF3m tranh v\xE0 c\xE2u chuy\u1EC7n.");
  const part5Questions = (part5.scenes || []).flatMap((scene) => scene.questions || []);
  if (part5Questions.length !== 10) errors.push("Part 5: ba nh\xF3m c\u1EA7n t\u1ED5ng c\u1ED9ng \u0111\xFAng 10 c\xE2u.");
  if (!unique2(part5Questions.map((question) => question.id))) errors.push("Part 5: ID c\xE2u h\u1ECFi b\u1ECB tr\xF9ng.");
  (part5.scenes || []).forEach((scene, sceneIndex) => {
    if (!nonEmptyText(scene.id, 160) || !nonEmptyText(scene.imageAssetId, 160)) errors.push(`Part 5 tranh ${sceneIndex + 1}: thi\u1EBFu ID ho\u1EB7c \u1EA3nh.`);
    if (!nonEmptyText(scene.passage, 1e4)) errors.push(`Part 5 tranh ${sceneIndex + 1}: thi\u1EBFu n\u1ED9i dung c\xE2u chuy\u1EC7n.`);
    if (!scene.questions?.length) errors.push(`Part 5 tranh ${sceneIndex + 1}: c\u1EA7n \xEDt nh\u1EA5t m\u1ED9t c\xE2u h\u1ECFi.`);
    (scene.questions || []).forEach((question, questionIndex) => {
      if (!nonEmptyText(question.id, 160) || !nonEmptyText(templateText(question.prompt), 1e3)) errors.push(`Part 5 tranh ${sceneIndex + 1}, c\xE2u ${questionIndex + 1}: thi\u1EBFu ID ho\u1EB7c n\u1ED9i dung.`);
      if (markerCount(question.prompt, question.id) !== 1 || /\[\[[^\]]+\]\]/.test(question.prompt)) errors.push(`Part 5 tranh ${sceneIndex + 1}, c\xE2u ${questionIndex + 1}: n\u1ED9i dung ph\u1EA3i c\xF3 \u0111\xFAng m\u1ED9t marker \xF4 tr\u1EA3 l\u1EDDi.`);
      validateTextAnswers(question.acceptedAnswers, `Part 5 tranh ${sceneIndex + 1}, c\xE2u ${questionIndex + 1}`, errors, 3);
    });
  });
  const part6 = content.parts[5];
  if (!nonEmptyText(part6.illustrationAssetId, 160)) errors.push("Part 6: thi\u1EBFu \u1EA3nh b\xE0i \u0111\u1ECDc \u0111\xE3 crop \u0111\u1EC3 hi\u1EC3n th\u1ECB.");
  if (!nonEmptyText(part6.optionsAssetId, 160)) errors.push("Part 6: thi\u1EBFu \u1EA3nh b\u1EA3ng l\u1EF1a ch\u1ECDn.");
  if (!nonEmptyText(part6.passageTitle, 300)) errors.push("Part 6: thi\u1EBFu ti\xEAu \u0111\u1EC1 b\xE0i \u0111\u1ECDc.");
  if (!nonEmptyText(part6.passageTemplate, 2e4)) errors.push("Part 6: thi\u1EBFu n\u1ED9i dung b\xE0i \u0111\u1ECDc.");
  if (/\[\[[^\]]+\]\]/.test(part6.passageTemplate || "")) errors.push("Part 6: b\xE0i \u0111\u1ECDc c\xF2n marker Smart Import ch\u01B0a \u0111\u01B0\u1EE3c chu\u1EA9n h\xF3a.");
  if (part6.gaps?.length !== 5) errors.push("Part 6: c\u1EA7n \u0111\xFAng 5 ch\u1ED7 tr\u1ED1ng.");
  if (!unique2((part6.gaps || []).map((gap) => gap.id))) errors.push("Part 6: ID ch\u1ED7 tr\u1ED1ng b\u1ECB tr\xF9ng.");
  (part6.gaps || []).forEach((gap, index) => {
    if (!nonEmptyText(gap.id, 160)) errors.push(`Part 6 ch\u1ED7 tr\u1ED1ng ${index + 1}: thi\u1EBFu ID.`);
    validateTextAnswers(gap.acceptedAnswers, `Part 6 ch\u1ED7 tr\u1ED1ng ${index + 1}`, errors, 1);
    if (!part6.passageTemplate.includes(`{{${gap.id}}}`)) errors.push(`Part 6 ch\u1ED7 tr\u1ED1ng ${index + 1}: b\xE0i \u0111\u1ECDc thi\u1EBFu token {{${gap.id}}}.`);
  });
  return errors;
}
function sanitizeMoverReadingWritingContentForStudent(content) {
  const clone = normalizeMoverReadingWritingContent(content);
  clone.parts[0].questions.forEach((question) => delete question.acceptedAnswers);
  clone.parts[1].questions.forEach((question) => delete question.correctAnswer);
  clone.parts[2].questions.forEach((question) => delete question.correctOptionId);
  clone.parts[3].gaps.forEach((gap) => delete gap.acceptedAnswers);
  delete clone.parts[3].titleQuestion.correctOptionId;
  clone.parts[4].scenes.forEach((scene) => scene.questions.forEach((question) => delete question.acceptedAnswers));
  delete clone.parts[5].passageSourceAssetId;
  delete clone.parts[5].passageSourceUrl;
  clone.parts[5].gaps.forEach((gap) => delete gap.acceptedAnswers);
  return clone;
}
var safeAnswer = (value) => typeof value === "string" ? value.normalize("NFKC").slice(0, 300) : "";
function sanitizeMoverReadingWritingAnswers(inputContent, input) {
  const content = normalizeMoverReadingWritingContent(inputContent);
  const raw = input && typeof input === "object" ? input : {};
  const answers = {
    part1: {},
    part2: {},
    part3: {},
    part4: { gaps: {}, titleOptionId: "" },
    part5: {},
    part6: {}
  };
  content.parts[0].questions.forEach((question) => {
    answers.part1[question.id] = safeAnswer(raw.part1?.[question.id]);
  });
  content.parts[1].questions.forEach((question) => {
    const value = safeAnswer(raw.part2?.[question.id]).toLowerCase();
    answers.part2[question.id] = value === "yes" || value === "no" ? value : "";
  });
  content.parts[2].questions.forEach((question) => {
    const value = safeAnswer(raw.part3?.[question.id]);
    answers.part3[question.id] = question.options.some((option) => option.id === value) ? value : "";
  });
  content.parts[3].gaps.forEach((gap) => {
    answers.part4.gaps[gap.id] = safeAnswer(raw.part4?.gaps?.[gap.id]);
  });
  const titleOptionId = safeAnswer(raw.part4?.titleOptionId);
  answers.part4.titleOptionId = content.parts[3].titleQuestion.options.some((option) => option.id === titleOptionId) ? titleOptionId : "";
  content.parts[4].scenes.forEach((scene) => scene.questions.forEach((question) => {
    answers.part5[question.id] = safeAnswer(raw.part5?.[question.id]);
  }));
  content.parts[5].gaps.forEach((gap) => {
    answers.part6[gap.id] = safeAnswer(raw.part6?.[gap.id]);
  });
  return answers;
}

// src/server/mover-reading-writing/moverReadingWritingSmartImportService.ts
var import_node_crypto6 = __toESM(require("node:crypto"), 1);

// src/features/mover-reading-writing/smart-import/contracts.ts
var schemaId = (part) => `mover-rw-part${part}-external-v${part === 1 || part === 5 || part === 6 ? 2 : 1}`;
var isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
var cleanText2 = (value, max = 2e4) => typeof value === "string" ? value.normalize("NFKC").replace(/\r\n?/g, "\n").trim().slice(0, max) : "";
function fail(message) {
  const error = new Error(message);
  error.status = 400;
  throw error;
}
function objectAt(value, label) {
  if (!isObject(value)) fail(`${label} ph\u1EA3i l\xE0 object JSON.`);
  return value;
}
function assertKeys(value, allowed, label) {
  const extras = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extras.length) fail(`${label} c\xF3 tr\u01B0\u1EDDng kh\xF4ng \u0111\u01B0\u1EE3c h\u1ED7 tr\u1EE3: ${extras.join(", ")}.`);
  if (Object.keys(value).some((key) => /(^id$|Id$|uuid|database|technical)/i.test(key))) {
    fail(`${label} kh\xF4ng \u0111\u01B0\u1EE3c ch\u1EE9a ID k\u1EF9 thu\u1EADt.`);
  }
}
function arrayAt(value, label) {
  if (!Array.isArray(value)) fail(`${label} ph\u1EA3i l\xE0 m\u1EA3ng JSON.`);
  return value;
}
function exactNumbered(rows, count, label) {
  const numbers = rows.map((row) => row.questionNumber);
  const expected = Array.from({ length: count }, (_, index) => index + 1);
  if (numbers.length !== count || numbers.some((number2) => !Number.isInteger(number2)) || new Set(numbers).size !== count) {
    fail(`${label} ph\u1EA3i c\xF3 \u0111\xFAng ${count} s\u1ED1 th\u1EE9 t\u1EF1 kh\xF4ng tr\xF9ng.`);
  }
  if (expected.some((number2) => !numbers.includes(number2))) fail(`${label} ph\u1EA3i \u0111\xE1nh s\u1ED1 li\xEAn t\u1EE5c t\u1EEB 1 \u0111\u1EBFn ${count}.`);
  return [...rows].sort((first, second) => first.questionNumber - second.questionNumber);
}
function answersAt(value, label, warnings, maxWords) {
  const rows = arrayAt(value, label).slice(0, 20).map((answer) => cleanText2(answer, 200)).filter(Boolean);
  const answers = [...new Set(rows)];
  if (!answers.length) warnings.push(`${label}: ch\u01B0a \u0111\u1ECDc \u0111\u01B0\u1EE3c \u0111\xE1p \xE1n; d\u1EEF li\u1EC7u hi\u1EC7n c\xF3 s\u1EBD \u0111\u01B0\u1EE3c gi\u1EEF nguy\xEAn.`);
  if (maxWords && answers.some((answer) => answer.split(/\s+/).filter(Boolean).length > maxWords)) {
    fail(`${label}: m\u1ED7i \u0111\xE1p \xE1n t\u1ED1i \u0111a ${maxWords} t\u1EEB.`);
  }
  return answers;
}
function exampleAt(value, label, warnings) {
  if (value === void 0 || value === null) return void 0;
  const row = objectAt(value, label);
  assertKeys(row, ["prompt", "answer"], label);
  const prompt = cleanText2(row.prompt, 1e3);
  const answer = cleanText2(row.answer, 200);
  if (!prompt && !answer) return void 0;
  if (!prompt || !answer) warnings.push(`${label}: v\xED d\u1EE5 ch\u01B0a \u0111\u1EE7 c\xE2u d\u1EABn v\xE0 \u0111\xE1p \xE1n.`);
  return { prompt, answer };
}
function textQuestionAt(value, label, warnings, maxWords) {
  const row = objectAt(value, label);
  assertKeys(row, ["questionNumber", "promptTemplate", "acceptedAnswers"], label);
  const questionNumber2 = Number(row.questionNumber);
  const promptTemplate = cleanText2(row.promptTemplate, 1e3);
  if (!promptTemplate) warnings.push(`${label}: ch\u01B0a \u0111\u1ECDc \u0111\u01B0\u1EE3c n\u1ED9i dung; d\u1EEF li\u1EC7u hi\u1EC7n c\xF3 s\u1EBD \u0111\u01B0\u1EE3c gi\u1EEF nguy\xEAn.`);
  else validateQuestionMarker(promptTemplate, questionNumber2, `${label} promptTemplate`);
  return {
    questionNumber: questionNumber2,
    promptTemplate,
    acceptedAnswers: answersAt(row.acceptedAnswers, `${label} \u0111\xE1p \xE1n`, warnings, maxWords)
  };
}
function normalizeCorrectOption(value, label, warnings) {
  const answer = cleanText2(value, 20).toUpperCase();
  if (answer === "A" || answer === "B" || answer === "C") return answer;
  warnings.push(`${label}: ch\u01B0a c\xF3 \u0111\xE1p \xE1n A/B/C r\xF5 r\xE0ng; \u0111\xE1p \xE1n hi\u1EC7n c\xF3 s\u1EBD \u0111\u01B0\u1EE3c gi\u1EEF nguy\xEAn.`);
  return void 0;
}
function choiceQuestionAt(value, label, warnings, withNumber) {
  const row = objectAt(value, label);
  const allowed = ["prompt", "promptSpeaker", "answerSpeaker", "options", "correctOption"];
  if (withNumber) allowed.unshift("questionNumber");
  assertKeys(row, allowed, label);
  const rawOptions = arrayAt(row.options, `${label} l\u1EF1a ch\u1ECDn`);
  if (rawOptions.length !== 3) fail(`${label} ph\u1EA3i c\xF3 \u0111\xFAng ba l\u1EF1a ch\u1ECDn A/B/C.`);
  const options = rawOptions.map((option) => cleanText2(option, 500));
  if (options.some((option) => !option)) warnings.push(`${label}: c\xF3 l\u1EF1a ch\u1ECDn ch\u01B0a \u0111\u1ECDc \u0111\u01B0\u1EE3c; n\u1ED9i dung hi\u1EC7n c\xF3 s\u1EBD \u0111\u01B0\u1EE3c gi\u1EEF nguy\xEAn.`);
  const result = {
    prompt: cleanText2(row.prompt, 1e3),
    ...cleanText2(row.promptSpeaker, 120) ? { promptSpeaker: cleanText2(row.promptSpeaker, 120) } : {},
    ...cleanText2(row.answerSpeaker, 120) ? { answerSpeaker: cleanText2(row.answerSpeaker, 120) } : {},
    options,
    correctOption: normalizeCorrectOption(row.correctOption, label, warnings)
  };
  if (!result.prompt) warnings.push(`${label}: ch\u01B0a \u0111\u1ECDc \u0111\u01B0\u1EE3c c\xE2u d\u1EABn; n\u1ED9i dung hi\u1EC7n c\xF3 s\u1EBD \u0111\u01B0\u1EE3c gi\u1EEF nguy\xEAn.`);
  return withNumber ? { ...result, questionNumber: Number(row.questionNumber) } : result;
}
function textGapAt(value, label, warnings) {
  const row = objectAt(value, label);
  assertKeys(row, ["gapNumber", "acceptedAnswers"], label);
  return {
    gapNumber: Number(row.gapNumber),
    acceptedAnswers: answersAt(row.acceptedAnswers, `${label} \u0111\xE1p \xE1n`, warnings, 1)
  };
}
function validateQuestionMarker(template, number2, label) {
  const markers = [...template.matchAll(/\[\[([^\]]+)\]\]/g)].map((match) => match[1].trim());
  if (markers.length !== 1 || markers[0] !== String(number2)) {
    fail(`${label} ph\u1EA3i ch\u1EE9a \u0111\xFAng m\u1ED9t marker [[${number2}]].`);
  }
}
function validateMarkers(template, count, label) {
  const allMarkers = [...template.matchAll(/\[\[([^\]]+)\]\]/g)].map((match) => match[1].trim());
  const found = [...template.matchAll(/\[\[(\d+)\]\]/g)].map((match) => Number(match[1]));
  const expected = Array.from({ length: count }, (_, index) => index + 1);
  if (allMarkers.length !== found.length || found.length !== count || new Set(found).size !== count || expected.some((number2) => !found.includes(number2))) fail(`${label} ph\u1EA3i ch\u1EE9a \u0111\xFAng m\u1ED9t l\u1EA7n c\xE1c marker [[1]] \u0111\u1EBFn [[${count}]].`);
}
function rootAt(part, value, allowed) {
  const root = objectAt(value, `JSON Part ${part}`);
  assertKeys(root, ["schema", "part", ...allowed], `JSON Part ${part}`);
  if (root.schema !== schemaId(part)) fail(`schema ph\u1EA3i l\xE0 "${schemaId(part)}".`);
  if (Number(root.part) !== part) fail(`D\u1EEF li\u1EC7u kh\xF4ng thu\u1ED9c Part ${part}.`);
  return root;
}
function validateAndNormalizeMoverReadingWritingImport(part, value) {
  const warnings = [];
  if (part === 1) {
    const root2 = rootAt(part, value, ["title", "instruction", "example", "questions"]);
    const questions = exactNumbered(
      arrayAt(root2.questions, "Part 1 questions").map((row, index) => textQuestionAt(row, `Part 1 c\xE2u ${index + 1}`, warnings)),
      6,
      "Part 1 questions"
    );
    return { data: { part, title: cleanText2(root2.title, 160), instruction: cleanText2(root2.instruction, 1e3), example: exampleAt(root2.example, "Part 1 example", warnings), questions }, warnings };
  }
  if (part === 2) {
    const root2 = rootAt(part, value, ["title", "instruction", "examples", "questions"]);
    const examples = arrayAt(root2.examples, "Part 2 examples").slice(0, 4).flatMap((value2, index) => {
      const row = objectAt(value2, `Part 2 example ${index + 1}`);
      assertKeys(row, ["prompt", "answer"], `Part 2 example ${index + 1}`);
      const prompt = cleanText2(row.prompt, 1e3);
      const answerText = cleanText2(row.answer, 20).toLowerCase();
      const answer = answerText === "yes" || answerText === "no" ? answerText : void 0;
      if (!prompt) return [];
      if (!answer) warnings.push(`Part 2 example ${index + 1}: ch\u01B0a \u0111\u1ECDc \u0111\u01B0\u1EE3c \u0111\xE1p \xE1n Yes/No.`);
      return [{ prompt, answer }];
    });
    const questions = exactNumbered(arrayAt(root2.questions, "Part 2 questions").map((value2, index) => {
      const row = objectAt(value2, `Part 2 c\xE2u ${index + 1}`);
      assertKeys(row, ["questionNumber", "statement", "correctAnswer"], `Part 2 c\xE2u ${index + 1}`);
      const answerText = cleanText2(row.correctAnswer, 20).toLowerCase();
      const correctAnswer = answerText === "yes" || answerText === "no" ? answerText : void 0;
      if (!correctAnswer) warnings.push(`Part 2 c\xE2u ${index + 1}: ch\u01B0a c\xF3 \u0111\xE1p \xE1n Yes/No r\xF5 r\xE0ng.`);
      const statement = cleanText2(row.statement, 1e3);
      if (!statement) warnings.push(`Part 2 c\xE2u ${index + 1}: ch\u01B0a \u0111\u1ECDc \u0111\u01B0\u1EE3c nh\u1EADn \u0111\u1ECBnh.`);
      return { questionNumber: Number(row.questionNumber), statement, correctAnswer };
    }), 6, "Part 2 questions");
    return { data: { part, title: cleanText2(root2.title, 160), instruction: cleanText2(root2.instruction, 1e3), examples, questions }, warnings };
  }
  if (part === 3) {
    const root2 = rootAt(part, value, ["title", "instruction", "example", "questions"]);
    const example = root2.example ? choiceQuestionAt(root2.example, "Part 3 example", warnings, false) : void 0;
    const questions = exactNumbered(
      arrayAt(root2.questions, "Part 3 questions").map((row, index) => choiceQuestionAt(row, `Part 3 c\xE2u ${index + 1}`, warnings, true)),
      6,
      "Part 3 questions"
    );
    return { data: { part, title: cleanText2(root2.title, 160), instruction: cleanText2(root2.instruction, 1e3), example, questions }, warnings };
  }
  if (part === 4) {
    const root2 = rootAt(part, value, ["title", "instruction", "storyTemplate", "example", "gaps", "titleQuestion"]);
    const storyTemplate = cleanText2(root2.storyTemplate);
    validateMarkers(storyTemplate, 6, "Part 4 storyTemplate");
    const gaps2 = arrayAt(root2.gaps, "Part 4 gaps").map((value2, index) => {
      const row = objectAt(value2, `Part 4 gap ${index + 1}`);
      assertKeys(row, ["gapNumber", "acceptedAnswers"], `Part 4 gap ${index + 1}`);
      return { gapNumber: Number(row.gapNumber), acceptedAnswers: answersAt(row.acceptedAnswers, `Part 4 gap ${index + 1}`, warnings) };
    });
    exactNumbered(gaps2.map((row) => ({ ...row, questionNumber: row.gapNumber })), 6, "Part 4 gaps");
    const titleQuestion = choiceQuestionAt(root2.titleQuestion, "Part 4 c\xE2u 7", warnings, false);
    return { data: { part, title: cleanText2(root2.title, 160), instruction: cleanText2(root2.instruction, 1e3), storyTemplate, example: exampleAt(root2.example, "Part 4 example", warnings), gaps: gaps2.sort((a, b) => a.gapNumber - b.gapNumber), titleQuestion }, warnings };
  }
  if (part === 5) {
    const root2 = rootAt(part, value, ["title", "instruction", "example", "scenes"]);
    const scenes = arrayAt(root2.scenes, "Part 5 scenes").map((value2, sceneIndex) => {
      const row = objectAt(value2, `Part 5 scene ${sceneIndex + 1}`);
      assertKeys(row, ["sceneNumber", "passage", "questions"], `Part 5 scene ${sceneIndex + 1}`);
      return {
        sceneNumber: Number(row.sceneNumber),
        passage: cleanText2(row.passage, 1e4),
        questions: arrayAt(row.questions, `Part 5 scene ${sceneIndex + 1} questions`).map((question, index) => textQuestionAt(question, `Part 5 c\xE2u ${index + 1}`, warnings, 3))
      };
    });
    if (scenes.length !== 3 || new Set(scenes.map((scene) => scene.sceneNumber)).size !== 3 || [1, 2, 3].some((number2) => !scenes.some((scene) => scene.sceneNumber === number2))) {
      fail("Part 5 ph\u1EA3i c\xF3 \u0111\xFAng ba scene \u0111\xE1nh s\u1ED1 1, 2, 3.");
    }
    const allQuestions = scenes.flatMap((scene) => scene.questions);
    exactNumbered(allQuestions, 10, "Part 5 questions");
    scenes.forEach((scene) => {
      scene.questions.sort((first, second) => first.questionNumber - second.questionNumber);
      if (!scene.passage) warnings.push(`Part 5 scene ${scene.sceneNumber}: ch\u01B0a \u0111\u1ECDc \u0111\u01B0\u1EE3c n\u1ED9i dung truy\u1EC7n.`);
      if (!scene.questions.length) fail(`Part 5 scene ${scene.sceneNumber} ph\u1EA3i c\xF3 \xEDt nh\u1EA5t m\u1ED9t c\xE2u.`);
    });
    return { data: { part, title: cleanText2(root2.title, 160), instruction: cleanText2(root2.instruction, 1e3), example: exampleAt(root2.example, "Part 5 example", warnings), scenes: scenes.sort((a, b) => a.sceneNumber - b.sceneNumber) }, warnings };
  }
  const root = rootAt(part, value, ["title", "instruction", "passageTitle", "passageTemplate", "example", "gaps"]);
  const passageTemplate = cleanText2(root.passageTemplate);
  validateMarkers(passageTemplate, 5, "Part 6 passageTemplate");
  const gaps = arrayAt(root.gaps, "Part 6 gaps").map((row, index) => textGapAt(row, `Part 6 gap ${index + 1}`, warnings));
  exactNumbered(
    gaps.map((row) => ({ ...row, questionNumber: row.gapNumber })),
    5,
    "Part 6 gaps"
  );
  gaps.sort((first, second) => first.gapNumber - second.gapNumber);
  const passageTitle = cleanText2(root.passageTitle, 300);
  if (!passageTitle) warnings.push("Part 6: ch\u01B0a \u0111\u1ECDc \u0111\u01B0\u1EE3c ti\xEAu \u0111\u1EC1 b\xE0i \u0111\u1ECDc.");
  return { data: { part, title: cleanText2(root.title, 160), instruction: cleanText2(root.instruction, 1e3), passageTitle, passageTemplate, example: exampleAt(root.example, "Part 6 example", warnings), gaps }, warnings };
}
var choice = (questionNumber2, prompt = "") => ({ questionNumber: questionNumber2, prompt, promptSpeaker: "", answerSpeaker: "", options: ["A", "B", "C"], correctOption: "A" });
var textQuestion = (questionNumber2) => ({ questionNumber: questionNumber2, promptTemplate: `Question text [[${questionNumber2}]]`, acceptedAnswers: [""] });
var templates = {
  1: { schema: schemaId(1), part: 1, title: "Part 1", instruction: "Look and read...", example: { prompt: "", answer: "" }, questions: Array.from({ length: 6 }, (_, index) => textQuestion(index + 1)) },
  2: { schema: schemaId(2), part: 2, title: "Part 2", instruction: "Look and read. Write yes or no.", examples: [{ prompt: "", answer: "yes" }], questions: Array.from({ length: 6 }, (_, index) => ({ questionNumber: index + 1, statement: "", correctAnswer: "yes" })) },
  3: { schema: schemaId(3), part: 3, title: "Part 3", instruction: "Read the text and choose the best answer.", example: { prompt: "", promptSpeaker: "", answerSpeaker: "", options: ["A", "B", "C"], correctOption: "A" }, questions: Array.from({ length: 6 }, (_, index) => choice(index + 1)) },
  4: { schema: schemaId(4), part: 4, title: "Part 4", instruction: "Read the story...", storyTemplate: "Text [[1]] text [[2]] text [[3]] text [[4]] text [[5]] text [[6]].", example: { prompt: "", answer: "" }, gaps: Array.from({ length: 6 }, (_, index) => ({ gapNumber: index + 1, acceptedAnswers: [""] })), titleQuestion: { prompt: "Choose the best name for the story.", promptSpeaker: "", answerSpeaker: "", options: ["A", "B", "C"], correctOption: "A" } },
  5: { schema: schemaId(5), part: 5, title: "Part 5", instruction: "Look at the pictures and read the story...", example: { prompt: "", answer: "" }, scenes: [
    { sceneNumber: 1, passage: "", questions: [1, 2, 3].map(textQuestion) },
    { sceneNumber: 2, passage: "", questions: [4, 5, 6, 7].map(textQuestion) },
    { sceneNumber: 3, passage: "", questions: [8, 9, 10].map(textQuestion) }
  ] },
  6: { schema: schemaId(6), part: 6, title: "Part 6", instruction: "Read the text. Choose the right words...", passageTitle: "", passageTemplate: "Text [[1]] text [[2]] text [[3]] text [[4]] text [[5]].", example: { prompt: "", answer: "" }, gaps: Array.from({ length: 5 }, (_, index) => ({ gapNumber: index + 1, acceptedAnswers: ["and"] })) }
};
var moverReadingWritingExternalTemplate = (part) => JSON.stringify(templates[part], null, 2);
var moverReadingWritingExternalHelp = {
  1: "\u0110\u1ECDc \u1EA3nh ng\xE2n h\xE0ng t\u1EEB, s\xE1u c\xE2u m\xF4 t\u1EA3 v\xE0 answer key. M\u1ED7i promptTemplate ph\u1EA3i ch\u1EE9a \u0111\xFAng marker [[questionNumber]] t\u1EA1i v\u1ECB tr\xED h\u1ECDc sinh vi\u1EBFt \u0111\xE1p \xE1n; acceptedAnswers ch\u1EC9 l\u1EA5y t\u1EEB ngu\u1ED3n \u0111\xE1p \xE1n ch\xEDnh th\u1EE9c.",
  2: "\u0110\u1ECDc c\xE1c v\xED d\u1EE5, \u0111\xFAng s\xE1u nh\u1EADn \u0111\u1ECBnh v\xE0 \u0111\xE1p \xE1n yes/no theo s\u1ED1 c\xE2u.",
  3: "\u0110\u1ECDc v\xED d\u1EE5 v\xE0 \u0111\xFAng s\xE1u l\u01B0\u1EE3t h\u1ED9i tho\u1EA1i, m\u1ED7i c\xE2u ba l\u1EF1a ch\u1ECDn A/B/C; \u0111\xE1p \xE1n \u0111\xFAng ch\u1EC9 l\u1EA5y t\u1EEB answer key.",
  4: "D\xF9ng marker [[1]]\u2026[[6]] \u0111\xFAng m\u1ED9t l\u1EA7n trong truy\u1EC7n, s\xE1u \u0111\xE1p \xE1n v\xE0 m\u1ED9t c\xE2u ch\u1ECDn ti\xEAu \u0111\u1EC1.",
  5: "\u0110\u1ECDc ba scene theo th\u1EE9 t\u1EF1, t\u1ED5ng \u0111\xFAng m\u01B0\u1EDDi c\xE2u. M\u1ED7i promptTemplate ph\u1EA3i ch\u1EE9a \u0111\xFAng marker [[questionNumber]] t\u1EA1i v\u1ECB tr\xED h\u1ECDc sinh vi\u1EBFt \u0111\xE1p \xE1n; m\u1ED7i acceptedAnswers kh\xF4ng qu\xE1 ba t\u1EEB.",
  6: "D\xF9ng marker [[1]]\u2026[[5]] \u0111\xFAng m\u1ED9t l\u1EA7n trong b\xE0i \u0111\u1ECDc; kh\xF4ng \u0111\u01B0a d\xF2ng Example v\xE0o passageTemplate. M\u1ED7i gap ch\u1EC9 tr\u1EA3 gapNumber v\xE0 acceptedAnswers l\u1EA5y nguy\xEAn v\u0103n t\u1EEB answer key, t\u1ED1i \u0111a m\u1ED9t t\u1EEB; kh\xF4ng tr\u1EA3 A/B/C ho\u1EB7c t\u1EF1 gi\u1EA3i t\u1EEB b\u1EA3ng l\u1EF1a ch\u1ECDn."
};
function schemaFromTemplate(value) {
  if (Array.isArray(value)) return { type: "array", items: schemaFromTemplate(value[0] ?? ""), maxItems: 20 };
  if (isObject(value)) {
    const properties = Object.fromEntries(Object.entries(value).map(([key, child]) => [key, schemaFromTemplate(child)]));
    return { type: "object", properties, required: Object.keys(properties), additionalProperties: false };
  }
  if (typeof value === "number") return { type: "number" };
  return { type: "string", maxLength: 2e4 };
}
var moverReadingWritingImportResponseSchema = (part) => schemaFromTemplate(templates[part]);
var moverReadingWritingImportSchemaName = (part) => `mover_rw_part_${part}_v${part === 1 || part === 5 || part === 6 ? 2 : 1}`;

// src/server/mover-reading-writing/moverReadingWritingSmartImportService.ts
var parseJson5 = (source) => {
  const trimmed = source.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1]?.trim() || trimmed;
  return JSON.parse(fenced);
};
function promptForPart(part) {
  return [
    `Extract Cambridge Movers Reading & Writing Part ${part} from the role-labelled images.`,
    "The answer_key image is the only authority for correct answers. Never solve the exercise and never infer a missing answer.",
    "Read question/order/text from the question, scene, story, passage or options roles. Preserve spelling, punctuation and printed numbering.",
    'If text is unreadable use an empty string or empty acceptedAnswers array. If a correct answer is unreadable use "unknown".',
    "Do not output UUIDs, database IDs, question IDs, choice IDs, option IDs or gap IDs.",
    moverReadingWritingExternalHelp[part],
    "Return exactly one JSON value using this structural example:",
    moverReadingWritingExternalTemplate(part)
  ].join("\n\n");
}
function boundedProviderDetails(reason) {
  const message = reason instanceof Error ? reason.message : String(reason || "Provider response kh\xF4ng h\u1EE3p l\u1EC7.");
  return message.replace(/(?:sk|key|token)[-_a-z0-9]{8,}/gi, "[redacted]").slice(0, 500);
}
function providerRequestError(reason) {
  const status = Number(reason?.status);
  const details = (Array.isArray(reason?.details) ? reason.details : []).map((detail) => boundedProviderDetails(detail)).filter(Boolean).slice(0, 4);
  const error = new Error(boundedProviderDetails(reason));
  error.status = status >= 400 && status <= 599 ? status : 502;
  if (details.length) error.details = details;
  if (typeof reason?.code === "string") error.code = reason.code.slice(0, 80);
  return error;
}
async function createMoverReadingWritingSmartImportCandidate(input) {
  const requestId = import_node_crypto6.default.randomUUID();
  let lastError = "";
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const correction = attempt === 1 ? "" : [
      "",
      "Your previous response failed runtime validation.",
      `Validation error: ${lastError}`,
      "Return a corrected complete JSON value only. Do not explain the correction."
    ].join("\n");
    let result;
    try {
      result = await input.analyzeVision(
        `${promptForPart(input.part)}${correction}`,
        input.images,
        {
          preferredProvider: input.preferredProvider,
          responseJsonSchema: moverReadingWritingImportResponseSchema(input.part),
          schemaName: moverReadingWritingImportSchemaName(input.part),
          requestId,
          attempt
        },
        input.signal
      );
    } catch (reason) {
      if (reason?.name === "AbortError" || input.signal?.aborted) throw reason;
      throw providerRequestError(reason);
    }
    try {
      const normalized = validateAndNormalizeMoverReadingWritingImport(input.part, parseJson5(result.text));
      const providerWarnings = Array.isArray(result.errors) ? result.errors.map((error) => String(error).slice(0, 300)).filter(Boolean) : [];
      return {
        id: `mrw-import-${import_node_crypto6.default.randomUUID()}`,
        moduleId: "mover",
        paperId: "reading-writing",
        part: input.part,
        basePartHash: input.basePartHash,
        provider: result.provider,
        warnings: [
          ...normalized.warnings,
          ...providerWarnings,
          ...attempt > 1 ? ["Nh\xE0 cung c\u1EA5p \u0111\xE3 tr\u1EA3 c\u1EA5u tr\xFAc h\u1EE3p l\u1EC7 sau m\u1ED9t l\u1EA7n s\u1EEDa JSON t\u1EF1 \u0111\u1ED9ng."] : []
        ],
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        data: normalized.data
      };
    } catch (reason) {
      if (reason?.name === "AbortError" || input.signal?.aborted) throw reason;
      lastError = boundedProviderDetails(reason);
      if (attempt === 2) {
        const error = new Error("AI ch\u01B0a tr\u1EA3 d\u1EEF li\u1EC7u Reading & Writing \u0111\xFAng c\u1EA5u tr\xFAc sau m\u1ED9t l\u1EA7n s\u1EEDa. B\u1EA3n nh\xE1p ch\u01B0a b\u1ECB thay \u0111\u1ED5i.");
        error.status = 502;
        error.details = [lastError];
        throw error;
      }
    }
  }
  throw new Error("Kh\xF4ng th\u1EC3 t\u1EA1o d\u1EEF li\u1EC7u Smart Import.");
}

// src/server/mover-reading-writing/moverReadingWritingRouter.ts
var SMART_IMPORT_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
var SMART_IMPORT_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
var SMART_IMPORT_TOTAL_MAX_BYTES = 30 * 1024 * 1024;
var SMART_IMPORT_TIMEOUT_MS2 = Math.min(
  18e4,
  Math.max(15e3, Number(process.env.LISTENING_SMART_IMPORT_TIMEOUT_MS) || 18e4)
);
function hasValidImageMagic(buffer, mimeType) {
  if (mimeType === "image/jpeg") return buffer.length >= 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255;
  if (mimeType === "image/png") return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mimeType === "image/webp") return buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  return false;
}
var text2 = (value, max = 500) => String(value ?? "").trim().slice(0, max);
var nowIso3 = () => (/* @__PURE__ */ new Date()).toISOString();
var identifier2 = (prefix) => `${prefix}-${import_crypto2.default.randomUUID()}`;
var sha2562 = (value) => import_crypto2.default.createHash("sha256").update(value).digest("hex");
var timingSafeEqual2 = (first, second) => {
  const a = Buffer.from(first);
  const b = Buffer.from(second);
  return a.length === b.length && import_crypto2.default.timingSafeEqual(a, b);
};
function apiError2(status, message, details) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}
function sendError2(res, error) {
  res.status(Number(error?.status || 500)).json({
    error: error?.message || "Kh\xF4ng th\u1EC3 x\u1EED l\xFD y\xEAu c\u1EA7u Mover Reading & Writing.",
    ...error?.details ? { details: error.details } : {}
  });
}
var isSuperAdmin2 = (user) => user?.role === "super_admin";
var canManageSet2 = (user, set) => isSuperAdmin2(user) || user?.role === "teacher" && set?.ownerId === user.id;
function publicSetSummary2(set) {
  const {
    draftContent: _draftContent,
    draftRevision: _draftRevision,
    validationErrors: _validationErrors,
    shareToken: _shareToken,
    assignmentSlug: _assignmentSlug,
    ...summary
  } = set || {};
  return summary;
}
function encodeTicket2(payload, secret) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = import_crypto2.default.createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}
function decodeTicket2(ticket, secret) {
  const [encoded, signature, extra] = String(ticket || "").split(".");
  if (!encoded || !signature || extra) throw apiError2(401, "Phi\u1EBFu l\xE0m b\xE0i kh\xF4ng h\u1EE3p l\u1EC7.");
  const expected = import_crypto2.default.createHmac("sha256", secret).update(encoded).digest("base64url");
  if (!timingSafeEqual2(signature, expected)) throw apiError2(401, "Phi\u1EBFu l\xE0m b\xE0i kh\xF4ng h\u1EE3p l\u1EC7.");
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (Number(payload.ticketExpiresAt || 0) < Date.now()) throw apiError2(410, "Phi\u1EBFu l\xE0m b\xE0i \u0111\xE3 h\u1EBFt h\u1EA1n.");
    return payload;
  } catch (error) {
    if (error?.status) throw error;
    throw apiError2(401, "Phi\u1EBFu l\xE0m b\xE0i kh\xF4ng h\u1EE3p l\u1EC7.");
  }
}
async function getSet2(db, id) {
  const document = await db.collection("mover_reading_sets").doc(id).get();
  if (!document.exists) return null;
  const set = { id: document.id, ...document.data() };
  if (set.draftContent && isSupportedMoverReadingWritingSchemaVersion(set.draftContent.schemaVersion)) {
    set.draftContent = normalizeMoverReadingWritingContent(set.draftContent);
  }
  return set;
}
async function getVersion2(db, id) {
  const document = await db.collection("mover_reading_set_versions").doc(id).get();
  if (!document.exists) return null;
  const version = { id: document.id, ...document.data() };
  if (version.content && isSupportedMoverReadingWritingSchemaVersion(version.content.schemaVersion)) {
    version.content = normalizeMoverReadingWritingContent(version.content);
  }
  return version;
}
async function getAssignmentByToken2(db, token) {
  if (!token) return null;
  const snapshot = await db.collection("assignments").where("shareToken", "==", token).get();
  let match = null;
  snapshot.forEach((document) => {
    const data = { id: document.id, ...document.data() };
    if (!match && (data.shareToken === token || data.assignmentSlug === token)) match = data;
  });
  return match;
}
async function resolveLearningAccess2(db, set, req) {
  if (!set || set.status !== "published" || !set.publishedVersionId) {
    throw apiError2(404, "B\u1ED9 \u0111\u1EC1 Reading & Writing ch\u01B0a \u0111\u01B0\u1EE3c xu\u1EA5t b\u1EA3n.");
  }
  if (req.user?.role === "super_admin" || canManageSet2(req.user, set)) return { assignment: null };
  if (set.visibility === "public") return { assignment: null };
  const token = text2(
    req.body?.shareToken || req.body?.accessToken || req.query?.shareToken || req.query?.accessToken || req.headers["x-mover-reading-share-token"],
    240
  );
  if (token && set.shareToken && timingSafeEqual2(token, String(set.shareToken))) return { assignment: null };
  const assignment = await getAssignmentByToken2(db, token);
  const resourceId = assignment?.resourceId || assignment?.moverReadingWritingSetId;
  if (assignment?.resourceType === "mover_reading_writing" && resourceId === set.id) return { assignment };
  throw apiError2(403, "Link b\u1ED9 \u0111\u1EC1 Reading & Writing kh\xF4ng h\u1EE3p l\u1EC7 ho\u1EB7c \u0111\xE3 h\u1EBFt quy\u1EC1n truy c\u1EADp.");
}
async function resolveActor2(req, resolveGuestProfile2, classInfo = {}) {
  if (req.authBlocked) throw apiError2(403, "T\xE0i kho\u1EA3n \u0111\xE3 b\u1ECB kh\xF3a.");
  if (req.user) {
    return {
      ownerKey: `user:${req.user.id}`,
      userId: req.user.id,
      guestId: "",
      studentName: req.user.name || "H\u1ECDc sinh"
    };
  }
  const guestId = text2(req.body?.guestId || req.query?.guestId || req.headers["x-guest-id"], 120);
  const studentName = text2(req.body?.studentName || req.query?.studentName, 120);
  if (!guestId || !studentName) throw apiError2(401, "Vui l\xF2ng nh\u1EADp t\xEAn h\u1ECDc sinh tr\u01B0\u1EDBc khi l\xE0m b\xE0i.");
  const profile = await resolveGuestProfile2(guestId, studentName, true, classInfo);
  return {
    ownerKey: `guest:${guestId}`,
    userId: "",
    guestId,
    studentName: profile.displayName || profile.name || studentName
  };
}
function collectAssetReferences2(content) {
  const references = [];
  const add = (id, entityId, role) => {
    const assetId = text2(id, 160);
    if (assetId) references.push({ id: assetId, entityId, role });
  };
  add(content.coverAssetId, "set", "cover");
  add(content.parts[0].wordBankAssetId, "part-1", "word-bank");
  add(content.parts[1].sceneAssetId, "part-2", "scene");
  add(content.parts[2].sceneAssetId, "part-3", "scene");
  add(content.parts[3].wordBankAssetId, "part-4", "word-bank");
  content.parts[4].scenes.forEach((scene, index) => add(scene.imageAssetId, scene.id || `part-5-scene-${index + 1}`, "scene"));
  add(content.parts[5].passageSourceAssetId, "part-6-source", "passage-source");
  add(content.parts[5].illustrationAssetId, "part-6", "illustration");
  add(content.parts[5].optionsAssetId, "part-6-options", "options");
  return references;
}
async function resolveContentAssets2(db, content, user) {
  const clone = structuredClone(content);
  const references = collectAssetReferences2(clone);
  const assets = /* @__PURE__ */ new Map();
  await Promise.all([...new Set(references.map((reference) => reference.id))].map(async (assetId) => {
    const document = await db.collection("listening_assets").doc(assetId).get();
    if (!document.exists) throw apiError2(400, `Kh\xF4ng t\xECm th\u1EA5y h\xECnh \u1EA3nh "${assetId}".`);
    const asset = { id: document.id, ...document.data() };
    if (asset.status !== "active" || asset.kind !== "image") throw apiError2(400, `Media "${asset.name || asset.id}" ph\u1EA3i l\xE0 h\xECnh \u1EA3nh \u0111ang ho\u1EA1t \u0111\u1ED9ng.`);
    if (!isSuperAdmin2(user) && asset.ownerId !== user.id) throw apiError2(403, `B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n d\xF9ng h\xECnh \u1EA3nh "${asset.name || asset.id}".`);
    assets.set(assetId, asset);
  }));
  const url = (id) => id ? assets.get(id)?.url : void 0;
  clone.coverUrl = url(clone.coverAssetId);
  clone.parts[0].wordBankUrl = url(clone.parts[0].wordBankAssetId);
  clone.parts[1].sceneUrl = url(clone.parts[1].sceneAssetId);
  clone.parts[2].sceneUrl = url(clone.parts[2].sceneAssetId);
  clone.parts[3].wordBankUrl = url(clone.parts[3].wordBankAssetId);
  clone.parts[4].scenes.forEach((scene) => {
    scene.imageUrl = url(scene.imageAssetId);
  });
  clone.parts[5].passageSourceUrl = url(clone.parts[5].passageSourceAssetId);
  clone.parts[5].illustrationUrl = url(clone.parts[5].illustrationAssetId);
  clone.parts[5].optionsUrl = url(clone.parts[5].optionsAssetId);
  return { content: clone, references };
}
function playableSet2(set, version) {
  return {
    ...publicSetSummary2(set),
    schemaVersion: MOVER_READING_WRITING_SCHEMA_VERSION,
    versionId: version.id,
    versionNumber: version.versionNumber,
    content: sanitizeMoverReadingWritingContentForStudent(version.content)
  };
}
function createMoverReadingWritingRouter(dependencies) {
  const {
    db,
    authenticateUser: authenticateUser2,
    authenticateOptionalUser: authenticateOptionalUser2,
    requireStaff,
    ticketSecret,
    mediaDir,
    resolveGuestProfile: resolveGuestProfile2,
    logAudit,
    smartImport
  } = dependencies;
  const router = import_express4.default.Router();
  const draftLocks = /* @__PURE__ */ new Map();
  const smartImportUsage = /* @__PURE__ */ new Map();
  const transientSources = mediaDir ? createListeningPdfTransientSourceStore({
    directory: import_path4.default.join(mediaDir, ".tmp-mover-reading-import"),
    secret: ticketSecret
  }) : null;
  const withDraftLock = async (setId, operation) => {
    const previous = draftLocks.get(setId) || Promise.resolve();
    let release;
    const current = new Promise((resolve) => {
      release = resolve;
    });
    const queued = previous.then(() => current);
    draftLocks.set(setId, queued);
    await previous;
    try {
      return await operation();
    } finally {
      release();
      if (draftLocks.get(setId) === queued) draftLocks.delete(setId);
    }
  };
  router.get("/capabilities", authenticateUser2, requireStaff, (_req, res) => {
    res.json({
      smartImport: {
        enabled: smartImport?.enabled !== false,
        visionEnabled: Boolean(smartImport?.analyzeVision),
        providers: smartImport?.providers || [],
        reason: smartImport?.reason || (smartImport?.analyzeVision ? void 0 : "Ch\u01B0a c\u1EA5u h\xECnh nh\xE0 cung c\u1EA5p AI th\u1ECB gi\xE1c cho Reading & Writing.")
      },
      transientUpload: {
        enabled: Boolean(transientSources),
        imageMaxBytes: SMART_IMPORT_IMAGE_MAX_BYTES,
        mimeTypes: SMART_IMPORT_IMAGE_MIME_TYPES
      }
    });
  });
  router.post(
    "/admin/smart-import/sources",
    authenticateUser2,
    requireStaff,
    import_express4.default.raw({ type: SMART_IMPORT_IMAGE_MIME_TYPES, limit: SMART_IMPORT_IMAGE_MAX_BYTES }),
    async (req, res) => {
      try {
        if (!req.user) throw apiError2(401, "Vui l\xF2ng \u0111\u0103ng nh\u1EADp.");
        if (!transientSources) throw apiError2(503, "Th\u01B0 m\u1EE5c media t\u1EA1m cho Smart Import ch\u01B0a \u0111\u01B0\u1EE3c c\u1EA5u h\xECnh.");
        const mimeType = text2(req.headers["content-type"]?.split(";")[0], 100).toLowerCase();
        if (!SMART_IMPORT_IMAGE_MIME_TYPES.includes(mimeType)) {
          throw apiError2(415, "Smart Import ch\u1EC9 nh\u1EADn \u1EA3nh JPEG, PNG ho\u1EB7c WebP.");
        }
        const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
        if (!buffer.length || buffer.length > SMART_IMPORT_IMAGE_MAX_BYTES) {
          throw apiError2(413, "\u1EA2nh ngu\u1ED3n r\u1ED7ng ho\u1EB7c v\u01B0\u1EE3t qu\xE1 10 MB.");
        }
        if (!hasValidImageMagic(buffer, mimeType)) throw apiError2(415, "N\u1ED9i dung \u1EA3nh kh\xF4ng kh\u1EDBp \u0111\u1ECBnh d\u1EA1ng khai b\xE1o.");
        const source = await transientSources.create(req.user.id, mimeType, buffer);
        res.status(201).json(source);
      } catch (error) {
        sendError2(res, error);
      }
    }
  );
  router.post("/admin/smart-import/analyze", authenticateUser2, requireStaff, async (req, res) => {
    const removers = [];
    try {
      if (!req.user) throw apiError2(401, "Vui l\xF2ng \u0111\u0103ng nh\u1EADp.");
      if (smartImport?.enabled === false || !smartImport?.analyzeVision) {
        throw apiError2(503, smartImport?.reason || "Smart Import Reading & Writing ch\u01B0a c\xF3 AI th\u1ECB gi\xE1c kh\u1EA3 d\u1EE5ng.");
      }
      const windowStart = Date.now() - 10 * 60 * 1e3;
      const recentUsage = (smartImportUsage.get(req.user.id) || []).filter((timestamp) => timestamp >= windowStart);
      if (recentUsage.length >= 20) throw apiError2(429, "\u0110\xE3 \u0111\u1EA1t gi\u1EDBi h\u1EA1n 20 l\u01B0\u1EE3t Smart Import trong 10 ph\xFAt.");
      recentUsage.push(Date.now());
      smartImportUsage.set(req.user.id, recentUsage);
      if (req.body?.moduleId !== "mover" || req.body?.paperId !== MOVER_READING_WRITING_PAPER_ID) {
        throw apiError2(400, "Smart Import n\xE0y ch\u1EC9 h\u1ED7 tr\u1EE3 Mover Reading & Writing.");
      }
      const part = Number(req.body?.part);
      if (![1, 2, 3, 4, 5, 6].includes(part)) throw apiError2(400, "Part Reading & Writing kh\xF4ng h\u1EE3p l\u1EC7.");
      const currentPart = req.body?.currentPart;
      if (!currentPart || currentPart.part !== part) throw apiError2(400, "D\u1EEF li\u1EC7u Part hi\u1EC7n t\u1EA1i kh\xF4ng h\u1EE3p l\u1EC7.");
      const basePartHash = text2(req.body?.basePartHash, 64).toLowerCase();
      if (!/^[0-9a-f]{64}$/.test(basePartHash)) throw apiError2(400, "Thi\u1EBFu hash c\u1EE7a Part hi\u1EC7n t\u1EA1i.");
      if (sha2562(JSON.stringify(currentPart)) !== basePartHash) {
        throw apiError2(409, "Part \u0111\xE3 thay \u0111\u1ED5i tr\u01B0\u1EDBc khi b\u1EAFt \u0111\u1EA7u ph\xE2n t\xEDch.", { code: "MOVER_READING_IMPORT_BASE_CHANGED" });
      }
      const preferredProvider = text2(req.body?.preferredProvider, 60);
      const selectedProvider = (smartImport.providers || []).find((provider) => provider.id === preferredProvider);
      if (!selectedProvider) throw apiError2(400, `Nh\xE0 cung c\u1EA5p AI "${preferredProvider}" kh\xF4ng t\u1ED3n t\u1EA1i.`);
      if (!selectedProvider.enabled || selectedProvider.visionEnabled === false) {
        throw apiError2(503, selectedProvider.reason || `${selectedProvider.label} ch\u01B0a s\u1EB5n s\xE0ng cho \u1EA3nh.`);
      }
      const definitions = getMoverReadingWritingSmartImportRoleDefinitions(part);
      const definitionByRole = new Map(definitions.map((definition) => [definition.role, definition]));
      const rawSources = Array.isArray(req.body?.sources) ? req.body.sources : [];
      if (rawSources.length > 4) throw apiError2(400, "Smart Import Reading & Writing nh\u1EADn t\u1ED1i \u0111a b\u1ED1n \u1EA3nh theo vai tr\xF2.");
      const sources = [];
      const seenRoles = /* @__PURE__ */ new Set();
      const seenValues = /* @__PURE__ */ new Set();
      for (const raw of rawSources.slice(0, 4)) {
        const role = text2(raw?.role, 40);
        const assetId = text2(raw?.assetId, 160);
        const transientToken = text2(raw?.transientToken, 2e3);
        const definition = definitionByRole.get(role);
        if (!definition || Boolean(assetId) === Boolean(transientToken)) throw apiError2(400, "M\u1ED7i vai tr\xF2 \u1EA3nh ph\u1EA3i c\xF3 \u0111\xFAng m\u1ED9t ngu\u1ED3n h\u1EE3p l\u1EC7.");
        if (definition.source === "asset" && !assetId) throw apiError2(400, `${definition.label} ph\u1EA3i d\xF9ng \u1EA3nh \u0111\xE3 l\u01B0u trong th\u01B0 vi\u1EC7n.`);
        if (definition.source === "transient" && !transientToken) throw apiError2(400, `${definition.label} ph\u1EA3i d\xF9ng \u1EA3nh t\u1EA1m c\u1EE7a l\u01B0\u1EE3t ph\xE2n t\xEDch.`);
        if (seenRoles.has(role)) throw apiError2(400, `Vai tr\xF2 ${role} b\u1ECB tr\xF9ng.`);
        const sourceValue = assetId ? `asset:${assetId}` : `transient:${transientToken}`;
        if (seenValues.has(sourceValue)) throw apiError2(400, "M\u1ED9t \u1EA3nh kh\xF4ng \u0111\u01B0\u1EE3c d\xF9ng \u0111\u1ED3ng th\u1EDDi cho nhi\u1EC1u vai tr\xF2.");
        seenRoles.add(role);
        seenValues.add(sourceValue);
        sources.push({ role, ...assetId ? { assetId } : { transientToken } });
      }
      const missing = definitions.filter((definition) => definition.required && !seenRoles.has(definition.role));
      if (missing.length) throw apiError2(400, `Thi\u1EBFu ngu\u1ED3n b\u1EAFt bu\u1ED9c: ${missing.map((definition) => definition.label).join(", ")}.`);
      const images = [];
      let totalBytes = 0;
      for (const source of sources) {
        if (source.transientToken) {
          if (!transientSources) throw apiError2(503, "Th\u01B0 m\u1EE5c media t\u1EA1m ch\u01B0a \u0111\u01B0\u1EE3c c\u1EA5u h\xECnh.");
          let resolved;
          try {
            resolved = await transientSources.resolve(source.transientToken, req.user.id);
          } catch (reason) {
            throw apiError2(/hết hạn/.test(reason?.message) ? 410 : 400, reason?.message || "Ngu\u1ED3n \u1EA3nh t\u1EA1m kh\xF4ng h\u1EE3p l\u1EC7.");
          }
          removers.push(resolved.remove);
          totalBytes += resolved.data.length;
          images.push({ assetId: `mrw-source-${resolved.sourceId}`, role: source.role, mimeType: resolved.mimeType, data: resolved.data });
          continue;
        }
        const assetDocument = await db.collection("listening_assets").doc(source.assetId).get();
        if (!assetDocument.exists) throw apiError2(404, "Kh\xF4ng t\xECm th\u1EA5y \u1EA3nh ngu\u1ED3n trong th\u01B0 vi\u1EC7n.");
        const asset = { id: assetDocument.id, ...assetDocument.data() };
        if (asset.status !== "active" || asset.kind !== "image" || !SMART_IMPORT_IMAGE_MIME_TYPES.includes(asset.mimeType)) {
          throw apiError2(400, `Media "${asset.name || asset.id}" ph\u1EA3i l\xE0 \u1EA3nh JPEG, PNG ho\u1EB7c WebP \u0111ang ho\u1EA1t \u0111\u1ED9ng.`);
        }
        if (!isSuperAdmin2(req.user) && asset.ownerId !== req.user.id) throw apiError2(403, "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n d\xF9ng \u1EA3nh ngu\u1ED3n n\xE0y.");
        if (!mediaDir) throw apiError2(503, "Th\u01B0 m\u1EE5c media ch\u01B0a \u0111\u01B0\u1EE3c c\u1EA5u h\xECnh.");
        const storageKey = text2(asset.storageKey, 300);
        if (!storageKey || import_path4.default.basename(storageKey) !== storageKey) throw apiError2(400, "\u0110\u01B0\u1EDDng d\u1EABn \u1EA3nh ngu\u1ED3n kh\xF4ng h\u1EE3p l\u1EC7.");
        const root = import_path4.default.resolve(mediaDir);
        const filePath = import_path4.default.resolve(mediaDir, storageKey);
        if (!filePath.startsWith(`${root}${import_path4.default.sep}`)) throw apiError2(400, "\u0110\u01B0\u1EDDng d\u1EABn \u1EA3nh ngu\u1ED3n v\u01B0\u1EE3t ngo\xE0i th\u01B0 m\u1EE5c media.");
        let data;
        try {
          data = await import_fs4.default.promises.readFile(filePath);
        } catch {
          throw apiError2(404, "File \u1EA3nh ngu\u1ED3n kh\xF4ng c\xF2n t\u1ED3n t\u1EA1i tr\xEAn m\xE1y ch\u1EE7.");
        }
        if (!data.length || data.length > SMART_IMPORT_IMAGE_MAX_BYTES || !hasValidImageMagic(data, asset.mimeType)) {
          throw apiError2(415, "File \u1EA3nh ngu\u1ED3n kh\xF4ng h\u1EE3p l\u1EC7 ho\u1EB7c v\u01B0\u1EE3t gi\u1EDBi h\u1EA1n 10 MB.");
        }
        totalBytes += data.length;
        images.push({ assetId: asset.id, role: source.role, mimeType: asset.mimeType, data });
      }
      if (totalBytes > SMART_IMPORT_TOTAL_MAX_BYTES) throw apiError2(413, "T\u1ED5ng dung l\u01B0\u1EE3ng \u1EA3nh Smart Import v\u01B0\u1EE3t qu\xE1 30 MB.");
      const abortController = new AbortController();
      let timeoutId;
      const candidatePromise = createMoverReadingWritingSmartImportCandidate({
        part,
        basePartHash,
        images,
        preferredProvider,
        analyzeVision: smartImport.analyzeVision,
        signal: abortController.signal
      });
      const timeoutPromise = new Promise((_resolve, reject) => {
        timeoutId = setTimeout(() => {
          abortController.abort();
          reject(apiError2(504, "Smart Import Reading & Writing qu\xE1 th\u1EDDi gian x\u1EED l\xFD. B\u1EA3n nh\xE1p ch\u01B0a b\u1ECB thay \u0111\u1ED5i."));
        }, SMART_IMPORT_TIMEOUT_MS2);
      });
      const candidate = await Promise.race([candidatePromise, timeoutPromise]).finally(() => {
        if (timeoutId) clearTimeout(timeoutId);
      });
      await Promise.allSettled(removers.map((remove) => remove()));
      removers.length = 0;
      await logAudit?.(
        req.user.id,
        req.user.name,
        req.user.email,
        "ANALYZE_MOVER_READING_SMART_IMPORT",
        `Ph\xE2n t\xEDch Reading & Writing Part ${part} b\u1EB1ng ${candidate.provider}; ${candidate.warnings.length} c\u1EA3nh b\xE1o.`
      );
      res.json(candidate);
    } catch (error) {
      sendError2(res, error);
    } finally {
      await Promise.allSettled(removers.map((remove) => remove()));
    }
  });
  router.get("/admin/sets", authenticateUser2, requireStaff, async (req, res) => {
    try {
      const snapshot = isSuperAdmin2(req.user) ? await db.collection("mover_reading_sets").get() : await db.collection("mover_reading_sets").where("ownerId", "==", req.user.id).get();
      const sets = [];
      snapshot.forEach((document) => {
        const set = { id: document.id, ...document.data() };
        if (set.status !== "archived") sets.push(set);
      });
      sets.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
      res.json(sets);
    } catch (error) {
      sendError2(res, error);
    }
  });
  router.post("/admin/sets", authenticateUser2, requireStaff, async (req, res) => {
    try {
      if (!req.user) throw apiError2(401, "Vui l\xF2ng \u0111\u0103ng nh\u1EADp.");
      const rawContent = req.body?.content;
      if (!rawContent || !isSupportedMoverReadingWritingSchemaVersion(rawContent.schemaVersion)) throw apiError2(400, "C\u1EA5u tr\xFAc b\u1ED9 \u0111\u1EC1 kh\xF4ng h\u1EE3p l\u1EC7.");
      const content = normalizeMoverReadingWritingContent(rawContent);
      const now = nowIso3();
      const set = {
        id: identifier2("mrwset"),
        moduleId: "mover",
        paperId: MOVER_READING_WRITING_PAPER_ID,
        schemaVersion: MOVER_READING_WRITING_SCHEMA_VERSION,
        ownerId: req.user.id,
        createdBy: req.user.id,
        title: text2(content.title, 160) || "Mover Reading & Writing",
        description: text2(content.description, 2e3),
        level: text2(content.level, 80) || "Movers",
        status: "draft",
        visibility: "draft",
        draftRevision: 1,
        draftContent: content,
        validationErrors: validateMoverReadingWritingContent(content),
        createdAt: now,
        updatedAt: now
      };
      await db.collection("mover_reading_sets").doc(set.id).set(set);
      await logAudit?.(req.user.id, req.user.name, req.user.email, "CREATE_MOVER_READING_SET", `T\u1EA1o b\u1ED9 \u0111\u1EC1 Reading & Writing "${set.title}".`);
      res.status(201).json(set);
    } catch (error) {
      sendError2(res, error);
    }
  });
  router.get("/admin/sets/:id", authenticateUser2, requireStaff, async (req, res) => {
    try {
      const set = await getSet2(db, req.params.id);
      if (!set) throw apiError2(404, "Kh\xF4ng t\xECm th\u1EA5y b\u1ED9 \u0111\u1EC1 Reading & Writing.");
      if (!canManageSet2(req.user, set)) throw apiError2(403, "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n xem b\u1ED9 \u0111\u1EC1 n\xE0y.");
      const snapshot = await db.collection("mover_reading_set_versions").where("setId", "==", set.id).get();
      const versions = [];
      snapshot.forEach((document) => {
        const version = { id: document.id, ...document.data() };
        if (version.content && isSupportedMoverReadingWritingSchemaVersion(version.content.schemaVersion)) {
          version.content = normalizeMoverReadingWritingContent(version.content);
        }
        versions.push(version);
      });
      versions.sort((a, b) => Number(b.versionNumber) - Number(a.versionNumber));
      res.json({ ...set, versions });
    } catch (error) {
      sendError2(res, error);
    }
  });
  router.put("/admin/sets/:id", authenticateUser2, requireStaff, async (req, res) => {
    try {
      const updated = await withDraftLock(req.params.id, async () => {
        const set = await getSet2(db, req.params.id);
        if (!set) throw apiError2(404, "Kh\xF4ng t\xECm th\u1EA5y b\u1ED9 \u0111\u1EC1 Reading & Writing.");
        if (!canManageSet2(req.user, set)) throw apiError2(403, "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n s\u1EEDa b\u1ED9 \u0111\u1EC1 n\xE0y.");
        if (set.status === "archived") throw apiError2(409, "B\u1ED9 \u0111\u1EC1 \u0111\xE3 \u0111\u01B0\u1EE3c l\u01B0u tr\u1EEF.");
        const rawContent = req.body?.content;
        if (!rawContent || !isSupportedMoverReadingWritingSchemaVersion(rawContent.schemaVersion)) throw apiError2(400, "C\u1EA5u tr\xFAc b\u1ED9 \u0111\u1EC1 kh\xF4ng h\u1EE3p l\u1EC7.");
        const content = normalizeMoverReadingWritingContent(rawContent);
        const currentRevision = Number(set.draftRevision || 0);
        if (req.body?.baseRevision !== void 0 && Number(req.body.baseRevision) !== currentRevision) {
          throw apiError2(409, "B\u1EA3n nh\xE1p \u0111\xE3 thay \u0111\u1ED5i \u1EDF m\u1ED9t phi\xEAn l\xE0m vi\u1EC7c kh\xE1c.", { code: "MOVER_READING_DRAFT_REVISION_CONFLICT", currentRevision });
        }
        const visibility = ["draft", "public", "assignment"].includes(req.body?.visibility) ? req.body.visibility : set.visibility;
        const shareToken = visibility === "assignment" ? set.shareToken || import_crypto2.default.randomBytes(18).toString("base64url") : void 0;
        const next = {
          ...set,
          title: text2(content.title, 160),
          description: text2(content.description, 2e3),
          level: text2(content.level, 80),
          schemaVersion: MOVER_READING_WRITING_SCHEMA_VERSION,
          visibility,
          draftRevision: currentRevision + 1,
          draftContent: content,
          validationErrors: validateMoverReadingWritingContent(content),
          updatedAt: nowIso3(),
          ...shareToken ? { shareToken, assignmentSlug: shareToken } : {}
        };
        if (!shareToken) {
          delete next.shareToken;
          delete next.assignmentSlug;
        }
        await db.collection("mover_reading_sets").doc(set.id).set(next);
        return next;
      });
      res.json(updated);
    } catch (error) {
      sendError2(res, error);
    }
  });
  router.post("/admin/sets/:id/draft/autosave", authenticateUser2, requireStaff, async (req, res) => {
    try {
      const updated = await withDraftLock(req.params.id, async () => {
        const set = await getSet2(db, req.params.id);
        if (!set) throw apiError2(404, "Kh\xF4ng t\xECm th\u1EA5y b\u1ED9 \u0111\u1EC1 Reading & Writing.");
        if (!canManageSet2(req.user, set)) throw apiError2(403, "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n s\u1EEDa b\u1ED9 \u0111\u1EC1 n\xE0y.");
        if (set.status === "archived") throw apiError2(409, "B\u1ED9 \u0111\u1EC1 \u0111\xE3 \u0111\u01B0\u1EE3c l\u01B0u tr\u1EEF.");
        const rawContent = req.body?.content;
        if (!rawContent || !isSupportedMoverReadingWritingSchemaVersion(rawContent.schemaVersion)) {
          throw apiError2(400, "C\u1EA5u tr\xFAc b\u1ED9 \u0111\u1EC1 kh\xF4ng h\u1EE3p l\u1EC7.");
        }
        const content = normalizeMoverReadingWritingContent(rawContent);
        const baseRevision = Number(req.body?.baseRevision);
        const currentRevision = Number(set.draftRevision || 0);
        if (!Number.isInteger(baseRevision) || baseRevision !== currentRevision) {
          throw apiError2(409, "B\u1EA3n nh\xE1p \u0111\xE3 thay \u0111\u1ED5i \u1EDF m\u1ED9t phi\xEAn l\xE0m vi\u1EC7c kh\xE1c.", {
            code: "MOVER_READING_DRAFT_REVISION_CONFLICT",
            currentRevision
          });
        }
        const visibility = ["draft", "public", "assignment"].includes(req.body?.visibility) ? req.body.visibility : set.visibility;
        const shareToken = visibility === "assignment" ? set.shareToken || import_crypto2.default.randomBytes(18).toString("base64url") : void 0;
        const updatedAt = nowIso3();
        const next = {
          ...set,
          title: text2(content.title, 160),
          description: text2(content.description, 2e3),
          level: text2(content.level, 80),
          schemaVersion: MOVER_READING_WRITING_SCHEMA_VERSION,
          visibility,
          draftRevision: currentRevision + 1,
          draftContent: content,
          validationErrors: validateMoverReadingWritingContent(content),
          updatedAt,
          ...shareToken ? { shareToken, assignmentSlug: shareToken } : {}
        };
        if (!shareToken) {
          delete next.shareToken;
          delete next.assignmentSlug;
        }
        await db.collection("mover_reading_sets").doc(set.id).set(next);
        return next;
      });
      res.json({
        draftRevision: updated.draftRevision,
        updatedAt: updated.updatedAt,
        validationErrors: updated.validationErrors
      });
    } catch (error) {
      sendError2(res, error);
    }
  });
  router.post("/admin/sets/:id/clone", authenticateUser2, requireStaff, async (req, res) => {
    try {
      if (!req.user) throw apiError2(401, "Vui l\xF2ng \u0111\u0103ng nh\u1EADp.");
      const source = await getSet2(db, req.params.id);
      if (!source) throw apiError2(404, "Kh\xF4ng t\xECm th\u1EA5y b\u1ED9 \u0111\u1EC1 Reading & Writing.");
      if (!canManageSet2(req.user, source)) throw apiError2(403, "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n sao ch\xE9p b\u1ED9 \u0111\u1EC1 n\xE0y.");
      let sourceContent = source.draftContent;
      if (!sourceContent && source.publishedVersionId) sourceContent = (await getVersion2(db, source.publishedVersionId))?.content;
      if (!sourceContent) throw apiError2(409, "B\u1ED9 \u0111\u1EC1 ngu\u1ED3n kh\xF4ng c\xF3 n\u1ED9i dung t\u01B0\u01A1ng th\xEDch.");
      const suffix = " (B\u1EA3n sao)";
      const cloneTitle = `${text2(source.title, 160 - suffix.length)}${suffix}`;
      const content = { ...normalizeMoverReadingWritingContent(sourceContent), title: cloneTitle };
      const now = nowIso3();
      const clone = {
        id: identifier2("mrwset"),
        moduleId: "mover",
        paperId: MOVER_READING_WRITING_PAPER_ID,
        schemaVersion: MOVER_READING_WRITING_SCHEMA_VERSION,
        ownerId: req.user.id,
        createdBy: req.user.id,
        title: cloneTitle,
        description: text2(content.description, 2e3),
        level: text2(content.level, 80),
        status: "draft",
        visibility: "draft",
        draftRevision: 1,
        draftContent: content,
        validationErrors: validateMoverReadingWritingContent(content),
        createdAt: now,
        updatedAt: now
      };
      await db.collection("mover_reading_sets").doc(clone.id).set(clone);
      res.status(201).json(clone);
    } catch (error) {
      sendError2(res, error);
    }
  });
  router.post("/admin/sets/:id/publish", authenticateUser2, requireStaff, async (req, res) => {
    try {
      if (!req.user) throw apiError2(401, "Vui l\xF2ng \u0111\u0103ng nh\u1EADp.");
      const set = await getSet2(db, req.params.id);
      if (!set) throw apiError2(404, "Kh\xF4ng t\xECm th\u1EA5y b\u1ED9 \u0111\u1EC1 Reading & Writing.");
      if (!canManageSet2(req.user, set)) throw apiError2(403, "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n xu\u1EA5t b\u1EA3n b\u1ED9 \u0111\u1EC1 n\xE0y.");
      if (set.status === "archived") throw apiError2(409, "B\u1ED9 \u0111\u1EC1 \u0111\xE3 \u0111\u01B0\u1EE3c l\u01B0u tr\u1EEF.");
      const draftContent = normalizeMoverReadingWritingContent(set.draftContent);
      const errors = validateMoverReadingWritingContent(draftContent);
      if (errors.length) throw apiError2(422, "B\u1ED9 \u0111\u1EC1 ch\u01B0a \u0111\u1EE7 \u0111i\u1EC1u ki\u1EC7n xu\u1EA5t b\u1EA3n.", errors);
      const resolved = await resolveContentAssets2(db, draftContent, req.user);
      const versionsSnapshot = await db.collection("mover_reading_set_versions").where("setId", "==", set.id).get();
      let versionNumber = 1;
      versionsSnapshot.forEach((document) => {
        versionNumber = Math.max(versionNumber, Number(document.data()?.versionNumber || 0) + 1);
      });
      const now = nowIso3();
      const version = {
        id: identifier2("mrwver"),
        setId: set.id,
        versionNumber,
        status: "published",
        schemaVersion: MOVER_READING_WRITING_SCHEMA_VERSION,
        content: resolved.content,
        createdAt: now,
        updatedAt: now,
        publishedAt: now
      };
      const batch = db.batch();
      batch.set(db.collection("mover_reading_set_versions").doc(version.id), version);
      if (set.publishedVersionId) {
        const previous = await getVersion2(db, set.publishedVersionId);
        if (previous) batch.update(db.collection("mover_reading_set_versions").doc(previous.id), { status: "superseded", updatedAt: now });
      }
      const publishedSet = {
        ...set,
        schemaVersion: MOVER_READING_WRITING_SCHEMA_VERSION,
        title: resolved.content.title,
        description: resolved.content.description,
        level: resolved.content.level,
        coverUrl: resolved.content.coverUrl || "",
        timeLimitMinutes: resolved.content.timeLimitMinutes,
        status: "published",
        publishedVersionId: version.id,
        publishedVersionNumber: versionNumber,
        validationErrors: [],
        updatedAt: now
      };
      batch.set(db.collection("mover_reading_sets").doc(set.id), publishedSet);
      resolved.references.forEach((reference) => {
        const usageId = `mrwusage-${sha2562(`${version.id}:${reference.id}:${reference.entityId}:${reference.role}`).slice(0, 32)}`;
        batch.set(db.collection("mover_reading_asset_usages").doc(usageId), {
          id: usageId,
          assetId: reference.id,
          setId: set.id,
          versionId: version.id,
          entityId: reference.entityId,
          role: reference.role,
          createdAt: now,
          updatedAt: now
        });
      });
      await batch.commit();
      await logAudit?.(req.user.id, req.user.name, req.user.email, "PUBLISH_MOVER_READING_SET", `Xu\u1EA5t b\u1EA3n "${publishedSet.title}" phi\xEAn b\u1EA3n ${versionNumber}.`);
      res.json({ set: publishedSet, version });
    } catch (error) {
      sendError2(res, error);
    }
  });
  router.delete("/admin/sets/:id", authenticateUser2, requireStaff, async (req, res) => {
    try {
      const set = await getSet2(db, req.params.id);
      if (!set) throw apiError2(404, "Kh\xF4ng t\xECm th\u1EA5y b\u1ED9 \u0111\u1EC1 Reading & Writing.");
      if (!canManageSet2(req.user, set)) throw apiError2(403, "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n l\u01B0u tr\u1EEF b\u1ED9 \u0111\u1EC1 n\xE0y.");
      const updatedAt = nowIso3();
      await db.collection("mover_reading_sets").doc(set.id).update({ status: "archived", updatedAt });
      res.json({ success: true, recoverable: true, status: "archived", updatedAt });
    } catch (error) {
      sendError2(res, error);
    }
  });
  router.get("/admin/sets/:id/results", authenticateUser2, requireStaff, async (req, res) => {
    try {
      const set = await getSet2(db, req.params.id);
      if (!set) throw apiError2(404, "Kh\xF4ng t\xECm th\u1EA5y b\u1ED9 \u0111\u1EC1 Reading & Writing.");
      if (!canManageSet2(req.user, set)) throw apiError2(403, "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n xem k\u1EBFt qu\u1EA3.");
      const snapshot = await db.collection("mover_reading_attempts").where("setId", "==", set.id).get();
      const attempts = [];
      for (const document of snapshot.docs || []) {
        const { runSecretHash: _secret, ...attempt } = { id: document.id, ...document.data() };
        const detailDoc = await db.collection("mover_reading_attempt_details").doc(document.id).get();
        attempts.push({ ...attempt, questions: detailDoc.exists ? detailDoc.data()?.questions || [] : [] });
      }
      attempts.sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt)));
      res.json({ set: publicSetSummary2(set), attempts });
    } catch (error) {
      sendError2(res, error);
    }
  });
  router.get("/sets", authenticateOptionalUser2, async (req, res) => {
    try {
      const snapshot = await db.collection("mover_reading_sets").get();
      const sets = [];
      snapshot.forEach((document) => {
        const set = { id: document.id, ...document.data() };
        const visible = set.status === "published" && (set.visibility === "public" || req.user?.role === "super_admin" || canManageSet2(req.user, set));
        if (visible) sets.push(publicSetSummary2(set));
      });
      sets.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
      res.json(sets);
    } catch (error) {
      sendError2(res, error);
    }
  });
  router.get("/sets/:id", authenticateOptionalUser2, async (req, res) => {
    try {
      const set = await getSet2(db, req.params.id);
      await resolveLearningAccess2(db, set, req);
      const version = await getVersion2(db, set.publishedVersionId);
      if (!version) throw apiError2(404, "Kh\xF4ng t\xECm th\u1EA5y phi\xEAn b\u1EA3n \u0111\xE3 xu\u1EA5t b\u1EA3n.");
      res.json(playableSet2(set, version));
    } catch (error) {
      sendError2(res, error);
    }
  });
  router.post("/sets/:id/attempts/prepare", authenticateOptionalUser2, async (req, res) => {
    try {
      const set = await getSet2(db, req.params.id);
      const access = await resolveLearningAccess2(db, set, req);
      const actor = await resolveActor2(req, resolveGuestProfile2, {
        classId: access.assignment?.classId,
        className: access.assignment?.className,
        verified: Boolean(access.assignment?.id)
      });
      const clientRunId = text2(req.body?.clientRunId, 160);
      const runSecret = text2(req.body?.runSecret, 300);
      if (!clientRunId || !runSecret) throw apiError2(400, "Thi\u1EBFu m\xE3 l\u01B0\u1EE3t l\xE0m b\xE0i.");
      const version = await getVersion2(db, set.publishedVersionId);
      if (!version) throw apiError2(404, "Kh\xF4ng t\xECm th\u1EA5y phi\xEAn b\u1EA3n \u0111\xE3 xu\u1EA5t b\u1EA3n.");
      const startedAt = nowIso3();
      const deadlineAt = set.timeLimitMinutes ? new Date(Date.now() + Number(set.timeLimitMinutes) * 6e4).toISOString() : void 0;
      const payload = {
        schemaVersion: MOVER_READING_WRITING_SCHEMA_VERSION,
        paperId: MOVER_READING_WRITING_PAPER_ID,
        setId: set.id,
        versionId: version.id,
        ownerKey: actor.ownerKey,
        assignmentId: access.assignment?.id || "",
        classId: access.assignment?.classId || "",
        className: access.assignment?.className || "",
        assignmentTitle: access.assignment?.title || "",
        assignmentDueAt: access.assignment?.dueDate || access.assignment?.dueAt || "",
        clientRunId,
        runSecretHash: sha2562(runSecret),
        startedAt,
        deadlineAt,
        ticketExpiresAt: Date.now() + (deadlineAt ? 24 * 60 * 6e4 : 7 * 24 * 60 * 6e4)
      };
      res.json({
        ticket: encodeTicket2(payload, ticketSecret),
        set: playableSet2(set, version),
        startedAt,
        deadlineAt
      });
    } catch (error) {
      sendError2(res, error);
    }
  });
  router.post("/sets/:id/attempts/submit", authenticateOptionalUser2, async (req, res) => {
    try {
      const ticket = decodeTicket2(req.body?.ticket, ticketSecret);
      if (ticket.paperId !== MOVER_READING_WRITING_PAPER_ID || ticket.setId !== req.params.id) throw apiError2(401, "Phi\u1EBFu l\xE0m b\xE0i kh\xF4ng kh\u1EDBp b\u1ED9 \u0111\u1EC1.");
      const runSecret = text2(req.body?.runSecret, 300);
      if (!runSecret || !timingSafeEqual2(sha2562(runSecret), String(ticket.runSecretHash))) throw apiError2(401, "M\xE3 b\u1EA3o v\u1EC7 l\u01B0\u1EE3t l\xE0m b\xE0i kh\xF4ng h\u1EE3p l\u1EC7.");
      const actor = await resolveActor2(req, resolveGuestProfile2);
      if (actor.ownerKey !== ticket.ownerKey) throw apiError2(404, "Kh\xF4ng t\xECm th\u1EA5y l\u01B0\u1EE3t l\xE0m b\xE0i.");
      const set = await getSet2(db, ticket.setId);
      const version = await getVersion2(db, ticket.versionId);
      if (!set || !version || version.setId !== set.id) throw apiError2(404, "Phi\xEAn b\u1EA3n b\u1ED9 \u0111\u1EC1 kh\xF4ng t\u1ED3n t\u1EA1i.");
      const attemptId = `mrwattempt-${sha2562(`${ticket.ownerKey}:${ticket.setId}:${ticket.clientRunId}`).slice(0, 40)}`;
      const existingDocument = await db.collection("mover_reading_attempts").doc(attemptId).get();
      if (existingDocument.exists) {
        const existing = { id: existingDocument.id, ...existingDocument.data() };
        if (!timingSafeEqual2(String(existing.runSecretHash), sha2562(runSecret))) throw apiError2(409, "M\xE3 l\u01B0\u1EE3t l\xE0m b\xE0i \u0111\xE3 \u0111\u01B0\u1EE3c s\u1EED d\u1EE5ng.");
        const { runSecretHash: _secret2, ownerKey: _owner2, userId: _user2, guestId: _guest2, ...summary2 } = existing;
        return res.json(summary2);
      }
      const content = version.content;
      const answers = sanitizeMoverReadingWritingAnswers(content, req.body?.answers);
      const grade = gradeMoverReadingWritingAttempt(content, answers);
      const completedAt = nowIso3();
      const durationSeconds = Math.max(0, Math.min(24 * 60 * 60, Math.round((Date.now() - new Date(ticket.startedAt).getTime()) / 1e3)));
      const attempt = {
        id: attemptId,
        paperId: MOVER_READING_WRITING_PAPER_ID,
        schemaVersion: MOVER_READING_WRITING_SCHEMA_VERSION,
        gradingVersion: MOVER_READING_WRITING_GRADING_VERSION,
        ownerKey: actor.ownerKey,
        userId: actor.userId,
        guestId: actor.guestId,
        studentName: actor.studentName,
        setId: set.id,
        setTitle: set.title,
        versionId: version.id,
        assignmentId: ticket.assignmentId || "",
        classId: ticket.classId || "",
        className: ticket.className || "",
        assignmentTitle: ticket.assignmentTitle || "",
        assignmentDueAt: ticket.assignmentDueAt || "",
        clientRunId: ticket.clientRunId,
        runSecretHash: sha2562(runSecret),
        score: grade.score,
        correctCount: grade.correctCount,
        incorrectCount: grade.incorrectCount,
        unansweredCount: grade.unansweredCount,
        totalCount: grade.totalCount,
        startedAt: ticket.startedAt,
        completedAt,
        durationSeconds,
        status: "completed",
        createdAt: completedAt,
        updatedAt: completedAt
      };
      const detail = {
        id: attemptId,
        attemptId,
        setId: set.id,
        versionId: version.id,
        questions: grade.questions,
        reviewPolicy: { showReviewAfterSubmit: content.showReviewAfterSubmit === true },
        createdAt: completedAt,
        updatedAt: completedAt
      };
      const batch = db.batch();
      batch.set(db.collection("mover_reading_attempts").doc(attemptId), attempt);
      batch.set(db.collection("mover_reading_attempt_details").doc(attemptId), detail);
      await batch.commit();
      const { runSecretHash: _secret, ownerKey: _owner, userId: _user, guestId: _guest, ...summary } = attempt;
      res.status(201).json(summary);
    } catch (error) {
      sendError2(res, error);
    }
  });
  router.get("/sets/:id/attempts/:attemptId/review", authenticateOptionalUser2, async (req, res) => {
    try {
      const attemptDocument = await db.collection("mover_reading_attempts").doc(req.params.attemptId).get();
      if (!attemptDocument.exists) throw apiError2(404, "Kh\xF4ng t\xECm th\u1EA5y l\u01B0\u1EE3t l\xE0m b\xE0i.");
      const attempt = { id: attemptDocument.id, ...attemptDocument.data() };
      if (attempt.setId !== req.params.id || attempt.status !== "completed") throw apiError2(404, "Kh\xF4ng t\xECm th\u1EA5y l\u01B0\u1EE3t l\xE0m b\xE0i.");
      let ownerKey = "";
      if (req.user) ownerKey = `user:${req.user.id}`;
      else {
        const guestId = text2(req.query?.guestId || req.headers["x-guest-id"], 120);
        ownerKey = guestId ? `guest:${guestId}` : "";
        const runSecret = text2(req.headers["x-mover-reading-run-secret"], 300);
        if (!runSecret || !timingSafeEqual2(sha2562(runSecret), String(attempt.runSecretHash))) throw apiError2(404, "Kh\xF4ng t\xECm th\u1EA5y l\u01B0\u1EE3t l\xE0m b\xE0i.");
      }
      if (!ownerKey || ownerKey !== attempt.ownerKey) throw apiError2(404, "Kh\xF4ng t\xECm th\u1EA5y l\u01B0\u1EE3t l\xE0m b\xE0i.");
      const detailDocument = await db.collection("mover_reading_attempt_details").doc(attempt.id).get();
      if (!detailDocument.exists) throw apiError2(404, "Kh\xF4ng t\xECm th\u1EA5y chi ti\u1EBFt l\u01B0\u1EE3t l\xE0m b\xE0i.");
      const detail = detailDocument.data();
      if (detail?.reviewPolicy?.showReviewAfterSubmit !== true) throw apiError2(403, "Gi\xE1o vi\xEAn ch\u01B0a cho ph\xE9p xem \u0111\xE1p \xE1n sau khi n\u1ED9p.");
      let visualReview;
      const version = await getVersion2(db, attempt.versionId);
      if (version?.content && Array.isArray(detail?.questions)) {
        try {
          visualReview = buildMoverReadingWritingVisualReviewSnapshot(
            version.content,
            detail.questions
          );
        } catch {
        }
      }
      res.json({
        attemptId: attempt.id,
        setId: attempt.setId,
        versionId: attempt.versionId,
        title: attempt.setTitle,
        score: attempt.score,
        correctCount: attempt.correctCount,
        incorrectCount: attempt.incorrectCount,
        unansweredCount: attempt.unansweredCount,
        totalCount: attempt.totalCount,
        completedAt: attempt.completedAt,
        questions: detail.questions || [],
        ...visualReview ? { visualReview } : {}
      });
    } catch (error) {
      sendError2(res, error);
    }
  });
  return router;
}

// src/server/listening-smart-import/devQuotaProvider.ts
var DEVQUOTA_PROVIDER_ID = "devquota:gpt-5.6-sol";
var DEVQUOTA_MODEL = "gpt-5.6-sol";
var DEVQUOTA_DEFAULT_BASE_URL = "https://sv.devquote.shop/v1";
var DEVQUOTA_MAX_REQUEST_BYTES = 42 * 1024 * 1024;
function getDevQuotaSmartImportProviders(apiKey) {
  const enabled = Boolean(apiKey?.trim());
  return [{
    id: DEVQUOTA_PROVIDER_ID,
    label: "DevQuota \xB7 ChatGPT 5.6 Sol",
    model: DEVQUOTA_MODEL,
    visionEnabled: true,
    enabled,
    ...!enabled ? { reason: "DevQuota \xB7 ChatGPT 5.6 Sol ch\u01B0a \u0111\u01B0\u1EE3c c\u1EA5u h\xECnh DEVQUOTA_API_KEY tr\xEAn m\xE1y ch\u1EE7." } : {}
  }];
}
function isDevQuotaProviderId(providerId) {
  return providerId === DEVQUOTA_PROVIDER_ID;
}
function normalizeDevQuotaBaseUrl(value) {
  const candidate = String(value || DEVQUOTA_DEFAULT_BASE_URL).trim().replace(/\/+$/, "");
  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error("DEVQUOTA_BASE_URL kh\xF4ng ph\u1EA3i URL h\u1EE3p l\u1EC7.");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("DEVQUOTA_BASE_URL ph\u1EA3i d\xF9ng HTTPS.");
  }
  return candidate;
}
function extractDevQuotaResponseText(data) {
  if (typeof data?.output_text === "string") return data.output_text.trim();
  const chunks = [];
  for (const item of Array.isArray(data?.output) ? data.output : []) {
    for (const content of Array.isArray(item?.content) ? item.content : []) {
      if (typeof content?.text === "string") chunks.push(content.text);
    }
  }
  return chunks.join("\n").trim();
}
function buildDevQuotaVisionRequest(prompt, images, options) {
  return {
    model: DEVQUOTA_MODEL,
    instructions: "Return only one valid JSON value matching the supplied schema. Do not return markdown, prose, UUIDs, database IDs, question IDs, choice IDs, or any invented value.",
    input: [{
      role: "user",
      content: [
        {
          type: "input_text",
          text: `${prompt}

REQUIRED JSON SCHEMA (${options.schemaName}):
${JSON.stringify(options.responseJsonSchema)}`
        },
        ...images.flatMap((image) => [
          { type: "input_text", text: `IMAGE ROLE: ${image.role}` },
          {
            type: "input_image",
            image_url: `data:${image.mimeType};base64,${image.data.toString("base64")}`,
            detail: "high"
          }
        ])
      ]
    }],
    text: {
      format: {
        type: "json_schema",
        name: options.schemaName,
        schema: options.responseJsonSchema,
        strict: false
      }
    },
    max_output_tokens: 16384
  };
}
async function generateWithDevQuotaVision(input) {
  if (!isDevQuotaProviderId(input.providerId)) {
    const error = new Error(`Model DevQuota "${input.providerId}" kh\xF4ng h\u1ED7 tr\u1EE3 Smart Import b\u1EB1ng \u1EA3nh.`);
    error.status = 400;
    throw error;
  }
  const apiKey = input.apiKey?.trim();
  if (!apiKey) return null;
  const requestBody = JSON.stringify(buildDevQuotaVisionRequest(input.prompt, input.images, input.options));
  if (Buffer.byteLength(requestBody, "utf8") > DEVQUOTA_MAX_REQUEST_BYTES) {
    const error = new Error("T\u1ED5ng \u1EA3nh v\xE0 prompt v\u01B0\u1EE3t gi\u1EDBi h\u1EA1n request an to\xE0n 42 MB c\u1EE7a adapter DevQuota. H\xE3y n\xE9n ho\u1EB7c c\u1EAFt g\u1ECDn \u1EA3nh ngu\u1ED3n r\u1ED3i ph\xE2n t\xEDch l\u1EA1i.");
    error.status = 413;
    throw error;
  }
  const fetchImpl = input.fetchImpl || fetch;
  const response = await fetchImpl(`${normalizeDevQuotaBaseUrl(input.baseUrl)}/responses`, {
    method: "POST",
    signal: input.signal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: requestBody
  });
  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    const error = new Error(errorText.slice(0, 1e3) || `DevQuota request failed with status ${response.status}`);
    error.status = response.status;
    throw error;
  }
  const data = await response.json();
  const text4 = extractDevQuotaResponseText(data);
  if (!text4) throw new Error("DevQuota response did not include text output.");
  return {
    text: text4,
    provider: DEVQUOTA_PROVIDER_ID,
    model: DEVQUOTA_MODEL
  };
}

// src/server/listening-smart-import/staliProvider.ts
var STALI_DEFAULT_BASE_URL = "https://api.stali.vn/v1";
var STALI_MAX_REQUEST_BYTES = 8 * 1024 * 1024;
var STALI_MODELS = [
  {
    id: "stali:gpt-5.6-sol",
    label: "Stali \xB7 ChatGPT 5.6 Sol",
    model: "gpt-5.6-sol",
    visionEnabled: true
  }
];
function getStaliSmartImportProviders(apiKey) {
  const configured = Boolean(apiKey?.trim());
  return STALI_MODELS.map((definition) => {
    const enabled = configured && definition.visionEnabled;
    const reason = !definition.visionEnabled ? `${definition.label} hi\u1EC7n kh\xF4ng h\u1ED7 tr\u1EE3 \u1EA3nh (Vision) theo t\xE0i li\u1EC7u Stali n\xEAn kh\xF4ng th\u1EC3 d\xF9ng cho Smart Import.` : !configured ? `${definition.label} ch\u01B0a \u0111\u01B0\u1EE3c c\u1EA5u h\xECnh STALI_API_KEY tr\xEAn m\xE1y ch\u1EE7.` : void 0;
    return {
      id: definition.id,
      label: definition.label,
      model: definition.model,
      visionEnabled: definition.visionEnabled,
      enabled,
      ...reason ? { reason } : {}
    };
  });
}
function resolveStaliVisionModel(providerId) {
  return STALI_MODELS.find((definition) => definition.id === providerId && definition.visionEnabled);
}
function isStaliProviderId(providerId) {
  return STALI_MODELS.some((definition) => definition.id === providerId);
}
function normalizeStaliBaseUrl(value) {
  const candidate = String(value || STALI_DEFAULT_BASE_URL).trim().replace(/\/+$/, "");
  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error("STALI_BASE_URL kh\xF4ng ph\u1EA3i URL h\u1EE3p l\u1EC7.");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("STALI_BASE_URL ph\u1EA3i d\xF9ng HTTPS.");
  }
  return candidate;
}
function extractStaliChatCompletionText(data) {
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content.map((item) => typeof item === "string" ? item : typeof item?.text === "string" ? item.text : "").filter(Boolean).join("\n").trim();
  }
  return "";
}
function buildStaliVisionRequest(model, prompt, images, options) {
  return {
    model,
    stream: false,
    max_tokens: 16384,
    messages: [
      {
        role: "system",
        content: "Return only one valid JSON value matching the supplied schema. Do not return markdown, prose, UUIDs, database IDs, question IDs, choice IDs, or any invented value."
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `${prompt}

REQUIRED JSON SCHEMA (${options.schemaName}):
${JSON.stringify(options.responseJsonSchema)}`
          },
          ...images.flatMap((image) => [
            { type: "text", text: `IMAGE ROLE: ${image.role}` },
            {
              type: "image_url",
              image_url: {
                url: `data:${image.mimeType};base64,${image.data.toString("base64")}`
              }
            }
          ])
        ]
      }
    ]
  };
}
async function generateWithStaliVision(input) {
  const definition = resolveStaliVisionModel(input.providerId);
  if (!definition) {
    const error = new Error(`Model Stali "${input.providerId}" kh\xF4ng h\u1ED7 tr\u1EE3 Smart Import b\u1EB1ng \u1EA3nh.`);
    error.status = 400;
    throw error;
  }
  const apiKey = input.apiKey?.trim();
  if (!apiKey) return null;
  const requestBody = JSON.stringify(buildStaliVisionRequest(
    definition.model,
    input.prompt,
    input.images,
    input.options
  ));
  if (Buffer.byteLength(requestBody, "utf8") > STALI_MAX_REQUEST_BYTES) {
    const error = new Error("T\u1ED5ng \u1EA3nh v\xE0 prompt v\u01B0\u1EE3t gi\u1EDBi h\u1EA1n 8 MB c\u1EE7a Stali. H\xE3y n\xE9n ho\u1EB7c c\u1EAFt g\u1ECDn \u1EA3nh ngu\u1ED3n r\u1ED3i ph\xE2n t\xEDch l\u1EA1i.");
    error.status = 413;
    throw error;
  }
  const fetchImpl = input.fetchImpl || fetch;
  const response = await fetchImpl(`${normalizeStaliBaseUrl(input.baseUrl)}/chat/completions`, {
    method: "POST",
    signal: input.signal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: requestBody
  });
  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    const error = new Error(errorText.slice(0, 1e3) || `Stali request failed with status ${response.status}`);
    error.status = response.status;
    throw error;
  }
  const data = await response.json();
  const text4 = extractStaliChatCompletionText(data);
  if (!text4) throw new Error("Stali response did not include text output.");
  return {
    text: text4,
    provider: definition.id,
    model: definition.model
  };
}

// src/lib/localAuthBypass.ts
var LOCAL_AUTH_BYPASS_TOKEN = "local-test-auth-bypass";
var LOCAL_AUTH_BYPASS_USER = Object.freeze({
  id: "local-test-super-admin",
  name: "Local Test Super Admin",
  email: "local-test@localhost.invalid",
  role: "super_admin",
  status: "active",
  createdAt: "2026-01-01T00:00:00.000Z"
});
function normalizedHost(value) {
  return String(value || "").trim().toLowerCase().replace(/^\[|\]$/g, "");
}
function isLoopbackHostname(value) {
  const hostname = normalizedHost(value);
  return hostname === "localhost" || hostname === "::1" || /^127(?:\.\d{1,3}){3}$/.test(hostname);
}
function isLoopbackAddress(value) {
  const address = normalizedHost(value).replace(/^::ffff:/, "");
  return isLoopbackHostname(address);
}
function isLocalServerAuthBypassAllowed(input) {
  return input.requested && input.nodeEnv !== "production" && input.bearerToken === LOCAL_AUTH_BYPASS_TOKEN && isLoopbackHostname(input.hostname) && isLoopbackAddress(input.remoteAddress);
}

// src/server/learning-history/learningAttemptProjector.ts
var import_node_crypto7 = __toESM(require("node:crypto"), 1);
var HISTORY_SCHEMA_VERSION = 1;
var DEFAULT_DETAIL_RETENTION_DAYS = 30;
var BANGKOK_TIME_ZONE = "Asia/Bangkok";
function text3(value, max = 500) {
  return String(value ?? "").normalize("NFKC").trim().slice(0, max);
}
function nonNegative(value) {
  const number2 = Number(value);
  return Number.isFinite(number2) ? Math.max(0, number2) : 0;
}
function integer2(value) {
  return Math.round(nonNegative(value));
}
function clampScore(value) {
  return Math.max(0, Math.min(100, Number.isFinite(Number(value)) ? Number(value) : 0));
}
function isoOrNull(value) {
  const raw = text3(value, 80);
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}
function activityStatus(value, completedAt) {
  if (completedAt || value === "completed") return "completed";
  if (value === "interrupted" || value === "abandoned") return "interrupted";
  return "in_progress";
}
function addDaysIso(base, days) {
  return new Date(new Date(base).getTime() + days * 864e5).toISOString();
}
function studyDateInBangkok(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BANGKOK_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}
function deterministicLearningAttemptId(sourceType, sourceRecordId) {
  const digest = import_node_crypto7.default.createHash("sha256").update(`learning-attempt-v1:${sourceType}:${sourceRecordId}`).digest("hex");
  return `attempt-${digest.slice(0, 40)}`;
}
function resolveOwnership(source) {
  const declaredOwnerKey = text3(source?.ownerKey || source?.owner_key, 260);
  const userId = text3(source?.userId || source?.user_id, 180);
  const guestId = text3(source?.guestId || source?.guest_id, 180);
  if (declaredOwnerKey.startsWith("user:") && userId) {
    return {
      studentType: "authenticated",
      userId,
      guestId: null,
      ownerKey: `user:${userId}`,
      ownershipStatus: "linked"
    };
  }
  if (declaredOwnerKey.startsWith("guest:") && guestId) {
    return {
      studentType: "guest",
      userId: null,
      guestId,
      ownerKey: `guest:${guestId}`,
      ownershipStatus: "linked"
    };
  }
  if (userId && (!guestId || source?.ownerType !== "guest")) {
    return {
      studentType: "authenticated",
      userId,
      guestId: null,
      ownerKey: `user:${userId}`,
      ownershipStatus: "linked"
    };
  }
  if (guestId) {
    return {
      studentType: "guest",
      userId: null,
      guestId,
      ownerKey: `guest:${guestId}`,
      ownershipStatus: "linked"
    };
  }
  return {
    studentType: "legacy",
    userId: null,
    guestId: null,
    ownerKey: null,
    ownershipStatus: "legacy_unlinked"
  };
}
function vocabularyCounts(session) {
  const gameId = text3(session?.gameId, 120);
  const sourceCorrect = integer2(session?.correctAnswers ?? session?.correct);
  const sourceIncorrect = integer2(session?.incorrectAnswers ?? session?.incorrect);
  let total = integer2(session?.totalQuestions);
  let correct = sourceCorrect;
  let incorrect = sourceIncorrect;
  let unanswered = integer2(session?.unansweredCount);
  let mistakeCount = integer2(session?.mistakeCount);
  let normalizationStatus = "canonical";
  if (gameId === "matching-word-meaning" || gameId === "memory-match") {
    const itemLimit = gameId === "matching-word-meaning" ? 8 : 6;
    const snapshotItems = Array.isArray(session?.privateSnapshot?.items) ? session.privateSnapshot.items.length : 0;
    const logicalTotal = Math.min(itemLimit, snapshotItems || total || sourceCorrect + sourceIncorrect);
    total = logicalTotal;
    correct = Math.min(sourceCorrect, total);
    incorrect = Math.max(0, total - correct);
    unanswered = 0;
    mistakeCount = Math.max(0, sourceIncorrect - incorrect);
    if (!snapshotItems) normalizationStatus = "legacy_partial";
  } else {
    if (!total) total = sourceCorrect + sourceIncorrect + unanswered;
    correct = Math.min(sourceCorrect, total || sourceCorrect);
    incorrect = Math.min(sourceIncorrect, Math.max(0, total - correct));
    unanswered = Math.max(0, total - correct - incorrect);
    if (!session?.totalQuestions) normalizationStatus = "legacy_partial";
  }
  const rawScore = Number.isFinite(Number(session?.rawScore ?? session?.gameScore)) ? Number(session.rawScore ?? session.gameScore) : null;
  const maxScore = Number.isFinite(Number(session?.maxScore)) ? Number(session.maxScore) : rawScore === null ? null : 100;
  const scoreCandidate = Number.isFinite(Number(session?.score)) ? Number(session.score) : total > 0 ? correct / total * 100 : 0;
  return {
    score: clampScore(scoreCandidate),
    rawScore,
    maxScore,
    correct,
    incorrect,
    unanswered,
    mistakeCount,
    total,
    normalizationStatus
  };
}
function createDetail(sourceType, attemptId, clientRunId, completedAt, values, detailRetentionDays) {
  return {
    attemptId,
    clientRunId,
    sourceType,
    answerDetails: Array.isArray(values.answerDetails) ? values.answerDetails : [],
    questionSnapshots: Array.isArray(values.questionSnapshots) ? values.questionSnapshots : [],
    optionSnapshots: Array.isArray(values.optionSnapshots) ? values.optionSnapshots : [],
    extraDetails: values.extraDetails && typeof values.extraDetails === "object" ? values.extraDetails : {},
    reviewPolicy: values.reviewPolicy && typeof values.reviewPolicy === "object" ? values.reviewPolicy : {},
    createdAt: values.createdAt || completedAt,
    updatedAt: values.updatedAt || completedAt,
    expiresAt: addDaysIso(completedAt, detailRetentionDays),
    schemaVersion: HISTORY_SCHEMA_VERSION
  };
}
function projectVocabularyAttempt(session, options = {}) {
  const sourceRecordId = text3(session?.id || session?.sourceId, 200);
  if (!sourceRecordId) throw new Error("Vocabulary projection requires a source record id.");
  const attemptId = deterministicLearningAttemptId("vocabulary", sourceRecordId);
  const ownership = resolveOwnership(session);
  const completedAt = isoOrNull(session?.completedAt || session?.endedAt);
  const startedAt = isoOrNull(session?.startedAt || session?.createdAt);
  const activityAt = completedAt || isoOrNull(session?.lastSavedAt || session?.updatedAt) || startedAt || (/* @__PURE__ */ new Date()).toISOString();
  const status = activityStatus(session?.status, completedAt);
  const counts = vocabularyCounts(session);
  const now = isoOrNull(session?.updatedAt) || activityAt;
  const assignmentVerified = Boolean(session?.assignmentVerified || session?.assignmentAccessVerified);
  const assignmentId = assignmentVerified ? text3(session?.assignmentId, 180) || null : null;
  const includeDetail = options.includeDetail !== false && status === "completed";
  const answerDetails = Array.isArray(session?.answerDetails) ? session.answerDetails : [];
  const snapshotItems = Array.isArray(session?.privateSnapshot?.items) ? session.privateSnapshot.items : [];
  const detailStatus = includeDetail ? "available" : status === "completed" ? "legacy" : "missing";
  const attempt = {
    attemptId,
    sourceRecordId,
    clientRunId: text3(session?.clientRunId, 180) || null,
    sourceType: "vocabulary",
    ...ownership,
    studentNameSnapshot: text3(session?.studentName, 240),
    classId: text3(session?.classId, 180) || null,
    classNameSnapshot: text3(session?.className, 240),
    assignmentId,
    assignmentTitleSnapshot: assignmentId ? text3(session?.assignmentTitle || session?.assignmentName, 300) : "",
    assignmentDueAtSnapshot: assignmentId ? isoOrNull(session?.assignmentDueAt || session?.dueDate) : null,
    lessonId: text3(session?.vocabSetId || session?.vocabularySetId, 200),
    lessonTitleSnapshot: text3(session?.vocabSetTitle || session?.lessonTitle, 300),
    lessonType: "vocab_set",
    gameId: text3(session?.gameId, 160) || "vocabulary-practice",
    gameTitleSnapshot: text3(session?.gameName || session?.gameTitle || session?.gameId, 240),
    score: counts.score,
    rawScore: counts.rawScore,
    maxScore: counts.maxScore,
    correctCount: counts.correct,
    incorrectCount: counts.incorrect,
    unansweredCount: counts.unanswered,
    mistakeCount: counts.mistakeCount,
    totalQuestions: counts.total,
    startedAt,
    completedAt,
    activityAt,
    studyDate: studyDateInBangkok(activityAt),
    durationSeconds: integer2(
      session?.durationSeconds ?? (Number.isFinite(Number(session?.durationMs)) ? Number(session.durationMs) / 1e3 : 0)
    ),
    attemptStatus: status,
    attemptNumber: integer2(session?.attemptNumber),
    schemaVersion: HISTORY_SCHEMA_VERSION,
    detailStatus,
    normalizationStatus: counts.normalizationStatus,
    createdAt: isoOrNull(session?.createdAt) || startedAt || activityAt,
    updatedAt: now
  };
  const detail = includeDetail && completedAt ? createDetail("vocabulary", attemptId, attempt.clientRunId, completedAt, {
    answerDetails,
    questionSnapshots: snapshotItems.map((item, index) => ({
      questionIndex: index,
      wordId: text3(item?.id, 180),
      term: text3(item?.term, 500),
      meaning: text3(item?.meaning, 1e3),
      ipa: text3(item?.ipa, 180),
      example: text3(item?.example, 1500)
    })),
    extraDetails: {
      gameId: attempt.gameId,
      gradingMode: text3(session?.gradingMode, 80)
    },
    reviewPolicy: {
      showReviewAfterSubmit: true,
      showExplanationImmediately: true,
      policyVersion: 1,
      capturedAt: completedAt
    },
    createdAt: completedAt,
    updatedAt: completedAt
  }, Math.max(1, options.detailRetentionDays || DEFAULT_DETAIL_RETENTION_DAYS)) : null;
  return { attempt, detail };
}
function grammarReviewPolicy(attempt, set, capturedAt) {
  const snapshot = attempt?.reviewPolicySnapshot;
  if (snapshot && typeof snapshot === "object") {
    return {
      showReviewAfterSubmit: snapshot.showReviewAfterSubmit === true,
      showExplanationImmediately: snapshot.showExplanationImmediately === true,
      policyVersion: Number(snapshot.policyVersion || 1),
      capturedAt: isoOrNull(snapshot.capturedAt) || capturedAt,
      legacyFallback: false
    };
  }
  return {
    showReviewAfterSubmit: set?.showReviewAfterSubmit === true,
    showExplanationImmediately: set?.showExplanationImmediately === true,
    policyVersion: 1,
    capturedAt,
    legacyFallback: !set
  };
}
function projectGrammarAttempt(grammarAttempt, grammarSet = {}, options = {}) {
  const sourceRecordId = text3(grammarAttempt?.id, 200);
  if (!sourceRecordId) throw new Error("Grammar projection requires a source record id.");
  const attemptId = deterministicLearningAttemptId("grammar", sourceRecordId);
  const ownership = resolveOwnership(grammarAttempt);
  const completedAt = isoOrNull(grammarAttempt?.completedAt);
  const startedAt = isoOrNull(grammarAttempt?.startedAt || grammarAttempt?.createdAt);
  const activityAt = completedAt || isoOrNull(grammarAttempt?.lastSavedAt || grammarAttempt?.updatedAt || grammarAttempt?.activatedAt) || startedAt || (/* @__PURE__ */ new Date()).toISOString();
  const status = activityStatus(grammarAttempt?.status, completedAt);
  const correct = integer2(grammarAttempt?.correctCount);
  const incorrect = integer2(grammarAttempt?.wrongCount ?? grammarAttempt?.incorrectCount);
  const unanswered = integer2(grammarAttempt?.unansweredCount);
  const questionCount = Array.isArray(grammarAttempt?.questions) ? grammarAttempt.questions.length : correct + incorrect + unanswered;
  const total = Math.max(questionCount, correct + incorrect + unanswered);
  const rawScore = nonNegative(grammarAttempt?.score);
  const maxScore = nonNegative(grammarAttempt?.maxScore);
  const canonicalScore = maxScore > 0 ? clampScore(rawScore / maxScore * 100) : 0;
  const includeDetail = options.includeDetail !== false && status === "completed";
  const reviewPolicy = grammarReviewPolicy(grammarAttempt, grammarSet, completedAt || activityAt);
  const questions = Array.isArray(grammarAttempt?.questions) ? grammarAttempt.questions : [];
  const answers = Array.isArray(grammarAttempt?.answers) ? grammarAttempt.answers : [];
  const answerByQuestion = new Map(answers.map((answer) => [answer?.attemptQuestionId, answer]));
  const attempt = {
    attemptId,
    sourceRecordId,
    clientRunId: text3(grammarAttempt?.clientRunId, 180) || null,
    sourceType: "grammar",
    ...ownership,
    studentNameSnapshot: text3(grammarAttempt?.studentName, 240),
    classId: text3(grammarAttempt?.classId, 180) || null,
    classNameSnapshot: text3(grammarAttempt?.className, 240),
    assignmentId: grammarAttempt?.assignmentVerified ? text3(grammarAttempt?.assignmentId, 180) || null : null,
    assignmentTitleSnapshot: grammarAttempt?.assignmentVerified ? text3(grammarAttempt?.assignmentTitle, 300) : "",
    assignmentDueAtSnapshot: grammarAttempt?.assignmentVerified ? isoOrNull(grammarAttempt?.assignmentDueAt) : null,
    lessonId: text3(grammarAttempt?.grammarSetId, 200),
    lessonTitleSnapshot: text3(grammarAttempt?.grammarSetTitle || grammarSet?.title, 300),
    lessonType: "grammar_set",
    gameId: "grammar-practice",
    gameTitleSnapshot: text3(
      grammarSet?.questionType === "rewrite" ? "Vi\u1EBFt l\u1EA1i c\xE2u" : "Luy\u1EC7n ng\u1EEF ph\xE1p",
      240
    ),
    score: canonicalScore,
    rawScore,
    maxScore,
    correctCount: correct,
    incorrectCount: incorrect,
    unansweredCount: unanswered,
    mistakeCount: 0,
    totalQuestions: total,
    startedAt,
    completedAt,
    activityAt,
    studyDate: studyDateInBangkok(activityAt),
    durationSeconds: integer2(grammarAttempt?.durationSeconds),
    attemptStatus: status,
    attemptNumber: integer2(grammarAttempt?.attemptNumber),
    schemaVersion: HISTORY_SCHEMA_VERSION,
    detailStatus: includeDetail ? "available" : status === "completed" ? "legacy" : "missing",
    normalizationStatus: questions.length ? "canonical" : "legacy_partial",
    createdAt: isoOrNull(grammarAttempt?.createdAt) || startedAt || activityAt,
    updatedAt: isoOrNull(grammarAttempt?.updatedAt) || activityAt
  };
  const detail = includeDetail && completedAt ? createDetail("grammar", attemptId, attempt.clientRunId, completedAt, {
    answerDetails: questions.map((question, index) => {
      const answer = answerByQuestion.get(question?.id);
      const questionType = question?.questionType === "rewrite" ? "rewrite" : "multiple_choice";
      const optionSnapshots = Array.isArray(question?.optionsSnapshot) ? question.optionsSnapshot : [];
      const selectedOptionId = text3(answer?.selectedOptionId, 200);
      const correctOptionId = text3(question?.correctOptionId || answer?.correctOptionId, 200);
      const selectedOption = optionSnapshots.find(
        (option) => text3(option?.id, 200) === selectedOptionId
      );
      const correctOption = optionSnapshots.find(
        (option) => text3(option?.id, 200) === correctOptionId
      );
      const userAnswer = questionType === "rewrite" ? text3(answer?.textAnswer, 4e3) : text3(selectedOption?.text, 2e3);
      const correctAnswer = questionType === "rewrite" ? text3(question?.correctAnswerSnapshot || answer?.correctAnswer, 4e3) : text3(correctOption?.text, 2e3);
      return {
        questionIndex: Number(question?.displayPosition || index + 1) - 1,
        attemptQuestionId: text3(question?.id, 200),
        questionId: text3(question?.questionId, 200),
        questionType,
        selectedOptionId,
        textAnswer: text3(answer?.textAnswer, 4e3),
        selectedAnswer: userAnswer,
        userAnswer,
        isCorrect: Boolean(answer?.isCorrect),
        scoreAwarded: nonNegative(answer?.scoreAwarded),
        answeredAt: isoOrNull(answer?.answeredAt),
        correctOptionId,
        correctAnswer,
        acceptedAnswers: Array.isArray(question?.acceptedAnswersSnapshot) ? question.acceptedAnswersSnapshot.map((value) => text3(value, 4e3)) : [],
        explanation: text3(question?.explanationSnapshot, 4e3)
      };
    }),
    questionSnapshots: questions.map((question, index) => ({
      questionIndex: Number(question?.displayPosition || index + 1) - 1,
      attemptQuestionId: text3(question?.id, 200),
      questionId: text3(question?.questionId, 200),
      questionType: question?.questionType === "rewrite" ? "rewrite" : "multiple_choice",
      questionText: text3(question?.questionSnapshot, 4e3),
      explanation: text3(question?.explanationSnapshot, 4e3),
      correctOptionId: text3(question?.correctOptionId, 200),
      correctAnswer: text3(question?.correctAnswerSnapshot, 4e3),
      acceptedAnswers: Array.isArray(question?.acceptedAnswersSnapshot) ? question.acceptedAnswersSnapshot.map((value) => text3(value, 4e3)) : []
    })),
    optionSnapshots: questions.map((question, index) => ({
      questionIndex: Number(question?.displayPosition || index + 1) - 1,
      attemptQuestionId: text3(question?.id, 200),
      options: Array.isArray(question?.optionsSnapshot) ? question.optionsSnapshot.map((option) => ({
        id: text3(option?.id, 200),
        text: text3(option?.text, 2e3)
      })) : []
    })),
    extraDetails: {
      grammarSetVersion: text3(grammarAttempt?.grammarSetVersion, 180),
      gradingVersion: text3(
        answers.find((answer) => answer?.gradingVersion)?.gradingVersion,
        120
      )
    },
    reviewPolicy,
    createdAt: completedAt,
    updatedAt: completedAt
  }, Math.max(1, options.detailRetentionDays || DEFAULT_DETAIL_RETENTION_DAYS)) : null;
  return { attempt, detail };
}

// src/server/publicStudentIdentity.ts
var import_node_crypto8 = __toESM(require("node:crypto"), 1);
function normalizedName(value) {
  return String(value || "").normalize("NFKC").trim().toLocaleLowerCase("vi").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/\s+/g, " ").slice(0, 300);
}
function createPublicStudentKey(data, secret) {
  const identity = String(
    data?.ownerKey || (data?.userId ? `user:${data.userId}` : "") || (data?.guestId ? `guest:${data.guestId}` : "") || (data?.studentId ? `student:${data.studentId}` : "") || `name:${normalizedName(data?.studentName || "H\u1ECDc sinh")}`
  ).normalize("NFKC").trim().slice(0, 300);
  return `student-${import_node_crypto8.default.createHmac("sha256", secret).update(identity).digest("hex").slice(0, 24)}`;
}
function sanitizePublicStudentRecord(value, secret) {
  const {
    ownerKey: _ownerKey,
    userId: _userId,
    studentId: _studentId,
    guestId: _guestId,
    ...safe
  } = value;
  const pseudonymousKey = createPublicStudentKey(value, secret);
  return {
    ...safe,
    publicStudentKey: pseudonymousKey,
    studentKey: pseudonymousKey
  };
}

// src/server/tts/yupvoxProvider.ts
var import_node_net = require("node:net");
var DEFAULT_BASE_URL = "https://api.yupvox.com";
var DEFAULT_MAX_POLL_ATTEMPTS = 40;
var DEFAULT_POLL_INTERVAL_MS = 1500;
function clampInteger(value, fallback, min, max) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}
function getErrorMessage(payload, fallback) {
  const message = payload?.data?.error || payload?.data?.message || payload?.error || payload?.message;
  return typeof message === "string" && message.trim() ? message.trim() : fallback;
}
async function readJsonResponse(response) {
  return response.json().catch(() => ({}));
}
function normalizeYupVoxBaseUrl(value) {
  const url = new URL(String(value || DEFAULT_BASE_URL).trim());
  if (url.protocol !== "https:") {
    throw new Error("YUPVOX_BASE_URL must use HTTPS.");
  }
  if (url.username || url.password) {
    throw new Error("YUPVOX_BASE_URL must not contain credentials.");
  }
  url.pathname = url.pathname.replace(/\/+$/, "");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}
function isPrivateIpv4(hostname) {
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  return a === 10 || a === 127 || a === 0 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168;
}
function assertSafeYupVoxAudioUrl(value) {
  let url;
  try {
    url = new URL(String(value || "").trim());
  } catch {
    throw new Error("YupVox returned an invalid audio URL.");
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("YupVox audio URL must be a credential-free HTTPS URL.");
  }
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const ipVersion = (0, import_node_net.isIP)(hostname);
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || isPrivateIpv4(hostname) || ipVersion === 6 && (hostname === "::1" || hostname.startsWith("fe80:") || hostname.startsWith("fc") || hostname.startsWith("fd"))) {
    throw new Error("YupVox returned an unsafe audio URL.");
  }
  return url.toString();
}
async function generateYupVoxAudioUrl(options) {
  const apiKey = String(options.apiKey || "").trim();
  const voiceId = String(options.voiceId || "").trim();
  const text4 = String(options.text || "").trim();
  if (!apiKey) throw new Error("YUPVOX_API_KEY is not configured.");
  if (!voiceId) throw new Error("Missing YupVox voiceId.");
  if (!text4) throw new Error("Missing YupVox TTS text.");
  const baseUrl = normalizeYupVoxBaseUrl(options.baseUrl);
  const maxPollAttempts = clampInteger(options.maxPollAttempts, DEFAULT_MAX_POLL_ATTEMPTS, 1, 120);
  const pollIntervalMs = clampInteger(options.pollIntervalMs, DEFAULT_POLL_INTERVAL_MS, 250, 1e4);
  const wait = options.wait || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json"
  };
  const createResponse = await options.fetchImpl(`${baseUrl}/v1/tts`, {
    method: "POST",
    headers,
    body: JSON.stringify({ voiceId, text: text4 })
  });
  const createPayload = await readJsonResponse(createResponse);
  if (!createResponse.ok) {
    throw new Error(getErrorMessage(createPayload, `YupVox TTS request failed with HTTP ${createResponse.status}.`));
  }
  const jobId = String(createPayload?.data?.jobId || "").trim();
  if (!jobId) {
    throw new Error(getErrorMessage(createPayload, "YupVox did not return data.jobId."));
  }
  for (let attempt = 0; attempt < maxPollAttempts; attempt += 1) {
    if (attempt > 0) await wait(pollIntervalMs);
    const statusResponse = await options.fetchImpl(`${baseUrl}/v1/tts/${encodeURIComponent(jobId)}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${apiKey}` }
    });
    const statusPayload = await readJsonResponse(statusResponse);
    if (!statusResponse.ok) {
      throw new Error(getErrorMessage(statusPayload, `YupVox TTS status failed with HTTP ${statusResponse.status}.`));
    }
    const status = String(statusPayload?.data?.status || "").trim().toLowerCase();
    if (status === "failed" || status === "error") {
      throw new Error(getErrorMessage(statusPayload, "YupVox TTS job failed."));
    }
    if (status === "completed") {
      const audioUrl = String(statusPayload?.data?.audioUrl || "").trim();
      if (!audioUrl) throw new Error("YupVox completed the job without data.audioUrl.");
      return assertSafeYupVoxAudioUrl(audioUrl);
    }
  }
  throw new Error("YupVox TTS job timed out before audio was ready.");
}

// server.ts
import_dotenv.default.config();
var LOCAL_AUTH_BYPASS_REQUESTED = process.env.LOCAL_AUTH_BYPASS_ENABLED === "true";
if (process.env.NODE_ENV === "production" && LOCAL_AUTH_BYPASS_REQUESTED) {
  throw new Error("LOCAL_AUTH_BYPASS_ENABLED must never be enabled in production.");
}
if (LOCAL_AUTH_BYPASS_REQUESTED) {
  console.warn("[Local Test] Firebase authentication bypass is enabled for loopback requests only.");
}
var app2 = (0, import_express5.default)();
var PORT = Number(process.env.PORT) || 3e3;
var AUDIO_DIR = process.env.TTS_AUDIO_DIR || "/home/qzmivzbj/app-data/vhomework/audio";
var AUDIO_PUBLIC_PREFIX = "/audio";
var LISTENING_MEDIA_PUBLIC_PREFIX = "/listening-media";
var LISTENING_MEDIA_DIR = process.env.LISTENING_MEDIA_DIR || (process.env.NODE_ENV === "production" ? "/home/qzmivzbj/app-data/vhomework/listening-media" : import_path5.default.join(process.cwd(), ".data", "listening-media"));
var SLOW_API_LOG_MS = Math.max(0, Number(process.env.SLOW_API_LOG_MS || 500));
var LEARNING_HISTORY_REQUESTED = process.env.LEARNING_HISTORY_ENABLED === "true";
var LEARNING_HISTORY_ENABLED = LEARNING_HISTORY_REQUESTED && process.env.STORAGE_MODE === "sqlite";
var requestedAttemptDetailRetentionDays = Number(process.env.ATTEMPT_DETAIL_RETENTION_DAYS || 30);
var ATTEMPT_DETAIL_RETENTION_DAYS = Number.isFinite(requestedAttemptDetailRetentionDays) ? Math.max(1, Math.floor(requestedAttemptDetailRetentionDays)) : 30;
var CONFIGURED_PUBLIC_IDENTITY_SECRET = process.env.GUEST_PUBLIC_ID_SECRET?.trim();
if (process.env.NODE_ENV === "production" && LEARNING_HISTORY_ENABLED && !CONFIGURED_PUBLIC_IDENTITY_SECRET) {
  throw new Error(
    "GUEST_PUBLIC_ID_SECRET is required when Learning History is enabled in production."
  );
}
var PUBLIC_IDENTITY_SECRET = CONFIGURED_PUBLIC_IDENTITY_SECRET || process.env.DIAGNOSTIC_SECRET || `${process.env.FIREBASE_PROJECT_ID || "vhomework"}:public-identity-v1`;
var CONFIGURED_LISTENING_TICKET_SECRET = process.env.LISTENING_TICKET_SECRET?.trim() || CONFIGURED_PUBLIC_IDENTITY_SECRET || process.env.DIAGNOSTIC_SECRET?.trim();
if (process.env.NODE_ENV === "production" && !CONFIGURED_LISTENING_TICKET_SECRET) {
  throw new Error("LISTENING_TICKET_SECRET (or GUEST_PUBLIC_ID_SECRET) is required in production.");
}
var LISTENING_TICKET_SECRET = CONFIGURED_LISTENING_TICKET_SECRET || `${PUBLIC_IDENTITY_SECRET}:listening-ticket-v1`;
if (LEARNING_HISTORY_REQUESTED && !LEARNING_HISTORY_ENABLED) {
  console.warn("[History] LEARNING_HISTORY_ENABLED requires STORAGE_MODE=sqlite; history remains disabled.");
}
app2.use(import_express5.default.json());
app2.use((req, _res, next) => {
  withStorageRequestMetrics(() => {
    req.__requestStartedAt = performance.now();
    req.__storageRequestMetrics = getStorageRequestMetrics();
    next();
  });
});
import_fs5.default.mkdirSync(AUDIO_DIR, { recursive: true });
app2.use(AUDIO_PUBLIC_PREFIX, import_express5.default.static(AUDIO_DIR));
import_fs5.default.mkdirSync(LISTENING_MEDIA_DIR, { recursive: true });
app2.use(LISTENING_MEDIA_PUBLIC_PREFIX, import_express5.default.static(LISTENING_MEDIA_DIR, {
  immutable: true,
  maxAge: "365d"
}));
function sendApiError(res, err) {
  const status = isStorageUnavailableError(err) ? 503 : Number(err?.status || err?.statusCode || 500);
  res.status(status).json({ error: err?.message || "Internal server error", details: err?.details });
}
function createApiTiming(req, label) {
  const requestStartedAt = Number(req.__requestStartedAt || performance.now());
  let checkpoint = performance.now();
  const entries = [];
  const authDurationMs = Math.max(0, checkpoint - requestStartedAt);
  if (authDurationMs > 0) entries.push({ name: "auth", durationMs: authDurationMs });
  let finished = false;
  return {
    mark(name) {
      const now = performance.now();
      entries.push({
        name: name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40) || "step",
        durationMs: Math.max(0, now - checkpoint)
      });
      checkpoint = now;
    },
    finish(res) {
      if (finished) return;
      finished = true;
      const totalMs = Math.max(0, performance.now() - requestStartedAt);
      const storageMetrics = req.__storageRequestMetrics || getStorageRequestMetrics();
      const timingEntries = [
        ...entries,
        ...storageMetrics?.queryCount > 0 ? [{ name: "sqlite_query", durationMs: Number(storageMetrics.queryDurationMs || 0) }] : [],
        ...storageMetrics?.transactionCount > 0 ? [{ name: "sqlite_tx", durationMs: Number(storageMetrics.transactionDurationMs || 0) }] : [],
        { name: "total", durationMs: totalMs }
      ];
      const serverTiming = timingEntries.map((entry) => `${entry.name};dur=${entry.durationMs.toFixed(1)}`).join(", ");
      if (!res.headersSent) res.setHeader("Server-Timing", serverTiming);
      if (totalMs >= SLOW_API_LOG_MS) {
        const detail = entries.map((entry) => `${entry.name}=${entry.durationMs.toFixed(1)}ms`).join(" ");
        console.warn(
          `[PERF] ${label} total=${totalMs.toFixed(1)}ms sqliteQueries=${Number(storageMetrics?.queryCount || 0)} sqliteMs=${Number(storageMetrics?.queryDurationMs || 0).toFixed(1)} rowsRead=${Number(storageMetrics?.rowsRead || 0)} rowsWritten=${Number(storageMetrics?.rowsWritten || 0)} busyErrors=${Number(storageMetrics?.busyErrors || 0)} ${detail}`
        );
      }
    }
  };
}
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
var SUPER_ADMIN_EMAILS = /* @__PURE__ */ new Set(["linyi8901@gmail.com", "admin@vocabulary.edu.vn"]);
var VALID_ROLES = /* @__PURE__ */ new Set(["super_admin", "teacher", "student"]);
var VALID_STATUSES = /* @__PURE__ */ new Set(["active", "pending", "blocked", "deleted"]);
function attachLocalTestUser(req) {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : void 0;
  if (!isLocalServerAuthBypassAllowed({
    requested: LOCAL_AUTH_BYPASS_REQUESTED,
    nodeEnv: process.env.NODE_ENV,
    hostname: req.hostname,
    remoteAddress: req.socket.remoteAddress,
    bearerToken
  })) return false;
  req.user = { ...LOCAL_AUTH_BYPASS_USER };
  return true;
}
function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}
function normalizePhoneE164(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  let compact = raw.replace(/[^\d+]/g, "");
  if (compact.startsWith("00")) compact = `+${compact.slice(2)}`;
  if (compact.startsWith("+")) {
    const digits2 = compact.slice(1).replace(/\D/g, "");
    if (digits2.length < 8 || digits2.length > 15) return "";
    return `+${digits2}`;
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
function createHttpError(status, message, details) {
  const err = new Error(message);
  err.status = status;
  if (details) err.details = details;
  return err;
}
function getDefaultRoleForEmail(email) {
  return SUPER_ADMIN_EMAILS.has(normalizeEmail(email)) ? "super_admin" : "student";
}
function resolveTrustedRole(decodedToken, storedProfile = {}) {
  const email = normalizeEmail(decodedToken.email || storedProfile.email);
  const claimRole = String(decodedToken.role || "").trim();
  if (VALID_ROLES.has(claimRole)) return claimRole;
  if (SUPER_ADMIN_EMAILS.has(email)) return "super_admin";
  const storedRole = String(storedProfile.role || "").trim();
  if (storedRole === "teacher") return "teacher";
  if (storedRole === "student") return "student";
  return "student";
}
function resolveTrustedStatus(storedProfile = {}) {
  const status = String(storedProfile.status || "active").trim();
  return VALID_STATUSES.has(status) ? status : "active";
}
function buildUserProfileFromToken(decodedToken, storedProfile = {}) {
  const email = String(decodedToken.email || storedProfile.email || "");
  const tokenPhone = normalizePhoneE164(decodedToken.phone_number);
  const storedPhone = normalizePhoneE164(storedProfile.phone);
  const phone = tokenPhone || storedPhone;
  const phoneVerified = Boolean(tokenPhone) || Boolean(storedProfile.phoneVerified && storedPhone);
  return {
    id: decodedToken.uid,
    name: safeText(storedProfile.name || decodedToken.name || email.split("@")[0] || "Hoc sinh moi", 120),
    email,
    phone: phone || void 0,
    phoneVerified,
    role: resolveTrustedRole(decodedToken, storedProfile),
    status: resolveTrustedStatus(storedProfile),
    createdAt: storedProfile.createdAt || (/* @__PURE__ */ new Date()).toISOString()
  };
}
var authenticateUser = async (req, res, next) => {
  if (attachLocalTestUser(req)) return next();
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Kh\xF4ng t\xECm th\u1EA5y token x\xE1c th\u1EF1c. Vui l\xF2ng \u0111\u0103ng nh\u1EADp." });
  }
  const token = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    const uid = decodedToken.uid;
    const email = decodedToken.email || "";
    const userRef = adminDb.collection("users").doc(uid);
    const doc = await userRef.get();
    let userProfile;
    if (!doc.exists) {
      const defaultRole = getDefaultRoleForEmail(email);
      userProfile = buildUserProfileFromToken(decodedToken, {
        role: defaultRole,
        status: "active"
      });
      await userRef.set(userProfile);
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
    if (userProfile.status !== "active") {
      return res.status(403).json({ error: "T\xE0i kho\u1EA3n c\u1EE7a b\u1EA1n \u0111\xE3 b\u1ECB kh\xF3a. Vui l\xF2ng li\xEAn h\u1EC7 qu\u1EA3n tr\u1ECB vi\xEAn." });
    }
    req.user = userProfile;
    next();
  } catch (error) {
    console.error("Token verification failed:", error);
    if (isStorageUnavailableError(error)) {
      return sendApiError(res, error);
    }
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
var authenticateOptionalUser = async (req, _res, next) => {
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
    let userProfile;
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
      req.authBlocked = true;
    } else {
      req.user = userProfile;
    }
  } catch {
  }
  next();
};
var requestedRecentActivityDays = Number(process.env.RECENT_ACTIVITY_DAYS || 7);
var ACTIVITY_TTL_DAYS = Number.isFinite(requestedRecentActivityDays) ? Math.max(1, Math.floor(requestedRecentActivityDays)) : 7;
var ACTIVITY_TTL_MS = ACTIVITY_TTL_DAYS * 24 * 60 * 60 * 1e3;
var LEADERBOARD_RETENTION_DAYS = 62;
var LEADERBOARD_RETENTION_MS = LEADERBOARD_RETENTION_DAYS * 24 * 60 * 60 * 1e3;
function addDaysIso2(baseIso, days) {
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
function createSessionToken() {
  return import_crypto3.default.randomBytes(32).toString("hex");
}
function hashSessionToken(token) {
  return import_crypto3.default.createHash("sha256").update(token).digest("hex");
}
function sanitizePublicStudentRecord2(data) {
  return sanitizePublicStudentRecord(data || {}, PUBLIC_IDENTITY_SECRET);
}
function omitGuestCapabilitySecrets(profile) {
  if (!profile || typeof profile !== "object") return profile;
  const {
    accessTokenHash: _accessTokenHash,
    access_token_hash: _accessTokenHashSnake,
    guestAccessToken: _guestAccessToken,
    ...safe
  } = profile;
  return safe;
}
function appendLearningHistoryProjection(batch, projection) {
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
function getRequestSessionToken(req) {
  return safeText(req.body?.sessionToken || req.body?.runSecret || req.headers["x-session-token"], 200);
}
function omitSensitiveSessionFields(session) {
  const { sessionTokenHash, privateSnapshot, ...safeSession } = session;
  return safeSession;
}
var SESSION_V2_GAME_IDS = /* @__PURE__ */ new Set([
  "flashcard-en-vi",
  "flashcard-vi-en",
  "flashcard-sound",
  "quiz-en-vi",
  "quiz-vi-en",
  "quiz-sound",
  "fill-meaning",
  "fill-missing",
  "matching-word-meaning",
  "memory-match",
  "millionaire-vocab",
  "speaking-ai"
]);
var GAME_ACTION_BATCH_MAX_ITEMS = Math.max(
  1,
  Math.min(200, Number(process.env.GAME_ACTION_BATCH_MAX_ITEMS || 50))
);
var LAZY_SESSION_V3_ENABLED = process.env.LAZY_SESSION_V3_ENABLED !== "false";
function getClientRunCredentials(payload) {
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
function normalizeGameAnswer(value) {
  return String(value || "").normalize("NFKC").trim().toLowerCase().replace(/[‘’‚‛`´]/g, "'").replace(/\s+/g, " ");
}
function buildGameSessionSnapshot(vocabSet, gameId, requestedOrder = []) {
  const quizContract = getCurrentQuizContract(gameId);
  const canonicalItems = (Array.isArray(vocabSet.items) ? vocabSet.items : []).slice(0, 200).map((item, index) => ({
    id: safeText(item.id || `item-${index + 1}`, 160),
    term: safeText(item.term, 500),
    meaning: safeText(item.meaning, 1e3),
    example: safeText(item.example, 1500),
    ipa: safeText(item.ipa, 160),
    audioUrl: normalizeAudioUrlForClient(item.audioUrl),
    displayOrder: Number(item.displayOrder || index + 1)
  })).filter((item) => item.id && item.term).filter((item) => !quizContract || isQuizItemEligible(item, quizContract));
  const byId = new Map(canonicalItems.map((item) => [item.id, item]));
  const orderedIds = Array.isArray(requestedOrder) ? requestedOrder.map((id) => safeText(id, 160)).filter((id, index, list2) => id && byId.has(id) && list2.indexOf(id) === index) : [];
  const items = orderedIds.length ? orderedIds.map((id) => byId.get(id)) : canonicalItems;
  const config = quizContract ? quizContract : gameId.startsWith("flashcard-") ? { front: gameId === "flashcard-vi-en" ? "meaning" : gameId === "flashcard-sound" ? "sound_only" : "term" } : gameId.startsWith("fill-") ? { mode: gameId === "fill-missing" ? "missing_letters" : "complete" } : gameId === "millionaire-vocab" ? { maxQuestions: 15 } : gameId === "speaking-ai" ? { targetMode: "example_or_term" } : {};
  return { itemOrder: items.map((item) => item.id), items, config };
}
function sanitizeGameAction(input) {
  const type = safeText(input?.type, 60);
  const allowed = /* @__PURE__ */ new Set(["flashcard.rate", "quiz.answer", "fill.answer", "matching.attempt", "memory.move", "millionaire.answer", "speaking.attempt"]);
  if (!allowed.has(type)) throw createHttpError(400, "Game action type is not supported.");
  const sequence = Number(input?.sequence);
  if (!Number.isInteger(sequence) || sequence < 0 || sequence > 1e3) throw createHttpError(400, "Invalid game action sequence.");
  return {
    actionId: safeText(input?.actionId, 120),
    type,
    sequence,
    wordId: safeText(input?.wordId, 160),
    userAnswer: safeText(input?.userAnswer, 1e3),
    firstItemId: safeText(input?.firstItemId, 160),
    firstSide: input?.firstSide === "meaning" ? "meaning" : "term",
    secondItemId: safeText(input?.secondItemId, 160),
    secondSide: input?.secondSide === "meaning" ? "meaning" : "term",
    recognizedText: safeText(input?.recognizedText, 1e3),
    responseMs: Math.max(0, Math.min(12e4, Number(input?.responseMs || 0))),
    attemptNumber: Math.max(1, Math.min(20, Number(input?.attemptNumber || 1)))
  };
}
function sanitizeSubmittedGameActions(input) {
  if (!Array.isArray(input)) return [];
  if (input.length > 1e3) throw createHttpError(400, "C\xF3 qu\xE1 nhi\u1EC1u thao t\xE1c trong m\u1ED9t l\u01B0\u1EE3t ch\u01A1i.");
  const actions = input.map(sanitizeGameAction);
  const sequenceSet = /* @__PURE__ */ new Set();
  for (const action of actions) {
    if (sequenceSet.has(action.sequence)) {
      throw createHttpError(400, "Game action sequence b\u1ECB tr\xF9ng.");
    }
    sequenceSet.add(action.sequence);
  }
  return actions.sort((a, b) => a.sequence - b.sequence);
}
function dedupeStoredGameActions(actions) {
  const bySequence = /* @__PURE__ */ new Map();
  for (const action of actions) {
    const sequence = Number(action?.sequence);
    if (!Number.isInteger(sequence) || sequence < 0 || bySequence.has(sequence)) continue;
    bySequence.set(sequence, action);
  }
  return [...bySequence.values()].sort((a, b) => Number(a.sequence) - Number(b.sequence));
}
function getGameActionPersistence(gameId, snapshot) {
  const itemCount = Array.isArray(snapshot?.items) ? snapshot.items.length : 0;
  const effectiveItemCount = gameId === "millionaire-vocab" ? Math.min(itemCount, 15) : itemCount;
  if (gameId === "speaking-ai" || effectiveItemCount > GAME_ACTION_BATCH_MAX_ITEMS) return "incremental";
  return "submit_batch";
}
function speakingScore(target, recognized, responseMs) {
  const words = (value) => value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9'\s]/g, " ").split(/\s+/).filter(Boolean);
  const targetWords = words(target);
  const recognizedWords = words(recognized);
  if (!recognizedWords.length) return { score: 0, correctWords: 0, totalWords: Math.max(1, targetWords.length) };
  const totalWords = Math.max(1, targetWords.length);
  const correctWords = targetWords.filter((word, index) => word === recognizedWords[index]).length;
  const score = Math.min(100, Math.round(correctWords / totalWords * 60) + Math.round(Math.min(recognizedWords.length / totalWords, 1) * 20) + (responseMs <= 8e3 ? 10 : responseMs <= 15e3 ? 6 : 3) + 10);
  return { score, correctWords, totalWords };
}
function gradeGameSessionV2(session, actions) {
  const items = session.privateSnapshot?.items || [];
  const byId = new Map(items.map((item) => [item.id, item]));
  const ordered = [...actions].sort((a, b) => a.sequence - b.sequence);
  const details = [];
  let correct = 0;
  let incorrect = 0;
  let gameScore;
  if (session.gameId.startsWith("flashcard-")) {
    const latest = /* @__PURE__ */ new Map();
    ordered.filter((a) => a.type === "flashcard.rate" && byId.has(a.wordId)).forEach((a) => latest.set(a.wordId, a));
    items.forEach((item, index) => {
      const known = latest.get(item.id)?.userAnswer === "known";
      if (known) correct++;
      else incorrect++;
      details.push({ questionIndex: index, wordId: item.id, word: item.term, questionText: item.term, correctAnswer: item.meaning, userAnswer: known ? "\u0110\xE3 thu\u1ED9c" : "Ch\u01B0a thu\u1ED9c", isCorrect: known });
    });
  } else if (session.gameId.startsWith("quiz-")) {
    const contract = resolveStoredQuizContract(session.gameId, session.privateSnapshot?.config);
    if (!contract) throw createHttpError(400, "Quiz contract is not supported.");
    const latest = /* @__PURE__ */ new Map();
    ordered.filter((a) => a.type === "quiz.answer" && byId.has(a.wordId)).forEach((a) => latest.set(a.wordId, a));
    items.forEach((item, index) => {
      const answer = latest.get(item.id)?.userAnswer || "";
      const expected = getQuizAnswerValue(item, contract.answerType);
      const ok = answer === expected;
      ok ? correct++ : incorrect++;
      details.push({ questionIndex: index, wordId: item.id, word: item.term, questionText: getQuizQuestionText(item, contract.questionType), correctAnswer: expected, userAnswer: answer, selectedAnswer: answer, isCorrect: ok });
    });
  } else if (session.gameId.startsWith("fill-")) {
    const latest = /* @__PURE__ */ new Map();
    ordered.filter((a) => a.type === "fill.answer" && byId.has(a.wordId)).forEach((a) => latest.set(a.wordId, a));
    items.forEach((item, index) => {
      const answer = latest.get(item.id)?.userAnswer || "";
      const ok = normalizeGameAnswer(answer) === normalizeGameAnswer(item.term);
      ok ? correct++ : incorrect++;
      details.push({ questionIndex: index, wordId: item.id, word: item.term, questionText: item.meaning, correctAnswer: item.term, userAnswer: answer, isCorrect: ok });
    });
  } else if (session.gameId === "matching-word-meaning" || session.gameId === "memory-match") {
    const limit = session.gameId === "matching-word-meaning" ? 8 : 6;
    const active = items.slice(0, limit);
    const validIds = new Set(active.map((item) => item.id));
    const matched = /* @__PURE__ */ new Set();
    ordered.filter((a) => (a.type === "matching.attempt" || a.type === "memory.move") && validIds.has(a.firstItemId) && validIds.has(a.secondItemId)).forEach((a, index) => {
      const ok = a.firstItemId === a.secondItemId && a.firstSide !== a.secondSide && !matched.has(a.firstItemId);
      if (ok) matched.add(a.firstItemId);
      else incorrect++;
      details.push({ questionIndex: index, wordId: a.firstItemId, questionText: a.firstSide === "term" ? byId.get(a.firstItemId)?.term : byId.get(a.firstItemId)?.meaning, selectedAnswer: a.secondSide === "term" ? byId.get(a.secondItemId)?.term : byId.get(a.secondItemId)?.meaning, isCorrect: ok });
    });
    const mistakes = incorrect;
    correct = matched.size;
    incorrect += Math.max(0, active.length - matched.size);
    gameScore = matched.size === active.length ? Math.max(50, 100 - mistakes * (session.gameId === "matching-word-meaning" ? 5 : 4)) : Math.round(correct / Math.max(1, active.length) * 100);
  } else if (session.gameId === "millionaire-vocab") {
    const active = items.filter((item) => item.meaning).slice(0, 15);
    const latest = /* @__PURE__ */ new Map();
    ordered.filter((a) => a.type === "millionaire.answer" && byId.has(a.wordId)).forEach((a) => {
      if (!latest.has(a.wordId)) latest.set(a.wordId, a);
    });
    for (let index = 0; index < active.length; index++) {
      const item = active[index];
      const answer = latest.get(item.id)?.userAnswer || "";
      const ok = answer === item.meaning;
      if (ok) correct++;
      else incorrect++;
      if (answer) details.push({ questionIndex: index, wordId: item.id, word: item.term, questionText: item.term, correctAnswer: item.meaning, userAnswer: answer, selectedAnswer: answer, isCorrect: ok });
      if (answer && !ok) break;
    }
    incorrect = active.length - correct;
    const ladder = [100, 200, 300, 500, 1e3, 2e3, 4e3, 8e3, 16e3, 32e3, 64e3, 125e3, 25e4, 5e5, 1e6];
    gameScore = correct ? ladder[Math.min(correct, ladder.length) - 1] : 0;
  } else if (session.gameId === "speaking-ai") {
    const latest = /* @__PURE__ */ new Map();
    ordered.filter((a) => a.type === "speaking.attempt" && byId.has(a.wordId)).forEach((a) => latest.set(a.wordId, a));
    let totalScore = 0;
    items.forEach((item, index) => {
      const action = latest.get(item.id);
      const target = item.example || item.term;
      const result = speakingScore(target, action?.recognizedText || "", action?.responseMs || 0);
      totalScore += result.score;
      result.score >= 70 ? correct++ : incorrect++;
      details.push({ questionIndex: index, wordId: item.id, questionText: target, correctAnswer: target, userAnswer: action?.recognizedText || "", recognizedText: action?.recognizedText || "", pronunciationScore: result.score, correctWords: result.correctWords, totalWords: result.totalWords, responseMs: Math.max(0, Number(action?.responseMs || 0)), isCorrect: result.score >= 70 });
    });
    gameScore = items.length ? Math.round(totalScore / items.length) : 0;
  }
  const total = correct + incorrect;
  const score = gameScore !== void 0 && session.gameId !== "millionaire-vocab" ? gameScore : total ? Math.round(correct / total * 100) : 0;
  return { score, gameScore: session.gameId === "millionaire-vocab" ? gameScore : void 0, rawScore: session.gameId === "millionaire-vocab" ? gameScore : void 0, maxScore: session.gameId === "millionaire-vocab" ? 1e6 : 100, totalQuestions: total, correctAnswers: correct, incorrectAnswers: incorrect, accuracy: total ? Math.round(correct / total * 100) : 0, answerDetails: details.slice(0, 500) };
}
function getGuestProfileId(value) {
  return safeText(value, 120);
}
function isGuestOwnedRecord(data) {
  const guestId = getGuestProfileId(data?.guestId);
  const userId = safeText(data?.userId, 120);
  return Boolean(guestId && (data?.ownerType === "guest" || !userId || userId === guestId));
}
function getGuestActivityTime(data) {
  return data?.completedAt || data?.endedAt || data?.lastSavedAt || data?.updatedAt || data?.startedAt || data?.createdAt || "";
}
async function findLegacyGuestIdentity(guestIdValue) {
  const guestId = getGuestProfileId(guestIdValue);
  if (!guestId) return null;
  const [sessionsSnapshot, attemptsSnapshot] = await Promise.all([
    adminDb.collection("game_sessions").where("guestId", "==", guestId).get(),
    adminDb.collection("grammar_attempts").where("guestId", "==", guestId).get()
  ]);
  let latest = null;
  const collect = (data) => {
    if (!isGuestOwnedRecord(data) || getGuestProfileId(data.guestId) !== guestId) return;
    const displayName = safeText(data.studentName, 120);
    if (!displayName) return;
    const activityAt = getGuestActivityTime(data);
    if (!latest || new Date(activityAt || 0).getTime() >= new Date(latest.activityAt || 0).getTime()) {
      latest = { displayName, activityAt };
    }
  };
  sessionsSnapshot.forEach((doc) => collect({ id: doc.id, ...doc.data() }));
  attemptsSnapshot.forEach((doc) => collect({ id: doc.id, ...doc.data() }));
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
async function findExistingGuestIdentity(guestIdValue) {
  const guestId = getGuestProfileId(guestIdValue);
  if (!guestId) return null;
  const profileDoc = await adminDb.collection("guest_profiles").doc(guestId).get();
  if (profileDoc.exists) {
    const profile = { id: profileDoc.id, guestId, ...profileDoc.data() };
    if (profile.status === "blocked") {
      throw createHttpError(403, "H\u1ED3 s\u01A1 h\u1ECDc sinh n\xE0y \u0111\xE3 b\u1ECB kh\xF3a.");
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
var GUEST_ACTIVITY_TOUCH_INTERVAL_MS = Math.max(
  6e4,
  Number(process.env.GUEST_ACTIVITY_TOUCH_INTERVAL_MS || 5 * 6e4)
);
async function resolveGuestProfile(guestIdValue, studentNameValue, touchActivity = true, classInfo = {}) {
  const guestId = getGuestProfileId(guestIdValue);
  if (!guestId) throw createHttpError(400, "Thi\u1EBFu m\xE3 nh\u1EADn di\u1EC7n h\u1ECDc sinh.");
  const profileRef = adminDb.collection("guest_profiles").doc(guestId);
  const profileDoc = await profileRef.get();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  if (profileDoc.exists) {
    const existing = { id: profileDoc.id, ...profileDoc.data() };
    if (existing.status === "blocked") {
      throw createHttpError(403, "H\u1ED3 s\u01A1 h\u1ECDc sinh n\xE0y \u0111\xE3 b\u1ECB kh\xF3a.");
    }
    const displayName = safeText(existing.displayName || existing.name, 120);
    if (!displayName) {
      const legacyIdentity2 = await findLegacyGuestIdentity(guestId);
      if (legacyIdentity2) return legacyIdentity2;
      const validation2 = validateStudentDisplayName(studentNameValue);
      if (!validation2.valid) throw createHttpError(400, validation2.error);
      const repaired = {
        ...existing,
        displayName: validation2.value,
        name: validation2.value,
        normalizedName: normalizePersonName(validation2.value),
        updatedAt: now,
        lastActiveAt: touchActivity ? now : existing.lastActiveAt || now,
        needsReview: false
      };
      await profileRef.set(repaired);
      return repaired;
    }
    const classId = classInfo.verified ? safeText(classInfo.classId, 160) : "";
    const className = classInfo.verified ? safeText(classInfo.className, 240) : "";
    const lastActiveAtMs = new Date(existing.lastActiveAt || 0).getTime();
    const shouldTouchActivity = Boolean(
      touchActivity && (!Number.isFinite(lastActiveAtMs) || Date.now() - lastActiveAtMs >= GUEST_ACTIVITY_TOUCH_INTERVAL_MS)
    );
    const shouldUpdateClassId = Boolean(classId && classId !== safeText(existing.classId, 160));
    const shouldUpdateClassName = Boolean(className && className !== safeText(existing.className, 240));
    if (shouldTouchActivity || shouldUpdateClassId || shouldUpdateClassName) {
      await profileRef.update({
        ...shouldTouchActivity ? { lastActiveAt: now } : {},
        ...shouldUpdateClassId ? { classId } : {},
        ...shouldUpdateClassName ? { className } : {}
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
  const existingIds = /* @__PURE__ */ new Set();
  profilesSnapshot.forEach((doc) => existingIds.add(doc.id));
  const candidates = /* @__PURE__ */ new Map();
  const collect = (data) => {
    if (!isGuestOwnedRecord(data)) return;
    const guestId = getGuestProfileId(data.guestId);
    const activityAt = getActivityTime(data) || data.updatedAt || data.createdAt || (/* @__PURE__ */ new Date(0)).toISOString();
    const existing = candidates.get(guestId);
    const createdAt = data.createdAt || data.startedAt || activityAt;
    if (!existing || new Date(activityAt).getTime() >= new Date(existing.lastActiveAt).getTime()) {
      candidates.set(guestId, {
        guestId,
        displayName: safeText(data.studentName || "H\u1ECDc sinh", 120),
        createdAt: existing?.createdAt && new Date(existing.createdAt).getTime() < new Date(createdAt).getTime() ? existing.createdAt : createdAt,
        lastActiveAt: activityAt
      });
    } else if (new Date(createdAt).getTime() < new Date(existing.createdAt).getTime()) {
      existing.createdAt = createdAt;
    }
  };
  sessionsSnapshot.forEach((doc) => collect({ id: doc.id, ...doc.data() }));
  attemptsSnapshot.forEach((doc) => collect({ id: doc.id, ...doc.data() }));
  const missing = [...candidates.values()].filter((candidate) => !existingIds.has(candidate.guestId));
  for (let offset = 0; offset < missing.length; offset += 400) {
    const batch = adminDb.batch();
    for (const candidate of missing.slice(offset, offset + 400)) {
      const validation = validateStudentDisplayName(candidate.displayName);
      const now = (/* @__PURE__ */ new Date()).toISOString();
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
var legacyGuestProfileBackfillPromise = null;
async function ensureLegacyGuestProfilesOnce() {
  if (!legacyGuestProfileBackfillPromise) {
    legacyGuestProfileBackfillPromise = ensureLegacyGuestProfiles().catch((err) => {
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
  const users = /* @__PURE__ */ new Map();
  const guests = /* @__PURE__ */ new Map();
  usersSnapshot.forEach((doc) => {
    const data = doc.data();
    const name = safeText(data.name || data.displayName, 120);
    if (name) users.set(doc.id, name);
  });
  profilesSnapshot.forEach((doc) => {
    const data = doc.data();
    const name = safeText(data.displayName || data.name, 120);
    if (name) guests.set(doc.id, name);
  });
  return { users, guests };
}
function enrichStudentName(data, maps) {
  if (!data) return data;
  const guestId = getGuestProfileId(data.guestId);
  const userId = safeText(data.userId || data.studentId, 120);
  const canonicalName = isGuestOwnedRecord(data) ? maps.guests.get(guestId) : maps.users.get(userId);
  if (canonicalName) return { ...data, studentName: canonicalName };
  return guestId || userId ? data : { ...data, legacyUnlinked: true };
}
async function enrichStudentNames(items) {
  const maps = await getCanonicalStudentNameMaps();
  return items.map((item) => enrichStudentName(item, maps));
}
function getGameSessionActor(req, payload = {}) {
  if (req.authBlocked) return null;
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
function canUpdateGameSession(req, existing, payload) {
  if (req.authBlocked) return false;
  if (req.user && (existing.ownerKey === `user:${req.user.id}` || existing.userId === req.user.id)) {
    return true;
  }
  const sessionToken = getRequestSessionToken(req);
  if (sessionToken && existing.sessionTokenHash && hashSessionToken(sessionToken) === existing.sessionTokenHash) {
    return true;
  }
  if (!existing.sessionTokenHash && existing.guestId && safeText(payload.guestId, 120) === existing.guestId) {
    return true;
  }
  return false;
}
function isSuperAdmin3(user) {
  return user?.role === "super_admin";
}
function isTeacher(user) {
  return user?.role === "teacher";
}
function canManageVocabSet(user, set) {
  if (isSuperAdmin3(user)) return true;
  return isTeacher(user) && Boolean(set?.createdBy) && set.createdBy === user.id;
}
function canViewVocabSet(user, set) {
  if (!user) return getVocabVisibility(set) === "public";
  if (isSuperAdmin3(user)) return true;
  if (isTeacher(user)) return canManageVocabSet(user, set) || getVocabVisibility(set) === "public";
  return getVocabVisibility(set) === "public";
}
function canManageClass(user, classData) {
  if (isSuperAdmin3(user)) return true;
  return isTeacher(user) && Boolean(classData?.teacherId) && classData.teacherId === user.id;
}
function canViewClass(user, classData) {
  if (isSuperAdmin3(user)) return true;
  return canManageClass(user, classData);
}
function canManageAssignment(user, assignment, classData) {
  if (isSuperAdmin3(user)) return true;
  if (!isTeacher(user)) return false;
  if (assignment?.createdBy === user.id) return true;
  return Boolean(classData) && canManageClass(user, classData);
}
async function canManageGuestProfile(user, profile) {
  if (isSuperAdmin3(user)) return true;
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
        const classDoc = assignment.classId ? await adminDb.collection("classes").doc(assignment.classId).get() : null;
        const classData = classDoc?.exists ? { id: classDoc.id, ...classDoc.data() } : void 0;
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
async function canStaffViewLearningAttempt(actor, attempt) {
  const user = actor.userProfile || {
    id: actor.id,
    role: actor.role
  };
  if (isSuperAdmin3(user)) return true;
  if (!isTeacher(user)) return false;
  if (attempt.assignmentId) {
    const assignmentDoc = await adminDb.collection("assignments").doc(attempt.assignmentId).get();
    if (assignmentDoc.exists) {
      const assignment = { id: assignmentDoc.id, ...assignmentDoc.data() };
      const classDoc = assignment.classId ? await adminDb.collection("classes").doc(assignment.classId).get() : null;
      const classData = classDoc?.exists ? { id: classDoc.id, ...classDoc.data() } : void 0;
      if (canManageAssignment(user, assignment, classData)) return true;
    }
  }
  if (attempt.sourceType === "grammar") {
    const setDoc2 = await adminDb.collection("grammar_sets").doc(attempt.lessonId).get();
    return Boolean(setDoc2.exists && canManageGrammarSet(user, { id: setDoc2.id, ...setDoc2.data() }));
  }
  const setDoc = await adminDb.collection("vocab_sets").doc(attempt.lessonId).get();
  return Boolean(setDoc.exists && canManageVocabSet(user, { id: setDoc.id, ...setDoc.data() }));
}
function getAssignmentShareToken(assignment) {
  return String(assignment?.shareToken || assignment?.assignmentSlug || "").trim();
}
async function ensureAssignmentShareToken(assignment, docRef) {
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
function isAssignmentOpenForLearning(assignment, set) {
  if (!assignment || !set) return false;
  const assignmentStatus = String(assignment.status || "active").toLowerCase();
  if (["draft", "deleted", "inactive", "archived"].includes(assignmentStatus)) return false;
  const visibility = getVocabVisibility(set);
  return visibility === "public" || visibility === "assignment";
}
function getRequestVocabShareToken(req) {
  return safeText(req.body?.accessToken || req.headers["x-vocab-share-token"], 200);
}
async function resolveVocabLearningAccess(tokenValue, expectedVocabSetId = "", expectedAssignmentId = "") {
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
    return { accessType: "assignment", set, assignment };
  }
  if (expectedVocabSetId) {
    const setDoc = await adminDb.collection("vocab_sets").doc(expectedVocabSetId).get();
    if (!setDoc.exists) return null;
    const set = { id: setDoc.id, ...setDoc.data() };
    const setToken = String(set.shareToken || set.assignmentSlug || "").trim();
    if (setToken === token && getVocabVisibility(set) === "assignment") {
      return { accessType: "vocab_set", set, assignment: null };
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
    return { accessType: "assignment", set, assignment };
  }
  const setsSnapshot = await adminDb.collection("vocab_sets").get();
  for (const doc of setsSnapshot.docs || []) {
    const set = { id: doc.id, ...doc.data() };
    const setToken = String(set.shareToken || set.assignmentSlug || "").trim();
    if (setToken !== token || getVocabVisibility(set) !== "assignment") continue;
    if (expectedAssignmentId) return null;
    if (expectedVocabSetId && set.id !== expectedVocabSetId) return null;
    return { accessType: "vocab_set", set, assignment: null };
  }
  return null;
}
function canViewResultSession(user, session, vocabSetsById, assignmentsById, classesById) {
  if (isSuperAdmin3(user)) return true;
  if (!user) return false;
  if (user.role === "student") {
    return session.userId === user.id || session.studentId === user.id || session.ownerKey === `user:${user.id}`;
  }
  if (!isTeacher(user)) return false;
  const vocabSet = vocabSetsById.get(session.vocabSetId);
  if (vocabSet && canManageVocabSet(user, vocabSet)) return true;
  const assignment = session.assignmentId ? assignmentsById.get(session.assignmentId) : null;
  if (assignment) {
    const classData2 = assignment.classId ? classesById.get(assignment.classId) : null;
    if (canManageAssignment(user, assignment, classData2)) return true;
  }
  const classData = session.classId ? classesById.get(session.classId) : null;
  return Boolean(classData && canManageClass(user, classData));
}
function canViewGrammarActivity(user, attempt, set) {
  if (isSuperAdmin3(user)) return true;
  if (!user) return false;
  if (user.role === "student") return attempt.userId === user.id || attempt.studentId === user.id;
  return isTeacher(user) && canManageGrammarSet(user, set);
}
function getRequestGrammarAttemptToken(req) {
  return safeText(req.body?.attemptToken || req.query?.attemptToken || req.headers["x-grammar-attempt-token"], 160);
}
function sanitizeGrammarAnswerForStudent(answer, includeReview = false) {
  const safeAnswer2 = {
    id: answer.id,
    attemptQuestionId: answer.attemptQuestionId,
    questionId: answer.questionId,
    selectedOptionId: answer.selectedOptionId,
    textAnswer: answer.textAnswer,
    answeredAt: answer.answeredAt
  };
  if (includeReview) {
    safeAnswer2.correctOptionId = answer.correctOptionId;
    safeAnswer2.correctAnswer = answer.correctAnswer;
    safeAnswer2.isCorrect = Boolean(answer.isCorrect);
    safeAnswer2.scoreAwarded = Number(answer.scoreAwarded || 0);
  }
  return safeAnswer2;
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
    guestId: attempt.guestId || "",
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
      const questionType = getGrammarQuestionType(question.questionType, getGrammarQuestionType(set.questionType));
      const selectedOption = (question.optionsSnapshot || []).find((option) => option.id === answer?.selectedOptionId);
      const correctOption = (question.optionsSnapshot || []).find((option) => option.id === question.correctOptionId || option.id === answer?.correctOptionId);
      const userAnswer = questionType === "rewrite" ? answer?.textAnswer || "" : selectedOption?.text || "";
      const correctAnswer = questionType === "rewrite" ? question.correctAnswerSnapshot || answer?.correctAnswer || "" : correctOption?.text || "";
      return {
        questionIndex: index,
        wordId: question.questionId,
        questionText: question.questionSnapshot,
        selectedAnswer: userAnswer,
        userAnswer,
        correctAnswer,
        isCorrect: Boolean(answer?.isCorrect),
        options: (question.optionsSnapshot || []).map((option) => option.text).filter(Boolean)
      };
    })
  };
}
function leaderboardEventId(sourceType, sourceId) {
  const hash = import_crypto3.default.createHash("sha1").update(`${sourceType}:${sourceId}`).digest("hex");
  return `leaderboard-${hash}`;
}
function getLeaderboardEventTime(data) {
  return data.completedAt || data.endedAt || data.createdAt || data.startedAt || "";
}
function isOutsideLeaderboardRetention(data, nowMs = Date.now()) {
  const eventTime = getLeaderboardEventTime(data);
  return Boolean(eventTime && nowMs - new Date(eventTime).getTime() > LEADERBOARD_RETENTION_MS);
}
function isExpiredStoredLeaderboardEvent(data, nowMs = Date.now()) {
  if (data.expiresAt && new Date(data.expiresAt).getTime() < nowMs) return true;
  return isOutsideLeaderboardRetention(data, nowMs);
}
function sanitizeLeaderboardEvent(event) {
  const sourceType = safeText(event.sourceType || "vocabulary", 80);
  const sourceId = safeText(event.sourceId || event.id || "", 180);
  const completedAt = getLeaderboardEventTime(event);
  return {
    id: event.id || leaderboardEventId(sourceType, sourceId || import_crypto3.default.randomUUID()),
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
    expiresAt: event.expiresAt || addDaysIso2(completedAt || (/* @__PURE__ */ new Date()).toISOString(), LEADERBOARD_RETENTION_DAYS)
  };
}
function gameSessionToLeaderboardEvent(session) {
  const sourceId = safeText(session.id || session.sourceId || "", 180);
  return sanitizeLeaderboardEvent({
    ...session,
    id: leaderboardEventId("vocabulary", sourceId),
    sourceType: "vocabulary",
    sourceId,
    completedAt: session.completedAt || session.endedAt,
    expiresAt: addDaysIso2(session.completedAt || session.endedAt || (/* @__PURE__ */ new Date()).toISOString(), LEADERBOARD_RETENTION_DAYS)
  });
}
function grammarAttemptToLeaderboardEvent(attempt, set = {}) {
  const activity = grammarAttemptToActivity(attempt, set);
  const sourceId = safeText(attempt.id || activity.id, 180);
  return sanitizeLeaderboardEvent({
    ...activity,
    answerDetails: void 0,
    id: leaderboardEventId("grammar", sourceId),
    sourceType: "grammar",
    sourceId,
    grammarSetId: attempt.grammarSetId,
    expiresAt: addDaysIso2(activity.completedAt || (/* @__PURE__ */ new Date()).toISOString(), LEADERBOARD_RETENTION_DAYS)
  });
}
function mergeLeaderboardEvents(events) {
  const bySource = /* @__PURE__ */ new Map();
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
  const events = [];
  const leaderboardCutoff = new Date(Date.now() - LEADERBOARD_RETENTION_MS).toISOString();
  const storedSnapshot = await adminDb.collection("leaderboard_events").where("completedAt", ">=", leaderboardCutoff).get();
  storedSnapshot.forEach((doc) => {
    const data = sanitizeLeaderboardEvent({ id: doc.id, ...doc.data() });
    if (!isExpiredStoredLeaderboardEvent(data)) events.push(data);
  });
  const gameSnapshot = await adminDb.collection("game_sessions").where("completedAt", ">=", leaderboardCutoff).get();
  const grammarAttemptsSnapshot = await adminDb.collection("grammar_attempts").where("completedAt", ">=", leaderboardCutoff).get();
  const grammarSetsById = await getGrammarSetMap();
  const vocabSetsById = await getVocabSetMap();
  gameSnapshot.forEach((doc) => {
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
  grammarAttemptsSnapshot.forEach((doc) => {
    const data = { id: doc.id, ...doc.data() };
    if (data.status !== "completed" || !data.completedAt) return;
    if (isOutsideLeaderboardRetention(data)) return;
    events.push(grammarAttemptToLeaderboardEvent(data, grammarSetsById.get(data.grammarSetId)));
  });
  return enrichStudentNames(mergeLeaderboardEvents(events));
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
var SUPPORTED_TTS_PROVIDERS = /* @__PURE__ */ new Set(["ai33", "yupvox"]);
var TTS_FETCH_TIMEOUT_MS = Math.max(5e3, Number(process.env.TTS_FETCH_TIMEOUT_MS || 3e4));
var TTS_MAX_AUDIO_BYTES = Math.max(64 * 1024, Number(process.env.TTS_MAX_AUDIO_BYTES || 3 * 1024 * 1024));
var DEFAULT_TTS_VOICE_BY_PROVIDER = {
  ai33: {
    "en-US": "elevenlabs_wMBr6SfqQVuOqplK01NE",
    "en-GB": "elevenlabs_wMBr6SfqQVuOqplK01NE"
  },
  yupvox: {
    "en-US": "EBF147",
    "en-GB": "EBF147"
  }
};
var TTS_CONCURRENCY = Math.max(1, Math.min(10, Number(process.env.TTS_CONCURRENCY || 5)));
var ttsQueue = [];
var ttsInFlight = /* @__PURE__ */ new Map();
var isProcessingTtsQueue = false;
function normalizeTtsText(text4) {
  return text4.normalize("NFKC").trim().replace(/\s+/g, " ");
}
function sanitizeTtsInput(input) {
  const warnings = [];
  let text4 = String(input || "").normalize("NFKC").replace(/\r\n?/g, "\n").trim();
  if (!text4) return { text: "", warnings };
  const lines = text4.split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.length > 1) {
    warnings.push("Only the first non-empty line was used for TTS.");
    text4 = lines[0];
  }
  const dashSplit = text4.split(/\s+[–—-]\s+/);
  if (dashSplit.length > 1) {
    warnings.push("Text after the separator was removed before TTS.");
    text4 = dashSplit[0];
  }
  const beforeNotes = text4;
  text4 = text4.replace(/\s*[\(\[\{][^\)\]\}]{1,80}[\)\]\}]\s*$/g, "").trim();
  if (text4 !== beforeNotes) warnings.push("Trailing note text was removed before TTS.");
  const beforeIpa = text4;
  text4 = text4.replace(/\s+\/[^/]{1,80}\/\s*$/g, "").trim();
  if (text4 !== beforeIpa) warnings.push("Trailing IPA text was removed before TTS.");
  text4 = normalizeTtsText(text4).replace(/^[\s"'“”‘’.,;:!?]+|[\s"'“”‘’.,;:!?]+$/g, "").trim();
  if (text4.length > 120) {
    warnings.push("TTS text was shortened to 120 characters.");
    text4 = text4.slice(0, 120).trim();
  }
  return { text: text4, warnings };
}
function normalizeTtsSettings(settings = {}) {
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
function createAudioHash(text4, settings) {
  const normalizedText = normalizeTtsText(text4);
  const generationSpeed = settings.provider === "yupvox" ? DEFAULT_TTS_SPEED : settings.speed;
  return import_crypto3.default.createHash("sha256").update(`${settings.provider}|${settings.lang}|${settings.voice}|${generationSpeed}|${normalizedText}`).digest("hex");
}
function audioFileName(audioHash) {
  return `${audioHash}.mp3`;
}
function audioFilePath(audioHash) {
  return import_path5.default.join(AUDIO_DIR, audioFileName(audioHash));
}
function audioPublicUrl(audioHash) {
  return `${AUDIO_PUBLIC_PREFIX}/${audioFileName(audioHash)}`;
}
function getAi33ApiKey() {
  return process.env.AI33_API_KEY || process.env.TTS_API_KEY || "";
}
function getYupVoxApiKey() {
  return process.env.YUPVOX_API_KEY || "";
}
function getAi33TaskUrl(taskId) {
  const template = process.env.AI33_TASK_STATUS_URL_TEMPLATE || "https://api.ai33.pro/v1/task/{taskId}";
  return template.replace("{taskId}", encodeURIComponent(taskId));
}
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function fetchWithTimeout(url, init = {}, timeoutMs = TTS_FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal
    });
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs}ms.`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
async function responseBufferWithCap(res, maxBytes) {
  const contentLength = Number(res.headers.get("content-length") || 0);
  if (contentLength > maxBytes) {
    throw new Error(`Downloaded TTS file is too large (${contentLength} bytes).`);
  }
  const body = res.body;
  if (body?.getReader) {
    const reader = body.getReader();
    const chunks = [];
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
    return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), total);
  }
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  if (buffer.byteLength > maxBytes) {
    throw new Error(`Downloaded TTS file is too large (${buffer.byteLength} bytes).`);
  }
  return buffer;
}
function writeFileAtomic(targetPath, buffer) {
  const dir = import_path5.default.dirname(targetPath);
  import_fs5.default.mkdirSync(dir, { recursive: true });
  const tempPath = import_path5.default.join(dir, `.${import_path5.default.basename(targetPath)}.${process.pid}.${Date.now()}.tmp`);
  try {
    import_fs5.default.writeFileSync(tempPath, buffer, { flag: "wx" });
    import_fs5.default.renameSync(tempPath, targetPath);
  } finally {
    if (import_fs5.default.existsSync(tempPath)) {
      try {
        import_fs5.default.unlinkSync(tempPath);
      } catch {
      }
    }
  }
}
async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
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
async function requestAi33TtsTask(text4, settings, fileName) {
  const apiKey = getAi33ApiKey();
  if (!apiKey) throw new Error("AI33_API_KEY/TTS_API_KEY is not configured.");
  const form = new FormData();
  form.set("text", text4);
  form.set("voice_id", settings.voice);
  form.set("speed", String(settings.speed));
  form.set("with_transcript", "false");
  form.set("file_name", fileName);
  const res = await fetchWithTimeout("https://api.ai33.pro/v3/text-to-speech", {
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
    const res = await fetchWithTimeout(getAi33TaskUrl(taskId), {
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
async function requestTtsProviderAudioUrl(text4, settings, fileName) {
  if (settings.provider === "yupvox") {
    const audioUrl = await generateYupVoxAudioUrl({
      apiKey: getYupVoxApiKey(),
      baseUrl: process.env.YUPVOX_BASE_URL,
      voiceId: settings.voice,
      text: text4,
      maxPollAttempts: Number(process.env.YUPVOX_TTS_POLL_ATTEMPTS || 40),
      pollIntervalMs: Number(process.env.YUPVOX_TTS_POLL_INTERVAL_MS || 1500),
      fetchImpl: fetchWithTimeout,
      wait: delay
    });
    return { audioUrl, validateAudioUrl: assertSafeYupVoxAudioUrl };
  }
  const taskId = await requestAi33TtsTask(text4, settings, fileName);
  return { audioUrl: await pollAi33AudioUrl(taskId) };
}
async function downloadAudioToCache(sourceUrl, targetPath, validateAudioUrl) {
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
async function generateCachedTtsAudio(inputText, settings, force = false) {
  const sanitized = sanitizeTtsInput(inputText);
  if (!sanitized.text) throw new Error("Missing TTS text after cleanup.");
  const audioHash = createAudioHash(sanitized.text, settings);
  const targetPath = audioFilePath(audioHash);
  const targetUrl = audioPublicUrl(audioHash);
  if (!force && import_fs5.default.existsSync(targetPath)) {
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
    if (force && import_fs5.default.existsSync(targetPath)) {
      try {
        import_fs5.default.unlinkSync(targetPath);
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
  const tasks = [];
  let hasInitialUpdates = false;
  for (const item of items) {
    if (!selected.has(item.id)) continue;
    const sanitized = sanitizeTtsInput(String(item.term || ""));
    if (!sanitized.text) continue;
    const audioHash = createAudioHash(sanitized.text, job.settings);
    const targetPath = audioFilePath(audioHash);
    const existingReady = !job.force && item.audioHash === audioHash && item.audioUrl && import_fs5.default.existsSync(targetPath);
    if (existingReady) continue;
    if (!job.force && import_fs5.default.existsSync(targetPath)) {
      hasInitialUpdates = true;
      items = items.map(
        (current) => current.id === item.id ? mergeItemAudioState(current, {
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
          audioGeneratedAt: current.audioGeneratedAt || (/* @__PURE__ */ new Date()).toISOString()
        }) : current
      );
      continue;
    }
    hasInitialUpdates = true;
    tasks.push({ itemId: item.id, sanitized, audioHash, targetPath });
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
  }
  if (hasInitialUpdates) {
    await saveVocabSetItems(job.vocabSetId, items);
  }
  if (tasks.length === 0) return;
  const taskGroups = /* @__PURE__ */ new Map();
  for (const task of tasks) {
    const group = taskGroups.get(task.audioHash) || [];
    group.push(task);
    taskGroups.set(task.audioHash, group);
  }
  const generated = await runWithConcurrency([...taskGroups.entries()], TTS_CONCURRENCY, async ([audioHash, group]) => {
    try {
      const result = await generateCachedTtsAudio(group[0].sanitized.text, job.settings, job.force);
      return { audioHash, result, error: null };
    } catch (err) {
      return { audioHash, result: null, error: err };
    }
  });
  const generatedByHash = new Map(generated.map((result) => [result.audioHash, result]));
  items = items.map((current) => {
    const task = tasks.find((entry) => entry.itemId === current.id);
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
      audioGeneratedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  });
  await saveVocabSetItems(job.vocabSetId, items);
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
var STALI_API_KEY = process.env.STALI_API_KEY?.trim() || "";
var STALI_BASE_URL = process.env.STALI_BASE_URL?.trim() || STALI_DEFAULT_BASE_URL;
var STALI_SMART_IMPORT_PROVIDERS = getStaliSmartImportProviders(STALI_API_KEY);
var DEVQUOTA_API_KEY = process.env.DEVQUOTA_API_KEY?.trim() || "";
var DEVQUOTA_BASE_URL = process.env.DEVQUOTA_BASE_URL?.trim() || DEVQUOTA_DEFAULT_BASE_URL;
var DEVQUOTA_SMART_IMPORT_PROVIDERS = getDevQuotaSmartImportProviders(DEVQUOTA_API_KEY);
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
  if (error?.name === "AbortError") {
    return `${provider}: request b\u1ECB h\u1EE7y do v\u01B0\u1EE3t th\u1EDDi gian x\u1EED l\xFD.`;
  }
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
  const text4 = extractOpenAIText(data);
  if (!text4) {
    throw new Error("OpenAI response did not include text output.");
  }
  return text4;
}
async function generateAiVisionJson(prompt, images, options, signal) {
  const errors = [];
  const preferred = options.preferredProvider || "stali:gpt-5.6-sol";
  if (!isStaliProviderId(preferred) && !isDevQuotaProviderId(preferred)) {
    const unsupported = new Error(`Nh\xE0 cung c\u1EA5p AI "${preferred}" ch\u01B0a \u0111\u01B0\u1EE3c backend h\u1ED7 tr\u1EE3.`);
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
        baseUrl: STALI_BASE_URL
      });
      if (result) return { ...result, errors };
      errors.push("Stali: STALI_API_KEY is not configured.");
    } catch (error) {
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
        baseUrl: DEVQUOTA_BASE_URL
      });
      if (result) return { ...result, errors };
      errors.push("DevQuota: DEVQUOTA_API_KEY is not configured.");
    } catch (error) {
      if (error?.status === 400 || error?.status === 413) throw error;
      errors.push(sanitizeAiError("DevQuota", error));
    }
  }
  const unavailable = new Error("Kh\xF4ng c\xF3 nh\xE0 cung c\u1EA5p AI th\u1ECB gi\xE1c kh\u1EA3 d\u1EE5ng.");
  unavailable.status = 503;
  unavailable.details = errors;
  unavailable.code = "AI_PROVIDER_UNAVAILABLE";
  throw unavailable;
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
    const text4 = await generateWithOpenAI(prompt);
    if (text4) {
      return {
        text: text4.trim(),
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
function parseAiJson(text4) {
  const trimmed = String(text4 || "").trim();
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
var PHONE_AUTH_WINDOW_MS = 10 * 60 * 1e3;
var PHONE_AUTH_MAX_ATTEMPTS = 5;
var phoneAuthAttempts = /* @__PURE__ */ new Map();
function getRequestIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.socket.remoteAddress || "unknown";
}
function assertPhoneAuthRateLimit(req, phone) {
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
async function findUserByPhone(normalizedPhone, rawPhone = "") {
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
async function verifyFirebasePassword(email, password) {
  const apiKey = getFirebaseWebApiKey();
  if (!apiKey) throw createHttpError(503, "Phone password login is not configured.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1e4);
  try {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
      signal: controller.signal
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.localId) {
      throw createHttpError(401, "Phone number or password is incorrect.");
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}
app2.post("/api/auth/email-by-phone", async (req, res) => {
  try {
    const normalizedPhone = normalizePhoneE164(req.body?.phone);
    if (!normalizedPhone) return res.status(400).json({ error: "Invalid phone number." });
    assertPhoneAuthRateLimit(req, normalizedPhone);
    return res.json({ ok: true, message: "Use /api/auth/login-by-phone to sign in without exposing account email." });
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
    sendApiError(res, err);
  }
});
app2.post("/api/auth/login-by-phone", async (req, res) => {
  try {
    const rawPhone = String(req.body?.phone || "");
    const password = String(req.body?.password || "");
    const normalizedPhone = normalizePhoneE164(rawPhone);
    if (!normalizedPhone || !password) {
      return res.status(400).json({ error: "Phone number and password are required." });
    }
    assertPhoneAuthRateLimit(req, normalizedPhone);
    const userRecord = await findUserByPhone(normalizedPhone, rawPhone);
    const email = normalizeEmail(userRecord?.email);
    if (!userRecord || !email) {
      throw createHttpError(401, "Phone number or password is incorrect.");
    }
    const verified = await verifyFirebasePassword(email, password);
    if (verified.localId !== userRecord.id) {
      throw createHttpError(401, "Phone number or password is incorrect.");
    }
    if (userRecord.phone !== normalizedPhone) {
      await adminDb.collection("users").doc(userRecord.id).set({
        ...userRecord,
        phone: normalizedPhone,
        phoneVerified: Boolean(userRecord.phoneVerified)
      });
    }
    const customToken = await adminAuth.createCustomToken(verified.localId);
    return res.json({ customToken });
  } catch (err) {
    sendApiError(res, err);
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
      phone: normalizedPhone || void 0,
      phoneVerified: Boolean(req.user.phoneVerified && normalizedPhone && normalizedPhone === existingPhone),
      role: req.user.role,
      status: req.user.status,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    await userRef.set(updatedProfile);
    res.json(updatedProfile);
  } catch (err) {
    sendApiError(res, err);
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
app2.post("/api/guest-profiles/resolve", async (req, res) => {
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
      ...profile.guestAccessToken ? {
        guestAccessToken: profile.guestAccessToken,
        guestAccessTokenVersion: profile.guestAccessTokenVersion || 1
      } : {}
    });
  } catch (err) {
    sendApiError(res, err);
  }
});
app2.post("/api/guest-profiles/identify", async (req, res) => {
  try {
    const profile = await findExistingGuestIdentity(req.body?.guestId);
    if (!profile) {
      return res.status(404).json({
        error: "Kh\xF4ng t\xECm th\u1EA5y h\u1ED3 s\u01A1 h\u1ECDc sinh \u0111\xE3 \u0111\u0103ng k\xFD.",
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
  } catch (err) {
    sendApiError(res, err);
  }
});
app2.use(
  "/api/my-learning-history",
  createLearningHistoryRouter({
    enabled: LEARNING_HISTORY_ENABLED,
    authenticateOptionalUser,
    slowRequestMs: SLOW_API_LOG_MS,
    canStaffViewAttempt: canStaffViewLearningAttempt
  })
);
app2.use(
  "/api/listening-library",
  createListeningLibraryRouter()
);
app2.use(
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
      reason: process.env.LISTENING_SMART_IMPORT_ENABLED === "false" ? "Smart Import \u0111\xE3 b\u1ECB t\u1EAFt b\u1EB1ng c\u1EA5u h\xECnh m\xE1y ch\u1EE7." : void 0,
      analyzeVision: STALI_API_KEY || DEVQUOTA_API_KEY ? generateAiVisionJson : void 0,
      providers: [
        ...STALI_SMART_IMPORT_PROVIDERS,
        ...DEVQUOTA_SMART_IMPORT_PROVIDERS
      ]
    }
  })
);
app2.use(
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
      reason: process.env.LISTENING_SMART_IMPORT_ENABLED === "false" ? "Smart Import \u0111\xE3 b\u1ECB t\u1EAFt b\u1EB1ng c\u1EA5u h\xECnh m\xE1y ch\u1EE7." : void 0,
      analyzeVision: STALI_API_KEY || DEVQUOTA_API_KEY ? generateAiVisionJson : void 0,
      providers: [
        ...STALI_SMART_IMPORT_PROVIDERS,
        ...DEVQUOTA_SMART_IMPORT_PROVIDERS
      ]
    }
  })
);
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
  const text4 = String(value || "").trim().toLowerCase();
  const match = ALLOWED_PARTS_OF_SPEECH.find((pos) => pos.toLowerCase() === text4);
  if (match) return match;
  if (text4.includes("pronoun")) return "Pronoun";
  if (text4.includes("adjective")) return "Adjective";
  if (text4.includes("adverb")) return "Adverb";
  if (text4.includes("preposition")) return "Preposition";
  if (text4.includes("conjunction")) return "Conjunction";
  if (text4.includes("interjection")) return "Interjection";
  if (text4.includes("article")) return "Article";
  if (text4.includes("determiner")) return "Determiner";
  if (text4.includes("verb")) return "Verb";
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
  const templates2 = [
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
  const index = Math.abs(hashText(`${wordForSentence}|${meaningForSentence}`)) % templates2.length;
  return templates2[index];
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
    const access = await resolveVocabLearningAccess(token);
    if (!access) {
      return res.status(404).json({ error: "Kh\xF4ng t\xECm th\u1EA5y b\xE0i t\u1EADp ho\u1EB7c link kh\xF4ng h\u1EE3p l\u1EC7" });
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
  } catch (err) {
    sendApiError(res, err);
  }
});
app2.get("/api/public/vocab-sets", async (req, res) => {
  try {
    const snapshot = await adminDb.collection("vocab_sets").get();
    const list2 = [];
    snapshot.forEach((doc) => {
      const set = doc.data();
      const normalizedVisibility = getVocabVisibility(set);
      if (normalizedVisibility !== "public") return;
      list2.push(stripPrivateVocabSetFields({
        ...set,
        visibility: normalizedVisibility,
        status: toLegacyStatus(normalizedVisibility)
      }));
    });
    res.json(list2);
  } catch (err) {
    sendApiError(res, err);
  }
});
app2.get("/api/public/results", async (req, res) => {
  try {
    const recentCutoff = new Date(Date.now() - ACTIVITY_TTL_MS).toISOString();
    const snapshot = await adminDb.collection("game_sessions").where("completedAt", ">=", recentCutoff).get();
    const grammarAttemptsSnapshot = await adminDb.collection("grammar_attempts").where("completedAt", ">=", recentCutoff).get();
    const listeningAttemptsSnapshot = await adminDb.collection("listening_attempts").where("completedAt", ">=", recentCutoff).get();
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
    const list2 = [];
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
      list2.push({
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
      list2.push(activity);
    });
    listeningAttemptsSnapshot.forEach((doc) => {
      const data = { id: doc.id, ...doc.data() };
      if (!data.completedAt || new Date(getActivityTime(data)).getTime() < cutoff) return;
      list2.push(listeningAttemptToActivity(data));
    });
    list2.sort((a, b) => new Date(getActivityTime(b)).getTime() - new Date(getActivityTime(a)).getTime());
    const named = await enrichStudentNames(list2);
    res.json(named.map(sanitizePublicStudentRecord2));
  } catch (err) {
    sendApiError(res, err);
  }
});
app2.get("/api/public/leaderboard-results", async (req, res) => {
  try {
    const list2 = await loadLeaderboardEventsFromSources();
    res.json(list2.map(sanitizePublicStudentRecord2));
  } catch (err) {
    sendApiError(res, err);
  }
});
app2.get("/api/vocab-sets", authenticateUser, async (req, res) => {
  try {
    const { search, grade, status, visibility } = req.query;
    const snapshot = await adminDb.collection("vocab_sets").get();
    let list2 = [];
    snapshot.forEach((doc) => {
      const set = doc.data();
      const normalizedVisibility = getVocabVisibility(set);
      list2.push(stripPrivateVocabSetFields({
        ...set,
        visibility: normalizedVisibility,
        status: toLegacyStatus(normalizedVisibility)
      }));
    });
    if (search) {
      const s = search.toLowerCase();
      list2 = list2.filter(
        (set) => set.title.toLowerCase().includes(s) || set.description.toLowerCase().includes(s) || set.subject.toLowerCase().includes(s)
      );
    }
    if (grade) {
      list2 = list2.filter((set) => set.gradeLevel === grade);
    }
    if (status) {
      list2 = list2.filter((set) => set.status === status);
    }
    if (visibility) {
      list2 = list2.filter((set) => getVocabVisibility(set) === visibility);
    }
    list2 = list2.filter((set) => canViewVocabSet(req.user, set));
    res.json(list2);
  } catch (err) {
    sendApiError(res, err);
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
    res.status(201).json(stripPrivateVocabSetFields(newSet));
  } catch (err) {
    sendApiError(res, err);
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
    if (!canManageVocabSet(req.user, existingDoc.data())) {
      return res.status(403).json({ error: "Ban khong co quyen sua bo tu vung nay." });
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
    res.json(stripPrivateVocabSetFields(updatedSet));
  } catch (err) {
    sendApiError(res, err);
  }
});
app2.post("/api/tts/preview", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
  try {
    const settings = normalizeTtsSettings(req.body?.settings || req.body || {});
    const text4 = String(req.body?.text || "apple").trim();
    const force = Boolean(req.body?.force);
    if (!text4) return res.status(400).json({ error: "Missing preview text." });
    const result = await generateCachedTtsAudio(text4, settings, force);
    res.json({
      audioUrl: result.audioUrl,
      audioHash: result.audioHash,
      cached: result.cached,
      ttsText: result.ttsText,
      warnings: result.warnings
    });
  } catch (err) {
    sendApiError(res, err);
  }
});
app2.post("/api/tts/batch-preview", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
  try {
    const settings = normalizeTtsSettings(req.body?.settings || {});
    const force = Boolean(req.body?.force);
    const rawItems = Array.isArray(req.body?.items) ? req.body.items.slice(0, 200) : [];
    if (rawItems.length === 0) return res.status(400).json({ error: "Missing TTS items." });
    const prepared = rawItems.map((item, index) => {
      const text4 = String(item?.text || item?.term || "").trim();
      const sanitized = sanitizeTtsInput(text4);
      const audioHash = sanitized.text ? createAudioHash(sanitized.text, settings) : "";
      return {
        id: String(item?.id || `item-${index + 1}`),
        text: text4,
        sanitized,
        audioHash
      };
    });
    const grouped = /* @__PURE__ */ new Map();
    const invalidResults = /* @__PURE__ */ new Map();
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
        return { audioHash, result, error: null };
      } catch (err) {
        return { audioHash, result: null, error: err };
      }
    });
    const generatedByHash = new Map(generated.map((item) => [item.audioHash, item]));
    const items = prepared.map((item) => {
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
  } catch (err) {
    sendApiError(res, err);
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
    const upstream = await fetchWithTimeout(`https://api.ai33.pro/v3/voices?${params.toString()}`, {
      headers: { "xi-api-key": apiKey }
    });
    const data = await upstream.json().catch(() => ({}));
    res.status(upstream.status).json(data);
  } catch (err) {
    sendApiError(res, err);
  }
});
app2.get("/api/vocab-sets/:id/audio/status", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
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
    sendApiError(res, err);
  }
});
app2.post("/api/vocab-sets/:id/audio/generate-missing", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
  try {
    const doc = await adminDb.collection("vocab_sets").doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: "Vocabulary set not found." });
    if (!canManageVocabSet(req.user, doc.data())) {
      return res.status(403).json({ error: "Ban khong co quyen tao audio cho bo tu vung nay." });
    }
    const settings = normalizeTtsSettings(req.body?.settings || doc.data().ttsSettings || {});
    const itemIds = Array.isArray(req.body?.itemIds) ? req.body.itemIds.map(String) : void 0;
    const force = Boolean(req.body?.force);
    enqueueVocabSetAudio(req.params.id, settings, itemIds, force);
    res.json({ queued: true, itemIds: itemIds || null, force });
  } catch (err) {
    sendApiError(res, err);
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
    if (!canManageVocabSet(req.user, existing.data())) {
      return res.status(403).json({ error: "Ban khong co quyen xoa bo tu vung nay." });
    }
    const setDetails = existing.data();
    const relatedAssignmentsForDelete = await adminDb.collection("assignments").where("vocabSetId", "==", id).get();
    if (!isSuperAdmin3(req.user)) {
      const classesSnapshot = await adminDb.collection("classes").get();
      const classesById = /* @__PURE__ */ new Map();
      classesSnapshot.forEach((doc) => {
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
    const batch = adminDb.batch();
    relatedAssignmentsForDelete.forEach((doc) => {
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
    sendApiError(res, err);
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
    if (!canViewVocabSet(req.user, original)) {
      return res.status(403).json({ error: "Ban khong co quyen nhan ban bo tu vung nay." });
    }
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
    res.json(stripPrivateVocabSetFields(clone));
  } catch (err) {
    sendApiError(res, err);
  }
});
app2.get("/api/classes", authenticateUser, async (req, res) => {
  try {
    const snapshot = await adminDb.collection("classes").get();
    const list2 = [];
    snapshot.forEach((doc) => {
      const classData = { id: doc.id, ...doc.data() };
      if (canViewClass(req.user, classData)) list2.push(classData);
    });
    res.json(list2);
  } catch (err) {
    sendApiError(res, err);
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
    sendApiError(res, err);
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
    if (!canManageClass(req.user, existing.data())) {
      return res.status(403).json({ error: "Ban khong co quyen xoa lop hoc nay." });
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
    sendApiError(res, err);
  }
});
app2.get("/api/class-members", authenticateUser, async (req, res) => {
  try {
    const classesSnapshot = await adminDb.collection("classes").get();
    const classesById = /* @__PURE__ */ new Map();
    classesSnapshot.forEach((doc) => {
      const classData = { id: doc.id, ...doc.data() };
      classesById.set(classData.id, classData);
    });
    const snapshot = await adminDb.collection("class_members").get();
    const list2 = [];
    snapshot.forEach((doc) => {
      const member = { id: doc.id, ...doc.data() };
      const classData = member.classId ? classesById.get(member.classId) : null;
      if (classData && canViewClass(req.user, classData)) list2.push(member);
    });
    res.json(list2);
  } catch (err) {
    sendApiError(res, err);
  }
});
app2.post("/api/classes/:classId/members", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
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
  } catch (err) {
    sendApiError(res, err);
  }
});
app2.delete("/api/classes/:classId/members/:memberId", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
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
  } catch (err) {
    sendApiError(res, err);
  }
});
app2.get("/api/assignments", authenticateUser, async (req, res) => {
  try {
    const classesSnapshot = await adminDb.collection("classes").get();
    const classesById = /* @__PURE__ */ new Map();
    classesSnapshot.forEach((doc) => {
      const classData = { id: doc.id, ...doc.data() };
      classesById.set(classData.id, classData);
    });
    const snapshot = await adminDb.collection("assignments").get();
    const list2 = [];
    for (const doc of snapshot.docs || []) {
      const assignment = await ensureAssignmentShareToken({ id: doc.id, ...doc.data() }, doc.ref);
      const classData = assignment.classId ? classesById.get(assignment.classId) : null;
      if (canManageAssignment(req.user, assignment, classData)) list2.push(assignment);
    }
    res.json(list2);
  } catch (err) {
    sendApiError(res, err);
  }
});
app2.post("/api/assignments", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
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
    const resourceType = payload.resourceType === "listening" ? "listening" : payload.resourceType === "mover_reading_writing" ? "mover_reading_writing" : "vocabulary";
    let resource;
    if (resourceType === "listening") {
      const resourceId = String(payload.resourceId || payload.listeningSetId || "");
      const listeningDoc = await adminDb.collection("listening_sets").doc(resourceId).get();
      if (!listeningDoc.exists) return res.status(404).json({ error: "Listening set not found." });
      resource = { id: listeningDoc.id, ...listeningDoc.data() };
      const canManageListening = req.user.role === "super_admin" || req.user.role === "teacher" && resource.ownerId === req.user.id;
      if (!canManageListening || resource.status !== "published" || resource.visibility === "draft") {
        return res.status(403).json({ error: "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n giao b\u1ED9 \u0111\u1EC1 nghe n\xE0y." });
      }
    } else if (resourceType === "mover_reading_writing") {
      const resourceId = String(payload.resourceId || payload.moverReadingWritingSetId || "");
      const readingWritingDoc = await adminDb.collection("mover_reading_sets").doc(resourceId).get();
      if (!readingWritingDoc.exists) return res.status(404).json({ error: "Mover Reading & Writing set not found." });
      resource = { id: readingWritingDoc.id, ...readingWritingDoc.data() };
      const canManageReadingWriting = req.user.role === "super_admin" || req.user.role === "teacher" && resource.ownerId === req.user.id;
      if (!canManageReadingWriting || resource.status !== "published" || resource.visibility === "draft") {
        return res.status(403).json({ error: "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n giao b\u1ED9 \u0111\u1EC1 Mover Reading & Writing n\xE0y." });
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
      ...resourceType === "vocabulary" ? {
        vocabSetId: resource.id,
        vocabSetTitle: resource.title || payload.vocabSetTitle || ""
      } : resourceType === "listening" ? {
        listeningSetId: resource.id,
        listeningSetTitle: resource.title || payload.resourceTitle || "",
        gameId: "listening-five-part"
      } : {
        moverReadingWritingSetId: resource.id,
        moverReadingWritingSetTitle: resource.title || payload.resourceTitle || "",
        gameId: "mover-reading-writing"
      },
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
    sendApiError(res, err);
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
    const assignDetails = { id: existing.id || id, ...existing.data() };
    const classDoc = assignDetails.classId ? await adminDb.collection("classes").doc(assignDetails.classId).get() : null;
    const classData = classDoc?.exists ? { id: classDoc.id, ...classDoc.data() } : null;
    if (!canManageAssignment(req.user, assignDetails, classData)) {
      return res.status(403).json({ error: "Ban khong co quyen xoa bai giao nay." });
    }
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
    sendApiError(res, err);
  }
});
app2.get("/api/public/grammar-sets", async (req, res) => {
  try {
    const snapshot = await adminDb.collection("grammar_sets").get();
    const list2 = [];
    snapshot.forEach((doc) => {
      const set = { id: doc.id, ...doc.data() };
      if (getGrammarVisibility(set) !== "public") return;
      list2.push(sanitizeGrammarSetForStudent(set));
    });
    list2.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime());
    res.json(list2);
  } catch (err) {
    sendApiError(res, err);
  }
});
app2.get("/api/grammar-sets", authenticateUser, async (req, res) => {
  try {
    const snapshot = await adminDb.collection("grammar_sets").get();
    const list2 = [];
    snapshot.forEach((doc) => {
      const set = { id: doc.id, ...doc.data() };
      if (!canViewGrammarSet(req.user, set)) return;
      list2.push(req.user?.role === "student" ? sanitizeGrammarSetForStudent(set) : set);
    });
    list2.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime());
    res.json(list2);
  } catch (err) {
    sendApiError(res, err);
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
    sendApiError(res, err);
  }
});
app2.get("/api/grammar-sets/:id", authenticateUser, async (req, res) => {
  try {
    const set = await getGrammarSetOr404(req.params.id);
    if (!set) return res.status(404).json({ error: "B\xE0i ng\u1EEF ph\xE1p kh\xF4ng t\u1ED3n t\u1EA1i." });
    if (!canViewGrammarSet(req.user, set)) {
      return res.status(403).json({ error: "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n m\u1EDF b\xE0i ng\u1EEF ph\xE1p n\xE0y." });
    }
    res.json(req.user?.role === "student" ? sanitizeGrammarSetForStudent(set) : set);
  } catch (err) {
    sendApiError(res, err);
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
    sendApiError(res, err);
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
    sendApiError(res, err);
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
    sendApiError(res, err);
  }
});
app2.post("/api/admin/grammar-sets/:id/clone", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
    const existing = await getGrammarSetOr404(req.params.id);
    if (!existing) return res.status(404).json({ error: "B\xE0i ng\u1EEF ph\xE1p kh\xF4ng t\u1ED3n t\u1EA1i." });
    if (!canViewGrammarSet(req.user, existing)) return res.status(403).json({ error: "Ban khong co quyen nhan ban bai nay." });
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
    sendApiError(res, err);
  }
});
app2.post("/api/grammar-sets/:id/attempts/prepare", authenticateOptionalUser, async (req, res) => {
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
    const attemptsSnapshot = await adminDb.collection("grammar_attempts").where("grammarSetId", "==", set.id).where(actorField, "==", actor.id).where("status", "==", "completed").limit(maxAttempts).get();
    timing.mark("attempt_limit");
    if (attemptsSnapshot.size >= maxAttempts) {
      return res.status(403).json({ error: "Ban da het so lan lam bai duoc phep." });
    }
    const prepared = buildPreparedGrammarAttempt(set, actor, req.body || {}, credentials.clientRunId, credentials.runSecret);
    timing.finish(res);
    res.json(sanitizeAttemptForStudent(prepared, false, credentials.runSecret));
  } catch (err) {
    timing.finish(res);
    sendApiError(res, err);
  }
});
app2.post("/api/grammar-sets/:id/attempts/activate", authenticateOptionalUser, async (req, res) => {
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
      const existingAnswer = (existingAttempt.answers || []).find((item) => item.attemptQuestionId === payload.attemptQuestionId);
      if (existingAnswer) {
        const feedback3 = buildGrammarAnswerFeedback(existingAttempt, set, existingAnswer);
        timing.finish(res);
        return res.json({
          attempt: sanitizeAttemptForStudent(existingAttempt, false, credentials.runSecret),
          answer: sanitizeGrammarAnswerForStudent(existingAnswer, Boolean(feedback3)),
          feedback: feedback3,
          alreadyActivated: true
        });
      }
      if (existingAttempt.status === "completed") {
        timing.finish(res);
        return res.json({ attempt: sanitizeAttemptForStudent(existingAttempt, Boolean(set.showReviewAfterSubmit), credentials.runSecret), alreadyCompleted: true });
      }
      const { answer: answer2, feedback: feedback2 } = buildGrammarAttemptAnswer(existingAttempt, set, payload);
      const answers = [...(existingAttempt.answers || []).filter((item) => item.attemptQuestionId !== answer2.attemptQuestionId), answer2];
      const updatedAt = (/* @__PURE__ */ new Date()).toISOString();
      const updatedAttempt = { ...existingAttempt, status: "in_progress", answers, lastSavedAt: updatedAt, updatedAt };
      const batch2 = adminDb.batch();
      batch2.set(docRef, updatedAttempt);
      appendLearningHistoryProjection(
        batch2,
        projectGrammarAttempt(updatedAttempt, set, {
          detailRetentionDays: ATTEMPT_DETAIL_RETENTION_DAYS,
          includeDetail: false
        })
      );
      await batch2.commit();
      timing.mark("persist");
      timing.finish(res);
      return res.json({
        attempt: sanitizeAttemptForStudent(updatedAttempt, false, credentials.runSecret),
        answer: sanitizeGrammarAnswerForStudent(answer2, Boolean(feedback2)),
        feedback: feedback2,
        alreadyActivated: true
      });
    }
    if (safeText(payload.grammarSetVersion, 160) !== getGrammarSetVersion(set)) {
      return res.status(409).json({ error: "Bai da duoc cap nhat. Hay bat dau lai de nhan noi dung moi." });
    }
    const maxAttempts = Math.max(1, Number(set.maxAttempts || 1));
    const actorField = actor.isGuest ? "guestId" : "userId";
    const attemptsSnapshot = await adminDb.collection("grammar_attempts").where("grammarSetId", "==", set.id).where(actorField, "==", actor.id).where("status", "==", "completed").limit(maxAttempts).get();
    timing.mark("attempt_limit");
    if (attemptsSnapshot.size >= maxAttempts) {
      return res.status(403).json({ error: "Ban da het so lan lam bai duoc phep." });
    }
    const prepared = buildPreparedGrammarAttempt(set, actor, payload, credentials.clientRunId, credentials.runSecret);
    const { answer, feedback } = buildGrammarAttemptAnswer(prepared, set, payload);
    const now = (/* @__PURE__ */ new Date()).toISOString();
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
  } catch (err) {
    timing.finish(res);
    sendApiError(res, err);
  }
});
app2.post("/api/grammar-sets/:id/attempts", authenticateOptionalUser, async (req, res) => {
  const timing = createApiTiming(req, "POST /api/grammar-sets/:id/attempts");
  try {
    const actor = await getGrammarActor(req);
    timing.mark("identity");
    if (!actor) return res.status(401).json({ error: "Vui l\xF2ng nh\u1EADp t\xEAn h\u1ECDc sinh \u0111\u1EC3 luy\u1EC7n ng\u1EEF ph\xE1p." });
    const set = await getGrammarSetOr404(req.params.id);
    timing.mark("set_read");
    if (!set) return res.status(404).json({ error: "B\xE0i ng\u1EEF ph\xE1p kh\xF4ng t\u1ED3n t\u1EA1i." });
    if (!canOpenGrammarSetForLearning(set, actor, req)) {
      return res.status(403).json({ error: "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n l\xE0m b\xE0i n\xE0y." });
    }
    const maxAttempts = Math.max(1, Number(set.maxAttempts || 1));
    const actorField = actor.isGuest ? "guestId" : "userId";
    const attemptsSnapshot = await adminDb.collection("grammar_attempts").where("grammarSetId", "==", set.id).where(actorField, "==", actor.id).where("status", "==", "completed").limit(maxAttempts).get();
    timing.mark("attempt_limit");
    if (attemptsSnapshot.size >= maxAttempts) {
      return res.status(403).json({ error: "B\u1EA1n \u0111\xE3 h\u1EBFt s\u1ED1 l\u1EA7n l\xE0m b\xE0i \u0111\u01B0\u1EE3c ph\xE9p." });
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const questions = set.shuffleQuestions ? fisherYates(set.questions || []) : [...set.questions || []];
    const attemptQuestions = questions.map((question, index) => {
      const questionType = getGrammarQuestionType(question.questionType, getGrammarQuestionType(set.questionType));
      const options = questionType === "multiple_choice" && set.shuffleOptions ? fisherYates(question.options || []) : [...question.options || []];
      return {
        id: makeId(`grammar-attempt-question-${index + 1}`),
        questionId: question.id,
        questionType,
        displayPosition: index + 1,
        optionOrder: options.map((option) => option.id),
        questionSnapshot: question.questionText,
        explanationSnapshot: question.explanation,
        scoreSnapshot: question.score,
        optionsSnapshot: options,
        correctOptionId: questionType === "multiple_choice" ? question.correctOptionId : "",
        correctAnswerSnapshot: questionType === "rewrite" ? question.correctAnswer : "",
        acceptedAnswersSnapshot: questionType === "rewrite" && Array.isArray(question.acceptedAnswers) ? [...question.acceptedAnswers] : []
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
      maxScore: attemptQuestions.reduce((sum, question) => sum + Number(question.scoreSnapshot || 1), 0),
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
  } catch (err) {
    timing.finish(res);
    sendApiError(res, err);
  }
});
app2.post("/api/grammar-attempts/:attemptId/answers", authenticateOptionalUser, async (req, res) => {
  const timing = createApiTiming(req, "POST /api/grammar-attempts/:attemptId/answers");
  try {
    const actor = await getGrammarActor(req);
    timing.mark("identity");
    if (!actor) return res.status(401).json({ error: "Vui l\xF2ng nh\u1EADp t\xEAn h\u1ECDc sinh \u0111\u1EC3 luy\u1EC7n ng\u1EEF ph\xE1p." });
    const attempt = await getGrammarAttemptOr404(req.params.attemptId);
    timing.mark("attempt_read");
    if (!attempt) return res.status(404).json({ error: "L\u01B0\u1EE3t l\xE0m b\xE0i kh\xF4ng t\u1ED3n t\u1EA1i." });
    const set = await getGrammarSetOr404(attempt.grammarSetId);
    timing.mark("set_read");
    if (!canAccessGrammarAttempt(attempt, actor, set, req)) return res.status(403).json({ error: "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n s\u1EEDa l\u01B0\u1EE3t l\xE0m b\xE0i n\xE0y." });
    if (attempt.status === "completed") return res.status(400).json({ error: "B\xE0i \u0111\xE3 n\u1ED9p, kh\xF4ng th\u1EC3 thay \u0111\u1ED5i \u0111\xE1p \xE1n." });
    const attemptQuestion = (attempt.questions || []).find((question) => question.id === req.body?.attemptQuestionId);
    if (!attemptQuestion) return res.status(400).json({ error: "C\xE2u h\u1ECFi kh\xF4ng h\u1EE3p l\u1EC7." });
    const questionType = getGrammarQuestionType(attemptQuestion.questionType, getGrammarQuestionType(set?.questionType));
    const selectedOptionId = questionType === "multiple_choice" ? String(req.body?.selectedOptionId || "") : "";
    const textAnswer = questionType === "rewrite" ? safeText(req.body?.textAnswer, 4e3) : "";
    if (questionType === "multiple_choice") {
      const selectedOption = (attemptQuestion.optionsSnapshot || []).find((option) => option.id === selectedOptionId);
      if (!selectedOption) return res.status(400).json({ error: "Ph\u01B0\u01A1ng \xE1n \u0111\xE3 ch\u1ECDn kh\xF4ng h\u1EE3p l\u1EC7." });
    } else if (!normalizeGrammarTextAnswer(textAnswer)) {
      return res.status(400).json({ error: "Vui l\xF2ng nh\u1EADp c\xE2u tr\u1EA3 l\u1EDDi." });
    }
    const isCorrect = questionType === "rewrite" ? isGrammarTextAnswerCorrect(
      textAnswer,
      attemptQuestion.correctAnswerSnapshot,
      attemptQuestion.acceptedAnswersSnapshot
    ) : selectedOptionId === attemptQuestion.correctOptionId;
    const answer = {
      id: makeId("grammar-answer"),
      attemptQuestionId: attemptQuestion.id,
      questionId: attemptQuestion.questionId,
      questionType,
      isCorrect,
      scoreAwarded: isCorrect ? Number(attemptQuestion.scoreSnapshot || 1) : 0,
      answeredAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (questionType === "rewrite") {
      answer.textAnswer = textAnswer;
      answer.correctAnswer = attemptQuestion.correctAnswerSnapshot;
      answer.gradingVersion = GRAMMAR_TEXT_GRADING_VERSION;
    } else {
      answer.selectedOptionId = selectedOptionId;
      answer.correctOptionId = attemptQuestion.correctOptionId;
    }
    const answers = (attempt.answers || []).filter((item) => item.attemptQuestionId !== attemptQuestion.id);
    answers.push(answer);
    const updatedAt = (/* @__PURE__ */ new Date()).toISOString();
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
    const feedback = set?.showExplanationImmediately ? {
      isCorrect,
      correctOptionId: questionType === "multiple_choice" ? attemptQuestion.correctOptionId : "",
      correctAnswer: questionType === "rewrite" ? attemptQuestion.correctAnswerSnapshot : "",
      explanation: attemptQuestion.explanationSnapshot,
      scoreAwarded: answer.scoreAwarded
    } : null;
    timing.finish(res);
    res.json({ answer: sanitizeGrammarAnswerForStudent(answer, Boolean(feedback)), feedback });
  } catch (err) {
    timing.finish(res);
    sendApiError(res, err);
  }
});
app2.post("/api/grammar-attempts/:attemptId/submit", authenticateOptionalUser, async (req, res) => {
  const timing = createApiTiming(req, "POST /api/grammar-attempts/:attemptId/submit");
  try {
    const actor = await getGrammarActor(req);
    timing.mark("identity");
    if (!actor) return res.status(401).json({ error: "Vui l\xF2ng nh\u1EADp t\xEAn h\u1ECDc sinh \u0111\u1EC3 luy\u1EC7n ng\u1EEF ph\xE1p." });
    const attempt = await getGrammarAttemptOr404(req.params.attemptId);
    timing.mark("attempt_read");
    if (!attempt) return res.status(404).json({ error: "L\u01B0\u1EE3t l\xE0m b\xE0i kh\xF4ng t\u1ED3n t\u1EA1i." });
    const set = await getGrammarSetOr404(attempt.grammarSetId);
    timing.mark("set_read");
    if (!canAccessGrammarAttempt(attempt, actor, set, req)) return res.status(403).json({ error: "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n n\u1ED9p l\u01B0\u1EE3t l\xE0m b\xE0i n\xE0y." });
    if (attempt.status === "completed") {
      timing.finish(res);
      return res.json({
        ...sanitizeAttemptForStudent(attempt, Boolean(set?.showReviewAfterSubmit)),
        alreadyCompleted: true
      });
    }
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
  } catch (err) {
    timing.finish(res);
    sendApiError(res, err);
  }
});
app2.get("/api/grammar-attempts/:attemptId/review", authenticateOptionalUser, async (req, res) => {
  try {
    const actor = await getGrammarActor(req);
    if (!actor) return res.status(401).json({ error: "Vui l\xF2ng nh\u1EADp t\xEAn h\u1ECDc sinh \u0111\u1EC3 luy\u1EC7n ng\u1EEF ph\xE1p." });
    const attempt = await getGrammarAttemptOr404(req.params.attemptId);
    if (!attempt) return res.status(404).json({ error: "L\u01B0\u1EE3t l\xE0m b\xE0i kh\xF4ng t\u1ED3n t\u1EA1i." });
    const set = await getGrammarSetOr404(attempt.grammarSetId);
    const canReview = canAccessGrammarAttempt(attempt, actor, set, req, true);
    if (!canReview) return res.status(403).json({ error: "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n xem l\u01B0\u1EE3t l\xE0m b\xE0i n\xE0y." });
    if (attempt.status !== "completed" && actor.role === "student") return res.status(403).json({ error: "Ch\u1EC9 \u0111\u01B0\u1EE3c xem l\u1EA1i sau khi n\u1ED9p b\xE0i." });
    const staffReview = !actor.isGuest && (actor.role === "super_admin" || canManageGrammarSet(actor, set));
    res.json(sanitizeAttemptForStudent(attempt, staffReview || Boolean(set?.showReviewAfterSubmit)));
  } catch (err) {
    sendApiError(res, err);
  }
});
app2.get("/api/grammar-sets/:id/my-attempts", authenticateOptionalUser, async (req, res) => {
  try {
    const actor = await getGrammarActor(req);
    if (!actor) return res.status(401).json({ error: "Vui l\xF2ng nh\u1EADp t\xEAn h\u1ECDc sinh \u0111\u1EC3 xem l\u1ECBch s\u1EED l\xE0m b\xE0i." });
    const set = await getGrammarSetOr404(req.params.id);
    const actorField = actor.isGuest ? "guestId" : "userId";
    const snapshot = await adminDb.collection("grammar_attempts").where("grammarSetId", "==", req.params.id).where(actorField, "==", actor.id).get();
    const list2 = [];
    snapshot.forEach((doc) => {
      const attempt = { id: doc.id, ...doc.data() };
      list2.push(sanitizeAttemptForStudent(attempt, !actor.isGuest && attempt.status === "completed" && Boolean(set?.showReviewAfterSubmit)));
    });
    list2.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    res.json(list2);
  } catch (err) {
    sendApiError(res, err);
  }
});
app2.get("/api/admin/grammar-sets/:id/results", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
    const set = await getGrammarSetOr404(req.params.id);
    if (!set) return res.status(404).json({ error: "B\xE0i ng\u1EEF ph\xE1p kh\xF4ng t\u1ED3n t\u1EA1i." });
    if (!canManageGrammarSet(req.user, set)) return res.status(403).json({ error: "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n xem k\u1EBFt qu\u1EA3 b\xE0i n\xE0y." });
    const snapshot = await adminDb.collection("grammar_attempts").where("grammarSetId", "==", set.id).get();
    const attempts = [];
    snapshot.forEach((doc) => {
      const attempt = { id: doc.id, ...doc.data() };
      attempts.push(attempt);
    });
    attempts.sort((a, b) => new Date(b.completedAt || b.createdAt || 0).getTime() - new Date(a.completedAt || a.createdAt || 0).getTime());
    res.json({ set, attempts: await enrichStudentNames(attempts) });
  } catch (err) {
    sendApiError(res, err);
  }
});
app2.get("/api/admin/vocab-sets/:id/results", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
    const setDoc = await adminDb.collection("vocab_sets").doc(req.params.id).get();
    if (!setDoc.exists) return res.status(404).json({ error: "Vocabulary set not found." });
    const set = { id: setDoc.id, ...setDoc.data() };
    if (!canManageVocabSet(req.user, set)) {
      return res.status(403).json({ error: "You do not have permission to view results for this vocabulary set." });
    }
    const snapshot = await adminDb.collection("game_sessions").where("vocabSetId", "==", set.id).get();
    const sessions = [];
    snapshot.forEach((doc) => {
      const data = { id: doc.id, ...doc.data() };
      if (data.vocabSetId !== set.id) return;
      const interrupted = !data.completedAt && Date.now() - new Date(data.lastSavedAt || data.startedAt || data.createdAt || 0).getTime() >= 24 * 60 * 60 * 1e3;
      sessions.push(omitSensitiveSessionFields({ ...data, displayStatus: data.completedAt ? "completed" : interrupted ? "abandoned" : "in_progress" }));
    });
    sessions.sort((a, b) => new Date(b.completedAt || b.endedAt || b.createdAt || 0).getTime() - new Date(a.completedAt || a.endedAt || a.createdAt || 0).getTime());
    res.json({ set, sessions: await enrichStudentNames(sessions) });
  } catch (err) {
    sendApiError(res, err);
  }
});
async function resolveGameSessionStartContext(req, payload, timing) {
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
  let assignment = null;
  let access = null;
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
      assignmentsSnapshot.forEach((doc) => {
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
  let inferredClass = null;
  if (!assignment && payload.vocabSetId) {
    const assignmentsSnapshot = await adminDb.collection("assignments").where("vocabSetId", "==", payload.vocabSetId).get();
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
  timing?.mark("class_resolve");
  const privateSnapshot = buildGameSessionSnapshot(vocabSet, gameId, payload.itemOrder);
  return { actor, assignment, access, vocabSet, vocabSetId, gameId, inferredClass, privateSnapshot };
}
function buildGameSessionRecord(context, payload, options) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
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
    activatedAt: options.schemaVersion === 3 ? now : void 0,
    clientRunId: options.clientRunId || void 0,
    status: "started",
    submissionStatus: "pending",
    schemaVersion: options.schemaVersion,
    gradingMode: gameId.startsWith("flashcard-") ? "server-self-report" : "server",
    actionPersistence: options.schemaVersion === 3 && gameId !== "speaking-ai" ? "submit_batch" : getGameActionPersistence(gameId, privateSnapshot),
    privateSnapshot,
    lastSavedAt: now,
    score: 0,
    totalQuestions: 0,
    correctAnswers: 0,
    incorrectAnswers: 0,
    sessionTokenHash: options.sessionTokenHash
  };
}
function canResumeClientRun(req, session, runSecret) {
  return canUpdateGameSession(req, session, { sessionToken: runSecret, guestId: session.guestId });
}
function supportsIncrementalGameSession(session) {
  const schemaVersion = Number(session?.schemaVersion || 1);
  return schemaVersion === 2 || schemaVersion === 3 && session?.gameId === "speaking-ai";
}
app2.post("/api/game-sessions/activate", authenticateOptionalUser, async (req, res) => {
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
      const session2 = existing.data();
      if (!canResumeClientRun(req, session2, credentials.runSecret)) {
        return res.status(403).json({ error: "Khong co quyen tiep tuc luot hoc nay." });
      }
      timing.finish(res);
      return res.json({ ...omitSensitiveSessionFields(session2), sessionToken: credentials.runSecret, alreadyActivated: true });
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
  } catch (err) {
    timing.finish(res);
    sendApiError(res, err);
  }
});
app2.post("/api/game-sessions/lazy-complete", authenticateOptionalUser, async (req, res) => {
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
    const baseSession = existing.exists ? existing.data() : buildGameSessionRecord(context, payload, {
      id,
      sessionTokenHash: hashSessionToken(credentials.runSecret),
      schemaVersion: 3,
      clientRunId: credentials.clientRunId,
      startedAt: payload.startedAt
    });
    const result = gradeGameSessionV2(baseSession, actions);
    const completedAt = (/* @__PURE__ */ new Date()).toISOString();
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
      durationSeconds: Math.round(durationMs / 1e3),
      expiresAt: addDaysIso2(completedAt, ACTIVITY_TTL_DAYS)
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
  } catch (err) {
    timing.finish(res);
    sendApiError(res, err);
  }
});
app2.post("/api/game-sessions", authenticateOptionalUser, async (req, res) => {
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
    const id = `session-${import_crypto3.default.randomUUID()}`;
    const sessionToken = createSessionToken();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const vocabSetId = safeText(payload.vocabSetId, 160);
    const gameId = safeText(payload.gameId, 120);
    if (!vocabSetId || !gameId) {
      return res.status(400).json({ error: "vocabSetId and gameId are required." });
    }
    if (!SESSION_V2_GAME_IDS.has(gameId)) {
      return res.status(400).json({ error: "Game kh\xF4ng \u0111\u01B0\u1EE3c h\u1ED7 tr\u1EE3." });
    }
    let assignment = null;
    let access = null;
    const accessToken = getRequestVocabShareToken(req);
    if (accessToken) {
      access = await resolveVocabLearningAccess(accessToken, vocabSetId, safeText(payload.assignmentId, 160));
      if (!access) return res.status(403).json({ error: "Link kh\xF4ng c\xF3 quy\u1EC1n t\u1EA1o l\u01B0\u1EE3t h\u1ECDc n\xE0y." });
      assignment = access.assignment;
    } else if (payload.assignmentId) {
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
        return res.status(403).json({ error: "Link giao b\xE0i kh\xF4ng h\u1EE3p l\u1EC7 ho\u1EB7c \u0111\xE3 h\u1EBFt quy\u1EC1n truy c\u1EADp." });
      }
      if (assignment.gameId && assignment.gameId !== gameId) {
        return res.status(403).json({ error: "Game kh\xF4ng \u0111\xFAng v\u1EDBi b\xE0i gi\xE1o vi\xEAn \u0111\xE3 giao." });
      }
    } else if (access?.accessType === "vocab_set") {
      if (access.set.id !== vocabSetId || getVocabVisibility(vocabSet) !== "assignment") {
        return res.status(403).json({ error: "Link kh\xF4ng c\xF3 quy\u1EC1n t\u1EA1o l\u01B0\u1EE3t h\u1ECDc n\xE0y." });
      }
    } else if (!canViewVocabSet(req.user, vocabSet)) {
      return res.status(403).json({ error: "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n b\u1EAFt \u0111\u1EA7u game v\u1EDBi b\u1ED9 t\u1EEB n\xE0y." });
    }
    let inferredClass = null;
    if (!assignment && payload.vocabSetId) {
      const assignmentsSnapshot = await adminDb.collection("assignments").where("vocabSetId", "==", payload.vocabSetId).get();
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
  } catch (err) {
    timing.finish(res);
    sendApiError(res, err);
  }
});
app2.put("/api/game-sessions/:id", authenticateOptionalUser, async (req, res) => {
  try {
    const id = req.params.id;
    const payload = req.body || {};
    const docRef = adminDb.collection("game_sessions").doc(id);
    const existing = await docRef.get();
    if (!existing.exists) {
      return res.status(404).json({ error: "Session kh\xF4ng t\u1ED3n t\u1EA1i." });
    }
    const existingData = existing.data();
    if (!canUpdateGameSession(req, existingData, payload)) {
      return res.status(403).json({ error: "You do not have permission to update this game session." });
    }
    if (existingData.status === "completed") {
      return res.status(409).json({ error: "This game session has already been completed." });
    }
    const endedAt = payload.endedAt || (/* @__PURE__ */ new Date()).toISOString();
    const startedAt = existingData.startedAt || endedAt;
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
      ...existingData,
      answerDetails: sanitizedAnswerDetails,
      score: Math.max(0, Number(payload.score || 0)),
      totalQuestions,
      correctAnswers,
      incorrectAnswers: Math.max(0, Number(payload.incorrectAnswers || 0)),
      accuracy: totalQuestions > 0 ? Math.round(correctAnswers / totalQuestions * 100) : 0,
      durationMs,
      durationSeconds: Math.round(durationMs / 1e3),
      status: "completed",
      submissionStatus: "completed",
      endedAt,
      completedAt: endedAt,
      expiresAt: addDaysIso2(endedAt, ACTIVITY_TTL_DAYS)
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
  } catch (err) {
    sendApiError(res, err);
  }
});
app2.put("/api/game-sessions/:id/actions/:actionId", authenticateOptionalUser, async (req, res) => {
  const timing = createApiTiming(req, "PUT /api/game-sessions/:id/actions/:actionId");
  try {
    const sessionDoc = await adminDb.collection("game_sessions").doc(req.params.id).get();
    timing.mark("session_read");
    if (!sessionDoc.exists) return res.status(404).json({ error: "Session kh\xF4ng t\u1ED3n t\u1EA1i." });
    const session = sessionDoc.data();
    if (!canUpdateGameSession(req, session, req.body || {})) return res.status(403).json({ error: "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n l\u01B0u l\u01B0\u1EE3t ch\u01A1i n\xE0y." });
    if (!supportsIncrementalGameSession(session)) return res.status(400).json({ error: "Session c\u0169 kh\xF4ng h\u1ED7 tr\u1EE3 l\u01B0u ti\u1EBFn \u0111\u1ED9." });
    if (session.status === "completed") return res.json({ saved: true, completed: true });
    const action = sanitizeGameAction({ ...req.body?.action, actionId: req.params.actionId });
    if (!action.actionId) return res.status(400).json({ error: "Thi\u1EBFu actionId." });
    const canonicalActionId = `${req.params.id}:sequence:${action.sequence}`;
    const legacyActionId = `${req.params.id}:${action.actionId}`;
    const canonicalRef = adminDb.collection("game_session_actions").doc(canonicalActionId);
    const legacyRef = adminDb.collection("game_session_actions").doc(legacyActionId);
    const [canonicalDoc, legacyDoc] = await Promise.all([canonicalRef.get(), legacyRef.get()]);
    timing.mark("action_lookup");
    if (canonicalDoc.exists) {
      const existingAction = canonicalDoc.data();
      if (existingAction.actionId && existingAction.actionId !== action.actionId) {
        return res.status(409).json({ error: "Action sequence \u0111\xE3 t\u1ED3n t\u1EA1i." });
      }
      timing.finish(res);
      return res.json({ saved: true, actionId: action.actionId, sequence: action.sequence });
    }
    if (legacyDoc.exists) {
      timing.finish(res);
      return res.json({ saved: true, actionId: action.actionId, sequence: action.sequence });
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
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
  } catch (err) {
    timing.finish(res);
    sendApiError(res, err);
  }
});
app2.post("/api/game-sessions/:id/submit", authenticateOptionalUser, async (req, res) => {
  const timing = createApiTiming(req, "POST /api/game-sessions/:id/submit");
  try {
    const docRef = adminDb.collection("game_sessions").doc(req.params.id);
    const existing = await docRef.get();
    timing.mark("session_read");
    if (!existing.exists) return res.status(404).json({ error: "Session kh\xF4ng t\u1ED3n t\u1EA1i." });
    const session = existing.data();
    if (!canUpdateGameSession(req, session, req.body || {})) return res.status(403).json({ error: "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n n\u1ED9p l\u01B0\u1EE3t ch\u01A1i n\xE0y." });
    if (session.status === "completed") return res.json(omitSensitiveSessionFields(session));
    if (!supportsIncrementalGameSession(session)) return res.status(400).json({ error: "Session c\u0169 ph\u1EA3i d\xF9ng endpoint ho\xE0n th\xE0nh c\u0169." });
    let actions;
    const submittedActionsProvided = Array.isArray(req.body?.actions);
    if (session.actionPersistence === "submit_batch" && submittedActionsProvided) {
      actions = sanitizeSubmittedGameActions(req.body.actions);
    } else {
      const snapshot = await adminDb.collection("game_session_actions").where("sessionId", "==", req.params.id).get();
      const storedActions = [];
      snapshot.forEach((doc) => storedActions.push(doc.data()));
      actions = dedupeStoredGameActions(storedActions);
    }
    timing.mark("actions_read");
    const result = gradeGameSessionV2(session, actions);
    const completedAt = (/* @__PURE__ */ new Date()).toISOString();
    const durationMs = Math.max(0, Date.now() - new Date(session.startedAt || completedAt).getTime());
    const completed = { ...session, ...result, status: "completed", submissionStatus: "completed", completedAt, endedAt: completedAt, durationMs, durationSeconds: Math.round(durationMs / 1e3), expiresAt: addDaysIso2(completedAt, ACTIVITY_TTL_DAYS), submittedAt: completedAt };
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
  } catch (err) {
    timing.finish(res);
    sendApiError(res, err);
  }
});
app2.post("/api/pronunciation-attempts", authenticateOptionalUser, async (req, res) => {
  try {
    const payload = req.body || {};
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const gameSessionId = safeText(payload.gameSessionId, 160);
    let sessionData = null;
    if (gameSessionId) {
      const sessionDoc = await adminDb.collection("game_sessions").doc(gameSessionId).get();
      if (!sessionDoc.exists) {
        return res.status(404).json({ error: "Session kh\xF4ng t\u1ED3n t\u1EA1i." });
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
    const id = `pronunciation-${import_crypto3.default.randomUUID()}`;
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
  } catch (err) {
    sendApiError(res, err);
  }
});
app2.get("/api/results", authenticateUser, async (req, res) => {
  try {
    const recentCutoff = new Date(Date.now() - ACTIVITY_TTL_MS).toISOString();
    const snapshot = await adminDb.collection("game_sessions").where("completedAt", ">=", recentCutoff).get();
    const grammarAttemptsSnapshot = await adminDb.collection("grammar_attempts").where("completedAt", ">=", recentCutoff).get();
    const listeningAttemptsSnapshot = await adminDb.collection("listening_attempts").where("completedAt", ">=", recentCutoff).get();
    const grammarSetsById = await getGrammarSetMap();
    const vocabSetsById = await getVocabSetMap();
    const listeningSetsSnapshot = await adminDb.collection("listening_sets").get();
    const listeningSetsById = /* @__PURE__ */ new Map();
    listeningSetsSnapshot.forEach((doc) => listeningSetsById.set(doc.id, { id: doc.id, ...doc.data() }));
    const assignmentsSnapshot = await adminDb.collection("assignments").get();
    const classesSnapshot = await adminDb.collection("classes").get();
    const assignmentsById = /* @__PURE__ */ new Map();
    const classesById = /* @__PURE__ */ new Map();
    assignmentsSnapshot.forEach((doc) => {
      const data = { id: doc.id, ...doc.data() };
      assignmentsById.set(doc.id, data);
      if (data.id) assignmentsById.set(data.id, data);
    });
    classesSnapshot.forEach((doc) => {
      const data = { id: doc.id, ...doc.data() };
      classesById.set(data.id, data);
    });
    const list2 = [];
    const cutoff = Date.now() - ACTIVITY_TTL_MS;
    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.completedAt && !isExpiredActivity(data) && new Date(getActivityTime(data)).getTime() >= cutoff) {
        if (!canViewResultSession(req.user, data, vocabSetsById, assignmentsById, classesById)) return;
        const gradeClass = getLessonGradeClass(vocabSetsById.get(data.vocabSetId));
        list2.push({
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
      if (!canViewGrammarActivity(req.user, data, grammarSetsById.get(data.grammarSetId))) return;
      list2.push(grammarAttemptToActivity(data, grammarSetsById.get(data.grammarSetId)));
    });
    const visibleListeningAttempts = [];
    listeningAttemptsSnapshot.forEach((doc) => {
      const data = { id: doc.id, ...doc.data() };
      if (!data.completedAt || new Date(getActivityTime(data)).getTime() < cutoff) return;
      const set = listeningSetsById.get(data.setId);
      const canView = req.user?.role === "super_admin" || data.userId === req.user?.id || data.ownerKey === `user:${req.user?.id}` || req.user?.role === "teacher" && set?.ownerId === req.user.id;
      if (canView) visibleListeningAttempts.push(data);
    });
    const isStaffResultReview = req.user?.role === "teacher" || req.user?.role === "super_admin";
    const listeningVersionContentCache = /* @__PURE__ */ new Map();
    const listeningActivities = await Promise.all(visibleListeningAttempts.map(async (data) => {
      if (!isStaffResultReview) return listeningAttemptToActivity(data);
      const detail = await resolveListeningActivityDetailForStaff(
        adminDb,
        data,
        listeningVersionContentCache
      );
      return listeningAttemptToActivity(data, detail);
    }));
    list2.push(...listeningActivities);
    list2.sort((a, b) => new Date(getActivityTime(b)).getTime() - new Date(getActivityTime(a)).getTime());
    res.json(await enrichStudentNames(list2));
  } catch (err) {
    sendApiError(res, err);
  }
});
app2.get("/api/leaderboard-results", authenticateUser, async (req, res) => {
  try {
    const events = await loadLeaderboardEventsFromSources();
    const grammarSetsById = await getGrammarSetMap();
    const vocabSetsById = await getVocabSetMap();
    const assignmentsSnapshot = await adminDb.collection("assignments").get();
    const classesSnapshot = await adminDb.collection("classes").get();
    const assignmentsById = /* @__PURE__ */ new Map();
    const classesById = /* @__PURE__ */ new Map();
    assignmentsSnapshot.forEach((doc) => {
      const data = { id: doc.id, ...doc.data() };
      assignmentsById.set(doc.id, data);
      if (data.id) assignmentsById.set(data.id, data);
    });
    classesSnapshot.forEach((doc) => {
      const data = { id: doc.id, ...doc.data() };
      classesById.set(data.id, data);
    });
    const scoped = events.filter((event) => {
      if (event.sourceType === "grammar") {
        return canViewGrammarActivity(req.user, event, grammarSetsById.get(event.grammarSetId));
      }
      return canViewResultSession(req.user, event, vocabSetsById, assignmentsById, classesById);
    });
    res.json(scoped);
  } catch (err) {
    sendApiError(res, err);
  }
});
app2.get("/api/admin/users", authenticateUser, requireRole(["super_admin"]), async (req, res) => {
  try {
    const snapshot = await adminDb.collection("users").get();
    const users = [];
    snapshot.forEach((doc) => users.push(doc.data()));
    res.json(users);
  } catch (err) {
    sendApiError(res, err);
  }
});
app2.get("/api/admin/accounts", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
    await ensureLegacyGuestProfilesOnce();
    const [usersSnapshot, guestsSnapshot] = await Promise.all([
      adminDb.collection("users").get(),
      adminDb.collection("guest_profiles").get()
    ]);
    const accounts = [];
    if (isSuperAdmin3(req.user)) {
      usersSnapshot.forEach((doc) => {
        const data = doc.data();
        accounts.push({
          ...data,
          id: data.id || doc.id,
          name: data.name || data.displayName || "Ch\u01B0a \u0111\u1EB7t t\xEAn",
          accountType: "registered",
          status: data.status || "active"
        });
      });
    }
    const guestProfiles = [];
    guestsSnapshot.forEach((doc) => {
      const data = doc.data();
      guestProfiles.push({
        ...omitGuestCapabilitySecrets(data),
        id: data.id || doc.id,
        guestId: data.guestId || doc.id
      });
    });
    for (const data of guestProfiles) {
      if (!await canManageGuestProfile(req.user, data)) continue;
      accounts.push({
        ...data,
        name: data.displayName || data.name || "Ch\u01B0a \u0111\u1EB7t t\xEAn",
        email: "",
        phone: "",
        role: "student",
        accountType: "guest",
        status: data.status || "active"
      });
    }
    accounts.sort((a, b) => new Date(b.lastActiveAt || b.updatedAt || b.createdAt || 0).getTime() - new Date(a.lastActiveAt || a.updatedAt || a.createdAt || 0).getTime());
    res.json(accounts);
  } catch (err) {
    sendApiError(res, err);
  }
});
app2.put("/api/admin/users/:userId/display-name", authenticateUser, requireRole(["super_admin"]), async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
    const validation = validateStudentDisplayName(req.body?.displayName || req.body?.name);
    if (!validation.valid) return res.status(400).json({ error: validation.error });
    const userRef = adminDb.collection("users").doc(req.params.userId);
    const userDoc = await userRef.get();
    if (!userDoc.exists) return res.status(404).json({ error: "Ng\u01B0\u1EDDi d\xF9ng kh\xF4ng t\u1ED3n t\u1EA1i." });
    const existing = userDoc.data();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    await userRef.update({ name: validation.value, updatedAt: now });
    let authWarning = "";
    try {
      await adminAuth.updateUser(req.params.userId, { displayName: validation.value });
    } catch (authErr) {
      authWarning = authErr?.message || "Kh\xF4ng \u0111\u1ED3ng b\u1ED9 \u0111\u01B0\u1EE3c t\xEAn l\xEAn Firebase Authentication.";
      console.warn(`Could not update Firebase display name for ${req.params.userId}: ${authWarning}`);
    }
    await logAuditAction(
      req.user.id,
      req.user.name,
      req.user.email,
      "UPDATE_USER_DISPLAY_NAME",
      `\u0110\u1ED5i t\xEAn t\xE0i kho\u1EA3n "${existing?.name || req.params.userId}" th\xE0nh "${validation.value}"`
    );
    res.json({ success: true, userId: req.params.userId, displayName: validation.value, authWarning });
  } catch (err) {
    sendApiError(res, err);
  }
});
app2.put("/api/admin/guest-profiles/:guestId/display-name", authenticateUser, requireRole(["teacher", "super_admin"]), async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
    const validation = validateStudentDisplayName(req.body?.displayName || req.body?.name);
    if (!validation.valid) return res.status(400).json({ error: validation.error });
    const profileRef = adminDb.collection("guest_profiles").doc(getGuestProfileId(req.params.guestId));
    const profileDoc = await profileRef.get();
    if (!profileDoc.exists) return res.status(404).json({ error: "H\u1ED3 s\u01A1 h\u1ECDc sinh kh\xF4ng t\u1ED3n t\u1EA1i." });
    const existing = profileDoc.data();
    if (!await canManageGuestProfile(req.user, { id: profileDoc.id, ...existing })) {
      return res.status(403).json({ error: "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n \u0111\u1ED5i t\xEAn h\u1ECDc sinh n\xE0y." });
    }
    await profileRef.update({
      displayName: validation.value,
      name: validation.value,
      normalizedName: normalizePersonName(validation.value),
      needsReview: false,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
    await logAuditAction(
      req.user.id,
      req.user.name,
      req.user.email,
      "UPDATE_GUEST_DISPLAY_NAME",
      `\u0110\u1ED5i t\xEAn h\u1ECDc sinh kh\xE1ch "${existing?.displayName || req.params.guestId}" th\xE0nh "${validation.value}"`
    );
    res.json({ success: true, guestId: req.params.guestId, displayName: validation.value });
  } catch (err) {
    sendApiError(res, err);
  }
});
app2.put("/api/admin/guest-profiles/:guestId/status", authenticateUser, requireRole(["super_admin"]), async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
    const status = req.body?.status;
    if (!["active", "blocked"].includes(status)) {
      return res.status(400).json({ error: "Tr\u1EA1ng th\xE1i h\u1ED3 s\u01A1 kh\xF4ng h\u1EE3p l\u1EC7." });
    }
    const profileRef = adminDb.collection("guest_profiles").doc(getGuestProfileId(req.params.guestId));
    const profileDoc = await profileRef.get();
    if (!profileDoc.exists) return res.status(404).json({ error: "H\u1ED3 s\u01A1 h\u1ECDc sinh kh\xF4ng t\u1ED3n t\u1EA1i." });
    const existing = profileDoc.data();
    await profileRef.update({ status, updatedAt: (/* @__PURE__ */ new Date()).toISOString() });
    await logAuditAction(
      req.user.id,
      req.user.name,
      req.user.email,
      status === "blocked" ? "LOCK_GUEST_PROFILE" : "UNLOCK_GUEST_PROFILE",
      `Chuy\u1EC3n h\u1ED3 s\u01A1 h\u1ECDc sinh "${existing?.displayName || req.params.guestId}" th\xE0nh ${status}`
    );
    res.json({ success: true, guestId: req.params.guestId, status });
  } catch (err) {
    sendApiError(res, err);
  }
});
app2.post(
  "/api/admin/guest-profiles/:guestId/history-capability",
  authenticateUser,
  requireRole(["teacher", "super_admin"]),
  async (req, res) => {
    try {
      if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
      const guestId = getGuestProfileId(req.params.guestId);
      const profileRef = adminDb.collection("guest_profiles").doc(guestId);
      const profileDoc = await profileRef.get();
      if (!profileDoc.exists) return res.status(404).json({ error: "H\u1ED3 s\u01A1 h\u1ECDc sinh kh\xF4ng t\u1ED3n t\u1EA1i." });
      const profile = { id: profileDoc.id, ...profileDoc.data() };
      if (!await canManageGuestProfile(req.user, profile)) {
        return res.status(403).json({ error: "B\u1EA1n kh\xF4ng c\xF3 quy\u1EC1n c\u1EA5p l\u1EA1i quy\u1EC1n l\u1ECBch s\u1EED cho h\u1ECDc sinh n\xE0y." });
      }
      const guestAccessToken = createSessionToken();
      const now = (/* @__PURE__ */ new Date()).toISOString();
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
        `C\u1EA5p l\u1EA1i quy\u1EC1n xem l\u1ECBch s\u1EED cho h\u1ED3 s\u01A1 kh\xE1ch ${guestId}`
      );
      res.json({
        guestId,
        guestAccessToken,
        guestAccessTokenVersion,
        createdAt: now
      });
    } catch (err) {
      sendApiError(res, err);
    }
  }
);
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
    sendApiError(res, err);
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
    sendApiError(res, err);
  }
});
app2.get("/api/admin/audit-logs", authenticateUser, requireRole(["super_admin"]), async (req, res) => {
  try {
    const snapshot = await adminDb.collection("audit_logs").orderBy("timestamp", "desc").get();
    const logs = [];
    snapshot.forEach((doc) => logs.push(doc.data()));
    res.json(logs);
  } catch (err) {
    sendApiError(res, err);
  }
});
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
    const viteMode = process.env.VITE_MODE?.trim() || void 0;
    const vite = await (0, import_vite.createServer)({
      ...viteMode ? { mode: viteMode } : {},
      define: {
        "import.meta.env.VITE_LOCAL_AUTH_BYPASS_ENABLED": JSON.stringify(
          process.env.VITE_LOCAL_AUTH_BYPASS_ENABLED === "true" ? "true" : "false"
        )
      },
      server: { middlewareMode: true },
      appType: "spa"
    });
    app2.use(vite.middlewares);
    console.log("Vite development server loaded as middleware.");
  } else {
    const distPath = import_path5.default.join(process.cwd(), "dist", "client");
    app2.use("/assets", import_express5.default.static(import_path5.default.join(distPath, "assets"), {
      immutable: true,
      maxAge: "365d"
    }));
    app2.use(import_express5.default.static(distPath));
    app2.get("*", (req, res) => {
      res.sendFile(import_path5.default.join(distPath, "index.html"));
    });
    console.log("Production static build routing active.");
  }
  const httpServer = app2.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
  let shuttingDown = false;
  const gracefulShutdown = (signal) => {
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
  return import_crypto3.default.randomBytes(16).toString("hex");
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
function normalizeAudioUrlForClient(value) {
  const audioUrl = safeText(value, 1e3);
  if (!audioUrl) return "";
  if (audioUrl.startsWith(`${AUDIO_PUBLIC_PREFIX}/`)) return audioUrl;
  if (/^https:\/\/[^\s]+$/i.test(audioUrl)) return audioUrl;
  return "";
}
function stripPrivateVocabSetFields(set) {
  const items = Array.isArray(set?.items) ? set.items.map((item) => {
    const { audioPath, ...publicItem } = item || {};
    return publicItem;
  }) : [];
  return {
    ...set,
    items
  };
}
function normalizeVocabSetForRead(set) {
  const visibility = getVocabVisibility(set);
  return {
    ...set,
    visibility,
    status: toLegacyStatus(visibility)
  };
}
function normalizeVocabItemForSave(item, index, errors) {
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
  const ttsSpeed = Number.isFinite(rawSpeed) ? Math.min(1.5, Math.max(0.5, rawSpeed)) : void 0;
  const audioHash = safeText(item?.audioHash, 128);
  if (audioHash && !/^[a-f0-9]{64}$/i.test(audioHash)) {
    errors.push(`Dong ${index + 1}: invalid audio hash.`);
  }
  const status = safeText(item?.audioStatus, 20);
  const audioStatus = ["missing", "queued", "generating", "ready", "failed"].includes(status) ? status : void 0;
  const normalized = {
    id,
    term,
    meaning,
    ipa: safeText(item?.ipa, 120),
    pos: safeText(item?.pos, 120),
    example: safeText(item?.example, 1e3),
    exampleMeaning: safeText(item?.exampleMeaning, 1e3),
    imageUrl: safeText(item?.imageUrl, 1e3),
    displayOrder: Number.isFinite(Number(item?.displayOrder)) ? Number(item.displayOrder) : index + 1
  };
  if (audioUrl) normalized.audioUrl = audioUrl;
  if (audioHash) normalized.audioHash = audioHash;
  if (audioStatus) normalized.audioStatus = audioStatus;
  if (item?.audioError) normalized.audioError = safeText(item.audioError, 500);
  if (Array.isArray(item?.audioWarnings)) normalized.audioWarnings = item.audioWarnings.map((warning) => safeText(warning, 200)).filter(Boolean).slice(0, 5);
  if (item?.audioGeneratedAt) normalized.audioGeneratedAt = safeText(item.audioGeneratedAt, 80);
  if (item?.audioUpdatedAt) normalized.audioUpdatedAt = safeText(item.audioUpdatedAt, 80);
  if (ttsProvider) normalized.ttsProvider = ttsProvider;
  if (item?.ttsVoice) normalized.ttsVoice = safeText(item.ttsVoice, 200);
  if (ttsLang) normalized.ttsLang = ttsLang;
  if (ttsSpeed !== void 0) normalized.ttsSpeed = ttsSpeed;
  if (item?.ttsText) normalized.ttsText = safeText(item.ttsText, 160);
  if (item?.notes) normalized.notes = safeText(item.notes, 1e3);
  return normalized;
}
function normalizeVocabSetForSave(payload, existing = {}) {
  const merged = {
    ...existing,
    ...payload
  };
  const errors = [];
  const items = (Array.isArray(merged.items) ? merged.items : []).slice(0, 500).map((item, index) => normalizeVocabItemForSave(item, index, errors)).sort((a, b) => a.displayOrder - b.displayOrder).map((item, index) => ({ ...item, displayOrder: index + 1 }));
  if (items.length === 0) errors.push("Vocabulary set needs at least one valid item.");
  if (errors.length > 0) throw createHttpError(400, errors.join(" "), errors);
  const ttsSettings = merged.ttsSettings ? normalizeTtsSettings(merged.ttsSettings) : void 0;
  const visibility = getVocabVisibility(merged);
  const normalized = {
    ...merged,
    title: safeText(merged.title, 240),
    description: safeText(merged.description, 2e3),
    subject: safeText(merged.subject || "General English", 120),
    gradeLevel: safeText(merged.gradeLevel || "L\u1EDBp 3", 80),
    tags: Array.isArray(merged.tags) ? merged.tags.map((tag) => safeText(tag, 60)).filter(Boolean).slice(0, 12) : [],
    items,
    ...ttsSettings ? { ttsSettings } : {},
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
function getGrammarVisibility(set) {
  if (set?.visibility === "assignment" || set?.visibility === "public" || set?.visibility === "draft") {
    return set.visibility;
  }
  if (set?.status === "private") return "assignment";
  if (set?.status === "public") return "public";
  return "draft";
}
function getGrammarShareToken(set) {
  return String(set?.shareToken || set?.assignmentSlug || "").replace(/^grammar-/, "").trim();
}
function getRequestShareToken(req) {
  const raw = req.body?.shareToken || req.body?.accessToken || req.query?.shareToken || req.headers["x-grammar-share-token"];
  return String(raw || "").replace(/^grammar-/, "").trim();
}
function getGuestIdentityInput(req) {
  const guestId = safeText(req.body?.guestId || req.query?.guestId || req.headers["x-guest-id"], 120);
  const studentName = req.body?.studentName || req.query?.studentName;
  if (!guestId) return null;
  return { guestId, studentName };
}
function toGuestActor(profile) {
  return {
    id: profile.guestId || profile.id,
    name: profile.displayName || profile.name,
    email: "",
    role: "student",
    status: "active",
    createdAt: profile.createdAt || (/* @__PURE__ */ new Date()).toISOString(),
    isGuest: true
  };
}
async function getGrammarActor(req) {
  if (req.authBlocked) return null;
  if (req.user) return { ...req.user, name: req.user.name || "H\u1ECDc sinh", isGuest: false };
  const input = getGuestIdentityInput(req);
  if (!input) return null;
  const existingProfile = await findExistingGuestIdentity(input.guestId);
  if (existingProfile) return toGuestActor(existingProfile);
  const validation = validateStudentDisplayName(input.studentName);
  if (!validation.valid) return null;
  const profile = await resolveGuestProfile(input.guestId, validation.value);
  return toGuestActor(profile);
}
function canOpenGrammarSetForLearning(set, actor, req) {
  if (!set || !actor) return false;
  if (!actor.isGuest && (actor.role === "teacher" || actor.role === "super_admin")) return true;
  const visibility = getGrammarVisibility(set);
  if (visibility === "public") return true;
  if (visibility !== "assignment") return false;
  const expectedToken = getGrammarShareToken(set);
  const requestToken = getRequestShareToken(req);
  return Boolean(expectedToken && requestToken && expectedToken === requestToken);
}
function canAccessGrammarAttempt(attempt, actor, set, req, allowStaffReview = false) {
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
  return true;
}
function safeText(value, max = 2e3) {
  return String(value || "").normalize("NFKC").trim().slice(0, max);
}
function makeId(prefix) {
  return `${prefix}-${Date.now()}-${import_crypto3.default.randomBytes(4).toString("hex")}`;
}
function fisherYates(input) {
  const items = [...input];
  for (let i = items.length - 1; i > 0; i--) {
    const j = import_crypto3.default.randomInt(0, i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
function seededUnitInterval(seed, index) {
  const digest = import_crypto3.default.createHash("sha256").update(`${seed}:${index}`).digest();
  return digest.readUInt32BE(0) / 4294967296;
}
function deterministicShuffle(input, seed) {
  const items = [...input];
  let randomIndex = 0;
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(seededUnitInterval(seed, randomIndex++) * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}
function getGrammarSetVersion(set) {
  return safeText(set?.updatedAt || set?.createdAt || set?.id, 160);
}
function buildPreparedGrammarAttempt(set, actor, payload, clientRunId, runSecret) {
  const grammarSetVersion = getGrammarSetVersion(set);
  const isAssignment = getGrammarVisibility(set) === "assignment";
  const questionSeed = `${clientRunId}:${set.id}:${grammarSetVersion}:questions`;
  const questions = set.shuffleQuestions ? deterministicShuffle(set.questions || [], questionSeed) : [...set.questions || []];
  const attemptQuestions = questions.map((question, index) => {
    const questionType = getGrammarQuestionType(question.questionType, getGrammarQuestionType(set.questionType));
    const optionSeed = `${clientRunId}:${question.id}:${grammarSetVersion}:options`;
    const options = questionType === "multiple_choice" && set.shuffleOptions ? deterministicShuffle(question.options || [], optionSeed) : [...question.options || []];
    return {
      id: deterministicRunDocumentId("grammar-attempt-question", [clientRunId, set.id, question.id]),
      questionId: question.id,
      questionType,
      displayPosition: index + 1,
      optionOrder: options.map((option) => option.id),
      questionSnapshot: question.questionText,
      explanationSnapshot: question.explanation,
      scoreSnapshot: question.score,
      optionsSnapshot: options,
      correctOptionId: questionType === "multiple_choice" ? question.correctOptionId : "",
      correctAnswerSnapshot: questionType === "rewrite" ? question.correctAnswer : "",
      acceptedAnswersSnapshot: questionType === "rewrite" && Array.isArray(question.acceptedAnswers) ? [...question.acceptedAnswers] : []
    };
  });
  const now = (/* @__PURE__ */ new Date()).toISOString();
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
    assignmentDueAt: isAssignment ? set.dueDate || set.dueAt || "" : "",
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
    maxScore: attemptQuestions.reduce((sum, question) => sum + Number(question.scoreSnapshot || 1), 0),
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
function buildGrammarAttemptAnswer(attempt, set, payload) {
  const attemptQuestion = (attempt.questions || []).find((question) => question.id === payload?.attemptQuestionId);
  if (!attemptQuestion) throw createHttpError(400, "Cau hoi khong hop le.");
  const questionType = getGrammarQuestionType(attemptQuestion.questionType, getGrammarQuestionType(set?.questionType));
  const selectedOptionId = questionType === "multiple_choice" ? String(payload?.selectedOptionId || "") : "";
  const textAnswer = questionType === "rewrite" ? safeText(payload?.textAnswer, 4e3) : "";
  if (questionType === "multiple_choice") {
    const selectedOption = (attemptQuestion.optionsSnapshot || []).find((option) => option.id === selectedOptionId);
    if (!selectedOption) throw createHttpError(400, "Phuong an da chon khong hop le.");
  } else if (!normalizeGrammarTextAnswer(textAnswer)) {
    throw createHttpError(400, "Vui long nhap cau tra loi.");
  }
  const isCorrect = questionType === "rewrite" ? isGrammarTextAnswerCorrect(textAnswer, attemptQuestion.correctAnswerSnapshot, attemptQuestion.acceptedAnswersSnapshot) : selectedOptionId === attemptQuestion.correctOptionId;
  const answer = {
    id: deterministicRunDocumentId("grammar-answer-v2", [attempt.id, attemptQuestion.id]),
    attemptQuestionId: attemptQuestion.id,
    questionId: attemptQuestion.questionId,
    questionType,
    isCorrect,
    scoreAwarded: isCorrect ? Number(attemptQuestion.scoreSnapshot || 1) : 0,
    answeredAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  if (questionType === "rewrite") {
    answer.textAnswer = textAnswer;
    answer.correctAnswer = attemptQuestion.correctAnswerSnapshot;
    answer.gradingVersion = GRAMMAR_TEXT_GRADING_VERSION;
  } else {
    answer.selectedOptionId = selectedOptionId;
    answer.correctOptionId = attemptQuestion.correctOptionId;
  }
  const feedback = set?.showExplanationImmediately ? {
    isCorrect,
    correctOptionId: questionType === "multiple_choice" ? attemptQuestion.correctOptionId : "",
    correctAnswer: questionType === "rewrite" ? attemptQuestion.correctAnswerSnapshot : "",
    explanation: attemptQuestion.explanationSnapshot,
    scoreAwarded: answer.scoreAwarded
  } : null;
  return { answer, feedback };
}
function buildGrammarAnswerFeedback(attempt, set, answer) {
  if (!set?.showExplanationImmediately || !answer) return null;
  const attemptQuestion = (attempt.questions || []).find(
    (question) => question.id === answer.attemptQuestionId
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
function getGrammarQuestionType(value, fallback = "multiple_choice") {
  return value === "rewrite" ? "rewrite" : fallback;
}
function normalizeAcceptedGrammarAnswers(value, correctAnswer) {
  const source = Array.isArray(value) ? value : typeof value === "string" ? value.split(/\r?\n/) : [];
  const seen = /* @__PURE__ */ new Set();
  const normalizedCorrectAnswer = normalizeGrammarTextAnswer(correctAnswer);
  if (normalizedCorrectAnswer) seen.add(normalizedCorrectAnswer);
  const acceptedAnswers = [];
  for (const candidate of source) {
    const answer = safeText(candidate, 4e3);
    const normalizedAnswer = normalizeGrammarTextAnswer(answer);
    if (!normalizedAnswer || seen.has(normalizedAnswer)) continue;
    seen.add(normalizedAnswer);
    acceptedAnswers.push(answer);
    if (acceptedAnswers.length >= 20) break;
  }
  return acceptedAnswers;
}
function normalizeGrammarQuestion(question, index, fallbackType = "multiple_choice") {
  const questionId = question.id || makeId(`grammar-question-${index + 1}`);
  const questionType = getGrammarQuestionType(question.questionType, fallbackType);
  const rawOptions = questionType === "multiple_choice" && Array.isArray(question.options) ? question.options : [];
  const options = rawOptions.slice(0, 5).map((option, optionIndex2) => ({
    id: option.id || `${questionId}-option-${optionIndex2 + 1}`,
    text: safeText(option.text, 1e3),
    originalPosition: Number.isFinite(Number(option.originalPosition)) ? Number(option.originalPosition) : optionIndex2 + 1
  }));
  const normalized = {
    id: questionId,
    questionType,
    questionText: safeText(question.questionText || question.question, 4e3),
    options,
    explanation: safeText(question.explanation, 6e3),
    score: Math.max(1, Number(question.score || 1)),
    position: Number.isFinite(Number(question.position)) ? Number(question.position) : index + 1
  };
  if (questionType === "rewrite") {
    normalized.correctOptionId = "";
    normalized.correctAnswer = safeText(question.correctAnswer || question.answer, 4e3);
    normalized.acceptedAnswers = normalizeAcceptedGrammarAnswers(
      question.acceptedAnswers,
      normalized.correctAnswer
    );
  } else {
    normalized.correctOptionId = String(question.correctOptionId || "");
  }
  return normalized;
}
function validateGrammarQuestion(question, index) {
  const errors = [];
  if (!question.questionText) errors.push(`C\xE2u ${index + 1}: thi\u1EBFu n\u1ED9i dung c\xE2u h\u1ECFi.`);
  if (!question.explanation) errors.push(`C\xE2u ${index + 1}: thi\u1EBFu l\u1EDDi gi\u1EA3i th\xEDch.`);
  if (question.questionType === "rewrite") {
    if (!question.correctAnswer) errors.push(`C\xE2u ${index + 1}: thi\u1EBFu \u0111\xE1p \xE1n \u0111\xFAng.`);
    return errors;
  }
  if (!Array.isArray(question.options) || question.options.length < 2 || question.options.length > 4) {
    errors.push(`C\xE2u ${index + 1}: c\u1EA7n t\u1EEB 2 \u0111\u1EBFn 4 ph\u01B0\u01A1ng \xE1n.`);
  }
  question.options?.forEach((option, optionIndex2) => {
    if (!option.text) errors.push(`C\xE2u ${index + 1}: ph\u01B0\u01A1ng \xE1n ${optionIndex2 + 1} \u0111ang tr\u1ED1ng.`);
  });
  const optionIds = (question.options || []).map((option) => String(option.id || ""));
  if (new Set(optionIds).size !== optionIds.length) {
    errors.push(`C\xE2u ${index + 1}: c\xF3 ph\u01B0\u01A1ng \xE1n b\u1ECB tr\xF9ng ID.`);
  }
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
  const questionType = getGrammarQuestionType(payload.questionType, getGrammarQuestionType(existing.questionType));
  const questions = (Array.isArray(payload.questions) ? payload.questions : []).map((question, index) => normalizeGrammarQuestion(question, index, questionType)).sort((a, b) => a.position - b.position).map((question, index) => ({ ...question, position: index + 1 }));
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
function canManageGrammarSet(user, set) {
  return user?.role === "super_admin" || Boolean(set?.createdBy) && set.createdBy === user?.id;
}
function canViewGrammarSet(user, set) {
  if (!user) return getGrammarVisibility(set) === "public";
  if (user.role === "super_admin") return true;
  if (user.role === "teacher") return canManageGrammarSet(user, set) || getGrammarVisibility(set) === "public";
  return getGrammarVisibility(set) === "public";
}
function sanitizeGrammarSetForStudent(set) {
  return {
    ...set,
    questions: (set.questions || []).map((question) => ({
      id: question.id,
      questionType: getGrammarQuestionType(question.questionType, getGrammarQuestionType(set.questionType)),
      questionText: question.questionText,
      options: (question.options || []).map((option) => ({
        id: option.id,
        text: option.text,
        originalPosition: option.originalPosition
      })),
      score: question.score,
      position: question.position
    }))
  };
}
function sanitizeAttemptForStudent(attempt, includeReview = false, attemptToken = "") {
  const { attemptTokenHash, sessionTokenHash, ...safeAttempt } = attempt;
  const sanitizedAttempt = {
    ...safeAttempt,
    questions: (attempt.questions || []).map((question) => {
      const safeQuestion = {
        id: question.id,
        questionId: question.questionId,
        questionType: getGrammarQuestionType(question.questionType),
        displayPosition: question.displayPosition,
        questionSnapshot: question.questionSnapshot,
        scoreSnapshot: question.scoreSnapshot,
        optionsSnapshot: Array.isArray(question.optionsSnapshot) ? question.optionsSnapshot.map((option) => ({
          id: option.id,
          text: option.text,
          originalPosition: option.originalPosition
        })) : []
      };
      if (includeReview) {
        safeQuestion.explanationSnapshot = question.explanationSnapshot;
        safeQuestion.correctOptionId = question.correctOptionId;
        safeQuestion.correctAnswerSnapshot = question.correctAnswerSnapshot;
      }
      return safeQuestion;
    }),
    answers: (attempt.answers || []).map((answer) => sanitizeGrammarAnswerForStudent(answer, includeReview))
  };
  if (attemptToken) sanitizedAttempt.attemptToken = attemptToken;
  return sanitizedAttempt;
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
start().catch(async (err) => {
  console.error("Failed to start fullstack server", err);
  await shutdownStorage().catch(() => void 0);
  process.exit(1);
});
//# sourceMappingURL=server.cjs.map
