import type { AssignmentActor, AssignmentResourceType } from './contracts.js';
import { assignmentHttpError } from './contracts.js';

interface AssignmentManagementServiceOptions {
  repository: ReturnType<typeof import('./repository.js').createAssignmentManagementRepository>;
  canManageClass: (actor: AssignmentActor | undefined, record: any) => boolean;
  canManageAssignment: (
    actor: AssignmentActor | undefined,
    assignment: any,
    classRecord?: any,
  ) => boolean;
  canViewVocabSet: (actor: AssignmentActor | undefined, record: any) => boolean;
  getVocabVisibility: (record: any) => string;
  createShareToken: () => string;
  logAudit: (
    userId: string,
    userName: string,
    userEmail: string,
    action: string,
    details: string,
  ) => Promise<void>;
  now?: () => Date;
}

const RESOURCE_CONFIG: Record<Exclude<AssignmentResourceType, 'vocabulary'>, {
  collection: string;
  missingMessage: string;
  forbiddenMessage: string;
}> = {
  listening: {
    collection: 'listening_sets',
    missingMessage: 'Listening set not found.',
    forbiddenMessage: 'Bạn không có quyền giao bộ đề nghe này.',
  },
  mover_reading_writing: {
    collection: 'mover_reading_sets',
    missingMessage: 'Movers Reading & Writing set not found.',
    forbiddenMessage: 'Bạn không có quyền giao bộ đề Movers Reading & Writing này.',
  },
  exam: {
    collection: 'exam_sets',
    missingMessage: 'Exam set not found.',
    forbiddenMessage: 'Bạn không có quyền giao bộ đề thi này.',
  },
};

function normalizeResourceType(value: unknown): AssignmentResourceType {
  return value === 'listening'
    ? 'listening'
    : value === 'mover_reading_writing'
      ? 'mover_reading_writing'
      : value === 'exam'
        ? 'exam'
        : 'vocabulary';
}

function resourceIdFromPayload(resourceType: AssignmentResourceType, payload: any) {
  if (resourceType === 'listening') return String(payload.resourceId || payload.listeningSetId || '');
  if (resourceType === 'mover_reading_writing') {
    return String(payload.resourceId || payload.moverReadingWritingSetId || '');
  }
  if (resourceType === 'vocabulary') return String(payload.vocabSetId || payload.resourceId || '');
  return String(payload.resourceId || '');
}

export function createAssignmentManagementService(options: AssignmentManagementServiceOptions) {
  const now = options.now || (() => new Date());

  const requireActor = (actor: AssignmentActor | undefined) => {
    if (!actor) throw assignmentHttpError(401, 'Unauthenticated');
    return actor;
  };

  const ensureShareToken = async (assignment: any) => {
    const existingToken = String(assignment?.shareToken || assignment?.assignmentSlug || '').trim();
    if (existingToken) {
      return { ...assignment, shareToken: existingToken, assignmentSlug: existingToken };
    }
    const shareToken = options.createShareToken();
    const upgraded = { ...assignment, shareToken, assignmentSlug: shareToken };
    await options.repository.saveAssignment(upgraded);
    return upgraded;
  };

  const listAssignments = async (actorValue: AssignmentActor | undefined) => {
    const actor = requireActor(actorValue);
    const [classes, assignments] = await Promise.all([
      options.repository.listActiveClasses(),
      options.repository.listActiveAssignments(),
    ]);
    const classesById = new Map(classes.map(record => [record.id, record]));
    const visible: any[] = [];
    for (const rawAssignment of assignments) {
      const assignment = await ensureShareToken(rawAssignment);
      const classRecord = assignment.classId ? classesById.get(assignment.classId) : null;
      if (options.canManageAssignment(actor, assignment, classRecord)) visible.push(assignment);
    }
    return visible;
  };

  const loadResource = async (
    actor: AssignmentActor,
    resourceType: AssignmentResourceType,
    payload: any,
  ) => {
    const resourceId = resourceIdFromPayload(resourceType, payload);
    if (resourceType === 'vocabulary') {
      const resource = await options.repository.getResource('vocab_sets', resourceId);
      if (!resource) throw assignmentHttpError(404, 'Vocabulary set not found.');
      if (!options.canViewVocabSet(actor, resource) || options.getVocabVisibility(resource) === 'draft') {
        throw assignmentHttpError(403, 'Ban khong co quyen giao bo tu vung nay.');
      }
      return resource;
    }

    const config = RESOURCE_CONFIG[resourceType];
    const resource = await options.repository.getResource(config.collection, resourceId);
    if (!resource) throw assignmentHttpError(404, config.missingMessage);
    const canManage = actor.role === 'super_admin'
      || (actor.role === 'teacher' && resource.ownerId === actor.id);
    if (!canManage || resource.status !== 'published' || resource.visibility === 'draft') {
      throw assignmentHttpError(403, config.forbiddenMessage);
    }
    return resource;
  };

  const createAssignment = async (actorValue: AssignmentActor | undefined, payloadValue: any) => {
    const actor = requireActor(actorValue);
    const payload = payloadValue || {};
    const classRecord = await options.repository.getClass(String(payload.classId || ''));
    if (!classRecord) throw assignmentHttpError(404, 'Class not found.');
    if (classRecord.lifecycleStatus === 'archived' || classRecord.status === 'archived' || classRecord.archivedAt) {
      throw assignmentHttpError(409, 'Class is archived.');
    }
    if (!options.canManageClass(actor, classRecord)) {
      throw assignmentHttpError(403, 'Ban khong co quyen giao bai cho lop nay.');
    }

    const resourceType = normalizeResourceType(payload.resourceType);
    const resource = await loadResource(actor, resourceType, payload);
    const shareToken = options.createShareToken();
    const id = `assign-${now().getTime()}`;
    const resourceFields = resourceType === 'vocabulary'
      ? {
          vocabSetId: resource.id,
          vocabSetTitle: resource.title || payload.vocabSetTitle || '',
        }
      : resourceType === 'listening'
        ? {
            listeningSetId: resource.id,
            listeningSetTitle: resource.title || payload.resourceTitle || '',
            gameId: 'listening-five-part',
          }
        : resourceType === 'mover_reading_writing'
          ? {
              moverReadingWritingSetId: resource.id,
              moverReadingWritingSetTitle: resource.title || payload.resourceTitle || '',
              gameId: 'mover-reading-writing',
            }
          : {
              examSetId: resource.id,
              examModuleId: resource.moduleId,
              examPaperId: resource.paperId,
              gameId: `exam:${resource.moduleId}:${resource.paperId}`,
            };
    const assignment = {
      ...payload,
      id,
      shareToken,
      assignmentSlug: shareToken,
      classId: classRecord.id,
      className: classRecord.name || payload.className || '',
      resourceType,
      resourceId: resource.id,
      resourceTitle: resource.title || payload.resourceTitle || '',
      ...resourceFields,
      createdAt: now().toISOString(),
      createdBy: actor.id,
    };

    await options.repository.saveAssignment(assignment);
    await options.logAudit(
      actor.id,
      actor.name,
      actor.email,
      'CREATE_ASSIGNMENT',
      `Đã giao bài tập mới: "${assignment.title}" cho lớp: ${assignment.className}`,
    );
    return assignment;
  };

  const archiveAssignment = async (actorValue: AssignmentActor | undefined, assignmentId: string) => {
    const actor = requireActor(actorValue);
    const assignment = await options.repository.getAssignment(assignmentId);
    if (!assignment) throw assignmentHttpError(404, 'Bài tập không tồn tại.');
    const classRecord = assignment.classId
      ? await options.repository.getClass(assignment.classId)
      : null;
    if (!options.canManageAssignment(actor, assignment, classRecord)) {
      throw assignmentHttpError(403, 'Ban khong co quyen xoa bai giao nay.');
    }
    await options.repository.archiveAssignment(assignment, actor.id, now().toISOString());
    await options.logAudit(
      actor.id,
      actor.name,
      actor.email,
      'ARCHIVE_ASSIGNMENT',
      `Đã lưu trữ/thu hồi bài tập: "${assignment?.title}" của lớp: ${assignment?.className}`,
    );
    return { success: true, archived: true };
  };

  return { archiveAssignment, createAssignment, listAssignments };
}
