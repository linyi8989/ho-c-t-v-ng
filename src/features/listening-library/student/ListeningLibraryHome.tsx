import { ArrowLeft, ArrowRight, BookOpenText, Clock3, Layers3 } from 'lucide-react';
import { getVisibleListeningModules } from '../registry';
import { examModulePath } from '../routes';
import type { ExamModuleId } from '../types';

const moduleCardDescriptions = {
  starter: 'Listening và Reading & Writing dành cho trình độ Pre A1.',
  mover: 'Listening và Reading & Writing theo cấu trúc A1 Movers.',
  flyer: 'Listening và Reading & Writing dành cho trình độ A2.',
  ket: 'Reading & Writing và Listening cho kỳ thi A2 Key.',
  pet: 'Reading, Writing và Listening cho kỳ thi B1 Preliminary.',
  fce: 'Reading & Use of English, Writing và Listening cho B2 First.',
  ielts: 'Listening, Academic Reading và Academic Writing.',
} satisfies Partial<Record<ExamModuleId, string>>;

interface ListeningLibraryHomeProps {
  embedded?: boolean;
  onBack?: () => void;
  onNavigate: (href: string) => void;
}

export default function ListeningLibraryHome({
  embedded = false,
  onBack,
  onNavigate,
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
            <article
              key={module.id}
              data-exam-module-card={module.id}
              data-active={active}
              className="exam-directory-module-card flex h-full flex-col overflow-hidden rounded-2xl border p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="exam-directory-module-title text-xl font-black">{module.displayName}</h3>
                  <span className="exam-directory-module-level mt-0.5 block text-[11px] font-black uppercase tracking-[.12em]">{module.levelLabel}</span>
                </div>
                <span className="exam-directory-module-icon flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" aria-hidden="true">
                  {active ? <Layers3 size={20} aria-hidden="true" /> : <Clock3 size={20} aria-hidden="true" />}
                </span>
              </div>
              <p className="exam-directory-module-description mt-2 font-semibold">
                {moduleCardDescriptions[module.id] || module.description}
              </p>
              {active ? (
                <button
                  type="button"
                  onClick={() => {
                    const href = examModulePath(module.id);
                    onNavigate(href);
                  }}
                  className="exam-directory-module-action listening-library-primary-action inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black"
                >
                  Xem danh sách
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              ) : (
                <button type="button" disabled className="exam-directory-module-action listening-library-disabled-action rounded-xl border px-4 py-2.5 text-sm font-black disabled:cursor-not-allowed">
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
