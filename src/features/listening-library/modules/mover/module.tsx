import { ArrowLeft, BookOpenText, Headphones } from 'lucide-react';
import { useState } from 'react';
import ListeningAdminModule from '../../../listening/admin/ListeningAdminModule';
import { listeningApi } from '../../../listening/api';
import ListeningLearningArea from '../../../listening/student/ListeningLearningArea';
import MoverReadingWritingAdmin from '../../../mover-reading-writing/admin/MoverReadingWritingAdmin';
import { moverReadingWritingApi } from '../../../mover-reading-writing/api';
import MoverReadingWritingLearningArea from '../../../mover-reading-writing/student/MoverReadingWritingLearningArea';
import { getListeningModule } from '../../registry';
import type { ListeningClientModule } from '../../clientTypes';
import type {
  ListeningAdminComponentProps,
  ListeningExamComponentProps,
} from '../../clientTypes';

function MoverExamAdapter({ examId, accessToken, onBack }: ListeningExamComponentProps) {
  return <ListeningLearningArea setId={examId} accessToken={accessToken} onBack={onBack} />;
}

function MoverAdminAdapter({ token }: ListeningAdminComponentProps) {
  const [paper, setPaper] = useState<'listening' | 'reading-writing' | null>(null);
  if (paper) {
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => setPaper(null)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700"><ArrowLeft size={15} /> Chọn loại bài thi khác</button>
        {paper === 'listening' ? <ListeningAdminModule token={token} /> : <MoverReadingWritingAdmin token={token} />}
      </div>
    );
  }
  return (
    <div className="space-y-5" id="mover-paper-admin-hub">
      <div><p className="text-xs font-black uppercase tracking-[.18em] text-indigo-600">Mover</p><h2 className="mt-1 text-2xl font-black text-slate-900">Chọn loại bài thi</h2><p className="mt-1 text-sm font-semibold text-slate-500">Listening và Reading & Writing có dữ liệu, trình soạn và cách chấm riêng.</p></div>
      <div className="grid gap-4 md:grid-cols-2">
        <button type="button" onClick={() => setPaper('listening')} className="mover-paper-choice-action rounded-3xl border border-sky-200 bg-sky-50 p-6 text-left shadow-sm"><Headphones size={30} className="text-sky-700" /><span className="mt-4 block text-2xl font-black text-slate-900">Listening</span><span className="mt-2 block text-sm font-semibold text-slate-600">5 Part · 25 câu tương tác</span></button>
        <button type="button" onClick={() => setPaper('reading-writing')} className="mover-paper-choice-action rounded-3xl border border-indigo-200 bg-indigo-50 p-6 text-left shadow-sm"><BookOpenText size={30} className="text-indigo-700" /><span className="mt-4 block text-2xl font-black text-slate-900">Reading & Writing</span><span className="mt-2 block text-sm font-semibold text-slate-600">6 Part · 40 câu</span></button>
      </div>
    </div>
  );
}

function MoverReadingWritingExamAdapter({ examId, accessToken, onBack }: ListeningExamComponentProps) {
  return <MoverReadingWritingLearningArea setId={examId} accessToken={accessToken} onBack={onBack} />;
}

const manifest = getListeningModule('mover');
if (!manifest) throw new Error('Missing Mover listening module manifest.');

export const moverClientModule: ListeningClientModule = {
  id: 'mover',
  manifest,
  ExamComponent: MoverExamAdapter,
  AdminComponent: MoverAdminAdapter,
  papers: {
    listening: {
      id: 'listening',
      ExamComponent: MoverExamAdapter,
      async listExams(token) {
        return moverClientModule.listExams!(token);
      },
    },
    'reading-writing': {
      id: 'reading-writing',
      ExamComponent: MoverReadingWritingExamAdapter,
      async listExams(token) {
        const sets = await moverReadingWritingApi.listPublicSets(token);
        return sets.map(set => ({
          moduleId: 'mover' as const,
          examId: set.id,
          schemaVersion: set.schemaVersion,
          title: set.title,
          description: set.description,
          gradeLevel: set.level,
          visibility: set.visibility,
          status: set.status,
          coverUrl: set.coverUrl,
          timeLimitMinutes: set.timeLimitMinutes,
          publishedVersionNumber: set.publishedVersionNumber,
          createdAt: set.createdAt,
          updatedAt: set.updatedAt,
        }));
      },
    },
  },
  async listExams(token) {
    const sets = await listeningApi.listPublicSets(token);
    return sets
      .filter(set => set.status === 'published' && set.visibility === 'public')
      .map(set => ({
        moduleId: 'mover' as const,
        examId: String(set.id),
        schemaVersion: Number(set.schemaVersion || manifest.schemaVersion),
        title: String(set.title || ''),
        description: String(set.description || ''),
        gradeLevel: String(set.level || 'Movers'),
        visibility: set.visibility,
        status: set.status,
        coverUrl: set.coverUrl || undefined,
        timeLimitMinutes: set.timeLimitMinutes || undefined,
        publishedVersionNumber: set.publishedVersionNumber || undefined,
        createdAt: set.createdAt || undefined,
        updatedAt: set.updatedAt || undefined,
        createdBy: set.createdBy || undefined,
      }));
  },
};
