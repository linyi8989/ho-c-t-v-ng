import assert from 'node:assert/strict';
import test from 'node:test';
import {
  STARTER_READING_PART1_CROP_STRATEGY,
  STARTER_READING_PART3_CROP_STRATEGY,
  detectStarterReadingPart1CropsFromPixels,
  detectStarterReadingPart3CropsFromPixels,
  type StarterCropPixelSource,
} from './starterReadingWritingCropDetection';

function page(width: number, height: number): StarterCropPixelSource {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    data[index * 4] = 255;
    data[index * 4 + 1] = 255;
    data[index * 4 + 2] = 255;
    data[index * 4 + 3] = 255;
  }
  return { width, height, data };
}

function paint(source: StarterCropPixelSource, left: number, top: number, right: number, bottom: number, colour: [number, number, number]) {
  const data = source.data as Uint8ClampedArray;
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      const offset = (y * source.width + x) * 4;
      data[offset] = colour[0];
      data[offset + 1] = colour[1];
      data[offset + 2] = colour[2];
    }
  }
}

test('Starters Reading Part 1 detector returns two examples then five question crops', () => {
  const source = page(300, 820);
  paint(source, 50, 8, 250, 16, [20, 20, 20]);
  Array.from({ length: 7 }, (_, index) => 55 + index * 105).forEach((top, index) => {
    paint(source, 44, top, 158, top + 66, index % 2 ? [224, 242, 180] : [224, 210, 244]);
    // Grey/black objects must remain inside the crop even though they are not
    // part of the saturation mask.
    paint(source, 72, top + 15, 131, top + 53, index % 2 ? [80, 80, 80] : [170, 170, 170]);
    paint(source, 181, top + 24, 286, top + 28, [30, 30, 30]);
  });

  assert.equal(STARTER_READING_PART1_CROP_STRATEGY, 'pastel-row-v1');
  const result = detectStarterReadingPart1CropsFromPixels(source);
  assert.equal(result.crops.length, 7);
  assert.ok(result.confidence >= .9);
  assert.deepEqual(result.warnings, []);
  assert.ok(result.crops.every(crop => crop.x < .2 && crop.x + crop.width < .66));
  assert.ok(result.crops.every((crop, index) => index === 0 || crop.y > result.crops[index - 1].y));
});

test('Starters Reading Part 1 ignores coloured noise outside the illustration column', () => {
  const source = page(300, 820);
  Array.from({ length: 7 }, (_, index) => 55 + index * 105).forEach((top, index) => {
    paint(source, 52, top, 158, top + 66, index % 2 ? [210, 235, 174] : [220, 202, 238]);
    paint(source, 230, top + 20, 285, top + 40, [235, 90, 90]);
  });
  const result = detectStarterReadingPart1CropsFromPixels(source);
  assert.equal(result.crops.length, 7);
  assert.ok(result.crops.every(crop => crop.x + crop.width <= .65));
});

test('Starters Reading Part 1 keeps closely spaced shoe and sofa rows separate', () => {
  const source = page(307, 797);
  const rows = [[22, 112], [126, 212], [242, 335], [415, 500], [515, 598], [611, 695], [706, 790]];
  rows.forEach(([top, bottom], index) => {
    paint(source, 64, top, 176, bottom, index % 2 ? [210, 235, 174] : [220, 202, 238]);
  });
  const result = detectStarterReadingPart1CropsFromPixels(source);
  assert.equal(result.crops.length, 7);
  assert.ok(result.crops[6].y > result.crops[5].y + result.crops[5].height);
});

test('Starters Reading Part 1 excludes sparse coloured scan haze beside the illustration card', () => {
  const source = page(307, 797);
  const rows = [[22, 112], [126, 212], [242, 335], [415, 500], [515, 598], [611, 695], [706, 790]];
  rows.forEach(([top, bottom], index) => {
    paint(source, 68, top, 172, bottom, index % 2 ? [210, 235, 174] : [220, 202, 238]);
    paint(source, 173, top + 20, 199, top + 22, [210, 226, 240]);
  });
  const result = detectStarterReadingPart1CropsFromPixels(source);
  assert.equal(result.crops.length, 7);
  assert.ok(result.crops.every(crop => crop.x >= .2));
  assert.ok(result.crops.every(crop => crop.x + crop.width < .59));
});

test('Starters Reading Part 1 rejects eight pastel rows instead of choosing the strongest seven', () => {
  const source = page(300, 900);
  Array.from({ length: 8 }, (_, index) => 35 + index * 105).forEach((top, index) => {
    paint(source, 52, top, 158, top + 62, index % 2 ? [210, 235, 174] : [220, 202, 238]);
  });
  const result = detectStarterReadingPart1CropsFromPixels(source);
  assert.deepEqual(result.crops, []);
  assert.equal(result.confidence, 0);
  assert.match(result.warnings[0], /8\/7/);
});

test('Starters Reading Part 3 detector pairs six left pictures with six right letter bags', () => {
  const source = page(320, 640);
  paint(source, 90, 8, 230, 16, [20, 20, 20]);
  Array.from({ length: 6 }, (_, index) => 62 + index * 91).forEach((top, index) => {
    paint(source, 24, top, 104, top + 55, index % 2 ? [242, 205, 190] : [218, 220, 248]);
    paint(source, 226, top + 1, 306, top + 56, [244, 228, 134]);
    paint(source, 132, top + 31, 188, top + 34, [35, 35, 35]);
  });

  const result = detectStarterReadingPart3CropsFromPixels(source);
  assert.equal(STARTER_READING_PART3_CROP_STRATEGY, 'paired-colour-anchor-v1');
  assert.equal(result.crops.length, 12);
  assert.ok(result.confidence >= .9);
  assert.deepEqual(result.warnings, []);
  result.crops.forEach((crop, index) => {
    if (index % 2 === 0) assert.ok(crop.x + crop.width < .45);
    else assert.ok(crop.x > .6);
  });
  for (let row = 1; row < 6; row += 1) assert.ok(result.crops[row * 2].y > result.crops[(row - 1) * 2].y);
});

test('Starters Reading Part 3 merges two feet components into one anchored left crop', () => {
  const source = page(330, 428);
  const centers = [102, 167, 225, 280, 332, 383];
  centers.forEach((center, index) => {
    paint(source, 228, center - 22, 274, center + 22, [234, 224, 134]);
    if (index === 4) {
      paint(source, 64, center - 20, 84, center + 18, [238, 196, 178]);
      paint(source, 102, center - 19, 126, center + 17, [238, 196, 178]);
    } else {
      paint(source, 72, center - 18, 112, center + 18, [238, 196, 178]);
    }
    paint(source, 140, center - 1, 150, center + 1, [190, 210, 120]);
  });
  const result = detectStarterReadingPart3CropsFromPixels(source);
  assert.equal(result.crops.length, 12);
  const feetCrop = result.crops[8];
  assert.ok(feetCrop.x <= 64 / source.width);
  assert.ok(feetCrop.x + feetCrop.width >= 126 / source.width);
  assert.ok(result.crops.every((crop, index) => index % 2 ? crop.x >= .63 : crop.x + crop.width <= .45));
});

test('Starters Reading Part 3 rejects five right anchors instead of guessing a missing pair', () => {
  const source = page(330, 428);
  Array.from({ length: 5 }, (_, index) => 92 + index * 62).forEach(center => {
    paint(source, 72, center - 18, 112, center + 18, [238, 196, 178]);
    paint(source, 228, center - 22, 274, center + 22, [234, 224, 134]);
  });
  const result = detectStarterReadingPart3CropsFromPixels(source);
  assert.deepEqual(result.crops, []);
  assert.equal(result.confidence, 0);
  assert.match(result.warnings[0], /5\/6 hình túi bên phải/);
});

test('Starters crop detection refuses an ambiguous blank page instead of guessing mappings', () => {
  const part1 = detectStarterReadingPart1CropsFromPixels(page(300, 820));
  const part3 = detectStarterReadingPart3CropsFromPixels(page(320, 640));
  assert.deepEqual(part1.crops, []);
  assert.deepEqual(part3.crops, []);
  assert.equal(part1.confidence, 0);
  assert.equal(part3.confidence, 0);
  assert.match(part1.warnings[0], /0\/7/);
  assert.match(part3.warnings[0], /0\/6/);
});
