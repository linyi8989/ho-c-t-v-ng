import type { SmartImportCrop } from '../listening-editor/smart-import/types';

export const KET_CROP_MIN_SIZE = .005;
export type KetCropCorner = 'nw' | 'ne' | 'sw' | 'se';
export type KetCropPoint = { x: number; y: number };
const clamp = (value: number, minimum = 0, maximum = 1) => Math.max(minimum, Math.min(maximum, value));
const precise = (value: number) => Math.round(value * 10_000) / 10_000;

export function normalizeKetCrop(crop: SmartImportCrop): SmartImportCrop | null {
  if (![crop.x, crop.y, crop.width, crop.height].every(Number.isFinite)) return null;
  const width = precise(clamp(crop.width, KET_CROP_MIN_SIZE));
  const height = precise(clamp(crop.height, KET_CROP_MIN_SIZE));
  return { x: precise(clamp(crop.x, 0, 1 - width)), y: precise(clamp(crop.y, 0, 1 - height)), width, height };
}

export function drawKetCrop(start: KetCropPoint, end: KetCropPoint) {
  if (![start.x, start.y, end.x, end.y].every(Number.isFinite)) return null;
  const left = Math.min(clamp(start.x), clamp(end.x)), top = Math.min(clamp(start.y), clamp(end.y));
  const right = Math.max(clamp(start.x), clamp(end.x)), bottom = Math.max(clamp(start.y), clamp(end.y));
  return normalizeKetCrop({ x: left, y: top, width: right - left, height: bottom - top });
}

export function moveKetCrop(crop: SmartImportCrop, offset: KetCropPoint) {
  return normalizeKetCrop({ ...crop, x: crop.x + offset.x, y: crop.y + offset.y });
}

export function resizeKetCrop(crop: SmartImportCrop, corner: KetCropCorner, point: KetCropPoint) {
  if (![point.x, point.y].every(Number.isFinite)) return null;
  let { x: left, y: top } = crop;
  let right = crop.x + crop.width, bottom = crop.y + crop.height;
  if (corner.includes('w')) left = clamp(point.x, 0, right - KET_CROP_MIN_SIZE);
  if (corner.includes('e')) right = clamp(point.x, left + KET_CROP_MIN_SIZE, 1);
  if (corner.includes('n')) top = clamp(point.y, 0, bottom - KET_CROP_MIN_SIZE);
  if (corner.includes('s')) bottom = clamp(point.y, top + KET_CROP_MIN_SIZE, 1);
  return normalizeKetCrop({ x: left, y: top, width: right - left, height: bottom - top });
}

/** Preserve the pointer's grab offset within a resize handle. */
export function resizeKetCropByOffset(crop: SmartImportCrop, corner: KetCropCorner, offset: KetCropPoint) {
  return resizeKetCrop(crop, corner, {
    x: (corner.includes('w') ? crop.x : crop.x + crop.width) + offset.x,
    y: (corner.includes('n') ? crop.y : crop.y + crop.height) + offset.y,
  });
}
