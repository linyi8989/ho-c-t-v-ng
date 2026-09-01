import { Crop, LoaderCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { ListeningAsset, ListeningAssetKind } from '../../listening/types';
import { ListeningAssetPicker } from '../../listening/admin/ListeningAssetPicker';
import { listeningApi } from '../../listening/api';
import { cropListeningImage } from '../../listening-editor/smart-import/cropImage';
import CropPreview from '../../listening-editor/smart-import/CropPreview';
import VisualCropEditor from '../../listening-editor/smart-import/VisualCropEditor';
import type { SmartImportCrop } from '../../listening-editor/smart-import/types';
import { examPartUnits, replaceExamPartUnit } from '../examStructure';
import {
  detectStarterReadingPart1Crops,
  detectStarterReadingPart3Crops,
  type StarterReadingCropDetection,
} from '../starterReadingWritingCropDetection';
import type { ExamDisplayExample, ExamPartContent, ExamQuestion, ExamReadingScene } from '../types';

interface Props {
  token: string;
  part: ExamPartContent;
  assets: ListeningAsset[];
  onAssets: (asset: ListeningAsset) => void;
  onChange: (part: ExamPartContent) => void;
}

const fieldClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100';
const makeId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const answerText = (answers: string[]) => answers.join(' | ');
const parseAnswers = (value: string) => value.split('|').map(item => item.trim()).filter(Boolean).slice(0, 20);

function ensureYesNo(question: ExamQuestion) {
  const yes = question.options.find(option => /^(yes|true)$/i.test(option.text.trim())) || question.options[0] || { id: makeId('starter-rw-yes'), label: 'YES', text: 'Yes' };
  const no = question.options.find(option => /^(no|false)$/i.test(option.text.trim())) || question.options[1] || { id: makeId('starter-rw-no'), label: 'NO', text: 'No' };
  return {
    ...question,
    type: 'true-false' as const,
    options: [{ ...yes, label: 'YES', text: 'Yes' }, { ...no, label: 'NO', text: 'No' }],
  };
}

function ImagePicker({
  label,
  value,
  assets,
  token,
  onAssets,
  onChange,
}: {
  label: string;
  value?: string;
  assets: ListeningAsset[];
  token: string;
  onAssets: (asset: ListeningAsset) => void;
  onChange: (asset?: ListeningAsset) => void;
}) {
  const upload = async (file: File, kind: ListeningAssetKind) => {
    const asset = await listeningApi.uploadAsset(token, file, kind);
    onAssets(asset);
    onChange(asset);
    return asset;
  };
  return <ListeningAssetPicker
    label={label}
    kind="image"
    value={value}
    assets={assets}
    aiCapability={{ enabled: false, reason: 'Ảnh của đề do giáo viên tải hoặc dán từ bộ nhớ đệm.' }}
    onUpload={upload}
    onChange={assetId => {
      const selected = assets.find(asset => asset.id === assetId);
      if (selected || !assetId) onChange(selected);
    }}
  />;
}

interface CropSlot {
  key: string;
  label: string;
  imageUrl?: string;
  onApply: (asset: ListeningAsset) => void;
}

function CropSlots({
  sourceAssetId,
  sourceUrl,
  slots,
  token,
  onAssets,
  filePrefix,
  detectCrops,
  onApplyAll,
}: {
  sourceAssetId?: string;
  sourceUrl?: string;
  slots: CropSlot[];
  token: string;
  onAssets: (asset: ListeningAsset) => void;
  filePrefix: string;
  detectCrops?: (imageUrl: string) => Promise<StarterReadingCropDetection>;
  onApplyAll?: (assets: ListeningAsset[]) => void;
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [crop, setCrop] = useState<SmartImportCrop>({ x: 0, y: 0, width: 1, height: 1 });
  const [cropping, setCropping] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [batchCropping, setBatchCropping] = useState(false);
  const [detectedCrops, setDetectedCrops] = useState<SmartImportCrop[]>([]);
  const [detectionConfidence, setDetectionConfidence] = useState(0);
  const [notice, setNotice] = useState('');
  const sourceAssetRef = useRef(sourceAssetId);
  sourceAssetRef.current = sourceAssetId;
  const selected = selectedIndex === null ? undefined : slots[selectedIndex];
  const complete = slots.filter(slot => slot.imageUrl).length;
  useEffect(() => {
    setSelectedIndex(null);
    setDetectedCrops([]);
    setDetectionConfidence(0);
    setNotice('');
  }, [sourceAssetId, sourceUrl]);
  const detectAll = async () => {
    if (!sourceUrl || !detectCrops) return;
    setDetecting(true);
    setNotice('Đang phân tích bố cục ảnh nguồn…');
    try {
      const result = await detectCrops(sourceUrl);
      setDetectedCrops(result.crops.length === slots.length ? result.crops : []);
      setDetectionConfidence(result.confidence);
      setNotice(result.warnings[0] || `Đã tự dò đủ ${result.crops.length}/${slots.length} vùng. Hãy kiểm tra preview trước khi lưu.`);
    } catch (reason: any) {
      setDetectedCrops([]);
      setDetectionConfidence(0);
      setNotice(reason?.message || 'Không thể tự dò vùng crop. Bạn vẫn có thể crop thủ công.');
    } finally {
      setDetecting(false);
    }
  };
  const applyCrop = async () => {
    if (!selected || !sourceAssetId || !sourceUrl) return;
    setCropping(true);
    setNotice('');
    try {
      const file = await cropListeningImage(sourceUrl, crop, `${filePrefix}-${selected.key}.png`);
      const asset = await listeningApi.uploadAsset(token, file, 'image', { derivedFromAssetId: sourceAssetId, crop });
      onAssets(asset);
      selected.onApply(asset);
      setNotice(`Đã lưu ảnh crop cho ${selected.label}.`);
      setSelectedIndex(null);
      setCrop({ x: 0, y: 0, width: 1, height: 1 });
    } catch (reason: any) {
      setNotice(reason?.message || 'Không thể tạo ảnh crop.');
    } finally {
      setCropping(false);
    }
  };
  const applyAllDetected = async () => {
    const sourceId = sourceAssetId;
    if (!sourceId || !sourceUrl || detectedCrops.length !== slots.length || !onApplyAll) return;
    setBatchCropping(true);
    setNotice(`Đang crop và tải 0/${slots.length} ảnh…`);
    try {
      const uploaded: ListeningAsset[] = [];
      for (let offset = 0; offset < detectedCrops.length; offset += 3) {
        if (sourceAssetRef.current !== sourceId) throw new Error('Ảnh nguồn đã thay đổi; đã dừng trước khi ghi dữ liệu crop vào Part.');
        const batch = await Promise.all(detectedCrops.slice(offset, offset + 3).map(async (selectedCrop, localIndex) => {
          const slotIndex = offset + localIndex;
          const file = await cropListeningImage(sourceUrl, selectedCrop, `${filePrefix}-${slots[slotIndex].key}.png`);
          return listeningApi.uploadAsset(token, file, 'image', { derivedFromAssetId: sourceId, crop: selectedCrop });
        }));
        batch.forEach(asset => onAssets(asset));
        uploaded.push(...batch);
        setNotice(`Đang crop và tải ${uploaded.length}/${slots.length} ảnh…`);
      }
      if (sourceAssetRef.current !== sourceId) throw new Error('Ảnh nguồn đã thay đổi; không ghi đè Part mới.');
      onApplyAll(uploaded);
      setDetectedCrops([]);
      setDetectionConfidence(0);
      setNotice(`Đã crop và gắn đủ ${uploaded.length}/${slots.length} ảnh theo đúng thứ tự.`);
    } catch (reason: any) {
      setNotice(reason?.message || 'Không thể hoàn tất crop tự động; dữ liệu Part chưa bị ghi một phần.');
    } finally {
      setBatchCropping(false);
    }
  };
  const confirmSelectedCrop = () => {
    if (selectedIndex !== null && detectedCrops.length === slots.length) {
      setDetectedCrops(current => current.map((item, index) => index === selectedIndex ? crop : item));
      setNotice(`Đã cập nhật vùng tự dò cho ${slots[selectedIndex].label}; chưa upload cho đến khi xác nhận toàn bộ.`);
      setSelectedIndex(null);
      return;
    }
    void applyCrop();
  };
  return <section className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4" data-starter-rw-crop-slots={slots.length}>
    <div>
      <p className="text-sm font-black text-emerald-950">Crop ảnh từ trang nguồn</p>
      <p className="mt-1 text-xs font-semibold text-emerald-800">Chọn từng vị trí, khoanh đúng hình trên ảnh nguồn rồi lưu. Ảnh nguồn chỉ dùng khi soạn; học sinh chỉ nhận các ảnh crop.</p>
    </div>
    <p className={`rounded-xl border bg-white p-3 text-xs font-black ${complete === slots.length ? 'border-emerald-300 text-emerald-800' : 'border-amber-300 text-amber-900'}`}>Đã có {complete}/{slots.length} ảnh crop.</p>
    {detectCrops && <button type="button" data-starter-rw-auto-detect disabled={detecting || batchCropping || !sourceAssetId || !sourceUrl} onClick={() => void detectAll()} className="starter-rw-crop-action inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black">{detecting ? <LoaderCircle size={15} className="animate-spin" /> : <Crop size={15} />}{detecting ? 'Đang tự dò…' : `Tự dò ${slots.length} vùng crop`}</button>}
    <div className="grid gap-3" data-starter-rw-crop-grid>
      {slots.map((slot, index) => <article key={slot.key} className="rounded-xl border border-slate-200 bg-white p-3" data-starter-rw-crop-card>
        <p className="text-xs font-black text-slate-800">{slot.label}</p>
        {detectedCrops[index] && sourceUrl
          ? <div className="starter-rw-crop-thumbnail mt-2" data-starter-rw-detected-preview={slot.key}><CropPreview imageUrl={sourceUrl} crop={detectedCrops[index]} label={`${slot.label} · vùng tự dò`} /></div>
          : <div className="starter-rw-crop-thumbnail mt-2 flex h-28 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
            {slot.imageUrl ? <img src={slot.imageUrl} alt={slot.label} className="h-full w-full object-contain" /> : <span className="text-[11px] font-bold text-slate-400">Chưa crop</span>}
          </div>}
        <button type="button" disabled={!sourceAssetId || !sourceUrl || batchCropping} onClick={() => { setSelectedIndex(index); setCrop(detectedCrops[index] || { x: 0, y: 0, width: 1, height: 1 }); setNotice(''); }} className="starter-rw-crop-action mt-2 w-full rounded-lg px-3 py-2 text-xs font-black"><Crop size={13} className="mr-1 inline" />{detectedCrops[index] ? 'Kiểm tra / chỉnh vùng tự dò' : slot.imageUrl ? 'Crop lại' : 'Chọn vùng crop'}</button>
      </article>)}
    </div>
    {detectedCrops.length === slots.length && <div className="rounded-2xl border border-emerald-300 bg-white p-4" data-starter-rw-auto-crop-review>
      <p className="text-xs font-black text-emerald-900">Đã dò đủ {slots.length} vùng · độ tin cậy {Math.round(detectionConfidence * 100)}%</p>
      <p className="mt-1 text-[11px] font-semibold text-slate-600">Kiểm tra thứ tự preview. Có thể chỉnh từng vùng trước, hoặc xác nhận để crop và gắn toàn bộ.</p>
      <button type="button" disabled={batchCropping || detectionConfidence < .68} aria-busy={batchCropping} onClick={() => void applyAllDetected()} className="starter-rw-crop-confirm mt-3 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black">{batchCropping ? <LoaderCircle size={15} className="animate-spin" /> : <Crop size={15} />}{batchCropping ? `Đang lưu ${slots.length} ảnh…` : `Xác nhận crop và lưu ${slots.length} ảnh`}</button>
    </div>}
    {selected && <div className="space-y-3 rounded-2xl border border-blue-200 bg-white p-4" data-starter-rw-active-crop={selected.key}>
      <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-black text-blue-950">{selected.label}</p><p className="text-xs font-semibold text-blue-700">Kéo để vẽ, di chuyển hoặc thay đổi kích thước vùng crop.</p></div><button type="button" onClick={() => setSelectedIndex(null)} className="starter-rw-crop-secondary rounded-lg px-3 py-2 text-xs font-black">Đóng</button></div>
      {sourceUrl && <VisualCropEditor imageUrl={sourceUrl} crop={crop} onChange={setCrop} />}
      <button type="button" disabled={cropping || batchCropping} aria-busy={cropping} onClick={confirmSelectedCrop} className="starter-rw-crop-confirm inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black">{cropping ? <LoaderCircle size={15} className="animate-spin" /> : <Crop size={15} />}{cropping ? 'Đang lưu ảnh crop…' : detectedCrops.length === slots.length ? 'Lưu điều chỉnh vùng tự dò' : 'Dùng vùng crop này'}</button>
    </div>}
    {notice && <p className="rounded-xl border border-sky-200 bg-white p-3 text-xs font-bold text-sky-900">{notice}</p>}
  </section>;
}

function ExamplesEditor({ examples, count, onChange }: { examples: ExamDisplayExample[]; count: number; onChange: (examples: ExamDisplayExample[]) => void }) {
  const rows = Array.from({ length: count }, (_, index) => examples[index] || { prompt: '', answer: index % 2 ? 'No' : 'Yes' });
  const update = (index: number, patch: Partial<ExamDisplayExample>) => onChange(rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  return <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
    <p className="text-sm font-black text-indigo-950">Example không chấm điểm</p>
    <div className="mt-3 grid gap-3 md:grid-cols-2">
      {rows.map((example, index) => <div key={index} className="rounded-xl border border-indigo-100 bg-white p-3">
        <label className="text-xs font-black text-slate-700">Nội dung example {index + 1}<input value={example.prompt} onChange={event => update(index, { prompt: event.target.value })} className={`mt-1 ${fieldClass}`} /></label>
        <label className="mt-2 block text-xs font-black text-slate-700">Đáp án in sẵn<input value={example.answer} onChange={event => update(index, { answer: event.target.value })} className={`mt-1 ${fieldClass}`} /></label>
      </div>)}
    </div>
  </section>;
}

function AnswersField({ question, label, onChange }: { question: ExamQuestion; label: string; onChange: (question: ExamQuestion) => void }) {
  return <label className="block text-xs font-black text-slate-700">{label} (ngăn cách bằng |)<input value={answerText(question.acceptedAnswers)} onChange={event => onChange({ ...question, type: 'short-answer', acceptedAnswers: parseAnswers(event.target.value) })} className={`mt-1 ${fieldClass}`} placeholder="face | a face" /></label>;
}

function InlinePreview({ value }: { value: string }) {
  return <div className="rounded-xl border border-blue-100 bg-white p-4 text-sm font-semibold leading-9 text-slate-800">
    {value.split(/(\[\[\d+\]\])/g).map((segment, index) => /^\[\[\d+\]\]$/.test(segment)
      ? <span key={`${segment}-${index}`} className="mx-1 inline-block min-w-24 border-b-2 border-dotted border-blue-500 bg-blue-50 px-2 text-center font-black text-blue-700">ô {segment}</span>
      : <span key={index} className="whitespace-pre-wrap">{segment}</span>)}
  </div>;
}

function YesNoQuestions({ unit, onChange }: { unit: ExamPartContent; onChange: (unit: ExamPartContent) => void }) {
  const updateQuestion = (index: number, question: ExamQuestion) => onChange({ ...unit, questions: unit.questions.map((item, itemIndex) => itemIndex === index ? question : item) });
  return <div className="grid gap-3 md:grid-cols-2">
    {unit.questions.map((rawQuestion, index) => {
      const question = ensureYesNo(rawQuestion);
      return <article key={question.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="text-xs font-black text-slate-700">Câu {index + 1}<textarea value={question.prompt} onChange={event => updateQuestion(index, { ...question, prompt: event.target.value })} className={`mt-1 min-h-20 ${fieldClass}`} /></label>
        <div className="mt-3 flex gap-3" role="radiogroup" aria-label={`Đáp án câu ${index + 1}`}>
          {question.options.map(option => <label key={option.id} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-black uppercase text-slate-700">
            <input type="radio" name={`starter-rw-answer-${question.id}`} checked={question.correctOptionIds.includes(option.id)} onChange={() => updateQuestion(index, { ...question, correctOptionIds: [option.id] })} />
            {option.text}
          </label>)}
        </div>
      </article>;
    })}
  </div>;
}

function PartOne({ unit, assets, token, onAssets, onChange }: Omit<Props, 'part'> & { unit: ExamPartContent; onChange: (unit: ExamPartContent) => void }) {
  const examples = Array.from({ length: 2 }, (_, index) => unit.examples?.[index] || { prompt: '', answer: index === 0 ? 'Yes' : 'No' });
  const updateExampleImage = (index: number, asset: ListeningAsset) => onChange({ ...unit, examples: examples.map((example, exampleIndex) => exampleIndex === index ? { ...example, imageAssetId: asset.id, imageUrl: asset.url } : example) });
  const updateQuestionImage = (index: number, asset: ListeningAsset) => onChange({ ...unit, examples, questions: unit.questions.map((question, questionIndex) => questionIndex === index ? { ...question, imageAssetId: asset.id, imageUrl: asset.url } : question) });
  const slots: CropSlot[] = [
    ...examples.map((example, index) => ({ key: `example-${index + 1}`, label: `Example ${index + 1}`, imageUrl: example.imageUrl, onApply: (asset: ListeningAsset) => updateExampleImage(index, asset) })),
    ...unit.questions.map((question, index) => ({ key: `question-${index + 1}`, label: `Câu ${index + 1}`, imageUrl: question.imageUrl, onApply: (asset: ListeningAsset) => updateQuestionImage(index, asset) })),
  ];
  const applyAllCrops = (croppedAssets: ListeningAsset[]) => onChange({
    ...unit,
    examples: examples.map((example, index) => ({ ...example, imageAssetId: croppedAssets[index].id, imageUrl: croppedAssets[index].url })),
    questions: unit.questions.map((question, index) => ({ ...question, imageAssetId: croppedAssets[index + 2].id, imageUrl: croppedAssets[index + 2].url })),
  });
  return <div className="space-y-4">
    <ImagePicker label="Ảnh trang nguồn chỉ dùng để crop 7 hình" value={unit.imageAssetId} assets={assets} token={token} onAssets={onAssets} onChange={asset => {
      if (asset?.id === unit.imageAssetId) return;
      onChange({
        ...unit,
        imageAssetId: asset?.id,
        imageUrl: asset?.url,
        examples: examples.map(({ imageAssetId: _assetId, imageUrl: _imageUrl, ...example }) => example),
        questions: unit.questions.map(({ imageAssetId: _assetId, imageUrl: _imageUrl, ...question }) => question),
      });
    }} />
    <p data-starter-rw-part1-pastel-detector className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs font-semibold leading-5 text-sky-900">Tự dò Part 1 dùng 7 dải nền màu pastel trong cột tranh, không dò chữ hoặc checkbox. Nếu không nhận đúng 7 vùng, hệ thống sẽ không tự áp dụng; hãy crop thủ công hoặc dùng ảnh nguồn rõ hơn.</p>
    <CropSlots sourceAssetId={unit.imageAssetId} sourceUrl={unit.imageUrl} slots={slots} token={token} onAssets={onAssets} filePrefix="starter-rw-part1" detectCrops={detectStarterReadingPart1Crops} onApplyAll={applyAllCrops} />
    <ExamplesEditor examples={examples} count={2} onChange={nextExamples => onChange({ ...unit, examples: nextExamples })} />
    <YesNoQuestions unit={unit} onChange={onChange} />
  </div>;
}

function PartTwo({ unit, assets, token, onAssets, onChange }: Omit<Props, 'part'> & { unit: ExamPartContent; onChange: (unit: ExamPartContent) => void }) {
  return <div className="space-y-4">
    <ImagePicker label="Ảnh tình huống ở cột bên trái" value={unit.imageAssetId} assets={assets} token={token} onAssets={onAssets} onChange={asset => onChange({ ...unit, imageAssetId: asset?.id, imageUrl: asset?.url })} />
    <ExamplesEditor examples={unit.examples || []} count={2} onChange={examples => onChange({ ...unit, examples })} />
    <YesNoQuestions unit={unit} onChange={onChange} />
  </div>;
}

function PartThree({ unit, assets, token, onAssets, onChange }: Omit<Props, 'part'> & { unit: ExamPartContent; onChange: (unit: ExamPartContent) => void }) {
  const example = unit.examples?.[0] || { prompt: 'Example', answer: '' };
  const updateQuestion = (index: number, question: ExamQuestion) => onChange({ ...unit, questions: unit.questions.map((item, itemIndex) => itemIndex === index ? question : item) });
  const updateExampleSide = (side: 'left' | 'right', asset: ListeningAsset) => onChange({
    ...unit,
    examples: [{
      ...example,
      ...(side === 'left' ? { imageAssetId: asset.id, imageUrl: asset.url } : { secondaryImageAssetId: asset.id, secondaryImageUrl: asset.url }),
    }],
  });
  const updateQuestionSide = (index: number, side: 'left' | 'right', asset: ListeningAsset) => {
    const question = unit.questions[index];
    updateQuestion(index, {
      ...question,
      ...(side === 'left' ? { imageAssetId: asset.id, imageUrl: asset.url } : { secondaryImageAssetId: asset.id, secondaryImageUrl: asset.url }),
    });
  };
  const slots: CropSlot[] = [
    { key: 'example-left', label: 'Example · hình bên trái', imageUrl: example.imageUrl, onApply: asset => updateExampleSide('left', asset) },
    { key: 'example-right', label: 'Example · hình bên phải', imageUrl: example.secondaryImageUrl, onApply: asset => updateExampleSide('right', asset) },
    ...unit.questions.flatMap((question, index) => [
      { key: `question-${index + 1}-left`, label: `Câu ${index + 1} · hình bên trái`, imageUrl: question.imageUrl, onApply: (asset: ListeningAsset) => updateQuestionSide(index, 'left', asset) },
      { key: `question-${index + 1}-right`, label: `Câu ${index + 1} · hình bên phải`, imageUrl: question.secondaryImageUrl, onApply: (asset: ListeningAsset) => updateQuestionSide(index, 'right', asset) },
    ]),
  ];
  const applyAllCrops = (croppedAssets: ListeningAsset[]) => onChange({
    ...unit,
    examples: [{
      ...example,
      imageAssetId: croppedAssets[0].id,
      imageUrl: croppedAssets[0].url,
      secondaryImageAssetId: croppedAssets[1].id,
      secondaryImageUrl: croppedAssets[1].url,
    }],
    questions: unit.questions.map((question, index) => ({
      ...question,
      imageAssetId: croppedAssets[2 + index * 2].id,
      imageUrl: croppedAssets[2 + index * 2].url,
      secondaryImageAssetId: croppedAssets[3 + index * 2].id,
      secondaryImageUrl: croppedAssets[3 + index * 2].url,
    })),
  });
  return <div className="space-y-4">
    <ImagePicker label="Ảnh trang nguồn chỉ dùng để crop 12 hình" value={unit.imageAssetId} assets={assets} token={token} onAssets={onAssets} onChange={asset => {
      if (asset?.id === unit.imageAssetId) return;
      onChange({
        ...unit,
        imageAssetId: asset?.id,
        imageUrl: asset?.url,
        examples: [{ prompt: example.prompt, answer: example.answer }],
        questions: unit.questions.map(({ imageAssetId: _leftId, imageUrl: _leftUrl, secondaryImageAssetId: _rightId, secondaryImageUrl: _rightUrl, ...question }) => question),
      });
    }} />
    <p data-starter-rw-part3-paired-detector className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-xs font-semibold leading-5 text-sky-900">Tự dò Part 3 dùng 6 túi chữ màu bên phải làm mốc hàng, rồi ghép các cụm hình màu bên trái theo chiều dọc. Vùng gạch đáp án ở giữa không tham gia nhận diện; nếu không đủ 6 cặp, hệ thống sẽ giữ nguyên để bạn crop thủ công.</p>
    <CropSlots sourceAssetId={unit.imageAssetId} sourceUrl={unit.imageUrl} slots={slots} token={token} onAssets={onAssets} filePrefix="starter-rw-part3" detectCrops={detectStarterReadingPart3Crops} onApplyAll={applyAllCrops} />
    <ExamplesEditor examples={[example]} count={1} onChange={examples => onChange({ ...unit, examples })} />
    <div className="grid gap-3 md:grid-cols-2">
      {unit.questions.map((question, index) => <article key={question.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="text-xs font-black text-slate-700">Nhãn câu {index + 1}<input value={question.prompt} onChange={event => updateQuestion(index, { ...question, prompt: event.target.value })} className={`mt-1 ${fieldClass}`} /></label>
        <div className="mt-3"><AnswersField question={question} label="Đáp án từ" onChange={next => updateQuestion(index, { ...next, maxWords: 1, answerLength: Math.max(1, Math.min(30, next.acceptedAnswers[0]?.replace(/\s+/g, '').length || question.answerLength || 1)) })} /></div>
        <label className="mt-3 block text-xs font-black text-slate-700">Số chữ cái / số gạch chân<input type="number" min={1} max={30} value={question.answerLength || question.acceptedAnswers[0]?.replace(/\s+/g, '').length || 1} onChange={event => updateQuestion(index, { ...question, answerLength: Math.max(1, Math.min(30, Number(event.target.value) || 1)) })} className={`mt-1 ${fieldClass}`} /></label>
      </article>)}
    </div>
  </div>;
}

function PartFour({ unit, assets, token, onAssets, onChange }: Omit<Props, 'part'> & { unit: ExamPartContent; onChange: (unit: ExamPartContent) => void }) {
  const updateQuestion = (index: number, question: ExamQuestion) => onChange({ ...unit, questions: unit.questions.map((item, itemIndex) => itemIndex === index ? question : item) });
  return <div className="space-y-4">
    <ImagePicker label="Ảnh ngân hàng từ/hình ở cột bên trái" value={unit.imageAssetId} assets={assets} token={token} onAssets={onAssets} onChange={asset => onChange({ ...unit, imageAssetId: asset?.id, imageUrl: asset?.url })} />
    <ExamplesEditor examples={unit.examples || []} count={1} onChange={examples => onChange({ ...unit, examples })} />
    <label className="block text-xs font-black text-slate-700">Nội dung truyện (giữ đúng marker [[1]] đến [[5]])<textarea value={unit.passage || ''} onChange={event => onChange({ ...unit, passage: event.target.value })} className={`mt-1 min-h-56 ${fieldClass}`} /></label>
    <InlinePreview value={unit.passage || ''} />
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {unit.questions.map((question, index) => <article key={question.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="mb-3 text-xs font-black text-blue-700">Chỗ trống {index + 1}: {`[[${index + 1}]]`}</p>
        <AnswersField question={question} label="Đáp án chấp nhận" onChange={next => updateQuestion(index, { ...next, maxWords: 1 })} />
      </article>)}
    </div>
  </div>;
}

function normalizedScenes(unit: ExamPartContent): ExamReadingScene[] {
  const counts = [1, 2, 2];
  let offset = 0;
  return counts.map((count, index) => {
    const previous = unit.readingScenes?.[index];
    const scene = {
      id: previous?.id || makeId(`starter-rw-scene-${index + 1}`),
      passage: previous?.passage || '',
      questionIds: unit.questions.slice(offset, offset + count).map(question => question.id),
      ...(previous?.imageAssetId ? { imageAssetId: previous.imageAssetId } : {}),
      ...(previous?.imageUrl ? { imageUrl: previous.imageUrl } : {}),
    };
    offset += count;
    return scene;
  });
}

function PartFive({ unit, assets, token, onAssets, onChange }: Omit<Props, 'part'> & { unit: ExamPartContent; onChange: (unit: ExamPartContent) => void }) {
  const scenes = normalizedScenes(unit);
  const questionById = new Map(unit.questions.map(question => [question.id, question]));
  const updateScene = (index: number, next: ExamReadingScene) => onChange({ ...unit, readingScenes: scenes.map((scene, sceneIndex) => sceneIndex === index ? next : scene) });
  const updateQuestion = (question: ExamQuestion) => onChange({ ...unit, readingScenes: scenes, questions: unit.questions.map(item => item.id === question.id ? question : item) });
  return <div className="space-y-5">
    {scenes.map((scene, sceneIndex) => <section key={scene.id} className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div><p className="text-xs font-black uppercase text-indigo-600">Cảnh {sceneIndex + 1}</p><h4 className="mt-1 text-lg font-black text-slate-900">Tranh và câu chuyện {sceneIndex + 1} · {sceneIndex === 0 ? '2 example + ' : ''}{scene.questionIds.length} câu chấm điểm</h4></div>
      <ImagePicker label={`Ảnh cảnh ${sceneIndex + 1}`} value={scene.imageAssetId} assets={assets} token={token} onAssets={onAssets} onChange={asset => updateScene(sceneIndex, { ...scene, imageAssetId: asset?.id, imageUrl: asset?.url })} />
      <label className="block text-xs font-black text-slate-700">Nội dung câu chuyện {sceneIndex + 1}<textarea value={scene.passage} onChange={event => updateScene(sceneIndex, { ...scene, passage: event.target.value })} className={`mt-1 min-h-32 ${fieldClass}`} /></label>
      {sceneIndex === 0 && <ExamplesEditor examples={unit.examples || []} count={2} onChange={examples => onChange({ ...unit, examples, readingScenes: scenes })} />}
      <div className="space-y-3">{scene.questionIds.map((questionId, localIndex) => {
        const question = questionById.get(questionId);
        if (!question) return null;
        const globalIndex = unit.questions.findIndex(item => item.id === question.id);
        return <article key={question.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <label className="text-xs font-black text-slate-700">Câu {globalIndex + 1} (đặt ____ tại vị trí ô nhập)<textarea value={question.prompt} onChange={event => updateQuestion({ ...question, prompt: event.target.value })} className={`mt-1 min-h-20 ${fieldClass}`} /></label>
          <div className="mt-3"><AnswersField question={question} label={`Đáp án câu ${globalIndex + 1}`} onChange={next => updateQuestion({ ...next, maxWords: 3 })} /></div>
          <p className="mt-2 text-[10px] font-bold text-slate-400">Cảnh {sceneIndex + 1} · câu thứ {localIndex + 1} trong cảnh</p>
        </article>;
      })}</div>
    </section>)}
  </div>;
}

export default function StarterReadingWritingAuthoring({ token, part, assets, onAssets, onChange }: Props) {
  const unit = examPartUnits(part)[0] || part;
  const commit = (nextUnit: ExamPartContent) => onChange(replaceExamPartUnit(part, nextUnit));
  const shared = { unit, assets, token, onAssets, onChange: commit };
  return <section id="starter-reading-writing-authoring" className="space-y-4" data-starter-reading-writing-editor={part.part}>
    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-blue-700">Starters Reading & Writing · Part {part.part}</p>
      <p className="mt-1 text-sm font-semibold text-blue-950">Giao diện này cố định theo cấu trúc Cambridge đã chọn; JSON nhập nội dung và đáp án, còn ảnh do giáo viên tải hoặc dán tại đây.</p>
    </div>
    {part.part === 1 ? <PartOne {...shared} /> : part.part === 2 ? <PartTwo {...shared} /> : part.part === 3 ? <PartThree {...shared} /> : part.part === 4 ? <PartFour {...shared} /> : <PartFive {...shared} />}
  </section>;
}
