import React, { useMemo, useState } from 'react';
import type {
  ListeningAnswers,
  ListeningPart1,
  ListeningPart2,
  ListeningPart3,
  ListeningPart4,
  ListeningPart5,
  ListeningRegion,
} from '../types';

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

export function ListeningPart1View({ part, answers, onAnswers }: PartProps<ListeningPart1>) {
  const [selectedChoice, setSelectedChoice] = useState('');
  const labels = useMemo(() => new Map(part.choices.map(choice => [choice.id, choice.label])), [part.choices]);
  const assign = (targetId: string, choiceId: string) => {
    if (!choiceId) return;
    onAnswers({ ...answers, part1: { ...answers.part1, [targetId]: choiceId } });
    setSelectedChoice('');
  };
  return (
    <div className="listening-part space-y-4">
      <div className="flex flex-wrap justify-center gap-2">
        {part.choices.map(choice => {
          const used = Object.values(answers.part1).includes(choice.id);
          return (
            <button
              key={choice.id}
              draggable
              onDragStart={event => event.dataTransfer.setData('text/listening-choice', choice.id)}
              onClick={() => setSelectedChoice(choice.id)}
              className={`rounded-2xl border-2 border-dashed px-5 py-2.5 text-base font-black transition ${
                selectedChoice === choice.id ? 'border-violet-600 bg-violet-600 text-white' : used ? 'border-sky-300 bg-sky-50 text-sky-700' : 'border-rose-300 bg-white text-slate-900'
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
              onDragOver={event => event.preventDefault()}
              onDrop={event => assign(target.id, event.dataTransfer.getData('text/listening-choice'))}
              onClick={() => assign(target.id, selectedChoice)}
              aria-label={`Vùng trả lời ${index + 1}`}
              className={`absolute flex items-center justify-center border-2 border-dashed text-xs font-black shadow-sm transition ${
                answer ? 'border-emerald-500 bg-white/90 text-emerald-800' : 'border-rose-400 bg-rose-100/35 text-rose-700'
              }`}
            >
              {answer ? labels.get(answer) : index + 1}
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

export function ListeningPart3View({ part, answers, onAnswers }: PartProps<ListeningPart3>) {
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
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2">
        {part.options.map((option, index) => (
          <div key={option.id} className="relative overflow-hidden rounded-2xl border-4 border-rose-300 bg-white p-2 shadow-sm">
            <img src={option.imageUrl} alt={option.label} className="h-36 w-full object-contain" />
            <span className="absolute bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-rose-400 px-3 py-1 text-sm font-black text-white">{String.fromCharCode(65 + index)}</span>
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {part.items.map(item => (
          <div key={item.id} className="grid grid-cols-[76px_1fr_92px] items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <img src={item.imageUrl} alt="" className="h-16 w-16 rounded-xl object-contain" />
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

export function ListeningPart5View({ part, answers, onAnswers }: PartProps<ListeningPart5>) {
  const [selectedColour, setSelectedColour] = useState('');
  const colours = useMemo(() => new Map(part.colours.map(colour => [colour.id, colour])), [part.colours]);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-center gap-3">
        {part.colours.map(colour => (
          <button
            key={colour.id}
            onClick={() => setSelectedColour(colour.id)}
            className={`flex items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-2 font-black ${selectedColour === colour.id ? 'border-slate-900 bg-slate-900 text-white' : 'border-rose-300 bg-white text-slate-800'}`}
          >
            <span className="h-7 w-12 rounded-xl border border-black/10" style={{ backgroundColor: colour.value }} />
            {colour.label}
          </button>
        ))}
      </div>
      <div className="relative mx-auto max-w-5xl overflow-hidden rounded-2xl border-2 border-orange-300 bg-white">
        <img src={part.sceneUrl} alt="Part 5" className="block h-auto w-full" draggable={false} />
        {part.targets.map((target, index) => {
          const answer = answers.part5[target.id];
          const colour = colours.get(answer);
          return (
            <button
              key={target.id}
              onClick={() => selectedColour && onAnswers({ ...answers, part5: { ...answers.part5, [target.id]: selectedColour } })}
              style={{
                ...regionStyle(target.region),
                backgroundColor: colour ? `${colour.value}99` : 'rgba(244,63,94,.10)',
              }}
              className={`absolute flex items-center justify-center border-2 border-dashed font-black ${answer ? 'border-slate-700 text-slate-900' : 'border-rose-500 text-rose-600'}`}
              aria-label={`${target.label}, vùng ${index + 1}`}
            >
              <span className="rounded-lg bg-white/80 px-2 py-1 text-[10px]">{target.label}</span>
            </button>
          );
        })}
      </div>
      <p className="text-center text-xs font-bold text-slate-500">Chọn một màu rồi chạm vùng cần tô. Có thể đổi màu trước khi nộp.</p>
    </div>
  );
}
