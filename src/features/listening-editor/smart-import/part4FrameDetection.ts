import type { SmartImportCrop } from './types';

export interface Part4DetectedFrame {
  crop: SmartImportCrop;
  score: number;
}

interface PixelSource {
  width: number;
  height: number;
  data: ArrayLike<number>;
}

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const precise = (value: number) => Math.round(value * 100_000) / 100_000;

const median = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

const intersectionOverUnion = (left: SmartImportCrop, right: SmartImportCrop) => {
  const x1 = Math.max(left.x, right.x);
  const y1 = Math.max(left.y, right.y);
  const x2 = Math.min(left.x + left.width, right.x + right.width);
  const y2 = Math.min(left.y + left.height, right.y + right.height);
  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const union = left.width * left.height + right.width * right.height - intersection;
  return union > 0 ? intersection / union : 0;
};

/**
 * Finds the neutral black/grey rectangular frames around Part 4 option pictures.
 * This deliberately ignores AI coordinates: AI reads text/order, while pixels
 * decide the exact inner crop edge.
 */
export function detectPart4FramesFromPixels(source: PixelSource): Part4DetectedFrame[] {
  const { width, height, data } = source;
  if (width < 40 || height < 40 || data.length < width * height * 4) return [];
  const size = width * height;
  const dark = new Uint8Array(size);
  for (let index = 0; index < size; index += 1) {
    const offset = index * 4;
    const red = Number(data[offset]);
    const green = Number(data[offset + 1]);
    const blue = Number(data[offset + 2]);
    const alpha = Number(data[offset + 3]);
    const maximum = Math.max(red, green, blue);
    const minimum = Math.min(red, green, blue);
    const luminance = red * 0.299 + green * 0.587 + blue * 0.114;
    if (alpha > 100 && luminance < 190 && maximum - minimum < 72) dark[index] = 1;
  }

  const visited = new Uint8Array(size);
  const queue = new Int32Array(size);
  const candidates: Part4DetectedFrame[] = [];
  const minimumWidth = Math.max(24, Math.round(width * 0.025));
  const minimumHeight = Math.max(24, Math.round(height * 0.025));

  const horizontalCoverage = (left: number, right: number, top: number, bottom: number) => {
    let covered = 0;
    for (let x = left; x <= right; x += 1) {
      let found = false;
      for (let y = top; y <= bottom; y += 1) {
        if (dark[y * width + x]) {
          found = true;
          break;
        }
      }
      if (found) covered += 1;
    }
    return covered / Math.max(1, right - left + 1);
  };
  const verticalCoverage = (top: number, bottom: number, left: number, right: number) => {
    let covered = 0;
    for (let y = top; y <= bottom; y += 1) {
      let found = false;
      for (let x = left; x <= right; x += 1) {
        if (dark[y * width + x]) {
          found = true;
          break;
        }
      }
      if (found) covered += 1;
    }
    return covered / Math.max(1, bottom - top + 1);
  };

  for (let start = 0; start < size; start += 1) {
    if (!dark[start] || visited[start]) continue;
    let head = 0;
    let tail = 0;
    let minX = start % width;
    let maxX = minX;
    let minY = Math.floor(start / width);
    let maxY = minY;
    visited[start] = 1;
    queue[tail++] = start;
    while (head < tail) {
      const current = queue[head++];
      const x = current % width;
      const y = Math.floor(current / width);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      if (x > 0 && dark[current - 1] && !visited[current - 1]) {
        visited[current - 1] = 1;
        queue[tail++] = current - 1;
      }
      if (x + 1 < width && dark[current + 1] && !visited[current + 1]) {
        visited[current + 1] = 1;
        queue[tail++] = current + 1;
      }
      if (y > 0 && dark[current - width] && !visited[current - width]) {
        visited[current - width] = 1;
        queue[tail++] = current - width;
      }
      if (y + 1 < height && dark[current + width] && !visited[current + width]) {
        visited[current + width] = 1;
        queue[tail++] = current + width;
      }
    }

    const boxWidth = maxX - minX + 1;
    const boxHeight = maxY - minY + 1;
    const aspect = boxWidth / Math.max(1, boxHeight);
    if (
      boxWidth < minimumWidth
      || boxHeight < minimumHeight
      || boxWidth > width * 0.36
      || boxHeight > height * 0.62
      || aspect < 0.52
      || aspect > 2.1
    ) continue;

    const band = Math.max(1, Math.round(Math.min(boxWidth, boxHeight) * 0.018));
    const top = horizontalCoverage(minX, maxX, minY, Math.min(maxY, minY + band));
    const bottom = horizontalCoverage(minX, maxX, Math.max(minY, maxY - band), maxY);
    const left = verticalCoverage(minY, maxY, minX, Math.min(maxX, minX + band));
    const right = verticalCoverage(minY, maxY, Math.max(minX, maxX - band), maxX);
    const score = (top + bottom + left + right) / 4;
    const strongEdges = [top, bottom, left, right].filter(coverage => coverage >= 0.58).length;
    // Scanned illustrations sometimes omit/fade one border edge. Three strong
    // perpendicular edges still identify the intended option frame reliably.
    if (strongEdges < 3 || score < 0.72) continue;

    const inset = Math.max(1, Math.round(Math.min(boxWidth, boxHeight) * 0.012));
    const crop = {
      x: precise(clamp((minX + inset) / width)),
      y: precise(clamp((minY + inset) / height)),
      width: precise(clamp((boxWidth - inset * 2) / width)),
      height: precise(clamp((boxHeight - inset * 2) / height)),
    };
    if (crop.width > 0.01 && crop.height > 0.01) candidates.push({ crop, score });
  }

  return candidates
    .sort((left, right) => right.score - left.score)
    .filter((candidate, index, all) => all.slice(0, index).every(previous => (
      intersectionOverUnion(previous.crop, candidate.crop) < 0.78
    )));
}

/** Orders frames as questions: top-to-bottom, then left-to-right, three A/B/C frames per question. */
export function groupPart4Frames(
  detected: Part4DetectedFrame[],
  expectedQuestionCount: number
): SmartImportCrop[][] {
  const required = expectedQuestionCount * 3;
  if (!required || detected.length < required) return [];
  const typicalWidth = median(detected.map(frame => frame.crop.width));
  const typicalHeight = median(detected.map(frame => frame.crop.height));
  const consistent = detected.filter(frame => (
    frame.crop.width >= typicalWidth * 0.55
    && frame.crop.width <= typicalWidth * 1.75
    && frame.crop.height >= typicalHeight * 0.55
    && frame.crop.height <= typicalHeight * 1.75
  ));
  const selected = (consistent.length >= required ? consistent : detected)
    .sort((left, right) => right.score - left.score)
    .slice(0, required);
  const rowTolerance = Math.max(0.018, median(selected.map(frame => frame.crop.height)) * 0.48);
  const rows: Array<{ centerY: number; frames: Part4DetectedFrame[] }> = [];
  for (const frame of [...selected].sort((left, right) => (
    left.crop.y + left.crop.height / 2 - (right.crop.y + right.crop.height / 2)
  ))) {
    const centerY = frame.crop.y + frame.crop.height / 2;
    const row = rows.find(candidate => Math.abs(candidate.centerY - centerY) <= rowTolerance);
    if (row) {
      row.frames.push(frame);
      row.centerY = row.frames.reduce((sum, item) => sum + item.crop.y + item.crop.height / 2, 0) / row.frames.length;
    } else {
      rows.push({ centerY, frames: [frame] });
    }
  }
  const ordered = rows
    .sort((left, right) => left.centerY - right.centerY)
    .flatMap(row => row.frames.sort((left, right) => left.crop.x - right.crop.x));
  return Array.from({ length: expectedQuestionCount }, (_, questionIndex) => (
    ordered.slice(questionIndex * 3, questionIndex * 3 + 3).map(frame => frame.crop)
  )).filter(group => group.length === 3);
}

const loadImage = (url: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('Không thể đọc ảnh nguồn để phát hiện khung đen.'));
  image.src = url;
});

export async function detectPart4Frames(imageUrl: string) {
  const image = await loadImage(imageUrl);
  const maximumDimension = 2400;
  const scale = Math.min(1, maximumDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Trình duyệt không hỗ trợ phân tích pixel ảnh.');
  context.drawImage(image, 0, 0, width, height);
  return detectPart4FramesFromPixels(context.getImageData(0, 0, width, height));
}
