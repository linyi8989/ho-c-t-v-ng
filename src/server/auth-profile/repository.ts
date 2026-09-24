interface AuthProfileRepositoryOptions {
  db: any;
}

export function createAuthProfileRepository({ db }: AuthProfileRepositoryOptions) {
  return {
    async findUserByPhone(normalizedPhone: string, rawPhone = '') {
      const candidates = Array.from(new Set([
        normalizedPhone,
        rawPhone.trim(),
        rawPhone.replace(/[^\d+]/g, '').trim(),
      ].filter(Boolean)));
      for (const candidate of candidates) {
        const snapshot = await db.collection('users').where('phone', '==', candidate).limit(1).get();
        if (!snapshot.empty) {
          const document = snapshot.docs[0];
          return { id: document.id, ...document.data() };
        }
      }
      return null;
    },
    async saveUser(record: any) {
      await db.collection('users').doc(record.id).set(record);
    },
  };
}
