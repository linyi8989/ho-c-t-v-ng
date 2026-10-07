import { useEffect, useRef, useState } from 'react';
import { sceneApi } from './api';
import { paperLabel, type SceneAdminEntry, type SceneAdminPaper, type ScenePaperId, type SceneModule } from './types';
import { getSceneDefinition } from './sceneDefinition';
import { examModulePath } from '../listening-library/routes';
import './starter-scene.css';

export default function StarterSceneAdmin({ token, onClose, moduleId = 'starter' }: { token: string; onClose: () => void; moduleId?: SceneModule }) {
  const definition = getSceneDefinition(moduleId);
  const dialog = useRef<HTMLDialogElement>(null), alive = useRef(true), close = useRef(onClose); close.current = onClose;
  const [paper, setPaper] = useState<ScenePaperId>('listening'), [data, setData] = useState<SceneAdminPaper | null>(null), [entries, setEntries] = useState<SceneAdminEntry[]>([]), [dirty, setDirty] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState(''), [reload, setReload] = useState(0);
  const saving = useRef(false);
  const protectedChanges = useRef(false); protectedChanges.current = dirty || busy;
  useEffect(() => {
    const element = dialog.current;
    const preventUnsavedClose = (event: Event) => { if (protectedChanges.current) event.preventDefault(); };
    alive.current = true; element?.addEventListener('cancel', preventUnsavedClose); element?.showModal();
    return () => { alive.current = false; element?.removeEventListener('cancel', preventUnsavedClose); element?.close(); };
  }, []);
  useEffect(() => {
    const controller = new AbortController(); setData(null); setError(''); setMessage('');
    void sceneApi.admin(token, paper, controller.signal, moduleId).then(value => { if (!controller.signal.aborted) { setData(value); setEntries(value.entries); setDirty(false); } }).catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Không tải được danh sách.'); });
    return () => controller.abort();
  }, [token, paper, reload, moduleId]);
  const change = (next: SceneAdminEntry[]) => { setEntries(next); setDirty(true); setMessage(''); };
  const move = (index: number, delta: number) => { const next = [...entries], target = index + delta; if (target < 0 || target >= next.length || !next[target].manageable) return; [next[index], next[target]] = [next[target], next[index]]; change(next); };
  const save = async () => {
    if (!data || saving.current) return; saving.current = true; setBusy(true); setError(''); setMessage('');
    try {
      const result = await sceneApi.save(token, paper, data.revision, entries.map(({ id, setId }) => ({ id, setId })), moduleId);
      if (alive.current) { setData(result); setEntries(result.entries); setDirty(false); setMessage(`Đã lưu danh sách. Học sinh sẽ thấy bố trí mới khi mở trang ${definition.title}.`); }
    } catch (reason) { if (alive.current) setError(reason instanceof Error ? reason.message : 'Không lưu được danh sách.'); }
    finally { saving.current = false; if (alive.current) setBusy(false); }
  };
  return <dialog id="starter-scene-admin" ref={dialog} aria-labelledby="starter-list-heading" onKeyDown={event => { if (event.key === 'Escape' && protectedChanges.current) { event.preventDefault(); event.stopPropagation(); } }} onClose={() => { if (!dialog.current?.open) close.current(); }}>
    <header><div><h2 id="starter-list-heading">Danh sách link học sinh</h2><p>{definition.title} · Thêm, xóa và đổi thứ tự bài trên {definition.papers.length} sân.</p></div><button type="button" disabled={dirty || busy} onClick={() => dialog.current?.close()}>Đóng</button></header>
    <div className="starter-admin-content">
    <nav aria-label="Chọn danh sách link">{definition.papers.map(({id: value, displayName}) => <button type="button" key={value} disabled={dirty || busy} aria-pressed={paper === value} onClick={() => setPaper(value)}>{displayName}</button>)}</nav>
    <p>Số vị trí bằng số bài trong danh sách. Học sinh xem 5 bài cùng lúc và cuộn đến hết. Xóa link chỉ gỡ khỏi trang {definition.title}; bài trong kho vẫn được giữ.</p>
    {!data && !error ? <p role="status">Đang tải danh sách…</p> : data && <>
      <div className="starter-admin-actions"><strong>{entries.length} link · {paperLabel(paper)}</strong><button type="button" disabled={busy || !data.choices.some(choice => choice.manageable && !entries.some(entry => entry.setId === choice.setId))} onClick={() => change([...entries, { id: `new-${crypto.randomUUID()}`, setId: '', title: '', available: true, manageable: true }])}>+ Thêm link</button><a href={examModulePath(moduleId)} target="_blank" rel="noopener noreferrer">Xem trang học sinh ↗</a></div>
      <ol className="starter-admin-list">{entries.map((entry, index) => <li key={entry.id} data-starter-admin-row>
        <label><span>Vị trí {index + 1}</span><select aria-label={`Bộ đề tại vị trí ${index + 1}`} disabled={busy || !entry.manageable} value={entry.setId} onChange={event => {
          const choice = data.choices.find(item => item.setId === event.target.value); change(entries.map(item => item.id === entry.id ? { ...item, setId: event.target.value, title: choice?.title || '', available: Boolean(choice) } : item));
        }}><option value="">Chọn bộ đề công khai…</option>{!entry.available && <option value={entry.setId}>{entry.title} — không còn công khai</option>}{data.choices.filter(choice => choice.setId === entry.setId || choice.manageable && !entries.some(item => item.setId === choice.setId)).map(choice => <option key={choice.setId} value={choice.setId}>{choice.title}</option>)}</select></label>
        <div><button type="button" aria-label={`Đưa link ${index + 1} lên`} disabled={busy || !entry.manageable || index === 0 || !entries[index - 1]?.manageable} onClick={() => move(index, -1)}>↑</button><button type="button" aria-label={`Đưa link ${index + 1} xuống`} disabled={busy || !entry.manageable || index === entries.length - 1 || !entries[index + 1]?.manageable} onClick={() => move(index, 1)}>↓</button><button type="button" aria-label={`Xóa link ${index + 1}`} disabled={busy || !entry.manageable} onClick={() => change(entries.filter(item => item.id !== entry.id))}>Xóa</button></div>
      </li>)}</ol>
      {!entries.length && <p>Danh sách trống. Bấm Thêm link để chọn bài.</p>}
    </>}
    </div>
    <footer>{error && <p role="alert">{error}</p>}{message && <p role="status">{message}</p>}<div className="starter-admin-actions"><button type="button" className="starter-admin-save" disabled={!data || !dirty || busy || entries.some(entry => !entry.setId)} onClick={() => void save()}>{busy ? 'Đang lưu…' : 'Lưu danh sách'}</button><button type="button" disabled={busy} onClick={() => { setDirty(false); setReload(value => value + 1); }}>{dirty ? 'Bỏ thay đổi / Tải lại' : 'Tải lại danh sách'}</button>{dirty && <span>Lưu hoặc bỏ thay đổi trước khi đóng/đổi loại bài.</span>}</div></footer>
  </dialog>;
}
