import fs from 'fs';
import path from 'path';
import { resolveSQLiteStorageConfig, redactSQLitePath } from './storage/sqliteConfig';
import {
  getSQLiteProcessMetrics,
  getSQLiteRequestMetrics,
  runWithSQLiteRequestMetrics,
} from './storage/sqliteInstrumentation';
import { openSQLiteDriver } from './storage/sqliteStorageFactory';
import type {
  SQLiteDriverAdapter,
  SQLiteStorageConfig,
} from './storage/storageTypes';

type Filter = { field: string; op: string; val: any };
type BatchOp = { type: 'set' | 'update' | 'delete'; doc: SQLiteDoc; data?: any };

const MIGRATION_ID = 'import-db-json-v1';
const BASE_SCHEMA_MIGRATION_ID = 'base-schema-v1';
const ACTIVITY_EXPIRY_MIGRATION_ID = 'activity-expiry-columns-v1';
const GRAMMAR_ATTEMPT_QUERY_MIGRATION_ID = 'grammar-attempt-query-columns-v1';
const NATIVE_HOT_QUERY_MIGRATION_ID = 'native-hot-query-columns-v2';

let sqliteDb: SQLiteDriverAdapter | null = null;
let sqliteConfig: SQLiteStorageConfig | null = null;
let sqliteDbPath = '';
let sqliteReady = false;
let sqliteLastError: string | null = null;
let sqliteLastMigration: string | null = null;
let initPromise: Promise<void> | null = null;
let transactionDepth = 0;

const collectionTableMap: Record<string, string> = {
  users: 'users',
  guest_profiles: 'guest_profiles',
  guestprofiles: 'guest_profiles',
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
  game_session_actions: 'game_session_actions',
  gamesessionactions: 'game_session_actions',
  gameresults: 'game_results',
  leaderboard_events: 'leaderboard_events',
  leaderboardevents: 'leaderboard_events',
  pronunciation_attempts: 'game_results',
  pronunciationattempts: 'game_results',
  grammar_sets: 'grammar_sets',
  grammarsets: 'grammar_sets',
  grammar_questions: 'grammar_questions',
  grammarquestions: 'grammar_questions',
  grammar_options: 'grammar_options',
  grammaroptions: 'grammar_options',
  grammar_assignments: 'grammar_assignments',
  grammarassignments: 'grammar_assignments',
  grammar_attempts: 'grammar_attempts',
  grammarattempts: 'grammar_attempts',
  grammar_attempt_questions: 'grammar_attempt_questions',
  grammarattemptquestions: 'grammar_attempt_questions',
  grammar_attempt_answers: 'grammar_attempt_answers',
  grammarattemptanswers: 'grammar_attempt_answers',
  audit_logs: 'audit_logs',
  auditlogs: 'audit_logs',
  settings: 'settings',
};

const sqlQueryFieldMap: Record<string, Record<string, string>> = {
  users: {
    id: 'id',
    email: 'email',
    role: 'role',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  guest_profiles: {
    id: 'id',
    normalizedName: 'normalized_name',
    status: 'status',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    lastActiveAt: 'last_active_at',
  },
  class_members: {
    id: 'id',
    classId: 'class_id',
    userId: 'user_id',
    role: 'role',
    createdAt: 'created_at',
  },
  assignments: {
    id: 'id',
    classId: 'class_id',
    userId: 'user_id',
    vocabSetId: 'vocab_set_id',
    gameId: 'game_id',
    dueDate: 'due_date',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  game_results: {
    id: 'id',
    assignmentId: 'assignment_id',
    userId: 'user_id',
    studentId: 'user_id',
    gameId: 'game_id',
    vocabSetId: 'vocab_set_id',
    score: 'score',
    guestId: 'guest_id',
    ownerKey: 'owner_key',
    status: 'status',
    clientRunId: 'client_run_id',
    sourceType: 'source_type',
    sourceId: 'source_id',
    createdAt: 'created_at',
    completedAt: 'completed_at',
    expiresAt: 'expires_at',
  },
  game_session_actions: {
    id: 'id',
    sessionId: 'session_id',
    sequence: 'sequence',
    type: 'action_type',
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
  leaderboard_events: {
    id: 'id',
    sourceType: 'source_type',
    sourceId: 'source_id',
    studentKey: 'student_key',
    classId: 'class_id',
    vocabSetId: 'vocab_set_id',
    score: 'score',
    completedAt: 'completed_at',
    expiresAt: 'expires_at',
  },
  grammar_attempts: {
    id: 'id',
    grammarSetId: 'grammar_set_id',
    userId: 'user_id',
    guestId: 'guest_id',
    status: 'status',
    createdAt: 'created_at',
    completedAt: 'completed_at',
    updatedAt: 'updated_at',
  },
  audit_logs: {
    id: 'id',
    userId: 'user_id',
    action: 'action',
    timestamp: 'timestamp',
  },
};

function nowIso() {
  return new Date().toISOString();
}

function tableForCollection(collectionName: string) {
  return collectionTableMap[collectionName.toLowerCase()] || collectionName;
}

function parseJson(raw: string | null | undefined) {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function redactSQLiteError(error: unknown) {
  let message = String((error as any)?.message || error || 'Unknown SQLite error');
  if (sqliteDbPath) {
    message = message
      .split(sqliteDbPath).join('<sqlite-db>')
      .split(sqliteDbPath.replaceAll('\\', '/')).join('<sqlite-db>');
  }
  return message;
}

function ensureParentDir(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function getDb(): SQLiteDriverAdapter {
  if (!sqliteDb) {
    throw new Error('SQLite database is not initialized.');
  }
  return sqliteDb;
}

function persistDb() {
  if (!sqliteDb?.exportBytes || !sqliteDbPath || transactionDepth > 0) return;
  const exported = sqliteDb.exportBytes();
  ensureParentDir(sqliteDbPath);
  const tempPath = path.join(
    path.dirname(sqliteDbPath),
    `.tmp-${path.basename(sqliteDbPath)}-${process.pid}-${Date.now()}`
  );

  try {
    const fd = fs.openSync(tempPath, 'w');
    try {
      fs.writeFileSync(fd, Buffer.from(exported));
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(tempPath, sqliteDbPath);
  } catch (err) {
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch {
      // Keep the original persistence error.
    }
    throw err;
  }
}

function run(sql: string, params: any[] = [], shouldPersist = true) {
  getDb().run(sql, params);
  if (shouldPersist) persistDb();
}

function all(sql: string, params: any[] = []) {
  return getDb().all(sql, params);
}

function one(sql: string, params: any[] = []) {
  return getDb().one(sql, params);
}

function withTransaction<T>(action: () => T, mode: 'deferred' | 'immediate' = 'deferred'): T {
  if (transactionDepth > 0) {
    return action();
  }

  transactionDepth++;
  let result: T;
  try {
    result = getDb().transaction(action, mode);
  } finally {
    transactionDepth--;
  }
  persistDb();
  return result;
}

function readRows(table: string): any[] {
  if (table === 'settings') {
    return all('SELECT key as id, key, value_json, updated_at FROM settings').map((row) => ({
      id: row.id,
      key: row.key,
      value: parseJson(row.value_json),
      updatedAt: row.updated_at,
    }));
  }

  return all(`SELECT id, data_json FROM ${table}`).map((row) => ({
    id: row.id,
    ...parseJson(row.data_json),
  }));
}

function readRowsWithSqlQuery(
  table: string,
  filters: Filter[],
  orderField?: string,
  orderDir = 'asc',
  limitVal?: number
): any[] | null {
  const fieldMap = sqlQueryFieldMap[table];
  if (!fieldMap) return null;

  const allowedOperators = new Set(['==', '!=', '>', '>=', '<', '<=']);
  if (filters.some(filter => !fieldMap[filter.field] || !allowedOperators.has(filter.op))) return null;
  if (orderField && !fieldMap[orderField]) return null;

  const params: any[] = [];
  const whereParts = filters.map(filter => {
    const column = fieldMap[filter.field];
    const operator = filter.op === '==' ? '=' : filter.op;
    params.push(filter.val);
    return `${column} ${operator} ?`;
  });

  let sql = `SELECT id, data_json FROM ${table}`;
  if (whereParts.length) sql += ` WHERE ${whereParts.join(' AND ')}`;
  if (orderField) sql += ` ORDER BY ${fieldMap[orderField]} ${orderDir === 'desc' ? 'DESC' : 'ASC'}`;
  if (limitVal !== undefined) {
    sql += ' LIMIT ?';
    params.push(Math.max(0, Math.floor(limitVal)));
  }

  return all(sql, params).map(row => ({
    id: row.id,
    ...parseJson(row.data_json),
  }));
}

function readRow(table: string, id: string): any | undefined {
  if (table === 'settings') {
    const row = one('SELECT key as id, key, value_json, updated_at FROM settings WHERE key = ?', [id]);
    if (!row) return undefined;
    return {
      id: row.id,
      key: row.key,
      value: parseJson(row.value_json),
      updatedAt: row.updated_at,
    };
  }

  const row = one(`SELECT id, data_json FROM ${table} WHERE id = ?`, [id]);
  if (!row) return undefined;
  return { id: row.id, ...parseJson(row.data_json) };
}

function applyFilters(items: any[], filters: Filter[]) {
  return items.filter((item) => {
    return filters.every((filter) => {
      const value = item?.[filter.field];
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
    const aVal = a?.[orderField];
    const bVal = b?.[orderField];
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
  const table = tableForCollection(collectionName);
  const data = { ...inputData, id };
  const dataJson = JSON.stringify(data);
  const createdAt = getTimestamp(data, 'createdAt', 'created_at');
  const updatedAt = data.updatedAt || data.updated_at || nowIso();

  if (table === 'users') {
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
        dataJson,
      ]
    );
    return;
  }

  if (table === 'guest_profiles') {
    run(
      `INSERT INTO guest_profiles (id, display_name, normalized_name, status, created_at, updated_at, last_active_at, data_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
        display_name = excluded.display_name,
        normalized_name = excluded.normalized_name,
        status = excluded.status,
        updated_at = excluded.updated_at,
        last_active_at = excluded.last_active_at,
        data_json = excluded.data_json`,
      [
        id,
        data.displayName || data.name || null,
        data.normalizedName || null,
        data.status || 'active',
        createdAt,
        updatedAt,
        data.lastActiveAt || data.last_active_at || updatedAt,
        dataJson,
      ]
    );
    return;
  }

  if (table === 'vocab_sets') {
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
          dataJson,
        ]
      );

      if (Array.isArray(data.items)) {
        run('DELETE FROM vocab_items WHERE vocab_set_id = ?', [id]);
        for (const item of data.items) {
          const itemId = item.id || `${id}-item-${item.displayOrder || Math.random().toString(36).slice(2)}`;
          upsertDoc('vocab_items', itemId, { ...item, id: itemId, vocabSetId: id, vocab_set_id: id });
        }
      }
    });
    return;
  }

  if (table === 'vocab_items') {
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
        dataJson,
      ]
    );
    return;
  }

  if (table === 'classes') {
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

  if (table === 'class_members') {
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
        dataJson,
      ]
    );
    return;
  }

  if (table === 'assignments') {
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
        dataJson,
      ]
    );
    return;
  }

  if (table === 'results') {
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
        dataJson,
      ]
    );
    return;
  }

  if (table === 'game_results') {
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
        dataJson,
      ]
    );
    return;
  }

  if (table === 'game_session_actions') {
    run(
      `INSERT INTO game_session_actions (id, session_id, sequence, action_type, created_at, updated_at, data_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at, data_json = excluded.data_json`,
      [id, data.sessionId || null, Number(data.sequence || 0), data.type || null, createdAt, updatedAt, dataJson]
    );
    return;
  }

  if (table === 'grammar_attempts') {
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
        dataJson,
      ]
    );
    return;
  }

  if (table === 'leaderboard_events') {
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
        dataJson,
      ]
    );
    return;
  }

  if (table === 'audit_logs') {
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

  if (table.startsWith('grammar_')) {
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

  if (table === 'settings') {
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

function updateDoc(collectionName: string, id: string, patch: any) {
  const existing = readRow(tableForCollection(collectionName), id) || { id };
  upsertDoc(collectionName, id, { ...existing, ...patch, id });
}

function deleteDoc(collectionName: string, id: string) {
  const table = tableForCollection(collectionName);
  if (table === 'settings') {
    run('DELETE FROM settings WHERE key = ?', [id]);
    return;
  }
  withTransaction(() => {
    run(`DELETE FROM ${table} WHERE id = ?`, [id]);
    if (table === 'vocab_sets') {
      run('DELETE FROM vocab_items WHERE vocab_set_id = ?', [id]);
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
    'INSERT OR IGNORE INTO migrations (id, applied_at) VALUES (?, ?)',
    [BASE_SCHEMA_MIGRATION_ID, nowIso()]
  );
  persistDb();
}

function hasMigration(id: string) {
  return Boolean(one('SELECT id FROM migrations WHERE id = ?', [id]));
}

function markMigration(id: string) {
  run('INSERT OR REPLACE INTO migrations (id, applied_at) VALUES (?, ?)', [id, nowIso()]);
  sqliteLastMigration = id;
}

function tableHasColumn(table: string, column: string) {
  return all(`PRAGMA table_info(${table})`).some(row => row.name === column);
}

function migrateActivityExpiryColumns() {
  if (hasMigration(ACTIVITY_EXPIRY_MIGRATION_ID)) {
    sqliteLastMigration = ACTIVITY_EXPIRY_MIGRATION_ID;
    return;
  }

  for (const table of ['results', 'game_results']) {
    if (!tableHasColumn(table, 'expires_at')) {
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
    'INSERT OR REPLACE INTO migrations (id, applied_at) VALUES (?, ?)',
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
      ['grammar_set_id', 'TEXT'],
      ['user_id', 'TEXT'],
      ['guest_id', 'TEXT'],
      ['status', 'TEXT'],
    ];
    for (const [column, type] of requiredColumns) {
      if (!tableHasColumn('grammar_attempts', column)) {
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
          row.id,
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
      'INSERT OR REPLACE INTO migrations (id, applied_at) VALUES (?, ?)',
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
    ['guest_id', 'TEXT'],
    ['owner_key', 'TEXT'],
    ['status', 'TEXT'],
    ['client_run_id', 'TEXT'],
    ['source_type', 'TEXT'],
    ['source_id', 'TEXT'],
    ['completed_at', 'TEXT'],
  ];
  for (const [column, type] of gameResultColumns) {
    if (!tableHasColumn('game_results', column)) {
      run(`ALTER TABLE game_results ADD COLUMN ${column} ${type}`, [], false);
    }
  }
  if (!tableHasColumn('grammar_attempts', 'completed_at')) {
    run('ALTER TABLE grammar_attempts ADD COLUMN completed_at TEXT', [], false);
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
        row.status || data.status || (data.completedAt ? 'completed' : null),
        row.client_run_id || data.clientRunId || data.client_run_id || null,
        row.source_type || data.sourceType || data.source_type || null,
        row.source_id || data.sourceId || data.source_id || null,
        row.completed_at || data.completedAt || data.endedAt || row.created_at || null,
        row.id,
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
      'UPDATE grammar_attempts SET completed_at = ? WHERE id = ?',
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
    'INSERT OR REPLACE INTO migrations (id, applied_at) VALUES (?, ?)',
    [NATIVE_HOT_QUERY_MIGRATION_ID, nowIso()]
  );
  sqliteLastMigration = NATIVE_HOT_QUERY_MIGRATION_ID;
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
    sqliteLastError = `Failed to backup db.json: ${redactSQLiteError(err)}`;
  }
}

function importCollection(collectionName: string, items: any[] | undefined) {
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

  const sourcePath = getJsonImportCandidates().find((candidate) => fs.existsSync(candidate));
  if (!sourcePath) {
    markMigration(MIGRATION_ID);
    return;
  }

  backupJsonFile(sourcePath);
  const raw = fs.readFileSync(sourcePath, 'utf8');
  const legacy = JSON.parse(raw);
  const imported = {
    users: importCollection('users', legacy.users),
    vocabSets: importCollection('vocab_sets', legacy.vocabSets || legacy.vocab_sets),
    classes: importCollection('classes', legacy.classes),
    classMembers: importCollection('class_members', legacy.classMembers || legacy.class_members),
    assignments: importCollection('assignments', legacy.assignments),
    results: importCollection('results', legacy.results),
    gameResults: importCollection('game_results', legacy.gameResults || legacy.game_sessions || legacy.gameSessions),
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
  markMigration(MIGRATION_ID);
}

export async function initializeSQLiteStorage() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      sqliteConfig = resolveSQLiteStorageConfig();
      sqliteDbPath = sqliteConfig.dbPath;
      sqliteDb = await openSQLiteDriver(sqliteConfig);

      assertQuickCheck('pre-migration');
      withTransaction(() => {
        runSchemaMigration();
        migrateActivityExpiryColumns();
        migrateGrammarAttemptQueryColumns();
        migrateNativeHotQueryColumns();
        if (sqliteConfig?.allowJsonImport) migrateFromJsonIfNeeded();
      }, 'immediate');
      configureSQLiteConnection(sqliteConfig);
      assertQuickCheck('post-migration');

      sqliteReady = true;
      sqliteLastError = null;
      console.log(
        `[Storage] SQLite ready: driver=${sqliteConfig.driver} db=${redactSQLitePath(sqliteDbPath)} journal=${readPragmaValue('journal_mode')}`
      );
    } catch (err: any) {
      sqliteReady = false;
      sqliteLastError = redactSQLiteError(err);
      console.error(
        `[Storage] SQLite ready: false db=${sqliteDbPath ? redactSQLitePath(sqliteDbPath) : 'unresolved'} error=${sqliteLastError}`
      );
      try {
        sqliteDb?.close();
      } catch {
        // Preserve the startup error.
      }
      sqliteDb = null;
      throw err;
    }
  })();

  return initPromise;
}

function readPragmaValue(name: string) {
  const row = one(`PRAGMA ${name}`) || {};
  return Object.values(row)[0];
}

function assertQuickCheck(stage: string) {
  const rows = all('PRAGMA quick_check');
  const values = rows.map(row => String(Object.values(row)[0] || '').toLowerCase());
  if (values.length !== 1 || values[0] !== 'ok') {
    throw new Error(`SQLite ${stage} quick_check failed: ${values.join(', ') || 'no result'}`);
  }
}

function configureSQLiteConnection(config: SQLiteStorageConfig) {
  run('PRAGMA foreign_keys = ON', [], false);
  run(`PRAGMA busy_timeout = ${config.busyTimeoutMs}`, [], false);

  if (config.driver === 'better-sqlite3') {
    run('PRAGMA journal_mode = WAL', [], false);
    run(`PRAGMA synchronous = ${config.synchronous}`, [], false);
    run(`PRAGMA wal_autocheckpoint = ${config.walAutoCheckpointPages}`, [], false);
  } else {
    const journalMode = String(readPragmaValue('journal_mode') || '').toLowerCase();
    if (journalMode === 'wal') {
      throw new Error('sql.js startup refused while journal_mode is WAL.');
    }
  }

  const foreignKeys = Number(readPragmaValue('foreign_keys'));
  const busyTimeout = Number(readPragmaValue('busy_timeout'));
  if (foreignKeys !== 1) throw new Error('SQLite foreign_keys verification failed.');
  if (busyTimeout !== config.busyTimeoutMs) {
    throw new Error(`SQLite busy_timeout verification failed: ${busyTimeout}.`);
  }

  if (config.driver === 'better-sqlite3') {
    const journalMode = String(readPragmaValue('journal_mode') || '').toLowerCase();
    const walAutoCheckpoint = Number(readPragmaValue('wal_autocheckpoint'));
    if (journalMode !== 'wal') {
      throw new Error(`SQLite WAL verification failed: journal_mode=${journalMode || 'unknown'}.`);
    }
    if (walAutoCheckpoint !== config.walAutoCheckpointPages) {
      throw new Error(`SQLite wal_autocheckpoint verification failed: ${walAutoCheckpoint}.`);
    }
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
    await initializeSQLiteStorage();
    const data = readRow(tableForCollection(this.collectionName), this.id);
    return new SQLiteDocSnapshot(this.id, data !== undefined, this, data);
  }

  public async set(data: any) {
    await initializeSQLiteStorage();
    upsertDoc(this.collectionName, this.id, data);
  }

  public async update(data: any) {
    await initializeSQLiteStorage();
    updateDoc(this.collectionName, this.id, data);
  }

  public async delete() {
    await initializeSQLiteStorage();
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
      if (this.limitVal !== undefined) {
        items = items.slice(0, this.limitVal);
      }
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
    await initializeSQLiteStorage();
    withTransaction(() => {
      for (const op of this.ops) {
        if (op.type === 'set') upsertDoc(op.doc.collectionName, op.doc.id, op.data);
        if (op.type === 'update') updateDoc(op.doc.collectionName, op.doc.id, op.data);
        if (op.type === 'delete') deleteDoc(op.doc.collectionName, op.doc.id);
      }
    });
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

async function tableCount(table: string) {
  try {
    await initializeSQLiteStorage();
    const row = one(`SELECT COUNT(*) as count FROM ${table}`);
    return Number(row?.count || 0);
  } catch {
    return 0;
  }
}

export async function getSQLiteDiagnostics() {
  await initializeSQLiteStorage();
  const lastMigration = one('SELECT id, applied_at FROM migrations ORDER BY applied_at DESC LIMIT 1') || null;
  const dbSizeBytes = sqliteDbPath && fs.existsSync(sqliteDbPath) ? fs.statSync(sqliteDbPath).size : 0;
  const walPath = `${sqliteDbPath}-wal`;
  const shmPath = `${sqliteDbPath}-shm`;
  const walSizeBytes = fs.existsSync(walPath) ? fs.statSync(walPath).size : 0;
  const sqliteVersion = one('SELECT sqlite_version() AS version') as any;
  const quickCheck = one('PRAGMA quick_check') as any;

  return {
    storageMode: process.env.STORAGE_MODE || 'firebase-first',
    sqliteEnabled: process.env.STORAGE_MODE === 'sqlite',
    sqliteDriver: sqliteDb?.kind || sqliteConfig?.driver || null,
    sqliteDbPath: sqliteDbPath ? redactSQLitePath(sqliteDbPath) : null,
    sqliteDbBasename: sqliteDbPath ? path.basename(sqliteDbPath) : null,
    sqliteFileExists: Boolean(sqliteDbPath && fs.existsSync(sqliteDbPath)),
    databaseExists: Boolean(sqliteDbPath && fs.existsSync(sqliteDbPath)),
    sqliteReady,
    sqliteVersion: sqliteVersion?.version || null,
    quickCheck: quickCheck ? Object.values(quickCheck)[0] : null,
    nodeVersion: process.version,
    nodeAbi: process.versions.modules,
    platform: process.platform,
    architecture: process.arch,
    pragmas: {
      journalMode: readPragmaValue('journal_mode'),
      foreignKeys: Number(readPragmaValue('foreign_keys')),
      synchronous: readPragmaValue('synchronous'),
      busyTimeoutMs: Number(readPragmaValue('busy_timeout')),
      walAutoCheckpointPages: Number(readPragmaValue('wal_autocheckpoint')),
    },
    files: {
      databaseBytes: dbSizeBytes,
      walExists: fs.existsSync(walPath),
      shmExists: fs.existsSync(shmPath),
      walBytes: walSizeBytes,
    },
    databaseSizeBytes: dbSizeBytes,
    journalMode: readPragmaValue('journal_mode'),
    synchronous: readPragmaValue('synchronous'),
    foreignKeys: Number(readPragmaValue('foreign_keys')),
    busyTimeoutMs: Number(readPragmaValue('busy_timeout')),
    walAutoCheckpointPages: Number(readPragmaValue('wal_autocheckpoint')),
    walFileExists: fs.existsSync(walPath),
    shmFileExists: fs.existsSync(shmPath),
    walFileSizeBytes: walSizeBytes,
    tableCounts: {
      users: await tableCount('users'),
      vocab_sets: await tableCount('vocab_sets'),
      vocab_items: await tableCount('vocab_items'),
      classes: await tableCount('classes'),
      assignments: await tableCount('assignments'),
      results: await tableCount('results'),
      game_results: await tableCount('game_results'),
      leaderboard_events: await tableCount('leaderboard_events'),
      grammar_sets: await tableCount('grammar_sets'),
      grammar_attempts: await tableCount('grammar_attempts'),
    },
    lastMigration: lastMigration || sqliteLastMigration,
    lastError: sqliteLastError,
    processMetrics: getSQLiteProcessMetrics(),
  };
}

export function getSQLitePersistStats() {
  const metrics = getSQLiteProcessMetrics();
  return {
    attempts: metrics.rowsWritten,
    successes: metrics.successfulWrites,
    totalMs: metrics.queryDurationMs,
    lastMs: 0,
    deprecated: true,
  };
}

export function getSQLiteCurrentRequestMetrics() {
  return getSQLiteRequestMetrics();
}

export function withSQLiteRequestMetrics<T>(action: () => T) {
  return runWithSQLiteRequestMetrics(sqliteDb?.kind || sqliteConfig?.driver || null, action);
}

export async function closeSQLiteStorage() {
  if (!sqliteDb) {
    sqliteReady = false;
    initPromise = null;
    transactionDepth = 0;
    return;
  }
  try {
    if (sqliteDb.kind === 'better-sqlite3') {
      try {
        one('PRAGMA wal_checkpoint(PASSIVE)');
      } catch {
        // Shutdown continues; a later worker can checkpoint WAL.
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
