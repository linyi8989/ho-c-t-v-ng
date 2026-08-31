import { CheckCircle2, ChevronLeft, ChevronRight, Eye, Home, LoaderCircle, RotateCcw, Trophy, XCircle } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { examPartUnits } from '../examStructure';
import type { ExamAttemptReview, ExamCompletedAttempt, ExamPartContent, ExamPlayableSet, ExamQuestionResult } from '../types';
import ExamImageViewer from './ExamImageViewer';

type State = 'correct' | 'incorrect' | 'unanswered';
const stateOf = (result?: ExamQuestionResult): State => !result || result.unanswered ? 'unanswered' : result.correct ? 'correct' : 'incorrect';
const answerText = (value: string | string[] | undefined) => Array.isArray(value) ? value.join(', ') : String(value || '');
const stateClass = (state: State) => state === 'correct' ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : state === 'incorrect' ? 'border-rose-300 bg-rose-50 text-rose-900' : 'border-amber-300 bg-amber-50 text-amber-900';

function StateIcon({ state }: { state: State }) {
  return state === 'correct' ? <CheckCircle2 size={18} className="text-emerald-600" /> : state === 'incorrect' ? <XCircle size={18} className="text-rose-600" /> : <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 border-amber-500 text-xs font-black text-amber-600">–</span>;
}

function Examples({ part }: { part: ExamPartContent }) {
  if (!part.examples?.length) return null;
  return <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm"><p className="text-xs font-black uppercase text-indigo-700">{part.examples.length > 1 ? 'Examples' : 'Example'}</p>{part.examples.map((example, index) => <p key={index} className="mt-2 flex flex-wrap justify-between gap-3 font-semibold text-slate-700"><span>{example.prompt}</span><b className="border-b-2 border-dotted border-indigo-500 px-3 text-indigo-800">{example.answer}</b></p>)}</div>;
}

function TwoColumn({ imageUrl, optionalImage = false, children }: { imageUrl?: string; optionalImage?: boolean; children: ReactNode }) {
  if (!imageUrl && optionalImage) return <div className="mx-auto max-w-4xl space-y-4">{children}</div>;
  return <div className="grid gap-5 lg:grid-cols-[minmax(0,44%)_minmax(0,56%)]"><div>{imageUrl ? <ExamImageViewer src={imageUrl} alt="Ảnh kết quả Flyers Reading & Writing" maxHeight="min(66vh,620px)" className="border border-slate-200 bg-white" /> : <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center font-bold text-slate-500">Không có ảnh.</div>}</div><div className="space-y-4">{children}</div></div>;
}

function ResultCard({ result, index, showPrompt = true }: { key?: string; result: ExamQuestionResult; index: number; showPrompt?: boolean }) {
  const state = stateOf(result);
  return <article className={`rounded-2xl border p-4 ${stateClass(state)}`}><p className="flex items-start gap-2 font-black"><StateIcon state={state} />{index}.{showPrompt && <> {result.prompt}</>}</p><p className="mt-2 text-sm">Bạn trả lời: <b>{answerText(result.userAnswer) || 'Bỏ trống'}</b></p>{state !== 'correct' && <p className="mt-1 text-sm font-black text-emerald-800">Đúng: {answerText(result.correctAnswer)}</p>}</article>;
}

function ChoiceCard({ question, result, index }: { key?: string; question: ExamPartContent['questions'][number]; result: ExamQuestionResult; index: number }) {
  const state = stateOf(result);
  const user = answerText(result.userAnswer).trim().toLocaleLowerCase('en');
  const correct = answerText(result.correctAnswer).trim().toLocaleLowerCase('en');
  return <article className={`rounded-2xl border p-4 ${stateClass(state)}`}><p className="flex items-start gap-2 font-black"><StateIcon state={state} />{index}. {question.prompt}</p><div className="mt-3 grid grid-cols-3 gap-2">{question.options.slice(0, 3).map((option, optionIndex) => { const values = [option.label, option.text].map(value => value.trim().toLocaleLowerCase('en')); const selected = values.includes(user); const right = values.includes(correct); return <div key={option.id} className={`rounded-xl border-2 bg-white p-3 text-sm font-semibold ${right ? 'border-emerald-500' : selected ? 'border-rose-500' : 'border-slate-200'}`}><b>{String.fromCharCode(65 + optionIndex)}.</b> {option.text}{right && <CheckCircle2 size={16} className="ml-1 inline text-emerald-600" />}{selected && !right && <XCircle size={16} className="ml-1 inline text-rose-600" />}</div>; })}</div></article>;
}

function TextPart({ unit, results, optionalImage = false }: { unit: ExamPartContent; results: ExamQuestionResult[]; optionalImage?: boolean }) {
  return <TwoColumn imageUrl={unit.imageUrl} optionalImage={optionalImage}><Examples part={unit} /><div className="grid gap-3">{unit.questions.map((question, index) => { const result = results.find(item => item.questionId === question.id); return result ? <ResultCard key={question.id} result={result} index={index + 1} /> : null; })}</div></TwoColumn>;
}

function ChoicePart({ unit, results }: { unit: ExamPartContent; results: ExamQuestionResult[] }) {
  return <TwoColumn imageUrl={unit.imageUrl}><Examples part={unit} /><div className="grid gap-3">{unit.questions.map((question, index) => { const result = results.find(item => item.questionId === question.id); return result ? <ChoiceCard key={question.id} question={question} result={result} index={index + 1} /> : null; })}</div></TwoColumn>;
}

function LetterPart({ unit, results }: { unit: ExamPartContent; results: ExamQuestionResult[] }) {
  const middle = unit.readingScenes?.[0]?.imageUrl;
  return <div className="space-y-3"><div className="overflow-x-auto rounded-2xl bg-slate-50 p-2"><div data-flyer-reading-part3-review className="grid h-[clamp(360px,56vh,580px)] min-w-[880px] grid-cols-[minmax(280px,1fr)_minmax(280px,1fr)_220px] overflow-hidden rounded-2xl border-2 border-slate-300 bg-white divide-x-2 divide-slate-300"><div className="min-w-0 overflow-hidden p-2">{unit.imageUrl && <ExamImageViewer src={unit.imageUrl} alt="Lựa chọn A-H" fillFrame className="rounded-xl bg-white" />}</div><div className="min-w-0 overflow-hidden p-2">{middle && <ExamImageViewer src={middle} alt="Danh sách ghép" fillFrame className="rounded-xl bg-white" />}</div><div className="space-y-2 overflow-y-auto p-3">{unit.questions.map((question, index) => { const result = results.find(item => item.questionId === question.id); if (!result) return null; const state = stateOf(result); return <article key={question.id} className={`flex items-center gap-2 rounded-xl border-2 p-2 text-sm ${stateClass(state)}`}><StateIcon state={state} /><b className="w-7 shrink-0 text-right">{index + 1}.</b><span className="min-w-0 flex-1 rounded-lg border bg-white px-3 py-2 text-center font-black">{answerText(result.userAnswer) || '—'}</span>{state !== 'correct' && <small className="shrink-0 font-black text-emerald-800">→ {answerText(result.correctAnswer)}</small>}</article>; })}</div></div></div></div>;
}

function StoryPart({ unit, results }: { unit: ExamPartContent; results: ExamQuestionResult[] }) {
  const gaps = unit.questions.slice(0, -1);
  const byQuestion = new Map(results.map(result => [result.questionId, result]));
  const passage = (unit.passage || '').split(/(\[\[\d+\]\])/g).map((segment, index) => {
    const match = segment.match(/^\[\[(\d+)\]\]$/);
    if (!match) return <span key={index} className="whitespace-pre-wrap">{segment}</span>;
    const question = gaps[Number(match[1]) - 1];
    const result = question ? byQuestion.get(question.id) : undefined;
    const state = stateOf(result);
    return result ? <span key={index} className={`mx-1 inline-flex items-center gap-1 rounded-lg border px-2 py-1 font-black ${stateClass(state)}`}><StateIcon state={state} />{answerText(result.userAnswer) || '—'}{state !== 'correct' && <small>→ {answerText(result.correctAnswer)}</small>}</span> : null;
  });
  const titleQuestion = unit.questions.at(-1);
  const titleResult = titleQuestion ? byQuestion.get(titleQuestion.id) : undefined;
  return <TwoColumn imageUrl={unit.imageUrl}><Examples part={unit} /><div className="rounded-2xl border border-slate-200 bg-white p-5 text-base font-semibold leading-10 shadow-sm">{passage}</div>{titleQuestion && titleResult && <ChoiceCard question={titleQuestion} result={titleResult} index={gaps.length + 1} />}</TwoColumn>;
}

function StoryCompletionPart({ unit, results }: { unit: ExamPartContent; results: ExamQuestionResult[] }) {
  return <TwoColumn imageUrl={unit.imageUrl}><div className="grid gap-3">{unit.questions.map((question, index) => { const result = results.find(item => item.questionId === question.id); return result ? <ResultCard key={question.id} result={result} index={index + 1} /> : null; })}</div></TwoColumn>;
}

function MarkerPart({ unit, results }: { unit: ExamPartContent; results: ExamQuestionResult[] }) {
  const byQuestion = new Map(results.map(result => [result.questionId, result]));
  const passage = (unit.passage || '').split(/(\[\[\d+\]\])/g).map((segment, index) => {
    const match = segment.match(/^\[\[(\d+)\]\]$/);
    if (!match) return <span key={index} className="whitespace-pre-wrap">{segment}</span>;
    const question = unit.questions[Number(match[1]) - 1];
    const result = question ? byQuestion.get(question.id) : undefined;
    const state = stateOf(result);
    return result ? <span key={index} className={`mx-1 inline-flex items-center gap-1 rounded-lg border px-2 py-1 font-black ${stateClass(state)}`}><StateIcon state={state} />{answerText(result.userAnswer) || '—'}{state !== 'correct' && <small>→ {answerText(result.correctAnswer)}</small>}</span> : <span key={index} className="font-black text-rose-700">[Thiếu kết quả]</span>;
  });
  return <div className="mx-auto max-w-5xl space-y-5">{unit.imageUrl && <ExamImageViewer src={unit.imageUrl} alt="Ảnh kết quả bài đọc" maxHeight="min(42vh,360px)" className="border border-slate-200 bg-white" />}<Examples part={unit} /><div className="rounded-2xl border border-slate-200 bg-white p-5 text-base font-semibold leading-10 shadow-sm">{passage}</div><div className="grid gap-3 md:grid-cols-2">{unit.questions.map((question, index) => { const result = byQuestion.get(question.id); return result ? <ResultCard key={question.id} result={result} index={index + 1} showPrompt={false} /> : null; })}</div></div>;
}

function ImageChoicePart({ unit, results }: { unit: ExamPartContent; results: ExamQuestionResult[] }) {
  return <TwoColumn imageUrl={unit.imageUrl}><div className="space-y-2">{unit.questions.map((question, index) => { const result = results.find(item => item.questionId === question.id); if (!result) return null; const state = stateOf(result); const user = answerText(result.userAnswer).trim().toLocaleLowerCase('en'); const correct = answerText(result.correctAnswer).trim().toLocaleLowerCase('en'); return <article key={question.id} className={`grid items-center gap-2 rounded-xl border-2 p-3 sm:grid-cols-[42px_repeat(3,minmax(0,1fr))] ${stateClass(state)}`}><span className="flex items-center justify-center gap-1"><StateIcon state={state} /><b>{index + 1}.</b></span>{question.options.slice(0, 3).map((option, optionIndex) => { const values = [option.id, option.label, option.text].map(value => value.trim().toLocaleLowerCase('en')); const selected = values.includes(user); const right = values.includes(correct); return <div key={option.id} className={`min-w-0 rounded-lg border-2 bg-white px-3 py-2 text-sm font-semibold ${right ? 'border-emerald-500' : selected ? 'border-rose-500' : 'border-slate-200'}`}><b>{String.fromCharCode(65 + optionIndex)}.</b> <span className="break-words">{option.text}</span>{right && <CheckCircle2 size={15} className="ml-1 inline text-emerald-600" />}{selected && !right && <XCircle size={15} className="ml-1 inline text-rose-600" />}</div>; })}</article>; })}</div></TwoColumn>;
}

function ReviewPart({ part, results }: { part: ExamPartContent; results: ExamQuestionResult[] }) {
  const unit = examPartUnits(part)[0] || part;
  const heading = <div className="mb-5"><p className="text-xs font-black uppercase text-indigo-600">Part {part.part}</p><h3 className="mt-1 text-2xl font-black text-slate-900">{part.title}</h3><p className="mt-2 text-sm font-semibold text-slate-600">{part.instruction}</p></div>;
  const body = part.part === 2 ? <ChoicePart unit={unit} results={results} /> : part.part === 3 ? <LetterPart unit={unit} results={results} /> : part.part === 4 ? <StoryPart unit={unit} results={results} /> : part.part === 5 ? <StoryCompletionPart unit={unit} results={results} /> : part.part === 6 ? <ImageChoicePart unit={unit} results={results} /> : part.part === 7 ? <MarkerPart unit={unit} results={results} /> : <TextPart unit={unit} results={results} />;
  return <section>{heading}{body}</section>;
}

function DetailedReview({ playable, review, onBack }: { playable: ExamPlayableSet; review: ExamAttemptReview; onBack: () => void }) {
  const [activePart, setActivePart] = useState(playable.content.parts[0]?.part || 1);
  const partIndex = Math.max(0, playable.content.parts.findIndex(part => part.part === activePart));
  const part = playable.content.parts[partIndex] || playable.content.parts[0];
  const results = review.questions.filter(question => question.part === part.part).sort((left, right) => left.number - right.number);
  const summary = useMemo(() => ({ correct: results.filter(item => item.correct).length, incorrect: results.filter(item => !item.correct && !item.unanswered).length, unanswered: results.filter(item => item.unanswered).length }), [results]);
  return <main id="flyer-reading-review-screen" className="flex min-h-screen items-center justify-center bg-gradient-to-b from-indigo-100 via-white to-sky-50 p-3 sm:p-5"><div className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] border-4 border-white bg-white shadow-2xl"><header className="shrink-0 border-b border-slate-200 px-5 py-4 sm:px-7"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.16em] text-blue-600">Đáp án sau khi nộp</p><h1 className="mt-1 text-2xl font-black text-slate-900">Kết quả chi tiết</h1></div><div className="rounded-2xl bg-blue-50 px-5 py-2"><span className="text-3xl font-black text-blue-700">{review.attempt.score}</span><span className="font-black text-slate-400">/100</span></div></div></header><div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4 sm:p-6"><div className="sticky top-0 z-40 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2" role="tablist">{playable.content.parts.map(candidate => <button key={candidate.part} type="button" role="tab" aria-selected={candidate.part === activePart} data-active={candidate.part === activePart ? 'true' : 'false'} onClick={() => setActivePart(candidate.part)} className="starter-reading-review-part-tab h-10 min-w-14 rounded-full px-4 text-sm font-black">Part {candidate.part}</button>)}</div><p className="text-xs font-black"><span className="text-emerald-700">{summary.correct} đúng</span> · <span className="text-rose-700">{summary.incorrect} sai</span> · <span className="text-amber-700">{summary.unanswered} bỏ trống</span></p></div></div><div className="relative px-10 sm:px-16"><button type="button" disabled={partIndex === 0} onClick={() => setActivePart(playable.content.parts[partIndex - 1]?.part || activePart)} className="starter-reading-review-part-nav absolute left-0 top-1/2 z-30 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full" aria-label="Part trước"><ChevronLeft size={30} /></button><ReviewPart part={part} results={results} /><button type="button" disabled={partIndex === playable.content.parts.length - 1} onClick={() => setActivePart(playable.content.parts[partIndex + 1]?.part || activePart)} className="starter-reading-review-part-nav absolute right-0 top-1/2 z-30 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full" aria-label="Part sau"><ChevronRight size={30} /></button></div></div><footer className="border-t border-slate-200 bg-white p-4"><button type="button" onClick={onBack} className="starter-reading-secondary-action w-full rounded-2xl border border-blue-300 bg-white py-3 font-black text-blue-700"><ChevronLeft size={16} className="mr-2 inline" />Quay lại tổng kết</button></footer></div></main>;
}

export default function FlyerReadingWritingResult({ result, review, playable, reviewLoading, error, onReview, onRetry, onBack }: { result: ExamCompletedAttempt; review: ExamAttemptReview | null; playable: ExamPlayableSet; reviewLoading: boolean; error: string; onReview: () => void; onRetry: () => void; onBack: () => void }) {
  const [showReview, setShowReview] = useState(false);
  if (showReview && review) return <DetailedReview playable={playable} review={review} onBack={() => setShowReview(false)} />;
  return <div id="flyer-reading-result-screen" className="flex min-h-screen items-center justify-center bg-gradient-to-b from-indigo-100 to-sky-100 p-4"><div className="w-full max-w-xl rounded-[2rem] border-4 border-white bg-white p-8 text-center shadow-2xl"><Trophy size={64} className="mx-auto text-amber-500" /><p className="mt-3 text-xs font-black uppercase tracking-[.2em] text-blue-600">Đã nộp bài thành công</p><h1 className="mt-2 text-5xl font-black text-slate-900">{result.score}<span className="text-xl text-slate-400">/100</span></h1><div className="mt-6 grid grid-cols-3 gap-2"><div className="rounded-2xl bg-emerald-50 p-3"><p className="text-2xl font-black text-emerald-700">{result.correctCount}</p><p className="text-xs font-bold text-emerald-600">Đúng</p></div><div className="rounded-2xl bg-rose-50 p-3"><p className="text-2xl font-black text-rose-700">{result.incorrectCount}</p><p className="text-xs font-bold text-rose-600">Sai</p></div><div className="rounded-2xl bg-amber-50 p-3"><p className="text-2xl font-black text-amber-700">{result.unansweredCount}</p><p className="text-xs font-bold text-amber-600">Bỏ trống</p></div></div>{error && <p className="mt-4 text-sm font-bold text-rose-600">{error}</p>}<div className="mt-7 grid gap-3"><button type="button" onClick={onBack} className="starter-reading-primary-action w-full rounded-2xl bg-blue-600 py-3 font-black text-white"><Home size={16} className="mr-2 inline" />Về trang chủ</button>{playable.content.showReviewAfterSubmit && <button type="button" disabled={reviewLoading} onClick={() => { setShowReview(true); if (!review) onReview(); }} className="starter-reading-review-action w-full rounded-2xl border border-blue-300 bg-white py-3 font-black text-blue-700">{reviewLoading ? <LoaderCircle size={16} className="mr-2 inline animate-spin" /> : <Eye size={16} className="mr-2 inline" />}Xem kết quả</button>}<button type="button" onClick={onRetry} className="starter-reading-retry-action w-full rounded-2xl bg-emerald-600 py-3 font-black text-white"><RotateCcw size={16} className="mr-2 inline" />Làm lại</button></div></div></div>;
}
