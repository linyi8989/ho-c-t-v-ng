import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const adminSource = readFileSync(new URL('../../components/admin/AdminDashboard.tsx', import.meta.url), 'utf8');
const serverSource = readFileSync(new URL('../../../server.ts', import.meta.url), 'utf8');
const registrySource = readFileSync(new URL('../listening-library/clientRegistry.ts', import.meta.url), 'utf8');
const listeningRouterSource = readFileSync(new URL('../../server/listening/listeningRouter.ts', import.meta.url), 'utf8');
const examRouterSource = readFileSync(new URL('../../server/exam-platform/examRouter.ts', import.meta.url), 'utf8');

test('all new modules use the shared client platform and IELTS remains Academic-only', () => {
  for (const moduleName of ['starter', 'flyer', 'ket', 'pet', 'fce', 'ielts']) {
    assert.match(registrySource, new RegExp(`${moduleName}ClientModule`));
  }
  assert.doesNotMatch(registrySource, /generalTraining|general-reading|general-writing/i);
});

test('assignment scheduler, server and canonical route share the generic exam contract', () => {
  for (const contract of [
    "resourceType === 'exam'",
    '/api/exam-platform/admin/sets',
    'examSetId',
    'examModuleId',
    'examPaperId',
    'examPaperExamPath(assignment.examModuleId, assignment.examPaperId',
  ]) {
    assert.ok(adminSource.includes(contract), `Admin exam assignment contract is missing: ${contract}`);
  }
  for (const contract of [
    'payload.resourceType === "exam"',
    'collection("exam_sets")',
    'examSetId: resource.id',
    'examModuleId: resource.moduleId',
    'examPaperId: resource.paperId',
  ]) {
    assert.ok(serverSource.includes(contract), `Server exam assignment contract is missing: ${contract}`);
  }
});

test('published exam media is usage-tracked and answer keys are sanitized server-side', () => {
  assert.match(examRouterSource, /collection\('exam_asset_usages'\)/);
  assert.match(listeningRouterSource, /collection\('exam_asset_usages'\)/);
  assert.match(examRouterSource, /sanitizeExamContentForStudent/);
  assert.match(examRouterSource, /exam_set_versions/);
  assert.match(examRouterSource, /pending_review/);
});
