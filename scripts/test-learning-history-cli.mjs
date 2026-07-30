import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import {
  deterministicLearningAttemptId,
} from './learning-history-common.mjs';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.dirname(scriptDirectory);
const backfillScript = path.join(scriptDirectory, 'db-backfill-learning-history.mjs');
const retentionScript = path.join(scriptDirectory, 'activity-prune.mjs');
const temporaryRoot = fs.mkdtempSync(
  path.join(os.tmpdir(), 'learning-history-cli-')
);
const databasePath = path.join(temporaryRoot, 'app.sqlite');
const backfillBackupPath = path.join(temporaryRoot, 'app-before-backfill.sqlite');
const backupDirectory = path.join(temporaryRoot, 'retention-backups');

function runCli(script, args, { expectedStatus = 0 } = {}) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      SQLITE_DB_PATH: '',
      SQLITE_BACKUP_DIR: '',
    },
  });
  assert.equal(
    result.status,
    expectedStatus,
    [
      `${path.basename(script)} exited with ${result.status}.`,
      result.stdout,
      result.stderr,
    ].filter(Boolean).join('\n')
  );
  const output = String(result.stdout || '').trim();
  assert.ok(output, `${path.basename(script)} did not print a JSON report.`);
  return JSON.parse(output);
}

function createFixture() {
  const db = new Database(databasePath);
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE game_results (
      id TEXT PRIMARY KEY,
      assignment_id TEXT,
      user_id TEXT,
      guest_id TEXT,
      owner_key TEXT,
      game_id TEXT,
      vocab_set_id TEXT,
      score REAL,
      correct INTEGER,
      incorrect INTEGER,
      status TEXT,
      client_run_id TEXT,
      source_type TEXT,
      created_at TEXT,
      completed_at TEXT,
      data_json TEXT NOT NULL
    );

    CREATE TABLE grammar_attempts (
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

    CREATE TABLE leaderboard_events (
      id TEXT PRIMARY KEY,
      data_json TEXT NOT NULL
    );

    CREATE TABLE pronunciation_attempts (
      id TEXT PRIMARY KEY,
      data_json TEXT NOT NULL
    );

    CREATE TABLE learning_attempts (
      attempt_id TEXT PRIMARY KEY,
      source_record_id TEXT NOT NULL CHECK(length(trim(source_record_id)) > 0),
      client_run_id TEXT,
      source_type TEXT NOT NULL CHECK(source_type IN ('vocabulary', 'grammar')),
      student_type TEXT NOT NULL
        CHECK(student_type IN ('authenticated', 'guest', 'legacy')),
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
      attempt_status TEXT NOT NULL
        CHECK(attempt_status IN ('completed', 'in_progress', 'interrupted')),
      attempt_number INTEGER NOT NULL DEFAULT 1 CHECK(attempt_number >= 1),
      schema_version INTEGER NOT NULL DEFAULT 1 CHECK(schema_version >= 1),
      detail_status TEXT NOT NULL
        CHECK(detail_status IN ('available', 'missing', 'expired', 'legacy')),
      normalization_status TEXT NOT NULL
        CHECK(normalization_status IN ('canonical', 'legacy_partial')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      CHECK(owner_key IS NOT NULL OR ownership_status = 'legacy_unlinked')
    );

    CREATE TABLE attempt_details (
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

    CREATE UNIQUE INDEX idx_learning_attempts_source_record
      ON learning_attempts(source_type, source_record_id);
    CREATE UNIQUE INDEX idx_learning_attempts_client_run
      ON learning_attempts(owner_key, source_type, lesson_id, game_id, client_run_id)
      WHERE client_run_id IS NOT NULL AND owner_key IS NOT NULL;
  `);

  const insertVocabulary = db.prepare(`
    INSERT INTO game_results (
      id, assignment_id, user_id, guest_id, owner_key, game_id, vocab_set_id,
      score, correct, incorrect, status, client_run_id, source_type,
      created_at, completed_at, data_json
    ) VALUES (
      @id, @assignment_id, @user_id, @guest_id, @owner_key, @game_id,
      @vocab_set_id, @score, @correct, @incorrect, @status, @client_run_id,
      @source_type, @created_at, @completed_at, @data_json
    )
  `);
  const vocabularyBase = {
    assignment_id: null,
    user_id: null,
    guest_id: null,
    owner_key: null,
    game_id: 'multiple-choice',
    vocab_set_id: 'vocab-set-1',
    score: 75,
    correct: 3,
    incorrect: 1,
    status: 'completed',
    client_run_id: null,
    source_type: 'game_session',
    created_at: '2026-01-01T01:00:00.000Z',
    completed_at: '2026-01-01T01:05:00.000Z',
  };
  insertVocabulary.run({
    ...vocabularyBase,
    id: 'vocabulary-auth-1',
    assignment_id: 'assignment-1',
    user_id: 'user-1',
    guest_id: 'guest-before-login',
    owner_key: 'user:user-1',
    client_run_id: 'run-vocabulary-auth-1',
    data_json: JSON.stringify({
      id: 'vocabulary-auth-1',
      userId: 'user-1',
      guestId: 'guest-before-login',
      ownerType: 'user',
      ownerKey: 'user:user-1',
      gameId: 'multiple-choice',
      vocabSetId: 'vocab-set-1',
      vocabSetTitle: 'Starter words',
      correctAnswers: 3,
      incorrectAnswers: 1,
      totalQuestions: 4,
      score: 75,
      startedAt: vocabularyBase.created_at,
      completedAt: vocabularyBase.completed_at,
      assignmentId: 'assignment-1',
      assignmentTitle: 'Week one',
      clientRunId: 'run-vocabulary-auth-1',
    }),
  });
  insertVocabulary.run({
    ...vocabularyBase,
    id: 'vocabulary-auth-2',
    assignment_id: 'assignment-1',
    user_id: 'user-1',
    owner_key: 'user:user-1',
    client_run_id: 'run-vocabulary-auth-2',
    created_at: '2026-01-03T01:00:00.000Z',
    completed_at: '2026-01-03T01:05:00.000Z',
    data_json: JSON.stringify({
      id: 'vocabulary-auth-2',
      userId: 'user-1',
      ownerType: 'user',
      ownerKey: 'user:user-1',
      gameId: 'multiple-choice',
      vocabSetId: 'vocab-set-1',
      vocabSetTitle: 'Starter words',
      correctAnswers: 4,
      incorrectAnswers: 0,
      totalQuestions: 4,
      score: 100,
      startedAt: '2026-01-03T01:00:00.000Z',
      completedAt: '2026-01-03T01:05:00.000Z',
      assignmentId: 'assignment-1',
      assignmentTitle: 'Week one',
      clientRunId: 'run-vocabulary-auth-2',
    }),
  });
  insertVocabulary.run({
    ...vocabularyBase,
    id: 'vocabulary-legacy-1',
    game_id: 'memory-match',
    client_run_id: 'run-vocabulary-legacy-1',
    data_json: JSON.stringify({
      id: 'vocabulary-legacy-1',
      gameId: 'memory-match',
      vocabSetId: 'vocab-set-1',
      correctAnswers: 2,
      incorrectAnswers: 3,
      privateSnapshot: {
        items: [{ id: '1' }, { id: '2' }, { id: '3' }],
      },
      completedAt: vocabularyBase.completed_at,
      clientRunId: 'run-vocabulary-legacy-1',
    }),
  });
  insertVocabulary.run({
    ...vocabularyBase,
    id: 'pronunciation-event-1',
    source_type: 'pronunciation',
    data_json: JSON.stringify({
      id: 'pronunciation-event-1',
      gameId: 'speaking-ai',
      vocabSetId: 'vocab-set-1',
      gameSessionId: 'speaking-session-1',
      wordId: 'word-1',
    }),
  });
  insertVocabulary.run({
    ...vocabularyBase,
    id: 'vocabulary-malformed-1',
    data_json: '{',
  });
  insertVocabulary.run({
    ...vocabularyBase,
    id: 'vocabulary-in-progress-1',
    status: 'in_progress',
    completed_at: null,
    data_json: JSON.stringify({
      id: 'vocabulary-in-progress-1',
      gameId: 'multiple-choice',
      vocabSetId: 'vocab-set-1',
    }),
  });

  const insertGrammar = db.prepare(`
    INSERT INTO grammar_attempts (
      id, grammar_set_id, user_id, guest_id, status, created_at,
      completed_at, updated_at, data_json
    ) VALUES (
      @id, @grammar_set_id, @user_id, @guest_id, @status, @created_at,
      @completed_at, @updated_at, @data_json
    )
  `);
  const grammarBase = {
    grammar_set_id: 'grammar-set-1',
    user_id: null,
    guest_id: 'guest-1',
    status: 'completed',
    created_at: '2026-01-02T02:00:00.000Z',
    completed_at: '2026-01-02T02:04:00.000Z',
    updated_at: '2026-01-02T02:04:00.000Z',
  };
  insertGrammar.run({
    ...grammarBase,
    id: 'grammar-guest-1',
    data_json: JSON.stringify({
      id: 'grammar-guest-1',
      grammarSetId: 'grammar-set-1',
      grammarSetTitle: 'Present simple',
      guestId: 'guest-1',
      assignmentId: 'forged-unverified-assignment',
      assignmentTitle: 'Must not be trusted',
      correctCount: 2,
      wrongCount: 1,
      totalQuestions: 3,
      score: 2,
      maxScore: 3,
      completedAt: grammarBase.completed_at,
    }),
  });
  insertGrammar.run({
    ...grammarBase,
    id: 'grammar-unsupported-1',
    grammar_set_id: null,
    data_json: JSON.stringify({
      id: 'grammar-unsupported-1',
      guestId: 'guest-1',
      completedAt: grammarBase.completed_at,
    }),
  });

  db.prepare(
    'INSERT INTO leaderboard_events (id, data_json) VALUES (?, ?)'
  ).run('leaderboard-1', '{"score":75}');
  db.prepare(
    'INSERT INTO pronunciation_attempts (id, data_json) VALUES (?, ?)'
  ).run('pronunciation-source-1', '{"score":88}');
  db.close();
}

function sourceSnapshot(db) {
  return JSON.stringify({
    gameResults: db.prepare(
      'SELECT * FROM game_results ORDER BY id'
    ).all(),
    grammarAttempts: db.prepare(
      'SELECT * FROM grammar_attempts ORDER BY id'
    ).all(),
    leaderboardEvents: db.prepare(
      'SELECT * FROM leaderboard_events ORDER BY id'
    ).all(),
    pronunciationAttempts: db.prepare(
      'SELECT * FROM pronunciation_attempts ORDER BY id'
    ).all(),
  });
}

function exactAttemptId(sourceType, sourceRecordId) {
  const digest = crypto.createHash('sha256')
    .update(`learning-attempt-v1:${sourceType}:${sourceRecordId}`)
    .digest('hex');
  return `attempt-${digest.slice(0, 40)}`;
}

function insertProtectedRetentionFixture(db) {
  const template = db.prepare(
    `SELECT * FROM learning_attempts
     WHERE source_type = 'grammar'
     LIMIT 1`
  ).get();
  const protectedAttempt = {
    ...template,
    attempt_id: 'attempt-protected-in-progress',
    source_record_id: 'protected-in-progress',
    client_run_id: null,
    user_id: null,
    guest_id: 'guest-protected',
    owner_key: 'guest:guest-protected',
    attempt_status: 'in_progress',
    detail_status: 'available',
    completed_at: null,
  };
  const columns = Object.keys(protectedAttempt);
  db.prepare(
    `INSERT INTO learning_attempts (${columns.join(', ')})
     VALUES (${columns.map(() => '?').join(', ')})`
  ).run(...columns.map(column => protectedAttempt[column]));

  const insertDetail = db.prepare(`
    INSERT INTO attempt_details (
      attempt_id, client_run_id, source_type, answer_details_json,
      question_snapshots_json, option_snapshots_json, extra_details_json,
      review_policy_json, created_at, updated_at, expires_at, schema_version
    ) VALUES (?, NULL, ?, '[]', '[]', '[]', '{}', '{}', ?, ?, ?, 1)
  `);
  const vocabularyId = deterministicLearningAttemptId(
    'vocabulary',
    'vocabulary-auth-1'
  );
  const grammarId = deterministicLearningAttemptId('grammar', 'grammar-guest-1');
  insertDetail.run(
    vocabularyId,
    'vocabulary',
    '2025-01-01T00:00:00.000Z',
    '2025-01-01T00:00:00.000Z',
    '2025-12-31T23:59:59.000Z'
  );
  insertDetail.run(
    grammarId,
    'grammar',
    '2026-01-02T02:04:00.000Z',
    '2026-01-02T02:04:00.000Z',
    '2027-01-01T00:00:00.000Z'
  );
  insertDetail.run(
    protectedAttempt.attempt_id,
    'grammar',
    '2025-01-01T00:00:00.000Z',
    '2025-01-01T00:00:00.000Z',
    '2025-12-31T23:59:59.000Z'
  );
  db.prepare(
    `UPDATE learning_attempts
     SET detail_status = 'available'
     WHERE attempt_id IN (?, ?)`
  ).run(vocabularyId, grammarId);
  return {
    expiredAttemptId: vocabularyId,
    futureAttemptId: grammarId,
    protectedAttemptId: protectedAttempt.attempt_id,
  };
}

try {
  createFixture();

  assert.equal(
    deterministicLearningAttemptId('Vocabulary', ' source-row '),
    exactAttemptId('Vocabulary', ' source-row '),
    'CLI deterministic ID must exactly match the runtime projector formula.'
  );
  assert.match(
    deterministicLearningAttemptId('grammar', 'grammar-guest-1'),
    /^attempt-[0-9a-f]{40}$/
  );

  let db = new Database(databasePath, { fileMustExist: true });
  const sourceBeforeBackfill = sourceSnapshot(db);
  db.close();

  const dryRun = runCli(backfillScript, [
    '--db',
    databasePath,
    '--batch-size',
    '2',
  ]);
  assert.equal(dryRun.ok, true);
  assert.equal(dryRun.mode, 'dry-run');
  assert.equal(dryRun.plannedInserts, 4);
  assert.equal(dryRun.sourceMutation, 'none');
  assert.equal(dryRun.reconciliation.source.vocabulary.eligible, 3);
  assert.equal(dryRun.reconciliation.source.grammar.eligible, 1);
  assert.equal(dryRun.reconciliation.source.vocabulary.skipped.pronunciation_event, 1);
  assert.equal(dryRun.reconciliation.source.vocabulary.skipped.malformed_json, 1);
  assert.equal(dryRun.reconciliation.source.grammar.skipped.unsupported_shape, 1);

  db = new Database(databasePath, { fileMustExist: true });
  assert.equal(
    db.prepare('SELECT COUNT(*) AS count FROM learning_attempts').get().count,
    0,
    'Backfill dry-run must not write projection rows.'
  );
  assert.equal(sourceSnapshot(db), sourceBeforeBackfill);
  db.close();

  const rejectedExecute = runCli(backfillScript, [
    '--db',
    databasePath,
    '--execute',
  ], { expectedStatus: 1 });
  assert.equal(rejectedExecute.ok, false);
  assert.match(rejectedExecute.error, /requires --verified-backup/i);
  db = new Database(databasePath, { fileMustExist: true });
  assert.equal(
    db.prepare('SELECT COUNT(*) AS count FROM learning_attempts').get().count,
    0,
    'Backfill must fail before writing when verified backup evidence is absent.'
  );
  await db.backup(backfillBackupPath);
  db.close();

  const execute = runCli(backfillScript, [
    '--db',
    databasePath,
    '--verified-backup',
    backfillBackupPath,
    '--execute',
    '--batch-size',
    '2',
  ]);
  assert.equal(execute.ok, true);
  assert.equal(execute.mode, 'execute');
  assert.equal(execute.reconciliation.missingAfter, 0);
  assert.equal(execute.reconciliation.after.history.duplicateSourceGroups, 0);
  assert.equal(execute.writes.vocabulary.inserted, 3);
  assert.equal(execute.writes.grammar.inserted, 1);
  assert.equal(execute.attemptNumbersUpdated, 1);
  assert.equal(execute.sourceMutation, 'none');

  db = new Database(databasePath, { fileMustExist: true });
  assert.equal(sourceSnapshot(db), sourceBeforeBackfill);
  assert.equal(
    db.prepare('SELECT COUNT(*) AS count FROM learning_attempts').get().count,
    4
  );
  for (const [sourceType, sourceRecordId] of [
    ['vocabulary', 'vocabulary-auth-1'],
    ['vocabulary', 'vocabulary-auth-2'],
    ['vocabulary', 'vocabulary-legacy-1'],
    ['grammar', 'grammar-guest-1'],
  ]) {
    const projected = db.prepare(
      `SELECT attempt_id
       FROM learning_attempts
       WHERE source_type = ? AND source_record_id = ?`
    ).get(sourceType, sourceRecordId);
    assert.equal(
      projected.attempt_id,
      exactAttemptId(sourceType, sourceRecordId)
    );
  }
  assert.deepEqual(
    db.prepare(
      `SELECT student_type, owner_key, ownership_status
       FROM learning_attempts
       WHERE source_record_id = 'vocabulary-legacy-1'`
    ).get(),
    {
      student_type: 'legacy',
      owner_key: null,
      ownership_status: 'legacy_unlinked',
    }
  );
  assert.deepEqual(
    db.prepare(
      `SELECT source_record_id, attempt_number
       FROM learning_attempts
       WHERE owner_key = 'user:user-1'
         AND source_type = 'vocabulary'
         AND lesson_id = 'vocab-set-1'
         AND game_id = 'multiple-choice'
       ORDER BY attempt_number`
    ).all(),
    [
      { source_record_id: 'vocabulary-auth-1', attempt_number: 1 },
      { source_record_id: 'vocabulary-auth-2', attempt_number: 2 },
    ]
  );
  assert.deepEqual(
    db.prepare(
      `SELECT assignment_id, assignment_title_snapshot, normalization_status
       FROM learning_attempts
       WHERE source_record_id = 'grammar-guest-1'`
    ).get(),
    {
      assignment_id: null,
      assignment_title_snapshot: null,
      normalization_status: 'canonical',
    },
    'Grammar assignment fields require explicit server-side verification evidence.'
  );
  assert.deepEqual(
    db.prepare(
      `SELECT assignment_id, assignment_title_snapshot, normalization_status
       FROM learning_attempts
       WHERE source_record_id = 'vocabulary-auth-1'`
    ).get(),
    {
      assignment_id: 'assignment-1',
      assignment_title_snapshot: 'Week one',
      normalization_status: 'canonical',
    },
    'The normalized vocabulary assignment column is trusted as server-verified.'
  );
  assert.deepEqual(
    db.prepare(
      `SELECT student_type, user_id, guest_id, owner_key
       FROM learning_attempts
       WHERE source_record_id = 'vocabulary-auth-1'`
    ).get(),
    {
      student_type: 'authenticated',
      user_id: 'user-1',
      guest_id: null,
      owner_key: 'user:user-1',
    },
    'A legacy guest id must not override an explicit authenticated owner.'
  );
  assert.equal(db.pragma('quick_check', { simple: true }), 'ok');

  const removedForResume = deterministicLearningAttemptId(
    'vocabulary',
    'vocabulary-auth-2'
  );
  db.prepare(
    'UPDATE learning_attempts SET attempt_id = ? WHERE attempt_id = ?'
  ).run('attempt-intentionally-wrong', removedForResume);
  db.close();

  const identityMismatch = runCli(backfillScript, [
    '--db',
    databasePath,
    '--dry-run',
  ], { expectedStatus: 2 });
  assert.equal(identityMismatch.ok, false);
  assert.equal(
    identityMismatch.reconciliation.history.deterministicIdMismatches,
    1
  );
  const rejectedIdentityMismatchExecute = runCli(backfillScript, [
    '--db',
    databasePath,
    '--verified-backup',
    backfillBackupPath,
    '--execute',
  ], { expectedStatus: 1 });
  assert.equal(rejectedIdentityMismatchExecute.ok, false);
  assert.match(
    rejectedIdentityMismatchExecute.error,
    /no backfill writes were started/i
  );

  db = new Database(databasePath, { fileMustExist: true });
  assert.equal(
    db.prepare(
      `SELECT COUNT(*) AS count
       FROM learning_attempts
       WHERE attempt_id = 'attempt-intentionally-wrong'`
    ).get().count,
    1
  );
  db.prepare(
    'UPDATE learning_attempts SET attempt_id = ? WHERE attempt_id = ?'
  ).run(removedForResume, 'attempt-intentionally-wrong');
  db.prepare('DELETE FROM learning_attempts WHERE attempt_id = ?')
    .run(removedForResume);
  db.close();

  const resume = runCli(backfillScript, [
    '--db',
    databasePath,
    '--verified-backup',
    backfillBackupPath,
    '--resume',
    '--batch-size',
    '1',
  ]);
  assert.equal(resume.ok, true);
  assert.equal(resume.mode, 'resume');
  assert.equal(resume.writes.vocabulary.inserted, 1);
  assert.equal(resume.writes.grammar.inserted, 0);
  assert.equal(resume.attemptNumbersUpdated, 1);
  assert.equal(resume.reconciliation.missingAfter, 0);

  db = new Database(databasePath, { fileMustExist: true });
  assert.deepEqual(
    db.prepare(
      `SELECT source_record_id, attempt_number
       FROM learning_attempts
       WHERE owner_key = 'user:user-1'
         AND source_type = 'vocabulary'
         AND lesson_id = 'vocab-set-1'
         AND game_id = 'multiple-choice'
       ORDER BY attempt_number`
    ).all(),
    [
      { source_record_id: 'vocabulary-auth-1', attempt_number: 1 },
      { source_record_id: 'vocabulary-auth-2', attempt_number: 2 },
    ],
    'Resume must restore the same deterministic attempt ordinals.'
  );
  assert.equal(sourceSnapshot(db), sourceBeforeBackfill);
  const retentionIds = insertProtectedRetentionFixture(db);
  const retentionSourceSnapshot = sourceSnapshot(db);
  const historyCountBeforeRetention = db.prepare(
    'SELECT COUNT(*) AS count FROM learning_attempts'
  ).get().count;
  const pageCountBeforeRetention = db.pragma('page_count', { simple: true });
  db.close();

  const retentionDryRun = runCli(retentionScript, [
    '--db',
    databasePath,
    '--dry-run',
    '--as-of',
    '2026-01-01T00:00:00.000Z',
    '--backup-dir',
    backupDirectory,
  ]);
  assert.equal(retentionDryRun.ok, true);
  assert.equal(retentionDryRun.mode, 'dry-run');
  assert.equal(retentionDryRun.retention.eligible, 1);
  assert.equal(retentionDryRun.retention.protectedInProgress, 1);
  assert.equal(retentionDryRun.deletedDetails, 0);
  assert.equal(
    retentionDryRun.protectedRowCounts.snapshot.pronunciation_attempts,
    1
  );
  assert.equal(retentionDryRun.vacuum, false);
  assert.equal(fs.existsSync(backupDirectory), false);

  const rejectedResume = runCli(retentionScript, [
    '--db',
    databasePath,
    '--resume',
  ], { expectedStatus: 1 });
  assert.equal(rejectedResume.ok, false);
  assert.match(rejectedResume.error, /does not support --resume/i);

  const retentionExecute = runCli(retentionScript, [
    '--db',
    databasePath,
    '--execute',
    '--as-of',
    '2026-01-01T00:00:00.000Z',
    '--backup-dir',
    backupDirectory,
  ]);
  assert.equal(retentionExecute.ok, true);
  assert.equal(retentionExecute.mode, 'execute');
  assert.equal(retentionExecute.selectedDetails, 1);
  assert.equal(retentionExecute.deletedDetails, 1);
  assert.equal(retentionExecute.updatedSummaries, 1);
  assert.equal(retentionExecute.summaryDeletion, 0);
  assert.equal(retentionExecute.sourceDeletion, 0);
  assert.equal(retentionExecute.leaderboardDeletion, 0);
  assert.equal(retentionExecute.protectedRowCounts.unchanged, true);
  assert.equal(retentionExecute.transactionProtectedRowCounts.unchanged, true);
  assert.deepEqual(
    retentionExecute.protectedRowCounts.before,
    retentionExecute.protectedRowCounts.after
  );
  assert.deepEqual(
    retentionExecute.protectedRowCounts.deltas,
    {
      learning_attempts: 0,
      game_results: 0,
      grammar_attempts: 0,
      pronunciation_attempts: 0,
      leaderboard_events: 0,
    }
  );
  assert.deepEqual(
    retentionExecute.transactionProtectedRowCounts.deltas,
    retentionExecute.protectedRowCounts.deltas
  );
  assert.deepEqual(
    retentionExecute.sourceDeletionByTable,
    {
      game_results: 0,
      grammar_attempts: 0,
      pronunciation_attempts: 0,
    }
  );
  assert.equal(retentionExecute.vacuum, false);

  const backups = fs.readdirSync(backupDirectory)
    .filter(name => name.endsWith('.sqlite'));
  assert.equal(backups.length, 1);
  const backup = new Database(path.join(backupDirectory, backups[0]), {
    fileMustExist: true,
    readonly: true,
  });
  assert.equal(backup.pragma('quick_check', { simple: true }), 'ok');
  assert.equal(
    backup.prepare(
      'SELECT COUNT(*) AS count FROM attempt_details WHERE attempt_id = ?'
    ).get(retentionIds.expiredAttemptId).count,
    1,
    'Verified backup must contain the detail that execute prunes.'
  );
  backup.close();

  db = new Database(databasePath, { fileMustExist: true });
  assert.equal(db.pragma('quick_check', { simple: true }), 'ok');
  assert.equal(db.pragma('foreign_key_check').length, 0);
  assert.equal(sourceSnapshot(db), retentionSourceSnapshot);
  assert.equal(
    db.prepare('SELECT COUNT(*) AS count FROM learning_attempts').get().count,
    historyCountBeforeRetention
  );
  assert.equal(
    db.prepare(
      'SELECT COUNT(*) AS count FROM attempt_details WHERE attempt_id = ?'
    ).get(retentionIds.expiredAttemptId).count,
    0
  );
  assert.equal(
    db.prepare(
      'SELECT detail_status FROM learning_attempts WHERE attempt_id = ?'
    ).get(retentionIds.expiredAttemptId).detail_status,
    'expired'
  );
  assert.equal(
    db.prepare(
      'SELECT COUNT(*) AS count FROM attempt_details WHERE attempt_id = ?'
    ).get(retentionIds.futureAttemptId).count,
    1
  );
  assert.equal(
    db.prepare(
      'SELECT COUNT(*) AS count FROM attempt_details WHERE attempt_id = ?'
    ).get(retentionIds.protectedAttemptId).count,
    1
  );
  assert.equal(
    db.pragma('page_count', { simple: true }),
    pageCountBeforeRetention,
    'Retention must not VACUUM or otherwise rebuild the database.'
  );
  db.close();

  process.stdout.write(`${JSON.stringify({
    ok: true,
    deterministicId: 'projector-compatible',
    backfill: {
      dryRun: 'read-only',
      verifiedBackupQuickCheck: execute.backupQuickCheck,
      execute: execute.reconciliation.after.history,
      resumeInserted: resume.writes.vocabulary.inserted,
      sourceMutation: 'none',
    },
    retention: {
      backupQuickCheck: 'ok',
      deletedDetails: retentionExecute.deletedDetails,
      summaryDeletion: retentionExecute.summaryDeletion,
      sourceDeletion: retentionExecute.sourceDeletion,
      leaderboardDeletion: retentionExecute.leaderboardDeletion,
      protectedCountsUnchanged: retentionExecute.protectedRowCounts.unchanged,
      vacuum: retentionExecute.vacuum,
    },
    finalQuickCheck: 'ok',
  }, null, 2)}\n`);
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}
