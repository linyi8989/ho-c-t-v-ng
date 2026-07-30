import React, { useState, useEffect } from 'react';
import { 
  BookOpen, Users, Award, Play, ShieldAlert, Sparkles, UserCheck, 
  ArrowRight, Key, HelpCircle, ChevronRight, GraduationCap, Star, Search, LogOut, Shield, FileText, History
} from 'lucide-react';
import { VocabSet, Class, Assignment, GameSession, GrammarSet } from './types';
import AdminDashboard from './components/admin/AdminDashboard';
import StudentLearningArea from './components/games/StudentLearningArea';
import GrammarLearningArea from './components/grammar/GrammarLearningArea';
import StudentHistoryPage from './components/history/StudentHistoryPage';
import { useAuth } from './context/AuthContext';
import Login from './components/Login';
import Register from './components/Register';
import { buildLeaderboard, LeaderboardPeriod } from './lib/leaderboard';

const DEFAULT_GRADE_OPTIONS = ['Lớp 3', 'Lớp 6', 'Lớp 10'];
const LEARNING_HISTORY_UI_ENABLED = import.meta.env.VITE_LEARNING_HISTORY_ENABLED === 'true';

function formatGradeLabel(value?: string) {
  return (value || '')
    .replace(/Lá»›p/g, 'Lớp')
    .replace(/LÃ¡Â»â€ºp/g, 'Lớp');
}

const WEEKLY_LEARNING_QUOTES = [
  { text: 'Education is the most powerful weapon which you can use to change the world.', author: 'Nelson Mandela' },
  { text: 'The beautiful thing about learning is nobody can take it away from you.', author: 'B.B. King' },
  { text: 'Live as if you were to die tomorrow. Learn as if you were to live forever.', author: 'Mahatma Gandhi' },
  { text: 'Wisdom is not a product of schooling but of the lifelong attempt to acquire it.', author: 'Albert Einstein' },
  { text: 'I am always ready to learn although I do not always like being taught.', author: 'Winston Churchill' },
  { text: 'Develop a passion for learning. If you do, you will never cease to grow.', author: "Anthony J. D'Angelo" },
  { text: 'You do not understand anything until you learn it more than one way.', author: 'Marvin Minsky' },
  { text: 'Change is the end result of all true learning.', author: 'Leo Buscaglia' },
  { text: 'Anyone who stops learning is old, whether at twenty or eighty. Anyone who keeps learning stays young.', author: 'Henry Ford' },
  { text: 'Study hard what interests you the most in the most undisciplined, irreverent and original manner possible.', author: 'Richard Feynman' },
  { text: 'I am still learning.', author: 'Michelangelo' },
  { text: 'An investment in knowledge pays the best interest.', author: 'Benjamin Franklin' },
  { text: 'Education is the passport to the future, for tomorrow belongs to those who prepare for it today.', author: 'Malcolm X' },
  { text: 'Leadership and learning are indispensable to each other.', author: 'John F. Kennedy' },
  { text: 'The more that you read, the more things you will know. The more that you learn, the more places you will go.', author: 'Dr. Seuss' },
  { text: 'Learning is not attained by chance. It must be sought for with ardour and attended with diligence.', author: 'Abigail Adams' },
  { text: 'The expert in anything was once a beginner.', author: 'Helen Hayes' },
  { text: 'The purpose of education is to replace an empty mind with an open one.', author: 'Malcolm Forbes' },
  { text: 'What we learn with pleasure we never forget.', author: 'Alfred Mercier' },
  { text: 'Never let formal education get in the way of your learning.', author: 'Mark Twain' },
  { text: 'Learning is not the product of teaching. Learning is the product of the activity of learners.', author: 'John Holt' },
  { text: 'While we teach, we learn.', author: 'Seneca' },
  { text: 'For the things we have to learn before we can do them, we learn by doing them.', author: 'Aristotle' },
  { text: 'One child, one teacher, one book, one pen can change the world.', author: 'Malala Yousafzai' },
  { text: 'Once you learn to read, you will be forever free.', author: 'Frederick Douglass' },
  { text: 'Real knowledge is to know the extent of one’s ignorance.', author: 'Confucius' },
  { text: 'Knowing others is intelligence; knowing yourself is true wisdom.', author: 'Lao Tzu' },
  { text: 'Curiosity is the engine of achievement.', author: 'Sir Ken Robinson' },
  { text: 'Success is the sum of small efforts, repeated day in and day out.', author: 'Robert Collier' },
  { text: 'Learning never exhausts the mind.', author: 'Leonardo da Vinci' },
  { text: 'Education is not preparation for life; education is life itself.', author: 'John Dewey' },
  { text: 'When you know better, you do better.', author: 'Maya Angelou' },
  { text: 'Learning is a treasure that will follow its owner everywhere.', author: 'Chinese proverb' }
];

function getWeeklyLearningQuote() {
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const daysSinceYearStart = Math.floor((now.getTime() - yearStart.getTime()) / 86400000);
  const weekNumber = Math.floor((daysSinceYearStart + yearStart.getDay()) / 7);
  const stableWeeklyIndex = Math.abs((now.getFullYear() * 53 + weekNumber) * 17) % WEEKLY_LEARNING_QUOTES.length;
  return WEEKLY_LEARNING_QUOTES[stableWeeklyIndex];
}

export default function App() {
  const { user, token, logout, loading } = useAuth();
  const [adminMode, setAdminMode] = useState(false);
  const [studentHistoryOpen, setStudentHistoryOpen] = useState(() => (
    LEARNING_HISTORY_UI_ENABLED
    && (window.location.pathname.replace(/\/+$/, '') || '/') === '/history'
  ));
  const privateAssignmentToken = React.useMemo(() => {
    const match = window.location.pathname.match(/^\/(?:assignment|vocabulary\/private)\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  }, []);
  const privateGrammarToken = React.useMemo(() => {
    const match = window.location.pathname.match(/^\/grammar\/private\/([^/?#]+)/);
    return match ? decodeURIComponent(match[1]) : '';
  }, []);
  const authRoute = React.useMemo(() => {
    const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
    if (pathname === '/reg' || pathname === '/register') return 'register';
    if (pathname === '/login' || pathname === '/admin') return 'login';
    return '';
  }, []);

  const [vocabSets, setVocabSets] = useState<VocabSet[]>([]);
  const [grammarSets, setGrammarSets] = useState<GrammarSet[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [, setResults] = useState<GameSession[]>([]);
  const [leaderboardResults, setLeaderboardResults] = useState<GameSession[]>([]);
  const [privateAssignmentSet, setPrivateAssignmentSet] = useState<VocabSet | null>(null);
  const [privateAssignmentLoading, setPrivateAssignmentLoading] = useState(!!privateAssignmentToken);
  const [privateAssignmentError, setPrivateAssignmentError] = useState('');
  const [privateGrammarSet, setPrivateGrammarSet] = useState<GrammarSet | null>(null);
  const [privateGrammarLoading, setPrivateGrammarLoading] = useState(!!privateGrammarToken);
  const [privateGrammarError, setPrivateGrammarError] = useState('');

  // Search/Filter for homepage
  const [homeSearch, setHomeSearch] = useState('');
  const [homeGrade, setHomeGrade] = useState('');
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<LeaderboardPeriod>('week');

  // Active student playing state
  const [selectedSet, setSelectedSet] = useState<VocabSet | null>(null);
  const [selectedGrammarSet, setSelectedGrammarSet] = useState<GrammarSet | null>(null);
  const [studentName, setStudentName] = useState('');
  const [activeAssignmentId, setActiveAssignmentId] = useState<string | undefined>(undefined);
  const [activeGameId, setActiveGameId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!LEARNING_HISTORY_UI_ENABLED) {
      const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
      if (pathname === '/history') {
        window.history.replaceState({ studentScreen: 'home' }, '', '/');
      }
      return;
    }
    const syncStudentScreenFromPath = () => {
      const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
      setStudentHistoryOpen(pathname === '/history');
    };
    window.addEventListener('popstate', syncStudentScreenFromPath);
    return () => window.removeEventListener('popstate', syncStudentScreenFromPath);
  }, []);

  const navigateToStudentHistory = React.useCallback((open: boolean) => {
    if (!LEARNING_HISTORY_UI_ENABLED) return;
    const nextPath = open ? '/history' : '/';
    const currentPath = window.location.pathname.replace(/\/+$/, '') || '/';
    if (currentPath !== nextPath) {
      window.history.pushState(
        open ? { studentScreen: 'history' } : { studentScreen: 'home' },
        '',
        nextPath
      );
    }
    setStudentHistoryOpen(open);
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  const homeGradeOptions = React.useMemo(() => {
    return Array.from(new Set([
      ...DEFAULT_GRADE_OPTIONS,
      ...classes.map(cls => cls.name).filter(Boolean),
      ...vocabSets.map(set => set.gradeLevel).filter(Boolean)
    ]));
  }, [classes, vocabSets]);

  const homeLeaderboard = React.useMemo(() => {
    return buildLeaderboard(leaderboardResults, assignments, { period: leaderboardPeriod }).gold.slice(0, 5);
  }, [leaderboardResults, assignments, leaderboardPeriod]);
  const weeklyLearningQuote = React.useMemo(() => getWeeklyLearningQuote(), []);

  // Load data on mount or token change. Guests only receive public study data.
  const loadHomeData = async () => {
    if (!token) {
      setClasses([]);
      setAssignments([]);
      setGrammarSets([]);

      try {
        const res = await fetch('/api/public/vocab-sets');
        if (!res.ok) throw new Error("Public vocab API response error");
        const data = await res.json();
        setVocabSets(Array.isArray(data) ? data : []);
      } catch (err) {
        console.warn("Backend /api/public/vocab-sets API unreachable:", err);
        setVocabSets([]);
      }

      try {
        const res = await fetch('/api/public/grammar-sets');
        if (!res.ok) throw new Error("Public grammar API response error");
        const data = await res.json();
        setGrammarSets(Array.isArray(data) ? data : []);
      } catch (err) {
        console.warn("Backend /api/public/grammar-sets API unreachable:", err);
        setGrammarSets([]);
      }

      try {
        const res = await fetch('/api/public/results');
        if (!res.ok) throw new Error("Public results API response error");
        const data = await res.json();
        const fallbackResults = Array.isArray(data) ? data : [];
        setResults(fallbackResults);
        setLeaderboardResults(fallbackResults);
      } catch (err) {
        console.warn("Backend /api/public/results API unreachable:", err);
        setResults([]);
        setLeaderboardResults([]);
      }

      try {
        const res = await fetch('/api/public/leaderboard-results');
        if (!res.ok) throw new Error("Public leaderboard API response error");
        const data = await res.json();
        setLeaderboardResults(Array.isArray(data) ? data : []);
      } catch (err) {
        console.warn("Backend /api/public/leaderboard-results API unreachable, falling back to recent results:", err);
      }

      return;
    }

    // Load Grammar Sets
    try {
      const res = await fetch('/api/grammar-sets', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Grammar API response error");
      const data = await res.json();
      setGrammarSets(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn("Backend /api/grammar-sets API unreachable:", err);
      setGrammarSets([]);
    }

    // Load Vocabulary Sets
    try {
      const res = await fetch('/api/vocab-sets', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("API response error");
      const data = await res.json();
      setVocabSets(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn("Backend /api/vocab-sets API unreachable, falling back to direct Firestore Client-side query:", err);
      try {
        const { collection, getDocs } = await import('firebase/firestore');
        const { db } = await import('./lib/firebase');
        const querySnapshot = await getDocs(collection(db, 'vocab_sets'));
        const setsList: VocabSet[] = [];
        querySnapshot.forEach((docSnap) => {
          setsList.push({ id: docSnap.id, ...docSnap.data() } as any);
        });
        setVocabSets(setsList);
      } catch (firestoreErr) {
        console.error("Direct Firestore vocab_sets fetch failed:", firestoreErr);
      }
    }

    // Load Assignments
    try {
      const res = await fetch('/api/assignments', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("API response error");
      const data = await res.json();
      setAssignments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn("Backend /api/assignments API unreachable, falling back to direct Firestore Client-side query:", err);
      try {
        const { collection, getDocs } = await import('firebase/firestore');
        const { db } = await import('./lib/firebase');
        const querySnapshot = await getDocs(collection(db, 'assignments'));
        const list: Assignment[] = [];
        querySnapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as any);
        });
        setAssignments(list);
      } catch (firestoreErr) {
        console.error("Direct Firestore assignments fetch failed:", firestoreErr);
      }
    }

    // Load Classes
    try {
      const res = await fetch('/api/classes', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("API response error");
      const data = await res.json();
      setClasses(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn("Backend /api/classes API unreachable, falling back to direct Firestore Client-side query:", err);
      try {
        const { collection, getDocs } = await import('firebase/firestore');
        const { db } = await import('./lib/firebase');
        const querySnapshot = await getDocs(collection(db, 'classes'));
        const list: Class[] = [];
        querySnapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as any);
        });
        setClasses(list);
      } catch (firestoreErr) {
        console.error("Direct Firestore classes fetch failed:", firestoreErr);
      }
    }

    // Load completed learning/game results for the student leaderboard
    try {
      const res = await fetch('/api/results', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("API response error");
      const data = await res.json();
      const fallbackResults = Array.isArray(data) ? data : [];
      setResults(fallbackResults);
      setLeaderboardResults(fallbackResults);
    } catch (err) {
      console.warn("Backend /api/results API unreachable, falling back to direct Firestore Client-side query:", err);
      try {
        const { collection, getDocs } = await import('firebase/firestore');
        const { db } = await import('./lib/firebase');
        const querySnapshot = await getDocs(collection(db, 'game_sessions'));
        const list: GameSession[] = [];
        querySnapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as any);
        });
        setResults(list);
        setLeaderboardResults(list);
      } catch (firestoreErr) {
        console.error("Direct Firestore game_sessions fetch failed:", firestoreErr);
      }
    }

    try {
      const res = await fetch('/api/leaderboard-results', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Leaderboard API response error");
      const data = await res.json();
      setLeaderboardResults(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn("Backend /api/leaderboard-results API unreachable, falling back to recent results:", err);
    }
  };

  useEffect(() => {
    if (!studentHistoryOpen) {
      void loadHomeData();
    }
  }, [token, user, studentHistoryOpen]);

  useEffect(() => {
    if (!privateAssignmentToken) return;

    setPrivateAssignmentLoading(true);
    setPrivateAssignmentError('');
    fetch(`/api/vocab-sets/share/${encodeURIComponent(privateAssignmentToken)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || 'Không tìm thấy bài tập hoặc link không hợp lệ');
        }
        setPrivateAssignmentSet(data);
      })
      .catch((err) => {
        setPrivateAssignmentSet(null);
        setPrivateAssignmentError(err.message || 'Không tìm thấy bài tập hoặc link không hợp lệ');
      })
      .finally(() => setPrivateAssignmentLoading(false));
  }, [privateAssignmentToken]);

  useEffect(() => {
    if (!privateGrammarToken) return;

    setPrivateGrammarLoading(true);
    setPrivateGrammarError('');
    fetch(`/api/grammar-sets/share/${encodeURIComponent(privateGrammarToken)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || 'Không tìm thấy bài ngữ pháp hoặc link không hợp lệ');
        }
        setPrivateGrammarSet(data);
      })
      .catch((err) => {
        setPrivateGrammarSet(null);
        setPrivateGrammarError(err.message || 'Không tìm thấy bài ngữ pháp hoặc link không hợp lệ');
      })
      .finally(() => setPrivateGrammarLoading(false));
  }, [privateGrammarToken]);

  const handleViewAsStudent = (set: VocabSet, gameId?: string, assignmentId?: string) => {
    setSelectedSet(set);
    setActiveGameId(gameId);
    setActiveAssignmentId(assignmentId);
    setStudentName(user?.name || 'Giáo viên (Học thử)');
    setAdminMode(true); // Switch to student view representation
  };

  const handleViewGrammarAsStudent = (set: GrammarSet) => {
    setSelectedGrammarSet(set);
    setAdminMode(true);
  };

  const normalizeSearchText = (value: string) => {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const expandSearchTerms = (query: string) => {
    const normalized = normalizeSearchText(query);
    if (!normalized) return [];

    const aliases: Record<string, string[]> = {
      'so dem': ['number', 'numbers', 'counting', 'cardinal', 'cardinal numbers', 'so'],
      number: ['so dem', 'so', 'numbers', 'counting', 'cardinal'],
      numbers: ['so dem', 'so', 'number', 'counting', 'cardinal'],
      counting: ['so dem', 'number', 'numbers', 'dem so'],
      'so thu tu': ['ordinal', 'ordinal numbers', 'order', 'sequence'],
      ordinal: ['so thu tu', 'ordinal numbers', 'order'],
      color: ['mau sac', 'colors', 'colour', 'colours'],
      colors: ['mau sac', 'color', 'colour', 'colours'],
      'mau sac': ['color', 'colors', 'colour', 'colours'],
      animal: ['dong vat', 'animals'],
      animals: ['dong vat', 'animal'],
      'dong vat': ['animal', 'animals'],
    };

    return Array.from(new Set([normalized, ...(aliases[normalized] || [])].map(normalizeSearchText)));
  };

  const getSetSearchCorpus = (set: VocabSet) => {
    const itemText = set.items
      .map(item => [
        item.term,
        item.meaning,
        item.ipa,
        item.pos,
        item.example,
        item.exampleMeaning,
        item.notes
      ].filter(Boolean).join(' '))
      .join(' ');

    return normalizeSearchText([
      set.title,
      set.description,
      set.subject,
      set.gradeLevel,
      set.creatorName,
      ...(set.tags || []),
      itemText
    ].filter(Boolean).join(' '));
  };

  // Filter public sets on home page
  const filteredSets = vocabSets.filter(set => {
    const searchTerms = expandSearchTerms(homeSearch);
    const searchableText = getSetSearchCorpus(set);
    const matchSearch = searchTerms.length === 0 || searchTerms.some(term => searchableText.includes(term));
    const matchGrade = homeGrade ? set.gradeLevel === homeGrade : true;
    const visibility = set.visibility || (set.status === 'private' ? 'assignment' : set.status);
    return visibility === 'public' && matchSearch && matchGrade;
  });

  const filteredGrammarSets = grammarSets.filter(set => {
    const searchTerms = expandSearchTerms(homeSearch);
    const searchableText = normalizeSearchText([
      set.title,
      set.description,
      set.subject,
      set.topic,
      set.gradeLevel,
      ...(set.tags || [])
    ].filter(Boolean).join(' '));
    const matchSearch = searchTerms.length === 0 || searchTerms.some(term => searchableText.includes(term));
    const matchGrade = homeGrade ? set.gradeLevel === homeGrade : true;
    return set.visibility === 'public' && matchSearch && matchGrade;
  });

  // --- SCREEN RENDERS ---

  // 1. Loading Screen
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
        <p className="text-gray-500 font-bold text-sm">Đang kết nối hệ thống Cô Diệu Tiếng Anh...</p>
      </div>
    );
  }

  if (authRoute === 'register') {
    return (
      <Register
        onNavigateToLogin={() => { window.location.href = '/login'; }}
        onNavigateToHome={() => { window.location.href = '/'; }}
      />
    );
  }

  if (authRoute === 'login') {
    return (
      <Login
        onNavigateToRegister={() => { window.location.href = '/reg'; }}
        onNavigateToHome={() => { window.location.href = '/'; }}
      />
    );
  }

  if (privateGrammarToken) {
    if (privateGrammarLoading) {
      return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mb-4"></div>
          <p className="text-gray-500 font-bold text-sm">Đang mở bài ngữ pháp...</p>
        </div>
      );
    }

    if (privateGrammarError || !privateGrammarSet) {
      return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
          <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-gray-100 shadow-xl space-y-5 text-center">
            <ShieldAlert size={40} className="text-rose-600 mx-auto" />
            <h1 className="text-xl font-black text-gray-900">Không tìm thấy bài ngữ pháp hoặc link không hợp lệ</h1>
            <p className="text-sm text-gray-500">Vui lòng kiểm tra lại đường link giáo viên đã gửi.</p>
            <button
              onClick={() => { window.location.href = '/'; }}
              className="w-full py-3 !bg-emerald-600 hover:!bg-emerald-700 !text-white font-bold text-sm rounded-2xl transition-all"
            >
              Về trang chủ
            </button>
          </div>
        </div>
      );
    }

    return (
      <GrammarLearningArea
        grammarSet={privateGrammarSet}
        accessToken={privateGrammarToken || undefined}
        onBack={() => { window.location.href = '/'; }}
      />
    );
  }

  if (privateAssignmentToken) {
    if (privateAssignmentLoading) {
      return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
          <p className="text-gray-500 font-bold text-sm">Đang mở bài tập...</p>
        </div>
      );
    }

    if (privateAssignmentError || !privateAssignmentSet) {
      return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
          <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-gray-100 shadow-xl space-y-5 text-center">
            <ShieldAlert size={40} className="text-rose-600 mx-auto" />
            <h1 className="text-xl font-black text-gray-900">Không tìm thấy bài tập hoặc link không hợp lệ</h1>
            <p className="text-sm text-gray-500">Vui lòng kiểm tra lại đường link giáo viên đã gửi.</p>
            <button
              onClick={() => { window.location.href = '/'; }}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-2xl transition-all"
            >
              Về trang chủ
            </button>
          </div>
        </div>
      );
    }

    return (
      <StudentLearningArea
        vocabSet={privateAssignmentSet}
        studentName=""
        assignmentId={privateAssignmentSet.assignmentId}
        assignmentClassId={privateAssignmentSet.classId}
        assignmentClassName={privateAssignmentSet.className}
        accessToken={privateAssignmentToken || undefined}
        accessType={privateAssignmentSet.accessType}
        initialGameId={privateAssignmentSet.assignmentGameId}
        onBack={() => { window.location.href = '/'; }}
      />
    );
  }

  // 3. Status Guard: User is Blocked
  if (user?.status === 'blocked') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4" id="blocked-screen">
        <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-gray-100 shadow-xl space-y-6 text-center">
          <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
            <ShieldAlert size={32} />
          </div>
          <h3 className="text-2xl font-black text-gray-900 tracking-tight">TÀI KHOẢN ĐÃ BỊ KHÓA</h3>
          <p className="text-sm text-gray-500 leading-relaxed">
            Tài khoản của bạn (<strong className="text-gray-700">{user.email || user.phone}</strong>) đã bị khóa hoặc tạm ngưng bởi Quản trị viên hệ thống. Vui lòng liên hệ ban quản trị để giải quyết.
          </p>
          <button
            onClick={() => logout()}
            className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-2xl transition-all shadow-md active:scale-98 cursor-pointer flex items-center justify-center space-x-2"
          >
            <LogOut size={16} />
            <span>Đăng xuất tài khoản</span>
          </button>
        </div>
      </div>
    );
  }

  // 4. ACTIVE GAME SCREEN
  if (selectedSet) {
    return (
      <StudentLearningArea
        vocabSet={selectedSet}
        studentName={studentName}
        assignmentId={activeAssignmentId}
        assignmentClassId={selectedSet.classId}
        assignmentClassName={selectedSet.className}
        initialGameId={activeGameId}
        onBack={() => {
          setSelectedSet(null);
          setActiveGameId(undefined);
          setActiveAssignmentId(undefined);
        }}
      />
    );
  }

  if (selectedGrammarSet) {
    return (
      <GrammarLearningArea
        grammarSet={selectedGrammarSet}
        onBack={() => setSelectedGrammarSet(null)}
      />
    );
  }

  if (LEARNING_HISTORY_UI_ENABLED && studentHistoryOpen) {
    return (
      <StudentHistoryPage
        authToken={token}
        onBack={() => navigateToStudentHistory(false)}
      />
    );
  }

  // 5. ADMIN/TEACHER DASHBOARD SCREEN
  // If user is teacher/super_admin and NOT in student simulated view mode
  const isStaff = user?.role === 'teacher' || user?.role === 'super_admin';
  if (isStaff && !adminMode) {
    return (
      <div className="relative">
        {/* Toggle bar back to student representation */}
        <div className="bg-amber-500/20 backdrop-blur-md border-b border-amber-500/30 text-amber-900 px-4 py-2 flex justify-between items-center text-xs font-bold shadow-sm" id="admin-mode-banner">
          <span>⚠️ Bạn đang ở giao diện Quản Trị ({user?.role === 'super_admin' ? 'Super Admin' : 'Giáo viên'})</span>
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => setAdminMode(true)}
              className="bg-amber-600 hover:bg-amber-700 text-white border-0 px-3 py-1.5 rounded-xl transition-all cursor-pointer font-bold text-[10px]"
              id="view-student-page-btn"
            >
              Xem trang học sinh
            </button>
            <button 
              onClick={() => logout()}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 border-0 px-3 py-1.5 rounded-xl transition-all cursor-pointer font-bold text-[10px] flex items-center space-x-1"
              id="admin-banner-logout-btn"
            >
              <LogOut size={12} />
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
        <AdminDashboard onViewAsStudent={handleViewAsStudent} onViewGrammarAsStudent={handleViewGrammarAsStudent} />
      </div>
    );
  }

  // 6. MAIN STUDENT LEARNING PORTAL
  return (
    <div className="min-h-screen bg-transparent text-slate-100 flex flex-col animate-fade-in" id="app-root">
      
      {/* Decorative colored glow bubbles */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -z-10" />
      <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-3xl -z-10" />

      {/* Toggle back to admin bar if teacher is exploring as student */}
      {isStaff && adminMode && (
        <div className="bg-indigo-600 text-white px-4 py-2 flex justify-between items-center text-xs font-bold shadow-sm" id="student-preview-admin-bar">
          <span>💡 Bạn đang xem giao diện với tư cách Học Sinh</span>
          <button 
            onClick={() => setAdminMode(false)}
            className="bg-white/20 hover:bg-white/30 text-white border border-white/40 px-3 py-1 rounded-xl transition-all cursor-pointer text-[10px]"
            id="back-to-admin-btn"
          >
            Quay lại trang Quản Trị
          </button>
        </div>
      )}

      {/* Main navigation header */}
      <nav className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-100 p-4 shadow-xs" id="navbar">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center space-x-3">
            <span className="shrink-0 p-2.5 bg-indigo-600 text-white rounded-2xl shadow-md">
              <BookOpen size={20} />
            </span>
            <div className="min-w-0">
              <span className="block truncate text-base font-black leading-none tracking-tight text-gray-900 sm:text-lg">Tiếng Anh Cô Diệu</span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            {LEARNING_HISTORY_UI_ENABLED && (
              <button
                type="button"
                onClick={() => navigateToStudentHistory(true)}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50 px-3 text-xs font-black text-indigo-700 transition-colors hover:bg-indigo-100"
                id="student-history-nav-btn"
                aria-label="Mở lịch sử học tập"
              >
                <History size={16} aria-hidden="true" />
                <span className="hidden sm:inline">Lịch sử học tập</span>
              </button>
            )}
            {user ? (
              <>
                <div className="flex items-center space-x-2 text-right">
                  <div className="hidden sm:block">
                    <span className="text-xs font-black text-gray-800 block leading-none">{user.name || 'Học sinh'}</span>
                    <span className="text-[9px] text-indigo-600 font-bold uppercase tracking-wider block mt-0.5">
                      {user.role === 'super_admin' ? 'Super Admin' : user.role === 'teacher' ? 'Giáo viên' : 'Học sinh'}
                    </span>
                  </div>
                  <div className="w-9 h-9 bg-indigo-50 text-indigo-700 rounded-xl flex items-center justify-center font-black text-sm">
                    {(user.name || 'S').charAt(0).toUpperCase()}
                  </div>
                </div>

                <button
                  onClick={() => logout()}
                  className="flex items-center justify-center p-2 bg-gray-50 hover:bg-rose-50 hover:text-rose-600 text-gray-400 rounded-xl transition-all cursor-pointer border border-gray-100"
                  title="Đăng xuất tài khoản"
                  id="user-logout-btn"
                >
                  <LogOut size={16} />
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { window.location.href = '/login'; }}
                  className="px-3 py-2 bg-gray-50 hover:bg-indigo-50 text-gray-600 hover:text-indigo-700 border border-gray-100 rounded-xl text-xs font-bold transition-all"
                  id="teacher-admin-login-btn"
                >
                  Giáo viên/Admin
                </button>
                <button
                  onClick={() => { window.location.href = '/reg'; }}
                  className="hidden sm:inline-flex px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all"
                  id="public-register-btn"
                >
                  Đăng ký
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Welcome banner */}
      <header className="max-w-6xl mx-auto text-center px-4 pt-12 pb-8 space-y-4" id="home-hero">
        <span className="inline-flex items-center space-x-1 bg-indigo-50 text-indigo-700 text-xs font-bold px-3 py-1 rounded-full border border-indigo-100" id="home-hero-badge">
          <Sparkles size={12} className="text-indigo-500 animate-bounce" />
          <span>Game hóa Từ vựng tiếng Anh đột phá</span>
        </span>

        <h1 className="font-black text-blue-200 leading-[1.08] tracking-normal">
          <span className="block text-3xl sm:text-4xl lg:text-5xl">
            Học từ vựng thật vui,
          </span>
          <span className="block text-2xl sm:text-4xl lg:text-5xl whitespace-nowrap">
            Nhớ siêu lâu cùng <span className="text-blue-200 underline decoration-blue-300 decoration-4 underline-offset-4">Tiếng Anh Cô Diệu</span>!
          </span>
        </h1>

        <p className="text-gray-500 text-sm md:text-base max-w-3xl mx-auto leading-relaxed">
          Tiếng Anh Cô Diệu là nền tảng học từ vựng tiếng Anh hiện đại, được xây dựng với mong muốn giúp học sinh học dễ hơn, nhớ lâu hơn và tiến bộ mỗi ngày. Ứng dụng kết hợp bài học từ vựng với nhiều thể loại game luyện tập sinh động, âm thanh chuẩn xác và hệ thống giao bài tập tự động tiện lợi từ giáo viên.
        </p>
        <p className="text-gray-500 text-sm md:text-base max-w-3xl mx-auto leading-relaxed">
          Không chỉ là một công cụ học tập, Tiếng Anh Cô Diệu còn là nơi cô Diệu gửi gắm tâm huyết giảng dạy, sự kiên nhẫn và mong muốn đồng hành cùng từng học sinh trên hành trình chinh phục tiếng Anh. Mỗi bài học được thiết kế để các em vừa học, vừa chơi, vừa rèn phản xạ, giúp việc ghi nhớ từ vựng trở nên nhẹ nhàng và thú vị hơn.
        </p>
      </header>

      {/* Main Student Portal Home Area */}
      <main className="max-w-6xl w-full mx-auto px-4 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 mt-4 pb-20">
        
        {/* Left Area: Vocab sets directory */}
        <section className="lg:col-span-8 space-y-6" id="home-sets-directory">
          
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-4 border-b border-gray-200">
            <div className="space-y-0.5">
              <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
                <GraduationCap className="text-indigo-600" size={24} />
                <span>Chọn bài học từ vựng tự do</span>
              </h2>
              <p className="text-gray-400 text-xs font-medium">Bấm vào bất kỳ bộ bài học nào dưới đây để chọn game luyện tập.</p>
            </div>

            {/* Quick Filter */}
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-72">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={homeSearch}
                  onChange={(e) => setHomeSearch(e.target.value)}
                  placeholder="Tìm bài học, ví dụ: số đếm, number..."
                  className="w-full p-2.5 pl-10 bg-white border border-gray-200 rounded-xl outline-none text-xs font-bold text-gray-600 placeholder-gray-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                />
              </div>
              <select
                value={homeGrade}
                onChange={(e) => setHomeGrade(e.target.value)}
                className="p-2.5 px-4 bg-white border border-gray-200 rounded-xl outline-none text-xs font-bold text-gray-600 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
              >
                <option value="">Tất cả khối lớp</option>
                {homeGradeOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Sets list grid */}
          {filteredSets.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-gray-100 shadow-sm text-gray-400 text-sm">
              Chưa có bộ từ vựng công khai nào phù hợp.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4" id="home-sets-grid">
              {filteredSets.map((set) => (
                <div 
                  key={set.id}
                  className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                  id={`home-set-${set.id}`}
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">
                        {formatGradeLabel(set.gradeLevel)}
                      </span>
                      <span className="text-xs text-gray-400 font-semibold">{set.items.length} từ</span>
                    </div>

                    <div className="space-y-1">
                      <h3 className="font-extrabold text-gray-800 text-base leading-tight group-hover:text-indigo-600 transition-colors">{set.title}</h3>
                      <p className="text-xs text-gray-400 font-medium">Chủ đề: {set.subject}</p>
                      <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed mt-1">{set.description}</p>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-gray-50 flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-gray-400">Tác giả: {set.creatorName || 'Cô Diệu Tiếng Anh'}</span>
                    
                    <button
                      onClick={() => {
                        setSelectedSet(set);
                        setStudentName(user?.name || '');
                      }}
                      className="py-2 px-4 !bg-indigo-600 hover:!bg-indigo-700 !text-white !border !border-indigo-700 font-extrabold rounded-xl transition-all shadow-sm hover:shadow flex items-center space-x-1 cursor-pointer text-xs"
                    >
                      <span>Vào học ngay</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pt-8 space-y-4 border-t border-gray-200" id="home-grammar-directory">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
                  <FileText className="text-emerald-600" size={22} />
                  <span>Luyện ngữ pháp</span>
                </h2>
                <p className="text-gray-400 text-xs font-medium">Chọn bài ngữ pháp để luyện trắc nghiệm và xem lại lời giải sau khi nộp.</p>
              </div>
              <span className="text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-full px-3 py-1">
                {filteredGrammarSets.length} bài
              </span>
            </div>

            {filteredGrammarSets.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-3xl border border-gray-100 shadow-sm text-gray-400 text-sm">
                Chưa có bài ngữ pháp công khai phù hợp.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredGrammarSets.map((set) => (
                  <div key={set.id} className="bg-white rounded-3xl p-6 border border-emerald-100 shadow-sm hover:shadow-md transition-all">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                        {formatGradeLabel(set.gradeLevel)}
                      </span>
                      <span className="text-xs text-gray-400 font-semibold">{set.questions.length} câu</span>
                    </div>
                    <h3 className="mt-3 font-extrabold text-gray-800 text-base leading-tight">{set.title}</h3>
                    <p className="text-xs text-gray-400 font-medium">Chủ đề: {set.topic || set.subject}</p>
                    <p className="mt-2 text-xs text-gray-500 line-clamp-2 leading-relaxed">{set.description}</p>
                    <button
                      onClick={() => setSelectedGrammarSet(set)}
                      className="mt-5 w-full py-3 !bg-emerald-600 hover:!bg-emerald-700 !text-white !border !border-emerald-700 font-extrabold rounded-xl transition-all shadow-sm flex items-center justify-center space-x-1 cursor-pointer text-xs"
                    >
                      <span>Bắt đầu luyện ngữ pháp</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </section>

        {/* Right Area: Golden Board sidebar */}
        <aside className="lg:col-span-4 space-y-6" id="home-sidebar">
          
          {/* Box 1: Student Golden Board */}
          <div className="bg-gradient-to-br from-slate-950 to-indigo-950 text-white rounded-3xl p-6 border border-white/10 shadow-md space-y-4" id="student-golden-board">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div className="flex items-center space-x-2">
                <Award className="text-amber-300 animate-pulse" size={20} />
                <h3 className="font-extrabold text-base">Bảng Vàng</h3>
              </div>
              <select
                value={leaderboardPeriod}
                onChange={(e) => setLeaderboardPeriod(e.target.value as LeaderboardPeriod)}
                className="bg-white/10 border border-white/10 rounded-xl px-2.5 py-1.5 text-[10px] font-black text-white outline-none"
                style={{ colorScheme: 'dark' }}
              >
                <option value="week">Tuần này</option>
                <option value="month">Tháng này</option>
              </select>
            </div>

            <p className="text-xs text-white/70 leading-relaxed">
              Vinh danh học sinh chăm học dựa trên kết quả chơi game, độ chính xác, số ngày học và mức tiến bộ. Mỗi bộ từ vựng và mỗi chế độ chơi chỉ tính kết quả tốt nhất.
            </p>

            {homeLeaderboard.length === 0 ? (
              <div className="text-center py-6 text-white/50 text-xs italic">
                Chưa có kết quả học tập nào để vinh danh.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  {homeLeaderboard.slice(0, 3).map((entry, index) => (
                    <div key={entry.studentKey || entry.studentName} className="rounded-2xl bg-white/10 border border-white/10 p-3 text-center">
                      <div className="text-2xl">{index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}</div>
                      <p className="mt-1 truncate text-xs font-black">{entry.studentName}</p>
                      <p className="text-[10px] text-amber-200 font-bold">{entry.honorScore} điểm</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-2" id="home-leaderboard-list">
                  {homeLeaderboard.map((entry, index) => (
                    <div key={`${entry.studentKey || entry.studentName}-${index}`} className="flex items-center justify-between rounded-2xl bg-white/5 border border-white/10 px-3 py-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-6 h-6 rounded-full bg-indigo-500/30 text-indigo-100 flex items-center justify-center text-[10px] font-black shrink-0">
                          {index + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-extrabold">{entry.studentName}</p>
                          <p className="text-[10px] text-white/50">{entry.completedLessons} bài • {entry.averageAccuracy}% đúng • {entry.studyDays} ngày</p>
                        </div>
                      </div>
                      <span className="text-xs font-black text-amber-200">{entry.honorScore}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Box 2: System info overview card */}
          <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-3xl p-6 shadow-md space-y-3" id="system-info-card">
            <div className="flex items-center space-x-1.5 text-indigo-300 font-bold text-xs">
              <Star size={14} className="fill-indigo-400 text-indigo-400" />
              <span>Tiếng Anh Cô Diệu</span>
            </div>
            <h4 className="font-extrabold text-sm">Nền tảng Học tập Toàn diện</h4>
            <p className="text-[11px] text-white/70 leading-relaxed">
              Thiết kế bởi Senior Fullstack Developer. Hỗ trợ học tập đa chiều, tự sinh IPA bằng trí tuệ nhân tạo, và phân tích chi tiết lỗ hổng từ vựng của học sinh.
            </p>
          </div>

        </aside>
      </main>

      {/* Footer copyright */}
      <footer className="bg-white border-t border-gray-100 py-6 text-center text-xs text-gray-400" id="footer">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-3">
          <blockquote className="max-w-3xl text-left text-gray-600 font-semibold leading-relaxed">
            “{weeklyLearningQuote.text}”
            <span className="ml-1 text-indigo-600 font-black">— {weeklyLearningQuote.author}</span>
          </blockquote>
          <span className="font-semibold text-gray-400 shrink-0">© 2026 Tiếng Anh Cô Diệu</span>
        </div>
      </footer>

    </div>
  );
}
