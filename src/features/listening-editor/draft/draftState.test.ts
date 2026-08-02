import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultMoverListeningContent } from '../../listening-library/modules/mover/editor/moduleDefinition';
import {
  createListeningDraftState,
  listeningDraftReducer,
  serializeListeningDraft,
} from './draftState';

const document = () => ({
  content: createDefaultMoverListeningContent(),
  visibility: 'draft' as const,
});

test('draft history supports change, undo and redo without losing the saved baseline', () => {
  const initial = createListeningDraftState(document(), 4);
  const changed = listeningDraftReducer(initial, {
    type: 'change',
    update: current => ({ ...current, content: { ...current.content, title: 'Changed' } }),
  });
  assert.equal(changed.present.content.title, 'Changed');
  assert.notEqual(serializeListeningDraft(changed.present), changed.savedDocumentJson);

  const undone = listeningDraftReducer(changed, { type: 'undo' });
  assert.equal(undone.present.content.title, initial.present.content.title);
  const redone = listeningDraftReducer(undone, { type: 'redo' });
  assert.equal(redone.present.content.title, 'Changed');
});

test('mark-saved advances revision for the sent snapshot while preserving newer edits', () => {
  const initialDocument = document();
  const initial = createListeningDraftState(initialDocument, 1);
  const sent = { ...initialDocument, content: { ...initialDocument.content, title: 'Sent' } };
  const newer = { ...sent, content: { ...sent.content, title: 'Newer' } };
  const edited = listeningDraftReducer(
    listeningDraftReducer(initial, { type: 'change', update: sent }),
    { type: 'change', update: newer }
  );
  const saved = listeningDraftReducer(edited, { type: 'mark-saved', document: sent, revision: 2 });
  assert.equal(saved.revision, 2);
  assert.equal(saved.present.content.title, 'Newer');
  assert.notEqual(serializeListeningDraft(saved.present), saved.savedDocumentJson);
});
