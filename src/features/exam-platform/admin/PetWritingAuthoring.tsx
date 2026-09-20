import { useEffect, useState } from 'react';
import type { ExamPartContent, ExamQuestion, ExamWritingGradingConfig } from '../types';
import { examPlatformApi } from '../api';
import {
  PET_FREE_WRITING_GRADING_INSTRUCTIONS,
  PET_GUIDED_EMAIL_GRADING_INSTRUCTIONS,
} from '../petWritingMigration';
import { DEFAULT_WRITING_RUBRIC, getFlexibleWritingWordPolicy } from '../../writing-library/writingWordPolicy';

interface Props {
  token: string;
  part: ExamPartContent;
  onChange: (part: ExamPartContent) => void;
}

interface WritingProviderStatus { id: string; label: string; enabled: boolean }

const fieldClass = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100';
const splitAnswers = (value: string) => value.split('|').map(answer => answer.trim()).filter(Boolean);

function EditableNumberField({ value, min, max, onCommit }: { value: number; min: number; max: number; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const parsed = Number(draft);
    if (!Number.isFinite(parsed)) return setDraft(String(value));
    const next = Math.max(min, Math.min(max, Math.round(parsed)));
    setDraft(String(next));
    onCommit(next);
  };
  return <input type="number" inputMode="numeric" min={min} max={max} value={draft} onChange={event => setDraft(event.target.value)} onBlur={commit} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} className={fieldClass} />;
}

function SentenceTransformationEditor({ part, onChange }: Omit<Props, 'token'>) {
  const example = part.examples?.[0] || { prompt: '', answer: '' };
  const update = (index: number, patch: Partial<ExamQuestion>) => onChange({
    ...part,
    questions: part.questions.map((question, questionIndex) => questionIndex === index ? { ...question, ...patch } : question),
  });
  return <section id="pet-writing-part-1-authoring" className="space-y-4" data-pet-writing-authoring="part-1">
    <div className="rounded-2xl border border-sky-300 bg-sky-50 p-4 text-sm font-semibold leading-6 text-sky-950">
      Nhập câu gốc ở trên, câu viết lại có chỗ trống ở dưới. Nhiều đáp án đúng được ngăn cách bằng <b>|</b>. Dấu nháy thẳng và dấu nháy thông minh trên điện thoại được chấm như nhau.
    </div>
    <article className="rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-sm" data-pet-writing-example-authoring>
      <p className="text-xs font-black uppercase tracking-wide text-amber-900">Example · không chấm điểm</p>
      <label className="mt-3 block text-xs font-black text-slate-700">Câu gốc và câu viết lại của example (đặt ____ tại vị trí đáp án)
        <textarea value={example.prompt} onChange={event => onChange({ ...part, examples: [{ ...example, prompt: event.target.value }] })} className={`${fieldClass} min-h-24`} placeholder={'The game is called Jotto.\nThe name ____ is Jotto.'} />
      </label>
      <label className="mt-3 block text-xs font-black text-slate-700">Đáp án example
        <input value={example.answer} onChange={event => onChange({ ...part, examples: [{ ...example, answer: event.target.value }] })} className={fieldClass} placeholder="of the game" />
      </label>
    </article>
    {part.questions.map((question, index) => <article key={question.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-black uppercase tracking-wide text-indigo-700">Câu {question.displayNumber || index + 1}</p>
      <label className="mt-3 block text-xs font-black text-slate-700">Câu hỏi / câu gốc
        <textarea value={question.context || ''} onChange={event => update(index, { context: event.target.value })} className={`${fieldClass} min-h-20`} />
      </label>
      <label className="mt-3 block text-xs font-black text-slate-700">Câu được viết lại (đặt ____ tại vị trí học sinh điền)
        <textarea value={question.prompt} onChange={event => update(index, { prompt: event.target.value })} className={`${fieldClass} min-h-20`} />
      </label>
      <label className="mt-3 block text-xs font-black text-slate-700">Đáp án được chấp nhận, ngăn cách bằng |
        <input value={question.acceptedAnswers.join(' | ')} onChange={event => update(index, { acceptedAnswers: splitAnswers(event.target.value) })} className={fieldClass} placeholder="have | 've" />
      </label>
    </article>)}
  </section>;
}

function WritingTaskEditor({ token, part, onChange }: Props) {
  const question = part.questions[0];
  const [providers, setProviders] = useState<WritingProviderStatus[]>([]);
  useEffect(() => {
    let active = true;
    void examPlatformApi.writingGradingProviders(token).then(result => { if (active) setProviders(result.providers || []); }).catch(() => { if (active) setProviders([]); });
    return () => { active = false; };
  }, [token]);
  if (!question) return null;
  const isChoice = part.part === 3;
  const defaultInstructions = isChoice ? PET_FREE_WRITING_GRADING_INSTRUCTIONS : PET_GUIDED_EMAIL_GRADING_INSTRUCTIONS;
  const config: ExamWritingGradingConfig = question.writingGrading || {
    enabled: true,
    providerId: 'stali:gpt-5.6-sol',
    taskContext: question.context || question.prompt,
    gradingInstructions: defaultInstructions,
    scoreScale: 10,
  };
  const policy = getFlexibleWritingWordPolicy(question.minWords, question.maxWords);
  const updateQuestion = (patch: Partial<ExamQuestion>) => onChange({ ...part, questions: [{ ...question, ...patch }] });
  const updateConfig = (patch: Partial<ExamWritingGradingConfig>) => updateQuestion({ writingGrading: { ...config, ...patch, enabled: true, scoreScale: 10 } });
  const updateOption = (index: number, text: string) => updateQuestion({ options: question.options.map((option, optionIndex) => optionIndex === index ? { ...option, text } : option) });
  const selectedProvider = providers.find(provider => provider.id === config.providerId);

  return <section id={`pet-writing-part-${part.part}-authoring`} className="space-y-5" data-pet-writing-authoring={`part-${part.part}`}>
    <div className="rounded-2xl border border-violet-300 bg-violet-50 p-4 text-sm font-semibold leading-6 text-violet-950">
      {isChoice
        ? 'Học sinh chọn đúng một trong hai đề rồi viết. AI chỉ nhận đề đã chọn, bài làm và tiêu chí chấm tương ứng.'
        : 'Khung nội dung bên dưới là các ý chính AI phải kiểm tra. Nội dung phụ đúng thể loại email/thư vẫn được ghi nhận; số từ là mục tiêu linh hoạt, không phải giới hạn cứng.'}
    </div>
    <div className="grid gap-4 md:grid-cols-2">
      {!isChoice && <label className="text-xs font-black text-slate-700 md:col-span-2">Đề bài hiển thị cho học sinh
        <textarea value={part.passage || ''} onChange={event => onChange({ ...part, passage: event.target.value })} className={`${fieldClass} min-h-36`} />
      </label>}
      {isChoice && question.options.map((option, index) => <label key={option.id} className="text-xs font-black text-slate-700">Đề lựa chọn {option.label}
        <textarea value={option.text} onChange={event => updateOption(index, event.target.value)} className={`${fieldClass} min-h-40`} />
      </label>)}
      <label className="text-xs font-black text-slate-700">Số từ mục tiêu tối thiểu
        <EditableNumberField value={policy.recommendedMin} min={1} max={1000} onCommit={minWords => updateQuestion({ minWords, maxWords: Math.max(minWords, policy.recommendedMax) })} />
      </label>
      <label className="text-xs font-black text-slate-700">Số từ mục tiêu tối đa
        <EditableNumberField value={policy.recommendedMax} min={policy.recommendedMin} max={2000} onCommit={maxWords => updateQuestion({ maxWords })} />
      </label>
    </div>
    <div className="rounded-2xl border border-sky-300 bg-sky-50 p-4" data-writing-word-policy>
      <p className="text-sm font-black text-sky-950">Mục tiêu {policy.recommendedMin}–{policy.recommendedMax} từ · không khóa độ dài</p>
      <p className="mt-1 text-xs font-semibold leading-5 text-sky-900">Bài dài hơn nhưng đúng trọng tâm và viết tốt vẫn có thể đạt điểm cao.</p>
    </div>
    <div className="grid gap-4 md:grid-cols-2">
      <label className="text-xs font-black text-slate-700">{isChoice ? 'Ngữ cảnh chung để AI chấm' : 'Khung nội dung bắt buộc để AI chấm'}
        <textarea value={config.taskContext} onChange={event => updateQuestion({ context: event.target.value, writingGrading: { ...config, taskContext: event.target.value } })} className={`${fieldClass} min-h-40`} placeholder={isChoice ? 'Chấm đúng đề học sinh đã chọn.' : '1. Cảm ơn Emma về món quà\n2. Nói em định mua CD nào\n3. Giải thích vì sao chọn CD đó'} />
      </label>
      <label className="text-xs font-black text-slate-700">Rubric lưu cùng phiên bản đề
        <textarea value={question.rubric || DEFAULT_WRITING_RUBRIC} onChange={event => updateQuestion({ rubric: event.target.value })} className={`${fieldClass} min-h-40`} />
      </label>
      <label className="text-xs font-black text-slate-700">Mô hình chấm
        <select value={config.providerId} onChange={event => updateConfig({ providerId: event.target.value })} className={fieldClass}>
          {providers.length ? providers.map(provider => <option key={provider.id} value={provider.id} disabled={!provider.enabled}>{provider.label}{provider.enabled ? ' · đã cấu hình' : ' · chưa cấu hình'}</option>) : <><option value="stali:gpt-5.6-sol">Stali · ChatGPT 5.6 Sol</option><option value="devquota:gpt-5.6-sol">DevQuota · ChatGPT 5.6 Sol</option></>}
        </select>
      </label>
      <label className="text-xs font-black text-slate-700 md:col-span-2">Quy tắc chấm cho AI
        <textarea value={config.gradingInstructions} onChange={event => updateConfig({ gradingInstructions: event.target.value })} className={`${fieldClass} min-h-48`} />
      </label>
    </div>
    {selectedProvider && !selectedProvider.enabled && <p className="rounded-xl border border-amber-400 bg-amber-50 p-3 text-xs font-black text-amber-950">{selectedProvider.label} chưa có khóa API trên máy chủ. Bài vẫn được lưu để thử chấm lại hoặc chấm tay.</p>}
  </section>;
}

export default function PetWritingAuthoring(props: Props) {
  return props.part.part === 1 ? <SentenceTransformationEditor part={props.part} onChange={props.onChange} /> : <WritingTaskEditor {...props} />;
}
