interface GuestIdentityRepositoryOptions {
  db: any;
}

export function createGuestIdentityRepository({ db }: GuestIdentityRepositoryOptions) {
  return {
    async getProfile(id: string) {
      const document = await db.collection('guest_profiles').doc(id).get();
      return document.exists ? { id: document.id, ...document.data() } : null;
    },
    async setProfile(record: any) {
      await db.collection('guest_profiles').doc(record.id).set(record);
    },
    async updateProfile(id: string, patch: any) {
      await db.collection('guest_profiles').doc(id).update(patch);
    },
  };
}
