import type { ClassActor } from './contracts.js';
import { classHttpError } from './contracts.js';

interface ClassManagementServiceOptions {
  repository: ReturnType<typeof import('./repository.js').createClassManagementRepository>;
  canViewClass: (actor: ClassActor | undefined, record: any) => boolean;
  canManageClass: (actor: ClassActor | undefined, record: any) => boolean;
  isArchivedRecord: (record: any) => boolean;
  logAudit: (
    userId: string,
    userName: string,
    userEmail: string,
    action: string,
    details: string,
  ) => Promise<void>;
  now?: () => Date;
  random?: () => number;
}

export function createClassManagementService(options: ClassManagementServiceOptions) {
  const now = options.now || (() => new Date());
  const random = options.random || Math.random;

  const requireActor = (actor: ClassActor | undefined) => {
    if (!actor) throw classHttpError(401, 'Unauthenticated');
    return actor;
  };

  const getExistingClass = async (classId: string) => {
    const classRecord = await options.repository.getClass(classId);
    if (!classRecord) throw classHttpError(404, 'Class not found.');
    return classRecord;
  };

  const listClasses = async (actor: ClassActor | undefined) => {
    const classes = await options.repository.listActiveClasses();
    return classes.filter(record => options.canViewClass(actor, record));
  };

  const createClass = async (actorValue: ClassActor | undefined, payload: any) => {
    const actor = requireActor(actorValue);
    const createdAt = now();
    const id = `class-${createdAt.getTime()}`;
    const newClass = {
      ...payload,
      id,
      code: random().toString(36).substring(2, 8).toUpperCase(),
      teacherId: actor.id,
      createdAt: createdAt.toISOString(),
    };
    await options.repository.createClass(newClass);
    await options.logAudit(
      actor.id,
      actor.name,
      actor.email,
      'CREATE_CLASS',
      `Đã tạo lớp học mới: "${newClass.name}" (Mã mời: ${newClass.code})`,
    );
    return newClass;
  };

  const archiveClass = async (actorValue: ClassActor | undefined, classId: string) => {
    const actor = requireActor(actorValue);
    const classRecord = await options.repository.getClass(classId);
    if (!classRecord) throw classHttpError(404, 'Lớp học không tồn tại.');
    if (!options.canManageClass(actor, classRecord)) {
      throw classHttpError(403, 'Ban khong co quyen xoa lop hoc nay.');
    }
    await options.repository.archiveClassAndAssignments(classRecord, actor.id, now().toISOString());
    await options.logAudit(
      actor.id,
      actor.name,
      actor.email,
      'ARCHIVE_CLASS',
      `Đã lưu trữ lớp học và thu hồi bài giao: "${classRecord.name}"`,
    );
    return { success: true, archived: true };
  };

  const listClassMembers = async (actor: ClassActor | undefined) => {
    const [classes, members] = await Promise.all([
      options.repository.listActiveClasses(),
      options.repository.listClassMembers(),
    ]);
    const classesById = new Map(classes.map(record => [record.id, record]));
    return members.filter(member => {
      const classRecord = member.classId ? classesById.get(member.classId) : null;
      return Boolean(classRecord && options.canViewClass(actor, classRecord));
    });
  };

  const addClassMember = async (actor: ClassActor | undefined, classId: string, payload: any) => {
    const classRecord = await getExistingClass(classId);
    if (options.isArchivedRecord(classRecord)) throw classHttpError(409, 'Class is archived.');
    if (!options.canManageClass(actor, classRecord)) {
      throw classHttpError(403, 'Ban khong co quyen them hoc sinh vao lop nay.');
    }
    const id = `member-${now().getTime()}`;
    const newMember = { id, classId, studentName: payload?.studentName };
    await options.repository.createClassMember(newMember);
    return newMember;
  };

  const removeClassMember = async (
    actor: ClassActor | undefined,
    classId: string,
    memberId: string,
  ) => {
    const classRecord = await getExistingClass(classId);
    if (options.isArchivedRecord(classRecord)) throw classHttpError(409, 'Class is archived.');
    if (!options.canManageClass(actor, classRecord)) {
      throw classHttpError(403, 'Ban khong co quyen xoa hoc sinh khoi lop nay.');
    }
    const member = await options.repository.getClassMember(memberId);
    if (!member || member.classId !== classId) throw classHttpError(404, 'Class member not found.');
    await options.repository.deleteClassMember(memberId);
    return { success: true };
  };

  return {
    addClassMember,
    archiveClass,
    createClass,
    listClasses,
    listClassMembers,
    removeClassMember,
  };
}
