import React from 'react';
import { BookOpenCheck } from 'lucide-react';
import { LearningHistoryItem } from './historyTypes';
import HistoryRow from './HistoryRow';

interface HistoryListProps {
  items: LearningHistoryItem[];
  onViewDetail: (item: LearningHistoryItem, trigger: HTMLButtonElement) => void;
}

export default function HistoryList({ items, onViewDetail }: HistoryListProps) {
  if (items.length === 0) {
    return (
      <div className="history-panel history-state px-5 py-12 text-center">
        <span className="history-state-icon mx-auto flex h-14 w-14 items-center justify-center">
          <BookOpenCheck size={28} aria-hidden="true" />
        </span>
        <h2 className="mt-4 text-lg font-black text-slate-900">Bạn chưa có lượt làm bài nào.</h2>
        <p className="mx-auto mt-2 max-w-md text-sm font-medium text-slate-500">
          Hãy hoàn thành một bài học để kết quả xuất hiện tại đây.
        </p>
      </div>
    );
  }

  return (
    <section className="history-list" aria-label="Danh sách lượt làm">
      <div className="history-panel history-table-frame hidden overflow-hidden lg:block">
        <table className="w-full table-fixed border-collapse text-left text-sm">
          <caption className="sr-only">Lịch sử các lượt học và làm bài</caption>
          <thead className="border-b border-slate-200 bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-600">
            <tr>
              <th scope="col" className="w-[31%] p-4">Bài học</th>
              <th scope="col" className="w-[19%] p-4">Kết quả</th>
              <th scope="col" className="w-[19%] p-4">Thời gian</th>
              <th scope="col" className="w-[16%] p-4">Trạng thái</th>
              <th scope="col" className="w-[15%] p-4 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <React.Fragment key={item.attemptId}>
                <HistoryRow
                  item={item}
                  variant="table"
                  onViewDetail={onViewDetail}
                />
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <div className="history-card-list space-y-3 lg:hidden">
        {items.map(item => (
          <React.Fragment key={item.attemptId}>
            <HistoryRow
              item={item}
              variant="card"
              onViewDetail={onViewDetail}
            />
          </React.Fragment>
        ))}
      </div>
    </section>
  );
}
