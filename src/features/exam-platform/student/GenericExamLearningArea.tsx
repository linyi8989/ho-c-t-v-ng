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
import ExamSplitTaskLayout from '../../exam-media/ExamSplitTaskLayout';
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
  ExamQuestionAnswerValue,
} from '../types';
import { isExamMatchingConnection } from '../starterMatching';
import { examPartUnits } from '../examStructure';
import { isFixedKetListeningContent } from '../ketListeningMigration';
import StarterInteractionView, { StarterListeningPart3View, StarterListeningPart4View } from './StarterInteractions';
import StarterListeningResult from './StarterListeningResult';
import ExamImageViewer from './ExamImageViewer';
import StarterReadingWritingPartView from './StarterReadingWritingViews';
import StarterReadingWritingResult from './StarterReadingWritingResult';
import { resolveExamImageProfile, resolveExamTaskLayout } from './examPresentation';
import FlyerListeningPartView from './FlyerListeningViews';
import FlyerReadingWritingPartView from './FlyerReadingWritingViews';
import FlyerReadingWritingResult from './FlyerReadingWritingResult';
import KetReadingWritingPartView from './KetReadingWritingViews';
import KetReadingWritingResult from './KetReadingWritingResult';
import KetListeningPartView from './KetListeningViews';

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
const answerContribution = (value: ExamAnswerValue | undefined) => Array.isArray(value) && value.some(isExamMatchingConnection)
  ? value.filter(isExamMatchingConnection).length
  : answerPresent(value) ? 1 : 0;
const questionAnswerValue = (value: ExamAnswerValue | undefined): ExamQuestionAnswerValue | undefined => {
  if (typeof value === 'string') return value;
  return Array.isArray(value) && value.every(item => typeof item === 'string') ? value : undefined;
};
const wordCount = (value: string) => value.trim() ? value.trim().split(/\s+/).length : 0;

function QuestionView({ question, value, onChange }: { key?: string; question: ExamQuestion; value?: ExamQuestionAnswerValue; onChange: (value: ExamQuestionAnswerValue) => void }) {
  const selected = Array.isArray(value) ? value : value ? [value] : [];
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" data-question-type={question.type}>
      <div className="flex items-start gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-black text-indigo-800">{question.number}</span><div className="min-w-0 flex-1"><p className="whitespace-pre-wrap text-sm font-bold leading-6 text-slate-900">{question.prompt}</p>{question.context && <p className="mt-2 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-sm font-semibold leading-6 text-slate-600">{question.context}</p>}{question.imageUrl && <div className="mt-3"><ExamImageViewer src={question.imageUrl} alt={`Ảnh câu ${question.number}`} profile="illustration" className="border border-slate-200 bg-white" /></div>}</div></div>
      {['single-choice', 'true-false', 'true-false-not-given', 'yes-no-not-given', 'matching'].includes(question.type) && <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{question.options.map(option => <label key={option.id} className={`cursor-pointer rounded-xl border p-3 text-sm font-bold ${selected.includes(option.id) ? 'border-indigo-500 bg-indigo-50 text-indigo-900 ring-2 ring-indigo-100' : 'border-slate-200 bg-white text-slate-700'}`}><input type="radio" name={`answer-${question.id}`} value={option.id} checked={selected.includes(option.id)} onChange={() => onChange(option.id)} className="mr-2" />{option.imageUrl && <img src={option.imageUrl} alt={option.text || option.label} className="exam-platform-option-image mx-auto mb-2 block w-full rounded-lg object-contain" />}<span className="mr-1 text-indigo-700">{option.label}.</span>{option.text}</label>)}</div>}
      {question.type === 'multiple-choice' && <div className="mt-4 grid gap-2 sm:grid-cols-2">{question.options.map(option => <label key={option.id} className={`cursor-pointer rounded-xl border p-3 text-sm font-bold ${selected.includes(option.id) ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200'}`}><input type="checkbox" checked={selected.includes(option.id)} onChange={event => onChange(event.target.checked ? [...selected, option.id] : selected.filter(id => id !== option.id))} className="mr-2" /><span className="mr-1 text-indigo-700">{option.label}.</span>{option.text}</label>)}</div>}
      {question.type === 'short-answer' && <input value={Array.isArray(value) ? value.join(' ') : value || ''} onChange={event => onChange(event.target.value)} className="mt-4 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" placeholder={question.maxWords ? `Tối đa ${question.maxWords} từ` : 'Nhập câu trả lời'} />}
      {question.type === 'long-writing' && <div className="mt-4"><textarea value={Array.isArray(value) ? value.join(' ') : value || ''} onChange={event => onChange(event.target.value)} className="min-h-64 w-full rounded-xl border border-slate-300 p-4 text-sm font-semibold leading-6 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" placeholder="Viết bài của bạn tại đây…" /><p className={`mt-2 text-right text-xs font-black ${wordCount(String(value || '')) >= Number(question.minWords || 0) ? 'text-emerald-700' : 'text-amber-700'}`}>{wordCount(String(value || ''))}/{question.minWords || 0} từ tối thiểu</p>{question.rubric && <details className="mt-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600"><summary className="cursor-pointer font-black">Tiêu chí chấm</summary><p className="mt-2 whitespace-pre-wrap font-semibold leading-5">{question.rubric}</p></details>}</div>}
    </article>
  );
}

function PartView({ moduleId, paperId, part, answers, onAnswer, starterListening = false, flyerListening = false, ketListening = false, starterReadingWriting = false, flyerReadingWriting = false, ketReadingWriting = false }: { moduleId: Exclude<ExamModuleId, 'mover'>; paperId: ExamPaperId; part: ExamPartContent; answers: ExamAnswers; onAnswer: (questionId: string, value: ExamAnswerValue) => void; starterListening?: boolean; flyerListening?: boolean; ketListening?: boolean; starterReadingWriting?: boolean; flyerReadingWriting?: boolean; ketReadingWriting?: boolean }) {
  if (starterReadingWriting) return <StarterReadingWritingPartView part={part} answers={answers} onAnswer={onAnswer} />;
  if (flyerReadingWriting) return <FlyerReadingWritingPartView part={part} answers={answers} onAnswer={onAnswer} />;
  if (ketReadingWriting) return <KetReadingWritingPartView part={part} answers={answers} onAnswer={onAnswer} />;
  if (ketListening) return <KetListeningPartView part={part} answers={answers} onAnswer={onAnswer} />;
  if (flyerListening) return <FlyerListeningPartView part={part} answers={answers} onAnswer={onAnswer} />;
  if (starterListening && part.part === 3) return <StarterListeningPart3View part={part} answers={answers} onAnswer={onAnswer} />;
  if (starterListening && part.part === 4) return <StarterListeningPart4View part={part} answers={answers} onAnswer={onAnswer} />;
  const units = examPartUnits(part);
  return <div className="space-y-6">{units.map((unit, index) => {
    const special = (unit.interaction?.family === 'text-entry' && (unit.interaction.variant === 'single-input' || (starterListening && part.part === 2 && unit.interaction.variant === 'inline-gap')))
      || (starterListening && part.part === 3 && unit.interaction?.variant === 'image-options')
      || unit.interactionLayout?.kind === 'starter-image-matching-v1'
      || unit.interactionLayout?.kind === 'starter-image-matching-v2'
      || unit.interactionLayout?.kind === 'starter-scene-colour-v1'
      || unit.interactionLayout?.kind === 'scene-draw-v1'
      || unit.interactionLayout?.kind === 'image-text-entry-v1';
    const imageProfile = resolveExamImageProfile({
      moduleId,
      paperId,
      partNumber: part.part,
      mediaRole: 'part',
      interaction: unit.interaction,
      interactionLayout: unit.interactionLayout,
    });
    const partImage = !special && unit.imageUrl
      ? <ExamImageViewer src={unit.imageUrl} alt={`Ảnh Part ${unit.part}`} profile={imageProfile} className="border border-slate-200 bg-white" />
      : null;
    const passage = unit.passage ? <div className="rounded-2xl border border-slate-200 bg-white p-5 whitespace-pre-wrap text-sm font-semibold leading-7 text-slate-700">{unit.passage}</div> : null;
    const answerContent = <>
      {unit.audioUrl && !starterListening && <audio controls preload="metadata" src={unit.audioUrl} className="w-full" />}
      {special ? <StarterInteractionView part={unit} answers={answers} onAnswer={onAnswer} /> : unit.questions.map(question => <QuestionView key={question.id} question={question} value={questionAnswerValue(answers[question.id])} onChange={value => onAnswer(question.id, value)} />)}
    </>;
    const taskContent = <>{passage}{answerContent}</>;
    const taskLayout = resolveExamTaskLayout({ moduleId, paperId, partNumber: part.part });
    return <section key={unit.id} className={units.length > 1 ? 'rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5' : ''} data-exam-block={index + 1}>
      {units.length > 1 && <div className="mb-4"><p className="text-[10px] font-black uppercase tracking-wide text-violet-600">Dạng bài {index + 1} · {unit.interaction?.family} → {unit.interaction?.subtype} → {unit.interaction?.variant}</p><h3 className="mt-1 text-lg font-black text-slate-900">{unit.title}</h3>{unit.instruction && <p className="mt-1 text-sm font-semibold text-slate-500">{unit.instruction}</p>}</div>}
      {taskLayout === 'split-task' && partImage
        ? <ExamSplitTaskLayout media={partImage}>{taskContent}</ExamSplitTaskLayout>
        : <div className="space-y-4">{passage}{partImage}{answerContent}</div>}
    </section>;
  })}</div>;
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
  const automaticSubmitStarted = useRef(false);
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
      automaticSubmitStarted.current = false;
      setRun(next); setAnswers({}); setCurrentPart(0); setReview(null); setReviewRunSecret(''); if (replaceResult) setResult(null);
    } catch (reason: any) { setError(reason.message); }
    finally { setLoading(false); }
  };

  const totalQuestions = playable?.content.parts.reduce((sum, part) => sum + part.questions.length, 0) || definition.totalQuestionCount;
  const answered = (Object.values(answers) as ExamAnswerValue[]).reduce<number>((sum, value) => sum + answerContribution(value), 0);
  const submit = async (automatic = false) => {
    if (!run || submitGuard.current) return;
    if (!automatic && answered < totalQuestions && !window.confirm(`Bạn mới trả lời ${answered}/${totalQuestions} câu/task. Vẫn nộp bài?`)) return;
    submitGuard.current = true; setSubmitting(true); setError('');
    const pending = { ...run, answers, currentPart, submissionPending: true };
    let activePending = pending;
    setRun(pending);
    try {
      if (activeStorageKey) window.localStorage.setItem(activeStorageKey, JSON.stringify(pending));
      let completed: ExamCompletedAttempt;
      try {
        completed = await examPlatformApi.submit(moduleId, paperId, setId, token, { ticket: pending.ticket, runSecret: pending.runSecret, guestId, studentName, answers });
      } catch (reason: any) {
        if (Number(reason?.status) !== 410) throw reason;
        const renewed = await examPlatformApi.renewAttempt(moduleId, paperId, setId, token, { ticket: pending.ticket, runSecret: pending.runSecret, guestId, studentName });
        if (renewed.clientRunId !== pending.clientRunId || renewed.versionId !== pending.versionId) {
          throw Object.assign(new Error('Phiếu khôi phục không khớp lượt làm bài đã lưu.'), { status: 409 });
        }
        activePending = {
          ...pending,
          ticket: renewed.ticket,
          startedAt: renewed.startedAt,
          deadlineAt: renewed.deadlineAt,
        };
        setRun(activePending);
        if (activeStorageKey) window.localStorage.setItem(activeStorageKey, JSON.stringify(activePending));
        completed = await examPlatformApi.submit(moduleId, paperId, setId, token, { ticket: activePending.ticket, runSecret: activePending.runSecret, guestId, studentName, answers });
      }
      setReviewRunSecret(activePending.runSecret); setResult(completed); setRun(null); if (activeStorageKey) window.localStorage.removeItem(activeStorageKey);
    } catch (reason: any) {
      const status = Number(reason?.status);
      const retryable = !Number.isFinite(status) || status >= 500 || [408, 425, 429].includes(status);
      const retained = { ...activePending, submissionPending: retryable };
      const suffix = retryable
        ? 'Câu trả lời đã được lưu; bạn có thể nộp lại với cùng lượt làm bài.'
        : 'Câu trả lời vẫn được lưu trên thiết bị, nhưng lượt này không thể tự nộp lại. Vui lòng bắt đầu lượt mới khi cần.';
      setError(`${automatic ? 'Hết giờ. ' : ''}${reason.message} ${suffix}`);
      setRun(retained);
      if (activeStorageKey) window.localStorage.setItem(activeStorageKey, JSON.stringify(retained));
    }
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
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((new Date(run.deadlineAt!).getTime() - Date.now()) / 1000));
      setRemainingSeconds(remaining);
      if (remaining === 0 && !automaticSubmitStarted.current) {
        automaticSubmitStarted.current = true;
        void submit(true);
      }
    };
    tick(); const timer = window.setInterval(tick, 1000); return () => window.clearInterval(timer);
  }, [run?.deadlineAt, result, answers, currentPart]);
  useEffect(() => { if (run?.submissionPending && !submitting && !result) void submit(); }, [run?.clientRunId]);

  if (loading || authLoading) return <div id="generic-exam-player" className="flex min-h-screen items-center justify-center bg-slate-50"><LoaderCircle className="animate-spin text-indigo-600" size={38} /></div>;
  if (!playable) return <div id="generic-exam-player" className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-6 text-center"><p className="font-black text-rose-700">{error || 'Không tìm thấy bộ đề.'}</p><button type="button" onClick={onBack} className="exam-platform-secondary-action rounded-xl border border-slate-200 bg-white px-5 py-3 font-black">Quay lại</button></div>;
  if (!identityReady) return <main id="generic-exam-player" className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-100 to-sky-50 p-5"><div className="w-full max-w-md rounded-3xl border border-white bg-white p-7 shadow-xl"><BookOpenText className="text-indigo-600" size={34} /><h1 className="mt-4 text-2xl font-black text-slate-900">Nhập tên để bắt đầu</h1><p className="mt-2 text-sm font-semibold text-slate-500">Tên được dùng để lưu kết quả học tập.</p><input value={studentName} onChange={event => setStudentName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void persistName(); }} className="mt-5 w-full rounded-xl border border-slate-300 px-4 py-3 font-bold" placeholder="Tên học sinh" />{error && <p className="mt-3 text-sm font-bold text-rose-700">{error}</p>}<button type="button" onClick={() => void persistName()} className="exam-platform-primary-action mt-5 w-full rounded-xl bg-indigo-600 px-4 py-3 font-black text-white">Tiếp tục</button></div></main>;

  if (result && moduleId === 'starter' && paperId === 'listening') return <StarterListeningResult result={result} review={review} playable={playable} answers={answers} reviewLoading={reviewLoading} error={error} onReview={() => void loadReview()} onRetry={() => void start(true)} onBack={onBack} />;
  if (result && moduleId === 'flyer' && paperId === 'listening') return <StarterListeningResult result={result} review={review} playable={playable} answers={answers} reviewLoading={reviewLoading} error={error} onReview={() => void loadReview()} onRetry={() => void start(true)} onBack={onBack} />;
  if (result && isFixedKetListeningContent(playable.content)) return <StarterListeningResult result={result} review={review} playable={playable} answers={answers} reviewLoading={reviewLoading} error={error} onReview={() => void loadReview()} onRetry={() => void start(true)} onBack={onBack} />;
  if (result && moduleId === 'starter' && paperId === 'reading-writing') return <StarterReadingWritingResult result={result} review={review} playable={playable} answers={answers} reviewLoading={reviewLoading} error={error} onReview={() => void loadReview()} onRetry={() => void start(true)} onBack={onBack} />;
  if (result && moduleId === 'flyer' && paperId === 'reading-writing') return <FlyerReadingWritingResult result={result} review={review} playable={playable} reviewLoading={reviewLoading} error={error} onReview={() => void loadReview()} onRetry={() => void start(true)} onBack={onBack} />;
  if (result && moduleId === 'ket' && paperId === 'reading-writing' && playable.content.parts.length === 9) return <KetReadingWritingResult result={result} review={review} playable={playable} reviewLoading={reviewLoading} error={error} onReview={() => void loadReview()} onRetry={() => void start(true)} onBack={onBack} />;
  if (result) return <main id="generic-exam-player" className="min-h-screen bg-gradient-to-b from-indigo-100 via-white to-sky-50 p-4 sm:p-8"><div className="mx-auto max-w-6xl space-y-6"><section className="rounded-3xl border border-white bg-white p-7 text-center shadow-xl">{result.status === 'pending_review' ? <FileClock className="mx-auto text-violet-600" size={54} /> : <Trophy className="mx-auto text-amber-500" size={54} />}<p className="mt-4 text-xs font-black uppercase tracking-[.2em] text-indigo-600">{result.status === 'pending_review' ? 'Đã nộp · Chờ giáo viên chấm Writing' : 'Hoàn thành'}</p><h1 className="mt-2 text-3xl font-black text-slate-900">{playable.title}</h1>{result.status === 'pending_review' ? <><p className="mt-5 text-4xl font-black text-violet-700">Điểm khách quan: {result.objectiveScore}</p><p className="mt-2 text-sm font-bold text-slate-500">{result.pendingManualCount} bài viết đang chờ chấm. Điểm tổng sẽ có sau khi giáo viên xác nhận.</p></> : <><p className="mt-5 text-6xl font-black text-indigo-700">{result.score}</p><p className="mt-2 text-sm font-bold text-slate-500">Đúng {result.correctCount} · Sai {result.incorrectCount} · Bỏ trống {result.unansweredCount}</p></>}<div className="mt-6 flex flex-wrap justify-center gap-3">{result.status === 'completed' && playable.content.showReviewAfterSubmit && <button type="button" disabled={reviewLoading} onClick={() => void loadReview()} className="exam-platform-result-review inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-5 py-3 font-black text-indigo-700"><Eye size={17} />{reviewLoading ? 'Đang tải…' : 'Xem đáp án'}</button>}<button type="button" onClick={() => void start(true)} className="exam-platform-result-retry inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 font-black text-white"><RotateCcw size={17} />Làm lại</button><button type="button" onClick={onBack} className="exam-platform-result-home rounded-xl border border-slate-200 bg-white px-5 py-3 font-black text-slate-700">Quay lại</button></div>{error && <p className="mt-4 font-bold text-rose-700">{error}</p>}</section>{review && <section className="rounded-3xl border border-slate-200 bg-white p-5"><h2 className="mb-4 text-xl font-black text-slate-900">Chi tiết kết quả</h2><div className="grid gap-3 md:grid-cols-2">{review.questions.map(question => <article key={question.questionId} className={`rounded-2xl border p-4 text-sm ${question.correct ? 'border-emerald-200 bg-emerald-50' : question.unanswered ? 'border-amber-200 bg-amber-50' : 'border-rose-200 bg-rose-50'}`}><p className="text-xs font-black uppercase text-slate-600">Part {question.part} · Câu {question.number}</p><p className="mt-2 font-bold text-slate-900">{question.prompt}</p><p className="mt-2 text-slate-700">Bạn trả lời: <b>{Array.isArray(question.userAnswer) ? question.userAnswer.join(', ') : question.userAnswer || 'Bỏ trống'}</b></p>{!question.correct && <p className="mt-1 text-emerald-800">Đáp án đúng: <b>{Array.isArray(question.correctAnswer) ? question.correctAnswer.join(', ') : question.correctAnswer}</b></p>}</article>)}</div>{review.transcripts?.length ? <div className="mt-5 space-y-3">{review.transcripts.map(item => <details key={item.part} className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-left"><summary className="cursor-pointer text-sm font-black text-sky-900">Nội dung bài nghe · Part {item.part}</summary><p className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-700">{item.text}</p></details>)}</div> : null}</section>}</div></main>;

  if (!run) return <main id="generic-exam-player" className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-100 via-white to-sky-50 p-5"><section className="w-full max-w-3xl rounded-3xl border border-white bg-white p-8 text-center shadow-xl">{playable.coverUrl ? <div className="mb-6"><ExamImageViewer src={playable.coverUrl} alt={`Ảnh bìa ${playable.title}`} profile="cover" /></div> : paperId === 'listening' ? <Headphones className="mx-auto text-sky-600" size={52} /> : <BookOpenText className="mx-auto text-indigo-600" size={52} />}<p className="mt-4 text-xs font-black uppercase tracking-[.2em] text-indigo-600">{definition.level} · {definition.displayName}</p><h1 className="mt-2 text-3xl font-black text-slate-900">{playable.title}</h1><p className="mx-auto mt-3 max-w-xl text-sm font-semibold leading-6 text-slate-500">{playable.description}</p><div className="mt-5 flex flex-wrap justify-center gap-2 text-xs font-black text-slate-700"><span className="rounded-full bg-indigo-50 px-3 py-2">{playable.content.parts.length} Part/Section</span><span className="rounded-full bg-indigo-50 px-3 py-2">{totalQuestions} câu/task</span><span className="rounded-full bg-indigo-50 px-3 py-2">{playable.timeLimitMinutes ? `${playable.timeLimitMinutes} phút` : 'Không giới hạn'}</span></div>{error && <p className="mt-4 font-bold text-rose-700">{error}</p>}<div className="mt-7 flex justify-center gap-3"><button type="button" onClick={onBack} className="exam-platform-secondary-action rounded-xl border border-slate-200 bg-white px-5 py-3 font-black text-slate-700"><ArrowLeft size={17} className="mr-2 inline" />Quay lại</button><button type="button" onClick={() => void start()} className="exam-platform-primary-action rounded-xl bg-indigo-600 px-7 py-3 font-black text-white">Bắt đầu</button></div></section></main>;

  const activePart = playable.content.parts[currentPart];
  const ketListening = isFixedKetListeningContent(playable.content);
  if (((moduleId === 'starter' || moduleId === 'flyer') && paperId === 'listening') || ketListening) return <main id="listening-exam-root" className="min-h-screen bg-gradient-to-b from-sky-300 via-sky-100 to-emerald-100 p-2 sm:p-4">
    <header className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-3 px-1 py-2 text-white">
      <div className="rounded-2xl bg-sky-700/80 px-5 py-2 shadow"><p className="text-lg font-black">{ketListening ? 'KET' : moduleId === 'flyer' ? 'Flyers' : 'Starters'}</p><p className="text-[10px] font-black uppercase">Listening · Part {currentPart + 1}</p></div>
      <div className="order-3 h-4 w-full flex-1 overflow-hidden rounded-full border-2 border-slate-600 bg-orange-500 sm:order-none sm:w-auto"><div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${totalQuestions ? answered / totalQuestions * 100 : 0}%` }} /></div>
      {remainingSeconds !== null && <div className={`rounded-2xl px-5 py-2 text-right shadow ${remainingSeconds <= 60 ? 'bg-rose-600' : 'bg-sky-700/80'}`}><p className="text-[10px] font-bold">Thời gian còn lại</p><p className="text-xl font-black">{formatTime(remainingSeconds)}</p></div>}
      <div className="rounded-2xl bg-sky-700/80 px-4 py-2 text-xs font-black">{answered}/{totalQuestions} câu</div>
    </header>
    <section className="mx-auto max-w-[1500px] rounded-[1.75rem] border-[10px] border-sky-700 bg-white p-3 shadow-2xl sm:p-6">
      <div className="mb-4 flex flex-col items-center gap-3 rounded-2xl border-2 border-orange-300 bg-slate-50 p-4 text-center"><p className="text-lg font-black uppercase text-slate-950">{activePart.instruction}</p>{activePart.audioUrl && <audio src={activePart.audioUrl} controls controlsList="nodownload" className="h-10 w-full max-w-4xl" />}</div>
      <div className={!ketListening && (moduleId === 'flyer' ? [1, 5].includes(activePart.part) : [1, 4].includes(activePart.part)) ? 'h-[calc(100dvh-290px)] min-h-[400px] overflow-hidden p-1' : 'max-h-[calc(100dvh-290px)] min-h-[400px] overflow-y-auto p-1'}><PartView moduleId={moduleId} paperId={paperId} part={activePart} answers={answers} starterListening={moduleId === 'starter' && !ketListening} flyerListening={moduleId === 'flyer'} ketListening={ketListening} onAnswer={(questionId, value) => setAnswers(previous => ({ ...previous, [questionId]: value }))} /></div>
    </section>
    <footer className="mx-auto mt-3 flex max-w-[1500px] items-center justify-between gap-3">
      <button type="button" aria-label={currentPart === 0 ? 'Quay lại' : 'Part trước'} onClick={() => currentPart === 0 ? onBack() : setCurrentPart(value => value - 1)} className="listening-part-arrow flex h-14 w-14 items-center justify-center rounded-full border-4 border-white bg-rose-500 text-white shadow-lg"><ChevronLeft size={28} /></button>
      <div className="flex gap-2">{playable.content.parts.map((part, index) => <button key={part.id} type="button" aria-label={`Mở Part ${part.part}`} data-active={currentPart === index ? 'true' : 'false'} onClick={() => setCurrentPart(index)} className={`listening-part-step h-9 w-9 rounded-full text-xs font-black ${currentPart === index ? 'bg-blue-700 text-white' : 'bg-white text-slate-500'}`}>{part.part}</button>)}</div>
      {currentPart < playable.content.parts.length - 1 ? <button type="button" aria-label="Part tiếp theo" onClick={() => setCurrentPart(value => value + 1)} className="listening-part-arrow flex h-14 w-14 items-center justify-center rounded-full border-4 border-white bg-rose-500 text-white shadow-lg"><ChevronRight size={28} /></button> : <button type="button" disabled={submitting} onClick={() => void submit()} className="inline-flex items-center gap-2 rounded-2xl border-4 border-white bg-emerald-600 px-5 py-3 font-black text-white shadow-lg disabled:opacity-50"><Send size={18} />Nộp bài</button>}
    </footer>
    {error && <div className="fixed bottom-4 left-1/2 z-50 max-w-xl -translate-x-1/2 rounded-2xl border border-rose-200 bg-white px-5 py-3 text-center text-xs font-black text-rose-700 shadow-xl">{error}</div>}
  </main>;
  return <main id="generic-exam-player" className="min-h-screen bg-slate-100"><header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-3 py-3 shadow-sm backdrop-blur sm:px-6"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-indigo-600">{definition.level} · {definition.displayName}</p><h1 className="text-base font-black text-slate-900">{playable.title}</h1></div><div className="flex items-center gap-3 text-xs font-black text-slate-600"><span>{answered}/{totalQuestions}</span>{remainingSeconds !== null && <span className="inline-flex items-center gap-1 rounded-xl bg-amber-50 px-3 py-2 text-amber-800"><Clock3 size={14} />{formatTime(remainingSeconds)}</span>}<button type="button" disabled={submitting} onClick={() => void submit()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-white"><Send size={15} />Nộp bài</button></div></div></header><div className="mx-auto max-w-7xl p-3 sm:p-6"><div className="mb-4 flex gap-2 overflow-x-auto pb-1" role="tablist">{playable.content.parts.map((part, index) => <button key={part.id} type="button" role="tab" aria-selected={currentPart === index} onClick={() => setCurrentPart(index)} data-active={currentPart === index ? 'true' : 'false'} className={`exam-platform-part-tab shrink-0 rounded-xl px-4 py-2.5 text-xs font-black ${currentPart === index ? 'bg-indigo-600 text-white shadow-md' : 'border border-slate-200 bg-white text-indigo-800'}`}>{index < currentPart ? <CheckCircle2 size={13} className="mr-1 inline" /> : null}Part {index + 1}</button>)}</div>{error && <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</div>}<section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"><div className="mb-5"><p className="text-xs font-black uppercase text-indigo-600">Part {activePart.part}</p><h2 className="mt-1 text-2xl font-black text-slate-900">{activePart.title}</h2><p className="mt-2 text-sm font-semibold text-slate-500">{activePart.instruction}</p></div><PartView moduleId={moduleId} paperId={paperId} part={activePart} answers={answers} starterReadingWriting={moduleId === 'starter' && paperId === 'reading-writing'} flyerReadingWriting={moduleId === 'flyer' && paperId === 'reading-writing'} ketReadingWriting={moduleId === 'ket' && paperId === 'reading-writing' && playable.content.parts.length === 9} onAnswer={(questionId, value) => setAnswers(previous => ({ ...previous, [questionId]: value }))} /></section><div className="mt-5 flex items-center justify-between"><button type="button" disabled={currentPart === 0} onClick={() => setCurrentPart(value => Math.max(0, value - 1))} data-direction="previous" className="exam-platform-part-nav inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 font-black text-slate-700"><ChevronLeft size={17} />Part trước</button><button type="button" disabled={currentPart === playable.content.parts.length - 1} onClick={() => setCurrentPart(value => Math.min(playable.content.parts.length - 1, value + 1))} data-direction="next" className="exam-platform-part-nav inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 font-black text-white">Part sau<ChevronRight size={17} /></button></div></div></main>;
}
