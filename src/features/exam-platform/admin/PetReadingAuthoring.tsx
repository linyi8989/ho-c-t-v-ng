import { ListeningAssetPicker } from '../../listening/admin/ListeningAssetPicker';
import { listeningApi } from '../../listening/api';
import type { ListeningAsset, ListeningAssetKind } from '../../listening/types';
import PetNoticeFrame from '../PetNoticeFrame';
import { createDefaultPetReadingExample } from '../petReadingMigration';
import type { ExamDisplayExample, ExamOption, ExamPartContent, ExamQuestion } from '../types';

interface Props {
  token: string;
  part: ExamPartContent;
  assets: ListeningAsset[];
  onAssets: (asset: ListeningAsset) => void;
  onChange: (part: ExamPartContent) => void;
}

const fieldClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100';
const makeId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

function nextNumber(part: ExamPartContent) {
  return Math.max(0, ...part.questions.map(question => question.number)) + 1;
}

function choiceOptions(count: number): ExamOption[] {
  return Array.from({ length: count }, (_, index) => ({
    id: makeId('pet-reading-option'),
    label: String.fromCharCode(65 + index),
    text: `Option ${String.fromCharCode(65 + index)}`,
  }));
}

function choiceQuestion(part: ExamPartContent, count: number): ExamQuestion {
  const number = nextNumber(part);
  return {
    id: makeId('pet-reading-question'),
    number,
    displayNumber: number,
    type: 'single-choice',
    prompt: `Question ${number}`,
    options: choiceOptions(count),
    correctOptionIds: [],
    acceptedAnswers: [],
    points: 1,
  };
}

function yesNoQuestion(part: ExamPartContent): ExamQuestion {
  const number = nextNumber(part);
  const options = ['Yes', 'No'].map(text => ({ id: makeId('pet-reading-yes-no'), label: text.toUpperCase(), text }));
  return {
    id: makeId('pet-reading-question'),
    number,
    displayNumber: number,
    type: 'true-false',
    prompt: `Statement ${number}`,
    options,
    correctOptionIds: [],
    acceptedAnswers: [],
    points: 1,
  };
}

function CountControls({ count, label = 'câu', onAdd, onRemove }: { count: number; label?: string; onAdd: () => void; onRemove: () => void }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-3">
    <p className="text-sm font-black text-sky-950">{count} {label} · có thể thêm/bớt theo đề gốc</p>
    <div className="flex gap-2"><button type="button" onClick={onAdd} className="rounded-xl border border-sky-300 bg-white px-4 py-2 text-xs font-black text-sky-800">+ Thêm câu</button><button type="button" disabled={count <= 1} onClick={onRemove} className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-xs font-black text-rose-700 disabled:opacity-40">Xóa câu cuối</button></div>
  </div>;
}

function ImagePicker({ label, value, assets, token, onAssets, onChange }: {
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
    return asset;
  };
  return <ListeningAssetPicker
    label={label}
    kind="image"
    value={value}
    assets={assets}
    aiCapability={{ enabled: false, reason: 'Giáo viên tải hoặc dán đúng ảnh từ đề gốc.' }}
    onUpload={upload}
    onChange={(assetId, uploadedAsset) => onChange(uploadedAsset || (assetId ? assets.find(asset => asset.id === assetId) : undefined))}
  />;
}

function DisplayNumber({ question, onChange }: { question: ExamQuestion; onChange: (question: ExamQuestion) => void }) {
  return <label className="text-xs font-black text-slate-700">Số in trên đề<input type="number" min={1} value={question.displayNumber || question.number} onChange={event => onChange({ ...question, displayNumber: Math.max(1, Number(event.target.value) || 1) })} className={`mt-1 ${fieldClass}`} /></label>;
}

function ChoiceEditor({ question, optionCount, onChange }: { question: ExamQuestion; optionCount: number; onChange: (question: ExamQuestion) => void }) {
  return <div className={`grid gap-2 ${optionCount === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2 xl:grid-cols-4'}`}>
    {question.options.slice(0, optionCount).map((option, index) => <label key={option.id} className={`rounded-xl border p-3 ${question.correctOptionIds.includes(option.id) ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
      <span className="flex items-center gap-2 text-xs font-black text-slate-800"><input type="radio" name={`pet-reading-${question.id}`} checked={question.correctOptionIds.includes(option.id)} onChange={() => onChange({ ...question, correctOptionIds: [option.id] })} />{String.fromCharCode(65 + index)}</span>
      <input value={option.text} onChange={event => onChange({ ...question, options: question.options.map(item => item.id === option.id ? { ...item, text: event.target.value } : item) })} className={`mt-2 ${fieldClass}`} />
    </label>)}
  </div>;
}

function WorkedExampleEditor({ partNumber, example, onChange }: { partNumber: 1 | 5; example?: ExamDisplayExample; onChange: (example: ExamDisplayExample) => void }) {
  const value = example || createDefaultPetReadingExample(partNumber);
  const optionCount = partNumber === 1 ? 3 : 4;
  const options = Array.from({ length: optionCount }, (_, index) => value.options?.[index] || { label: String.fromCharCode(65 + index), text: '' });
  const updateOption = (index: number, text: string) => onChange({ ...value, options: options.map((option, optionIndex) => optionIndex === index ? { ...option, label: String.fromCharCode(65 + optionIndex), text } : { ...option, label: String.fromCharCode(65 + optionIndex) }) });
  return <section className="rounded-2xl border border-amber-300 bg-amber-50/80 p-4" data-pet-reading-example-authoring={partNumber}>
    <div className="mb-3"><h4 className="text-sm font-black text-amber-950">Example · không chấm điểm</h4><p className="mt-1 text-xs font-semibold text-amber-800">Example được nhập từ JSON/prompt và hiển thị nguyên đáp án mẫu cho học sinh trước các câu chấm điểm.</p></div>
    <div className={partNumber === 1 ? 'grid gap-4 xl:grid-cols-[minmax(300px,.95fr)_minmax(0,1.05fr)]' : 'space-y-3'}>
      <div className="space-y-3">
        {partNumber === 1 && <div className="min-h-52"><PetNoticeFrame variant={0} content={value.prompt} label="Xem trước notice của example" /></div>}
        <label className="block text-xs font-black text-slate-700">{partNumber === 1 ? 'Nội dung notice/message của example' : 'Số in của example'}<textarea value={value.prompt} onChange={event => onChange({ ...value, prompt: event.target.value })} className={`mt-1 ${partNumber === 1 ? 'min-h-28' : 'min-h-12'} ${fieldClass}`} /></label>
      </div>
      <div className="space-y-3">
        <div className={`grid gap-2 ${optionCount === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2 xl:grid-cols-4'}`}>{options.map((option, index) => <label key={index} className={`rounded-xl border p-3 ${value.answer.toUpperCase() === String.fromCharCode(65 + index) ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white'}`}><span className="text-xs font-black text-slate-800">{String.fromCharCode(65 + index)}</span><textarea value={option.text} onChange={event => updateOption(index, event.target.value)} className={`mt-2 min-h-20 ${fieldClass}`} /></label>)}</div>
        <label className="block text-xs font-black text-slate-700">Đáp án example<select value={value.answer.toUpperCase()} onChange={event => onChange({ ...value, options, answer: event.target.value })} className={`mt-1 ${fieldClass}`}>{options.map((_option, index) => { const label = String.fromCharCode(65 + index); return <option key={label} value={label}>{label}</option>; })}</select></label>
      </div>
    </div>
  </section>;
}

function PartOne({ part, onChange }: Props) {
  const update = (index: number, question: ExamQuestion) => onChange({ ...part, questions: part.questions.map((item, itemIndex) => itemIndex === index ? question : item) });
  return <div className="space-y-4">
    <WorkedExampleEditor partNumber={1} example={part.examples?.[0]} onChange={example => onChange({ ...part, examples: [example] })} />
    <CountControls count={part.questions.length} label="khung thông báo" onAdd={() => onChange({ ...part, questions: [...part.questions, { ...choiceQuestion(part, 3), context: 'Nội dung thông báo mới' }] })} onRemove={() => onChange({ ...part, questions: part.questions.slice(0, -1) })} />
    <div className="space-y-4" data-pet-reading-part1-authoring>{part.questions.map((question, index) => <article key={question.id} className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:grid-cols-[minmax(300px,.95fr)_minmax(0,1.05fr)]">
      <div className="space-y-3">
        <div className="flex items-end gap-3"><div className="w-28"><DisplayNumber question={question} onChange={next => update(index, next)} /></div><p className="pb-2 text-xs font-black text-sky-800">Mẫu khung {index % 5 + 1}/5 · tự động</p></div>
        <div className="h-64"><PetNoticeFrame variant={index} content={question.context} label={`Xem trước nội dung thông báo câu ${question.displayNumber || index + 1}`} /></div>
        <label className="block text-xs font-black text-slate-700">Nội dung nằm trong khung mặc định<textarea value={question.context || ''} onChange={event => update(index, { ...question, context: event.target.value })} placeholder={'Dòng đầu là tiêu đề\nCác dòng sau là nội dung thông báo'} className={`mt-1 min-h-28 ${fieldClass}`} /></label>
      </div>
      <div><label className="text-xs font-black text-slate-700">Câu hỏi tương ứng bên phải<textarea value={question.prompt} onChange={event => update(index, { ...question, prompt: event.target.value })} className={`mt-1 min-h-20 ${fieldClass}`} /></label><div className="mt-3"><ChoiceEditor question={question} optionCount={3} onChange={next => update(index, next)} /></div></div>
    </article>)}</div>
  </div>;
}

function PartTwo({ part, onChange }: Props) {
  const bank = Array.from({ length: 8 }, (_, index) => part.questions[0]?.options[index]?.text || `Choice ${String.fromCharCode(65 + index)}`);
  const updateQuestion = (index: number, question: ExamQuestion) => onChange({ ...part, questions: part.questions.map((item, itemIndex) => itemIndex === index ? question : item) });
  const updateBank = (optionIndex: number, text: string) => onChange({
    ...part,
    questions: part.questions.map(question => ({
      ...question,
      options: question.options.map((option, index) => index === optionIndex ? { ...option, label: String.fromCharCode(65 + index), text } : option),
    })),
  });
  return <div className="space-y-4" data-pet-reading-part2-authoring>
    <CountControls count={part.questions.length} label="người" onAdd={() => onChange({ ...part, questions: [...part.questions, { ...choiceQuestion(part, 8), options: choiceOptions(8).map((option, index) => ({ ...option, text: bank[index] })) }] })} onRemove={() => onChange({ ...part, questions: part.questions.slice(0, -1) })} />
    <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4"><h4 className="text-sm font-black text-indigo-950">Ngân hàng 8 lựa chọn A–H</h4><p className="mt-1 text-xs font-semibold text-indigo-800">Nhập một lần; hệ thống dùng cùng nội dung cho mọi câu và JSON có thể thay toàn bộ ngân hàng này.</p><div className="mt-3 grid gap-3 md:grid-cols-2">{bank.map((text, index) => <label key={index} className="grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-2 text-xs font-black text-indigo-900"><span>{String.fromCharCode(65 + index)}.</span><textarea value={text} onChange={event => updateBank(index, event.target.value)} className={`min-h-20 ${fieldClass}`} /></label>)}</div></section>
    <div className="space-y-3">{part.questions.map((question, index) => <article key={question.id} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[110px_minmax(0,1fr)_180px]"><DisplayNumber question={question} onChange={next => updateQuestion(index, next)} /><label className="text-xs font-black text-slate-700">Mô tả người {index + 1}<textarea value={question.prompt} onChange={event => updateQuestion(index, { ...question, prompt: event.target.value })} className={`mt-1 min-h-20 ${fieldClass}`} /></label><label className="text-xs font-black text-slate-700">Đáp án đúng<select value={question.options.findIndex(option => question.correctOptionIds.includes(option.id)) >= 0 ? String(question.options.findIndex(option => question.correctOptionIds.includes(option.id))) : ''} onChange={event => { const option = question.options[Number(event.target.value)]; updateQuestion(index, { ...question, correctOptionIds: option ? [option.id] : [] }); }} className={`mt-1 ${fieldClass}`}><option value="">Chưa chọn</option>{question.options.slice(0, 8).map((option, optionIndex) => <option key={option.id} value={optionIndex}>{String.fromCharCode(65 + optionIndex)} · {option.text.slice(0, 48)}</option>)}</select></label></article>)}</div>
  </div>;
}

function PartThree({ token, part, assets, onAssets, onChange }: Props) {
  const update = (index: number, question: ExamQuestion) => onChange({ ...part, questions: part.questions.map((item, itemIndex) => itemIndex === index ? question : item) });
  return <div className="space-y-4" data-pet-reading-part3-authoring>
    <CountControls count={part.questions.length} label="nhận định Yes/No" onAdd={() => onChange({ ...part, questions: [...part.questions, yesNoQuestion(part)] })} onRemove={() => onChange({ ...part, questions: part.questions.slice(0, -1) })} />
    <ImagePicker label="Ảnh tình huống duy nhất · hiển thị bên trái" value={part.imageAssetId} assets={assets} token={token} onAssets={onAssets} onChange={asset => onChange({ ...part, imageAssetId: asset?.id, imageUrl: asset?.url })} />
    <div className="space-y-3">{part.questions.map((question, index) => <article key={question.id} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[110px_minmax(0,1fr)_180px]"><DisplayNumber question={question} onChange={next => update(index, next)} /><label className="text-xs font-black text-slate-700">Nhận định {index + 1}<textarea value={question.prompt} onChange={event => update(index, { ...question, prompt: event.target.value })} className={`mt-1 min-h-20 ${fieldClass}`} /></label><div className="flex items-end gap-2">{question.options.slice(0, 2).map(option => <label key={option.id} className={`flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border text-xs font-black uppercase ${question.correctOptionIds.includes(option.id) ? 'border-emerald-400 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-50 text-slate-700'}`}><input type="radio" name={`pet-reading-yes-no-${question.id}`} checked={question.correctOptionIds.includes(option.id)} onChange={() => update(index, { ...question, correctOptionIds: [option.id] })} />{option.text}</label>)}</div></article>)}</div>
  </div>;
}

function PassageChoicePart({ part, onChange }: Props) {
  const optionCount = 4;
  const update = (index: number, question: ExamQuestion) => onChange({ ...part, questions: part.questions.map((item, itemIndex) => itemIndex === index ? question : item) });
  const updateDisplayNumber = (index: number, question: ExamQuestion) => {
    const previous = part.questions[index];
    const previousNumber = previous.displayNumber || previous.number;
    const nextNumber = question.displayNumber || question.number;
    const passage = part.part === 5 && previousNumber !== nextNumber
      ? (part.passage || '').replaceAll(`[[${previousNumber}]]`, `[[${nextNumber}]]`)
      : part.passage;
    onChange({ ...part, passage, questions: part.questions.map((item, itemIndex) => itemIndex === index ? question : item) });
  };
  const add = () => {
    const question = choiceQuestion(part, optionCount);
    const displayNumber = question.displayNumber || question.number;
    onChange({ ...part, passage: part.part === 5 ? `${part.passage?.trim() || ''}${part.passage?.trim() ? ' ' : ''}[[${displayNumber}]]` : part.passage, questions: [...part.questions, question] });
  };
  const remove = () => {
    const last = part.questions.at(-1);
    const marker = last ? `[[${last.displayNumber || last.number}]]` : '';
    onChange({
      ...part,
      passage: part.part === 5 && marker ? (part.passage || '').replaceAll(marker, '').replace(/\s{2,}/g, ' ').trim() : part.passage,
      questions: part.questions.slice(0, -1),
    });
  };
  return <div className="space-y-4" data-pet-reading-passage-choice={part.part}>
    {part.part === 5 && <WorkedExampleEditor partNumber={5} example={part.examples?.[0]} onChange={example => onChange({ ...part, examples: [example] })} />}
    <CountControls count={part.questions.length} onAdd={add} onRemove={remove} />
    <label className="block text-xs font-black text-slate-700">{part.part === 5 ? 'Bài đọc có ô trống (dùng marker [[số câu]], ví dụ [[26]])' : 'Bài đọc hiển thị trong khung phía trên'}<textarea value={part.passage || ''} onChange={event => onChange({ ...part, passage: event.target.value })} className={`mt-1 min-h-64 ${fieldClass}`} /></label>
    <div className="space-y-3">{part.questions.map((question, index) => <article key={question.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="grid gap-3 md:grid-cols-[110px_minmax(0,1fr)]"><DisplayNumber question={question} onChange={next => updateDisplayNumber(index, next)} /><label className="text-xs font-black text-slate-700">{part.part === 5 ? 'Nhãn quản trị cho ô trống' : 'Câu hỏi'}<textarea value={question.prompt} onChange={event => update(index, { ...question, prompt: event.target.value })} className={`mt-1 min-h-20 ${fieldClass}`} /></label></div><div className="mt-3"><ChoiceEditor question={question} optionCount={optionCount} onChange={next => update(index, next)} /></div></article>)}</div>
  </div>;
}

export default function PetReadingAuthoring(props: Props) {
  const { part } = props;
  return <section id="pet-reading-authoring" className="space-y-4" data-pet-reading-part={part.part}>
    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4"><p className="text-xs font-black uppercase tracking-wide text-blue-800">PET Reading · Part {part.part}/5</p><p className="mt-1 text-sm font-semibold text-blue-950">{part.part === 1 ? 'Năm mẫu khung màu được hệ thống dựng sẵn; giáo viên chỉ nhập nội dung notice, câu hỏi và đáp án. Không cần tải ảnh khung.' : 'Ảnh chỉ được dùng ở đúng vị trí của đề gốc; nội dung và đáp án vẫn lưu theo câu để backend chấm.'} Mỗi Part có thể thêm hoặc bớt câu trước khi xuất bản.</p></div>
    {part.part === 1 ? <PartOne {...props} /> : part.part === 2 ? <PartTwo {...props} /> : part.part === 3 ? <PartThree {...props} /> : <PassageChoicePart {...props} />}
  </section>;
}
