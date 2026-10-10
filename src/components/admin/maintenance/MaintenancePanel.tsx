import React, { useCallback, useEffect, useRef, useState } from 'react';
import { HardDrive, RefreshCw, Download, ShieldCheck } from 'lucide-react';
import { formatBytes, maintenanceCleanupDecision, maintenanceStatus, maintenanceStatusDescription, type MaintenanceFile, type MaintenanceSummary } from '../../../shared/maintenance';
import MediaPreview from './MediaPreview';
import HostingInventory from './HostingInventory';
import {cleanupCategory,type HostingEntry} from '../../../shared/hostingInventory';
import './maintenance.css';

const base = '/api/admin/maintenance';
const date = (value?: string) => value ? new Date(value).toLocaleString('vi-VN') : 'Chưa có dữ liệu';
type Confirmation = { title: string; name: string; description: string; execute: (name: string) => Promise<unknown> };
const tabs = [['files', 'File & Dọn dẹp'], ['backups', 'Backup'], ['jobs', 'Tác vụ nền'], ['audit', 'Nhật ký'], ['alerts', 'Cảnh báo'], ['policy', 'Chính sách']] as const;

export default function MaintenancePanel({ token }: { token: string }) {
  const [data, setData] = useState<MaintenanceSummary | null>(null);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [pending, setPending] = useState(false);
  const [tab, setTab] = useState<string>('files'), [filter, setFilter] = useState(''), [status, setStatus] = useState(''), [page, setPage] = useState(1);
  const [progress, setProgress] = useState<number | null>(null), [verificationName, setVerificationName] = useState('');
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null), [typedName, setTypedName] = useState('');
  const [fileMode,setFileMode]=useState<'application'|'hosting'>('application');
  const [cleanupFilter,setCleanupFilter]=useState(''),[applicationFocus,setApplicationFocus]=useState<string|null>(null);
  const [preview, setPreview] = useState<MaintenanceFile | null>(null);
  const dialog = useRef<HTMLDialogElement>(null), worker = useRef<Worker | null>(null), generation = useRef(0);
  const request = useCallback(async <T,>(endpoint: string, body?: unknown, signal?: AbortSignal): Promise<T> => {
    const response = await fetch(base + endpoint, { method: body === undefined ? 'GET' : 'POST', signal,
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Không thể thực hiện yêu cầu.');
    return result as T;
  }, [token]);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const result = await request<MaintenanceSummary>('/summary', undefined, signal);
    if (!signal?.aborted) setData(result);
  }, [request]);
  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => { controller.abort(); generation.current++; worker.current?.terminate(); worker.current = null; };
  }, [refresh]);
  const scanning = Boolean(data?.scanRunning || data?.jobs.some(j => j.task === 'scan' && j.status === 'running'));
  useEffect(() => {
    if (!scanning) return;
    const controller = new AbortController();
    const timer = setInterval(() => void refresh(controller.signal).catch(e => { if (!controller.signal.aborted) setError(e.message); }), 2000);
    return () => { clearInterval(timer); controller.abort(); };
  }, [scanning, refresh]);
  useEffect(() => {
    if (confirmation) { setTypedName(''); dialog.current?.showModal(); }
    else dialog.current?.close();
  }, [confirmation]);
  useEffect(() => { setPage(1); }, [filter, status, tab, cleanupFilter]);
  const perform = async (fn: () => Promise<unknown>, message: string) => {
    setPending(true); setError(''); setNotice('');
    try { await fn(); setNotice(message); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Tác vụ chưa hoàn thành.'); }
    finally { setPending(false); }
  };
  const cancelVerification = () => {
    generation.current++; worker.current?.terminate(); worker.current = null; setProgress(null); setPending(false); setNotice('Đã hủy kiểm tra local; backup trên host được giữ.');
  };
  const verify = (entry: MaintenanceFile, file: File) => {
    const epoch = ++generation.current;
    worker.current?.terminate();
    const active = new Worker(new URL('./checksum.worker.ts', import.meta.url), { type: 'module' });
    worker.current = active; setPending(true); setError(''); setProgress(0); setVerificationName(entry.name);
    const failed = (message: string) => {
      if (epoch !== generation.current) return;
      active.terminate(); worker.current = null; setProgress(null); setPending(false); setError(message);
    };
    active.onerror = () => failed('Không khởi chạy được bộ kiểm tra file. Chưa xác minh, không xóa backup.');
    active.onmessage = event => {
      if (epoch !== generation.current) return;
      if (event.data.error) return failed(event.data.error);
      if (event.data.progress !== undefined) setProgress(event.data.progress);
      if (!event.data.sha256) return;
      active.terminate(); worker.current = null;
      void request('/backups/' + entry.id + '/verify', { sha256: event.data.sha256, bytes: event.data.bytes })
        .then(async () => { if (epoch === generation.current) { setNotice('File local khớp SHA-256 và dung lượng; backup đạt quick_check. Chưa có bằng chứng thử restore.'); await refresh(); } })
        .catch(e => { if (epoch === generation.current) setError(e.message); })
        .finally(() => { if (epoch === generation.current) { setProgress(null); setPending(false); } });
    };
    active.postMessage(file);
  };
  const download = (entry: MaintenanceFile) => perform(async () => {
    const result = await request<{ url: string }>('/backups/' + entry.id + '/download-ticket', {});
    const link = document.createElement('a'); link.href = result.url; link.download = entry.name; link.rel = 'noreferrer';
    document.body.appendChild(link); link.click(); link.remove();
  }, 'Đã yêu cầu tải. Sau khi lưu, chọn lại file trên máy để đối chiếu; lượt tải không tự chứng minh file đã lưu.');
  const deleteBackup = (entry: MaintenanceFile) => perform(async () => {
    const preview = await request<{ approval: string; bytes: number; localVerifiedAt: string }>('/backups/' + entry.id + '/delete-preview', {});
    setConfirmation({ title: 'Xóa backup khỏi hosting', name: entry.name,
      description: 'Xóa vĩnh viễn ' + formatBytes(preview.bytes) + '. File local được đối chiếu lúc ' + date(preview.localVerifiedAt) + '. Không bắt buộc giữ bản trên host. Database đang chạy được bảo vệ. Bản local chưa được thử restore.',
      execute: name => request('/backups/' + entry.id + '/delete', { approval: preview.approval, confirmation: name }) });
  }, 'Đã chuẩn bị bản xem trước; chưa xóa file.');
  const fileAction = (entry: MaintenanceFile, action: string) => setConfirmation({
    title: action === 'quarantine' ? 'Chuyển file vào khu cách ly' : 'Xóa file đã hết hạn', name: entry.name,
    description: entry.reason + ' Dung lượng: ' + formatBytes(entry.bytes) + (action === 'quarantine' ? '. Cách ly vẫn chiếm dung lượng hosting; có thể phục hồi.' : '. Xóa vĩnh viễn; không thể phục hồi file này từ dashboard. Kết quả chấm được giữ.'),
    execute: name => request('/files/' + entry.id + '/cleanup', { action, confirmation: name }),
  });
  const manageApplication=(entry:HostingEntry)=>{
    if(!entry.cleanup.applicationId)return;
    setFileMode('application');setTab(entry.cleanup.action==='manage-backup'?'backups':'files');setFilter('');setStatus('');setCleanupFilter('');setApplicationFocus(entry.cleanup.applicationId);setPage(1);
    setNotice('Đã mở đúng file '+entry.name+'. Thao tác tiếp theo vẫn cần kiểm tra và xác nhận.');
    void refresh().catch(e=>setError(e.message));
  };
  const latest = data?.latest;
  const blocked = pending || Boolean(data?.busy) || scanning;
  const visible = (latest?.entries || []).filter(e => (tab === 'backups' ? e.kind === 'backup' : e.kind !== 'backup')
    && (!applicationFocus||e.id===applicationFocus) && (!cleanupFilter||maintenanceCleanupDecision(e).category===cleanupFilter) && (!status || e.status === status) && (!filter || (e.relative + ' ' + e.reason + ' ' + e.rootId).toLowerCase().includes(filter.toLowerCase())));
  const files = visible.slice((page - 1) * 25, page * 25), pages = Math.max(1, Math.ceil(visible.length / 25));
  const quota = latest?.quota;
  return <div id="maintenance-center">
    <header className="maintenance-header">
      <div><h2><HardDrive aria-hidden size={24} /> Dung lượng & Dọn dẹp</h2><p>Quản lý hosting, backup và dữ liệu hết hạn · Super admin</p></div>
      <div className="maintenance-actions">
        <button data-kind="secondary" disabled={pending} onClick={() => void perform(() => refresh(), 'Đã tải báo cáo gần nhất.')}>Tải lại báo cáo</button>
        <button id="maintenance-scan" data-kind="primary" disabled={blocked} onClick={() => void perform(() => request('/scan', {}), 'Đã yêu cầu quét; trang cập nhật khi tác vụ hoàn tất.')}><RefreshCw size={16} aria-hidden />{scanning ? 'Đang quét…' : 'Quét file ứng dụng'}</button>
      </div>
    </header>
    {error && <p role="alert" className="maintenance-error">{error}</p>}
    {data?.scanError && <p role="alert" className="maintenance-error">{data.scanError}</p>}
    {notice && <p role="status" className="maintenance-notice">{notice}</p>}
    {!data && !error && <p role="status">Đang tải thông tin…</p>}
    {progress !== null && <div className="maintenance-card" role="status">
      <p>Đối chiếu file local: {verificationName} · {Math.round(progress * 100)}%</p><progress max={1} value={progress} />
      <p>File được đọc từng khối trên máy; chỉ checksum và dung lượng gửi lên server.</p>
      <button data-kind="secondary" onClick={cancelVerification}>Hủy kiểm tra</button>
    </div>}
    <div className="maintenance-metrics">
      <article><span>Dung lượng file ứng dụng</span><strong>{latest ? formatBytes(latest.totalBytes) : 'Chưa quét'}</strong><small>{latest ? latest.fileCount.toLocaleString('vi-VN') + ' file · ' + (latest.complete ? 'Hoàn tất phạm vi' : 'Chưa đầy đủ') : 'Bấm Quét để tạo báo cáo'}</small></article>
      <article><span>Quota hosting</span><strong>{quota?.status === 'available' ? formatBytes(quota.usedBytes) + ' / ' + formatBytes(quota.limitBytes) : 'Chưa xác minh'}</strong><small>{quota?.status === 'available' ? 'Còn ' + formatBytes(quota.limitBytes! - quota.usedBytes!) : 'Cần cấu hình kết nối cPanel'}</small></article>
      <article><span>File đủ điều kiện dọn</span><strong>{formatBytes(latest?.entries.filter(e => e.status === 'eligible').reduce((n,e) => n + e.bytes, 0) || 0)}</strong><small>Ứng viên trong báo cáo, chưa giải phóng</small></article>
      <article><span>Đang cách ly</span><strong>{formatBytes(data?.quarantine.reduce((n,e) => n + e.bytes, 0) || 0)}</strong><small>Vẫn chiếm dung lượng host</small></article>
    </div>
    <p className="maintenance-muted">Báo cáo: {date(latest?.at)} · Quota: {date(quota?.measuredAt || undefined)}. Tổng file và quota có thể khác phạm vi/cách tính. Xóa file chưa đồng nghĩa quota cập nhật ngay.</p>
    {!latest && data && <div className="maintenance-card"><h3>Chưa có báo cáo</h3><p>Quét chỉ đọc dữ liệu ứng dụng. Thư mục chưa rõ vai trò được bảo vệ. Không tự tạo backup hoặc xóa file khi mở trang.</p></div>}
    {latest && <div className="maintenance-card">
      <h3>Phân tích thư mục</h3>
      <div className="maintenance-table"><table><thead><tr><th>Nhóm / đường dẫn</th><th>Dung lượng file</th><th>Số file</th><th>Thay đổi từ mốc so sánh</th></tr></thead><tbody>
        {[...latest.groups].sort((a,b) => b.bytes-a.bytes).map(g => <tr key={g.id}><td><strong>{g.label}</strong><small>{g.root}</small></td><td>{formatBytes(g.bytes)}</td><td>{g.files.toLocaleString('vi-VN')}</td><td>{latest.growth.find(x => x.id === g.id) ? formatBytes(latest.growth.find(x => x.id === g.id)!.bytes) : 'Chưa đủ mốc'}</td></tr>)}
      </tbody></table></div>
      <details><summary>Phạm vi và phần chưa đọc ({latest.issues.length})</summary>{data?.roots.map(r => <p key={r.id}>{r.label}: {r.root}</p>)}{latest.issues.map((i,n) => <p key={n}>{i.root}: {i.status} {i.relative || ''}</p>)}</details>
      <details><summary>Lịch sử dung lượng ({data?.snapshots.length || 0} ngày)</summary>
        <div className="maintenance-growth" aria-label="Dung lượng đã quét theo ngày">{data?.snapshots.slice(-30).map(s => <div key={s.at}><span>{date(s.at)}</span><meter min={0} max={Math.max(...data.snapshots.map(x=>x.bytes),1)} value={s.bytes} /><span>{formatBytes(s.bytes)}{s.complete ? '' : ' · chưa đủ'}</span></div>)}</div>
      </details>
    </div>}
    <nav className="maintenance-tabs" aria-label="Chức năng maintenance">{tabs.map(([id,label]) => <button key={id} data-kind="secondary" aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>)}</nav>
    {tab==='files'&&<nav className="maintenance-tabs" aria-label="Phạm vi kiểm kê"><button data-kind="secondary" aria-pressed={fileMode==='application'} onClick={()=>setFileMode('application')}>File ứng dụng</button><button data-kind="secondary" aria-pressed={fileMode==='hosting'} onClick={()=>setFileMode('hosting')}>Thư mục hosting</button></nav>}
    {tab==='files'&&fileMode==='hosting'&&<HostingInventory token={token} onManageApplication={manageApplication}/>}
    {(['backups','jobs','alerts','audit'] as string[]).includes(tab)&&<HostingInventory token={token} mode={tab as 'backups'|'jobs'|'alerts'|'audit'} onManageApplication={manageApplication}/>}
    {((tab === 'files' && fileMode==='application') || tab === 'backups') && <section className="maintenance-card">
      <h3>{tab === 'backups' ? 'Backup Manager' : 'File cần xem xét & file lớn'}</h3>
      {tab === 'backups' && <><p>Không bắt buộc giữ backup trên host. Tải → chọn lại file local → đối chiếu SHA-256/quick_check → xem trước → xác nhận xóa. Backup database không chứa các thư mục media.</p>
        <button data-kind="secondary" disabled={blocked} onClick={() => setConfirmation({ title:'Tạo backup mới', name:'TẠO BACKUP', description:'Tạo thêm file trên hosting bằng SQLite Online Backup. Server kiểm tra quota và khoảng trống dự phòng trước khi tạo; ưu tiên tải bản có sẵn khi host chật.', execute:name=>request('/backups/create',{confirmation:name}) })}>Tạo backup mới có kiểm tra dung lượng</button></>}
      {tab==='files' && <details className="maintenance-status-help"><summary>Ý nghĩa trạng thái và Giữ 30 ngày</summary>
        <p>Giữ 30 ngày chỉ khóa quyền dọn trong thời hạn này, không xóa hay di chuyển file. Khi đang lọc trạng thái cũ, file có thể rời danh sách; chọn Giữ lại hoặc Tất cả để tìm. Bỏ giữ/hết hạn chỉ bỏ khóa, không tự xóa ngay. Dọn sau đó vẫn cần đủ điều kiện và có xác nhận hoặc chính sách/cron đã bật.</p>
        <p>Media nghi ngờ mồ côi chưa được cấp quyền xóa trên web. Speaking không có nút kéo dài thời hạn giữ 24 giờ.</p>
        <dl>{Object.entries(maintenanceStatus).map(([key,label])=><React.Fragment key={key}><dt>{label}</dt><dd>{maintenanceStatusDescription[key]}</dd></React.Fragment>)}</dl>
      </details>}
      {applicationFocus&&<p role="status">Đang mở một file từ kiểm kê hosting. <button data-kind="secondary" onClick={()=>setApplicationFocus(null)}>Xem tất cả file ứng dụng</button>{!visible.length&&'File không còn khớp báo cáo hiện tại; quét file ứng dụng để cập nhật.'}</p>}
      <div className="maintenance-filters"><label>Khả năng dọn<select value={cleanupFilter} onChange={e=>setCleanupFilter(e.target.value)}><option value="">Tất cả</option>{Object.entries(cleanupCategory).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><label>Tìm file<input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Tên, thư mục, lý do…" /></label><label>Trạng thái<select value={status} onChange={e=>setStatus(e.target.value)}><option value="">Tất cả</option>{Object.entries(maintenanceStatus).map(([id,label])=><option value={id} key={id}>{label}</option>)}</select></label></div>
      <div className="maintenance-table"><table><thead><tr><th>File / lý do</th><th>Dung lượng & tuổi</th><th>Khả năng dọn / trạng thái</th><th>Thao tác</th></tr></thead><tbody>
        {files.map(entry => <tr key={entry.id} data-file-id={entry.id}><td><strong>{entry.name}</strong><small>{entry.rootId}/{entry.relative}</small><p>{entry.reason}</p></td><td>{formatBytes(entry.bytes)}<small>{date(entry.modifiedAt)}</small></td><td title={maintenanceStatusDescription[entry.status]}><span className="maintenance-cleanup-badge" data-category={maintenanceCleanupDecision(entry).category}>{maintenanceCleanupDecision(entry).label}</span><details><summary>Điều kiện dọn</summary>{maintenanceCleanupDecision(entry).nextSteps.map(step=><p key={step}>{step}</p>)}</details><small>{entry.pinned ? 'Đã ghim' : maintenanceStatus[entry.status] || entry.status}</small>{entry.heldUntil && <small>Giữ đến {date(entry.heldUntil)}</small>}{entry.verified && <small><ShieldCheck size={14} aria-hidden /> Local đã đối chiếu</small>}</td><td><div className="maintenance-row-actions">
          {entry.previewType && <button data-kind="secondary" disabled={blocked} onClick={()=>setPreview(entry)}>{entry.previewType==='image'?'Xem ảnh':'Nghe trước'}</button>}
          {entry.kind === 'backup' ? <>
            <button data-kind="secondary" disabled={blocked} onClick={()=>void download(entry)}><Download size={14} aria-hidden />Tải</button>
            <label className="maintenance-file-label">Chọn bản đã tải để xác minh<input aria-label={'Chọn file local để xác minh ' + entry.name} type="file" accept=".sqlite,.db" disabled={blocked} onChange={e=>{ const file=e.currentTarget.files?.[0]; e.currentTarget.value=''; if(file) verify(entry,file); }} /></label>
            <button data-kind="secondary" disabled={blocked} onClick={()=>void perform(()=>request('/backups/'+entry.id+'/pin',{enabled:!entry.pinned}), entry.pinned?'Đã bỏ ghim.':'Đã ghim; backup được bảo vệ.')}>{entry.pinned?'Bỏ ghim':'Ghim'}</button>
            <button data-kind="danger" disabled={blocked || !entry.verified || entry.pinned} onClick={()=>void deleteBackup(entry)}>Xem trước xóa khỏi host</button>
          </> : <>
            {entry.kind !== 'speaking' && !['protected','blocked'].includes(entry.status) && <button data-kind="secondary" disabled={blocked} onClick={()=>void perform(()=>request('/files/'+entry.id+'/hold',{days:entry.status==='held'?0:30,reason:'Super admin giữ lại 30 ngày'}),entry.status==='held'?'Đã bỏ giữ.':'Đã giữ 30 ngày tại vị trí cũ; xem bộ lọc Giữ lại. Không xóa hoặc cách ly file.')} >{entry.status==='held'?'Bỏ giữ':'Giữ 30 ngày'}</button>}
            {entry.status === 'eligible' && <>
              <button data-kind="secondary" disabled={blocked} onClick={()=>fileAction(entry,'quarantine')}>Cách ly</button>
              <button data-kind="danger" disabled={blocked} onClick={()=>fileAction(entry,'delete-expired')}>Xem trước xóa hết hạn</button>
            </>}
          </>}
        </div></td></tr>)}
        {!files.length && <tr><td colSpan={4}>Không có file phù hợp trong báo cáo hiện tại.</td></tr>}
      </tbody></table></div>
      <div className="maintenance-pagination"><button data-kind="secondary" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Trước</button><span>{Math.min(page,pages)}/{pages} · {visible.length} file</span><button data-kind="secondary" disabled={page>=pages} onClick={()=>setPage(p=>p+1)}>Sau</button></div>
      {!!data?.quarantine.length && <><h3>Khu cách ly</h3>{data.quarantine.map(item=><div className="maintenance-quarantine" key={item.id}><span>{item.name} · {formatBytes(item.bytes)} · {item.status}</span>{['restore','delete'].map(action=><button key={action} data-kind={action==='delete'?'danger':'secondary'} disabled={blocked || item.status!=='quarantined'} onClick={()=>setConfirmation({title:action==='restore'?'Phục hồi file':'Xóa vĩnh viễn file cách ly',name:item.name,description:action==='restore'?'Phục hồi về đúng vị trí; không ghi đè file đang có.':'File sẽ bị xóa vĩnh viễn khỏi khu cách ly.',execute:name=>request('/quarantine/'+item.id,{action,confirmation:name})})}>{action==='restore'?'Phục hồi':'Xóa vĩnh viễn'}</button>)}</div>)}</>}
    </section>}
    {tab === 'jobs' && <section className="maintenance-card"><h3>Tác vụ thực thi</h3><p>Lịch cron chưa chứng minh đã chạy. Chỉ các tác vụ dùng lõi maintenance này có nhật ký thực thi đầy đủ.</p>
      <div className="maintenance-table"><table><thead><tr><th>Tác vụ</th><th>Trạng thái / thời điểm</th><th>Kết quả</th></tr></thead><tbody>{data?.jobs.map(j=><tr key={j.id}><td>{j.task}<small>{j.source}</small></td><td>{j.status}<small>{date(j.startedAt)}</small>{j.error && <p>{j.error}</p>}</td><td>{j.scanned!==undefined && <p>Quét: {j.scanned}</p>}<p>File xóa: {formatBytes(j.removedBytes || 0)}</p><p>Cách ly: {formatBytes(j.quarantinedBytes || 0)}</p><small>{j.durationMs!==undefined?Math.round(j.durationMs/1000)+' giây':'Chưa kết thúc'}</small></td></tr>)}{!data?.jobs.length && <tr><td colSpan={3}>Chưa có nhật ký thực thi.</td></tr>}</tbody></table></div>
      <h3>Cron đã đăng ký</h3><p>Trạng thái đọc lịch: {latest?.cron.status || 'Chưa kiểm tra'}. Lệnh được ẩn để bảo vệ thông tin. Tác vụ nhà cung cấp không mặc nhiên nằm trong phạm vi.</p>
      {latest?.cron.schedules.map(c=><p key={c.id}>{c.task || 'Chưa nhận diện'} · {c.schedule} · {c.command} · Chưa xác minh lần chạy</p>)}
    </section>}
    {tab === 'audit' && <section className="maintenance-card"><h3>Nhật ký kiểm toán</h3><div className="maintenance-table"><table><thead><tr><th>Thời gian / người thực hiện</th><th>Hành động / file</th><th>Dung lượng</th></tr></thead><tbody>{data?.audit.map(a=><tr key={a.id}><td>{date(a.at)}<small>{a.actor}</small></td><td>{a.action}<small>{a.file || a.reason || ''}</small></td><td>{a.removedBytes!==undefined?'File xóa: '+formatBytes(a.removedBytes):a.quarantinedBytes!==undefined?'Cách ly: '+formatBytes(a.quarantinedBytes):formatBytes(a.bytes)}</td></tr>)}{!data?.audit.length&&<tr><td colSpan={3}>Chưa có nhật ký.</td></tr>}</tbody></table></div></section>}
    {tab === 'alerts' && <section className="maintenance-card"><h3>Cảnh báo & hành động</h3>{latest?.alerts.map((a,i)=><article className={'maintenance-alert '+a.severity} key={i}><strong>{a.message}</strong><p>{a.action}</p></article>)}{!latest?.alerts.length&&<p>{latest?'Không có cảnh báo từ lần quét gần nhất.':'Chưa quét; chưa thể kết luận dung lượng an toàn.'}</p>}<p>Email/cloud chưa được kết nối. Thông báo hiện hiển thị trong dashboard.</p></section>}
    {tab === 'policy' && <section className="maintenance-card"><h3>Chính sách tự động</h3><p>Mặc định tắt. Bật chính sách chỉ cấp phép cho cron đã cấu hình; mở trang hoặc khởi động app không kích hoạt dọn.</p>
      {(['temporary','speaking'] as const).map(kind=><div className="maintenance-policy" key={kind}><div><strong>{kind==='temporary'?'File tạm nhập đề quá 48 giờ':'Bản thu Speaking hết hạn, tối đa 24 giờ'}</strong><p>{kind==='temporary'?'Chỉ đúng thư mục và mẫu file do app tạo.':'Chỉ bản thu có dữ liệu xác minh, không còn job dùng. Quá hạn bị giữ sẽ cảnh báo; audio mẫu và kết quả được giữ.'}</p><span>{data?.policy[kind]?'Đã cấp phép · cần cron thực thi':'Đang tắt'}</span></div><button data-kind="secondary" disabled={blocked} onClick={()=>data?.policy[kind]?void perform(()=>request('/policy',{updates:{[kind]:false}}),'Đã tạm dừng chính sách.'):setConfirmation({title:'Bật dọn tự động',name:'BẬT DỌN TỰ ĐỘNG',description:'Cron được phép xóa vĩnh viễn đúng nhóm file đã hết hạn này. Mỗi file được kiểm tra lại và ghi audit. Không tự chạy khi mở trang.',execute:name=>request('/policy',{updates:{[kind]:true},confirmation:name})})}>{data?.policy[kind]?'Tạm dừng':'Xem và kích hoạt'}</button></div>)}
      <p>Media nghi ngờ, ảnh từ vựng, asset frontend, database và thư mục hosting chưa rõ vai trò không được tự xóa. Backup chỉ xóa sau đối chiếu local và xác nhận cụ thể.</p>
    </section>}
    {preview && <MediaPreview entry={preview} token={token} onClose={()=>setPreview(null)} />}
    <dialog ref={dialog} aria-labelledby="maintenance-confirm-title" onCancel={e=>{if(pending)e.preventDefault();else setConfirmation(null);}}>
      {confirmation && <><h3 id="maintenance-confirm-title">{confirmation.title}</h3><p>{confirmation.description}</p><label>Nhập chính xác để xác nhận<strong>{confirmation.name}</strong><input id="maintenance-confirm-name" autoComplete="off" value={typedName} onChange={e=>setTypedName(e.target.value)} /></label>
        <div className="maintenance-actions"><button data-kind="secondary" disabled={pending} onClick={()=>setConfirmation(null)}>Hủy</button><button id="maintenance-confirm-execute" data-kind="danger" disabled={pending || typedName!==confirmation.name} onClick={()=>void perform(async()=>{await confirmation.execute(typedName);setConfirmation(null);},'Tác vụ hoàn tất; xem nhật ký và quét lại để cập nhật dung lượng.')}>{pending?'Đang thực hiện…':'Xác nhận thực hiện'}</button></div></>}
    </dialog>
  </div>;
}
