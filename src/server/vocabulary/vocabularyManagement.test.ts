import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createVocabularyService } from './service';

const serverSource = readFileSync(new URL('../../../server.ts', import.meta.url), 'utf8');
const routerSource = readFileSync(new URL('./router.ts', import.meta.url), 'utf8');
const repositorySource = readFileSync(new URL('./repository.ts', import.meta.url), 'utf8');

const teacher = { id: 'teacher-1', name: 'Teacher', email: 'teacher@test', role: 'teacher' };

function fixture() {
  const sets = [
    { id: 'set-1', title: 'Animals', description: 'Words', subject: 'English', visibility: 'public', createdBy: 'teacher-1', items: [] },
    { id: 'set-2', title: 'Private', description: 'Words', subject: 'English', visibility: 'private', createdBy: 'teacher-2', items: [] },
  ];
  const repository = {
    sets,
    saved: [] as any[],
    archived: null as any,
    async listActiveSets() { return sets; },
    async getSet(id: string) { return sets.find(item => item.id === id) || null; },
    async resolveImageReferences(payload: any) { return payload; },
    async saveSet(record: any) { this.saved.push(record); },
    async listAssignmentsForVocab() { return []; },
    async listActiveClasses() { return []; },
    async archiveSetAndAssignments(set: any, assignments: any[], actorId: string, at: string) {
      this.archived = { set, assignments, actorId, at };
    },
  };
  const audits: any[] = [];
  const queued: any[] = [];
  const service = createVocabularyService({
    repository: repository as any,
    canViewSet: (actor, set) => set.visibility === 'public' || set.createdBy === actor?.id,
    canManageSet: (actor, set) => set.createdBy === actor?.id || actor?.role === 'super_admin',
    canManageAssignment: () => true,
    isSuperAdmin: actor => actor?.role === 'super_admin',
    getVisibility: set => set.visibility || 'private',
    toLegacyStatus: visibility => visibility === 'public' ? 'public' : visibility === 'draft' ? 'draft' : 'private',
    normalizeForRead: set => set,
    normalizeForSave: set => set,
    stripPrivateFields: set => set,
    resolveLearningAccess: async () => null,
    normalizeTtsSettings: value => value,
    enqueueAudio: (...args) => { queued.push(args); },
    logAudit: async (...args) => { audits.push(args); },
    now: () => new Date('2026-09-23T11:00:00.000Z'),
  });
  return { audits, queued, repository, service };
}

test('all vocabulary URLs move behind one router without changing middleware contracts', () => {
  assert.match(serverSource, /createVocabularyRouter/);
  assert.doesNotMatch(serverSource, /app\.(?:get|post|put|delete)\("\/api\/(?:public\/)?vocab-sets/);
  for (const route of [
    'router.get("/vocab-sets/share/:token"',
    'router.get("/public/vocab-sets"',
    'router.get("/vocab-sets"',
    'router.post("/vocab-sets"',
    'router.put("/vocab-sets/:id"',
    'router.get("/vocab-sets/:id/audio/status"',
    'router.get("/vocab-sets/:id/images/status"',
    'router.post("/vocab-sets/:id/audio/generate-missing"',
    'router.delete("/vocab-sets/:id"',
    'router.post("/vocab-sets/:id/clone"',
  ]) assert.ok(routerSource.includes(route), `missing route ${route}`);
});

test('teacher list scope, create aliases, and targeted audio queue remain intact', async () => {
  const { queued, repository, service } = fixture();
  assert.deepEqual(await service.listSets(teacher as any, {}), [{ ...repository.sets[0], status: 'public' }]);
  const created = await service.createSet(teacher as any, {
    title: 'New', items: [], ttsSettings: { autoGenerate: true },
  });
  assert.equal(created.id, 'set-1790161200000');
  assert.equal(created.createdBy, teacher.id);
  assert.equal(queued[0][0], created.id);
});

test('archive checks every related assignment and delegates one atomic archive batch', async () => {
  const { repository, service } = fixture();
  repository.listAssignmentsForVocab = async () => [{
    record: { id: 'assignment-1', classId: 'class-1', vocabSetId: 'set-1' }, ref: {},
  }];
  repository.listActiveClasses = async () => [{ id: 'class-1', teacherId: 'teacher-1' }];
  await service.archiveSet(teacher as any, 'set-1');
  assert.equal(repository.archived.set.id, 'set-1');
  assert.equal(repository.archived.assignments.length, 1);
  assert.equal(repository.archived.actorId, teacher.id);
  assert.match(repositorySource, /batch\.set/);
  assert.match(repositorySource, /revokeShareToken: true/);
  assert.doesNotMatch(repositorySource, /batch\.delete|\.delete\(/);
});

test('clone is draft-owned by the current teacher and keeps legacy response shape', async () => {
  const { repository, service } = fixture();
  const clone = await service.cloneSet(teacher as any, 'set-1');
  assert.equal(clone.id, 'set-1790161200000');
  assert.equal(clone.visibility, 'draft');
  assert.equal(clone.status, 'draft');
  assert.equal(clone.createdBy, teacher.id);
  assert.equal(repository.saved.at(-1), clone);
});
