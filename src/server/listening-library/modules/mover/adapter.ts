import { getListeningModule } from '../../../../features/listening-library/registry.js';
import { gradeListeningAttempt, LISTENING_GRADING_VERSION } from '../../../listening/listeningGrader.js';
import { createListeningRouter } from '../../../listening/listeningRouter.js';
import {
  sanitizeListeningContentForStudent,
  validateListeningSetContent,
} from '../../../listening/listeningValidation.js';
import type { ListeningServerModule } from '../../types.js';

const manifest = getListeningModule('mover');
if (!manifest) throw new Error('Missing Mover listening module manifest.');

export const moverServerModule: ListeningServerModule = {
  manifest,
  createLegacyRouter: createListeningRouter,
  validateContent: validateListeningSetContent,
  sanitizeContentForStudent: sanitizeListeningContentForStudent,
  gradeAttempt: gradeListeningAttempt,
  gradingVersion: LISTENING_GRADING_VERSION,
};

export const createMoverLegacyRouter = createListeningRouter;
