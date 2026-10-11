import {formatBytes,type MaintenanceSummary} from '../../../shared/maintenance';
import type {HostingSummary,HostingTrends,StorageFolderTrend} from '../../../shared/hostingInventory';
import {applicationFolderTrends,isCleanupFile} from './storageTrends';
import MaintenanceScrollRegion from './MaintenanceScrollRegion';
const date=(value?:string|null)=>value?new Date(value).toLocaleString('vi-VN'):'Chưa quét';
function FolderChart({folder}:{folder:StorageFolderTrend}) {
  const maximum=Math.max(1,...folder.samples.map(p=>p.bytes??0));
  return <div className="maintenance-folder-chart"><strong>{formatBytes(folder.bytes)}</strong>
    <ol className="maintenance-mini-bars" aria-label={'Lịch sử dung lượng '+folder.label}>{folder.samples.map(point=><li key={point.at} title={date(point.at)+' · '+formatBytes(point.bytes)} tabIndex={0} aria-label={date(point.at)+': '+formatBytes(point.bytes)}><span data-complete={point.complete} style={{height:point.bytes===null?'100%':Math.max(2,point.bytes/maximum*100)+'%'}} /></li>)}</ol>
    <small data-change={folder.change===null?'unknown':folder.change>0?'up':folder.change<0?'down':'same'}>{folder.change===null?'Chưa đủ mốc':folder.change>0?'Tăng '+formatBytes(folder.change):folder.change<0?'Giảm '+formatBytes(-folder.change):'Không đổi'}{folder.change!==null&&' so với mốc đủ trước'}</small>
  </div>;
}
function FolderRows({folders,label}:{folders:StorageFolderTrend[];label:string}) {
  return <MaintenanceScrollRegion label={label} className="maintenance-folder-list">{folders.map(folder=><article className="maintenance-folder-row" key={folder.id} data-folder-id={folder.id}><div className="maintenance-folder-description"><strong>{folder.label}</strong><small className="maintenance-folder-path">{folder.path}</small><p>{folder.purpose}</p>{folder.note&&<small>{folder.note}</small>}</div><FolderChart folder={folder}/></article>)}{!folders.length&&<p className="maintenance-muted">Chưa có số liệu thư mục. Quét tất cả tại File & Dọn dẹp để cập nhật.</p>}</MaintenanceScrollRegion>;
}
export default function MaintenanceDashboard({data,hosting,trends,hostingError}:{data:MaintenanceSummary|null;hosting:HostingSummary|null;trends:HostingTrends|null;hostingError:string}) {
  const latest=data?.latest,quota=latest?.quota,files=latest?.entries.filter(isCleanupFile)||[];
  return <section className="maintenance-dashboard" aria-label="Tổng quan dung lượng và dọn dẹp">
    <div className="maintenance-metrics">
      <article><span>File ứng dụng đã quét</span><strong>{latest?formatBytes(latest.totalBytes):'Chưa quét'}</strong><small>{date(latest?.at)} · {latest?.complete?'Đủ phạm vi':'Chưa đủ phạm vi'}</small></article>
      <article><span>Toàn tài khoản hosting</span><strong>{hosting?.latest?formatBytes(hosting.latest.logicalBytes):'Chưa quét'}</strong><small>{date(hosting?.latest?.finishedAt||hosting?.latest?.heartbeat)} · {trends?.complete?'Đủ phạm vi':'Chưa đủ phạm vi'}</small></article>
      <article><span>Quota hosting</span><strong>{quota?.status==='available'?formatBytes(quota.usedBytes)+' / '+formatBytes(quota.limitBytes):'Chưa xác minh'}</strong><small>{quota?.status==='available'?date(quota.measuredAt):'Cần kết nối cPanel để đọc quota'}</small></article>
      <article><span>Bản thu & file nghi ngờ mồ côi</span><strong>{files.length.toLocaleString('vi-VN')} file</strong><small>{formatBytes(files.reduce((n,f)=>n+f.bytes,0))} · {files.filter(f=>f.status==='eligible').length} file đủ điều kiện dọn</small></article>
    </div>
    <div className="maintenance-growth-grid">
      <section className="maintenance-card"><div className="maintenance-section-heading"><h3>Thư mục ứng dụng</h3><small>Tối đa 14 mốc theo ngày</small></div><FolderRows folders={applicationFolderTrends(data)} label="Tăng trưởng thư mục ứng dụng"/><p className="maintenance-muted">Nhóm dung lượng đã tách để không cộng trùng media/asset với thư mục cha. Cột bên phải thể hiện từng mốc đã quét.</p></section>
      <section className="maintenance-card"><div className="maintenance-section-heading"><h3>Thư mục hosting</h3><small>Hai lượt quét gần nhất</small></div><p className="maintenance-folder-path">{trends?.root||hosting?.root||'Chưa cấu hình phạm vi hosting'}</p>{hostingError&&<p role="alert" className="maintenance-error">{hostingError}</p>}<FolderRows folders={trends?.folders||[]} label="Tăng trưởng thư mục hosting"/><p className="maintenance-muted">Chỉ theo dõi thư mục cấp đầu trong tài khoản, đã gồm thư mục con. Tổng hosting và ứng dụng có phần trùng nhau; không cộng hai số này. Symlink không được đi theo.{trends?.truncated&&' Đang hiển thị tối đa 1.000 thư mục.'}</p></section>
    </div>
  </section>;
}
