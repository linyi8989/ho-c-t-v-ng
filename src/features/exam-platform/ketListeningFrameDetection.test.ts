import assert from 'node:assert/strict';
import test from 'node:test';
import { detectPart4FramesFromPixels, type PixelSource } from '../listening-editor/smart-import/part4FrameDetection';
import { deduplicateKetListeningFrames, detectKetListeningFramesFromPixels } from './ketListeningFrameDetection';

function white(width = 720, height = 480): PixelSource & { data: Uint8ClampedArray } {
  const data = new Uint8ClampedArray(width * height * 4); data.fill(255);
  return { width, height, data };
}
function paint(source: ReturnType<typeof white>, x: number, y: number, grey = 20) {
  const index = (y * source.width + x) * 4;
  source.data[index] = grey; source.data[index + 1] = grey; source.data[index + 2] = grey;
}
function frame(source: ReturnType<typeof white>, x: number, y: number, width: number, height: number, grey = 20, damaged = false) {
  for (let offset = 0; offset < width; offset++) {
    if (damaged && (offset < 2 || offset > width - 3 || offset % 31 < 3)) continue;
    paint(source, x + offset, y, grey); paint(source, x + offset, y + height - 1, grey);
  }
  for (let offset = 0; offset < height; offset++) {
    if (damaged && (offset < 2 || offset > height - 3 || offset % 31 < 3)) continue;
    paint(source, x, y + offset, grey); paint(source, x + width - 1, y + offset, grey);
  }
}
function hasFrame(source: PixelSource, frames: ReturnType<typeof detectKetListeningFramesFromPixels>, x: number, y: number, width: number, height: number) {
  return frames.some(({ crop }) => Math.abs(crop.x * source.width - x) <= 5 && Math.abs(crop.y * source.height - y) <= 5 && Math.abs(crop.width * source.width - width) <= 8 && Math.abs(crop.height * source.height - height) <= 8);
}

test('KET detects disconnected grey option borders which the component detector misses', () => {
  const source = white();
  for (const x of [35, 265, 495]) frame(source, x, 100, 160, 135, 220, true);
  assert.equal(detectPart4FramesFromPixels(source, { allowWideFrames: true }).length, 0);
  const detected = detectKetListeningFramesFromPixels(source);
  for (const x of [35, 265, 495]) assert(hasFrame(source, detected, x, 100, 160, 135));
  assert(detected.every(({ crop, score }) => crop.x >= 0 && crop.y >= 0 && crop.x + crop.width <= 1 && crop.y + crop.height <= 1 && score >= .69));
});

test('KET retains a wide shared image and separate option frames at any vertical position', () => {
  const source = white(1000, 850);
  frame(source, 45, 45, 400, 130, 215, true);
  for (const [x, y] of [[540, 80], [680, 80], [820, 80], [40, 480], [180, 480], [320, 480]]) frame(source, x, y, 110, 100, 205, true);
  const detected = detectKetListeningFramesFromPixels(source);
  assert(hasFrame(source, detected, 45, 45, 400, 130));
  for (const [x, y] of [[540, 80], [680, 80], [820, 80], [40, 480], [180, 480], [320, 480]]) assert(hasFrame(source, detected, x, y, 110, 100));
});

test('KET does not join adjacent aligned options into invented A+B or A+B+C frames', () => {
  const source = white();
  for (const x of [40, 220, 400]) frame(source, x, 90, 170, 120, 220, true);
  const detected = detectKetListeningFramesFromPixels(source);
  assert.equal(detected.length, 3);
  for (const x of [40, 220, 400]) assert(hasFrame(source, detected, x, 90, 170, 120));
});

test('KET keeps an example container and inner illustration rectangles for the layout planner', () => {
  const source = white();
  frame(source, 35, 55, 640, 170);
  for (const x of [65, 280, 495]) frame(source, x, 90, 140, 100, 225, true);
  const detected = detectKetListeningFramesFromPixels(source);
  assert(hasFrame(source, detected, 35, 55, 640, 170));
  for (const x of [65, 280, 495]) assert(hasFrame(source, detected, x, 90, 140, 100));
});

test('KET deduplicates repeated nearby borders without deleting a smaller nested picture', () => {
  const outer = { crop: { x: .1, y: .2, width: .4, height: .3 }, score: .98 };
  const near = { crop: { x: .102, y: .201, width: .396, height: .298 }, score: .95 };
  const inner = { crop: { x: .2, y: .25, width: .15, height: .1 }, score: .9 };
  const before = JSON.stringify([near, inner, outer]);
  const result = deduplicateKetListeningFrames([near, inner, outer]);
  assert.deepEqual(result, [outer, inner]);
  assert.equal(JSON.stringify([near, inner, outer]), before);
  assert.notEqual(result[0].crop, outer.crop, 'Result cannot mutate caller-owned coordinates.');
});

test('KET map hatching does not hide the outer common-image boundary', () => {
  const source = white();
  frame(source, 190, 180, 220, 170, 220, true);
  for (let y = 195; y < 335; y++) for (let x = 205; x < 390; x++) if ((x + y) % 9 === 0) paint(source, x, y, 160);
  frame(source, 235, 220, 95, 65);
  const detected = detectKetListeningFramesFromPixels(source);
  assert(hasFrame(source, detected, 190, 180, 220, 170));
  assert(hasFrame(source, detected, 235, 220, 95, 65));
  assert(detected.length <= 4, 'Diagonal hatching cannot generate a large set of invented rectangles.');
});

test('KET does not admit an open three-sided shape through the component fallback', () => {
  const source = white();
  const x = 90, y = 100, width = 220, height = 150;
  for (let offset = 0; offset < width; offset++) {
    paint(source, x + offset, y); paint(source, x + offset, y + height - 1);
  }
  for (let offset = 0; offset < height; offset++) {
    paint(source, x, y + offset);
    if (offset < height / 4) paint(source, x + width - 1, y + offset);
  }
  assert(detectPart4FramesFromPixels(source, { allowWideFrames: true }).length > 0);
  assert.deepEqual(detectKetListeningFramesFromPixels(source), []);
});

test('KET ignores unframed text strokes, open lines, transparent and colored page decoration', () => {
  const source = white();
  for (let x = 40; x < 550; x++) paint(source, x, 40);
  for (let y = 90; y < 180; y += 15) for (let x = 40; x < 600; x += 13) for (let offset = 0; offset < 5; offset++) paint(source, x + offset, y);
  frame(source, 60, 250, 150, 100);
  for (let y = 245; y < 355; y++) for (let x = 55; x < 215; x++) source.data[(y * source.width + x) * 4 + 3] = 0;
  frame(source, 300, 250, 150, 100);
  for (let y = 250; y < 350; y++) for (let x = 300; x < 450; x++) {
    const index = (y * source.width + x) * 4;
    if (source.data[index] < 250) { source.data[index] = 250; source.data[index + 1] = 30; source.data[index + 2] = 30; }
  }
  assert.equal(detectKetListeningFramesFromPixels(source).length, 0);
});

test('KET rejects invalid/oversized pixel buffers without allocating image-size work arrays', () => {
  for (const source of [white(20, 20), { width: 3000, height: 3000, data: [] }, { width: 40.5, height: 50, data: [] }, { width: 200, height: 200, data: [0, 0, 0] }]) assert.deepEqual(detectKetListeningFramesFromPixels(source), []);
});
