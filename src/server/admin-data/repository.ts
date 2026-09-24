import { isArchivedRecord } from "../resourceLifecycle.js";
import { sqliteQueryAll, sqliteQueryOne } from "../../lib/sqliteStorage.js";
import type {
  AdminActor,
  AdminDashboardCounts,
  AdminGrammarSetSummary,
  AdminPage,
  AdminPageRequest,
  AdminVocabSetSummary,
} from "./contracts.js";

type AdminDataRepositoryOptions = {
  db: any;
  storageMode?: string;
};

function vocabVisibility(record: any): "public" | "assignment" | "draft" {
  if (record?.visibility === "public" || record?.visibility === "assignment" || record?.visibility === "draft") {
    return record.visibility;
  }
  if (record?.status === "private") return "assignment";
  return record?.status === "public" ? "public" : "draft";
}

function grammarVisibility(record: any): "public" | "assignment" | "draft" {
  if (record?.visibility === "public" || record?.visibility === "assignment" || record?.visibility === "draft") {
    return record.visibility;
  }
  if (record?.status === "private") return "assignment";
  return record?.status === "public" ? "public" : "draft";
}

function canSeeOwnedOrPublic(actor: AdminActor, record: any, visibility: string) {
  return actor.role === "super_admin" || record?.createdBy === actor.id || visibility === "public";
}

function matchesSearch(record: any, search: string, fields: string[]) {
  if (!search) return true;
  const needle = search.toLocaleLowerCase("vi-VN");
  return fields.some(field => String(record?.[field] || "").toLocaleLowerCase("vi-VN").includes(needle));
}

function sortNewestFirst(a: any, b: any) {
  const timeCompare = String(b?.createdAt || "").localeCompare(String(a?.createdAt || ""));
  return timeCompare || String(a?.id || "").localeCompare(String(b?.id || ""));
}

function paginate<T>(records: T[], request: AdminPageRequest, facets?: AdminPage<T>["facets"]): AdminPage<T> {
  const total = records.length;
  const totalPages = Math.max(1, Math.ceil(total / request.pageSize));
  const page = Math.min(request.page, totalPages);
  const offset = (page - 1) * request.pageSize;
  return {
    items: records.slice(offset, offset + request.pageSize),
    page,
    pageSize: request.pageSize,
    total,
    totalPages,
    ...(facets ? { facets } : {}),
  };
}

function toVocabSummary(record: any): AdminVocabSetSummary {
  return {
    id: String(record?.id || ""),
    title: String(record?.title || ""),
    description: String(record?.description || ""),
    subject: String(record?.subject || ""),
    tags: Array.isArray(record?.tags) ? record.tags.map(String) : [],
    gradeLevel: String(record?.gradeLevel || ""),
    createdAt: String(record?.createdAt || ""),
    createdBy: String(record?.createdBy || ""),
    creatorName: String(record?.creatorName || ""),
    status: String(record?.status || "draft"),
    visibility: vocabVisibility(record),
    ...(record?.shareToken ? { shareToken: String(record.shareToken) } : {}),
    ...(record?.assignmentSlug ? { assignmentSlug: String(record.assignmentSlug) } : {}),
    itemCount: Array.isArray(record?.items) ? record.items.length : Number(record?.itemCount || 0),
  };
}

function toGrammarSummary(record: any): AdminGrammarSetSummary {
  return {
    id: String(record?.id || ""),
    title: String(record?.title || ""),
    description: String(record?.description || ""),
    gradeLevel: String(record?.gradeLevel || ""),
    subject: String(record?.subject || ""),
    topic: String(record?.topic || ""),
    tags: Array.isArray(record?.tags) ? record.tags.map(String) : [],
    visibility: grammarVisibility(record),
    ...(record?.status ? { status: String(record.status) } : {}),
    ...(record?.shareToken ? { shareToken: String(record.shareToken) } : {}),
    ...(record?.assignmentSlug ? { assignmentSlug: String(record.assignmentSlug) } : {}),
    ...(record?.questionType ? { questionType: String(record.questionType) } : {}),
    timeLimitMinutes: Number(record?.timeLimitMinutes || 0),
    maxAttempts: Math.max(1, Number(record?.maxAttempts || 1)),
    shuffleQuestions: record?.shuffleQuestions !== false,
    shuffleOptions: record?.shuffleOptions !== false,
    showExplanationImmediately: Boolean(record?.showExplanationImmediately),
    showReviewAfterSubmit: record?.showReviewAfterSubmit !== false,
    createdBy: String(record?.createdBy || ""),
    ...(record?.creatorName ? { creatorName: String(record.creatorName) } : {}),
    createdAt: String(record?.createdAt || ""),
    updatedAt: String(record?.updatedAt || ""),
    questionCount: Array.isArray(record?.questions) ? record.questions.length : Number(record?.questionCount || 0),
  };
}

function parseRow(row: any) {
  try {
    return { ...JSON.parse(String(row?.data_json || "{}")), id: String(row?.id || "") };
  } catch {
    return { id: String(row?.id || "") };
  }
}

const ACTIVE_SQL = "COALESCE(json_extract(data_json, '$.lifecycleStatus'), '') != 'archived' AND COALESCE(json_extract(data_json, '$.status'), '') != 'archived' AND json_extract(data_json, '$.archivedAt') IS NULL";
const VISIBILITY_SQL = "CASE WHEN json_extract(data_json, '$.visibility') IN ('public', 'assignment', 'draft') THEN json_extract(data_json, '$.visibility') WHEN json_extract(data_json, '$.status') = 'private' THEN 'assignment' WHEN json_extract(data_json, '$.status') = 'public' THEN 'public' ELSE 'draft' END";

function jsonArray(raw: unknown): string[] {
  try {
    const value = JSON.parse(String(raw || "[]"));
    return Array.isArray(value) ? value.map(String) : [];
  } catch {
    return [];
  }
}

function sqliteVocabSummary(row: any): AdminVocabSetSummary {
  return {
    id: String(row.id || ""),
    title: String(row.title || ""),
    description: String(row.description || ""),
    subject: String(row.subject || ""),
    tags: jsonArray(row.tags_json),
    gradeLevel: String(row.grade_level || ""),
    createdAt: String(row.created_at || ""),
    createdBy: String(row.created_by || ""),
    creatorName: String(row.creator_name || ""),
    status: String(row.status || "draft"),
    visibility: String(row.visibility || "draft") as AdminVocabSetSummary["visibility"],
    ...(row.share_token ? { shareToken: String(row.share_token) } : {}),
    ...(row.assignment_slug ? { assignmentSlug: String(row.assignment_slug) } : {}),
    itemCount: Number(row.item_count || 0),
  };
}

function sqliteGrammarSummary(row: any): AdminGrammarSetSummary {
  return {
    id: String(row.id || ""),
    title: String(row.title || ""),
    description: String(row.description || ""),
    gradeLevel: String(row.grade_level || ""),
    subject: String(row.subject || ""),
    topic: String(row.topic || ""),
    tags: jsonArray(row.tags_json),
    visibility: String(row.visibility || "draft") as AdminGrammarSetSummary["visibility"],
    ...(row.status ? { status: String(row.status) } : {}),
    ...(row.share_token ? { shareToken: String(row.share_token) } : {}),
    ...(row.assignment_slug ? { assignmentSlug: String(row.assignment_slug) } : {}),
    ...(row.question_type ? { questionType: String(row.question_type) } : {}),
    timeLimitMinutes: Number(row.time_limit_minutes || 0),
    maxAttempts: Math.max(1, Number(row.max_attempts || 1)),
    shuffleQuestions: Boolean(row.shuffle_questions),
    shuffleOptions: Boolean(row.shuffle_options),
    showExplanationImmediately: Boolean(row.show_explanation_immediately),
    showReviewAfterSubmit: Boolean(row.show_review_after_submit),
    createdBy: String(row.created_by || ""),
    ...(row.creator_name ? { creatorName: String(row.creator_name) } : {}),
    createdAt: String(row.created_at || ""),
    updatedAt: String(row.updated_at || ""),
    questionCount: Number(row.question_count || 0),
  };
}

const VOCAB_SUMMARY_SQL = `
  SELECT id,
    COALESCE(title, json_extract(data_json, '$.title'), '') AS title,
    COALESCE(description, json_extract(data_json, '$.description'), '') AS description,
    COALESCE(json_extract(data_json, '$.subject'), '') AS subject,
    COALESCE(json_extract(data_json, '$.tags'), '[]') AS tags_json,
    COALESCE(json_extract(data_json, '$.gradeLevel'), '') AS grade_level,
    COALESCE(created_at, json_extract(data_json, '$.createdAt'), '') AS created_at,
    COALESCE(owner_id, json_extract(data_json, '$.createdBy'), '') AS created_by,
    COALESCE(json_extract(data_json, '$.creatorName'), '') AS creator_name,
    COALESCE(json_extract(data_json, '$.status'), 'draft') AS status,
    ${VISIBILITY_SQL} AS visibility,
    COALESCE(share_token, json_extract(data_json, '$.shareToken'), '') AS share_token,
    COALESCE(json_extract(data_json, '$.assignmentSlug'), '') AS assignment_slug,
    COALESCE(json_array_length(json_extract(data_json, '$.items')), 0) AS item_count
  FROM vocab_sets`;

const GRAMMAR_SUMMARY_SQL = `
  SELECT id,
    COALESCE(json_extract(data_json, '$.title'), '') AS title,
    COALESCE(json_extract(data_json, '$.description'), '') AS description,
    COALESCE(json_extract(data_json, '$.gradeLevel'), '') AS grade_level,
    COALESCE(json_extract(data_json, '$.subject'), '') AS subject,
    COALESCE(json_extract(data_json, '$.topic'), '') AS topic,
    COALESCE(json_extract(data_json, '$.tags'), '[]') AS tags_json,
    ${VISIBILITY_SQL} AS visibility,
    COALESCE(json_extract(data_json, '$.status'), '') AS status,
    COALESCE(json_extract(data_json, '$.shareToken'), '') AS share_token,
    COALESCE(json_extract(data_json, '$.assignmentSlug'), '') AS assignment_slug,
    COALESCE(json_extract(data_json, '$.questionType'), '') AS question_type,
    COALESCE(json_extract(data_json, '$.timeLimitMinutes'), 0) AS time_limit_minutes,
    COALESCE(json_extract(data_json, '$.maxAttempts'), 1) AS max_attempts,
    COALESCE(json_extract(data_json, '$.shuffleQuestions'), 1) AS shuffle_questions,
    COALESCE(json_extract(data_json, '$.shuffleOptions'), 1) AS shuffle_options,
    COALESCE(json_extract(data_json, '$.showExplanationImmediately'), 0) AS show_explanation_immediately,
    COALESCE(json_extract(data_json, '$.showReviewAfterSubmit'), 1) AS show_review_after_submit,
    COALESCE(json_extract(data_json, '$.createdBy'), '') AS created_by,
    COALESCE(json_extract(data_json, '$.creatorName'), '') AS creator_name,
    COALESCE(created_at, json_extract(data_json, '$.createdAt'), '') AS created_at,
    COALESCE(updated_at, json_extract(data_json, '$.updatedAt'), '') AS updated_at,
    COALESCE(json_array_length(json_extract(data_json, '$.questions')), 0) AS question_count
  FROM grammar_sets`;

export function createAdminDataRepository(options: AdminDataRepositoryOptions) {
  const readCollection = async (name: string) => {
    const snapshot = await options.db.collection(name).get();
    return (snapshot.docs || []).map((doc: any) => ({ id: doc.id, ...doc.data() }));
  };

  const readSqliteCollection = async (table: string) => {
    const rows = await sqliteQueryAll<{ id: string; data_json: string }>(`SELECT id, data_json FROM ${table}`);
    return rows.map(parseRow);
  };

  const readRecords = async (collection: string, table: string) => {
    return options.storageMode === "sqlite" ? readSqliteCollection(table) : readCollection(collection);
  };

  const listVocabSets = async (actor: AdminActor, request: AdminPageRequest): Promise<AdminPage<AdminVocabSetSummary>> => {
    if (options.storageMode === "sqlite") {
      const clauses = [ACTIVE_SQL];
      const params: unknown[] = [];
      if (actor.role !== "super_admin") {
        clauses.push(`(COALESCE(owner_id, json_extract(data_json, '$.createdBy'), '') = ? OR ${VISIBILITY_SQL} = 'public')`);
        params.push(actor.id);
      }
      if (request.grade) {
        clauses.push("COALESCE(json_extract(data_json, '$.gradeLevel'), '') = ?");
        params.push(request.grade);
      }
      if (request.status) {
        clauses.push(`${VISIBILITY_SQL} = ?`);
        params.push(request.status);
      }
      const whereSql = clauses.join(" AND ");
      const facetClauses = [ACTIVE_SQL];
      const facetParams: unknown[] = [];
      if (actor.role !== "super_admin") {
        facetClauses.push(`(COALESCE(owner_id, json_extract(data_json, '$.createdBy'), '') = ? OR ${VISIBILITY_SQL} = 'public')`);
        facetParams.push(actor.id);
      }
      const gradeRows = await sqliteQueryAll<{ grade: string }>(
        `SELECT DISTINCT COALESCE(json_extract(data_json, '$.gradeLevel'), '') AS grade FROM vocab_sets WHERE ${facetClauses.join(" AND ")} ORDER BY grade`,
        facetParams
      );
      const grades = gradeRows.map(row => String(row.grade || "")).filter(Boolean);
      if (request.search) {
        const rows = await sqliteQueryAll<any>(`${VOCAB_SUMMARY_SQL} WHERE ${whereSql} ORDER BY created_at DESC, id ASC`, params);
        const matches = rows.map(sqliteVocabSummary).filter(record => matchesSearch(record, request.search, ["title", "description", "subject"]));
        return paginate(matches, request, { grades });
      }
      const count = await sqliteQueryOne<{ count: number }>(`SELECT COUNT(*) AS count FROM vocab_sets WHERE ${whereSql}`, params);
      const total = Number(count?.count || 0);
      const totalPages = Math.max(1, Math.ceil(total / request.pageSize));
      const page = Math.min(request.page, totalPages);
      const rows = await sqliteQueryAll<any>(
        `${VOCAB_SUMMARY_SQL} WHERE ${whereSql} ORDER BY created_at DESC, id ASC LIMIT ? OFFSET ?`,
        [...params, request.pageSize, (page - 1) * request.pageSize]
      );
      return { items: rows.map(sqliteVocabSummary), page, pageSize: request.pageSize, total, totalPages, facets: { grades } };
    }
    const records = (await readRecords("vocab_sets", "vocab_sets"))
      .filter(record => !isArchivedRecord(record))
      .filter(record => canSeeOwnedOrPublic(actor, record, vocabVisibility(record)))
      .sort(sortNewestFirst);
    const grades = Array.from(new Set<string>(records.map(record => String(record?.gradeLevel || "")).filter(Boolean))).sort();
    const filtered = records
      .filter(record => matchesSearch(record, request.search, ["title", "description", "subject"]))
      .filter(record => !request.grade || record?.gradeLevel === request.grade)
      .filter(record => !request.status || vocabVisibility(record) === request.status)
      .map(toVocabSummary);
    return paginate(filtered, request, { grades });
  };

  const listGrammarSets = async (actor: AdminActor, request: AdminPageRequest): Promise<AdminPage<AdminGrammarSetSummary>> => {
    if (options.storageMode === "sqlite") {
      const clauses = [ACTIVE_SQL];
      const params: unknown[] = [];
      if (actor.role !== "super_admin") {
        clauses.push(`(COALESCE(json_extract(data_json, '$.createdBy'), '') = ? OR ${VISIBILITY_SQL} = 'public')`);
        params.push(actor.id);
      }
      if (request.grade) {
        clauses.push("COALESCE(json_extract(data_json, '$.gradeLevel'), '') = ?");
        params.push(request.grade);
      }
      if (request.status) {
        clauses.push(`${VISIBILITY_SQL} = ?`);
        params.push(request.status);
      }
      const whereSql = clauses.join(" AND ");
      const facetClauses = [ACTIVE_SQL];
      const facetParams: unknown[] = [];
      if (actor.role !== "super_admin") {
        facetClauses.push(`(COALESCE(json_extract(data_json, '$.createdBy'), '') = ? OR ${VISIBILITY_SQL} = 'public')`);
        facetParams.push(actor.id);
      }
      const gradeRows = await sqliteQueryAll<{ grade: string }>(
        `SELECT DISTINCT COALESCE(json_extract(data_json, '$.gradeLevel'), '') AS grade FROM grammar_sets WHERE ${facetClauses.join(" AND ")} ORDER BY grade`,
        facetParams
      );
      const grades = gradeRows.map(row => String(row.grade || "")).filter(Boolean);
      if (request.search) {
        const rows = await sqliteQueryAll<any>(`${GRAMMAR_SUMMARY_SQL} WHERE ${whereSql} ORDER BY created_at DESC, id ASC`, params);
        const matches = rows.map(sqliteGrammarSummary).filter(record => matchesSearch(record, request.search, ["title", "description", "subject", "topic"]));
        return paginate(matches, request, { grades });
      }
      const count = await sqliteQueryOne<{ count: number }>(`SELECT COUNT(*) AS count FROM grammar_sets WHERE ${whereSql}`, params);
      const total = Number(count?.count || 0);
      const totalPages = Math.max(1, Math.ceil(total / request.pageSize));
      const page = Math.min(request.page, totalPages);
      const rows = await sqliteQueryAll<any>(
        `${GRAMMAR_SUMMARY_SQL} WHERE ${whereSql} ORDER BY created_at DESC, id ASC LIMIT ? OFFSET ?`,
        [...params, request.pageSize, (page - 1) * request.pageSize]
      );
      return { items: rows.map(sqliteGrammarSummary), page, pageSize: request.pageSize, total, totalPages, facets: { grades } };
    }
    const records = (await readRecords("grammar_sets", "grammar_sets"))
      .filter(record => !isArchivedRecord(record))
      .filter(record => canSeeOwnedOrPublic(actor, record, grammarVisibility(record)))
      .sort(sortNewestFirst);
    const grades = Array.from(new Set<string>(records.map(record => String(record?.gradeLevel || "")).filter(Boolean))).sort();
    const filtered = records
      .filter(record => matchesSearch(record, request.search, ["title", "description", "subject", "topic"]))
      .filter(record => !request.grade || record?.gradeLevel === request.grade)
      .filter(record => !request.status || grammarVisibility(record) === request.status)
      .map(toGrammarSummary);
    return paginate(filtered, request, { grades });
  };

  const listClasses = async (actor: AdminActor, request: AdminPageRequest): Promise<AdminPage<any>> => {
    const records = (await readRecords("classes", "classes"))
      .filter(record => !isArchivedRecord(record))
      .filter(record => actor.role === "super_admin" || record?.teacherId === actor.id)
      .filter(record => matchesSearch(record, request.search, ["name", "code"]))
      .sort(sortNewestFirst);
    return paginate(records, request);
  };

  const listClassMembers = async (actor: AdminActor, requestedClassIds: string[]) => {
    const classes = (await readRecords("classes", "classes"))
      .filter(record => !isArchivedRecord(record))
      .filter(record => actor.role === "super_admin" || record?.teacherId === actor.id);
    const allowedClassIds = new Set(classes.map(record => String(record.id || "")));
    const requested = new Set(requestedClassIds.filter(id => allowedClassIds.has(id)));
    if (requested.size === 0) return [];
    return (await readRecords("class_members", "class_members"))
      .filter(record => requested.has(String(record?.classId || "")))
      .sort((a, b) => String(a?.studentName || "").localeCompare(String(b?.studentName || ""), "vi"));
  };

  const listAssignments = async (actor: AdminActor, request: AdminPageRequest): Promise<AdminPage<any>> => {
    const classes = (await readRecords("classes", "classes"))
      .filter(record => !isArchivedRecord(record));
    const manageableClassIds = new Set(classes
      .filter(record => actor.role === "super_admin" || record?.teacherId === actor.id)
      .map(record => String(record.id || "")));
    const records = (await readRecords("assignments", "assignments"))
      .filter(record => !isArchivedRecord(record))
      .filter(record => actor.role === "super_admin" || record?.createdBy === actor.id || manageableClassIds.has(String(record?.classId || "")))
      .filter(record => matchesSearch(record, request.search, ["title", "className", "resourceTitle", "vocabSetTitle"]))
      .sort(sortNewestFirst);
    return paginate(records, request);
  };

  const listAssignmentOptions = async (actor: AdminActor) => {
    const classes = (await readRecords("classes", "classes"))
      .filter(record => !isArchivedRecord(record))
      .filter(record => actor.role === "super_admin" || record?.teacherId === actor.id)
      .sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || ""), "vi"))
      .map(record => ({ id: String(record.id || ""), name: String(record.name || ""), code: String(record.code || ""), teacherId: String(record.teacherId || "") }));
    const vocabSets = (await readRecords("vocab_sets", "vocab_sets"))
      .filter(record => !isArchivedRecord(record))
      .filter(record => canSeeOwnedOrPublic(actor, record, vocabVisibility(record)))
      .filter(record => vocabVisibility(record) !== "draft")
      .sort(sortNewestFirst)
      .map(toVocabSummary);
    return { classes, vocabSets };
  };

  const getDashboardCounts = async (actor: AdminActor): Promise<AdminDashboardCounts> => {
    if (options.storageMode === "sqlite") {
      const ownerClause = actor.role === "super_admin" ? "1 = 1" : "(json_extract(data_json, '$.createdBy') = ? OR json_extract(data_json, '$.visibility') = 'public' OR json_extract(data_json, '$.status') = 'public')";
      const classClause = actor.role === "super_admin" ? "1 = 1" : "teacher_id = ?";
      const assignmentClause = actor.role === "super_admin"
        ? "1 = 1"
        : `(json_extract(assignments.data_json, '$.createdBy') = ? OR EXISTS (
            SELECT 1
            FROM classes AS managed_class
            WHERE managed_class.id = assignments.class_id
              AND managed_class.teacher_id = ?
              AND COALESCE(json_extract(managed_class.data_json, '$.lifecycleStatus'), '') != 'archived'
              AND COALESCE(json_extract(managed_class.data_json, '$.status'), '') != 'archived'
              AND json_extract(managed_class.data_json, '$.archivedAt') IS NULL
          ))`;
      const ownerParams = actor.role === "super_admin" ? [] : [actor.id];
      const assignmentParams = actor.role === "super_admin" ? [] : [actor.id, actor.id];
      const [vocab, grammar, classes, assignments] = await Promise.all([
        sqliteQueryOne<{ count: number }>(`SELECT COUNT(*) AS count FROM vocab_sets WHERE ${ACTIVE_SQL} AND ${ownerClause}`, ownerParams),
        sqliteQueryOne<{ count: number }>(`SELECT COUNT(*) AS count FROM grammar_sets WHERE ${ACTIVE_SQL} AND ${ownerClause}`, ownerParams),
        sqliteQueryOne<{ count: number }>(`SELECT COUNT(*) AS count FROM classes WHERE ${ACTIVE_SQL} AND ${classClause}`, ownerParams),
        sqliteQueryOne<{ count: number }>(`SELECT COUNT(*) AS count FROM assignments WHERE ${ACTIVE_SQL} AND ${assignmentClause}`, assignmentParams),
      ]);
      return {
        vocabSets: Number(vocab?.count || 0),
        grammarSets: Number(grammar?.count || 0),
        classes: Number(classes?.count || 0),
        assignments: Number(assignments?.count || 0),
      };
    }

    const [vocab, grammar, classes, assignments] = await Promise.all([
      readCollection("vocab_sets"),
      readCollection("grammar_sets"),
      readCollection("classes"),
      readCollection("assignments"),
    ]);
    const manageableClassIds = new Set(classes
      .filter(record => !isArchivedRecord(record) && (actor.role === "super_admin" || record.teacherId === actor.id))
      .map(record => String(record.id || "")));
    return {
      vocabSets: vocab.filter(record => !isArchivedRecord(record) && canSeeOwnedOrPublic(actor, record, vocabVisibility(record))).length,
      grammarSets: grammar.filter(record => !isArchivedRecord(record) && canSeeOwnedOrPublic(actor, record, grammarVisibility(record))).length,
      classes: classes.filter(record => !isArchivedRecord(record) && (actor.role === "super_admin" || record.teacherId === actor.id)).length,
      assignments: assignments.filter(record => !isArchivedRecord(record) && (
        actor.role === "super_admin"
        || record.createdBy === actor.id
        || manageableClassIds.has(String(record.classId || ""))
      )).length,
    };
  };

  return { getDashboardCounts, listAssignmentOptions, listAssignments, listClasses, listClassMembers, listGrammarSets, listVocabSets };
}
