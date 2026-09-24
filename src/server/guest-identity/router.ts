import express from 'express';

interface GuestIdentityRouterOptions {
  rateLimit: express.RequestHandler;
  createApiTiming: (request: express.Request, label: string) => {
    finish(response: express.Response): void;
    mark(label: string): void;
  };
  sendApiError: (response: express.Response, error: any) => void;
  service: ReturnType<typeof import('./service.js').createGuestIdentityService>;
}

export function createGuestIdentityRouter(options: GuestIdentityRouterOptions) {
  const router = express.Router();

  router.post("/guest-profiles/resolve", options.rateLimit, async (request, response) => {
    const timing = options.createApiTiming(request, 'POST /api/guest-profiles/resolve');
    try {
      const profile = await options.service.resolveGuestProfile(
        request.body?.guestId,
        request.body?.displayName || request.body?.studentName,
        true,
        { classId: request.body?.classId, className: request.body?.className },
        timing,
      );
      timing.finish(response);
      response.json({
        id: profile.id,
        guestId: profile.guestId || profile.id,
        displayName: profile.displayName || profile.name,
        status: profile.status,
        ...(profile.guestAccessToken
          ? {
              guestAccessToken: profile.guestAccessToken,
              guestAccessTokenVersion: profile.guestAccessTokenVersion || 1,
            }
          : {}),
      });
    } catch (error: any) {
      timing.finish(response);
      options.sendApiError(response, error);
    }
  });

  router.post("/guest-profiles/identify", options.rateLimit, async (request, response) => {
    const timing = options.createApiTiming(request, 'POST /api/guest-profiles/identify');
    try {
      const profile = await options.service.findExistingGuestIdentity(request.body?.guestId, timing);
      timing.finish(response);
      if (!profile) {
        return response.status(404).json({
          error: 'Không tìm thấy hồ sơ học sinh đã đăng ký.',
          code: 'GUEST_PROFILE_NOT_FOUND',
        });
      }
      response.json({
        id: profile.id,
        guestId: profile.guestId || profile.id,
        displayName: profile.displayName || profile.name,
        status: profile.status || 'active',
        legacy: Boolean(profile.legacy),
      });
    } catch (error: any) {
      timing.finish(response);
      options.sendApiError(response, error);
    }
  });

  return router;
}
