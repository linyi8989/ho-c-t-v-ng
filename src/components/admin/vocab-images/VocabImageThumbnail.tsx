import React, { useRef } from "react";
import { ClipboardPaste, ImagePlus, RefreshCw, Trash2, Upload } from "lucide-react";
import type { VocabItem } from "../../../types";

interface VocabImageThumbnailProps {
  item: VocabItem;
  busy?: boolean;
  onGenerate: () => void;
  onPaste: () => void;
  onUpload: (file: File) => void;
  onRemove: () => void;
}

export function VocabImageThumbnail({ item, busy = false, onGenerate, onPaste, onUpload, onRemove }: VocabImageThumbnailProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex h-[72px] w-[96px] items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {item.imageUrl ? <img src={item.imageUrl} alt={`Ảnh cho ${item.term}`} className="h-full w-full object-contain" /> : <ImagePlus size={23} className="text-slate-400" />}
      </div>
      <div className="flex flex-wrap justify-center gap-1">
        <button type="button" onClick={onGenerate} disabled={busy || !item.term.trim()} className="inline-flex items-center gap-1 rounded-lg border border-indigo-100 bg-indigo-50 px-2 py-1 text-[10px] font-black text-indigo-700 hover:bg-indigo-100 disabled:opacity-40" title={item.imageUrl ? "Tạo ảnh AI khác" : "Tạo ảnh AI cho từ này"}>{item.imageUrl ? <RefreshCw size={11} /> : <ImagePlus size={11} />}<span>{item.imageUrl ? "Tạo lại" : "Tạo"}</span></button>
        <button type="button" onClick={onPaste} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-sky-100 bg-sky-50 px-2 py-1 text-[10px] font-black text-sky-700 hover:bg-sky-100 disabled:opacity-40" title="Dán ảnh từ clipboard"><ClipboardPaste size={11} /><span>Dán</span></button>
        <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-emerald-100 bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700 hover:bg-emerald-100 disabled:opacity-40" title="Tải ảnh từ máy"><Upload size={11} /><span>Tải</span></button>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={event => { const file = event.target.files?.[0]; if (file) onUpload(file); event.currentTarget.value = ""; }} />
        {item.imageUrl && <button type="button" onClick={onRemove} disabled={busy} className="rounded-lg border border-rose-100 bg-rose-50 p-1.5 text-rose-600 hover:bg-rose-100 disabled:opacity-40" title="Bỏ ảnh khỏi từ này (không xóa asset dùng chung)"><Trash2 size={11} /></button>}
      </div>
      {item.imageAttribution?.sourcePageUrl ? <a href={item.imageAttribution.sourcePageUrl} target="_blank" rel="noreferrer" className="max-w-[120px] truncate text-[9px] font-semibold text-slate-400 underline" title={`${item.imageAttribution.author} · ${item.imageAttribution.license}`}>Thông tin dịch vụ</a> : item.imageAttribution?.provider === "upload" ? <span className="text-[9px] font-semibold text-slate-400">Ảnh giáo viên tải lên</span> : null}
    </div>
  );
}
