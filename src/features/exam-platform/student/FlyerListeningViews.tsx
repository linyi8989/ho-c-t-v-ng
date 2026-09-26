import { ListeningPart1View } from '../../listening/student/ListeningPartViews';
import type { ListeningAnswers, ListeningPart1 } from '../../listening/types';
import { examPartUnits } from '../examStructure';
import type { ExamAnswerValue, ExamAnswers, ExamPartContent } from '../types';
import ExamImageViewer from './ExamImageViewer';
import { StarterImageOptionsView, StarterListeningPart4View, StarterTextEntryView } from './StarterInteractions';
import { studentTypedAnswerGuards } from './studentTextEntryGuards';

const answerShell = (): ListeningAnswers => ({ part1: {}, part2: {}, part3: {}, part4: {}, part5: {} });

export const FLYER_LISTENING_PART1_IMAGE_MAX_WIDTH = '912px';
export const FLYER_LISTENING_PART1_IMAGE_MAX_HEIGHT = 'min(74.4dvh, 744px, max(264px, calc(100dvh - 315px)))';
export const FLYER_LISTENING_PART1_IMAGE_SCALE = 1.2;
export const FLYER_LISTENING_PART5_IMAGE_MAX_WIDTH = '1094px';
export const FLYER_LISTENING_PART5_IMAGE_MAX_HEIGHT = 'min(89.28dvh, 893px, max(316px, calc(100dvh - 270px)))';
export const FLYER_LISTENING_PART5_IMAGE_SCALE = 1.44;

function FlyerNamePlacementView({ part, answers, onAnswer }: { part: ExamPartContent; answers: ExamAnswers; onAnswer: (questionId: string, value: ExamAnswerValue) => void }) {
  const unit = examPartUnits(part)[0] || part;
  const layout = unit.interactionLayout?.kind === 'flyer-name-placement-v1' ? unit.interactionLayout : undefined;
  if (!layout || !part.imageUrl) return <p className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-center text-sm font-black text-amber-900">Part này chưa có ảnh scene hoặc vùng đặt tên.</p>;
  const choices = unit.questions[0]?.options || [];
  const moverPart: ListeningPart1 = {
    part: 1,
    title: part.title,
    instruction: part.instruction,
    audioAssetId: part.audioAssetId || '',
    audioUrl: part.audioUrl,
    sceneAssetId: part.imageAssetId || '',
    sceneUrl: part.imageUrl,
    choices: choices.map(option => ({ id: option.id, label: option.text || option.label })),
    targets: layout.targets.map(target => ({ id: target.id, choiceId: '', region: target.region })),
  };
  const moverAnswers = answerShell();
  layout.targets.forEach(target => {
    const value = answers[target.questionId];
    if (typeof value === 'string' && value) moverAnswers.part1[target.id] = value;
  });
  return <div data-flyer-listening-part={part.part} data-flyer-interaction="name-placement" className="h-full min-h-0"><ListeningPart1View part={moverPart} answers={moverAnswers} imageMaxWidth={FLYER_LISTENING_PART1_IMAGE_MAX_WIDTH} imageMaxHeight={FLYER_LISTENING_PART1_IMAGE_MAX_HEIGHT} imageScale={FLYER_LISTENING_PART1_IMAGE_SCALE} onAnswers={next => {
    layout.targets.forEach(target => {
      const nextValue = next.part1[target.id] || '';
      if (nextValue !== moverAnswers.part1[target.id]) onAnswer(target.questionId, nextValue);
    });
  }} /></div>;
}

export function FlyerLetterMatchingView({ part, answers, onAnswer, singleImage = false }: { part: ExamPartContent; answers: ExamAnswers; onAnswer: (questionId: string, value: ExamAnswerValue) => void; singleImage?: boolean }) {
  const unit = examPartUnits(part)[0] || part;
  const middle = unit.readingScenes?.[0]?.imageUrl || part.readingScenes?.[0]?.imageUrl;
  const ketImage = part.imageUrl || middle;
  return <div className="space-y-3" data-flyer-listening-part="3" data-flyer-interaction="two-image-letter-input">
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 p-2">
      <div data-flyer-part3-fixed-frames data-letter-matching-image-count={singleImage ? 1 : 2} className={`grid h-[clamp(360px,58vh,600px)] overflow-hidden rounded-2xl border-2 border-slate-300 bg-white divide-x-2 divide-slate-300 ${singleImage ? 'min-w-[680px] grid-cols-[minmax(360px,1fr)_220px]' : 'min-w-[960px] grid-cols-[minmax(300px,1fr)_minmax(300px,1fr)_220px]'}`}>
        {singleImage
          ? <div className="min-w-0 overflow-hidden p-2">{ketImage ? <ExamImageViewer src={ketImage} alt="KET letter-matching task" fillFrame className="rounded-xl bg-white" /> : <MissingImage label="ảnh đề" />}</div>
          : <><div className="min-w-0 overflow-hidden p-2">{part.imageUrl ? <ExamImageViewer src={part.imageUrl} alt="Các lựa chọn A đến H" fillFrame className="rounded-xl bg-white" /> : <MissingImage label="ảnh lựa chọn A-H" />}</div>
            <div className="min-w-0 overflow-hidden p-2">{middle ? <ExamImageViewer src={middle} alt="Danh sách người cần ghép" fillFrame className="rounded-xl bg-white" /> : <MissingImage label="ảnh người và tên" />}</div></>}
        <div className="min-w-0 space-y-2 overflow-y-auto bg-white p-3"><h3 className="text-center text-sm font-black uppercase text-blue-800">Write a letter</h3>{unit.questions.map((question, index) => {
          const raw = answers[question.id];
          const value = typeof raw === 'string' ? raw : '';
          const personName = question.prompt.trim() || `Người ${index + 1}`;
          return <label key={question.id} data-flyer-part3-answer-name={personName} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 text-sm font-black text-slate-800"><span className="min-w-0 flex-1 break-words text-left text-blue-800">{personName}</span><input {...studentTypedAnswerGuards} value={value} maxLength={1} inputMode="text" autoComplete="off" aria-label={`Chữ cái đáp án cho ${personName}`} onChange={event => onAnswer(question.id, event.target.value.toUpperCase().replace(/[^A-H]/g, '').slice(0, 1))} className="h-10 w-14 shrink-0 rounded-lg border-2 border-blue-300 bg-white text-center text-xl font-black uppercase text-blue-900" /></label>;
        })}</div>
      </div>
    </div>
  </div>;
}

function FlyerPart4ImageOptionsView({ part, answers, onAnswer }: { part: ExamPartContent; answers: ExamAnswers; onAnswer: (questionId: string, value: ExamAnswerValue) => void }) {
  const unit = examPartUnits(part).find(item => item.interaction?.variant === 'image-options') || examPartUnits(part)[0] || part;
  const displayImage = unit.readingScenes?.[0]?.imageUrl || part.readingScenes?.[0]?.imageUrl;
  return <div className="space-y-3" data-flyer-listening-part="4" data-flyer-interaction="image-options">
    {displayImage ? <ExamImageViewer src={displayImage} alt="Ảnh hiển thị Flyers Listening Part 4" maxHeight="min(34vh, 320px)" className="border border-slate-200/80 bg-white p-1" /> : <MissingImage label="ảnh hiển thị chung Part 4" />}
    <StarterImageOptionsView part={unit} answers={answers} onAnswer={onAnswer} />
  </div>;
}

function MissingImage({ label }: { label: string }) {
  return <div className="flex min-h-72 items-center justify-center rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 p-6 text-center text-sm font-black text-amber-900">Chưa tải {label}.</div>;
}

export default function FlyerListeningPartView({ part, answers, onAnswer }: { part: ExamPartContent; answers: ExamAnswers; onAnswer: (questionId: string, value: ExamAnswerValue) => void }) {
  if (part.part === 1) return <FlyerNamePlacementView part={part} answers={answers} onAnswer={onAnswer} />;
  if (part.part === 2) return <StarterTextEntryView part={examPartUnits(part)[0] || part} answers={answers} onAnswer={onAnswer} />;
  if (part.part === 3) return <FlyerLetterMatchingView part={part} answers={answers} onAnswer={onAnswer} />;
  if (part.part === 4) return <FlyerPart4ImageOptionsView part={part} answers={answers} onAnswer={onAnswer} />;
  if (part.part === 5) return <StarterListeningPart4View part={part} answers={answers} onAnswer={onAnswer} imageMaxWidth={FLYER_LISTENING_PART5_IMAGE_MAX_WIDTH} imageMaxHeight={FLYER_LISTENING_PART5_IMAGE_MAX_HEIGHT} imageScale={FLYER_LISTENING_PART5_IMAGE_SCALE} />;
  return null;
}
