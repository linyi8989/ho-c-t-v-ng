import {
  ArrowLeft,
  BookOpenText,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  FileClock,
  Headphones,
  LoaderCircle,
  RotateCcw,
  Send,
  Trophy,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import {
  GUEST_ID_STORAGE_KEY,
  STUDENT_NAME_STORAGE_KEY,
  getOrCreateGuestId,
  identifyExistingGuest,
  storeGuestAccessCredential,
} from '../../../lib/guestIdentity';
import { createClientLearningRun } from '../../../lib/learningRuns';
import { validateStudentDisplayName } from '../../../lib/studentIdentity';
import type { ExamModuleId, ExamPaperId } from '../../listening-library/types';
import { getExamPaperDefinition } from '../definitions';
import { examPlatformApi } from '../api';
import type {
  ExamAnswers,
  ExamAnswerValue,
  ExamAttemptReview,
  ExamCompletedAttempt,
  ExamPartContent,
  ExamPlayableSet,
  ExamQuestion,
} from '../types';

interface Props {
  moduleId: Exclude<ExamModuleId, 'mover'>;
  paperId: ExamPaperId;
  setId: string;
  accessToken?: string;
  onBack: () => void;
}

interface SavedRun {
  setId: string;
  versionId: string;
  ticket: string;
  clientRunId: string;
  runSecret: string;
  startedAt: string;
  deadlineAt?: string;
  answers: ExamAnswers;
  currentPart: number;
  submissionPending?: boolean;
}

const formatTime = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
const storedName = () => { try { return window.localStorage.getItem(STUDENT_NAME_STORAGE_KEY) || ''; } catch { return ''; } };
const storageKey = (owner: string, moduleId: string, paperId: string, setId: string, versionId: string, token: string) => `msdieu_exam_run_v1:${owner}:${moduleId}:${paperId}:${setId}:${versionId}:${encodeURIComponent(token || 'public')}`;
const answerPresent = (value: ExamAnswerValue | undefined) => Array.isArray(value) ? value.length > 0 : Boolean(String(value || '').trim());
const wordCount = (value: string) => value.trim() ? value.trim().split(/\s+/).length : 0;

function QuestionView({ question, value, onChange }: { key?: string; question: ExamQuestion; value?: ExamAnswerValue; onChange: (value: ExamAnswerValue) => void }) {
  const selected = Array.isArray(value) ? value : value ? [value] : [];
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" data-question-type={question.type}>
      <div className="flex items-start gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-black text-indigo-800">{question.number}</span><div className="min-w-0 flex-1"><p className="whitespace-pre-wrap text-sm font-bold leading-6 text-slate-900">{question.prompt}</p>{question.context && <p className="mt-2 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm font-semibold leading-6 text-slate-600">{question.context}</p>}{question.imageUrl && <img src={question.imageUrl} alt="" className="mt-3 max-h-80 max-w-full rounded-xl object-contain" />}</div></div>
      {['single-choice', 'true-false', 'true-false-not-given', 'yes-no-not-given', 'matching'].includes(question.type) && <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{question.options.map(option => <label key={option.id} className={`cursor-pointer rounded-xl border p-3 text-sm font-bold ${selected.includes(option.id) ? 'border-indigo-500 bg-indigo-50 text-indigo-900 ring-2 ring-indigo-100' : 'border-slate-200 bg-white text-slate-700'}`}><input type="radio" name={`answer-${question.id}`} value={option.id} checked={selected.includes(option.id)} onChange={() => onChange(option.id)} className="mr-2" />{option.imageUrl && <img src={option.imageUrl} alt="" className="mb-2 h-28 w-full rounded-lg object-contain" />}<span className="mr-1 text-indigo-700">{option.label}.</span>{option.text}</label>)}</div>}
      {question.type === 'multiple-choice' && <div className="mt-4 grid gap-2 sm:grid-cols-2">{question.options.map(option => <label key={option.id} className={`cursor-pointer rounded-xl border p-3 text-sm font-bold ${selected.includes(option.id) ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200'}`}><input type="checkbox" checked={selected.includes(option.id)} onChange={event => onChange(event.target.checked ? [...selected, option.id] : selected.filter(id => id !== option.id))} className="mr-2" /><span className="mr-1 text-indigo-700">{option.label}.</span>{option.text}</label>)}</div>}
      {question.type === 'short-answer' && <input value={Array.isArray(value) ? value.join(' ') : value || ''} onChange={event => onChange(event.target.value)} className="mt-4 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" placeholder={question.maxWords ? `Tối đa ${question.maxWords} từ` : 'Nhập câu trả lời'} />}
      {question.type === 'long-writing' && <div className="mt-4"><textarea value={Array.isArray(value) ? value.join(' ') : value || ''} onChange={event => onChange(event.target.value)} className="min-h-64 w-full rounded-xl border border-slate-300 p-4 text-sm font-semibold leading-6 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" placeholder="Viết bài của bạn tại đây…" /><p className={`mt-2 text-right text-xs font-black ${wordCount(String(value || '')) >= Number(question.minWords || 0) ? 'text-emerald-700' : 'text-amber-700'}`}>{wordCount(String(value || ''))}/{question.minWords || 0} từ tối thiểu</p>{question.rubric && <details className="mt-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600"><summary className="cursor-pointer font-black">Tiêu chí chấm</summary><p className="mt-2 whitespace-pre-wrap font-semibold leading-5">{question.rubric}</p></details>}</div>}
    </article>
  );
}

function PartView({ part, answers, onAnswer }: { part: ExamPartContent; answers: ExamAnswers; onAnswer: (questionId: string, value: ExamAnswerValue) => void }) {
  return <div className="space-y-4">{part.passage && <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 whitespace-pre-wrap text-sm font-semibold leading-7 text-slate-700">{part.passage}</div>}{part.imageUrl && <img src={part.imageUrl} alt="" className="mx-auto max-h-[34rem] max-w-full rounded-2xl border border-slate-200 object-contain" />}{part.audioUrl && <audio controls preload="metadata" src={part.audioUrl} className="w-full" />}{part.questions.map(question => <QuestionView key={question.id} question={question} value={answers[question.id]} onChange={value => onAnswer(question.id, value)} />)}</div>;
}

export default function GenericExamLearningArea({ moduleId, paperId, setId, accessToken = '', onBack }: Props) {
  const definition = getExamPaperDefinition(moduleId, paperId)!;
  const { token, user, loading: authLoading } = useAuth();
  const [guestId] = useState(() => getOrCreateGuestId());
  const [studentName, setStudentName] = useState(() => user?.name || storedName());
  const [identityReady, setIdentityReady] = useState(Boolean(user?.name));
  const [playable, setPlayable] = useState<ExamPlayableSet | null>(null);
  const [run, setRun] = useState<SavedRun | null>(null);
  const [answers, setAnswers] = useState<ExamAnswers>({});
  const [currentPart, setCurrentPart] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [result, setResult] = useState<ExamCompletedAttempt | null>(null);
  const [review, setReview] = useState<ExamAttemptReview | null>(null);
  const [reviewRunSecret, setReviewRunSecret] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [error, setError] = useState('');
  const submitGuard = useRef(false);
  const ownerKey = user?.id ? `user:${user.id}` : `guest:${guestId}`;
  const activeStorageKey = playable ? storageKey(ownerKey, moduleId, paperId, playable.id, playable.versionId, accessToken) : '';

  useEffect(() => {
    if (authLoading) return;
    if (user?.name) { setStudentName(user.name); setIdentityReady(true); return; }
    const controller = new AbortController();
    identifyExistingGuest(guestId, controller.signal).then(profile => { if (profile) { setStudentName(profile.displayName); setIdentityReady(true); } else setIdentityReady(false); }).catch(() => setIdentityReady(false));
    return () => controller.abort();
  }, [authLoading, guestId, user?.id, user?.name]);

  useEffect(() => {
    if (authLoading) return;
    setLoading(true);
    examPlatformApi.getPlayable(moduleId, paperId, setId, token, accessToken).then(value => { setPlayable(value); setError(''); }).catch(reason => setError(reason.message)).finally(() => setLoading(false));
  }, [accessToken, authLoading, moduleId, paperId, setId, token]);

  useEffect(() => {
    if (!playable || !identityReady) return;
    try {
      const raw = window.localStorage.getItem(storageKey(ownerKey, moduleId, paperId, playable.id, playable.versionId, accessToken));
      if (!raw) return;
      const saved = JSON.parse(raw) as SavedRun;
      if (saved.setId !== playable.id || saved.versionId !== playable.versionId || !saved.ticket || !saved.runSecret) return;
      setRun(saved); setAnswers(saved.answers || {}); setCurrentPart(Math.max(0, Math.min(playable.content.parts.length - 1, Number(saved.currentPart || 0))));
    } catch { /* ignore invalid local state */ }
  }, [accessToken, identityReady, moduleId, ownerKey, paperId, playable?.id, playable?.versionId]);
  useEffect(() => { if (!run || !activeStorageKey || result) return; try { window.localStorage.setItem(activeStorageKey, JSON.stringify({ ...run, answers, currentPart })); } catch { /* in-memory still works */ } }, [activeStorageKey, answers, currentPart, result, run]);

  const persistName = async () => {
    const validation = validateStudentDisplayName(studentName);
    if (!validation.valid) return setError(validation.error);
    let displayName = validation.value;
    if (!token) {
      const response = await fetch('/api/guest-profiles/resolve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ guestId, displayName }) });
      const data = await response.json();
      if (!response.ok) return setError(data.error || 'Không thể lưu tên học sinh.');
      displayName = data.displayName || displayName;
      if (data.guestAccessToken) storeGuestAccessCredential(data.guestId || guestId, data.guestAccessToken, data.guestAccessTokenVersion);
    }
    try { window.localStorage.setItem(STUDENT_NAME_STORAGE_KEY, displayName); window.localStorage.setItem(GUEST_ID_STORAGE_KEY, guestId); } catch { /* continue */ }
    setStudentName(displayName); setIdentityReady(true); setError('');
  };

  const start = async (replaceResult = false) => {
    if (!playable || !identityReady) return;
    setLoading(true); setError('');
    try {
      const credentials = createClientLearningRun();
      const prepared = await examPlatformApi.prepare(moduleId, paperId, setId, token, { shareToken: accessToken, guestId, studentName, clientRunId: credentials.clientRunId, runSecret: credentials.runSecret });
      const next: SavedRun = { setId: playable.id, versionId: playable.versionId, ticket: prepared.ticket, clientRunId: credentials.clientRunId, runSecret: credentials.runSecret, startedAt: prepared.startedAt, deadlineAt: prepared.deadlineAt, answers: {}, currentPart: 0 };
      setRun(next); setAnswers({}); setCurrentPart(0); setReview(null); setReviewRunSecret(''); if (replaceResult) setResult(null);
    } catch (reason: any) { setError(reason.message); }
    finally { setLoading(false); }
  };

  const totalQuestions = playable?.content.parts.reduce((sum, part) => sum + part.questions.length, 0) || definition.totalQuestionCount;
  const answered = Object.values(answers).filter(answerPresent).length;
  const submit = async (automatic = false) => {
    if (!run || submitGuard.current) return;
    if (!automatic && answered < totalQuestions && !window.confirm(`Bạn mới trả lời ${answered}/${totalQuestions} câu/task. Vẫn nộp bài?`)) return;
    submitGuard.current = true; setSubmitting(true); setError('');
    const pending = { ...run, answers, currentPart, submissionPending: true }; setRun(pending);
    try {
      if (activeStorageKey) window.localStorage.setItem(activeStorageKey, JSON.stringify(pending));
      const completed = await examPlatformApi.submit(moduleId, paperId, setId, token, { ticket: run.ticket, runSecret: run.runSecret, guestId, studentName, answers });
      setReviewRunSecret(run.runSecret); setResult(completed); setRun(null); if (activeStorageKey) window.localStorage.removeItem(activeStorageKey);
    } catch (reason: any) { setError(`${automatic ? 'Hết giờ. ' : ''}${reason.message} Bạn có thể nộp lại với cùng lượt làm bài.`); setRun(pending); }
    finally { submitGuard.current = false; setSubmitting(false); }
  };
  const loadReview = async () => {
    if (!result || reviewLoading) return;
    setReviewLoading(true);
    try { setReview(await examPlatformApi.review(moduleId, paperId, setId, result.id, token, { guestId, studentName, runSecret: reviewRunSecret })); }
    catch (reason: any) { setError(reason.message); }
    finally { setReviewLoading(false); }
  };
  useEffect(() => {
    if (!run?.deadlineAt || result) { setRemainingSeconds(null); return; }
    const tick = () => { const remaining = Math.max(0, Math.ceil((new Date(run.deadlineAt!).getTime() - Date.now()) / 1000)); setRemainingSeconds(remaining); if (remaining === 0) void submit(true); };
    tick(); const timer = window.setInterval(tick, 1000); return () => window.clearInterval(timer);
  }, [run?.deadlineAt, result, answers, currentPart]);
  useEffect(() => { if (run?.submissionPending && !submitting && !result) void submit(); }, [run?.clientRunId]);

  if (loading || authLoading) return <div className="flex min-h-screen items-center justify-center bg-slate-50"><LoaderCircle className="animate-spin text-indigo-600" size={38} /></div>;
  if (!playable) return <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-6 text-center"><p className="font-black text-rose-700">{error || 'Không tìm thấy bộ đề.'}</p><button type="button" onClick={onBack} className="rounded-xl border border-slate-200 bg-white px-5 py-3 font-black">Quay lại</button></div>;
  if (!identityReady) return <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-100 to-sky-50 p-5"><div className="w-full max-w-md rounded-3xl border border-white bg-white p-7 shadow-xl"><BookOpenText className="text-indigo-600" size={34} /><h1 className="mt-4 text-2xl font-black text-slate-900">Nhập tên để bắt đầu</h1><p className="mt-2 text-sm font-semibold text-slate-500">Tên được dùng để lưu kết quả học tập.</p><input value={studentName} onChange={event => setStudentName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void persistName(); }} className="mt-5 w-full rounded-xl border border-slate-300 px-4 py-3 font-bold" placeholder="Tên học sinh" />{error && <p className="mt-3 text-sm font-bold text-rose-700">{error}</p>}<button type="button" onClick={() => void persistName()} className="mt-5 w-full rounded-xl bg-indigo-600 px-4 py-3 font-black text-white">Tiếp tục</button></div></main>;

  if (result) return <main className="min-h-screen bg-gradient-to-b from-indigo-100 via-white to-sky-50 p-4 sm:p-8"><div className="mx-auto max-w-6xl space-y-6"><section className="rounded-3xl border border-white bg-white p-7 text-center shadow-xl">{result.status === 'pending_review' ? <FileClock className="mx-auto text-violet-600" size={54} /> : <Trophy className="mx-auto text-amber-500" size={54} />}<p className="mt-4 text-xs font-black uppercase tracking-[.2em] text-indigo-600">{result.status === 'pending_review' ? 'Đã nộp · Chờ giáo viên chấm Writing' : 'Hoàn thành'}</p><h1 className="mt-2 text-3xl font-black text-slate-900">{playable.title}</h1>{result.status === 'pending_review' ? <><p className="mt-5 text-4xl font-black text-violet-700">Điểm khách quan: {result.objectiveScore}</p><p className="mt-2 text-sm font-bold text-slate-500">{result.pendingManualCount} bài viết đang chờ chấm. Điểm tổng sẽ có sau khi giáo viên xác nhận.</p></> : <><p className="mt-5 text-6xl font-black text-indigo-700">{result.score}</p><p className="mt-2 text-sm font-bold text-slate-500">Đúng {result.correctCount} · Sai {result.incorrectCount} · Bỏ trống {result.unansweredCount}</p></>}<div className="mt-6 flex flex-wrap justify-center gap-3">{result.status === 'completed' && playable.content.showReviewAfterSubmit && <button type="button" disabled={reviewLoading} onClick={() => void loadReview()} className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-5 py-3 font-black text-indigo-700"><Eye size={17} />{reviewLoading ? 'Đang tải…' : 'Xem đáp án'}</button>}<button type="button" onClick={() => void start(true)} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-black text-white"><RotateCcw size={17} />Làm lại</button><button type="button" onClick={onBack} className="rounded-xl border border-slate-200 bg-white px-5 py-3 font-black text-slate-700">Quay lại</button></div>{error && <p className="mt-4 font-bold text-rose-700">{error}</p>}</section>{review && <section className="rounded-3xl border border-slate-200 bg-white p-5"><h2 className="mb-4 text-xl font-black text-slate-900">Chi tiết kết quả</h2><div className="grid gap-3 md:grid-cols-2">{review.questions.map(question => <article key={question.questionId} className={`rounded-2xl border p-4 text-sm ${question.correct ? 'border-emerald-200 bg-emerald-50' : question.unanswered ? 'border-amber-200 bg-amber-50' : 'border-rose-200 bg-rose-50'}`}><p className="text-xs font-black uppercase text-slate-600">Part {question.part} · Câu {question.number}</p><p className="mt-2 font-bold text-slate-900">{question.prompt}</p><p className="mt-2 text-slate-700">Bạn trả lời: <b>{Array.isArray(question.userAnswer) ? question.userAnswer.join(', ') : question.userAnswer || 'Bỏ trống'}</b></p>{!question.correct && <p className="mt-1 text-emerald-800">Đáp án đúng: <b>{Array.isArray(question.correctAnswer) ? question.correctAnswer.join(', ') : question.correctAnswer}</b></p>}</article>)}</div></section>}</div></main>;

  if (!run) return <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-100 via-white to-sky-50 p-5"><section className="w-full max-w-3xl rounded-3xl border border-white bg-white p-8 text-center shadow-xl">{playable.coverUrl ? <img src={playable.coverUrl} alt="" className="mx-auto mb-6 max-h-64 rounded-2xl object-contain" /> : paperId === 'listening' ? <Headphones className="mx-auto text-sky-600" size={52} /> : <BookOpenText className="mx-auto text-indigo-600" size={52} />}<p className="mt-4 text-xs font-black uppercase tracking-[.2em] text-indigo-600">{definition.level} · {definition.displayName}</p><h1 className="mt-2 text-3xl font-black text-slate-900">{playable.title}</h1><p className="mx-auto mt-3 max-w-xl text-sm font-semibold leading-6 text-slate-500">{playable.description}</p><div className="mt-5 flex flex-wrap justify-center gap-2 text-xs font-black text-slate-700"><span className="rounded-full bg-indigo-50 px-3 py-2">{playable.content.parts.length} Part/Section</span><span className="rounded-full bg-indigo-50 px-3 py-2">{totalQuestions} câu/task</span><span className="rounded-full bg-indigo-50 px-3 py-2">{playable.timeLimitMinutes ? `${playable.timeLimitMinutes} phút` : 'Không giới hạn'}</span></div>{error && <p className="mt-4 font-bold text-rose-700">{error}</p>}<div className="mt-7 flex justify-center gap-3"><button type="button" onClick={onBack} className="rounded-xl border border-slate-200 bg-white px-5 py-3 font-black text-slate-700"><ArrowLeft size={17} className="mr-2 inline" />Quay lại</button><button type="button" onClick={() => void start()} className="rounded-xl bg-indigo-600 px-7 py-3 font-black text-white">Bắt đầu</button></div></section></main>;

  const activePart = playable.content.parts[currentPart];
  return <main className="min-h-screen bg-slate-100"><header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-3 py-3 shadow-sm backdrop-blur sm:px-6"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-indigo-600">{definition.level} · {definition.displayName}</p><h1 className="text-base font-black text-slate-900">{playable.title}</h1></div><div className="flex items-center gap-3 text-xs font-black text-slate-600"><span>{answered}/{totalQuestions}</span>{remainingSeconds !== null && <span className="inline-flex items-center gap-1 rounded-xl bg-amber-50 px-3 py-2 text-amber-800"><Clock3 size={14} />{formatTime(remainingSeconds)}</span>}<button type="button" disabled={submitting} onClick={() => void submit()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-white"><Send size={15} />Nộp bài</button></div></div></header><div className="mx-auto max-w-7xl p-3 sm:p-6"><div className="mb-4 flex gap-2 overflow-x-auto pb-1" role="tablist">{playable.content.parts.map((part, index) => <button key={part.id} type="button" role="tab" aria-selected={currentPart === index} onClick={() => setCurrentPart(index)} className={`shrink-0 rounded-xl px-4 py-2.5 text-xs font-black ${currentPart === index ? 'bg-indigo-600 text-white shadow-md' : 'border border-slate-200 bg-white text-indigo-800'}`}>{index < currentPart ? <CheckCircle2 size={13} className="mr-1 inline" /> : null}Part {index + 1}</button>)}</div>{error && <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</div>}<section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"><div className="mb-5"><p className="text-xs font-black uppercase text-indigo-600">Part {activePart.part}</p><h2 className="mt-1 text-2xl font-black text-slate-900">{activePart.title}</h2><p className="mt-2 text-sm font-semibold text-slate-500">{activePart.instruction}</p></div><PartView part={activePart} answers={answers} onAnswer={(questionId, value) => setAnswers(previous => ({ ...previous, [questionId]: value }))} /></section><div className="mt-5 flex items-center justify-between"><button type="button" disabled={currentPart === 0} onClick={() => setCurrentPart(value => Math.max(0, value - 1))} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 font-black text-slate-700 disabled:opacity-50"><ChevronLeft size={17} />Part trước</button><button type="button" disabled={currentPart === playable.content.parts.length - 1} onClick={() => setCurrentPart(value => Math.min(playable.content.parts.length - 1, value + 1))} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 font-black text-white disabled:opacity-50">Part sau<ChevronRight size={17} /></button></div></div></main>;
}
