import { ArrowRight, BookOpenText, Clock3, Layers3 } from 'lucide-react';
import { useState } from 'react';
import { getVisibleListeningModules } from '../registry';
import type { ListeningModuleId } from '../types';
import ListeningModuleRouter from './ListeningModuleRouter';

interface ListeningLibraryAdminProps {
  token: string;
}

export default function ListeningLibraryAdmin({ token }: ListeningLibraryAdminProps) {
  const [selectedModuleId, setSelectedModuleId] = useState<ListeningModuleId | null>(null);
  const modules = getVisibleListeningModules();
  return (
    <div className="space-y-6 animate-fade-in" id="listening-library-admin">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="shrink-0">
          <p className="text-xs font-black uppercase tracking-[.18em] text-sky-600">Cambridge &amp; IELTS</p>
          <h2 className="mt-1 flex items-center gap-2 text-2xl font-black text-slate-900"><BookOpenText size={25} className="text-sky-600" aria-hidden="true" /> Kho đề luyện thi</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">Chọn module để mở ngay danh sách bộ đề đã soạn.</p>
        </div>
        <nav aria-label="Truy cập nhanh module kho đề" className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4 xl:max-w-5xl xl:grid-cols-7">
          {modules.map(module => {
            const selected = selectedModuleId === module.id;
            return <button
              key={module.id}
              type="button"
              data-exam-module-quick-link={module.id}
              aria-pressed={selected}
              onClick={() => setSelectedModuleId(module.id)}
              title={`Mở kho đề ${module.displayName}`}
              className="exam-module-quick-link group flex min-h-16 min-w-0 flex-col justify-center rounded-2xl border px-3 py-2 text-left shadow-sm transition focus-visible:outline-none"
            >
              <span className="exam-module-quick-link-label truncate text-sm font-black">{module.displayName}</span>
              <span className="exam-module-quick-link-level mt-0.5 truncate text-[10px] font-black uppercase tracking-wide">{module.levelLabel}</span>
            </button>;
          })}
        </nav>
      </div>
      {selectedModuleId
        ? <div key={selectedModuleId} data-exam-module-admin={selectedModuleId}>
            <ListeningModuleRouter moduleId={selectedModuleId} token={token} onBack={() => setSelectedModuleId(null)} />
          </div>
        : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {modules.map(module => {
          const active = module.status === 'active' && module.capabilities.admin;
          return (
            <button
              type="button"
              key={module.id}
              onClick={() => setSelectedModuleId(module.id)}
              className={`flex min-h-56 flex-col items-start rounded-3xl border p-5 text-left shadow-sm transition ${active ? 'border-sky-200 bg-gradient-to-br from-white to-sky-50 hover:-translate-y-0.5 hover:shadow-md' : 'border-slate-200 bg-slate-50'}`}
            >
              <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${active ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-500'}`}>
                {active ? <Layers3 size={23} aria-hidden="true" /> : <Clock3 size={23} aria-hidden="true" />}
              </span>
              <span className="mt-4 text-2xl font-black text-slate-900">{module.displayName}</span>
              <span className="mt-1 text-xs font-black uppercase tracking-wide text-sky-700">{module.levelLabel}</span>
              <span className="mt-2 flex-1 text-sm font-semibold leading-6 text-slate-500">{module.description}</span>
              <span className={`mt-4 inline-flex items-center gap-2 text-xs font-black ${active ? 'text-sky-700' : 'text-amber-700'}`}>
                {active ? 'Quản lý bộ đề' : 'Xem trạng thái'} <ArrowRight size={14} aria-hidden="true" />
              </span>
            </button>
          );
        })}
      </div>}
    </div>
  );
}
