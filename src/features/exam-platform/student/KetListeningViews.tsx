import { examPartUnits } from '../examStructure';
import { getKetListeningImageLayout } from '../ketListeningMigration';
import type { ExamAnswerValue, ExamAnswers, ExamPartContent } from '../types';
import { FlyerLetterMatchingView } from './FlyerListeningViews';
import ExamImageViewer from './ExamImageViewer';
import { studentTypedAnswerGuards } from './studentTextEntryGuards';

interface Props {
  part: ExamPartContent;
  answers: ExamAnswers;
  onAnswer: (questionId: string, value: ExamAnswerValue) => void;
}

const stringAnswer = (value: ExamAnswerValue | undefined) => typeof value === 'string' ? value : '';

export function KetListeningExample({ unit }: { unit: ExamPartContent }) {
  const example = unit.examples?.[0];
  if (!example) return null;
  return <section className="rounded-2xl border-2 border-blue-300 bg-blue-50 p-3 text-sm text-slate-900" data-ket-listening-example>
    <p className="text-[10px] font-black uppercase tracking-wide text-blue-800">Example</p>
    <div className="mt-1 flex flex-wrap items-baseline justify-between gap-3 font-bold"><span className="min-w-0 whitespace-pre-wrap break-words">{example.prompt}</span><b className="min-w-12 border-b-2 border-dotted border-blue-600 bg-white px-3 text-center text-blue-950">{example.answer}</b></div>
    {example.imageUrl && <ExamImageViewer src={example.imageUrl} alt="Ảnh ví dụ" maxHeight="min(40vh, 320px)" className="mt-3 border border-blue-200 bg-white p-1" />}
    {!!example.options?.length && <div className="mt-3 grid gap-2 sm:grid-cols-3">{[...example.options].sort((left, right) => left.label.localeCompare(right.label)).map(option => {
      const correct = [option.label, option.text].some(value => value.trim().toLocaleLowerCase('en') === example.answer.trim().toLocaleLowerCase('en'));
      return <div key={option.label} data-ket-example-option={option.label} data-correct={correct} className="rounded-xl border-2 p-3">
        {option.imageUrl && <img src={option.imageUrl} alt={option.text || `Example ${option.label}`} className="mx-auto mb-2 h-28 max-w-full object-contain" />}
        <p className="break-words font-bold"><b>{option.label}.</b> {option.text}{correct && <span className="ml-2 inline-block text-xs font-black">✓ Đáp án đúng</span>}</p>
      </div>;
    })}</div>}
  </section>;
}

function PartOne({ unit, answers, onAnswer }: { unit: ExamPartContent } & Omit<Props, 'part'>) {
  return <div className="space-y-4"><KetListeningExample unit={unit} />
    {unit.questions.map((question, index) => {
      const layout = getKetListeningImageLayout(question);
      return <fieldset key={question.id} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" data-ket-listening-question={question.id} data-ket-image-layout={layout.kind} data-ket-listening-part1-shared-image={layout.kind === 'shared' ? '' : undefined}>
      <legend className="sr-only">Question {question.displayNumber || index + 1}</legend>
      <p className="mb-3 whitespace-pre-wrap break-words text-sm font-black text-slate-950">{question.displayNumber || index + 1}. {question.prompt}</p>
      {layout.kind === 'shared' && (question.imageUrl
        ? <ExamImageViewer src={question.imageUrl} alt={`Ảnh chung câu ${question.displayNumber || index + 1}`} maxHeight="min(48vh, 420px)" className="border border-slate-200/80 bg-white p-1" />
        : <p className="rounded-xl border border-amber-300 bg-white p-4 text-center text-sm font-black text-amber-900">Câu này chưa có ảnh chung.</p>)}
      <div className="mt-3 grid grid-cols-3 gap-2">{question.options.map((option, optionIndex) => {
        const selected = answers[question.id] === option.id;
        const imageExpected = layout.kind === 'options' && layout.optionLabels?.includes(option.label);
        return <label key={option.id} data-ket-listening-choice={option.label} data-selected={selected} className="flex min-h-12 min-w-0 cursor-pointer flex-col items-center justify-center rounded-xl border-2 p-2 text-center text-sm font-black"><input type="radio" className="sr-only" name={`ket-listening-p1-${question.id}`} checked={selected} onChange={() => onAnswer(question.id, option.id)} />
          {imageExpected && (option.imageUrl ? <img src={option.imageUrl} alt={option.text || `Ảnh ${option.label}`} className="mx-auto mb-2 h-28 w-full object-contain" /> : <span className="mb-2 text-xs">Chưa có ảnh {option.label}</span>)}
          <span className="break-words"><b>{option.label || String.fromCharCode(65 + optionIndex)}.</b>{option.text && option.text !== `Option ${option.label}` ? ` ${option.text}` : ''}</span>
        </label>;
      })}</div>
    </fieldset>; })}
  </div>;
}

function PartTwo({ unit, answers, onAnswer }: { unit: ExamPartContent } & Omit<Props, 'part'>) {
  return <div className="space-y-3"><KetListeningExample unit={unit} /><FlyerLetterMatchingView part={unit} answers={answers} onAnswer={onAnswer} singleImage /></div>;
}

function PartThree({ unit, answers, onAnswer }: { unit: ExamPartContent } & Omit<Props, 'part'>) {
  return <div className="mx-auto max-w-5xl space-y-4"><KetListeningExample unit={unit} /><div className="space-y-3" data-ket-listening-dialogue-choices>{unit.questions.map((question, index) => <fieldset key={question.id} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
    <legend className="sr-only">Question {question.displayNumber || index + 1}</legend>
    <p className="flex min-w-0 items-start gap-2 pb-3 text-sm font-black leading-6 text-slate-950"><b className="shrink-0 text-blue-700">{question.displayNumber || index + 1}.</b><span className="min-w-0 whitespace-pre-wrap break-words">{question.prompt}</span></p>
    <div className="grid gap-2 sm:grid-cols-3">{question.options.slice(0, 3).map((option, optionIndex) => {
      const selected = answers[question.id] === option.id;
      return <label key={option.id} className={`flex min-h-11 min-w-0 cursor-pointer items-center justify-center gap-1 rounded-xl border-2 px-3 py-2 text-center text-sm font-black ${selected ? 'border-blue-800 bg-blue-700 text-white shadow' : 'border-slate-300 bg-slate-50 text-slate-900'}`}><input type="radio" className="sr-only" name={`ket-listening-p3-${question.id}`} checked={selected} onChange={() => onAnswer(question.id, option.id)} /><span>{String.fromCharCode(65 + optionIndex)}.</span><span className="min-w-0 break-words">{option.text}</span></label>;
    })}</div>
  </fieldset>)}</div></div>;
}

export function ketListeningFormBodyPassage(passage?: string) {
  const raw = passage?.trim() || '';
  if (!raw) return '';
  const blocks = raw.split(/\r?\n\s*\r?\n/).map(block => block.trim()).filter(Boolean);
  if (blocks.length < 2) return raw;
  const firstBlock = blocks[0];
  const repeatsMainHeading = /(^|\n)\s*part\s*[45]\b/i.test(firstBlock)
    || /(^|\n)\s*questions?\s*\d+\s*[–—-]\s*\d+/i.test(firstBlock)
    || /\byou will hear\b|\blisten and (?:complete|answer|write)\b/i.test(firstBlock);
  return repeatsMainHeading ? blocks.slice(1).join('\n\n') : raw;
}

function FormPart({ unit, answers, onAnswer }: { unit: ExamPartContent } & Omit<Props, 'part'>) {
  const bodyPassage = ketListeningFormBodyPassage(unit.passage);
  return <div className="mx-auto max-w-5xl space-y-5">
    {bodyPassage && <section className="rounded-2xl border-2 border-blue-300 bg-blue-50 p-4 sm:p-5" data-ket-listening-text-source><p className="text-[10px] font-black uppercase tracking-wide text-blue-800">Content and example</p><div className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-7 text-slate-950">{bodyPassage}</div></section>}
    <div className="space-y-2" data-ket-listening-form-rows>{unit.questions.map((question, index) => <label key={question.id} className="grid items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-[3.5rem_minmax(120px,.8fr)_minmax(190px,1fr)]"><b className="text-right text-blue-700">{question.displayNumber || index + 1}.</b><span className="min-w-0 break-words text-sm font-bold text-slate-950">{question.prompt}</span><span className="flex min-w-0 items-center overflow-hidden rounded-lg border-b-2 border-dotted border-blue-700 bg-blue-50 focus-within:ring-2 focus-within:ring-blue-300"><b className="shrink-0 pl-3 text-slate-900">{question.answerPrefix}</b><input {...studentTypedAnswerGuards} value={stringAnswer(answers[question.id])} onChange={event => onAnswer(question.id, event.target.value)} autoComplete="off" aria-label={`Answer ${question.prompt}`} className="h-11 min-w-0 flex-1 border-0 bg-transparent px-2 font-black text-blue-950 outline-none" /><b className="shrink-0 pr-3 text-slate-900">{question.answerSuffix}</b></span></label>)}</div>
  </div>;
}

export default function KetListeningPartView({ part, answers, onAnswer }: Props) {
  const unit = examPartUnits(part)[0] || part;
  return <div id="ket-listening-player" data-ket-listening-part={part.part}>
    {part.part === 1 ? <PartOne unit={unit} answers={answers} onAnswer={onAnswer} />
      : part.part === 2 ? <PartTwo unit={unit} answers={answers} onAnswer={onAnswer} />
        : part.part === 3 ? <PartThree unit={unit} answers={answers} onAnswer={onAnswer} />
          : <FormPart unit={unit} answers={answers} onAnswer={onAnswer} />}
  </div>;
}
