import { normalizeReadingSelections, type ReadingTextSelection } from './readingHighlightModel';

export const READING_TEXT_SELECTOR = '[data-reading-highlight-text]';
export const READING_HIGHLIGHT_EXCLUDED = 'input,textarea,select,button,[contenteditable=""],[contenteditable="true"],[data-reading-highlight-ignore]';

function elementFor(node: Node | null): Element | null {
  return node?.nodeType === 1 ? node as Element : node?.parentElement || null;
}

export function isReadingHighlightControl(node: Node | null) {
  return Boolean(elementFor(node)?.closest(READING_HIGHLIGHT_EXCLUDED));
}

function offsetInside(element: HTMLElement, container: Node, offset: number) {
  const prefix = element.ownerDocument.createRange();
  prefix.selectNodeContents(element);
  prefix.setEnd(container, offset);
  return prefix.toString().length;
}

/** Reads plain-text offsets from controlled source spans without modifying the DOM. */
export function collectReadingSelection(root: HTMLElement, range: Range): ReadingTextSelection[] {
  if (range.collapsed || !root.contains(range.startContainer) || !root.contains(range.endContainer)
    || isReadingHighlightControl(range.startContainer) || isReadingHighlightControl(range.endContainer)) return [];
  const selections: ReadingTextSelection[] = [];
  for (const element of root.querySelectorAll<HTMLElement>(READING_TEXT_SELECTOR)) {
    if (isReadingHighlightControl(element) || !range.intersectsNode(element)) continue;
    const text = element.textContent || '';
    selections.push({
      contentKey: element.dataset.readingHighlightKey || '',
      text,
      start: element.contains(range.startContainer) ? offsetInside(element, range.startContainer, range.startOffset) : 0,
      end: element.contains(range.endContainer) ? offsetInside(element, range.endContainer, range.endOffset) : text.length,
    });
  }
  return normalizeReadingSelections(selections);
}
