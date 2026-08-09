import type { ListeningRegion } from '../types';
import { regionFromPolygon } from '../geometry';

export type EdgeSnapMode = 'inner' | 'outer';

export interface EdgeSnapInput {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
  roughPoints: Array<{ x: number; y: number }>;
  darkLineThreshold?: number;
  mode?: EdgeSnapMode;
}

const insidePolygon = (x: number, y: number, points: Array<{ x: number; y: number }>) => {
  let inside = false;
  for (let first = 0, second = points.length - 1; first < points.length; second = first, first += 1) {
    const a = points[first];
    const b = points[second];
    if (((a.y > y) !== (b.y > y)) && x < ((b.x - a.x) * (y - a.y)) / ((b.y - a.y) || 1e-9) + a.x) inside = !inside;
  }
  return inside;
};

const polygonArea = (points: Array<{ x: number; y: number }>) => Math.abs(points.reduce((sum, point, index) => {
  const next = points[(index + 1) % points.length];
  return sum + point.x * next.y - next.x * point.y;
}, 0) / 2);

const dilate = (mask: Uint8Array, width: number, height: number, radius = 1) => {
  const result = new Uint8Array(mask.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let value = 0;
      for (let dy = -radius; dy <= radius && !value; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          const nextX = x + dx;
          const nextY = y + dy;
          if (nextX >= 0 && nextY >= 0 && nextX < width && nextY < height && mask[nextY * width + nextX]) {
            value = 1;
            break;
          }
        }
      }
      result[y * width + x] = value;
    }
  }
  return result;
};

const erode = (mask: Uint8Array, width: number, height: number, radius = 1) => {
  const result = new Uint8Array(mask.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (!mask[index]) continue;
      let keep = true;
      for (let dy = -radius; dy <= radius && keep; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          const nextX = x + dx;
          const nextY = y + dy;
          if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height || !mask[nextY * width + nextX]) {
            keep = false;
            break;
          }
        }
      }
      if (keep) result[index] = 1;
    }
  }
  return result;
};

const largestComponent = (mask: Uint8Array, width: number, height: number) => {
  const visited = new Uint8Array(mask.length);
  let largest: number[] = [];
  const queue = new Uint32Array(mask.length);
  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || visited[start]) continue;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    visited[start] = 1;
    const component: number[] = [];
    while (head < tail) {
      const current = queue[head++];
      component.push(current);
      const x = current % width;
      const y = Math.floor(current / width);
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          if (!dx && !dy) continue;
          const nextX = x + dx;
          const nextY = y + dy;
          if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) continue;
          const next = nextY * width + nextX;
          if (mask[next] && !visited[next]) {
            visited[next] = 1;
            queue[tail++] = next;
          }
        }
      }
    }
    if (component.length > largest.length) largest = component;
  }
  const result = new Uint8Array(mask.length);
  largest.forEach(index => { result[index] = 1; });
  return { mask: result, area: largest.length };
};

const distanceToSegment = (point: { x: number; y: number }, first: { x: number; y: number }, second: { x: number; y: number }) => {
  const dx = second.x - first.x;
  const dy = second.y - first.y;
  if (!dx && !dy) return Math.hypot(point.x - first.x, point.y - first.y);
  const ratio = Math.max(0, Math.min(1, ((point.x - first.x) * dx + (point.y - first.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(point.x - (first.x + ratio * dx), point.y - (first.y + ratio * dy));
};

const simplifyOpen = (points: Array<{ x: number; y: number }>, tolerance: number): Array<{ x: number; y: number }> => {
  if (points.length <= 2) return points;
  let farthestIndex = -1;
  let farthestDistance = tolerance;
  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = distanceToSegment(points[index], points[0], points.at(-1)!);
    if (distance > farthestDistance) {
      farthestDistance = distance;
      farthestIndex = index;
    }
  }
  if (farthestIndex < 0) return [points[0], points.at(-1)!];
  return [
    ...simplifyOpen(points.slice(0, farthestIndex + 1), tolerance).slice(0, -1),
    ...simplifyOpen(points.slice(farthestIndex), tolerance),
  ];
};

const simplifyClosed = (points: Array<{ x: number; y: number }>, tolerance: number) => {
  if (points.length <= 8) return points;
  let splitIndex = 1;
  let splitDistance = 0;
  for (let index = 1; index < points.length; index += 1) {
    const distance = Math.hypot(points[index].x - points[0].x, points[index].y - points[0].y);
    if (distance > splitDistance) {
      splitDistance = distance;
      splitIndex = index;
    }
  }
  const firstHalf = simplifyOpen(points.slice(0, splitIndex + 1), tolerance);
  const secondHalf = simplifyOpen([...points.slice(splitIndex), points[0]], tolerance);
  return [...firstHalf.slice(0, -1), ...secondHalf.slice(0, -1)];
};

const traceLargestContour = (filled: Uint8Array, width: number, height: number) => {
  const vertexWidth = width + 1;
  const outgoing = new Map<number, number[]>();
  const addEdge = (fromX: number, fromY: number, toX: number, toY: number) => {
    const from = fromY * vertexWidth + fromX;
    const to = toY * vertexWidth + toX;
    const list = outgoing.get(from) || [];
    list.push(to);
    outgoing.set(from, list);
  };
  for (let index = 0; index < filled.length; index += 1) {
    if (!filled[index]) continue;
    const x = index % width;
    const y = Math.floor(index / width);
    if (y === 0 || !filled[index - width]) addEdge(x, y, x + 1, y);
    if (x === width - 1 || !filled[index + 1]) addEdge(x + 1, y, x + 1, y + 1);
    if (y === height - 1 || !filled[index + width]) addEdge(x + 1, y + 1, x, y + 1);
    if (x === 0 || !filled[index - 1]) addEdge(x, y + 1, x, y);
  }
  const loops: Array<Array<{ x: number; y: number }>> = [];
  while (outgoing.size) {
    const start = outgoing.keys().next().value as number;
    const loop: number[] = [start];
    let current = start;
    for (let guard = 0; guard < filled.length * 4; guard += 1) {
      const choices = outgoing.get(current);
      if (!choices?.length) break;
      const next = choices.pop()!;
      if (!choices.length) outgoing.delete(current);
      current = next;
      if (current === start) break;
      loop.push(current);
    }
    if (current === start && loop.length >= 4) {
      loops.push(loop.map(vertex => ({
        x: (vertex % vertexWidth) / width,
        y: Math.floor(vertex / vertexWidth) / height,
      })));
    }
  }
  return loops.sort((first, second) => polygonArea(second) - polygonArea(first))[0];
};

export function edgeSnapPolygon({
  pixels,
  width,
  height,
  roughPoints,
  darkLineThreshold = 185,
  mode = 'inner',
}: EdgeSnapInput): ListeningRegion | undefined {
  if (width < 8 || height < 8 || roughPoints.length < 3 || pixels.length < width * height * 4) return undefined;
  const pixelCount = width * height;
  const roughMask = new Uint8Array(pixelCount);
  const grayscale = new Uint8Array(pixelCount);
  const rawBarrier = new Uint8Array(pixelCount);
  const roughHistogram = new Uint32Array(256);
  let roughArea = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const offset = index * 4;
      const luminance = Math.round(pixels[offset] * .2126 + pixels[offset + 1] * .7152 + pixels[offset + 2] * .0722);
      grayscale[index] = luminance;
      if (insidePolygon((x + .5) / width, (y + .5) / height, roughPoints)) {
        roughMask[index] = 1;
        roughArea += 1;
        roughHistogram[luminance] += 1;
      }
    }
  }
  if (roughArea < 24) return undefined;

  let histogramTotal = 0;
  let paperLuminance = 255;
  const paperTarget = roughArea * .85;
  for (let value = 0; value < roughHistogram.length; value += 1) {
    histogramTotal += roughHistogram[value];
    if (histogramTotal >= paperTarget) {
      paperLuminance = value;
      break;
    }
  }
  // Scanned book outlines are frequently much lighter than internal panels.
  // Adapt to the paper tone and also use local contrast so the outermost faint line
  // remains a barrier instead of snapping to a darker rectangle inside the object.
  const adaptiveLineThreshold = Math.max(darkLineThreshold, Math.min(225, paperLuminance - 28));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (!roughMask[index] || pixels[index * 4 + 3] <= 16) continue;
      const left = grayscale[y * width + Math.max(0, x - 1)];
      const right = grayscale[y * width + Math.min(width - 1, x + 1)];
      const top = grayscale[Math.max(0, y - 1) * width + x];
      const bottom = grayscale[Math.min(height - 1, y + 1) * width + x];
      const edgeStrength = Math.max(Math.abs(right - left), Math.abs(bottom - top));
      if (grayscale[index] <= adaptiveLineThreshold || edgeStrength >= 20) rawBarrier[index] = 1;
    }
  }

  // A one-pixel dilation closes small scan/anti-aliasing gaps before background flood-fill.
  const barrier = dilate(rawBarrier, width, height, 1);
  const outside = new Uint8Array(pixelCount);
  const queue = new Uint32Array(pixelCount);
  let head = 0;
  let tail = 0;
  for (let index = 0; index < pixelCount; index += 1) {
    if (!roughMask[index] || barrier[index]) continue;
    const x = index % width;
    const y = Math.floor(index / width);
    const touchesLassoEdge = x === 0 || y === 0 || x === width - 1 || y === height - 1
      || !roughMask[index - 1] || !roughMask[index + 1] || !roughMask[index - width] || !roughMask[index + width];
    if (touchesLassoEdge) {
      outside[index] = 1;
      queue[tail++] = index;
    }
  }
  if (!tail) return undefined;
  while (head < tail) {
    const current = queue[head++];
    const x = current % width;
    const y = Math.floor(current / width);
    const neighbours = [current - 1, current + 1, current - width, current + width];
    for (let direction = 0; direction < neighbours.length; direction += 1) {
      if ((direction === 0 && x === 0) || (direction === 1 && x === width - 1) || (direction === 2 && y === 0) || (direction === 3 && y === height - 1)) continue;
      const next = neighbours[direction];
      if (roughMask[next] && !barrier[next] && !outside[next]) {
        outside[next] = 1;
        queue[tail++] = next;
      }
    }
  }

  const enclosed = new Uint8Array(pixelCount);
  for (let index = 0; index < pixelCount; index += 1) {
    if (roughMask[index] && !outside[index]) enclosed[index] = 1;
  }
  let primary = largestComponent(enclosed, width, height);
  if (primary.area < 16 || primary.area / roughArea > .94) return undefined;
  if (mode === 'inner') {
    const inset = largestComponent(erode(primary.mask, width, height, 1), width, height);
    if (inset.area >= 12) primary = inset;
  }

  const contour = traceLargestContour(primary.mask, width, height);
  if (!contour) return undefined;
  const simplified = simplifyClosed(contour, 1.25 / Math.max(width, height));
  const limited = simplified.length > 160
    ? simplified.filter((_, index) => index % Math.ceil(simplified.length / 160) === 0)
    : simplified;
  return regionFromPolygon(limited.length >= 3 ? limited : contour) || undefined;
}
