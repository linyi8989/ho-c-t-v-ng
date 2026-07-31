import { getListeningClientModule } from '../clientRegistry';
import { getListeningModule } from '../registry';
import ComingSoonModule from '../shared/ComingSoonModule';
import type { ListeningModuleId } from '../types';

interface ListeningExamPageProps {
  moduleId: ListeningModuleId;
  examId: string;
  accessToken?: string;
  onBack: () => void;
}

export default function ListeningExamPage({
  moduleId,
  examId,
  accessToken,
  onBack,
}: ListeningExamPageProps) {
  const manifest = getListeningModule(moduleId);
  if (!manifest) return <div className="flex min-h-screen items-center justify-center font-black text-rose-700">Module không tồn tại.</div>;
  if (manifest.status !== 'active') return <ComingSoonModule module={manifest} onBack={onBack} />;
  const clientModule = getListeningClientModule(moduleId);
  const ExamComponent = clientModule?.ExamComponent;
  if (!ExamComponent) return <div className="flex min-h-screen items-center justify-center font-black text-rose-700">Module chưa có giao diện làm bài.</div>;
  return <ExamComponent examId={examId} accessToken={accessToken} onBack={onBack} />;
}

