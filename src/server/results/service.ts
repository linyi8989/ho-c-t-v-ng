import { getLeaderboardQueryStart } from '../../lib/leaderboard.js';

interface ResultsServiceOptions {
  repository: ReturnType<typeof import('./repository.js').createResultsRepository>;
  activityTtlMs: number;
  maxResultLimit: number;
  safeText: (value: any, maxLength: number) => string;
  parseResultLimit: (value: unknown) => number | null;
  getActivityTime: (activity: any) => string;
  isExpiredActivity: (activity: any) => boolean;
  setUniqueClass: (map: Map<string, any | null>, key: any, value: any) => void;
  normalizePersonName: (value: any) => string;
  getLessonGradeClass: (set: any) => { classId: string; className: string };
  grammarAttemptToActivity: (attempt: any, set?: any) => any;
  listeningAttemptToActivity: (attempt: any, detail?: any) => any;
  enrichStudentNames: (items: any[]) => Promise<any[]>;
  sanitizePublicStudentRecord: (activity: any) => any;
  sanitizeActivityDetail: (activity: any) => any;
  toActivitySummary: (activity: any, sourceType?: string, sourceId?: string) => any;
  canViewResultSession: (user: any, session: any, vocabSets: Map<string, any>, assignments: Map<string, any>, classes: Map<string, any>) => boolean;
  canViewGrammarActivity: (user: any, attempt: any, set: any) => boolean;
  buildLeaderboard: (events: any[], assignments: any[], options: any) => any;
  getCachedLeaderboardSummary: (key: string) => { expiresAt: number; value: any } | undefined;
  cacheLeaderboardSummary: (key: string, value: any) => void;
  allowLegacyLeaderboardFallback?: boolean;
  resolveLearningLeaderboardScope?: (request: any, timing?: TimingLike) => Promise<{
    classId?: string;
    vocabSetId?: string;
  } | null>;
  nowMs?: () => number;
}

interface TimingLike { mark(label: string): void }

function httpError(status: number, message: string, code?: string) {
  return Object.assign(new Error(message), { status, ...(code ? { code } : {}) });
}

function publicLeaderboardEntry(entry: any, index: number) {
  return {
    rank: index + 1,
    studentName: `Học viên #${index + 1}`,
    completedLessons: Number(entry?.completedLessons || 0),
    averageAccuracy: Number(entry?.averageAccuracy || 0),
    studyDays: Number(entry?.studyDays || 0),
    honorScore: Number(entry?.honorScore || 0),
    badges: Array.isArray(entry?.badges) ? entry.badges.slice(0, 5).map((badge: any) => String(badge).slice(0, 120)) : [],
  };
}

export function createResultsService(options: ResultsServiceOptions) {
  const nowMs = options.nowMs || Date.now;
  const summaryInFlight = new Map<string, Promise<any>>();
  const recentCutoff = () => new Date(nowMs() - options.activityTtlMs).toISOString();
  const recentEnough = (activity: any) => new Date(options.getActivityTime(activity)).getTime() >= nowMs() - options.activityTtlMs;
  const canViewListening = (user: any, attempt: any, set: any) => user?.role === 'super_admin'
    || attempt.userId === user?.id
    || attempt.ownerKey === `user:${user?.id}`
    || (user?.role === 'teacher' && set?.ownerId === user.id);

  const getPublicResults = async (request: any, timing?: TimingLike) => {
    const resultLimit = options.parseResultLimit(request.query.limit);
    const sources = await options.repository.loadActivitySources(recentCutoff(), resultLimit, true);
    timing?.mark('sources');
    const uniqueAssignmentClassByVocabSet = new Map<string, any | null>();
    const uniqueMemberClassByName = new Map<string, any | null>();
    for (const assignment of sources.assignments.values()) {
      options.setUniqueClass(uniqueAssignmentClassByVocabSet, assignment.vocabSetId, {
        classId: assignment.classId,
        className: assignment.className || sources.classes.get(assignment.classId)?.name || '',
      });
    }
    for (const member of sources.members.values()) {
      options.setUniqueClass(uniqueMemberClassByName, options.normalizePersonName(member.studentName), {
        classId: member.classId,
        className: member.className || sources.classes.get(member.classId)?.name || '',
      });
    }
    const list: any[] = [];
    for (const data of sources.gameSessions) {
      if (!data.completedAt || options.isExpiredActivity(data) || !recentEnough(data)) continue;
      const assignment = data.assignmentId ? sources.assignments.get(data.assignmentId) : null;
      const assignmentClass = assignment ? {
        classId: assignment.classId,
        className: assignment.className || sources.classes.get(assignment.classId)?.name || '',
      } : null;
      const vocabSetClass = uniqueAssignmentClassByVocabSet.get(data.vocabSetId) || null;
      const gradeClass = options.getLessonGradeClass(sources.vocabSets.get(data.vocabSetId));
      const memberClass = uniqueMemberClassByName.get(options.normalizePersonName(data.studentName)) || null;
      const resolvedClass = data.classId
        ? { classId: data.classId, className: data.className || sources.classes.get(data.classId)?.name || '' }
        : assignmentClass?.classId ? assignmentClass
          : vocabSetClass?.classId ? vocabSetClass
            : gradeClass.classId ? gradeClass
              : memberClass?.classId ? memberClass : { classId: '', className: '' };
      list.push({
        id: data.id,
        assignmentId: data.assignmentId,
        classId: resolvedClass.classId,
        className: resolvedClass.className,
        vocabSetId: data.vocabSetId,
        vocabSetTitle: data.vocabSetTitle,
        gameId: data.gameId,
        studentName: data.studentName,
        guestId: data.guestId,
        startedAt: data.startedAt,
        completedAt: data.completedAt,
        score: data.score || 0,
        totalQuestions: data.totalQuestions || 0,
        correctAnswers: data.correctAnswers || 0,
        incorrectAnswers: data.incorrectAnswers || 0,
        endedAt: data.endedAt || data.completedAt,
        durationMs: data.durationMs || 0,
        durationSeconds: data.durationSeconds || 0,
        accuracy: data.accuracy || 0,
        createdAt: data.createdAt,
        expiresAt: data.expiresAt,
      });
    }
    for (const attempt of sources.grammarAttempts) {
      if (attempt.status !== 'completed' || !attempt.completedAt || options.isExpiredActivity(attempt) || !recentEnough(attempt)) continue;
      const activity = options.grammarAttemptToActivity(attempt, sources.grammarSets.get(attempt.grammarSetId));
      delete activity.answerDetails;
      list.push(activity);
    }
    for (const attempt of sources.listeningAttempts) {
      if (!attempt.completedAt || !recentEnough(attempt)) continue;
      list.push(options.listeningAttemptToActivity(attempt));
    }
    list.sort((a, b) => new Date(options.getActivityTime(b)).getTime() - new Date(options.getActivityTime(a)).getTime());
    const bounded = resultLimit ? list.slice(0, resultLimit) : list;
    timing?.mark('shape');
    const named = await options.enrichStudentNames(bounded);
    timing?.mark('names');
    return { body: named.map(options.sanitizePublicStudentRecord) };
  };

  const getPublicLeaderboardResults = async (_timing?: TimingLike) => {
    return {
      status: 410,
      headers: { 'Cache-Control': 'no-store' },
      body: {
        error: 'The public raw leaderboard feed has been retired. Use /api/public/leaderboard-summary.',
        code: 'LEADERBOARD_RAW_RETIRED',
      },
    };
  };

  const loadSummaryEvents = async (period: 'week' | 'month', timing?: TimingLike) => {
    const cutoff = getLeaderboardQueryStart({ period, now: nowMs() }).toISOString();
    let events = await options.repository.loadReadyLeaderboardEvents(timing, cutoff);
    if (!events && options.allowLegacyLeaderboardFallback) {
      timing?.mark('read_model_fallback');
      events = await options.repository.loadLeaderboardEvents(timing, cutoff);
    }
    if (!events) {
      throw httpError(
        503,
        'Leaderboard is temporarily unavailable while its read model is being prepared.',
        'LEADERBOARD_NOT_READY',
      );
    }
    return events;
  };

  const buildPublicSummary = async (
    period: 'week' | 'month',
    limit: number,
    timing?: TimingLike,
    scope: { classId?: string; vocabSetId?: string } = {},
  ) => {
    const events = await loadSummaryEvents(period, timing);
    const publicEvents = events.map(options.sanitizePublicStudentRecord);
    const leaderboard = options.buildLeaderboard(publicEvents, [], {
      period,
      now: nowMs(),
      ...(scope.classId ? { classId: scope.classId } : {}),
      ...(scope.vocabSetId ? { vocabSetId: scope.vocabSetId } : {}),
    });
    timing?.mark('aggregate');
    return {
      entries: leaderboard.gold.slice(0, limit).map(publicLeaderboardEntry),
      period,
    };
  };

  const withSummarySingleFlight = async (key: string, load: () => Promise<any>) => {
    const active = summaryInFlight.get(key);
    if (active) return active;
    const pending = load();
    summaryInFlight.set(key, pending);
    try {
      return await pending;
    } finally {
      if (summaryInFlight.get(key) === pending) summaryInFlight.delete(key);
    }
  };

  const getPublicLeaderboardSummary = async (request: any, timing?: TimingLike) => {
    const period = request.query.period === 'month' ? 'month' : 'week';
    const requestedLimit = Number(request.query.limit || 8);
    const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(20, Math.floor(requestedLimit))) : 8;
    const cacheKey = `public:${period}:${limit}`;
    const cached = options.getCachedLeaderboardSummary(cacheKey);
    const headers = { 'Cache-Control': 'public, max-age=30' };
    if (cached && cached.expiresAt > nowMs()) {
      timing?.mark('memory_cache');
      return { body: cached.value, headers };
    }
    const value = await withSummarySingleFlight(cacheKey, async () => {
      const result = await buildPublicSummary(period, limit, timing);
      options.cacheLeaderboardSummary(cacheKey, result);
      return result;
    });
    return { body: value, headers };
  };

  const getLearningLeaderboardSummary = async (request: any, timing?: TimingLike) => {
    if (!options.resolveLearningLeaderboardScope) throw httpError(503, 'Learning leaderboard scope is unavailable.');
    const scope = await options.resolveLearningLeaderboardScope(request, timing);
    if (!scope) throw httpError(403, 'A valid lesson or assignment capability is required.');
    const period = request.query.period === 'month' ? 'month' : 'week';
    const requestedLimit = Number(request.query.limit || 8);
    const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(20, Math.floor(requestedLimit))) : 8;
    const cacheKey = `learning:${period}:${scope.classId || ''}:${scope.vocabSetId || ''}:${limit}`;
    const cached = options.getCachedLeaderboardSummary(cacheKey);
    const headers = { 'Cache-Control': 'private, max-age=30', Vary: 'X-Vocab-Share-Token' };
    if (cached && cached.expiresAt > nowMs()) return { body: cached.value, headers };
    const value = await withSummarySingleFlight(cacheKey, async () => {
      const result = await buildPublicSummary(period, limit, timing, scope);
      options.cacheLeaderboardSummary(cacheKey, result);
      return result;
    });
    return { body: value, headers };
  };

  const getAdminLeaderboardSummary = async (request: any, timing?: TimingLike) => {
    if (!request.user) throw httpError(401, 'Unauthenticated');
    const period = request.query.period === 'month' ? 'month' : 'week';
    const category = ['gold', 'diligent', 'accurate', 'improved'].includes(String(request.query.category))
      ? String(request.query.category)
      : 'gold';
    const classId = options.safeText(request.query.classId, 180);
    const vocabSetId = options.safeText(request.query.vocabSetId, 180);
    const requestedPage = Number(request.query.page || 1);
    const requestedPageSize = Number(request.query.pageSize || 50);
    const page = Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1;
    const pageSize = Number.isFinite(requestedPageSize) ? Math.max(1, Math.min(100, Math.floor(requestedPageSize))) : 50;
    const [events, metadata] = await Promise.all([
      loadSummaryEvents(period, timing),
      options.repository.loadScopeMetadata(),
    ]);
    const scoped = events.filter((event: any) => event.sourceType === 'grammar'
      ? options.canViewGrammarActivity(request.user, event, metadata.grammarSets.get(event.grammarSetId))
      : options.canViewResultSession(request.user, event, metadata.vocabSets, metadata.assignments, metadata.classes));
    timing?.mark('scope');
    const named = await options.enrichStudentNames(scoped);
    timing?.mark('names');
    const leaderboard = options.buildLeaderboard(named, [], {
      period,
      now: nowMs(),
      ...(classId ? { classId } : {}),
      ...(vocabSetId ? { vocabSetId } : {}),
    });
    const rows = leaderboard[category] || leaderboard.gold;
    const total = rows.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const boundedPage = Math.min(page, totalPages);
    const start = (boundedPage - 1) * pageSize;
    const classesById = new Map<string, string>();
    const setsById = new Map<string, string>();
    for (const event of scoped) {
      if (event.classId && event.className) classesById.set(String(event.classId), String(event.className));
      if (event.vocabSetId) setsById.set(String(event.vocabSetId), String(event.vocabSetTitle || event.vocabSetId));
    }
    return {
      headers: { 'Cache-Control': 'private, no-store' },
      body: {
        entries: rows.slice(start, start + pageSize),
        page: boundedPage,
        pageSize,
        total,
        totalPages,
        period,
        category,
        classes: [...classesById.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'vi')),
        vocabSets: [...setsById.entries()].map(([id, title]) => ({ id, title })).sort((a, b) => a.title.localeCompare(b.title, 'vi')),
      },
    };
  };

  const loadScopedRecentActivitySummaries = async (user: any, limit = options.maxResultLimit) => {
    const boundedLimit = Math.max(1, Math.min(options.maxResultLimit, Math.floor(limit)));
    const sources = await options.repository.loadActivitySources(recentCutoff(), boundedLimit);
    const list: any[] = [];
    for (const data of sources.gameSessions) {
      if (!data.completedAt || options.isExpiredActivity(data) || !recentEnough(data)) continue;
      if (!options.canViewResultSession(user, data, sources.vocabSets, sources.assignments, sources.classes)) continue;
      const gradeClass = options.getLessonGradeClass(sources.vocabSets.get(data.vocabSetId));
      list.push(options.toActivitySummary({
        ...options.sanitizeActivityDetail(data),
        id: data.id,
        classId: data.classId || gradeClass.classId || '',
        className: data.className || gradeClass.className || '',
      }, 'vocabulary', data.id));
    }
    for (const data of sources.grammarAttempts) {
      if (data.status !== 'completed' || !data.completedAt || options.isExpiredActivity(data) || !recentEnough(data)) continue;
      if (!options.canViewGrammarActivity(user, data, sources.grammarSets.get(data.grammarSetId))) continue;
      list.push(options.toActivitySummary(options.grammarAttemptToActivity(data, sources.grammarSets.get(data.grammarSetId)), 'grammar', data.id));
    }
    for (const data of sources.listeningAttempts) {
      if (!data.completedAt || !recentEnough(data) || !canViewListening(user, data, sources.listeningSets.get(data.setId))) continue;
      list.push(options.toActivitySummary(options.listeningAttemptToActivity(data), 'listening', data.id));
    }
    list.sort((a, b) => new Date(options.getActivityTime(b)).getTime() - new Date(options.getActivityTime(a)).getTime());
    return options.enrichStudentNames(list.slice(0, boundedLimit));
  };

  const loadScopedLeaderboardResults = async (user: any, timing?: TimingLike) => {
    const [events, metadata] = await Promise.all([
      options.repository.loadLeaderboardEvents(timing),
      options.repository.loadScopeMetadata(),
    ]);
    timing?.mark('scope_sources');
    const scoped = events.filter(event => event.sourceType === 'grammar'
      ? options.canViewGrammarActivity(user, event, metadata.grammarSets.get(event.grammarSetId))
      : options.canViewResultSession(user, event, metadata.vocabSets, metadata.assignments, metadata.classes));
    timing?.mark('scope');
    return scoped;
  };

  const getResultDetail = async (request: any, timing?: TimingLike) => {
    if (!request.user) throw httpError(401, 'Unauthenticated');
    const sourceType = options.safeText(request.params.sourceType, 80);
    const requestedId = options.safeText(request.params.resultId, 200);
    if (!requestedId || !['vocabulary', 'grammar', 'listening'].includes(sourceType)) throw httpError(400, 'Loại kết quả không hợp lệ.');
    let activity: any;
    if (sourceType === 'vocabulary') {
      const session = await options.repository.getRecord('game_sessions', requestedId);
      if (!session || !session.completedAt || options.isExpiredActivity(session)) throw httpError(404, 'Không tìm thấy kết quả.');
      const [vocabSet, assignment] = await Promise.all([
        session.vocabSetId ? options.repository.getRecord('vocab_sets', session.vocabSetId) : null,
        session.assignmentId ? options.repository.getRecord('assignments', session.assignmentId) : null,
      ]);
      const classes = await options.repository.getClasses([...new Set<string>([session.classId, assignment?.classId].filter(Boolean))]);
      const vocabSets = new Map<string, any>(vocabSet ? [[vocabSet.id, vocabSet]] : []);
      const assignments = new Map<string, any>(assignment ? [[assignment.id, assignment]] : []);
      if (!options.canViewResultSession(request.user, session, vocabSets, assignments, classes)) throw httpError(404, 'Không tìm thấy kết quả.');
      const gradeClass = options.getLessonGradeClass(vocabSet);
      activity = options.sanitizeActivityDetail({ ...session, sourceType: 'vocabulary', sourceId: session.id, classId: session.classId || gradeClass.classId || '', className: session.className || gradeClass.className || '' });
    } else if (sourceType === 'grammar') {
      const sourceId = requestedId.startsWith('grammar-') ? requestedId.slice('grammar-'.length) : requestedId;
      const attempt = await options.repository.getRecord('grammar_attempts', sourceId);
      if (!attempt) throw httpError(404, 'Không tìm thấy kết quả.');
      const set = attempt.grammarSetId ? await options.repository.getRecord('grammar_sets', attempt.grammarSetId) : null;
      if (attempt.status !== 'completed' || !attempt.completedAt || options.isExpiredActivity(attempt) || !options.canViewGrammarActivity(request.user, attempt, set)) throw httpError(404, 'Không tìm thấy kết quả.');
      activity = options.grammarAttemptToActivity(attempt, set);
      activity.sourceId = attempt.id;
    } else {
      const attempt = await options.repository.getRecord('listening_attempts', requestedId);
      if (!attempt) throw httpError(404, 'Không tìm thấy kết quả.');
      const set = attempt.setId ? await options.repository.getRecord('listening_sets', attempt.setId) : null;
      if (!attempt.completedAt || !canViewListening(request.user, attempt, set)) throw httpError(404, 'Không tìm thấy kết quả.');
      const isStaff = request.user.role === 'teacher' || request.user.role === 'super_admin';
      const detail = isStaff ? await options.repository.resolveListeningDetail(attempt) : null;
      activity = options.listeningAttemptToActivity(attempt, detail);
    }
    timing?.mark('detail');
    const [named] = await options.enrichStudentNames([activity]);
    timing?.mark('names');
    return { body: named };
  };

  const getResults = async (request: any, timing?: TimingLike) => {
    const summaryView = request.query.view === 'summary';
    const resultLimit = summaryView ? options.parseResultLimit(request.query.limit) : null;
    if (summaryView) {
      const summaries = await loadScopedRecentActivitySummaries(request.user, resultLimit || options.maxResultLimit);
      timing?.mark('summary');
      return { body: summaries };
    }
    const sources = await options.repository.loadActivitySources(recentCutoff(), resultLimit);
    timing?.mark('sources');
    const list: any[] = [];
    for (const data of sources.gameSessions) {
      if (!data.completedAt || options.isExpiredActivity(data) || !recentEnough(data)) continue;
      if (!options.canViewResultSession(request.user, data, sources.vocabSets, sources.assignments, sources.classes)) continue;
      const gradeClass = options.getLessonGradeClass(sources.vocabSets.get(data.vocabSetId));
      list.push(options.sanitizeActivityDetail({ ...data, sourceType: 'vocabulary', sourceId: data.id, classId: data.classId || gradeClass.classId || '', className: data.className || gradeClass.className || '' }));
    }
    for (const data of sources.grammarAttempts) {
      if (data.status !== 'completed' || !data.completedAt || options.isExpiredActivity(data) || !recentEnough(data)) continue;
      if (!options.canViewGrammarActivity(request.user, data, sources.grammarSets.get(data.grammarSetId))) continue;
      list.push({ ...options.grammarAttemptToActivity(data, sources.grammarSets.get(data.grammarSetId)), sourceId: data.id });
    }
    const visibleListening = sources.listeningAttempts.filter(data => data.completedAt && recentEnough(data) && canViewListening(request.user, data, sources.listeningSets.get(data.setId)));
    const isStaff = request.user?.role === 'teacher' || request.user?.role === 'super_admin';
    const detailCache = new Map();
    list.push(...await Promise.all(visibleListening.map(async data => {
      if (!isStaff) return options.listeningAttemptToActivity(data);
      return options.listeningAttemptToActivity(data, await options.repository.resolveListeningDetail(data, detailCache));
    })));
    list.sort((a, b) => new Date(options.getActivityTime(b)).getTime() - new Date(options.getActivityTime(a)).getTime());
    const bounded = resultLimit ? list.slice(0, resultLimit) : list;
    timing?.mark('shape');
    const named = await options.enrichStudentNames(bounded);
    timing?.mark('names');
    return { body: named };
  };

  const getLeaderboardResults = async (_request: any, _timing?: TimingLike) => ({
    status: 410,
    headers: { 'Cache-Control': 'no-store' },
    body: {
      error: 'The raw leaderboard feed has been retired. Use a scoped leaderboard summary endpoint.',
      code: 'LEADERBOARD_RAW_RETIRED',
    },
  });

  return {
    getLeaderboardResults,
    getAdminLeaderboardSummary,
    getLearningLeaderboardSummary,
    getPublicLeaderboardResults,
    getPublicLeaderboardSummary,
    getPublicResults,
    getResultDetail,
    getResults,
    loadScopedLeaderboardResults,
    loadScopedRecentActivitySummaries,
  };
}
