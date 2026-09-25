import React, { useState, useEffect } from 'react';
import { AlertCircle, Check, X } from 'lucide-react';
import { VocabSet, VocabItem, VocabImageGenerationProviderId, Class, ClassMember, Assignment, GameSession, TtsSettings, GrammarSet, GrammarQuestion, GrammarQuestionType } from '../../types';
import { GAMES_LIST } from '../../lib/game-engine/gameList';
import { playAudioUrl, playVocabAudio, resolveTtsPlaybackRate, speakEnglish } from '../../lib/game-engine/speech';
import { useAuth } from '../../context/AuthContext';
import { STUDENT_NAME_MAX_LENGTH, validateStudentDisplayName } from '../../lib/studentIdentity';
import { type LeaderboardEntry, LeaderboardCategory, LeaderboardPeriod } from '../../lib/leaderboard';
import {
  formatListeningReviewAnswer,
  formatListeningReviewQuestion,
} from '../../features/listening/reviewPresentation';
import { examPaperExamPath, writingExamPath } from '../../features/listening-library/routes';
import {
  buildMultipleChoiceGrammarBulkImportPrompt,
  buildRewriteGrammarBulkImportPrompt,
  buildVocabularyBulkImportPrompt,
} from '../../lib/adminBulkImportPrompts';
import {
  VocabImageGenerateDialog,
  type BatchImageGenerationResult,
  type ManagedVocabImageAsset,
  type VocabImageBatchProvider,
  type VocabImageBatchJob,
  type VocabImageGenerationResult,
  type VocabImageProviderOption,
} from './vocab-images';
import AdminShell, { type AdminTab } from './AdminShell';
import VocabularyLibraryPanel from './vocabulary/VocabularyLibraryPanel';
import VocabularyResultsPanel from './vocabulary/VocabularyResultsPanel';
import VocabularyEditorPanel from './vocabulary/VocabularyEditorPanel';
import ClassManagementPanel from './classes/ClassManagementPanel';
import AssignmentManagementPanel from './assignments/AssignmentManagementPanel';
import AccountManagementPanel from './accounts/AccountManagementPanel';
import AuditLogPanel from './audit/AuditLogPanel';
import AdminResultsPanel from './results/AdminResultsPanel';
import DashboardOverviewPanel from './dashboard/DashboardOverviewPanel';
import GrammarLibraryPanel from './grammar/GrammarLibraryPanel';
import GrammarEditorPanel from './grammar/GrammarEditorPanel';

const ListeningLibraryAdmin = React.lazy(() => import('../../features/listening-library/admin/ListeningLibraryAdmin'));
const WritingLibraryAdmin = React.lazy(() => import('../../features/writing-library/admin/WritingLibraryAdmin'));

interface AdminDashboardProps {
  onViewAsStudent: (set: VocabSet, gameId?: string, assignmentId?: string) => void;
  onViewGrammarAsStudent?: (set: GrammarSet) => void;
}

type VocabVisibility = 'public' | 'assignment' | 'draft';
type CopiedBulkPrompt = 'vocabulary' | 'grammar-multiple-choice' | 'grammar-rewrite' | null;

interface AdminPageResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  facets?: { grades?: string[] };
}

interface AdminDashboardSummary {
  counts: {
    vocabSets: number;
    grammarSets: number;
    classes: number;
    assignments: number;
    activities: number;
    honoredStudents: number;
  };
  recentActivities: GameSession[];
  goldRows: any[];
}

interface AdminLeaderboardSummary {
  entries: LeaderboardEntry[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  classes: Array<{ id: string; name: string }>;
  vocabSets: Array<{ id: string; title: string }>;
}

const EMPTY_DASHBOARD_SUMMARY: AdminDashboardSummary = {
  counts: { vocabSets: 0, grammarSets: 0, classes: 0, assignments: 0, activities: 0, honoredStudents: 0 },
  recentActivities: [],
  goldRows: []
};

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
      ? `${window.location.origin}${examPaperExamPath('mover', 'listening', setId, token)}`
      : '';
  }
  if (assignment.resourceType === 'mover_reading_writing') {
    const setId = assignment.resourceId || assignment.moverReadingWritingSetId;
    return setId
      ? `${window.location.origin}${examPaperExamPath('mover', 'reading-writing', setId, token)}`
      : '';
  }
  if (assignment.resourceType === 'exam') {
    const setId = assignment.resourceId || assignment.examSetId;
    return setId && assignment.examModuleId && assignment.examPaperId
      ? `${window.location.origin}${assignment.examModuleId === 'writing' ? writingExamPath(setId, token) : examPaperExamPath(assignment.examModuleId, assignment.examPaperId, setId, token)}`
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

async function copyAdminPromptToClipboard(value: string): Promise<'copied' | 'manual'> {
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
    await navigator.clipboard.writeText(value);
    return 'copied';
  } catch {
    const fallback = document.createElement('textarea');
    fallback.value = value;
    fallback.readOnly = true;
    fallback.style.position = 'fixed';
    fallback.style.left = '-9999px';
    document.body.appendChild(fallback);
    let copied = false;
    try {
      fallback.select();
      copied = document.execCommand('copy');
    } finally {
      fallback.remove();
    }
    if (copied) return 'copied';
    window.prompt('Nhấn Ctrl+C để sao chép prompt:', value);
    return 'manual';
  }
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
    .replace(/LÃ¡Â»â€ºp/g, 'Lớp')
    .replace(/^L\?p(?=\s|$)/i, 'Lớp');
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
  const [moverReadingWritingSets, setMoverReadingWritingSets] = useState<any[]>([]);
  const [examSets, setExamSets] = useState<any[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [classMembers, setClassMembers] = useState<ClassMember[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [results, setResults] = useState<GameSession[]>([]);
  const [leaderboardResults, setLeaderboardResults] = useState<LeaderboardEntry[]>([]);

  // Super Admin States
  const [usersList, setUsersList] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [dashboardSummary, setDashboardSummary] = useState<AdminDashboardSummary>(EMPTY_DASHBOARD_SUMMARY);
  const [vocabTotalItems, setVocabTotalItems] = useState(0);
  const [vocabServerTotalPages, setVocabServerTotalPages] = useState(1);
  const [vocabGradeFacets, setVocabGradeFacets] = useState<string[]>([]);
  const [grammarTotalItems, setGrammarTotalItems] = useState(0);
  const [grammarServerTotalPages, setGrammarServerTotalPages] = useState(1);
  const [grammarGradeFacets, setGrammarGradeFacets] = useState<string[]>([]);
  const [usersSearch, setUsersSearch] = useState('');
  const [usersRoleFilter, setUsersRoleFilter] = useState('');
  const [usersStatusFilter, setUsersStatusFilter] = useState('');
  const [debouncedUsersSearch, setDebouncedUsersSearch] = useState('');
  const [usersPage, setUsersPage] = useState(1);
  const [usersPageSize, setUsersPageSize] = useState(10);
  const [usersTotalItems, setUsersTotalItems] = useState(0);
  const [usersTotalPages, setUsersTotalPages] = useState(1);
  const [auditPage, setAuditPage] = useState(1);
  const [auditPageSize, setAuditPageSize] = useState(10);
  const [auditTotalItems, setAuditTotalItems] = useState(0);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
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
  const [classPage, setClassPage] = useState(1);
  const [classPageSize, setClassPageSize] = useState(10);
  const [classTotalItems, setClassTotalItems] = useState(0);
  const [classTotalPages, setClassTotalPages] = useState(1);
  const [assignmentPage, setAssignmentPage] = useState(1);
  const [assignmentPageSize, setAssignmentPageSize] = useState(10);
  const [assignmentTotalItems, setAssignmentTotalItems] = useState(0);
  const [assignmentTotalPages, setAssignmentTotalPages] = useState(1);
  const [debouncedVocabSearch, setDebouncedVocabSearch] = useState('');
  const [debouncedGrammarSearch, setDebouncedGrammarSearch] = useState('');
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<LeaderboardPeriod>('week');
  const [leaderboardCategory, setLeaderboardCategory] = useState<LeaderboardCategory>('gold');
  const [leaderboardClassId, setLeaderboardClassId] = useState('');
  const [leaderboardVocabSetId, setLeaderboardVocabSetId] = useState('');
  const [leaderboardClassOptions, setLeaderboardClassOptions] = useState<Array<{ id: string; name: string }>>([]);
  const [leaderboardSetOptions, setLeaderboardSetOptions] = useState<Array<{ id: string; title: string }>>([]);
  const [leaderboardPage, setLeaderboardPage] = useState(1);
  const [leaderboardTotalItems, setLeaderboardTotalItems] = useState(0);
  const [leaderboardTotalPages, setLeaderboardTotalPages] = useState(1);
  const [selectedActivity, setSelectedActivity] = useState<GameSession | null>(null);
  const [activityDetailLoading, setActivityDetailLoading] = useState(false);
  const [activityDetailError, setActivityDetailError] = useState('');
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
  const [vocabImageProviders, setVocabImageProviders] = useState<VocabImageProviderOption[]>([]);
  const [imagePickerItemId, setImagePickerItemId] = useState<string | null>(null);
  const [isBatchGeneratingImages, setIsBatchGeneratingImages] = useState(false);
  const [vocabImageBatchProgress, setVocabImageBatchProgress] = useState<{ completed: number; total: number } | null>(null);
  const [busyVocabImageItemId, setBusyVocabImageItemId] = useState<string | null>(null);

  // Quick Batch Add States
  const [batchTerms, setBatchTerms] = useState('');
  const [batchMeanings, setBatchMeanings] = useState('');
  const [batchIpas, setBatchIpas] = useState('');
  const [batchPartsOfSpeech, setBatchPartsOfSpeech] = useState('');
  const [batchExamples, setBatchExamples] = useState('');
  const [batchExampleMeanings, setBatchExampleMeanings] = useState('');
  const [batchVocabularyText, setBatchVocabularyText] = useState('');
  const [copiedBulkPrompt, setCopiedBulkPrompt] = useState<CopiedBulkPrompt>(null);

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
  const [assignResourceType, setAssignResourceType] = useState<'vocabulary' | 'listening' | 'mover_reading_writing' | 'exam'>('vocabulary');
  const [assignSetId, setAssignSetId] = useState('');
  const [assignGameId, setAssignGameId] = useState('flashcard-en-vi');
  const [assignDueDate, setAssignDueDate] = useState('');
  const [assignTitle, setAssignTitle] = useState('');

  // Notifications
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [shareLinkNotice, setShareLinkNotice] = useState<{ title: string; url: string } | null>(null);
  const refreshGenerationRef = React.useRef(0);
  const vocabRequestGenerationRef = React.useRef(0);
  const grammarRequestGenerationRef = React.useRef(0);
  const tabRequestGenerationRef = React.useRef(0);
  const activityDetailRequestRef = React.useRef(0);

  const gradeOptions = React.useMemo(() => {
    return Array.from(new Set([
      ...DEFAULT_GRADE_OPTIONS,
      ...classes.map(cls => cls.name).filter(Boolean),
      ...vocabGradeFacets,
      ...vocabSets.map(set => set.gradeLevel).filter(Boolean),
      editorGrade
    ]));
  }, [classes, vocabGradeFacets, vocabSets, editorGrade]);

  const grammarGradeOptions = React.useMemo(() => {
    return Array.from(new Set([
      ...DEFAULT_GRADE_OPTIONS,
      ...classes.map(cls => cls.name).filter(Boolean),
      ...grammarGradeFacets,
      ...grammarSets.map(set => set.gradeLevel).filter(Boolean),
      grammarGrade
    ]));
  }, [classes, grammarGradeFacets, grammarSets, grammarGrade]);

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

  const reportLoadError = (label: string, err: any, signal?: AbortSignal) => {
    if (signal?.aborted || err?.name === 'AbortError') return;
    console.error(`Error loading ${label}:`, err);
  };

  const refreshDashboard = async (signal?: AbortSignal) => {
    if (!token) return;
    const generation = ++refreshGenerationRef.current;
    try {
      const data = await authFetchJson<AdminDashboardSummary>('/api/admin/dashboard-summary', signal ? { signal } : {});
      if (signal?.aborted || generation !== refreshGenerationRef.current) return;
      setDashboardSummary(data);
      setResults(Array.isArray(data.recentActivities) ? data.recentActivities : []);
    } catch (err) {
      reportLoadError('dashboard summary', err, signal);
    }
  };

  const refreshVocabData = async (signal?: AbortSignal) => {
    if (!token) return;
    const generation = ++vocabRequestGenerationRef.current;
    const params = new URLSearchParams({ page: String(vocabPage), pageSize: String(vocabPageSize) });
    if (debouncedVocabSearch) params.set('search', debouncedVocabSearch);
    if (filterGrade) params.set('grade', filterGrade);
    if (filterStatus) params.set('status', filterStatus);
    try {
      const data = await authFetchJson<AdminPageResponse<VocabSet>>(`/api/admin/vocab-sets?${params}`, signal ? { signal } : {});
      if (signal?.aborted || generation !== vocabRequestGenerationRef.current) return;
      setVocabSets((Array.isArray(data.items) ? data.items : []).map(set => ({ ...set, items: set.items || [] })));
      setVocabTotalItems(Number(data.total || 0));
      setVocabServerTotalPages(Math.max(1, Number(data.totalPages || 1)));
      setVocabGradeFacets(Array.isArray(data.facets?.grades) ? data.facets!.grades! : []);
      if (data.page && data.page !== vocabPage) setVocabPage(data.page);
    } catch (err) {
      reportLoadError('vocabulary summaries', err, signal);
    }
  };

  const refreshGrammarData = async (signal?: AbortSignal) => {
    if (!token) return;
    const generation = ++grammarRequestGenerationRef.current;
    const params = new URLSearchParams({ page: String(grammarPage), pageSize: String(grammarPageSize) });
    if (debouncedGrammarSearch) params.set('search', debouncedGrammarSearch);
    if (grammarFilterGrade) params.set('grade', grammarFilterGrade);
    if (grammarFilterStatus) params.set('status', grammarFilterStatus);
    try {
      const data = await authFetchJson<AdminPageResponse<GrammarSet>>(`/api/admin/grammar-sets?${params}`, signal ? { signal } : {});
      if (signal?.aborted || generation !== grammarRequestGenerationRef.current) return;
      setGrammarSets((Array.isArray(data.items) ? data.items : []).map(set => ({ ...set, questions: set.questions || [] })));
      setGrammarTotalItems(Number(data.total || 0));
      setGrammarServerTotalPages(Math.max(1, Number(data.totalPages || 1)));
      setGrammarGradeFacets(Array.isArray(data.facets?.grades) ? data.facets!.grades! : []);
      if (data.page && data.page !== grammarPage) setGrammarPage(data.page);
    } catch (err) {
      reportLoadError('grammar summaries', err, signal);
    }
  };

  const refreshClassesData = async (signal?: AbortSignal) => {
    const requestOptions = signal ? { signal } : {};
    try {
      const classData = await authFetchJson<AdminPageResponse<Class>>(
        `/api/admin/classes?page=${classPage}&pageSize=${classPageSize}`,
        requestOptions
      );
      if (signal?.aborted) return;
      const pageClasses = Array.isArray(classData.items) ? classData.items : [];
      const classIds = pageClasses.map(item => item.id).filter(Boolean).join(',');
      const memberData = classIds
        ? await authFetchJson<ClassMember[]>(`/api/admin/class-members?classIds=${encodeURIComponent(classIds)}`, requestOptions)
        : [];
      if (signal?.aborted) return;
      setClasses(pageClasses);
      setClassMembers(Array.isArray(memberData) ? memberData : []);
      setClassTotalItems(Number(classData.total || 0));
      setClassTotalPages(Math.max(1, Number(classData.totalPages || 1)));
      if (classData.page && classData.page !== classPage) setClassPage(classData.page);
    } catch (err) {
      reportLoadError('classes', err, signal);
    }
  };

  const refreshAssignmentsData = async (signal?: AbortSignal) => {
    const requestOptions = signal ? { signal } : {};
    try {
      const [assignmentData, optionsData, listeningData, moverData, examData] = await Promise.all([
        authFetchJson<AdminPageResponse<Assignment>>(`/api/admin/assignments?page=${assignmentPage}&pageSize=${assignmentPageSize}`, requestOptions),
        authFetchJson<{ classes: Class[]; vocabSets: VocabSet[] }>('/api/admin/assignment-options', requestOptions),
        authFetchJson<any[]>('/api/listening/admin/sets', requestOptions),
        authFetchJson<any[]>('/api/mover-reading-writing/admin/sets', requestOptions),
        authFetchJson<any[]>('/api/exam-platform/admin/sets', requestOptions)
      ]);
      if (signal?.aborted) return;
      setAssignments(Array.isArray(assignmentData.items) ? assignmentData.items : []);
      setAssignmentTotalItems(Number(assignmentData.total || 0));
      setAssignmentTotalPages(Math.max(1, Number(assignmentData.totalPages || 1)));
      if (assignmentData.page && assignmentData.page !== assignmentPage) setAssignmentPage(assignmentData.page);
      setClasses(Array.isArray(optionsData.classes) ? optionsData.classes : []);
      setVocabSets((optionsData.vocabSets || []).map(set => ({ ...set, items: set.items || [] })));
      setListeningSets(Array.isArray(listeningData) ? listeningData : []);
      setMoverReadingWritingSets(Array.isArray(moverData) ? moverData : []);
      setExamSets(Array.isArray(examData) ? examData : []);
    } catch (err) {
      reportLoadError('assignments', err, signal);
    }
  };

  const refreshResultsData = async (signal?: AbortSignal) => {
    const requestOptions = signal ? { signal } : {};
    try {
      const resultData = await authFetchJson<GameSession[]>('/api/results?view=summary&limit=500', requestOptions);
      if (signal?.aborted) return;
      setResults(Array.isArray(resultData) ? resultData : []);
    } catch (err) {
      reportLoadError('results', err, signal);
    }
  };

  const refreshLeaderboardData = async (signal?: AbortSignal) => {
    const params = new URLSearchParams({
      period: leaderboardPeriod,
      category: leaderboardCategory,
      page: String(leaderboardPage),
      pageSize: '50',
    });
    if (leaderboardClassId) params.set('classId', leaderboardClassId);
    if (leaderboardVocabSetId) params.set('vocabSetId', leaderboardVocabSetId);
    try {
      const data = await authFetchJson<AdminLeaderboardSummary>(
        `/api/admin/leaderboard-summary?${params}`,
        signal ? { signal } : {},
      );
      if (signal?.aborted) return;
      setLeaderboardResults(Array.isArray(data.entries) ? data.entries : []);
      setLeaderboardClassOptions(Array.isArray(data.classes) ? data.classes : []);
      setLeaderboardSetOptions(Array.isArray(data.vocabSets) ? data.vocabSets : []);
      setLeaderboardTotalItems(Number(data.total || 0));
      setLeaderboardTotalPages(Math.max(1, Number(data.totalPages || 1)));
      if (data.page && data.page !== leaderboardPage) setLeaderboardPage(data.page);
    } catch (err) {
      reportLoadError('leaderboard', err, signal);
    }
  };

  const refreshAccountsData = async (signal?: AbortSignal) => {
    try {
      const params = new URLSearchParams({ page: String(usersPage), pageSize: String(usersPageSize) });
      if (debouncedUsersSearch) params.set('search', debouncedUsersSearch);
      if (usersRoleFilter) params.set('role', usersRoleFilter);
      if (usersStatusFilter) params.set('status', usersStatusFilter);
      const data = await authFetchJson<AdminPageResponse<any>>(`/api/admin/accounts-page?${params}`, signal ? { signal } : {});
      if (!signal?.aborted) {
        setUsersList(Array.isArray(data.items) ? data.items : []);
        setUsersTotalItems(Number(data.total || 0));
        setUsersTotalPages(Math.max(1, Number(data.totalPages || 1)));
        if (data.page && data.page !== usersPage) setUsersPage(data.page);
      }
    } catch (err) {
      reportLoadError('admin accounts', err, signal);
    }
  };

  const refreshAuditData = async (signal?: AbortSignal) => {
    if (user?.role !== 'super_admin') return;
    try {
      const data = await authFetchJson<AdminPageResponse<any>>(
        `/api/admin/audit-logs-page?page=${auditPage}&pageSize=${auditPageSize}`,
        signal ? { signal } : {}
      );
      if (!signal?.aborted) {
        setAuditLogs(Array.isArray(data.items) ? data.items : []);
        setAuditTotalItems(Number(data.total || 0));
        setAuditTotalPages(Math.max(1, Number(data.totalPages || 1)));
        if (data.page && data.page !== auditPage) setAuditPage(data.page);
      }
    } catch (err) {
      reportLoadError('audit logs', err, signal);
    }
  };

  // Compatibility refresh for existing mutation handlers. It refreshes only
  // the domain currently being edited, plus the compact dashboard counters.
  const refreshData = () => {
    void refreshDashboard();
    if (activeTab === 'vocab-sets' || activeTab === 'editor') void refreshVocabData();
    else if (activeTab === 'grammar-sets' || activeTab === 'grammar-editor') void refreshGrammarData();
    else if (activeTab === 'classes') void refreshClassesData();
    else if (activeTab === 'assignments') void refreshAssignmentsData();
    else if (activeTab === 'results') void refreshResultsData();
    else if (activeTab === 'users') void refreshAccountsData();
    else if (activeTab === 'audit-logs') void refreshAuditData();
  };

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedVocabSearch(searchQuery.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedGrammarSearch(grammarSearchQuery.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [grammarSearchQuery]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedUsersSearch(usersSearch.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [usersSearch]);

  useEffect(() => {
    setUsersPage(1);
  }, [debouncedUsersSearch, usersRoleFilter, usersStatusFilter, usersPageSize]);

  useEffect(() => {
    const controller = new AbortController();
    setDashboardSummary(EMPTY_DASHBOARD_SUMMARY);
    setResults([]);
    setLeaderboardResults([]);
    void refreshDashboard(controller.signal);
    return () => controller.abort();
  }, [token, user?.id, user?.role]);

  useEffect(() => {
    if (activeTab !== 'vocab-sets') return;
    const controller = new AbortController();
    void refreshVocabData(controller.signal);
    return () => controller.abort();
  }, [activeTab, token, vocabPage, vocabPageSize, debouncedVocabSearch, filterGrade, filterStatus]);

  useEffect(() => {
    if (activeTab !== 'grammar-sets') return;
    const controller = new AbortController();
    void refreshGrammarData(controller.signal);
    return () => controller.abort();
  }, [activeTab, token, grammarPage, grammarPageSize, debouncedGrammarSearch, grammarFilterGrade, grammarFilterStatus]);

  useEffect(() => {
    if (!token || ['dashboard', 'vocab-sets', 'editor', 'grammar-sets', 'grammar-editor', 'listening-library', 'writing-library'].includes(activeTab)) return;
    const generation = ++tabRequestGenerationRef.current;
    const controller = new AbortController();
    const load = activeTab === 'classes' ? refreshClassesData
      : activeTab === 'assignments' ? refreshAssignmentsData
        : activeTab === 'results' ? refreshResultsData
          : activeTab === 'users' ? refreshAccountsData
            : activeTab === 'audit-logs' ? refreshAuditData
              : null;
    if (load) void load(controller.signal).then(() => {
      if (generation !== tabRequestGenerationRef.current) controller.abort();
    });
    return () => controller.abort();
  }, [activeTab, token, user?.id, user?.role, classPage, classPageSize, assignmentPage, assignmentPageSize, usersPage, usersPageSize, debouncedUsersSearch, usersRoleFilter, usersStatusFilter, auditPage, auditPageSize]);

  useEffect(() => {
    if (!token || (activeTab !== 'results' && !(activeTab === 'dashboard' && isDashboardLeaderboardExpanded))) return;
    const controller = new AbortController();
    void refreshLeaderboardData(controller.signal);
    return () => controller.abort();
  }, [activeTab, token, isDashboardLeaderboardExpanded, leaderboardPeriod, leaderboardCategory, leaderboardClassId, leaderboardVocabSetId, leaderboardPage]);


  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const ensureVocabImageProviders = async () => {
    if (vocabImageProviders.length > 0) return vocabImageProviders;
    const data = await authFetchJson<{ providers: VocabImageProviderOption[] }>('/api/image-library/providers');
    const providers = Array.isArray(data.providers) ? data.providers : [];
    setVocabImageProviders(providers);
    return providers;
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
    setImagePickerItemId(null);
    setIsBatchGeneratingImages(false);
    setBatchTerms('');
    setBatchMeanings('');
    setBatchIpas('');
    setBatchPartsOfSpeech('');
    setBatchExamples('');
    setBatchExampleMeanings('');
    setActiveTab('editor');
  };

  const handleCopyBulkImportPrompt = async (kind: Exclude<CopiedBulkPrompt, null>) => {
    const prompt = kind === 'vocabulary'
      ? buildVocabularyBulkImportPrompt({
          title: editorTitle,
          description: editorDescription,
          grade: editorGrade,
          subject: editorSubject,
          tags: editorTags,
        })
      : kind === 'grammar-rewrite'
        ? buildRewriteGrammarBulkImportPrompt({
            title: grammarTitle,
            description: grammarDescription,
            grade: grammarGrade,
            subject: grammarSubject,
            topic: grammarTopic,
            tags: grammarTags,
          })
        : buildMultipleChoiceGrammarBulkImportPrompt({
            title: grammarTitle,
            description: grammarDescription,
            grade: grammarGrade,
            subject: grammarSubject,
            topic: grammarTopic,
            tags: grammarTags,
          });
    const result = await copyAdminPromptToClipboard(prompt);
    if (result === 'manual') {
      showNotification('Trình duyệt đã mở prompt để bạn sao chép thủ công.', 'error');
      return;
    }
    setCopiedBulkPrompt(kind);
    showNotification('Đã sao chép prompt. Hãy dán vào ChatGPT web.');
    window.setTimeout(() => {
      setCopiedBulkPrompt(current => current === kind ? null : current);
    }, 2_200);
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

  const handleEditGrammarSet = async (summary: GrammarSet) => {
    try {
      const set = await authFetchJson<GrammarSet>(`/api/admin/grammar-sets/${encodeURIComponent(summary.id)}`);
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
    } catch (err: any) {
      showNotification(err.message || 'Không tải được chi tiết bài ngữ pháp.', 'error');
    }
  };

  const handleViewGrammarAsStudent = async (summary: GrammarSet) => {
    if (!onViewGrammarAsStudent) return;
    try {
      const detail = await authFetchJson<GrammarSet>(`/api/admin/grammar-sets/${encodeURIComponent(summary.id)}`);
      onViewGrammarAsStudent(detail);
    } catch (err: any) {
      showNotification(err.message || 'Không tải được bài ngữ pháp.', 'error');
    }
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
    if (!window.confirm(`Lưu trữ bài ngữ pháp "${set.title}" và thu hồi link học? Lịch sử làm bài vẫn được giữ lại.`)) return;
    authFetchJson<{ archived: boolean }>(`/api/admin/grammar-sets/${set.id}`, { method: 'DELETE' })
      .then(() => {
        showNotification('Đã lưu trữ bài ngữ pháp và giữ nguyên lịch sử.');
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

  const handleOpenEditEditor = async (summary: VocabSet) => {
    try {
      const set = await authFetchJson<VocabSet>(`/api/admin/vocab-sets/${encodeURIComponent(summary.id)}`);
      setEditingSetId(set.id);
      setEditorTitle(set.title);
      setEditorDescription(set.description);
      setEditorSubject(set.subject);
      setEditorGrade(set.gradeLevel);
      setEditorStatus(getSetVisibility(set));
      setEditorTags(set.tags);
      setEditorItems([...(set.items || [])]);
      setTtsSettings({ ...DEFAULT_TTS_SETTINGS, ...(set.ttsSettings || {}) });
      setTtsQueuedSetId(null);
      setImagePickerItemId(null);
      setIsBatchGeneratingImages(false);
      setBatchTerms('');
      setBatchMeanings('');
      setBatchIpas('');
      setBatchPartsOfSpeech('');
      setBatchExamples('');
      setBatchExampleMeanings('');
      setActiveTab('editor');
    } catch (err: any) {
      showNotification(err.message || 'Không tải được chi tiết bộ từ vựng.', 'error');
    }
  };

  const handleViewVocabAsStudent = async (summary: VocabSet) => {
    try {
      const detail = await authFetchJson<VocabSet>(`/api/admin/vocab-sets/${encodeURIComponent(summary.id)}`);
      onViewAsStudent(detail);
    } catch (err: any) {
      showNotification(err.message || 'Không tải được bài học.', 'error');
    }
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
          const updated = {
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
          delete updated.imageAssetId;
          delete updated.imageUrl;
          delete updated.imageAttribution;
          delete updated.imageAttachedAt;
          return updated;
        }
        return { ...item, [field]: value };
      }
      return item;
    }));
  };

  const handleOpenImagePicker = async (itemId: string) => {
    try {
      await ensureVocabImageProviders();
      setImagePickerItemId(itemId);
    } catch (err: any) {
      showNotification(err.message || 'Không tải được danh sách dịch vụ tạo ảnh.', 'error');
    }
  };

  const handleGenerateAllVocabImages = async () => {
    const targetItems = editorItems
      .filter(item => item.term.trim())
      .map(item => ({ id: item.id, term: item.term.trim(), meaning: item.meaning.trim(), pos: item.pos.trim() }));
    if (targetItems.length === 0) {
      showNotification('Chưa có từ tiếng Anh để tạo ảnh.', 'error');
      return;
    }
    setIsBatchGeneratingImages(true);
    setVocabImageBatchProgress({ completed: 0, total: targetItems.length });
    try {
      const providers = await ensureVocabImageProviders();
      if (!providers.some(provider => provider.configured)) {
        throw new Error('Chưa cấu hình dịch vụ tạo ảnh trên máy chủ.');
      }
      const expectedTerms = new Map<string, string>(targetItems.map(item => [String(item.id), String(item.term)] as const));
      const startedJob = await generateVocabImagesBatch('auto', targetItems);
      const completedJob = await pollVocabImageBatchJob(startedJob, expectedTerms);
      const firstError = completedJob.items.find(item => item.error)?.error || completedJob.error;
      showNotification(
        `Đã tạo và gắn ${completedJob.succeeded} ảnh${completedJob.failed ? `, lỗi ${completedJob.failed} từ` : ''}.${firstError ? ` ${firstError}` : ''} Bấm lưu bộ từ để lưu metadata ảnh.`,
        completedJob.failed || completedJob.status === 'failed' ? 'error' : 'success'
      );
    } catch (err: any) {
      showNotification(err.message || 'Không thể tạo ảnh hàng loạt.', 'error');
    } finally {
      setIsBatchGeneratingImages(false);
      setVocabImageBatchProgress(null);
    }
  };

  const loadDefaultVocabImagePrompt = async (item: VocabItem) => {
    const data = await authFetchJson<{ prompt: string }>('/api/image-library/prompt', {
      method: 'POST',
      body: JSON.stringify({
        term: item.term.trim(),
        meaning: item.meaning.trim(),
        partOfSpeech: item.pos.trim(),
      })
    });
    return data.prompt;
  };

  const generateVocabImage = async (provider: VocabImageGenerationProviderId, item: VocabItem, prompt: string) => {
    return authFetchJson<VocabImageGenerationResult>('/api/image-library/generate', {
      method: 'POST',
      body: JSON.stringify({
        provider,
        term: item.term.trim(),
        meaning: item.meaning.trim(),
        partOfSpeech: item.pos.trim(),
        prompt,
      })
    });
  };

  const applyVocabImageAsset = (itemId: string, asset: ManagedVocabImageAsset) => {
    setEditorItems(current => current.map(item => item.id === itemId ? {
      ...item,
      imageAssetId: asset.id,
      imageUrl: asset.publicUrl,
      imageAttribution: {
        provider: asset.provider,
        externalId: asset.externalId,
        title: asset.title,
        author: asset.author,
        license: asset.license,
        ...(asset.licenseUrl ? { licenseUrl: asset.licenseUrl } : {}),
        ...(asset.sourcePageUrl ? { sourcePageUrl: asset.sourcePageUrl } : {}),
      },
      imageAttachedAt: new Date().toISOString(),
    } : item));
    showNotification('Đã đưa ảnh vào bản soạn. Bấm lưu bộ từ để hoàn tất gắn ảnh.');
  };

  const uploadVocabImageFile = async (file: File) => {
    const supportedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!supportedTypes.includes(file.type)) throw new Error('Chỉ hỗ trợ ảnh JPEG, PNG, WebP hoặc GIF.');
    if (file.size > 8 * 1024 * 1024) throw new Error('Ảnh lớn hơn giới hạn 8 MB.');
    const response = await fetch('/api/image-library/upload', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': file.type,
        'x-image-file-name': encodeURIComponent(file.name || 'image'),
        'x-image-rights-confirmed': 'true',
      },
      body: file,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.error || `Tải ảnh thất bại (HTTP ${response.status}).`);
    return data.asset as ManagedVocabImageAsset;
  };

  const handleUploadVocabImage = async (itemId: string, file: File) => {
    setBusyVocabImageItemId(itemId);
    try {
      applyVocabImageAsset(itemId, await uploadVocabImageFile(file));
    } catch (err: any) {
      showNotification(err?.message || 'Không tải được ảnh.', 'error');
    } finally {
      setBusyVocabImageItemId(null);
    }
  };

  const handlePasteVocabImage = async (itemId: string) => {
    if (!navigator.clipboard?.read) {
      showNotification('Trình duyệt chưa cho phép đọc ảnh từ clipboard. Hãy dùng nút Tải.', 'error');
      return;
    }
    setBusyVocabImageItemId(itemId);
    try {
      const clipboardItems = await navigator.clipboard.read();
      const clipboardItem = clipboardItems.find(entry => entry.types.some(type => type.startsWith('image/')));
      const imageType = clipboardItem?.types.find(type => ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(type));
      if (!clipboardItem || !imageType) throw new Error('Clipboard không có ảnh JPEG, PNG, WebP hoặc GIF.');
      const blob = await clipboardItem.getType(imageType);
      const extension = imageType === 'image/jpeg' ? 'jpg' : imageType.split('/')[1];
      const file = new File([blob], `clipboard-${Date.now()}.${extension}`, { type: imageType });
      applyVocabImageAsset(itemId, await uploadVocabImageFile(file));
    } catch (err: any) {
      showNotification(err?.message || 'Không dán được ảnh từ clipboard.', 'error');
    } finally {
      setBusyVocabImageItemId(null);
    }
  };

  const removeVocabImage = (itemId: string) => {
    setEditorItems(current => current.map(item => {
      if (item.id !== itemId) return item;
      const updated = { ...item };
      delete updated.imageAssetId;
      delete updated.imageUrl;
      delete updated.imageAttribution;
      delete updated.imageAttachedAt;
      return updated;
    }));
  };

  const generateVocabImagesBatch = async (provider: VocabImageBatchProvider, items: Array<{ id: string; term: string; meaning: string; pos: string }>) => {
    return authFetchJson<VocabImageBatchJob>('/api/image-library/batch-generate', {
      method: 'POST',
      body: JSON.stringify({ provider, items })
    });
  };

  const applyVocabImageBatchResults = (results: BatchImageGenerationResult[], expectedTerms?: Map<string, string>) => {
    const assets = new Map(results.filter(result => result.asset).map(result => [result.id, result.asset!]));
    setEditorItems(current => current.map(item => {
      const asset = assets.get(item.id);
      if (!asset) return item;
      if (expectedTerms && item.term.trim() !== expectedTerms.get(item.id)) return item;
      return {
        ...item,
        imageAssetId: asset.id,
        imageUrl: asset.publicUrl,
        imageAttribution: {
          provider: asset.provider,
          externalId: asset.externalId,
          title: asset.title,
          author: asset.author,
          license: asset.license,
          ...(asset.licenseUrl ? { licenseUrl: asset.licenseUrl } : {}),
          ...(asset.sourcePageUrl ? { sourcePageUrl: asset.sourcePageUrl } : {}),
        },
        imageAttachedAt: new Date().toISOString(),
      };
    }));
  };

  const pollVocabImageBatchJob = async (startedJob: VocabImageBatchJob, expectedTerms: Map<string, string>) => {
    let job = startedJob;
    let consecutiveFailures = 0;
    const appliedIds = new Set<string>();
    while (job.status === 'queued' || job.status === 'running') {
      await new Promise(resolve => window.setTimeout(resolve, consecutiveFailures ? Math.min(10_000, consecutiveFailures * 2_000) : 1_500));
      try {
        job = await authFetchJson<VocabImageBatchJob>(`/api/image-library/batch-generate/${encodeURIComponent(job.jobId)}`);
        consecutiveFailures = 0;
      } catch (error) {
        consecutiveFailures += 1;
        if (consecutiveFailures >= 6) throw error;
        continue;
      }
      const newResults = job.items.filter(item => !appliedIds.has(item.id));
      newResults.forEach(item => appliedIds.add(item.id));
      if (newResults.length > 0) applyVocabImageBatchResults(newResults, expectedTerms);
      setVocabImageBatchProgress({ completed: job.completed, total: job.total });
    }
    if (job.status === 'failed' && job.completed === 0) {
      throw new Error(job.error || 'Tiến trình tạo ảnh nền đã dừng trước khi có kết quả.');
    }
    return job;
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
      showNotification('Hãy lưu bộ từ trước khi tạo audio riêng cho từ này.', 'error');
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
        showNotification(data.error || 'Không thể xếp hàng tạo audio.', 'error');
        return;
      }
      showNotification('Đã xếp hàng tạo audio cho từ này.');
      setTimeout(() => refreshEditorAudioStatus(editingSetId), 2500);
    } catch (err: any) {
      showNotification(err.message || 'Không thể tạo audio.', 'error');
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

    authFetchJson<VocabSet>(url, {
      method,
      body: JSON.stringify(payload)
    })
    .then(data => {
      showNotification("Lưu bộ từ vựng thành công!");
      const savedVisibility = getSetVisibility(data);
      const assignmentUrl = getAssignmentLink(data);
      if (savedVisibility === 'assignment' && assignmentUrl) {
        setShareLinkNotice({ title: data.title, url: assignmentUrl });
      } else {
        setShareLinkNotice(null);
      }
      void refreshDashboard();
      setActiveTab('vocab-sets');
    })
    .catch(err => {
      console.error(err);
      showNotification(err.message || "Không thể lưu bộ từ vựng.", "error");
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
    if (!window.confirm("Lưu trữ bộ từ vựng và thu hồi các bài giao tương ứng? Lịch sử học sinh vẫn được giữ lại.")) return;
    
    authFetchJson<{ archived: boolean }>(`/api/vocab-sets/${id}`, { method: 'DELETE' })
      .then(() => {
        showNotification("Đã lưu trữ bộ từ vựng và giữ nguyên lịch sử.");
        refreshData();
      })
      .catch(err => showNotification(err.message, 'error'));
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
    if (!window.confirm(`Lưu trữ lớp "${className}" và thu hồi các bài đã giao? Thành viên và lịch sử học tập vẫn được giữ lại.`)) return;

    authFetchJson<{ archived: boolean }>(`/api/classes/${id}`, {
      method: 'DELETE'
    })
    .then(() => {
      showNotification(`Đã lưu trữ lớp "${className}" và giữ nguyên lịch sử.`);
      refreshData();
    })
    .catch(err => showNotification(err.message, 'error'));
  };

  // --- ASSIGNMENTS SCHEDULER ---
  const handleViewVocabularyAssignment = async (assignment: Assignment, summary: VocabSet) => {
    try {
      const detail = await authFetchJson<VocabSet>(`/api/admin/vocab-sets/${encodeURIComponent(summary.id)}`);
      onViewAsStudent({
        ...detail,
        assignmentId: assignment.id,
        assignmentGameId: assignment.gameId,
        classId: assignment.classId,
        className: assignment.className,
        assignmentTitle: assignment.title
      }, assignment.gameId, assignment.id);
    } catch (err: any) {
      showNotification(err.message || 'Không tải được bài tập từ vựng.', 'error');
    }
  };

  const handleCreateAssignment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignClassId || !assignSetId || !assignDueDate) {
      showNotification("Vui lòng điền đủ thông tin giao bài.", "error");
      return;
    }

    const selectedClass = classes.find(c => c.id === assignClassId);
    const selectedSet = assignResourceType === 'listening'
      ? listeningSets.find(s => s.id === assignSetId)
      : assignResourceType === 'mover_reading_writing'
        ? moverReadingWritingSets.find(s => s.id === assignSetId)
        : assignResourceType === 'exam'
          ? examSets.find(s => s.id === assignSetId)
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
        : assignResourceType === 'listening' ? {
            listeningSetId: assignSetId,
            listeningSetTitle: selectedSet.title,
            gameId: 'listening-five-part'
          } : assignResourceType === 'mover_reading_writing' ? {
            moverReadingWritingSetId: assignSetId,
            moverReadingWritingSetTitle: selectedSet.title,
            gameId: 'mover-reading-writing'
          } : {
            examSetId: assignSetId,
            examModuleId: selectedSet.moduleId,
            examPaperId: selectedSet.paperId,
            gameId: `exam:${selectedSet.moduleId}:${selectedSet.paperId}`
          }),
      dueDate: assignDueDate,
      createdBy: user?.id || "teacher-1",
      title: assignTitle.trim() || (assignResourceType === 'listening'
        ? `Luyện nghe: ${selectedSet.title}`
        : assignResourceType === 'mover_reading_writing'
          ? `Reading & Writing: ${selectedSet.title}`
          : assignResourceType === 'exam'
            ? `${selectedSet.level || selectedSet.moduleId} · ${selectedSet.title}`
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

  // The list APIs own filtering, sorting and paging. These aliases preserve the
  // existing presentation component contract without a second client-side pass.
  const sortedFilteredSets = vocabSets;
  const vocabTotalPages = vocabServerTotalPages;
  const vocabCurrentPage = Math.min(vocabPage, vocabTotalPages);
  const paginatedVocabSets = vocabSets;
  const sortedGrammarSets = grammarSets;
  const grammarTotalPages = grammarServerTotalPages;
  const grammarCurrentPage = Math.min(grammarPage, grammarTotalPages);
  const paginatedGrammarSets = grammarSets;

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

  const leaderboardRows = leaderboardResults;

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

  React.useEffect(() => {
    setLeaderboardPage(1);
  }, [leaderboardPeriod, leaderboardCategory, leaderboardClassId, leaderboardVocabSetId]);

  React.useEffect(() => {
    if (leaderboardPage > leaderboardTotalPages) setLeaderboardPage(leaderboardTotalPages);
  }, [leaderboardPage, leaderboardTotalPages]);

  const closeActivityDetail = () => {
    activityDetailRequestRef.current += 1;
    setSelectedActivity(null);
    setActivityDetailLoading(false);
    setActivityDetailError('');
  };

  const openActivityDetail = async (activity: GameSession) => {
    const requestId = ++activityDetailRequestRef.current;
    const sourceType = String((activity as any).sourceType || 'vocabulary');
    const sourceId = String((activity as any).sourceId || activity.id);
    setSelectedActivity(activity);
    setActivityDetailLoading(true);
    setActivityDetailError('');
    try {
      const detail = await authFetchJson<GameSession>(
        `/api/results/${encodeURIComponent(sourceType)}/${encodeURIComponent(sourceId)}`
      );
      if (activityDetailRequestRef.current === requestId) setSelectedActivity(detail);
    } catch (err: any) {
      if (activityDetailRequestRef.current === requestId) {
        setActivityDetailError(err?.message || 'Không thể tải chi tiết lượt luyện tập.');
      }
    } finally {
      if (activityDetailRequestRef.current === requestId) setActivityDetailLoading(false);
    }
  };

  const selectedActivityAnswerDetails = React.useMemo(() => {
    if (!selectedActivity || !Array.isArray(selectedActivity.answerDetails)) return [];
    return selectedActivity.answerDetails.filter(Boolean);
  }, [selectedActivity]);

  const dashboardGoldRows = dashboardSummary.goldRows;

  const toggleDashboardActivity = async () => {
    const nextExpanded = !isDashboardActivityExpanded;
    setIsDashboardActivityExpanded(nextExpanded);
    if (!nextExpanded || results.length >= dashboardSummary.counts.activities) return;
    try {
      const data = await authFetchJson<GameSession[]>('/api/results?view=summary&limit=500');
      setResults(Array.isArray(data) ? data : []);
    } catch (err: any) {
      showNotification(err.message || 'Không thể tải toàn bộ hoạt động.', 'error');
    }
  };

  const toggleDashboardLeaderboard = async () => {
    const nextExpanded = !isDashboardLeaderboardExpanded;
    setIsDashboardLeaderboardExpanded(nextExpanded);
  };

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

  const filteredUsers = usersList;

  const adminOverlays = (
    <>
      
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
                onClick={closeActivityDetail}
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

                {activityDetailLoading ? (
                  <div className="p-8 text-center text-sm font-bold text-blue-600">
                    Đang tải chi tiết từng câu...
                  </div>
                ) : activityDetailError ? (
                  <div className="p-8 text-center space-y-3">
                    <p className="text-sm font-semibold text-rose-600">{activityDetailError}</p>
                    <button
                      onClick={() => void openActivityDetail(selectedActivity)}
                      className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-black text-blue-700"
                    >
                      Thử tải lại
                    </button>
                  </div>
                ) : selectedActivityAnswerDetails.length === 0 ? (
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

    </>
  );

  return (
    <AdminShell
      activeTab={activeTab}
      user={user}
      grammarQuestionType={grammarQuestionType}
      onSelectTab={setActiveTab}
      onOpenNewGrammar={handleOpenNewGrammarEditor}
      overlays={adminOverlays}
    >
      {/* Main Panel Content Area */}

        {/* ==================================================================== */}
        {/* TAB 1: OVERVIEW DASHBOARD */}
        {/* ==================================================================== */}
        {activeTab === 'dashboard' && (
          <DashboardOverviewPanel
            controller={{
              teacherDisplayName,
              dashboardSummary,
              recentResults,
              dashboardGoldRows,
              isDashboardActivityExpanded,
              isDashboardLeaderboardExpanded,
              filteredActivityResults,
              completedActivityResults,
              activitySearch,
              leaderboardPeriod,
              leaderboardCategory,
              leaderboardClassId,
              leaderboardVocabSetId,
              leaderboardClassOptions,
              leaderboardSetOptions,
              leaderboardRows,
              leaderboardTitleMap,
              handleOpenNewEditor,
              toggleDashboardActivity,
              toggleDashboardLeaderboard,
              openActivityDetail,
              setActivitySearch,
              setLeaderboardPeriod,
              setLeaderboardCategory,
              setLeaderboardClassId,
              setLeaderboardVocabSetId,
              formatLeaderboardDisplayName,
              formatVietnamDateTime,
              formatDuration,
              getSessionEndTime,
            }}
          />
        )}

        {/* ==================================================================== */}
        {/* TAB 2: VOCAB SETS DIRECTORY */}
        {/* ==================================================================== */}
        {activeTab === 'vocab-sets' && (
          <VocabularyLibraryPanel
            searchQuery={searchQuery}
            filterGrade={filterGrade}
            filterStatus={filterStatus}
            gradeOptions={gradeOptions}
            paginatedSets={paginatedVocabSets}
            totalItems={vocabTotalItems}
            currentPage={vocabCurrentPage}
            totalPages={vocabTotalPages}
            pageSize={vocabPageSize}
            onSearchQueryChange={setSearchQuery}
            onFilterGradeChange={setFilterGrade}
            onFilterStatusChange={setFilterStatus}
            onPageChange={setVocabPage}
            onPageSizeChange={setVocabPageSize}
            onOpenNew={handleOpenNewEditor}
            onViewAsStudent={handleViewVocabAsStudent}
            onEdit={handleOpenEditEditor}
            onClone={handleCloneSet}
            onResults={handleLoadVocabResults}
            onDelete={handleDeleteSet}
            onNotify={showNotification}
            getVisibility={getSetVisibility}
            getPrivateLink={getAssignmentLink}
            formatGrade={formatGradeLabel}
            formatDateTime={formatVietnamDateTime}
            formatVisibility={formatVisibilityLabel}
            resultsPanel={vocabResultsSet ? (
              <VocabularyResultsPanel
                set={vocabResultsSet}
                results={vocabResults}
                filteredResults={filteredVocabResults}
                isLoading={isVocabResultsLoading}
                hasFilter={hasVocabResultsFilter}
                nameFilter={vocabResultsNameFilter}
                gameFilter={vocabResultsGameFilter}
                gameDropdownOpen={vocabResultsGameDropdownOpen}
                gameOptions={vocabResultGameOptions}
                onNameFilterChange={setVocabResultsNameFilter}
                onGameFilterChange={setVocabResultsGameFilter}
                onGameDropdownOpenChange={setVocabResultsGameDropdownOpen}
                onClose={() => {
                  setVocabResultsSet(null);
                  setVocabResults([]);
                  resetVocabResultsFilters();
                }}
                onSelectActivity={setSelectedActivity}
                formatDisplayName={formatLeaderboardDisplayName}
                formatDuration={formatDuration}
                formatDateTime={formatVietnamDateTime}
              />
            ) : undefined}
          />
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

        {activeTab === 'writing-library' && token && (
          <React.Suspense fallback={(
            <div className="rounded-3xl border border-violet-100 bg-white p-10 text-center text-sm font-bold text-slate-500 shadow-sm">
              Đang tải kho đề Writing...
            </div>
          )}>
            <WritingLibraryAdmin token={token} />
          </React.Suspense>
        )}

        {activeTab === 'grammar-sets' && (
          <GrammarLibraryPanel
            controller={{
              grammarSearchQuery,
              grammarFilterGrade,
              grammarFilterStatus,
              grammarGradeOptions,
              paginatedGrammarSets,
              grammarTotalItems,
              grammarCurrentPage,
              grammarTotalPages,
              grammarPageSize,
              grammarResultsSet,
              grammarResults,
              canViewAsStudent: Boolean(onViewGrammarAsStudent),
              setGrammarSearchQuery,
              setGrammarFilterGrade,
              setGrammarFilterStatus,
              setGrammarPage,
              setGrammarPageSize,
              setGrammarResultsSet,
              setGrammarResults,
              setSelectedActivity,
              handleOpenNewGrammarEditor,
              handleViewGrammarAsStudent,
              handleEditGrammarSet,
              handleCloneGrammarSet,
              handleLoadGrammarResults,
              handleDeleteGrammarSet,
              getGrammarPrivateLink,
              showNotification,
              formatGradeLabel,
              formatVisibilityLabel,
              formatVietnamDateTime,
              formatDuration,
              grammarAttemptToActivity,
            }}
          />
        )}

        {/* ==================================================================== */}
        {/* TAB 2C: GRAMMAR EDITOR */}
        {/* ==================================================================== */}
        {activeTab === 'grammar-editor' && (
          <GrammarEditorPanel
            controller={{
              editingGrammarSetId,
              grammarQuestionType,
              grammarTitle,
              grammarDescription,
              grammarGrade,
              grammarSubject,
              grammarTopic,
              grammarVisibility,
              grammarTags,
              grammarTimeLimitMinutes,
              grammarMaxAttempts,
              grammarShuffleQuestions,
              grammarShuffleOptions,
              grammarShowExplanationImmediately,
              grammarShowReviewAfterSubmit,
              grammarBulkText,
              grammarQuestions,
              gradeOptions,
              copiedBulkPrompt,
              setGrammarTitle,
              setGrammarDescription,
              setGrammarGrade,
              setGrammarSubject,
              setGrammarTopic,
              setGrammarVisibility,
              setGrammarTags,
              setGrammarTimeLimitMinutes,
              setGrammarMaxAttempts,
              setGrammarShuffleQuestions,
              setGrammarShuffleOptions,
              setGrammarShowExplanationImmediately,
              setGrammarShowReviewAfterSubmit,
              setGrammarBulkText,
              setGrammarQuestions,
              handleSaveGrammarSet,
              handleCopyBulkImportPrompt,
              handleParseGrammarBulk,
              handleAddGrammarQuestion,
              handleDuplicateGrammarQuestion,
              updateGrammarQuestion,
              updateGrammarOption,
            }}
          />
        )}

        {/* ==================================================================== */}
        {/* TAB 3: ADVANCED VOCAB SET EDITOR */}
        {/* ==================================================================== */}
        {activeTab === 'editor' && (
          <VocabularyEditorPanel
            controller={{
              TTS_VOICE_OPTIONS,
              batchExampleMeanings,
              batchExamples,
              batchIpas,
              batchMeanings,
              batchPartsOfSpeech,
              batchTerms,
              batchVocabularyText,
              busyVocabImageItemId,
              copiedBulkPrompt,
              editingSetId,
              editorDescription,
              editorGrade,
              editorItems,
              editorStatus,
              editorSubject,
              editorTags,
              editorTitle,
              gradeOptions,
              handleAddItemRow,
              handleCheckAudioStatusSmart,
              handleCopyBulkImportPrompt,
              handleDeleteItemRow,
              handleGenerateAllAudioBeforeSave,
              handleGenerateAllBlankIpas,
              handleGenerateAllVocabImages,
              handleGenerateIpaForRow,
              handleGenerateItemAudioBeforeSave,
              handleOpenImagePicker,
              handlePasteVocabImage,
              handlePlayItemAudio,
              handlePreviewTtsVoice,
              handleProcessBatchAdd,
              handleSaveSet,
              handleTtsProviderChange,
              handleUpdateItemValue,
              handleUploadVocabImage,
              isBatchGeneratingAudio,
              isBatchGeneratingImages,
              isPreviewingTts,
              removeVocabImage,
              setActiveTab,
              setBatchExampleMeanings,
              setBatchExamples,
              setBatchIpas,
              setBatchMeanings,
              setBatchPartsOfSpeech,
              setBatchTerms,
              setBatchVocabularyText,
              setEditorDescription,
              setEditorGrade,
              setEditorStatus,
              setEditorSubject,
              setEditorTags,
              setEditorTitle,
              speakEnglish,
              ttsSettings,
              updateTtsSettings,
              vocabImageBatchProgress
            }}
          />
        )}
        {/* ==================================================================== */}
        {/* TAB 4: CLASSES & ENROLLMENT MANAGER */}
        {/* ==================================================================== */}
        {activeTab === 'classes' && (
          <ClassManagementPanel
            controller={{
              classes,
              classMembers,
              newClassName,
              newMemberNames,
              classPage,
              classPageSize,
              classTotalItems,
              classTotalPages,
              setNewClassName,
              setNewMemberNames,
              setClassPage,
              setClassPageSize,
              handleCreateClass,
              handleAddClassMember,
              handleDeleteClassMember,
              handleDeleteClass,
            }}
          />
        )}

        {/* ==================================================================== */}
        {/* TAB 5: HOMEWORK ASSIGNMENTS MANAGER */}
        {/* ==================================================================== */}
        {activeTab === 'assignments' && (
          <AssignmentManagementPanel
            controller={{
              classes,
              assignments,
              vocabSets,
              listeningSets,
              moverReadingWritingSets,
              examSets,
              assignClassId,
              assignResourceType,
              assignSetId,
              assignGameId,
              assignDueDate,
              assignTitle,
              assignmentPage,
              assignmentPageSize,
              assignmentTotalItems,
              assignmentTotalPages,
              setAssignClassId,
              setAssignResourceType,
              setAssignSetId,
              setAssignGameId,
              setAssignDueDate,
              setAssignTitle,
              setAssignmentPage,
              setAssignmentPageSize,
              handleCreateAssignment,
              handleDeleteAssignment,
              handleViewVocabularyAssignment,
              getSetVisibility,
              getAssignmentRecordLink,
              showNotification,
            }}
          />
        )}

        {/* ==================================================================== */}
        {/* TAB 6: STUDENT GOLDEN BOARD */}
        {/* ==================================================================== */}
        {activeTab === 'results' && (
          <AdminResultsPanel
            controller={{
              leaderboardPeriod,
              leaderboardCategory,
              leaderboardClassId,
              leaderboardVocabSetId,
              leaderboardClassOptions,
              leaderboardSetOptions,
              leaderboardRows,
              leaderboardPage,
              leaderboardTotalItems,
              leaderboardTotalPages,
              leaderboardTitleMap,
              activitySearch,
              filteredActivityResults,
              completedActivityResults,
              setLeaderboardPeriod,
              setLeaderboardCategory,
              setLeaderboardClassId,
              setLeaderboardVocabSetId,
              setLeaderboardPage,
              setActivitySearch,
              openActivityDetail,
              formatLeaderboardDisplayName,
              formatVietnamDateTime,
              formatDuration,
              getSessionEndTime,
            }}
          />
        )}

        {/* ==================================================================== */}
        {/* TAB 7: ACCOUNT / STUDENT PROFILE MANAGEMENT */}
        {/* ==================================================================== */}
        {activeTab === 'users' && (user?.role === 'teacher' || user?.role === 'super_admin') && (
          <AccountManagementPanel
            controller={{
              user,
              filteredUsers,
              usersSearch,
              usersRoleFilter,
              usersStatusFilter,
              usersPage,
              usersPageSize,
              usersTotalItems,
              usersTotalPages,
              setUsersSearch,
              setUsersRoleFilter,
              setUsersStatusFilter,
              setUsersPage,
              setUsersPageSize,
              setEditingAccount,
              setEditingAccountName,
              handleUpdateUserRole,
              handleToggleAccountStatus,
            }}
          />
        )}

        {/* ==================================================================== */}
        {/* TAB 8: AUDIT LOGS VIEW */}
        {/* ==================================================================== */}
        {activeTab === 'audit-logs' && user?.role === 'super_admin' && (
          <AuditLogPanel
            controller={{
              auditLogs,
              auditPage,
              auditPageSize,
              auditTotalItems,
              auditTotalPages,
              setAuditPage,
              setAuditPageSize,
            }}
          />
        )}

        <VocabImageGenerateDialog
          item={editorItems.find(item => item.id === imagePickerItemId) || null}
          providers={vocabImageProviders}
          onClose={() => setImagePickerItemId(null)}
          onLoadPrompt={loadDefaultVocabImagePrompt}
          onGenerate={generateVocabImage}
          onApplied={(itemId, asset) => {
            applyVocabImageAsset(itemId, asset);
            setImagePickerItemId(null);
          }}
        />
    </AdminShell>
  );
}


