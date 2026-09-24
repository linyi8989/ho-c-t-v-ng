import { archiveResourceRecord, isArchivedRecord } from '../resourceLifecycle.js';

interface ClassManagementRepositoryOptions {
  db: any;
}

function snapshotRecords(snapshot: any) {
  const records: any[] = [];
  snapshot.forEach((document: any) => records.push({ id: document.id, ...document.data() }));
  return records;
}

export function createClassManagementRepository({ db }: ClassManagementRepositoryOptions) {
  return {
    async listActiveClasses() {
      const snapshot = await db.collection('classes').get();
      return snapshotRecords(snapshot).filter(record => !isArchivedRecord(record));
    },

    async getClass(id: string) {
      const document = await db.collection('classes').doc(id).get();
      return document.exists ? { id: document.id, ...document.data() } : null;
    },

    async createClass(record: any) {
      await db.collection('classes').doc(record.id).set(record);
    },

    async archiveClassAndAssignments(record: any, actorId: string, archivedAt: string) {
      const classRef = db.collection('classes').doc(record.id);
      const assignmentsSnapshot = await db.collection('assignments').where('classId', '==', record.id).get();
      const batch = db.batch();
      batch.set(classRef, archiveResourceRecord(record, actorId, archivedAt));
      assignmentsSnapshot.forEach((document: any) => {
        batch.set(
          document.ref,
          archiveResourceRecord({ id: document.id, ...document.data() }, actorId, archivedAt, {
            revokeShareToken: true,
          }),
        );
      });
      await batch.commit();
    },

    async listClassMembers() {
      return snapshotRecords(await db.collection('class_members').get());
    },

    async getClassMember(id: string) {
      const document = await db.collection('class_members').doc(id).get();
      return document.exists ? { id: document.id, ...document.data() } : null;
    },

    async createClassMember(record: any) {
      await db.collection('class_members').doc(record.id).set(record);
    },

    async deleteClassMember(id: string) {
      await db.collection('class_members').doc(id).delete();
    },
  };
}
