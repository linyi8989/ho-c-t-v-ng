import { BookOpenText, Plus, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { LibraryLinkStatus, LibraryRowActions } from '../../../components/admin/LibraryRowControls';
import { listeningApi } from '../../listening/api';
import type { ListeningAsset } from '../../listening/types';
import { ListeningAssetPicker } from '../../listening/admin/ListeningAssetPicker';
import { examPaperExamPath } from '../../listening-library/routes';
import { useListeningDraft } from '../../listening-editor/draft/useListeningDraft';
import ListeningEditorShell from '../../listening-editor/shell/ListeningEditorShell';
import { EditorField, EditorTextArea } from '../../listening-editor/shared/EditorFields';
import { createDefaultMoverReadingWritingContent } from '../defaultContent';
import { moverReadingWritingApi } from '../api';
import { mergeMoverReadingWritingSmartImport } from '../smart-import/merge';
import type {
  MoverReadingWritingSmartImportCandidate,
  MoverReadingWritingSmartImportCapability,
} from '../smart-import/types';
import type {
  MoverReadingWritingContent,
  MoverReadingWritingPart,
  MoverReadingWritingSetSummary,
  MoverReadingWritingVisibility,
} from '../types';
import {
  ReadingPart1Editor,
  ReadingPart2Editor,
  ReadingPart3Editor,
  ReadingPart4Editor,
  ReadingPart5Editor,
  ReadingPart6Editor,
} from './MoverReadingWritingPartEditors';

interface Props { token: string }

const steps = ['Thông tin chung', 'Part 1', 'Part 2', 'Part 3', 'Part 4', 'Part 5', 'Part 6', 'Xem trước'];

export default function MoverReadingWritingAdmin({ token }: Props) {
  const [sets, setSets] = useState<MoverReadingWritingSetSummary[]>([]);
  const [assets, setAssets] = useState<ListeningAsset[]>([]);
  const [smartImportCapability, setSmartImportCapability] = useState<MoverReadingWritingSmartImportCapability>();
  const [editingId, setEditingId] = useState('');
  const [inEditor, setInEditor] = useState(false);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [results, setResults] = useState<any[] | null>(null);
  const [resultsTitle, setResultsTitle] = useState('');
  const [expandedAttempt, setExpandedAttempt] = useState('');
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error' | 'conflict'>('idle');
  const [autosaveTick, setAutosaveTick] = useState(0);
  const autosaveInFlight = useRef(false);
  const autosaveBlocked = useRef(false);
  const draft = useListeningDraft<MoverReadingWritingContent, MoverReadingWritingVisibility>({
    content: createDefaultMoverReadingWritingContent(),
    visibility: 'draft',
  });
  const latestDraftRef = useRef({ document: draft.document, revision: draft.revision });
  const latestEditingIdRef = useRef(editingId);
  latestDraftRef.current = { document: draft.document, revision: draft.revision };
  latestEditingIdRef.current = editingId;

  const load = async () => {
    const [setRows, assetRows, capabilities] = await Promise.all([
      moverReadingWritingApi.listSets(token),
      listeningApi.listAssets(token),
      moverReadingWritingApi.capabilities(token).catch(error => ({
        smartImport: {
          enabled: false,
          visionEnabled: false,
          providers: [],
          reason: error?.message || 'Không thể tải trạng thái Smart Import.',
        },
        transientUpload: { enabled: false },
      })),
    ]);
    setSets(setRows);
    setAssets(assetRows);
    setSmartImportCapability(capabilities.smartImport);
  };

  useEffect(() => {
    void load().catch(error => setMessage({ text: error.message, error: true }));
  }, [token]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!inEditor || !draft.dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [draft.dirty, inEditor]);

  useEffect(() => {
    if (!inEditor || !editingId || !draft.dirty || busy || autosaveBlocked.current) return;
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
        const saved = await moverReadingWritingApi.autosaveSet(
          token,
          editingId,
          snapshot.content,
          snapshot.visibility,
          baseRevision,
        );
        draft.markSaved(snapshot, saved.draftRevision);
        setValidationErrors(saved.validationErrors || []);
        setAutosaveStatus('saved');
      } catch (error: any) {
        if (error?.status === 409) {
          autosaveBlocked.current = true;
          setAutosaveStatus('conflict');
          setMessage({
            text: 'Bản nháp đã được sửa ở tab khác. Hãy mở lại bộ đề trước khi tiếp tục để tránh ghi đè dữ liệu.',
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
  }, [busy, draft.dirty, draft.document, draft.markSaved, draft.revision, editingId, inEditor, token, autosaveTick]);

  const upload = async (
    file: File,
    kind: 'image' | 'audio',
    derivative?: {
      derivedFromAssetId: string;
      crop: { x: number; y: number; width: number; height: number };
    },
  ) => {
    const asset = await listeningApi.uploadAsset(token, file, kind, derivative);
    setAssets(previous => [asset, ...previous.filter(item => item.id !== asset.id)]);
    return asset;
  };

  const replacePart = (index: number, part: MoverReadingWritingPart) => {
    draft.setContent(previous => {
      const parts = [...previous.parts] as MoverReadingWritingContent['parts'];
      parts[index] = part as never;
      return { ...previous, parts };
    });
  };

  const waitForAutosaveIdle = async () => {
    const deadline = Date.now() + 15_000;
    while (autosaveInFlight.current && Date.now() < deadline) {
      await new Promise(resolve => window.setTimeout(resolve, 50));
    }
    if (autosaveInFlight.current) throw new Error('Bản nháp đang lưu quá lâu. Hãy đợi trạng thái lưu hoàn tất rồi Smart Import lại.');
  };

  const applySmartImport = async (candidate: MoverReadingWritingSmartImportCandidate) => {
    setBusy(true);
    setMessage(null);
    try {
      if (autosaveBlocked.current) throw new Error('Bản nháp đang xung đột với một tab khác. Hãy mở lại bộ đề trước khi Smart Import.');
      await waitForAutosaveIdle();
      const snapshot = latestDraftRef.current;
      const partIndex = candidate.part - 1;
      const currentPart = snapshot.document.content.parts[partIndex];
      if (!currentPart || currentPart.part !== candidate.part) throw new Error('Part hiện tại không còn khớp kết quả Smart Import.');
      const mergedPart = mergeMoverReadingWritingSmartImport(currentPart, candidate.data);
      const parts = [...snapshot.document.content.parts] as MoverReadingWritingContent['parts'];
      parts[partIndex] = mergedPart as never;
      const document = {
        ...snapshot.document,
        content: { ...snapshot.document.content, parts },
      };
      draft.setDocument(document);

      let setId = latestEditingIdRef.current;
      let revision = snapshot.revision;
      let validation = [] as string[];
      if (!setId) {
        let created = await moverReadingWritingApi.createSet(token, document.content);
        setId = created.id;
        revision = Number(created.draftRevision || 1);
        validation = created.validationErrors || [];
        latestEditingIdRef.current = setId;
        setEditingId(setId);
        if (document.visibility !== created.visibility) {
          created = await moverReadingWritingApi.updateSet(
            token,
            setId,
            document.content,
            document.visibility,
            revision,
          );
          revision = Number(created.draftRevision || revision + 1);
          validation = created.validationErrors || validation;
        }
      } else {
        const saved = await moverReadingWritingApi.autosaveSet(
          token,
          setId,
          document.content,
          document.visibility,
          revision,
        );
        revision = saved.draftRevision;
        validation = saved.validationErrors || [];
      }
      draft.markSaved(document, revision);
      setValidationErrors(validation);
      setAutosaveStatus('saved');
      setAutosaveTick(value => value + 1);
      await load();
    } catch (error: any) {
      if (error?.status === 409) {
        autosaveBlocked.current = true;
        setAutosaveStatus('conflict');
      } else {
        setAutosaveStatus('error');
      }
      setMessage({ text: error?.message || 'Không thể lưu kết quả Smart Import.', error: true });
      throw error;
    } finally { setBusy(false); }
  };

  const startNew = () => {
    draft.reset({ content: createDefaultMoverReadingWritingContent(), visibility: 'draft' });
    autosaveBlocked.current = false;
    setAutosaveStatus('idle');
    setEditingId('');
    setValidationErrors([]);
    setMessage(null);
    setStep(0);
    setInEditor(true);
  };

  const editSet = async (id: string) => {
    setBusy(true);
    try {
      const set = await moverReadingWritingApi.getAdminSet(token, id);
      draft.reset({
        content: set.draftContent || set.versions?.[0]?.content || createDefaultMoverReadingWritingContent(),
        visibility: set.visibility || 'draft',
      }, Number(set.draftRevision || 0));
      autosaveBlocked.current = false;
      setAutosaveStatus('saved');
      setEditingId(set.id);
      setValidationErrors(set.validationErrors || []);
      setStep(0);
      setInEditor(true);
    } catch (error: any) {
      setMessage({ text: error.message, error: true });
    } finally { setBusy(false); }
  };

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const snapshot = draft.document;
      let saved = editingId
        ? await moverReadingWritingApi.updateSet(token, editingId, snapshot.content, snapshot.visibility, draft.revision)
        : await moverReadingWritingApi.createSet(token, snapshot.content);
      if (!editingId && saved.visibility !== snapshot.visibility) {
        saved = await moverReadingWritingApi.updateSet(token, saved.id, snapshot.content, snapshot.visibility, Number(saved.draftRevision || 0));
      }
      setEditingId(saved.id);
      draft.markSaved(snapshot, Number(saved.draftRevision || 0));
      autosaveBlocked.current = false;
      setAutosaveStatus('saved');
      setValidationErrors(saved.validationErrors || []);
      setMessage({ text: 'Đã lưu bản nháp Mover Reading & Writing.' });
      await load();
      return saved;
    } catch (error: any) {
      if (error?.status === 409) {
        autosaveBlocked.current = true;
        setAutosaveStatus('conflict');
      }
      setValidationErrors(Array.isArray(error.details) ? error.details : []);
      setMessage({ text: error.message, error: true });
      throw error;
    } finally { setBusy(false); }
  };

  const publish = async () => {
    try {
      const saved = await save();
      setBusy(true);
      const published = await moverReadingWritingApi.publishSet(token, saved.id);
      setValidationErrors([]);
      setMessage({ text: `Đã xuất bản phiên bản ${published.version.versionNumber}.` });
      await load();
    } catch (error: any) {
      setValidationErrors(Array.isArray(error.details) ? error.details : []);
      setMessage({ text: error.message, error: true });
    } finally { setBusy(false); }
  };

  const goLibrary = () => {
    if (draft.dirty && !window.confirm('Bản nháp còn thay đổi chưa lưu. Bạn vẫn muốn quay lại kho bộ đề?')) return;
    setInEditor(false);
    setEditingId('');
    setStep(0);
  };

  const previewUrl = (set: MoverReadingWritingSetSummary) => {
    const accessToken = set.visibility === 'assignment' ? set.shareToken || '' : '';
    return `${window.location.origin}${examPaperExamPath('mover', 'reading-writing', set.id, accessToken)}`;
  };

  const archiveSet = async (set: MoverReadingWritingSetSummary) => {
    if (!window.confirm(`Xóa "${set.title}" khỏi kho? Dữ liệu và kết quả cũ vẫn được giữ.`)) return;
    try { await moverReadingWritingApi.archiveSet(token, set.id); await load(); }
    catch (error: any) { setMessage({ text: error.message, error: true }); }
  };

  const cloneSet = async (set: MoverReadingWritingSetSummary) => {
    try {
      const cloned = await moverReadingWritingApi.cloneSet(token, set.id);
      await load();
      setMessage({ text: `Đã tạo "${cloned.title}" ở trạng thái nháp.` });
    } catch (error: any) { setMessage({ text: error.message, error: true }); }
  };

  const showResults = async (set: MoverReadingWritingSetSummary) => {
    setBusy(true);
    try {
      const data = await moverReadingWritingApi.results(token, set.id);
      setResults(data.attempts || []);
      setResultsTitle(set.title);
      setExpandedAttempt('');
    } catch (error: any) { setMessage({ text: error.message, error: true }); }
    finally { setBusy(false); }
  };

  const renderGeneral = () => (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="space-y-4">
        <EditorField label="Tên bộ đề" value={draft.content.title} onChange={title => draft.setContent(value => ({ ...value, title }))} />
        <EditorTextArea label="Mô tả" value={draft.content.description} onChange={description => draft.setContent(value => ({ ...value, description }))} />
        <EditorField label="Trình độ" value={draft.content.level} onChange={level => draft.setContent(value => ({ ...value, level }))} />
        <EditorField label="Giới hạn thời gian (phút, để trống nếu không giới hạn)" type="number" value={draft.content.timeLimitMinutes || ''} onChange={value => draft.setContent(previous => ({ ...previous, timeLimitMinutes: value ? Math.max(1, Number(value)) : undefined }))} />
        <label className="block space-y-1">
          <span className="text-xs font-black text-slate-700">Quyền truy cập</span>
          <select value={draft.visibility} onChange={event => draft.setVisibility(event.target.value as MoverReadingWritingVisibility)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold">
            <option value="draft">Bản nháp</option>
            <option value="public">Công khai</option>
            <option value="assignment">Link riêng / giao bài</option>
          </select>
        </label>
        <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-700">
          <input type="checkbox" checked={draft.content.showReviewAfterSubmit} onChange={event => draft.setContent(value => ({ ...value, showReviewAfterSubmit: event.target.checked }))} />
          Cho học sinh xem đáp án và chi tiết sau khi nộp
        </label>
      </div>
      <ListeningAssetPicker
        label="Ảnh bìa (không bắt buộc)"
        kind="image"
        value={draft.content.coverAssetId}
        assets={assets}
        onUpload={upload}
        aiCapability={{ enabled: false, reason: 'Dùng ảnh upload/thư viện cho bìa.' }}
        onChange={coverAssetId => draft.setContent(value => ({ ...value, coverAssetId }))}
      />
    </div>
  );

  const partEditors = [
    <div key={1} className="contents"><ReadingPart1Editor token={token} part={draft.content.parts[0]} assets={assets} smartImportCapability={smartImportCapability} onUpload={upload} onChange={part => replacePart(0, part)} onSmartImport={applySmartImport} /></div>,
    <div key={2} className="contents"><ReadingPart2Editor token={token} part={draft.content.parts[1]} assets={assets} smartImportCapability={smartImportCapability} onUpload={upload} onChange={part => replacePart(1, part)} onSmartImport={applySmartImport} /></div>,
    <div key={3} className="contents"><ReadingPart3Editor token={token} part={draft.content.parts[2]} assets={assets} smartImportCapability={smartImportCapability} onUpload={upload} onChange={part => replacePart(2, part)} onSmartImport={applySmartImport} /></div>,
    <div key={4} className="contents"><ReadingPart4Editor token={token} part={draft.content.parts[3]} assets={assets} smartImportCapability={smartImportCapability} onUpload={upload} onChange={part => replacePart(3, part)} onSmartImport={applySmartImport} /></div>,
    <div key={5} className="contents"><ReadingPart5Editor token={token} part={draft.content.parts[4]} assets={assets} smartImportCapability={smartImportCapability} onUpload={upload} onChange={part => replacePart(4, part)} onSmartImport={applySmartImport} /></div>,
    <div key={6} className="contents"><ReadingPart6Editor token={token} part={draft.content.parts[5]} assets={assets} smartImportCapability={smartImportCapability} onUpload={upload} onChange={part => replacePart(5, part)} onSmartImport={applySmartImport} /></div>,
  ];

  const preview = (
    <div className="space-y-5">
      <div className="rounded-3xl bg-gradient-to-br from-indigo-600 to-blue-700 p-7 text-white">
        <p className="text-xs font-black uppercase tracking-[.2em] text-blue-100">Mover · Reading & Writing</p>
        <h3 className="mt-2 text-3xl font-black">{draft.content.title}</h3>
        <p className="mt-2 text-sm text-blue-50">{draft.content.description}</p>
        <p className="mt-4 text-sm font-black">6 Part · 40 câu · {draft.content.timeLimitMinutes ? `${draft.content.timeLimitMinutes} phút` : 'Không giới hạn thời gian'}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {draft.content.parts.map((part, index) => (
          <div key={part.part} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black text-blue-700">Part {index + 1}</p>
            <p className="mt-1 font-black text-slate-900">{part.title}</p>
            <p className="mt-2 text-xs font-semibold text-slate-500 line-clamp-3">{part.instruction}</p>
          </div>
        ))}
      </div>
    </div>
  );

  if (inEditor) {
    return (
      <div id="mover-reading-writing-admin">
        <ListeningEditorShell
          rootId="mover-reading-writing-wizard"
          eyebrow="Mover Reading & Writing wizard"
          stepAriaLabel="Các bước soạn Mover Reading & Writing"
          title={draft.content.title || 'Bộ đề mới'}
          steps={steps}
          step={step}
          busy={busy}
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
          {validationErrors.length > 0 && (
            <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold text-amber-900">
              <p className="mb-2 font-black">Cần hoàn thiện trước khi xuất bản:</p>
              <ul className="list-disc space-y-1 pl-5">{validationErrors.map((error, index) => <li key={`${error}-${index}`}>{error}</li>)}</ul>
            </div>
          )}
          {step === 0 ? renderGeneral() : step <= 6 ? partEditors[step - 1] : preview}
        </ListeningEditorShell>
      </div>
    );
  }

  return (
    <div className="space-y-6" id="mover-reading-writing-admin">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[.18em] text-indigo-600">Mover paper</p>
          <h2 className="mt-1 flex items-center gap-2 text-2xl font-black text-slate-900"><BookOpenText className="text-indigo-600" /> Reading & Writing</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">Soạn và quản lý bộ đề 6 Part, 40 câu.</p>
        </div>
        <button type="button" onClick={startNew} className="mover-reading-primary-action inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-black text-white"><Plus size={17} /> Soạn bộ đề mới</button>
      </div>
      {message && <div className={`rounded-2xl border p-3 text-sm font-bold ${message.error ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{message.text}</div>}
      <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white">
        <table className="min-w-[1000px] w-full text-left text-xs">
          <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-600"><tr><th className="p-4">Bộ đề</th><th className="p-4">Cấu trúc</th><th className="p-4">Trạng thái</th><th className="p-4">Link</th><th className="p-4">Thao tác</th></tr></thead>
          <tbody>
            {sets.map(set => (
              <tr key={set.id} className="border-t border-slate-100">
                <td className="p-4"><button type="button" onClick={() => window.location.href = previewUrl(set)} disabled={set.status !== 'published'} className="font-black text-blue-700 disabled:text-slate-500">{set.title}</button><p className="mt-1 max-w-sm text-slate-500 line-clamp-2">{set.description}</p></td>
                <td className="p-4 font-bold text-slate-600">6 Part · 40 câu</td>
                <td className="p-4 font-bold text-slate-600">{set.status === 'published' ? `Đã xuất bản v${set.publishedVersionNumber || 1}` : 'Bản nháp'}</td>
                <td className="p-4"><LibraryLinkStatus visibility={set.visibility} privateUrl={set.visibility === 'assignment' && set.shareToken ? previewUrl(set) : undefined} onCopyPrivateLink={set.shareToken ? async () => { await navigator.clipboard.writeText(previewUrl(set)); setMessage({ text: 'Đã sao chép link riêng.' }); } : undefined} /></td>
                <td className="p-4"><LibraryRowActions onPlay={() => window.location.href = previewUrl(set)} playDisabled={set.status !== 'published'} onEdit={() => void editSet(set.id)} onClone={() => void cloneSet(set)} onResults={() => void showResults(set)} onDelete={() => void archiveSet(set)} disabled={busy} deleteTitle="Lưu trữ bộ đề" /></td>
              </tr>
            ))}
            {sets.length === 0 && <tr><td colSpan={5} className="p-10 text-center font-semibold text-slate-500">Chưa có bộ đề Reading & Writing.</td></tr>}
          </tbody>
        </table>
      </div>
      {results && (
        <section className="rounded-3xl border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between"><div><h3 className="text-lg font-black text-slate-900">Kết quả: {resultsTitle}</h3><p className="text-xs font-semibold text-slate-500">{results.length} lượt làm bài</p></div><button type="button" aria-label="Đóng kết quả" onClick={() => setResults(null)} className="rounded-xl border border-slate-200 p-2 text-slate-600"><X size={16} /></button></div>
          <div className="space-y-3">
            {results.map(attempt => (
              <article key={attempt.id} className="rounded-2xl border border-slate-200 p-4">
                <button type="button" onClick={() => setExpandedAttempt(value => value === attempt.id ? '' : attempt.id)} className="grid w-full gap-2 text-left text-xs font-bold text-slate-700 sm:grid-cols-5">
                  <span>{attempt.studentName || 'Học sinh'}</span><span>Điểm: {attempt.score}</span><span>Đúng: {attempt.correctCount}/40</span><span>Thời gian: {attempt.durationSeconds || 0}s</span><span>{new Date(attempt.completedAt).toLocaleString('vi-VN')}</span>
                </button>
                {expandedAttempt === attempt.id && <div className="mt-4 grid gap-2 md:grid-cols-2">{(attempt.questions || []).map((question: any, index: number) => <div key={`${question.part}-${index}`} className={`rounded-xl border p-3 text-xs ${question.correct ? 'border-emerald-200 bg-emerald-50' : question.unanswered ? 'border-amber-200 bg-amber-50' : 'border-rose-200 bg-rose-50'}`}><p className="font-black">Part {question.part} · {question.prompt}</p><p className="mt-1">Học sinh: {question.userAnswer || 'Bỏ trống'}</p>{!question.correct && <p>Đúng: {question.correctAnswer}</p>}</div>)}</div>}
              </article>
            ))}
            {results.length === 0 && <p className="py-8 text-center text-sm font-semibold text-slate-500">Chưa có lượt làm bài.</p>}
          </div>
        </section>
      )}
    </div>
  );
}
