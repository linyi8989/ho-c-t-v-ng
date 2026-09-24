import express from 'express';

interface DiagnosticsRouterOptions {
  requireDiagnosticAccess: express.RequestHandler;
  sendApiError: (response: express.Response, error: any) => void;
  service: ReturnType<typeof import('./service.js').createDiagnosticsService>;
}

export function createDiagnosticsRouter(options: DiagnosticsRouterOptions) {
  const router = express.Router();
  const handle = (action: () => Promise<any>): express.RequestHandler => async (_request, response) => {
    try {
      response.json(await action());
    } catch (error: any) {
      options.sendApiError(response, error);
    }
  };

  router.get("/auth/debug", options.requireDiagnosticAccess, handle(
    () => options.service.getAuthDebug(),
  ));
  router.get("/diagnostics/storage", options.requireDiagnosticAccess, handle(
    () => options.service.getStorageDiagnostics(),
  ));
  return router;
}
