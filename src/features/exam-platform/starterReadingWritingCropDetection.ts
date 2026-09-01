import type { SmartImportCrop } from '../listening-editor/smart-import/types';

export interface StarterCropPixelSource {
  width: number;
  height: number;
  data: ArrayLike<number>;
}

export interface StarterReadingCropDetection {
  crops: SmartImportCrop[];
  confidence: number;
  warnings: string[];
}

interface Zone {
  start: number;
  end: number;
}

interface RowBand {
  top: number;
  bottom: number;
  score: number;
}

interface ColourComponent {
  left: number;
  right: number;
  top: number;
  bottom: number;
  pixels: number;
  centerX: number;
  centerY: number;
}

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const precise = (value: number) => Math.round(value * 100_000) / 100_000;
export const STARTER_READING_PART1_CROP_STRATEGY = 'pastel-row-v1';
export const STARTER_READING_PART3_CROP_STRATEGY = 'paired-colour-anchor-v1';
const STARTER_PART1_EXPECTED_ROWS = 7;
const STARTER_PART3_EXPECTED_ROWS = 6;
const PASTEL_SATURATION_THRESHOLD = 20;
// Official Part 1 scans keep every illustration background inside this band.
// Sentence text and checkboxes sit to its right and are not part of detection.
const part1PictureZone = { start: .15, end: .65 };
const part3LeftPictureZone = { start: .15, end: .45 };
const part3RightPictureZone = { start: .63, end: .92 };

const median = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

function hsvSaturation255(red: number, green: number, blue: number) {
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  return maximum > 0 ? ((maximum - minimum) / maximum) * 255 : 0;
}

/** Part 1 backgrounds are colour islands; black text/checkboxes stay excluded. */
function isPastelIllustrationPixel(source: StarterCropPixelSource, x: number, y: number) {
  const offset = (y * source.width + x) * 4;
  const red = Number(source.data[offset]);
  const green = Number(source.data[offset + 1]);
  const blue = Number(source.data[offset + 2]);
  const alpha = Number(source.data[offset + 3]);
  if (alpha < 100 || Math.max(red, green, blue) < 70) return false;
  return hsvSaturation255(red, green, blue) >= PASTEL_SATURATION_THRESHOLD;
}

function zoneBounds(width: number, zone: Zone) {
  return {
    left: Math.max(0, Math.floor(width * zone.start)),
    right: Math.min(width - 1, Math.ceil(width * zone.end)),
  };
}

function detectPastelIllustrationBands(source: StarterCropPixelSource, zone: Zone) {
  const { left, right } = zoneBounds(source.width, zone);
  const zoneWidth = Math.max(1, right - left + 1);
  const rowCounts = new Float64Array(source.height);
  for (let y = 0; y < source.height; y += 1) {
    let count = 0;
    for (let x = left; x <= right; x += 1) if (isPastelIllustrationPixel(source, x, y)) count += 1;
    rowCounts[y] = count;
  }

  // Smooth scan noise, then close only short vertical gaps inside one pastel
  // island. Real gaps between consecutive illustrations remain separated.
  const radius = Math.max(1, Math.round(source.height * .0025));
  const active = new Uint8Array(source.height);
  const minimumPixels = Math.max(5, zoneWidth * .045);
  let windowTotal = 0;
  for (let y = 0; y < source.height; y += 1) {
    windowTotal += rowCounts[y];
    if (y - radius - 1 >= 0) windowTotal -= rowCounts[y - radius - 1];
    const start = Math.max(0, y - radius);
    if (windowTotal / Math.max(1, y - start + 1) >= minimumPixels) active[y] = 1;
  }
  // Keep the close radius below the real inter-card gap. On official scans the
  // last two pastel cards can be only ~1.25% of page height apart; bridging at
  // 1.2% merged both cards and then discarded the oversized combined band.
  const bridgeGap = Math.max(2, Math.round(source.height * .008));
  let gapStart = -1;
  for (let y = 0; y <= source.height; y += 1) {
    if (y < source.height && !active[y]) {
      if (gapStart < 0) gapStart = y;
      continue;
    }
    if (gapStart >= 0) {
      const gapEnd = y - 1;
      if (gapStart > 0 && y < source.height && gapEnd - gapStart + 1 <= bridgeGap) {
        active.fill(1, gapStart, y);
      }
      gapStart = -1;
    }
  }

  const bands: RowBand[] = [];
  let start = -1;
  for (let y = 0; y <= source.height; y += 1) {
    if (y < source.height && active[y]) {
      if (start < 0) start = y;
      continue;
    }
    if (start < 0) continue;
    const bottom = y - 1;
    let score = 0;
    for (let row = start; row <= bottom; row += 1) score += rowCounts[row];
    bands.push({ top: start, bottom, score });
    start = -1;
  }
  const minimumHeight = Math.max(12, source.height * .025);
  const maximumHeight = source.height * .2;
  return bands.filter(band => {
    const height = band.bottom - band.top + 1;
    return height >= minimumHeight && height <= maximumHeight;
  });
}

function cropForPastelBand(source: StarterCropPixelSource, zone: Zone, band: RowBand): SmartImportCrop | undefined {
  const { left, right } = zoneBounds(source.width, zone);
  const bandHeight = band.bottom - band.top + 1;
  const columnCounts = new Float64Array(source.width);
  let minY = band.bottom;
  let maxY = band.top;
  let found = false;
  for (let y = band.top; y <= band.bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      if (!isPastelIllustrationPixel(source, x, y)) continue;
      found = true;
      columnCounts[x] += 1;
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  if (!found) return undefined;

  // A few saturated scan pixels can extend from the pastel card into the text
  // column. Keep only a horizontally dense colour island instead of taking the
  // extrema of every coloured pixel in the row.
  const minimumColumnPixels = Math.max(3, bandHeight * .08);
  const rawIslands: Array<{ left: number; right: number; score: number }> = [];
  let islandLeft = -1;
  for (let x = left; x <= right + 1; x += 1) {
    if (x <= right && columnCounts[x] >= minimumColumnPixels) {
      if (islandLeft < 0) islandLeft = x;
      continue;
    }
    if (islandLeft < 0) continue;
    const islandRight = x - 1;
    let score = 0;
    for (let column = islandLeft; column <= islandRight; column += 1) score += columnCounts[column];
    rawIslands.push({ left: islandLeft, right: islandRight, score });
    islandLeft = -1;
  }
  const bridgeColumns = Math.max(1, Math.round(source.width * .012));
  const islands: typeof rawIslands = [];
  for (const island of rawIslands) {
    const previous = islands.at(-1);
    if (previous && island.left - previous.right - 1 <= bridgeColumns) {
      previous.right = island.right;
      previous.score += island.score;
    } else {
      islands.push({ ...island });
    }
  }
  const mainIsland = islands
    .filter(island => island.right - island.left + 1 >= source.width * .12)
    .sort((first, second) => second.score - first.score)[0];
  if (!mainIsland) return undefined;
  const minX = mainIsland.left;
  const maxX = mainIsland.right;
  const contentWidth = maxX - minX + 1;
  const contentHeight = maxY - minY + 1;
  if (contentWidth < source.width * .08 || contentHeight < source.height * .018) return undefined;
  // The colour mask identifies the pastel background rather than the object.
  // A restrained margin recovers scan-softened edges and grey/black object
  // pixels without pulling the sentence column back into the crop.
  const padX = Math.max(3, Math.round(contentWidth * .035));
  const padY = Math.max(3, Math.round(contentHeight * .035));
  const cropLeft = Math.max(left, minX - padX);
  const cropTop = Math.max(0, minY - padY);
  const cropRight = Math.min(right, maxX + padX);
  const cropBottom = Math.min(source.height - 1, maxY + padY);
  return {
    x: precise(clamp(cropLeft / source.width)),
    y: precise(clamp(cropTop / source.height)),
    width: precise(clamp((cropRight - cropLeft + 1) / source.width)),
    height: precise(clamp((cropBottom - cropTop + 1) / source.height)),
  };
}

function detectColourComponents(source: StarterCropPixelSource, zone: Zone) {
  const { left, right } = zoneBounds(source.width, zone);
  const top = Math.max(0, Math.floor(source.height * .1));
  const bottom = Math.min(source.height - 1, Math.ceil(source.height * .99));
  const roiWidth = right - left + 1;
  const roiHeight = bottom - top + 1;
  const mask = new Uint8Array(roiWidth * roiHeight);
  for (let localY = 0; localY < roiHeight; localY += 1) {
    for (let localX = 0; localX < roiWidth; localX += 1) {
      if (isPastelIllustrationPixel(source, left + localX, top + localY)) {
        mask[localY * roiWidth + localX] = 1;
      }
    }
  }

  const queue = new Int32Array(mask.length);
  const components: ColourComponent[] = [];
  for (let startIndex = 0; startIndex < mask.length; startIndex += 1) {
    if (mask[startIndex] !== 1) continue;
    let head = 0;
    let tail = 0;
    queue[tail++] = startIndex;
    mask[startIndex] = 2;
    let minLocalX = startIndex % roiWidth;
    let maxLocalX = minLocalX;
    let minLocalY = Math.floor(startIndex / roiWidth);
    let maxLocalY = minLocalY;
    let pixels = 0;
    while (head < tail) {
      const index = queue[head++];
      const localX = index % roiWidth;
      const localY = Math.floor(index / roiWidth);
      pixels += 1;
      minLocalX = Math.min(minLocalX, localX);
      maxLocalX = Math.max(maxLocalX, localX);
      minLocalY = Math.min(minLocalY, localY);
      maxLocalY = Math.max(maxLocalY, localY);
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          if (!offsetX && !offsetY) continue;
          const nextX = localX + offsetX;
          const nextY = localY + offsetY;
          if (nextX < 0 || nextX >= roiWidth || nextY < 0 || nextY >= roiHeight) continue;
          const nextIndex = nextY * roiWidth + nextX;
          if (mask[nextIndex] !== 1) continue;
          mask[nextIndex] = 2;
          queue[tail++] = nextIndex;
        }
      }
    }
    const componentLeft = left + minLocalX;
    const componentRight = left + maxLocalX;
    const componentTop = top + minLocalY;
    const componentBottom = top + maxLocalY;
    components.push({
      left: componentLeft,
      right: componentRight,
      top: componentTop,
      bottom: componentBottom,
      pixels,
      centerX: (componentLeft + componentRight) / 2,
      centerY: (componentTop + componentBottom) / 2,
    });
  }
  return components;
}

function isPart3IllustrationComponent(source: StarterCropPixelSource, component: ColourComponent) {
  const width = component.right - component.left + 1;
  const height = component.bottom - component.top + 1;
  return component.pixels >= Math.max(32, source.width * source.height * .0012)
    && width >= Math.max(8, source.width * .025)
    && height >= Math.max(8, source.height * .025)
    && height <= source.height * .2;
}

function unionComponents(components: ColourComponent[]): ColourComponent {
  const left = Math.min(...components.map(component => component.left));
  const right = Math.max(...components.map(component => component.right));
  const top = Math.min(...components.map(component => component.top));
  const bottom = Math.max(...components.map(component => component.bottom));
  return {
    left,
    right,
    top,
    bottom,
    pixels: components.reduce((total, component) => total + component.pixels, 0),
    centerX: (left + right) / 2,
    centerY: (top + bottom) / 2,
  };
}

function cropForColourComponent(source: StarterCropPixelSource, zone: Zone, component: ColourComponent) {
  const zoneBox = zoneBounds(source.width, zone);
  const width = component.right - component.left + 1;
  const height = component.bottom - component.top + 1;
  const padX = Math.max(3, Math.round(width * .06));
  const padY = Math.max(3, Math.round(height * .06));
  const cropLeft = Math.max(zoneBox.left, component.left - padX);
  const cropRight = Math.min(zoneBox.right, component.right + padX);
  const cropTop = Math.max(0, component.top - padY);
  const cropBottom = Math.min(source.height - 1, component.bottom + padY);
  return {
    x: precise(clamp(cropLeft / source.width)),
    y: precise(clamp(cropTop / source.height)),
    width: precise(clamp((cropRight - cropLeft + 1) / source.width)),
    height: precise(clamp((cropBottom - cropTop + 1) / source.height)),
  };
}

function consistency(crops: SmartImportCrop[]) {
  if (!crops.length) return 0;
  const typicalWidth = median(crops.map(crop => crop.width));
  const typicalHeight = median(crops.map(crop => crop.height));
  const stable = crops.filter(crop => (
    crop.width >= typicalWidth * .48 && crop.width <= typicalWidth * 1.85
    && crop.height >= typicalHeight * .48 && crop.height <= typicalHeight * 1.85
  )).length;
  return stable / crops.length;
}

export function detectStarterReadingPart1CropsFromPixels(source: StarterCropPixelSource): StarterReadingCropDetection {
  if (source.width < 80 || source.height < 160 || source.data.length < source.width * source.height * 4) {
    return { crops: [], confidence: 0, warnings: ['Ảnh nguồn quá nhỏ để tự dò 7 hàng hình.'] };
  }
  const bands = detectPastelIllustrationBands(source, part1PictureZone);
  const candidates = bands.flatMap(band => cropForPastelBand(source, part1PictureZone, band) || []);
  const exact = bands.length === STARTER_PART1_EXPECTED_ROWS && candidates.length === STARTER_PART1_EXPECTED_ROWS;
  const crops = exact ? candidates : [];
  return {
    crops,
    confidence: exact ? precise(.74 + consistency(crops) * .22) : 0,
    warnings: exact ? [] : [`Dò được ${candidates.length}/7 dải nền màu; kết quả mơ hồ nên chưa áp dụng crop tự động.`],
  };
}

export function detectStarterReadingPart3CropsFromPixels(source: StarterCropPixelSource): StarterReadingCropDetection {
  if (source.width < 80 || source.height < 160 || source.data.length < source.width * source.height * 4) {
    return { crops: [], confidence: 0, warnings: ['Ảnh nguồn quá nhỏ để tự dò 12 hình.'] };
  }
  const rightAnchors = detectColourComponents(source, part3RightPictureZone)
    .filter(component => isPart3IllustrationComponent(source, component))
    .sort((first, second) => first.centerY - second.centerY);
  if (rightAnchors.length !== STARTER_PART3_EXPECTED_ROWS) {
    return {
      crops: [],
      confidence: 0,
      warnings: [`Dò được ${rightAnchors.length}/6 hình túi bên phải; kết quả mơ hồ nên chưa áp dụng crop tự động.`],
    };
  }

  const leftComponents = detectColourComponents(source, part3LeftPictureZone)
    .filter(component => isPart3IllustrationComponent(source, component));
  const anchorSpacing = median(rightAnchors.slice(1).map((anchor, index) => anchor.centerY - rightAnchors[index].centerY));
  const anchorHeight = median(rightAnchors.map(anchor => anchor.bottom - anchor.top + 1));
  const rowTolerance = Math.max(source.height * .045, anchorSpacing * .43, anchorHeight * .85);
  const assignments = rightAnchors.map(() => [] as ColourComponent[]);
  for (const component of leftComponents) {
    let closestIndex = -1;
    let closestDistance = Number.POSITIVE_INFINITY;
    rightAnchors.forEach((anchor, index) => {
      const distance = Math.abs(component.centerY - anchor.centerY);
      if (distance < closestDistance) {
        closestIndex = index;
        closestDistance = distance;
      }
    });
    if (closestIndex >= 0 && closestDistance <= rowTolerance) assignments[closestIndex].push(component);
  }

  const rows = rightAnchors.flatMap((right, index) => {
    const leftMatches = assignments[index];
    if (!leftMatches.length) return [];
    return [[
      cropForColourComponent(source, part3LeftPictureZone, unionComponents(leftMatches)),
      cropForColourComponent(source, part3RightPictureZone, right),
    ]];
  });
  const crops = rows.flat();
  const exact = rows.length === STARTER_PART3_EXPECTED_ROWS && crops.length === 12;
  return {
    crops,
    confidence: exact ? precise(.74 + consistency(crops) * .22) : 0,
    warnings: exact ? [] : [`Chỉ ghép được ${rows.length}/6 hàng trái/phải theo mốc túi màu; cần kiểm tra và crop thủ công.`],
  };
}

const loadImage = (url: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('Không thể đọc ảnh nguồn để tự dò vùng crop.'));
  image.src = url;
});

async function loadPixels(imageUrl: string): Promise<StarterCropPixelSource> {
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
  return context.getImageData(0, 0, width, height);
}

export async function detectStarterReadingPart1Crops(imageUrl: string) {
  return detectStarterReadingPart1CropsFromPixels(await loadPixels(imageUrl));
}

export async function detectStarterReadingPart3Crops(imageUrl: string) {
  return detectStarterReadingPart3CropsFromPixels(await loadPixels(imageUrl));
}
