import express from 'express';

interface VocabularyRouterOptions {
  authenticateUser: express.RequestHandler;
  requireStaff: express.RequestHandler;
  ttsRateLimit: express.RequestHandler;
  createApiTiming: (request: express.Request, label: string) => { mark(label: string): void; finish(response: express.Response): void };
  sendApiError: (response: express.Response, error: any) => void;
  service: ReturnType<typeof import('./service.js').createVocabularyService>;
}

export function createVocabularyRouter(options: VocabularyRouterOptions) {
  const router = express.Router();
  const handle = (
    action: (request: express.Request) => Promise<any>,
    status = 200,
  ): express.RequestHandler => async (request, response) => {
    try {
      response.status(status).json(await action(request));
    } catch (error: any) {
      options.sendApiError(response, error);
    }
  };

  router.get("/vocab-sets/share/:token", async (request, response) => {
    const timing = options.createApiTiming(request, 'GET /api/vocab-sets/share/:token');
    try {
      const result = await options.service.openSharedSet(request.params.token, timing);
      timing.mark('shape');
      timing.finish(response);
      response.json(result);
    } catch (error: any) {
      timing.finish(response);
      options.sendApiError(response, error);
    }
  });
  router.get("/public/vocab-sets", handle(() => options.service.listPublicSets()));
  router.get("/vocab-sets", options.authenticateUser, handle(request => (
    options.service.listSets(request.user, request.query)
  )));
  router.post("/vocab-sets", options.authenticateUser, options.requireStaff, handle(request => (
    options.service.createSet(request.user, request.body)
  ), 201));
  router.put("/vocab-sets/:id", options.authenticateUser, options.requireStaff, handle(request => (
    options.service.updateSet(request.user, String(request.params.id || ''), request.body)
  )));
  router.get("/vocab-sets/:id/audio/status", options.authenticateUser, options.requireStaff, handle(request => (
    options.service.getAudioStatus(request.user, String(request.params.id || ''))
  )));
  router.get("/vocab-sets/:id/images/status", options.authenticateUser, options.requireStaff, handle(request => (
    options.service.getImageStatus(request.user, String(request.params.id || ''))
  )));
  router.post("/vocab-sets/:id/audio/generate-missing", options.authenticateUser, options.requireStaff, options.ttsRateLimit, handle(request => (
    options.service.queueMissingAudio(request.user, String(request.params.id || ''), request.body)
  )));
  router.delete("/vocab-sets/:id", options.authenticateUser, options.requireStaff, handle(request => (
    options.service.archiveSet(request.user, String(request.params.id || ''))
  )));
  router.post("/vocab-sets/:id/clone", options.authenticateUser, options.requireStaff, handle(request => (
    options.service.cloneSet(request.user, String(request.params.id || ''))
  )));
  router.get("/admin/vocab-sets/:id/preview", options.authenticateUser, options.requireStaff, handle(request => (
    options.service.previewSet(request.user, String(request.params.id || ''))
  )));
  router.get("/admin/vocab-sets/:id/results", options.authenticateUser, options.requireStaff, handle(request => (
    options.service.getResults(request.user, String(request.params.id || ''))
  )));
  return router;
}
