import { useCallback, useMemo, useReducer } from 'react';
import type { SetStateAction } from 'react';
import type { ListeningSetContent, ListeningVisibility } from '../../listening/types';
import {
  createListeningDraftState,
  listeningDraftReducer,
  serializeListeningDraft,
  type ListeningDraftDocument,
} from './draftState';

export function useListeningDraft(initialDocument: ListeningDraftDocument) {
  const [state, dispatch] = useReducer(
    listeningDraftReducer,
    initialDocument,
    document => createListeningDraftState(document)
  );

  const setDocument = useCallback((update: SetStateAction<ListeningDraftDocument>) => {
    dispatch({ type: 'change', update });
  }, []);
  const setContent = useCallback((update: SetStateAction<ListeningSetContent>) => {
    setDocument(document => ({
      ...document,
      content: typeof update === 'function' ? update(document.content) : update,
    }));
  }, [setDocument]);
  const setVisibility = useCallback((update: SetStateAction<ListeningVisibility>) => {
    setDocument(document => ({
      ...document,
      visibility: typeof update === 'function' ? update(document.visibility) : update,
    }));
  }, [setDocument]);
  const reset = useCallback((document: ListeningDraftDocument, revision = 0) => {
    dispatch({ type: 'reset', document, revision });
  }, []);
  const markSaved = useCallback((document: ListeningDraftDocument, revision: number) => {
    dispatch({ type: 'mark-saved', document, revision });
  }, []);

  return useMemo(() => ({
    document: state.present,
    content: state.present.content,
    visibility: state.present.visibility,
    revision: state.revision,
    dirty: serializeListeningDraft(state.present) !== state.savedDocumentJson,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    setDocument,
    setContent,
    setVisibility,
    reset,
    markSaved,
    undo: () => dispatch({ type: 'undo' }),
    redo: () => dispatch({ type: 'redo' }),
  }), [state, setDocument, setContent, setVisibility, reset, markSaved]);
}
