import crypto from 'node:crypto';
import { sqliteQueryAll, sqliteQueryOne, sqliteImmediateTransaction } from '../../lib/sqliteStorage';
import { normalizeLesson, publicLesson, SpeakingError, type Lesson, type ResultSummary, lessonItems } from '../../shared/speaking/types';
export type Staff = { id: string; role: 'teacher' | 'super_admin' };
export const queryAll = sqliteQueryAll, queryOne = sqliteQueryOne, transaction = sqliteImmediateTransaction;
export const decode = <T>(row: { data_json: string }): T => JSON.parse(row.data_json);
export async function getLesson(id: string) { const row = await queryOne<{ data_json: string }>('SELECT data_json FROM speaking_lessons WHERE id=?', [id]); return row ? decode<Lesson>(row) : undefined; }
export function owned(lesson: Lesson | undefined, actor: Staff): Lesson {
  if (!lesson || (actor.role !== 'super_admin' && lesson.ownerId !== actor.id)) throw new SpeakingError(404, 'NOT_FOUND', 'Không tìm thấy bài luyện đọc.');
  return lesson;
}
function lessonFilter(actor?: Staff, grade?: number, kind?: string, search = '') {
  const clauses = [actor ? "status <> 'archived'" : "status='published'"], args: unknown[] = [];
  if (actor?.role === 'teacher') { clauses.push('owner_id=?'); args.push(actor.id); }
  if (grade) { clauses.push('grade=?'); args.push(grade); } if (kind) { clauses.push('kind=?'); args.push(kind); }
  if (search) { clauses.push("(json_extract(data_json,'$.title') LIKE ? ESCAPE '\\' OR json_extract(data_json,'$.referenceText') LIKE ? ESCAPE '\\')"); const pattern = `%${search.replace(/[\\%_]/g, m => `\\${m}`)}%`; args.push(pattern, pattern); }
  return { where: clauses.join(' AND '), args };
}
export async function listLessons(actor?: Staff, grade?: number, kind?: string, search = '', page = 1, pageSize = 200) {
  const { where, args } = lessonFilter(actor, grade, kind, search);
  const rows = await queryAll<{ data_json: string }>(`SELECT data_json FROM speaking_lessons WHERE ${where} ORDER BY updated_at DESC,id LIMIT ? OFFSET ?`, [...args, pageSize, (page - 1) * pageSize]);
  return rows.map(row => actor ? decode<Lesson>(row) : publicLesson(decode<Lesson>(row)));
}
export async function lessonPage(actor?: Staff, grade?: number, kind?: string, search = '', page = 1) {
  const { where, args } = lessonFilter(actor, grade, kind, search), count = await queryOne<{ n: number }>(`SELECT COUNT(*) n FROM speaking_lessons WHERE ${where}`, args);
  return { items: await listLessons(actor, grade, kind, search, page, 30), total: count?.n || 0, page, pageSize: 30 };
}
export async function saveLesson(actor: Staff, input: unknown, id?: string, revision?: number): Promise<Lesson> {
  const data = normalizeLesson(input), now = new Date().toISOString();
  return transaction(db => {
    const row = id ? db.one<{ data_json: string }>('SELECT data_json FROM speaking_lessons WHERE id=?', [id]) : undefined;
    const previous = id ? owned(row ? decode<Lesson>(row) : undefined, actor) : undefined;
    if (previous && previous.revision !== revision) throw new SpeakingError(409, 'REVISION_CONFLICT', 'Bài đã được sửa ở nơi khác. Hãy tải lại.');
    const lesson: Lesson = { ...data, id: previous?.id || crypto.randomUUID(), ownerId: previous?.ownerId || actor.id, revision: (previous?.revision || 0) + 1, versionId: '', status: 'draft', createdAt: previous?.createdAt || now, updatedAt: now };
    db.run('INSERT INTO speaking_lessons(id,owner_id,status,grade,kind,revision,created_at,updated_at,data_json) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,grade=excluded.grade,kind=excluded.kind,revision=excluded.revision,updated_at=excluded.updated_at,data_json=excluded.data_json',
      [lesson.id, lesson.ownerId, lesson.status, lesson.grade, lesson.kind, lesson.revision, lesson.createdAt, now, JSON.stringify(lesson)]);
    return lesson;
  });
}
export async function setLessonStatus(actor: Staff, id: string, revision: number, status: 'published' | 'archived'): Promise<Lesson> {
  return transaction(db => {
    const row = db.one<{ data_json: string }>('SELECT data_json FROM speaking_lessons WHERE id=?', [id]), lesson = owned(row ? decode<Lesson>(row) : undefined, actor);
    if (lesson.revision !== revision) throw new SpeakingError(409, 'REVISION_CONFLICT', 'Bài đã được sửa ở nơi khác. Hãy tải lại.');
    if (status === 'published' && lesson.provider === 'speechsuper' && (lesson.maxSeconds > 180 || (lesson.kind !== 'passage' && lessonItems(lesson).some(item => item.referenceText.split(/\s+/).length > 200)))) throw new SpeakingError(400, 'PROVIDER_LIMIT', 'SpeechSuper: đoạn văn tối đa 180 giây; câu tối đa 200 từ.');
    const next = { ...lesson, status, versionId: status === 'published' ? `${id}:${lesson.revision}` : lesson.versionId, updatedAt: new Date().toISOString() };
    if (status === 'published') db.run('INSERT OR IGNORE INTO speaking_versions(id,lesson_id,revision,created_at,data_json) VALUES (?,?,?,?,?)', [next.versionId, id, next.revision, next.updatedAt, JSON.stringify(next)]);
    db.run('UPDATE speaking_lessons SET status=?,updated_at=?,data_json=? WHERE id=?', [status, next.updatedAt, JSON.stringify(next), id]); return next;
  });
}
export async function listResults(actor: Staff, grade?: number, kind?: string, page = 1) {
  const clauses = ["a.status='completed'"], args: unknown[] = [];
  if (actor.role === 'teacher') { clauses.push('l.owner_id=?'); args.push(actor.id); }
  if (grade) { clauses.push("json_extract(a.data_json,'$.lesson.grade')=?"); args.push(grade); }
  if (kind) { clauses.push("json_extract(a.data_json,'$.lesson.kind')=?"); args.push(kind); }
  const resultCte = `WITH results AS (
    SELECT id,lesson_id,status,data_json,student_name,class_name,score,completed_at,0 is_session,1 total_items FROM speaking_attempts WHERE session_id IS NULL
    UNION ALL SELECT id,lesson_id,status,data_json,student_name,class_name,score,completed_at,1 is_session,total_items FROM speaking_sessions
  )`;
  const where = clauses.join(' AND '), total = await queryOne<{ n: number }>(`${resultCte} SELECT COUNT(*) n FROM results a JOIN speaking_lessons l ON l.id=a.lesson_id WHERE ${where}`, args);
  const rows = await queryAll<{ id: string; data_json: string; student_name: string; class_name: string; score: number; completed_at: string; is_session: number; total_items: number }>(`${resultCte} SELECT a.* FROM results a JOIN speaking_lessons l ON l.id=a.lesson_id WHERE ${where} ORDER BY a.completed_at DESC,a.id LIMIT 30 OFFSET ?`, [...args, (page - 1) * 30]);
  const items: ResultSummary[] = rows.map(r => { const d = decode<{ lesson: Lesson }>(r); return { id: r.id, title: d.lesson.title, kind: d.lesson.kind, grade: d.lesson.grade, locale: d.lesson.locale, provider: d.lesson.provider, studentName: r.student_name, className: r.class_name, score: r.score, completedAt: r.completed_at, isSession: r.is_session === 1, totalItems: r.total_items }; });
  return { items, total: total?.n || 0, page, pageSize: 30 };
}
