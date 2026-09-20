import type { ChangeEvent, KeyboardEvent, ReactNode } from 'react';
import ExamSplitTaskLayout from '../../exam-media/ExamSplitTaskLayout';
import type { ExamImageProfile } from '../../exam-media/imageProfiles';
import { examPartUnits } from '../examStructure';
import type { ExamAnswerValue, ExamAnswers, ExamPartContent, ExamQuestion } from '../types';
import ExamImageViewer from './ExamImageViewer';
import StudentUnderlineInput from './StudentUnderlineInput';
import { studentTypedAnswerGuards } from './studentTextEntryGuards';

interface Props {
  part: ExamPartContent;
  answers: ExamAnswers;
  onAnswer: (questionId: string, value: ExamAnswerValue) => void;
}

function TextInput({ question, value, onChange, width = 'w-40', petUnderline = false }: { question: ExamQuestion; value: string; onChange: (value: string) => void; width?: string; petUnderline?: boolean }) {
  const update = (next: string) => {
    const words = next.trim().split(/\s+/).filter(Boolean);
    if (!question.maxWords || words.length <= question.maxWords) onChange(next);
  };
  return <label className="inline-block max-w-full align-middle">
    <span className="sr-only">Câu trả lời {question.number}</span>
    {petUnderline
      ? <StudentUnderlineInput value={value} autoComplete="off" onChange={event => update(event.target.value)} className={width} />
      : <input {...studentTypedAnswerGuards} value={value} autoComplete="off" onChange={event => update(event.target.value)} className={`${width} max-w-full border-0 border-b-2 border-dotted border-blue-500 bg-blue-50 px-2 py-1 text-center font-black text-blue-900 outline-none focus:bg-blue-100 focus:ring-2 focus:ring-blue-200`} />}
  </label>;
}

function promptWithoutGap(prompt: string) {
  return prompt.replace(/(\[\[\d+\]\]|\{\{[^}]+\}\}|_{3,}|(?:\.\s*){4,})/g, '').replace(/\s+([.,!?;:])/g, '$1').replace(/[ \t]{2,}/g, ' ').trim();
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

function Image({ src, alt, profile = 'split-page', maxHeight }: { src?: string; alt: string; profile?: ExamImageProfile; maxHeight?: string }) {
  return src
    ? <ExamImageViewer src={src} alt={alt} profile={profile} maxHeight={maxHeight} className="border border-slate-200 bg-white" />
    : <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm font-bold text-slate-500">Không có ảnh hiển thị.</div>;
}

function FramedImage({ src, alt, className = 'h-32', transparentFrame = false }: { src?: string; alt: string; className?: string; transparentFrame?: boolean }) {
  return <div data-starter-rw-part3-image={transparentFrame ? 'true' : undefined} className={`min-w-0 overflow-hidden ${transparentFrame ? 'bg-transparent' : 'rounded-xl border border-slate-200 bg-slate-50'} ${className}`}>
    {src ? <ExamImageViewer src={src} alt={alt} fillFrame className={transparentFrame ? 'rounded-none bg-transparent' : 'rounded-xl bg-white'} /> : <div className="flex h-full items-center justify-center p-3 text-center text-xs font-bold text-slate-400">Không có ảnh</div>}
  </div>;
}

function LargeLeftImage({ src, alt, profile }: { src?: string; alt: string; profile: ExamImageProfile }) {
  return <div className="h-[clamp(380px,64dvh,650px)] min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-2" data-starter-rw-large-image-frame>
    {src ? <ExamImageViewer src={src} alt={alt} profile={profile} fillFrame className="rounded-xl bg-white" /> : <div className="flex h-full items-center justify-center text-sm font-bold text-slate-500">Không có ảnh hiển thị.</div>}
  </div>;
}

function TwoColumn({ media, children }: { media: ReactNode; children: ReactNode }) {
  return <ExamSplitTaskLayout media={media}>{children}</ExamSplitTaskLayout>;
}

function YesNoQuestion({ question, index, value, onChange }: { key?: string; question: ExamQuestion; index: number; value: ExamAnswerValue | undefined; onChange: (value: string) => void }) {
  const selected = typeof value === 'string' ? value : '';
  return <fieldset className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <legend className="px-1 text-sm font-bold leading-6 text-slate-800"><b className="mr-2 text-blue-700">{index + 1}.</b>{question.prompt}</legend>
    <div className="mt-3 grid grid-cols-2 gap-3">{question.options.slice(0, 2).map(option => <label key={option.id} className={`cursor-pointer rounded-xl border p-3 text-center text-sm font-black uppercase ${selected === option.id ? 'border-blue-500 bg-blue-600 text-white' : 'border-slate-200 bg-slate-50 text-slate-700'}`}><input className="sr-only" type="radio" name={`starter-rw-${question.id}`} checked={selected === option.id} onChange={() => onChange(option.id)} />{option.text}</label>)}</div>
  </fieldset>;
}

function InlineYesNoQuestion({ question, index, value, onChange, imageUrl }: { key?: string; question: ExamQuestion; index: number; value: ExamAnswerValue | undefined; onChange: (value: string) => void; imageUrl?: string }) {
  const selected = typeof value === 'string' ? value : '';
  return <fieldset className={`grid items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm ${imageUrl ? 'grid-cols-[112px_minmax(0,1fr)] sm:grid-cols-[150px_minmax(0,1fr)]' : ''}`} data-starter-rw-yes-no-row>
    {imageUrl && <FramedImage src={imageUrl} alt={`Hình câu ${index + 1}`} className="h-24 sm:h-28" />}
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
      <p className="min-w-0 text-sm font-bold leading-6 text-slate-800"><b className="mr-2 text-blue-700">{index + 1}.</b>{question.prompt}</p>
      <div className="grid shrink-0 grid-cols-2 gap-2" role="radiogroup" aria-label={`Câu ${index + 1}`}>
        {question.options.slice(0, 2).map(option => <label key={option.id} data-selected={selected === option.id} className="starter-rw-inline-choice cursor-pointer rounded-xl border px-4 py-2.5 text-center text-xs font-black uppercase"><input className="sr-only" type="radio" name={`starter-rw-inline-${question.id}`} checked={selected === option.id} onChange={() => onChange(option.id)} />{option.text}</label>)}
      </div>
    </div>
  </fieldset>;
}

function PictureExampleRow({ imageUrl, prompt, answer, index }: { key?: string; imageUrl?: string; prompt: string; answer: string; index: number }) {
  return <div className="grid grid-cols-[112px_minmax(0,1fr)] items-center gap-3 rounded-2xl border border-indigo-200 bg-indigo-50 p-3 sm:grid-cols-[150px_minmax(0,1fr)]" data-starter-rw-picture-example>
    <FramedImage src={imageUrl} alt={`Hình example ${index + 1}`} className="h-24 sm:h-28" />
    <p className="grid min-w-0 items-center gap-3 text-sm font-semibold leading-6 text-slate-800 sm:grid-cols-[minmax(0,1fr)_auto]"><span><b className="mr-2 text-indigo-700">Example.</b>{prompt}</span><b className="rounded-lg border-b-2 border-dotted border-indigo-500 bg-white px-4 py-2 text-center text-indigo-900">{answer}</b></p>
  </div>;
}

export function starterSpellingCharacters(value: string, length: number) {
  const boundedLength = Math.max(1, Math.min(30, length || 1));
  return Array.from(value).filter(character => /[\p{L}\p{N}'-]/u.test(character)).slice(0, boundedLength);
}

export function updateStarterSpellingValue(value: string, length: number, index: number, input: string) {
  const boundedLength = Math.max(1, Math.min(30, length || 1));
  const current = starterSpellingCharacters(value, boundedLength);
  const typed = starterSpellingCharacters(input, boundedLength);
  const safeIndex = Math.max(0, Math.min(boundedLength - 1, index));
  const next = Array.from({ length: boundedLength }, (_, cell) => current[cell] || '');
  if (!typed.length) {
    next[safeIndex] = '';
  } else {
    const insertionIndex = next[safeIndex] || safeIndex <= current.length ? safeIndex : current.length;
    typed.slice(0, boundedLength - insertionIndex).forEach((character, offset) => { next[insertionIndex + offset] = character; });
  }
  return next.join('');
}

function SpellingAnswerCells({ answer }: { answer?: string }) {
  const characters = starterSpellingCharacters(answer || '', Math.max(1, Array.from(answer || '').length));
  return <span className="flex min-w-0 flex-wrap items-center justify-center gap-1" data-starter-rw-spelling-example aria-label={`Đáp án example: ${answer || ''}`}>
    {Array.from({ length: Math.max(1, characters.length) }, (_, index) => <span key={index} className="starter-rw-spelling-example-cell flex h-9 w-8 items-center justify-center border-b-2 text-lg font-black lowercase">{characters[index] || ''}</span>)}
  </span>;
}

function SpellingInput({ question, value, onChange }: { question: ExamQuestion; value: string; onChange: (value: string) => void }) {
  // Correct answers are deliberately removed from the playable payload. The
  // authoring/import contract carries the visible dash count separately.
  const length = Math.max(1, Math.min(30, question.answerLength || 3));
  const characters = starterSpellingCharacters(value, length);
  const inputs = (target: HTMLInputElement) => target.parentElement?.querySelectorAll<HTMLInputElement>('input');
  const handleChange = (index: number, event: ChangeEvent<HTMLInputElement>) => {
    const typed = starterSpellingCharacters(event.target.value, length);
    const insertionIndex = characters[index] || index <= characters.length ? index : characters.length;
    onChange(updateStarterSpellingValue(value, length, index, event.target.value));
    if (typed.length) inputs(event.currentTarget)?.[Math.min(length - 1, insertionIndex + typed.length)]?.focus();
  };
  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    const cells = inputs(event.currentTarget);
    if (event.key === 'ArrowLeft' && index > 0) {
      cells?.[index - 1]?.focus();
      event.preventDefault();
      return;
    }
    if (event.key === 'ArrowRight' && index < length - 1) {
      cells?.[index + 1]?.focus();
      event.preventDefault();
      return;
    }
    if (event.key !== 'Backspace' || characters[index] || index <= 0) return;
    onChange(updateStarterSpellingValue(value, length, index - 1, ''));
    cells?.[index - 1]?.focus();
    event.preventDefault();
  };
  return <span className="flex min-w-0 flex-wrap items-center justify-center gap-1" role="group" data-starter-rw-spelling-cells aria-label={`Câu trả lời ${question.displayNumber || question.number}: ${question.prompt}`}>
    <span className="sr-only">Câu trả lời {question.number}: {question.prompt}</span>
    {Array.from({ length }, (_, index) => <input {...studentTypedAnswerGuards} key={index} value={characters[index] || ''} maxLength={length} inputMode="text" autoComplete="off" aria-label={`Chữ cái ${index + 1} câu ${question.displayNumber || question.number}`} onFocus={event => event.currentTarget.select()} onChange={event => handleChange(index, event)} onKeyDown={event => handleKeyDown(index, event)} className="starter-rw-spelling-cell h-10 w-8 border-0 border-b-2 text-center text-lg font-black lowercase outline-none" />)}
  </span>;
}

function PartOne({ unit, answers, onAnswer }: { unit: ExamPartContent } & Omit<Props, 'part'>) {
  const croppedLayout = (unit.examples || []).length === 2 && (unit.examples || []).every(example => example.imageUrl) && unit.questions.every(question => question.imageUrl);
  if (croppedLayout) return <div className="mx-auto max-w-5xl space-y-3" data-starter-rw-part1-cropped-rows>
    {(unit.examples || []).map((example, index) => <PictureExampleRow key={`example-${index}`} imageUrl={example.imageUrl} prompt={example.prompt} answer={example.answer} index={index} />)}
    {unit.questions.map((question, index) => <InlineYesNoQuestion key={question.id} question={question} index={index} imageUrl={question.imageUrl} value={answers[question.id]} onChange={value => onAnswer(question.id, value)} />)}
  </div>;
  const example = unit.examples?.[0];
  return <div className="space-y-6">
    {example?.imageUrl && <div className="mx-auto max-w-4xl"><Image src={example.imageUrl} alt="Ảnh example Part 1" profile="cover" maxHeight="min(34dvh, 300px)" /></div>}
    <TwoColumn media={<Image src={unit.imageUrl} alt="Ảnh bài làm Part 1" profile="illustration" />}>{example && <ExampleBlock examples={[{ ...example, imageAssetId: undefined, imageUrl: undefined }]} />}{unit.questions.map((question, index) => <YesNoQuestion key={question.id} question={question} index={index} value={answers[question.id]} onChange={value => onAnswer(question.id, value)} />)}</TwoColumn>
  </div>;
}

function PartTwo({ unit, answers, onAnswer }: { unit: ExamPartContent } & Omit<Props, 'part'>) {
  return <TwoColumn media={<LargeLeftImage src={unit.imageUrl} alt="Tranh tình huống Part 2" profile="illustration" />}><ExampleBlock examples={unit.examples} />{unit.questions.map((question, index) => <InlineYesNoQuestion key={question.id} question={question} index={index} value={answers[question.id]} onChange={value => onAnswer(question.id, value)} />)}</TwoColumn>;
}

function PartThree({ unit, answers, onAnswer }: { unit: ExamPartContent } & Omit<Props, 'part'>) {
  const example = unit.examples?.[0];
  const croppedLayout = Boolean(example?.imageUrl && example.secondaryImageUrl) && unit.questions.every(question => question.imageUrl && question.secondaryImageUrl);
  if (croppedLayout) return <div className="mx-auto max-w-5xl space-y-3" data-starter-rw-part3-paired-rows>
    <div className="grid grid-cols-[minmax(64px,1fr)_minmax(112px,180px)_minmax(64px,1fr)] items-center gap-3 px-1 py-2 sm:grid-cols-[minmax(90px,1fr)_minmax(180px,290px)_minmax(90px,1fr)]" data-starter-rw-part3-row>
      <FramedImage src={example?.imageUrl} alt="Hình example bên trái" className="h-24 sm:h-32" transparentFrame />
      <div className="min-w-0 text-center" data-starter-rw-part3-answer><SpellingAnswerCells answer={example?.answer} /></div>
      <FramedImage src={example?.secondaryImageUrl} alt="Hình example bên phải" className="h-24 sm:h-32" transparentFrame />
    </div>
    {unit.questions.map((question, index) => <div key={question.id} className="grid grid-cols-[minmax(64px,1fr)_minmax(112px,180px)_minmax(64px,1fr)] items-center gap-3 px-1 py-2 sm:grid-cols-[minmax(90px,1fr)_minmax(180px,290px)_minmax(90px,1fr)]" data-starter-rw-part3-row>
      <FramedImage src={question.imageUrl} alt={`Hình bên trái câu ${index + 1}`} className="h-24 sm:h-32" transparentFrame />
      <div className="min-w-0" data-starter-rw-part3-answer><SpellingInput question={question} value={typeof answers[question.id] === 'string' ? answers[question.id] as string : ''} onChange={value => onAnswer(question.id, value)} /></div>
      <FramedImage src={question.secondaryImageUrl} alt={`Hình bên phải câu ${index + 1}`} className="h-24 sm:h-32" transparentFrame />
    </div>)}
  </div>;
  return <TwoColumn media={<Image src={unit.imageUrl} alt="Trang bài tập Part 3" profile="split-page" />}><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">{unit.questions.map((question, index) => <div key={question.id} className="border-b border-slate-100 py-4 last:border-0"><p className="text-base font-semibold leading-10 text-slate-800"><b className="mr-2 text-blue-700">{index + 1}.</b>{renderPrompt(question, <TextInput question={question} value={typeof answers[question.id] === 'string' ? answers[question.id] as string : ''} onChange={value => onAnswer(question.id, value)} />)}</p></div>)}</div></TwoColumn>;
}

function renderStory(unit: ExamPartContent, answers: ExamAnswers, onAnswer: Props['onAnswer']) {
  const byIndex = unit.questions;
  return (unit.passage || '').split(/(\[\[\d+\]\])/g).map((segment, index) => {
    const match = segment.match(/^\[\[(\d+)\]\]$/);
    if (!match) return <span key={index} className="whitespace-pre-wrap">{segment}</span>;
    const question = byIndex[Number(match[1]) - 1];
    if (!question) return <span key={index} className="font-bold text-rose-700">[Thiếu ô]</span>;
    return <span key={index} className="mx-1 inline-block"><TextInput question={question} value={typeof answers[question.id] === 'string' ? answers[question.id] as string : ''} onChange={value => onAnswer(question.id, value)} petUnderline /></span>;
  });
}

function PartFour({ unit, answers, onAnswer }: { unit: ExamPartContent } & Omit<Props, 'part'>) {
  return <TwoColumn media={<LargeLeftImage src={unit.imageUrl} alt="Ngân hàng từ Part 4" profile="word-bank" />}><ExampleBlock examples={unit.examples} /><div className="rounded-2xl border border-slate-200 bg-white p-5 text-base font-semibold leading-10 text-slate-800 shadow-sm">{renderStory(unit, answers, onAnswer)}</div></TwoColumn>;
}

function PartFive({ unit, answers, onAnswer }: { unit: ExamPartContent } & Omit<Props, 'part'>) {
  const questions = new Map(unit.questions.map(question => [question.id, question]));
  let number = 0;
  return <div className="space-y-8">{(unit.readingScenes || []).map((scene, sceneIndex) => <section key={scene.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4"><ExamSplitTaskLayout media={<Image src={scene.imageUrl} alt={`Tranh ${sceneIndex + 1} Part 5`} profile="story-scene" />}><div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="whitespace-pre-wrap text-sm font-semibold leading-7 text-slate-700">{scene.passage}</p>{sceneIndex === 0 && <ExampleBlock examples={unit.examples} />}<div className="border-t border-slate-200 pt-3">{scene.questionIds.map(questionId => {
    const question = questions.get(questionId);
    if (!question) return null;
    number += 1;
    const currentNumber = number;
    return <div key={question.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-2 text-base font-semibold leading-7 text-slate-800" data-starter-rw-part5-right-row><p className="min-w-0"><b className="mr-2 text-blue-700">{currentNumber}.</b>{promptWithoutGap(question.prompt)}</p><TextInput question={question} value={typeof answers[question.id] === 'string' ? answers[question.id] as string : ''} onChange={value => onAnswer(question.id, value)} width="w-44" petUnderline /></div>;
  })}</div></div></ExamSplitTaskLayout></section>)}</div>;
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
