import { playable, type ReviewRow } from './types';

/** Move explicitly marked teacher warnings out of student explanations, including older JSON. */
export function splitTeacherFeedback(explanation: string, teacherNote = '') {
  const studentLines: string[] = [], noteLines: string[] = [];
  let inNote = false;
  for (const line of explanation.replace(/\r\n?/g, '\n').split('\n')) {
    const marker = /(?:^\s*(?:\d+[.)]\s*)?|\s+)Cần giáo viên kiểm tra(?=\s|[:：.…]|$)/iu.exec(line);
    if (marker) {
      const prefix = line.slice(0, marker.index).trimEnd();
      if (prefix.trim()) studentLines.push(prefix);
      noteLines.push(line.slice(marker.index).trim().replace(/^\d+[.)]\s*/, ''));
      inNote = true;
    } else if (inNote && !/^\s*\d+[.)]\s+\S/u.test(line)) {
      noteLines.push(line);
    } else {
      studentLines.push(line);
      inNote = false;
    }
  }
  const notes = [teacherNote.trim(), noteLines.join('\n').trim()].filter(Boolean);
  return { explanation: studentLines.join('\n').trim(), teacherNote: [...new Set(notes)].join('\n') };
}

/** Allowlist review fields and strip legacy warnings before any student response. */
export function studentReviewRows(rows: readonly ReviewRow[]): ReviewRow[] {
  return rows.map(row => ({
    question: playable(row.question), studentAnswer: row.studentAnswer, correctAnswer: row.correctAnswer,
    ...(row.submittedAnswer ? { submittedAnswer: row.submittedAnswer } : {}),
    ...(row.correctOptionId ? { correctOptionId: row.correctOptionId } : {}),
    isCorrect: row.isCorrect, unanswered: row.unanswered, pointsAwarded: row.pointsAwarded,
    explanation: splitTeacherFeedback(row.explanation || '').explanation,
  }));
}

export function competitionReviewDetail(input: readonly ReviewRow[]) {
  const rows = studentReviewRows(input);
  const answerDetails = rows.map((row, i) => ({ questionId: row.question.id, questionText: `Câu ${i + 1}. ${row.question.prompt}`, options: row.question.options,
    studentAnswer: row.studentAnswer, correctAnswer: row.correctAnswer, isCorrect: row.isCorrect, explanation: row.explanation }));
  return { rows, answerDetails, extraDetails: { competitionReview: { version: 1, rows } } };
}
