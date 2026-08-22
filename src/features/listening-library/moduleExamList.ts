import { getListeningModule } from './registry';
import type {
  ListeningLibraryExamSummary,
  ListeningModuleId,
  ListeningPaperId,
  ListeningPaperManifest,
} from './types';

export interface ExamModuleListItem extends ListeningLibraryExamSummary {
  paperId: ListeningPaperId;
  paperDisplayName: string;
  partCount: number;
  questionCount: number;
}

export interface ExamPaperListSource {
  paper: ListeningPaperManifest;
  exams: readonly ListeningLibraryExamSummary[];
}

export interface ExamModuleListResult {
  items: ExamModuleListItem[];
  warnings: string[];
}

function totalQuestions(paper: ListeningPaperManifest) {
  return typeof paper.questionsPerPart === 'number'
    ? paper.questionsPerPart * paper.partCount
    : paper.questionsPerPart.reduce((total, count) => total + count, 0);
}

function sortTime(item: ListeningLibraryExamSummary) {
  const timestamp = Date.parse(item.updatedAt || item.createdAt || '');
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function mergeExamPaperLists(sources: readonly ExamPaperListSource[]): ExamModuleListItem[] {
  const unique = new Map<string, ExamModuleListItem>();
  for (const { paper, exams } of sources) {
    for (const exam of exams) {
      if (exam.status !== 'published' || exam.visibility !== 'public') continue;
      const item: ExamModuleListItem = {
        ...exam,
        paperId: paper.id,
        paperDisplayName: paper.displayName,
        partCount: paper.partCount,
        questionCount: totalQuestions(paper),
      };
      const key = `${exam.moduleId}:${paper.id}:${exam.examId}`;
      const current = unique.get(key);
      if (!current || sortTime(item) >= sortTime(current)) unique.set(key, item);
    }
  }
  return Array.from(unique.values()).sort((left, right) => (
    sortTime(right) - sortTime(left)
    || left.title.localeCompare(right.title, 'vi')
    || left.paperId.localeCompare(right.paperId)
    || left.examId.localeCompare(right.examId)
  ));
}

export async function listExamModuleEntries(
  moduleId: ListeningModuleId,
  token: string | null,
): Promise<ExamModuleListResult> {
  const manifest = getListeningModule(moduleId);
  if (!manifest) throw new Error('Module không tồn tại.');
  const papers = manifest.papers.filter(paper => paper.status === 'active' && paper.capabilities.student);
  if (papers.length === 0) return { items: [], warnings: [] };
  const { getListeningClientPaper } = await import('./clientRegistry');

  const settled = await Promise.allSettled(papers.map(async paper => {
    const clientPaper = getListeningClientPaper(moduleId, paper.id);
    if (!clientPaper) throw new Error(`${paper.displayName} chưa có bộ tải danh sách.`);
    return { paper, exams: await clientPaper.listExams(token) } satisfies ExamPaperListSource;
  }));
  const sources: ExamPaperListSource[] = [];
  const warnings: string[] = [];
  settled.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      sources.push(result.value);
      return;
    }
    const message = result.reason instanceof Error ? result.reason.message : 'Không thể tải danh sách.';
    warnings.push(`${papers[index].displayName}: ${message}`);
  });
  if (sources.length === 0 && warnings.length > 0) {
    throw new Error('Không thể tải danh sách bộ đề. Vui lòng thử lại.');
  }
  return { items: mergeExamPaperLists(sources), warnings };
}
