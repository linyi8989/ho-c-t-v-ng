import { examPartUnits } from '../examStructure';
import type { ExamAnswerValue, ExamAnswers, ExamDisplayExample, ExamPartContent, ExamQuestion } from '../types';
import { StarterImageOptionsView } from './StarterInteractions';
import ExamImageViewer from './ExamImageViewer';
import { studentTypedAnswerGuards } from './studentTextEntryGuards';

interface Props {
  part: ExamPartContent;
  answers: ExamAnswers;
  onAnswer: (questionId: string, value: ExamAnswerValue) => void;
}

const stringAnswer = (value: ExamAnswerValue | undefined) => typeof value === 'string' ? value : '';

export type PetListeningFormSegment =
  | { type: 'text'; text: string }
  | { type: 'question'; question: ExamQuestion };

/**
 * Replaces explicit [[printed question number]] markers with their canonical
 * question without changing question IDs or answer storage. Older imported
 * papers without markers keep working: their fields are returned as fallback
 * rows, still inside the same form card.
 */
export function petListeningFormLayout(unit: ExamPartContent) {
  const passage = unit.passage || '';
  const byPrintedNumber = new Map(unit.questions.map(question => [String(question.displayNumber || question.number), question]));
  const usedQuestionIds = new Set<string>();
  const segments: PetListeningFormSegment[] = [];
  const markerPattern = /\[\[[ \t]*(\d+)[ \t]*\]\]|\([ \t]*(\d+)[ \t]*\)[ \t]*(?:(?:\.[ \t]*){3,}|(?:_[ \t]*){3,}|(?:…[ \t]*){2,})/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = markerPattern.exec(passage))) {
    if (match.index > cursor) segments.push({ type: 'text', text: passage.slice(cursor, match.index) });
    const question = byPrintedNumber.get(match[1] || match[2]);
    if (question && !usedQuestionIds.has(question.id)) {
      segments.push({ type: 'question', question });
      usedQuestionIds.add(question.id);
    } else {
      segments.push({ type: 'text', text: match[0] });
    }
    cursor = markerPattern.lastIndex;
  }
  if (cursor < passage.length) segments.push({ type: 'text', text: passage.slice(cursor) });

  return {
    segments,
    fallbackQuestions: unit.questions.filter(question => !usedQuestionIds.has(question.id)),
  };
}

function InlineFormAnswer({ question, value, onChange, showNumber = false }: { key?: string; question: ExamQuestion; value: ExamAnswerValue | undefined; onChange: (value: string) => void; showNumber?: boolean }) {
  return <label className="mx-1 inline-flex max-w-full items-baseline align-middle" data-pet-listening-inline-answer={question.id}>
    <span className="sr-only">Answer {question.displayNumber || question.number}: {question.prompt}</span>
    {showNumber && <b className="mr-1 text-blue-700">({question.displayNumber || question.number})</b>}
    {!showNumber && question.answerPrefix && <b className="mr-1 text-slate-900">{question.answerPrefix}</b>}
    <input {...studentTypedAnswerGuards} value={stringAnswer(value)} onChange={event => onChange(event.target.value)} autoComplete="off" aria-label={`Answer ${question.displayNumber || question.number}: ${question.prompt}`} className="h-9 w-36 max-w-full border-0 border-b-2 border-dotted border-blue-700 bg-white/80 px-2 text-center font-black text-blue-950 outline-none focus:border-blue-900 focus:ring-2 focus:ring-blue-200 sm:w-44" />
    {!showNumber && question.answerSuffix && <b className="ml-1 text-slate-900">{question.answerSuffix}</b>}
  </label>;
}

export function PetListeningExampleView({ example }: { example?: ExamDisplayExample }) {
  if (!example) return null;
  const options = (example.options || []).slice(0, 3);
  const hasThreeImages = options.length === 3 && options.every(option => option.imageUrl);
  return <section className="rounded-2xl border-2 border-blue-300 bg-blue-50 p-4" data-pet-listening-example>
    <p className="text-xs font-black uppercase tracking-wide text-blue-800">Example</p>
    <p className="mt-2 text-sm font-black text-slate-950">{example.prompt}</p>
    {hasThreeImages
      ? <div className="mt-3 grid grid-cols-3 gap-3">{options.map((option, optionIndex) => {
          const correct = option.label.toUpperCase() === example.answer.toUpperCase();
          return <div key={option.label} aria-label={`Example ${option.label}${correct ? ', correct answer' : ''}`} className={`rounded-2xl border-4 bg-white p-2 ${correct ? 'border-emerald-500 shadow-lg ring-2 ring-emerald-200' : 'border-sky-200'}`}>
            <img src={option.imageUrl} alt={option.text || `Example ${option.label}`} className="listening-image-option h-32 w-full object-contain" />
            <span className={`mx-auto mt-1 flex w-8 items-center justify-center rounded-full py-1 text-xs font-black text-white ${correct ? 'bg-emerald-600' : 'bg-sky-500'}`}>{option.label || String.fromCharCode(65 + optionIndex)}</span>
            <input type="radio" checked={correct} readOnly tabIndex={-1} aria-hidden="true" className="mx-auto mt-2 block h-5 w-5 accent-emerald-600" />
            {correct && <p className="mt-1 text-center text-[10px] font-black uppercase text-emerald-800">Correct answer</p>}
          </div>;
        })}</div>
      : example.imageUrl
        ? <ExamImageViewer src={example.imageUrl} alt="PET Listening Part 1 example" profile="illustration" maxHeight="min(40vh, 360px)" className="mt-3 border border-blue-200 bg-white p-2" />
        : <p className="mt-3 rounded-xl border border-amber-300 bg-white p-3 text-xs font-bold text-amber-900">Example chưa có đủ ba ảnh A/B/C.</p>}
    {!hasThreeImages && <p className="mt-3 text-sm font-black text-blue-950">Answer: <span className="inline-flex min-w-10 justify-center rounded-lg bg-emerald-600 px-3 py-1 text-white">{example.answer}</span></p>}
  </section>;
}

function PartOne({ unit, answers, onAnswer }: { unit: ExamPartContent } & Omit<Props, 'part'>) {
  const example = unit.examples?.[0];
  return <div className="mx-auto max-w-6xl space-y-4" data-pet-listening-part1-player>
    <PetListeningExampleView example={example} />
    <StarterImageOptionsView part={unit} answers={answers} onAnswer={onAnswer} />
  </div>;
}

function PartTwo({ unit, answers, onAnswer }: { unit: ExamPartContent } & Omit<Props, 'part'>) {
  return <div className="mx-auto max-w-5xl space-y-3" data-pet-listening-part2-player>{unit.questions.map((question, index) => <fieldset key={question.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <legend className="sr-only">Question {question.displayNumber || index + 1}</legend>
    <p className="flex min-w-0 items-start gap-2 pb-3 text-sm font-black leading-6 text-slate-950"><b className="shrink-0 text-blue-700">{question.displayNumber || index + 1}.</b><span className="min-w-0 whitespace-pre-wrap break-words">{question.prompt}</span></p>
    <div className="grid gap-2 sm:grid-cols-3">{question.options.slice(0, 3).map((option, optionIndex) => {
      const selected = answers[question.id] === option.id;
      return <label key={option.id} className={`flex min-h-12 min-w-0 cursor-pointer items-center justify-center gap-1 rounded-xl border-2 px-3 py-2 text-center text-sm font-black ${selected ? 'border-blue-800 bg-blue-700 text-white shadow' : 'border-slate-300 bg-slate-50 text-slate-900'}`}><input type="radio" className="sr-only" name={`pet-listening-p2-${question.id}`} checked={selected} onChange={() => onAnswer(question.id, option.id)} /><span>{String.fromCharCode(65 + optionIndex)}.</span><span className="min-w-0 break-words">{option.text}</span></label>;
    })}</div>
  </fieldset>)}</div>;
}

function PartThree({ unit, answers, onAnswer }: { unit: ExamPartContent } & Omit<Props, 'part'>) {
  const layout = petListeningFormLayout(unit);
  return <div className="mx-auto max-w-5xl" data-pet-listening-part3-player>
    <section className="rounded-2xl border-2 border-blue-300 bg-blue-50 p-4 shadow-sm sm:p-6" data-pet-listening-inline-form>
      <p className="text-[10px] font-black uppercase tracking-wide text-blue-800">Content and example</p>
      <div className="mt-3 rounded-xl border border-blue-200 bg-white/75 p-4 text-sm font-semibold leading-9 text-slate-950 sm:p-5">
        <div className="whitespace-pre-wrap">{layout.segments.map((segment, index) => segment.type === 'text'
          ? <span key={`text-${index}`}>{segment.text}</span>
          : <InlineFormAnswer key={segment.question.id} question={segment.question} value={answers[segment.question.id]} onChange={value => onAnswer(segment.question.id, value)} showNumber />)}</div>
        {layout.fallbackQuestions.length > 0 && <div className="mt-4 divide-y divide-blue-100 border-t border-blue-200" data-pet-listening-form-fallback>{layout.fallbackQuestions.map((question, index) => <div key={question.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3">
          <p className="min-w-0 text-sm font-bold leading-6 text-slate-950"><b className="mr-2 text-blue-700">{question.displayNumber || index + 1}.</b>{question.prompt}</p>
          <InlineFormAnswer question={question} value={answers[question.id]} onChange={value => onAnswer(question.id, value)} />
        </div>)}</div>}
      </div>
    </section>
  </div>;
}

function PartFour({ unit, answers, onAnswer }: { unit: ExamPartContent } & Omit<Props, 'part'>) {
  return <div className="mx-auto max-w-5xl space-y-2" data-pet-listening-part4-player>{unit.questions.map((question, index) => <div key={question.id} role="radiogroup" aria-labelledby={`pet-listening-part4-question-${question.id}`} className="grid grid-cols-[minmax(0,1fr)_5rem_5rem] items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm sm:grid-cols-[minmax(0,1fr)_6rem_6rem] sm:gap-3 sm:p-3" data-pet-listening-part4-row>
    <p id={`pet-listening-part4-question-${question.id}`} className="min-w-0 break-words text-sm font-bold leading-6 text-slate-900"><b className="mr-2 text-blue-700">{question.displayNumber || index + 1}.</b>{question.prompt}</p>
    {question.options.slice(0, 2).map(option => {
      const selected = answers[question.id] === option.id;
      return <label key={option.id} className={`flex h-10 w-full cursor-pointer items-center justify-center rounded-lg border-2 px-2 text-center text-xs font-black uppercase sm:h-11 sm:text-sm ${selected ? 'border-blue-900 bg-blue-700 text-white shadow' : 'border-slate-300 bg-slate-50 text-slate-900 hover:border-blue-500 hover:bg-blue-50'}`}><input className="sr-only" type="radio" name={`pet-listening-p4-${question.id}`} checked={selected} onChange={() => onAnswer(question.id, option.id)} />{option.text}</label>;
    })}
  </div>)}</div>;
}

export default function PetListeningPartView({ part, answers, onAnswer }: Props) {
  const unit = examPartUnits(part)[0] || part;
  return <div id="pet-listening-player" data-pet-listening-part={part.part}>
    {part.part === 1 ? <PartOne unit={unit} answers={answers} onAnswer={onAnswer} />
      : part.part === 2 ? <PartTwo unit={unit} answers={answers} onAnswer={onAnswer} />
        : part.part === 3 ? <PartThree unit={unit} answers={answers} onAnswer={onAnswer} />
          : <PartFour unit={unit} answers={answers} onAnswer={onAnswer} />}
  </div>;
}
