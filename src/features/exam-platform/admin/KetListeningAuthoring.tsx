import { Crop, LoaderCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ListeningAssetPicker } from '../../listening/admin/ListeningAssetPicker';
import { listeningApi } from '../../listening/api';
import type { ListeningAsset, ListeningAssetKind } from '../../listening/types';
import { cropListeningImage, createListeningImageCropper } from '../../listening-editor/smart-import/cropImage';
import { detectKetListeningFrames } from '../ketListeningFrameDetection';
import type { SmartImportCrop } from '../../listening-editor/smart-import/types';
import { groupKetListeningPart1OptionCrops, validateKetListeningCropPlan, type KetListeningSourceLayout } from '../ketListeningCrops';
import { getKetListeningImageLayout } from '../ketListeningMigration';
import type { ExamDisplayExample, ExamOption, ExamPartContent, ExamQuestion } from '../types';
import { FlyerPart3Editor } from './FlyerListeningAuthoring';
import KetListeningCropPlanner from './KetListeningCropPlanner';

interface Props {
  token: string;
  part: ExamPartContent;
  assets: ListeningAsset[];
  onAssets: (asset: ListeningAsset) => void;
  onChange: (part: ExamPartContent) => void;
}

const fieldClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100';
const makeId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const parseAnswers = (value: string) => value.split('|').map(item => item.trim()).filter(Boolean).slice(0, 30);

function nextNumber(part: ExamPartContent) {
  return Math.max(0, ...part.questions.map(question => question.number)) + 1;
}

function threeOptions(): ExamOption[] {
  return ['A', 'B', 'C'].map(label => ({ id: makeId('ket-listening-option'), label, text: `Option ${label}` }));
}

function choiceQuestion(part: ExamPartContent, prompt: string): ExamQuestion {
  const number = nextNumber(part);
  const displayNumber = Math.max(1, ...part.questions.map(question => question.displayNumber || 0)) + 1;
  return { id: makeId('ket-listening-question'), number, displayNumber, type: 'single-choice', prompt, options: threeOptions(), correctOptionIds: [], acceptedAnswers: [], points: 1 };
}

function shortQuestion(part: ExamPartContent, prompt = ''): ExamQuestion {
  const number = nextNumber(part);
  const displayNumber = Math.max(1, ...part.questions.map(question => question.displayNumber || 0)) + 1;
  return { id: makeId('ket-listening-question'), number, displayNumber, type: 'short-answer', prompt: prompt || `Field ${displayNumber}`, options: [], correctOptionIds: [], acceptedAnswers: [], points: 1, maxWords: 5 };
}

function CountControls({ count, onAdd, onRemove }: { count: number; onAdd: () => void; onRemove: () => void }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-3" data-ket-listening-count-controls>
    <p className="text-sm font-black text-sky-950">{count} câu chấm điểm · có thể thêm/bớt theo đề gốc</p>
    <div className="flex gap-2">
      <button type="button" onClick={onAdd} className="rounded-xl border border-sky-300 bg-white px-4 py-2 text-xs font-black text-sky-900">+ Thêm câu</button>
      <button type="button" disabled={count <= 1} onClick={onRemove} className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-xs font-black text-rose-800 disabled:cursor-not-allowed disabled:opacity-40">Xóa câu cuối</button>
    </div>
  </div>;
}

function ImagePicker({ label, value, assets, token, onAssets, onChange, compact = false }: {
  label: string;
  value?: string;
  assets: ListeningAsset[];
  token: string;
  onAssets: (asset: ListeningAsset) => void;
  onChange: (asset?: ListeningAsset) => void;
  compact?: boolean;
}) {
  const upload = async (file: File, kind: ListeningAssetKind) => {
    const asset = await listeningApi.uploadAsset(token, file, kind);
    onAssets(asset);
    return asset;
  };
  return <ListeningAssetPicker
    compact={compact}
    pasteImages
    label={label}
    kind="image"
    value={value}
    assets={assets}
    allowedMimeTypes={['image/png', 'image/jpeg', 'image/webp']}
    aiCapability={{ enabled: false, reason: 'Giáo viên tải hoặc dán ảnh từ bộ nhớ đệm.' }}
    onUpload={upload}
    onChange={(assetId, uploadedAsset) => onChange(uploadedAsset || (assetId ? assets.find(asset => asset.id === assetId) : undefined))}
  />;
}

function ExampleEditor({ examples, onChange, imageTools }: { examples: ExamDisplayExample[]; onChange: (examples: ExamDisplayExample[]) => void; imageTools?: Pick<Props, 'token' | 'assets' | 'onAssets'> }) {
  const latestExamples = useRef(examples);
  latestExamples.current = examples;
  const example = examples[0] || { prompt: '', answer: '' };
  const exampleChoices = (value: ExamDisplayExample) => ['A', 'B', 'C'].map(label => {
    const option = value.options?.find(item => item.label.toUpperCase() === label);
    return { ...option, label, text: option?.text || '' };
  });
  const options = exampleChoices(example);
  const update = (patch: Partial<ExamDisplayExample>) => {
    const current = latestExamples.current[0] || { prompt: '', answer: '' };
    onChange([{ ...current, ...patch }, ...latestExamples.current.slice(1)]);
  };
  const updateOption = (index: number, patch: Partial<NonNullable<ExamDisplayExample['options']>[number]>) => {
    const current = latestExamples.current[0] || { prompt: '', answer: '' };
    const currentOptions = exampleChoices(current);
    update({ options: currentOptions.map((option, optionIndex) => optionIndex === index ? { ...option, ...patch } : option) });
  };
  const selected = (option: typeof options[number]) => example.answer.trim().toLocaleUpperCase() === option.label || Boolean(option.text.trim() && example.answer.trim().toLocaleLowerCase() === option.text.trim().toLocaleLowerCase());
  return <section className="space-y-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-4" data-ket-listening-example-editor>
    <div className="grid gap-3 md:grid-cols-2"><label className="text-xs font-black text-indigo-950">Example không chấm điểm<input value={example.prompt} onChange={event => update({ prompt: event.target.value })} className={`mt-1 ${fieldClass}`} /></label>
    <label className="text-xs font-black text-indigo-950">Đáp án in sẵn<input value={example.answer} onChange={event => update({ answer: event.target.value })} className={`mt-1 ${fieldClass}`} placeholder="A, B hoặc C" /></label></div>
    {imageTools && <ImagePicker label="Ảnh chung của example (tùy chọn)" value={example.imageAssetId} {...imageTools} onChange={asset => update({ imageAssetId: asset?.id, imageUrl: asset?.url })} />}
    <div className="grid gap-3 md:grid-cols-3">{options.map((option, index) => <div key={option.label} className={`rounded-xl border p-3 ${selected(option) ? 'border-emerald-500 bg-emerald-50' : 'border-indigo-200 bg-white'}`} data-example-answer={selected(option) ? 'correct' : undefined}>
      <label className="flex items-center gap-2 text-xs font-black text-slate-900"><input type="radio" name={`ket-example-${imageTools ? 'image' : 'text'}`} checked={selected(option)} onChange={() => update({ answer: option.label })} />Lựa chọn {option.label}{selected(option) ? ' · Đáp án example' : ''}</label>
      <input className={`mt-2 ${fieldClass}`} aria-label={`Nội dung example ${option.label}`} value={option.text} onChange={event => updateOption(index, { text: event.target.value })} />
      {imageTools && <div className="mt-2"><ImagePicker compact label={`Ảnh example ${option.label} (tùy chọn)`} value={option.imageAssetId} {...imageTools} onChange={asset => updateOption(index, { imageAssetId: asset?.id, imageUrl: asset?.url })} /></div>}
    </div>)}</div>
  </section>;
}

function DisplayNumber({ question, onChange }: { question: ExamQuestion; onChange: (question: ExamQuestion) => void }) {
  return <label className="text-xs font-black text-slate-700">Số in trên đề<input type="number" min={1} value={question.displayNumber || question.number} onChange={event => onChange({ ...question, displayNumber: Math.max(1, Number(event.target.value) || 1) })} className={`mt-1 ${fieldClass}`} /></label>;
}

function AcceptedAnswers({ question, onChange }: { question: ExamQuestion; onChange: (question: ExamQuestion) => void }) {
  return <label className="text-xs font-black text-slate-700">Đáp án chính thức (ngăn cách bằng |)<input value={question.acceptedAnswers.join(' | ')} onChange={event => onChange({ ...question, acceptedAnswers: parseAnswers(event.target.value) })} className={`mt-1 ${fieldClass}`} /></label>;
}

function PartOne({ token, part, assets, onAssets, onChange }: Props) {
  type Target = { questionId: string; optionId?: string };
  type BatchPlan = { sourceAssetId: string; sourceUrl: string; fingerprint: string; groups: (SmartImportCrop | null)[][]; detectedPrintedExample: boolean; candidates?: SmartImportCrop[] };
  const [selection, setSelection] = useState<Target | null>(null);
  const [crop, setCrop] = useState<SmartImportCrop | null>(null);
  const [cropping, setCropping] = useState(false);
  const [batchCropping, setBatchCropping] = useState(false);
  const [batchNotice, setBatchNotice] = useState('');
  const [batchPlan, setBatchPlan] = useState<BatchPlan | null>(null);
  const [sourceLayout, setSourceLayout] = useState<KetListeningSourceLayout>('single-page');
  const [pageSplit, setPageSplit] = useState(.5);
  const [allowExample, setAllowExample] = useState(Boolean(part.examples?.length));
  const [exampleImageCount, setExampleImageCount] = useState(() => {
    const example = part.examples?.[0];
    const count = example?.options?.filter(option => option.imageAssetId || option.imageUrl).length || 0;
    return count || (example?.imageAssetId || example?.imageUrl ? 1 : 3);
  });
  const activeRef = useRef(true);
  useEffect(() => {
    activeRef.current = true;
    return () => { activeRef.current = false; };
  }, []);
  useEffect(() => {
    // Coordinates selected on a different source cannot be reused implicitly.
    setSelection(null);
    setCrop(null);
  }, [part.imageAssetId, part.imageUrl]);
  const latestPartRef = useRef(part);
  latestPartRef.current = part;
  const cropSettingsRef = useRef({ sourceLayout, pageSplit, allowExample, exampleImageCount });
  cropSettingsRef.current = { sourceLayout, pageSplit, allowExample, exampleImageCount };
  const fingerprint = (value: ExamPartContent) => JSON.stringify(value);
  const batchFingerprint = (value: ExamPartContent) => JSON.stringify({ part: value, cropSettings: cropSettingsRef.current });
  const selectedQuestion = part.questions.find(question => question.id === selection?.questionId);
  const selectedOption = selectedQuestion?.options.find(option => option.id === selection?.optionId);
  const selectedLayout = selectedQuestion ? getKetListeningImageLayout(selectedQuestion) : undefined;
  const selectionActive = Boolean(selectedQuestion && (selection?.optionId
    ? selectedLayout?.kind === 'options' && selectedOption && selectedLayout.optionLabels?.includes(selectedOption.label)
    : selectedLayout?.kind === 'shared'));
  const imageCount = (question: ExamQuestion) => {
    const layout = getKetListeningImageLayout(question);
    return layout.kind === 'shared' ? 1 : layout.optionLabels?.length || 0;
  };
  const expectedImageCount = part.questions.reduce((total, question) => total + imageCount(question), 0);
  const cropLabels = part.questions.map(question => {
    const layout = getKetListeningImageLayout(question);
    return (layout.kind === 'shared' ? ['Chung'] : layout.optionLabels || []).map(label => `${question.displayNumber || question.number} · ${label}`);
  });
  const cropErrors = batchPlan ? validateKetListeningCropPlan(batchPlan.groups, part.questions.map(imageCount)) : [];
  const visibleImageCount = part.questions.reduce((total, question) => {
    const layout = getKetListeningImageLayout(question);
    return total + (layout.kind === 'shared' ? Number(Boolean(question.imageAssetId && question.imageUrl))
      : question.options.filter(option => layout.optionLabels?.includes(option.label) && option.imageAssetId && option.imageUrl).length);
  }, 0);
  const updateQuestion = (questionId: string, patch: Partial<ExamQuestion>) => {
    const current = latestPartRef.current;
    onChange({ ...current, questions: current.questions.map(question => question.id === questionId ? { ...question, ...patch } : question) });
  };
  const attachAsset = (target: Target, asset?: ListeningAsset) => {
    const current = latestPartRef.current;
    const question = current.questions.find(item => item.id === target.questionId);
    if (!question) return;
    if (asset) onAssets(asset);
    const patch = target.optionId
      ? { options: question.options.map(option => option.id === target.optionId ? { ...option, imageAssetId: asset?.id, imageUrl: asset?.url } : option) }
      : { imageAssetId: asset?.id, imageUrl: asset?.url };
    updateQuestion(target.questionId, { ...patch, imageLayout: getKetListeningImageLayout(question) });
  };
  const checkSnapshot = (snapshot: string) => {
    if (!activeRef.current) throw new Error('Đã rời phần crop ảnh. Chưa gán ảnh vào bài; hãy mở lại Part 1 để tiếp tục.');
    if (fingerprint(latestPartRef.current) !== snapshot) throw new Error('Nội dung, thứ tự câu, bố cục hoặc ảnh nguồn đã đổi trong lúc xử lý. Chưa gán ảnh; hãy dò hoặc crop lại trên bản đang soạn.');
  };
  const checkBatchSnapshot = (snapshot: string) => {
    if (!activeRef.current) throw new Error('Đã rời phần crop ảnh. Chưa gán ảnh vào bài; hãy mở lại Part 1 để tiếp tục.');
    if (batchFingerprint(latestPartRef.current) !== snapshot) throw new Error('Nội dung, ảnh nguồn hoặc cách chia trang đã đổi trong lúc xử lý. Chưa gán ảnh; hãy dò lại trên bản đang soạn.');
  };
  const applyCrop = async () => {
    if (!selection || !part.imageAssetId || !part.imageUrl || !selectionActive || !crop || cropping || batchCropping) return;
    const target = { ...selection };
    const snapshot = fingerprint(part);
    const sourceAssetId = part.imageAssetId;
    const sourceUrl = part.imageUrl;
    const selectedCrop = { ...crop };
    setCropping(true); setBatchNotice('');
    try {
      const suffix = selectedOption?.label || 'shared';
      const file = await cropListeningImage(sourceUrl, selectedCrop, `ket-listening-part1-${selectedQuestion?.displayNumber || selectedQuestion?.number}-${suffix}.png`);
      checkSnapshot(snapshot);
      const asset = await listeningApi.uploadAsset(token, file, 'image', { derivedFromAssetId: sourceAssetId, crop: selectedCrop });
      checkSnapshot(snapshot);
      onAssets(asset);
      attachAsset(target, asset);
      setBatchNotice('Đã gán ảnh crop vào đúng vị trí đã chọn.');
      setBatchPlan(null);
    } catch (reason: any) {
      setBatchNotice(reason?.message || 'Không thể tạo ảnh crop cho vị trí này.');
    } finally { setCropping(false); }
  };
  const detectCropPlan = async () => {
    if (!part.imageAssetId || !part.imageUrl || cropping || batchCropping) return;
    const snapshot = batchFingerprint(part);
    const settings = { ...cropSettingsRef.current };
    const sourceAssetId = part.imageAssetId;
    const sourceUrl = part.imageUrl;
    setBatchCropping(true); setBatchPlan(null); setBatchNotice('Đang dò khung ảnh theo bố cục của từng câu…');
    try {
      const detected = await detectKetListeningFrames(sourceUrl);
      checkBatchSnapshot(snapshot);
      const grouped = groupKetListeningPart1OptionCrops(detected, part.questions.map(imageCount), settings.allowExample ? settings.exampleImageCount : undefined, { sourceLayout: settings.sourceLayout, pageSplit: settings.pageSplit });
      if (grouped.error) {
        setBatchPlan({ sourceAssetId, sourceUrl, fingerprint: snapshot, groups: part.questions.map(question => Array.from({ length: imageCount(question) }, () => null)), detectedPrintedExample: false, candidates: detected.map(frame => frame.crop) });
        setBatchNotice(`${grouped.error} Bạn có thể chọn khung gợi ý hoặc vẽ lại từng vị trí ngay trên ảnh bên dưới, rồi gán tất cả trong một lượt.`);
        return;
      }
      setBatchPlan({ sourceAssetId, sourceUrl, fingerprint: snapshot, groups: grouped.questionGroups, detectedPrintedExample: grouped.detectedPrintedExample });
      setBatchNotice(`Đã nhận đủ ${expectedImageCount} ảnh của ${part.questions.length} câu${grouped.detectedPrintedExample ? ', bỏ qua nhóm example ở đầu' : ''}. ${grouped.notices?.join(' ') || ''} Kiểm tra hoặc chỉnh lại từng vùng trên ảnh trước khi gán.`);
    } catch (reason: any) { setBatchNotice(reason?.message || 'Không thể xác định các nhóm ảnh. Hãy crop thủ công.'); }
    finally { setBatchCropping(false); }
  };
  const applyBatchPlan = async () => {
    if (!batchPlan || cropping || batchCropping) return;
    setBatchCropping(true); setBatchNotice('Đang tạo các ảnh theo bản xem trước…');
    try {
      checkBatchSnapshot(batchPlan.fingerprint);
      const sourceQuestions = latestPartRef.current.questions;
      const validationErrors = validateKetListeningCropPlan(batchPlan.groups, sourceQuestions.map(imageCount));
      if (validationErrors.length) throw new Error(validationErrors[0]);
      const cropFromSource = await createListeningImageCropper(batchPlan.sourceUrl);
      checkBatchSnapshot(batchPlan.fingerprint);
      const uploaded = new Map<string, Map<string, ListeningAsset>>();
      let count = 0;
      for (let questionIndex = 0; questionIndex < sourceQuestions.length; questionIndex += 1) {
        const question = sourceQuestions[questionIndex];
        const layout = getKetListeningImageLayout(question);
        const labels = layout.kind === 'shared' ? ['shared'] : layout.optionLabels || [];
        const assetsBySlot = new Map<string, ListeningAsset>();
        for (let slot = 0; slot < labels.length; slot += 1) {
          checkBatchSnapshot(batchPlan.fingerprint);
          const selectedCrop = batchPlan.groups[questionIndex][slot];
          if (!selectedCrop) throw new Error('Chưa chọn đủ vùng ảnh; nội dung bài chưa thay đổi.');
          const label = labels[slot];
          const file = await cropFromSource(selectedCrop, `ket-listening-part1-${question.displayNumber || question.number}-${label}.png`);
          checkBatchSnapshot(batchPlan.fingerprint);
          const asset = await listeningApi.uploadAsset(token, file, 'image', { derivedFromAssetId: batchPlan.sourceAssetId, crop: selectedCrop });
          checkBatchSnapshot(batchPlan.fingerprint); onAssets(asset);
          assetsBySlot.set(label, asset); count += 1;
          setBatchNotice(`Đã tạo ${count}/${expectedImageCount} ảnh; đang giữ nội dung bài cho đến khi hoàn tất…`);
        }
        uploaded.set(question.id, assetsBySlot);
      }
      checkBatchSnapshot(batchPlan.fingerprint);
      const current = latestPartRef.current;
      onChange({ ...current, questions: current.questions.map(question => {
        const bySlot = uploaded.get(question.id);
        if (!bySlot) return question;
        const shared = bySlot.get('shared');
        return shared ? { ...question, imageAssetId: shared.id, imageUrl: shared.url }
          : { ...question, options: question.options.map(option => { const asset = bySlot.get(option.label); return asset ? { ...option, imageAssetId: asset.id, imageUrl: asset.url } : option; }) };
      }) });
      setBatchNotice(`Đã gán đủ ${count} ảnh đúng bố cục và thứ tự câu. Ảnh không dùng trong bố cục hiện tại vẫn được giữ.`);
      setBatchPlan(null);
    } catch (reason: any) { setBatchNotice(reason?.message || 'Không thể hoàn tất crop. Nội dung bài chưa bị thay đổi.'); }
    finally { setBatchCropping(false); }
  };
  const beginBatchSelection = () => {
    if (!part.imageAssetId || !part.imageUrl || cropping || batchCropping) return;
    setBatchPlan({ sourceAssetId: part.imageAssetId, sourceUrl: part.imageUrl, fingerprint: batchFingerprint(part), groups: part.questions.map(question => Array.from({ length: imageCount(question) }, () => null)), detectedPrintedExample: false });
    setBatchNotice('Chọn lần lượt vị trí ảnh rồi kéo để vẽ vùng trên ảnh nguồn. Tạo và gán tất cả khi đã chọn đủ vùng.');
  };
  const beginCrop = (target: Target) => { setSelection(target); setCrop(null); };

  return <div className="space-y-4" data-ket-listening-part-one>
    <CountControls count={part.questions.length} onAdd={() => onChange({ ...part, questions: [...part.questions, { ...choiceQuestion(part, `Picture question ${part.questions.length + 1}`), imageLayout: { kind: 'options', optionLabels: ['A', 'B', 'C'] } }] })} onRemove={() => onChange({ ...part, questions: part.questions.slice(0, -1) })} />
    <ExampleEditor examples={part.examples || []} imageTools={{ token, assets, onAssets }} onChange={examples => onChange({ ...latestPartRef.current, examples })} />
    <ImagePicker label="Ảnh trang nguồn để crop các vị trí ảnh theo từng câu" value={part.imageAssetId} assets={assets} token={token} onAssets={onAssets} onChange={asset => { setBatchPlan(null); onChange({ ...latestPartRef.current, imageAssetId: asset?.id, imageUrl: asset?.url }); }} />
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
      <p className="text-sm font-black text-emerald-950">Dò ảnh theo bố cục đã chọn</p>
      <p className="text-xs font-semibold text-emerald-900">Mỗi câu dùng một ảnh chung hoặc các ảnh của lựa chọn đã đánh dấu. Dò tự động rồi kiểm tra, kéo chỉnh hoặc vẽ thêm vùng còn thiếu ngay trên ảnh nguồn. Chỉ gán khi đủ các vị trí theo thứ tự câu. Ảnh trang nguồn chỉ dùng để soạn bài.</p>
      <div className="flex flex-wrap items-end gap-3"><label className="min-w-48 text-xs font-black text-emerald-950">Bố cục ảnh nguồn<select data-ket-crop-source-layout value={sourceLayout} disabled={cropping || batchCropping} onChange={event => { setSourceLayout(event.target.value as KetListeningSourceLayout); setBatchPlan(null); setBatchNotice(''); }} className={`mt-1 ${fieldClass}`}><option value="single-page">Một trang</option><option value="two-page">Hai trang nằm ngang · đọc hết trái rồi phải</option></select></label>{sourceLayout === 'two-page' && <label className="text-xs font-black text-emerald-950">Vạch chia hai trang (%)<input data-ket-crop-page-split type="number" min={10} max={90} step={1} value={Math.round(pageSplit * 100)} disabled={cropping || batchCropping} onChange={event => { setPageSplit(Math.max(.1, Math.min(.9, Number(event.target.value) / 100 || .5))); setBatchPlan(null); setBatchNotice(''); }} className={`mt-1 max-w-28 ${fieldClass}`} /></label>}</div>
      <p className="text-xs font-semibold text-emerald-900">Nếu ảnh ghép hai trang bên cạnh nhau, chọn “Hai trang nằm ngang” và đặt vạch chia vào khe giữa hai trang. Bộ dò đọc toàn bộ trang trái trước trang phải; ba ảnh A/B/C vẫn thuộc cùng một câu.</p>
      {sourceLayout === 'two-page' && part.imageUrl && !batchPlan && <div className="relative mx-auto max-w-2xl overflow-hidden rounded-lg border border-blue-300" data-ket-crop-page-preview><img src={part.imageUrl} alt="Vị trí vạch chia trang trái và trang phải" className="block h-auto w-full" /><div className="pointer-events-none absolute inset-y-0 border-l-2 border-red-600" style={{ left: `${pageSplit * 100}%` }} /><span className="absolute left-1 top-1 rounded bg-white px-2 py-1 text-xs font-black text-blue-950">Trang trái · đọc trước</span><span className="absolute right-1 top-1 rounded bg-white px-2 py-1 text-xs font-black text-blue-950">Trang phải · đọc sau</span></div>}
      <div className="flex flex-wrap items-center gap-3"><label className="flex items-center gap-2 text-xs font-black text-emerald-950"><input type="checkbox" checked={allowExample} disabled={cropping || batchCropping} onChange={event => { setAllowExample(event.target.checked); setBatchPlan(null); }} />Nguồn có thể có nhóm example ở đầu</label>{allowExample && <label className="text-xs font-bold text-emerald-950">Số ảnh example<select value={exampleImageCount} disabled={cropping || batchCropping} onChange={event => { setExampleImageCount(Number(event.target.value)); setBatchPlan(null); }} className="ml-2 rounded-lg border border-emerald-300 bg-white p-2">{[1, 2, 3].map(count => <option key={count} value={count}>{count}</option>)}</select></label>}</div>
      <button type="button" data-ket-listening-action="detect-part1-layout" disabled={batchCropping || cropping || !part.imageAssetId || !part.imageUrl || !part.questions.length} onClick={() => void detectCropPlan()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50">{batchCropping ? <LoaderCircle size={15} className="animate-spin" /> : <Crop size={15} />}{batchCropping ? 'Đang xử lý…' : 'Dò các vị trí ảnh và xem trước'}</button>
      <button type="button" data-ket-listening-action="plan-part1-layout" disabled={batchCropping || cropping || !part.imageAssetId || !part.imageUrl || !part.questions.length} onClick={beginBatchSelection} className="ml-2 rounded-xl border border-blue-300 bg-white px-4 py-2.5 text-xs font-black text-blue-950">Tự chọn các vùng trên ảnh nguồn</button>
      {batchNotice && <p role="status" className="rounded-xl border border-emerald-200 bg-white p-3 text-xs font-bold text-emerald-900">{batchNotice}</p>}
      {batchPlan && <div className="space-y-3 rounded-xl border border-blue-300 bg-white p-3" data-ket-listening-crop-mapping>
        <p className="text-xs font-black text-blue-950">Ánh xạ ảnh theo thứ tự câu{sourceLayout === 'two-page' ? ' · hết trang trái rồi sang trang phải' : ''}</p>
        <KetListeningCropPlanner imageUrl={batchPlan.sourceUrl} groups={batchPlan.groups} labels={cropLabels} candidates={batchPlan.candidates} disabled={batchCropping || cropping || batchFingerprint(part) !== batchPlan.fingerprint} onChange={groups => setBatchPlan(current => current ? { ...current, groups } : current)} />
        {cropErrors.length > 0 && <p role="status" className="text-xs font-bold text-amber-950">{cropErrors[0]}</p>}
        <button type="button" data-ket-listening-action="apply-part1-layout" disabled={batchCropping || cropping || cropErrors.length > 0 || batchFingerprint(part) !== batchPlan.fingerprint} onClick={() => void applyBatchPlan()} className="rounded-xl border border-blue-800 bg-blue-700 px-4 py-3 text-xs font-black text-white">Tạo và gán {expectedImageCount} ảnh theo bản xem trước</button>
        {batchFingerprint(part) !== batchPlan.fingerprint && <p role="alert" className="text-xs font-bold text-amber-900">Nội dung hoặc cách chia trang đã đổi sau khi dò. Hãy dò lại trước khi gán ảnh.</p>}
      </div>}
    </section>
    <p className={`rounded-xl border p-3 text-xs font-black ${visibleImageCount === expectedImageCount ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>Đã có {visibleImageCount}/{expectedImageCount} ảnh theo bố cục học sinh sẽ nhìn thấy.</p>
    <section className="space-y-3" aria-label="Câu hỏi theo thứ tự đề">{part.questions.map((question, questionIndex) => {
      const layout = getKetListeningImageLayout(question);
      const sharedImage = layout.kind === 'shared';
      const number = question.displayNumber || question.number;
      return <article key={question.id} className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3" data-ket-listening-question-id={question.id}>
        <div className="grid gap-3 md:grid-cols-[120px_minmax(0,1fr)]"><DisplayNumber question={question} onChange={next => updateQuestion(question.id, next)} /><label className="text-xs font-black text-slate-700">Nội dung câu hỏi<input value={question.prompt} onChange={event => updateQuestion(question.id, { prompt: event.target.value })} className={`mt-1 ${fieldClass}`} /></label></div>
        <label className="block text-xs font-black text-slate-900">Bố cục ảnh câu {number}<select className={`mt-1 ${fieldClass}`} value={layout.kind} onChange={event => updateQuestion(question.id, { imageLayout: event.target.value === 'shared' ? { kind: 'shared' } : { kind: 'options', optionLabels: layout.optionLabels?.length ? layout.optionLabels : ['A', 'B', 'C'] } })}><option value="options">Ảnh riêng cho các lựa chọn</option><option value="shared">Một ảnh chung phía trên đáp án</option></select></label>
        {!sharedImage && <div className="flex flex-wrap gap-4 rounded-xl border border-sky-200 bg-sky-50 p-3">{question.options.map(option => <label key={option.id} className="flex items-center gap-2 text-xs font-black text-sky-950"><input type="checkbox" checked={layout.optionLabels?.includes(option.label) || false} disabled={layout.optionLabels?.length === 1 && layout.optionLabels.includes(option.label)} onChange={event => { const selected = new Set(layout.optionLabels || []); if (event.target.checked) selected.add(option.label); else selected.delete(option.label); updateQuestion(question.id, { imageLayout: { kind: 'options', optionLabels: question.options.filter(item => selected.has(item.label)).map(item => item.label) } }); }} />Có ảnh {option.label}</label>)}</div>}
        {sharedImage && <section className="space-y-3 rounded-xl border border-sky-200 bg-sky-50 p-3"><ImagePicker label={`Ảnh chung câu ${number}`} value={question.imageAssetId} assets={assets} token={token} onAssets={onAssets} onChange={asset => attachAsset({ questionId: question.id }, asset)} /><button type="button" onClick={() => beginCrop({ questionId: question.id })} className="rounded-xl border border-indigo-300 bg-white px-3 py-2 text-xs font-black text-indigo-900"><Crop size={13} className="mr-1 inline" />Crop ảnh chung</button></section>}
        <p className="text-xs font-semibold text-slate-700">Đổi bố cục chỉ thay cách hiển thị; các ảnh đã gắn vẫn được giữ để dùng lại.</p>
        <div className="grid gap-3 lg:grid-cols-3">{question.options.map((option, optionIndex) => <div key={option.id} className={`rounded-xl border p-3 ${question.correctOptionIds.includes(option.id) ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
          <label className="flex items-center gap-2 text-xs font-black text-slate-900"><input type="radio" name={`ket-listening-correct-${question.id}`} checked={question.correctOptionIds.includes(option.id)} onChange={() => updateQuestion(question.id, { correctOptionIds: [option.id] })} />Đáp án {option.label}</label>
          <input value={option.text} onChange={event => updateQuestion(question.id, { options: question.options.map(item => item.id === option.id ? { ...item, text: event.target.value } : item) })} className={`mt-2 ${fieldClass}`} aria-label={`Nội dung lựa chọn ${option.label} câu ${number}`} />
          {!sharedImage && layout.optionLabels?.includes(option.label) && <div className="mt-2 space-y-2"><ImagePicker compact label={`Ảnh ${option.label} câu ${number}`} value={option.imageAssetId} assets={assets} token={token} onAssets={onAssets} onChange={asset => attachAsset({ questionId: question.id, optionId: option.id }, asset)} /><button type="button" aria-pressed={selection?.questionId === question.id && selection?.optionId === option.id} onClick={() => beginCrop({ questionId: question.id, optionId: option.id })} className="w-full rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-2 text-xs font-black text-indigo-900"><Crop size={13} className="mr-1 inline" />Crop ảnh {option.label}</button></div>}
        </div>)}</div>
      </article>;
    })}</section>
    {selection && selectedQuestion && <section className="space-y-3 rounded-2xl border border-blue-200 bg-blue-50 p-4" data-ket-listening-manual-crop>
      <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-black text-blue-950">Crop câu {selectedQuestion.displayNumber || selectedQuestion.number} · {selectedOption ? `ảnh ${selectedOption.label}` : 'ảnh chung'}</p><p className="text-xs font-semibold text-blue-900">Kéo vùng trên ảnh nguồn rồi dùng vùng crop này.</p></div><button type="button" onClick={() => setSelection(null)} className="rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-black text-blue-900">Đóng</button></div>
      {part.imageUrl ? <KetListeningCropPlanner imageUrl={part.imageUrl} groups={[[crop]]} labels={[[`${selectedQuestion.displayNumber || selectedQuestion.number} · ${selectedOption?.label || 'Chung'}`]]} disabled={cropping || batchCropping || !selectionActive} onChange={groups => setCrop(groups[0]?.[0] || null)} /> : <p className="rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-900">Hãy gắn ảnh nguồn trước khi crop.</p>}
      <button type="button" disabled={cropping || batchCropping || !part.imageAssetId || !part.imageUrl || !selectionActive || !crop} onClick={() => void applyCrop()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-black text-white disabled:opacity-40">{cropping ? <LoaderCircle size={15} className="animate-spin" /> : <Crop size={15} />}{cropping ? 'Đang tạo crop…' : 'Dùng vùng crop này'}</button>
      {!selectionActive && <p role="alert" className="text-xs font-bold text-amber-900">Bố cục đã thay đổi. Hãy chọn lại vị trí ảnh cần crop trong câu hỏi.</p>}
    </section>}
  </div>;
}
function PartTwo({ token, part, assets, onAssets, onChange }: Props) {
  const setQuestions = (questions: ExamQuestion[]) => onChange({ ...part, questions, readingScenes: part.readingScenes?.map(scene => ({ ...scene, questionIds: questions.map(question => question.id) })) });
  return <div className="space-y-4" data-ket-listening-part-two>
    <CountControls count={part.questions.length} onAdd={() => setQuestions([...part.questions, { ...shortQuestion(part, `Row ${part.questions.length + 1}`), maxWords: 1 }])} onRemove={() => setQuestions(part.questions.slice(0, -1))} />
    <ImagePicker label="Ảnh đề duy nhất · hiển thị bên trái khu vực làm bài" value={part.imageAssetId} assets={assets} token={token} onAssets={onAssets} onChange={asset => onChange({ ...part, imageAssetId: asset?.id, imageUrl: asset?.url })} />
    <FlyerPart3Editor token={token} part={part} assets={assets} onAssets={onAssets} onChange={onChange} singleImage />
  </div>;
}

function ChoiceRows({ part, onChange }: { part: ExamPartContent; onChange: (part: ExamPartContent) => void }) {
  const update = (index: number, question: ExamQuestion) => onChange({ ...part, questions: part.questions.map((item, itemIndex) => itemIndex === index ? question : item) });
  return <div className="space-y-3">{part.questions.map((question, index) => <article key={question.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="grid gap-3 md:grid-cols-[120px_minmax(0,1fr)]"><DisplayNumber question={question} onChange={next => update(index, next)} /><label className="text-xs font-black text-slate-700">Nội dung câu hỏi/hội thoại<input value={question.prompt} onChange={event => update(index, { ...question, prompt: event.target.value })} className={`mt-1 ${fieldClass}`} /></label></div>
    <div className="mt-3 grid gap-2 sm:grid-cols-3">{question.options.slice(0, 3).map((option, optionIndex) => <label key={option.id} className={`rounded-xl border p-3 ${question.correctOptionIds.includes(option.id) ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}><span className="flex items-center gap-2 text-xs font-black text-slate-800"><input type="radio" name={`ket-listening-p3-${question.id}`} checked={question.correctOptionIds.includes(option.id)} onChange={() => update(index, { ...question, correctOptionIds: [option.id] })} />{String.fromCharCode(65 + optionIndex)}</span><input value={option.text} onChange={event => update(index, { ...question, options: question.options.map(item => item.id === option.id ? { ...item, text: event.target.value } : item) })} className={`mt-2 ${fieldClass}`} /></label>)}</div>
  </article>)}</div>;
}

function PartThree({ part, onChange }: Props) {
  return <div className="space-y-4" data-ket-listening-part-three>
    <CountControls count={part.questions.length} onAdd={() => onChange({ ...part, questions: [...part.questions, choiceQuestion(part, `Dialogue question ${part.questions.length + 1}`)] })} onRemove={() => onChange({ ...part, questions: part.questions.slice(0, -1) })} />
    <p className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-xs font-bold text-indigo-950">Tiêu đề chính của Part 3 được quản lý ở phần thông tin Part phía trên. Giao diện học sinh không lặp lại một khối tiêu đề nhỏ trong nội dung.</p>
    <ExampleEditor examples={part.examples || []} onChange={examples => onChange({ ...part, examples })} />
    <ChoiceRows part={part} onChange={onChange} />
  </div>;
}

function FormPart({ part, onChange }: Props) {
  const update = (index: number, question: ExamQuestion) => onChange({ ...part, questions: part.questions.map((item, itemIndex) => itemIndex === index ? question : item) });
  return <div className="space-y-4" data-ket-listening-form-part>
    <CountControls count={part.questions.length} onAdd={() => onChange({ ...part, questions: [...part.questions, shortQuestion(part)] })} onRemove={() => onChange({ ...part, questions: part.questions.slice(0, -1) })} />
    <label className="block rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-xs font-black text-indigo-950">Thông tin chung và example đã điền<textarea value={part.passage || ''} onChange={event => onChange({ ...part, passage: event.target.value })} className={`mt-2 min-h-44 ${fieldClass}`} placeholder="Chỉ nhập tiêu đề biểu mẫu, thông tin chung và ví dụ đã điền. Nhãn các câu cần học sinh điền được nhập ở từng hàng bên dưới; không lặp lại tại đây." /></label>
    <div className="space-y-3">{part.questions.map((question, index) => <article key={question.id} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 xl:grid-cols-[100px_minmax(180px,1fr)_150px_150px_minmax(220px,1fr)]">
      <DisplayNumber question={question} onChange={next => update(index, next)} />
      <label className="text-xs font-black text-slate-700">Nhãn hàng<input value={question.prompt} onChange={event => update(index, { ...question, prompt: event.target.value })} className={`mt-1 ${fieldClass}`} /></label>
      <label className="text-xs font-black text-slate-700">Chữ/ký hiệu trước ô<input value={question.answerPrefix || ''} onChange={event => update(index, { ...question, answerPrefix: event.target.value.slice(0, 20) })} className={`mt-1 ${fieldClass}`} placeholder="Ví dụ: 98" /></label>
      <label className="text-xs font-black text-slate-700">Chữ/ký hiệu sau ô<input value={question.answerSuffix || ''} onChange={event => update(index, { ...question, answerSuffix: event.target.value.slice(0, 80) })} className={`mt-1 ${fieldClass}`} placeholder="Ví dụ: Road" /></label>
      <AcceptedAnswers question={question} onChange={next => update(index, { ...next, maxWords: next.maxWords || 5 })} />
    </article>)}</div>
  </div>;
}

export default function KetListeningAuthoring(props: Props) {
  return <section id="ket-listening-authoring" className="space-y-4" data-ket-listening-part={props.part.part}>
    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4"><p className="text-xs font-black uppercase tracking-wide text-blue-800">KET Listening · Part {props.part.part}/5</p><p className="mt-1 text-sm font-semibold text-blue-950">Năm Part cố định theo dạng bài; số câu từng Part lấy từ JSON/đề gốc và có thể thêm hoặc bớt. Ảnh tải/dán được chọn ngay trong lần thao tác đầu tiên.</p></div>
    {props.part.part === 1 ? <PartOne {...props} />
      : props.part.part === 2 ? <PartTwo {...props} />
        : props.part.part === 3 ? <PartThree {...props} />
          : <FormPart {...props} />}
  </section>;
}
