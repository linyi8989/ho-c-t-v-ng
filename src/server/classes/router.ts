import express from 'express';
import type { ClassActor } from './contracts.js';

interface ClassManagementRouterOptions {
  authenticateUser: express.RequestHandler;
  requireStaff: express.RequestHandler;
  sendApiError: (response: express.Response, error: any) => void;
  service: ReturnType<typeof import('./service.js').createClassManagementService>;
}

export function createClassManagementRouter(options: ClassManagementRouterOptions) {
  const router = express.Router();
  const actor = (request: express.Request) => request.user as ClassActor | undefined;
  const handle = (
    action: (request: express.Request) => Promise<any>,
    status = 200,
  ): express.RequestHandler => async (request, response) => {
    try {
      const body = await action(request);
      response.status(status).json(body);
    } catch (error: any) {
      options.sendApiError(response, error);
    }
  };

  router.get("/classes", options.authenticateUser, handle(
    request => options.service.listClasses(actor(request)),
  ));
  router.post("/classes", options.authenticateUser, options.requireStaff, handle(
    request => options.service.createClass(actor(request), request.body),
    201,
  ));
  router.delete("/classes/:id", options.authenticateUser, options.requireStaff, handle(
    request => options.service.archiveClass(actor(request), String(request.params.id || '')),
  ));
  router.get("/class-members", options.authenticateUser, handle(
    request => options.service.listClassMembers(actor(request)),
  ));
  router.post("/classes/:classId/members", options.authenticateUser, options.requireStaff, handle(
    request => options.service.addClassMember(actor(request), String(request.params.classId || ''), request.body),
    201,
  ));
  router.delete("/classes/:classId/members/:memberId", options.authenticateUser, options.requireStaff, handle(
    request => options.service.removeClassMember(
      actor(request),
      String(request.params.classId || ''),
      String(request.params.memberId || ''),
    ),
  ));

  return router;
}
