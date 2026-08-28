import {
  ArrowLeft,
  BookOpenText,
  Headphones,
  LoaderCircle,
  Plus,
  Save,
  Send,
  Upload,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { LibraryLinkStatus, LibraryRowActions } from '../../../components/admin/LibraryRowControls';
import { listeningApi } from '../../listening/api';
import type { ListeningAsset } from '../../listening/types';
import FileDropPasteInput from '../../listening/shared/FileDropPasteInput';
import { ListeningRegionEditor } from '../../listening/admin/ListeningRegionEditor';
import { examPaperExamPath } from '../../listening-library/routes';
import type { ExamModuleId, ExamPaperId } from '../../listening-library/types';
import { createDefaultExamContent, getExamPaperDefinition, getModuleExamPaperDefinitions } from '../definitions';
import { examPlatformApi } from '../api';
import type {
  ExamOption,
  ExamPaperContent,
  ExamPartContent,
  ExamQuestion,
  ExamQuestionType,
  ExamSetSummary,
  ExamVisibility,
} from '../types';
import { EXAM_CONTENT_SCHEMA_VERSION } from '../types';
import { examPartUnits, promoteExamPartToBlocks, replaceExamPartUnit } from '../examStructure';
import {
  StarterImportReadiness,
  StarterListeningPart4Editor,
  StarterQuickAssetPanel,
  StarterSpecialPartEditor,
  replaceStarterPartImage,
} from './StarterAuthoring';
import { UniversalPartImportPanel, UniversalWholeImportPanel } from './UniversalAuthoring';
import StarterReadingWritingAuthoring from './StarterReadingWritingAuthoring';

interface Props { token: string; moduleId: Exclude<ExamModuleId, 'mover'> }
interface PaperAdminProps extends Props { paperId: ExamPaperId; onBack: () => void }

const fieldClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100';
const choiceTypes = new Set<ExamQuestionType>(['single-choice', 'multiple-choice', 'true-false', 'true-false-not-given', 'yes-no-not-given', 'matching']);
const allQuestionTypes = ['single-choice', 'multiple-choice', 'short-answer', 'true-false', 'true-false-not-given', 'yes-no-not-given', 'matching', 'scene-draw', 'long-writing'] as const satisfies readonly ExamQuestionType[];
const identifier = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

function defaultOptionTexts(type: ExamQuestionType) {
  if (type === 'true-false') return ['True', 'False'];
  if (type === 'true-false-not-given') return ['True', 'False', 'Not Given'];
  if (type === 'yes-no-not-given') return ['Yes', 'No', 'Not Given'];
  return ['A', 'B', 'C'];
}

function optionsFor(type: ExamQuestionType): ExamOption[] {
  if (!choiceTypes.has(type)) return [];
  return defaultOptionTexts(type).map((text, index) => ({ id: identifier('option'), label: String.fromCharCode(65 + index), text }));
}

function AssetField({
  token,
  kind,
  label,
  assets,
  assetId,
  onChange,
  onUploaded,
  pasteImages = false,
}: {
  token: string;
  kind: 'image' | 'audio';
  label: string;
  assets: ListeningAsset[];
  assetId?: string;
  onChange: (asset?: ListeningAsset) => void;
  onUploaded: (asset: ListeningAsset) => void;
  pasteImages?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const active = assets.filter(asset => asset.kind === kind && asset.status === 'active');
  const upload = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setUploading(true);
    try {
      const asset = await listeningApi.uploadAsset(token, file, kind);
      onUploaded(asset);
      onChange(asset);
    } finally { setUploading(false); }
  };
  return (
    <div className="block text-xs font-black text-slate-700">
      <p>{label}</p>
      <div className="mt-1 space-y-2">
        <select aria-label={label} value={assetId || ''} onChange={event => onChange(active.find(asset => asset.id === event.target.value))} className={fieldClass}>
          <option value="">Chưa chọn {kind === 'image' ? 'ảnh' : 'audio'}</option>
          {active.map(asset => <option key={asset.id} value={asset.id}>{asset.name || asset.id}</option>)}
        </select>
        {kind === 'image' && pasteImages ? <FileDropPasteInput compact accept="image/png,image/jpeg,image/webp" disabled={uploading} pasteImages uploadLabel="Tải ảnh" onFiles={upload} /> : <label className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-xs font-black text-indigo-700">
          {uploading ? <LoaderCircle size={15} className="animate-spin" /> : <Upload size={15} />} Tải lên
          <input type="file" accept={kind === 'image' ? 'image/png,image/jpeg,image/webp' : 'audio/*'} className="hidden" disabled={uploading} onChange={async event => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;
            await upload([file]);
          }} />
        </label>}
      </div>
    </div>
  );
}

function interactionQuestionTypes(part: ExamPartContent): readonly ExamQuestionType[] {
  const family = part.interaction?.family;
  if (family === 'text-entry') return ['short-answer'];
  if (family === 'writing') return ['long-writing'];
  if (family === 'matching') return ['matching'];
  if (family === 'choice') return part.interaction?.subtype === 'multiple' ? ['multiple-choice'] : ['single-choice', 'multiple-choice'];
  if (family === 'scene') return ['single-choice', 'short-answer', 'scene-draw'];
  return allQuestionTypes;
}

function isSpecialInteraction(part: ExamPartContent) {
  return (part.interaction?.family === 'text-entry' && (part.interaction.variant === 'single-input' || (part.part === 2 && part.interaction.variant === 'inline-gap')))
    || part.interaction?.variant === 'image-options'
    || part.interactionLayout?.kind === 'starter-image-matching-v1'
    || part.interactionLayout?.kind === 'starter-image-matching-v2'
    || part.interactionLayout?.kind === 'starter-scene-colour-v1'
    || part.interactionLayout?.kind === 'scene-draw-v1';
}

function QuestionEditor({
  question,
  partNumber,
  allowedTypes,
  token,
  assets,
  onAssets,
  onChange,
  pasteImages = false,
}: {
  key?: string;
  question: ExamQuestion;
  partNumber: number;
  allowedTypes: readonly ExamQuestionType[];
  token: string;
  assets: ListeningAsset[];
  onAssets: (asset: ListeningAsset) => void;
  onChange: (question: ExamQuestion) => void;
  pasteImages?: boolean;
}) {
  const updateOption = (index: number, patch: Partial<ExamOption>) => {
    const options = question.options.map((option, optionIndex) => optionIndex === index ? { ...option, ...patch } : option);
    onChange({ ...question, options });
  };
  const changeType = (type: ExamQuestionType) => onChange({
    ...question,
    type,
    options: optionsFor(type),
    correctOptionIds: [],
    acceptedAnswers: [],
    ...(type === 'long-writing' ? { rubric: question.rubric || 'Chấm theo mức độ hoàn thành yêu cầu, tổ chức bài, từ vựng và ngữ pháp.' } : {}),
  });
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-[110px_1fr_110px]">
        <label className="text-xs font-black text-slate-700">Câu<input type="number" min={1} value={question.number} onChange={event => onChange({ ...question, number: Number(event.target.value) || 1 })} className={`mt-1 ${fieldClass}`} /></label>
        <label className="text-xs font-black text-slate-700">Dạng câu<select value={question.type} onChange={event => changeType(event.target.value as ExamQuestionType)} className={`mt-1 ${fieldClass}`}>{allowedTypes.map(type => <option key={type} value={type}>{type}</option>)}</select></label>
        <label className="text-xs font-black text-slate-700">Điểm<input type="number" min={0.5} max={100} step={0.5} value={question.points} onChange={event => onChange({ ...question, points: Number(event.target.value) || 1 })} className={`mt-1 ${fieldClass}`} /></label>
      </div>
      <label className="mt-3 block text-xs font-black text-slate-700">Nội dung câu hỏi<textarea value={question.prompt} onChange={event => onChange({ ...question, prompt: event.target.value })} className={`mt-1 min-h-20 ${fieldClass}`} /></label>
      <label className="mt-3 block text-xs font-black text-slate-700">Ngữ cảnh/đoạn dẫn riêng của câu (không bắt buộc)<textarea value={question.context || ''} onChange={event => onChange({ ...question, context: event.target.value })} className={`mt-1 min-h-16 ${fieldClass}`} /></label>
      <div className="mt-3"><AssetField token={token} kind="image" label="Ảnh riêng của câu (không bắt buộc)" assets={assets} assetId={question.imageAssetId} onUploaded={onAssets} pasteImages={pasteImages} onChange={asset => onChange({ ...question, imageAssetId: asset?.id, imageUrl: asset?.url })} /></div>

      {choiceTypes.has(question.type) && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-black text-slate-700">Các lựa chọn và đáp án đúng</p>
          {question.options.map((option, index) => {
            const selected = question.correctOptionIds.includes(option.id);
            return (
              <div key={option.id} className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
                <div className="grid items-center gap-2 md:grid-cols-[32px_50px_1fr_auto]">
                  <input type={question.type === 'multiple-choice' ? 'checkbox' : 'radio'} name={`correct-${question.id}`} checked={selected} onChange={event => {
                    const correctOptionIds = question.type === 'multiple-choice'
                      ? event.target.checked ? [...question.correctOptionIds, option.id] : question.correctOptionIds.filter(id => id !== option.id)
                      : [option.id];
                    onChange({ ...question, correctOptionIds });
                  }} aria-label={`Đáp án đúng ${option.label}`} />
                  <input value={option.label} onChange={event => updateOption(index, { label: event.target.value.slice(0, 8) })} className={fieldClass} aria-label="Nhãn lựa chọn" />
                  <input value={option.text} onChange={event => updateOption(index, { text: event.target.value })} className={fieldClass} aria-label="Nội dung lựa chọn" />
                  <button type="button" onClick={() => onChange({ ...question, options: question.options.filter(item => item.id !== option.id), correctOptionIds: question.correctOptionIds.filter(id => id !== option.id) })} className="rounded-lg p-2 text-rose-600" aria-label="Xóa lựa chọn"><X size={16} /></button>
                </div>
                <AssetField token={token} kind="image" label={`Ảnh lựa chọn ${option.label} (không bắt buộc)`} assets={assets} assetId={option.imageAssetId} onUploaded={onAssets} pasteImages={pasteImages} onChange={asset => updateOption(index, { imageAssetId: asset?.id, imageUrl: asset?.url })} />
              </div>
            );
          })}
          {!['true-false', 'true-false-not-given', 'yes-no-not-given'].includes(question.type) && <button type="button" onClick={() => onChange({ ...question, options: [...question.options, { id: identifier('option'), label: String.fromCharCode(65 + question.options.length), text: '' }] })} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-indigo-700">+ Thêm lựa chọn</button>}
          {!question.correctOptionIds.length && <p className="text-xs font-bold text-amber-700">Chưa xác nhận đáp án đúng. Nếu không có ảnh đáp án chính thức, giáo viên bắt buộc chọn tại đây.</p>}
        </div>
      )}

      {question.type === 'short-answer' && <label className="mt-4 block text-xs font-black text-slate-700">Các đáp án chấp nhận (mỗi dòng một đáp án)<textarea value={question.acceptedAnswers.join('\n')} onChange={event => onChange({ ...question, acceptedAnswers: event.target.value.split('\n').map(value => value.trim()).filter(Boolean) })} className={`mt-1 min-h-24 ${fieldClass}`} /></label>}

      {question.type === 'long-writing' && (
        <div className="mt-4 grid gap-3 md:grid-cols-[150px_1fr]">
          <label className="text-xs font-black text-slate-700">Số từ tối thiểu<input type="number" min={1} value={question.minWords || 1} onChange={event => onChange({ ...question, minWords: Number(event.target.value) || 1 })} className={`mt-1 ${fieldClass}`} /></label>
          <label className="text-xs font-black text-slate-700">Rubric chấm thủ công<textarea value={question.rubric || ''} onChange={event => onChange({ ...question, rubric: event.target.value })} className={`mt-1 min-h-20 ${fieldClass}`} /></label>
          <label className="md:col-span-2 text-xs font-black text-slate-700">Bài mẫu/ghi chú riêng cho giáo viên<textarea value={question.modelAnswer || ''} onChange={event => onChange({ ...question, modelAnswer: event.target.value })} className={`mt-1 min-h-20 ${fieldClass}`} /></label>
        </div>
      )}
      <p className="mt-3 text-[10px] font-bold text-slate-400">Part {partNumber} · ID kỹ thuật không hiển thị cho học sinh</p>
    </article>
  );
}

function InteractionUnitEditor({
  token,
  unit,
  assets,
  onAssets,
  onChange,
  pasteImages,
  compactStarterListening = false,
}: {
  token: string;
  unit: ExamPartContent;
  assets: ListeningAsset[];
  onAssets: (asset: ListeningAsset) => void;
  onChange: (part: ExamPartContent) => void;
  pasteImages: boolean;
  compactStarterListening?: boolean;
}) {
  const special = isSpecialInteraction(unit);
  const updateQuestion = (index: number, question: ExamQuestion) => onChange({ ...unit, questions: unit.questions.map((item, itemIndex) => itemIndex === index ? question : item) });
  const textEntryLayout = unit.interactionLayout?.kind === 'image-text-entry-v1' ? unit.interactionLayout : undefined;
  return <article className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" data-exam-interaction-block={unit.id}>
    {!compactStarterListening && <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-[10px] font-black uppercase tracking-wide text-violet-600">{unit.interaction?.family || 'generic'} → {unit.interaction?.subtype || 'question'} → {unit.interaction?.variant || 'default'}</p><h4 className="mt-1 text-lg font-black text-slate-900">{unit.title}</h4><p className="mt-1 text-xs font-semibold text-slate-500">{unit.questions.length} câu</p></div>
      {unit.interaction?.importReadiness && <span className="rounded-full bg-amber-50 px-3 py-1 text-[10px] font-black text-amber-800">{unit.interaction.importReadiness}</span>}
    </div>}
    {!compactStarterListening && <div className="grid gap-3 md:grid-cols-2">
      <label className="text-xs font-black text-slate-700">Tiêu đề dạng bài<input value={unit.title} onChange={event => onChange({ ...unit, title: event.target.value })} className={`mt-1 ${fieldClass}`} /></label>
      <label className="text-xs font-black text-slate-700">Hướng dẫn dạng bài<input value={unit.instruction} onChange={event => onChange({ ...unit, instruction: event.target.value })} className={`mt-1 ${fieldClass}`} /></label>
    </div>}
    {!compactStarterListening && <label className="block text-xs font-black text-slate-700">Đoạn dẫn chung của dạng bài (không bắt buộc)<textarea value={unit.passage || ''} onChange={event => onChange({ ...unit, passage: event.target.value })} className={`mt-1 min-h-24 ${fieldClass}`} /></label>}
    {!compactStarterListening && <div className="grid gap-3 md:grid-cols-2">
      <AssetField token={token} kind="image" label="Ảnh của dạng bài" assets={assets} assetId={unit.imageAssetId} onUploaded={onAssets} pasteImages={pasteImages} onChange={asset => onChange(replaceStarterPartImage(unit, asset))} />
      <AssetField token={token} kind="audio" label="Audio của dạng bài (không bắt buộc)" assets={assets} assetId={unit.audioAssetId} onUploaded={onAssets} onChange={asset => onChange({ ...unit, audioAssetId: asset?.id, audioUrl: asset?.url })} />
    </div>}
    {textEntryLayout && <div className="space-y-3 rounded-2xl border border-sky-200 bg-sky-50 p-4" data-exam-geometry-editor="image-text-entry">
      <div><p className="text-sm font-black text-sky-950">Vùng điền đáp án trên ảnh</p><p className="mt-1 text-xs font-semibold text-sky-800">Tọa độ từ JSON chỉ là gợi ý. Đặt lại vùng nếu cần rồi xác nhận trực quan trước khi xuất bản.</p></div>
      {unit.imageUrl ? <ListeningRegionEditor rectangleOnly imageUrl={unit.imageUrl} items={textEntryLayout.targets.map(target => ({ id: target.id, label: target.label, region: target.region }))} onChange={items => onChange({ ...unit, interactionLayout: { ...textEntryLayout, targets: textEntryLayout.targets.map(target => ({ ...target, region: items.find(item => item.id === target.id)?.region || target.region, geometryConfirmedByTeacher: false })) } })} /> : <p className="rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-800">Hãy gắn ảnh cho dạng bài trước khi chỉnh vùng.</p>}
      <button type="button" disabled={!unit.imageAssetId || textEntryLayout.targets.length !== unit.questions.length} onClick={() => onChange({ ...unit, interactionLayout: { ...textEntryLayout, targets: textEntryLayout.targets.map(target => ({ ...target, geometryConfirmedByTeacher: true })) }, interaction: unit.interaction ? { ...unit.interaction, importReadiness: 'ready-to-publish' } : unit.interaction })} className="rounded-xl bg-sky-700 px-4 py-2.5 text-xs font-black text-white disabled:opacity-40">Xác nhận các vùng điền đáp án</button>
    </div>}
    {special && <StarterSpecialPartEditor token={token} part={unit} assets={assets} onAssets={onAssets} onChange={onChange} />}
    {!special && <div className="space-y-3">{unit.questions.map((question, index) => <QuestionEditor key={question.id} question={question} partNumber={unit.part} allowedTypes={interactionQuestionTypes(unit)} token={token} assets={assets} onAssets={onAssets} pasteImages={pasteImages} onChange={value => updateQuestion(index, value)} />)}</div>}
  </article>;
}

function PartEditor({
  token,
  content,
  partIndex,
  assets,
  onAssets,
  onChange,
  onContentChange,
  onMessage,
}: {
  token: string;
  content: ExamPaperContent;
  partIndex: number;
  assets: ListeningAsset[];
  onAssets: (asset: ListeningAsset) => void;
  onChange: (part: ExamPartContent) => void;
  onContentChange: (content: ExamPaperContent) => void;
  onMessage: (message: { text: string; error?: boolean }) => void;
}) {
  const definition = getExamPaperDefinition(content.moduleId, content.paperId)!;
  const part = content.parts[partIndex];
  const partDefinition = definition.parts[partIndex] || {
    id: `part-${partIndex + 1}`,
    displayName: `Part ${partIndex + 1}`,
    title: part?.title || `Part ${partIndex + 1}`,
    instruction: part?.instruction || '',
    questionCount: part?.questions.length || 0,
    questionCountFlexible: true,
    defaultQuestionType: part?.questions[0]?.type || 'short-answer' as const,
    allowedQuestionTypes: allQuestionTypes,
    requiresAudio: false,
  };
  const starter = content.moduleId === 'starter';
  const starterListening = starter && content.paperId === 'listening';
  const starterReadingWriting = starter && content.paperId === 'reading-writing';
  const starterPart2 = starterListening && part.part === 2;
  const units = examPartUnits(part);
  const updateUnit = (unit: ExamPartContent) => onChange(replaceExamPartUnit(part, unit));
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
        <p className="text-xs font-black uppercase tracking-wide text-indigo-700">{content.structureMode === 'dynamic' ? `Part ${part.part}` : partDefinition.displayName}</p>
        <h3 className="mt-1 text-xl font-black text-slate-900">{content.structureMode === 'dynamic' ? part.title : partDefinition.title}</h3>
        <p className="mt-1 text-xs font-semibold text-slate-600">{content.structureMode === 'dynamic' ? `${part.blocks?.length || 1} dạng bài · ${part.questions.length} câu theo JSON.` : partDefinition.questionCountFlexible ? `Phân bổ linh hoạt; toàn bài phải đủ ${definition.totalQuestionCount} câu.` : `${partDefinition.questionCount} câu cố định.`}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-xs font-black text-slate-700">Tiêu đề Part<input value={part.title} onChange={event => onChange({ ...part, title: event.target.value })} className={`mt-1 ${fieldClass}`} /></label>
        <label className="text-xs font-black text-slate-700">Hướng dẫn<input value={part.instruction} onChange={event => onChange({ ...part, instruction: event.target.value })} className={`mt-1 ${fieldClass}`} /></label>
      </div>
      {starter && !part.blocks?.length && <StarterImportReadiness part={part} requiresAudio={partDefinition.requiresAudio} />}
      {!starterListening && !starterPart2 && !starterReadingWriting && <label className="block text-xs font-black text-slate-700">Đoạn đọc/nội dung chung của Part<textarea value={part.passage || ''} onChange={event => onChange({ ...part, passage: event.target.value })} className={`mt-1 min-h-32 ${fieldClass}`} /></label>}
      {!starterReadingWriting && <div className="grid gap-3 md:grid-cols-2">
        <AssetField token={token} kind="image" label={starterPart2 ? 'Hình minh họa (không bắt buộc)' : starterListening && part.part === 3 ? 'Ảnh hiển thị chung cho học sinh' : starterListening && part.part === 4 ? 'Ảnh scene Colour + Draw' : 'Ảnh chung của Part'} assets={assets} assetId={part.imageAssetId} onUploaded={onAssets} pasteImages={starter} onChange={asset => {
          const displayOnly = starterListening && part.part === 3;
          const next = displayOnly ? { ...part, imageAssetId: asset?.id, imageUrl: asset?.url } : starter ? replaceStarterPartImage(part, asset) : { ...part, imageAssetId: asset?.id, imageUrl: asset?.url };
          onChange(starterListening && !displayOnly && next.blocks?.length ? { ...next, blocks: next.blocks.map(block => ({ ...block, imageAssetId: asset?.id, imageUrl: asset?.url })) } : next);
        }} />
        {partDefinition.requiresAudio && <AssetField token={token} kind="audio" label="Audio bắt buộc" assets={assets} assetId={part.audioAssetId} onUploaded={onAssets} onChange={asset => onChange({ ...part, audioAssetId: asset?.id, audioUrl: asset?.url, ...(starterListening && part.blocks?.length ? { blocks: part.blocks.map(block => ({ ...block, audioAssetId: asset?.id, audioUrl: asset?.url })) } : {}) })} />}
      </div>}

      {content.paperId === 'listening' && <section className="rounded-2xl border border-sky-200 bg-sky-50 p-4" data-exam-part-transcript={part.part}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-black text-sky-950">Nội dung bài nghe / hội thoại</p>
            <p className="mt-1 text-xs font-semibold text-sky-800">Chỉ hiển thị sau khi học sinh hoàn thành bài và được phép xem kết quả.</p>
          </div>
          <label className="cursor-pointer rounded-xl border border-sky-300 bg-white px-3 py-2 text-xs font-black text-sky-800">
            Chọn file .txt
            <input type="file" accept=".txt,text/plain" className="hidden" onChange={event => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (!file) return;
              file.text().then(value => onChange({ ...part, audioTranscript: value.slice(0, 20_000) })).catch(() => onMessage({ text: 'Không thể đọc file transcript.', error: true }));
            }} />
          </label>
        </div>
        <textarea value={part.audioTranscript || ''} maxLength={20_000} onChange={event => onChange({ ...part, audioTranscript: event.target.value })} className={`mt-3 min-h-40 font-medium leading-6 ${fieldClass}`} placeholder="Dán lời thoại, nội dung bài nghe hoặc tải file .txt…" />
        <p className="mt-1 text-right text-[10px] font-bold text-sky-700">{(part.audioTranscript || '').length.toLocaleString('vi-VN')} / 20.000 ký tự</p>
      </section>}

      <UniversalPartImportPanel content={content} definition={definition} partIndex={partIndex} onChange={(nextPart, dynamic) => {
        const importedPart = { ...nextPart, ...(part.audioTranscript && !nextPart.audioTranscript ? { audioTranscript: part.audioTranscript } : {}) };
        if (!dynamic) return onChange(importedPart);
        onContentChange({
          ...content,
          schemaVersion: EXAM_CONTENT_SCHEMA_VERSION,
          structureMode: 'dynamic',
          parts: content.parts.map((item, index) => index === partIndex ? importedPart : promoteExamPartToBlocks(item)),
        });
      }} onMessage={onMessage} />

      <div className="space-y-4">{starterReadingWriting ? <StarterReadingWritingAuthoring token={token} part={part} assets={assets} onAssets={onAssets} onChange={onChange} /> : starterListening && part.part === 4 ? <StarterListeningPart4Editor token={token} part={part} assets={assets} onAssets={onAssets} onChange={onChange} /> : units.map((unit, unitIndex) => <div key={unit.id}>
        {part.blocks?.length && (!starterListening || part.part === 4) && <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">{starterListening && part.part === 4 ? (unit.interactionLayout?.kind === 'scene-draw-v1' ? 'Draw' : 'Colour') : `Dạng bài ${unitIndex + 1}/${units.length}`}</p>}
        <InteractionUnitEditor token={token} unit={unit} assets={assets} onAssets={onAssets} onChange={updateUnit} pasteImages={starter} compactStarterListening={starterListening && part.part !== 1} />
      </div>)}</div>
      {partDefinition.questionCountFlexible && !part.blocks?.length && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => {
            const number = Math.max(0, ...content.parts.flatMap(item => item.questions.map(question => question.number))) + 1;
            const type = partDefinition.defaultQuestionType;
            onChange({ ...part, questions: [...part.questions, { id: identifier('question'), number, type, prompt: `Câu ${number}`, options: optionsFor(type), correctOptionIds: [], acceptedAnswers: [], points: partDefinition.pointsPerQuestion || 1 }] });
          }} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-black text-white">+ Thêm câu vào Section</button>
          <button type="button" disabled={part.questions.length === 0} onClick={() => onChange({ ...part, questions: part.questions.slice(0, -1) })} className="rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-xs font-black text-rose-700 disabled:opacity-50">Bỏ câu cuối</button>
        </div>
      )}
    </div>
  );
}

function PaperAdmin({ token, moduleId, paperId, onBack }: PaperAdminProps) {
  const definition = getExamPaperDefinition(moduleId, paperId)!;
  const [sets, setSets] = useState<ExamSetSummary[]>([]);
  const [assets, setAssets] = useState<ListeningAsset[]>([]);
  const [editingId, setEditingId] = useState('');
  const [content, setContent] = useState<ExamPaperContent>(() => createDefaultExamContent(definition));
  const [visibility, setVisibility] = useState<ExamVisibility>('draft');
  const [revision, setRevision] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [autosave, setAutosave] = useState<'idle' | 'saving' | 'saved' | 'conflict' | 'error'>('idle');
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [results, setResults] = useState<any[] | null>(null);
  const [resultSet, setResultSet] = useState<ExamSetSummary | null>(null);
  const fixedStarterPaper = moduleId === 'starter' && (paperId === 'listening' || paperId === 'reading-writing');
  const fixedStarterListening = moduleId === 'starter' && paperId === 'listening';
  const [starterPartsRevealed, setStarterPartsRevealed] = useState(fixedStarterPaper || moduleId !== 'starter');
  const autosaveRef = useRef(false);

  const load = async () => {
    const [setRows, assetRows] = await Promise.all([
      examPlatformApi.listSets(token, moduleId, paperId),
      listeningApi.listAssets(token),
    ]);
    setSets(setRows);
    setAssets(assetRows);
  };
  useEffect(() => { void load().catch(error => setMessage({ text: error.message, error: true })); }, [token, moduleId, paperId]);
  useEffect(() => {
    if (!editingId || !dirty || busy || autosaveRef.current || autosave === 'conflict') return;
    const timer = window.setTimeout(async () => {
      autosaveRef.current = true;
      setAutosave('saving');
      try {
        const saved = await examPlatformApi.autosaveSet(token, moduleId, paperId, editingId, content, visibility, revision);
        setRevision(saved.draftRevision);
        setValidationErrors(saved.validationErrors || []);
        setDirty(false);
        setAutosave('saved');
      } catch (error: any) {
        setAutosave(error?.status === 409 ? 'conflict' : 'error');
        if (error?.status === 409) setMessage({ text: 'Bản nháp đã được sửa ở tab khác. Hãy mở lại để tránh ghi đè.', error: true });
      } finally { autosaveRef.current = false; }
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [editingId, dirty, busy, autosave, content, visibility, revision, token, moduleId, paperId]);

  const updateContent = (next: ExamPaperContent | ((value: ExamPaperContent) => ExamPaperContent)) => {
    setContent(next);
    setDirty(true);
  };
  const startNew = () => {
    setEditingId(''); setContent(createDefaultExamContent(definition)); setVisibility('draft'); setRevision(0); setDirty(true); setValidationErrors([]); setStep(0); setAutosave('idle'); setResults(null); setStarterPartsRevealed(fixedStarterPaper || moduleId !== 'starter');
  };
  const edit = async (setId: string) => {
    setBusy(true);
    try {
      const set = await examPlatformApi.getAdminSet(token, moduleId, paperId, setId);
      setEditingId(set.id); setContent(set.draftContent); setVisibility(set.visibility || 'draft'); setRevision(Number(set.draftRevision || 0)); setDirty(false); setValidationErrors(set.validationErrors || []); setStep(0); setAutosave('saved'); setStarterPartsRevealed(true);
    } catch (error: any) { setMessage({ text: error.message, error: true }); }
    finally { setBusy(false); }
  };
  const save = async () => {
    setBusy(true); setMessage(null);
    try {
      let saved = editingId
        ? await examPlatformApi.updateSet(token, moduleId, paperId, editingId, content, visibility, revision)
        : await examPlatformApi.createSet(token, moduleId, paperId, content);
      if (!editingId && visibility !== 'draft') saved = await examPlatformApi.updateSet(token, moduleId, paperId, saved.id, content, visibility, Number(saved.draftRevision || 1));
      setEditingId(saved.id); setRevision(Number(saved.draftRevision || 0)); setValidationErrors(saved.validationErrors || []); setDirty(false); setAutosave('saved'); setMessage({ text: 'Đã lưu bản nháp.' }); await load(); return saved;
    } catch (error: any) { setMessage({ text: error.message, error: true }); setValidationErrors(Array.isArray(error.details) ? error.details : []); throw error; }
    finally { setBusy(false); }
  };
  const publish = async () => {
    try {
      const saved = await save();
      setBusy(true);
      const published = await examPlatformApi.publishSet(token, moduleId, paperId, saved.id);
      setValidationErrors([]); setMessage({ text: `Đã xuất bản phiên bản ${published.version.versionNumber}.` }); await load();
    } catch (error: any) { setMessage({ text: error.message, error: true }); setValidationErrors(Array.isArray(error.details) ? error.details : []); }
    finally { setBusy(false); }
  };
  const previewUrl = (set: ExamSetSummary) => examPaperExamPath(moduleId, paperId, set.id, set.visibility === 'assignment' ? set.shareToken || '' : '');
  const showResults = async (set: ExamSetSummary) => {
    try { const data = await examPlatformApi.results(token, moduleId, paperId, set.id); setResults(data.attempts || []); setResultSet(set); }
    catch (error: any) { setMessage({ text: error.message, error: true }); }
  };

  const editing = Boolean(editingId) || dirty;
  const totalQuestions = content.parts.reduce((sum, part) => sum + part.questions.length, 0);
  const steps = starterPartsRevealed ? ['Thông tin', ...content.parts.map((part, index) => `Part ${part.part || index + 1}`), 'Preview'] : ['Thông tin'];
  if (editing) return (
    <div className="space-y-4" id="generic-exam-editor" data-module={moduleId} data-paper={paperId}>
      <header className="sticky top-0 z-20 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-indigo-600">{moduleId} · {definition.displayName}</p><h2 className="text-xl font-black text-slate-900">{content.title}</h2><p className="text-xs font-semibold text-slate-500">{autosave === 'saving' ? 'Đang tự lưu…' : autosave === 'saved' ? 'Bản nháp đã lưu' : autosave === 'conflict' ? 'Xung đột bản nháp' : dirty ? 'Có thay đổi chưa lưu' : ''}</p></div>
          <div className="flex flex-wrap gap-2"><button type="button" onClick={() => { setEditingId(''); setDirty(false); setResults(null); }} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-black"><ArrowLeft size={15} />Kho đề</button><button type="button" disabled={busy || autosave === 'conflict'} onClick={() => void save().catch(() => undefined)} className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-xs font-black text-indigo-700"><Save size={15} />Lưu</button><button type="button" disabled={busy || autosave === 'conflict'} onClick={() => void publish()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white"><Send size={15} />Xuất bản</button></div>
        </div>
        <nav className="mt-3 flex gap-2 overflow-x-auto pb-1">{steps.map((label, index) => <button key={`${label}-${index}`} type="button" onClick={() => setStep(index)} data-active={step === index} className={`shrink-0 rounded-xl px-3 py-2 text-xs font-black ${step === index ? 'bg-indigo-600 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>{label}</button>)}</nav>
      </header>
      {message && <div className={`rounded-2xl border p-3 text-sm font-bold ${message.error ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{message.text}</div>}
      {validationErrors.length > 0 && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-bold text-amber-900"><p className="mb-2 font-black">Cần hoàn thiện trước khi xuất bản:</p><ul className="list-disc space-y-1 pl-5">{validationErrors.map((error, index) => <li key={`${error}-${index}`}>{error}</li>)}</ul></div>}
      <section className="rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:p-6">
         {step === 0 && <div className="space-y-4"><div className="grid gap-3 md:grid-cols-2"><label className="text-xs font-black text-slate-700">Tên bộ đề<input value={content.title} onChange={event => updateContent({ ...content, title: event.target.value })} className={`mt-1 ${fieldClass}`} /></label><label className="text-xs font-black text-slate-700">Cấp độ<input value={content.level} onChange={event => updateContent({ ...content, level: event.target.value })} className={`mt-1 ${fieldClass}`} /></label><label className="text-xs font-black text-slate-700 md:col-span-2">Mô tả<textarea value={content.description} onChange={event => updateContent({ ...content, description: event.target.value })} className={`mt-1 min-h-24 ${fieldClass}`} /></label><label className="text-xs font-black text-slate-700">Thời gian (phút)<input type="number" min={0} value={content.timeLimitMinutes || 0} onChange={event => updateContent({ ...content, timeLimitMinutes: Number(event.target.value) || undefined })} className={`mt-1 ${fieldClass}`} /></label><label className="text-xs font-black text-slate-700">Hiển thị<select value={visibility} onChange={event => { setVisibility(event.target.value as ExamVisibility); setDirty(true); }} className={`mt-1 ${fieldClass}`}><option value="draft">Bản nháp</option><option value="public">Công khai</option><option value="assignment">Theo link/bài giao</option></select></label></div><UniversalWholeImportPanel content={content} definition={definition} onChange={updateContent} onImported={() => setStarterPartsRevealed(true)} onMessage={setMessage} />{fixedStarterListening && <StarterQuickAssetPanel token={token} content={content} assets={assets} onAsset={asset => setAssets(previous => [asset, ...previous.filter(item => item.id !== asset.id)])} onChange={updateContent} />}{moduleId === 'starter' && !starterPartsRevealed && <button type="button" onClick={() => setStarterPartsRevealed(true)} className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-xs font-black text-indigo-700">Tạo đề trống và soạn từng Part</button>}<AssetField token={token} kind="image" label="Ảnh bìa" assets={assets} assetId={content.coverAssetId} onUploaded={asset => setAssets(previous => [asset, ...previous.filter(item => item.id !== asset.id)])} pasteImages={moduleId === 'starter'} onChange={asset => updateContent({ ...content, coverAssetId: asset?.id, coverUrl: asset?.url })} /><label className="flex items-center gap-2 text-sm font-black text-slate-700"><input type="checkbox" checked={content.showReviewAfterSubmit} onChange={event => updateContent({ ...content, showReviewAfterSubmit: event.target.checked })} />Cho học sinh xem đáp án sau khi hoàn thành và được chấm xong</label></div>}
        {step > 0 && step <= content.parts.length && <PartEditor token={token} content={content} partIndex={step - 1} assets={assets} onAssets={asset => setAssets(previous => [asset, ...previous.filter(item => item.id !== asset.id)])} onChange={part => updateContent({ ...content, parts: content.parts.map((item, index) => index === step - 1 ? part : item) })} onContentChange={updateContent} onMessage={setMessage} />}
        {step === content.parts.length + 1 && <div className="space-y-4"><div className="rounded-2xl bg-white p-5"><p className="text-xs font-black uppercase text-indigo-600">Preview cấu trúc</p><h3 className="mt-1 text-2xl font-black text-slate-900">{content.title}</h3><p className="mt-2 text-sm font-semibold text-slate-500">{content.description}</p><p className="mt-3 text-sm font-black text-indigo-700">{content.parts.length} Part/Section · {totalQuestions} câu/task · {content.timeLimitMinutes || 'Không giới hạn'} phút</p></div>{content.parts.map(part => <article key={part.id} className="rounded-2xl border border-slate-200 bg-white p-4"><h4 className="font-black text-slate-900">Part {part.part}: {part.title}</h4>{part.passage && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{part.passage}</p>}{part.imageUrl && <img src={part.imageUrl} alt="" className="mt-3 max-h-72 rounded-xl object-contain" />}{part.audioUrl && <audio controls src={part.audioUrl} className="mt-3 w-full" /> }{part.blocks?.length ? <div className="mt-3 space-y-2">{examPartUnits(part).map(unit => <div key={unit.id} className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-black text-violet-700">{unit.interaction?.family} → {unit.interaction?.subtype} → {unit.interaction?.variant}</p><p className="mt-1 text-sm font-black text-slate-800">{unit.title} · {unit.questions.length} câu</p></div>)}</div> : <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm font-semibold text-slate-700">{part.questions.map(question => <li key={question.id}>{question.prompt} <span className="text-xs text-slate-400">({question.type})</span></li>)}</ol>}</article>)}</div>}
      </section>
    </div>
  );

  return (
    <div className="space-y-6" id="generic-exam-admin" data-module={moduleId} data-paper={paperId}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[.18em] text-indigo-600">{definition.level}</p><h2 className="mt-1 flex items-center gap-2 text-2xl font-black text-slate-900">{paperId === 'listening' ? <Headphones className="text-sky-600" /> : <BookOpenText className="text-indigo-600" />}{definition.displayName}</h2><p className="mt-1 text-sm font-semibold text-slate-500">{definition.description}</p></div><div className="flex gap-2"><button type="button" onClick={onBack} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-black"><ArrowLeft size={15} />Loại bài khác</button><button type="button" onClick={startNew} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-black text-white"><Plus size={17} />Soạn đề mới</button></div></div>
      {message && <div className={`rounded-2xl border p-3 text-sm font-bold ${message.error ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{message.text}</div>}
      <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white"><table className="min-w-[960px] w-full text-left text-xs"><thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-600"><tr><th className="p-4">Bộ đề</th><th className="p-4">Cấu trúc</th><th className="p-4">Trạng thái</th><th className="p-4">Link</th><th className="p-4">Thao tác</th></tr></thead><tbody>{sets.map(set => <tr key={set.id} className="border-t border-slate-100"><td className="p-4"><p className="font-black text-slate-900">{set.title}</p><p className="mt-1 max-w-sm text-slate-500 line-clamp-2">{set.description}</p></td><td className="p-4 font-bold text-slate-600">Theo JSON/bản nháp</td><td className="p-4 font-bold text-slate-600">{set.status === 'published' ? `Đã xuất bản v${set.publishedVersionNumber || 1}` : 'Bản nháp'}</td><td className="p-4"><LibraryLinkStatus visibility={set.visibility} privateUrl={set.visibility === 'assignment' && set.shareToken ? previewUrl(set) : undefined} onCopyPrivateLink={set.shareToken ? async () => { await navigator.clipboard.writeText(previewUrl(set)); setMessage({ text: 'Đã sao chép link riêng.' }); } : undefined} /></td><td className="p-4"><LibraryRowActions onPlay={() => { window.location.href = previewUrl(set); }} playDisabled={set.status !== 'published'} onEdit={() => void edit(set.id)} onClone={async () => { await examPlatformApi.cloneSet(token, moduleId, paperId, set.id); await load(); }} onResults={() => void showResults(set)} onDelete={async () => { if (!window.confirm(`Lưu trữ bộ đề "${set.title}"? Kết quả cũ vẫn được giữ.`)) return; await examPlatformApi.archiveSet(token, moduleId, paperId, set.id); await load(); }} disabled={busy} deleteTitle="Lưu trữ bộ đề" /></td></tr>)}{sets.length === 0 && <tr><td colSpan={5} className="p-10 text-center font-semibold text-slate-500">Chưa có bộ đề {definition.displayName}.</td></tr>}</tbody></table></div>
      {results && resultSet && <section className="rounded-3xl border border-slate-200 bg-white p-5"><div className="mb-4 flex items-center justify-between"><div><h3 className="text-lg font-black text-slate-900">Kết quả: {resultSet.title}</h3><p className="text-xs font-semibold text-slate-500">{results.length} lượt làm bài</p></div><button type="button" onClick={() => setResults(null)} className="rounded-xl border border-slate-200 p-2"><X size={16} /></button></div><div className="space-y-3">{results.map(attempt => <ManualResult key={attempt.id} attempt={attempt} token={token} moduleId={moduleId} paperId={paperId} setId={resultSet.id} onGraded={() => void showResults(resultSet)} />)}{results.length === 0 && <p className="py-8 text-center text-sm font-semibold text-slate-500">Chưa có lượt làm bài.</p>}</div></section>}
    </div>
  );
}

function ManualResult({ attempt, token, moduleId, paperId, setId, onGraded }: { key?: string; attempt: any; token: string; moduleId: Exclude<ExamModuleId, 'mover'>; paperId: ExamPaperId; setId: string; onGraded: () => void }) {
  const [open, setOpen] = useState(false);
  const [grades, setGrades] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const pending = (attempt.questions || []).filter((question: any) => question.pendingManualReview);
  return <article className="rounded-2xl border border-slate-200 p-4"><button type="button" onClick={() => setOpen(value => !value)} className="grid w-full gap-2 text-left text-xs font-bold text-slate-700 sm:grid-cols-5"><span>{attempt.studentName || 'Học sinh'}</span><span>{attempt.status === 'pending_review' ? 'Chờ giáo viên chấm' : `Điểm: ${attempt.score}`}</span><span>Đúng: {attempt.correctCount}/{attempt.totalCount}</span><span>{attempt.durationSeconds || 0}s</span><span>{new Date(attempt.completedAt).toLocaleString('vi-VN')}</span></button>{open && <div className="mt-4 space-y-3">{(attempt.questions || []).map((question: any) => <div key={question.questionId} className={`rounded-xl border p-3 text-xs ${question.pendingManualReview ? 'border-violet-200 bg-violet-50' : question.correct ? 'border-emerald-200 bg-emerald-50' : question.unanswered ? 'border-amber-200 bg-amber-50' : 'border-rose-200 bg-rose-50'}`}><p className="font-black">Part {question.part} · {question.prompt}</p><p className="mt-1 whitespace-pre-wrap">Học sinh: {Array.isArray(question.userAnswer) ? question.userAnswer.join(', ') : question.userAnswer || 'Bỏ trống'}</p>{question.pendingManualReview && <label className="mt-2 flex items-center gap-2 font-black">Điểm<input type="number" min={0} max={question.maxPoints} step={0.5} value={grades[question.questionId] ?? ''} onChange={event => setGrades(previous => ({ ...previous, [question.questionId]: Number(event.target.value) }))} className="w-24 rounded-lg border border-violet-300 px-2 py-1" />/{question.maxPoints}</label>}</div>)}{attempt.status === 'pending_review' && <button type="button" disabled={busy || pending.some((question: any) => grades[question.questionId] === undefined)} onClick={async () => { setBusy(true); try { await examPlatformApi.manualGrade(token, moduleId, paperId, setId, attempt.id, grades); onGraded(); } finally { setBusy(false); } }} className="rounded-xl bg-violet-700 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50">Xác nhận điểm Writing</button>}</div>}</article>;
}

export default function GenericExamModuleAdmin({ token, moduleId }: Props) {
  const definitions = useMemo(() => getModuleExamPaperDefinitions(moduleId), [moduleId]);
  const [paperId, setPaperId] = useState<ExamPaperId | null>(null);
  if (paperId) return <PaperAdmin token={token} moduleId={moduleId} paperId={paperId} onBack={() => setPaperId(null)} />;
  return <div className="space-y-5" id="generic-exam-paper-admin-hub"><div><p className="text-xs font-black uppercase tracking-[.18em] text-indigo-600">{moduleId}</p><h2 className="mt-1 text-2xl font-black text-slate-900">Chọn loại bài thi</h2><p className="mt-1 text-sm font-semibold text-slate-500">Mỗi paper có cấu trúc Part, validation và cách chấm riêng.</p></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{definitions.map(definition => <button type="button" key={definition.paperId} onClick={() => setPaperId(definition.paperId)} className="rounded-3xl border border-indigo-200 bg-gradient-to-br from-white to-indigo-50 p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">{definition.paperId === 'listening' ? <Headphones size={30} className="text-sky-700" /> : <BookOpenText size={30} className="text-indigo-700" />}<span className="mt-4 block text-xl font-black text-slate-900">{definition.displayName}</span><span className="mt-2 block text-sm font-semibold text-slate-600">{definition.parts.length} Part/Section · {definition.totalQuestionCount} câu/task</span></button>)}</div></div>;
}
