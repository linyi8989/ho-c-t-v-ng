import React, { useMemo, useState, useEffect } from 'react';
import { 
  ArrowLeft, Volume2, Shuffle, Maximize2, ShieldAlert, Check, X, 
  HelpCircle, Trophy, BookOpen, Star, Sparkles, User, Award, ExternalLink 
} from 'lucide-react';
import { Assignment, Class, ClassMember, GameCompletionDetails, VocabSet, VocabItem, GameConfig, GameSession } from '../../types';
import { GAMES_LIST } from '../../lib/game-engine/gameList';
import { speakEnglish } from '../../lib/game-engine/speech';
import { buildLeaderboard, LeaderboardPeriod, LeaderboardEntry } from '../../lib/leaderboard';

// Import our games
import FlashcardGame from './FlashcardGame';
import QuizGame from './QuizGame';
import FillBlankGame from './FillBlankGame';
import MatchingGame from './MatchingGame';
import MemoryGame from './MemoryGame';
import MillionaireGame from './MillionaireGame';
import SpeakingAIGame from './SpeakingAIGame';
import { useAuth } from '../../context/AuthContext';

interface StudentLearningAreaProps {
  vocabSet: VocabSet;
  studentName: string;
  assignmentId?: string;
  assignmentClassId?: string;
  assignmentClassName?: string;
  initialGameId?: string;
  onBack: () => void;
}

const GUEST_ID_STORAGE_KEY = 'msdieu_guest_id';
const STUDENT_NAME_STORAGE_KEY = 'msdieu_student_name';
const ACTIVITY_TTL_DAYS = 7;
const VISIBLE_GAMES_LIST = GAMES_LIST.filter((game) => !game.hidden);
const GAME_CATEGORY_ORDER = ['flashcard', 'quiz', 'fill', 'matching', 'memory', 'millionaire'] as const;
const GAME_CATEGORY_TITLES: Record<string, string> = {
  flashcard: 'Nhóm Flashcard',
  quiz: 'Nhóm Trắc nghiệm',
  fill: 'Nhóm Điền từ / Viết',
  matching: 'Nhóm Ghép đôi',
  memory: 'Nhóm Luyện trí nhớ',
  millionaire: 'Ai là triệu phú',
  speaking: 'Luyện nói'
};

function createGuestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `guest-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getStoredGuestId() {
  if (typeof window === 'undefined') return '';

  try {
    const existing = window.localStorage.getItem(GUEST_ID_STORAGE_KEY);
    if (existing) return existing;

    const newGuestId = createGuestId();
    window.localStorage.setItem(GUEST_ID_STORAGE_KEY, newGuestId);
    return newGuestId;
  } catch {
    return createGuestId();
  }
}

function getStoredStudentName() {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(STUDENT_NAME_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

function addDaysIso(baseIso: string, days: number) {
  return new Date(new Date(baseIso).getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

function compactClassName(className?: string) {
  return String(className || "").split(" - ")[0].trim();
}

function normalizePersonName(value?: string) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ');
}

function setUniqueClass(
  map: Map<string, { classId: string; className: string } | null>,
  key: string,
  classInfo: { classId?: string; className?: string }
) {
  if (!key || !classInfo.classId) return;
  const existing = map.get(key);
  if (!existing) {
    if (!map.has(key)) {
      map.set(key, {
        classId: classInfo.classId,
        className: classInfo.className || ''
      });
    }
    return;
  }

  if (existing.classId !== classInfo.classId) {
    map.set(key, null);
  }
}

function formatLeaderboardStudentName(entry: LeaderboardEntry) {
  const className = compactClassName(entry.className);
  return className ? `${entry.studentName} - ${className}` : entry.studentName;
}

function getLessonGradeClassId(vocabSet: VocabSet) {
  return vocabSet.gradeLevel ? `grade:${normalizePersonName(vocabSet.gradeLevel)}` : undefined;
}

export default function StudentLearningArea({ 
  vocabSet, 
  studentName: propStudentName, 
  assignmentId, 
  assignmentClassId,
  assignmentClassName,
  initialGameId, 
  onBack 
}: StudentLearningAreaProps) {
  const { token } = useAuth();
  const [guestId] = useState(() => getStoredGuestId());
  const [studentName, setStudentName] = useState(() => propStudentName || getStoredStudentName());
  const [nameSubmitted, setNameSubmitted] = useState(() => !!(propStudentName || getStoredStudentName()));
  const [selectedGame, setSelectedGame] = useState<GameConfig | null>(null);
  const [activeItems, setActiveItems] = useState<VocabItem[]>([...vocabSet.items]);
  const [isRandomized, setIsRandomized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [session, setSession] = useState<GameSession | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [gameResult, setGameResult] = useState<{ score: number; correct: number; incorrect: number } | null>(null);
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<LeaderboardPeriod>('week');
  const [leaderboardClassId, setLeaderboardClassId] = useState('');
  const [leaderboardSessions, setLeaderboardSessions] = useState<GameSession[]>([]);

  // Load initial game if requested
  useEffect(() => {
    if (initialGameId) {
      const g = VISIBLE_GAMES_LIST.find(game => game.gameId === initialGameId);
      if (g) setSelectedGame(g);
    } else {
      setSelectedGame(VISIBLE_GAMES_LIST[0]); // Default to first visible game
    }
  }, [initialGameId]);

  useEffect(() => {
    if (!propStudentName) return;
    setStudentName(propStudentName);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STUDENT_NAME_STORAGE_KEY, propStudentName);
      } catch {
        // Ignore storage errors so learning can continue.
      }
    }
    setNameSubmitted(true);
  }, [propStudentName]);

  useEffect(() => {
    let isMounted = true;

    const loadLeaderboard = async () => {
      try {
        const res = await fetch('/api/public/results');
        if (!res.ok) throw new Error('Public results API failed');
        const data = await res.json();
        if (isMounted) setLeaderboardSessions(Array.isArray(data) ? data : []);
      } catch (err) {
        console.warn('Public results API unreachable, falling back to direct Firestore query:', err);
        try {
          const { collection, getDocs } = await import('firebase/firestore');
          const { db } = await import('../../lib/firebase');
          const [querySnapshot, assignmentsSnapshot, classesSnapshot, membersSnapshot] = await Promise.all([
            getDocs(collection(db, 'game_sessions')),
            getDocs(collection(db, 'assignments')),
            getDocs(collection(db, 'classes')),
            getDocs(collection(db, 'class_members'))
          ]);
          const classesById = new Map<string, Class>();
          classesSnapshot.forEach((docSnap) => {
            const data = { id: docSnap.id, ...docSnap.data() } as Class;
            classesById.set(data.id, data);
          });

          const assignmentsById = new Map<string, Assignment>();
          const uniqueAssignmentClassByVocabSet = new Map<string, { classId: string; className: string } | null>();
          assignmentsSnapshot.forEach((docSnap) => {
            const data = { id: docSnap.id, ...docSnap.data() } as Assignment;
            assignmentsById.set(docSnap.id, data);
            if (data.id) assignmentsById.set(data.id, data);
            setUniqueClass(uniqueAssignmentClassByVocabSet, data.vocabSetId, {
              classId: data.classId,
              className: data.className || classesById.get(data.classId)?.name || ''
            });
          });

          const uniqueMemberClassByName = new Map<string, { classId: string; className: string } | null>();
          membersSnapshot.forEach((docSnap) => {
            const data = { id: docSnap.id, ...docSnap.data() } as ClassMember;
            setUniqueClass(uniqueMemberClassByName, normalizePersonName(data.studentName), {
              classId: data.classId,
              className: classesById.get(data.classId)?.name || ''
            });
          });

          const list: GameSession[] = [];
          querySnapshot.forEach((docSnap) => {
            const data = docSnap.data() as any;
            if (data.completedAt) {
              const assignment = data.assignmentId ? assignmentsById.get(data.assignmentId) : null;
              const assignmentClass = assignment ? {
                classId: assignment.classId,
                className: assignment.className || classesById.get(assignment.classId)?.name || ''
              } : null;
              const vocabSetClass = uniqueAssignmentClassByVocabSet.get(data.vocabSetId) || null;
              const currentLessonClass = data.vocabSetId === vocabSet.id && vocabSet.gradeLevel
                ? { classId: getLessonGradeClassId(vocabSet) || '', className: vocabSet.gradeLevel }
                : null;
              const memberClass = uniqueMemberClassByName.get(normalizePersonName(data.studentName)) || null;
              const resolvedClass = data.classId
                ? {
                    classId: data.classId,
                    className: data.className || classesById.get(data.classId)?.name || ''
                  }
                : assignmentClass?.classId
                  ? assignmentClass
                  : vocabSetClass?.classId
                    ? vocabSetClass
                    : currentLessonClass?.classId
                      ? currentLessonClass
                      : memberClass?.classId
                        ? memberClass
                        : { classId: '', className: '' };

              list.push({
                id: docSnap.id,
                ...data,
                classId: resolvedClass.classId,
                className: resolvedClass.className
              } as GameSession);
            }
          });
          if (isMounted) setLeaderboardSessions(list);
        } catch (firestoreErr) {
          console.error('Direct Firestore public leaderboard fetch failed:', firestoreErr);
        }
      }
    };

    loadLeaderboard();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmitName = () => {
    const normalizedName = studentName.trim();
    if (!normalizedName) return;

    setStudentName(normalizedName);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STUDENT_NAME_STORAGE_KEY, normalizedName);
      } catch {
        // Ignore storage errors so learning can continue.
      }
    }
    setNameSubmitted(true);
  };

  // Set up student session on game select
  useEffect(() => {
    if (!selectedGame || !nameSubmitted || !studentName) return;

    setGameResult(null);

    // Create a new session on the server
    fetch('/api/game-sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        assignmentId,
        vocabSetId: vocabSet.id,
        vocabSetTitle: vocabSet.title,
        gameId: selectedGame.gameId,
        gameName: selectedGame.title,
        gameType: selectedGame.category,
        studentName: studentName,
        studentId: guestId,
        guestId,
        classId: assignmentClassId || vocabSet.classId || getLessonGradeClassId(vocabSet),
        className: assignmentClassName || vocabSet.className || vocabSet.gradeLevel || undefined
      })
    })
    .then(res => {
      if (!res.ok) throw new Error("Backend game-sessions API failed");
      return res.json();
    })
    .then(data => {
      setSession(data);
    })
    .catch(async (err) => {
      console.warn("Backend starting game session failed, falling back to direct Firestore Client-side creation:", err);
      try {
        const { doc, setDoc } = await import('firebase/firestore');
        const { db } = await import('../../lib/firebase');
        const sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const startedAt = new Date().toISOString();
        const sessionData = {
          id: sessionId,
          assignmentId: assignmentId || null,
          vocabSetId: vocabSet.id,
          vocabSetTitle: vocabSet.title,
          gameId: selectedGame.gameId,
          gameName: selectedGame.title,
          gameType: selectedGame.category,
          studentName: studentName,
          studentId: guestId,
          guestId,
          classId: assignmentClassId || vocabSet.classId || getLessonGradeClassId(vocabSet) || '',
          className: assignmentClassName || vocabSet.className || vocabSet.gradeLevel || '',
          score: 0,
          totalQuestions: 0,
          correctAnswers: 0,
          incorrectAnswers: 0,
          startedAt,
          createdAt: startedAt,
          status: 'started'
        };
        await setDoc(doc(db, 'game_sessions', sessionId), sessionData);
        setSession(sessionData);
        console.log("Game session created directly in Firestore via Client SDK:", sessionId);
      } catch (firestoreErr) {
        console.error("Direct Firestore game session creation failed:", firestoreErr);
      }
    });
  }, [selectedGame, nameSubmitted, studentName, guestId, vocabSet, assignmentId, assignmentClassId, assignmentClassName, token]);

  const handleShuffle = () => {
    if (isRandomized) {
      // Revert to original order
      setActiveItems([...vocabSet.items].sort((a, b) => a.displayOrder - b.displayOrder));
    } else {
      // Shuffle
      setActiveItems([...vocabSet.items].sort(() => Math.random() - 0.5));
    }
    setIsRandomized(!isRandomized);
  };

  const handleToggleFullscreen = () => {
    const element = document.getElementById('game-stage');
    if (!element) return;

    if (!document.fullscreenElement) {
      element.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(err => console.error("Error enabling fullscreen:", err));
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Synchronize fullscreen state (e.g. if exited via Escape)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const handleGameComplete = (score: number, correct: number, incorrect: number, details?: GameCompletionDetails) => {
    setGameResult({ score, correct, incorrect });

    if (!session) return;

    const endedAt = new Date().toISOString();
    const startedAtMs = session.startedAt ? new Date(session.startedAt).getTime() : Date.now();
    const durationMs = Math.max(0, new Date(endedAt).getTime() - startedAtMs);
    const totalQuestions = correct + incorrect;
    const accuracy = totalQuestions > 0 ? Math.round((correct / totalQuestions) * 100) : 0;
    const answerDetails = (details?.answerDetails || []).slice(0, 200).map(detail => ({
      questionIndex: detail.questionIndex,
      wordId: detail.wordId,
      word: detail.word,
      questionText: detail.questionText,
      correctAnswer: detail.correctAnswer,
      userAnswer: detail.userAnswer,
      selectedAnswer: detail.selectedAnswer,
      isCorrect: Boolean(detail.isCorrect),
      timeSpentMs: detail.timeSpentMs,
      options: detail.options?.slice(0, 6)
    }));

    const completedSession: GameSession = {
      ...session,
      score,
      totalQuestions,
      correctAnswers: correct,
      incorrectAnswers: incorrect,
      endedAt,
      completedAt: endedAt,
      expiresAt: addDaysIso(endedAt, ACTIVITY_TTL_DAYS),
      durationMs,
      durationSeconds: Math.round(durationMs / 1000),
      accuracy,
      answerDetails
    };

    setLeaderboardSessions(prev => {
      const withoutCurrent = prev.filter(item => item.id !== completedSession.id);
      return [completedSession, ...withoutCurrent];
    });

    // Update session stats on the server
    fetch(`/api/game-sessions/${session.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({
        score,
        totalQuestions,
        correctAnswers: correct,
        incorrectAnswers: incorrect,
        endedAt,
        expiresAt: completedSession.expiresAt,
        durationMs,
        durationSeconds: Math.round(durationMs / 1000),
        accuracy,
        answerDetails
      })
    })
    .then(res => {
      if (!res.ok) throw new Error("Backend game-sessions complete API failed");
      return res.json();
    })
    .then(data => {
      setSession(data);
    })
    .catch(async (err) => {
      console.warn("Backend updating game session failed, falling back to direct Firestore Client-side update:", err);
      try {
        const { doc, updateDoc } = await import('firebase/firestore');
        const { db } = await import('../../lib/firebase');
        const sessionRef = doc(db, 'game_sessions', session.id);
        const updatedData = {
          score,
          totalQuestions,
          correctAnswers: correct,
          incorrectAnswers: incorrect,
          completedAt: completedSession.completedAt,
          endedAt,
          expiresAt: completedSession.expiresAt,
          durationMs,
          durationSeconds: Math.round(durationMs / 1000),
          accuracy,
          answerDetails,
          status: 'completed'
        };
        await updateDoc(sessionRef, updatedData);
        setSession({ ...session, ...updatedData });
        console.log("Game session updated directly in Firestore via Client SDK:", session.id);
      } catch (firestoreErr) {
        console.error("Direct Firestore game session update failed:", firestoreErr);
      }
    });
  };

  const playTermSound = (term: string) => {
    if (!isMuted) {
      speakEnglish(term);
    }
  };

  const learningLeaderboard = useMemo<LeaderboardEntry[]>(() => {
    return buildLeaderboard(leaderboardSessions, [], {
      period: leaderboardPeriod,
      classId: leaderboardClassId || undefined
    }).gold.slice(0, 8);
  }, [leaderboardSessions, leaderboardPeriod, leaderboardClassId]);

  const leaderboardClassOptions = useMemo(() => {
    const byId = new Map<string, string>();
    leaderboardSessions.forEach(session => {
      if (!session.classId || !session.className) return;
      byId.set(session.classId, compactClassName(session.className));
    });
    return [...byId.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }, [leaderboardSessions]);

  useEffect(() => {
    if (!leaderboardClassId) return;
    if (!leaderboardClassOptions.some(option => option.id === leaderboardClassId)) {
      setLeaderboardClassId('');
    }
  }, [leaderboardClassId, leaderboardClassOptions]);

  // Render game in focus
  const renderActiveGame = () => {
    if (!selectedGame) return null;

    const gameProps = {
      items: activeItems,
      config: selectedGame.config,
      onComplete: handleGameComplete,
      isMuted,
      setIsMuted,
      isRandomized,
      onToggleRandom: handleShuffle,
      isFullscreen,
      onToggleFullscreen: handleToggleFullscreen
    };

    switch (selectedGame.componentName) {
      case 'FlashcardGame':
        return (
          <React.Fragment key={selectedGame.gameId}>
            <FlashcardGame {...gameProps} />
          </React.Fragment>
        );
      case 'QuizGame':
        return (
          <React.Fragment key={selectedGame.gameId}>
            <QuizGame {...gameProps} />
          </React.Fragment>
        );
      case 'FillBlankGame':
        return (
          <React.Fragment key={selectedGame.gameId}>
            <FillBlankGame {...gameProps} />
          </React.Fragment>
        );
      case 'MatchingGame':
        return (
          <React.Fragment key={selectedGame.gameId}>
            <MatchingGame {...gameProps} />
          </React.Fragment>
        );
      case 'MemoryGame':
        return (
          <React.Fragment key={selectedGame.gameId}>
            <MemoryGame {...gameProps} />
          </React.Fragment>
        );
      case 'MillionaireGame':
        return (
          <React.Fragment key={selectedGame.gameId}>
            <MillionaireGame {...gameProps} />
          </React.Fragment>
        );
      case 'SpeakingAIGame':
        return (
          <React.Fragment key={selectedGame.gameId}>
            <SpeakingAIGame
              {...gameProps}
              studentId={guestId}
              studentName={studentName}
              vocabularySetId={vocabSet.id}
              gameSessionId={session?.id}
              authToken={token}
            />
          </React.Fragment>
        );
      default:
        return (
          <div className="p-8 text-center text-gray-500 bg-white rounded-2xl border border-gray-100">
            <p>Game mode này đang được phát triển.</p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 pb-16" id="student-area-root">
      {/* Upper Navigation Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 py-4 shadow-xs" id="student-header">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <button 
            onClick={onBack}
            className="flex items-center space-x-2 text-gray-600 hover:text-indigo-600 font-semibold text-sm transition-all bg-gray-50 hover:bg-indigo-50 p-2.5 px-4 rounded-xl cursor-pointer border border-gray-100"
            id="back-to-menu-btn"
          >
            <ArrowLeft size={16} />
            <span>Thoát ra</span>
          </button>

          <div className="text-center hidden md:block">
            <span className="text-xs font-bold text-indigo-500 uppercase tracking-widest">HỌC TỪ VỰNG TIẾNG ANH</span>
            <h1 className="text-lg font-black text-gray-800 leading-tight">{vocabSet.title}</h1>
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2 bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1.5 rounded-xl text-xs font-bold">
              <User size={14} />
              <span>Học sinh: {studentName || 'Chưa đặt tên'}</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 mt-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side: Game Stage and Word Lists */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* Ask for Name if not submitted */}
          {!nameSubmitted ? (
            <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-xl text-center space-y-6" id="name-prompt-container">
              <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto">
                <BookOpen size={32} />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-black text-gray-800">Bắt đầu học từ vựng!</h2>
                <p className="text-gray-500 text-sm max-w-sm mx-auto">
                  Hãy nhập tên của em để lưu điểm, làm bài tập thầy cô giao và theo dõi kết quả nhé.
                </p>
              </div>

              <div className="max-w-sm mx-auto flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  placeholder="Nhập họ và tên của em..."
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSubmitName();
                  }}
                  className="flex-1 p-4 border-2 border-gray-200 rounded-2xl font-semibold outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-center text-lg"
                  id="student-name-input"
                />
                <button
                  onClick={handleSubmitName}
                  disabled={!studentName.trim()}
                  className="py-4 px-8 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-extrabold rounded-2xl transition-all shadow-md active:scale-95 cursor-pointer text-lg whitespace-nowrap"
                  id="submit-name-btn"
                >
                  Bắt đầu chơi
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Main Active Gameplay Area Container */}
              <div 
                id="game-stage"
                className={`bg-white rounded-3xl p-6 md:p-8 border border-gray-100 shadow-xl transition-all duration-300 relative ${
                  isFullscreen ? 'fixed inset-0 z-50 overflow-y-auto flex flex-col justify-center max-w-none rounded-none' : ''
                }`}
              >
                {/* Active Game Utilities Bar */}
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
                  <div className="flex items-center space-x-3">
                    <span className={`game-icon ${selectedGame?.category || 'flashcard'}`}>
                      <Sparkles size={18} />
                    </span>
                    <div>
                      <h2 className="font-black text-gray-800 text-base md:text-lg">
                        {selectedGame?.title}
                      </h2>
                      <p className="text-xs text-gray-400 font-medium hidden sm:block">
                        {selectedGame?.description}
                      </p>
                    </div>
                  </div>

                  {/* Top Game Options (Sound, Shuffle, Fullscreen) */}
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => setIsMuted(!isMuted)}
                      className={`p-2 rounded-xl transition-all border cursor-pointer ${
                        !isMuted
                          ? 'bg-emerald-100 border-emerald-300 text-slate-950 ring-2 ring-emerald-200'
                          : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                      }`}
                      title={isMuted ? "Bật âm thanh" : "Tắt âm thanh"}
                      id="mute-toggle"
                    >
                      <Volume2 size={18} className={isMuted ? 'opacity-40' : ''} />
                    </button>

                    <button
                      onClick={handleShuffle}
                      className={`p-2 rounded-xl transition-all border cursor-pointer ${
                        isRandomized 
                          ? 'bg-emerald-100 border-emerald-300 text-slate-950 ring-2 ring-emerald-200'
                          : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                      }`}
                      title="Trộn từ vựng"
                      id="shuffle-toggle"
                    >
                      <Shuffle size={18} />
                    </button>

                    <button
                      onClick={handleToggleFullscreen}
                      className={`p-2 rounded-xl transition-all border cursor-pointer ${
                        isFullscreen
                          ? 'bg-emerald-100 border-emerald-300 text-slate-950 ring-2 ring-emerald-200'
                          : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                      }`}
                      title="Toàn màn hình"
                      id="fullscreen-toggle"
                    >
                      <Maximize2 size={18} />
                    </button>
                  </div>
                </div>

                {/* Render game area */}
                <div className="relative" id="active-game-viewport">
                  {renderActiveGame()}
                </div>

                {/* Score Summary Modal overlay after complete */}
                {gameResult && (
                  <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md rounded-3xl z-10 flex flex-col items-center justify-center p-6 text-center space-y-6 border border-white/10" id="score-summary-overlay">
                    <div className="w-24 h-24 bg-amber-300/15 text-amber-200 rounded-full flex items-center justify-center animate-pulse border border-amber-300/30 shadow-2xl shadow-amber-500/10">
                      <Award size={54} />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-3xl font-black text-white">Hoàn thành bài học!</h3>
                      <p className="text-slate-300 text-sm max-w-xs mx-auto leading-relaxed">
                        Điểm số của em đã được ghi nhận thành công trên hệ thống của giáo viên.
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-4 bg-white/8 border border-white/15 rounded-2xl p-4 px-5 w-full max-w-sm shadow-xl">
                      <div className="text-center">
                        <span className="text-xs font-bold text-slate-300 block">ĐIỂM</span>
                        <span className="text-2xl font-black text-emerald-300">{gameResult.score}</span>
                      </div>
                      <div className="text-center">
                        <span className="text-xs font-bold text-slate-300 block">ĐÚNG</span>
                        <span className="text-2xl font-black text-sky-300">{gameResult.correct}</span>
                      </div>
                      <div className="text-center">
                        <span className="text-xs font-bold text-slate-300 block">SAI</span>
                        <span className="text-2xl font-black text-rose-300">{gameResult.incorrect}</span>
                      </div>
                    </div>

                    <div className="flex space-x-3">
                      <button
                        onClick={() => setGameResult(null)}
                        className="py-3 px-6 bg-white hover:bg-emerald-50 text-slate-950 border border-emerald-300 font-bold rounded-xl transition-all cursor-pointer text-sm"
                        id="retry-overlay-btn"
                      >
                        Chơi lại
                      </button>
                      <button
                        onClick={() => {
                          const nextGameIdx = (VISIBLE_GAMES_LIST.findIndex(g => g.gameId === selectedGame?.gameId) + 1) % VISIBLE_GAMES_LIST.length;
                          setSelectedGame(VISIBLE_GAMES_LIST[nextGameIdx]);
                        }}
                        className="py-3 px-6 bg-indigo-600 hover:bg-indigo-700 text-white border border-blue-700 font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20 cursor-pointer text-sm"
                        id="next-game-overlay-btn"
                      >
                        Chuyển Game tiếp theo
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <section
                className="bg-white rounded-3xl p-6 md:p-8 border border-amber-200 shadow-xl space-y-5"
                id="learning-golden-board"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shadow-sm">
                      <Trophy size={24} />
                    </div>
                    <div>
                      <h3 className="font-black text-gray-900 text-lg">Bảng vàng học sinh</h3>
                      <p className="text-xs text-gray-500 font-semibold">
                        X&#7871;p h&#7841;ng theo t&#7893;ng k&#7871;t qu&#7843; luy&#7879;n t&#7853;p.
                      </p>
                      <p className="hidden">
                        Xếp hạng theo kết quả tốt nhất trong bộ từ này.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <select
                    value={leaderboardPeriod}
                    onChange={(e) => setLeaderboardPeriod(e.target.value as LeaderboardPeriod)}
                    className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-800 outline-none"
                    id="learning-golden-period"
                  >
                    <option value="week">Tuần này</option>
                    <option value="month">Tháng này</option>
                  </select>
                  <select
                    value={leaderboardClassId}
                    onChange={(e) => setLeaderboardClassId(e.target.value)}
                    className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-800 outline-none"
                    id="learning-golden-class-filter"
                  >
                    <option value="">T&#7845;t c&#7843; l&#7899;p</option>
                    {leaderboardClassOptions.map(option => (
                      <option key={option.id} value={option.id}>{option.name}</option>
                    ))}
                  </select>
                  </div>
                </div>

                {learningLeaderboard.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-amber-200 bg-amber-50/60 px-4 py-8 text-center">
                    <Award className="mx-auto text-amber-500" size={30} />
                    <p className="mt-3 text-sm font-bold text-gray-700">
                      Ch&#432;a c&#243; k&#7871;t qu&#7843; luy&#7879;n t&#7853;p n&#224;o.
                    </p>
                    <p className="hidden">
                      Chưa có kết quả nào cho bộ từ này.
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Hoàn thành một game để xuất hiện trên bảng vàng.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {learningLeaderboard.slice(0, 3).map((entry, index) => (
                        <div
                          key={`podium-${entry.studentKey || entry.studentName}-${index}`}
                          className={`learning-podium-card rounded-2xl border p-4 text-center shadow-sm ${
                            index === 0
                              ? 'bg-amber-50 border-amber-300 text-amber-800'
                              : index === 1
                                ? 'bg-blue-50 border-blue-300 text-blue-800'
                                : 'bg-orange-50 border-orange-300 text-orange-800'
                          }`}
                        >
                          <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-white border border-current/25 text-sm font-black">
                            {index + 1}
                          </div>
                          <p className="mt-2 truncate text-sm font-black text-gray-900">{formatLeaderboardStudentName(entry)}</p>
                          <p className="text-xs font-black text-amber-700">{entry.honorScore} điểm</p>
                          <p className="mt-1 text-[11px] font-semibold text-gray-500">
                            {entry.averageAccuracy}% đúng
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2" id="learning-golden-list">
                      {learningLeaderboard.map((entry, index) => (
                        <div
                          key={`${entry.studentKey || entry.studentName}-${index}`}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-amber-100 bg-white px-4 py-3 shadow-sm"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-50 border border-amber-200 text-xs font-black text-amber-700">
                              {index + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-extrabold text-gray-900">{formatLeaderboardStudentName(entry)}</p>
                              <p className="text-[11px] font-semibold text-gray-500">
                                {entry.completedLessons} game • {entry.averageAccuracy}% đúng • {entry.studyDays} ngày
                              </p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-black text-amber-700">{entry.honorScore}</p>
                            <p className="text-[10px] font-bold text-gray-400">điểm</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>

            </>
          )}
        </div>

        {/* Right Side: Game Modes Selector Panel */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-xl" id="games-catalogue-sidebar">
            <div className="flex items-center space-x-2 mb-6 pb-4 border-b border-gray-100">
              <Award className="text-indigo-600 animate-pulse" size={20} />
              <h3 className="font-extrabold text-gray-800 text-base md:text-lg">Các trò chơi học từ</h3>
            </div>

            {/* List Game Templates grouped by category */}
            <div className="space-y-6" id="games-grouped-list">
              {GAME_CATEGORY_ORDER.map(category => {
                const categoryGames = VISIBLE_GAMES_LIST.filter(g => g.category === category);

                return (
                  <div key={category} className="space-y-2">
                    <h4 className={`game-category-label ${category}`}>
                      {GAME_CATEGORY_TITLES[category]}
                    </h4>
                    
                    <div className="grid grid-cols-1 gap-2">
                      {categoryGames.map(game => {
                        const isActive = selectedGame?.gameId === game.gameId;

                        return (
                          <button
                            key={game.gameId}
                            onClick={() => {
                              if (nameSubmitted) {
                                setSelectedGame(game);
                              } else {
                                // Direct to focus name prompt
                                const element = document.getElementById('student-name-input');
                                element?.focus();
                              }
                            }}
                            className={`game-card ${game.category} ${isActive ? 'active selected' : ''}`}
                            id={`sidebar-game-btn-${game.gameId}`}
                          >
                            <span className={`game-icon ${game.category}`}>
                              <BookOpen size={16} />
                            </span>
                            <div className="space-y-0.5">
                              <span className="game-card-title">
                                {game.title}
                              </span>
                              <span className={`game-card-badge ${game.category}`}>
                                {game.category} game
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
