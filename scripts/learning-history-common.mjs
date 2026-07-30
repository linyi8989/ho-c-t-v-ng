import crypto from 'node:crypto';
import {
  assertExistingFile,
  assertQuickCheck,
  Database,
  hasFlag,
  readArg,
} from './sqlite-cli-common.mjs';

export const DEFAULT_BACKFILL_BATCH_SIZE = 500;
export const MAX_BACKFILL_BATCH_SIZE = 1_000;
export const APP_TIME_ZONE = 'Asia/Bangkok';

export const LEARNING_ATTEMPT_COLUMNS = Object.freeze([
  'attempt_id',
  'source_record_id',
  'client_run_id',
  'source_type',
  'student_type',
  'user_id',
  'guest_id',
  'owner_key',
  'ownership_status',
  'student_name_snapshot',
  'class_id',
  'class_name_snapshot',
  'assignment_id',
  'assignment_title_snapshot',
  'assignment_due_at_snapshot',
  'lesson_id',
  'lesson_title_snapshot',
  'lesson_type',
  'game_id',
  'game_title_snapshot',
  'score',
  'raw_score',
  'max_score',
  'correct_count',
  'incorrect_count',
  'unanswered_count',
  'mistake_count',
  'total_questions',
  'started_at',
  'completed_at',
  'activity_at',
  'study_date',
  'duration_seconds',
  'attempt_status',
  'attempt_number',
  'schema_version',
  'detail_status',
  'normalization_status',
  'created_at',
  'updated_at',
]);

export const ATTEMPT_DETAIL_COLUMNS = Object.freeze([
  'attempt_id',
  'client_run_id',
  'source_type',
  'answer_details_json',
  'question_snapshots_json',
  'option_snapshots_json',
  'extra_details_json',
  'review_policy_json',
  'created_at',
  'updated_at',
  'expires_at',
  'schema_version',
]);

const studyDateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function tableInfo(db, tableName) {
  return db.prepare(`PRAGMA table_info(${quoteIdentifier(tableName)})`).all();
}

function tableExists(db, tableName) {
  return Boolean(
    db.prepare(
      `SELECT 1
       FROM sqlite_schema
       WHERE type = 'table' AND name = ?
       LIMIT 1`
    ).get(tableName)
  );
}

function indexColumns(db, indexName) {
  return db.prepare(`PRAGMA index_info(${quoteIdentifier(indexName)})`)
    .all()
    .sort((left, right) => Number(left.seqno) - Number(right.seqno))
    .map(row => String(row.name));
}

function hasExactUniqueIndex(db, tableName, expectedColumns) {
  const indexes = db.prepare(`PRAGMA index_list(${quoteIdentifier(tableName)})`).all();
  return indexes.some(index => (
    Number(index.unique) === 1
    && Number(index.partial) === 0
    && JSON.stringify(indexColumns(db, index.name)) === JSON.stringify(expectedColumns)
  ));
}

function assertRequiredColumns(db, tableName, expectedColumns) {
  if (!tableExists(db, tableName)) {
    throw new Error(`Required Release B table is missing: ${tableName}`);
  }
  const existing = new Set(tableInfo(db, tableName).map(column => String(column.name)));
  const missing = expectedColumns.filter(column => !existing.has(column));
  if (missing.length) {
    throw new Error(
      `Release B table ${tableName} is missing columns: ${missing.join(', ')}`
    );
  }
}

function assertSingleColumnPrimaryKey(db, tableName, expectedColumn) {
  const primaryKey = tableInfo(db, tableName)
    .filter(column => Number(column.pk) > 0)
    .sort((left, right) => Number(left.pk) - Number(right.pk))
    .map(column => String(column.name));
  if (primaryKey.length !== 1 || primaryKey[0] !== expectedColumn) {
    throw new Error(
      `Release B table ${tableName} must use ${expectedColumn} as its primary key.`
    );
  }
}

export function assertLearningHistorySchema(db) {
  assertRequiredColumns(db, 'learning_attempts', LEARNING_ATTEMPT_COLUMNS);
  assertRequiredColumns(db, 'attempt_details', ATTEMPT_DETAIL_COLUMNS);
  assertSingleColumnPrimaryKey(db, 'learning_attempts', 'attempt_id');
  assertSingleColumnPrimaryKey(db, 'attempt_details', 'attempt_id');
  if (!hasExactUniqueIndex(
    db,
    'learning_attempts',
    ['source_type', 'source_record_id']
  )) {
    throw new Error(
      'learning_attempts requires a unique index on (source_type, source_record_id).'
    );
  }
  const detailForeignKey = db.prepare(
    `PRAGMA foreign_key_list(${quoteIdentifier('attempt_details')})`
  ).all().find(foreignKey => (
    String(foreignKey.table) === 'learning_attempts'
    && String(foreignKey.from) === 'attempt_id'
    && String(foreignKey.to) === 'attempt_id'
    && String(foreignKey.on_delete).toUpperCase() === 'RESTRICT'
  ));
  if (!detailForeignKey) {
    throw new Error(
      'attempt_details requires an attempt_id foreign key to learning_attempts with ON DELETE RESTRICT.'
    );
  }
}

export function openLearningHistoryDatabase(databasePath, { readonly = false } = {}) {
  assertExistingFile(databasePath);
  const db = new Database(databasePath, {
    fileMustExist: true,
    readonly,
    timeout: 10_000,
  });
  db.pragma('busy_timeout = 10000');
  if (!readonly) db.pragma('foreign_keys = ON');
  assertQuickCheck(db, 'database');
  assertLearningHistorySchema(db);
  return db;
}

export function getSafeCliMode() {
  const execute = hasFlag('--execute');
  const resume = hasFlag('--resume');
  const explicitDryRun = hasFlag('--dry-run');
  if (execute && resume) {
    throw new Error('Use only one of --execute or --resume.');
  }
  if ((execute || resume) && explicitDryRun) {
    throw new Error('--dry-run cannot be combined with --execute or --resume.');
  }
  return execute ? 'execute' : resume ? 'resume' : 'dry-run';
}

export function readIntegerArg(name, {
  defaultValue,
  minimum = Number.MIN_SAFE_INTEGER,
  maximum = Number.MAX_SAFE_INTEGER,
} = {}) {
  const raw = readArg(name);
  if (raw === undefined) return defaultValue;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(
      `${name} must be an integer between ${minimum} and ${maximum}.`
    );
  }
  return value;
}

export function safeParseJsonObject(raw) {
  if (typeof raw !== 'string' || !raw.trim()) {
    return { value: {}, error: null };
  }
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return { value: {}, error: 'JSON value is not an object' };
    }
    return { value, error: null };
  } catch {
    return { value: {}, error: 'malformed JSON' };
  }
}

function text(value, maximumLength = 1_000) {
  if (value === null || value === undefined) return '';
  return String(value).normalize('NFKC').trim().slice(0, maximumLength);
}

function nullableText(value, maximumLength = 1_000) {
  const result = text(value, maximumLength);
  return result || null;
}

function firstText(values, maximumLength = 1_000) {
  for (const value of values) {
    const normalized = nullableText(value, maximumLength);
    if (normalized) return normalized;
  }
  return null;
}

function finiteNumber(value) {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function nonNegativeInteger(value, fallback = 0) {
  const number = finiteNumber(value);
  return number === null ? fallback : Math.max(0, Math.round(number));
}

function nonNegativeNumber(value, fallback = 0) {
  const number = finiteNumber(value);
  return number === null ? fallback : Math.max(0, number);
}

function clampScore(value) {
  return Math.max(0, Math.min(100, Math.round(nonNegativeNumber(value))));
}

function normalizedIso(value) {
  if (!value) return null;
  const timestamp = new Date(value);
  return Number.isFinite(timestamp.getTime()) ? timestamp.toISOString() : null;
}

function studyDateAt(isoTimestamp) {
  if (!isoTimestamp) return null;
  const date = new Date(isoTimestamp);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = Object.fromEntries(
    studyDateFormatter.formatToParts(date)
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function durationSeconds(data, startedAt, completedAt) {
  const direct = finiteNumber(data.durationSeconds);
  if (direct !== null) return Math.max(0, Math.round(direct));
  const milliseconds = finiteNumber(data.durationMs);
  if (milliseconds !== null) return Math.max(0, Math.round(milliseconds / 1_000));
  if (!startedAt || !completedAt) return 0;
  const difference = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  return Number.isFinite(difference) ? Math.max(0, Math.round(difference / 1_000)) : 0;
}

function resolveOwner(data, row) {
  const guestId = firstText([row.guest_id, data.guestId, data.guest_id], 180);
  const rawUserId = firstText(
    [row.user_id, data.userId, data.user_id, data.studentId, data.student_id],
    180
  );
  const explicitOwner = firstText([row.owner_key, data.ownerKey, data.owner_key], 240);
  const declaredOwnerType = text(
    data.ownerType || data.owner_type,
    40
  ).toLowerCase();
  if (explicitOwner?.startsWith('user:')) {
    const id = rawUserId || nullableText(explicitOwner.slice('user:'.length), 180);
    if (id) {
      return {
        student_type: 'authenticated',
        user_id: id,
        guest_id: null,
        owner_key: `user:${id}`,
        ownership_status: 'linked',
      };
    }
  }
  if (explicitOwner?.startsWith('guest:')) {
    const id = guestId || nullableText(explicitOwner.slice('guest:'.length), 180);
    if (id) {
      return {
        student_type: 'guest',
        user_id: null,
        guest_id: id,
        owner_key: `guest:${id}`,
        ownership_status: 'linked',
      };
    }
  }
  if (rawUserId && (!guestId || declaredOwnerType !== 'guest')) {
    return {
      student_type: 'authenticated',
      user_id: rawUserId,
      guest_id: null,
      owner_key: `user:${rawUserId}`,
      ownership_status: 'linked',
    };
  }
  if (guestId) {
    return {
      student_type: 'guest',
      user_id: null,
      guest_id: guestId,
      owner_key: `guest:${guestId}`,
      ownership_status: 'linked',
    };
  }
  return {
    student_type: 'legacy',
    user_id: null,
    guest_id: null,
    owner_key: null,
    ownership_status: 'legacy_unlinked',
  };
}

function logicalVocabularyItemCount(data, gameId) {
  const items = Array.isArray(data.privateSnapshot?.items)
    ? data.privateSnapshot.items
    : [];
  if (!items.length) return null;
  if (gameId === 'matching-word-meaning') return Math.min(items.length, 8);
  if (gameId === 'memory-match') return Math.min(items.length, 6);
  if (gameId === 'millionaire-vocab') return Math.min(items.length, 15);
  return items.length;
}

function normalizeVocabularyCounts(data, row, gameId) {
  const storedCorrect = nonNegativeInteger(
    data.correctAnswers ?? data.correct_count ?? row.correct
  );
  const storedIncorrect = nonNegativeInteger(
    data.incorrectAnswers ?? data.incorrect_count ?? row.incorrect
  );
  const storedUnanswered = nonNegativeInteger(
    data.unansweredCount ?? data.unanswered_count
  );
  const snapshotTotal = logicalVocabularyItemCount(data, gameId);
  const declaredTotal = finiteNumber(data.totalQuestions ?? data.total_questions);
  let totalQuestions = snapshotTotal ?? (
    declaredTotal === null
      ? storedCorrect + storedIncorrect + storedUnanswered
      : Math.max(0, Math.round(declaredTotal))
  );
  totalQuestions = Math.max(totalQuestions, storedCorrect);

  const correctCount = Math.min(storedCorrect, totalQuestions);
  let incorrectCount = Math.min(
    storedIncorrect,
    Math.max(0, totalQuestions - correctCount)
  );
  let unansweredCount = Math.min(
    storedUnanswered,
    Math.max(0, totalQuestions - correctCount - incorrectCount)
  );

  if (correctCount + incorrectCount + unansweredCount < totalQuestions) {
    const missing = totalQuestions - correctCount - incorrectCount - unansweredCount;
    if (storedUnanswered > 0) unansweredCount += missing;
    else incorrectCount += missing;
  }

  const mistakeCount = gameId === 'matching-word-meaning' || gameId === 'memory-match'
    ? Math.max(0, storedIncorrect - incorrectCount)
    : nonNegativeInteger(data.mistakeCount ?? data.mistake_count);

  return {
    correct_count: correctCount,
    incorrect_count: incorrectCount,
    unanswered_count: unansweredCount,
    mistake_count: mistakeCount,
    total_questions: totalQuestions,
    normalization_status: snapshotTotal !== null || declaredTotal !== null
      ? 'canonical'
      : 'legacy_partial',
  };
}

function normalizeGrammarCounts(data) {
  const correctCount = nonNegativeInteger(data.correctCount ?? data.correct_count);
  const incorrectCount = nonNegativeInteger(
    data.wrongCount ?? data.incorrectCount ?? data.incorrect_count
  );
  const unansweredCount = nonNegativeInteger(
    data.unansweredCount ?? data.unanswered_count
  );
  const questionsLength = Array.isArray(data.questions) ? data.questions.length : 0;
  const declaredTotal = finiteNumber(data.totalQuestions ?? data.total_questions);
  const totalQuestions = Math.max(
    correctCount + incorrectCount + unansweredCount,
    questionsLength,
    declaredTotal === null ? 0 : Math.round(Math.max(0, declaredTotal))
  );
  return {
    correct_count: correctCount,
    incorrect_count: incorrectCount,
    unanswered_count: unansweredCount,
    mistake_count: 0,
    total_questions: totalQuestions,
    normalization_status: totalQuestions > 0 ? 'canonical' : 'legacy_partial',
  };
}

export function deterministicLearningAttemptId(sourceType, sourceRecordId) {
  const digest = crypto.createHash('sha256')
    .update(`learning-attempt-v1:${sourceType}:${sourceRecordId}`, 'utf8')
    .digest('hex');
  return `attempt-${digest.slice(0, 40)}`;
}

function commonAttemptFields({
  row,
  data,
  sourceType,
  lessonId,
  lessonTitle,
  lessonType,
  gameId,
  gameTitle,
  assignmentId,
  counts,
  score,
  rawScore,
  maxScore,
}) {
  const sourceRecordId = text(row.id, 500);
  const owner = resolveOwner(data, row);
  const completedAt = normalizedIso(
    row.completed_at || data.completedAt || data.completed_at || data.endedAt
  );
  const startedAt = normalizedIso(
    data.startedAt || data.started_at || row.created_at || completedAt
  );
  const activityAt = completedAt || startedAt;
  const now = new Date().toISOString();
  return {
    attempt_id: deterministicLearningAttemptId(sourceType, sourceRecordId),
    source_record_id: sourceRecordId,
    client_run_id: firstText(
      [row.client_run_id, data.clientRunId, data.client_run_id],
      240
    ),
    source_type: sourceType,
    ...owner,
    student_name_snapshot: firstText(
      [data.studentName, data.student_name, data.displayName],
      240
    ),
    class_id: firstText([data.classId, data.class_id], 180),
    class_name_snapshot: firstText(
      [data.className, data.class_name],
      240
    ),
    assignment_id: assignmentId,
    assignment_title_snapshot: assignmentId
      ? firstText(
          [data.assignmentTitle, data.assignment_title, data.assignmentName],
          320
        )
      : null,
    assignment_due_at_snapshot: assignmentId
      ? normalizedIso(
          data.assignmentDueAt
          || data.assignment_due_at
          || data.dueDate
          || data.due_date
        )
      : null,
    lesson_id: lessonId,
    lesson_title_snapshot: lessonTitle,
    lesson_type: lessonType,
    game_id: gameId,
    game_title_snapshot: gameTitle,
    score,
    raw_score: rawScore,
    max_score: maxScore,
    ...counts,
    started_at: startedAt,
    completed_at: completedAt,
    activity_at: activityAt,
    study_date: studyDateAt(activityAt),
    duration_seconds: durationSeconds(data, startedAt, completedAt),
    attempt_status: 'completed',
    attempt_number: Math.max(1, nonNegativeInteger(data.attemptNumber, 1)),
    schema_version: 1,
    detail_status: 'legacy',
    normalization_status: counts.normalization_status === 'canonical'
      ? 'canonical'
      : 'legacy_partial',
    created_at: now,
    updated_at: now,
  };
}

export function normalizeVocabularySourceRow(row) {
  const parsed = safeParseJsonObject(row.data_json);
  if (parsed.error) return { attempt: null, reason: 'malformed_json' };
  const data = parsed.value;
  const sourceRecordId = text(row.id, 500);
  const gameId = firstText([row.game_id, data.gameId, data.game_id], 160);
  const lessonId = firstText(
    [row.vocab_set_id, data.vocabSetId, data.vocab_set_id, data.vocabularySetId],
    180
  );
  const isPronunciationEvent = sourceRecordId.startsWith('pronunciation-')
    || text(row.source_type, 80).toLowerCase() === 'pronunciation'
    || (
      Boolean(data.gameSessionId)
      && Boolean(data.wordId)
      && !data.completedAt
      && !data.endedAt
    );
  if (isPronunciationEvent) {
    return { attempt: null, reason: 'pronunciation_event' };
  }
  if (!sourceRecordId || !gameId || !lessonId) {
    return { attempt: null, reason: 'unsupported_shape' };
  }
  const completedAt = normalizedIso(
    row.completed_at || data.completedAt || data.completed_at || data.endedAt
  );
  if (!completedAt) return { attempt: null, reason: 'missing_completed_at' };

  const counts = normalizeVocabularyCounts(data, row, gameId);
  const scoreValue = data.score ?? row.score;
  const rawScoreValue = data.rawScore ?? data.raw_score ?? data.gameScore ?? scoreValue;
  const maxScoreValue = data.maxScore ?? data.max_score ?? (
    gameId === 'millionaire-vocab' ? 1_000_000 : 100
  );
  return {
    attempt: commonAttemptFields({
      row,
      data,
      sourceType: 'vocabulary',
      lessonId,
      lessonTitle: firstText(
        [data.vocabSetTitle, data.lessonTitle, data.lesson_title],
        320
      ),
      lessonType: 'vocab_set',
      gameId,
      gameTitle: firstText(
        [data.gameName, data.gameTitle, data.game_title],
        240
      ),
      assignmentId: firstText([row.assignment_id], 180),
      counts,
      score: clampScore(scoreValue),
      rawScore: nonNegativeNumber(rawScoreValue),
      maxScore: nonNegativeNumber(maxScoreValue, 100),
    }),
    reason: null,
  };
}

export function normalizeGrammarSourceRow(row) {
  const parsed = safeParseJsonObject(row.data_json);
  if (parsed.error) return { attempt: null, reason: 'malformed_json' };
  const data = parsed.value;
  const sourceRecordId = text(row.id, 500);
  const lessonId = firstText(
    [row.grammar_set_id, data.grammarSetId, data.grammar_set_id],
    180
  );
  if (!sourceRecordId || !lessonId) {
    return { attempt: null, reason: 'unsupported_shape' };
  }
  const completedAt = normalizedIso(
    row.completed_at || data.completedAt || data.completed_at
  );
  if (!completedAt) return { attempt: null, reason: 'missing_completed_at' };

  const counts = normalizeGrammarCounts(data);
  const assignmentVerified = data.assignmentVerified === true
    || data.assignmentAccessVerified === true;
  const rawScore = nonNegativeNumber(data.score ?? data.rawScore ?? data.raw_score);
  const maxScore = nonNegativeNumber(
    data.maxScore ?? data.max_score,
    counts.total_questions
  );
  const canonicalScore = counts.total_questions > 0
    ? Math.round((counts.correct_count / counts.total_questions) * 100)
    : (maxScore > 0 ? Math.round((rawScore / maxScore) * 100) : 0);

  return {
    attempt: commonAttemptFields({
      row,
      data,
      sourceType: 'grammar',
      lessonId,
      lessonTitle: firstText(
        [data.grammarSetTitle, data.lessonTitle, data.lesson_title],
        320
      ),
      lessonType: 'grammar_set',
      gameId: 'grammar-practice',
      gameTitle: firstText(
        [data.gameName, data.gameTitle],
        240
      ) || 'Luyện ngữ pháp',
      assignmentId: assignmentVerified
        ? firstText([data.assignmentId, data.assignment_id], 180)
        : null,
      counts,
      score: clampScore(canonicalScore),
      rawScore,
      maxScore,
    }),
    reason: null,
  };
}

export const SOURCE_DEFINITIONS = Object.freeze({
  vocabulary: {
    tableName: 'game_results',
    normalizer: normalizeVocabularySourceRow,
    selectColumns: [
      'id',
      'assignment_id',
      'user_id',
      'guest_id',
      'owner_key',
      'game_id',
      'vocab_set_id',
      'score',
      'correct',
      'incorrect',
      'status',
      'client_run_id',
      'source_type',
      'created_at',
      'completed_at',
      'data_json',
    ],
  },
  grammar: {
    tableName: 'grammar_attempts',
    normalizer: normalizeGrammarSourceRow,
    selectColumns: [
      'id',
      'grammar_set_id',
      'user_id',
      'guest_id',
      'status',
      'created_at',
      'completed_at',
      'updated_at',
      'data_json',
    ],
  },
});

export function assertBackfillSourceSchema(db) {
  for (const definition of Object.values(SOURCE_DEFINITIONS)) {
    assertRequiredColumns(db, definition.tableName, definition.selectColumns);
  }
}

function buildSourceBatchStatement(db, sourceType, { remainingOnly }) {
  const definition = SOURCE_DEFINITIONS[sourceType];
  if (!definition) throw new Error(`Unsupported source type: ${sourceType}`);
  const sourceAlias = 'source';
  const remainingClause = remainingOnly
    ? `AND NOT EXISTS (
         SELECT 1
         FROM learning_attempts AS history
         WHERE history.source_type = ?
           AND history.source_record_id = ${sourceAlias}.id
       )`
    : '';
  const sql = `
    SELECT ${definition.selectColumns.map(column => `${sourceAlias}.${quoteIdentifier(column)}`).join(', ')}
    FROM ${quoteIdentifier(definition.tableName)} AS ${sourceAlias}
    WHERE ${sourceAlias}.id > ?
      AND LOWER(COALESCE(${sourceAlias}.status, '')) = 'completed'
      AND ${sourceAlias}.completed_at IS NOT NULL
      ${remainingClause}
    ORDER BY ${sourceAlias}.id ASC
    LIMIT ?`;
  return {
    statement: db.prepare(sql),
    parameterValues(cursor, batchSize) {
      return remainingOnly
        ? [cursor, sourceType, batchSize]
        : [cursor, batchSize];
    },
  };
}

export function scanSourceRows(db, sourceType, {
  batchSize = DEFAULT_BACKFILL_BATCH_SIZE,
  remainingOnly = false,
  onBatch,
} = {}) {
  const definition = SOURCE_DEFINITIONS[sourceType];
  const query = buildSourceBatchStatement(db, sourceType, { remainingOnly });
  let cursor = '';
  let batchNumber = 0;
  let scanned = 0;
  while (true) {
    const rows = query.statement.all(...query.parameterValues(cursor, batchSize));
    if (!rows.length) break;
    batchNumber += 1;
    cursor = String(rows[rows.length - 1].id);
    scanned += rows.length;
    onBatch?.({
      batchNumber,
      rows,
      sourceType,
      normalizer: definition.normalizer,
    });
  }
  return { batches: batchNumber, scanned };
}

export function prepareLearningAttemptInsert(db) {
  const quotedColumns = LEARNING_ATTEMPT_COLUMNS.map(quoteIdentifier);
  const placeholders = LEARNING_ATTEMPT_COLUMNS.map(() => '?');
  const statement = db.prepare(
    `INSERT INTO learning_attempts (${quotedColumns.join(', ')})
     VALUES (${placeholders.join(', ')})
     ON CONFLICT DO NOTHING`
  );
  return attempt => statement.run(
    ...LEARNING_ATTEMPT_COLUMNS.map(column => attempt[column] ?? null)
  );
}

export function reconcileLearningAttemptNumbers(db) {
  const statement = db.prepare(`
    WITH ranked AS (
      SELECT
        attempt_id,
        attempt_number AS current_ordinal,
        ROW_NUMBER() OVER (
          PARTITION BY owner_key, source_type, lesson_id, game_id
          ORDER BY activity_at ASC, source_record_id ASC
        ) AS ordinal
      FROM learning_attempts
    )
    UPDATE learning_attempts
    SET attempt_number = (
      SELECT ranked.ordinal
      FROM ranked
      WHERE ranked.attempt_id = learning_attempts.attempt_id
    )
    WHERE attempt_id IN (
      SELECT ranked.attempt_id
      FROM ranked
      WHERE ranked.ordinal <> ranked.current_ordinal
    )
  `);
  return Number(statement.run().changes);
}

function incrementReason(target, reason) {
  target[reason] = Number(target[reason] || 0) + 1;
}

export function reconcileLearningHistory(db, {
  batchSize = DEFAULT_BACKFILL_BATCH_SIZE,
} = {}) {
  const result = {
    source: {},
    history: {
      total: Number(db.prepare('SELECT COUNT(*) AS count FROM learning_attempts').get().count),
      vocabulary: Number(
        db.prepare(
          `SELECT COUNT(*) AS count
           FROM learning_attempts
           WHERE source_type = 'vocabulary'`
        ).get().count
      ),
      grammar: Number(
        db.prepare(
          `SELECT COUNT(*) AS count
           FROM learning_attempts
           WHERE source_type = 'grammar'`
        ).get().count
      ),
      duplicateSourceGroups: Number(
        db.prepare(
          `SELECT COUNT(*) AS count
           FROM (
             SELECT source_type, source_record_id
             FROM learning_attempts
             GROUP BY source_type, source_record_id
             HAVING COUNT(*) > 1
           )`
        ).get().count
      ),
      deterministicIdMismatches: 0,
      attemptNumberMismatches: Number(
        db.prepare(
          `SELECT COUNT(*) AS count
           FROM (
             SELECT
               attempt_number,
               ROW_NUMBER() OVER (
                 PARTITION BY owner_key, source_type, lesson_id, game_id
                 ORDER BY activity_at ASC, source_record_id ASC
               ) AS expected_attempt_number
             FROM learning_attempts
           )
           WHERE attempt_number <> expected_attempt_number`
        ).get().count
      ),
    },
  };

  for (const [sourceType, definition] of Object.entries(SOURCE_DEFINITIONS)) {
    const existingSourceAttempts = new Map(
      db.prepare(
        `SELECT source_record_id, attempt_id
         FROM learning_attempts
         WHERE source_type = ?`
      ).all(sourceType).map(row => [
        String(row.source_record_id),
        String(row.attempt_id),
      ])
    );
    const summary = {
      candidates: 0,
      eligible: 0,
      covered: 0,
      missing: 0,
      deterministicIdMismatches: 0,
      legacyUnlinked: 0,
      skipped: {},
    };
    scanSourceRows(db, sourceType, {
      batchSize,
      onBatch({ rows }) {
        summary.candidates += rows.length;
        for (const row of rows) {
          const normalized = definition.normalizer(row);
          if (!normalized.attempt) {
            incrementReason(summary.skipped, normalized.reason || 'unknown');
            continue;
          }
          summary.eligible += 1;
          if (normalized.attempt.ownership_status === 'legacy_unlinked') {
            summary.legacyUnlinked += 1;
          }
          const sourceRecordId = String(row.id);
          if (existingSourceAttempts.has(sourceRecordId)) {
            const existingAttemptId = existingSourceAttempts.get(sourceRecordId);
            summary.covered += 1;
            if (existingAttemptId !== normalized.attempt.attempt_id) {
              summary.deterministicIdMismatches += 1;
              result.history.deterministicIdMismatches += 1;
            }
          } else {
            summary.missing += 1;
          }
        }
      },
    });
    result.source[sourceType] = summary;
  }
  return result;
}

export function validateIsoInstant(value, label = 'timestamp') {
  const parsed = normalizedIso(value);
  if (!parsed) throw new Error(`${label} must be a valid ISO date/time.`);
  return parsed;
}

export function assertPostMaintenanceIntegrity(db) {
  assertQuickCheck(db, 'database');
  const foreignKeyViolations = db.pragma('foreign_key_check');
  if (foreignKeyViolations.length) {
    throw new Error(
      `foreign_key_check failed with ${foreignKeyViolations.length} violation(s).`
    );
  }
}
