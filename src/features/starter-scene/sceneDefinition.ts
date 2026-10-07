import { getListeningModule } from '../listening-library/registry';
import { SCENE_MODULES, type SceneModule } from './types';

export function getSceneDefinition(moduleId: SceneModule) {
  const manifest = getListeningModule(moduleId)!;
  const papers = manifest.papers.filter(paper => paper.status === 'active' && paper.capabilities.student)
    .sort((left, right) => Number(right.id === 'listening') - Number(left.id === 'listening'));
  const position = SCENE_MODULES.indexOf(moduleId);
  return {
    title: manifest.displayName,
    level: manifest.levelLabel,
    papers,
    threeYards: papers.length === 3,
    previous: SCENE_MODULES[position - 1],
    next: SCENE_MODULES[position + 1],
  };
}
