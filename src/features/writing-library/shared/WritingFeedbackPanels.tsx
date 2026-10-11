import { Fragment } from 'react';
import type { ExamQuestionResult, WritingCorrection } from '../../exam-platform/types';
import './writing-feedback.css';

type Props = Pick<ExamQuestionResult, 'grammarCorrections' | 'vocabularyCorrections' | 'grammarErrors' | 'vocabularyErrors' | 'revisedEssay'>;

function CorrectionTable({ title, corrections, legacyNotes }: { title: string; corrections?: WritingCorrection[]; legacyNotes?: string[] }) {
  const structured = Array.isArray(corrections);
  const notes = Array.isArray(legacyNotes) ? legacyNotes : [];
  return (
    <section className="writing-feedback-category" aria-label={title}>
      <h3>{title}</h3>
      <table className="writing-correction-table">
        <caption className="sr-only">{title}: đối chiếu bài học sinh và cách sửa</caption>
        <colgroup><col style={{ width: '50%' }} /><col style={{ width: '50%' }} /></colgroup>
        <thead><tr><th scope="col">Em đã viết</th><th scope="col">Sửa thành</th></tr></thead>
        <tbody>
          {structured && corrections.length > 0 ? corrections.map((item, index) => (
            <Fragment key={index}>
              <tr data-writing-correction-row><td>{item.original}</td><td>{item.corrected}</td></tr>
              <tr className="writing-correction-explanation"><td colSpan={2}>{item.explanation}</td></tr>
            </Fragment>
          )) : !structured && notes.length > 0 ? notes.map((note, index) => (
            <tr key={index} className="writing-correction-legacy"><td colSpan={2}>{note}</td></tr>
          )) : <tr><td colSpan={2} className="writing-correction-empty">Không phát hiện lỗi nổi bật.</td></tr>}
        </tbody>
      </table>
    </section>
  );
}

export default function WritingFeedbackPanels({ grammarCorrections, vocabularyCorrections, grammarErrors, vocabularyErrors, revisedEssay }: Props) {
  const legacy = grammarCorrections === undefined && vocabularyCorrections === undefined;
  return (
    <div className="writing-feedback" data-writing-feedback>
      <section className="writing-feedback-frame" aria-label="Các lỗi cần sửa">
        <h2>Các lỗi cần sửa</h2>
        {legacy && <p className="writing-feedback-note">Kết quả cũ lưu nhận xét dạng văn bản; chưa có cặp câu đối chiếu.</p>}
        <CorrectionTable title="Ngữ pháp" corrections={grammarCorrections} legacyNotes={grammarErrors} />
        <CorrectionTable title="Từ vựng" corrections={vocabularyCorrections} legacyNotes={vocabularyErrors} />
      </section>
      <section className="writing-feedback-frame writing-revised-essay" aria-label="Bài sửa hoàn chỉnh">
        <h2>Bài sửa hoàn chỉnh</h2>
        {revisedEssay?.trim() ? <p className="writing-revised-text" data-writing-revised-essay>{revisedEssay}</p> : <p className="writing-feedback-note">{revisedEssay === '' ? 'Bài để trống nên chưa có nội dung để sửa.' : 'Kết quả này chưa lưu bài sửa hoàn chỉnh.'}</p>}
      </section>
    </div>
  );
}
