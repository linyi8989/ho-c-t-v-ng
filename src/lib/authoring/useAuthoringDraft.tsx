import { useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AuthoringOwner } from './DocumentScope';
import { acknowledgeDraft, draftKey, listDrafts, writeDraft, type DraftRecord } from './draftStorage';
import { registerCheckpoint } from './lifecycle';
interface Options<T> { fixedEntity?: boolean; scope: string; entity?: string; value: T; enabled: boolean; dirty?: boolean; revision?: number; restore: (record: DraftRecord<T>, asCopy: boolean, signal: AbortSignal) => void | Promise<void> }
interface Working<T> { owner: string; scope: string; entity: string; slot: string; baseline: string; json: string; value: T; dirty: boolean; revision?: number; generation: number }
export function useAuthoringDraft<T>(options: Options<T>) {
  const owner = useContext(AuthoringOwner), entity = options.entity || 'new';
  const active = useRef<Working<T> | null>(null), saved = useRef(new Map<string, string>());
  const latest = useRef(options); latest.current = options;
  const restoringController = useRef<AbortController | null>(null);
  const recoveredSlot = useRef<{ owner: string; scope: string; entity: string; slot: string } | null>(null);
  useLayoutEffect(() => { restoringController.current?.abort(); return () => restoringController.current?.abort(); }, [owner, options.scope]);
  const [sessionGeneration, setSessionGeneration] = useState(0);
  const [records, setRecords] = useState<DraftRecord<T>[]>([]), [error, setError] = useState(''), [at, setAt] = useState<number | null>(null), [restoring, setRestoring] = useState(false);
  const reload = () => { try { setRecords(owner ? listDrafts<T>(localStorage, owner, options.scope) : []); } catch { setError('Trình duyệt không cho lưu bản nháp. Hãy lưu bài lên server trước khi thoát.'); } };
  const persist = (working = active.current) => {
    if (!working || !working.dirty || saved.current.get(draftKey(working.owner, working.scope, working.slot)) === JSON.stringify([working.json, working.revision])) return;
    try { const timestamp = Date.now(); writeDraft(localStorage, { version: 1, owner: working.owner, scope: working.scope, entity: working.entity, slot: working.slot, at: timestamp, revision: working.revision, value: working.value }); saved.current.set(draftKey(working.owner, working.scope, working.slot), JSON.stringify([working.json, working.revision])); setAt(timestamp); setError(''); }
    catch (reason) { setError(reason instanceof Error && reason.message.startsWith('Bản nháp') ? reason.message : 'Không lưu được bản nháp trên thiết bị (bộ nhớ đầy hoặc bị chặn). Hãy lưu lên server trước khi thoát.'); }
  };
  useLayoutEffect(() => {
    const old = active.current;
    const restored = recoveredSlot.current;
    const adopt = Boolean(restored && restored.owner === owner && restored.scope === options.scope && restored.entity === entity && options.enabled);
    const changedSession = adopt || !old || old.owner !== owner || old.scope !== options.scope || old.entity !== entity;
    if (old && (changedSession || !options.enabled)) { if (!adopt) persist(old); active.current = null; }
    if (!owner || !options.enabled) return;
    const json = JSON.stringify(options.value), baseline = changedSession || !old ? json : old.baseline;
    active.current = { owner, scope: options.scope, entity, slot: adopt ? restored!.slot : changedSession || !old ? entity + '~' + crypto.randomUUID() : old.slot, baseline, json, value: options.value, revision: options.revision, generation: sessionGeneration, dirty: options.dirty ?? (adopt || json !== baseline) };
    if (adopt) recoveredSlot.current = null;
  }, [owner, options.scope, entity, options.enabled, options.value, options.dirty, options.revision, sessionGeneration]);
  useEffect(() => { reload(); }, [owner, options.scope, entity, options.enabled, sessionGeneration]);
  useEffect(() => { const timer = setTimeout(() => persist(), 250); return () => clearTimeout(timer); }, [options.value, options.dirty, options.enabled, owner, entity]);
  useEffect(() => { const unregister = registerCheckpoint(() => persist()); return () => { persist(); unregister(); }; }, []);
  const begin = () => { persist(); recoveredSlot.current = null; active.current = null; setAt(null); setSessionGeneration(value => value + 1); };
  const markSaved = (value: T, savedEntity = entity) => {
    try { acknowledgeDraft(localStorage, owner, options.scope, value, entity); if (savedEntity !== entity) acknowledgeDraft(localStorage, owner, options.scope, value, savedEntity); const working = active.current;
      if (working && working.owner === owner && working.scope === options.scope && [entity, savedEntity].includes(working.entity) && working.generation === sessionGeneration && working.json === JSON.stringify(value)) { working.dirty = false; working.baseline = working.json; }
      reload();
    } catch { setError('Bài đã lưu nhưng chưa cập nhật được bản nháp trên thiết bị.'); }
  };
  const checkpoint = (value: T, dirty: boolean) => {
    const working = active.current;
    if (!working || working.owner !== owner || working.entity !== entity || working.scope !== options.scope || working.generation !== sessionGeneration) return;
    working.value = value; working.json = JSON.stringify(value); working.dirty = dirty;
    if (dirty) persist(working);
  };
  const rebind = (nextEntity: string, revision?: number) => {
    const working = active.current;
    if (!working || working.owner !== owner || ![entity, nextEntity].includes(working.entity) || working.scope !== options.scope || working.generation !== sessionGeneration) return;
    const oldSlot = working.slot;
    working.entity = nextEntity; working.slot = nextEntity + '~' + oldSlot.slice(oldSlot.indexOf('~') + 1); working.revision = revision;
    if (working.dirty) {
      try {
        writeDraft(localStorage, { version: 1, owner: working.owner, scope: working.scope, entity: nextEntity, slot: working.slot, at: Date.now(), revision, value: working.value });
        saved.current.set(draftKey(owner, working.scope, working.slot), JSON.stringify([working.json, working.revision]));
        localStorage.removeItem(draftKey(owner, working.scope, oldSlot));
      } catch { setError('Bài đã lưu nhưng chưa chuyển được nháp thiết bị. Bản nháp cũ được giữ để phục hồi.'); }
    }
  };
  const recover = async (record: DraftRecord<T>, asCopy = false) => {
    if (record.owner !== owner || restoring) return;
    persist(); setRestoring(true); setError('');
    const controller = new AbortController(); restoringController.current = controller;
    try { await latest.current.restore(record, asCopy, controller.signal); controller.signal.throwIfAborted();
      // Continue the recovered draft in its original slot instead of producing a second stale copy.
      recoveredSlot.current = { owner, scope: options.scope, entity: options.fixedEntity ? entity : asCopy ? 'new' : record.entity, slot: asCopy ? (options.fixedEntity ? entity : 'new') + '~' + crypto.randomUUID() : record.slot || record.entity };
      setSessionGeneration(value => value + 1); setRecords(rows => rows.filter(r => (r.slot || r.entity) !== (record.slot || record.entity))); setAt(record.at); }
    catch (reason) { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Không khôi phục được bản nháp.'); }
    finally { if (restoringController.current === controller) { restoringController.current = null; setRestoring(false); } }
  };
  const discard = (record: DraftRecord<T>) => { if (record.owner !== owner) return; try { localStorage.removeItem(draftKey(owner, options.scope, record.slot || record.entity)); saved.current.delete(draftKey(owner, options.scope, record.slot || record.entity)); reload(); } catch { setError('Không bỏ được bản nháp trên thiết bị.'); } };
  const candidates = records.filter(record => record.owner === owner && record.scope === options.scope && (!options.fixedEntity || record.entity === entity) && !(options.enabled && record.entity === entity && JSON.stringify(record.value) === JSON.stringify(options.value)));
  return { fixedEntity: options.fixedEntity, records: candidates, error, at, restoring, recover, discard, persist, markSaved, rebind, checkpoint, begin };
}
function draftLabel(value: unknown, entity: string) {
  if (value && typeof value === 'object') {
    const row = value as Record<string, unknown>;
    const title = row.editorTitle || row.grammarTitle || row.title || (row.content as { title?: unknown })?.title || (row.draft as { title?: unknown })?.title;
    if (typeof title === 'string' && title.trim()) return title.slice(0, 140);
  }
  return entity === 'new' ? 'Bài đang soạn mới' : entity.startsWith('part-') ? 'Nội dung nhập ' + entity : 'Bài ' + entity;
}
export function DraftRecovery<T>({ draft }: { draft: ReturnType<typeof useAuthoringDraft<T>> }) {
  return <aside className="authoring-draft-recovery" aria-label="Tự lưu và phục hồi bản nháp">
    <p role="status">{draft.at ? 'Nháp thiết bị: ' + new Date(draft.at).toLocaleTimeString('vi-VN') : 'Tự giữ nháp trên thiết bị khi soạn. Lưu/Xuất bản để cập nhật bài trên server.'}</p>
    {draft.error && <p role="alert">{draft.error}</p>}
    {draft.records.length > 0 && <details open><summary>{draft.records.length} bản nháp có thể khôi phục</summary><ul tabIndex={0} aria-label="Các bản nháp chưa lưu trên server">{draft.records.map(record => <li key={record.slot || record.entity}><span>{draftLabel(record.value, record.entity)} · {new Date(record.at).toLocaleString('vi-VN')}</span><div><button type="button" disabled={draft.restoring} onClick={() => void draft.recover(record)}>Khôi phục</button>{!draft.fixedEntity && <button type="button" disabled={draft.restoring} onClick={() => void draft.recover(record, true)}>Khôi phục thành bài mới</button>}<button type="button" disabled={draft.restoring} onClick={() => { if (window.confirm('Bỏ bản nháp trên thiết bị này? Bài trên server vẫn giữ nguyên.')) draft.discard(record); }}>Bỏ nháp thiết bị</button></div></li>)}</ul></details>}
  </aside>;
}
