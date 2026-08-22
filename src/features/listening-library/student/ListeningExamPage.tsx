import { getListeningClientModule, getListeningClientPaper } from '../clientRegistry';
import { getListeningModule, getListeningPaper } from '../registry';
import ComingSoonModule from '../shared/ComingSoonModule';
import type { ListeningModuleId, ListeningPaperId } from '../types';

interface ListeningExamPageProps {
  moduleId: ListeningModuleId;
  examId: string;
  accessToken?: string;
  onBack: () => void;
  paperId?: ListeningPaperId;
}

export default function ListeningExamPage({
  moduleId,
  examId,
  accessToken,
  onBack,
  paperId,
}: ListeningExamPageProps) {
  const manifest = getListeningModule(moduleId);
  if (!manifest) return <div className="flex min-h-screen items-center justify-center font-black text-rose-700">Module không tồn tại.</div>;
  if (manifest.status !== 'active') return <ComingSoonModule module={manifest} onBack={onBack} />;
  const paperManifest = paperId ? getListeningPaper(moduleId, paperId) : undefined;
  if (paperId && (!paperManifest || paperManifest.status !== 'active')) return <div className="flex min-h-screen items-center justify-center font-black text-rose-700">Loại bài thi chưa hoạt động.</div>;
  const clientModule = getListeningClientModule(moduleId);
  const ExamComponent = paperId ? getListeningClientPaper(moduleId, paperId)?.ExamComponent : clientModule?.ExamComponent;
  if (!ExamComponent) return <div className="flex min-h-screen items-center justify-center font-black text-rose-700">Module chưa có giao diện làm bài.</div>;
  return <ExamComponent examId={examId} accessToken={accessToken} onBack={onBack} />;
}
