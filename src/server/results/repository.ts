interface ResultsRepositoryOptions {
  db: any;
  loadLeaderboardEvents: (timing?: any, cutoff?: string) => Promise<any[]>;
  loadReadyLeaderboardEvents: (timing?: any, cutoff?: string) => Promise<any[] | null>;
  resolveListeningDetail: (db: any, attempt: any, cache?: Map<any, any>) => Promise<any>;
}

function records(snapshot: any) {
  const result: any[] = [];
  snapshot.forEach((document: any) => result.push({ id: document.id, ...document.data() }));
  return result;
}

export function createResultsRepository(options: ResultsRepositoryOptions) {
  const loadRecent = async (collectionName: string, cutoff: string, limit?: number | null) => {
    let query: any = options.db.collection(collectionName).where('completedAt', '>=', cutoff);
    if (limit) query = query.orderBy('completedAt', 'desc').limit(limit);
    return records(await query.get());
  };

  const loadMap = async (collectionName: string) => {
    const map = new Map<string, any>();
    for (const record of records(await options.db.collection(collectionName).get())) map.set(record.id, record);
    return map;
  };

  return {
    async loadActivitySources(cutoff: string, limit?: number | null, includeMembers = false) {
      const [gameSessions, grammarAttempts, listeningAttempts, grammarSets, vocabSets, listeningSets, assignments, classes, members] = await Promise.all([
        loadRecent('game_sessions', cutoff, limit),
        loadRecent('grammar_attempts', cutoff, limit),
        loadRecent('listening_attempts', cutoff, limit),
        loadMap('grammar_sets'),
        loadMap('vocab_sets'),
        includeMembers ? Promise.resolve(new Map<string, any>()) : loadMap('listening_sets'),
        loadMap('assignments'),
        loadMap('classes'),
        includeMembers ? loadMap('class_members') : Promise.resolve(new Map<string, any>()),
      ]);
      return { gameSessions, grammarAttempts, listeningAttempts, grammarSets, vocabSets, listeningSets, assignments, classes, members };
    },
    async loadScopeMetadata() {
      const [grammarSets, vocabSets, assignments, classes] = await Promise.all([
        loadMap('grammar_sets'), loadMap('vocab_sets'), loadMap('assignments'), loadMap('classes'),
      ]);
      return { grammarSets, vocabSets, assignments, classes };
    },
    async getRecord(collectionName: string, id: string) {
      const document = await options.db.collection(collectionName).doc(id).get();
      return document.exists ? { id: document.id, ...document.data() } : null;
    },
    async getClasses(ids: string[]) {
      const documents = await Promise.all(ids.map(id => options.db.collection('classes').doc(id).get()));
      const map = new Map<string, any>();
      for (const document of documents) if (document.exists) map.set(document.id, { id: document.id, ...document.data() });
      return map;
    },
    loadLeaderboardEvents: options.loadLeaderboardEvents,
    loadReadyLeaderboardEvents: options.loadReadyLeaderboardEvents,
    async resolveListeningDetail(attempt: any, cache?: Map<any, any>) {
      return options.resolveListeningDetail(options.db, attempt, cache);
    },
  };
}
