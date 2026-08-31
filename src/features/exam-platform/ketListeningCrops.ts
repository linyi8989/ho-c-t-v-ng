import type { Part4DetectedFrame } from '../listening-editor/smart-import/part4FrameDetection';
import type { SmartImportCrop } from '../listening-editor/smart-import/types';

export interface KetListeningPart1CropGroups {
  questionGroups: SmartImportCrop[][];
  detectedPrintedExample: boolean;
}

const median = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

/**
 * KET Listening Part 1 has triplets for printed questions 1, 2, 4 and 5.
 * Printed question 3 is a single combined picture and must never be assigned
 * as an A/B/C crop. A source can additionally contain one example triplet.
 */
export function groupKetListeningPart1OptionCrops(detected: Part4DetectedFrame[]): KetListeningPart1CropGroups {
  if (detected.length < 12) return { questionGroups: [], detectedPrintedExample: false };

  // Do not flatten every detected frame before grouping. The printed question
  // 3 contains one large combined frame; flattening would shift all following
  // A/B/C crops by one position. Instead, build visual rows first and retain
  // only rows that really contain a three-picture answer set.
  const typicalWidth = median(detected.map(frame => frame.crop.width));
  const typicalHeight = median(detected.map(frame => frame.crop.height));
  const consistent = detected.filter(frame => (
    frame.crop.width >= typicalWidth * 0.55
    && frame.crop.width <= typicalWidth * 1.75
    && frame.crop.height >= typicalHeight * 0.55
    && frame.crop.height <= typicalHeight * 1.75
  ));
  const candidates = consistent.length >= 12 ? consistent : detected;
  const rowTolerance = Math.max(0.018, median(candidates.map(frame => frame.crop.height)) * 0.48);
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
    .filter(row => row.frames.length === 3)
    .map(row => row.frames.sort((left, right) => left.crop.x - right.crop.x).map(frame => frame.crop));
  const detectedPrintedExample = triplets.length >= 5;
  return {
    questionGroups: (detectedPrintedExample ? triplets.slice(1) : triplets).slice(0, 4),
    detectedPrintedExample,
  };
}
