import { measureAudioSignal } from '../../shared/speaking/audioQuality';

export class PcmResampler {
  private buffer: number[] = []; private base = 0; private position = 0; private total = 0; private emitted = 0;
  constructor(private sourceRate: number, private targetRate = 16000) { if (sourceRate < targetRate || sourceRate > 192000) throw new Error('Tần số micro không được hỗ trợ.'); }
  push(samples: Float32Array, final = false): Float32Array {
    for (const sample of samples) this.buffer.push(sample); this.total += samples.length;
    const out: number[] = [], step = this.sourceRate / this.targetRate, radius = 16, cutoff = Math.min(1, this.targetRate / this.sourceRate) * .9;
    const limit = final ? Math.round(this.total / step) : Infinity;
    while (this.emitted < limit && (final ? this.position < this.total : this.position + radius < this.total)) {
      let value = 0, weight = 0;
      const center = Math.floor(this.position);
      for (let k = center - radius + 1; k <= center + radius; k++) {
        const x = k - this.position, sinc = Math.abs(x) < 1e-8 ? cutoff : Math.sin(Math.PI * cutoff * x) / (Math.PI * x), window = .5 * (1 + Math.cos(Math.PI * x / radius)), w = sinc * window;
        const index = k - this.base, sample = k >= 0 && k < this.total && index >= 0 ? this.buffer[index] || 0 : 0; value += sample * w; weight += w;
      }
      out.push(weight ? value / weight : 0); this.position += step; this.emitted++;
    }
    const discard = Math.max(0, Math.floor(this.position) - radius - this.base); if (discard) { this.buffer.splice(0, discard); this.base += discard; }
    return Float32Array.from(out);
  }
}
export function encodeWav(chunks: Float32Array[]): { bytes: Uint8Array; seconds: number; rms: number; clipping: number; signalSeconds: number } {
  const count = chunks.reduce((n, c) => n + c.length, 0), bytes = new Uint8Array(44 + count * 2), v = new DataView(bytes.buffer);
  const ascii = (s: string, start: number) => [...s].forEach((c, i) => v.setUint8(start + i, c.charCodeAt(0)));
  ascii('RIFF', 0); v.setUint32(4, 36 + count * 2, true); ascii('WAVEfmt ', 8); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 16000, true); v.setUint32(28, 32000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); ascii('data', 36); v.setUint32(40, count * 2, true);
  let offset = 44;
  for (const chunk of chunks) for (const value of chunk) { const sample = Math.max(-1, Math.min(1, value)); v.setInt16(offset, Math.round(sample * (sample < 0 ? 32768 : 32767)), true); offset += 2; }
  const quality = measureAudioSignal(bytes.subarray(44));
  return { bytes, seconds: count / 16000, rms: quality.rms, clipping: quality.clippingRatio, signalSeconds: quality.signalSeconds };
}
