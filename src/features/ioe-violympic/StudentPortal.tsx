import React, { useState } from 'react';
import { BookOpen, CheckCircle2, ChevronRight, ClipboardList, History, Target, Trophy } from 'lucide-react';
import { SUBJECT_LABELS, SUBJECTS, LEVEL_LABELS, type BankTopic, type PublicPaper, type PracticeReport } from '../../shared/competition/types';
import BankDirectory from './BankDirectory';

export default function StudentPortal({ topics, papers, loading, failed, practice, practiceLoading, practiceError, studentName, onRefresh, onNavigate }: {
  topics: BankTopic[]; papers: PublicPaper[]; loading: boolean; failed: boolean;
  practice: PracticeReport | null; practiceLoading: boolean; practiceError: string; studentName: string;
  onRefresh: () => void; onNavigate: (path: string) => void;
}) {
  const [tab, setTab] = useState<'home' | 'mock' | 'practice'>('home');
  const [subject, setSubject] = useState(''), [grade, setGrade] = useState(''), [level, setLevel] = useState('');
  const ready = topics.filter(topic => topic.ready).length;
  const pending = practice?.pendingCount;
  const visible = practice?.topics.filter(row => (!subject || row.subject === subject) && (!grade || row.grade === Number(grade)) && (!level || row.level === level)) || [];
  return <div className="competition-portal" data-student-portal>
    <nav className="competition-tabs" aria-label="Khu học IOE/Violympic">
      {([['home', 'Tổng quan'], ['mock', 'Thi thử'], ['practice', 'Luyện tập']] as const).map(([id, title]) =>
        <button type="button" key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>{title}</button>)}
      <button type="button" onClick={() => onNavigate('/history')}>Lịch sử của em</button>
    </nav>
    {tab === 'home' && <>
      <section className="competition-portal-hero">
        <div><span className="competition-eyebrow">GÓC HỌC TẬP CỦA EM</span>
          <h2>{studentName ? `Chào ${studentName}!` : 'Sẵn sàng thử sức hôm nay?'}</h2>
          <p>Thi thử theo môn, lớp và cấp. Luyện lại những câu em đã trả lời sai để tiến bộ mỗi ngày.</p>
          <button type="button" className="competition-primary" onClick={() => setTab('mock')}>Bắt đầu thi thử <ChevronRight size={18} /></button>
        </div><Trophy className="competition-hero-icon" size={100} aria-hidden="true" />
      </section>
      <div className="competition-portal-stats">
        <div><strong>{practiceLoading ? '…' : practice?.completedCount ?? '—'}</strong><span>Bài đã hoàn thành</span></div>
        <div><strong>{practiceLoading ? '…' : pending ?? '—'}</strong><span>Câu cần luyện lại</span></div>
        <div><strong>{loading || failed ? '—' : ready}</strong><span>Nhóm bank sẵn sàng</span></div>
      </div>
      <h2>Hôm nay em muốn học gì?</h2>
      <div className="competition-activity-grid">
        <article className="competition-activity"><ClipboardList size={32} aria-hidden="true" /><h3>Thi thử như thật</h3>
          <p>Đề mới được lấy ngẫu nhiên từ ngân hàng chung. Thử sức trong 30 phút và xem lời giải sau khi nộp.</p>
          <button type="button" onClick={() => setTab('mock')}>Chọn bài thi <ChevronRight size={16} /></button></article>
        <article className="competition-activity"><Target size={32} aria-hidden="true" /><h3>Luyện lại câu sai</h3>
          <p>Những câu em trả lời sai được giữ ở đây. Mỗi lượt luyện tối đa 10 câu; làm đúng để gỡ khỏi danh sách.</p>
          <button type="button" onClick={() => setTab('practice')}>Mở luyện tập <ChevronRight size={16} /></button></article>
        <article className="competition-activity"><History size={32} aria-hidden="true" /><h3>Xem tiến bộ</h3>
          <p>Xem điểm, câu trả lời và lời giải trong lịch sử học tập của em.</p>
          <button type="button" onClick={() => onNavigate('/history')}>Xem lịch sử <ChevronRight size={16} /></button></article>
      </div>
    </>}
    {tab === 'mock' && <BankDirectory {...{ topics, papers, loading, failed, onRefresh, onNavigate }} />}
    {tab === 'practice' && <section data-mistake-directory aria-labelledby="competition-practice-heading">
      <div className="competition-toolbar"><h2 id="competition-practice-heading">Luyện lại câu sai</h2><button type="button" disabled={loading || practiceLoading} onClick={onRefresh}>Cập nhật câu sai</button></div>
      <p>Câu trả lời sai trong bài đã nộp được lưu theo hồ sơ của em. Câu bỏ trống không tính là câu sai. Lượt luyện mới lấy tối đa 10 câu trong cùng môn, lớp và cấp, với 30 phút làm bài.</p>
      {practiceLoading && <p role="status">Đang tải câu cần luyện...</p>}
      {practiceError && <p role="alert" className="competition-error">{practiceError}</p>}
      {!practiceLoading && !practiceError && !practice && <div className="competition-card"><BookOpen size={32} aria-hidden="true" /><p>Hãy làm một bài thi thử bằng tài khoản hoặc hồ sơ học sinh của em. Những câu trả lời sai sẽ tự xuất hiện ở đây.</p><button type="button" onClick={() => setTab('mock')}>Chọn bài thi thử</button></div>}
      {!practiceLoading && !practiceError && practice && <>
        <div className="competition-toolbar">
          <label>Môn<select value={subject} onChange={e => setSubject(e.target.value)}><option value="">Tất cả môn</option>{SUBJECTS.map(s => <option key={s} value={s}>{SUBJECT_LABELS[s]}</option>)}</select></label>
          <label>Lớp<select value={grade} onChange={e => setGrade(e.target.value)}><option value="">Tất cả lớp</option>{Array.from({ length: 9 }, (_, i) => i + 1).map(g => <option key={g} value={g}>Lớp {g}</option>)}</select></label>
          <label>Cấp<select value={level} onChange={e => setLevel(e.target.value)}><option value="">Tất cả cấp</option>{Object.entries(LEVEL_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        </div>
        <p data-pending-count><strong>{practice.pendingCount}</strong> câu cần luyện lại</p>
        <div className="competition-grid">{visible.map(row => <article className="competition-card" key={row.id} data-mistake-topic={row.id}>
          <h3>{SUBJECT_LABELS[row.subject]} · Lớp {row.grade}</h3><p>{LEVEL_LABELS[row.level]} · {row.available} câu cần luyện</p>
          <ul className="competition-mistake-previews">{row.previews.map(q => <li key={q.id}>{q.prompt}</li>)}</ul>
          {row.available > row.previews.length && <p>Và {row.available - row.previews.length} câu khác.</p>}
          <button type="button" className="competition-primary" onClick={() => onNavigate(`/ioe-violympic/paper/${row.id}`)}>Luyện {row.total} câu</button>
        </article>)}</div>
        {!visible.length && <div className="competition-card"><CheckCircle2 size={32} aria-hidden="true" /><p>{practice.pendingCount === 0 ? 'Em chưa có câu sai cần luyện lại. Tiếp tục thử sức với một bài thi mới nhé!' : 'Không có câu sai phù hợp bộ lọc này.'}</p><button type="button" onClick={() => setTab('mock')}>Mở thi thử</button></div>}
      </>}
    </section>}
  </div>;
}
