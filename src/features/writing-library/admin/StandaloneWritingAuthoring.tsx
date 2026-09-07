import { useEffect, useState } from 'react';
import type { ExamPartContent, ExamQuestion, ExamWritingGradingConfig } from '../../exam-platform/types';
import { examPlatformApi } from '../../exam-platform/api';
import {
  DEFAULT_WRITING_GRADING_INSTRUCTIONS,
  DEFAULT_WRITING_RUBRIC,
  getFlexibleWritingWordPolicy,
} from '../writingWordPolicy';

interface Props {
  token: string;
  part: ExamPartContent;
  onChange: (part: ExamPartContent) => void;
}

interface WritingProviderStatus { id: string; label: string; enabled: boolean }

const fieldClass = 'mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100';

function defaultConfig(question: ExamQuestion): ExamWritingGradingConfig {
  return {
    enabled: true,
    providerId: 'stali:gpt-5.6-sol',
    taskContext: question.context || question.prompt,
    gradingInstructions: DEFAULT_WRITING_GRADING_INSTRUCTIONS,
    scoreScale: 10,
  };
}

export default function StandaloneWritingAuthoring({ token, part, onChange }: Props) {
  const question = part.questions[0];
  const [providers, setProviders] = useState<WritingProviderStatus[]>([]);
  useEffect(() => {
    let active = true;
    void examPlatformApi.writingGradingProviders(token)
      .then(result => { if (active) setProviders(result.providers || []); })
      .catch(() => { if (active) setProviders([]); });
    return () => { active = false; };
  }, [token]);

  if (!question) return null;
  const config = question.writingGrading || defaultConfig(question);
  const wordPolicy = getFlexibleWritingWordPolicy(question.minWords, question.maxWords);
  const selectedProvider = providers.find(provider => provider.id === config.providerId);
  const updateQuestion = (patch: Partial<ExamQuestion>) => onChange({
    ...part,
    questions: [{
      ...question,
      ...patch,
      type: 'long-writing',
      points: 10,
      options: [],
      correctOptionIds: [],
      acceptedAnswers: [],
    }],
  });
  const updateConfig = (patch: Partial<ExamWritingGradingConfig>) => updateQuestion({
    writingGrading: { ...config, ...patch, enabled: true, scoreScale: 10 },
  });

  return (
    <section id="standalone-writing-authoring" className="space-y-5" data-writing-single-task>
      <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
        <p className="text-sm font-black text-violet-950">Một bộ đề = một bài Writing · AI chấm 0–10</p>
        <p className="mt-1 text-xs font-semibold leading-5 text-violet-800">Khoảng từ là mục tiêu học tập. Học sinh được viết linh hoạt; bài dài hay được khuyến khích, bài dài nhưng lan man hoặc nhiều lỗi sẽ được AI góp ý theo chất lượng thực tế.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-xs font-black text-slate-700">Tiêu đề phần viết
          <input value={part.title} onChange={event => onChange({ ...part, title: event.target.value })} className={fieldClass} />
        </label>
        <label className="text-xs font-black text-slate-700">Hướng dẫn ngắn
          <input value={part.instruction} onChange={event => onChange({ ...part, instruction: event.target.value })} className={fieldClass} />
        </label>
        <label className="text-xs font-black text-slate-700 md:col-span-2">Nội dung đề và các gợi ý hiển thị cho học sinh
          <textarea value={part.passage || ''} onChange={event => onChange({ ...part, passage: event.target.value })} className={`${fieldClass} min-h-36`} />
        </label>
        <label className="text-xs font-black text-slate-700 md:col-span-2">Yêu cầu viết
          <textarea value={question.prompt} onChange={event => updateQuestion({ prompt: event.target.value })} className={`${fieldClass} min-h-24`} />
        </label>
        <label className="text-xs font-black text-slate-700">Số từ mục tiêu tối thiểu
          <input type="number" min={1} max={1000} value={wordPolicy.recommendedMin} onChange={event => {
            const minWords = Math.max(1, Math.min(1000, Number(event.target.value) || 1));
            updateQuestion({ minWords, maxWords: Math.max(minWords, wordPolicy.recommendedMax) });
          }} className={fieldClass} />
        </label>
        <label className="text-xs font-black text-slate-700">Số từ mục tiêu tối đa
          <input type="number" min={wordPolicy.recommendedMin} max={2000} value={wordPolicy.recommendedMax} onChange={event => updateQuestion({ maxWords: Math.max(wordPolicy.recommendedMin, Math.min(2000, Number(event.target.value) || wordPolicy.recommendedMin)) })} className={fieldClass} />
        </label>
      </div>

      <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4" data-writing-word-policy>
        <p className="text-sm font-black text-sky-950">Mục tiêu {wordPolicy.recommendedMin}–{wordPolicy.recommendedMax} từ · vùng linh hoạt tham khảo {wordPolicy.flexibleMin}–{wordPolicy.flexibleMax} từ</p>
        <p className="mt-1 text-xs font-semibold leading-5 text-sky-800">Hệ thống không khóa bài ở {wordPolicy.recommendedMax} từ và không tự trừ điểm vì vượt mục tiêu. AI được phép nới theo chất lượng bài viết.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-xs font-black text-slate-700">Ngữ cảnh riêng để AI hiểu đề
          <textarea value={config.taskContext} onChange={event => { updateQuestion({ context: event.target.value, writingGrading: { ...config, taskContext: event.target.value } }); }} className={`${fieldClass} min-h-28`} />
        </label>
        <label className="text-xs font-black text-slate-700">Rubric lưu cùng phiên bản đề
          <textarea value={question.rubric || DEFAULT_WRITING_RUBRIC} onChange={event => updateQuestion({ rubric: event.target.value })} className={`${fieldClass} min-h-28`} />
        </label>
        <label className="text-xs font-black text-slate-700">Mô hình chấm
          <select value={config.providerId} onChange={event => updateConfig({ providerId: event.target.value })} className={fieldClass}>
            {providers.length ? providers.map(provider => <option key={provider.id} value={provider.id} disabled={!provider.enabled}>{provider.label}{provider.enabled ? ' · đã cấu hình' : ' · chưa cấu hình'}</option>) : <><option value="stali:gpt-5.6-sol">Stali · ChatGPT 5.6 Sol</option><option value="devquota:gpt-5.6-sol">DevQuota · ChatGPT 5.6 Sol</option></>}
          </select>
        </label>
        <label className="text-xs font-black text-slate-700 md:col-span-2">Quy tắc chấm cho AI
          <textarea value={config.gradingInstructions} onChange={event => updateConfig({ gradingInstructions: event.target.value })} className={`${fieldClass} min-h-40`} />
        </label>
      </div>
      {selectedProvider && !selectedProvider.enabled && <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-black text-amber-950">{selectedProvider.label} chưa có khóa API trên máy chủ. Nếu AI chưa chấm được, bài vẫn được giữ ở trạng thái chờ để giáo viên thử lại hoặc chấm tay.</p>}
    </section>
  );
}
