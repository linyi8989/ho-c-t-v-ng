import { archiveResourceRecord, isArchivedRecord } from '../resourceLifecycle.js';

interface AssignmentManagementRepositoryOptions {
  db: any;
}

function snapshotRecords(snapshot: any) {
  const records: any[] = [];
  for (const document of snapshot.docs || []) {
    records.push({ id: document.id, ...document.data() });
  }
  return records;
}

export function createAssignmentManagementRepository({ db }: AssignmentManagementRepositoryOptions) {
  return {
    async listActiveClasses() {
      return snapshotRecords(await db.collection('classes').get())
        .filter(record => !isArchivedRecord(record));
    },

    async listActiveAssignments() {
      return snapshotRecords(await db.collection('assignments').get())
        .filter(record => !isArchivedRecord(record));
    },

    async getClass(id: string) {
      const document = await db.collection('classes').doc(id).get();
      return document.exists ? { id: document.id, ...document.data() } : null;
    },

    async getResource(collection: string, id: string) {
      const document = await db.collection(collection).doc(id).get();
      return document.exists ? { id: document.id, ...document.data() } : null;
    },

    async saveAssignment(record: any) {
      await db.collection('assignments').doc(record.id).set(record);
    },

    async getAssignment(id: string) {
      const document = await db.collection('assignments').doc(id).get();
      return document.exists ? { id: document.id, ...document.data() } : null;
    },

    async archiveAssignment(record: any, actorId: string, archivedAt: string) {
      await db.collection('assignments').doc(record.id).set(
        archiveResourceRecord(record, actorId, archivedAt, { revokeShareToken: true }),
      );
    },
  };
}
