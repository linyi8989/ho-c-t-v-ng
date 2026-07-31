import type { ListeningModuleId } from '../../features/listening-library/types.js';
import type { ListeningServerModule } from './types.js';
import { moverServerModule } from './modules/mover/adapter.js';

const serverModules = new Map<ListeningModuleId, ListeningServerModule>([
  [moverServerModule.manifest.id, moverServerModule],
]);

export function getListeningServerModule(moduleId: ListeningModuleId) {
  return serverModules.get(moduleId);
}

