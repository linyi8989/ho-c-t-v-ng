import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createGrammarLibraryService } from './service';

const serverSource = readFileSync(new URL('../../../server.ts', import.meta.url), 'utf8');
const routerSource = readFileSync(new URL('./router.ts', import.meta.url), 'utf8');
const repositorySource = readFileSync(new URL('./repository.ts', import.meta.url), 'utf8');

const teacher = { id: 'teacher-1', name: 'Teacher', email: 'teacher@test', role: 'teacher' };

function fixture() {
  const sets = [
    { id: 'grammar-1', title: 'Present simple', visibility: 'public', createdBy: 'teacher-1', questions: [] },
    { id: 'grammar-2', title: 'Assigned', visibility: 'assignment', createdBy: 'teacher-1', shareToken: 'grammar-secret', questions: [] },
  ];
  const repository = {
    sets,
    saved: [] as any[],
    archived: null as any,
    async listActiveSets() { return sets; },
    async getSet(id: string) { return sets.find(set => set.id === id) || null; },
    async saveSet(set: any) { this.saved.push(set); },
    async archiveSet(set: any, actorId: string, at: string) { this.archived = { set, actorId, at }; },
    async listAttempts() { return [{ id: 'attempt-1', createdAt: '2026-09-23T00:00:00.000Z' }]; },
  };
  let sequence = 0;
  const service = createGrammarLibraryService({
    repository: repository as any,
    canViewSet: (actor, set) => set.visibility === 'public' || set.createdBy === actor?.id,
    canManageSet: (actor, set) => set.createdBy === actor?.id,
    getVisibility: set => set.visibility,
    sanitizeForStudent: set => ({ id: set.id, title: set.title, visibility: set.visibility }),
    normalizeForSave: (set, _existing, actor) => ({ ...set, createdBy: actor.id, questions: set.questions || [] }),
    makeId: prefix => `${prefix}-${++sequence}`,
    enrichStudentNames: async attempts => attempts,
    logAudit: async () => undefined,
    now: () => new Date('2026-09-23T12:00:00.000Z'),
  });
  return { repository, service };
}

test('grammar library CRUD/share/preview/results move behind the grammar router', () => {
  assert.match(serverSource, /createGrammarLibraryRouter/);
  for (const direct of [
    '/api/public/grammar-sets', '/api/grammar-sets/share/:token', '/api/admin/grammar-sets',
  ]) assert.doesNotMatch(serverSource, new RegExp(`app\\.(?:get|post|put|delete)\\("${direct.replaceAll('/', '\\/')}`));
  for (const route of [
    'router.get("/public/grammar-sets"', 'router.get("/grammar-sets"',
    'router.get("/grammar-sets/share/:token"', 'router.get("/grammar-sets/:id"',
    'router.post("/admin/grammar-sets"', 'router.put("/admin/grammar-sets/:id"',
    'router.delete("/admin/grammar-sets/:id"', 'router.post("/admin/grammar-sets/:id/clone"',
    'router.get("/admin/grammar-sets/:id/preview"', 'router.get("/admin/grammar-sets/:id/results"',
  ]) assert.ok(routerSource.includes(route), `missing route ${route}`);
});

test('public/student views remain sanitized while teacher view keeps author data', async () => {
  const { service } = fixture();
  assert.deepEqual(await service.listPublicSets(), [{ id: 'grammar-1', title: 'Present simple', visibility: 'public' }]);
  const teacherSets = await service.listSets(teacher as any);
  assert.equal(teacherSets[0].createdBy, 'teacher-1');
});

test('legacy grammar share-token alias still resolves assignment-only sets', async () => {
  const { service } = fixture();
  assert.equal((await service.openSharedSet('secret')).id, 'grammar-2');
  assert.equal((await service.openSharedSet('grammar-secret')).id, 'grammar-2');
});

test('archive remains soft, revokes share token, and never deletes the set', async () => {
  const { repository, service } = fixture();
  await service.archiveSet(teacher as any, 'grammar-1');
  assert.equal(repository.archived.set.id, 'grammar-1');
  assert.match(repositorySource, /archiveResourceRecord/);
  assert.match(repositorySource, /revokeShareToken: true/);
  assert.doesNotMatch(repositorySource, /\.delete\(/);
});
