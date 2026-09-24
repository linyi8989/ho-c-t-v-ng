import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';

const LIBRARY_PAGE_SIZE_OPTIONS = [10, 20, 50];

function getPageItems(currentPage: number, totalPages: number): Array<number | 'ellipsis'> {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  if (currentPage <= 4) return [1, 2, 3, 4, 5, 'ellipsis', totalPages];
  if (currentPage >= totalPages - 3) {
    return [1, 'ellipsis', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }
  return [1, 'ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', totalPages];
}

interface LibraryPaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export default function LibraryPagination({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange
}: LibraryPaginationProps) {
  if (totalItems === 0) return null;

  const pageItems = getPageItems(currentPage, totalPages);
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 bg-white border border-gray-100 rounded-2xl shadow-sm">
      <p className="text-xs font-semibold text-gray-500">
        Hiển thị {Math.min((currentPage - 1) * pageSize + 1, totalItems)} - {Math.min(currentPage * pageSize, totalItems)} trên {totalItems}
      </p>
      <div className="flex items-center justify-between sm:justify-end gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Trang trước"
          >
            <ChevronLeft size={15} />
          </button>
          {pageItems.map((item, index) => item === 'ellipsis' ? (
            <span key={`ellipsis-${index}`} className="h-8 w-8 inline-flex items-center justify-center text-gray-400" aria-hidden="true">
              <MoreHorizontal size={15} />
            </span>
          ) : (
            <button
              type="button"
              key={item}
              onClick={() => onPageChange(item)}
              className={`h-8 min-w-8 px-2 inline-flex items-center justify-center rounded-lg text-xs font-bold transition-colors ${
                item === currentPage ? 'border border-blue-500 text-blue-700 bg-blue-50' : 'text-gray-600 hover:bg-gray-50'
              }`}
              aria-current={item === currentPage ? 'page' : undefined}
            >
              {item}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Trang sau"
          >
            <ChevronRight size={15} />
          </button>
        </div>
        <select
          value={pageSize}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          className="h-8 rounded-lg border border-blue-300 bg-white px-2 text-xs font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-blue-100"
          aria-label="Số dòng mỗi trang"
        >
          {LIBRARY_PAGE_SIZE_OPTIONS.map(size => <option key={size} value={size}>{size} / trang</option>)}
        </select>
      </div>
    </div>
  );
}
