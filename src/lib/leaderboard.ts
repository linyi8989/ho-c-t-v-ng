import { Assignment, GameSession, VocabSet } from '../types';

export type LeaderboardPeriod = 'week' | 'month';
export type LeaderboardCategory = 'gold' | 'diligent' | 'accurate' | 'improved';

export interface LeaderboardFilters {
  period: LeaderboardPeriod;
  classId?: string;
  vocabSetId?: string;
}

export interface LeaderboardEntry {
  studentKey?: string;
  studentName: string;
  classId?: string;
  completedLessons: number;
  correctAnswers: number;
  incorrectAnswers: number;
  totalQuestions: number;
  averageAccuracy: number;
  studyDays: number;
  honorScore: number;
  improvementPoints: number;
  badges: string[];
  className?: string;
  isNewcomer?: boolean;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function normalizeStudentName(name: string) {
  return (name || 'Học sinh').trim().toLowerCase();
}

function getStudentIdentity(session: GameSession) {
  const source = session as any;
  if (source.publicStudentKey) return String(source.publicStudentKey);
  if (source.studentKey) return String(source.studentKey);
  if (source.userId) return `user:${source.userId}`;
  if (source.ownerKey) return source.ownerKey;
  if (source.guestId) return `guest:${source.guestId}`;
  if (source.studentId) return `student:${source.studentId}`;
  return `name:${normalizeStudentName(session.studentName)}`;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getPeriodStart(period: LeaderboardPeriod, now = new Date()) {
  if (period === 'month') {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const today = startOfDay(now);
  const day = today.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return new Date(today.getTime() + mondayOffset * MS_PER_DAY);
}

function getPreviousPeriodStart(period: LeaderboardPeriod, periodStart: Date) {
  if (period === 'month') {
    return new Date(periodStart.getFullYear(), periodStart.getMonth() - 1, 1);
  }
  return new Date(periodStart.getTime() - 7 * MS_PER_DAY);
}

function getPreviousPeriodEnd(period: LeaderboardPeriod, periodStart: Date) {
  if (period === 'month') {
    return new Date(periodStart.getTime() - 1);
  }
  return new Date(periodStart.getTime() - 1);
}

function sessionCompletedAt(session: GameSession) {
  return session.completedAt ? new Date(session.completedAt) : null;
}

function getSessionClassId(session: GameSession, assignments: Assignment[]) {
  if (session.classId) return session.classId;
  if (!session.assignmentId) return '';
  return assignments.find(assign => assign.id === session.assignmentId)?.classId || '';
}

function getSessionClassName(session: GameSession, assignments: Assignment[]) {
  if (session.className) return session.className;
  if (!session.assignmentId) return '';
  return assignments.find(assign => assign.id === session.assignmentId)?.className || '';
}

function getLeaderboardStudentKey(session: GameSession, assignments: Assignment[]) {
  const classId = getSessionClassId(session, assignments);
  return [getStudentIdentity(session), classId || 'no-class'].join('|');
}

function isBetterSession(candidate: GameSession, current: GameSession | undefined) {
  if (!current) return true;
  const candidateTotal = Math.max(1, candidate.correctAnswers + candidate.incorrectAnswers || candidate.totalQuestions || 0);
  const currentTotal = Math.max(1, current.correctAnswers + current.incorrectAnswers || current.totalQuestions || 0);
  const candidateAccuracy = candidate.correctAnswers / candidateTotal;
  const currentAccuracy = current.correctAnswers / currentTotal;

  if (candidateAccuracy !== currentAccuracy) return candidateAccuracy > currentAccuracy;
  if ((candidate.score || 0) !== (current.score || 0)) return (candidate.score || 0) > (current.score || 0);
  return (sessionCompletedAt(candidate)?.getTime() || 0) > (sessionCompletedAt(current)?.getTime() || 0);
}

function getBestSessions(
  sessions: GameSession[],
  assignments: Assignment[],
  filters: LeaderboardFilters,
  rangeStart: Date,
  rangeEnd?: Date
) {
  const bestByKey = new Map<string, GameSession>();

  for (const session of sessions) {
    const completedAt = sessionCompletedAt(session);
    if (!completedAt) continue;
    if (completedAt < rangeStart) continue;
    if (rangeEnd && completedAt > rangeEnd) continue;
    if (filters.vocabSetId && session.vocabSetId !== filters.vocabSetId) continue;
    if (filters.classId && getSessionClassId(session, assignments) !== filters.classId) continue;

    const key = [
      getStudentIdentity(session),
      getSessionClassId(session, assignments) || 'no-class',
      session.vocabSetId || 'unknown-set',
      session.gameId || 'unknown-game'
    ].join('|');

    if (isBetterSession(session, bestByKey.get(key))) {
      bestByKey.set(key, session);
    }
  }

  return [...bestByKey.values()];
}

function summarizeSessions(bestSessions: GameSession[], assignments: Assignment[]) {
  const byStudent = new Map<string, LeaderboardEntry>();

  for (const session of bestSessions) {
    const key = getLeaderboardStudentKey(session, assignments);
    const classId = getSessionClassId(session, assignments);
    const completedAt = sessionCompletedAt(session);
    const entry = byStudent.get(key) || {
      studentName: session.studentName || 'Học sinh',
      classId,
      completedLessons: 0,
      correctAnswers: 0,
      incorrectAnswers: 0,
      totalQuestions: 0,
      averageAccuracy: 0,
      studyDays: 0,
      honorScore: 0,
      improvementPoints: 0,
      badges: [],
      className: getSessionClassName(session, assignments)
    };

    entry.studentKey = key;
    entry.completedLessons += 1;
    entry.correctAnswers += session.correctAnswers || 0;
    entry.incorrectAnswers += session.incorrectAnswers || 0;
    entry.totalQuestions += session.totalQuestions || session.correctAnswers + session.incorrectAnswers || 0;
    if (!entry.className) entry.className = getSessionClassName(session, assignments);

    const dayKey = completedAt?.toISOString().slice(0, 10);
    const days = new Set((entry as any)._days || []);
    if (dayKey) days.add(dayKey);
    (entry as any)._days = days;

    byStudent.set(key, entry);
  }

  return [...byStudent.values()].map(entry => {
    entry.studyDays = ((entry as any)._days as Set<string> | undefined)?.size || 0;
    entry.averageAccuracy = entry.totalQuestions > 0
      ? Math.round((entry.correctAnswers / entry.totalQuestions) * 100)
      : 0;
    delete (entry as any)._days;
    return entry;
  });
}

function assignBadges(entry: LeaderboardEntry) {
  const badges: string[] = [];
  if (entry.studyDays >= 5) badges.push('Học đều mỗi ngày');
  if (entry.studyDays >= 3) badges.push('Ngôi sao chăm chỉ');
  if (entry.averageAccuracy >= 90 && (entry.completedLessons >= 3 || entry.totalQuestions >= 60)) badges.push('Trả lời siêu chuẩn');
  if (entry.improvementPoints >= 30) badges.push('Tiến bộ vượt bậc');
  if (entry.honorScore >= 500) badges.push('Bậc thầy từ vựng');
  return badges.length ? badges : ['Đang tỏa sáng'];
}

export function buildLeaderboard(
  sessions: GameSession[],
  assignments: Assignment[],
  filters: LeaderboardFilters
) {
  const periodStart = getPeriodStart(filters.period);
  const previousStart = getPreviousPeriodStart(filters.period, periodStart);
  const previousEnd = getPreviousPeriodEnd(filters.period, periodStart);

  const currentBest = getBestSessions(sessions, assignments, filters, periodStart);
  const previousBest = getBestSessions(sessions, assignments, filters, previousStart, previousEnd);

  const currentSummary = summarizeSessions(currentBest, assignments);
  const previousSummary = summarizeSessions(previousBest, assignments);
  const previousByStudent = new Map(previousSummary.map(entry => [entry.studentKey || normalizeStudentName(entry.studentName), entry]));

  const entries = currentSummary.map(entry => {
    const previous = previousByStudent.get(entry.studentKey || normalizeStudentName(entry.studentName));
    const baseScore = entry.completedLessons * 50 + entry.averageAccuracy * 3 + entry.studyDays * 20;
    const previousBaseScore = previous
      ? previous.completedLessons * 50 + previous.averageAccuracy * 3 + previous.studyDays * 20
      : 0;
    entry.isNewcomer = !previous;
    entry.improvementPoints = previous ? Math.max(0, Math.round(baseScore - previousBaseScore)) : 0;
    entry.honorScore = Math.round(baseScore + entry.improvementPoints);
    entry.badges = assignBadges(entry);
    return entry;
  });

  const gold = [...entries].sort((a, b) => b.honorScore - a.honorScore || b.averageAccuracy - a.averageAccuracy);
  const diligent = [...entries].sort((a, b) => b.studyDays - a.studyDays || b.completedLessons - a.completedLessons || b.honorScore - a.honorScore);
  const accurate = [...entries]
    .filter(entry => entry.completedLessons >= 3 || entry.totalQuestions >= 60)
    .sort((a, b) => b.averageAccuracy - a.averageAccuracy || b.totalQuestions - a.totalQuestions);
  const improved = [...entries].sort((a, b) => b.improvementPoints - a.improvementPoints || b.honorScore - a.honorScore);

  return { gold, diligent, accurate, improved };
}

export function getLeaderboardByCategory(
  sessions: GameSession[],
  assignments: Assignment[],
  filters: LeaderboardFilters,
  category: LeaderboardCategory
) {
  return buildLeaderboard(sessions, assignments, filters)[category];
}

export function getVocabFilterOptions(vocabSets: VocabSet[]) {
  return vocabSets.map(set => ({ id: set.id, title: set.title }));
}
