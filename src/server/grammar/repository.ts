import { archiveResourceRecord, isArchivedRecord } from '../resourceLifecycle.js';

interface GrammarLibraryRepositoryOptions { db: any }

function snapshotRecords(snapshot: any) {
  const records: any[] = [];
  snapshot.forEach((document: any) => records.push({ id: document.id, ...document.data() }));
  return records;
}

export function createGrammarLibraryRepository({ db }: GrammarLibraryRepositoryOptions) {
  return {
    async listActiveSets() {
      return snapshotRecords(await db.collection('grammar_sets').get())
        .filter(record => !isArchivedRecord(record));
    },
    async getSet(id: string) {
      const document = await db.collection('grammar_sets').doc(id).get();
      return document.exists ? { id: document.id, ...document.data() } : null;
    },
    async saveSet(record: any) {
      await db.collection('grammar_sets').doc(record.id).set(record);
    },
    async archiveSet(record: any, actorId: string, archivedAt: string) {
      await db.collection('grammar_sets').doc(record.id).set(
        archiveResourceRecord(record, actorId, archivedAt, {
          forceDraftVisibility: true,
          revokeShareToken: true,
        }),
      );
    },
    async listAttempts(grammarSetId: string) {
      return snapshotRecords(
        await db.collection('grammar_attempts').where('grammarSetId', '==', grammarSetId).get(),
      );
    },
  };
}
