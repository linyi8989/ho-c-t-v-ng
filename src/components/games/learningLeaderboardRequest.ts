import type { Role } from '../../types';
import type { LeaderboardPeriod } from '../../lib/leaderboard';

interface LearningLeaderboardRequestOptions {
  period: LeaderboardPeriod;
  vocabSetId: string;
  assignmentId?: string;
  assignmentClassId?: string;
  accessToken?: string;
  authToken?: string | null;
  role?: Role;
}

interface LearningLeaderboardRequest {
  audience: 'learning' | 'staff';
  url: string;
  headers?: Record<string, string>;
}

function isStaffRole(role?: Role) {
  return role === 'teacher' || role === 'super_admin';
}

export function buildLearningLeaderboardRequest(
  options: LearningLeaderboardRequestOptions,
): LearningLeaderboardRequest | null {
  if (!options.accessToken && isStaffRole(options.role)) {
    if (!options.authToken) return null;

    const params = new URLSearchParams({
      period: options.period,
      category: 'gold',
      page: '1',
      pageSize: '8',
      vocabSetId: options.vocabSetId,
    });
    if (options.assignmentClassId) params.set('classId', options.assignmentClassId);

    return {
      audience: 'staff',
      url: `/api/admin/leaderboard-summary?${params.toString()}`,
      headers: { Authorization: `Bearer ${options.authToken}` },
    };
  }

  const params = new URLSearchParams({
    period: options.period,
    limit: '8',
    vocabSetId: options.vocabSetId,
  });
  if (options.assignmentId) params.set('assignmentId', options.assignmentId);

  return {
    audience: 'learning',
    url: `/api/learning/leaderboard-summary?${params.toString()}`,
    headers: options.accessToken
      ? { 'X-Vocab-Share-Token': options.accessToken }
      : undefined,
  };
}
