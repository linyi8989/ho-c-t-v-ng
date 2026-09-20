import { CheckCircle2, CircleMinus, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import PetNoticeFrame from '../PetNoticeFrame';
import type { ExamAnswerValue, ExamAnswers, ExamDisplayExample, ExamPartContent, ExamQuestion, ExamQuestionResult } from '../types';
import ExamImageViewer from './ExamImageViewer';
import { studentTypedAnswerGuards } from './studentTextEntryGuards';

interface Props {
  part: ExamPartContent;
  answers: ExamAnswers;
  onAnswer: (questionId: string, value: ExamAnswerValue) => void;
  reviewResults?: ExamQuestionResult[];
}

const normalized = (value: unknown) => String(value ?? '').trim().normalize('NFKC').toLocaleLowerCase('en');
const answerText = (value: string | string[] | undefined) => Array.isArray(value) ? value.join(', ') : value || '';
const matchesOption = (option: ExamQuestion['options'][number], value: string | string[] | undefined) => {
  const answer = normalized(answerText(value));
  return Boolean(answer) && [option.label, option.text].some(candidate => normalized(candidate) === answer);
};

function reviewFor(question: ExamQuestion, results?: ExamQuestionResult[]) {
  return results?.find(result => result.questionId === question.id);
}

function reviewCardClass(result?: ExamQuestionResult) {
  if (!result) return 'border-slate-200 bg-white';
  if (result.correct) return 'border-emerald-400 bg-emerald-50';
  if (result.unanswered) return 'border-amber-400 bg-amber-50';
  return 'border-rose-400 bg-rose-50';
}

function ReviewBadge({ result }: { result?: ExamQuestionResult }) {
  if (!result) return null;
  if (result.correct) return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-700 px-2.5 py-1 text-xs font-black text-white"><CheckCircle2 size={14} />Đúng</span>;
  if (result.unanswered) return <span className="inline-flex items-center gap-1 rounded-full bg-amber-600 px-2.5 py-1 text-xs font-black text-white"><CircleMinus size={14} />Bỏ trống</span>;
  return <span className="inline-flex items-center gap-1 rounded-full bg-rose-700 px-2.5 py-1 text-xs font-black text-white"><XCircle size={14} />Sai</span>;
}

function QuestionNumber({ question, fallback }: { question: ExamQuestion; fallback: number }) {
  return <b className="shrink-0 text-blue-700">{question.displayNumber || fallback}.</b>;
}

function MissingImage({ label }: { label: string }) {
  return <div className="flex h-full min-h-44 items-center justify-center rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 p-5 text-center text-sm font-black text-amber-900">{label}</div>;
}

function ExampleAnswer({ example, columns }: { example: ExamDisplayExample; columns: 3 | 4 }) {
  const answer = normalized(example.answer);
  return <section className="rounded-2xl border border-amber-300 bg-amber-50/80 p-4 shadow-sm" data-pet-reading-worked-example>
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-black uppercase tracking-wide text-amber-950">Example</p><p className="rounded-lg bg-white px-3 py-1.5 text-sm font-black text-emerald-800">Answer: {example.answer}</p></div>
    <div className={`mt-3 grid gap-2 ${columns === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2 xl:grid-cols-4'}`}>{(example.options || []).slice(0, columns).map((option, index) => {
      const correct = normalized(option.label) === answer;
      return <div key={`${option.label}-${index}`} className={`rounded-xl border-2 p-3 text-sm font-semibold ${correct ? 'border-emerald-600 bg-emerald-100 text-emerald-950' : 'border-amber-200 bg-white text-slate-800'}`}><b>{String.fromCharCode(65 + index)}.</b> {option.text}{correct && <CheckCircle2 size={16} className="ml-2 inline text-emerald-700" />}</div>;
    })}</div>
  </section>;
}

function ChoiceButtons({ question, answer, onAnswer, columns = 4, result }: { question: ExamQuestion; answer?: ExamAnswerValue; onAnswer: Props['onAnswer']; columns?: 2 | 3 | 4; result?: ExamQuestionResult }) {
  return <fieldset disabled={Boolean(result)}><legend className="sr-only">Lựa chọn câu {question.displayNumber || question.number}</legend><div className={`grid gap-2 ${columns === 2 ? 'grid-cols-2' : columns === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2 xl:grid-cols-4'}`}>{question.options.slice(0, columns).map((option, index) => {
    const selected = result ? matchesOption(option, result.userAnswer) : answer === option.id;
    const correct = result ? matchesOption(option, result.correctAnswer) : false;
    const className = result
      ? correct
        ? 'border-emerald-600 bg-emerald-100 text-emerald-950 shadow-sm'
        : selected
          ? 'border-rose-600 bg-rose-100 text-rose-950 shadow-sm'
          : 'border-slate-200 bg-white text-slate-700'
      : selected
        ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
        : 'border-slate-200 bg-slate-50 text-slate-800 hover:border-blue-300';
    return <label key={option.id} className={`flex min-w-0 items-start gap-2 rounded-xl border-2 px-3 py-3 text-sm font-semibold ${result ? 'cursor-default' : 'cursor-pointer'} ${className}`}><input type="radio" className="mt-0.5 shrink-0" name={`pet-reading-${question.id}`} checked={selected} disabled={Boolean(result)} onChange={() => onAnswer(question.id, option.id)} /><span className="min-w-0 break-words"><b>{String.fromCharCode(65 + index)}.</b> {option.text}{correct && <CheckCircle2 size={15} className="ml-1.5 inline text-emerald-700" />}{selected && !correct && result && <XCircle size={15} className="ml-1.5 inline text-rose-700" />}</span></label>;
  })}</div></fieldset>;
}

function PartOne({ part, answers, onAnswer, reviewResults }: Props) {
  const example = part.examples?.[0];
  return <div className="space-y-5" data-pet-reading-part1-player>
    {example && <div className="grid gap-4 bg-transparent lg:grid-cols-[minmax(280px,42%)_minmax(0,58%)]" data-pet-reading-part1-example-row><div className="min-h-52 bg-transparent"><PetNoticeFrame variant={0} content={example.prompt} label="Thông báo example" /></div><div className="self-center"><ExampleAnswer example={example} columns={3} /></div></div>}
    {part.questions.map((question, index) => {
      const result = reviewFor(question, reviewResults);
      return <article key={question.id} className="grid gap-4 bg-transparent lg:grid-cols-[minmax(280px,42%)_minmax(0,58%)]" data-pet-reading-part1-row>
        <div className="min-h-52 overflow-hidden bg-transparent">{question.context?.trim()
          ? <PetNoticeFrame variant={index} content={question.context} label={`Thông báo câu ${question.displayNumber || index + 1}`} />
          : question.imageUrl
            ? <div data-pet-reading-legacy-notice-image className="h-full"><ExamImageViewer src={question.imageUrl} alt={`Thông báo cũ câu ${question.displayNumber || index + 1}`} fillFrame className="h-full w-full border border-slate-200 bg-white" /></div>
            : <PetNoticeFrame variant={index} label={`Thông báo câu ${question.displayNumber || index + 1}`} />}</div>
        <div className={`self-center rounded-2xl border-2 p-4 shadow-sm ${reviewCardClass(result)}`}><div className="mb-4 flex items-start justify-between gap-3"><p className="flex items-start gap-2 text-base font-bold leading-7 text-slate-900"><QuestionNumber question={question} fallback={index + 1} /><span>{question.prompt}</span></p><ReviewBadge result={result} /></div><ChoiceButtons question={question} answer={answers[question.id]} onAnswer={onAnswer} columns={3} result={result} /></div>
      </article>;
    })}
  </div>;
}

function PartTwo({ part, answers, onAnswer, reviewResults }: Props) {
  const bank = part.questions[0]?.options.slice(0, 8) || [];
  const letterFor = (question: ExamQuestion, value: string | string[] | undefined) => {
    const index = question.options.findIndex(option => matchesOption(option, value));
    return index >= 0 ? String.fromCharCode(65 + index) : '';
  };
  const answerLetter = (question: ExamQuestion, result?: ExamQuestionResult) => {
    if (result) return letterFor(question, result.userAnswer);
    const index = question.options.findIndex(option => option.id === answers[question.id]);
    return index >= 0 ? String.fromCharCode(65 + index) : '';
  };
  const update = (question: ExamQuestion, value: string) => {
    const letter = value.toUpperCase().replace(/[^A-H]/g, '').slice(-1);
    const option = question.options[letter ? letter.charCodeAt(0) - 65 : -1];
    onAnswer(question.id, option?.id || '');
  };
  return <div className="space-y-5" data-pet-reading-part2-player>
    <div className="grid gap-5 lg:grid-cols-[minmax(0,46%)_minmax(0,54%)]">
      <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4"><h3 className="text-sm font-black uppercase tracking-wide text-blue-800">People</h3><div className="mt-3 space-y-3">{part.questions.map((question, index) => { const result = reviewFor(question, reviewResults); return <article key={question.id} className={`flex items-start gap-3 rounded-xl border-2 p-3 text-sm font-semibold leading-6 text-slate-800 ${reviewCardClass(result)}`}><QuestionNumber question={question} fallback={index + 1} /><p>{question.prompt}</p><span className="ml-auto"><ReviewBadge result={result} /></span></article>; })}</div></section>
      <section className="rounded-2xl border border-violet-200 bg-violet-50 p-4"><h3 className="text-sm font-black uppercase tracking-wide text-violet-800">Choices A–H</h3><div className="mt-3 space-y-2">{bank.map((option, index) => <article key={option.id} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-2 rounded-xl border border-violet-100 bg-white p-3 text-sm font-semibold leading-6 text-slate-800"><b className="text-violet-700">{String.fromCharCode(65 + index)}.</b><p className="whitespace-pre-wrap">{option.text}</p></article>)}</div></section>
    </div>
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><h3 className="text-sm font-black text-slate-900">Write the correct letter A–H</h3><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">{part.questions.map((question, index) => { const result = reviewFor(question, reviewResults); const correctLetter = result ? letterFor(question, result.correctAnswer) : ''; return <label key={question.id} className={`grid grid-cols-[minmax(0,1fr)_3.5rem] items-center gap-2 rounded-xl border-2 p-3 text-sm font-black text-slate-800 ${reviewCardClass(result)}`}><span>Question {question.displayNumber || index + 1}{result && !result.correct && <small className="mt-1 block text-emerald-800">Đúng: {correctLetter}</small>}</span><input {...studentTypedAnswerGuards} value={answerLetter(question, result)} maxLength={1} readOnly={Boolean(result)} onChange={event => update(question, event.target.value)} aria-label={`Đáp án câu ${question.displayNumber || index + 1}`} className={`h-11 w-full rounded-lg border-2 bg-white text-center text-lg font-black uppercase outline-none ${result?.correct ? 'border-emerald-600 text-emerald-800' : result?.unanswered ? 'border-amber-600 text-amber-800' : result ? 'border-rose-600 text-rose-800' : 'border-blue-300 text-blue-800 focus:border-blue-600 focus:ring-2 focus:ring-blue-100'}`} /></label>; })}</div></section>
  </div>;
}

function PartThree({ part, answers, onAnswer, reviewResults }: Props) {
  return <div className="grid gap-6 lg:grid-cols-[minmax(0,48%)_minmax(0,52%)]" data-pet-reading-part3-player><div className="lg:sticky lg:top-24 lg:self-start">{part.imageUrl ? <ExamImageViewer src={part.imageUrl} alt="Ảnh PET Reading Part 3" maxHeight="min(72vh,720px)" className="border border-slate-200 bg-white" /> : <MissingImage label="Chưa có ảnh tình huống Part 3" />}</div><div className="space-y-2">{part.questions.map((question, index) => { const result = reviewFor(question, reviewResults); return <fieldset key={question.id} className={`rounded-2xl border-2 p-3 shadow-sm ${reviewCardClass(result)}`} disabled={Boolean(result)}><legend className="sr-only">Câu {question.displayNumber || index + 1}</legend><div className="grid grid-cols-[minmax(0,1fr)_4.75rem_4.75rem] items-start gap-2"><p className="flex min-w-0 items-start gap-2 py-2 text-sm font-bold leading-5 text-slate-900"><QuestionNumber question={question} fallback={index + 1} /><span>{question.prompt}</span><ReviewBadge result={result} /></p>{question.options.slice(0, 2).map(option => { const selected = result ? matchesOption(option, result.userAnswer) : answers[question.id] === option.id; const correct = result ? matchesOption(option, result.correctAnswer) : false; const style = result ? correct ? 'border-emerald-600 bg-emerald-100 text-emerald-950' : selected ? 'border-rose-600 bg-rose-100 text-rose-950' : 'border-slate-300 bg-white text-slate-700' : selected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-slate-50 text-slate-700'; return <label key={option.id} className={`flex h-10 items-center justify-center rounded-xl border-2 px-2 text-xs font-black uppercase ${result ? 'cursor-default' : 'cursor-pointer'} ${style}`}><input className="sr-only" type="radio" name={`pet-reading-p3-${question.id}`} checked={selected} disabled={Boolean(result)} onChange={() => onAnswer(question.id, option.id)} />{option.text}{correct && <CheckCircle2 size={14} className="ml-1" />}{selected && !correct && result && <XCircle size={14} className="ml-1" />}</label>; })}</div></fieldset>; })}</div></div>;
}

function Passage({ passage, questions, cloze = false }: { passage?: string; questions: ExamQuestion[]; cloze?: boolean }) {
  if (!passage) return <p className="text-sm font-bold text-amber-800">Chưa có bài đọc.</p>;
  const content: ReactNode[] = cloze ? passage.split(/(\[\[\d+\]\])/g).map((segment, index) => {
    const match = segment.match(/^\[\[(\d+)\]\]$/);
    if (!match) return <span key={index} className="whitespace-pre-wrap">{segment}</span>;
    const printed = Number(match[1]);
    const exists = questions.some(question => (question.displayNumber || question.number) === printed);
    return <span key={index} className={`mx-1 inline-flex min-w-16 items-center justify-center border-b-2 border-dotted px-2 font-black ${exists ? 'border-orange-600 text-orange-800' : 'border-rose-500 text-rose-700'}`}>{printed}</span>;
  }) : [<span key="text" className="whitespace-pre-wrap">{passage}</span>];
  return <div className="rounded-2xl border border-orange-300 bg-orange-50 p-5 text-base font-semibold leading-8 text-slate-900 shadow-sm" data-pet-reading-passage-frame>{content}</div>;
}

function PassageChoice({ part, answers, onAnswer, reviewResults }: Props) {
  const example = part.part === 5 ? part.examples?.[0] : undefined;
  return <div className="space-y-5" data-pet-reading-passage-player={part.part}>{example && <ExampleAnswer example={example} columns={4} />}<Passage passage={part.passage} questions={part.questions} cloze={part.part === 5} /><div className="space-y-3">{part.questions.map((question, index) => {
    const result = reviewFor(question, reviewResults);
    return <article key={question.id} className={`rounded-2xl border-2 p-4 shadow-sm ${reviewCardClass(result)}`}>
      {part.part === 5
        ? <div className="grid grid-cols-[3rem_minmax(0,1fr)] items-start gap-2" data-pet-reading-part5-answer-row>
          <p className="pt-3 text-center text-sm"><QuestionNumber question={question} fallback={index + 1} /></p>
          <ChoiceButtons question={question} answer={answers[question.id]} onAnswer={onAnswer} columns={4} result={result} />
          {result && <div className="col-span-2 flex justify-end"><ReviewBadge result={result} /></div>}
        </div>
        : <><div className="mb-3 flex items-start justify-between gap-3"><p className="flex items-start gap-2 text-sm font-bold leading-6 text-slate-900"><QuestionNumber question={question} fallback={index + 1} /><span>{question.prompt}</span></p><ReviewBadge result={result} /></div><ChoiceButtons question={question} answer={answers[question.id]} onAnswer={onAnswer} columns={4} result={result} /></>}
    </article>;
  })}</div></div>;
}

export default function PetReadingPartView(props: Props) {
  return <div id="pet-reading-player" data-pet-reading-part={props.part.part} data-review-mode={props.reviewResults ? 'true' : 'false'}>{props.part.part === 1 ? <PartOne {...props} /> : props.part.part === 2 ? <PartTwo {...props} /> : props.part.part === 3 ? <PartThree {...props} /> : <PassageChoice {...props} />}</div>;
}
