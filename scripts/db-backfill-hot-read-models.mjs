import crypto from 'node:crypto';
import path from 'node:path';
import {
  assertExistingFile,
  assertQuickCheck,
  createVerifiedBackup,
  Database,
  printJson,
  readArg,
  redactPath,
  resolveDatabasePath,
} from './sqlite-cli-common.mjs';
import { getSafeCliMode } from './learning-history-common.mjs';

const RETENTION_DAYS = 62;
const BATCH_SIZE = 400;
const READ_MODEL_SETTING_ID = 'leaderboard-read-model-v1';

function parseJson(value) {
  try {
    return value ? JSON.parse(value) : {};
  } catch {
    return {};
  }
}

function text(value, limit = 180) {
  return String(value ?? '').trim().slice(0, limit);
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizePersonName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ');
}

function isValidStudentName(value) {
  const normalized = String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
  const length = Array.from(normalized).length;
  return length >= 2
    && length <= 20
    && /^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$/u.test(normalized);
}

function activityTime(data) {
  return data.completedAt || data.endedAt || data.lastSavedAt
    || data.updatedAt || data.startedAt || data.createdAt || '';
}

function addDaysIso(baseIso, days) {
  return new Date(new Date(baseIso).getTime() + days * 86_400_000).toISOString();
}

function leaderboardEventId(sourceType, sourceId) {
  const hash = crypto.createHash('sha1').update(`${sourceType}:${sourceId}`).digest('hex');
  return `leaderboard-${hash}`;
}

function gradeClass(set = {}) {
  const gradeLevel = text(set.gradeLevel, 180);
  return gradeLevel
    ? { classId: `grade:${normalizePersonName(gradeLevel)}`, className: gradeLevel }
    : { classId: '', className: '' };
}

function buildGuestCandidates(db) {
  const existing = new Set(
    db.prepare('SELECT id FROM guest_profiles').all().map(row => row.id)
  );
  const candidates = new Map();
  const collect = row => {
    const data = { id: row.id, ...parseJson(row.data_json) };
    const guestId = text(data.guestId || row.guest_id, 120);
    const userId = text(data.userId || row.user_id, 120);
    if (!guestId || !(data.ownerType === 'guest' || !userId || userId === guestId)) return;
    const displayName = text(data.studentName || 'Học sinh', 120);
    const lastActiveAt = activityTime(data) || new Date(0).toISOString();
    const createdAt = data.createdAt || data.startedAt || lastActiveAt;
    const prior = candidates.get(guestId);
    if (!prior || new Date(lastActiveAt).getTime() >= new Date(prior.lastActiveAt).getTime()) {
      candidates.set(guestId, {
        guestId,
        displayName,
        createdAt: prior?.createdAt && new Date(prior.createdAt).getTime() < new Date(createdAt).getTime()
          ? prior.createdAt
          : createdAt,
        lastActiveAt,
      });
    } else if (new Date(createdAt).getTime() < new Date(prior.createdAt).getTime()) {
      prior.createdAt = createdAt;
    }
  };
  for (const tableName of ['game_results', 'grammar_attempts']) {
    for (const row of db.prepare(`SELECT id, user_id, guest_id, data_json FROM ${tableName}`).iterate()) {
      collect(row);
    }
  }
  return [...candidates.values()].filter(candidate => !existing.has(candidate.guestId));
}

function buildVocabularyEvent(row, vocabSetsById) {
  const data = { id: row.id, ...parseJson(row.data_json) };
  const sourceId = text(data.id || row.id, 180);
  const completedAt = data.completedAt || row.completed_at;
  if (!sourceId || !completedAt) return null;
  const fallbackClass = gradeClass(vocabSetsById.get(data.vocabSetId));
  return {
    id: leaderboardEventId('vocabulary', sourceId),
    sourceType: 'vocabulary',
    sourceId,
    assignmentId: text(data.assignmentId, 180),
    classId: text(data.classId || fallbackClass.classId, 180),
    className: text(data.className || fallbackClass.className, 180),
    vocabSetId: text(data.vocabSetId, 180),
    vocabSetTitle: text(data.vocabSetTitle, 240),
    grammarSetId: '',
    gameId: text(data.gameId, 120),
    gameName: text(data.gameName, 160),
    gameType: text(data.gameType, 80),
    ownerKey: text(data.ownerKey, 180),
    ownerType: text(data.ownerType, 40),
    userId: text(data.userId, 180),
    studentId: text(data.studentId, 180),
    guestId: text(data.guestId, 180),
    studentName: text(data.studentName || 'Học sinh', 160),
    startedAt: data.startedAt || completedAt,
    endedAt: data.endedAt || completedAt,
    completedAt,
    createdAt: data.createdAt || completedAt,
    durationMs: Math.max(0, number(data.durationMs)),
    durationSeconds: Math.max(0, number(data.durationSeconds)),
    score: Math.max(0, number(data.score)),
    rawScore: Math.max(0, number(data.rawScore)),
    maxScore: Math.max(0, number(data.maxScore, data.totalQuestions)),
    totalQuestions: Math.max(0, number(data.totalQuestions)),
    correctAnswers: Math.max(0, number(data.correctAnswers)),
    incorrectAnswers: Math.max(0, number(data.incorrectAnswers)),
    accuracy: Math.max(0, Math.min(100, number(data.accuracy))),
    status: 'completed',
    expiresAt: data.expiresAt || addDaysIso(completedAt, RETENTION_DAYS),
  };
}

function buildGrammarEvent(row, grammarSetsById) {
  const data = { id: row.id, ...parseJson(row.data_json) };
  const sourceId = text(data.id || row.id, 180);
  const completedAt = data.completedAt || row.completed_at;
  if (!sourceId || !completedAt) return null;
  const set = grammarSetsById.get(data.grammarSetId) || {};
  const fallbackClass = gradeClass(set);
  const correctAnswers = Math.max(0, number(data.correctCount));
  const incorrectAnswers = Math.max(0, number(data.wrongCount)) + Math.max(0, number(data.unansweredCount));
  const totalQuestions = Math.max(1, correctAnswers + incorrectAnswers, number(data.questions?.length), number(data.maxScore), 1);
  const accuracy = Math.round(correctAnswers / totalQuestions * 100);
  return {
    id: leaderboardEventId('grammar', sourceId),
    sourceType: 'grammar',
    sourceId,
    assignmentId: text(data.assignmentId, 180),
    classId: text(data.classId || set.classId || fallbackClass.classId, 180),
    className: text(data.className || set.className || fallbackClass.className, 180),
    vocabSetId: `grammar:${text(data.grammarSetId, 180)}`,
    vocabSetTitle: text(data.grammarSetTitle || set.title || 'Bài ngữ pháp', 240),
    grammarSetId: text(data.grammarSetId, 180),
    gameId: 'grammar-practice',
    gameName: 'Luyện ngữ pháp',
    gameType: 'grammar',
    ownerKey: text(data.ownerKey, 180),
    ownerType: text(data.ownerType || (data.guestId ? 'guest' : 'user'), 40),
    userId: text(data.userId, 180),
    studentId: text(data.userId, 180),
    guestId: text(data.guestId, 180),
    studentName: text(data.studentName || 'Học sinh', 160),
    startedAt: data.startedAt || data.createdAt || completedAt,
    endedAt: completedAt,
    completedAt,
    createdAt: data.createdAt || data.startedAt || completedAt,
    durationMs: Math.max(0, number(data.durationSeconds)) * 1000,
    durationSeconds: Math.max(0, number(data.durationSeconds)),
    score: accuracy,
    rawScore: Math.max(0, number(data.score)),
    maxScore: Math.max(0, number(data.maxScore, totalQuestions)),
    totalQuestions,
    correctAnswers,
    incorrectAnswers,
    accuracy,
    status: 'completed',
    expiresAt: addDaysIso(completedAt, RETENTION_DAYS),
  };
}

function buildMissingLeaderboardEvents(db, cutoff) {
  const existing = new Set(
    db.prepare(
      `SELECT source_type, source_id, data_json FROM leaderboard_events
       WHERE completed_at >= ?`
    ).all(cutoff).map(row => {
      const data = parseJson(row.data_json);
      return `${row.source_type || data.sourceType}:${row.source_id || data.sourceId}`;
    })
  );
  const vocabSetsById = new Map(
    db.prepare('SELECT id, data_json FROM vocab_sets').all()
      .map(row => [row.id, { id: row.id, ...parseJson(row.data_json) }])
  );
  const grammarSetsById = new Map(
    db.prepare('SELECT id, data_json FROM grammar_sets').all()
      .map(row => [row.id, { id: row.id, ...parseJson(row.data_json) }])
  );
  const events = [];
  const vocabularyRows = db.prepare(
    `SELECT id, completed_at, data_json FROM game_results
     WHERE completed_at >= ? AND (status IS NULL OR status = 'completed')`
  ).all(cutoff);
  for (const row of vocabularyRows) {
    const event = buildVocabularyEvent(row, vocabSetsById);
    if (event && !existing.has(`vocabulary:${event.sourceId}`)) events.push(event);
  }
  const grammarRows = db.prepare(
    `SELECT id, completed_at, data_json FROM grammar_attempts
     WHERE completed_at >= ? AND status = 'completed'`
  ).all(cutoff);
  for (const row of grammarRows) {
    const event = buildGrammarEvent(row, grammarSetsById);
    if (event && !existing.has(`grammar:${event.sourceId}`)) events.push(event);
  }
  return events;
}

function assertSchema(db, { runGuestProfileBackfill, runLeaderboardBackfill }) {
  const requiredTables = new Set(['game_results', 'grammar_attempts']);
  if (runGuestProfileBackfill) requiredTables.add('guest_profiles');
  if (runLeaderboardBackfill) {
    for (const tableName of ['leaderboard_events', 'settings', 'vocab_sets', 'grammar_sets']) {
      requiredTables.add(tableName);
    }
  }
  for (const tableName of requiredTables) {
    const exists = db.prepare(
      "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?"
    ).get(tableName);
    if (!exists) throw new Error(`Required table is missing: ${tableName}`);
  }
}

function insertGuestProfiles(db, candidates, now) {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO guest_profiles
       (id, display_name, normalized_name, status, created_at, updated_at, last_active_at, data_json)
     VALUES (?, ?, ?, 'active', ?, ?, ?, ?)`
  );
  let inserted = 0;
  for (let offset = 0; offset < candidates.length; offset += BATCH_SIZE) {
    const batch = db.transaction(rows => {
      let changes = 0;
      for (const candidate of rows) {
        const profile = {
          id: candidate.guestId,
          guestId: candidate.guestId,
          accountType: 'guest',
          displayName: candidate.displayName,
          name: candidate.displayName,
          normalizedName: normalizePersonName(candidate.displayName),
          role: 'student',
          status: 'active',
          createdAt: candidate.createdAt || now,
          updatedAt: now,
          lastActiveAt: candidate.lastActiveAt || now,
          needsReview: !isValidStudentName(candidate.displayName),
        };
        changes += insert.run(
          profile.id,
          profile.displayName,
          profile.normalizedName,
          profile.createdAt,
          profile.updatedAt,
          profile.lastActiveAt,
          JSON.stringify(profile)
        ).changes;
      }
      return changes;
    });
    inserted += batch(candidates.slice(offset, offset + BATCH_SIZE));
  }
  return inserted;
}

function insertLeaderboardEvents(db, events) {
  const insert = db.prepare(
    `INSERT OR IGNORE INTO leaderboard_events
       (id, source_type, source_id, student_key, class_id, vocab_set_id, score, completed_at, expires_at, data_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  let inserted = 0;
  for (let offset = 0; offset < events.length; offset += BATCH_SIZE) {
    const batch = db.transaction(rows => {
      let changes = 0;
      for (const event of rows) {
        changes += insert.run(
          event.id,
          event.sourceType,
          event.sourceId,
          event.ownerKey || event.guestId || event.userId || event.studentId || '',
          event.classId,
          event.vocabSetId,
          event.score,
          event.completedAt,
          event.expiresAt,
          JSON.stringify(event)
        ).changes;
      }
      return changes;
    });
    inserted += batch(events.slice(offset, offset + BATCH_SIZE));
  }
  return inserted;
}

let databasePath = '';
let db;

try {
  databasePath = resolveDatabasePath();
  assertExistingFile(databasePath);
  const mode = getSafeCliMode();
  if (mode === 'resume') throw new Error('Use --execute; inserts are already idempotent.');
  const target = readArg('--target') || 'all';
  if (!['all', 'leaderboard', 'guest-profiles'].includes(target)) {
    throw new Error('--target must be one of: leaderboard, guest-profiles, all.');
  }
  const runGuestProfileBackfill = target === 'all' || target === 'guest-profiles';
  const runLeaderboardBackfill = target === 'all' || target === 'leaderboard';
  const asOf = readArg('--as-of') || new Date().toISOString();
  if (!Number.isFinite(new Date(asOf).getTime())) throw new Error('--as-of must be a valid ISO instant.');
  const cutoff = new Date(new Date(asOf).getTime() - RETENTION_DAYS * 86_400_000).toISOString();

  db = new Database(databasePath, { fileMustExist: true, readonly: mode === 'dry-run', timeout: 10_000 });
  db.pragma('busy_timeout = 10000');
  assertQuickCheck(db, 'database');
  assertSchema(db, { runGuestProfileBackfill, runLeaderboardBackfill });
  const guestCandidates = runGuestProfileBackfill ? buildGuestCandidates(db) : [];
  const leaderboardCandidates = runLeaderboardBackfill ? buildMissingLeaderboardEvents(db, cutoff) : [];

  if (mode === 'dry-run') {
    printJson({
      ok: true,
      mode,
      target,
      database: redactPath(databasePath),
      quickCheck: 'ok',
      asOf,
      leaderboardCutoff: cutoff,
      plannedGuestProfiles: guestCandidates.length,
      plannedLeaderboardEvents: leaderboardCandidates.length,
      readModelReady: runLeaderboardBackfill ? false : null,
      sourceMutation: 'none',
      note: 'Dry-run is read-only. Create/review a backup, then re-run with --execute.',
    });
  } else {
    db.close();
    db = undefined;
    const backupDirectory = readArg('--backup-dir')
      || process.env.SQLITE_BACKUP_DIR
      || path.join(path.dirname(databasePath), 'backups');
    const backupPath = await createVerifiedBackup(databasePath, backupDirectory);
    db = new Database(databasePath, { fileMustExist: true, timeout: 10_000 });
    db.pragma('busy_timeout = 10000');
    db.pragma('foreign_keys = ON');
    assertQuickCheck(db, 'database');
    assertSchema(db, { runGuestProfileBackfill, runLeaderboardBackfill });
    const executeGuestCandidates = runGuestProfileBackfill ? buildGuestCandidates(db) : [];
    const executeLeaderboardCandidates = runLeaderboardBackfill ? buildMissingLeaderboardEvents(db, cutoff) : [];
    const sourceCountsBefore = {
      gameResults: number(db.prepare('SELECT COUNT(*) AS count FROM game_results').get().count),
      grammarAttempts: number(db.prepare('SELECT COUNT(*) AS count FROM grammar_attempts').get().count),
    };
    const now = new Date().toISOString();
    const guestInserted = runGuestProfileBackfill
      ? insertGuestProfiles(db, executeGuestCandidates, now)
      : 0;
    const leaderboardInserted = runLeaderboardBackfill
      ? insertLeaderboardEvents(db, executeLeaderboardCandidates)
      : 0;
    const missingAfter = runLeaderboardBackfill ? buildMissingLeaderboardEvents(db, cutoff) : [];
    if (runLeaderboardBackfill && missingAfter.length !== 0) {
      throw new Error(`Leaderboard reconciliation still has ${missingAfter.length} missing source rows.`);
    }
    assertQuickCheck(db, 'post-backfill database');
    const sourceCountsAfter = {
      gameResults: number(db.prepare('SELECT COUNT(*) AS count FROM game_results').get().count),
      grammarAttempts: number(db.prepare('SELECT COUNT(*) AS count FROM grammar_attempts').get().count),
    };
    if (JSON.stringify(sourceCountsBefore) !== JSON.stringify(sourceCountsAfter)) {
      throw new Error('Source row counts changed during additive backfill.');
    }
    if (runLeaderboardBackfill) {
      db.prepare(
        `INSERT INTO settings (key, value_json, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at`
      ).run(READ_MODEL_SETTING_ID, JSON.stringify({
        ready: true,
        version: 1,
        backfilledThrough: asOf,
        retentionDays: RETENTION_DAYS,
      }), now);
      assertQuickCheck(db, 'read-model-ready database');
    }
    printJson({
      ok: true,
      mode,
      target,
      database: redactPath(databasePath),
      backup: redactPath(backupPath),
      backupQuickCheck: 'ok',
      quickCheck: 'ok',
      asOf,
      leaderboardCutoff: cutoff,
      guestProfiles: { planned: executeGuestCandidates.length, inserted: guestInserted },
      leaderboardEvents: { planned: executeLeaderboardCandidates.length, inserted: leaderboardInserted, missingAfter: 0 },
      sourceCounts: { before: sourceCountsBefore, after: sourceCountsAfter, unchanged: true },
      readModelReady: runLeaderboardBackfill ? true : null,
      sourceMutation: 'none',
    });
  }
} catch (error) {
  printJson({
    ok: false,
    database: databasePath ? redactPath(databasePath) : null,
    error: String(error?.message || error || 'Unknown read-model backfill error'),
  });
  process.exitCode = 1;
} finally {
  if (db?.open) db.close();
}
