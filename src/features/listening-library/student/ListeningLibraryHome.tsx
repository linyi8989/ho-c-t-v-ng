import { ArrowLeft, ArrowRight, Clock3, Headphones, Layers3 } from 'lucide-react';
import { getVisibleListeningModules } from '../registry';
import { listeningModulePath } from '../routes';
import type { ListeningModuleId } from '../types';

interface ListeningLibraryHomeProps {
  embedded?: boolean;
  moduleCounts?: Partial<Record<ListeningModuleId, number>>;
  onBack?: () => void;
}

export default function ListeningLibraryHome({
  embedded = false,
  moduleCounts = {},
  onBack,
}: ListeningLibraryHomeProps) {
  const modules = getVisibleListeningModules();
  const content = (
    <div className="space-y-5" id={embedded ? 'home-listening-directory' : 'listening-library-home'}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[.18em] text-sky-600">Listening Library</p>
          <h2 className={`${embedded ? 'text-xl' : 'text-3xl'} mt-1 flex items-center gap-2 font-black text-slate-900`}>
            <Headphones className="text-sky-600" size={embedded ? 22 : 28} aria-hidden="true" />
            Kho bài luyện nghe
          </h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Chọn cấp độ phù hợp; mỗi module có cấu trúc và quy tắc riêng.
          </p>
        </div>
        {!embedded && onBack && (
          <button type="button" onClick={onBack} className="listening-library-secondary-action inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-black">
            <ArrowLeft size={15} aria-hidden="true" /> Trang chủ
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {modules.map(module => {
          const active = module.status === 'active' && module.capabilities.student;
          const count = moduleCounts[module.id];
          return (
            <article key={module.id} className={`flex min-h-56 flex-col rounded-3xl border p-5 shadow-sm ${active ? 'border-sky-200 bg-gradient-to-br from-white to-sky-50' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex items-start justify-between gap-3">
                <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${active ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                  {active ? <Layers3 size={23} aria-hidden="true" /> : <Clock3 size={23} aria-hidden="true" />}
                </span>
                <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${active ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>
                  {active ? 'Đang hoạt động' : 'Sắp ra mắt'}
                </span>
              </div>
              <h3 className="mt-4 text-2xl font-black text-slate-900">{module.displayName}</h3>
              <p className="mt-2 flex-1 text-sm font-semibold leading-6 text-slate-500">{module.description}</p>
              {active ? (
                <button
                  type="button"
                  onClick={() => { window.location.href = listeningModulePath(module.id); }}
                  className="listening-library-primary-action mt-5 inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black"
                >
                  {typeof count === 'number' ? `${count} bộ đề` : 'Mở kho Mover'}
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              ) : (
                <button type="button" disabled className="listening-library-disabled-action mt-5 rounded-2xl border px-4 py-3 text-sm font-black disabled:cursor-not-allowed">
                  Chưa triển khai
                </button>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );

  if (embedded) return content;
  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-100 via-white to-emerald-50 p-4 sm:p-8">
      <div className="mx-auto max-w-6xl rounded-[2rem] border border-white bg-white/90 p-5 shadow-xl sm:p-8">
        {content}
      </div>
    </main>
  );
}
