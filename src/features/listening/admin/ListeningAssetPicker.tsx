import React, { useState } from 'react';
import { Image, Music, Sparkles } from 'lucide-react';
import FileDropPasteInput from '../shared/FileDropPasteInput';
import type { ListeningAsset, ListeningAssetKind } from '../types';

interface ListeningAssetPickerProps {
  label: string;
  kind: ListeningAssetKind;
  value?: string;
  assets: ListeningAsset[];
  aiCapability?: { enabled: boolean; reason?: string };
  onChange: (assetId: string) => void;
  onUpload: (file: File, kind: ListeningAssetKind) => Promise<ListeningAsset>;
  allowedMimeTypes?: string[];
  compact?: boolean;
}

export function ListeningAssetPicker({
  label,
  kind,
  value,
  assets,
  aiCapability,
  onChange,
  onUpload,
  allowedMimeTypes,
  compact = false,
}: ListeningAssetPickerProps) {
  const [uploading, setUploading] = useState(false);
  const selected = assets.find(asset => asset.id === value);
  const choices = assets.filter(asset => asset.kind === kind
    && asset.status === 'active'
    && (!allowedMimeTypes?.length || allowedMimeTypes.includes(asset.mimeType)));

  const handleUpload = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    if (allowedMimeTypes?.length && !allowedMimeTypes.includes(file.type)) {
      window.alert(`File phải có định dạng: ${allowedMimeTypes.join(', ')}.`);
      return;
    }
    setUploading(true);
    try {
      const asset = await onUpload(file, kind);
      onChange(asset.id);
    } finally {
      setUploading(false);
    }
  };

  if (compact) {
    return (
      <div className="flex min-w-56 flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-white p-2" data-listening-asset-picker-compact>
        <label className="min-w-32 flex-1 space-y-1">
          <span className="block text-[10px] font-black text-slate-600">{label}</span>
          <select
            value={value || ''}
            onChange={event => onChange(event.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[10px] font-semibold text-slate-700"
          >
            <option value="">Chọn từ thư viện...</option>
            {choices.map(asset => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
          </select>
        </label>
        {selected && kind === 'image' && <img src={selected.url} alt="" className="h-9 w-9 rounded-lg border border-slate-200 object-contain" />}
        <FileDropPasteInput
          compact
          accept={allowedMimeTypes?.join(',') || (kind === 'image' ? 'image/jpeg,image/png,image/webp,image/gif' : 'audio/mpeg,audio/wav,audio/ogg,audio/mp4')}
          disabled={uploading}
          pasteImages={false}
          uploadLabel={kind === 'image' ? 'Tải ảnh' : 'Tải audio'}
          onFiles={handleUpload}
        />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <label className="text-xs font-black text-slate-700">{label}</label>
        <span className="text-[10px] font-bold uppercase text-slate-400">{kind === 'image' ? 'Hình ảnh' : 'Audio'}</span>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          value={value || ''}
          onChange={event => onChange(event.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700"
        >
          <option value="">Chọn từ thư viện...</option>
          {choices.map(asset => (
            <option key={asset.id} value={asset.id}>{asset.name}</option>
          ))}
        </select>
        {kind === 'image' && (
          <button
            type="button"
            disabled={!aiCapability?.enabled}
            title={aiCapability?.enabled ? 'Tạo ảnh bằng AI' : aiCapability?.reason}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-black text-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Sparkles size={14} /> AI
          </button>
        )}
      </div>
      <FileDropPasteInput
        accept={allowedMimeTypes?.join(',') || (kind === 'image' ? 'image/jpeg,image/png,image/webp,image/gif' : 'audio/mpeg,audio/wav,audio/ogg,audio/mp4')}
        disabled={uploading}
        pasteImages={kind === 'image'}
        uploadLabel={kind === 'image' ? 'Chọn ảnh' : 'Chọn audio'}
        onFiles={handleUpload}
      />
      {selected && (
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-2">
          {kind === 'image' ? (
            <img src={selected.url} alt="" className="h-12 w-16 rounded-lg object-cover border border-slate-200" />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
              <Music size={18} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-slate-800">{selected.name}</p>
            <p className="text-[10px] text-slate-400">{Math.round(selected.size / 1024)} KB</p>
          </div>
          {kind === 'image' ? <Image size={16} className="text-slate-400" /> : <audio src={selected.url} controls className="h-8 max-w-52" />}
        </div>
      )}
    </div>
  );
}
