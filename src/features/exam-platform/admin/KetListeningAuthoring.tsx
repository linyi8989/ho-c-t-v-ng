import { Crop, LoaderCircle } from 'lucide-react';
import { useRef, useState } from 'react';
import { ListeningAssetPicker } from '../../listening/admin/ListeningAssetPicker';
import { listeningApi } from '../../listening/api';
import type { ListeningAsset, ListeningAssetKind } from '../../listening/types';
import { cropListeningImage } from '../../listening-editor/smart-import/cropImage';
import { detectPart4Frames } from '../../listening-editor/smart-import/part4FrameDetection';
import VisualCropEditor from '../../listening-editor/smart-import/VisualCropEditor';
import type { SmartImportCrop } from '../../listening-editor/smart-import/types';
import { groupKetListeningPart1OptionCrops } from '../ketListeningCrops';
import {
  KET_LISTENING_AUTOCROP_DISPLAY_NUMBERS,
  KET_LISTENING_MANUAL_DISPLAY_NUMBER,
} from '../ketListeningMigration';
import type { ExamDisplayExample, ExamOption, ExamPartContent, ExamQuestion } from '../types';
import { FlyerPart3Editor } from './FlyerListeningAuthoring';

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

function ExampleEditor({ examples, onChange }: { examples: ExamDisplayExample[]; onChange: (examples: ExamDisplayExample[]) => void }) {
  const example = examples[0] || { prompt: '', answer: '' };
  return <section className="grid gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 md:grid-cols-2" data-ket-listening-example-editor>
    <label className="text-xs font-black text-indigo-950">Example không chấm điểm<input value={example.prompt} onChange={event => onChange([{ ...example, prompt: event.target.value }])} className={`mt-1 ${fieldClass}`} /></label>
    <label className="text-xs font-black text-indigo-950">Đáp án in sẵn<input value={example.answer} onChange={event => onChange([{ ...example, answer: event.target.value }])} className={`mt-1 ${fieldClass}`} /></label>
  </section>;
}

function DisplayNumber({ question, onChange }: { question: ExamQuestion; onChange: (question: ExamQuestion) => void }) {
  return <label className="text-xs font-black text-slate-700">Số in trên đề<input type="number" min={1} value={question.displayNumber || question.number} onChange={event => onChange({ ...question, displayNumber: Math.max(1, Number(event.target.value) || 1) })} className={`mt-1 ${fieldClass}`} /></label>;
}

function AcceptedAnswers({ question, onChange }: { question: ExamQuestion; onChange: (question: ExamQuestion) => void }) {
  return <label className="text-xs font-black text-slate-700">Đáp án chính thức (ngăn cách bằng |)<input value={question.acceptedAnswers.join(' | ')} onChange={event => onChange({ ...question, acceptedAnswers: parseAnswers(event.target.value) })} className={`mt-1 ${fieldClass}`} /></label>;
}

function PartOne({ token, part, assets, onAssets, onChange }: Props) {
  const [selection, setSelection] = useState<{ questionIndex: number; optionIndex: number } | null>(null);
  const [crop, setCrop] = useState<SmartImportCrop>({ x: 0, y: 0, width: 1, height: 1 });
  const [cropping, setCropping] = useState(false);
  const [batchCropping, setBatchCropping] = useState(false);
  const [batchNotice, setBatchNotice] = useState('');
  const latestPartRef = useRef(part);
  latestPartRef.current = part;
  const selectedQuestion = selection ? part.questions[selection.questionIndex] : undefined;
  const selectedOption = selection ? selectedQuestion?.options[selection.optionIndex] : undefined;
  const isSharedImageQuestion = (question: ExamQuestion) => (question.displayNumber || 0) === KET_LISTENING_MANUAL_DISPLAY_NUMBER;
  const visibleImageCount = part.questions.reduce((total, question) => total + (isSharedImageQuestion(question)
    ? Number(Boolean(question.imageAssetId && question.imageUrl))
    : question.options.filter(option => option.imageAssetId && option.imageUrl).length), 0);
  const expectedImageCount = part.questions.reduce((total, question) => total + (isSharedImageQuestion(question) ? 1 : 3), 0);

  const updateQuestion = (questionIndex: number, question: ExamQuestion) => onChange({
    ...part,
    questions: part.questions.map((item, index) => index === questionIndex ? question : item),
  });
  const attachOptionAsset = (questionIndex: number, optionIndex: number, asset?: ListeningAsset) => {
    const question = part.questions[questionIndex];
    if (!question) return;
    if (asset) onAssets(asset);
    updateQuestion(questionIndex, {
      ...question,
      options: question.options.map((option, index) => index === optionIndex
        ? { ...option, imageAssetId: asset?.id, imageUrl: asset?.url }
        : option),
    });
  };
  const attachQuestionAsset = (questionIndex: number, asset?: ListeningAsset) => {
    const question = part.questions[questionIndex];
    if (!question) return;
    if (asset) onAssets(asset);
    updateQuestion(questionIndex, { ...question, imageAssetId: asset?.id, imageUrl: asset?.url });
  };
  const applyCrop = async () => {
    if (!selection || !part.imageAssetId || !part.imageUrl || !selectedOption) return;
    const currentSelection = { ...selection };
    setCropping(true);
    try {
      const file = await cropListeningImage(part.imageUrl, crop, `ket-listening-part1-q${currentSelection.questionIndex + 1}-${selectedOption.label}.png`);
      const asset = await listeningApi.uploadAsset(token, file, 'image', { derivedFromAssetId: part.imageAssetId, crop });
      attachOptionAsset(currentSelection.questionIndex, currentSelection.optionIndex, asset);
    } catch (reason: any) {
      window.alert(reason?.message || 'Không thể tạo ảnh crop cho lựa chọn này.');
    } finally {
      setCropping(false);
    }
  };
  const cropFourPrintedQuestions = async () => {
    const sourceAssetId = part.imageAssetId;
    const sourceUrl = part.imageUrl;
    if (!sourceAssetId || !sourceUrl) return;
    setBatchCropping(true);
    setBatchNotice('Đang dò các khung A/B/C của câu 1, 2, 4 và 5…');
    try {
      const detected = await detectPart4Frames(sourceUrl);
      const grouped = groupKetListeningPart1OptionCrops(detected);
      if (grouped.questionGroups.length !== 4 || grouped.questionGroups.some(group => group.length !== 3)) {
        throw new Error(`Chỉ nhận được ${detected.length} khung phù hợp. Cần bốn nhóm A/B/C; hình tổng của câu 3 sẽ được bỏ qua.`);
      }
      const uploadedByDisplay = new Map<number, ListeningAsset[]>();
      for (let groupIndex = 0; groupIndex < KET_LISTENING_AUTOCROP_DISPLAY_NUMBERS.length; groupIndex += 1) {
        const displayNumber = KET_LISTENING_AUTOCROP_DISPLAY_NUMBERS[groupIndex];
        if (!latestPartRef.current.questions.some(question => (question.displayNumber || 0) === displayNumber)) continue;
        const row: ListeningAsset[] = [];
        for (let optionIndex = 0; optionIndex < 3; optionIndex += 1) {
          if (latestPartRef.current.imageAssetId !== sourceAssetId) throw new Error('Ảnh nguồn đã thay đổi trong lúc crop; đã dừng trước khi ghi đè.');
          const optionLabel = String.fromCharCode(65 + optionIndex);
          const selectedCrop = grouped.questionGroups[groupIndex][optionIndex];
          const file = await cropListeningImage(sourceUrl, selectedCrop, `ket-listening-part1-q${displayNumber}-${optionLabel}.png`);
          const asset = await listeningApi.uploadAsset(token, file, 'image', { derivedFromAssetId: sourceAssetId, crop: selectedCrop });
          onAssets(asset);
          row.push(asset);
        }
        uploadedByDisplay.set(displayNumber, row);
        setBatchNotice(`Đã crop ${uploadedByDisplay.size * 3} ảnh; câu 3 vẫn dùng một ảnh chung tải/dán thủ công…`);
      }
      const latestPart = latestPartRef.current;
      if (latestPart.imageAssetId !== sourceAssetId) throw new Error('Ảnh nguồn đã thay đổi trong lúc crop; không ghi đè Part mới.');
      onChange({
        ...latestPart,
        questions: latestPart.questions.map(question => {
          const uploaded = uploadedByDisplay.get(question.displayNumber || 0);
          return uploaded ? { ...question, options: question.options.map((option, optionIndex) => ({ ...option, imageAssetId: uploaded[optionIndex].id, imageUrl: uploaded[optionIndex].url })) } : question;
        }),
      });
      setBatchNotice(`${grouped.detectedPrintedExample ? 'Đã bỏ qua nhóm example, ' : ''}đã crop đủ 12 ảnh A/B/C cho các câu hiện có thuộc 1, 2, 4, 5. Câu 3 không bị crop và dùng đúng một ảnh chung do giáo viên tải/dán riêng.`);
    } catch (reason: any) {
      setBatchNotice(reason?.message || 'Không thể tự động crop ảnh KET Listening Part 1.');
    } finally {
      setBatchCropping(false);
    }
  };

  const renderQuestion = (question: ExamQuestion, questionIndex: number, manual: boolean) => {
    const sharedImage = isSharedImageQuestion(question);
    return <article key={question.id} className={`rounded-2xl border p-4 ${manual ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}>
    <div className="grid gap-3 md:grid-cols-[120px_minmax(0,1fr)]">
      <DisplayNumber question={question} onChange={next => updateQuestion(questionIndex, next)} />
      <label className="text-xs font-black text-slate-700">Nội dung câu hỏi<input value={question.prompt} onChange={event => updateQuestion(questionIndex, { ...question, prompt: event.target.value })} className={`mt-1 ${fieldClass}`} /></label>
    </div>
    {sharedImage && <div className="mt-3 space-y-3 rounded-xl border border-amber-300 bg-white p-3">
      <p className="text-xs font-black text-amber-900">Câu in số 3 dùng đúng một ảnh tổng, không tham gia crop tự động. Ảnh hiển thị phía trên và ba nút đáp án A/B/C ở phía dưới.</p>
      <ImagePicker label="Ảnh chung của câu 3" value={question.imageAssetId} assets={assets} token={token} onAssets={onAssets} onChange={asset => attachQuestionAsset(questionIndex, asset)} />
    </div>}
    {manual && !sharedImage && <p className="mt-3 rounded-xl border border-amber-300 bg-white p-3 text-xs font-black text-amber-900">Câu thêm ngoài nhóm 1, 2, 4, 5 không tham gia crop tự động. Giáo viên tải hoặc dán riêng đủ ba ảnh A/B/C dưới đây.</p>}
    <div className="mt-3 grid gap-3 lg:grid-cols-3">{question.options.slice(0, 3).map((option, optionIndex) => <div key={option.id} className="rounded-xl border border-slate-200 bg-white p-3">
      <label className="flex items-center gap-2 text-xs font-black text-slate-800"><input type="radio" name={`ket-listening-correct-${question.id}`} checked={question.correctOptionIds.includes(option.id)} onChange={() => updateQuestion(questionIndex, { ...question, correctOptionIds: [option.id] })} />Đáp án {option.label}</label>
      <input value={option.text} onChange={event => updateQuestion(questionIndex, { ...question, options: question.options.map(item => item.id === option.id ? { ...item, text: event.target.value } : item) })} className={`mt-2 ${fieldClass}`} aria-label={`Mô tả ảnh ${option.label}`} />
      {!sharedImage && <div className="mt-2"><ImagePicker compact label={`Ảnh ${option.label}`} value={option.imageAssetId} assets={assets} token={token} onAssets={onAssets} onChange={asset => attachOptionAsset(questionIndex, optionIndex, asset)} /></div>}
      {!manual && <button type="button" aria-pressed={selection?.questionIndex === questionIndex && selection?.optionIndex === optionIndex} onClick={() => { setSelection({ questionIndex, optionIndex }); setCrop({ x: 0, y: 0, width: 1, height: 1 }); }} className="mt-2 w-full rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-2 text-[10px] font-black text-indigo-700"><Crop size={13} className="mr-1 inline" />Crop lại ảnh {option.label}</button>}
    </div>)}</div>
  </article>;
  };

  const manualQuestions = part.questions.map((question, questionIndex) => ({ question, questionIndex })).filter(({ question }) => (question.displayNumber || 0) === KET_LISTENING_MANUAL_DISPLAY_NUMBER || !KET_LISTENING_AUTOCROP_DISPLAY_NUMBERS.includes((question.displayNumber || 0) as 1 | 2 | 4 | 5));
  const cropQuestions = part.questions.map((question, questionIndex) => ({ question, questionIndex })).filter(({ question }) => KET_LISTENING_AUTOCROP_DISPLAY_NUMBERS.includes((question.displayNumber || 0) as 1 | 2 | 4 | 5));

  return <div className="space-y-4" data-ket-listening-part-one>
    <CountControls count={part.questions.length} onAdd={() => onChange({ ...part, questions: [...part.questions, choiceQuestion(part, `Picture question ${part.questions.length + 1}`)] })} onRemove={() => onChange({ ...part, questions: part.questions.slice(0, -1) })} />
    <ExampleEditor examples={part.examples || []} onChange={examples => onChange({ ...part, examples })} />
    <ImagePicker label="Ảnh trang nguồn chỉ dùng để crop câu 1, 2, 4 và 5" value={part.imageAssetId} assets={assets} token={token} onAssets={onAssets} onChange={asset => onChange({ ...part, imageAssetId: asset?.id, imageUrl: asset?.url })} />
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
      <p className="text-sm font-black text-emerald-950">Crop tự động đúng bốn câu in số 1, 2, 4, 5</p>
      <p className="mt-1 text-xs font-semibold text-emerald-800">Bộ dò chỉ lấy bốn nhóm ba khung A/B/C (tổng 12 ảnh) và bỏ qua hình tổng của câu 3. Ảnh nguồn crop không được gửi cho học sinh.</p>
      <button type="button" data-ket-listening-action="crop-part1-1245" disabled={batchCropping || !part.imageAssetId || !part.imageUrl} onClick={() => void cropFourPrintedQuestions()} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50">{batchCropping ? <LoaderCircle size={15} className="animate-spin" /> : <Crop size={15} />}{batchCropping ? 'Đang crop…' : 'Dò và crop câu 1, 2, 4, 5'}</button>
      {batchNotice && <p className="mt-3 rounded-xl border border-emerald-200 bg-white p-3 text-xs font-bold text-emerald-900">{batchNotice}</p>}
    </section>
    <p className={`rounded-xl border p-3 text-xs font-black ${visibleImageCount === expectedImageCount ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>Đã có {visibleImageCount}/{expectedImageCount} tài nguyên ảnh học sinh sẽ nhìn thấy. Với đề chuẩn: 12 ảnh crop và 1 ảnh chung cho câu 3.</p>
    <section className="space-y-3"><h4 className="text-sm font-black text-slate-900">Các câu hỗ trợ crop</h4>{cropQuestions.map(({ question, questionIndex }) => renderQuestion(question, questionIndex, false))}</section>
    <section className="space-y-3"><h4 className="text-sm font-black text-amber-950">Câu 3 dùng một ảnh chung · các câu thêm upload thủ công</h4>{manualQuestions.map(({ question, questionIndex }) => renderQuestion(question, questionIndex, true))}</section>
    {selection && selectedOption && <section className="space-y-3 rounded-2xl border border-blue-200 bg-blue-50 p-4">
      <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-black text-blue-950">Crop lại câu {selectedQuestion?.displayNumber || selection.questionIndex + 1} · ảnh {selectedOption.label}</p><p className="text-xs font-semibold text-blue-800">Kéo vùng trên ảnh nguồn rồi dùng vùng crop này.</p></div><button type="button" onClick={() => setSelection(null)} className="rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-black text-blue-800">Đóng</button></div>
      {part.imageUrl ? <VisualCropEditor imageUrl={part.imageUrl} crop={crop} onChange={setCrop} /> : <p className="rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-900">Hãy gắn ảnh nguồn trước khi crop.</p>}
      <button type="button" disabled={cropping || !part.imageAssetId || !part.imageUrl} onClick={() => void applyCrop()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-black text-white disabled:opacity-40">{cropping ? <LoaderCircle size={15} className="animate-spin" /> : <Crop size={15} />}{cropping ? 'Đang tạo crop…' : 'Dùng vùng crop này'}</button>
    </section>}
  </div>;
}

function PartTwo({ token, part, assets, onAssets, onChange }: Props) {
  const setQuestions = (questions: ExamQuestion[]) => onChange({ ...part, questions, readingScenes: part.readingScenes?.map(scene => ({ ...scene, questionIds: questions.map(question => question.id) })) });
  return <div className="space-y-4" data-ket-listening-part-two>
    <CountControls count={part.questions.length} onAdd={() => setQuestions([...part.questions, { ...shortQuestion(part, `Row ${part.questions.length + 1}`), maxWords: 1 }])} onRemove={() => setQuestions(part.questions.slice(0, -1))} />
    <ImagePicker label="Ảnh thứ nhất · trang câu hỏi/lựa chọn A-H" value={part.imageAssetId} assets={assets} token={token} onAssets={onAssets} onChange={asset => onChange({ ...part, imageAssetId: asset?.id, imageUrl: asset?.url })} />
    <FlyerPart3Editor token={token} part={part} assets={assets} onAssets={onAssets} onChange={onChange} />
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
    <label className="block rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-xs font-black text-indigo-950">Đề bài/hướng dẫn được ChatGPT tạo từ JSON<textarea value={part.passage || ''} onChange={event => onChange({ ...part, passage: event.target.value })} className={`mt-2 min-h-28 ${fieldClass}`} placeholder="Ví dụ: Listen to each conversation and choose the best answer, A, B or C." /></label>
    <ExampleEditor examples={part.examples || []} onChange={examples => onChange({ ...part, examples })} />
    <ChoiceRows part={part} onChange={onChange} />
  </div>;
}

function FormPart({ part, onChange }: Props) {
  const update = (index: number, question: ExamQuestion) => onChange({ ...part, questions: part.questions.map((item, itemIndex) => itemIndex === index ? question : item) });
  return <div className="space-y-4" data-ket-listening-form-part>
    <CountControls count={part.questions.length} onAdd={() => onChange({ ...part, questions: [...part.questions, shortQuestion(part)] })} onRemove={() => onChange({ ...part, questions: part.questions.slice(0, -1) })} />
    <label className="block rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-xs font-black text-indigo-950">Nội dung hướng dẫn, câu hỏi và example dạng chữ hiển thị phía trên<textarea value={part.passage || ''} onChange={event => onChange({ ...part, passage: event.target.value })} className={`mt-2 min-h-44 ${fieldClass}`} placeholder="Nội dung này được tạo từ JSON và hiển thị nguyên văn cho học sinh." /></label>
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
