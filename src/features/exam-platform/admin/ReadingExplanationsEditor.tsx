import { useId } from 'react';
import { isReadingExplanationQuestion, READING_EXPLANATION_MAX_LENGTH } from '../readingExplanations';
import type { ExamPaperContent, ExamPartContent } from '../types';
import '../reading-explanations.css';

export default function ReadingExplanationsEditor({ content, part, onChange }: {
  content: ExamPaperContent;
  part: ExamPartContent;
  onChange: (part: ExamPartContent) => void;
}) {
  const labelPrefix = useId();
  const questions = part.questions.filter(question => isReadingExplanationQuestion(content, question));
  if (!questions.length) return null;
  return <section data-reading-explanations-editor aria-labelledby={`${labelPrefix}-title`}>
    <h4 id={`${labelPrefix}-title`}>Giải thích đáp án</h4>
    <p className="reading-explanations-hint">Kiểm tra và chỉnh lời giải từ JSON cho từng câu. Nội dung chỉ xuất hiện khi học sinh được phép xem đáp án sau khi nộp.</p>
    <div className="reading-explanations-fields">{questions.map(question => {
      const invalid = question.explanation !== undefined && typeof question.explanation !== 'string';
      const value = typeof question.explanation === 'string' ? question.explanation : '';
      const fieldId = `${labelPrefix}-${question.id}`;
      return <div key={question.id} className="reading-explanations-field">
        <label htmlFor={fieldId}>Câu {question.displayNumber || question.number}</label>
        {question.prompt && <p className="reading-explanations-prompt">{question.prompt}</p>}
        {invalid && <p role="alert" className="reading-explanations-error">Giải thích đã lưu không phải văn bản. Nhập lại lời giải cho câu này trước khi xuất bản.</p>}
        <textarea id={fieldId} aria-label={`Giải thích đáp án câu ${question.displayNumber || question.number}`} value={value} maxLength={READING_EXPLANATION_MAX_LENGTH} rows={3} placeholder="Giải thích vì sao đáp án phù hợp với bài đọc, từ vựng hoặc cấu trúc ngữ pháp…" onChange={event => onChange({ ...part, questions: part.questions.map(item => item.id === question.id ? { ...item, explanation: event.target.value } : item) })} />
        <p className="reading-explanations-count">{value.length.toLocaleString('vi-VN')} / {READING_EXPLANATION_MAX_LENGTH.toLocaleString('vi-VN')} ký tự</p>
      </div>;
    })}</div>
  </section>;
}
