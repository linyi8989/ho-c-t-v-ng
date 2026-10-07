import React, { useEffect, useRef, type KeyboardEvent } from 'react';
import type { AssessmentUserAnswer } from '../../shared/competition/answer';
import { displayTitle, type PlayableQuestion, type Media } from '../../shared/competition/types';
import './competition.css';

export function MediaView({ items }: { items: Media[] }) {
  if (!items.length) return null;
  return <div className="competition-media">{items.map((m, i) => m.kind === 'image'
    ? <img key={i} src={m.url} alt="Hình minh họa câu hỏi" loading="lazy" />
    : <audio key={i} src={m.url} controls preload="none" onLoadedMetadata={e => { e.currentTarget.playbackRate = m.playbackRate || 1; }} />)}</div>;
}
export default function QuestionView({ question: q, number, answer = {}, onChange, onNext, disabled = false, correctOptionId }: {
  question: PlayableQuestion; number: number; answer?: AssessmentUserAnswer; onChange?: (a: AssessmentUserAnswer) => void; onNext?: () => void; disabled?: boolean; correctOptionId?: string;
}) {
  const questionRef = useRef<HTMLElement | null>(null), keyboardNavigation = !!onNext;
  useEffect(() => {
    if (!keyboardNavigation || disabled) return;
    const target = questionRef.current?.querySelector<HTMLElement>('.competition-answer input, .competition-option[aria-pressed="true"]') || questionRef.current?.querySelector<HTMLElement>('.competition-option');
    target?.focus({ preventScroll: true });
  }, [q.id, keyboardNavigation, disabled]);
  const advanceOnEnter = (event: KeyboardEvent<HTMLInputElement | HTMLButtonElement>, answered: boolean) => {
    if (!onNext || disabled || event.defaultPrevented || event.key !== 'Enter') return;
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.repeat) { event.preventDefault(); return; }
    // An unselected option keeps native Enter activation; the next press advances.
    if (!answered) return;
    event.preventDefault(); onNext();
  };
  return <article ref={questionRef} className="competition-question" aria-label={`Câu ${number}`}>
    <h3>Câu {number}{displayTitle(q.title, number) !== `Câu ${number}` ? `. ${displayTitle(q.title, number)}` : ''}</h3>
    {q.passage && <div className="competition-passage">{q.passage}</div>}
    <p className="competition-prompt">{q.prompt.replace(/^\s*(?:Câu(?:\s+hỏi)?|Question)\s*\d+\s*[:.)-]?\s*/iu, '')}</p>
    <MediaView items={q.media} />
    {q.interaction === 'choice' ? <div className="competition-options" role="group" aria-label={`Phương án câu ${number}`}>
      {q.options.map(o => <div key={o.id}><button type="button" className="competition-option" disabled={disabled} data-correct={correctOptionId === o.id || undefined} aria-pressed={answer.selectedOptionId === o.id} onClick={() => onChange?.({ selectedOptionId: o.id })}
        onKeyDown={e => advanceOnEnter(e, answer.selectedOptionId === o.id)}>
        <span><strong>{o.label}.</strong> {o.text}</span><MediaView items={o.media.filter(m => m.kind === 'image')} />
        {correctOptionId === o.id && <strong>✓ Đáp án đúng</strong>}
      </button><MediaView items={o.media.filter(m => m.kind === 'audio')} /></div>)}
    </div> : q.interaction === 'ordering' ? <div>
      <p>Chọn các thẻ theo thứ tự. Chọn thẻ đã dùng để gỡ.</p>
      <div className="competition-options">{q.options.map(o => <div key={o.id}><button type="button" disabled={disabled} aria-pressed={answer.orderedTokenIds?.includes(o.id) || false}
        onClick={() => onChange?.({ orderedTokenIds: answer.orderedTokenIds?.includes(o.id) ? answer.orderedTokenIds.filter(id => id !== o.id) : [...(answer.orderedTokenIds || []), o.id] })}>{o.text}<MediaView items={o.media.filter(m => m.kind === 'image')} /></button><MediaView items={o.media.filter(m => m.kind === 'audio')} /></div>)}</div>
      <ol>{answer.orderedTokenIds?.map(id => <li key={id}>{q.options.find(o => o.id === id)?.text}</li>)}</ol>
    </div> : q.interaction === 'matching' ? <div className="competition-matches">{q.pairs?.left.map(o => <label key={o.id}><span>{o.text}<MediaView items={o.media} /></span>
      <select disabled={disabled} value={answer.pairMatches?.[o.id] || ''} onChange={e => {
        const matches = { ...(answer.pairMatches || {}) }; const value = e.target.value;
        Object.keys(matches).forEach(key => { if (matches[key] === value || key === o.id) delete matches[key]; });
        if (value) matches[o.id] = value; onChange?.({ pairMatches: matches });
      }} aria-label={`Nối ${o.text}`}><option value="">Chọn cặp</option>{q.pairs?.right.map(r => <option key={r.id} value={r.id}>{r.label}. {r.text || 'Hình ảnh'}</option>)}</select>
    </label>)}{q.pairs?.right.some(o => o.media.length) && <div>{q.pairs.right.map(o => <div key={o.id}>{o.label}. {o.text}<MediaView items={o.media} /></div>)}</div>}</div>
    : <label className="competition-answer"><span>Câu trả lời của em</span><input value={answer.textAnswer || ''} maxLength={2000} disabled={disabled} autoComplete="off"
      onChange={e => onChange?.({ textAnswer: e.target.value })} onKeyDown={e => advanceOnEnter(e, !!e.currentTarget.value.trim())} /></label>}
  </article>;
}
