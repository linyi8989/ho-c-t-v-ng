import React, { useState } from 'react';
import { RefreshCcw, Sparkles } from 'lucide-react';
import FileDropPasteInput from '../../listening/shared/FileDropPasteInput';
import { listeningApi } from '../../listening/api';
import type { ListeningAsset, ListeningAssetKind, ListeningSetContent } from '../../listening/types';
import { hashListeningPart } from '../smart-import/hash';
import type {
  ListeningSmartImportCandidate,
  ListeningSmartImportCapability,
} from '../smart-import/types';

export type ListeningImportTaskStatus = 'idle' | 'queued' | 'running' | 'needs_review' | 'accepted' | 'failed';
export type ListeningResourceAssignments = Record<1 | 2 | 3 | 4 | 5, {
  imageAssetIds: string[];
  pastedText: string;
}>;

export const createEmptyListeningResourceAssignments = (): ListeningResourceAssignments => ({
  1: { imageAssetIds: [], pastedText: '' },
  2: { imageAssetIds: [], pastedText: '' },
  3: { imageAssetIds: [], pastedText: '' },
  4: { imageAssetIds: [], pastedText: '' },
  5: { imageAssetIds: [], pastedText: '' },
});

interface ListeningResourceTrayProps {
  token: string;
  content: ListeningSetContent;
  assets: ListeningAsset[];
  capability?: ListeningSmartImportCapability;
  assignments: ListeningResourceAssignments;
  statuses: Partial<Record<1 | 2 | 3 | 4 | 5, ListeningImportTaskStatus>>;
  onAssignmentsChange: (assignments: ListeningResourceAssignments) => void;
  onStatusChange: (part: 1 | 2 | 3 | 4 | 5, status: ListeningImportTaskStatus) => void;
  onCandidate: (part: 1 | 2 | 3 | 4 | 5, candidate: ListeningSmartImportCandidate) => void;
  onUpload: (file: File, kind: ListeningAssetKind) => Promise<ListeningAsset>;
}

export default function ListeningResourceTray({
  token,
  content,
  assets,
  capability,
  assignments,
  statuses,
  onAssignmentsChange,
  onStatusChange,
  onCandidate,
  onUpload,
}: ListeningResourceTrayProps) {
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [operationError, setOperationError] = useState('');
  const images = assets.filter(asset => asset.kind === 'image' && asset.status === 'active');
  const audios = assets.filter(asset => asset.kind === 'audio' && asset.status === 'active');

  const updateAssignment = (
    part: 1 | 2 | 3 | 4 | 5,
    patch: Partial<ListeningResourceAssignments[1]>
  ) => onAssignmentsChange({
    ...assignments,
    [part]: { ...assignments[part], ...patch },
  });

  // The whole-exam tray predates role-based sources and is hidden. It must not
  // infer question/answer roles from array order if the rollback UI is restored.
  const canRun = (_part: 1 | 2 | 3 | 4 | 5) => false;

  const runPart = async (part: 1 | 2 | 3 | 4 | 5) => {
    if (!canRun(part)) {
      onStatusChange(part, 'failed');
      return;
    }
    setOperationError('');
    onStatusChange(part, 'running');
    try {
      const currentPart = content.parts[part - 1];
      const candidate = await listeningApi.analyzeSmartImport(token, {
        moduleId: 'mover',
        part,
        sources: [],
        pastedText: assignments[part].pastedText.trim() || undefined,
        currentPart,
        basePartHash: await hashListeningPart(currentPart),
      });
      onCandidate(part, candidate);
      onStatusChange(part, 'needs_review');
    } catch (reason) {
      onStatusChange(part, 'failed');
      setOperationError(reason instanceof Error ? reason.message : `Không thể phân tích Part ${part}.`);
    }
  };

  const analyzeAll = async () => {
    const queue = ([1, 2, 3, 4, 5] as const).filter(canRun);
    queue.forEach(part => onStatusChange(part, 'queued'));
    setOperationError('');
    setAnalyzing(true);
    let cursor = 0;
    const worker = async () => {
      while (cursor < queue.length) {
        const part = queue[cursor];
        cursor += 1;
        await runPart(part);
      }
    };
    try {
      await Promise.all([worker(), worker()]);
    } finally {
      setAnalyzing(false);
    }
  };

  const batchUpload = async (incoming: File[]) => {
    const files = incoming.slice(0, 20);
    if (!files.length) return;
    setOperationError('');
    setUploading(true);
    let cursor = 0;
    const worker = async () => {
      while (cursor < files.length) {
        const file = files[cursor];
        cursor += 1;
        const kind: ListeningAssetKind = file.type.startsWith('audio/') ? 'audio' : 'image';
        await onUpload(file, kind);
      }
    };
    try {
      await Promise.all([worker(), worker()]);
    } catch (reason) {
      setOperationError(reason instanceof Error ? reason.message : 'Không thể hoàn tất upload theo lô.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-sky-200 bg-sky-50/40 p-4" data-listening-resource-tray>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[.14em] text-sky-700">Resource Tray & phân tích toàn đề</p>
          <p className="mt-1 text-xs font-semibold text-slate-600">{images.length} ảnh · {audios.length} audio. Audio chỉ để gắn/phát trong Part, không gửi cho AI.</p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <div className="min-w-72">
            <FileDropPasteInput
              accept="image/jpeg,image/png,image/webp,image/gif,audio/mpeg,audio/wav,audio/ogg,audio/mp4"
              disabled={uploading}
              multiple
              maxFiles={20}
              pasteImages
              uploadLabel="Upload theo lô"
              onFiles={batchUpload}
            />
          </div>
          <button type="button" disabled={analyzing || !([1, 2, 3, 4, 5] as const).some(canRun)} onClick={() => void analyzeAll()} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-3 py-2 text-xs font-black text-white disabled:opacity-40"><Sparkles size={14} /> {analyzing ? 'Đang phân tích…' : 'Phân tích các Part đã gán'}</button>
        </div>
      </div>
      {operationError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">{operationError}</p>}
      <div className="space-y-3">
        {([1, 2, 3, 4, 5] as const).map(part => {
          const assignment = assignments[part];
          const status = statuses[part] || 'idle';
          return (
            <div key={part} className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 lg:grid-cols-[90px_1fr_1fr_130px]">
              <div>
                <p className="text-sm font-black text-slate-900">Part {part}</p>
                <span className={`text-[10px] font-black uppercase ${status === 'failed' ? 'text-rose-600' : status === 'needs_review' || status === 'accepted' ? 'text-emerald-600' : 'text-slate-400'}`}>{status.replace('_', ' ')}</span>
              </div>
              <label className="space-y-1">
                <span className="text-[10px] font-black text-slate-500">Ảnh nguồn {part === 3 ? '(1: bảng A–F, 2: OCR nhãn)' : ''}</span>
                <select multiple value={assignment.imageAssetIds} onChange={event => {
                  const selected = (Array.from(event.target.selectedOptions) as HTMLOptionElement[]).map(option => option.value);
                  updateAssignment(part, {
                    imageAssetIds: [
                      ...assignment.imageAssetIds.filter(id => selected.includes(id)),
                      ...selected.filter(id => !assignment.imageAssetIds.includes(id)),
                    ].slice(0, 5),
                  });
                }} className="min-h-16 w-full rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-semibold">
                  {images.map(asset => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-[10px] font-black text-slate-500">Text hỗ trợ (Part 2/3 có thể chạy không cần AI ảnh)</span>
                <textarea value={assignment.pastedText} onChange={event => updateAssignment(part, { pastedText: event.target.value })} rows={2} maxLength={12000} className="w-full rounded-lg border border-slate-200 px-2 py-1 text-[10px] font-semibold" />
              </label>
              <button type="button" disabled={!canRun(part) || status === 'running'} onClick={() => void runPart(part)} className="my-auto inline-flex items-center justify-center gap-1 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-[10px] font-black text-violet-700 disabled:opacity-40"><RefreshCcw size={12} /> {status === 'failed' ? 'Thử lại' : 'Phân tích'}</button>
            </div>
          );
        })}
      </div>
      {!capability?.visionEnabled && <p className="text-xs font-bold text-amber-700">Chưa có AI thị giác: chỉ Part 2/3 có pasted text mới chạy được. {capability?.reason}</p>}
    </section>
  );
}
