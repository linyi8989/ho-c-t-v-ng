import React, { useEffect, useState } from 'react';
import { formatBytes } from '../../../shared/maintenance';
import './maintenance.css';
interface Overview { at: string | null; bytes: number | null; complete: boolean; alerts: number; backupFiles: number; hosting?: {status:string;at:string|null;bytes:number|null;filesystemComplete:boolean;dependencyComplete:boolean;alerts:number} }
export default function MaintenanceOverviewCard({ token, onOpen }: { token: string; onOpen: () => void }) {
  const [data,setData]=useState<Overview|null>(null), [error,setError]=useState('');
  useEffect(()=>{
    const controller=new AbortController();
    void fetch('/api/admin/maintenance/overview',{signal:controller.signal,headers:{Authorization:'Bearer '+token}})
      .then(async response=>{ if(!response.ok) throw new Error('Không tải được thống kê dung lượng.'); return response.json(); })
      .then(value=>{if(!controller.signal.aborted)setData(value);})
      .catch(e=>{if(!controller.signal.aborted)setError(e.message);});
    return ()=>controller.abort();
  },[token]);
  return <section id="maintenance-overview"><h3>Dung lượng & Dọn dẹp</h3>
    {error?<p role="alert">{error}</p>:<p>{data?.at?formatBytes(data.bytes)+' đã quét · '+data.backupFiles+' backup · '+data.alerts+' cảnh báo · '+(data.complete?'Hoàn tất phạm vi':'Quét chưa đầy đủ'):'Chưa có báo cáo dung lượng; mở tab để kiểm kê.'}</p>}
    {data?.hosting&&<p>Toàn tài khoản: {data.hosting.bytes===null?(data.hosting.status==='unavailable'?'Không đọc được chỉ mục hosting':'Chưa có lượt kiểm kê'):(formatBytes(data.hosting.bytes)+' · '+(data.hosting.filesystemComplete?'filesystem đủ':'filesystem chưa đủ')+' · '+(data.hosting.dependencyComplete?'đủ nguồn phụ thuộc':'còn thiếu bằng chứng phụ thuộc')+' · '+data.hosting.alerts+' cảnh báo')}</p>}
    <button data-kind="primary" onClick={onOpen}>Mở quản lý dung lượng</button>
  </section>;
}
