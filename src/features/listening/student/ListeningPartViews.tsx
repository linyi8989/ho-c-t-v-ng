import React, { useMemo, useRef, useState } from 'react';
import type {
  ListeningAnswers,
  ListeningPart1,
  ListeningPart2,
  ListeningPart3,
  ListeningPart4,
  ListeningPart5,
  ListeningPart3ConnectImage,
  ListeningPart5SceneColourDraw,
  ListeningRegion,
} from '../types';
import { pointInListeningRegion } from '../geometry';
import {
  getUnusedAnswerIds,
  placeSingleUseAnswer,
  removeSingleUseAnswer,
} from './listeningAnswerMoves';

const anchorPointForAnswer = (
  answer: ListeningPart3ConnectImage['answers'][number],
  side: 'left' | 'right'
) => ({
  x: side === 'left' ? answer.region.x : answer.region.x + answer.region.width,
  y: answer.region.y + answer.region.height * (side === 'left' ? answer.leftAnchorOffset : answer.rightAnchorOffset),
});

const anchorPointForPicture = (picture: ListeningPart3ConnectImage['pictures'][number]) => ({
  x: picture.side === 'left' ? picture.region.x + picture.region.width : picture.region.x,
  y: picture.region.y + picture.region.height * picture.anchorOffset,
});

const part3ConnectionPath = (from: { x: number; y: number }, to: { x: number; y: number }) => {
  const startX = from.x * 1000;
  const startY = from.y * 1000;
  const endX = to.x * 1000;
  const endY = to.y * 1000;
  const direction = endX >= startX ? 1 : -1;
  const bend = Math.min(220, Math.max(70, Math.abs(endX - startX) * 0.42));
  return `M ${startX} ${startY} C ${startX + direction * bend} ${startY}, ${endX - direction * bend} ${endY}, ${endX} ${endY}`;
};

type Part3ConnectionSource = { answerId: string; side: 'left' | 'right' };

interface PartProps<T> {
  key?: React.Key;
  part: T;
  answers: ListeningAnswers;
  onAnswers: (answers: ListeningAnswers) => void;
}

function regionStyle(region: ListeningRegion): React.CSSProperties {
  return {
    left: `${region.x * 100}%`,
    top: `${region.y * 100}%`,
    width: `${region.width * 100}%`,
    height: `${region.height * 100}%`,
    borderRadius: region.shape === 'ellipse' ? '999px' : '12px',
    clipPath: region.shape === 'polygon' && region.points?.length
      ? `polygon(${region.points.map(point => {
          const x = ((point.x - region.x) / Math.max(region.width, 0.0001)) * 100;
          const y = ((point.y - region.y) / Math.max(region.height, 0.0001)) * 100;
          return `${x}% ${y}%`;
        }).join(',')})`
      : undefined,
  };
}

function compactRegionHeightStyle(region: ListeningRegion): React.CSSProperties {
  return {
    ...regionStyle(region),
    top: `${(region.y + region.height * 0.25) * 100}%`,
    height: `${region.height * 50}%`,
  };
}

export function ListeningPart1View({ part, answers, onAnswers }: PartProps<ListeningPart1>) {
  const [selectedChoice, setSelectedChoice] = useState('');
  const [draggingChoice, setDraggingChoice] = useState('');
  const labels = useMemo(() => new Map(part.choices.map(choice => [choice.id, choice.label])), [part.choices]);
  const availableChoiceIds = getUnusedAnswerIds(part.choices.map(choice => choice.id), answers.part1);
  const activeChoice = selectedChoice || draggingChoice;
  const assign = (targetId: string, choiceId: string) => {
    if (!choiceId || !labels.has(choiceId)) return;
    onAnswers({ ...answers, part1: placeSingleUseAnswer(answers.part1, targetId, choiceId) });
    setSelectedChoice('');
    setDraggingChoice('');
  };
  const clear = (targetId: string) => {
    onAnswers({ ...answers, part1: removeSingleUseAnswer(answers.part1, targetId) });
    setSelectedChoice('');
    setDraggingChoice('');
  };
  return (
    <div className="listening-part listening-part1-layout flex h-full min-h-0 flex-col gap-3">
      <div className="listening-part1-answer-dock shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-sm">
        <div className="flex min-w-full flex-nowrap justify-start gap-2 overflow-x-auto overscroll-x-contain pb-1 sm:justify-center">
        {part.choices.filter(choice => availableChoiceIds.includes(choice.id)).map(choice => {
          return (
            <button
              key={choice.id}
              draggable
              data-state={selectedChoice === choice.id ? 'selected' : 'available'}
              aria-pressed={selectedChoice === choice.id}
              onDragStart={event => {
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/listening-choice', choice.id);
                setDraggingChoice(choice.id);
              }}
              onDragEnd={() => setDraggingChoice('')}
              onClick={() => setSelectedChoice(choice.id)}
              className={`listening-part1-choice shrink-0 rounded-2xl border-2 border-dashed px-5 py-2.5 text-base font-black transition ${
                selectedChoice === choice.id ? 'border-violet-600 bg-violet-600 text-white' : 'border-rose-300 bg-white text-slate-900'
              }`}
            >
              {choice.label}
            </button>
          );
        })}
        </div>
      </div>
      <div className="listening-part1-image-scroller min-h-0 flex-1 overflow-y-auto overscroll-y-contain rounded-2xl p-1">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-2xl border-2 border-orange-300 bg-white shadow-inner">
          <img src={part.sceneUrl} alt="Part 1" className="block h-auto w-full" draggable={false} />
          {part.targets.map((target, index) => {
            const answer = answers.part1[target.id];
            return (
              <button
                key={target.id}
                style={regionStyle(target.region)}
                data-state={answer ? 'filled' : activeChoice ? 'eligible' : 'idle'}
                onDragOver={event => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                }}
                onDrop={event => {
                  event.preventDefault();
                  assign(target.id, event.dataTransfer.getData('text/listening-choice'));
                }}
                onClick={() => selectedChoice ? assign(target.id, selectedChoice) : answer ? clear(target.id) : undefined}
                aria-label={answer ? `Vùng trả lời ${index + 1}: ${labels.get(answer)}. Nhấn để gỡ.` : `Vùng trả lời ${index + 1}`}
                className="listening-part1-target absolute flex items-center justify-center border-0 bg-transparent text-xs font-black transition"
              >
                {answer
                  ? <span className="listening-part1-target-answer rounded-xl border-2 px-3 py-1 text-xs font-black shadow-lg">{labels.get(answer) || index + 1}</span>
                  : <span className="sr-only">Vùng trả lời {index + 1}</span>}
              </button>
            );
          })}
        </div>
      </div>
      <p className="shrink-0 text-center text-xs font-bold text-slate-500">Kéo thẻ tên vào vùng, hoặc chạm thẻ rồi chạm vùng trên tranh.</p>
    </div>
  );
}

function renderPrompt(
  question: ListeningPart2['questions'][number],
  values: Record<string, string>,
  onChange: (blankId: string, value: string) => void
) {
  const tokens = question.prompt.split(/(\{\{[a-zA-Z0-9_-]+\}\})/g);
  return tokens.map((token, index) => {
    const match = token.match(/^\{\{([a-zA-Z0-9_-]+)\}\}$/);
    if (!match) return <React.Fragment key={`${token}-${index}`}>{token}</React.Fragment>;
    const blankId = match[1];
    return (
      <input
        key={blankId}
        value={values[blankId] || ''}
        onChange={event => onChange(blankId, event.target.value)}
        aria-label={`Ô trống ${blankId}`}
        className="mx-1 inline-block min-w-32 max-w-56 border-0 border-b-2 border-orange-400 bg-orange-50/60 px-2 py-1 text-center font-black text-slate-900 outline-none focus:border-blue-600"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />
    );
  });
}

export function ListeningPart2View({ part, answers, onAnswers }: PartProps<ListeningPart2>) {
  return (
    <div className="grid gap-6 lg:grid-cols-[.9fr_1.1fr]">
      <div className="space-y-4">
        {part.illustrationUrl && <img src={part.illustrationUrl} alt="" className="mx-auto max-h-80 w-full rounded-2xl border-2 border-orange-300 object-contain" />}
        {part.exampleText && <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm font-bold text-slate-700"><span className="text-sky-700">Example: </span>{part.exampleText}</div>}
      </div>
      <div>
        <h3 className="mb-4 text-center text-2xl font-black uppercase text-rose-500">{part.heading}</h3>
        <div className="space-y-3">
          {part.questions.map((question, index) => (
            <div key={question.id} className="rounded-2xl border border-slate-100 bg-white p-4 text-base font-bold leading-9 text-slate-800 shadow-sm">
              <span className="mr-2 text-rose-500">{index + 1}.</span>
              {renderPrompt(question, answers.part2[question.id] || {}, (blankId, value) => onAnswers({
                ...answers,
                part2: {
                  ...answers.part2,
                  [question.id]: { ...(answers.part2[question.id] || {}), [blankId]: value },
                },
              }))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ListeningPart3ConnectView({ part, answers, onAnswers }: PartProps<ListeningPart3ConnectImage>) {
  const [selected, setSelected] = useState<Part3ConnectionSource>();
  const [previewPoint, setPreviewPoint] = useState<{ x: number; y: number }>();
  const [boardIntrinsic, setBoardIntrinsic] = useState<{ src?: string; width: number }>();
  const boardRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    source: Part3ConnectionSource;
    startClientX: number;
    startClientY: number;
    moved: boolean;
  }>();
  const exampleAnswerId = part.exampleConnection?.answerId;
  const examplePictureId = part.exampleConnection?.pictureId;
  const boardNaturalWidth = boardIntrinsic?.src === part.boardUrl ? boardIntrinsic.width : undefined;
  const boardDisplayWidth = boardNaturalWidth && boardNaturalWidth < 400
    ? Math.min(boardNaturalWidth * 1.5, 480)
    : boardNaturalWidth;
  const assignedPictureIds = new Set(Object.values(answers.part3));
  const pointFromClient = (clientX: number, clientY: number) => {
    const bounds = boardRef.current?.getBoundingClientRect();
    if (!bounds?.width || !bounds.height) return undefined;
    return {
      x: Math.max(0, Math.min(1, (clientX - bounds.left) / bounds.width)),
      y: Math.max(0, Math.min(1, (clientY - bounds.top) / bounds.height)),
    };
  };
  const assign = (pictureId: string, source = selected) => {
    if (!source || pictureId === examplePictureId) return;
    const picture = part.pictures.find(item => item.id === pictureId);
    if (!picture || assignedPictureIds.has(pictureId)) return;
    onAnswers({ ...answers, part3: placeSingleUseAnswer(answers.part3, source.answerId, pictureId) });
    setSelected(undefined);
    setPreviewPoint(undefined);
  };
  const removeConnection = (answerId: string) => {
    if (!answers.part3[answerId] || answerId === exampleAnswerId) return;
    onAnswers({ ...answers, part3: removeSingleUseAnswer(answers.part3, answerId) });
    if (selected?.answerId === answerId) setSelected(undefined);
    setPreviewPoint(undefined);
  };
  const lines = Object.entries(answers.part3).flatMap(([answerId, pictureId]) => {
    const answer = part.answers.find(item => item.id === answerId);
    const picture = part.pictures.find(item => item.id === pictureId);
    if (!answer || !picture || answerId === exampleAnswerId || pictureId === examplePictureId) return [];
    return [{ id: answerId, label: answer.label, from: anchorPointForAnswer(answer, picture.side), to: anchorPointForPicture(picture) }];
  });
  const selectedAnswer = selected ? part.answers.find(answer => answer.id === selected.answerId) : undefined;
  const sideForPointer = (
    point: { x: number; y: number },
    answer: ListeningPart3ConnectImage['answers'][number],
  ): 'left' | 'right' => {
    const hoveredPicture = part.pictures.find(picture => (
      picture.id !== examplePictureId
      && !assignedPictureIds.has(picture.id)
      && pointInListeningRegion(point, picture.region)
    ));
    if (hoveredPicture) return hoveredPicture.side;
    return point.x < answer.region.x + answer.region.width / 2 ? 'left' : 'right';
  };
  const startPointerConnection = (event: React.PointerEvent<HTMLButtonElement>, answer: ListeningPart3ConnectImage['answers'][number]) => {
    const point = pointFromClient(event.clientX, event.clientY);
    if (!point) return;
    event.preventDefault();
    const source: Part3ConnectionSource = {
      answerId: answer.id,
      side: point.x < answer.region.x + answer.region.width / 2 ? 'left' : 'right',
    };
    dragRef.current = {
      pointerId: event.pointerId,
      source,
      startClientX: event.clientX,
      startClientY: event.clientY,
      moved: false,
    };
    setSelected(source);
    setPreviewPoint(anchorPointForAnswer(answer, source.side));
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const movePointerConnection = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (Math.hypot(event.clientX - drag.startClientX, event.clientY - drag.startClientY) >= 4) drag.moved = true;
    if (!drag.moved) return;
    const point = pointFromClient(event.clientX, event.clientY);
    if (point) {
      const answer = part.answers.find(item => item.id === drag.source.answerId);
      if (answer) {
        const side = sideForPointer(point, answer);
        drag.source = { ...drag.source, side };
        setSelected(drag.source);
      }
      setPreviewPoint(point);
    }
  };
  const finishPointerConnection = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const point = pointFromClient(event.clientX, event.clientY);
    if (drag.moved && point) {
      const picture = part.pictures.find(item => item.id !== examplePictureId
        && !assignedPictureIds.has(item.id)
        && pointInListeningRegion(point, item.region));
      if (picture) assign(picture.id, { ...drag.source, side: picture.side });
    }
    dragRef.current = undefined;
    setPreviewPoint(undefined);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const cancelPointerConnection = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = undefined;
    setPreviewPoint(undefined);
    setSelected(undefined);
  };
  return (
    <div className="space-y-3" onKeyDown={event => { if (event.key === 'Escape') { setSelected(undefined); setPreviewPoint(undefined); } }}>
      <div ref={boardRef} className="listening-part3-board relative isolate mx-auto w-fit max-w-full overflow-hidden rounded-2xl border-2 border-orange-300 bg-white">
        <img
          src={part.boardUrl}
          alt="Part 3"
          onLoad={event => setBoardIntrinsic({ src: part.boardUrl, width: event.currentTarget.naturalWidth })}
          style={{ width: boardDisplayWidth ? `${boardDisplayWidth}px` : undefined }}
          className="relative z-0 block h-auto max-w-full"
          draggable={false}
        />
        <svg className="pointer-events-none absolute inset-0 z-30 h-full w-full" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-label="Các đường nối Part 3">
          {lines.map(line => (
            <React.Fragment key={line.id}>
              <path d={part3ConnectionPath(line.from, line.to)} fill="none" stroke="transparent" strokeWidth="16" pointerEvents="stroke" vectorEffect="non-scaling-stroke" role="button" tabIndex={0} aria-label={`Xóa đường nối ${line.label}`} onClick={() => removeConnection(line.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); removeConnection(line.id); } }} className="cursor-pointer" />
              <path d={part3ConnectionPath(line.from, line.to)} fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" vectorEffect="non-scaling-stroke" pointerEvents="none" />
            </React.Fragment>
          ))}
          {selected && selectedAnswer && previewPoint && <path d={part3ConnectionPath(anchorPointForAnswer(selectedAnswer, selected.side), previewPoint)} fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeDasharray="8 6" strokeLinecap="round" vectorEffect="non-scaling-stroke" pointerEvents="none" />}
        </svg>
        {part.answers.map(answer => {
          const locked = answer.id === exampleAnswerId;
          if (locked) return null;
          return <button key={answer.id} type="button" style={regionStyle(answer.region)} data-selected={selected?.answerId === answer.id ? 'true' : 'false'} onPointerDown={event => startPointerConnection(event, answer)} onPointerMove={movePointerConnection} onPointerUp={finishPointerConnection} onPointerCancel={cancelPointerConnection} onClick={event => { if (event.detail === 0) setSelected({ answerId: answer.id, side: 'left' }); }} onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); setSelected({ answerId: answer.id, side: event.key === 'ArrowLeft' ? 'left' : 'right' }); } }} className="listening-part3-answer-hitbox absolute z-20 touch-none border-0 bg-transparent" aria-label={`${answer.label}. Chạm nửa trái hoặc phải rồi kéo, hoặc dùng phím mũi tên để chọn hướng.`} />;
        })}
        {part.pictures.map(picture => {
          const locked = picture.id === examplePictureId;
          const eligible = Boolean(selected && !assignedPictureIds.has(picture.id) && !locked);
          if (locked) return null;
          return <button key={picture.id} type="button" tabIndex={eligible ? 0 : -1} onClick={() => assign(picture.id, selected ? { ...selected, side: picture.side } : selected)} style={regionStyle(picture.region)} className={`listening-part3-picture-hitbox absolute z-20 border-0 bg-transparent ${eligible ? 'cursor-crosshair' : 'pointer-events-none'}`} aria-label={`Nối tới hình ${picture.side === 'left' ? 'bên trái' : 'bên phải'} hàng ${picture.row}`} />;
        })}
      </div>
      <p className="text-center text-xs font-bold text-slate-500">Chạm answer rồi chạm hình, hoặc giữ và kéo answer tới hình. Chạm đường đã nối để xóa và làm lại. Example đã khóa.</p>
    </div>
  );
}

export function ListeningPart3View({ part, answers, onAnswers }: PartProps<ListeningPart3>) {
  if (part.displayMode === 'connect-image') {
    return <ListeningPart3ConnectView part={part} answers={answers} onAnswers={onAnswers} />;
  }
  const choose = (itemId: string, optionId: string) => {
    const next = { ...answers.part3 };
    if (part.reuseMode === 'once') {
      Object.entries(next).forEach(([existingItemId, existingOptionId]) => {
        if (existingItemId !== itemId && existingOptionId === optionId) delete next[existingItemId];
      });
    }
    next[itemId] = optionId;
    onAnswers({ ...answers, part3: next });
  };
  const composite = part.displayMode === 'composite' && part.boardUrl;
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      {composite ? (
        <div className="overflow-hidden rounded-2xl border-4 border-rose-300 bg-white p-2 shadow-sm">
          <img src={part.boardUrl} alt="Bảng lựa chọn A đến F" className="h-auto w-full object-contain" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2">
          {part.options.map((option, index) => (
            <div key={option.id} className="relative overflow-hidden rounded-2xl border-4 border-rose-300 bg-white p-2 shadow-sm">
              <img src={option.imageUrl} alt={option.label} className="h-36 w-full object-contain" />
              <span className="absolute bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-rose-400 px-3 py-1 text-sm font-black text-white">{String.fromCharCode(65 + index)}</span>
            </div>
          ))}
        </div>
      )}
      <div className="space-y-3">
        {part.items.map(item => (
          <div key={item.id} className={`grid items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm ${composite ? 'grid-cols-[1fr_92px]' : 'grid-cols-[76px_1fr_92px]'}`}>
            {!composite && <img src={item.imageUrl} alt="" className="h-16 w-16 rounded-xl object-contain" />}
            <p className="font-black text-rose-500">{item.label}</p>
            <select
              value={answers.part3[item.id] || ''}
              onChange={event => choose(item.id, event.target.value)}
              className="rounded-xl border-2 border-orange-300 bg-orange-50 px-3 py-2 text-center text-lg font-black"
              aria-label={`Đáp án cho ${item.label}`}
            >
              <option value="">—</option>
              {part.options.map((option, index) => <option key={option.id} value={option.id}>{String.fromCharCode(65 + index)}</option>)}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ListeningPart4View({ part, answers, onAnswers }: PartProps<ListeningPart4>) {
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      {part.example && (
        <fieldset disabled className="rounded-2xl border-2 border-sky-200 bg-sky-50/40 p-4 xl:col-span-2">
          <legend className="px-2 text-sm font-black text-sky-800">Example. {part.example.prompt}</legend>
          <div className="mt-2 grid grid-cols-3 gap-3">
            {part.example.options.map((option, optionIndex) => {
              const selected = part.example?.correctOptionId === option.id;
              return (
                <label key={option.id} className={`rounded-2xl border-4 bg-white p-2 ${selected ? 'border-emerald-500' : 'border-sky-200'}`}>
                  <img src={option.imageUrl} alt={option.alt} className="h-32 w-full object-contain" />
                  <span className="mx-auto mt-1 flex w-8 items-center justify-center rounded-full bg-sky-500 py-1 text-xs font-black text-white">{String.fromCharCode(65 + optionIndex)}</span>
                  <input type="radio" checked={selected} readOnly className="mx-auto mt-2 block h-5 w-5 accent-emerald-600" />
                </label>
              );
            })}
          </div>
        </fieldset>
      )}
      {part.questions.map((question, questionIndex) => (
        <fieldset key={question.id} className="rounded-2xl border-2 border-orange-200 bg-orange-50/30 p-4">
          <legend className="px-2 text-sm font-black text-slate-900">{questionIndex + 1}. {question.prompt}</legend>
          <div className="mt-2 grid grid-cols-3 gap-3">
            {question.options.map((option, optionIndex) => {
              const selected = answers.part4[question.id] === option.id;
              return (
                <label key={option.id} className={`cursor-pointer rounded-2xl border-4 bg-white p-2 transition ${selected ? 'border-emerald-500 shadow-lg' : 'border-rose-300 hover:border-rose-400'}`}>
                  <img src={option.imageUrl} alt={option.alt} className="h-32 w-full object-contain" />
                  <span className="mx-auto mt-1 flex w-8 items-center justify-center rounded-full bg-rose-400 py-1 text-xs font-black text-white">{String.fromCharCode(65 + optionIndex)}</span>
                  <input
                    type="radio"
                    name={question.id}
                    value={option.id}
                    checked={selected}
                    onChange={() => onAnswers({ ...answers, part4: { ...answers.part4, [question.id]: option.id } })}
                    className="mx-auto mt-2 block h-5 w-5 accent-emerald-600"
                  />
                </label>
              );
            })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}

function ListeningPart5SceneView({ part, answers, onAnswers }: PartProps<ListeningPart5SceneColourDraw>) {
  const [selectedColour, setSelectedColour] = useState('');
  const [selectedPaletteItem, setSelectedPaletteItem] = useState('');
  const [keyboardAnchor, setKeyboardAnchor] = useState({ x: 0.5, y: 0.5 });
  const colours = new Map(part.colours.map(colour => [colour.id, colour]));
  const visibleColours = part.interactionSchemaVersion === 2
    ? (part.colourPaletteIds || []).flatMap(id => {
        const colour = colours.get(id);
        return colour ? [colour] : [];
      })
    : part.colours;
  const structuredAnswers = Object.entries(answers.part5).flatMap(([key, answer]) => (
    answer && typeof answer === 'object' ? [{ key, answer }] : []
  ));
  const usedColourIds = new Set(structuredAnswers.flatMap(({ answer }) => (
    answer.type === 'colour_object' ? [answer.colourId] : []
  )));
  const usedPaletteItemIds = new Set(structuredAnswers.flatMap(({ answer }) => (
    answer.type === 'place_object' ? [answer.paletteItemId] : []
  )));
  const availableColours = visibleColours.filter(colour => !usedColourIds.has(colour.id));
  const availablePaletteItems = part.objectPalette.filter(item => !usedPaletteItemIds.has(item.id));
  const clearAnswer = (answerKey: string) => {
    const next = { ...answers.part5 };
    delete next[answerKey];
    onAnswers({ ...answers, part5: next });
  };
  const assignColour = (objectId: string, colourId = selectedColour) => {
    if (!colourId || !colours.has(colourId)) return;
    const next = Object.fromEntries(Object.entries(answers.part5).filter(([, answer]) => !(
      answer && typeof answer === 'object'
      && answer.type === 'colour_object'
      && (answer.objectId === objectId || answer.colourId === colourId)
    )));
    next[objectId] = { type: 'colour_object', objectId, colourId };
    onAnswers({ ...answers, part5: next });
    setSelectedColour('');
  };
  const placeAt = (x: number, y: number, paletteItemId = selectedPaletteItem) => {
    if (!paletteItemId || !part.objectPalette.some(item => item.id === paletteItemId)) return;
    const next = Object.fromEntries(Object.entries(answers.part5).filter(([, answer]) => !(
      answer && typeof answer === 'object'
      && answer.type === 'place_object'
      && answer.paletteItemId === paletteItemId
    )));
    next[paletteItemId] = {
      type: 'place_object',
      paletteItemId,
      anchor: { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) },
    };
    onAnswers({ ...answers, part5: next });
    setSelectedPaletteItem('');
  };
  return (
    <div className="listening-part5-layout flex h-full min-h-0 flex-col gap-3">
      <div className="listening-part5-answer-dock shrink-0 rounded-2xl border border-sky-200 bg-white/95 p-2 shadow-sm">
        <div className="flex flex-nowrap items-center justify-center gap-2 overflow-x-auto py-1">
          {availableColours.map(colour => (
            <button
              key={colour.id}
              type="button"
              draggable
              aria-label={`Chọn màu ${colour.label}`}
              title={colour.label}
              aria-pressed={selectedColour === colour.id}
              data-selected={selectedColour === colour.id ? 'true' : 'false'}
              onClick={() => {
                setSelectedColour(current => current === colour.id ? '' : colour.id);
                setSelectedPaletteItem('');
              }}
              onDragStart={event => {
                setSelectedColour(colour.id);
                setSelectedPaletteItem('');
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/listening-colour', colour.id);
              }}
              className={`listening-part5-colour-choice flex h-10 w-16 shrink-0 items-center justify-center rounded-xl border-2 bg-white p-1 ${selectedColour === colour.id ? 'border-blue-700 ring-2 ring-blue-200' : 'border-sky-300'}`}
            >
              <span aria-hidden="true" className="listening-part5-colour-swatch h-5 w-8 rounded-md border border-black/10" style={{ backgroundColor: colour.value }} />
            </button>
          ))}
          {availablePaletteItems.map(item => (
            <button
              key={item.id}
              type="button"
              draggable
              aria-label={`Chọn vật ${item.label}`}
              title={item.label}
              aria-pressed={selectedPaletteItem === item.id}
              onClick={() => {
                setSelectedPaletteItem(current => current === item.id ? '' : item.id);
                setSelectedColour('');
              }}
              onDragStart={event => {
                setSelectedPaletteItem(item.id);
                setSelectedColour('');
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/listening-palette', item.id);
              }}
              className={`flex h-10 min-w-16 shrink-0 items-center justify-center rounded-xl border-2 bg-white px-2 ${selectedPaletteItem === item.id ? 'border-blue-700 ring-2 ring-blue-200' : 'border-sky-300'}`}
            >
              {item.tokenUrl ? <img src={item.tokenUrl} alt="" className="h-8 w-10 object-contain" /> : <span className="text-[10px] font-black">{item.label}</span>}
            </button>
          ))}
        </div>
      </div>
      <div className="listening-part5-image-scroller min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">
        <div
        className="relative mx-auto max-w-5xl overflow-hidden rounded-2xl border-2 border-orange-300 bg-white"
        tabIndex={selectedPaletteItem ? 0 : undefined}
        aria-label={selectedPaletteItem ? 'Ảnh bài tập; dùng phím mũi tên để di chuyển và Enter để đặt hình' : undefined}
        onKeyDown={event => {
          if (!selectedPaletteItem) return;
          const step = event.shiftKey ? 0.05 : 0.02;
          const movement: Partial<Record<string, { x: number; y: number }>> = {
            ArrowLeft: { x: -step, y: 0 }, ArrowRight: { x: step, y: 0 }, ArrowUp: { x: 0, y: -step }, ArrowDown: { x: 0, y: step },
          };
          if (movement[event.key]) {
            event.preventDefault();
            const delta = movement[event.key]!;
            setKeyboardAnchor(point => ({ x: Math.max(0, Math.min(1, point.x + delta.x)), y: Math.max(0, Math.min(1, point.y + delta.y)) }));
          } else if (event.key === 'Enter' && selectedPaletteItem) {
            event.preventDefault();
            placeAt(keyboardAnchor.x, keyboardAnchor.y);
          }
        }}
        onDragOver={event => {
          if (event.dataTransfer.types.includes('text/listening-palette')) event.preventDefault();
        }}
        onDrop={event => {
          const paletteItemId = event.dataTransfer.getData('text/listening-palette');
          if (!paletteItemId) return;
          event.preventDefault();
          const bounds = event.currentTarget.getBoundingClientRect();
          placeAt((event.clientX - bounds.left) / bounds.width, (event.clientY - bounds.top) / bounds.height, paletteItemId);
        }}
        onClick={event => {
          if (!selectedPaletteItem) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          placeAt((event.clientX - bounds.left) / bounds.width, (event.clientY - bounds.top) / bounds.height);
        }}
      >
        <img src={part.sceneUrl} alt="Part 5" className="block h-auto w-full" draggable={false} />
        {selectedPaletteItem && <span aria-hidden="true" style={{ left: `${keyboardAnchor.x * 100}%`, top: `${keyboardAnchor.y * 100}%` }} className="pointer-events-none absolute z-20 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-blue-700 bg-white/80" />}
        {part.interactiveObjects.map((object, index) => {
          const selectedEntry = structuredAnswers.find(({ answer }) => answer.type === 'colour_object' && answer.objectId === object.id);
          const colour = selectedEntry?.answer.type === 'colour_object' ? colours.get(selectedEntry.answer.colourId) : undefined;
          return (
            <React.Fragment key={object.id}>
              {colour && <span aria-hidden="true" style={{ ...regionStyle(object.geometry), backgroundColor: colour.value, opacity: 0.48, mixBlendMode: 'multiply', boxShadow: `inset 0 0 0 2px ${colour.value}` }} className="pointer-events-none absolute z-10" />}
              <button
                type="button"
                data-filled={colour ? 'true' : 'false'}
                onDragOver={event => {
                  if (event.dataTransfer.types.includes('text/listening-colour')) event.preventDefault();
                }}
                onDrop={event => {
                  const colourId = event.dataTransfer.getData('text/listening-colour');
                  if (!colourId) return;
                  event.preventDefault();
                  event.stopPropagation();
                  assignColour(object.id, colourId);
                }}
                onClick={event => {
                  if (selectedColour) {
                    event.stopPropagation();
                    assignColour(object.id);
                  } else if (!selectedPaletteItem && selectedEntry) {
                    event.stopPropagation();
                    clearAnswer(selectedEntry.key);
                  }
                }}
                style={regionStyle(object.geometry)}
                className="listening-part5-object-hitbox absolute z-20 border-0 bg-transparent p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
                aria-label={colour ? `Vùng đã tô màu ${colour.label}; nhấn để gỡ` : `Vùng có thể tô ${index + 1}`}
              />
            </React.Fragment>
          );
        })}
        {Object.entries(answers.part5).map(([actionId, answer]) => {
          if (!answer || typeof answer === 'string' || answer.type !== 'place_object') return null;
          const item = part.objectPalette.find(entry => entry.id === answer.paletteItemId);
          return <button key={actionId} type="button" onClick={event => { event.stopPropagation(); clearAnswer(actionId); }} style={{ left: `${answer.anchor.x * 100}%`, top: `${answer.anchor.y * 100}%` }} className="absolute z-30 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-blue-700 bg-white/90 p-1 text-[10px] font-black shadow" aria-label={`${item?.label || 'Hình đã đặt'}, nhấn để gỡ`}>{item?.tokenUrl ? <img src={item.tokenUrl} alt={item.label} className="h-10 w-10 object-contain" /> : item?.label || '●'}</button>;
        })}
        </div>
      </div>
      <p className="shrink-0 text-center text-xs font-bold text-slate-500">Kéo màu vào vật thể hoặc kéo hình vào vị trí cần đặt. Đáp án đã dùng sẽ rời khỏi khay; nhấn vào đáp án trên ảnh để lấy lại.</p>
    </div>
  );
}

export function ListeningPart5View({ part, answers, onAnswers }: PartProps<ListeningPart5>) {
  if (part.displayMode === 'scene-colour-draw') {
    return <ListeningPart5SceneView part={part} answers={answers} onAnswers={onAnswers} />;
  }
  const [selectedColour, setSelectedColour] = useState('');
  const colours = useMemo(() => new Map(part.colours.map(colour => [colour.id, colour])), [part.colours]);
  const legacyAnswers = answers.part5 as Record<string, string>;
  const availableColourIds = getUnusedAnswerIds(part.colours.map(colour => colour.id), legacyAnswers);
  const assign = (targetId: string, colourId: string) => {
    if (!colourId || !colours.has(colourId)) return;
    onAnswers({ ...answers, part5: placeSingleUseAnswer(legacyAnswers, targetId, colourId) });
    setSelectedColour('');
  };
  const clear = (targetId: string) => {
    onAnswers({ ...answers, part5: removeSingleUseAnswer(legacyAnswers, targetId) });
    setSelectedColour('');
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-center gap-3">
        {part.colours.filter(colour => availableColourIds.includes(colour.id)).map(colour => (
          <button
            key={colour.id}
            type="button"
            draggable
            aria-label={`Chọn màu ${colour.label}`}
            aria-describedby="listening-part5-instructions"
            title={colour.label}
            aria-pressed={selectedColour === colour.id}
            data-selected={selectedColour === colour.id ? 'true' : 'false'}
            onClick={() => setSelectedColour(colour.id)}
            onDragStart={event => {
              setSelectedColour(colour.id);
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/listening-colour', colour.id);
            }}
            className={`listening-part5-colour-choice flex items-center justify-center rounded-2xl border-2 px-3 py-2 ${selectedColour === colour.id ? 'border-blue-700 bg-blue-50' : 'border-sky-300 bg-white'}`}
          >
            <span aria-hidden="true" className="listening-part5-colour-swatch h-7 w-12 rounded-xl border border-black/10" style={{ backgroundColor: colour.value }} />
          </button>
        ))}
      </div>
      <div className="relative mx-auto max-w-5xl overflow-hidden rounded-2xl border-2 border-orange-300 bg-white">
        <img src={part.sceneUrl} alt="Part 5" className="block h-auto w-full" draggable={false} />
        {part.targets.map((target, index) => {
          const answer = legacyAnswers[target.id];
          const colour = colours.get(answer);
          return (
            <button
              key={target.id}
              onClick={() => selectedColour ? assign(target.id, selectedColour) : answer ? clear(target.id) : undefined}
              onDragOver={event => {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
              }}
              onDrop={event => {
                event.preventDefault();
                assign(target.id, event.dataTransfer.getData('text/listening-colour'));
              }}
              style={{
                ...compactRegionHeightStyle(target.region),
                backgroundColor: colour ? `${colour.value}cc` : 'rgba(244,63,94,.10)',
              }}
              className={`absolute flex items-center justify-center border-2 border-dashed font-black ${answer ? 'border-slate-700 text-slate-900' : 'border-rose-500 text-rose-600'}`}
              aria-label={colour ? `Vùng trả lời ${index + 1}: màu ${colour.label}. Nhấn để gỡ.` : `Vùng trả lời ${index + 1}`}
            >
              <span className="rounded-lg bg-white/80 px-2 py-1 text-[10px]">{index + 1}</span>
            </button>
          );
        })}
      </div>
      <p id="listening-part5-instructions" className="text-center text-xs font-bold text-slate-500">Kéo màu vào vùng cần tô, hoặc chọn một màu rồi chạm vùng. Chạm vùng đã tô khi chưa chọn màu để trả màu về hàng trên.</p>
    </div>
  );
}
