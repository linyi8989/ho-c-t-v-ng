import { useState, type ChangeEvent, type KeyboardEvent, type ReactNode } from 'react';
import { examPartUnits } from '../examStructure';
import type { ExamAnswerValue, ExamAnswers, ExamPartContent, ExamQuestion } from '../types';
import ExamImageViewer from './ExamImageViewer';
import { FlyerLetterMatchingView } from './FlyerListeningViews';
import { studentTypedAnswerGuards } from './studentTextEntryGuards';

interface Props {
  part: ExamPartContent;
  answers: ExamAnswers;
  onAnswer: (questionId: string, value: ExamAnswerValue) => void;
}

const stringAnswer = (value: ExamAnswerValue | undefined) => typeof value === 'string' ? value : '';

function Examples({ part }: { part: ExamPartContent }) {
  if (!part.examples?.length) return null;
  return <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-slate-800" data-ket-examples>
    <p className="text-xs font-black uppercase text-indigo-800">{part.examples.length > 1 ? 'Examples' : 'Example'}</p>
    {part.examples.map((example, index) => example.options?.length
      ? <div key={index} className="mt-3 grid items-center gap-2 sm:grid-cols-[3rem_repeat(3,minmax(0,1fr))_5rem]" data-ket-choice-example-row>
          <b className="text-center text-indigo-950">{example.prompt}</b>
          {example.options.slice(0, 3).map(option => <span key={option.label} className="rounded-lg border border-indigo-200 bg-white px-3 py-2 text-center font-semibold"><b className="mr-1">{option.label}.</b>{option.text}</span>)}
          <b className="rounded-lg border border-indigo-300 bg-white px-3 py-2 text-center text-indigo-950" aria-label={`Đáp án example ${example.answer}`}>{example.answer}</b>
        </div>
      : <p key={index} className="mt-2 flex flex-wrap items-baseline justify-between gap-3 font-semibold"><span>{example.prompt}</span><b className="border-b-2 border-dotted border-indigo-500 bg-white px-4 text-indigo-900">{example.answer}</b></p>)}
  </div>;
}

function TextSource({ passage, label = 'Nội dung đề' }: { passage?: string; label?: string }) {
  if (!passage?.trim()) return null;
  return <section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 sm:p-5" data-ket-text-source>
    <p className="text-xs font-black uppercase tracking-wide text-indigo-800">{label}</p>
    <div className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-7 text-slate-900">{passage}</div>
  </section>;
}

function TwoColumn({ imageUrl, children, imageAlt = 'Ảnh đề KET Reading & Writing' }: { imageUrl?: string; children: ReactNode; imageAlt?: string }) {
  return <div className="grid gap-5 lg:grid-cols-[minmax(0,44%)_minmax(0,56%)]" data-ket-two-column>
    <div className="lg:sticky lg:top-4 lg:self-start">{imageUrl ? <ExamImageViewer src={imageUrl} alt={imageAlt} maxHeight="min(70vh,680px)" className="border border-slate-200 bg-white" /> : <div className="flex min-h-80 items-center justify-center rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 p-8 text-center text-sm font-black text-amber-950">Chưa có ảnh đề hiển thị.</div>}</div>
    <div className="min-w-0 space-y-4">{children}</div>
  </div>;
}

function TopImage({ imageUrl, imageAlt = 'Ảnh đề KET Reading & Writing' }: { imageUrl?: string; imageAlt?: string }) {
  return <div className="mx-auto w-full max-w-4xl" data-ket-image-top>{imageUrl ? <ExamImageViewer src={imageUrl} alt={imageAlt} maxHeight="min(48vh,520px)" className="border border-slate-200 bg-white" /> : <div className="flex min-h-64 items-center justify-center rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 p-8 text-center text-sm font-black text-amber-950">Chưa có ảnh đề hiển thị.</div>}</div>;
}

function ChoiceRows({ unit, answers, onAnswer, showPrompt = false, stackPrompt = false }: { unit: ExamPartContent; answers: ExamAnswers; onAnswer: Props['onAnswer']; showPrompt?: boolean; stackPrompt?: boolean }) {
  return <div className="space-y-2" data-ket-choice-answer-rows>{unit.questions.map((question, index) => <fieldset key={question.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
    <legend className="sr-only">Câu {question.displayNumber || index + 1}</legend>
    {stackPrompt ? <><p className="flex min-w-0 items-start gap-2 pb-3 text-sm font-bold leading-5 text-slate-900"><b className="shrink-0 text-blue-700">{question.displayNumber || index + 1}.</b><span className="min-w-0 break-words">{question.prompt}</span></p><div className="grid grid-cols-1 gap-2 sm:grid-cols-3">{question.options.slice(0, 3).map((option, optionIndex) => { const selected = answers[question.id] === option.id; return <label key={option.id} className={`flex min-h-10 min-w-0 cursor-pointer items-center justify-center gap-1 rounded-lg border px-2 py-2 text-center text-xs font-black ${selected ? 'border-blue-700 bg-blue-700 text-white shadow-sm' : 'border-slate-300 bg-slate-50 text-slate-800'}`}><input type="radio" className="sr-only" name={`ket-choice-${question.id}`} checked={selected} onChange={() => onAnswer(question.id, option.id)} /><span>{String.fromCharCode(65 + optionIndex)}.</span><span className="min-w-0 break-words">{option.text}</span></label>; })}</div></> :
    <div className={`grid items-start gap-2 ${showPrompt ? 'sm:grid-cols-[minmax(0,1fr)_repeat(3,minmax(72px,7rem))]' : 'grid-cols-[42px_repeat(3,minmax(72px,1fr))]'}`}>
      {showPrompt ? <p className="flex min-w-0 items-start gap-2 py-2 text-sm font-bold leading-5 text-slate-900"><b className="shrink-0 text-blue-700">{question.displayNumber || index + 1}.</b><span className="min-w-0 break-words">{question.prompt}</span></p> : <b className="py-2 text-center text-blue-700">{question.displayNumber || index + 1}.</b>}
      {question.options.slice(0, 3).map((option, optionIndex) => { const selected = answers[question.id] === option.id; return <label key={option.id} className={`flex min-h-10 min-w-0 cursor-pointer items-center justify-center gap-1 rounded-lg border px-2 py-2 text-center text-xs font-black ${selected ? 'border-blue-700 bg-blue-700 text-white shadow-sm' : 'border-slate-300 bg-slate-50 text-slate-800'}`}><input type="radio" className="sr-only" name={`ket-choice-${question.id}`} checked={selected} onChange={() => onAnswer(question.id, option.id)} /><span>{String.fromCharCode(65 + optionIndex)}.</span><span className="min-w-0 break-words">{option.text}</span></label>; })}
    </div>}
  </fieldset>)}</div>;
}

function ChoicePart({ unit, answers, onAnswer, showPrompt = false, imageTop = false, withoutImage = false, hideExamples = false, stackPrompt = false }: { unit: ExamPartContent; answers: ExamAnswers; onAnswer: Props['onAnswer']; showPrompt?: boolean; imageTop?: boolean; withoutImage?: boolean; hideExamples?: boolean; stackPrompt?: boolean }) {
  const body = <>{!hideExamples && <Examples part={unit} />}<ChoiceRows unit={unit} answers={answers} onAnswer={onAnswer} showPrompt={showPrompt} stackPrompt={stackPrompt} /></>;
  return withoutImage ? <div className="mx-auto max-w-5xl space-y-4">{body}</div> : imageTop ? <div className="space-y-5"><TopImage imageUrl={unit.imageUrl} />{body}</div> : <TwoColumn imageUrl={unit.imageUrl}>{body}</TwoColumn>;
}

function CompoundPart({ part, answers, onAnswer }: Props) {
  const units = examPartUnits(part);
  const [activeGroup, setActiveGroup] = useState(0);
  const unit = units[activeGroup] || units[0];
  if (!unit) return null;
  return <div className="space-y-4" data-ket-part-three-groups data-active-group={activeGroup === 0 ? '3A' : '3B'}>
    <nav className="flex items-center justify-center gap-2" aria-label="Điều hướng Part 3">
      {units.slice(0, 2).map((candidate, index) => <button key={candidate.id} type="button" onClick={() => setActiveGroup(index)} aria-pressed={activeGroup === index} data-active={activeGroup === index} className={`ket-part-three-tab rounded-full border-2 px-5 py-2 text-sm font-black ${activeGroup === index ? 'border-blue-700 bg-blue-700 text-white' : 'border-blue-300 bg-white text-blue-800'}`}>3{index === 0 ? 'A' : 'B'}</button>)}
    </nav>
    <section className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
      <div><p className="text-xs font-black uppercase tracking-wide text-indigo-700">Part 3{activeGroup === 0 ? 'A' : 'B'}</p><h3 className="mt-1 text-lg font-black text-slate-950">{unit.title}</h3>{unit.instruction && <p className="mt-1 text-sm font-semibold text-slate-600">{unit.instruction}</p>}</div>
      {activeGroup === 0 ? <ChoicePart unit={unit} answers={answers} onAnswer={onAnswer} showPrompt imageTop hideExamples stackPrompt /> : <FlyerLetterMatchingView part={unit} answers={answers} onAnswer={onAnswer} singleImage />}
    </section>
    <div className="flex items-center justify-between gap-3"><button type="button" disabled={activeGroup === 0} onClick={() => setActiveGroup(0)} data-direction="previous" className="ket-part-three-page-nav rounded-xl border-2 border-blue-600 bg-white px-4 py-2 text-sm font-black text-blue-800">← Trang 3A</button><button type="button" disabled={activeGroup >= Math.min(1, units.length - 1)} onClick={() => setActiveGroup(1)} data-direction="next" className="ket-part-three-page-nav rounded-xl border-2 border-blue-700 bg-blue-700 px-4 py-2 text-sm font-black text-white">Trang 3B →</button></div>
  </div>;
}

function SpellingCells({ question, value, onChange }: { question: ExamQuestion; value: string; onChange: (value: string) => void }) {
  const prefix = String(question.answerPrefix || '').slice(0, 1);
  const total = Math.max(2, Number(question.answerLength) || 2);
  const restLength = total - prefix.length;
  const rawCharacters = Array.from(value) as string[];
  const raw = rawCharacters.filter(character => /[\p{L}\p{N}'-]/u.test(character)).slice(0, restLength);
  const commit = (characters: string[]) => onChange(characters.join(''));
  const handleChange = (index: number, event: ChangeEvent<HTMLInputElement>) => {
    const typedCharacters = Array.from(event.target.value) as string[];
    const typed = typedCharacters.filter(character => /[\p{L}\p{N}'-]/u.test(character));
    const next = Array.from({ length: restLength }, (_, cell) => raw[cell] || '');
    typed.slice(0, restLength - index).forEach((character, offset) => { next[index + offset] = character; });
    commit(next);
    if (typed.length) event.currentTarget.parentElement?.querySelectorAll('input')[Math.min(restLength - 1, index + typed.length)]?.focus();
  };
  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Backspace' || raw[index]) return;
    const previous = event.currentTarget.parentElement?.querySelectorAll('input')[index - 1];
    if (!previous) return;
    const next = Array.from({ length: restLength }, (_, cell) => raw[cell] || '');
    next[index - 1] = '';
    commit(next);
    previous.focus();
    event.preventDefault();
  };
  return <div className="flex min-w-0 flex-wrap items-center gap-1" aria-label={`Đáp án câu ${question.displayNumber || question.number}`}>
    {prefix && <span className="flex h-10 w-9 items-center justify-center border-b-2 border-slate-600 bg-slate-100 text-lg font-black uppercase text-slate-950">{prefix}</span>}
    {Array.from({ length: restLength }, (_, index) => <input {...studentTypedAnswerGuards} key={index} value={raw[index] || ''} maxLength={restLength} inputMode="text" autoComplete="off" aria-label={`Ký tự ${prefix.length + index + 1} câu ${question.displayNumber || question.number}`} onChange={event => handleChange(index, event)} onKeyDown={event => handleKeyDown(index, event)} className="h-10 w-9 border-0 border-b-2 border-blue-600 bg-blue-50 text-center text-lg font-black text-blue-950 outline-none focus:bg-blue-100 focus:ring-2 focus:ring-blue-300" />)}
  </div>;
}

function SpellingPart({ unit, answers, onAnswer }: { unit: ExamPartContent; answers: ExamAnswers; onAnswer: Props['onAnswer'] }) {
  return <div className="space-y-5"><TextSource passage={unit.passage} label="Hướng dẫn và example" /><div className="space-y-2">{unit.questions.map((question, index) => <div key={question.id} className="grid items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-[minmax(0,1fr)_minmax(180px,auto)]"><p className="flex min-w-0 items-start gap-2 py-2 text-sm font-bold leading-5 text-slate-900"><b className="shrink-0 text-blue-700">{question.displayNumber || index + 1}.</b><span className="min-w-0 break-words">{question.prompt}</span></p><SpellingCells question={question} value={stringAnswer(answers[question.id])} onChange={value => onAnswer(question.id, value)} /></div>)}</div></div>;
}

function NumberedRows({ unit, answers, onAnswer }: { unit: ExamPartContent; answers: ExamAnswers; onAnswer: Props['onAnswer'] }) {
  const midpoint = Math.ceil(unit.questions.length / 2);
  const columns = [unit.questions.slice(0, midpoint), unit.questions.slice(midpoint)];
  return <div className="space-y-5"><TextSource passage={unit.passage} label="Bài đọc, hướng dẫn và example" /><div className="grid gap-3 md:grid-cols-2" data-ket-numbered-gap-rows>{columns.map((questions, column) => <div key={column} className="space-y-2">{questions.map((question, offset) => { const index = column === 0 ? offset : midpoint + offset; return <label key={question.id} className="grid grid-cols-[4rem_minmax(0,1fr)] items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><b className="text-right text-blue-700">{question.displayNumber || index + 1}.</b><input {...studentTypedAnswerGuards} value={stringAnswer(answers[question.id])} onChange={event => onAnswer(question.id, event.target.value.replace(/\s+/g, ' ').split(' ').slice(0, 1).join(' '))} autoComplete="off" aria-label={`Đáp án số ${question.displayNumber || index + 1}`} className="h-10 min-w-0 border-0 border-b-2 border-dotted border-blue-600 bg-blue-50 px-3 text-center font-black text-blue-950 outline-none focus:ring-2 focus:ring-blue-200" /></label>; })}</div>)}</div></div>;
}

function FormRows({ unit, answers, onAnswer }: { unit: ExamPartContent; answers: ExamAnswers; onAnswer: Props['onAnswer'] }) {
  return <div data-ket-part8-split-layout><TwoColumn imageUrl={unit.imageUrl} imageAlt="Ảnh đề KET Reading & Writing Part 8"><div className="space-y-2" data-ket-form-rows>{unit.questions.map((question, index) => <label key={question.id} className="grid items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-[3.5rem_minmax(100px,.65fr)_minmax(150px,1fr)]"><b className="text-right text-blue-700">{question.displayNumber || index + 1}.</b><span className="min-w-0 break-words text-sm font-bold text-slate-900">{question.prompt}</span><span className="flex min-w-0 items-center overflow-hidden rounded-lg border-b-2 border-dotted border-blue-600 bg-blue-50 focus-within:ring-2 focus-within:ring-blue-200"><b className="shrink-0 pl-3 text-slate-800">{question.answerPrefix}</b><input {...studentTypedAnswerGuards} value={stringAnswer(answers[question.id])} onChange={event => onAnswer(question.id, event.target.value)} autoComplete="off" aria-label={`Đáp án ${question.prompt}`} className="h-10 min-w-0 flex-1 border-0 bg-transparent px-2 font-black text-blue-950 outline-none" /></span></label>)}</div></TwoColumn></div>;
}

function WritingPart({ unit, answers, onAnswer }: { unit: ExamPartContent; answers: ExamAnswers; onAnswer: Props['onAnswer'] }) {
  const question = unit.questions[0];
  if (!question) return null;
  const value = stringAnswer(answers[question.id]);
  const words = value.trim() ? value.trim().split(/\s+/).length : 0;
  const min = Number(question.minWords) || 1;
  const max = Number(question.maxWords) || 50;
  const update = (next: string) => {
    const nextWords = next.trim() ? next.trim().split(/\s+/).length : 0;
    if (nextWords <= max || next.length < value.length) onAnswer(question.id, next);
  };
  return <div className="space-y-5"><TextSource passage={unit.passage} label="Câu hỏi và gợi ý" /><section className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4"><p className="text-sm font-black text-indigo-950">{question.prompt}</p><p className="mt-2 text-xs font-bold text-indigo-800">Viết từ {min} đến {max} từ. Bài này được chấm theo thang điểm 10.</p></section><div className="rounded-[1.5rem] border border-slate-300 bg-white p-5 shadow-inner" data-ket-writing-page><textarea {...studentTypedAnswerGuards} value={value} onChange={event => update(event.target.value)} aria-label="Bài viết Part 9" className="min-h-[420px] w-full resize-y bg-[linear-gradient(transparent_31px,#dbeafe_32px)] bg-[length:100%_32px] p-2 text-base font-semibold leading-8 text-slate-950 outline-none" placeholder="Write your answer here…" /><p className={`mt-3 text-right text-sm font-black ${words < min ? 'text-amber-700' : words > max ? 'text-rose-700' : 'text-emerald-700'}`}>{words}/{max} từ · tối thiểu {min}</p></div></div>;
}

export default function KetReadingWritingPartView({ part, answers, onAnswer }: Props) {
  const units = examPartUnits(part);
  const unit = units[0] || part;
  return <div id="ket-reading-writing-player" data-ket-reading-writing-part={part.part}>
    {part.part === 1 ? <FlyerLetterMatchingView part={unit} answers={answers} onAnswer={onAnswer} singleImage />
      : part.part === 2 ? <ChoicePart unit={unit} answers={answers} onAnswer={onAnswer} showPrompt withoutImage stackPrompt />
        : part.part === 3 ? <CompoundPart part={part} answers={answers} onAnswer={onAnswer} />
          : part.part === 4 ? <ChoicePart unit={unit} answers={answers} onAnswer={onAnswer} showPrompt imageTop hideExamples stackPrompt />
            : part.part === 5 ? <ChoicePart unit={unit} answers={answers} onAnswer={onAnswer} imageTop />
              : part.part === 6 ? <SpellingPart unit={unit} answers={answers} onAnswer={onAnswer} />
                : part.part === 7 ? <NumberedRows unit={unit} answers={answers} onAnswer={onAnswer} />
                  : part.part === 8 ? <FormRows unit={unit} answers={answers} onAnswer={onAnswer} />
                    : <WritingPart unit={unit} answers={answers} onAnswer={onAnswer} />}
  </div>;
}
