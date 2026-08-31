import { CheckCircle2, ChevronLeft, ChevronRight, CircleMinus, Eye, Home, LoaderCircle, RotateCcw, Trophy, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ExamAnswers, ExamAttemptReview, ExamCompletedAttempt, ExamInteractionRegion, ExamPartContent, ExamPlayableSet, ExamQuestionResult, ExamScenePlacement } from '../types';
import { examPartUnits } from '../examStructure';
import { starterColourValue } from '../starterImport';
import { readExamMatchingConnections, starterMatchingModel, starterMatchingResponseKey } from '../starterMatching';
import ExamImageViewer from './ExamImageViewer';

type State = 'correct' | 'incorrect' | 'unanswered';

const stateOf = (result?: ExamQuestionResult): State => result?.unanswered ? 'unanswered' : result?.correct ? 'correct' : 'incorrect';
const stateLabel = (state: State) => state === 'correct' ? 'Đúng' : state === 'incorrect' ? 'Sai' : 'Bỏ trống';
const stateClasses = (state: State) => state === 'correct' ? 'border-emerald-500 bg-emerald-50 text-emerald-800' : state === 'incorrect' ? 'border-rose-500 bg-rose-50 text-rose-800' : 'border-amber-500 bg-amber-50 text-amber-900';
const StateIcon = ({ state, size = 20 }: { state: State; size?: number }) => state === 'correct' ? <CheckCircle2 size={size} className="text-emerald-600" /> : state === 'incorrect' ? <XCircle size={size} className="text-rose-600" /> : <CircleMinus size={size} className="text-amber-600" />;
const answerText = (value: string | string[] | undefined) => Array.isArray(value) ? value.join(', ') : value || '';
const normalized = (value: unknown) => String(value || '').trim().toLocaleLowerCase('en');
const placement = (value: unknown): ExamScenePlacement | undefined => value && typeof value === 'object' && !Array.isArray(value) && Number.isFinite((value as ExamScenePlacement).x) && Number.isFinite((value as ExamScenePlacement).y) ? value as ExamScenePlacement : undefined;
const regionPositionStyle = (region: ExamInteractionRegion) => ({ left: `${region.x * 100}%`, top: `${region.y * 100}%`, width: `${region.width * 100}%`, height: `${region.height * 100}%` });
const regionShapeStyle = (region: ExamInteractionRegion) => ({
  ...regionPositionStyle(region),
  borderRadius: region.shape === 'ellipse' ? '999px' : region.shape === 'rect' ? '10px' : undefined,
  clipPath: region.shape === 'polygon' && region.points?.length ? `polygon(${region.points.map(point => `${((point.x - region.x) / region.width) * 100}% ${((point.y - region.y) / region.height) * 100}%`).join(', ')})` : undefined,
});

function TextResults({ part, results, moverLayout = false }: { part: ExamPartContent; results: ExamQuestionResult[]; moverLayout?: boolean }) {
  const cards = <div className={moverLayout ? 'space-y-3' : 'grid gap-3 sm:grid-cols-2'}>{part.questions.map((question, index) => {
    const result = results.find(item => item.questionId === question.id);
    const state = stateOf(result);
    const userAnswer = answerText(result?.userAnswer);
    const correctAnswer = answerText(result?.correctAnswer);
    return <article key={question.id} className={`rounded-2xl border-2 p-4 ${stateClasses(state)}`}><div className="flex items-start gap-3"><StateIcon state={state} /><div><p className="font-black text-slate-900">{question.displayNumber || index + 1}. {question.prompt}</p><p className="mt-2 text-sm"><b>Bạn trả lời:</b> {userAnswer ? <>{question.answerPrefix && <span>{question.answerPrefix} </span>}<b>{userAnswer}</b>{question.answerSuffix && <span> {question.answerSuffix}</span>}</> : 'Bỏ trống'}</p>{state !== 'correct' && <p className="mt-1 text-sm font-black text-emerald-800">Đáp án đúng: {question.answerPrefix && <span>{question.answerPrefix} </span>}<b>{correctAnswer}</b>{question.answerSuffix && <span> {question.answerSuffix}</span>}</p>}</div></div></article>;
  })}</div>;
  if (!moverLayout) return cards;
  return <div className="grid gap-4 lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)]">
    <div className="space-y-3">{part.imageUrl && <ExamImageViewer src={part.imageUrl} alt="Ảnh minh họa Part 2" profile="illustration" className="border border-slate-200 bg-white" />}{part.passage && <p className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm font-bold"><span className="text-sky-700">Example:</span> {part.passage}</p>}</div>
    <div className="space-y-3"><h3 className="text-center text-xl font-black text-slate-900">{part.title || 'LISTEN AND WRITE.'}</h3>{cards}</div>
  </div>;
}

function MatchingResults({ part, results, answers }: { part: ExamPartContent; results: ExamQuestionResult[]; answers: ExamAnswers }) {
  const unit = examPartUnits(part)[0] || part;
  const rawLayout = unit.interactionLayout;
  if (!rawLayout || (rawLayout.kind !== 'starter-image-matching-v1' && rawLayout.kind !== 'starter-image-matching-v2') || !unit.imageUrl) {
    return <TextResults part={unit} results={results} />;
  }
  const layout = starterMatchingModel(rawLayout);
  const sourceById = new Map(layout.sourceNodes.map(node => [node.id, node]));
  const targetById = new Map(layout.targetNodes.map(node => [node.id, node]));
  const submitted = readExamMatchingConnections(answers[starterMatchingResponseKey(unit.id)]);
  const expected = results.flatMap(result => {
    const [sourceLabel = '', targetLabel = ''] = answerText(result.correctAnswer).split(/\s*→\s*/, 2);
    const source = layout.sourceNodes.find(node => normalized(node.label) === normalized(sourceLabel));
    const target = layout.targetNodes.find(node => normalized(node.label) === normalized(targetLabel));
    return source && target ? [{ sourceNodeId: source.id, targetNodeId: target.id, result }] : [];
  });
  const expectedKey = new Map(expected.map(row => [`${row.sourceNodeId}\u0000${row.targetNodeId}`, row.result]));
  const submittedKeys = new Set(submitted.map(row => `${row.sourceNodeId}\u0000${row.targetNodeId}`));
  const lines = [
    ...submitted.map((row, index) => ({ ...row, colour: expectedKey.has(`${row.sourceNodeId}\u0000${row.targetNodeId}`) ? '#16a34a' : '#e11d48', dashed: false, key: `submitted-${index}` })),
    ...expected.filter(row => !submittedKeys.has(`${row.sourceNodeId}\u0000${row.targetNodeId}`)).map((row, index) => ({ ...row, colour: '#16a34a', dashed: true, key: `correct-${index}` })),
  ];
  return <div className="space-y-4">
    <ExamImageViewer src={unit.imageUrl} alt="Kết quả nối hình Part 1" profile="interactive-scene" className="border border-slate-200/80 bg-white">
      <svg viewBox="0 0 1 1" preserveAspectRatio="none" focusable="false" className="pointer-events-none absolute inset-0 h-full w-full">
        {lines.map(line => {
          const source = sourceById.get(line.sourceNodeId);
          const target = targetById.get(line.targetNodeId);
          if (!source || !target) return null;
          return <line key={line.key} x1={source.anchor.x} y1={source.anchor.y} x2={target.anchor.x} y2={target.anchor.y} stroke={line.colour} strokeWidth={.003} strokeDasharray={line.dashed ? '.012 .009' : undefined} strokeLinecap="round" />;
        })}
      </svg>
    </ExamImageViewer>
    <div className="flex flex-wrap justify-center gap-4 text-xs font-black text-slate-700"><span className="text-emerald-700">━━ Đường đúng</span><span className="text-rose-700">━━ Đường đã nối sai</span><span className="text-emerald-700">┅┅ Đáp án đúng còn thiếu</span></div>
    <TextResults part={unit} results={results} />
  </div>;
}

function ImageOptionResults({ part, results, showSource = true, displayImageUrl }: { part: ExamPartContent; results: ExamQuestionResult[]; showSource?: boolean; displayImageUrl?: string }) {
  const unit = examPartUnits(part)[0] || part;
  return <div className="space-y-4">{displayImageUrl && <ExamImageViewer src={displayImageUrl} alt="Ảnh hiển thị của Part" profile="illustration" className="border border-slate-200/80 bg-white p-1" />}{showSource && part.imageUrl && <ExamImageViewer src={part.imageUrl} alt="Minh họa Part 3" profile="illustration" className="border border-slate-200/80 bg-white p-1" />}<div className="grid gap-4 xl:grid-cols-2">{unit.questions.map((question, questionIndex) => {
    const result = results.find(item => item.questionId === question.id);
    const state = stateOf(result);
    const user = normalized(answerText(result?.userAnswer));
    const correct = normalized(answerText(result?.correctAnswer));
    return <article key={question.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-3 flex items-start justify-between gap-3"><h3 className="font-black text-slate-900">{question.displayNumber || questionIndex + 1}. {question.prompt}</h3><span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-black ${stateClasses(state)}`}><StateIcon state={state} size={16} />{stateLabel(state)}</span></div>{question.imageUrl && <ExamImageViewer src={question.imageUrl} alt={`Ảnh chung câu ${question.displayNumber || questionIndex + 1}`} maxHeight="min(38vh, 340px)" className="mb-3 border border-slate-200/80 bg-white p-1" />}<div className="grid grid-cols-3 gap-2 sm:gap-3">{question.options.slice(0, 3).map((option, optionIndex) => {
      const optionValues = [normalized(option.label), normalized(option.text)];
      const selected = optionValues.includes(user);
      const right = optionValues.includes(correct);
      return <div key={option.id} className={`relative rounded-xl border-4 bg-white p-2 ${right ? 'border-emerald-500' : selected ? 'border-rose-500' : 'border-slate-200'}`}>{option.imageUrl ? <img src={option.imageUrl} alt={option.text} className="listening-image-option mx-auto h-[clamp(88px,11dvh,112px)] w-full max-w-28 object-contain" /> : <div className="flex min-h-20 items-center justify-center px-2 text-center text-sm font-bold text-slate-900">{option.text}</div>}<div className="mt-1 flex items-center justify-center gap-1 text-xs font-black"><span className="rounded-full bg-slate-800 px-2 py-1 text-white">{option.label || String.fromCharCode(65 + optionIndex)}</span>{selected && !right && <XCircle size={18} className="text-rose-600" />}{right && <CheckCircle2 size={18} className="text-emerald-600" />}</div></div>;
    })}</div></article>;
  })}</div></div>;
}

function KetFormResults({ part, results }: { part: ExamPartContent; results: ExamQuestionResult[] }) {
  const unit = examPartUnits(part)[0] || part;
  return <div className="space-y-4">{unit.passage && <section className="rounded-2xl border border-blue-300 bg-blue-50 p-4"><p className="text-[10px] font-black uppercase tracking-wide text-blue-800">Instructions and example</p><p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-7 text-slate-900">{unit.passage}</p></section>}<TextResults part={unit} results={results} /></div>;
}

function FlyerNameResults({ part, results }: { part: ExamPartContent; results: ExamQuestionResult[] }) {
  const unit = examPartUnits(part)[0] || part;
  const layout = unit.interactionLayout?.kind === 'flyer-name-placement-v1' ? unit.interactionLayout : undefined;
  if (!layout || !part.imageUrl) return <TextResults part={unit} results={results} />;
  return <div className="space-y-4"><ExamImageViewer src={part.imageUrl} alt={`Kết quả Flyers Part ${part.part}`} className="border border-slate-200/80 bg-white">{layout.targets.map((target, index) => {
    const result = results.find(item => item.questionId === target.questionId);
    const state = stateOf(result);
    return <div key={target.id} style={regionPositionStyle(target.region)} className="pointer-events-none absolute z-20 flex items-center justify-center"><span className={`rounded-xl border-2 bg-white px-2 py-1 text-[10px] font-black shadow ${stateClasses(state)}`}>{answerText(result?.userAnswer) || '—'} {state === 'correct' ? '✓' : state === 'incorrect' ? `· đúng: ${answerText(result?.correctAnswer)}` : ''}</span><span className="sr-only">Vùng {index + 1}</span></div>;
  })}</ExamImageViewer><TextResults part={unit} results={results} /></div>;
}

function FlyerLetterResults({ part, results }: { part: ExamPartContent; results: ExamQuestionResult[] }) {
  const unit = examPartUnits(part)[0] || part;
  const middle = unit.readingScenes?.[0]?.imageUrl || part.readingScenes?.[0]?.imageUrl;
  return <div className="overflow-x-auto rounded-2xl bg-slate-50 p-2"><div data-flyer-part3-review-fixed-frames className="grid h-[clamp(360px,56vh,580px)] min-w-[880px] grid-cols-[minmax(280px,1fr)_minmax(280px,1fr)_220px] overflow-hidden rounded-2xl border-2 border-slate-300 bg-white divide-x-2 divide-slate-300">
    <div className="min-w-0 overflow-hidden p-2">{part.imageUrl && <ExamImageViewer src={part.imageUrl} alt="Các lựa chọn A-H" fillFrame className="rounded-xl bg-white" />}</div>
    <div className="min-w-0 overflow-hidden p-2">{middle && <ExamImageViewer src={middle} alt="Danh sách người" fillFrame className="rounded-xl bg-white" />}</div>
    <div className="min-w-0 space-y-2 overflow-y-auto p-3">{unit.questions.map((question, index) => {
      const result = results.find(item => item.questionId === question.id);
      const state = stateOf(result);
      return <article key={question.id} className={`rounded-xl border-2 p-3 text-sm ${stateClasses(state)}`}><p className="font-black">{index + 1}. {question.prompt}</p><p className="mt-1">Bạn trả lời: <b>{answerText(result?.userAnswer) || 'Bỏ trống'}</b></p>{state !== 'correct' && <p className="mt-1 font-black text-emerald-800">Đúng: {answerText(result?.correctAnswer)}</p>}</article>;
    })}</div>
  </div></div>;
}

function SceneResults({ part, results, answers, review }: { part: ExamPartContent; results: ExamQuestionResult[]; answers: ExamAnswers; review: ExamAttemptReview }) {
  const units = examPartUnits(part);
  const imageUrl = units.find(unit => unit.imageUrl)?.imageUrl || part.imageUrl;
  const colours = units.flatMap(unit => unit.interactionLayout?.kind === 'starter-scene-colour-v1' ? unit.interactionLayout.targets.map(target => ({ unit, target })) : []);
  const draws = units.flatMap(unit => unit.interactionLayout?.kind === 'scene-draw-v1' ? unit.interactionLayout.targets.map(target => ({ unit, target })) : []);
  const privateDrawTargets = review.sceneDrawTargets || [];

  return <div className="space-y-4">
    {imageUrl ? <ExamImageViewer src={imageUrl} alt="Kết quả Part 4" profile="interactive-scene" className="border border-slate-200/80 bg-white">
      {colours.flatMap(({ unit, target }) => {
        const question = unit.questions.find(item => item.id === target.questionId);
        const result = results.find(item => item.questionId === target.questionId);
        if (!result) return [];
        const state = stateOf(result);
        const colour = starterColourValue(answerText(result.userAnswer));
        return <div key={target.id}>
          {!result.unanswered && <div aria-hidden="true" style={{ ...regionShapeStyle(target.region), backgroundColor: colour, opacity: .3, mixBlendMode: 'multiply' }} className="pointer-events-none absolute z-10" />}
          <div style={regionPositionStyle(target.region)} className="pointer-events-none absolute z-20 flex items-center justify-center overflow-visible">
            <div className="rounded-full bg-white shadow"><StateIcon state={state} size={23} /></div>
            {state !== 'correct' && <span className="absolute left-1/2 top-full mt-1 min-w-max -translate-x-1/2 rounded-md border border-emerald-400 bg-white/95 px-2 py-1 text-[9px] font-black text-emerald-800 shadow">Đúng: {answerText(result.correctAnswer) || question?.prompt}</span>}
          </div>
        </div>;
      })}
      {draws.flatMap(({ target }) => {
        const result = results.find(item => item.questionId === target.questionId);
        if (!result) return [];
        const state = stateOf(result);
        const userPoint = placement(answers[target.questionId]);
        const correctTarget = privateDrawTargets.find(item => item.part === part.part && item.questionId === target.questionId);
        const correctPoint = correctTarget ? { x: correctTarget.targetRegion.x + correctTarget.targetRegion.width / 2, y: correctTarget.targetRegion.y + correctTarget.targetRegion.height / 2 } : undefined;
        return <div key={target.id}>
          {userPoint && <div style={{ left: `${userPoint.x * 100}%`, top: `${userPoint.y * 100}%` }} className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2">
            <div className={`relative rounded-full border-2 bg-white p-1 shadow ${state === 'correct' ? 'border-emerald-500' : 'border-rose-500'}`}>{target.tokenUrl ? <img src={target.tokenUrl} alt={target.object} className="h-10 w-10 object-contain" /> : <span className="px-1 text-[9px] font-black">{target.object}</span>}<span className="absolute -right-2 -top-2 rounded-full bg-white"><StateIcon state={state} size={19} /></span></div>
          </div>}
          {state !== 'correct' && correctPoint && <div style={{ left: `${correctPoint.x * 100}%`, top: `${correctPoint.y * 100}%` }} className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2">
            <div className="rounded-xl border-2 border-dashed border-emerald-500 bg-white/90 p-1 text-center shadow">{(correctTarget?.tokenUrl || target.tokenUrl) && <img src={correctTarget?.tokenUrl || target.tokenUrl} alt={correctTarget?.object || target.object} className="mx-auto h-10 w-10 object-contain" />}<span className="block max-w-24 text-[9px] font-black text-emerald-800">Đúng: {correctTarget?.label || target.label}</span></div>
          </div>}
        </div>;
      })}
    </ExamImageViewer> : <div className="rounded-2xl border border-amber-200 bg-amber-50 p-12 text-center font-bold text-amber-800">Chưa có ảnh scene.</div>}
    <div className="grid gap-2 sm:grid-cols-2">{results.map((result, index) => {
      const state = stateOf(result);
      return <div key={result.questionId} className={`rounded-xl border p-3 text-sm ${stateClasses(state)}`}><p className="flex items-start gap-2 font-black"><StateIcon state={state} size={18} />Câu {index + 1}: {result.prompt}</p><p className="mt-1"><b>Bạn trả lời:</b> {answerText(result.userAnswer).replace(/\s*@.*$/, '') || 'Bỏ trống'}</p>{state !== 'correct' && result.type !== 'scene-draw' && <p className="mt-1 font-black text-emerald-800">Đúng: {answerText(result.correctAnswer)}</p>}</div>;
    })}</div>
  </div>;
}
function DetailedReview({ playable, review, answers, onBack }: { playable: ExamPlayableSet; review: ExamAttemptReview; answers: ExamAnswers; onBack: () => void }) {
  const [activePart, setActivePart] = useState(playable.content.parts[0]?.part || 1);
  const partIndex = Math.max(0, playable.content.parts.findIndex(item => item.part === activePart));
  const part = playable.content.parts[partIndex] || playable.content.parts[0];
  const results = review.questions.filter(question => question.part === part.part).sort((left, right) => left.number - right.number);
  const summary = useMemo(() => ({
    correct: results.filter(item => item.correct).length,
    incorrect: results.filter(item => !item.correct && !item.unanswered).length,
    unanswered: results.filter(item => item.unanswered).length,
  }), [results]);
  const transcript = review.transcripts?.find(item => item.part === part.part)?.text;
  const ketListening = playable.content.moduleId === 'ket' && playable.content.paperId === 'listening' && playable.content.templateVersion === 'ket-listening-5-v1';

  return <div id="listening-review-screen" className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-300 to-emerald-100 p-3 sm:p-5">
    <div className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border-4 border-white bg-white shadow-2xl">
      <header className="shrink-0 border-b border-slate-200 px-5 py-4 text-left sm:px-7"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.16em] text-blue-600">Đáp án sau khi nộp</p><h1 className="mt-1 text-2xl font-black text-slate-900">Kết quả chi tiết</h1></div><div className="rounded-2xl bg-blue-50 px-5 py-2 text-center"><span className="text-3xl font-black text-blue-700">{review.attempt.score}</span><span className="font-black text-slate-400">/100</span></div></div></header>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4 sm:p-6">
        <section className="space-y-3" data-listening-visual-review>
          <div className="sticky top-0 z-40 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2" role="tablist" aria-label="Chọn Part để xem kết quả">{playable.content.parts.map(item => <button key={item.part} type="button" role="tab" aria-selected={item.part === activePart} data-active={item.part === activePart ? 'true' : 'false'} onClick={() => setActivePart(item.part)} className="listening-review-part-tab h-10 min-w-14 rounded-full px-4 text-sm font-black">Part {item.part}</button>)}</div><p className="text-xs font-black text-slate-600"><span className="text-emerald-700">{summary.correct} đúng</span> · <span className="text-rose-700">{summary.incorrect} sai</span> · <span className="text-amber-700">{summary.unanswered} bỏ trống</span></p></div></div>
          <div className="relative px-12 sm:px-16">
            <button type="button" disabled={partIndex === 0} onClick={() => setActivePart(playable.content.parts[partIndex - 1]?.part || activePart)} className="listening-review-part-nav absolute left-0 top-1/2 z-50 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full" aria-label="Part trước"><ChevronLeft size={30} /></button>
            {ketListening
              ? part.part === 1
                ? <ImageOptionResults part={part} results={results} showSource={false} />
                : part.part === 2
                  ? <FlyerLetterResults part={part} results={results} />
                  : part.part === 3
                    ? <ImageOptionResults part={part} results={results} showSource={false} />
                    : <KetFormResults part={part} results={results} />
              : playable.content.moduleId === 'flyer'
              ? part.part === 1
                ? <FlyerNameResults part={part} results={results} />
                : part.part === 2
                  ? <TextResults part={examPartUnits(part)[0] || part} results={results} moverLayout />
                  : part.part === 3
                    ? <FlyerLetterResults part={part} results={results} />
                    : part.part === 4
                      ? <ImageOptionResults part={part} results={results} showSource={false} displayImageUrl={(examPartUnits(part).find(item => item.interaction?.variant === 'image-options') || examPartUnits(part)[0] || part).readingScenes?.[0]?.imageUrl || part.readingScenes?.[0]?.imageUrl} />
                      : <SceneResults part={part} results={results} answers={answers} review={review} />
              : part.part === 1 ? <MatchingResults part={part} results={results} answers={answers} /> : part.part === 2 ? <TextResults part={part} results={results} moverLayout /> : part.part === 3 ? <ImageOptionResults part={part} results={results} /> : part.part === 4 ? <SceneResults part={part} results={results} answers={answers} review={review} /> : <TextResults part={part} results={results} />}
            <button type="button" disabled={partIndex === playable.content.parts.length - 1} onClick={() => setActivePart(playable.content.parts[partIndex + 1]?.part || activePart)} className="listening-review-part-nav absolute right-0 top-1/2 z-50 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full" aria-label="Part sau"><ChevronRight size={30} /></button>
          </div>
          {transcript && <details className="rounded-2xl border border-sky-200 bg-white p-4 text-left"><summary className="cursor-pointer text-sm font-black text-sky-900">Nội dung bài nghe · Part {part.part}</summary><p className="mt-3 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-700">{transcript}</p></details>}
        </section>
      </div>
      <footer className="border-t border-slate-200 bg-white p-4"><button type="button" onClick={onBack} className="listening-secondary-action w-full rounded-2xl border border-blue-300 bg-white py-3 font-black text-blue-700"><ChevronLeft size={16} className="mr-2 inline" />Quay lại tổng kết</button></footer>
    </div>
  </div>;
}
export default function StarterListeningResult({ result, review, playable, answers, reviewLoading, error, onReview, onRetry, onBack }: { result: ExamCompletedAttempt; review: ExamAttemptReview | null; playable: ExamPlayableSet; answers: ExamAnswers; reviewLoading: boolean; error: string; onReview: () => void; onRetry: () => void; onBack: () => void }) {
  const [showReview, setShowReview] = useState(false);
  if (showReview && review) return <DetailedReview playable={playable} review={review} answers={answers} onBack={() => setShowReview(false)} />;
  return <div id="listening-result-screen" className="flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-300 to-emerald-100 p-4"><div className="w-full max-w-xl rounded-[2rem] border-4 border-white bg-white p-8 text-center shadow-2xl"><Trophy size={64} className="mx-auto text-amber-500" /><p className="mt-3 text-xs font-black uppercase tracking-[.2em] text-blue-600">Đã nộp bài thành công</p><h1 className="mt-2 text-5xl font-black text-slate-900">{result.score}<span className="text-xl text-slate-400">/100</span></h1><div className="mt-6 grid grid-cols-3 gap-2"><div className="rounded-2xl bg-emerald-50 p-3"><p className="text-2xl font-black text-emerald-700">{result.correctCount}</p><p className="text-xs font-bold text-emerald-600">Đúng</p></div><div className="rounded-2xl bg-rose-50 p-3"><p className="text-2xl font-black text-rose-700">{result.incorrectCount}</p><p className="text-xs font-bold text-rose-600">Sai</p></div><div className="rounded-2xl bg-amber-50 p-3"><p className="text-2xl font-black text-amber-700">{result.unansweredCount}</p><p className="text-xs font-bold text-amber-600">Bỏ trống</p></div></div>{error && <p className="mt-4 text-sm font-bold text-rose-600">{error}</p>}<div className="mt-7 grid gap-3"><button type="button" onClick={onBack} className="listening-primary-action w-full rounded-2xl bg-blue-600 py-3 font-black text-white"><Home size={16} className="mr-2 inline" />Về trang chủ</button>{playable.content.showReviewAfterSubmit && <button type="button" disabled={reviewLoading} onClick={() => { setShowReview(true); if (!review) onReview(); }} className="listening-review-action w-full rounded-2xl border border-blue-300 bg-white py-3 font-black text-blue-700">{reviewLoading ? <LoaderCircle size={16} className="mr-2 inline animate-spin" /> : <Eye size={16} className="mr-2 inline" />}Xem kết quả</button>}<button type="button" onClick={onRetry} className="listening-retry-action w-full rounded-2xl bg-emerald-600 py-3 font-black text-white"><RotateCcw size={16} className="mr-2 inline" />Làm lại</button></div></div></div>;
}
