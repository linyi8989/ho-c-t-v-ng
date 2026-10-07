import React, { useEffect, useRef, useState } from 'react';
import type { AssessmentUserAnswer } from '../../shared/competition/answer';
import { LEVEL_LABELS, SUBJECT_LABELS, type PlayableQuestion } from '../../shared/competition/types';
import QuestionView from './QuestionView';

export default function QuestionPreview({ question, number, onClose }: {
  question: PlayableQuestion; number: number; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [answer, setAnswer] = useState<AssessmentUserAnswer>({});
  const answered = Boolean(answer.selectedOptionId || answer.textAnswer || answer.orderedTokenIds?.length || Object.keys(answer.pairMatches || {}).length);

  useEffect(() => {
    const element = dialog.current!, trigger = document.activeElement;
    element.showModal();
    return () => { element.close(); if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus(); };
  }, []);

  return <dialog ref={dialog} id="ioe-question-preview" className="competition-preview"
    aria-labelledby="ioe-preview-heading" aria-describedby="ioe-preview-description"
    onCancel={event => { event.preventDefault(); onClose(); }} onClose={event => { if (!event.currentTarget.open) onClose(); }}
    onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const controls = [...dialog.current!.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],audio[controls],[tabindex]:not([tabindex="-1"])')]
        .filter(element => element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}
    onClick={event => {
      if (event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
    }}>
    <header className="competition-preview-header">
      <div><h2 id="ioe-preview-heading">Xem trước giao diện học sinh</h2>
        <p>{SUBJECT_LABELS[question.subject]} · Lớp {question.grade} · {LEVEL_LABELS[question.level]}</p></div>
      <button type="button" autoFocus onClick={onClose}>Đóng xem trước</button>
    </header>
    <div className="competition-preview-content">
      <p id="ioe-preview-description">Thử trả lời như học sinh. Câu trả lời xem thử không được lưu vào kết quả hoặc lịch sử.</p>
      <QuestionView question={question} number={number} answer={answer} onChange={setAnswer} />
      <button type="button" disabled={!answered} onClick={() => setAnswer({})}>Làm lại câu xem thử</button>
    </div>
  </dialog>;
}
