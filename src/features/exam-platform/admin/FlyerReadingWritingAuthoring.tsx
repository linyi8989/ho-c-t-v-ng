import { ListeningAssetPicker } from '../../listening/admin/ListeningAssetPicker';
import { listeningApi } from '../../listening/api';
import type { ListeningAsset, ListeningAssetKind } from '../../listening/types';
import { examPartUnits, replaceExamPartUnit } from '../examStructure';
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
const answersText = (question: ExamQuestion) => question.acceptedAnswers.join(' | ');
const parseAnswers = (value: string) => value.split('|').map(item => item.trim()).filter(Boolean).slice(0, 30);
const makeId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

function nextQuestionNumber(unit: ExamPartContent) {
  return Math.max(0, ...unit.questions.map(question => question.number)) + 1;
}

function shortQuestion(unit: ExamPartContent, maxWords = 3): ExamQuestion {
  const number = nextQuestionNumber(unit);
  return { id: makeId('flyer-rw-question'), number, type: 'short-answer', prompt: `Question ${number}: ____`, options: [], correctOptionIds: [], acceptedAnswers: [], points: 1, maxWords };
}

function yesNoQuestion(unit: ExamPartContent): ExamQuestion {
  const options: ExamOption[] = ['Yes', 'No'].map(text => ({ id: makeId('flyer-rw-yes-no'), label: text.toUpperCase(), text }));
  return { ...shortQuestion(unit), type: 'true-false', options, correctOptionIds: [], acceptedAnswers: [] };
}

function choiceQuestion(unit: ExamPartContent): ExamQuestion {
  const options: ExamOption[] = ['A', 'B', 'C'].map(label => ({ id: makeId('flyer-rw-choice'), label, text: `Option ${label}` }));
  return { ...shortQuestion(unit, 1), type: 'single-choice', options, correctOptionIds: [], acceptedAnswers: [] };
}

function renumberQuestions(questions: ExamQuestion[]) {
  const numbers = questions.map(question => question.number).filter(Number.isFinite);
  const start = numbers.length ? Math.min(...numbers) : 1;
  return questions.map((question, index) => ({ ...question, number: start + index }));
}

function addMarker(passage: string | undefined, number: number) {
  const marker = `[[${number}]]`;
  return passage?.includes(marker) ? passage : `${passage?.trim() || ''}${passage?.trim() ? ' ' : ''}${marker}`;
}

function removeMarker(passage: string | undefined, number: number) {
  return (passage || '').replace(new RegExp(`\\s*\\[\\[${number}\\]\\]`), '').trim();
}

function CountControls({ count, onAdd, onRemove, minimum = 1, label = 'câu chấm điểm' }: { count: number; onAdd: () => void; onRemove: () => void; minimum?: number; label?: string }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-3"><p className="text-sm font-black text-sky-950">{count} {label} · số lượng lấy từ đề/JSON, không bị schema khóa</p><div className="flex gap-2"><button type="button" onClick={onAdd} className="rounded-xl border border-sky-300 bg-white px-4 py-2 text-xs font-black text-sky-800">+ Thêm câu</button><button type="button" disabled={count <= minimum} onClick={onRemove} className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-xs font-black text-rose-700 disabled:cursor-not-allowed disabled:opacity-40">Xóa câu cuối</button></div></div>;
}

function ImagePicker({ label, value, optional = false, assets, token, onAssets, onChange }: {
  label: string;
  value?: string;
  optional?: boolean;
  assets: ListeningAsset[];
  token: string;
  onAssets: (asset: ListeningAsset) => void;
  onChange: (asset?: ListeningAsset) => void;
}) {
  const upload = async (file: File, kind: ListeningAssetKind) => {
    const asset = await listeningApi.uploadAsset(token, file, kind);
    onAssets(asset);
    return asset;
  };
  return <ListeningAssetPicker
    label={`${label}${optional ? ' (không bắt buộc)' : ''}`}
    kind="image"
    value={value}
    assets={assets}
    aiCapability={{ enabled: false, reason: 'Giáo viên tải hoặc dán ảnh từ bộ nhớ đệm.' }}
    onUpload={upload}
    onChange={(assetId, uploadedAsset) => onChange(uploadedAsset || (assetId ? assets.find(asset => asset.id === assetId) : undefined))}
  />;
}

function ExamplesEditor({ examples, count, onChange }: { examples: ExamDisplayExample[]; count: number; onChange: (examples: ExamDisplayExample[]) => void }) {
  const rows = Array.from({ length: count }, (_, index) => examples[index] || { prompt: '', answer: '' });
  const update = (index: number, patch: Partial<ExamDisplayExample>) => onChange(rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));
  return <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
    <p className="text-sm font-black text-indigo-950">{count > 1 ? `${count} examples` : 'Example'} không chấm điểm</p>
    <div className="mt-3 grid gap-3 md:grid-cols-2">{rows.map((example, index) => <div key={index} className="rounded-xl bg-white p-3">
      <label className="text-xs font-black text-slate-700">Nội dung example {index + 1}<input value={example.prompt} onChange={event => update(index, { prompt: event.target.value })} className={`mt-1 ${fieldClass}`} /></label>
      <label className="mt-2 block text-xs font-black text-slate-700">Đáp án in sẵn<input value={example.answer} onChange={event => update(index, { answer: event.target.value })} className={`mt-1 ${fieldClass}`} /></label>
    </div>)}</div>
  </section>;
}

function AnswerField({ question, onChange, maxWords = 3 }: { question: ExamQuestion; onChange: (question: ExamQuestion) => void; maxWords?: number }) {
  return <label className="block text-xs font-black text-slate-700">Đáp án chấp nhận (ngăn cách bằng |)<input value={answersText(question)} onChange={event => onChange({ ...question, type: 'short-answer', options: [], correctOptionIds: [], acceptedAnswers: parseAnswers(event.target.value), maxWords })} className={`mt-1 ${fieldClass}`} /></label>;
}

function DefinitionEditor({ unit, imageOptional = false, assets, token, onAssets, onChange }: Omit<Props, 'part'> & { unit: ExamPartContent; imageOptional?: boolean; onChange: (unit: ExamPartContent) => void }) {
  const updateQuestion = (index: number, question: ExamQuestion) => onChange({ ...unit, questions: unit.questions.map((item, itemIndex) => itemIndex === index ? question : item) });
  return <div className="space-y-4">
    <CountControls count={unit.questions.length} onAdd={() => onChange({ ...unit, questions: [...unit.questions, shortQuestion(unit)] })} onRemove={() => onChange({ ...unit, questions: unit.questions.slice(0, -1) })} />
    <ImagePicker label="Ảnh ngân hàng từ/hình hiển thị bên trái" optional={imageOptional} value={unit.imageAssetId} assets={assets} token={token} onAssets={onAssets} onChange={asset => onChange({ ...unit, imageAssetId: asset?.id, imageUrl: asset?.url })} />
    <ExamplesEditor examples={unit.examples || []} count={1} onChange={examples => onChange({ ...unit, examples })} />
    <div className="grid gap-3 md:grid-cols-2">{unit.questions.map((question, index) => <article key={question.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <label className="text-xs font-black text-slate-700">Câu {index + 1} (đặt ____ tại vị trí ô nhập)<textarea value={question.prompt} onChange={event => updateQuestion(index, { ...question, prompt: event.target.value })} className={`mt-1 min-h-20 ${fieldClass}`} /></label>
      <div className="mt-3"><AnswerField question={question} onChange={next => updateQuestion(index, next)} /></div>
    </article>)}</div>
  </div>;
}

function YesNoEditor({ unit, assets, token, onAssets, onChange }: Omit<Props, 'part'> & { unit: ExamPartContent; onChange: (unit: ExamPartContent) => void }) {
  const updateQuestion = (index: number, question: ExamQuestion) => onChange({ ...unit, questions: unit.questions.map((item, itemIndex) => itemIndex === index ? question : item) });
  return <div className="space-y-4">
    <CountControls count={unit.questions.length} onAdd={() => onChange({ ...unit, questions: [...unit.questions, yesNoQuestion(unit)] })} onRemove={() => onChange({ ...unit, questions: unit.questions.slice(0, -1) })} />
    <ImagePicker label="Ảnh tình huống hiển thị bên trái" value={unit.imageAssetId} assets={assets} token={token} onAssets={onAssets} onChange={asset => onChange({ ...unit, imageAssetId: asset?.id, imageUrl: asset?.url })} />
    <ExamplesEditor examples={unit.examples || []} count={2} onChange={examples => onChange({ ...unit, examples })} />
    <div className="grid gap-3 md:grid-cols-2">{unit.questions.map((question, index) => <article key={question.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <label className="text-xs font-black text-slate-700">Nhận định {index + 1}<textarea value={question.prompt} onChange={event => updateQuestion(index, { ...question, prompt: event.target.value })} className={`mt-1 min-h-20 ${fieldClass}`} /></label>
      <div className="mt-3 flex gap-3">{question.options.slice(0, 2).map(option => <label key={option.id} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-black uppercase text-slate-700"><input type="radio" name={`flyer-rw-p2-${question.id}`} checked={question.correctOptionIds.includes(option.id)} onChange={() => updateQuestion(index, { ...question, correctOptionIds: [option.id] })} />{option.text}</label>)}</div>
    </article>)}</div>
  </div>;
}

function StoryTitleEditor({ unit, assets, token, onAssets, onChange }: Omit<Props, 'part'> & { unit: ExamPartContent; onChange: (unit: ExamPartContent) => void }) {
  const gaps = unit.questions.slice(0, -1);
  const titleQuestion = unit.questions.at(-1)!;
  const updateQuestion = (question: ExamQuestion) => onChange({ ...unit, questions: unit.questions.map(item => item.id === question.id ? question : item) });
  return <div className="space-y-4">
    <CountControls count={unit.questions.length} minimum={2} label="câu chấm điểm (gồm câu chọn tiêu đề)" onAdd={() => {
      const nextGap = shortQuestion(unit, 1);
      onChange({ ...unit, passage: addMarker(unit.passage, gaps.length + 1), questions: renumberQuestions([...gaps, nextGap, titleQuestion]) });
    }} onRemove={() => onChange({ ...unit, passage: removeMarker(unit.passage, gaps.length), questions: renumberQuestions([...gaps.slice(0, -1), titleQuestion]) })} />
    <ImagePicker label="Ảnh ngân hàng từ/hình hiển thị bên trái" value={unit.imageAssetId} assets={assets} token={token} onAssets={onAssets} onChange={asset => onChange({ ...unit, imageAssetId: asset?.id, imageUrl: asset?.url })} />
    <ExamplesEditor examples={unit.examples || []} count={1} onChange={examples => onChange({ ...unit, examples })} />
    <label className="block text-xs font-black text-slate-700">Nội dung bài đọc (giữ đúng {gaps.length} marker từ [[1]] đến [[{gaps.length}]])<textarea value={unit.passage || ''} onChange={event => onChange({ ...unit, passage: event.target.value })} className={`mt-1 min-h-64 ${fieldClass}`} /></label>
    <div className="grid gap-3 md:grid-cols-3">{gaps.map((question, index) => <article key={question.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="mb-2 text-xs font-black text-blue-700">Ô {`[[${index + 1}]]`}</p><AnswerField question={question} maxWords={1} onChange={updateQuestion} /></article>)}</div>
    <section className="rounded-2xl border border-orange-200 bg-orange-50 p-4"><label className="text-xs font-black text-orange-950">Câu {gaps.length + 1} · yêu cầu chọn tiêu đề<input value={titleQuestion.prompt} onChange={event => updateQuestion({ ...titleQuestion, prompt: event.target.value })} className={`mt-1 ${fieldClass}`} /></label><div className="mt-3 grid gap-3 md:grid-cols-3">{titleQuestion.options.slice(0, 3).map((option, index) => <label key={option.id} className="rounded-xl bg-white p-3 text-xs font-black text-slate-700"><span className="flex items-center gap-2"><input type="radio" name={`flyer-rw-title-${titleQuestion.id}`} checked={titleQuestion.correctOptionIds.includes(option.id)} onChange={() => updateQuestion({ ...titleQuestion, correctOptionIds: [option.id] })} />Tiêu đề {String.fromCharCode(65 + index)}</span><input value={option.text} onChange={event => updateQuestion({ ...titleQuestion, options: titleQuestion.options.map(item => item.id === option.id ? { ...item, text: event.target.value } : item) })} className={`mt-2 ${fieldClass}`} /></label>)}</div></section>
  </div>;
}

function PartThree({ unit, assets, token, onAssets, onChange }: Omit<Props, 'part'> & { unit: ExamPartContent; onChange: (unit: ExamPartContent) => void }) {
  const setQuestions = (questions: ExamQuestion[]) => onChange({ ...unit, questions, readingScenes: unit.readingScenes?.map(scene => ({ ...scene, questionIds: questions.map(question => question.id) })) });
  return <div className="space-y-4">
    <CountControls count={unit.questions.length} onAdd={() => setQuestions([...unit.questions, shortQuestion(unit, 1)])} onRemove={() => setQuestions(unit.questions.slice(0, -1))} />
    <ImagePicker label="Ảnh lựa chọn A-H hiển thị bên trái" value={unit.imageAssetId} assets={assets} token={token} onAssets={onAssets} onChange={asset => onChange({ ...unit, imageAssetId: asset?.id, imageUrl: asset?.url })} />
    <FlyerPart3Editor token={token} part={unit} assets={assets} onAssets={onAssets} onChange={onChange} />
  </div>;
}

function StoryCompletionEditor({ unit, assets, token, onAssets, onChange }: Omit<Props, 'part'> & { unit: ExamPartContent; onChange: (unit: ExamPartContent) => void }) {
  const updateQuestion = (index: number, question: ExamQuestion) => onChange({ ...unit, questions: unit.questions.map((item, itemIndex) => itemIndex === index ? question : item) });
  return <div className="space-y-4">
    <CountControls count={unit.questions.length} onAdd={() => onChange({ ...unit, questions: [...unit.questions, shortQuestion(unit, 4)] })} onRemove={() => onChange({ ...unit, questions: unit.questions.slice(0, -1) })} />
    <ImagePicker label="Ảnh đầy đủ của Part 5 hiển thị bên trái cho học sinh" value={unit.imageAssetId} assets={assets} token={token} onAssets={onAssets} onChange={asset => onChange({ ...unit, imageAssetId: asset?.id, imageUrl: asset?.url })} />
    <ExamplesEditor examples={unit.examples || []} count={2} onChange={examples => onChange({ ...unit, examples })} />
    <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-600">Nội dung truyện và câu hỏi đã nằm trong ảnh bên trái; hệ thống không dựng lại đoạn truyện cho học sinh.</p>
    <div className="grid gap-3 md:grid-cols-2">{unit.questions.map((question, index) => <article key={question.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><label className="text-xs font-black text-slate-700">Câu hoàn thành {index + 1}<textarea value={question.prompt} onChange={event => updateQuestion(index, { ...question, prompt: event.target.value })} className={`mt-1 min-h-20 ${fieldClass}`} /></label><div className="mt-3"><AnswerField question={question} maxWords={4} onChange={next => updateQuestion(index, next)} /></div></article>)}</div>
  </div>;
}

function ChoiceClozeEditor({ unit, assets, token, onAssets, onChange }: Omit<Props, 'part'> & { unit: ExamPartContent; onChange: (unit: ExamPartContent) => void }) {
  const updateQuestion = (index: number, question: ExamQuestion) => onChange({ ...unit, questions: unit.questions.map((item, itemIndex) => itemIndex === index ? question : item) });
  const add = () => onChange({ ...unit, questions: [...unit.questions, choiceQuestion(unit)] });
  const remove = () => onChange({ ...unit, questions: unit.questions.slice(0, -1) });
  return <div className="space-y-4">
    <CountControls count={unit.questions.length} onAdd={add} onRemove={remove} />
    <ImagePicker label="Ảnh bài đọc duy nhất · học sinh nhìn bên trái" value={unit.imageAssetId} assets={assets} token={token} onAssets={onAssets} onChange={asset => onChange({ ...unit, imageAssetId: asset?.id, imageUrl: asset?.url })} />
    <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-600">Ảnh đã chứa passage, example và số câu. Bên phải học sinh chỉ thấy các hàng đáp án A/B/C như Movers Reading & Writing Part 6.</p>
    <div className="space-y-2">{unit.questions.map((question, index) => <article key={question.id} className="grid items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-[42px_repeat(3,minmax(0,1fr))]"><b className="text-center text-sm text-blue-700">{index + 1}.</b>{question.options.slice(0, 3).map((option, optionIndex) => <label key={option.id} className={`flex min-w-0 items-center gap-2 rounded-lg border p-2 ${question.correctOptionIds.includes(option.id) ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}><input type="radio" name={`flyer-rw-p6-${question.id}`} checked={question.correctOptionIds.includes(option.id)} onChange={() => updateQuestion(index, { ...question, correctOptionIds: [option.id] })} /><b className="text-xs text-slate-700">{String.fromCharCode(65 + optionIndex)}.</b><input aria-label={`Lựa chọn ${String.fromCharCode(65 + optionIndex)} câu ${index + 1}`} value={option.text} onChange={event => updateQuestion(index, { ...question, options: question.options.map(item => item.id === option.id ? { ...item, text: event.target.value } : item) })} className="min-w-0 flex-1 border-0 border-b border-slate-300 bg-transparent px-1 py-1 text-sm font-semibold outline-none focus:border-blue-500" /></label>)}</article>)}</div>
  </div>;
}

function OpenClozeEditor({ unit, assets, token, onAssets, onChange }: Omit<Props, 'part'> & { unit: ExamPartContent; onChange: (unit: ExamPartContent) => void }) {
  const updateQuestion = (index: number, question: ExamQuestion) => onChange({ ...unit, questions: unit.questions.map((item, itemIndex) => itemIndex === index ? question : item) });
  const add = () => { const number = unit.questions.length + 1; onChange({ ...unit, passage: addMarker(unit.passage, number), questions: [...unit.questions, shortQuestion(unit, 1)] }); };
  const remove = () => onChange({ ...unit, passage: removeMarker(unit.passage, unit.questions.length), questions: unit.questions.slice(0, -1) });
  return <div className="space-y-4">
    <CountControls count={unit.questions.length} onAdd={add} onRemove={remove} />
    <ImagePicker label="Ảnh minh họa bài đọc" optional value={unit.imageAssetId} assets={assets} token={token} onAssets={onAssets} onChange={asset => onChange({ ...unit, imageAssetId: asset?.id, imageUrl: asset?.url })} />
    <ExamplesEditor examples={unit.examples || []} count={1} onChange={examples => onChange({ ...unit, examples })} />
    <label className="block text-xs font-black text-slate-700">Nội dung bài đọc (giữ đúng {unit.questions.length} marker từ [[1]] đến [[{unit.questions.length}]])<textarea value={unit.passage || ''} onChange={event => onChange({ ...unit, passage: event.target.value })} className={`mt-1 min-h-64 ${fieldClass}`} /></label>
    <div className="grid gap-3 md:grid-cols-2">{unit.questions.map((question, index) => <article key={question.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><label className="text-xs font-black text-slate-700">Ô [[{index + 1}]] · nhãn/ngữ cảnh<input value={question.prompt} onChange={event => updateQuestion(index, { ...question, prompt: event.target.value })} className={`mt-1 ${fieldClass}`} /></label><div className="mt-3"><AnswerField question={question} maxWords={1} onChange={next => updateQuestion(index, next)} /></div></article>)}</div>
  </div>;
}

export default function FlyerReadingWritingAuthoring({ token, part, assets, onAssets, onChange }: Props) {
  const unit = examPartUnits(part)[0] || part;
  const commit = (nextUnit: ExamPartContent) => onChange(replaceExamPartUnit(part, nextUnit));
  const shared = { unit, assets, token, onAssets, onChange: commit };
  return <section className="space-y-4" data-flyer-reading-writing-editor={part.part}>
    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4"><p className="text-xs font-black uppercase tracking-wide text-blue-700">Flyers Reading & Writing · Part {part.part}</p><p className="mt-1 text-sm font-semibold text-blue-950">Giữ đúng 7 Part. Số câu chấm điểm lấy theo đề gốc hoặc JSON và có thể điều chỉnh; example luôn tách riêng, không chấm điểm.</p></div>
    {part.part === 1 ? <DefinitionEditor {...shared} /> : part.part === 2 ? <YesNoEditor {...shared} /> : part.part === 3 ? <PartThree {...shared} /> : part.part === 4 ? <StoryTitleEditor {...shared} /> : part.part === 5 ? <StoryCompletionEditor {...shared} /> : part.part === 6 ? <ChoiceClozeEditor {...shared} /> : <OpenClozeEditor {...shared} />}
  </section>;
}
