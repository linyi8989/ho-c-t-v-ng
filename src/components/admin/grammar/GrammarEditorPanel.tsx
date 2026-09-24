import type React from 'react';
import { Check, Copy } from 'lucide-react';
import type { GrammarQuestion, GrammarQuestionType } from '../../../types';

type GrammarVisibility = 'public' | 'assignment' | 'draft';
type CopiedBulkPrompt = 'vocabulary' | 'grammar-multiple-choice' | 'grammar-rewrite' | null;

export interface GrammarEditorController {
  editingGrammarSetId: string | null;
  grammarQuestionType: GrammarQuestionType;
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
  handleParseGrammarBulk: () => void;
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
                    : 'Tạo bài trắc nghiệm ngữ pháp với đáp án đúng theo optionId ổn định.'}
                </p>
              </div>
              <button onClick={handleSaveGrammarSet} className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black shadow-md">
                {grammarQuestionType === 'rewrite' ? 'Lưu bài tự luận' : 'Lưu bài ngữ pháp'}
              </button>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm grid grid-cols-1 lg:grid-cols-3 gap-4">
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
                  ['Trộn câu hỏi', grammarShuffleQuestions, setGrammarShuffleQuestions],
                  ...(grammarQuestionType === 'multiple_choice'
                    ? [['Trộn đáp án', grammarShuffleOptions, setGrammarShuffleOptions]]
                    : []),
                  ['Giải thích sau từng câu', grammarShowExplanationImmediately, setGrammarShowExplanationImmediately],
                  ['Xem giải thích sau khi nộp', grammarShowReviewAfterSubmit, setGrammarShowReviewAfterSubmit]
                ].map(([label, checked, setter]: any) => (
                  <label key={label} className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 p-3 text-xs font-black text-gray-700">
                    <input type="checkbox" checked={checked} onChange={e => setter(e.target.checked)} />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="font-black text-gray-900">Nhập nhanh nhiều câu hỏi</h3>
                  <p className="text-xs text-gray-500">
                    {grammarQuestionType === 'rewrite'
                      ? 'Mỗi câu gồm QUESTION, ANSWER, EXPLANATION; ACCEPTED là tùy chọn và mỗi đáp án thay thế nằm trên một dòng.'
                      : 'Mỗi câu gồm QUESTION, A, B, ANSWER, EXPLANATION; C và D là tùy chọn. Mỗi câu có từ 2 đến 4 đáp án và cách nhau bằng dòng trống.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleCopyBulkImportPrompt(grammarQuestionType === 'rewrite' ? 'grammar-rewrite' : 'grammar-multiple-choice')}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-700 transition hover:bg-indigo-100"
                  aria-live="polite"
                >
                  {copiedBulkPrompt === (grammarQuestionType === 'rewrite' ? 'grammar-rewrite' : 'grammar-multiple-choice')
                    ? <Check size={15} aria-hidden="true" />
                    : <Copy size={15} aria-hidden="true" />}
                  {copiedBulkPrompt === (grammarQuestionType === 'rewrite' ? 'grammar-rewrite' : 'grammar-multiple-choice')
                    ? 'Đã sao chép'
                    : grammarQuestionType === 'rewrite' ? 'Sao chép prompt tự luận' : 'Sao chép prompt trắc nghiệm'}
                </button>
              </div>
              <textarea
                value={grammarBulkText}
                onChange={e => setGrammarBulkText(e.target.value)}
                className="w-full min-h-64 p-4 rounded-2xl border border-gray-200 bg-gray-50 text-sm font-mono text-gray-800"
                placeholder={grammarQuestionType === 'rewrite'
                  ? `QUESTION: Viết dạng đầy đủ của: It's Monday.\nANSWER: It is Monday.\nACCEPTED: It's Monday.\nEXPLANATION: It's là dạng viết tắt của It is.\n\nQUESTION: Hoàn thành câu: She _____ a teacher.\nANSWER: is\nEXPLANATION: Chủ ngữ She đi với động từ to be là is.`
                  : `QUESTION: She is a teacher, _____?\nA: is she\nB: isn't she\nANSWER: B\nEXPLANATION: Câu khẳng định dùng đuôi phủ định.\n\nQUESTION: They _____ football every Sunday.\nA: plays\nB: play\nC: playing\nANSWER: B\nEXPLANATION: Chủ ngữ They dùng động từ nguyên mẫu play.`}
              />
              <button onClick={handleParseGrammarBulk} className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black">
                Ghép dữ liệu vào bảng câu hỏi
              </button>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
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
                        <button onClick={() => setGrammarQuestions(prev => prev.filter(item => item.id !== question.id).map((item, index) => ({ ...item, position: index + 1 })))} className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 text-xs font-black">Xóa</button>
                      </div>
                    </div>
                    <textarea value={question.questionText} onChange={e => updateGrammarQuestion(question.id, { questionText: e.target.value })} className="w-full p-3 rounded-xl border border-gray-200 text-sm font-bold text-gray-900" placeholder="Câu hỏi" />
                    {grammarQuestionType === 'rewrite' ? (
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
                              <option value="">{String.fromCharCode(65 + index)}</option>
                              <option value={option.id}>Đúng</option>
                            </select>
                            <input value={option.text} onChange={e => updateGrammarOption(question.id, option.id, e.target.value)} className="flex-1 p-3 rounded-xl border border-gray-200 text-sm font-bold text-gray-900" placeholder={`Đáp án ${index + 1}`} />
                          </div>
                        ))}
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
            </div>
          </div>
  );
}

