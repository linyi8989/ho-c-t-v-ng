import React,{useCallback,useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import MaintenanceScrollRegion from './MaintenanceScrollRegion';
import {formatBytes} from '../../../shared/maintenance';
import {cleanupCategory,associationKind,hostingStatus,sourceStatus,scanStatus,type HostingEntry,type HostingEvidence,type HostingSummary,type HostingTree} from '../../../shared/hostingInventory';
const date=(value?:string|null)=>value?new Date(value).toLocaleString('vi-VN'):'Chưa có';
type Mode='overview'|'files'|'jobs';
export default function HostingInventory({token,mode='files',onManageApplication,controlsTarget}:{token:string;mode?:Mode;onManageApplication?:(entry:HostingEntry)=>void;controlsTarget?:HTMLDivElement|null}) {
  const [summary,setSummary]=useState<HostingSummary|null>(null),[tree,setTree]=useState<HostingTree|null>(null),[evidence,setEvidence]=useState<HostingEvidence|null>(null);
  const [parent,setParent]=useState(''),[page,setPage]=useState(1),[evidencePage,setEvidencePage]=useState(1);
  const [role,setRole]=useState(''),[filter,setFilter]=useState(''),[status,setStatus]=useState('attention'),[minimum,setMinimum]=useState('0'),[sort,setSort]=useState('size');
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[pending,setPending]=useState(false),[loading,setLoading]=useState(false);
  const [selected,setSelected]=useState<HostingEntry|null>(null),[revision,setRevision]=useState(0);
  const opener=useRef<HTMLElement|null>(null),downloadController=useRef<AbortController|null>(null);
  const [downloading,setDownloading]=useState(false);
  useEffect(()=>()=>{const controller=downloadController.current;downloadController.current=null;controller?.abort();},[]);
  const inspector=useRef<HTMLHeadingElement>(null),activeScan=summary?.latest;
  const request=useCallback(async<T,>(url:string,body?:unknown,signal?:AbortSignal):Promise<T>=>{
    const res=await fetch('/api/admin/maintenance/inventory'+url,{method:body===undefined?'GET':'POST',signal,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const value=await res.json().catch(()=>({}));if(!res.ok)throw new Error(value.error||'Không đọc được inventory.');return value as T;
  },[token]);
  const refresh=useCallback(async(signal?:AbortSignal)=>{const result=await request<HostingSummary>('/summary',undefined,signal);if(!signal?.aborted)setSummary(result);},[request]);
  useEffect(()=>{const c=new AbortController();void refresh(c.signal).catch(e=>{if(!c.signal.aborted)setError(e.message);});return()=>c.abort();},[refresh,revision]);
  const running=Boolean(activeScan&&['queued','running'].includes(activeScan.status));
  useEffect(()=>{if(!running)return;const c=new AbortController();const timer=setInterval(()=>{if(!document.hidden)void refresh(c.signal).catch(e=>{if(!c.signal.aborted)setError(e.message);});},2500);return()=>{clearInterval(timer);c.abort();};},[running,refresh]);
  useEffect(()=>{setParent('');setPage(1);setSelected(null);setEvidence(null);setEvidencePage(1);},[activeScan?.id]);
  useEffect(()=>{setPage(1);},[filter,status,role,minimum,sort,parent]);
  useEffect(()=>{setRole('');},[parent]);
  useEffect(()=>{setSelected(null);setEvidence(null);},[mode]);
  useEffect(()=>{
    if(!activeScan?.retained)return;
    const c=new AbortController(),scan=activeScan.id;setLoading(true);
    const params=new URLSearchParams({parent,page:String(page),filter,status,role,minBytes:minimum,sort});
    const endpoint=mode==='files'?'/tree?'+params:'';
    if(!endpoint){setLoading(false);return;}
    const timer=setTimeout(()=>{void request<HostingTree>('/scans/'+scan+endpoint,undefined,c.signal)
      .then(value=>{if(!c.signal.aborted){setTree(value);}})
      .catch(e=>{if(!c.signal.aborted)setError(e.message);}).finally(()=>{if(!c.signal.aborted)setLoading(false);});},150);
    return()=>{clearTimeout(timer);c.abort();};
  },[activeScan?.id,activeScan?.retained,activeScan?.status,parent,page,filter,status,role,minimum,sort,mode,revision,request]);
  useEffect(()=>{
    if(!activeScan||!selected)return;const c=new AbortController();
    void request<HostingEvidence>('/scans/'+activeScan.id+'/entries/'+selected.id+'/evidence?page='+evidencePage,undefined,c.signal).then(value=>{if(!c.signal.aborted)setEvidence(value);}).catch(e=>{if(!c.signal.aborted)setError(e.message);});return()=>c.abort();
  },[selected,activeScan?.id,evidencePage,revision,request]);
  useEffect(()=>{if(evidence&&selected)inspector.current?.focus();},[evidence?.entry.id,selected]);
  const act=async(url:string,body:unknown,message:string)=>{setPending(true);setError('');setNotice('');try{await request(url,body);setNotice(message);await refresh();setRevision(r=>r+1);}catch(e){setError(e instanceof Error?e.message:'Tác vụ lỗi.');}finally{setPending(false);}};
  const downloadReport=async()=>{
    if(!activeScan?.retained||downloading)return;
    const scanId=activeScan.id,controller=new AbortController();downloadController.current=controller;
    const timeout=setTimeout(()=>controller.abort(),70000);setDownloading(true);setError('');setNotice('');
    try {
      const response=await fetch('/api/admin/maintenance/inventory/scans/'+scanId+'/report',{signal:controller.signal,headers:{Authorization:'Bearer '+token}});
      if(!response.ok){const value=await response.json().catch(()=>({}));throw new Error(value.error||'Không tải được báo cáo hosting.');}
      const blob=await response.blob();controller.signal.throwIfAborted();
      const url=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=url;anchor.download='hosting-report-'+scanId+'.json';document.body.appendChild(anchor);
      try{anchor.click();}finally{anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
      setNotice('Đã gửi báo cáo JSON cho trình duyệt tải về. Báo cáo gồm mọi tầng/thư mục đã quét; kiểm tra mục tải xuống của trình duyệt.');
    } catch(e){if(downloadController.current===controller)setError(controller.signal.aborted?'Tải báo cáo đã dừng hoặc quá thời gian; hãy thử lại.':e instanceof Error?e.message:'Không tải được báo cáo hosting.');}
    finally{clearTimeout(timeout);if(downloadController.current===controller){downloadController.current=null;setDownloading(false);}}
  };
  const view=(entry:HostingEntry)=>{opener.current=document.activeElement instanceof HTMLElement?document.activeElement:null;setEvidence(null);setEvidencePage(1);setSelected(entry);};
  const assessment=(entry:HostingEntry)=><><span className="maintenance-cleanup-badge" data-category={entry.cleanup.category}>{cleanupCategory[entry.cleanup.category]}</span><p>{entry.cleanup.reason}</p><small>Tham chiếu: {hostingStatus[entry.status]} · {entry.role}</small></>;
  const owner=(entry:HostingEntry)=><><strong>{entry.association.label}</strong><small>{associationKind[entry.association.kind]}</small>{entry.association.owners.map(name=><small key={name}>{name}</small>)}<small>{entry.association.reason}</small></>;
  const actions=(entry:HostingEntry)=><div className="maintenance-row-actions">{entry.cleanup.applicationId&&entry.cleanup.action!=='manage-backup'&&onManageApplication&&<button data-kind={entry.cleanup.category==='ready'?'primary':'secondary'} onClick={()=>onManageApplication(entry)}>{entry.cleanup.category==='ready'?'Dọn file này':'Mở file ứng dụng'}</button>}<button data-kind="secondary" data-action="inspect-hosting" onClick={()=>view(entry)}>{entry.cleanup.category==='protected'?'Vì sao bảo vệ':entry.cleanup.category==='ready'?'Chi tiết / bằng chứng':'Xem điều kiện dọn'}</button></div>;
  const controls=<div className="maintenance-actions">
    <button id="hosting-inventory-scan" data-kind="primary" disabled={pending||running||activeScan?.status==='paused'||!summary?.enabled||summary?.executor!=='process'} onClick={()=>void act('/scan',{},'Đã yêu cầu quét metadata toàn tài khoản; chưa xử lý file.')}>Quét toàn tài khoản</button>
    <button data-kind="secondary" disabled={pending} onClick={()=>{setError('');setRevision(r=>r+1);}}>Cập nhật báo cáo</button>
    <button id="hosting-inventory-download" data-kind="secondary" disabled={downloading||!activeScan?.retained} onClick={()=>void downloadReport()}>{downloading?'Đang tải báo cáo…':'Tải báo cáo JSON'}</button>
    {activeScan&&running&&<button data-kind="secondary" disabled={pending} onClick={()=>void act('/scans/'+activeScan.id+'/control',{action:'pause'},'Đã yêu cầu dừng ở ranh giới batch.')}>Tạm dừng</button>}
    {activeScan&&['paused','interrupted','failed'].includes(activeScan.status)&&<button data-kind="secondary" disabled={pending||summary?.executor!=='process'} onClick={()=>void act('/scans/'+activeScan.id+'/control',{action:'resume'},'Đã yêu cầu tiếp tục từ hàng chờ bền vững.')}>Tiếp tục</button>}
    {activeScan&&!['completed','cancelled'].includes(activeScan.status)&&<button data-kind="secondary" disabled={pending} onClick={()=>void act('/scans/'+activeScan.id+'/control',{action:'cancel'},'Đã yêu cầu hủy kiểm kê; các file nguồn vẫn được giữ.')}>Hủy quét</button>}
  </div>;
  const pagination=(p:number,pages:number,total:number,change:(n:number)=>void)=><div className="maintenance-pagination"><button data-kind="secondary" disabled={loading||p<=1} onClick={()=>change(p-1)}>Trang trước</button><span>{p}/{pages} · {total.toLocaleString('vi-VN')} mục</span><button data-kind="secondary" disabled={loading||p>=pages} onClick={()=>change(p+1)}>Trang sau</button></div>;
  const scanProgress=activeScan&&<div className="hosting-progress" role="status"><strong>{scanStatus[activeScan.status]||activeScan.status}</strong> · {{queued:'Đang chờ',sources:'Đọc nguồn phụ thuộc',filesystem:'Đọc thư mục',aggregate:'Tổng hợp',complete:'Hoàn tất'}[activeScan.phase]||activeScan.phase} · {activeScan.fileCount.toLocaleString('vi-VN')} file / {activeScan.directoryCount.toLocaleString('vi-VN')} thư mục
    <small>Bắt đầu {date(activeScan.startedAt)} · heartbeat {date(activeScan.heartbeat)} · kết thúc {date(activeScan.finishedAt)}</small><small>{running?'Đang xét':'Thư mục xét gần nhất'}: {activeScan.currentPath||'Gốc tài khoản'}{activeScan.reason?' · '+activeScan.reason:''}</small>
  </div>;
  return <section className="maintenance-card hosting-inventory" aria-label="Kiểm kê hosting">
    <div className="maintenance-section-heading"><h3>{mode==='overview'?'Tổng quan hosting':mode==='files'?'Thư mục hosting':'Cấu hình và tiến độ tác vụ hosting'}</h3>{activeScan&&<span className="maintenance-cleanup-badge">{scanStatus[activeScan.status]||activeScan.status}</span>}</div>
    {mode==='files'&&(controlsTarget?createPortal(controls,controlsTarget):controls)}
    {error&&<p role="alert" className="maintenance-error">{error}</p>}{notice&&<p role="status" className="maintenance-notice">{notice}</p>}
    {!summary&&!error&&<p role="status">Đang tải báo cáo cached…</p>}
    {summary&&<>
      {mode==='overview'&&<>
        <p className="hosting-path">Phạm vi đăng ký: <strong>{summary.root}</strong></p>
        {summary.executor!=='process'&&<p className="maintenance-alert warning">Executor chưa cấu hình. Cần kiểm tra khả năng host và bật process hoặc chạy CLI inventory. Mở trang không kích hoạt quét.</p>}
        {!activeScan&&<p>Chưa quét toàn tài khoản. Báo cáo file ứng dụng và quota là nguồn riêng.</p>}
        {activeScan&&<><div className="maintenance-metrics"><article><span>Dung lượng theo đường dẫn</span><strong>{formatBytes(activeScan.logicalBytes)}</strong><small>Cha đã gồm con; chỉ cộng file thường</small></article><article><span>Dung lượng file duy nhất</span><strong>{formatBytes(activeScan.uniqueBytes)}</strong><small>Không cộng đôi hardlink</small></article><article><span>Allocated bytes</span><strong>{activeScan.allocatedBytes===null?'Chưa đủ số liệu':formatBytes(activeScan.allocatedBytes)}</strong><small>Khác quota cPanel</small></article><article><span>Chỉ mục quản trị</span><strong>{formatBytes(summary.storage?.bytes)}</strong><small>Ngân sách {formatBytes(summary.storage?.limitBytes)}</small></article></div>
          <div className="maintenance-analysis-grid"><MaintenanceScrollRegion label="Tiến độ và phạm vi hosting" size="analysis">{scanProgress}<p>Filesystem: {activeScan.filesystemComplete?'Đọc đủ phạm vi quan sát':'Chưa đầy đủ'} · Phụ thuộc: {activeScan.dependencyComplete?'Đủ các nguồn đã đăng ký':'Còn thiếu nguồn/bằng chứng'}.</p>{activeScan.scope!==summary.scope&&<p className="maintenance-alert warning">Phạm vi hoặc cách kiểm tra đã đổi. Cần hủy lượt cũ và quét mới để đối chiếu.</p>}</MaintenanceScrollRegion><MaintenanceScrollRegion label="Nguồn phụ thuộc hosting chưa xác minh" size="analysis"><h4>Nguồn phụ thuộc và phần chưa xác minh ({activeScan.sources.filter(s=>s.status!=='available').length})</h4>{activeScan.sources.map(s=><article key={s.id}><strong>{s.label}: {sourceStatus[s.status]||s.status}</strong><p>{s.reason}</p><small>{date(s.at)}</small></article>)}</MaintenanceScrollRegion></div>
          <div className="hosting-growth">{summary.growth.map(g=><p key={g.days}>{g.days} ngày: <strong>{g.bytes===null?'Chưa đủ mốc':formatBytes(g.bytes)}</strong><small>{g.reason}</small></p>)}</div>
        </>}
      </>}
      {mode==='jobs'&&scanProgress}
      {!activeScan&&mode!=='overview'&&<p className="maintenance-muted">{mode==='files'?'Chưa có cây thư mục hosting. Bấm Quét toàn tài khoản để tạo báo cáo.':'Chưa có lượt kiểm kê tác vụ hosting. Quét tại File & Dọn dẹp → Thư mục hosting để đọc cấu hình/lịch và bằng chứng thực thi.'}</p>}
      {activeScan&&<>
        {mode==='files'&&<>
          <div className="maintenance-filters"><label>Tìm trong thư mục<input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Tên file hoặc thư mục"/></label><label>Trạng thái tham chiếu<select value={status} onChange={e=>setStatus(e.target.value)}><option value="attention">Cần xem xét / có thể dọn</option><option value="">Tất cả</option>{Object.entries(hostingStatus).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><label>Vai trò<select value={role} onChange={e=>setRole(e.target.value)}><option value="">Tất cả</option>{tree?.roles.map(r=><option key={r} value={r}>{r}</option>)}</select></label><label>Dung lượng tối thiểu<select value={minimum} onChange={e=>setMinimum(e.target.value)}><option value="0">Tất cả</option><option value="1048576">1 MiB</option><option value="104857600">100 MiB</option></select></label><label>Sắp xếp<select value={sort} onChange={e=>setSort(e.target.value)}><option value="size">Dung lượng giảm dần</option><option value="name">Tên</option></select></label></div>
          {!!tree&&tree.breadcrumbs.length>1&&<nav className="hosting-breadcrumbs" aria-label="Cây thư mục">{tree.breadcrumbs.map((c,i)=><React.Fragment key={c.id}>{i>0&&<span aria-hidden="true">/</span>}{i===tree.breadcrumbs.length-1?<span aria-current="location">{c.name}</span>:<button data-kind="secondary" onClick={()=>{setParent(c.relative?c.id:'');setPage(1);}}>{c.name}</button>}</React.Fragment>)}</nav>}
          {loading&&<p role="status">Đang đọc trang chỉ mục…</p>}
          {status==='attention'&&<p className="maintenance-muted">Đang ẩn file được bảo vệ / đang được tham chiếu. Thư mục vẫn hiện để đi vào bên trong; chọn “Tất cả” để xem đầy đủ.</p>}
          <p className="maintenance-muted">Mỗi mục có hai kết luận riêng: thuộc dự án/dịch vụ nào và có thể dọn đến bước nào. Cột thao tác chỉ mở hành động đã có bộ kiểm tra.</p><MaintenanceScrollRegion label="Thư mục và file hosting" className="maintenance-table"><table><thead><tr><th>Thư mục / file</th><th>Dung lượng</th><th>Dự án / dịch vụ liên quan</th><th>Khả năng dọn</th><th>Thao tác</th></tr></thead><tbody>{tree?.items.map(e=><tr key={e.id}><td>{e.type==='directory'?<button data-kind="secondary" disabled={Boolean(e.issue)} onClick={()=>{setParent(e.id);setPage(1);}}>{e.name}/</button>:<strong>{e.name}</strong>}<small>{e.relative} · {e.type}</small>{e.issue&&<small>Coverage: {e.issue}</small>}</td><td>{formatBytes(e.bytes)}<small>{e.type==='directory'?e.fileCount+' file / '+e.directoryCount+' thư mục':date(e.modifiedAt)}</small></td><td>{owner(e)}</td><td>{assessment(e)}</td><td>{actions(e)}</td></tr>)}{!loading&&!tree?.items.length&&<tr><td colSpan={5}>Không có mục trong trang/bộ lọc hiện tại; không suy ra file đã mất.</td></tr>}</tbody></table></MaintenanceScrollRegion>
          {tree&&pagination(page,tree.pages,tree.total,setPage)}
        </>}
        {mode==='jobs'&&<><h4>Tác vụ đã đăng ký / nguồn được quan sát</h4><MaintenanceScrollRegion label="Tác vụ hosting đã đăng ký" className="maintenance-table"><table><thead><tr><th>Tác vụ / executor</th><th>Cấu hình / lịch</th><th>Bằng chứng thực thi</th></tr></thead><tbody>{activeScan.tasks.map(t=><tr key={t.id}><td>{t.task}<small>{t.source} · {t.executor}</small></td><td>{{configured:'Đã cấu hình',manual:'Chạy thủ công',observed:'Quan sát được'}[t.configuration]||t.configuration}<small>{t.schedule} · {t.timezone}</small></td><td>{t.execution==='verified'?'Có tiến độ executor':t.execution==='observed'?'Trạng thái lưu trong nguồn':'Chưa có bằng chứng chạy'}<small>{t.reason}</small>{t.counts?.map(c=><small key={c.status}>{c.status}: {c.count}</small>)}</td></tr>)}</tbody></table></MaintenanceScrollRegion><h4>Lịch sử quét hosting</h4><MaintenanceScrollRegion label="Lịch sử quét hosting" className="maintenance-table"><table><thead><tr><th>Thời điểm</th><th>Trạng thái / coverage</th><th>Kết quả</th></tr></thead><tbody>{summary.scans.map(s=><tr key={s.id}><td>{date(s.startedAt)}<small>{s.id}</small></td><td>{scanStatus[s.status]}<small>Filesystem: {s.filesystemComplete?'đủ':'partial'} · phụ thuộc: {s.dependencyComplete?'đủ':'chưa đủ'}</small></td><td>{s.fileCount} file · {formatBytes(s.logicalBytes)}<small>{s.reason}</small></td></tr>)}</tbody></table></MaintenanceScrollRegion></>}
      </>}
    </>}
    {mode==='files'&&selected&&<section className="hosting-inspector" aria-label="Bằng chứng đối tượng"><div className="maintenance-actions"><h4 ref={inspector} tabIndex={-1}>Bằng chứng: {selected.name}</h4><button data-kind="secondary" onClick={()=>{setSelected(null);setEvidence(null);opener.current?.focus();}}>Đóng bằng chứng</button></div>
      {!evidence&&<p role="status">Đang đọc bằng chứng…</p>}{evidence&&<><p>{evidence.entry.relative} · {hostingStatus[evidence.entry.status]} · {evidence.entry.role}</p><MaintenanceScrollRegion label="Điều kiện dọn và quan hệ của đối tượng" size="analysis" className="hosting-decision"><h4>Khả năng dọn và quan hệ</h4>{owner(evidence.entry)}{assessment(evidence.entry)}<ol>{evidence.entry.cleanup.nextSteps.map(step=><li key={step}>{step}</li>)}</ol>{evidence.entry.cleanup.applicationId&&evidence.entry.cleanup.action!=='manage-backup'&&onManageApplication&&<button data-kind={evidence.entry.cleanup.category==='ready'?'primary':'secondary'} onClick={()=>onManageApplication(evidence.entry)}>Mở thao tác file ứng dụng</button>}</MaintenanceScrollRegion><p>Quan sát {date(evidence.at)}. {evidence.scopeChanged?'Phạm vi hoặc cách kiểm tra đã đổi; cần quét mới.':''}</p><button data-kind="secondary" disabled={pending||running||evidence.scopeChanged} onClick={()=>void act('/scans/'+activeScan!.id+'/entries/'+selected.id+'/reverify',{},'Đã đọc lại nguồn và fingerprint đối tượng; chưa cấp quyền xóa.')}>Xác minh lại nguồn</button>
        <MaintenanceScrollRegion label="Quan hệ phụ thuộc của file hoặc thư mục" size="analysis" className="hosting-edges">{evidence.edges.map(e=><article key={e.id}><strong>{e.from_node} → {e.to_node}</strong><p>{e.relation} · {e.source} · {sourceStatus[e.status]}</p><small>{e.reason} · {date(e.at)} · {e.version}</small></article>)}{!evidence.edges.length&&<p>Chưa có cạnh phụ thuộc được nhận diện cho mục này. Điều này chưa chứng minh file không còn tác dụng.</p>}</MaintenanceScrollRegion>{pagination(evidencePage,evidence.pages,evidence.total,setEvidencePage)}<h4>Nguồn còn thiếu</h4><MaintenanceScrollRegion label="Nguồn còn thiếu cho đối tượng" size="compact">{evidence.sources.filter(s=>s.status!=='available').map(s=><p key={s.id}>{s.label}: {sourceStatus[s.status]} · {s.reason}</p>)}</MaintenanceScrollRegion></>}
    </section>}
  </section>;
}