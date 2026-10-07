import crypto from 'node:crypto';
import express from 'express';
import { examPaperExamPath } from '../../features/listening-library/routes.js';
import { SCENE_MODULES, type SceneAdminPaper, type SceneEntry, type SceneModule, type ScenePaperId } from '../../features/starter-scene/types.js';
import { getSceneDefinition } from '../../features/starter-scene/sceneDefinition.js';
import { resolveListeningModuleId } from '../../features/listening-library/registry.js';

interface Dependencies { db: any; authenticateUser: express.RequestHandler; requireStaff: express.RequestHandler }
interface StoredLayout { schemaVersion: 1; revision: number; entries: SceneEntry[] }
interface SetRow { id: string; moduleId: string; paperId: string; title: string; ownerId: string; status: string; visibility: string; createdAt?: string }
const failure = (status: number, message: string) => Object.assign(new Error(message), { status });
const settingId = (moduleId: SceneModule, paper: ScenePaperId) => `${moduleId}-scene-${paper}-v1`;
const publicSet = (set: SetRow) => set.status === 'published' && set.visibility === 'public';
export function createStarterSceneRouter({ db, authenticateUser, requireStaff }: Dependencies) {
  const router = express.Router(), locks = new Map<string, Promise<void>>();
  const manage = (user: express.Request['user'], set: SetRow | undefined) => user?.role === 'super_admin' || Boolean(set && user?.role === 'teacher' && user.id === set.ownerId);
  const moduleParam = (req: express.Request): SceneModule => {
    const moduleId = req.params.moduleId || 'starter';
    if (!SCENE_MODULES.includes(moduleId as SceneModule)) throw failure(404, 'Không có trang kỳ thi này.');
    return moduleId as SceneModule;
  };
  const paperParam = (req: express.Request, moduleId: SceneModule): ScenePaperId => {
    const paper = getSceneDefinition(moduleId).papers.find(paper => paper.id === req.params.paperId);
    if (!paper) throw failure(404, 'Không có danh sách bài này.');
    return paper.id;
  };
  const sets = async (moduleId: SceneModule, paper?: ScenePaperId): Promise<SetRow[]> => {
    const rows: SetRow[] = [];
    const sources = moduleId === 'mover'
      ? [{ collection: 'listening_sets', paper: 'listening' }, { collection: 'mover_reading_sets', paper: 'reading-writing' }]
      : [{ collection: 'exam_sets', paper: undefined }];
    const snapshots = await Promise.all(sources.map(source => db.collection(source.collection).get()));
    snapshots.forEach((snapshot, index) => snapshot.forEach((document: any) => {
      const stored = document.data();
      // Movers legacy records have no moduleId. Read them through B's existing alias without rewriting.
      if ((moduleId === 'mover' ? resolveListeningModuleId(stored.moduleId) : stored.moduleId) !== moduleId) return;
      const set = { ...stored, id: document.id, moduleId, paperId: sources[index].paper || stored.paperId };
      if (!paper || set.paperId === paper) rows.push(set);
    }));
    return rows.sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')) || a.id.localeCompare(b.id));
  };
  const load = async (moduleId: SceneModule, paper: ScenePaperId, rows: SetRow[]): Promise<{ layout: StoredLayout; configured: boolean }> => {
    const snapshot = await db.collection('settings').doc(settingId(moduleId, paper)).get();
    if (!snapshot.exists) return { configured: false, layout: { schemaVersion: 1, revision: 0, entries: rows.filter(set => set.paperId === paper && publicSet(set)).map(set => ({ id: `default-${set.id}`, setId: set.id })) } };
    const layout = snapshot.data()?.value as StoredLayout;
    if (layout?.schemaVersion !== 1 || !Number.isSafeInteger(layout.revision) || !Array.isArray(layout.entries) || layout.entries.some(entry => typeof entry?.id !== 'string' || typeof entry?.setId !== 'string')) throw failure(503, 'Không đọc được bố trí đã lưu. Vui lòng liên hệ quản trị viên.');
    return { layout, configured: true };
  };
  const adminView = (paper: ScenePaperId, rows: SetRow[], stored: Awaited<ReturnType<typeof load>>, user: express.Request['user']): SceneAdminPaper => {
    const byId = new Map(rows.map(set => [set.id, set]));
    return { revision: stored.layout.revision, configured: stored.configured, entries: stored.layout.entries.map(entry => {
      const set = byId.get(entry.setId);
      return { ...entry, title: set?.title || 'Bài không còn trong kho', available: Boolean(set && set.paperId === paper && publicSet(set)), manageable: manage(user, set) };
    }), choices: rows.filter(set => set.paperId === paper && publicSet(set)).map(set => ({ setId: set.id, title: set.title, manageable: manage(user, set) })) };
  };
  const error = (res: express.Response, reason: unknown) => res.status(reason instanceof Error && 'status' in reason ? Number(reason.status) : 500).json({ error: reason instanceof Error ? reason.message : 'Không xử lý được danh sách link.' });
  router.get(['/starter-scene', '/scenes/:moduleId'], async (req, res) => {
    try {
      const moduleId = moduleParam(req), rows = await sets(moduleId);
      const papers = Object.fromEntries(await Promise.all(getSceneDefinition(moduleId).papers.map(async ({ id: paper }) => {
        const paperRows = rows.filter(set => set.paperId === paper), byId = new Map(paperRows.map(set => [set.id, set]));
        const { layout, configured } = await load(moduleId, paper, paperRows);
        const links = layout.entries.flatMap(entry => {
          const set = byId.get(entry.setId);
          return set && set.paperId === paper && publicSet(set) ? [{ id: entry.id, title: String(set.title || 'Bài luyện thi').slice(0, 160), href: examPaperExamPath(moduleId, paper, set.id) }] : [];
        });
        return [paper, { revision: layout.revision, configured, links }];
      })));
      res.set('Cache-Control', 'no-store').json({ papers });
    } catch (reason) { error(res, reason); }
  });
  router.get(['/admin/starter-scene/:paperId', '/admin/scenes/:moduleId/:paperId'], authenticateUser, requireStaff, async (req, res) => {
    try { const moduleId = moduleParam(req), paper = paperParam(req, moduleId), rows = await sets(moduleId, paper); res.json(adminView(paper, rows, await load(moduleId, paper, rows), req.user)); } catch (reason) { error(res, reason); }
  });
  router.put(['/admin/starter-scene/:paperId', '/admin/scenes/:moduleId/:paperId'], authenticateUser, requireStaff, async (req, res) => {
    let release: (() => void) | undefined, queued: Promise<void> | undefined, lockKey: string | undefined;
    try {
      const moduleId = moduleParam(req), paper = paperParam(req, moduleId);
      lockKey = settingId(moduleId, paper);
      const previous = locks.get(lockKey) || Promise.resolve(), current = new Promise<void>(resolve => { release = resolve; });
      queued = previous.then(() => current); locks.set(lockKey, queued); await previous;
      const rows = await sets(moduleId, paper), byId = new Map(rows.map(set => [set.id, set])), stored = await load(moduleId, paper, rows);
      if (req.body?.baseRevision !== stored.layout.revision) throw failure(409, 'Danh sách đã thay đổi. Tải lại danh sách trước khi lưu; các chỉnh sửa trên màn hình vẫn được giữ.');
      const input: unknown = req.body.entries;
      if (!Array.isArray(input) || input.length > 1000) throw failure(400, 'Danh sách link không hợp lệ.');
      const existing = new Map(stored.layout.entries.map(entry => [entry.id, entry]));
      const seenIds = new Set<string>(), seenSets = new Set<string>();
      const entries: SceneEntry[] = input.map(value => {
        if (!value || typeof value.setId !== 'string' || !value.setId || value.setId.length > 200 || typeof value.id !== 'string' || !value.id || value.id.length > 250) throw failure(400, 'Hãy chọn bộ đề cho mỗi link trước khi lưu.');
        const prior = existing.get(value.id), set = byId.get(value.setId), retained = prior?.setId === value.setId;
        if (!retained && (!set || set.paperId !== paper || !publicSet(set))) throw failure(400, 'Chỉ thêm được bộ đề công khai thuộc đúng cấp thi và loại bài.');
        if (!retained && !manage(req.user, set)) throw failure(403, 'Giáo viên chỉ thêm hoặc thay bài của mình.');
        if (prior && !manage(req.user, byId.get(prior.setId)) && !retained) throw failure(403, 'Không thể thay link của giáo viên khác.');
        if (seenIds.has(value.id) || seenSets.has(value.setId)) throw failure(400, 'Một bài chỉ xuất hiện một lần trong danh sách.');
        seenIds.add(value.id); seenSets.add(value.setId);
        return { id: prior ? prior.id : crypto.randomUUID(), setId: value.setId };
      });
      if (req.user?.role !== 'super_admin') {
        const foreign = (entry: SceneEntry) => !manage(req.user, byId.get(entry.setId));
        if (JSON.stringify(stored.layout.entries.filter(foreign)) !== JSON.stringify(entries.filter(foreign))) throw failure(403, 'Không thể xóa hoặc đổi thứ tự link của giáo viên khác.');
      }
      const layout: StoredLayout = { schemaVersion: 1, revision: stored.layout.revision + 1, entries };
      await db.collection('settings').doc(settingId(moduleId, paper)).set({ value: layout });
      res.json(adminView(paper, rows, { layout, configured: true }, req.user));
    } catch (reason) { error(res, reason); }
    finally { release?.(); if (lockKey && locks.get(lockKey) === queued) locks.delete(lockKey); }
  });
  return router;
}
