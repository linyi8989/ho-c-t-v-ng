import React, { useEffect, useRef, useState } from 'react';
import type { MaintenanceFile } from '../../../shared/maintenance';
import { formatBytes } from '../../../shared/maintenance';

interface Props { entry: MaintenanceFile; token: string; onClose: () => void }
export default function MediaPreview({ entry, token, onClose }: Props) {
  const dialog=useRef<HTMLDialogElement>(null), audio=useRef<HTMLAudioElement>(null);
  const [url,setUrl]=useState(''), [error,setError]=useState(''), [loading,setLoading]=useState(true);
  useEffect(()=>{
    const element=dialog.current,opener=document.activeElement;
    element?.showModal();
    return ()=>{element?.close();if(opener instanceof HTMLElement&&opener.isConnected)opener.focus();};
  },[]);
  useEffect(()=>{
    const controller=new AbortController();
    let objectUrl='';
    setLoading(true);setError('');setUrl('');
    // Defer the request so StrictMode cleanup can cancel the first effect before it takes a server lease.
    const start=setTimeout(()=>{void fetch('/api/admin/maintenance/files/'+entry.id+'/preview',{
      method:'POST',signal:controller.signal,
      headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:'{}',
    }).then(async response=>{
      if(!response.ok){
        const result=await response.json().catch(()=>({}));
        throw new Error(result.error || 'Không tải được bản xem trước.');
      }
      const mime=response.headers.get('Content-Type') || '';
      if(!mime.startsWith(entry.previewType==='image'?'image/':'audio/')) throw new Error('Định dạng xem trước không phù hợp.');
      const blob=await response.blob();
      if(controller.signal.aborted)return;
      objectUrl=URL.createObjectURL(blob);setUrl(objectUrl);
    }).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Không tải được bản xem trước.');})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});},0);
    return ()=>{
      clearTimeout(start);controller.abort();
      if(objectUrl)URL.revokeObjectURL(objectUrl);
    };
  },[entry.id,entry.previewType,token]);
  useEffect(()=>{
    const player=audio.current;
    return ()=>{if(player){player.pause();player.removeAttribute('src');player.load();}};
  },[url]);
  return <dialog id="maintenance-media-preview" ref={dialog} aria-labelledby="maintenance-preview-title"
    onCancel={event=>{event.preventDefault();onClose();}}>
    <header className="maintenance-preview-header">
      <h3 id="maintenance-preview-title">{entry.previewType==='image'?'Xem ảnh':'Nghe trước audio'}</h3>
      <button data-kind="secondary" onClick={onClose}>Đóng xem trước</button>
    </header>
    <p className="maintenance-preview-name">{entry.name}</p>
    <p className="maintenance-muted">{entry.rootId}/{entry.relative} · {formatBytes(entry.bytes)}</p>
    <p>{entry.reason}</p>
    {loading && <p role="status">Đang tải bản xem trước…</p>}
    {error && <p role="alert" className="maintenance-error">{error}</p>}
    {url && !error && (entry.previewType==='image'
      ? <img className="maintenance-preview-image" src={url} alt={'Xem trước '+entry.name}
          onError={()=>setError('Trình duyệt không đọc được ảnh này. File được giữ nguyên.')} />
      : <audio ref={audio} controls preload="metadata" src={url} aria-label={'Nghe trước '+entry.name}
          onError={()=>setError('Trình duyệt không phát được định dạng audio này. File được giữ nguyên.')} />)}
    <p className="maintenance-muted">Xem/nghe không đổi trạng thái hoặc vị trí file. Audio chỉ phát khi bấm Play; đóng cửa sổ sẽ dừng phát.</p>
  </dialog>;
}
