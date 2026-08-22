import {
  ArrowLeft,
  ArrowRight,
  BookOpenText,
  Clock3,
  Headphones,
  Layers3,
  LoaderCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { listExamModuleEntries, type ExamModuleListItem } from '../moduleExamList';
import { getListeningModule } from '../registry';
import { examPaperExamPath } from '../routes';
import ComingSoonModule from '../shared/ComingSoonModule';
import type { ListeningModuleId, ListeningPaperId } from '../types';

interface ListeningModulePageProps {
  moduleId: ListeningModuleId;
  onBack: () => void;
}

type PaperFilter = 'all' | ListeningPaperId;

export default function ListeningModulePage({ moduleId, onBack }: ListeningModulePageProps) {
  const { token, loading: authLoading } = useAuth();
  const manifest = getListeningModule(moduleId);
  const [exams, setExams] = useState<ExamModuleListItem[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [paperFilter, setPaperFilter] = useState<PaperFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading || !manifest || manifest.status !== 'active') {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    setWarnings([]);
    listExamModuleEntries(moduleId, token)
      .then(result => {
        if (cancelled) return;
        setExams(result.items);
        setWarnings(result.warnings);
      })
      .catch(reason => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Không thể tải danh sách bộ đề.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [authLoading, manifest, moduleId, token]);

  const visibleExams = useMemo(() => (
    paperFilter === 'all' ? exams : exams.filter(exam => exam.paperId === paperFilter)
  ), [exams, paperFilter]);

  if (!manifest) {
    return <div className="flex min-h-screen items-center justify-center bg-slate-50 font-black text-rose-700">Module không tồn tại.</div>;
  }
  if (manifest.status !== 'active') return <ComingSoonModule module={manifest} onBack={onBack} />;
  const activePapers = manifest.papers.filter(paper => paper.status === 'active' && paper.capabilities.student);

  return (
    <main
      className="min-h-screen bg-gradient-to-b from-sky-100 via-white to-emerald-50 p-4 sm:p-8"
      id="listening-module-page"
      data-listening-module={manifest.id}
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 rounded-[2rem] border border-white bg-white p-6 shadow-xl sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-sky-600 text-white"><Layers3 size={27} aria-hidden="true" /></span>
            <div>
              <p className="text-xs font-black uppercase tracking-[.18em] text-sky-600">Cambridge &amp; IELTS</p>
              <h1 className="text-3xl font-black text-slate-900">{manifest.displayName} <span className="text-lg text-sky-700">· {manifest.levelLabel}</span></h1>
              <p className="mt-1 text-sm font-semibold text-slate-500">Chọn trực tiếp một bộ đề; mỗi dòng đã ghi rõ loại bài thi.</p>
            </div>
          </div>
          <button type="button" onClick={onBack} className="listening-library-secondary-action inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-xs font-black">
            <ArrowLeft size={15} aria-hidden="true" /> Quay lại kho đề
          </button>
        </header>

        {activePapers.length > 1 && (
          <nav className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm" aria-label="Lọc loại bài thi">
            <button type="button" className="exam-library-filter-action rounded-xl border px-4 py-2 text-xs font-black" data-active={paperFilter === 'all'} onClick={() => setPaperFilter('all')} aria-pressed={paperFilter === 'all'}>
              Tất cả <span aria-hidden="true">({exams.length})</span>
            </button>
            {activePapers.map(paper => {
              const count = exams.filter(exam => exam.paperId === paper.id).length;
              return (
                <button type="button" key={paper.id} className="exam-library-filter-action rounded-xl border px-4 py-2 text-xs font-black" data-active={paperFilter === paper.id} onClick={() => setPaperFilter(paper.id)} aria-pressed={paperFilter === paper.id}>
                  {paper.displayName} <span aria-hidden="true">({count})</span>
                </button>
              );
            })}
          </nav>
        )}

        {warnings.length > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-900" role="status">
            Một phần danh sách tạm thời chưa tải được: {warnings.join(' · ')}
          </div>
        )}

        {loading ? (
          <div className="flex min-h-64 items-center justify-center rounded-3xl border border-slate-200 bg-white"><LoaderCircle className="animate-spin text-sky-600" size={36} aria-label="Đang tải danh sách bộ đề" /></div>
        ) : error ? (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center text-sm font-black text-rose-700" role="alert">{error}</div>
        ) : visibleExams.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-sm font-semibold text-slate-500">
            {paperFilter === 'all' ? `Chưa có bộ đề ${manifest.displayName} công khai.` : `Chưa có bộ đề ${activePapers.find(paper => paper.id === paperFilter)?.displayName || ''} công khai.`}
          </div>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm" data-exam-list>
            {visibleExams.map((exam, index) => {
              const listening = exam.paperId === 'listening';
              const href = examPaperExamPath(moduleId, exam.paperId, exam.examId);
              return (
                <article key={`${exam.paperId}:${exam.examId}`} className={`flex flex-col gap-4 p-5 sm:flex-row sm:items-center ${index > 0 ? 'border-t border-slate-200' : ''}`}>
                  {exam.coverUrl ? (
                    <img src={exam.coverUrl} alt="" className="h-28 w-full rounded-2xl object-cover sm:w-40" loading="lazy" />
                  ) : (
                    <span className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl ${listening ? 'bg-sky-100 text-sky-700' : 'bg-indigo-100 text-indigo-700'}`} aria-hidden="true">
                      {listening ? <Headphones size={31} /> : <BookOpenText size={31} />}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wide ${listening ? 'bg-sky-100 text-sky-800' : 'bg-indigo-100 text-indigo-800'}`}>
                      {exam.paperDisplayName}
                    </span>
                    <h2 className="mt-2 text-lg font-black text-slate-900">
                      <a href={href} className="exam-library-exam-title rounded-sm hover:text-blue-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500">{exam.title}</a>
                    </h2>
                    {exam.description && <p className="mt-1 text-sm font-semibold leading-5 text-slate-500">{exam.description}</p>}
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-bold text-slate-500">
                      <span>{exam.partCount} Part · {exam.questionCount} câu</span>
                      <span className="inline-flex items-center gap-1"><Clock3 size={14} aria-hidden="true" />{exam.timeLimitMinutes ? `${exam.timeLimitMinutes} phút` : 'Không giới hạn thời gian'}</span>
                    </div>
                  </div>
                  <a href={href} className="listening-library-primary-action inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border px-5 py-3 text-sm font-black">
                    Làm bài <ArrowRight size={16} aria-hidden="true" />
                  </a>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
