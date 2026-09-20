import express from "express";
import { createFixedWindowRateLimiter } from "../httpHardening.js";
import { VocabImageLibraryService } from "./service.js";

interface VocabImageRouterOptions {
  service: VocabImageLibraryService;
  authenticateUser: express.RequestHandler;
  requireStaff: express.RequestHandler;
  logAudit: (
    userId: string,
    userName: string,
    userEmail: string,
    action: string,
    details: string
  ) => Promise<void>;
}

function sendError(res: express.Response, error: any) {
  const requested = Number(error?.status || error?.statusCode || 500);
  const status = Number.isInteger(requested) && requested >= 400 && requested <= 599 ? requested : 500;
  const expose = status < 500 || process.env.NODE_ENV !== "production";
  res.status(status).json({
    error: expose ? String(error?.message || "Yêu cầu ảnh thất bại.").slice(0, 500) : "Yêu cầu ảnh thất bại.",
  });
}

function requestFileName(req: express.Request) {
  const encoded = String(req.header("x-image-file-name") || "image");
  try {
    return decodeURIComponent(encoded);
  } catch {
    return "image";
  }
}

export function createVocabImageRouter(options: VocabImageRouterOptions) {
  const router = express.Router();
  const rateLimit = createFixedWindowRateLimiter({
    namespace: "vocab-image-generation",
    windowMs: 10 * 60 * 1000,
    maxCost: 120,
    cost: req => {
      if (req.path === "/batch-generate") return Math.min(100, Math.max(1, req.body?.items?.length || 1));
      if (req.path === "/generate") return 2;
      return 1;
    },
    message: "Đã đạt giới hạn tạo ảnh tạm thời. Vui lòng chờ rồi thử lại.",
  });
  const jobStatusRateLimit = createFixedWindowRateLimiter({
    namespace: "vocab-image-generation-status",
    windowMs: 10 * 60 * 1000,
    maxCost: 600,
    message: "Đã kiểm tra trạng thái tạo ảnh quá thường xuyên. Vui lòng chờ rồi thử lại.",
  });

  router.use(options.authenticateUser, options.requireStaff);

  router.get("/batch-generate/:jobId", jobStatusRateLimit, async (req, res) => {
    try {
      const user = (req as any).user;
      res.json(await options.service.getBatchGenerationJob(req.params.jobId, user.id));
    } catch (error) {
      sendError(res, error);
    }
  });

  router.use(rateLimit);

  router.get("/providers", (_req, res) => {
    res.json({ providers: options.service.listProviders() });
  });

  router.post("/prompt", (req, res) => {
    try {
      res.json({ prompt: options.service.getDefaultPrompt(req.body) });
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post("/generate", async (req, res) => {
    try {
      const user = (req as any).user;
      const result = await options.service.generate(req.body?.provider, req.body, user.id, req.body?.prompt);
      await options.logAudit(
        user.id,
        user.name,
        user.email,
        "GENERATE_VOCAB_IMAGE",
        `Generated ${result.asset.id} with ${result.provider}/${result.model}.`
      );
      res.status(201).json(result);
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post("/batch-generate", async (req, res) => {
    try {
      const user = (req as any).user;
      const job = await options.service.startBatchGenerationJob(req.body?.provider, req.body?.items, user.id);
      void options.logAudit(
        user.id,
        user.name,
        user.email,
        "BATCH_GENERATE_VOCAB_IMAGES",
        `Queued vocabulary image batch ${job.jobId} with ${job.total} items.`
      ).catch(error => console.error("[Vocab image batch] Audit write failed:", {
        jobId: job.jobId,
        message: String(error?.message || error).slice(0, 300),
      }));
      res.status(202).json(job);
    } catch (error) {
      sendError(res, error);
    }
  });

  router.post(
    "/upload",
    express.raw({ type: ["image/jpeg", "image/png", "image/webp", "image/gif"], limit: options.service.uploadLimitBytes }),
    async (req, res) => {
      try {
        const user = (req as any).user;
        if (!Buffer.isBuffer(req.body)) throw httpBodyError();
        const asset = await options.service.upload({
          bytes: req.body,
          declaredMimeType: req.header("content-type") || undefined,
          fileName: requestFileName(req),
          rightsConfirmed: req.header("x-image-rights-confirmed") === "true",
        }, user.id);
        await options.logAudit(
          user.id,
          user.name,
          user.email,
          "UPLOAD_VOCAB_IMAGE",
          `Uploaded managed vocabulary image ${asset.id}.`
        );
        res.status(201).json({ asset });
      } catch (error) {
        sendError(res, error);
      }
    }
  );

  return router;
}

function httpBodyError() {
  return Object.assign(new Error("Nội dung tải lên phải là ảnh JPEG, PNG, WebP hoặc GIF."), { status: 415 });
}
