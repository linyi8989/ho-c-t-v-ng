import React from 'react';
import {
  Award,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ListChecks,
  Target,
  XCircle,
  CircleDashed
} from 'lucide-react';
import { LearningHistorySummaryData, formatHistoryDuration } from './historyTypes';

interface HistorySummaryProps {
  summary: LearningHistorySummaryData;
}

export default function HistorySummary({ summary }: HistorySummaryProps) {
  const cards = [
    { label: 'Tổng lượt làm', value: summary.totalAttempts, icon: ListChecks },
    { label: 'Đã hoàn thành', value: summary.completedAttempts, icon: CheckCircle2 },
    { label: 'Điểm trung bình', value: `${Math.round(summary.averageScore)} điểm`, icon: Target },
    { label: 'Điểm cao nhất', value: `${Math.round(summary.bestScore)} điểm`, icon: Award },
    { label: 'Câu đúng', value: summary.totalCorrect, icon: CheckCircle2 },
    { label: 'Câu sai', value: summary.totalIncorrect, icon: XCircle },
    { label: 'Chưa trả lời', value: summary.totalUnanswered, icon: CircleDashed },
    { label: 'Tổng thời gian', value: formatHistoryDuration(summary.totalDurationSeconds), icon: Clock3 },
    { label: 'Số ngày đã học', value: summary.studyDays, icon: CalendarDays }
  ];

  return (
    <dl
      className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5"
      aria-label="Tổng quan lịch sử học tập"
    >
      {cards.map(({ label, value, icon: Icon }) => (
        <div
          key={label}
          className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <dt className="flex items-center gap-2 text-xs font-bold text-slate-500">
            <Icon size={16} aria-hidden="true" />
            <span>{label}</span>
          </dt>
          <dd className="mt-2 break-words text-xl font-black text-slate-900">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

