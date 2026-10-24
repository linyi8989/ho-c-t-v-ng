import assert from 'node:assert/strict';
import test from 'node:test';
import { groupKetListeningPart1OptionCrops } from './ketListeningCrops';
import { detectPart4FramesFromPixels } from '../listening-editor/smart-import/part4FrameDetection';

const row = (count: number, y: number) => Array.from({ length: count }, (_, index) => ({ crop: { x: count === 1 ? .1 : .05 + index * .3, y, width: count === 1 ? .75 : .22, height: .08 }, score: .99 }));
test('crop mapping supports single images at any question and varying image counts without fixed totals', () => {
  for (let sharedIndex = 0; sharedIndex < 5; sharedIndex++) {
    const counts = [3, 2, 3, 2, 3].map((count, index) => index === sharedIndex ? 1 : count);
    const detected = counts.flatMap((count, index) => row(count, .05 + index * .17));
    for (const example of [false, true]) {
      const frames = example ? [...row(3, .001), ...detected] : detected;
      const result = groupKetListeningPart1OptionCrops([...frames].reverse(), counts, 3);
      assert.equal(result.error, undefined);
      assert.equal(result.detectedPrintedExample, example);
      assert.deepEqual(result.questionGroups.map(group => group.length), counts);
      assert.deepEqual(result.questionGroups.flat(), detected.map(frame => frame.crop));
    }
  }
});
test('crop mapping refuses incomplete, extra, overlapping and malformed frames instead of shifting assignments', () => {
  const complete = [...row(1, .1), ...row(3, .4), ...row(2, .7)];
  const invalid = [complete.slice(1), [...complete, ...row(1, .85)], [...complete, complete[2]], [{ crop: { x: -1, y: 0, width: .2, height: .2 }, score: 1 }]];
  for (const frames of invalid) {
    const result = groupKetListeningPart1OptionCrops(frames, [1, 3, 2]);
    assert.ok(result.error);
    assert.deepEqual(result.questionGroups, []);
  }
});
test('KET opts into wide common frames while Movers default pixel detection stays unchanged', () => {
  const width = 900, height = 900;
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  const rectangle = (x: number, y: number, w: number, h: number) => {
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) if (dx < 2 || dy < 2 || dx >= w - 2 || dy >= h - 2) {
      const offset = ((y + dy) * width + x + dx) * 4;
      data[offset] = data[offset + 1] = data[offset + 2] = 0;
    }
  };
  rectangle(60, 60, 760, 160);
  rectangle(60, 400, 200, 160); rectangle(340, 400, 200, 160); rectangle(620, 400, 200, 160);
  const source = { width, height, data };
  assert.equal(detectPart4FramesFromPixels(source).length, 3);
  const mixed = detectPart4FramesFromPixels(source, { allowWideFrames: true });
  assert.equal(mixed.length, 4);
  assert.deepEqual(groupKetListeningPart1OptionCrops(mixed, [1, 3]).questionGroups.map(group => group.length), [1, 3]);
});
