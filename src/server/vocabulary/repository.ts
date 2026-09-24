import { archiveResourceRecord, isArchivedRecord } from '../resourceLifecycle.js';

interface VocabularyRepositoryOptions {
  db: any;
  resolveImageReferences: (payload: any, existing: any, db: any) => Promise<any>;
}

function snapshotRecords(snapshot: any) {
  const records: any[] = [];
  snapshot.forEach((document: any) => records.push({ id: document.id, ...document.data() }));
  return records;
}

export function createVocabularyRepository(options: VocabularyRepositoryOptions) {
  return {
    async listActiveSets() {
      return snapshotRecords(await options.db.collection('vocab_sets').get())
        .filter(record => !isArchivedRecord(record));
    },
    async getSet(id: string) {
      const document = await options.db.collection('vocab_sets').doc(id).get();
      return document.exists ? { id: document.id, ...document.data() } : null;
    },
    resolveImageReferences(payload: any, existing: any) {
      return options.resolveImageReferences(payload, existing, options.db);
    },
    async saveSet(record: any) {
      await options.db.collection('vocab_sets').doc(record.id).set(record);
    },
    async listAssignmentsForVocab(vocabSetId: string) {
      const snapshot = await options.db.collection('assignments').where('vocabSetId', '==', vocabSetId).get();
      return (snapshot.docs || []).map((document: any) => ({
        record: { id: document.id, ...document.data() },
        ref: document.ref,
      }));
    },
    async listActiveClasses() {
      return snapshotRecords(await options.db.collection('classes').get())
        .filter(record => !isArchivedRecord(record));
    },
    async listGameSessions(vocabSetId: string) {
      return snapshotRecords(
        await options.db.collection('game_sessions').where('vocabSetId', '==', vocabSetId).get(),
      );
    },
    async archiveSetAndAssignments(set: any, assignments: any[], actorId: string, archivedAt: string) {
      const batch = options.db.batch();
      batch.set(
        options.db.collection('vocab_sets').doc(set.id),
        archiveResourceRecord(set, actorId, archivedAt, {
          forceDraftVisibility: true,
          revokeShareToken: true,
        }),
      );
      for (const assignment of assignments) {
        batch.set(
          assignment.ref,
          archiveResourceRecord(assignment.record, actorId, archivedAt, { revokeShareToken: true }),
        );
      }
      await batch.commit();
    },
  };
}
