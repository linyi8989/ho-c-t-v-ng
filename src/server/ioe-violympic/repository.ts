import crypto from 'node:crypto';
import { sqliteImmediateTransaction, sqliteQueryAll, sqliteQueryOne } from '../../lib/sqliteStorage';
import type { SQLiteSynchronousGateway } from '../../lib/storage/storageTypes';
import { CompetitionError, normalizeQuestion, parseScope, text } from '../../shared/competition/import';
import { SUBJECTS, SUBJECT_LABELS, LEVEL_LABELS, levelsFor, type BankTopic, type Paper, type Question, type Scope, type QuestionFilters, type Media, type OverviewReport, type OverviewStats, type ResultFilters, type ResultSummary, type ResultsPage } from '../../shared/competition/types';
import { blueprint, fingerprint, selectQuestions, shuffle } from './selection';

export interface Staff { id: string; role: 'teacher' | 'super_admin' }
export const decode = <T>(row: { data_json: string }): T => JSON.parse(row.data_json) as T;
export function requireOwned<T extends { ownerId: string }>(value: T | undefined, actor: Staff): T {
  if (!value || (actor.role !== 'super_admin' && value.ownerId !== actor.id)) throw new CompetitionError(404, 'NOT_FOUND', 'Không tìm thấy nội dung hoặc bạn không có quyền.');
  return value;
}
export const transaction = sqliteImmediateTransaction;
export const queryAll = sqliteQueryAll;
export const queryOne = sqliteQueryOne;
export function registerMedia(db: SQLiteSynchronousGateway, resourceId: string, type: string, questions: Question[], now: string) {
  const attached: Media[] = questions.flatMap(q => [...q.media, ...q.options.flatMap(o => o.media), ...(q.pairs ? [...q.pairs.left, ...q.pairs.right].flatMap(o => o.media) : [])]);
  const unique = new Map(attached.map(m => [m.url, m]));
  unique.forEach(m => {
    const id = crypto.createHash('sha256').update(`${resourceId}:${m.url}`).digest('hex');
    const data = { id, assetId: m.assetId || '', url: m.url, resourceId, resourceType: type, createdAt: now };
    db.run('INSERT OR IGNORE INTO competition_asset_usages(id,asset_id,url,resource_id,resource_type,created_at,data_json) VALUES (?,?,?,?,?,?,?)', [id, m.assetId || null, m.url, resourceId, type, now, JSON.stringify(data)]);
  });
}
export async function validateMediaOwnership(actor: Staff, questions: Question[]) {
  const media = questions.flatMap(q => [...q.media, ...q.options.flatMap(o => o.media), ...(q.pairs ? [...q.pairs.left, ...q.pairs.right].flatMap(o => o.media) : [])]);
  for (const m of new Map(media.map(m => [m.url, m])).values()) {
    if (m.url.startsWith('/audio/') && !m.assetId) continue; // Existing B TTS managed URLs; never fetch client URLs.
    const table = m.url.startsWith('/vocab-images/') ? 'vocab_image_assets' : 'listening_assets';
    if (!m.assetId) throw new CompetitionError(400, 'INVALID_MEDIA', 'Cần chọn media đã được quản lý bởi B.');
    const row = await queryOne<{ data_json: string }>(`SELECT data_json FROM ${table} WHERE id=?`, [m.assetId]);
    const asset = row ? decode<{ ownerId?: string; createdBy?: string; url?: string; publicUrl?: string; status?: string }>(row) : undefined;
    if (!asset || asset.status === 'archived' || (asset.url || asset.publicUrl) !== m.url || (actor.role !== 'super_admin' && (asset.ownerId || asset.createdBy) !== actor.id)) throw new CompetitionError(404, 'INVALID_MEDIA', 'Media không tồn tại hoặc không thuộc quyền sử dụng.');
  }
}
function scopeWhere(scope: Scope) { return [scope.subject, scope.grade, scope.level]; }
function bankPool(db: SQLiteSynchronousGateway, actor: Staff | undefined, scope: Scope): Question[] {
  const params: unknown[] = scopeWhere(scope);
  const owned = actor && actor.role !== 'super_admin';
  if (owned) params.push(actor.id);
  return db.all<{ data_json: string }>(`SELECT data_json FROM competition_questions WHERE archived=0 AND subject=? AND grade=? AND level=? ${owned ? 'AND owner_id=?' : ''}`, params).map(row => decode<Question>(row));
}
export function bankScope(id: string): Scope | undefined {
  if (!id.startsWith('bank-')) return undefined;
  const match = /^bank-(english|math|math-english|vietnamese)-([1-9])-(practice|school|district|province|national)$/.exec(id);
  if (!match) throw new CompetitionError(400, 'INVALID_SCOPE', 'Môn, lớp hoặc cấp không hợp lệ.');
  return parseScope({ subject: match[1], grade: match[2], level: match[3] });
}
function topic(scope: Scope, count = 0, available = 0): BankTopic {
  const b = blueprint(scope);
  return { ...scope, id: `bank-${scope.subject}-${scope.grade}-${scope.level}`, title: `${SUBJECT_LABELS[scope.subject]} · Lớp ${scope.grade} · ${LEVEL_LABELS[scope.level]}`,
    source: 'bank', visibility: 'public', total: b.total, durationMinutes: b.durationMinutes, storedCount: count, available, ready: available >= b.total };
}
export async function listBankTopics(): Promise<BankTopic[]> {
  const rows = await queryAll<Scope & { count: number; available: number }>(`SELECT subject,grade,level,COUNT(*) AS count,COUNT(DISTINCT fingerprint) AS available
    FROM competition_questions WHERE archived=0 GROUP BY subject,grade,level`);
  return SUBJECTS.flatMap(subject => Array.from({ length: 9 }, (_, i) => i + 1).flatMap(grade => levelsFor(subject).map(level => {
    const row = rows.find(row => row.subject === subject && row.grade === grade && row.level === level);
    return topic({ subject, grade, level }, row?.count, row?.available);
  })));
}
export async function getBankTopic(scope: Scope): Promise<BankTopic> {
  const row = await queryOne<{ count: number; available: number }>('SELECT COUNT(*) AS count,COUNT(DISTINCT fingerprint) AS available FROM competition_questions WHERE archived=0 AND subject=? AND grade=? AND level=?', scopeWhere(scope));
  return topic(scope, row?.count, row?.available);
}
// Called only inside prepare's transaction, after identity and retry checks.
// Bank questions are shared for play; their editing ownership stays untouched.
export function snapshotBank(db: SQLiteSynchronousGateway, scope: Scope, now: string) {
  const b = blueprint(scope), selected = selectQuestions(bankPool(db, undefined, scope), b), info = topic(scope);
  const paper: Paper = { ...scope, id: info.id, title: info.title, source: 'bank', ownerId: 'competition-shared-bank', versionId: crypto.randomUUID(),
    visibility: 'public', status: 'published', total: b.total, durationMinutes: b.durationMinutes, createdAt: now, blueprint: b, relaxed: selected.relaxed, warnings: selected.warnings };
  // Stable scope metadata supports existing History/result joins. Each run has
  // its own immutable version; never update a previous publication or attempt.
  db.run('INSERT OR IGNORE INTO competition_papers(id,owner_id,subject,grade,level,status,visibility,created_at,updated_at,data_json) VALUES (?,?,?,?,?,?,?,?,?,?)',
    [paper.id, paper.ownerId, scope.subject, scope.grade, scope.level, paper.status, paper.visibility, now, now, JSON.stringify(paper)]);
  db.run('INSERT INTO competition_paper_versions(id,paper_id,created_at,data_json) VALUES (?,?,?,?)', [paper.versionId, paper.id, now, JSON.stringify({ paper, questions: selected.questions })]);
  registerMedia(db, paper.versionId, 'paper-version', selected.questions, now);
  return { paper, questions: selected.questions };
}
export async function listBank(actor: Staff, filters: QuestionFilters, search: string, page: number) {
  const like = `%${search.replace(/[\\%_]/g, c => `\\${c}`)}%`;
  const conditions = ['archived=0'], params: unknown[] = [];
  for (const key of ['subject', 'grade', 'level'] as const) {
    if (filters[key] !== undefined) { conditions.push(`${key}=?`); params.push(filters[key]); }
  }
  conditions.push(`(json_extract(data_json,'$.prompt') || ' ' || json_extract(data_json,'$.title')) LIKE ? ESCAPE '\\'`); params.push(like);
  if (actor.role !== 'super_admin') { conditions.push('owner_id=?'); params.push(actor.id); }
  const where = conditions.join(' AND ');
  const [rows, count] = await Promise.all([
    queryAll<{ data_json: string }>(`SELECT data_json FROM competition_questions WHERE ${where} ORDER BY updated_at DESC, id LIMIT 30 OFFSET ?`, [...params, (page - 1) * 30]),
    queryOne<{ total: number }>(`SELECT COUNT(*) AS total FROM competition_questions WHERE ${where}`, params),
  ]);
  return { items: rows.map(row => decode<Question>(row)), total: count?.total || 0, page, pageSize: 30 };
}
export async function saveQuestions(actor: Staff, scope: Scope, rows: unknown[], requestId: string) {
  if (!Array.isArray(rows) || rows.length < 1 || rows.length > 50) throw new CompetitionError(400, 'INVALID_BATCH', 'Mỗi lượt lưu từ 1 đến 50 câu.');
  const normalized = rows.map((q, i) => { try { return normalizeQuestion(q, scope); } catch (error) { throw new CompetitionError(422, 'INVALID_BATCH', `Câu ${i + 1}: ${error instanceof Error ? error.message : 'không hợp lệ'}`); } });
  await validateMediaOwnership(actor, normalized);
  const hash = crypto.createHash('sha256').update(JSON.stringify([scope, rows])).digest('hex');
  const importId = crypto.createHash('sha256').update(`${actor.id}:${requestId}`).digest('hex');
  return transaction(db => {
    const existing = db.one<{ payload_hash: string; data_json: string }>('SELECT payload_hash,data_json FROM competition_imports WHERE id=?', [importId]);
    if (existing) {
      if (existing.payload_hash !== hash) throw new CompetitionError(409, 'IDEMPOTENCY_CONFLICT', 'Mã lưu đã được dùng cho nội dung khác.');
      return decode<{ ids: string[]; count: number }>(existing);
    }
    const now = new Date().toISOString(), ids: string[] = [];
    for (const q of normalized) {
      const id = crypto.randomUUID(), question: Question = { ...q, id, ownerId: actor.id, revision: 1 };
      db.run('INSERT INTO competition_questions(id,owner_id,subject,grade,level,revision,fingerprint,created_at,updated_at,data_json) VALUES (?,?,?,?,?,?,?,?,?,?)', [id, actor.id, scope.subject, scope.grade, scope.level, 1, fingerprint(q), now, now, JSON.stringify(question)]);
      db.run('INSERT INTO competition_question_versions(id,question_id,revision,created_at,data_json) VALUES (?,?,?,?,?)', [`${id}:1`, id, 1, now, JSON.stringify(question)]);
      registerMedia(db, `${id}:1`, 'question-version', [question], now); ids.push(id);
    }
    const result = { ids, count: ids.length };
    db.run('INSERT INTO competition_imports(id,owner_id,payload_hash,created_at,data_json) VALUES (?,?,?,?,?)', [importId, actor.id, hash, now, JSON.stringify(result)]);
    return result;
  });
}
export async function updateQuestion(actor: Staff, id: string, scope: Scope, input: unknown, expectedRevision: number) {
  const normalized = normalizeQuestion(input, scope); await validateMediaOwnership(actor, [normalized]);
  return transaction(db => {
    const row = db.one<{ data_json: string }>('SELECT data_json FROM competition_questions WHERE id=? AND archived=0', [id]);
    const old = requireOwned(row ? decode<Question>(row) : undefined, actor);
    if (old.revision !== expectedRevision) {
      if (old.revision === expectedRevision + 1 && old.subject === scope.subject && old.grade === scope.grade && old.level === scope.level
        && JSON.stringify(normalizeQuestion(old, scope)) === JSON.stringify(normalized)) return old;
      throw new CompetitionError(409, 'REVISION_CONFLICT', 'Câu đã được sửa ở nơi khác; tải lại trước khi lưu.');
    }
    const now = new Date().toISOString(), q = { ...normalized, id, ownerId: old.ownerId, revision: old.revision + 1 };
    db.run('UPDATE competition_questions SET subject=?,grade=?,level=?,revision=?,fingerprint=?,updated_at=?,data_json=? WHERE id=?', [q.subject, q.grade, q.level, q.revision, fingerprint(q), now, JSON.stringify(q), id]);
    db.run('INSERT INTO competition_question_versions(id,question_id,revision,created_at,data_json) VALUES (?,?,?,?,?)', [`${id}:${q.revision}`, id, q.revision, now, JSON.stringify(q)]);
    registerMedia(db, `${id}:${q.revision}`, 'question-version', [q], now); return q;
  });
}
export async function archiveQuestions(actor: Staff, ids: string[]) {
  return transaction(db => {
    const questions = ids.map(id => {
      const row = db.one<{ data_json: string }>('SELECT data_json FROM competition_questions WHERE id=?', [id]);
      return requireOwned(row ? decode<Question>(row) : undefined, actor);
    });
    const now = new Date().toISOString();
    questions.forEach(q => db.run('UPDATE competition_questions SET archived=1,updated_at=?,data_json=? WHERE id=?', [now, JSON.stringify({ ...q, archived: true }), q.id]));
    return { archived: ids.length };
  });
}
export async function createPaper(actor: Staff, scope: Scope, title: string, visibility: 'public' | 'assignment') {
  return transaction(db => {
    const b = blueprint(scope), selection = selectQuestions(bankPool(db, actor, scope), b);
    const now = new Date().toISOString(), id = crypto.randomUUID(), versionId = crypto.randomUUID();
    const paper: Paper = { ...scope, id, ownerId: actor.id, title: text(title, 300, true), versionId, visibility, status: 'published', total: b.total, durationMinutes: b.durationMinutes, createdAt: now, blueprint: b, relaxed: selection.relaxed, warnings: selection.warnings };
    db.run('INSERT INTO competition_papers(id,owner_id,subject,grade,level,status,visibility,created_at,updated_at,data_json) VALUES (?,?,?,?,?,?,?,?,?,?)', [id, actor.id, scope.subject, scope.grade, scope.level, 'published', visibility, now, now, JSON.stringify(paper)]);
    db.run('INSERT INTO competition_paper_versions(id,paper_id,created_at,data_json) VALUES (?,?,?,?)', [versionId, id, now, JSON.stringify({ paper, questions: selection.questions })]);
    registerMedia(db, versionId, 'paper-version', selection.questions, now); return paper;
  });
}
export async function getPaper(id: string) {
  const row = await queryOne<{ data_json: string }>('SELECT data_json FROM competition_papers WHERE id=?', [id]);
  return row ? decode<Paper>(row) : undefined;
}
export async function listPapers(actor?: Staff) {
  const where = actor ? actor.role === 'super_admin' ? 'status<>\'archived\'' : 'status<>\'archived\' AND owner_id=?' : "status='published' AND visibility='public'";
  return (await queryAll<{ data_json: string }>(`SELECT data_json FROM competition_papers WHERE ${where} AND COALESCE(json_extract(data_json,'$.source'),'') NOT IN ('bank','mistakes') ORDER BY created_at DESC LIMIT 200`, actor && actor.role !== 'super_admin' ? [actor.id] : [])).map(row => decode<Paper>(row));
}
function inventoryRows(db: SQLiteSynchronousGateway, actor: Staff) {
    const owner = actor.role === 'super_admin' ? '' : 'AND owner_id=?', params = owner ? [actor.id] : [];
    const rows = db.all<{ subject: Scope['subject']; grade: number; level: Scope['level']; count: number; unique_count: number }>(`SELECT subject,grade,level,COUNT(*) AS count,COUNT(DISTINCT fingerprint) AS unique_count FROM competition_questions WHERE archived=0 ${owner} GROUP BY subject,grade,level ORDER BY subject,grade,level`, params);
    return rows.map(row => ({ ...row, required: blueprint(row).total, ready: row.unique_count >= blueprint(row).total }));
}
export async function inventory(actor: Staff) {
  return transaction(db => inventoryRows(db, actor));
}
export async function overview(actor: Staff): Promise<OverviewReport> {
  return transaction(db => {
    const rows = inventoryRows(db, actor);
    const owner = actor.role === 'super_admin' ? '' : 'AND p.owner_id=?', params = owner ? [actor.id] : [];
    const from = `FROM competition_attempts a JOIN competition_papers p ON p.id=a.paper_id WHERE a.status IN ('active','completed') ${owner}`;
    const columns = "COUNT(DISTINCT a.owner_key) AS players,COUNT(*) AS attempts,COALESCE(SUM(CASE WHEN a.status='completed' THEN 1 ELSE 0 END),0) AS completed";
    const counts = db.all<{ subject: Scope['subject']; players: number; attempts: number; completed: number }>(`SELECT p.subject,${columns} ${from} GROUP BY p.subject`, params);
    const totals = db.one<Omit<OverviewStats, 'questions'>>(`SELECT ${columns} ${from}`, params)!;
    const subjects = Object.fromEntries(SUBJECTS.map(subject => {
      const count = counts.find(row => row.subject === subject);
      return [subject, { questions: rows.filter(row => row.subject === subject).reduce((sum, row) => sum + row.count, 0), players: count?.players || 0, attempts: count?.attempts || 0, completed: count?.completed || 0 }];
    })) as OverviewReport['subjects'];
    return { inventory: rows, totals: { ...totals, questions: rows.reduce((sum, row) => sum + row.count, 0) }, subjects };
  });
}
export async function listResults(actor: Staff, filters: ResultFilters, page = 1): Promise<ResultsPage> {
  return transaction(db => {
    const conditions = ["a.status='completed'"], params: unknown[] = [];
    if (actor.role !== 'super_admin') { conditions.push('p.owner_id=?'); params.push(actor.id); }
    if (filters.paperId) { conditions.push('a.paper_id=?'); params.push(filters.paperId); }
    if (filters.subject) { conditions.push('p.subject=?'); params.push(filters.subject); }
    if (filters.grade !== undefined) { conditions.push('p.grade=?'); params.push(filters.grade); }
    if (filters.level) { conditions.push('p.level=?'); params.push(filters.level); }
    const from = `FROM competition_attempts a JOIN competition_papers p ON p.id=a.paper_id WHERE ${conditions.join(' AND ')}`;
    const total = db.one<{ total: number }>(`SELECT COUNT(*) AS total ${from}`, params)!.total;
    const pageSize = 50;
    const items = db.all<ResultSummary>(`SELECT a.id,a.student_name,a.score,a.raw_score,a.max_score,a.completed_at,p.subject,p.grade,p.level,
      json_extract(a.data_json,'$.className') AS class_name,json_extract(a.data_json,'$.paper.title') AS title
      ${from} ORDER BY a.completed_at DESC,a.id LIMIT ? OFFSET ?`, [...params, pageSize, (page - 1) * pageSize]);
    return { items, total, page, pageSize };
  });
}
export function shuffledSnapshot(questions: Question[]) {
  const relabel = (options: Question['options']) => shuffle(options).map((o, i) => ({ ...o, label: String.fromCharCode(65 + i) }));
  return shuffle(questions).map(q => ({ ...q, options: relabel(q.options), ...(q.pairs ? { pairs: { left: relabel(q.pairs.left), right: relabel(q.pairs.right) } } : {}) }));
}
