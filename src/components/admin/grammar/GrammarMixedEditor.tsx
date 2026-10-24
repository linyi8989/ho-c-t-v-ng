import { useState } from 'react';
import type { GrammarBlock, GrammarBlockType, GrammarQuestion } from '../../../types';
import { cloneGrammarBlock, grammarMixedPreview } from '../../../lib/grammarBlocks';
import { grammarOptionLabel } from '../../../lib/grammarPassages';
import GrammarMixedView from '../../grammar/GrammarMixedView';

interface Props {
  blocks: GrammarBlock[];
  questions: GrammarQuestion[];
  onChange: (blocks: GrammarBlock[], questions: GrammarQuestion[]) => void;
}

const blockLabels: Record<GrammarBlockType, string> = {
  multiple_choice: 'Trắc nghiệm',
  passage_drag_drop: 'Kéo thả điền từ',
  reading_comprehension: 'Đọc hiểu',
};
const control = 'grammar-mixed-control rounded-xl border px-3 py-2 text-sm font-bold';
const field = 'min-w-0 w-full rounded-xl border border-gray-300 bg-white p-3 text-sm text-gray-900';
const makeId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

function move<T>(values: T[], index: number, offset: number) {
  const next = [...values];
  const target = index + offset;
  if (target < 0 || target >= values.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export default function GrammarMixedEditor({ blocks, questions, onChange }: Props) {
  const [previewOpen, setPreviewOpen] = useState(false);
  const [trialAnswers, setTrialAnswers] = useState<Record<string, string>>({});
  const byId = new Map(questions.map(question => [question.id, question]));
  const commit = (nextBlocks: GrammarBlock[], nextQuestions = questions) => {
    const nextById = new Map(nextQuestions.map(question => [question.id, question]));
    const referenced = new Set(nextBlocks.flatMap(block => block.questionIds));
    const ordered: GrammarQuestion[] = nextBlocks.flatMap(block => block.questionIds.flatMap(id => {
      const question = nextById.get(id);
      return question ? [{ ...question, blockId: block.id }] : [];
    }));
    // Preserve malformed/orphan draft rows for validation instead of silently dropping data.
    ordered.push(...nextQuestions.filter(question => !referenced.has(question.id)));
    onChange(nextBlocks, ordered.map((question, index) => ({ ...question, position: index + 1 })));
    setTrialAnswers({});
  };
  const patchBlock = (id: string, patch: Partial<GrammarBlock>, nextQuestions = questions) =>
    commit(blocks.map(block => block.id === id ? { ...block, ...patch } : block), nextQuestions);
  const patchQuestion = (id: string, patch: Partial<GrammarQuestion>) =>
    commit(blocks, questions.map(question => question.id === id ? { ...question, ...patch } : question));
  const addBlock = (type: GrammarBlockType) => {
    const block: GrammarBlock = { id: makeId('grammar-block'), type, title: '', instruction: '', questionIds: [], ...(type === 'multiple_choice' ? {} : { passage: '' }), ...(type === 'passage_drag_drop' ? { wordBank: [] } : {}) };
    commit([...blocks, block]);
  };
  const addQuestion = (block: GrammarBlock) => {
    const id = makeId('grammar-question');
    const bankMode = block.type === 'passage_drag_drop';
    const blankNumber = block.questionIds.reduce((max, questionId) => Math.max(max, byId.get(questionId)?.blankNumber || 0), 0) + 1;
    const options = bankMode ? [] : [1, 2, 3, 4].map((number, index) => ({ id: `${id}-option-${number}`, text: '', originalPosition: index + 1 }));
    const question: GrammarQuestion = { id, blockId: block.id, questionType: bankMode ? 'bank_select' : 'multiple_choice', questionText: bankMode ? `Ô trống ${blankNumber}` : '', options, correctOptionId: '', explanation: '', score: 1, position: questions.length + 1, ...(bankMode ? { blankNumber } : {}) };
    patchBlock(block.id, { questionIds: [...block.questionIds, id], ...(bankMode ? { passage: `${block.passage || ''}${block.passage ? ' ' : ''}[[${blankNumber}]]` } : {}) }, [...questions, question]);
  };
  const duplicateQuestion = (block: GrammarBlock, question: GrammarQuestion) => {
    const id = makeId('grammar-question');
    const options = question.options.map((option, index) => ({ ...option, id: `${id}-option-${index + 1}` }));
    const correctIndex = question.options.findIndex(option => option.id === question.correctOptionId);
    const bankMode = block.type === 'passage_drag_drop';
    const blankNumber = block.questionIds.reduce((max, questionId) => Math.max(max, byId.get(questionId)?.blankNumber || 0), 0) + 1;
    const copy = { ...question, id, options, correctOptionId: bankMode ? '' : options[correctIndex]?.id || '', ...(bankMode ? { blankNumber, questionText: `Ô trống ${blankNumber}` } : {}) };
    const questionIds = [...block.questionIds];
    if (bankMode) questionIds.push(id);
    else questionIds.splice(questionIds.indexOf(question.id) + 1, 0, id);
    patchBlock(block.id, { questionIds, ...(bankMode ? { passage: `${block.passage || ''} [[${blankNumber}]]` } : {}) }, [...questions, copy]);
  };
  const deleteQuestion = (block: GrammarBlock, question: GrammarQuestion) => {
    patchBlock(block.id, { questionIds: block.questionIds.filter(id => id !== question.id), ...(block.type === 'passage_drag_drop' ? { passage: (block.passage || '').replace(`[[${question.blankNumber}]]`, '') } : {}) }, questions.filter(item => item.id !== question.id));
  };

  return <section id="grammar-mixed-editor" className="space-y-5" aria-label="Nội dung bài ngữ pháp kết hợp">
    <style>{`
      #admin-dashboard-container #grammar-mixed-editor .grammar-mixed-control {
        color:#123a73 !important;background:#eff6ff !important;border-color:#93b7e7 !important;box-shadow:none !important;
      }
      #admin-dashboard-container #grammar-mixed-editor .grammar-mixed-control:not(:disabled):hover {background:#dbeafe !important;color:#102e59 !important;}
      #admin-dashboard-container #grammar-mixed-editor .grammar-mixed-control:disabled {color:#475569 !important;background:#e2e8f0 !important;border-color:#cbd5e1 !important;opacity:1 !important;cursor:not-allowed;}
      #admin-dashboard-container #grammar-mixed-editor .grammar-mixed-control:focus-visible {outline:3px solid #1d4ed8;outline-offset:3px;}
      #grammar-mixed-editor input,#grammar-mixed-editor textarea,#grammar-mixed-editor select {max-width:100%;}
    `}</style>
    <div className="rounded-3xl border border-blue-200 bg-white p-5 space-y-4">
      <div><h3 className="font-black text-gray-900">Nội dung cùng một bài · {blocks.length} nhóm · {questions.length} câu</h3><p className="mt-1 text-sm text-gray-700">Thêm các dạng theo thứ tự bạn muốn. Học sinh làm trên một trang và nộp một lần.</p></div>
      <div className="flex flex-wrap gap-3">{(Object.keys(blockLabels) as GrammarBlockType[]).map(type => <button key={type} type="button" className={control} data-add-grammar-block={type} onClick={() => addBlock(type)}>+ {blockLabels[type]}</button>)}</div>
      {!blocks.length && <p className="rounded-xl border border-dashed border-blue-300 p-4 text-sm text-blue-900">Chọn một dạng bài phía trên hoặc nhập JSON từ ChatGPT để bắt đầu. Một bài có thể lặp lại cùng một dạng nhiều lần.</p>}
      <button type="button" id="grammar-mixed-preview-toggle" className={control} aria-expanded={previewOpen} disabled={!blocks.length} onClick={() => { setTrialAnswers({}); setPreviewOpen(value => !value); }}>{previewOpen ? 'Đóng xem trước' : 'Xem trước và thử làm toàn bài'}</button>
      {previewOpen && <div id="grammar-passage-preview" key={JSON.stringify([blocks, questions])} className="rounded-2xl border border-blue-200 p-4"><GrammarMixedView attempt={grammarMixedPreview(blocks, questions)} selected={trialAnswers} onChoice={(id, optionId) => setTrialAnswers(current => ({ ...current, [id]: optionId }))} onBankChange={(blockId, values) => setTrialAnswers(current => {
        const ids = new Set(blocks.find(block => block.id === blockId)?.questionIds || []);
        return { ...Object.fromEntries(Object.entries(current).filter(([id]) => !ids.has(id))), ...values };
      })} /></div>}
    </div>
    {blocks.map((block, blockIndex) => {
      const bankMode = block.type === 'passage_drag_drop';
      const bank = block.wordBank || [];
      return <article key={block.id} className="rounded-3xl border border-gray-200 bg-white p-5 space-y-4" data-grammar-block-id={block.id} aria-label={`Nhóm ${blockIndex + 1}: ${blockLabels[block.type]}`}>
        <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-black text-gray-900">{blockIndex + 1}. {blockLabels[block.type]} · {block.questionIds.length} câu</h3><div className="flex flex-wrap gap-2">
          <button type="button" className={control} aria-label={`Đưa nhóm ${blockIndex + 1} lên`} disabled={blockIndex === 0} onClick={() => commit(move(blocks, blockIndex, -1))}>Lên</button>
          <button type="button" className={control} aria-label={`Đưa nhóm ${blockIndex + 1} xuống`} disabled={blockIndex === blocks.length - 1} onClick={() => commit(move(blocks, blockIndex, 1))}>Xuống</button>
          <button type="button" className={control} aria-label={`Nhân bản nhóm ${blockIndex + 1}`} disabled={block.questionIds.some(id => !byId.has(id))} onClick={() => { const copy = cloneGrammarBlock(block, questions); const next = [...blocks]; next.splice(blockIndex + 1, 0, copy.block); commit(next, [...questions, ...copy.questions]); }}>Nhân bản nhóm</button>
          <button type="button" className={control} aria-label={`Xóa nhóm ${blockIndex + 1}`} onClick={() => { if (block.questionIds.length && !window.confirm('Xóa nhóm này cùng các câu hỏi bên trong khỏi nội dung đang soạn?')) return; const ids = new Set(block.questionIds); commit(blocks.filter(item => item.id !== block.id), questions.filter(question => !ids.has(question.id))); }}>Xóa nhóm</button>
        </div></div>
        <label className="block text-sm font-bold text-gray-900">Tiêu đề nhóm (tùy chọn)<input className={`${field} mt-2`} value={block.title} onChange={event => patchBlock(block.id, { title: event.target.value })} placeholder="Ví dụ: Present Simple" /></label>
        <label className="block text-sm font-bold text-gray-900">Hướng dẫn làm bài<input className={`${field} mt-2`} value={block.instruction} onChange={event => patchBlock(block.id, { instruction: event.target.value })} /></label>
        {block.type !== 'multiple_choice' && <label className="block text-sm font-bold text-gray-900">{bankMode ? 'Đoạn văn có ô trống [[1]], [[2]]…' : 'Bài đọc hiển thị trên câu hỏi'}<textarea className={`${field} mt-2 min-h-40 leading-7`} value={block.passage || ''} onChange={event => patchBlock(block.id, { passage: event.target.value })} /></label>}
        {bankMode && <section className="space-y-3" aria-label={`Ngân hàng từ nhóm ${blockIndex + 1}`}>
          <div className="flex flex-wrap items-center justify-between gap-3"><h4 className="font-bold text-gray-900">Ngân hàng từ ({bank.length})</h4><button type="button" className={control} onClick={() => patchBlock(block.id, { wordBank: [...bank, { id: makeId('grammar-token'), text: '' }] })}>Thêm thẻ từ / từ nhiễu</button></div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{bank.map((token, index) => <div key={token.id} className="flex min-w-0 gap-2"><input className={field} aria-label={`Thẻ từ ${index + 1} nhóm ${blockIndex + 1}`} value={token.text} onChange={event => patchBlock(block.id, { wordBank: bank.map(item => item.id === token.id ? { ...item, text: event.target.value } : item) })} /><button type="button" className={control} aria-label={`Xóa thẻ từ ${index + 1} nhóm ${blockIndex + 1}`} onClick={() => patchBlock(block.id, { wordBank: bank.filter(item => item.id !== token.id) }, questions.map(question => question.blockId === block.id && question.correctOptionId === token.id ? { ...question, correctOptionId: '' } : question))}>Xóa</button></div>)}</div>
          <p className="text-xs text-gray-700">Mỗi thẻ chỉ dùng trong nhóm này và dùng một lần. Nếu cần dùng một từ hai lần, tạo hai thẻ giống nhau. Số ô được tính riêng trong từng đoạn văn.</p>
        </section>}
        <div className="flex flex-wrap items-center justify-between gap-3"><h4 className="font-bold text-gray-900">Câu hỏi trong nhóm</h4><button type="button" className={control} aria-label={`${bankMode ? 'Thêm ô trống' : 'Thêm câu hỏi'} vào nhóm ${blockIndex + 1}`} onClick={() => addQuestion(block)}>{bankMode ? 'Thêm ô trống' : 'Thêm câu hỏi'}</button></div>
        {block.questionIds.map((questionId, questionIndex) => {
          const question = byId.get(questionId);
          if (!question) return <p role="alert" key={questionId} className="text-red-800">Thiếu dữ liệu câu hỏi trong nhóm. Hãy khôi phục bản nháp trước khi lưu.</p>;
          const number = blocks.slice(0, blockIndex).reduce((count, item) => count + item.questionIds.length, 0) + questionIndex + 1;
          return <div key={question.id} role="group" aria-label={`Câu ${number}`} className="rounded-2xl border border-gray-200 p-4 space-y-3" data-grammar-question-id={question.id}>
            <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm text-gray-900">Câu {number}{bankMode ? ` · ô ${question.blankNumber}` : ''}</strong><div className="flex flex-wrap gap-2">
              {!bankMode && <><button type="button" className={control} aria-label={`Đưa câu ${number} lên`} disabled={questionIndex === 0} onClick={() => patchBlock(block.id, { questionIds: move(block.questionIds, questionIndex, -1) })}>Lên</button><button type="button" className={control} aria-label={`Đưa câu ${number} xuống`} disabled={questionIndex === block.questionIds.length - 1} onClick={() => patchBlock(block.id, { questionIds: move(block.questionIds, questionIndex, 1) })}>Xuống</button></>}
              <button type="button" className={control} aria-label={`Nhân bản câu ${number}`} onClick={() => duplicateQuestion(block, question)}>Nhân bản câu</button><button type="button" className={control} aria-label={`Xóa câu ${number}`} onClick={() => deleteQuestion(block, question)}>Xóa câu</button>
            </div></div>
            {bankMode ? <div className="flex flex-wrap gap-3"><label className="text-sm font-bold text-gray-900">Số ô trống<input type="number" min={1} className={`${field} mt-2`} value={question.blankNumber || ''} onChange={event => {
              const blankNumber = Number(event.target.value);
              if (!Number.isSafeInteger(blankNumber) || blankNumber < 1) return;
              patchBlock(block.id, { passage: (block.passage || '').replace(`[[${question.blankNumber}]]`, `[[${blankNumber}]]`) }, questions.map(item => item.id === question.id ? { ...item, blankNumber, questionText: `Ô trống ${blankNumber}` } : item));
            }} /></label><label className="min-w-0 flex-1 text-sm font-bold text-gray-900">Đáp án đúng<select className={`${field} mt-2`} value={question.correctOptionId} onChange={event => patchQuestion(question.id, { correctOptionId: event.target.value })}><option value="">Chọn thẻ từ</option>{bank.map((token, index) => <option key={token.id} value={token.id}>{token.text || '(thẻ trống)'} · thẻ {index + 1}</option>)}</select></label></div> : <>
              <label className="block text-sm font-bold text-gray-900">Nội dung câu hỏi<textarea className={`${field} mt-2`} value={question.questionText} onChange={event => patchQuestion(question.id, { questionText: event.target.value })} /></label>
              <div className="space-y-2">{question.options.map((option, optionIndex) => <div key={option.id} className="flex min-w-0 items-start gap-2"><label className="flex shrink-0 items-center gap-1 py-3 text-sm font-bold text-gray-900"><input type="radio" name={`grammar-correct-${question.id}`} aria-label={`Chọn ${grammarOptionLabel(optionIndex)} là đáp án đúng câu ${number}`} checked={question.correctOptionId === option.id} onChange={() => patchQuestion(question.id, { correctOptionId: option.id })} />{grammarOptionLabel(optionIndex)}.</label><input className={field} aria-label={`Lựa chọn ${grammarOptionLabel(optionIndex)} câu ${number}`} value={option.text} onChange={event => patchQuestion(question.id, { options: question.options.map(item => item.id === option.id ? { ...item, text: event.target.value } : item) })} /><button type="button" className={control} aria-label={`Xóa lựa chọn ${grammarOptionLabel(optionIndex)} câu ${number}`} onClick={() => patchQuestion(question.id, { options: question.options.filter(item => item.id !== option.id), ...(question.correctOptionId === option.id ? { correctOptionId: '' } : {}) })}>Xóa</button></div>)}</div>
              <button type="button" className={control} onClick={() => patchQuestion(question.id, { options: [...question.options, { id: makeId('grammar-option'), text: '', originalPosition: question.options.length + 1 }] })}>Thêm lựa chọn</button>
            </>}
            <label className="block text-sm font-bold text-gray-900">Giải thích<textarea className={`${field} mt-2`} value={question.explanation} onChange={event => patchQuestion(question.id, { explanation: event.target.value })} /></label>
            <label className="block text-sm font-bold text-gray-900">Điểm<input type="number" min={1} className={`${field} mt-2`} value={question.score} onChange={event => patchQuestion(question.id, { score: Number(event.target.value) })} /></label>
          </div>;
        })}
      </article>;
    })}
  </section>;
}
