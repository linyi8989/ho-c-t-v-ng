import {
  DEFAULT_LISTENING_MODULE_ID,
  isListeningModuleId,
  isListeningPaperId,
} from './registry';
import type { ListeningLibraryRoute, ListeningModuleId, ListeningPaperId } from './types';

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
  if (normalizedPath === '/exams' || normalizedPath === '/listening') return { kind: 'library' };

  const examPaperExam = normalizedPath.match(/^\/exams\/([^/?#]+)\/([^/?#]+)\/([^/?#]+)$/);
  if (examPaperExam) {
    const moduleId = decodeSegment(examPaperExam[1]);
    const paperId = decodeSegment(examPaperExam[2]);
    if (!isListeningModuleId(moduleId) || !isListeningPaperId(paperId)) return null;
    const params = new URLSearchParams(search);
    return {
      kind: 'paper-exam',
      moduleId,
      paperId,
      examId: decodeSegment(examPaperExam[3]),
      accessToken: params.get('accessToken') || params.get('shareToken') || '',
    };
  }

  const examPaperDirectory = normalizedPath.match(/^\/exams\/([^/?#]+)\/([^/?#]+)$/);
  if (examPaperDirectory) {
    const moduleId = decodeSegment(examPaperDirectory[1]);
    const paperId = decodeSegment(examPaperDirectory[2]);
    return isListeningModuleId(moduleId) && isListeningPaperId(paperId)
      ? { kind: 'paper', moduleId, paperId }
      : null;
  }

  const examModuleDirectory = normalizedPath.match(/^\/exams\/([^/?#]+)$/);
  if (examModuleDirectory) {
    const moduleId = decodeSegment(examModuleDirectory[1]);
    return isListeningModuleId(moduleId) ? { kind: 'module', moduleId } : null;
  }

  const paperExam = normalizedPath.match(/^\/listening\/modules\/([^/?#]+)\/papers\/([^/?#]+)\/exams\/([^/?#]+)$/);
  if (paperExam) {
    const moduleId = decodeSegment(paperExam[1]);
    const paperId = decodeSegment(paperExam[2]);
    if (!isListeningModuleId(moduleId) || !isListeningPaperId(paperId)) return null;
    const params = new URLSearchParams(search);
    return {
      kind: 'paper-exam',
      moduleId,
      paperId,
      examId: decodeSegment(paperExam[3]),
      accessToken: params.get('accessToken') || params.get('shareToken') || '',
    };
  }

  const paperDirectory = normalizedPath.match(/^\/listening\/modules\/([^/?#]+)\/papers\/([^/?#]+)$/);
  if (paperDirectory) {
    const moduleId = decodeSegment(paperDirectory[1]);
    const paperId = decodeSegment(paperDirectory[2]);
    return isListeningModuleId(moduleId) && isListeningPaperId(paperId)
      ? { kind: 'paper', moduleId, paperId }
      : null;
  }

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

export const examLibraryPath = () => '/exams';
export const examModulePath = (moduleId: ListeningModuleId) => (
  `${examLibraryPath()}/${encodeURIComponent(moduleId)}`
);
export const examPaperPath = (moduleId: ListeningModuleId, paperId: ListeningPaperId) => (
  `${examModulePath(moduleId)}/${encodeURIComponent(paperId)}`
);

export const examPaperExamPath = (
  moduleId: ListeningModuleId,
  paperId: ListeningPaperId,
  examId: string,
  accessToken = '',
) => {
  const base = `${examPaperPath(moduleId, paperId)}/${encodeURIComponent(examId)}`;
  return accessToken ? `${base}?accessToken=${encodeURIComponent(accessToken)}` : base;
};

// Existing imports keep working, but every newly generated URL is canonical.
export const listeningLibraryPath = examLibraryPath;
export const listeningModulePath = examModulePath;
export const listeningExamPath = (
  moduleId: ListeningModuleId,
  examId: string,
  accessToken = '',
) => examPaperExamPath(moduleId, 'listening', examId, accessToken);

export const listeningPaperPath = (moduleId: ListeningModuleId, paperId: ListeningPaperId) => (
  examPaperPath(moduleId, paperId)
);

export const listeningPaperExamPath = (
  moduleId: ListeningModuleId,
  paperId: ListeningPaperId,
  examId: string,
  accessToken = '',
) => {
  return examPaperExamPath(moduleId, paperId, examId, accessToken);
};
