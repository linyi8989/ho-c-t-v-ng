import { CheckCircle2, ClipboardCopy, Crop, FileJson, Image as ImageIcon, LoaderCircle, Music2, Upload, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { ListeningRegionEditor } from '../../listening/admin/ListeningRegionEditor';
import { ListeningAssetPicker } from '../../listening/admin/ListeningAssetPicker';
import FileDropPasteInput from '../../listening/shared/FileDropPasteInput';
import { listeningApi } from '../../listening/api';
import type { ListeningAsset } from '../../listening/types';
import { cropListeningImage } from '../../listening-editor/smart-import/cropImage';
import VisualCropEditor from '../../listening-editor/smart-import/VisualCropEditor';
import type { SmartImportCrop } from '../../listening-editor/smart-import/types';
import FixedRegionEditor from '../../listening-editor/regions/FixedRegionEditor';
import { detectPart4Frames } from '../../listening-editor/smart-import/part4FrameDetection';
import type { ExamPaperContent, ExamPaperDefinition, ExamPartContent } from '../types';
import {
  STARTER_MATCHING_HITBOX_HEIGHT,
  STARTER_MATCHING_HITBOX_WIDTH,
  starterMatchingAnchor,
  starterMatchingModel,
  starterMatchingSourceNodeId,
} from '../starterMatching';
import { groupStarterPart3OptionCrops } from '../starterPart3Crops';
import { buildStarterListeningBundlePrompt } from '../starterImportPrompt';
import { joinStarterPart2ExampleLines, starterPart2ExampleEditorLines } from '../starterListeningPart2';
import { examPartUnits, replaceExamPartUnit } from '../examStructure';
import {
  STARTER_BASIC_COLOURS,
  importStarterExamBundle,
  importStarterSinglePart,
  starterColourValue,
  type StarterImportPartReport,
} from '../starterImport';

const fieldClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100';

async function copyStarterPrompt(value: string) {
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const fallback = document.createElement('textarea');
    fallback.value = value;
    fallback.readOnly = true;
    fallback.style.position = 'fixed';
    fallback.style.left = '-9999px';
    document.body.appendChild(fallback);
    let copied = false;
    try {
      fallback.select();
      copied = document.execCommand('copy');
    } finally {
      fallback.remove();
    }
    if (!copied) window.prompt('Nhấn Ctrl+C để sao chép prompt JSON tổng:', value);
    return copied;
  }
}

export function replaceStarterPartImage(part: ExamPartContent, asset?: ListeningAsset): ExamPartContent {
  const changed = part.imageAssetId !== asset?.id;
  let next: ExamPartContent = { ...part, imageAssetId: asset?.id, imageUrl: asset?.url };
  if (!changed) return next;
  if (next.interactionLayout?.kind === 'starter-image-matching-v1') {
    next = {
      ...next,
      interactionLayout: {
        ...next.interactionLayout,
        leftItems: next.interactionLayout.leftItems.map(item => ({ ...item, geometryConfirmedByTeacher: false })),
        rightItems: next.interactionLayout.rightItems.map(item => ({ ...item, geometryConfirmedByTeacher: false })),
      },
    };
  }
  if (next.interactionLayout?.kind === 'starter-image-matching-v2') {
    next = {
      ...next,
      interactionLayout: {
        ...next.interactionLayout,
        sourceNodes: next.interactionLayout.sourceNodes.map(node => ({ ...node, geometryConfirmedByTeacher: false })),
        targetNodes: next.interactionLayout.targetNodes.map(node => ({ ...node, geometryConfirmedByTeacher: false })),
      },
    };
  }
  if (next.interactionLayout?.kind === 'starter-scene-colour-v1') {
    next = {
      ...next,
      interactionLayout: {
        ...next.interactionLayout,
        targets: next.interactionLayout.targets.map(target => ({ ...target, geometryConfirmedByTeacher: false })),
      },
    };
  }
  if (next.interactionLayout?.kind === 'scene-draw-v1') {
    next = {
      ...next,
      interactionLayout: {
        ...next.interactionLayout,
        targets: next.interactionLayout.targets.map(target => ({ ...target, geometryConfirmedByTeacher: false })),
      },
    };
  }
  if (next.interactionLayout?.kind === 'image-text-entry-v1') {
    next = {
      ...next,
      interactionLayout: {
        ...next.interactionLayout,
        targets: next.interactionLayout.targets.map(target => ({ ...target, geometryConfirmedByTeacher: false })),
      },
    };
  }
  if (next.interaction?.variant === 'image-options') {
    next = {
      ...next,
      questions: next.questions.map(question => ({
        ...question,
        options: question.options.map(option => {
          const { imageAssetId: _imageAssetId, imageUrl: _imageUrl, ...rest } = option;
          return rest;
        }),
      })),
    };
  }
  return next;
}

function JsonSource({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return <>
    <textarea value={value} onChange={event => onChange(event.target.value)} className={`min-h-44 font-mono ${fieldClass}`} placeholder='Dán JSON exam-bundle-import-v1 hoặc JSON của một Part…' />
    <div className="mt-2 flex flex-wrap gap-2">
      <button type="button" onClick={() => inputRef.current?.click()} className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs font-black text-violet-700"><Upload size={14} />Tải file JSON</button>
      <input ref={inputRef} type="file" accept="application/json,.json,.txt" className="hidden" onChange={event => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        file.text().then(onChange).catch(() => undefined);
      }} />
    </div>
  </>;
}

const reportClass: Record<StarterImportPartReport['status'], string> = {
  imported: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  error: 'border-rose-200 bg-rose-50 text-rose-800',
  missing: 'border-slate-200 bg-slate-50 text-slate-600',
};

export function StarterWholeImportPanel({
  content,
  definition,
  onChange,
  onImported,
  onMessage,
}: {
  content: ExamPaperContent;
  definition: ExamPaperDefinition;
  onChange: (content: ExamPaperContent) => void;
  onImported: () => void;
  onMessage: (message: { text: string; error?: boolean }) => void;
}) {
  const [source, setSource] = useState('');
  const [reports, setReports] = useState<StarterImportPartReport[]>([]);
  const [promptCopied, setPromptCopied] = useState(false);
  return <details open className="rounded-2xl border border-violet-200 bg-violet-50 p-4" id="starter-whole-json-import">
    <summary className="cursor-pointer text-sm font-black text-violet-900"><FileJson size={16} className="mr-2 inline" />Nhập JSON tổng</summary>
    <p className="mt-2 text-xs font-semibold leading-5 text-violet-800">Một JSON tạo toàn bộ Part của paper này. Part lỗi được giữ nguyên để nhập lại riêng; không có thao tác xuất bản tự động.</p>
    <button type="button" data-starter-action="copy-whole-json-prompt" onClick={async () => {
      const copied = await copyStarterPrompt(buildStarterListeningBundlePrompt(content));
      if (!copied) return;
      setPromptCopied(true);
      onMessage({ text: 'Đã sao chép prompt JSON tổng. Hãy dán vào ChatGPT Web và đính kèm ảnh/PDF đề cùng official answer key.' });
      window.setTimeout(() => setPromptCopied(false), 2200);
    }} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-violet-300 bg-white px-4 py-2.5 text-xs font-black text-violet-800"><ClipboardCopy size={15} />{promptCopied ? 'Đã sao chép prompt tổng' : 'Sao chép prompt gửi ChatGPT'}</button>
    <div className="mt-3"><JsonSource value={source} onChange={setSource} /></div>
    <button type="button" data-starter-action="import-whole" onClick={() => {
      try {
        const result = importStarterExamBundle(content, source, definition);
        onChange(result.content);
        setReports(result.reports);
        onImported();
        onMessage({ text: `Đã nhập ${result.appliedParts.length}/${definition.parts.length} Part. Hãy gắn media và xác nhận các vùng tương tác.` });
      } catch (reason: any) {
        onMessage({ text: reason?.message || 'JSON tổng Starters không hợp lệ.', error: true });
      }
    }} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-xs font-black text-white"><FileJson size={15} />Phân tích và tạo các Part</button>
    {reports.length > 0 && <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{reports.map(report => <div key={report.part} className={`rounded-xl border p-3 text-xs ${reportClass[report.status]}`}><p className="font-black">Part {report.part} · {report.questionCount} câu</p><p className="mt-1 font-semibold">{report.status === 'imported' ? 'Đã nhập' : report.status === 'warning' ? 'Cần xem lại' : report.status === 'missing' ? 'Không có trong JSON' : 'Lỗi'}</p>{[...report.errors, ...report.warnings].slice(0, 2).map((message, index) => <p key={index} className="mt-1 text-[10px]">{message}</p>)}</div>)}</div>}
  </details>;
}

export function StarterPartImportPanel({
  content,
  definition,
  partIndex,
  onChange,
  onMessage,
}: {
  content: ExamPaperContent;
  definition: ExamPaperDefinition;
  partIndex: number;
  onChange: (part: ExamPartContent) => void;
  onMessage: (message: { text: string; error?: boolean }) => void;
}) {
  const [source, setSource] = useState('');
  return <details className="rounded-2xl border border-violet-200 bg-violet-50 p-4" data-starter-part-import={partIndex + 1}>
    <summary className="cursor-pointer text-sm font-black text-violet-900"><FileJson size={16} className="mr-2 inline" />Nhập lại JSON Part {partIndex + 1}</summary>
    <p className="mt-2 text-xs font-semibold text-violet-800">Nhận object <code>section</code> hoặc JSON tổng. Chỉ Part {partIndex + 1} được thay đổi.</p>
    <div className="mt-3"><JsonSource value={source} onChange={setSource} /></div>
    <button type="button" data-starter-action="import-part" onClick={() => {
      try {
        const result = importStarterSinglePart(content, partIndex, source, definition);
        onChange(result.part);
        onMessage({ text: `Đã nhập Part ${partIndex + 1}.${result.warnings.length ? ` ${result.warnings.length} mục cần xem lại.` : ''}` });
      } catch (reason: any) {
        onMessage({ text: reason?.message || `JSON Part ${partIndex + 1} không hợp lệ.`, error: true });
      }
    }} className="mt-3 rounded-xl bg-violet-700 px-4 py-2.5 text-xs font-black text-white">Kiểm tra và nhập Part này</button>
  </details>;
}

export function StarterQuickAssetPanel({
  token,
  content,
  assets,
  onAsset,
  onChange,
}: {
  token: string;
  content: ExamPaperContent;
  assets: ListeningAsset[];
  onAsset: (asset: ListeningAsset) => void;
  onChange: (content: ExamPaperContent) => void;
}) {
  const [requestedPartNumber, setPartNumber] = useState(1);
  const partNumber = Math.max(1, Math.min(requestedPartNumber, content.parts.length || 1));
  const selectedPartNumber = partNumber;
  const part = content.parts[selectedPartNumber - 1];
  if (!part) return null;
  const attach = (asset: ListeningAsset) => {
    onAsset(asset);
    onChange({
      ...content,
      parts: content.parts.map((item, index) => index === selectedPartNumber - 1 ? asset.kind === 'image'
        ? replaceStarterPartImage(item, asset)
        : { ...item, audioAssetId: asset.id, audioUrl: asset.url }
        : item),
    });
  };
  const upload = async (files: File[], kind: 'image' | 'audio') => {
    const asset = await listeningApi.uploadAsset(token, files[0], kind);
    attach(asset);
  };
  const activeImages = assets.filter(asset => asset.kind === 'image' && asset.status === 'active');
  const activeAudio = assets.filter(asset => asset.kind === 'audio' && asset.status === 'active');
  return <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4" id="starter-quick-assets">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-black text-sky-900">Ảnh và MP3 theo Part</p><p className="text-xs font-semibold text-sky-700">Tải, kéo thả hoặc dán ảnh; media được gắn vào Part đang chọn.</p></div><select value={selectedPartNumber} onChange={event => setPartNumber(Number(event.target.value))} className="rounded-xl border border-sky-200 bg-white px-3 py-2 text-xs font-black text-sky-800">{content.parts.map(item => <option key={item.part} value={item.part}>Part {item.part}</option>)}</select></div>
    <div className={`mt-3 grid gap-3 ${content.paperId === 'listening' ? 'lg:grid-cols-2' : ''}`}>
      <div className="rounded-xl bg-white p-3"><p className="mb-2 flex items-center gap-2 text-xs font-black text-slate-700"><ImageIcon size={15} />Ảnh Part {partNumber}</p><select value={part.imageAssetId || ''} onChange={event => { const asset = activeImages.find(item => item.id === event.target.value); if (asset) attach(asset); }} className={fieldClass}><option value="">Chưa chọn ảnh</option>{activeImages.map(asset => <option key={asset.id} value={asset.id}>{asset.name || asset.id}</option>)}</select><div className="mt-2"><FileDropPasteInput accept="image/png,image/jpeg,image/webp" pasteImages uploadLabel="Tải ảnh" onFiles={files => upload(files, 'image')} /></div></div>
      {content.paperId === 'listening' && <div className="rounded-xl bg-white p-3"><p className="mb-2 flex items-center gap-2 text-xs font-black text-slate-700"><Music2 size={15} />MP3 Part {partNumber}</p><select value={part.audioAssetId || ''} onChange={event => { const asset = activeAudio.find(item => item.id === event.target.value); if (asset) attach(asset); }} className={fieldClass}><option value="">Chưa chọn MP3</option>{activeAudio.map(asset => <option key={asset.id} value={asset.id}>{asset.name || asset.id}</option>)}</select><div className="mt-2"><FileDropPasteInput accept="audio/mpeg,audio/mp3,.mp3" uploadLabel="Tải MP3" onFiles={files => upload(files, 'audio')} /></div></div>}
    </div>
  </div>;
}

const sameRegion = (first: unknown, second: unknown) => JSON.stringify(first) === JSON.stringify(second);

export function StarterTextEntryEditor({ part, onChange }: { part: ExamPartContent; onChange: (part: ExamPartContent) => void }) {
  const exampleLines = starterPart2ExampleEditorLines(part.passage);
  const updateExampleLine = (index: number, value: string) => onChange({
    ...part,
    passage: joinStarterPart2ExampleLines(exampleLines.map((line, lineIndex) => lineIndex === index ? value : line)),
  });
  const normalizeQuestion = (question: ExamPartContent['questions'][number], patch: Partial<ExamPartContent['questions'][number]> = {}) => {
    const merged = { ...question, ...patch };
    const {
      context: _context,
      imageAssetId: _imageAssetId,
      imageUrl: _imageUrl,
      interactionSourceNodeId: _interactionSourceNodeId,
      ...rest
    } = merged;
    return {
      ...rest,
      type: 'short-answer' as const,
      options: [],
      correctOptionIds: [],
    };
  };
  const updateQuestion = (questionIndex: number, patch: Partial<ExamPartContent['questions'][number]>) => onChange({
    ...part,
    questions: part.questions.map((question, index) => index === questionIndex ? normalizeQuestion(question, patch) : question),
  });
  return <div className="space-y-4" data-starter-special-editor="text-entry">
    <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
      <p className="text-sm font-black text-sky-950">Dạng điền ngắn · {part.questions.length} câu</p>
      <p className="mt-1 text-xs font-semibold leading-5 text-sky-800">Dạng câu được cố định là short-answer. Đặt <code>____</code> tại vị trí ô trống; nếu không có ký hiệu này, ô trả lời sẽ nằm cuối câu.</p>
    </div>
    <label className="block text-xs font-black text-slate-700">Tiêu đề nội dung<input value={part.title} onChange={event => onChange({ ...part, title: event.target.value })} className={`mt-1 ${fieldClass}`} placeholder="Ví dụ: THE LAKE CAFÉ" /></label>
    <section className="rounded-2xl border border-sky-200 bg-white p-4" data-starter-part2-example-editor>
      <p className="text-xs font-black text-slate-700">Hai example không chấm điểm</p>
      <p className="mt-1 text-[11px] font-semibold text-slate-500">Mỗi example là một câu riêng và sẽ hiển thị thành đúng hai dòng dưới ảnh.</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {exampleLines.map((line, index) => <label key={index} className="block text-xs font-black text-slate-700">Example {index + 1}<input value={line} onChange={event => updateExampleLine(index, event.target.value)} className={`mt-1 ${fieldClass}`} placeholder={index === 0 ? "What's the boy's name? — Sam." : 'How old is he? — 10.'} /></label>)}
      </div>
    </section>
    <div className="space-y-3">
      {part.questions.map((question, questionIndex) => <div key={question.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-black text-slate-800">Câu {questionIndex + 1}</p>
        <label className="mt-3 block text-xs font-black text-slate-700">Nội dung câu hỏi<textarea value={question.prompt} onChange={event => updateQuestion(questionIndex, { prompt: event.target.value })} className={`mt-1 min-h-16 ${fieldClass}`} /></label>
        <label className="mt-3 block text-xs font-black text-slate-700">Đáp án chấp nhận (ngăn cách bằng |)<input value={question.acceptedAnswers.join(' | ')} onChange={event => updateQuestion(questionIndex, { acceptedAnswers: event.target.value.split('|').map(answer => answer.trim()).filter(Boolean) })} className={`mt-1 ${fieldClass}`} /></label>
      </div>)}
    </div>
  </div>;
}

function StarterImageOptionsEditor({
  token,
  part,
  assets,
  onAssets,
  onChange,
}: {
  token: string;
  part: ExamPartContent;
  assets: ListeningAsset[];
  onAssets: (asset: ListeningAsset) => void;
  onChange: (part: ExamPartContent) => void;
}) {
  const [selection, setSelection] = useState<{ questionIndex: number; optionIndex: number } | null>(null);
  const [crop, setCrop] = useState<SmartImportCrop>({ x: 0, y: 0, width: 1, height: 1 });
  const [cropping, setCropping] = useState(false);
  const [batchCropping, setBatchCropping] = useState(false);
  const [batchNotice, setBatchNotice] = useState('');
  const latestPartRef = useRef(part);
  latestPartRef.current = part;
  const sourceAssetsRef = useRef(new Map<string, ListeningAsset>());
  assets.forEach(asset => sourceAssetsRef.current.set(asset.id, asset));
  const selectedQuestion = selection ? part.questions[selection.questionIndex] : undefined;
  const selectedOption = selection ? selectedQuestion?.options[selection.optionIndex] : undefined;
  const optionImageCount = part.questions.reduce((total, question) => total + question.options.filter(option => option.imageAssetId && option.imageUrl).length, 0);
  const updateQuestion = (questionIndex: number, next: ExamPartContent['questions'][number]) => onChange({
    ...part,
    questions: part.questions.map((question, index) => index === questionIndex ? next : question),
  });
  const attachOptionAsset = (questionIndex: number, optionIndex: number, asset: ListeningAsset) => {
    const question = part.questions[questionIndex];
    if (!question) return;
    onAssets(asset);
    updateQuestion(questionIndex, {
      ...question,
      options: question.options.map((option, index) => index === optionIndex
        ? { ...option, imageAssetId: asset.id, imageUrl: asset.url }
        : option),
    });
  };
  const uploadOptionImage = async (files: File[]) => {
    if (!selection || !files[0]) return;
    const asset = await listeningApi.uploadAsset(token, files[0], 'image');
    attachOptionAsset(selection.questionIndex, selection.optionIndex, asset);
  };
  const applyCrop = async () => {
    if (!selection || !part.imageAssetId || !part.imageUrl || !selectedOption) return;
    const currentSelection = { ...selection };
    setCropping(true);
    try {
      const file = await cropListeningImage(part.imageUrl, crop, `starter-part3-${currentSelection.questionIndex + 1}-${selectedOption.label}.png`);
      const asset = await listeningApi.uploadAsset(token, file, 'image', { derivedFromAssetId: part.imageAssetId, crop });
      attachOptionAsset(currentSelection.questionIndex, currentSelection.optionIndex, asset);
    } catch (reason: any) {
      window.alert(reason?.message || 'Không thể tạo ảnh crop cho lựa chọn này.');
    } finally {
      setCropping(false);
    }
  };
  const cropAllOptions = async () => {
    const sourceAssetId = part.imageAssetId;
    const sourceUrl = part.imageUrl;
    if (!sourceAssetId || !sourceUrl) return;
    setBatchCropping(true);
    setBatchNotice('Đang dò các khung ảnh A/B/C…');
    try {
      const detected = await detectPart4Frames(sourceUrl);
      const grouped = groupStarterPart3OptionCrops(detected);
      if (grouped.questionGroups.length !== 5 || grouped.questionGroups.some(group => group.length !== 3)) {
        throw new Error(`Chỉ nhận được ${detected.length} khung phù hợp; cần đủ 15 khung, hoặc 18 khung nếu trang có example.`);
      }
      const uploaded: ListeningAsset[][] = [];
      for (let questionIndex = 0; questionIndex < 5; questionIndex += 1) {
        const row: ListeningAsset[] = [];
        for (let optionIndex = 0; optionIndex < 3; optionIndex += 1) {
          if (latestPartRef.current.imageAssetId !== sourceAssetId) {
            throw new Error('Ảnh nguồn đã thay đổi trong lúc crop; đã dừng trước khi ghi đè Part mới.');
          }
          const optionLabel = String.fromCharCode(65 + optionIndex);
          const selectedCrop = grouped.questionGroups[questionIndex][optionIndex];
          const file = await cropListeningImage(sourceUrl, selectedCrop, `starter-part3-q${questionIndex + 1}-${optionLabel}.png`);
          const asset = await listeningApi.uploadAsset(token, file, 'image', { derivedFromAssetId: sourceAssetId, crop: selectedCrop });
          onAssets(asset);
          row.push(asset);
        }
        uploaded.push(row);
        setBatchNotice(`Đã crop và tải ${uploaded.length * 3}/15 ảnh…`);
      }
      const latestPart = latestPartRef.current;
      if (latestPart.imageAssetId !== sourceAssetId) throw new Error('Ảnh nguồn đã thay đổi trong lúc crop; không ghi đè Part mới.');
      onChange({
        ...latestPart,
        questions: latestPart.questions.map((question, questionIndex) => ({
          ...question,
          options: question.options.map((option, optionIndex) => ({
            ...option,
            imageAssetId: uploaded[questionIndex][optionIndex].id,
            imageUrl: uploaded[questionIndex][optionIndex].url,
          })),
        })),
      });
      setBatchNotice(grouped.detectedPrintedExample
        ? 'Đã bỏ qua 3 hình example và crop đủ 15 ảnh A/B/C cho câu 1–5.'
        : 'Đã crop đủ 15 ảnh A/B/C cho câu 1–5.');
    } catch (reason: any) {
      setBatchNotice(reason?.message || 'Không thể tự động crop toàn bộ ảnh Part 3.');
    } finally {
      setBatchCropping(false);
    }
  };

  return <div className="space-y-4" data-starter-special-editor="image-options">
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-black text-slate-900">Năm câu, mỗi câu ba lựa chọn ảnh</p>
      <p className="mt-1 text-xs font-semibold text-slate-600">Ảnh dưới đây chỉ dùng để dò/crop 15 đáp án A/B/C. Đây không phải ảnh hiển thị chung phía trên và không được gửi cho học sinh.</p>
      <div className="mt-3"><ListeningAssetPicker label="Ảnh nguồn chỉ dùng để crop 15 đáp án" kind="image" value={part.imageAssetId} assets={assets} allowedMimeTypes={['image/png', 'image/jpeg', 'image/webp']} onUpload={async file => {
        const asset = await listeningApi.uploadAsset(token, file, 'image');
        sourceAssetsRef.current.set(asset.id, asset);
        onAssets(asset);
        return asset;
      }} onChange={assetId => onChange(replaceStarterPartImage(part, sourceAssetsRef.current.get(assetId)))} /></div>
      <p className={`mt-3 rounded-xl border p-3 text-xs font-black ${optionImageCount === 15 ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>{optionImageCount === 15 ? 'Đã có đủ 15/15 ảnh hiển thị cho học sinh.' : `Hiện có ${optionImageCount}/15 ảnh; hãy chạy crop tự động hoặc bổ sung ảnh còn thiếu.`}</p>
      <button type="button" data-starter-action="crop-all-part3-options" disabled={batchCropping || !part.imageAssetId || !part.imageUrl} onClick={() => void cropAllOptions()} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50">{batchCropping ? <LoaderCircle size={15} className="animate-spin" /> : <Crop size={15} />}{batchCropping ? 'Đang crop 15 ảnh…' : 'Dò khung và crop toàn bộ 15 ảnh'}</button>
      {batchNotice && <p className={`mt-2 rounded-xl border p-3 text-xs font-bold ${batchNotice.startsWith('Đã') ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-sky-200 bg-sky-50 text-sky-800'}`}>{batchNotice}</p>}
      <div className="mt-3 space-y-3"><p className="text-xs font-black uppercase tracking-wide text-slate-500">Ảnh học sinh sẽ nhìn thấy</p>
        {part.questions.map((question, questionIndex) => <div key={question.id} className="rounded-xl bg-slate-50 p-3">
          <div className="grid items-center gap-2 sm:grid-cols-[36px_1fr]">
            <span className="text-xs font-black text-indigo-700">{questionIndex + 1}</span>
            <input value={question.prompt} onChange={event => updateQuestion(questionIndex, { ...question, prompt: event.target.value })} className={fieldClass} aria-label={`Nội dung câu ${questionIndex + 1}`} />
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {question.options.map((option, optionIndex) => <div key={option.id} className="rounded-xl border border-slate-200 bg-white p-2">
              {option.imageUrl ? <img src={option.imageUrl} alt="" className="mb-2 h-24 w-full rounded-lg object-contain" /> : <div className="mb-2 flex h-24 items-center justify-center rounded-lg border border-dashed border-slate-300 text-[10px] font-bold text-slate-400">Chưa có ảnh crop</div>}
              <div className="grid grid-cols-[26px_44px_1fr] items-center gap-1">
                <input type="radio" name={`starter-correct-${question.id}`} checked={question.correctOptionIds.includes(option.id)} onChange={() => updateQuestion(questionIndex, { ...question, correctOptionIds: [option.id] })} aria-label={`Đáp án đúng ${option.label}`} />
                <input value={option.label} onChange={event => updateQuestion(questionIndex, { ...question, options: question.options.map((item, index) => index === optionIndex ? { ...item, label: event.target.value.slice(0, 8) } : item) })} className={fieldClass} aria-label="Nhãn lựa chọn" />
                <input value={option.text} onChange={event => updateQuestion(questionIndex, { ...question, options: question.options.map((item, index) => index === optionIndex ? { ...item, text: event.target.value } : item) })} className={fieldClass} aria-label="Mô tả lựa chọn" />
              </div>
              <button type="button" aria-pressed={selection?.questionIndex === questionIndex && selection?.optionIndex === optionIndex} onClick={() => { setSelection({ questionIndex, optionIndex }); setCrop({ x: 0, y: 0, width: 1, height: 1 }); }} className="mt-2 w-full rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-2 text-[10px] font-black text-indigo-700"><Crop size={13} className="mr-1 inline" />Crop lại / thay ảnh {option.label}</button>
            </div>)}
          </div>
        </div>)}
      </div>
    </div>
    {selection && selectedOption && <div className="space-y-3 rounded-2xl border border-blue-200 bg-blue-50 p-4">
      <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-black text-blue-950">Crop lại ảnh câu {selection.questionIndex + 1} · lựa chọn {selectedOption.label}</p><p className="text-xs font-semibold text-blue-800">Chỉ dùng khi ảnh tự động crop chưa đúng. Kéo chọn trên ảnh nguồn rồi xác nhận, hoặc tải/dán một ảnh thay thế.</p></div><button type="button" onClick={() => setSelection(null)} className="shrink-0 rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-black text-blue-700">Đóng</button></div>
      {part.imageUrl ? <VisualCropEditor imageUrl={part.imageUrl} crop={crop} onChange={setCrop} /> : <p className="rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-800">Hãy gắn ảnh nguồn cho Part 3 trước khi crop.</p>}
      <div className="flex flex-wrap gap-2">
        <button type="button" data-starter-action="apply-crop" disabled={cropping || !part.imageAssetId || !part.imageUrl} onClick={() => void applyCrop()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white disabled:opacity-40">{cropping ? <LoaderCircle size={15} className="animate-spin" /> : <Crop size={15} />}{cropping ? 'Đang tạo crop…' : 'Dùng vùng crop này'}</button>
        <FileDropPasteInput accept="image/png,image/jpeg,image/webp" pasteImages uploadLabel="Tải/dán ảnh đã crop" onFiles={uploadOptionImage} />
      </div>
    </div>}
  </div>;
}

export function StarterSpecialPartEditor({ token, part, assets, onAssets, onChange }: { token: string; part: ExamPartContent; assets: ListeningAsset[]; onAssets: (asset: ListeningAsset) => void; onChange: (part: ExamPartContent) => void }) {
  if (part.interaction?.family === 'text-entry' && (part.interaction.variant === 'single-input' || (part.part === 2 && part.interaction.variant === 'inline-gap'))) {
    return <StarterTextEntryEditor part={part} onChange={onChange} />;
  }
  if (part.interaction?.variant === 'image-options') {
    return <StarterImageOptionsEditor token={token} part={part} assets={assets} onAssets={onAssets} onChange={onChange} />;
  }
  if (part.interactionLayout?.kind === 'starter-image-matching-v1' || part.interactionLayout?.kind === 'starter-image-matching-v2') {
    const originalLayout = part.interactionLayout;
    const layout = starterMatchingModel(originalLayout);
    const questionsWithSources = part.questions.map(question => ({
      ...question,
      ...(starterMatchingSourceNodeId(part, question.id) ? { interactionSourceNodeId: starterMatchingSourceNodeId(part, question.id) } : {}),
    }));
    const persist = (nextLayout = layout, nextQuestions = questionsWithSources) => onChange({
      ...part,
      questions: nextQuestions,
      interactionLayout: nextLayout,
    });
    const exampleSourceId = layout.exampleConnection?.sourceNodeId;
    const exampleTargetId = layout.exampleConnection?.targetNodeId;
    const scoredSourceIds = new Set(questionsWithSources.map(question => question.interactionSourceNodeId).filter(Boolean));
    const scoredTargetIds = new Set(questionsWithSources.flatMap(question => question.correctOptionIds));
    const editorItems = [
      ...layout.sourceNodes.map(node => ({ ...node, label: `Nguồn · ${node.label}`, region: node.hitRegion })),
      ...layout.targetNodes.map(node => ({ ...node, label: `Đích · ${node.label}`, region: node.hitRegion })),
    ];
    return <div className="space-y-4" data-starter-special-editor="matching">
      <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-sm font-black text-slate-900">Năm cặp nối được chấm</p><p className="mt-1 text-xs font-semibold text-slate-600">Nguồn và đích chỉ là hai nhóm logic; mọi hình nằm tự do trên cùng một ảnh.</p><div className="mt-3 space-y-2">{questionsWithSources.map((question, index) => <div key={question.id} className="grid items-center gap-2 rounded-xl bg-slate-50 p-2 sm:grid-cols-[36px_1fr_1fr]"><span className="text-xs font-black text-indigo-700">{index + 1}</span><input value={question.prompt} onChange={event => {
        const prompt = event.target.value;
        const sourceNodeId = question.interactionSourceNodeId;
        persist({ ...layout, sourceNodes: layout.sourceNodes.map(node => node.id === sourceNodeId ? { ...node, label: prompt } : node) }, questionsWithSources.map((item, itemIndex) => itemIndex === index ? { ...item, prompt } : item));
      }} className={fieldClass} aria-label={`Node nguồn câu ${index + 1}`} /><select value={question.correctOptionIds[0] || ''} onChange={event => persist(layout, questionsWithSources.map((item, itemIndex) => itemIndex === index ? { ...item, correctOptionIds: event.target.value ? [event.target.value] : [] } : item))} className={fieldClass}><option value="">Chưa có đáp án</option>{layout.targetNodes.filter(node => node.id !== exampleTargetId).map(node => <option key={node.id} value={node.id}>{node.label}</option>)}</select></div>)}</div></div>
      <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
        <p className="text-xs font-black text-sky-900">Đường mẫu đã in sẵn trên ảnh</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <select value={exampleSourceId || ''} onChange={event => persist({ ...layout, exampleConnection: { sourceNodeId: event.target.value, targetNodeId: exampleTargetId || '' } })} className={fieldClass} aria-label="Node nguồn của đường mẫu"><option value="">Chọn node nguồn mẫu</option>{layout.sourceNodes.filter(node => !scoredSourceIds.has(node.id) || node.id === exampleSourceId).map(node => <option key={node.id} value={node.id}>{node.label}</option>)}</select>
          <select value={exampleTargetId || ''} onChange={event => persist({ ...layout, exampleConnection: { sourceNodeId: exampleSourceId || '', targetNodeId: event.target.value } })} className={fieldClass} aria-label="Node đích của đường mẫu"><option value="">Chọn node đích mẫu</option>{layout.targetNodes.filter(node => !scoredTargetIds.has(node.id) || node.id === exampleTargetId).map(node => <option key={node.id} value={node.id}>{node.label}</option>)}</select>
        </div>
      </div>
      <div><p className="mb-2 text-xs font-black text-slate-700">Đặt 14 hitbox nhỏ vào giữa từng hình</p><div className="mb-2 flex flex-wrap gap-1 text-[10px] font-bold text-slate-600">{layout.sourceNodes.map((node, index) => <span key={node.id} className="rounded-full bg-indigo-50 px-2 py-1">{index + 1}. {node.label}</span>)}{layout.targetNodes.map((node, index) => <span key={node.id} className="rounded-full bg-emerald-50 px-2 py-1">{layout.sourceNodes.length + index + 1}. {node.label}</span>)}</div><FixedRegionEditor imageUrl={part.imageUrl} width={STARTER_MATCHING_HITBOX_WIDTH} height={STARTER_MATCHING_HITBOX_HEIGHT} items={editorItems} onChange={items => {
        const nextById = new Map(items.map(item => [item.id, item]));
        const updateNodes = (nodes: typeof layout.sourceNodes) => nodes.map(node => {
          const next = nextById.get(node.id);
          return next ? { ...node, hitRegion: next.region, anchor: starterMatchingAnchor(next.region), geometryConfirmedByTeacher: sameRegion(node.hitRegion, next.region) ? node.geometryConfirmedByTeacher : true } : node;
        });
        const sourceNodes = updateNodes(layout.sourceNodes);
        const targetNodes = updateNodes(layout.targetNodes);
        const confirmed = [...sourceNodes, ...targetNodes].every(node => node.geometryConfirmedByTeacher);
        onChange({ ...part, questions: questionsWithSources, interaction: part.interaction ? { ...part.interaction, schemaVersion: 2, importReadiness: confirmed && part.imageAssetId && part.audioAssetId ? 'ready-to-publish' : part.imageAssetId && part.audioAssetId ? 'needs-geometry' : 'needs-assets' } : part.interaction, interactionLayout: { ...layout, sourceNodes, targetNodes } });
      }} /><button type="button" data-starter-action="confirm-matching-geometry" onClick={() => {
        const confirmedLayout = { ...layout, sourceNodes: layout.sourceNodes.map(node => ({ ...node, geometryConfirmedByTeacher: true })), targetNodes: layout.targetNodes.map(node => ({ ...node, geometryConfirmedByTeacher: true })) };
        onChange({ ...part, questions: questionsWithSources, interaction: part.interaction ? { ...part.interaction, schemaVersion: 2, importReadiness: part.imageAssetId && part.audioAssetId ? 'ready-to-publish' : 'needs-assets' } : part.interaction, interactionLayout: confirmedLayout });
      }} className="mt-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white">Xác nhận 14 điểm neo hiện tại</button></div>
    </div>;
  }
  if (part.interactionLayout?.kind === 'starter-scene-colour-v1') {
    const layout = part.interactionLayout;
    const colourIdByName = new Map(part.questions.flatMap(question => question.options).map(option => [option.text.trim().toLocaleLowerCase('en'), option.id]));
    const palette = STARTER_BASIC_COLOURS.map((colour, index) => ({
      id: colourIdByName.get(colour) || `scene-colour-${crypto.randomUUID()}`,
      label: String.fromCharCode(65 + index),
      text: colour,
    }));
    const selectedColour = (question: ExamPartContent['questions'][number]) => {
      const selectedId = question.correctOptionIds[0];
      return question.options.find(option => option.id === selectedId)?.text.trim().toLocaleLowerCase('en') || '';
    };
    const updateColour = (questionIndex: number, colour: string) => {
      const selected = palette.find(option => option.text === colour);
      onChange({
        ...part,
        questions: part.questions.map((question, index) => {
          const currentColour = index === questionIndex ? colour : selectedColour(question);
          const correct = palette.find(option => option.text === currentColour);
          return {
            ...question,
            type: 'single-choice',
            options: palette.map(option => ({ ...option })),
            correctOptionIds: correct ? [correct.id] : [],
            acceptedAnswers: [],
          };
        }),
      });
    };
    return <div className="space-y-4" data-starter-special-editor="scene-colour">
      <div className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-sm font-black text-slate-900">{part.questions.length} yêu cầu tô màu</p><p className="mt-1 text-xs font-semibold text-slate-600">Giáo viên có thể sửa đáp án AI bằng danh sách 10 màu cơ bản.</p><div className="mt-3 space-y-2">{part.questions.map((question, index) => <div key={question.id} className="grid items-center gap-2 rounded-xl bg-slate-50 p-2 sm:grid-cols-[36px_1fr_180px]"><span className="text-xs font-black text-indigo-700">{index + 1}</span><input value={question.prompt} onChange={event => {
        const prompt = event.target.value;
        onChange({ ...part, questions: part.questions.map((item, itemIndex) => itemIndex === index ? { ...item, prompt } : item), interactionLayout: { ...layout, targets: layout.targets.map(target => target.questionId === question.id ? { ...target, label: prompt } : target) } });
      }} className={fieldClass} /><select aria-label={`Màu đúng câu ${index + 1}`} value={selectedColour(question)} onChange={event => updateColour(index, event.target.value)} className={fieldClass}><option value="">Chưa có màu</option>{STARTER_BASIC_COLOURS.map(colour => <option key={colour} value={colour}>{colour}</option>)}</select></div>)}</div></div>
      <div><p className="mb-2 text-xs font-black text-slate-700">Khoanh mask từng đối tượng; hệ thống hỗ trợ bám viền ảnh</p><ListeningRegionEditor imageUrl={part.imageUrl} edgeSnap freehandOnly items={layout.targets} onChange={items => {
        const nextById = new Map(items.map(item => [item.id, item]));
        const targets = layout.targets.map(target => {
          const next = nextById.get(target.id);
          return next ? { ...target, region: next.region, geometryConfirmedByTeacher: sameRegion(target.region, next.region) ? target.geometryConfirmedByTeacher : true } : target;
        });
        const confirmed = targets.every(target => target.geometryConfirmedByTeacher);
        onChange({ ...part, interaction: part.interaction ? { ...part.interaction, importReadiness: confirmed && part.imageAssetId && part.audioAssetId ? 'ready-to-publish' : part.imageAssetId && part.audioAssetId ? 'needs-geometry' : 'needs-assets' } : part.interaction, interactionLayout: { ...layout, targets } });
      }} /></div>
    </div>;
  }
  if (part.interactionLayout?.kind === 'scene-draw-v1') {
    const layout = part.interactionLayout;
    const uploadToken = async (file: File) => {
      const asset = await listeningApi.uploadAsset(token, file, 'image');
      onAssets(asset);
      return asset;
    };
    return <div className="space-y-4" data-starter-special-editor="scene-draw">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-sm font-black text-slate-900">{part.questions.length} yêu cầu vẽ thêm trên tranh</p>
        <p className="mt-1 text-xs font-semibold text-slate-600">Đây là thao tác draw, không phải tô màu. Sửa vật cần vẽ và mô tả vị trí trước khi xác nhận vùng đích.</p>
        <div className="mt-3 space-y-3">{part.questions.map((question, index) => {
          const target = layout.targets.find(item => item.questionId === question.id);
          if (!target) return null;
          return <div key={question.id} className="space-y-3 rounded-xl border border-sky-100 bg-slate-50 p-3">
            <div className="grid items-center gap-2 lg:grid-cols-[36px_1fr_180px_1fr]">
              <span className="text-xs font-black text-indigo-700">{index + 1}</span>
              <input aria-label={`Yêu cầu vẽ câu ${index + 1}`} value={question.prompt} onChange={event => onChange({ ...part, questions: part.questions.map(item => item.id === question.id ? { ...item, prompt: event.target.value } : item) })} className={fieldClass} />
              <input aria-label={`Vật cần vẽ câu ${index + 1}`} value={target.object} onChange={event => onChange({ ...part, interactionLayout: { ...layout, targets: layout.targets.map(item => item.id === target.id ? { ...item, object: event.target.value } : item) } })} className={fieldClass} placeholder="Ví dụ: flower" />
              <input aria-label={`Vị trí vẽ câu ${index + 1}`} value={target.label} onChange={event => onChange({ ...part, interactionLayout: { ...layout, targets: layout.targets.map(item => item.id === target.id ? { ...item, label: event.target.value } : item) } })} className={fieldClass} placeholder="Ví dụ: on the dog's head" />
            </div>
            <ListeningAssetPicker compact assets={assets} aiCapability={{ enabled: false, reason: 'Ảnh Draw do giáo viên tải lên và xác nhận.' }} onUpload={(file) => uploadToken(file)} allowedMimeTypes={['image/png']} label={`Ảnh PNG kéo thả · ${target.object || `câu ${index + 1}`}`} kind="image" value={target.tokenAssetId} onChange={(tokenAssetId, uploadedAsset) => {
              const selected = uploadedAsset || assets.find(asset => asset.id === tokenAssetId);
              onChange({ ...part, interactionLayout: { ...layout, targets: layout.targets.map(item => item.id === target.id ? { ...item, tokenAssetId: tokenAssetId || undefined, tokenUrl: selected?.url } : item) } });
            }} />
          </div>;
        })}</div>
      </div>
      <div><p className="mb-1 text-xs font-black text-slate-700">Đặt vùng đích riêng tư cho từng vật cần vẽ</p><p className="mb-2 text-[11px] font-semibold text-slate-500">Học sinh chỉ thấy yêu cầu và tranh; vùng này chỉ dùng để chấm vị trí, không được gửi xuống client.</p><ListeningRegionEditor imageUrl={part.imageUrl} rectangleOnly items={layout.targets.map(target => ({ id: target.id, label: `${target.object} · ${target.label}`, region: target.targetRegion }))} onChange={items => {
        const nextById = new Map(items.map(item => [item.id, item]));
        const targets = layout.targets.map(target => {
          const next = nextById.get(target.id);
          return next ? { ...target, targetRegion: next.region, geometryConfirmedByTeacher: sameRegion(target.targetRegion, next.region) ? target.geometryConfirmedByTeacher : true } : target;
        });
        const confirmed = targets.every(target => target.geometryConfirmedByTeacher);
        onChange({ ...part, interaction: part.interaction ? { ...part.interaction, importReadiness: confirmed && part.imageAssetId && part.audioAssetId ? 'ready-to-publish' : part.imageAssetId && part.audioAssetId ? 'needs-geometry' : 'needs-assets' } : part.interaction, interactionLayout: { ...layout, targets } });
      }} /></div>
    </div>;
  }
  return null;
}

function selectedStarterColour(question: ExamPartContent['questions'][number]) {
  const selectedId = question.correctOptionIds[0];
  return question.options.find(option => option.id === selectedId)?.text.trim().toLocaleLowerCase('en') || '';
}

function starterColourCatalog(unit: ExamPartContent) {
  const ids = new Map(unit.questions.flatMap(question => question.options).map(option => [option.text.trim().toLocaleLowerCase('en'), option.id]));
  return STARTER_BASIC_COLOURS.map((colour, index) => ({
    id: ids.get(colour) || `scene-colour-${crypto.randomUUID()}`,
    label: String.fromCharCode(65 + index),
    text: colour,
  }));
}

/** One Starters Part 4 authoring surface backed by the existing Colour and Draw blocks. */
export function StarterListeningPart4Editor({ token, part, assets, onAssets, onChange, pasteDrawTokens = false }: { token: string; part: ExamPartContent; assets: ListeningAsset[]; onAssets: (asset: ListeningAsset) => void; onChange: (part: ExamPartContent) => void; pasteDrawTokens?: boolean }) {
  const [activeRegion, setActiveRegion] = useState<{ kind: 'colour' | 'draw'; targetId: string }>();
  const units = examPartUnits(part);
  const colourUnits = units.filter(unit => unit.interactionLayout?.kind === 'starter-scene-colour-v1');
  const drawUnits = units.filter(unit => unit.interactionLayout?.kind === 'scene-draw-v1');
  const commit = (unit: ExamPartContent) => onChange(replaceExamPartUnit(part, unit));
  const uploadToken = async (file: File) => {
    const asset = await listeningApi.uploadAsset(token, file, 'image');
    onAssets(asset);
    return asset;
  };
  const updateColourAnswer = (unit: ExamPartContent, questionId: string, colour: string) => {
    const palette = starterColourCatalog(unit);
    commit({
      ...unit,
      questions: unit.questions.map(question => {
        const currentColour = question.id === questionId ? colour : selectedStarterColour(question);
        const correct = palette.find(option => option.text === currentColour);
        return { ...question, type: 'single-choice', options: palette.map(option => ({ ...option })), correctOptionIds: correct ? [correct.id] : [], acceptedAnswers: [] };
      }),
    });
  };
  const colourEntries = colourUnits.flatMap(unit => unit.questions.flatMap(question => {
    if (unit.interactionLayout?.kind !== 'starter-scene-colour-v1') return [];
    const target = unit.interactionLayout.targets.find(item => item.questionId === question.id);
    return target ? [{ kind: 'colour' as const, unit, question, target }] : [];
  }));
  const drawEntries = drawUnits.flatMap(unit => unit.questions.flatMap(question => {
    if (unit.interactionLayout?.kind !== 'scene-draw-v1') return [];
    const target = unit.interactionLayout.targets.find(item => item.questionId === question.id);
    return target ? [{ kind: 'draw' as const, unit, question, target }] : [];
  }));
  const actions = [...colourEntries, ...drawEntries].sort((left, right) => left.question.number - right.question.number);
  const correctColours = [...new Set(colourEntries.map(entry => selectedStarterColour(entry.question)).filter(Boolean))];
  const distractor = STARTER_BASIC_COLOURS.find(colour => !correctColours.includes(colour));
  const studentPalette = [...correctColours, ...(distractor ? [distractor] : [])];
  return <div className="space-y-4 rounded-2xl border border-sky-200 bg-sky-50/50 p-4" data-starter-special-editor="scene-colour-draw-unified">
    <div>
      <p className="text-sm font-black text-sky-950">Colour + Draw trên cùng một ảnh</p>
      <p className="mt-1 text-xs font-semibold text-sky-800">Sửa toàn bộ 5 yêu cầu tại đây. Colour và Draw dùng chung ảnh scene phía trên; dữ liệu kỹ thuật vẫn được lưu đúng dạng để chấm bài.</p>
    </div>
    <div className="space-y-3">{actions.map((entry, index) => {
      const isEditing = activeRegion?.kind === entry.kind && activeRegion.targetId === entry.target.id;
      const regionConfirmed = Boolean(entry.target.geometryConfirmedByTeacher);
      if (entry.kind === 'colour') return <div key={entry.question.id} className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
        <div className="grid items-center gap-2 lg:grid-cols-[42px_92px_1fr_180px_auto]">
          <span className="text-xs font-black text-indigo-700">{index + 1}</span>
          <span className="rounded-full bg-fuchsia-50 px-3 py-1 text-center text-[10px] font-black uppercase text-fuchsia-700">Colour</span>
          <input aria-label={`Yêu cầu tô màu câu ${index + 1}`} value={entry.question.prompt} onChange={event => {
            if (entry.unit.interactionLayout?.kind !== 'starter-scene-colour-v1') return;
            const prompt = event.target.value;
            commit({ ...entry.unit, questions: entry.unit.questions.map(question => question.id === entry.question.id ? { ...question, prompt } : question), interactionLayout: { ...entry.unit.interactionLayout, targets: entry.unit.interactionLayout.targets.map(target => target.questionId === entry.question.id ? { ...target, label: prompt } : target) } });
          }} className={fieldClass} />
          <select aria-label={`Màu đúng câu ${index + 1}`} value={selectedStarterColour(entry.question)} onChange={event => updateColourAnswer(entry.unit, entry.question.id, event.target.value)} className={fieldClass}><option value="">Chưa có màu</option>{STARTER_BASIC_COLOURS.map(colour => <option key={colour} value={colour}>{colour}</option>)}</select>
          <button type="button" onClick={() => setActiveRegion(isEditing ? undefined : { kind: 'colour', targetId: entry.target.id })} className={`rounded-xl border px-3 py-2.5 text-xs font-black ${isEditing ? 'border-blue-600 bg-blue-600 text-white' : regionConfirmed ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>{isEditing ? 'Đóng vùng tô' : regionConfirmed ? 'Chọn lại vùng để tô' : 'Chọn vùng để tô'}</button>
        </div>
        {isEditing && <div className="space-y-2 rounded-2xl border border-fuchsia-200 bg-fuchsia-50/40 p-3" data-starter-colour-region-editor>
          <div className="flex items-start justify-between gap-3"><p className="text-[11px] font-semibold text-fuchsia-800">Khoanh quanh đối tượng của câu này. Vùng được xác nhận chính là vùng đáp án nhận màu “{selectedStarterColour(entry.question) || 'chưa chọn'}”.</p><button type="button" onClick={() => setActiveRegion(undefined)} className="rounded-lg p-1 text-fuchsia-700" aria-label="Đóng chọn vùng tô"><X size={15} /></button></div>
          <ListeningRegionEditor imageUrl={part.imageUrl} edgeSnap freehandOnly items={[entry.target]} onChange={items => {
            if (entry.unit.interactionLayout?.kind !== 'starter-scene-colour-v1') return;
            const nextRegion = items[0]?.region;
            if (!nextRegion) return;
            const targets = entry.unit.interactionLayout.targets.map(target => target.id === entry.target.id ? { ...target, region: nextRegion, geometryConfirmedByTeacher: true } : target);
            const confirmed = targets.every(target => target.geometryConfirmedByTeacher);
            commit({ ...entry.unit, interaction: entry.unit.interaction ? { ...entry.unit.interaction, importReadiness: confirmed && part.imageAssetId && part.audioAssetId ? 'ready-to-publish' : part.imageAssetId && part.audioAssetId ? 'needs-geometry' : 'needs-assets' } : entry.unit.interaction, interactionLayout: { ...entry.unit.interactionLayout, targets } });
          }} />
        </div>}
      </div>;
      return <div key={entry.question.id} className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
        <div className="grid items-center gap-2 lg:grid-cols-[42px_92px_1fr_170px_1fr_auto]">
          <span className="text-xs font-black text-indigo-700">{index + 1}</span>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-center text-[10px] font-black uppercase text-emerald-700">Draw</span>
          <input aria-label={`Yêu cầu vẽ câu ${index + 1}`} value={entry.question.prompt} onChange={event => commit({ ...entry.unit, questions: entry.unit.questions.map(question => question.id === entry.question.id ? { ...question, prompt: event.target.value } : question) })} className={fieldClass} />
          <input aria-label={`Vật cần vẽ câu ${index + 1}`} value={entry.target.object} onChange={event => {
            if (entry.unit.interactionLayout?.kind !== 'scene-draw-v1') return;
            commit({ ...entry.unit, interactionLayout: { ...entry.unit.interactionLayout, targets: entry.unit.interactionLayout.targets.map(target => target.id === entry.target.id ? { ...target, object: event.target.value } : target) } });
          }} className={fieldClass} placeholder="Ví dụ: flower" />
          <input aria-label={`Vị trí vẽ câu ${index + 1}`} value={entry.target.label} onChange={event => {
            if (entry.unit.interactionLayout?.kind !== 'scene-draw-v1') return;
            commit({ ...entry.unit, interactionLayout: { ...entry.unit.interactionLayout, targets: entry.unit.interactionLayout.targets.map(target => target.id === entry.target.id ? { ...target, label: event.target.value } : target) } });
          }} className={fieldClass} placeholder="Ví dụ: on the dog's head" />
          <button type="button" onClick={() => setActiveRegion(isEditing ? undefined : { kind: 'draw', targetId: entry.target.id })} className={`rounded-xl border px-3 py-2.5 text-xs font-black ${isEditing ? 'border-blue-600 bg-blue-600 text-white' : regionConfirmed ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>{isEditing ? 'Đóng vùng đặt vật' : regionConfirmed ? 'Chọn lại vùng đặt vật' : 'Chọn vùng đặt vật'}</button>
        </div>
        <div className={`grid items-end gap-2 ${pasteDrawTokens ? 'lg:grid-cols-[1fr_auto]' : ''}`}>
          <ListeningAssetPicker compact assets={assets} aiCapability={{ enabled: false, reason: 'Ảnh Draw do giáo viên tải lên và xác nhận.' }} onUpload={uploadToken} allowedMimeTypes={['image/png']} label={`Ảnh PNG cần kéo · ${entry.target.object || `câu ${index + 1}`}`} kind="image" value={entry.target.tokenAssetId} onChange={(tokenAssetId, uploadedAsset) => {
            if (entry.unit.interactionLayout?.kind !== 'scene-draw-v1') return;
            const selected = uploadedAsset || assets.find(asset => asset.id === tokenAssetId);
            commit({ ...entry.unit, interactionLayout: { ...entry.unit.interactionLayout, targets: entry.unit.interactionLayout.targets.map(target => target.id === entry.target.id ? { ...target, tokenAssetId: tokenAssetId || undefined, tokenUrl: selected?.url } : target) } });
          }} />
          {pasteDrawTokens && <FileDropPasteInput compact accept="image/png,.png" pasteImages uploadLabel="Tải/dán PNG" onFiles={async files => {
            const file = files[0];
            if (!file || (file.type !== 'image/png' && !/\.png$/i.test(file.name))) {
              window.alert('Vật thể Draw phải là ảnh PNG.');
              return;
            }
            if (entry.unit.interactionLayout?.kind !== 'scene-draw-v1') return;
            const asset = await uploadToken(file);
            commit({ ...entry.unit, interactionLayout: { ...entry.unit.interactionLayout, targets: entry.unit.interactionLayout.targets.map(target => target.id === entry.target.id ? { ...target, tokenAssetId: asset.id, tokenUrl: asset.url } : target) } });
          }} />}
        </div>
        {isEditing && <div className="space-y-2 rounded-2xl border border-sky-200 bg-sky-50/40 p-3" data-starter-draw-region-editor>
          <div className="flex items-start justify-between gap-3"><p className="text-[11px] font-semibold text-sky-800">Kéo một hình chữ nhật làm vùng đặt “{entry.target.object || 'vật thể'}”. Học sinh đặt tâm vật bên trong vùng này sẽ được tính đúng; vùng chấm không được gửi xuống player.</p><button type="button" onClick={() => setActiveRegion(undefined)} className="rounded-lg p-1 text-sky-700" aria-label="Đóng chọn vùng đặt vật"><X size={15} /></button></div>
          <ListeningRegionEditor imageUrl={part.imageUrl} rectangleOnly items={[{ id: entry.target.id, label: `${entry.target.object} · ${entry.target.label}`, region: entry.target.targetRegion }]} onChange={items => {
            if (entry.unit.interactionLayout?.kind !== 'scene-draw-v1') return;
            const nextRegion = items[0]?.region;
            if (!nextRegion) return;
            const targets = entry.unit.interactionLayout.targets.map(target => target.id === entry.target.id ? { ...target, targetRegion: nextRegion, geometryConfirmedByTeacher: true } : target);
            const confirmed = targets.every(target => target.geometryConfirmedByTeacher);
            commit({ ...entry.unit, interaction: entry.unit.interaction ? { ...entry.unit.interaction, importReadiness: confirmed && part.imageAssetId && part.audioAssetId ? 'ready-to-publish' : part.imageAssetId && part.audioAssetId ? 'needs-geometry' : 'needs-assets' } : entry.unit.interaction, interactionLayout: { ...entry.unit.interactionLayout, targets } });
          }} />
        </div>}
      </div>;
    })}</div>
    {!!studentPalette.length && <div className="rounded-xl border border-indigo-100 bg-white p-3">
      <p className="text-xs font-black text-slate-800">Khay học sinh: màu đáp án + 1 màu nhiễu</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">{studentPalette.map(colour => <span key={colour} title={colour} className="h-8 w-14 rounded-lg border-2 border-sky-300" style={{ backgroundColor: starterColourValue(colour) }} />)}{drawEntries.map(entry => <span key={entry.target.id} className="inline-flex h-10 min-w-14 items-center justify-center rounded-lg border-2 border-sky-300 bg-white px-2">{entry.target.tokenUrl ? <img src={entry.target.tokenUrl} alt={entry.target.object} className="h-8 w-10 object-contain" /> : <span className="text-[10px] font-black">{entry.target.object}</span>}</span>)}</div>
      <p className="mt-2 text-[11px] font-semibold text-slate-500">Draw chỉ hiển thị đúng vật học sinh cần kéo, không thêm vật nhiễu.</p>
    </div>}
  </div>;
}

export function StarterImportReadiness({ part, requiresAudio }: { part: ExamPartContent; requiresAudio?: boolean }) {
  if (!part.interaction) return null;
  const mediaReady = (!requiresAudio || !!part.audioAssetId)
    && (!part.interactionLayout?.kind.startsWith('starter-image-matching-') || !!part.imageAssetId)
    && (part.interactionLayout?.kind !== 'starter-scene-colour-v1' || !!part.imageAssetId)
    && (part.interactionLayout?.kind !== 'scene-draw-v1' || (!!part.imageAssetId && part.interactionLayout.targets.every(target => !!target.tokenAssetId)))
    && (part.interactionLayout?.kind !== 'flyer-name-placement-v1' || !!part.imageAssetId)
    && (part.interaction.variant !== 'image-options' || part.questions.every(question => question.options.every(option => !!option.imageAssetId)));
  const geometryReady = part.interactionLayout?.kind === 'starter-image-matching-v1'
    ? [...part.interactionLayout.leftItems, ...part.interactionLayout.rightItems].every(item => item.geometryConfirmedByTeacher)
    : part.interactionLayout?.kind === 'starter-image-matching-v2'
      ? [...part.interactionLayout.sourceNodes, ...part.interactionLayout.targetNodes].every(node => node.geometryConfirmedByTeacher)
    : part.interactionLayout?.kind === 'starter-scene-colour-v1'
      ? part.interactionLayout.targets.every(target => target.geometryConfirmedByTeacher)
    : part.interactionLayout?.kind === 'scene-draw-v1'
      ? part.interactionLayout.targets.every(target => target.geometryConfirmedByTeacher)
    : part.interactionLayout?.kind === 'flyer-name-placement-v1'
      ? part.interactionLayout.targets.every(target => target.geometryConfirmedByTeacher)
      : true;
  const ready = mediaReady && geometryReady;
  const label = !mediaReady ? 'Cần bổ sung ảnh/audio' : !geometryReady ? 'Cần xác nhận vùng tương tác' : 'Đã đủ nội dung kỹ thuật';
  return <div className={`flex items-center gap-2 rounded-xl border p-3 text-xs font-black ${ready ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}><CheckCircle2 size={16} />{label}<span className="font-semibold">· {part.interaction.family} / {part.interaction.subtype} / {part.interaction.variant}</span></div>;
}
