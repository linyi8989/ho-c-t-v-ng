import express from 'express';
import type { AssignmentActor } from './contracts.js';

interface AssignmentManagementRouterOptions {
  authenticateUser: express.RequestHandler;
  requireStaff: express.RequestHandler;
  sendApiError: (response: express.Response, error: any) => void;
  service: ReturnType<typeof import('./service.js').createAssignmentManagementService>;
}

export function createAssignmentManagementRouter(options: AssignmentManagementRouterOptions) {
  const router = express.Router();
  const actor = (request: express.Request) => request.user as AssignmentActor | undefined;
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

  router.get("/assignments", options.authenticateUser, handle(
    request => options.service.listAssignments(actor(request)),
  ));
  router.post("/assignments", options.authenticateUser, options.requireStaff, handle(
    request => options.service.createAssignment(actor(request), request.body),
    201,
  ));
  router.delete("/assignments/:id", options.authenticateUser, options.requireStaff, handle(
    request => options.service.archiveAssignment(actor(request), String(request.params.id || '')),
  ));

  return router;
}
