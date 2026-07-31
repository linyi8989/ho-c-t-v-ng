import { ArrowLeft, Clock3, Headphones } from 'lucide-react';
import type { ListeningModuleManifest } from '../types';

interface ComingSoonModuleProps {
  module: ListeningModuleManifest;
  onBack?: () => void;
  admin?: boolean;
}

export default function ComingSoonModule({ module, onBack, admin = false }: ComingSoonModuleProps) {
  return (
    <div id={admin ? undefined : 'listening-coming-soon-page'} className={admin ? 'rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center' : 'flex min-h-screen items-center justify-center bg-gradient-to-b from-sky-100 to-emerald-50 p-4'}>
      <div className={admin ? '' : 'w-full max-w-xl rounded-[2rem] border border-sky-100 bg-white p-8 text-center shadow-xl'}>
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
          <Clock3 size={32} aria-hidden="true" />
        </span>
        <p className="mt-4 text-xs font-black uppercase tracking-[.18em] text-sky-700">
          Kho bài luyện nghe
        </p>
        <h1 className="mt-2 text-3xl font-black text-slate-900">{module.displayName}</h1>
        <p className="mx-auto mt-3 max-w-md text-sm font-semibold leading-6 text-slate-500">
          {module.description} Chưa có dạng câu hỏi hoặc biểu mẫu giả được kích hoạt cho module này.
        </p>
        <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-amber-100 px-4 py-2 text-xs font-black text-amber-800">
          <Headphones size={15} aria-hidden="true" /> Sắp ra mắt
        </span>
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="listening-library-secondary-action mx-auto mt-7 flex items-center gap-2 rounded-2xl border px-5 py-3 text-sm font-black"
          >
            <ArrowLeft size={16} aria-hidden="true" /> Quay lại Kho bài nghe
          </button>
        )}
      </div>
    </div>
  );
}
