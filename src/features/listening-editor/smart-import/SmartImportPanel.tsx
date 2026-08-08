import React, { useMemo, useRef, useState } from 'react';
import { Sparkles, Trash2, X } from 'lucide-react';
import FileDropPasteInput from '../../listening/shared/FileDropPasteInput';
import { listeningApi } from '../../listening/api';
import type { ListeningAsset, ListeningPart } from '../../listening/types';
import { hashListeningPart } from './hash';
import {
  getListeningSmartImportRoleDefinitions,
  type ListeningSmartImportCandidate,
  type ListeningSmartImportCapability,
  type ListeningSmartImportSourceRole,
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
  const initialSources = Object.fromEntries((candidate?.sources || []).map(source => [source.role, source.assetId]));
  const [sourceByRole, setSourceByRole] = useState<Partial<Record<ListeningSmartImportSourceRole, string>>>(initialSources);
  const [pastedText, setPastedText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [lastWarnings, setLastWarnings] = useState<string[]>(candidate?.warnings || []);
  const latestPartRef = useRef(part);
  const latestOnAnalyzedRef = useRef(onAnalyzed);
  const latestOnCandidateChangeRef = useRef(onCandidateChange);
  latestPartRef.current = part;
  latestOnAnalyzedRef.current = onAnalyzed;
  latestOnCandidateChangeRef.current = onCandidateChange;

  const roleDefinitions = useMemo(() => getListeningSmartImportRoleDefinitions(part.part), [part.part]);
  const imageAssets = assets.filter(asset => asset.kind === 'image' && asset.status === 'active');
  const sources = roleDefinitions.flatMap(definition => {
    const assetId = sourceByRole[definition.role];
    return assetId ? [{ role: definition.role, assetId }] : [];
  });
  const missingRequired = roleDefinitions.filter(definition => definition.required && !sourceByRole[definition.role]);
  const localAnswerFallback = (part.part === 2 || part.part === 3)
    && Boolean(sourceByRole.question)
    && Boolean(pastedText.trim());
  const canAnalyze = capability?.enabled !== false
    && (localAnswerFallback || (missingRequired.length === 0 && Boolean(capability?.visionEnabled)));

  const invalidateCandidate = () => {
    if (candidate) onCandidateChange(undefined);
    setNotice('');
    setLastWarnings([]);
  };
  const setSource = (role: ListeningSmartImportSourceRole, assetId?: string) => {
    setSourceByRole(previous => ({ ...previous, [role]: assetId || undefined }));
    invalidateCandidate();
  };
  const analyze = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const basePartHash = await hashListeningPart(part);
      const next = await listeningApi.analyzeSmartImport(token, {
        moduleId: 'mover',
        part: part.part,
        sources,
        pastedText: pastedText.trim() || undefined,
        currentPart: part,
        basePartHash,
      });
      if (await hashListeningPart(latestPartRef.current) !== next.basePartHash) {
        throw new Error(`Part ${part.part} đã thay đổi trong lúc AI phân tích. Hãy chạy lại để tránh ghi đè dữ liệu mới.`);
      }
      setLastWarnings(next.warnings);
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
  const uploadForRole = async (role: ListeningSmartImportSourceRole, incoming: File[]) => {
    const file = incoming[0];
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      setSource(role, (await onUpload(file, 'image')).id);
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
          <p className="mt-1 text-xs font-semibold text-slate-600">Mỗi ảnh có vai trò riêng. Audio và transcript không bao giờ được gửi để tìm đáp án.</p>
        </div>
        {candidate && (
          <button type="button" onClick={() => { setLastWarnings([]); onCandidateChange(undefined); }} className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-white px-3 py-2 text-xs font-black text-rose-700">
            <Trash2 size={13} /> Bỏ bản đề xuất
          </button>
        )}
      </div>

      <div className={`grid gap-3 ${roleDefinitions.length === 3 ? 'xl:grid-cols-3' : 'lg:grid-cols-2'}`}>
        {roleDefinitions.map(definition => {
          const selectedId = sourceByRole[definition.role];
          const selected = imageAssets.find(asset => asset.id === selectedId);
          const usedByAnotherRole = new Set(Object.entries(sourceByRole)
            .filter(([role, id]) => role !== definition.role && Boolean(id))
            .map(([, id]) => id));
          return (
            <div key={definition.role} className="space-y-2 rounded-xl border border-violet-200 bg-white p-3" data-smart-import-role={definition.role}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-black text-slate-800">{definition.label}</span>
                <span className={`text-[10px] font-bold ${definition.required ? 'text-rose-600' : 'text-slate-500'}`}>{definition.required ? 'Bắt buộc' : 'Không bắt buộc'}</span>
              </div>
              <select
                value={selectedId || ''}
                disabled={busy}
                onChange={event => setSource(definition.role, event.target.value)}
                aria-label={`Chọn ${definition.label}`}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700"
              >
                <option value="">Chọn từ thư viện…</option>
                {imageAssets.filter(asset => !usedByAnotherRole.has(asset.id)).map(asset => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
              </select>
              {selected && (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-[10px] font-black text-violet-700">
                  <span className="min-w-0 truncate">{selected.name}</span>
                  <button
                    type="button"
                    className="smart-import-remove-source inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-rose-200 bg-rose-50 text-rose-700"
                    title="Bỏ khỏi lần phân tích này"
                    aria-label={`Bỏ ${selected.name} khỏi ${definition.label}`}
                    onClick={() => setSource(definition.role)}
                  ><X size={12} /></button>
                </div>
              )}
              <FileDropPasteInput
                accept="image/jpeg,image/png,image/webp,image/gif"
                disabled={busy}
                maxFiles={1}
                pasteImages
                uploadLabel={`Tải ${definition.label.toLowerCase()}`}
                onFiles={files => uploadForRole(definition.role, files)}
              />
            </div>
          );
        })}
      </div>

      {(part.part === 2 || part.part === 3) && (
        <label className="block space-y-1 rounded-xl border border-sky-200 bg-sky-50 p-3">
          <span className="text-xs font-black text-slate-700">Văn bản answer key hỗ trợ — fallback thủ công, không thay âm thầm role ảnh</span>
          <textarea value={pastedText} onChange={event => { setPastedText(event.target.value); invalidateCandidate(); }} rows={4} maxLength={12000} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700" />
        </label>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" disabled={busy || !canAnalyze} onClick={() => void analyze()} title={!canAnalyze ? capability?.reason || `Còn thiếu ${missingRequired.map(item => item.label).join(', ')}` : undefined} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40">
          <Sparkles size={14} /> {busy ? 'Đang phân tích…' : analyzeLabel}
        </button>
        {!capability?.visionEnabled && sources.length > 0 && !localAnswerFallback && <span className="text-xs font-bold text-amber-700">Backend chưa có AI thị giác.</span>}
      </div>
      {error && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-700">{notice}</p>}
      {!candidate && lastWarnings.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3"><p className="mb-1 text-xs font-black text-amber-800">Cảnh báo cần tiếp tục kiểm tra sau khi import</p><ul className="list-disc space-y-1 pl-5 text-xs font-semibold text-amber-700">{lastWarnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}</ul></div>}
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
