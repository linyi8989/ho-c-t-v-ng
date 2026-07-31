import { ArrowLeft, ArrowRight, Clock3, Headphones, LoaderCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { getListeningClientModule } from '../clientRegistry';
import { getListeningModule } from '../registry';
import { listeningExamPath } from '../routes';
import ComingSoonModule from '../shared/ComingSoonModule';
import type { ListeningLibraryExamSummary, ListeningModuleId } from '../types';

interface ListeningModulePageProps {
  moduleId: ListeningModuleId;
  onBack: () => void;
}

export default function ListeningModulePage({ moduleId, onBack }: ListeningModulePageProps) {
  const { token, loading: authLoading } = useAuth();
  const manifest = getListeningModule(moduleId);
  const clientModule = getListeningClientModule(moduleId);
  const [exams, setExams] = useState<ListeningLibraryExamSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading || !manifest || manifest.status !== 'active' || !clientModule?.listExams) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    clientModule.listExams(token)
      .then(rows => { if (!cancelled) setExams(rows); })
      .catch(reason => { if (!cancelled) setError(reason.message || 'Không thể tải danh sách bộ đề.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [authLoading, clientModule, manifest, token]);

  if (!manifest) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 font-black text-rose-700">Module không tồn tại.</div>;
  }
  if (manifest.status !== 'active') return <ComingSoonModule module={manifest} onBack={onBack} />;
  const totalQuestions = typeof manifest.questionsPerPart === 'number' && manifest.partCount
    ? manifest.questionsPerPart * manifest.partCount
    : Array.isArray(manifest.questionsPerPart)
      ? manifest.questionsPerPart.reduce((total, count) => total + count, 0)
      : null;

  return (
    <main
      className="min-h-screen bg-gradient-to-b from-sky-100 via-white to-emerald-50 p-4 sm:p-8"
      id="listening-module-page"
      data-listening-module={manifest.id}
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 rounded-[2rem] border border-white bg-white p-6 shadow-xl sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-600 text-white"><Headphones size={27} aria-hidden="true" /></span>
            <div>
              <p className="text-xs font-black uppercase tracking-[.18em] text-sky-600">Kho bài luyện nghe</p>
              <h1 className="text-3xl font-black text-slate-900">{manifest.displayName}</h1>
              <p className="mt-1 text-sm font-semibold text-slate-500">{manifest.description}</p>
            </div>
          </div>
          <button type="button" onClick={onBack} className="listening-library-secondary-action inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-xs font-black">
            <ArrowLeft size={15} aria-hidden="true" /> Quay lại
          </button>
        </header>

        {loading ? (
          <div className="flex min-h-64 items-center justify-center rounded-3xl border border-slate-200 bg-white"><LoaderCircle className="animate-spin text-sky-600" size={36} /></div>
        ) : error ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center text-sm font-black text-rose-700">{error}</div>
        ) : exams.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-sm font-semibold text-slate-500">Chưa có bộ đề {manifest.displayName} công khai.</div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {exams.map(exam => (
              <article key={exam.examId} className="overflow-hidden rounded-3xl border border-sky-100 bg-white shadow-sm">
                {exam.coverUrl ? <img src={exam.coverUrl} alt="" className="h-44 w-full object-cover" /> : <div className="flex h-32 items-center justify-center bg-gradient-to-br from-sky-100 to-indigo-100 text-sky-700"><Headphones size={38} aria-hidden="true" /></div>}
                <div className="p-5">
                  <div className="flex items-center justify-between gap-3 text-[10px] font-black uppercase text-sky-700">
                    <span>{exam.gradeLevel}</span>
                    <span>
                      {manifest.partCount ? `${manifest.partCount} Part` : 'Nhiều Part'}
                      {totalQuestions ? ` • ${totalQuestions} câu` : ''}
                    </span>
                  </div>
                  <h2 className="mt-3 text-lg font-black text-slate-900">{exam.title}</h2>
                  <p className="mt-2 min-h-10 text-xs font-semibold leading-5 text-slate-500 line-clamp-2">{exam.description}</p>
                  <div className="mt-3 flex items-center gap-2 text-xs font-bold text-slate-400">
                    <Clock3 size={14} aria-hidden="true" />
                    {exam.timeLimitMinutes ? `${exam.timeLimitMinutes} phút` : 'Không giới hạn thời gian'}
                  </div>
                  <button type="button" onClick={() => { window.location.href = listeningExamPath(moduleId, exam.examId); }} className="listening-library-primary-action mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black">
                    Bắt đầu luyện nghe <ArrowRight size={16} aria-hidden="true" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
