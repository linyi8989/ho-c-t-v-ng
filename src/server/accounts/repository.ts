interface AccountRepositoryOptions { db: any }

function records(snapshot: any, includeDocumentId = true) {
  const result: any[] = [];
  snapshot.forEach((document: any) => {
    const data = document.data();
    result.push(includeDocumentId ? { id: data.id || document.id, ...data } : data);
  });
  return result;
}

export function createAccountRepository(options: AccountRepositoryOptions) {
  return {
    async listUsers(includeDocumentId = true) {
      return records(await options.db.collection('users').get(), includeDocumentId);
    },
    async listGuestProfiles() {
      return records(await options.db.collection('guest_profiles').get());
    },
    async getUser(id: string) {
      const document = await options.db.collection('users').doc(id).get();
      return document.exists ? { id: document.id, ...document.data() } : null;
    },
    async updateUser(id: string, changes: any) {
      await options.db.collection('users').doc(id).update(changes);
    },
    async getGuestProfile(id: string) {
      const document = await options.db.collection('guest_profiles').doc(id).get();
      return document.exists ? { id: document.id, ...document.data() } : null;
    },
    async updateGuestProfile(id: string, changes: any) {
      await options.db.collection('guest_profiles').doc(id).update(changes);
    },
    async listAuditLogs(includeDocumentId = true) {
      return records(await options.db.collection('audit_logs').orderBy('timestamp', 'desc').get(), includeDocumentId);
    },
  };
}
