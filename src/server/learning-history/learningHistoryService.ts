import {
  findAttemptDetail,
  findLearningAttempt,
  findLegacySource,
  listLearningHistory,
} from './learningHistoryRepository';
import {
  normalizeLegacyDetail,
  normalizeStoredDetail,
} from './learningDetailNormalizer';
import type {
  LearningHistoryActor,
  LearningHistoryDetailResponse,
  LearningHistoryFilters,
  LearningHistoryItem,
} from './learningHistoryTypes';

export class LearningHistoryNotFoundError extends Error {
  public status = 404;
  public code = 'HISTORY_ATTEMPT_NOT_FOUND';

  constructor() {
    super('Không tìm thấy lượt học.');
    this.name = 'LearningHistoryNotFoundError';
  }
}

export interface LearningHistoryServiceOptions {
  canStaffViewAttempt?: (
    actor: LearningHistoryActor,
    attempt: LearningHistoryItem,
  ) => Promise<boolean>;
}

export async function getLearningHistory(
  actor: LearningHistoryActor,
  filters: LearningHistoryFilters,
) {
  return listLearningHistory(actor.ownerKey, filters);
}

export async function getLearningHistoryDetail(
  actor: LearningHistoryActor,
  attemptId: string,
  options: LearningHistoryServiceOptions = {},
): Promise<LearningHistoryDetailResponse> {
  const record = await findLearningAttempt(attemptId);
  if (!record) throw new LearningHistoryNotFoundError();

  const isOwner = Boolean(record.ownerKey && record.ownerKey === actor.ownerKey);
  let staffAuthorized = isOwner && (actor.role === 'teacher' || actor.role === 'super_admin');
  if (!isOwner && (actor.role === 'teacher' || actor.role === 'super_admin')) {
    staffAuthorized = Boolean(
      options.canStaffViewAttempt
      && await options.canStaffViewAttempt(actor, record.item),
    );
  }
  if (!isOwner && !staffAuthorized) {
    // Do not reveal whether the attempt id exists.
    throw new LearningHistoryNotFoundError();
  }

  const storedDetail = await findAttemptDetail(attemptId);
  if (storedDetail) {
    return {
      attempt: record.item,
      detailStatus: 'available',
      detail: normalizeStoredDetail(actor, record.item, storedDetail, staffAuthorized),
    };
  }

  if (record.storedDetailStatus === 'legacy') {
    const legacy = await findLegacySource(record.item.sourceType, record.sourceRecordId);
    if (legacy) {
      return {
        attempt: record.item,
        detailStatus: 'available',
        detail: normalizeLegacyDetail(actor, record.item, legacy, staffAuthorized),
      };
    }
    return {
      attempt: record.item,
      detailStatus: 'legacy_unavailable',
      detail: null,
    };
  }

  const status = record.storedDetailStatus === 'expired' ? 'expired' : 'missing';
  return {
    attempt: record.item,
    detailStatus: status,
    detail: null,
  };
}
