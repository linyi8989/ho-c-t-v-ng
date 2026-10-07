import crypto from 'node:crypto';
import type { SQLiteSynchronousGateway } from '../../lib/storage/storageTypes';
import { CompetitionError } from '../../shared/competition/import';
import { SUBJECT_LABELS, LEVEL_LABELS, type MistakeTopic, type PracticeReport, type Question, type Paper, type Scope, type ReviewRow } from '../../shared/competition/types';
import { bankScope, registerMedia, transaction } from './repository';
import { shuffle } from './selection';

export function mistakeScope(id: string): Scope | undefined {
  return id.startsWith('mistakes-') ? bankScope(`bank-${id.slice('mistakes-'.length)}`) : undefined;
}
const topicId = (scope: Scope) => `mistakes-${scope.subject}-${scope.grade}-${scope.level}`;
const sameScope = (a: Scope, b: Scope) => a.subject === b.subject && a.grade === b.grade && a.level === b.level;

// Read the student's existing server-owned History; never accept a client list
// of mistakes or answer keys. Completion insertion order also handles timed-out
// attempts whose completed_at is backdated to their deadline.
function pendingQuestions(db: SQLiteSynchronousGateway, ownerKey: string) {
  const pending = new Map<string, Question>();
  let cursor = 0, completedCount = 0, lastScore: number | null = null;
  for (;;) {
    const batch = db.all<{ sequence: number; data_json: string; detail_json: string }>(`SELECT d.rowid AS sequence,a.data_json,d.data_json AS detail_json
      FROM competition_attempts a JOIN competition_attempt_details d ON d.attempt_id=a.id
      WHERE a.owner_key=? AND a.status='completed' AND d.rowid>? ORDER BY d.rowid LIMIT 100`, [ownerKey, cursor]);
    if (!batch.length) break;
    for (const record of batch) {
      const attempt = JSON.parse(record.data_json) as { questions: Question[]; result: { score: number } };
      const detail = JSON.parse(record.detail_json) as { rows: ReviewRow[] };
      const questions = new Map(attempt.questions.map(q => [q.id, q]));
      for (const row of detail.rows) {
        if (row.unanswered) continue;
        if (row.isCorrect) pending.delete(row.question.id);
        else {
          const snapshot = questions.get(row.question.id);
          if (snapshot) pending.set(snapshot.id, snapshot);
        }
      }
      completedCount++; lastScore = attempt.result.score; cursor = record.sequence;
    }
  }
  return { questions: [...pending.values()], completedCount, lastScore };
}
function topic(scope: Scope, questions: Question[]): MistakeTopic {
  return { subject: scope.subject, grade: scope.grade, level: scope.level, id: topicId(scope), title: `Luyện câu sai · ${SUBJECT_LABELS[scope.subject]} · Lớp ${scope.grade} · ${LEVEL_LABELS[scope.level]}`,
    source: 'mistakes', visibility: 'assignment', available: questions.length, ready: questions.length > 0,
    total: Math.min(10, questions.length), durationMinutes: 30, previews: questions.slice(0, 3).map(q => ({ id: q.id, prompt: q.prompt.slice(0, 200) })) };
}
export async function getPracticeReport(ownerKey: string): Promise<PracticeReport> {
  return transaction(db => {
    const { questions, completedCount, lastScore } = pendingQuestions(db, ownerKey);
    const groups = new Map<string, Question[]>();
    questions.forEach(q => { const id = topicId(q); groups.set(id, [...(groups.get(id) || []), q]); });
    return { pendingCount: questions.length, completedCount, lastScore,
      topics: [...groups.values()].map(qs => topic(qs[0], qs)).sort((a, b) => a.subject.localeCompare(b.subject) || a.grade - b.grade || a.level.localeCompare(b.level)) };
  });
}
export async function getMistakeTopic(ownerKey: string, scope: Scope) {
  return transaction(db => topic(scope, pendingQuestions(db, ownerKey).questions.filter(q => sameScope(q, scope))));
}
// Called in prepare's existing transaction after owner/clientRunId retry checks.
export function snapshotMistakes(db: SQLiteSynchronousGateway, ownerKey: string, scope: Scope, now: string) {
  const pending = pendingQuestions(db, ownerKey).questions.filter(q => sameScope(q, scope));
  if (!pending.length) throw new CompetitionError(409, 'PRACTICE_EMPTY', 'Không còn câu sai trong nhóm này. Hãy quay lại Luyện tập để cập nhật.');
  const questions = shuffle(pending).slice(0, 10), info = topic(scope, pending);
  const paper: Paper = { ...scope, id: info.id, title: info.title, source: 'mistakes', ownerId: 'competition-private-practice', versionId: crypto.randomUUID(),
    visibility: 'assignment', status: 'published', total: questions.length, durationMinutes: 30, createdAt: now,
    blueprint: { ...scope, total: questions.length, durationMinutes: 30, domains: {}, difficulties: {} }, relaxed: false, warnings: [] };
  db.run('INSERT OR IGNORE INTO competition_papers(id,owner_id,subject,grade,level,status,visibility,created_at,updated_at,data_json) VALUES (?,?,?,?,?,?,?,?,?,?)',
    [paper.id, paper.ownerId, scope.subject, scope.grade, scope.level, paper.status, paper.visibility, now, now, JSON.stringify(paper)]);
  db.run('INSERT INTO competition_paper_versions(id,paper_id,created_at,data_json) VALUES (?,?,?,?)', [paper.versionId, paper.id, now, JSON.stringify({ paper, questions })]);
  registerMedia(db, paper.versionId, 'paper-version', questions, now);
  return { paper, questions };
}
