import React from 'react';
import { Copy, Play } from 'lucide-react';

export type LibraryVisibility = 'draft' | 'public' | 'assignment';

interface LibraryRowActionsProps {
  onPlay: () => void;
  onEdit: () => void;
  onClone: () => void;
  onResults: () => void;
  onDelete: () => void;
  playDisabled?: boolean;
  disabled?: boolean;
  playTitle?: string;
  deleteTitle?: string;
}

const actionBase = 'rounded-lg border px-2.5 py-1.5 text-[11px] font-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60';

export function LibraryRowActions({
  onPlay,
  onEdit,
  onClone,
  onResults,
  onDelete,
  playDisabled = false,
  disabled = false,
  playTitle = 'Play',
  deleteTitle = 'Xóa',
}: LibraryRowActionsProps) {
  return (
    <div className="flex flex-wrap gap-1.5" data-library-row-actions>
      <button
        type="button"
        data-library-action="play"
        onClick={onPlay}
        disabled={disabled || playDisabled}
        title={playTitle}
        className={`inline-flex items-center gap-1 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 ${actionBase}`}
      >
        <Play size={13} />
        Play
      </button>
      <button
        type="button"
        data-library-action="edit"
        onClick={onEdit}
        disabled={disabled}
        className={`border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 ${actionBase}`}
      >
        Sửa
      </button>
      <button
        type="button"
        data-library-action="clone"
        onClick={onClone}
        disabled={disabled}
        className={`border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 ${actionBase}`}
      >
        Sao chép
      </button>
      <button
        type="button"
        data-library-action="results"
        onClick={onResults}
        disabled={disabled}
        className={`border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 ${actionBase}`}
      >
        Kết quả
      </button>
      <button
        type="button"
        data-library-action="delete"
        onClick={onDelete}
        disabled={disabled}
        title={deleteTitle}
        className={`border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 ${actionBase}`}
      >
        Xóa
      </button>
    </div>
  );
}

interface LibraryLinkStatusProps {
  visibility: LibraryVisibility;
  privateUrl?: string;
  onCopyPrivateLink?: () => void | Promise<void>;
}

export function LibraryLinkStatus({
  visibility,
  privateUrl,
  onCopyPrivateLink,
}: LibraryLinkStatusProps) {
  if (visibility === 'assignment') {
    if (!privateUrl || !onCopyPrivateLink) {
      return <span className="text-xs font-semibold text-slate-400">Chưa có link</span>;
    }
    return (
      <button
        type="button"
        data-library-link="private"
        onClick={() => void onCopyPrivateLink()}
        className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-[10px] font-black text-indigo-700 transition-colors hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"
        title="Copy link riêng"
      >
        <Copy size={13} />
        Link riêng
      </button>
    );
  }

  if (visibility === 'public') {
    return (
      <span data-library-link="public" className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700">
        Công khai
      </span>
    );
  }

  return <span data-library-link="draft" className="text-xs font-semibold text-slate-400">Chưa xuất bản</span>;
}
