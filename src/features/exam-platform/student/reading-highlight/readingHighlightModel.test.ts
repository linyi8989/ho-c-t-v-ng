import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addReadingHighlights,
  clipReadingInterval,
  mergeReadingIntervals,
  normalizeReadingSelections,
  readingHighlightPopupPosition,
  readingHighlightSegments,
} from './readingHighlightModel';

test('highlight selections keep exact repeated-phrase positions and original Unicode/newlines', () => {
  const text = 'Read this.\nRead this. 👋';
  const original = new Map();
  const next = addReadingHighlights(original, [{ contentKey: 'part:passage', text, start: 11, end: 20 }]);
  assert.equal(original.size, 0);
  assert.deepEqual(next.get('part:passage')?.intervals, [{ start: 11, end: 20 }]);
  const segments = readingHighlightSegments(text, next.get('part:passage')!.intervals);
  assert.equal(segments.map(segment => segment.text).join(''), text);
  assert.equal(segments.filter(segment => segment.highlighted).map(segment => segment.text).join(''), 'Read this');
});

test('overlapping, adjacent and repeated marks merge without altering untouched source', () => {
  const text = '0123456789';
  let state = addReadingHighlights(new Map(), [{ contentKey: 'one', text, start: 2, end: 5 }]);
  state = addReadingHighlights(state, [
    { contentKey: 'one', text, start: 4, end: 7 },
    { contentKey: 'one', text, start: 7, end: 9 },
    { contentKey: 'one', text, start: 2, end: 5 },
  ]);
  assert.deepEqual(state.get('one')?.intervals, [{ start: 2, end: 9 }]);
  assert.deepEqual(readingHighlightSegments(text, state.get('one')!.intervals), [
    { start: 0, text: '01', highlighted: false },
    { start: 2, text: '2345678', highlighted: true },
    { start: 9, text: '9', highlighted: false },
  ]);
});

test('selection across gap fragments stores only registered source characters and independent keys', () => {
  const selected = normalizeReadingSelections([
    { contentKey: 'before-gap-9', text: 'The traveller ', start: 4, end: 100 },
    { contentKey: 'after-gap-9', text: ' had arrived.\nAnother paragraph.', start: 0, end: 13 },
    { contentKey: 'blank-space', text: ' \n ', start: 0, end: 3 },
  ]);
  assert.deepEqual(selected, [
    { contentKey: 'before-gap-9', text: 'The traveller ', start: 4, end: 14 },
    { contentKey: 'after-gap-9', text: ' had arrived.\nAnother paragraph.', start: 0, end: 13 },
  ]);
  const state = addReadingHighlights(new Map(), selected);
  assert.equal(state.size, 2);
  assert.equal(state.has('gap-9-input'), false);
  assert.equal(state.has('blank-space'), false);
});

test('changed text does not reuse old offsets and distinct fields with identical text stay separate', () => {
  const old = addReadingHighlights(new Map(), [{ contentKey: 'A', text: 'same text', start: 0, end: 4 }]);
  const updated = addReadingHighlights(old, [
    { contentKey: 'A', text: 'updated source', start: 8, end: 14 },
    { contentKey: 'B', text: 'same text', start: 5, end: 9 },
  ]);
  assert.deepEqual(updated.get('A'), { text: 'updated source', intervals: [{ start: 8, end: 14 }] });
  assert.deepEqual(updated.get('B'), { text: 'same text', intervals: [{ start: 5, end: 9 }] });
  assert.deepEqual(old.get('A'), { text: 'same text', intervals: [{ start: 0, end: 4 }] });
});

test('invalid ranges and conflicting source identities cannot create annotations', () => {
  assert.equal(clipReadingInterval(10, { start: NaN, end: 4 }), null);
  assert.equal(clipReadingInterval(10, { start: 7, end: 2 }), null);
  assert.equal(clipReadingInterval(0, { start: 0, end: 1 }), null);
  assert.deepEqual(mergeReadingIntervals(10, [{ start: -3, end: 4 }, { start: 2, end: 90 }]), [{ start: 0, end: 10 }]);
  assert.deepEqual(normalizeReadingSelections([
    { contentKey: 'conflicting', text: 'first', start: 0, end: 2 },
    { contentKey: 'conflicting', text: 'second', start: 0, end: 2 },
  ]), []);
  const original = new Map();
  assert.equal(addReadingHighlights(original, [{ contentKey: '', text: 'first', start: 0, end: 2 }]), original);
});

test('popup stays in desktop/mobile viewport and chooses below near the top edge', () => {
  assert.deepEqual(readingHighlightPopupPosition({ left: 0, top: 2, bottom: 22, width: 10 }, { width: 320, height: 640 }), { left: 8, top: 30 });
  assert.deepEqual(readingHighlightPopupPosition({ left: 300, top: 620, bottom: 640, width: 20 }, { width: 320, height: 640 }), { left: 200, top: 570 });
  const desktop = readingHighlightPopupPosition({ left: 700, top: 400, bottom: 430, width: 250 }, { width: 1366, height: 768 });
  assert.deepEqual(desktop, { left: 734, top: 350 });
});
