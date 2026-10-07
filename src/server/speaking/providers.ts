import crypto from 'node:crypto';
import type { PronunciationAssessmentConfig } from 'microsoft-cognitiveservices-speech-sdk';
import { SpeakingError, type Assessment, type LessonInput, type ProviderId, type WordScore } from '../../shared/speaking/types';
import { recognizeAzure } from './azureSession';
export interface ProviderInput { lesson: LessonInput; wav: Buffer; durationSeconds: number }
export interface PronunciationProvider { id: ProviderId; configured: boolean; maxSeconds: number; assess(input: ProviderInput): Promise<Assessment> }
export const wordsOf = (s: string) => s.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu) || [];
const key = (s: string) => s.toLowerCase().replace(/’/g, "'").replace(/[^\p{L}\p{N}']/gu, '');
const obj = (v: any) => v && typeof v === 'object' && !Array.isArray(v) ? v : {};
const list = (v: any): any[] => Array.isArray(v) ? v : [];
const score = (v: any): number | null => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100 ? v : null;
const required = (v: any) => { const n = score(v); if (n === null) throw new SpeakingError(502, 'PROVIDER_RESPONSE', 'Dịch vụ chấm trả dữ liệu không hợp lệ.'); return n; };
const time = (v: any, multiplier: number) => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v * multiplier) : null;
const round = (n: number) => Math.round(n * 10) / 10;

// Global sequence alignment preserves repeated reference words and does not renumber by utterance.
export function alignWords(reference: string, actual: WordScore[]): WordScore[] {
  const ref = wordsOf(reference), n = ref.length, m = actual.length;
  if (n > 500 || m > 1500) throw new SpeakingError(502, 'PROVIDER_RESPONSE', 'Số từ trả về vượt giới hạn.');
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = 0; i <= n; i++) dp[i][0] = i;
  for (let j = 0; j <= m; j++) dp[0][j] = j;
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
    const match = key(ref[i - 1]) === key(actual[j - 1].text) && actual[j - 1].error !== 'insertion';
    dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (match ? 0 : 2));
  }
  const out: WordScore[] = []; let i = n, j = m;
  while (i || j) {
    if (i && j && key(ref[i - 1]) === key(actual[j - 1].text) && actual[j - 1].error !== 'insertion' && dp[i][j] === dp[i - 1][j - 1]) {
      out.push({ ...actual[j - 1], text: ref[i - 1], referenceIndex: i - 1 }); i--; j--;
    } else if (j && dp[i][j] === dp[i][j - 1] + 1) {
      if (actual[j - 1].error !== 'omission') out.push({ ...actual[j - 1], referenceIndex: null, error: 'insertion' }); j--;
    } else {
      out.push({ text: ref[i - 1], referenceIndex: i - 1, error: 'omission', accuracy: null, startMs: null, durationMs: null, phonemes: [] }); i--;
    }
  }
  return out.reverse();
}

export const azureProsodyEnabled = (env: NodeJS.ProcessEnv) => env.SPEAKING_AZURE_PROSODY === 'true';
export function configureAzureAssessment(config: Pick<PronunciationAssessmentConfig, 'phonemeAlphabet' | 'enableProsodyAssessment'>, lesson: Pick<LessonInput, 'locale'>, env: NodeJS.ProcessEnv) {
  const enabled = azureProsodyEnabled(env) && lesson.locale === 'en-US';
  config.phonemeAlphabet = 'IPA'; config.enableProsodyAssessment = enabled;
  return enabled;
}
export function normalizeAzure(input: ProviderInput, payloads: unknown[], elapsedMs: number, options: { prosodyEnabled?: boolean } = {}): Assessment {
  const chunks = payloads.map(v => obj(list(obj(v).NBest)[0])).filter(v => Object.keys(v).length);
  if (!chunks.length) throw new SpeakingError(422, 'NO_SPEECH', 'Không nhận dạng được lời đọc. Hãy thu lại.');
  const raw: WordScore[] = chunks.flatMap(c => list(c.Words).map(w => {
    const p = obj(w.PronunciationAssessment), error = String(p.ErrorType || 'None').toLowerCase();
    return { text: String(w.Word || '').slice(0, 150), referenceIndex: null, error: ['omission', 'insertion', 'mispronunciation'].includes(error) ? error as WordScore['error'] : 'none', accuracy: score(p.AccuracyScore),
      startMs: time(w.Offset, .0001), durationMs: time(w.Duration, .0001), phonemes: list(w.Phonemes).slice(0, 100).map(ph => ({ phone: String(ph.Phoneme || '').slice(0, 40), alphabet: 'ipa' as const, score: required(obj(ph.PronunciationAssessment).AccuracyScore), startMs: time(ph.Offset, .0001), durationMs: time(ph.Duration, .0001) })) };
  }));
  const words = alignWords(input.lesson.referenceText, raw), recognized = words.filter(w => w.referenceIndex !== null && w.error !== 'omission');
  if (!recognized.length) throw new SpeakingError(422, 'NO_SPEECH', 'Lời đọc chưa khớp nội dung bài. Hãy thu lại.');
  const metric = (name: string) => {
    const values = chunks.map(c => ({ value: score(obj(c.PronunciationAssessment)[name]), weight: list(c.Words).reduce((n, w) => n + (typeof w.Duration === 'number' ? Math.max(w.Duration, 0) : 0), 0) || 1 })).filter(c => c.value !== null);
    return values.length ? round(values.reduce((n, c) => n + c.value! * c.weight, 0) / values.reduce((n, c) => n + c.weight, 0)) : null;
  };
  const accuracy = metric('AccuracyScore'); if (accuracy === null) required(null);
  const completeness = round(recognized.length / wordsOf(input.lesson.referenceText).length * 100), fluency = input.lesson.kind === 'word' ? null : metric('FluencyScore');
  if (input.lesson.kind !== 'word' && fluency === null) required(null);
  const providerOverall = chunks.length === 1 && input.durationSeconds <= 30 ? score(obj(chunks[0].PronunciationAssessment).PronScore) : null;
  // Non-word recordings always use a continuous session. Compute completeness
  // over the whole reference even when Azure emits just one recognized phrase.
  const appScore = input.lesson.kind === 'word' ? accuracy! : (.6 * accuracy! + .2 * fluency! + .2 * completeness);
  const prosody = input.lesson.locale === 'en-US' ? metric('ProsodyScore') : null;
  const prosodyStatus = prosody !== null ? 'available' : input.lesson.locale !== 'en-US' ? 'unsupported-locale' : options.prosodyEnabled === false ? 'disabled' : 'not-returned';
  return { schemaVersion: 1, provider: 'azure', providerVersion: 'speech-sdk-1.52.0', rubricVersion: 'reading-v1', score: round(appScore), providerOverall, accuracy: accuracy!, fluency, completeness,
    prosody, prosodyStatus, rhythm: null, transcript: chunks.map(c => String(c.Display || c.Lexical || '')).join(' ').slice(0, 10000), words,
    warnings: input.lesson.kind !== 'word' ? ['Điểm liên tục dùng công thức reading-v1 (60% accuracy, 20% fluency, 20% completeness); cần đối chiếu giáo viên trước khi dùng làm điểm thi.'] : [], elapsedMs };
}

export function normalizeSpeechSuper(input: ProviderInput, payload: unknown, elapsedMs: number): Assessment {
  const root = obj(payload), r = obj(root.result);
  if (root.error || root.errorId || !Object.keys(r).length) throw new SpeakingError(502, 'PROVIDER_RESPONSE', 'SpeechSuper chưa trả kết quả hợp lệ.');
  const rows = input.lesson.kind === 'passage' ? list(r.sentences).flatMap(s => list(s.details)) : list(r.words);
  const raw: WordScore[] = rows.filter(w => w.charType !== 1 && typeof w.word === 'string').map(w => {
    const p = obj(w.scores), span = obj(w.span), accuracy = score(p.pronunciation ?? w.overall);
    return { text: w.word.slice(0, 150), referenceIndex: null, error: w.readType === 3 ? 'omission' : w.readType === 4 ? 'insertion' : accuracy !== null && accuracy < 60 ? 'mispronunciation' : 'none', accuracy,
      startMs: time(span.start ?? w.start, 10), durationMs: time(typeof (span.end ?? w.end) === 'number' && typeof (span.start ?? w.start) === 'number' ? (span.end ?? w.end) - (span.start ?? w.start) : undefined, 10),
      phonemes: list(w.phonemes).slice(0, 100).map(ph => ({ phone: String(ph.phoneme || '').slice(0, 40), alphabet: 'ipa' as const, score: required(ph.pronunciation), startMs: time(obj(ph.span).start, 10), durationMs: time(obj(ph.span).end - obj(ph.span).start, 10) })) };
  });
  const words = alignWords(input.lesson.referenceText, raw), accuracy = required(r.pronunciation), overall = required(r.overall);
  if (!raw.some(w => w.error !== 'omission')) throw new SpeakingError(422, 'NO_SPEECH', 'Không nhận dạng được lời đọc. Hãy thu lại.');
  return { schemaVersion: 1, provider: 'speechsuper', providerVersion: [r.kernel_version, r.resource_version].filter(v => typeof v === 'string').join('/').slice(0, 100) || 'unknown', rubricVersion: 'reading-v1',
    score: input.lesson.kind === 'word' ? accuracy : overall, providerOverall: overall, accuracy, fluency: input.lesson.kind === 'word' ? null : score(r.fluency), completeness: score(r.integrity) ?? round(words.filter(w => w.referenceIndex !== null && w.error !== 'omission').length / wordsOf(input.lesson.referenceText).length * 100),
    prosody: null, rhythm: score(r.rhythm), transcript: raw.filter(w => w.error !== 'omission').map(w => w.text).join(' '), words,
    warnings: [...list(r.warning).map(w => `SpeechSuper: ${String(w.message || w.code || '').slice(0, 200)}`), ...(input.lesson.kind === 'passage' ? ['SpeechSuper para.eval không cung cấp điểm phoneme trong hợp đồng hiện tại.'] : [])], elapsedMs };
}

export function createProviders(env: NodeJS.ProcessEnv = process.env): Record<ProviderId, PronunciationProvider> {
  const azure: PronunciationProvider = { id: 'azure', configured: Boolean(env.AZURE_SPEECH_KEY && /^[a-z0-9-]{2,50}$/.test(env.AZURE_SPEECH_REGION || '')), maxSeconds: 300,
    async assess(input) {
      if (!azure.configured) throw new SpeakingError(503, 'PROVIDER_NOT_CONFIGURED', 'Chưa cấu hình Azure Speech.');
      const sdk = await import('microsoft-cognitiveservices-speech-sdk'), started = Date.now();
      const config = sdk.SpeechConfig.fromSubscription(env.AZURE_SPEECH_KEY!, env.AZURE_SPEECH_REGION!); config.speechRecognitionLanguage = input.lesson.locale;
      const pa = new sdk.PronunciationAssessmentConfig(input.lesson.referenceText, sdk.PronunciationAssessmentGradingSystem.HundredMark, sdk.PronunciationAssessmentGranularity.Phoneme, input.lesson.kind === 'word');
      const prosodyEnabled = configureAzureAssessment(pa, input.lesson, env);
      const recognizer = new sdk.SpeechRecognizer(config, sdk.AudioConfig.fromWavFileInput(input.wav)); pa.applyTo(recognizer);
      const payloads = await recognizeAzure(sdk, recognizer, sdk.Connection.fromRecognizer(recognizer), input.lesson.kind, input.durationSeconds);
      return normalizeAzure(input, payloads, Date.now() - started, { prosodyEnabled });
    } };
  const speechsuper: PronunciationProvider = { id: 'speechsuper', configured: Boolean(env.SPEECHSUPER_APP_KEY && env.SPEECHSUPER_SECRET_KEY), maxSeconds: 180,
    async assess(input) {
      if (!speechsuper.configured) throw new SpeakingError(503, 'PROVIDER_NOT_CONFIGURED', 'Chưa cấu hình SpeechSuper.');
      if (input.durationSeconds > 180) throw new SpeakingError(422, 'PROVIDER_DURATION', 'SpeechSuper hỗ trợ tối đa 180 giây.');
      const started = Date.now(), timestamp = String(started), userId = crypto.randomUUID(), appKey = env.SPEECHSUPER_APP_KEY!, secret = env.SPEECHSUPER_SECRET_KEY!;
      const sha = (s: string) => crypto.createHash('sha1').update(s).digest('hex');
      const coreType = input.lesson.kind === 'word' ? 'word.eval.promax' : input.lesson.kind === 'passage' ? 'para.eval' : 'sent.eval.promax';
      const params = { connect: { cmd: 'connect', param: { sdk: { version: 16777472, source: 9, protocol: 2 }, app: { applicationId: appKey, timestamp, sig: sha(appKey + timestamp + secret) } } },
        start: { cmd: 'start', param: { app: { applicationId: appKey, userId, timestamp, sig: sha(appKey + timestamp + userId + secret) }, audio: { audioType: 'wav', sampleRate: 16000, channel: 1, sampleBytes: 2 },
          request: { coreType, refText: input.lesson.referenceText, tokenId: crypto.randomUUID(), dict_type: 'IPA88', dict_dialect: input.lesson.locale === 'en-US' ? 'en_us' : 'en_br', scale: 100, precision: 1, getParam: 0,
            ...(coreType === 'para.eval' ? { paragraph_need_word_score: 1 } : { phoneme_output: 1, readtype_diagnosis: 1 }) } } } };
      const body = new FormData(); body.append('text', JSON.stringify(params)); body.append('audio', new Blob([new Uint8Array(input.wav)], { type: 'audio/wav' }), 'recording.wav');
      const response = await fetch(`https://api.speechsuper.com/${coreType}`, { method: 'POST', headers: { 'Request-Index': '0' }, body, signal: AbortSignal.timeout(Math.min(240000, input.durationSeconds * 1000 + 45000)) });
      if (!response.ok) throw new SpeakingError(502, 'PROVIDER_FAILED', 'SpeechSuper chưa chấm được bản thu.');
      const raw = await response.text(); if (raw.length > 4_000_000) throw new SpeakingError(502, 'PROVIDER_RESPONSE', 'Kết quả dịch vụ vượt giới hạn.');
      let data: unknown; try { data = JSON.parse(raw); } catch { throw new SpeakingError(502, 'PROVIDER_RESPONSE', 'Kết quả SpeechSuper không hợp lệ.'); }
      return normalizeSpeechSuper(input, data, Date.now() - started);
    } };
  return { azure, speechsuper };
}
