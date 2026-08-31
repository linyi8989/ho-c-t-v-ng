import { BookOpenText, Headphones, Plus, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { getListeningClientModule } from '../clientRegistry';
import { getListeningModule } from '../registry';
import ComingSoonModule from '../shared/ComingSoonModule';
import type { ListeningModuleId, ListeningPaperId } from '../types';

interface ListeningModuleRouterProps {
  moduleId: ListeningModuleId;
  token: string;
  onBack: () => void;
}

export default function ListeningModuleRouter({ moduleId, token, onBack }: ListeningModuleRouterProps) {
  const manifest = getListeningModule(moduleId);
  const availablePapers = useMemo(
    () => manifest?.papers.filter(paper => paper.status === 'active' && paper.capabilities.admin) || [],
    [manifest],
  );
  const preferredPaperId = availablePapers.find(paper => paper.id === 'reading-writing')?.id
    || availablePapers[0]?.id;
  const [paperId, setPaperId] = useState<ListeningPaperId | undefined>(preferredPaperId);
  const [searchQuery, setSearchQuery] = useState('');
  const [createRequest, setCreateRequest] = useState<{ paperId: ListeningPaperId; key: number } | null>(null);
  const [editorActive, setEditorActive] = useState(false);
  const createSequence = useRef(0);

  useEffect(() => {
    setPaperId(preferredPaperId);
    setSearchQuery('');
    setCreateRequest(null);
    setEditorActive(false);
  }, [moduleId, preferredPaperId]);

  if (!manifest) return null;
  if (manifest.status !== 'active') return <ComingSoonModule module={manifest} admin onBack={onBack} />;
  const AdminComponent = getListeningClientModule(moduleId)?.AdminComponent;
  if (!AdminComponent) return <ComingSoonModule module={manifest} admin onBack={onBack} />;
  if (!paperId) return <ComingSoonModule module={manifest} admin onBack={onBack} />;

  const requestCreate = (nextPaperId: ListeningPaperId) => {
    createSequence.current += 1;
    setPaperId(nextPaperId);
    setCreateRequest({ paperId: nextPaperId, key: createSequence.current });
  };

  const createLabel = (nextPaperId: ListeningPaperId, displayName: string) => {
    if (nextPaperId === 'reading-writing') return 'Soạn R&W';
    if (nextPaperId === 'reading-use-of-english') return 'Soạn Reading & UoE';
    return `Soạn ${displayName}`;
  };

  const activePaper = availablePapers.find(paper => paper.id === paperId);
  const createRequestKey = createRequest?.paperId === paperId ? createRequest.key : 0;

  return (
    <section className="space-y-4" id="exam-module-admin-hub" data-module={moduleId}>
      <header className="exam-module-list-header grid gap-4 xl:grid-cols-[minmax(280px,auto)_minmax(320px,640px)_auto] xl:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[.18em] text-indigo-700">{manifest.displayName} paper</p>
          <h2 className="mt-1 text-2xl font-black text-slate-900">Danh sách bộ đề đã soạn</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            {activePaper?.displayName || 'Bài thi'} · Tìm, mở và quản lý bộ đề ngay trong module này.
          </p>
        </div>
        <label className="exam-library-search-control flex min-h-11 w-full items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 xl:max-w-2xl">
          <Search size={17} className="shrink-0 text-slate-500" aria-hidden="true" />
          <span className="sr-only">Tìm bộ đề theo tên</span>
          <input
            type="search"
            value={searchQuery}
            disabled={editorActive}
            onChange={event => setSearchQuery(event.target.value)}
            placeholder={`Tìm bộ đề ${manifest.displayName} theo tên…`}
            className="min-w-0 flex-1 border-0 bg-transparent py-2 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-500 disabled:cursor-not-allowed"
          />
        </label>
        <div className="flex flex-wrap gap-2 xl:justify-end" aria-label="Soạn bộ đề theo loại bài thi">
          {availablePapers.map(paper => (
            <button
              key={paper.id}
              type="button"
              data-exam-paper-create={paper.id}
              disabled={editorActive}
              onClick={() => requestCreate(paper.id)}
              className="exam-paper-create-action inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-black shadow-sm focus-visible:outline-none"
            >
              <Plus size={16} aria-hidden="true" /> {createLabel(paper.id, paper.displayName)}
            </button>
          ))}
        </div>
      </header>

      <div className="exam-paper-sort-row flex flex-wrap items-center gap-2" aria-label="Sắp xếp danh sách theo loại bài thi">
        <span className="exam-paper-sort-label text-xs font-black uppercase tracking-wide text-slate-500">Loại đề</span>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Lọc theo loại bài thi">
          {availablePapers.map(paper => {
            const selected = paper.id === paperId;
            return (
              <button
                key={paper.id}
                type="button"
                data-exam-paper-filter={paper.id}
                aria-pressed={selected}
                disabled={editorActive}
                onClick={() => {
                  setPaperId(paper.id);
                  setCreateRequest(null);
                }}
                className="exam-paper-filter-action inline-flex min-h-10 items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-black focus-visible:outline-none"
              >
                {paper.id === 'listening'
                  ? <Headphones size={15} aria-hidden="true" />
                  : <BookOpenText size={15} aria-hidden="true" />}
                {paper.displayName}
              </button>
            );
          })}
        </div>
      </div>

      <AdminComponent
        token={token}
        paperId={paperId}
        searchQuery={searchQuery}
        createRequestKey={createRequestKey}
        embedded
        onCreateRequestHandled={() => setCreateRequest(current => current?.key === createRequestKey ? null : current)}
        onEditorStateChange={setEditorActive}
      />
    </section>
  );
}
