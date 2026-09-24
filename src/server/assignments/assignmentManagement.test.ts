import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createAssignmentManagementService } from './service';

const serverSource = readFileSync(new URL('../../../server.ts', import.meta.url), 'utf8');
const routerSource = readFileSync(new URL('./router.ts', import.meta.url), 'utf8');

const teacher = {
  id: 'teacher-1',
  name: 'Teacher One',
  email: 'teacher@example.test',
  role: 'teacher' as const,
};

function repositoryFixture() {
  const classes = [
    { id: 'class-owned', name: 'Owned class', teacherId: 'teacher-1' },
    { id: 'class-other', name: 'Other class', teacherId: 'teacher-2' },
  ];
  const assignments = [
    {
      id: 'assignment-owned',
      classId: 'class-owned',
      className: 'Owned class',
      title: 'Owned assignment',
      createdBy: 'teacher-1',
    },
    {
      id: 'assignment-other',
      classId: 'class-other',
      className: 'Other class',
      title: 'Other assignment',
      createdBy: 'teacher-2',
      shareToken: 'existing-token',
    },
  ];
  const resources = new Map([
    ['vocab_sets:vocab-1', { id: 'vocab-1', title: 'Transport', visibility: 'public', ownerId: 'teacher-1' }],
    ['listening_sets:listening-other', {
      id: 'listening-other',
      title: 'Listening',
      status: 'published',
      visibility: 'public',
      ownerId: 'teacher-2',
    }],
  ]);

  return {
    classes,
    assignments,
    resources,
    saved: [] as any[],
    archived: null as any,
    async listActiveClasses() { return classes; },
    async listActiveAssignments() { return assignments; },
    async getClass(id: string) { return classes.find(item => item.id === id) || null; },
    async getResource(collection: string, id: string) { return resources.get(`${collection}:${id}`) || null; },
    async saveAssignment(record: any) { this.saved.push(record); },
    async getAssignment(id: string) { return assignments.find(item => item.id === id) || null; },
    async archiveAssignment(record: any, actorId: string, archivedAt: string) {
      this.archived = { record, actorId, archivedAt };
    },
  };
}

function createService(repository = repositoryFixture()) {
  const audits: any[] = [];
  const service = createAssignmentManagementService({
    repository: repository as any,
    canManageClass: (actor, record) => actor?.role === 'super_admin' || record.teacherId === actor?.id,
    canManageAssignment: (actor, assignment, classRecord) => (
      actor?.role === 'super_admin'
      || assignment.createdBy === actor?.id
      || classRecord?.teacherId === actor?.id
    ),
    canViewVocabSet: (actor, resource) => actor?.role === 'super_admin' || resource.visibility === 'public' || resource.ownerId === actor?.id,
    getVocabVisibility: resource => resource.visibility || 'public',
    createShareToken: () => 'generated-share-token',
    logAudit: async (...args) => { audits.push(args); },
    now: () => new Date('2026-09-23T08:00:00.000Z'),
  });
  return { audits, repository, service };
}

test('legacy assignment URLs are mounted through the assignment router', () => {
  assert.match(serverSource, /createAssignmentManagementRepository/);
  assert.match(serverSource, /createAssignmentManagementService/);
  assert.match(serverSource, /createAssignmentManagementRouter/);
  assert.match(serverSource, /app\.use\(\s*"\/api",\s*createAssignmentManagementRouter/s);
  assert.doesNotMatch(serverSource, /app\.(?:get|post|delete)\("\/api\/assignments/);

  for (const route of [
    'router.get("/assignments"',
    'router.post("/assignments"',
    'router.delete("/assignments/:id"',
  ]) {
    assert.ok(routerSource.includes(route), `missing route ${route}`);
  }
});

test('listing keeps teacher scope and upgrades legacy assignments with one share token', async () => {
  const { repository, service } = createService();
  const result = await service.listAssignments(teacher);

  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'assignment-owned');
  assert.equal(result[0].shareToken, 'generated-share-token');
  assert.equal(result[0].assignmentSlug, 'generated-share-token');
  assert.equal(repository.saved.length, 1);
});

test('creating a vocabulary assignment preserves aliases, audit, and 201 response data contract', async () => {
  const { audits, repository, service } = createService();
  const result = await service.createAssignment(teacher, {
    classId: 'class-owned',
    resourceType: 'vocabulary',
    resourceId: 'vocab-1',
    title: 'Practice transport',
  });

  assert.equal(result.id, 'assign-1790150400000');
  assert.equal(result.className, 'Owned class');
  assert.equal(result.resourceId, 'vocab-1');
  assert.equal(result.vocabSetId, 'vocab-1');
  assert.equal(result.vocabSetTitle, 'Transport');
  assert.equal(result.shareToken, 'generated-share-token');
  assert.equal(result.assignmentSlug, 'generated-share-token');
  assert.equal(result.createdBy, teacher.id);
  assert.equal(repository.saved.at(-1), result);
  assert.equal(audits[0][3], 'CREATE_ASSIGNMENT');
});

test('resource ownership and archive authorization remain enforced', async () => {
  const { audits, repository, service } = createService();

  await assert.rejects(
    service.createAssignment(teacher, {
      classId: 'class-owned',
      resourceType: 'listening',
      resourceId: 'listening-other',
    }),
    (error: any) => error.status === 403,
  );

  await service.archiveAssignment(teacher, 'assignment-owned');
  assert.equal(repository.archived.record.id, 'assignment-owned');
  assert.equal(repository.archived.actorId, teacher.id);
  assert.equal(audits.at(-1)[3], 'ARCHIVE_ASSIGNMENT');

  await assert.rejects(
    service.archiveAssignment(teacher, 'assignment-other'),
    (error: any) => error.status === 403,
  );
});
