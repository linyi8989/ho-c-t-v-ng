import express from 'express';

interface VocabularyAiRouterOptions {
  authenticateUser: express.RequestHandler;
  requireStaff: express.RequestHandler;
  rateLimit: express.RequestHandler;
  sendApiError: (response: express.Response, error: any) => void;
  service: ReturnType<typeof import('./service.js').createVocabularyAiService>;
}

export function createVocabularyAiRouter(options: VocabularyAiRouterOptions) {
  const router = express.Router();
  const handle = (action: (request: express.Request) => Promise<any>): express.RequestHandler => async (request, response) => {
    try {
      response.json(await action(request));
    } catch (error: any) {
      options.sendApiError(response, error);
    }
  };
  router.post("/ai/ipa", options.authenticateUser, options.rateLimit, handle(request => (
    options.service.generateIpa(request.body?.word)
  )));
  router.post("/ai/vocab-detail", options.authenticateUser, options.rateLimit, handle(request => (
    options.service.generateVocabDetail(request.body?.word, request.body?.meaning, request.body?.grade)
  )));
  router.post("/ai/generate", options.authenticateUser, options.requireStaff, options.rateLimit, handle(request => (
    options.service.generateVocabulary(request.body?.topic, request.body?.grade, request.body?.wordsCount ?? 5)
  )));
  return router;
}
