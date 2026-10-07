import { CheckCircle2, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ExamAnswerValue, ExamAnswers, ExamPartContent, ExamQuestion, ExamQuestionResult } from '../types';
import ExamImageViewer from './ExamImageViewer';
import { studentTypedAnswerGuards } from './studentTextEntryGuards';

interface Props {
  part: ExamPartContent;
  answers: ExamAnswers;
  onAnswer: (questionId: string, value: ExamAnswerValue) => void;
  reviewResults?: ExamQuestionResult[];
}

const normalize = (value: unknown) => String(value ?? '').trim().normalize('NFKC').toUpperCase();
const resultFor = (question: ExamQuestion, results?: ExamQuestionResult[]) => results?.find(item => item.questionId === question.id);

function matches(option: ExamQuestion['options'][number], value: unknown) {
  const list = Array.isArray(value) ? value : [value];
  return list.some(item => normalize(item) === normalize(option.id) || normalize(item) === normalize(option.label) || normalize(item) === normalize(option.text));
}

function cardClass(result?: ExamQuestionResult) {
  if (!result) return 'border-slate-200 bg-white';
  if (result.correct) return 'border-emerald-500 bg-emerald-50';
  if (result.unanswered) return 'border-amber-500 bg-amber-50';
  return 'border-rose-500 bg-rose-50';
}

function ReviewBadge({ result }: { result?: ExamQuestionResult }) {
  if (!result) return null;
  return result.correct
    ? <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-700 px-2 py-1 text-[11px] font-black text-white"><CheckCircle2 size={13} />Đúng</span>
    : <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-black text-white ${result.unanswered ? 'bg-amber-700' : 'bg-rose-700'}`}><XCircle size={13} />{result.unanswered ? 'Bỏ trống' : 'Sai'}</span>;
}

function letterFor(question: ExamQuestion, value: unknown) {
  const index = question.options.findIndex(option => matches(option, value));
  return index >= 0 ? String.fromCharCode(65 + index) : '';
}

function updateLetter(question: ExamQuestion, value: string, maxLetter: string, onAnswer: Props['onAnswer']) {
  const pattern = new RegExp(`[^A-${maxLetter}]`, 'g');
  const letter = value.toUpperCase().replace(pattern, '').slice(-1);
  const option = question.options[letter ? letter.charCodeAt(0) - 65 : -1];
  onAnswer(question.id, option?.id || '');
}

function LetterInput({ question, answer, result, maxLetter, onAnswer }: { question: ExamQuestion; answer?: ExamAnswerValue; result?: ExamQuestionResult; maxLetter: string; onAnswer: Props['onAnswer'] }) {
  const value = result ? letterFor(question, result.userAnswer) : letterFor(question, answer);
  const correct = result ? letterFor(question, result.correctAnswer) : '';
  return <span className="inline-flex items-center gap-2 align-middle">
    <input {...studentTypedAnswerGuards} value={value} maxLength={1} readOnly={Boolean(result)} onChange={event => updateLetter(question, event.target.value, maxLetter, onAnswer)} aria-label={`Đáp án câu ${question.displayNumber || question.number}`} className={`h-10 w-12 rounded-lg border-2 bg-white text-center text-lg font-black uppercase outline-none ${result?.correct ? 'border-emerald-600 text-emerald-800' : result?.unanswered ? 'border-amber-600 text-amber-800' : result ? 'border-rose-600 text-rose-800' : 'border-blue-400 text-blue-900 focus:border-blue-700 focus:ring-2 focus:ring-blue-100'}`} />
    {result && !result.correct && <small className="font-black text-emerald-800">Đúng: {correct}</small>}
  </span>;
}

function ChoiceButtons({ question, answer, result, onAnswer }: { question: ExamQuestion; answer?: ExamAnswerValue; result?: ExamQuestionResult; onAnswer: Props['onAnswer'] }) {
  return <fieldset disabled={Boolean(result)}><legend className="sr-only">Câu {question.displayNumber || question.number}</legend><div className="grid gap-2 sm:grid-cols-2">{question.options.slice(0, 4).map((option, index) => {
    const selected = result ? matches(option, result.userAnswer) : answer === option.id;
    const correct = result ? matches(option, result.correctAnswer) : false;
    const style = result
      ? correct ? 'border-emerald-600 bg-emerald-100 text-emerald-950' : selected ? 'border-rose-600 bg-rose-100 text-rose-950' : 'border-slate-200 bg-white text-slate-700'
      : selected ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-300 bg-white text-slate-800 hover:border-blue-400';
    return <label key={option.id} className={`flex cursor-pointer items-start gap-2 rounded-xl border-2 p-3 text-sm font-semibold leading-6 ${style}`}><input type="radio" name={`fce-reading-${question.id}`} checked={selected} disabled={Boolean(result)} onChange={() => onAnswer(question.id, option.id)} className="mt-1 shrink-0" /><span><b>{String.fromCharCode(65 + index)}.</b> {option.text}{correct && <CheckCircle2 size={15} className="ml-1 inline" />}{result && selected && !correct && <XCircle size={15} className="ml-1 inline" />}</span></label>;
  })}</div></fieldset>;
}

function PartOne({ part, answers, onAnswer, reviewResults }: Props) {
  return <div className="space-y-5" data-fce-reading-part1-player>
    <article className="rounded-2xl border border-orange-300 bg-orange-50 p-5 text-base font-semibold leading-8 text-slate-900 shadow-sm"><div className="whitespace-pre-wrap lg:columns-2 lg:gap-8">{part.passage}</div></article>
    <div className="space-y-3">{part.questions.map(question => { const result = resultFor(question, reviewResults); return <article key={question.id} className={`rounded-2xl border-2 p-4 shadow-sm ${cardClass(result)}`}><div className="mb-3 flex items-start justify-between gap-3"><p className="flex gap-2 text-base font-black leading-7 text-slate-950"><span className="text-blue-700">{question.displayNumber}.</span><span>{question.prompt}</span></p><ReviewBadge result={result} /></div><ChoiceButtons question={question} answer={answers[question.id]} result={result} onAnswer={onAnswer} /></article>; })}</div>
  </div>;
}

function GappedPassage({ part, answers, onAnswer, reviewResults }: Props) {
  const byNumber = new Map(part.questions.map(question => [question.displayNumber || question.number, question]));
  const content: ReactNode[] = (part.passage || '').split(/(\[\[\d+\]\])/g).map((segment, index) => {
    const match = segment.match(/^\[\[(\d+)\]\]$/);
    if (!match) return <span key={index} className="whitespace-pre-wrap">{segment}</span>;
    const number = Number(match[1]);
    const question = byNumber.get(number);
    if (!question) return <span key={index} className="mx-1 font-black text-rose-700">[{number}]</span>;
    const result = resultFor(question, reviewResults);
    return <span key={index} className="mx-1 inline-flex items-center gap-2 rounded-lg border border-orange-300 bg-white px-2 py-1"><b className="text-blue-700">{number}</b><LetterInput question={question} answer={answers[question.id]} result={result} maxLetter="H" onAnswer={onAnswer} /></span>;
  });
  return <div className="space-y-5" data-fce-reading-part2-player>
    <article className="rounded-2xl border border-orange-300 bg-orange-50 p-5 text-base font-semibold leading-8 text-slate-900 shadow-sm">{content}</article>
    <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4"><h3 className="text-sm font-black uppercase tracking-wide text-indigo-900">Sentences A–H</h3><p className="mt-1 text-xs font-semibold text-indigo-800">Các đoạn dưới đây chỉ để đọc. Hãy nhập chữ cái vào đúng ô trong bài đọc phía trên.</p><div className="mt-3 grid gap-3 md:grid-cols-2">{part.questions[0]?.options.slice(0, 8).map((option, index) => <article key={option.id} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-2 rounded-xl border border-indigo-200 bg-white p-3 text-sm font-semibold leading-6 text-slate-800"><b className="text-indigo-800">{String.fromCharCode(65 + index)}.</b><p className="whitespace-pre-wrap">{option.text}</p></article>)}</div></section>
  </div>;
}

function PartThree({ part, answers, onAnswer, reviewResults }: Props) {
  return <div className="grid gap-6 lg:grid-cols-[minmax(0,48%)_minmax(0,52%)]" data-fce-reading-part3-player>
    <div className="lg:sticky lg:top-24 lg:self-start">{part.imageUrl ? <ExamImageViewer src={part.imageUrl} alt="Bốn đoạn A–D của FCE Reading Part 3" maxHeight="min(78vh,900px)" className="border border-slate-200 bg-white" /> : <div className="flex min-h-96 items-center justify-center rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 p-6 text-center font-black text-amber-900">Chưa có ảnh bốn đoạn A–D.</div>}</div>
    <div className="space-y-2">{part.questions.map(question => { const result = resultFor(question, reviewResults); return <article key={question.id} className={`grid grid-cols-[3rem_minmax(0,1fr)_7.5rem] items-center gap-3 rounded-2xl border-2 p-3 shadow-sm ${cardClass(result)}`}><span className="flex h-10 items-center justify-center rounded-xl bg-blue-700 text-sm font-black text-white">{question.displayNumber}</span><p className="text-sm font-bold leading-6 text-slate-900">{question.prompt}</p><div className="justify-self-end"><LetterInput question={question} answer={answers[question.id]} result={result} maxLetter="D" onAnswer={onAnswer} /></div></article>; })}</div>
  </div>;
}

export default function FceReadingPartView(props: Props) {
  return <div id="fce-reading-player" data-fce-reading-part={props.part.part} data-review-mode={props.reviewResults ? 'true' : 'false'}>{props.part.part === 1 ? <PartOne {...props} /> : props.part.part === 2 ? <GappedPassage {...props} /> : <PartThree {...props} />}</div>;
}
