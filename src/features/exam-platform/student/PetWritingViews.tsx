import { AlertTriangle, CheckCircle2, Eye, FileClock, LoaderCircle, RotateCcw } from 'lucide-react';
import { useEffect, useState, type ClipboardEvent, type DragEvent, type FormEvent } from 'react';
import type {
  ExamAnswers,
  ExamAnswerValue,
  ExamAttemptReview,
  ExamCompletedAttempt,
  ExamPartContent,
  ExamPlayableSet,
  ExamQuestion,
  ExamWritingAnswer,
} from '../types';
import { countWritingWords } from '../../writing-library/writingWordPolicy';
import StudentUnderlineInput from './StudentUnderlineInput';

interface PartProps {
  part: ExamPartContent;
  answers: ExamAnswers;
  onAnswer: (questionId: string, value: ExamAnswerValue) => void;
}

const BLOCKED_EXTERNAL_INSERT_TYPES = new Set(['insertFromPaste', 'insertFromPasteAsQuotation', 'insertFromDrop', 'insertFromYank']);
const isWritingAnswer = (value: ExamAnswerValue | undefined): value is ExamWritingAnswer => Boolean(value && typeof value === 'object' && !Array.isArray(value) && 'optionId' in value && 'text' in value);

function TypedWritingArea({ question, value, onChange }: { question: ExamQuestion; value: string; onChange: (value: string) => void }) {
  const [externalInsertBlocked, setExternalInsertBlocked] = useState(false);
  const words = countWritingWords(value);
  const blockExternalInsertion = (event: ClipboardEvent<HTMLTextAreaElement> | DragEvent<HTMLTextAreaElement>) => {
    event.preventDefault(); setExternalInsertBlocked(true); event.currentTarget.focus();
  };
  const blockClipboardTransfer = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    event.preventDefault(); setExternalInsertBlocked(true); event.currentTarget.focus();
  };
  const guardBeforeInput = (event: FormEvent<HTMLTextAreaElement>) => {
    if (!BLOCKED_EXTERNAL_INSERT_TYPES.has((event.nativeEvent as InputEvent).inputType)) return;
    event.preventDefault(); setExternalInsertBlocked(true);
  };
  return <div className="mt-5">
    <label htmlFor={`pet-writing-${question.id}`} className="sr-only">Bài viết của học sinh</label>
    <textarea id={`pet-writing-${question.id}`} value={value} onChange={event => { setExternalInsertBlocked(false); onChange(event.target.value); }} onCopy={blockClipboardTransfer} onCut={blockClipboardTransfer} onPaste={blockExternalInsertion} onDrop={blockExternalInsertion} onBeforeInput={guardBeforeInput} className="pet-writing-ruled-paper min-h-80 w-full resize-y rounded-2xl border border-orange-200 p-5 text-base font-semibold leading-8 text-slate-950 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100" placeholder="Viết bài của em tại đây…" spellCheck autoCapitalize="sentences" data-no-hard-word-limit="true" data-typed-only-answer="true" />
    {externalInsertBlocked && <p role="alert" className="mt-3 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-bold leading-5 text-amber-950"><AlertTriangle size={16} className="mt-0.5 shrink-0" />Không thể sao chép, cắt, dán hoặc kéo thả nội dung. Em hãy tự gõ bài viết bằng bàn phím.</p>}
    <div className="mt-3 flex justify-end"><span className="rounded-full bg-indigo-100 px-3 py-1.5 text-sm font-black text-indigo-900">{words} từ</span></div>
  </div>;
}

function inlineGapParts(prompt: string) {
  const match = /_{2,}/.exec(prompt);
  if (!match || match.index === undefined) return { before: prompt, after: '' };
  return { before: prompt.slice(0, match.index), after: prompt.slice(match.index + match[0].length) };
}

function InlineTransformation({ prompt, answer, onChange, label }: { prompt: string; answer: string; onChange?: (value: string) => void; label: string }) {
  const { before, after } = inlineGapParts(prompt);
  return <p className="whitespace-pre-wrap text-base font-bold leading-[3.25rem] text-slate-950">
    {before}
    {onChange
      ? <StudentUnderlineInput value={answer} onChange={event => onChange(event.target.value)} className="pet-writing-inline-gap mx-2 inline-block min-w-40" aria-label={label} autoComplete="off" autoCapitalize="none" spellCheck />
      : <span className="mx-2 inline-block min-w-32 border-b-2 border-indigo-700 bg-emerald-100 px-3 py-1.5 text-center font-black leading-7 text-emerald-950">{answer}</span>}
    {after}
  </p>;
}

function SentenceTransformations({ part, answers, onAnswer }: PartProps) {
  return <div id="pet-writing-part-1-player" className="space-y-4" data-pet-writing-player="part-1">
    {part.examples?.[0] && (() => {
      const example = part.examples![0];
      const lines = example.prompt.split(/\r?\n/);
      const original = lines[0] || '';
      const rewritten = lines.slice(1).join('\n') || example.prompt;
      return <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4 sm:p-5" data-pet-writing-worked-example>
        <p className="text-xs font-black uppercase tracking-[.14em] text-amber-900">Example · 0</p>
        {original && rewritten !== original && <p className="mt-3 whitespace-pre-wrap text-base font-bold leading-7 text-slate-950">{original}</p>}
        <div className="mt-2"><InlineTransformation prompt={rewritten} answer={example.answer} label="Đáp án example" /></div>
        <p className="mt-3 text-sm font-black text-slate-800">Answer: <span className="rounded-lg border border-emerald-400 bg-white px-3 py-1.5 text-emerald-800">{example.answer}</span></p>
      </section>;
    })()}
    {part.questions.map((question, index) => {
      const answer = typeof answers[question.id] === 'string' ? String(answers[question.id]) : '';
      return <article key={question.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-700 text-sm font-black text-white">{question.displayNumber || index + 1}</span><p className="whitespace-pre-wrap pt-1 text-base font-bold leading-7 text-slate-950">{question.context}</p></div>
        <div className="mt-3 pl-12"><InlineTransformation prompt={question.prompt} answer={answer} onChange={value => onAnswer(question.id, value)} label={`Đáp án câu ${question.displayNumber || index + 1}`} /></div>
      </article>;
    })}
  </div>;
}

function GuidedEmail({ part, answers, onAnswer }: PartProps) {
  const question = part.questions[0];
  if (!question) return null;
  const answer = typeof answers[question.id] === 'string' ? String(answers[question.id]) : '';
  return <section id="pet-writing-part-2-player" data-pet-writing-player="part-2">
    {part.passage && <article className="rounded-3xl border border-indigo-300 bg-indigo-50 p-5 sm:p-7"><p className="text-xs font-black uppercase tracking-[.16em] text-indigo-800">Question 6</p><div className="mt-3 whitespace-pre-wrap text-base font-bold leading-7 text-slate-950">{part.passage}</div></article>}
    <TypedWritingArea question={question} value={answer} onChange={value => onAnswer(question.id, value)} />
  </section>;
}

function ChoiceWriting({ part, answers, onAnswer }: PartProps) {
  const question = part.questions[0];
  if (!question) return null;
  const rawAnswer = answers[question.id];
  const current: ExamWritingAnswer = isWritingAnswer(rawAnswer) ? rawAnswer : { optionId: '', text: '' };
  return <section id="pet-writing-part-3-player" className="space-y-5" data-pet-writing-player="part-3">
    <div className="grid gap-4 md:grid-cols-2" role="radiogroup" aria-label="Chọn một đề Writing">
      {question.options.map(option => {
        const selected = current.optionId === option.id;
        return <button key={option.id} type="button" role="radio" aria-checked={selected} data-selected={selected ? 'true' : 'false'} onClick={() => onAnswer(question.id, { optionId: option.id, text: current.text })} className={`pet-writing-task-option min-h-44 rounded-2xl border-2 p-5 text-left transition ${selected ? 'border-indigo-800 bg-indigo-100 text-indigo-950 ring-4 ring-indigo-100 shadow-lg' : 'border-slate-300 bg-white text-slate-900 hover:border-indigo-500'}`}>
          <span className={`inline-flex h-9 min-w-9 items-center justify-center rounded-full px-3 text-sm font-black ${selected ? 'bg-indigo-800 text-white' : 'bg-slate-200 text-slate-800'}`}>Question {option.label}</span>
          <span className="mt-4 block whitespace-pre-wrap text-sm font-bold leading-6">{option.text}</span>
        </button>;
      })}
    </div>
    {!current.optionId ? <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-black text-amber-950">Hãy chọn Question 7 hoặc Question 8 trước khi viết.</p> : <TypedWritingArea question={question} value={current.text} onChange={text => onAnswer(question.id, { optionId: current.optionId, text })} />}
  </section>;
}

export default function PetWritingPartView(props: PartProps) {
  if (props.part.part === 1) return <SentenceTransformations {...props} />;
  if (props.part.part === 2) return <GuidedEmail {...props} />;
  return <ChoiceWriting {...props} />;
}

interface ResultProps {
  result: ExamCompletedAttempt;
  review: ExamAttemptReview | null;
  playable: ExamPlayableSet;
  reviewLoading: boolean;
  gradeRetrying: boolean;
  error: string;
  onReview: () => void;
  onRetryGrade: () => void;
  onRetry: () => void;
  onBack: () => void;
}

export function PetWritingResult({ result, review, playable, reviewLoading, gradeRetrying, error, onReview, onRetryGrade, onRetry, onBack }: ResultProps) {
  const completed = result.status === 'completed';
  const grading = ['queued', 'processing', 'retrying'].includes(String(result.aiGradingStatus || ''));
  const failed = result.aiGradingStatus === 'failed';
  const writingReviews = review?.questions.filter(question => question.type === 'long-writing') || [];
  const [clock, setClock] = useState(Date.now());
  const retryAt = new Date(result.aiGradingNextRetryAt || 0).getTime();
  const retrySeconds = Number.isFinite(retryAt) ? Math.max(0, Math.ceil((retryAt - clock) / 1_000)) : 0;
  useEffect(() => {
    if (!failed || !result.aiGradingRetryable || retrySeconds <= 0) return;
    const timer = window.setInterval(() => setClock(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [failed, result.aiGradingRetryable, result.aiGradingNextRetryAt, retrySeconds > 0]);
  const retryCountdown = `${Math.floor(retrySeconds / 60).toString().padStart(2, '0')}:${(retrySeconds % 60).toString().padStart(2, '0')}`;
  return <main id="pet-writing-result" className="min-h-screen bg-gradient-to-b from-violet-100 via-white to-sky-50 p-4 sm:p-8">
    <div className="mx-auto max-w-5xl space-y-5">
      <section className="rounded-3xl border border-white bg-white p-6 text-center shadow-xl sm:p-8">
        {completed ? <CheckCircle2 className="mx-auto text-emerald-700" size={56} /> : grading ? <LoaderCircle className="mx-auto animate-spin text-violet-700" size={56} /> : <FileClock className="mx-auto text-violet-700" size={56} />}
        <p className="mt-4 text-xs font-black uppercase tracking-[.2em] text-violet-800">{completed ? 'Đã chấm xong PET Writing' : failed ? 'Chấm AI chưa thành công' : 'Đã lưu bài · đang chấm lần lượt'}</p>
        <h1 className="mt-2 text-3xl font-black text-slate-950">{playable.title}</h1>
        {completed ? <><p className="mt-5 text-6xl font-black text-violet-900">{result.score}<span className="text-3xl text-violet-600">/100</span></p><p className="mt-2 text-sm font-bold text-slate-600">Điểm gồm 5 câu Part 1 và hai bài viết AI chấm 0–10.</p></> : <p className="mx-auto mt-5 max-w-2xl text-lg font-black text-violet-900">{result.aiGradingMessage || 'Hệ thống đang chấm Part 2 và Part 3 nối tiếp. Bài làm đã được lưu an toàn.'}</p>}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {completed && playable.content.showReviewAfterSubmit && !review && <button type="button" disabled={reviewLoading} onClick={onReview} className="exam-platform-result-review inline-flex items-center gap-2 rounded-xl border border-violet-400 bg-violet-50 px-5 py-3 font-black text-violet-950"><Eye size={17} />{reviewLoading ? 'Đang tải…' : 'Xem nhận xét'}</button>}
          {failed && result.aiGradingRetryable && <button type="button" disabled={gradeRetrying || retrySeconds > 0} onClick={onRetryGrade} className="exam-platform-grade-retry inline-flex items-center gap-2 rounded-xl border border-amber-500 bg-amber-50 px-5 py-3 font-black text-amber-950 disabled:cursor-not-allowed"><RotateCcw size={17} />{gradeRetrying ? 'Đang gửi…' : retrySeconds > 0 ? `Chấm lại sau ${retryCountdown}` : 'Chấm lại'}</button>}
          <button type="button" onClick={onRetry} className="exam-platform-result-retry inline-flex items-center gap-2 rounded-xl bg-violet-800 px-5 py-3 font-black text-white"><RotateCcw size={17} />Làm lại</button>
          <button type="button" onClick={onBack} className="exam-platform-result-home rounded-xl border border-slate-400 bg-white px-5 py-3 font-black text-slate-900">Quay lại</button>
        </div>
        {error && <p className="mt-4 font-bold text-rose-800">{error}</p>}
      </section>
      {review && <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <h2 className="text-xl font-black text-slate-950">Chi tiết kết quả</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">{review.questions.filter(question => question.type !== 'long-writing').map(question => <article key={question.questionId} className={`rounded-2xl border p-3 ${question.correct ? 'border-emerald-300 bg-emerald-50' : 'border-rose-300 bg-rose-50'}`}><p className="text-xs font-black text-slate-700">Câu {question.number}</p><p className="mt-1 text-sm font-bold text-slate-950">{question.correct ? 'Đúng' : 'Chưa đúng'}</p><p className="mt-1 text-xs text-slate-700">Đáp án: {Array.isArray(question.correctAnswer) ? question.correctAnswer.join(' | ') : question.correctAnswer}</p></article>)}</div>
        <div className="mt-6 space-y-5">{writingReviews.map(question => <article key={question.questionId} className="rounded-3xl border border-violet-200 bg-violet-50 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase text-violet-800">Part {question.part}</p><h3 className="mt-1 whitespace-pre-wrap text-lg font-black text-slate-950">{question.prompt}</h3></div><span className="rounded-full bg-violet-800 px-4 py-2 text-lg font-black text-white">{question.writingScore ?? question.pointsAwarded}/10</span></div>
          <p className="mt-4 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-800">{question.aiFeedback || 'Chưa có nhận xét chi tiết.'}</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2"><div className="rounded-2xl border border-rose-200 bg-white p-4"><p className="font-black text-rose-900">Ngữ pháp cần lưu ý</p><ul className="mt-2 list-disc space-y-1 pl-5 text-sm font-semibold text-slate-700">{question.grammarErrors?.length ? question.grammarErrors.map((item, index) => <li key={index}>{item}</li>) : <li>Không phát hiện lỗi nổi bật.</li>}</ul></div><div className="rounded-2xl border border-amber-200 bg-white p-4"><p className="font-black text-amber-900">Từ vựng cần lưu ý</p><ul className="mt-2 list-disc space-y-1 pl-5 text-sm font-semibold text-slate-700">{question.vocabularyErrors?.length ? question.vocabularyErrors.map((item, index) => <li key={index}>{item}</li>) : <li>Không phát hiện lỗi nổi bật.</li>}</ul></div></div>
          <details className="mt-4 rounded-2xl border border-slate-300 bg-white p-4"><summary className="cursor-pointer font-black text-slate-950">Bài học sinh đã viết</summary><p className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-7 text-slate-800">{Array.isArray(question.userAnswer) ? question.userAnswer.join(' ') : question.userAnswer || 'Bỏ trống'}</p></details>
        </article>)}</div>
      </section>}
    </div>
  </main>;
}
