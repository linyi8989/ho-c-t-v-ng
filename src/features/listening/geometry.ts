import type { ListeningRegion } from './types';

export interface ListeningPoint {
  x: number;
  y: number;
}

const EPSILON = 1e-7;

export const isNormalizedPoint = (point: ListeningPoint) => (
  Number.isFinite(point.x) && Number.isFinite(point.y)
  && point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1
);

export function polygonArea(points: ListeningPoint[]) {
  if (points.length < 3) return 0;
  return Math.abs(points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length];
    return sum + point.x * next.y - next.x * point.y;
  }, 0)) / 2;
}

const orientation = (a: ListeningPoint, b: ListeningPoint, c: ListeningPoint) => (
  (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y)
);

const onSegment = (a: ListeningPoint, b: ListeningPoint, c: ListeningPoint) => (
  b.x <= Math.max(a.x, c.x) + EPSILON
  && b.x + EPSILON >= Math.min(a.x, c.x)
  && b.y <= Math.max(a.y, c.y) + EPSILON
  && b.y + EPSILON >= Math.min(a.y, c.y)
);

function segmentsIntersect(a: ListeningPoint, b: ListeningPoint, c: ListeningPoint, d: ListeningPoint) {
  const values = [orientation(a, b, c), orientation(a, b, d), orientation(c, d, a), orientation(c, d, b)];
  if (((values[0] > EPSILON && values[1] < -EPSILON) || (values[0] < -EPSILON && values[1] > EPSILON))
    && ((values[2] > EPSILON && values[3] < -EPSILON) || (values[2] < -EPSILON && values[3] > EPSILON))) return true;
  return (Math.abs(values[0]) <= EPSILON && onSegment(a, c, b))
    || (Math.abs(values[1]) <= EPSILON && onSegment(a, d, b))
    || (Math.abs(values[2]) <= EPSILON && onSegment(c, a, d))
    || (Math.abs(values[3]) <= EPSILON && onSegment(c, b, d));
}

export function polygonSelfIntersects(points: ListeningPoint[]) {
  for (let first = 0; first < points.length; first += 1) {
    const firstNext = (first + 1) % points.length;
    for (let second = first + 1; second < points.length; second += 1) {
      const secondNext = (second + 1) % points.length;
      if (first === second || firstNext === second || secondNext === first) continue;
      if (first === 0 && secondNext === 0) continue;
      if (segmentsIntersect(points[first], points[firstNext], points[second], points[secondNext])) return true;
    }
  }
  return false;
}

export function regionFromPolygon(points: ListeningPoint[]): ListeningRegion | null {
  if (points.length < 3 || points.some(point => !isNormalizedPoint(point))) return null;
  if (polygonArea(points) <= EPSILON || polygonSelfIntersects(points)) return null;
  const xs = points.map(point => point.x);
  const ys = points.map(point => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const width = Math.max(...xs) - x;
  const height = Math.max(...ys) - y;
  if (width <= EPSILON || height <= EPSILON) return null;
  return { shape: 'polygon', x, y, width, height, points: points.map(point => ({ ...point })) };
}

export function isValidListeningRegion(region: ListeningRegion | undefined) {
  if (!region || !['rect', 'ellipse', 'polygon'].includes(region.shape)) return false;
  if (![region.x, region.y, region.width, region.height].every(Number.isFinite)) return false;
  if (region.x < 0 || region.y < 0 || region.width <= 0 || region.height <= 0) return false;
  if (region.x + region.width > 1 + EPSILON || region.y + region.height > 1 + EPSILON) return false;
  if (region.shape !== 'polygon') return true;
  const normalized = regionFromPolygon(region.points || []);
  if (!normalized) return false;
  return Math.abs(normalized.x - region.x) <= EPSILON
    && Math.abs(normalized.y - region.y) <= EPSILON
    && Math.abs(normalized.width - region.width) <= EPSILON
    && Math.abs(normalized.height - region.height) <= EPSILON;
}

export function pointInListeningRegion(point: ListeningPoint, region: ListeningRegion) {
  if (!isNormalizedPoint(point)) return false;
  if (region.shape === 'ellipse') {
    const rx = region.width / 2;
    const ry = region.height / 2;
    if (rx <= 0 || ry <= 0) return false;
    const dx = (point.x - region.x - rx) / rx;
    const dy = (point.y - region.y - ry) / ry;
    return dx * dx + dy * dy <= 1 + EPSILON;
  }
  if (region.shape === 'polygon' && region.points?.length) {
    let inside = false;
    for (let index = 0, previous = region.points.length - 1; index < region.points.length; previous = index++) {
      const a = region.points[index];
      const b = region.points[previous];
      const crosses = (a.y > point.y) !== (b.y > point.y)
        && point.x < ((b.x - a.x) * (point.y - a.y)) / ((b.y - a.y) || EPSILON) + a.x;
      if (crosses) inside = !inside;
    }
    return inside;
  }
  return point.x >= region.x - EPSILON && point.x <= region.x + region.width + EPSILON
    && point.y >= region.y - EPSILON && point.y <= region.y + region.height + EPSILON;
}

export function transformListeningPoint(
  point: ListeningPoint,
  sourceScene: ListeningRegion,
  targetScene: ListeningRegion,
) {
  if (!isValidListeningRegion(sourceScene) || !isValidListeningRegion(targetScene)) return null;
  const u = (point.x - sourceScene.x) / sourceScene.width;
  const v = (point.y - sourceScene.y) / sourceScene.height;
  if (!Number.isFinite(u) || !Number.isFinite(v) || u < -EPSILON || u > 1 + EPSILON || v < -EPSILON || v > 1 + EPSILON) return null;
  const transformed = {
    x: targetScene.x + Math.min(1, Math.max(0, u)) * targetScene.width,
    y: targetScene.y + Math.min(1, Math.max(0, v)) * targetScene.height,
  };
  return isNormalizedPoint(transformed) ? transformed : null;
}

export function transformListeningRegion(
  region: ListeningRegion,
  sourceScene: ListeningRegion,
  targetScene: ListeningRegion,
): ListeningRegion | null {
  if (!isValidListeningRegion(region)) return null;
  if (region.shape === 'polygon') {
    const points = (region.points || []).map(point => transformListeningPoint(point, sourceScene, targetScene));
    if (points.some(point => !point)) return null;
    return regionFromPolygon(points as ListeningPoint[]);
  }
  const start = transformListeningPoint({ x: region.x, y: region.y }, sourceScene, targetScene);
  const end = transformListeningPoint({ x: region.x + region.width, y: region.y + region.height }, sourceScene, targetScene);
  if (!start || !end) return null;
  return { shape: region.shape, x: start.x, y: start.y, width: end.x - start.x, height: end.y - start.y };
}
