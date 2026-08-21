import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FileUp,
  Plus,
  X,
} from 'lucide-react';
import { LibraryLinkStatus, LibraryRowActions } from '../../../components/admin/LibraryRowControls';
import ListeningEditorShell from '../../listening-editor/shell/ListeningEditorShell';
import { EditorField, EditorTextArea } from '../../listening-editor/shared/EditorFields';
import { useListeningDraft } from '../../listening-editor/draft/useListeningDraft';
import { replaceMoverListeningPart } from '../../listening-editor/draft/moverDraft';
import type { ListeningSmartImportCandidate } from '../../listening-editor/smart-import/types';
import ListeningResourceTray, {
  createEmptyListeningResourceAssignments,
  type ListeningImportTaskStatus,
  type ListeningResourceAssignments,
} from '../../listening-editor/resources/ListeningResourceTray';
import {
  createDefaultMoverListeningContent,
  moverListeningEditorDefinition,
} from '../../listening-library/modules/mover/editor/moduleDefinition';
import { listeningApi } from '../api';
import type {
  ListeningAsset,
  ListeningPart,
  ListeningSetSummary,
  ListeningVisibility,
} from '../types';
import { ListeningAssetPicker } from './ListeningAssetPicker';

interface ListeningAdminModuleProps {
  token: string;
}

export const createDefaultListeningContent = createDefaultMoverListeningContent;
const SHOW_WHOLE_EXAM_RESOURCE_TRAY = false;
const ListeningPdfImportDialog = React.lazy(() => import('../../listening-pdf-import/ListeningPdfImportDialog'));

export default function ListeningAdminModule({ token }: ListeningAdminModuleProps) {
  const [sets, setSets] = useState<ListeningSetSummary[]>([]);
  const [assets, setAssets] = useState<ListeningAsset[]>([]);
  const [capabilities, setCapabilities] = useState<any>(null);
  const [editingId, setEditingId] = useState('');
  const draft = useListeningDraft({
    content: { ...createDefaultListeningContent(), title: '__library__' },
    visibility: 'draft',
  });
  const { content, visibility, setContent, setVisibility } = draft;
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [results, setResults] = useState<any[] | null>(null);
  const [resultsTitle, setResultsTitle] = useState('');
  const [showPdfImport, setShowPdfImport] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error' | 'conflict'>('idle');
  const [autosaveTick, setAutosaveTick] = useState(0);
  const [importCandidates, setImportCandidates] = useState<Partial<Record<1 | 2 | 3 | 4 | 5, ListeningSmartImportCandidate>>>({});
  const [resourceAssignments, setResourceAssignments] = useState<ListeningResourceAssignments>(() => createEmptyListeningResourceAssignments());
  const [importStatuses, setImportStatuses] = useState<Partial<Record<1 | 2 | 3 | 4 | 5, ListeningImportTaskStatus>>>({});
  const autosaveInFlight = useRef(false);
  const autosaveBlocked = useRef(false);

  const load = async () => {
    const [setRows, assetRows, capabilityRows] = await Promise.all([
      listeningApi.listSets(token),
      listeningApi.listAssets(token),
      listeningApi.capabilities(token),
    ]);
    setSets(setRows);
    setAssets(assetRows);
    setCapabilities(capabilityRows);
  };

  useEffect(() => {
    void load().catch(error => setMessage({ text: error.message, error: true }));
  }, [token]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!draft.dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [draft.dirty]);

  useEffect(() => {
    if (!editingId || !draft.dirty || busy || autosaveBlocked.current) return;
    const timer = window.setTimeout(async () => {
      if (autosaveInFlight.current) {
        setAutosaveTick(value => value + 1);
        return;
      }
      autosaveInFlight.current = true;
      const snapshot = draft.document;
      const baseRevision = draft.revision;
      setAutosaveStatus('saving');
      try {
        const saved = await listeningApi.autosaveSet(
          token,
          editingId,
          snapshot.content,
          snapshot.visibility,
          baseRevision
        );
        draft.markSaved(snapshot, saved.draftRevision);
        setValidationErrors(saved.validationErrors || []);
        setAutosaveStatus('saved');
      } catch (error: any) {
        if (error?.status === 409) {
          autosaveBlocked.current = true;
          setAutosaveStatus('conflict');
          setMessage({
            text: 'Bản nháp đã được sửa ở tab khác. Hãy tải lại bộ đề trước khi tiếp tục để tránh ghi đè dữ liệu.',
            error: true,
          });
        } else {
          setAutosaveStatus('error');
        }
      } finally {
        autosaveInFlight.current = false;
        setAutosaveTick(value => value + 1);
      }
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [editingId, token, busy, draft.document, draft.dirty, draft.revision, draft.markSaved, autosaveTick]);

  const selectedAssets = useMemo(
    () => new Map(assets.map(asset => [asset.id, asset])),
    [assets]
  );
  const assetUrl = (id?: string) => id ? selectedAssets.get(id)?.url : undefined;
  const replacePart = (index: number, part: ListeningPart) => {
    setContent(previous => replaceMoverListeningPart(previous, index, part));
  };
  const upload = async (
    file: File,
    kind: 'image' | 'audio',
    derivative?: {
      derivedFromAssetId: string;
      crop: { x: number; y: number; width: number; height: number };
    }
  ) => {
    try {
      const asset = await listeningApi.uploadAsset(token, file, kind, derivative);
      setAssets(previous => [asset, ...previous.filter(item => item.id !== asset.id)]);
      return asset;
    } catch (error: any) {
      if (error?.status === 409) {
        autosaveBlocked.current = true;
        setAutosaveStatus('conflict');
      }
      setMessage({ text: error.message, error: true });
      throw error;
    }
  };
  const assetPickerProps = {
    assets,
    aiCapability: capabilities?.imageGeneration,
    onUpload: upload,
  };

  const startNew = () => {
    setEditingId('');
    draft.reset({ content: createDefaultListeningContent(), visibility: 'draft' });
    autosaveBlocked.current = false;
    setAutosaveStatus('idle');
    setImportCandidates({});
    setResourceAssignments(createEmptyListeningResourceAssignments());
    setImportStatuses({});
    setValidationErrors([]);
    setStep(0);
  };
  const editSet = async (id: string) => {
    setBusy(true);
    try {
      const set = await listeningApi.getAdminSet(token, id);
      setEditingId(set.id);
      draft.reset({
        content: set.draftContent || set.versions?.[0]?.content || createDefaultListeningContent(),
        visibility: set.visibility || 'draft',
      }, Number(set.draftRevision || 0));
      autosaveBlocked.current = false;
      setAutosaveStatus('saved');
      setImportCandidates({});
      setResourceAssignments(createEmptyListeningResourceAssignments());
      setImportStatuses({});
      setValidationErrors(set.validationErrors || []);
      setStep(0);
    } catch (error: any) {
      setMessage({ text: error.message, error: true });
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const snapshot = draft.document;
      let saved = editingId
        ? await listeningApi.updateSet(token, editingId, snapshot.content, snapshot.visibility, draft.revision)
        : await listeningApi.createSet(token, snapshot.content);
      if (!editingId && saved.visibility !== snapshot.visibility) {
        saved = await listeningApi.updateSet(
          token,
          saved.id,
          snapshot.content,
          snapshot.visibility,
          Number(saved.draftRevision || 0)
        );
      }
      setEditingId(saved.id);
      draft.markSaved(snapshot, Number(saved.draftRevision || 0));
      autosaveBlocked.current = false;
      setAutosaveStatus('saved');
      setValidationErrors(saved.validationErrors || []);
      setMessage({ text: 'Đã lưu bản nháp bộ đề nghe.' });
      await load();
      return saved;
    } catch (error: any) {
      setMessage({ text: error.message, error: true });
      setValidationErrors(Array.isArray(error.details) ? error.details : []);
      throw error;
    } finally {
      setBusy(false);
    }
  };
  const publish = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const saved = await save();
      setBusy(true);
      const published = await listeningApi.publishSet(token, saved.id);
      setValidationErrors([]);
      setMessage({ text: `Đã xuất bản phiên bản ${published.version.versionNumber}.` });
      await load();
    } catch (error: any) {
      setMessage({ text: error.message, error: true });
      setValidationErrors(Array.isArray(error.details) ? error.details : []);
    } finally {
      setBusy(false);
    }
  };
  const archiveSet = async (set: ListeningSetSummary) => {
    if (!window.confirm(`Xóa bộ đề "${set.title}" khỏi kho? Bộ đề sẽ được lưu trữ để có thể phục hồi; kết quả cũ vẫn được giữ.`)) return;
    try {
      await listeningApi.archiveSet(token, set.id);
      await load();
      setMessage({ text: 'Đã xóa bộ đề khỏi kho và chuyển sang lưu trữ; dữ liệu vẫn có thể phục hồi.' });
    } catch (error: any) {
      setMessage({ text: error.message, error: true });
    }
  };
  const cloneSet = async (set: ListeningSetSummary) => {
    setBusy(true);
    setMessage(null);
    try {
      const cloned = await listeningApi.cloneSet(token, set.id);
      await load();
      setMessage({ text: `Đã sao chép "${set.title}" thành "${cloned.title}". Bản sao đang ở trạng thái nháp.` });
    } catch (error: any) {
      setMessage({ text: error.message, error: true });
    } finally {
      setBusy(false);
    }
  };
  const showResults = async (set: ListeningSetSummary) => {
    setBusy(true);
    try {
      const data = await fetch(`/api/listening/admin/sets/${encodeURIComponent(set.id)}/results`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(async response => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error);
        return payload;
      });
      setResultsTitle(set.title);
      setResults(data.attempts || []);
    } catch (error: any) {
      setMessage({ text: error.message, error: true });
    } finally {
      setBusy(false);
    }
  };
  const previewUrl = (set: ListeningSetSummary) => {
    const query = set.visibility === 'assignment' && set.shareToken
      ? `?accessToken=${encodeURIComponent(set.shareToken)}`
      : '';
    return `${window.location.origin}/listening/${set.id}${query}`;
  };
  const copyPrivateLink = async (set: ListeningSetSummary) => {
    try {
      if (!navigator.clipboard) throw new Error('Trình duyệt không hỗ trợ sao chép tự động.');
      await navigator.clipboard.writeText(previewUrl(set));
      setMessage({ text: `Đã sao chép link riêng của "${set.title}".` });
    } catch (error: any) {
      setMessage({ text: error.message || 'Không thể sao chép link riêng.', error: true });
    }
  };

  const inEditor = Boolean(editingId) || content.title !== '__library__';
  const hasImportCandidates = Object.values(importCandidates).some(Boolean);
  const goLibrary = () => {
    if ((draft.dirty || hasImportCandidates) && !window.confirm(
      hasImportCandidates
        ? 'Có bản Smart Import chưa áp dụng. Nếu quay lại, bản đề xuất này sẽ bị bỏ. Bạn vẫn muốn tiếp tục?'
        : 'Bản nháp còn thay đổi chưa lưu. Bạn vẫn muốn quay lại kho bộ đề?'
    )) return;
    setEditingId('');
    draft.reset({
      content: { ...createDefaultListeningContent(), title: '__library__' },
      visibility: 'draft',
    });
    autosaveBlocked.current = false;
    setAutosaveStatus('idle');
    setImportCandidates({});
    setResourceAssignments(createEmptyListeningResourceAssignments());
    setImportStatuses({});
    setStep(0);
  };

  const renderGeneral = () => (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
        <EditorField label="Tên bộ đề" value={content.title} onChange={title => setContent(value => ({ ...value, title }))} />
        <EditorTextArea label="Mô tả" value={content.description} onChange={description => setContent(value => ({ ...value, description }))} />
        <EditorField label="Trình độ" value={content.level} onChange={level => setContent(value => ({ ...value, level }))} />
        <label className="block space-y-1">
          <span className="text-xs font-black text-slate-700">Quyền truy cập</span>
          <select value={visibility} onChange={event => setVisibility(event.target.value as ListeningVisibility)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold">
            <option value="draft">Bản nháp</option>
            <option value="public">Công khai</option>
            <option value="assignment">Link riêng / giao bài</option>
          </select>
        </label>
        <EditorField
          label="Giới hạn thời gian (phút, để trống nếu không giới hạn)"
          type="number"
          value={content.timeLimitMinutes || ''}
          onChange={value => setContent(previous => ({
            ...previous,
            timeLimitMinutes: value ? Math.max(1, Number(value)) : undefined,
          }))}
        />
        </div>
        <div className="space-y-4">
          <ListeningAssetPicker {...assetPickerProps} label="Ảnh bìa (không bắt buộc)" kind="image" value={content.coverAssetId} onChange={coverAssetId => setContent(value => ({ ...value, coverAssetId }))} />
          <ListeningAssetPicker {...assetPickerProps} label="Hình nền khung học sinh (không bắt buộc)" kind="image" value={content.backgroundAssetId} onChange={backgroundAssetId => setContent(value => ({ ...value, backgroundAssetId }))} />
        </div>
      </div>
      {SHOW_WHOLE_EXAM_RESOURCE_TRAY && (
        <ListeningResourceTray
          token={token}
          content={content}
          assets={assets}
          capability={capabilities?.smartImport}
          assignments={resourceAssignments}
          statuses={importStatuses}
          onAssignmentsChange={setResourceAssignments}
          onStatusChange={(part, status) => setImportStatuses(previous => ({ ...previous, [part]: status }))}
          onCandidate={(part, candidate) => setImportCandidates(previous => ({ ...previous, [part]: candidate }))}
          onUpload={upload}
        />
      )}
    </div>
  );

  const renderPartEditor = (index: number) => {
    const handler = moverListeningEditorDefinition.partHandlers[index];
    const EditorComponent = handler.EditorComponent;
    return (
      <EditorComponent
        key={handler.part}
        part={content.parts[index]}
        token={token}
        assets={assets}
        assetUrl={assetUrl}
        aiCapability={capabilities?.imageGeneration}
        smartImportCapability={capabilities?.smartImport}
        importCandidate={importCandidates[handler.part]}
        onImportCandidateChange={(candidate?: ListeningSmartImportCandidate) => {
          setImportCandidates(previous => ({ ...previous, [handler.part]: candidate }));
          setImportStatuses(previous => ({
            ...previous,
            [handler.part]: candidate ? 'needs_review' : 'idle',
          }));
        }}
        onImportCandidateApplied={() => setImportStatuses(previous => ({
          ...previous,
          [handler.part]: 'accepted',
        }))}
        onUpload={upload}
        onChange={(part: ListeningPart) => replacePart(index, part)}
      />
    );
  };

  const renderPreview = () => (
    <div className="space-y-5">
      <div className="rounded-3xl bg-gradient-to-br from-sky-500 to-indigo-700 p-7 text-white shadow-lg">
        <p className="text-xs font-black uppercase tracking-[.2em] text-sky-100">Bản xem trước cấu trúc</p>
        <h3 className="mt-2 text-3xl font-black">{content.title}</h3>
        <p className="mt-2 max-w-2xl text-sm text-sky-50">{content.description}</p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
          <span className="rounded-full bg-white/20 px-3 py-1">{content.level}</span>
          <span className="rounded-full bg-white/20 px-3 py-1">5 Part</span>
          <span className="rounded-full bg-white/20 px-3 py-1">25 câu chấm điểm</span>
          <span className="rounded-full bg-white/20 px-3 py-1">{content.timeLimitMinutes ? `${content.timeLimitMinutes} phút` : 'Không giới hạn giờ'}</span>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-5">
        {content.parts.map(part => (
          <div key={part.part} className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-black uppercase text-blue-600">Part {part.part}</p>
            <p className="mt-1 font-black text-slate-900">{part.title}</p>
            <p className="mt-2 text-xs text-slate-500">5 câu • {part.audioAssetId ? 'Có audio' : 'Thiếu audio'}</p>
          </div>
        ))}
      </div>
      {validationErrors.length > 0 && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-sm font-black text-rose-800">Cần hoàn thiện trước khi xuất bản</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs font-semibold text-rose-700">
            {validationErrors.map((error, index) => <li key={`${error}-${index}`}>{error}</li>)}
          </ul>
        </div>
      )}
    </div>
  );

  if (!inEditor) {
    return (
      <div className="space-y-6 animate-fade-in" id="listening-admin-module">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[.16em] text-sky-600">Listening Studio</p>
            <h2 className="text-2xl font-black text-slate-900">Bộ đề nghe 5 Part</h2>
            <p className="text-sm text-slate-500">Mỗi phiên bản xuất bản là bất biến; chỉnh sửa tiếp theo không đổi bài đang làm.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={() => setShowPdfImport(true)} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-white px-5 py-3 text-sm font-black text-blue-700 shadow-sm">
              <FileUp size={17} /> Nhập từ PDF
            </button>
            <button type="button" onClick={startNew} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-blue-200">
              <Plus size={17} /> Tạo bộ đề mới
            </button>
          </div>
        </div>
        {showPdfImport && (
          <React.Suspense fallback={<div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 text-sm font-black text-white">Đang mở bộ nhập PDF…</div>}>
            <ListeningPdfImportDialog
              token={token}
              capability={capabilities?.smartImport}
              onClose={() => setShowPdfImport(false)}
              onCompleted={load}
            />
          </React.Suspense>
        )}
        {message && <div className={`rounded-2xl border p-3 text-sm font-bold ${message.error ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{message.text}</div>}
        <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500">
              <tr><th className="p-4">Bộ đề</th><th className="p-4">Trình độ</th><th className="p-4">Phiên bản</th><th className="p-4">Trạng thái</th><th className="p-4">Link</th><th className="p-4">Thao tác</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sets.filter(set => set.status !== 'archived').map(set => (
                <tr key={set.id}>
                  <td className="p-4"><p className="font-black text-slate-900">{set.title}</p><p className="max-w-sm truncate text-xs text-slate-400">{set.description}</p></td>
                  <td className="p-4 font-bold text-slate-600">{set.level}</td>
                  <td className="p-4 font-bold text-slate-600">{set.publishedVersionNumber ? `v${set.publishedVersionNumber}` : 'Chưa xuất bản'}</td>
                  <td className="p-4"><span className={`rounded-full px-2.5 py-1 text-xs font-black ${set.status === 'published' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{set.status === 'published' ? 'Đã xuất bản' : 'Bản nháp'}</span></td>
                  <td className="p-4">
                    <LibraryLinkStatus
                      visibility={set.visibility}
                      privateUrl={set.visibility === 'assignment' && set.shareToken ? previewUrl(set) : undefined}
                      onCopyPrivateLink={set.visibility === 'assignment' && set.shareToken ? () => copyPrivateLink(set) : undefined}
                    />
                  </td>
                  <td className="p-4">
                    <LibraryRowActions
                      onPlay={() => window.open(previewUrl(set), '_blank', 'noopener,noreferrer')}
                      onEdit={() => editSet(set.id)}
                      onClone={() => cloneSet(set)}
                      onResults={() => showResults(set)}
                      onDelete={() => archiveSet(set)}
                      playDisabled={set.status !== 'published'}
                      disabled={busy}
                      playTitle={set.status === 'published' ? 'Play' : 'Cần xuất bản trước khi mở bài học'}
                      deleteTitle="Xóa khỏi kho (lưu trữ có thể phục hồi)"
                    />
                  </td>
                </tr>
              ))}
              {!sets.filter(set => set.status !== 'archived').length && <tr><td colSpan={6} className="p-10 text-center text-sm font-semibold text-slate-400">Chưa có bộ đề nghe.</td></tr>}
            </tbody>
          </table>
        </div>
        {results && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
            <div className="max-h-[85vh] w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 p-5">
                <div><p className="text-xs font-black uppercase text-blue-600">Kết quả Listening</p><h3 className="text-xl font-black text-slate-900">{resultsTitle}</h3></div>
                <button type="button" aria-label="Đóng kết quả" onClick={() => setResults(null)} className="rounded-xl border border-slate-200 p-2"><X size={18} /></button>
              </div>
              <div className="max-h-[68vh] overflow-auto p-5">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead><tr className="text-xs font-black uppercase text-slate-400"><th className="p-3">Học sinh</th><th className="p-3">Điểm</th><th className="p-3">Đúng</th><th className="p-3">Sai</th><th className="p-3">Bỏ trống</th><th className="p-3">Hoàn thành</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">{results.map(attempt => <tr key={attempt.id}><td className="p-3 font-bold">{attempt.studentName}</td><td className="p-3 font-black text-blue-700">{attempt.score}</td><td className="p-3 text-emerald-700">{attempt.correctCount}</td><td className="p-3 text-rose-700">{attempt.incorrectCount}</td><td className="p-3 text-amber-700">{attempt.unansweredCount}</td><td className="p-3 text-xs">{new Date(attempt.completedAt).toLocaleString('vi-VN')}</td></tr>)}</tbody>
                </table>
                {!results.length && <p className="p-10 text-center text-sm text-slate-400">Chưa có lượt nộp bài.</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const steps = [
    'Chung',
    ...moverListeningEditorDefinition.partHandlers.map(handler => handler.label),
    'Xem trước',
  ];
  const activeView = step === 0
    ? renderGeneral()
    : step === steps.length - 1
      ? renderPreview()
      : renderPartEditor(step - 1);

  return (
    <ListeningEditorShell
      title={content.title}
      steps={steps}
      step={step}
      busy={busy || autosaveStatus === 'saving'}
      dirty={draft.dirty}
      autosaveStatus={autosaveStatus}
      canUndo={draft.canUndo}
      canRedo={draft.canRedo}
      message={message}
      onStepChange={setStep}
      onBack={goLibrary}
      onSave={() => { void save(); }}
      onPublish={() => { void publish(); }}
      onUndo={draft.undo}
      onRedo={draft.redo}
    >
      {activeView}
    </ListeningEditorShell>
  );
}
