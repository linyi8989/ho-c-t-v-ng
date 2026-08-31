import type { ReactNode } from 'react';

interface Props {
  media: ReactNode;
  children: ReactNode;
  className?: string;
  mediaClassName?: string;
  contentClassName?: string;
}

/**
 * Shared picture-left/task-right layout. Fractional tracks divide only the
 * width left after the gap, avoiding the old 44% + 56% + gap overflow.
 */
export default function ExamSplitTaskLayout({
  media,
  children,
  className = '',
  mediaClassName = '',
  contentClassName = '',
}: Props) {
  return <div data-exam-layout="split-task" className={`grid gap-6 lg:grid-cols-[minmax(0,47fr)_minmax(0,53fr)] ${className}`}>
    <div data-exam-layout-region="media" className={`min-w-0 space-y-4 lg:sticky lg:top-24 lg:self-start ${mediaClassName}`}>{media}</div>
    <div data-exam-layout-region="task" className={`min-w-0 space-y-4 ${contentClassName}`}>{children}</div>
  </div>;
}
