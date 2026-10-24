import type { Part4DetectedFrame } from '../listening-editor/smart-import/part4FrameDetection';
import type { SmartImportCrop } from '../listening-editor/smart-import/types';

export interface KetListeningPart1CropGroups {
  questionGroups: SmartImportCrop[][];
  detectedPrintedExample: boolean;
  error?: string;
}

const median = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

/** Match every visual row against the current per-question image plan before assigning any crop. */
export function groupKetListeningPart1OptionCrops(
  detected: Part4DetectedFrame[],
  expectedCounts: readonly number[],
  exampleImageCount?: number,
): KetListeningPart1CropGroups {
  const fail = (error: string): KetListeningPart1CropGroups => ({ questionGroups: [], detectedPrintedExample: false, error });
  if (!expectedCounts.length || expectedCounts.some(count => !Number.isInteger(count) || count < 1 || count > 3)) return fail('Cần chọn từ một đến ba vị trí ảnh cho mỗi câu trước khi dò crop.');
  if (exampleImageCount !== undefined && (!Number.isInteger(exampleImageCount) || exampleImageCount < 1 || exampleImageCount > 3)) return fail('Số ảnh của nhóm example phải từ một đến ba.');
  if (!detected.length) return fail('Không tìm thấy khung ảnh. Hãy crop thủ công hoặc dùng ảnh nguồn rõ hơn.');
  if (detected.some(({ crop }) => ![crop.x, crop.y, crop.width, crop.height].every(Number.isFinite) || crop.x < 0 || crop.y < 0 || crop.width <= 0 || crop.height <= 0 || crop.x + crop.width > 1.00001 || crop.y + crop.height > 1.00001)) return fail('Bộ dò trả về tọa độ ảnh không hợp lệ; chưa gán ảnh nào.');
  const rows: Array<{ centerY: number; frames: Part4DetectedFrame[] }> = [];
  for (const frame of [...detected].sort((left, right) => (
    left.crop.y + left.crop.height / 2 - (right.crop.y + right.crop.height / 2)
  ))) {
    const centerY = frame.crop.y + frame.crop.height / 2;
    const candidates = rows.filter(row => Math.abs(row.centerY - centerY) <= Math.max(.012, Math.min(frame.crop.height, median(row.frames.map(item => item.crop.height))) * .42));
    if (candidates.length > 1) return fail('Có khung ảnh nằm giữa hai hàng; chưa thể xác định thứ tự câu một cách chắc chắn. Hãy crop thủ công.');
    const row = candidates[0];
    if (row) {
      row.frames.push(frame);
      row.centerY = row.frames.reduce((sum, item) => sum + item.crop.y + item.crop.height / 2, 0) / row.frames.length;
    } else {
      rows.push({ centerY, frames: [frame] });
    }
  }
  const grouped = rows.sort((left, right) => left.centerY - right.centerY).map(row => row.frames.sort((left, right) => left.crop.x - right.crop.x));
  for (const row of grouped) {
    for (let index = 1; index < row.length; index += 1) {
      if (row[index - 1].crop.x + row[index - 1].crop.width > row[index].crop.x + .006) return fail('Có các khung ảnh chồng lên nhau; chưa gán ảnh nào để tránh lệch câu. Hãy crop thủ công.');
    }
  }
  const matches = (values: Part4DetectedFrame[][]) => values.length === expectedCounts.length && values.every((row, index) => row.length === expectedCounts[index]);
  const exact = matches(grouped);
  const withExample = exampleImageCount !== undefined && grouped[0]?.length === exampleImageCount && matches(grouped.slice(1));
  if (exact === withExample) return fail(`Dò được ${grouped.length} hàng (${grouped.map(row => row.length).join(' / ')} ảnh); cấu hình câu cần ${expectedCounts.join(' / ')}${exampleImageCount ? `, có thể thêm nhóm example ${exampleImageCount} ảnh ở đầu` : ''}. Chưa gán ảnh nào; hãy kiểm tra bố cục hoặc crop thủ công.`);
  return { questionGroups: (withExample ? grouped.slice(1) : grouped).map(row => row.map(frame => ({ ...frame.crop }))), detectedPrintedExample: withExample };
}
