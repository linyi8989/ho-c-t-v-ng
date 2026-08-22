import express from 'express';
import {
  getListeningModule,
  getVisibleListeningModules,
  isListeningModuleId,
  publicListeningModuleManifest,
} from '../../features/listening-library/registry.js';
import { getListeningServerModule } from './registry.js';

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
    return res.json({
      ...publicListeningModuleManifest(manifest),
      available: Boolean(serverModule && manifest.status === 'active'),
      gradingVersion: serverModule?.gradingVersion,
    });
  });

  return router;
}
