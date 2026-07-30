import React from 'react';
import { ClipboardList } from 'lucide-react';
import {
  LearningHistoryAssignmentGroup,
  LearningHistoryItem,
  formatHistoryDateTime
} from './historyTypes';
import HistoryRow from './HistoryRow';

interface AssignmentHistoryGroupProps {
  items: LearningHistoryItem[];
  summaries?: LearningHistoryAssignmentGroup[];
  onViewDetail: (item: LearningHistoryItem, trigger: HTMLButtonElement) => void;
}

interface Group {
  id: string;
  title: string;
  className?: string;
  dueAt?: string;
  items: LearningHistoryItem[];
}

export default function AssignmentHistoryGroup({
  items,
  summaries = [],
  onViewDetail
}: AssignmentHistoryGroupProps) {
  const summaryByAssignment = new Map(
    summaries.map(summary => [summary.assignmentId, summary])
  );
  const groups = new Map<string, Group>();
  const practiceItems: LearningHistoryItem[] = [];

  for (const item of items) {
    if (!item.assignmentId) {
      practiceItems.push(item);
      continue;
    }
    const existing = groups.get(item.assignmentId);
    if (existing) {
      existing.items.push(item);
    } else {
      groups.set(item.assignmentId, {
        id: item.assignmentId,
        title: item.assignmentTitle || 'Bài được giao',
        className: item.className,
        dueAt: item.assignmentDueAt,
        items: [item]
      });
    }
  }

  const renderedGroups = [...groups.values()];
  if (practiceItems.length) {
    renderedGroups.push({
      id: 'practice',
      title: 'Tự luyện',
      items: practiceItems
    });
  }

  return (
    <section className="space-y-4" aria-label="Lịch sử nhóm theo bài tập">
      {renderedGroups.map(group => {
        const serverSummary = summaryByAssignment.get(group.id);
        const groupClassName = serverSummary?.className || group.className || '';
        const groupClassLabel = groupClassName
          ? groupClassName.toLocaleLowerCase('vi').startsWith('lớp ')
            ? groupClassName
            : `Lớp ${groupClassName}`
          : 'Không có thông tin lớp';
        const scores = group.items.map(item => item.score);
        const attempts = serverSummary?.attempts ?? group.items.length;
        const latest = serverSummary?.latestScore ?? group.items[0]?.score ?? 0;
        const best = serverSummary?.bestScore ?? (scores.length ? Math.max(...scores) : 0);
        const average = serverSummary?.averageScore ?? (
          scores.length
            ? scores.reduce((sum, score) => sum + score, 0) / scores.length
            : 0
        );
        return (
          <article
            key={group.id}
            className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
          >
            <header className="border-b border-slate-200 bg-slate-50 p-4 md:p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <h2 className="flex min-w-0 items-center gap-2 text-base font-black text-slate-900">
                    <ClipboardList size={18} className="shrink-0 text-indigo-600" aria-hidden="true" />
                    <span className="break-words">{group.title}</span>
                  </h2>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {groupClassLabel}
                    {serverSummary?.dueAt || group.dueAt
                      ? ` · Hạn nộp ${formatHistoryDateTime(serverSummary?.dueAt || group.dueAt)}`
                      : ''}
                  </p>
                </div>
                <dl className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div><dt className="text-slate-500">Lượt</dt><dd className="font-black">{attempts}</dd></div>
                  <div><dt className="text-slate-500">Mới nhất</dt><dd className="font-black">{Math.round(latest)}</dd></div>
                  <div><dt className="text-slate-500">Cao nhất</dt><dd className="font-black">{Math.round(best)}</dd></div>
                  <div><dt className="text-slate-500">Trung bình</dt><dd className="font-black">{Math.round(average)}</dd></div>
                </dl>
              </div>
              {!serverSummary && (
                <p className="mt-2 text-[10px] font-semibold text-slate-400">
                  Thống kê nhóm được tính trên các lượt đang hiển thị ở trang này.
                </p>
              )}
            </header>
            <div className="space-y-3 p-3 md:p-4">
              {group.items.map(item => (
                <React.Fragment key={item.attemptId}>
                  <HistoryRow
                    item={item}
                    variant="card"
                    onViewDetail={onViewDetail}
                  />
                </React.Fragment>
              ))}
            </div>
          </article>
        );
      })}
    </section>
  );
}
