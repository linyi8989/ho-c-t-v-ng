import { Pause, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

let activePreview: HTMLAudioElement | null = null;

interface Props {
  src?: string;
  compact?: boolean;
  className?: string;
}

export default function AudioPreviewButton({ src, compact = false, className = '' }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    setPlaying(false);
    setFailed(false);
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    if (activePreview === audio) activePreview = null;
    return () => {
      audio.pause();
      if (activePreview === audio) activePreview = null;
    };
  }, [src]);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!src || !audio) return;
    setFailed(false);
    if (!audio.paused) {
      audio.pause();
      return;
    }
    if (activePreview && activePreview !== audio) activePreview.pause();
    activePreview = audio;
    try {
      await audio.play();
    } catch {
      if (activePreview === audio) activePreview = null;
      setPlaying(false);
      setFailed(true);
    }
  };

  const label = playing ? 'Tạm dừng nghe thử audio' : 'Nghe thử audio đã chọn';
  return <>
    <button
      type="button"
      disabled={!src}
      onClick={() => void toggle()}
      aria-label={label}
      title={!src ? 'Hãy tải lên hoặc chọn audio trước' : failed ? 'Không phát được audio này' : label}
      data-audio-preview-button
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-indigo-300 bg-indigo-700 font-black text-white shadow-sm transition hover:bg-indigo-800 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-500 ${compact ? 'px-3 py-1.5 text-[10px]' : 'px-3 py-2 text-xs'} ${className}`}
    >
      {playing ? <Pause size={compact ? 13 : 15} /> : <Play size={compact ? 13 : 15} />}
      {playing ? 'Dừng' : 'Nghe thử'}
    </button>
    <audio
      ref={audioRef}
      src={src}
      preload="metadata"
      onPlay={() => { setFailed(false); setPlaying(true); }}
      onPause={() => {
        setPlaying(false);
        if (activePreview === audioRef.current) activePreview = null;
      }}
      onEnded={() => {
        setPlaying(false);
        if (activePreview === audioRef.current) activePreview = null;
      }}
      onError={() => {
        setPlaying(false);
        setFailed(true);
        if (activePreview === audioRef.current) activePreview = null;
      }}
      className="hidden"
    />
  </>;
}
