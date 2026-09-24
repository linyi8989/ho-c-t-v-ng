export type AdminActor = {
  id: string;
  role: "teacher" | "super_admin";
  name?: string;
};

export type AdminPageRequest = {
  page: number;
  pageSize: number;
  search: string;
  grade: string;
  status: string;
  role: string;
};

export type AdminPage<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  facets?: {
    grades?: string[];
  };
};

export type AdminVocabSetSummary = {
  id: string;
  title: string;
  description: string;
  subject: string;
  tags: string[];
  gradeLevel: string;
  createdAt: string;
  createdBy: string;
  creatorName: string;
  status: string;
  visibility: "public" | "assignment" | "draft";
  shareToken?: string;
  assignmentSlug?: string;
  itemCount: number;
};

export type AdminGrammarSetSummary = {
  id: string;
  title: string;
  description: string;
  gradeLevel: string;
  subject: string;
  topic: string;
  tags: string[];
  visibility: "public" | "assignment" | "draft";
  status?: string;
  shareToken?: string;
  assignmentSlug?: string;
  questionType?: string;
  timeLimitMinutes: number;
  maxAttempts: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showExplanationImmediately: boolean;
  showReviewAfterSubmit: boolean;
  createdBy: string;
  creatorName?: string;
  createdAt: string;
  updatedAt: string;
  questionCount: number;
};

export type AdminDashboardCounts = {
  vocabSets: number;
  grammarSets: number;
  classes: number;
  assignments: number;
};

export type AdminDashboardSummary = {
  counts: AdminDashboardCounts & {
    activities: number;
    honoredStudents: number;
  };
  recentActivities: any[];
  goldRows: any[];
};

export function parseAdminPageRequest(query: Record<string, unknown>): AdminPageRequest {
  const requestedPage = Number(query.page || 1);
  const requestedPageSize = Number(query.pageSize || 10);
  return {
    page: Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1,
    pageSize: Number.isFinite(requestedPageSize)
      ? Math.min(100, Math.max(1, Math.floor(requestedPageSize)))
      : 10,
    search: String(query.search || "").trim().slice(0, 200),
    grade: String(query.grade || "").trim().slice(0, 80),
    status: String(query.status || "").trim().slice(0, 40),
    role: String(query.role || "").trim().slice(0, 40),
  };
}
