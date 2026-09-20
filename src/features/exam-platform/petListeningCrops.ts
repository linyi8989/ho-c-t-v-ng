import {
  detectPart4FramesFromPixels,
  loadPart4FramePixelSource,
  type Part4DetectedFrame,
  type PixelSource,
} from '../listening-editor/smart-import/part4FrameDetection';
import type { SmartImportCrop } from '../listening-editor/smart-import/types';

export interface PetListeningPart1CropGroups {
  questionGroups: SmartImportCrop[][];
  exampleGroup?: SmartImportCrop[];
  detectedPrintedExample: boolean;
}

const median = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

const precise = (value: number) => Math.round(Math.max(0, Math.min(1, value)) * 100_000) / 100_000;

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
 * PET source pages often use pale one-pixel boxes and teachers may paste two
 * or three complete pages into one tall image. The shared strict detector is
 * intentionally conservative, so PET adds this local relaxed fallback. It
 * joins tiny scan gaps before finding components, then still requires three
 * strong sides and regular frame proportions to avoid treating text as art.
 */
function detectPalePetFramesFromPixels(source: PixelSource): Part4DetectedFrame[] {
  const { width, height, data } = source;
  if (width < 80 || height < 80 || data.length < width * height * 4) return [];
  const size = width * height;
  const ink = new Uint8Array(size);
  for (let index = 0; index < size; index += 1) {
    const offset = index * 4;
    const red = Number(data[offset]);
    const green = Number(data[offset + 1]);
    const blue = Number(data[offset + 2]);
    const alpha = Number(data[offset + 3]);
    const maximum = Math.max(red, green, blue);
    const minimum = Math.min(red, green, blue);
    const luminance = red * 0.299 + green * 0.587 + blue * 0.114;
    if (alpha > 80 && luminance < 236 && maximum - minimum < 90) ink[index] = 1;
  }

  const bridge = Math.max(1, Math.min(2, Math.round(width / 700)));
  const joined = new Uint8Array(size);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (!ink[y * width + x]) continue;
      for (let dy = -bridge; dy <= bridge; dy += 1) {
        const nextY = y + dy;
        if (nextY < 0 || nextY >= height) continue;
        for (let dx = -bridge; dx <= bridge; dx += 1) {
          const nextX = x + dx;
          if (nextX >= 0 && nextX < width) joined[nextY * width + nextX] = 1;
        }
      }
    }
  }

  const horizontalCoverage = (left: number, right: number, top: number, bottom: number) => {
    let covered = 0;
    for (let x = left; x <= right; x += 1) {
      let found = false;
      for (let y = top; y <= bottom; y += 1) {
        if (ink[y * width + x]) { found = true; break; }
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
        if (ink[y * width + x]) { found = true; break; }
      }
      if (found) covered += 1;
    }
    return covered / Math.max(1, bottom - top + 1);
  };

  const visited = new Uint8Array(size);
  const queue = new Int32Array(size);
  const candidates: Part4DetectedFrame[] = [];
  const minimumWidth = Math.max(28, Math.round(width * 0.075));
  const maximumWidth = Math.round(width * 0.34);
  // Deliberately derive vertical bounds from page width, not the height of a
  // multi-page stitched image.
  const minimumHeight = Math.max(18, Math.round(width * 0.035));
  const maximumHeight = Math.max(40, Math.round(width * 0.38));

  for (let start = 0; start < size; start += 1) {
    if (!joined[start] || visited[start]) continue;
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
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      if (x > 0 && joined[current - 1] && !visited[current - 1]) { visited[current - 1] = 1; queue[tail++] = current - 1; }
      if (x + 1 < width && joined[current + 1] && !visited[current + 1]) { visited[current + 1] = 1; queue[tail++] = current + 1; }
      if (y > 0 && joined[current - width] && !visited[current - width]) { visited[current - width] = 1; queue[tail++] = current - width; }
      if (y + 1 < height && joined[current + width] && !visited[current + width]) { visited[current + width] = 1; queue[tail++] = current + width; }
    }

    const boxWidth = maxX - minX + 1;
    const boxHeight = maxY - minY + 1;
    const aspect = boxWidth / Math.max(1, boxHeight);
    if (boxWidth < minimumWidth || boxWidth > maximumWidth || boxHeight < minimumHeight || boxHeight > maximumHeight || aspect < 0.5 || aspect > 2.5) continue;
    const band = Math.max(2, bridge + Math.round(Math.min(boxWidth, boxHeight) * 0.025));
    const innerLeft = Math.min(maxX, minX + bridge);
    const innerRight = Math.max(minX, maxX - bridge);
    const innerTop = Math.min(maxY, minY + bridge);
    const innerBottom = Math.max(minY, maxY - bridge);
    const top = horizontalCoverage(innerLeft, innerRight, innerTop, Math.min(innerBottom, innerTop + band));
    const bottom = horizontalCoverage(innerLeft, innerRight, Math.max(innerTop, innerBottom - band), innerBottom);
    const left = verticalCoverage(innerTop, innerBottom, innerLeft, Math.min(innerRight, innerLeft + band));
    const right = verticalCoverage(innerTop, innerBottom, Math.max(innerLeft, innerRight - band), innerRight);
    const edges = [top, bottom, left, right];
    const score = edges.reduce((sum, value) => sum + value, 0) / edges.length;
    if (edges.filter(value => value >= 0.42).length < 3 || score < 0.56) continue;
    const inset = bridge + Math.max(1, Math.round(Math.min(boxWidth, boxHeight) * 0.01));
    const crop = {
      x: precise((minX + inset) / width),
      y: precise((minY + inset) / height),
      width: precise((boxWidth - inset * 2) / width),
      height: precise((boxHeight - inset * 2) / height),
    };
    if (crop.width > 0.02 && crop.height > 0.005) candidates.push({ crop, score });
  }
  return candidates;
}

export function detectPetListeningPart1OptionFramesFromPixels(source: PixelSource): Part4DetectedFrame[] {
  const combined = [
    ...detectPart4FramesFromPixels(source),
    ...detectPalePetFramesFromPixels(source),
  ].sort((left, right) => right.score - left.score);
  return combined.filter((candidate, index, all) => all.slice(0, index).every(previous => intersectionOverUnion(previous.crop, candidate.crop) < 0.68));
}

export async function detectPetListeningPart1OptionFrames(imageUrl: string) {
  // A taller PET source may contain three pasted pages. Keeping up to 3600 px
  // preserves its one-pixel printed borders while remaining canvas-safe.
  const pixels = await loadPart4FramePixelSource(imageUrl, 3600);
  return detectPetListeningPart1OptionFramesFromPixels(pixels);
}

function chooseOuterTriplet(frames: Part4DetectedFrame[]) {
  const candidates = [...frames]
    .sort((left, right) => right.crop.width * right.crop.height - left.crop.width * left.crop.height)
    .slice(0, 12);
  let best: { frames: Part4DetectedFrame[]; score: number } | undefined;
  for (let first = 0; first < candidates.length - 2; first += 1) {
    for (let second = first + 1; second < candidates.length - 1; second += 1) {
      for (let third = second + 1; third < candidates.length; third += 1) {
        const triplet = [candidates[first], candidates[second], candidates[third]].sort((left, right) => left.crop.x - right.crop.x);
        const widths = triplet.map(frame => frame.crop.width);
        const heights = triplet.map(frame => frame.crop.height);
        const widthRatio = Math.max(...widths) / Math.max(0.0001, Math.min(...widths));
        const heightRatio = Math.max(...heights) / Math.max(0.0001, Math.min(...heights));
        if (widthRatio > 1.85 || heightRatio > 1.85) continue;
        const centers = triplet.map(frame => frame.crop.x + frame.crop.width / 2);
        const gaps = [centers[1] - centers[0], centers[2] - centers[1]];
        const averageWidth = widths.reduce((sum, value) => sum + value, 0) / 3;
        if (Math.min(...gaps) < averageWidth * 0.58 || Math.max(...gaps) > averageWidth * 3.2) continue;
        if (Math.max(...gaps) / Math.max(0.0001, Math.min(...gaps)) > 2.1) continue;
        const area = triplet.reduce((sum, frame) => sum + frame.crop.width * frame.crop.height, 0);
        const edgeScore = triplet.reduce((sum, frame) => sum + frame.score, 0) / 3;
        const regularityPenalty = (widthRatio - 1) + (heightRatio - 1) + Math.abs(gaps[0] - gaps[1]) * 3;
        const score = area * 100 + edgeScore - regularityPenalty;
        if (!best || score > best.score) best = { frames: triplet, score };
      }
    }
  }
  return best;
}

/** Groups PET Listening Part 1 option frames into visual A/B/C rows. */
export function groupPetListeningPart1OptionCrops(
  detected: Part4DetectedFrame[],
  questionCount: number,
): PetListeningPart1CropGroups {
  const required = questionCount * 3;
  if (!questionCount || detected.length < required) return { questionGroups: [], detectedPrintedExample: false };
  const typicalHeight = median(detected.map(frame => frame.crop.height));
  const candidates = detected;
  const rowTolerance = Math.max(0.012, median(candidates.map(frame => frame.crop.height)) * 0.48);
  const rows: Array<{ centerY: number; frames: Part4DetectedFrame[] }> = [];
  for (const frame of [...candidates].sort((left, right) => (
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
  const triplets = rows
    .sort((left, right) => left.centerY - right.centerY)
    .map(row => chooseOuterTriplet(row.frames))
    .filter((triplet): triplet is NonNullable<typeof triplet> => Boolean(triplet))
    .map(triplet => triplet.frames.map(frame => frame.crop));
  const detectedPrintedExample = triplets.length >= questionCount + 1;
  return {
    ...(detectedPrintedExample ? { exampleGroup: triplets[0] } : {}),
    questionGroups: (detectedPrintedExample ? triplets.slice(1) : triplets).slice(0, questionCount),
    detectedPrintedExample,
  };
}
