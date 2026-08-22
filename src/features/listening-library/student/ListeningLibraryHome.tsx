import { ArrowLeft, ArrowRight, BookOpenText, Clock3, Layers3 } from 'lucide-react';
import { getVisibleListeningModules } from '../registry';
import { examModulePath } from '../routes';

interface ListeningLibraryHomeProps {
  embedded?: boolean;
  onBack?: () => void;
}

export default function ListeningLibraryHome({
  embedded = false,
  onBack,
}: ListeningLibraryHomeProps) {
  const modules = getVisibleListeningModules();
  const content = (
    <div className="space-y-5" id={embedded ? 'home-listening-directory' : 'listening-library-home'}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[.18em] text-sky-600">Cambridge &amp; IELTS</p>
          <h2 className={`${embedded ? 'text-xl' : 'text-3xl'} mt-1 flex items-center gap-2 font-black text-slate-900`}>
            <BookOpenText className="text-sky-600" size={embedded ? 22 : 28} aria-hidden="true" />
            Kho đề luyện thi
          </h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Chọn cấp độ hoặc kỳ thi; mỗi bộ đề được phân loại theo kỹ năng.
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
              <span className="mt-1 text-xs font-black uppercase tracking-wide text-sky-700">{module.levelLabel}</span>
              <p className="mt-2 flex-1 text-sm font-semibold leading-6 text-slate-500">{module.description}</p>
              {active ? (
                <button
                  type="button"
                  onClick={() => { window.location.href = examModulePath(module.id); }}
                  className="listening-library-primary-action mt-5 inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black"
                >
                  Xem danh sách
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
