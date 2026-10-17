import { useState } from 'react';
import type React from 'react';
import type { GrammarDisplayMode, GrammarQuestion, GrammarWordToken } from '../../../types';
import type { GrammarPassagePresentation } from '../../../lib/grammarPassages';
import GrammarPassageView from '../../grammar/GrammarPassageView';

interface Props {
  mode: GrammarDisplayMode; passage: string; instruction: string; bank: GrammarWordToken[]; questions: GrammarQuestion[];
  onPassage: (value: string) => void; onInstruction: (value: string) => void;
  onBank: React.Dispatch<React.SetStateAction<GrammarWordToken[]>>;
}
export default function GrammarPassageEditor({ mode, passage, instruction, bank, questions, onPassage, onInstruction, onBank }: Props) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [trialAnswers, setTrialAnswers] = useState<Record<string, string>>({});
  const preview: GrammarPassagePresentation = {
    displayMode: mode, passageSnapshot: passage, instructionSnapshot: instruction, wordBankSnapshot: bank,
    questions: questions.map(q => ({ id: q.id, questionId: q.id, questionSnapshot: q.questionText, optionsSnapshot: q.options, blankNumber: q.blankNumber, displayPosition: q.position, scoreSnapshot: q.score, optionOrder: q.options.map(option => option.id) })), answers: [],
  };
  return <section className="rounded-3xl border border-gray-200 bg-white p-6 space-y-4" aria-label="Nội dung đoạn văn">
    <label className="block text-sm font-bold text-gray-900">Hướng dẫn làm bài
      <input aria-label="Hướng dẫn làm bài" value={instruction} onChange={e => onInstruction(e.target.value)} className="mt-2 w-full rounded-xl border border-gray-300 p-3" />
    </label>
    <label className="block text-sm font-bold text-gray-900">{mode === 'passage_drag_drop' ? 'Đoạn văn có ô trống [[1]], [[2]]…' : 'Bài đọc hiển thị phía trên câu hỏi'}
      <textarea id="grammar-passage-input" value={passage} onChange={e => onPassage(e.target.value)} className="mt-2 min-h-48 w-full rounded-xl border border-gray-300 p-3 font-normal leading-7" />
    </label>
    {mode === 'passage_drag_drop' && <div className="space-y-3">
      <div className="flex items-center justify-between gap-3"><h3 className="font-bold text-gray-900">Ngân hàng từ ({bank.length})</h3><button type="button" onClick={() => onBank(current => [...current, { id: `grammar-token-${crypto.randomUUID()}`, text: '' }])} className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-800">Thêm thẻ từ / từ nhiễu</button></div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{bank.map((token, index) => <div key={token.id} className="flex gap-2"><input aria-label={`Thẻ từ ${index + 1}`} value={token.text} onChange={e => onBank(current => current.map(item => item.id === token.id ? { ...item, text: e.target.value } : item))} className="min-w-0 flex-1 rounded-xl border border-gray-300 p-3" /><button type="button" aria-label={`Xóa thẻ từ ${index + 1}`} onClick={() => onBank(current => current.filter(item => item.id !== token.id))} className="rounded-xl border border-rose-200 px-3 text-rose-800">×</button></div>)}</div>
      <p className="text-xs text-gray-600">Mỗi thẻ dùng một lần. Có thể thêm từ nhiễu; nếu cần dùng một từ hai lần, tạo hai thẻ giống nhau. Sau khi xóa thẻ, hãy chọn lại đáp án các ô đang dùng thẻ đó.</p>
    </div>}
    <button type="button" aria-expanded={previewOpen} onClick={() => { setTrialAnswers({}); setPreviewOpen(value => !value); }} className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-bold text-indigo-800">{previewOpen ? 'Đóng xem trước' : 'Xem trước và thử làm như học sinh'}</button>
    {previewOpen && <div id="grammar-passage-preview" className="rounded-2xl border border-blue-200 p-4"><GrammarPassageView key={JSON.stringify([passage, bank, questions])} attempt={preview} selected={trialAnswers} onChoice={(id, optionId) => setTrialAnswers(current => ({ ...current, [id]: optionId }))} onBankChange={setTrialAnswers} /></div>}
  </section>;
}
