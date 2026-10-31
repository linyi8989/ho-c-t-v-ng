import { createContext, memo, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  addReadingHighlights,
  readingHighlightPopupPosition,
  readingHighlightSegments,
  type ReadingHighlightState,
  type ReadingTextSelection,
} from './readingHighlightModel';
import { collectReadingSelection, isReadingHighlightControl } from './readingHighlightSelection';
import './reading-highlight.css';

const ReadingHighlightContext = createContext<ReadingHighlightState | null>(null);

interface SelectedReadingText {
  selections: ReadingTextSelection[];
  position: { left: number; top: number };
}

/** Mount once for the current active attempt; no annotations are persisted anywhere. */
export function ReadingHighlightSession({ children, enabled = true }: { children: ReactNode; enabled?: boolean; key?: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [highlights, setHighlights] = useState<ReadingHighlightState>(() => new Map());
  const [selected, setSelected] = useState<SelectedReadingText | null>(null);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  useEffect(() => {
    if (!enabled) {
      setHighlights(new Map());
      setSelected(null);
      return;
    }
    const root = rootRef.current;
    if (!root) return;
    const doc = root.ownerDocument;
    const view = doc.defaultView;
    if (!view) return;
    let selecting = false;
    let allowCapture = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const clearPending = () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
    };
    const dismiss = () => {
      clearPending();
      setSelected(null);
    };
    const capture = () => {
      clearPending();
      if (selecting || !allowCapture || popupRef.current?.contains(doc.activeElement)) return;
      const selection = view.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount !== 1) return setSelected(null);
      const range = selection.getRangeAt(0);
      const selections = collectReadingSelection(root, range);
      if (!selections.length) return setSelected(null);
      const rect = [...range.getClientRects()].find(candidate => candidate.width > 0 && candidate.height > 0
        && candidate.bottom > 0 && candidate.top < view.innerHeight);
      if (!rect) return setSelected(null);
      setSelected({ selections, position: readingHighlightPopupPosition(rect, { width: view.innerWidth, height: view.innerHeight }) });
    };
    const schedule = () => {
      clearPending();
      if (!selecting && allowCapture) timer = setTimeout(capture, 70);
    };
    const pointerDown = (event: PointerEvent) => {
      const node = event.target as Node | null;
      if (node && popupRef.current?.contains(node)) return;
      const element = node?.nodeType === 1 ? node as Element : node?.parentElement;
      // A drag may start in a paragraph's margin and still select source text.
      // The completed Range, rather than its first pointer pixel, defines what is eligible.
      allowCapture = Boolean(element && root.contains(element) && !isReadingHighlightControl(element));
      selecting = allowCapture;
      dismiss();
    };
    const pointerEnd = () => { selecting = false; schedule(); };
    const keyUp = (event: KeyboardEvent) => {
      if (event.key === 'Escape') return;
      if (isReadingHighlightControl(doc.activeElement) && !popupRef.current?.contains(doc.activeElement)) return dismiss();
      allowCapture = true;
      schedule();
    };
    const keyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { allowCapture = false; dismiss(); }
    };
    const focusIn = (event: FocusEvent) => {
      if (popupRef.current?.contains(event.target as Node)) return;
      if (isReadingHighlightControl(event.target as Node)) { allowCapture = false; dismiss(); }
    };

    doc.addEventListener('selectionchange', schedule);
    doc.addEventListener('pointerdown', pointerDown, true);
    doc.addEventListener('pointerup', pointerEnd, true);
    doc.addEventListener('pointercancel', pointerEnd, true);
    doc.addEventListener('keyup', keyUp);
    doc.addEventListener('keydown', keyDown);
    doc.addEventListener('focusin', focusIn);
    doc.addEventListener('scroll', dismiss, true);
    view.addEventListener('resize', dismiss);
    return () => {
      clearPending();
      doc.removeEventListener('selectionchange', schedule);
      doc.removeEventListener('pointerdown', pointerDown, true);
      doc.removeEventListener('pointerup', pointerEnd, true);
      doc.removeEventListener('pointercancel', pointerEnd, true);
      doc.removeEventListener('keyup', keyUp);
      doc.removeEventListener('keydown', keyDown);
      doc.removeEventListener('focusin', focusIn);
      doc.removeEventListener('scroll', dismiss, true);
      view.removeEventListener('resize', dismiss);
    };
  }, [enabled]);

  const context = useMemo(() => enabled ? highlights : null, [enabled, highlights]);
  const apply = () => {
    const current = selectedRef.current;
    if (!current) return;
    setHighlights(previous => addReadingHighlights(previous, current.selections));
    setSelected(null);
    rootRef.current?.ownerDocument.defaultView?.getSelection()?.removeAllRanges();
  };

  if (!enabled) return <>{children}</>;

  return <ReadingHighlightContext.Provider value={context}>
    <div ref={rootRef} className="reading-highlight-session" data-reading-highlight-session={enabled ? 'active' : 'disabled'}>{children}</div>
    {enabled && selected && typeof document !== 'undefined' && createPortal(
      <div ref={popupRef} data-reading-highlight-popup style={{ left: selected.position.left, top: selected.position.top }}>
        <button type="button" className="reading-highlight-action" onPointerDown={event => event.preventDefault()} onClick={apply}>Đánh dấu</button>
      </div>, rootRef.current?.ownerDocument.body || document.body,
    )}
  </ReadingHighlightContext.Provider>;
}

/** Outside an active ReadingHighlightSession this preserves the original plain text. */
export const HighlightableReadingText = memo(function HighlightableReadingText({ text, contentKey }: { text: string; contentKey: string }) {
  const state = useContext(ReadingHighlightContext);
  const record = state?.get(contentKey);
  if (!state) return <>{text}</>;
  const segments = readingHighlightSegments(text, record?.text === text ? record.intervals : []);
  return <span data-reading-highlight-text data-reading-highlight-key={contentKey}>{segments.map(segment => segment.highlighted
    ? <mark key={`${segment.start}-marked`} data-reading-highlight-mark>{segment.text}</mark>
    : <span key={`${segment.start}-plain`}>{segment.text}</span>)}</span>;
});
