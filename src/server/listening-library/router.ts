import express from 'express';
import {
  getListeningModule,
  getVisibleListeningModules,
  isListeningModuleId,
  publicListeningModuleManifest,
} from '../../features/listening-library/registry.js';
import { getListeningServerModule } from './registry.js';
import { getModuleExamPaperDefinitions } from '../../features/exam-platform/definitions.js';
import { EXAM_GRADING_VERSION } from '../exam-platform/examGrader.js';

export function createListeningLibraryRouter() {
  const router = express.Router();

  router.get('/modules', (_req, res) => {
    res.json(getVisibleListeningModules().map(publicListeningModuleManifest));
  });

  router.get('/modules/:moduleId', (req, res) => {
    if (!isListeningModuleId(req.params.moduleId)) {
      return res.status(404).json({ error: 'Module kỳ thi không tồn tại.' });
    }
    const manifest = getListeningModule(req.params.moduleId);
    if (!manifest || manifest.status === 'hidden') {
      return res.status(404).json({ error: 'Module kỳ thi không tồn tại.' });
    }
    const serverModule = getListeningServerModule(req.params.moduleId);
    const genericAvailable = req.params.moduleId !== 'mover'
      && getModuleExamPaperDefinitions(req.params.moduleId).length > 0;
    return res.json({
      ...publicListeningModuleManifest(manifest),
      available: Boolean((serverModule || genericAvailable) && manifest.status === 'active'),
      gradingVersion: serverModule?.gradingVersion || (genericAvailable ? EXAM_GRADING_VERSION : undefined),
    });
  });

  return router;
}
