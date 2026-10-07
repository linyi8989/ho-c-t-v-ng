import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getStoredGuestAccessCredential, getStoredGuestId } from '../../lib/guestIdentity';
import { buildLearningHistoryHeaders } from '../../lib/api/learningHistory';
import type { AttemptView, SpeakingReviewData, SpeakingSessionView } from '../../shared/speaking/types';
import { readingMetrics } from '../../shared/speaking/metrics';
import { stopManagedAudio } from '../../lib/game-engine/speech';
import './speaking.css';
function isSingleReadingReview(value: unknown): value is AttemptView {
  if (!value || typeof value !== 'object') return false;
  const v = value as AttemptView; return typeof v.id === 'string' && typeof v.lesson?.referenceText === 'string' && (v.status === 'completed' ? Number.isFinite(v.assessment?.score) && Array.isArray(v.assessment?.words) : ['queued', 'assessing', 'failed'].includes(v.status) && v.assessment === null);
}
function SingleReadingReview({ attempt }: { key?: string; attempt: AttemptView }) {
  const { user, token } = useAuth(), [audioUrl, setAudioUrl] = useState(''), [error, setError] = useState(''), [loading, setLoading] = useState(false), player = useRef<HTMLAudioElement>(null), segmentEnd = useRef<number | null>(null);
  const download = useRef<AbortController | null>(null);
  useEffect(() => () => { download.current?.abort(); player.current?.pause(); }, []);
  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);
  const playFull = () => {
    const audio = player.current; if (!audio) return;
    stopManagedAudio(); setError(''); segmentEnd.current = null;
    audio.muted = false; audio.volume = 1; audio.playbackRate = 1; audio.currentTime = 0;
    void audio.play().catch(e => {
      if (e?.name === 'AbortError') return;
      setError(e?.name === 'NotAllowedError' ? 'Trình duyệt chưa cho tự phát. Bấm Play trên thanh audio để nghe.' : 'Không phát được bản thu. Hãy tải bản thu để nghe hoặc tải lại audio.');
    });
  };
  useEffect(() => { if (audioUrl) playFull(); }, [audioUrl]);
  const loadAudio = async () => {
    if (download.current) return;
    if (audioUrl && !player.current?.error) { playFull(); return; }
    const controller = new AbortController(); download.current = controller; setLoading(true); setError('');
    try {
      const headers = buildLearningHistoryHeaders(user ? { authToken: token } : { guestCredential: getStoredGuestAccessCredential(getStoredGuestId()) });
      const response = await fetch(`/api/speaking/attempts/${attempt.id}/recording`, { headers, signal: controller.signal });
      if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || 'Không thể tải bản thu.'); }
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      if (!blob.type.startsWith('audio/') || blob.size <= 44) throw new Error('Dữ liệu bản thu không phải audio hợp lệ. Hãy tải lại bản thu.');
      setAudioUrl(URL.createObjectURL(blob));
    } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Không thể tải bản thu.'); }
    finally { if (!controller.signal.aborted) { download.current = null; setLoading(false); } }
  };
  const result = attempt.assessment;
  if (!result) return <section className="speaking-review speaking-card" aria-label="Trạng thái bản thu Speaking"><h2>{attempt.itemNumber ? `Mục ${attempt.itemNumber}: ${attempt.lesson.referenceText}` : attempt.lesson.title}</h2><p role="status">{attempt.status === 'failed' ? 'Chấm chưa thành công. Chưa có điểm cho bản thu này.' : attempt.status === 'assessing' ? 'Đang phân tích giọng đọc.' : 'Bản thu đã được lưu và đang đợi chấm.'}</p>{attempt.error && <p className="speaking-error">{attempt.error}</p>}<p>Kết quả các mục đã chấm được giữ nguyên. Em có thể tiếp tục luyện đọc trong bài học.</p>{attempt.audioAvailable && <button type="button" disabled={loading} onClick={() => void loadAudio()}>{loading ? 'Đang tải bản thu…' : 'Nghe lại bản thu'}</button>}{audioUrl && <><audio ref={player} controls src={audioUrl} aria-label="Bản thu của em" /><a href={audioUrl} download="speaking-recording.wav">Tải bản thu</a></>}{error && <p role="alert" className="speaking-error">{error}</p>}</section>;
  const metrics = readingMetrics(result, attempt.lesson.locale);
  const labels = { none: 'Đã đọc', mispronunciation: 'Cần luyện phát âm', omission: 'Bỏ từ', insertion: 'Đọc thêm / lặp' };
  return <section className="speaking-review speaking-card" aria-label="Kết quả Speaking">
    <h2>{attempt.itemNumber ? `Mục ${attempt.itemNumber}: ${attempt.lesson.referenceText}` : attempt.lesson.title}</h2><p className="speaking-score">{result.score}/100</p><p>{result.provider === 'azure' ? 'Azure Speech' : 'SpeechSuper'} · {attempt.lesson.locale} · rubric {result.rubricVersion}</p>
    <div className="speaking-grid">{metrics.map(({ id, label, value, emptyText, description }) => <div key={id} data-speaking-metric={id}><strong>{label}</strong><p>{value === null ? emptyText : `${value}/100`}</p>{description && <p>{description}</p>}</div>)}</div>
    <p><strong>Nội dung mẫu:</strong> {attempt.lesson.referenceText}</p><p><strong>Nhận dạng:</strong> {result.transcript || 'Không có bản chép lời'}</p>
    {result.warnings.map((warning, i) => <p className="speaking-alert" key={i}>{warning}</p>)}
    {attempt.audioAvailable && <button type="button" disabled={loading} onClick={() => void loadAudio()}>{loading ? 'Đang tải bản thu…' : 'Nghe lại bản thu'}</button>}
    {!attempt.audioAvailable && <p>Bản thu đã hết thời hạn nghe lại; kết quả vẫn được lưu.</p>}
    {audioUrl && <><audio ref={player} controls preload="auto" aria-label="Bản thu của em" src={audioUrl} onError={() => setError('Trình duyệt không phát được audio. Bấm Nghe lại bản thu để tải lại hoặc tải bản thu để nghe.')} onTimeUpdate={() => { if (player.current && segmentEnd.current !== null && player.current.currentTime >= segmentEnd.current) { player.current.pause(); segmentEnd.current = null; } }} /><a href={audioUrl} download="speaking-recording.wav">Tải bản thu</a></>}
    {error && <p className="speaking-error" role="alert">{error}</p>}
    <h3>Chi tiết từng từ và âm</h3><p>Điểm mỗi từ dùng để luyện tập; màu hoặc nhãn lỗi chưa được đối chiếu thành mức đạt của kỳ thi.</p>
    {result.words.map((word, index) => <details key={index}><summary><strong>{word.referenceIndex === null ? '+' : word.referenceIndex + 1}. {word.text}</strong> · {word.accuracy === null ? '—' : word.accuracy} · {labels[word.error]}</summary>
      {audioUrl && word.startMs !== null && word.durationMs !== null && <button type="button" onClick={() => { if (player.current) { player.current.currentTime = word.startMs! / 1000; segmentEnd.current = (word.startMs! + word.durationMs! + 150) / 1000; void player.current.play().catch(() => setError('Hãy bấm Play để nghe bản thu.')); } }}>Nghe đoạn từ này</button>}
      {word.phonemes.length ? <div className="speaking-table-wrap"><table className="speaking-table"><thead><tr><th>Âm</th><th>Điểm</th></tr></thead><tbody>{word.phonemes.map((ph, i) => <tr key={i}><td>/{ph.phone}/ ({ph.alphabet})</td><td>{ph.score}</td></tr>)}</tbody></table></div> : <p>{word.error === 'omission' ? 'Không có âm vì từ chưa được đọc.' : 'Dịch vụ chưa cung cấp chi tiết phoneme cho từ này.'}</p>}
    </details>)}
    <h3>Nhận xét và luyện tập</h3>
    {attempt.feedback ? <><p>{attempt.feedback.summary}</p>{attempt.feedback.holisticScore !== null && <p>Đánh giá tổng thể từ audio: {attempt.feedback.holisticScore}/100 (hiển thị riêng, không cộng vào điểm kỹ thuật).</p>}<h4>Điểm tốt</h4><ul>{attempt.feedback.strengths.map((v, i) => <li key={i}>{v}</li>)}</ul><h4>Cần cải thiện</h4><ul>{attempt.feedback.improvements.map((v, i) => <li key={i}>{v}</li>)}</ul><h4>Bài luyện tiếp</h4><ul>{attempt.feedback.practice.map((v, i) => <li key={i}>{v}</li>)}</ul></> : <p>{attempt.feedbackState === 'pending' ? 'AI đang viết nhận xét; điểm kỹ thuật đã hoàn tất.' : attempt.feedbackState === 'failed' ? 'AI chưa trả nhận xét. Điểm kỹ thuật vẫn được giữ.' : 'Hãy nghe mẫu, đọc lại các từ bị bỏ hoặc có điểm thấp, rồi thu lượt mới.'}</p>}
  </section>;
}

function isSessionReview(value: unknown): value is SpeakingSessionView {
  if (!value || typeof value !== 'object') return false;
  const session = value as SpeakingSessionView;
  return session.reviewType === 'speaking-session-v1' && typeof session.id === 'string' && Array.isArray(session.items) && session.items.length > 0 && typeof session.lesson?.title === 'string';
}
export function isSpeakingReview(value: unknown): value is SpeakingReviewData { return isSingleReadingReview(value) || isSessionReview(value); }
function SessionReview({ session }: { session: SpeakingSessionView }) {
  const [selected, setSelected] = useState(session.items.findIndex(item => item.score !== null));
  useEffect(() => setSelected(session.items.findIndex(item => item.score !== null)), [session.id]);
  const attempt = session.items[selected]?.attempt;
  return <section className="speaking-review speaking-card" aria-label="Kết quả bộ Speaking"><h2>{session.lesson.title}</h2><p>Đã chấm {session.completedCount}/{session.totalItems} mục.</p>{session.score !== null && <p className="speaking-score">Điểm trung bình các mục: {session.score}/100</p>}<p>Mỗi mục giữ điểm chấm riêng. Lượt luyện lại tạo kết quả mới và giữ nguyên lượt đã hoàn thành.</p><div className="speaking-table-wrap"><table className="speaking-table speaking-set-review-table"><thead><tr><th>Mục</th><th>Nội dung</th><th>Điểm</th><th>Kết quả riêng</th></tr></thead><tbody>{session.items.map((entry, index) => <tr key={entry.item.id}><td>{index + 1}</td><td>{entry.item.referenceText}</td><td>{entry.score === null ? 'Chưa chấm' : `${entry.score}/100`}</td><td><button type="button" className={selected === index ? 'speaking-primary' : ''} disabled={!entry.attempt?.assessment} aria-pressed={selected === index} onClick={() => setSelected(index)}>Xem mục {index + 1}</button></td></tr>)}</tbody></table></div>{attempt?.assessment && <SingleReadingReview key={attempt.id} attempt={attempt} />}</section>;
}
export default function SpeakingReview({ attempt }: { attempt: SpeakingReviewData }) { return isSessionReview(attempt) ? <SessionReview session={attempt} /> : <SingleReadingReview key={attempt.id} attempt={attempt} />; }
