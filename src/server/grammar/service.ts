interface GrammarLibraryServiceOptions {
  repository: ReturnType<typeof import('./repository.js').createGrammarLibraryRepository>;
  canViewSet: (actor: any, set: any) => boolean;
  canManageSet: (actor: any, set: any) => boolean;
  getVisibility: (set: any) => string;
  sanitizeForStudent: (set: any) => any;
  normalizeForSave: (set: any, existing: any, actor: any) => any;
  makeId: (prefix: string) => string;
  enrichStudentNames: (records: any[]) => Promise<any[]>;
  logAudit: (userId: string, userName: string, userEmail: string, action: string, details: string) => Promise<void>;
  now?: () => Date;
}

function grammarHttpError(status: number, message: string) {
  return Object.assign(new Error(message), { status });
}

function sortSets(list: any[]) {
  return list.sort((a, b) => (
    new Date(b.updatedAt || b.createdAt || 0).getTime()
    - new Date(a.updatedAt || a.createdAt || 0).getTime()
  ));
}

export function createGrammarLibraryService(options: GrammarLibraryServiceOptions) {
  const now = options.now || (() => new Date());
  const requireActor = (actor: any) => {
    if (!actor) throw grammarHttpError(401, 'Unauthenticated');
    return actor;
  };
  const getExisting = async (id: string) => {
    const set = await options.repository.getSet(id);
    if (!set) throw grammarHttpError(404, 'Bài ngữ pháp không tồn tại.');
    return set;
  };

  const listPublicSets = async () => sortSets((await options.repository.listActiveSets())
    .filter(set => options.getVisibility(set) === 'public')
    .map(options.sanitizeForStudent));

  const listSets = async (actor: any) => sortSets((await options.repository.listActiveSets())
    .filter(set => options.canViewSet(actor, set))
    .map(set => actor?.role === 'student' ? options.sanitizeForStudent(set) : set));

  const openSharedSet = async (tokenValue: any) => {
    const token = String(tokenValue || '').trim();
    if (!token) throw grammarHttpError(404, 'Không tìm thấy bài ngữ pháp hoặc link không hợp lệ.');
    const found = (await options.repository.listActiveSets()).find(set => {
      const setToken = set.shareToken || set.assignmentSlug;
      const legacyToken = setToken?.startsWith('grammar-')
        ? setToken.slice('grammar-'.length)
        : `grammar-${setToken}`;
      return (setToken === token || legacyToken === token) && options.getVisibility(set) === 'assignment';
    });
    if (!found) throw grammarHttpError(404, 'Không tìm thấy bài ngữ pháp hoặc link không hợp lệ.');
    return options.sanitizeForStudent(found);
  };

  const getSet = async (actor: any, id: string) => {
    const set = await getExisting(id);
    if (!options.canViewSet(actor, set)) {
      throw grammarHttpError(403, 'Bạn không có quyền mở bài ngữ pháp này.');
    }
    return actor?.role === 'student' ? options.sanitizeForStudent(set) : set;
  };

  const createSet = async (actorValue: any, payload: any) => {
    const actor = requireActor(actorValue);
    const id = options.makeId('grammar-set');
    const set = options.normalizeForSave({ ...payload, id }, {}, actor);
    await options.repository.saveSet(set);
    await options.logAudit(actor.id, actor.name, actor.email, 'CREATE_GRAMMAR_SET',
      `Đã tạo bài ngữ pháp: "${set.title}" (${set.questions.length} câu)`);
    return set;
  };

  const updateSet = async (actorValue: any, id: string, payload: any) => {
    const actor = requireActor(actorValue);
    const existing = await getExisting(id);
    if (!options.canManageSet(actor, existing)) throw grammarHttpError(403, 'Bạn không có quyền sửa bài này.');
    const set = options.normalizeForSave({ ...payload, id }, existing, actor);
    await options.repository.saveSet(set);
    await options.logAudit(actor.id, actor.name, actor.email, 'UPDATE_GRAMMAR_SET',
      `Đã cập nhật bài ngữ pháp: "${set.title}"`);
    return set;
  };

  const archiveSet = async (actorValue: any, id: string) => {
    const actor = requireActor(actorValue);
    const existing = await getExisting(id);
    if (!options.canManageSet(actor, existing)) throw grammarHttpError(403, 'Bạn không có quyền xóa bài này.');
    await options.repository.archiveSet(existing, actor.id, now().toISOString());
    await options.logAudit(actor.id, actor.name, actor.email, 'ARCHIVE_GRAMMAR_SET',
      `Đã lưu trữ bài ngữ pháp và thu hồi link: "${existing.title}"`);
    return { success: true, archived: true };
  };

  const cloneSet = async (actorValue: any, id: string) => {
    const actor = requireActor(actorValue);
    const existing = await getExisting(id);
    if (!options.canViewSet(actor, existing)) throw grammarHttpError(403, 'Ban khong co quyen nhan ban bai nay.');
    const cloneId = options.makeId('grammar-set');
    const clone = options.normalizeForSave({
      ...existing,
      id: cloneId,
      title: `${existing.title} (Bản sao)`,
      visibility: 'draft',
      questions: existing.questions,
    }, {}, actor);
    await options.repository.saveSet(clone);
    return clone;
  };

  const previewSet = async (actor: any, id: string) => {
    const set = await options.repository.getSet(id);
    if (!set || !options.canManageSet(actor, set)) {
      throw grammarHttpError(404, 'Bài ngữ pháp không tồn tại.');
    }
    return set;
  };

  const getResults = async (actorValue: any, id: string) => {
    const actor = requireActor(actorValue);
    const set = await getExisting(id);
    if (!options.canManageSet(actor, set)) {
      throw grammarHttpError(403, 'Bạn không có quyền xem kết quả bài này.');
    }
    const attempts = await options.repository.listAttempts(set.id);
    attempts.sort((a, b) => (
      new Date(b.completedAt || b.createdAt || 0).getTime()
      - new Date(a.completedAt || a.createdAt || 0).getTime()
    ));
    return { set, attempts: await options.enrichStudentNames(attempts) };
  };

  return {
    archiveSet, cloneSet, createSet, getResults, getSet, listPublicSets,
    listSets, openSharedSet, previewSet, updateSet,
  };
}
