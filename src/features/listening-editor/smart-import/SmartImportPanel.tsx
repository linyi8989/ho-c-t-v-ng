import React, { useRef, useState } from 'react';
import { Sparkles, Trash2 } from 'lucide-react';
import FileDropPasteInput from '../../listening/shared/FileDropPasteInput';
import { listeningApi } from '../../listening/api';
import type { ListeningAsset, ListeningPart } from '../../listening/types';
import { hashListeningPart } from './hash';
import type {
  ListeningSmartImportCandidate,
  ListeningSmartImportCapability,
} from './types';

interface SmartImportPanelProps {
  token: string;
  part: ListeningPart;
  assets: ListeningAsset[];
  capability?: ListeningSmartImportCapability;
  candidate?: ListeningSmartImportCandidate;
  onCandidateChange: (candidate?: ListeningSmartImportCandidate) => void;
  onAnalyzed?: (candidate: ListeningSmartImportCandidate) => Promise<void> | void;
  analyzeLabel?: string;
  analyzedNotice?: string;
  onUpload: (file: File, kind: 'image') => Promise<ListeningAsset>;
  children?: React.ReactNode;
}

export default function SmartImportPanel({
  token,
  part,
  assets,
  capability,
  candidate,
  onCandidateChange,
  onAnalyzed,
  analyzeLabel = 'Phân tích và tạo bản đề xuất',
  analyzedNotice,
  onUpload,
  children,
}: SmartImportPanelProps) {
  const [sourceIds, setSourceIds] = useState<string[]>(candidate?.sourceImageAssetIds || []);
  const [pastedText, setPastedText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const latestPartRef = useRef(part);
  const latestOnAnalyzedRef = useRef(onAnalyzed);
  const latestOnCandidateChangeRef = useRef(onCandidateChange);
  latestPartRef.current = part;
  latestOnAnalyzedRef.current = onAnalyzed;
  latestOnCandidateChangeRef.current = onCandidateChange;
  const imageAssets = assets.filter(asset => asset.kind === 'image' && asset.status === 'active');
  const canUseLocalText = (part.part === 2 || part.part === 3) && Boolean(pastedText.trim());
  const canPreparePart3BoardOnly = part.part === 3 && sourceIds.length === 1;
  const canAnalyze = capability?.enabled !== false
    && (canUseLocalText || canPreparePart3BoardOnly || (sourceIds.length > 0 && capability?.visionEnabled));

  const analyze = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const basePartHash = await hashListeningPart(part);
      const next = await listeningApi.analyzeSmartImport(token, {
        moduleId: 'mover',
        part: part.part,
        sourceImageAssetIds: sourceIds,
        pastedText: pastedText.trim() || undefined,
        currentPart: part,
        basePartHash,
      });
      if (await hashListeningPart(latestPartRef.current) !== next.basePartHash) {
        throw new Error(`Part ${part.part} đã thay đổi trong lúc AI phân tích. Hãy chạy lại để tránh ghi đè dữ liệu mới.`);
      }
      if (latestOnAnalyzedRef.current) {
        await latestOnAnalyzedRef.current(next);
        setNotice(analyzedNotice || `Đã nhập dữ liệu AI vào phần soạn Part ${part.part}. Hãy kiểm tra và chỉnh sửa trực tiếp bên dưới.`);
      } else {
        latestOnCandidateChangeRef.current(next);
      }
    } catch (reason: any) {
      const details = Array.isArray(reason?.details) ? reason.details.join(' · ') : '';
      setError([reason?.message || 'Không thể phân tích dữ liệu nguồn.', details].filter(Boolean).join(' — '));
    } finally {
      setBusy(false);
    }
  };

  const uploadFiles = async (incoming: File[]) => {
    const files = incoming.slice(0, 5);
    if (!files.length) return;
    setBusy(true);
    setError('');
    try {
      const uploaded: string[] = [];
      for (const file of files) uploaded.push((await onUpload(file, 'image')).id);
      setSourceIds(previous => Array.from(new Set([...previous, ...uploaded])).slice(0, 5));
    } catch (reason: any) {
      setError(reason?.message || 'Không thể tải ảnh nguồn.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-violet-200 bg-violet-50/40 p-4" data-listening-smart-import>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[.14em] text-violet-700">Smart Import · Part {part.part}</p>
          <p className="mt-1 text-xs font-semibold text-slate-600">AI/OCR chỉ đọc ảnh hoặc văn bản. Audio và transcript không được gửi để tìm đáp án.</p>
        </div>
        {candidate && (
          <button type="button" onClick={() => onCandidateChange(undefined)} className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-black text-rose-700">
            <Trash2 size={13} /> Bỏ bản đề xuất
          </button>
        )}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <label className="space-y-1">
          <span className="text-xs font-black text-slate-700">Ảnh nguồn (giữ Ctrl/Cmd để chọn nhiều, tối đa 5)</span>
          <select
            multiple
            value={sourceIds}
            onChange={event => {
              const selected = (Array.from(event.target.selectedOptions) as HTMLOptionElement[]).map(option => option.value);
              setSourceIds(previous => [
                ...previous.filter(id => selected.includes(id)),
                ...selected.filter(id => !previous.includes(id)),
              ].slice(0, 5));
            }}
            className="min-h-28 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
          >
            {imageAssets.map(asset => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
          </select>
        </label>
        <label className="space-y-1">
          <span className="text-xs font-black text-slate-700">Văn bản hỗ trợ OCR (không bắt buộc)</span>
          <textarea value={pastedText} onChange={event => setPastedText(event.target.value)} rows={5} maxLength={12000} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700" />
        </label>
      </div>
      {part.part === 3 && (
        <p className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-[10px] font-bold text-sky-800">
          Part 3: ảnh thứ nhất là bảng tổng hợp A–F và không gửi AI. Muốn AI đọc 5 nhãn, hãy chọn thêm ảnh thứ hai chứa danh sách nhãn hoặc dán văn bản OCR. Nếu chỉ chọn ảnh thứ nhất, hệ thống vẫn tạo bản để giáo viên nhập nhãn thủ công.
        </p>
      )}
      {sourceIds.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {sourceIds.map((id, index) => (
            <span key={id} className="rounded-lg border border-violet-200 bg-white px-2.5 py-1 text-[10px] font-black text-violet-700">
              {index + 1}. {imageAssets.find(asset => asset.id === id)?.name || id}
              {part.part === 3 && (index === 0 ? ' · bảng A–F (không gửi AI)' : index === 1 ? ' · nguồn OCR nhãn' : '')}
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-72 flex-1">
          <FileDropPasteInput
            accept="image/jpeg,image/png,image/webp,image/gif"
            disabled={busy}
            multiple
            maxFiles={5}
            pasteImages
            uploadLabel="Tải ảnh nguồn"
            onFiles={uploadFiles}
          />
        </div>
        <button type="button" disabled={busy || !canAnalyze} onClick={() => void analyze()} title={!canAnalyze ? capability?.reason : undefined} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40">
          <Sparkles size={14} /> {busy ? 'Đang phân tích…' : analyzeLabel}
        </button>
        {!capability?.visionEnabled && sourceIds.length > 0 && !canUseLocalText && (
          <span className="text-xs font-bold text-amber-700">Backend chưa có AI thị giác.</span>
        )}
      </div>
      {error && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-700">{notice}</p>}
      {candidate && (
        <div className="space-y-3 rounded-2xl border border-violet-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-black text-slate-900">Bản đề xuất đang chờ giáo viên duyệt</p>
            <span className="rounded-full bg-violet-100 px-3 py-1 text-[10px] font-black uppercase text-violet-700">{candidate.provider}</span>
          </div>
          {candidate.warnings.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-xs font-semibold text-amber-700">
              {candidate.warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}
            </ul>
          )}
          {children}
        </div>
      )}
    </section>
  );
}
