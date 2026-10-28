import assert from 'node:assert/strict';
import test from 'node:test';
import { drawKetCrop, moveKetCrop, normalizeKetCrop, resizeKetCrop, resizeKetCropByOffset } from './ketListeningCropGeometry';

test('crop drawing works in every direction and stays normalized at page edges', () => {
  assert.deepEqual(drawKetCrop({ x: .7, y: .8 }, { x: .2, y: .3 }), { x: .2, y: .3, width: .5, height: .5 });
  assert.deepEqual(drawKetCrop({ x: .2, y: .3 }, { x: .7, y: .8 }), { x: .2, y: .3, width: .5, height: .5 });
  assert.deepEqual(drawKetCrop({ x: 1, y: 1 }, { x: 1, y: 1 }), { x: .995, y: .995, width: .005, height: .005 });
  assert.deepEqual(drawKetCrop({ x: -.2, y: 1.2 }, { x: .2, y: .8 }), { x: 0, y: .8, width: .2, height: .2 });
  assert.equal(drawKetCrop({ x: Infinity, y: 0 }, { x: .1, y: .1 }), null);
  assert.equal(normalizeKetCrop({ x: NaN, y: 0, width: .1, height: .1 }), null);
});

test('moving a crop preserves size and clamps independently of display zoom', () => {
  const crop = { x: .2, y: .3, width: .4, height: .2 };
  assert.deepEqual(moveKetCrop(crop, { x: 1, y: -.8 }), { x: .6, y: 0, width: .4, height: .2 });
  assert.deepEqual(crop, { x: .2, y: .3, width: .4, height: .2 }, 'Input remains an immutable proposal.');
});

test('resize anchors the opposite corner and prevents inverted or outside rectangles', () => {
  const crop = { x: .2, y: .3, width: .4, height: .2 };
  assert.deepEqual(resizeKetCrop(crop, 'nw', { x: .1, y: .2 }), { x: .1, y: .2, width: .5, height: .3 });
  assert.deepEqual(resizeKetCrop(crop, 'se', { x: 2, y: 2 }), { x: .2, y: .3, width: .8, height: .7 });
  assert.deepEqual(resizeKetCrop(crop, 'ne', { x: .7, y: .2 }), { x: .2, y: .2, width: .5, height: .3 });
  assert.deepEqual(resizeKetCrop(crop, 'sw', { x: .1, y: .7 }), { x: .1, y: .3, width: .5, height: .4 });
  assert.deepEqual(resizeKetCrop(crop, 'nw', { x: .8, y: .8 }), { x: .595, y: .495, width: .005, height: .005 });
  assert.equal(resizeKetCrop(crop, 'nw', { x: NaN, y: .2 }), null);
});

test('grabbing inside a resize handle changes only the distance dragged, without jumping to the pointer', () => {
  const crop = { x: .2, y: .3, width: .4, height: .2 };
  // The pointer may start at the handle centre, inset from the actual crop edge.
  // A stationary pointer must retain the crop; a small drag must remain small.
  for (const corner of ['nw', 'ne', 'sw', 'se'] as const) {
    assert.deepEqual(resizeKetCropByOffset(crop, corner, { x: 0, y: 0 }), crop);
  }
  assert.deepEqual(resizeKetCropByOffset(crop, 'se', { x: -.003, y: -.004 }), { x: .2, y: .3, width: .397, height: .196 });
  assert.deepEqual(resizeKetCropByOffset(crop, 'nw', { x: -.003, y: -.004 }), { x: .197, y: .296, width: .403, height: .204 });
  assert.deepEqual(resizeKetCropByOffset(crop, 'se', { x: -1, y: 2 }), { x: .2, y: .3, width: .005, height: .7 });
});
