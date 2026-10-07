import { ListeningAssetPicker } from '../../listening/admin/ListeningAssetPicker';
import { listeningApi } from '../../listening/api';
import type { ListeningAsset, ListeningAssetKind } from '../../listening/types';
import type { ExamPartContent, ExamQuestion } from '../types';

interface Props {
  token: string;
  part: ExamPartContent;
  assets: ListeningAsset[];
  onAssets: (asset: ListeningAsset) => void;
  onChange: (part: ExamPartContent) => void;
}

const fieldClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100';

function updateQuestion(part: ExamPartContent, index: number, question: ExamQuestion) {
  return { ...part, questions: part.questions.map((item, itemIndex) => itemIndex === index ? question : item) };
}

function AnswerSelect({ question, onChange }: { question: ExamQuestion; onChange: (question: ExamQuestion) => void }) {
  const selectedIndex = question.options.findIndex(option => question.correctOptionIds.includes(option.id));
  return <label className="text-xs font-black text-slate-700">Đáp án đúng
    <select value={selectedIndex >= 0 ? selectedIndex : ''} onChange={event => { const option = question.options[Number(event.target.value)]; onChange({ ...question, correctOptionIds: option ? [option.id] : [] }); }} className={`mt-1 ${fieldClass}`}>
      <option value="">Chưa chọn</option>
      {question.options.map((option, index) => <option key={option.id} value={index}>{String.fromCharCode(65 + index)} · {option.text.slice(0, 72)}</option>)}
    </select>
  </label>;
}

function PartOne({ part, onChange }: Props) {
  return <div className="space-y-4" data-fce-reading-part1-authoring>
    <label className="block text-xs font-black text-slate-700">Toàn bộ bài đọc Part 1
      <textarea value={part.passage || ''} onChange={event => onChange({ ...part, passage: event.target.value })} className={`mt-1 min-h-80 leading-7 ${fieldClass}`} />
    </label>
    <div className="space-y-3">{part.questions.map((question, index) => <article key={question.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]"><label className="text-xs font-black text-slate-700">Câu {question.displayNumber}
        <textarea value={question.prompt} onChange={event => onChange(updateQuestion(part, index, { ...question, prompt: event.target.value }))} className={`mt-1 min-h-20 ${fieldClass}`} />
      </label><AnswerSelect question={question} onChange={next => onChange(updateQuestion(part, index, next))} /></div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">{question.options.map((option, optionIndex) => <label key={option.id} className={`rounded-xl border p-3 text-xs font-black ${question.correctOptionIds.includes(option.id) ? 'border-emerald-500 bg-emerald-50 text-emerald-950' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>{String.fromCharCode(65 + optionIndex)}
        <textarea value={option.text} onChange={event => onChange(updateQuestion(part, index, { ...question, options: question.options.map(item => item.id === option.id ? { ...item, text: event.target.value } : item) }))} className={`mt-2 min-h-16 ${fieldClass}`} />
      </label>)}</div>
    </article>)}</div>
  </div>;
}

function PartTwo({ part, onChange }: Props) {
  const bank = Array.from({ length: 8 }, (_, index) => part.questions[0]?.options[index]?.text || '');
  const updateBank = (optionIndex: number, text: string) => onChange({
    ...part,
    questions: part.questions.map(question => ({
      ...question,
      options: question.options.map((option, index) => index === optionIndex ? { ...option, label: String.fromCharCode(65 + index), text } : option),
    })),
  });
  return <div className="space-y-4" data-fce-reading-part2-authoring>
    <label className="block text-xs font-black text-slate-700">Bài đọc có 7 vị trí điền · dùng marker [[9]] đến [[15]] đúng một lần
      <textarea value={part.passage || ''} onChange={event => onChange({ ...part, passage: event.target.value })} className={`mt-1 min-h-80 leading-7 ${fieldClass}`} />
    </label>
    <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4"><h4 className="text-sm font-black text-indigo-950">Các đoạn A–H · học sinh chỉ đọc và nhập chữ cái</h4><div className="mt-3 grid gap-3 md:grid-cols-2">{bank.map((text, index) => <label key={index} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-2 text-xs font-black text-indigo-950"><span className="pt-3">{String.fromCharCode(65 + index)}.</span><textarea value={text} onChange={event => updateBank(index, event.target.value)} className={`min-h-28 ${fieldClass}`} /></label>)}</div></section>
    <div className="grid gap-3 md:grid-cols-2">{part.questions.map((question, index) => <article key={question.id} className="grid grid-cols-[minmax(0,1fr)_170px] items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><label className="text-xs font-black text-slate-700">Ô trống {question.displayNumber}<input value={question.prompt} onChange={event => onChange(updateQuestion(part, index, { ...question, prompt: event.target.value }))} className={`mt-1 ${fieldClass}`} /></label><AnswerSelect question={question} onChange={next => onChange(updateQuestion(part, index, next))} /></article>)}</div>
  </div>;
}

function PartThree({ token, part, assets, onAssets, onChange }: Props) {
  const upload = async (file: File, kind: ListeningAssetKind) => {
    const asset = await listeningApi.uploadAsset(token, file, kind);
    onAssets(asset);
    return asset;
  };
  const updateBank = (optionIndex: number, text: string) => onChange({
    ...part,
    questions: part.questions.map(question => ({ ...question, options: question.options.map((option, index) => index === optionIndex ? { ...option, text } : option) })),
  });
  return <div className="space-y-4" data-fce-reading-part3-authoring>
    <ListeningAssetPicker label="Ảnh chứa bốn đoạn A–D · hiển thị bên trái" kind="image" value={part.imageAssetId} assets={assets} aiCapability={{ enabled: false, reason: 'Giáo viên tải hoặc dán đúng ảnh bốn đoạn A–D từ đề gốc.' }} onUpload={upload} onChange={(assetId, uploaded) => { const asset = uploaded || assets.find(item => item.id === assetId); onChange({ ...part, imageAssetId: asset?.id, imageUrl: asset?.url }); }} />
    <section className="rounded-2xl border border-violet-200 bg-violet-50 p-4"><h4 className="text-sm font-black text-violet-950">Nhãn bốn người/đoạn A–D</h4><div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{part.questions[0]?.options.slice(0, 4).map((option, index) => <label key={option.id} className="text-xs font-black text-violet-950">{String.fromCharCode(65 + index)}<input value={option.text} onChange={event => updateBank(index, event.target.value)} className={`mt-1 ${fieldClass}`} /></label>)}</div></section>
    <div className="space-y-2">{part.questions.map((question, index) => <article key={question.id} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm md:grid-cols-[4rem_minmax(0,1fr)_210px]"><div className="flex h-11 items-center justify-center rounded-xl bg-blue-700 text-sm font-black text-white">{question.displayNumber}</div><label className="sr-only">Câu {question.displayNumber}</label><input value={question.prompt} onChange={event => onChange(updateQuestion(part, index, { ...question, prompt: event.target.value }))} className={fieldClass} /><AnswerSelect question={question} onChange={next => onChange(updateQuestion(part, index, next))} /></article>)}</div>
  </div>;
}

export default function FceReadingAuthoring(props: Props) {
  return <section id="fce-reading-authoring" className="space-y-4" data-fce-reading-part={props.part.part}>
    <div className="rounded-2xl border border-blue-300 bg-blue-50 p-4 text-blue-950"><p className="text-xs font-black uppercase tracking-wide text-blue-800">FCE Reading · Part {props.part.part}/3</p><p className="mt-1 text-sm font-semibold">Cấu trúc cố định 8–7–15. JSON từ ChatGPT được chuẩn hóa lại, còn đáp án chính thức chỉ dùng ở backend để chấm.</p></div>
    {props.part.part === 1 ? <PartOne {...props} /> : props.part.part === 2 ? <PartTwo {...props} /> : <PartThree {...props} />}
  </section>;
}
