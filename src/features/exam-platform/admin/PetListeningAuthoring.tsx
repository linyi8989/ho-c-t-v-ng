import { Crop, LoaderCircle } from 'lucide-react';
import { useRef, useState } from 'react';
import { ListeningAssetPicker } from '../../listening/admin/ListeningAssetPicker';
import { listeningApi } from '../../listening/api';
import type { ListeningAsset, ListeningAssetKind } from '../../listening/types';
import { cropListeningImage } from '../../listening-editor/smart-import/cropImage';
import VisualCropEditor from '../../listening-editor/smart-import/VisualCropEditor';
import type { SmartImportCrop } from '../../listening-editor/smart-import/types';
import {
  detectPetListeningPart1OptionFrames,
  groupPetListeningPart1OptionCrops,
} from '../petListeningCrops';
import type { ExamDisplayExample, ExamOption, ExamPartContent, ExamQuestion } from '../types';

interface Props {
  token: string;
  part: ExamPartContent;
  assets: ListeningAsset[];
  onAssets: (asset: ListeningAsset) => void;
  onChange: (part: ExamPartContent) => void;
}

const fieldClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100';
const actionClass = 'pet-listening-admin-button rounded-xl border px-4 py-2.5 text-xs font-black disabled:cursor-not-allowed disabled:opacity-50';
const makeId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;
const parseAnswers = (value: string) => value.split('|').map(item => item.trim()).filter(Boolean).slice(0, 30);

function nextNumber(part: ExamPartContent) {
  return Math.max(0, ...part.questions.map(question => question.number)) + 1;
}

function choiceOptions(): ExamOption[] {
  return ['A', 'B', 'C'].map(label => ({ id: makeId('pet-listening-option'), label, text: `Option ${label}` }));
}

function exampleOptions(example: ExamDisplayExample): NonNullable<ExamDisplayExample['options']> {
  return ['A', 'B', 'C'].map((label, index) => {
    const existing = example.options?.find(option => option.label.toUpperCase() === label)
      || example.options?.[index];
    return {
      label,
      text: existing?.text || `Picture ${label}`,
      ...(existing?.imageAssetId ? { imageAssetId: existing.imageAssetId } : {}),
      ...(existing?.imageUrl ? { imageUrl: existing.imageUrl } : {}),
    };
  });
}

function yesNoOptions(): ExamOption[] {
  return ['Yes', 'No'].map(text => ({ id: makeId('pet-listening-option'), label: text, text }));
}

function choiceQuestion(part: ExamPartContent, prompt: string, binary = false): ExamQuestion {
  const number = nextNumber(part);
  return { id: makeId('pet-listening-question'), number, displayNumber: number, type: 'single-choice', prompt, options: binary ? yesNoOptions() : choiceOptions(), correctOptionIds: [], acceptedAnswers: [], points: 1 };
}

function shortQuestion(part: ExamPartContent): ExamQuestion {
  const number = nextNumber(part);
  return { id: makeId('pet-listening-question'), number, displayNumber: number, type: 'short-answer', prompt: `Field ${number}`, options: [], correctOptionIds: [], acceptedAnswers: [], points: 1, maxWords: 5 };
}

function CountControls({ count, onAdd, onRemove }: { count: number; onAdd: () => void; onRemove: () => void }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-3" data-pet-listening-count-controls>
    <p className="text-sm font-black text-sky-950">{count} câu chấm điểm · có thể thêm/bớt theo đề gốc</p>
    <div className="flex gap-2">
      <button type="button" onClick={onAdd} className={`${actionClass} border-sky-700 bg-white text-sky-900`}>+ Thêm câu</button>
      <button type="button" disabled={count <= 1} onClick={onRemove} className={`${actionClass} border-rose-600 bg-white text-rose-800`}>Xóa câu cuối</button>
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

function DisplayNumber({ question, onChange }: { question: ExamQuestion; onChange: (question: ExamQuestion) => void }) {
  return <label className="text-xs font-black text-slate-700">Số in trên đề<input type="number" min={1} value={question.displayNumber || question.number} onChange={event => onChange({ ...question, displayNumber: Math.max(1, Number(event.target.value) || 1) })} className={`mt-1 ${fieldClass}`} /></label>;
}

function PartOne({ token, part, assets, onAssets, onChange }: Props) {
  const [selection, setSelection] = useState<{ questionIndex: number; optionIndex: number } | null>(null);
  const [crop, setCrop] = useState<SmartImportCrop>({ x: 0, y: 0, width: 1, height: 1 });
  const [cropping, setCropping] = useState(false);
  const [batchCropping, setBatchCropping] = useState(false);
  const [notice, setNotice] = useState('');
  const latestPartRef = useRef(part);
  latestPartRef.current = part;
  const example: ExamDisplayExample = part.examples?.[0] || { prompt: '', answer: '' };
  const workedExampleOptions = exampleOptions(example);
  const selectedQuestion = selection ? part.questions[selection.questionIndex] : undefined;
  const selectedOption = selection ? selectedQuestion?.options[selection.optionIndex] : undefined;
  const visibleImages = part.questions.reduce((sum, question) => sum + question.options.filter(option => option.imageAssetId && option.imageUrl).length, 0);
  const visibleExampleImages = workedExampleOptions.filter(option => option.imageAssetId && option.imageUrl).length;
  const expectedImages = part.questions.length * 3;

  const updateQuestion = (index: number, question: ExamQuestion) => onChange({ ...part, questions: part.questions.map((item, itemIndex) => itemIndex === index ? question : item) });
  const attachOptionAsset = (questionIndex: number, optionIndex: number, asset?: ListeningAsset) => {
    const question = latestPartRef.current.questions[questionIndex];
    if (!question) return;
    if (asset) onAssets(asset);
    onChange({
      ...latestPartRef.current,
      questions: latestPartRef.current.questions.map((item, itemIndex) => itemIndex === questionIndex ? {
        ...item,
        options: item.options.map((option, index) => index === optionIndex ? { ...option, imageAssetId: asset?.id, imageUrl: asset?.url } : option),
      } : item),
    });
  };
  const attachExampleOptionAsset = (optionIndex: number, asset?: ListeningAsset) => {
    if (asset) onAssets(asset);
    const latest = latestPartRef.current;
    const latestExample: ExamDisplayExample = latest.examples?.[0] || { prompt: '', answer: '' };
    const options = exampleOptions(latestExample).map((option, index) => index === optionIndex
      ? { ...option, imageAssetId: asset?.id, imageUrl: asset?.url }
      : option);
    const next = { ...latest, examples: [{ ...latestExample, options }] };
    latestPartRef.current = next;
    onChange(next);
  };

  const applyCrop = async () => {
    if (!selection || !part.imageAssetId || !part.imageUrl || !selectedOption) return;
    setCropping(true);
    try {
      const file = await cropListeningImage(part.imageUrl, crop, `pet-listening-part1-q${selectedQuestion?.displayNumber || selection.questionIndex + 1}-${selectedOption.label}.png`);
      const asset = await listeningApi.uploadAsset(token, file, 'image', { derivedFromAssetId: part.imageAssetId, crop });
      attachOptionAsset(selection.questionIndex, selection.optionIndex, asset);
    } catch (reason: any) {
      window.alert(reason?.message || 'Không thể tạo ảnh crop cho lựa chọn này.');
    } finally {
      setCropping(false);
    }
  };

  const cropAll = async () => {
    const sourceAssetId = part.imageAssetId;
    const sourceUrl = part.imageUrl;
    if (!sourceAssetId || !sourceUrl) return;
    setBatchCropping(true);
    setNotice('Đang dò các hàng ba khung A/B/C…');
    try {
      const detected = await detectPetListeningPart1OptionFrames(sourceUrl);
      const grouped = groupPetListeningPart1OptionCrops(detected, part.questions.length);
      if (grouped.questionGroups.length !== part.questions.length) {
        throw new Error(`Đã dò ${detected.length} khung nhưng chỉ ghép được ${grouped.questionGroups.length}/${part.questions.length} hàng A/B/C. Hãy giữ nguyên ba cột A/B/C và thử lại, hoặc crop thủ công hàng chưa nhận được ở bên dưới.`);
      }
      let croppedExampleAssets: ListeningAsset[] | undefined;
      if (grouped.exampleGroup?.length === 3) {
        setNotice('Đã tìm thấy hàng Example · đang crop ba ảnh A/B/C trước…');
        croppedExampleAssets = [];
        for (let optionIndex = 0; optionIndex < 3; optionIndex += 1) {
          const selectedCrop = grouped.exampleGroup[optionIndex];
          const label = String.fromCharCode(65 + optionIndex);
          const file = await cropListeningImage(sourceUrl, selectedCrop, `pet-listening-part1-example-${label}.png`);
          const asset = await listeningApi.uploadAsset(token, file, 'image', { derivedFromAssetId: sourceAssetId, crop: selectedCrop });
          onAssets(asset);
          croppedExampleAssets.push(asset);
        }
        const latest = latestPartRef.current;
        const latestExample: ExamDisplayExample = latest.examples?.[0] || { prompt: '', answer: '' };
        const next = {
          ...latest,
          examples: [{
            ...latestExample,
            options: exampleOptions(latestExample).map((option, index) => ({
              ...option,
              imageAssetId: croppedExampleAssets?.[index].id,
              imageUrl: croppedExampleAssets?.[index].url,
            })),
          }],
        };
        latestPartRef.current = next;
        onChange(next);
        setNotice(`Đã crop xong 3 ảnh Example · đang crop ${expectedImages} ảnh câu hỏi…`);
      } else {
        setNotice(`Không tìm thấy hàng Example riêng · giữ nguyên Example hiện tại và crop ${expectedImages} ảnh câu hỏi…`);
      }
      const uploaded = new Map<number, ListeningAsset[]>();
      for (let questionIndex = 0; questionIndex < grouped.questionGroups.length; questionIndex += 1) {
        const row: ListeningAsset[] = [];
        for (let optionIndex = 0; optionIndex < 3; optionIndex += 1) {
          if (latestPartRef.current.imageAssetId !== sourceAssetId) throw new Error('Ảnh nguồn đã thay đổi trong lúc crop; hệ thống đã dừng trước khi ghi đè.');
          const selectedCrop = grouped.questionGroups[questionIndex][optionIndex];
          const label = String.fromCharCode(65 + optionIndex);
          const displayNumber = latestPartRef.current.questions[questionIndex]?.displayNumber || questionIndex + 1;
          const file = await cropListeningImage(sourceUrl, selectedCrop, `pet-listening-part1-q${displayNumber}-${label}.png`);
          const asset = await listeningApi.uploadAsset(token, file, 'image', { derivedFromAssetId: sourceAssetId, crop: selectedCrop });
          onAssets(asset);
          row.push(asset);
        }
        uploaded.set(questionIndex, row);
        setNotice(`Đã crop ${uploaded.size * 3}/${expectedImages} ảnh…`);
      }
      const latest = latestPartRef.current;
      onChange({
        ...latest,
        questions: latest.questions.map((question, questionIndex) => ({
          ...question,
          options: question.options.map((option, optionIndex) => {
            const asset = uploaded.get(questionIndex)?.[optionIndex];
            return asset ? { ...option, imageAssetId: asset.id, imageUrl: asset.url } : option;
          }),
        })),
      });
      setNotice(grouped.detectedPrintedExample
        ? `Đã crop đủ 3 ảnh Example và ${expectedImages} ảnh câu hỏi A/B/C.`
        : `Không tìm thấy hàng Example trong ảnh nguồn; đã crop đủ ${expectedImages} ảnh câu hỏi A/B/C và giữ nguyên Example hiện tại.`);
    } catch (reason: any) {
      setNotice(reason?.message || 'Không thể tự động crop ảnh PET Listening Part 1.');
    } finally {
      setBatchCropping(false);
    }
  };

  return <div className="space-y-4" data-pet-listening-part-one>
    <CountControls count={part.questions.length} onAdd={() => onChange({ ...part, questions: [...part.questions, choiceQuestion(part, `Picture question ${nextNumber(part)}`)] })} onRemove={() => onChange({ ...part, questions: part.questions.slice(0, -1) })} />
    <section className="space-y-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-4" data-pet-listening-example-editor>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-xs font-black text-indigo-950">Câu hỏi example không chấm điểm<input value={example.prompt} onChange={event => onChange({ ...part, examples: [{ ...example, prompt: event.target.value }] })} className={`mt-1 ${fieldClass}`} /></label>
        <label className="text-xs font-black text-indigo-950">Đáp án example A/B/C<input value={example.answer} maxLength={1} onChange={event => onChange({ ...part, examples: [{ ...example, answer: event.target.value.toUpperCase().replace(/[^ABC]/g, '') }] })} className={`mt-1 ${fieldClass}`} /></label>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">{workedExampleOptions.map((option, optionIndex) => <div key={option.label} className={`rounded-xl border p-3 ${example.answer.toUpperCase() === option.label ? 'border-emerald-500 bg-emerald-50' : 'border-indigo-200 bg-white'}`}>
        <p className="mb-2 text-xs font-black text-slate-800">Ảnh Example {option.label}{example.answer.toUpperCase() === option.label ? ' · đáp án đúng' : ''}</p>
        <ImagePicker compact label={`Ảnh ${option.label}`} value={option.imageAssetId} assets={assets} token={token} onAssets={onAssets} onChange={asset => attachExampleOptionAsset(optionIndex, asset)} />
      </div>)}</div>
      {example.imageUrl && visibleExampleImages < 3 && <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-bold text-amber-900">Đề cũ đang có một ảnh Example gộp. Ảnh này vẫn được hiển thị cho đến khi crop hoặc tải đủ ba ảnh A/B/C phía trên.</p>}
    </section>
    <ImagePicker label="Ảnh/trang nguồn chỉ dùng để crop các lựa chọn" value={part.imageAssetId} assets={assets} token={token} onAssets={onAssets} onChange={asset => onChange({ ...part, imageAssetId: asset?.id, imageUrl: asset?.url })} />
    <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
      <p className="text-sm font-black text-emerald-950">Crop tự động theo từng hàng A/B/C</p>
      <p className="mt-1 text-xs font-semibold text-emerald-800">Bộ dò ưu tiên hàng Example đầu tiên và crop ba ảnh A/B/C của Example trước, sau đó mới crop các câu hỏi. Nếu nguồn không có hàng Example, hệ thống chỉ bỏ qua phần đó; ảnh nguồn không gửi cho học sinh.</p>
      <button type="button" disabled={batchCropping || !part.imageAssetId || !part.imageUrl} onClick={() => void cropAll()} className={`${actionClass} mt-3 border-emerald-800 bg-emerald-700 text-white`}>{batchCropping ? <LoaderCircle size={15} className="mr-2 inline animate-spin" /> : <Crop size={15} className="mr-2 inline" />}{batchCropping ? 'Đang crop…' : `Dò và crop Example + ${expectedImages} ảnh`}</button>
      {notice && <p className="mt-3 rounded-xl border border-emerald-200 bg-white p-3 text-xs font-bold text-emerald-900">{notice}</p>}
    </section>
    <p className={`rounded-xl border p-3 text-xs font-black ${visibleImages === expectedImages && visibleExampleImages === 3 ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>Example: {visibleExampleImages}/3 ảnh · Câu hỏi: {visibleImages}/{expectedImages} ảnh học sinh sẽ nhìn thấy.</p>
    <div className="space-y-3">{part.questions.map((question, questionIndex) => <article key={question.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-[120px_minmax(0,1fr)]"><DisplayNumber question={question} onChange={next => updateQuestion(questionIndex, next)} /><label className="text-xs font-black text-slate-700">Câu hỏi<input value={question.prompt} onChange={event => updateQuestion(questionIndex, { ...question, prompt: event.target.value })} className={`mt-1 ${fieldClass}`} /></label></div>
      <div className="mt-3 grid gap-3 lg:grid-cols-3">{question.options.slice(0, 3).map((option, optionIndex) => <section key={option.id} className={`space-y-2 rounded-xl border p-3 ${question.correctOptionIds.includes(option.id) ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
        <label className="flex items-center gap-2 text-xs font-black text-slate-800"><input type="radio" name={`pet-listening-p1-${question.id}`} checked={question.correctOptionIds.includes(option.id)} onChange={() => updateQuestion(questionIndex, { ...question, correctOptionIds: [option.id] })} />Đáp án {option.label}</label>
        <input value={option.text} onChange={event => updateQuestion(questionIndex, { ...question, options: question.options.map(item => item.id === option.id ? { ...item, text: event.target.value } : item) })} className={fieldClass} />
        <ImagePicker compact label={`Ảnh ${option.label}`} value={option.imageAssetId} assets={assets} token={token} onAssets={onAssets} onChange={asset => attachOptionAsset(questionIndex, optionIndex, asset)} />
        <button type="button" disabled={!part.imageUrl} onClick={() => { setSelection({ questionIndex, optionIndex }); setCrop({ x: 0, y: 0, width: 1, height: 1 }); }} className={`${actionClass} w-full border-blue-700 bg-blue-700 text-white`}><Crop size={14} className="mr-1 inline" />Crop thủ công</button>
      </section>)}</div>
    </article>)}</div>
    {selection && selectedOption && <section className="space-y-3 rounded-2xl border border-blue-200 bg-blue-50 p-4">
      <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-black text-blue-950">Crop câu {selectedQuestion?.displayNumber || selection.questionIndex + 1} · ảnh {selectedOption.label}</p><p className="text-xs font-semibold text-blue-800">Kéo vùng crop chính xác trên ảnh nguồn.</p></div><button type="button" onClick={() => setSelection(null)} className={`${actionClass} border-blue-700 bg-white text-blue-800`}>Đóng</button></div>
      {part.imageUrl ? <VisualCropEditor imageUrl={part.imageUrl} crop={crop} onChange={setCrop} /> : null}
      <button type="button" disabled={cropping || !part.imageAssetId || !part.imageUrl} onClick={() => void applyCrop()} className={`${actionClass} border-emerald-800 bg-emerald-700 text-white`}>{cropping ? 'Đang tạo crop…' : 'Dùng vùng crop này'}</button>
    </section>}
  </div>;
}

function ChoiceRows({ part, onChange }: { part: ExamPartContent; onChange: (part: ExamPartContent) => void }) {
  const update = (index: number, question: ExamQuestion) => onChange({ ...part, questions: part.questions.map((item, itemIndex) => itemIndex === index ? question : item) });
  return <div className="space-y-3">{part.questions.map((question, index) => <article key={question.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="grid gap-3 md:grid-cols-[120px_minmax(0,1fr)]"><DisplayNumber question={question} onChange={next => update(index, next)} /><label className="text-xs font-black text-slate-700">Nội dung câu hỏi<input value={question.prompt} onChange={event => update(index, { ...question, prompt: event.target.value })} className={`mt-1 ${fieldClass}`} /></label></div>
    <div className="mt-3 grid gap-2 sm:grid-cols-3">{question.options.slice(0, 3).map((option, optionIndex) => <label key={option.id} className={`rounded-xl border p-3 ${question.correctOptionIds.includes(option.id) ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}><span className="flex items-center gap-2 text-xs font-black text-slate-800"><input type="radio" name={`pet-listening-p2-${question.id}`} checked={question.correctOptionIds.includes(option.id)} onChange={() => update(index, { ...question, correctOptionIds: [option.id] })} />{String.fromCharCode(65 + optionIndex)}</span><input value={option.text} onChange={event => update(index, { ...question, options: question.options.map(item => item.id === option.id ? { ...item, text: event.target.value } : item) })} className={`mt-2 ${fieldClass}`} /></label>)}</div>
  </article>)}</div>;
}

function PartTwo({ part, onChange }: Props) {
  return <div className="space-y-4" data-pet-listening-part-two>
    <CountControls count={part.questions.length} onAdd={() => onChange({ ...part, questions: [...part.questions, choiceQuestion(part, `Question ${nextNumber(part)}`)] })} onRemove={() => onChange({ ...part, questions: part.questions.slice(0, -1) })} />
    <p className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-xs font-bold text-indigo-950">Part này không có example. Tiêu đề và hướng dẫn được lấy nguyên văn từ JSON/đề nguồn ở phần thông tin Part phía trên.</p>
    <ChoiceRows part={part} onChange={onChange} />
  </div>;
}

function PartThree({ part, onChange }: Props) {
  const update = (index: number, question: ExamQuestion) => onChange({ ...part, questions: part.questions.map((item, itemIndex) => itemIndex === index ? question : item) });
  return <div className="space-y-4" data-pet-listening-part-three>
    <CountControls count={part.questions.length} onAdd={() => onChange({ ...part, questions: [...part.questions, shortQuestion(part)] })} onRemove={() => onChange({ ...part, questions: part.questions.slice(0, -1) })} />
    <label className="block rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-xs font-black text-indigo-950">Nội dung biểu mẫu và example in sẵn · đặt marker [[số câu]] đúng vị trí mỗi ô nhập<textarea value={part.passage || ''} onChange={event => onChange({ ...part, passage: event.target.value })} className={`mt-2 min-h-44 ${fieldClass}`} placeholder={'Ví dụ:\nSchool trip\nExample: Tuesday\nMeeting place: [[14]]\nLeaving at: [[15]]'} /></label>
    <div className="space-y-3">{part.questions.map((question, index) => <article key={question.id} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 xl:grid-cols-[100px_minmax(180px,1fr)_150px_150px_minmax(220px,1fr)]">
      <DisplayNumber question={question} onChange={next => update(index, next)} />
      <label className="text-xs font-black text-slate-700">Nhãn hàng<input value={question.prompt} onChange={event => update(index, { ...question, prompt: event.target.value })} className={`mt-1 ${fieldClass}`} /></label>
      <label className="text-xs font-black text-slate-700">Chữ trước ô<input value={question.answerPrefix || ''} onChange={event => update(index, { ...question, answerPrefix: event.target.value.slice(0, 20) })} className={`mt-1 ${fieldClass}`} /></label>
      <label className="text-xs font-black text-slate-700">Chữ sau ô<input value={question.answerSuffix || ''} onChange={event => update(index, { ...question, answerSuffix: event.target.value.slice(0, 80) })} className={`mt-1 ${fieldClass}`} /></label>
      <label className="text-xs font-black text-slate-700">Đáp án chính thức, ngăn cách bằng |<input value={question.acceptedAnswers.join(' | ')} onChange={event => update(index, { ...question, acceptedAnswers: parseAnswers(event.target.value) })} className={`mt-1 ${fieldClass}`} /></label>
    </article>)}</div>
  </div>;
}

function PartFour({ part, onChange }: Props) {
  const update = (index: number, question: ExamQuestion) => onChange({ ...part, questions: part.questions.map((item, itemIndex) => itemIndex === index ? question : item) });
  return <div className="space-y-4" data-pet-listening-part-four>
    <CountControls count={part.questions.length} onAdd={() => onChange({ ...part, questions: [...part.questions, choiceQuestion(part, `Statement ${nextNumber(part)}`, true)] })} onRemove={() => onChange({ ...part, questions: part.questions.slice(0, -1) })} />
    <p className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-xs font-bold text-indigo-950">Dạng Yes/No giống Movers Reading &amp; Writing Part 2 nhưng không dùng ảnh.</p>
    <div className="grid gap-3 lg:grid-cols-2">{part.questions.map((question, index) => <article key={question.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-[100px_minmax(0,1fr)]"><DisplayNumber question={question} onChange={next => update(index, next)} /><label className="text-xs font-black text-slate-700">Nhận định<input value={question.prompt} onChange={event => update(index, { ...question, prompt: event.target.value })} className={`mt-1 ${fieldClass}`} /></label></div>
      <div className="mt-3 flex gap-3">{question.options.slice(0, 2).map(option => <label key={option.id} className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-xs font-black uppercase ${question.correctOptionIds.includes(option.id) ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-slate-300 bg-slate-50 text-slate-700'}`}><input type="radio" name={`pet-listening-p4-${question.id}`} checked={question.correctOptionIds.includes(option.id)} onChange={() => update(index, { ...question, correctOptionIds: [option.id] })} />{option.text}</label>)}</div>
    </article>)}</div>
  </div>;
}

export default function PetListeningAuthoring(props: Props) {
  return <section id="pet-listening-authoring" className="space-y-4" data-pet-listening-part={props.part.part}>
    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4"><p className="text-xs font-black uppercase tracking-wide text-blue-800">PET Listening · Part {props.part.part}/4</p><p className="mt-1 text-sm font-semibold text-blue-950">Bốn Part cố định theo dạng bài; số câu lấy từ JSON/đề gốc và vẫn có thể thêm hoặc bớt.</p></div>
    {props.part.part === 1 ? <PartOne {...props} />
      : props.part.part === 2 ? <PartTwo {...props} />
        : props.part.part === 3 ? <PartThree {...props} />
          : <PartFour {...props} />}
  </section>;
}
