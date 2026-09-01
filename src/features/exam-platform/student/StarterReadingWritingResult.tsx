import { CheckCircle2, ChevronLeft, ChevronRight, CircleMinus, Eye, Home, LoaderCircle, RotateCcw, Trophy, XCircle } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import ExamSplitTaskLayout from '../../exam-media/ExamSplitTaskLayout';
import type { ExamImageProfile } from '../../exam-media/imageProfiles';
import { examPartUnits } from '../examStructure';
import type { ExamAnswers, ExamAttemptReview, ExamCompletedAttempt, ExamPartContent, ExamPlayableSet, ExamQuestionResult } from '../types';
import ExamImageViewer from './ExamImageViewer';

type State = 'correct' | 'incorrect' | 'unanswered';
const stateOf = (result?: ExamQuestionResult): State => result?.unanswered ? 'unanswered' : result?.correct ? 'correct' : 'incorrect';
const stateLabel = (state: State) => state === 'correct' ? 'Đúng' : state === 'incorrect' ? 'Sai' : 'Bỏ trống';
const stateClasses = (state: State) => state === 'correct' ? 'border-emerald-300 bg-emerald-50 text-emerald-950' : state === 'incorrect' ? 'border-rose-300 bg-rose-50 text-rose-950' : 'border-amber-300 bg-amber-50 text-amber-950';
const answerText = (value: string | string[] | undefined) => Array.isArray(value) ? value.join(', ') : value || '';

function StateIcon({ state, size = 20 }: { state: State; size?: number }) {
  if (state === 'correct') return <CheckCircle2 size={size} className="shrink-0 text-emerald-600" />;
  if (state === 'incorrect') return <XCircle size={size} className="shrink-0 text-rose-600" />;
  return <CircleMinus size={size} className="shrink-0 text-amber-600" />;
}

function ReviewImage({ src, alt, profile = 'split-page', maxHeight }: { src?: string; alt: string; profile?: ExamImageProfile; maxHeight?: string }) {
  return src ? <ExamImageViewer src={src} alt={alt} profile={profile} maxHeight={maxHeight} className="border border-slate-200 bg-white" /> : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-bold text-slate-500">Không có ảnh hiển thị.</div>;
}

function ReviewFramedImage({ src, alt, className = 'h-28' }: { src?: string; alt: string; className?: string }) {
  return <div className={`min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white ${className}`}>{src ? <ExamImageViewer src={src} alt={alt} fillFrame className="rounded-xl bg-white" /> : <div className="flex h-full items-center justify-center text-xs font-bold text-slate-400">Không có ảnh</div>}</div>;
}

function LargeReviewImage({ src, alt, profile }: { src?: string; alt: string; profile: ExamImageProfile }) {
  return <div className="h-[clamp(380px,64dvh,650px)] overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-2" data-starter-rw-large-image-frame>{src ? <ExamImageViewer src={src} alt={alt} profile={profile} fillFrame className="rounded-xl bg-white" /> : <div className="flex h-full items-center justify-center font-bold text-slate-500">Không có ảnh.</div>}</div>;
}

function Examples({ part }: { part: ExamPartContent }) {
  if (!part.examples?.length) return null;
  return <div className="overflow-hidden rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm"><p className="text-xs font-black uppercase text-indigo-700">{part.examples.length > 1 ? 'Examples' : 'Example'}</p>{part.examples.map((example, index) => <p key={index} className="mt-2 flex flex-wrap justify-between gap-3 font-semibold text-slate-700"><span>{example.prompt}</span><b className="border-b-2 border-dotted border-indigo-500 px-3 text-indigo-800">{example.answer}</b></p>)}</div>;
}

function TwoColumn({ media, children }: { media: ReactNode; children: ReactNode }) {
  return <ExamSplitTaskLayout media={media}>{children}</ExamSplitTaskLayout>;
}

function ChoiceCard({ result, options, number }: { key?: string; result: ExamQuestionResult; options: ExamPartContent['questions'][number]['options']; number: number }) {
  const state = stateOf(result);
  const user = answerText(result.userAnswer).trim().toLowerCase();
  const correct = answerText(result.correctAnswer).trim().toLowerCase();
  return <article className={`rounded-2xl border p-4 shadow-sm ${stateClasses(state)}`}><div className="flex items-start justify-between gap-3"><p className="text-sm font-bold leading-6 text-slate-900"><b className="mr-2 text-blue-700">{number}.</b>{result.prompt}</p><span className="inline-flex items-center gap-1 text-xs font-black"><StateIcon state={state} />{stateLabel(state)}</span></div><div className="mt-3 grid grid-cols-2 gap-2">{options.slice(0, 2).map(option => {
    const label = (option.text || option.label).trim().toLowerCase();
    const selected = label === user;
    const right = label === correct;
    return <div key={option.id} className={`rounded-xl border-2 p-3 text-center text-sm font-black uppercase ${right ? 'border-emerald-500 bg-emerald-100 text-emerald-950' : selected ? 'border-rose-500 bg-rose-100 text-rose-950' : 'border-slate-200 bg-white text-slate-700'}`}>{option.text}{right && <CheckCircle2 size={17} className="ml-2 inline text-emerald-700" />}{selected && !right && <XCircle size={17} className="ml-2 inline text-rose-700" />}</div>;
  })}</div></article>;
}

function TextCard({ result, number }: { key?: string; result: ExamQuestionResult; number: number }) {
  const state = stateOf(result);
  return <article className={`rounded-2xl border p-4 shadow-sm ${stateClasses(state)}`}><div className="flex items-start justify-between gap-3"><p className="text-sm font-bold leading-6 text-slate-900"><b className="mr-2 text-blue-700">{number}.</b>{result.prompt}</p><span className="inline-flex shrink-0 items-center gap-1 text-xs font-black"><StateIcon state={state} />{stateLabel(state)}</span></div><div className="mt-3 rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-black text-slate-900">{answerText(result.userAnswer) || 'Bỏ trống'}</div>{state !== 'correct' && <p className="mt-2 text-sm font-bold text-emerald-800">Đáp án đúng: <b>{answerText(result.correctAnswer)}</b></p>}</article>;
}

function InlineResult({ result }: { key?: number; result: ExamQuestionResult }) {
  const state = stateOf(result);
  return <span className={`mx-1 inline-flex max-w-full flex-col rounded-xl border px-2 py-1 align-middle leading-5 ${stateClasses(state)}`}><span className="inline-flex items-center gap-1 font-black"><StateIcon state={state} size={16} />{answerText(result.userAnswer) || 'Bỏ trống'}</span>{state !== 'correct' && <span className="text-xs font-black text-emerald-800">Đúng: {answerText(result.correctAnswer)}</span>}</span>;
}

function renderPromptResult(prompt: string, result: ExamQuestionResult) {
  const marker = /(\[\[\d+\]\]|\{\{[^}]+\}\}|_{3,}|(?:\.\s*){4,})/;
  const match = prompt.match(marker);
  if (!match || match.index === undefined) return <>{prompt} <InlineResult result={result} /></>;
  return <>{prompt.slice(0, match.index)}<InlineResult result={result} />{prompt.slice(match.index + match[0].length)}</>;
}

function ReviewPart({ part, results }: { part: ExamPartContent; results: ExamQuestionResult[] }) {
  const unit = examPartUnits(part)[0] || part;
  const byId = new Map(results.map(result => [result.questionId, result]));
  const heading = <div className="mb-5"><p className="text-xs font-black uppercase text-indigo-600">Part {part.part}</p><h3 className="mt-1 text-2xl font-black text-slate-900">{part.title}</h3><p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{part.instruction}</p></div>;

  if (part.part === 1) {
    const croppedLayout = (unit.examples || []).length === 2 && (unit.examples || []).every(example => example.imageUrl) && unit.questions.every(question => question.imageUrl);
    if (croppedLayout) return <section>{heading}<div className="mx-auto max-w-5xl space-y-3" data-starter-rw-part1-cropped-review>
      {(unit.examples || []).map((example, index) => <div key={index} className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-3 sm:grid-cols-[150px_minmax(0,1fr)]"><ReviewFramedImage src={example.imageUrl} alt={`Example ${index + 1}`} /><p className="flex flex-wrap items-center justify-between gap-3 text-sm font-semibold text-slate-800"><span><b className="mr-2 text-indigo-700">Example.</b>{example.prompt}</span><b className="rounded-lg bg-white px-4 py-2 text-indigo-900">{example.answer}</b></p></div>)}
      {unit.questions.map((question, index) => { const result = byId.get(question.id); return result ? <div key={question.id} className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[150px_minmax(0,1fr)]"><ReviewFramedImage src={question.imageUrl} alt={`Hình câu ${index + 1}`} /><ChoiceCard result={result} options={question.options} number={index + 1} /></div> : null; })}
    </div></section>;
    const example = unit.examples?.[0];
    return <section>{heading}{example?.imageUrl && <div className="mx-auto mb-5 max-w-4xl"><ReviewImage src={example.imageUrl} alt="Ảnh example Part 1" profile="cover" maxHeight="min(32dvh, 280px)" /></div>}<TwoColumn media={<ReviewImage src={unit.imageUrl} alt="Kết quả Part 1" profile="illustration" />}><Examples part={unit} />{unit.questions.map((question, index) => { const result = byId.get(question.id); return result ? <ChoiceCard key={question.id} result={result} options={question.options} number={index + 1} /> : null; })}</TwoColumn></section>;
  }
  if (part.part === 2) return <section>{heading}<TwoColumn media={<LargeReviewImage src={unit.imageUrl} alt="Kết quả Part 2" profile="illustration" />}><Examples part={unit} />{unit.questions.map((question, index) => { const result = byId.get(question.id); return result ? <ChoiceCard key={question.id} result={result} options={question.options} number={index + 1} /> : null; })}</TwoColumn></section>;
  if (part.part === 3) {
    const example = unit.examples?.[0];
    const croppedLayout = Boolean(example?.imageUrl && example.secondaryImageUrl) && unit.questions.every(question => question.imageUrl && question.secondaryImageUrl);
    if (croppedLayout) return <section>{heading}<div className="mx-auto max-w-5xl space-y-3" data-starter-rw-part3-paired-review>
      <div className="grid grid-cols-[minmax(64px,1fr)_minmax(96px,150px)_minmax(64px,1fr)] items-center gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-3 sm:grid-cols-[minmax(90px,1fr)_minmax(130px,190px)_minmax(90px,1fr)]"><ReviewFramedImage src={example?.imageUrl} alt="Example trái" className="h-32" /><p className="text-center font-black tracking-[.2em] text-indigo-900">{example?.answer}</p><ReviewFramedImage src={example?.secondaryImageUrl} alt="Example phải" className="h-32" /></div>
      {unit.questions.map((question, index) => { const result = byId.get(question.id); return result ? <div key={question.id} className="grid grid-cols-[minmax(64px,1fr)_minmax(110px,150px)_minmax(64px,1fr)] items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:grid-cols-[minmax(90px,1fr)_minmax(180px,250px)_minmax(90px,1fr)]"><ReviewFramedImage src={question.imageUrl} alt={`Câu ${index + 1} trái`} className="h-32" /><TextCard result={result} number={index + 1} /><ReviewFramedImage src={question.secondaryImageUrl} alt={`Câu ${index + 1} phải`} className="h-32" /></div> : null; })}
    </div></section>;
    return <section>{heading}<TwoColumn media={<ReviewImage src={unit.imageUrl} alt="Kết quả Part 3" profile="split-page" />}><div className="space-y-3">{unit.questions.map((question, index) => { const result = byId.get(question.id); return result ? <TextCard key={question.id} result={result} number={index + 1} /> : null; })}</div></TwoColumn></section>;
  }
  if (part.part === 4) return <section>{heading}<TwoColumn media={<LargeReviewImage src={unit.imageUrl} alt="Kết quả Part 4" profile="word-bank" />}><Examples part={unit} /><div className="rounded-2xl border border-slate-200 bg-white p-5 text-base font-semibold leading-10 text-slate-800 shadow-sm">{(unit.passage || '').split(/(\[\[\d+\]\])/g).map((segment, index) => { const match = segment.match(/^\[\[(\d+)\]\]$/); if (!match) return <span key={index} className="whitespace-pre-wrap">{segment}</span>; const question = unit.questions[Number(match[1]) - 1]; const result = question ? byId.get(question.id) : undefined; return result ? <InlineResult key={index} result={result} /> : <span key={index} className="text-rose-700">[Thiếu kết quả]</span>; })}</div></TwoColumn></section>;

  let number = 0;
  const questions = new Map(unit.questions.map(question => [question.id, question]));
  return <section>{heading}<div className="mt-5 space-y-7">{(unit.readingScenes || []).map((scene, sceneIndex) => <section key={scene.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4"><ExamSplitTaskLayout media={<ReviewImage src={scene.imageUrl} alt={`Kết quả Part 5 cảnh ${sceneIndex + 1}`} profile="story-scene" />}><div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">{scene.passage && <p className="whitespace-pre-wrap text-sm font-semibold leading-7 text-slate-700">{scene.passage}</p>}{sceneIndex === 0 && <Examples part={unit} />}<div className="border-t border-slate-200 pt-3">{scene.questionIds.map(questionId => {
    const question = questions.get(questionId);
    const result = byId.get(questionId);
    if (!question || !result) return null;
    number += 1;
    return <div key={questionId} className="py-2 text-base font-semibold leading-10 text-slate-800"><b className="mr-2 text-blue-700">{number}.</b>{renderPromptResult(question.prompt, result)}</div>;
  })}</div></div></ExamSplitTaskLayout></section>)}</div></section>;
}

function DetailedReview({ playable, review, onBack }: { playable: ExamPlayableSet; review: ExamAttemptReview; onBack: () => void }) {
  const [activePart, setActivePart] = useState(1);
  const partIndex = Math.max(0, playable.content.parts.findIndex(part => part.part === activePart));
  const part = playable.content.parts[partIndex] || playable.content.parts[0];
  const results = review.questions.filter(question => question.part === part.part).sort((left, right) => left.number - right.number);
  const summary = useMemo(() => ({ correct: results.filter(item => item.correct).length, incorrect: results.filter(item => !item.correct && !item.unanswered).length, unanswered: results.filter(item => item.unanswered).length }), [results]);
  return <main id="starter-reading-review-screen" className="flex min-h-screen items-center justify-center bg-gradient-to-b from-indigo-100 via-white to-sky-50 p-3 sm:p-5"><div className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] border-4 border-white bg-white shadow-2xl"><header className="shrink-0 border-b border-slate-200 px-5 py-4 sm:px-7"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.16em] text-blue-600">Đáp án sau khi nộp</p><h1 className="mt-1 text-2xl font-black text-slate-900">Kết quả chi tiết</h1></div><div className="rounded-2xl bg-blue-50 px-5 py-2"><span className="text-3xl font-black text-blue-700">{review.attempt.score}</span><span className="font-black text-slate-400">/100</span></div></div></header><div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4 sm:p-6"><div className="sticky top-0 z-40 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2" role="tablist">{playable.content.parts.map(candidate => <button key={candidate.part} type="button" role="tab" aria-selected={candidate.part === activePart} data-active={candidate.part === activePart ? 'true' : 'false'} onClick={() => setActivePart(candidate.part)} className="starter-reading-review-part-tab h-10 min-w-14 rounded-full px-4 text-sm font-black">Part {candidate.part}</button>)}</div><p className="text-xs font-black"><span className="text-emerald-700">{summary.correct} đúng</span> · <span className="text-rose-700">{summary.incorrect} sai</span> · <span className="text-amber-700">{summary.unanswered} bỏ trống</span></p></div></div><div className="relative px-10 sm:px-16"><button type="button" disabled={partIndex === 0} onClick={() => setActivePart(playable.content.parts[partIndex - 1]?.part || activePart)} className="starter-reading-review-part-nav absolute left-0 top-1/2 z-30 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full" aria-label="Part trước"><ChevronLeft size={30} /></button><ReviewPart part={part} results={results} /><button type="button" disabled={partIndex === playable.content.parts.length - 1} onClick={() => setActivePart(playable.content.parts[partIndex + 1]?.part || activePart)} className="starter-reading-review-part-nav absolute right-0 top-1/2 z-30 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full" aria-label="Part sau"><ChevronRight size={30} /></button></div></div><footer className="border-t border-slate-200 bg-white p-4"><button type="button" onClick={onBack} className="starter-reading-secondary-action w-full rounded-2xl border border-blue-300 bg-white py-3 font-black text-blue-700"><ChevronLeft size={16} className="mr-2 inline" />Quay lại tổng kết</button></footer></div></main>;
}

export default function StarterReadingWritingResult({ result, review, playable, reviewLoading, error, onReview, onRetry, onBack }: { result: ExamCompletedAttempt; review: ExamAttemptReview | null; playable: ExamPlayableSet; answers: ExamAnswers; reviewLoading: boolean; error: string; onReview: () => void; onRetry: () => void; onBack: () => void }) {
  const [showReview, setShowReview] = useState(false);
  if (showReview && review) return <DetailedReview playable={playable} review={review} onBack={() => setShowReview(false)} />;
  return <main id="starter-reading-result-screen" className="flex min-h-screen items-center justify-center bg-gradient-to-b from-indigo-100 via-white to-sky-50 p-4"><div className="w-full max-w-xl rounded-[2rem] border-4 border-white bg-white p-8 text-center shadow-2xl"><Trophy size={64} className="mx-auto text-amber-500" /><p className="mt-3 text-xs font-black uppercase tracking-[.2em] text-blue-600">Đã nộp bài thành công</p><h1 className="mt-2 text-5xl font-black text-slate-900">{result.score}<span className="text-xl text-slate-400">/100</span></h1><div className="mt-6 grid grid-cols-3 gap-2"><div className="rounded-2xl bg-emerald-50 p-3"><p className="text-2xl font-black text-emerald-700">{result.correctCount}</p><p className="text-xs font-bold text-emerald-600">Đúng</p></div><div className="rounded-2xl bg-rose-50 p-3"><p className="text-2xl font-black text-rose-700">{result.incorrectCount}</p><p className="text-xs font-bold text-rose-600">Sai</p></div><div className="rounded-2xl bg-amber-50 p-3"><p className="text-2xl font-black text-amber-700">{result.unansweredCount}</p><p className="text-xs font-bold text-amber-600">Bỏ trống</p></div></div>{error && <p className="mt-4 text-sm font-bold text-rose-600">{error}</p>}<div className="mt-7 grid gap-3"><button type="button" onClick={onBack} className="starter-reading-primary-action w-full rounded-2xl bg-blue-600 py-3 font-black text-white"><Home size={16} className="mr-2 inline" />Về trang chủ</button>{playable.content.showReviewAfterSubmit && <button type="button" disabled={reviewLoading} onClick={() => { setShowReview(true); if (!review) onReview(); }} className="starter-reading-review-action w-full rounded-2xl border border-blue-300 bg-white py-3 font-black text-blue-700">{reviewLoading ? <LoaderCircle size={16} className="mr-2 inline animate-spin" /> : <Eye size={16} className="mr-2 inline" />}Xem kết quả</button>}<button type="button" onClick={onRetry} className="starter-reading-retry-action w-full rounded-2xl bg-emerald-600 py-3 font-black text-white"><RotateCcw size={16} className="mr-2 inline" />Làm lại</button></div></div></main>;
}
