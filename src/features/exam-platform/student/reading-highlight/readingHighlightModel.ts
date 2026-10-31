export interface ReadingHighlightInterval {
  start: number;
  end: number;
}

export interface ReadingTextSelection extends ReadingHighlightInterval {
  contentKey: string;
  text: string;
}

export interface ReadingHighlightRecord {
  text: string;
  intervals: ReadingHighlightInterval[];
}

export type ReadingHighlightState = ReadonlyMap<string, ReadingHighlightRecord>;

/** Offsets use the same UTF-16 character units as a browser Selection. */
export function clipReadingInterval(length: number, interval: ReadingHighlightInterval): ReadingHighlightInterval | null {
  if (!Number.isFinite(interval.start) || !Number.isFinite(interval.end) || length <= 0) return null;
  const start = Math.max(0, Math.min(length, Math.floor(interval.start)));
  const end = Math.max(0, Math.min(length, Math.floor(interval.end)));
  return start < end ? { start, end } : null;
}

export function mergeReadingIntervals(length: number, intervals: readonly ReadingHighlightInterval[]): ReadingHighlightInterval[] {
  const sorted = intervals.map(interval => clipReadingInterval(length, interval))
    .filter((interval): interval is ReadingHighlightInterval => interval !== null)
    .sort((left, right) => left.start - right.start || left.end - right.end);
  const merged: ReadingHighlightInterval[] = [];
  for (const interval of sorted) {
    const previous = merged.at(-1);
    if (previous && interval.start <= previous.end) previous.end = Math.max(previous.end, interval.end);
    else merged.push({ ...interval });
  }
  return merged;
}

/** Only explicitly registered source fragments are ever included, never gap labels or inputs. */
export function normalizeReadingSelections(selections: readonly ReadingTextSelection[]): ReadingTextSelection[] {
  const grouped = new Map<string, { text: string; intervals: ReadingHighlightInterval[] }>();
  for (const selection of selections) {
    if (!selection.contentKey) continue;
    const interval = clipReadingInterval(selection.text.length, selection);
    if (!interval || !selection.text.slice(interval.start, interval.end).trim()) continue;
    const previous = grouped.get(selection.contentKey);
    // A key identifies exactly one source. Do not move a mark onto changed text.
    if (previous && previous.text !== selection.text) return [];
    if (previous) previous.intervals.push(interval);
    else grouped.set(selection.contentKey, { text: selection.text, intervals: [interval] });
  }
  return [...grouped].flatMap(([contentKey, record]) => mergeReadingIntervals(record.text.length, record.intervals)
    .map(interval => ({ contentKey, text: record.text, ...interval })));
}

export function addReadingHighlights(state: ReadingHighlightState, selections: readonly ReadingTextSelection[]): ReadingHighlightState {
  const valid = normalizeReadingSelections(selections);
  if (!valid.length) return state;
  const next = new Map(state);
  for (const selection of valid) {
    const previous = next.get(selection.contentKey);
    next.set(selection.contentKey, {
      text: selection.text,
      intervals: mergeReadingIntervals(selection.text.length, [
        ...(previous?.text === selection.text ? previous.intervals : []),
        selection,
      ]),
    });
  }
  return next;
}

export function readingHighlightSegments(text: string, intervals: readonly ReadingHighlightInterval[]) {
  const segments: Array<{ start: number; text: string; highlighted: boolean }> = [];
  let position = 0;
  for (const interval of mergeReadingIntervals(text.length, intervals)) {
    if (position < interval.start) segments.push({ start: position, text: text.slice(position, interval.start), highlighted: false });
    segments.push({ start: interval.start, text: text.slice(interval.start, interval.end), highlighted: true });
    position = interval.end;
  }
  if (position < text.length) segments.push({ start: position, text: text.slice(position), highlighted: false });
  return segments;
}

export function readingHighlightPopupPosition(rect: { left: number; top: number; bottom: number; width: number }, viewport: { width: number; height: number }) {
  const margin = 8;
  const width = 112;
  const height = 42;
  const left = Math.max(margin, Math.min(viewport.width - width - margin, rect.left + Math.min(rect.width, 180) / 2 - width / 2));
  const preferredTop = rect.top >= height + margin * 2 ? rect.top - height - margin : rect.bottom + margin;
  const top = Math.max(margin, Math.min(viewport.height - height - margin, preferredTop));
  return { left, top };
}
