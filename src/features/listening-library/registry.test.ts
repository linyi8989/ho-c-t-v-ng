import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_LISTENING_MODULE_ID,
  LISTENING_MODULES,
  getListeningModule,
  getListeningPaper,
  resolveListeningModuleId,
} from './registry';
import {
  examLibraryPath,
  examModulePath,
  examPaperExamPath,
  examPaperPath,
  listeningExamPath,
  parseListeningLibraryRoute,
  writingExamPath,
} from './routes';

test('registry exposes seven exam-directory modules plus the hidden standalone Writing module', () => {
  assert.deepEqual(LISTENING_MODULES.map(module => module.id), [
    'writing', 'starter', 'mover', 'flyer', 'ket', 'pet', 'fce', 'ielts',
  ]);
  assert.deepEqual(
    LISTENING_MODULES.filter(module => module.status === 'active').map(module => module.id),
    ['starter', 'mover', 'flyer', 'ket', 'pet', 'fce', 'ielts']
  );
  assert.deepEqual(
    LISTENING_MODULES.filter(module => module.status !== 'hidden').slice(0, 3).map(module => module.displayName),
    ['Starters', 'Movers', 'Flyers'],
  );
  const mover = getListeningModule('mover');
  assert.equal(mover?.partCount, 5);
  assert.equal(mover?.questionsPerPart, 5);
  assert.equal(mover?.parts.length, 5);
  assert.equal(mover?.capabilities.scoring, true);
  assert.deepEqual(mover?.papers.map(paper => paper.id), ['listening', 'reading-writing']);
  assert.equal(getListeningPaper('mover', 'listening')?.partCount, 5);
  assert.equal(getListeningPaper('mover', 'reading-writing')?.partCount, 6);
  assert.deepEqual(getListeningPaper('mover', 'reading-writing')?.questionsPerPart, [6, 6, 6, 7, 10, 5]);
  assert.equal(getListeningModule('writing')?.status, 'hidden');
  assert.deepEqual(getListeningModule('writing')?.papers.map(paper => paper.id), ['writing']);
  for (const module of LISTENING_MODULES.filter(item => item.id !== 'mover' && item.id !== 'writing')) {
    assert.equal(module.status, 'active');
    assert.equal(module.parts.length, 0);
    assert.equal(module.capabilities.scoring, true);
    assert.ok(module.papers.length >= 2);
    assert.ok(module.papers.every(paper => paper.status === 'active' && paper.totalQuestionCount));
  }
  assert.deepEqual(getListeningModule('ielts')?.papers.map(paper => paper.id), [
    'listening', 'academic-reading', 'academic-writing',
  ]);
  assert.equal(getListeningPaper('starter', 'reading-writing')?.totalQuestionCount, 25);
  assert.equal(getListeningPaper('fce', 'reading-use-of-english')?.totalQuestionCount, 52);
  assert.equal(getListeningPaper('ielts', 'academic-reading')?.totalQuestionCount, 40);
});

test('missing legacy module metadata resolves to Mover without rewriting identifiers', () => {
  assert.equal(DEFAULT_LISTENING_MODULE_ID, 'mover');
  assert.equal(resolveListeningModuleId(undefined), 'mover');
  assert.equal(resolveListeningModuleId('unknown'), 'mover');
  assert.equal(resolveListeningModuleId('ket'), 'ket');
  assert.equal(resolveListeningModuleId('pet'), 'pet');
  assert.equal(resolveListeningModuleId('fce'), 'fce');
  assert.equal(resolveListeningModuleId('ielts'), 'ielts');
});

test('route parser emits short exam URLs and preserves every legacy Mover URL', () => {
  assert.equal(examLibraryPath(), '/exams');
  assert.equal(examModulePath('mover'), '/exams/mover');
  assert.equal(examPaperPath('mover', 'reading-writing'), '/exams/mover/reading-writing');
  assert.deepEqual(parseListeningLibraryRoute('/exams'), { kind: 'library' });
  assert.deepEqual(parseListeningLibraryRoute('/exams/mover'), { kind: 'module', moduleId: 'mover' });
  assert.deepEqual(parseListeningLibraryRoute('/listening'), { kind: 'library' });
  assert.deepEqual(parseListeningLibraryRoute('/listening/modules/mover'), {
    kind: 'module',
    moduleId: 'mover',
  });
  assert.deepEqual(
    parseListeningLibraryRoute('/listening/legacy-set', '?accessToken=old-token'),
    {
      kind: 'exam',
      moduleId: 'mover',
      examId: 'legacy-set',
      accessToken: 'old-token',
      legacy: true,
    }
  );
  const canonical = listeningExamPath('mover', 'legacy-set', 'old-token');
  assert.deepEqual(parseListeningLibraryRoute(...canonical.split('?') as [string, string]), {
    kind: 'paper-exam',
    moduleId: 'mover',
    paperId: 'listening',
    examId: 'legacy-set',
    accessToken: 'old-token',
  });
  assert.deepEqual(parseListeningLibraryRoute(examPaperPath('mover', 'reading-writing')), {
    kind: 'paper',
    moduleId: 'mover',
    paperId: 'reading-writing',
  });
  const readingExam = examPaperExamPath('mover', 'reading-writing', 'reading-set', 'private-token');
  assert.deepEqual(parseListeningLibraryRoute(...readingExam.split('?') as [string, string]), {
    kind: 'paper-exam',
    moduleId: 'mover',
    paperId: 'reading-writing',
    examId: 'reading-set',
    accessToken: 'private-token',
  });
  assert.deepEqual(parseListeningLibraryRoute(
    '/listening/modules/mover/papers/reading-writing/exams/old-reading',
    '?shareToken=old-share',
  ), {
    kind: 'paper-exam',
    moduleId: 'mover',
    paperId: 'reading-writing',
    examId: 'old-reading',
    accessToken: 'old-share',
  });
  assert.deepEqual(parseListeningLibraryRoute('/listening/modules/mover/exams/old-listening'), {
    kind: 'exam',
    moduleId: 'mover',
    examId: 'old-listening',
    accessToken: '',
    legacy: false,
  });
  assert.equal(parseListeningLibraryRoute('/exams/unknown/listening/nope'), null);
  const writing = writingExamPath('writing-set', 'writing-token');
  assert.equal(writing, '/writing/writing-set?accessToken=writing-token');
  assert.deepEqual(parseListeningLibraryRoute(...writing.split('?') as [string, string]), {
    kind: 'paper-exam',
    moduleId: 'writing',
    paperId: 'writing',
    examId: 'writing-set',
    accessToken: 'writing-token',
  });
  const privateWriting = writingExamPath('examset-private', 'token-with-trailing-');
  assert.deepEqual(parseListeningLibraryRoute(...privateWriting.split('?') as [string, string]), {
    kind: 'paper-exam',
    moduleId: 'writing',
    paperId: 'writing',
    examId: 'examset-private',
    accessToken: 'token-with-trailing-',
  });
});
