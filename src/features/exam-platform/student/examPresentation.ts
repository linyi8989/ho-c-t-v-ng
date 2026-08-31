import type { ExamModuleId, ExamPaperId } from '../../listening-library/types';
import type { ExamInteractionDescriptor, ExamInteractionLayout } from '../types';
import type { ExamImageProfile } from '../../exam-media/imageProfiles';

export type ExamMediaRole = 'cover' | 'part' | 'question' | 'example' | 'reading-scene' | 'word-bank' | 'option';
export type ExamTaskLayout = 'stack' | 'split-task';

interface PresentationContext {
  moduleId: ExamModuleId;
  paperId: ExamPaperId;
  partNumber: number;
  mediaRole: ExamMediaRole;
  interaction?: ExamInteractionDescriptor;
  interactionLayout?: ExamInteractionLayout;
}

const interactiveLayout = (layout?: ExamInteractionLayout) => Boolean(layout && [
  'starter-image-matching-v1',
  'starter-image-matching-v2',
  'starter-scene-colour-v1',
  'scene-draw-v1',
  'image-text-entry-v1',
].includes(layout.kind));

export function resolveExamImageProfile(context: PresentationContext): ExamImageProfile {
  if (context.mediaRole === 'cover') return 'cover';
  if (context.mediaRole === 'option') return 'option';
  if (context.mediaRole === 'example') return 'cover';
  if (context.mediaRole === 'reading-scene') return 'story-scene';
  if (context.mediaRole === 'word-bank') return 'word-bank';
  if (interactiveLayout(context.interactionLayout) || context.interaction?.family === 'scene' || context.interaction?.family === 'matching') return 'interactive-scene';
  if (context.mediaRole === 'question') return 'illustration';
  if (context.moduleId === 'flyer' && context.paperId === 'reading-writing' && context.partNumber === 3) return 'split-page';
  if (context.paperId === 'academic-reading' || context.paperId === 'reading' || context.paperId === 'reading-use-of-english') return 'page-scan';
  if (context.paperId === 'reading-writing') return 'page-scan';
  return 'illustration';
}

export function resolveExamTaskLayout(context: Pick<PresentationContext, 'moduleId' | 'paperId' | 'partNumber'>): ExamTaskLayout {
  return context.moduleId === 'flyer' && context.paperId === 'reading-writing' && context.partNumber === 3
    ? 'split-task'
    : 'stack';
}
