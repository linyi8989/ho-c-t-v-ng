export type Role = 'admin' | 'teacher' | 'student';

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
  notes?: string;
  displayOrder: number;
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
  items: VocabItem[];
}

export interface Assignment {
  id: string;
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

export interface GameSession {
  id: string;
  assignmentId?: string;
  vocabSetId: string;
  vocabSetTitle: string;
  gameId: string;
  studentName: string;
  guestId?: string;
  startedAt: string;
  completedAt?: string;
  score: number;
  totalQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
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
}
