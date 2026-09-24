import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeAudioPlaybackRate,
  playAudioUrl,
  playVocabAudio,
  resolveTtsPlaybackRate
} from './speech.js';

const waitForTimers = () => new Promise(resolve => setTimeout(resolve, 10));

function installSpeechBrowser() {
  const spoken: string[] = [];
  let cancellationSettled = true;
  const synthesis = {
    speaking: false,
    pending: false,
    paused: false,
    cancel() {
      cancellationSettled = false;
      setTimeout(() => { cancellationSettled = true; }, 0);
    },
    getVoices() { return []; },
    resume() {},
    speak(utterance: { text: string }) {
      // Chromium can discard a new utterance if it is queued in the same task
      // as an unnecessary cancel(). This fake makes that failure deterministic.
      if (cancellationSettled) spoken.push(utterance.text);
    },
  };
  class FakeUtterance {
    lang = '';
    rate = 1;
    voice: unknown = null;
    onend: (() => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(public text: string) {}
  }
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { speechSynthesis: synthesis } });
  Object.defineProperty(globalThis, 'SpeechSynthesisUtterance', { configurable: true, value: FakeUtterance });
  return { spoken };
}

test('audio playback rate is normalized to the supported range', () => {
  assert.equal(normalizeAudioPlaybackRate(undefined), 1);
  assert.equal(normalizeAudioPlaybackRate(Number.NaN), 1);
  assert.equal(normalizeAudioPlaybackRate(0.2), 0.5);
  assert.equal(normalizeAudioPlaybackRate(0.8), 0.8);
  assert.equal(normalizeAudioPlaybackRate(1.2), 1.2);
  assert.equal(normalizeAudioPlaybackRate(3), 1.5);
});

test('YupVox uses saved playback speed without double-speeding provider-rendered audio', () => {
  assert.equal(resolveTtsPlaybackRate('yupvox', 0.8), 0.8);
  assert.equal(resolveTtsPlaybackRate('YupVox', 1.2), 1.2);
  assert.equal(resolveTtsPlaybackRate('ai33', 0.8), 1);
  assert.equal(resolveTtsPlaybackRate(undefined, 1.2), 1);
});

test('vocabulary without a saved audio file uses browser speech without an idle cancel race', async t => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const previousUtterance = Object.getOwnPropertyDescriptor(globalThis, 'SpeechSynthesisUtterance');
  t.after(() => {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else delete (globalThis as any).window;
    if (previousUtterance) Object.defineProperty(globalThis, 'SpeechSynthesisUtterance', previousUtterance);
    else delete (globalThis as any).SpeechSynthesisUtterance;
  });
  const browser = installSpeechBrowser();

  playVocabAudio({ term: 'car' });
  await waitForTimers();

  assert.deepEqual(browser.spoken, ['car']);
});

test('an audio element error falls back to browser speech exactly once', async t => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const previousUtterance = Object.getOwnPropertyDescriptor(globalThis, 'SpeechSynthesisUtterance');
  const previousAudio = Object.getOwnPropertyDescriptor(globalThis, 'Audio');
  t.after(() => {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
    else delete (globalThis as any).window;
    if (previousUtterance) Object.defineProperty(globalThis, 'SpeechSynthesisUtterance', previousUtterance);
    else delete (globalThis as any).SpeechSynthesisUtterance;
    if (previousAudio) Object.defineProperty(globalThis, 'Audio', previousAudio);
    else delete (globalThis as any).Audio;
  });
  const browser = installSpeechBrowser();
  class FailingAudio {
    volume = 1;
    playbackRate = 1;
    currentTime = 0;
    private listeners = new Map<string, () => void>();
    constructor(_url: string) {}
    addEventListener(name: string, listener: () => void) { this.listeners.set(name, listener); }
    removeEventListener(name: string) { this.listeners.delete(name); }
    pause() {}
    play() {
      queueMicrotask(() => this.listeners.get('error')?.());
      return Promise.resolve();
    }
  }
  Object.defineProperty(globalThis, 'Audio', { configurable: true, value: FailingAudio });

  playAudioUrl('/missing.mp3', 'bus');
  await waitForTimers();

  assert.deepEqual(browser.spoken, ['bus']);
});
