import type { ReactNode } from 'react';
import type {
  MoverReadingWritingAnswers,
  MoverReadingWritingChoiceQuestion,
  MoverReadingWritingPart1,
  MoverReadingWritingPart2,
  MoverReadingWritingPart3,
  MoverReadingWritingPart4,
  MoverReadingWritingPart5,
  MoverReadingWritingPart6,
} from '../types';

interface AnswerProps {
  answers: MoverReadingWritingAnswers;
  onAnswers: (update: (answers: MoverReadingWritingAnswers) => MoverReadingWritingAnswers) => void;
}

function Layout({ imageUrl, imageAlt, children }: { imageUrl?: string; imageAlt: string; children: ReactNode }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,44%)_minmax(0,56%)]">
      <div className="lg:sticky lg:top-4 lg:self-start">
        {imageUrl ? <img src={imageUrl} alt={imageAlt} className="mx-auto max-h-[72vh] w-full rounded-2xl border border-slate-200 bg-white object-contain" /> : <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm font-bold text-slate-500">Không có ảnh hiển thị.</div>}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

const EXAMPLE_BLANK = /(\[\[\s*example\s*\]\]|\{\{[^}]+\}\}|_{3,}|(?:\.\s*){4,})/i;

function Example({ prompt, answer }: { prompt?: string; answer?: string }) {
  if (!prompt && !answer) return null;
  const source = String(prompt || '');
  const blank = answer ? source.match(EXAMPLE_BLANK) : null;
  const blankIndex = blank?.index ?? -1;
  const blankToken = blank?.[0] || '';
  return <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-slate-700"><p className="text-xs font-black uppercase text-indigo-700">Example</p><p className="mt-2 font-semibold leading-8">{blankIndex >= 0 ? <>{source.slice(0, blankIndex)}<span className="inline-block border-b-2 border-dotted border-indigo-500 bg-white/70 px-3 font-black text-indigo-800">{answer}</span>{source.slice(blankIndex + blankToken.length)}</> : <>{source} {answer && <span className="inline-block border-b-2 border-dotted border-indigo-500 bg-white/70 px-3 font-black text-indigo-800">{answer}</span>}</>}</p></div>;
}

function Examples({ items }: { items: Array<{ prompt: string; answer: string }> }) {
  if (!items.length) return null;
  return (
    <div className="overflow-hidden rounded-2xl border border-indigo-200 bg-indigo-50 text-sm text-slate-700">
      <p className="px-4 pt-4 text-xs font-black uppercase text-indigo-700">Examples</p>
      <div className="space-y-3 px-4 pb-4 pt-2">
        {items.map((example, index) => (
          <p key={`${example.prompt}-${index}`} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 font-semibold">
            <span>{example.prompt}</span>
            <span className="border-b-2 border-dotted border-indigo-500 bg-white/70 px-3 font-black text-indigo-800">{example.answer}</span>
          </p>
        ))}
      </div>
    </div>
  );
}

function InlineAnswerInput({ value, onChange, label, maxWords, width = 'w-40' }: { value: string; onChange: (value: string) => void; label: string; maxWords?: number; width?: string }) {
  const update = (next: string) => {
    const wordCount = next.trim().split(/\s+/).filter(Boolean).length;
    if (!maxWords || wordCount <= maxWords) onChange(next);
  };
  return (
    <label>
      <span className="sr-only">{label}</span>
      <input value={value} onChange={event => update(event.target.value)} autoComplete="off" className={`${width} max-w-full border-0 border-b-2 border-dotted border-blue-500 bg-blue-50 px-2 py-1 text-center font-black text-blue-900 outline-none focus:bg-blue-100 focus:ring-2 focus:ring-blue-200`} />
    </label>
  );
}

function InlineTextQuestion({ number, questionId, prompt, value, onChange, maxWords }: { number: number; questionId: string; prompt: string; value: string; onChange: (value: string) => void; maxWords?: number }) {
  return (
    <div className="block py-2 text-base font-semibold leading-10 text-slate-800">
      <b className="mr-2 text-blue-700">{number}.</b>
      {renderTemplate(prompt, id => id === questionId ? (
        <InlineAnswerInput value={value} onChange={onChange} label={`Câu trả lời ${number}`} maxWords={maxWords} />
      ) : <span className="font-bold text-rose-700">[Thiếu ô]</span>)}
    </div>
  );
}

function ChoiceQuestion({ number, question, value, onChange }: { number: number; question: MoverReadingWritingChoiceQuestion; value: string; onChange: (value: string) => void }) {
  return (
    <fieldset className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <legend className="px-1 text-sm font-bold leading-6 text-slate-800"><b className="mr-2 text-blue-700">{number}.</b>{question.prompt}</legend>
      <div className="mt-3 grid gap-2">
        {question.options.map((option, index) => (
          <label key={option.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm font-semibold ${value === option.id ? 'border-blue-500 bg-blue-50 text-blue-900' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
            <input type="radio" name={`rw-${question.id}`} checked={value === option.id} onChange={() => onChange(option.id)} />
            <span><b>{String.fromCharCode(65 + index)}.</b> {option.text}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function renderTemplate(template: string, renderGap: (id: string, index: number) => ReactNode) {
  let gapIndex = 0;
  return template.split(/(\{\{[^}]+\}\})/g).map((segment, index) => {
    const match = segment.match(/^\{\{([^}]+)\}\}$/);
    if (!match) return <span key={`text-${index}`} className="whitespace-pre-wrap">{segment}</span>;
    const current = gapIndex++;
    return <span key={`gap-${match[1]}-${index}`} className="mx-1 inline-flex align-middle">{renderGap(match[1], current)}</span>;
  });
}

export function ReadingPart1View({ part, answers, onAnswers }: { part: MoverReadingWritingPart1 } & AnswerProps) {
  return <Layout imageUrl={part.wordBankUrl} imageAlt="Ngân hàng từ Part 1"><Example prompt={part.example?.prompt} answer={part.example?.answer} /><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">{part.questions.map((question, index) => <div key={question.id} className="contents"><InlineTextQuestion number={index + 1} questionId={question.id} prompt={question.prompt} value={answers.part1[question.id] || ''} onChange={value => onAnswers(current => ({ ...current, part1: { ...current.part1, [question.id]: value } }))} /></div>)}</div></Layout>;
}

export function ReadingPart2View({ part, answers, onAnswers }: { part: MoverReadingWritingPart2 } & AnswerProps) {
  return <Layout imageUrl={part.sceneUrl} imageAlt="Tranh tình huống Part 2"><Examples items={part.examples} />{part.questions.map((question, index) => <fieldset key={question.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><legend className="px-1 text-sm font-bold leading-6 text-slate-800"><b className="mr-2 text-blue-700">{index + 1}.</b>{question.statement}</legend><div className="mt-3 grid grid-cols-2 gap-3">{(['yes', 'no'] as const).map(value => <label key={value} className={`cursor-pointer rounded-xl border p-3 text-center text-sm font-black uppercase ${answers.part2[question.id] === value ? 'border-blue-500 bg-blue-600 text-white' : 'border-slate-200 bg-slate-50 text-slate-700'}`}><input className="sr-only" type="radio" name={`rw-p2-${question.id}`} checked={answers.part2[question.id] === value} onChange={() => onAnswers(current => ({ ...current, part2: { ...current.part2, [question.id]: value } }))} />{value}</label>)}</div></fieldset>)}</Layout>;
}

export function ReadingPart3View({ part, answers, onAnswers }: { part: MoverReadingWritingPart3 } & AnswerProps) {
  return <Layout imageUrl={part.sceneUrl} imageAlt="Hội thoại Part 3">{part.example && <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4"><p className="text-xs font-black uppercase text-indigo-700">Example</p><p className="mt-2 text-sm font-bold">{part.example.prompt}</p></div>}{part.questions.map((question, index) => <div key={question.id} className="contents"><ChoiceQuestion number={index + 1} question={question} value={answers.part3[question.id] || ''} onChange={value => onAnswers(current => ({ ...current, part3: { ...current.part3, [question.id]: value } }))} /></div>)}</Layout>;
}

export function ReadingPart4View({ part, answers, onAnswers }: { part: MoverReadingWritingPart4 } & AnswerProps) {
  return <Layout imageUrl={part.wordBankUrl} imageAlt="Ngân hàng từ Part 4"><Example prompt={part.example?.prompt} answer={part.example?.answer} /><div className="rounded-2xl border border-slate-200 bg-white p-5 text-base font-semibold leading-10 text-slate-800 shadow-sm">{renderTemplate(part.storyTemplate, (id, index) => <InlineAnswerInput value={answers.part4.gaps[id] || ''} onChange={value => onAnswers(current => ({ ...current, part4: { ...current.part4, gaps: { ...current.part4.gaps, [id]: value } } }))} label={`Chỗ trống ${index + 1}`} />)}</div><ChoiceQuestion number={7} question={part.titleQuestion} value={answers.part4.titleOptionId} onChange={titleOptionId => onAnswers(current => ({ ...current, part4: { ...current.part4, titleOptionId } }))} /></Layout>;
}

export function ReadingPart5View({ part, answers, onAnswers }: { part: MoverReadingWritingPart5 } & AnswerProps) {
  let questionNumber = 0;
  return <div className="space-y-8">{part.scenes.map((scene, sceneIndex) => <section key={scene.id} className="grid gap-6 rounded-3xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-[minmax(0,44%)_minmax(0,56%)]"><div>{scene.imageUrl ? <img src={scene.imageUrl} alt={`Tranh ${sceneIndex + 1} Part 5`} className="w-full rounded-2xl border border-slate-200 bg-white object-contain" /> : null}</div><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="whitespace-pre-wrap text-sm font-semibold leading-7 text-slate-700">{scene.passage}</p><div className="mt-4 border-t border-slate-200 pt-3">{scene.questions.map(question => { questionNumber += 1; const number = questionNumber; return <div key={question.id} className="contents"><InlineTextQuestion number={number} questionId={question.id} prompt={question.prompt} value={answers.part5[question.id] || ''} maxWords={3} onChange={value => onAnswers(current => ({ ...current, part5: { ...current.part5, [question.id]: value } }))} /></div>; })}</div></div></section>)}</div>;
}

export function ReadingPart6View({ part, answers, onAnswers }: { part: MoverReadingWritingPart6 } & AnswerProps) {
  const byId = new Map(part.gaps.map(gap => [gap.id, gap]));
  const passageTemplate = part.passageTemplate.replace(/\[\[\s*example\s*\]\]/gi, part.example?.answer || '');
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,44%)_minmax(0,56%)]">
      <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        {part.illustrationUrl ? <img src={part.illustrationUrl} alt="Ảnh bài đọc Part 6" className="mx-auto max-h-[54vh] w-full rounded-2xl border border-slate-200 bg-white object-contain" /> : null}
        {part.optionsUrl ? <img src={part.optionsUrl} alt="Bảng lựa chọn Part 6" className="mx-auto max-h-[34vh] w-full rounded-2xl border border-slate-200 bg-white object-contain" /> : null}
        {!part.illustrationUrl && !part.optionsUrl ? <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm font-bold text-slate-500">Không có ảnh hiển thị.</div> : null}
      </div>
      <div className="space-y-4">
        <h3 className="text-center text-2xl font-black text-slate-900">{part.passageTitle}</h3>
        <Example prompt={part.example?.prompt} answer={part.example?.answer} />
        <div className="rounded-2xl border border-slate-200 bg-white p-5 text-base font-semibold leading-10 text-slate-800 shadow-sm">{renderTemplate(passageTemplate, (id, index) => { const gap = byId.get(id); if (!gap) return <span className="text-rose-700">[Thiếu ô {index + 1}]</span>; return <InlineAnswerInput value={answers.part6[id] || ''} onChange={value => onAnswers(current => ({ ...current, part6: { ...current.part6, [id]: value } }))} label={`Chỗ trống ${index + 1}`} maxWords={1} width="w-32" />; })}</div>
      </div>
    </div>
  );
}
