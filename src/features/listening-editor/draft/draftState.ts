import type { ListeningSetContent, ListeningVisibility } from '../../listening/types';

export interface ListeningDraftDocument {
  content: ListeningSetContent;
  visibility: ListeningVisibility;
}

export interface ListeningDraftState {
  past: ListeningDraftDocument[];
  present: ListeningDraftDocument;
  future: ListeningDraftDocument[];
  savedDocumentJson: string;
  revision: number;
}

export type ListeningDraftAction =
  | { type: 'change'; update: ListeningDraftDocument | ((current: ListeningDraftDocument) => ListeningDraftDocument) }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'reset'; document: ListeningDraftDocument; revision: number }
  | { type: 'mark-saved'; document: ListeningDraftDocument; revision: number };

const HISTORY_LIMIT = 60;

export const serializeListeningDraft = (document: ListeningDraftDocument) => JSON.stringify(document);

export function createListeningDraftState(
  document: ListeningDraftDocument,
  revision = 0
): ListeningDraftState {
  return {
    past: [],
    present: document,
    future: [],
    savedDocumentJson: serializeListeningDraft(document),
    revision,
  };
}

export function listeningDraftReducer(
  state: ListeningDraftState,
  action: ListeningDraftAction
): ListeningDraftState {
  if (action.type === 'reset') return createListeningDraftState(action.document, action.revision);
  if (action.type === 'mark-saved') {
    return {
      ...state,
      savedDocumentJson: serializeListeningDraft(action.document),
      revision: action.revision,
    };
  }
  if (action.type === 'undo') {
    const previous = state.past.at(-1);
    if (!previous) return state;
    return {
      ...state,
      past: state.past.slice(0, -1),
      present: previous,
      future: [state.present, ...state.future].slice(0, HISTORY_LIMIT),
    };
  }
  if (action.type === 'redo') {
    const next = state.future[0];
    if (!next) return state;
    return {
      ...state,
      past: [...state.past, state.present].slice(-HISTORY_LIMIT),
      present: next,
      future: state.future.slice(1),
    };
  }

  const next = typeof action.update === 'function'
    ? action.update(state.present)
    : action.update;
  if (serializeListeningDraft(next) === serializeListeningDraft(state.present)) return state;
  return {
    ...state,
    past: [...state.past, state.present].slice(-HISTORY_LIMIT),
    present: next,
    future: [],
  };
}
