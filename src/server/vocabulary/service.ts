interface VocabularyServiceOptions {
  repository: ReturnType<typeof import('./repository.js').createVocabularyRepository>;
  canViewSet: (actor: any, set: any) => boolean;
  canManageSet: (actor: any, set: any) => boolean;
  canManageAssignment: (actor: any, assignment: any, classRecord?: any) => boolean;
  isSuperAdmin: (actor: any) => boolean;
  getVisibility: (set: any) => string;
  toLegacyStatus: (visibility: any) => string;
  normalizeForRead: (set: any) => any;
  normalizeForSave: (set: any, existing?: any) => any;
  stripPrivateFields: (set: any) => any;
  resolveLearningAccess: (token: string, timing?: any) => Promise<any>;
  normalizeTtsSettings: (value: any) => any;
  enqueueAudio: (setId: string, settings: any, itemIds?: string[], force?: boolean) => void;
  enrichStudentNames?: (records: any[]) => Promise<any[]>;
  omitSensitiveSessionFields?: (record: any) => any;
  logAudit: (userId: string, userName: string, userEmail: string, action: string, details: string) => Promise<void>;
  now?: () => Date;
}

function vocabularyHttpError(status: number, message: string) {
  return Object.assign(new Error(message), { status });
}

export function createVocabularyService(options: VocabularyServiceOptions) {
  const now = options.now || (() => new Date());
  const requireActor = (actor: any) => {
    if (!actor) throw vocabularyHttpError(401, 'Unauthenticated');
    return actor;
  };
  const getExisting = async (id: string) => {
    const set = await options.repository.getSet(id);
    if (!set) throw vocabularyHttpError(404, 'Bộ từ vựng không tồn tại.');
    return set;
  };

  const openSharedSet = async (tokenValue: any, timing?: any) => {
    const token = String(tokenValue || '').trim();
    if (!token) throw vocabularyHttpError(404, 'Không tìm thấy bài tập hoặc link không hợp lệ');
    const access = await options.resolveLearningAccess(token, timing);
    if (!access) throw vocabularyHttpError(404, 'Không tìm thấy bài tập hoặc link không hợp lệ');
    const found = access.assignment ? {
      ...options.normalizeForRead(access.set),
      accessType: access.accessType,
      assignmentId: access.assignment.id,
      assignmentGameId: access.assignment.gameId,
      assignmentTitle: access.assignment.title,
      classId: access.assignment.classId,
      className: access.assignment.className,
    } : {
      ...options.normalizeForRead(access.set),
      accessType: access.accessType,
    };
    return options.stripPrivateFields(found);
  };

  const listPublicSets = async () => {
    const sets = await options.repository.listActiveSets();
    return sets
      .filter(set => options.getVisibility(set) === 'public')
      .map(set => {
        const visibility = options.getVisibility(set);
        return options.stripPrivateFields({
          ...set,
          visibility,
          status: options.toLegacyStatus(visibility),
        });
      });
  };

  const listSets = async (actor: any, filters: any) => {
    let list = (await options.repository.listActiveSets()).map(set => {
      const visibility = options.getVisibility(set);
      return options.stripPrivateFields({
        ...set,
        visibility,
        status: options.toLegacyStatus(visibility),
      });
    });
    if (filters.search) {
      const search = String(filters.search).toLowerCase();
      list = list.filter(set => (
        set.title.toLowerCase().includes(search)
        || set.description.toLowerCase().includes(search)
        || set.subject.toLowerCase().includes(search)
      ));
    }
    if (filters.grade) list = list.filter(set => set.gradeLevel === filters.grade);
    if (filters.status) list = list.filter(set => set.status === filters.status);
    if (filters.visibility) list = list.filter(set => options.getVisibility(set) === filters.visibility);
    return list.filter(set => options.canViewSet(actor, set));
  };

  const createSet = async (actorValue: any, payload: any) => {
    const actor = requireActor(actorValue);
    const resolved = await options.repository.resolveImageReferences(payload, {});
    const id = `set-${now().getTime()}`;
    const set = options.normalizeForSave({
      ...resolved,
      id,
      createdAt: now().toISOString(),
      createdBy: actor.id,
      creatorName: actor.name,
    });
    await options.repository.saveSet(set);
    if (set.ttsSettings?.autoGenerate) options.enqueueAudio(id, set.ttsSettings);
    await options.logAudit(actor.id, actor.name, actor.email, 'CREATE_VOCAB_SET',
      `Đã tạo bộ từ vựng mới: "${set.title}" (${set.items.length} từ)`);
    return options.stripPrivateFields(set);
  };

  const updateSet = async (actorValue: any, id: string, payload: any) => {
    const actor = requireActor(actorValue);
    const existing = await getExisting(id);
    if (!options.canManageSet(actor, existing)) {
      throw vocabularyHttpError(403, 'Ban khong co quyen sua bo tu vung nay.');
    }
    const resolved = await options.repository.resolveImageReferences(payload, existing);
    const set = options.normalizeForSave({ ...resolved, id }, existing);
    await options.repository.saveSet(set);
    if (set.ttsSettings?.autoGenerate) options.enqueueAudio(id, set.ttsSettings);
    await options.logAudit(actor.id, actor.name, actor.email, 'UPDATE_VOCAB_SET',
      `Đã chỉnh sửa bộ từ vựng: "${set.title}"`);
    return options.stripPrivateFields(set);
  };

  const getAudioStatus = async (actor: any, id: string) => {
    const set = await options.repository.getSet(id);
    if (!set) throw vocabularyHttpError(404, 'Vocabulary set not found.');
    if (!options.canManageSet(actor, set)) {
      throw vocabularyHttpError(403, 'Ban khong co quyen xem trang thai audio cua bo tu vung nay.');
    }
    const items = Array.isArray(set.items) ? set.items : [];
    return {
      id: set.id,
      items: items.map((item: any) => ({
        id: item.id, term: item.term, audioUrl: item.audioUrl, audioHash: item.audioHash,
        audioStatus: item.audioStatus || (item.audioUrl ? 'ready' : 'missing'),
        audioError: item.audioError || '', ttsProvider: item.ttsProvider,
        ttsVoice: item.ttsVoice, ttsLang: item.ttsLang, ttsSpeed: item.ttsSpeed,
        ttsText: item.ttsText, audioWarnings: item.audioWarnings || [],
        audioGeneratedAt: item.audioGeneratedAt, audioUpdatedAt: item.audioUpdatedAt,
      })),
    };
  };

  const getImageStatus = async (actor: any, id: string) => {
    const set = await options.repository.getSet(id);
    if (!set) throw vocabularyHttpError(404, 'Vocabulary set not found.');
    if (!options.canManageSet(actor, set)) {
      throw vocabularyHttpError(403, 'Ban khong co quyen xem trang thai anh cua bo tu vung nay.');
    }
    const items = Array.isArray(set.items) ? set.items : [];
    return {
      id: set.id,
      items: items.map((item: any) => ({
        id: item.id, term: item.term, imageAssetId: item.imageAssetId,
        imageUrl: item.imageUrl, imageAttribution: item.imageAttribution,
        imageAttachedAt: item.imageAttachedAt,
        imageStatus: item.imageAssetId && item.imageUrl ? 'ready' : item.imageUrl ? 'legacy' : 'missing',
      })),
    };
  };

  const queueMissingAudio = async (actor: any, id: string, payload: any) => {
    const set = await options.repository.getSet(id);
    if (!set) throw vocabularyHttpError(404, 'Vocabulary set not found.');
    if (!options.canManageSet(actor, set)) {
      throw vocabularyHttpError(403, 'Ban khong co quyen tao audio cho bo tu vung nay.');
    }
    const settings = options.normalizeTtsSettings(payload?.settings || set.ttsSettings || {});
    const itemIds = Array.isArray(payload?.itemIds) ? payload.itemIds.map(String) : undefined;
    const force = Boolean(payload?.force);
    options.enqueueAudio(id, settings, itemIds, force);
    return { queued: true, itemIds: itemIds || null, force };
  };

  const archiveSet = async (actorValue: any, id: string) => {
    const actor = requireActor(actorValue);
    const set = await getExisting(id);
    if (!options.canManageSet(actor, set)) {
      throw vocabularyHttpError(403, 'Ban khong co quyen xoa bo tu vung nay.');
    }
    const assignments = await options.repository.listAssignmentsForVocab(id);
    if (!options.isSuperAdmin(actor)) {
      const classes = await options.repository.listActiveClasses();
      const classesById = new Map(classes.map(item => [item.id, item]));
      for (const assignment of assignments) {
        const classRecord = assignment.record.classId ? classesById.get(assignment.record.classId) : null;
        if (!options.canManageAssignment(actor, assignment.record, classRecord)) {
          throw vocabularyHttpError(403, 'Bo tu vung nay dang duoc giao cho lop ban khong quan ly.');
        }
      }
    }
    await options.repository.archiveSetAndAssignments(set, assignments, actor.id, now().toISOString());
    await options.logAudit(actor.id, actor.name, actor.email, 'ARCHIVE_VOCAB_SET',
      `Đã lưu trữ bộ từ vựng và thu hồi link: "${set?.title}"`);
    return { success: true, archived: true };
  };

  const cloneSet = async (actorValue: any, id: string) => {
    const actor = requireActor(actorValue);
    const original = await getExisting(id);
    if (!options.canViewSet(actor, original)) {
      throw vocabularyHttpError(403, 'Ban khong co quyen nhan ban bo tu vung nay.');
    }
    const cloneId = `set-${now().getTime()}`;
    const clone = options.normalizeForSave({
      ...original,
      id: cloneId,
      title: `${original.title} (Nhân bản)`,
      visibility: 'draft',
      status: 'draft',
      createdAt: now().toISOString(),
      createdBy: actor.id,
      creatorName: actor.name,
    });
    await options.repository.saveSet(clone);
    await options.logAudit(actor.id, actor.name, actor.email, 'CLONE_VOCAB_SET',
      `Đã nhân bản bộ từ vựng: "${original.title}" thành "${clone.title}"`);
    return options.stripPrivateFields(clone);
  };

  const previewSet = async (actor: any, id: string) => {
    const set = await options.repository.getSet(id);
    if (!set || !options.canManageSet(actor, set)) {
      throw vocabularyHttpError(404, 'Bộ từ vựng không tồn tại.');
    }
    return options.stripPrivateFields(set);
  };

  const getResults = async (actorValue: any, id: string) => {
    const actor = requireActor(actorValue);
    const set = await options.repository.getSet(id);
    if (!set) throw vocabularyHttpError(404, 'Vocabulary set not found.');
    if (!options.canManageSet(actor, set)) {
      throw vocabularyHttpError(403, 'You do not have permission to view results for this vocabulary set.');
    }
    const sessions = (await options.repository.listGameSessions(set.id))
      .filter(session => session.vocabSetId === set.id)
      .map(session => {
        const interrupted = !session.completedAt
          && now().getTime() - new Date(session.lastSavedAt || session.startedAt || session.createdAt || 0).getTime() >= 24 * 60 * 60 * 1000;
        const shaped = {
          ...session,
          displayStatus: session.completedAt ? 'completed' : interrupted ? 'abandoned' : 'in_progress',
        };
        return options.omitSensitiveSessionFields ? options.omitSensitiveSessionFields(shaped) : shaped;
      });
    sessions.sort((a, b) => new Date(b.completedAt || b.endedAt || b.createdAt || 0).getTime() - new Date(a.completedAt || a.endedAt || a.createdAt || 0).getTime());
    return {
      set,
      sessions: options.enrichStudentNames ? await options.enrichStudentNames(sessions) : sessions,
    };
  };

  return {
    archiveSet, cloneSet, createSet, getAudioStatus, getImageStatus, getResults,
    listPublicSets, listSets, openSharedSet, previewSet, queueMissingAudio, updateSet,
  };
}
