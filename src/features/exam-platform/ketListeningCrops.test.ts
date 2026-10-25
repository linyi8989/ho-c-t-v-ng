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
      // The example sits entirely above Q1; overlapping source rectangles are not a valid layout.
      const frames = example ? [...row(3, .001).map(frame => ({ ...frame, crop: { ...frame.crop, height: .03 } })), ...detected] : detected;
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

const spreadTriple = (x: number, y: number) => Array.from({ length: 3 }, (_, index) => ({ crop: { x: x + index * .14, y, width: .10, height: .08 }, score: .99 }));
const spreadMap = (x: number, y: number) => [{ crop: { x, y, width: .40, height: .14 }, score: .99 }];
function spreadFrames(staggered: boolean, example = true) {
  const questions = [
    spreadMap(.04, staggered ? .35 : .31),
    spreadTriple(.04, staggered ? .82 : .76),
    spreadTriple(.54, staggered ? .19 : .08),
    spreadTriple(.54, staggered ? .51 : .31),
    spreadTriple(.54, staggered ? .68 : .76),
  ];
  return { questions, detected: [...(example ? spreadTriple(.04, .08) : []), ...questions.flat()] };
}

test('two horizontal pages keep the entire left page before the right page, including identical row heights', () => {
  for (const staggered of [false, true]) for (const example of [false, true]) {
    const { detected, questions } = spreadFrames(staggered, example);
    const result = groupKetListeningPart1OptionCrops([...detected].reverse(), [1, 3, 3, 3, 3], 3, { sourceLayout: 'two-page' });
    assert.equal(result.error, undefined);
    assert.equal(result.detectedPrintedExample, example);
    assert.deepEqual(result.questionGroups, questions.map(group => group.map(frame => frame.crop)));
    assert.ok(result.questionGroups[0].every(crop => crop.x < .5));
    assert.ok(result.questionGroups[1].every(crop => crop.x < .5));
    assert.ok(result.questionGroups.slice(2).flat().every(crop => crop.x > .5));
  }
});

test('two-page mapping refuses a wrong retained shared layout even when global top-to-bottom counts match it', () => {
  const { detected } = spreadFrames(true);
  // The old global-Y grouping accepted this incorrect Q2-shared plan and mapped right-page Q3 into Q1.
  const result = groupKetListeningPart1OptionCrops(detected, [3, 1, 3, 3, 3], 3, { sourceLayout: 'two-page' });
  assert.ok(result.error); assert.deepEqual(result.questionGroups, []);
  const q3Shared = groupKetListeningPart1OptionCrops(detected, [3, 3, 1, 3, 3], 3, { sourceLayout: 'two-page' });
  assert.ok(q3Shared.error); assert.deepEqual(q3Shared.questionGroups, []);
});

test('equal-count triplets never interleave pages, and one-page A/B/C columns remain one question', () => {
  const left = [spreadTriple(.04, .30), spreadTriple(.04, .80)];
  const right = [spreadTriple(.54, .10), spreadTriple(.54, .45), spreadTriple(.54, .65)];
  const twoPage = groupKetListeningPart1OptionCrops([...left.flat(), ...right.flat()], [3, 3, 3, 3, 3], undefined, { sourceLayout: 'two-page' });
  assert.equal(twoPage.error, undefined);
  assert.deepEqual(twoPage.questionGroups, [...left, ...right].map(group => group.map(frame => frame.crop)));
  const onePage = [...row(3, .1), ...row(3, .4), ...row(3, .7)];
  assert.deepEqual(groupKetListeningPart1OptionCrops(onePage, [3, 3, 3], undefined, { sourceLayout: 'single-page' }), groupKetListeningPart1OptionCrops(onePage, [3, 3, 3]));
  assert.deepEqual(groupKetListeningPart1OptionCrops(onePage, [3, 3, 3]).questionGroups.map(group => group.length), [3, 3, 3]);
});

test('page split is explicit, adjustable and refuses crossing frames, missing pages and invalid boundaries', () => {
  const left = spreadTriple(.02, .6).map(frame => ({ ...frame, crop: { ...frame.crop, x: frame.crop.x * .7, width: .07 } }));
  const right = spreadTriple(.45, .2);
  const detected = [...left, ...right];
  const custom = groupKetListeningPart1OptionCrops(detected, [3, 3], undefined, { sourceLayout: 'two-page', pageSplit: .42 });
  assert.equal(custom.error, undefined); assert.deepEqual(custom.questionGroups, [left, right].map(group => group.map(frame => frame.crop)));
  for (const split of [0, .09, .91, 1, NaN, Infinity, .5]) {
    const invalid = groupKetListeningPart1OptionCrops(detected, [3, 3], undefined, { sourceLayout: 'two-page', pageSplit: split });
    assert.ok(invalid.error); assert.deepEqual(invalid.questionGroups, []);
  }
  const missingPage = groupKetListeningPart1OptionCrops(left, [3], undefined, { sourceLayout: 'two-page' });
  assert.ok(missingPage.error); assert.deepEqual(missingPage.questionGroups, []);
  const unknown = groupKetListeningPart1OptionCrops(detected, [3, 3], undefined, { sourceLayout: 'three-columns' as never });
  assert.ok(unknown.error); assert.deepEqual(unknown.questionGroups, []);
});

test('nested example borders, map boxes, duplicate and extra detections never create an assignment', () => {
  const { detected } = spreadFrames(true);
  const nestedMap = { crop: { x: .08, y: .38, width: .10, height: .04 }, score: .99 };
  const outerExample = { crop: { x: .02, y: .06, width: .44, height: .12 }, score: .99 };
  const extra = { crop: { x: .57, y: .91, width: .10, height: .04 }, score: .99 };
  for (const frames of [[...detected, nestedMap], [...detected, outerExample], [...detected, detected[2]], [...detected, extra]]) {
    const result = groupKetListeningPart1OptionCrops(frames, [1, 3, 3, 3, 3], 3, { sourceLayout: 'two-page' });
    assert.ok(result.error); assert.deepEqual(result.questionGroups, []);
  }
});

test('pixel detection on a real two-page geometry maps Q1 shared left, Q2 left and Q3–5 right in reading order', () => {
  const width = 1600, height = 1100;
  const data = new Uint8ClampedArray(width * height * 4).fill(255);
  const { detected } = spreadFrames(false);
  for (const { crop } of detected) {
    const x = Math.round(crop.x * width), y = Math.round(crop.y * height);
    const w = Math.round(crop.width * width), h = Math.round(crop.height * height);
    for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) if (dx < 2 || dy < 2 || dx >= w - 2 || dy >= h - 2) {
      const offset = ((y + dy) * width + x + dx) * 4;
      data[offset] = data[offset + 1] = data[offset + 2] = 0;
    }
  }
  const pixels = detectPart4FramesFromPixels({ width, height, data }, { allowWideFrames: true });
  assert.equal(pixels.length, detected.length);
  const grouped = groupKetListeningPart1OptionCrops(pixels, [1, 3, 3, 3, 3], 3, { sourceLayout: 'two-page' });
  assert.equal(grouped.error, undefined);
  assert.deepEqual(grouped.questionGroups.map(group => group.length), [1, 3, 3, 3, 3]);
  assert.ok(grouped.questionGroups.slice(0, 2).flat().every(crop => crop.x < .5));
  assert.ok(grouped.questionGroups.slice(2).flat().every(crop => crop.x > .5));
});
