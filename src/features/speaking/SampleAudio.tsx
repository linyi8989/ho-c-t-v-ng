import React, { useEffect, useRef, useState } from 'react';
import { stopManagedAudio } from '../../lib/game-engine/speech';
import { Volume2 } from 'lucide-react';

export default function SampleAudio({ text, locale, url, rate = 1, disabled = false, compact = false }: { text: string; locale: string; url: string; rate?: number; disabled?: boolean; compact?: boolean }) {
  const player = useRef<HTMLAudioElement>(null), [error, setError] = useState('');
  const supported = typeof window !== 'undefined' && Boolean(window.speechSynthesis) && typeof SpeechSynthesisUtterance !== 'undefined';
  useEffect(() => { if (disabled) { player.current?.pause(); stopManagedAudio(); } }, [disabled]);
  useEffect(() => () => { player.current?.pause(); stopManagedAudio(); }, [text, url]);
  if (url) return <audio ref={player} controls src={url} onPlay={() => { if (disabled) player.current?.pause(); else { stopManagedAudio(); if (player.current) player.current.playbackRate = rate; } }} />;
  return <div className={`speaking-device-sample${compact ? ' speaking-device-sample-compact' : ''}`}><button type="button" aria-label={compact ? 'Nghe phát âm mẫu' : undefined} title={compact ? 'Nghe phát âm mẫu' : undefined} disabled={disabled || !text.trim() || !supported} onClick={() => {
    setError(''); stopManagedAudio();
    const utterance = new SpeechSynthesisUtterance(text); utterance.lang = locale; utterance.rate = 1;
    const voice = window.speechSynthesis.getVoices().find(v => v.lang.toLowerCase() === locale.toLowerCase()); if (voice) utterance.voice = voice;
    utterance.onerror = event => { if (!['canceled', 'interrupted'].includes(event.error)) setError('Thiết bị chưa có giọng đọc phù hợp. Có thể dùng audio mẫu đã lưu của B.'); };
    window.speechSynthesis.speak(utterance);
  }}>{compact ? <Volume2 size={25} aria-hidden="true" /> : 'Nghe mẫu trên thiết bị'}</button>{(!compact || !supported) && <p>{supported ? 'Giọng đọc của trình duyệt/thiết bị; không tạo hoặc lưu file audio mẫu.' : 'Trình duyệt chưa hỗ trợ giọng đọc trên thiết bị. Có thể dùng audio mẫu đã có.'}</p>}{error && <p role="alert" className="speaking-error">{error}</p>}</div>;
}
