import type { ComponentType } from 'react';
import GenericExamModuleAdmin from './admin/GenericExamAdmin';
import GenericExamLearningArea from './student/GenericExamLearningArea';
import { examPlatformApi } from './api';
import { getListeningModule } from '../listening-library/registry';
import type {
  ListeningAdminComponentProps,
  ListeningExamComponentProps,
  ListeningClientModule,
  ListeningClientPaper,
} from '../listening-library/clientTypes';
import type { ExamModuleId, ExamPaperId } from '../listening-library/types';

type GenericModuleId = Exclude<ExamModuleId, 'mover'>;

function createExamComponent(moduleId: GenericModuleId, paperId: ExamPaperId): ComponentType<ListeningExamComponentProps> {
  return function ExamAdapter({ examId, accessToken, onBack }: ListeningExamComponentProps) {
    return <GenericExamLearningArea moduleId={moduleId} paperId={paperId} setId={examId} accessToken={accessToken} onBack={onBack} />;
  };
}

export function createGenericClientModule(moduleId: GenericModuleId): ListeningClientModule {
  const manifest = getListeningModule(moduleId);
  if (!manifest) throw new Error(`Missing ${moduleId} exam module manifest.`);
  const AdminComponent = ({ token }: ListeningAdminComponentProps) => <GenericExamModuleAdmin token={token} moduleId={moduleId} />;
  const papers: Partial<Record<ExamPaperId, ListeningClientPaper>> = {};
  manifest.papers.forEach(paper => {
    const ExamComponent = createExamComponent(moduleId, paper.id);
    papers[paper.id] = {
      id: paper.id,
      ExamComponent,
      async listExams(token) {
        const sets = await examPlatformApi.listPublicSets(moduleId, paper.id, token);
        return sets.map(set => ({
          moduleId,
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
    };
  });
  return { id: moduleId, manifest, AdminComponent, papers };
}

export const starterClientModule = createGenericClientModule('starter');
export const flyerClientModule = createGenericClientModule('flyer');
export const ketClientModule = createGenericClientModule('ket');
export const petClientModule = createGenericClientModule('pet');
export const fceClientModule = createGenericClientModule('fce');
export const ieltsClientModule = createGenericClientModule('ielts');

