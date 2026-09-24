import { ChevronDown, Search, SlidersHorizontal, X } from 'lucide-react';
import type { GameSession, VocabSet } from '../../../types';

interface VocabularyResultsPanelProps {
  set: VocabSet;
  results: GameSession[];
  filteredResults: GameSession[];
  isLoading: boolean;
  hasFilter: boolean;
  nameFilter: string;
  gameFilter: string;
  gameDropdownOpen: boolean;
  gameOptions: Array<{ gameId: string; title: string }>;
  onNameFilterChange: (value: string) => void;
  onGameFilterChange: (value: string) => void;
  onGameDropdownOpenChange: (open: boolean) => void;
  onClose: () => void;
  onSelectActivity: (session: GameSession) => void;
  formatDisplayName: (entry: { studentName: string; className?: string }) => string;
  formatDuration: (totalSeconds?: number) => string;
  formatDateTime: (value?: string) => string;
}

export default function VocabularyResultsPanel({
  set,
  results,
  filteredResults,
  isLoading,
  hasFilter,
  nameFilter,
  gameFilter,
  gameDropdownOpen,
  gameOptions,
  onNameFilterChange,
  onGameFilterChange,
  onGameDropdownOpenChange,
  onClose,
  onSelectActivity,
  formatDisplayName,
  formatDuration,
  formatDateTime
}: VocabularyResultsPanelProps) {
  return (
    <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm space-y-4" id="vocab-results-panel">
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-4">
        <div>
          <h3 className="font-black text-gray-900">Kết quả: {set.title}</h3>
          <p className="text-xs text-gray-500">
            {isLoading
              ? 'Đang tải kết quả...'
              : hasFilter
                ? `Hiển thị ${filteredResults.length}/${results.length} lượt chơi`
                : `${results.length} lượt chơi`}
          </p>
        </div>
        <button
          onClick={onClose}
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
            value={nameFilter}
            onChange={event => onNameFilterChange(event.target.value)}
            placeholder="Tìm theo tên học sinh..."
            aria-label="Tìm kết quả theo tên học sinh"
            className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm font-bold text-gray-800 outline-none transition-all placeholder:text-gray-400 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-50"
          />
        </div>
        <div className="relative">
          <button
            id="vocab-results-game-filter-btn"
            type="button"
            onClick={() => onGameDropdownOpenChange(!gameDropdownOpen)}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-bold text-gray-700 hover:bg-gray-100"
            aria-haspopup="listbox"
            aria-expanded={gameDropdownOpen}
            aria-controls="vocab-results-game-filter-options"
          >
            <SlidersHorizontal size={15} />
            {gameFilter
              ? gameOptions.find(game => game.gameId === gameFilter)?.title || gameFilter
              : 'Tất cả trò chơi'}
            <ChevronDown size={13} />
          </button>
          {gameDropdownOpen && (
            <div
              id="vocab-results-game-filter-options"
              className="absolute right-0 top-full z-20 mt-1 w-56 rounded-2xl border border-gray-200 bg-white py-1 shadow-lg"
              role="listbox"
              aria-label="Lọc kết quả theo trò chơi"
            >
              <button
                type="button"
                role="option"
                aria-selected={gameFilter === ''}
                onClick={() => {
                  onGameFilterChange('');
                  onGameDropdownOpenChange(false);
                }}
                className={`w-full px-4 py-2 text-left text-sm font-bold hover:bg-gray-50 ${gameFilter === '' ? 'text-blue-700' : 'text-gray-700'}`}
              >
                Tất cả trò chơi
              </button>
              {gameOptions.map(game => (
                <button
                  key={game.gameId}
                  type="button"
                  role="option"
                  aria-selected={gameFilter === game.gameId}
                  onClick={() => {
                    onGameFilterChange(game.gameId);
                    onGameDropdownOpenChange(false);
                  }}
                  className={`w-full px-4 py-2 text-left text-sm font-bold hover:bg-gray-50 ${gameFilter === game.gameId ? 'text-blue-700' : 'text-gray-700'}`}
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
            {isLoading ? (
              <tr><td colSpan={9} className="p-8 text-center text-gray-400">Đang tải kết quả...</td></tr>
            ) : results.length === 0 ? (
              <tr><td colSpan={9} className="p-8 text-center text-gray-400">Chưa có lượt học nào trong bộ từ này.</td></tr>
            ) : filteredResults.length === 0 ? (
              <tr><td colSpan={9} className="p-8 text-center text-gray-400">Không có kết quả khớp với bộ lọc.</td></tr>
            ) : filteredResults.map((session, index) => {
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
                    {formatDisplayName({ studentName: session.studentName || 'Học sinh', className: session.className })}
                  </td>
                  <td className="p-3 text-xs font-bold text-gray-600">{session.gameName || session.gameId}</td>
                  <td className="p-3"><span className={`rounded-full px-2 py-1 text-[10px] font-black ${session.completedAt ? 'bg-emerald-50 text-emerald-700' : (session as GameSession & { displayStatus?: string }).displayStatus === 'abandoned' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>{session.completedAt ? 'Đã hoàn thành' : (session as GameSession & { displayStatus?: string }).displayStatus === 'abandoned' ? 'Gián đoạn' : 'Đang làm'}</span></td>
                  <td className="p-3 font-black text-blue-700">{session.completedAt ? session.score : '--'}</td>
                  <td className="p-3 text-xs font-bold text-gray-600">
                    {session.completedAt ? `${session.correctAnswers}/${session.incorrectAnswers}/${unansweredCount}` : '--'}
                  </td>
                  <td className="p-3 text-xs font-bold text-gray-600">
                    {formatDuration(session.durationSeconds || Math.round((session.durationMs || 0) / 1000))}
                  </td>
                  <td className="p-3 text-xs font-bold text-gray-600">
                    {formatDateTime(session.endedAt || session.completedAt || session.createdAt)}
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => onSelectActivity(session)}
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
  );
}
