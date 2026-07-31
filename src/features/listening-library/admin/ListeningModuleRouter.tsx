import { ArrowLeft } from 'lucide-react';
import { getListeningClientModule } from '../clientRegistry';
import { getListeningModule } from '../registry';
import ComingSoonModule from '../shared/ComingSoonModule';
import type { ListeningModuleId } from '../types';

interface ListeningModuleRouterProps {
  moduleId: ListeningModuleId;
  token: string;
  onBack: () => void;
}

export default function ListeningModuleRouter({ moduleId, token, onBack }: ListeningModuleRouterProps) {
  const manifest = getListeningModule(moduleId);
  if (!manifest) return null;
  if (manifest.status !== 'active') return <ComingSoonModule module={manifest} admin onBack={onBack} />;
  const AdminComponent = getListeningClientModule(moduleId)?.AdminComponent;
  if (!AdminComponent) return <ComingSoonModule module={manifest} admin onBack={onBack} />;
  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-600">
        <ArrowLeft size={15} aria-hidden="true" /> Chọn module khác
      </button>
      <AdminComponent token={token} />
    </div>
  );
}

