interface VocabularyRunServiceOptions {
  repository: ReturnType<typeof import('./repository.js').createVocabularyRunRepository>;
  lazySessionEnabled: boolean;
  activityTtlDays: number;
  getClientRunCredentials: (payload: any) => { clientRunId: string; runSecret: string };
  resolveStartContext: (request: any, payload: any, timing?: any) => Promise<any>;
  buildSessionRecord: (context: any, payload: any, options: any) => any;
  deterministicRunDocumentId: (namespace: string, parts: string[]) => string;
  canResumeClientRun: (request: any, session: any, runSecret: string) => boolean;
  canUpdateSession: (request: any, session: any, payload: any) => boolean;
  supportsIncrementalSession: (session: any) => boolean;
  hashSessionToken: (token: string) => string;
  omitSensitiveFields: (session: any) => any;
  sanitizeSubmittedActions: (actions: any) => any[];
  sanitizeAction: (action: any) => any;
  dedupeStoredActions: (actions: any[]) => any[];
  gradeSession: (session: any, actions: any[]) => any;
  sessionToLeaderboardEvent: (session: any) => any;
  addDaysIso: (timestamp: string, days: number) => string;
  clearLeaderboardCache: () => void;
  getSessionActor: (request: any, payload: any) => any;
  createSessionToken: () => string;
  safeText: (value: any, maxLength: number) => string;
  randomUUID: () => string;
  now?: () => Date;
  nowMs?: () => number;
}

interface TimingLike { mark(label: string): void }

function runHttpError(status: number, message: string) {
  return Object.assign(new Error(message), { status });
}

export function createVocabularyRunService(options: VocabularyRunServiceOptions) {
  const now = options.now || (() => new Date());
  const nowMs = options.nowMs || Date.now;
  const completedRecord = (base: any, result: any, completedAt: string, includeLastSavedAt = false) => {
    const durationMs = Math.max(0, nowMs() - new Date(base.startedAt || completedAt).getTime());
    return {
      ...base,
      ...result,
      status: 'completed',
      submissionStatus: 'completed',
      completedAt,
      endedAt: completedAt,
      submittedAt: completedAt,
      ...(includeLastSavedAt ? { lastSavedAt: completedAt } : {}),
      durationMs,
      durationSeconds: Math.round(durationMs / 1000),
      expiresAt: options.addDaysIso(completedAt, options.activityTtlDays),
    };
  };

  const activateSession = async (request: any, timing?: TimingLike) => {
    if (!options.lazySessionEnabled) throw runHttpError(404, 'Lazy session v3 is disabled.');
    const payload = request.body || {};
    const credentials = options.getClientRunCredentials(payload);
    const context = await options.resolveStartContext(request, payload, timing);
    if (context.gameId !== 'speaking-ai') {
      throw runHttpError(400, 'Chi game Speaking AI moi can kich hoat session som.');
    }
    const id = options.deterministicRunDocumentId('session-v3', [
      context.actor.ownerKey, context.vocabSetId, context.gameId, credentials.clientRunId,
    ]);
    const existing = await options.repository.getSession(id);
    timing?.mark('idempotency_lookup');
    if (existing) {
      if (!options.canResumeClientRun(request, existing, credentials.runSecret)) {
        throw runHttpError(403, 'Khong co quyen tiep tuc luot hoc nay.');
      }
      return { body: { ...options.omitSensitiveFields(existing), sessionToken: credentials.runSecret, alreadyActivated: true } };
    }
    const session = options.buildSessionRecord(context, payload, {
      id,
      sessionTokenHash: options.hashSessionToken(credentials.runSecret),
      schemaVersion: 3,
      clientRunId: credentials.clientRunId,
      startedAt: payload.startedAt,
    });
    await options.repository.saveSessionWithHistory(session, false);
    timing?.mark('persist');
    return { status: 201, body: { ...options.omitSensitiveFields(session), sessionToken: credentials.runSecret } };
  };

  const lazyComplete = async (request: any, timing?: TimingLike) => {
    if (!options.lazySessionEnabled) throw runHttpError(404, 'Lazy session v3 is disabled.');
    const payload = request.body || {};
    const credentials = options.getClientRunCredentials(payload);
    const context = await options.resolveStartContext(request, payload, timing);
    if (context.gameId === 'speaking-ai') {
      throw runHttpError(400, 'Speaking AI phai kich hoat session khi bat dau ghi am.');
    }
    const id = options.deterministicRunDocumentId('session-v3', [
      context.actor.ownerKey, context.vocabSetId, context.gameId, credentials.clientRunId,
    ]);
    const existing = await options.repository.getSession(id);
    timing?.mark('idempotency_lookup');
    if (existing) {
      if (!options.canResumeClientRun(request, existing, credentials.runSecret)) {
        throw runHttpError(403, 'Khong co quyen nop luot hoc nay.');
      }
      if (existing.status === 'completed') {
        return { body: { ...options.omitSensitiveFields(existing), alreadyCompleted: true } };
      }
    }
    const actions = options.sanitizeSubmittedActions(payload.actions);
    const baseSession = existing || options.buildSessionRecord(context, payload, {
      id,
      sessionTokenHash: options.hashSessionToken(credentials.runSecret),
      schemaVersion: 3,
      clientRunId: credentials.clientRunId,
      startedAt: payload.startedAt,
    });
    const completedAt = now().toISOString();
    const completed = completedRecord(baseSession, options.gradeSession(baseSession, actions), completedAt, true);
    const event = options.sessionToLeaderboardEvent({ ...completed, id });
    await options.repository.saveCompletedSession(completed, event);
    options.clearLeaderboardCache();
    timing?.mark('persist');
    return { body: options.omitSensitiveFields(completed) };
  };

  const startSession = async (request: any, timing?: TimingLike) => {
    const payload = request.body || {};
    const context = await options.resolveStartContext(request, payload, timing);
    const id = `session-${options.randomUUID()}`;
    const sessionToken = options.createSessionToken();
    const session = options.buildSessionRecord(context, payload, {
      id,
      sessionTokenHash: options.hashSessionToken(sessionToken),
      schemaVersion: 2,
    });
    delete session.submissionStatus;
    delete session.activatedAt;
    delete session.clientRunId;
    await options.repository.saveSession(session);
    timing?.mark('persist');
    return { status: 201, body: { ...options.omitSensitiveFields(session), sessionToken } };
  };

  const updateSession = async (request: any) => {
    const payload = request.body || {};
    const existing = await options.repository.getSession(request.params.id);
    if (!existing) throw runHttpError(404, 'Session không tồn tại.');
    if (!options.canUpdateSession(request, existing, payload)) {
      throw runHttpError(403, 'You do not have permission to update this game session.');
    }
    if (existing.status === 'completed') {
      throw runHttpError(409, 'This game session has already been completed.');
    }
    const endedAt = payload.endedAt || now().toISOString();
    const startedAt = existing.startedAt || endedAt;
    const durationMs = Math.max(0, Number(payload.durationMs ?? (new Date(endedAt).getTime() - new Date(startedAt).getTime())));
    const totalQuestions = Math.max(0, Number(payload.totalQuestions || 0));
    const correctAnswers = Math.max(0, Number(payload.correctAnswers || 0));
    const answerDetails = Array.isArray(payload.answerDetails)
      ? payload.answerDetails.slice(0, 200).map((item: any, index: number) => ({
          questionIndex: Number.isFinite(Number(item.questionIndex)) ? Number(item.questionIndex) : index,
          wordId: item.wordId || '', word: item.word || '', questionText: item.questionText || '',
          correctAnswer: item.correctAnswer || '', userAnswer: item.userAnswer || '',
          selectedAnswer: item.selectedAnswer || '', isCorrect: Boolean(item.isCorrect),
          timeSpentMs: item.timeSpentMs ? Number(item.timeSpentMs) : undefined,
          options: Array.isArray(item.options) ? item.options.slice(0, 6).map((choice: any) => String(choice).slice(0, 160)) : undefined,
        })) : [];
    const completed = {
      ...existing,
      answerDetails,
      score: Math.max(0, Number(payload.score || 0)),
      totalQuestions,
      correctAnswers,
      incorrectAnswers: Math.max(0, Number(payload.incorrectAnswers || 0)),
      accuracy: totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0,
      durationMs,
      durationSeconds: Math.round(durationMs / 1000),
      status: 'completed', submissionStatus: 'completed', endedAt, completedAt: endedAt,
      expiresAt: options.addDaysIso(endedAt, options.activityTtlDays),
    };
    const event = options.sessionToLeaderboardEvent({ ...completed, id: request.params.id });
    await options.repository.saveCompletedSession(completed, event);
    options.clearLeaderboardCache();
    return { body: options.omitSensitiveFields(completed) };
  };

  const saveAction = async (request: any, timing?: TimingLike) => {
    const session = await options.repository.getSession(request.params.id);
    timing?.mark('session_read');
    if (!session) throw runHttpError(404, 'Session không tồn tại.');
    if (!options.canUpdateSession(request, session, request.body || {})) {
      throw runHttpError(403, 'Bạn không có quyền lưu lượt chơi này.');
    }
    if (!options.supportsIncrementalSession(session)) {
      throw runHttpError(400, 'Session cũ không hỗ trợ lưu tiến độ.');
    }
    if (session.status === 'completed') return { body: { saved: true, completed: true } };
    const action = options.sanitizeAction({ ...request.body?.action, actionId: request.params.actionId });
    if (!action.actionId) throw runHttpError(400, 'Thiếu actionId.');
    const canonicalActionId = `${request.params.id}:sequence:${action.sequence}`;
    const legacyActionId = `${request.params.id}:${action.actionId}`;
    const found = await options.repository.getActionPair(canonicalActionId, legacyActionId);
    timing?.mark('action_lookup');
    if (found.canonical) {
      if (found.canonical.actionId && found.canonical.actionId !== action.actionId) {
        throw runHttpError(409, 'Action sequence đã tồn tại.');
      }
      return { body: { saved: true, actionId: action.actionId, sequence: action.sequence } };
    }
    if (found.legacy) return { body: { saved: true, actionId: action.actionId, sequence: action.sequence } };
    const timestamp = now().toISOString();
    const touchedSession = { ...session, id: request.params.id, status: 'in_progress', lastSavedAt: timestamp, updatedAt: timestamp };
    await options.repository.saveActionAndTouchSession({
      ...action,
      id: canonicalActionId,
      sessionId: request.params.id,
      createdAt: timestamp,
      updatedAt: timestamp,
    }, touchedSession);
    timing?.mark('persist');
    return { body: { saved: true, actionId: action.actionId, sequence: action.sequence } };
  };

  const submitSession = async (request: any, timing?: TimingLike) => {
    const session = await options.repository.getSession(request.params.id);
    timing?.mark('session_read');
    if (!session) throw runHttpError(404, 'Session không tồn tại.');
    if (!options.canUpdateSession(request, session, request.body || {})) {
      throw runHttpError(403, 'Bạn không có quyền nộp lượt chơi này.');
    }
    if (session.status === 'completed') return { body: options.omitSensitiveFields(session) };
    if (!options.supportsIncrementalSession(session)) {
      throw runHttpError(400, 'Session cũ phải dùng endpoint hoàn thành cũ.');
    }
    const actions = session.actionPersistence === 'submit_batch' && Array.isArray(request.body?.actions)
      ? options.sanitizeSubmittedActions(request.body.actions)
      : options.dedupeStoredActions(await options.repository.listActions(request.params.id));
    timing?.mark('actions_read');
    const completedAt = now().toISOString();
    const completed = completedRecord(session, options.gradeSession(session, actions), completedAt);
    const event = options.sessionToLeaderboardEvent({ ...completed, id: request.params.id });
    await options.repository.saveCompletedSession(completed, event);
    options.clearLeaderboardCache();
    timing?.mark('persist');
    return { body: options.omitSensitiveFields(completed) };
  };

  const savePronunciationAttempt = async (request: any) => {
    const payload = request.body || {};
    const timestamp = now().toISOString();
    const gameSessionId = options.safeText(payload.gameSessionId, 160);
    let session: any = null;
    if (gameSessionId) {
      session = await options.repository.getSession(gameSessionId);
      if (!session) throw runHttpError(404, 'Session không tồn tại.');
      if (!options.canUpdateSession(request, session, payload)) {
        throw runHttpError(403, 'You do not have permission to save this pronunciation attempt.');
      }
      if (session.status === 'completed') {
        throw runHttpError(409, 'This game session has already been completed.');
      }
    } else if (!request.user) {
      throw runHttpError(401, 'Game session is required to save pronunciation attempts.');
    }
    const actor = session ? {
      ownerKey: session.ownerKey || '', ownerType: session.ownerType || '',
      userId: session.userId || '', studentId: session.studentId || session.guestId || '',
      guestId: session.guestId || '', studentName: session.studentName || '',
    } : options.getSessionActor(request, payload);
    if (!actor) throw runHttpError(401, 'Student identity is required to save pronunciation attempts.');
    const attempt = {
      id: `pronunciation-${options.randomUUID()}`,
      ownerKey: actor.ownerKey, ownerType: actor.ownerType, userId: actor.userId || '',
      studentId: actor.studentId || actor.guestId || '', guestId: actor.guestId || '',
      studentName: actor.studentName || '',
      vocabularySetId: session?.vocabSetId || options.safeText(payload.vocabularySetId || payload.vocabSetId || '', 160),
      wordId: options.safeText(payload.wordId, 160),
      targetText: options.safeText(payload.targetText, 500),
      recognizedText: options.safeText(payload.recognizedText, 500),
      score: Math.max(0, Math.min(100, Number(payload.score || 0))),
      correctWords: Math.max(0, Number(payload.correctWords || 0)),
      totalWords: Math.max(0, Number(payload.totalWords || 0)),
      attemptCount: Math.max(1, Number(payload.attemptCount || 1)),
      gameSessionId, gameId: 'speaking-ai', playedAt: timestamp, createdAt: timestamp,
    };
    await options.repository.savePronunciationAttempt(attempt);
    return { status: 201, body: attempt };
  };

  return { activateSession, lazyComplete, saveAction, savePronunciationAttempt, startSession, submitSession, updateSession };
}
