import assert from 'node:assert/strict';
import test from 'node:test';
import {
  detectPart4FramesFromPixels,
  groupPart4Frames,
  type Part4DetectedFrame,
} from './part4FrameDetection';

const createWhitePixels = (width: number, height: number) => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    data[index * 4] = 255;
    data[index * 4 + 1] = 255;
    data[index * 4 + 2] = 255;
    data[index * 4 + 3] = 255;
  }
  return data;
};

const drawBlackFrame = (
  data: Uint8ClampedArray,
  width: number,
  left: number,
  top: number,
  frameWidth: number,
  frameHeight: number,
  thickness = 3
) => {
  const paint = (x: number, y: number) => {
    const offset = (y * width + x) * 4;
    data[offset] = 20;
    data[offset + 1] = 20;
    data[offset + 2] = 20;
  };
  for (let offset = 0; offset < thickness; offset += 1) {
    for (let x = left; x < left + frameWidth; x += 1) {
      paint(x, top + offset);
      paint(x, top + frameHeight - 1 - offset);
    }
    for (let y = top; y < top + frameHeight; y += 1) {
      paint(left + offset, y);
      paint(left + frameWidth - 1 - offset, y);
    }
  }
};

test('Part 4 pixel detector finds the inside of black option frames and ignores text strokes', () => {
  const width = 720;
  const height = 320;
  const data = createWhitePixels(width, height);
  [40, 270, 500].forEach(left => drawBlackFrame(data, width, left, 80, 150, 150));
  // Some source illustrations have a pale/missing bottom edge. The remaining
  // top/left/right frame must still be enough to detect the picture box.
  for (let y = 227; y < 230; y += 1) {
    for (let x = 503; x < 647; x += 1) {
      const offset = (y * width + x) * 4;
      data[offset] = 255;
      data[offset + 1] = 255;
      data[offset + 2] = 255;
    }
  }
  // A dark text-like line is not a closed frame and must not become a crop.
  for (let x = 20; x < 180; x += 1) {
    const offset = (25 * width + x) * 4;
    data[offset] = 10;
    data[offset + 1] = 10;
    data[offset + 2] = 10;
  }

  const frames = detectPart4FramesFromPixels({ width, height, data });
  assert.equal(frames.length, 3);
  assert.ok(frames.every(frame => frame.crop.width > 0.19 && frame.crop.width < 0.22));
  assert.ok(frames.every(frame => frame.crop.y > 0.25 && frame.crop.y < 0.27));
});

test('Part 4 frame grouping orders two-column question rows as A/B/C triples', () => {
  const detected: Part4DetectedFrame[] = [];
  const addQuestion = (startX: number, y: number) => {
    for (let option = 0; option < 3; option += 1) {
      detected.push({
        crop: { x: startX + option * 0.08, y, width: 0.06, height: 0.09 },
        score: 0.95,
      });
    }
  };
  addQuestion(0.05, 0.1);
  addQuestion(0.56, 0.1);
  addQuestion(0.05, 0.42);
  addQuestion(0.56, 0.42);
  addQuestion(0.05, 0.74);

  const groups = groupPart4Frames(detected.reverse(), 5);
  assert.equal(groups.length, 5);
  assert.deepEqual(groups.map(group => group.map(crop => Number(crop.x.toFixed(2)))), [
    [0.05, 0.13, 0.21],
    [0.56, 0.64, 0.72],
    [0.05, 0.13, 0.21],
    [0.56, 0.64, 0.72],
    [0.05, 0.13, 0.21],
  ]);
});
