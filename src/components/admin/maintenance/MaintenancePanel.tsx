import React, { useCallback, useEffect, useRef, useState } from 'react';
import { HardDrive, RefreshCw } from 'lucide-react';
import { formatBytes, maintenanceCleanupDecision, maintenanceStatus, maintenanceStatusDescription, type MaintenanceFile, type MaintenanceSummary } from '../../../shared/maintenance';
import MediaPreview from './MediaPreview';
import {isCleanupFile} from './storageTrends';
import MaintenanceScrollRegion from './MaintenanceScrollRegion';
import MaintenanceDashboard from './MaintenanceDashboard';
import {scanStatus,type HostingSummary,type HostingTrends} from '../../../shared/hostingInventory';
import './maintenance.css';

const base = '/api/admin/maintenance';
const date = (value?: string) => value ? new Date(value).toLocaleString('vi-VN') : 'Chưa có dữ liệu';
type Confirmation = { title: string; name: string; description: string; execute: (name: string) => Promise<unknown> };
const tabs = [['overview', 'Tổng quan'], ['files', 'File & Dọn dẹp'], ['policy', 'Cài đặt tự động']] as const;

export default function MaintenancePanel({ token }: { token: string }) {
  const [data, setData] = useState<MaintenanceSummary | null>(null);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [pending, setPending] = useState(false);
  const [tab, setTab] = useState<string>('overview'), [filter, setFilter] = useState(''), [kind, setKind] = useState(''), [page, setPage] = useState(1);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null), [typedName, setTypedName] = useState('');
  const [hosting,setHosting]=useState<HostingSummary|null>(null),[trends,setTrends]=useState<HostingTrends|null>(null),[hostingError,setHostingError]=useState('');
  const [preview, setPreview] = useState<MaintenanceFile | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const request = useCallback(async <T,>(endpoint: string, body?: unknown, signal?: AbortSignal): Promise<T> => {
    const response = await fetch(base + endpoint, { method: body === undefined ? 'GET' : 'POST', signal,
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Không thể thực hiện yêu cầu.');
    return result as T;
  }, [token]);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const [application,inventory,folders]=await Promise.allSettled([request<MaintenanceSummary>('/summary',undefined,signal),request<HostingSummary>('/inventory/summary',undefined,signal),request<HostingTrends>('/inventory/trends',undefined,signal)]);
    if(signal?.aborted)return;
    if(inventory.status==='fulfilled')setHosting(inventory.value);
    if(folders.status==='fulfilled')setTrends(folders.value);
    setHostingError([inventory,folders].some(r=>r.status==='rejected')?'Không cập nhật được báo cáo hosting; số liệu trước vẫn được giữ.':'' );
    if(application.status==='fulfilled')setData(application.value);else throw application.reason;
  }, [request]);
  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [refresh]);
  const hostingRunning=Boolean(hosting?.latest&&['queued','running'].includes(hosting.latest.status));
  const applicationScanning = Boolean(data?.scanRunning || data?.jobs.some(j => j.task === 'scan' && j.status === 'running'));
  useEffect(() => {
    if (!applicationScanning&&!hostingRunning) return;
    const controller = new AbortController();
    const timer = setInterval(() => void refresh(controller.signal).catch(e => { if (!controller.signal.aborted) setError(e.message); }), 2000);
    return () => { clearInterval(timer); controller.abort(); };
  }, [applicationScanning,hostingRunning,refresh]);
  useEffect(() => {
    if (confirmation) { setTypedName(''); dialog.current?.showModal(); }
    else dialog.current?.close();
  }, [confirmation]);
  useEffect(() => { setPage(1); }, [filter, kind, tab]);
  const perform = async (fn: () => Promise<unknown>, message: string) => {
    setPending(true); setError(''); setNotice('');
    try { await fn(); setNotice(message); await refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Tác vụ chưa hoàn thành.'); }
    finally { setPending(false); }
  };
  const fileAction = (entry: MaintenanceFile, action: string) => setConfirmation({
    title: action === 'quarantine' ? 'Chuyển file vào khu cách ly' : 'Xóa file đã hết hạn', name: entry.name,
    description: entry.reason + ' Dung lượng: ' + formatBytes(entry.bytes) + (action === 'quarantine' ? '. Cách ly vẫn chiếm dung lượng hosting; có thể phục hồi.' : '. Xóa vĩnh viễn; không thể phục hồi file này từ dashboard. Kết quả chấm được giữ.'),
    execute: name => request('/files/' + entry.id + '/cleanup', { action, confirmation: name }),
  });
  const latest = data?.latest;
  const blocked = pending || Boolean(data?.busy) || applicationScanning;
  const quarantine=(data?.quarantine||[]).filter(item=>['speaking','tts','listening'].includes(item.rootId));
  const visible=(latest?.entries||[]).filter(isCleanupFile).filter(e=>(!kind||(kind==='speaking'?e.kind==='speaking':e.kind==='media'))&&(!filter||(e.relative+' '+e.reason+' '+e.rootId).toLowerCase().includes(filter.toLowerCase())));
  const files=visible.slice((page-1)*25,page*25),pages=Math.max(1,Math.ceil(visible.length/25));
  const scanAll=async()=>{
    setPending(true);setError('');setNotice('');
    const results=await Promise.allSettled([
      request('/scan',{}),
      (async()=>{const current=await request<HostingSummary>('/inventory/summary');
        if(!current.enabled||current.executor!=='process')throw new Error('Hosting chưa bật bộ quét process. File ứng dụng vẫn được quét.');
        const job=current.latest;
        if(job&&['queued','running'].includes(job.status))return;
        if(job?.retained&&['paused','interrupted','failed'].includes(job.status)){
          if(job.scope!==current.scope){await request('/inventory/scans/'+job.id+'/control',{action:'cancel'});await request('/inventory/scan',{});}
          else await request('/inventory/scans/'+job.id+'/control',{action:'resume'});
        }else await request('/inventory/scan',{});
      })()
    ]);
    const errors=results.flatMap((r,i)=>r.status==='rejected'?[(i===0?'Ứng dụng: ':'Hosting: ')+(r.reason instanceof Error?r.reason.message:'Không yêu cầu quét được.')]:[]);
    setNotice(results.every(r=>r.status==='fulfilled')?'Đã yêu cầu quét ứng dụng và toàn tài khoản hosting. Báo cáo cập nhật khi hoàn tất.':results.some(r=>r.status==='fulfilled')?'Đã yêu cầu quét phần khả dụng; xem thông tin phần chưa chạy.':'');
    setError(errors.join(' '));
    try{await refresh();}catch(e){setError(e instanceof Error?e.message:'Không cập nhật được báo cáo.');}finally{setPending(false);}
  };
  return <div id="maintenance-center">
    <header className="maintenance-header">
      <div><h2><HardDrive aria-hidden size={24} /> Dung lượng & Dọn dẹp</h2><p>Theo dõi dung lượng hosting và dọn dữ liệu hết hạn · Super admin</p></div>
    </header>
    <section className="maintenance-card maintenance-control-bar" aria-label="Điều khiển dung lượng và dọn dẹp">
    <nav className="maintenance-tabs" aria-label="Chức năng maintenance">{tabs.map(([id,label]) => <button key={id} data-kind="secondary" aria-pressed={tab === id} onClick={() => { setTab(id); }}>{label}</button>)}</nav>
      {tab==='files'&&<div className="maintenance-control-row"><button id="maintenance-scan" data-kind="primary" disabled={pending||applicationScanning||hostingRunning||Boolean(data?.busy)} onClick={()=>void scanAll()}><RefreshCw size={16} aria-hidden/>{applicationScanning||hostingRunning?'Đang quét…':'Quét tất cả'}</button><small>Ứng dụng và toàn tài khoản hosting; chỉ đọc file khi quét.</small></div>}
    </section>
    {error && <p role="alert" className="maintenance-error">{error}</p>}
    {data?.scanError && <p role="alert" className="maintenance-error">{data.scanError}</p>}
    {tab==='files'&&notice && <p role="status" className="maintenance-notice">{notice}</p>}
    {!data && !error && <p role="status">Đang tải thông tin…</p>}
    {tab==='overview'&&<MaintenanceDashboard data={data} hosting={hosting} trends={trends} hostingError={hostingError}/>}
    {tab==='files'&&<p role="status" className="maintenance-muted">Ứng dụng: {applicationScanning?'Đang quét':latest?.complete?'Đã quét đủ phạm vi':latest?'Báo cáo chưa đủ phạm vi':'Chưa quét'}. Hosting: {hosting?.latest?scanStatus[hosting.latest.status]||hosting.latest.status:'Chưa quét'}{hosting?.latest&&['paused','interrupted','failed'].includes(hosting.latest.status)?'. Bấm Quét tất cả để tiếp tục phần hosting.':''}{hosting?.latest?.reason&&' · '+hosting.latest.reason}{hostingError&&' · '+hostingError}</p>}
    {tab === 'files' && <section className="maintenance-card">
      <h3>Bản thu & file nghi ngờ mồ côi</h3>
      <p className="maintenance-muted">Bản thu còn tác vụ dùng được chặn xóa. Media nghi ngờ vẫn cần kiểm tra tham chiếu trước khi được phép dọn.</p>
      <div className="maintenance-filters"><label>Loại file<select value={kind} onChange={e=>setKind(e.target.value)}><option value="">Bản thu & nghi ngờ mồ côi</option><option value="speaking">Bản thu Speaking</option><option value="orphans">Media nghi ngờ mồ côi</option></select></label><label>Tìm file<input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Tên, đường dẫn…"/></label></div>
      <MaintenanceScrollRegion label="Bản thu và file nghi ngờ mồ côi" className="maintenance-table"><table><thead><tr><th>File / lý do</th><th>Dung lượng & tuổi</th><th>Khả năng dọn / trạng thái</th><th>Thao tác</th></tr></thead><tbody>
        {files.map(entry => <tr key={entry.id} data-file-id={entry.id}><td><strong>{entry.name}</strong><small>{entry.rootId}/{entry.relative}</small><p>{entry.reason}</p></td><td>{formatBytes(entry.bytes)}<small>{date(entry.modifiedAt)}</small></td><td title={maintenanceStatusDescription[entry.status]}><span className="maintenance-cleanup-badge" data-category={maintenanceCleanupDecision(entry).category}>{maintenanceCleanupDecision(entry).label}</span><details><summary>Điều kiện dọn</summary>{maintenanceCleanupDecision(entry).nextSteps.map(step=><p key={step}>{step}</p>)}</details><small>{entry.pinned ? 'Đã ghim' : maintenanceStatus[entry.status] || entry.status}</small>{entry.heldUntil && <small>Giữ đến {date(entry.heldUntil)}</small>}</td><td><div className="maintenance-row-actions">
          {entry.previewType && <button data-kind="secondary" disabled={blocked} onClick={()=>setPreview(entry)}>{entry.previewType==='image'?'Xem ảnh':'Nghe trước'}</button>}
            {entry.kind !== 'speaking' && !['protected','blocked'].includes(entry.status) && <button data-kind="secondary" disabled={blocked} onClick={()=>void perform(()=>request('/files/'+entry.id+'/hold',{days:entry.status==='held'?0:30,reason:'Super admin giữ lại 30 ngày'}),entry.status==='held'?'Đã bỏ giữ.':'Đã giữ 30 ngày tại vị trí cũ. Bấm Bỏ giữ để gỡ bảo vệ.')} >{entry.status==='held'?'Bỏ giữ':'Giữ 30 ngày'}</button>}
            {entry.status === 'eligible' && <>
              <button data-kind="secondary" disabled={blocked} onClick={()=>fileAction(entry,'quarantine')}>Cách ly</button>
              <button data-kind="danger" disabled={blocked} onClick={()=>fileAction(entry,'delete-expired')}>Xem trước xóa hết hạn</button>
            </>}
        </div></td></tr>)}
        {!files.length && <tr><td colSpan={4}>{latest?'Không có file phù hợp trong báo cáo hiện tại.':'Chưa có báo cáo. Bấm Quét tất cả để cập nhật.'}</td></tr>}
      </tbody></table></MaintenanceScrollRegion>
      <div className="maintenance-pagination"><button data-kind="secondary" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>Trước</button><span>{Math.min(page,pages)}/{pages} · {visible.length} file</span><button data-kind="secondary" disabled={page>=pages} onClick={()=>setPage(p=>p+1)}>Sau</button></div>
      {!!quarantine.length && <><h3>Khu cách ly</h3><MaintenanceScrollRegion label="File đang cách ly" size="compact">{quarantine.map(item=><div className="maintenance-quarantine" key={item.id}><span>{item.name} · {formatBytes(item.bytes)} · {item.status}</span>{['restore','delete'].map(action=><button key={action} data-kind={action==='delete'?'danger':'secondary'} disabled={blocked || item.status!=='quarantined'} onClick={()=>setConfirmation({title:action==='restore'?'Phục hồi file':'Xóa vĩnh viễn file cách ly',name:item.name,description:action==='restore'?'Phục hồi về đúng vị trí; không ghi đè file đang có.':'File sẽ bị xóa vĩnh viễn khỏi khu cách ly.',execute:name=>request('/quarantine/'+item.id,{action,confirmation:name})})}>{action==='restore'?'Phục hồi':'Xóa vĩnh viễn'}</button>)}</div>)}</MaintenanceScrollRegion></>}
    </section>}
    {tab === 'policy' && <section className="maintenance-card"><h3>Cài đặt tự động</h3><MaintenanceScrollRegion label="Chính sách dọn tự động"><p>Mặc định tắt. Bật chính sách chỉ cấp phép cho cron đã cấu hình; mở trang hoặc khởi động app không kích hoạt dọn.</p>
      {(['temporary','speaking'] as const).map(kind=><div className="maintenance-policy" key={kind}><div><strong>{kind==='temporary'?'File tạm nhập đề quá 48 giờ':'Bản thu Speaking hết hạn, tối đa 24 giờ'}</strong><p>{kind==='temporary'?'Chỉ đúng thư mục và mẫu file do app tạo.':'Chỉ bản thu có dữ liệu xác minh, không còn job dùng. Quá hạn bị giữ sẽ cảnh báo; audio mẫu và kết quả được giữ.'}</p><span>{data?.policy[kind]?'Đã cấp phép · cần cron thực thi':'Đang tắt'}</span></div><button data-kind="secondary" disabled={blocked} onClick={()=>data?.policy[kind]?void perform(()=>request('/policy',{updates:{[kind]:false}}),'Đã tạm dừng chính sách.'):setConfirmation({title:'Bật dọn tự động',name:'BẬT DỌN TỰ ĐỘNG',description:'Cron được phép xóa vĩnh viễn đúng nhóm file đã hết hạn này. Mỗi file được kiểm tra lại và ghi audit. Không tự chạy khi mở trang.',execute:name=>request('/policy',{updates:{[kind]:true},confirmation:name})})}>{data?.policy[kind]?'Tạm dừng':'Xem và kích hoạt'}</button></div>)}
      <p>Media nghi ngờ, ảnh từ vựng, asset frontend, database và thư mục hosting không được tự xóa từ các cài đặt này.</p>
      </MaintenanceScrollRegion>
    </section>}
    {preview && <MediaPreview entry={preview} token={token} onClose={()=>setPreview(null)} />}
    <dialog ref={dialog} aria-labelledby="maintenance-confirm-title" onCancel={e=>{if(pending)e.preventDefault();else setConfirmation(null);}}>
      {confirmation && <><h3 id="maintenance-confirm-title">{confirmation.title}</h3><p>{confirmation.description}</p><label>Nhập chính xác để xác nhận<strong>{confirmation.name}</strong><input id="maintenance-confirm-name" autoComplete="off" value={typedName} onChange={e=>setTypedName(e.target.value)} /></label>
        <div className="maintenance-actions"><button data-kind="secondary" disabled={pending} onClick={()=>setConfirmation(null)}>Hủy</button><button id="maintenance-confirm-execute" data-kind="danger" disabled={pending || typedName!==confirmation.name} onClick={()=>void perform(async()=>{await confirmation.execute(typedName);setConfirmation(null);},'Tác vụ hoàn tất; quét lại trong File & Dọn dẹp để cập nhật dung lượng.')}>{pending?'Đang thực hiện…':'Xác nhận thực hiện'}</button></div></>}
    </dialog>
  </div>;
}
