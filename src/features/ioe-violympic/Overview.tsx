import React, { useEffect, useState } from 'react';
import { INVENTORY_LEVELS, LEVEL_LABELS, SUBJECT_LABELS, SUBJECTS, type OverviewReport } from '../../shared/competition/types';
import { adminRequest } from './api';

const compactLevelLabels: Record<string, string> = { school: 'Trường', district: 'Phường', province: 'Tỉnh', national: 'Quốc gia' };

export default function CompetitionOverview({ token }: { token: string }) {
  const [report, setReport] = useState<OverviewReport | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState(''), [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError('');
    void adminRequest<OverviewReport>(token, '/admin/overview', 'GET', undefined, controller.signal)
      .then(data => { if (!controller.signal.aborted) setReport(data); })
      .catch(e => { if (!controller.signal.aborted) { setReport(null); setError(e.message); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, revision]);
  const count = (value?: number) => loading || !report || !value ? '—' : value.toLocaleString('vi-VN');
  return <div data-competition-overview>
    <div className="competition-toolbar"><h2>Tổng quan IOE/Violympic</h2><button type="button" disabled={loading} onClick={() => setRevision(n => n + 1)}>Cập nhật tổng quan</button></div>
    {error && <p role="alert" className="competition-error">{error}</p>}
    {loading && <p role="status">Đang tải tổng quan...</p>}
    <div className="competition-stats" aria-label="Thống kê chung">
      {([['questions', 'Tổng số câu hỏi'], ['players', 'Người chơi'], ['attempts', 'Lượt làm bài'], ['completed', 'Lượt hoàn thành']] as const).map(([key, label]) => <article className="competition-card" key={key}><p>{label}</p><strong data-overview-stat={key}>{count(report?.totals[key])}</strong></article>)}
    </div>
    <div className="competition-inventory-grid">
      {SUBJECTS.map(subject => <article className="competition-card" key={subject} data-inventory-subject={subject}>
        <h3>{SUBJECT_LABELS[subject]}</h3>
        <p className="competition-inventory-summary">{count(report?.subjects[subject].questions)} câu hỏi · {count(report?.subjects[subject].players)} người chơi · {count(report?.subjects[subject].completed)} hoàn thành</p>
        <div className="competition-table-wrap"><table className="competition-inventory-table" aria-label={`Số câu hỏi theo lớp và cấp · ${SUBJECT_LABELS[subject]}`}>
          <thead><tr><th scope="col">Lớp</th>{INVENTORY_LEVELS.map(level => <th scope="col" key={level} aria-label={LEVEL_LABELS[level]} title={LEVEL_LABELS[level]}>{compactLevelLabels[level]}</th>)}</tr></thead>
          <tbody>{Array.from({ length: 9 }, (_, i) => i + 1).map(grade => <tr key={grade}><th scope="row">Lớp {grade}</th>{INVENTORY_LEVELS.map(level => {
            const cell = report?.inventory.find(row => row.subject === subject && row.grade === grade && row.level === level);
            return <td key={level} data-inventory-cell={`${subject}:${grade}:${level}`} aria-label={loading || !report ? 'Chưa có số liệu' : `${cell?.count || 0} câu hỏi`}>{count(cell?.count)}</td>;
          })}</tr>)}</tbody>
        </table></div>
        {subject === 'english' && <p className="competition-inventory-summary">Luyện tập: {count(report?.inventory.filter(row => row.subject === subject && row.level === 'practice').reduce((sum, row) => sum + row.count, 0))} câu (đã tính trong tổng).</p>}
      </article>)}
    </div>
    <p>Số câu đang có trong ngân hàng; dấu — nghĩa là chưa có dữ liệu. Người chơi được tính một lần theo danh tính học sinh; lượt làm bài tính từ khi bắt đầu.</p>
    {report && !loading && report.totals.questions === 0 && <p className="competition-notice">Ngân hàng đang trống. Mở Soạn JSON để thêm câu hỏi.</p>}
  </div>;
}
