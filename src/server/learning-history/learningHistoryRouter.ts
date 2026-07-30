import express from 'express';
import type { NextFunction, RequestHandler } from 'express';
import { resolveLearningHistoryActor } from './learningHistoryAuth';
import {
  getLearningHistory,
  getLearningHistoryDetail,
  type LearningHistoryServiceOptions,
} from './learningHistoryService';
import {
  parseLearningHistoryFilters,
  validateAttemptId,
} from './learningHistoryValidation';

export interface LearningHistoryRouterOptions extends LearningHistoryServiceOptions {
  enabled: boolean;
  authenticateOptionalUser?: RequestHandler;
  slowRequestMs?: number;
}

function errorStatus(error: any) {
  const status = Number(error?.status || error?.statusCode || 500);
  return Number.isInteger(status) && status >= 400 && status <= 599 ? status : 500;
}

function errorBody(error: any, status: number) {
  if (status >= 500) {
    return { error: 'Không thể tải lịch sử học tập.', code: 'HISTORY_INTERNAL_ERROR' };
  }
  return {
    error: String(error?.message || 'Yêu cầu không hợp lệ.'),
    code: String(error?.code || 'HISTORY_REQUEST_FAILED'),
  };
}

function withHistoryTiming(
  label: string,
  slowRequestMs: number,
  handler: RequestHandler,
): RequestHandler {
  return async (req, res, next: NextFunction) => {
    const startedAt = performance.now();
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      const durationMs = Math.max(0, performance.now() - startedAt);
      if (!res.headersSent) {
        res.setHeader('Server-Timing', `history;dur=${durationMs.toFixed(1)}`);
      }
      if (durationMs >= slowRequestMs) {
        console.warn(`[PERF] ${label} total=${durationMs.toFixed(1)}ms`);
      }
    };
    const sendJson = res.json.bind(res);
    res.json = ((body: any) => {
      finish();
      return sendJson(body);
    }) as typeof res.json;
    try {
      await handler(req, res, next);
    } finally {
      finish();
    }
  };
}

export function createLearningHistoryRouter(options: LearningHistoryRouterOptions) {
  const router = express.Router();
  const slowRequestMs = Math.max(0, Number(options.slowRequestMs || 500));

  router.use((_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!options.enabled) {
      return res.status(404).json({
        error: 'Lịch sử học tập chưa được bật.',
        code: 'LEARNING_HISTORY_DISABLED',
      });
    }
    next();
  });
  if (options.authenticateOptionalUser) {
    router.use(options.authenticateOptionalUser);
  }

  router.get('/', withHistoryTiming(
    'GET /api/my-learning-history',
    slowRequestMs,
    async (req, res) => {
      try {
        const actor = await resolveLearningHistoryActor(req);
        const filters = parseLearningHistoryFilters(req.query as Record<string, unknown>);
        const response = await getLearningHistory(actor, filters);
        res.json(response);
      } catch (error: any) {
        const status = errorStatus(error);
        res.status(status).json(errorBody(error, status));
      }
    },
  ));

  router.get('/:attemptId', withHistoryTiming(
    'GET /api/my-learning-history/:attemptId',
    slowRequestMs,
    async (req, res) => {
      try {
        const actor = await resolveLearningHistoryActor(req);
        const attemptId = validateAttemptId(req.params.attemptId);
        const response = await getLearningHistoryDetail(actor, attemptId, options);
        res.json(response);
      } catch (error: any) {
        const status = errorStatus(error);
        res.status(status).json(errorBody(error, status));
      }
    },
  ));

  return router;
}
