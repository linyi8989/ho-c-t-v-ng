import { ArrowLeft, ArrowRight, BookOpenText, Clock3, Headphones, LoaderCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { getListeningClientPaper } from '../clientRegistry';
import { getListeningPaper } from '../registry';
import { examPaperExamPath } from '../routes';
import type { ListeningLibraryExamSummary, ListeningModuleId, ListeningPaperId } from '../types';

interface Props { moduleId: ListeningModuleId; paperId: ListeningPaperId; onBack: () => void }

export default function ListeningPaperPage({ moduleId, paperId, onBack }: Props) {
  const { token, loading: authLoading } = useAuth();
  const manifest = getListeningPaper(moduleId, paperId);
  const paper = getListeningClientPaper(moduleId, paperId);
  const [exams, setExams] = useState<ListeningLibraryExamSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading || !manifest || !paper) { setLoading(false); return; }
    let cancelled = false;
    setLoading(true);
    paper.listExams(token)
      .then(rows => { if (!cancelled) setExams(rows); })
      .catch(reason => { if (!cancelled) setError(reason.message || 'Không thể tải danh sách bộ đề.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [authLoading, manifest, paper, token]);

  if (!manifest || !paper) return <div className="flex min-h-screen items-center justify-center font-black text-rose-700">Loại bài thi chưa được cấu hình.</div>;
  const listening = paperId === 'listening';
  const total = typeof manifest.questionsPerPart === 'number'
    ? manifest.questionsPerPart * manifest.partCount
    : manifest.questionsPerPart.reduce((sum, count) => sum + count, 0);
  return (
    <main className="min-h-screen bg-gradient-to-b from-sky-100 via-white to-indigo-50 p-4 sm:p-8" id="listening-paper-page" data-paper={paperId}>
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 rounded-3xl border border-white bg-white p-6 shadow-xl sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-4"><span className={`flex h-14 w-14 items-center justify-center rounded-2xl text-white ${listening ? 'bg-sky-600' : 'bg-indigo-600'}`}>{listening ? <Headphones size={27} /> : <BookOpenText size={27} />}</span><div><p className="text-xs font-black uppercase tracking-[.18em] text-indigo-600">Cambridge &amp; IELTS · {moduleId}</p><h1 className="text-3xl font-black text-slate-900">{manifest.displayName}</h1><p className="mt-1 text-sm font-semibold text-slate-500">{manifest.description}</p></div></div><button type="button" onClick={onBack} className="listening-library-secondary-action inline-flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-xs font-black"><ArrowLeft size={15} /> Tất cả bộ đề</button></header>
        {loading ? <div className="flex min-h-64 items-center justify-center rounded-3xl bg-white"><LoaderCircle className="animate-spin text-indigo-600" size={36} /></div> : error ? <div className="rounded-3xl border border-rose-200 bg-rose-50 p-8 text-center font-bold text-rose-700">{error}</div> : exams.length === 0 ? <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center font-semibold text-slate-500">Chưa có bộ đề {manifest.displayName} công khai.</div> : <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{exams.map(exam => <article key={exam.examId} className="overflow-hidden rounded-3xl border border-indigo-100 bg-white shadow-sm">{exam.coverUrl ? <img src={exam.coverUrl} alt="" className="h-44 w-full object-cover" /> : <div className="flex h-32 items-center justify-center bg-gradient-to-br from-indigo-100 to-sky-100 text-indigo-700">{listening ? <Headphones size={38} /> : <BookOpenText size={38} />}</div>}<div className="p-5"><div className="flex items-center justify-between text-[10px] font-black uppercase text-indigo-700"><span>{exam.gradeLevel}</span><span>{manifest.partCount} Part · {total} câu</span></div><h2 className="mt-3 text-lg font-black text-slate-900">{exam.title}</h2><p className="mt-2 min-h-10 text-xs font-semibold leading-5 text-slate-500 line-clamp-2">{exam.description}</p><div className="mt-3 flex items-center gap-2 text-xs font-bold text-slate-400"><Clock3 size={14} />{exam.timeLimitMinutes ? `${exam.timeLimitMinutes} phút` : 'Không giới hạn thời gian'}</div><button type="button" onClick={() => { window.location.href = examPaperExamPath(moduleId, paperId, exam.examId); }} className="listening-library-primary-action mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black">Bắt đầu {manifest.displayName}<ArrowRight size={16} /></button></div></article>)}</div>}
      </div>
    </main>
  );
}
