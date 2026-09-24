import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createAdminDataRepository } from "./repository.js";
import { createAdminDataService } from "./service.js";

function fakeDb(collections: Record<string, any[]>) {
  return {
    collection(name: string) {
      const rows = collections[name] || [];
      return {
        async get() {
          return {
            docs: rows.map(row => ({ id: row.id, data: () => ({ ...row }) })),
          };
        },
        doc(id: string) {
          return {
            async get() {
              const row = rows.find(item => item.id === id);
              return {
                id,
                exists: Boolean(row),
                data: () => row ? { ...row } : undefined,
              };
            },
          };
        },
      };
    },
  };
}

const actor = { id: "teacher-1", role: "teacher" as const, name: "Teacher" };

test("Vocabulary summary paging preserves scope and omits full items", async () => {
  const db = fakeDb({
    vocab_sets: [
      { id: "owned", title: "Owned animals", description: "", subject: "English", gradeLevel: "Lớp 3", createdBy: actor.id, createdAt: "2026-03-03", visibility: "draft", items: [{ id: "a" }] },
      { id: "public", title: "Public food", description: "", subject: "English", gradeLevel: "Lớp 4", createdBy: "teacher-2", createdAt: "2026-03-02", visibility: "public", items: [{ id: "a" }, { id: "b" }] },
      { id: "private", title: "Private", description: "", subject: "English", gradeLevel: "Lớp 5", createdBy: "teacher-2", createdAt: "2026-03-01", visibility: "draft", items: [] },
      { id: "archived", title: "Archived", description: "", subject: "English", gradeLevel: "Lớp 3", createdBy: actor.id, createdAt: "2026-03-04", visibility: "public", status: "archived", items: [] },
    ],
  });
  const repository = createAdminDataRepository({ db, storageMode: "local-json" });
  const page = await repository.listVocabSets(actor, { page: 1, pageSize: 1, search: "", grade: "", status: "", role: "" });
  assert.equal(page.total, 2);
  assert.equal(page.totalPages, 2);
  assert.equal(page.items[0].id, "owned");
  assert.equal(page.items[0].itemCount, 1);
  assert.equal(Object.hasOwn(page.items[0], "items"), false);
  assert.deepEqual(page.facets?.grades, ["Lớp 3", "Lớp 4"]);
});

test("Grammar summary search is scoped and does not expose questions", async () => {
  const db = fakeDb({
    grammar_sets: [
      { id: "owned", title: "Present Simple", description: "", subject: "Grammar", topic: "Present", gradeLevel: "Lớp 3", createdBy: actor.id, createdAt: "2026-03-03", updatedAt: "2026-03-03", visibility: "draft", questions: [{ id: "q" }] },
      { id: "public", title: "Past Simple", description: "", subject: "Grammar", topic: "Past", gradeLevel: "Lớp 4", createdBy: "teacher-2", createdAt: "2026-03-02", updatedAt: "2026-03-02", visibility: "public", questions: [] },
      { id: "private", title: "Present Advanced", description: "", subject: "Grammar", topic: "Present", gradeLevel: "Lớp 5", createdBy: "teacher-2", createdAt: "2026-03-01", updatedAt: "2026-03-01", visibility: "draft", questions: [] },
    ],
  });
  const repository = createAdminDataRepository({ db, storageMode: "local-json" });
  const page = await repository.listGrammarSets(actor, { page: 1, pageSize: 10, search: "present", grade: "", status: "", role: "" });
  assert.equal(page.total, 1);
  assert.equal(page.items[0].id, "owned");
  assert.equal(page.items[0].questionCount, 1);
  assert.equal(Object.hasOwn(page.items[0], "questions"), false);
});

test("Dashboard counts and point-read detail keep teacher scope", async () => {
  const db = fakeDb({
    vocab_sets: [
      { id: "owned", createdBy: actor.id, visibility: "draft", items: [{ audioPath: "secret", term: "apple" }] },
      { id: "hidden", createdBy: "teacher-2", visibility: "draft", items: [] },
    ],
    grammar_sets: [{ id: "grammar", createdBy: actor.id, visibility: "public", questions: [] }],
    classes: [{ id: "class", teacherId: actor.id }, { id: "other-class", teacherId: "teacher-2" }],
    assignments: [
      { id: "assignment", classId: "class", createdBy: actor.id },
      { id: "class-assignment", classId: "class", createdBy: "teacher-2" },
      { id: "other-assignment", classId: "other-class", createdBy: "teacher-2" },
    ],
  });
  const repository = createAdminDataRepository({ db, storageMode: "local-json" });
  assert.deepEqual(await repository.getDashboardCounts(actor), {
    vocabSets: 1,
    grammarSets: 1,
    classes: 1,
    assignments: 2,
  });

  const service = createAdminDataService({
    repository,
    db,
    canViewVocabSet: (current, record) => current.role === "super_admin" || record.createdBy === current.id || record.visibility === "public",
    canViewGrammarSet: (current, record) => current.role === "super_admin" || record.createdBy === current.id || record.visibility === "public",
    sanitizeVocabSet: record => ({ ...record, items: (record.items || []).map(({ audioPath: _audioPath, ...item }: any) => item) }),
    loadDashboardActivity: async () => ({ total: 7, recentActivities: [{ id: "recent" }], goldRows: [{ studentName: "A" }] }),
    loadAccountsPage: async () => ({ items: [], page: 1, pageSize: 10, total: 0, totalPages: 1 }),
    loadAuditPage: async () => ({ items: [], page: 1, pageSize: 10, total: 0, totalPages: 1 }),
  });
  const detail = await service.getVocabSetDetail(actor, "owned");
  assert.equal(detail.items[0].audioPath, undefined);
  await assert.rejects(() => service.getVocabSetDetail(actor, "hidden"), /not found/i);
  const summary = await service.getDashboardSummary(actor);
  assert.equal(summary.counts.activities, 7);
  assert.equal(summary.counts.honoredStudents, 1);
});

test("Classes, members and assignments page only teacher-owned scope", async () => {
  const db = fakeDb({
    classes: [
      { id: "owned-class", name: "Lớp A", teacherId: actor.id, createdAt: "2026-03-02" },
      { id: "other-class", name: "Lớp B", teacherId: "teacher-2", createdAt: "2026-03-01" },
    ],
    class_members: [
      { id: "owned-member", classId: "owned-class", studentName: "An" },
      { id: "other-member", classId: "other-class", studentName: "Bình" },
    ],
    assignments: [
      { id: "owned-assignment", classId: "owned-class", createdBy: actor.id, title: "Owned", createdAt: "2026-03-02" },
      { id: "class-assignment", classId: "owned-class", createdBy: "teacher-2", title: "Class scoped", createdAt: "2026-03-01" },
      { id: "other-assignment", classId: "other-class", createdBy: "teacher-2", title: "Other", createdAt: "2026-02-01" },
    ],
  });
  const repository = createAdminDataRepository({ db, storageMode: "local-json" });
  const request = { page: 1, pageSize: 10, search: "", grade: "", status: "", role: "" };
  const classes = await repository.listClasses(actor, request);
  assert.deepEqual(classes.items.map(item => item.id), ["owned-class"]);
  const members = await repository.listClassMembers(actor, ["owned-class", "other-class"]);
  assert.deepEqual(members.map(item => item.id), ["owned-member"]);
  const assignments = await repository.listAssignments(actor, request);
  assert.deepEqual(assignments.items.map(item => item.id), ["owned-assignment", "class-assignment"]);
});

test("Admin data router keeps explicit staff auth and stable Phase 2 URLs", () => {
  const source = readFileSync(new URL("./router.ts", import.meta.url), "utf8");
  assert.match(source, /router\.use\(options\.authenticateUser\)/);
  assert.match(source, /user\.role !== "teacher" && user\.role !== "super_admin"/);
  for (const path of [
    "/dashboard-summary",
    "/vocab-sets",
    "/vocab-sets/:id",
    "/grammar-sets",
    "/grammar-sets/:id",
    "/classes",
    "/class-members",
    "/assignments",
    "/assignment-options",
    "/accounts-page",
    "/audit-logs-page",
  ]) {
    assert.ok(source.includes(`"${path}"`), `Missing Admin data route ${path}`);
  }
});
