import React, { useState } from 'react';
import type { Media } from '../../shared/competition/types';
import type { ListeningAsset } from '../listening/types';
import FileDropPasteInput from '../listening/shared/FileDropPasteInput';
import AudioPreviewButton from '../listening/admin/AudioPreviewButton';
import { listeningApi } from '../listening/api';
import { MediaView } from './QuestionView';

export default function MediaEditor({ token, value, onChange, onAsset, onBusyChange }: {
  token: string; value: Media[]; onChange: (items: Media[]) => void; assets: ListeningAsset[]; onAsset: (asset: ListeningAsset) => void; onBusyChange?: (pending: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const upload = async (files: File[], kind: Media['kind']) => {
    if (!files[0]) return;
    setBusy(true); onBusyChange?.(true);
    try {
      const asset = await listeningApi.uploadAsset(token, files[0], kind);
      onAsset(asset);
      onChange([...value.filter(item => item.kind !== kind), { kind, assetId: asset.id, url: asset.url }]);
    } finally { setBusy(false); onBusyChange?.(false); }
  };
  return <div className="competition-media-editor">
    <div className="competition-toolbar" aria-label="Ảnh và audio của câu hỏi">
      <FileDropPasteInput compact pasteImages uploadLabel="Tải ảnh" disabled={busy}
        accept="image/jpeg,image/png,image/webp,image/gif" onFiles={files => upload(files, 'image')} />
      <FileDropPasteInput compact uploadLabel="Tải audio" disabled={busy}
        accept="audio/mpeg,audio/wav,audio/ogg,audio/mp4" onFiles={files => upload(files, 'audio')} />
      <AudioPreviewButton compact src={value.find(item => item.kind === 'audio')?.url} />
    </div>
    <MediaView items={value} />
    {value.map((item, i) => <button type="button" key={i} disabled={busy}
      onClick={() => onChange(value.filter((_, j) => j !== i))}>Gỡ {item.kind === 'image' ? 'ảnh' : 'audio'}</button>)}
    {busy && <p role="status">Đang tải media...</p>}
  </div>;
}
