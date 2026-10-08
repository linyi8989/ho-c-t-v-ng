import { splitTeacherFeedback } from '../../shared/competition/feedback';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { buildImportPrompt, normalizeQuestion, normalizeMedia, record } from '../../shared/competition/import';
import { LEVEL_LABELS, SUBJECT_LABELS, levelsFor, playable, type Scope, type QuestionFilters, type Subject, type CompetitionLevel, type Question, type PlayableQuestion, type Option, type Media } from '../../shared/competition/types';
import type { ListeningAsset } from '../listening/types';
import { listeningApi } from '../listening/api';
import { adminRequest, request } from './api';
import MediaEditor from './MediaEditor';
import QuestionPreview from './QuestionPreview';
import CompetitionOverview from './Overview';
import CompetitionResults from './Results';
import './competition.css';

interface Draft { key: string; data: Record<string, unknown>; databaseId?: string; revision?: number }
const string = (value: unknown) => typeof value === 'string' || typeof value === 'number' ? String(value) : '';
function draftMedia(value: unknown): Media[] {
  try { return normalizeMedia(value); } catch { return []; } // Invalid raw data stays in the draft and blocks save; never render its URLs.
}
function draftData(value: unknown): Record<string, unknown> {
  const source = record(value), content = source.content ? record(source.content) : source;
  const data: Record<string, unknown> = { ...source, title: content.title || '', prompt: content.prompt ?? source.question ?? source.text ?? '', passage: content.passage || '', media: content.media || [] };
  if (typeof source.explanation === 'string' && (source.teacherNote == null || typeof source.teacherNote === 'string' || typeof source.teacherNote === 'number')) Object.assign(data, splitTeacherFeedback(source.explanation, string(source.teacherNote)));
  delete data.content;
  const spec = source.answerSpec ? record(source.answerSpec) : undefined;
  if (spec?.kind === 'single-choice') { data.answer = spec.correctOptionId; delete data.answerSpec; }
  if (spec?.kind === 'text') { data.answer = Array.isArray(spec.acceptedAnswers) ? spec.acceptedAnswers.join(' | ') : ''; delete data.answerSpec; delete data.acceptedAnswers; }
  if (!spec && Array.isArray(source.acceptedAnswers)) { data.answer = source.acceptedAnswers.join(' | '); delete data.acceptedAnswers; }
  return data;
}
function draftOptions(data: Record<string, unknown>): Option[] {
  return (Array.isArray(data.options) ? data.options : []).map((o, i) => {
    const value = o && typeof o === 'object' ? record(o) : { text: string(o) };
    return { id: `option-${i + 1}`, label: String.fromCharCode(65 + i), text: string(value.text), media: draftMedia(value.media) };
  });
}
function saveData(data: Record<string, unknown>) {
  if (!data.answerSpec && !draftOptions(data).length && typeof data.answer === 'string' && data.answer.includes('|')) return { ...data, acceptedAnswers: data.answer.split('|').map(a => a.trim()).filter(Boolean) };
  return data;
}
export function ScopeFields({ scope, onChange, disabled = false }: { scope: Scope; onChange: (s: Scope) => void; disabled?: boolean }) {
  return <div className="competition-toolbar">
    <label>Môn<select value={scope.subject} disabled={disabled} onChange={e => { const subject = e.target.value as Subject; onChange({ ...scope, subject, level: levelsFor(subject).includes(scope.level) ? scope.level : 'school' }); }}>
      {Object.entries(SUBJECT_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
    </select></label>
    <label>Lớp<select value={scope.grade} disabled={disabled} onChange={e => onChange({ ...scope, grade: Number(e.target.value) })}>{Array.from({ length: 9 }, (_, i) => <option key={i + 1} value={i + 1}>Lớp {i + 1}</option>)}</select></label>
    <label>Cấp<select value={scope.level} disabled={disabled} onChange={e => onChange({ ...scope, level: e.target.value as CompetitionLevel })}>{levelsFor(scope.subject).map(level => <option key={level} value={level}>{LEVEL_LABELS[level]}</option>)}</select></label>
  </div>;
}
export default function CompetitionAdmin({ token, active }: { token: string; active: boolean }) {
  const [scope, setScope] = useState<Scope>({ subject: 'english', grade: 3, level: 'practice' });
  const [tab, setTab] = useState('overview'), [enabled, setEnabled] = useState<boolean | null>(null), [reason, setReason] = useState('');
  const [operationBusy, setBusy] = useState(false), [refreshing, setRefreshing] = useState(false), [mediaPending, setMediaPending] = useState(0), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const busy = operationBusy || refreshing || mediaPending > 0;
  const onMediaBusy = useCallback((pending: boolean) => setMediaPending(n => Math.max(0, n + (pending ? 1 : -1))), []);
  const [json, setJson] = useState(''), [drafts, setDrafts] = useState<Draft[]>([]), [promptVisible, setPromptVisible] = useState(false);
  const [bank, setBank] = useState<Question[]>([]), [bankTotal, setBankTotal] = useState(0), [page, setPage] = useState(1), [search, setSearch] = useState('');
  const [bankFilters, setBankFilters] = useState<QuestionFilters>({}), [loadedBankQuery, setLoadedBankQuery] = useState(''), [failedBankQuery, setFailedBankQuery] = useState('');
  const [selected, setSelected] = useState<string[]>([]), [preview, setPreview] = useState<{ question: PlayableQuestion; number: number } | null>(null);
  const [assets, setAssets] = useState<ListeningAsset[]>([]);
  const saveKey = useRef<string | null>(null), pendingRef = useRef(false);
  const onAsset = (a: ListeningAsset) => setAssets(old => [...old.filter(item => item.id !== a.id), a]);
  const scopeQuery = new URLSearchParams({ ...(bankFilters.subject ? { subject: bankFilters.subject } : {}), ...(bankFilters.grade ? { grade: String(bankFilters.grade) } : {}), ...(bankFilters.level ? { level: bankFilters.level } : {}), page: String(page), search }).toString();
  const bankLoading = refreshing || (loadedBankQuery !== scopeQuery && failedBankQuery !== scopeQuery);
  const visibleBank = loadedBankQuery === scopeQuery ? bank : [];
  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const bankData = await adminRequest<{ items: Question[]; total: number }>(token, `/admin/questions?${scopeQuery}`, 'GET', undefined, signal);
      if (signal?.aborted) return;
      setBank(bankData.items); setBankTotal(bankData.total); setSelected([]); setLoadedBankQuery(scopeQuery); setFailedBankQuery('');
    } catch (e) { if (!signal?.aborted) setFailedBankQuery(scopeQuery); throw e; }
  }, [token, scopeQuery]);
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    void request<{ enabled: boolean; reason: string }>('/capabilities', { signal: controller.signal }).then(data => { setEnabled(data.enabled); setReason(data.reason); }).catch(e => { if (!controller.signal.aborted) setError(e.message); });
    return () => controller.abort();
  }, [active]);
  useEffect(() => { setPreview(null); }, [active, tab]);
  useEffect(() => {
    if (!active || !enabled || tab !== 'bank') return;
    const controller = new AbortController(), timer = setTimeout(() => { setRefreshing(true); void refresh(controller.signal).catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setRefreshing(false); }); }, 250);
    return () => { clearTimeout(timer); controller.abort(); setRefreshing(false); };
  }, [active, enabled, tab, refresh]);
  useEffect(() => {
    if (!active || !enabled) return;
    let cancelled = false;
    void listeningApi.listAssets(token).then(data => { if (!cancelled) setAssets(data); }).catch(e => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [active, enabled, token]);
  const work = async (operation: () => Promise<void>) => {
    if (pendingRef.current || mediaPending > 0) return; pendingRef.current = true; setBusy(true); setError(''); setNotice('');
    try { await operation(); } catch (e) { setError(e instanceof Error ? e.message : 'Không thể xử lý.'); } finally { pendingRef.current = false; setBusy(false); }
  };
  const change = (key: string, patch: Record<string, unknown>) => { saveKey.current = null; setDrafts(rows => rows.map(r => r.key === key ? { ...r, data: { ...r.data, ...patch } } : r)); };
  const changeBankFilters = (filters: QuestionFilters) => { setBankFilters(filters); setPage(1); setSelected([]); setPreview(null); };
  const openBankDraft = (question: Question, copy: boolean) => {
    if (drafts.length && (scope.subject !== question.subject || scope.grade !== question.grade || scope.level !== question.level)) {
      setError('Bảng đang soạn có câu thuộc môn/lớp/cấp khác. Hãy lưu hoặc bỏ các dòng trước khi sửa hay sao chép câu này.'); return;
    }
    setScope({ subject: question.subject, grade: question.grade, level: question.level });
    setDrafts(old => [...old, { key: crypto.randomUUID(), data: draftData(question), ...(!copy ? { databaseId: question.id, revision: question.revision } : {}) }]);
    saveKey.current = null; setError(''); setNotice(''); setPreview(null); setTab('studio');
  };
  const parseDraft = () => {
    const parsed: unknown = JSON.parse(json.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
    const rows = Array.isArray(parsed) ? parsed : record(parsed).questions;
    if (!Array.isArray(rows) || !rows.length || rows.length > 500 || new TextEncoder().encode(json).byteLength > 1500000) throw new Error('Nhập 1–500 câu, tối đa 1,5 MB; chia PDF lớn thành các phần.');
    const imported = rows.map(row => ({ key: crypto.randomUUID(), data: draftData(row) }));
    setDrafts(old => [...old, ...imported]); saveKey.current = null;
    setJson(''); setNotice(`Đã ghép ${rows.length} câu vào bảng. Kiểm tra và sửa các dòng báo lỗi trước khi lưu.`);
  };
  const save = async () => {
    drafts.forEach((row, i) => { try { normalizeQuestion(saveData(row.data), scope); } catch (e) { throw new Error(`Dòng ${i + 1}: ${e instanceof Error ? e.message : 'không hợp lệ'}`); } });
    const key = saveKey.current || crypto.randomUUID(); saveKey.current = key;
    let done = 0;
    for (let i = 0; i < drafts.length;) {
      const row = drafts[i];
      if (row.databaseId) {
        await adminRequest(token, `/admin/questions/${row.databaseId}`, 'PUT', { ...saveData(row.data), ...scope, revision: row.revision }); i++; done++;
      } else {
        const chunk: Draft[] = []; let bytes = 0;
        while (i < drafts.length && !drafts[i].databaseId && chunk.length < 50) {
          const size = new TextEncoder().encode(JSON.stringify(saveData(drafts[i].data))).byteLength;
          if (chunk.length && bytes + size > 1500000) break;
          chunk.push(drafts[i++]); bytes += size;
        }
        await adminRequest(token, '/admin/questions', 'POST', { ...scope, requestId: `${key}:${chunk[0].key}`, questions: chunk.map(r => saveData(r.data)) }); done += chunk.length;
      }
      // Remove committed rows immediately: a later failed chunk can be retried without duplicating prior saves.
      const committed = drafts.slice(0, i).map(r => r.key);
      setDrafts(old => old.filter(r => !committed.includes(r.key)));
    }
    saveKey.current = null; setNotice(`Đã lưu ${done} câu hợp lệ vào bank.`); await refresh();
  };
  if (!active) return <div hidden />;
  return <section id="ioe-violympic-admin" className="competition-root competition-page">
    <h1>IOE/Violympic</h1><p>Soạn câu từ PDF/ảnh, quản lý ngân hàng và xem kết quả học sinh.</p>
    {enabled === null && <p role="status">Đang kiểm tra module...</p>}{enabled === false && <p role="status" className="competition-error">{reason}</p>}
    {error && <div role="alert" className="competition-error">{error}<button type="button" disabled={busy} onClick={() => void work(async () => { const data = await request<{ enabled: boolean; reason: string }>('/capabilities'); setEnabled(data.enabled); setReason(data.reason); if (data.enabled) await refresh(); })}>Tải lại dữ liệu</button></div>}{notice && <div role="status" className="competition-notice">{notice}</div>}
    {enabled && <>
      <nav className="competition-tabs" aria-label="Quản lý IOE/Violympic">{[['overview', 'Tổng quan'], ['studio', 'Soạn JSON'], ['bank', 'Ngân hàng'], ['results', 'Kết quả']].map(([id, name]) => <button key={id} type="button" disabled={operationBusy || mediaPending > 0} aria-pressed={tab === id} onClick={() => setTab(id)}>{name}</button>)}</nav>
      {tab === 'studio' && <ScopeFields scope={scope} disabled={busy || drafts.length > 0} onChange={s => { setScope(s); setPreview(null); }} />}
      {tab === 'studio' && drafts.length > 0 && <p>Môn/lớp/cấp được giữ cho bảng đang soạn. Lưu hoặc bỏ các dòng trước khi đổi lựa chọn.</p>}
      {tab === 'overview' && <CompetitionOverview token={token} />}
      {tab === 'results' && <CompetitionResults token={token} />}
      {busy && <p role="status">Đang xử lý...</p>}
      {tab === 'studio' && <>
        <div className="competition-card"><h2>1. Sao chép prompt → gửi PDF/ảnh cho ChatGPT</h2><p>2. Dán JSON trả về → ghép vào bảng → chỉnh sửa → lưu bank.</p>
          <button type="button" onClick={() => void work(async () => { const prompt = buildImportPrompt(scope); try { await navigator.clipboard.writeText(prompt); setNotice('Đã sao chép hướng dẫn.'); } catch { setPromptVisible(true); setNotice('Chọn và sao chép hướng dẫn bên dưới.'); } })}>Sao chép hướng dẫn cho AI</button>
          <button type="button" onClick={() => setPromptVisible(!promptVisible)}>Xem hướng dẫn</button>{promptVisible && <textarea readOnly value={buildImportPrompt(scope)} rows={8} aria-label="Hướng dẫn cho ChatGPT" />}
          <label>JSON từ ChatGPT<textarea value={json} disabled={busy} maxLength={1500000} onChange={e => setJson(e.target.value)} rows={6} /></label>
          <div className="competition-toolbar"><button type="button" disabled={busy || !json.trim()} onClick={() => void work(async () => parseDraft())}>Ghép vào bảng</button>
            <button type="button" disabled={busy} onClick={() => setDrafts(old => [...old, { key: crypto.randomUUID(), data: { title: '', prompt: '', options: [], answer: '', domain: 'vocabulary', difficulty: 2, media: [] } }])}>Thêm câu thủ công</button>
            <button type="button" className="competition-primary" disabled={busy || !drafts.length} onClick={() => void work(save)}>Lưu {drafts.length} câu vào bank</button></div>
        </div>
        {drafts.map((row, i) => {
          let validation = ''; try { normalizeQuestion(saveData(row.data), scope); } catch (e) { validation = e instanceof Error ? e.message : 'Không hợp lệ.'; }
          const opts = draftOptions(row.data), attached = draftMedia(row.data.media);
          const answer = string(row.data.answer), optionAnswer = answer.trim() ? opts.find(o => o.id === answer || o.label === answer.toUpperCase() || o.text === answer)?.id || '' : '';
          return <article key={row.key} className="competition-card" data-competition-draft-row>
            <fieldset disabled={busy} className="competition-draft-fields">
            <div className="competition-toolbar"><h3>Dòng {i + 1}{row.databaseId ? ' · Sửa câu đã lưu' : ''}</h3><button type="button" disabled={busy} onClick={() => { setDrafts(old => old.filter(r => r.key !== row.key)); saveKey.current = null; }}>Bỏ dòng</button></div>
            {validation && <p className="competition-error">{validation}</p>}
            <div className="competition-editor-fields">
              <label className="competition-full">Tiêu đề nguồn<input maxLength={500} value={string(row.data.title)} onChange={e => change(row.key, { title: e.target.value })} /></label>
              <label className="competition-full">Nội dung câu hỏi<textarea value={string(row.data.prompt)} maxLength={20000} onChange={e => change(row.key, { prompt: e.target.value })} /></label>
              <label className="competition-full">Đoạn văn / dữ kiện chung<textarea value={string(row.data.passage)} maxLength={20000} onChange={e => change(row.key, { passage: e.target.value })} /></label>
              {scope.subject === 'english' && <><label>Nhóm kiến thức<select value={string(row.data.domain) || 'vocabulary'} onChange={e => change(row.key, { domain: e.target.value })}>{['vocabulary', 'grammar', 'reading', 'listening'].map(d => <option key={d} value={d}>{d}</option>)}</select></label>
              <label>Độ khó<select value={Number(row.data.difficulty || 2)} onChange={e => change(row.key, { difficulty: Number(e.target.value) })}>{[1, 2, 3, 4, 5].map(d => <option key={d}>{d}</option>)}</select></label></>}
            </div>
            <MediaEditor token={token} value={attached} onChange={items => change(row.key, { media: items })} assets={assets} onAsset={onAsset} onBusyChange={onMediaBusy} />
            <h3>Phương án (để trống danh sách với câu trả lời ngắn)</h3>
            {opts.map((o, j) => <div key={o.id} className="competition-editor-option"><strong>{o.label}.</strong><div><textarea aria-label={`Phương án ${o.label}, dòng ${i + 1}`} value={o.text} maxLength={8000} onChange={e => change(row.key, { options: opts.map((item, k) => k === j ? { ...item, text: e.target.value } : item) })} />
              <MediaEditor token={token} value={o.media} onChange={items => change(row.key, { options: opts.map((item, k) => k === j ? { ...item, media: items } : item) })} assets={assets} onAsset={onAsset} onBusyChange={onMediaBusy} /></div>
              <button type="button" disabled={busy} onClick={() => { const remaining = opts.filter((_, k) => k !== j), current = opts.find(item => item.id === optionAnswer); change(row.key, { options: remaining, answer: current && current.id !== o.id ? String.fromCharCode(65 + remaining.findIndex(item => item.id === current.id)) : '' }); }}>Gỡ</button>
            </div>)}
            <button type="button" disabled={busy || opts.length >= 26} onClick={() => change(row.key, { options: [...opts, { id: `option-${opts.length + 1}`, label: String.fromCharCode(65 + opts.length), text: '', media: [] }] })}>Thêm phương án</button>
            {row.data.answerSpec ? <AdvancedAnswerEditor value={row.data.answerSpec} onApply={answerSpec => change(row.key, { answerSpec })} />
              : opts.length ? <label>Đáp án đúng<select value={optionAnswer} onChange={e => change(row.key, { answer: e.target.value })}><option value="">Chưa có đáp án</option>{opts.map(o => <option key={o.id} value={o.id}>{o.label}. {o.text.slice(0, 80)}</option>)}</select></label>
              : <label>Đáp án trả lời ngắn (nhiều đáp án cách nhau bằng |)<input maxLength={2000} value={answer} onChange={e => change(row.key, { answer: e.target.value })} /></label>}
            <label>Giải thích<textarea maxLength={20000} value={string(row.data.explanation)} onChange={e => change(row.key, { explanation: e.target.value })} /></label>
            <label className="competition-teacher-note">Ghi chú cho giáo viên (không hiển thị cho học sinh)<textarea rows={3} maxLength={5000} value={string(row.data.teacherNote)} placeholder="Thông tin nguồn thiếu, đáp án cần xác nhận hoặc điểm cần kiểm tra..." onChange={e => change(row.key, { teacherNote: e.target.value })} /></label>
            {!validation && <button type="button" disabled={busy} onClick={() => setPreview({ question: playable(normalizeQuestion(saveData(row.data), scope)), number: i + 1 })}>Xem trước</button>}
            </fieldset>
          </article>;
        })}
        {!drafts.length && <p className="competition-card">Chưa có câu đang soạn. Dán JSON hoặc thêm câu thủ công.</p>}
      </>}
      {tab === 'bank' && <>
        <div className="competition-toolbar competition-bank-toolbar" aria-label="Bộ lọc ngân hàng">
          <label>Môn<select value={bankFilters.subject || ''} disabled={operationBusy || mediaPending > 0} onChange={e => { const subject = e.target.value as Subject | ''; changeBankFilters({ ...bankFilters, subject: subject || undefined, level: subject && bankFilters.level && !levelsFor(subject).includes(bankFilters.level) ? undefined : bankFilters.level }); }}>
            <option value="">Tất cả môn</option>{Object.entries(SUBJECT_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select></label>
          <label>Lớp<select value={bankFilters.grade || ''} disabled={operationBusy || mediaPending > 0} onChange={e => changeBankFilters({ ...bankFilters, grade: e.target.value ? Number(e.target.value) : undefined })}>
            <option value="">Tất cả lớp</option>{Array.from({ length: 9 }, (_, i) => <option key={i + 1} value={i + 1}>Lớp {i + 1}</option>)}
          </select></label>
          <label>Cấp<select value={bankFilters.level || ''} disabled={operationBusy || mediaPending > 0} onChange={e => changeBankFilters({ ...bankFilters, level: e.target.value ? e.target.value as CompetitionLevel : undefined })}>
            <option value="">Tất cả cấp</option>{(bankFilters.subject ? levelsFor(bankFilters.subject) : Object.keys(LEVEL_LABELS) as CompetitionLevel[]).map(level => <option key={level} value={level}>{LEVEL_LABELS[level]}</option>)}
          </select></label>
          <label>Tìm nội dung / tiêu đề<input value={search} disabled={operationBusy || mediaPending > 0} maxLength={300} onChange={e => { setSearch(e.target.value); setPage(1); setSelected([]); setPreview(null); }} /></label>
          <button type="button" className="competition-danger" disabled={busy || bankLoading || !selected.length} onClick={() => void work(async () => { await adminRequest(token, '/admin/questions/archive', 'POST', { ids: selected }); setNotice(`Đã lưu trữ ${selected.length} câu. Đề và lịch sử cũ được giữ.`); await refresh(); })}>Xóa {selected.length} câu đã chọn</button></div>
        <div className="competition-table-wrap"><table><thead><tr><th><input type="checkbox" aria-label="Chọn cả trang" disabled={busy || bankLoading || !visibleBank.length} checked={visibleBank.length > 0 && selected.length === visibleBank.length} onChange={e => setSelected(e.target.checked ? visibleBank.map(q => q.id) : [])} /></th><th>Câu hỏi</th><th>Nhóm / độ khó</th><th>Thao tác</th></tr></thead>
          <tbody>{visibleBank.map(q => <tr key={q.id}><td><input type="checkbox" aria-label={`Chọn ${q.title || q.prompt}`} disabled={busy || bankLoading} checked={selected.includes(q.id)} onChange={e => setSelected(old => e.target.checked ? [...old, q.id] : old.filter(id => id !== q.id))} /></td><td className="competition-bank-prompt"><strong>{q.title}</strong><p>{q.prompt}</p></td><td>{q.domain} / {q.difficulty}</td><td>
            <button type="button" onClick={() => setPreview({ question: playable(q), number: 1 })}>Xem trước</button><button type="button" disabled={busy || bankLoading} onClick={() => openBankDraft(q, false)}>Sửa</button>
            <button type="button" disabled={busy || bankLoading} onClick={() => openBankDraft(q, true)}>Sao chép</button>
            <button type="button" className="competition-danger" disabled={busy} onClick={() => void work(async () => { await adminRequest(token, '/admin/questions/archive', 'POST', { ids: [q.id] }); await refresh(); })}>Xóa</button>
          </td></tr>)}</tbody></table></div>
        {bankLoading ? <p role="status">Đang tải câu hỏi...</p> : failedBankQuery !== scopeQuery && !visibleBank.length && <p>Không có câu phù hợp bộ lọc.</p>}
        {!bankLoading && failedBankQuery !== scopeQuery && <div className="competition-toolbar"><button type="button" disabled={busy || page <= 1} onClick={() => { setPage(page - 1); setSelected([]); }}>Trang trước</button><span>{bankTotal} câu · Trang {page}/{Math.max(1, Math.ceil(bankTotal / 30))}</span><button type="button" disabled={busy || page * 30 >= bankTotal} onClick={() => { setPage(page + 1); setSelected([]); }}>Trang sau</button></div>}
      </>}
      {preview && <QuestionPreview question={preview.question} number={preview.number} onClose={() => setPreview(null)} />}
    </>}
  </section>;
}
function AdvancedAnswerEditor({ value, onApply }: { value: unknown; onApply: (v: Record<string, unknown>) => void }) {
  const [json, setJson] = useState(JSON.stringify(value, null, 2)), [error, setError] = useState('');
  return <div><label>Đáp án nâng cao (số/phân số/sắp xếp/nối cặp)<textarea value={json} maxLength={20000} onChange={e => setJson(e.target.value)} /></label><button type="button" onClick={() => { try { const parsed = record(JSON.parse(json)); if (!parsed.kind) throw new Error('Cần kind của đáp án.'); onApply(parsed); setError(''); } catch (e) { setError(e instanceof Error ? e.message : 'JSON không hợp lệ.'); } }}>Áp dụng đáp án nâng cao</button>{error && <p className="competition-error" role="alert">{error}</p>}</div>;
}
