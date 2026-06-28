import React, { useState, useEffect } from 'react';
import { 
  BookOpen, Users, Award, Play, ShieldAlert, Sparkles, UserCheck, 
  ArrowRight, Key, HelpCircle, ChevronRight, GraduationCap, Star, Search 
} from 'lucide-react';
import { VocabSet, Class, Assignment } from './types';
import AdminDashboard from './components/admin/AdminDashboard';
import StudentLearningArea from './components/games/StudentLearningArea';

export default function App() {
  const [role, setRole] = useState<'guest' | 'student' | 'admin'>('guest');
  const [vocabSets, setVocabSets] = useState<VocabSet[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);

  // Search/Filter for homepage
  const [homeSearch, setHomeSearch] = useState('');
  const [homeGrade, setHomeGrade] = useState('');

  // Authentication Pin for Teachers
  const [adminPin, setAdminPin] = useState('');
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminAuthError, setAdminAuthError] = useState('');

  // Active student simulation state
  const [selectedSet, setSelectedSet] = useState<VocabSet | null>(null);
  const [studentName, setStudentName] = useState('');
  const [activeAssignmentId, setActiveAssignmentId] = useState<string | undefined>(undefined);
  const [activeGameId, setActiveGameId] = useState<string | undefined>(undefined);

  const [namePromptConfig, setNamePromptConfig] = useState<{
    set: VocabSet;
    gameId?: string;
    assignmentId?: string;
    title?: string;
  } | null>(null);
  const [tempStudentName, setTempStudentName] = useState('');

  // Load public data on mount
  const loadHomeData = () => {
    fetch('/api/vocab-sets')
      .then(res => res.json())
      .then(data => setVocabSets(data))
      .catch(err => console.error("Error loading sets:", err));

    fetch('/api/assignments')
      .then(res => res.json())
      .then(data => setAssignments(data))
      .catch(err => console.error("Error loading assignments:", err));

    fetch('/api/classes')
      .then(res => res.json())
      .then(data => setClasses(data))
      .catch(err => console.error("Error loading classes:", err));
  };

  useEffect(() => {
    loadHomeData();
  }, [role]);

  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPin === '1234' || adminPin.toLowerCase() === 'admin') {
      setRole('admin');
      setAdminAuthError('');
      setAdminPin('');
      setShowAdminLogin(false);
    } else {
      setAdminAuthError('Mã số bảo mật PIN chưa đúng (Gợi ý: 1234)');
    }
  };

  const handleViewAsStudent = (set: VocabSet, gameId?: string, assignmentId?: string) => {
    setSelectedSet(set);
    setActiveGameId(gameId);
    setActiveAssignmentId(assignmentId);
    setStudentName('Giáo viên (Học thử)');
    setRole('student');
  };

  // Filter public sets on home page
  const filteredSets = vocabSets.filter(set => {
    const matchSearch = set.title.toLowerCase().includes(homeSearch.toLowerCase()) || 
                        set.description.toLowerCase().includes(homeSearch.toLowerCase());
    const matchGrade = homeGrade ? set.gradeLevel === homeGrade : true;
    return set.status === 'public' && matchSearch && matchGrade;
  });

  // --- SCREEN RENDERS ---

  // 1. ACTIVE STUDENT SCREEN
  if (role === 'student' && selectedSet) {
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
          // Return to previous screen (admin or guest)
          setRole(studentName.includes('Giáo viên') ? 'admin' : 'guest');
        }}
      />
    );
  }

  // 2. TEACHER/ADMIN DASHBOARD SCREEN
  if (role === 'admin') {
    return (
      <div className="relative">
        {/* Swapper banner back to visitor mode */}
        <div className="bg-amber-500/20 backdrop-blur-md border-b border-amber-500/30 text-amber-300 px-4 py-2 flex justify-between items-center text-xs font-bold shadow-sm">
          <span>⚠️ Đang hoạt động dưới quyền GIÁO VIÊN / QUẢN TRỊ VIÊN</span>
          <button 
            onClick={() => { setRole('guest'); setSelectedSet(null); }}
            className="bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/30 px-3 py-1 rounded-sm transition-all cursor-pointer"
          >
            Thoát quyền Admin
          </button>
        </div>
        <AdminDashboard onViewAsStudent={handleViewAsStudent} />
      </div>
    );
  }

  // 3. MAIN VISITOR LANDING PORTAL (GUEST)
  return (
    <div className="min-h-screen bg-transparent text-slate-100 flex flex-col" id="app-root">
      
      {/* Decorative colored glow bubbles */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -z-10" />
      <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-3xl -z-10" />

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
            <button
              onClick={() => {
                setAdminPin('');
                setAdminAuthError('');
                setShowAdminLogin(true);
              }}
              className="flex items-center space-x-1.5 p-2 px-4 bg-gray-50 hover:bg-indigo-50 border border-gray-100 text-gray-600 hover:text-indigo-600 rounded-xl text-xs font-bold transition-all cursor-pointer"
              id="admin-login-trigger"
            >
              <Key size={14} />
              <span>Cửa ngõ Giáo viên</span>
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
                        setNamePromptConfig({ set });
                        setTempStudentName('');
                      }}
                      className="py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl transition-all shadow-sm hover:shadow flex items-center space-x-1 cursor-pointer text-xs"
                    >
                      <span>Vào học</span>
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
                        setNamePromptConfig({
                          set: foundSet,
                          gameId: assign.gameId,
                          assignmentId: assign.id,
                          title: `Bài tập lớp ${assign.className}`
                        });
                        setTempStudentName('');
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

      {/* Teachers Pin Code Login Dialog Modal */}
      {showAdminLogin && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in" id="admin-login-modal">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-6 shadow-2xl border border-gray-100">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto">
                <Key size={24} />
              </div>
              <h3 className="text-xl font-black text-gray-800">Xác thực Giáo viên</h3>
              <p className="text-xs text-gray-400 max-w-xs mx-auto">
                Để bảo mật dữ liệu học sinh, vui lòng nhập mã PIN bảo mật của Giáo viên để mở khóa quyền quản trị.
              </p>
            </div>

            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div className="space-y-1">
                <input
                  type="password"
                  placeholder="Nhập mã PIN Giáo viên (Gợi ý: 1234)"
                  value={adminPin}
                  onChange={(e) => setAdminPin(e.target.value)}
                  className="w-full p-4 border-2 border-gray-200 rounded-2xl outline-none focus:border-indigo-500 font-mono text-center text-lg tracking-widest font-black"
                  autoFocus
                />
                {adminAuthError && (
                  <p className="text-xs text-rose-500 font-semibold text-center mt-1">{adminAuthError}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdminLogin(false)}
                  className="py-3 bg-gray-50 hover:bg-gray-100 text-gray-600 font-bold rounded-xl text-sm transition-all cursor-pointer"
                >
                  Quay lại
                </button>
                <button
                  type="submit"
                  className="py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm shadow-md transition-all cursor-pointer"
                  id="submit-pin-btn"
                >
                  Xác nhận
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Student Name Input Modal */}
      {namePromptConfig && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in" id="student-name-modal">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-6 shadow-2xl border border-gray-100">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto">
                <GraduationCap size={24} />
              </div>
              <h3 className="text-xl font-black text-gray-800">
                {namePromptConfig.title ? namePromptConfig.title : "Bắt đầu bài học mới"}
              </h3>
              <p className="text-xs text-gray-400 max-w-xs mx-auto">
                {namePromptConfig.title 
                  ? `Em chuẩn bị làm bài tập bộ từ "${namePromptConfig.set.title}". Hãy nhập họ và tên của em để bắt đầu.`
                  : `Em chuẩn bị học bộ từ vựng "${namePromptConfig.set.title}". Hãy nhập họ và tên để bắt đầu luyện tập nhé.`}
              </p>
            </div>

            <form 
              onSubmit={(e) => {
                e.preventDefault();
                if (tempStudentName.trim()) {
                  setSelectedSet(namePromptConfig.set);
                  setStudentName(tempStudentName.trim());
                  setActiveAssignmentId(namePromptConfig.assignmentId);
                  setActiveGameId(namePromptConfig.gameId);
                  setRole('student');
                  setNamePromptConfig(null);
                }
              }} 
              className="space-y-4"
            >
              <div className="space-y-1">
                <input
                  type="text"
                  placeholder="Nhập họ và tên của em..."
                  value={tempStudentName}
                  onChange={(e) => setTempStudentName(e.target.value)}
                  className="w-full p-4 border-2 border-gray-200 rounded-2xl outline-none focus:border-indigo-500 font-bold text-center text-lg text-gray-800"
                  autoFocus
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setNamePromptConfig(null)}
                  className="py-3 bg-gray-50 hover:bg-gray-100 text-gray-600 font-bold rounded-xl text-sm transition-all cursor-pointer"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={!tempStudentName.trim()}
                  className="py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm shadow-md transition-all cursor-pointer disabled:opacity-50"
                  id="student-start-game-btn"
                >
                  Vào học ngay
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
