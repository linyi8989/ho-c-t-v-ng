import { AlertTriangle, CheckCircle2, Eye, FileClock, LoaderCircle, RotateCcw, Sparkles } from 'lucide-react';
import { useEffect, useState, type ClipboardEvent, type DragEvent, type FormEvent } from 'react';
import type {
  ExamAnswers,
  ExamAttemptReview,
  ExamCompletedAttempt,
  ExamPartContent,
  ExamPlayableSet,
} from '../../exam-platform/types';
import { countWritingWords, getFlexibleWritingWordPolicy } from '../writingWordPolicy';

const BLOCKED_EXTERNAL_INSERT_TYPES = new Set([
  'insertFromPaste',
  'insertFromPasteAsQuotation',
  'insertFromDrop',
  'insertFromYank',
]);

interface PartProps {
  part: ExamPartContent;
  answers: ExamAnswers;
  onAnswer: (questionId: string, value: string) => void;
}

export function StandaloneWritingPartView({ part, answers, onAnswer }: PartProps) {
  const question = part.questions[0];
  const [externalInsertBlocked, setExternalInsertBlocked] = useState(false);
  if (!question) return null;
  const answer = typeof answers[question.id] === 'string' ? String(answers[question.id]) : '';
  const wordCount = countWritingWords(answer);
  const policy = getFlexibleWritingWordPolicy(question.minWords, question.maxWords);
  const belowFlexibleRange = wordCount > 0 && wordCount < policy.flexibleMin;
  const aboveFlexibleRange = wordCount > policy.flexibleMax;
  const blockExternalInsertion = (event: ClipboardEvent<HTMLTextAreaElement> | DragEvent<HTMLTextAreaElement>) => {
    event.preventDefault();
    setExternalInsertBlocked(true);
    event.currentTarget.focus();
  };
  const guardBeforeInput = (event: FormEvent<HTMLTextAreaElement>) => {
    const inputType = (event.nativeEvent as InputEvent).inputType;
    if (!BLOCKED_EXTERNAL_INSERT_TYPES.has(inputType)) return;
    event.preventDefault();
    setExternalInsertBlocked(true);
  };
  const updateTypedAnswer = (value: string) => {
    setExternalInsertBlocked(false);
    onAnswer(question.id, value);
  };

  return (
    <section id="standalone-writing-player" data-standalone-writing-player className="space-y-5">
      {part.passage && <article className="writing-task-card rounded-3xl border border-indigo-200 bg-indigo-50 p-5 sm:p-7">
        <p className="text-xs font-black uppercase tracking-[.16em] text-indigo-700">Đề bài</p>
        <div className="mt-3 whitespace-pre-wrap text-base font-bold leading-7 text-slate-900">{part.passage}</div>
      </article>}
      <article className="writing-answer-card rounded-3xl border border-slate-200 bg-white p-4 sm:p-6">
        <label htmlFor={`writing-answer-${question.id}`} className="block text-base font-black leading-7 text-slate-950">{question.prompt}</label>
        <p className="mt-2 text-sm font-semibold text-slate-600">
          Mục tiêu {policy.recommendedMin}–{policy.recommendedMax} từ. Bạn có thể viết ngắn hoặc dài hơn theo khả năng; hệ thống không khóa số từ.
        </p>
        <textarea
          id={`writing-answer-${question.id}`}
          value={answer}
          onChange={event => updateTypedAnswer(event.target.value)}
          onPaste={blockExternalInsertion}
          onDrop={blockExternalInsertion}
          onBeforeInput={guardBeforeInput}
          className="writing-lined-textarea mt-4 min-h-80 w-full resize-y rounded-2xl border border-slate-300 bg-white p-5 text-base font-semibold leading-8 text-slate-900 outline-none focus:border-indigo-600 focus:ring-4 focus:ring-indigo-100"
          placeholder="Viết bài của bạn tại đây…"
          spellCheck
          autoCapitalize="sentences"
          aria-describedby={externalInsertBlocked ? `writing-input-warning-${question.id}` : undefined}
          data-no-hard-word-limit="true"
          data-typed-only-answer="true"
        />
        {externalInsertBlocked && <p id={`writing-input-warning-${question.id}`} role="alert" className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-900"><AlertTriangle size={16} className="mt-0.5 shrink-0" />Không thể dán hoặc kéo thả nội dung. Em hãy tự gõ bài viết bằng bàn phím.</p>}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-bold text-slate-500">Vùng linh hoạt tham khảo: {policy.flexibleMin}–{policy.flexibleMax} từ</p>
          <p className={`rounded-full px-3 py-1.5 text-sm font-black ${belowFlexibleRange ? 'bg-amber-100 text-amber-900' : aboveFlexibleRange ? 'bg-sky-100 text-sky-900' : 'bg-emerald-100 text-emerald-800'}`}>{wordCount} từ</p>
        </div>
        {belowFlexibleRange && <p className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-900"><AlertTriangle size={16} className="mt-0.5 shrink-0" />Bài còn rất ngắn. Hãy thêm ý nếu bạn có thể; bạn vẫn được phép nộp bài.</p>}
        {aboveFlexibleRange && <p className="mt-3 flex items-start gap-2 rounded-xl bg-sky-50 p-3 text-xs font-bold leading-5 text-sky-900"><Sparkles size={16} className="mt-0.5 shrink-0" />Bài dài hơn vùng tham khảo. Nếu nội dung rõ ràng, đúng đề và mạch lạc, AI sẽ ghi nhận tích cực; bài vẫn được phép nộp.</p>}
      </article>
    </section>
  );
}

interface ResultProps {
  result: ExamCompletedAttempt;
  review: ExamAttemptReview | null;
  playable: ExamPlayableSet;
  answers: ExamAnswers;
  reviewLoading: boolean;
  gradeRetrying: boolean;
  error: string;
  onReview: () => void;
  onRetryGrade: () => void;
  onRetry: () => void;
  onBack: () => void;
}

export function StandaloneWritingResult({ result, review, playable, answers, reviewLoading, gradeRetrying, error, onReview, onRetryGrade, onRetry, onBack }: ResultProps) {
  const question = playable.content.parts[0]?.questions[0];
  const essay = question && typeof answers[question.id] === 'string' ? String(answers[question.id]) : '';
  const wordCount = result.writingWordCount ?? countWritingWords(essay);
  const reviewQuestion = review?.questions.find(item => item.questionId === question?.id) || review?.questions[0];
  const writingScore = result.writingScore ?? reviewQuestion?.writingScore ?? Math.round(Number(result.score || 0) / 10);
  const completed = result.status === 'completed';
  const grading = ['queued', 'processing', 'retrying'].includes(String(result.aiGradingStatus || ''));
  const failed = result.aiGradingStatus === 'failed';
  const [clock, setClock] = useState(Date.now());
  const retryAt = new Date(result.aiGradingNextRetryAt || 0).getTime();
  const retrySeconds = Number.isFinite(retryAt) ? Math.max(0, Math.ceil((retryAt - clock) / 1_000)) : 0;
  useEffect(() => {
    if (!failed || !result.aiGradingRetryable || retrySeconds <= 0) return;
    const timer = window.setInterval(() => setClock(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [failed, result.aiGradingRetryable, result.aiGradingNextRetryAt, retrySeconds > 0]);
  const retryCountdown = `${Math.floor(retrySeconds / 60).toString().padStart(2, '0')}:${(retrySeconds % 60).toString().padStart(2, '0')}`;

  return (
    <main id="standalone-writing-result" className="min-h-screen bg-gradient-to-b from-violet-100 via-white to-sky-50 p-4 sm:p-8" data-writing-score-scale="10">
      <div className="mx-auto max-w-4xl space-y-5">
        <section className="rounded-3xl border border-white bg-white p-6 text-center shadow-xl sm:p-8">
          {completed ? <CheckCircle2 className="mx-auto text-emerald-600" size={56} /> : grading ? <LoaderCircle className="mx-auto animate-spin text-violet-600" size={56} /> : <FileClock className="mx-auto text-violet-600" size={56} />}
          <p className="mt-4 text-xs font-black uppercase tracking-[.2em] text-violet-700">{completed ? 'AI đã chấm bài' : failed ? 'Chấm bài chưa thành công' : 'Đã lưu bài · đang chấm'}</p>
          <h1 className="mt-2 text-3xl font-black text-slate-950">{playable.title}</h1>
          {completed ? <p className="mt-5 text-6xl font-black text-violet-800">{writingScore}<span className="text-3xl text-violet-500">/10</span></p> : <p className="mt-5 text-xl font-black text-violet-800">{failed ? 'Bài viết vẫn được lưu an toàn.' : 'Đang gửi bài đến dịch vụ chấm, rất nhanh thôi, em đợi chút nhé!!'}</p>}
          <p className="mt-2 text-sm font-bold text-slate-600">{wordCount} từ · {result.durationSeconds || 0} giây</p>
          {!grading && result.aiGradingMessage && <p className="mx-auto mt-4 max-w-2xl rounded-2xl bg-slate-50 p-3 text-sm font-bold text-slate-700">{result.aiGradingMessage}</p>}
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            {completed && playable.content.showReviewAfterSubmit && !review && <button type="button" disabled={reviewLoading} onClick={onReview} className="writing-result-review inline-flex items-center gap-2 rounded-xl border border-violet-300 bg-violet-50 px-5 py-3 font-black text-violet-800"><Eye size={17} />{reviewLoading ? 'Đang tải…' : 'Xem Nhận Xét'}</button>}
            {failed && result.aiGradingRetryable && <button type="button" disabled={gradeRetrying || retrySeconds > 0} onClick={onRetryGrade} className="writing-grade-retry inline-flex items-center gap-2 rounded-xl border border-amber-400 bg-amber-50 px-5 py-3 font-black text-amber-900 disabled:cursor-not-allowed"><RotateCcw size={17} />{gradeRetrying ? 'Đang gửi…' : retrySeconds > 0 ? `Chấm lại sau ${retryCountdown}` : 'Chấm lại'}</button>}
            <button type="button" onClick={onRetry} className="writing-result-retry inline-flex items-center gap-2 rounded-xl bg-violet-700 px-5 py-3 font-black text-white"><RotateCcw size={17} />Viết lại</button>
            <button type="button" onClick={onBack} className="writing-result-home rounded-xl border border-slate-300 bg-white px-5 py-3 font-black text-slate-800">Quay lại</button>
          </div>
          {error && <p className="mt-4 font-bold text-rose-700">{error}</p>}
        </section>

        {reviewQuestion && <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7" aria-label="Nhận xét bài Writing">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-violet-50 p-4"><p className="text-xs font-black uppercase text-violet-700">Điểm</p><p className="mt-1 text-3xl font-black text-violet-950">{reviewQuestion.writingScore ?? writingScore}/10</p></div>
            <div className="rounded-2xl bg-sky-50 p-4"><p className="text-xs font-black uppercase text-sky-700">Số câu</p><p className="mt-1 text-3xl font-black text-sky-950">{reviewQuestion.sentenceCount ?? 0}</p></div>
            <div className="rounded-2xl bg-emerald-50 p-4"><p className="text-xs font-black uppercase text-emerald-700">Số từ</p><p className="mt-1 text-3xl font-black text-emerald-950">{wordCount}</p></div>
          </div>
          <div className="mt-5 rounded-2xl border border-violet-200 bg-violet-50 p-5"><h2 className="font-black text-violet-950">Nhận Xét Chung</h2><p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-800">{reviewQuestion.aiFeedback || 'Chưa có nhận xét chi tiết.'}</p></div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-rose-200 p-4"><h3 className="font-black text-rose-800">Ngữ pháp cần lưu ý</h3>{reviewQuestion.grammarErrors?.length ? <ul className="mt-2 list-disc space-y-1 pl-5 text-sm font-semibold text-slate-700">{reviewQuestion.grammarErrors.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul> : <p className="mt-2 text-sm font-semibold text-slate-600">Không phát hiện lỗi nổi bật.</p>}</div>
            <div className="rounded-2xl border border-amber-200 p-4"><h3 className="font-black text-amber-800">Từ vựng cần lưu ý</h3>{reviewQuestion.vocabularyErrors?.length ? <ul className="mt-2 list-disc space-y-1 pl-5 text-sm font-semibold text-slate-700">{reviewQuestion.vocabularyErrors.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul> : <p className="mt-2 text-sm font-semibold text-slate-600">Không phát hiện lỗi nổi bật.</p>}</div>
          </div>
          <details className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4" open><summary className="cursor-pointer font-black text-slate-900">Bài học sinh đã viết</summary><p className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-7 text-slate-800">{Array.isArray(reviewQuestion.userAnswer) ? reviewQuestion.userAnswer.join(' ') : reviewQuestion.userAnswer || essay || 'Bỏ trống'}</p></details>
        </section>}
      </div>
    </main>
  );
}
