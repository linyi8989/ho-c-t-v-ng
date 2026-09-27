import type { CSSProperties, ReactNode } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Clock3, LoaderCircle, Send } from 'lucide-react';

interface StudentExamShellPart {
  key: string | number;
  number: string | number;
}

interface StudentExamAttemptShellProps {
  rootId: string;
  eyebrow: string;
  title: string;
  answered: number;
  totalQuestions: number;
  remainingSeconds: number | null;
  parts: StudentExamShellPart[];
  currentPart: number;
  onPartChange: (index: number) => void;
  onSubmit: () => void;
  submitting?: boolean;
  submitDisabled?: boolean;
  submitButtonId?: string;
  previousButtonId?: string;
  nextButtonId?: string;
  partTabsLabel?: string;
  partLabel?: (part: StudentExamShellPart, index: number) => string;
  headerActions?: ReactNode;
  errorBanner?: ReactNode;
  showBottomNavigation?: boolean;
  rootClassName?: string;
  style?: CSSProperties;
  children: ReactNode;
}

const formatTime = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;

export default function StudentExamAttemptShell({
  rootId,
  eyebrow,
  title,
  answered,
  totalQuestions,
  remainingSeconds,
  parts,
  currentPart,
  onPartChange,
  onSubmit,
  submitting = false,
  submitDisabled = false,
  submitButtonId,
  previousButtonId,
  nextButtonId,
  partTabsLabel = 'Các Part của bài thi',
  partLabel = (_part, index) => `Part ${index + 1}`,
  headerActions,
  errorBanner,
  showBottomNavigation = true,
  rootClassName = '',
  style,
  children,
}: StudentExamAttemptShellProps) {
  const lastPartIndex = Math.max(0, parts.length - 1);

  return (
    <main id={rootId} className={`student-exam-shell min-h-screen bg-slate-100 ${rootClassName}`.trim()} style={style}>
      <header className="student-exam-shell-header sticky top-0 z-40 border-b border-slate-200 bg-white/95 py-3 shadow-sm backdrop-blur">
        <div className="student-exam-shell-container mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-3 sm:px-6">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[.18em] text-indigo-600">{eyebrow}</p>
            <h1 className="truncate text-base font-black text-slate-900">{title}</h1>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 text-xs font-black text-slate-600 sm:gap-3">
            <span className="student-exam-shell-progress" aria-label={`Đã trả lời ${answered} trên ${totalQuestions} câu`}>{answered}/{totalQuestions}</span>
            {remainingSeconds !== null && (
              <span className={`student-exam-shell-timer inline-flex items-center gap-1 rounded-xl px-3 py-2 ${remainingSeconds <= 60 ? 'bg-rose-50 text-rose-800' : 'bg-amber-50 text-amber-800'}`}>
                <Clock3 size={14} />{formatTime(remainingSeconds)}
              </span>
            )}
            {headerActions}
            <button
              id={submitButtonId}
              type="button"
              disabled={submitting || submitDisabled}
              onClick={onSubmit}
              className="student-exam-submit-action exam-platform-primary-action inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 font-black text-white disabled:cursor-not-allowed"
            >
              {submitting ? <LoaderCircle className="animate-spin" size={15} /> : <Send size={15} />}
              Nộp bài
            </button>
          </div>
        </div>
      </header>

      <div className="student-exam-shell-container mx-auto w-full max-w-7xl px-3 pt-4 sm:px-6 sm:pt-6">
        <div className="student-exam-part-tabs flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label={partTabsLabel}>
          {parts.map((part, index) => (
            <button
              key={part.key}
              type="button"
              role="tab"
              aria-selected={currentPart === index}
              aria-current={currentPart === index ? 'step' : undefined}
              data-active={currentPart === index ? 'true' : 'false'}
              onClick={() => onPartChange(index)}
              className={`student-exam-part-tab exam-platform-part-tab shrink-0 rounded-xl px-4 py-2.5 text-xs font-black ${currentPart === index ? 'bg-indigo-700 text-white shadow-md' : 'border border-slate-300 bg-white text-indigo-900'}`}
            >
              {index < currentPart ? <CheckCircle2 size={13} className="mr-1 inline" /> : null}
              {partLabel(part, index)}
            </button>
          ))}
        </div>
      </div>

      {errorBanner}
      {children}

      {showBottomNavigation && (
        <footer className="student-exam-shell-container student-exam-part-navigation mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-3 pb-6 pt-5 sm:px-6">
          <button
            id={previousButtonId}
            type="button"
            disabled={currentPart === 0}
            onClick={() => onPartChange(Math.max(0, currentPart - 1))}
            data-direction="previous"
            className="student-exam-part-nav exam-platform-part-nav inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 font-black text-slate-800 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={17} />Part trước
          </button>
          <button
            id={nextButtonId}
            type="button"
            disabled={currentPart === lastPartIndex}
            onClick={() => onPartChange(Math.min(lastPartIndex, currentPart + 1))}
            data-direction="next"
            className="student-exam-part-nav exam-platform-part-nav inline-flex items-center gap-2 rounded-xl bg-indigo-700 px-4 py-3 font-black text-white disabled:cursor-not-allowed"
          >
            Part sau<ChevronRight size={17} />
          </button>
        </footer>
      )}
    </main>
  );
}
