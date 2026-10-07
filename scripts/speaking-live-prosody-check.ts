import fs from 'node:fs';
import dotenv from 'dotenv';
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';
import { createProviders } from '../src/server/speaking/providers';
import { inspectWav } from '../src/server/speaking/audio';
import { type LessonInput, SpeakingError } from '../src/shared/speaking/types';

// Explicit opt-in: one short Azure TTS request and one assessment. No student
// recording, database write, provider fallback or automatic paid retry.
async function verify() {
  if (process.env.SPEAKING_LIVE_PROSODY_CHECK !== 'true') throw Error('Set SPEAKING_LIVE_PROSODY_CHECK=true to authorize this live provider check.');
  const env = { ...dotenv.parse(fs.readFileSync('.env')), ...process.env };
  if (env.SPEAKING_AZURE_PROSODY !== 'true' || !env.AZURE_SPEECH_KEY || !env.AZURE_SPEECH_REGION) throw Error('Azure credentials/prosody flag are not configured.');
  const referenceText = 'Can you tell me about yourself?';
  const config = sdk.SpeechConfig.fromSubscription(env.AZURE_SPEECH_KEY, env.AZURE_SPEECH_REGION);
  config.speechSynthesisVoiceName = 'en-US-JennyNeural'; config.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Riff16Khz16BitMonoPcm;
  const synthesizer = new sdk.SpeechSynthesizer(config, null);
  const wav = await new Promise<Buffer>((resolve, reject) => {
    let done = false;
    const finish = (buffer?: Buffer) => { if (done) return; done = true; clearTimeout(timer); synthesizer.close(); buffer ? resolve(buffer) : reject(new Error('Azure TTS verification failed.')); };
    const timer = setTimeout(() => finish(), 30000);
    synthesizer.speakTextAsync(referenceText, result => finish(result.reason === sdk.ResultReason.SynthesizingAudioCompleted ? Buffer.from(result.audioData) : undefined), () => finish());
  });
  const audio = inspectWav(wav);
  const lesson: LessonInput = { title: 'Live provider verification', kind: 'sentence', referenceText, partnerText: '', instructions: '', locale: 'en-US', grade: 3, maxSeconds: 30, provider: 'azure', sampleAudioUrl: '', samplePlaybackRate: 1, feedbackEnabled: false };
  const result = await createProviders(env).azure.assess({ lesson, wav, durationSeconds: audio.durationSeconds });
  const report = { passed: typeof result.prosody === 'number', source: 'synthetic-tts', provider: result.provider, locale: lesson.locale, durationSeconds: audio.durationSeconds, accuracy: result.accuracy, fluency: result.fluency, completeness: result.completeness, prosody: result.prosody, prosodyStatus: result.prosodyStatus, rhythm: result.rhythm, words: result.words.length, rubricVersion: result.rubricVersion, databaseWrites: 0, assessmentCalls: 1, ttsCalls: 1 };
  fs.writeFileSync('.data/speaking-prosody-live-azure.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
  if (!report.passed) process.exitCode = 1;
}
verify().catch(error => {
  const report = { passed: false, code: error instanceof SpeakingError ? error.code : 'LIVE_CHECK_UNAVAILABLE', databaseWrites: 0, noRetry: true };
  fs.writeFileSync('.data/speaking-prosody-live-azure.json', JSON.stringify(report, null, 2)); console.log(JSON.stringify(report)); process.exitCode = 1;
});
