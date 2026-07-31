import React, { useEffect, useRef } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  RotateCcw,
  X,
  XCircle
} from 'lucide-react';
import {
  LearningHistoryDetailResponse,
  LearningHistoryItem,
  NormalizedHistoryDetailEntry,
  formatHistoryDateTime,
  formatHistoryDuration,
  normalizeHistoryDetailEntries,
  resolveHistoryOptionAnswer
} from './historyTypes';

interface HistoryDetailModalProps {
  open: boolean;
  item: LearningHistoryItem | null;
  response: LearningHistoryDetailResponse | null;
  loading: boolean;
  error: string;
  returnFocus?: HTMLButtonElement | null;
  onClose: () => void;
  onRetry: () => void;
}

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

function firstValue(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value) && value.length === 0) continue;
    if (value !== undefined && value !== null && value !== '') return value;
  }
  return undefined;
}

function readableValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Có' : 'Không';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) {
    return value.map(readableValue).filter(valueText => valueText !== '—').join(', ') || '—';
  }
  try {
    return JSON.stringify(value);
  } catch {
    return 'Dữ liệu không thể hiển thị';
  }
}

function optionLabel(value: unknown, index: number) {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const label = firstValue(record, ['text', 'label', 'value', 'answer', 'content']);
    return readableValue(label ?? `Lựa chọn ${index + 1}`);
  }
  return `Lựa chọn ${index + 1}`;
}

function DetailEntry({
  entry,
  sourceType
}: {
  entry: NormalizedHistoryDetailEntry;
  sourceType: LearningHistoryItem['sourceType'];
}) {
  if (entry.malformed) {
    return (
      <article className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <p className="flex items-center gap-2 text-sm font-black text-amber-800">
          <AlertTriangle size={17} aria-hidden="true" />
          Chi tiết câu {entry.index + 1} không đầy đủ
        </p>
        <p className="mt-1 text-xs font-semibold text-amber-700">
          Các câu khác vẫn được hiển thị bình thường.
        </p>
      </article>
    );
  }

  const data = entry.data;
  const prompt = firstValue(data, [
    'question',
    'questionText',
    'prompt',
    'questionSnapshot',
    'target',
    'targetText',
    'term',
    'word',
    'sentence'
  ]);
  const studentAnswer = firstValue(data, [
    'studentAnswer',
    'userAnswer',
    'answer',
    'textAnswer',
    'selectedAnswer',
    'selectedOptionId',
    'selectedOptionText',
    'response',
    'recognizedText',
    'transcript'
  ]);
  const explicitCorrectAnswer = firstValue(data, [
    'correctAnswer',
    'correctAnswerSnapshot',
    'acceptedAnswers',
    'acceptedAnswersSnapshot'
  ]);
  const correctOptionId = firstValue(data, [
    'correctOptionId',
    'correct_option_id'
  ]);
  const correctness = firstValue(data, ['isCorrect', 'correct', 'passed']);
  const options = firstValue(data, ['optionsSnapshot', 'options']);
  const displayedStudentAnswer = resolveHistoryOptionAnswer(studentAnswer, options)
    || readableValue(studentAnswer);
  const correctAnswer = explicitCorrectAnswer ?? correctOptionId;
  const displayedCorrectAnswer = resolveHistoryOptionAnswer(correctAnswer, options)
    || readableValue(correctAnswer);
  const ipa = firstValue(data, ['ipa', 'phonetic', 'ipaSnapshot']);
  const meaning = firstValue(data, ['meaning', 'definition', 'meaningSnapshot']);
  const explanation = firstValue(data, ['explanation', 'explanationSnapshot']);
  const responseTime = firstValue(data, [
    'responseTimeMs',
    'responseTime',
    'durationMs',
    'answerDurationMs',
    'timeSpentMs'
  ]);
  const pronunciationScore = firstValue(data, [
    'pronunciationScore',
    'pronunciation_score',
    'accuracyScore'
  ]);
  const evaluation = firstValue(data, [
    'evaluation',
    'evaluationDetail',
    'feedback',
    'aiFeedback'
  ]);

  return (
    <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-sm font-black text-slate-900">Câu {entry.index + 1}</h3>
        {typeof correctness === 'boolean' && (
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-black ${
            correctness
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-rose-50 text-rose-700'
          }`}>
            {correctness
              ? <CheckCircle2 size={14} aria-hidden="true" />
              : <XCircle size={14} aria-hidden="true" />}
            {correctness ? 'Đúng' : 'Chưa đúng'}
          </span>
        )}
      </div>

      <dl className="mt-3 space-y-3 text-sm">
        <div>
          <dt className="text-xs font-bold text-slate-500">
            {sourceType === 'vocabulary' ? 'Từ / câu hỏi' : 'Câu hỏi'}
          </dt>
          <dd className="mt-1 break-words font-bold text-slate-900">{readableValue(prompt)}</dd>
        </div>
        {(ipa !== undefined || meaning !== undefined) && (
          <div className="grid gap-3 sm:grid-cols-2">
            {ipa !== undefined && (
              <div>
                <dt className="text-xs font-bold text-slate-500">IPA</dt>
                <dd className="mt-1 break-words text-slate-800">{readableValue(ipa)}</dd>
              </div>
            )}
            {meaning !== undefined && (
              <div>
                <dt className="text-xs font-bold text-slate-500">Nghĩa</dt>
                <dd className="mt-1 break-words text-slate-800">{readableValue(meaning)}</dd>
              </div>
            )}
          </div>
        )}
        {Array.isArray(options) && options.length > 0 && (
          <div>
            <dt className="text-xs font-bold text-slate-500">Các lựa chọn</dt>
            <dd className="mt-1">
              <ol className="list-inside list-[upper-alpha] space-y-1 text-slate-700">
                {options.map((option, index) => (
                  <li key={index} className="break-words">{optionLabel(option, index)}</li>
                ))}
              </ol>
            </dd>
          </div>
        )}
        <div>
          <dt className="text-xs font-bold text-slate-500">
            {sourceType === 'grammar' ? 'Câu trả lời của bạn' : 'Đáp án của bạn'}
          </dt>
          <dd className="mt-1 break-words text-slate-800">{displayedStudentAnswer}</dd>
        </div>
        {correctAnswer !== undefined && (
          <div>
            <dt className="text-xs font-bold text-slate-500">Đáp án đúng</dt>
            <dd className="mt-1 break-words font-bold text-emerald-700">
              {displayedCorrectAnswer}
            </dd>
          </div>
        )}
        {explanation !== undefined && (
          <div>
            <dt className="text-xs font-bold text-slate-500">Giải thích</dt>
            <dd className="mt-1 whitespace-pre-wrap break-words text-slate-700">
              {readableValue(explanation)}
            </dd>
          </div>
        )}
        {(pronunciationScore !== undefined || evaluation !== undefined) && (
          <div className="grid gap-3 sm:grid-cols-2">
            {pronunciationScore !== undefined && (
              <div>
                <dt className="text-xs font-bold text-slate-500">Điểm phát âm</dt>
                <dd className="mt-1 font-black text-indigo-700">
                  {readableValue(pronunciationScore)}
                </dd>
              </div>
            )}
            {evaluation !== undefined && (
              <div>
                <dt className="text-xs font-bold text-slate-500">Nhận xét</dt>
                <dd className="mt-1 break-words text-slate-700">{readableValue(evaluation)}</dd>
              </div>
            )}
          </div>
        )}
        {responseTime !== undefined && (
          <div>
            <dt className="text-xs font-bold text-slate-500">Thời gian trả lời</dt>
            <dd className="mt-1 text-slate-700">
              {typeof responseTime === 'number'
                ? `${Math.max(0, responseTime) >= 1000
                  ? (Math.max(0, responseTime) / 1000).toFixed(1)
                  : Math.max(0, responseTime)} ${Math.max(0, responseTime) >= 1000 ? 'giây' : 'ms'}`
                : readableValue(responseTime)}
            </dd>
          </div>
        )}
      </dl>
    </article>
  );
}

function DetailStatusMessage({ status }: { status: string }) {
  const messages: Record<string, { title: string; body: string }> = {
    missing: {
      title: 'Không có dữ liệu chi tiết',
      body: 'Kết quả tổng hợp vẫn được lưu, nhưng lượt làm này không có nội dung từng câu.'
    },
    expired: {
      title: 'Chi tiết đã hết hạn',
      body: 'Nội dung từng câu đã được dọn theo chính sách lưu trữ; kết quả tổng hợp vẫn còn nguyên.'
    },
    legacy_unavailable: {
      title: 'Chi tiết cũ không khả dụng',
      body: 'Lượt làm cũ chưa có đủ dữ liệu để dựng lại nội dung từng câu.'
    }
  };
  const message = messages[status] || messages.missing;
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-center">
      <AlertTriangle className="mx-auto text-amber-600" size={28} aria-hidden="true" />
      <h3 className="mt-3 font-black text-amber-900">{message.title}</h3>
      <p className="mx-auto mt-1 max-w-lg text-sm font-medium text-amber-800">{message.body}</p>
    </div>
  );
}

export default function HistoryDetailModal({
  open,
  item,
  response,
  loading,
  error,
  returnFocus,
  onClose,
  onRetry
}: HistoryDetailModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open || typeof document === 'undefined') return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) || []
      ) as HTMLElement[];
      if (!focusable.length) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      returnFocus?.focus();
    };
  }, [onClose, open, returnFocus]);

  if (!open || !item) return null;

  const attempt = response?.attempt || item;
  const detailStatus = response?.detailStatus || item.detailStatus;
  const entries = normalizeHistoryDetailEntries(response?.detail || null);
  const warnings = Array.isArray(response?.detail?.warnings)
    ? response.detail.warnings.filter(warning => typeof warning === 'string')
    : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-detail-title"
        aria-describedby="history-detail-description"
        tabIndex={-1}
        className="flex max-h-[96dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-3xl bg-slate-50 shadow-2xl outline-none sm:max-h-[90vh] sm:rounded-3xl"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-white p-4 sm:p-6">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-wide text-indigo-600">
              Chi tiết lượt làm
            </p>
            <h2 id="history-detail-title" className="mt-1 break-words text-xl font-black text-slate-900">
              {attempt.lessonTitle}
            </h2>
            <p id="history-detail-description" className="mt-1 break-words text-sm font-semibold text-slate-500">
              {attempt.gameTitle} · Lần {attempt.attemptNumber}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            id="student-history-modal-close-btn"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
            aria-label="Đóng chi tiết lượt làm"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
          <dl className="mb-5 grid grid-cols-2 gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-xs font-bold text-slate-500">Điểm</dt>
              <dd className="mt-1 text-lg font-black text-indigo-700">{Math.round(attempt.score)}/100</dd>
            </div>
            <div>
              <dt className="text-xs font-bold text-slate-500">Kết quả</dt>
              <dd className="mt-1 font-black text-slate-900">
                {attempt.correctCount} đúng · {attempt.incorrectCount} sai
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold text-slate-500">Thời gian làm</dt>
              <dd className="mt-1 flex items-center gap-1 font-black text-slate-900">
                <Clock3 size={14} aria-hidden="true" />
                {formatHistoryDuration(attempt.durationSeconds)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold text-slate-500">Hoàn thành</dt>
              <dd className="mt-1 font-black text-slate-900">
                {formatHistoryDateTime(attempt.completedAt)}
              </dd>
            </div>
          </dl>

          {loading ? (
            <div className="flex min-h-48 flex-col items-center justify-center text-center" role="status">
              <LoaderCircle className="animate-spin text-indigo-600" size={32} aria-hidden="true" />
              <p className="mt-3 text-sm font-bold text-slate-600">Đang tải nội dung từng câu...</p>
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center" role="alert">
              <XCircle className="mx-auto text-rose-600" size={30} aria-hidden="true" />
              <h3 className="mt-3 font-black text-rose-900">Không thể tải chi tiết lượt làm.</h3>
              <p className="mt-1 text-sm font-medium text-rose-700">{error}</p>
              <button
                type="button"
                onClick={onRetry}
                className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-black text-white"
              >
                <RotateCcw size={16} aria-hidden="true" />
                Thử lại
              </button>
            </div>
          ) : detailStatus !== 'available' || !response?.detail ? (
            <DetailStatusMessage status={detailStatus} />
          ) : entries.length === 0 ? (
            <DetailStatusMessage status="missing" />
          ) : (
            <div className="space-y-3">
              {warnings.length > 0 && (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                  Một phần dữ liệu cũ không đầy đủ; hệ thống đã hiển thị các nội dung đọc được.
                </p>
              )}
              {entries.map(entry => (
                <div key={entry.index}>
                  <DetailEntry entry={entry} sourceType={attempt.sourceType} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
