import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, CircleMinus, XCircle } from 'lucide-react';
import type {
  ListeningRegion,
  ListeningVisualReviewBaseItem,
  ListeningVisualReviewPart,
  ListeningVisualReviewPicture,
  ListeningVisualReviewSnapshot,
  ListeningVisualReviewState,
} from '../types';

interface ListeningVisualReviewProps {
  snapshot: ListeningVisualReviewSnapshot;
  compact?: boolean;
}

export function isListeningVisualReviewSnapshot(value: unknown): value is ListeningVisualReviewSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const source = value as Record<string, unknown>;
  if (source.schemaVersion !== 2 || !Array.isArray(source.parts) || source.parts.length !== 5) return false;
  return source.parts.every((part, index) => (
    Boolean(part)
    && typeof part === 'object'
    && Number((part as Record<string, unknown>).part) === index + 1
    && Array.isArray((part as Record<string, unknown>).items)
  ));
}

const stateLabel = (state: ListeningVisualReviewState) => (
  state === 'correct' ? 'Đúng' : state === 'incorrect' ? 'Sai' : 'Bỏ trống'
);

const stateClasses = (state: ListeningVisualReviewState) => (
  state === 'correct'
    ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
    : state === 'incorrect'
      ? 'border-rose-500 bg-rose-50 text-rose-800'
      : 'border-amber-500 bg-amber-50 text-amber-900'
);

function StateIcon({ state, size = 22 }: { state: ListeningVisualReviewState; size?: number }) {
  if (state === 'correct') return <CheckCircle2 size={size} className="shrink-0 text-emerald-600" aria-hidden="true" />;
  if (state === 'incorrect') return <XCircle size={size} className="shrink-0 text-rose-600" aria-hidden="true" />;
  return <CircleMinus size={size} className="shrink-0 text-amber-600" aria-hidden="true" />;
}

function regionPositionStyle(region: ListeningRegion): React.CSSProperties {
  return {
    left: `${region.x * 100}%`,
    top: `${region.y * 100}%`,
    width: `${region.width * 100}%`,
    height: `${region.height * 100}%`,
  };
}

function regionShapeStyle(region: ListeningRegion): React.CSSProperties {
  return {
    ...regionPositionStyle(region),
    borderRadius: region.shape === 'ellipse' ? '999px' : '10px',
    clipPath: region.shape === 'polygon' && region.points?.length
      ? `polygon(${region.points.map(point => {
          const x = ((point.x - region.x) / Math.max(region.width, 0.0001)) * 100;
          const y = ((point.y - region.y) / Math.max(region.height, 0.0001)) * 100;
          return `${x}% ${y}%`;
        }).join(',')})`
      : undefined,
  };
}

function ReviewScene({ imageUrl, children, alt }: {
  imageUrl?: string;
  children: React.ReactNode;
  alt: string;
}) {
  if (!imageUrl) return null;
  return (
    <div className="overflow-auto rounded-2xl border border-slate-200 bg-white p-2">
      <div className="relative mx-auto w-fit max-w-full overflow-visible">
        <img src={imageUrl} alt={alt} className="block h-auto max-w-full" draggable={false} />
        {children}
      </div>
    </div>
  );
}

function AnswerMarker({ item }: { item: ListeningVisualReviewBaseItem }) {
  const displayedAnswer = item.userAnswer || 'Bỏ trống';
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center overflow-visible">
      <div className="flex min-w-max -translate-y-1 flex-col items-center gap-1">
        <div className={`inline-flex items-center gap-1 rounded-full border-2 bg-white px-2 py-1 text-[10px] font-black shadow-md ${stateClasses(item.state)}`}>
          <span className="max-w-32 truncate">{displayedAnswer}</span>
          <StateIcon state={item.state} size={17} />
          <span className="sr-only">{stateLabel(item.state)}</span>
        </div>
        {item.state !== 'correct' && item.correctAnswer && (
          <div className="rounded-md border border-emerald-400 bg-white/95 px-2 py-1 text-[10px] font-black text-emerald-800 shadow">
            Đúng: {item.correctAnswer}
          </div>
        )}
      </div>
    </div>
  );
}

function Part1Review({ part }: { part: Extract<ListeningVisualReviewPart, { part: 1 }> }) {
  return (
    <ReviewScene imageUrl={part.imageUrl} alt="Kết quả Part 1">
      {part.items.map(item => (
        <div key={item.questionIndex} style={regionPositionStyle(item.region)} className="absolute overflow-visible">
          <AnswerMarker item={item} />
        </div>
      ))}
    </ReviewScene>
  );
}

function TextReview({ part }: { part: Extract<ListeningVisualReviewPart, { part: 2 }> }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)]">
      <div className="space-y-3">
        {part.imageUrl && <img src={part.imageUrl} alt="" className="mx-auto max-h-80 rounded-2xl border border-slate-200 object-contain" />}
        {part.exampleText && <p className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm font-bold"><span className="text-sky-700">Example:</span> {part.exampleText}</p>}
      </div>
      <div className="space-y-3">
        {part.heading && <h3 className="text-center text-xl font-black text-slate-900">{part.heading}</h3>}
        {part.items.map((item, index) => (
          <article key={item.questionIndex} className={`rounded-2xl border-2 p-4 ${stateClasses(item.state)}`}>
            <div className="flex items-start gap-2">
              <StateIcon state={item.state} />
              <div className="min-w-0 flex-1">
                <p className="font-black text-slate-900">{index + 1}. {item.prompt}</p>
                <p className="mt-2 text-sm"><span className="font-bold">Bạn trả lời:</span> {item.userAnswer || 'Bỏ trống'}</p>
                {item.state !== 'correct' && <p className="mt-1 text-sm font-black text-emerald-800">Đáp án đúng: {item.correctAnswer}</p>}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

const answerAnchor = (item: Extract<ListeningVisualReviewPart, { part: 3; mode: 'connect-image' }>['items'][number], side: 'left' | 'right') => ({
  x: side === 'left' ? item.answerRegion.x : item.answerRegion.x + item.answerRegion.width,
  y: item.answerRegion.y + item.answerRegion.height * (side === 'left' ? item.leftAnchorOffset : item.rightAnchorOffset),
});

const pictureAnchor = (picture: ListeningVisualReviewPicture) => ({
  x: picture.side === 'left' ? picture.region.x + picture.region.width : picture.region.x,
  y: picture.region.y + picture.region.height * picture.anchorOffset,
});

const PART3_REVIEW_LANE_RATIOS = [0.24, 0.5, 0.76] as const;

type Part3ReviewLine = {
  key: string;
  questionIndex: number;
  kind: 'user' | 'correct';
  side: 'left' | 'right';
  from: { x: number; y: number };
  to: { x: number; y: number };
  colour: string;
  dashed: boolean;
  laneIndex?: number;
  laneReuseIndex?: number;
};

const connectionPath = (
  from: { x: number; y: number },
  to: { x: number; y: number },
  laneIndex = 1,
  laneReuseIndex = 0,
) => {
  const startX = from.x * 1000;
  const startY = from.y * 1000;
  const endX = to.x * 1000;
  const endY = to.y * 1000;
  const reuseStep = laneReuseIndex === 0
    ? 0
    : Math.ceil(laneReuseIndex / 2) * (laneReuseIndex % 2 === 1 ? 0.045 : -0.045);
  const laneRatio = Math.max(0.1, Math.min(0.9, PART3_REVIEW_LANE_RATIOS[laneIndex] + reuseStep));
  const laneX = startX + (endX - startX) * laneRatio;
  const middleY = (startY + endY) / 2;
  const startControlX = startX + (laneX - startX) * 0.72;
  const endControlX = endX + (laneX - endX) * 0.72;
  return `M ${startX} ${startY} C ${startControlX} ${startY}, ${laneX} ${startY}, ${laneX} ${middleY} C ${laneX} ${endY}, ${endControlX} ${endY}, ${endX} ${endY}`;
};

const buildPart3ReviewLines = (
  part: Extract<ListeningVisualReviewPart, { part: 3; mode: 'connect-image' }>,
) => {
  const lines = part.items.flatMap<Part3ReviewLine>(item => {
    const itemLines: Part3ReviewLine[] = [];
    if (item.userPicture) {
      itemLines.push({
        key: `${item.questionIndex}-user`,
        questionIndex: item.questionIndex,
        kind: 'user',
        side: item.userPicture.side,
        from: answerAnchor(item, item.userPicture.side),
        to: pictureAnchor(item.userPicture),
        colour: item.state === 'correct' ? '#2563eb' : '#e11d48',
        dashed: false,
      });
    }
    if (item.state !== 'correct') {
      itemLines.push({
        key: `${item.questionIndex}-correct`,
        questionIndex: item.questionIndex,
        kind: 'correct',
        side: item.correctPicture.side,
        from: answerAnchor(item, item.correctPicture.side),
        to: pictureAnchor(item.correctPicture),
        colour: '#16a34a',
        dashed: true,
      });
    }
    return itemLines;
  });

  (['left', 'right'] as const).forEach(side => {
    const laneLoads = [0, 0, 0];
    const questionLanes = new Map<number, Set<number>>();
    lines
      .filter(line => line.side === side)
      .sort((left, right) => left.to.y - right.to.y || left.from.y - right.from.y || left.kind.localeCompare(right.kind))
      .forEach(line => {
        const unavailable = questionLanes.get(line.questionIndex) || new Set<number>();
        const candidates = [0, 1, 2].filter(lane => !unavailable.has(lane));
        const laneIndex = (candidates.length ? candidates : [0, 1, 2])
          .reduce((best, lane) => laneLoads[lane] < laneLoads[best] ? lane : best);
        line.laneIndex = laneIndex;
        line.laneReuseIndex = laneLoads[laneIndex];
        laneLoads[laneIndex] += 1;
        const used = questionLanes.get(line.questionIndex) || new Set<number>();
        used.add(laneIndex);
        questionLanes.set(line.questionIndex, used);
      });
  });

  return lines;
};

function Part3ConnectReview({ part }: { part: Extract<ListeningVisualReviewPart, { part: 3; mode: 'connect-image' }> }) {
  const lines = buildPart3ReviewLines(part);
  return (
    <ReviewScene imageUrl={part.imageUrl} alt="Kết quả Part 3">
      <svg className="pointer-events-none absolute inset-0 z-20 h-full w-full" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-label="Đường nối kết quả Part 3">
        {lines.map(line => (
          <path
            key={line.key}
            d={connectionPath(line.from, line.to, line.laneIndex, line.laneReuseIndex)}
            fill="none"
            stroke={line.colour}
            strokeWidth={line.dashed ? 2.5 : 3}
            strokeDasharray={line.dashed ? '8 6' : undefined}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
    </ReviewScene>
  );
}

type ImageOptionsPart = Extract<ListeningVisualReviewPart, { mode: 'image-options' }>;

function ImageOptionsReview({ part }: { part: ImageOptionsPart }) {
  return (
    <div className="space-y-4">
      {'imageUrl' in part && part.imageUrl && <img src={part.imageUrl} alt="" className="mx-auto max-h-[34rem] rounded-2xl border border-slate-200 object-contain" />}
      {part.items.map((item, questionIndex) => (
        <article key={item.questionIndex} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-start justify-between gap-3">
            <h3 className="font-black text-slate-900">{questionIndex + 1}. {item.prompt}</h3>
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-black ${stateClasses(item.state)}`}><StateIcon state={item.state} size={16} />{stateLabel(item.state)}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {item.options.map((option, optionIndex) => {
              const selected = optionIndex === item.selectedOptionIndex;
              const correct = optionIndex === item.correctOptionIndex;
              const border = correct ? 'border-emerald-500' : selected ? 'border-rose-500' : 'border-slate-200';
              return (
                <div key={optionIndex} className={`relative rounded-xl border-4 bg-white p-2 ${border}`}>
                  {option.imageUrl && <img src={option.imageUrl} alt={option.alt} className="h-24 w-full object-contain sm:h-32" />}
                  <div className="mt-1 flex items-center justify-center gap-1 text-xs font-black">
                    <span className="rounded-full bg-slate-800 px-2 py-1 text-white">{option.label}</span>
                    {selected && !correct && <XCircle size={18} className="text-rose-600" aria-label="Đáp án học sinh chọn sai" />}
                    {correct && <CheckCircle2 size={18} className="text-emerald-600" aria-label="Đáp án đúng" />}
                  </div>
                </div>
              );
            })}
          </div>
          {item.state !== 'correct' && <p className="mt-3 text-sm"><span className="font-bold text-slate-600">Bạn trả lời:</span> {item.userAnswer || 'Bỏ trống'}<br /><span className="font-black text-emerald-800">Đáp án đúng: {item.correctAnswer}</span></p>}
        </article>
      ))}
    </div>
  );
}

function ColourOverlay({ region, state, userValue, correctLabel }: {
  region: ListeningRegion;
  state: ListeningVisualReviewState;
  userValue?: string;
  correctLabel: string;
}) {
  return (
    <>
      {userValue && <div aria-hidden="true" style={{ ...regionShapeStyle(region), backgroundColor: userValue, opacity: 0.3, mixBlendMode: 'multiply' }} className="pointer-events-none absolute z-10" />}
      <div style={regionPositionStyle(region)} className="pointer-events-none absolute z-20 flex items-center justify-center overflow-visible">
        <div className="rounded-full bg-white shadow"><StateIcon state={state} size={23} /></div>
        {state !== 'correct' && <span className="absolute left-1/2 top-full mt-1 min-w-max -translate-x-1/2 rounded-md border border-emerald-400 bg-white/95 px-2 py-1 text-[9px] font-black text-emerald-800 shadow">Đúng: {correctLabel}</span>}
      </div>
    </>
  );
}

function Part5ColourReview({ part }: { part: Extract<ListeningVisualReviewPart, { part: 5; mode: 'scene-colour' }> }) {
  return (
    <ReviewScene imageUrl={part.imageUrl} alt="Kết quả Part 5">
      {part.items.map(item => <React.Fragment key={item.questionIndex}><ColourOverlay region={item.region} state={item.state} userValue={item.userColour?.value} correctLabel={item.correctColour.label} /></React.Fragment>)}
    </ReviewScene>
  );
}

function Part5SceneReview({ part }: { part: Extract<ListeningVisualReviewPart, { part: 5; mode: 'scene-colour-draw' }> }) {
  return (
    <div className="space-y-3">
      <ReviewScene imageUrl={part.imageUrl} alt="Kết quả Part 5">
        {part.items.flatMap(item => item.actions.map((action, actionIndex) => {
          if (action.type === 'colour') {
            return <React.Fragment key={`${item.questionIndex}-${actionIndex}`}><ColourOverlay region={action.region} state={action.state} userValue={action.userColour?.value} correctLabel={action.correctColour.label} /></React.Fragment>;
          }
          const userPoint = action.userAnchor;
          return (
            <React.Fragment key={`${item.questionIndex}-${actionIndex}`}>
              {userPoint && (
                <div style={{ left: `${userPoint.x * 100}%`, top: `${userPoint.y * 100}%` }} className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2">
                  <div className={`relative rounded-full border-2 bg-white p-1 shadow ${action.state === 'correct' ? 'border-emerald-500' : 'border-rose-500'}`}>
                    {action.userItem?.tokenUrl ? <img src={action.userItem.tokenUrl} alt={action.userItem.label} className="h-10 w-10 object-contain" /> : <span className="px-1 text-[9px] font-black">{action.userItem?.label || 'Vật'}</span>}
                    <span className="absolute -right-2 -top-2 rounded-full bg-white"><StateIcon state={action.state} size={19} /></span>
                  </div>
                </div>
              )}
              {action.state !== 'correct' && (
                <div style={{ left: `${action.correctAnchor.x * 100}%`, top: `${action.correctAnchor.y * 100}%` }} className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2">
                  <div className="rounded-xl border-2 border-dashed border-emerald-500 bg-white/90 p-1 text-center shadow">
                    {action.correctItem.tokenUrl ? <img src={action.correctItem.tokenUrl} alt={action.correctItem.label} className="mx-auto h-10 w-10 object-contain" /> : null}
                    <span className="block max-w-24 text-[9px] font-black text-emerald-800">Đúng: {action.correctItem.label}</span>
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        }))}
      </ReviewScene>
      <div className="grid gap-2 sm:grid-cols-2">
        {part.items.map((item, index) => {
          const actionAnswer = item.actions.flatMap(action => {
            if (action.type === 'colour') return action.userColour ? [`Màu ${action.userColour.label}`] : [];
            return action.userAnchor && action.userItem ? [`Vật ${action.userItem.label}`] : [];
          }).join(' | ');
          const displayedUserAnswer = (item.userAnswer || actionAnswer)
            .replace(/\s*@\s*-?(?:\d+(?:\.\d+)?|\.\d+)\s*,\s*-?(?:\d+(?:\.\d+)?|\.\d+)/g, '')
            .trim();
          return (
            <div key={item.questionIndex} className={`rounded-xl border p-3 text-sm ${stateClasses(item.state)}`}>
              <p className="flex items-start gap-2 font-black"><StateIcon state={item.state} size={18} />Câu {index + 1}: {item.prompt}</p>
              <p className="mt-1"><span className="font-bold">Bạn trả lời:</span> {displayedUserAnswer || 'Bỏ trống'}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReviewPart({ part }: { part: ListeningVisualReviewPart }) {
  if (part.part === 1) return <Part1Review part={part} />;
  if (part.part === 2) return <TextReview part={part} />;
  if (part.part === 3 && part.mode === 'connect-image') return <Part3ConnectReview part={part} />;
  if (part.mode === 'image-options') return <ImageOptionsReview part={part} />;
  if (part.part === 5 && part.mode === 'scene-colour-draw') return <Part5SceneReview part={part} />;
  if (part.part === 5 && part.mode === 'scene-colour') return <Part5ColourReview part={part} />;
  return null;
}

export default function ListeningVisualReview({ snapshot, compact = false }: ListeningVisualReviewProps) {
  const [activePart, setActivePart] = useState(1);
  useEffect(() => setActivePart(1), [snapshot]);
  const part = snapshot.parts.find(item => item.part === activePart) || snapshot.parts[0];
  const activePartIndex = Math.max(0, snapshot.parts.findIndex(item => item.part === part?.part));
  const changePart = (offset: -1 | 1) => {
    const nextPart = snapshot.parts[activePartIndex + offset];
    if (nextPart) setActivePart(nextPart.part);
  };
  const summary = useMemo(() => part?.items.reduce((counts, item) => ({
    correct: counts.correct + (item.state === 'correct' ? 1 : 0),
    incorrect: counts.incorrect + (item.state === 'incorrect' ? 1 : 0),
    unanswered: counts.unanswered + (item.state === 'unanswered' ? 1 : 0),
  }), { correct: 0, incorrect: 0, unanswered: 0 }), [part]);

  return (
    <section className="space-y-3" data-listening-visual-review>
      <div className="sticky top-0 z-40 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Chọn Part để xem kết quả">
            {snapshot.parts.map(item => (
              <button key={item.part} type="button" role="tab" aria-selected={item.part === activePart} data-active={item.part === activePart ? 'true' : 'false'} onClick={() => setActivePart(item.part)} className="listening-review-part-tab isolate h-10 min-w-14 rounded-full px-4 text-sm font-black">
                <span className="listening-review-part-tab-label">Part {item.part}</span>
              </button>
            ))}
          </div>
          {!compact && summary && <p className="text-xs font-black text-slate-600"><span className="text-emerald-700">{summary.correct} đúng</span> · <span className="text-rose-700">{summary.incorrect} sai</span> · <span className="text-amber-700">{summary.unanswered} bỏ trống</span></p>}
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-[11px] font-bold text-slate-600">
          <span className="inline-flex items-center gap-1"><CheckCircle2 size={15} className="text-emerald-600" /> Đúng</span>
          <span className="inline-flex items-center gap-1"><XCircle size={15} className="text-rose-600" /> Sai</span>
          <span className="inline-flex items-center gap-1"><CircleMinus size={15} className="text-amber-600" /> Bỏ trống</span>
        </div>
      </div>
      {part && (
        <div className="listening-review-part-shell relative px-12 sm:px-16" data-listening-review-part={part.part}>
          <button type="button" aria-label="Xem Part trước" disabled={activePartIndex === 0} onClick={() => changePart(-1)} className="listening-review-part-nav listening-review-part-nav-left absolute left-0 top-1/2 z-50 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full sm:h-14 sm:w-14">
            <ChevronLeft size={32} strokeWidth={3} aria-hidden="true" />
          </button>
          <div className="listening-review-part-content min-w-0">
            <ReviewPart part={part} />
          </div>
          <button type="button" aria-label="Xem Part tiếp theo" disabled={activePartIndex === snapshot.parts.length - 1} onClick={() => changePart(1)} className="listening-review-part-nav listening-review-part-nav-right absolute right-0 top-1/2 z-50 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full sm:h-14 sm:w-14">
            <ChevronRight size={32} strokeWidth={3} aria-hidden="true" />
          </button>
        </div>
      )}
    </section>
  );
}
