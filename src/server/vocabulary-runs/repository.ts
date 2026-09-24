interface VocabularyRunRepositoryOptions {
  db: any;
  appendLearningHistoryProjection: (batch: any, projection: any) => void;
  projectVocabularyAttempt: (session: any, options: any) => any;
  detailRetentionDays: number;
}

function documentRecord(document: any) {
  return document.exists ? { id: document.id, ...document.data() } : null;
}

export function createVocabularyRunRepository(options: VocabularyRunRepositoryOptions) {
  return {
    async getSession(id: string) {
      return documentRecord(await options.db.collection('game_sessions').doc(id).get());
    },
    async saveSession(session: any) {
      await options.db.collection('game_sessions').doc(session.id).set(session);
    },
    async saveSessionWithHistory(session: any, includeDetail = false) {
      const batch = options.db.batch();
      batch.set(options.db.collection('game_sessions').doc(session.id), session);
      options.appendLearningHistoryProjection(batch, options.projectVocabularyAttempt(session, {
        detailRetentionDays: options.detailRetentionDays,
        includeDetail,
      }));
      await batch.commit();
    },
    async saveCompletedSession(session: any, leaderboardEvent: any) {
      const batch = options.db.batch();
      batch.set(options.db.collection('game_sessions').doc(session.id), session);
      batch.set(options.db.collection('leaderboard_events').doc(leaderboardEvent.id), leaderboardEvent);
      options.appendLearningHistoryProjection(batch, options.projectVocabularyAttempt(session, {
        detailRetentionDays: options.detailRetentionDays,
      }));
      await batch.commit();
    },
    async getActionPair(canonicalActionId: string, legacyActionId: string) {
      const [canonicalDocument, legacyDocument] = await Promise.all([
        options.db.collection('game_session_actions').doc(canonicalActionId).get(),
        options.db.collection('game_session_actions').doc(legacyActionId).get(),
      ]);
      return {
        canonical: documentRecord(canonicalDocument),
        legacy: documentRecord(legacyDocument),
      };
    },
    async saveActionAndTouchSession(action: any, session: any) {
      const canonicalActionId = action.id;
      const batch = options.db.batch();
      batch.set(options.db.collection('game_session_actions').doc(canonicalActionId), action);
      batch.update(options.db.collection('game_sessions').doc(session.id), {
        status: session.status,
        lastSavedAt: session.lastSavedAt,
        updatedAt: session.updatedAt,
      });
      options.appendLearningHistoryProjection(batch, options.projectVocabularyAttempt(session, {
        detailRetentionDays: options.detailRetentionDays,
        includeDetail: false,
      }));
      await batch.commit();
    },
    async listActions(sessionId: string) {
      const snapshot = await options.db.collection('game_session_actions').where('sessionId', '==', sessionId).get();
      return (snapshot.docs || []).map((document: any) => ({ id: document.id, ...document.data() }));
    },
    async savePronunciationAttempt(attempt: any) {
      await options.db.collection('pronunciation_attempts').doc(attempt.id).set(attempt);
    },
  };
}
