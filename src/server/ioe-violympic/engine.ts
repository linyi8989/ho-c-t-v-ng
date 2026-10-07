import crypto from 'node:crypto';
import { mistakeScope, snapshotMistakes } from './practice';
import type { SQLiteSynchronousGateway } from '../../lib/storage/storageTypes';
import type { LearningHistoryActor } from '../learning-history/learningHistoryTypes';
import type { AssessmentUserAnswer, AnswerSpec } from '../../shared/competition/answer';
import { CompetitionError, record, text } from '../../shared/competition/import';
import { playable, type AttemptSession, type Paper, type Question, type Result, type ReviewRow } from '../../shared/competition/types';
import { bankScope, decode, queryAll, shuffledSnapshot, snapshotBank, transaction } from './repository';
import { graderRegistry } from './graderRegistry';

export interface AttemptContext { classId?: string; className?: string; assignmentId?: string; assignmentTitle?: string; assignmentDueAt?: string }
interface StoredAttempt extends AttemptContext {
  id: string; ownerKey: string; studentName: string; userId: string | null; guestId: string | null;
  paper: Paper; questions: Question[]; answers: Record<string, AssessmentUserAnswer>; status: AttemptSession['status'];
  revision: number; createdAt: string; startedAt: string | null; deadline: string | null; result?: Result;
}
function answerLabel(q: Question, spec: AnswerSpec): string {
  const option = (id: string) => { const o = q.options.find(o => o.id === id); return o ? `${o.label}. ${o.text || '(hình ảnh)'}` : ''; };
  switch (spec.kind) {
    case 'single-choice': return option(spec.correctOptionId);
    case 'text': return spec.acceptedAnswers.join(' / ');
    case 'integer': case 'decimal': return spec.value;
    case 'fraction': return `${spec.numerator}/${spec.denominator}`;
    case 'numeric-with-unit': return `${spec.value} ${spec.acceptedUnits.join(' / ')}`;
    case 'ordering': return spec.orderedTokenIds.map(option).join(' → ');
    case 'matching': return Object.entries(spec.correctPairMatches).map(([l, r]) => `${q.pairs?.left.find(o => o.id === l)?.text || ''} → ${q.pairs?.right.find(o => o.id === r)?.text || ''}`).join('; ');
    case 'true-false': return spec.correctValue ? 'Đúng' : 'Sai';
    case 'hotspot': return spec.correctRegionId;
  }
}
function userLabel(q: Question, answer: AssessmentUserAnswer): string {
  if (answer.selectedOptionId) return answerLabel(q, { kind: 'single-choice', correctOptionId: answer.selectedOptionId });
  if (answer.orderedTokenIds) return answerLabel(q, { kind: 'ordering', orderedTokenIds: answer.orderedTokenIds });
  if (answer.pairMatches) return answerLabel(q, { kind: 'matching', correctPairMatches: answer.pairMatches });
  return answer.textAnswer || '';
}
function validateAnswers(value: unknown, questions: Question[]): Record<string, AssessmentUserAnswer> {
  const input = record(value), output: Record<string, AssessmentUserAnswer> = {};
  if (Object.keys(input).length > questions.length) throw new CompetitionError(400, 'INVALID_ANSWERS', 'Số câu trả lời không hợp lệ.');
  for (const [id, raw] of Object.entries(input)) {
    const q = questions.find(q => q.id === id);
    if (!q) throw new CompetitionError(400, 'INVALID_ANSWERS', 'Có câu trả lời không thuộc bài thi.');
    const answer = record(raw);
    const keys = Object.keys(answer);
    const expected = q.interaction === 'choice' ? 'selectedOptionId' : q.interaction === 'ordering' ? 'orderedTokenIds' : q.interaction === 'matching' ? 'pairMatches' : 'textAnswer';
    if (keys.some(k => k !== expected)) throw new CompetitionError(400, 'INVALID_ANSWERS', 'Dạng câu trả lời không hợp lệ.');
    if (answer[expected] === undefined) { output[id] = {}; continue; }
    if (expected === 'selectedOptionId') {
      const selected = text(answer.selectedOptionId, 160);
      if (selected && !q.options.some(o => o.id === selected)) throw new CompetitionError(400, 'INVALID_ANSWERS', 'Phương án không thuộc câu hỏi.');
      output[id] = { selectedOptionId: selected };
    } else if (expected === 'orderedTokenIds') {
      const ids = answer.orderedTokenIds;
      if (!Array.isArray(ids) || ids.length > q.options.length || ids.some(id => typeof id !== 'string' || !q.options.some(o => o.id === id)) || new Set(ids).size !== ids.length) throw new CompetitionError(400, 'INVALID_ANSWERS', 'Thứ tự thẻ không hợp lệ.');
      output[id] = { orderedTokenIds: ids };
    } else if (expected === 'pairMatches') {
      const pairs = record(answer.pairMatches), entries = Object.entries(pairs);
      if (entries.length > (q.pairs?.left.length || 0) || entries.some(([l, r]) => typeof r !== 'string' || !q.pairs?.left.some(o => o.id === l) || !q.pairs?.right.some(o => o.id === r)) || new Set(Object.values(pairs)).size !== entries.length) throw new CompetitionError(400, 'INVALID_ANSWERS', 'Cặp nối không hợp lệ.');
      output[id] = { pairMatches: Object.fromEntries(entries.map(([l, r]) => [l, String(r)])) };
    } else output[id] = { textAnswer: text(answer.textAnswer, 2000) };
  }
  return output;
}
export function createCompetitionEngine(secret: string, clock: () => number = Date.now) {
  if (secret.length < 24) throw new Error('Competition ticket requires the configured B signing secret.');
  const nowIso = () => new Date(clock()).toISOString();
  const ticket = (a: StoredAttempt) => {
    const payload = Buffer.from(JSON.stringify({ id: a.id, owner: crypto.createHash('sha256').update(a.ownerKey).digest('hex'), version: a.paper.versionId, v: 1 })).toString('base64url');
    return `${payload}.${crypto.createHmac('sha256', secret).update(payload).digest('base64url')}`;
  };
  const verify = (value: string, a: StoredAttempt) => {
    if (typeof value !== 'string' || value.length > 1000) return false;
    const actual = Buffer.from(value), expected = Buffer.from(ticket(a));
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  };
  const load = (db: SQLiteSynchronousGateway, id: string, actor: LearningHistoryActor, signed: string) => {
    const row = db.one<{ data_json: string }>('SELECT data_json FROM competition_attempts WHERE id=? AND owner_key=?', [id, actor.ownerKey]);
    const a = row ? decode<StoredAttempt>(row) : undefined;
    if (!a || !verify(signed, a)) throw new CompetitionError(404, 'ATTEMPT_NOT_FOUND', 'Không tìm thấy lượt làm bài.');
    return a;
  };
  const session = (a: StoredAttempt): AttemptSession => ({ id: a.id, ticket: ticket(a), status: a.status, title: a.paper.title,
    questions: a.questions.map((q, i) => ({ ...playable(q), title: q.title.replace(/^\s*(?:Câu(?:\s+hỏi)?|Question)\s*\d+\s*[:.)-]?\s*/iu, '').trim() || `Câu ${i + 1}` })),
    answers: a.answers, revision: a.revision, deadline: a.deadline, serverNow: nowIso(), durationMinutes: a.paper.durationMinutes, ...(a.paper.source ? { source: a.paper.source } : {}), ...(a.result ? { result: a.result } : {}) });
  const persist = (db: SQLiteSynchronousGateway, a: StoredAttempt) => {
    const r = a.result;
    db.run(`UPDATE competition_attempts SET status=?,revision=?,updated_at=?,started_at=?,deadline=?,completed_at=?,score=?,raw_score=?,
      correct_count=?,incorrect_count=?,unanswered_count=?,duration_seconds=?,data_json=? WHERE id=?`,
    [a.status, a.revision, nowIso(), a.startedAt, a.deadline, r?.completedAt || null, r?.score || 0, r?.rawScore || 0, r?.correctCount || 0, r?.incorrectCount || 0, r?.unansweredCount || 0, r?.durationSeconds || 0, JSON.stringify(a), a.id]);
  };
  const finish = (db: SQLiteSynchronousGateway, a: StoredAttempt) => {
    if (a.status === 'completed') return a;
    if (a.status !== 'active' || !a.startedAt || !a.deadline) throw new CompetitionError(409, 'ATTEMPT_NOT_ACTIVE', 'Lượt làm chưa bắt đầu.');
    const completedAt = new Date(Math.min(clock(), Date.parse(a.deadline))).toISOString();
    const rows: ReviewRow[] = a.questions.map(q => {
      const answer = a.answers[q.id] || {}, grade = graderRegistry.grade(q.answerSpec, answer);
      return { question: playable(q), studentAnswer: userLabel(q, answer), correctAnswer: answerLabel(q, q.answerSpec), submittedAnswer: answer,
        ...(q.answerSpec.kind === 'single-choice' ? { correctOptionId: q.answerSpec.correctOptionId } : {}),
        isCorrect: grade.isCorrect, unanswered: grade.errorCode === 'UNANSWERED', pointsAwarded: grade.scoreRatio * 10, explanation: q.explanation };
    });
    const rawScore = rows.reduce((n, q) => n + q.pointsAwarded, 0), maxScore = rows.length * 10;
    const result: Result = { id: a.id, title: a.paper.title, score: Math.round(rawScore / maxScore * 10000) / 100, rawScore, maxScore,
      correctCount: rows.filter(q => q.isCorrect).length, unansweredCount: rows.filter(q => q.unanswered).length,
      incorrectCount: rows.filter(q => !q.isCorrect && !q.unanswered).length, durationSeconds: Math.max(0, Math.round((Date.parse(completedAt) - Date.parse(a.startedAt)) / 1000)), completedAt };
    a = { ...a, status: 'completed', revision: a.revision + 1, result };
    persist(db, a);
    const answerDetails = rows.map((row, i) => ({ questionId: row.question.id, questionText: `Câu ${i + 1}. ${row.question.prompt}`, options: row.question.options,
      studentAnswer: row.studentAnswer, correctAnswer: row.correctAnswer, isCorrect: row.isCorrect, explanation: row.explanation }));
    const detail = { rows, answerDetails, extraDetails: { competitionReview: { version: 1, rows } }, reviewPolicy: { showReviewAfterSubmit: true, policyVersion: 1 } };
    db.run('INSERT INTO competition_attempt_details(attempt_id,created_at,updated_at,data_json) VALUES (?,?,?,?) ON CONFLICT(attempt_id) DO NOTHING', [a.id, completedAt, completedAt, JSON.stringify(detail)]);
    return a;
  };
  const expire = (db: SQLiteSynchronousGateway, a: StoredAttempt) => a.status === 'active' && a.deadline && clock() >= Date.parse(a.deadline) ? finish(db, a) : a;
  const prepare = async (actor: LearningHistoryActor, studentName: string, paperId: string, clientRunId: string, context: AttemptContext = {}) => transaction(db => {
    const existing = db.one<{ data_json: string }>('SELECT data_json FROM competition_attempts WHERE owner_key=? AND client_run_id=?', [actor.ownerKey, clientRunId]);
    if (existing) {
      const a = decode<StoredAttempt>(existing);
      if (a.paper.id !== paperId || (a.assignmentId || '') !== (context.assignmentId || '')) throw new CompetitionError(409, 'RUN_CONFLICT', 'Mã lượt làm đã dùng cho bài khác.');
      return session(expire(db, a));
    }
    const id = crypto.randomUUID(), createdAt = nowIso();
    const scope = bankScope(paperId), mistakes = mistakeScope(paperId);
    let paper: Paper, questions: Question[];
    if (mistakes) {
      if (Object.keys(context).length) throw new CompetitionError(400, 'INVALID_CONTEXT', 'Luyện câu sai thuộc lịch sử riêng của học sinh.');
      ({ paper, questions } = snapshotMistakes(db, actor.ownerKey, mistakes, createdAt));
    } else if (scope) {
      if (Object.keys(context).length) throw new CompetitionError(400, 'INVALID_CONTEXT', 'Luyện từ ngân hàng không dùng link giao đề cố định.');
      ({ paper, questions } = snapshotBank(db, scope, createdAt));
    } else {
      const row = db.one<{ data_json: string }>('SELECT data_json FROM competition_papers WHERE id=? AND status=\'published\'', [paperId]);
      if (!row) throw new CompetitionError(404, 'PAPER_NOT_FOUND', 'Không tìm thấy đề.');
      paper = decode<Paper>(row);
      const versionRow = db.one<{ data_json: string }>('SELECT data_json FROM competition_paper_versions WHERE id=? AND paper_id=?', [paper.versionId, paper.id]);
      if (!versionRow) throw new CompetitionError(409, 'PAPER_VERSION_MISSING', 'Đề chưa có bản phát hành.');
      ({ questions } = decode<{ questions: Question[] }>(versionRow));
    }
    const a: StoredAttempt = { ...context, id, ownerKey: actor.ownerKey, studentName, userId: actor.kind === 'user' ? actor.id : null, guestId: actor.kind === 'guest' ? actor.id : null,
      paper, questions: shuffledSnapshot(questions), answers: {}, status: 'prepared', revision: 0, createdAt, startedAt: null, deadline: null };
    db.run(`INSERT INTO competition_attempts(id,owner_key,paper_id,version_id,client_run_id,status,revision,student_name,user_id,guest_id,class_id,assignment_id,created_at,updated_at,max_score,data_json)
      VALUES (?,?,?,?,?,'prepared',0,?,?,?,?,?,?,?,?,?)`, [id, actor.ownerKey, paper.id, paper.versionId, clientRunId, studentName, a.userId, a.guestId, context.classId || null, context.assignmentId || null, createdAt, createdAt, a.questions.length * 10, JSON.stringify(a)]);
    return session(a);
  });
  const activate = async (actor: LearningHistoryActor, id: string, signed: string) => transaction(db => {
    let a = expire(db, load(db, id, actor, signed));
    if (a.status !== 'prepared') return session(a);
    if (clock() - Date.parse(a.createdAt) > 24 * 60 * 60 * 1000) throw new CompetitionError(409, 'PREPARATION_EXPIRED', 'Lượt chuẩn bị đã hết hạn. Hãy tạo lượt mới.');
    a = { ...a, status: 'active', revision: a.revision + 1, startedAt: nowIso(), deadline: new Date(clock() + a.paper.durationMinutes * 60000).toISOString() }; persist(db, a); return session(a);
  });
  const write = async (actor: LearningHistoryActor, id: string, signed: string, expectedRevision: number, answers: unknown, submit: boolean) => transaction(db => {
    let a = expire(db, load(db, id, actor, signed));
    if (a.status === 'completed') return session(a);
    if (a.status !== 'active') throw new CompetitionError(409, 'ATTEMPT_NOT_ACTIVE', 'Lượt làm chưa bắt đầu.');
    const normalized = validateAnswers(answers, a.questions);
    if (a.revision !== expectedRevision) {
      if (!submit && JSON.stringify(normalized) === JSON.stringify(a.answers)) return session(a);
      throw new CompetitionError(409, 'REVISION_CONFLICT', 'Có phiên làm bài mới hơn. Tải lại để đồng bộ câu trả lời.');
    }
    a = { ...a, answers: normalized, revision: a.revision + 1 }; persist(db, a);
    if (submit) a = finish(db, a);
    return session(a);
  });
  const resume = async (actor: LearningHistoryActor, id: string, signed: string) => transaction(db => session(expire(db, load(db, id, actor, signed))));
  const review = async (actor: LearningHistoryActor, id: string, signed: string) => transaction(db => {
    const a = expire(db, load(db, id, actor, signed));
    if (a.status !== 'completed') throw new CompetitionError(409, 'REVIEW_NOT_READY', 'Chỉ xem lời giải sau khi nộp bài.');
    const row = db.one<{ data_json: string }>('SELECT data_json FROM competition_attempt_details WHERE attempt_id=?', [id]);
    if (!row) throw new CompetitionError(404, 'DETAIL_NOT_FOUND', 'Không tìm thấy lời giải.');
    return { result: a.result, ...decode<{ rows: ReviewRow[] }>(row) };
  });
  const finalizeExpired = async () => {
    const rows = await queryAll<{ id: string }>("SELECT id FROM competition_attempts WHERE status='active' AND deadline<=? ORDER BY deadline LIMIT 100", [nowIso()]);
    for (const row of rows) await transaction(db => {
      const current = db.one<{ data_json: string }>('SELECT data_json FROM competition_attempts WHERE id=?', [row.id]);
      if (current) expire(db, decode<StoredAttempt>(current));
    });
    return rows.length;
  };
  return { prepare, activate, save: (actor: LearningHistoryActor, id: string, signed: string, revision: number, answers: unknown) => write(actor, id, signed, revision, answers, false),
    submit: (actor: LearningHistoryActor, id: string, signed: string, revision: number, answers: unknown) => write(actor, id, signed, revision, answers, true), resume, review, finalizeExpired };
}
