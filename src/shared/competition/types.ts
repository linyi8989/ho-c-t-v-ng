import type { AnswerSpec, AssessmentUserAnswer } from './answer';

export type Subject = 'english' | 'math' | 'math-english' | 'vietnamese';
export type CompetitionLevel = 'practice' | 'school' | 'district' | 'province' | 'national';
export type Interaction = 'choice' | 'text-entry' | 'ordering' | 'matching';
export interface Media { kind: 'image' | 'audio'; url: string; assetId?: string; playbackRate?: number }
export interface Option { id: string; label: string; text: string; media: Media[] }
export interface Scope { subject: Subject; grade: number; level: CompetitionLevel }
export type QuestionFilters = Partial<Scope>;
export interface Question extends Scope {
  id: string; ownerId: string; revision: number; title: string; prompt: string; passage: string;
  sourceNumber: string; interaction: Interaction; options: Option[]; media: Media[];
  answerSpec: AnswerSpec; explanation: string; domain: string; difficulty: number;
  pairs?: { left: Option[]; right: Option[] }; archived?: boolean;
}
export type PlayableQuestion = Omit<Question, 'ownerId' | 'revision' | 'sourceNumber' | 'answerSpec' | 'explanation' | 'domain' | 'difficulty' | 'archived'>;
export interface Blueprint extends Scope { total: number; durationMinutes: number; domains: Record<string, number>; difficulties: Record<string, number> }
export interface Paper extends Scope {
  id: string; ownerId: string; title: string; versionId: string; visibility: 'public' | 'assignment';
  status: 'published' | 'archived'; total: number; durationMinutes: number; createdAt: string;
  blueprint: Blueprint; relaxed: boolean; warnings: string[]; source?: 'bank' | 'mistakes';
}
export type PublicPaper = Pick<Paper, 'id' | 'title' | 'subject' | 'grade' | 'level' | 'total' | 'durationMinutes' | 'visibility'>;
export interface BankTopic extends PublicPaper { source: 'bank'; available: number; storedCount: number; ready: boolean }
export interface MistakeTopic extends PublicPaper { source: 'mistakes'; available: number; ready: boolean; previews: { id: string; prompt: string }[] }
export interface PracticeReport { topics: MistakeTopic[]; pendingCount: number; completedCount: number; lastScore: number | null }
export interface ReviewRow { question: PlayableQuestion; studentAnswer: string; correctAnswer: string; submittedAnswer?: AssessmentUserAnswer; correctOptionId?: string; isCorrect: boolean; unanswered: boolean; pointsAwarded: number; explanation: string }
export interface Result { id: string; title: string; score: number; rawScore: number; maxScore: number; correctCount: number; incorrectCount: number; unansweredCount: number; durationSeconds: number; completedAt: string }
export interface AttemptSession {
  id: string; ticket: string; status: 'prepared' | 'active' | 'completed'; title: string;
  questions: PlayableQuestion[]; answers: Record<string, AssessmentUserAnswer>; revision: number;
  deadline: string | null; serverNow: string; durationMinutes: number; source?: Paper['source']; result?: Result;
}
export const SUBJECT_LABELS: Record<Subject, string> = { english: 'IOE Tiếng Anh', math: 'Toán', 'math-english': 'Toán Tiếng Anh', vietnamese: 'Tiếng Việt' };
export const SUBJECTS = Object.keys(SUBJECT_LABELS) as Subject[];
export const isSubject = (value: unknown): value is Subject => typeof value === 'string' && SUBJECTS.some(subject => subject === value);
export const isMath = (subject: Subject) => subject === 'math' || subject === 'math-english';
export const usesEnglishContent = (subject: Subject) => subject === 'english' || subject === 'math-english';
export const LEVEL_LABELS: Record<CompetitionLevel, string> = { practice: 'Luyện tập', school: 'Trường/Lớp', district: 'Xã/Phường', province: 'Tỉnh/Thành phố', national: 'Quốc gia' };
export const INVENTORY_LEVELS: CompetitionLevel[] = ['school', 'district', 'province', 'national'];
export const levelsFor = (subject: Subject): CompetitionLevel[] => subject === 'english' ? ['practice', ...INVENTORY_LEVELS] : [...INVENTORY_LEVELS];
export interface InventoryRow extends Scope { count: number; unique_count: number; required: number; ready: boolean }
export interface OverviewStats { questions: number; players: number; attempts: number; completed: number }
export interface OverviewReport { inventory: InventoryRow[]; totals: OverviewStats; subjects: Record<Subject, OverviewStats> }
export interface ResultFilters { subject?: Subject; grade?: number; level?: CompetitionLevel; paperId?: string }
export interface ResultSummary extends Scope {
  id: string; student_name: string; class_name: string; score: number; raw_score: number; max_score: number; title: string; completed_at: string;
}
export interface ResultsPage { items: ResultSummary[]; total: number; page: number; pageSize: number }
export function defaultCount(subject: Subject, grade: number) { return subject === 'english' ? (grade <= 2 ? 100 : 200) : 30; }
export function displayTitle(title: string, number: number) { return title.replace(/^\s*(?:Câu(?:\s+hỏi)?|Question)\s*\d+\s*[:.)-]?\s*/iu, '').trim() || `Câu ${number}`; }
export function playable(question: Question): PlayableQuestion {
  return { id: question.id, subject: question.subject, grade: question.grade, level: question.level, title: question.title,
    prompt: question.prompt, passage: question.passage, interaction: question.interaction, options: question.options,
    media: question.media, ...(question.pairs ? { pairs: question.pairs } : {}) };
}
