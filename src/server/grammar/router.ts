import express from 'express';

interface GrammarLibraryRouterOptions {
  authenticateUser: express.RequestHandler;
  requireStaff: express.RequestHandler;
  sendApiError: (response: express.Response, error: any) => void;
  service: ReturnType<typeof import('./service.js').createGrammarLibraryService>;
}

export function createGrammarLibraryRouter(options: GrammarLibraryRouterOptions) {
  const router = express.Router();
  const handle = (action: (request: express.Request) => Promise<any>, status = 200): express.RequestHandler => async (request, response) => {
    try {
      response.status(status).json(await action(request));
    } catch (error: any) {
      options.sendApiError(response, error);
    }
  };
  router.get("/public/grammar-sets", handle(() => options.service.listPublicSets()));
  router.get("/grammar-sets", options.authenticateUser, handle(request => options.service.listSets(request.user)));
  router.get("/grammar-sets/share/:token", handle(request => options.service.openSharedSet(request.params.token)));
  router.get("/grammar-sets/:id", options.authenticateUser, handle(request => options.service.getSet(request.user, request.params.id)));
  router.post("/admin/grammar-sets", options.authenticateUser, options.requireStaff, handle(request => options.service.createSet(request.user, request.body), 201));
  router.put("/admin/grammar-sets/:id", options.authenticateUser, options.requireStaff, handle(request => options.service.updateSet(request.user, request.params.id, request.body)));
  router.delete("/admin/grammar-sets/:id", options.authenticateUser, options.requireStaff, handle(request => options.service.archiveSet(request.user, request.params.id)));
  router.post("/admin/grammar-sets/:id/clone", options.authenticateUser, options.requireStaff, handle(request => options.service.cloneSet(request.user, request.params.id), 201));
  router.get("/admin/grammar-sets/:id/preview", options.authenticateUser, options.requireStaff, handle(request => options.service.previewSet(request.user, request.params.id)));
  router.get("/admin/grammar-sets/:id/results", options.authenticateUser, options.requireStaff, handle(request => options.service.getResults(request.user, request.params.id)));
  return router;
}
