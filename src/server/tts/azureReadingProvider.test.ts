import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';
import { azureReadingSettings, generateAzureReadingAudio, readingTtsCapability } from './azureReadingProvider';
import { createTtsService } from './service';

const env = { SPEAKING_SAMPLE_TTS_PROVIDER: 'azure', AZURE_SPEECH_KEY: 'fixture-only-key', AZURE_SPEECH_REGION: 'southeastasia' };
const settings = azureReadingSettings(env, 'en-US');
const audio = new Uint8Array(2048); audio.set([0x49, 0x44, 0x33]);

test('explicit Azure sample selection uses the existing credentials and never falls back to B', () => {
  assert.deepEqual(readingTtsCapability(env, false), { provider: 'azure', configured: true, reason: '' });
  assert.equal(readingTtsCapability({ ...env, AZURE_SPEECH_KEY: '' }, true).configured, false);
  assert.equal(readingTtsCapability({ ...env, SPEAKING_SAMPLE_TTS_PROVIDER: 'wrong' }, true).configured, false);
  assert.equal(readingTtsCapability({ ...env, SPEAKING_SAMPLE_TTS_PROVIDER: 'b' }, true).provider, 'b');
  assert.equal(readingTtsCapability({ AZURE_SPEECH_KEY: env.AZURE_SPEECH_KEY, AZURE_SPEECH_REGION: env.AZURE_SPEECH_REGION }, false).configured, false);
  assert.ok(!JSON.stringify(readingTtsCapability(env, false)).includes(env.AZURE_SPEECH_KEY));
});

test('reading locale/voice stay bounded and wrong backend configuration does not issue a request', async () => {
  assert.equal(azureReadingSettings(env, 'en-GB').voice, 'en-GB-SoniaNeural');
  assert.throws(() => azureReadingSettings(env, 'vi-VN'));
  assert.equal(readingTtsCapability({ ...env, SPEAKING_AZURE_TTS_VOICE_EN_US: 'en-GB-SoniaNeural' }, false).configured, false);
  assert.equal(readingTtsCapability({ ...env, AZURE_SPEECH_REGION: 'https://example.invalid/' }, false).configured, false);
  let calls = 0;
  await assert.rejects(generateAzureReadingAudio('apple', settings, { ...env, AZURE_SPEECH_KEY: '' }, { createSynthesizer: () => { calls++; throw Error('not called'); } }));
  assert.equal(calls, 0);
});

test('Azure returns full plain reading text as bounded MP3 and releases the synthesizer once', async () => {
  const text = 'Read the entire passage (including this note). '.repeat(12); let read = '', closed = 0;
  const bytes = await generateAzureReadingAudio(text, settings, env, { createSynthesizer: (credentials, selected) => {
    assert.equal(credentials.region, 'southeastasia'); assert.equal(selected.voice, 'en-US-JennyNeural');
    return { speakTextAsync(value, success) { read = value; success({ reason: sdk.ResultReason.SynthesizingAudioCompleted, audioData: audio.buffer }); }, close() { closed++; } };
  } });
  assert.equal(read, text.trim()); assert.ok(read.length > 120); assert.equal(bytes.length, 2048); assert.equal(closed, 1);
});

test('cancelled/invalid/oversized provider audio is rejected and cannot populate the cache', async () => {
  for (const [reason, data, maxBytes] of [[sdk.ResultReason.Canceled, audio.buffer, 4096], [sdk.ResultReason.SynthesizingAudioCompleted, new ArrayBuffer(2048), 4096], [sdk.ResultReason.SynthesizingAudioCompleted, audio.buffer, 1024]] as const) {
    let closed = 0;
    await assert.rejects(generateAzureReadingAudio('apple', settings, env, { maxBytes, createSynthesizer: () => ({ speakTextAsync(_text, success) { success({ reason, audioData: data }); }, close() { closed++; } }) }), (error: { status: number }) => error.status === 502);
    assert.equal(closed, 1);
  }
});

test('deadline closes Azure, ignores late success and permits no automatic paid retry', async () => {
  let success: ((result: { reason: sdk.ResultReason; audioData: ArrayBuffer }) => void) | undefined, calls = 0, closed = 0;
  await assert.rejects(generateAzureReadingAudio('apple', settings, env, { timeoutMs: 5, createSynthesizer: () => ({ speakTextAsync(_text, done) { calls++; success = done; }, close() { closed++; } }) }), (error: { status: number }) => error.status === 504);
  success!({ reason: sdk.ResultReason.SynthesizingAudioCompleted, audioData: audio.buffer });
  assert.equal(calls, 1); assert.equal(closed, 1);
});

test('SDK initialization and callback failures never expose raw provider secrets', async () => {
  const secret = 'sensitive-fixture-only';
  for (const createSynthesizer of [() => { throw Error(secret); }, () => ({ speakTextAsync(_text: string, _success: unknown, failure: (error: string) => void) { failure(secret); }, close() {} })]) {
    await assert.rejects(generateAzureReadingAudio('apple', settings, env, { createSynthesizer }), (error: Error) => !error.message.includes(secret));
  }
});

test('reading settings hook changes only samples; B vocabulary still uses its original provider', async () => {
  const calls: string[] = [];
  const service = createTtsService({ normalizeSettings: () => ({ provider: 'ai33' }), normalizeReadingSettings: () => settings,
    sanitizeInput: text => ({ text, warnings: [] }), createAudioHash: () => 'hash', runWithConcurrency: async () => [], concurrency: 1, voiceProvider: { listVoices: async () => ({ status: 200, data: [] }) },
    generateCachedAudio: async (_text, selected) => { calls.push(selected.provider); return { audioUrl: '/audio/old.mp3' }; },
    generateReadingAudio: async (_text, selected) => { calls.push(selected.provider); return { audioUrl: '/audio/new.mp3' }; } });
  await service.preview({ text: 'apple' }); await service.previewReading({ text: 'Read all of this sentence.' });
  assert.deepEqual(calls, ['ai33', 'azure']);
});
