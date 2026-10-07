import { useCallback, useEffect, useRef, useState } from 'react';
import { encodeWav, PcmResampler } from './audio';
import { MIN_SIGNAL_SECONDS } from '../../shared/speaking/audioQuality';
const MICROPHONE_KEY = 'speaking-microphone';
export function useRecorder(maxSeconds: number, identity = '') {
  const [recording, setRecording] = useState(false), [seconds, setSeconds] = useState(0), [blob, setBlob] = useState<Blob | null>(null), [error, setError] = useState(''), [starting, setStarting] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]), [deviceId, selectDevice] = useState(() => { try { return localStorage.getItem(MICROPHONE_KEY) || ''; } catch { return ''; } }), [level, setLevel] = useState(0), [microphone, setMicrophone] = useState('');
  const [waveform, setWaveform] = useState<number[]>([]);
  const resources = useRef<{ context: AudioContext; stream: MediaStream; node: AudioWorkletNode; chunks: Float32Array[]; resampler: PcmResampler; samples: number; timer?: ReturnType<typeof setTimeout>; flushed?: () => void } | null>(null), alive = useRef(true), generation = useRef(0), stopping = useRef(false), opening = useRef(false);
  const refreshDevices = useCallback(async () => { if (!navigator.mediaDevices?.enumerateDevices) return; try { const list = await navigator.mediaDevices.enumerateDevices(); if (alive.current) setDevices(list.filter(d => d.kind === 'audioinput')); } catch { /* Recording reports microphone access errors; the default input remains available. */ } }, []);
  const setDeviceId = (id: string) => { if (resources.current || opening.current || stopping.current) return; selectDevice(id); setMicrophone(''); setError(''); try { if (id) localStorage.setItem(MICROPHONE_KEY, id); else localStorage.removeItem(MICROPHONE_KEY); } catch { /* The selection still works for this visit. */ } };
  const release = useCallback(() => { const r = resources.current; resources.current = null; if (r) { clearTimeout(r.timer); r.stream.getTracks().forEach(t => { t.onended = null; t.stop(); }); r.node.disconnect(); void r.context.close(); } }, []);
  const cancel = useCallback(() => { generation.current++; release(); stopping.current = false; setRecording(false); setStarting(false); setBlob(null); setError(''); setSeconds(0); setLevel(0); setWaveform([]); }, [release]);
  const stop = useCallback(async () => {
    const r = resources.current; if (!r || stopping.current) return; stopping.current = true; const current = generation.current;
    await new Promise<void>(resolve => { r.flushed = resolve; r.node.port.postMessage('flush'); setTimeout(resolve, 1200); });
    if (!alive.current || current !== generation.current || resources.current !== r) { if (current === generation.current) stopping.current = false; return; }
    const tail = r.resampler.push(new Float32Array(), true); r.chunks.push(tail.subarray(0, Math.max(0, maxSeconds * 16000 - r.samples)));
    const wav = encodeWav(r.chunks); release(); stopping.current = false;
    if (!alive.current) return; setRecording(false); setSeconds(wav.seconds); setLevel(0);
    if (!wav.seconds) { setError('Không nhận được dữ liệu từ micro. Kiểm tra micro trong cài đặt âm thanh của thiết bị, cho phép trình duyệt truy cập rồi thu lại.'); return; }
    if (wav.seconds < .2) { setError('Bản thu quá ngắn. Đọc hết từ hoặc câu rồi bấm Dừng thu.'); return; }
    if (wav.clipping > .05) { setError('Âm thanh bị vỡ. Đưa micro xa hơn rồi thu lại.'); return; }
    if (wav.signalSeconds < MIN_SIGNAL_SECONDS) { setError('Không nghe rõ lời đọc. Đọc gần micro hơn, kiểm tra micro không bị tắt trong cài đặt âm thanh của thiết bị rồi thu lại.'); return; }
    setBlob(new Blob([new Uint8Array(wav.bytes)], { type: 'audio/wav' }));
  }, [release, maxSeconds]);
  const stopRef = useRef(stop); stopRef.current = stop;
  const start = useCallback(async () => {
    if (resources.current || opening.current || stopping.current) return; opening.current = true; const current = ++generation.current; setStarting(true); setError(''); setBlob(null); setSeconds(0); setLevel(0); setWaveform([]);
    let stream: MediaStream | undefined, context: AudioContext | undefined;
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.AudioWorkletNode) throw new Error('Trình duyệt cần HTTPS hoặc localhost và hỗ trợ AudioWorklet.');
      const audio = { channelCount: 1, echoCancellation: true, noiseSuppression: false, autoGainControl: true };
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: { ...audio, ...(deviceId ? { deviceId: { exact: deviceId } } : {}) } }); }
      catch (e) {
        if (!deviceId || !(e instanceof Error) || !['NotFoundError', 'OverconstrainedError'].includes(e.name)) throw e;
        // A saved headset may have disconnected. Recover using the OS default.
        stream = await navigator.mediaDevices.getUserMedia({ audio });
        if (alive.current && generation.current === current) { selectDevice(''); try { localStorage.removeItem(MICROPHONE_KEY); } catch { /* Default input still works for this visit. */ } }
      }
      if (!alive.current || generation.current !== current) { stream.getTracks().forEach(t => t.stop()); return; }
      setMicrophone(stream.getAudioTracks()[0]?.label || 'Micro đang sử dụng'); void refreshDevices();
      context = new AudioContext(); await context.resume(); await context.audioWorklet.addModule('/speaking-recorder-worklet.js');
      if (!alive.current || generation.current !== current) { stream.getTracks().forEach(t => t.stop()); await context.close(); return; }
      const node = new AudioWorkletNode(context, 'speaking-pcm'), source = context.createMediaStreamSource(stream), gain = context.createGain(); gain.gain.value = 0; source.connect(node); node.connect(gain); gain.connect(context.destination);
      const r = { context, stream, node, chunks: [] as Float32Array[], resampler: new PcmResampler(context.sampleRate), samples: 0, timer: undefined as ReturnType<typeof setTimeout> | undefined, flushed: undefined as (() => void) | undefined }; resources.current = r;
      node.port.onmessage = e => { if (resources.current !== r) return; if (e.data.flushed) { r.flushed?.(); return; } if (e.data.samples instanceof Float32Array) { const output = r.resampler.push(e.data.samples).subarray(0, Math.max(0, maxSeconds * 16000 - r.samples)); r.chunks.push(output); r.samples += output.length; if (alive.current) { setSeconds(r.samples / 16000); let sum = 0, squared = 0; for (const sample of output) { sum += sample; squared += sample * sample; } const rms = output.length ? Math.sqrt(Math.max(0, squared / output.length - (sum / output.length) ** 2)) : 0; const signal = rms ? Math.max(0, Math.min(1, (20 * Math.log10(rms) + 70) / 60)) : 0; setLevel(signal); setWaveform(previous => [...previous.slice(-63), signal]); } if (r.samples >= maxSeconds * 16000) void stopRef.current(); } };
      r.timer = setTimeout(() => void stopRef.current(), maxSeconds * 1000 + 300);
      stream.getAudioTracks().forEach(t => { t.onended = () => { release(); if (alive.current) { setRecording(false); setError('Micro đã ngắt kết nối. Hãy kết nối lại và thu mới.'); } }; });
      setRecording(true);
    } catch (e) { stream?.getTracks().forEach(t => t.stop()); if (context && context.state !== 'closed') void context.close(); release(); if (alive.current && current === generation.current) setError(e instanceof Error && e.name === 'NotAllowedError' ? 'Chưa được phép dùng micro. Bấm biểu tượng quyền truy cập cạnh địa chỉ trang, cho phép Micro rồi thử lại.' : e instanceof Error && ['NotFoundError', 'OverconstrainedError'].includes(e.name) ? 'Không tìm thấy micro phù hợp. Hãy kết nối micro hoặc tai nghe có micro, chọn thiết bị đầu vào trong cài đặt âm thanh rồi bấm Thu âm.' : e instanceof Error && ['NotReadableError', 'AbortError'].includes(e.name) ? 'Không mở được micro. Đóng ứng dụng khác đang dùng micro, kiểm tra kết nối rồi bấm Thu âm để thử lại.' : e instanceof Error ? e.message : 'Không mở được micro. Kiểm tra kết nối và quyền truy cập micro rồi thử lại.'); }
    finally { opening.current = false; if (alive.current && current === generation.current) setStarting(false); }
  }, [maxSeconds, release, deviceId, refreshDevices]);
  useEffect(() => { void refreshDevices(); navigator.mediaDevices?.addEventListener('devicechange', refreshDevices); return () => navigator.mediaDevices?.removeEventListener('devicechange', refreshDevices); }, [refreshDevices]);
  useEffect(() => { alive.current = true; setRecording(false); setStarting(false); setBlob(null); return () => { alive.current = false; generation.current++; release(); }; }, [release, identity]);
  return { recording, starting, seconds, blob, error, start, stop, cancel, waveform, devices, deviceId, setDeviceId, level, microphone, clear: () => { setBlob(null); setError(''); } };
}
