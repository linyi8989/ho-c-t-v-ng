import React from 'react';
import type { ReviewRow, Result } from '../../shared/competition/types';
import QuestionView from './QuestionView';

export function isCompetitionReview(value: unknown): value is { version: 1; rows: ReviewRow[] } {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return row.version === 1 && Array.isArray(row.rows) && row.rows.every(r => r && typeof r === 'object' && typeof r.studentAnswer === 'string' && typeof r.correctAnswer === 'string' && r.question && typeof r.question.prompt === 'string' && Array.isArray(r.question.options) && Array.isArray(r.question.media));
}
export default function CompetitionReview({ rows, result }: { rows: ReviewRow[]; result?: Result }) {
  return <section className="competition-root competition-review" aria-label="Kết quả IOE/Violympic">
    {result && <header className="competition-card"><h2>{result.title}</h2><p className="competition-score">{result.rawScore}/{result.maxScore} điểm · {result.score}%</p>
      <p>Đúng {result.correctCount} · Sai {result.incorrectCount} · Chưa trả lời {result.unansweredCount}</p></header>}
    {rows.map((r, i) => <div key={r.question.id} className={`competition-review-row ${r.unanswered ? 'is-unanswered' : r.isCorrect ? 'is-correct' : 'is-incorrect'}`}>
      <QuestionView question={r.question} number={i + 1} disabled correctOptionId={r.correctOptionId} answer={r.submittedAnswer || { selectedOptionId: r.question.options.find(o => `${o.label}. ${o.text || '(hình ảnh)'}` === r.studentAnswer)?.id, ...(r.question.interaction === 'text-entry' ? { textAnswer: r.studentAnswer } : {}) }} />
      <div className="competition-feedback"><strong>{r.unanswered ? 'Chưa trả lời' : r.isCorrect ? 'Đúng' : 'Sai'} · {r.pointsAwarded}/10 điểm</strong>
        <p>Em trả lời: <strong>{r.studentAnswer || 'Chưa trả lời'}</strong></p><p>Đáp án đúng: <strong>{r.correctAnswer}</strong></p>
        {r.explanation && <p className="competition-explanation">Giải thích: {r.explanation}</p>}
      </div>
    </div>)}
  </section>;
}
