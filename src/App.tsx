import React, { useEffect, useState } from 'react';
import { LogOut, ShieldAlert } from 'lucide-react';
import type { GrammarSet, VocabSet } from './types';
import { examLibraryPath, examModulePath } from './features/listening-library/routes';
import { useAuth } from './context/AuthContext';
import Login from './components/Login';
import Register from './components/Register';
import { useAppNavigation } from './features/app-shell/useAppNavigation';
import { useHomeController } from './features/home/useHomeController';

const AdminDashboard = React.lazy(() => import('./components/admin/AdminDashboard'));
const StudentLearningArea = React.lazy(() => import('./components/games/StudentLearningArea'));
const GrammarLearningArea = React.lazy(() => import('./components/grammar/GrammarLearningArea'));
const ListeningLibraryHome = React.lazy(() => import('./features/listening-library/student/ListeningLibraryHome'));
const ListeningModulePage = React.lazy(() => import('./features/listening-library/student/ListeningModulePage'));
const ListeningPaperPage = React.lazy(() => import('./features/listening-library/student/ListeningPaperPage'));
const ListeningExamPage = React.lazy(() => import('./features/listening-library/student/ListeningExamPage'));
const StudentHistoryPage = React.lazy(() => import('./components/history/StudentHistoryPage'));
const TeacherLibraryPreview = React.lazy(() => import('./components/admin/TeacherLibraryPreview'));
const HomePage = React.lazy(() => import('./features/home/HomePage'));

export default function App() {
  const { user, token, logout, loading } = useAuth();
  const [adminMode, setAdminMode] = useState(false);
  const { appShellRoute, listeningLibraryRoute, navigateInternal } = useAppNavigation();
  const currentPathname = appShellRoute.pathname;
  const studentHistoryOpen = appShellRoute.kind === 'history';
  const privateAssignmentToken = appShellRoute.kind === 'private-vocabulary'
    ? appShellRoute.token
    : '';
  const privateGrammarToken = appShellRoute.kind === 'private-grammar'
    ? appShellRoute.token
    : '';
  const teacherPreviewRoute = appShellRoute.kind === 'teacher-preview'
    ? appShellRoute
    : null;
  const authRoute = appShellRoute.kind === 'auth' ? appShellRoute.mode : '';
  const isDirectStudentExerciseRoute = Boolean(
    privateAssignmentToken
    || privateGrammarToken
    || listeningLibraryRoute?.kind === 'paper-exam'
    || listeningLibraryRoute?.kind === 'exam'
  );
  const isStaff = user?.role === 'teacher' || user?.role === 'super_admin';

  const [privateAssignmentSet, setPrivateAssignmentSet] = useState<VocabSet | null>(null);
  const [privateAssignmentLoading, setPrivateAssignmentLoading] = useState(!!privateAssignmentToken);
  const [privateAssignmentError, setPrivateAssignmentError] = useState('');
  const [privateGrammarSet, setPrivateGrammarSet] = useState<GrammarSet | null>(null);
  const [privateGrammarLoading, setPrivateGrammarLoading] = useState(!!privateGrammarToken);
  const [privateGrammarError, setPrivateGrammarError] = useState('');
  const [selectedSet, setSelectedSet] = useState<VocabSet | null>(null);
  const [selectedGrammarSet, setSelectedGrammarSet] = useState<GrammarSet | null>(null);
  const [studentName, setStudentName] = useState('');
  const [activeAssignmentId, setActiveAssignmentId] = useState<string | undefined>();
  const [activeGameId, setActiveGameId] = useState<string | undefined>();

  const navigateToStudentHistory = React.useCallback((open: boolean) => {
    navigateInternal(open ? '/history' : '/');
  }, [navigateInternal]);

  const isHomeDataView = currentPathname === '/'
    && !studentHistoryOpen
    && !privateAssignmentToken
    && !privateGrammarToken
    && !listeningLibraryRoute
    && !authRoute
    && !selectedSet
    && !selectedGrammarSet
    && user?.status !== 'blocked'
    && (!isStaff || adminMode);
  const home = useHomeController({ enabled: isHomeDataView, loading, token });

  useEffect(() => {
    if (!privateAssignmentToken) return;

    setPrivateAssignmentLoading(true);
    setPrivateAssignmentError('');
    fetch(`/api/vocab-sets/share/${encodeURIComponent(privateAssignmentToken)}`)
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Không tìm thấy bài tập hoặc link không hợp lệ');
        setPrivateAssignmentSet(data);
      })
      .catch(error => {
        setPrivateAssignmentSet(null);
        setPrivateAssignmentError(error.message || 'Không tìm thấy bài tập hoặc link không hợp lệ');
      })
      .finally(() => setPrivateAssignmentLoading(false));
  }, [privateAssignmentToken]);

  useEffect(() => {
    if (!privateGrammarToken) return;

    setPrivateGrammarLoading(true);
    setPrivateGrammarError('');
    fetch(`/api/grammar-sets/share/${encodeURIComponent(privateGrammarToken)}`)
      .then(async response => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Không tìm thấy bài ngữ pháp hoặc link không hợp lệ');
        setPrivateGrammarSet(data);
      })
      .catch(error => {
        setPrivateGrammarSet(null);
        setPrivateGrammarError(error.message || 'Không tìm thấy bài ngữ pháp hoặc link không hợp lệ');
      })
      .finally(() => setPrivateGrammarLoading(false));
  }, [privateGrammarToken]);

  const handleViewAsStudent = (set: VocabSet, gameId?: string, assignmentId?: string) => {
    setSelectedSet(set);
    setActiveGameId(gameId);
    setActiveAssignmentId(assignmentId);
    setStudentName(user?.name || 'Giáo viên (Học thử)');
    setAdminMode(true);
  };

  const handleViewGrammarAsStudent = (set: GrammarSet) => {
    setSelectedGrammarSet(set);
    setAdminMode(true);
  };

  if (loading && !isDirectStudentExerciseRoute) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4" />
        <p className="text-gray-500 font-bold text-sm">Đang kết nối hệ thống Cô Diệu Tiếng Anh...</p>
      </div>
    );
  }

  if (authRoute === 'register' && !user) {
    return (
      <Register
        onNavigateToLogin={() => navigateInternal('/login')}
        onNavigateToHome={() => navigateInternal('/')}
      />
    );
  }

  if (authRoute === 'login' && !user) {
    return (
      <Login
        onNavigateToRegister={() => navigateInternal('/reg')}
        onNavigateToHome={() => navigateInternal('/')}
      />
    );
  }

  if (teacherPreviewRoute) {
    if (!user || !isStaff || !token) {
      return (
        <main id="teacher-library-preview-denied" className="min-h-screen bg-slate-50 p-6 flex items-center justify-center">
          <section className="w-full max-w-lg rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-sm">
            <ShieldAlert className="mx-auto text-rose-600" size={42} aria-hidden="true" />
            <h1 className="mt-4 text-xl font-black text-slate-950">Cần tài khoản giáo viên</h1>
            <p role="alert" className="mt-2 text-sm font-semibold text-slate-600">Vui lòng đăng nhập đúng tài khoản giáo viên đã tạo bộ bài này.</p>
            <button type="button" onClick={() => navigateInternal('/admin')} className="mt-6 rounded-xl border border-blue-700 bg-blue-700 px-5 py-3 font-black text-white">Đến trang đăng nhập</button>
          </section>
        </main>
      );
    }
    return (
      <TeacherLibraryPreview
        resourceType={teacherPreviewRoute.resourceType}
        setId={teacherPreviewRoute.setId}
        token={token}
        teacherName={user.name}
        onBack={() => navigateInternal('/admin')}
      />
    );
  }

  if (listeningLibraryRoute?.kind === 'library') {
    return <ListeningLibraryHome onBack={() => navigateInternal('/')} onNavigate={navigateInternal} />;
  }

  if (listeningLibraryRoute?.kind === 'module') {
    return (
      <ListeningModulePage
        moduleId={listeningLibraryRoute.moduleId}
        onBack={() => navigateInternal(examLibraryPath())}
        onNavigate={navigateInternal}
      />
    );
  }

  if (listeningLibraryRoute?.kind === 'paper') {
    return (
      <ListeningPaperPage
        moduleId={listeningLibraryRoute.moduleId}
        paperId={listeningLibraryRoute.paperId}
        onBack={() => navigateInternal(examModulePath(listeningLibraryRoute.moduleId))}
        onNavigate={navigateInternal}
      />
    );
  }

  if (listeningLibraryRoute?.kind === 'paper-exam') {
    return (
      <ListeningExamPage
        moduleId={listeningLibraryRoute.moduleId}
        paperId={listeningLibraryRoute.paperId}
        examId={listeningLibraryRoute.examId}
        accessToken={listeningLibraryRoute.accessToken}
        onBack={() => navigateInternal(listeningLibraryRoute.moduleId === 'writing' ? '/' : examModulePath(listeningLibraryRoute.moduleId))}
      />
    );
  }

  if (listeningLibraryRoute?.kind === 'exam') {
    return (
      <ListeningExamPage
        moduleId={listeningLibraryRoute.moduleId}
        examId={listeningLibraryRoute.examId}
        accessToken={listeningLibraryRoute.accessToken}
        onBack={() => navigateInternal(examModulePath(listeningLibraryRoute.moduleId))}
      />
    );
  }

  if (privateGrammarToken) {
    if (privateGrammarLoading) {
      return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mb-4" />
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
            <button onClick={() => navigateInternal('/')} className="w-full py-3 !bg-emerald-600 hover:!bg-emerald-700 !text-white font-bold text-sm rounded-2xl transition-all">Về trang chủ</button>
          </div>
        </div>
      );
    }
    return (
      <GrammarLearningArea
        grammarSet={privateGrammarSet}
        accessToken={privateGrammarToken || undefined}
        onBack={() => navigateInternal('/')}
      />
    );
  }

  if (privateAssignmentToken) {
    if (privateAssignmentLoading) {
      return (
        <div className="min-h-screen bg-gray-50 flex flex-col justify-center items-center p-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4" />
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
            <button onClick={() => navigateInternal('/')} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-2xl transition-all">Về trang chủ</button>
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
        onBack={() => navigateInternal('/')}
      />
    );
  }

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
          <button onClick={() => logout()} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-2xl transition-all shadow-md active:scale-98 cursor-pointer flex items-center justify-center space-x-2">
            <LogOut size={16} />
            <span>Đăng xuất tài khoản</span>
          </button>
        </div>
      </div>
    );
  }

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
    return <GrammarLearningArea grammarSet={selectedGrammarSet} onBack={() => setSelectedGrammarSet(null)} />;
  }

  if (studentHistoryOpen) {
    return <StudentHistoryPage authToken={token} onBack={() => navigateToStudentHistory(false)} />;
  }

  if (isStaff && !adminMode) {
    return (
      <div className="relative">
        <div className="bg-amber-500/20 backdrop-blur-md border-b border-amber-500/30 text-amber-900 px-4 py-2 flex justify-between items-center text-xs font-bold shadow-sm" id="admin-mode-banner">
          <span>⚠️ Bạn đang ở giao diện Quản Trị ({user?.role === 'super_admin' ? 'Super Admin' : 'Giáo viên'})</span>
          <div className="flex items-center space-x-3">
            <button onClick={() => setAdminMode(true)} className="bg-amber-600 hover:bg-amber-700 text-white border-0 px-3 py-1.5 rounded-xl transition-all cursor-pointer font-bold text-[10px]" id="view-student-page-btn">Xem trang học sinh</button>
            <button onClick={() => logout()} className="bg-gray-100 hover:bg-gray-200 text-gray-700 border-0 px-3 py-1.5 rounded-xl transition-all cursor-pointer font-bold text-[10px] flex items-center space-x-1" id="admin-banner-logout-btn">
              <LogOut size={12} />
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
        <AdminDashboard onViewAsStudent={handleViewAsStudent} onViewGrammarAsStudent={handleViewGrammarAsStudent} />
      </div>
    );
  }

  return (
    <HomePage
      adminMode={adminMode}
      filteredGrammarSets={home.filteredGrammarSets}
      filteredVocabSets={home.filteredVocabSets}
      grade={home.grade}
      gradeOptions={home.gradeOptions}
      isStaff={isStaff}
      leaderboard={home.leaderboard}
      leaderboardPeriod={home.leaderboardPeriod}
      onBackToAdmin={() => setAdminMode(false)}
      onLogout={logout}
      onNavigate={navigateInternal}
      onOpenGrammar={setSelectedGrammarSet}
      onOpenHistory={() => navigateToStudentHistory(true)}
      onOpenVocab={set => {
        setSelectedSet(set);
        setStudentName(user?.name || '');
      }}
      search={home.search}
      setGrade={home.setGrade}
      setLeaderboardPeriod={home.setLeaderboardPeriod}
      setSearch={home.setSearch}
      user={user}
    />
  );
}
