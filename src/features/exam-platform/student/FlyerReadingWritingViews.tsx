import type { ReactNode } from 'react';
import { examPartUnits } from '../examStructure';
import type { ExamAnswerValue, ExamAnswers, ExamPartContent, ExamQuestion } from '../types';
import ExamImageViewer from './ExamImageViewer';
import { FlyerLetterMatchingView } from './FlyerListeningViews';
import StudentUnderlineInput from './StudentUnderlineInput';

interface Props {
  part: ExamPartContent;
  answers: ExamAnswers;
  onAnswer: (questionId: string, value: ExamAnswerValue) => void;
}

const stringAnswer = (value: ExamAnswerValue | undefined) => typeof value === 'string' ? value : '';

function Examples({ part }: { part: ExamPartContent }) {
  if (!part.examples?.length) return null;
  return <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-slate-700"><p className="text-xs font-black uppercase text-indigo-700">{part.examples.length > 1 ? 'Examples' : 'Example'}</p><div className="mt-2 space-y-2">{part.examples.map((example, index) => <p key={index} className="flex flex-wrap items-baseline justify-between gap-3 font-semibold"><span>{example.prompt}</span><b className="border-b-2 border-dotted border-indigo-500 bg-white/70 px-3 text-indigo-800">{example.answer}</b></p>)}</div></div>;
}

function TwoColumn({ imageUrl, optionalImage = false, balanceMediaHeight = false, children }: { imageUrl?: string; optionalImage?: boolean; balanceMediaHeight?: boolean; children: ReactNode }) {
  if (!imageUrl && optionalImage) return <div className="mx-auto max-w-4xl space-y-4">{children}</div>;
  return <div className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,44%)_minmax(0,56%)]" data-flyer-reading-balanced-layout={balanceMediaHeight ? 'true' : undefined}><div className={balanceMediaHeight ? 'h-auto min-h-72 lg:h-full lg:min-h-0' : 'lg:sticky lg:top-4 lg:self-start'} data-flyer-reading-balanced-media={balanceMediaHeight ? 'true' : undefined}>{imageUrl ? <ExamImageViewer src={imageUrl} alt="Ảnh bài Flyers Reading & Writing" maxHeight="min(70vh, 640px)" fillFrame={balanceMediaHeight} className="border border-slate-200 bg-white" /> : <div className={`rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 p-10 text-center text-sm font-black text-amber-900 ${balanceMediaHeight ? 'h-full min-h-72' : ''}`}>Chưa tải ảnh hiển thị.</div>}</div><div className="space-y-4">{children}</div></div>;
}

function ShortInput({ question, value, onChange }: { key?: number; question: ExamQuestion; value: string; onChange: (value: string) => void }) {
  const update = (next: string) => {
    const words = next.trim().split(/\s+/).filter(Boolean).length;
    if (!question.maxWords || words <= question.maxWords) onChange(next);
  };
  return <StudentUnderlineInput aria-label={`Trả lời câu ${question.number}`} value={value} onChange={event => update(event.target.value)} autoComplete="off" className="mx-2 inline-block w-40" />;
}

function InlineQuestion({ question, index, value, onChange }: { key?: string; question: ExamQuestion; index: number; value: string; onChange: (value: string) => void }) {
  const match = question.prompt.match(/(____+|\{\{[^}]+\}\})/);
  return <div className="py-2 text-base font-semibold leading-10 text-slate-800"><b className="mr-2 text-blue-700">{index + 1}.</b>{match && match.index !== undefined ? <>{question.prompt.slice(0, match.index)}<ShortInput question={question} value={value} onChange={onChange} />{question.prompt.slice(match.index + match[0].length)}</> : <>{question.prompt}<ShortInput question={question} value={value} onChange={onChange} /></>}</div>;
}

function DefinitionQuestion({ question, index, value, onChange }: { key?: string; question: ExamQuestion; index: number; value: string; onChange: (value: string) => void }) {
  const prompt = question.prompt.replace(/(____+|\{\{[^}]+\}\})/g, '').replace(/\s+/g, ' ').replace(/\s+([.,!?;:])/g, '$1').trim();
  const update = (next: string) => {
    const words = next.trim().split(/\s+/).filter(Boolean).length;
    if (!question.maxWords || words <= question.maxWords) onChange(next);
  };
  return <div className="grid min-h-12 grid-cols-[minmax(0,1fr)_9rem] items-start gap-3 border-b border-slate-100 py-2 last:border-b-0"><p className="flex min-w-0 items-start gap-2 pt-2 text-base font-semibold leading-6 text-slate-800"><b className="shrink-0 text-blue-700">{index + 1}.</b><span className="min-w-0 break-words">{prompt}</span></p><StudentUnderlineInput aria-label={`Trả lời câu ${question.number}`} value={value} onChange={event => update(event.target.value)} autoComplete="off" className="h-10 w-full self-start" /></div>;
}

function Definitions({ unit, answers, onAnswer, optionalImage = false }: { unit: ExamPartContent; answers: ExamAnswers; onAnswer: Props['onAnswer']; optionalImage?: boolean }) {
  return <TwoColumn imageUrl={unit.imageUrl} optionalImage={optionalImage} balanceMediaHeight><Examples part={unit} /><div data-flyer-reading-part1-rows className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">{unit.questions.map((question, index) => <DefinitionQuestion key={question.id} question={question} index={index} value={stringAnswer(answers[question.id])} onChange={value => onAnswer(question.id, value)} />)}</div></TwoColumn>;
}

function YesNo({ unit, answers, onAnswer }: { unit: ExamPartContent; answers: ExamAnswers; onAnswer: Props['onAnswer'] }) {
  return <TwoColumn imageUrl={unit.imageUrl} balanceMediaHeight><Examples part={unit} /><div data-flyer-reading-part2-rows className="space-y-2">{unit.questions.map((question, index) => <fieldset key={question.id} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"><legend className="sr-only">Câu {index + 1}: {question.prompt}</legend><div className="grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem] items-start gap-2"><p className="flex min-w-0 items-start gap-2 pt-2 text-sm font-bold leading-5 text-slate-800"><b className="shrink-0 text-blue-700">{index + 1}.</b><span className="min-w-0 break-words">{question.prompt}</span></p>{question.options.slice(0, 2).map(option => { const selected = answers[question.id] === option.id; return <label key={option.id} className={`flex h-10 w-full cursor-pointer items-center justify-center rounded-xl border px-2 text-xs font-black uppercase ${selected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-slate-50 text-slate-700'}`}><input className="sr-only" type="radio" name={`flyer-rw-p2-${question.id}`} checked={selected} onChange={() => onAnswer(question.id, option.id)} />{option.text}</label>; })}</div></fieldset>)}</div></TwoColumn>;
}

function StoryTitle({ unit, answers, onAnswer }: { unit: ExamPartContent; answers: ExamAnswers; onAnswer: Props['onAnswer'] }) {
  const titleQuestion = unit.questions.at(-1);
  const gaps = unit.questions.slice(0, -1);
  const story = (unit.passage || '').split(/(\[\[\d+\]\])/g).map((segment, index) => {
    const match = segment.match(/^\[\[(\d+)\]\]$/);
    if (!match) return <span key={index} className="whitespace-pre-wrap">{segment}</span>;
    const question = gaps[Number(match[1]) - 1];
    return question ? <ShortInput key={index} question={question} value={stringAnswer(answers[question.id])} onChange={value => onAnswer(question.id, value)} /> : <span key={index} className="font-black text-rose-700">[Thiếu ô]</span>;
  });
  return <div className="mx-auto max-w-6xl space-y-5" data-flyer-reading-part4-stacked>
    <div className="flex justify-center">{unit.imageUrl ? <ExamImageViewer src={unit.imageUrl} alt="Ảnh minh họa Flyers Reading & Writing Part 4" maxWidth="min(100%, 900px)" maxHeight="min(42vh, 420px)" className="border border-slate-200 bg-white" /> : <div className="w-full rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 p-10 text-center text-sm font-black text-amber-900">Chưa tải ảnh hiển thị.</div>}</div>
    <div className="space-y-4" data-flyer-reading-part4-content>
      <Examples part={unit} />
      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-base font-semibold leading-10 text-slate-800 shadow-sm">{story}</div>
      {titleQuestion && <fieldset className="rounded-2xl border border-orange-200 bg-orange-50 p-4"><legend className="px-1 text-base font-black text-slate-900">{gaps.length + 1}. {titleQuestion.prompt}</legend><div className="mt-3 grid gap-3 md:grid-cols-3">{titleQuestion.options.slice(0, 3).map((option, index) => <label key={option.id} className={`cursor-pointer rounded-xl border p-3 text-sm font-bold ${answers[titleQuestion.id] === option.id ? 'border-orange-500 bg-orange-500 text-white' : 'border-orange-200 bg-white text-slate-700'}`}><input type="radio" name={`flyer-rw-title-${titleQuestion.id}`} checked={answers[titleQuestion.id] === option.id} onChange={() => onAnswer(titleQuestion.id, option.id)} className="mr-2" /><b>{String.fromCharCode(65 + index)}.</b> {option.text}</label>)}</div></fieldset>}
    </div>
  </div>;
}

function StoryCompletion({ unit, answers, onAnswer }: { unit: ExamPartContent; answers: ExamAnswers; onAnswer: Props['onAnswer'] }) {
  return <TwoColumn imageUrl={unit.imageUrl}><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">{unit.questions.map((question, index) => <InlineQuestion key={question.id} question={question} index={index} value={stringAnswer(answers[question.id])} onChange={value => onAnswer(question.id, value)} />)}</div></TwoColumn>;
}

function MarkerPassage({ unit, answers, onAnswer }: { unit: ExamPartContent; answers: ExamAnswers; onAnswer: Props['onAnswer'] }) {
  const content = (unit.passage || '').split(/(\[\[\d+\]\])/g).map((segment, index) => {
    const match = segment.match(/^\[\[(\d+)\]\]$/);
    if (!match) return <span key={index} className="whitespace-pre-wrap">{segment}</span>;
    const question = unit.questions[Number(match[1]) - 1];
    if (!question) return <span key={index} className="font-black text-rose-700">[Thiếu ô]</span>;
    return <ShortInput key={index} question={question} value={stringAnswer(answers[question.id])} onChange={value => onAnswer(question.id, value)} />;
  });
  return <div className="mx-auto max-w-5xl space-y-5">{unit.imageUrl && <ExamImageViewer src={unit.imageUrl} alt="Ảnh minh họa bài đọc" maxHeight="min(42vh, 360px)" className="border border-slate-200 bg-white" />}<Examples part={unit} /><div className="rounded-2xl border border-slate-200 bg-white p-5 text-base font-semibold leading-10 text-slate-800 shadow-sm">{content}</div></div>;
}

function ImageChoiceRows({ unit, answers, onAnswer }: { unit: ExamPartContent; answers: ExamAnswers; onAnswer: Props['onAnswer'] }) {
  return <TwoColumn imageUrl={unit.imageUrl} balanceMediaHeight><div className="space-y-2">{unit.questions.map((question, index) => <fieldset key={question.id} className="grid items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-[42px_repeat(3,minmax(0,1fr))]"><legend className="sr-only">Câu {index + 1}</legend><b className="text-center text-blue-700">{index + 1}.</b>{question.options.slice(0, 3).map((option, optionIndex) => { const selected = answers[question.id] === option.id; return <label key={option.id} className={`flex min-w-0 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${selected ? 'border-blue-500 bg-blue-50 text-blue-900' : 'border-slate-200 bg-slate-50 text-slate-700'}`}><input type="radio" name={`flyer-rw-p6-${question.id}`} checked={selected} onChange={() => onAnswer(question.id, option.id)} className="shrink-0" /><span className="min-w-0 break-words"><b>{String.fromCharCode(65 + optionIndex)}.</b> {option.text}</span></label>; })}</fieldset>)}</div></TwoColumn>;
}

export default function FlyerReadingWritingPartView({ part, answers, onAnswer }: Props) {
  const unit = examPartUnits(part)[0] || part;
  if (part.part === 2) return <YesNo unit={unit} answers={answers} onAnswer={onAnswer} />;
  if (part.part === 3) return <FlyerLetterMatchingView part={unit} answers={answers} onAnswer={onAnswer} />;
  if (part.part === 4) return <StoryTitle unit={unit} answers={answers} onAnswer={onAnswer} />;
  if (part.part === 5) return <StoryCompletion unit={unit} answers={answers} onAnswer={onAnswer} />;
  if (part.part === 6) return <ImageChoiceRows unit={unit} answers={answers} onAnswer={onAnswer} />;
  if (part.part === 7) return <MarkerPassage unit={unit} answers={answers} onAnswer={onAnswer} />;
  return <Definitions unit={unit} answers={answers} onAnswer={onAnswer} />;
}
