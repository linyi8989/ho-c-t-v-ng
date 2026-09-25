import { Assignment, GameSession, VocabSet } from '../types';

export type LeaderboardPeriod = 'week' | 'month';
export type LeaderboardCategory = 'gold' | 'diligent' | 'accurate' | 'improved';

export interface LeaderboardFilters {
  period: LeaderboardPeriod;
  classId?: string;
  vocabSetId?: string;
  now?: Date | string | number;
  utcOffsetMinutes?: number;
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
export const LEADERBOARD_TIME_ZONE = 'Asia/Ho_Chi_Minh';
export const LEADERBOARD_UTC_OFFSET_MINUTES = 7 * 60;

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

function resolveNow(value?: Date | string | number) {
  if (value instanceof Date) return new Date(value.getTime());
  if (value !== undefined) return new Date(value);
  return new Date();
}

function toBusinessClock(date: Date, utcOffsetMinutes: number) {
  return new Date(date.getTime() + utcOffsetMinutes * 60_000);
}

function fromBusinessClock(year: number, month: number, day: number, utcOffsetMinutes: number) {
  return new Date(Date.UTC(year, month, day) - utcOffsetMinutes * 60_000);
}

function getPeriodStart(
  period: LeaderboardPeriod,
  now = new Date(),
  utcOffsetMinutes = LEADERBOARD_UTC_OFFSET_MINUTES,
) {
  const businessNow = toBusinessClock(now, utcOffsetMinutes);
  if (period === 'month') {
    return fromBusinessClock(
      businessNow.getUTCFullYear(),
      businessNow.getUTCMonth(),
      1,
      utcOffsetMinutes,
    );
  }

  const day = businessNow.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return fromBusinessClock(
    businessNow.getUTCFullYear(),
    businessNow.getUTCMonth(),
    businessNow.getUTCDate() + mondayOffset,
    utcOffsetMinutes,
  );
}

function getPreviousPeriodStart(
  period: LeaderboardPeriod,
  periodStart: Date,
  utcOffsetMinutes = LEADERBOARD_UTC_OFFSET_MINUTES,
) {
  if (period === 'month') {
    const businessStart = toBusinessClock(periodStart, utcOffsetMinutes);
    return fromBusinessClock(
      businessStart.getUTCFullYear(),
      businessStart.getUTCMonth() - 1,
      1,
      utcOffsetMinutes,
    );
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

function summarizeSessions(
  bestSessions: GameSession[],
  assignments: Assignment[],
  utcOffsetMinutes: number,
) {
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

    const dayKey = completedAt
      ? toBusinessClock(completedAt, utcOffsetMinutes).toISOString().slice(0, 10)
      : undefined;
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
  const now = resolveNow(filters.now);
  const utcOffsetMinutes = Number.isFinite(filters.utcOffsetMinutes)
    ? Number(filters.utcOffsetMinutes)
    : LEADERBOARD_UTC_OFFSET_MINUTES;
  const periodStart = getPeriodStart(filters.period, now, utcOffsetMinutes);
  const previousStart = getPreviousPeriodStart(filters.period, periodStart, utcOffsetMinutes);
  const previousEnd = getPreviousPeriodEnd(filters.period, periodStart);

  const currentBest = getBestSessions(sessions, assignments, filters, periodStart);
  const previousBest = getBestSessions(sessions, assignments, filters, previousStart, previousEnd);

  const currentSummary = summarizeSessions(currentBest, assignments, utcOffsetMinutes);
  const previousSummary = summarizeSessions(previousBest, assignments, utcOffsetMinutes);
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

  const stableNameOrder = (a: LeaderboardEntry, b: LeaderboardEntry) => (
    a.studentName.localeCompare(b.studentName, 'vi')
      || String(a.studentKey || '').localeCompare(String(b.studentKey || ''))
  );
  const gold = [...entries].sort((a, b) => b.honorScore - a.honorScore || b.averageAccuracy - a.averageAccuracy || stableNameOrder(a, b));
  const diligent = [...entries].sort((a, b) => b.studyDays - a.studyDays || b.completedLessons - a.completedLessons || b.honorScore - a.honorScore || stableNameOrder(a, b));
  const accurate = [...entries]
    .filter(entry => entry.completedLessons >= 3 || entry.totalQuestions >= 60)
    .sort((a, b) => b.averageAccuracy - a.averageAccuracy || b.totalQuestions - a.totalQuestions || stableNameOrder(a, b));
  const improved = [...entries].sort((a, b) => b.improvementPoints - a.improvementPoints || b.honorScore - a.honorScore || stableNameOrder(a, b));

  return { gold, diligent, accurate, improved };
}

export function getLeaderboardQueryStart(filters: Pick<LeaderboardFilters, 'period' | 'now' | 'utcOffsetMinutes'>) {
  const now = resolveNow(filters.now);
  const utcOffsetMinutes = Number.isFinite(filters.utcOffsetMinutes)
    ? Number(filters.utcOffsetMinutes)
    : LEADERBOARD_UTC_OFFSET_MINUTES;
  const periodStart = getPeriodStart(filters.period, now, utcOffsetMinutes);
  return getPreviousPeriodStart(filters.period, periodStart, utcOffsetMinutes);
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
