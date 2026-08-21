import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  LoaderCircle,
  RefreshCw,
  UploadCloud,
  X,
} from 'lucide-react';
import type {
  ListeningPart1,
  ListeningPart2,
  ListeningPart3,
  ListeningPart4,
  ListeningPart5,
  ListeningSetContent,
} from '../listening/types';
import { listeningApi } from '../listening/api';
import { hashListeningPart } from '../listening-editor/smart-import/hash';
import { cropListeningImage } from '../listening-editor/smart-import/cropImage';
import { detectPart4Frames, groupPart4Frames } from '../listening-editor/smart-import/part4FrameDetection';
import type {
  ListeningSmartImportCandidate,
  ListeningSmartImportPartId,
  ListeningSmartImportProviderDefinition,
  ListeningSmartImportProviderPreference,
  SmartImportCrop,
} from '../listening-editor/smart-import/types';
import {
  applyPart3ConnectAnalysis,
  applyPart4Analysis,
  applyPart5SceneAnalysis,
  importPart1Analysis,
  importPart2Analysis,
} from '../listening-library/modules/mover/editor/directImport';
import { createDefaultMoverListeningContent } from '../listening-library/modules/mover/editor/moduleDefinition';
import type {
  ListeningPdfDocument,
} from './pdfProcessing';
import type {
  ListeningPdfManifest,
  ListeningPdfManifestTest,
  ListeningPdfPartStatus,
  ListeningPdfTestProgress,
} from './types';

interface ListeningPdfImportDialogProps {
  token: string;
  capability?: {
    enabled?: boolean;
    visionEnabled?: boolean;
    reason?: string;
    providers?: ListeningSmartImportProviderDefinition[];
  };
  onClose: () => void;
  onCompleted: () => Promise<void> | void;
}

interface ImportContext {
  id: string;
  revision: number;
  content: ListeningSetContent;
  keyFile?: File;
  questionFiles: Map<ListeningSmartImportPartId, File>;
}

const PARTS = [1, 2, 3, 4, 5] as const;

const statusLabel: Record<ListeningPdfPartStatus, string> = {
  queued: 'Chờ xử lý',
  running: 'Đang xử lý',
  completed: 'Đã nhập',
  needs_review: 'Cần xem lại',
  failed: 'Lỗi',
};

const statusClass: Record<ListeningPdfPartStatus, string> = {
  queued: 'bg-slate-100 text-slate-600',
  running: 'bg-blue-100 text-blue-700',
  completed: 'bg-emerald-100 text-emerald-700',
  needs_review: 'bg-amber-100 text-amber-800',
  failed: 'bg-rose-100 text-rose-700',
};

const updateTuplePart = (
  content: ListeningSetContent,
  partNumber: ListeningSmartImportPartId,
  part: ListeningSetContent['parts'][number],
): ListeningSetContent => {
  const parts = [...content.parts] as ListeningSetContent['parts'];
  parts[partNumber - 1] = part as never;
  return { ...content, parts };
};

const withObjectUrl = async <T,>(file: File, operation: (url: string) => Promise<T>) => {
  const url = URL.createObjectURL(file);
  try {
    return await operation(url);
  } finally {
    URL.revokeObjectURL(url);
  }
};

async function mapWithConcurrency<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      await worker(item);
    }
  });
  await Promise.all(workers);
}

export default function ListeningPdfImportDialog({
  token,
  capability,
  onClose,
  onCompleted,
}: ListeningPdfImportDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const documentsRef = useRef<{ book: ListeningPdfDocument; key: ListeningPdfDocument }>();
  const contextsRef = useRef(new Map<number, ImportContext>());
  const statusesRef = useRef(new Map<number, Map<ListeningSmartImportPartId, ListeningPdfPartStatus>>());
  const [files, setFiles] = useState<File[]>([]);
  const [manifest, setManifest] = useState<ListeningPdfManifest>();
  const [progress, setProgress] = useState<ListeningPdfTestProgress[]>([]);
  const [selectedTests, setSelectedTests] = useState<Set<number>>(new Set());
  const [mapping, setMapping] = useState(false);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean }>();
  const enabledProviders = capability?.enabled === false || capability?.visionEnabled === false
    ? []
    : (capability?.providers || []).filter(provider => provider.enabled && provider.visionEnabled !== false);
  const [providerId, setProviderId] = useState('');

  useEffect(() => {
    if (!providerId && enabledProviders[0]) setProviderId(enabledProviders[0].id);
  }, [providerId, enabledProviders]);

  useEffect(() => () => {
    void documentsRef.current?.book.loadingTask.destroy();
    void documentsRef.current?.key.loadingTask.destroy();
  }, []);

  const setPartStatus = (
    testNumber: number,
    part: ListeningSmartImportPartId,
    status: ListeningPdfPartStatus,
    options: { message?: string; warnings?: string[] } = {},
  ) => {
    const map = statusesRef.current.get(testNumber) || new Map();
    map.set(part, status);
    statusesRef.current.set(testNumber, map);
    setProgress(previous => previous.map(test => test.testNumber === testNumber ? {
      ...test,
      parts: test.parts.map(row => row.part === part ? { ...row, status, ...options } : row),
    } : test));
  };

  const setDraftId = (testNumber: number, draftId: string) => {
    setProgress(previous => previous.map(test => test.testNumber === testNumber
      ? { ...test, draftId }
      : test));
  };

  const replaceFiles = async (incoming: File[]) => {
    if (running || mapping) return;
    try {
      const pdfs = incoming.filter(file => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
      if (pdfs.length !== 2) throw new Error('Vui lòng chọn đúng 2 file PDF: đề bài và đáp án.');
      await Promise.allSettled([
        documentsRef.current?.book.loadingTask.destroy(),
        documentsRef.current?.key.loadingTask.destroy(),
      ].filter(Boolean) as Promise<unknown>[]);
      documentsRef.current = undefined;
      contextsRef.current.clear();
      statusesRef.current.clear();
      setFiles(pdfs);
      setManifest(undefined);
      setProgress([]);
      setSelectedTests(new Set());
      setMessage(undefined);
    } catch (reason: any) {
      setMessage({ text: reason?.message || 'Không thể đọc file đã chọn.', error: true });
    }
  };

  const analyzeFiles = async () => {
    setMapping(true);
    setMessage(undefined);
    try {
      if (!providerId) throw new Error('Chưa có nhà cung cấp AI thị giác khả dụng.');
      const pdf = await import('./pdfProcessing');
      await Promise.allSettled([
        documentsRef.current?.book.loadingTask.destroy(),
        documentsRef.current?.key.loadingTask.destroy(),
      ].filter(Boolean) as Promise<unknown>[]);
      let assigned = pdf.assignListeningPdfFiles(files);
      let [bookDocument, keyDocument] = await Promise.all([
        pdf.openListeningPdf(assigned.book),
        pdf.openListeningPdf(assigned.key),
      ]);
      const hasNamedKey = files.some(file => /(?:^|[\s_.-])(key|answer|answers|đáp.?án)(?:[\s_.-]|$)/i.test(file.name));
      if (!hasNamedKey && bookDocument.numPages < keyDocument.numPages) {
        assigned = { book: assigned.key, key: assigned.book };
        [bookDocument, keyDocument] = [keyDocument, bookDocument];
      }
      documentsRef.current = { book: bookDocument, key: keyDocument };
      const [bookSheets, keySheets] = await Promise.all([
        pdf.createListeningPdfHeaderSheets(bookDocument, 'book'),
        pdf.createListeningPdfHeaderSheets(keyDocument, 'key'),
      ]);
      const [bookSources, keySources] = await Promise.all([
        Promise.all(bookSheets.map(file => listeningApi.uploadPdfTemporarySource(token, file))),
        Promise.all(keySheets.map(file => listeningApi.uploadPdfTemporarySource(token, file))),
      ]);
      const result = await listeningApi.createPdfManifest(token, {
        bookSourceTokens: bookSources.map(source => source.token),
        keySourceTokens: keySources.map(source => source.token),
        bookPageCount: bookDocument.numPages,
        keyPageCount: keyDocument.numPages,
        preferredProvider: providerId as ListeningSmartImportProviderPreference,
      });
      setManifest(result);
      setSelectedTests(new Set(result.tests.map(test => test.testNumber)));
      const rows = result.tests.map<ListeningPdfTestProgress>(test => ({
        testNumber: test.testNumber,
        title: test.title,
        parts: PARTS.map(part => ({ part, status: 'queued' })),
      }));
      setProgress(rows);
      statusesRef.current = new Map(rows.map(test => [
        test.testNumber,
        new Map(test.parts.map(part => [part.part, part.status])),
      ]));
      setMessage({ text: `Đã nhận diện ${result.tests.length} Test. Hãy kiểm tra trang trước khi tạo bản nháp.` });
    } catch (reason: any) {
      const detail = Array.isArray(reason?.details) ? String(reason.details[0] || '').trim() : '';
      const primary = reason?.message || 'Không thể nhận diện cấu trúc hai file PDF.';
      setMessage({ text: detail && detail !== primary ? `${primary} Chi tiết: ${detail}` : primary, error: true });
    } finally {
      setMapping(false);
    }
  };

  const uploadTemporarySources = async (part: ListeningSmartImportPartId, question: File, key: File) => {
    const roles = part === 1 || part === 5
      ? [
          { role: 'question' as const, file: question },
          { role: 'answer_key' as const, file: key },
          { role: 'position_key' as const, file: key },
        ]
      : [
          { role: 'question' as const, file: question },
          { role: 'answer_key' as const, file: key },
        ];
    return Promise.all(roles.map(async source => ({
      role: source.role,
      transientToken: (await listeningApi.uploadPdfTemporarySource(token, source.file)).token,
    })));
  };

  const getQuestionFile = async (context: ImportContext, test: ListeningPdfManifestTest, part: ListeningSmartImportPartId) => {
    const cached = context.questionFiles.get(part);
    if (cached) return cached;
    const documents = documentsRef.current;
    if (!documents) throw new Error('Phiên đọc PDF không còn khả dụng. Vui lòng chọn lại file.');
    const pdf = await import('./pdfProcessing');
    const file = await pdf.renderListeningPdfPages(
      documents.book,
      test.bookPages[part],
      `test-${test.testNumber}-part-${part}.jpg`,
    );
    context.questionFiles.set(part, file);
    return file;
  };

  const getKeyFile = async (context: ImportContext, test: ListeningPdfManifestTest) => {
    if (context.keyFile) return context.keyFile;
    const documents = documentsRef.current;
    if (!documents) throw new Error('Phiên đọc PDF không còn khả dụng. Vui lòng chọn lại file.');
    const pdf = await import('./pdfProcessing');
    context.keyFile = await pdf.renderListeningPdfPages(
      documents.key,
      [test.keySummaryPage],
      `test-${test.testNumber}-answer-key.jpg`,
    );
    return context.keyFile;
  };

  const analyzePart = async (
    context: ImportContext,
    test: ListeningPdfManifestTest,
    part: ListeningSmartImportPartId,
  ) => {
    const currentPart = context.content.parts[part - 1];
    const [questionFile, keyFile] = await Promise.all([
      getQuestionFile(context, test, part),
      getKeyFile(context, test),
    ]);
    const sources = await uploadTemporarySources(part, questionFile, keyFile);
    const basePartHash = await hashListeningPart(currentPart);
    const candidate = await listeningApi.analyzeSmartImport(token, {
      moduleId: 'mover',
      part,
      sources,
      currentPart,
      basePartHash,
      preferredProvider: providerId as ListeningSmartImportProviderPreference,
    });
    if (candidate.basePartHash !== basePartHash || candidate.part !== part || candidate.data.part !== part) {
      throw new Error(`Kết quả AI Part ${part} không còn khớp bản nháp hiện tại.`);
    }
    return { candidate, questionFile };
  };

  const importPart4 = async (
    currentPart: ListeningPart4,
    candidate: ListeningSmartImportCandidate,
    questionFile: File,
    testNumber: number,
  ) => {
    if (candidate.data.part !== 4) throw new Error('Dữ liệu phân tích không đúng Part 4.');
    const groups = await withObjectUrl(questionFile, async url => {
      const frames = await detectPart4Frames(url);
      const sixGroups = groupPart4Frames(frames, 6);
      return sixGroups.length === 6 ? sixGroups : groupPart4Frames(frames, 5);
    });
    const hasExample = groups.length === 6;
    if (groups.length !== 5 && groups.length !== 6) {
      return {
        part: applyPart4Analysis(
          currentPart,
          candidate.data,
          currentPart.questions.map(question => question.options.map(option => option.imageAssetId)),
          currentPart.example?.options.map(option => option.imageAssetId),
        ),
        warning: 'Không dò đủ 15/18 khung ảnh Part 4; đã giữ nguyên ảnh lựa chọn để giáo viên bổ sung thủ công.',
      };
    }
    const uploadGroup = async (crops: SmartImportCrop[], prefix: string) => withObjectUrl(questionFile, async url => (
      Promise.all(crops.map(async (crop, index) => {
        const file = await cropListeningImage(url, crop, `${prefix}-${String.fromCharCode(65 + index)}.png`);
        return (await listeningApi.uploadAsset(token, file, 'image')).id;
      }))
    ));
    const questionGroups = groups.slice(hasExample ? 1 : 0);
    const questionAssetIds: string[][] = [];
    for (let index = 0; index < questionGroups.length; index += 1) {
      questionAssetIds.push(await uploadGroup(questionGroups[index], `test-${testNumber}-part-4-q${index + 1}`));
    }
    const exampleAssetIds = hasExample
      ? await uploadGroup(groups[0], `test-${testNumber}-part-4-example`)
      : undefined;
    const normalizedData = {
      ...candidate.data,
      ...(hasExample ? {
        example: {
          prompt: candidate.data.example?.prompt || currentPart.example?.prompt || 'Example',
          crops: groups[0],
          correctOptionIndex: candidate.data.example?.correctOptionIndex,
        },
      } : {}),
      questions: ([1, 2, 3, 4, 5] as const).map((questionNumber, index) => {
        const analyzed = candidate.data.part === 4
          ? candidate.data.questions.find(question => question.questionNumber === questionNumber)
          : undefined;
        return {
          questionNumber,
          prompt: analyzed?.prompt || currentPart.questions[index].prompt,
          crops: questionGroups[index],
          correctOptionIndex: analyzed?.correctOptionIndex,
          answerSource: analyzed?.answerSource || 'current-part' as const,
        };
      }),
    };
    return {
      part: applyPart4Analysis(currentPart, normalizedData, questionAssetIds, exampleAssetIds),
    };
  };

  const mergeCandidate = async (
    context: ImportContext,
    test: ListeningPdfManifestTest,
    partNumber: ListeningSmartImportPartId,
    candidate: ListeningSmartImportCandidate,
    questionFile: File,
  ) => {
    const currentPart = context.content.parts[partNumber - 1];
    let nextPart: ListeningSetContent['parts'][number];
    let forcedWarning = '';
    if (partNumber === 1 && candidate.data.part === 1) {
      const sceneAssetId = (await listeningApi.uploadAsset(token, questionFile, 'image')).id;
      nextPart = importPart1Analysis(currentPart as ListeningPart1, candidate.data, sceneAssetId);
    } else if (partNumber === 2 && candidate.data.part === 2) {
      let imported = importPart2Analysis(currentPart as ListeningPart2, candidate.data);
      if (candidate.data.illustrationCrop) {
        const illustrationAssetId = await withObjectUrl(questionFile, async url => {
          const file = await cropListeningImage(
            url,
            candidate.data.part === 2 ? candidate.data.illustrationCrop! : { x: 0, y: 0, width: 1, height: 1 },
            `test-${test.testNumber}-part-2-illustration.png`,
          );
          return (await listeningApi.uploadAsset(token, file, 'image')).id;
        });
        imported = { ...imported, illustrationAssetId };
      }
      nextPart = imported;
    } else if (partNumber === 3 && candidate.data.part === 3) {
      const boardAssetId = (await listeningApi.uploadAsset(token, questionFile, 'image')).id;
      nextPart = applyPart3ConnectAnalysis(currentPart as ListeningPart3, candidate.data, boardAssetId);
    } else if (partNumber === 4 && candidate.data.part === 4) {
      const imported = await importPart4(currentPart as ListeningPart4, candidate, questionFile, test.testNumber);
      nextPart = imported.part;
      forcedWarning = imported.warning || '';
    } else if (partNumber === 5 && candidate.data.part === 5) {
      const sceneAssetId = (await listeningApi.uploadAsset(token, questionFile, 'image')).id;
      nextPart = applyPart5SceneAnalysis(currentPart as ListeningPart5, candidate.data, sceneAssetId);
      forcedWarning = 'Part 5 cần giáo viên vẽ/xác nhận vùng tương tác và bổ sung icon trước khi xuất bản.';
    } else {
      throw new Error(`Kết quả AI không đúng Part ${partNumber}.`);
    }
    return { nextPart, forcedWarning };
  };

  const processPart = async (context: ImportContext, test: ListeningPdfManifestTest, part: ListeningSmartImportPartId) => {
    setPartStatus(test.testNumber, part, 'running', { message: undefined, warnings: undefined });
    try {
      const { candidate, questionFile } = await analyzePart(context, test, part);
      const { nextPart, forcedWarning } = await mergeCandidate(context, test, part, candidate, questionFile);
      const nextContent = updateTuplePart(context.content, part, nextPart);
      const saved = await listeningApi.updateSet(token, context.id, nextContent, 'draft', context.revision);
      context.content = saved.draftContent || nextContent;
      context.revision = Number(saved.draftRevision);
      const warnings = [...candidate.warnings, ...(forcedWarning ? [forcedWarning] : [])];
      setPartStatus(test.testNumber, part, warnings.length ? 'needs_review' : 'completed', {
        message: warnings[0],
        warnings,
      });
    } catch (reason: any) {
      const detail = Array.isArray(reason?.details) ? String(reason.details[0] || '').trim() : '';
      setPartStatus(test.testNumber, part, 'failed', {
        message: detail || reason?.message || `Không thể nhập Part ${part}.`,
      });
    }
  };

  const ensureContext = async (test: ListeningPdfManifestTest) => {
    const existing = contextsRef.current.get(test.testNumber);
    if (existing) return existing;
    const content = {
      ...createDefaultMoverListeningContent(),
      title: test.title || `Movers Listening Test ${test.testNumber}`,
      description: `Bản nháp nhập từ PDF · Test ${test.testNumber}. Cần kiểm tra và gắn audio trước khi xuất bản.`,
    };
    const created = await listeningApi.createSet(token, content);
    const context: ImportContext = {
      id: created.id,
      revision: Number(created.draftRevision || 1),
      content: created.draftContent || content,
      questionFiles: new Map(),
    };
    contextsRef.current.set(test.testNumber, context);
    setDraftId(test.testNumber, created.id);
    return context;
  };

  const runImport = async (testNumbers: number[], onlyFailed = false) => {
    if (!manifest || running) return;
    setRunning(true);
    setMessage(undefined);
    try {
      const tests = manifest.tests.filter(test => testNumbers.includes(test.testNumber));
      await mapWithConcurrency<ListeningPdfManifestTest>(tests, 2, async (test: ListeningPdfManifestTest) => {
        const requestedParts = PARTS.filter(part => {
          const status = statusesRef.current.get(test.testNumber)?.get(part);
          return onlyFailed ? status === 'failed' : status === 'queued';
        });
        if (!requestedParts.length) return;
        let context: ImportContext;
        try {
          context = await ensureContext(test);
        } catch (reason: any) {
          requestedParts.forEach(part => setPartStatus(test.testNumber, part, 'failed', {
            message: reason?.message || 'Không thể tạo bản nháp cho Test này.',
          }));
          return;
        }
        for (const part of requestedParts) await processPart(context, test, part);
      });
      await onCompleted();
      setMessage({ text: 'Đã hoàn tất lượt nhập. Các bản nháp chưa được xuất bản; hãy mở từng bộ để kiểm tra và gắn audio.' });
    } catch (reason: any) {
      setMessage({ text: reason?.message || 'Lượt nhập PDF chưa thể hoàn tất.', error: true });
    } finally {
      setRunning(false);
    }
  };

  const failedTests = progress.filter(test => test.parts.some(part => part.status === 'failed')).map(test => test.testNumber);
  const hasSelectedQueuedPart = progress.some(test => selectedTests.has(test.testNumber)
    && test.parts.some(part => part.status === 'queued'));
  const canAnalyze = files.length === 2 && !mapping && !running && Boolean(providerId);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm">
      <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-slate-200 p-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[.16em] text-blue-600">Nhập nhanh Movers Listening</p>
            <h3 className="mt-1 text-xl font-black text-slate-900">Tạo bản nháp từ PDF đề bài + đáp án</h3>
            <p className="mt-1 text-sm text-slate-500">PDF được xử lý trong trình duyệt; máy chủ chỉ nhận ảnh tạm để phân tích và tự xóa sau khi dùng.</p>
          </div>
          <button type="button" aria-label="Đóng nhập PDF" disabled={running || mapping} onClick={onClose} className="rounded-xl border border-slate-200 p-2 disabled:opacity-40">
            <X size={19} />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <section
            onDragOver={event => event.preventDefault()}
            onDrop={event => {
              event.preventDefault();
              void replaceFiles(Array.from(event.dataTransfer.files));
            }}
            className="rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/40 p-5"
          >
            <input ref={inputRef} className="hidden" type="file" accept="application/pdf,.pdf" multiple onChange={event => void replaceFiles(Array.from(event.target.files || []))} />
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-3">
                <UploadCloud className="mt-0.5 text-blue-600" size={26} />
                <div>
                  <p className="font-black text-slate-900">Thả cùng lúc 2 file PDF vào đây</p>
                  <p className="text-sm text-slate-600">Một file sách đề và một file đáp án. Không lưu PDF gốc lên máy chủ.</p>
                  {files.length === 2 && (
                    <div className="mt-3 space-y-1 text-xs font-bold text-slate-700">
                      {files.map(file => <p key={`${file.name}-${file.size}`} className="flex items-center gap-2"><FileText size={14} /> {file.name}</p>)}
                    </div>
                  )}
                </div>
              </div>
              <button type="button" disabled={running || mapping} onClick={() => inputRef.current?.click()} className="rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-black text-blue-700 disabled:opacity-40">
                Chọn 2 file PDF
              </button>
            </div>
          </section>

          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
            <label className="space-y-1">
              <span className="text-xs font-black text-slate-700">Nguồn AI xử lý</span>
              <select value={providerId} onChange={event => setProviderId(event.target.value)} disabled={mapping || running || Boolean(manifest)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold">
                {!enabledProviders.length && <option value="">Không có provider thị giác khả dụng</option>}
                {enabledProviders.map(provider => <option key={provider.id} value={provider.id}>{provider.label}</option>)}
              </select>
            </label>
            <button type="button" disabled={!canAnalyze} onClick={() => void analyzeFiles()} className="self-end rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-black text-white disabled:opacity-40">
              {mapping ? <span className="inline-flex items-center gap-2"><LoaderCircle className="animate-spin" size={16} /> Đang đọc cấu trúc…</span> : '1. Đọc và lập bản đồ'}
            </button>
          </div>

          {capability?.visionEnabled === false && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">{capability.reason || 'AI thị giác chưa được cấu hình.'}</div>
          )}
          {message && <div className={`rounded-xl border p-3 text-sm font-bold ${message.error ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{message.text}</div>}

          {manifest && (
            <section className="space-y-3 rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-black text-slate-900">Bản đồ trang đã nhận diện</p>
                  <p className="text-xs font-semibold text-slate-500">Kiểm tra nhanh trước khi tạo draft. Không có thao tác xuất bản tự động.</p>
                </div>
                <button type="button" disabled={running || !selectedTests.size || !hasSelectedQueuedPart} onClick={() => void runImport([...selectedTests])} className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white disabled:opacity-40">
                  {running ? <span className="inline-flex items-center gap-2"><LoaderCircle className="animate-spin" size={16} /> Đang tạo bản nháp…</span> : `2. Tạo ${selectedTests.size} bản nháp`}
                </button>
              </div>
              {manifest.warnings.length > 0 && (
                <div className="rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-800">{manifest.warnings.join(' · ')}</div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500">
                    <tr><th className="p-3">Chọn</th><th className="p-3">Test</th>{PARTS.map(part => <th key={part} className="p-3">Part {part}</th>)}<th className="p-3">Trang đáp án</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {manifest.tests.map(test => (
                      <tr key={test.testNumber}>
                        <td className="p-3"><input type="checkbox" disabled={running || Boolean(contextsRef.current.get(test.testNumber))} checked={selectedTests.has(test.testNumber)} onChange={event => setSelectedTests(previous => {
                          const next = new Set(previous);
                          if (event.target.checked) next.add(test.testNumber); else next.delete(test.testNumber);
                          return next;
                        })} /></td>
                        <td className="p-3 font-black text-slate-900">{test.title}</td>
                        {PARTS.map(part => <td key={part} className="p-3 font-bold text-slate-600">{test.bookPages[part].join('–')}</td>)}
                        <td className="p-3 font-bold text-slate-600">{test.keySummaryPage}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {progress.some(test => test.draftId || test.parts.some(part => part.status !== 'queued')) && (
            <section className="space-y-3 rounded-2xl border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <div><p className="font-black text-slate-900">Tiến độ tạo bản nháp</p><p className="text-xs font-semibold text-slate-500">Mỗi Test chạy Parts 1→5; tối đa hai Test chạy song song.</p></div>
                {failedTests.length > 0 && <button type="button" disabled={running} onClick={() => void runImport(failedTests, true)} className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-3 py-2 text-xs font-black text-rose-700 disabled:opacity-40"><RefreshCw size={14} /> Thử lại tất cả lỗi</button>}
              </div>
              <div className="space-y-3">
                {progress.map(test => (
                  <div key={test.testNumber} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3"><p className="font-black text-slate-900">{test.title}</p>{test.draftId && <span className="text-[11px] font-bold text-emerald-700">Đã tạo draft</span>}</div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-5">
                      {test.parts.map(part => (
                        <div key={part.part} className="rounded-lg bg-white p-2 shadow-sm" title={part.message}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-black">Part {part.part}</span>
                            {part.status === 'running' ? <LoaderCircle className="animate-spin text-blue-600" size={14} /> : part.status === 'failed' ? <AlertTriangle className="text-rose-600" size={14} /> : (part.status === 'completed' || part.status === 'needs_review') ? <CheckCircle2 className={part.status === 'completed' ? 'text-emerald-600' : 'text-amber-600'} size={14} /> : null}
                          </div>
                          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-black ${statusClass[part.status]}`}>{statusLabel[part.status]}</span>
                          {part.message && <p className="mt-1 line-clamp-2 text-[10px] font-semibold text-slate-500">{part.message}</p>}
                          {part.status === 'failed' && <button type="button" disabled={running} onClick={() => void runImport([test.testNumber], true)} className="mt-2 text-[10px] font-black text-blue-700 disabled:opacity-40">Thử lại phần lỗi</button>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
