import {
  groupPart4Frames,
  type Part4DetectedFrame,
} from '../listening-editor/smart-import/part4FrameDetection';
import type { SmartImportCrop } from '../listening-editor/smart-import/types';

export interface StarterPart3CropGroups {
  questionGroups: SmartImportCrop[][];
  detectedPrintedExample: boolean;
}

/**
 * Starter Part 3 uses the same framed A/B/C grid as Movers Listening Part 4.
 * A source page may contain either 15 scored pictures or 3 example pictures
 * followed by the 15 scored pictures.
 */
export function groupStarterPart3OptionCrops(detected: Part4DetectedFrame[]): StarterPart3CropGroups {
  const sixGroups = groupPart4Frames(detected, 6);
  if (sixGroups.length === 6) {
    return { questionGroups: sixGroups.slice(1), detectedPrintedExample: true };
  }
  const fiveGroups = groupPart4Frames(detected, 5);
  return { questionGroups: fiveGroups, detectedPrintedExample: false };
}
