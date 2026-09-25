import express from 'express';

interface ResultsRouterOptions {
  authenticateUser: express.RequestHandler;
  requireStaff: express.RequestHandler;
  publicLeaderboardRateLimit: express.RequestHandler;
  createApiTiming: (request: express.Request, label: string) => { mark(label: string): void; finish(response: express.Response): void };
  sendApiError: (response: express.Response, error: any) => void;
  service: ReturnType<typeof import('./service.js').createResultsService>;
}

export function createResultsRouter(options: ResultsRouterOptions) {
  const router = express.Router();
  const timed = (label: string, action: (request: express.Request, timing: any) => Promise<any>): express.RequestHandler => async (request, response) => {
    const timing = options.createApiTiming(request, label);
    try {
      const result = await action(request, timing);
      timing.finish(response);
      for (const [name, value] of Object.entries(result.headers || {})) response.set(name, String(value));
      response.status(result.status || 200).json(result.body);
    } catch (error: any) {
      timing.finish(response);
      options.sendApiError(response, error);
    }
  };

  router.get('/public/results', timed('GET /api/public/results', (request, timing) => options.service.getPublicResults(request, timing)));
  router.get('/public/leaderboard-results', options.publicLeaderboardRateLimit, timed('GET /api/public/leaderboard-results', (_request, timing) => options.service.getPublicLeaderboardResults(timing)));
  router.get('/public/leaderboard-summary', options.publicLeaderboardRateLimit, timed('GET /api/public/leaderboard-summary', (request, timing) => options.service.getPublicLeaderboardSummary(request, timing)));
  router.get('/learning/leaderboard-summary', options.publicLeaderboardRateLimit, timed('GET /api/learning/leaderboard-summary', (request, timing) => options.service.getLearningLeaderboardSummary(request, timing)));
  router.get('/admin/leaderboard-summary', options.authenticateUser, options.requireStaff, timed('GET /api/admin/leaderboard-summary', (request, timing) => options.service.getAdminLeaderboardSummary(request, timing)));
  router.get('/results/:sourceType/:resultId', options.authenticateUser, timed('GET /api/results/:sourceType/:resultId', (request, timing) => options.service.getResultDetail(request, timing)));
  router.get('/results', options.authenticateUser, timed('GET /api/results', (request, timing) => options.service.getResults(request, timing)));
  router.get('/leaderboard-results', options.authenticateUser, timed('GET /api/leaderboard-results', (request, timing) => options.service.getLeaderboardResults(request, timing)));
  return router;
}
