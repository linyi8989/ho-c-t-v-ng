import express from 'express';

interface GrammarAttemptRouterOptions {
  authenticateOptionalUser: express.RequestHandler;
  createApiTiming: (request: express.Request, label: string) => { mark(label: string): void; finish(response: express.Response): void };
  sendApiError: (response: express.Response, error: any) => void;
  service: ReturnType<typeof import('./service.js').createGrammarAttemptService>;
}

export function createGrammarAttemptRouter(options: GrammarAttemptRouterOptions) {
  const router = express.Router();
  const timed = (
    label: string,
    action: (request: express.Request, timing: any) => Promise<{ status?: number; body: any }>,
  ): express.RequestHandler => async (request, response) => {
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
  const plain = (
    action: (request: express.Request) => Promise<{ status?: number; body: any }>,
  ): express.RequestHandler => async (request, response) => {
    try {
      const result = await action(request);
      response.status(result.status || 200).json(result.body);
    } catch (error: any) {
      options.sendApiError(response, error);
    }
  };

  router.post("/grammar-sets/:id/attempts/prepare", options.authenticateOptionalUser, timed(
    'POST /api/grammar-sets/:id/attempts/prepare',
    (request, timing) => options.service.prepareAttempt(request, timing),
  ));
  router.post("/grammar-sets/:id/attempts/activate", options.authenticateOptionalUser, timed(
    'POST /api/grammar-sets/:id/attempts/activate',
    (request, timing) => options.service.activateAttempt(request, timing),
  ));
  router.post("/grammar-sets/:id/attempts", options.authenticateOptionalUser, timed(
    'POST /api/grammar-sets/:id/attempts',
    (request, timing) => options.service.createAttempt(request, timing),
  ));
  router.post("/grammar-attempts/:attemptId/answers", options.authenticateOptionalUser, timed(
    'POST /api/grammar-attempts/:attemptId/answers',
    (request, timing) => options.service.saveAnswer(request, timing),
  ));
  router.post("/grammar-attempts/:attemptId/submit", options.authenticateOptionalUser, timed(
    'POST /api/grammar-attempts/:attemptId/submit',
    (request, timing) => options.service.submitAttempt(request, timing),
  ));
  router.get("/grammar-attempts/:attemptId/review", options.authenticateOptionalUser, plain(
    request => options.service.reviewAttempt(request),
  ));
  router.get("/grammar-sets/:id/my-attempts", options.authenticateOptionalUser, plain(
    request => options.service.listMyAttempts(request),
  ));
  return router;
}
