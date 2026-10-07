import type { ListeningModuleId, ListeningPaperId } from '../listening-library/types';

export const SCENE_MODULES = ['starter', 'mover', 'flyer', 'ket', 'pet', 'fce', 'ielts'] as const satisfies readonly ListeningModuleId[];
export type SceneModule = typeof SCENE_MODULES[number];
export type ScenePaperId = ListeningPaperId;
export const STARTER_PAPERS = ['listening', 'reading-writing'] as const;
export type StarterPaper = typeof STARTER_PAPERS[number];
export interface SceneEntry { id: string; setId: string }
export interface SceneLink { id: string; title: string; href: string }
export interface ScenePaper { revision: number; configured: boolean; links: SceneLink[] }
export interface SceneCatalog { papers: Partial<Record<ScenePaperId, ScenePaper>> }
export interface SceneChoice { setId: string; title: string; manageable: boolean }
export interface SceneAdminEntry extends SceneEntry { title: string; available: boolean; manageable: boolean }
export interface SceneAdminPaper { revision: number; configured: boolean; entries: SceneAdminEntry[]; choices: SceneChoice[] }
export const paperLabel = (paper: ScenePaperId) => ({ listening: 'Listening', 'reading-writing': 'Reading & Writing', reading: 'Reading', writing: 'Writing', 'reading-use-of-english': 'Reading & Use of English', 'academic-reading': 'Academic Reading', 'academic-writing': 'Academic Writing' })[paper];
