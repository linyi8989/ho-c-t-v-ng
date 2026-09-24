import type {
  AdminActor,
  AdminDashboardSummary,
  AdminPageRequest,
} from "./contracts.js";

type AdminDataServiceOptions = {
  repository: ReturnType<typeof import("./repository.js").createAdminDataRepository>;
  db: any;
  canViewVocabSet: (actor: AdminActor, record: any) => boolean;
  canViewGrammarSet: (actor: AdminActor, record: any) => boolean;
  sanitizeVocabSet: (record: any) => any;
  loadDashboardActivity: (actor: AdminActor) => Promise<{
    total: number;
    recentActivities: any[];
    goldRows: any[];
  }>;
  prepareAssignment?: (record: any) => Promise<any>;
  loadAccountsPage: (actor: AdminActor, request: AdminPageRequest) => Promise<any>;
  loadAuditPage: (actor: AdminActor, request: AdminPageRequest) => Promise<any>;
};

function notFound(message: string) {
  const error: any = new Error(message);
  error.status = 404;
  return error;
}

export function createAdminDataService(options: AdminDataServiceOptions) {
  const getVocabSetDetail = async (actor: AdminActor, id: string) => {
    const snapshot = await options.db.collection("vocab_sets").doc(id).get();
    if (!snapshot.exists) throw notFound("Vocabulary set not found.");
    const record = { id: snapshot.id, ...snapshot.data() };
    if (!options.canViewVocabSet(actor, record)) throw notFound("Vocabulary set not found.");
    return options.sanitizeVocabSet(record);
  };

  const getGrammarSetDetail = async (actor: AdminActor, id: string) => {
    const snapshot = await options.db.collection("grammar_sets").doc(id).get();
    if (!snapshot.exists) throw notFound("Grammar set not found.");
    const record = { id: snapshot.id, ...snapshot.data() };
    if (!options.canViewGrammarSet(actor, record)) throw notFound("Grammar set not found.");
    return record;
  };

  const getDashboardSummary = async (actor: AdminActor): Promise<AdminDashboardSummary> => {
    const [counts, activity] = await Promise.all([
      options.repository.getDashboardCounts(actor),
      options.loadDashboardActivity(actor),
    ]);
    return {
      counts: {
        ...counts,
        activities: activity.total,
        honoredStudents: activity.goldRows.length,
      },
      recentActivities: activity.recentActivities,
      goldRows: activity.goldRows,
    };
  };

  const listAssignments = async (actor: AdminActor, request: AdminPageRequest) => {
    const page = await options.repository.listAssignments(actor, request);
    if (!options.prepareAssignment) return page;
    return { ...page, items: await Promise.all(page.items.map(options.prepareAssignment)) };
  };

  return {
    getDashboardSummary,
    getGrammarSetDetail,
    getVocabSetDetail,
    listAssignmentOptions: (actor: AdminActor) => options.repository.listAssignmentOptions(actor),
    listAssignments,
    listAccounts: (actor: AdminActor, request: AdminPageRequest) => options.loadAccountsPage(actor, request),
    listAuditLogs: (actor: AdminActor, request: AdminPageRequest) => options.loadAuditPage(actor, request),
    listClasses: (actor: AdminActor, request: AdminPageRequest) => options.repository.listClasses(actor, request),
    listClassMembers: (actor: AdminActor, classIds: string[]) => options.repository.listClassMembers(actor, classIds),
    listGrammarSets: (actor: AdminActor, request: AdminPageRequest) => options.repository.listGrammarSets(actor, request),
    listVocabSets: (actor: AdminActor, request: AdminPageRequest) => options.repository.listVocabSets(actor, request),
  };
}
