import React from 'react';
import { ArrowUp, Square, X } from 'lucide-react';
import './recording-bar.css';

export default function RecordingBar({ waveform, level, seconds, onCancel, onStop }: { waveform: number[]; level: number; seconds: number; onCancel: () => void; onStop: () => void }) {
  const bars = [...Array<number>(64 - waveform.length).fill(0), ...waveform];
  const elapsed = `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
  return <div className="speaking-recording-controls">
    <div className="speaking-recording-bar" role="group" aria-label="Điều khiển thu âm">
      <button type="button" className="speaking-recording-icon" aria-label="Hủy bản thu" title="Hủy bản thu" onClick={onCancel}><X size={21} aria-hidden="true" /></button>
      <div className="speaking-waveform" role="meter" aria-label="Mức tín hiệu micro" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)} aria-valuetext={level > .15 ? 'Micro đang nhận âm thanh' : 'Chưa nhận tiếng rõ'} data-microphone-level={level}>
        <svg viewBox="0 0 512 48" preserveAspectRatio="none" aria-hidden="true">{bars.map((value, index) => { const height = 2 + value * 38; return <line key={index} x1={index * 8 + 4} x2={index * 8 + 4} y1={24 - height / 2} y2={24 + height / 2} />; })}</svg>
      </div>
      <time className="speaking-recording-time" aria-label={`Đã thu ${Math.floor(seconds)} giây`}>{elapsed}</time>
      <button type="button" className="speaking-recording-icon speaking-recording-stop" data-speaking-record data-recording="true" aria-label="Dừng thu" title="Dừng thu và tự gửi chấm" onClick={onStop}><Square size={15} fill="currentColor" aria-hidden="true" /></button>
      <button type="button" className="speaking-recording-icon speaking-recording-send" aria-label="Gửi bản thu" title="Dừng và gửi bản thu" onClick={onStop}><ArrowUp size={23} aria-hidden="true" /></button>
    </div>
    <p className="speaking-recording-status" role="status">Đang thu âm…</p>
  </div>;
}
