import React, { useState, useEffect } from 'react';
import { 
  BookOpen, Users, Award, Play, ShieldAlert, Sparkles, UserCheck, 
  ArrowRight, Key, HelpCircle, ChevronRight, GraduationCap, Star, Search, LogOut, Shield
} from 'lucide-react';
import { VocabSet, Class, Assignment } from './types';
import AdminDashboard from './components/admin/AdminDashboard';
import StudentLearningArea from './components/games/StudentLearningArea';
import { useAuth } from './context/AuthContext';
import Login from './components/Login';
import Register from './components/Register';

export default function App() {
  const { user, token, logout, loading } = useAuth();
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [adminMode, setAdminMode] = useState(false);

  const [vocabSets, setVocabSets] = useState<VocabSet[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  // Search/Filter for homepage
  const [homeSearch, setHomeSearch] = useState('');
  const [homeGrade, setHomeGrade] = useState('');

  // Active student playing state
  const [selectedSet, setSelectedSet] = useState<VocabSet | null>(null);
  const [studentName, setStudentName] = useState('');
  const [activeAssignmentId, setActiveAssignmentId] = useState<string | undefined>(undefined);
  const [activeGameId, setActiveGameId] = useState<string | undefined>(undefined);

  // Load authenticated data on mount or token change
  const loadHomeData = async () => {
    if (!token) return;

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
  };

  useEffect(() => {
    loadHomeData();
  }, [token, user]);

  const handleViewAsStudent = (set: VocabSet, gameId?: string, assignmentId?: string) => {
    setSelectedSet(set);
    setActiveGameId(gameId);
    setActiveAssignmentId(assignmentId);
    setStudentName(user?.name || 'Giáo viên (Học thử)');
    setAdminMode(true); // Switch to student view representation
  };

  // Filter public sets on home page
  const filteredSets = vocabSets.filter(set => {
    const matchSearch = set.title.toLowerCase().includes(homeSearch.toLowerCase()) || 
                        set.description.toLowerCase().includes(homeSearch.toLowerCase());
    const matchGrade = homeGrade ? set.gradeLevel === homeGrade : true;
    return set.status === 'public' && matchSearch && matchGrade;
  });

  // --- SCREEN RENDERS ---

  // 1. Loading Screen
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
        <p className="text-gray-500 font-bold text-sm">Đang kết nối hệ thống V-Homework...</p>
      </div>
    );
  }

  // 2. Auth Guard: Not Logged In
  if (!user) {
    if (authMode === 'register') {
      return (
        <Register 
          onNavigateToLogin={() => setAuthMode('login')} 
          onNavigateToHome={() => {}} 
        />
      );
    }
    return (
      <Login 
        onNavigateToRegister={() => setAuthMode('register')} 
        onNavigateToHome={() => {}} 
      />
    );
  }

  // 3. Status Guard: User is Blocked
  if (user.status === 'blocked') {
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
        initialGameId={activeGameId}
        onBack={() => {
          setSelectedSet(null);
          setActiveGameId(undefined);
          setActiveAssignmentId(undefined);
        }}
      />
    );
  }

  // 5. ADMIN/TEACHER DASHBOARD SCREEN
  // If user is teacher/super_admin and NOT in student simulated view mode
  const isStaff = user.role === 'teacher' || user.role === 'super_admin';
  if (isStaff && !adminMode) {
    return (
      <div className="relative">
        {/* Toggle bar back to student representation */}
        <div className="bg-amber-500/20 backdrop-blur-md border-b border-amber-500/30 text-amber-900 px-4 py-2 flex justify-between items-center text-xs font-bold shadow-sm">
          <span>⚠️ Bạn đang ở giao diện Quản Trị ({user.role === 'super_admin' ? 'Super Admin' : 'Giáo viên'})</span>
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => setAdminMode(true)}
              className="bg-amber-600 hover:bg-amber-700 text-white border-0 px-3 py-1.5 rounded-xl transition-all cursor-pointer font-bold text-[10px]"
            >
              Xem trang học sinh
            </button>
            <button 
              onClick={() => logout()}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 border-0 px-3 py-1.5 rounded-xl transition-all cursor-pointer font-bold text-[10px] flex items-center space-x-1"
            >
              <LogOut size={12} />
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
        <AdminDashboard onViewAsStudent={handleViewAsStudent} />
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
        <div className="bg-indigo-600 text-white px-4 py-2 flex justify-between items-center text-xs font-bold shadow-sm">
          <span>💡 Bạn đang xem giao diện với tư cách Học Sinh</span>
          <button 
            onClick={() => setAdminMode(false)}
            className="bg-white/20 hover:bg-white/30 text-white border border-white/40 px-3 py-1 rounded-xl transition-all cursor-pointer text-[10px]"
          >
            Quay lại trang Quản Trị
          </button>
        </div>
      )}

      {/* Main navigation header */}
      <nav className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-100 p-4 shadow-xs" id="navbar">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-md">
              <BookOpen size={20} />
            </span>
            <div>
              <span className="font-black text-gray-900 tracking-tight text-lg leading-none block">V-Homework</span>
              <span className="text-[10px] text-indigo-600 font-bold tracking-widest uppercase">VOCABULARY</span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
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
          </div>
        </div>
      </nav>

      {/* Hero Welcome banner */}
      <header className="max-w-4xl mx-auto text-center px-4 pt-12 pb-8 space-y-4" id="home-hero">
        <span className="inline-flex items-center space-x-1 bg-indigo-50 text-indigo-700 text-xs font-bold px-3 py-1 rounded-full border border-indigo-100">
          <Sparkles size={12} className="text-indigo-500 animate-bounce" />
          <span>Game hóa Từ vựng tiếng Anh đột phá</span>
        </span>

        <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-gray-900 tracking-tight leading-none md:leading-tight">
          Học từ vựng thật vui,<br />
          Nhớ siêu lâu cùng <span className="text-indigo-600 underline decoration-indigo-300">V-Homework</span>!
        </h1>

        <p className="text-gray-500 text-sm md:text-base max-w-xl mx-auto leading-relaxed">
          Nền tảng học tập từ vựng tiếng Anh thế hệ mới. Đa dạng 5 thể loại game luyện tập phản xạ, âm thanh chuẩn xác, giao bài tập tự động từ thầy cô cực tiện lợi.
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
            <div className="flex gap-2">
              <select
                value={homeGrade}
                onChange={(e) => setHomeGrade(e.target.value)}
                className="p-2.5 px-4 bg-white border border-gray-200 rounded-xl outline-none text-xs font-bold text-gray-600"
              >
                <option value="">Tất cả khối lớp</option>
                <option value="Lớp 3">Lớp 3</option>
                <option value="Lớp 6">Lớp 6</option>
                <option value="Lớp 10">Lớp 10</option>
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
                        {set.gradeLevel}
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
                    <span className="text-[10px] font-semibold text-gray-400">Tác giả: {set.creatorName || 'V-Homework'}</span>
                    
                    <button
                      onClick={() => {
                        setSelectedSet(set);
                        setStudentName(user?.name || 'Học sinh');
                      }}
                      className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl transition-all shadow-sm hover:shadow flex items-center space-x-1 cursor-pointer text-xs"
                    >
                      <span>Vào học ngay</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

        </section>

        {/* Right Area: Homework Checker sidebar */}
        <aside className="lg:col-span-4 space-y-6" id="home-sidebar">
          
          {/* Box 1: Homework Checker for pupils */}
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-md space-y-4" id="homework-checker">
            <div className="flex items-center space-x-2 border-b border-gray-50 pb-3">
              <GraduationCap className="text-indigo-600 animate-pulse" size={20} />
              <h3 className="font-extrabold text-gray-800 text-base">Bài tập thầy cô giao</h3>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed">
              Em có mã mời lớp hoặc bài tập từ thầy cô? Hãy nhấp vào bài tập tương ứng của lớp em bên dưới để hoàn thành nhận điểm!
            </p>

            <div className="space-y-3" id="home-assignments-list">
              {assignments.length === 0 ? (
                <div className="text-center py-6 text-gray-400 text-xs italic">
                  Chưa có bài tập nào được giao gần đây.
                </div>
              ) : (
                assignments.map((assign) => (
                  <button
                    key={assign.id}
                    onClick={() => {
                      const foundSet = vocabSets.find(s => s.id === assign.vocabSetId);
                      if (foundSet) {
                        setSelectedSet(foundSet);
                        setStudentName(user?.name || 'Học sinh');
                        setActiveAssignmentId(assign.id);
                        setActiveGameId(assign.gameId);
                      }
                    }}
                    className="w-full text-left p-3.5 bg-gray-50 hover:bg-indigo-50/30 border border-gray-100 hover:border-indigo-100 rounded-2xl transition-all cursor-pointer block"
                  >
                    <span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded block w-fit mb-1.5">
                      {assign.className}
                    </span>
                    <strong className="text-xs font-extrabold text-gray-800 block leading-tight">{assign.title}</strong>
                    <span className="text-[10px] text-gray-400 font-medium block mt-1">Hạn nộp: {assign.dueDate}</span>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Box 2: System info overview card */}
          <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-3xl p-6 shadow-md space-y-3" id="system-info-card">
            <div className="flex items-center space-x-1.5 text-indigo-300 font-bold text-xs">
              <Star size={14} className="fill-indigo-400 text-indigo-400" />
              <span>V-Homework Engine v1.0</span>
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
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-2">
          <span>© 2026 V-Homework. Crafted with maximum performance and modern web design patterns.</span>
          <span className="font-semibold text-gray-500">English Vocabulary Web Application</span>
        </div>
      </footer>

    </div>
  );
}
