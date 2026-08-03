import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeAudioPlaybackRate,
  resolveTtsPlaybackRate
} from './speech.js';

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
