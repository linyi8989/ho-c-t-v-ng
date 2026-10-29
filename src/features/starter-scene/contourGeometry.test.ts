import assert from 'node:assert/strict';
import test from 'node:test';
import { contourPosition } from './contourGeometry';

// Measured with the complete photo titles at 1950×1080: the first row alternated
// between 60px and 72.59375px, with widths around 481px and 502px. The title wraps
// between those widths. This discrete wrap models the browser feedback rather
// than assuming that row height varies smoothly with width.
const compactHeight = 60;
const wrappedHeight = 72.59375;
const listWidth = 728.64;
const span = 350;

function rightLawnWidth(position: number) {
  const upper = position < .52;
  const curve = ((position - .52) / (upper ? .52 : .48)) ** 2;
  return listWidth * (1 - curve * (upper ? .28 + .24 : .20 + .16));
}

function wrappingHeights(pinnedTo: 'top' | 'bottom', edge?: 'top' | 'bottom') {
  const heights = [compactHeight];
  const wrapThreshold = pinnedTo === 'top' ? 490 : 570;
  for (let pass = 0; pass < 8; pass++) {
    const height = heights.at(-1)!;
    // At the start the row's top stays 5px from the list; at the end the final
    // row's bottom stays 345px from it after the existing end-scroll pin.
    const top = pinnedTo === 'top' ? 5 : 345 - height;
    const position = contourPosition({ top, bottom: top + height, height }, 0, span, edge);
    heights.push(rightLawnWidth(position) < wrapThreshold ? wrappedHeight : compactHeight);
  }
  return heights;
}

test('top anchoring stops the observed title-wrap cycle at the start of the Flyers lawn', () => {
  assert.deepEqual(wrappingHeights('top'), [
    compactHeight, wrappedHeight, compactHeight, wrappedHeight, compactHeight,
    wrappedHeight, compactHeight, wrappedHeight, compactHeight,
  ]);
  assert.deepEqual(wrappingHeights('top', 'top'), [compactHeight, ...Array(8).fill(wrappedHeight)]);
});

test('bottom anchoring stops the same feedback when the final row is pinned to the list end', () => {
  assert.deepEqual(wrappingHeights('bottom'), [
    compactHeight, wrappedHeight, compactHeight, wrappedHeight, compactHeight,
    wrappedHeight, compactHeight, wrappedHeight, compactHeight,
  ]);
  assert.deepEqual(wrappingHeights('bottom', 'bottom'), [compactHeight, ...Array(8).fill(wrappedHeight)]);
});

test('edge anchors stay fixed as titles grow without imposing a row height', () => {
  for (const height of [60, wrappedHeight, 120, 280]) {
    assert.equal(contourPosition({ top: 105, bottom: 105 + height, height }, 100, span, 'top'), 35 / span);
    assert.equal(contourPosition({ top: 445 - height, bottom: 445, height }, 100, span, 'bottom'), 315 / span);
  }
});

test('the default preserves the existing center geometry for other yards', () => {
  for (const height of [60, wrappedHeight, 120]) {
    const row = { top: 105, bottom: 105 + height, height };
    assert.equal(contourPosition(row, 100, span), (5 + height / 2) / span);
  }
  const row = { top: 105, bottom: 165, height: 60 };
  assert.equal(contourPosition(row, 100, span, 'top'), contourPosition(row, 100, span));
  assert.equal(contourPosition(row, 100, span, 'bottom'), contourPosition(row, 100, span));
});

test('all anchor modes clamp off-screen rows to the lawn bounds', () => {
  for (const edge of [undefined, 'top', 'bottom'] as const) {
    assert.equal(contourPosition({ top: -140, bottom: -20, height: 120 }, 0, span, edge), 0);
    assert.equal(contourPosition({ top: 400, bottom: 520, height: 120 }, 0, span, edge), 1);
  }
});
