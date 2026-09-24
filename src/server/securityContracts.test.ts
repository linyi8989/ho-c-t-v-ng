import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { getDefaultRoleForEmail, parseBootstrapSuperAdminEmails, resolveTrustedRole } from "./accessPolicy";
import { applySecurityHeaders, FixedWindowRateLimitStore, parseTrustedProxyHops, safeEqualSecret } from "./httpHardening";
import { canUseLegacyGuestSessionUpdate, parseLegacySessionMaxAgeMs } from "./legacySessionAccess";
import { resolveDevQuotaApiKey, resolvePersistentDirectory } from "./runtimeConfig";
import { archiveResourceRecord, isArchivedRecord } from "./resourceLifecycle";

const serverSource = readFileSync(new URL("../../server.ts", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const studentGameSource = readFileSync(new URL("../components/games/StudentLearningArea.tsx", import.meta.url), "utf8");
const authSource = readFileSync(new URL("../context/AuthContext.tsx", import.meta.url), "utf8");
const teacherPreviewSource = readFileSync(
  new URL("../components/admin/TeacherLibraryPreview.tsx", import.meta.url),
  "utf8"
);
const firestoreRules = readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8");
const mediaMaintenanceSource = readFileSync(
  new URL("../../scripts/media-orphan-maintenance.mjs", import.meta.url),
  "utf8"
);
const classRouterSource = readFileSync(new URL("./classes/router.ts", import.meta.url), "utf8");
const classServiceSource = readFileSync(new URL("./classes/service.ts", import.meta.url), "utf8");
const classRepositorySource = readFileSync(new URL("./classes/repository.ts", import.meta.url), "utf8");
const assignmentRouterSource = readFileSync(new URL("./assignments/router.ts", import.meta.url), "utf8");
const assignmentServiceSource = readFileSync(new URL("./assignments/service.ts", import.meta.url), "utf8");
const assignmentRepositorySource = readFileSync(new URL("./assignments/repository.ts", import.meta.url), "utf8");
const vocabularyRouterSource = readFileSync(new URL("./vocabulary/router.ts", import.meta.url), "utf8");
const vocabularyServiceSource = readFileSync(new URL("./vocabulary/service.ts", import.meta.url), "utf8");
const vocabularyRepositorySource = readFileSync(new URL("./vocabulary/repository.ts", import.meta.url), "utf8");
const grammarRouterSource = readFileSync(new URL("./grammar/router.ts", import.meta.url), "utf8");
const grammarServiceSource = readFileSync(new URL("./grammar/service.ts", import.meta.url), "utf8");
const grammarRepositorySource = readFileSync(new URL("./grammar/repository.ts", import.meta.url), "utf8");

test("bootstrap administrators come from configuration and stored backend roles remain valid", () => {
  const configured = parseBootstrapSuperAdminEmails(" OWNER@example.com, second@example.com ");
  assert.equal(getDefaultRoleForEmail("owner@example.com", configured), "super_admin");
  assert.equal(getDefaultRoleForEmail("student@example.com", configured), "student");
  assert.equal(resolveTrustedRole({}, { role: "super_admin" }, configured), "super_admin");
  assert.equal(resolveTrustedRole({ role: "student" }, { role: "super_admin" }, configured), "student");
  assert.doesNotMatch(serverSource, /linyi8901@gmail\.com|admin@vocabulary\.edu\.vn/);
});

test("trusted proxy configuration is bounded", () => {
  assert.equal(parseTrustedProxyHops(undefined), 0);
  assert.equal(parseTrustedProxyHops("2"), 2);
  assert.throws(() => parseTrustedProxyHops("all"), /TRUST_PROXY_HOPS/);
  assert.throws(() => parseTrustedProxyHops("11"), /TRUST_PROXY_HOPS/);
});

test("baseline browser security headers are explicit without blocking exam media providers", () => {
  const headers = new Map<string, string>();
  const middleware = applySecurityHeaders(true);
  middleware({} as any, {
    setHeader(name: string, value: string) { headers.set(name, value); }
  } as any, () => undefined);
  assert.equal(headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(headers.get("X-Frame-Options"), "DENY");
  assert.match(headers.get("Content-Security-Policy") || "", /frame-ancestors 'none'/);
  assert.doesNotMatch(headers.get("Content-Security-Policy") || "", /default-src/);
  assert.match(headers.get("Strict-Transport-Security") || "", /max-age=/);
  assert.match(serverSource, /app\.disable\("x-powered-by"\)/);
});

test("fixed-window limits cost and resets without accepting over-limit work", () => {
  let now = 1_000;
  const store = new FixedWindowRateLimitStore(10_000, 3, () => now);
  assert.equal(store.consume("actor", 2).allowed, true);
  assert.equal(store.consume("actor", 2).allowed, false);
  assert.equal(store.consume("actor", 1).allowed, true);
  now = 11_001;
  assert.equal(store.consume("actor", 3).allowed, true);

  const bounded = new FixedWindowRateLimitStore(10_000, 1, () => now, 2);
  bounded.consume("first");
  bounded.consume("second");
  assert.equal(bounded.consume("third").allowed, true);
});

test("legacy tokenless guest updates expire and never reopen completed sessions", () => {
  const maxAgeMs = parseLegacySessionMaxAgeMs("24");
  const now = Date.parse("2026-09-02T12:00:00.000Z");
  assert.equal(canUseLegacyGuestSessionUpdate({
    session: { guestId: "guest-a", status: "in_progress", startedAt: "2026-09-02T11:00:00.000Z" },
    suppliedGuestId: "guest-a",
    maxAgeMs,
    now
  }), true);
  assert.equal(canUseLegacyGuestSessionUpdate({
    session: { guestId: "guest-a", status: "completed", startedAt: "2026-09-02T11:00:00.000Z" },
    suppliedGuestId: "guest-a",
    maxAgeMs,
    now
  }), false);
  assert.equal(canUseLegacyGuestSessionUpdate({
    session: { guestId: "guest-a", status: "in_progress", startedAt: "2026-08-01T11:00:00.000Z" },
    suppliedGuestId: "guest-a",
    maxAgeMs,
    now
  }), false);
});

test("production persistent paths fail closed while local paths stay inside .data", () => {
  assert.throws(() => resolvePersistentDirectory({
    env: { NODE_ENV: "production" },
    variable: "TTS_AUDIO_DIR",
    localDirectory: "audio",
    cwd: "C:/workspace"
  }), /required in production/);
  assert.match(resolvePersistentDirectory({
    env: { NODE_ENV: "development" },
    variable: "LISTENING_MEDIA_DIR",
    localDirectory: "listening-media",
    cwd: "C:/workspace"
  }), /\.data[\\/]listening-media$/);
  assert.match(resolvePersistentDirectory({
    env: { NODE_ENV: "development" },
    variable: "VOCAB_IMAGE_DIR",
    localDirectory: "vocab-images",
    cwd: "C:/workspace"
  }), /\.data[\\/]vocab-images$/);
});

test("DevQuota legacy variable is accepted only as a warned migration alias", () => {
  const warnings: string[] = [];
  assert.equal(resolveDevQuotaApiKey({ DEVQUOTA_API_KEYk: "secret" }, message => warnings.push(message)), "secret");
  assert.equal(warnings.length, 1);
  assert.equal(resolveDevQuotaApiKey({ DEVQUOTA_API_KEY: "primary", DEVQUOTA_API_KEYk: "legacy" }), "primary");
});

test("diagnostic secrets compare without accepting blanks", () => {
  assert.equal(safeEqualSecret("same", "same"), true);
  assert.equal(safeEqualSecret("same", "different"), false);
  assert.equal(safeEqualSecret("", ""), false);
  const diagnosticStart = serverSource.indexOf("function requireDiagnosticAccess");
  const diagnosticEnd = serverSource.indexOf("const PHONE_AUTH_WINDOW_MS", diagnosticStart);
  const diagnosticRoutes = serverSource.slice(diagnosticStart, diagnosticEnd);
  assert.match(diagnosticRoutes, /x-diagnostic-secret/);
  assert.doesNotMatch(diagnosticRoutes, /query\.secret|stack:/);
});

test("archive lifecycle revokes links without deleting resource content", () => {
  const original = {
    id: "set-1",
    visibility: "public",
    shareToken: "secret-link",
    questions: [{ id: "question-1" }]
  };
  const archived = archiveResourceRecord(original, "teacher-1", "2026-09-02T00:00:00.000Z", {
    forceDraftVisibility: true,
    revokeShareToken: true
  });
  assert.equal(isArchivedRecord(archived), true);
  assert.equal(archived.visibility, "draft");
  assert.equal(archived.shareToken, undefined);
  assert.deepEqual(archived.questions, original.questions);
});

test("browser data access is API-only and Firestore client rules deny application collections", () => {
  assert.doesNotMatch(appSource, /firebaseDb|firebase\/firestore/);
  assert.doesNotMatch(studentGameSource, /firebaseDb|firebase\/firestore/);
  assert.doesNotMatch(authSource, /function getDefaultRole|function createDefaultProfile/);
  assert.match(firestoreRules, /match \/vocab_sets\/\{setId\} \{\s*allow read: if false;/);
});

test("media orphan maintenance is dry-run first and quarantines only after backup", () => {
  assert.match(mediaMaintenanceSource, /mode: 'dry-run'/);
  assert.match(mediaMaintenanceSource, /createVerifiedBackup/);
  assert.match(mediaMaintenanceSource, /quarantineCandidates/);
  assert.match(mediaMaintenanceSource, /deleted: 0/);
  assert.doesNotMatch(mediaMaintenanceSource, /unlinkSync\(source/);
  assert.match(mediaMaintenanceSource, /path\.dirname\(target\) !== root/);
});

test("legacy resource delete routes archive records instead of deleting history-linked parents", () => {
  assert.match(classRouterSource, /router\.delete\("\/classes\/:id", options\.authenticateUser, options\.requireStaff/);
  assert.match(classServiceSource, /canManageClass\(actor, classRecord\)/);
  assert.match(classServiceSource, /archiveClassAndAssignments/);
  const archiveStart = classRepositorySource.indexOf('async archiveClassAndAssignments');
  const archiveEnd = classRepositorySource.indexOf('\n\n    async listClassMembers', archiveStart);
  assert.notEqual(archiveStart, -1);
  assert.notEqual(archiveEnd, -1);
  const archiveClassRoute = classRepositorySource.slice(archiveStart, archiveEnd);
  assert.match(archiveClassRoute, /archiveResourceRecord\(record, actorId, archivedAt\)/);
  assert.match(archiveClassRoute, /revokeShareToken: true/);
  assert.doesNotMatch(archiveClassRoute, /\.delete\(/);

  assert.match(assignmentRouterSource, /router\.delete\("\/assignments\/:id", options\.authenticateUser, options\.requireStaff/);
  assert.match(assignmentServiceSource, /canManageAssignment\(actor, assignment, classRecord\)/);
  assert.match(assignmentServiceSource, /repository\.archiveAssignment\(assignment, actor\.id/);
  const archiveAssignmentStart = assignmentRepositorySource.indexOf('async archiveAssignment');
  assert.notEqual(archiveAssignmentStart, -1);
  const archiveAssignmentRoute = assignmentRepositorySource.slice(archiveAssignmentStart);
  assert.match(archiveAssignmentRoute, /archiveResourceRecord\(record, actorId, archivedAt/);
  assert.match(archiveAssignmentRoute, /revokeShareToken: true/);
  assert.doesNotMatch(archiveAssignmentRoute, /\.delete\(/);

  assert.match(vocabularyRouterSource, /router\.delete\("\/vocab-sets\/:id", options\.authenticateUser, options\.requireStaff/);
  assert.match(vocabularyServiceSource, /repository\.archiveSetAndAssignments/);
  assert.match(vocabularyRepositorySource, /archiveResourceRecord\(set, actorId, archivedAt/);
  assert.match(vocabularyRepositorySource, /revokeShareToken: true/);
  assert.doesNotMatch(vocabularyRepositorySource, /batch\.delete|\.delete\(/);

  assert.match(grammarRouterSource, /router\.delete\("\/admin\/grammar-sets\/:id", options\.authenticateUser, options\.requireStaff/);
  assert.match(grammarServiceSource, /repository\.archiveSet\(existing, actor\.id/);
  assert.match(grammarRepositorySource, /archiveResourceRecord\(record, actorId, archivedAt/);
  assert.match(grammarRepositorySource, /revokeShareToken: true/);
  assert.doesNotMatch(grammarRepositorySource, /\.delete\(/);
});

test("teacher library preview point-reads are authenticated and owner-scoped", () => {
  assert.match(grammarRouterSource, /router\.get\("\/admin\/grammar-sets\/:id\/preview", options\.authenticateUser, options\.requireStaff/);
  assert.match(grammarServiceSource, /canManageSet\(actor, set\)/);
  assert.match(grammarServiceSource, /throw grammarHttpError\(404/);
  assert.match(vocabularyRouterSource, /router\.get\("\/admin\/vocab-sets\/:id\/preview", options\.authenticateUser, options\.requireStaff/);
  assert.match(vocabularyServiceSource, /canManageSet\(actor, set\)/);
  assert.match(vocabularyServiceSource, /throw vocabularyHttpError\(404/);

  assert.match(teacherPreviewSource, /\/api\/admin\/vocab-sets\/\$\{encodeURIComponent\(setId\)\}\/preview/);
  assert.match(teacherPreviewSource, /\/api\/admin\/grammar-sets\/\$\{encodeURIComponent\(setId\)\}\/preview/);
  assert.match(teacherPreviewSource, /Authorization: `Bearer \$\{token\}`/);
  assert.match(teacherPreviewSource, /AbortController/);
  assert.match(appSource, /if \(!user \|\| !isStaff \|\| !token\)/);
});
