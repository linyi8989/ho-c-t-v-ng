import { ArrowRight, Clock3, Headphones, Layers3 } from 'lucide-react';
import { useState } from 'react';
import { getVisibleListeningModules } from '../registry';
import type { ListeningModuleId } from '../types';
import ListeningModuleRouter from './ListeningModuleRouter';

interface ListeningLibraryAdminProps {
  token: string;
}

export default function ListeningLibraryAdmin({ token }: ListeningLibraryAdminProps) {
  const [selectedModuleId, setSelectedModuleId] = useState<ListeningModuleId | null>(null);
  if (selectedModuleId) {
    return <ListeningModuleRouter moduleId={selectedModuleId} token={token} onBack={() => setSelectedModuleId(null)} />;
  }
  return (
    <div className="space-y-6 animate-fade-in" id="listening-library-admin">
      <div>
        <p className="text-xs font-black uppercase tracking-[.18em] text-sky-600">Listening Library</p>
        <h2 className="mt-1 flex items-center gap-2 text-2xl font-black text-slate-900"><Headphones size={25} className="text-sky-600" aria-hidden="true" /> Kho bài luyện nghe</h2>
        <p className="mt-1 text-sm font-semibold text-slate-500">Chọn module trước khi quản lý danh sách bộ đề.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {getVisibleListeningModules().map(module => {
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
              <span className="mt-2 flex-1 text-sm font-semibold leading-6 text-slate-500">{module.description}</span>
              <span className={`mt-4 inline-flex items-center gap-2 text-xs font-black ${active ? 'text-sky-700' : 'text-amber-700'}`}>
                {active ? 'Quản lý bộ đề' : 'Xem trạng thái'} <ArrowRight size={14} aria-hidden="true" />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
