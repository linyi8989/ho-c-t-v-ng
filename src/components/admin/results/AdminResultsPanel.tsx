import { Search } from 'lucide-react';
import type { GameSession } from '../../../types';
import { GAMES_LIST } from '../../../lib/game-engine/gameList';
import type {
  getLeaderboardByCategory,
  LeaderboardCategory,
  LeaderboardPeriod,
} from '../../../lib/leaderboard';

type LeaderboardEntry = ReturnType<typeof getLeaderboardByCategory>[number];

export interface AdminResultsController {
  leaderboardPeriod: LeaderboardPeriod;
  leaderboardCategory: LeaderboardCategory;
  leaderboardClassId: string;
  leaderboardVocabSetId: string;
  leaderboardClassOptions: Array<{ id: string; name: string }>;
  leaderboardSetOptions: Array<{ id: string; title: string }>;
  leaderboardRows: LeaderboardEntry[];
  leaderboardTitleMap: Record<LeaderboardCategory, string>;
  activitySearch: string;
  filteredActivityResults: GameSession[];
  completedActivityResults: GameSession[];
  setLeaderboardPeriod: (value: LeaderboardPeriod) => void;
  setLeaderboardCategory: (value: LeaderboardCategory) => void;
  setLeaderboardClassId: (value: string) => void;
  setLeaderboardVocabSetId: (value: string) => void;
  setActivitySearch: (value: string) => void;
  openActivityDetail: (activity: GameSession) => Promise<void>;
  formatLeaderboardDisplayName: (entry: { studentName: string; className?: string }) => string;
  formatVietnamDateTime: (value?: string) => string;
  formatDuration: (value?: number) => string;
  getSessionEndTime: (session: GameSession) => string | undefined;
}

export default function AdminResultsPanel({
  controller,
}: {
  controller: AdminResultsController;
}) {
  const {
    leaderboardPeriod,
    leaderboardCategory,
    leaderboardClassId,
    leaderboardVocabSetId,
    leaderboardClassOptions,
    leaderboardSetOptions,
    leaderboardRows,
    leaderboardTitleMap,
    activitySearch,
    filteredActivityResults,
    completedActivityResults,
    setLeaderboardPeriod,
    setLeaderboardCategory,
    setLeaderboardClassId,
    setLeaderboardVocabSetId,
    setActivitySearch,
    openActivityDetail,
    formatLeaderboardDisplayName,
    formatVietnamDateTime,
    formatDuration,
    getSessionEndTime,
  } = controller;

  return (
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
  );
}

