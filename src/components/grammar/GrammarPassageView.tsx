import { useState } from 'react';
import type React from 'react';
import { grammarOptionLabel, grammarPassageSegments, type GrammarPassagePresentation } from '../../lib/grammarPassages';
import { placeSingleUseAnswer, removeSingleUseAnswer } from '../../features/listening/student/listeningAnswerMoves';
import './GrammarPassage.css';

export interface PassageFeedback { isCorrect: boolean; correctOptionId?: string; explanation?: string; scoreAwarded?: number }
interface Props {
  key?: string;
  attempt: GrammarPassagePresentation;
  selected: Record<string, string>;
  onChoice?: (questionId: string, optionId: string) => void;
  onBankChange?: (answers: Record<string, string>) => void;
  feedback?: Record<string, PassageFeedback>;
  disabled?: boolean;
  review?: boolean;
  questionNumberOffset?: number;
}
export default function GrammarPassageView({ attempt, selected, onChoice, onBankChange, feedback = {}, disabled = false, review = false, questionNumberOffset }: Props) {
  const [activeToken, setActiveToken] = useState('');
  const [draggingToken, setDraggingToken] = useState('');
  const bank = attempt.wordBankSnapshot || [];
  const bankMode = attempt.displayMode === 'passage_drag_drop';
  const used = new Set(Object.values(selected));
  const labels = new Map(bank.map(token => [token.id, token.text]));
  const questionsByBlank = new Map(attempt.questions.map(question => [question.blankNumber, question]));
  const answersByQuestion = new Map(attempt.answers.map(answer => [answer.attemptQuestionId, answer]));
  const assign = (questionId: string, tokenId: string) => {
    if (disabled || review || !labels.has(tokenId)) return;
    onBankChange?.(placeSingleUseAnswer(selected, questionId, tokenId));
    setActiveToken(''); setDraggingToken('');
  };
  const clear = (questionId: string) => {
    if (disabled || review) return;
    onBankChange?.(removeSingleUseAnswer(selected, questionId)); setActiveToken('');
  };
  const handleTokenDrag = (event: React.DragEvent<HTMLElement>, tokenId: string) => {
    event.dataTransfer.setData('text/grammar-token', tokenId); event.dataTransfer.effectAllowed = 'move'; setDraggingToken(tokenId);
  };
  const instruction = attempt.instructionSnapshot || (bankMode ? 'Put a word in each gap to complete the passage.' : 'Read the passage and choose the correct answer.');
  return <div className="grammar-passage-exercise" data-mode={attempt.displayMode} data-review={review || undefined}>
    <p className="grammar-passage-instruction">{instruction}</p>
    {bankMode ? <>
      <p className="grammar-passage-hint">{review ? 'Bài làm của em' : 'Kéo từ vào ô trống, hoặc chọn từ rồi chọn ô. Chọn từ đã điền để chuyển; kéo về khay để gỡ.'}</p>
      <div className="grammar-word-bank" aria-label="Ngân hàng từ" onDragOver={event => event.preventDefault()} onDrop={event => {
        event.preventDefault(); const tokenId = event.dataTransfer.getData('text/grammar-token');
        const source = Object.keys(selected).find(id => selected[id] === tokenId); if (source) clear(source);
      }}>
        {bank.filter(token => !used.has(token.id)).map(token => <button key={token.id} type="button" className="grammar-word-token" disabled={disabled || review} draggable={!disabled && !review} aria-pressed={activeToken === token.id} onClick={() => setActiveToken(current => current === token.id ? '' : token.id)} onDragStart={event => handleTokenDrag(event, token.id)} onDragEnd={() => setDraggingToken('')}>
          {token.text}
        </button>)}
        {!bank.some(token => !used.has(token.id)) && <span className="grammar-passage-hint">Đã đặt tất cả thẻ từ.</span>}
      </div>
      <div className="grammar-cloze-passage" aria-label="Đoạn văn điền từ">{grammarPassageSegments(attempt.passageSnapshot || '').map((segment, index) => {
        if (segment.blankNumber === undefined) return <span key={`text-${index}`}>{segment.text}</span>;
        const question = questionsByBlank.get(segment.blankNumber);
        if (!question) return <span key={`missing-${index}`}>{segment.text}</span>;
        const displayNumber = questionNumberOffset === undefined ? segment.blankNumber : questionNumberOffset + attempt.questions.indexOf(question) + 1;
        const tokenId = selected[question.id];
        const answer = answersByQuestion.get(question.id);
        const correct = question.correctOptionId ? labels.get(question.correctOptionId) : '';
        const state = review && correct ? !tokenId ? 'unanswered' : answer?.isCorrect ? 'correct' : 'incorrect' : tokenId ? 'filled' : 'empty';
        return <span key={question.id} className="grammar-blank-wrap" data-answer-state={state}>
          <span className="grammar-blank-number">({displayNumber})</span>
          <button type="button" className="grammar-inline-blank" data-blank-number={segment.blankNumber} data-token-selected={tokenId && activeToken === tokenId ? 'true' : undefined} data-eligible={activeToken || draggingToken ? 'true' : undefined} disabled={disabled || review} draggable={Boolean(tokenId) && !disabled && !review} aria-label={`Ô ${displayNumber}${tokenId ? `: ${labels.get(tokenId)}` : ': chưa điền'}`} aria-pressed={Boolean(tokenId && activeToken === tokenId)} onDragStart={event => tokenId && handleTokenDrag(event, tokenId)} onDragEnd={() => setDraggingToken('')} onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }} onDrop={event => { event.preventDefault(); assign(question.id, event.dataTransfer.getData('text/grammar-token')); }} onClick={() => {
            if (activeToken && activeToken !== tokenId) assign(question.id, activeToken);
            else if (tokenId) setActiveToken(current => current === tokenId ? '' : tokenId);
          }} onKeyDown={event => { if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); clear(question.id); } if (event.key === 'Escape') setActiveToken(''); }}>
            {tokenId ? labels.get(tokenId) : <span aria-hidden="true">&nbsp;&nbsp;&nbsp;&nbsp;</span>}
          </button>
          {review && correct && <span className="grammar-blank-result">{state === 'correct' ? '✓' : `✗ ${correct}`}</span>}
        </span>;
      })}</div>
      {review && attempt.questions.some(question => question.explanationSnapshot) && <div className="grammar-passage-explanations">{attempt.questions.map((question, index) => question.explanationSnapshot && <p key={question.id}><strong>{questionNumberOffset === undefined ? question.blankNumber : questionNumberOffset + index + 1}:</strong> {question.explanationSnapshot}</p>)}</div>}
    </> : <>
      {attempt.passageSnapshot && <section className="grammar-reading-passage" aria-label="Bài đọc">{attempt.passageSnapshot}</section>}
      <div className="grammar-reading-questions" aria-label="Câu hỏi đọc hiểu">{attempt.questions.map((question, index) => {
        const savedFeedback = feedback[question.id];
        const correctId = review ? question.correctOptionId : savedFeedback?.correctOptionId;
        return <fieldset key={question.id} className="grammar-reading-question">
          <legend><span>{(questionNumberOffset || 0) + index + 1}.</span> {question.questionSnapshot}</legend>
          <div className="grammar-reading-options">{question.optionsSnapshot.map((option, optionIndex) => {
            const isSelected = selected[question.id] === option.id;
            const state = correctId === option.id ? 'correct' : isSelected && correctId ? 'incorrect' : isSelected ? 'selected' : 'idle';
            return <button type="button" key={option.id} className="grammar-reading-option" disabled={disabled || review || Boolean(savedFeedback)} aria-pressed={isSelected} data-answer-state={state} onClick={() => onChoice?.(question.id, option.id)}>
              <span className="grammar-reading-option-label">{grammarOptionLabel(optionIndex)}.</span><span>{option.text}</span>{state === 'correct' ? <span aria-label="Đáp án đúng">✓</span> : state === 'incorrect' ? <span aria-label="Đáp án sai">✗</span> : null}
            </button>;
          })}</div>
          {(review ? question.explanationSnapshot : savedFeedback?.explanation) && <p className="grammar-reading-explanation"><strong>Giải thích:</strong> {review ? question.explanationSnapshot : savedFeedback?.explanation}</p>}
        </fieldset>;
      })}</div>
    </>}
  </div>;
}
