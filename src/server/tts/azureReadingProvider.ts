import * as sdk from 'microsoft-cognitiveservices-speech-sdk';
import { normalizeReadingTtsInput } from './readingInput';

type Environment = Record<string, string | undefined>;
export type AzureReadingSettings = { provider: 'azure'; lang: 'en-US' | 'en-GB'; voice: string; speed: 1; autoGenerate: false };
type SynthesisResult = { reason: sdk.ResultReason; audioData: ArrayBuffer };
type Synthesizer = {
  speakTextAsync(text: string, success: (result: SynthesisResult) => void, failure: (error: string) => void): void;
  close(): void;
};
const ttsError = (status: number, code: string, message: string) => Object.assign(new Error(message), { status, code });

function azureCredentials(env: Environment) {
  const key = (env.AZURE_SPEECH_KEY || '').trim(), region = (env.AZURE_SPEECH_REGION || '').trim().toLowerCase();
  if (!key || !/^[a-z][a-z0-9]{1,48}$/.test(region)) throw ttsError(503, 'AZURE_TTS_UNAVAILABLE', 'Cần AZURE_SPEECH_KEY và AZURE_SPEECH_REGION hợp lệ trên backend để tạo audio mẫu.');
  return { key, region };
}

export function azureReadingSettings(env: Environment, locale: unknown): AzureReadingSettings {
  if (locale !== 'en-US' && locale !== 'en-GB') throw ttsError(400, 'INVALID_TTS_LOCALE', 'Audio mẫu hỗ trợ giọng Anh-Mỹ hoặc Anh-Anh.');
  const voice = (locale === 'en-US' ? env.SPEAKING_AZURE_TTS_VOICE_EN_US : env.SPEAKING_AZURE_TTS_VOICE_EN_GB)?.trim()
    || (locale === 'en-US' ? 'en-US-JennyNeural' : 'en-GB-SoniaNeural');
  if (!new RegExp(`^${locale}-[A-Za-z0-9]{1,80}Neural$`).test(voice)) throw ttsError(503, 'INVALID_TTS_VOICE', 'Giọng Azure TTS trên backend chưa hợp lệ hoặc không khớp giọng của bài đọc.');
  return { provider: 'azure', lang: locale, voice, speed: 1, autoGenerate: false };
}

// Selection is explicit. Old B TTS remains the default; a failed Azure request
// never triggers a second provider or a paid retry.
export function readingTtsCapability(env: Environment, bConfigured: boolean) {
  const selected = (env.SPEAKING_SAMPLE_TTS_PROVIDER || 'b').trim().toLowerCase();
  if (selected === 'b') return { provider: 'b' as const, configured: bConfigured, reason: bConfigured ? '' : 'Chưa cấu hình TTS của B (AI33_API_KEY hoặc TTS_API_KEY). Có thể chọn Azure TTS trên backend hoặc nghe mẫu trên thiết bị.' };
  if (selected !== 'azure') return { configured: false, reason: 'SPEAKING_SAMPLE_TTS_PROVIDER cần là azure hoặc b.' };
  try {
    azureCredentials(env); azureReadingSettings(env, 'en-US'); azureReadingSettings(env, 'en-GB');
    return { provider: 'azure' as const, configured: true, reason: '' };
  } catch (error) {
    return { provider: 'azure' as const, configured: false, reason: error instanceof Error ? error.message : 'Chưa cấu hình Azure TTS.' };
  }
}

export async function generateAzureReadingAudio(text: string, settings: AzureReadingSettings, env: Environment, options: {
  timeoutMs?: number; maxBytes?: number;
  createSynthesizer?: (credentials: { key: string; region: string }, settings: AzureReadingSettings) => Synthesizer;
} = {}): Promise<Buffer> {
  const input = normalizeReadingTtsInput(text), credentials = azureCredentials(env);
  const expected = azureReadingSettings(env, settings.lang);
  if (settings.provider !== 'azure' || settings.voice !== expected.voice || settings.speed !== 1) throw ttsError(400, 'INVALID_TTS_SETTINGS', 'Cấu hình audio mẫu Azure không hợp lệ.');
  let synthesizer: Synthesizer;
  try {
    synthesizer = options.createSynthesizer ? options.createSynthesizer(credentials, expected) : (() => {
      const config = sdk.SpeechConfig.fromSubscription(credentials.key, credentials.region);
      config.speechSynthesisLanguage = expected.lang;
      config.speechSynthesisVoiceName = expected.voice;
      config.speechSynthesisOutputFormat = sdk.SpeechSynthesisOutputFormat.Audio16Khz64KBitRateMonoMp3;
      return new sdk.SpeechSynthesizer(config, null);
    })();
  } catch { throw ttsError(502, 'AZURE_TTS_FAILED', 'Không khởi tạo được Azure TTS. Kiểm tra cấu hình Speech resource trên backend.'); }
  return new Promise<Buffer>((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error, buffer?: Buffer) => {
      if (settled) return; settled = true; clearTimeout(timer);
      try { synthesizer.close(); } catch { /* Preserve the original outcome. */ }
      if (error) reject(error); else resolve(buffer!);
    };
    const failure = () => finish(ttsError(502, 'AZURE_TTS_FAILED', 'Azure chưa tạo được audio mẫu. Kiểm tra key, region, quyền TTS và quota của Speech resource.'));
    const timer = setTimeout(() => finish(ttsError(504, 'AZURE_TTS_TIMEOUT', 'Azure tạo audio mẫu quá thời gian cho phép. Có thể thử lại thủ công.')), options.timeoutMs ?? 30000);
    try {
      synthesizer.speakTextAsync(input.text, result => {
        if (settled) return;
        if (result.reason !== sdk.ResultReason.SynthesizingAudioCompleted || !(result.audioData instanceof ArrayBuffer)) return failure();
        const buffer = Buffer.from(result.audioData);
        if (buffer.length > (options.maxBytes ?? 3 * 1024 * 1024)) return finish(ttsError(502, 'AZURE_TTS_AUDIO_LIMIT', 'Audio mẫu Azure vượt dung lượng cho phép. Hãy chia nội dung thành mục ngắn hơn.'));
        if (buffer.length < 1024 || !(buffer.subarray(0, 3).toString() === 'ID3' || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0))) return finish(ttsError(502, 'AZURE_TTS_INVALID_AUDIO', 'Azure chưa trả về file MP3 hợp lệ.'));
        finish(undefined, buffer);
      }, failure);
    } catch { failure(); }
  });
}
