import express from 'express';

interface TtsRouterOptions {
  authenticateUser: express.RequestHandler;
  requireStaff: express.RequestHandler;
  rateLimit: express.RequestHandler;
  sendApiError: (response: express.Response, error: any) => void;
  service: ReturnType<typeof import('./service.js').createTtsService>;
}

export function createTtsRouter(options: TtsRouterOptions) {
  const router = express.Router();
  const handle = (action: (request: express.Request) => Promise<any>): express.RequestHandler => async (request, response) => {
    try {
      response.json(await action(request));
    } catch (error: any) {
      options.sendApiError(response, error);
    }
  };
  router.post("/tts/preview", options.authenticateUser, options.requireStaff, options.rateLimit, handle(request => (
    options.service.preview(request.body)
  )));
  router.post("/tts/batch-preview", options.authenticateUser, options.requireStaff, options.rateLimit, handle(request => (
    options.service.batchPreview(request.body)
  )));
  router.get("/tts/voices", options.authenticateUser, options.requireStaff, options.rateLimit, async (request, response) => {
    try {
      const result = await options.service.listVoices(request.query);
      response.status(result.status).json(result.data);
    } catch (error: any) {
      options.sendApiError(response, error);
    }
  });
  return router;
}
