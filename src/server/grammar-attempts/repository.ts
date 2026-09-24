interface GrammarAttemptRepositoryOptions {
  db: any;
  appendLearningHistoryProjection: (batch: any, projection: any) => void;
  projectGrammarAttempt: (attempt: any, set: any, options: any) => any;
  detailRetentionDays: number;
}

function documentRecord(document: any) {
  return document.exists ? { id: document.id, ...document.data() } : null;
}

export function createGrammarAttemptRepository(options: GrammarAttemptRepositoryOptions) {
  return {
    async getSet(id: string) {
      return documentRecord(await options.db.collection('grammar_sets').doc(id).get());
    },
    async getAttempt(id: string) {
      return documentRecord(await options.db.collection('grammar_attempts').doc(id).get());
    },
    async countCompletedAttempts(grammarSetId: string, actorField: string, actorId: string, limit: number) {
      const snapshot = await options.db.collection('grammar_attempts')
        .where('grammarSetId', '==', grammarSetId)
        .where(actorField, '==', actorId)
        .where('status', '==', 'completed')
        .limit(limit)
        .get();
      return snapshot.size;
    },
    async saveAttempt(attempt: any, set: any, includeDetail = false) {
      const batch = options.db.batch();
      batch.set(options.db.collection('grammar_attempts').doc(attempt.id), attempt);
      options.appendLearningHistoryProjection(
        batch,
        options.projectGrammarAttempt(attempt, set, {
          detailRetentionDays: options.detailRetentionDays,
          includeDetail,
        }),
      );
      await batch.commit();
    },
    async saveCompletedAttempt(attempt: any, set: any, leaderboardEvent: any) {
      const batch = options.db.batch();
      batch.set(options.db.collection('grammar_attempts').doc(attempt.id), attempt);
      batch.set(options.db.collection('leaderboard_events').doc(leaderboardEvent.id), leaderboardEvent);
      options.appendLearningHistoryProjection(
        batch,
        options.projectGrammarAttempt(attempt, set, {
          detailRetentionDays: options.detailRetentionDays,
        }),
      );
      await batch.commit();
    },
    async listAttemptsForActor(grammarSetId: string, actorField: string, actorId: string) {
      const snapshot = await options.db.collection('grammar_attempts')
        .where('grammarSetId', '==', grammarSetId)
        .where(actorField, '==', actorId)
        .get();
      return (snapshot.docs || []).map((document: any) => ({ id: document.id, ...document.data() }));
    },
  };
}
