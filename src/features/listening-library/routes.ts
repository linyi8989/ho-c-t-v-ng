import {
  DEFAULT_LISTENING_MODULE_ID,
  isListeningModuleId,
} from './registry';
import type { ListeningLibraryRoute, ListeningModuleId } from './types';

function decodeSegment(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function parseListeningLibraryRoute(
  pathname: string,
  search = ''
): ListeningLibraryRoute | null {
  const normalizedPath = pathname.replace(/\/+$/, '') || '/';
  if (normalizedPath === '/listening') return { kind: 'library' };

  const canonicalExam = normalizedPath.match(/^\/listening\/modules\/([^/?#]+)\/exams\/([^/?#]+)$/);
  if (canonicalExam) {
    const moduleId = decodeSegment(canonicalExam[1]);
    if (!isListeningModuleId(moduleId)) return null;
    const params = new URLSearchParams(search);
    return {
      kind: 'exam',
      moduleId,
      examId: decodeSegment(canonicalExam[2]),
      accessToken: params.get('accessToken') || params.get('shareToken') || '',
      legacy: false,
    };
  }

  const moduleDirectory = normalizedPath.match(/^\/listening\/modules\/([^/?#]+)$/);
  if (moduleDirectory) {
    const moduleId = decodeSegment(moduleDirectory[1]);
    return isListeningModuleId(moduleId) ? { kind: 'module', moduleId } : null;
  }

  const legacyExam = normalizedPath.match(/^\/listening\/([^/?#]+)$/);
  if (!legacyExam) return null;
  const params = new URLSearchParams(search);
  return {
    kind: 'exam',
    moduleId: DEFAULT_LISTENING_MODULE_ID,
    examId: decodeSegment(legacyExam[1]),
    accessToken: params.get('accessToken') || params.get('shareToken') || '',
    legacy: true,
  };
}

export const listeningLibraryPath = () => '/listening';
export const listeningModulePath = (moduleId: ListeningModuleId) => (
  `/listening/modules/${encodeURIComponent(moduleId)}`
);
export const listeningExamPath = (
  moduleId: ListeningModuleId,
  examId: string,
  accessToken = ''
) => {
  const base = `${listeningModulePath(moduleId)}/exams/${encodeURIComponent(examId)}`;
  return accessToken ? `${base}?accessToken=${encodeURIComponent(accessToken)}` : base;
};

