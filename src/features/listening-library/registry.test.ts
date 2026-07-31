import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_LISTENING_MODULE_ID,
  LISTENING_MODULES,
  getListeningModule,
  resolveListeningModuleId,
} from './registry';
import {
  listeningExamPath,
  parseListeningLibraryRoute,
} from './routes';

test('registry exposes exactly four modules and only Mover is active', () => {
  assert.deepEqual(LISTENING_MODULES.map(module => module.id), ['starter', 'mover', 'flyer', 'ket']);
  assert.deepEqual(
    LISTENING_MODULES.filter(module => module.status === 'active').map(module => module.id),
    ['mover']
  );
  const mover = getListeningModule('mover');
  assert.equal(mover?.partCount, 5);
  assert.equal(mover?.questionsPerPart, 5);
  assert.equal(mover?.parts.length, 5);
  assert.equal(mover?.capabilities.scoring, true);
  for (const module of LISTENING_MODULES.filter(item => item.id !== 'mover')) {
    assert.equal(module.status, 'coming_soon');
    assert.equal(module.parts.length, 0);
    assert.equal(module.capabilities.scoring, false);
  }
});

test('missing legacy module metadata resolves to Mover without rewriting identifiers', () => {
  assert.equal(DEFAULT_LISTENING_MODULE_ID, 'mover');
  assert.equal(resolveListeningModuleId(undefined), 'mover');
  assert.equal(resolveListeningModuleId('unknown'), 'mover');
  assert.equal(resolveListeningModuleId('ket'), 'ket');
});

test('route parser preserves legacy Mover URLs and supports canonical module URLs', () => {
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
    kind: 'exam',
    moduleId: 'mover',
    examId: 'legacy-set',
    accessToken: 'old-token',
    legacy: false,
  });
});

