import {
  sqliteQueryAll,
  sqliteQueryOne,
} from '../../lib/sqliteStorage';
import type {
  ListeningAnswers,
  ListeningGradeResult,
  ListeningSetContent,
} from '../../features/listening/types';
import { buildListeningActivityAnswerDetails } from '../listening/listeningActivity';
import type {
  LearningHistoryAssignmentGroup,
  LearningHistoryFilterOption,
  LearningHistoryFilters,
  LearningHistoryItem,
  LearningHistoryListResponse,
  LearningHistorySummary,
} from './learningHistoryTypes';

interface LearningHistoryRecord {
  item: LearningHistoryItem;
  ownerKey: string | null;
  sourceRecordId: string;
  storedDetailStatus: string;
}

const EFFECTIVE_ATTEMPT_STATUS_SQL = `CASE
  WHEN attempt_status = 'in_progress'
   AND datetime(activity_at) < datetime('now', '-24 hours')
  THEN 'interrupted'
  ELSE attempt_status
END`;

function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mapItem(row: Record<string, any>): LearningHistoryItem {
  return {
    attemptId: String(row.attempt_id || ''),
    sourceType: row.source_type === 'grammar'
      ? 'grammar'
      : row.source_type === 'listening'
        ? 'listening'
        : 'vocabulary',
    studentType: String(row.student_type || ''),
    studentName: String(row.student_name_snapshot || ''),
    classId: row.class_id || null,
    className: String(row.class_name_snapshot || ''),
    assignmentId: row.assignment_id || null,
    assignmentTitle: String(row.assignment_title_snapshot || ''),
    assignmentDueAt: row.assignment_due_at_snapshot || null,
    lessonId: String(row.lesson_id || ''),
    lessonTitle: String(row.lesson_title_snapshot || ''),
    lessonType: String(row.lesson_type || ''),
    gameId: String(row.game_id || ''),
    gameTitle: String(row.game_title_snapshot || ''),
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
    activityAt: String(row.activity_at || ''),
    durationSeconds: number(row.duration_seconds),
    status: row.attempt_status === 'completed'
      ? 'completed'
      : row.attempt_status === 'interrupted'
        ? 'interrupted'
        : 'in_progress',
    attemptNumber: Math.max(1, number(row.attempt_number)),
    detailStatus: ['available', 'missing', 'expired', 'legacy'].includes(row.detail_status)
      ? row.detail_status
      : 'missing',
    normalizationStatus: String(row.normalization_status || 'legacy_partial'),
  };
}

const ITEM_COLUMNS = `
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

const HISTORY_ATTEMPTS_CTE = `
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
)`;

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, match => `\\${match}`);
}

function buildWhere(ownerKey: string, filters: LearningHistoryFilters) {
  const clauses = ['owner_key = ?'];
  const params: unknown[] = [ownerKey];
  const add = (sql: string, value: unknown) => {
    clauses.push(sql);
    params.push(value);
  };

  if (filters.sourceType) add('source_type = ?', filters.sourceType);
  if (filters.historyType === 'assignment') clauses.push('assignment_id IS NOT NULL');
  if (filters.historyType === 'practice') clauses.push('assignment_id IS NULL');
  if (filters.status === 'interrupted') {
    clauses.push(`(${EFFECTIVE_ATTEMPT_STATUS_SQL}) = 'interrupted'`);
  } else if (filters.status === 'in_progress') {
    clauses.push(`(${EFFECTIVE_ATTEMPT_STATUS_SQL}) = 'in_progress'`);
  } else if (filters.status === 'completed') {
    clauses.push("attempt_status = 'completed'");
  }
  if (filters.classId) add('class_id = ?', filters.classId);
  if (filters.lessonId) add('lesson_id = ?', filters.lessonId);
  if (filters.assignmentId) add('assignment_id = ?', filters.assignmentId);
  if (filters.gameId) add('game_id = ?', filters.gameId);
  if (filters.scoreFrom !== undefined) add('score >= ?', filters.scoreFrom);
  if (filters.scoreTo !== undefined) add('score <= ?', filters.scoreTo);
  if (filters.from) add('activity_at >= ?', filters.from);
  if (filters.toExclusive) add('activity_at < ?', filters.toExclusive);
  if (filters.search) {
    clauses.push(`(
      LOWER(COALESCE(lesson_title_snapshot, '')) LIKE ? ESCAPE '\\'
      OR LOWER(COALESCE(game_title_snapshot, '')) LIKE ? ESCAPE '\\'
      OR LOWER(COALESCE(assignment_title_snapshot, '')) LIKE ? ESCAPE '\\'
    )`);
    const search = `%${escapeLike(filters.search.toLocaleLowerCase('vi'))}%`;
    params.push(search, search, search);
  }

  return {
    sql: clauses.join(' AND '),
    params,
  };
}

function mapSummary(row: Record<string, any> | undefined): LearningHistorySummary {
  return {
    totalAttempts: number(row?.total_attempts),
    completedAttempts: number(row?.completed_attempts),
    averageScore: Math.round(number(row?.average_score) * 100) / 100,
    bestScore: number(row?.best_score),
    totalCorrect: number(row?.total_correct),
    totalIncorrect: number(row?.total_incorrect),
    totalUnanswered: number(row?.total_unanswered),
    totalDurationSeconds: number(row?.total_duration_seconds),
    studyDays: number(row?.study_days),
  };
}

async function filterOptions(ownerKey: string) {
  const queries: Array<Promise<Array<{ id: string; label: string }>>> = [
    sqliteQueryAll(
      `WITH ${HISTORY_ATTEMPTS_CTE}
       SELECT DISTINCT class_id AS id, COALESCE(NULLIF(class_name_snapshot, ''), class_id) AS label
       FROM history_attempts
       WHERE owner_key = ? AND class_id IS NOT NULL AND class_id <> ''
       ORDER BY label COLLATE NOCASE, id`,
      [ownerKey],
    ),
    sqliteQueryAll(
      `WITH ${HISTORY_ATTEMPTS_CTE}
       SELECT DISTINCT lesson_id AS id, COALESCE(NULLIF(lesson_title_snapshot, ''), lesson_id) AS label
       FROM history_attempts
       WHERE owner_key = ? AND lesson_id <> ''
       ORDER BY label COLLATE NOCASE, id`,
      [ownerKey],
    ),
    sqliteQueryAll(
      `WITH ${HISTORY_ATTEMPTS_CTE}
       SELECT DISTINCT assignment_id AS id,
              COALESCE(NULLIF(assignment_title_snapshot, ''), assignment_id) AS label
       FROM history_attempts
       WHERE owner_key = ? AND assignment_id IS NOT NULL AND assignment_id <> ''
       ORDER BY label COLLATE NOCASE, id`,
      [ownerKey],
    ),
    sqliteQueryAll(
      `WITH ${HISTORY_ATTEMPTS_CTE}
       SELECT DISTINCT game_id AS id, COALESCE(NULLIF(game_title_snapshot, ''), game_id) AS label
       FROM history_attempts
       WHERE owner_key = ? AND game_id <> ''
       ORDER BY label COLLATE NOCASE, id`,
      [ownerKey],
    ),
  ];
  const [classes, lessons, assignments, games] = await Promise.all(queries);
  const clean = (items: Array<{ id: string; label: string }>): LearningHistoryFilterOption[] => (
    items
      .filter(item => item.id)
      .map(item => ({ id: String(item.id), label: String(item.label || item.id) }))
  );
  return {
    classes: clean(classes),
    lessons: clean(lessons),
    assignments: clean(assignments),
    games: clean(games),
  };
}

async function assignmentGroups(
  whereSql: string,
  params: unknown[],
): Promise<LearningHistoryAssignmentGroup[]> {
  const rows = await sqliteQueryAll<Record<string, any>>(
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
    params,
  );
  return rows.map(row => ({
    assignmentId: String(row.assignment_id),
    assignmentTitle: String(row.assignment_title || row.assignment_id),
    classId: row.class_id || null,
    className: String(row.class_name || ''),
    dueAt: row.due_at || null,
    attempts: number(row.attempts),
    latestScore: number(row.latest_score),
    bestScore: number(row.best_score),
    averageScore: Math.round(number(row.average_score) * 100) / 100,
  }));
}

export async function listLearningHistory(
  ownerKey: string,
  filters: LearningHistoryFilters,
): Promise<LearningHistoryListResponse> {
  const where = buildWhere(ownerKey, filters);
  const offset = (filters.page - 1) * filters.pageSize;
  const [countRow, summaryRow, itemRows, options, groups] = await Promise.all([
    sqliteQueryOne<{ count: number }>(
      `WITH ${HISTORY_ATTEMPTS_CTE}
       SELECT COUNT(*) AS count FROM history_attempts WHERE ${where.sql}`,
      where.params,
    ),
    sqliteQueryOne<Record<string, any>>(
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
      where.params,
    ),
    sqliteQueryAll<Record<string, any>>(
      `WITH ${HISTORY_ATTEMPTS_CTE}
       SELECT ${ITEM_COLUMNS}
       FROM history_attempts
       WHERE ${where.sql}
       ORDER BY activity_at DESC, attempt_id DESC
       LIMIT ? OFFSET ?`,
      [...where.params, filters.pageSize, offset],
    ),
    filterOptions(ownerKey),
    filters.groupByAssignment ? assignmentGroups(where.sql, where.params) : Promise.resolve(undefined),
  ]);

  const totalItems = number(countRow?.count);
  return {
    items: itemRows.map(mapItem),
    summary: mapSummary(summaryRow),
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      totalItems,
      totalPages: totalItems ? Math.ceil(totalItems / filters.pageSize) : 0,
    },
    filterOptions: options,
    ...(groups ? { assignmentGroups: groups } : {}),
  };
}

export async function findLearningAttempt(attemptId: string): Promise<LearningHistoryRecord | null> {
  const row = await sqliteQueryOne<Record<string, any>>(
    `WITH ${HISTORY_ATTEMPTS_CTE}
     SELECT ${ITEM_COLUMNS}
     FROM history_attempts
     WHERE attempt_id = ?`,
    [attemptId],
  );
  if (!row) return null;
  return {
    item: mapItem(row),
    ownerKey: row.owner_key || null,
    sourceRecordId: String(row.source_record_id || ''),
    storedDetailStatus: String(row.detail_status || 'missing'),
  };
}

export async function findAttemptDetail(attemptId: string) {
  return sqliteQueryOne<Record<string, unknown>>(
    `SELECT attempt_id, client_run_id, source_type, answer_details_json,
            question_snapshots_json, option_snapshots_json, extra_details_json,
            review_policy_json, created_at, updated_at, expires_at, schema_version
     FROM attempt_details
     WHERE attempt_id = ?`,
    [attemptId],
  ).then(async row => {
    if (row) return row;
    const listeningRow = await sqliteQueryOne<Record<string, any>>(
      `SELECT detail.attempt_id, detail.data_json, detail.created_at, detail.updated_at,
              attempt.version_id, version.data_json AS version_data_json
       FROM listening_attempt_details AS detail
       JOIN listening_attempts AS attempt ON attempt.id = detail.attempt_id
       LEFT JOIN listening_set_versions AS version ON version.id = attempt.version_id
       WHERE detail.attempt_id = ?`,
      [attemptId],
    );
    if (!listeningRow) return undefined;
    let data: Record<string, any> = {};
    try {
      data = JSON.parse(String(listeningRow.data_json || '{}'));
    } catch {
      data = {};
    }
    try {
      const version = JSON.parse(String(listeningRow.version_data_json || '{}'));
      if (version?.content && data?.answers && Array.isArray(data?.questions)) {
        const answerDetails = buildListeningActivityAnswerDetails(
          version.content as ListeningSetContent,
          data.answers as ListeningAnswers,
          data.questions as ListeningGradeResult['questions'],
        );
        data = {
          ...data,
          answerDetails,
          questionSnapshots: answerDetails.map(item => ({
            questionId: item.questionId,
            questionText: item.questionText,
            part: item.part,
          })),
        };
      }
    } catch {
      // Keep the stored bounded detail if a legacy immutable version is malformed.
    }
    const reviewPolicy = {
      ...(data.reviewPolicy && typeof data.reviewPolicy === 'object' ? data.reviewPolicy : {}),
      showReviewAfterSubmit: true,
      showExplanationImmediately: false,
      policyVersion: Math.max(2, Number(data.reviewPolicy?.policyVersion || 0)),
    };
    return {
      attempt_id: attemptId,
      client_run_id: null,
      source_type: 'listening',
      answer_details_json: JSON.stringify(data.answerDetails || []),
      question_snapshots_json: JSON.stringify(data.questionSnapshots || []),
      option_snapshots_json: JSON.stringify(data.optionSnapshots || []),
      extra_details_json: JSON.stringify(data.extraDetails || {}),
      review_policy_json: JSON.stringify(reviewPolicy),
      created_at: listeningRow.created_at,
      updated_at: listeningRow.updated_at,
      expires_at: null,
      schema_version: 1,
    };
  },
  );
}

export async function findLegacySource(
  sourceType: string,
  sourceRecordId: string,
): Promise<Record<string, any> | null> {
  if (sourceType === 'listening') return null;
  const table = sourceType === 'grammar' ? 'grammar_attempts' : 'game_results';
  const row = await sqliteQueryOne<{ data_json?: string }>(
    `SELECT data_json FROM ${table} WHERE id = ?`,
    [sourceRecordId],
  );
  if (!row?.data_json) return null;
  try {
    const parsed = JSON.parse(row.data_json);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export async function findGuestHistoryCapability(guestId: string) {
  return sqliteQueryOne<{
    id: string;
    status: string | null;
    access_token_hash: string | null;
    access_token_version: number | null;
  }>(
    `SELECT id, status, access_token_hash, access_token_version
     FROM guest_profiles
     WHERE id = ?`,
    [guestId],
  );
}
