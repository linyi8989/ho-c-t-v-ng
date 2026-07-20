export type Role = 'super_admin' | 'teacher' | 'student';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface Class {
  id: string;
  name: string;
  code: string;
  teacherId: string;
}

export interface ClassMember {
  id: string;
  classId: string;
  studentName: string;
}

export interface VocabItem {
  id: string;
  term: string;
  meaning: string;
  ipa: string;
  pos: string; // e.g., Noun, Verb, Adjective, Adverb, Phrase
  example: string;
  exampleMeaning: string;
  imageUrl?: string;
  audioUrl?: string;
  audioPath?: string;
  audioHash?: string;
  audioStatus?: 'missing' | 'queued' | 'generating' | 'ready' | 'failed';
  audioError?: string;
  audioWarnings?: string[];
  audioGeneratedAt?: string;
  audioUpdatedAt?: string;
  ttsProvider?: string;
  ttsVoice?: string;
  ttsLang?: 'en-US' | 'en-GB' | string;
  ttsSpeed?: number;
  ttsText?: string;
  notes?: string;
  displayOrder: number;
}

export interface TtsSettings {
  autoGenerate: boolean;
  provider: string;
  voice: string;
  lang: 'en-US' | 'en-GB' | string;
  speed: number;
}

export interface VocabSet {
  id: string;
  title: string;
  description: string;
  subject: string;
  tags: string[];
  gradeLevel: string; // e.g., "Lớp 3", "Lớp 6", "Lớp 10"
  createdAt: string;
  createdBy: string; // User ID or "system"
  creatorName: string;
  status: 'draft' | 'public' | 'private';
  visibility?: 'public' | 'assignment' | 'draft';
  shareToken?: string;
  assignmentSlug?: string;
  assignmentId?: string;
  assignmentGameId?: string;
  classId?: string;
  className?: string;
  assignmentTitle?: string;
  accessType?: 'assignment' | 'vocab_set';
  ttsSettings?: TtsSettings;
  items: VocabItem[];
}

export interface Assignment {
  id: string;
  shareToken?: string;
  assignmentSlug?: string;
  classId: string;
  className: string;
  vocabSetId: string;
  vocabSetTitle: string;
  gameId: string;
  dueDate: string;
  createdAt: string;
  createdBy: string;
  title: string;
}

export type GrammarVisibility = 'public' | 'assignment' | 'draft';

export interface GrammarOption {
  id: string;
  text: string;
  originalPosition: number;
}

export interface GrammarQuestion {
  id: string;
  questionText: string;
  options: GrammarOption[];
  correctOptionId: string;
  explanation: string;
  score: number;
  position: number;
}

export interface GrammarSet {
  id: string;
  title: string;
  description: string;
  gradeLevel: string;
  classId?: string;
  className?: string;
  subject: string;
  topic: string;
  tags: string[];
  visibility: GrammarVisibility;
  status?: 'draft' | 'public' | 'private';
  shareToken?: string;
  assignmentSlug?: string;
  timeLimitMinutes: number;
  maxAttempts: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  showExplanationImmediately: boolean;
  showReviewAfterSubmit: boolean;
  createdBy: string;
  creatorName?: string;
  createdAt: string;
  updatedAt: string;
  questions: GrammarQuestion[];
}

export interface GrammarAttemptQuestion {
  id: string;
  questionId: string;
  displayPosition: number;
  optionOrder: string[];
  questionSnapshot: string;
  explanationSnapshot?: string;
  scoreSnapshot: number;
  optionsSnapshot: GrammarOption[];
  correctOptionId?: string;
}

export interface GrammarAttemptAnswer {
  id: string;
  attemptQuestionId: string;
  questionId: string;
  selectedOptionId: string;
  correctOptionId?: string;
  isCorrect?: boolean;
  scoreAwarded?: number;
  answeredAt: string;
}

export interface GrammarAttempt {
  id: string;
  grammarSetId: string;
  assignmentId?: string;
  userId: string;
  studentId?: string;
  guestId?: string;
  studentName: string;
  classId?: string;
  className?: string;
  status: 'in_progress' | 'completed';
  score: number;
  maxScore: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  startedAt: string;
  completedAt?: string;
  durationSeconds?: number;
  createdAt: string;
  attemptToken?: string;
  questions: GrammarAttemptQuestion[];
  answers: GrammarAttemptAnswer[];
}

export interface GameSession {
  id: string;
  sourceType?: 'vocabulary' | 'grammar';
  userId?: string;
  studentId?: string;
  assignmentId?: string;
  classId?: string;
  className?: string;
  vocabSetId: string;
  vocabSetTitle: string;
  gameId: string;
  gameName?: string;
  gameType?: string;
  studentName: string;
  guestId?: string;
  startedAt: string;
  endedAt?: string;
  completedAt?: string;
  createdAt?: string;
  expiresAt?: string;
  durationMs?: number;
  durationSeconds?: number;
  accuracy?: number;
  score: number;
  rawScore?: number;
  maxScore?: number;
  totalQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  answerDetails?: GameAnswerDetail[];
  sessionToken?: string;
  schemaVersion?: 1 | 2;
  gradingMode?: 'client-legacy' | 'server' | 'server-self-report';
  saveStatus?: 'started' | 'in_progress' | 'completed' | 'abandoned';
  gameScore?: number;
  snapshot?: { itemOrder: string[]; items: VocabItem[]; config: Record<string, any> };
}

export interface GameAction {
  actionId: string;
  sequence: number;
  type: 'flashcard.rate' | 'quiz.answer' | 'fill.answer' | 'matching.attempt' | 'memory.move' | 'millionaire.answer' | 'speaking.attempt';
  wordId?: string;
  userAnswer?: string;
  firstItemId?: string;
  firstSide?: 'term' | 'meaning';
  secondItemId?: string;
  secondSide?: 'term' | 'meaning';
  recognizedText?: string;
  responseMs?: number;
  attemptNumber?: number;
}

export interface GameAnswerDetail {
  questionIndex: number;
  wordId?: string;
  word?: string;
  questionText?: string;
  correctAnswer?: string;
  userAnswer?: string;
  selectedAnswer?: string;
  isCorrect: boolean;
  timeSpentMs?: number;
  options?: string[];
}

export interface GameCompletionDetails {
  answerDetails?: GameAnswerDetail[];
}

export interface PronunciationAttempt {
  id: string;
  studentId: string;
  studentName?: string;
  vocabularySetId: string;
  wordId: string;
  targetText: string;
  recognizedText: string;
  score: number;
  correctWords: number;
  totalWords: number;
  attemptCount: number;
  playedAt: string;
  gameSessionId?: string;
}

export interface GameConfig {
  gameId: string;
  title: string;
  description: string;
  category: 'flashcard' | 'quiz' | 'fill' | 'matching' | 'memory' | 'millionaire' | 'speaking' | 'speed';
  icon: string; // name of lucide icon
  color: string; // Tailwind bg/text class
  componentName: 'FlashcardGame' | 'QuizGame' | 'FillBlankGame' | 'MatchingGame' | 'MemoryGame' | 'MillionaireGame' | 'SpeakingAIGame' | 'HangmanGame';
  requiredFields: string[];
  config: Record<string, any>;
  hidden?: boolean;
}
