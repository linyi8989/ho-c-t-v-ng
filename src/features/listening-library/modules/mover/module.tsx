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

function MoverAdminAdapter(props: ListeningAdminComponentProps) {
  return props.paperId === 'listening'
    ? <ListeningAdminModule {...props} />
    : <MoverReadingWritingAdmin {...props} />;
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
