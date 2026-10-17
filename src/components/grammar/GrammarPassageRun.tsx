import { useRef, useState } from 'react';
import type { GrammarAttempt } from '../../types';
import type { ClientLearningRun } from '../../lib/learningRuns';
import GrammarPassageView, { type PassageFeedback } from './GrammarPassageView';

interface Props {
  key?: string;
  attempt: GrammarAttempt; run: ClientLearningRun; lazy: boolean;
  guestId: string; studentName: string; shareToken?: string;
  fetcher: (url: string, init?: RequestInit) => Promise<Response>;
  onAttempt: (attempt: GrammarAttempt) => void;
  onComplete: (attempt: GrammarAttempt) => void;
}
type Pending = { bankAnswers?: Record<string, string>; answersRevision?: number; mutationId?: string; attemptQuestionId?: string; selectedOptionId?: string };
const mapping = (attempt: GrammarAttempt) => Object.fromEntries(attempt.answers.filter(answer => answer.selectedOptionId).map(answer => [answer.attemptQuestionId, answer.selectedOptionId!]));
const pendingKey = (attemptId: string) => `msdieu_grammar_passage_pending_v1:${attemptId}`;
function readPending(attempt: GrammarAttempt): Pending | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(pendingKey(attempt.id)) || 'null');
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    if (attempt.displayMode === 'passage_drag_drop') {
      if (value.mutationId === attempt.lastAnswerMutationId) { sessionStorage.removeItem(pendingKey(attempt.id)); return null; }
      if (value.answersRevision !== (attempt.answersRevision || 0) || !value.bankAnswers || typeof value.bankAnswers !== 'object') return null;
      if (Object.entries(value.bankAnswers).some(([id, token]) => !attempt.questions.some(question => question.id === id) || !attempt.wordBankSnapshot?.some(item => item.id === token))) return null;
    } else if (!attempt.questions.some(question => question.id === value.attemptQuestionId && question.optionsSnapshot.some(option => option.id === value.selectedOptionId))) return null;
    return value;
  } catch { return null; }
}
function storePending(attemptId: string, pending: Pending | null) {
  try { if (pending) sessionStorage.setItem(pendingKey(attemptId), JSON.stringify(pending)); else sessionStorage.removeItem(pendingKey(attemptId)); } catch { /* Current state still permits retry. */ }
}

export default function GrammarPassageRun({ attempt, run, lazy, guestId, studentName, shareToken, fetcher, onAttempt, onComplete }: Props) {
  const [pending, setPending] = useState<Pending | null>(() => readPending(attempt));
  const [selected, setSelected] = useState<Record<string, string>>(() => {
    const saved = readPending(attempt);
    return saved?.bankAnswers || (saved?.attemptQuestionId && saved.selectedOptionId ? { ...mapping(attempt), [saved.attemptQuestionId]: saved.selectedOptionId } : mapping(attempt));
  });
  const [feedback, setFeedback] = useState<Record<string, PassageFeedback>>(attempt.answerFeedback || {});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const current = useRef(attempt);
  current.current = attempt;
  const credentials = () => ({ guestId, studentName, shareToken, attemptToken: current.current.attemptToken || run.runSecret });
  const save = async (payload: Pending) => {
    if (busy.current) return;
    busy.current = true; setSaving(true); setError('');
    const active = current.current;
    const prepared = lazy && active.status === 'prepared';
    try {
      const response = await fetcher(prepared ? `/api/grammar-sets/${active.grammarSetId}/attempts/activate` : `/api/grammar-attempts/${active.id}/answers`, {
        method: 'POST', body: JSON.stringify({ ...credentials(), ...payload, ...(prepared ? { ...run, grammarSetVersion: active.grammarSetVersion } : {}) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Không lưu được đáp án.');
      if (data.alreadyCompleted) { storePending(active.id, null); onComplete(data.attempt); return; }
      let updated: GrammarAttempt;
      if (data.attempt) updated = { ...data.attempt, attemptToken: data.attempt.attemptToken || active.attemptToken || run.runSecret };
      else if (data.answer) updated = { ...active, answers: [...active.answers.filter(answer => answer.attemptQuestionId !== data.answer.attemptQuestionId), data.answer] };
      else throw new Error('Phản hồi lưu đáp án không hợp lệ.');
      if (payload.attemptQuestionId && data.feedback) setFeedback(value => ({ ...value, [payload.attemptQuestionId!]: data.feedback }));
      current.current = updated; onAttempt(updated); setSelected(mapping(updated));
      setPending(null); storePending(active.id, null);
    } catch (cause) { setError((cause as Error).message); }
    finally { busy.current = false; setSaving(false); }
  };
  const change = (payload: Pending, values: Record<string, string>) => {
    if (busy.current || pending) return;
    setSelected(values); setPending(payload); storePending(attempt.id, payload); void save(payload);
  };
  const submit = async () => {
    if (busy.current || pending) return;
    if (current.current.status === 'prepared') { setError('Hãy trả lời ít nhất một câu trước khi nộp.'); return; }
    busy.current = true; setSaving(true); setError('');
    try {
      const response = await fetcher(`/api/grammar-attempts/${attempt.id}/submit`, { method: 'POST', body: JSON.stringify(credentials()) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Không nộp được bài.');
      storePending(attempt.id, null); onComplete(data);
    } catch (cause) { setError((cause as Error).message); }
    finally { busy.current = false; setSaving(false); }
  };
  return <section className="grammar-panel grammar-passage-run space-y-5" id="grammar-passage-run">
    <div className="grammar-progress flex flex-wrap items-center justify-between gap-3" aria-live="polite"><span className="grammar-question-counter">{attempt.displayMode === 'passage_drag_drop' ? 'Điền từ vào đoạn văn' : 'Đọc hiểu'}</span><span className="grammar-answered-counter">Đã trả lời {attempt.answers.length}/{attempt.questions.length}</span></div>
    {error && <p role="alert" className="grammar-error rounded-xl p-4">{error}</p>}
    {pending && !saving && <div className="space-y-3 rounded-xl border border-amber-400 p-4"><p className="font-bold text-amber-900">Có thay đổi chưa được lưu. Hãy thử lưu lại trước khi làm tiếp.</p><div className="flex flex-wrap gap-3"><button type="button" className="grammar-button grammar-button-primary" id="grammar-retry-answer" onClick={() => void save(pending)}>Thử lưu lại</button><button type="button" className="grammar-button grammar-button-secondary" onClick={() => { setSelected(mapping(current.current)); setPending(null); storePending(attempt.id, null); setError(''); }}>Hủy thay đổi chưa lưu</button></div></div>}
    <GrammarPassageView attempt={attempt} selected={selected} feedback={feedback} disabled={saving || Boolean(pending)} onChoice={(questionId, optionId) => change({ attemptQuestionId: questionId, selectedOptionId: optionId }, { ...selected, [questionId]: optionId })} onBankChange={values => change({ bankAnswers: values, answersRevision: attempt.answersRevision || 0, mutationId: `bank-${crypto.randomUUID()}` }, values)} />
    <div className="flex flex-wrap items-center justify-between gap-4"><p className="text-sm font-bold text-blue-900" role="status" aria-live="polite">{saving ? 'Đang lưu…' : pending ? 'Chưa lưu được thay đổi.' : attempt.status === 'prepared' ? 'Chọn đáp án để bắt đầu.' : 'Các đáp án đã được lưu.'}</p><button type="button" id="grammar-submit-btn" className="grammar-button grammar-button-submit" disabled={saving || Boolean(pending) || attempt.status === 'prepared'} onClick={() => void submit()}>Nộp bài</button></div>
  </section>;
}
