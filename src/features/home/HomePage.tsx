import React from 'react';
import {
  Award,
  BookOpen,
  FileText,
  GraduationCap,
  History,
  LogOut,
  Play,
  Search,
  Star,
} from 'lucide-react';
import type { GrammarSet, VocabSet } from '../../types';
import type { LeaderboardPeriod } from '../../lib/leaderboard';
import { formatGradeLabel } from './homeSearch';
import { getWeeklyLearningQuote } from './homeContent';

const ListeningLibraryHome = React.lazy(() => import('../listening-library/student/ListeningLibraryHome'));

interface HomeUser {
  name?: string;
  role?: 'super_admin' | 'teacher' | 'student';
}

interface HomeLeaderboardEntry {
  studentKey?: string;
  studentName: string;
  honorScore: number;
  completedLessons: number;
  averageAccuracy: number;
  studyDays: number;
}

interface HomeLessonListProps<T extends { id: string }> {
  ariaLabel: string;
  getGrade: (item: T) => string;
  getTitle: (item: T) => string;
  getTopic: (item: T) => string;
  id: string;
  items: T[];
  onOpen: (item: T) => void;
  rowIdPrefix: string;
  tone: 'vocab' | 'grammar';
}

function HomeLessonList<T extends { id: string }>({
  ariaLabel,
  getGrade,
  getTitle,
  getTopic,
  id,
  items,
  onOpen,
  rowIdPrefix,
  tone,
}: HomeLessonListProps<T>) {
  return (
    <div className={`home-lesson-list home-lesson-list-${tone}`} id={id} role="table" aria-label={ariaLabel}>
      <div className="home-lesson-list-header" role="row">
        <span role="columnheader">STT</span>
        <span role="columnheader">Tên</span>
        <span role="columnheader">Khối lớp</span>
        <span role="columnheader">Chủ đề</span>
        <span role="columnheader">Thao tác</span>
      </div>
      {items.map((item, index) => {
        const title = getTitle(item);
        return (
          <div className="home-lesson-list-row" id={`${rowIdPrefix}-${item.id}`} role="row" key={item.id}>
            <span className="home-lesson-list-index" role="cell">{index + 1}</span>
            <span className="home-lesson-list-title" role="cell">{title}</span>
            <span className="home-lesson-list-grade" role="cell">
              <span className="home-lesson-mobile-label">Khối lớp: </span>
              {formatGradeLabel(getGrade(item)) || '—'}
            </span>
            <span className="home-lesson-list-topic" role="cell">
              <span className="home-lesson-mobile-label">Chủ đề: </span>
              {getTopic(item) || '—'}
            </span>
            <div className="home-lesson-list-action-cell" role="cell">
              <button
                type="button"
                className="home-lesson-list-action"
                onClick={() => onOpen(item)}
                aria-label={`Học bài ${title}`}
              >
                <Play size={14} aria-hidden="true" />
                <span>Học Bài</span>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface HomePageProps {
  adminMode: boolean;
  filteredGrammarSets: GrammarSet[];
  filteredVocabSets: VocabSet[];
  grade: string;
  gradeOptions: string[];
  grammarGrade: string;
  grammarGradeOptions: string[];
  grammarSearch: string;
  isStaff: boolean;
  leaderboard: HomeLeaderboardEntry[];
  leaderboardPeriod: LeaderboardPeriod;
  leaderboardStatus: 'idle' | 'loading' | 'ready' | 'unavailable';
  onBackToAdmin: () => void;
  onLogout: () => void | Promise<void>;
  onNavigate: (href: string) => void;
  onOpenGrammar: (set: GrammarSet) => void;
  onOpenHistory: () => void;
  onOpenVocab: (set: VocabSet) => void;
  search: string;
  setGrade: (value: string) => void;
  setGrammarGrade: (value: string) => void;
  setGrammarSearch: (value: string) => void;
  setLeaderboardPeriod: (value: LeaderboardPeriod) => void;
  setSearch: (value: string) => void;
  user: HomeUser | null;
}

export default function HomePage({
  adminMode,
  filteredGrammarSets,
  filteredVocabSets,
  grade,
  gradeOptions,
  grammarGrade,
  grammarGradeOptions,
  grammarSearch,
  isStaff,
  leaderboard,
  leaderboardPeriod,
  leaderboardStatus,
  onBackToAdmin,
  onLogout,
  onNavigate,
  onOpenGrammar,
  onOpenHistory,
  onOpenVocab,
  search,
  setGrade,
  setGrammarGrade,
  setGrammarSearch,
  setLeaderboardPeriod,
  setSearch,
  user,
}: HomePageProps) {
  const weeklyLearningQuote = React.useMemo(() => getWeeklyLearningQuote(), []);

  return (
    <div className="min-h-screen bg-transparent text-slate-100 flex flex-col animate-fade-in" id="app-root">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -z-10" />
      <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-3xl -z-10" />

      {isStaff && adminMode && (
        <div className="bg-indigo-600 text-white px-4 py-2 flex justify-between items-center text-xs font-bold shadow-sm" id="student-preview-admin-bar">
          <span>💡 Bạn đang xem giao diện với tư cách Học Sinh</span>
          <button
            onClick={onBackToAdmin}
            className="bg-white/20 hover:bg-white/30 text-white border border-white/40 px-3 py-1 rounded-xl transition-all cursor-pointer text-[10px]"
            id="back-to-admin-btn"
          >
            Quay lại trang Quản Trị
          </button>
        </div>
      )}

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
            <button
              type="button"
              onClick={onOpenHistory}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50 px-3 text-xs font-black text-indigo-700 transition-colors hover:bg-indigo-100"
              id="student-history-nav-btn"
              aria-label="Mở lịch sử học tập"
            >
              <History size={16} aria-hidden="true" />
              <span className="hidden sm:inline">Lịch sử học tập</span>
            </button>
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
                  onClick={onLogout}
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
                  onClick={() => onNavigate('/login')}
                  className="px-3 py-2 bg-gray-50 hover:bg-indigo-50 text-gray-600 hover:text-indigo-700 border border-gray-100 rounded-xl text-xs font-bold transition-all"
                  id="teacher-admin-login-btn"
                >
                  Giáo viên/Admin
                </button>
                <button
                  onClick={() => onNavigate('/reg')}
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

      <header className="max-w-6xl mx-auto px-4" id="home-hero">
        <div id="home-hero-copy">
          <h1 id="home-hero-title">
            <span className="home-hero-title-lead">
              Học từ vựng <span className="home-hero-title-joy">thật vui,</span>
            </span>
            <span className="home-hero-title-promise">
              Nhớ siêu lâu cùng <span className="home-hero-title-brand">Tiếng Anh Cô Diệu!</span>
            </span>
          </h1>
          <p className="text-gray-500 text-sm md:text-base leading-relaxed">
            Tiếng Anh Cô Diệu là nền tảng học từ vựng tiếng Anh hiện đại, được xây dựng với mong muốn giúp học sinh học dễ hơn, nhớ lâu hơn và tiến bộ mỗi ngày. Ứng dụng kết hợp bài học từ vựng với nhiều thể loại game luyện tập sinh động, âm thanh chuẩn xác và hệ thống giao bài tập tự động tiện lợi từ giáo viên.
          </p>
          <p className="text-gray-500 text-sm md:text-base leading-relaxed">
            Không chỉ là một công cụ học tập, Tiếng Anh Cô Diệu còn là nơi cô Diệu gửi gắm tâm huyết giảng dạy, sự kiên nhẫn và mong muốn đồng hành cùng từng học sinh trên hành trình chinh phục tiếng Anh. Mỗi bài học được thiết kế để các em vừa học, vừa chơi, vừa rèn phản xạ, giúp việc ghi nhớ từ vựng trở nên nhẹ nhàng và thú vị hơn.
          </p>
        </div>
        <figure id="home-hero-media">
          <img
            id="home-hero-image"
            src="/home-classroom-achievement.png"
            alt="Các học sinh Tiếng Anh Cô Diệu cùng nhận chứng nhận thành tích"
            decoding="async"
          />
        </figure>
      </header>

      <main className="max-w-6xl w-full mx-auto px-4 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 mt-4 pb-20">
        <section className="lg:col-span-8 space-y-6" id="home-sets-directory">
          <ListeningLibraryHome embedded onNavigate={onNavigate} />

          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pt-8 pb-4 border-t border-b border-gray-200">
            <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
              <GraduationCap className="text-indigo-600" size={24} />
              <span>Luyện từ vựng</span>
            </h2>
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-72">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Tìm bài học, ví dụ: số đếm, number..."
                  className="w-full p-2.5 pl-10 bg-white border border-gray-200 rounded-xl outline-none text-xs font-bold text-gray-600 placeholder-gray-400 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                />
              </div>
              <select
                value={grade}
                onChange={(event) => setGrade(event.target.value)}
                className="p-2.5 px-4 bg-white border border-gray-200 rounded-xl outline-none text-xs font-bold text-gray-600 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
              >
                <option value="">Tất cả khối lớp</option>
                {gradeOptions.map(option => <option key={option} value={option}>{formatGradeLabel(option)}</option>)}
              </select>
            </div>
          </div>

          {filteredVocabSets.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-3xl border border-gray-100 shadow-sm text-gray-400 text-sm">
              Chưa có bộ từ vựng công khai nào phù hợp.
            </div>
          ) : (
            <HomeLessonList
              ariaLabel="Danh sách bài học từ vựng"
              getGrade={set => set.gradeLevel}
              getTitle={set => set.title}
              getTopic={set => set.subject}
              id="home-sets-grid"
              items={filteredVocabSets}
              onOpen={onOpenVocab}
              rowIdPrefix="home-set"
              tone="vocab"
            />
          )}

          <div className="pt-8 space-y-4 border-t border-gray-200" id="home-grammar-directory">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
                <FileText className="text-emerald-600" size={22} />
                <span className="whitespace-nowrap">Luyện ngữ pháp</span>
              </h2>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <div className="relative w-full sm:w-72">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                  <input
                    id="home-grammar-search"
                    type="search"
                    value={grammarSearch}
                    onChange={(event) => setGrammarSearch(event.target.value)}
                    placeholder="Tìm bài ngữ pháp theo tên..."
                    aria-label="Tìm bài ngữ pháp theo tên"
                    className="w-full p-2.5 pl-10 bg-white border border-gray-200 rounded-xl outline-none text-xs font-bold text-gray-600 placeholder-gray-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50"
                  />
                </div>
                <select
                  id="home-grammar-grade-filter"
                  value={grammarGrade}
                  onChange={(event) => setGrammarGrade(event.target.value)}
                  aria-label="Lọc bài ngữ pháp theo khối lớp"
                  className="p-2.5 px-4 bg-white border border-gray-200 rounded-xl outline-none text-xs font-bold text-gray-600 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50"
                >
                  <option value="">Tất cả khối lớp</option>
                  {grammarGradeOptions.map(option => <option key={option} value={option}>{formatGradeLabel(option)}</option>)}
                </select>
              </div>
            </div>
            {filteredGrammarSets.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-3xl border border-gray-100 shadow-sm text-gray-400 text-sm">Chưa có bài ngữ pháp công khai phù hợp.</div>
            ) : (
              <HomeLessonList
                ariaLabel="Danh sách bài học ngữ pháp"
                getGrade={set => set.gradeLevel}
                getTitle={set => set.title}
                getTopic={set => set.topic || set.subject}
                id="home-grammar-list"
                items={filteredGrammarSets}
                onOpen={onOpenGrammar}
                rowIdPrefix="home-grammar"
                tone="grammar"
              />
            )}
          </div>
        </section>

        <aside className="lg:col-span-4 space-y-6" id="home-sidebar">
          <div className="bg-gradient-to-br from-slate-950 to-indigo-950 text-white rounded-3xl p-6 border border-white/10 shadow-md space-y-4" id="student-golden-board">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div className="flex items-center space-x-2">
                <Award className="text-amber-300 animate-pulse" size={20} />
                <h3 className="font-extrabold text-base">Bảng Vàng</h3>
              </div>
              <select value={leaderboardPeriod} onChange={(event) => setLeaderboardPeriod(event.target.value as LeaderboardPeriod)} className="bg-white/10 border border-white/10 rounded-xl px-2.5 py-1.5 text-[10px] font-black text-white outline-none" style={{ colorScheme: 'dark' }}>
                <option value="week">Tuần này</option>
                <option value="month">Tháng này</option>
              </select>
            </div>
            <p className="text-xs text-white/70 leading-relaxed">Vinh danh học sinh chăm học dựa trên kết quả chơi game, độ chính xác, số ngày học và mức tiến bộ. Mỗi bộ từ vựng và mỗi chế độ chơi chỉ tính kết quả tốt nhất.</p>
            {leaderboardStatus === 'loading' || leaderboardStatus === 'unavailable' ? (
              <div className="text-center py-6 text-white/70 text-xs font-semibold" role="status">Bảng vàng đang cập nhật. Vui lòng thử lại sau.</div>
            ) : leaderboard.length === 0 ? (
              <div className="text-center py-6 text-white/50 text-xs italic">Chưa có kết quả học tập nào để vinh danh.</div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  {leaderboard.slice(0, 3).map((entry, index) => (
                    <div key={entry.studentKey || entry.studentName} className="rounded-2xl bg-white/10 border border-white/10 p-3 text-center">
                      <div className="text-2xl">{index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}</div>
                      <p className="mt-1 truncate text-xs font-black">{entry.studentName}</p>
                      <p className="text-[10px] text-amber-200 font-bold">{entry.honorScore} điểm</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-2" id="home-leaderboard-list">
                  {leaderboard.map((entry, index) => (
                    <div key={`${entry.studentKey || entry.studentName}-${index}`} className="flex items-center justify-between rounded-2xl bg-white/5 border border-white/10 px-3 py-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-6 h-6 rounded-full bg-indigo-500/30 text-indigo-100 flex items-center justify-center text-[10px] font-black shrink-0">{index + 1}</span>
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

          <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-3xl p-6 shadow-md space-y-3" id="system-info-card">
            <div className="flex items-center space-x-1.5 text-indigo-300 font-bold text-xs">
              <Star size={14} className="fill-indigo-400 text-indigo-400" />
              <span>Tiếng Anh Cô Diệu</span>
            </div>
            <h4 className="font-extrabold text-sm">Nền tảng Học tập Toàn diện</h4>
            <p className="text-[11px] text-white/70 leading-relaxed">Thiết kế bởi Senior Fullstack Developer. Hỗ trợ học tập đa chiều, tự sinh IPA bằng trí tuệ nhân tạo, và phân tích chi tiết lỗ hổng từ vựng của học sinh.</p>
          </div>
        </aside>
      </main>

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
