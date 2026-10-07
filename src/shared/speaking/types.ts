export const KIND_LABELS = { word: 'Từ vựng', sentence: 'Câu', dialogue: 'Hội thoại', passage: 'Đoạn văn' } as const;
export type SpeakingKind = keyof typeof KIND_LABELS;
export type ProviderId = 'azure' | 'speechsuper';
export interface ReadingItem { id: string; referenceText: string; sampleAudioUrl: string; samplePlaybackRate: number }
export const MAX_READING_ITEMS = 50;
export interface LessonInput {
  title: string; referenceText: string; partnerText: string; instructions: string;
  kind: SpeakingKind; locale: 'en-US' | 'en-GB'; grade: number; maxSeconds: number;
  provider: ProviderId; sampleAudioUrl: string; samplePlaybackRate: number; feedbackEnabled: boolean; items?: ReadingItem[];
}
export interface Lesson extends LessonInput {
  id: string; ownerId: string; revision: number; versionId: string; status: 'draft' | 'published' | 'archived'; createdAt: string; updatedAt: string;
}
export type PublicLesson = Omit<Lesson, 'ownerId'>;
export interface PhoneScore { phone: string; alphabet: 'ipa' | 'arpa' | 'provider'; score: number; startMs: number | null; durationMs: number | null }
export interface WordScore {
  text: string; referenceIndex: number | null; error: 'none' | 'mispronunciation' | 'omission' | 'insertion';
  accuracy: number | null; startMs: number | null; durationMs: number | null; phonemes: PhoneScore[];
}
export interface Assessment {
  schemaVersion: 1; provider: ProviderId; providerVersion: string; rubricVersion: 'reading-v1';
  score: number; providerOverall: number | null; accuracy: number; fluency: number | null;
  completeness: number; prosody: number | null; rhythm: number | null; transcript: string; words: WordScore[];
  prosodyStatus?: 'available' | 'disabled' | 'unsupported-locale' | 'not-returned';
  warnings: string[]; elapsedMs: number;
}
export interface Feedback { summary: string; strengths: string[]; improvements: string[]; practice: string[]; holisticScore: number | null; evidenceMode: 'metrics' | 'audio' }
export interface AttemptView {
  id: string; ticket?: string; lesson: PublicLesson; sessionId?: string; itemId?: string; itemNumber?: number;
  recordingAllowed?: boolean;
  queueState?: 'queued' | 'waiting';
  status: 'prepared' | 'queued' | 'assessing' | 'completed' | 'failed'; createdAt: string; completedAt: string | null;
  assessment: Assessment | null; feedback: Feedback | null; feedbackState: 'disabled' | 'pending' | 'ready' | 'failed';
  error: string; audioAvailable: boolean; durationSeconds: number | null;
}
export interface SessionItemProgress { item: ReadingItem; score: number | null; attempt: AttemptView | null }
export interface SpeakingSessionView {
  reviewType: 'speaking-session-v1'; id: string; lesson: PublicLesson;
  status: 'in_progress' | 'completed'; createdAt: string; completedAt: string | null;
  score: number | null; completedCount: number; totalItems: number; items: SessionItemProgress[];
}
export type SpeakingReviewData = AttemptView | SpeakingSessionView;
export function lessonItems(lesson: LessonInput): ReadingItem[] {
  return lesson.items || [{ id: '1', referenceText: lesson.referenceText, sampleAudioUrl: lesson.sampleAudioUrl, samplePlaybackRate: lesson.samplePlaybackRate }];
}
export function isSetLesson(lesson: LessonInput) { return (lesson.kind === 'word' || lesson.kind === 'sentence') && Boolean(lesson.items?.length); }
export interface Capabilities {
  enabled: boolean; reason: string; schemaVersion: 1; primaryProvider: ProviderId;
  providers: { id: ProviderId; label: string; configured: boolean; maxSeconds: number }[];
  sampleTts?: { configured: boolean; reason: string; provider?: 'b' | 'azure' };
  azureProsody?: { enabled: boolean; locale: 'en-US'; includesRhythm: true };
  feedback: { configured: boolean; mode: 'metrics' | 'audio'; provider?: 'gemini' | 'devquota' | 'stali' | 'none'; model?: string; reason?: string }; maxAudioBytes: number;
}
export interface ResultSummary { id: string; title: string; kind: SpeakingKind; grade: number; locale: string; studentName: string; className: string; provider: ProviderId; score: number; completedAt: string; isSession?: boolean; totalItems?: number }
export class SpeakingError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); this.name = 'SpeakingError'; }
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SpeakingError(400, 'INVALID_INPUT', 'Dữ liệu không hợp lệ.');
  return value as Record<string, unknown>;
}
export function text(value: unknown, max: number, required = false) {
  if (value !== undefined && typeof value !== 'string') throw new SpeakingError(400, 'INVALID_INPUT', 'Nội dung phải là văn bản.');
  const result = String(value || '').normalize('NFC').trim();
  if (result.length > max || (required && !result)) throw new SpeakingError(400, 'INVALID_INPUT', `Nội dung cần từ ${required ? 1 : 0} đến ${max} ký tự.`);
  return result;
}
export function integer(value: unknown, min: number, max: number) {
  const result = typeof value === 'string' && value.trim() ? Number(value) : value;
  if (typeof result !== 'number' || !Number.isInteger(result) || result < min || result > max) throw new SpeakingError(400, 'INVALID_INPUT', `Số cần nằm trong khoảng ${min}–${max}.`);
  return result;
}
export function normalizeLesson(value: unknown): LessonInput {
  const v = object(value), kind = v.kind as SpeakingKind;
  if (!(typeof kind === 'string' && Object.hasOwn(KIND_LABELS, kind))) throw new SpeakingError(400, 'INVALID_KIND', 'Chọn dạng bài hợp lệ.');
  if (v.locale !== 'en-US' && v.locale !== 'en-GB') throw new SpeakingError(400, 'INVALID_LOCALE', 'Chọn giọng Anh-Mỹ hoặc Anh-Anh.');
  if (v.provider !== 'azure' && v.provider !== 'speechsuper') throw new SpeakingError(400, 'INVALID_PROVIDER', 'Chọn Azure hoặc SpeechSuper.');
  let items: ReadingItem[] | undefined;
  if (v.items !== undefined) {
    if (kind !== 'word' && kind !== 'sentence') throw new SpeakingError(400, 'INVALID_ITEMS', 'Hội thoại và đoạn văn dùng một nội dung.');
    if (!Array.isArray(v.items) || !v.items.length || v.items.length > MAX_READING_ITEMS) throw new SpeakingError(400, 'INVALID_ITEMS', `Bộ luyện đọc cần từ 1 đến ${MAX_READING_ITEMS} mục.`);
    items = v.items.map((entry, index) => {
      try {
        const item = object(entry);
        const validated = normalizeLesson({ ...v, items: undefined, referenceText: item.referenceText, sampleAudioUrl: item.sampleAudioUrl, samplePlaybackRate: item.samplePlaybackRate });
        return { id: String(index + 1), referenceText: validated.referenceText, sampleAudioUrl: validated.sampleAudioUrl, samplePlaybackRate: validated.samplePlaybackRate };
      } catch (error) {
        if (error instanceof SpeakingError) throw new SpeakingError(error.status, error.code, `Mục ${index + 1}: ${error.message}`);
        throw error;
      }
    });
    if (items.reduce((sum, item) => sum + item.referenceText.length, 0) > 20000) throw new SpeakingError(400, 'INVALID_ITEMS', 'Tổng nội dung của bộ tối đa 20.000 ký tự.');
  }
  const referenceText = items ? items[0].referenceText : text(v.referenceText, 6000, true), words = referenceText.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu) || [];
  if (!words.length || words.length > 400 || (kind === 'word' && words.length !== 1)) throw new SpeakingError(400, 'INVALID_REFERENCE', 'Bài từ vựng dùng một từ; các bài khác tối đa 400 từ.');
  const sampleAudioUrl = text(items ? items[0].sampleAudioUrl : v.sampleAudioUrl, 250).replace(/\?v=\d+$/, '');
  if (sampleAudioUrl && !/^\/audio\/[A-Za-z0-9_-]+\.(?:mp3|wav|ogg)$/i.test(sampleAudioUrl)) throw new SpeakingError(400, 'INVALID_MEDIA', 'Chọn audio được quản lý bởi B.');
  const samplePlaybackRate = v.samplePlaybackRate === undefined ? 1 : Number(v.samplePlaybackRate);
  if (v.samplePlaybackRate !== undefined && typeof v.samplePlaybackRate !== 'number') throw new SpeakingError(400, 'INVALID_MEDIA', 'Tốc độ audio cần là số.');
  if (!Number.isFinite(samplePlaybackRate) || samplePlaybackRate < .5 || samplePlaybackRate > 1.5) throw new SpeakingError(400, 'INVALID_MEDIA', 'Tốc độ audio không hợp lệ.');
  if (v.feedbackEnabled !== undefined && typeof v.feedbackEnabled !== 'boolean') throw new SpeakingError(400, 'INVALID_INPUT', 'Cấu hình nhận xét không hợp lệ.');
  return { title: text(v.title, 200, true), referenceText, partnerText: text(v.partnerText, 3000), instructions: text(v.instructions, 2000),
    kind, locale: v.locale, provider: v.provider, grade: integer(v.grade, 1, 9), maxSeconds: integer(v.maxSeconds, 1, kind === 'word' ? 8 : kind === 'passage' ? 300 : 30),
    sampleAudioUrl, samplePlaybackRate: items ? items[0].samplePlaybackRate : samplePlaybackRate, feedbackEnabled: v.feedbackEnabled === true, ...(items ? { items } : {}) };
}
export function publicLesson(lesson: Lesson): PublicLesson { const { ownerId: _owner, ...safe } = lesson; return safe; }
