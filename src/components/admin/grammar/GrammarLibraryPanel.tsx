import { Edit3, Plus, Search, X } from 'lucide-react';
import type { GameSession, GrammarQuestionType, GrammarSet } from '../../../types';
import { teacherLibraryPreviewPath } from '../../../appRoutes';
import { LibraryLinkStatus, LibraryRowActions } from '../LibraryRowControls';
import LibraryPagination from '../LibraryPagination';

export interface GrammarLibraryController {
  grammarSearchQuery: string;
  grammarFilterGrade: string;
  grammarFilterStatus: string;
  grammarGradeOptions: string[];
  paginatedGrammarSets: GrammarSet[];
  grammarTotalItems: number;
  grammarCurrentPage: number;
  grammarTotalPages: number;
  grammarPageSize: number;
  grammarResultsSet: GrammarSet | null;
  grammarResults: any[];
  canViewAsStudent: boolean;
  setGrammarSearchQuery: (value: string) => void;
  setGrammarFilterGrade: (value: string) => void;
  setGrammarFilterStatus: (value: string) => void;
  setGrammarPage: (value: number) => void;
  setGrammarPageSize: (value: number) => void;
  setGrammarResultsSet: (value: GrammarSet | null) => void;
  setGrammarResults: (value: any[]) => void;
  setSelectedActivity: (value: GameSession | null) => void;
  handleOpenNewGrammarEditor: (questionType?: GrammarQuestionType) => void;
  handleViewGrammarAsStudent: (set: GrammarSet) => Promise<void>;
  handleEditGrammarSet: (set: GrammarSet) => Promise<void>;
  handleCloneGrammarSet: (set: GrammarSet) => void;
  handleLoadGrammarResults: (set: GrammarSet) => void;
  handleDeleteGrammarSet: (set: GrammarSet) => void;
  getGrammarPrivateLink: (set: GrammarSet) => string;
  showNotification: (message: string, type?: 'success' | 'error') => void;
  formatGradeLabel: (value?: string) => string;
  formatVisibilityLabel: (value: string) => string;
  formatVietnamDateTime: (value?: string) => string;
  formatDuration: (value?: number) => string;
  grammarAttemptToActivity: (attempt: any, set?: GrammarSet | null) => GameSession;
}

export default function GrammarLibraryPanel({
  controller,
}: {
  controller: GrammarLibraryController;
}) {
  const {
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
    canViewAsStudent,
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
  } = controller;

  return (
          <div className="space-y-6 animate-fade-in" id="grammar-sets-tab-content">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <h2 className="text-2xl font-black text-gray-900">Kho bài ngữ pháp</h2>
                <p className="text-gray-500 text-sm">Quản lý bài luyện ngữ pháp trắc nghiệm và tự luận, kết quả và lịch sử làm bài.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleOpenNewGrammarEditor('multiple_choice')}
                  className="py-3 px-5 !bg-emerald-600 hover:!bg-emerald-700 !text-white !border !border-emerald-700 font-bold rounded-2xl flex items-center space-x-2 shadow-md transition-all cursor-pointer"
                >
                  <Plus size={18} />
                  <span>Soạn bài ngữ pháp</span>
                </button>
                <button
                  onClick={() => handleOpenNewGrammarEditor('rewrite')}
                  className="py-3 px-5 !bg-blue-600 hover:!bg-blue-700 !text-white !border !border-blue-700 font-bold rounded-2xl flex items-center space-x-2 shadow-md transition-all cursor-pointer"
                >
                  <Edit3 size={18} />
                  <span>Soạn bài tự luận</span>
                </button>
              </div>
            </div>

            <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Tìm kiếm bài ngữ pháp theo tên, chủ đề..."
                  value={grammarSearchQuery}
                  onChange={(event) => setGrammarSearchQuery(event.target.value)}
                  className="w-full p-3.5 pl-11 bg-gray-50 rounded-2xl outline-none focus:bg-white focus:ring-4 focus:ring-emerald-50 border border-gray-100 focus:border-emerald-400 font-semibold text-sm"
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={grammarFilterGrade}
                  onChange={(event) => setGrammarFilterGrade(event.target.value)}
                  className="p-3 bg-gray-50 border border-gray-100 hover:border-emerald-200 rounded-2xl outline-none text-sm font-semibold text-gray-600"
                >
                  <option value="">Tất cả Lớp học</option>
                  {grammarGradeOptions.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
                <select
                  value={grammarFilterStatus}
                  onChange={(event) => setGrammarFilterStatus(event.target.value)}
                  className="p-3 bg-gray-50 border border-gray-100 hover:border-emerald-200 rounded-2xl outline-none text-sm font-semibold text-gray-600"
                >
                  <option value="">Tất cả Trạng thái</option>
                  <option value="public">Công khai</option>
                  <option value="draft">Bản nháp</option>
                  <option value="assignment">Link riêng</option>
                </select>
              </div>
            </div>

            {/* Compact link list of grammar sets */}
            {grammarTotalItems === 0 ? (
              <div className="bg-white rounded-3xl p-12 border border-gray-100 text-center text-gray-400 font-semibold">
                Chưa có bài ngữ pháp nào khớp với điều kiện tìm kiếm.
              </div>
            ) : (
              <div className="space-y-3" id="grammar-sets-list">
                <div className="overflow-x-auto bg-white rounded-3xl border border-gray-100 shadow-sm">
                  <table className="w-full min-w-[1120px] text-left text-sm">
                    <thead className="bg-gray-50 text-[10px] uppercase font-black text-gray-500">
                      <tr>
                        <th className="px-4 py-3 w-12">STT</th>
                        <th className="px-4 py-3 min-w-[280px]">Bài ngữ pháp</th>
                        <th className="px-4 py-3">Lớp</th>
                        <th className="px-4 py-3">Chủ đề</th>
                        <th className="px-4 py-3">Số lượng</th>
                        <th className="px-4 py-3">Trạng thái</th>
                        <th className="px-4 py-3">Ngày tạo</th>
                        <th className="px-4 py-3">Link</th>
                        <th className="px-4 py-3 min-w-[360px]">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {paginatedGrammarSets.map((set, index) => {
                        const grammarLink = getGrammarPrivateLink(set);
                        const visibility = set.visibility || 'draft';
                        return (
                          <tr key={set.id} className="hover:bg-emerald-50/30 transition-colors">
                            <td className="px-4 py-4 font-bold text-gray-400">{(grammarCurrentPage - 1) * grammarPageSize + index + 1}</td>
                            <td className="px-4 py-4">
                              <button
                                type="button"
                                onClick={() => void handleViewGrammarAsStudent(set)}
                                className="block max-w-[320px] text-left font-black text-emerald-700 hover:text-emerald-900 hover:underline truncate"
                                title="Mở bài học"
                              >
                                {set.title}
                              </button>
                              <p className="mt-1 max-w-[320px] text-xs text-gray-500 line-clamp-2">{set.description || 'Chưa có mô tả'}</p>
                              <div className="mt-1 flex flex-wrap gap-1">
                                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                                  set.questionType === 'rewrite'
                                    ? 'bg-blue-50 text-blue-700'
                                    : 'bg-emerald-50 text-emerald-700'
                                }`}>
                                  {set.questionType === 'rewrite' ? 'Tự luận' : 'Trắc nghiệm'}
                                </span>
                                {(set.tags || []).slice(0, 3).map((tag, tagIndex) => (
                                  <span key={`${set.id}-tag-${tagIndex}`} className="text-[10px] font-semibold text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">#{tag}</span>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-4">
                              <span className="inline-flex whitespace-nowrap rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase text-emerald-700">
                                {formatGradeLabel(set.gradeLevel) || '--'}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-xs font-semibold text-gray-600">{set.topic || set.subject || '--'}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-xs font-bold text-gray-700">{set.questionCount ?? set.questions?.length ?? 0} câu</td>
                            <td className="px-4 py-4">
                              <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${
                                visibility === 'public' ? 'bg-emerald-50 text-emerald-700' :
                                visibility === 'draft' ? 'bg-amber-50 text-amber-700' : 'bg-indigo-50 text-indigo-700'
                              }`}>
                                {formatVisibilityLabel(visibility)}
                              </span>
                            </td>
                            <td className="px-4 py-4 whitespace-nowrap text-xs font-semibold text-gray-600">{formatVietnamDateTime(set.createdAt)}</td>
                            <td className="px-4 py-4">
                              <LibraryLinkStatus
                                visibility={visibility}
                                privateUrl={grammarLink}
                                onCopyPrivateLink={() => {
                                  navigator.clipboard?.writeText(grammarLink);
                                  showNotification('Đã copy link grammar riêng.');
                                }}
                              />
                            </td>
                            <td className="px-4 py-4">
                              <LibraryRowActions
                                playHref={teacherLibraryPreviewPath('grammar', set.id)}
                                onEdit={() => void handleEditGrammarSet(set)}
                                onClone={() => handleCloneGrammarSet(set)}
                                onResults={() => handleLoadGrammarResults(set)}
                                onDelete={() => handleDeleteGrammarSet(set)}
                                playDisabled={!canViewAsStudent}
                                playTitle={canViewAsStudent ? 'Play' : 'Chưa thể mở bài học'}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <LibraryPagination
                  currentPage={grammarCurrentPage}
                  totalPages={grammarTotalPages}
                  pageSize={grammarPageSize}
                  totalItems={grammarTotalItems}
                  onPageChange={setGrammarPage}
                  onPageSizeChange={setGrammarPageSize}
                />
              </div>
            )}

            {grammarResultsSet && (
              <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm space-y-4" id="grammar-results-panel">
                <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-4">
                  <div>
                    <h3 className="font-black text-gray-900">Kết quả: {grammarResultsSet.title}</h3>
                    <p className="text-xs text-gray-500">{grammarResults.length} lượt làm</p>
                  </div>
                  <button onClick={() => { setGrammarResultsSet(null); setGrammarResults([]); }} className="p-2 rounded-xl border border-gray-200 text-gray-600">
                    <X size={16} />
                  </button>
                </div>
                <div className="overflow-x-auto rounded-2xl border border-gray-200">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50 text-[10px] uppercase font-black text-gray-500">
                      <tr>
                        <th className="p-3">STT</th>
                        <th className="p-3">Học sinh</th>
                        <th className="p-3">Điểm</th>
                        <th className="p-3">Đúng/Sai/Bỏ trống</th>
                        <th className="p-3">Thời gian</th>
                        <th className="p-3">Ngày hoàn thành</th>
                        <th className="p-3">Chi tiet</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {grammarResults.length === 0 ? (
                        <tr><td colSpan={7} className="p-8 text-center text-gray-400">Chưa có học sinh hoàn thành bài này.</td></tr>
                      ) : grammarResults.map((attempt, index) => (
                        <tr key={attempt.id}>
                          <td className="p-3 font-bold text-gray-500">{index + 1}</td>
                          <td className="p-3 font-black text-gray-900">{attempt.studentName}</td>
                          <td className="p-3 font-black text-blue-700">{attempt.score}/{attempt.maxScore}</td>
                          <td className="p-3 text-xs font-bold text-gray-600">{attempt.correctCount}/{attempt.wrongCount}/{attempt.unansweredCount}</td>
                          <td className="p-3 text-xs font-bold text-gray-600">{formatDuration(attempt.durationSeconds)}</td>
                          <td className="p-3 text-xs font-bold text-gray-600">{formatVietnamDateTime(attempt.completedAt || attempt.createdAt)}</td>
                          <td className="p-3">
                            <button
                              onClick={() => setSelectedActivity(grammarAttemptToActivity(attempt, grammarResultsSet))}
                              className="px-3 py-1.5 rounded-xl !bg-blue-50 hover:!bg-blue-100 !text-blue-700 !border !border-blue-200 text-xs font-black"
                            >
                              Xem
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
  );
}

