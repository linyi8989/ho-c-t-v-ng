import type { ReactNode } from 'react';
import { examPartUnits } from '../examStructure';
import type { ExamAnswerValue, ExamAnswers, ExamPartContent, ExamQuestion } from '../types';
import ExamImageViewer from './ExamImageViewer';

interface Props {
  part: ExamPartContent;
  answers: ExamAnswers;
  onAnswer: (questionId: string, value: ExamAnswerValue) => void;
}

function TextInput({ question, value, onChange, width = 'w-40' }: { question: ExamQuestion; value: string; onChange: (value: string) => void; width?: string }) {
  const update = (next: string) => {
    const words = next.trim().split(/\s+/).filter(Boolean);
    if (!question.maxWords || words.length <= question.maxWords) onChange(next);
  };
  return <label className="inline-block max-w-full align-middle">
    <span className="sr-only">Câu trả lời {question.number}</span>
    <input value={value} autoComplete="off" onChange={event => update(event.target.value)} className={`${width} max-w-full border-0 border-b-2 border-dotted border-blue-500 bg-blue-50 px-2 py-1 text-center font-black text-blue-900 outline-none focus:bg-blue-100 focus:ring-2 focus:ring-blue-200`} />
  </label>;
}

function renderPrompt(question: ExamQuestion, input: ReactNode) {
  const source = question.prompt || '';
  const marker = /(\[\[\d+\]\]|\{\{[^}]+\}\}|_{3,}|(?:\.\s*){4,})/;
  const match = source.match(marker);
  if (!match || match.index === undefined) return <>{source} <span className="mx-1 inline-block">{input}</span></>;
  return <>{source.slice(0, match.index)}<span className="mx-1 inline-block">{input}</span>{source.slice(match.index + match[0].length)}</>;
}

function ExampleBlock({ examples }: { examples: ExamPartContent['examples'] }) {
  if (!examples?.length) return null;
  return <div className="overflow-hidden rounded-2xl border border-indigo-200 bg-indigo-50 text-sm text-slate-700">
    <p className="px-4 pt-4 text-xs font-black uppercase text-indigo-700">{examples.length > 1 ? 'Examples' : 'Example'}</p>
    <div className="space-y-3 px-4 pb-4 pt-2">{examples.map((example, index) => <p key={index} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 font-semibold"><span>{example.prompt}</span><span className="border-b-2 border-dotted border-indigo-500 bg-white/70 px-3 font-black text-indigo-800">{example.answer}</span></p>)}</div>
  </div>;
}

function Image({ src, alt, maxHeight = 'min(70vh, 680px)' }: { src?: string; alt: string; maxHeight?: string }) {
  return src
    ? <ExamImageViewer src={src} alt={alt} maxHeight={maxHeight} className="border border-slate-200 bg-white" />
    : <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm font-bold text-slate-500">Không có ảnh hiển thị.</div>;
}

function TwoColumn({ media, children }: { media: ReactNode; children: ReactNode }) {
  return <div className="grid gap-6 lg:grid-cols-[minmax(0,44%)_minmax(0,56%)]"><div className="lg:sticky lg:top-4 lg:self-start">{media}</div><div className="min-w-0 space-y-4">{children}</div></div>;
}

function YesNoQuestion({ question, index, value, onChange }: { key?: string; question: ExamQuestion; index: number; value: ExamAnswerValue | undefined; onChange: (value: string) => void }) {
  const selected = typeof value === 'string' ? value : '';
  return <fieldset className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <legend className="px-1 text-sm font-bold leading-6 text-slate-800"><b className="mr-2 text-blue-700">{index + 1}.</b>{question.prompt}</legend>
    <div className="mt-3 grid grid-cols-2 gap-3">{question.options.slice(0, 2).map(option => <label key={option.id} className={`cursor-pointer rounded-xl border p-3 text-center text-sm font-black uppercase ${selected === option.id ? 'border-blue-500 bg-blue-600 text-white' : 'border-slate-200 bg-slate-50 text-slate-700'}`}><input className="sr-only" type="radio" name={`starter-rw-${question.id}`} checked={selected === option.id} onChange={() => onChange(option.id)} />{option.text}</label>)}</div>
  </fieldset>;
}

function PartOne({ unit, answers, onAnswer }: { unit: ExamPartContent } & Omit<Props, 'part'>) {
  const example = unit.examples?.[0];
  return <div className="space-y-6">
    {example?.imageUrl && <div className="mx-auto max-w-4xl"><Image src={example.imageUrl} alt="Ảnh example Part 1" maxHeight="min(34vh, 300px)" /></div>}
    <TwoColumn media={<Image src={unit.imageUrl} alt="Ảnh bài làm Part 1" />}>{example && <ExampleBlock examples={[{ ...example, imageAssetId: undefined, imageUrl: undefined }]} />}{unit.questions.map((question, index) => <YesNoQuestion key={question.id} question={question} index={index} value={answers[question.id]} onChange={value => onAnswer(question.id, value)} />)}</TwoColumn>
  </div>;
}

function PartTwo({ unit, answers, onAnswer }: { unit: ExamPartContent } & Omit<Props, 'part'>) {
  return <TwoColumn media={<Image src={unit.imageUrl} alt="Tranh tình huống Part 2" />}><ExampleBlock examples={unit.examples} />{unit.questions.map((question, index) => <YesNoQuestion key={question.id} question={question} index={index} value={answers[question.id]} onChange={value => onAnswer(question.id, value)} />)}</TwoColumn>;
}

function PartThree({ unit, answers, onAnswer }: { unit: ExamPartContent } & Omit<Props, 'part'>) {
  return <TwoColumn media={<Image src={unit.imageUrl} alt="Trang bài tập Part 3" />}><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">{unit.questions.map((question, index) => <div key={question.id} className="border-b border-slate-100 py-4 last:border-0"><p className="text-base font-semibold leading-10 text-slate-800"><b className="mr-2 text-blue-700">{index + 1}.</b>{renderPrompt(question, <TextInput question={question} value={typeof answers[question.id] === 'string' ? answers[question.id] as string : ''} onChange={value => onAnswer(question.id, value)} />)}</p></div>)}</div></TwoColumn>;
}

function renderStory(unit: ExamPartContent, answers: ExamAnswers, onAnswer: Props['onAnswer']) {
  const byIndex = unit.questions;
  return (unit.passage || '').split(/(\[\[\d+\]\])/g).map((segment, index) => {
    const match = segment.match(/^\[\[(\d+)\]\]$/);
    if (!match) return <span key={index} className="whitespace-pre-wrap">{segment}</span>;
    const question = byIndex[Number(match[1]) - 1];
    if (!question) return <span key={index} className="font-bold text-rose-700">[Thiếu ô]</span>;
    return <span key={index} className="mx-1 inline-block"><TextInput question={question} value={typeof answers[question.id] === 'string' ? answers[question.id] as string : ''} onChange={value => onAnswer(question.id, value)} /></span>;
  });
}

function PartFour({ unit, answers, onAnswer }: { unit: ExamPartContent } & Omit<Props, 'part'>) {
  return <TwoColumn media={<Image src={unit.imageUrl} alt="Ngân hàng từ Part 4" />}><ExampleBlock examples={unit.examples} /><div className="rounded-2xl border border-slate-200 bg-white p-5 text-base font-semibold leading-10 text-slate-800 shadow-sm">{renderStory(unit, answers, onAnswer)}</div></TwoColumn>;
}

function PartFive({ unit, answers, onAnswer }: { unit: ExamPartContent } & Omit<Props, 'part'>) {
  const questions = new Map(unit.questions.map(question => [question.id, question]));
  let number = 0;
  return <div className="space-y-8">{(unit.readingScenes || []).map((scene, sceneIndex) => <section key={scene.id} className="grid gap-6 rounded-3xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-[minmax(0,44%)_minmax(0,56%)]"><div><Image src={scene.imageUrl} alt={`Tranh ${sceneIndex + 1} Part 5`} maxHeight="min(62vh, 560px)" /></div><div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="whitespace-pre-wrap text-sm font-semibold leading-7 text-slate-700">{scene.passage}</p>{sceneIndex === 0 && <ExampleBlock examples={unit.examples} />}<div className="border-t border-slate-200 pt-3">{scene.questionIds.map(questionId => {
    const question = questions.get(questionId);
    if (!question) return null;
    number += 1;
    const currentNumber = number;
    return <div key={question.id} className="py-2 text-base font-semibold leading-10 text-slate-800"><b className="mr-2 text-blue-700">{currentNumber}.</b>{renderPrompt(question, <TextInput question={question} value={typeof answers[question.id] === 'string' ? answers[question.id] as string : ''} onChange={value => onAnswer(question.id, value)} />)}</div>;
  })}</div></div></section>)}</div>;
}

export default function StarterReadingWritingPartView({ part, answers, onAnswer }: Props) {
  const unit = examPartUnits(part)[0] || part;
  const props = { unit, answers, onAnswer };
  if (part.part === 1) return <PartOne {...props} />;
  if (part.part === 2) return <PartTwo {...props} />;
  if (part.part === 3) return <PartThree {...props} />;
  if (part.part === 4) return <PartFour {...props} />;
  return <PartFive {...props} />;
}
