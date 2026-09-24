interface DiagnosticsServiceOptions {
  repository: ReturnType<typeof import('./repository.js').createDiagnosticsRepository>;
}

export function createDiagnosticsService(options: DiagnosticsServiceOptions) {
  return {
    async getAuthDebug() {
      return {
        success: true,
        docsCount: await options.repository.countProbeUsers(),
        storageReady: true,
      };
    },
    getStorageDiagnostics() {
      return options.repository.getStorageDiagnostics();
    },
  };
}
