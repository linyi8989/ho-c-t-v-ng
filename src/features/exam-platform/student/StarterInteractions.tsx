import { useMemo, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { ListeningPart2View, ListeningPart4View, ListeningPart5View } from '../../listening/student/ListeningPartViews';
import type { ListeningAnswers, ListeningPart2, ListeningPart4, ListeningPart5SceneColourDraw } from '../../listening/types';
import type { ExamAnswerValue, ExamAnswers, ExamInteractionRegion, ExamMatchingConnection, ExamPartContent, ExamScenePlacement } from '../types';
import { examPartUnits } from '../examStructure';
import { starterColourValue } from '../starterImport';
import {
  readExamMatchingConnections,
  starterMatchingModel,
  starterMatchingResponseKey,
} from '../starterMatching';
import ExamImageViewer from './ExamImageViewer';

function RegionShape({ region, fill, stroke = 'rgba(37,99,235,.85)', onClick, label }: { key?: string; region: ExamInteractionRegion; fill: string; stroke?: string; onClick?: () => void; label?: string }) {
  const onKeyDown = (event: KeyboardEvent<SVGElement>) => {
    if (!onClick || (event.key !== 'Enter' && event.key !== ' ')) return;
    event.preventDefault();
    onClick();
  };
  const common = { fill, stroke, strokeWidth: .004, vectorEffect: 'non-scaling-stroke' as const, onClick, onKeyDown, tabIndex: onClick ? 0 : undefined, role: onClick ? 'button' : undefined, 'aria-label': label, className: onClick ? 'cursor-pointer outline-none focus-visible:stroke-indigo-700' : undefined };
  if (region.shape === 'polygon' && region.points?.length) {
    return <polygon points={region.points.map(point => `${point.x},${point.y}`).join(' ')} {...common} />;
  }
  if (region.shape === 'ellipse') {
    return <ellipse cx={region.x + region.width / 2} cy={region.y + region.height / 2} rx={region.width / 2} ry={region.height / 2} {...common} />;
  }
  return <rect x={region.x} y={region.y} width={region.width} height={region.height} rx={.01} {...common} />;
}

const regionStyle = (region: ExamInteractionRegion) => ({
  left: `${region.x * 100}%`,
  top: `${region.y * 100}%`,
  width: `${region.width * 100}%`,
  height: `${region.height * 100}%`,
});

function pointInRegion(point: { x: number; y: number }, region: ExamInteractionRegion) {
  if (region.shape === 'ellipse') {
    const rx = region.width / 2;
    const ry = region.height / 2;
    if (!rx || !ry) return false;
    const dx = (point.x - region.x - rx) / rx;
    const dy = (point.y - region.y - ry) / ry;
    return dx * dx + dy * dy <= 1;
  }
  if (region.shape === 'polygon' && region.points?.length) {
    let inside = false;
    for (let index = 0, previous = region.points.length - 1; index < region.points.length; previous = index++) {
      const currentPoint = region.points[index];
      const previousPoint = region.points[previous];
      const crosses = (currentPoint.y > point.y) !== (previousPoint.y > point.y)
        && point.x < (previousPoint.x - currentPoint.x) * (point.y - currentPoint.y) / ((previousPoint.y - currentPoint.y) || Number.EPSILON) + currentPoint.x;
      if (crosses) inside = !inside;
    }
    return inside;
  }
  return point.x >= region.x && point.x <= region.x + region.width
    && point.y >= region.y && point.y <= region.y + region.height;
}

const starterPart2Blank = /(_{3,}|\{\{(?:answer|blank)\}\})/i;
export const normalizeStarterPart2PromptForMover = (prompt: string) => {
  let blankFound = false;
  const normalizedPrompt = prompt.replace(new RegExp(starterPart2Blank.source, 'gi'), () => {
    if (blankFound) return '';
    blankFound = true;
    return '{{answer}}';
  });
  return blankFound ? normalizedPrompt : `${prompt} {{answer}}`;
};

function StarterTextEntryView({ part, answers, onAnswer }: { part: ExamPartContent; answers: ExamAnswers; onAnswer: (questionId: string, value: ExamAnswerValue) => void }) {
  const moverPart: ListeningPart2 = {
    part: 2,
    title: part.title,
    instruction: part.instruction,
    audioAssetId: part.audioAssetId || '',
    audioUrl: part.audioUrl,
    heading: part.title || 'Questions',
    illustrationAssetId: part.imageAssetId,
    illustrationUrl: part.imageUrl,
    exampleText: part.passage,
    questions: part.questions.map(question => ({ id: question.id, prompt: normalizeStarterPart2PromptForMover(question.prompt), blanks: [{ id: 'answer', acceptedAnswers: [] }] })),
  };
  const moverAnswers = moverAnswerShell();
  moverAnswers.part2 = Object.fromEntries(part.questions.map(question => {
    const raw = answers[question.id];
    const value = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw.join(' ') : '';
    return [question.id, { answer: value }];
  }));
  return <div id="starter-interaction" data-starter-interaction="text-entry" className="relative">{part.imageUrl && <div className="absolute left-3 top-3 z-50"><ExamImageViewer src={part.imageUrl} alt="Ảnh minh họa Part 2" triggerOnly /></div>}<ListeningPart2View part={moverPart} answers={moverAnswers} onAnswers={next => {
    part.questions.forEach(question => {
      const nextValue = next.part2[question.id]?.answer || '';
      if (nextValue !== moverAnswers.part2[question.id]?.answer) onAnswer(question.id, nextValue);
    });
  }} /></div>;
}

const moverAnswerShell = (): ListeningAnswers => ({ part1: {}, part2: {}, part3: {}, part4: {}, part5: {} });

function StarterImageOptionsView({ part, answers, onAnswer }: { part: ExamPartContent; answers: ExamAnswers; onAnswer: (questionId: string, value: ExamAnswerValue) => void }) {
  const moverPart: ListeningPart4 = {
    part: 4,
    title: part.title,
    instruction: part.instruction,
    audioAssetId: part.audioAssetId || '',
    audioUrl: part.audioUrl,
    questions: part.questions.map(question => ({
      id: question.id,
      prompt: question.prompt,
      correctOptionId: '',
      options: question.options.slice(0, 3).map(option => ({ id: option.id, imageAssetId: option.imageAssetId || '', imageUrl: option.imageUrl, alt: option.text || option.label })),
    })),
  };
  const moverAnswers = moverAnswerShell();
  moverAnswers.part4 = Object.fromEntries(part.questions.flatMap(question => {
    const value = answers[question.id];
    return typeof value === 'string' && value ? [[question.id, value]] : [];
  }));
  return <div data-starter-interaction="image-options"><ListeningPart4View part={moverPart} answers={moverAnswers} onAnswers={next => {
    part.questions.forEach(question => {
      const nextValue = next.part4[question.id] || '';
      if (nextValue !== moverAnswers.part4[question.id]) onAnswer(question.id, nextValue);
    });
  }} /></div>;
}

export function StarterListeningPart3View({ part, answers, onAnswer }: { part: ExamPartContent; answers: ExamAnswers; onAnswer: (questionId: string, value: ExamAnswerValue) => void }) {
  const unit = examPartUnits(part).find(item => item.interaction?.variant === 'image-options') || examPartUnits(part)[0] || part;
  return <div className="space-y-5" data-starter-listening-part3>
    {part.imageUrl ? <ExamImageViewer src={part.imageUrl} alt="Minh họa Part 3" maxHeight="min(46vh, 360px)" className="border-2 border-orange-300 bg-white p-2" /> : <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">Part 3 chưa có ảnh hiển thị chung.</p>}
    <StarterImageOptionsView part={unit} answers={answers} onAnswer={onAnswer} />
  </div>;
}

export function StarterListeningPart4View({ part, answers, onAnswer }: { part: ExamPartContent; answers: ExamAnswers; onAnswer: (questionId: string, value: ExamAnswerValue) => void }) {
  const units = examPartUnits(part);
  const colourUnits = units.filter(unit => unit.interactionLayout?.kind === 'starter-scene-colour-v1');
  const drawUnits = units.filter(unit => unit.interactionLayout?.kind === 'scene-draw-v1');
  const normalColour = (value: string) => value.trim().toLocaleLowerCase('en');
  const authoredPalette = colourUnits.flatMap(unit => unit.interactionLayout?.kind === 'starter-scene-colour-v1'
    ? unit.interactionLayout.studentPalette || []
    : []);
  const fallbackOptions = colourUnits.flatMap(unit => unit.questions.flatMap(question => question.options.map(option => normalColour(option.text || option.label))));
  const paletteNames = [...new Set((authoredPalette.length
    ? authoredPalette
    : fallbackOptions).map(normalColour).filter(Boolean))];
  const colours = paletteNames.map(colour => ({ id: `starter-colour-${colour.replace(/[^a-z0-9]+/g, '-')}`, label: colour, value: starterColourValue(colour) }));
  const colourByName = new Map(colours.map(colour => [normalColour(colour.label), colour]));
  const colourNameById = new Map(colours.map(colour => [colour.id, normalColour(colour.label)]));
  const colourTargets = colourUnits.flatMap(unit => unit.interactionLayout?.kind === 'starter-scene-colour-v1'
    ? unit.interactionLayout.targets.map(target => ({ unit, target }))
    : []);
  const drawTargets = drawUnits.flatMap(unit => unit.interactionLayout?.kind === 'scene-draw-v1'
    ? unit.interactionLayout.targets.map(target => ({ unit, target }))
    : []);
  const sceneUrl = units.find(unit => unit.imageUrl)?.imageUrl || part.imageUrl;
  const sceneAssetId = units.find(unit => unit.imageAssetId)?.imageAssetId || part.imageAssetId || '';
  const allQuestions = [...colourTargets.map(({ unit, target }) => ({
    question: unit.questions.find(item => item.id === target.questionId),
    action: { id: target.id, type: 'colour_object' as const, correctObjectId: target.id, correctColourId: '' },
  })), ...drawTargets.map(({ unit, target }) => ({
    question: unit.questions.find(item => item.id === target.questionId),
    action: { id: target.id, type: 'place_object' as const, correctPaletteItemId: target.id, targetRegion: { shape: 'rect' as const, x: .45, y: .45, width: .1, height: .1 }, relationLabel: target.label },
  }))].filter(entry => entry.question);
  const questionGroups = new Map<number, { id: string; questionNumber: 1 | 2 | 3 | 4 | 5; staffPrompt: string; actions: ListeningPart5SceneColourDraw['questions'][number]['actions'] }>();
  allQuestions.sort((left, right) => left.question!.number - right.question!.number).forEach(({ question, action }) => {
    const questionNumber = Math.max(1, Math.min(5, question!.number)) as 1 | 2 | 3 | 4 | 5;
    const existing = questionGroups.get(questionNumber);
    if (existing) existing.actions.push(action);
    else questionGroups.set(questionNumber, { id: question!.id, questionNumber, staffPrompt: question!.prompt, actions: [action] });
  });
  const moverPart: ListeningPart5SceneColourDraw = {
    part: 5,
    title: part.title,
    instruction: part.instruction,
    audioAssetId: part.audioAssetId || '',
    audioUrl: part.audioUrl,
    displayMode: 'scene-colour-draw',
    interactionSchemaVersion: 3,
    sceneAssetId,
    sceneUrl,
    colours,
    colourPaletteIds: colours.map(colour => colour.id),
    interactiveObjects: colourTargets.map(({ target }) => ({ id: target.id, label: target.label, geometry: target.region, interactionKinds: ['colour'], geometryConfirmedByTeacher: target.geometryConfirmedByTeacher })),
    objectPalette: drawTargets.map(({ target }) => ({ id: target.id, objectType: target.object, label: target.object, tokenAssetId: target.tokenAssetId, tokenUrl: target.tokenUrl })),
    questions: [...questionGroups.values()].sort((left, right) => left.questionNumber - right.questionNumber),
  };
  const moverAnswers = moverAnswerShell();
  colourTargets.forEach(({ unit, target }) => {
    const value = answers[target.questionId];
    const question = unit.questions.find(item => item.id === target.questionId);
    const option = typeof value === 'string' ? question?.options.find(item => item.id === value) : undefined;
    const colour = option ? colourByName.get(normalColour(option.text || option.label)) : undefined;
    if (colour) moverAnswers.part5[target.id] = { type: 'colour_object', objectId: target.id, colourId: colour.id };
  });
  drawTargets.forEach(({ target }) => {
    const value = answers[target.questionId];
    if (isScenePlacement(value)) moverAnswers.part5[target.id] = { type: 'place_object', paletteItemId: target.id, anchor: { x: value.x, y: value.y } };
  });
  return <div data-starter-interaction="scene-colour-draw" className="relative h-full">{sceneUrl && <div className="absolute right-3 top-3 z-50"><ExamImageViewer src={sceneUrl} alt="Ảnh scene Part 4" triggerOnly /></div>}<ListeningPart5View part={moverPart} answers={moverAnswers} onAnswers={next => {
    colourTargets.forEach(({ unit, target }) => {
      const value = next.part5[target.id];
      const colourId = value && typeof value === 'object' && value.type === 'colour_object' ? value.colourId : '';
      const current = moverAnswers.part5[target.id];
      const currentColour = current && typeof current === 'object' && current.type === 'colour_object' ? current.colourId : '';
      if (colourId !== currentColour) {
        const colourName = colourNameById.get(colourId);
        const question = unit.questions.find(item => item.id === target.questionId);
        const optionId = colourName
          ? question?.options.find(option => normalColour(option.text || option.label) === colourName)?.id
          : '';
        onAnswer(target.questionId, optionId || '');
      }
    });
    drawTargets.forEach(({ target }) => {
      const value = next.part5[target.id];
      const current = moverAnswers.part5[target.id];
      if (value && typeof value === 'object' && value.type === 'place_object') {
        if (!current || typeof current !== 'object' || current.type !== 'place_object' || current.anchor.x !== value.anchor.x || current.anchor.y !== value.anchor.y) onAnswer(target.questionId, { actionId: target.id, object: target.object, x: value.anchor.x, y: value.anchor.y });
      } else if (current) onAnswer(target.questionId, '');
    });
  }} /></div>;
}

function MatchingView({ part, answers, onAnswer }: { part: ExamPartContent; answers: ExamAnswers; onAnswer: (questionId: string, value: ExamAnswerValue) => void }) {
  const rawLayout = part.interactionLayout;
  const [activeSourceId, setActiveSourceId] = useState('');
  const [previewPoint, setPreviewPoint] = useState<{ x: number; y: number }>();
  const boardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; sourceNodeId: string; startX: number; startY: number; moved: boolean }>();
  const suppressClickRef = useRef(false);
  if (!rawLayout || (rawLayout.kind !== 'starter-image-matching-v1' && rawLayout.kind !== 'starter-image-matching-v2') || !part.imageUrl) return <p className="rounded-xl bg-amber-50 p-4 text-sm font-bold text-amber-800">Part nối hình chưa có ảnh hoặc điểm neo tương tác.</p>;
  const layout = starterMatchingModel(rawLayout);
  const responseKey = starterMatchingResponseKey(part.id);
  const connections = readExamMatchingConnections(answers[responseKey]);
  const connectedSourceIds = new Set(connections.map(connection => connection.sourceNodeId));
  const sourceById = new Map(layout.sourceNodes.map(node => [node.id, node]));
  const targetById = new Map(layout.targetNodes.map(node => [node.id, node]));
  const exampleSourceId = layout.exampleConnection?.sourceNodeId;
  const exampleTargetId = layout.exampleConnection?.targetNodeId;
  const pointFromClient = (clientX: number, clientY: number) => {
    const bounds = boardRef.current?.getBoundingClientRect();
    if (!bounds?.width || !bounds.height) return undefined;
    return {
      x: Math.max(0, Math.min(1, (clientX - bounds.left) / bounds.width)),
      y: Math.max(0, Math.min(1, (clientY - bounds.top) / bounds.height)),
    };
  };
  const updateConnections = (next: ExamMatchingConnection[]) => onAnswer(responseKey, next);
  const assign = (sourceNodeId: string, targetNodeId: string) => {
    if (!sourceNodeId || !targetNodeId || sourceNodeId === exampleSourceId || targetNodeId === exampleTargetId) return;
    const withoutOccupied = connections.filter(connection => connection.sourceNodeId !== sourceNodeId && connection.targetNodeId !== targetNodeId);
    if (withoutOccupied.length >= layout.maxConnections) return;
    updateConnections([...withoutOccupied, { sourceNodeId, targetNodeId }]);
    setActiveSourceId('');
    setPreviewPoint(undefined);
  };
  const remove = (sourceNodeId: string) => {
    updateConnections(connections.filter(connection => connection.sourceNodeId !== sourceNodeId));
    if (activeSourceId === sourceNodeId) setActiveSourceId('');
    setPreviewPoint(undefined);
  };
  const startDrag = (event: ReactPointerEvent<HTMLButtonElement>, sourceNodeId: string) => {
    event.preventDefault();
    dragRef.current = { pointerId: event.pointerId, sourceNodeId, startX: event.clientX, startY: event.clientY, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const moveDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) >= 4) drag.moved = true;
    if (!drag.moved) return;
    setActiveSourceId(drag.sourceNodeId);
    const point = pointFromClient(event.clientX, event.clientY);
    if (point) setPreviewPoint(point);
  };
  const finishDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const point = pointFromClient(event.clientX, event.clientY);
    if (drag.moved && point) {
      const target = layout.targetNodes.find(node => node.id !== exampleTargetId && pointInRegion(point, node.hitRegion));
      if (target) assign(drag.sourceNodeId, target.id);
    }
    suppressClickRef.current = drag.moved;
    dragRef.current = undefined;
    setPreviewPoint(undefined);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const activeSource = sourceById.get(activeSourceId);
  return <div className="space-y-3" id="starter-interaction" data-starter-interaction="image-matching" onKeyDown={event => { if (event.key === 'Escape') { setActiveSourceId(''); setPreviewPoint(undefined); } }}>
    <p className="text-xs font-bold text-slate-600">Chạm một hình nguồn rồi chạm hình đích, hoặc giữ và kéo để nối. Chạm đường đã nối để xóa. Đường example in sẵn được khóa.</p>
    <ExamImageViewer frameRef={boardRef} src={part.imageUrl} alt="Starters matching scene" className="isolate border border-slate-200 bg-white">
      <svg viewBox="0 0 1 1" preserveAspectRatio="none" focusable="false" className="starter-matching-lines pointer-events-none absolute inset-0 z-30 h-full w-full" aria-label="Các đường nối Starters Part 1">
        {connections.map(connection => {
          const source = sourceById.get(connection.sourceNodeId);
          const target = targetById.get(connection.targetNodeId);
          if (!source || !target) return null;
          return <g key={connection.sourceNodeId}><line x1={source.anchor.x} y1={source.anchor.y} x2={target.anchor.x} y2={target.anchor.y} stroke="transparent" strokeWidth={.035} pointerEvents="stroke" aria-hidden="true" onPointerDown={event => event.preventDefault()} onClick={() => remove(source.id)} className="cursor-pointer" /><line x1={source.anchor.x} y1={source.anchor.y} x2={target.anchor.x} y2={target.anchor.y} stroke="#2563eb" strokeWidth={.0045} strokeLinecap="round" pointerEvents="none" /></g>;
        })}
        {activeSource && previewPoint && <line x1={activeSource.anchor.x} y1={activeSource.anchor.y} x2={previewPoint.x} y2={previewPoint.y} stroke="#3b82f6" strokeWidth={.004} strokeDasharray=".012 .008" strokeLinecap="round" />}
      </svg>
      {layout.sourceNodes.map(node => {
        if (node.id === exampleSourceId) return null;
        const connected = connectedSourceIds.has(node.id);
        return <button key={node.id} type="button" aria-pressed={activeSourceId === node.id} data-selected={activeSourceId === node.id ? 'true' : 'false'} data-connected={connected ? 'true' : 'false'} data-starter-action="select-matching-source" onPointerDown={event => startDrag(event, node.id)} onPointerMove={moveDrag} onPointerUp={finishDrag} onPointerCancel={() => { dragRef.current = undefined; setPreviewPoint(undefined); }} onClick={() => { if (suppressClickRef.current) { suppressClickRef.current = false; return; } if (connected) { remove(node.id); return; } setActiveSourceId(current => current === node.id ? '' : node.id); }} aria-label={connected ? `Xóa đường nối từ ${node.label}` : `Chọn hình nguồn ${node.label}`} className="starter-matching-node-hitbox absolute z-20 touch-none border-0 bg-transparent" style={regionStyle(node.hitRegion)} />;
      })}
      {layout.targetNodes.map(node => {
        const eligible = Boolean(activeSourceId && node.id !== exampleTargetId);
        if (node.id === exampleTargetId) return null;
        return <button key={node.id} type="button" tabIndex={eligible ? 0 : -1} aria-disabled={!eligible} data-eligible={eligible ? 'true' : 'false'} data-starter-action="select-matching-target" onClick={() => eligible && assign(activeSourceId, node.id)} aria-label={`Nối tới hình đích ${node.label}`} className={`starter-matching-node-hitbox absolute z-20 border-0 bg-transparent ${eligible ? 'cursor-crosshair' : 'pointer-events-none'}`} style={regionStyle(node.hitRegion)} />;
      })}
    </ExamImageViewer>
    <p className="text-center text-xs font-black text-indigo-700">Đã nối {connections.length}/{layout.maxConnections} đường</p>
  </div>;
}

function SceneColourView({ part, answers, onAnswer }: { part: ExamPartContent; answers: ExamAnswers; onAnswer: (questionId: string, value: ExamAnswerValue) => void }) {
  const layout = part.interactionLayout?.kind === 'starter-scene-colour-v1' ? part.interactionLayout : undefined;
  const [selectedColourId, setSelectedColourId] = useState('');
  const palette = useMemo(() => {
    const options = part.questions.flatMap(question => question.options);
    return [...new Map(options.map(option => [option.id, option])).values()];
  }, [part.questions]);
  if (!layout || !part.imageUrl) return <p className="rounded-xl bg-amber-50 p-4 text-sm font-bold text-amber-800">Part tô màu chưa có ảnh hoặc mask tương tác.</p>;
  return <div className="space-y-3" id="starter-interaction" data-starter-interaction="scene-colour">
    <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-3">{palette.map(option => <button key={option.id} type="button" aria-pressed={selectedColourId === option.id} data-starter-action="select-colour" onClick={() => setSelectedColourId(option.id)} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black ${selectedColourId === option.id ? 'border-indigo-600 ring-2 ring-indigo-200' : 'border-slate-200'}`}><span className="h-5 w-5 rounded-full border border-slate-300" aria-hidden="true" style={{ backgroundColor: starterColourValue(option.text) }} />{option.text}</button>)}</div>
    <p className="text-xs font-bold text-slate-600">Chọn màu, sau đó chạm vào đối tượng tương ứng trên tranh.</p>
    <div className="relative mx-auto w-fit max-w-full overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <img src={part.imageUrl} alt="Starters colour scene" className="block h-auto w-auto max-w-full object-contain" style={{ maxHeight: 'min(68vh, 720px)' }} />
      <div className="absolute right-2 top-2 z-50"><ExamImageViewer src={part.imageUrl} alt="Starters colour scene" triggerOnly /></div>
      <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        {layout.targets.map(target => {
          const raw = answers[target.questionId];
          const value = Array.isArray(raw) ? raw[0] : raw;
          const option = palette.find(item => item.id === value);
          return <RegionShape key={target.id} region={target.region} label={`Tô màu ${target.label}`} fill={option ? `${starterColourValue(option.text)}88` : 'transparent'} stroke={selectedColourId ? 'rgba(37,99,235,.75)' : 'rgba(100,116,139,.35)'} onClick={() => selectedColourId && onAnswer(target.questionId, selectedColourId)} />;
        })}
      </svg>
    </div>
    <div className="grid gap-2 sm:grid-cols-2">{layout.targets.map((target, index) => { const raw = answers[target.questionId]; const value = Array.isArray(raw) ? raw[0] : raw; const option = palette.find(item => item.id === value); return <div key={target.id} className="rounded-xl border border-slate-200 bg-white p-3 text-xs"><span className="font-black text-indigo-700">{index + 1}.</span> <span className="font-bold text-slate-700">{target.label}</span><span className="ml-2 font-black" style={{ color: option ? starterColourValue(option.text) : '#94a3b8' }}>{option?.text || 'Chưa tô'}</span></div>; })}</div>
  </div>;
}

function isScenePlacement(value: ExamAnswerValue | undefined): value is ExamScenePlacement {
  return Boolean(value && !Array.isArray(value) && typeof value === 'object'
    && typeof value.actionId === 'string'
    && typeof value.object === 'string'
    && Number.isFinite(value.x)
    && Number.isFinite(value.y));
}

function SceneDrawView({ part, answers, onAnswer }: { part: ExamPartContent; answers: ExamAnswers; onAnswer: (questionId: string, value: ExamAnswerValue) => void }) {
  const layout = part.interactionLayout?.kind === 'scene-draw-v1' ? part.interactionLayout : undefined;
  const [activeTargetId, setActiveTargetId] = useState(layout?.targets[0]?.id || '');
  const [keyboardAnchor, setKeyboardAnchor] = useState({ x: .5, y: .5 });
  if (!layout || !part.imageUrl) return <p className="rounded-xl bg-amber-50 p-4 text-sm font-bold text-amber-800">Dạng Draw chưa có ảnh scene.</p>;
  const active = layout.targets.find(target => target.id === activeTargetId);
  const questionById = new Map(part.questions.map(question => [question.id, question]));
  const available = layout.targets.filter(target => !isScenePlacement(answers[target.questionId]));
  const placeAt = (target: typeof layout.targets[number] | undefined, x: number, y: number) => {
    if (!target) return;
    onAnswer(target.questionId, {
      actionId: target.id,
      object: target.object,
      x: Math.max(0, Math.min(1, x)),
      y: Math.max(0, Math.min(1, y)),
    });
    setActiveTargetId('');
  };
  return <div className="space-y-3" data-exam-interaction="scene-draw">
    <div className="flex flex-wrap justify-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 p-3" data-scene-draw-palette>{available.map((target, index) => <button
      key={target.id}
      type="button"
      draggable
      aria-pressed={active?.id === target.id}
      aria-label={`Chọn ${target.object}: ${questionById.get(target.questionId)?.prompt || target.label}`}
      title={questionById.get(target.questionId)?.prompt || target.label}
      onClick={() => setActiveTargetId(current => current === target.id ? '' : target.id)}
      onDragStart={event => {
        setActiveTargetId(target.id);
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/exam-scene-draw', target.id);
      }}
      className={`flex min-w-40 items-center gap-2 rounded-xl border-2 bg-white p-2 text-left text-xs font-bold ${active?.id === target.id ? 'border-blue-700 ring-2 ring-blue-200' : 'border-sky-300'}`}
    >{target.tokenUrl ? <img src={target.tokenUrl} alt="" draggable={false} className="h-12 w-12 shrink-0 object-contain" /> : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-black">{target.object}</span>}<span><b className="text-indigo-700">{index + 1}.</b> {questionById.get(target.questionId)?.prompt || target.label}</span></button>)}</div>
    <p className="text-xs font-bold text-slate-600">Kéo hình vào đúng vị trí trên tranh, hoặc chọn hình rồi chạm vị trí cần đặt. Nhấn hình đã đặt để gỡ.</p>
    <div
      className="relative mx-auto w-fit max-w-full overflow-hidden rounded-2xl border-2 border-orange-300 bg-white"
      tabIndex={active ? 0 : undefined}
      aria-label={active ? `Ảnh bài tập; dùng phím mũi tên rồi Enter để đặt ${active.object}` : 'Ảnh bài tập Draw'}
      onKeyDown={event => {
        if (!active) return;
        const step = event.shiftKey ? .05 : .02;
        const movement: Partial<Record<string, { x: number; y: number }>> = { ArrowLeft: { x: -step, y: 0 }, ArrowRight: { x: step, y: 0 }, ArrowUp: { x: 0, y: -step }, ArrowDown: { x: 0, y: step } };
        const delta = movement[event.key];
        if (delta) {
          event.preventDefault();
          setKeyboardAnchor(point => ({ x: Math.max(0, Math.min(1, point.x + delta.x)), y: Math.max(0, Math.min(1, point.y + delta.y)) }));
        } else if (event.key === 'Enter') {
          event.preventDefault();
          placeAt(active, keyboardAnchor.x, keyboardAnchor.y);
        }
      }}
      onDragOver={event => { if (event.dataTransfer.types.includes('text/exam-scene-draw')) event.preventDefault(); }}
      onDrop={event => {
        const target = layout.targets.find(item => item.id === event.dataTransfer.getData('text/exam-scene-draw'));
        if (!target) return;
        event.preventDefault();
        const bounds = event.currentTarget.getBoundingClientRect();
        placeAt(target, (event.clientX - bounds.left) / Math.max(bounds.width, 1), (event.clientY - bounds.top) / Math.max(bounds.height, 1));
      }}
      onClick={event => {
        if (!active) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        placeAt(active, (event.clientX - bounds.left) / Math.max(bounds.width, 1), (event.clientY - bounds.top) / Math.max(bounds.height, 1));
      }}
    >
      <img src={part.imageUrl} alt="Scene để vẽ thêm vật" className="block h-auto w-auto max-w-full object-contain" style={{ maxHeight: 'min(68vh, 720px)' }} draggable={false} />
      <div className="absolute right-2 top-2 z-50"><ExamImageViewer src={part.imageUrl} alt="Scene để vẽ thêm vật" triggerOnly /></div>
      {active && <span aria-hidden="true" style={{ left: `${keyboardAnchor.x * 100}%`, top: `${keyboardAnchor.y * 100}%` }} className="pointer-events-none absolute z-20 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-blue-700 bg-white/80" />}
      {layout.targets.map(target => {
        const placement = answers[target.questionId];
        if (!isScenePlacement(placement)) return null;
        return <button key={target.id} type="button" onClick={event => { event.stopPropagation(); onAnswer(target.questionId, ''); }} className="absolute z-30 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-blue-700 bg-white/90 p-1 shadow" style={{ left: `${placement.x * 100}%`, top: `${placement.y * 100}%` }} aria-label={`${target.object} đã đặt; nhấn để gỡ`}>{target.tokenUrl ? <img src={target.tokenUrl} alt={target.object} draggable={false} className="h-10 w-10 object-contain" /> : <span className="text-[10px] font-black">{target.object}</span>}</button>;
      })}
    </div>
  </div>;
}

export default function StarterInteractionView(props: { part: ExamPartContent; answers: ExamAnswers; onAnswer: (questionId: string, value: ExamAnswerValue) => void }) {
  if (props.part.interactionLayout?.kind === 'image-text-entry-v1') {
    const layout = props.part.interactionLayout;
    return <div className="space-y-3" data-exam-interaction="image-text-entry">
      {props.part.imageUrl ? <div className="relative mx-auto w-fit max-w-full overflow-hidden rounded-2xl border border-slate-200 bg-white"><img src={props.part.imageUrl} alt="" className="block h-auto w-auto max-w-full object-contain" style={{ maxHeight: 'min(68vh, 720px)' }} /><div className="absolute right-2 top-2 z-50"><ExamImageViewer src={props.part.imageUrl} alt="Ảnh bài tập điền đáp án" triggerOnly /></div>{layout.targets.map((target, index) => {
        const raw = props.answers[target.questionId];
        const value = typeof raw === 'string' ? raw : Array.isArray(raw) && typeof raw[0] === 'string' ? raw[0] : '';
        return <label key={target.id} className="absolute" style={{ left: `${target.region.x * 100}%`, top: `${target.region.y * 100}%`, width: `${target.region.width * 100}%`, height: `${target.region.height * 100}%` }}><span className="sr-only">{target.label || `Câu ${index + 1}`}</span><input value={value} onChange={event => props.onAnswer(target.questionId, event.target.value)} className="h-full w-full rounded-md border-2 border-indigo-400 bg-white/95 px-2 text-center text-sm font-black text-slate-900 shadow-sm outline-none focus:border-indigo-600" /></label>;
      })}</div> : <p className="rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-800">Dạng bài chưa có ảnh.</p>}
    </div>;
  }
  if (props.part.interaction?.family === 'text-entry' && (props.part.interaction.variant === 'single-input' || (props.part.part === 2 && props.part.interaction.variant === 'inline-gap'))) return <StarterTextEntryView {...props} />;
  if (props.part.interaction?.variant === 'image-options') return <StarterImageOptionsView {...props} />;
  if (props.part.interactionLayout?.kind === 'starter-image-matching-v1' || props.part.interactionLayout?.kind === 'starter-image-matching-v2') return <MatchingView {...props} />;
  if (props.part.interactionLayout?.kind === 'starter-scene-colour-v1') return <SceneColourView {...props} />;
  if (props.part.interactionLayout?.kind === 'scene-draw-v1') return <SceneDrawView {...props} />;
  return null;
}
