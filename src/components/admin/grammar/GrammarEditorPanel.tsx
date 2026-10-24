import type React from 'react';
import { Check, Copy } from 'lucide-react';
import type { GrammarBlock, GrammarDisplayMode, GrammarQuestion, GrammarQuestionType, GrammarWordToken } from '../../../types';
import { grammarPassageTemplate } from '../../../lib/grammarPassageImport';
import { grammarMixedTemplate } from '../../../lib/grammarMixedImport';
import { grammarOptionLabel } from '../../../lib/grammarPassages';
import GrammarPassageEditor from './GrammarPassageEditor';
import GrammarMixedEditor from './GrammarMixedEditor';

type GrammarVisibility = 'public' | 'assignment' | 'draft';
type CopiedBulkPrompt = 'vocabulary' | 'grammar-multiple-choice' | 'grammar-rewrite' | 'grammar-passage-drag-drop' | 'grammar-reading-comprehension' | 'grammar-mixed' | null;

export interface GrammarEditorController {
  editingGrammarSetId: string | null;
  grammarQuestionType: GrammarQuestionType;
  grammarDisplayMode: GrammarDisplayMode;
  grammarPassage: string;
  grammarInstruction: string;
  grammarWordBank: GrammarWordToken[];
  grammarBlocks: GrammarBlock[];
  updateGrammarMixedContent: (blocks: GrammarBlock[], questions: GrammarQuestion[]) => void;
  handleConvertGrammarToMixed: () => void;
  changeGrammarDisplayMode: (mode: GrammarDisplayMode) => void;
  setGrammarPassage: (value: string) => void;
  setGrammarInstruction: (value: string) => void;
  setGrammarWordBank: React.Dispatch<React.SetStateAction<GrammarWordToken[]>>;
  grammarTitle: string;
  grammarDescription: string;
  grammarGrade: string;
  grammarSubject: string;
  grammarTopic: string;
  grammarVisibility: GrammarVisibility;
  grammarTags: string;
  grammarTimeLimitMinutes: number;
  grammarMaxAttempts: number;
  grammarShuffleQuestions: boolean;
  grammarShuffleOptions: boolean;
  grammarShowExplanationImmediately: boolean;
  grammarShowReviewAfterSubmit: boolean;
  grammarBulkText: string;
  grammarQuestions: GrammarQuestion[];
  gradeOptions: string[];
  copiedBulkPrompt: CopiedBulkPrompt;
  setGrammarTitle: (value: string) => void;
  setGrammarDescription: (value: string) => void;
  setGrammarGrade: (value: string) => void;
  setGrammarSubject: (value: string) => void;
  setGrammarTopic: (value: string) => void;
  setGrammarVisibility: (value: GrammarVisibility) => void;
  setGrammarTags: (value: string) => void;
  setGrammarTimeLimitMinutes: (value: number) => void;
  setGrammarMaxAttempts: (value: number) => void;
  setGrammarShuffleQuestions: (value: boolean) => void;
  setGrammarShuffleOptions: (value: boolean) => void;
  setGrammarShowExplanationImmediately: (value: boolean) => void;
  setGrammarShowReviewAfterSubmit: (value: boolean) => void;
  setGrammarBulkText: (value: string) => void;
  setGrammarQuestions: React.Dispatch<React.SetStateAction<GrammarQuestion[]>>;
  handleSaveGrammarSet: () => void;
  handleCopyBulkImportPrompt: (kind: Exclude<CopiedBulkPrompt, null>) => Promise<void>;
  handleParseGrammarBulk: (append?: boolean) => void;
  handleAddGrammarQuestion: () => void;
  handleDuplicateGrammarQuestion: (question: GrammarQuestion) => void;
  updateGrammarQuestion: (id: string, patch: Partial<GrammarQuestion>) => void;
  updateGrammarOption: (questionId: string, optionId: string, text: string) => void;
}

export default function GrammarEditorPanel({
  controller,
}: {
  controller: GrammarEditorController;
}) {
  const {
    editingGrammarSetId,
    grammarQuestionType,
    grammarDisplayMode, grammarPassage, grammarInstruction, grammarWordBank,
    grammarBlocks, updateGrammarMixedContent, handleConvertGrammarToMixed,
    changeGrammarDisplayMode, setGrammarPassage, setGrammarInstruction, setGrammarWordBank,
    grammarTitle,
    grammarDescription,
    grammarGrade,
    grammarSubject,
    grammarTopic,
    grammarVisibility,
    grammarTags,
    grammarTimeLimitMinutes,
    grammarMaxAttempts,
    grammarShuffleQuestions,
    grammarShuffleOptions,
    grammarShowExplanationImmediately,
    grammarShowReviewAfterSubmit,
    grammarBulkText,
    grammarQuestions,
    gradeOptions,
    copiedBulkPrompt,
    setGrammarTitle,
    setGrammarDescription,
    setGrammarGrade,
    setGrammarSubject,
    setGrammarTopic,
    setGrammarVisibility,
    setGrammarTags,
    setGrammarTimeLimitMinutes,
    setGrammarMaxAttempts,
    setGrammarShuffleQuestions,
    setGrammarShuffleOptions,
    setGrammarShowExplanationImmediately,
    setGrammarShowReviewAfterSubmit,
    setGrammarBulkText,
    setGrammarQuestions,
    handleSaveGrammarSet,
    handleCopyBulkImportPrompt,
    handleParseGrammarBulk,
    handleAddGrammarQuestion,
    handleDuplicateGrammarQuestion,
    updateGrammarQuestion,
    updateGrammarOption,
  } = controller;
  const bankMode = grammarDisplayMode === 'passage_drag_drop';
  const mixedMode = grammarDisplayMode === 'mixed';
  const mixedHasBank = mixedMode && grammarBlocks.some(block => block.type === 'passage_drag_drop');
  const passageMode = grammarDisplayMode === 'passage_drag_drop' || grammarDisplayMode === 'reading_comprehension';
  const legacyPromptKind = grammarQuestionType === 'rewrite' ? 'grammar-rewrite' : 'grammar-multiple-choice';
  const promptKind = mixedMode ? 'grammar-mixed' : bankMode ? 'grammar-passage-drag-drop' : grammarDisplayMode === 'reading_comprehension' ? 'grammar-reading-comprehension' : legacyPromptKind;

  return (
          <div className="space-y-6 animate-fade-in" id="grammar-editor-tab-content">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-gray-900">
                  {editingGrammarSetId
                    ? grammarQuestionType === 'rewrite' ? 'Chỉnh sửa bài tự luận' : 'Chỉnh sửa bài ngữ pháp'
                    : grammarQuestionType === 'rewrite' ? 'Soạn bài tự luận mới' : 'Soạn bài ngữ pháp mới'}
                </h2>
                <p className="text-gray-500 text-sm">
                  {grammarQuestionType === 'rewrite'
                    ? 'Tạo bài ngữ pháp với câu trả lời dạng văn bản và chấm điểm tự động sau khi chuẩn hóa.'
                    : mixedMode ? 'Kết hợp trắc nghiệm, kéo thả và đọc hiểu trong một bài, dùng chung một đường link.' : 'Soạn nội dung bài ngữ pháp và xem trước cách hiển thị cho học sinh.'}
                </p>
              </div>
              <button type="button" id="grammar-save-btn" onClick={handleSaveGrammarSet} className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black shadow-md">
                {grammarQuestionType === 'rewrite' ? 'Lưu bài tự luận' : 'Lưu bài ngữ pháp'}
              </button>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm grid grid-cols-1 lg:grid-cols-3 gap-4">
              {grammarQuestionType !== 'rewrite' && !mixedMode && <><label className="lg:col-span-3 text-xs font-black uppercase text-gray-500 space-y-2"><span>Dạng bài</span><select id="grammar-display-mode" value={grammarDisplayMode} onChange={e => changeGrammarDisplayMode(e.target.value as GrammarDisplayMode)} className="w-full rounded-2xl border border-gray-200 p-3 text-sm text-gray-900"><option value="standard">Trắc nghiệm thường</option><option value="reading_comprehension">Đọc hiểu — bài đọc trên, câu hỏi dưới</option><option value="passage_drag_drop">Kéo thả điền từ — ngân hàng từ trên, đoạn văn dưới</option></select></label><div className="lg:col-span-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 space-y-2"><p className="text-sm text-blue-900">Thêm các dạng khác vào cùng bộ này và hiển thị toàn bài trên một trang.</p><button type="button" id="grammar-convert-mixed" onClick={handleConvertGrammarToMixed} className="rounded-xl border border-blue-300 bg-white px-4 py-2 text-sm font-bold text-blue-900">Thêm dạng bài vào bộ này</button></div></>}
              <label className="lg:col-span-2 text-xs font-black uppercase text-gray-500 space-y-2">
                <span>Tên bài ngữ pháp</span>
                <input value={grammarTitle} onChange={e => setGrammarTitle(e.target.value)} className="w-full p-3 rounded-2xl border border-gray-200 text-sm font-bold text-gray-900" placeholder="Ví dụ: Present Simple - Unit 1" />
              </label>
              <label className="text-xs font-black uppercase text-gray-500 space-y-2">
                <span>Lớp</span>
                <select value={grammarGrade} onChange={e => setGrammarGrade(e.target.value)} className="w-full p-3 rounded-2xl border border-gray-200 text-sm font-bold text-gray-900">
                  {gradeOptions.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label className="text-xs font-black uppercase text-gray-500 space-y-2">
                <span>Môn/chủ đề</span>
                <input value={grammarSubject} onChange={e => setGrammarSubject(e.target.value)} className="w-full p-3 rounded-2xl border border-gray-200 text-sm font-bold text-gray-900" />
              </label>
              <label className="text-xs font-black uppercase text-gray-500 space-y-2">
                <span>Topic</span>
                <input value={grammarTopic} onChange={e => setGrammarTopic(e.target.value)} className="w-full p-3 rounded-2xl border border-gray-200 text-sm font-bold text-gray-900" />
              </label>
              <label className="text-xs font-black uppercase text-gray-500 space-y-2">
                <span>Trạng thái</span>
                <select value={grammarVisibility} onChange={e => setGrammarVisibility(e.target.value as any)} className="w-full p-3 rounded-2xl border border-gray-200 text-sm font-bold text-gray-900">
                  <option value="public">Công khai</option>
                  <option value="assignment">Riêng tư</option>
                  <option value="draft">Ẩn</option>
                </select>
              </label>
              <label className="lg:col-span-2 text-xs font-black uppercase text-gray-500 space-y-2">
                <span>Mô tả chi tiết</span>
                <textarea value={grammarDescription} onChange={e => setGrammarDescription(e.target.value)} className="w-full min-h-24 p-3 rounded-2xl border border-gray-200 text-sm font-bold text-gray-900" />
              </label>
              <label className="text-xs font-black uppercase text-gray-500 space-y-2">
                <span>Tags</span>
                <input value={grammarTags} onChange={e => setGrammarTags(e.target.value)} className="w-full p-3 rounded-2xl border border-gray-200 text-sm font-bold text-gray-900" />
              </label>
              <label className="text-xs font-black uppercase text-gray-500 space-y-2">
                <span>Thời gian làm bài (phút)</span>
                <input type="number" min={0} value={grammarTimeLimitMinutes} onChange={e => setGrammarTimeLimitMinutes(Number(e.target.value))} className="w-full p-3 rounded-2xl border border-gray-200 text-sm font-bold text-gray-900" />
              </label>
              <label className="text-xs font-black uppercase text-gray-500 space-y-2">
                <span>Số lần được làm</span>
                <input type="number" min={1} value={grammarMaxAttempts} onChange={e => setGrammarMaxAttempts(Number(e.target.value))} className="w-full p-3 rounded-2xl border border-gray-200 text-sm font-bold text-gray-900" />
              </label>
              <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-4 gap-3">
                {[
                  ...(!passageMode && !mixedMode ? [['Trộn câu hỏi', grammarShuffleQuestions, setGrammarShuffleQuestions]] : []),
                  ...(grammarQuestionType !== 'rewrite'
                    ? [[mixedMode ? 'Trộn đáp án / ngân hàng từ' : bankMode ? 'Trộn ngân hàng từ' : 'Trộn đáp án', grammarShuffleOptions, setGrammarShuffleOptions]]
                    : []),
                  ...(!bankMode && !mixedHasBank ? [['Giải thích sau từng câu', grammarShowExplanationImmediately, setGrammarShowExplanationImmediately]] : []),
                  ['Xem giải thích sau khi nộp', grammarShowReviewAfterSubmit, setGrammarShowReviewAfterSubmit]
                ].map(([label, checked, setter]: any) => (
                  <label key={label} className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 p-3 text-xs font-black text-gray-700">
                    <input type="checkbox" checked={checked} onChange={e => setter(e.target.checked)} />
                    {label}
                  </label>
                ))}
              </div>
              {mixedHasBank && <p className="lg:col-span-3 text-sm text-blue-900">Bài có kéo thả: đáp án được lưu trong lúc làm; kết quả và giải thích hiển thị sau khi nộp theo cài đặt của bài.</p>}
            </div>

            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="font-black text-gray-900">Nhập nhanh nhiều câu hỏi</h3>
                  <p id="grammar-bulk-help" className="text-xs text-gray-500">
                    {mixedMode ? 'Dán JSON nhiều nhóm theo thứ tự hiển thị; cũng nhận JSON đoạn văn và mẫu QUESTION trắc nghiệm cũ. Có thể nhập cả bài hoặc thêm các nhóm vào cuối bài. Dữ liệu lỗi không thay đổi nội dung đang soạn.' : passageMode ? 'Dán đầy đủ JSON từ hướng dẫn bên cạnh. Số câu hỏi, lựa chọn và từ nhiễu theo dữ liệu nhập. Dữ liệu lỗi không thay đổi nội dung đang soạn.' : grammarQuestionType === 'rewrite'
                      ? 'Mỗi câu bắt đầu bằng QUESTION:, gồm ANSWER, EXPLANATION; ACCEPTED là tùy chọn, mỗi đáp án thay thế trên một dòng. Không bắt buộc dòng trống giữa các câu.'
                      : 'Mỗi câu bắt đầu bằng QUESTION:, gồm A, B, ANSWER, EXPLANATION; C và D là tùy chọn. Mỗi câu có từ 2 đến 4 đáp án. Không bắt buộc dòng trống giữa các câu.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleCopyBulkImportPrompt(promptKind)}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-700 transition hover:bg-indigo-100"
                  aria-live="polite"
                >
                  {copiedBulkPrompt === promptKind
                    ? <Check size={15} aria-hidden="true" />
                    : <Copy size={15} aria-hidden="true" />}
                  {copiedBulkPrompt === promptKind
                    ? 'Đã sao chép'
                    : mixedMode ? 'Sao chép prompt nhiều dạng cho ChatGPT' : bankMode ? 'Sao chép hướng dẫn kéo thả cho ChatGPT' : grammarDisplayMode === 'reading_comprehension' ? 'Sao chép hướng dẫn đọc hiểu cho ChatGPT' : grammarQuestionType === 'rewrite' ? 'Sao chép prompt tự luận' : 'Sao chép prompt trắc nghiệm'}
                </button>
              </div>
              <textarea
                id="grammar-bulk-input"
                aria-label="Nội dung nhập nhanh câu hỏi ngữ pháp"
                aria-describedby="grammar-bulk-help"
                value={grammarBulkText}
                onChange={e => setGrammarBulkText(e.target.value)}
                className="w-full min-h-64 p-4 rounded-2xl border border-gray-200 bg-gray-50 text-sm font-mono text-gray-800"
                placeholder={mixedMode ? grammarMixedTemplate() : passageMode ? grammarPassageTemplate(grammarDisplayMode) : grammarQuestionType === 'rewrite'
                  ? `QUESTION: Viết dạng đầy đủ của: It's Monday.\nANSWER: It is Monday.\nACCEPTED: It's Monday.\nEXPLANATION: It's là dạng viết tắt của It is.\n\nQUESTION: Hoàn thành câu: She _____ a teacher.\nANSWER: is\nEXPLANATION: Chủ ngữ She đi với động từ to be là is.`
                  : `QUESTION: She is a teacher, _____?\nA: is she\nB: isn't she\nANSWER: B\nEXPLANATION: Câu khẳng định dùng đuôi phủ định.\n\nQUESTION: They _____ football every Sunday.\nA: plays\nB: play\nC: playing\nANSWER: B\nEXPLANATION: Chủ ngữ They dùng động từ nguyên mẫu play.`}
              />
              <div className="flex flex-wrap gap-3"><button type="button" id="grammar-import-replace" onClick={() => handleParseGrammarBulk()} className="flex-1 py-3 px-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black">
                {mixedMode ? 'Nhập toàn bộ bài' : 'Ghép dữ liệu vào bảng câu hỏi'}
              </button>{mixedMode && <button type="button" id="grammar-import-append" onClick={() => handleParseGrammarBulk(true)} className="flex-1 rounded-2xl border border-blue-300 bg-blue-50 px-4 py-3 font-black text-blue-900">Thêm các nhóm vào cuối bài</button>}</div>
            </div>

            {passageMode && <GrammarPassageEditor mode={grammarDisplayMode} passage={grammarPassage} instruction={grammarInstruction} bank={grammarWordBank} questions={grammarQuestions} onPassage={setGrammarPassage} onInstruction={setGrammarInstruction} onBank={setGrammarWordBank} />}
            {mixedMode && <GrammarMixedEditor blocks={grammarBlocks} questions={grammarQuestions} onChange={updateGrammarMixedContent} />}

            {!mixedMode && <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-gray-900">Bảng câu hỏi ({grammarQuestions.length})</h3>
                <button onClick={handleAddGrammarQuestion} className="px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs font-black">Thêm câu</button>
              </div>
              <div className="space-y-4">
                {grammarQuestions.map((question, qIndex) => (
                  <div key={question.id} className="rounded-2xl border border-gray-200 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black text-gray-500">Câu {qIndex + 1}</span>
                      <div className="flex gap-2">
                        <button onClick={() => handleDuplicateGrammarQuestion(question)} className="px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 text-xs font-black">Nhân bản</button>
                        <button onClick={() => { if (bankMode) setGrammarPassage(grammarPassage.replace(`[[${question.blankNumber}]]`, '')); setGrammarQuestions(prev => prev.filter(item => item.id !== question.id).map((item, index) => ({ ...item, position: index + 1 }))); }} className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 text-xs font-black">Xóa</button>
                      </div>
                    </div>
                    {bankMode ? <div className="flex flex-wrap gap-3"><label className="text-sm font-bold text-gray-800">Số ô trống<input type="number" min={1} value={question.blankNumber || ''} onChange={e => { const number = Number(e.target.value); if (!Number.isSafeInteger(number) || number < 1) return; setGrammarPassage(grammarPassage.replace(`[[${question.blankNumber}]]`, `[[${number}]]`)); updateGrammarQuestion(question.id, { blankNumber: number, questionText: `Ô trống ${number}` }); }} className="ml-2 w-20 rounded-xl border border-gray-300 p-2" /></label><label className="text-sm font-bold text-gray-800">Đáp án đúng<select aria-label={`Đáp án ô ${question.blankNumber}`} value={question.correctOptionId} onChange={e => updateGrammarQuestion(question.id, { correctOptionId: e.target.value })} className="ml-2 rounded-xl border border-gray-300 p-2"><option value="">Chọn thẻ từ</option>{grammarWordBank.map((token, i) => <option key={token.id} value={token.id}>{token.text || '(thẻ trống)'} · thẻ {i + 1}</option>)}</select></label></div> : <textarea value={question.questionText} onChange={e => updateGrammarQuestion(question.id, { questionText: e.target.value })} className="w-full p-3 rounded-xl border border-gray-200 text-sm font-bold text-gray-900" placeholder="Câu hỏi" />}
                    {bankMode ? null : grammarQuestionType === 'rewrite' ? (
                      <div className="space-y-2">
                        <textarea
                          value={question.correctAnswer || ''}
                          onChange={e => updateGrammarQuestion(question.id, { correctAnswer: e.target.value })}
                          className="w-full p-3 rounded-xl border border-emerald-200 bg-emerald-50 text-sm font-bold text-gray-900"
                          placeholder="Đáp án đúng"
                        />
                        <textarea
                          value={(question.acceptedAnswers || []).join('\n')}
                          onChange={e => updateGrammarQuestion(question.id, { acceptedAnswers: e.target.value.split(/\r?\n/) })}
                          className="w-full p-3 rounded-xl border border-blue-200 bg-blue-50 text-sm font-bold text-gray-900"
                          placeholder="Các đáp án chấp nhận khác - mỗi dòng một đáp án (tùy chọn)"
                        />
                        <p className="text-xs text-gray-500">
                          Chỉ thêm các cách trả lời thực sự tương đương, ví dụ: it is cho đáp án chính it&apos;s.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {question.options.map((option, index) => (
                          <div key={option.id} className="flex gap-2">
                            <select value={question.correctOptionId === option.id ? option.id : ''} onChange={() => updateGrammarQuestion(question.id, { correctOptionId: option.id })} className="w-12 rounded-xl border border-gray-200 text-xs font-black text-gray-700">
                              <option value="">{grammarOptionLabel(index)}</option>
                              <option value={option.id}>Đúng</option>
                            </select>
                            <input value={option.text} onChange={e => updateGrammarOption(question.id, option.id, e.target.value)} className="flex-1 p-3 rounded-xl border border-gray-200 text-sm font-bold text-gray-900" placeholder={`Đáp án ${index + 1}`} />
                            {passageMode && <button type="button" aria-label={`Xóa lựa chọn ${grammarOptionLabel(index)} câu ${qIndex + 1}`} onClick={() => updateGrammarQuestion(question.id, { options: question.options.filter(item => item.id !== option.id), ...(question.correctOptionId === option.id ? { correctOptionId: '' } : {}) })} className="rounded-xl border border-rose-200 px-3 text-rose-800">×</button>}
                          </div>
                        ))}
                        {passageMode && <button type="button" onClick={() => updateGrammarQuestion(question.id, { options: [...question.options, { id: `${question.id}-option-${crypto.randomUUID()}`, text: '', originalPosition: question.options.length + 1 }] })} className="rounded-xl border border-blue-200 px-3 py-2 text-sm font-bold text-blue-800">Thêm lựa chọn</button>}
                      </div>
                    )}
                    <textarea value={question.explanation} onChange={e => updateGrammarQuestion(question.id, { explanation: e.target.value })} className="w-full p-3 rounded-xl border border-gray-200 text-sm text-gray-800" placeholder="Lời giải thích bắt buộc" />
                    {grammarQuestionType === 'multiple_choice' && (
                      <label className="flex items-center gap-2 text-xs font-black text-gray-500">
                        Điểm
                        <input type="number" min={1} value={question.score} onChange={e => updateGrammarQuestion(question.id, { score: Number(e.target.value) })} className="w-24 p-2 rounded-xl border border-gray-200 text-sm font-bold text-gray-900" />
                      </label>
                    )}
                  </div>
                ))}
              </div>
            </div>}
          </div>
  );
}

