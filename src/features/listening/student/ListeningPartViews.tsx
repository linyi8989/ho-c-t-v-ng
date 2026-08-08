import React, { useMemo, useState } from 'react';
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
  const labels = useMemo(() => new Map(part.choices.map(choice => [choice.id, choice.label])), [part.choices]);
  const availableChoiceIds = getUnusedAnswerIds(part.choices.map(choice => choice.id), answers.part1);
  const assign = (targetId: string, choiceId: string) => {
    if (!choiceId || !labels.has(choiceId)) return;
    onAnswers({ ...answers, part1: placeSingleUseAnswer(answers.part1, targetId, choiceId) });
    setSelectedChoice('');
  };
  const clear = (targetId: string) => {
    onAnswers({ ...answers, part1: removeSingleUseAnswer(answers.part1, targetId) });
    setSelectedChoice('');
  };
  return (
    <div className="listening-part space-y-4">
      <div className="flex flex-wrap justify-center gap-2">
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
              }}
              onClick={() => setSelectedChoice(choice.id)}
              className={`listening-part1-choice rounded-2xl border-2 border-dashed px-5 py-2.5 text-base font-black transition ${
                selectedChoice === choice.id ? 'border-violet-600 bg-violet-600 text-white' : 'border-rose-300 bg-white text-slate-900'
              }`}
            >
              {choice.label}
            </button>
          );
        })}
      </div>
      <div className="relative mx-auto max-w-5xl overflow-hidden rounded-2xl border-2 border-orange-300 bg-white shadow-inner">
        <img src={part.sceneUrl} alt="Part 1" className="block h-auto w-full" draggable={false} />
        {part.targets.map((target, index) => {
          const answer = answers.part1[target.id];
          return (
            <button
              key={target.id}
              style={regionStyle(target.region)}
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
              className={`absolute flex items-center justify-center border-2 border-dashed text-xs font-black shadow-sm transition ${
                answer ? 'border-emerald-700 bg-emerald-100/55' : 'border-rose-400 bg-rose-100/35'
              }`}
            >
              <span className={answer
                ? 'listening-part1-target-answer rounded-xl border-2 px-3 py-1 text-xs font-black shadow-lg'
                : 'rounded-lg bg-white/90 px-2 py-1 text-rose-700'}
              >
                {answer ? labels.get(answer) || index + 1 : index + 1}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-center text-xs font-bold text-slate-500">Kéo thẻ tên vào vùng, hoặc chạm thẻ rồi chạm vùng trên tranh.</p>
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
  const [selected, setSelected] = useState<{ answerId: string; side: 'left' | 'right' }>();
  const exampleAnswerId = part.exampleConnection?.answerId;
  const examplePictureId = part.exampleConnection?.pictureId;
  const assignedPictureIds = new Set(Object.values(answers.part3));
  const assign = (pictureId: string, source = selected) => {
    if (!source || pictureId === examplePictureId) return;
    const picture = part.pictures.find(item => item.id === pictureId);
    if (!picture || picture.side !== source.side || assignedPictureIds.has(pictureId)) return;
    const next = { ...answers.part3 };
    Object.entries(next).forEach(([answerId, existingPictureId]) => {
      if (answerId !== source.answerId && existingPictureId === pictureId) delete next[answerId];
    });
    next[source.answerId] = pictureId;
    onAnswers({ ...answers, part3: next });
    setSelected(undefined);
  };
  const lines = Object.entries(answers.part3).flatMap(([answerId, pictureId]) => {
    const answer = part.answers.find(item => item.id === answerId);
    const picture = part.pictures.find(item => item.id === pictureId);
    if (!answer || !picture || answerId === exampleAnswerId || pictureId === examplePictureId) return [];
    return [{ id: answerId, from: anchorPointForAnswer(answer, picture.side), to: anchorPointForPicture(picture) }];
  });
  if (part.exampleConnection?.renderOverlayLine) {
    const answer = part.answers.find(item => item.id === exampleAnswerId);
    const picture = part.pictures.find(item => item.id === examplePictureId);
    if (answer && picture) lines.push({ id: 'example', from: anchorPointForAnswer(answer, picture.side), to: anchorPointForPicture(picture) });
  }
  return (
    <div className="space-y-3" onKeyDown={event => { if (event.key === 'Escape') setSelected(undefined); }}>
      <div className="relative mx-auto max-w-5xl overflow-hidden rounded-2xl border-2 border-orange-300 bg-white">
        <img src={part.boardUrl} alt="Part 3" className="block h-auto w-full" draggable={false} />
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
          {lines.map(line => <line key={line.id} x1={line.from.x * 1000} y1={line.from.y * 1000} x2={line.to.x * 1000} y2={line.to.y * 1000} stroke={line.id === 'example' ? '#64748b' : '#2563eb'} strokeWidth="5" />)}
        </svg>
        {part.answers.map(answer => {
          const locked = answer.id === exampleAnswerId;
          const connected = Boolean(answers.part3[answer.id]);
          return (
            <React.Fragment key={answer.id}>
              <span style={regionStyle(answer.region)} className={`pointer-events-none absolute flex items-start justify-end rounded-lg border text-xs font-black ${locked ? 'border-slate-400 bg-slate-100/20' : 'border-transparent'}`}>
                {locked && <span className="rounded-bl-md bg-slate-700 px-1 text-[9px] text-white">E</span>}
              </span>
              {(['left', 'right'] as const).map(side => {
                const point = anchorPointForAnswer(answer, side);
                const source = { answerId: answer.id, side };
                return <button key={side} type="button" draggable={!locked} disabled={locked} onDragStart={event => { setSelected(source); event.dataTransfer.effectAllowed = 'link'; event.dataTransfer.setData('text/listening-connection', JSON.stringify(source)); }} onClick={() => setSelected(source)} style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }} className={`absolute z-20 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${selected?.answerId === answer.id && selected.side === side ? 'border-blue-800 bg-blue-400' : connected ? 'border-emerald-700 bg-emerald-300' : 'border-slate-700 bg-white'} disabled:border-slate-400 disabled:bg-slate-300`} aria-label={`${answer.label}, nối sang ${side === 'left' ? 'trái' : 'phải'}`} />;
              })}
            </React.Fragment>
          );
        })}
        {part.pictures.map(picture => {
          const locked = picture.id === examplePictureId;
          const eligible = Boolean(selected && selected.side === picture.side && !assignedPictureIds.has(picture.id) && !locked);
          const point = anchorPointForPicture(picture);
          return <button key={picture.id} type="button" disabled={!eligible} onDragOver={event => { if (eligible) { event.preventDefault(); event.dataTransfer.dropEffect = 'link'; } }} onDrop={event => { event.preventDefault(); try { const source = JSON.parse(event.dataTransfer.getData('text/listening-connection')); assign(picture.id, source); } catch { /* Ignore malformed drag payloads. */ } }} onClick={() => assign(picture.id)} style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }} className={`absolute z-20 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 ${eligible ? 'border-blue-800 bg-blue-300 shadow-lg' : locked ? 'border-slate-500 bg-slate-300' : 'border-slate-600 bg-white'}`} aria-label={`Hình ${picture.side === 'left' ? 'bên trái' : 'bên phải'} hàng ${picture.row}`} />;
        })}
      </div>
      <p className="text-center text-xs font-bold text-slate-500">Chọn nút ở cạnh trái hoặc phải của answer, rồi chọn một picture còn trống cùng phía. Example đã khóa.</p>
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
  const actions = part.questions.flatMap(question => question.actions.map(action => ({ ...action, question })));
  const [activeActionId, setActiveActionId] = useState(actions[0]?.id || '');
  const [selectedColour, setSelectedColour] = useState('');
  const [selectedPaletteItem, setSelectedPaletteItem] = useState('');
  const [keyboardAnchor, setKeyboardAnchor] = useState({ x: 0.5, y: 0.5 });
  const active = actions.find(action => action.id === activeActionId) || actions[0];
  const colours = new Map(part.colours.map(colour => [colour.id, colour]));
  const updateAnswer = (actionId: string, answer: ListeningAnswers['part5'][string]) => {
    onAnswers({ ...answers, part5: { ...answers.part5, [actionId]: answer } });
  };
  const clearAnswer = (actionId: string) => {
    const next = { ...answers.part5 };
    delete next[actionId];
    onAnswers({ ...answers, part5: next });
  };
  const placeAt = (x: number, y: number, paletteItemId = selectedPaletteItem) => {
    if (!active || active.type !== 'place_object' || !paletteItemId) return;
    updateAnswer(active.id, { type: 'place_object', paletteItemId, anchor: { x, y } });
    setSelectedPaletteItem('');
  };
  return (
    <div className="space-y-4">
      <div className="grid gap-2 md:grid-cols-5">
        {part.questions.map(question => (
          <div key={question.id} className="rounded-xl border border-slate-200 bg-white p-2">
            <p className="text-xs font-black text-slate-800">Câu {question.questionNumber}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {question.actions.map((action, index) => (
                <button key={action.id} type="button" onClick={() => setActiveActionId(action.id)} className={`rounded-lg px-2 py-1 text-[10px] font-black ${active?.id === action.id ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-700'}`}>
                  {action.type === 'colour_object' ? 'Tô màu' : 'Đặt hình'} {index + 1}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      {active?.type === 'colour_object' ? (
        <div className="flex flex-wrap justify-center gap-2">
          {part.colours.map(colour => (
            <button key={colour.id} type="button" draggable aria-label={`Chọn màu ${colour.label}`} aria-pressed={selectedColour === colour.id} onClick={() => setSelectedColour(colour.id)} onDragStart={event => { setSelectedColour(colour.id); event.dataTransfer.setData('text/listening-colour', colour.id); }} className={`listening-part5-colour-choice rounded-xl border-2 p-2 ${selectedColour === colour.id ? 'border-blue-700' : 'border-slate-300'}`}>
              <span aria-hidden="true" className="listening-part5-colour-swatch block h-7 w-10 rounded-lg border border-black/10" style={{ backgroundColor: colour.value }} />
            </button>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap justify-center gap-2">
          {part.objectPalette.map(item => (
            <button key={item.id} type="button" draggable aria-pressed={selectedPaletteItem === item.id} onClick={() => setSelectedPaletteItem(item.id)} onDragStart={event => event.dataTransfer.setData('text/listening-palette', item.id)} className={`flex min-h-12 items-center gap-2 rounded-xl border-2 px-3 py-2 text-xs font-black ${selectedPaletteItem === item.id ? 'border-blue-700 bg-blue-50' : 'border-slate-300 bg-white'}`}>
              {item.tokenUrl && <img src={item.tokenUrl} alt="" className="h-9 w-9 object-contain" />}{item.label}
            </button>
          ))}
        </div>
      )}
      <div
        className="relative mx-auto max-w-5xl overflow-hidden rounded-2xl border-2 border-orange-300 bg-white"
        tabIndex={active?.type === 'place_object' ? 0 : undefined}
        aria-label={active?.type === 'place_object' ? 'Vùng đặt hình; dùng phím mũi tên để di chuyển và Enter để đặt' : undefined}
        onKeyDown={event => {
          if (active?.type !== 'place_object') return;
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
        onDragOver={event => { if (active?.type === 'place_object') event.preventDefault(); }}
        onDrop={event => {
          if (active?.type !== 'place_object') return;
          event.preventDefault();
          const bounds = event.currentTarget.getBoundingClientRect();
          placeAt((event.clientX - bounds.left) / bounds.width, (event.clientY - bounds.top) / bounds.height, event.dataTransfer.getData('text/listening-palette'));
        }}
        onClick={event => {
          if (active?.type !== 'place_object' || !selectedPaletteItem) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          placeAt((event.clientX - bounds.left) / bounds.width, (event.clientY - bounds.top) / bounds.height);
        }}
      >
        <img src={part.sceneUrl} alt="Part 5" className="block h-auto w-full" draggable={false} />
        {active?.type === 'place_object' && selectedPaletteItem && <span aria-hidden="true" style={{ left: `${keyboardAnchor.x * 100}%`, top: `${keyboardAnchor.y * 100}%` }} className="pointer-events-none absolute z-20 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-blue-700 bg-blue-200/70" />}
        {part.interactiveObjects.map((object, index) => {
          const selectedAnswer = Object.values(answers.part5).find(answer => typeof answer === 'object' && answer.type === 'colour_object' && answer.objectId === object.id);
          const colour = selectedAnswer && typeof selectedAnswer === 'object' && selectedAnswer.type === 'colour_object' ? colours.get(selectedAnswer.colourId) : undefined;
          return <button key={object.id} type="button" disabled={active?.type !== 'colour_object'} onDragOver={event => { if (active?.type === 'colour_object') event.preventDefault(); }} onDrop={event => { event.preventDefault(); const colourId = event.dataTransfer.getData('text/listening-colour'); if (active?.type === 'colour_object' && colours.has(colourId)) updateAnswer(active.id, { type: 'colour_object', objectId: object.id, colourId }); }} onClick={() => { if (active?.type !== 'colour_object') return; if (selectedColour) updateAnswer(active.id, { type: 'colour_object', objectId: object.id, colourId: selectedColour }); else if (answers.part5[active.id]) clearAnswer(active.id); }} style={{ ...regionStyle(object.geometry), backgroundColor: colour ? `${colour.value}aa` : 'rgba(255,255,255,.04)' }} className="absolute border border-dashed border-slate-500/40 enabled:hover:border-blue-600" aria-label={`Vùng hình ${index + 1}`} />;
        })}
        {Object.entries(answers.part5).map(([actionId, answer]) => {
          if (!answer || typeof answer === 'string' || answer.type !== 'place_object') return null;
          const item = part.objectPalette.find(entry => entry.id === answer.paletteItemId);
          return <button key={actionId} type="button" onClick={event => { event.stopPropagation(); clearAnswer(actionId); }} style={{ left: `${answer.anchor.x * 100}%`, top: `${answer.anchor.y * 100}%` }} className="absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-blue-700 bg-white p-1 text-[10px] font-black shadow-lg" aria-label={`${item?.label || 'Hình đã đặt'}, nhấn để gỡ`}>{item?.tokenUrl ? <img src={item.tokenUrl} alt={item.label} className="h-10 w-10 object-contain" /> : item?.label || '●'}</button>;
        })}
      </div>
      <p className="text-center text-xs font-bold text-slate-500">Chọn action, rồi chọn màu hoặc hình trong palette. Mọi vùng/hình hợp lệ đều được thao tác; hệ thống không gợi ý đáp án đúng.</p>
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
