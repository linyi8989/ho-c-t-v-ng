import React, { useRef, useState } from 'react';
import { LEVEL_LABELS, SUBJECT_LABELS, SUBJECTS, levelsFor, type BankTopic, type Scope, type PublicPaper } from '../../shared/competition/types';
import { request } from './api';

export default function BankDirectory({ loading, onNavigate }: {
  topics: BankTopic[]; papers: PublicPaper[]; loading: boolean; failed: boolean; onRefresh: () => void; onNavigate: (path: string) => void;
}) {
  const [subject, setSubject] = useState<Scope['subject'] | ''>(''), [grade, setGrade] = useState(''), [level, setLevel] = useState<Scope['level'] | ''>('');
  const [checking, setChecking] = useState(false), [message, setMessage] = useState('');
  const inFlight = useRef(false);
  const start = async () => {
    if (inFlight.current) return;
    if (!subject || !grade || !level) { setMessage('Em hãy chọn đủ môn, lớp và cấp.'); return; }
    inFlight.current = true; setChecking(true); setMessage('');
    try {
      const id = `bank-${subject}-${grade}-${level}`;
      const topic = await request<BankTopic>(`/papers/${id}`, { cache: 'no-store' });
      if (!topic.ready) { setMessage('Bộ đề đang được soạn, hãy chọn cấp khác.'); return; }
      onNavigate(`/ioe-violympic/paper/${id}?start=now&run=${crypto.randomUUID()}`);
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Chưa kiểm tra được kho câu hỏi. Hãy thử lại.'); }
    finally { inFlight.current = false; setChecking(false); }
  };
  return <section data-bank-directory aria-labelledby="competition-bank-heading">
    <h2 id="competition-bank-heading">Thi thử ngay</h2>
    <p>Chọn môn, lớp và cấp. Mỗi lượt lấy câu hỏi ngẫu nhiên từ ngân hàng chung.</p>
    <p>IOE Tiếng Anh: lớp 1–2 có 100 câu, lớp 3–9 có 200 câu. Các môn khác: 30 câu. Thời gian: 30 phút.</p>
    <div className="competition-toolbar">
      <label>Môn<select disabled={checking} value={subject} onChange={event => { const next = event.target.value as typeof subject; setSubject(next); setMessage(''); if (next && level && !levelsFor(next).includes(level)) setLevel(''); }}>
        <option value="">Chọn môn</option>{SUBJECTS.map(value => <option key={value} value={value}>{SUBJECT_LABELS[value]}</option>)}
      </select></label>
      <label>Lớp<select disabled={checking} value={grade} onChange={event => { setGrade(event.target.value); setMessage(''); }}><option value="">Chọn lớp</option>{Array.from({ length: 9 }, (_, i) => i + 1).map(value => <option key={value} value={value}>Lớp {value}</option>)}</select></label>
      <label>Cấp<select disabled={checking || !subject} value={level} onChange={event => { setLevel(event.target.value as typeof level); setMessage(''); }}><option value="">Chọn cấp</option>{(subject ? levelsFor(subject) : []).map(value => <option key={value} value={value}>{LEVEL_LABELS[value]}</option>)}</select></label>
      <button type="button" className="competition-primary" disabled={loading || checking} aria-busy={checking} onClick={() => void start()}>{checking ? 'Đang kiểm tra kho…' : 'Thi thử ngay'}</button>
    </div>
    {message && <p role="alert" className="competition-notice">{message}</p>}
  </section>;
}
