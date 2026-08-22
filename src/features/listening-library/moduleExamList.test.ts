import assert from 'node:assert/strict';
import test from 'node:test';
import { getListeningPaper } from './registry';
import { mergeExamPaperLists } from './moduleExamList';
import type { ListeningLibraryExamSummary } from './types';

function exam(overrides: Partial<ListeningLibraryExamSummary>): ListeningLibraryExamSummary {
  return {
    moduleId: 'mover',
    examId: 'exam-1',
    schemaVersion: 1,
    title: 'Exam',
    description: '',
    gradeLevel: 'Movers',
    visibility: 'public',
    status: 'published',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  };
}

test('combined module list labels papers, keeps cross-paper IDs and sorts newest first', () => {
  const listening = getListeningPaper('mover', 'listening');
  const readingWriting = getListeningPaper('mover', 'reading-writing');
  assert.ok(listening);
  assert.ok(readingWriting);
  const items = mergeExamPaperLists([
    {
      paper: listening,
      exams: [
        exam({ examId: 'same-id', title: 'Older listening' }),
        exam({ examId: 'private', visibility: 'assignment' }),
      ],
    },
    {
      paper: readingWriting,
      exams: [exam({ examId: 'same-id', title: 'Newer reading', updatedAt: '2026-08-02T00:00:00.000Z' })],
    },
  ]);
  assert.deepEqual(items.map(item => `${item.paperId}:${item.examId}`), [
    'reading-writing:same-id',
    'listening:same-id',
  ]);
  assert.deepEqual(items.map(item => item.paperDisplayName), ['Reading & Writing', 'Listening']);
  assert.deepEqual(items.map(item => item.questionCount), [40, 25]);
});

test('combined module list removes only duplicate rows inside the same paper', () => {
  const listening = getListeningPaper('mover', 'listening');
  assert.ok(listening);
  const items = mergeExamPaperLists([{
    paper: listening,
    exams: [
      exam({ examId: 'duplicate', title: 'Old', updatedAt: '2026-08-01T00:00:00.000Z' }),
      exam({ examId: 'duplicate', title: 'New', updatedAt: '2026-08-03T00:00:00.000Z' }),
      exam({ examId: 'draft', status: 'draft' }),
    ],
  }]);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'New');
});
