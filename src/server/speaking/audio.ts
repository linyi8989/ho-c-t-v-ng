import { SpeakingError } from '../../shared/speaking/types';
import { measureAudioSignal, MIN_SIGNAL_SECONDS } from '../../shared/speaking/audioQuality';
export const MAX_AUDIO_BYTES = 9_600_044;
export function inspectWav(bytes: Buffer, maxSeconds = 300) {
  const bad = () => { throw new SpeakingError(422, 'INVALID_AUDIO', 'Cần bản thu WAV PCM 16-bit, mono, 16 kHz hợp lệ.'); };
  if (bytes.length < 44 || bytes.length > MAX_AUDIO_BYTES || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE' || bytes.readUInt32LE(4) + 8 !== bytes.length) return bad();
  let offset = 12, pcm: Buffer | undefined, validFormat = false;
  while (offset + 8 <= bytes.length) {
    const id = bytes.toString('ascii', offset, offset + 4), size = bytes.readUInt32LE(offset + 4), start = offset + 8;
    if (start + size > bytes.length) return bad();
    if (id === 'fmt ') {
      if (size < 16 || validFormat || bytes.readUInt16LE(start) !== 1 || bytes.readUInt16LE(start + 2) !== 1 || bytes.readUInt32LE(start + 4) !== 16000 || bytes.readUInt32LE(start + 8) !== 32000 || bytes.readUInt16LE(start + 12) !== 2 || bytes.readUInt16LE(start + 14) !== 16) return bad();
      validFormat = true;
    }
    if (id === 'data') { if (pcm || size % 2) return bad(); pcm = bytes.subarray(start, start + size); }
    offset = start + size + (size % 2);
  }
  if (!validFormat || !pcm || offset !== bytes.length) return bad();
  const durationSeconds = pcm.length / 32000;
  if (durationSeconds < .2 || durationSeconds > maxSeconds + .1) throw new SpeakingError(422, 'AUDIO_DURATION', `Bản thu cần từ 0,2 đến ${maxSeconds} giây.`);
  const { rms, clippingRatio, signalSeconds } = measureAudioSignal(pcm);
  if (clippingRatio > .05) throw new SpeakingError(422, 'AUDIO_CLIPPING', 'Âm thanh bị vỡ. Hãy đưa micro xa hơn và thu lại.');
  if (signalSeconds < MIN_SIGNAL_SECONDS) throw new SpeakingError(422, 'AUDIO_TOO_QUIET', 'Bản thu trống hoặc âm lượng quá nhỏ. Hãy kiểm tra micro và thu lại.');
  return { pcm, durationSeconds, rms, clippingRatio };
}
