import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getOrCreateLearningGuest, getStoredGuestAccessCredential, getStoredGuestId, storeGuestAccessCredential, STUDENT_NAME_STORAGE_KEY } from '../../lib/guestIdentity';
import { validateStudentDisplayName } from '../../lib/studentIdentity';
import { buildLearningHistoryHeaders } from '../../lib/api/learningHistory';
import type { AssessmentUserAnswer } from '../../shared/competition/answer';
import { type AttemptSession, type BankTopic, type MistakeTopic, type PracticeReport, type PublicPaper, type Result, type ReviewRow } from '../../shared/competition/types';
import { CompetitionApiError, request } from './api';
import QuestionView from './QuestionView';
import CompetitionReview from './Review';
import StudentPortal from './StudentPortal';
import StudentModuleHeader from '../../components/student/StudentModuleHeader';
import './competition.css';

interface SavedRun { id: string; ticket: string; clientRunId: string; answers: Record<string, AssessmentUserAnswer>; revision: number; access: string; actorKind: 'user' | 'guest'; actorId: string }
function getSaved(key: string): SavedRun | null { try { const value = JSON.parse(sessionStorage.getItem(key) || 'null'); return value && typeof value.id === 'string' && typeof value.ticket === 'string' && typeof value.actorId === 'string' ? value : null; } catch { return null; } }
function setSaved(key: string, value: SavedRun) { try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* Server remains authoritative if browser storage is unavailable. */ } }
export function CompetitionEntry({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => { const controller = new AbortController(); void request<{ enabled: boolean }>('/capabilities', { signal: controller.signal }).then(data => setEnabled(data.enabled)).catch(() => {}); return () => controller.abort(); }, []);
  return enabled ? <section className="competition-root competition-card" id="home-ioe-violympic-entry"><h2>IOE/Violympic</h2><p>Luyện Tiếng Anh, Toán, Toán Tiếng Anh và Tiếng Việt theo lớp, cấp. Xem điểm và lời giải trong lịch sử học tập.</p><button type="button" className="competition-primary" onClick={() => onNavigate('/ioe-violympic')}>Mở IOE/Violympic</button></section> : null;
}
export default function CompetitionStudent({ paperId, access = '', onNavigate }: { paperId?: string; access?: string; onNavigate: (path: string) => void }) {
  const { user, token, loading: authLoading } = useAuth();
  const requestedRun = new URLSearchParams(window.location.search).get('run') || '';
  const launchId = /^[0-9a-f-]{36}$/i.test(requestedRun) ? requestedRun : '';
  const [papers, setPapers] = useState<PublicPaper[]>([]), [paper, setPaper] = useState<PublicPaper | BankTopic | MistakeTopic | null>(null), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [practice, setPractice] = useState<PracticeReport | null>(null), [practiceLoading, setPracticeLoading] = useState(false), [practiceError, setPracticeError] = useState('');
  const [topics, setTopics] = useState<BankTopic[]>([]), [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [name, setName] = useState(() => { try { return localStorage.getItem(STUDENT_NAME_STORAGE_KEY) || ''; } catch { return ''; } });
  const [session, setSession] = useState<AttemptSession | null>(null), [answers, setAnswers] = useState<Record<string, AssessmentUserAnswer>>({});
  const [index, setIndex] = useState(0), [remaining, setRemaining] = useState(0), [saveStatus, setSaveStatus] = useState(''), [review, setReview] = useState<{ result: Result; rows: ReviewRow[] } | null>(null);
  const [localBackup, setLocalBackup] = useState<Record<string, AssessmentUserAnswer> | null>(null);
  const sessionRef = useRef<AttemptSession | null>(null), answersRef = useRef(answers), dirty = useRef(0), acknowledged = useRef(0), offset = useRef(0);
  const pending = useRef<Promise<void> | null>(null), submission = useRef(false), conflict = useRef(false), mounted = useRef(true);
  const run = useRef<SavedRun | null>(null), preparingId = useRef(launchId || crypto.randomUUID());
  const expiryRetryAt = useRef(0);
  const autoStarted = useRef(''), answerInFlight = useRef(false), preparing = useRef(false);
  const immediateStart = !!paperId?.startsWith('bank-') && new URLSearchParams(window.location.search).get('start') === 'now';
  const actorId = user?.id || getStoredGuestId(), storageKey = `ioe-violympic:${paperId || 'directory'}:${actorId}`;
  const storageKeyRef = useRef(storageKey), tokenRef = useRef(token), userRef = useRef(user);
  tokenRef.current = token; userRef.current = user;
  const headers = useCallback(() => {
    const kind = run.current?.actorKind || (userRef.current ? 'user' : 'guest');
    if (kind === 'user') {
      if (run.current && userRef.current?.id !== run.current.actorId) throw new Error('Đăng nhập lại đúng tài khoản đã bắt đầu lượt làm này.');
      return buildLearningHistoryHeaders({ authToken: tokenRef.current });
    }
    const id = run.current?.actorId || getStoredGuestId();
    return buildLearningHistoryHeaders({ guestCredential: getStoredGuestAccessCredential(id) });
  }, []);
  const api = useCallback(<T,>(path: string, method = 'GET', body?: unknown): Promise<T> => request(path, { method,
    headers: { ...headers(), 'Content-Type': 'application/json', ...(run.current?.ticket ? { 'X-Attempt-Ticket': run.current.ticket } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }), [headers]);
  const store = useCallback(() => { const current = sessionRef.current; if (run.current && current) { run.current = { ...run.current, id: current.id, ticket: current.ticket, revision: current.revision, answers: answersRef.current }; setSaved(storageKeyRef.current, run.current); } }, []);
  const keepBackup = useCallback((value: Record<string, AssessmentUserAnswer>) => {
    setLocalBackup(value);
    try { sessionStorage.setItem(`${storageKeyRef.current}:answers-backup`, JSON.stringify(value)); } catch { /* Download is still available during this visit. */ }
  }, []);
  const apply = useCallback((next: AttemptSession, replaceAnswers = false) => {
    sessionRef.current = next; offset.current = Date.parse(next.serverNow) - Date.now();
    setRemaining(next.deadline ? Math.max(0, Math.ceil((Date.parse(next.deadline) - Date.parse(next.serverNow)) / 1000)) : next.durationMinutes * 60);
    if (replaceAnswers) { answersRef.current = next.answers; setAnswers(next.answers); dirty.current = 0; acknowledged.current = 0; }
    setSession(next); store();
    if (next.status === 'completed') setSaveStatus('Đã nộp và chấm điểm trên server.');
  }, [store]);
  const loadReview = useCallback(async (id: string) => { const data = await api<{ result: Result; rows: ReviewRow[] }>(`/attempts/${id}/review`); if (mounted.current) setReview(data); }, [api]);
  useEffect(() => {
    if (paperId) return;
    const credential = getStoredGuestAccessCredential(getStoredGuestId());
    setPractice(null); setPracticeError('');
    if ((!user && !credential) || (user && !token)) { setPracticeLoading(false); return; }
    const controller = new AbortController(); let cancelled = false;
    setPracticeLoading(true);
    void request<PracticeReport>('/practice', { signal: controller.signal, headers: buildLearningHistoryHeaders(user ? { authToken: token } : { guestCredential: credential }) })
      .then(data => { if (!cancelled) setPractice(data); }).catch(e => { if (!cancelled) setPracticeError(e.message || 'Không thể tải câu cần luyện.'); })
      .finally(() => { if (!cancelled) setPracticeLoading(false); });
    return () => { cancelled = true; controller.abort(); };
  }, [paperId, actorId, token, refresh]);
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController(); let cancelled = false;
    setLoading(true); setError('');
    void (async () => {
      const capability = await request<{ enabled: boolean; reason: string }>('/capabilities', { signal: controller.signal });
      if (!capability.enabled) throw new Error(capability.reason);
      if (!paperId) {
        const [data, bank] = await Promise.all([request<PublicPaper[]>('/papers', { signal: controller.signal }), request<BankTopic[]>('/bank-topics', { signal: controller.signal })]);
        if (!cancelled) { setPapers(data); setTopics(bank); } return;
      }
      if (cancelled) return;
      storageKeyRef.current = storageKey;
      try { const backup = JSON.parse(sessionStorage.getItem(`${storageKey}:answers-backup`) || 'null'); if (backup && typeof backup === 'object') setLocalBackup(backup); } catch { /* Optional backup. */ }
      const saved = getSaved(storageKey);
      if (saved && saved.access === access && saved.actorId === actorId && (!immediateStart || !launchId || saved.clientRunId === launchId)) {
        run.current = saved;
        const restored = await api<AttemptSession>(`/attempts/${saved.id}`);
        if (cancelled) return;
        if (restored.revision !== saved.revision && JSON.stringify(saved.answers) !== JSON.stringify(restored.answers)) { keepBackup(saved.answers); setNotice('Server có phiên bản mới hơn. Đã giữ bản sao câu trả lời trên thiết bị để em tải xuống kiểm tra.'); }
        apply(restored, true);
        if (restored.status === 'active' && restored.revision === saved.revision && saved.answers) { answersRef.current = saved.answers; setAnswers(saved.answers); dirty.current = 1; store(); setNotice('Đã khôi phục câu trả lời trên thiết bị; đang đồng bộ với server.'); }
        if (restored.status === 'completed') await loadReview(restored.id);
      } else {
        const info = await request<PublicPaper | BankTopic | MistakeTopic>(`/papers/${paperId}${access ? `?access=${encodeURIComponent(access)}` : ''}`, { signal: controller.signal, headers: paperId.startsWith('mistakes-') ? headers() : token ? { Authorization: `Bearer ${token}` } : {} });
        if (!cancelled) setPaper(info);
      }
    })().catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Không thể tải đề.'); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; mounted.current = false; controller.abort(); };
  }, [paperId, access, refresh]);
  const activate = async () => { const current = sessionRef.current; if (current?.status === 'prepared') apply(await api<AttemptSession>(`/attempts/${current.id}/activate`, 'POST', {}), true); };
  const prepare = async (immediate = false) => {
    if (preparing.current) return; preparing.current = true;
    setBusy(true); setError('');
    try {
      if (immediate && sessionRef.current?.status === 'prepared') { await activate(); return; }
      if (!user) {
        const guest = getOrCreateLearningGuest();
        if (!getStoredGuestAccessCredential(guest.guestId)) {
          const validation = validateStudentDisplayName(name); if (!validation.valid) throw new Error(validation.error);
          const response = await fetch('/api/guest-profiles/resolve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ guestId: guest.guestId, displayName: validation.value }) });
          const profile = await response.json().catch(() => ({})); if (!response.ok) throw new Error(profile.error || 'Không thể xác minh học sinh.');
          if (profile.guestAccessToken) storeGuestAccessCredential(profile.guestId || guest.guestId, profile.guestAccessToken, profile.guestAccessTokenVersion);
          try { localStorage.setItem(STUDENT_NAME_STORAGE_KEY, profile.displayName || validation.value); } catch { /* Optional display name cache. */ }
          if (!getStoredGuestAccessCredential(guest.guestId)) throw new Error('Hồ sơ cần giáo viên xác minh quyền truy cập trước khi làm bài.');
        }
      }
      const identity = user ? { actorKind: 'user' as const, actorId: user.id } : { actorKind: 'guest' as const, actorId: getStoredGuestId() };
      storageKeyRef.current = `ioe-violympic:${paperId}:${identity.actorId}`;
      run.current = { ...identity, id: '', ticket: '', answers: {}, revision: 0, clientRunId: preparingId.current, access };
      const prepared = await api<AttemptSession>('/attempts/prepare', 'POST', { paperId, clientRunId: preparingId.current, access });
      run.current = { ...run.current, id: prepared.id, ticket: prepared.ticket }; apply(prepared, true);
      if (immediate) await activate();
    } catch (e) { setError(e instanceof CompetitionApiError && e.code === 'BANK_INSUFFICIENT' ? 'Bộ đề đang được soạn, hãy chọn cấp khác.' : e instanceof Error ? e.message : 'Không thể chuẩn bị đề.'); } finally { preparing.current = false; setBusy(false); }
  };
  useEffect(() => {
    if (!immediateStart || loading || authLoading || error || (!paper && !session) || (session && session.status !== 'prepared')) return;
    if (!user && !getStoredGuestAccessCredential(getStoredGuestId()) && !validateStudentDisplayName(name).valid) return;
    const key = `${paperId}:${preparingId.current}`; if (autoStarted.current === key) return;
    autoStarted.current = key; void prepare(true);
  }, [immediateStart, loading, authLoading, paperId, paper, session?.status, user?.id]);
  const flush = useCallback(async () => {
    if (pending.current) return pending.current;
    const current = sessionRef.current;
    if (!current || current.status !== 'active' || dirty.current === acknowledged.current || conflict.current) return;
    const generation = dirty.current, snapshot = answersRef.current;
    const operation = (async () => {
      setSaveStatus('Đang lưu...');
      try {
        const update = await api<Omit<AttemptSession, 'questions'>>(`/attempts/${current.id}/answers`, 'PUT', { revision: current.revision, answers: snapshot });
        const next: AttemptSession = { ...update, questions: current.questions };
        if (!mounted.current) { sessionRef.current = next; acknowledged.current = generation; store(); return; }
        apply(next); acknowledged.current = generation; setSaveStatus(next.status === 'completed' ? 'Đã hết giờ và chấm điểm.' : 'Đã lưu trên server.');
        if (next.status === 'completed') await loadReview(next.id);
      } catch (e) {
        if (e instanceof CompetitionApiError && e.code === 'REVISION_CONFLICT') conflict.current = true;
        setSaveStatus('Chưa lưu được; câu trả lời đang giữ trên thiết bị.'); setError(e instanceof Error ? e.message : 'Không thể lưu.');
        throw e;
      } finally { pending.current = null; }
    })();
    pending.current = operation; return operation;
  }, [api, apply, loadReview, store]);
  const submit = useCallback(async () => {
    if (submission.current) return; submission.current = true; setBusy(true); setError('');
    try {
      if (pending.current) await pending.current;
      const current = sessionRef.current; if (!current || current.status !== 'active') return;
      const next = await api<AttemptSession>(`/attempts/${current.id}/submit`, 'POST', { revision: current.revision, answers: answersRef.current });
      apply(next); await loadReview(next.id);
    } catch (e) { setError(e instanceof Error ? e.message : 'Không thể nộp bài; thử lại khi kết nối trở lại.'); }
    finally { submission.current = false; setBusy(false); }
  }, [api, apply, loadReview]);
  useEffect(() => {
    if (session?.status !== 'active') return;
    const timer = setInterval(() => {
      const seconds = Math.max(0, Math.ceil((Date.parse(sessionRef.current?.deadline || '') - Date.now() - offset.current) / 1000)); setRemaining(seconds);
      if (seconds <= 0 && Date.now() >= expiryRetryAt.current) { expiryRetryAt.current = Date.now() + 10000; void submit(); }
    }, 1000);
    const autosave = setInterval(() => { if (!submission.current) void flush().catch(() => {}); }, 3000);
    const offline = () => setSaveStatus('Mất kết nối; giữ câu trả lời trên thiết bị và sẽ thử lưu lại.');
    const online = () => { if (Date.parse(sessionRef.current?.deadline || '') <= Date.now() + offset.current) void submit(); else void flush().catch(() => {}); };
    const unload = (event: BeforeUnloadEvent) => { store(); if (dirty.current !== acknowledged.current) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('offline', offline); window.addEventListener('online', online); window.addEventListener('beforeunload', unload);
    return () => { clearInterval(timer); clearInterval(autosave); window.removeEventListener('offline', offline); window.removeEventListener('online', online); window.removeEventListener('beforeunload', unload); };
  }, [session?.status, flush, submit, store]);
  const change = (id: string, value: AssessmentUserAnswer) => { answersRef.current = { ...answersRef.current, [id]: value }; dirty.current++; setAnswers(answersRef.current); store(); setSaveStatus('Đang chờ tự động lưu...'); };
  const hasAnswer = (answer?: AssessmentUserAnswer) => !!(answer?.selectedOptionId || answer?.textAnswer?.trim() || answer?.orderedTokenIds?.length || (answer?.pairMatches && Object.keys(answer.pairMatches).length));
  const answerAndNext = async () => {
    const current = sessionRef.current, question = current?.questions[index];
    if (answerInFlight.current || busy || conflict.current || submission.current || current?.status !== 'active' || !question || !hasAnswer(answersRef.current[question.id])) return;
    answerInFlight.current = true; setBusy(true); setError('');
    try {
      // Finish any older autosave, then save this answer before advancing.
      if (pending.current) await pending.current;
      await flush();
      if (mounted.current && sessionRef.current?.status === 'active') {
        setIndex(value => Math.min(value + 1, current.questions.length - 1));
        if (index === current.questions.length - 1) setNotice('Đã lưu câu cuối. Bấm Nộp bài để hoàn thành.');
      }
    } catch { /* flush keeps the answer locally and reports the error. */ }
    finally { answerInFlight.current = false; if (mounted.current) setBusy(false); }
  };
  useEffect(() => { document.querySelector('#ioe-violympic-student .competition-question-nav button[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest' }); }, [index]);
  const sync = async () => { const current = sessionRef.current; if (!current) return; const next = await api<AttemptSession>(`/attempts/${current.id}`); keepBackup(answersRef.current); apply(next, true); conflict.current = false; setError(''); setNotice('Đã đồng bộ với server và giữ bản sao câu trả lời trên thiết bị.'); if (next.status === 'completed') await loadReview(next.id); };
  const reset = () => {
    try { sessionStorage.removeItem(storageKeyRef.current); } catch { /* optional */ }
    run.current = null; sessionRef.current = null; setSession(null); setReview(null); setAnswers({}); answersRef.current = {};
    preparingId.current = crypto.randomUUID(); dirty.current = 0; acknowledged.current = 0; conflict.current = false;
    setError(''); setNotice(''); setIndex(0); setLocalBackup(null); setPaper(null); setLoading(true);
    void (async () => request<PublicPaper | BankTopic | MistakeTopic>(`/papers/${paperId}${access ? `?access=${encodeURIComponent(access)}` : ''}`, { headers: paperId?.startsWith('mistakes-') ? headers() : token ? { Authorization: `Bearer ${token}` } : {} }))().then(setPaper).catch(e => setError(e.message)).finally(() => setLoading(false));
  };
  return <main id="ioe-violympic-student" className="competition-root competition-page" data-student-module-theme="storybook"><div className="student-module-shell">
    <StudentModuleHeader title="IOE/Violympic" eyebrow="Sân chơi tri thức"><button type="button" onClick={() => onNavigate(session?.status === 'active' ? '/ioe-violympic' : '/')}>Về trang chủ</button><button type="button" onClick={() => onNavigate('/history')}>Lịch sử học tập</button></StudentModuleHeader>
    <div className="student-module-panel">
    {paperId && session?.status !== 'active' && <button type="button" onClick={() => onNavigate('/ioe-violympic')}>Về khu IOE/Violympic</button>}
    {loading && <p role="status">Đang tải...</p>}{error && <div role="alert" className="competition-error">{error}{session && <button type="button" disabled={busy} onClick={() => void sync().catch(e => setError(e.message))}>Tải lại câu trả lời từ server</button>}{session?.status === 'completed' && <button type="button" onClick={() => void loadReview(session.id).catch(e => setError(e.message))}>Tải lại lời giải</button>}</div>}
    {notice && <p role="status" className="competition-notice">{notice}</p>}
    {localBackup && <button type="button" onClick={() => { const url = URL.createObjectURL(new Blob([JSON.stringify({ title: session?.title || paper?.title, answers: localBackup }, null, 2)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = 'ioe-violympic-cau-tra-loi.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }}>Tải bản sao câu trả lời trên thiết bị</button>}
    {!loading && paperId && !paper && !session && error && <button type="button" onClick={reset}>Tải lại đề</button>}
    {!paperId && <StudentPortal topics={topics} papers={papers} loading={loading} failed={!!error} practice={practice} practiceLoading={practiceLoading} practiceError={practiceError}
      studentName={user?.name || name} onRefresh={() => setRefresh(value => value + 1)} onNavigate={onNavigate} />}
    {paper && !session && !immediateStart && <section className="competition-card"><h2>{paper.title}</h2><p>{paper.total} câu · {paper.durationMinutes} phút · Chấm điểm trên server</p>
      {'source' in paper && paper.source === 'bank' && <p role="status">{paper.available}/{paper.total} câu khác nhau trong kho chung. {paper.ready ? 'Mỗi lượt lấy bộ câu mới từ ngân hàng.' : `Còn thiếu ${paper.total - paper.available} câu để bắt đầu.`}</p>}
      {'source' in paper && paper.source === 'mistakes' && <p role="status">{paper.available} câu sai còn cần luyện trong nhóm này. {paper.ready ? `Lượt này luyện ${paper.total} câu; làm đúng để gỡ khỏi danh sách cần luyện.` : 'Em đã luyện hết câu sai trong nhóm này.'}</p>}
      {!user && <label>Tên học sinh theo hồ sơ của B<input maxLength={20} value={name} onChange={e => setName(e.target.value)} /></label>}
      <button type="button" className="competition-primary" disabled={busy || loading || ('ready' in paper && !paper.ready)} onClick={() => void prepare()}>Chuẩn bị bài</button>
    </section>}
    {immediateStart && !loading && (!session || session.status === 'prepared') && <section className="competition-card">{busy ? <p role="status">Đang mở bài thi…</p> : <>{!user && !getStoredGuestAccessCredential(getStoredGuestId()) && <label>Tên học sinh<input maxLength={20} value={name} onChange={e => setName(e.target.value)} /></label>}<button type="button" className="competition-primary" disabled={busy || authLoading} onClick={() => void prepare(true)}>Thi thử ngay</button></>}</section>}
    {session?.status === 'prepared' && !immediateStart && <section className="competition-card"><h2>{session.title}</h2><p>Đã chuẩn bị {session.questions.length} câu. Đồng hồ bắt đầu khi em bấm Bắt đầu.</p>
      <button type="button" className="competition-primary" disabled={busy} onClick={() => { setBusy(true); void api<AttemptSession>(`/attempts/${session.id}/activate`, 'POST', {}).then(next => apply(next, true)).catch(e => setError(e.message)).finally(() => setBusy(false)); }}>Bắt đầu</button><button type="button" disabled={busy} onClick={reset}>Chuẩn bị lượt mới</button></section>}
    {session?.status === 'active' && <>
      <header className="competition-player-header"><h2>{session.title}</h2><div className="competition-toolbar"><span className="competition-timer" aria-label="Thời gian còn lại">{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</span>
        <span>{Object.values<AssessmentUserAnswer>(answers).filter(a => a.selectedOptionId || a.textAnswer?.trim() || a.orderedTokenIds?.length || (a.pairMatches && Object.keys(a.pairMatches).length)).length}/{session.questions.length} câu đã trả lời</span>
        <button type="button" className="competition-primary" disabled={busy || conflict.current} onClick={() => void submit()}>Nộp bài</button><span role="status">{saveStatus}</span></div>
        <nav className="competition-question-nav" aria-label="Chuyển câu">{session.questions.map((q, i) => <button type="button" key={q.id} disabled={busy} aria-pressed={i === index} onClick={() => setIndex(i)} title={`Câu ${i + 1}`}>{i + 1}{answers[q.id] && Object.values(answers[q.id]).some(v => typeof v === 'string' ? v.trim() : v && Object.keys(v).length) ? ' ✓' : ''}</button>)}</nav>
      </header>
      {session.questions[index] && <QuestionView question={session.questions[index]} number={index + 1} answer={answers[session.questions[index].id]} onChange={a => change(session.questions[index].id, a)}
        onNext={() => void answerAndNext()} disabled={busy || conflict.current} />}
      {['choice', 'text-entry'].includes(session.questions[index]?.interaction) && <p>Nhập hoặc chọn đáp án rồi nhấn Enter để sang câu tiếp. Ở câu cuối, bấm Nộp bài.</p>}
      <div className="competition-toolbar competition-answer-navigation"><button type="button" disabled={busy || index === 0} onClick={() => setIndex(index - 1)}>Câu trước</button><button type="button" className="competition-primary" disabled={busy || conflict.current || !hasAnswer(answers[session.questions[index]?.id])} onClick={() => void answerAndNext()}>Trả Lời</button><button type="button" disabled={busy || index >= session.questions.length - 1} onClick={() => setIndex(index + 1)}>Câu tiếp</button><button type="button" disabled={busy} onClick={() => void flush().catch(() => {})}>Lưu ngay</button></div>
    </>}
    {session?.status === 'completed' && <><div className="competition-card"><h2>Đã hoàn thành bài</h2>{session.result && <p className="competition-score">{session.result.rawScore}/{session.result.maxScore} điểm · {session.result.score}%</p>}<p>Kết quả đã gắn vào lịch sử học sinh hiện có của B.</p><button type="button" onClick={reset}>Làm lại với lượt mới</button></div>{review ? <CompetitionReview {...review} /> : <button type="button" onClick={() => void loadReview(session.id).catch(e => setError(e.message))}>Xem lời giải</button>}</>}
  </div></div></main>;
}
