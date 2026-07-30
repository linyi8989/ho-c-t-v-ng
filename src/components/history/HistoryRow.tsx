import React from 'react';
import { Eye, FileText, Gamepad2 } from 'lucide-react';
import {
  LearningHistoryItem,
  formatHistoryDateTime,
  formatHistoryDuration
} from './historyTypes';

interface HistoryRowProps {
  item: LearningHistoryItem;
  variant: 'table' | 'card';
  onViewDetail: (item: LearningHistoryItem, trigger: HTMLButtonElement) => void;
}

const STATUS_LABELS: Record<string, string> = {
  completed: 'Đã hoàn thành',
  in_progress: 'Đang làm',
  interrupted: 'Bị gián đoạn'
};

const DETAIL_STATUS_LABELS: Record<string, string> = {
  available: 'Có chi tiết',
  legacy: 'Chi tiết cũ',
  missing: 'Không có chi tiết',
  expired: 'Chi tiết đã hết hạn',
  legacy_unavailable: 'Chi tiết cũ không khả dụng'
};

function StatusBadges({ item }: { item: LearningHistoryItem }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <span className={`rounded-full border px-2 py-1 text-[10px] font-black ${
        item.attemptStatus === 'completed'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : item.attemptStatus === 'in_progress'
            ? 'border-blue-200 bg-blue-50 text-blue-700'
            : 'border-amber-200 bg-amber-50 text-amber-700'
      }`}>
        {STATUS_LABELS[item.attemptStatus] || item.attemptStatus}
      </span>
      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-600">
        {DETAIL_STATUS_LABELS[item.detailStatus] || item.detailStatus}
      </span>
    </div>
  );
}

function LessonInfo({ item }: { item: LearningHistoryItem }) {
  const Icon = item.sourceType === 'grammar' ? FileText : Gamepad2;
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-start gap-2">
        <Icon size={17} className="mt-0.5 shrink-0 text-indigo-600" aria-hidden="true" />
        <div className="min-w-0">
          <p className="break-words font-black text-slate-900">{item.lessonTitle}</p>
          <p className="mt-1 break-words text-xs font-semibold text-slate-500">
            {item.sourceType === 'grammar' ? 'Ngữ pháp' : 'Từ vựng'} · {item.gameTitle}
          </p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-semibold text-slate-500">
        <span>{item.assignmentId ? item.assignmentTitle || 'Bài được giao' : 'Tự luyện'}</span>
        {item.className && <span>Lớp: {item.className}</span>}
        <span>Lần {item.attemptNumber}</span>
      </div>
    </div>
  );
}

function ResultInfo({ item }: { item: LearningHistoryItem }) {
  return (
    <div>
      <p className="text-xl font-black text-indigo-700">{Math.round(item.score)}/100</p>
      <p className="mt-1 text-[11px] font-semibold text-slate-500">
        Đúng {item.correctCount} · Sai {item.incorrectCount} · Chưa trả lời {item.unansweredCount}
      </p>
      <p className="text-[11px] font-semibold text-slate-500">
        Tổng {item.totalQuestions} câu · {formatHistoryDuration(item.durationSeconds)}
      </p>
    </div>
  );
}

function DetailButton({
  item,
  onViewDetail
}: {
  item: LearningHistoryItem;
  onViewDetail: HistoryRowProps['onViewDetail'];
}) {
  const unavailable = item.malformed || !item.attemptId;
  return (
    <button
      type="button"
      disabled={unavailable}
      onClick={event => onViewDetail(item, event.currentTarget)}
      className="history-detail-button inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-indigo-600 bg-indigo-600 px-3 text-xs font-black text-white disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
      aria-label={`Xem chi tiết ${item.lessonTitle}`}
    >
      <Eye size={15} aria-hidden="true" />
      Xem chi tiết
    </button>
  );
}

export default function HistoryRow({ item, variant, onViewDetail }: HistoryRowProps) {
  if (variant === 'table') {
    return (
      <tr className="border-b border-slate-100 align-top last:border-0">
        <td className="w-[31%] p-4"><LessonInfo item={item} /></td>
        <td className="w-[19%] p-4"><ResultInfo item={item} /></td>
        <td className="w-[19%] p-4 text-xs font-semibold text-slate-600">
          <p>Bắt đầu: {formatHistoryDateTime(item.startedAt)}</p>
          <p className="mt-1">Hoàn thành: {formatHistoryDateTime(item.completedAt)}</p>
        </td>
        <td className="w-[16%] p-4"><StatusBadges item={item} /></td>
        <td className="w-[15%] p-4 text-right"><DetailButton item={item} onViewDetail={onViewDetail} /></td>
      </tr>
    );
  }

  return (
    <article className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <LessonInfo item={item} />
      <div className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
        <ResultInfo item={item} />
        <div className="text-xs font-semibold text-slate-600">
          <p>Bắt đầu: {formatHistoryDateTime(item.startedAt)}</p>
          <p className="mt-1">Hoàn thành: {formatHistoryDateTime(item.completedAt)}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <StatusBadges item={item} />
        <DetailButton item={item} onViewDetail={onViewDetail} />
      </div>
    </article>
  );
}
