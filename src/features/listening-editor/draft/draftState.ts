import type { ListeningSetContent, ListeningVisibility } from '../../listening/types';

export interface ListeningDraftDocument<TContent = ListeningSetContent, TVisibility = ListeningVisibility> {
  content: TContent;
  visibility: TVisibility;
}

export interface ListeningDraftState<TContent = ListeningSetContent, TVisibility = ListeningVisibility> {
  past: ListeningDraftDocument<TContent, TVisibility>[];
  present: ListeningDraftDocument<TContent, TVisibility>;
  future: ListeningDraftDocument<TContent, TVisibility>[];
  savedDocumentJson: string;
  revision: number;
}

export type ListeningDraftAction<TContent = ListeningSetContent, TVisibility = ListeningVisibility> =
  | { type: 'change'; update: ListeningDraftDocument<TContent, TVisibility> | ((current: ListeningDraftDocument<TContent, TVisibility>) => ListeningDraftDocument<TContent, TVisibility>) }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'reset'; document: ListeningDraftDocument<TContent, TVisibility>; revision: number }
  | { type: 'mark-saved'; document: ListeningDraftDocument<TContent, TVisibility>; revision: number };

const HISTORY_LIMIT = 60;

export const serializeListeningDraft = <TContent, TVisibility>(document: ListeningDraftDocument<TContent, TVisibility>) => JSON.stringify(document);

export function createListeningDraftState<TContent, TVisibility>(
  document: ListeningDraftDocument<TContent, TVisibility>,
  revision = 0
): ListeningDraftState<TContent, TVisibility> {
  return {
    past: [],
    present: document,
    future: [],
    savedDocumentJson: serializeListeningDraft(document),
    revision,
  };
}

export function listeningDraftReducer<TContent, TVisibility>(
  state: ListeningDraftState<TContent, TVisibility>,
  action: ListeningDraftAction<TContent, TVisibility>
): ListeningDraftState<TContent, TVisibility> {
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
