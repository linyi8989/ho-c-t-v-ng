import crypto from 'node:crypto';
import { SpeakingError, isSetLesson, lessonItems, publicLesson, type AttemptView, type PublicLesson, type SpeakingSessionView } from '../../shared/speaking/types';
import type { SQLiteSynchronousGateway } from '../../lib/storage/storageTypes';
import type { LearningHistoryActor } from '../learning-history/learningHistoryTypes';
import { decode, getLesson, owned, queryOne, transaction, type Staff } from './repository';

export interface SessionRow {
  id: string; owner_key: string; lesson_id: string; version_id: string; status: 'in_progress' | 'completed';
  created_at: string; completed_at: string | null; score: number | null; total_items: number; data_json: string;
}
interface SessionData {
  lesson: PublicLesson; completionAttemptIds?: Record<string, string>; aggregateRubricVersion?: 'set-mean-v1';
  correctCount?: number; incorrectCount?: number; unansweredCount?: number; wrongCount?: number; totalQuestions?: number;
}
interface AttemptRow { id: string; item_id: string; data_json: string; score: number; duration_seconds: number }
export function sanitizedAttempt(raw: unknown): AttemptView {
  const { ownerKey: _owner, audioHash: _hash, audioExpiresAt: expiry, ticket: _ticket, ...view } = raw as AttemptView & { ownerKey?: string; audioHash?: string; audioExpiresAt?: string };
  return { ...view, audioAvailable: Boolean(expiry && expiry > new Date().toISOString()) };
}
export function sessionRow(db: SQLiteSynchronousGateway, id: string, actor?: LearningHistoryActor) {
  const row = db.one<SessionRow>('SELECT * FROM speaking_sessions WHERE id=?', [id]);
  if (!row || actor && row.owner_key !== actor.ownerKey) throw new SpeakingError(404, 'NOT_FOUND', 'Không tìm thấy lượt học của bộ.');
  return row;
}
function latestAttempts(db: SQLiteSynchronousGateway, id: string, completed = false) {
  return db.all<AttemptRow>(`SELECT id,item_id,data_json,score,duration_seconds FROM (
    SELECT *,ROW_NUMBER() OVER (PARTITION BY item_id ORDER BY created_at DESC,rowid DESC) position
    FROM speaking_attempts WHERE session_id=? ${completed ? "AND status='completed'" : ''}
  ) WHERE position=1`, [id]);
}
export function sessionView(db: SQLiteSynchronousGateway, row: SessionRow, view = sanitizedAttempt): SpeakingSessionView {
  const data = decode<SessionData>(row), definitions = lessonItems(data.lesson);
  let latest: AttemptRow[], completed: AttemptRow[];
  if (row.status === 'completed') {
    const ids = Object.values(data.completionAttemptIds || {});
    latest = ids.length ? db.all<AttemptRow>(`SELECT id,item_id,data_json,score,duration_seconds FROM speaking_attempts WHERE session_id=? AND id IN (${ids.map(() => '?').join(',')})`, [row.id, ...ids]) : [];
    completed = latest;
  } else { latest = latestAttempts(db, row.id); completed = latestAttempts(db, row.id, true); }
  const active = new Map(latest.map(a => [a.item_id, a])), grades = new Map(completed.map(a => [a.item_id, a]));
  return { reviewType: 'speaking-session-v1', id: row.id, lesson: data.lesson, status: row.status, createdAt: row.created_at, completedAt: row.completed_at, score: row.score,
    totalItems: definitions.length, completedCount: definitions.filter(i => grades.has(i.id)).length,
    items: definitions.map(item => ({ item, score: grades.get(item.id)?.score ?? null, attempt: active.has(item.id) ? view(decode(active.get(item.id)!)) : null })) };
}
export function updateSessionProgress(db: SQLiteSynchronousGateway, id: string) {
  const row = sessionRow(db, id); if (row.status === 'completed') return;
  const data = decode<SessionData>(row), items = lessonItems(data.lesson), grades = new Map(latestAttempts(db, id, true).map(a => [a.item_id, a]));
  const selected = items.flatMap(item => grades.has(item.id) ? [grades.get(item.id)!] : []);
  if (selected.length !== items.length) { db.run('UPDATE speaking_sessions SET completed_count=? WHERE id=?', [selected.length, id]); return; }
  const words = selected.flatMap(a => decode<AttemptView>(a).assessment?.words || []);
  const completedData: SessionData = { ...data, aggregateRubricVersion: 'set-mean-v1', completionAttemptIds: Object.fromEntries(selected.map(a => [a.item_id, a.id])),
    correctCount: words.filter(w => w.error === 'none').length, incorrectCount: words.filter(w => w.error === 'mispronunciation').length,
    unansweredCount: words.filter(w => w.error === 'omission').length, wrongCount: words.filter(w => w.error !== 'none').length, totalQuestions: words.filter(w => w.referenceIndex !== null).length };
  const score = Math.round(selected.reduce((sum, a) => sum + a.score, 0) / items.length * 10) / 10;
  db.run("UPDATE speaking_sessions SET status='completed',completed_count=?,score=?,completed_at=?,duration_seconds=?,data_json=? WHERE id=? AND status='in_progress'", [items.length, score, new Date().toISOString(), selected.reduce((sum, a) => sum + a.duration_seconds, 0), JSON.stringify(completedData), id]);
}

export async function prepareSession(actor: LearningHistoryActor, studentName: string, lessonId: string, clientRunId: string, context: { classId?: string; className?: string }, selection?: { sourceSessionId?: string; itemIds?: unknown }) {
  if (!/^[A-Za-z0-9._:-]{8,160}$/.test(clientRunId)) throw new SpeakingError(400, 'INVALID_RUN', 'Mã lượt học không hợp lệ.');
  const lesson = await getLesson(lessonId); if (!lesson || lesson.status !== 'published' || !isSetLesson(lesson)) throw new SpeakingError(404, 'NOT_FOUND', 'Không tìm thấy bộ luyện đọc đã xuất bản.');
  return transaction(db => {
    const source = selection?.sourceSessionId ? sessionRow(db, selection.sourceSessionId, actor) : undefined;
    if (source && source.lesson_id !== lessonId) throw new SpeakingError(400, 'INVALID_SESSION', 'Lượt học nguồn thuộc bộ khác.');
    const frozen = source ? decode<SessionData>(source).lesson : publicLesson(lesson);
    let items = lessonItems(frozen);
    if (selection?.itemIds !== undefined) {
      const ids = selection.itemIds;
      if (!Array.isArray(ids) || !ids.length || ids.length > items.length || ids.some(id => typeof id !== 'string' || !items.some(item => item.id === id)) || new Set(ids).size !== ids.length) throw new SpeakingError(400, 'INVALID_ITEMS', 'Chọn các mục hợp lệ trong bộ nguồn.');
      items = items.filter(item => ids.includes(item.id));
    }
    const snapshot = { ...frozen, items, referenceText: items[0].referenceText, sampleAudioUrl: items[0].sampleAudioUrl, samplePlaybackRate: items[0].samplePlaybackRate };
    const existing = db.one<SessionRow>('SELECT * FROM speaking_sessions WHERE owner_key=? AND client_run_id=?', [actor.ownerKey, clientRunId]);
    if (existing) {
      const saved = decode<SessionData>(existing).lesson;
      if (existing.lesson_id !== lessonId || saved.versionId !== snapshot.versionId || JSON.stringify(saved.items?.map(i => i.id)) !== JSON.stringify(items.map(i => i.id))) throw new SpeakingError(409, 'RUN_CONFLICT', 'Mã lượt học đã dùng cho bộ hoặc danh sách khác.');
      return sessionView(db, existing);
    }
    const active = db.one<{ n: number }>("SELECT COUNT(*) n FROM speaking_sessions WHERE owner_key=? AND status='in_progress'", [actor.ownerKey]);
    if ((active?.n || 0) >= 10) throw new SpeakingError(429, 'SESSION_LIMIT', 'Hãy hoàn thành các bộ đang học trước khi mở lượt mới.');
    const id = crypto.randomUUID(), now = new Date().toISOString();
    db.run("INSERT INTO speaking_sessions(id,owner_key,lesson_id,version_id,client_run_id,status,student_name,user_id,guest_id,class_id,class_name,total_items,created_at,data_json) VALUES (?,?,?,?,?,'in_progress',?,?,?,?,?,?,?,?)", [id, actor.ownerKey, lessonId, snapshot.versionId, clientRunId, studentName, actor.kind === 'user' ? actor.id : null, actor.kind === 'guest' ? actor.id : null, context.classId || null, context.className || '', items.length, now, JSON.stringify({ lesson: snapshot })]);
    return sessionView(db, sessionRow(db, id, actor));
  });
}
export async function readSession(actor: LearningHistoryActor, id: string, view = sanitizedAttempt, staff?: Staff) {
  if (staff) {
    const row = await queryOne<SessionRow>('SELECT * FROM speaking_sessions WHERE id=?', [id]);
    if (!row) throw new SpeakingError(404, 'NOT_FOUND', 'Không tìm thấy lượt học của bộ.');
    owned(await getLesson(row.lesson_id), staff);
  }
  return transaction(db => sessionView(db, sessionRow(db, id, staff ? undefined : actor), view));
}
