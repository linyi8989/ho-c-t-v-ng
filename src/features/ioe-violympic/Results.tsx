import React, { useEffect, useRef, useState } from 'react';
import { LEVEL_LABELS, SUBJECT_LABELS, type ResultFilters, type ResultsPage, type Result, type ReviewRow, type Subject, type CompetitionLevel } from '../../shared/competition/types';
import { adminRequest } from './api';
import CompetitionReview from './Review';

const EMPTY_FILTERS = { subject: '', grade: '', level: '' };
export default function CompetitionResults({ token }: { token: string }) {
  const [filters, setFilters] = useState(EMPTY_FILTERS), [applied, setApplied] = useState<ResultFilters>({}), [page, setPage] = useState(1);
  const [data, setData] = useState<ResultsPage | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState(''), [revision, setRevision] = useState(0);
  const [review, setReview] = useState<{ result: Result; rows: ReviewRow[] } | null>(null), [reviewLoading, setReviewLoading] = useState(false);
  const reviewRequest = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(''); setReview(null);
    const query = new URLSearchParams({ page: String(page) });
    if (applied.subject) query.set('subject', applied.subject);
    if (applied.grade !== undefined) query.set('grade', String(applied.grade));
    if (applied.level) query.set('level', applied.level);
    void adminRequest<ResultsPage>(token, `/admin/results-page?${query}`, 'GET', undefined, controller.signal)
      .then(result => { if (!controller.signal.aborted) setData(result); })
      .catch(e => { if (!controller.signal.aborted) { setData(null); setError(e.message); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [token, page, applied, revision]);
  useEffect(() => { setReview(null); setReviewLoading(false); return () => reviewRequest.current?.abort(); }, [token]);
  const busy = loading || reviewLoading;
  const applyFilters = () => {
    setApplied({ ...(filters.subject ? { subject: filters.subject as Subject } : {}), ...(filters.grade ? { grade: Number(filters.grade) } : {}), ...(filters.level ? { level: filters.level as CompetitionLevel } : {}) }); setPage(1);
  };
  const showAll = () => { setFilters(EMPTY_FILTERS); setApplied({}); setPage(1); };
  const showReview = async (id: string) => {
    reviewRequest.current?.abort(); const controller = new AbortController(); reviewRequest.current = controller;
    setReviewLoading(true); setError(''); setReview(null);
    try { const detail = await adminRequest<{ result: Result; rows: ReviewRow[] }>(token, `/admin/results/${id}`, 'GET', undefined, controller.signal); if (!controller.signal.aborted) setReview(detail); }
    catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Không thể tải lời giải.'); }
    finally { if (!controller.signal.aborted) setReviewLoading(false); }
  };
  return <div data-competition-results>
    <h2>Kết quả IOE/Violympic</h2><p>Mặc định hiển thị tất cả bài đã hoàn thành trong phạm vi quản lý của bạn. Chọn điều kiện rồi bấm Lọc kết quả khi cần.</p>
    <form className="competition-toolbar" aria-label="Bộ lọc kết quả" onSubmit={e => { e.preventDefault(); applyFilters(); }}>
      <label>Môn<select value={filters.subject} disabled={busy} onChange={e => setFilters(old => ({ ...old, subject: e.target.value }))}><option value="">Tất cả môn</option>{Object.entries(SUBJECT_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      <label>Lớp<select value={filters.grade} disabled={busy} onChange={e => setFilters(old => ({ ...old, grade: e.target.value }))}><option value="">Tất cả lớp</option>{Array.from({ length: 9 }, (_, i) => <option key={i + 1} value={i + 1}>Lớp {i + 1}</option>)}</select></label>
      <label>Cấp<select value={filters.level} disabled={busy} onChange={e => setFilters(old => ({ ...old, level: e.target.value }))}><option value="">Tất cả cấp</option>{Object.entries(LEVEL_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      <button type="submit" className="competition-primary" disabled={busy}>Lọc kết quả</button><button type="button" disabled={busy} onClick={showAll}>Xóa bộ lọc</button>
      <button type="button" disabled={busy} onClick={() => setRevision(n => n + 1)}>Cập nhật kết quả</button>
    </form>
    {error && <p role="alert" className="competition-error">{error}</p>}{busy && <p role="status">{reviewLoading ? 'Đang tải lời giải...' : 'Đang tải kết quả...'}</p>}
    {!loading && data && <>
      <p role="status" data-results-total>{data.total} bài hoàn thành · Trang {data.page}/{Math.max(1, Math.ceil(data.total / data.pageSize))}</p>
      <div className="competition-table-wrap"><table className="competition-results-table"><thead><tr><th>Học sinh / Lớp</th><th>Đề</th><th>Môn / Khối / Cấp</th><th>Điểm</th><th>Hoàn thành</th><th>Chi tiết</th></tr></thead><tbody>{data.items.map(r => <tr key={r.id} data-result-id={r.id}><td>{r.student_name}<p>{r.class_name || 'Luyện tập'}</p></td><td>{r.title}</td><td>{SUBJECT_LABELS[r.subject]}<p>Lớp {r.grade} · {LEVEL_LABELS[r.level]}</p></td><td>{r.raw_score}/{r.max_score} ({r.score}%)</td><td>{new Date(r.completed_at).toLocaleString('vi-VN')}</td><td><button type="button" disabled={busy} onClick={() => void showReview(r.id)}>Xem lời giải</button></td></tr>)}</tbody></table></div>
      {!data.items.length && <p>{Object.keys(applied).length ? 'Không có bài hoàn thành phù hợp bộ lọc.' : 'Chưa có bài hoàn thành.'}</p>}
      <div className="competition-toolbar"><button type="button" disabled={busy || page <= 1} onClick={() => setPage(n => n - 1)}>Trang trước</button><button type="button" disabled={busy || page * data.pageSize >= data.total} onClick={() => setPage(n => n + 1)}>Trang sau</button></div>
    </>}
    {review && <><button type="button" onClick={() => setReview(null)}>Đóng chi tiết</button><CompetitionReview {...review} /></>}
  </div>;
}
