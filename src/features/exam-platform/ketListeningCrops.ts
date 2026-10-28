import type { Part4DetectedFrame } from '../listening-editor/smart-import/part4FrameDetection';
import type { SmartImportCrop } from '../listening-editor/smart-import/types';

export interface KetListeningPart1CropGroups {
  questionGroups: SmartImportCrop[][];
  detectedPrintedExample: boolean;
  notices?: string[];
  error?: string;
}

export type KetListeningSourceLayout = 'single-page' | 'two-page';
export interface KetListeningCropSourceOptions {
  sourceLayout: KetListeningSourceLayout;
  /** Normalized vertical boundary between the left and right source pages. */
  pageSplit?: number;
}

const area = (crop: SmartImportCrop) => crop.width * crop.height;
const right = (crop: SmartImportCrop) => crop.x + crop.width;
const bottom = (crop: SmartImportCrop) => crop.y + crop.height;
const validCrop = (crop: SmartImportCrop) => [crop.x, crop.y, crop.width, crop.height].every(Number.isFinite)
  && crop.x >= 0 && crop.y >= 0 && crop.width > 0 && crop.height > 0 && right(crop) <= 1 && bottom(crop) <= 1;
const median = (values: number[]) => {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return !sorted.length ? 0 : sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const contains = (outer: SmartImportCrop, inner: SmartImportCrop) => {
  // Shared scan edges may snap a pixel apart. Keep that small border offset
  // from promoting an otherwise contained map/detail box into another row.
  const tolerance = Math.min(.003, Math.min(inner.width, inner.height) * .08);
  return inner.x >= outer.x - tolerance && inner.y >= outer.y - tolerance
    && right(inner) <= right(outer) + tolerance && bottom(inner) <= bottom(outer) + tolerance;
};
const intersection = (left: SmartImportCrop, other: SmartImportCrop) => ({
  width: Math.min(right(left), right(other)) - Math.max(left.x, other.x),
  height: Math.min(bottom(left), bottom(other)) - Math.max(left.y, other.y),
});
const overlaps = (left: SmartImportCrop, other: SmartImportCrop) => {
  const shared = intersection(left, other);
  return shared.width > Math.min(.003, Math.min(left.width, other.width) * .08)
    && shared.height > Math.min(.003, Math.min(left.height, other.height) * .08);
};
const cropKey = (crop: SmartImportCrop) => [crop.x, crop.y, crop.width, crop.height].map(value => value.toFixed(5)).join(',');
const variantKey = (frames: Part4DetectedFrame[]) => frames.map(frame => cropKey(frame.crop)).join('|');

/** Manual drafts may contain empty slots, but no incomplete/invalid plan can be uploaded. */
export function validateKetListeningCropPlan(
  groups: readonly (readonly (SmartImportCrop | null)[])[],
  expectedCounts: readonly number[],
): string[] {
  const errors: string[] = [];
  if (!expectedCounts.length || expectedCounts.some(count => !Number.isInteger(count) || count < 1 || count > 3)) return ['Bố cục cần từ một đến ba vị trí ảnh cho mỗi câu.'];
  if (groups.length !== expectedCounts.length) return ['Số nhóm crop chưa khớp danh sách câu hỏi.'];
  const selected: SmartImportCrop[] = [];
  groups.forEach((group, index) => {
    if (group.length !== expectedCounts[index]) errors.push(`Câu ${index + 1}: số vùng crop chưa khớp bố cục ảnh.`);
    if (group.some(crop => !crop)) errors.push(`Câu ${index + 1}: cần chọn đủ các vùng ảnh trước khi gán.`);
    group.forEach(crop => {
      if (!crop) return;
      if (!validCrop(crop)) errors.push(`Câu ${index + 1}: vùng crop phải nằm hoàn toàn trong ảnh nguồn.`);
      else selected.push(crop);
    });
  });
  if (selected.some((crop, index) => selected.slice(index + 1).some(other => overlaps(crop, other)))) errors.push('Các vùng crop đang trùng hoặc chồng lên nhau. Hãy chỉnh lại vùng ảnh trước khi gán.');
  return [...new Set(errors)];
}

function duplicate(left: SmartImportCrop, other: SmartImportCrop) {
  const shared = intersection(left, other);
  const intersectionArea = Math.max(0, shared.width) * Math.max(0, shared.height);
  const union = area(left) + area(other) - intersectionArea;
  const tolerance = Math.max(.002, Math.min(left.width, left.height, other.width, other.height) * .12);
  return union > 0 && intersectionArea / union >= .8
    && Math.max(Math.abs(left.x - other.x), Math.abs(left.y - other.y), Math.abs(right(left) - right(other)), Math.abs(bottom(left) - bottom(other))) <= tolerance;
}

type FrameNode = { frame: Part4DetectedFrame; children: FrameNode[] };
function containmentForest(frames: Part4DetectedFrame[]) {
  const nodes = frames.map(frame => ({ frame, children: [] as FrameNode[] }));
  const roots: FrameNode[] = [];
  nodes.forEach(node => {
    const parent = nodes.filter(candidate => candidate !== node && area(candidate.frame.crop) > area(node.frame.crop) * 1.00001
      && contains(candidate.frame.crop, node.frame.crop)).sort((left, other) => area(left.frame.crop) - area(other.frame.crop))[0];
    if (parent) parent.children.push(node);
    else roots.push(node);
  });
  return roots;
}

function rowsOf<T>(items: T[], cropOf: (item: T) => SmartImportCrop): T[][] | null {
  const rows: Array<{ center: number; items: T[] }> = [];
  for (const item of [...items].sort((left, other) => cropOf(left).y + cropOf(left).height / 2 - cropOf(other).y - cropOf(other).height / 2)) {
    const crop = cropOf(item), center = crop.y + crop.height / 2;
    const matching = rows.filter(row => Math.abs(row.center - center) <= Math.max(.012, Math.min(crop.height, median(row.items.map(value => cropOf(value).height))) * .42));
    if (matching.length > 1) return null;
    if (matching[0]) {
      matching[0].items.push(item);
      matching[0].center = matching[0].items.reduce((sum, value) => sum + cropOf(value).y + cropOf(value).height / 2, 0) / matching[0].items.length;
    } else rows.push({ center, items: [item] });
  }
  return rows.sort((left, other) => left.center - other.center).map(row => row.items.sort((left, other) => cropOf(left).x - cropOf(other).x));
}

const distinctVariants = (values: Part4DetectedFrame[][]) => [...new Map(values.map(value => [variantKey(value), value])).values()];
function combineVariants(values: Part4DetectedFrame[][][]) {
  let results: Part4DetectedFrame[][] = [[]];
  for (const variants of values) {
    results = results.flatMap(current => variants.filter(next => current.length + next.length <= 3).map(next => [...current, ...next]));
    if (!results.length) break;
  }
  return distinctVariants(results.filter(frames => frames.length && !frames.some((frame, index) => frames.slice(index + 1).some(other => overlaps(frame.crop, other.crop)))));
}

/** Keep the outer image, or unwrap a container into one horizontal set of 2/3 images. */
function nodeVariants(node: FrameNode, depth = 0): Part4DetectedFrame[][] {
  const result = [[node.frame]];
  if (!node.children.length || node.children.length > 3 || depth >= 16) return result;
  const children = combineVariants(node.children.map(child => nodeVariants(child, depth + 1)))
    .flatMap(frames => {
      const rows = rowsOf(frames, frame => frame.crop);
      // Containment nodes arrive in area/score order. Option images must still
      // follow their printed left-to-right order when their widths differ.
      return frames.length >= 2 && rows?.length === 1 ? [rows[0]] : [];
    });
  return distinctVariants([...result, ...children]);
}

/** Resolve border duplicates/contained illustration detail before matching the explicit question plan. */
export function groupKetListeningPart1OptionCrops(
  detected: Part4DetectedFrame[],
  expectedCounts: readonly number[],
  exampleImageCount?: number,
  options: KetListeningCropSourceOptions = { sourceLayout: 'single-page' },
): KetListeningPart1CropGroups {
  const fail = (error: string): KetListeningPart1CropGroups => ({ questionGroups: [], detectedPrintedExample: false, error });
  if (!expectedCounts.length || expectedCounts.some(count => !Number.isInteger(count) || count < 1 || count > 3)) return fail('Cần chọn từ một đến ba vị trí ảnh cho mỗi câu trước khi dò crop.');
  if (exampleImageCount !== undefined && (!Number.isInteger(exampleImageCount) || exampleImageCount < 1 || exampleImageCount > 3)) return fail('Số ảnh của nhóm example phải từ một đến ba.');
  if (!detected.length) return fail('Không tìm thấy khung ảnh. Hãy chọn vùng ảnh ngay trong bản xem trước hoặc dùng ảnh nguồn rõ hơn.');
  if (detected.length > 512) return fail('Ảnh có quá nhiều đường khung nhỏ. Hãy chọn vùng ảnh trong bản xem trước để tránh gán nhầm.');
  if (detected.some(({ crop }) => !validCrop(crop))) return fail('Bộ dò trả về tọa độ ảnh không hợp lệ; chưa gán ảnh nào.');
  if (options.sourceLayout !== 'single-page' && options.sourceLayout !== 'two-page') return fail('Hãy chọn bố cục một trang hoặc hai trang nằm ngang.');
  const unique: Part4DetectedFrame[] = [];
  for (const candidate of [...detected].sort((left, other) => area(other.crop) - area(left.crop) || other.score - left.score)) {
    if (!unique.some(previous => duplicate(previous.crop, candidate.crop))) unique.push(candidate);
  }
  let pages = [unique];
  if (options.sourceLayout === 'two-page') {
    const split = options.pageSplit ?? .5;
    if (!Number.isFinite(split) || split < .1 || split > .9) return fail('Vạch chia hai trang phải nằm từ 10% đến 90% chiều rộng ảnh.');
    const leftPage: Part4DetectedFrame[] = [], rightPage: Part4DetectedFrame[] = [];
    for (const frame of unique) {
      if (right(frame.crop) <= split + .00001) leftPage.push(frame);
      else if (frame.crop.x >= split - .00001) rightPage.push(frame);
      else return fail('Có khung ảnh cắt qua vạch chia hai trang. Hãy chỉnh vạch chia vào khe giữa hai trang hoặc chỉnh vùng ảnh trong bản xem trước; chưa gán ảnh nào.');
    }
    if (!leftPage.length || !rightPage.length) return fail('Chưa tìm thấy khung ảnh ở cả hai trang. Hãy kiểm tra vạch chia hoặc chọn bố cục một trang; chưa gán ảnh nào.');
    pages = [leftPage, rightPage];
  }
  const rows: FrameNode[][] = [];
  for (const page of pages) {
    const roots = containmentForest(page);
    const pageRows = rowsOf(roots, node => node.frame.crop);
    if (!pageRows) return fail('Có khung ảnh nằm giữa hai hàng. Hãy chỉnh vùng ảnh trong bản xem trước; chưa gán ảnh nào.');
    rows.push(...pageRows);
  }
  const example = rows.length === expectedCounts.length + 1 && exampleImageCount !== undefined;
  if (rows.length !== expectedCounts.length && !example) return fail(`Dò được ${rows.length} hàng; cấu hình cần ${expectedCounts.length} hàng${exampleImageCount ? ' và có thể thêm một hàng example ở đầu' : ''}. Hãy chỉnh vùng trong bản xem trước; chưa gán ảnh nào.`);
  const rowVariants = rows.map(row => row.length > 3 ? [] : combineVariants(row.map(node => nodeVariants(node))));
  if (example) {
    const first = rows[0];
    const wrapper = first.length === 1 && first[0].frame.crop.width >= .2 && first[0].frame.crop.width / first[0].frame.crop.height >= 1.7;
    if (!wrapper && !rowVariants[0].some(variant => variant.length === exampleImageCount)) return fail('Nhóm example chưa khớp số ảnh đã chọn. Hãy kiểm tra vùng example trong bản xem trước.');
  }
  const groups: SmartImportCrop[][] = [];
  for (let index = 0; index < expectedCounts.length; index++) {
    const variants = rowVariants[index + Number(example)].filter(variant => variant.length === expectedCounts[index]);
    if (variants.length !== 1) return fail(variants.length
      ? `Câu ${index + 1}: có nhiều cách xác định khung ảnh. Hãy chọn đúng vùng trong bản xem trước; chưa gán ảnh nào.`
      : `Câu ${index + 1}: khung ảnh chưa khớp ${expectedCounts[index]} vị trí đã chọn. Hãy chỉnh vùng trong bản xem trước; chưa gán ảnh nào.`);
    groups.push(variants[0].map(frame => ({ ...frame.crop })));
  }
  const errors = validateKetListeningCropPlan(groups, expectedCounts);
  if (errors.length) return fail(errors.join(' '));
  const retained = groups.reduce((sum, group) => sum + group.length, 0) + (example ? Math.min(exampleImageCount!, rowVariants[0].find(variant => variant.length === exampleImageCount)?.length || 1) : 0);
  const removed = detected.length - retained;
  return { questionGroups: groups, detectedPrintedExample: example, ...(removed > 0 ? { notices: [`Đã bỏ qua ${removed} khung trùng, khung bao hoặc đường chi tiết bên trong ảnh.`] } : {}) };
}
