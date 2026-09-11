export interface ExamImagePoint {
  x: number;
  y: number;
}

export interface ExamImageRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ExamImagePointOptions {
  clamp?: boolean;
}

const clampUnit = (value: number) => Math.max(0, Math.min(1, value));

/**
 * Returns the pixel rectangle occupied by the image itself when an
 * object-contain image element has spare (letterboxed) space.
 */
export function containedExamImageRect(
  elementRect: ExamImageRect,
  naturalWidth: number,
  naturalHeight: number,
): ExamImageRect | undefined {
  if (![elementRect.left, elementRect.top, elementRect.width, elementRect.height, naturalWidth, naturalHeight].every(Number.isFinite)) return undefined;
  if (elementRect.width <= 0 || elementRect.height <= 0 || naturalWidth <= 0 || naturalHeight <= 0) return undefined;
  const scale = Math.min(elementRect.width / naturalWidth, elementRect.height / naturalHeight);
  const width = naturalWidth * scale;
  const height = naturalHeight * scale;
  return {
    left: elementRect.left + (elementRect.width - width) / 2,
    top: elementRect.top + (elementRect.height - height) / 2,
    width,
    height,
  };
}

/**
 * Returns the image-content rectangle in coordinates relative to the shared
 * overlay stage. This is the inverse projection used by answer overlays: a
 * normalized stored point rendered inside this rectangle lands on the same
 * image pixel that normalizedExamImagePoint reads from a pointer event.
 */
export function examImageContentRectInStage(
  stageRect: ExamImageRect,
  imageElementRect: ExamImageRect,
  naturalWidth: number,
  naturalHeight: number,
): ExamImageRect | undefined {
  if (![stageRect.left, stageRect.top, stageRect.width, stageRect.height].every(Number.isFinite)) return undefined;
  if (stageRect.width <= 0 || stageRect.height <= 0) return undefined;
  const contentRect = containedExamImageRect(imageElementRect, naturalWidth, naturalHeight);
  if (!contentRect) return undefined;
  return {
    left: contentRect.left - stageRect.left,
    top: contentRect.top - stageRect.top,
    width: contentRect.width,
    height: contentRect.height,
  };
}

export function normalizedExamImagePoint(
  clientX: number,
  clientY: number,
  elementRect: ExamImageRect,
  naturalWidth: number,
  naturalHeight: number,
  options: ExamImagePointOptions = {},
): ExamImagePoint | undefined {
  if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return undefined;
  const imageRect = containedExamImageRect(elementRect, naturalWidth, naturalHeight);
  if (!imageRect) return undefined;
  const x = (clientX - imageRect.left) / imageRect.width;
  const y = (clientY - imageRect.top) / imageRect.height;
  if (!options.clamp && (x < 0 || x > 1 || y < 0 || y > 1)) return undefined;
  return { x: clampUnit(x), y: clampUnit(y) };
}

export function normalizedPointFromExamImage(
  clientX: number,
  clientY: number,
  image: HTMLImageElement | null | undefined,
  options: ExamImagePointOptions = {},
): ExamImagePoint | undefined {
  if (!image) return undefined;
  return normalizedExamImagePoint(
    clientX,
    clientY,
    image.getBoundingClientRect(),
    image.naturalWidth,
    image.naturalHeight,
    options,
  );
}
