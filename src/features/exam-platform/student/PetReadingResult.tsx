import { ChevronLeft, Eye, Home, LoaderCircle, RotateCcw, Trophy } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ExamAttemptReview, ExamCompletedAttempt, ExamPlayableSet } from '../types';
import PetReadingPartView from './PetReadingViews';

interface Props {
  result: ExamCompletedAttempt;
  review: ExamAttemptReview | null;
  playable: ExamPlayableSet;
  reviewLoading: boolean;
  error: string;
  onReview: () => void;
  onRetry: () => void;
  onBack: () => void;
}

function DetailedReview({ playable, review, onBack }: { playable: ExamPlayableSet; review: ExamAttemptReview; onBack: () => void }) {
  const [activePart, setActivePart] = useState(playable.content.parts[0]?.part || 1);
  const part = playable.content.parts.find(candidate => candidate.part === activePart) || playable.content.parts[0];
  const results = review.questions.filter(question => question.part === part.part).sort((left, right) => left.number - right.number);
  const summary = useMemo(() => ({
    correct: results.filter(item => item.correct).length,
    incorrect: results.filter(item => item.correct === false && !item.unanswered).length,
    unanswered: results.filter(item => item.unanswered).length,
  }), [results]);
  return <main id="pet-reading-review-screen" className="min-h-screen bg-gradient-to-b from-indigo-100 via-white to-orange-50 p-3 sm:p-6">
    <div className="mx-auto max-w-7xl overflow-hidden rounded-[2rem] border-4 border-white bg-white shadow-2xl">
      <header className="border-b border-slate-200 px-5 py-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.16em] text-blue-700">Đáp án sau khi nộp</p><h1 className="mt-1 text-2xl font-black text-slate-950">PET Reading · Kết quả trực quan</h1></div><div className="rounded-2xl bg-blue-100 px-5 py-2"><span className="text-3xl font-black text-blue-800">{review.attempt.score}</span><span className="font-black text-slate-600">/100</span></div></div></header>
      <div className="space-y-5 bg-slate-50 p-4 sm:p-6">
        <nav className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-300 bg-white p-3 shadow-sm"><div className="flex flex-wrap gap-2" role="tablist">{playable.content.parts.map(candidate => <button key={candidate.part} type="button" role="tab" aria-selected={candidate.part === activePart} data-active={candidate.part === activePart ? 'true' : 'false'} onClick={() => setActivePart(candidate.part)} className={`pet-reading-review-part-tab h-10 min-w-20 rounded-full border-2 px-4 text-sm font-black ${candidate.part === activePart ? 'border-blue-800 bg-blue-800 text-white' : 'border-blue-300 bg-white text-blue-900'}`}>Part {candidate.part}</button>)}</div><p className="text-xs font-black"><span className="text-emerald-800">{summary.correct} đúng</span> · <span className="text-rose-800">{summary.incorrect} sai</span> · <span className="text-amber-800">{summary.unanswered} bỏ trống</span></p></nav>
        <section className="rounded-3xl border border-slate-200 bg-white p-4 sm:p-6"><div className="mb-5"><p className="text-xs font-black uppercase text-indigo-700">Part {part.part}</p><h2 className="mt-1 text-2xl font-black text-slate-950">{part.title}</h2><p className="mt-2 whitespace-pre-line text-sm font-semibold leading-6 text-slate-700">{part.instruction}</p></div><PetReadingPartView part={part} answers={{}} onAnswer={() => undefined} reviewResults={results} /></section>
      </div>
      <footer className="border-t border-slate-200 bg-white p-4"><button type="button" onClick={onBack} className="pet-reading-review-back w-full rounded-2xl border-2 border-blue-700 bg-white py-3 font-black text-blue-800"><ChevronLeft size={16} className="mr-2 inline" />Quay lại tổng kết</button></footer>
    </div>
  </main>;
}

export default function PetReadingResult({ result, review, playable, reviewLoading, error, onReview, onRetry, onBack }: Props) {
  const [showReview, setShowReview] = useState(false);
  if (showReview && review) return <DetailedReview playable={playable} review={review} onBack={() => setShowReview(false)} />;
  return <main id="pet-reading-result-screen" className="flex min-h-screen items-center justify-center bg-gradient-to-b from-indigo-100 to-sky-100 p-4"><div className="w-full max-w-xl rounded-[2rem] border-4 border-white bg-white p-8 text-center shadow-2xl"><Trophy size={64} className="mx-auto text-amber-500" /><p className="mt-3 text-xs font-black uppercase tracking-[.2em] text-blue-700">Đã nộp bài thành công</p><h1 className="mt-2 text-5xl font-black text-slate-950">{result.score}<span className="text-xl text-slate-600">/100</span></h1><div className="mt-6 grid grid-cols-3 gap-2"><div className="rounded-2xl bg-emerald-100 p-3"><p className="text-2xl font-black text-emerald-800">{result.correctCount}</p><p className="text-xs font-bold text-emerald-800">Đúng</p></div><div className="rounded-2xl bg-rose-100 p-3"><p className="text-2xl font-black text-rose-800">{result.incorrectCount}</p><p className="text-xs font-bold text-rose-800">Sai</p></div><div className="rounded-2xl bg-amber-100 p-3"><p className="text-2xl font-black text-amber-800">{result.unansweredCount}</p><p className="text-xs font-bold text-amber-800">Bỏ trống</p></div></div>{error && <p className="mt-4 text-sm font-bold text-rose-700">{error}</p>}<div className="mt-7 grid gap-3"><button type="button" onClick={onBack} className="pet-reading-result-home w-full rounded-2xl bg-blue-800 py-3 font-black text-white"><Home size={16} className="mr-2 inline" />Về trang chủ</button>{playable.content.showReviewAfterSubmit && <button type="button" disabled={reviewLoading} aria-busy={reviewLoading} onClick={() => { setShowReview(true); if (!review) onReview(); }} className="pet-reading-result-review w-full rounded-2xl border-2 border-blue-700 bg-white py-3 font-black text-blue-800">{reviewLoading ? <LoaderCircle size={16} className="mr-2 inline animate-spin" /> : <Eye size={16} className="mr-2 inline" />}{reviewLoading ? 'Đang tải kết quả…' : 'Xem kết quả trực quan'}</button>}<button type="button" onClick={onRetry} className="pet-reading-result-retry w-full rounded-2xl bg-emerald-700 py-3 font-black text-white"><RotateCcw size={16} className="mr-2 inline" />Làm lại</button></div></div></main>;
}
