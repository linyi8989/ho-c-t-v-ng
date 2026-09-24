import express from "express";
import { parseAdminPageRequest, type AdminActor } from "./contracts.js";

type AdminDataRouterOptions = {
  authenticateUser: express.RequestHandler;
  service: ReturnType<typeof import("./service.js").createAdminDataService>;
};

function actorFromRequest(req: express.Request): AdminActor | null {
  const user = req.user as AdminActor | undefined;
  if (!user || (user.role !== "teacher" && user.role !== "super_admin")) return null;
  return user;
}

export function createAdminDataRouter(options: AdminDataRouterOptions) {
  const router = express.Router();
  router.use(options.authenticateUser);
  router.use((req, res, next) => {
    if (!actorFromRequest(req)) return res.status(403).json({ error: "Staff access required." });
    next();
  });

  const handler = (action: (actor: AdminActor, req: express.Request) => Promise<any>) => {
    return async (req: express.Request, res: express.Response) => {
      try {
        const actor = actorFromRequest(req);
        if (!actor) return res.status(403).json({ error: "Staff access required." });
        return res.json(await action(actor, req));
      } catch (error: any) {
        console.error("Admin data request failed:", error);
        return res.status(Number(error?.status || 500)).json({ error: error?.message || "Admin data request failed." });
      }
    };
  };

  router.get("/dashboard-summary", handler(actor => options.service.getDashboardSummary(actor)));
  router.get("/vocab-sets", handler((actor, req) => options.service.listVocabSets(actor, parseAdminPageRequest(req.query as any))));
  router.get("/vocab-sets/:id", handler((actor, req) => options.service.getVocabSetDetail(actor, String(req.params.id || ""))));
  router.get("/grammar-sets", handler((actor, req) => options.service.listGrammarSets(actor, parseAdminPageRequest(req.query as any))));
  router.get("/grammar-sets/:id", handler((actor, req) => options.service.getGrammarSetDetail(actor, String(req.params.id || ""))));
  router.get("/classes", handler((actor, req) => options.service.listClasses(actor, parseAdminPageRequest(req.query as any))));
  router.get("/class-members", handler((actor, req) => {
    const classIds = String(req.query.classIds || "").split(",").map(value => value.trim()).filter(Boolean).slice(0, 100);
    return options.service.listClassMembers(actor, classIds);
  }));
  router.get("/assignments", handler((actor, req) => options.service.listAssignments(actor, parseAdminPageRequest(req.query as any))));
  router.get("/assignment-options", handler(actor => options.service.listAssignmentOptions(actor)));
  router.get("/accounts-page", handler((actor, req) => options.service.listAccounts(actor, parseAdminPageRequest(req.query as any))));
  router.get("/audit-logs-page", handler((actor, req) => options.service.listAuditLogs(actor, parseAdminPageRequest(req.query as any))));

  return router;
}
