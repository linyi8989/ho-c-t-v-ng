import express from 'express';

interface AccountRouterOptions {
  authenticateUser: express.RequestHandler;
  requireStaff: express.RequestHandler;
  requireSuperAdmin: express.RequestHandler;
  sendApiError: (response: express.Response, error: any) => void;
  service: ReturnType<typeof import('./service.js').createAccountService>;
}

export function createAccountRouter(options: AccountRouterOptions) {
  const router = express.Router();
  const handle = (action: (request: express.Request) => Promise<any>): express.RequestHandler => async (request, response) => {
    try {
      const result = await action(request);
      response.status(result.status || 200).json(result.body);
    } catch (error: any) {
      options.sendApiError(response, error);
    }
  };
  const superAdmin = [options.authenticateUser, options.requireSuperAdmin];
  const staff = [options.authenticateUser, options.requireStaff];

  router.get('/admin/users', ...superAdmin, handle(request => options.service.listUsers(request)));
  router.get('/admin/accounts', ...staff, handle(request => options.service.listAccounts(request)));
  router.put('/admin/users/:userId/display-name', ...superAdmin, handle(request => options.service.updateUserDisplayName(request)));
  router.put('/admin/guest-profiles/:guestId/display-name', ...staff, handle(request => options.service.updateGuestDisplayName(request)));
  router.put('/admin/guest-profiles/:guestId/status', ...superAdmin, handle(request => options.service.updateGuestStatus(request)));
  router.post('/admin/guest-profiles/:guestId/history-capability', ...staff, handle(request => options.service.rotateGuestHistoryCapability(request)));
  router.put('/admin/users/:userId/role', ...superAdmin, handle(request => options.service.updateUserRole(request)));
  router.put('/admin/users/:userId/status', ...superAdmin, handle(request => options.service.updateUserStatus(request)));
  router.get('/admin/audit-logs', ...superAdmin, handle(request => options.service.listAuditLogs(request)));
  return router;
}
