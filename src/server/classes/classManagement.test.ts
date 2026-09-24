import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createClassManagementService } from './service';

const serverSource = readFileSync(new URL('../../../server.ts', import.meta.url), 'utf8');
const routerSource = readFileSync(new URL('./router.ts', import.meta.url), 'utf8');

function repositoryFixture() {
  const classes = [
    { id: 'class-owned', name: 'Owned', teacherId: 'teacher-1' },
    { id: 'class-other', name: 'Other', teacherId: 'teacher-2' },
  ];
  const members = [
    { id: 'member-owned', classId: 'class-owned', studentName: 'An' },
    { id: 'member-other', classId: 'class-other', studentName: 'Bình' },
  ];
  return {
    classes,
    members,
    createdClass: null as any,
    createdMember: null as any,
    archived: null as any,
    deletedMember: '',
    async listActiveClasses() { return classes; },
    async getClass(id: string) { return classes.find(item => item.id === id) || null; },
    async createClass(record: any) { this.createdClass = record; },
    async archiveClassAndAssignments(record: any, actorId: string, at: string) { this.archived = { record, actorId, at }; },
    async listClassMembers() { return members; },
    async getClassMember(id: string) { return members.find(item => item.id === id) || null; },
    async createClassMember(record: any) { this.createdMember = record; },
    async deleteClassMember(id: string) { this.deletedMember = id; },
  };
}

const teacher = { id: 'teacher-1', name: 'Cô Diệu', email: 'teacher@example.test', role: 'teacher' as const };

test('legacy class routes are mounted through the class router without changing URLs', () => {
  assert.match(serverSource, /createClassManagementRepository/);
  assert.match(serverSource, /createClassManagementService/);
  assert.match(serverSource, /createClassManagementRouter/);
  assert.match(serverSource, /app\.use\(\s*"\/api",\s*createClassManagementRouter/s);
  assert.doesNotMatch(serverSource, /app\.(?:get|post|delete)\("\/api\/(?:classes|class-members)/);

  for (const route of [
    'router.get("/classes"',
    'router.post("/classes"',
    'router.delete("/classes/:id"',
    'router.get("/class-members"',
    'router.post("/classes/:classId/members"',
    'router.delete("/classes/:classId/members/:memberId"',
  ]) {
    assert.ok(routerSource.includes(route), `missing route ${route}`);
  }
});

test('teacher scope and class-member ownership stay unchanged in the service boundary', async () => {
  const repository = repositoryFixture();
  const audits: any[] = [];
  const service = createClassManagementService({
    repository: repository as any,
    canViewClass: (actor, record) => actor.role === 'super_admin' || record.teacherId === actor.id,
    canManageClass: (actor, record) => actor.role === 'super_admin' || record.teacherId === actor.id,
    isArchivedRecord: record => record.lifecycleStatus === 'archived',
    logAudit: async (...args) => { audits.push(args); },
    now: () => new Date('2026-09-22T10:00:00.000Z'),
    random: () => 0.123456789,
  });

  assert.deepEqual(await service.listClasses(teacher), [repository.classes[0]]);
  assert.deepEqual(await service.listClassMembers(teacher), [repository.members[0]]);

  const created = await service.createClass(teacher, { name: 'Lớp mới' });
  assert.equal(created.id, 'class-1790071200000');
  assert.equal(created.teacherId, teacher.id);
  assert.equal(created.createdAt, '2026-09-22T10:00:00.000Z');
  assert.equal(repository.createdClass, created);
  assert.equal(audits[0][3], 'CREATE_CLASS');

  await assert.rejects(
    service.addClassMember(teacher, 'class-other', { studentName: 'Không hợp lệ' }),
    (error: any) => error.status === 403 && error.message === 'Ban khong co quyen them hoc sinh vao lop nay.',
  );
  await assert.rejects(
    service.removeClassMember(teacher, 'class-owned', 'member-other'),
    (error: any) => error.status === 404 && error.message === 'Class member not found.',
  );
});
