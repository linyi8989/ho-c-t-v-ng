import { Award, BookOpen, Plus, Search, Star, Users } from 'lucide-react';
import type { GameSession } from '../../../types';
import { GAMES_LIST } from '../../../lib/game-engine/gameList';
import type {
  getLeaderboardByCategory,
  LeaderboardCategory,
  LeaderboardPeriod,
} from '../../../lib/leaderboard';

type LeaderboardEntry = ReturnType<typeof getLeaderboardByCategory>[number];

interface DashboardSummary {
  counts: {
    vocabSets: number;
    grammarSets: number;
    classes: number;
    assignments: number;
    activities: number;
    honoredStudents: number;
  };
}

export interface DashboardOverviewController {
  teacherDisplayName: string;
  dashboardSummary: DashboardSummary;
  recentResults: GameSession[];
  dashboardGoldRows: LeaderboardEntry[];
  isDashboardActivityExpanded: boolean;
  isDashboardLeaderboardExpanded: boolean;
  filteredActivityResults: GameSession[];
  completedActivityResults: GameSession[];
  activitySearch: string;
  leaderboardPeriod: LeaderboardPeriod;
  leaderboardCategory: LeaderboardCategory;
  leaderboardClassId: string;
  leaderboardVocabSetId: string;
  leaderboardClassOptions: Array<{ id: string; name: string }>;
  leaderboardSetOptions: Array<{ id: string; title: string }>;
  leaderboardRows: LeaderboardEntry[];
  leaderboardTitleMap: Record<LeaderboardCategory, string>;
  handleOpenNewEditor: () => void;
  toggleDashboardActivity: () => Promise<void>;
  toggleDashboardLeaderboard: () => Promise<void>;
  openActivityDetail: (activity: GameSession) => Promise<void>;
  setActivitySearch: (value: string) => void;
  setLeaderboardPeriod: (value: LeaderboardPeriod) => void;
  setLeaderboardCategory: (value: LeaderboardCategory) => void;
  setLeaderboardClassId: (value: string) => void;
  setLeaderboardVocabSetId: (value: string) => void;
  formatLeaderboardDisplayName: (entry: { studentName: string; className?: string }) => string;
  formatVietnamDateTime: (value?: string) => string;
  formatDuration: (value?: number) => string;
  getSessionEndTime: (session: GameSession) => string | undefined;
}

export default function DashboardOverviewPanel({
  controller,
}: {
  controller: DashboardOverviewController;
}) {
  const {
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
  } = controller;

  return (
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
                  <span className="text-2xl font-black text-gray-800">{dashboardSummary.counts.vocabSets}</span>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center space-x-4">
                <span className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl shrink-0">
                  <Users size={24} />
                </span>
                <div>
                  <span className="text-xs font-bold text-gray-400 block uppercase">LỚP HỌC</span>
                  <span className="text-2xl font-black text-gray-800">{dashboardSummary.counts.classes}</span>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center space-x-4">
                <span className="p-3 bg-amber-50 text-amber-600 rounded-2xl shrink-0">
                  <Star size={24} />
                </span>
                <div>
                  <span className="text-xs font-bold text-gray-400 block uppercase">HỌC SINH VINH DANH</span>
                  <span className="text-2xl font-black text-gray-800">{dashboardSummary.counts.honoredStudents}</span>
                </div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex items-center space-x-4">
                <span className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl shrink-0">
                  <Award size={24} />
                </span>
                <div>
                  <span className="text-xs font-bold text-gray-400 block uppercase">LƯỢT HOÀN THÀNH</span>
                  <span className="text-2xl font-black text-gray-800">{dashboardSummary.counts.activities}</span>
                </div>
              </div>
            </div>

            {/* Recent activity grids */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

              {/* Left Column: Recent Student Results */}
              <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-gray-50">
                  <h3 className="font-extrabold text-gray-800 text-base">Hoạt động luyện tập gần đây</h3>
                  <button onClick={() => void toggleDashboardActivity()} className="text-xs font-bold text-indigo-600 hover:underline">{isDashboardActivityExpanded ? 'Thu gọn' : 'Xem tất cả'}</button>
                </div>

                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                  {recentResults.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm">Chưa có học sinh nào hoàn thành trò chơi.</div>
                  ) : (
                    recentResults.map((res) => (
                      <button
                        key={res.id}
                        onClick={() => void openActivityDetail(res)}
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
                  <button onClick={() => void toggleDashboardLeaderboard()} className="text-xs font-bold text-indigo-600 hover:underline">{isDashboardLeaderboardExpanded ? 'Thu gọn' : 'Xem bảng vàng'}</button>
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
                        onClick={() => void openActivityDetail(res)}
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
  );
}
