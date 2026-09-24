import express from 'express';

interface VocabularyRunRouterOptions {
  authenticateOptionalUser: express.RequestHandler;
  createApiTiming: (request: express.Request, label: string) => { mark(label: string): void; finish(response: express.Response): void };
  sendApiError: (response: express.Response, error: any) => void;
  service: ReturnType<typeof import('./service.js').createVocabularyRunService>;
}

export function createVocabularyRunRouter(options: VocabularyRunRouterOptions) {
  const router = express.Router();
  const timed = (label: string, action: (request: express.Request, timing: any) => Promise<any>): express.RequestHandler => async (request, response) => {
    const timing = options.createApiTiming(request, label);
    try {
      const result = await action(request, timing);
      timing.finish(response);
      response.status(result.status || 200).json(result.body);
    } catch (error: any) {
      timing.finish(response);
      options.sendApiError(response, error);
    }
  };
  const plain = (action: (request: express.Request) => Promise<any>): express.RequestHandler => async (request, response) => {
    try {
      const result = await action(request);
      response.status(result.status || 200).json(result.body);
    } catch (error: any) {
      options.sendApiError(response, error);
    }
  };

  router.post("/game-sessions/activate", options.authenticateOptionalUser, timed(
    'POST /api/game-sessions/activate', (request, timing) => options.service.activateSession(request, timing),
  ));
  router.post("/game-sessions/lazy-complete", options.authenticateOptionalUser, timed(
    'POST /api/game-sessions/lazy-complete', (request, timing) => options.service.lazyComplete(request, timing),
  ));
  router.post("/game-sessions", options.authenticateOptionalUser, timed(
    'POST /api/game-sessions', (request, timing) => options.service.startSession(request, timing),
  ));
  router.put("/game-sessions/:id", options.authenticateOptionalUser, plain(
    request => options.service.updateSession(request),
  ));
  router.put("/game-sessions/:id/actions/:actionId", options.authenticateOptionalUser, timed(
    'PUT /api/game-sessions/:id/actions/:actionId', (request, timing) => options.service.saveAction(request, timing),
  ));
  router.post("/game-sessions/:id/submit", options.authenticateOptionalUser, timed(
    'POST /api/game-sessions/:id/submit', (request, timing) => options.service.submitSession(request, timing),
  ));
  router.post("/pronunciation-attempts", options.authenticateOptionalUser, plain(
    request => options.service.savePronunciationAttempt(request),
  ));
  return router;
}
