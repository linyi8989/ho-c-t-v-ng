import { useEffect, useState } from 'react';
import { ListeningAssetPicker } from '../../listening/admin/ListeningAssetPicker';
import { listeningApi } from '../../listening/api';
import type { ListeningAsset, ListeningAssetKind } from '../../listening/types';
import { examPartUnits, replaceExamPartUnit } from '../examStructure';
import { examPlatformApi } from '../api';
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
const answersText = (question: ExamQuestion) => question.acceptedAnswers.join(' | ');
const parseAnswers = (value: string) => value.split('|').map(item => item.trim()).filter(Boolean).slice(0, 30);

function nextNumber(part: ExamPartContent) {
  return Math.max(0, ...part.questions.map(question => question.number)) + 1;
}

function threeOptions(): ExamOption[] {
  return ['A', 'B', 'C'].map(label => ({ id: makeId('ket-rw-option'), label, text: `Option ${label}` }));
}

function choiceQuestion(part: ExamPartContent): ExamQuestion {
  const number = nextNumber(part);
  return { id: makeId('ket-rw-question'), number, displayNumber: number, type: 'single-choice', prompt: `Question ${number}`, options: threeOptions(), correctOptionIds: [], acceptedAnswers: [], points: 1 };
}

function shortQuestion(part: ExamPartContent, patch: Partial<ExamQuestion> = {}): ExamQuestion {
  const number = nextNumber(part);
  return { id: makeId('ket-rw-question'), number, displayNumber: number, type: 'short-answer', prompt: `Question ${number}`, options: [], correctOptionIds: [], acceptedAnswers: [], points: 1, maxWords: 1, ...patch };
}

function CountControls({ count, onAdd, onRemove, label = 'câu chấm điểm' }: { count: number; onAdd: () => void; onRemove: () => void; label?: string }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-3" data-ket-count-controls>
    <p className="text-sm font-black text-sky-950">{count} {label} · có thể thêm/bớt theo đề gốc</p>
    <div className="flex gap-2">
      <button type="button" onClick={onAdd} className="rounded-xl border border-sky-300 bg-white px-4 py-2 text-xs font-black text-sky-900">+ Thêm câu</button>
      <button type="button" disabled={count <= 1} onClick={onRemove} className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-xs font-black text-rose-800 disabled:cursor-not-allowed disabled:opacity-40">Xóa câu cuối</button>
    </div>
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
    aiCapability={{ enabled: false, reason: 'Giáo viên tải hoặc dán ảnh từ bộ nhớ đệm.' }}
    onUpload={upload}
    onChange={(assetId, uploadedAsset) => onChange(uploadedAsset || (assetId ? assets.find(asset => asset.id === assetId) : undefined))}
  />;
}

function ExampleEditor({ examples, onChange }: { examples: ExamDisplayExample[]; onChange: (examples: ExamDisplayExample[]) => void }) {
  const example = examples[0] || { prompt: '', answer: '' };
  return <section className="grid gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 md:grid-cols-2" data-ket-example-editor>
    <label className="text-xs font-black text-indigo-950">Example không chấm điểm<input value={example.prompt} onChange={event => onChange([{ ...example, prompt: event.target.value }])} className={`mt-1 ${fieldClass}`} /></label>
    <label className="text-xs font-black text-indigo-950">Đáp án in sẵn<input value={example.answer} onChange={event => onChange([{ ...example, answer: event.target.value }])} className={`mt-1 ${fieldClass}`} /></label>
  </section>;
}

function PassageEditor({ value, onChange, label = 'Nội dung đề và example được nhận diện từ ảnh' }: { value?: string; onChange: (value: string) => void; label?: string }) {
  return <label className="block rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-xs font-black text-indigo-950" data-ket-passage-editor>
    {label}
    <textarea value={value || ''} onChange={event => onChange(event.target.value)} className={`mt-2 min-h-44 ${fieldClass}`} placeholder="Nội dung này được tạo từ JSON và hiển thị nguyên văn phía trên phần làm bài của học sinh." />
  </label>;
}

function AcceptedAnswers({ question, onChange, label = 'Đáp án chính thức (ngăn cách bằng |)' }: { question: ExamQuestion; onChange: (question: ExamQuestion) => void; label?: string }) {
  return <label className="text-xs font-black text-slate-700">{label}<input value={answersText(question)} onChange={event => onChange({ ...question, acceptedAnswers: parseAnswers(event.target.value) })} className={`mt-1 ${fieldClass}`} /></label>;
}

function DisplayNumber({ question, onChange }: { question: ExamQuestion; onChange: (question: ExamQuestion) => void }) {
  return <label className="text-xs font-black text-slate-700">Số in trên đề<input type="number" min={1} value={question.displayNumber || question.number} onChange={event => onChange({ ...question, displayNumber: Math.max(1, Number(event.target.value) || 1) })} className={`mt-1 ${fieldClass}`} /></label>;
}

function ChoiceRows({ unit, showPrompt, onChange }: { unit: ExamPartContent; showPrompt: boolean; onChange: (unit: ExamPartContent) => void }) {
  const update = (index: number, question: ExamQuestion) => onChange({ ...unit, questions: unit.questions.map((item, itemIndex) => itemIndex === index ? question : item) });
  return <div className="space-y-3" data-ket-choice-rows>
    {unit.questions.map((question, index) => <article key={question.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`grid gap-3 ${showPrompt ? 'md:grid-cols-[120px_minmax(0,1fr)]' : 'md:grid-cols-[120px_minmax(0,1fr)]'}`}>
        <DisplayNumber question={question} onChange={next => update(index, next)} />
        <label className="text-xs font-black text-slate-700">{showPrompt ? 'Nội dung câu hỏi' : 'Nhãn quản trị (không hiện cho học sinh)'}<input value={question.prompt} onChange={event => update(index, { ...question, prompt: event.target.value })} className={`mt-1 ${fieldClass}`} /></label>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">{question.options.slice(0, 3).map((option, optionIndex) => <label key={option.id} className={`rounded-xl border p-3 ${question.correctOptionIds.includes(option.id) ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
        <span className="flex items-center gap-2 text-xs font-black text-slate-800"><input type="radio" name={`ket-rw-${question.id}`} checked={question.correctOptionIds.includes(option.id)} onChange={() => update(index, { ...question, correctOptionIds: [option.id] })} />{String.fromCharCode(65 + optionIndex)}</span>
        <input value={option.text} onChange={event => update(index, { ...question, options: question.options.map(item => item.id === option.id ? { ...item, text: event.target.value } : item) })} className={`mt-2 ${fieldClass}`} />
      </label>)}</div>
    </article>)}
  </div>;
}

function ChoicePart({ token, part, assets, onAssets, onChange, showPrompt = false, showExample = true, withImage = true }: Props & { showPrompt?: boolean; showExample?: boolean; withImage?: boolean }) {
  return <div className="space-y-4">
    <CountControls count={part.questions.length} onAdd={() => onChange({ ...part, questions: [...part.questions, choiceQuestion(part)] })} onRemove={() => onChange({ ...part, questions: part.questions.slice(0, -1) })} />
    {withImage && <ImagePicker label="Ảnh đề hiển thị phía trên cho học sinh" value={part.imageAssetId} assets={assets} token={token} onAssets={onAssets} onChange={asset => onChange({ ...part, imageAssetId: asset?.id, imageUrl: asset?.url })} />}
    {showExample && <ExampleEditor examples={part.examples || []} onChange={examples => onChange({ ...part, examples })} />}
    <ChoiceRows unit={part} showPrompt={showPrompt} onChange={onChange} />
  </div>;
}

function LetterPart({ token, part, assets, onAssets, onChange }: Props) {
  const setQuestions = (questions: ExamQuestion[]) => onChange({ ...part, questions, readingScenes: part.readingScenes?.map(scene => ({ ...scene, questionIds: questions.map(question => question.id) })) });
  return <div className="space-y-4">
    <CountControls count={part.questions.length} onAdd={() => setQuestions([...part.questions, shortQuestion(part, { prompt: `Row ${part.questions.length + 1}` })])} onRemove={() => setQuestions(part.questions.slice(0, -1))} />
    <ImagePicker label="Ảnh thứ nhất · trang câu hỏi/lựa chọn A-H" value={part.imageAssetId} assets={assets} token={token} onAssets={onAssets} onChange={asset => onChange({ ...part, imageAssetId: asset?.id, imageUrl: asset?.url })} />
    <FlyerPart3Editor token={token} part={part} assets={assets} onAssets={onAssets} onChange={onChange} />
  </div>;
}

function CompoundPart({ token, part, assets, onAssets, onChange }: Props) {
  const units = examPartUnits(part);
  const first = units[0];
  const second = units[1];
  const commit = (unit: ExamPartContent) => onChange(replaceExamPartUnit(part, unit));
  if (!first || !second) return <p className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-black text-amber-950">Part 3 phải có đúng hai nhóm 3A và 3B. Hãy nhập lại JSON Part 3 hoặc tạo bộ đề mới theo cấu trúc KET 9 Part.</p>;
  const addFirst = () => commit({ ...first, questions: [...first.questions, choiceQuestion(part)] });
  const addSecond = () => {
    const question = shortQuestion(part, { prompt: `Row ${second.questions.length + 1}` });
    const questions = [...second.questions, question];
    commit({ ...second, questions, readingScenes: second.readingScenes?.map(scene => ({ ...scene, questionIds: questions.map(item => item.id) })) });
  };
  return <div className="space-y-5" data-ket-part-three-blocks>
    <section className="space-y-4 rounded-3xl border border-blue-200 bg-blue-50/40 p-4">
      <div><p className="text-xs font-black uppercase tracking-wide text-blue-700">Part 3A</p><h4 className="text-lg font-black text-slate-950">Ảnh và các hàng A/B/C</h4></div>
      <CountControls count={first.questions.length} onAdd={addFirst} onRemove={() => commit({ ...first, questions: first.questions.slice(0, -1) })} label="câu nhóm 3A" />
      <ImagePicker label="Ảnh đề nhóm 3A" value={first.imageAssetId} assets={assets} token={token} onAssets={onAssets} onChange={asset => commit({ ...first, imageAssetId: asset?.id, imageUrl: asset?.url })} />
      <ChoiceRows unit={first} showPrompt onChange={commit} />
    </section>
    <section className="space-y-4 rounded-3xl border border-violet-200 bg-violet-50/40 p-4">
      <div><p className="text-xs font-black uppercase tracking-wide text-violet-700">Part 3B</p><h4 className="text-lg font-black text-slate-950">Hai ảnh và cột nhập chữ A-H</h4></div>
      <CountControls count={second.questions.length} onAdd={addSecond} onRemove={() => commit({ ...second, questions: second.questions.slice(0, -1), readingScenes: second.readingScenes?.map(scene => ({ ...scene, questionIds: second.questions.slice(0, -1).map(question => question.id) })) })} label="câu nhóm 3B" />
      <ImagePicker label="Ảnh thứ nhất nhóm 3B" value={second.imageAssetId} assets={assets} token={token} onAssets={onAssets} onChange={asset => commit({ ...second, imageAssetId: asset?.id, imageUrl: asset?.url })} />
      <FlyerPart3Editor token={token} part={second} assets={assets} onAssets={onAssets} onChange={commit} />
    </section>
  </div>;
}

function SpellingPart({ part, onChange }: Props) {
  const update = (index: number, question: ExamQuestion) => onChange({ ...part, questions: part.questions.map((item, itemIndex) => itemIndex === index ? question : item) });
  return <div className="space-y-4">
    <CountControls count={part.questions.length} onAdd={() => onChange({ ...part, questions: [...part.questions, shortQuestion(part, { answerPrefix: 'a', answerLength: 2 })] })} onRemove={() => onChange({ ...part, questions: part.questions.slice(0, -1) })} />
    <PassageEditor value={part.passage} onChange={passage => onChange({ ...part, passage })} label="Nội dung hướng dẫn và example dạng chữ hiển thị phía trên" />
    <div className="space-y-3">{part.questions.map((question, index) => <article key={question.id} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[110px_minmax(220px,1fr)_110px_130px_minmax(220px,1fr)]">
      <DisplayNumber question={question} onChange={next => update(index, next)} />
      <label className="text-xs font-black text-slate-700">Mô tả từ cần điền<input value={question.prompt} onChange={event => update(index, { ...question, prompt: event.target.value })} className={`mt-1 ${fieldClass}`} /></label>
      <label className="text-xs font-black text-slate-700">Chữ đầu<input maxLength={1} value={question.answerPrefix || ''} onChange={event => update(index, { ...question, answerPrefix: event.target.value.replace(/[^A-Za-z]/g, '').slice(0, 1) })} className={`mt-1 text-center ${fieldClass}`} /></label>
      <label className="text-xs font-black text-slate-700">Tổng số ký tự<input type="number" min={2} max={40} value={question.answerLength || 2} onChange={event => update(index, { ...question, answerLength: Math.max(2, Math.min(40, Number(event.target.value) || 2)) })} className={`mt-1 ${fieldClass}`} /></label>
      <AcceptedAnswers question={question} label="Phần đáp án học sinh phải nhập, không gồm chữ đầu (ngăn cách bằng |)" onChange={next => update(index, next)} />
      <p className="md:col-span-5 text-xs font-bold text-indigo-700">Học sinh sẽ thấy chữ “{question.answerPrefix || '…'}” và {Math.max(1, (question.answerLength || 2) - 1)} ô còn lại.</p>
    </article>)}</div>
  </div>;
}

function NumberedGapsPart({ part, onChange }: Props) {
  const update = (index: number, question: ExamQuestion) => onChange({ ...part, questions: part.questions.map((item, itemIndex) => itemIndex === index ? question : item) });
  return <div className="space-y-4">
    <CountControls count={part.questions.length} onAdd={() => onChange({ ...part, questions: [...part.questions, shortQuestion(part, { prompt: '' })] })} onRemove={() => onChange({ ...part, questions: part.questions.slice(0, -1) })} />
    <PassageEditor value={part.passage} onChange={passage => onChange({ ...part, passage })} label="Nội dung bài đọc, hướng dẫn và example dạng chữ hiển thị phía trên" />
    <div className="grid gap-3 md:grid-cols-2">{part.questions.map((question, index) => <article key={question.id} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-[120px_minmax(0,1fr)]">
      <DisplayNumber question={question} onChange={next => update(index, next)} />
      <AcceptedAnswers question={question} onChange={next => update(index, { ...next, prompt: '', maxWords: 1 })} />
    </article>)}</div>
    <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-700">Phần nội dung phía trên đã chứa toàn bộ câu đề; bên dưới chỉ hiển thị số và ô đáp án, chia thành hai cột.</p>
  </div>;
}

function FormPart({ part, onChange }: Props) {
  const update = (index: number, question: ExamQuestion) => onChange({ ...part, questions: part.questions.map((item, itemIndex) => itemIndex === index ? question : item) });
  return <div className="space-y-4">
    <CountControls count={part.questions.length} onAdd={() => onChange({ ...part, questions: [...part.questions, shortQuestion(part, { prompt: `Field ${part.questions.length + 1}`, maxWords: 5 })] })} onRemove={() => onChange({ ...part, questions: part.questions.slice(0, -1) })} label="hàng biểu mẫu" />
    <PassageEditor value={part.passage} onChange={passage => onChange({ ...part, passage })} label="Nội dung hướng dẫn và example dạng chữ hiển thị phía trên" />
    <div className="space-y-3">{part.questions.map((question, index) => <article key={question.id} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-[110px_minmax(180px,1fr)_180px_minmax(220px,1fr)]">
      <DisplayNumber question={question} onChange={next => update(index, next)} />
      <label className="text-xs font-black text-slate-700">Nhãn hàng<input value={question.prompt} onChange={event => update(index, { ...question, prompt: event.target.value })} className={`mt-1 ${fieldClass}`} /></label>
      <label className="text-xs font-black text-slate-700">Ký tự có sẵn ở đầu ô (không bắt buộc)<input value={question.answerPrefix || ''} onChange={event => update(index, { ...question, answerPrefix: event.target.value.slice(0, 20), answerSuffix: undefined })} className={`mt-1 ${fieldClass}`} /></label>
      <AcceptedAnswers question={question} onChange={next => update(index, next)} />
    </article>)}</div>
  </div>;
}

interface WritingProviderStatus { id: string; label: string; enabled: boolean }

function WritingPart({ part, onChange, providers }: Props & { providers: WritingProviderStatus[] }) {
  const question = part.questions[0];
  if (!question) return null;
  const update = (patch: Partial<ExamQuestion>) => onChange({ ...part, questions: [{ ...question, ...patch, type: 'long-writing', points: 10, options: [], correctOptionIds: [], acceptedAnswers: [] }] });
  const config = question.writingGrading || { enabled: true, providerId: 'stali:gpt-5.6-sol', taskContext: question.context || question.prompt, gradingInstructions: 'Chấm điểm nguyên từ 0 đến 10. Kiểm tra mức độ hoàn thành yêu cầu, số câu, ngữ pháp và từ vựng; chỉ ra lỗi cụ thể và trả về nhận xét ngắn gọn, đầy đủ trong khoảng 4–5 câu.', scoreScale: 10 as const };
  const selectedProvider = providers.find(provider => provider.id === config.providerId);
  const gradingPrompt = `Dựa vào nội dung sau:\n${config.taskContext}\n\nChấm điểm cho bài văn sau:\n{{STUDENT_ESSAY}}\n\nTheo tiêu chí:\n${config.gradingInstructions}\n\nGiới hạn: ${question.minWords || 1}–${question.maxWords || 50} từ. Điểm nguyên 0–10.`;
  return <div className="space-y-4" data-ket-writing-authoring>
    <PassageEditor value={part.passage} onChange={passage => onChange({ ...part, passage, questions: [{ ...question, context: passage, writingGrading: { ...config, taskContext: passage } }] })} label="Nội dung câu hỏi và gợi ý dạng chữ hiển thị phía trên" />
    <section className="rounded-2xl border border-violet-200 bg-violet-50 p-4"><p className="text-sm font-black text-violet-950">Part 9 · một bài viết · hệ số 10</p><p className="mt-1 text-xs font-semibold text-violet-800">Điểm chỉ nhận số nguyên 0–10 và được cộng vào tổng như 10 câu khách quan. Nếu AI lỗi, bài giữ trạng thái chờ để giáo viên chấm tay.</p></section>
    <div className="grid gap-4 md:grid-cols-2">
      <label className="text-xs font-black text-slate-700">Yêu cầu hiển thị phía trên trang viết<textarea value={question.prompt} onChange={event => update({ prompt: event.target.value })} className={`mt-1 min-h-28 ${fieldClass}`} /></label>
      <label className="text-xs font-black text-slate-700">Nội dung đề / ngữ cảnh chấm<textarea value={config.taskContext} onChange={event => update({ context: event.target.value, writingGrading: { ...config, taskContext: event.target.value } })} className={`mt-1 min-h-28 ${fieldClass}`} /></label>
      <label className="text-xs font-black text-slate-700">Số từ tối thiểu<input type="number" min={1} max={1000} value={question.minWords || 1} onChange={event => { const minWords = Math.max(1, Math.min(1000, Number(event.target.value) || 1)); update({ minWords, maxWords: Math.max(minWords, question.maxWords || minWords) }); }} className={`mt-1 ${fieldClass}`} /></label>
      <label className="text-xs font-black text-slate-700">Số từ tối đa<input type="number" min={question.minWords || 1} max={2000} value={question.maxWords || 50} onChange={event => update({ maxWords: Math.max(question.minWords || 1, Math.min(2000, Number(event.target.value) || 50)) })} className={`mt-1 ${fieldClass}`} /></label>
      <label className="text-xs font-black text-slate-700">Mô hình chấm<select value={config.providerId} onChange={event => update({ writingGrading: { ...config, providerId: event.target.value } })} className={`mt-1 ${fieldClass}`}>{providers.length ? providers.map(provider => <option key={provider.id} value={provider.id} disabled={!provider.enabled}>{provider.label}{provider.enabled ? ' · đã cấu hình' : ' · chưa cấu hình'}</option>) : <><option value="stali:gpt-5.6-sol">Stali · ChatGPT 5.6 Sol</option><option value="devquota:gpt-5.6-sol">DevQuota · ChatGPT 5.6 Sol</option></>}</select></label>
      <label className="text-xs font-black text-slate-700">Rubric lưu cùng phiên bản đề<input value={question.rubric || ''} onChange={event => update({ rubric: event.target.value })} className={`mt-1 ${fieldClass}`} /></label>
      <label className="text-xs font-black text-slate-700 md:col-span-2">Hướng dẫn chấm cho mô hình<textarea value={config.gradingInstructions} onChange={event => update({ writingGrading: { ...config, gradingInstructions: event.target.value } })} className={`mt-1 min-h-28 ${fieldClass}`} /></label>
    </div>
    {selectedProvider && !selectedProvider.enabled && <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-black text-amber-950">{selectedProvider.label} chưa có khóa API trên máy chủ. Bài học vẫn có thể xuất bản, nhưng Part 9 sẽ chuyển sang trạng thái chờ để giáo viên thử lại hoặc chấm tay nếu mô hình chưa được cấu hình khi học sinh nộp.</p>}
    <section className="rounded-2xl border border-slate-300 bg-slate-950 p-4 text-slate-100"><p className="text-xs font-black uppercase tracking-wide text-sky-300">Prompt chấm xem trước · bài học sinh được ghép ở backend sau khi nộp</p><pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap text-xs leading-6">{gradingPrompt}</pre></section>
  </div>;
}

export default function KetReadingWritingAuthoring(props: Props) {
  const { part } = props;
  const [providers, setProviders] = useState<WritingProviderStatus[]>([]);
  useEffect(() => {
    if (part.part !== 9) return;
    let active = true;
    void examPlatformApi.writingGradingProviders(props.token)
      .then(result => { if (active) setProviders(result.providers || []); })
      .catch(() => { if (active) setProviders([]); });
    return () => { active = false; };
  }, [part.part, props.token]);
  return <section id="ket-reading-writing-authoring" className="space-y-4" data-ket-reading-writing-part={part.part}>
    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4"><p className="text-xs font-black uppercase tracking-wide text-blue-800">KET Reading & Writing · Part {part.part}/9</p><p className="mt-1 text-sm font-semibold text-blue-950">Part 2 và Part 6–9 dùng nội dung chữ được nhận diện từ JSON; Part 3A/3B, 4 và 5 giữ ảnh đề. Part 1–8 linh hoạt số câu, Part 9 cố định một bài viết 10 điểm.</p></div>
    {part.part === 1 ? <LetterPart {...props} />
      : part.part === 2 ? <ChoicePart {...props} showPrompt withImage={false} />
        : part.part === 3 ? <CompoundPart {...props} />
          : part.part === 4 ? <ChoicePart {...props} showPrompt showExample={false} />
            : part.part === 5 ? <ChoicePart {...props} showExample={false} />
              : part.part === 6 ? <SpellingPart {...props} />
                : part.part === 7 ? <NumberedGapsPart {...props} />
                  : part.part === 8 ? <FormPart {...props} />
                    : <WritingPart {...props} providers={providers} />}
  </section>;
}
