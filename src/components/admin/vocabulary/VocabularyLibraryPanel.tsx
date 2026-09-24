import type { ReactNode } from 'react';
import { Copy, Plus, Search } from 'lucide-react';
import type { VocabSet } from '../../../types';
import { teacherLibraryPreviewPath } from '../../../appRoutes';
import LibraryPagination from '../LibraryPagination';
import { LibraryPlayAction } from '../LibraryRowControls';

type VocabVisibility = 'public' | 'assignment' | 'draft';

interface VocabularyLibraryPanelProps {
  searchQuery: string;
  filterGrade: string;
  filterStatus: string;
  gradeOptions: string[];
  paginatedSets: VocabSet[];
  totalItems: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  resultsPanel?: ReactNode;
  onSearchQueryChange: (value: string) => void;
  onFilterGradeChange: (value: string) => void;
  onFilterStatusChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onOpenNew: () => void;
  onViewAsStudent: (set: VocabSet) => void;
  onEdit: (set: VocabSet) => void;
  onClone: (setId: string) => void;
  onResults: (set: VocabSet) => void;
  onDelete: (setId: string) => void;
  onNotify: (message: string) => void;
  getVisibility: (set: VocabSet) => VocabVisibility;
  getPrivateLink: (set: VocabSet) => string;
  formatGrade: (value?: string) => string;
  formatDateTime: (value?: string) => string;
  formatVisibility: (value: string) => string;
}

export default function VocabularyLibraryPanel({
  searchQuery,
  filterGrade,
  filterStatus,
  gradeOptions,
  paginatedSets,
  totalItems,
  currentPage,
  totalPages,
  pageSize,
  resultsPanel,
  onSearchQueryChange,
  onFilterGradeChange,
  onFilterStatusChange,
  onPageChange,
  onPageSizeChange,
  onOpenNew,
  onViewAsStudent,
  onEdit,
  onClone,
  onResults,
  onDelete,
  onNotify,
  getVisibility,
  getPrivateLink,
  formatGrade,
  formatDateTime,
  formatVisibility
}: VocabularyLibraryPanelProps) {
  return (
    <div className="space-y-6 animate-fade-in" id="sets-tab-content">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-black text-gray-800">Kho từ vựng của tôi</h2>
          <p className="text-gray-400 text-sm">Nơi lưu trữ và soạn thảo các bộ thẻ từ vựng để giao cho học sinh.</p>
        </div>
        <button
          onClick={onOpenNew}
          className="py-3 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl flex items-center space-x-2 shadow-md transition-all cursor-pointer active:scale-95"
        >
          <Plus size={18} />
          <span>Soạn bộ từ mới</span>
        </button>
      </div>

      <div className="bg-white p-4 rounded-3xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Tìm kiếm bộ từ vựng theo tên, mô tả, môn học..."
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            className="w-full p-3.5 pl-11 bg-gray-50 rounded-2xl outline-none focus:bg-white focus:ring-4 focus:ring-indigo-50 border border-gray-100 focus:border-indigo-400 font-semibold text-sm"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={filterGrade}
            onChange={(event) => onFilterGradeChange(event.target.value)}
            className="p-3 bg-gray-50 border border-gray-100 hover:border-indigo-200 rounded-2xl outline-none text-sm font-semibold text-gray-600"
          >
            <option value="">Tất cả Lớp học</option>
            {gradeOptions.map(option => (
              <option key={option} value={option}>{formatGrade(option)}</option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(event) => onFilterStatusChange(event.target.value)}
            className="p-3 bg-gray-50 border border-gray-100 hover:border-indigo-200 rounded-2xl outline-none text-sm font-semibold text-gray-600"
          >
            <option value="">Tất cả Trạng thái</option>
            <option value="public">Công khai</option>
            <option value="draft">Bản nháp</option>
            <option value="assignment">Giao bài tập bằng link riêng</option>
          </select>
        </div>
      </div>

      {totalItems === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-gray-100 shadow-sm text-gray-400 font-medium">
          Không tìm thấy bộ từ vựng nào khớp với điều kiện tìm kiếm.
        </div>
      ) : (
        <div className="space-y-3" id="sets-list">
          <div className="overflow-x-auto bg-white rounded-3xl border border-gray-100 shadow-sm">
            <table className="w-full min-w-[1120px] text-left text-sm">
              <thead className="bg-gray-50 text-[10px] uppercase font-black text-gray-500">
                <tr>
                  <th className="px-4 py-3 w-12">STT</th>
                  <th className="px-4 py-3 min-w-[280px]">Bộ từ vựng</th>
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
                {paginatedSets.map((set, index) => {
                  const visibility = getVisibility(set);
                  const assignmentLink = getPrivateLink(set);
                  return (
                    <tr key={set.id} id={`set-row-${set.id}`} className="hover:bg-indigo-50/30 transition-colors">
                      <td className="px-4 py-4 font-bold text-gray-400">{(currentPage - 1) * pageSize + index + 1}</td>
                      <td className="px-4 py-4">
                        <button
                          type="button"
                          onClick={() => onViewAsStudent(set)}
                          className="block max-w-[320px] text-left font-black text-indigo-700 hover:text-indigo-900 hover:underline truncate"
                          title="Mở bài học"
                        >
                          {set.title}
                        </button>
                        <p className="mt-1 max-w-[320px] text-xs text-gray-500 line-clamp-2">{set.description || 'Chưa có mô tả'}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {(set.tags || []).slice(0, 3).map((tag, tagIndex) => (
                            <span key={`${set.id}-tag-${tagIndex}`} className="text-[10px] font-semibold text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">#{tag}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-flex whitespace-nowrap rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-1 text-[10px] font-black uppercase text-indigo-700">
                          {formatGrade(set.gradeLevel) || '--'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-xs font-semibold text-gray-600">{set.subject || '--'}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-xs font-bold text-gray-700">{set.itemCount ?? set.items?.length ?? 0} từ</td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${
                          visibility === 'public' ? 'bg-emerald-50 text-emerald-700' :
                          visibility === 'draft' ? 'bg-amber-50 text-amber-700' : 'bg-indigo-50 text-indigo-700'
                        }`}>
                          {formatVisibility(visibility)}
                        </span>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-xs font-semibold text-gray-600">{formatDateTime(set.createdAt)}</td>
                      <td className="px-4 py-4">
                        {visibility === 'assignment' && assignmentLink ? (
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(assignmentLink);
                              onNotify('Đã copy link giao bài.');
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-[10px] font-black text-indigo-700 hover:bg-indigo-100"
                            title="Copy link giao bài"
                          >
                            <Copy size={13} />
                            Link riêng
                          </button>
                        ) : <span className="text-xs text-gray-300">--</span>}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          <LibraryPlayAction href={teacherLibraryPreviewPath('vocabulary', set.id)} />
                          <button type="button" onClick={() => onEdit(set)} className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[11px] font-black text-blue-700 hover:bg-blue-100">Sửa</button>
                          <button type="button" onClick={() => onClone(set.id)} className="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-[11px] font-black text-indigo-700 hover:bg-indigo-100">Sao chép</button>
                          <button type="button" onClick={() => onResults(set)} className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-black text-amber-700 hover:bg-amber-100">Kết quả</button>
                          <button type="button" onClick={() => onDelete(set.id)} className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-black text-rose-700 hover:bg-rose-100">Xóa</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <LibraryPagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={totalItems}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />
        </div>
      )}

      {resultsPanel}
    </div>
  );
}
