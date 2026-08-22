import { Check, Copy, FileJson, Sparkles, X } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import FileDropPasteInput from '../../listening/shared/FileDropPasteInput';
import type { ListeningAsset } from '../../listening/types';
import { moverReadingWritingApi } from '../api';
import type { MoverReadingWritingPart } from '../types';
import {
  MOVER_READING_WRITING_EXTERNAL_PROVIDER,
  moverReadingWritingExternalHelp,
  moverReadingWritingExternalInstructions,
  moverReadingWritingExternalTemplate,
  parseMoverReadingWritingExternalImport,
} from './contracts';
import { hashMoverReadingWritingPart } from './hash';
import {
  getMoverReadingWritingSmartImportRoleDefinitions,
  type MoverReadingWritingSmartImportCandidate,
  type MoverReadingWritingSmartImportCapability,
  type MoverReadingWritingSmartImportProviderPreference,
  type MoverReadingWritingSmartImportSourceRole,
} from './types';

interface Props {
  token: string;
  part: MoverReadingWritingPart;
  assets: ListeningAsset[];
  capability?: MoverReadingWritingSmartImportCapability;
  assetSourceByRole?: Partial<Record<MoverReadingWritingSmartImportSourceRole, string>>;
  onUpload?: (file: File, kind: 'image') => Promise<ListeningAsset>;
  onAssetSourceChange?: (role: MoverReadingWritingSmartImportSourceRole, assetId: string) => void;
  onAnalyzed: (candidate: MoverReadingWritingSmartImportCandidate) => Promise<void> | void;
}

const PROVIDERS = [
  { id: 'stali:gpt-5.6-sol', label: 'Stali · ChatGPT 5.6 Sol' },
  { id: 'devquota:gpt-5.6-sol', label: 'DevQuota · ChatGPT 5.6 Sol' },
] as const;

export default function MoverReadingWritingSmartImportPanel({
  token,
  part,
  assets,
  capability,
  assetSourceByRole = {},
  onUpload,
  onAssetSourceChange,
  onAnalyzed,
}: Props) {
  const [provider, setProvider] = useState<MoverReadingWritingSmartImportProviderPreference>(MOVER_READING_WRITING_EXTERNAL_PROVIDER);
  const [externalJson, setExternalJson] = useState('');
  const [temporaryByRole, setTemporaryByRole] = useState<Partial<Record<MoverReadingWritingSmartImportSourceRole, { token: string; name: string }>>>({});
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const latestPartRef = useRef(part);
  const latestOnAnalyzedRef = useRef(onAnalyzed);
  latestPartRef.current = part;
  latestOnAnalyzedRef.current = onAnalyzed;

  const definitions = useMemo(() => getMoverReadingWritingSmartImportRoleDefinitions(part.part), [part.part]);
  const externalMode = provider === MOVER_READING_WRITING_EXTERNAL_PROVIDER;
  const providerDefinitions = PROVIDERS.map(fallback => capability?.providers?.find(item => item.id === fallback.id) || {
    ...fallback,
    enabled: false,
    visionEnabled: true,
    reason: `${fallback.label} chưa được backend công bố. Hãy cập nhật hoặc restart server.`,
  });
  const selectedProvider = providerDefinitions.find(item => item.id === provider);
  const missingRequired = definitions.filter(definition => {
    if (!definition.required) return false;
    return definition.source === 'asset'
      ? !assetSourceByRole[definition.role]
      : !temporaryByRole[definition.role]?.token;
  });
  const canRun = externalMode
    ? Boolean(externalJson.trim())
    : Boolean(
        capability?.enabled !== false
        && capability?.visionEnabled
        && selectedProvider?.enabled
        && selectedProvider.visionEnabled !== false
        && missingRequired.length === 0,
      );

  const clearFeedback = () => {
    setError('');
    setNotice('');
    setWarnings([]);
  };

  const copyInstructions = async () => {
    const value = moverReadingWritingExternalInstructions(part.part);
    setError('');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(value);
    } catch {
      const fallback = document.createElement('textarea');
      fallback.value = value;
      fallback.readOnly = true;
      fallback.style.position = 'fixed';
      fallback.style.left = '-9999px';
      document.body.appendChild(fallback);
      fallback.select();
      const success = document.execCommand('copy');
      fallback.remove();
      if (!success) {
        window.prompt('Nhấn Ctrl+C để sao chép hướng dẫn:', value);
        setError('Trình duyệt không thể xác nhận thao tác sao chép. Hướng dẫn đã được mở để sao chép thủ công.');
        return;
      }
    }
    setCopied(true);
    setNotice(`Đã sao chép hướng dẫn và JSON mẫu Part ${part.part}.`);
    window.setTimeout(() => setCopied(false), 2200);
  };

  const uploadTemporarySource = async (role: MoverReadingWritingSmartImportSourceRole, files: File[]) => {
    const file = files[0];
    if (!file) return;
    clearFeedback();
    const source = await moverReadingWritingApi.uploadSmartImportSource(token, file);
    setTemporaryByRole(previous => ({ ...previous, [role]: { token: source.token, name: file.name } }));
  };

  const uploadAssetSource = async (role: MoverReadingWritingSmartImportSourceRole, files: File[]) => {
    const file = files[0];
    if (!file || !onUpload || !onAssetSourceChange) return;
    setBusy(true);
    clearFeedback();
    try {
      const asset = await onUpload(file, 'image');
      onAssetSourceChange(role, asset.id);
      setNotice(`Đã lưu ${file.name} vào bài soạn và dùng làm nguồn phân tích.`);
    } catch (reason: any) {
      setError(reason?.message || 'Không thể tải ảnh vào bài soạn.');
    } finally {
      setBusy(false);
    }
  };

  const runExternalImport = async () => {
    const basePartHash = await hashMoverReadingWritingPart(part);
    const parsed = parseMoverReadingWritingExternalImport(part.part, externalJson);
    const candidate: MoverReadingWritingSmartImportCandidate = {
      id: globalThis.crypto?.randomUUID?.() || `mrw-external-${Date.now()}`,
      moduleId: 'mover',
      paperId: 'reading-writing',
      part: part.part,
      basePartHash,
      provider: MOVER_READING_WRITING_EXTERNAL_PROVIDER,
      warnings: parsed.warnings,
      createdAt: new Date().toISOString(),
      data: parsed.data,
    };
    if (await hashMoverReadingWritingPart(latestPartRef.current) !== basePartHash) {
      throw new Error(`Part ${part.part} đã thay đổi trong lúc kiểm tra JSON. Hãy chạy lại để tránh ghi đè dữ liệu mới.`);
    }
    await latestOnAnalyzedRef.current(candidate);
    setWarnings(candidate.warnings);
    setNotice(`Đã nhập và lưu thông số bên ngoài vào Part ${part.part}. Hãy kiểm tra trực tiếp trong form soạn.`);
  };

  const runApiImport = async () => {
    const basePartHash = await hashMoverReadingWritingPart(part);
    const sources = definitions.flatMap(definition => {
      if (definition.source === 'asset') {
        const assetId = assetSourceByRole[definition.role];
        return assetId ? [{ role: definition.role, assetId }] : [];
      }
      const temporary = temporaryByRole[definition.role];
      return temporary ? [{ role: definition.role, transientToken: temporary.token }] : [];
    });
    try {
      const candidate = await moverReadingWritingApi.analyzeSmartImport(token, {
        moduleId: 'mover',
        paperId: 'reading-writing',
        part: part.part,
        sources,
        currentPart: part,
        basePartHash,
        preferredProvider: provider,
      });
      if (await hashMoverReadingWritingPart(latestPartRef.current) !== candidate.basePartHash) {
        throw new Error(`Part ${part.part} đã thay đổi trong lúc AI phân tích. Hãy chạy lại để tránh ghi đè dữ liệu mới.`);
      }
      await latestOnAnalyzedRef.current(candidate);
      setWarnings(candidate.warnings);
      setNotice(`Đã phân tích, nhập và lưu dữ liệu API vào Part ${part.part}. Hãy kiểm tra trực tiếp trong form soạn.`);
    } finally {
      // The backend consumes and removes every owner-bound temporary source after a response.
      setTemporaryByRole({});
    }
  };

  const run = async () => {
    setBusy(true);
    clearFeedback();
    try { await (externalMode ? runExternalImport() : runApiImport()); }
    catch (reason: any) {
      const details = Array.isArray(reason?.details) ? reason.details.join(' · ') : '';
      setError([reason?.message || 'Không thể Smart Import Reading & Writing.', details].filter(Boolean).join(' — '));
    } finally { setBusy(false); }
  };

  return (
    <section className="space-y-4 rounded-2xl border border-violet-200 bg-violet-50/40 p-4" data-mover-reading-smart-import data-part={part.part}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[.14em] text-violet-700">Smart Import · Reading & Writing · Part {part.part}</p>
          <p className="mt-1 text-xs font-semibold text-slate-600">
            {externalMode
              ? 'JSON được kiểm tra ngay trong trình duyệt; không gọi API AI.'
              : 'Ảnh hiển thị được lưu cùng bài soạn; ảnh đáp án/OCR tạm sẽ bị xóa sau phản hồi.'}
          </p>
        </div>
        <label className="flex items-center gap-2 rounded-xl border border-violet-200 bg-white px-3 py-2">
          <span className="text-xs font-black text-slate-700">Nguồn xử lý</span>
          <select
            value={provider}
            disabled={busy}
            onChange={event => { setProvider(event.target.value as MoverReadingWritingSmartImportProviderPreference); clearFeedback(); }}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-bold text-slate-700"
            aria-label="Chọn nguồn xử lý Smart Import Reading & Writing"
          >
            <option value={MOVER_READING_WRITING_EXTERNAL_PROVIDER}>Thông số bên ngoài</option>
            {providerDefinitions.map(item => (
              <option key={item.id} value={item.id} disabled={!item.enabled}>
                {item.label}{item.model ? ` · ${item.model}` : ''}{item.enabled ? '' : ` · ${item.reason || 'chưa cấu hình'}`}
              </option>
            ))}
          </select>
        </label>
      </div>

      {externalMode ? (
        <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-black text-emerald-900">Thông số Part {part.part} bên ngoài</p>
              <p className="mt-1 text-[11px] font-semibold text-emerald-800">{moverReadingWritingExternalHelp[part.part]}</p>
            </div>
            <button type="button" onClick={() => void copyInstructions()} className="mover-reading-secondary-action inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 text-xs font-black">
              {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Đã sao chép' : 'Sao chép hướng dẫn cho AI'}
            </button>
          </div>
          <textarea
            value={externalJson}
            disabled={busy}
            rows={14}
            maxLength={80_000}
            spellCheck={false}
            onChange={event => { setExternalJson(event.target.value); clearFeedback(); }}
            placeholder={moverReadingWritingExternalTemplate(part.part)}
            aria-label={`Thông số bên ngoài Reading & Writing Part ${part.part}`}
            className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 font-mono text-xs font-semibold text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
          />
        </div>
      ) : (
        <div className={`grid gap-3 ${definitions.length >= 4 ? 'xl:grid-cols-4' : 'lg:grid-cols-3'}`}>
          {definitions.map(definition => {
            const assetId = assetSourceByRole[definition.role];
            const asset = assets.find(item => item.id === assetId);
            const temporary = temporaryByRole[definition.role];
            return (
              <div key={definition.role} className="space-y-2 rounded-xl border border-violet-200 bg-white p-3" data-mover-reading-smart-import-role={definition.role}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-black text-slate-800">{definition.label}</p>
                  <span className={`text-[10px] font-bold ${definition.required ? 'text-rose-600' : 'text-slate-500'}`}>{definition.required ? 'Bắt buộc' : 'Không bắt buộc'}</span>
                </div>
                <p className="text-[10px] font-semibold text-slate-500">{definition.help}</p>
                {definition.source === 'asset' ? (
                  <div className="space-y-2">
                    <div className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-[11px] font-bold ${asset ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                      <span className="min-w-0 truncate">{asset ? `Đang dùng: ${asset.name}` : 'Chưa có ảnh được gắn vào bài soạn.'}</span>
                      {asset && onAssetSourceChange && (
                        <button type="button" aria-label={`Bỏ ${definition.label}`} onClick={() => onAssetSourceChange(definition.role, '')} className="mover-reading-remove-source inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-rose-200 bg-white text-rose-700"><X size={13} /></button>
                      )}
                    </div>
                    {onUpload && onAssetSourceChange && (
                      <FileDropPasteInput
                        accept="image/jpeg,image/png,image/webp"
                        disabled={busy}
                        maxFiles={1}
                        pasteImages
                        uploadLabel={asset ? `Thay ${definition.label.toLowerCase()}` : `Tải ${definition.label.toLowerCase()}`}
                        onFiles={files => uploadAssetSource(definition.role, files)}
                      />
                    )}
                  </div>
                ) : temporary ? (
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-bold text-emerald-800">
                    <span className="min-w-0 truncate">{temporary.name}</span>
                    <button type="button" aria-label={`Bỏ ${definition.label}`} onClick={() => setTemporaryByRole(previous => ({ ...previous, [definition.role]: undefined }))} className="mover-reading-remove-source inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-rose-200 bg-white text-rose-700"><X size={13} /></button>
                  </div>
                ) : (
                  <FileDropPasteInput
                    accept="image/jpeg,image/png,image/webp"
                    disabled={busy}
                    maxFiles={1}
                    pasteImages
                    uploadLabel={`Tải ${definition.label.toLowerCase()}`}
                    onFiles={files => uploadTemporarySource(definition.role, files)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy || !canRun}
          onClick={() => void run()}
          title={!canRun
            ? externalMode
              ? 'Chưa nhập JSON thông số bên ngoài.'
              : missingRequired.length
                ? `Còn thiếu ${missingRequired.map(item => item.label).join(', ')}`
                : selectedProvider?.reason || capability?.reason
            : undefined}
          className="mover-reading-primary-action inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          {externalMode ? <FileJson size={15} /> : <Sparkles size={15} />}
          {busy ? 'Đang xử lý…' : externalMode ? `Kiểm tra, nhập và lưu Part ${part.part}` : `Phân tích, nhập và lưu Part ${part.part}`}
        </button>
        {!externalMode && !capability?.visionEnabled && <span className="text-xs font-bold text-amber-700">Backend chưa có AI thị giác.</span>}
      </div>
      {error && <p className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</p>}
      {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-700">{notice}</p>}
      {warnings.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3"><p className="mb-1 text-xs font-black text-amber-900">Cần kiểm tra sau khi import</p><ul className="list-disc space-y-1 pl-5 text-xs font-semibold text-amber-800">{warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}</ul></div>}
    </section>
  );
}
