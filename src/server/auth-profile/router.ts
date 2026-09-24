import express from 'express';

interface AuthProfileRouterOptions {
  authenticateUser: express.RequestHandler;
  getRequestNetworkKey: (request: express.Request) => string;
  sendApiError: (response: express.Response, error: any) => void;
  service: ReturnType<typeof import('./service.js').createAuthProfileService>;
}

export function createAuthProfileRouter(options: AuthProfileRouterOptions) {
  const router = express.Router();
  const handle = (action: (request: express.Request) => Promise<any>): express.RequestHandler => async (request, response) => {
    try {
      response.json(await action(request));
    } catch (error: any) {
      options.sendApiError(response, error);
    }
  };

  router.post("/auth/email-by-phone", handle(request => (
    options.service.getPhoneLoginHint(request.body?.phone, options.getRequestNetworkKey(request))
  )));
  router.post("/auth/login-by-phone", handle(request => (
    options.service.loginByPhone(
      request.body?.phone,
      request.body?.password,
      options.getRequestNetworkKey(request),
    )
  )));
  router.get("/me", options.authenticateUser, (request, response) => response.json(request.user));
  router.post("/register", options.authenticateUser, handle(request => (
    options.service.registerProfile(request.user, request.body)
  )));
  return router;
}
