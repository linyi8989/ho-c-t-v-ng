import type { ListeningModuleId } from './types';
import type { ListeningClientModule } from './clientTypes';
import { moverClientModule } from './modules/mover/module';

const clientModules = new Map<ListeningModuleId, ListeningClientModule>([
  [moverClientModule.id, moverClientModule],
]);

export function getListeningClientModule(moduleId: ListeningModuleId) {
  return clientModules.get(moduleId);
}

export function getListeningClientPaper(moduleId: ListeningModuleId, paperId: import('./types').ListeningPaperId) {
  return clientModules.get(moduleId)?.papers?.[paperId];
}
