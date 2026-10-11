import type {MaintenanceFile,MaintenanceSummary} from '../../../shared/maintenance';
import type {StorageFolderTrend,StoragePoint} from '../../../shared/hostingInventory';
const purposes:Record<string,string>={speaking:'Bản thu luyện Speaking, lưu tối đa 24 giờ theo điều kiện dọn.',tts:'Audio giọng đọc được tạo từ văn bản.',listening:'Ảnh và audio của bài Listening.',vocab:'Ảnh minh họa từ vựng.',quarantine:'File tạm cách ly, vẫn chiếm dung lượng.',assets:'JavaScript, CSS và hình ảnh của giao diện.', 'assets-client':'JavaScript, CSS và tài nguyên của bản frontend Node.',data:'Database và dữ liệu còn lại, đã tách các nhóm media bên trên.',deployment:'Mã triển khai còn lại, đã tách nhóm asset.', 'temporary-pdf':'File trung gian khi nhập đề từ PDF.','temporary-reading':'File trung gian khi nhập đề Reading.'};
export const isCleanupFile=(entry:MaintenanceFile)=>!['protected','used','pinned'].includes(entry.status)&&(entry.kind==='speaking'||entry.kind==='media'&&['suspected','held'].includes(entry.status));
export function pointChange(samples:StoragePoint[]):number|null {
  const last=samples.at(-1),before=samples.slice(0,-1).reverse().find(point=>point.complete&&point.bytes!==null);
  return last?.complete&&last.bytes!==null&&before?.bytes!==null&&before?.bytes!==undefined?last.bytes-before.bytes:null;
}
export function applicationFolderTrends(data:MaintenanceSummary|null):StorageFolderTrend[] {
  if(!data)return [];
  const latest=data.latest;
  return data.roots.filter(root=>root.id!=='account').map(root=>{
    const group=latest?.groups.find(g=>g.id===root.id),issues=latest?.issues.filter(i=>i.root===root.id||i.root===root.root)||[];
    const bytes=latest?.complete&&!issues.length?(group?.bytes??0):null;
    const samples:StoragePoint[]=data.snapshots.filter(s=>s.groups).map(s=>({at:s.at,bytes:s.complete?(s.groups?.[root.id]??0):null,complete:s.complete}));
    if(latest){const index=samples.findIndex(s=>s.at.slice(0,10)===latest.at.slice(0,10));const point={at:latest.at,bytes,complete:bytes!==null};if(index>=0)samples[index]=point;else samples.push(point);}
    samples.sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
    const shown=samples.slice(-14);
    return {id:root.id,label:root.label,path:root.root,purpose:purposes[root.id]||(root.id.startsWith('backup')?'Bản sao dự phòng dùng để phục hồi dữ liệu.':root.label),bytes,change:pointChange(shown),samples:shown,note:issues.length?issues.some(i=>i.status==='missing')?'Chưa có thư mục trong lần quét.':'Có phần chưa đọc; chưa tính tăng giảm.':latest&&!latest.complete?'Báo cáo chưa đủ phạm vi.':!latest?'Chưa quét.':undefined};
  }).sort((a,b)=>(b.bytes??-1)-(a.bytes??-1)||a.label.localeCompare(b.label));
}
