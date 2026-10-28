import {
  detectPart4FramesFromPixels,
  loadPart4FramePixelSource,
  type Part4DetectedFrame,
  type PixelSource,
} from '../listening-editor/smart-import/part4FrameDetection';
import type { SmartImportCrop } from '../listening-editor/smart-import/types';

interface EdgeRun { start: number; end: number; position: number; }
interface PixelBox { left: number; top: number; right: number; bottom: number; }

const precise = (value: number) => Math.round(value * 100_000) / 100_000;

/**
 * KET scans often have grey, disconnected borders. Find paired straight edges
 * independently instead of requiring the whole frame to be one black component.
 * Rectangular illustration details remain candidates: the layout planner decides
 * whether they are a shared picture, options, or a surrounding example box.
 */
export function detectKetListeningFramesFromPixels(source: PixelSource): Part4DetectedFrame[] {
  const { width, height, data } = source;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 40 || height < 40 || width * height > 6_000_000 || data.length < width * height * 4) return [];
  const dark = new Uint8Array(width * height);
  for (let index = 0; index < dark.length; index++) {
    const offset = index * 4;
    const red = Number(data[offset]), green = Number(data[offset + 1]), blue = Number(data[offset + 2]);
    const luminance = red * .299 + green * .587 + blue * .114;
    if (Number(data[offset + 3]) > 100 && luminance < 236 && Math.max(red, green, blue) - Math.min(red, green, blue) < 72) dark[index] = 1;
  }
  const minimumWidth = Math.max(24, Math.round(width * .025));
  const minimumHeight = Math.max(24, Math.round(height * .025));
  const runs = (horizontal: boolean): EdgeRun[] => {
    const length = horizontal ? width : height, count = horizontal ? height : width;
    const minimum = horizontal ? minimumWidth : minimumHeight;
    const gapLimit = Math.max(4, Math.min(8, Math.round(length * .004)));
    const found: EdgeRun[] = [];
    for (let position = 0; position < count; position++) {
      let start = -1, last = -1, ink = 0;
      const finish = () => {
        if (start >= 0 && last - start + 1 >= minimum && ink / (last - start + 1) >= .72) found.push({ start, end: last, position });
        start = -1; ink = 0;
      };
      for (let offset = 0; offset < length; offset++) {
        const pixel = horizontal ? dark[position * width + offset] : dark[offset * width + position];
        if (pixel) { if (start < 0) start = offset; last = offset; ink++; }
        else if (start >= 0 && offset - last > gapLimit) finish();
      }
      finish();
    }
    // Thick borders create repeated runs. Collapse only the same straight edge,
    // retaining a full span rather than shortening it to a text/inner-art run.
    const groups: EdgeRun[] = [];
    const tolerance = Math.max(2, Math.round(length * .002));
    for (const run of found) {
      const previous = groups.slice(-24).find(value => run.position - value.position <= 3 && Math.abs(value.start - run.start) <= tolerance && Math.abs(value.end - run.end) <= tolerance);
      if (previous) {
        previous.start = Math.min(previous.start, run.start);
        previous.end = Math.max(previous.end, run.end);
      } else groups.push({ ...run });
    }
    return groups;
  };

  const coverage = (box: PixelBox, horizontal: boolean, far: boolean) => {
    const start = horizontal ? box.left : box.top, end = horizontal ? box.right : box.bottom;
    const edge = horizontal ? (far ? box.bottom : box.top) : (far ? box.right : box.left);
    const band = Math.max(2, Math.round(Math.min(box.right - box.left, box.bottom - box.top) * .02));
    let ink = 0;
    const straight = new Uint32Array(band * 2 + 1);
    for (let offset = start; offset <= end; offset++) {
      let covered = false;
      for (let shift = -band; shift <= band; shift++) {
        const x = horizontal ? offset : edge + shift, y = horizontal ? edge + shift : offset;
        if (x >= 0 && x < width && y >= 0 && y < height && dark[y * width + x]) { straight[shift + band]++; covered = true; }
      }
      if (covered) ink++;
    }
    const length = Math.max(1, end - start + 1);
    // A hatched map or curved illustration fills a narrow band without being a
    // straight border. Require substantial support on one fixed scanline too.
    return Math.min(ink / length, Math.max(...straight) / length * 1.3);
  };
  const candidates: Part4DetectedFrame[] = [];
  const addBox = (box: PixelBox) => {
    const snapEdge = (horizontal: boolean, far: boolean) => {
      const start = horizontal ? box.left : box.top, end = horizontal ? box.right : box.bottom;
      const edge = horizontal ? (far ? box.bottom : box.top) : (far ? box.right : box.left);
      const radius = Math.max(4, Math.min(9, Math.round(Math.min(box.right - box.left, box.bottom - box.top) * .05)));
      let best = edge, bestScore = -1;
      for (let shift = -radius; shift <= radius; shift++) {
        const position = edge + shift;
        if (position < 0 || position >= (horizontal ? height : width)) continue;
        let ink = 0;
        for (let offset = start; offset <= end; offset++) if (dark[horizontal ? position * width + offset : offset * width + position]) ink++;
        const score = ink / Math.max(1, end - start + 1) - Math.abs(shift) * .002;
        if (score > bestScore) { bestScore = score; best = position; }
      }
      if (bestScore >= .6) {
        if (horizontal) { if (far) box.bottom = best; else box.top = best; }
        else if (far) box.right = best; else box.left = best;
      }
    };
    snapEdge(false, false); snapEdge(false, true); snapEdge(true, false); snapEdge(true, true);
    const boxWidth = box.right - box.left + 1, boxHeight = box.bottom - box.top + 1;
    if (boxWidth < minimumWidth || boxHeight < minimumHeight || boxWidth > width * .96 || boxHeight > height * .62 || boxWidth / boxHeight < .45 || boxWidth / boxHeight > 12) return;
    const edges = [coverage(box, true, false), coverage(box, true, true), coverage(box, false, false), coverage(box, false, true)];
    const score = edges.reduce((sum, value) => sum + value, 0) / 4;
    // Three independently supported sides plus some evidence of the fourth
    // admit damaged scans without turning open text lines into rectangles.
    if (edges.filter(value => value >= .68).length < 3 || Math.min(...edges) < .5 || score < .75) return;
    const inset = Math.max(1, Math.round(Math.min(boxWidth, boxHeight) * .008));
    const crop = { x: precise((box.left + inset) / width), y: precise((box.top + inset) / height), width: precise((boxWidth - inset * 2) / width), height: precise((boxHeight - inset * 2) / height) };
    if (crop.width > .01 && crop.height > .01) candidates.push({ crop, score });
  };
  // Recheck component candidates with the same four-side rules as line pairs;
  // otherwise an open illustration or joined text can bypass this detector's
  // stricter border evidence through the compatibility fallback.
  for (const { crop } of detectPart4FramesFromPixels(source, { allowWideFrames: true })) {
    addBox({ left: Math.floor(crop.x * width), top: Math.floor(crop.y * height), right: Math.ceil((crop.x + crop.width) * width), bottom: Math.ceil((crop.y + crop.height) * height) });
  }
  const pair = (edges: EdgeRun[], horizontal: boolean) => {
    const tolerance = Math.max(3, Math.round((horizontal ? width : height) * .006));
    const minimum = horizontal ? minimumHeight : minimumWidth;
    const maximum = horizontal ? height * .62 : width * .96;
    const buckets = new Map<number, EdgeRun[]>();
    for (const edge of edges) {
      const key = Math.floor(edge.start / tolerance);
      let previous: EdgeRun | undefined;
      for (let neighbor = key - 1; neighbor <= key + 1; neighbor++) {
        const bucket = buckets.get(neighbor) || [];
        for (let index = bucket.length - 1; index >= 0; index--) {
          const candidate = bucket[index];
          if (edge.position - candidate.position > maximum) break;
          if (edge.position - candidate.position <= 3 || Math.abs(candidate.start - edge.start) > tolerance || Math.abs(candidate.end - edge.end) > tolerance) continue;
          if (!previous || candidate.position > previous.position) previous = candidate;
          break;
        }
      }
      // Pair the nearest matching straight edge, including short gaps which do
      // not themselves make a frame. Skipping such a gap would invent one box
      // across separate A/B/C pictures with otherwise aligned borders.
      if (previous && edge.position - previous.position >= minimum) {
        const start = Math.round((previous.start + edge.start) / 2), end = Math.round((previous.end + edge.end) / 2);
        addBox(horizontal ? { left: start, right: end, top: previous.position, bottom: edge.position } : { top: start, bottom: end, left: previous.position, right: edge.position });
      }
      const bucket = buckets.get(key) || [];
      bucket.push(edge); buckets.set(key, bucket);
    }
  };
  pair(runs(true), true); pair(runs(false), false);
  return deduplicateKetListeningFrames(candidates);
}

/** Merge only duplicate borders; nested illustration rectangles are not discarded. */
export function deduplicateKetListeningFrames(frames: readonly Part4DetectedFrame[]): Part4DetectedFrame[] {
  const intersection = (a: SmartImportCrop, b: SmartImportCrop) => Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  const retained: Part4DetectedFrame[] = [];
  for (const frame of [...frames].sort((a, b) => b.score - a.score || b.crop.width * b.crop.height - a.crop.width * a.crop.height)) {
    if (retained.some(other => {
      const common = intersection(frame.crop, other.crop);
      return common / (frame.crop.width * frame.crop.height + other.crop.width * other.crop.height - common) >= .84;
    })) continue;
    retained.push({ ...frame, crop: { ...frame.crop } });
  }
  return retained;
}

export async function detectKetListeningFrames(imageUrl: string): Promise<Part4DetectedFrame[]> {
  return detectKetListeningFramesFromPixels(await loadPart4FramePixelSource(imageUrl));
}
