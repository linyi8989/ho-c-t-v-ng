import React, { useEffect, useState } from 'react';
import { RotateCcw, Search } from 'lucide-react';
import {
  DEFAULT_HISTORY_FILTERS,
  LearningHistoryFilterOptions,
  LearningHistoryFilters,
  LearningHistoryKind
} from './historyTypes';

interface HistoryFiltersProps {
  filters: LearningHistoryFilters;
  options: LearningHistoryFilterOptions;
  disabled?: boolean;
  onChange: (changes: Partial<LearningHistoryFilters>) => void;
  onReset: () => void;
}

const TABS: Array<{ value: LearningHistoryKind; label: string }> = [
  { value: 'all', label: 'Tất cả' },
  { value: 'assignment', label: 'Bài được giao' },
  { value: 'practice', label: 'Tự luyện' }
];

export default function HistoryFilters({
  filters,
  options,
  disabled = false,
  onChange,
  onReset
}: HistoryFiltersProps) {
  const [searchText, setSearchText] = useState(filters.search || '');

  useEffect(() => {
    setSearchText(filters.search || '');
  }, [filters.search]);

  useEffect(() => {
    if (searchText === (filters.search || '')) return;
    const timer = window.setTimeout(() => {
      onChange({ search: searchText.trim() || undefined });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [filters.search, onChange, searchText]);

  const updateNumber = (key: 'scoreFrom' | 'scoreTo', value: string) => {
    if (!value) {
      onChange({ [key]: undefined });
      return;
    }
    const parsed = Number(value);
    onChange({ [key]: Number.isFinite(parsed) ? Math.min(100, Math.max(0, parsed)) : undefined });
  };

  return (
    <section
      className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-5"
      aria-labelledby="history-filter-heading"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="history-filter-heading" className="text-base font-black text-slate-900">
              Lọc lịch sử
            </h2>
            <p className="text-xs font-medium text-slate-500">
              Bộ lọc được xử lý an toàn trên máy chủ.
            </p>
          </div>
          <button
            type="button"
            onClick={onReset}
            disabled={disabled}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700"
          >
            <RotateCcw size={15} aria-hidden="true" />
            Đặt lại
          </button>
        </div>

        <div role="tablist" aria-label="Loại lịch sử" className="grid grid-cols-3 gap-2">
          {TABS.map(tab => {
            const selected = filters.historyType === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={selected}
                disabled={disabled}
                onClick={() => onChange({ historyType: tab.value })}
                className={`min-h-11 rounded-xl border px-3 text-sm font-black transition ${
                  selected
                    ? 'border-indigo-600 bg-indigo-600 text-white'
                    : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <label className="sm:col-span-2 xl:col-span-2">
            <span className="mb-1.5 block text-xs font-bold text-slate-600">Tìm tên bài</span>
            <span className="relative block">
              <Search
                size={16}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="search"
                value={searchText}
                onChange={event => setSearchText(event.target.value)}
                maxLength={100}
                disabled={disabled}
                placeholder="Nhập tên bài học hoặc bài tập"
                className="min-h-11 w-full rounded-xl border border-slate-300 bg-white py-2 pl-10 pr-3 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
              />
            </span>
          </label>

          <label>
            <span className="mb-1.5 block text-xs font-bold text-slate-600">Nội dung</span>
            <select
              value={filters.sourceType || ''}
              onChange={event => onChange({
                sourceType: (event.target.value || undefined) as LearningHistoryFilters['sourceType']
              })}
              disabled={disabled}
              className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
            >
              <option value="">Tất cả nội dung</option>
              <option value="vocabulary">Từ vựng</option>
              <option value="grammar">Ngữ pháp</option>
              <option value="listening">Nghe 5 Part</option>
              <option value="reading_writing">Reading &amp; Writing 6 Part</option>
            </select>
          </label>

          <label>
            <span className="mb-1.5 block text-xs font-bold text-slate-600">Trạng thái</span>
            <select
              value={filters.status || ''}
              onChange={event => onChange({
                status: (event.target.value || undefined) as LearningHistoryFilters['status']
              })}
              disabled={disabled}
              className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
            >
              <option value="">Tất cả trạng thái</option>
              <option value="completed">Đã hoàn thành</option>
              <option value="in_progress">Đang làm</option>
              <option value="interrupted">Bị gián đoạn</option>
            </select>
          </label>

          <label>
            <span className="mb-1.5 block text-xs font-bold text-slate-600">Từ ngày</span>
            <input
              type="date"
              value={filters.from || ''}
              max={filters.to}
              onChange={event => onChange({ from: event.target.value || undefined })}
              disabled={disabled}
              className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
            />
          </label>

          <label>
            <span className="mb-1.5 block text-xs font-bold text-slate-600">Đến ngày</span>
            <input
              type="date"
              value={filters.to || ''}
              min={filters.from}
              onChange={event => onChange({ to: event.target.value || undefined })}
              disabled={disabled}
              className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
            />
          </label>

          <label>
            <span className="mb-1.5 block text-xs font-bold text-slate-600">Lớp</span>
            <select
              value={filters.classId || ''}
              onChange={event => onChange({ classId: event.target.value || undefined })}
              disabled={disabled}
              className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
            >
              <option value="">Tất cả lớp</option>
              {options.classes.map(option => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-1.5 block text-xs font-bold text-slate-600">Bài học</span>
            <select
              value={filters.lessonId || ''}
              onChange={event => onChange({ lessonId: event.target.value || undefined })}
              disabled={disabled}
              className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
            >
              <option value="">Tất cả bài học</option>
              {options.lessons.map(option => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-1.5 block text-xs font-bold text-slate-600">Bài tập</span>
            <select
              value={filters.assignmentId || ''}
              onChange={event => onChange({ assignmentId: event.target.value || undefined })}
              disabled={disabled}
              className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
            >
              <option value="">Tất cả bài tập</option>
              {options.assignments.map(option => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-1.5 block text-xs font-bold text-slate-600">Game / hình thức</span>
            <select
              value={filters.gameId || ''}
              onChange={event => onChange({ gameId: event.target.value || undefined })}
              disabled={disabled}
              className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
            >
              <option value="">Tất cả hình thức</option>
              {options.games.map(option => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>

          <label>
            <span className="mb-1.5 block text-xs font-bold text-slate-600">Điểm từ</span>
            <input
              type="number"
              min={0}
              max={100}
              value={filters.scoreFrom ?? ''}
              onChange={event => updateNumber('scoreFrom', event.target.value)}
              disabled={disabled}
              className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
            />
          </label>

          <label>
            <span className="mb-1.5 block text-xs font-bold text-slate-600">Điểm đến</span>
            <input
              type="number"
              min={0}
              max={100}
              value={filters.scoreTo ?? ''}
              onChange={event => updateNumber('scoreTo', event.target.value)}
              disabled={disabled}
              className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
            />
          </label>

          <label>
            <span className="mb-1.5 block text-xs font-bold text-slate-600">Số bản ghi</span>
            <select
              value={filters.pageSize}
              onChange={event => onChange({ pageSize: Number(event.target.value) === 50 ? 50 : 20 })}
              disabled={disabled}
              className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900"
            >
              <option value={20}>20 bản ghi/trang</option>
              <option value={50}>50 bản ghi/trang</option>
            </select>
          </label>

          <label className="flex min-h-11 items-center gap-3 self-end rounded-xl border border-slate-200 px-3 py-2">
            <input
              type="checkbox"
              checked={Boolean(filters.groupByAssignment)}
              onChange={event => onChange({ groupByAssignment: event.target.checked || undefined })}
              disabled={disabled}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600"
            />
            <span className="text-xs font-bold text-slate-700">Nhóm lượt làm theo bài được giao</span>
          </label>
        </div>
      </div>
    </section>
  );
}

export function resetHistoryFilters(pageSize: 20 | 50 = DEFAULT_HISTORY_FILTERS.pageSize) {
  return { ...DEFAULT_HISTORY_FILTERS, pageSize };
}
