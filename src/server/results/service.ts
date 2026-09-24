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
  nowMs?: () => number;
}

interface TimingLike { mark(label: string): void }

function httpError(status: number, message: string) {
  return Object.assign(new Error(message), { status });
}

export function createResultsService(options: ResultsServiceOptions) {
  const nowMs = options.nowMs || Date.now;
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

  const getPublicLeaderboardResults = async (timing?: TimingLike) => {
    const list = await options.repository.loadLeaderboardEvents(timing);
    return { body: list.map(options.sanitizePublicStudentRecord) };
  };

  const getPublicLeaderboardSummary = async (request: any, timing?: TimingLike) => {
    const period = request.query.period === 'month' ? 'month' : 'week';
    const classId = options.safeText(request.query.classId, 180);
    const requestedLimit = Number(request.query.limit || 8);
    const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(20, Math.floor(requestedLimit))) : 8;
    const cacheKey = `${period}:${classId}:${limit}`;
    const cached = options.getCachedLeaderboardSummary(cacheKey);
    const headers = { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=60' };
    if (cached && cached.expiresAt > nowMs()) {
      timing?.mark('memory_cache');
      return { body: cached.value, headers };
    }
    const events = await options.repository.loadReadyLeaderboardEvents(timing);
    if (!events) return { status: 503, body: { error: 'Bảng vàng đang được chuẩn bị.', code: 'LEADERBOARD_NOT_READY' } };
    const publicEvents = events.map(options.sanitizePublicStudentRecord);
    const classesById = new Map<string, string>();
    for (const event of publicEvents) {
      const eventClassId = options.safeText(event.classId, 180);
      if (!eventClassId) continue;
      const eventClassName = options.safeText(event.className, 180) || eventClassId;
      if (!classesById.has(eventClassId)) classesById.set(eventClassId, eventClassName);
    }
    const entries = options.buildLeaderboard(publicEvents, [], { period, ...(classId ? { classId } : {}) }).gold.slice(0, limit);
    const value = {
      entries,
      classes: [...classesById.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, 'vi')),
      period,
    };
    options.cacheLeaderboardSummary(cacheKey, value);
    timing?.mark('aggregate');
    return { body: value, headers };
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

  const getLeaderboardResults = async (request: any, timing?: TimingLike) => ({ body: await loadScopedLeaderboardResults(request.user, timing) });

  return {
    getLeaderboardResults,
    getPublicLeaderboardResults,
    getPublicLeaderboardSummary,
    getPublicResults,
    getResultDetail,
    getResults,
    loadScopedLeaderboardResults,
    loadScopedRecentActivitySummaries,
  };
}
