import { Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { useRef, useState, type CSSProperties } from 'react';

const clock = (seconds: number) => {
  const safe = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
};

// Remount per source so a new Part cannot inherit the previous clip's state.
export default function StarterAudioPlayer({ src }: { src: string }) {
  return <AudioClip key={src} src={src} />;
}

function AudioClip({ src }: { src: string; key?: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false), [pending, setPending] = useState(false);
  const [duration, setDuration] = useState(0), [position, setPosition] = useState(0);
  const [muted, setMuted] = useState(false), [volume, setVolume] = useState(1), [error, setError] = useState('');
  const updateDuration = () => setDuration(Number.isFinite(audio.current?.duration) ? audio.current!.duration : 0);
  const togglePlayback = async () => {
    const clip = audio.current;
    if (!clip || pending) return;
    if (!clip.paused) { clip.pause(); return; }
    setPending(true); setError('');
    try { if (clip.error) clip.load(); await clip.play(); }
    catch { setError('Không phát được bài nghe. Kiểm tra kết nối rồi bấm nghe lại.'); }
    finally { setPending(false); }
  };
  return <div className="starter-exam-audio" data-starter-audio>
    <audio ref={audio} src={src} preload="metadata" onLoadedMetadata={updateDuration} onDurationChange={updateDuration}
      onTimeUpdate={() => setPosition(audio.current?.currentTime || 0)} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
      onEnded={() => setPlaying(false)} onError={() => { setPlaying(false); setError('Không tải được bài nghe. Kiểm tra kết nối rồi bấm nghe lại.'); }}
      onVolumeChange={() => { setMuted(Boolean(audio.current?.muted)); setVolume(audio.current?.volume ?? 1); }} />
    <div className="starter-exam-audio-controls">
      <button className="starter-audio-play" type="button" aria-label={playing ? 'Tạm dừng bài nghe' : 'Phát bài nghe'} aria-pressed={playing} disabled={pending} onClick={() => void togglePlayback()}>
        {playing ? <Pause size={23} aria-hidden="true" /> : <Play size={23} aria-hidden="true" />}
      </button>
      <span className="starter-audio-time" aria-label={`Đã nghe ${clock(position)}, thời lượng ${clock(duration)}`}>{clock(position)} / {clock(duration)}</span>
      <input className="starter-audio-seek" type="range" min={0} max={duration || 1} step={.1} value={Math.min(position, duration || 1)} disabled={!duration}
        aria-label="Tua bài nghe" aria-valuetext={`${clock(position)} trên ${clock(duration)}`}
        style={{ '--starter-audio-progress': `${duration ? position / duration * 100 : 0}%` } as CSSProperties}
        onChange={event => { if (audio.current && duration) { const time = Number(event.target.value); audio.current.currentTime = time; setPosition(time); } }} />
      <button className="starter-audio-mute" type="button" aria-label={muted ? 'Bật tiếng bài nghe' : 'Tắt tiếng bài nghe'} aria-pressed={muted} onClick={() => { if (audio.current) audio.current.muted = !audio.current.muted; }}>
        {muted || volume === 0 ? <VolumeX size={24} aria-hidden="true" /> : <Volume2 size={24} aria-hidden="true" />}
      </button>
      <input className="starter-audio-volume" type="range" min={0} max={1} step={.05} value={muted ? 0 : volume} aria-label="Âm lượng bài nghe"
        onChange={event => { if (audio.current) { audio.current.volume = Number(event.target.value); audio.current.muted = false; } }} />
    </div>
    {error && <p className="starter-audio-error" role="alert">{error}</p>}
  </div>;
}
