import React from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Headphones,
  Redo2,
  Save,
  Send,
  Undo2,
} from 'lucide-react';

interface ListeningEditorShellProps {
  title: string;
  steps: readonly string[];
  step: number;
  busy: boolean;
  dirty: boolean;
  autosaveStatus: 'idle' | 'saving' | 'saved' | 'error' | 'conflict';
  canUndo: boolean;
  canRedo: boolean;
  message: { text: string; error?: boolean } | null;
  onStepChange: (step: number) => void;
  onBack: () => void;
  onSave: () => void;
  onPublish: () => void;
  onUndo: () => void;
  onRedo: () => void;
  children: React.ReactNode;
  rootId?: string;
  eyebrow?: string;
  stepAriaLabel?: string;
}

export default function ListeningEditorShell({
  title,
  steps,
  step,
  busy,
  dirty,
  autosaveStatus,
  canUndo,
  canRedo,
  message,
  onStepChange,
  onBack,
  onSave,
  onPublish,
  onUndo,
  onRedo,
  children,
  rootId = 'listening-wizard',
  eyebrow = 'Listening wizard',
  stepAriaLabel = 'Các bước soạn bài nghe',
}: ListeningEditorShellProps) {
  return (
    <div className="space-y-5 animate-fade-in" id={rootId}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button type="button" disabled={busy} onClick={onBack} aria-label="Quay lại kho bộ đề" className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 disabled:opacity-40">
            <ChevronLeft size={17} />
          </button>
          <div>
            <p className="text-xs font-black uppercase text-sky-600">{eyebrow}</p>
            <h2 className="text-xl font-black text-slate-900">{title}</h2>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="mr-1 flex items-center gap-1">
            <button type="button" title="Hoàn tác" aria-label="Hoàn tác" disabled={!canUndo || busy} onClick={onUndo} className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 disabled:opacity-30">
              <Undo2 size={15} />
            </button>
            <button type="button" title="Làm lại" aria-label="Làm lại" disabled={!canRedo || busy} onClick={onRedo} className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-600 disabled:opacity-30">
              <Redo2 size={15} />
            </button>
          </div>
          <span className={`inline-flex items-center rounded-xl px-3 py-2 text-[11px] font-black ${
            autosaveStatus === 'conflict' || autosaveStatus === 'error'
              ? 'bg-rose-50 text-rose-700'
              : dirty || autosaveStatus === 'saving'
                ? 'bg-amber-50 text-amber-700'
                : 'bg-emerald-50 text-emerald-700'
          }`}>
            {autosaveStatus === 'saving'
              ? 'Đang tự lưu…'
              : autosaveStatus === 'conflict'
                ? 'Xung đột bản nháp'
                : autosaveStatus === 'error'
                  ? 'Tự lưu thất bại'
                  : dirty
                    ? 'Chưa lưu'
                    : 'Đã lưu'}
          </span>
          <button type="button" disabled={busy} onClick={onSave} className="listening-editor-save-action inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-xs font-black text-blue-700 disabled:opacity-50">
            <Save size={15} /> Lưu nháp
          </button>
          <button type="button" disabled={busy} onClick={onPublish} className="listening-editor-publish-action inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50">
            <Send size={15} /> Xuất bản
          </button>
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label={stepAriaLabel}>
        {steps.map((label, index) => (
          <button
            type="button"
            role="tab"
            aria-selected={step === index}
            data-active={step === index}
            key={label}
            onClick={() => onStepChange(index)}
            className={`listening-editor-step-action shrink-0 rounded-xl px-4 py-2 text-xs font-black ${step === index ? 'bg-blue-600 text-white shadow-md' : 'border border-slate-200 bg-white text-slate-500'}`}
          >
            {index < step ? <CheckCircle2 size={13} className="mr-1 inline" /> : null}{label}
          </button>
        ))}
      </div>
      {message && (
        <div className={`rounded-2xl border p-3 text-sm font-bold ${message.error ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
          {message.text}
        </div>
      )}
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">{children}</div>
      <div className="flex items-center justify-between">
        <button type="button" disabled={step === 0} onClick={() => onStepChange(Math.max(0, step - 1))} className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-600 disabled:opacity-30">
          <ChevronLeft size={14} /> Trước
        </button>
        <span className="inline-flex items-center gap-2 text-xs font-bold text-slate-400"><Headphones size={14} /> Bước {step + 1}/{steps.length}</span>
        <button type="button" disabled={step === steps.length - 1} onClick={() => onStepChange(Math.min(steps.length - 1, step + 1))} className="listening-editor-next-action inline-flex items-center gap-1 rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white disabled:opacity-30">
          Tiếp <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
