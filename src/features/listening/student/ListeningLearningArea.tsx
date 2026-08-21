import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Expand,
  Eye,
  Headphones,
  Home,
  Lightbulb,
  LoaderCircle,
  RotateCcw,
  Send,
  Trophy,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import {
  GUEST_ID_STORAGE_KEY,
  STUDENT_NAME_STORAGE_KEY,
  getOrCreateGuestId,
  identifyExistingGuest,
  storeGuestAccessCredential,
} from '../../../lib/guestIdentity';
import { createClientLearningRun } from '../../../lib/learningRuns';
import { STUDENT_NAME_MAX_LENGTH, validateStudentDisplayName } from '../../../lib/studentIdentity';
import { listeningApi } from '../api';
import type {
  ListeningAnswers,
  ListeningAttemptReview,
  ListeningCompletedAttempt,
  ListeningPlayableSet,
} from '../types';
import { createEmptyListeningAnswers } from '../types';
import {
  ListeningPart1View,
  ListeningPart2View,
  ListeningPart3View,
  ListeningPart4View,
  ListeningPart5View,
} from './ListeningPartViews';
import ListeningVisualReview from '../review/ListeningVisualReview';

interface ListeningLearningAreaProps {
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
  answers: ListeningAnswers;
  currentPart: number;
  submissionPending?: boolean;
}

const RUN_PREFIX = 'msdieu_listening_run_v1';
const getStoredName = () => {
  try { return window.localStorage.getItem(STUDENT_NAME_STORAGE_KEY) || ''; } catch { return ''; }
};
const storageKey = (ownerKey: string, setId: string, versionId: string, accessToken = '') =>
  `${RUN_PREFIX}:${ownerKey}:${setId}:${versionId}:${encodeURIComponent(accessToken || 'public')}`;
const answeredCount = (answers: ListeningAnswers) =>
  Object.keys(answers.part1).length
  + Object.values(answers.part2).filter(value => Object.values(value).some(Boolean)).length
  + Object.keys(answers.part3).length
  + Object.keys(answers.part4).length
  + Object.keys(answers.part5).length;
const formatTime = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;

export default function ListeningLearningArea({ setId, accessToken = '', onBack }: ListeningLearningAreaProps) {
  const { token, user, loading: authLoading } = useAuth();
  const [guestId] = useState(() => getOrCreateGuestId());
  const [studentName, setStudentName] = useState(() => user?.name || getStoredName());
  const [identityReady, setIdentityReady] = useState(Boolean(user?.name));
  const [playable, setPlayable] = useState<ListeningPlayableSet | null>(null);
  const [run, setRun] = useState<SavedRun | null>(null);
  const [answers, setAnswers] = useState<ListeningAnswers>(() => createEmptyListeningAnswers());
  const [currentPart, setCurrentPart] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [result, setResult] = useState<ListeningCompletedAttempt | null>(null);
  const [review, setReview] = useState<ListeningAttemptReview | null>(null);
  const [reviewRunSecret, setReviewRunSecret] = useState('');
  const [showReview, setShowReview] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const submitGuard = useRef(false);

  const ownerKey = user?.id ? `user:${user.id}` : `guest:${guestId}`;
  const activeStorageKey = playable ? storageKey(ownerKey, playable.id, playable.versionId, accessToken) : '';

  useEffect(() => {
    if (authLoading) return;
    if (user?.name) {
      setStudentName(user.name);
      setIdentityReady(true);
      return;
    }
    const controller = new AbortController();
    identifyExistingGuest(guestId, controller.signal)
      .then(profile => {
        if (!profile) return setIdentityReady(false);
        setStudentName(profile.displayName);
        setIdentityReady(true);
      })
      .catch(() => setIdentityReady(false));
    return () => controller.abort();
  }, [authLoading, guestId, user?.id, user?.name]);

  useEffect(() => {
    if (authLoading) return;
    setLoading(true);
    listeningApi.getPlayable(setId, token, accessToken)
      .then(set => {
        setPlayable(set);
        setError('');
      })
      .catch(error => setError(error.message))
      .finally(() => setLoading(false));
  }, [accessToken, authLoading, setId, token]);

  useEffect(() => {
    if (!playable || !identityReady) return;
    const key = storageKey(ownerKey, playable.id, playable.versionId, accessToken);
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return;
      const saved = JSON.parse(raw) as SavedRun;
      if (saved.setId !== playable.id || saved.versionId !== playable.versionId || !saved.ticket || !saved.runSecret) return;
      setRun(saved);
      setAnswers(saved.answers || createEmptyListeningAnswers());
      setCurrentPart(Math.max(0, Math.min(4, Number(saved.currentPart || 0))));
    } catch {
      // A broken local draft is ignored and can be replaced by a new run.
    }
  }, [accessToken, identityReady, ownerKey, playable?.id, playable?.versionId]);

  useEffect(() => {
    if (!run || !activeStorageKey || result) return;
    const saved = { ...run, answers, currentPart };
    try { window.localStorage.setItem(activeStorageKey, JSON.stringify(saved)); } catch { /* current state remains usable */ }
  }, [activeStorageKey, answers, currentPart, result, run]);

  const persistName = async () => {
    const validation = validateStudentDisplayName(studentName);
    if (!validation.valid) return setError(validation.error);
    let displayName = validation.value;
    if (!token) {
      const response = await fetch('/api/guest-profiles/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guestId, displayName }),
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

  const start = async (replaceCompletedAttempt = false) => {
    if (!playable || !identityReady) return;
    setLoading(true);
    setError('');
    try {
      const clientRun = createClientLearningRun();
      const prepared = await listeningApi.prepare(setId, token, {
        shareToken: accessToken,
        guestId,
        studentName,
        clientRunId: clientRun.clientRunId,
        runSecret: clientRun.runSecret,
      });
      const nextRun: SavedRun = {
        setId: playable.id,
        versionId: playable.versionId,
        ticket: prepared.ticket,
        clientRunId: clientRun.clientRunId,
        runSecret: clientRun.runSecret,
        startedAt: prepared.startedAt,
        deadlineAt: prepared.deadlineAt,
        answers: createEmptyListeningAnswers(),
        currentPart: 0,
      };
      setRun(nextRun);
      setAnswers(nextRun.answers);
      setCurrentPart(0);
      if (replaceCompletedAttempt) setResult(null);
      setReview(null);
      setReviewRunSecret('');
      setShowReview(false);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const openReview = async () => {
    if (!result || reviewLoading) return;
    if (review) {
      setShowReview(true);
      return;
    }
    setReviewLoading(true);
    setError('');
    try {
      const loadedReview = await listeningApi.getAttemptReview(setId, result.id, token, {
        guestId,
        studentName,
        runSecret: reviewRunSecret,
      });
      setReview(loadedReview);
      setShowReview(true);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setReviewLoading(false);
    }
  };

  const submit = async (automatic = false) => {
    if (!run || submitGuard.current) return;
    if (!automatic && answeredCount(answers) < 25 && !window.confirm(
      `Bạn mới trả lời ${answeredCount(answers)}/25 câu. Vẫn nộp bài?`
    )) return;
    submitGuard.current = true;
    setSubmitting(true);
    setError('');
    const pending = { ...run, answers, currentPart, submissionPending: true };
    setRun(pending);
    try {
      if (activeStorageKey) window.localStorage.setItem(activeStorageKey, JSON.stringify(pending));
      const completed = await listeningApi.submit(setId, token, {
        ticket: run.ticket,
        runSecret: run.runSecret,
        guestId,
        studentName,
        answers,
      });
      setReviewRunSecret(run.runSecret);
      setResult(completed);
      setRun(null);
      if (activeStorageKey) window.localStorage.removeItem(activeStorageKey);
    } catch (error: any) {
      setError(`${automatic ? 'Hết giờ. ' : ''}${error.message} Bạn có thể bấm nộp lại; mã lượt làm bài vẫn giữ nguyên.`);
      setRun(pending);
    } finally {
      submitGuard.current = false;
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!run?.deadlineAt || result) {
      setRemainingSeconds(null);
      return;
    }
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((new Date(run.deadlineAt!).getTime() - Date.now()) / 1000));
      setRemainingSeconds(remaining);
      if (remaining === 0) void submit(true);
    };
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [run?.deadlineAt, result, answers, currentPart]);

  useEffect(() => {
    if (run?.submissionPending && !submitting && !result) void submit();
  }, [run?.clientRunId]);

  const part = playable?.content.parts[currentPart];
  const partUsesInternalScroller = currentPart === 0
    || (currentPart === 4 && playable?.content.parts[4]?.displayMode === 'scene-colour-draw');
  const progress = answeredCount(answers);
  const partViews = part ? [
    <ListeningPart1View key={1} part={playable!.content.parts[0]} answers={answers} onAnswers={setAnswers} />,
    <ListeningPart2View key={2} part={playable!.content.parts[1]} answers={answers} onAnswers={setAnswers} />,
    <ListeningPart3View key={3} part={playable!.content.parts[2]} answers={answers} onAnswers={setAnswers} />,
    <ListeningPart4View key={4} part={playable!.content.parts[3]} answers={answers} onAnswers={setAnswers} />,
    <ListeningPart5View key={5} part={playable!.content.parts[4]} answers={answers} onAnswers={setAnswers} />,
  ] : [];

  const backgroundStyle = useMemo<React.CSSProperties>(() => playable?.content.backgroundUrl ? {
    backgroundImage: `linear-gradient(rgba(226,246,255,.82), rgba(225,255,219,.82)), url("${playable.content.backgroundUrl}")`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  } : {}, [playable?.content.backgroundUrl]);

  if (loading || authLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-sky-100"><LoaderCircle className="animate-spin text-blue-600" size={42} /></div>;
  }
  if (!playable) {
    return <div id="listening-error-screen" className="flex min-h-screen flex-col items-center justify-center gap-4 bg-sky-100 p-6 text-center"><Headphones size={50} className="text-rose-500" /><h1 className="text-2xl font-black text-slate-900">Không thể mở bộ đề nghe</h1><p className="text-sm font-bold text-rose-600">{error}</p><button id="listening-error-home-btn" onClick={onBack} className="listening-primary-action rounded-2xl bg-blue-600 px-5 py-3 font-black text-white">Về trang chủ</button></div>;
  }
  if (!identityReady) {
    return (
      <div id="listening-name-screen" className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-300 to-emerald-100 p-4">
        <div className="w-full max-w-md rounded-3xl border-4 border-white bg-white/95 p-7 text-center shadow-2xl">
          <Headphones className="mx-auto text-blue-600" size={44} />
          <h1 className="mt-3 text-2xl font-black text-slate-900">{playable.title}</h1>
          <p className="mt-1 text-sm font-semibold text-slate-500">Nhập tên để bắt đầu và lưu lịch sử học.</p>
          <input value={studentName} onChange={event => setStudentName(event.target.value)} maxLength={STUDENT_NAME_MAX_LENGTH} className="mt-5 w-full rounded-2xl border-2 border-sky-200 px-4 py-3 text-center font-black outline-none focus:border-blue-600" placeholder="Tên học sinh" />
          {error && <p className="mt-2 text-xs font-bold text-rose-600">{error}</p>}
          <button id="listening-confirm-name-btn" onClick={() => void persistName()} className="listening-primary-action mt-4 w-full rounded-2xl bg-blue-600 py-3 font-black text-white">Xác nhận tên</button>
        </div>
      </div>
    );
  }
  if (!run && !result) {
    return (
      <div id="listening-start-screen" className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-300 to-emerald-100 p-4">
        <div className="w-full max-w-2xl overflow-hidden rounded-[2rem] border-4 border-white bg-white shadow-2xl">
          {playable.content.coverUrl && <img src={playable.content.coverUrl} alt="" className="h-64 w-full object-cover" />}
          <div className="p-7 text-center">
            <p className="text-xs font-black uppercase tracking-[.2em] text-blue-600">{playable.level} • Listening</p>
            <h1 className="mt-2 text-3xl font-black text-slate-900">{playable.title}</h1>
            <p className="mt-2 text-sm font-semibold text-slate-500">{playable.description}</p>
            <div className="mt-5 grid grid-cols-3 gap-2 text-xs font-black">
              <span className="rounded-2xl bg-sky-50 p-3 text-sky-700">5 Part</span>
              <span className="rounded-2xl bg-emerald-50 p-3 text-emerald-700">25 câu</span>
              <span className="rounded-2xl bg-amber-50 p-3 text-amber-700">{playable.timeLimitMinutes ? `${playable.timeLimitMinutes} phút` : 'Không giới hạn'}</span>
            </div>
            {error && <p className="mt-3 text-xs font-bold text-rose-600">{error}</p>}
            <div className="mt-6 flex gap-3">
              <button id="listening-prestart-back-btn" onClick={onBack} className="listening-secondary-action flex-1 rounded-2xl border border-slate-200 py-3 font-black text-slate-600"><ArrowLeft size={16} className="mr-1 inline" /> Quay lại</button>
              <button id="listening-start-btn" onClick={() => void start()} className="listening-start-action flex-1 rounded-2xl bg-rose-500 py-3 font-black text-white shadow-lg shadow-rose-200">Bắt đầu nghe</button>
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (result && showReview && review) {
    return (
      <div id="listening-review-screen" className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-300 to-emerald-100 p-3 sm:p-5">
        <div className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] border-4 border-white bg-white shadow-2xl sm:max-h-[calc(100vh-2.5rem)]">
          <header className="shrink-0 border-b border-slate-200 px-5 py-4 text-left sm:px-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[.16em] text-blue-600">Đáp án sau khi nộp</p>
                <h1 className="mt-1 text-2xl font-black text-slate-900">Kết quả chi tiết</h1>
              </div>
              <div className="rounded-2xl bg-blue-50 px-5 py-2 text-center">
                <span className="text-3xl font-black text-blue-700">{review.score}</span>
                <span className="font-black text-slate-400">/100</span>
              </div>
            </div>
          </header>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4 sm:p-6">
            {review.visualReview ? <ListeningVisualReview snapshot={review.visualReview} transcripts={review.transcripts} /> : review.answerDetails.map((item, index) => (
              <article key={`${item.part}-${item.questionIndex}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-wide text-blue-600">Part {item.part} · Câu {review.answerDetails.slice(0, index + 1).filter(answer => answer.part === item.part).length}</p>
                    <h2 className="mt-1 font-black text-slate-900">{item.questionText}</h2>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-black ${item.unanswered ? 'bg-amber-100 text-amber-800' : item.isCorrect ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                    {item.unanswered ? 'Bỏ trống' : item.isCorrect ? 'Đúng' : 'Sai'}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <p className="rounded-xl bg-slate-50 px-3 py-2"><span className="font-bold text-slate-500">Bạn trả lời:</span> <span className="font-black text-slate-800">{item.userAnswer || 'Bỏ trống'}</span></p>
                  <p className="rounded-xl bg-emerald-50 px-3 py-2"><span className="font-bold text-emerald-700">Đáp án đúng:</span> <span className="font-black text-emerald-900">{item.correctAnswer || 'Chưa có dữ liệu hiển thị'}</span></p>
                </div>
              </article>
            ))}
          </div>
          <footer className="grid shrink-0 gap-2 border-t border-slate-200 bg-white p-4 sm:grid-cols-2 sm:px-6">
            <button id="listening-review-back-btn" type="button" onClick={() => setShowReview(false)} className="listening-secondary-action rounded-2xl border border-blue-300 py-3 font-black text-blue-700"><ArrowLeft size={16} className="mr-2 inline" /> Quay lại tổng kết</button>
            <button id="listening-review-retry-btn" type="button" onClick={() => void start(true)} className="listening-retry-action rounded-2xl bg-emerald-600 py-3 font-black text-white"><RotateCcw size={16} className="mr-2 inline" /> Làm lại</button>
          </footer>
        </div>
      </div>
    );
  }
  if (result) {
    return (
      <div id="listening-result-screen" className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-300 to-emerald-100 p-4">
        <div className="w-full max-w-xl rounded-[2rem] border-4 border-white bg-white p-8 text-center shadow-2xl">
          <Trophy size={64} className="mx-auto text-amber-500" />
          <p className="mt-3 text-xs font-black uppercase tracking-[.2em] text-blue-600">Đã nộp bài thành công</p>
          <h1 className="mt-2 text-5xl font-black text-slate-900">{result.score}<span className="text-xl text-slate-400">/100</span></h1>
          <div className="mt-6 grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-emerald-50 p-3"><p className="text-2xl font-black text-emerald-700">{result.correctCount}</p><p className="text-xs font-bold text-emerald-600">Đúng</p></div>
            <div className="rounded-2xl bg-rose-50 p-3"><p className="text-2xl font-black text-rose-700">{result.incorrectCount}</p><p className="text-xs font-bold text-rose-600">Sai</p></div>
            <div className="rounded-2xl bg-amber-50 p-3"><p className="text-2xl font-black text-amber-700">{result.unansweredCount}</p><p className="text-xs font-bold text-amber-600">Bỏ trống</p></div>
          </div>
          {error && <p className="mt-4 text-sm font-bold text-rose-600">{error}</p>}
          <div className="mt-7 grid gap-3">
            <button id="listening-result-home-btn" type="button" onClick={onBack} className="listening-primary-action w-full rounded-2xl bg-blue-600 py-3 font-black text-white"><Home size={16} className="mr-2 inline" /> Về trang chủ</button>
            <button id="listening-result-review-btn" type="button" onClick={() => void openReview()} disabled={reviewLoading} className="listening-review-action w-full rounded-2xl border border-blue-300 bg-white py-3 font-black text-blue-700">
              {reviewLoading ? <LoaderCircle size={16} className="mr-2 inline animate-spin" /> : <Eye size={16} className="mr-2 inline" />} Xem kết quả
            </button>
            <button id="listening-result-retry-btn" type="button" onClick={() => void start(true)} className="listening-retry-action w-full rounded-2xl bg-emerald-600 py-3 font-black text-white"><RotateCcw size={16} className="mr-2 inline" /> Làm lại</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id="listening-exam-root" className="min-h-screen bg-gradient-to-b from-sky-300 via-sky-100 to-emerald-100 p-2 sm:p-4" style={backgroundStyle}>
      <header className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-3 px-1 py-2 text-white">
        <div className="rounded-2xl bg-sky-700/80 px-5 py-2 shadow"><p className="text-lg font-black">{playable.level}</p><p className="text-[10px] font-black uppercase">Listening • Part {currentPart + 1}</p></div>
        <div className="order-3 h-4 w-full flex-1 overflow-hidden rounded-full border-2 border-slate-600 bg-orange-500 sm:order-none sm:w-auto"><div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${(progress / 25) * 100}%` }} /></div>
        <button id="listening-fullscreen-btn" type="button" title="Phóng to toàn màn hình" aria-label="Phóng to toàn màn hình" onClick={() => document.documentElement.requestFullscreen?.()} className="listening-icon-action rounded-xl bg-sky-700/80 p-3"><Expand size={18} /></button>
        {remainingSeconds !== null && <div className={`rounded-2xl px-5 py-2 text-right shadow ${remainingSeconds <= 60 ? 'bg-rose-600' : 'bg-sky-700/80'}`}><p className="text-[10px] font-bold">Thời gian còn lại</p><p className="text-xl font-black">{formatTime(remainingSeconds)}</p></div>}
        <div className="rounded-2xl bg-sky-700/80 px-4 py-2 text-xs font-black">{progress}/25 câu</div>
      </header>
      <main className="mx-auto max-w-[1500px] rounded-[1.75rem] border-[10px] border-sky-700 bg-white p-3 shadow-2xl sm:p-6">
        <div className="mb-4 flex flex-col items-center gap-3 rounded-2xl border-2 border-orange-300 bg-slate-50 p-4 text-center">
          <p className="text-lg font-black uppercase text-slate-950">{part?.instruction}</p>
          {part?.audioUrl && <audio src={part.audioUrl} controls controlsList="nodownload" className="h-10 w-full max-w-4xl" />}
        </div>
        <div className={partUsesInternalScroller
          ? 'h-[calc(100vh-290px)] min-h-[400px] overflow-hidden p-1'
          : 'max-h-[calc(100vh-290px)] min-h-[400px] overflow-y-auto p-1'}>{partViews[currentPart]}</div>
      </main>
      <footer className="mx-auto mt-3 flex max-w-[1500px] items-center justify-between gap-3">
        <button id="listening-prev-part-btn" type="button" aria-label={currentPart === 0 ? 'Quay lại' : 'Part trước'} onClick={() => currentPart === 0 ? onBack() : setCurrentPart(value => value - 1)} className="listening-part-arrow flex h-14 w-14 items-center justify-center rounded-full border-4 border-white bg-rose-500 text-white shadow-lg"><ChevronLeft size={28} /></button>
        <div className="flex gap-2">
          {playable.content.parts.map((item, index) => <button key={item.part} type="button" aria-label={`Mở Part ${item.part}`} aria-current={currentPart === index ? 'step' : undefined} data-active={currentPart === index ? 'true' : 'false'} onClick={() => setCurrentPart(index)} className={`listening-part-step h-9 w-9 rounded-full text-xs font-black ${currentPart === index ? 'bg-blue-700 text-white' : 'bg-white text-slate-500'}`}>{item.part}</button>)}
        </div>
        {currentPart < 4 ? (
          <button id="listening-next-part-btn" type="button" aria-label="Part tiếp theo" onClick={() => setCurrentPart(value => value + 1)} className="listening-part-arrow flex h-14 w-14 items-center justify-center rounded-full border-4 border-white bg-rose-500 text-white shadow-lg"><ChevronRight size={28} /></button>
        ) : (
          <button id="listening-submit-btn" disabled={submitting} onClick={() => void submit()} className="inline-flex items-center gap-2 rounded-2xl border-4 border-white bg-emerald-600 px-5 py-3 font-black text-white shadow-lg disabled:opacity-50">
            {submitting ? <LoaderCircle className="animate-spin" size={18} /> : <Send size={18} />} Nộp bài
          </button>
        )}
      </footer>
      {error && <div className="fixed bottom-4 left-1/2 z-50 max-w-xl -translate-x-1/2 rounded-2xl border border-rose-200 bg-white px-5 py-3 text-center text-xs font-black text-rose-700 shadow-xl">{error}</div>}
      <button title="Gợi ý" className="fixed right-4 top-28 flex h-12 w-12 items-center justify-center rounded-full border-4 border-white bg-rose-500 text-amber-200 shadow-lg"><Lightbulb size={22} /></button>
    </div>
  );
}
