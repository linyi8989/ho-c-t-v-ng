import type { ListeningModuleManifest } from '../../features/listening-library/types.js';
import type { gradeListeningAttempt } from '../listening/listeningGrader.js';
import type { createListeningRouter } from '../listening/listeningRouter.js';
import type {
  sanitizeListeningContentForStudent,
  validateListeningSetContent,
} from '../listening/listeningValidation.js';

export interface ListeningServerModule {
  manifest: ListeningModuleManifest;
  createLegacyRouter: typeof createListeningRouter;
  validateContent: typeof validateListeningSetContent;
  sanitizeContentForStudent: typeof sanitizeListeningContentForStudent;
  gradeAttempt: typeof gradeListeningAttempt;
  gradingVersion: string;
}

