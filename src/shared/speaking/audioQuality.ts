const SAMPLE_RATE = 16000;
const FRAME_SAMPLES = 320; // 20 ms, so trailing silence cannot dilute a short reading.
export const MIN_SIGNAL_SECONDS = .08;
export const MIN_SIGNAL_RMS = .002;

export function measureAudioSignal(pcm: Uint8Array) {
  const view = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength), count = pcm.byteLength / 2;
  let squared = 0, clipped = 0, signalSamples = 0, frameSum = 0, frameSquared = 0, frameCount = 0;
  const finishFrame = () => {
    // Remove the DC component; a constant offset is not microphone activity.
    const mean = frameSum / frameCount, rms = Math.sqrt(Math.max(0, frameSquared / frameCount - mean * mean));
    if (rms >= MIN_SIGNAL_RMS) signalSamples += frameCount;
    frameSum = 0; frameSquared = 0; frameCount = 0;
  };
  for (let i = 0; i < pcm.byteLength; i += 2) {
    const sample = view.getInt16(i, true) / 32768;
    squared += sample * sample; if (Math.abs(sample) > .99) clipped++;
    frameSum += sample; frameSquared += sample * sample; frameCount++;
    if (frameCount === FRAME_SAMPLES) finishFrame();
  }
  if (frameCount) finishFrame();
  return { rms: Math.sqrt(squared / Math.max(1, count)), clippingRatio: clipped / Math.max(1, count), signalSeconds: signalSamples / SAMPLE_RATE };
}
