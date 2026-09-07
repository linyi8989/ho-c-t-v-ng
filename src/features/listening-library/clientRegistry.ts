import type { ListeningModuleId } from './types';
import type { ListeningClientModule } from './clientTypes';
import { moverClientModule } from './modules/mover/module';
import {
  fceClientModule,
  flyerClientModule,
  ieltsClientModule,
  ketClientModule,
  petClientModule,
  starterClientModule,
  writingClientModule,
} from '../exam-platform/module';

const clientModules = new Map<ListeningModuleId, ListeningClientModule>([
  [writingClientModule.id, writingClientModule],
  [starterClientModule.id, starterClientModule],
  [moverClientModule.id, moverClientModule],
  [flyerClientModule.id, flyerClientModule],
  [ketClientModule.id, ketClientModule],
  [petClientModule.id, petClientModule],
  [fceClientModule.id, fceClientModule],
  [ieltsClientModule.id, ieltsClientModule],
]);

export function getListeningClientModule(moduleId: ListeningModuleId) {
  return clientModules.get(moduleId);
}

export function getListeningClientPaper(moduleId: ListeningModuleId, paperId: import('./types').ListeningPaperId) {
  return clientModules.get(moduleId)?.papers?.[paperId];
}
