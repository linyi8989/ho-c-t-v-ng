import React, { useState, useEffect } from 'react';
import { 
  Plus, Edit2, Edit3, Trash2, Copy, Search, Filter, BookOpen, Layers, Users,
  Calendar, Award, Sparkles, Check, Play, RefreshCw, Send, AlertCircle, ListPlus, Volume2,
  Shield, FileText, Lock, Unlock, Star, X, ChevronLeft, ChevronRight, ChevronDown, MoreHorizontal, Headphones,
  SlidersHorizontal
} from 'lucide-react';
import { VocabSet, VocabItem, Class, ClassMember, Assignment, GameSession, TtsSettings, GrammarSet, GrammarQuestion, GrammarQuestionType } from '../../types';
import { GAMES_LIST } from '../../lib/game-engine/gameList';
import { playAudioUrl, playVocabAudio, resolveTtsPlaybackRate, speakEnglish } from '../../lib/game-engine/speech';
import { useAuth } from '../../context/AuthContext';
import { STUDENT_NAME_MAX_LENGTH, validateStudentDisplayName } from '../../lib/studentIdentity';
import { getLeaderboardByCategory, LeaderboardCategory, LeaderboardPeriod } from '../../lib/leaderboard';
import { LibraryLinkStatus, LibraryRowActions } from './LibraryRowControls';
import {
  formatListeningReviewAnswer,
  formatListeningReviewQuestion,
} from '../../features/listening/reviewPresentation';

const ListeningLibraryAdmin = React.lazy(() => import('../../features/listening-library/admin/ListeningLibraryAdmin'));

interface AdminDashboardProps {
  onViewAsStudent: (set: VocabSet, gameId?: string, assignmentId?: string) => void;
  onViewGrammarAsStudent?: (set: GrammarSet) => void;
}

type AdminTab = 'dashboard' | 'vocab-sets' | 'editor' | 'grammar-sets' | 'grammar-editor' | 'listening-library' | 'classes' | 'assignments' | 'results' | 'users' | 'audit-logs';
type VocabVisibility = 'public' | 'assignment' | 'draft';

const getSetVisibility = (set: VocabSet): VocabVisibility => {
  if (set.visibility === 'public' || set.visibility === 'assignment' || set.visibility === 'draft') {
    return set.visibility;
  }
  if (set.status === 'private') return 'assignment';
  if (set.status === 'public') return 'public';
  return 'draft';
};

const getAssignmentLink = (set: VocabSet) => {
  const token = set.shareToken || set.assignmentSlug;
  return token ? `${window.location.origin}/assignment/${token}` : '';
};

const getAssignmentRecordLink = (assignment: Assignment) => {
  const token = assignment.shareToken || assignment.assignmentSlug;
  if (!token) return '';
  if (assignment.resourceType === 'listening') {
    const setId = assignment.resourceId || assignment.listeningSetId;
    return setId
      ? `${window.location.origin}/listening/${setId}?accessToken=${encodeURIComponent(token)}`
      : '';
  }
  return `${window.location.origin}/assignment/${token}`;
};

const getGrammarPrivateLink = (set: GrammarSet) => {
  const token = (set.shareToken || set.assignmentSlug || '').replace(/^grammar-/, '');
  return token ? `${window.location.origin}/grammar/private/${token}` : '';
};

function formatVisibilityLabel(value: string) {
  if (value === 'public') return 'Công khai';
  if (value === 'draft') return 'Bản nháp';
  return 'Link riêng';
}

function getCreatedAtTimestamp(value?: string) {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

const DEFAULT_TTS_SETTINGS: TtsSettings = {
  autoGenerate: false,
  provider: 'ai33',
  voice: 'elevenlabs_wMBr6SfqQVuOqplK01NE',
  lang: 'en-US',
  speed: 1
};

const DEFAULT_TTS_VOICE_BY_PROVIDER: Record<string, string> = {
  ai33: 'elevenlabs_wMBr6SfqQVuOqplK01NE',
  yupvox: 'EBF147'
};

const TTS_VOICE_OPTIONS = [
  { value: 'elevenlabs_wMBr6SfqQVuOqplK01NE', label: 'ElevenLabs default - en-US' },
  { value: 'edge_en-US-AriaNeural', label: 'Edge Aria - en-US' },
  { value: 'edge_en-US-JennyNeural', label: 'Edge Jenny - en-US' },
  { value: 'edge_en-GB-SoniaNeural', label: 'Edge Sonia - en-GB' },
  { value: 'edge_en-GB-RyanNeural', label: 'Edge Ryan - en-GB' },
  { value: 'EBF147', label: 'YupVox EBF147' }
];

const DEFAULT_GRADE_OPTIONS = ['Lớp 3', 'Lớp 6', 'Lớp 10'];

function formatGradeLabel(value?: string) {
  return (value || '')
    .replace(/Lá»›p/g, 'Lớp')
    .replace(/LÃ¡Â»â€ºp/g, 'Lớp');
}

function formatLeaderboardDisplayName(entry: { studentName: string; className?: string }) {
  const className = formatGradeLabel(entry.className).trim();
  return className ? `${entry.studentName} - ${className}` : entry.studentName;
}

function formatVietnamDateTime(value?: string) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  const pad = (num: number) => num.toString().padStart(2, '0');
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatDuration(totalSeconds?: number) {
  const secs = Math.max(0, Math.round(totalSeconds || 0));
  const mins = Math.floor(secs / 60);
  const remainingSecs = secs % 60;
  return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
}

const LIBRARY_PAGE_SIZE_OPTIONS = [10, 20, 50];

function getPageItems(currentPage: number, totalPages: number): Array<number | 'ellipsis'> {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  if (currentPage <= 4) return [1, 2, 3, 4, 5, 'ellipsis', totalPages];
  if (currentPage >= totalPages - 3) {
    return [1, 'ellipsis', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, 'ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', totalPages];
}

function LibraryPagination({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange
}: {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  if (totalItems === 0) return null;

  const pageItems = getPageItems(currentPage, totalPages);
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 bg-white border border-gray-100 rounded-2xl shadow-sm">
      <p className="text-xs font-semibold text-gray-500">
        Hiển thị {Math.min((currentPage - 1) * pageSize + 1, totalItems)} - {Math.min(currentPage * pageSize, totalItems)} trên {totalItems}
      </p>
      <div className="flex items-center justify-between sm:justify-end gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Trang trước"
          >
            <ChevronLeft size={15} />
          </button>
          {pageItems.map((item, index) => item === 'ellipsis' ? (
            <span key={`ellipsis-${index}`} className="h-8 w-8 inline-flex items-center justify-center text-gray-400" aria-hidden="true">
              <MoreHorizontal size={15} />
            </span>
          ) : (
            <button
              type="button"
              key={item}
              onClick={() => onPageChange(item)}
              className={`h-8 min-w-8 px-2 inline-flex items-center justify-center rounded-lg text-xs font-bold transition-colors ${
                item === currentPage ? 'border border-blue-500 text-blue-700 bg-blue-50' : 'text-gray-600 hover:bg-gray-50'
              }`}
              aria-current={item === currentPage ? 'page' : undefined}
            >
              {item}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Trang sau"
          >
            <ChevronRight size={15} />
          </button>
        </div>
        <select
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          className="h-8 rounded-lg border border-blue-300 bg-white px-2 text-xs font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-blue-100"
          aria-label="Số dòng mỗi trang"
        >
          {LIBRARY_PAGE_SIZE_OPTIONS.map(size => <option key={size} value={size}>{size} / trang</option>)}
        </select>
      </div>
    </div>
  );
}

function grammarAttemptToActivity(attempt: any, set?: GrammarSet | null): GameSession {
  const totalQuestions = Math.max(
    1,
    Number(attempt.correctCount || 0) + Number(attempt.wrongCount || 0) + Number(attempt.unansweredCount || 0)
      || Number(attempt.questions?.length || 0)
      || 1
  );
  const correctAnswers = Number(attempt.correctCount || 0);
  const incorrectAnswers = Number(attempt.wrongCount || 0) + Number(attempt.unansweredCount || 0);
  const accuracy = Math.round((correctAnswers / totalQuestions) * 100);
  const answersByQuestion = new Map<string, any>();
  (attempt.answers || []).forEach((answer: any) => answersByQuestion.set(answer.attemptQuestionId, answer));

  return {
    id: `grammar-${attempt.id}`,
    sourceType: 'grammar',
    userId: attempt.userId,
    studentId: attempt.userId,
    guestId: attempt.guestId || '',
    studentName: attempt.studentName || 'Học sinh',
    assignmentId: attempt.assignmentId || '',
    classId: attempt.classId || '',
    className: attempt.className || '',
    vocabSetId: `grammar:${attempt.grammarSetId || set?.id || ''}`,
    vocabSetTitle: attempt.grammarSetTitle || set?.title || 'Bài ngữ pháp',
    gameId: 'grammar-practice',
    gameName: 'Luyện ngữ pháp',
    gameType: 'grammar',
    startedAt: attempt.startedAt || attempt.createdAt || attempt.completedAt,
    endedAt: attempt.completedAt,
    completedAt: attempt.completedAt,
    createdAt: attempt.createdAt || attempt.startedAt || attempt.completedAt,
    durationMs: Math.max(0, Number(attempt.durationSeconds || 0)) * 1000,
    durationSeconds: Math.max(0, Number(attempt.durationSeconds || 0)),
    score: accuracy,
    rawScore: Number(attempt.score || 0),
    maxScore: Number(attempt.maxScore || totalQuestions),
    totalQuestions,
    correctAnswers,
    incorrectAnswers,
    accuracy,
    answerDetails: (attempt.questions || []).map((question: any, index: number) => {
      const answer = answersByQuestion.get(question.id);
      const selectedOption = (question.optionsSnapshot || []).find((option: any) => option.id === answer?.selectedOptionId);
      const correctOption = (question.optionsSnapshot || []).find((option: any) => option.id === question.correctOptionId || option.id === answer?.correctOptionId);
      const isRewrite = question.questionType === 'rewrite' || set?.questionType === 'rewrite';
      const userAnswer = isRewrite ? answer?.textAnswer || '' : selectedOption?.text || '';
      const correctAnswer = isRewrite
        ? question.correctAnswerSnapshot || answer?.correctAnswer || ''
        : correctOption?.text || '';
      return {
        questionIndex: index,
        wordId: question.questionId,
        questionText: question.questionSnapshot,
        selectedAnswer: userAnswer,
        userAnswer,
        correctAnswer,
        isCorrect: Boolean(answer?.isCorrect),
        options: (question.optionsSnapshot || []).map((option: any) => option.text).filter(Boolean)
      };
    })
  };
}

function getSessionEndTime(session: GameSession) {
  return session.endedAt || session.completedAt;
}

function normalizeActivitySearchText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
}

type ParsedBulkVocabularyRow = Pick<VocabItem, 'term' | 'meaning' | 'ipa' | 'pos' | 'example' | 'exampleMeaning'>;

function parseBulkVocabularyText(input: string): { rows: ParsedBulkVocabularyRow[]; errors: string[] } {
  const rows: ParsedBulkVocabularyRow[] = [];
  const errors: string[] = [];
  const lines = input.split(/\r?\n/);

  if (lines.length > 500) {
    errors.push('Chi co the nhap toi da 500 dong moi lan.');
  }

  lines.slice(0, 500).forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) return;

    const separatorCount = (line.match(/\|/g) || []).length;
    if (separatorCount < 1) {
      errors.push(`Dong ${index + 1}: thieu dau | giua tu tieng Anh va nghia tieng Viet.`);
      return;
    }
    if (separatorCount > 3) {
      errors.push(`Dong ${index + 1}: qua nhieu cot. Hay dung word | meaning | ipa | partOfSpeech.`);
      return;
    }

    const parts = line.split('|').map(part => part.trim());
    if (parts.length < 2 || parts.length > 4) {
      errors.push(`Dong ${index + 1}: sai dinh dang. Hay dung word | meaning | ipa | partOfSpeech.`);
      return;
    }

    const [term = '', meaning = '', ipa = '', pos = ''] = parts;
    if (!term || !meaning) {
      errors.push(`Dong ${index + 1}: thieu tu tieng Anh hoac nghia tieng Viet.`);
      return;
    }

    rows.push({
      term: term.slice(0, 160),
      meaning: meaning.slice(0, 500),
      ipa: ipa.slice(0, 120),
      pos: pos.slice(0, 120),
      example: '',
      exampleMeaning: ''
    });
  });

  return { rows, errors };
}

function parseBulkGrammarText(input: string): { questions: GrammarQuestion[]; errors: string[]; warnings: string[] } {
  const questions: GrammarQuestion[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const blocks = input
    .split(/\n\s*\n+/)
    .map(block => block.trim())
    .filter(Boolean);

  blocks.forEach((block, blockIndex) => {
    const lines = block.split(/\r?\n/);
    const data: Record<string, string> = {};
    let currentKey = '';

    lines.forEach(rawLine => {
      const line = rawLine.trim();
      if (!line) return;
      const match = line.match(/^(question|a|b|c|d|answer|explanation)\s*:\s*(.*)$/i);
      if (match) {
        currentKey = match[1].toUpperCase();
        data[currentKey] = match[2].trim();
      } else if (currentKey === 'EXPLANATION') {
        data.EXPLANATION = `${data.EXPLANATION || ''}\n${line}`.trim();
      }
    });

    const unsupportedOption = lines
      .map(line => line.trim().match(/^([E-Z])\s*:/i)?.[1]?.toUpperCase())
      .find(Boolean);
    if (unsupportedOption) {
      errors.push(`Câu số ${blockIndex + 1} có đáp án ${unsupportedOption}; mỗi câu chỉ được có tối đa 4 đáp án A, B, C, D.`);
      return;
    }

    const missing = ['QUESTION', 'A', 'B', 'ANSWER', 'EXPLANATION'].filter(key => !data[key]);
    if (missing.length > 0) {
      errors.push(`Câu số ${blockIndex + 1} không được nhập vì thiếu ${missing.join(', ')}.`);
      return;
    }

    const answerKey = data.ANSWER.toUpperCase();
    if (data.D && !data.C) {
      errors.push(`Câu số ${blockIndex + 1} có đáp án D nhưng thiếu đáp án C.`);
      return;
    }

    const optionKeys = ['A', 'B'];
    if (data.C) optionKeys.push('C');
    if (data.D) optionKeys.push('D');
    if (!optionKeys.includes(answerKey)) {
      errors.push(`Câu số ${blockIndex + 1} có ANSWER là ${data.ANSWER}, nhưng câu này chỉ có đáp án ${optionKeys.join(', ')}.`);
      return;
    }

    const optionValues = optionKeys.map(key => data[key].trim());
    if (new Set(optionValues.map(value => value.toLowerCase())).size !== optionValues.length) {
      warnings.push(`Câu số ${blockIndex + 1} có phương án trùng nhau.`);
    }

    const questionId = `grammar-question-${Date.now()}-${blockIndex}`;
    const options = optionValues.map((text, index) => ({
      id: `${questionId}-option-${index + 1}`,
      text,
      originalPosition: index + 1
    }));
    const correctIndex = optionKeys.indexOf(answerKey);

    questions.push({
      id: questionId,
      questionText: data.QUESTION.trim(),
      options,
      correctOptionId: options[correctIndex].id,
      explanation: data.EXPLANATION.trim(),
      score: 1,
      position: questions.length + 1
    });
  });

  const seenQuestions = new Map<string, number>();
  questions.forEach((question, index) => {
    const key = question.questionText.toLowerCase().replace(/\s+/g, ' ').trim();
    if (seenQuestions.has(key)) {
      warnings.push(`Câu số ${index + 1} bị trùng nội dung với câu ${seenQuestions.get(key)}.`);
    } else {
      seenQuestions.set(key, index + 1);
    }
  });

  return { questions, errors, warnings };
}

function parseBulkRewriteText(input: string): { questions: GrammarQuestion[]; errors: string[]; warnings: string[] } {
  const questions: GrammarQuestion[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  const blocks = input
    .split(/\n\s*\n+/)
    .map(block => block.trim())
    .filter(Boolean);

  blocks.forEach((block, blockIndex) => {
    const lines = block.split(/\r?\n/);
    const data: Record<string, string> = {};
    let currentKey = '';

    lines.forEach(rawLine => {
      const line = rawLine.trim();
      if (!line) return;
      const match = line.match(/^(question|answer|accepted(?:_answers)?|alternatives|explanation)\s*:\s*(.*)$/i);
      if (match) {
        const parsedKey = match[1].toUpperCase();
        currentKey = parsedKey === 'ACCEPTED' || parsedKey === 'ACCEPTED_ANSWERS' || parsedKey === 'ALTERNATIVES'
          ? 'ACCEPTED'
          : parsedKey;
        const value = match[2].trim();
        data[currentKey] = currentKey === 'ACCEPTED' && data[currentKey]
          ? `${data[currentKey]}\n${value}`.trim()
          : value;
      } else if (currentKey === 'QUESTION' || currentKey === 'ANSWER' || currentKey === 'ACCEPTED' || currentKey === 'EXPLANATION') {
        data[currentKey] = `${data[currentKey] || ''}\n${line}`.trim();
      }
    });

    const missing = ['QUESTION', 'ANSWER', 'EXPLANATION'].filter(key => !data[key]);
    if (missing.length > 0) {
      errors.push(`Câu số ${blockIndex + 1} không được nhập vì thiếu ${missing.join(', ')}.`);
      return;
    }

    questions.push({
      id: `grammar-rewrite-question-${Date.now()}-${blockIndex}`,
      questionType: 'rewrite',
      questionText: data.QUESTION.trim(),
      options: [],
      correctOptionId: '',
      correctAnswer: data.ANSWER.trim(),
      acceptedAnswers: (data.ACCEPTED || '')
        .split(/\r?\n/)
        .map(answer => answer.trim())
        .filter(Boolean),
      explanation: data.EXPLANATION.trim(),
      score: 1,
      position: questions.length + 1
    });
  });

  const seenQuestions = new Map<string, number>();
  questions.forEach((question, index) => {
    const key = question.questionText.toLowerCase().replace(/\s+/g, ' ').trim();
    if (seenQuestions.has(key)) {
      warnings.push(`Câu số ${index + 1} bị trùng nội dung với câu ${seenQuestions.get(key)}.`);
    } else {
      seenQuestions.set(key, index + 1);
    }
  });

  return { questions, errors, warnings };
}

export default function AdminDashboard({ onViewAsStudent, onViewGrammarAsStudent }: AdminDashboardProps) {
  const { user, token } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [vocabSets, setVocabSets] = useState<VocabSet[]>([]);
  const [grammarSets, setGrammarSets] = useState<GrammarSet[]>([]);
  const [listeningSets, setListeningSets] = useState<any[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [classMembers, setClassMembers] = useState<ClassMember[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [results, setResults] = useState<GameSession[]>([]);
  const [leaderboardResults, setLeaderboardResults] = useState<GameSession[]>([]);

  // Super Admin States
  const [usersList, setUsersList] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [usersSearch, setUsersSearch] = useState('');
  const [usersRoleFilter, setUsersRoleFilter] = useState('');
  const [usersStatusFilter, setUsersStatusFilter] = useState('');
  const [editingAccount, setEditingAccount] = useState<any | null>(null);
  const [editingAccountName, setEditingAccountName] = useState('');
  
  // Searching/Filtering state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [vocabPage, setVocabPage] = useState(1);
  const [vocabPageSize, setVocabPageSize] = useState(10);
  const [grammarSearchQuery, setGrammarSearchQuery] = useState('');
  const [grammarFilterGrade, setGrammarFilterGrade] = useState('');
  const [grammarFilterStatus, setGrammarFilterStatus] = useState('');
  const [grammarPage, setGrammarPage] = useState(1);
  const [grammarPageSize, setGrammarPageSize] = useState(10);
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<LeaderboardPeriod>('week');
  const [leaderboardCategory, setLeaderboardCategory] = useState<LeaderboardCategory>('gold');
  const [leaderboardClassId, setLeaderboardClassId] = useState('');
  const [leaderboardVocabSetId, setLeaderboardVocabSetId] = useState('');
  const [selectedActivity, setSelectedActivity] = useState<GameSession | null>(null);
  const [activitySearch, setActivitySearch] = useState('');
  const [isDashboardActivityExpanded, setIsDashboardActivityExpanded] = useState(false);
  const [isDashboardLeaderboardExpanded, setIsDashboardLeaderboardExpanded] = useState(false);

  // Class Roster dynamic input states
  const [newMemberNames, setNewMemberNames] = useState<Record<string, string>>({});

  // Active Vocab Set Editor State
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [editorTitle, setEditorTitle] = useState('');
  const [editorDescription, setEditorDescription] = useState('');
  const [editorSubject, setEditorSubject] = useState('English');
  const [editorGrade, setEditorGrade] = useState('Lớp 3');
  const [editorStatus, setEditorStatus] = useState<VocabVisibility>('public');
  const [editorTags, setEditorTags] = useState<string[]>([]);
  const [editorItems, setEditorItems] = useState<VocabItem[]>([]);
  const [ttsSettings, setTtsSettings] = useState<TtsSettings>(DEFAULT_TTS_SETTINGS);
  const [isPreviewingTts, setIsPreviewingTts] = useState(false);
  const [ttsQueuedSetId, setTtsQueuedSetId] = useState<string | null>(null);
  const [isBatchGeneratingAudio, setIsBatchGeneratingAudio] = useState(false);

  // Quick Batch Add States
  const [batchTerms, setBatchTerms] = useState('');
  const [batchMeanings, setBatchMeanings] = useState('');
  const [batchIpas, setBatchIpas] = useState('');
  const [batchPartsOfSpeech, setBatchPartsOfSpeech] = useState('');
  const [batchExamples, setBatchExamples] = useState('');
  const [batchExampleMeanings, setBatchExampleMeanings] = useState('');
  const [batchVocabularyText, setBatchVocabularyText] = useState('');

  // Grammar editor state
  const [editingGrammarSetId, setEditingGrammarSetId] = useState<string | null>(null);
  const [grammarQuestionType, setGrammarQuestionType] = useState<GrammarQuestionType>('multiple_choice');
  const [grammarTitle, setGrammarTitle] = useState('');
  const [grammarDescription, setGrammarDescription] = useState('');
  const [grammarGrade, setGrammarGrade] = useState('Lớp 3');
  const [grammarSubject, setGrammarSubject] = useState('English Grammar');
  const [grammarTopic, setGrammarTopic] = useState('');
  const [grammarVisibility, setGrammarVisibility] = useState<'public' | 'assignment' | 'draft'>('public');
  const [grammarTags, setGrammarTags] = useState('grammar');
  const [grammarTimeLimitMinutes, setGrammarTimeLimitMinutes] = useState(0);
  const [grammarMaxAttempts, setGrammarMaxAttempts] = useState(1);
  const [grammarShuffleQuestions, setGrammarShuffleQuestions] = useState(false);
  const [grammarShuffleOptions, setGrammarShuffleOptions] = useState(true);
  const [grammarShowExplanationImmediately, setGrammarShowExplanationImmediately] = useState(false);
  const [grammarShowReviewAfterSubmit, setGrammarShowReviewAfterSubmit] = useState(true);
  const [grammarBulkText, setGrammarBulkText] = useState('');
  const [grammarQuestions, setGrammarQuestions] = useState<GrammarQuestion[]>([]);
  const [vocabResultsSet, setVocabResultsSet] = useState<VocabSet | null>(null);
  const [vocabResults, setVocabResults] = useState<GameSession[]>([]);
  const [isVocabResultsLoading, setIsVocabResultsLoading] = useState(false);
  const [vocabResultsNameFilter, setVocabResultsNameFilter] = useState('');
  const [vocabResultsGameFilter, setVocabResultsGameFilter] = useState('');
  const [vocabResultsGameDropdownOpen, setVocabResultsGameDropdownOpen] = useState(false);
  const [grammarResultsSet, setGrammarResultsSet] = useState<GrammarSet | null>(null);
  const [grammarResults, setGrammarResults] = useState<any[]>([]);

  // AI Generation States
  const [aiTopic, setAiTopic] = useState('');
  const [aiGrade, setAiGrade] = useState('Lớp 3');
  const [aiCount, setAiCount] = useState(5);
  const [isAiGenerating, setIsAiGenerating] = useState(false);

  // New Class State
  const [newClassName, setNewClassName] = useState('');
  
  // New Assignment States
  const [assignClassId, setAssignClassId] = useState('');
  const [assignResourceType, setAssignResourceType] = useState<'vocabulary' | 'listening'>('vocabulary');
  const [assignSetId, setAssignSetId] = useState('');
  const [assignGameId, setAssignGameId] = useState('flashcard-en-vi');
  const [assignDueDate, setAssignDueDate] = useState('');
  const [assignTitle, setAssignTitle] = useState('');

  // Notifications
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [shareLinkNotice, setShareLinkNotice] = useState<{ title: string; url: string } | null>(null);

  const gradeOptions = React.useMemo(() => {
    return Array.from(new Set([
      ...DEFAULT_GRADE_OPTIONS,
      ...classes.map(cls => cls.name).filter(Boolean),
      ...vocabSets.map(set => set.gradeLevel).filter(Boolean),
      editorGrade
    ]));
  }, [classes, vocabSets, editorGrade]);

  const grammarGradeOptions = React.useMemo(() => {
    return Array.from(new Set([
      ...DEFAULT_GRADE_OPTIONS,
      ...classes.map(cls => cls.name).filter(Boolean),
      ...grammarSets.map(set => set.gradeLevel).filter(Boolean),
      grammarGrade
    ]));
  }, [classes, grammarSets, grammarGrade]);

  const teacherDisplayName = React.useMemo(() => {
    const rawName = (user?.name || '').trim();
    if (!rawName) return 'cô';
    const firstName = rawName.split(/\s+/)[0];
    return `cô ${firstName}`;
  }, [user?.name]);

  // Authenticated custom fetch wrapper
  const authFetch = (url: string, options: any = {}) => {
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
  };

  const authFetchJson = async <T,>(url: string, options: any = {}): Promise<T> => {
    const res = await authFetch(url, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || `Request failed with HTTP ${res.status}.`);
    }
    return data as T;
  };

  // Load all initial data from our Express backend
  const refreshData = () => {
    if (!token) return;

    // Vocab Sets
    authFetchJson<VocabSet[]>('/api/vocab-sets')
      .then(data => setVocabSets(data))
      .catch(err => console.error("Error loading vocab sets:", err));

    // Grammar Sets
    authFetchJson<GrammarSet[]>('/api/grammar-sets')
      .then(data => setGrammarSets(Array.isArray(data) ? data : []))
      .catch(err => console.error("Error loading grammar sets:", err));

    authFetchJson<any[]>('/api/listening/admin/sets')
      .then(data => setListeningSets(Array.isArray(data) ? data : []))
      .catch(err => console.error("Error loading listening sets:", err));

    // Classes
    authFetchJson<Class[]>('/api/classes')
      .then(data => setClasses(data))
      .catch(err => console.error("Error loading classes:", err));

    // Class Members
    authFetchJson<ClassMember[]>('/api/class-members')
      .then(data => setClassMembers(data))
      .catch(err => console.error("Error loading class members:", err));

    // Assignments
    authFetchJson<Assignment[]>('/api/assignments')
      .then(data => setAssignments(data))
      .catch(err => console.error("Error loading assignments:", err));

    // Game Results (Completed sessions)
    authFetchJson<GameSession[]>('/api/results')
      .then(data => {
        const recentResults = Array.isArray(data) ? data : [];
        setResults(recentResults);
        setLeaderboardResults(prev => prev.length ? prev : recentResults);
      })
      .catch(err => console.error("Error loading results:", err));

    // Longer-lived leaderboard summary. Falls back to recent results if unavailable.
    authFetchJson<GameSession[]>('/api/leaderboard-results')
      .then(data => {
        if (Array.isArray(data)) setLeaderboardResults(data);
      })
      .catch(err => console.error("Error loading leaderboard results:", err));

    // Teachers receive only guest students from classes they manage; super admins receive all accounts.
    if (user?.role === 'teacher' || user?.role === 'super_admin') {
      authFetchJson<any[]>('/api/admin/accounts')
        .then(data => setUsersList(Array.isArray(data) ? data : []))
        .catch(err => console.error("Error loading admin users:", err));
    }

    if (user?.role === 'super_admin') {
      authFetchJson<any[]>('/api/admin/audit-logs')
        .then(data => setAuditLogs(Array.isArray(data) ? data : []))
        .catch(err => console.error("Error loading admin logs:", err));
    }
  };

  useEffect(() => {
    refreshData();
  }, [token, user]);


  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // --- EDITOR FUNCTIONS ---
  const handleOpenNewEditor = () => {
    setEditingSetId(null);
    setEditorTitle('');
    setEditorDescription('');
    setEditorSubject('General English');
    setEditorGrade('Lớp 3');
    setEditorStatus('public');
    setEditorTags(['basic']);
    setEditorItems([]);
    setTtsSettings(DEFAULT_TTS_SETTINGS);
    setTtsQueuedSetId(null);
    setBatchTerms('');
    setBatchMeanings('');
    setBatchIpas('');
    setBatchPartsOfSpeech('');
    setBatchExamples('');
    setBatchExampleMeanings('');
    setActiveTab('editor');
  };

  const handleOpenNewGrammarEditor = (questionType: GrammarQuestionType = 'multiple_choice') => {
    setEditingGrammarSetId(null);
    setGrammarQuestionType(questionType);
    setGrammarTitle('');
    setGrammarDescription('');
    setGrammarGrade('Lớp 3');
    setGrammarSubject('English Grammar');
    setGrammarTopic('');
    setGrammarVisibility('public');
    setGrammarTags(questionType === 'rewrite' ? 'grammar, tự luận' : 'grammar');
    setGrammarTimeLimitMinutes(0);
    setGrammarMaxAttempts(1);
    setGrammarShuffleQuestions(false);
    setGrammarShuffleOptions(questionType === 'multiple_choice');
    setGrammarShowExplanationImmediately(false);
    setGrammarShowReviewAfterSubmit(true);
    setGrammarBulkText('');
    setGrammarQuestions([]);
    setActiveTab('grammar-editor');
  };

  const handleEditGrammarSet = (set: GrammarSet) => {
    setEditingGrammarSetId(set.id);
    setGrammarQuestionType(set.questionType === 'rewrite' ? 'rewrite' : 'multiple_choice');
    setGrammarTitle(set.title);
    setGrammarDescription(set.description);
    setGrammarGrade(set.gradeLevel);
    setGrammarSubject(set.subject);
    setGrammarTopic(set.topic || '');
    setGrammarVisibility(set.visibility);
    setGrammarTags((set.tags || []).join(', '));
    setGrammarTimeLimitMinutes(set.timeLimitMinutes || 0);
    setGrammarMaxAttempts(set.maxAttempts || 1);
    setGrammarShuffleQuestions(Boolean(set.shuffleQuestions));
    setGrammarShuffleOptions(Boolean(set.shuffleOptions));
    setGrammarShowExplanationImmediately(Boolean(set.showExplanationImmediately));
    setGrammarShowReviewAfterSubmit(set.showReviewAfterSubmit !== false);
    setGrammarQuestions(set.questions || []);
    setGrammarBulkText('');
    setActiveTab('grammar-editor');
  };

  const handleParseGrammarBulk = () => {
    const parsed = grammarQuestionType === 'rewrite'
      ? parseBulkRewriteText(grammarBulkText)
      : parseBulkGrammarText(grammarBulkText);
    if (parsed.questions.length > 0) {
      setGrammarQuestions(prev => [
        ...prev,
        ...parsed.questions.map((question, index) => ({
          ...question,
          position: prev.length + index + 1
        }))
      ]);
    }
    const message = [
      `Đã nhập thành công ${parsed.questions.length}/${parsed.questions.length + parsed.errors.length} câu.`,
      ...parsed.errors,
      ...parsed.warnings
    ].join(' ');
    showNotification(message, parsed.errors.length ? 'error' : 'success');
  };

  const updateGrammarQuestion = (questionId: string, patch: Partial<GrammarQuestion>) => {
    setGrammarQuestions(prev => prev.map(question => question.id === questionId ? { ...question, ...patch } : question));
  };

  const updateGrammarOption = (questionId: string, optionId: string, text: string) => {
    setGrammarQuestions(prev => prev.map(question => {
      if (question.id !== questionId) return question;
      return {
        ...question,
        options: question.options.map(option => option.id === optionId ? { ...option, text } : option)
      };
    }));
  };

  const handleAddGrammarQuestion = () => {
    const questionId = `grammar-question-${Date.now()}`;
    if (grammarQuestionType === 'rewrite') {
      setGrammarQuestions(prev => [
        ...prev,
        {
          id: questionId,
          questionType: 'rewrite',
          questionText: '',
          options: [],
          correctOptionId: '',
          correctAnswer: '',
          acceptedAnswers: [],
          explanation: '',
          score: 1,
          position: prev.length + 1
        }
      ]);
      return;
    }

    const options = [1, 2, 3, 4].map(index => ({
      id: `${questionId}-option-${index}`,
      text: '',
      originalPosition: index
    }));
    setGrammarQuestions(prev => [
      ...prev,
      {
        id: questionId,
        questionType: 'multiple_choice',
        questionText: '',
        options,
        correctOptionId: options[0].id,
        explanation: '',
        score: 1,
        position: prev.length + 1
      }
    ]);
  };

  const handleDuplicateGrammarQuestion = (question: GrammarQuestion) => {
    const questionId = `grammar-question-${Date.now()}`;
    if (grammarQuestionType === 'rewrite') {
      setGrammarQuestions(prev => [
        ...prev,
        {
          ...question,
          id: questionId,
          questionType: 'rewrite',
          options: [],
          correctOptionId: '',
          position: prev.length + 1
        }
      ]);
      return;
    }

    const options = question.options.map((option, index) => ({
      ...option,
      id: `${questionId}-option-${index + 1}`,
      originalPosition: index + 1
    }));
    const originalCorrectIndex = question.options.findIndex(option => option.id === question.correctOptionId);
    setGrammarQuestions(prev => [
      ...prev,
      {
        ...question,
        id: questionId,
        options,
        correctOptionId: options[Math.max(0, originalCorrectIndex)]?.id || options[0].id,
        position: prev.length + 1
      }
    ]);
  };

  const handleSaveGrammarSet = () => {
    if (!grammarTitle.trim()) return showNotification('Vui lòng nhập tên bài ngữ pháp.', 'error');
    if (grammarQuestions.length === 0) return showNotification('Bài ngữ pháp cần ít nhất một câu hỏi.', 'error');

    const payload = {
      questionType: grammarQuestionType,
      title: grammarTitle,
      description: grammarDescription,
      gradeLevel: grammarGrade,
      subject: grammarSubject,
      topic: grammarTopic,
      visibility: grammarVisibility,
      tags: grammarTags.split(',').map(tag => tag.trim()).filter(Boolean),
      timeLimitMinutes: grammarTimeLimitMinutes,
      maxAttempts: grammarMaxAttempts,
      shuffleQuestions: grammarShuffleQuestions,
      shuffleOptions: grammarQuestionType === 'multiple_choice' ? grammarShuffleOptions : false,
      showExplanationImmediately: grammarShowExplanationImmediately,
      showReviewAfterSubmit: grammarShowReviewAfterSubmit,
      questions: grammarQuestions.map((question, index) => ({ ...question, position: index + 1 }))
    };

    const url = editingGrammarSetId ? `/api/admin/grammar-sets/${editingGrammarSetId}` : '/api/admin/grammar-sets';
    const method = editingGrammarSetId ? 'PUT' : 'POST';
    authFetch(url, {
      method,
      body: JSON.stringify(payload)
    })
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.details?.join(' ') || data.error || 'Không lưu được bài ngữ pháp.');
        showNotification(editingGrammarSetId ? 'Đã cập nhật bài ngữ pháp.' : 'Đã tạo bài ngữ pháp mới.');
        const grammarLink = getGrammarPrivateLink(data);
        if (data.visibility === 'assignment' && grammarLink) {
          setShareLinkNotice({ title: data.title, url: grammarLink });
        } else {
          setShareLinkNotice(null);
        }
        refreshData();
        setActiveTab('grammar-sets');
      })
      .catch(err => showNotification(err.message, 'error'));
  };

  const handleCloneGrammarSet = (set: GrammarSet) => {
    authFetch(`/api/admin/grammar-sets/${set.id}/clone`, { method: 'POST' })
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Không sao chép được bài.');
        showNotification('Đã sao chép bài ngữ pháp.');
        refreshData();
      })
      .catch(err => showNotification(err.message, 'error'));
  };

  const handleDeleteGrammarSet = (set: GrammarSet) => {
    if (!window.confirm(`Xóa bài ngữ pháp "${set.title}"?`)) return;
    authFetch(`/api/admin/grammar-sets/${set.id}`, { method: 'DELETE' })
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Không xóa được bài.');
        showNotification('Đã xóa bài ngữ pháp.');
        refreshData();
      })
      .catch(err => showNotification(err.message, 'error'));
  };

  const handleLoadGrammarResults = (set: GrammarSet) => {
    setGrammarResultsSet(set);
    authFetch(`/api/admin/grammar-sets/${set.id}/results`)
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Không tải được kết quả.');
        setGrammarResults(Array.isArray(data.attempts) ? data.attempts : []);
      })
      .catch(err => showNotification(err.message, 'error'));
  };

  const resetVocabResultsFilters = () => {
    setVocabResultsNameFilter('');
    setVocabResultsGameFilter('');
    setVocabResultsGameDropdownOpen(false);
  };

  const handleLoadVocabResults = (set: VocabSet) => {
    setVocabResultsSet(set);
    setVocabResults([]);
    resetVocabResultsFilters();
    setIsVocabResultsLoading(true);
    authFetch(`/api/admin/vocab-sets/${set.id}/results`)
      .then(async res => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Khong tai duoc ket qua.');
        setVocabResults(Array.isArray(data.sessions) ? data.sessions : []);
      })
      .catch(err => showNotification(err.message, 'error'))
      .finally(() => setIsVocabResultsLoading(false));
  };

  const handleOpenEditEditor = (set: VocabSet) => {
    setEditingSetId(set.id);
    setEditorTitle(set.title);
    setEditorDescription(set.description);
    setEditorSubject(set.subject);
    setEditorGrade(set.gradeLevel);
    setEditorStatus(getSetVisibility(set));
    setEditorTags(set.tags);
    setEditorItems([...set.items]);
    setTtsSettings({ ...DEFAULT_TTS_SETTINGS, ...(set.ttsSettings || {}) });
    setTtsQueuedSetId(null);
    setBatchTerms('');
    setBatchMeanings('');
    setBatchIpas('');
    setBatchPartsOfSpeech('');
    setBatchExamples('');
    setBatchExampleMeanings('');
    setActiveTab('editor');
  };

  const handleAddItemRow = () => {
    const newItem: VocabItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      term: '',
      meaning: '',
      ipa: '',
      pos: '',
      example: '',
      exampleMeaning: '',
      displayOrder: editorItems.length + 1
    };
    setEditorItems([...editorItems, newItem]);
  };

  const handleUpdateItemValue = (id: string, field: keyof VocabItem, value: any) => {
    setEditorItems(prev => prev.map(item => {
      if (item.id === id) {
        if (field === 'term' && String(value).trim() !== item.term.trim()) {
          return {
            ...item,
            [field]: value,
            audioUrl: '',
            audioHash: '',
            audioStatus: 'missing',
            audioError: '',
            audioWarnings: [],
            ttsText: '',
            audioGeneratedAt: '',
            audioUpdatedAt: ''
          };
        }
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const updateTtsSettings = (patch: Partial<TtsSettings>) => {
    if (patch.speed !== undefined && ttsSettings.provider === 'yupvox') {
      setEditorItems(items => items.map(item => (
        item.audioUrl && item.ttsProvider?.toLowerCase() === 'yupvox'
          ? { ...item, ttsSpeed: patch.speed }
          : item
      )));
    }
    setTtsSettings(prev => ({ ...prev, ...patch }));
  };

  const handleTtsProviderChange = (provider: string) => {
    setTtsSettings(prev => ({
      ...prev,
      provider,
      voice: DEFAULT_TTS_VOICE_BY_PROVIDER[provider] || prev.voice
    }));
  };

  const refreshEditorAudioStatus = async (setId: string) => {
    try {
      const data = await authFetchJson<{ items: VocabItem[] }>(`/api/vocab-sets/${setId}/audio/status`);
      if (!Array.isArray(data.items)) return;
      const byId = new Map<string, Partial<VocabItem>>(data.items.map((item: VocabItem) => [item.id, item]));
      setEditorItems(prev => prev.map(item => ({ ...item, ...(byId.get(item.id) ?? {}) })));
    } catch (err) {
      console.error("Error refreshing audio status:", err);
    }
  };

  const handlePreviewTtsVoice = async () => {
    setIsPreviewingTts(true);
    try {
      const data = await authFetchJson<{ audioUrl?: string }>('/api/tts/preview', {
        method: 'POST',
        body: JSON.stringify({
          text: 'apple',
          settings: ttsSettings
        })
      });
      if (!data.audioUrl) {
        showNotification('Khong the tao audio nghe thu.', 'error');
        return;
      }
      playAudioUrl(data.audioUrl, 'apple', resolveTtsPlaybackRate(ttsSettings.provider, ttsSettings.speed));
    } catch (err: any) {
      showNotification(err.message || 'Khong the nghe thu voice id.', 'error');
    } finally {
      setIsPreviewingTts(false);
    }
  };

  const handlePlayItemAudio = (item: VocabItem) => {
    playVocabAudio(item);
  };

  const handleGenerateItemAudio = async (itemId: string, force = false) => {
    if (!editingSetId) {
      showNotification('HÃ£y lÆ°u bá»™ tá»« trÆ°á»›c khi táº¡o audio riÃªng cho tá»« nÃ y.', 'error');
      return;
    }
    setEditorItems(prev => prev.map(item => item.id === itemId ? { ...item, audioStatus: 'queued', audioError: '' } : item));
    try {
      const data = await authFetchJson<any>(`/api/vocab-sets/${editingSetId}/audio/generate-missing`, {
        method: 'POST',
        body: JSON.stringify({
          settings: ttsSettings,
          itemIds: [itemId],
          force
        })
      });
      void data;
      if (data?.never) {
        showNotification(data.error || 'KhÃ´ng thá»ƒ xáº¿p hÃ ng táº¡o audio.', 'error');
        return;
      }
      showNotification('ÄÃ£ xáº¿p hÃ ng táº¡o audio cho tá»« nÃ y.');
      setTimeout(() => refreshEditorAudioStatus(editingSetId), 2500);
    } catch (err: any) {
      showNotification(err.message || 'KhÃ´ng thá»ƒ táº¡o audio.', 'error');
    }
  };

  const handleGenerateAllAudio = async () => {
    if (!editingSetId) {
      showNotification('Hãy lưu bộ từ trước, sau đó mới tạo audio hàng loạt.', 'error');
      return;
    }
    const targetItems = editorItems.filter(item => item.term.trim());
    if (targetItems.length === 0) {
      showNotification('Chưa có từ tiếng Anh để tạo audio.', 'error');
      return;
    }

    setIsBatchGeneratingAudio(true);
    setEditorItems(prev => prev.map(item => item.term.trim() ? { ...item, audioStatus: 'queued', audioError: '' } : item));
    try {
      const data = await authFetchJson<any>(`/api/vocab-sets/${editingSetId}/audio/generate-missing`, {
        method: 'POST',
        body: JSON.stringify({
          settings: ttsSettings,
          force: false
        })
      });
      void data;
      if (data?.never) {
        showNotification(data.error || 'Không thể xếp hàng tạo audio hàng loạt.', 'error');
        return;
      }
      setTtsQueuedSetId(editingSetId);
      showNotification('Đã xếp hàng tạo audio hàng loạt. Hệ thống sẽ bỏ qua audio đã tồn tại cùng hash.');
      setTimeout(() => refreshEditorAudioStatus(editingSetId), 2500);
      setTimeout(() => refreshEditorAudioStatus(editingSetId), 8000);
    } catch (err: any) {
      showNotification(err.message || 'Không thể tạo audio hàng loạt.', 'error');
    } finally {
      setIsBatchGeneratingAudio(false);
    }
  };

  const handleCheckAudioStatus = async () => {
    if (!editingSetId) {
      showNotification('Bộ từ mới chưa lưu nên chưa có trạng thái audio để kiểm tra.', 'error');
      return;
    }
    await refreshEditorAudioStatus(editingSetId);
    showNotification('Đã kiểm tra lại trạng thái audio từ backend.');
  };

  const handleGenerateItemAudioBeforeSave = async (itemId: string, force = false) => {
    const targetItem = editorItems.find(item => item.id === itemId);
    if (!targetItem?.term.trim()) {
      showNotification('Hay nhap tu tieng Anh truoc khi tao audio.', 'error');
      return;
    }

    setEditorItems(prev => prev.map(item => item.id === itemId ? {
      ...item,
      audioUrl: force ? '' : item.audioUrl,
      audioHash: force ? '' : item.audioHash,
      audioStatus: 'generating',
      audioError: '',
      audioWarnings: [],
      audioUpdatedAt: new Date().toISOString()
    } : item));
    try {
      const data = await authFetchJson<any>('/api/tts/preview', {
        method: 'POST',
        body: JSON.stringify({
          text: targetItem.term,
          settings: ttsSettings,
          force
        })
      });
      if (!data.audioUrl) {
        setEditorItems(prev => prev.map(item => item.id === itemId ? {
          ...item,
          audioStatus: 'failed',
          audioError: 'Khong the tao audio.'
        } : item));
        showNotification('Khong the tao audio.', 'error');
        return;
      }

      setEditorItems(prev => prev.map(item => item.id === itemId ? {
        ...item,
        audioUrl: data.audioUrl,
        audioHash: data.audioHash,
        audioStatus: 'ready',
        audioError: '',
        audioWarnings: Array.isArray(data.warnings) ? data.warnings : [],
        ttsText: data.ttsText || targetItem.term.trim(),
        ttsProvider: ttsSettings.provider,
        ttsVoice: ttsSettings.voice,
        ttsLang: ttsSettings.lang,
        ttsSpeed: ttsSettings.speed,
        audioUpdatedAt: new Date().toISOString(),
        audioGeneratedAt: new Date().toISOString()
      } : item));
      showNotification(force
        ? 'Da tao lai audio cho tu nay. Bam luu bo tu de luu metadata audio.'
        : 'Da tao audio cho tu nay. Bam luu bo tu de luu metadata audio.'
      );
    } catch (err: any) {
      setEditorItems(prev => prev.map(item => item.id === itemId ? {
        ...item,
        audioStatus: 'failed',
        audioError: err.message || 'Khong the tao audio.'
      } : item));
      showNotification(err.message || 'Khong the tao audio.', 'error');
    }
  };

  const handleGenerateAllAudioBeforeSave = async () => {
    const targetItems = editorItems.filter(item => item.term.trim());
    if (targetItems.length === 0) {
      showNotification('Chua co tu tieng Anh de tao audio.', 'error');
      return;
    }

    setIsBatchGeneratingAudio(true);
    setEditorItems(prev => prev.map(item => item.term.trim() ? { ...item, audioStatus: 'queued', audioError: '', audioWarnings: [] } : item));
    try {
      const data = await authFetchJson<any>('/api/tts/batch-preview', {
        method: 'POST',
        body: JSON.stringify({
          items: targetItems.map(item => ({ id: item.id, text: item.term })),
          settings: ttsSettings,
          force: false
        })
      });
      if (!Array.isArray(data.items)) {
        showNotification('Khong the tao audio hang loat.', 'error');
        setEditorItems(prev => prev.map(item => item.term.trim() ? {
          ...item,
          audioStatus: 'failed',
          audioError: 'Khong the tao audio hang loat.'
        } : item));
        return;
      }

      let successCount = 0;
      let failedCount = 0;
      const resultById = new Map<string, any>(data.items.map((item: any) => [String(item.id), item]));
      setEditorItems(prev => prev.map(item => {
        const result = resultById.get(item.id);
        if (!result) return item;
        if (result.audioUrl) {
          successCount++;
          return {
            ...item,
            audioUrl: result.audioUrl,
            audioHash: result.audioHash,
            audioStatus: 'ready',
            audioError: '',
            audioWarnings: Array.isArray(result.warnings) ? result.warnings : [],
            ttsText: result.ttsText || item.term.trim(),
            ttsProvider: result.ttsProvider || ttsSettings.provider,
            ttsVoice: result.ttsVoice || ttsSettings.voice,
            ttsLang: result.ttsLang || ttsSettings.lang,
            ttsSpeed: result.ttsSpeed || ttsSettings.speed,
            audioUpdatedAt: new Date().toISOString(),
            audioGeneratedAt: new Date().toISOString()
          };
        }
        failedCount++;
        return {
          ...item,
          audioHash: result.audioHash || item.audioHash,
          audioStatus: 'failed',
          audioError: result.audioError || 'Khong the tao audio.',
          audioWarnings: Array.isArray(result.warnings) ? result.warnings : []
        };
      }));
      showNotification(`Da tao audio: ${successCount} tu${failedCount ? `, loi ${failedCount} tu` : ''}. Bam luu bo tu de luu metadata audio.`, failedCount ? 'error' : 'success');
    } catch (err: any) {
      showNotification(err.message || 'Khong the tao audio hang loat.', 'error');
    } finally {
      setIsBatchGeneratingAudio(false);
    }
  };

  const handleCheckAudioStatusSmart = async () => {
    if (!editingSetId) {
      showNotification('Bo tu moi chua luu vao database. Cac dong da tao audio se hien trang thai ngay trong bang.');
      return;
    }
    await refreshEditorAudioStatus(editingSetId);
    showNotification('Da kiem tra lai trang thai audio tu backend.');
  };

  const handleDeleteItemRow = (id: string) => {
    setEditorItems(prev => prev.filter(item => item.id !== id));
  };

  // Batch import text converter (Ghép nhanh nhiều dòng)
  const handleProcessBatchAdd = () => {
    const parsed = parseBulkVocabularyText(batchVocabularyText);

    if (!batchVocabularyText.trim()) {
      showNotification("Hay dan du lieu tu vung truoc khi ghep.", "error");
      return;
    }

    if (parsed.errors.length > 0) {
      showNotification(parsed.errors.slice(0, 3).join(' '), "error");
      return;
    }

    if (parsed.rows.length === 0) {
      showNotification("Khong co dong du lieu hop le de ghep.", "error");
      return;
    }

    const importedItems: VocabItem[] = parsed.rows.map((row, index) => ({
      id: `item-${Date.now()}-${index}`,
      ...row,
      displayOrder: editorItems.length + index + 1
    }));

    setEditorItems([...editorItems, ...importedItems]);
    setBatchVocabularyText('');
    showNotification(`Da ghep thanh cong ${importedItems.length} tu vung vao bang.`);
    return;

    const splitLines = (value: string) => value.split('\n').map(line => line.trim());
    const terms = splitLines(batchTerms);
    const meanings = splitLines(batchMeanings);
    const ipas = splitLines(batchIpas);
    const partsOfSpeech = splitLines(batchPartsOfSpeech);
    const examples = splitLines(batchExamples);
    const exampleMeanings = splitLines(batchExampleMeanings);
    const nonEmptyTerms = terms.filter(Boolean);
    const nonEmptyMeanings = meanings.filter(Boolean);

    if (nonEmptyTerms.length === 0 || nonEmptyMeanings.length === 0) {
      showNotification("Hãy nhập dữ liệu từ và nghĩa trước khi ghép.", "error");
      return;
    }

    const linesCount = Math.max(
      terms.length,
      meanings.length,
      ipas.length,
      partsOfSpeech.length,
      examples.length,
      exampleMeanings.length
    );
    const legacyImportedItems: VocabItem[] = [];

    for (let i = 0; i < linesCount; i++) {
      if (!terms[i] && !meanings[i]) continue;

      legacyImportedItems.push({
        id: `item-${Date.now()}-${i}`,
        term: terms[i] || '',
        meaning: meanings[i] || nonEmptyMeanings[nonEmptyMeanings.length - 1] || '',
        ipa: ipas[i] || '',
        pos: partsOfSpeech[i] || '',
        example: examples[i] || '',
        exampleMeaning: exampleMeanings[i] || '',
        displayOrder: editorItems.length + i + 1
      });
    }

    setEditorItems([...editorItems, ...legacyImportedItems]);
    setBatchTerms('');
    setBatchMeanings('');
    setBatchIpas('');
    setBatchPartsOfSpeech('');
    setBatchExamples('');
    setBatchExampleMeanings('');
    showNotification(`Đã ghép thành công ${importedItems.length} từ vựng vào bảng.`);
  };

  const applyMissingVocabDetails = (itemId: string, details: Partial<VocabItem>) => {
    setEditorItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      return {
        ...item,
        meaning: item.meaning.trim() ? item.meaning : (details.meaning || item.meaning),
        ipa: item.ipa.trim() ? item.ipa : (details.ipa || item.ipa),
        pos: item.pos.trim() ? item.pos : (details.pos || item.pos),
        example: item.example.trim() ? item.example : (details.example || item.example),
        exampleMeaning: item.exampleMeaning.trim() ? item.exampleMeaning : (details.exampleMeaning || item.exampleMeaning),
        audioUrl: item.audioUrl || details.audioUrl
      };
    }));
  };

  const hasMissingGeneratedFields = (item: VocabItem) => {
    return !item.meaning.trim() ||
      !item.ipa.trim() ||
      !item.pos.trim() ||
      !item.example.trim() ||
      !item.exampleMeaning.trim() ||
      !item.audioUrl;
  };

  // Auto-fill missing row details using server proxy AI API
  const handleGenerateIpaForRow = async (id: string, term: string) => {
    if (!term.trim()) return;
    try {
      const currentItem = editorItems.find(item => item.id === id);
      const res = await authFetch('/api/ai/vocab-detail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word: term,
          meaning: currentItem?.meaning || '',
          grade: editorGrade
        })
      });
      const data = await res.json();
      if (res.ok) {
        applyMissingVocabDetails(id, data);
        if (data.isFallback) {
          showNotification("Gemini và OpenAI đều chưa sinh được dữ liệu thật. Hệ thống đã dùng dữ liệu dự phòng tạm thời.", "error");
        }
      }
    } catch (err) {
      console.error("Error generating vocabulary details:", err);
    }
  };

  const handleGenerateAllBlankIpas = async () => {
    let count = 0;
    let fallbackCount = 0;
    const itemsWithMissingDetails = editorItems.filter(item => item.term.trim() && hasMissingGeneratedFields(item));
    if (itemsWithMissingDetails.length === 0) {
      showNotification("Tất cả các từ trong bảng đều đã đủ IPA, loại từ, ví dụ và dịch nghĩa ví dụ.");
      return;
    }

    showNotification("Đang tự sinh các phần còn thiếu bằng AI...");
    for (const item of itemsWithMissingDetails) {
      try {
        const res = await authFetch('/api/ai/vocab-detail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            word: item.term,
            meaning: item.meaning,
            grade: editorGrade
          })
        });
        const data = await res.json();
        if (res.ok) {
          applyMissingVocabDetails(item.id, data);
          if (data.isFallback) fallbackCount++;
          count++;
        }
      } catch (err) {
        console.error(err);
      }
    }
    if (fallbackCount > 0) {
      showNotification(`Đã bổ sung ${count} từ, nhưng ${fallbackCount} từ phải dùng dữ liệu dự phòng vì Gemini/OpenAI đều lỗi hoặc hết quota.`, "error");
    } else {
      showNotification(`Đã tự động bổ sung thông tin cho ${count} từ vựng.`);
    }
  };

  // AI Vocab set generator (Tích hợp thực tế với Gemini)
  const handleGenerateSetByAI = async () => {
    if (!aiTopic.trim()) {
      showNotification("Hãy nhập chủ đề để AI tạo từ vựng.", "error");
      return;
    }

    setIsAiGenerating(true);
    showNotification("Hệ thống Gemini đang tạo bộ từ vựng thông minh cho em...");

    try {
      const res = await authFetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: aiTopic,
          grade: aiGrade,
          wordsCount: aiCount
        })
      });
      const data = await res.json();

      if (res.ok && Array.isArray(data)) {
        const fallbackCount = data.filter((word: any) => word.isFallback).length;
        const generated: VocabItem[] = data.map((word: any, i: number) => ({
          id: `ai-item-${Date.now()}-${i}`,
          term: word.term || '',
          meaning: word.meaning || '',
          ipa: word.ipa || '',
          pos: word.pos || 'Noun',
          example: word.example || '',
          exampleMeaning: word.exampleMeaning || '',
          displayOrder: editorItems.length + i + 1
        }));

        setEditorItems([...editorItems, ...generated]);
        setAiTopic('');
        if (fallbackCount > 0) {
          showNotification(`Đã tạo ${generated.length} từ, nhưng ${fallbackCount} từ đang dùng dữ liệu dự phòng vì Gemini/OpenAI đều lỗi hoặc hết quota.`, "error");
        } else {
          showNotification(`Đã sử dụng AI tạo thành công ${generated.length} từ vựng thuộc chủ đề "${aiTopic}"!`);
        }
      } else {
        showNotification(data.error || "Không thể tạo từ vựng bằng AI. Hãy thử lại.", "error");
      }
    } catch (err: any) {
      console.error(err);
      showNotification("Lỗi kết nối AI: " + err.message, "error");
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleSaveSet = () => {
    if (!editorTitle.trim()) {
      showNotification("Hãy điền tên bộ từ vựng.", "error");
      return;
    }

    if (editorItems.length === 0) {
      showNotification("Danh sách từ vựng trống. Hãy thêm ít nhất một từ.", "error");
      return;
    }

    const payload = {
      title: editorTitle,
      description: editorDescription,
      subject: editorSubject,
      gradeLevel: editorGrade,
      visibility: editorStatus,
      status: editorStatus === 'assignment' ? 'private' : editorStatus,
      tags: editorTags,
      createdBy: user?.id || "teacher-1",
      creatorName: user?.name || "Cô Thảo English",
      ttsSettings,
      items: editorItems.map((item, idx) => ({ ...item, displayOrder: idx + 1 }))
    };

    const url = editingSetId ? `/api/vocab-sets/${editingSetId}` : '/api/vocab-sets';
    const method = editingSetId ? 'PUT' : 'POST';

    authFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
      showNotification("Lưu bộ từ vựng thành công!");
      const savedVisibility = getSetVisibility(data);
      const assignmentUrl = getAssignmentLink(data);
      if (savedVisibility === 'assignment' && assignmentUrl) {
        setShareLinkNotice({ title: data.title, url: assignmentUrl });
      } else {
        setShareLinkNotice(null);
      }
      refreshData();
      setActiveTab('vocab-sets');
    })
    .catch(err => {
      console.error(err);
      showNotification("Không thể lưu bộ từ vựng.", "error");
    });
  };

  // --- CRUD VOCAB LIST ACTIONS ---
  const handleCloneSet = (id: string) => {
    authFetch(`/api/vocab-sets/${id}/clone`, { method: 'POST' })
      .then(res => res.json())
      .then(data => {
        showNotification(`Đã sao chép bộ từ vựng thành công.`);
        refreshData();
      })
      .catch(err => console.error(err));
  };

  const handleDeleteSet = (id: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa bộ từ vựng này? Hành động này cũng sẽ gỡ bỏ tất cả bài giao tương ứng.")) return;
    
    authFetch(`/api/vocab-sets/${id}`, { method: 'DELETE' })
      .then(res => res.json())
      .then(data => {
        showNotification("Đã xóa bộ từ vựng thành công.");
        refreshData();
      })
      .catch(err => console.error(err));
  };

  // --- CLASSES MANAGER ---
  const handleCreateClass = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;

    authFetch('/api/classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newClassName,
        teacherId: user?.id || "teacher-1"
      })
    })
    .then(res => res.json())
    .then(data => {
      showNotification(`Tạo lớp "${data.name}" thành công với mã mời: ${data.code}`);
      setNewClassName('');
      refreshData();
    })
    .catch(err => console.error(err));
  };

  const handleAddClassMember = (classId: string, e: React.FormEvent) => {
    e.preventDefault();
    const studentName = newMemberNames[classId]?.trim();
    if (!studentName) return;

    authFetch(`/api/classes/${classId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentName })
    })
    .then(res => res.json())
    .then(data => {
      showNotification(`Đã thêm học sinh "${data.studentName}" vào lớp thành công.`);
      setNewMemberNames(prev => ({ ...prev, [classId]: '' }));
      refreshData();
    })
    .catch(err => console.error(err));
  };

  const handleDeleteClassMember = (classId: string, memberId: string, studentName: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa học sinh "${studentName}" khỏi lớp?`)) return;

    authFetch(`/api/classes/${classId}/members/${memberId}`, {
      method: 'DELETE'
    })
    .then(res => res.json())
    .then(() => {
      showNotification(`Đã xóa học sinh khỏi lớp.`);
      refreshData();
    })
    .catch(err => console.error(err));
  };

  const handleDeleteClass = (id: string, className: string) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa lớp "${className}"? Hành động này sẽ gỡ bỏ tất cả học sinh và bài tập đã giao.`)) return;

    authFetch(`/api/classes/${id}`, {
      method: 'DELETE'
    })
    .then(res => res.json())
    .then(() => {
      showNotification(`Đã xóa lớp "${className}" thành công.`);
      refreshData();
    })
    .catch(err => console.error(err));
  };

  // --- ASSIGNMENTS SCHEDULER ---
  const handleCreateAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignClassId || !assignSetId || !assignDueDate) {
      showNotification("Vui lòng điền đủ thông tin giao bài.", "error");
      return;
    }

    const selectedClass = classes.find(c => c.id === assignClassId);
    const selectedSet = assignResourceType === 'listening'
      ? listeningSets.find(s => s.id === assignSetId)
      : vocabSets.find(s => s.id === assignSetId);

    if (!selectedClass || !selectedSet) return;

    const payload = {
      classId: assignClassId,
      className: selectedClass.name,
      resourceType: assignResourceType,
      resourceId: assignSetId,
      resourceTitle: selectedSet.title,
      ...(assignResourceType === 'vocabulary'
        ? {
            vocabSetId: assignSetId,
            vocabSetTitle: selectedSet.title,
            gameId: assignGameId
          }
        : {
            listeningSetId: assignSetId,
            listeningSetTitle: selectedSet.title,
            gameId: 'listening-five-part'
          }),
      dueDate: assignDueDate,
      createdBy: user?.id || "teacher-1",
      title: assignTitle.trim() || (assignResourceType === 'listening'
        ? `Luyện nghe: ${selectedSet.title}`
        : `Học từ vựng: ${selectedSet.title}`)
    };

    authFetch('/api/assignments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
      showNotification("Giao bài tập cho học sinh lớp thành công!");
      setAssignClassId('');
      setAssignSetId('');
      setAssignDueDate('');
      setAssignTitle('');
      refreshData();
      setActiveTab('assignments');
    })
    .catch(err => console.error(err));
  };

  const handleDeleteAssignment = (id: string) => {
    authFetch(`/api/assignments/${id}`, { method: 'DELETE' })
      .then(res => res.json())
      .then(() => {
        showNotification("Đã thu hồi bài giao thành công.");
        refreshData();
      })
      .catch(err => console.error(err));
  };

  // --- FILTERED SETS LIST ---
  const filteredSets = vocabSets.filter(set => {
    const matchesSearch = set.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          set.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          set.subject.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGrade = filterGrade ? set.gradeLevel === filterGrade : true;
    const matchesStatus = filterStatus ? getSetVisibility(set) === filterStatus : true;
    return matchesSearch && matchesGrade && matchesStatus;
  });

  const sortedFilteredSets = [...filteredSets].sort((a, b) =>
    getCreatedAtTimestamp(b.createdAt) - getCreatedAtTimestamp(a.createdAt)
  );
  const vocabTotalPages = Math.max(1, Math.ceil(sortedFilteredSets.length / vocabPageSize));
  const vocabCurrentPage = Math.min(vocabPage, vocabTotalPages);
  const paginatedVocabSets = sortedFilteredSets.slice(
    (vocabCurrentPage - 1) * vocabPageSize,
    vocabCurrentPage * vocabPageSize
  );

  const filteredGrammarSets = grammarSets.filter(set => {
    const keyword = grammarSearchQuery.trim().toLowerCase();
    const searchableText = [set.title, set.description, set.subject, set.topic, ...(set.tags || [])]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const matchesSearch = !keyword || searchableText.includes(keyword);
    const matchesGrade = grammarFilterGrade ? set.gradeLevel === grammarFilterGrade : true;
    const matchesStatus = grammarFilterStatus ? set.visibility === grammarFilterStatus : true;
    return matchesSearch && matchesGrade && matchesStatus;
  });
  const sortedGrammarSets = [...filteredGrammarSets].sort((a, b) =>
    getCreatedAtTimestamp(b.createdAt) - getCreatedAtTimestamp(a.createdAt)
  );
  const grammarTotalPages = Math.max(1, Math.ceil(sortedGrammarSets.length / grammarPageSize));
  const grammarCurrentPage = Math.min(grammarPage, grammarTotalPages);
  const paginatedGrammarSets = sortedGrammarSets.slice(
    (grammarCurrentPage - 1) * grammarPageSize,
    grammarCurrentPage * grammarPageSize
  );

  React.useEffect(() => {
    setVocabPage(1);
  }, [searchQuery, filterGrade, filterStatus, vocabPageSize]);

  React.useEffect(() => {
    if (vocabPage > vocabTotalPages) setVocabPage(vocabTotalPages);
  }, [vocabPage, vocabTotalPages]);

  React.useEffect(() => {
    setGrammarPage(1);
  }, [grammarSearchQuery, grammarFilterGrade, grammarFilterStatus, grammarPageSize]);

  React.useEffect(() => {
    if (grammarPage > grammarTotalPages) setGrammarPage(grammarTotalPages);
  }, [grammarPage, grammarTotalPages]);

  const leaderboardRows = React.useMemo(() => {
    return getLeaderboardByCategory(
      leaderboardResults,
      assignments,
      {
        period: leaderboardPeriod,
        classId: leaderboardClassId || undefined,
        vocabSetId: leaderboardVocabSetId || undefined
      },
      leaderboardCategory
    );
  }, [leaderboardResults, assignments, leaderboardPeriod, leaderboardClassId, leaderboardVocabSetId, leaderboardCategory]);

  const completedActivityResults = React.useMemo(() => {
    return [...results]
      .filter(res => getSessionEndTime(res))
      .sort((a, b) => new Date(getSessionEndTime(b) || 0).getTime() - new Date(getSessionEndTime(a) || 0).getTime());
  }, [results]);

  const recentResults = React.useMemo(() => {
    return completedActivityResults.slice(0, 30);
  }, [completedActivityResults]);

  const filteredActivityResults = React.useMemo(() => {
    const keyword = normalizeActivitySearchText(activitySearch);
    if (!keyword) return completedActivityResults;

    return completedActivityResults.filter(res =>
      normalizeActivitySearchText(res.studentName || '').includes(keyword)
    );
  }, [completedActivityResults, activitySearch]);

  const filteredVocabResults = React.useMemo(() => {
    const keyword = normalizeActivitySearchText(vocabResultsNameFilter);

    return vocabResults.filter(session => {
      const nameMatches = !keyword || normalizeActivitySearchText(session.studentName || '').includes(keyword);
      const gameMatches = !vocabResultsGameFilter || session.gameId === vocabResultsGameFilter;
      return nameMatches && gameMatches;
    });
  }, [vocabResults, vocabResultsNameFilter, vocabResultsGameFilter]);

  const vocabResultGameOptions = React.useMemo(() => {
    const labelsByGameId = new Map<string, string>();

    vocabResults.forEach(session => {
      if (!session.gameId || labelsByGameId.has(session.gameId)) return;
      const configuredGame = GAMES_LIST.find(game => game.gameId === session.gameId);
      labelsByGameId.set(session.gameId, session.gameName || configuredGame?.title || session.gameId);
    });

    return Array.from(labelsByGameId, ([gameId, title]) => ({ gameId, title }));
  }, [vocabResults]);

  const hasVocabResultsFilter = Boolean(
    normalizeActivitySearchText(vocabResultsNameFilter) || vocabResultsGameFilter
  );

  const leaderboardClassOptions = React.useMemo(() => {
    const byId = new Map<string, string>();
    classes.forEach(cls => {
      if (cls.id && cls.name) byId.set(cls.id, cls.name);
    });
    leaderboardResults.forEach(res => {
      if (res.classId && res.className) byId.set(res.classId, formatGradeLabel(res.className));
    });
    return Array.from(byId.entries()).map(([id, name]) => ({ id, name }));
  }, [classes, leaderboardResults]);

  const leaderboardSetOptions = React.useMemo(() => {
    return [
      ...vocabSets.map(set => ({ id: set.id, title: set.title })),
      ...grammarSets.map(set => ({ id: `grammar:${set.id}`, title: `Grammar: ${set.title}` }))
    ];
  }, [vocabSets, grammarSets]);

  const selectedActivityAnswerDetails = React.useMemo(() => {
    if (!selectedActivity || !Array.isArray(selectedActivity.answerDetails)) return [];
    return selectedActivity.answerDetails.filter(Boolean);
  }, [selectedActivity]);

  const dashboardGoldRows = React.useMemo(() => {
    return getLeaderboardByCategory(leaderboardResults, assignments, { period: 'week' }, 'gold').slice(0, 5);
  }, [leaderboardResults, assignments]);

  const leaderboardTitleMap: Record<LeaderboardCategory, string> = {
    gold: 'Bảng vàng tuần này',
    diligent: 'Chăm chỉ nhất',
    accurate: 'Chính xác nhất',
    improved: 'Tiến bộ nhất'
  };

  // --- SUPER ADMIN ACCOUNT MANAGEMENT ---
  const handleUpdateUserRole = (userId: string, newRole: string) => {
    authFetch(`/api/admin/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role: newRole })
    })
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        showNotification(data.error, "error");
      } else {
        showNotification(data.customClaimWarning
          ? "Đã cập nhật vai trò trong hệ thống. Nếu tài khoản chưa thấy quyền mới, hãy đăng xuất rồi đăng nhập lại."
          : "Cập nhật vai trò người dùng thành công!");
        refreshData();
      }
    })
    .catch(err => {
      console.error(err);
      showNotification("Không thể cập nhật vai trò người dùng.", "error");
    });
  };

  const handleToggleUserStatus = (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'blocked' ? 'active' : 'blocked';
    authFetch(`/api/admin/users/${userId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: newStatus })
    })
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        showNotification(data.error, "error");
      } else {
        showNotification(newStatus === 'blocked' ? "Đã khóa tài khoản thành công!" : "Đã mở khóa tài khoản thành công!");
        refreshData();
      }
    })
    .catch(err => {
      console.error(err);
      showNotification("Không thể cập nhật trạng thái tài khoản.", "error");
    });
  };

  const handleToggleAccountStatus = (account: any) => {
    if (account.accountType !== 'guest') {
      handleToggleUserStatus(account.id, account.status);
      return;
    }
    const status = account.status === 'blocked' ? 'active' : 'blocked';
    authFetchJson(`/api/admin/guest-profiles/${encodeURIComponent(account.guestId || account.id)}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    }).then(() => {
      showNotification(status === 'blocked' ? 'Đã khóa hồ sơ học sinh.' : 'Đã mở khóa hồ sơ học sinh.');
      refreshData();
    }).catch((err: any) => showNotification(err.message || 'Không thể cập nhật hồ sơ.', 'error'));
  };

  const handleSaveAccountName = async () => {
    if (!editingAccount) return;
    const validation = validateStudentDisplayName(editingAccountName);
    if (!validation.valid) {
      showNotification(validation.error, 'error');
      return;
    }
    const url = editingAccount.accountType === 'guest'
      ? `/api/admin/guest-profiles/${encodeURIComponent(editingAccount.guestId || editingAccount.id)}/display-name`
      : `/api/admin/users/${encodeURIComponent(editingAccount.id)}/display-name`;
    try {
      await authFetchJson(url, { method: 'PUT', body: JSON.stringify({ displayName: validation.value }) });
      setEditingAccount(null);
      showNotification('Đã cập nhật tên hiển thị.');
      refreshData();
    } catch (err: any) {
      showNotification(err.message || 'Không thể cập nhật tên hiển thị.', 'error');
    }
  };

  const filteredUsers = usersList.filter(u => {
    const matchesSearch = (u.name || '').toLowerCase().includes(usersSearch.toLowerCase()) ||
                          (u.email || '').toLowerCase().includes(usersSearch.toLowerCase()) ||
                          (u.phone || '').toLowerCase().includes(usersSearch.toLowerCase()) ||
                          (u.guestId || u.id || '').toLowerCase().includes(usersSearch.toLowerCase());
    const matchesRole = usersRoleFilter ? u.role === usersRoleFilter : true;
    const matchesStatus = usersStatusFilter ? u.status === usersStatusFilter : true;
    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50/50" id="admin-dashboard-container">
      
      {/* Toast Alert pop-up */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-2xl shadow-xl flex items-center space-x-2 border transition-all text-sm font-semibold ${
          notification.type === 'success' 
            ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
            : 'bg-rose-50 border-rose-100 text-rose-800'
        }`} id="admin-toast">
          {notification.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
          <span>{notification.message}</span>
        </div>
      )}

      {shareLinkNotice && (
        <div className="fixed top-20 right-4 z-50 w-[min(92vw,420px)] bg-white border border-indigo-100 rounded-3xl shadow-xl p-4 space-y-3" id="assignment-link-panel">
          <div>
            <p className="text-[10px] font-black uppercase text-indigo-500">Link giao bài riêng</p>
            <p className="text-sm font-extrabold text-gray-800 truncate">{shareLinkNotice.title}</p>
          </div>
          <div className="flex gap-2">
            <input
              value={shareLinkNotice.url}
              readOnly
              className="min-w-0 flex-1 bg-gray-50 border border-gray-100 rounded-2xl px-3 py-2 text-xs font-semibold text-gray-600"
            />
            <button
              onClick={() => {
                navigator.clipboard?.writeText(shareLinkNotice.url);
                showNotification("Đã copy link giao bài.");
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-xs transition-all"
            >
              Copy
            </button>
          </div>
          <button
            onClick={() => setShareLinkNotice(null)}
            className="text-xs font-bold text-gray-400 hover:text-gray-700"
          >
            Đóng
          </button>
        </div>
      )}

      {editingAccount && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl space-y-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-indigo-500">Sửa tên hiển thị</p>
              <h3 className="text-xl font-black text-gray-900">{editingAccount.name}</h3>
              <p className="text-xs text-gray-500">Tên gồm 2–20 ký tự, chỉ dùng chữ cái, khoảng trắng, dấu nháy hoặc gạch nối.</p>
            </div>
            <input
              value={editingAccountName}
              onChange={(event) => setEditingAccountName(event.target.value)}
              maxLength={STUDENT_NAME_MAX_LENGTH}
              className="w-full rounded-2xl border border-gray-200 p-3 font-bold text-gray-900"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setEditingAccount(null)} className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700">Hủy</button>
              <button onClick={handleSaveAccountName} className="rounded-xl border border-blue-700 bg-blue-600 px-4 py-2 text-sm font-bold text-white">Lưu tên</button>
            </div>
          </div>
        </div>
      )}

      {selectedActivity && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4" id="activity-detail-modal">
          <div className="w-full max-w-5xl max-h-[88vh] overflow-hidden bg-white rounded-3xl border border-gray-200 shadow-2xl flex flex-col">
            <div className="flex items-start justify-between gap-4 p-5 border-b border-gray-100">
              <div>
                <p className="text-[10px] font-black uppercase text-blue-600">Chi tiết lượt luyện tập</p>
                <h3 className="mt-1 text-xl font-black text-gray-900">
                  {selectedActivity.studentName} • {selectedActivity.gameName || GAMES_LIST.find(g => g.gameId === selectedActivity.gameId)?.title || selectedActivity.gameId}
                </h3>
                <p className="text-xs font-semibold text-gray-500">{selectedActivity.vocabSetTitle}</p>
              </div>
              <button
                onClick={() => setSelectedActivity(null)}
                className="p-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700"
                aria-label="Đóng chi tiết hoạt động"
              >
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto p-5 space-y-5">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                  <p className="text-[10px] font-black uppercase text-blue-600">Điểm</p>
                  <p className="mt-1 text-2xl font-black text-gray-900">{selectedActivity.score}</p>
                </div>
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                  <p className="text-[10px] font-black uppercase text-emerald-700">Đúng / Tổng</p>
                  <p className="mt-1 text-2xl font-black text-gray-900">{selectedActivity.correctAnswers}/{selectedActivity.totalQuestions}</p>
                </div>
                <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
                  <p className="text-[10px] font-black uppercase text-amber-700">Độ chính xác</p>
                  <p className="mt-1 text-2xl font-black text-gray-900">{selectedActivity.accuracy ?? Math.round((selectedActivity.correctAnswers / Math.max(1, selectedActivity.totalQuestions)) * 100)}%</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[10px] font-black uppercase text-slate-600">Thời lượng</p>
                  <p className="mt-1 text-2xl font-black text-gray-900">{formatDuration(selectedActivity.durationSeconds || Math.round((selectedActivity.durationMs || 0) / 1000))}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="rounded-2xl border border-gray-100 bg-white p-4">
                  <p className="text-[10px] font-black uppercase text-gray-400">Bắt đầu</p>
                  <p className="mt-1 font-bold text-gray-800">{formatVietnamDateTime(selectedActivity.startedAt)}</p>
                </div>
                <div className="rounded-2xl border border-gray-100 bg-white p-4">
                  <p className="text-[10px] font-black uppercase text-gray-400">Kết thúc</p>
                  <p className="mt-1 font-bold text-gray-800">{formatVietnamDateTime(getSessionEndTime(selectedActivity))}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between gap-3 bg-gray-50 px-4 py-3 border-b border-gray-200">
                  <h4 className="text-sm font-black text-gray-900">Danh sách câu trả lời</h4>
                  <span className="text-xs font-bold text-gray-500">{selectedActivityAnswerDetails.length} dòng</span>
                </div>

                {selectedActivityAnswerDetails.length === 0 ? (
                  <div className="p-8 text-center text-sm text-gray-400">
                    Lượt chơi này chưa có dữ liệu chi tiết từng câu.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-white">
                          <th className="p-3 text-[10px] font-black uppercase text-gray-500">#</th>
                          <th className="p-3 text-[10px] font-black uppercase text-gray-500">Câu hỏi</th>
                          <th className="p-3 text-[10px] font-black uppercase text-gray-500">Học sinh chọn</th>
                          <th className="p-3 text-[10px] font-black uppercase text-gray-500">Đáp án đúng</th>
                          <th className="p-3 text-[10px] font-black uppercase text-gray-500">Kết quả</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedActivityAnswerDetails.map((detail, index) => (
                          <tr key={`${selectedActivity.id}-detail-${index}`} className="border-t border-gray-100">
                            <td className="p-3 text-xs font-bold text-gray-500">{Number.isFinite(Number(detail.questionIndex)) ? Number(detail.questionIndex) + 1 : index + 1}</td>
                            <td className="p-3">
                              <p className="text-sm font-bold text-gray-900">
                                {selectedActivity.sourceType === 'listening'
                                  ? formatListeningReviewQuestion(detail.questionText || detail.word, detail.part, index)
                                  : detail.questionText || detail.word || '--'}
                              </p>
                              {selectedActivity.sourceType !== 'listening' && detail.wordId && (
                                <p className="text-[10px] font-mono text-gray-400">{detail.wordId}</p>
                              )}
                              {Array.isArray(detail.options) && detail.options.length > 0 && (
                                <p className="mt-1 text-[10px] text-gray-500">Lựa chọn: {detail.options.filter(Boolean).join(' | ')}</p>
                              )}
                            </td>
                            <td className="p-3 text-sm font-semibold text-gray-700">
                              {selectedActivity.sourceType === 'listening'
                                ? formatListeningReviewAnswer(detail.userAnswer || detail.selectedAnswer) || '--'
                                : detail.userAnswer || detail.selectedAnswer || '--'}
                            </td>
                            <td className="p-3 text-sm font-semibold text-gray-700">
                              {selectedActivity.sourceType === 'listening'
                                ? formatListeningReviewAnswer(detail.correctAnswer) || '--'
                                : detail.correctAnswer || '--'}
                            </td>
                            <td className="p-3">
                              <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-black ${
                                detail.isCorrect ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                              }`}>
                                {detail.isCorrect ? 'Đúng' : 'Sai'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dashboard Left Sidebar */}
      <aside className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-gray-100 flex flex-col shrink-0" id="admin-sidebar">
        
        {/* Brand Banner */}
        <div className="p-6 border-b border-gray-50 flex items-center space-x-3">
          <span className="p-2 bg-indigo-600 text-white rounded-2xl shadow-md shrink-0">
            <BookOpen size={20} />
          </span>
          <div>
            <h1 className="font-black text-gray-800 tracking-tight text-base leading-snug">Cô Diệu Tiếng Anh</h1>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
              {user?.role === 'super_admin' ? 'Hệ thống Admin' : 'Dashboard Giáo Viên'}
            </p>
          </div>
        </div>

        {/* Sidebar Navigation */}
        <nav className="p-4 flex-1 space-y-1">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center space-x-3 p-3 px-4 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'dashboard' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'
            }`}
            id="tab-dashboard"
          >
            <Layers size={18} />
            <span>Tổng quan</span>
          </button>
          
          <button
            onClick={() => setActiveTab('vocab-sets')}
            className={`w-full flex items-center space-x-3 p-3 px-4 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'vocab-sets' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'
            }`}
            id="tab-sets"
          >
            <BookOpen size={18} />
            <span>Kho từ vựng</span>
          </button>

          <button
            onClick={handleOpenNewEditor}
            className={`w-full flex items-center space-x-3 p-3 px-4 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'editor' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'
            }`}
            id="tab-editor"
          >
            <Plus size={18} />
            <span>Soạn từ vựng mới</span>
          </button>

          <button
            onClick={() => setActiveTab('grammar-sets')}
            className={`w-full flex items-center space-x-3 p-3 px-4 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'grammar-sets' ? 'bg-emerald-50 text-emerald-700' : 'text-gray-500 hover:bg-gray-50'
            }`}
            id="tab-grammar-sets"
          >
            <FileText size={18} />
            <span>Kho bài ngữ pháp</span>
          </button>

          <button
            onClick={() => handleOpenNewGrammarEditor('multiple_choice')}
            className={`w-full flex items-center space-x-3 p-3 px-4 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'grammar-editor' && grammarQuestionType === 'multiple_choice' ? 'bg-emerald-50 text-emerald-700' : 'text-gray-500 hover:bg-gray-50'
            }`}
            id="tab-grammar-editor"
          >
            <Plus size={18} />
            <span>Soạn bài ngữ pháp</span>
          </button>

          <button
            onClick={() => handleOpenNewGrammarEditor('rewrite')}
            className={`w-full flex items-center space-x-3 p-3 px-4 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'grammar-editor' && grammarQuestionType === 'rewrite' ? 'bg-emerald-50 text-emerald-700' : 'text-gray-500 hover:bg-gray-50'
            }`}
            id="tab-grammar-rewrite-editor"
          >
            <Edit3 size={18} />
            <span>Soạn bài tự luận</span>
          </button>

          <button
            onClick={() => setActiveTab('listening-library')}
            className={`w-full flex items-center space-x-3 p-3 px-4 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'listening-library' ? 'bg-sky-50 text-sky-700' : 'text-gray-500 hover:bg-gray-50'
            }`}
            id="tab-listening-library"
          >
            <Headphones size={18} />
            <span>Kho bài luyện nghe</span>
          </button>

          <button
            onClick={() => setActiveTab('classes')}
            className={`w-full flex items-center space-x-3 p-3 px-4 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'classes' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'
            }`}
            id="tab-classes"
          >
            <Users size={18} />
            <span>Quản lý Lớp học</span>
          </button>

          <button
            onClick={() => setActiveTab('results')}
            className={`w-full flex items-center space-x-3 p-3 px-4 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'results' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'
            }`}
            id="tab-results"
          >
            <Award size={18} />
            <span>Bảng vàng học sinh</span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`w-full flex items-center space-x-3 p-3 px-4 rounded-xl text-sm font-bold transition-all cursor-pointer ${
              activeTab === 'users' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'
            }`}
            id="tab-users"
          >
            <Shield size={18} className="text-amber-500" />
            <span>{user?.role === 'super_admin' ? 'Quản lý Tài khoản' : 'Quản lý Học sinh'}</span>
          </button>

          {/* SUPER ADMIN ONLY TABS */}
          {user?.role === 'super_admin' && (
            <>
              <button
                onClick={() => setActiveTab('audit-logs')}
                className={`w-full flex items-center space-x-3 p-3 px-4 rounded-xl text-sm font-bold transition-all cursor-pointer ${
                  activeTab === 'audit-logs' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'
                }`}
                id="tab-audit-logs"
              >
                <FileText size={18} className="text-amber-500" />
                <span>Nhật ký hệ thống</span>
              </button>
            </>
          )}
        </nav>

        {/* User Identity Footer */}
        <div className="p-4 border-t border-gray-50 bg-gray-50/50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-indigo-700 font-extrabold shrink-0">
              {user?.name?.substring(0, 2).toUpperCase() || 'AD'}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-gray-800 truncate">{user?.name || 'Hệ thống Admin'}</p>
              <p className="text-[10px] text-gray-400 truncate">{user?.email || 'admin@vocabulary.edu.vn'}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Panel Content Area */}
      <main className="flex-1 p-6 md:p-8 max-w-7xl overflow-x-hidden" id="admin-main-panel">

        {/* ==================================================================== */}
        {/* TAB 1: OVERVIEW DASHBOARD */}
        {/* ==================================================================== */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8 animate-fade-in" id="dashboard-tab-content">
            
            {/* Greetings Banner */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
              <div>
                <h2 className="text-2xl font-black text-gray-800">Xin chào, {teacherDisplayName}!</h2>
                <p className="text-gray-400 text-sm font-medium">Hôm nay hãy cùng các học sinh học thật nhiều từ vựng mới nhé.</p>
              </div>
              <button
                onClick={handleOpenNewEditor}
                className="py-3 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-md transition-all flex items-center space-x-2 cursor-pointer active:scale-95 text-sm"
              >
                <Plus size={16} />
                <span>Soạn bộ từ mới</span>
              </button>
            </div>

            {/* Quick Summary Cards Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center space-x-4">
                <span className="p-3 bg-blue-50 text-blue-600 rounded-2xl shrink-0">
                  <BookOpen size={24} />
                </span>
                <div>
                  <span className="text-xs font-bold text-gray-400 block uppercase">BỘ TỪ VỰNG</span>
                  <span className="text-2xl font-black text-gray-800">{vocabSets.length}</span>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center space-x-4">
                <span className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl shrink-0">
                  <Users size={24} />
                </span>
                <div>
                  <span className="text-xs font-bold text-gray-400 block uppercase">LỚP HỌC</span>
                  <span className="text-2xl font-black text-gray-800">{classes.length}</span>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center space-x-4">
                <span className="p-3 bg-amber-50 text-amber-600 rounded-2xl shrink-0">
                  <Star size={24} />
                </span>
                <div>
                  <span className="text-xs font-bold text-gray-400 block uppercase">HỌC SINH VINH DANH</span>
                  <span className="text-2xl font-black text-gray-800">{dashboardGoldRows.length}</span>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center space-x-4">
                <span className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl shrink-0">
                  <Award size={24} />
                </span>
                <div>
                  <span className="text-xs font-bold text-gray-400 block uppercase">LƯỢT HOÀN THÀNH</span>
                  <span className="text-2xl font-black text-gray-800">{results.length}</span>
                </div>
              </div>
            </div>

            {/* Recent activity grids */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* Left Column: Recent Student Results */}
              <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-gray-50">
                  <h3 className="font-extrabold text-gray-800 text-base">Hoạt động luyện tập gần đây</h3>
                  <button onClick={() => setIsDashboardActivityExpanded(value => !value)} className="text-xs font-bold text-indigo-600 hover:underline">{isDashboardActivityExpanded ? 'Thu gọn' : 'Xem tất cả'}</button>
                </div>

                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                  {recentResults.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm">Chưa có học sinh nào hoàn thành trò chơi.</div>
                  ) : (
                    recentResults.map((res) => (
                      <button
                        key={res.id}
                        onClick={() => setSelectedActivity(res)}
                        className="w-full p-3.5 bg-gray-50/50 hover:bg-blue-50 border border-gray-100 hover:border-blue-200 rounded-2xl flex justify-between items-start text-left transition-all"
                      >
                        <div className="space-y-1 min-w-0 pr-3">
                          <strong className="text-sm font-bold text-gray-800">{res.studentName}</strong>
                          <p className="text-xs text-gray-500">Chơi {res.gameName || GAMES_LIST.find(g => g.gameId === res.gameId)?.title || res.gameId}</p>
                          <p className="text-[10px] text-gray-400 font-mono truncate">{res.vocabSetTitle}</p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-0.5 text-[10px] text-gray-500">
                            <span>Bắt đầu: {formatVietnamDateTime(res.startedAt)}</span>
                            <span>Kết thúc: {formatVietnamDateTime(getSessionEndTime(res))}</span>
                            <span>Thời lượng: {formatDuration(res.durationSeconds || Math.round((res.durationMs || 0) / 1000))}</span>
                            <span>Trạng thái: Hoàn thành</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`px-2.5 py-1 text-xs font-black rounded-full ${
                            res.score >= 80 ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700'
                          }`}>
                            {res.score} điểm
                          </span>
                          <span className="text-[10px] text-gray-400 block mt-1">Đúng: {res.correctAnswers}/{res.totalQuestions}</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Right Column: Golden Board Quick Summary */}
              <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-gray-50">
                  <h3 className="font-extrabold text-gray-800 text-base">Bảng vàng tuần này</h3>
                  <button onClick={() => setIsDashboardLeaderboardExpanded(value => !value)} className="text-xs font-bold text-indigo-600 hover:underline">{isDashboardLeaderboardExpanded ? 'Thu gọn' : 'Xem bảng vàng'}</button>
                </div>

                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                  {dashboardGoldRows.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm">Chưa có dữ liệu để vinh danh học sinh.</div>
                  ) : (
                    dashboardGoldRows.map((entry, index) => (
                      <div key={`${entry.studentName}-${index}`} className="p-3.5 bg-gray-50/50 border border-gray-100 rounded-2xl flex justify-between items-center">
                        <div className="space-y-0.5">
                          <strong className="text-sm font-bold text-gray-800">{index === 0 ? '🥇 ' : index === 1 ? '🥈 ' : index === 2 ? '🥉 ' : ''}{formatLeaderboardDisplayName(entry)}</strong>
                          <p className="text-xs text-indigo-600 font-semibold">{entry.completedLessons} bài hoàn thành • {entry.averageAccuracy}% đúng</p>
                          <p className="text-[10px] text-gray-400 font-mono">{entry.badges[0]}</p>
                        </div>
                        <span className="px-2.5 py-1 text-xs font-black rounded-full bg-amber-50 text-amber-700">
                          {entry.honorScore}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>

            {isDashboardActivityExpanded && (
              <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm space-y-4" id="dashboard-activity-expanded">
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-4 border-b border-gray-100">
                  <div>
                    <h3 className="font-extrabold text-gray-950 text-base">Hoạt động luyện tập trong 7 ngày</h3>
                    <p className="text-xs font-semibold text-gray-500">
                      Hiển thị {filteredActivityResults.length}/{completedActivityResults.length} lượt hoàn thành, mới nhất ở trên cùng.
                    </p>
                  </div>
                  <div className="relative w-full lg:max-w-sm">
                    <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={activitySearch}
                      onChange={(e) => setActivitySearch(e.target.value)}
                      placeholder="Tìm theo tên học sinh..."
                      className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-3 pl-11 pr-4 text-sm font-bold text-gray-800 placeholder:text-gray-400 outline-none transition-all focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
                    />
                  </div>
                </div>

                <div className="space-y-3 max-h-[620px] overflow-y-auto pr-2">
                  {filteredActivityResults.length === 0 ? (
                    <div className="text-center py-10 text-gray-400 text-sm font-semibold">
                      Không có lượt luyện tập nào khớp với tìm kiếm.
                    </div>
                  ) : (
                    filteredActivityResults.map((res) => (
                      <button
                        key={`dashboard-expanded-${res.id}`}
                        onClick={() => setSelectedActivity(res)}
                        className="w-full p-4 bg-gray-50/60 hover:bg-blue-50 border border-gray-100 hover:border-blue-200 rounded-2xl flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-left transition-all"
                      >
                        <div className="space-y-1 min-w-0">
                          <strong className="text-sm font-black text-gray-900">{res.studentName}</strong>
                          <p className="text-xs font-semibold text-gray-600">
                            {res.gameName || GAMES_LIST.find(g => g.gameId === res.gameId)?.title || res.gameId}
                          </p>
                          <p className="text-[10px] text-gray-400 font-mono truncate">{res.vocabSetTitle}</p>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-1 text-[10px] font-semibold text-gray-500">
                            <span>Bắt đầu: {formatVietnamDateTime(res.startedAt)}</span>
                            <span>Kết thúc: {formatVietnamDateTime(getSessionEndTime(res))}</span>
                            <span>Thời lượng: {formatDuration(res.durationSeconds || Math.round((res.durationMs || 0) / 1000))}</span>
                            <span>Trạng thái: Hoàn thành</span>
                          </div>
                        </div>
                        <div className="sm:text-right shrink-0">
                          <span className={`inline-flex px-3 py-1 text-xs font-black rounded-full ${
                            res.score >= 80 ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700'
                          }`}>
                            {res.score} điểm
                          </span>
                          <span className="text-[10px] text-gray-500 font-bold block mt-1">
                            Đúng: {res.correctAnswers}/{res.totalQuestions}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {isDashboardLeaderboardExpanded && (
              <div className="space-y-4" id="dashboard-leaderboard-expanded">
                <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm space-y-4">
                  <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 pb-4 border-b border-gray-100">
                    <div>
                      <h3 className="font-extrabold text-gray-950 text-base">{leaderboardTitleMap[leaderboardCategory]} ({leaderboardRows.length})</h3>
                      <p className="text-xs font-semibold text-gray-500">
                        Lọc theo thời gian, thành tích, lớp và bộ bài ngay trên trang Tổng quan.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 xl:grid-cols-4 gap-2 w-full xl:max-w-4xl">
                      <select
                        value={leaderboardPeriod}
                        onChange={(e) => setLeaderboardPeriod(e.target.value as LeaderboardPeriod)}
                        className="p-3 bg-white border border-gray-200 rounded-2xl outline-none text-xs font-bold text-gray-900 focus:border-blue-500"
                      >
                        <option value="week">Tuần này</option>
                        <option value="month">Tháng này</option>
                      </select>
                      <select
                        value={leaderboardCategory}
                        onChange={(e) => setLeaderboardCategory(e.target.value as LeaderboardCategory)}
                        className="p-3 bg-white border border-gray-200 rounded-2xl outline-none text-xs font-bold text-gray-900 focus:border-blue-500"
                      >
                        <option value="gold">Bảng vàng tuần này</option>
                        <option value="diligent">Chăm chỉ nhất</option>
                        <option value="accurate">Chính xác nhất</option>
                        <option value="improved">Tiến bộ nhất</option>
                      </select>
                      <select
                        value={leaderboardClassId}
                        onChange={(e) => setLeaderboardClassId(e.target.value)}
                        className="p-3 bg-white border border-gray-200 rounded-2xl outline-none text-xs font-bold text-gray-900 focus:border-blue-500"
                      >
                        <option value="">Tất cả lớp</option>
                        {leaderboardClassOptions.map(option => (
                          <option key={option.id} value={option.id}>{option.name}</option>
                        ))}
                      </select>
                      <select
                        value={leaderboardVocabSetId}
                        onChange={(e) => setLeaderboardVocabSetId(e.target.value)}
                        className="p-3 bg-white border border-gray-200 rounded-2xl outline-none text-xs font-bold text-gray-900 focus:border-blue-500"
                      >
                        <option value="">Tất cả bộ từ</option>
                        {leaderboardSetOptions.map(option => (
                          <option key={option.id} value={option.id}>{option.title}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {leaderboardRows.slice(0, 3).map((entry, index) => (
                      <div key={`dashboard-podium-${entry.studentKey || entry.studentName}`} className={`rounded-3xl p-5 border shadow-sm overflow-hidden relative ${
                        index === 0 ? 'bg-amber-50 border-amber-200' :
                        index === 1 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'
                      }`}>
                        <div className="flex items-start justify-between">
                          <span className="text-4xl">{index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}</span>
                          <span className="text-xs font-black bg-white border border-gray-200 px-3 py-1 rounded-full text-blue-700">{entry.honorScore} điểm</span>
                        </div>
                        <h3 className="mt-4 text-lg font-black text-gray-950 truncate">{formatLeaderboardDisplayName(entry)}</h3>
                        <p className="text-xs font-bold text-gray-600 mt-1">{entry.completedLessons} bài • {entry.averageAccuracy}% đúng • {entry.studyDays} ngày học</p>
                        <p className="mt-3 text-[11px] font-black text-blue-700 bg-white border border-blue-100 rounded-xl px-3 py-2 inline-block">{entry.badges[0]}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between pb-4 border-b border-gray-200">
                    <h3 className="font-extrabold text-gray-950 text-base">{leaderboardTitleMap[leaderboardCategory]} ({leaderboardRows.length})</h3>
                    <p className="text-[10px] text-gray-500 font-bold uppercase">Điểm = Bài x50 + Tỷ lệ đúng x3 + Ngày học x20 + Tiến bộ</p>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-gray-200 mt-4">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 text-[10px] font-black uppercase text-gray-600 border-b border-gray-200">
                          <th className="p-4">STT</th>
                          <th className="p-4">Học sinh</th>
                          <th className="p-4 text-center">Bài hoàn thành</th>
                          <th className="p-4 text-center">Câu đúng</th>
                          <th className="p-4 text-center">Câu sai</th>
                          <th className="p-4 text-center">Tỷ lệ đúng</th>
                          <th className="p-4 text-center">Số ngày học</th>
                          <th className="p-4 text-center">Điểm vinh danh</th>
                          <th className="p-4">Huy hiệu</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {leaderboardRows.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="p-12 text-center text-gray-500 text-sm font-medium">
                              Chưa có dữ liệu phù hợp để lập bảng vinh danh.
                            </td>
                          </tr>
                        ) : (
                          leaderboardRows.map((entry, index) => (
                            <tr key={`dashboard-leaderboard-${entry.studentKey || entry.studentName}-${index}`} className="hover:bg-blue-50/50 text-sm font-semibold text-gray-800">
                              <td className="p-4 text-gray-500 text-xs font-bold">{index + 1}</td>
                              <td className="p-4">
                                <div className="flex items-center space-x-2">
                                  <span className="w-8 h-8 rounded-full bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center font-bold text-xs">
                                    {entry.studentName.charAt(0).toUpperCase()}
                                  </span>
                                  <strong className="text-gray-950 font-bold">{formatLeaderboardDisplayName(entry)}</strong>
                                </div>
                              </td>
                              <td className="p-4 text-center">{entry.completedLessons}</td>
                              <td className="p-4 text-center text-emerald-700 font-bold">{entry.correctAnswers}</td>
                              <td className="p-4 text-center text-rose-700 font-bold">{entry.incorrectAnswers}</td>
                              <td className="p-4 text-center font-black text-blue-700">{entry.averageAccuracy}%</td>
                              <td className="p-4 text-center">{entry.studyDays}</td>
                              <td className="p-4 text-center">
                                <span className="px-3 py-1.5 rounded-full text-xs font-black bg-blue-50 text-blue-700 border border-blue-100">{entry.honorScore}</span>
                              </td>
                              <td className="p-4">
                                <div className="flex flex-wrap gap-1">
                                  {entry.badges.map(badge => (
                                    <span key={badge} className="text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-100 px-2 py-1 rounded-full">
                                      {badge}
                                    </span>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 2: VOCAB SETS DIRECTORY */}
        {/* ==================================================================== */}
        {activeTab === 'vocab-sets' && (
          <div className="space-y-6 animate-fade-in" id="sets-tab-content">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <h2 className="text-2xl font-black text-gray-800">Kho từ vựng của tôi</h2>
                <p className="text-gray-400 text-sm">Nơi lưu trữ và soạn thảo các bộ thẻ từ vựng để giao cho học sinh.</p>
              </div>
              <button
                onClick={handleOpenNewEditor}
                className="py-3 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl flex items-center space-x-2 shadow-md transition-all cursor-pointer active:scale-95"
              >
                <Plus size={18} />
                <span>Soạn bộ từ mới</span>
              </button>
            </div>

            {/* Search and Filters Bar */}
            <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Tìm kiếm bộ từ vựng theo tên, mô tả, môn học..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full p-3.5 pl-11 bg-gray-50 rounded-2xl outline-none focus:bg-white focus:ring-4 focus:ring-indigo-50 border border-gray-100 focus:border-indigo-400 font-semibold text-sm"
                />
              </div>

              <div className="flex gap-2">
                <select
                  value={filterGrade}
                  onChange={(e) => setFilterGrade(e.target.value)}
                  className="p-3 bg-gray-50 border border-gray-100 hover:border-indigo-200 rounded-2xl outline-none text-sm font-semibold text-gray-600"
                >
                  <option value="">Tất cả Lớp học</option>
                  {gradeOptions.map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="p-3 bg-gray-50 border border-gray-100 hover:border-indigo-200 rounded-2xl outline-none text-sm font-semibold text-gray-600"
                >
                  <option value="">Tất cả Trạng thái</option>
                  <option value="public">Công khai</option>
                  <option value="draft">Bản nháp</option>
                  <option value="assignment">Giao bài tập bằng link riêng</option>
                </select>
              </div>
            </div>

            {/* Compact link list of sets */}
            {sortedFilteredSets.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-3xl border border-gray-100 shadow-sm text-gray-400 font-medium">
                Không tìm thấy bộ từ vựng nào khớp với điều kiện tìm kiếm.
              </div>
            ) : (
              <div className="space-y-3" id="sets-list">
                <div className="overflow-x-auto bg-white rounded-3xl border border-gray-100 shadow-sm">
                  <table className="w-full min-w-[1120px] text-left text-sm">
                    <thead className="bg-gray-50 text-[10px] uppercase font-black text-gray-500">
                      <tr>
                        <th className="px-4 py-3 w-12">STT</th>
                        <th className="px-4 py-3 min-w-[280px]">Bộ từ vựng</th>
                        <th className="px-4 py-3">Lớp</th>
                        <th className="px-4 py-3">Chủ đề</th>
                        <th className="px-4 py-3">Số lượng</th>
                        <th className="px-4 py-3">Trạng thái</th>
                        <th className="px-4 py-3">Ngày tạo</th>
                        <th className="px-4 py-3">Link</th>
                        <th className="px-4 py-3 min-w-[360px]">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {paginatedVocabSets.map((set, index) => {
                        const visibility = getSetVisibility(set);
                        const assignmentLink = getAssignmentLink(set);
                        return (
                          <tr key={set.id} id={`set-row-${set.id}`} className="hover:bg-indigo-50/30 transition-colors">
                            <td className="px-4 py-4 font-bold text-gray-400">{(vocabCurrentPage - 1) * vocabPageSize + index + 1}</td>
                            <td className="px-4 py-4">
                              <button
                                type="button"
                                onClick={() => onViewAsStudent(set)}
                                className="block max-w-[320px] text-left font-black text-indigo-700 hover:text-indigo-900 hover:underline truncate"
                                title="Mở bài học"
                              >
                                {set.title}
                              </button>
                              <p className="mt-1 max-w-[320px] text-xs text-gray-500 line-clamp-2">{set.description || 'Chưa có mô tả'}</p>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {(set.tags || []).slice(0, 3).map((tag, tagIndex) => (
                                  <span key={`${set.id}-tag-${tagIndex}`} className="text-[10px] font-semibold text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">#{tag}</span>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <span className="inline-flex whitespace-nowrap rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-[10px] font-black uppercase text-indigo-700">
                                {formatGradeLabel(set.gradeLevel) || '--'}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-xs font-semibold text-gray-600">{set.subject || '--'}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-xs font-bold text-gray-700">{set.items?.length || 0} từ</td>
                            <td className="px-4 py-4">
                              <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${
                                visibility === 'public' ? 'bg-emerald-50 text-emerald-700' :
                                visibility === 'draft' ? 'bg-amber-50 text-amber-700' : 'bg-indigo-50 text-indigo-700'
                              }`}>
                                {formatVisibilityLabel(visibility)}
                              </span>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-xs font-semibold text-gray-600">{formatVietnamDateTime(set.createdAt)}</td>
                            <td className="px-4 py-4">
                              {visibility === 'assignment' && assignmentLink ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    navigator.clipboard?.writeText(assignmentLink);
                                    showNotification('Đã copy link giao bài.');
                                  }}
                                  className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-[10px] font-black text-indigo-700 hover:bg-indigo-100"
                                  title="Copy link giao bài"
                                >
                                  <Copy size={13} />
                                  Link riêng
                                </button>
                              ) : <span className="text-xs text-gray-300">--</span>}
                            </td>
                            <td className="px-4 py-4">
                              <div className="flex flex-wrap gap-1.5">
                                <button type="button" onClick={() => onViewAsStudent(set)} className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-black text-emerald-700 hover:bg-emerald-100"><Play size={13} />Play</button>
                                <button type="button" onClick={() => handleOpenEditEditor(set)} className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[11px] font-black text-blue-700 hover:bg-blue-100">Sửa</button>
                                <button type="button" onClick={() => handleCloneSet(set.id)} className="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-[11px] font-black text-indigo-700 hover:bg-indigo-100">Sao chép</button>
                                <button type="button" onClick={() => handleLoadVocabResults(set)} className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-black text-amber-700 hover:bg-amber-100">Kết quả</button>
                                <button type="button" onClick={() => handleDeleteSet(set.id)} className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-black text-rose-700 hover:bg-rose-100">Xóa</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <LibraryPagination
                  currentPage={vocabCurrentPage}
                  totalPages={vocabTotalPages}
                  pageSize={vocabPageSize}
                  totalItems={sortedFilteredSets.length}
                  onPageChange={setVocabPage}
                  onPageSizeChange={setVocabPageSize}
                />
              </div>
            )}

            {vocabResultsSet && (
              <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm space-y-4" id="vocab-results-panel">
                <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-4">
                  <div>
                    <h3 className="font-black text-gray-900">Kết quả: {vocabResultsSet.title}</h3>
                    <p className="text-xs text-gray-500">
                      {isVocabResultsLoading
                        ? 'Đang tải kết quả...'
                        : hasVocabResultsFilter
                          ? `Hiển thị ${filteredVocabResults.length}/${vocabResults.length} lượt chơi`
                          : `${vocabResults.length} lượt chơi`}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setVocabResultsSet(null);
                      setVocabResults([]);
                      resetVocabResultsFilters();
                    }}
                    className="p-2 rounded-xl border border-gray-200 text-gray-600"
                    aria-label="Đóng bảng kết quả"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="flex flex-col gap-2 pb-2 sm:flex-row">
                  <div className="relative flex-1">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      id="vocab-results-name-filter"
                      type="text"
                      value={vocabResultsNameFilter}
                      onChange={event => setVocabResultsNameFilter(event.target.value)}
                      placeholder="Tìm theo tên học sinh..."
                      aria-label="Tìm kết quả theo tên học sinh"
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm font-bold text-gray-800 outline-none transition-all placeholder:text-gray-400 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-50"
                    />
                  </div>
                  <div className="relative">
                    <button
                      id="vocab-results-game-filter-btn"
                      type="button"
                      onClick={() => setVocabResultsGameDropdownOpen(open => !open)}
                      className="flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-100"
                      aria-haspopup="listbox"
                      aria-expanded={vocabResultsGameDropdownOpen}
                      aria-controls="vocab-results-game-filter-options"
                    >
                      <SlidersHorizontal size={15} />
                      {vocabResultsGameFilter
                        ? vocabResultGameOptions.find(game => game.gameId === vocabResultsGameFilter)?.title || vocabResultsGameFilter
                        : 'Tất cả trò chơi'}
                      <ChevronDown size={13} />
                    </button>
                    {vocabResultsGameDropdownOpen && (
                      <div
                        id="vocab-results-game-filter-options"
                        className="absolute right-0 top-full z-20 mt-1 w-56 rounded-2xl border border-gray-200 bg-white py-1 shadow-lg"
                        role="listbox"
                        aria-label="Lọc kết quả theo trò chơi"
                      >
                        <button
                          type="button"
                          role="option"
                          aria-selected={vocabResultsGameFilter === ''}
                          onClick={() => {
                            setVocabResultsGameFilter('');
                            setVocabResultsGameDropdownOpen(false);
                          }}
                          className={`w-full px-4 py-2 text-left text-sm font-bold hover:bg-gray-50 ${vocabResultsGameFilter === '' ? 'text-blue-700' : 'text-gray-700'}`}
                        >
                          Tất cả trò chơi
                        </button>
                        {vocabResultGameOptions.map(game => (
                          <button
                            key={game.gameId}
                            type="button"
                            role="option"
                            aria-selected={vocabResultsGameFilter === game.gameId}
                            onClick={() => {
                              setVocabResultsGameFilter(game.gameId);
                              setVocabResultsGameDropdownOpen(false);
                            }}
                            className={`w-full px-4 py-2 text-left text-sm font-bold hover:bg-gray-50 ${vocabResultsGameFilter === game.gameId ? 'text-blue-700' : 'text-gray-700'}`}
                          >
                            {game.title}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="overflow-x-auto rounded-2xl border border-gray-200">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-[10px] uppercase font-black text-gray-500">
                      <tr>
                        <th className="p-3">STT</th>
                        <th className="p-3">Học sinh</th>
                        <th className="p-3">Game</th>
                        <th className="p-3">Trạng thái</th>
                        <th className="p-3">Điểm</th>
                        <th className="p-3">Đúng/Sai/Bỏ trống</th>
                        <th className="p-3">Thời gian</th>
                        <th className="p-3">Ngày hoàn thành</th>
                        <th className="p-3">Chi tiết</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {isVocabResultsLoading ? (
                        <tr><td colSpan={9} className="p-8 text-center text-gray-400">Đang tải kết quả...</td></tr>
                      ) : vocabResults.length === 0 ? (
                        <tr><td colSpan={9} className="p-8 text-center text-gray-400">Chưa có lượt học nào trong bộ từ này.</td></tr>
                      ) : filteredVocabResults.length === 0 ? (
                        <tr><td colSpan={9} className="p-8 text-center text-gray-400">Không có kết quả khớp với bộ lọc.</td></tr>
                      ) : filteredVocabResults.map((session, index) => {
                        const unansweredCount = Math.max(
                          0,
                          Number(session.totalQuestions || 0)
                            - Number(session.correctAnswers || 0)
                            - Number(session.incorrectAnswers || 0)
                        );
                        return (
                          <tr key={session.id}>
                            <td className="p-3 font-bold text-gray-500">{index + 1}</td>
                            <td className="p-3 font-black text-gray-900">
                              {formatLeaderboardDisplayName({ studentName: session.studentName || 'Học sinh', className: session.className })}
                            </td>
                            <td className="p-3 text-xs font-bold text-gray-600">{session.gameName || session.gameId}</td>
                            <td className="p-3"><span className={`rounded-full px-2 py-1 text-[10px] font-black ${session.completedAt ? 'bg-emerald-50 text-emerald-700' : (session as any).displayStatus === 'abandoned' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>{session.completedAt ? 'Đã hoàn thành' : (session as any).displayStatus === 'abandoned' ? 'Gián đoạn' : 'Đang làm'}</span></td>
                            <td className="p-3 font-black text-blue-700">{session.completedAt ? session.score : '--'}</td>
                            <td className="p-3 text-xs font-bold text-gray-600">
                              {session.completedAt ? `${session.correctAnswers}/${session.incorrectAnswers}/${unansweredCount}` : '--'}
                            </td>
                            <td className="p-3 text-xs font-bold text-gray-600">
                              {formatDuration(session.durationSeconds || Math.round((session.durationMs || 0) / 1000))}
                            </td>
                            <td className="p-3 text-xs font-bold text-gray-600">
                              {formatVietnamDateTime(getSessionEndTime(session) || session.createdAt)}
                            </td>
                            <td className="p-3">
                              <button
                                onClick={() => setSelectedActivity(session)}
                                disabled={!session.completedAt}
                                className="px-3 py-1.5 rounded-xl !bg-blue-50 hover:!bg-blue-100 !text-blue-700 !border !border-blue-200 text-xs font-black"
                              >
                                Xem
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 2B: GRAMMAR SETS DIRECTORY */}
        {/* ==================================================================== */}
        {activeTab === 'listening-library' && token && (
          <React.Suspense fallback={(
            <div className="rounded-3xl border border-sky-100 bg-white p-10 text-center text-sm font-bold text-slate-500 shadow-sm">
              Đang tải kho bài luyện nghe...
            </div>
          )}>
            <ListeningLibraryAdmin token={token} />
          </React.Suspense>
        )}

        {activeTab === 'grammar-sets' && (
          <div className="space-y-6 animate-fade-in" id="grammar-sets-tab-content">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <h2 className="text-2xl font-black text-gray-900">Kho bài ngữ pháp</h2>
                <p className="text-gray-500 text-sm">Quản lý bài luyện ngữ pháp trắc nghiệm và tự luận, kết quả và lịch sử làm bài.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleOpenNewGrammarEditor('multiple_choice')}
                  className="py-3 px-5 !bg-emerald-600 hover:!bg-emerald-700 !text-white !border !border-emerald-700 font-bold rounded-2xl flex items-center space-x-2 shadow-md transition-all cursor-pointer"
                >
                  <Plus size={18} />
                  <span>Soạn bài ngữ pháp</span>
                </button>
                <button
                  onClick={() => handleOpenNewGrammarEditor('rewrite')}
                  className="py-3 px-5 !bg-blue-600 hover:!bg-blue-700 !text-white !border !border-blue-700 font-bold rounded-2xl flex items-center space-x-2 shadow-md transition-all cursor-pointer"
                >
                  <Edit3 size={18} />
                  <span>Soạn bài tự luận</span>
                </button>
              </div>
            </div>

            <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Tìm kiếm bài ngữ pháp theo tên, chủ đề..."
                  value={grammarSearchQuery}
                  onChange={(event) => setGrammarSearchQuery(event.target.value)}
                  className="w-full p-3.5 pl-11 bg-gray-50 rounded-2xl outline-none focus:bg-white focus:ring-4 focus:ring-emerald-50 border border-gray-100 focus:border-emerald-400 font-semibold text-sm"
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={grammarFilterGrade}
                  onChange={(event) => setGrammarFilterGrade(event.target.value)}
                  className="p-3 bg-gray-50 border border-gray-100 hover:border-emerald-200 rounded-2xl outline-none text-sm font-semibold text-gray-600"
                >
                  <option value="">Tất cả Lớp học</option>
                  {grammarGradeOptions.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
                <select
                  value={grammarFilterStatus}
                  onChange={(event) => setGrammarFilterStatus(event.target.value)}
                  className="p-3 bg-gray-50 border border-gray-100 hover:border-emerald-200 rounded-2xl outline-none text-sm font-semibold text-gray-600"
                >
                  <option value="">Tất cả Trạng thái</option>
                  <option value="public">Công khai</option>
                  <option value="draft">Bản nháp</option>
                  <option value="assignment">Link riêng</option>
                </select>
              </div>
            </div>

            {/* Compact link list of grammar sets */}
            {sortedGrammarSets.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 border border-gray-100 text-center text-gray-400 font-semibold">
                Chưa có bài ngữ pháp nào khớp với điều kiện tìm kiếm.
              </div>
            ) : (
              <div className="space-y-3" id="grammar-sets-list">
                <div className="overflow-x-auto bg-white rounded-3xl border border-gray-100 shadow-sm">
                  <table className="w-full min-w-[1120px] text-left text-sm">
                    <thead className="bg-gray-50 text-[10px] uppercase font-black text-gray-500">
                      <tr>
                        <th className="px-4 py-3 w-12">STT</th>
                        <th className="px-4 py-3 min-w-[280px]">Bài ngữ pháp</th>
                        <th className="px-4 py-3">Lớp</th>
                        <th className="px-4 py-3">Chủ đề</th>
                        <th className="px-4 py-3">Số lượng</th>
                        <th className="px-4 py-3">Trạng thái</th>
                        <th className="px-4 py-3">Ngày tạo</th>
                        <th className="px-4 py-3">Link</th>
                        <th className="px-4 py-3 min-w-[360px]">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {paginatedGrammarSets.map((set, index) => {
                        const grammarLink = getGrammarPrivateLink(set);
                        const visibility = set.visibility || 'draft';
                        return (
                          <tr key={set.id} className="hover:bg-emerald-50/30 transition-colors">
                            <td className="px-4 py-4 font-bold text-gray-400">{(grammarCurrentPage - 1) * grammarPageSize + index + 1}</td>
                            <td className="px-4 py-4">
                              <button
                                type="button"
                                onClick={() => onViewGrammarAsStudent?.(set)}
                                className="block max-w-[320px] text-left font-black text-emerald-700 hover:text-emerald-900 hover:underline truncate"
                                title="Mở bài học"
                              >
                                {set.title}
                              </button>
                              <p className="mt-1 max-w-[320px] text-xs text-gray-500 line-clamp-2">{set.description || 'Chưa có mô tả'}</p>
                              <div className="mt-1 flex flex-wrap gap-1">
                                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                                  set.questionType === 'rewrite'
                                    ? 'bg-blue-50 text-blue-700'
                                    : 'bg-emerald-50 text-emerald-700'
                                }`}>
                                  {set.questionType === 'rewrite' ? 'Tự luận' : 'Trắc nghiệm'}
                                </span>
                                {(set.tags || []).slice(0, 3).map((tag, tagIndex) => (
                                  <span key={`${set.id}-tag-${tagIndex}`} className="text-[10px] font-semibold text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">#{tag}</span>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <span className="inline-flex whitespace-nowrap rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase text-emerald-700">
                                {formatGradeLabel(set.gradeLevel) || '--'}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-xs font-semibold text-gray-600">{set.topic || set.subject || '--'}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-xs font-bold text-gray-700">{set.questions?.length || 0} câu</td>
                            <td className="px-4 py-4">
                              <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${
                                visibility === 'public' ? 'bg-emerald-50 text-emerald-700' :
                                visibility === 'draft' ? 'bg-amber-50 text-amber-700' : 'bg-indigo-50 text-indigo-700'
                              }`}>
                                {formatVisibilityLabel(visibility)}
                              </span>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-xs font-semibold text-gray-600">{formatVietnamDateTime(set.createdAt)}</td>
                            <td className="px-4 py-4">
                              <LibraryLinkStatus
                                visibility={visibility}
                                privateUrl={grammarLink}
                                onCopyPrivateLink={() => {
                                  navigator.clipboard?.writeText(grammarLink);
                                  showNotification('Đã copy link grammar riêng.');
                                }}
                              />
                            </td>
                            <td className="px-4 py-4">
                              <LibraryRowActions
                                onPlay={() => onViewGrammarAsStudent?.(set)}
                                onEdit={() => handleEditGrammarSet(set)}
                                onClone={() => handleCloneGrammarSet(set)}
                                onResults={() => handleLoadGrammarResults(set)}
                                onDelete={() => handleDeleteGrammarSet(set)}
                                playDisabled={!onViewGrammarAsStudent}
                                playTitle={onViewGrammarAsStudent ? 'Play' : 'Chưa thể mở bài học'}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <LibraryPagination
                  currentPage={grammarCurrentPage}
                  totalPages={grammarTotalPages}
                  pageSize={grammarPageSize}
                  totalItems={sortedGrammarSets.length}
                  onPageChange={setGrammarPage}
                  onPageSizeChange={setGrammarPageSize}
                />
              </div>
            )}

            {grammarResultsSet && (
              <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm space-y-4" id="grammar-results-panel">
                <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-4">
                  <div>
                    <h3 className="font-black text-gray-900">Kết quả: {grammarResultsSet.title}</h3>
                    <p className="text-xs text-gray-500">{grammarResults.length} lượt làm</p>
                  </div>
                  <button onClick={() => { setGrammarResultsSet(null); setGrammarResults([]); }} className="p-2 rounded-xl border border-gray-200 text-gray-600">
                    <X size={16} />
                  </button>
                </div>
                <div className="overflow-x-auto rounded-2xl border border-gray-200">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-[10px] uppercase font-black text-gray-500">
                      <tr>
                        <th className="p-3">STT</th>
                        <th className="p-3">Học sinh</th>
                        <th className="p-3">Điểm</th>
                        <th className="p-3">Đúng/Sai/Bỏ trống</th>
                        <th className="p-3">Thời gian</th>
                        <th className="p-3">Ngày hoàn thành</th>
                        <th className="p-3">Chi tiet</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {grammarResults.length === 0 ? (
                        <tr><td colSpan={7} className="p-8 text-center text-gray-400">Chưa có học sinh hoàn thành bài này.</td></tr>
                      ) : grammarResults.map((attempt, index) => (
                        <tr key={attempt.id}>
                          <td className="p-3 font-bold text-gray-500">{index + 1}</td>
                          <td className="p-3 font-black text-gray-900">{attempt.studentName}</td>
                          <td className="p-3 font-black text-blue-700">{attempt.score}/{attempt.maxScore}</td>
                          <td className="p-3 text-xs font-bold text-gray-600">{attempt.correctCount}/{attempt.wrongCount}/{attempt.unansweredCount}</td>
                          <td className="p-3 text-xs font-bold text-gray-600">{formatDuration(attempt.durationSeconds)}</td>
                          <td className="p-3 text-xs font-bold text-gray-600">{formatVietnamDateTime(attempt.completedAt || attempt.createdAt)}</td>
                          <td className="p-3">
                            <button
                              onClick={() => setSelectedActivity(grammarAttemptToActivity(attempt, grammarResultsSet))}
                              className="px-3 py-1.5 rounded-xl !bg-blue-50 hover:!bg-blue-100 !text-blue-700 !border !border-blue-200 text-xs font-black"
                            >
                              Xem
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 2C: GRAMMAR EDITOR */}
        {/* ==================================================================== */}
        {activeTab === 'grammar-editor' && (
          <div className="space-y-6 animate-fade-in" id="grammar-editor-tab-content">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-gray-900">
                  {editingGrammarSetId
                    ? grammarQuestionType === 'rewrite' ? 'Chỉnh sửa bài tự luận' : 'Chỉnh sửa bài ngữ pháp'
                    : grammarQuestionType === 'rewrite' ? 'Soạn bài tự luận mới' : 'Soạn bài ngữ pháp mới'}
                </h2>
                <p className="text-gray-500 text-sm">
                  {grammarQuestionType === 'rewrite'
                    ? 'Tạo bài ngữ pháp với câu trả lời dạng văn bản và chấm điểm tự động sau khi chuẩn hóa.'
                    : 'Tạo bài trắc nghiệm ngữ pháp với đáp án đúng theo optionId ổn định.'}
                </p>
              </div>
              <button onClick={handleSaveGrammarSet} className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black shadow-md">
                {grammarQuestionType === 'rewrite' ? 'Lưu bài tự luận' : 'Lưu bài ngữ pháp'}
              </button>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm grid grid-cols-1 lg:grid-cols-3 gap-4">
              <label className="lg:col-span-2 text-xs font-black uppercase text-gray-500 space-y-2">
                <span>Tên bài ngữ pháp</span>
                <input value={grammarTitle} onChange={e => setGrammarTitle(e.target.value)} className="w-full p-3 rounded-2xl border border-gray-200 text-sm font-bold text-gray-900" placeholder="Ví dụ: Present Simple - Unit 1" />
              </label>
              <label className="text-xs font-black uppercase text-gray-500 space-y-2">
                <span>Lớp</span>
                <select value={grammarGrade} onChange={e => setGrammarGrade(e.target.value)} className="w-full p-3 rounded-2xl border border-gray-200 text-sm font-bold text-gray-900">
                  {gradeOptions.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
              <label className="text-xs font-black uppercase text-gray-500 space-y-2">
                <span>Môn/chủ đề</span>
                <input value={grammarSubject} onChange={e => setGrammarSubject(e.target.value)} className="w-full p-3 rounded-2xl border border-gray-200 text-sm font-bold text-gray-900" />
              </label>
              <label className="text-xs font-black uppercase text-gray-500 space-y-2">
                <span>Topic</span>
                <input value={grammarTopic} onChange={e => setGrammarTopic(e.target.value)} className="w-full p-3 rounded-2xl border border-gray-200 text-sm font-bold text-gray-900" />
              </label>
              <label className="text-xs font-black uppercase text-gray-500 space-y-2">
                <span>Trạng thái</span>
                <select value={grammarVisibility} onChange={e => setGrammarVisibility(e.target.value as any)} className="w-full p-3 rounded-2xl border border-gray-200 text-sm font-bold text-gray-900">
                  <option value="public">Công khai</option>
                  <option value="assignment">Riêng tư</option>
                  <option value="draft">Ẩn</option>
                </select>
              </label>
              <label className="lg:col-span-2 text-xs font-black uppercase text-gray-500 space-y-2">
                <span>Mô tả chi tiết</span>
                <textarea value={grammarDescription} onChange={e => setGrammarDescription(e.target.value)} className="w-full min-h-24 p-3 rounded-2xl border border-gray-200 text-sm font-bold text-gray-900" />
              </label>
              <label className="text-xs font-black uppercase text-gray-500 space-y-2">
                <span>Tags</span>
                <input value={grammarTags} onChange={e => setGrammarTags(e.target.value)} className="w-full p-3 rounded-2xl border border-gray-200 text-sm font-bold text-gray-900" />
              </label>
              <label className="text-xs font-black uppercase text-gray-500 space-y-2">
                <span>Thời gian làm bài (phút)</span>
                <input type="number" min={0} value={grammarTimeLimitMinutes} onChange={e => setGrammarTimeLimitMinutes(Number(e.target.value))} className="w-full p-3 rounded-2xl border border-gray-200 text-sm font-bold text-gray-900" />
              </label>
              <label className="text-xs font-black uppercase text-gray-500 space-y-2">
                <span>Số lần được làm</span>
                <input type="number" min={1} value={grammarMaxAttempts} onChange={e => setGrammarMaxAttempts(Number(e.target.value))} className="w-full p-3 rounded-2xl border border-gray-200 text-sm font-bold text-gray-900" />
              </label>
              <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-4 gap-3">
                {[
                  ['Trộn câu hỏi', grammarShuffleQuestions, setGrammarShuffleQuestions],
                  ...(grammarQuestionType === 'multiple_choice'
                    ? [['Trộn đáp án', grammarShuffleOptions, setGrammarShuffleOptions]]
                    : []),
                  ['Giải thích sau từng câu', grammarShowExplanationImmediately, setGrammarShowExplanationImmediately],
                  ['Xem giải thích sau khi nộp', grammarShowReviewAfterSubmit, setGrammarShowReviewAfterSubmit]
                ].map(([label, checked, setter]: any) => (
                  <label key={label} className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 p-3 text-xs font-black text-gray-700">
                    <input type="checkbox" checked={checked} onChange={e => setter(e.target.checked)} />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
              <div>
                <h3 className="font-black text-gray-900">Nhập nhanh nhiều câu hỏi</h3>
                <p className="text-xs text-gray-500">
                  {grammarQuestionType === 'rewrite'
                    ? 'Mỗi câu gồm QUESTION, ANSWER, EXPLANATION; ACCEPTED là tùy chọn và mỗi đáp án thay thế nằm trên một dòng.'
                    : 'Mỗi câu gồm QUESTION, A, B, ANSWER, EXPLANATION; C và D là tùy chọn. Mỗi câu có từ 2 đến 4 đáp án và cách nhau bằng dòng trống.'}
                </p>
              </div>
              <textarea
                value={grammarBulkText}
                onChange={e => setGrammarBulkText(e.target.value)}
                className="w-full min-h-64 p-4 rounded-2xl border border-gray-200 bg-gray-50 text-sm font-mono text-gray-800"
                placeholder={grammarQuestionType === 'rewrite'
                  ? `QUESTION: Viết dạng đầy đủ của: It's Monday.\nANSWER: It is Monday.\nACCEPTED: It's Monday.\nEXPLANATION: It's là dạng viết tắt của It is.\n\nQUESTION: Hoàn thành câu: She _____ a teacher.\nANSWER: is\nEXPLANATION: Chủ ngữ She đi với động từ to be là is.`
                  : `QUESTION: She is a teacher, _____?\nA: is she\nB: isn't she\nANSWER: B\nEXPLANATION: Câu khẳng định dùng đuôi phủ định.\n\nQUESTION: They _____ football every Sunday.\nA: plays\nB: play\nC: playing\nANSWER: B\nEXPLANATION: Chủ ngữ They dùng động từ nguyên mẫu play.`}
              />
              <button onClick={handleParseGrammarBulk} className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-black">
                Ghép dữ liệu vào bảng câu hỏi
              </button>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-gray-900">Bảng câu hỏi ({grammarQuestions.length})</h3>
                <button onClick={handleAddGrammarQuestion} className="px-4 py-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs font-black">Thêm câu</button>
              </div>
              <div className="space-y-4">
                {grammarQuestions.map((question, qIndex) => (
                  <div key={question.id} className="rounded-2xl border border-gray-200 p-4 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black text-gray-500">Câu {qIndex + 1}</span>
                      <div className="flex gap-2">
                        <button onClick={() => handleDuplicateGrammarQuestion(question)} className="px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 text-xs font-black">Nhân bản</button>
                        <button onClick={() => setGrammarQuestions(prev => prev.filter(item => item.id !== question.id).map((item, index) => ({ ...item, position: index + 1 })))} className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-700 text-xs font-black">Xóa</button>
                      </div>
                    </div>
                    <textarea value={question.questionText} onChange={e => updateGrammarQuestion(question.id, { questionText: e.target.value })} className="w-full p-3 rounded-xl border border-gray-200 text-sm font-bold text-gray-900" placeholder="Câu hỏi" />
                    {grammarQuestionType === 'rewrite' ? (
                      <div className="space-y-2">
                        <textarea
                          value={question.correctAnswer || ''}
                          onChange={e => updateGrammarQuestion(question.id, { correctAnswer: e.target.value })}
                          className="w-full p-3 rounded-xl border border-emerald-200 bg-emerald-50 text-sm font-bold text-gray-900"
                          placeholder="Đáp án đúng"
                        />
                        <textarea
                          value={(question.acceptedAnswers || []).join('\n')}
                          onChange={e => updateGrammarQuestion(question.id, { acceptedAnswers: e.target.value.split(/\r?\n/) })}
                          className="w-full p-3 rounded-xl border border-blue-200 bg-blue-50 text-sm font-bold text-gray-900"
                          placeholder="Các đáp án chấp nhận khác - mỗi dòng một đáp án (tùy chọn)"
                        />
                        <p className="text-xs text-gray-500">
                          Chỉ thêm các cách trả lời thực sự tương đương, ví dụ: it is cho đáp án chính it&apos;s.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {question.options.map((option, index) => (
                          <div key={option.id} className="flex gap-2">
                            <select value={question.correctOptionId === option.id ? option.id : ''} onChange={() => updateGrammarQuestion(question.id, { correctOptionId: option.id })} className="w-12 rounded-xl border border-gray-200 text-xs font-black text-gray-700">
                              <option value="">{String.fromCharCode(65 + index)}</option>
                              <option value={option.id}>Đúng</option>
                            </select>
                            <input value={option.text} onChange={e => updateGrammarOption(question.id, option.id, e.target.value)} className="flex-1 p-3 rounded-xl border border-gray-200 text-sm font-bold text-gray-900" placeholder={`Đáp án ${index + 1}`} />
                          </div>
                        ))}
                      </div>
                    )}
                    <textarea value={question.explanation} onChange={e => updateGrammarQuestion(question.id, { explanation: e.target.value })} className="w-full p-3 rounded-xl border border-gray-200 text-sm text-gray-800" placeholder="Lời giải thích bắt buộc" />
                    {grammarQuestionType === 'multiple_choice' && (
                      <label className="flex items-center gap-2 text-xs font-black text-gray-500">
                        Điểm
                        <input type="number" min={1} value={question.score} onChange={e => updateGrammarQuestion(question.id, { score: Number(e.target.value) })} className="w-24 p-2 rounded-xl border border-gray-200 text-sm font-bold text-gray-900" />
                      </label>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 3: ADVANCED VOCAB SET EDITOR */}
        {/* ==================================================================== */}
        {activeTab === 'editor' && (
          <div className="space-y-8 animate-fade-in" id="editor-tab-content">
            
            {/* Editor Top Options */}
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <h2 className="text-2xl font-black text-gray-800">
                  {editingSetId ? "Chỉnh sửa bộ từ vựng" : "Soạn thảo bộ từ vựng mới"}
                </h2>
                <p className="text-gray-400 text-sm">Điền đầy đủ thông tin bên dưới hoặc nhập nhanh nhiều dòng để đưa dữ liệu vào bảng.</p>
              </div>

              <div className="flex space-x-2">
                <button
                  onClick={() => setActiveTab('vocab-sets')}
                  className="py-3 px-6 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl text-sm transition-all cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={handleSaveSet}
                  className="py-3 px-8 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl text-sm shadow-md transition-all cursor-pointer active:scale-95"
                  id="save-vocabset-btn"
                >
                  Lưu bộ từ vựng
                </button>
              </div>
            </div>

            {/* Core Info Details */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm grid grid-cols-1 md:grid-cols-12 gap-6" id="editor-details-form">
              <div className="md:col-span-8 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-gray-400">Tên bộ từ vựng *</label>
                  <input
                    type="text"
                    value={editorTitle}
                    onChange={(e) => setEditorTitle(e.target.value)}
                    placeholder="Ví dụ: Ordinal Numbers (Số thứ tự)"
                    className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 focus:border-indigo-400 focus:bg-white outline-none font-bold text-gray-800 text-lg transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-gray-400">Mô tả chi tiết</label>
                  <textarea
                    value={editorDescription}
                    onChange={(e) => setEditorDescription(e.target.value)}
                    placeholder="Mô tả ngắn gọn về bài học từ vựng này..."
                    className="w-full p-4 h-24 bg-gray-50 rounded-2xl border border-gray-100 focus:border-indigo-400 focus:bg-white outline-none font-semibold text-gray-600 text-sm transition-all resize-none"
                  />
                </div>
              </div>

              <div className="md:col-span-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase text-gray-400">Khối lớp học</label>
                    <select
                      value={editorGrade}
                      onChange={(e) => setEditorGrade(e.target.value)}
                      className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none font-bold text-gray-600 text-sm"
                    >
                      {gradeOptions.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase text-gray-400">Môn học/Chủ đề</label>
                    <input
                      type="text"
                      value={editorSubject}
                      onChange={(e) => setEditorSubject(e.target.value)}
                      placeholder="Science, Math,..."
                      className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none font-bold text-gray-600 text-sm"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-gray-400">Trạng thái chia sẻ</label>
                  <select
                    value={editorStatus}
                    onChange={(e) => setEditorStatus(e.target.value as any)}
                    className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none font-bold text-gray-600 text-sm"
                  >
                    <option value="public">Công khai: Hiển thị ở trang chủ, ai cũng có thể học</option>
                    <option value="assignment">Giao bài tập bằng link riêng: Không hiện công khai, chỉ ai có link mới làm được</option>
                    <option value="draft">Bản nháp: Chỉ lưu tạm, học sinh chưa xem được</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase text-gray-400">Từ khóa/Tags (cách nhau bằng phẩy)</label>
                  <input
                    type="text"
                    value={editorTags.join(', ')}
                    onChange={(e) => setEditorTags(e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
                    placeholder="numbers, basic, ordinal"
                    className="w-full p-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none font-bold text-gray-600 text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm" id="tts-settings-card-v2">
              <div className="space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Volume2 size={18} className="text-indigo-600" />
                      <h3 className="font-extrabold text-gray-800 text-sm">C&#224;i &#273;&#7863;t ph&#225;t &#226;m TTS</h3>
                    </div>
                    <p className="text-xs text-gray-500 font-medium">
                      T&#7841;o audio tr&#432;&#7899;c khi l&#432;u. Khi b&#7845;m L&#432;u b&#7897; t&#7915;, metadata audio s&#7869; &#273;&#432;&#7907;c l&#432;u c&#249;ng t&#7915; v&#7921;ng.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-gray-500">Provider</label>
                    <select
                      value={ttsSettings.provider}
                      onChange={(e) => handleTtsProviderChange(e.target.value)}
                      className="w-full p-2.5 bg-gray-50 rounded-xl border border-gray-100 outline-none font-bold text-gray-700 text-xs"
                    >
                      <option value="ai33">AI33 v3</option>
                      <option value="yupvox">YupVox</option>
                    </select>
                  </div>

                  <div className="space-y-1 xl:col-span-2">
                    <label className="text-[10px] font-bold uppercase text-gray-500">Voice ID</label>
                    <input
                      type="text"
                      value={ttsSettings.voice}
                      onChange={(e) => updateTtsSettings({ voice: e.target.value.trim() })}
                      placeholder={ttsSettings.provider === 'yupvox' ? 'EBF147' : 'elevenlabs_wMBr6SfqQVuOqplK01NE'}
                      className="w-full p-2.5 bg-gray-50 rounded-xl border border-gray-100 outline-none font-mono text-gray-700 text-xs focus:bg-white focus:border-indigo-400"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-gray-500">Ng&#244;n ng&#7919;</label>
                    <select
                      value={ttsSettings.lang}
                      onChange={(e) => {
                        const lang = e.target.value as TtsSettings['lang'];
                        updateTtsSettings({ lang });
                      }}
                      className="w-full p-2.5 bg-gray-50 rounded-xl border border-gray-100 outline-none font-bold text-gray-700 text-xs"
                    >
                      <option value="en-US">en-US</option>
                      <option value="en-GB">en-GB</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-gray-500">T&#7889;c &#273;&#7897;</label>
                    <select
                      value={String(ttsSettings.speed)}
                      onChange={(e) => updateTtsSettings({ speed: Number(e.target.value) })}
                      className="w-full p-2.5 bg-gray-50 rounded-xl border border-gray-100 outline-none font-bold text-gray-700 text-xs"
                    >
                      {[0.8, 0.9, 1, 1.1, 1.2].map(speed => (
                        <option key={speed} value={speed}>{speed.toFixed(1)}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {ttsSettings.provider === 'yupvox' && (
                  <p className="text-xs text-slate-500 font-medium">
                    YupVox dùng Voice ID (mặc định EBF147). Tốc độ được lưu cùng bộ từ và áp dụng khi phát audio cho học sinh.
                  </p>
                )}

              </div>
            </div>

            <div className="hidden" id="tts-settings-card">
              <div className="space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Volume2 size={18} className="text-indigo-600" />
                      <h3 className="font-extrabold text-gray-800 text-sm">Cài đặt phát âm TTS</h3>
                    </div>
                    <p className="text-xs text-gray-500 font-medium">
                      Audio được tạo nền sau khi lưu và được cache theo voice_id, ngôn ngữ, tốc độ và nội dung từ.
                    </p>
                  </div>

                  <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-700 font-bold text-xs w-fit">
                    <input
                      type="checkbox"
                      checked={ttsSettings.autoGenerate}
                      onChange={(e) => updateTtsSettings({ autoGenerate: e.target.checked })}
                      className="accent-indigo-600"
                    />
                    <span>Tự tạo audio khi lưu</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-gray-500">Provider</label>
                    <select
                      value={ttsSettings.provider}
                      onChange={(e) => handleTtsProviderChange(e.target.value)}
                      className="w-full p-2.5 bg-gray-50 rounded-xl border border-gray-100 outline-none font-bold text-gray-700 text-xs"
                    >
                      <option value="ai33">AI33 v3</option>
                      <option value="yupvox">YupVox</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-gray-500">Giọng đọc mẫu</label>
                    <select
                      value={ttsSettings.voice}
                      onChange={(e) => updateTtsSettings({ voice: e.target.value })}
                      className="w-full p-2.5 bg-gray-50 rounded-xl border border-gray-100 outline-none font-bold text-gray-700 text-xs"
                    >
                      {TTS_VOICE_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1 xl:col-span-2">
                    <label className="text-[10px] font-bold uppercase text-gray-500">Voice ID</label>
                    <input
                      type="text"
                      value={ttsSettings.voice}
                      onChange={(e) => updateTtsSettings({ voice: e.target.value.trim() })}
                      placeholder="Ví dụ: elevenlabs_wMBr6SfqQVuOqplK01NE"
                      className="w-full p-2.5 bg-gray-50 rounded-xl border border-gray-100 outline-none font-mono text-gray-700 text-xs focus:bg-white focus:border-indigo-400"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-gray-500">Ngôn ngữ</label>
                    <select
                      value={ttsSettings.lang}
                      onChange={(e) => {
                        const lang = e.target.value as TtsSettings['lang'];
                        updateTtsSettings({ lang });
                      }}
                      className="w-full p-2.5 bg-gray-50 rounded-xl border border-gray-100 outline-none font-bold text-gray-700 text-xs"
                    >
                      <option value="en-US">en-US</option>
                      <option value="en-GB">en-GB</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-gray-500">Tốc độ</label>
                    <select
                      value={String(ttsSettings.speed)}
                      onChange={(e) => updateTtsSettings({ speed: Number(e.target.value) })}
                      className="w-full p-2.5 bg-gray-50 rounded-xl border border-gray-100 outline-none font-bold text-gray-700 text-xs"
                    >
                      {[0.8, 0.9, 1, 1.1, 1.2].map(speed => (
                        <option key={speed} value={speed}>{speed.toFixed(1)}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={handlePreviewTtsVoice}
                    disabled={isPreviewingTts || !ttsSettings.voice.trim()}
                    className="py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-500 text-white rounded-xl font-black text-xs flex items-center justify-center gap-2"
                  >
                    <Volume2 size={14} />
                    <span>{isPreviewingTts ? 'Đang tạo...' : 'Nghe thử giọng'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCheckAudioStatusSmart}
                    disabled={!editingSetId}
                    className="py-2.5 px-4 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 text-slate-700 rounded-xl font-black text-xs border border-slate-200 flex items-center justify-center gap-2"
                  >
                    <RefreshCw size={14} />
                    <span>Kiểm tra audio</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="hidden" id="tts-settings-card-legacy-hidden">
              <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
                <div className="space-y-1 min-w-[220px]">
                  <div className="flex items-center gap-2">
                    <Volume2 size={18} className="text-indigo-600" />
                    <h3 className="font-extrabold text-gray-800 text-sm">CÃ i Ä‘áº·t phÃ¡t Ã¢m TTS</h3>
                  </div>
                  <p className="hidden">
                    Moi dong mot tu theo dang: word | meaning | ipa | partOfSpeech.
                  </p>
                  <p className="hidden">
                    Táº¡o audio ná»n sau khi lÆ°u. Há»c sinh sáº½ phÃ¡t file Ä‘Ã£ cache, khÃ´ng gá»i TTS má»—i láº§n nghe.
                  </p>
                </div>

                <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-700 font-bold text-xs">
                  <input
                    type="checkbox"
                    checked={ttsSettings.autoGenerate}
                    onChange={(e) => updateTtsSettings({ autoGenerate: e.target.checked })}
                    className="accent-indigo-600"
                  />
                  <span>Tá»± táº¡o audio khi lÆ°u</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 flex-1">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-gray-400">Provider</label>
                    <select
                      value={ttsSettings.provider}
                      onChange={(e) => handleTtsProviderChange(e.target.value)}
                      className="w-full p-2.5 bg-gray-50 rounded-xl border border-gray-100 outline-none font-bold text-gray-700 text-xs"
                    >
                      <option value="ai33">AI33 v3</option>
                      <option value="yupvox">YupVox</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-gray-400">Giá»ng Ä‘á»c</label>
                    <select
                      value={ttsSettings.voice}
                      onChange={(e) => updateTtsSettings({ voice: e.target.value })}
                      className="w-full p-2.5 bg-gray-50 rounded-xl border border-gray-100 outline-none font-bold text-gray-700 text-xs"
                    >
                      {TTS_VOICE_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-gray-400">NgÃ´n ngá»¯</label>
                    <select
                      value={ttsSettings.lang}
                      onChange={(e) => {
                        const lang = e.target.value as TtsSettings['lang'];
                        updateTtsSettings({ lang });
                      }}
                      className="w-full p-2.5 bg-gray-50 rounded-xl border border-gray-100 outline-none font-bold text-gray-700 text-xs"
                    >
                      <option value="en-US">en-US</option>
                      <option value="en-GB">en-GB</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-gray-400">Tá»‘c Ä‘á»™</label>
                    <select
                      value={String(ttsSettings.speed)}
                      onChange={(e) => updateTtsSettings({ speed: Number(e.target.value) })}
                      className="w-full p-2.5 bg-gray-50 rounded-xl border border-gray-100 outline-none font-bold text-gray-700 text-xs"
                    >
                      {[0.8, 0.9, 1, 1.1, 1.2].map(speed => (
                        <option key={speed} value={speed}>{speed.toFixed(1)}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-gray-400">Nghe thá»­</label>
                    <button
                      type="button"
                      onClick={handlePreviewTtsVoice}
                      disabled={isPreviewingTts}
                      className="w-full p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-500 text-white rounded-xl font-black text-xs flex items-center justify-center gap-2"
                    >
                      <Volume2 size={14} />
                      <span>{isPreviewingTts ? 'Äang táº¡o...' : 'Nghe thá»­'}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Batch Paste Board */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-5" id="batch-paste-panel">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-gray-50 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <ListPlus className="text-indigo-600" size={20} />
                    <h3 className="font-extrabold text-gray-800 text-base">Nhập nhanh từ vựng nhiều dòng</h3>
                  </div>
                  <p className="text-xs text-gray-500 font-semibold">
                    Moi dong mot tu theo dang: word | meaning | ipa | partOfSpeech.
                  </p>
                  <p className="hidden">
                    Mỗi dòng ở các ô bên dưới sẽ ghép thành một dòng tương ứng trong bảng từ vựng.
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase text-gray-500">D&#225;n d&#7919; li&#7879;u t&#7915; v&#7921;ng</label>
                <textarea
                  value={batchVocabularyText}
                  onChange={(e) => setBatchVocabularyText(e.target.value)}
                  placeholder={'traffic | giao th\u00f4ng | /\u02c8tr\u00e6f\u026ak/ | noun\nroad | con \u0111\u01b0\u1eddng | /r\u0259\u028ad/ | noun\nturn | r\u1ebd, l\u01b0\u1ee3t | /t\u025c\u02d0n/ | verb, noun'}
                  className="w-full min-h-[220px] p-4 bg-gray-50 rounded-2xl border border-gray-100 outline-none font-mono text-sm leading-7 focus:bg-white focus:border-indigo-400 resize-y"
                />
              </div>

              <div className="hidden">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-gray-400">Cột từ tiếng Anh *</label>
                  <textarea
                    value={batchTerms}
                    onChange={(e) => setBatchTerms(e.target.value)}
                    placeholder="apple&#10;banana&#10;cat"
                    className="w-full h-36 p-3 bg-gray-50 rounded-xl border border-gray-100 outline-none font-mono text-xs focus:bg-white focus:border-indigo-400 resize-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-gray-400">Cột nghĩa tiếng Việt *</label>
                  <textarea
                    value={batchMeanings}
                    onChange={(e) => setBatchMeanings(e.target.value)}
                    placeholder="quả táo&#10;quả chuối&#10;con mèo"
                    className="w-full h-36 p-3 bg-gray-50 rounded-xl border border-gray-100 outline-none font-semibold text-xs focus:bg-white focus:border-indigo-400 resize-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-gray-400">Cột phiên âm IPA</label>
                  <textarea
                    value={batchIpas}
                    onChange={(e) => setBatchIpas(e.target.value)}
                    placeholder="/ˈæpl/&#10;/bəˈnænə/&#10;/kæt/"
                    className="w-full h-36 p-3 bg-gray-50 rounded-xl border border-gray-100 outline-none font-mono text-xs focus:bg-white focus:border-indigo-400 resize-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-gray-400">Cột từ loại</label>
                  <textarea
                    value={batchPartsOfSpeech}
                    onChange={(e) => setBatchPartsOfSpeech(e.target.value)}
                    placeholder="Noun&#10;Noun&#10;Noun"
                    className="w-full h-36 p-3 bg-gray-50 rounded-xl border border-gray-100 outline-none font-semibold text-xs focus:bg-white focus:border-indigo-400 resize-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-gray-400">Cột ví dụ tiếng Anh</label>
                  <textarea
                    value={batchExamples}
                    onChange={(e) => setBatchExamples(e.target.value)}
                    placeholder="I eat an apple after lunch.&#10;She puts a banana in her school bag.&#10;The cat sleeps near the window."
                    className="w-full h-36 p-3 bg-gray-50 rounded-xl border border-gray-100 outline-none font-semibold text-xs focus:bg-white focus:border-indigo-400 resize-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase text-gray-400">Cột dịch nghĩa tiếng Việt</label>
                  <textarea
                    value={batchExampleMeanings}
                    onChange={(e) => setBatchExampleMeanings(e.target.value)}
                    placeholder="Tôi ăn một quả táo sau bữa trưa.&#10;Cô ấy bỏ một quả chuối vào cặp đi học.&#10;Con mèo ngủ gần cửa sổ."
                    className="w-full h-36 p-3 bg-gray-50 rounded-xl border border-gray-100 outline-none font-semibold text-xs focus:bg-white focus:border-indigo-400 resize-none"
                  />
                </div>
              </div>

              <button
                onClick={handleProcessBatchAdd}
                disabled={!batchVocabularyText.trim()}
                className="w-full py-3 bg-indigo-50 hover:bg-indigo-100 disabled:bg-gray-50 disabled:text-gray-300 text-indigo-700 font-bold rounded-xl transition-all border border-indigo-100 text-sm cursor-pointer"
                id="process-batch-btn"
              >
                Ghép dữ liệu vào bảng từ vựng
              </button>
            </div>

            {/* Main Interactive Vocabulary Grid Table */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4" id="editor-items-grid">
              
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-4 border-b border-gray-50">
                <div className="space-y-0.5">
                  <h3 className="font-extrabold text-gray-800 text-base">Danh sách từ vựng ({editorItems.length} từ)</h3>
                  <p className="text-xs text-gray-400 font-medium">Bấm "Thêm dòng" để soạn thảo hoặc tự sinh các phần còn thiếu trong bảng.</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleGenerateAllBlankIpas}
                    className="py-2.5 px-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs transition-all flex items-center space-x-1 border border-indigo-100 cursor-pointer"
                    id="auto-generate-ipa-btn"
                  >
                    <Sparkles size={14} />
                    <span>Tự sinh các phần còn thiếu</span>
                  </button>

                  <button
                    onClick={handleGenerateAllAudioBeforeSave}
                    disabled={isBatchGeneratingAudio}
                    className="py-2.5 px-4 bg-emerald-50 hover:bg-emerald-100 disabled:bg-gray-50 disabled:text-gray-300 text-emerald-700 font-bold rounded-xl text-xs transition-all flex items-center space-x-1 border border-emerald-100 cursor-pointer"
                    id="batch-generate-audio-btn"
                    title="Tạo audio cho các dòng hiện tại trước khi lưu bộ từ"
                  >
                    <Volume2 size={14} />
                    <span>{isBatchGeneratingAudio ? 'Đang gửi...' : 'Tạo audio hàng loạt'}</span>
                  </button>

                  <button
                    onClick={handleCheckAudioStatusSmart}
                    disabled={!editingSetId}
                    className="py-2.5 px-4 bg-slate-50 hover:bg-slate-100 disabled:bg-gray-50 disabled:text-gray-300 text-slate-700 font-bold rounded-xl text-xs transition-all flex items-center space-x-1 border border-slate-100 cursor-pointer"
                    id="check-audio-status-btn"
                    title={editingSetId ? 'Kiểm tra audio đã tồn tại/chưa tạo/lỗi' : 'Bộ từ mới chưa có trạng thái audio'}
                  >
                    <RefreshCw size={14} />
                    <span>Kiểm tra audio</span>
                  </button>

                  <button
                    onClick={handleAddItemRow}
                    className="py-2.5 px-4 bg-gray-50 hover:bg-indigo-600 hover:text-white text-gray-700 font-bold rounded-xl text-xs border border-gray-100 transition-all flex items-center space-x-1 cursor-pointer"
                    id="add-single-row-btn"
                  >
                    <Plus size={14} />
                    <span>Thêm dòng từ mới</span>
                  </button>
                </div>
              </div>

              {/* Items Table Sheet */}
              <div className="overflow-x-auto rounded-2xl border border-gray-100">
                <table className="w-full text-left border-collapse" id="vocab-editor-table">
                  <thead>
                    <tr className="bg-gray-50/50 text-[10px] font-black uppercase text-gray-400 border-b border-gray-100">
                      <th className="p-4 text-center w-12">STT</th>
                      <th className="p-4 w-44">Từ Tiếng Anh *</th>
                      <th className="p-4 w-44">Nghĩa Tiếng Việt *</th>
                      <th className="p-4 w-36">Phát âm IPA</th>
                      <th className="p-4 w-28">Loại từ</th>
                      <th className="p-4 min-w-[200px]">Ví dụ minh họa</th>
                      <th className="p-4 w-40">Audio TTS</th>
                      <th className="p-4 text-center w-12">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {editorItems.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-12 text-center text-gray-400 text-sm font-medium">
                          Danh sách từ vựng trống. Hãy thêm dòng hoặc sử dụng các công cụ sinh nhanh ở trên!
                        </td>
                      </tr>
                    ) : (
                      editorItems.map((item, index) => (
                        <tr key={item.id} className="hover:bg-gray-50/30">
                          <td className="p-3 text-center text-xs font-bold text-gray-400">
                            {index + 1}
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={item.term}
                              onChange={(e) => handleUpdateItemValue(item.id, 'term', e.target.value)}
                              placeholder="Từ tiếng Anh"
                              className="w-full p-2.5 bg-gray-50 border border-gray-100 hover:border-indigo-300 focus:bg-white focus:border-indigo-500 rounded-xl outline-none font-bold text-sm transition-all"
                            />
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={item.meaning}
                              onChange={(e) => handleUpdateItemValue(item.id, 'meaning', e.target.value)}
                              placeholder="Nghĩa tiếng Việt"
                              className="w-full p-2.5 bg-gray-50 border border-gray-100 hover:border-indigo-300 focus:bg-white focus:border-indigo-500 rounded-xl outline-none font-semibold text-sm transition-all"
                            />
                          </td>
                          <td className="p-3">
                            <div className="relative">
                              <input
                                type="text"
                                value={item.ipa}
                                onChange={(e) => handleUpdateItemValue(item.id, 'ipa', e.target.value)}
                                placeholder="/pronunciation/"
                                className="w-full p-2.5 pr-10 bg-gray-50 border border-gray-100 hover:border-indigo-300 focus:bg-white focus:border-indigo-500 rounded-xl outline-none font-mono text-xs transition-all"
                              />
                              <button
                                onClick={() => handleGenerateIpaForRow(item.id, item.term)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer"
                                title="Tự động bổ sung IPA, loại từ, ví dụ và dịch ví dụ"
                              >
                                <Sparkles size={12} />
                              </button>
                            </div>
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              value={item.pos}
                              onChange={(e) => handleUpdateItemValue(item.id, 'pos', e.target.value)}
                              placeholder="Noun, Verb, Adjective..."
                              className="w-full p-2.5 bg-gray-50 border border-gray-100 hover:border-indigo-300 focus:bg-white focus:border-indigo-500 rounded-xl outline-none text-xs font-semibold transition-all"
                            />
                          </td>
                          <td className="p-3 space-y-2">
                            <div className="relative">
                              <input
                                type="text"
                                value={item.example}
                                onChange={(e) => handleUpdateItemValue(item.id, 'example', e.target.value)}
                                placeholder="English example sentence..."
                                className="w-full p-2 pr-9 bg-gray-50 border border-gray-100 focus:bg-white rounded-xl outline-none text-xs"
                              />
                              <button
                                type="button"
                                onClick={() => item.example.trim() && speakEnglish(item.example)}
                                disabled={!item.example.trim()}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-30 rounded-lg transition-all cursor-pointer"
                                title="Nghe ví dụ tiếng Anh"
                              >
                                <Volume2 size={12} />
                              </button>
                            </div>
                            <input
                              type="text"
                              value={item.exampleMeaning}
                              onChange={(e) => handleUpdateItemValue(item.id, 'exampleMeaning', e.target.value)}
                              placeholder="Dịch nghĩa tiếng Việt..."
                              className="w-full p-2 bg-gray-50 border border-gray-100 focus:bg-white rounded-xl outline-none text-xs text-gray-500"
                            />
                          </td>
                          <td className="p-3">
                            <div className="flex flex-col gap-2">
                              <span className={`inline-flex items-center justify-center px-2 py-1 rounded-lg border text-[10px] font-black ${
                                item.audioStatus === 'ready' || item.audioUrl
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : item.audioStatus === 'failed'
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : item.audioStatus === 'generating' || item.audioStatus === 'queued'
                                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                                      : 'bg-gray-50 text-gray-500 border-gray-200'
                              }`}>
                                {item.audioStatus === 'ready' || item.audioUrl
                                  ? 'Đã có'
                                  : item.audioStatus === 'failed'
                                    ? 'Lỗi'
                                    : item.audioStatus === 'generating'
                                      ? 'Đang tạo'
                                      : item.audioStatus === 'queued'
                                        ? 'Đang chờ'
                                        : 'Chưa tạo'}
                              </span>
                              {item.audioError && (
                                <span className="text-[10px] text-rose-500 font-semibold line-clamp-2" title={item.audioError}>
                                  {item.audioError}
                                </span>
                              )}
                              {item.ttsText && item.ttsText !== item.term.trim() && (
                                <span className="text-[10px] text-slate-500 font-semibold line-clamp-2" title={`TTS text: ${item.ttsText}`}>
                                  TTS: {item.ttsText}
                                </span>
                              )}
                              {Array.isArray(item.audioWarnings) && item.audioWarnings.length > 0 && (
                                <span className="text-[10px] text-amber-700 font-semibold line-clamp-2" title={item.audioWarnings.join(' ')}>
                                  {item.audioWarnings[0]}
                                </span>
                              )}
                              <div className="flex flex-wrap items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handlePlayItemAudio(item)}
                                  disabled={!item.term.trim()}
                                  className="p-2 rounded-lg border border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-40"
                                  title="Nghe thử audio"
                                >
                                  <Volume2 size={13} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleGenerateItemAudioBeforeSave(item.id, false)}
                                  disabled={
                                    !item.term.trim() ||
                                    item.audioStatus === 'generating' ||
                                    item.audioStatus === 'queued' ||
                                    Boolean(item.audioUrl || item.audioHash || item.audioStatus === 'ready')
                                  }
                                  className="inline-flex items-center gap-1 px-2 py-2 rounded-lg border border-emerald-100 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-40"
                                  title="Tao audio moi cho dong nay"
                                >
                                  <Play size={13} />
                                  <span className="text-[10px] font-black">Tao</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleGenerateItemAudioBeforeSave(item.id, true)}
                                  disabled={
                                    !item.term.trim() ||
                                    item.audioStatus === 'generating' ||
                                    item.audioStatus === 'queued' ||
                                    (!item.audioUrl && !item.audioHash && item.audioStatus !== 'failed')
                                  }
                                  className="inline-flex items-center gap-1 px-2 py-2 rounded-lg border border-indigo-100 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-40"
                                  title="Tạo hoặc tạo lại audio cho dòng này"
                                >
                                  <RefreshCw size={13} />
                                  <span className="text-[10px] font-black">Tao lai</span>
                                </button>
                              </div>
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => handleDeleteItemRow(item.id)}
                              className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                              title="Xóa dòng"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 4: CLASSES & ENROLLMENT MANAGER */}
        {/* ==================================================================== */}
        {activeTab === 'classes' && (
          <div className="space-y-8 animate-fade-in" id="classes-tab-content">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <h2 className="text-2xl font-black text-gray-800">Quản lý Lớp học</h2>
                <p className="text-gray-400 text-sm">Quản lý danh sách các lớp học của cô và theo dõi các học sinh đăng ký.</p>
              </div>

              {/* Add New Class Form Box */}
              <form onSubmit={handleCreateClass} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Tên lớp học mới..."
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  className="p-3 bg-white border border-gray-100 hover:border-indigo-300 rounded-2xl outline-none font-bold text-sm focus:ring-4 focus:ring-indigo-50 transition-all text-gray-800 min-w-[200px]"
                />
                <button
                  type="submit"
                  disabled={!newClassName.trim()}
                  className="py-3 px-6 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-extrabold rounded-2xl text-sm shadow-md transition-all whitespace-nowrap cursor-pointer"
                  id="create-class-btn"
                >
                  Tạo lớp
                </button>
              </form>
            </div>

            {/* Grid list of classes */}
            {classes.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-3xl border border-gray-100 shadow-sm text-gray-400">
                Cô chưa tạo lớp học nào. Hãy nhập tên lớp để khởi tạo ở trên nhé!
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="classes-grid">
                {classes.map((cls) => {
                  const enrolledMembers = classMembers.filter(m => m.classId === cls.id);
                  return (
                    <div key={cls.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-4" id={`class-card-${cls.id}`}>
                      <div className="flex justify-between items-start pb-2 border-b border-gray-50">
                        <div>
                          <h3 className="font-extrabold text-gray-800 text-lg">{cls.name}</h3>
                          <span className="text-xs text-gray-400">Mã tham gia lớp: <strong className="font-mono text-indigo-600 font-black text-sm bg-indigo-50 px-2 py-0.5 rounded">{cls.code}</strong></span>
                        </div>
                        <div className="flex items-center space-x-1.5">
                          <button
                            onClick={() => handleDeleteClass(cls.id, cls.name)}
                            className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all cursor-pointer border border-transparent hover:border-rose-500/20"
                            title="Xóa lớp học"
                          >
                            <Trash2 size={16} />
                          </button>
                          <span className="p-2.5 bg-indigo-50 text-indigo-700 rounded-2xl shadow-xs shrink-0">
                            <Users size={20} />
                          </span>
                        </div>
                      </div>

                      {/* Simple list of student members inside class */}
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <p className="text-xs font-black uppercase text-gray-400 tracking-wider">Học sinh đăng ký trong lớp ({enrolledMembers.length}):</p>
                        </div>
                        
                        <div className="bg-gray-50/50 rounded-2xl p-4 max-h-[160px] overflow-y-auto space-y-2 border border-gray-100">
                          {enrolledMembers.length === 0 ? (
                            <p className="text-xs text-gray-400 italic">Chưa có học sinh nào được thêm vào lớp này.</p>
                          ) : (
                            enrolledMembers.map((member, idx) => (
                              <div key={member.id} className="flex items-center justify-between text-sm text-gray-700 font-semibold bg-white p-2 rounded-xl border border-gray-100">
                                <div className="flex items-center space-x-2">
                                  <span className="w-5 h-5 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">{idx + 1}</span>
                                  <span className="text-gray-800">{member.studentName}</span>
                                </div>
                                <button
                                  onClick={() => handleDeleteClassMember(cls.id, member.id, member.studentName)}
                                  className="p-1 text-gray-400 hover:text-rose-500 hover:bg-rose-500/10 rounded transition-all cursor-pointer"
                                  title="Xóa học sinh khỏi lớp"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Add student inline form */}
                      <form onSubmit={(e) => handleAddClassMember(cls.id, e)} className="flex gap-2 pt-3 border-t border-white/5">
                        <input
                          type="text"
                          placeholder="Họ và tên học sinh..."
                          value={newMemberNames[cls.id] || ''}
                          onChange={(e) => setNewMemberNames(prev => ({ ...prev, [cls.id]: e.target.value }))}
                          className="flex-1 p-2 bg-white border border-gray-200 rounded-xl outline-none text-xs font-bold text-gray-900 placeholder-gray-400 focus:border-blue-500"
                        />
                        <button
                          type="submit"
                          disabled={!(newMemberNames[cls.id] || '').trim()}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:hover:translate-y-0 text-white text-xs font-extrabold rounded-xl transition-all cursor-pointer whitespace-nowrap shadow-sm"
                        >
                          Thêm học sinh
                        </button>
                      </form>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 5: HOMEWORK ASSIGNMENTS MANAGER */}
        {/* ==================================================================== */}
        {activeTab === 'assignments' && (
          <div className="space-y-8 animate-fade-in" id="assignments-tab-content">
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Column 1: New Assignment form scheduler */}
              <div className="lg:col-span-1 bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-5" id="assignment-creation-box">
                <div className="flex items-center space-x-2 pb-3 border-b border-gray-50">
                  <Send className="text-indigo-600" size={18} />
                  <h3 className="font-extrabold text-gray-800 text-base">Giao bài tập mới</h3>
                </div>

                <form onSubmit={handleCreateAssignment} className="space-y-4">
                  
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400">Chọn lớp học *</label>
                    <select
                      value={assignClassId}
                      onChange={(e) => setAssignClassId(e.target.value)}
                      className="w-full p-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold text-gray-600 text-sm focus:bg-white"
                      required
                    >
                      <option value="">-- Chọn lớp học --</option>
                      {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400">Loại nội dung *</label>
                    <select
                      value={assignResourceType}
                      onChange={(e) => {
                        setAssignResourceType(e.target.value as 'vocabulary' | 'listening');
                        setAssignSetId('');
                      }}
                      className="w-full p-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold text-gray-600 text-sm focus:bg-white"
                    >
                      <option value="vocabulary">Từ vựng</option>
                      <option value="listening">Bộ đề nghe 5 Part</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400">
                      {assignResourceType === 'listening' ? 'Chọn bộ đề nghe *' : 'Chọn bộ từ vựng *'}
                    </label>
                    <select
                      value={assignSetId}
                      onChange={(e) => setAssignSetId(e.target.value)}
                      className="w-full p-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold text-gray-600 text-sm focus:bg-white"
                      required
                    >
                      <option value="">-- Chọn nội dung --</option>
                      {assignResourceType === 'listening'
                        ? listeningSets.filter(s => s.status === 'published' && s.visibility !== 'draft').map(s => <option key={s.id} value={s.id}>{s.title}</option>)
                        : vocabSets.filter(s => getSetVisibility(s) !== 'draft').map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                    </select>
                  </div>

                  {assignResourceType === 'vocabulary' && <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400">Thể loại game yêu cầu *</label>
                    <select
                      value={assignGameId}
                      onChange={(e) => setAssignGameId(e.target.value)}
                      className="w-full p-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold text-gray-600 text-sm focus:bg-white"
                      required
                    >
                      {GAMES_LIST.filter(g => !g.hidden).map(g => <option key={g.gameId} value={g.gameId}>{g.title} ({g.category})</option>)}
                    </select>
                  </div>}

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400">Hạn nộp bài tập *</label>
                    <input
                      type="date"
                      value={assignDueDate}
                      onChange={(e) => setAssignDueDate(e.target.value)}
                      className="w-full p-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-bold text-gray-600 text-sm focus:bg-white"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400">Tiêu đề giao bài tập (Tùy chọn)</label>
                    <input
                      type="text"
                      placeholder="Ví dụ: Luyện flashcard trước buổi học"
                      value={assignTitle}
                      onChange={(e) => setAssignTitle(e.target.value)}
                      className="w-full p-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none font-semibold text-gray-600 text-sm focus:bg-white"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl transition-all shadow-md active:scale-95 cursor-pointer mt-4 text-sm"
                    id="schedule-assignment-btn"
                  >
                    Xác nhận giao bài
                  </button>

                </form>
              </div>

              {/* Column 2: Scheduled Assignments grid list */}
              <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4" id="assignments-scheduled-grid">
                <div className="pb-3 border-b border-gray-50">
                  <h3 className="font-extrabold text-gray-800 text-base">Bài tập đã giao ({assignments.length})</h3>
                </div>

                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
                  {assignments.length === 0 ? (
                    <div className="text-center py-16 text-gray-400 text-sm font-medium">Cô chưa giao bài tập nào cho học sinh.</div>
                  ) : (
                    assignments.map((assign) => {
                      const assignmentLink = getAssignmentRecordLink(assign);
                      return (
                      <div key={assign.id} className="p-4 bg-gray-50/50 border border-gray-100 rounded-3xl flex justify-between items-center" id={`assignment-strip-${assign.id}`}>
                        <div className="space-y-1">
                          <h4 className="font-extrabold text-gray-800 text-base leading-tight">{assign.title}</h4>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 font-semibold">
                            <span className="text-indigo-600">{assign.className}</span>
                            <span>•</span>
                            <span className="font-mono">{assign.resourceTitle || assign.listeningSetTitle || assign.vocabSetTitle}</span>
                            <span>•</span>
                            <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase uppercase">
                              {assign.resourceType === 'listening'
                                ? 'Nghe 5 Part'
                                : GAMES_LIST.find(g => g.gameId === assign.gameId)?.title || assign.gameId}
                            </span>
                          </div>
                          <div className="flex items-center space-x-1.5 text-[10px] text-gray-400 font-semibold pt-1">
                            <Calendar size={12} />
                            <span>Hạn nộp: {assign.dueDate}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 pt-2">
                          <input
                            value={assignmentLink}
                            readOnly
                            className="min-w-0 max-w-[340px] bg-white border border-indigo-100 rounded-xl px-3 py-2 text-[11px] font-semibold text-gray-600"
                          />
                          <button
                            onClick={() => {
                              navigator.clipboard?.writeText(assignmentLink);
                              showNotification("Da copy link bai giao.");
                            }}
                            className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl transition-all cursor-pointer border border-indigo-100"
                            title="Copy link bai giao"
                          >
                            <Copy size={14} />
                          </button>
                        </div>

                        <div className="flex space-x-1 shrink-0">
                          <button
                            onClick={() => {
                              if (assign.resourceType === 'listening') {
                                if (assignmentLink) window.open(assignmentLink, '_blank', 'noopener,noreferrer');
                                return;
                              }
                              const foundSet = vocabSets.find(s => s.id === assign.vocabSetId);
                              if (foundSet) {
                                onViewAsStudent({
                                  ...foundSet,
                                  assignmentId: assign.id,
                                  assignmentGameId: assign.gameId,
                                  classId: assign.classId,
                                  className: assign.className,
                                  assignmentTitle: assign.title
                                }, assign.gameId, assign.id);
                              }
                            }}
                            className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl transition-all cursor-pointer"
                            title="Học thử game này"
                          >
                            <Play size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteAssignment(assign.id)}
                            className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition-all cursor-pointer"
                            title="Thu hồi bài tập"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      );
                    })
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 6: STUDENT GOLDEN BOARD */}
        {/* ==================================================================== */}
        {activeTab === 'results' && (
          <div className="space-y-6 animate-fade-in" id="results-tab-content">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-gray-900">Bảng Vàng / Vinh danh học sinh chăm học</h2>
                <p className="text-gray-500 text-sm">
                  Xếp hạng dựa trên kết quả tốt nhất của từng học sinh theo mỗi bộ từ vựng và mỗi chế độ chơi, tránh cộng điểm không công bằng khi chơi lặp lại.
                </p>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                <select
                  value={leaderboardPeriod}
                  onChange={(e) => setLeaderboardPeriod(e.target.value as LeaderboardPeriod)}
                  className="p-3 bg-white border border-gray-200 rounded-2xl outline-none text-xs font-bold text-gray-900 focus:border-blue-500"
                >
                  <option value="week">Tuần này</option>
                  <option value="month">Tháng này</option>
                </select>
                <select
                  value={leaderboardCategory}
                  onChange={(e) => setLeaderboardCategory(e.target.value as LeaderboardCategory)}
                  className="p-3 bg-white border border-gray-200 rounded-2xl outline-none text-xs font-bold text-gray-900 focus:border-blue-500"
                >
                  <option value="gold">Bảng vàng tuần này</option>
                  <option value="diligent">Chăm chỉ nhất</option>
                  <option value="accurate">Chính xác nhất</option>
                  <option value="improved">Tiến bộ nhất</option>
                </select>
                <select
                  value={leaderboardClassId}
                  onChange={(e) => setLeaderboardClassId(e.target.value)}
                  className="p-3 bg-white border border-gray-200 rounded-2xl outline-none text-xs font-bold text-gray-900 focus:border-blue-500"
                >
                  <option value="">Tất cả lớp</option>
                  {leaderboardClassOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
                </select>
                <select
                  value={leaderboardVocabSetId}
                  onChange={(e) => setLeaderboardVocabSetId(e.target.value)}
                  className="p-3 bg-white border border-gray-200 rounded-2xl outline-none text-xs font-bold text-gray-900 focus:border-blue-500"
                >
                  <option value="">Tất cả bộ từ</option>
                  {leaderboardSetOptions.map(option => <option key={option.id} value={option.id}>{option.title}</option>)}
                </select>
              </div>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm space-y-4" id="activity-results-sheet">
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-4 border-b border-gray-100">
                <div>
                  <h3 className="font-extrabold text-gray-950 text-base">Hoạt động luyện tập trong 7 ngày</h3>
                  <p className="text-xs font-semibold text-gray-500">
                    Hiển thị {filteredActivityResults.length}/{completedActivityResults.length} lượt hoàn thành, mới nhất ở trên cùng.
                  </p>
                </div>
                <div className="relative w-full lg:max-w-sm">
                  <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={activitySearch}
                    onChange={(e) => setActivitySearch(e.target.value)}
                    placeholder="Tìm theo tên học sinh..."
                    className="w-full rounded-2xl border border-gray-200 bg-gray-50 py-3 pl-11 pr-4 text-sm font-bold text-gray-800 placeholder:text-gray-400 outline-none transition-all focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-50"
                  />
                </div>
              </div>

              <div className="space-y-3 max-h-[520px] overflow-y-auto pr-2">
                {filteredActivityResults.length === 0 ? (
                  <div className="text-center py-10 text-gray-400 text-sm font-semibold">
                    Không có lượt luyện tập nào khớp với tìm kiếm.
                  </div>
                ) : (
                  filteredActivityResults.map((res) => (
                    <button
                      key={res.id}
                      onClick={() => setSelectedActivity(res)}
                      className="w-full p-4 bg-gray-50/60 hover:bg-blue-50 border border-gray-100 hover:border-blue-200 rounded-2xl flex flex-col sm:flex-row sm:items-start justify-between gap-3 text-left transition-all"
                    >
                      <div className="space-y-1 min-w-0">
                        <strong className="text-sm font-black text-gray-900">{res.studentName}</strong>
                        <p className="text-xs font-semibold text-gray-600">
                          {res.gameName || GAMES_LIST.find(g => g.gameId === res.gameId)?.title || res.gameId}
                        </p>
                        <p className="text-[10px] text-gray-400 font-mono truncate">{res.vocabSetTitle}</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-1 text-[10px] font-semibold text-gray-500">
                          <span>Bắt đầu: {formatVietnamDateTime(res.startedAt)}</span>
                          <span>Kết thúc: {formatVietnamDateTime(getSessionEndTime(res))}</span>
                          <span>Thời lượng: {formatDuration(res.durationSeconds || Math.round((res.durationMs || 0) / 1000))}</span>
                          <span>Trạng thái: Hoàn thành</span>
                        </div>
                      </div>
                      <div className="sm:text-right shrink-0">
                        <span className={`inline-flex px-3 py-1 text-xs font-black rounded-full ${
                          res.score >= 80 ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700'
                        }`}>
                          {res.score} điểm
                        </span>
                        <span className="text-[10px] text-gray-500 font-bold block mt-1">
                          Đúng: {res.correctAnswers}/{res.totalQuestions}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {leaderboardRows.slice(0, 3).map((entry, index) => (
                <div key={entry.studentKey || entry.studentName} className={`rounded-3xl p-5 border shadow-sm overflow-hidden relative ${
                  index === 0 ? 'bg-amber-50 border-amber-200' :
                  index === 1 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'
                }`}>
                  <div className="flex items-start justify-between">
                    <span className="text-4xl">{index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}</span>
                    <span className="text-xs font-black bg-white border border-gray-200 px-3 py-1 rounded-full text-blue-700">{entry.honorScore} điểm</span>
                  </div>
                  <h3 className="mt-4 text-lg font-black text-gray-950 truncate">{formatLeaderboardDisplayName(entry)}</h3>
                  <p className="text-xs font-bold text-gray-600 mt-1">{entry.completedLessons} bài • {entry.averageAccuracy}% đúng • {entry.studyDays} ngày học</p>
                  <p className="mt-3 text-[11px] font-black text-blue-700 bg-white border border-blue-100 rounded-xl px-3 py-2 inline-block">{entry.badges[0]}</p>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm overflow-hidden" id="leaderboard-sheet">
              <div className="flex items-center justify-between pb-4 border-b border-gray-200">
                <h3 className="font-extrabold text-gray-950 text-base">{leaderboardTitleMap[leaderboardCategory]} ({leaderboardRows.length})</h3>
                <p className="text-[10px] text-gray-500 font-bold uppercase">Điểm = Bài x50 + Tỷ lệ đúng x3 + Ngày học x20 + Tiến bộ</p>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-gray-200 mt-4">
                <table className="w-full text-left border-collapse" id="leaderboard-table">
                  <thead>
                    <tr className="bg-gray-50 text-[10px] font-black uppercase text-gray-600 border-b border-gray-200">
                      <th className="p-4">STT</th>
                      <th className="p-4">Học sinh</th>
                      <th className="p-4 text-center">Bài hoàn thành</th>
                      <th className="p-4 text-center">Câu đúng</th>
                      <th className="p-4 text-center">Câu sai</th>
                      <th className="p-4 text-center">Tỷ lệ đúng</th>
                      <th className="p-4 text-center">Số ngày học</th>
                      <th className="p-4 text-center">Điểm vinh danh</th>
                      <th className="p-4">Huy hiệu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {leaderboardRows.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-12 text-center text-gray-500 text-sm font-medium">
                          Chưa có dữ liệu phù hợp để lập bảng vinh danh.
                        </td>
                      </tr>
                    ) : (
                      leaderboardRows.map((entry, index) => (
                        <tr key={`${entry.studentKey || entry.studentName}-${index}`} className="hover:bg-blue-50/50 text-sm font-semibold text-gray-800">
                          <td className="p-4 text-gray-500 text-xs font-bold">{index + 1}</td>
                          <td className="p-4">
                            <div className="flex items-center space-x-2">
                              <span className="w-8 h-8 rounded-full bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center font-bold text-xs">
                                {entry.studentName.charAt(0).toUpperCase()}
                              </span>
                              <div>
                                <strong className="text-gray-950 font-bold">{formatLeaderboardDisplayName(entry)}</strong>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-center">{entry.completedLessons}</td>
                          <td className="p-4 text-center text-emerald-700 font-bold">{entry.correctAnswers}</td>
                          <td className="p-4 text-center text-rose-700 font-bold">{entry.incorrectAnswers}</td>
                          <td className="p-4 text-center font-black text-blue-700">{entry.averageAccuracy}%</td>
                          <td className="p-4 text-center">{entry.studyDays}</td>
                          <td className="p-4 text-center">
                            <span className="px-3 py-1.5 rounded-full text-xs font-black bg-blue-50 text-blue-700 border border-blue-100">{entry.honorScore}</span>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-wrap gap-1">
                              {entry.badges.map(badge => (
                                <span key={badge} className="text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-100 px-2 py-1 rounded-full">
                                  {badge}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 7: ACCOUNT / STUDENT PROFILE MANAGEMENT */}
        {/* ==================================================================== */}
        {activeTab === 'users' && (user?.role === 'teacher' || user?.role === 'super_admin') && (
          <div className="space-y-6 animate-fade-in" id="users-tab-content">
            <div>
              <h2 className="text-2xl font-black text-gray-800">
                {user?.role === 'super_admin' ? 'Quản lý Tài khoản người dùng' : 'Quản lý Học sinh'}
              </h2>
              <p className="text-gray-400 text-sm">
                {user?.role === 'super_admin'
                  ? 'Quản lý chung tài khoản đăng ký và hồ sơ học sinh khách. Hồ sơ khách luôn có vai trò Học sinh.'
                  : 'Đổi tên hiển thị cho học sinh có hoạt động trong các lớp bạn quản lý.'}
              </p>
            </div>

            {/* Filters Row */}
            <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-3 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="Tìm theo tên, liên hệ hoặc ID..."
                  value={usersSearch}
                  onChange={(e) => setUsersSearch(e.target.value)}
                  className="w-full bg-gray-50 border-0 rounded-2xl py-2.5 pl-11 pr-4 text-sm font-semibold text-gray-700 placeholder-gray-400 focus:bg-white focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                />
              </div>

              <div className="flex gap-2">
                <div className="flex items-center space-x-2 bg-gray-50 rounded-2xl px-3 border border-gray-50">
                  <Filter size={16} className="text-gray-400" />
                  <select
                    value={usersRoleFilter}
                    onChange={(e) => setUsersRoleFilter(e.target.value)}
                    className="bg-transparent border-0 text-xs font-bold text-gray-500 focus:ring-0 outline-none cursor-pointer py-2 pr-8"
                  >
                    <option value="">Tất cả vai trò</option>
                    <option value="super_admin">Super Admin</option>
                    <option value="teacher">Giáo viên (Teacher)</option>
                    <option value="student">Học sinh (Student)</option>
                  </select>
                </div>

                <div className="flex items-center space-x-2 bg-gray-50 rounded-2xl px-3 border border-gray-50">
                  <Filter size={16} className="text-gray-400" />
                  <select
                    value={usersStatusFilter}
                    onChange={(e) => setUsersStatusFilter(e.target.value)}
                    className="bg-transparent border-0 text-xs font-bold text-gray-500 focus:ring-0 outline-none cursor-pointer py-2 pr-8"
                  >
                    <option value="">Tất cả trạng thái</option>
                    <option value="active">Đang hoạt động</option>
                    <option value="blocked">Đã khóa</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto rounded-2xl border border-gray-100">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/50 text-[10px] font-black uppercase text-gray-400 border-b border-gray-100">
                      <th className="p-4">STT</th>
                      <th className="p-4">Tên hiển thị</th>
                      <th className="p-4">Loại hồ sơ</th>
                      <th className="p-4">Liên hệ (Email / SĐT)</th>
                      <th className="p-4">ID tài khoản</th>
                      <th className="p-4 text-center">Vai trò</th>
                      <th className="p-4 text-center">Trạng thái</th>
                      <th className="p-4">Hoạt động cuối</th>
                      <th className="p-4 text-center">Hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-12 text-center text-gray-400 text-sm font-medium">
                          Không tìm thấy tài khoản người dùng nào khớp với bộ lọc.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u, index) => (
                        <tr key={u.id} className="hover:bg-gray-50/30 text-sm font-semibold text-gray-700">
                          <td className="p-4 text-gray-400 text-xs font-bold">{index + 1}</td>
                          <td className="p-4">
                            <div className="flex items-center space-x-2">
                              <span className="w-8 h-8 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-xs">
                                {(u.name || 'U').charAt(0).toUpperCase()}
                              </span>
                              <strong className="text-gray-800 font-bold">{u.name || 'Chưa đặt tên'}</strong>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${u.accountType === 'guest' ? 'bg-sky-50 text-sky-700' : 'bg-indigo-50 text-indigo-700'}`}>
                              {u.accountType === 'guest' ? 'Học sinh khách' : 'Đã đăng ký'}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="flex flex-col">
                              <span className="text-xs text-gray-600 font-medium">{u.email || (u.accountType === 'guest' ? 'Không yêu cầu liên hệ' : 'Không có email')}</span>
                              {u.phone && <span className="text-[10px] text-gray-400 font-bold">{u.phone}</span>}
                            </div>
                          </td>
                          <td className="p-4 text-xs font-mono text-gray-400 max-w-[120px] truncate" title={u.id}>
                            {u.id}
                          </td>
                          <td className="p-4 text-center">
                            {u.accountType === 'guest' ? (
                              <span className="text-xs font-bold text-gray-600">Học sinh</span>
                            ) : (
                              <select
                                value={u.role}
                                disabled={u.id === user?.id}
                                onChange={(e) => handleUpdateUserRole(u.id, e.target.value)}
                                className="bg-gray-50 text-xs font-bold text-gray-700 border-0 rounded-xl py-1.5 px-3 focus:ring-2 focus:ring-indigo-100 outline-none cursor-pointer"
                              >
                                <option value="student">Học sinh (Student)</option>
                                <option value="teacher">Giáo viên (Teacher)</option>
                                <option value="super_admin">Super Admin</option>
                              </select>
                            )}
                          </td>
                          <td className="p-4 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                              u.status === 'blocked' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                            }`}>
                              {u.status === 'blocked' ? 'Đã khóa' : 'Hoạt động'}
                            </span>
                          </td>
                          <td className="p-4 text-xs text-gray-500 whitespace-nowrap">
                            {u.lastActiveAt ? new Date(u.lastActiveAt).toLocaleString('vi-VN') : 'Chưa ghi nhận'}
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => { setEditingAccount(u); setEditingAccountName(u.name || ''); }}
                                className="rounded-xl border border-indigo-100 bg-indigo-50 p-2 text-indigo-600 hover:bg-indigo-100"
                                title="Sửa tên hiển thị"
                              >
                                <Edit3 size={14} />
                              </button>
                            {user?.role === 'super_admin' && u.id !== user?.id ? (
                              <button
                                onClick={() => handleToggleAccountStatus(u)}
                                className={`p-2 rounded-xl border transition-all cursor-pointer ${
                                  u.status === 'blocked'
                                    ? 'bg-emerald-50 border-emerald-100 text-emerald-600 hover:bg-emerald-100'
                                    : 'bg-rose-50 border-rose-100 text-rose-600 hover:bg-rose-100'
                                }`}
                                title={u.status === 'blocked' ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}
                              >
                                {u.status === 'blocked' ? <Unlock size={14} /> : <Lock size={14} />}
                              </button>
                            ) : user?.role === 'super_admin' ? (
                              <span className="text-xs text-gray-400 italic">Bản thân</span>
                            ) : null}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================================== */}
        {/* TAB 8: AUDIT LOGS VIEW */}
        {/* ==================================================================== */}
        {activeTab === 'audit-logs' && user?.role === 'super_admin' && (
          <div className="space-y-6 animate-fade-in" id="audit-logs-tab-content">
            <div>
              <h2 className="text-2xl font-black text-gray-800">Nhật ký hệ thống (Audit Logs)</h2>
              <p className="text-gray-400 text-sm">Ghi chép các sự kiện quan trọng trong hệ thống: đăng ký mới, cập nhật vai trò, khóa/mở khóa tài khoản.</p>
            </div>

            {/* Logs Timeline Card */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto rounded-2xl border border-gray-100">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/50 text-[10px] font-black uppercase text-gray-400 border-b border-gray-100">
                      <th className="p-4 w-16">STT</th>
                      <th className="p-4 w-48">Thời gian</th>
                      <th className="p-4 w-40">Hành động</th>
                      <th className="p-4 w-52">Người thực hiện</th>
                      <th className="p-4">Chi tiết hành động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {auditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-12 text-center text-gray-400 text-sm font-medium">
                          Chưa có nhật ký hoạt động nào được ghi nhận.
                        </td>
                      </tr>
                    ) : (
                      auditLogs.map((log, index) => {
                        const dateFormatted = log.timestamp
                          ? new Date(log.timestamp).toLocaleString('vi-VN', { timeZone: 'UTC', hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })
                          : 'Unknown';
                        
                        let actionBadgeColor = 'bg-gray-50 text-gray-600';
                        if (log.action === 'LOCK_USER') actionBadgeColor = 'bg-rose-50 text-rose-700';
                        if (log.action === 'UNLOCK_USER') actionBadgeColor = 'bg-emerald-50 text-emerald-700';
                        if (log.action === 'UPDATE_USER_ROLE') actionBadgeColor = 'bg-amber-50 text-amber-700';
                        if (log.action === 'REGISTER_USER') actionBadgeColor = 'bg-indigo-50 text-indigo-700';

                        return (
                          <tr key={log.id} className="hover:bg-gray-50/30 text-xs font-semibold text-gray-700">
                            <td className="p-4 text-gray-400 font-bold">{index + 1}</td>
                            <td className="p-4 text-gray-500 font-normal">{dateFormatted}</td>
                            <td className="p-4">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${actionBadgeColor}`}>
                                {log.action}
                              </span>
                            </td>
                            <td className="p-4">
                              <div className="flex flex-col">
                                <span className="text-gray-800 font-bold">{log.userName || 'Hệ thống'}</span>
                                <span className="text-[10px] text-gray-400">{log.userEmail || ''}</span>
                              </div>
                            </td>
                            <td className="p-4 text-gray-600 font-normal font-mono max-w-[300px] truncate" title={log.details}>
                              {log.details}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </main>

    </div>
  );
}


