import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { buildLearningHistoryHeaders } from '../../lib/api/learningHistory';
import { getOrCreateLearningGuest, getStoredGuestId, getStoredGuestAccessCredential, storeGuestAccessCredential, STUDENT_NAME_STORAGE_KEY } from '../../lib/guestIdentity';
import { validateStudentDisplayName } from '../../lib/studentIdentity';
import { stopManagedAudio } from '../../lib/game-engine/speech';
import { KIND_LABELS, isSetLesson, lessonItems, type AttemptView, type Capabilities, type PublicLesson, type SpeakingSessionView } from '../../shared/speaking/types';
import { request } from './api';
import { useRecorder } from './useRecorder';
import { prepareRecordingAttempt, type RecordingRun } from './recordingAttempt';
import SpeakingReview from './Review';
import SampleAudio from './SampleAudio';
import RecordingBar from './RecordingBar';
import './speaking.css';
import { BookOpen, Mic } from 'lucide-react';
import StudentModuleHeader from '../../components/student/StudentModuleHeader';
type StudentApi = <T,>(path: string, method?: string, body?: unknown) => Promise<T>;
export function SpeakingEntry({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [capability, setCapability] = useState<Capabilities | null>(null);
  useEffect(() => { const c = new AbortController(); void request<Capabilities>('/capabilities', { signal: c.signal }).then(setCapability).catch(() => {}); return () => c.abort(); }, []);
  return capability?.enabled ? <section id="home-speaking-entry" className="speaking-card"><h2>Speaking / Luyện đọc</h2><p>Nghe mẫu, đọc từng từ/câu hoặc bài hội thoại/đoạn văn. Tiến độ và kết quả lưu trong lịch sử học tập.</p><button className="speaking-primary" type="button" onClick={() => onNavigate('/speaking')}>Mở Speaking</button></section> : null;
}
function ReadingTurn({ lesson, capability, identity, api, headers, ensureIdentity, sessionId, itemId, initialAttempt = null, onAttempt, onLock }: { lesson: PublicLesson; capability: Capabilities | null; identity: string; api: StudentApi; headers: () => Record<string, string>; ensureIdentity: () => Promise<void>; sessionId?: string; itemId?: string; initialAttempt?: AttemptView | null; onAttempt?: (attempt: AttemptView) => void; onLock?: (locked: boolean) => void }) {
  const [attempt, setAttempt] = useState<AttemptView | null>(initialAttempt), [error, setError] = useState(''), [busy, setBusy] = useState(false), [uploadFailed, setUploadFailed] = useState(false), [previewUrl, setPreviewUrl] = useState('');
  const recorder = useRecorder(attempt?.lesson.maxSeconds || lesson.maxSeconds, identity), run = useRef<RecordingRun>({ clientRunId: crypto.randomUUID(), renewingAttemptId: null }), alive = useRef(true), operation = useRef(false), autoSent = useRef<Blob | null>(null), callbacks = useRef({ onAttempt, onLock }); callbacks.current = { onAttempt, onLock };
  const storageKey = `speaking:${lesson.id}:${identity}`, current = attempt?.lesson || lesson, configured = capability?.providers.find(p => p.id === current.provider)?.configured;
  const apply = (data: AttemptView) => { if (!alive.current) return; setAttempt(data); callbacks.current.onAttempt?.(data); };
  useEffect(() => { alive.current = true; if (!sessionId) { const saved = sessionStorage.getItem(storageKey); if (saved) { try { const value = JSON.parse(saved); if (typeof value.runId === 'string') run.current.clientRunId = value.runId; if (typeof value.id === 'string') void api<AttemptView>(`/attempts/${value.id}`).then(data => { if (alive.current) setAttempt(data); }).catch(e => { if (alive.current) setError(e.message); }); } catch { setError('Không đọc được lượt lưu trên thiết bị. Có thể mở lượt mới.'); } } } return () => { alive.current = false; callbacks.current.onLock?.(false); }; }, [storageKey, api, sessionId]);
  useEffect(() => { if (!recorder.blob) { setPreviewUrl(''); return; } const url = URL.createObjectURL(recorder.blob); setPreviewUrl(url); return () => URL.revokeObjectURL(url); }, [recorder.blob]);
  const expired = attempt?.status === 'prepared' && attempt.recordingAllowed === false;
  const locked = busy || recorder.recording || recorder.starting || Boolean(recorder.blob && attempt?.status === 'prepared');
  useEffect(() => { callbacks.current.onLock?.(locked); }, [locked]);
  useEffect(() => { if (!attempt || !['queued', 'assessing'].includes(attempt.status) && attempt.feedbackState !== 'pending') return;
    let cancelled = false, pending = false; const timer = setInterval(() => { if (pending) return; pending = true; void api<AttemptView>(`/attempts/${attempt.id}`).then(data => { if (!cancelled) { apply(data); setError(''); } }).catch(e => { if (!cancelled) setError(e.message); }).finally(() => { pending = false; }); }, 2000); return () => { cancelled = true; clearInterval(timer); };
  }, [attempt?.id, attempt?.status, attempt?.feedbackState, api]);
  const flashcard = current.kind === 'word' || current.kind === 'sentence';
  const perform = async (work: () => Promise<void>) => { if (operation.current) return; operation.current = true; setBusy(true); setError(''); try { await work(); } catch (e) { if (alive.current) setError(e instanceof Error ? e.message : 'Không thể xử lý.'); } finally { operation.current = false; if (alive.current) setBusy(false); } };
  const readyAttempt = async () => {
    await ensureIdentity();
    const prepared = await prepareRecordingAttempt(attempt, run.current, {
      resume: id => api<AttemptView>(`/attempts/${id}`),
      prepare: clientRunId => api<AttemptView>('/attempts/prepare', 'POST', { lessonId: lesson.id, clientRunId, ...(sessionId ? { sessionId, itemId } : {}) }),
    });
    apply(prepared);
    if (!sessionId) sessionStorage.setItem(storageKey, JSON.stringify({ id: prepared.id, runId: run.current.clientRunId }));
    return prepared.status === 'prepared' && prepared.recordingAllowed !== false;
  };
  const startRecording = () => perform(async () => { stopManagedAudio(); if (await readyAttempt() && alive.current) { setUploadFailed(false); await recorder.start(); } });
  const prepare = () => perform(async () => { const ready = await readyAttempt(); if (sessionId && ready && alive.current) { stopManagedAudio(); await recorder.start(); } });
  const submit = () => perform(async () => {
    if (!attempt || !recorder.blob || attempt.status !== 'prepared') return;
    setUploadFailed(false);
    try {
      const response = await request<AttemptView>(`/attempts/${attempt.id}/audio`, { method: 'POST', headers: { ...headers(), 'Content-Type': 'audio/wav', 'X-Attempt-Ticket': attempt.ticket! }, body: recorder.blob });
      apply(response); recorder.clear();
    } catch (e) { if (alive.current) setUploadFailed(true); throw e; }
  });
  // A completed, validated recording is uploaded once. A failed upload retains
  // the same bytes/ticket for explicit retry; renders/polling never resend it.
  useEffect(() => {
    if (!recorder.blob || recorder.recording || recorder.starting || busy || !configured || attempt?.status !== 'prepared' || autoSent.current === recorder.blob) return;
    autoSent.current = recorder.blob; void submit();
  }, [recorder.blob, recorder.recording, recorder.starting, busy, configured, attempt?.id, attempt?.status]);
  return <><section className={`speaking-card speaking-turn${flashcard ? ' speaking-flashcard' : ''}`} data-reading-card={flashcard ? 'true' : undefined} aria-label={flashcard ? 'Thẻ luyện đọc' : undefined}>
    <header className="speaking-turn-heading"><h2>{sessionId ? 'Đọc thành tiếng' : current.title}</h2><p>{KIND_LABELS[current.kind]} · {current.locale} · Tối đa {current.maxSeconds} giây</p></header>
    {current.instructions && <p>{current.instructions}</p>}{current.partnerText && <p>Vai đối thoại: {current.partnerText}</p>}<p className="speaking-reference">{current.referenceText}</p>
    <SampleAudio text={current.referenceText} locale={current.locale} url={current.sampleAudioUrl} rate={current.samplePlaybackRate} disabled={recorder.recording || recorder.starting} compact />
    {error && <p role="alert" className="speaking-error">{error}</p>}{!configured && <p className="speaking-alert">Chưa cấu hình {current.provider === 'azure' ? 'Azure Speech' : 'SpeechSuper'}. Em có thể nghe mẫu và thu thử; gửi chấm mở sau khi cấu hình dịch vụ.</p>}
    {!attempt && <button type="button" className="speaking-primary" disabled={busy} onClick={() => void prepare()}>{sessionId ? 'Thu âm' : 'Bắt đầu lượt đọc'}</button>}
    {attempt?.status === 'prepared' && <>{recorder.recording ? <RecordingBar waveform={recorder.waveform} level={recorder.level} seconds={recorder.seconds} onCancel={() => { recorder.cancel(); setUploadFailed(false); setError(''); }} onStop={() => void recorder.stop()} /> : <><p role="status">{busy && recorder.blob ? 'Đang gửi bản thu để chấm…' : recorder.blob && uploadFailed ? 'Bản thu vẫn được giữ. Em có thể gửi lại hoặc thu mới.' : 'Bấm Thu âm để đọc. Dừng thu hoặc hết thời gian sẽ tự gửi chấm.'}</p><div className="speaking-actions">
      <button type="button" className="speaking-primary" data-speaking-record disabled={busy || recorder.starting} onClick={() => void startRecording()}>{recorder.starting ? 'Đang mở micro…' : recorder.blob ? 'Thu lại' : 'Thu âm'}</button>
      {(uploadFailed || !configured) && <button type="button" disabled={busy || recorder.recording || !recorder.blob || !configured} onClick={() => void submit()}>{uploadFailed ? 'Gửi lại bản thu' : 'Gửi chấm'}</button>}
      {recorder.blob && <button type="button" disabled={busy} onClick={() => { recorder.clear(); setUploadFailed(false); setError(''); }}>Bỏ bản thu</button>}</div></>}{recorder.error && <p role="alert" className="speaking-error">{recorder.error}</p>}{previewUrl && <><audio controls src={previewUrl} /><a href={previewUrl} download="speaking-recording.wav">Tải bản thu</a></>}</>}
    {attempt && ['queued', 'assessing'].includes(attempt.status) && <p className="speaking-waiting" role="status">{attempt.status === 'queued' ? attempt.queueState === 'waiting' ? 'Đã lưu bản thu vào kho chờ; sẽ tự chấm khi đến lượt.' : 'Đã nhận bản thu, đang đợi chấm…' : 'Đang phân tích giọng đọc…'} Em có thể làm mục tiếp theo hoặc quay lại sau. Trạng thái và lỗi chấm được lưu trong lịch sử học tập.</p>}
    {attempt?.status === 'failed' && <p className="speaking-error">{attempt.error}</p>}
    {expired && <p>Bấm Thu âm để mở lượt thu mới. Các mục đã chấm được giữ nguyên.</p>}
    {attempt?.assessment && <p className="speaking-score" role="status">{attempt.assessment.score}/100</p>}
    {attempt && ['completed', 'failed'].includes(attempt.status) && <div className="speaking-actions speaking-result-actions">
      {attempt.status === 'failed' && <button type="button" disabled={busy || !configured} onClick={() => void perform(async () => apply(await request<AttemptView>(`/attempts/${attempt.id}/retry`, { method: 'POST', headers: { ...headers(), 'X-Attempt-Ticket': attempt.ticket! } })))}>Yêu cầu chấm lại bản thu</button>}
      <button type="button" disabled={busy || recorder.recording || recorder.starting} onClick={() => { if (!sessionId) sessionStorage.removeItem(storageKey); run.current = { clientRunId: crypto.randomUUID(), renewingAttemptId: null }; setAttempt(null); setError(''); setUploadFailed(false); recorder.clear(); }}>Đọc lượt mới</button>
    </div>}
  </section>{attempt?.assessment && (flashcard ? <details className="speaking-card speaking-card-detail"><summary>Xem nhận xét và chi tiết phát âm</summary><SpeakingReview attempt={attempt} /></details> : <SpeakingReview attempt={attempt} />)}</>;
}
export default function SpeakingStudent({ lessonId, onNavigate }: { lessonId?: string; onNavigate: (path: string) => void }) {
  const { user, token } = useAuth(), [capability, setCapability] = useState<Capabilities | null>(null), [lessons, setLessons] = useState<PublicLesson[]>([]), [lesson, setLesson] = useState<PublicLesson | null>(null), [session, setSession] = useState<SpeakingSessionView | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [locked, setLocked] = useState(false), [selected, setSelected] = useState(0), [practiceIds, setPracticeIds] = useState<string[]>([]);
  const [grade, setGrade] = useState(''), [kind, setKind] = useState(''), [search, setSearch] = useState(''), [catalogPage, setCatalogPage] = useState(1), [catalogTotal, setCatalogTotal] = useState(0), [name, setName] = useState(() => localStorage.getItem(STUDENT_NAME_STORAGE_KEY) || '');
  const [guestId] = useState(() => getOrCreateLearningGuest().guestId);
  const identity = user?.id || guestId, actor = useRef({ user, token }); actor.current = { user, token };
  const pendingSession = useRef<{ key: string; clientRunId: string } | null>(null);
  const headers = useCallback(() => buildLearningHistoryHeaders(actor.current.user ? { authToken: actor.current.token } : { guestCredential: getStoredGuestAccessCredential(getStoredGuestId()) }), []);
  const api: StudentApi = useCallback(<T,>(path: string, method = 'GET', body?: unknown) => request<T>(path, { method, headers: { ...headers(), 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), [headers]);
  const ensureIdentity = async () => { if (user) return; const guest = getOrCreateLearningGuest(); if (!getStoredGuestAccessCredential(guest.guestId)) { const validated = validateStudentDisplayName(name); if (!validated.valid) throw new Error(validated.error); const response = await fetch('/api/guest-profiles/resolve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ guestId: guest.guestId, displayName: validated.value }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Không thể xác minh học sinh.'); if (!data.guestAccessToken || !storeGuestAccessCredential(data.guestId || guest.guestId, data.guestAccessToken, data.guestAccessTokenVersion)) throw new Error('Không lưu được phiên học sinh. Kiểm tra quyền lưu trữ của trình duyệt.'); localStorage.setItem(STUDENT_NAME_STORAGE_KEY, validated.value); } };
  useEffect(() => { const c = new AbortController(); setError(''); setSession(null); setLesson(null); setSelected(0); setPracticeIds([]); setLocked(false);
    void (async () => { const caps = await request<Capabilities>('/capabilities', { signal: c.signal }); if (!caps.enabled) throw new Error(caps.reason); if (!c.signal.aborted) setCapability(caps);
      if (lessonId) {
        const saved = actor.current.user || getStoredGuestAccessCredential(getStoredGuestId()) ? await api<SpeakingSessionView | null>(`/sessions/latest?lessonId=${encodeURIComponent(lessonId)}`) : null;
        const data = saved?.lesson || await request<PublicLesson>(`/lessons/${lessonId}`, { signal: c.signal });
        if (!c.signal.aborted) { setLesson(data); if (saved) { setSession(saved); const next = saved.items.findIndex(i => i.score === null); setSelected(next < 0 ? 0 : next); } }
      } else { const data = await request<{ items: PublicLesson[]; total: number }>(`/lessons-page?${new URLSearchParams({ grade, kind, search, page: String(catalogPage) })}`, { signal: c.signal }); if (!c.signal.aborted) { setLessons(data.items); setCatalogTotal(data.total); } }
    })().catch(e => { if (!c.signal.aborted) setError(e instanceof Error ? e.message : 'Không thể tải Speaking.'); }); return () => c.abort();
  }, [lessonId, identity, grade, kind, search, catalogPage, api]);
  const beginSession = async (itemIds?: string[]) => { if (busy || locked || !lesson) return; setBusy(true); setError(''); try { await ensureIdentity(); const key = JSON.stringify({ lessonId, sourceSessionId: itemIds ? session?.id : undefined, itemIds }); if (pendingSession.current?.key !== key) pendingSession.current = { key, clientRunId: crypto.randomUUID() }; const next = await api<SpeakingSessionView>('/sessions/prepare', 'POST', { lessonId, clientRunId: pendingSession.current.clientRunId, ...(itemIds ? { sourceSessionId: session?.id, itemIds } : {}) }); pendingSession.current = null; setSession(next); setSelected(0); setPracticeIds([]); } catch (e) { setError(e instanceof Error ? e.message : 'Không mở được bộ luyện đọc.'); } finally { setBusy(false); } };
  const refreshSession = async (attempt: AttemptView) => { if (!session || attempt.sessionId !== session.id) return; const id = session.id; setSession(current => current?.id === id ? { ...current, items: current.items.map(entry => entry.item.id === attempt.itemId ? { ...entry, attempt } : entry) } : current); if (attempt.status === 'completed') { try { const updated = await api<SpeakingSessionView>(`/sessions/${id}`); setSession(current => current?.id === id ? updated : current); } catch (e) { setError(e instanceof Error ? e.message : 'Không tải được tiến độ.'); } } };
  const pendingFeedback = session?.items.some(entry => entry.attempt && (['queued', 'assessing'].includes(entry.attempt.status) || entry.attempt.feedbackState === 'pending'));
  useEffect(() => {
    if (!session || !pendingFeedback) return;
    const id = session.id; let cancelled = false, pending = false;
    const timer = setInterval(() => { if (pending) return; pending = true; void api<SpeakingSessionView>(`/sessions/${id}`).then(updated => { if (!cancelled) setSession(current => current?.id === id ? updated : current); }).catch(e => { if (!cancelled) setError(e.message); }).finally(() => { pending = false; }); }, 2000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [session?.id, pendingFeedback, api]);
  const active = session?.items[selected], current = session?.lesson || lesson;
  useEffect(() => {
    if (!locked) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [locked]);
  const selectedLesson = active && current ? { ...current, referenceText: active.item.referenceText, sampleAudioUrl: active.item.sampleAudioUrl, samplePlaybackRate: active.item.samplePlaybackRate, items: undefined } : null;
  return <main id="speaking-student" data-student-module-theme="storybook"><div className="student-module-shell"><StudentModuleHeader title="Speaking / Luyện đọc" eyebrow="Nghe mẫu · Đọc tự tin" speaking><button type="button" disabled={locked} onClick={() => onNavigate('/')}>Trang chủ</button><button type="button" disabled={locked} onClick={() => onNavigate('/history')}>Lịch sử học tập</button>{lessonId && <button type="button" disabled={locked} onClick={() => onNavigate('/speaking')}>Danh sách bài</button>}</StudentModuleHeader><div className="student-module-panel">{error && <p role="alert" className="speaking-error">{error}</p>}
    {!lessonId ? <><div className="speaking-catalog-intro"><span className="speaking-catalog-icon" aria-hidden="true"><Mic size={30} /></span><div><h2>Cùng luyện nói tiếng Anh</h2><p>Chọn một bài học, nghe mẫu rồi đọc theo cách của em.</p></div></div><div className="speaking-grid speaking-form speaking-catalog-filters"><label>Tìm bài<input type="search" maxLength={200} value={search} onChange={e => { setSearch(e.target.value); setCatalogPage(1); }} /></label><label>Lớp<select value={grade} onChange={e => { setGrade(e.target.value); setCatalogPage(1); }}><option value="">Tất cả lớp</option>{Array.from({ length: 9 }, (_, i) => <option key={i} value={i + 1}>Lớp {i + 1}</option>)}</select></label><label>Dạng bài<select value={kind} onChange={e => { setKind(e.target.value); setCatalogPage(1); }}><option value="">Tất cả dạng bài</option>{Object.entries(KIND_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label></div>{!capability && !error && <p className="student-module-status" role="status">Đang tải bài luyện đọc…</p>}{!lessons.length && capability && <p className="student-module-status">Chưa có bài đã xuất bản. Giáo viên có thể tạo bài trong dashboard.</p>}<div className="speaking-lesson-grid">{lessons.map(item => <article key={item.id} className="speaking-card speaking-lesson-card"><span className="speaking-lesson-icon" aria-hidden="true"><BookOpen size={26} /></span><h2>{item.title}</h2><p>{KIND_LABELS[item.kind]} · {lessonItems(item).length} mục · Lớp {item.grade} · {item.locale}</p><button type="button" className="speaking-primary" onClick={() => onNavigate(`/speaking/lesson/${item.id}`)}>Luyện đọc</button></article>)}</div><div className="speaking-actions speaking-catalog-pagination"><button type="button" disabled={catalogPage <= 1} onClick={() => setCatalogPage(p => p - 1)}>Trang trước</button><span>Trang {catalogPage} · {catalogTotal} bài</span><button type="button" disabled={catalogPage * 30 >= catalogTotal} onClick={() => setCatalogPage(p => p + 1)}>Trang sau</button></div></> : current && <>
      {!user && !session && <div className="speaking-form speaking-student-name"><label>Tên học sinh<input value={name} onChange={e => setName(e.target.value)} maxLength={120} autoComplete="name" /></label></div>}
      {isSetLesson(current) ? <><section className="speaking-deck-heading"><h2>{current.title}</h2><p>{KIND_LABELS[current.kind]} · {lessonItems(current).length} mục · Lớp {current.grade}</p>{!session ? <><p>Nghe và đọc từng thẻ. Tiến độ được lưu để em tiếp tục khi quay lại.</p><button type="button" disabled={busy} className="speaking-primary" onClick={() => void beginSession()}>Bắt đầu bộ luyện đọc</button></> : <><div className="speaking-deck-progress"><p role="status">Đã chấm {session.completedCount}/{session.totalItems} mục{session.status === 'completed' ? ' · Đã hoàn thành bộ' : ` · Thẻ ${selected + 1}/${session.totalItems}`}</p><span>{Math.round(session.completedCount / session.totalItems * 100)}% hoàn thành</span></div><progress aria-label="Tiến độ bộ luyện đọc" max={session.totalItems} value={session.completedCount} /></>}
      </section>{session?.status === 'in_progress' && selectedLesson && active && <div className="speaking-deck"><React.Fragment key={`${session.id}:${active.item.id}`}><ReadingTurn lesson={selectedLesson} capability={capability} identity={identity} api={api} headers={headers} ensureIdentity={ensureIdentity} sessionId={session.id} itemId={active.item.id} initialAttempt={active.attempt} onAttempt={data => void refreshSession(data)} onLock={setLocked} /></React.Fragment>
        <nav className="speaking-actions speaking-deck-navigation" aria-label="Chuyển thẻ luyện đọc"><button type="button" disabled={locked || selected <= 0} onClick={() => setSelected(i => i - 1)}>Mục trước</button><span>Thẻ {selected + 1} / {session.totalItems}</span><button type="button" disabled={locked || selected >= session.totalItems - 1} onClick={() => setSelected(i => i + 1)}>Mục tiếp theo</button></nav>
      </div>}
      {session?.status === 'completed' && <><SpeakingReview attempt={session} /><section className="speaking-card speaking-form"><h3>Luyện lại</h3><p>Chọn những mục em muốn luyện thêm. Kết quả vừa hoàn thành được giữ nguyên.</p>{session.items.map(entry => <label key={entry.item.id}><span><input type="checkbox" checked={practiceIds.includes(entry.item.id)} onChange={e => setPracticeIds(ids => e.target.checked ? [...ids, entry.item.id] : ids.filter(id => id !== entry.item.id))} /> {entry.item.referenceText} · {entry.score}/100</span></label>)}<div className="speaking-actions"><button type="button" disabled={busy || !practiceIds.length} onClick={() => void beginSession(practiceIds)}>Luyện lại mục được chọn</button><button type="button" disabled={busy} onClick={() => void beginSession()}>Luyện toàn bộ lượt mới</button></div></section></>}
      </> : <React.Fragment key={`${current.id}:${identity}`}><ReadingTurn lesson={current} capability={capability} identity={identity} api={api} headers={headers} ensureIdentity={ensureIdentity} onLock={setLocked} /></React.Fragment>}
    </>}
  </div></div></main>;
}
