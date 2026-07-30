import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  BookOpenCheck,
  ChevronLeft,
  ChevronRight,
  History,
  KeyRound,
  LoaderCircle,
  LogIn,
  RotateCcw,
  ShieldAlert
} from 'lucide-react';
import {
  fetchLearningHistory,
  fetchLearningHistoryDetail,
  LearningHistoryApiError
} from '../../lib/api/learningHistory';
import {
  getStoredGuestAccessCredential,
  getStoredGuestId
} from '../../lib/guestIdentity';
import AssignmentHistoryGroup from './AssignmentHistoryGroup';
import HistoryDetailModal from './HistoryDetailModal';
import HistoryFilters, { resetHistoryFilters } from './HistoryFilters';
import HistoryList from './HistoryList';
import HistorySummary from './HistorySummary';
import {
  DEFAULT_HISTORY_FILTERS,
  EMPTY_HISTORY_FILTER_OPTIONS,
  EMPTY_HISTORY_SUMMARY,
  LearningHistoryDetailResponse,
  LearningHistoryFilters,
  LearningHistoryItem,
  LearningHistoryResponse
} from './historyTypes';

interface StudentHistoryPageProps {
  authToken?: string | null;
  onBack: () => void;
}

type GuestAccessIssue = 'missing_identity' | 'recovery_required' | null;

function GuestRecoveryState({
  issue,
  onBack
}: {
  issue: Exclude<GuestAccessIssue, null>;
  onBack: () => void;
}) {
  const isMissingIdentity = issue === 'missing_identity';
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-xl rounded-3xl border border-amber-200 bg-white p-6 text-center shadow-sm sm:p-8">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-amber-700">
          {isMissingIdentity
            ? <KeyRound size={30} aria-hidden="true" />
            : <ShieldAlert size={30} aria-hidden="true" />}
        </span>
        <h1 className="mt-5 text-2xl font-black">
          {isMissingIdentity
            ? 'Chưa có hồ sơ học tập trên thiết bị này'
            : 'Cần khôi phục quyền xem lịch sử'}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm font-medium leading-relaxed text-slate-600">
          {isMissingIdentity
            ? 'Hãy bắt đầu một bài học và nhập tên để tạo hồ sơ, hoặc đăng nhập tài khoản học sinh đã có.'
            : 'Thiết bị này còn hồ sơ học sinh nhưng không còn mã truy cập lịch sử. Vui lòng nhờ giáo viên xác minh và cấp lại quyền.'}
        </p>
        <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
          Mở trang này không tạo hồ sơ khách mới và không xác minh bằng tên học sinh.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700"
          >
            <ArrowLeft size={17} aria-hidden="true" />
            Về trang học
          </button>
          <button
            type="button"
            onClick={() => { window.location.href = '/login'; }}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-black text-white"
          >
            <LogIn size={17} aria-hidden="true" />
            Đăng nhập
          </button>
        </div>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white px-5 py-14 text-center shadow-sm" role="status">
      <LoaderCircle className="mx-auto animate-spin text-indigo-600" size={34} aria-hidden="true" />
      <p className="mt-3 text-sm font-black text-slate-700">Đang tải lịch sử học tập...</p>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-3xl border border-rose-200 bg-white px-5 py-12 text-center shadow-sm" role="alert">
      <ShieldAlert className="mx-auto text-rose-600" size={34} aria-hidden="true" />
      <h2 className="mt-4 text-lg font-black text-slate-900">Không thể tải lịch sử học tập.</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm font-medium text-slate-600">
        {message || 'Vui lòng thử lại.'}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 text-sm font-black text-white"
      >
        <RotateCcw size={16} aria-hidden="true" />
        Thử lại
      </button>
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  totalItems,
  disabled,
  onPageChange
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  disabled: boolean;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) {
    return totalItems > 0 ? (
      <p className="text-center text-xs font-semibold text-slate-500">
        Hiển thị toàn bộ {totalItems} lượt làm.
      </p>
    ) : null;
  }

  return (
    <nav
      className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:flex-row"
      aria-label="Phân trang lịch sử học tập"
    >
      <p className="text-xs font-semibold text-slate-500">
        Trang <strong className="text-slate-900">{page}</strong> / {totalPages} · {totalItems} lượt
      </p>
      <div className="flex w-full gap-2 sm:w-auto">
        <button
          type="button"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 disabled:opacity-40 sm:flex-none"
        >
          <ChevronLeft size={17} aria-hidden="true" />
          Trang trước
        </button>
        <button
          type="button"
          disabled={disabled || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-xl border border-indigo-600 bg-indigo-600 px-4 text-sm font-black text-white disabled:border-slate-300 disabled:bg-slate-200 disabled:text-slate-500 sm:flex-none"
        >
          Trang sau
          <ChevronRight size={17} aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}

export default function StudentHistoryPage({
  authToken,
  onBack
}: StudentHistoryPageProps) {
  const guestState = useMemo(() => {
    if (authToken) return { credential: null, issue: null as GuestAccessIssue };
    const guestId = getStoredGuestId();
    if (!guestId) {
      return { credential: null, issue: 'missing_identity' as GuestAccessIssue };
    }
    const credential = getStoredGuestAccessCredential(guestId);
    return {
      credential,
      issue: credential ? null : 'recovery_required' as GuestAccessIssue
    };
  }, [authToken]);
  const actor = useMemo(() => ({
    authToken,
    guestCredential: guestState.credential
  }), [authToken, guestState.credential]);

  const [filters, setFilters] = useState<LearningHistoryFilters>(DEFAULT_HISTORY_FILTERS);
  const [data, setData] = useState<LearningHistoryResponse | null>(null);
  const [loading, setLoading] = useState(!guestState.issue);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [accessIssue, setAccessIssue] = useState<GuestAccessIssue>(guestState.issue);

  const [selectedItem, setSelectedItem] = useState<LearningHistoryItem | null>(null);
  const [detailResponse, setDetailResponse] = useState<LearningHistoryDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const detailTriggerRef = useRef<HTMLButtonElement | null>(null);
  const detailAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setAccessIssue(guestState.issue);
  }, [guestState.issue]);

  useEffect(() => {
    if (accessIssue) {
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError('');
    fetchLearningHistory(filters, actor, controller.signal)
      .then(response => {
        setData(response);
        if (
          response.pagination.totalPages > 0
          && filters.page > response.pagination.totalPages
        ) {
          setFilters(current => ({
            ...current,
            page: response.pagination.totalPages
          }));
        }
      })
      .catch(requestError => {
        if (controller.signal.aborted) return;
        if (
          requestError instanceof LearningHistoryApiError
          && (
            requestError.code === 'GUEST_HISTORY_RECOVERY_REQUIRED'
            || requestError.code === 'GUEST_CAPABILITY_REQUIRED'
            || requestError.code === 'GUEST_CAPABILITY_INVALID'
          )
        ) {
          setAccessIssue('recovery_required');
          return;
        }
        setError(requestError instanceof Error ? requestError.message : 'Vui lòng thử lại.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [accessIssue, actor, filters, refreshKey]);

  useEffect(() => () => detailAbortRef.current?.abort(), []);

  const changeFilters = useCallback((changes: Partial<LearningHistoryFilters>) => {
    setFilters(current => ({
      ...current,
      ...changes,
      page: 1
    }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(current => resetHistoryFilters(current.pageSize));
  }, []);

  const loadDetail = useCallback((item: LearningHistoryItem) => {
    detailAbortRef.current?.abort();
    const controller = new AbortController();
    detailAbortRef.current = controller;
    setSelectedItem(item);
    setDetailResponse(null);
    setDetailError('');
    setDetailLoading(true);
    fetchLearningHistoryDetail(item.attemptId, actor, controller.signal)
      .then(setDetailResponse)
      .catch(requestError => {
        if (controller.signal.aborted) return;
        setDetailError(
          requestError instanceof Error ? requestError.message : 'Vui lòng thử lại.'
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailLoading(false);
      });
  }, [actor]);

  const openDetail = useCallback((
    item: LearningHistoryItem,
    trigger: HTMLButtonElement
  ) => {
    detailTriggerRef.current = trigger;
    loadDetail(item);
  }, [loadDetail]);

  const closeDetail = useCallback(() => {
    detailAbortRef.current?.abort();
    detailAbortRef.current = null;
    setSelectedItem(null);
    setDetailResponse(null);
    setDetailLoading(false);
    setDetailError('');
  }, []);

  if (accessIssue) {
    return <GuestRecoveryState issue={accessIssue} onBack={onBack} />;
  }

  const summary = data?.summary || EMPTY_HISTORY_SUMMARY;
  const options = data?.filterOptions || EMPTY_HISTORY_FILTER_OPTIONS;
  const pagination = data?.pagination || {
    page: filters.page,
    pageSize: filters.pageSize,
    totalItems: 0,
    totalPages: 0
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 text-sm font-black text-slate-700"
          >
            <ArrowLeft size={18} aria-hidden="true" />
            <span className="hidden sm:inline">Về trang học</span>
            <span className="sm:hidden">Quay lại</span>
          </button>
          <div className="min-w-0 text-right">
            <p className="flex items-center justify-end gap-1 text-xs font-black uppercase tracking-wide text-indigo-600">
              <History size={14} aria-hidden="true" />
              Hồ sơ học tập
            </p>
            <p className="truncate text-sm font-black text-slate-900">Tiếng Anh Cô Diệu</p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6 sm:py-8">
        <section className="rounded-3xl bg-gradient-to-br from-indigo-700 to-slate-950 p-5 text-white shadow-lg sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-200">
                Tiến bộ qua từng ngày
              </p>
              <h1 className="mt-2 text-2xl font-black sm:text-3xl">Lịch sử học tập</h1>
              <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-indigo-100">
                Xem lại các lượt học từ vựng, ngữ pháp và kết quả từng bài trên thiết bị hoặc tài khoản của bạn.
              </p>
            </div>
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-indigo-100">
              <BookOpenCheck size={32} aria-hidden="true" />
            </span>
          </div>
        </section>

        <HistorySummary summary={summary} />
        <HistoryFilters
          filters={filters}
          options={options}
          disabled={loading}
          onChange={changeFilters}
          onReset={resetFilters}
        />

        {loading && !data ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={error} onRetry={() => setRefreshKey(value => value + 1)} />
        ) : (
          <>
            {loading && (
              <p className="flex items-center justify-center gap-2 rounded-xl bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700" role="status">
                <LoaderCircle className="animate-spin" size={15} aria-hidden="true" />
                Đang cập nhật kết quả...
              </p>
            )}
            {filters.groupByAssignment && (data?.items.length || 0) > 0 ? (
              <AssignmentHistoryGroup
                items={data?.items || []}
                summaries={data?.assignmentGroups}
                onViewDetail={openDetail}
              />
            ) : (
              <HistoryList items={data?.items || []} onViewDetail={openDetail} />
            )}
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.totalItems}
              disabled={loading}
              onPageChange={page => {
                setFilters(current => ({ ...current, page }));
                if (typeof window !== 'undefined') {
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }
              }}
            />
          </>
        )}
      </main>

      <HistoryDetailModal
        open={Boolean(selectedItem)}
        item={selectedItem}
        response={detailResponse}
        loading={detailLoading}
        error={detailError}
        returnFocus={detailTriggerRef.current}
        onClose={closeDetail}
        onRetry={() => {
          if (selectedItem) loadDetail(selectedItem);
        }}
      />
    </div>
  );
}
