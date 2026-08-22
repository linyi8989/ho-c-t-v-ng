import {
  ArrowLeft,
  BookOpenText,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
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
import { moverReadingWritingApi } from '../api';
import type {
  MoverReadingWritingAnswers,
  MoverReadingWritingAttemptReview,
  MoverReadingWritingCompletedAttempt,
  MoverReadingWritingPlayableSet,
} from '../types';
import { createEmptyMoverReadingWritingAnswers } from '../types';
import MoverReadingWritingVisualReview, {
  isMoverReadingWritingVisualReviewSnapshot,
} from '../review/MoverReadingWritingVisualReview';
import {
  ReadingPart1View,
  ReadingPart2View,
  ReadingPart3View,
  ReadingPart4View,
  ReadingPart5View,
  ReadingPart6View,
} from './MoverReadingWritingPartViews';

interface Props { setId: string; accessToken?: string; onBack: () => void }
interface SavedRun {
  setId: string;
  versionId: string;
  ticket: string;
  clientRunId: string;
  runSecret: string;
  startedAt: string;
  deadlineAt?: string;
  answers: MoverReadingWritingAnswers;
  currentPart: number;
  submissionPending?: boolean;
}

const RUN_PREFIX = 'msdieu_mover_reading_run_v1';
const formatTime = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
const storageKey = (ownerKey: string, setId: string, versionId: string, accessToken: string) => `${RUN_PREFIX}:${ownerKey}:${setId}:${versionId}:${encodeURIComponent(accessToken || 'public')}`;
const storedName = () => { try { return window.localStorage.getItem(STUDENT_NAME_STORAGE_KEY) || ''; } catch { return ''; } };
const answeredCount = (answers: MoverReadingWritingAnswers) => [
  ...Object.values(answers.part1),
  ...Object.values(answers.part2),
  ...Object.values(answers.part3),
  ...Object.values(answers.part4.gaps),
  answers.part4.titleOptionId,
  ...Object.values(answers.part5),
  ...Object.values(answers.part6),
].filter(value => String(value || '').trim()).length;

export default function MoverReadingWritingLearningArea({ setId, accessToken = '', onBack }: Props) {
  const { token, user, loading: authLoading } = useAuth();
  const [guestId] = useState(() => getOrCreateGuestId());
  const [studentName, setStudentName] = useState(() => user?.name || storedName());
  const [identityReady, setIdentityReady] = useState(Boolean(user?.name));
  const [playable, setPlayable] = useState<MoverReadingWritingPlayableSet | null>(null);
  const [run, setRun] = useState<SavedRun | null>(null);
  const [answers, setAnswers] = useState(createEmptyMoverReadingWritingAnswers);
  const [currentPart, setCurrentPart] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [result, setResult] = useState<MoverReadingWritingCompletedAttempt | null>(null);
  const [review, setReview] = useState<MoverReadingWritingAttemptReview | null>(null);
  const [reviewRunSecret, setReviewRunSecret] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [error, setError] = useState('');
  const submitGuard = useRef(false);
  const ownerKey = user?.id ? `user:${user.id}` : `guest:${guestId}`;
  const activeStorageKey = playable ? storageKey(ownerKey, playable.id, playable.versionId, accessToken) : '';

  useEffect(() => {
    if (authLoading) return;
    if (user?.name) { setStudentName(user.name); setIdentityReady(true); return; }
    const controller = new AbortController();
    identifyExistingGuest(guestId, controller.signal)
      .then(profile => { if (profile) { setStudentName(profile.displayName); setIdentityReady(true); } else setIdentityReady(false); })
      .catch(() => setIdentityReady(false));
    return () => controller.abort();
  }, [authLoading, guestId, user?.id, user?.name]);

  useEffect(() => {
    if (authLoading) return;
    setLoading(true);
    moverReadingWritingApi.getPlayable(setId, token, accessToken)
      .then(value => { setPlayable(value); setError(''); })
      .catch(reason => setError(reason.message))
      .finally(() => setLoading(false));
  }, [accessToken, authLoading, setId, token]);

  useEffect(() => {
    if (!playable || !identityReady) return;
    try {
      const raw = window.localStorage.getItem(storageKey(ownerKey, playable.id, playable.versionId, accessToken));
      if (!raw) return;
      const saved = JSON.parse(raw) as SavedRun;
      if (saved.setId !== playable.id || saved.versionId !== playable.versionId || !saved.ticket || !saved.runSecret) return;
      setRun(saved);
      setAnswers(saved.answers || createEmptyMoverReadingWritingAnswers());
      setCurrentPart(Math.max(0, Math.min(5, Number(saved.currentPart || 0))));
    } catch { /* invalid local progress is ignored */ }
  }, [accessToken, identityReady, ownerKey, playable?.id, playable?.versionId]);

  useEffect(() => {
    if (!run || !activeStorageKey || result) return;
    try { window.localStorage.setItem(activeStorageKey, JSON.stringify({ ...run, answers, currentPart })); } catch { /* keep in memory */ }
  }, [activeStorageKey, answers, currentPart, result, run]);

  const persistName = async () => {
    const validation = validateStudentDisplayName(studentName);
    if (!validation.valid) return setError(validation.error);
    let displayName = validation.value;
    if (!token) {
      const response = await fetch('/api/guest-profiles/resolve', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ guestId, displayName }),
      });
      const data = await response.json();
      if (!response.ok) return setError(data.error || 'Không thể lưu tên học sinh.');
      displayName = data.displayName || displayName;
      if (data.guestAccessToken) storeGuestAccessCredential(data.guestId || guestId, data.guestAccessToken, data.guestAccessTokenVersion);
    }
    try {
      window.localStorage.setItem(STUDENT_NAME_STORAGE_KEY, displayName);
      window.localStorage.setItem(GUEST_ID_STORAGE_KEY, guestId);
    } catch { /* continue in memory */ }
    setStudentName(displayName);
    setIdentityReady(true);
    setError('');
  };

  const start = async (replaceResult = false) => {
    if (!playable || !identityReady) return;
    setLoading(true);
    setError('');
    try {
      const credentials = createClientLearningRun();
      const prepared = await moverReadingWritingApi.prepare(setId, token, {
        shareToken: accessToken,
        guestId,
        studentName,
        clientRunId: credentials.clientRunId,
        runSecret: credentials.runSecret,
      });
      const next: SavedRun = {
        setId: playable.id,
        versionId: playable.versionId,
        ticket: prepared.ticket,
        clientRunId: credentials.clientRunId,
        runSecret: credentials.runSecret,
        startedAt: prepared.startedAt,
        deadlineAt: prepared.deadlineAt,
        answers: createEmptyMoverReadingWritingAnswers(),
        currentPart: 0,
      };
      setRun(next);
      setAnswers(next.answers);
      setCurrentPart(0);
      setReview(null);
      setReviewRunSecret('');
      if (replaceResult) setResult(null);
    } catch (reason: any) { setError(reason.message); }
    finally { setLoading(false); }
  };

  const submit = async (automatic = false) => {
    if (!run || submitGuard.current) return;
    const count = answeredCount(answers);
    if (!automatic && count < 40 && !window.confirm(`Bạn mới trả lời ${count}/40 câu. Vẫn nộp bài?`)) return;
    submitGuard.current = true;
    setSubmitting(true);
    setError('');
    const pending = { ...run, answers, currentPart, submissionPending: true };
    setRun(pending);
    try {
      if (activeStorageKey) window.localStorage.setItem(activeStorageKey, JSON.stringify(pending));
      const completed = await moverReadingWritingApi.submit(setId, token, {
        ticket: run.ticket, runSecret: run.runSecret, guestId, studentName, answers,
      });
      setReviewRunSecret(run.runSecret);
      setResult(completed);
      setRun(null);
      if (activeStorageKey) window.localStorage.removeItem(activeStorageKey);
    } catch (reason: any) {
      setError(`${automatic ? 'Hết giờ. ' : ''}${reason.message} Bạn có thể nộp lại với cùng mã lượt làm bài.`);
      setRun(pending);
    } finally { submitGuard.current = false; setSubmitting(false); }
  };

  const loadReview = async () => {
    if (!result || reviewLoading) return;
    setReviewLoading(true);
    try {
      const value = await moverReadingWritingApi.review(setId, result.id, token, { guestId, studentName, runSecret: reviewRunSecret });
      setReview(value);
    } catch (reason: any) { setError(reason.message); }
    finally { setReviewLoading(false); }
  };

  useEffect(() => {
    if (!run?.deadlineAt || result) { setRemainingSeconds(null); return; }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((new Date(run.deadlineAt!).getTime() - Date.now()) / 1000));
      setRemainingSeconds(remaining);
      if (remaining === 0) void submit(true);
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [run?.deadlineAt, result, answers, currentPart]);

  useEffect(() => { if (run?.submissionPending && !submitting && !result) void submit(); }, [run?.clientRunId]);

  const views = useMemo(() => playable ? [
    <ReadingPart1View part={playable.content.parts[0]} answers={answers} onAnswers={setAnswers} />,
    <ReadingPart2View part={playable.content.parts[1]} answers={answers} onAnswers={setAnswers} />,
    <ReadingPart3View part={playable.content.parts[2]} answers={answers} onAnswers={setAnswers} />,
    <ReadingPart4View part={playable.content.parts[3]} answers={answers} onAnswers={setAnswers} />,
    <ReadingPart5View part={playable.content.parts[4]} answers={answers} onAnswers={setAnswers} />,
    <ReadingPart6View part={playable.content.parts[5]} answers={answers} onAnswers={setAnswers} />,
  ] : [], [answers, playable]);

  if (loading || authLoading) return <div className="flex min-h-screen items-center justify-center bg-slate-50"><LoaderCircle className="animate-spin text-indigo-600" size={38} /></div>;
  if (!playable) return <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-6 text-center" id="mover-reading-writing-player"><p className="font-black text-rose-700">{error || 'Không tìm thấy bộ đề.'}</p><button type="button" onClick={onBack} className="mover-reading-secondary-action rounded-xl border border-slate-200 bg-white px-5 py-3 font-black">Quay lại</button></div>;

  if (!identityReady) return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-100 to-sky-50 p-5" id="mover-reading-writing-player">
      <div className="w-full max-w-md rounded-3xl border border-white bg-white p-7 shadow-xl"><BookOpenText className="text-indigo-600" size={34} /><h1 className="mt-4 text-2xl font-black text-slate-900">Nhập tên để bắt đầu</h1><p className="mt-2 text-sm font-semibold text-slate-500">Tên được dùng để lưu kết quả học tập.</p><input value={studentName} onChange={event => setStudentName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void persistName(); }} className="mt-5 w-full rounded-xl border border-slate-300 px-4 py-3 font-bold" placeholder="Tên học sinh" />{error && <p className="mt-3 text-sm font-bold text-rose-700">{error}</p>}<button type="button" onClick={() => void persistName()} className="mover-reading-primary-action mt-5 w-full rounded-xl bg-indigo-600 px-4 py-3 font-black text-white">Tiếp tục</button></div>
    </main>
  );

  if (result) return (
    <main className="min-h-screen bg-gradient-to-b from-indigo-100 via-white to-sky-50 p-4 sm:p-8" id="mover-reading-writing-player">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border border-white bg-white p-7 text-center shadow-xl"><Trophy className="mx-auto text-amber-500" size={54} /><p className="mt-4 text-xs font-black uppercase tracking-[.2em] text-indigo-600">Hoàn thành</p><h1 className="mt-2 text-3xl font-black text-slate-900">{playable.title}</h1><p className="mt-5 text-6xl font-black text-indigo-700">{result.score}</p><p className="mt-2 text-sm font-bold text-slate-500">Đúng {result.correctCount} · Sai {result.incorrectCount} · Bỏ trống {result.unansweredCount}</p><div className="mt-6 flex flex-wrap justify-center gap-3">{playable.content.showReviewAfterSubmit && <button type="button" disabled={reviewLoading} onClick={() => void loadReview()} className="mover-reading-secondary-action inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-5 py-3 font-black text-indigo-700"><Eye size={17} /> {reviewLoading ? 'Đang tải…' : 'Xem đáp án'}</button>}<button type="button" onClick={() => void start(true)} className="mover-reading-primary-action inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-black text-white"><RotateCcw size={17} /> Làm lại</button><button type="button" onClick={onBack} className="mover-reading-secondary-action rounded-xl border border-slate-200 bg-white px-5 py-3 font-black text-slate-700">Quay lại</button></div>{error && <p className="mt-4 font-bold text-rose-700">{error}</p>}</section>
        {review && (
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="mb-4 text-xl font-black text-slate-900">Chi tiết 40 câu</h2>
            {isMoverReadingWritingVisualReviewSnapshot(review.visualReview)
              ? <MoverReadingWritingVisualReview snapshot={review.visualReview} />
              : <div className="grid gap-3 md:grid-cols-2">{review.questions.map((question, index) => <article key={`${question.part}-${index}`} className={`rounded-2xl border p-4 text-sm ${question.correct ? 'border-emerald-200 bg-emerald-50' : question.unanswered ? 'border-amber-200 bg-amber-50' : 'border-rose-200 bg-rose-50'}`}><p className="text-xs font-black uppercase text-slate-600">Part {question.part} · Câu {review.questions.slice(0, index + 1).filter(item => item.part === question.part).length}</p><p className="mt-2 font-bold text-slate-900">{question.prompt}</p><p className="mt-2 text-slate-700">Bạn trả lời: <b>{question.userAnswer || 'Bỏ trống'}</b></p>{!question.correct && <p className="mt-1 text-emerald-800">Đáp án đúng: <b>{question.correctAnswer}</b></p>}</article>)}</div>}
          </section>
        )}
      </div>
    </main>
  );

  if (!run) return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-100 via-white to-sky-50 p-5" id="mover-reading-writing-player">
      <section className="w-full max-w-3xl rounded-3xl border border-white bg-white p-8 text-center shadow-xl">{playable.coverUrl ? <img src={playable.coverUrl} alt="" className="mx-auto mb-6 max-h-64 rounded-2xl object-contain" /> : <BookOpenText className="mx-auto text-indigo-600" size={52} />}<p className="mt-4 text-xs font-black uppercase tracking-[.2em] text-indigo-600">Mover · Reading & Writing</p><h1 className="mt-2 text-3xl font-black text-slate-900">{playable.title}</h1><p className="mx-auto mt-3 max-w-xl text-sm font-semibold leading-6 text-slate-500">{playable.description}</p><div className="mt-5 flex flex-wrap justify-center gap-2 text-xs font-black text-slate-700"><span className="rounded-full bg-indigo-50 px-3 py-2">6 Part</span><span className="rounded-full bg-indigo-50 px-3 py-2">40 câu</span><span className="rounded-full bg-indigo-50 px-3 py-2">{playable.timeLimitMinutes ? `${playable.timeLimitMinutes} phút` : 'Không giới hạn'}</span></div>{error && <p className="mt-4 font-bold text-rose-700">{error}</p>}<div className="mt-7 flex justify-center gap-3"><button type="button" onClick={onBack} className="mover-reading-secondary-action rounded-xl border border-slate-200 bg-white px-5 py-3 font-black text-slate-700"><ArrowLeft size={17} className="mr-2 inline" />Quay lại</button><button type="button" onClick={() => void start()} className="mover-reading-primary-action rounded-xl bg-indigo-600 px-7 py-3 font-black text-white">Bắt đầu</button></div></section>
    </main>
  );

  return (
    <main className="min-h-screen bg-slate-100" id="mover-reading-writing-player">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-3 py-3 shadow-sm backdrop-blur sm:px-6"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-indigo-600">Mover Reading & Writing</p><h1 className="text-base font-black text-slate-900">{playable.title}</h1></div><div className="flex items-center gap-3 text-xs font-black text-slate-600"><span>{answeredCount(answers)}/40 câu</span>{remainingSeconds !== null && <span className="inline-flex items-center gap-1 rounded-xl bg-amber-50 px-3 py-2 text-amber-800"><Clock3 size={14} />{formatTime(remainingSeconds)}</span>}<button type="button" disabled={submitting} onClick={() => void submit()} className="mover-reading-submit-action inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-white"><Send size={15} />Nộp bài</button></div></div></header>
      <div className="mx-auto max-w-7xl p-3 sm:p-6"><div className="mb-4 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Các Part Reading & Writing">{playable.content.parts.map((part, index) => <button key={part.part} type="button" role="tab" aria-selected={currentPart === index} data-active={currentPart === index} onClick={() => setCurrentPart(index)} className={`mover-reading-part-step shrink-0 rounded-xl px-4 py-2.5 text-xs font-black ${currentPart === index ? 'bg-indigo-600 text-white shadow-md' : 'border border-slate-200 bg-white text-indigo-800'}`}>{index < currentPart ? <CheckCircle2 size={13} className="mr-1 inline" /> : null}Part {index + 1}</button>)}</div>{error && <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</div>}<section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"><div className="mb-5"><p className="text-xs font-black uppercase text-indigo-600">Part {currentPart + 1}</p><h2 className="mt-1 text-2xl font-black text-slate-900">{playable.content.parts[currentPart].title}</h2><p className="mt-2 text-sm font-semibold text-slate-500">{playable.content.parts[currentPart].instruction}</p></div>{views[currentPart]}</section><div className="mt-5 flex items-center justify-between"><button type="button" disabled={currentPart === 0} onClick={() => setCurrentPart(value => Math.max(0, value - 1))} className="mover-reading-secondary-action inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 font-black text-slate-700 disabled:opacity-60"><ChevronLeft size={17} />Part trước</button><button type="button" disabled={currentPart === 5} onClick={() => setCurrentPart(value => Math.min(5, value + 1))} className="mover-reading-primary-action inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 font-black text-white disabled:opacity-60">Part sau<ChevronRight size={17} /></button></div></div>
    </main>
  );
}
