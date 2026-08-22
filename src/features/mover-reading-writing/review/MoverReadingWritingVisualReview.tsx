import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleMinus,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type {
  MoverReadingWritingVisualReviewBaseItem,
  MoverReadingWritingVisualReviewChoiceItem,
  MoverReadingWritingVisualReviewExample,
  MoverReadingWritingVisualReviewPart,
  MoverReadingWritingVisualReviewSnapshot,
  MoverReadingWritingVisualReviewState,
} from '../types';
import { MOVER_READING_WRITING_PART_COUNTS, MOVER_READING_WRITING_TOTAL_QUESTIONS } from '../types';

interface Props {
  snapshot: MoverReadingWritingVisualReviewSnapshot;
  compact?: boolean;
}

function itemsForPart(part: MoverReadingWritingVisualReviewPart) {
  if (part.part === 4) return [...part.gaps, part.titleItem];
  if (part.part === 5) return part.scenes.flatMap(scene => scene.items);
  return part.items;
}

export function isMoverReadingWritingVisualReviewSnapshot(
  value: unknown,
): value is MoverReadingWritingVisualReviewSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const source = value as Record<string, unknown>;
  if (source.schemaVersion !== 1 || source.totalCount !== MOVER_READING_WRITING_TOTAL_QUESTIONS) return false;
  if (!Array.isArray(source.parts) || source.parts.length !== 6) return false;
  const serialized = JSON.stringify(source);
  if (serialized.length > 750_000) return false;
  if (/"(?:questionId|correctOptionId|acceptedAnswers|assetId|passageSource(?:AssetId|Url))"\s*:/i.test(serialized)) return false;
  return source.parts.every((part, index) => {
    if (!part || typeof part !== 'object' || Number((part as any).part) !== index + 1) return false;
    try {
      return itemsForPart(part as MoverReadingWritingVisualReviewPart).length === MOVER_READING_WRITING_PART_COUNTS[index];
    } catch {
      return false;
    }
  });
}

const stateClasses = (state: MoverReadingWritingVisualReviewState) => (
  state === 'correct'
    ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
    : state === 'incorrect'
      ? 'border-rose-300 bg-rose-50 text-rose-950'
      : 'border-amber-300 bg-amber-50 text-amber-950'
);

const stateLabel = (state: MoverReadingWritingVisualReviewState) => (
  state === 'correct' ? 'Đúng' : state === 'incorrect' ? 'Sai' : 'Bỏ trống'
);

function StateIcon({ state, size = 21 }: { state: MoverReadingWritingVisualReviewState; size?: number }) {
  if (state === 'correct') return <CheckCircle2 size={size} className="shrink-0 text-emerald-600" aria-hidden="true" />;
  if (state === 'incorrect') return <XCircle size={size} className="shrink-0 text-rose-600" aria-hidden="true" />;
  return <CircleMinus size={size} className="shrink-0 text-amber-600" aria-hidden="true" />;
}

function ExampleBlock({ examples }: { examples: MoverReadingWritingVisualReviewExample[] }) {
  if (!examples.length) return null;
  return (
    <div className="overflow-hidden rounded-2xl border border-indigo-200 bg-indigo-50 text-sm text-slate-700">
      <p className="px-4 pt-4 text-xs font-black uppercase text-indigo-700">
        {examples.length > 1 ? 'Examples' : 'Example'}
      </p>
      <div className="divide-y divide-indigo-200">
        {examples.map((example, index) => (
          <div key={`${example.prompt}-${index}`} className="px-4 py-3">
            {example.prompt && <p className="font-semibold leading-6">{example.prompt}</p>}
            {example.answer && <p className="mt-1 font-black text-indigo-800">{example.answer}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function ReviewImage({ url, alt }: { url?: string; alt: string }) {
  return url
    ? <img src={url} alt={alt} className="mx-auto max-h-[72vh] w-full rounded-2xl border border-slate-200 bg-white object-contain" />
    : <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-bold text-slate-500">Không có ảnh hiển thị.</div>;
}

function TextAnswerCard({ item }: { item: MoverReadingWritingVisualReviewBaseItem }) {
  return (
    <article className={`rounded-2xl border p-4 shadow-sm ${stateClasses(item.state)}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-bold leading-6 text-slate-900"><b className="mr-2 text-blue-700">{item.questionNumber}.</b>{item.prompt}</p>
        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-black"><StateIcon state={item.state} />{stateLabel(item.state)}</span>
      </div>
      <div className="mt-3 rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-black text-slate-900">
        {item.userAnswer || 'Bỏ trống'}
      </div>
      {item.state !== 'correct' && (
        <p className="mt-2 text-sm font-bold text-emerald-800">Đáp án đúng: <span className="font-black">{item.correctAnswer}</span></p>
      )}
    </article>
  );
}

function ChoiceAnswerCard({ item }: { item: MoverReadingWritingVisualReviewChoiceItem }) {
  return (
    <article className={`rounded-2xl border p-4 shadow-sm ${stateClasses(item.state)}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-bold leading-6 text-slate-900"><b className="mr-2 text-blue-700">{item.questionNumber}.</b>{item.prompt}</p>
        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-black"><StateIcon state={item.state} />{stateLabel(item.state)}</span>
      </div>
      <div className="mt-3 grid gap-2">
        {item.options.map((option, index) => {
          const selected = index === item.selectedOptionIndex;
          const correct = index === item.correctOptionIndex;
          const optionClass = correct
            ? 'border-emerald-500 bg-emerald-100 text-emerald-950'
            : selected
              ? 'border-rose-500 bg-rose-100 text-rose-950'
              : 'border-slate-200 bg-white text-slate-700';
          return (
            <div key={`${option.label}-${index}`} className={`flex items-start gap-3 rounded-xl border-2 px-3 py-3 text-sm font-semibold ${optionClass}`}>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-current font-black">{option.label}</span>
              <span className="min-w-0 flex-1">{option.text}</span>
              {correct ? <CheckCircle2 size={20} className="shrink-0 text-emerald-700" aria-label="Đáp án đúng" /> : selected ? <XCircle size={20} className="shrink-0 text-rose-700" aria-label="Bạn đã chọn" /> : null}
              {(selected || correct) && (
                <span className="sr-only">{selected ? 'Bạn chọn. ' : ''}{correct ? 'Đáp án đúng.' : ''}</span>
              )}
            </div>
          );
        })}
      </div>
      {item.state === 'unanswered' && <p className="mt-2 text-sm font-bold text-amber-800">Bạn chưa chọn đáp án.</p>}
    </article>
  );
}

function InlineAnswer({ item }: { item: MoverReadingWritingVisualReviewBaseItem }) {
  return (
    <span className={`mx-1 inline-flex max-w-full flex-col rounded-xl border px-2 py-1 align-middle leading-5 ${stateClasses(item.state)}`}>
      <span className="inline-flex items-center gap-1 font-black"><StateIcon state={item.state} size={16} />{item.userAnswer || 'Bỏ trống'}</span>
      {item.state !== 'correct' && <span className="text-xs font-black text-emerald-800">Đúng: {item.correctAnswer}</span>}
    </span>
  );
}

function InlineReviewQuestion({ item }: { item: MoverReadingWritingVisualReviewBaseItem }) {
  return (
    <div className="py-2 text-base font-semibold leading-10 text-slate-800">
      <b className="mr-2 text-blue-700">{item.questionNumber}.</b>
      {renderReviewTemplate(item.prompt, [item])}
    </div>
  );
}

function renderReviewTemplate(template: string, items: MoverReadingWritingVisualReviewBaseItem[]) {
  return template.split(/(\{\{\d+\}\})/g).map((segment, index) => {
    const match = segment.match(/^\{\{(\d+)\}\}$/);
    if (!match) return <span key={`text-${index}`} className="whitespace-pre-wrap">{segment}</span>;
    const item = items.find(candidate => candidate.questionNumber === Number(match[1]));
    return item
      ? <span key={`answer-${item.questionNumber}-${index}`} className="contents"><InlineAnswer item={item} /></span>
      : <span key={`missing-${index}`} className="font-bold text-rose-700">[Thiếu kết quả]</span>;
  });
}

function TwoColumn({ media, children }: { media: ReactNode; children: ReactNode }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,44%)_minmax(0,56%)]">
      <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">{media}</div>
      <div className="min-w-0 space-y-4">{children}</div>
    </div>
  );
}

function ReviewPart({ part }: { part: MoverReadingWritingVisualReviewPart }) {
  const heading = (
    <div className="mb-5">
      <p className="text-xs font-black uppercase text-indigo-600">Part {part.part}</p>
      <h3 className="mt-1 text-2xl font-black text-slate-900">{part.title}</h3>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">{part.instruction}</p>
    </div>
  );

  if (part.part === 1) return <section>{heading}<TwoColumn media={<ReviewImage url={part.imageUrl} alt="Kết quả Part 1" />}><ExampleBlock examples={part.example ? [part.example] : []} /><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">{part.items.map(item => <div key={item.questionNumber} className="contents"><InlineReviewQuestion item={item} /></div>)}</div></TwoColumn></section>;
  if (part.part === 2) return <section>{heading}<TwoColumn media={<ReviewImage url={part.imageUrl} alt="Kết quả Part 2" />}><ExampleBlock examples={part.examples} />{part.items.map(item => <div key={item.questionNumber} className="contents"><ChoiceAnswerCard item={item} /></div>)}</TwoColumn></section>;
  if (part.part === 3) return <section>{heading}<TwoColumn media={<ReviewImage url={part.imageUrl} alt="Kết quả Part 3" />}><ExampleBlock examples={part.example ? [part.example] : []} />{part.items.map(item => <div key={item.questionNumber} className="contents"><ChoiceAnswerCard item={item} /></div>)}</TwoColumn></section>;
  if (part.part === 4) return (
    <section>{heading}<TwoColumn media={<ReviewImage url={part.imageUrl} alt="Kết quả Part 4" />}>
      <ExampleBlock examples={part.example ? [part.example] : []} />
      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-base font-semibold leading-10 text-slate-800 shadow-sm">{renderReviewTemplate(part.storyTemplate, part.gaps)}</div>
      <ChoiceAnswerCard item={part.titleItem} />
    </TwoColumn></section>
  );
  if (part.part === 5) return (
    <section>{heading}<ExampleBlock examples={part.example ? [part.example] : []} />
      <div className="mt-5 space-y-7">{part.scenes.map((scene, sceneIndex) => (
        <section key={sceneIndex} className="grid gap-5 rounded-3xl border border-slate-200 bg-slate-50 p-4 lg:grid-cols-[minmax(0,44%)_minmax(0,56%)]">
          <div className="space-y-3"><ReviewImage url={scene.imageUrl} alt={`Kết quả Part 5 tranh ${sceneIndex + 1}`} /></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">{scene.passage && <p className="mb-4 whitespace-pre-wrap border-b border-slate-200 pb-4 text-sm font-semibold leading-7 text-slate-700">{scene.passage}</p>}{scene.items.map(item => <div key={item.questionNumber} className="contents"><InlineReviewQuestion item={item} /></div>)}</div>
        </section>
      ))}</div>
    </section>
  );
  return (
    <section>{heading}<TwoColumn media={<><ReviewImage url={part.illustrationUrl} alt="Ảnh bài đọc Part 6" /><ReviewImage url={part.optionsUrl} alt="Bảng lựa chọn Part 6" /></>}>
      <h4 className="text-center text-2xl font-black text-slate-900">{part.passageTitle}</h4>
      <ExampleBlock examples={part.example ? [part.example] : []} />
      <div className="rounded-2xl border border-slate-200 bg-white p-5 text-base font-semibold leading-10 text-slate-800 shadow-sm">{renderReviewTemplate(part.passageTemplate, part.items)}</div>
      {part.mode === 'passage-options' && part.items.map(item => <div key={item.questionNumber} className="contents"><ChoiceAnswerCard item={item} /></div>)}
    </TwoColumn></section>
  );
}

export default function MoverReadingWritingVisualReview({ snapshot, compact = false }: Props) {
  const [activePart, setActivePart] = useState(1);
  useEffect(() => setActivePart(1), [snapshot]);
  const part = snapshot.parts.find(candidate => candidate.part === activePart) || snapshot.parts[0];
  const activeIndex = Math.max(0, snapshot.parts.findIndex(candidate => candidate.part === part?.part));
  const summary = useMemo(() => itemsForPart(part).reduce((counts, item) => ({
    correct: counts.correct + (item.state === 'correct' ? 1 : 0),
    incorrect: counts.incorrect + (item.state === 'incorrect' ? 1 : 0),
    unanswered: counts.unanswered + (item.state === 'unanswered' ? 1 : 0),
  }), { correct: 0, incorrect: 0, unanswered: 0 }), [part]);
  const changePart = (offset: -1 | 1) => {
    const next = snapshot.parts[activeIndex + offset];
    if (next) setActivePart(next.part);
  };

  return (
    <section className="space-y-3" data-mover-reading-visual-review>
      <div className={`${compact ? '' : 'sticky top-0'} z-40 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur-sm`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Chọn Part Reading & Writing để xem kết quả">
            {snapshot.parts.map(candidate => (
              <button key={candidate.part} type="button" role="tab" aria-selected={candidate.part === activePart} data-active={candidate.part === activePart ? 'true' : 'false'} onClick={() => setActivePart(candidate.part)} className="mover-reading-review-part-tab h-10 min-w-14 rounded-full px-4 text-sm font-black">
                <span>Part {candidate.part}</span>
              </button>
            ))}
          </div>
          {!compact && <p className="text-xs font-black text-slate-600"><span className="text-emerald-700">{summary.correct} đúng</span> · <span className="text-rose-700">{summary.incorrect} sai</span> · <span className="text-amber-700">{summary.unanswered} bỏ trống</span></p>}
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-[11px] font-bold text-slate-600">
          <span className="inline-flex items-center gap-1"><CheckCircle2 size={15} className="text-emerald-600" />Đúng</span>
          <span className="inline-flex items-center gap-1"><XCircle size={15} className="text-rose-600" />Sai</span>
          <span className="inline-flex items-center gap-1"><CircleMinus size={15} className="text-amber-600" />Bỏ trống</span>
        </div>
      </div>
      <div className="relative px-11 sm:px-16" data-mover-reading-review-part={part.part}>
        <button type="button" aria-label="Xem Part trước" disabled={activeIndex === 0} onClick={() => changePart(-1)} className="mover-reading-review-part-nav absolute left-0 top-1/2 z-30 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full sm:h-14 sm:w-14"><ChevronLeft size={30} strokeWidth={3} /></button>
        <div className="min-w-0"><ReviewPart part={part} /></div>
        <button type="button" aria-label="Xem Part tiếp theo" disabled={activeIndex === snapshot.parts.length - 1} onClick={() => changePart(1)} className="mover-reading-review-part-nav absolute right-0 top-1/2 z-30 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full sm:h-14 sm:w-14"><ChevronRight size={30} strokeWidth={3} /></button>
      </div>
    </section>
  );
}
