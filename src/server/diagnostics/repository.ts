interface DiagnosticsRepositoryOptions {
  db: any;
  loadStorageDiagnostics: () => Promise<any>;
}

export function createDiagnosticsRepository(options: DiagnosticsRepositoryOptions) {
  return {
    async countProbeUsers() {
      const snapshot = await options.db.collection('users').limit(1).get();
      return snapshot.size;
    },
    getStorageDiagnostics() {
      return options.loadStorageDiagnostics();
    },
  };
}
